import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/** Brings the test database up to the latest schema once, before any test file runs. */
export default async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('Refusing to run tests against a database whose name does not end in _test.');
  }

  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: path.resolve(import.meta.dirname, '../drizzle'),
    });
  } finally {
    await pool.end();
  }
}
