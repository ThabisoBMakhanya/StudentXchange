import '../config/env.js';
import { pool } from '../config/db.js';

try {
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS "dpoTransactionToken" text');
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS "dpoCompanyRef" text');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS orders_dpo_transaction_token_key ON orders ("dpoTransactionToken") WHERE "dpoTransactionToken" IS NOT NULL');
  console.log('DPO checkout migration complete.');
} catch (error) {
  console.error('DPO checkout migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
