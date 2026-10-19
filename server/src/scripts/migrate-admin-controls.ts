import '../config/env.js';
import { pool } from '../config/db.js';

try {
  // Additive migration only: retain existing listings and transaction history.
  await pool.query(`ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW'`);
  await pool.query(`ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'REMOVED'`);
  await pool.query(`ALTER TABLE listings ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW'`);
  console.log('Admin controls migration complete. New listings now require admin approval.');
} catch (error) {
  console.error('Admin controls migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
