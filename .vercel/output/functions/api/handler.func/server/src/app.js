import './config/env.js';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query } from './config/db.js';
import { requireAdmin, requireApprovedKyc, requireAuth } from './middleware/auth.js';
import { createDpoCheckout } from './services/dpo.js';
import { createMomoCheckout } from './services/momo.js';
export const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? true }));
app.use((req, res, next) => req.sxBodyParsedByVercel ? next() : express.json({ limit: '2mb' })(req, res, next));
const roleFor = (roles = []) => roles.includes('ADMIN') ? 'admin' : roles.includes('SELLER') ? 'seller' : 'customer';
const userView = (user) => ({ id: user.id, email: user.email, full_name: user.fullName, campus: user.university, role: roleFor(user.roles), kyc_status: String(user.kycStatus ?? 'NOT_SUBMITTED').toLowerCase() });
const uiStatus = (status, receiptConfirmed = false) => {
    if (status === 'PENDING_PAYMENT')
        return 'pending_payment';
    if (status === 'HELD' || status === 'WITHHELD_BY_ADMIN')
        return receiptConfirmed ? 'completed' : 'paid';
    if (status === 'DISPUTED')
        return 'disputed';
    if (status === 'RELEASED')
        return 'completed';
    if (status === 'REFUNDED')
        return 'refunded';
    return 'cancelled';
};
const listingType = (value) => value === 'PHYSICAL' ? 'physical' : 'service';
const audit = (client, actorId, action, targetType, targetId, detail = '') => client.query('INSERT INTO audit_logs ("id","actorId","action","targetType","targetId","detail") VALUES ($1,$2,$3,$4,$5,$6)', [randomUUID(), actorId, action, targetType, targetId, detail]);
app.get('/api/health', async (_req, res) => {
    try {
        const result = await query('SELECT current_database() AS database');
        return res.json({ status: 'ok', database: result.rows[0]?.database });
    }
    catch {
        return res.status(503).json({ status: 'database_unavailable' });
    }
});
app.post('/api/auth/register', async (req, res) => {
    const { email, password, full_name, campus, phone, role } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || typeof full_name !== 'string' || password.length < 8)
        return res.status(400).json({ error: 'Provide your name, email and a password of at least 8 characters.' });
    if (role && !['customer', 'seller'].includes(role))
        return res.status(400).json({ error: 'Choose customer or seller.' });
    const roles = role === 'seller' ? ['CUSTOMER', 'SELLER'] : ['CUSTOMER'];
    try {
        const hash = await bcrypt.hash(password, 12);
        const created = await query('INSERT INTO users ("id","email","phone","university","passwordHash","fullName","roles","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7::"Role"[],now()) RETURNING "id","email","fullName","university","roles","kycStatus"', [randomUUID(), email.trim().toLowerCase(), String(phone ?? '').trim(), String(campus ?? '').trim(), hash, full_name.trim(), roles]);
        const user = userView(created.rows[0]);
        return res.status(201).json({ token: signToken(user.id, user.role), user });
    }
    catch (error) {
        if (error.code === '23505')
            return res.status(409).json({ error: 'An account already exists for that email.' });
        console.error('Registration failed:', error.message);
        return res.status(500).json({ error: 'Could not create your account.' });
    }
});
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required.' });
    try {
        const result = await query('SELECT "id","email","fullName","university","roles","passwordHash","status","kycStatus" FROM users WHERE "email"=$1', [String(email).trim().toLowerCase()]);
        const user = result.rows[0];
        if (!user || user.status !== 'ACTIVE' || !await bcrypt.compare(String(password), user.passwordHash))
            return res.status(401).json({ error: 'Email or password is incorrect.' });
        const safe = userView(user);
        return res.json({ token: signToken(user.id, safe.role), user: safe });
    }
    catch (error) {
        console.error('Login failed:', error.message);
        return res.status(500).json({ error: 'Could not sign in.' });
    }
});
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const result = await query('SELECT "id","email","fullName","university","roles","kycStatus","status" FROM users WHERE "id"=$1', [req.auth.userId]);
        if (!result.rows[0] || result.rows[0].status !== 'ACTIVE')
            return res.status(403).json({ error: 'This account is not active.' });
        return res.json(userView(result.rows[0]));
    }
    catch (error) {
        console.error('Account status check failed:', error.message);
        return res.status(500).json({ error: 'Could not check account status.' });
    }
});
app.post('/api/kyc', requireAuth, async (req, res) => {
    const idNumber = String(req.body?.student_id_number ?? '').trim();
    const photo = String(req.body?.id_photo_data ?? '').trim();
    const note = String(req.body?.note ?? '').trim().slice(0, 500);
    if (idNumber.length < 3 || idNumber.length > 120)
        return res.status(400).json({ error: 'Enter a valid student ID number.' });
    if (photo.length > 180000 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(photo))
        return res.status(400).json({ error: 'Upload a valid JPG, PNG or WebP photo of your student ID.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const account = await client.query('SELECT "kycStatus" FROM users WHERE "id"=$1 FOR UPDATE', [req.auth.userId]);
        if (!account.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Account not found.' });
        }
        if (account.rows[0].kycStatus === 'APPROVED') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Student verification is already approved.' });
        }
        const pending = await client.query('SELECT "id" FROM kyc_submissions WHERE "userId"=$1 AND "status"=\'PENDING\' ORDER BY "createdAt" DESC LIMIT 1', [req.auth.userId]);
        if (pending.rows[0])
            await client.query('UPDATE kyc_submissions SET "idNumber"=$2,"idPhotoUrl"=$3,"note"=$4,"updatedAt"=now() WHERE "id"=$1', [pending.rows[0].id, idNumber, photo, note]);
        else
            await client.query('INSERT INTO kyc_submissions ("id","userId","idNumber","idPhotoUrl","status","note","updatedAt") VALUES ($1,$2,$3,$4,\'PENDING\',$5,now())', [randomUUID(), req.auth.userId, idNumber, photo, note]);
        await client.query('UPDATE users SET "kycStatus"=\'PENDING\',"updatedAt"=now() WHERE "id"=$1', [req.auth.userId]);
        await audit(client, req.auth.userId, 'kyc_submitted', 'user', req.auth.userId);
        await client.query('COMMIT');
        return res.status(202).json({ status: 'pending' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('KYC submission failed:', error.message);
        return res.status(500).json({ error: 'Could not submit your student verification.' });
    }
    finally {
        client.release();
    }
});
app.get('/api/categories', async (req, res) => {
    try {
        const type = req.query.type;
        const sql = 'SELECT "id","name","slug",lower("type"::text) AS category_type,"parentId" AS parent_id FROM categories WHERE "active"=true';
        const result = type === 'physical' || type === 'service' ? await query(`${sql} AND "type"=$1::"ListingType" ORDER BY "sortOrder","name"`, [String(type).toUpperCase()]) : await query(`${sql} ORDER BY "type","sortOrder","name"`);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Categories failed:', error.message);
        return res.status(500).json({ error: 'Could not load categories.' });
    }
});
app.get('/api/admin/categories', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const result = await query('SELECT "id","name","slug",lower("type"::text) AS category_type,"parentId" AS parent_id,"active" AS is_active,"sortOrder" AS sort_order FROM categories ORDER BY "type","sortOrder","name"');
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Admin categories failed:', error.message);
        return res.status(500).json({ error: 'Could not load categories.' });
    }
});
app.get('/api/listings', async (req, res) => {
    const type = req.query.type;
    if (type && !['physical', 'service'].includes(String(type)))
        return res.status(400).json({ error: 'Invalid listing type.' });
    const values = [`%${String(req.query.search ?? '').trim().slice(0, 100)}%`];
    let typeSql = '';
    if (type) {
        values.push(String(type).toUpperCase());
        typeSql = ` AND l."type"=$${values.length}::"ListingType"`;
    }
    try {
        const result = await query(`SELECT l."id",l."title",l."description",l."price"::text,lower(l."type"::text) AS listing_type,l."condition"::text AS condition,l."images",l."createdAt" AS created_at,c."name" AS category_name,u."fullName" AS seller_name,u."university" AS campus FROM listings l JOIN categories c ON c."id"=l."categoryId" JOIN users u ON u."id"=l."sellerId" WHERE l."status"='ACTIVE' AND c."active"=true AND (l."title" ILIKE $1 OR l."description" ILIKE $1 OR c."name" ILIKE $1 OR COALESCE(u."university",'') ILIKE $1)${typeSql} ORDER BY l."createdAt" DESC LIMIT 30`, values);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Listings failed:', error.message);
        return res.status(500).json({ error: 'Could not load listings.' });
    }
});
app.post('/api/listings', requireAuth, requireApprovedKyc, async (req, res) => {
    const { title, description, category_id, listing_type, price, condition, stock } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim())
        return res.status(400).json({ error: 'Enter a title for the listing.' });
    if (typeof description !== 'string' || !description.trim())
        return res.status(400).json({ error: 'Enter listing details.' });
    if (typeof category_id !== 'string' || !category_id.trim())
        return res.status(400).json({ error: 'Choose a category.' });
    if (!['physical', 'service'].includes(listing_type))
        return res.status(400).json({ error: 'Choose whether this listing is a physical item or a service.' });
    if (!Number.isFinite(Number(price)) || Number(price) <= 0)
        return res.status(400).json({ error: 'Enter a price greater than zero.' });
    const kind = String(listing_type).toUpperCase();
    const conditionValue = kind === 'PHYSICAL' && condition ? String(condition).toUpperCase() : null;
    if (conditionValue && !['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'].includes(conditionValue))
        return res.status(400).json({ error: 'Choose a valid physical item condition.' });
    try {
        const seller = await query('SELECT "roles" FROM users WHERE "id"=$1', [req.auth.userId]);
        if (!seller.rows[0]?.roles?.includes('SELLER'))
            return res.status(403).json({ error: 'Create a seller account to publish listings.' });
        const category = await query('SELECT "id" FROM categories WHERE "id"=$1 AND "type"=$2::"ListingType" AND "active"=true', [category_id, kind]);
        if (!category.rows[0])
            return res.status(400).json({ error: 'Choose a category that matches the listing type.' });
        const imageUrl = String(req.body?.image_url ?? '').trim();
        const isHostedImage = /^https:\/\//i.test(imageUrl);
        const isUploadedImage = imageUrl.length <= 72000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/i.test(imageUrl);
        if (imageUrl && !isHostedImage && !isUploadedImage)
            return res.status(400).json({ error: 'Use an https image URL or upload a JPG, PNG or WebP image smaller than 700 KB.' });
        const result = await query('INSERT INTO listings ("id","sellerId","type","categoryId","title","description","price","stock","condition","images","updatedAt") VALUES ($1,$2,$3::"ListingType",$4,$5,$6,$7,$8,$9::"ItemCondition",$10,now()) RETURNING "id","title","description","price"::text,lower("type"::text) AS listing_type,"condition"::text AS condition,"images","createdAt" AS created_at', [randomUUID(), req.auth.userId, kind, category_id, String(title).trim(), String(description).trim(), Number(price), kind === 'PHYSICAL' ? Math.max(1, Number(stock) || 1) : null, conditionValue, imageUrl ? [imageUrl] : []]);
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Create listing failed:', error.message);
        return res.status(500).json({ error: 'Could not publish listing.' });
    }
});
app.patch('/api/listings/:id', requireAuth, requireApprovedKyc, async (req, res) => {
    const { title, description, price, stock, status } = req.body ?? {};
    const statuses = { active: 'ACTIVE', paused: 'PAUSED', removed: 'SOLD_OUT' };
    if (status && !statuses[status])
        return res.status(400).json({ error: 'Invalid listing status.' });
    try {
        const result = await query('UPDATE listings SET "title"=COALESCE($3,"title"),"description"=COALESCE($4,"description"),"price"=COALESCE($5,"price"),"stock"=COALESCE($6,"stock"),"status"=COALESCE($7::"ListingStatus","status"),"updatedAt"=now() WHERE "id"=$1 AND "sellerId"=$2 RETURNING "id","title","description","price"::text,"stock",lower("status"::text) AS status', [String(req.params.id), req.auth.userId, title?.trim() || null, description?.trim() || null, price == null ? null : Number(price), stock == null ? null : Math.max(0, Number(stock)), status ? statuses[status] : null]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Listing not found.' });
        return res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Update listing failed:', error.message);
        return res.status(500).json({ error: 'Could not update listing.' });
    }
});
app.delete('/api/listings/:id', requireAuth, requireApprovedKyc, async (req, res) => {
    try {
        const result = await query('UPDATE listings SET "status"=\'SOLD_OUT\',"updatedAt"=now() WHERE "id"=$1 AND "sellerId"=$2 RETURNING "id"', [String(req.params.id), req.auth.userId]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Listing not found.' });
        return res.status(204).end();
    }
    catch (error) {
        console.error('Remove listing failed:', error.message);
        return res.status(500).json({ error: 'Could not remove listing.' });
    }
});
app.post('/api/seller/kyc', requireAuth, async (req, res) => {
    const studentId = String(req.body?.student_id_number ?? '').trim();
    const idPhoto = String(req.body?.id_photo_url ?? '').trim();
    if (studentId.length < 3 || studentId.length > 120)
        return res.status(400).json({ error: 'Enter a valid student ID number.' });
    if (idPhoto.length > 180000 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(idPhoto))
        return res.status(400).json({ error: 'Upload a clear photo of your student ID.' });
    try {
        const exists = await query('SELECT "roles","kycStatus" FROM users WHERE "id"=$1', [req.auth.userId]);
        if (!exists.rows[0]?.roles?.includes('SELLER'))
            return res.status(403).json({ error: 'Create a seller account before submitting verification.' });
        if (exists.rows[0].kycStatus === 'APPROVED')
            return res.status(409).json({ error: 'Student verification is already approved.' });
        const result = await query('INSERT INTO kyc_submissions ("id","userId","idNumber","idPhotoUrl","status","note","updatedAt") VALUES ($1,$2,$3,$4,\'PENDING\',$5,now()) RETURNING "id","status","createdAt" AS created_at', [randomUUID(), req.auth.userId, studentId, idPhoto, String(req.body?.note ?? '').slice(0, 500)]);
        await query('UPDATE users SET "kycStatus"=\'PENDING\',"updatedAt"=now() WHERE "id"=$1', [req.auth.userId]);
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('KYC submit failed:', error.message);
        return res.status(500).json({ error: 'Could not submit verification.' });
    }
});
app.post('/api/seller/activate', requireAuth, requireApprovedKyc, async (req, res) => {
    try {
        const result = await query('UPDATE users SET "roles"=CASE WHEN "roles" @> ARRAY[\'SELLER\'::"Role"] THEN "roles" ELSE array_append("roles",\'SELLER\'::"Role") END,"updatedAt"=now() WHERE "id"=$1 RETURNING "id","email","fullName","university","roles"', [req.auth.userId]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Account not found.' });
        const user = userView(result.rows[0]);
        return res.json({ token: signToken(user.id, user.role), user });
    }
    catch (error) {
        console.error('Seller activation failed:', error.message);
        return res.status(500).json({ error: 'Could not activate your seller account.' });
    }
});
app.get('/api/seller/listings', requireAuth, requireApprovedKyc, async (req, res) => {
    try {
        const seller = await query('SELECT "kycStatus" FROM users WHERE "id"=$1 AND "roles" @> ARRAY[\'SELLER\'::"Role"]', [req.auth.userId]);
        if (!seller.rows[0])
            return res.status(403).json({ error: 'Create a seller account to manage listings.' });
        const listings = await query('SELECT l."id",l."title",l."description",l."price"::text,l."stock",lower(l."status"::text) AS status,lower(l."type"::text) AS listing_type,l."condition"::text AS condition,l."createdAt" AS created_at,c."name" AS category_name FROM listings l JOIN categories c ON c."id"=l."categoryId" WHERE l."sellerId"=$1 ORDER BY l."createdAt" DESC', [req.auth.userId]);
        return res.json({ seller: { kyc_status: String(seller.rows[0].kycStatus).toLowerCase() }, listings: listings.rows });
    }
    catch (error) {
        console.error('Seller listings failed:', error.message);
        return res.status(500).json({ error: 'Could not load seller listings.' });
    }
});
app.get('/api/orders', requireAuth, requireApprovedKyc, async (req, res) => {
    try {
        const result = await query(`SELECT o."id",lower(o."escrowStatus"::text) AS escrow_status,CASE WHEN EXISTS(SELECT 1 FROM audit_logs a WHERE a."targetType"='order' AND a."targetId"=o."id" AND a."action"='buyer_cancelled_order') THEN 'cancelled' WHEN EXISTS(SELECT 1 FROM audit_logs a WHERE a."targetType"='order' AND a."targetId"=o."id" AND a."action"='buyer_receipt_confirmed') THEN 'completed' ELSE CASE o."escrowStatus"::text WHEN 'PENDING_PAYMENT' THEN 'pending_payment' WHEN 'HELD' THEN 'paid' WHEN 'WITHHELD_BY_ADMIN' THEN 'paid' WHEN 'DISPUTED' THEN 'disputed' WHEN 'RELEASED' THEN 'completed' WHEN 'REFUNDED' THEN 'refunded' ELSE 'cancelled' END END AS status,o."total"::text AS total_amount,'SZL' AS currency,o."createdAt" AS created_at,b."fullName" AS buyer_name,s."fullName" AS seller_name,CASE WHEN o."escrowStatus" IN ('HELD','WITHHELD_BY_ADMIN','DISPUTED') THEN o."total"::text ELSE '0' END AS held_amount,l."title" AS item_titles FROM orders o JOIN users b ON b."id"=o."buyerId" JOIN users s ON s."id"=o."sellerId" JOIN listings l ON l."id"=o."listingId" WHERE o."buyerId"=$1 OR o."sellerId"=$1 ORDER BY o."createdAt" DESC LIMIT 50`, [req.auth.userId]);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Orders failed:', error.message);
        return res.status(500).json({ error: 'Could not load orders.' });
    }
});
app.post('/api/orders', requireAuth, requireApprovedKyc, async (req, res) => {
    const { listing_id, quantity = 1, payment_method = 'DPO_PAY' } = req.body ?? {};
    const count = Math.max(1, Math.min(50, Number(quantity) || 1));
    const method = String(payment_method).toUpperCase();
    if (!['DPO_PAY', 'MTN_MOMO'].includes(method))
        return res.status(400).json({ error: 'Choose DPO Pay or MTN MoMo.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const found = await client.query('SELECT l."id",l."sellerId",l."price",l."stock",l."status",l."type",s."roles" FROM listings l JOIN users s ON s."id"=l."sellerId" WHERE l."id"=$1 FOR UPDATE OF l', [listing_id]);
        const listing = found.rows[0];
        if (!listing || listing.status !== 'ACTIVE' || listing.sellerId === req.auth.userId || (listing.stock !== null && listing.stock < count)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'This listing is unavailable or does not have enough stock.' });
        }
        const total = Number(listing.price) * count;
        const id = randomUUID();
        const order = await client.query('INSERT INTO orders ("id","listingId","buyerId","sellerId","quantity","unitPrice","total","commission","paymentMethod","escrowStatus","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8::"PaymentMethod",\'PENDING_PAYMENT\',now()) RETURNING "id",lower("escrowStatus"::text) AS status,"total"::text AS total_amount', [id, listing.id, req.auth.userId, listing.sellerId, count, listing.price, total, method]);
        if (listing.stock !== null) {
            const remaining = Number(listing.stock) - count;
            await client.query('UPDATE listings SET "stock"=$2,"status"=CASE WHEN $2=0 THEN \'SOLD_OUT\'::"ListingStatus" ELSE "status" END,"updatedAt"=now() WHERE "id"=$1', [listing.id, remaining]);
        }
        await client.query('COMMIT');
        return res.status(201).json({ order: { ...order.rows[0], currency: 'SZL' }, payment: { status: 'pending', message: 'Choose a payment method in My orders. Provider checkout requires active merchant credentials.' } });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Order create failed:', error.message);
        return res.status(500).json({ error: 'Could not create order.' });
    }
    finally {
        client.release();
    }
});
app.post('/api/orders/:id/cancel', requireAuth, requireApprovedKyc, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT o."id",o."listingId",o."quantity",o."escrowStatus",l."stock",l."status" AS listing_status FROM orders o JOIN listings l ON l."id"=o."listingId" WHERE o."id"=$1 AND o."buyerId"=$2 FOR UPDATE OF o,l', [String(req.params.id), req.auth.userId]);
        const order = result.rows[0];
        if (!order || order.escrowStatus !== 'PENDING_PAYMENT') {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Only an unpaid order can be cancelled.' });
        }
        const cancelled = await client.query('SELECT 1 FROM audit_logs WHERE "targetType"=\'order\' AND "targetId"=$1 AND "action"=\'buyer_cancelled_order\'', [order.id]);
        if (cancelled.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'This order has already been cancelled.' });
        }
        if (order.stock !== null)
            await client.query('UPDATE listings SET "stock"="stock"+$2,"status"=CASE WHEN "status"=\'SOLD_OUT\' THEN \'ACTIVE\'::"ListingStatus" ELSE "status" END,"updatedAt"=now() WHERE "id"=$1', [order.listingId, order.quantity]);
        await audit(client, req.auth.userId, 'buyer_cancelled_order', 'order', order.id, 'Unpaid order cancelled; reserved listing stock restored.');
        await client.query('COMMIT');
        return res.json({ id: order.id, status: 'cancelled' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Order cancellation failed:', error.message);
        return res.status(500).json({ error: 'Could not cancel the order.' });
    }
    finally {
        client.release();
    }
});
app.post('/api/orders/:id/confirm', requireAuth, requireApprovedKyc, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const order = await client.query('SELECT "id","buyerId","escrowStatus" FROM orders WHERE "id"=$1 FOR UPDATE', [String(req.params.id)]);
        if (!order.rows[0] || order.rows[0].buyerId !== req.auth.userId || !['HELD', 'WITHHELD_BY_ADMIN'].includes(order.rows[0].escrowStatus)) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Order not found or not ready for receipt confirmation.' });
        }
        await audit(client, req.auth.userId, 'buyer_receipt_confirmed', 'order', String(req.params.id));
        await client.query('COMMIT');
        return res.json({ id: String(req.params.id), status: 'completed', escrow: 'held_for_admin_release' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Receipt confirmation failed:', error.message);
        return res.status(500).json({ error: 'Could not confirm receipt.' });
    }
    finally {
        client.release();
    }
});
app.post('/api/orders/:id/dispute', requireAuth, requireApprovedKyc, async (req, res) => {
    const reason = String(req.body?.reason ?? '').trim(), details = String(req.body?.details ?? '').trim();
    if (!reason || !details)
        return res.status(400).json({ error: 'Provide a reason and details for the dispute.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const order = await client.query('SELECT "id","buyerId","sellerId","escrowStatus" FROM orders WHERE "id"=$1 FOR UPDATE', [String(req.params.id)]);
        const row = order.rows[0];
        if (!row || !['HELD', 'WITHHELD_BY_ADMIN'].includes(row.escrowStatus)) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'This order cannot be disputed.' });
        }
        if (row.buyerId !== req.auth.userId && row.sellerId !== req.auth.userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Only people in this order can open a dispute.' });
        }
        const dispute = await client.query('INSERT INTO disputes ("id","orderId","raisedById","reason","details","status","updatedAt") VALUES ($1,$2,$3,$4,$5,\'OPEN\',now()) RETURNING "id","status"', [randomUUID(), row.id, req.auth.userId, reason.slice(0, 180), details.slice(0, 4000)]);
        await client.query('UPDATE orders SET "escrowStatus"=\'DISPUTED\',"updatedAt"=now() WHERE "id"=$1', [row.id]);
        await audit(client, req.auth.userId, 'dispute_opened', 'order', row.id, reason.slice(0, 180));
        await client.query('COMMIT');
        return res.status(201).json({ id: dispute.rows[0].id, status: 'open' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Dispute creation failed:', error.message);
        return res.status(500).json({ error: 'Could not open dispute.' });
    }
    finally {
        client.release();
    }
});
app.post('/api/payments/:provider/start', requireAuth, requireApprovedKyc, async (req, res) => {
    const provider = String(req.params.provider);
    if (!['dpo', 'momo'].includes(provider))
        return res.status(400).json({ error: 'Choose DPO Pay or MTN MoMo.' });
    try {
        const order = await query('SELECT o."id",o."total",o."paymentMethod",o."escrowStatus" FROM orders o WHERE o."id"=$1 AND o."buyerId"=$2 AND o."escrowStatus"=\'PENDING_PAYMENT\' AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a."targetType"=\'order\' AND a."targetId"=o."id" AND a."action"=\'buyer_cancelled_order\')', [String(req.body?.order_id ?? ''), req.auth.userId]);
        if (!order.rows[0])
            return res.status(404).json({ error: 'Payment order not found.' });
        const expected = provider === 'dpo' ? 'DPO_PAY' : 'MTN_MOMO';
        if (order.rows[0].paymentMethod !== expected)
            await query('UPDATE orders SET "paymentMethod"=$2::"PaymentMethod","updatedAt"=now() WHERE "id"=$1', [order.rows[0].id, expected]);
        const checkout = provider === 'dpo' ? createDpoCheckout() : createMomoCheckout();
        return res.status(202).json({ payment: { id: order.rows[0].id, status: 'pending', amount: String(order.rows[0].total) }, currency: 'SZL', checkout, next: 'No charge has been made. Configure and implement the merchant checkout before accepting live payments.' });
    }
    catch (error) {
        console.error('Payment start failed:', error.message);
        return res.status(500).json({ error: 'Could not start payment.' });
    }
});
app.post('/api/payments/:provider/webhook', async (req, res) => {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET, supplied = req.header('x-webhook-secret');
    if (!secret || !supplied || supplied !== secret)
        return res.status(401).json({ error: 'Invalid webhook credentials.' });
    const provider = String(req.params.provider), { payment_id, status, provider_reference } = req.body ?? {};
    if (!['dpo', 'momo'].includes(provider) || status !== 'paid' || !payment_id)
        return res.status(400).json({ error: 'Invalid payment callback.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const found = await client.query('SELECT "id","sellerId","paymentMethod","escrowStatus","total" FROM orders WHERE "id"=$1 FOR UPDATE', [payment_id]);
        const order = found.rows[0];
        if (!order || order.paymentMethod !== (provider === 'dpo' ? 'DPO_PAY' : 'MTN_MOMO')) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Payment not found.' });
        }
        if (order.escrowStatus !== 'PENDING_PAYMENT') {
            await client.query('COMMIT');
            return res.json({ status: 'already_processed' });
        }
        await client.query('UPDATE orders SET "escrowStatus"=\'HELD\',"updatedAt"=now() WHERE "id"=$1', [order.id]);
        await audit(client, order.sellerId, 'payment_confirmed', 'order', order.id, String(provider_reference ?? '').slice(0, 255));
        await client.query('COMMIT');
        return res.json({ status: 'paid_and_held_in_escrow' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Payment webhook failed:', error.message);
        return res.status(500).json({ error: 'Could not process payment callback.' });
    }
    finally {
        client.release();
    }
});
app.get('/api/admin/escrow', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const result = await query(`SELECT o."id" AS order_id,o."total"::text AS held_amount,lower(o."escrowStatus"::text) AS status,o."withheldReason" AS withheld_reason,o."createdAt" AS created_at FROM orders o WHERE o."escrowStatus" IN ('HELD','WITHHELD_BY_ADMIN','DISPUTED') ORDER BY o."createdAt"`);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Escrow list failed:', error.message);
        return res.status(500).json({ error: 'Could not load escrow.' });
    }
});
app.get('/api/admin/kyc', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const result = await query(`SELECT k."id",k."idNumber" AS student_id_number,k."idPhotoUrl" AS id_photo_url,k."note",lower(k."status"::text) AS status,k."createdAt" AS created_at,u."fullName" AS full_name,u."email",u."university" AS campus FROM kyc_submissions k JOIN users u ON u."id"=k."userId" WHERE k."status"='PENDING' ORDER BY k."createdAt"`);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('KYC review list failed:', error.message);
        return res.status(500).json({ error: 'Could not load verification requests.' });
    }
});
app.patch('/api/admin/kyc/:id', requireAuth, requireAdmin, async (req, res) => {
    const status = req.body?.status;
    if (!['approved', 'rejected'].includes(status))
        return res.status(400).json({ error: 'Choose approved or rejected.' });
    const dbStatus = String(status).toUpperCase();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('UPDATE kyc_submissions SET "status"=$2::"KycStatus","updatedAt"=now(),"reviewedBy"=$3 WHERE "id"=$1 AND "status"=\'PENDING\' RETURNING "userId"', [String(req.params.id), dbStatus, req.auth.userId]);
        if (!result.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Pending verification request not found.' });
        }
        await client.query('UPDATE users SET "kycStatus"=$2::"KycStatus","updatedAt"=now() WHERE "id"=$1', [result.rows[0].userId, dbStatus]);
        await audit(client, req.auth.userId, `kyc_${status}`, 'kyc', String(req.params.id));
        await client.query('COMMIT');
        return res.json({ id: String(req.params.id), status });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('KYC review failed:', error.message);
        return res.status(500).json({ error: 'Could not review verification.' });
    }
    finally {
        client.release();
    }
});
app.post('/api/admin/categories', requireAuth, requireAdmin, async (req, res) => {
    const { name, slug, category_type, parent_id } = req.body ?? {};
    if (!name || !slug || !['physical', 'service'].includes(category_type))
        return res.status(400).json({ error: 'Name, slug and a valid category type are required.' });
    try {
        const result = await query('INSERT INTO categories ("id","name","slug","type","parentId","updatedAt") VALUES ($1,$2,$3,$4::"ListingType",$5,now()) RETURNING "id","name","slug",lower("type"::text) AS category_type,"parentId" AS parent_id', [randomUUID(), String(name).trim(), String(slug).trim().toLowerCase(), String(category_type).toUpperCase(), parent_id || null]);
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        if (error.code === '23505')
            return res.status(409).json({ error: 'That category slug already exists.' });
        console.error('Category create failed:', error.message);
        return res.status(500).json({ error: 'Could not create category.' });
    }
});
app.patch('/api/admin/categories/:id', requireAuth, requireAdmin, async (req, res) => {
    const { name, slug, is_active, parent_id } = req.body ?? {};
    try {
        const result = await query('UPDATE categories SET "name"=COALESCE($2,"name"),"slug"=COALESCE($3,"slug"),"active"=COALESCE($4,"active"),"parentId"=CASE WHEN $5 THEN $6 ELSE "parentId" END,"updatedAt"=now() WHERE "id"=$1 RETURNING "id","name","slug",lower("type"::text) AS category_type,"parentId" AS parent_id,"active" AS is_active', [String(req.params.id), name?.trim() || null, slug?.trim().toLowerCase() || null, is_active ?? null, Object.prototype.hasOwnProperty.call(req.body, 'parent_id'), parent_id || null]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Category not found.' });
        return res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Category update failed:', error.message);
        return res.status(500).json({ error: 'Could not update category.' });
    }
});
app.delete('/api/admin/categories/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await query('UPDATE categories SET "active"=false,"updatedAt"=now() WHERE "id"=$1 RETURNING "id"', [String(req.params.id)]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Category not found.' });
        return res.status(204).end();
    }
    catch (error) {
        console.error('Category removal failed:', error.message);
        return res.status(500).json({ error: 'Could not remove category.' });
    }
});
app.get('/api/admin/disputes', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const result = await query(`SELECT d."id",d."orderId" AS order_id,d."reason",d."details",lower(d."status"::text) AS status,d."createdAt" AS created_at,u."fullName" AS raised_by FROM disputes d JOIN users u ON u."id"=d."raisedById" WHERE d."status"='OPEN' ORDER BY d."createdAt"`);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Disputes list failed:', error.message);
        return res.status(500).json({ error: 'Could not load disputes.' });
    }
});
app.post('/api/admin/disputes/:id/resolve', requireAuth, requireAdmin, async (req, res) => {
    const outcome = req.body?.outcome, note = String(req.body?.note ?? '').trim();
    if (!['buyer', 'seller'].includes(outcome) || !note)
        return res.status(400).json({ error: 'Choose a resolution and provide a note.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const found = await client.query('SELECT d."id",d."orderId",o."sellerId",o."total" FROM disputes d JOIN orders o ON o."id"=d."orderId" WHERE d."id"=$1 AND d."status"=\'OPEN\' FOR UPDATE OF d,o', [String(req.params.id)]);
        const row = found.rows[0];
        if (!row) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Open dispute not found.' });
        }
        if (outcome === 'seller') {
            await client.query('UPDATE orders SET "escrowStatus"=\'RELEASED\',"updatedAt"=now() WHERE "id"=$1', [row.orderId]);
            await client.query('INSERT INTO payouts ("id","sellerId","orderId","amount","updatedAt") VALUES ($1,$2,$3,$4,now()) ON CONFLICT ("orderId") DO NOTHING', [randomUUID(), row.sellerId, row.orderId, row.total]);
        }
        else
            await client.query('UPDATE orders SET "escrowStatus"=\'REFUNDED\',"updatedAt"=now() WHERE "id"=$1', [row.orderId]);
        const status = outcome === 'buyer' ? 'RESOLVED_BUYER' : 'RESOLVED_SELLER';
        await client.query('UPDATE disputes SET "status"=$2::"DisputeStatus","updatedAt"=now() WHERE "id"=$1', [String(req.params.id), status]);
        await audit(client, req.auth.userId, `dispute_${outcome}`, 'dispute', String(req.params.id), note);
        await client.query('COMMIT');
        return res.json({ status: status.toLowerCase() });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Dispute resolution failed:', error.message);
        return res.status(500).json({ error: 'Could not resolve dispute.' });
    }
    finally {
        client.release();
    }
});
app.get('/api/payouts', requireAuth, requireApprovedKyc, async (req, res) => {
    try {
        const result = await query('SELECT "id","orderId" AS order_id,"amount"::text,lower("status"::text) AS status,"createdAt" AS created_at FROM payouts WHERE "sellerId"=$1 ORDER BY "createdAt" DESC', [req.auth.userId]);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Payout list failed:', error.message);
        return res.status(500).json({ error: 'Could not load payouts.' });
    }
});
app.get('/api/admin/payouts', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const result = await query('SELECT p."id",p."orderId" AS order_id,p."amount"::text,lower(p."status"::text) AS status,p."createdAt" AS created_at,u."fullName" AS seller_name FROM payouts p JOIN users u ON u."id"=p."sellerId" ORDER BY p."createdAt"');
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Admin payouts list failed:', error.message);
        return res.status(500).json({ error: 'Could not load payouts.' });
    }
});
app.patch('/api/admin/payouts/:id', requireAuth, requireAdmin, async (req, res) => {
    const status = req.body?.status;
    if (!['paid', 'failed'].includes(status))
        return res.status(400).json({ error: 'Choose paid or failed.' });
    try {
        const result = await query('UPDATE payouts SET "status"=$2::"PayoutStatus","updatedAt"=now() WHERE "id"=$1 AND "status"=\'PENDING\' RETURNING "id",lower("status"::text) AS status', [String(req.params.id), String(status).toUpperCase()]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Pending payout not found.' });
        return res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Payout update failed:', error.message);
        return res.status(500).json({ error: 'Could not update payout.' });
    }
});
app.post('/api/admin/escrow/:id/hold', requireAuth, requireAdmin, async (req, res) => {
    const reason = String(req.body?.reason ?? '').trim();
    if (!reason)
        return res.status(400).json({ error: 'Add a reason for withholding these funds.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('UPDATE orders SET "escrowStatus"=\'WITHHELD_BY_ADMIN\',"withheldAt"=now(),"withheldReason"=$2,"updatedAt"=now() WHERE "id"=$1 AND "escrowStatus"=\'HELD\' RETURNING "id",lower("escrowStatus"::text) AS status', [String(req.params.id), reason]);
        if (!result.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Held escrow was not found.' });
        }
        await audit(client, req.auth.userId, 'escrow_withheld', 'order', String(req.params.id), reason);
        await client.query('COMMIT');
        return res.json({ order_id: String(req.params.id), status: result.rows[0].status });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Escrow hold failed:', error.message);
        return res.status(500).json({ error: 'Could not withhold funds.' });
    }
    finally {
        client.release();
    }
});
app.post('/api/admin/escrow/:id/release', requireAuth, requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const found = await client.query('SELECT "id","sellerId","total","escrowStatus" FROM orders WHERE "id"=$1 FOR UPDATE', [String(req.params.id)]);
        const order = found.rows[0];
        if (!order || !['HELD', 'WITHHELD_BY_ADMIN'].includes(order.escrowStatus)) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Held escrow was not found or is under dispute.' });
        }
        await client.query('UPDATE orders SET "escrowStatus"=\'RELEASED\',"updatedAt"=now() WHERE "id"=$1', [String(req.params.id)]);
        await client.query('INSERT INTO payouts ("id","sellerId","orderId","amount","updatedAt") VALUES ($1,$2,$3,$4,now()) ON CONFLICT ("orderId") DO NOTHING', [randomUUID(), order.sellerId, order.id, order.total]);
        await audit(client, req.auth.userId, 'escrow_released', 'order', order.id);
        await client.query('COMMIT');
        return res.json({ status: 'released' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Escrow release failed:', error.message);
        return res.status(500).json({ error: 'Could not release funds.' });
    }
    finally {
        client.release();
    }
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error, _req, res, _next) => { console.error('API error:', error.message); res.status(400).json({ error: 'Invalid JSON request body.' }); });
function signToken(userId, role) { if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters.'); return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' }); }
//# sourceMappingURL=app.js.map