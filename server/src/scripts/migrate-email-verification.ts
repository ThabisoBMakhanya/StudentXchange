import '../config/env.js';
import { pool } from '../config/db.js';

try {
  // Existing accounts predate email verification and remain usable.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerified" boolean NOT NULL DEFAULT true`);
  await pool.query(`CREATE TABLE IF NOT EXISTS email_verification_tokens (
    "id" text PRIMARY KEY,
    "userId" text NOT NULL REFERENCES users("id") ON DELETE CASCADE,
    "tokenHash" text NOT NULL UNIQUE,
    "expiresAt" timestamptz NOT NULL,
    "usedAt" timestamptz,
    "createdAt" timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS email_verification_tokens_user_created_idx ON email_verification_tokens ("userId", "createdAt" DESC)`);
  // Existing admins were incorrectly marked verified by the original migration.
  // Require verification for them while leaving ordinary accounts untouched.
  await pool.query(`UPDATE users u SET "emailVerified"=false
    WHERE u."roles" @> ARRAY['ADMIN'::"Role"] AND u."emailVerified"=true
      AND NOT EXISTS (SELECT 1 FROM email_verification_tokens t WHERE t."userId"=u."id" AND t."usedAt" IS NOT NULL)`);
  console.log('Email verification migration complete. Existing admins require verification; ordinary accounts remain usable.');
} catch (error) {
  console.error('Email verification migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
