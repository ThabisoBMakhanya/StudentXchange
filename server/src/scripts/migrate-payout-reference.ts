import '../config/env.js';
import { pool } from '../config/db.js';

try {
  await pool.query('ALTER TABLE payouts ADD COLUMN IF NOT EXISTS "providerReference" text');
  console.log('Payout reference migration complete.');
} catch (error) {
  console.error('Payout reference migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
