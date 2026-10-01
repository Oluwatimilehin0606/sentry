// "Publishes" a verification line for the pretend website, as if it were added to its DNS.
// Usage: npm run demo:verify -- sentry-verify=0123456789abcdef
import fs from 'node:fs';
import path from 'node:path';
import { E2E_HOST, E2E_TMP } from './fixture-site.ts';

const value = process.argv[2]?.trim();
if (!value || !/^sentry-verify=[0-9a-f]{16}$/.test(value)) {
  console.error('Usage: npm run demo:verify -- sentry-verify=<the 16-character code shown on the page>');
  process.exit(1);
}
fs.mkdirSync(E2E_TMP, { recursive: true });
fs.writeFileSync(path.join(E2E_TMP, 'txt.json'), JSON.stringify({ [E2E_HOST]: [value] }));
console.log(`Published ${value} for ${E2E_HOST}. Now press "Check now" on the website's page.`);
