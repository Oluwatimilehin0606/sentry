# Sentry demo: script and day-of checklist

For the AI Foundry final presentation. One presenter, slides plus a live demo of the online Sentry at **https://csentinel.com.ng**.

Built in blocks so it fits the slot: the **live demo is 5 minutes**; the slides take 3 minutes (short) or 5 minutes (full). Drop the slides marked *optional* first if time is tight.

## Slides (3–5 minutes)

1. **Title.** Sentry: a security check-up for small business websites, in plain English. Your name, @TheCyberSentinel, csentinel.com.ng.
2. **The problem.** Most SMEs have no IT department. Checking their website's security means hiring an expert each time, so it happens rarely or never, while every website update can open a new hole. And when someone does check, the report is written for experts, not for the owner.
3. **Sentry in one sentence.** Regular, automated security check-ups of your website between expert assessments: one grade, A to F, in plain English, and a report you send to whoever built your site, so they know exactly what to patch.
4. **How it works.** Check → grade and plain-English report → prove the website is yours → Sentry checks it every week or month → if it finds a problem, you get an alert and **your developer gets the report** to fix it.
5. **Safe by design** *(optional)*. Only public websites; deeper checks only after you prove ownership with a DNS record; every visitor limited so it can't be used to attack anyone. Your account and data are protected too: email confirmed at sign-up, passwords from data breaches refused, and you can download or delete everything Sentry holds about you at any time. Sentry's own site scores an A.
6. **Built and online** *(optional)*. Live at csentinel.com.ng on free plans (Render, Neon, Resend, Cloudflare), installable on any phone, and an Android app; Google PageSpeed 95–100 for speed, accessibility, best practices and SEO; about 240 automated tests, run by GitHub on every change; open source on GitHub.
7. **Next.** Hand-over to Qubators; two-step sign-in; the Play Store; more checks (email security, WordPress).

## Live demo (5 minutes)

Have these open in browser tabs, in this order, before you start (see the checklist below):
**A.** https://csentinel.com.ng, signed in as the demo account · **B.** your Proton inbox · **C.** https://demo.csentinel.com.ng/.env · **D.** *(optional)* your Android phone with the Sentry app, signed in to the demo account · **E.** the demo developer's inbox (see the checklist)

| Time | Do | Say |
|---|---|---|
| 0:00 | Tab A: the landing page. Let the example report play. | "This is Sentry, live on the internet right now." |
| 0:20 | **Home** → type `csentinel.com.ng` → **Check website**. | "First, Sentry checks itself. If we're going to tell people how to secure their site, ours had better pass." It scores an **A**. |
| 1:00 | **Websites** → **demo.csentinel.com.ng**. Point at the chart. | "Meet Mama Adunni's Bakery, a pretend business we set up. Sentry has checked it every week: an A for five weeks. Automatic checks are on, and so are email alerts." |
| 1:40 | Click **Run it now**. Wait for **A → F**. | "Yesterday her web developer pushed an update. Sentry's weekly check is due; let's run it now." The grade drops to **F**, and the result line says the alert went to Adunni **and the report went to her developer**. |
| 2:10 | **See the report.** Open the top problem. | Read the plain-English title: **"Your private settings file is public."** Then *why it matters* and *how to fix it*. "No jargon. And the technical detail is in a separate box for her developer." |
| *(+0:20, optional)* | Click **Download PDF**; open the file. | "And she can download all of this as a report to hand to her developer, or her boss." Show the cover: grade, the three fixes to do first. |
| 3:00 | Tab C: show the exposed file. | "This is what anyone on the internet can download right now: her database password, her payment key. These ones are fake; on a real site they wouldn't be." |
| 3:30 | Tab B: the Proton inbox. Open the alert. | "And Mama Adunni didn't have to be watching. Sentry emailed her: *dropped from an A to an F*, what's new, and a button to the report." |
| *(+0:20)* | Tab E: the developer's inbox. Open *"Adunni asked you to fix … problems on demo.csentinel.com.ng"*. | "And at the same moment, her web developer got the fix list, with the full report attached. She doesn't need an IT department: Sentry tells the person who built the site exactly what to patch." |
| *(+0:20, optional)* | Hold up the phone **D**: open the Sentry app from the home screen. | "And it's in her pocket: the same Sentry as an Android app, from a link on our website." Show the same F report. |
| 4:10 | Back to tab A. | "One grade. Plain English. The first fix to make. And a watchman that never sleeps. That's Sentry." |

**If something goes wrong:**
- **Site slow to load:** the free server was asleep. Keep talking through the slide; it wakes in about a minute.
- **"Run it now" fails or hangs:** open **Reports** and show an earlier F report, or switch to the backup recording.
- **Email late:** show the alert from the rehearsal (keep one in the inbox), and say "it usually lands within seconds".
- **No internet:** play the backup recording.
- **Asked about privacy or security:** Account page: **Where you're signed in**, **Download my data**, **Delete account** (the demo account has no Delete button, on purpose).

## Day-of checklist

**The day before**
- [ ] Run a full rehearsal on the live site, with a timer.
- [ ] Give the demo website a developer whose inbox you can show (tab E, e.g. a second email account of yours): **Websites → demo.csentinel.com.ng → Your developer → Add your developer**, with "Send after automatic checks that find a problem" ticked. **Reset demo** keeps it.
- [ ] Record the backup video of the live demo (screen recording, about 5 minutes).
- [ ] Keep one rehearsal alert email in the Proton inbox.
- [ ] Android app ready: the APK (`Documents\Sentry APK\output\sentry-1.0.1.apk`, or https://csentinel.com.ng/download/sentry.apk) uploaded to the demo-day form, and the app installed on your phone and signed in to the demo account.
- [ ] The signing key and its password file backed up (see android/README.md).

**One hour before**
- [ ] Open https://csentinel.com.ng to wake the server, and sign in as the demo account (password in `.env.online`; close that file without saving).
- [ ] Reset the demo: **Account → Reset demo → Yes, reset** (the demo website gets its A history back). Do this after every rehearsal too.
- [ ] Open tabs A, B and C (above). Don't press **Run it now** until the demo.
- [ ] Laptop and phone charged, notifications off, browser zoom about 125% so the back row can read it.
- [ ] Phone hotspot ready in case the venue Wi-Fi fails; the backup recording on the laptop itself, not only online.

**Five minutes before**
- [ ] Refresh tab A so the server is awake.
