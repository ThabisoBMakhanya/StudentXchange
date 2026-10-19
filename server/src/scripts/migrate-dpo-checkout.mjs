import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });
dotenv.config();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in the server environment.');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
try {
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS "dpoTransactionToken" text');
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS "dpoCompanyRef" text');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS orders_dpo_transaction_token_key ON orders ("dpoTransactionToken") WHERE "dpoTransactionToken" IS NOT NULL');
  console.log('DPO checkout migration complete.');
} catch (error) {
  console.error('DPO checkout migration failed:', error?.code || error?.name || 'unknown', error?.message || String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
