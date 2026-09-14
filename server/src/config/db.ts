import { Pool } from 'pg';

const requiresSsl =
    process.env.NODE_ENV === 'production' ||
    process.env.DATABASE_URL?.includes('neon.tech') ||
    process.env.DATABASE_URL?.includes('sslmode=require');

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: requiresSsl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
    console.error('[pg-pool] Unexpected error on idle client:', err.message);
});