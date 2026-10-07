// Builds and signs Sentry's Android app from the live installable website.
//
//   node build-apk.mjs <version>            e.g. 1.0.2 (must be higher than the last release)
//   node build-apk.mjs <version> --sign-only  re-pack and sign what Gradle already built
//
// The app is a Trusted Web Activity: a thin Android shell that opens csentinel.com.ng full-screen
// in Chrome, so website changes reach it without a new version. Built with Google's Bubblewrap.
//
// Settings (environment variables; see README.md):
//   JAVA_HOME      a Java 17 JDK
//   ANDROID_HOME   an Android SDK with platforms;android-36 and build-tools;36.1.0
//   SENTRY_APK_DIR the folder holding the signing key, outside this repository. Default:
//                  <your Documents folder>\Sentry APK. It must contain sentry-signing.keystore and
//                  signing-key-password.txt; the Android project and the APK are made there too.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AndroidSdkTools, Config, ConsoleLog, JdkHelper, TwaGenerator, TwaManifest } from '@bubblewrap/core';

const need = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} first (see android/README.md).`);
  return value;
};
const JDK = need('JAVA_HOME');
const SDK = need('ANDROID_HOME');
const WORK = process.env.SENTRY_APK_DIR || path.join(os.homedir(), 'Documents', 'Sentry APK');
const PROJECT = path.join(WORK, 'android-project');
const KEYSTORE = path.join(WORK, 'sentry-signing.keystore');
const PASSWORD_FILE = path.join(WORK, 'signing-key-password.txt');
for (const file of [KEYSTORE, PASSWORD_FILE]) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}: the release signing key (never in the repository).`);
}

const VERSION_NAME = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(VERSION_NAME ?? '')) throw new Error('Give a version like 1.0.2');
// Android needs a whole number that goes up with every release: 1.0.0 → 10000, 1.2.3 → 10203.
const [major, minor, patch] = VERSION_NAME.split('.').map(Number);
const VERSION_CODE = major * 10000 + minor * 100 + patch;

const log = new ConsoleLog('sentry-apk');
const password = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();

// Start from the live website's manifest (name, colours, icons), then Sentry's Android details.
const twa = await TwaManifest.fromWebManifest('https://csentinel.com.ng/manifest.webmanifest');
Object.assign(twa, {
  packageId: 'ng.com.csentinel.app',
  host: 'csentinel.com.ng',
  name: 'Sentry',
  launcherName: 'Sentry',
  startUrl: '/home',
  navigationColor: twa.backgroundColor,
  enableNotifications: false,
  appVersionCode: VERSION_CODE,
  appVersionName: VERSION_NAME, // (the object's own name for the manifest's "appVersion")
  // Without Chrome (rare), open in the phone's browser tab instead of failing.
  fallbackType: 'customtabs',
  signingKey: { path: KEYSTORE, alias: 'sentry' },
  generatorApp: 'sentry-build-apk',
});
const problem = twa.validate();
if (problem) throw new Error(problem);
await twa.saveToFile(path.join(WORK, 'twa-manifest.json'));

// Quoted commands through the shell: .bat files only run that way on Windows, and the default
// folder name has a space. (Bubblewrap's own Gradle and signing helpers break on both.)
const quote = (a) => (a.includes(' ') ? `"${a}"` : a);
const run = (exe, args, options = {}) =>
  execFileSync(quote(exe), args.map(quote), { stdio: 'inherit', shell: true, ...options });

if (!process.argv.includes('--sign-only')) {
  fs.rmSync(PROJECT, { recursive: true, force: true });
  await new TwaGenerator().createTwaProject(PROJECT, twa, log);
  const config = new Config(JDK, SDK);
  const sdk = await AndroidSdkTools.create(process, config, new JdkHelper(process, config), log);
  if (!(await sdk.checkBuildTools())) await sdk.installBuildTools();
  const gradle = path.join(PROJECT, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  run(gradle, ['assembleRelease', '--stacktrace'], { cwd: PROJECT, env: sdk.getEnv() });
}

const tools = path.join(SDK, 'build-tools', '36.1.0');
const exe = (name) => path.join(tools, process.platform === 'win32' ? name : name.replace(/\.(exe|bat)$/, ''));
const unsigned = path.join(PROJECT, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
const aligned = path.join(PROJECT, 'app-release-aligned.apk');
const outputDir = path.join(WORK, 'output');
fs.mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, `sentry-${VERSION_NAME}.apk`);
run(exe('zipalign.exe'), ['-f', '-p', '4', unsigned, aligned]);
// The password reaches apksigner through an environment variable, never the command line.
run(exe('apksigner.bat'), ['sign', '--ks', KEYSTORE, '--ks-key-alias', 'sentry', '--ks-pass', 'env:SENTRY_KS_PASS',
  '--key-pass', 'env:SENTRY_KS_PASS', '--out', output, aligned], {
  env: { ...process.env, JAVA_HOME: JDK, SENTRY_KS_PASS: password },
});
console.log(`\n✓ ${output} (version ${VERSION_NAME}, code ${VERSION_CODE})`);
