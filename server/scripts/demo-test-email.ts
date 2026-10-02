// `npm run demo:test-email`: sends one example alert email to the demo account's address
// (DEMO_EMAIL in .env.demo), through the demo's real email settings. Run it before presenting to
// be sure alerts will arrive. Never prints the email settings themselves.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { envFile, ROOT, useDemoSettings } from './lib/demo-env.ts';

useDemoSettings();
const to = envFile('.env.demo').DEMO_EMAIL;
if (!to) {
  console.error('✗ Put DEMO_EMAIL=<your address> in .env.demo first (see README "Running the demo").');
  process.exit(1);
}

// Only now load the app's code, so it uses the demo settings.
const load = <T>(file: string): Promise<T> => import(pathToFileURL(path.join(ROOT, 'server/src', file)).href);
const { alertEmail } = await load<typeof import('../src/email/alert.ts')>('email/alert.ts');
const { sendEmail } = await load<typeof import('../src/email/mailer.ts')>('email/mailer.ts');
const { env } = await load<typeof import('../src/env.ts')>('env.ts');

const email = alertEmail({
  hostname: 'bakery.test',
  interval: 'weekly',
  previous: { grade: 'A', score: 96 },
  current: { grade: 'F', score: 28, scannedAt: new Date().toISOString() },
  appeared: [
    { title: 'Your private settings file is public', severity: 'critical' },
    { title: 'Visitors aren’t moved to the secure version of your site', severity: 'medium' },
  ],
  reportUrl: `${env.APP_URL}/reports`,
  settingsUrl: `${env.APP_URL}/websites/bakery.test?alerts=off`,
  timeZone: env.APP_TIMEZONE,
});
const sent = await sendEmail({ to, ...email, subject: `[Test] ${email.subject}` });
console.log(
  sent
    ? `✓ Sent a test alert to ${to}. Check that inbox (and its spam folder).`
    : '✗ Not sent. Check SMTP_URL and MAIL_FROM in .env.demo (the line above says what the mail server answered).',
);
process.exit(sent ? 0 : 1);
