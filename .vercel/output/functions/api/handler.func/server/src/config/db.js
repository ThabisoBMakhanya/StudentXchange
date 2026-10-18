import './env.js';
import { Pool } from 'pg';
if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL is required in the server environment.');
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
});
pool.on('error', (error) => console.error('Unexpected idle database connection error:', error.message));
export const query = pool.query.bind(pool);
//# sourceMappingURL=db.js.map