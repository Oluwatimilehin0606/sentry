// Scans one domain from the command line and prints the report as JSON.
// Usage: npm run scan -- yourbakery.com   (only scan sites you own or may test)
import { normalizeHostname } from '../src/scanner/domain.ts';
import { scanHost } from '../src/scanner/scan.ts';
import { ScanTargetError } from '../src/scanner/target.ts';

const input = process.argv[2];
const hostname = input ? normalizeHostname(input) : null;
if (!hostname) {
  console.error('Usage: npm run scan -- yourbakery.com');
  process.exit(1);
}

try {
  console.log(JSON.stringify(await scanHost(hostname), null, 2));
} catch (err) {
  console.error(err instanceof ScanTargetError ? err.message : err);
  process.exit(1);
}
