import '../config/env.js';
import { pool } from '../config/db.js';

try {
  await pool.query(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'HAND_TO_HAND'`);
  await pool.query(`ALTER TYPE "EscrowStatus" ADD VALUE IF NOT EXISTS 'COMPLETED'`);
  console.log('Hand-to-hand payment schema is ready.');
} catch (error) {
  console.error('Hand-to-hand payment migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
