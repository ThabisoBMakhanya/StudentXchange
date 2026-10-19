import '../config/env.js';
import { pool } from '../config/db.js';

// The existing Neon database is managed by Prisma and already owns public.*.
// Validate the supplied schema without creating, dropping, or rewriting tables.
const required = ['_prisma_migrations','audit_logs','categories','disputes','kyc_submissions','listings','orders','payouts','platform_settings','users'];
try {
  const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  const available = new Set(result.rows.map((row:any) => row.table_name));
  const missing = required.filter((name) => !available.has(name));
  if (missing.length) throw new Error(`Existing public schema is missing required tables: ${missing.join(', ')}`);
  const enums = await pool.query("SELECT typname FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e'");
  const availableEnums = new Set(enums.rows.map((row:any) => row.typname));
  const expectedEnums = ['Role','KycStatus','UserStatus','ListingType','ListingStatus','ItemCondition','EscrowStatus','PaymentMethod','DisputeStatus','PayoutStatus'];
  const missingEnums = expectedEnums.filter((name) => !availableEnums.has(name));
  if (missingEnums.length) throw new Error(`Existing public schema is missing required enums: ${missingEnums.join(', ')}`);
  console.log('Existing Neon public schema verified. No tables or data were modified.');
} catch (error) { console.error('Schema verification failed:', error); process.exitCode = 1; }
finally { await pool.end(); }
