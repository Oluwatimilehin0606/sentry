// Creates the dev and test databases named by DATABASE_URL (and <name>_test / sentry_test).
// Safe to run repeatedly. Needs a Postgres role with CREATEDB; see README "Database setup".
import { ensureDatabases, explainDatabaseError } from './lib/database.ts';

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

try {
  const devName = new URL(raw).pathname.slice(1) || 'sentry_dev';
  const testName = devName.endsWith('_dev') ? devName.replace(/_dev$/, '_test') : `${devName}_test`;
  await ensureDatabases(raw, [devName, testName]);
} catch (err) {
  console.error(`✗ ${explainDatabaseError(err)}`);
  process.exitCode = 1;
}
