import '../config/env.js';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

const categories = [
  ['Electronics','electronics','physical',10], ['Furniture and dorm','furniture-dorm','physical',20],
  ['Clothing','clothing','physical',30], ['Books and stationery','books-stationery','physical',40],
  ['Food and snacks','food-snacks','physical',50], ['Tutoring','tutoring','service',10],
  ['Design and printing','design-printing','service',20], ['Delivery and moving','delivery-moving','service',30],
  ['Tech help','tech-help','service',40], ['Beauty and care','beauty-care','service',50]
] as const;

try {
  for (const [name,slug,type,order] of categories) await pool.query('INSERT INTO sx_categories (name,slug,category_type,sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,category_type=EXCLUDED.category_type,sort_order=EXCLUDED.sort_order,is_active=true', [name,slug,type,order]);
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
    const hash = await bcrypt.hash(password, 12);
    await pool.query("INSERT INTO sx_users (email,password_hash,full_name,role,account_state) VALUES ($1,$2,'StudentXchange Admin','admin','active') ON CONFLICT (email) DO UPDATE SET role='admin',account_state='active',password_hash=EXCLUDED.password_hash", [email, hash]);
    console.log(`Admin bootstrap account configured for ${email}.`);
  } else console.log('No admin account created. Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env before seeding to bootstrap one.');
  console.log('Category trees seeded for physical items and services.');
} catch (error) { console.error('Seed failed:', error); process.exitCode = 1; }
finally { await pool.end(); }
