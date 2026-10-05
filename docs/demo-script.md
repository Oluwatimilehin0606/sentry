# Sentry demo: script and day-of checklist

For the AI Foundry final presentation. One presenter, slides plus a live demo of the online Sentry at **https://csentinel.com.ng**.

Built in blocks so it fits the slot: the **live demo is 5 minutes**; the slides take 3 minutes (short) or 5 minutes (full). Drop the slides marked *optional* first if time is tight.

## Slides (3–5 minutes)

1. **Title.** Sentry: a security check-up for small business websites, in plain English. Your name, @TheCyberSentinel, csentinel.com.ng.
2. **The problem.** Small businesses are the easiest targets online, but security tools are built for experts: dense reports, codes like CVE-2024-…, words like HSTS and CSP. A bakery owner can't act on that, so nobody checks until something goes wrong.
3. **Sentry in one sentence.** Type your website's address and in seconds get one grade, A to F, what each problem means for your business, and the one fix to do first. Free.
4. **How it works.** Check → grade and plain-English report → prove the website is yours → Sentry keeps watching every week and emails you if it gets worse.
5. **Safe by design** *(optional)*. Only public websites; deeper checks only after you prove ownership with a DNS record; every visitor limited so it can't be used to attack anyone; Sentry's own site scores an A.
6. **Built and online** *(optional)*. Live at csentinel.com.ng on free plans (Render, Neon, Resend, Cloudflare); about 185 automated tests; open source on GitHub.
7. **Next.** Hand-over to Qubators, PDF reports for consultants, and more checks (email security, WordPress).

## Live demo (5 minutes)

Have these open in browser tabs, in this order, before you start (see the checklist below):
**A.** https://csentinel.com.ng, signed in as the demo account · **B.** your Proton inbox · **C.** https://demo.csentinel.com.ng/.env

| Time | Do | Say |
|---|---|---|
| 0:00 | Tab A: the landing page. Let the example report play. | "This is Sentry, live on the internet right now." |
| 0:20 | **Home** → type `csentinel.com.ng` → **Check website**. | "First, Sentry checks itself. If we're going to tell people how to secure their site, ours had better pass." It scores an **A**. |
| 1:00 | **Websites** → **demo.csentinel.com.ng**. Point at the chart. | "Meet Mama Adunni's Bakery, a pretend business we set up. Sentry has checked it every week: an A for five weeks. Automatic checks are on, and so are email alerts." |
| 1:40 | Click **Run it now**. Wait for **A → F**. | "Yesterday her web developer pushed an update. Sentry's weekly check is due; let's run it now." The grade drops to **F**. |
| 2:10 | **See the report.** Open the top problem. | Read the plain-English title: **"Your private settings file is public."** Then *why it matters* and *how to fix it*. "No jargon. And the technical detail is in a separate box for her developer." |
| *(+0:20, optional)* | Click **Download PDF**; open the file. | "And she can download all of this as a report to hand to her developer, or her boss." Show the cover: grade, the three fixes to do first. |
| 3:00 | Tab C: show the exposed file. | "This is what anyone on the internet can download right now: her database password, her payment key. These ones are fake; on a real site they wouldn't be." |
| 3:30 | Tab B: the Proton inbox. Open the alert. | "And Mama Adunni didn't have to be watching. Sentry emailed her: *dropped from an A to an F*, what's new, and a button to the report." |
| 4:10 | Back to tab A. | "One grade. Plain English. The first fix to make. And a watchman that never sleeps. That's Sentry." |

**If something goes wrong:**
- **Site slow to load:** the free server was asleep. Keep talking through the slide; it wakes in about a minute.
- **"Run it now" fails or hangs:** open **Reports** and show an earlier F report, or switch to the backup recording.
- **Email late:** show the alert from the rehearsal (keep one in the inbox), and say "it usually lands within seconds".
- **No internet:** play the backup recording.

## Day-of checklist

**The day before**
- [ ] Run a full rehearsal on the live site, with a timer.
- [ ] Record the backup video of the live demo (screen recording, about 5 minutes).
- [ ] Keep one rehearsal alert email in the Proton inbox.

**One hour before**
- [ ] Reset the demo: in the Sentry folder run `npm run db:seed -- --online` (the demo website gets its A history back).
- [ ] Open https://csentinel.com.ng to wake the server, and sign in as the demo account (password in `.env.online`; close that file without saving).
- [ ] Open tabs A, B and C (above). Don't press **Run it now** until the demo.
- [ ] Laptop charged, notifications off, browser zoom about 125% so the back row can read it.
- [ ] Phone hotspot ready in case the venue Wi-Fi fails; the backup recording on the laptop itself, not only online.

**Five minutes before**
- [ ] Refresh tab A so the server is awake.
