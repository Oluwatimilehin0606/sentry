// `npm run db:seed`: fills the demo database (sentry_demo, the one `npm start` uses) with a demo
// account and websites that already have weeks of checks, so the charts and lists look lived-in.
// Every run starts from empty, so it's safe to run before each rehearsal and on the day.
//
// The account's email and password come from .env.demo (DEMO_EMAIL, DEMO_PASSWORD). Use the
// address the email service can deliver to, so alert emails arrive. Without a password, one is
// made up and saved to .env.demo (never printed).
//
// The websites: bakery.test (the pretend website, which scores an F live: an A for weeks, then
// "something broke"), two made-up .example businesses with history, and one still to be proven.
// .example names can never exist on the internet, so nothing real ever gets checked.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureDatabases, explainDatabaseError, migrateDatabase } from './lib/database.ts';
import { ROOT, envFile, useDemoSettings } from './lib/demo-env.ts';

useDemoSettings();
const databaseUrl = process.env.DATABASE_URL!;
const databaseName = new URL(databaseUrl).pathname.slice(1);
// It empties the database first, so never anything but a demo one.
if (!databaseName.endsWith('_demo')) {
  console.error(`✗ Refusing to seed ${databaseName}: only a database whose name ends in _demo.`);
  process.exit(1);
}

try {
  await ensureDatabases(databaseUrl, [databaseName]);
  await migrateDatabase(databaseUrl);
} catch (err) {
  console.error(`✗ ${explainDatabaseError(err)}`);
  process.exit(1);
}

// The demo account's sign-in, from .env.demo (made up and saved there if missing).
const demoEnv = envFile('.env.demo');
const email = demoEnv.DEMO_EMAIL ?? 'demo@example.com';
let password = demoEnv.DEMO_PASSWORD;
if (!password) {
  password = crypto.randomBytes(12).toString('base64url');
  const file = path.join(ROOT, '.env.demo');
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const lines = [
    ...(before && !before.endsWith('\n') ? [''] : []),
    '# Sign-in for the demo account (made by `npm run db:seed`).',
    ...(demoEnv.DEMO_EMAIL ? [] : [`DEMO_EMAIL=${email}`]),
    `DEMO_PASSWORD=${password}`,
    '',
  ];
  fs.writeFileSync(file, before + lines.join('\n'));
  console.log('✓ made up a password for the demo account and saved it in .env.demo');
}

// Only now load the app's code, so it connects to the demo database.
const load = <T>(file: string): Promise<T> => import(pathToFileURL(path.join(ROOT, 'server/src', file)).href);
const { sql } = await import('drizzle-orm');
const { db, pool } = await load<typeof import('../src/db/client.ts')>('db/client.ts');
const { domains } = await load<typeof import('../src/db/schema.ts')>('db/schema.ts');
const { auth } = await load<typeof import('../src/auth.ts')>('auth.ts');
const { newVerifyToken } = await load<typeof import('../src/domains/verify.ts')>('domains/verify.ts');
const { buildReport } = await load<typeof import('../src/scanner/scan.ts')>('scanner/scan.ts');
const { saveScan } = await load<typeof import('../src/scans/store.ts')>('scans/store.ts');
const { CATALOG } = await load<typeof import('../src/scanner/catalog.ts')>('scanner/catalog.ts');
type CheckId = keyof typeof CATALOG;

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
/** `days` ago (negative: ahead), at a plausible time of day (minutes vary so the times don't look machine-made). */
const daysAgo = (days: number, hour = 10, minute = 0) => {
  const at = new Date(now - days * DAY);
  at.setHours(hour, minute, 0, 0);
  return at;
};

type Check = { daysAgo: number; failing: CheckId[]; trigger?: 'manual' | 'scheduled'; minute?: number };
type Site = {
  hostname: string;
  addedDaysAgo: number;
  verified: boolean;
  rescanInterval: 'none' | 'weekly' | 'monthly';
  nextCheckInDays?: number;
  checks: Check[];
};

const SITES: Site[] = [
  {
    // An A for weeks; live on the day it scores an F (missing protections, a public .env file).
    hostname: 'bakery.test',
    addedDaysAgo: 34,
    verified: true,
    rescanInterval: 'weekly',
    nextCheckInDays: 2,
    checks: [
      { daysAgo: 33, failing: ['header.csp_missing', 'header.xfo_missing', 'header.xcto_missing'], trigger: 'manual', minute: 12 },
      { daysAgo: 26, failing: ['header.csp_missing', 'header.xcto_missing'], minute: 14 },
      { daysAgo: 19, failing: ['header.xcto_missing'], minute: 9 },
      { daysAgo: 12, failing: [], minute: 17 },
      { daysAgo: 5, failing: ['header.server_version_leak'], minute: 11 },
    ],
  },
  {
    // Started with its settings file public; fixed it, then worked through the rest.
    hostname: 'lagoslaundry.example',
    addedDaysAgo: 41,
    verified: true,
    rescanInterval: 'weekly',
    nextCheckInDays: 3,
    checks: [
      {
        daysAgo: 40,
        failing: ['path.env_exposed', 'http.no_https_redirect', 'header.hsts_missing', 'header.csp_missing', 'header.xfo_missing', 'header.xcto_missing', 'header.referrer_policy_missing'],
        trigger: 'manual',
        minute: 31,
      },
      {
        daysAgo: 33,
        failing: ['http.no_https_redirect', 'header.hsts_missing', 'header.csp_missing', 'header.xfo_missing', 'header.xcto_missing', 'header.referrer_policy_missing'],
        minute: 33,
      },
      { daysAgo: 26, failing: ['header.csp_missing', 'header.xfo_missing', 'header.xcto_missing', 'header.referrer_policy_missing'], minute: 29 },
      { daysAgo: 19, failing: ['header.csp_missing', 'header.xcto_missing'], minute: 35 },
      { daysAgo: 12, failing: ['header.csp_missing', 'header.xcto_missing'], minute: 30 },
      { daysAgo: 5, failing: ['header.csp_missing', 'header.xcto_missing'], minute: 32 },
    ],
  },
  {
    // Checked monthly; a debug page went public for a while, then was taken down.
    hostname: 'mamaputkitchen.example',
    addedDaysAgo: 62,
    verified: true,
    rescanInterval: 'monthly',
    nextCheckInDays: 27,
    checks: [
      { daysAgo: 61, failing: ['header.hsts_missing', 'header.csp_missing', 'header.xcto_missing', 'header.server_version_leak'], trigger: 'manual', minute: 48 },
      { daysAgo: 31, failing: ['header.hsts_missing', 'header.csp_missing', 'header.xcto_missing', 'header.server_version_leak', 'path.debug_page_exposed'], minute: 51 },
      { daysAgo: 3, failing: ['header.hsts_missing', 'header.csp_missing', 'header.xcto_missing'], trigger: 'manual', minute: 46 },
    ],
  },
  {
    // Added yesterday; its ownership record isn't in place yet, so the "prove it's yours" steps show.
    hostname: 'adunnicakes.example',
    addedDaysAgo: 1,
    verified: false,
    rescanInterval: 'none',
    checks: [],
  },
];

const ALL_CHECKS = Object.keys(CATALOG) as CheckId[];

try {
  await db.execute(sql`truncate table "user" cascade`);

  const signUp = await auth.api.signUpEmail({
    body: { name: 'Adunni', email, password, acceptTerms: true } as { name: string; email: string; password: string },
  });
  const userId = signUp.user.id;
  console.log(`✓ demo account: ${email} (password in .env.demo)`);

  for (const site of SITES) {
    await db.insert(domains).values({
      userId,
      hostname: site.hostname,
      verifyToken: newVerifyToken(),
      verifiedAt: site.verified ? daysAgo(site.addedDaysAgo, 9, 50) : null,
      createdAt: daysAgo(site.addedDaysAgo, 9, 45),
      rescanInterval: site.rescanInterval,
      // At about the time of day of its earlier checks, like real automatic checks.
      nextCheckAt:
        site.nextCheckInDays === undefined ? null : daysAgo(-site.nextCheckInDays, 10, (site.checks.at(-1)?.minute ?? 0) + 2),
      alertsEnabled: true,
    });

    const scores: string[] = [];
    for (const check of site.checks) {
      const findings = ALL_CHECKS.map((checkId) => ({
        checkId,
        status: check.failing.includes(checkId) ? ('fail' as const) : ('pass' as const),
      }));
      const report = buildReport({
        hostname: site.hostname,
        mode: 'full',
        scannedAt: daysAgo(check.daysAgo, 10, check.minute ?? 0).toISOString(),
        durationMs: 8000 + Math.round(Math.random() * 4000),
        findings,
      });
      await saveScan(userId, report, check.trigger ?? 'scheduled');
      scores.push(`${report.grade} ${report.score}`);
    }
    console.log(`✓ ${site.hostname}${site.verified ? '' : ' (not proven yet)'}${scores.length ? `: ${scores.join(' → ')}` : ''}`);
  }
} catch (err) {
  const code = (err as { code?: string }).code;
  console.error(`✗ Seeding failed: ${code ? explainDatabaseError(err) : err instanceof Error ? err.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
