// `npm start`: runs Sentry on this machine the production way, serving the built website. Same
// address (http://localhost:5173) and database as `npm run dev`, so the same accounts work on
// both; only one of the two can run at a time. The database is brought up to date on the way.
//
// Settings come from .env, then the demo defaults, then .env.demo (optional, never committed)
// for anything the demo should do differently, e.g. send real alert emails.
//
//   --pretend-site  also allow checks of bakery.test (run `npm run demo:site` alongside)
//   --open          open the browser once Sentry is ready
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ensureDatabases, explainDatabaseError, migrateDatabase } from './lib/database.ts';
import { ROOT, useDemoSettings } from './lib/demo-env.ts';

const { values: flags } = parseArgs({
  options: { 'pretend-site': { type: 'boolean' }, open: { type: 'boolean' } },
});

useDemoSettings({ pretendSite: flags['pretend-site'] });
const databaseUrl = process.env.DATABASE_URL!;

try {
  try {
    await migrateDatabase(databaseUrl);
  } catch (err) {
    // On this machine the database may not exist yet (online, the host creates it).
    if ((err as { code?: string }).code !== '3D000') throw err;
    await ensureDatabases(databaseUrl, [new URL(databaseUrl).pathname.slice(1)]);
    await migrateDatabase(databaseUrl);
  }
  console.log('✓ database is up to date');
} catch (err) {
  console.error(`✗ ${explainDatabaseError(err)}`);
  process.exit(1);
}

await import(pathToFileURL(path.join(ROOT, 'server/src/index.ts')).href);

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
