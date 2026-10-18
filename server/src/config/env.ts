import dotenv from 'dotenv';

// Local-only overrides first; the preserved Neon URL remains in server/.env.
dotenv.config({ path: '.env.local' });
dotenv.config();
