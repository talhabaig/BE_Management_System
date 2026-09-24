const dotenv = require('dotenv');
const { Client } = require('pg');
const { execSync } = require('child_process');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres(connectionString) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await sleep(1000);
    }
  }
  throw lastError;
}

module.exports = async function globalSetup() {
  dotenv.config({ path: '.env.test', override: true, quiet: true });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.includes('test')) {
    throw new Error('DATABASE_URL must point at a test database');
  }

  const url = new URL(databaseUrl);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, '').split('?')[0] || '');
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error('Unsafe test database name');
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  await waitForPostgres(adminUrl.toString());

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
  }
  await client.end();

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
};
