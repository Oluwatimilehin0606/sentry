// Creates the dev and test databases named by DATABASE_URL (and <name>_test / sentry_test).
// Safe to run repeatedly. Needs a Postgres role with CREATEDB; see README "Database setup".
import pg from 'pg';

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const url = new URL(raw);
const devName = url.pathname.slice(1) || 'sentry_dev';
const testName = devName.endsWith('_dev') ? devName.replace(/_dev$/, '_test') : `${devName}_test`;

const admin = new URL(url);
admin.pathname = '/postgres';

const client = new pg.Client({ connectionString: admin.href });

try {
  await client.connect();
  for (const name of [devName, testName]) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Refusing unusual database name: ${name}`);
    const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [name]);
    if (rowCount) {
      console.log(`✓ ${name} already exists`);
    } else {
      await client.query(`create database "${name}"`);
      console.log(`✓ created ${name}`);
    }
  }
} catch (err) {
  const e = err as NodeJS.ErrnoException & { code?: string };
  const hints: Record<string, string> = {
    '28P01':
      'Postgres rejected the login. Either the "sentry" user does not exist yet (run the CREATE ROLE command from the README), or the password in DATABASE_URL in .env is wrong.',
    '28000': 'That database user does not exist yet. Run the CREATE ROLE command from the README.',
    '42501': 'The database user is not allowed to create databases. It needs the CREATEDB option.',
    ECONNREFUSED: 'Postgres is not running on that host/port. Start the PostgreSQL service.',
  };
  console.error(`✗ ${hints[e.code ?? ''] ?? e.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
