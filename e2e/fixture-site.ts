// A deliberately weak pretend website for the browser test, served as https://bakery.test:8443
// (and plain HTTP on 8081) on this machine only. No security headers, plain HTTP not redirected,
// and a public .env file, so the full check has real problems to find.
import fs from 'node:fs';
import path from 'node:path';
import { startFixture } from '../server/test/fixture-server.ts';

export const E2E_HOST = 'bakery.test';
export const E2E_PORTS = { https: 8443, http: 8081 };
export const E2E_TMP = path.resolve(import.meta.dirname, '.tmp');

if (import.meta.main) {
  fs.mkdirSync(E2E_TMP, { recursive: true });
  const fixture = await startFixture({
    hostname: E2E_HOST,
    ports: E2E_PORTS,
    http: 'serve',
    files: { '/.env': { body: 'APP_KEY=base64:not-a-real-key\nDB_PASSWORD=not-a-real-password\n' } },
  });
  fs.writeFileSync(path.join(E2E_TMP, 'ca.pem'), fixture.ca);
  console.log(`Pretend website ready: https://${E2E_HOST}:${E2E_PORTS.https}`);
}
