const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env from the project root
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    const args = process.argv.slice(2);
    const targetFile = args[0];

    const allFiles = fs.readdirSync(__dirname)
        .filter(file => file.endsWith('.sql'))
        .sort();

    const filesToRun = targetFile ? [targetFile] : allFiles;

    if (filesToRun.length === 0) {
        console.log('ℹ️ No migration files found.');
        return;
    }

    if (!process.env.DATABASE_URL) {
        console.error('❌ Error: DATABASE_URL is not defined in the environment variables.');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        console.log('🔌 Connected to the database.');

        for (const file of filesToRun) {
            const filePath = path.join(__dirname, file);
            if (!fs.existsSync(filePath)) {
                console.error(`❌ Error: Migration file not found at: ${filePath}`);
                process.exit(1);
            }

            console.log(`📖 Running migration: ${file}...`);
            const sql = fs.readFileSync(filePath, 'utf8');

            await client.query('BEGIN');
            await client.query(sql);
            await client.query('COMMIT');
            console.log(`✅ [${file}] applied successfully.`);
        }

        console.log('🎉 All migrations applied!');
    } catch (err) {
        try {
            console.log('🔄 Error encountered. Rolling back transaction...');
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            console.error('❌ Rollback failed:', rollbackErr.message);
        }
        console.error('❌ Migration failed with error:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Connection closed.');
    }
}

runMigration();
