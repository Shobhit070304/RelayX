import { Pool } from 'pg';
import { env } from './env';

const requiresSsl =
    env.DATABASE_URL.includes('neon.tech') ||
    env.DATABASE_URL.includes('sslmode=require') ||
    env.DATABASE_SSL;

export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: requiresSsl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
    console.error('[pg-pool] Unexpected error on idle client:', err.message);
});