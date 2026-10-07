// Checks a built APK with Android's own tools and writes its SHA-256 checksum next to it.
//   node verify-apk.mjs <path to .apk>
// Fails (exit 1) if the signature doesn't verify, or isn't Sentry's release key.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const apk = path.resolve(process.argv[2] ?? '');
if (!fs.existsSync(apk)) throw new Error(`No APK at ${apk}`);
if (!process.env.ANDROID_HOME || !process.env.JAVA_HOME) {
  throw new Error('Set JAVA_HOME and ANDROID_HOME first (see android/README.md).');
}
const TOOLS = path.join(process.env.ANDROID_HOME, 'build-tools', '36.1.0');
// Sentry's release key (also published in csentinel.com.ng/.well-known/assetlinks.json).
const RELEASE_CERT = '49153a2afd7957d86b5d720117d7d445e83c854680dea4e174b3a875d590d6a9';

const run = (exe, args) =>
  execFileSync(`"${path.join(TOOLS, exe)}"`, args.map((a) => (a.includes(' ') ? `"${a}"` : a)), {
    shell: true,
    encoding: 'utf8',
    env: process.env,
  });

const sig = run('apksigner.bat', ['verify', '--verbose', '--print-certs', apk]);
const badging = run('aapt2.exe', ['dump', 'badging', apk]);
const pick = (re) => re.exec(badging)?.[1] ?? '?';
const cert = /Signer #1 certificate SHA-256 digest: ([0-9a-f]+)/.exec(sig)?.[1];
const schemes = [...sig.matchAll(/Verified using (v\d(?:\.\d)?) scheme \(.*?\): (true|false)/g)].map((m) => `${m[1]} ${m[2]}`);
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
fs.writeFileSync(`${apk}.sha256`, `${sha256}  ${path.basename(apk)}\n`);

const result = {
  file: apk,
  sizeBytes: fs.statSync(apk).size,
  sha256,
  signatureVerifies: /^Verifies/m.test(sig),
  signatureSchemes: schemes.join(', '),
  signedWithSentryReleaseKey: cert === RELEASE_CERT,
  package: pick(/package: name='([^']+)'/),
  versionCode: pick(/versionCode='([^']+)'/),
  versionName: pick(/versionName='([^']+)'/),
  label: pick(/application-label:'([^']+)'/),
  launchableActivity: pick(/launchable-activity: name='([^']+)'/),
  minSdk: pick(/minSdkVersion:'([^']+)'/),
  targetSdk: pick(/targetSdkVersion:'([^']+)'/),
  permissions: [...badging.matchAll(/uses-permission: name='([^']+)'/g)].map((m) => m[1]),
};
console.log(JSON.stringify(result, null, 2));
if (!result.signatureVerifies || !result.signedWithSentryReleaseKey) {
  console.error('✗ Signature check failed');
  process.exit(1);
}
