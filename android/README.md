# Sentry's Android app

`ng.com.csentinel.app` is a **Trusted Web Activity**: a thin Android shell that opens
[csentinel.com.ng](https://csentinel.com.ng) full-screen in Chrome. Every change to the website
reaches the app at once; a new APK is only needed for the app's own details (name, icon, colours,
start address) or a new Android version. Built with Google's [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).

- Needs the internet (offline it shows Sentry's "You're offline" page) and Chrome on the phone
  (without Chrome it opens in the phone's browser instead). No notifications: alerts are emails.
- Android 5.0 (API 21) and newer; built for Android 16 (API 36).
- Opens `/home`: signed-in people see Home, everyone else the sign-in page.

## The signing key (never in this repository)

Every version must be signed with the same key, or phones refuse it as an update. It lives outside
the repository, in `SENTRY_APK_DIR` (by default `Documents\Sentry APK`):

- `sentry-signing.keystore` (alias `sentry`)
- `signing-key-password.txt`

Back both up somewhere safe. Its public fingerprint is in
[client/public/.well-known/assetlinks.json](../client/public/.well-known/assetlinks.json); Android
checks it there before opening the app without an address bar.

## Building a new version (Windows)

1. One time: a Java 17 JDK and the Android SDK command-line tools, installed per user (no admin
   needed), with `platforms;android-36` and `build-tools;36.1.0`. On the original build machine they
   are in `%USERPROFILE%\Android\jdk17` and `%USERPROFILE%\Android\sdk`, which the script uses by
   default; otherwise set `JAVA_HOME` and `ANDROID_HOME`. (Bubblewrap also expects an empty `tools`
   folder in the SDK.)
2. Run `android\build-apk.cmd 1.0.2` with a version higher than the last one. The first build
   downloads Gradle (about 10 minutes); later ones take a few minutes.
3. It signs the APK, checks the signature with `apksigner` and the package with `aapt2`, and writes
   `output\sentry-1.0.2.apk` and its `.sha256` checksum in `SENTRY_APK_DIR`.
4. To publish it: copy it over `client/public/download/sentry.apk` and push. The download link
   https://csentinel.com.ng/download/sentry.apk serves it, and the landing page links to it.

On other systems, set the three variables and run `npm install`, `node build-apk.mjs 1.0.2` and
`node verify-apk.mjs <path to the apk>` in this folder.
