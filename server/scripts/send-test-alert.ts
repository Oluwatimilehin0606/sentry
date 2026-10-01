// Sends an example alert email through the real mail settings, to see it in the test inbox.
// Usage: npm run mail (in another terminal), then: npm run test-alert -w server
import { alertEmail } from '../src/email/alert.ts';
import { sendEmail } from '../src/email/mailer.ts';
import { env } from '../src/env.ts';

if (env.NODE_ENV === 'production') throw new Error('Development only.');

const email = alertEmail({
  hostname: 'yourbakery.example',
  interval: 'weekly',
  previous: { grade: 'B', score: 82 },
  current: { grade: 'D', score: 62, scannedAt: new Date().toISOString() },
  appeared: [
    { title: 'Browsers aren’t told to always use a secure connection', severity: 'medium' },
    { title: 'Visitors aren’t moved to the secure version of your site', severity: 'medium' },
  ],
  reportUrl: `${env.APP_URL}/reports`,
  settingsUrl: `${env.APP_URL}/websites/yourbakery.example?alerts=off`,
  timeZone: env.APP_TIMEZONE,
});
const sent = await sendEmail({ to: 'owner@yourbakery.example', ...email });
console.log(sent ? `Sent "${email.subject}". Open http://localhost:1080 to read it.` : 'Not sent: is `npm run mail` running?');
process.exit(sent ? 0 : 1);
