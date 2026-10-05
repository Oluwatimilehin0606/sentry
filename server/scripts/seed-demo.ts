// `npm run db:seed`: adds the demo account, with websites that already have weeks of checks, so
// the charts and lists look lived-in. Every run replaces the demo account (and only that account)
// with a fresh one, so it's safe to run before each rehearsal and on the day. Other accounts in the
// database are left alone. (Online, "Reset demo" on the demo account's Account page does the same
// for its websites without the command line.)
//
// The account's email and password come from .env.demo (DEMO_EMAIL, DEMO_PASSWORD). Use the
// address the email service can deliver to, so alert emails arrive. Without a password, one is
// made up and saved to .env.demo (never printed).
//
// The websites are in server/src/demo/websites.ts.
//
//   --online  fill online Sentry's database instead: settings from .env.online (never committed),
//             which holds the online DATABASE_URL, DEMO_SITE_HOST and the demo sign-in.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ensureDatabases, explainDatabaseError, migrateDatabase } from './lib/database.ts';
import { ROOT, envFile, useDemoSettings } from './lib/demo-env.ts';

const { values: flags } = parseArgs({ options: { online: { type: 'boolean' } } });
const SETTINGS = flags.online ? '.env.online' : '.env.demo';
if (flags.online && !fs.existsSync(path.join(ROOT, SETTINGS))) {
  console.error('✗ Create .env.online first (see README "Putting Sentry online").');
  process.exit(1);
}
useDemoSettings({ settings: SETTINGS });
const databaseUrl = process.env.DATABASE_URL!;

try {
  await ensureDatabases(databaseUrl, [new URL(databaseUrl).pathname.slice(1)]);
  await migrateDatabase(databaseUrl);
} catch (err) {
  console.error(`✗ ${explainDatabaseError(err)}`);
  process.exit(1);
}

// The demo account's sign-in, from .env.demo (made up and saved there if missing).
const demoEnv = envFile(SETTINGS);
const email = demoEnv.DEMO_EMAIL ?? 'demo@example.com';
let password = demoEnv.DEMO_PASSWORD;
if (!password) {
  password = crypto.randomBytes(12).toString('base64url');
  const file = path.join(ROOT, SETTINGS);
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const lines = [
    ...(before && !before.endsWith('\n') ? [''] : []),
    '# Sign-in for the demo account (made by `npm run db:seed`).',
    ...(demoEnv.DEMO_EMAIL ? [] : [`DEMO_EMAIL=${email}`]),
    `DEMO_PASSWORD=${password}`,
    '',
  ];
  fs.writeFileSync(file, before + lines.join('\n'));
  console.log(`✓ made up a password for the demo account and saved it in ${SETTINGS}`);
}

// Only now load the app's code, so it connects to the right database.
const load = <T>(file: string): Promise<T> => import(pathToFileURL(path.join(ROOT, 'server/src', file)).href);
const { eq } = await import('drizzle-orm');
const { db, pool } = await load<typeof import('../src/db/client.ts')>('db/client.ts');
const { user } = await load<typeof import('../src/db/schema.ts')>('db/schema.ts');
const { auth } = await load<typeof import('../src/auth.ts')>('auth.ts');
const { hasVerifyRecord, newVerifyToken, TXT_PREFIX } = await load<typeof import('../src/domains/verify.ts')>('domains/verify.ts');
const { mainDomain, plantDemoWebsites } = await load<typeof import('../src/demo/websites.ts')>('demo/websites.ts');

const DEMO_SITE = process.env.DEMO_SITE_HOST || 'bakery.test';

// Online, the demo website is verified only if its proof really is in DNS. It goes on the main
// domain: demo.<domain> points to the host with a CNAME record, which can't share its name with a
// TXT record, and proving the main domain covers its subdomains. The proof value is kept in
// .env.online, so seeding again never changes the record to add.
let demoVerified = true;
let demoToken = newVerifyToken();
if (flags.online) {
  demoToken = demoEnv.DEMO_VERIFY_TOKEN ?? demoToken;
  if (!demoEnv.DEMO_VERIFY_TOKEN) fs.appendFileSync(path.join(ROOT, SETTINGS), `DEMO_VERIFY_TOKEN=${demoToken}\n`);
  const main = mainDomain(DEMO_SITE);
  demoVerified = (await hasVerifyRecord(main, demoToken)).found;
  if (!demoVerified) {
    console.log(
      `! ${DEMO_SITE} isn't proven yet. In Cloudflare, add a TXT record to ${main}:\n` +
        `    Name: @    Content: ${TXT_PREFIX}${demoToken}\n` +
        '  then run this again (records can take a few minutes to show).',
    );
  }
}

try {
  // A fresh demo account each time (its websites and checks go with it); nobody else's is touched.
  await db.delete(user).where(eq(user.email, email));

  const signUp = await auth.api.signUpEmail({
    body: { name: 'Adunni', email, password, acceptTerms: true } as { name: string; email: string; password: string },
  });
  console.log(`✓ demo account: ${email} (password in ${SETTINGS})`);

  for (const site of await plantDemoWebsites(signUp.user.id, { demoSite: DEMO_SITE, demoToken, demoVerified })) {
    const history = site.grades.map((g) => `${g.grade} ${g.score}`).join(' → ');
    console.log(`✓ ${site.hostname}${site.verified ? '' : ' (not proven yet)'}${history ? `: ${history}` : ''}`);
  }
} catch (err) {
  const code = (err as { code?: string }).code;
  console.error(`✗ Seeding failed: ${code ? explainDatabaseError(err) : err instanceof Error ? err.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
