import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/** The same Postgres server and login as `databaseUrl`, but another database. */
export function withDatabase(databaseUrl: string, name: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.href;
}

/** Creates each named database that doesn't exist yet, using the login in `databaseUrl`. */
export async function ensureDatabases(databaseUrl: string, names: string[]): Promise<void> {
  const client = new pg.Client({ connectionString: withDatabase(databaseUrl, 'postgres') });
  try {
    await client.connect();
    for (const name of names) {
      if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Refusing unusual database name: ${name}`);
      const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [name]);
      if (rowCount) {
        console.log(`✓ ${name} already exists`);
      } else {
        await client.query(`create database "${name}"`);
        console.log(`✓ created ${name}`);
      }
    }
  } finally {
    await client.end().catch(() => {});
  }
}

/** Brings a database up to the latest schema (safe to run every time). */
export async function migrateDatabase(databaseUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(import.meta.dirname, '../../drizzle') });
  } finally {
    await pool.end();
  }
}

/**
 * A plain-English explanation of a database error. Never the raw message for a failed connection,
 * since some drivers repeat the connection address (password included) in it.
 */
export function explainDatabaseError(err: unknown): string {
  const code = (err as { code?: string }).code ?? '';
  if (!code && err instanceof Error && err.message.startsWith('Refusing')) return err.message;
  const hints: Record<string, string> = {
    '28P01':
      'Postgres rejected the login. Either the "sentry" user does not exist yet (run the CREATE ROLE command from the README), or the password in DATABASE_URL in .env is wrong.',
    '28000': 'That database user does not exist yet. Run the CREATE ROLE command from the README.',
    '42501': 'The database user is not allowed to create databases. It needs the CREATEDB option.',
    ECONNREFUSED: 'Postgres is not running on that host/port. Start the PostgreSQL service.',
    ERR_INVALID_URL: 'DATABASE_URL in .env isn’t a valid address. URL-encode special characters in the password.',
  };
  return hints[code] ?? `The database step failed (${code || (err as Error).name}).`;
}
