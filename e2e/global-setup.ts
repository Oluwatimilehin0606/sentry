import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/** Up-to-date, empty test database and no "published" TXT records before the browser test. */
export default async function setup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) {
    throw new Error('Refusing to run browser tests against a database whose name does not end in _test.');
  }
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(import.meta.dirname, '../server/drizzle') });
    await pool.query('truncate table "user" cascade');
  } finally {
    await pool.end();
  }
  fs.rmSync(path.resolve(import.meta.dirname, '.tmp/txt.json'), { force: true });
}
