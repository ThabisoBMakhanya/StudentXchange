import './config/env.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query } from './config/db.js';
import { requireAdmin, requireApprovedKyc, requireAuth, type AuthRequest } from './middleware/auth.js';
import { createDpoCheckout, refundDpoToken, verifyDpoToken } from './services/dpo.js';
import { getMomoPaymentStatus, getMomoTransferStatus, momoConfigured, normalizeEswatiniMsisdn, requestMomoPayment, requestMomoTransfer } from './services/momo.js';
import { emailDeliveryConfigured, sendKycApprovedEmail, sendKycReviewNotification, sendVerificationEmail, sendVerifiedEmail } from './services/email.js';

export const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? true }));
app.use((req,res,next) => (req as any).sxBodyParsedByVercel ? next() : express.json({ limit: '2mb' })(req,res,next));

const roleFor = (roles: string[] = []) => roles.includes('ADMIN') ? 'admin' : roles.includes('SELLER') ? 'seller' : 'customer';
const userView = (user: any) => ({ id:user.id,email:user.email,full_name:user.fullName,campus:user.university,role:roleFor(user.roles),kyc_status:String(user.kycStatus??'NOT_SUBMITTED').toLowerCase() });
const uiStatus = (status: string, receiptConfirmed = false) => {
  if (status === 'PENDING_PAYMENT') return 'pending_payment';
  if (status === 'HELD' || status === 'WITHHELD_BY_ADMIN') return receiptConfirmed ? 'completed' : 'paid';
  if (status === 'DISPUTED') return 'disputed';
  if (status === 'RELEASED') return 'completed';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'REFUNDED') return 'refunded';
  if (status === 'SPLIT') return 'split';
  return 'cancelled';
};
const listingType = (value: string) => value === 'PHYSICAL' ? 'physical' : 'service';
const audit = (client: any, actorId: string | null, action: string, targetType: string, targetId: string, detail = '') =>
  client.query('INSERT INTO audit_logs ("id","actorId","action","targetType","targetId","detail") VALUES ($1,$2,$3,$4,$5,$6)', [randomUUID(),actorId,action,targetType,targetId,detail]);
const publicApiOrigin = () => (process.env.API_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://studentxchange.vercel.app')).replace(/\/$/, '');
const momoCallbackUrl = (referenceId: string) => `${publicApiOrigin()}/api/payments/momo/callback/${encodeURIComponent(referenceId)}`;
const momoPayoutCallbackUrl = (referenceId: string) => `${publicApiOrigin()}/api/payments/momo/payout-callback/${encodeURIComponent(referenceId)}`;
async function recordEscrowCredit(client: any, orderId: string, amount: string | number, providerReference: string) {
  await client.query(`INSERT INTO escrow_ledger ("id","orderId","entryType","amount","reason","balanceAfter","idempotencyKey","providerReference")
    VALUES ($1,$2,'credit',$3,'payment_received',$3,$4,$5) ON CONFLICT ("idempotencyKey") DO NOTHING`,
  [randomUUID(),orderId,amount,`payment:${orderId}`,providerReference]);
}
async function recordEscrowDebit(client: any, orderId: string, amount: string | number, reason: string, idempotencyKey: string, balanceAfter: string | number) {
  await client.query(`INSERT INTO escrow_ledger ("id","orderId","entryType","amount","reason","balanceAfter","idempotencyKey")
    VALUES ($1,$2,'debit',$3,$4,$5,$6) ON CONFLICT ("idempotencyKey") DO NOTHING`, [randomUUID(),orderId,amount,reason,balanceAfter,idempotencyKey]);
}
async function releaseOrderToPayout(client: any, order: any, actorId: string | null, auditReason = 'escrow_released') {
  const total=Number(order.total),commission=Number(order.commission||0),sellerAmount=Number((total-commission).toFixed(2));
  if(!Number.isFinite(total)||!Number.isFinite(commission)||sellerAmount<0)throw new Error('Order payout amounts are invalid.');
  await client.query('UPDATE orders SET "escrowStatus"=\'RELEASED\',"updatedAt"=now() WHERE "id"=$1',[order.id]);
  const payout=await client.query('INSERT INTO payouts ("id","sellerId","orderId","amount","updatedAt") VALUES ($1,$2,$3,$4,now()) ON CONFLICT ("orderId") DO UPDATE SET "amount"=EXCLUDED."amount" RETURNING "id"',[randomUUID(),order.sellerId,order.id,sellerAmount]);
  await recordEscrowDebit(client,order.id,sellerAmount,'released_to_seller',`release:seller:${order.id}`,commission);
  if(commission>0)await recordEscrowDebit(client,order.id,commission,'platform_commission',`release:commission:${order.id}`,0);
  await audit(client,actorId,auditReason,'order',order.id);
  return {id:payout.rows[0].id,orderId:order.id,sellerId:order.sellerId,amount:sellerAmount,phone:order.sellerPhone,paymentMethod:order.paymentMethod};
}
async function dispatchMomoPayout(payout: any) {
  if(process.env.MTN_AUTO_PAYOUT!=='true'||!momoConfigured('disbursement'))return;
  let phone:string;try{phone=normalizeEswatiniMsisdn(payout.phone);}catch(error){console.error('MTN seller payout not sent because seller phone is invalid:',error instanceof Error?error.message:'unknown phone error');return;}
  const referenceId=randomUUID();
  const saved=await query('UPDATE payouts SET "momoReferenceId"=$2,"updatedAt"=now() WHERE "id"=$1 AND "status"=\'PENDING\' AND "momoReferenceId" IS NULL RETURNING "id"',[payout.id,referenceId]);
  if(!saved.rows[0])return;
  try {await requestMomoTransfer({payoutId:payout.id,amount:String(payout.amount),phone,referenceId,callbackUrl:momoPayoutCallbackUrl(referenceId)});}
  catch(error){if(error instanceof Error&&/\(HTTP 4\d\d\)/.test(error.message))await query('UPDATE payouts SET "momoReferenceId"=NULL,"updatedAt"=now() WHERE "id"=$1 AND "momoReferenceId"=$2 AND "status"=\'PENDING\'',[payout.id,referenceId]);console.error('MTN seller payout request failed; status can be reconciled by reference:',referenceId,error instanceof Error?error.message:'unknown payout error');}
}
async function syncMomoPayout(referenceId:string) {
  const status=await getMomoTransferStatus(referenceId);
  const payoutResult=await query('SELECT p."id",p."amount",p."status",p."momoReferenceId" FROM payouts p WHERE p."momoReferenceId"=$1',[referenceId]);
  const payout=payoutResult.rows[0];if(!payout)return {status:'not_found'};
  const providerStatus=String(status?.status||'PENDING').toUpperCase();
  if(!['SUCCESSFUL','FAILED'].includes(providerStatus))return {status:'pending'};
  if(String(status?.externalId||'')!==String(payout.id)||String(status?.currency||'').toUpperCase()!=='SZL'||!Number.isFinite(Number(status?.amount))||Number(status?.amount).toFixed(2)!==Number(payout.amount).toFixed(2))throw new Error('MTN MoMo payout status does not match the payout record.');
  const saved=await query('UPDATE payouts SET "status"=$2::"PayoutStatus","providerReference"=$3,"updatedAt"=now() WHERE "id"=$1 AND "status"=\'PENDING\' RETURNING "id"',[payout.id,providerStatus==='SUCCESSFUL'?'PAID':'FAILED',referenceId]);
  return {status:providerStatus.toLowerCase(),payoutId:payout.id,updated:Boolean(saved.rows[0])};
}
async function syncMomoPayment(referenceId: string) {
  const payment = await getMomoPaymentStatus(referenceId);
  const status = String(payment?.status || 'PENDING').toUpperCase();
    if (status !== 'SUCCESSFUL') {
      if(status==='FAILED')await query('UPDATE orders SET "momoReferenceId"=NULL,"momoPayerMsisdn"=NULL,"updatedAt"=now() WHERE "momoReferenceId"=$1 AND "escrowStatus"=\'PENDING_PAYMENT\'',[referenceId]);
      return { status: status.toLowerCase(), reason: payment?.reason };
    }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT o."id",o."listingId",o."quantity",o."sellerId",o."paymentMethod",o."escrowStatus",o."total",o."momoReferenceId",l."stock" FROM orders o JOIN listings l ON l."id"=o."listingId" WHERE o."momoReferenceId"=$1 FOR UPDATE OF o,l', [referenceId]);
    const order = found.rows[0];
    if (!order || order.paymentMethod !== 'MTN_MOMO' || String(payment?.externalId || '') !== order.id || String(payment?.currency || '').toUpperCase() !== 'SZL' || !Number.isFinite(Number(payment?.amount)) || Number(payment?.amount).toFixed(2) !== Number(order.total).toFixed(2)) {
      await client.query('ROLLBACK');
      throw new Error('MTN MoMo success response does not match the pending order.');
    }
    if (order.escrowStatus !== 'PENDING_PAYMENT') {
      await client.query('COMMIT');
      return { status: order.escrowStatus === 'HELD' ? 'successful' : String(order.escrowStatus).toLowerCase(), orderId: order.id };
    }
    const cancelled = await client.query('SELECT 1 FROM audit_logs WHERE "targetType"=\'order\' AND "targetId"=$1 AND "action"=\'buyer_cancelled_order\' LIMIT 1', [order.id]);
    const reservation = await client.query('SELECT 1 FROM audit_logs WHERE "targetType"=\'order\' AND "targetId"=$1 AND "action"=\'order_inventory_reserved\' LIMIT 1', [order.id]);
    const inventoryInsufficient = Boolean(reservation.rows[0]) && order.stock !== null && Number(order.stock) < Number(order.quantity);
    if (cancelled.rows[0] || inventoryInsufficient) {
      await client.query('UPDATE orders SET "escrowStatus"=\'DISPUTED\',"updatedAt"=now() WHERE "id"=$1', [order.id]);
      await recordEscrowCredit(client, order.id, order.total, referenceId);
      await audit(client, order.sellerId, 'payment_requires_admin_review', 'order', order.id, cancelled.rows[0] ? 'MoMo payment completed after the order was cancelled.' : 'MoMo payment completed but inventory was no longer available.');
      await client.query('COMMIT');
      return { status: 'needs_review', orderId: order.id };
    }
    if (reservation.rows[0] && order.stock !== null) {
      const remaining = Number(order.stock) - Number(order.quantity);
      await client.query('UPDATE listings SET "stock"=$2,"status"=CASE WHEN $2=0 THEN \'SOLD_OUT\'::"ListingStatus" ELSE "status" END,"updatedAt"=now() WHERE "id"=$1', [order.listingId, remaining]);
    }
    await client.query('UPDATE orders SET "escrowStatus"=\'HELD\',"updatedAt"=now() WHERE "id"=$1', [order.id]);
    await recordEscrowCredit(client, order.id, order.total, referenceId);
    await audit(client, order.sellerId, 'payment_confirmed', 'order', order.id, referenceId);
    await client.query('COMMIT');
    return { status: 'successful', orderId: order.id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
async function settleDpoToken(token: string, callbackCompanyRef?: string) {
  const client=await pool.connect();
  try {
    const found=await client.query('SELECT o."id",o."listingId",o."quantity",o."sellerId",o."paymentMethod",o."escrowStatus",o."total",o."dpoCompanyRef",l."stock" FROM orders o JOIN listings l ON l."id"=o."listingId" WHERE o."dpoTransactionToken"=$1',[token]);
    const order=found.rows[0];
    if(!order||order.paymentMethod!=='DPO_PAY'||(callbackCompanyRef&&order.dpoCompanyRef!==callbackCompanyRef))return 'pending';
    const verified=await verifyDpoToken(token);
    if(verified.result!=='000'||(verified.companyRef&&verified.companyRef!==order.dpoCompanyRef)||!Number.isFinite(Number(verified.amount))||Number(verified.amount).toFixed(2)!==Number(order.total).toFixed(2)||verified.currency.toUpperCase()!=='SZL')return 'pending';
    await client.query('BEGIN');
    const locked=await client.query('SELECT o."id",o."listingId",o."quantity",o."sellerId",o."escrowStatus",o."total",l."stock" FROM orders o JOIN listings l ON l."id"=o."listingId" WHERE o."id"=$1 FOR UPDATE OF o,l',[order.id]);
    const current=locked.rows[0];
    if(!current||current.escrowStatus!=='PENDING_PAYMENT') {await client.query('COMMIT');return current?.escrowStatus==='HELD'?'paid':'pending';}
    const cancelled=await client.query('SELECT 1 FROM audit_logs WHERE "targetType"=\'order\' AND "targetId"=$1 AND "action"=\'buyer_cancelled_order\' LIMIT 1',[current.id]);
    const reservation=await client.query('SELECT 1 FROM audit_logs WHERE "targetType"=\'order\' AND "targetId"=$1 AND "action"=\'order_inventory_reserved\' LIMIT 1',[current.id]);
    if(cancelled.rows[0]||(reservation.rows[0]&&current.stock!==null&&Number(current.stock)<Number(current.quantity))){
      await client.query('UPDATE orders SET "escrowStatus"=\'DISPUTED\',"updatedAt"=now() WHERE "id"=$1',[current.id]);
      await recordEscrowCredit(client,current.id,current.total,verified.reference||token);
      await audit(client,current.sellerId,'payment_requires_admin_review','order',current.id,cancelled.rows[0]?'DPO payment completed after the order was cancelled.':'DPO payment completed but inventory was no longer available.');
      await client.query('COMMIT');return 'review';
    }
    if(reservation.rows[0]&&current.stock!==null){const remaining=Number(current.stock)-Number(current.quantity);await client.query('UPDATE listings SET "stock"=$2,"status"=CASE WHEN $2=0 THEN \'SOLD_OUT\'::"ListingStatus" ELSE "status" END,"updatedAt"=now() WHERE "id"=$1',[current.listingId,remaining]);}
    await client.query('UPDATE orders SET "escrowStatus"=\'HELD\',"updatedAt"=now() WHERE "id"=$1',[current.id]);
    await recordEscrowCredit(client,current.id,current.total,verified.reference||token);
    await audit(client,current.sellerId,'payment_confirmed','order',current.id,(verified.reference||token).slice(0,255));
    await client.query('COMMIT');return 'paid';
  } catch(error) { await client.query('ROLLBACK');throw error; }
  finally {client.release();}
}
const verificationUrl = (token: string) => { const origin=process.env.API_BASE_URL||process.env.FRONTEND_URL||(process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:'https://studentxchange.vercel.app');const link=new URL('/api/auth/verify-email',origin);link.searchParams.set('token',token);return link.toString(); };
async function issueEmailVerification(userId:string,email:string,fullName:string) {
  const token=randomBytes(32).toString('base64url');const tokenHash=createHash('sha256').update(token).digest('hex');const id=randomUUID();
  await query('INSERT INTO email_verification_tokens ("id","userId","tokenHash","expiresAt") VALUES ($1,$2,$3,now()+interval \'15 minutes\')',[id,userId,tokenHash]);
  let sent: Awaited<ReturnType<typeof sendVerificationEmail>>;
  try { sent=await sendVerificationEmail(email,fullName,verificationUrl(token)); }
  catch(error) { await query('DELETE FROM email_verification_tokens WHERE "id"=$1',[id]);throw error; }
  await query('UPDATE email_verification_tokens SET "usedAt"=now() WHERE "userId"=$1 AND "id"<>$2 AND "usedAt" IS NULL',[userId,id]);
  return sent;
}

async function notifyAdminsOfKycSubmission(userId: string) {
  if (!emailDeliveryConfigured()) return;
  try {
    const [studentResult, adminsResult] = await Promise.all([
      query('SELECT "fullName","email","university" FROM users WHERE "id"=$1', [userId]),
      query('SELECT "email" FROM users WHERE "roles" @> ARRAY[\'ADMIN\'::"Role"] AND "status"=\'ACTIVE\''),
    ]);
    const student = studentResult.rows[0];
    const admins = [...new Set<string>(adminsResult.rows.map((row: any) => String(row.email).trim().toLowerCase()).filter(Boolean))];
    if (!student || admins.length === 0) return;
    const frontend = (process.env.FRONTEND_URL || 'https://studentxchange.vercel.app').replace(/\/$/, '');
    const reviewUrl = `${frontend}/admin`;
    const deliveries = await Promise.allSettled(admins.map((email) => sendKycReviewNotification(email, student.fullName, student.email, student.university || '', reviewUrl)));
    deliveries.forEach((delivery, index) => {
      if (delivery.status === 'fulfilled') console.info('Student verification review notification accepted by Resend.', { email: admins[index], emailId: delivery.value?.id });
      else console.error('Student verification review notification failed:', delivery.reason instanceof Error ? delivery.reason.message : 'unknown email error');
    });
  } catch (error) {
    console.error('Could not notify admins about student verification:', error instanceof Error ? error.message : 'unknown notification error');
  }
}

async function verifyAdminEmailToken(value: unknown) {
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{40,60}$/.test(value))return null;
  const tokenHash=createHash('sha256').update(value).digest('hex');const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const found=await client.query('SELECT t."id",t."userId",t."usedAt",t."expiresAt",t."createdAt",u."email",u."fullName",u."emailVerified",u."roles" FROM email_verification_tokens t JOIN users u ON u."id"=t."userId" WHERE t."tokenHash"=$1 FOR UPDATE OF t',[tokenHash]);
    const account=found.rows[0];
    if(!account||!account.roles?.includes('ADMIN')||account.emailVerified||account.usedAt||new Date(account.expiresAt).getTime()<=Date.now()||Date.now()-new Date(account.createdAt).getTime()>15*60_000) { await client.query('ROLLBACK');return null; }
    const consumed=await client.query('UPDATE email_verification_tokens SET "usedAt"=now() WHERE "id"=$1 AND "usedAt" IS NULL AND "expiresAt">now() AND "createdAt">now()-interval \'15 minutes\' RETURNING "userId"',[account.id]);
    if(!consumed.rows[0]) { await client.query('ROLLBACK');return null; }
    const updated=await client.query('UPDATE users SET "emailVerified"=true,"updatedAt"=now() WHERE "id"=$1 AND "emailVerified"=false AND "roles" @> ARRAY[\'ADMIN\'::"Role"] RETURNING "id"',[account.userId]);
    if(!updated.rows[0]) { await client.query('ROLLBACK');return null; }
    await client.query('UPDATE email_verification_tokens SET "usedAt"=now() WHERE "userId"=$1 AND "usedAt" IS NULL',[account.userId]);
    await audit(client,account.userId,'email_verified','user',account.userId);
    await client.query('COMMIT');
    return {email:account.email,fullName:account.fullName};
  } catch(error) { await client.query('ROLLBACK');throw error; }
  finally { client.release(); }
}

function verificationResultPage(success: boolean) {
  const title=success?'Email verified':'Verification link invalid';
  const message=success?'Your administrator email is verified. You can now sign in to StudentXchange.':'This verification link is invalid, expired, or already used. Request a new link and try again.';
  const status=success?200:400;
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | StudentXchange</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101318;color:#f3f5fa;font:16px system-ui,sans-serif}.card{width:min(90vw,34rem);box-sizing:border-box;padding:2rem;border:1px solid #343b49;border-radius:1rem;background:#191e28}.brand{color:#8eafff;font-weight:800;letter-spacing:.08em}h1{margin:1.5rem 0 .5rem}p{color:#bdc5d4;line-height:1.6}a{display:inline-block;margin-top:1rem;padding:.8rem 1rem;border-radius:.5rem;background:#2353d4;color:white;text-decoration:none;font-weight:700}</style></head><body><main class="card"><div class="brand">STUDENTXCHANGE</div><h1>${title}</h1><p>${message}</p><a href="${process.env.FRONTEND_URL||'https://studentxchange.vercel.app'}">Return to StudentXchange</a></main></body></html>`;
  return {status,html};
}

app.get('/api/health', async (_req,res) => {
  try { const result=await query('SELECT current_database() AS database'); return res.json({status:'ok',database:result.rows[0]?.database}); }
  catch { return res.status(503).json({status:'database_unavailable'}); }
});

app.post('/api/auth/register', async (req,res) => {
  const {email,password,full_name,campus,phone,role}=req.body??{};
  if(typeof email!=='string'||typeof password!=='string'||typeof full_name!=='string'||password.length<8) return res.status(400).json({error:'Provide your name, email and a password of at least 8 characters.'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return res.status(400).json({error:'Enter a valid email address.'});
  if(role&&!['customer','seller'].includes(role)) return res.status(400).json({error:'Choose customer or seller.'});
  const roles=role==='seller'?['CUSTOMER','SELLER']:['CUSTOMER'];
  try {
    const hash=await bcrypt.hash(password,12);
    const normalizedEmail=email.trim().toLowerCase();
    const created=await query('INSERT INTO users ("id","email","phone","university","passwordHash","fullName","roles","emailVerified","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7::"Role"[],true,now()) RETURNING "id","email","fullName","university","roles","kycStatus","status"',[randomUUID(),normalizedEmail,String(phone??'').trim(),String(campus??'').trim(),hash,full_name.trim(),roles]);
    const createdUser=created.rows[0];const safe=userView(createdUser);
    return res.status(201).json({token:signToken(createdUser.id,safe.role),user:safe});
  } catch(error:any) { if(error.code==='23505') return res.status(409).json({error:'An account already exists for that email.'}); console.error('Registration failed:',error.message); return res.status(500).json({error:'Could not create your account.'}); }
});

app.post('/api/auth/resend-verification',async (req,res) => {
  const email=String(req.body?.email??'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Enter a valid email address.'});
  const generic={message:'If this is an unverified administrator account, a verification email will be sent.'};
  if(!emailDeliveryConfigured())return res.status(503).json({code:'EMAIL_DELIVERY_UNAVAILABLE',error:'Email verification is not configured yet. Please try again later.'});
  try {
    const found=await query('SELECT "id","email","fullName","emailVerified","roles" FROM users WHERE "email"=$1',[email]);const account=found.rows[0];
    if(!account||!account.roles?.includes('ADMIN')||account.emailVerified){console.info('Admin verification email skipped: no matching unverified administrator.');return res.json(generic);}
    const latest=await query('SELECT "createdAt" FROM email_verification_tokens WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 1',[account.id]);
    if(latest.rows[0]&&Date.now()-new Date(latest.rows[0].createdAt).getTime()<60_000){console.info('Admin verification email skipped: resend rate limit.');return res.status(429).json({code:'VERIFICATION_EMAIL_RECENTLY_SENT',error:'A verification email was recently requested. Check your inbox and spam folder, then try again in one minute.'});}
    try { const sent=await issueEmailVerification(account.id,account.email,account.fullName);console.info('Admin verification email accepted by Resend.',{emailId:sent?.id}); }
    catch(error) { console.error('Verification email resend failed:',error instanceof Error?error.message:'unknown email error');return res.status(502).json({code:'EMAIL_DELIVERY_FAILED',error:'The verification email could not be sent. Check the email delivery configuration and try again.'}); }
    return res.json({message:'Verification email sent. Check your inbox and spam folder.'});
  } catch(error) { console.error('Verification email resend failed:',error instanceof Error?error.message:'unknown email error');return res.status(500).json({code:'VERIFICATION_UNAVAILABLE',error:'Could not check or resend the administrator verification email. Please try again.'}); }
});

app.get('/api/auth/verify-email',async (req,res) => {
  try {
    const account=await verifyAdminEmailToken(req.query.token);
    if(!account){const page=verificationResultPage(false);return res.status(page.status).type('html').send(page.html);}
    try { const sent=await sendVerifiedEmail(account.email,account.fullName);console.info('Admin verification confirmation accepted by Resend.',{emailId:sent?.id}); }
    catch(error) { console.error('Verification confirmation email delivery failed:',error instanceof Error?error.message:'unknown email error'); }
    const page=verificationResultPage(true);return res.status(page.status).type('html').send(page.html);
  } catch(error) { console.error('Email verification failed:',error instanceof Error?error.message:'unknown verification error');const page=verificationResultPage(false);return res.status(500).type('html').send(page.html); }
});

app.post('/api/auth/verify-email',async (req,res) => {
  try {
    const account=await verifyAdminEmailToken(req.body?.token);
    if(!account)return res.status(400).json({code:'INVALID_VERIFICATION_LINK',error:'This verification link is invalid, expired, or already used.'});
    try { const sent=await sendVerifiedEmail(account.email,account.fullName);console.info('Admin verification confirmation accepted by Resend.',{emailId:sent?.id}); }
    catch(error) { console.error('Verification confirmation email delivery failed:',error instanceof Error?error.message:'unknown email error'); }
    return res.json({verified:true,email:account.email});
  } catch(error) { console.error('Email verification failed:',error instanceof Error?error.message:'unknown verification error');return res.status(500).json({error:'Could not verify this email address.'}); }
});

app.post('/api/auth/login', async (req,res) => {
  const {email,password}=req.body??{};
  if(!email||!password) return res.status(400).json({error:'Email and password are required.'});
  try {
    const result=await query('SELECT "id","email","fullName","university","roles","passwordHash","status","kycStatus","emailVerified" FROM users WHERE "email"=$1',[String(email).trim().toLowerCase()]);
    const user=result.rows[0]; if(!user||!await bcrypt.compare(String(password),user.passwordHash)) return res.status(401).json({error:'Email or password is incorrect.'});
    if(user.roles.includes('ADMIN')&&!user.emailVerified)return res.status(403).json({code:'EMAIL_NOT_VERIFIED',email:user.email,error:'Verify the administrator email before signing in.'});
    if(user.status!=='ACTIVE')return res.status(401).json({error:'Email or password is incorrect.'});
    const safe=userView(user); return res.json({token:signToken(user.id,safe.role),user:safe});
  } catch(error:any) { console.error('Login failed:',error.message); return res.status(500).json({error:'Could not sign in.'}); }
});

app.get('/api/auth/me',requireAuth,async (req:AuthRequest,res) => {
  try { const result=await query('SELECT "id","email","fullName","university","roles","kycStatus","status" FROM users WHERE "id"=$1',[req.auth!.userId]);if(!result.rows[0]||result.rows[0].status!=='ACTIVE')return res.status(403).json({error:'This account is not active.'});return res.json(userView(result.rows[0])); }
  catch(error:any) { console.error('Account status check failed:',error.message);return res.status(500).json({error:'Could not check account status.'}); }
});

app.post('/api/kyc',requireAuth,async (req:AuthRequest,res) => {
  const idNumber=String(req.body?.student_id_number??'').trim();const photo=String(req.body?.id_photo_data??'').trim();const note=String(req.body?.note??'').trim().slice(0,500);
  if(idNumber.length<3||idNumber.length>120)return res.status(400).json({error:'Enter a valid student ID number.'});
  if(photo.length>180000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(photo))return res.status(400).json({error:'Upload a valid JPG, PNG or WebP photo of your student ID.'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');const account=await client.query('SELECT "kycStatus" FROM users WHERE "id"=$1 FOR UPDATE',[req.auth!.userId]);
    if(!account.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Account not found.'});}
    if(account.rows[0].kycStatus==='APPROVED'){await client.query('ROLLBACK');return res.status(409).json({error:'Student verification is already approved.'});}
    const pending=await client.query('SELECT "id" FROM kyc_submissions WHERE "userId"=$1 AND "status"=\'PENDING\' ORDER BY "createdAt" DESC LIMIT 1',[req.auth!.userId]);
    if(pending.rows[0]) await client.query('UPDATE kyc_submissions SET "idNumber"=$2,"idPhotoUrl"=$3,"note"=$4,"updatedAt"=now() WHERE "id"=$1',[pending.rows[0].id,idNumber,photo,note]);
    else await client.query('INSERT INTO kyc_submissions ("id","userId","idNumber","idPhotoUrl","status","note","updatedAt") VALUES ($1,$2,$3,$4,\'PENDING\',$5,now())',[randomUUID(),req.auth!.userId,idNumber,photo,note]);
    await client.query('UPDATE users SET "kycStatus"=\'PENDING\',"updatedAt"=now() WHERE "id"=$1',[req.auth!.userId]);await audit(client,req.auth!.userId,'kyc_submitted','user',req.auth!.userId);await client.query('COMMIT');await notifyAdminsOfKycSubmission(req.auth!.userId);return res.status(202).json({status:'pending'});
  } catch(error:any) { await client.query('ROLLBACK');console.error('KYC submission failed:',error.message);return res.status(500).json({error:'Could not submit your student verification.'}); }
  finally { client.release(); }
});

app.get('/api/categories', async (req,res) => {
  try {
    const type=req.query.type;
    const sql='SELECT "id","name","slug",lower("type"::text) AS category_type,"parentId" AS parent_id FROM categories WHERE "active"=true';
    const result=type==='physical'||type==='service'?await query(`${sql} AND "type"=$1::"ListingType" ORDER BY "sortOrder","name"`,[String(type).toUpperCase()]):await query(`${sql} ORDER BY "type","sortOrder","name"`);
    return res.json(result.rows);
  } catch(error:any) { console.error('Categories failed:',error.message); return res.status(500).json({error:'Could not load categories.'}); }
});

app.get('/api/admin/categories',requireAuth,requireAdmin,async (_req,res) => {
  try { const result=await query('SELECT "id","name","slug",lower("type"::text) AS category_type,"parentId" AS parent_id,"active" AS is_active,"sortOrder" AS sort_order FROM categories ORDER BY "type","sortOrder","name"'); return res.json(result.rows); }
  catch(error:any) { console.error('Admin categories failed:',error.message); return res.status(500).json({error:'Could not load categories.'}); }
});

app.get('/api/admin/users',requireAuth,requireAdmin,async (_req,res) => {
  try {
    const result=await query(`SELECT u."id",u."fullName" AS full_name,u."email",u."phone",u."university" AS campus,lower(u."status"::text) AS status,lower(u."kycStatus"::text) AS kyc_status,ARRAY(SELECT lower(item.role::text) FROM unnest(u."roles") AS item(role)) AS roles,u."createdAt" AS created_at,(SELECT count(*)::int FROM listings l WHERE l."sellerId"=u."id") AS listing_count FROM users u ORDER BY u."createdAt" DESC LIMIT 500`);
    return res.json(result.rows);
  } catch(error:any) { console.error('Admin users failed:',error.message);return res.status(500).json({error:'Could not load user accounts.'}); }
});

app.get('/api/admin/users/:id/print-record',requireAuth,requireAdmin,async (req:AuthRequest,res) => {
  const client=await pool.connect();
  try {
    const result=await client.query(`SELECT u."id",u."fullName" AS full_name,u."email",u."phone",u."university" AS campus,
      lower(u."status"::text) AS status,lower(u."kycStatus"::text) AS kyc_status,
      ARRAY(SELECT lower(item.role::text) FROM unnest(u."roles") AS item(role)) AS roles,u."createdAt" AS created_at,
      k."idNumber" AS student_id_number,k."idPhotoUrl" AS id_photo_url,k."note" AS verification_note,
      lower(k."status"::text) AS verification_status,k."createdAt" AS verification_submitted_at,k."updatedAt" AS verification_updated_at
      FROM users u LEFT JOIN LATERAL (SELECT * FROM kyc_submissions WHERE "userId"=u."id" ORDER BY "createdAt" DESC LIMIT 1) k ON true
      WHERE u."id"=$1`,[String(req.params.id)]);
    if(!result.rows[0])return res.status(404).json({error:'User account not found.'});
    await audit(client,req.auth!.userId,'user_record_printed','user',String(req.params.id));
    return res.json(result.rows[0]);
  } catch(error:any) { console.error('Admin user print record failed:',error.message);return res.status(500).json({error:'Could not load the user record.'}); }
  finally { client.release(); }
});

app.patch('/api/admin/users/:id',requireAuth,requireAdmin,async (req:AuthRequest,res) => {
  const requested=String(req.body?.status??'').toLowerCase();
  const statuses:Record<string,string>={active:'ACTIVE',suspended:'SUSPENDED',banned:'BANNED'};
  if(!statuses[requested])return res.status(400).json({error:'Choose active, suspended, or banned.'});
  if(String(req.params.id)===req.auth!.userId)return res.status(409).json({error:'You cannot change your own account status.'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const found=await client.query('SELECT "id","roles","status" FROM users WHERE "id"=$1 FOR UPDATE',[String(req.params.id)]);
    const target=found.rows[0];if(!target){await client.query('ROLLBACK');return res.status(404).json({error:'User account not found.'});}
    if(target.roles.includes('ADMIN')&&requested!=='active'){
      const count=await client.query('SELECT count(*)::int AS count FROM users WHERE "status"=\'ACTIVE\' AND "roles" @> ARRAY[\'ADMIN\'::"Role"]');
      if(count.rows[0].count<=1){await client.query('ROLLBACK');return res.status(409).json({error:'The last active administrator cannot be paused or banned.'});}
    }
    await client.query('UPDATE users SET "status"=$2::"UserStatus","updatedAt"=now() WHERE "id"=$1',[target.id,statuses[requested]]);
    if(requested==='suspended')await client.query('UPDATE listings SET "status"=CASE WHEN "status" IN (\'ACTIVE\',\'PENDING_REVIEW\') THEN \'PAUSED\'::"ListingStatus" ELSE "status" END,"updatedAt"=now() WHERE "sellerId"=$1',[target.id]);
    if(requested==='banned')await client.query('UPDATE listings SET "status"=\'REMOVED\',"images"=ARRAY[]::text[],"updatedAt"=now() WHERE "sellerId"=$1',[target.id]);
    await audit(client,req.auth!.userId,`user_${requested}`,'user',target.id);
    await client.query('COMMIT');return res.json({id:target.id,status:requested});
  } catch(error:any) { await client.query('ROLLBACK');console.error('Admin user status change failed:',error.message);return res.status(500).json({error:'Could not change user status.'}); }
  finally { client.release(); }
});

app.delete('/api/admin/users/:id',requireAuth,requireAdmin,async (req:AuthRequest,res) => {
  const id=String(req.params.id);if(id===req.auth!.userId)return res.status(409).json({error:'You cannot delete your own administrator account.'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const found=await client.query('SELECT "id","roles" FROM users WHERE "id"=$1 FOR UPDATE',[id]);
    const target=found.rows[0];if(!target){await client.query('ROLLBACK');return res.status(404).json({error:'User account not found.'});}
    if(target.roles.includes('ADMIN')){await client.query('ROLLBACK');return res.status(409).json({error:'Administrator accounts cannot be deleted from this portal.'});}
    await client.query('DELETE FROM kyc_submissions WHERE "userId"=$1',[id]);
    await client.query('UPDATE listings SET "status"=\'REMOVED\',"images"=ARRAY[]::text[],"updatedAt"=now() WHERE "sellerId"=$1',[id]);
    await client.query(`UPDATE users SET "fullName"='Deleted account',"email"=$2,"phone"='',"university"='',"passwordHash"=$3,"roles"=ARRAY['CUSTOMER'::"Role"],"kycStatus"='NOT_SUBMITTED',"status"='BANNED',"updatedAt"=now() WHERE "id"=$1`,[id,`deleted+${id}@deleted.invalid`,randomUUID()]);
    await audit(client,req.auth!.userId,'user_deleted_anonymized','user',id,'Account access revoked and personal fields anonymized; order and audit records retained.');
    await client.query('COMMIT');return res.json({id,deleted:true});
  } catch(error:any) { await client.query('ROLLBACK');console.error('Admin user deletion failed:',error.message);return res.status(500).json({error:'Could not delete user account.'}); }
  finally { client.release(); }
});

app.get('/api/admin/listings',requireAuth,requireAdmin,async (_req,res) => {
  try {
    const result=await query(`SELECT l."id",l."title",l."description",l."price"::text,l."images",l."stock",lower(l."type"::text) AS listing_type,lower(l."status"::text) AS status,l."createdAt" AS created_at,c."name" AS category_name,u."id" AS seller_id,u."fullName" AS seller_name,u."email" AS seller_email,u."university" AS campus,lower(u."kycStatus"::text) AS kyc_status FROM listings l JOIN categories c ON c."id"=l."categoryId" JOIN users u ON u."id"=l."sellerId" ORDER BY CASE l."status"::text WHEN 'PENDING_REVIEW' THEN 0 WHEN 'ACTIVE' THEN 1 ELSE 2 END,l."createdAt" DESC LIMIT 500`);
    return res.json(result.rows);
  } catch(error:any) { console.error('Admin listings failed:',error.message);return res.status(500).json({error:'Could not load listing moderation.'}); }
});

app.patch('/api/admin/listings/:id',requireAuth,requireAdmin,async (req:AuthRequest,res) => {
  const status=String(req.body?.status??'').toLowerCase();
  const statuses:Record<string,string>={pending_review:'PENDING_REVIEW',active:'ACTIVE',paused:'PAUSED',removed:'REMOVED'};
  if(!statuses[status])return res.status(400).json({error:'Choose pending review, active, paused, or removed.'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const found=await client.query('SELECT l."id",l."sellerId",l."type",l."stock",u."status" AS seller_status,u."kycStatus",u."roles" AS seller_roles FROM listings l JOIN users u ON u."id"=l."sellerId" WHERE l."id"=$1 FOR UPDATE OF l',[String(req.params.id)]);
    const listing=found.rows[0];if(!listing){await client.query('ROLLBACK');return res.status(404).json({error:'Listing not found.'});}
    if(status==='active'&&(listing.seller_status!=='ACTIVE'||listing.kycStatus!=='APPROVED'||!listing.seller_roles.includes('SELLER'))){await client.query('ROLLBACK');return res.status(409).json({error:'Only an active, verified seller can have a listing approved.'});}
    if(status==='active'&&listing.type==='PHYSICAL'&&Number(listing.stock)<=0){await client.query('ROLLBACK');return res.status(409).json({error:'A physical item needs available stock before it can be approved.'});}
    await client.query('UPDATE listings SET "status"=$2::"ListingStatus","updatedAt"=now() WHERE "id"=$1',[listing.id,statuses[status]]);
    await audit(client,req.auth!.userId,`listing_${status}`,'listing',listing.id,String(req.body?.reason??'').trim().slice(0,500));
    await client.query('COMMIT');return res.json({id:listing.id,status});
  } catch(error:any) { await client.query('ROLLBACK');console.error('Admin listing moderation failed:',error.message);return res.status(500).json({error:'Could not update listing moderation.'}); }
  finally { client.release(); }
});

app.delete('/api/admin/listings/:id',requireAuth,requireAdmin,async (req:AuthRequest,res) => {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const result=await client.query('UPDATE listings SET "status"=\'REMOVED\',"images"=ARRAY[]::text[],"updatedAt"=now() WHERE "id"=$1 RETURNING "id"',[String(req.params.id)]);
    if(!result.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Listing not found.'});}
    await audit(client,req.auth!.userId,'listing_removed','listing',String(req.params.id),String(req.body?.reason??'').trim().slice(0,500));
    await client.query('COMMIT');return res.json({id:String(req.params.id),status:'removed'});
  } catch(error:any) { await client.query('ROLLBACK');console.error('Admin listing removal failed:',error.message);return res.status(500).json({error:'Could not remove listing.'}); }
  finally { client.release(); }
});

app.get('/api/listings',async (req,res) => {
  const type=req.query.type; if(type&&!['physical','service'].includes(String(type))) return res.status(400).json({error:'Invalid listing type.'});
  const values:unknown[]=[`%${String(req.query.search??'').trim().slice(0,100)}%`]; let typeSql='';
  if(type){values.push(String(type).toUpperCase());typeSql=` AND l."type"=$${values.length}::"ListingType"`;}
  try {
    const result=await query(`SELECT l."id",l."title",l."description",l."price"::text,l."stock",lower(l."type"::text) AS listing_type,l."condition"::text AS condition,l."images",l."createdAt" AS created_at,c."name" AS category_name,u."fullName" AS seller_name,u."university" AS campus FROM listings l JOIN categories c ON c."id"=l."categoryId" JOIN users u ON u."id"=l."sellerId" WHERE l."status"='ACTIVE' AND (l."type"='SERVICE' OR COALESCE(l."stock",0)>0) AND c."active"=true AND (l."title" ILIKE $1 OR l."description" ILIKE $1 OR c."name" ILIKE $1 OR COALESCE(u."university",'') ILIKE $1)${typeSql} ORDER BY l."createdAt" DESC LIMIT 30`,values);
    return res.json(result.rows);
  } catch(error:any) { console.error('Listings failed:',error.message); return res.status(500).json({error:'Could not load listings.'}); }
});

app.post('/api/listings',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  const {title,description,category_id,listing_type,price,condition,stock}=req.body??{};
  if(typeof title!=='string'||!title.trim()) return res.status(400).json({error:'Enter a title for the listing.'});
  if(typeof description!=='string'||!description.trim()) return res.status(400).json({error:'Enter listing details.'});
  if(typeof category_id!=='string'||!category_id.trim()) return res.status(400).json({error:'Choose a category.'});
  if(!['physical','service'].includes(listing_type)) return res.status(400).json({error:'Choose whether this listing is a physical item or a service.'});
  if(!Number.isFinite(Number(price))||Number(price)<=0) return res.status(400).json({error:'Enter a price greater than zero.'});
  const kind=String(listing_type).toUpperCase(); const conditionValue=kind==='PHYSICAL'&&condition?String(condition).toUpperCase():null;
  if(conditionValue&&!['NEW','LIKE_NEW','GOOD','FAIR'].includes(conditionValue)) return res.status(400).json({error:'Choose a valid physical item condition.'});
  try {
    const seller=await query('SELECT "roles" FROM users WHERE "id"=$1',[req.auth!.userId]);
    if(!seller.rows[0]?.roles?.includes('SELLER')) return res.status(403).json({error:'Create a seller account to publish listings.'});
    const category=await query('SELECT "id" FROM categories WHERE "id"=$1 AND "type"=$2::"ListingType" AND "active"=true',[category_id,kind]);
    if(!category.rows[0]) return res.status(400).json({error:'Choose a category that matches the listing type.'});
    const submittedImages=req.body?.image_urls??(req.body?.image_url?[req.body.image_url]:[]);if(!Array.isArray(submittedImages)||submittedImages.length>5)return res.status(400).json({error:'A listing can have up to 5 images.'});
    const imageUrls:string[]=[];for(const value of submittedImages){if(typeof value!=='string')return res.status(400).json({error:'Each listing image must be a valid image URL or upload.'});const imageUrl=value.trim();const isHostedImage=/^https:\/\//i.test(imageUrl);const isUploadedImage=imageUrl.length<=72000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/i.test(imageUrl);if(!isHostedImage&&!isUploadedImage)return res.status(400).json({error:'Use https image URLs or upload JPG, PNG or WebP images smaller than 700 KB each.'});imageUrls.push(imageUrl);}
    const result=await query('INSERT INTO listings ("id","sellerId","type","categoryId","title","description","price","stock","condition","images","status","updatedAt") VALUES ($1,$2,$3::"ListingType",$4,$5,$6,$7,$8,$9::"ItemCondition",$10,\'PENDING_REVIEW\',now()) RETURNING "id","title","description","price"::text,lower("type"::text) AS listing_type,"condition"::text AS condition,"images",lower("status"::text) AS status,"createdAt" AS created_at',[randomUUID(),req.auth!.userId,kind,category_id,String(title).trim(),String(description).trim(),Number(price),kind==='PHYSICAL'?Math.max(1,Number(stock)||1):null,conditionValue,imageUrls]);
    return res.status(201).json(result.rows[0]);
  } catch(error:any) { console.error('Create listing failed:',error.message); return res.status(500).json({error:'Could not publish listing.'}); }
});

app.patch('/api/listings/:id',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  const {title,description,price,stock,status}=req.body??{}; const statuses:any={paused:'PAUSED',removed:'SOLD_OUT'};
  if(status&&!statuses[status]) return res.status(400).json({error:'Invalid listing status.'});
  if(price!==undefined&&(!Number.isFinite(Number(price))||Number(price)<=0))return res.status(400).json({error:'Enter a valid price greater than zero.'});
  if(stock!==undefined&&(!Number.isInteger(Number(stock))||Number(stock)<0))return res.status(400).json({error:'Enter a valid stock quantity.'});
  try {
    const contentChanged=title!==undefined||description!==undefined||price!==undefined||stock!==undefined;
    const result=await query('UPDATE listings SET "title"=COALESCE($3,"title"),"description"=COALESCE($4,"description"),"price"=COALESCE($5,"price"),"stock"=COALESCE($6,"stock"),"status"=CASE WHEN COALESCE($6,"stock")=0 AND "type"=\'PHYSICAL\' THEN \'SOLD_OUT\'::"ListingStatus" WHEN $8 THEN \'PENDING_REVIEW\'::"ListingStatus" WHEN $7::"ListingStatus"=\'PAUSED\' AND "status"=\'ACTIVE\' THEN \'PAUSED\'::"ListingStatus" WHEN $7::"ListingStatus"=\'SOLD_OUT\' THEN \'SOLD_OUT\'::"ListingStatus" ELSE "status" END,"updatedAt"=now() WHERE "id"=$1 AND "sellerId"=$2 RETURNING "id","title","description","price"::text,"stock",lower("status"::text) AS status',[String(req.params.id),req.auth!.userId,title?.trim()||null,description?.trim()||null,price==null?null:Number(price),stock==null?null:Math.max(0,Number(stock)),status?statuses[status]:null,contentChanged]);
    if(!result.rows[0]) return res.status(404).json({error:'Listing not found.'}); return res.json(result.rows[0]);
  } catch(error:any) { console.error('Update listing failed:',error.message); return res.status(500).json({error:'Could not update listing.'}); }
});

app.delete('/api/listings/:id',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  try { const result=await query('UPDATE listings SET "status"=\'SOLD_OUT\',"updatedAt"=now() WHERE "id"=$1 AND "sellerId"=$2 RETURNING "id"',[String(req.params.id),req.auth!.userId]); if(!result.rows[0])return res.status(404).json({error:'Listing not found.'}); return res.status(204).end(); }
  catch(error:any) { console.error('Remove listing failed:',error.message); return res.status(500).json({error:'Could not remove listing.'}); }
});

app.post('/api/seller/kyc',requireAuth,async (req:AuthRequest,res) => {
  const studentId=String(req.body?.student_id_number??'').trim();const idPhoto=String(req.body?.id_photo_url??'').trim();if(studentId.length<3||studentId.length>120)return res.status(400).json({error:'Enter a valid student ID number.'});if(idPhoto.length>180000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(idPhoto))return res.status(400).json({error:'Upload a clear photo of your student ID.'});
  try {
    const exists=await query('SELECT "roles","kycStatus" FROM users WHERE "id"=$1',[req.auth!.userId]); if(!exists.rows[0]?.roles?.includes('SELLER'))return res.status(403).json({error:'Create a seller account before submitting verification.'});if(exists.rows[0].kycStatus==='APPROVED')return res.status(409).json({error:'Student verification is already approved.'});
    const result=await query('INSERT INTO kyc_submissions ("id","userId","idNumber","idPhotoUrl","status","note","updatedAt") VALUES ($1,$2,$3,$4,\'PENDING\',$5,now()) RETURNING "id","status","createdAt" AS created_at',[randomUUID(),req.auth!.userId,studentId,idPhoto,String(req.body?.note??'').slice(0,500)]);
    await query('UPDATE users SET "kycStatus"=\'PENDING\',"updatedAt"=now() WHERE "id"=$1',[req.auth!.userId]);await notifyAdminsOfKycSubmission(req.auth!.userId); return res.status(201).json(result.rows[0]);
  } catch(error:any) { console.error('KYC submit failed:',error.message); return res.status(500).json({error:'Could not submit verification.'}); }
});

app.post('/api/seller/activate',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  try {
    const result=await query('UPDATE users SET "roles"=CASE WHEN "roles" @> ARRAY[\'SELLER\'::"Role"] THEN "roles" ELSE array_append("roles",\'SELLER\'::"Role") END,"updatedAt"=now() WHERE "id"=$1 RETURNING "id","email","fullName","university","roles"',[req.auth!.userId]);
    if(!result.rows[0])return res.status(404).json({error:'Account not found.'});const user=userView(result.rows[0]);return res.json({token:signToken(user.id,user.role),user});
  } catch(error:any) { console.error('Seller activation failed:',error.message);return res.status(500).json({error:'Could not activate your seller account.'}); }
});

app.get('/api/seller/listings',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  try {
    const seller=await query('SELECT "kycStatus" FROM users WHERE "id"=$1 AND "roles" @> ARRAY[\'SELLER\'::"Role"]',[req.auth!.userId]);
    if(!seller.rows[0])return res.status(403).json({error:'Create a seller account to manage listings.'});
    const listings=await query('SELECT l."id",l."title",l."description",l."price"::text,l."stock",lower(l."status"::text) AS status,lower(l."type"::text) AS listing_type,l."condition"::text AS condition,l."createdAt" AS created_at,c."name" AS category_name FROM listings l JOIN categories c ON c."id"=l."categoryId" WHERE l."sellerId"=$1 ORDER BY l."createdAt" DESC',[req.auth!.userId]);
    return res.json({seller:{kyc_status:String(seller.rows[0].kycStatus).toLowerCase()},listings:listings.rows});
  } catch(error:any) { console.error('Seller listings failed:',error.message); return res.status(500).json({error:'Could not load seller listings.'}); }
});

app.get('/api/orders',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  try {
    const result=await query(`SELECT o."id",o."buyerId" AS buyer_id,o."sellerId" AS seller_id,o."paymentMethod"::text AS payment_method,o."momoReferenceId" AS momo_reference_id,o."deliveredAt" AS delivered_at,lower(o."escrowStatus"::text) AS escrow_status,CASE WHEN EXISTS(SELECT 1 FROM audit_logs a WHERE a."targetType"='order' AND a."targetId"=o."id" AND a."action"='buyer_cancelled_order') THEN 'cancelled' WHEN EXISTS(SELECT 1 FROM audit_logs a WHERE a."targetType"='order' AND a."targetId"=o."id" AND a."action"='buyer_receipt_confirmed') THEN 'completed' ELSE CASE o."escrowStatus"::text WHEN 'PENDING_PAYMENT' THEN 'pending_payment' WHEN 'HELD' THEN 'paid' WHEN 'WITHHELD_BY_ADMIN' THEN 'paid' WHEN 'DISPUTED' THEN 'disputed' WHEN 'RELEASED' THEN 'completed' WHEN 'COMPLETED' THEN 'completed' WHEN 'REFUNDED' THEN 'refunded' WHEN 'SPLIT' THEN 'split' ELSE 'cancelled' END END AS status,EXISTS(SELECT 1 FROM audit_logs a WHERE a."targetType"='order' AND a."targetId"=o."id" AND a."actorId"=o."buyerId" AND a."action"='hand_to_hand_confirmed') AS buyer_handoff_confirmed,EXISTS(SELECT 1 FROM audit_logs a WHERE a."targetType"='order' AND a."targetId"=o."id" AND a."actorId"=o."sellerId" AND a."action"='hand_to_hand_confirmed') AS seller_handoff_confirmed,o."total"::text AS total_amount,'SZL' AS currency,o."createdAt" AS created_at,b."fullName" AS buyer_name,s."fullName" AS seller_name,CASE WHEN o."escrowStatus" IN ('HELD','WITHHELD_BY_ADMIN','DISPUTED') THEN o."total"::text ELSE '0' END AS held_amount,l."title" AS item_titles FROM orders o JOIN users b ON b."id"=o."buyerId" JOIN users s ON s."id"=o."sellerId" JOIN listings l ON l."id"=o."listingId" WHERE o."buyerId"=$1 OR o."sellerId"=$1 ORDER BY o."createdAt" DESC LIMIT 50`,[req.auth!.userId]);
    return res.json(result.rows);
  } catch(error:any) { console.error('Orders failed:',error.message); return res.status(500).json({error:'Could not load orders.'}); }
});

app.post('/api/orders',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  const {listing_id,quantity=1,payment_method='HAND_TO_HAND'}=req.body??{}; const count=typeof quantity==='number'?quantity:typeof quantity==='string'&&quantity.trim()?Number(quantity):Number.NaN;
  if(!Number.isInteger(count)||count<1||count>50)return res.status(400).json({error:'Quantity must be a whole number between 1 and 50.'});
  const method=String(payment_method).toUpperCase(); if(method!=='HAND_TO_HAND')return res.status(400).json({error:'Card and MTN MoMo payments are coming soon. Choose hand-to-hand payment for now.'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const found=await client.query('SELECT l."id",l."sellerId",l."price",l."stock",l."status",l."type",s."roles" FROM listings l JOIN users s ON s."id"=l."sellerId" WHERE l."id"=$1 FOR UPDATE OF l',[listing_id]);
    const listing=found.rows[0];
    if(!listing||listing.status!=='ACTIVE'||listing.sellerId===req.auth!.userId||(listing.stock!==null&&listing.stock<count)){await client.query('ROLLBACK');return res.status(400).json({error:'This listing is unavailable or does not have enough stock.'});}
    if(listing.stock!==null){
      const reserved=await client.query(`SELECT COALESCE(SUM(o."quantity"),0)::int AS count FROM orders o WHERE o."listingId"=$1 AND o."escrowStatus"='PENDING_PAYMENT' AND EXISTS (SELECT 1 FROM audit_logs a WHERE a."targetType"='order' AND a."targetId"=o."id" AND a."action"='order_inventory_reserved') AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a."targetType"='order' AND a."targetId"=o."id" AND a."action"='buyer_cancelled_order')`,[listing.id]);
      if(Number(listing.stock)-Number(reserved.rows[0].count)<count){await client.query('ROLLBACK');return res.status(409).json({error:'All available stock is currently reserved by pending checkouts.'});}
    }
    const total=Number(listing.price)*count;const commission='0.00';const id=randomUUID();
    const order=await client.query('INSERT INTO orders ("id","listingId","buyerId","sellerId","quantity","unitPrice","total","commission","paymentMethod","escrowStatus","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::"PaymentMethod",\'PENDING_PAYMENT\',now()) RETURNING "id",lower("escrowStatus"::text) AS status,"total"::text AS total_amount',[id,listing.id,req.auth!.userId,listing.sellerId,count,listing.price,total,commission,method]);
    await audit(client,req.auth!.userId,'order_inventory_reserved','order',id,'Stock is reserved until provider payment or both hand-to-hand confirmations complete.');
    await client.query('COMMIT'); return res.status(201).json({order:{...order.rows[0],currency:'SZL'},payment:{status:'hand_to_hand',message:'Arrange payment and exchange directly with the seller. Both parties must confirm the hand-to-hand exchange in My orders.'}});
  } catch(error:any) { await client.query('ROLLBACK'); console.error('Order create failed:',error.message); return res.status(500).json({error:'Could not create order.'}); }
  finally { client.release(); }
});

app.post('/api/orders/:id/confirm-handoff',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const found=await client.query(`SELECT o."id",o."buyerId",o."sellerId",o."listingId",o."quantity",o."paymentMethod",o."escrowStatus",l."stock"
      FROM orders o JOIN listings l ON l."id"=o."listingId" WHERE o."id"=$1 FOR UPDATE OF o,l`,[String(req.params.id)]);
    const order=found.rows[0];
    if(!order||order.paymentMethod!=='HAND_TO_HAND'||order.escrowStatus!=='PENDING_PAYMENT') {await client.query('ROLLBACK');return res.status(404).json({error:'Hand-to-hand order not found or already completed.'});}
    if(order.buyerId!==req.auth!.userId&&order.sellerId!==req.auth!.userId) {await client.query('ROLLBACK');return res.status(403).json({error:'Only the buyer or seller can confirm this exchange.'});}
    const cancelled=await client.query(`SELECT 1 FROM audit_logs WHERE "targetType"='order' AND "targetId"=$1 AND "action"='buyer_cancelled_order' LIMIT 1`,[order.id]);
    if(cancelled.rows[0]) {await client.query('ROLLBACK');return res.status(409).json({error:'This order was cancelled.'});}
    const prior=await client.query(`SELECT 1 FROM audit_logs WHERE "targetType"='order' AND "targetId"=$1 AND "actorId"=$2 AND "action"='hand_to_hand_confirmed' LIMIT 1`,[order.id,req.auth!.userId]);
    if(!prior.rows[0])await audit(client,req.auth!.userId,'hand_to_hand_confirmed','order',order.id);
    const confirmations=await client.query(`SELECT count(DISTINCT "actorId")::int AS count FROM audit_logs
      WHERE "targetType"='order' AND "targetId"=$1 AND "action"='hand_to_hand_confirmed' AND "actorId"=ANY($2::text[])`,[order.id,[order.buyerId,order.sellerId]]);
    const complete=Number(confirmations.rows[0].count)===2;
    if(complete) {
      if(order.stock!==null) {
        const remaining=Number(order.stock)-Number(order.quantity);
        if(remaining<0){await client.query('ROLLBACK');return res.status(409).json({error:'The listing no longer has enough stock to complete this exchange.'});}
        await client.query(`UPDATE listings SET "stock"=$2,"status"=CASE WHEN $2=0 THEN 'SOLD_OUT'::"ListingStatus" ELSE "status" END,"updatedAt"=now() WHERE "id"=$1`,[order.listingId,remaining]);
      }
      await client.query(`UPDATE orders SET "escrowStatus"='COMPLETED',"updatedAt"=now() WHERE "id"=$1`,[order.id]);
      await audit(client,req.auth!.userId,'hand_to_hand_order_completed','order',order.id);
    }
    await client.query('COMMIT');
    return res.json({id:order.id,status:complete?'completed':'awaiting_other_party',confirmed_by_current_user:true});
  } catch(error:any) {await client.query('ROLLBACK');console.error('Hand-to-hand confirmation failed:',error.message);return res.status(500).json({error:'Could not confirm this hand-to-hand exchange.'});}
  finally {client.release();}
});

app.post('/api/orders/:id/cancel',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const result=await client.query('SELECT o."id",o."listingId",o."quantity",o."escrowStatus",l."stock",l."status" AS listing_status FROM orders o JOIN listings l ON l."id"=o."listingId" WHERE o."id"=$1 AND o."buyerId"=$2 FOR UPDATE OF o,l',[String(req.params.id),req.auth!.userId]);
    const order=result.rows[0];
    if(!order||order.escrowStatus!=='PENDING_PAYMENT'){await client.query('ROLLBACK');return res.status(404).json({error:'Only an unpaid order can be cancelled.'});}
    const handoffConfirmation=await client.query(`SELECT 1 FROM audit_logs WHERE "targetType"='order' AND "targetId"=$1 AND "action"='hand_to_hand_confirmed' LIMIT 1`,[order.id]);
    if(handoffConfirmation.rows[0]){await client.query('ROLLBACK');return res.status(409).json({error:'This order cannot be cancelled after either party confirms the hand-to-hand exchange.'});}
    const cancelled=await client.query('SELECT 1 FROM audit_logs WHERE "targetType"=\'order\' AND "targetId"=$1 AND "action"=\'buyer_cancelled_order\'',[order.id]);
    if(cancelled.rows[0]){await client.query('ROLLBACK');return res.status(409).json({error:'This order has already been cancelled.'});}
    const hasNewReservation=await client.query('SELECT 1 FROM audit_logs WHERE "targetType"=\'order\' AND "targetId"=$1 AND "action"=\'order_inventory_reserved\' LIMIT 1',[order.id]);
    // Older checkouts deducted stock at order creation. Restore those when cancelled;
    // current checkouts only reserve stock and need no inventory write here.
    if(order.stock!==null&&!hasNewReservation.rows[0]) await client.query('UPDATE listings SET "stock"="stock"+$2,"status"=CASE WHEN "status"=\'SOLD_OUT\' THEN \'ACTIVE\'::"ListingStatus" ELSE "status" END,"updatedAt"=now() WHERE "id"=$1',[order.listingId,order.quantity]);
    await audit(client,req.auth!.userId,'buyer_cancelled_order','order',order.id,'Unpaid order cancelled; reserved listing stock restored.');
    await client.query('COMMIT');return res.json({id:order.id,status:'cancelled'});
  } catch(error:any) { await client.query('ROLLBACK');console.error('Order cancellation failed:',error.message);return res.status(500).json({error:'Could not cancel the order.'}); }
  finally { client.release(); }
});

app.post('/api/orders/:id/confirm',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const order=await client.query('SELECT o."id",o."buyerId",o."sellerId",o."total",o."commission",o."paymentMethod",o."escrowStatus",s."phone" AS "sellerPhone" FROM orders o JOIN users s ON s."id"=o."sellerId" WHERE o."id"=$1 FOR UPDATE OF o',[String(req.params.id)]);
    if(!order.rows[0]||order.rows[0].buyerId!==req.auth!.userId||order.rows[0].escrowStatus!=='HELD'){await client.query('ROLLBACK');return res.status(404).json({error:'Order not found or not ready for receipt confirmation.'});}
    await audit(client,req.auth!.userId,'buyer_receipt_confirmed','order',String(req.params.id));
    const payout=await releaseOrderToPayout(client,order.rows[0],req.auth!.userId,'buyer_confirmed_receipt');
    await client.query('COMMIT');await dispatchMomoPayout(payout);return res.json({id:String(req.params.id),status:'completed',escrow:'released',payout_status:'pending'});
  } catch(error:any) { await client.query('ROLLBACK'); console.error('Receipt confirmation failed:',error.message); return res.status(500).json({error:'Could not confirm receipt.'}); }
  finally { client.release(); }
});

app.post('/api/orders/:id/delivered',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  try {
    const result=await query(`UPDATE orders o SET "deliveredAt"=COALESCE(o."deliveredAt",now()),"updatedAt"=now()
      WHERE o."id"=$1 AND o."sellerId"=$2 AND o."escrowStatus"='HELD'
      AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d."orderId"=o."id" AND d."status"='OPEN')
      RETURNING o."id",o."deliveredAt" AS delivered_at`,[String(req.params.id),req.auth!.userId]);
    if(!result.rows[0])return res.status(404).json({error:'Order not found, not awaiting delivery, or under dispute.'});
    return res.json({id:result.rows[0].id,delivered_at:result.rows[0].delivered_at,auto_release_after_hours:72});
  } catch(error:any) {console.error('Order delivery update failed:',error.message);return res.status(500).json({error:'Could not mark the order delivered.'});}
});

app.get('/api/cron/escrow-auto-release',async (req,res) => {
  const secret=process.env.CRON_SECRET;
  const neonSecret=process.env.NEON_TRIGGER_SECRET;
  const authorized=(!!secret&&req.header('authorization')===`Bearer ${secret}`)
    || (!!neonSecret&&req.header('x-neon-cron-secret')===neonSecret);
  if(!authorized)return res.status(401).json({error:'Unauthorized.'});
  const client=await pool.connect();const released:any[]=[];
  try {
    await client.query('BEGIN');
    const due=await client.query(`SELECT o."id",o."sellerId",o."total",o."commission",o."paymentMethod",s."phone" AS "sellerPhone"
      FROM orders o JOIN users s ON s."id"=o."sellerId"
      WHERE o."escrowStatus"='HELD' AND o."deliveredAt"<=now()-interval '72 hours'
      AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d."orderId"=o."id" AND d."status"='OPEN')
      LIMIT 50 FOR UPDATE OF o SKIP LOCKED`);
    for(const order of due.rows)released.push(await releaseOrderToPayout(client,order,null,'escrow_auto_released'));
    await client.query('COMMIT');
  } catch(error:any) {await client.query('ROLLBACK');console.error('Escrow auto-release failed:',error.message);return res.status(500).json({error:'Could not auto-release eligible escrow.'});}
  finally {client.release();}
  for(const payout of released)try{await dispatchMomoPayout(payout);}catch(error){console.error('Automatic MoMo payout dispatch failed:',error instanceof Error?error.message:'unknown error');}
  let reconciled=0;
  if(momoConfigured('disbursement')){
    const pending=await query('SELECT "momoReferenceId" FROM payouts WHERE "status"=\'PENDING\' AND "momoReferenceId" IS NOT NULL ORDER BY "createdAt" LIMIT 50');
    const results=await Promise.allSettled(pending.rows.map((row:any)=>syncMomoPayout(row.momoReferenceId)));
    reconciled=results.filter((result)=>result.status==='fulfilled').length;
    results.forEach((result)=>{if(result.status==='rejected')console.error('MTN payout status reconciliation failed:',result.reason instanceof Error?result.reason.message:'unknown provider error');});
  }
  return res.json({released:released.length,payouts_reconciled:reconciled});
});

app.post('/api/orders/:id/dispute',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  const reason=String(req.body?.reason??'').trim(),details=String(req.body?.details??'').trim(); if(!reason||!details)return res.status(400).json({error:'Provide a reason and details for the dispute.'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const order=await client.query('SELECT "id","buyerId","sellerId","escrowStatus" FROM orders WHERE "id"=$1 FOR UPDATE',[String(req.params.id)]); const row=order.rows[0];
    if(!row||!['HELD','WITHHELD_BY_ADMIN'].includes(row.escrowStatus)){await client.query('ROLLBACK');return res.status(404).json({error:'This order cannot be disputed.'});}
    if(row.buyerId!==req.auth!.userId&&row.sellerId!==req.auth!.userId){await client.query('ROLLBACK');return res.status(403).json({error:'Only people in this order can open a dispute.'});}
    const dispute=await client.query('INSERT INTO disputes ("id","orderId","raisedById","reason","details","status","updatedAt") VALUES ($1,$2,$3,$4,$5,\'OPEN\',now()) RETURNING "id","status"',[randomUUID(),row.id,req.auth!.userId,reason.slice(0,180),details.slice(0,4000)]);
    await client.query('UPDATE orders SET "escrowStatus"=\'DISPUTED\',"updatedAt"=now() WHERE "id"=$1',[row.id]); await audit(client,req.auth!.userId,'dispute_opened','order',row.id,reason.slice(0,180)); await client.query('COMMIT');
    return res.status(201).json({id:dispute.rows[0].id,status:'open'});
  } catch(error:any) { await client.query('ROLLBACK'); console.error('Dispute creation failed:',error.message); return res.status(500).json({error:'Could not open dispute.'}); }
  finally { client.release(); }
});

app.post('/api/payments/:provider/start',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  const provider=String(req.params.provider); if(!['dpo','momo'].includes(provider))return res.status(400).json({error:'Choose DPO Pay or MTN MoMo.'});
  if(process.env.ONLINE_PAYMENTS_ENABLED!=='true')return res.status(503).json({error:'Card and MTN MoMo payments are coming soon. Use hand-to-hand payment for now.'});
  try {
    const order=await query('SELECT o."id",o."total",o."paymentMethod",o."escrowStatus",o."momoReferenceId",o."dpoTransactionToken",b."fullName" AS buyer_name,b."email" AS buyer_email,b."phone" AS buyer_phone,l."title" FROM orders o JOIN users b ON b."id"=o."buyerId" JOIN listings l ON l."id"=o."listingId" WHERE o."id"=$1 AND o."buyerId"=$2 AND o."escrowStatus"=\'PENDING_PAYMENT\' AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a."targetType"=\'order\' AND a."targetId"=o."id" AND a."action"=\'buyer_cancelled_order\')',[String(req.body?.order_id??''),req.auth!.userId]);
    if(!order.rows[0])return res.status(404).json({error:'Payment order not found.'});
    const expected=provider==='dpo'?'DPO_PAY':'MTN_MOMO';
    if(order.rows[0].momoReferenceId&&provider!=='momo')return res.status(409).json({error:'An MTN payment request already exists for this order. Complete or cancel it before choosing another method.'});
    if(order.rows[0].dpoTransactionToken&&provider!=='dpo')return res.status(409).json({error:'A DPO checkout already exists for this order. Complete or cancel it before choosing another method.'});
    if(order.rows[0].paymentMethod!==expected) await query('UPDATE orders SET "paymentMethod"=$2::"PaymentMethod","updatedAt"=now() WHERE "id"=$1',[order.rows[0].id,expected]);
    if(provider==='dpo') {
      if(order.rows[0].dpoTransactionToken){const checkoutUrl=new URL('https://secure.3gdirectpay.com//payv2.php');checkoutUrl.searchParams.set('ID',order.rows[0].dpoTransactionToken);return res.json({payment:{id:order.rows[0].id,status:'pending'},checkout:{url:checkoutUrl.toString()}});}
      const created=await createDpoCheckout({orderId:order.rows[0].id,amount:String(order.rows[0].total),currency:'SZL',title:order.rows[0].title,buyerName:order.rows[0].buyer_name,buyerEmail:order.rows[0].buyer_email});
      await query('UPDATE orders SET "dpoTransactionToken"=$2,"dpoCompanyRef"=$3,"updatedAt"=now() WHERE "id"=$1',[order.rows[0].id,created.token,created.companyRef]);
      return res.json({payment:{id:order.rows[0].id,status:'pending'},checkout:{url:created.checkoutUrl}});
    }
    if(!momoConfigured('collection'))return res.status(503).json({error:'MTN MoMo collection is not configured.'});
    if(order.rows[0].momoReferenceId)return res.json({payment:{id:order.rows[0].id,status:'pending',reference_id:order.rows[0].momoReferenceId},checkout:{message:'A MoMo payment request already exists. Approve it on your phone or refresh order status.'}});
    let phone:string;try{phone=normalizeEswatiniMsisdn(req.body?.phone||order.rows[0].buyer_phone);}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Enter a valid Eswatini mobile number.'});}
    const referenceId=randomUUID();
    await query('UPDATE orders SET "paymentMethod"=\'MTN_MOMO\',"momoReferenceId"=$2,"momoPayerMsisdn"=$3,"updatedAt"=now() WHERE "id"=$1',[order.rows[0].id,referenceId,phone]);
    try {await requestMomoPayment({orderId:order.rows[0].id,amount:String(order.rows[0].total),phone,referenceId,callbackUrl:momoCallbackUrl(referenceId)});}
    catch(error){if(error instanceof Error&&/\(HTTP 4\d\d\)/.test(error.message))await query('UPDATE orders SET "momoReferenceId"=NULL,"momoPayerMsisdn"=NULL,"updatedAt"=now() WHERE "id"=$1 AND "momoReferenceId"=$2 AND "escrowStatus"=\'PENDING_PAYMENT\'',[order.rows[0].id,referenceId]);throw error;}
    return res.status(202).json({payment:{id:order.rows[0].id,status:'pending',reference_id:referenceId},checkout:{message:'Payment request sent. Approve it on your MTN MoMo phone, then refresh order status.'}});
  } catch(error:any) { console.error('Payment start failed:',error.message);return res.status(500).json({error:'Could not start payment.'}); }
});

// DPO sends the customer back here with its transaction token. Never trust
// callback query values as proof of payment; confirm them with verifyToken.
app.get('/api/payments/dpo/return',async (req,res) => {
  const token=String(req.query.TransactionToken??'').trim();
  const frontend=process.env.FRONTEND_URL|| (process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:'http://localhost:5173');
  const redirect=(status:string)=>{const url=new URL('/orders',frontend);url.searchParams.set('payment',status);return res.redirect(303,url.toString());};
  if(!token||token.length>100)return redirect('pending');
  try {const status=await settleDpoToken(token,req.query.CompanyRef?String(req.query.CompanyRef):undefined);return redirect(status);}
  catch(error:any) {console.error('DPO return verification failed:',error.message);return redirect('pending');}
});

app.post('/api/payments/dpo/webhook',express.text({type:['application/xml','text/xml','application/*+xml'],limit:'64kb'}),async (req,res) => {
  const xml=typeof req.body==='string'?req.body:'';
  const token=xml.match(/<TransactionToken>([\s\S]*?)<\/TransactionToken>/i)?.[1]?.trim();
  const companyRef=xml.match(/<CompanyRef>([\s\S]*?)<\/CompanyRef>/i)?.[1]?.trim();
  if(!token||token.length>100)return res.status(400).type('application/xml').send('<API3G><Response>ERROR</Response></API3G>');
  try {
    const status=await settleDpoToken(token,companyRef);
    if(!['paid','review'].includes(status))return res.status(503).type('application/xml').send('<API3G><Response>ERROR</Response></API3G>');
    return res.status(200).type('application/xml').send('<API3G><Response>OK</Response></API3G>');
  } catch(error) {console.error('DPO push callback verification failed:',error instanceof Error?error.message:'unknown provider error');return res.status(503).type('application/xml').send('<API3G><Response>ERROR</Response></API3G>');}
});

app.get('/api/payments/momo/status/:orderId',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  try {
    const found=await query('SELECT "id","momoReferenceId","escrowStatus" FROM orders WHERE "id"=$1 AND "buyerId"=$2',[String(req.params.orderId),req.auth!.userId]);
    if(!found.rows[0])return res.status(404).json({error:'Order not found.'});
    if(found.rows[0].escrowStatus!=='PENDING_PAYMENT')return res.json({status:String(found.rows[0].escrowStatus).toLowerCase()});
    if(!found.rows[0].momoReferenceId)return res.json({status:'not_started'});
    return res.json(await syncMomoPayment(found.rows[0].momoReferenceId));
  } catch(error:any) { console.error('MTN MoMo status check failed:',error.message);return res.status(502).json({error:'Could not confirm the MTN MoMo payment yet. Try again shortly.'}); }
});

const momoCallbackHandler=async (req:express.Request,res:express.Response) => {
  const referenceId=String(req.params.referenceId||'');
  if(!/^[0-9a-f-]{36}$/i.test(referenceId))return res.status(400).json({error:'Invalid callback reference.'});
  try { const result=await syncMomoPayment(referenceId);return res.status(200).json({acknowledged:true,status:result.status}); }
  catch(error) { console.error('MTN MoMo callback verification failed:',error instanceof Error?error.message:'unknown provider error');return res.status(503).json({error:'Could not verify the MTN MoMo callback.'}); }
};
app.post('/api/payments/momo/callback/:referenceId',momoCallbackHandler);
app.put('/api/payments/momo/callback/:referenceId',momoCallbackHandler);

const momoPayoutCallbackHandler=async (req:express.Request,res:express.Response) => {
  const referenceId=String(req.params.referenceId||'');
  if(!/^[0-9a-f-]{36}$/i.test(referenceId))return res.status(400).json({error:'Invalid callback reference.'});
  try {const result=await syncMomoPayout(referenceId);return res.status(200).json({acknowledged:true,status:result.status});}
  catch(error) {console.error('MTN MoMo payout callback verification failed:',error instanceof Error?error.message:'unknown provider error');return res.status(503).json({error:'Could not verify the MTN MoMo payout callback.'});}
};
app.post('/api/payments/momo/payout-callback/:referenceId',momoPayoutCallbackHandler);
app.put('/api/payments/momo/payout-callback/:referenceId',momoPayoutCallbackHandler);

// Kept only to reject old callers: payment success is now confirmed from provider APIs.
app.all('/api/payments/:provider/webhook',(_req,res)=>res.status(410).json({error:'This legacy callback is disabled. Use the provider verification flow.'}));

app.get('/api/admin/escrow',requireAuth,requireAdmin,async (_req,res) => {
  try { const result=await query(`SELECT o."id" AS order_id,o."total"::text AS held_amount,lower(o."escrowStatus"::text) AS status,o."withheldReason" AS withheld_reason,o."createdAt" AS created_at FROM orders o WHERE o."escrowStatus" IN ('HELD','WITHHELD_BY_ADMIN','DISPUTED') ORDER BY o."createdAt"`);return res.json(result.rows); }
  catch(error:any) { console.error('Escrow list failed:',error.message);return res.status(500).json({error:'Could not load escrow.'}); }
});

app.get('/api/admin/kyc',requireAuth,requireAdmin,async (_req,res) => {
  try { const result=await query(`SELECT k."id",k."idNumber" AS student_id_number,k."idPhotoUrl" AS id_photo_url,k."note",lower(k."status"::text) AS status,k."createdAt" AS created_at,u."fullName" AS full_name,u."email",u."university" AS campus FROM kyc_submissions k JOIN users u ON u."id"=k."userId" WHERE k."status"='PENDING' ORDER BY k."createdAt"`);return res.json(result.rows); }
  catch(error:any) { console.error('KYC review list failed:',error.message);return res.status(500).json({error:'Could not load verification requests.'}); }
});

app.patch('/api/admin/kyc/:id',requireAuth,requireAdmin,async (req:AuthRequest,res) => {
  const status=req.body?.status;if(!['approved','rejected'].includes(status))return res.status(400).json({error:'Choose approved or rejected.'});const dbStatus=String(status).toUpperCase();const client=await pool.connect();
  try { await client.query('BEGIN');const result=await client.query('UPDATE kyc_submissions SET "status"=$2::"KycStatus","updatedAt"=now(),"reviewedBy"=$3 WHERE "id"=$1 AND "status"=\'PENDING\' RETURNING "userId"',[String(req.params.id),dbStatus,req.auth!.userId]);if(!result.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Pending verification request not found.'});}const account=await client.query('UPDATE users SET "kycStatus"=$2::"KycStatus","updatedAt"=now() WHERE "id"=$1 RETURNING "email","fullName","roles"',[result.rows[0].userId,dbStatus]);await audit(client,req.auth!.userId,`kyc_${status}`,'kyc',String(req.params.id));await client.query('COMMIT');const verifiedUser=account.rows[0];if(status==='approved'&&verifiedUser&&!verifiedUser.roles?.includes('ADMIN')&&emailDeliveryConfigured()){try{const sent=await sendKycApprovedEmail(verifiedUser.email,verifiedUser.fullName);console.info('Student verification approval email accepted by Resend.',{emailId:sent?.id});}catch(emailError){console.error('Student verification approval email failed:',emailError instanceof Error?emailError.message:'unknown email error');}}return res.json({id:String(req.params.id),status}); }
  catch(error:any) { await client.query('ROLLBACK');console.error('KYC review failed:',error.message);return res.status(500).json({error:'Could not review verification.'}); } finally { client.release(); }
});

app.post('/api/admin/categories',requireAuth,requireAdmin,async (req,res) => {
  const {name,slug,category_type,parent_id}=req.body??{};if(!name||!slug||!['physical','service'].includes(category_type))return res.status(400).json({error:'Name, slug and a valid category type are required.'});
  try { const result=await query('INSERT INTO categories ("id","name","slug","type","parentId","updatedAt") VALUES ($1,$2,$3,$4::"ListingType",$5,now()) RETURNING "id","name","slug",lower("type"::text) AS category_type,"parentId" AS parent_id',[randomUUID(),String(name).trim(),String(slug).trim().toLowerCase(),String(category_type).toUpperCase(),parent_id||null]);return res.status(201).json(result.rows[0]); }
  catch(error:any) { if(error.code==='23505')return res.status(409).json({error:'That category slug already exists.'});console.error('Category create failed:',error.message);return res.status(500).json({error:'Could not create category.'}); }
});

app.patch('/api/admin/categories/:id',requireAuth,requireAdmin,async (req,res) => {
  const {name,slug,is_active,parent_id}=req.body??{};
  try { const result=await query('UPDATE categories SET "name"=COALESCE($2,"name"),"slug"=COALESCE($3,"slug"),"active"=COALESCE($4,"active"),"parentId"=CASE WHEN $5 THEN $6 ELSE "parentId" END,"updatedAt"=now() WHERE "id"=$1 RETURNING "id","name","slug",lower("type"::text) AS category_type,"parentId" AS parent_id,"active" AS is_active',[String(req.params.id),name?.trim()||null,slug?.trim().toLowerCase()||null,is_active??null,Object.prototype.hasOwnProperty.call(req.body,'parent_id'),parent_id||null]);if(!result.rows[0])return res.status(404).json({error:'Category not found.'});return res.json(result.rows[0]); }
  catch(error:any) { console.error('Category update failed:',error.message);return res.status(500).json({error:'Could not update category.'}); }
});

app.delete('/api/admin/categories/:id',requireAuth,requireAdmin,async (req,res) => {
  try { const result=await query('UPDATE categories SET "active"=false,"updatedAt"=now() WHERE "id"=$1 RETURNING "id"',[String(req.params.id)]);if(!result.rows[0])return res.status(404).json({error:'Category not found.'});return res.status(204).end(); }
  catch(error:any) { console.error('Category removal failed:',error.message);return res.status(500).json({error:'Could not remove category.'}); }
});

app.get('/api/admin/disputes',requireAuth,requireAdmin,async (_req,res) => {
  try { const result=await query(`SELECT d."id",d."orderId" AS order_id,d."reason",d."details",o."total"::text AS order_total,lower(d."status"::text) AS status,d."createdAt" AS created_at,u."fullName" AS raised_by FROM disputes d JOIN orders o ON o."id"=d."orderId" JOIN users u ON u."id"=d."raisedById" WHERE d."status"='OPEN' ORDER BY d."createdAt"`);return res.json(result.rows); }
  catch(error:any) { console.error('Disputes list failed:',error.message);return res.status(500).json({error:'Could not load disputes.'}); }
});

app.post('/api/admin/disputes/:id/resolve',requireAuth,requireAdmin,async (req:AuthRequest,res) => {
  const outcome=req.body?.outcome,note=String(req.body?.note??'').trim();if(!['buyer','seller','split'].includes(outcome)||!note)return res.status(400).json({error:'Choose a resolution and provide a note.'});const client=await pool.connect();let payout:any=null;
  try {
    await client.query('BEGIN');const found=await client.query('SELECT d."id",d."orderId",o."sellerId",o."total",o."commission",o."paymentMethod",o."dpoTransactionToken",s."phone" AS "sellerPhone" FROM disputes d JOIN orders o ON o."id"=d."orderId" JOIN users s ON s."id"=o."sellerId" WHERE d."id"=$1 AND d."status"=\'OPEN\' FOR UPDATE OF d,o',[String(req.params.id)]);const row=found.rows[0];if(!row){await client.query('ROLLBACK');return res.status(404).json({error:'Open dispute not found.'});}
    const total=Number(row.total),rawBuyerAmount=outcome==='buyer'?total:outcome==='split'?Number(req.body?.buyer_amount):0,rawSellerGross=outcome==='seller'?total:outcome==='split'?Number(req.body?.seller_amount):0;
    const buyerCents=Math.round(rawBuyerAmount*100),sellerCents=Math.round(rawSellerGross*100),totalCents=Math.round(total*100),buyerAmount=buyerCents/100,sellerGross=sellerCents/100;
    if(!Number.isFinite(total)||!Number.isFinite(rawBuyerAmount)||!Number.isFinite(rawSellerGross)||buyerAmount<0||sellerGross<0||Math.abs(rawBuyerAmount*100-buyerCents)>0.0001||Math.abs(rawSellerGross*100-sellerCents)>0.0001||buyerCents+sellerCents!==totalCents){await client.query('ROLLBACK');return res.status(400).json({error:'Seller and buyer amounts must be valid two-decimal amounts that add up to the order total.'});}
    if(buyerAmount>0){if(row.paymentMethod!=='DPO_PAY'||!row.dpoTransactionToken){await client.query('ROLLBACK');return res.status(409).json({error:'A provider refund is not available for this payment yet. Keep the dispute open and refund it through the MTN merchant account.'});}await refundDpoToken({token:row.dpoTransactionToken,amount:buyerAmount.toFixed(2),details:note,reference:`SX-${row.orderId}`});}
    if(sellerGross>0){const commission=Number((Number(row.commission||0)*(sellerGross/total)).toFixed(2)),sellerNet=Number((sellerGross-commission).toFixed(2));const inserted=await client.query('INSERT INTO payouts ("id","sellerId","orderId","amount","updatedAt") VALUES ($1,$2,$3,$4,now()) ON CONFLICT ("orderId") DO UPDATE SET "amount"=EXCLUDED."amount" RETURNING "id"',[randomUUID(),row.sellerId,row.orderId,sellerNet]);payout={id:inserted.rows[0].id,orderId:row.orderId,sellerId:row.sellerId,amount:sellerNet,phone:row.sellerPhone,paymentMethod:row.paymentMethod};await recordEscrowDebit(client,row.orderId,sellerNet,outcome==='split'?'split_to_seller':'released_to_seller',`${outcome}:seller:${row.orderId}`,Number((buyerAmount+commission).toFixed(2)));if(commission>0)await recordEscrowDebit(client,row.orderId,commission,outcome==='split'?'split_platform_commission':'platform_commission',`${outcome}:commission:${row.orderId}`,buyerAmount);}
    if(buyerAmount>0)await recordEscrowDebit(client,row.orderId,buyerAmount,outcome==='split'?'split_to_buyer':'refunded_to_buyer',`${outcome}:buyer:${row.orderId}`,0);
    const escrowStatus=outcome==='buyer'?'REFUNDED':outcome==='split'?'SPLIT':'RELEASED';await client.query('UPDATE orders SET "escrowStatus"=$2::"EscrowStatus","updatedAt"=now() WHERE "id"=$1',[row.orderId,escrowStatus]);
    const status=outcome==='buyer'?'RESOLVED_BUYER':'RESOLVED_SELLER';await client.query('UPDATE disputes SET "status"=$2::"DisputeStatus","updatedAt"=now() WHERE "id"=$1',[String(req.params.id),status]);await audit(client,req.auth!.userId,`dispute_${outcome}`, 'dispute', String(req.params.id),note);await client.query('COMMIT');if(payout)await dispatchMomoPayout(payout);return res.json({status:status.toLowerCase(),escrow_status:escrowStatus.toLowerCase(),payout_status:payout?'pending':undefined});
  } catch(error:any) { await client.query('ROLLBACK');console.error('Dispute resolution failed:',error.message);return res.status(500).json({error:'Could not resolve dispute.'}); } finally { client.release(); }
});

app.get('/api/payouts',requireAuth,requireApprovedKyc,async (req:AuthRequest,res) => {
  try { const result=await query('SELECT "id","orderId" AS order_id,"amount"::text,lower("status"::text) AS status,"providerReference" AS provider_reference,"createdAt" AS created_at FROM payouts WHERE "sellerId"=$1 ORDER BY "createdAt" DESC',[req.auth!.userId]);return res.json(result.rows); }
  catch(error:any) { console.error('Payout list failed:',error.message);return res.status(500).json({error:'Could not load payouts.'}); }
});

app.get('/api/admin/payouts',requireAuth,requireAdmin,async (_req,res) => {
  try { const result=await query('SELECT p."id",p."orderId" AS order_id,p."amount"::text,lower(p."status"::text) AS status,p."providerReference" AS provider_reference,p."createdAt" AS created_at,u."fullName" AS seller_name FROM payouts p JOIN users u ON u."id"=p."sellerId" ORDER BY p."createdAt"');return res.json(result.rows); }
  catch(error:any) { console.error('Admin payouts list failed:',error.message);return res.status(500).json({error:'Could not load payouts.'}); }
});

app.patch('/api/admin/payouts/:id',requireAuth,requireAdmin,async (req,res) => {
  const status=req.body?.status;if(!['paid','failed'].includes(status))return res.status(400).json({error:'Choose paid or failed.'});
  const reference=req.body?.provider_reference;
  if(reference!==undefined&&typeof reference!=='string')return res.status(400).json({error:'Payout reference must be text.'});
  const providerReference=typeof reference==='string'?reference.trim():null;
  if(providerReference&&providerReference.length>255)return res.status(400).json({error:'Payout reference must be 255 characters or fewer.'});
  try { const result=await query('UPDATE payouts SET "status"=$2::"PayoutStatus","providerReference"=COALESCE($3,"providerReference"),"updatedAt"=now() WHERE "id"=$1 AND "status"=\'PENDING\' RETURNING "id",lower("status"::text) AS status,"providerReference" AS provider_reference',[String(req.params.id),String(status).toUpperCase(),providerReference]);if(!result.rows[0])return res.status(404).json({error:'Pending payout not found.'});return res.json(result.rows[0]); }
  catch(error:any) { console.error('Payout update failed:',error.message);return res.status(500).json({error:'Could not update payout.'}); }
});

app.post('/api/admin/escrow/:id/hold',requireAuth,requireAdmin,async (req:AuthRequest,res) => {
  const reason=String(req.body?.reason??'').trim();if(!reason)return res.status(400).json({error:'Add a reason for withholding these funds.'});const client=await pool.connect();
  try { await client.query('BEGIN');const result=await client.query('UPDATE orders SET "escrowStatus"=\'WITHHELD_BY_ADMIN\',"withheldAt"=now(),"withheldReason"=$2,"updatedAt"=now() WHERE "id"=$1 AND "escrowStatus"=\'HELD\' RETURNING "id",lower("escrowStatus"::text) AS status',[String(req.params.id),reason]);if(!result.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Held escrow was not found.'});}await audit(client,req.auth!.userId,'escrow_withheld','order',String(req.params.id),reason);await client.query('COMMIT');return res.json({order_id:String(req.params.id),status:result.rows[0].status}); }
  catch(error:any) { await client.query('ROLLBACK');console.error('Escrow hold failed:',error.message);return res.status(500).json({error:'Could not withhold funds.'}); } finally { client.release(); }
});

app.post('/api/admin/escrow/:id/release',requireAuth,requireAdmin,async (req:AuthRequest,res) => {
  const client=await pool.connect();let payout:any=null;
  try {
    await client.query('BEGIN');const found=await client.query('SELECT o."id",o."sellerId",o."total",o."commission",o."paymentMethod",o."escrowStatus",s."phone" AS "sellerPhone" FROM orders o JOIN users s ON s."id"=o."sellerId" WHERE o."id"=$1 FOR UPDATE OF o',[String(req.params.id)]);const order=found.rows[0];if(!order||!['HELD','WITHHELD_BY_ADMIN'].includes(order.escrowStatus)){await client.query('ROLLBACK');return res.status(404).json({error:'Held escrow was not found or is under dispute.'});}
    payout=await releaseOrderToPayout(client,order,req.auth!.userId,'escrow_released');await client.query('COMMIT');await dispatchMomoPayout(payout);return res.json({status:'released',payout_status:'pending'});
  } catch(error:any) { await client.query('ROLLBACK');console.error('Escrow release failed:',error.message);return res.status(500).json({error:'Could not release funds.'}); } finally { client.release(); }
});

app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found.'}));
app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error('API error:',error.message);res.status(400).json({error:'Invalid JSON request body.'});});

function signToken(userId:string,role:string){if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error('JWT_SECRET must contain at least 32 characters.');return jwt.sign({userId,role},process.env.JWT_SECRET,{expiresIn:'7d'});}
