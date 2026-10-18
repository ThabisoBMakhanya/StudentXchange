import './config/env.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query } from './config/db.js';
import { requireAdmin, requireAuth } from './middleware/auth.js';
import { createDpoCheckout } from './services/dpo.js';
import { createMomoCheckout } from './services/momo.js';
export const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', async (_req, res) => {
    try {
        const result = await query('SELECT current_database() AS database');
        res.json({ status: 'ok', database: result.rows[0]?.database });
    }
    catch {
        res.status(503).json({ status: 'database_unavailable' });
    }
});
app.post('/api/auth/register', async (req, res) => {
    const { email, password, full_name, campus, phone, role } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || typeof full_name !== 'string' || password.length < 8)
        return res.status(400).json({ error: 'Provide your name, email and a password of at least 8 characters.' });
    if (role && !['customer', 'seller'].includes(role))
        return res.status(400).json({ error: 'Choose customer or seller.' });
    const normalizedEmail = email.trim().toLowerCase();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const hash = await bcrypt.hash(password, 12);
        const created = await client.query('INSERT INTO sx_users (email, phone, password_hash, full_name, campus, role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,email,full_name,campus,role', [normalizedEmail, phone || null, hash, full_name.trim(), campus || null, role === 'seller' ? 'seller' : 'customer']);
        const user = created.rows[0];
        if (user.role === 'seller')
            await client.query('INSERT INTO sx_sellers (user_id) VALUES ($1)', [user.id]);
        await client.query('COMMIT');
        const token = signToken(user.id, user.role);
        return res.status(201).json({ token, user });
    }
    catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505')
            return res.status(409).json({ error: 'An account already exists for that email.' });
        console.error('Registration failed:', error.message);
        return res.status(500).json({ error: 'Could not create your account.' });
    }
    finally {
        client.release();
    }
});
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required.' });
    try {
        const result = await query('SELECT id,email,full_name,campus,role,password_hash,account_state FROM sx_users WHERE email=$1', [String(email).trim().toLowerCase()]);
        const user = result.rows[0];
        if (!user || user.account_state !== 'active' || !await bcrypt.compare(String(password), user.password_hash))
            return res.status(401).json({ error: 'Email or password is incorrect.' });
        return res.json({ token: signToken(user.id, user.role), user: publicUser(user) });
    }
    catch (error) {
        console.error('Login failed:', error.message);
        return res.status(500).json({ error: 'Could not sign in.' });
    }
});
app.get('/api/categories', async (req, res) => {
    try {
        const type = req.query.type;
        const result = type === 'physical' || type === 'service'
            ? await query('SELECT id,name,slug,category_type,parent_id FROM sx_categories WHERE is_active=true AND category_type=$1 ORDER BY sort_order,name', [type])
            : await query('SELECT id,name,slug,category_type,parent_id FROM sx_categories WHERE is_active=true ORDER BY category_type,sort_order,name');
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Categories failed:', error.message);
        return res.status(500).json({ error: 'Could not load categories.' });
    }
});
app.get('/api/listings', async (req, res) => {
    const type = req.query.type;
    if (type && !['physical', 'service'].includes(String(type)))
        return res.status(400).json({ error: 'Invalid listing type.' });
    try {
        const search = `%${String(req.query.search ?? '').trim().slice(0, 100)}%`;
        const values = [search];
        let typeClause = '';
        if (type) {
            values.push(type);
            typeClause = ` AND l.listing_type=$${values.length}`;
        }
        const result = await query(`SELECT l.id,l.title,l.description,l.price::text,l.listing_type,l.condition,l.images,l.created_at,c.name AS category_name,u.full_name AS seller_name,u.campus FROM sx_listings l JOIN sx_categories c ON c.id=l.category_id JOIN sx_sellers s ON s.id=l.seller_id JOIN sx_users u ON u.id=s.user_id WHERE l.status='active' AND c.is_active=true AND (l.title ILIKE $1 OR l.description ILIKE $1 OR c.name ILIKE $1 OR COALESCE(u.campus,'') ILIKE $1)${typeClause} ORDER BY l.created_at DESC LIMIT 60`, values);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Listings failed:', error.message);
        return res.status(500).json({ error: 'Could not load listings.' });
    }
});
app.post('/api/listings', requireAuth, async (req, res) => {
    const { title, description, category_id, listing_type, price, condition, stock } = req.body ?? {};
    if (!title || !description || !category_id || !['physical', 'service'].includes(listing_type) || !Number.isFinite(Number(price)) || Number(price) <= 0)
        return res.status(400).json({ error: 'Complete all listing fields and provide a valid price.' });
    try {
        const sellerResult = await query('SELECT id FROM sx_sellers WHERE user_id=$1', [req.auth.userId]);
        if (!sellerResult.rows[0])
            return res.status(403).json({ error: 'Create a seller account to publish listings.' });
        const categoryResult = await query('SELECT id FROM sx_categories WHERE id=$1 AND category_type=$2 AND is_active=true', [category_id, listing_type]);
        if (!categoryResult.rows[0])
            return res.status(400).json({ error: 'Choose a category that matches the listing type.' });
        const result = await query('INSERT INTO sx_listings (seller_id,title,description,category_id,listing_type,price,condition,stock) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,title,description,price::text,listing_type,condition,created_at', [sellerResult.rows[0].id, String(title).trim(), String(description).trim(), category_id, listing_type, Number(price), condition || null, Math.max(1, Number(stock) || 1)]);
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Create listing failed:', error.message);
        return res.status(500).json({ error: 'Could not publish listing.' });
    }
});
app.patch('/api/listings/:id', requireAuth, async (req, res) => {
    const { title, description, price, stock, status } = req.body ?? {};
    if (status && !['active', 'paused', 'removed'].includes(status))
        return res.status(400).json({ error: 'Invalid listing status.' });
    try {
        const seller = await query('SELECT id FROM sx_sellers WHERE user_id=$1', [req.auth.userId]);
        if (!seller.rows[0])
            return res.status(403).json({ error: 'Seller account required.' });
        const result = await query("UPDATE sx_listings SET title=COALESCE($3,title),description=COALESCE($4,description),price=COALESCE($5,price),stock=COALESCE($6,stock),status=COALESCE($7,status) WHERE id=$1 AND seller_id=$2 RETURNING id,title,description,price::text,stock,status", [req.params.id, seller.rows[0].id, title?.trim() || null, description?.trim() || null, price == null ? null : Number(price), stock == null ? null : Math.max(0, Number(stock)), status || null]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Listing not found.' });
        return res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Update listing failed:', error.message);
        return res.status(500).json({ error: 'Could not update listing.' });
    }
});
app.delete('/api/listings/:id', requireAuth, async (req, res) => {
    try {
        const seller = await query('SELECT id FROM sx_sellers WHERE user_id=$1', [req.auth.userId]);
        if (!seller.rows[0])
            return res.status(403).json({ error: 'Seller account required.' });
        const result = await query("UPDATE sx_listings SET status='removed' WHERE id=$1 AND seller_id=$2 RETURNING id", [req.params.id, seller.rows[0].id]);
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
    if (!studentId)
        return res.status(400).json({ error: 'Student ID number is required.' });
    try {
        const seller = await query('SELECT id FROM sx_sellers WHERE user_id=$1', [req.auth.userId]);
        if (!seller.rows[0])
            return res.status(403).json({ error: 'Create a seller account before submitting verification.' });
        const result = await query("INSERT INTO sx_kyc_submissions (seller_id,student_id_number,note) VALUES ($1,$2,$3) RETURNING id,status,created_at", [seller.rows[0].id, studentId, String(req.body?.note ?? '').slice(0, 500) || null]);
        await query("UPDATE sx_sellers SET kyc_status='pending',student_id_number=$2 WHERE id=$1", [seller.rows[0].id, studentId]);
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('KYC submit failed:', error.message);
        return res.status(500).json({ error: 'Could not submit verification.' });
    }
});
app.get('/api/orders', requireAuth, async (req, res) => {
    try {
        const result = await query('SELECT o.id,o.status,o.total_amount::text,o.currency,o.created_at, u.full_name AS seller_name, ea.status AS escrow_status FROM sx_orders o JOIN sx_sellers s ON s.id=o.seller_id JOIN sx_users u ON u.id=s.user_id LEFT JOIN sx_escrow_accounts ea ON ea.order_id=o.id WHERE o.buyer_id=$1 OR s.user_id=$1 ORDER BY o.created_at DESC LIMIT 50', [req.auth.userId]);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Orders failed:', error.message);
        return res.status(500).json({ error: 'Could not load orders.' });
    }
});
app.post('/api/orders', requireAuth, async (req, res) => {
    const { listing_id, quantity = 1 } = req.body ?? {};
    const count = Math.max(1, Math.min(50, Number(quantity) || 1));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const found = await client.query('SELECT l.id,l.seller_id,l.price,l.stock,l.status,s.user_id FROM sx_listings l JOIN sx_sellers s ON s.id=l.seller_id WHERE l.id=$1 FOR UPDATE', [listing_id]);
        const listing = found.rows[0];
        if (!listing || listing.status !== 'active' || listing.user_id === req.auth.userId || listing.stock < count) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'This listing is unavailable or does not have enough stock.' });
        }
        const total = Number(listing.price) * count;
        const order = await client.query("INSERT INTO sx_orders (buyer_id,seller_id,status,total_amount,seller_payout_amount) VALUES ($1,$2,'pending_payment',$3,$3) RETURNING id,status,total_amount::text,currency", [req.auth.userId, listing.seller_id, total]);
        await client.query("INSERT INTO sx_order_items (order_id,listing_id,quantity,unit_price) VALUES ($1,$2,$3,$4)", [order.rows[0].id, listing.id, count, listing.price]);
        await client.query("INSERT INTO sx_escrow_accounts (order_id,held_amount,status) VALUES ($1,$2,'awaiting_payment')", [order.rows[0].id, total]);
        await client.query('UPDATE sx_listings SET stock=stock-$2 WHERE id=$1', [listing.id, count]);
        await client.query('COMMIT');
        return res.status(201).json({ order: order.rows[0], payment: { status: 'pending', message: 'Connect DPO Pay or MTN MoMo to complete payment.' } });
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
app.post('/api/orders/:id/confirm', requireAuth, async (req, res) => {
    try {
        const result = await query("UPDATE sx_orders SET status='completed' WHERE id=$1 AND buyer_id=$2 AND status IN ('paid','in_progress') RETURNING id,status", [req.params.id, req.auth.userId]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Order not found or not ready for receipt confirmation.' });
        return res.json({ ...result.rows[0], escrow: 'held_for_admin_release' });
    }
    catch (error) {
        console.error('Receipt confirmation failed:', error.message);
        return res.status(500).json({ error: 'Could not confirm receipt.' });
    }
});
app.post('/api/orders/:id/dispute', requireAuth, async (req, res) => {
    const reason = String(req.body?.reason ?? '').trim();
    const details = String(req.body?.details ?? '').trim();
    if (!reason || !details)
        return res.status(400).json({ error: 'Provide a reason and details for the dispute.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const order = await client.query('SELECT id,buyer_id,seller_id,status FROM sx_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
        const value = order.rows[0];
        if (!value || !['paid', 'in_progress', 'completed'].includes(value.status)) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'This order cannot be disputed.' });
        }
        const seller = await client.query('SELECT user_id FROM sx_sellers WHERE id=$1', [value.seller_id]);
        if (value.buyer_id !== req.auth.userId && seller.rows[0]?.user_id !== req.auth.userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Only people in this order can open a dispute.' });
        }
        const dispute = await client.query("INSERT INTO sx_disputes (order_id,raised_by,reason,details) VALUES ($1,$2,$3,$4) RETURNING id,status", [value.id, req.auth.userId, reason.slice(0, 180), details.slice(0, 4000)]);
        await client.query("UPDATE sx_orders SET status='disputed' WHERE id=$1", [value.id]);
        await client.query("UPDATE sx_escrow_accounts SET status='withheld',withheld_reason='Funds held while a dispute is reviewed',updated_at=now() WHERE order_id=$1 AND status IN ('held','withheld')", [value.id]);
        await client.query('COMMIT');
        return res.status(201).json(dispute.rows[0]);
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
app.post('/api/payments/:provider/start', requireAuth, async (req, res) => {
    const provider = String(req.params.provider);
    if (!['dpo', 'momo'].includes(provider))
        return res.status(400).json({ error: 'Choose DPO Pay or MTN MoMo.' });
    const orderId = String(req.body?.order_id ?? '');
    try {
        const order = await query("SELECT id,total_amount::text,currency FROM sx_orders WHERE id=$1 AND buyer_id=$2 AND status='pending_payment'", [orderId, req.auth.userId]);
        if (!order.rows[0])
            return res.status(404).json({ error: 'Payment order not found.' });
        const adapter = provider === 'dpo' ? createDpoCheckout() : createMomoCheckout();
        const payment = await query('INSERT INTO sx_payments (order_id,provider,status,amount) VALUES ($1,$2,$3,$4) RETURNING id,status,amount::text', [orderId, provider, 'pending', order.rows[0].total_amount]);
        return res.status(202).json({ payment: payment.rows[0], currency: order.rows[0].currency, checkout: adapter, next: 'No charge was initiated. Complete a real provider adapter before using live payment.' });
    }
    catch (error) {
        console.error('Payment start failed:', error.message);
        return res.status(500).json({ error: 'Could not start payment.' });
    }
});
app.post('/api/payments/:provider/webhook', async (req, res) => {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    const supplied = req.header('x-webhook-secret');
    if (!secret || !supplied || supplied !== secret)
        return res.status(401).json({ error: 'Invalid webhook credentials.' });
    const provider = String(req.params.provider);
    const { payment_id, status, provider_reference } = req.body ?? {};
    if (!['dpo', 'momo'].includes(provider) || status !== 'paid' || !payment_id)
        return res.status(400).json({ error: 'Invalid payment callback.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const found = await client.query('SELECT id,order_id,amount,status,provider FROM sx_payments WHERE id=$1 FOR UPDATE', [payment_id]);
        const payment = found.rows[0];
        if (!payment || payment.provider !== provider) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Payment not found.' });
        }
        if (payment.status === 'paid') {
            await client.query('COMMIT');
            return res.json({ status: 'already_processed' });
        }
        await client.query("UPDATE sx_payments SET status='paid',provider_reference=$2 WHERE id=$1", [payment.id, String(provider_reference ?? '').slice(0, 255) || null]);
        await client.query("UPDATE sx_orders SET status='paid' WHERE id=$1 AND status='pending_payment'", [payment.order_id]);
        await client.query("UPDATE sx_escrow_accounts SET status='held',held_amount=$2,updated_at=now() WHERE order_id=$1 AND status='awaiting_payment'", [payment.order_id, payment.amount]);
        await client.query("INSERT INTO sx_escrow_ledger (order_id,entry_type,amount,reason,balance_after) VALUES ($1,'credit',$2,'payment_received',$2)", [payment.order_id, payment.amount]);
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
        const result = await query("SELECT order_id,held_amount::text,status,withheld_reason,created_at FROM sx_escrow_accounts WHERE status IN ('held','withheld') ORDER BY created_at ASC");
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Escrow list failed:', error.message);
        return res.status(500).json({ error: 'Could not load escrow.' });
    }
});
app.get('/api/admin/kyc', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const result = await query('SELECT k.id,k.student_id_number,k.note,k.status,k.created_at,u.full_name,u.email,u.campus FROM sx_kyc_submissions k JOIN sx_sellers s ON s.id=k.seller_id JOIN sx_users u ON u.id=s.user_id ORDER BY k.created_at');
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
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const review = await client.query('UPDATE sx_kyc_submissions SET status=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$1 AND status=\'pending\' RETURNING seller_id,status', [req.params.id, status, req.auth.userId]);
        if (!review.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Pending verification request not found.' });
        }
        await client.query('UPDATE sx_sellers SET kyc_status=$2 WHERE id=$1', [review.rows[0].seller_id, status]);
        await client.query('COMMIT');
        return res.json({ id: req.params.id, status });
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
        const result = await query('INSERT INTO sx_categories (name,slug,category_type,parent_id) VALUES ($1,$2,$3,$4) RETURNING id,name,slug,category_type,parent_id', [String(name).trim(), String(slug).trim().toLowerCase(), category_type, parent_id || null]);
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
        const result = await query('UPDATE sx_categories SET name=COALESCE($2,name),slug=COALESCE($3,slug),is_active=COALESCE($4,is_active),parent_id=CASE WHEN $5 THEN $6 ELSE parent_id END WHERE id=$1 RETURNING id,name,slug,category_type,parent_id,is_active', [req.params.id, name?.trim() || null, slug?.trim().toLowerCase() || null, is_active ?? null, Object.prototype.hasOwnProperty.call(req.body, 'parent_id'), parent_id || null]);
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
        const result = await query('UPDATE sx_categories SET is_active=false WHERE id=$1 RETURNING id', [req.params.id]);
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
        const result = await query('SELECT d.id,d.order_id,d.reason,d.details,d.status,d.created_at,u.full_name AS raised_by FROM sx_disputes d JOIN sx_users u ON u.id=d.raised_by ORDER BY d.created_at');
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Disputes list failed:', error.message);
        return res.status(500).json({ error: 'Could not load disputes.' });
    }
});
app.post('/api/admin/disputes/:id/resolve', requireAuth, requireAdmin, async (req, res) => {
    const outcome = req.body?.outcome;
    const note = String(req.body?.note ?? '').trim();
    if (!['buyer', 'seller'].includes(outcome) || !note)
        return res.status(400).json({ error: 'Choose a resolution and provide a note.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const found = await client.query("SELECT d.order_id,o.seller_id,e.held_amount FROM sx_disputes d JOIN sx_orders o ON o.id=d.order_id JOIN sx_escrow_accounts e ON e.order_id=o.id WHERE d.id=$1 AND d.status='open' FOR UPDATE OF d,e", [req.params.id]);
        if (!found.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Open dispute not found.' });
        }
        const { order_id, seller_id, held_amount } = found.rows[0];
        if (outcome === 'seller') {
            await client.query("UPDATE sx_escrow_accounts SET status='released',held_amount=0,updated_at=now() WHERE order_id=$1", [order_id]);
            await client.query("INSERT INTO sx_escrow_ledger (order_id,entry_type,amount,reason,balance_after,admin_id) VALUES ($1,'debit',$2,'dispute_resolved_to_seller',0,$3)", [order_id, held_amount, req.auth.userId]);
            await client.query("INSERT INTO sx_payouts (seller_id,order_id,amount) VALUES ($1,$2,$3) ON CONFLICT (order_id) DO NOTHING", [seller_id, order_id, held_amount]);
            await client.query("UPDATE sx_orders SET status='completed' WHERE id=$1", [order_id]);
        }
        else {
            await client.query("UPDATE sx_escrow_accounts SET status='refunded',held_amount=0,updated_at=now() WHERE order_id=$1", [order_id]);
            await client.query("INSERT INTO sx_escrow_ledger (order_id,entry_type,amount,reason,balance_after,admin_id) VALUES ($1,'debit',$2,'dispute_refund_to_buyer',0,$3)", [order_id, held_amount, req.auth.userId]);
            await client.query("UPDATE sx_orders SET status='refunded' WHERE id=$1", [order_id]);
        }
        await client.query('UPDATE sx_disputes SET status=$2,resolution_note=$3,resolved_by=$4,resolved_at=now() WHERE id=$1', [req.params.id, outcome === 'buyer' ? 'resolved_buyer' : 'resolved_seller', note, req.auth.userId]);
        await client.query('COMMIT');
        return res.json({ status: outcome === 'buyer' ? 'resolved_buyer' : 'resolved_seller' });
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
app.get('/api/payouts', requireAuth, async (req, res) => {
    try {
        const seller = await query('SELECT id FROM sx_sellers WHERE user_id=$1', [req.auth.userId]);
        if (!seller.rows[0])
            return res.json([]);
        const result = await query('SELECT id,order_id,amount::text,status,provider_reference,created_at FROM sx_payouts WHERE seller_id=$1 ORDER BY created_at DESC', [seller.rows[0].id]);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Payout list failed:', error.message);
        return res.status(500).json({ error: 'Could not load payouts.' });
    }
});
app.get('/api/admin/payouts', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const result = await query('SELECT p.id,p.order_id,p.amount::text,p.status,p.provider_reference,p.created_at,u.full_name AS seller_name FROM sx_payouts p JOIN sx_sellers s ON s.id=p.seller_id JOIN sx_users u ON u.id=s.user_id ORDER BY p.created_at');
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
        const result = await query('UPDATE sx_payouts SET status=$2,provider_reference=$3,updated_at=now() WHERE id=$1 AND status=\'queued\' RETURNING id,status', [req.params.id, status, String(req.body?.provider_reference ?? '').slice(0, 255) || null]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Queued payout not found.' });
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
    try {
        const result = await query("UPDATE sx_escrow_accounts SET status='withheld',withheld_by_admin=true,withheld_reason=$2,updated_at=now() WHERE order_id=$1 AND status IN ('held','withheld') RETURNING order_id,status", [req.params.id, reason]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Held escrow was not found.' });
        return res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Escrow hold failed:', error.message);
        return res.status(500).json({ error: 'Could not withhold funds.' });
    }
});
app.post('/api/admin/escrow/:id/release', requireAuth, requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const escrow = await client.query("SELECT e.held_amount,o.seller_id,o.seller_payout_amount FROM sx_escrow_accounts e JOIN sx_orders o ON o.id=e.order_id WHERE e.order_id=$1 AND e.status IN ('held','withheld') FOR UPDATE OF e", [req.params.id]);
        if (!escrow.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Held escrow was not found.' });
        }
        await client.query("UPDATE sx_escrow_accounts SET status='released',held_amount=0,updated_at=now() WHERE order_id=$1", [req.params.id]);
        await client.query("INSERT INTO sx_escrow_ledger (order_id,entry_type,amount,reason,balance_after,admin_id) VALUES ($1,'debit',$2,'released_to_seller',0,$3)", [req.params.id, escrow.rows[0].held_amount, req.auth.userId]);
        await client.query("UPDATE sx_orders SET status='completed' WHERE id=$1", [req.params.id]);
        await client.query('INSERT INTO sx_payouts (seller_id,order_id,amount) VALUES ($1,$2,$3) ON CONFLICT (order_id) DO NOTHING', [escrow.rows[0].seller_id, req.params.id, escrow.rows[0].seller_payout_amount]);
        await client.query('COMMIT');
        return res.json({ status: 'released' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Escrow release failed:', error.message);
        return res.status(500).json({ error: 'Could not release escrow.' });
    }
    finally {
        client.release();
    }
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error, _req, res, _next) => { console.error('API error:', error.message); res.status(500).json({ error: 'Unexpected server error.' }); });
function signToken(userId, role) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
        throw new Error('JWT_SECRET must contain at least 32 characters.');
    return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
function publicUser(user) { return { id: user.id, email: user.email, full_name: user.full_name, campus: user.campus, role: user.role }; }
//# sourceMappingURL=app.js.map