import dotenv from 'dotenv';
dotenv.config();

export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 5000,
    DATABASE_URL: process.env.DATABASE_URL || '',
    DATABASE_SSL: process.env.DATABASE_SSL === 'true',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
    WORKER_CONCURRENCY: Number(process.env.WORKER_CONCURRENCY) || 5,
    POLL_INTERVAL_MS: Number(process.env.POLL_INTERVAL_MS) || 2000,
};

export function validateEnv() {
    if (!env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required');
    }
}