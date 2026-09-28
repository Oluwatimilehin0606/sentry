import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env.ts';
import * as schema from './schema.ts';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 3000,
});

export const db = drizzle(pool, { schema });

/** True when the database answers a trivial query. */
export async function isDatabaseUp(): Promise<boolean> {
  try {
    await pool.query('select 1');
    return true;
  } catch {
    return false;
  }
}
