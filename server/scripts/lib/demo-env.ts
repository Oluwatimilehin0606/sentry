import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { explainDatabaseError } from './database.ts';

/** The project folder. */
export const ROOT = path.resolve(import.meta.dirname, '../../..');

/** A .env-style file in the project folder, or nothing if it isn't there. */
export function envFile(name: string): Record<string, string | undefined> {
  const file = path.join(ROOT, name);
  return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
}

/**
 * Sets process.env up for the demo build, before anything reads it: .env, then production mode,
 * then .env.demo for anything the demo should do differently. Same address (APP_URL) and same
 * database as development, so the same accounts work on both.
 * Exits with a plain message if the settings can't work.
 */
export function useDemoSettings({ pretendSite = false } = {}): void {
  const dotEnv = envFile('.env');
  const demoEnv = envFile('.env.demo');

  Object.assign(
    process.env,
    dotEnv,
    {
      NODE_ENV: 'production',
      // The browser-test switches from .env are for development; the demo asks for them explicitly.
      SENTRY_E2E_SITES: pretendSite
        ? JSON.stringify({ 'bakery.test': { https: 8443, http: 8081, caFile: 'e2e/.tmp/ca.pem' } })
        : '',
      SENTRY_E2E_TXT_FILE: pretendSite ? 'e2e/.tmp/txt.json' : '',
    },
    demoEnv,
  );

  try {
    new URL(process.env.DATABASE_URL ?? '');
  } catch (err) {
    // Never print the address itself: it holds the database password.
    console.error(
      process.env.DATABASE_URL ? `✗ ${explainDatabaseError(err)}` : 'DATABASE_URL is not set. Copy .env.example to .env and fill it in.',
    );
    process.exit(1);
  }
}
