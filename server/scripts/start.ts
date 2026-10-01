// `npm start`: runs Sentry on this machine the production way. The API serves the built website
// on one port (http://localhost:3000), using its own database, sentry_demo, so demo accounts
// never mix with development data. The database is created and brought up to date on the way.
//
// Settings come from .env, then these demo defaults, then .env.demo (optional, never committed)
// for anything the demo should do differently, e.g. send real alert emails.
//
//   --pretend-site  also allow checks of bakery.test (run `npm run demo:site` alongside)
//   --open          open the browser once Sentry is ready
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { ensureDatabases, explainDatabaseError, migrateDatabase, withDatabase } from './lib/database.ts';

const { values: flags } = parseArgs({
  options: { 'pretend-site': { type: 'boolean' }, open: { type: 'boolean' } },
});

const root = path.resolve(import.meta.dirname, '../..');

/** A .env-style file in the project folder, or nothing if it isn't there. */
function envFile(name: string): Record<string, string | undefined> {
  const file = path.join(root, name);
  return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
}

const dotEnv = envFile('.env');
const demoEnv = envFile('.env.demo');
const port = demoEnv.API_PORT ?? '3000';
const devDatabaseUrl = dotEnv.DATABASE_URL ?? process.env.DATABASE_URL;
try {
  if (devDatabaseUrl) new URL(devDatabaseUrl);
} catch (err) {
  // Never print the address itself: it holds the database password.
  console.error(`✗ ${explainDatabaseError(err)}`);
  process.exit(1);
}

Object.assign(process.env, dotEnv, {
  NODE_ENV: 'production',
  API_PORT: port,
  APP_URL: `http://localhost:${port}`,
  // Same Postgres login as development, but the demo's own database.
  ...(devDatabaseUrl ? { DATABASE_URL: withDatabase(devDatabaseUrl, 'sentry_demo') } : {}),
  // The browser-test switches from .env are for development; the demo asks for them explicitly.
  SENTRY_E2E_SITES: flags['pretend-site']
    ? JSON.stringify({ 'bakery.test': { https: 8443, http: 8081, caFile: 'e2e/.tmp/ca.pem' } })
    : '',
  SENTRY_E2E_TXT_FILE: flags['pretend-site'] ? 'e2e/.tmp/txt.json' : '',
}, demoEnv);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

try {
  await ensureDatabases(databaseUrl, [new URL(databaseUrl).pathname.slice(1)]);
  await migrateDatabase(databaseUrl);
  console.log('✓ database is up to date');
} catch (err) {
  console.error(`✗ ${explainDatabaseError(err)}`);
  process.exit(1);
}

await import(pathToFileURL(path.join(root, 'server/src/index.ts')).href);

if (flags.open) void openWhenReady(process.env.APP_URL!);

/** Waits until Sentry answers, then opens it in the default browser. */
async function openWhenReady(url: string) {
  for (let tries = 0; tries < 60; tries++) {
    try {
      if ((await fetch(`${url}/api/health`)).ok) break;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
}
