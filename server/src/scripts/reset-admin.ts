import '../config/env.js';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

try {
  if (process.env.CONFIRM_ADMIN_PASSWORD_RESET !== 'YES') {
    throw new Error('Set CONFIRM_ADMIN_PASSWORD_RESET=YES to confirm this password reset.');
  }
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users ("id","fullName","email","phone","university","passwordHash","roles","status","emailVerified","updatedAt")
     VALUES ($1,'StudentXchange Admin',$2,'','Eswatini',$3,ARRAY['CUSTOMER'::"Role",'ADMIN'::"Role"],'ACTIVE',false,now())
     ON CONFLICT ("email") DO UPDATE SET
       "passwordHash"=EXCLUDED."passwordHash",
       "roles"=CASE WHEN users."roles" @> ARRAY['ADMIN'::"Role"] THEN users."roles" ELSE array_append(users."roles",'ADMIN'::"Role") END,
       "status"='ACTIVE',
       "emailVerified"=false,
       "updatedAt"=now()
     RETURNING "id"`,
    [randomUUID(), email, passwordHash]
  );

  console.log(`Admin password reset complete for ${email}.`);
  console.log(`Account ID: ${result.rows[0].id}`);
} catch (error) {
  console.error('Admin password reset failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
