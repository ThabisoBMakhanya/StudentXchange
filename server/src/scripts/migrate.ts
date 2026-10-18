import '../config/env.js';
import { pool } from '../config/db.js';

const schema = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS sx_users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(255) UNIQUE NOT NULL,
 phone VARCHAR(32), password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(255) NOT NULL,
 campus VARCHAR(255), role VARCHAR(24) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','seller','admin')),
 account_state VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (account_state IN ('active','pending_verification','suspended')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sx_sellers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID UNIQUE NOT NULL REFERENCES sx_users(id) ON DELETE CASCADE,
 student_id_number VARCHAR(120), momo_number VARCHAR(32), kyc_status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','approved','rejected')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sx_categories (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(140) NOT NULL, slug VARCHAR(160) UNIQUE NOT NULL,
 category_type VARCHAR(16) NOT NULL CHECK (category_type IN ('physical','service')),
 parent_id UUID REFERENCES sx_categories(id) ON DELETE SET NULL, sort_order INT NOT NULL DEFAULT 0,
 is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sx_listings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), seller_id UUID NOT NULL REFERENCES sx_sellers(id) ON DELETE CASCADE,
 title VARCHAR(180) NOT NULL, description TEXT NOT NULL, category_id UUID NOT NULL REFERENCES sx_categories(id),
 listing_type VARCHAR(16) NOT NULL CHECK (listing_type IN ('physical','service')),
 price NUMERIC(12,2) NOT NULL CHECK (price > 0), stock INT NOT NULL DEFAULT 1 CHECK (stock >= 0),
 condition VARCHAR(32), status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','sold','removed')),
 images JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sx_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), buyer_id UUID NOT NULL REFERENCES sx_users(id), seller_id UUID NOT NULL REFERENCES sx_sellers(id),
 status VARCHAR(28) NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','paid','in_progress','completed','disputed','cancelled','refunded')),
 total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0), platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
 seller_payout_amount NUMERIC(12,2) NOT NULL DEFAULT 0, currency VARCHAR(10) NOT NULL DEFAULT 'SZL',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sx_order_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES sx_orders(id) ON DELETE CASCADE,
 listing_id UUID NOT NULL REFERENCES sx_listings(id), quantity INT NOT NULL CHECK (quantity > 0), unit_price NUMERIC(12,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS sx_escrow_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID UNIQUE NOT NULL REFERENCES sx_orders(id) ON DELETE CASCADE,
 held_amount NUMERIC(12,2) NOT NULL DEFAULT 0, status VARCHAR(24) NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment','held','withheld','released','refunded')),
 withheld_by_admin BOOLEAN NOT NULL DEFAULT false, withheld_reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sx_escrow_ledger (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES sx_orders(id) ON DELETE CASCADE,
 entry_type VARCHAR(16) NOT NULL CHECK (entry_type IN ('credit','debit')), amount NUMERIC(12,2) NOT NULL,
 reason VARCHAR(100) NOT NULL, balance_after NUMERIC(12,2) NOT NULL, admin_id UUID REFERENCES sx_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sx_payments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES sx_orders(id) ON DELETE CASCADE,
 provider VARCHAR(16) NOT NULL CHECK (provider IN ('dpo','momo')), provider_reference VARCHAR(255),
 status VARCHAR(24) NOT NULL DEFAULT 'pending', amount NUMERIC(12,2) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sx_kyc_submissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), seller_id UUID NOT NULL REFERENCES sx_sellers(id) ON DELETE CASCADE,
 student_id_number VARCHAR(120) NOT NULL, note TEXT, status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 reviewed_by UUID REFERENCES sx_users(id), reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sx_disputes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID UNIQUE NOT NULL REFERENCES sx_orders(id) ON DELETE CASCADE,
 raised_by UUID NOT NULL REFERENCES sx_users(id), reason VARCHAR(180) NOT NULL, details TEXT NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved_buyer','resolved_seller')),
 resolution_note TEXT, resolved_by UUID REFERENCES sx_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS sx_payouts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), seller_id UUID NOT NULL REFERENCES sx_sellers(id), order_id UUID UNIQUE NOT NULL REFERENCES sx_orders(id),
 amount NUMERIC(12,2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','paid','failed')),
 provider_reference VARCHAR(255), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sx_listings_active_created ON sx_listings(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sx_listings_category ON sx_listings(category_id);
CREATE INDEX IF NOT EXISTS idx_sx_orders_buyer ON sx_orders(buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sx_orders_seller ON sx_orders(seller_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sx_kyc_pending ON sx_kyc_submissions(status,created_at);
CREATE INDEX IF NOT EXISTS idx_sx_disputes_open ON sx_disputes(status,created_at);
`;

try { await pool.query(schema); console.log('StudentXchange database schema is ready.'); }
catch (error) { console.error('Migration failed:', error); process.exitCode = 1; }
finally { await pool.end(); }
