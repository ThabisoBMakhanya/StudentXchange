import '../config/env.js';
import { pool } from '../config/db.js';

try {
  await pool.query(`ALTER TYPE "EscrowStatus" ADD VALUE IF NOT EXISTS 'SPLIT'`);
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS "momoReferenceId" text');
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS "momoPayerMsisdn" text');
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS "deliveredAt" timestamptz');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS orders_momo_reference_key ON orders ("momoReferenceId") WHERE "momoReferenceId" IS NOT NULL');
  await pool.query('ALTER TABLE payouts ADD COLUMN IF NOT EXISTS "momoReferenceId" text');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS payouts_momo_reference_key ON payouts ("momoReferenceId") WHERE "momoReferenceId" IS NOT NULL');
  await pool.query('ALTER TABLE audit_logs ALTER COLUMN "actorId" DROP NOT NULL');
  const orderIdTypeResult = await pool.query(`SELECT format_type(a.atttypid,a.atttypmod) AS type
    FROM pg_attribute a WHERE a.attrelid='orders'::regclass AND a.attname='id' AND NOT a.attisdropped`);
  const orderIdType = orderIdTypeResult.rows[0]?.type;
  if (!orderIdType) throw new Error('Could not determine the existing orders.id type.');
  await pool.query(`CREATE TABLE IF NOT EXISTS escrow_ledger (
    "id" uuid PRIMARY KEY,
    "orderId" ${orderIdType} NOT NULL REFERENCES orders("id"),
    "entryType" text NOT NULL CHECK ("entryType" IN ('credit','debit')),
    "amount" numeric(12,2) NOT NULL CHECK ("amount" > 0),
    "reason" text NOT NULL,
    "balanceAfter" numeric(12,2) NOT NULL CHECK ("balanceAfter" >= 0),
    "idempotencyKey" text NOT NULL UNIQUE,
    "providerReference" text,
    "createdAt" timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS escrow_ledger_order_created_idx ON escrow_ledger ("orderId", "createdAt")');
  await pool.query(`INSERT INTO escrow_ledger ("id","orderId","entryType","amount","reason","balanceAfter","idempotencyKey")
    SELECT gen_random_uuid(),o."id",'credit',o."total",'legacy_payment_migrated',o."total",'payment:'||o."id"
    FROM orders o WHERE o."escrowStatus" IN ('HELD','WITHHELD_BY_ADMIN','DISPUTED')
    ON CONFLICT ("idempotencyKey") DO NOTHING`);
  console.log('Payments engine migration complete.');
} catch (error) {
  console.error('Payments engine migration failed:', error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
