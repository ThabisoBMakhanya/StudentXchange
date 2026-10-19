import '../config/env.js';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

const categories = [
  ['Electronics','electronics','PHYSICAL',10],['Furniture and dorm','furniture-dorm','PHYSICAL',20],
  ['Clothing','clothing','PHYSICAL',30],['Books and stationery','books-stationery','PHYSICAL',40],
  ['Food and snacks','food-snacks','PHYSICAL',50],['Tutoring','tutoring','SERVICE',10],
  ['Design and printing','design-printing','SERVICE',20],['Delivery and moving','delivery-moving','SERVICE',30],
  ['Tech help','tech-help','SERVICE',40],['Beauty and care','beauty-care','SERVICE',50]
] as const;

try {
  for (const [name,slug,type,sortOrder] of categories) {
    await pool.query('INSERT INTO categories ("id","type","name","slug","updatedAt","sortOrder") VALUES ($1,$2::"ListingType",$3,$4,now(),$5) ON CONFLICT ("slug") DO NOTHING', [randomUUID(),type,name,slug,sortOrder]);
  }
  const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();const password=process.env.ADMIN_PASSWORD;
  if(email&&password){
    if(password.length<12)throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
    const hash=await bcrypt.hash(password,12);
    await pool.query(`INSERT INTO users ("id","fullName","email","phone","university","passwordHash","roles","status","emailVerified","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,ARRAY['CUSTOMER'::"Role",'ADMIN'::"Role"],'ACTIVE',false,now())
      ON CONFLICT ("email") DO UPDATE SET
        "passwordHash"=EXCLUDED."passwordHash",
        "emailVerified"=CASE WHEN users."roles" @> ARRAY['ADMIN'::"Role"] THEN users."emailVerified" ELSE false END,
        "roles"=CASE WHEN users."roles" @> ARRAY['ADMIN'::"Role"] THEN users."roles" ELSE array_append(users."roles",'ADMIN'::"Role") END,
        "status"='ACTIVE',
        "updatedAt"=now()`, [randomUUID(),'StudentXchange Admin',email,'','Eswatini',hash]);
    console.log(`Administrator account created or updated for ${email}.`);
  } else console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD to create or update an administrator account.');
  console.log('Physical-item and service category trees are ready.');
} catch(error) { console.error('Seed failed:',error);process.exitCode=1; }
finally { await pool.end(); }
