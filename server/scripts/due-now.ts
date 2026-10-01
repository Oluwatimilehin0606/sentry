// Makes the pretend website bakery.test due for an automatic check right now, for an account,
// after a good previous check, so the next scheduler run checks it and (it's weak) sends an alert.
// Needs `npm run demo:site`, `npm run mail`, and the SENTRY_E2E_* lines in .env. Development only.
// Usage: node --env-file=../.env scripts/due-now.ts you@example.com
import { and, eq } from 'drizzle-orm';
import { db, pool } from '../src/db/client.ts';
import { domains, user } from '../src/db/schema.ts';
import { newVerifyToken } from '../src/domains/verify.ts';
import { buildReport } from '../src/scanner/scan.ts';
import { saveScan } from '../src/scans/store.ts';

if (process.env.NODE_ENV === 'production') throw new Error('Development only.');
const email = process.argv[2];
if (!email) throw new Error('Usage: node --env-file=../.env scripts/due-now.ts you@example.com');
const HOST = 'bakery.test';

const [account] = await db.select().from(user).where(eq(user.email, email));
if (!account) throw new Error('No account with that email.');

// A good previous check (yesterday), so this one counts as "got worse".
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
await saveScan(
  account.id,
  buildReport({
    hostname: HOST,
    mode: 'full',
    scannedAt: yesterday,
    durationMs: 900,
    findings: [
      { checkId: 'tls.no_https', status: 'pass' },
      { checkId: 'header.hsts_missing', status: 'pass' },
      { checkId: 'header.csp_missing', status: 'pass' },
      { checkId: 'http.no_https_redirect', status: 'pass' },
      { checkId: 'path.env_exposed', status: 'pass' },
    ],
  }),
);

const settings = { verifiedAt: new Date(), rescanInterval: 'weekly' as const, nextCheckAt: new Date(Date.now() - 1000), alertsEnabled: true };
const [existing] = await db.select().from(domains).where(and(eq(domains.userId, account.id), eq(domains.hostname, HOST)));
if (existing) await db.update(domains).set(settings).where(eq(domains.id, existing.id));
else await db.insert(domains).values({ userId: account.id, hostname: HOST, verifyToken: newVerifyToken(), ...settings });
console.log(`${HOST} is due now; the scheduler checks it within a minute.`);
await pool.end();
