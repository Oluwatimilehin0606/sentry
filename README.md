# Sentry

**Self-serve cyber-readiness assessment for small and medium-sized businesses (SMEs).**

Sentry scans a business's public-facing domain for common security gaps — SSL/TLS misconfigurations, missing HTTP security headers, and exposed sensitive paths — and translates the findings into a plain-English report with a single, easy-to-understand risk score.

Built under the AI Foundry (QAF 2.0) program by [@TheCyberSentinel](https://github.com/Oluwatimilehin0606), positioning it as an accessible entry point into security for people who have never had access to a security team.

## The Problem

SMEs are prime targets for opportunistic cyberattacks (phishing, ransomware, credential theft) but almost never run a security review before something goes wrong. Enterprise-grade tools (Nessus, Qualys, OWASP ZAP) are built for security professionals: dense reports, CVE codes, and severity ratings that mean nothing to a business owner.

> There is no low-cost, low-friction tool that tells a non-technical business owner, in plain language: *"Here's your risk level, here's why it matters, and here's what to fix first."*

## Current Status (5 Oct 2026)

**Live at [csentinel.com.ng](https://csentinel.com.ng).** All the planned features up to scheduled re-checks and email alerts are built, tested and online. What's left before the final presentation on 17 October is polish and demo preparation (see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), Phase 8).

What a business owner can do today:

- **Sign up** and check any website for free. The **light check** looks at the connection, the certificate and the browser protections; anyone can run it on any site.
- **Prove a website is theirs** by adding one DNS record, which unlocks the **full check**: it also looks for private files left public (settings files, `.git` folders, backups, debug and database-admin pages) and old encryption.
- Get **one grade (A–F) and a score out of 100**, with every problem explained in plain English: what it is, why it matters, how to fix it, and a "For your developer" box with the technical detail. The summary names the single fix that raises the grade most.
- See each website's **score over time** and **what changed since the last check** (new and fixed problems).
- Turn on **automatic weekly or monthly checks**, and get an **email alert** when a website gets worse. "Run it now" runs the automatic check straight away.

Built to be safe and private:

- Sentry only ever connects to public internet addresses (never private networks or cloud metadata), checking every connection, not just the first lookup. Full checks only run on websites the account has proved it owns.
- Passwords are stored as scrypt hashes, sessions live in httpOnly cookies, sign-in attempts and checks are rate-limited per person, and every change must come from Sentry's own pages.
- Strict security headers on Sentry itself, including a Content-Security-Policy with no inline scripts; it checks itself to an **A**.
- About 180 automated tests, plus a browser test that walks the whole journey in Chrome against a deliberately weak pretend website.

## Features

| Feature | Description |
|---|---|
| Light and full checks | HTTPS and certificate, redirect, six browser protections, server version leaks; plus (proven websites) old TLS versions and exposed private files |
| Plain-English report | Each finding explained as what it is, why it matters, and how to fix it, with technical evidence kept in a separate box for developers |
| Grade and score | One A–F grade and a 0–100 score; any critical problem caps the grade at D |
| Ownership proof | A DNS TXT record; proving a domain also covers its subdomains |
| History | Every check saved; score-over-time chart and "since your last check" changes for each website |
| Automatic checks and alerts | Weekly or monthly checks, an email when the grade drops or a new serious problem appears, and "Run it now" |

## Tech Stack

All free and open source; online it runs on free plans.

- **Language:** TypeScript (client and server), run directly by Node.js 24
- **Frontend:** React 19 + Vite, React Router, TanStack Query, React Hook Form + zod
- **UI:** Tailwind CSS v4 + shadcn/ui, lucide-react icons; the score chart is hand-built SVG
- **Backend:** Express 5, zod, helmet, pino; the website and API are one program on one address
- **Database:** PostgreSQL 18 with Drizzle ORM and migrations
- **Auth:** Better Auth (self-hosted): email and password, database-backed sessions in httpOnly cookies
- **Automatic checks:** a small scheduler inside the server; one database statement claims due websites, so two copies never check the same website twice
- **Scanning:** Node's built-in `tls`, `dns`, `http` and `https`
- **Email:** Nodemailer over SMTP: Resend online, the MailDev test inbox on this machine
- **Testing:** Vitest, Supertest, Playwright
- **Online:** Render (Sentry), Neon (database), Resend (email), Cloudflare (DNS)

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the phased build plan, with a status note on every phase.

## Design

[design.html](design.html) is the visual style guide — open it in a browser to see colours, typography, buttons and inputs in light and dark themes.

- **Fonts:** Bricolage Grotesque (headings, grades, scores), Public Sans (body), JetBrains Mono (technical evidence)
- **Colour:** one accent blue for actions; red, amber, slate and green reserved for finding severity

## Getting Started

**Requirements:** Node.js 24+, npm 11+ and PostgreSQL 18.

```bash
git clone https://github.com/Oluwatimilehin0606/sentry.git
cd sentry
npm install
npm run dev
```

Then open **http://localhost:5173**. Sentry is one program on that one address: the website and its API together (health check: `/api/health`). Website edits show at once.

### Database setup (one time)

Sentry needs PostgreSQL 18 running locally.

1. Copy `.env.example` to `.env` and set `BETTER_AUTH_SECRET` (the file shows how to generate one).
2. Create a `sentry` database user, choosing your own password (letters and numbers only). You'll be asked for your `postgres` superuser password:
   ```bash
   psql -U postgres -h localhost -c "CREATE ROLE sentry WITH LOGIN CREATEDB PASSWORD 'your-password-here';"
   ```
3. Put the same password into `DATABASE_URL` in `.env` (replace `CHANGE_ME`).
4. Create the `sentry_dev` and `sentry_test` databases, then create the tables:
   ```bash
   npm run db:create
   npm run db:migrate
   ```
   (Tests migrate `sentry_test` automatically.)

| Command | What it does |
|---|---|
| `npm run dev` | Starts Sentry for development at http://localhost:5173 (edits show at once) |
| `npm test` | Runs the API tests, then the website tests |
| `npm run test:e2e` | Walks the whole journey in Chrome (sign up, check, verify, full check, reports) against a pretend website, using the test database |
| `npm run mail` | Starts the local test inbox (MailDev) at http://localhost:1080; alert emails land there, never at real addresses |
| `npm run test-alert -w server` | Sends an example alert email to the test inbox |
| `npm run demo:site` / `npm run demo:verify -- sentry-verify=…` | Serves the pretend website bakery.test and "publishes" its verification line (see `.env.example`) |
| `npm run due-now -w server -- you@example.com` | Makes bakery.test due for an automatic check now, so the scheduler checks it within a minute (development only) |
| `npm run seed:history -w server -- you@example.com` | Adds four example past checks of yourbakery.example to an account, to try the score chart (development only) |
| `npm run scan -- yourbakery.com` | Scans one website from the command line and prints the report (only scan sites you own or may test) |
| `npm run lint` | Checks code style |
| `npm run typecheck` | Type-checks client and server |
| `npm run build` | Builds the web app for production |
| `npm start` | Runs the finished build of Sentry at the same address, http://localhost:5173 (build first) |
| `npm run demo` | `npm start` plus the pretend website bakery.test, and opens the browser (what **Start Sentry demo.cmd** runs) |
| `npm run db:create` | Creates the dev and test databases (safe to re-run) |
| `npm run db:generate` | Generates a migration from schema changes |
| `npm run db:migrate` | Applies migrations to the dev database |
| `npm run demo:test-email` | Sends one example alert email to the demo account's address (`DEMO_EMAIL`), through the demo's email settings |
| `npm run db:seed` | Adds (or replaces) the demo account, with websites that have weeks of history |
| `npm run db:studio` | Opens Drizzle Studio to browse the data |

### Running the demo (production build, one port)

On Windows, double-click **Start Sentry demo.cmd** in the project folder. It builds the website (about 30 seconds), starts Sentry at **http://localhost:5173** together with the pretend website bakery.test, and opens the browser. Close its window to stop everything.

The same by hand, on any system:

```bash
npm run build
npm start          # Sentry alone
npm run demo       # Sentry plus bakery.test, and opens the browser
```

- It's the same Sentry as `npm run dev`: same address, same database, same accounts. Only one of the two can run at a time; if the other is still running, it says so.
- It runs with `NODE_ENV=production`: the finished website with Sentry's full security headers, and automatic checks every minute. It brings the database up to date by itself.
- Settings come from `.env`. For anything the demo should do differently, create `.env.demo` (never committed) with just those lines, e.g. the real email service for alert emails (`SMTP_URL`, `MAIL_FROM`). Development keeps using `.env` alone.
- `npm run db:seed` fills the demo database with an account and websites that already have weeks of checks: bakery.test (an A for five weeks, so checking it live shows "A → F, 7 new"), two made-up `.example` businesses, and one website still waiting to be proven. Each run replaces the demo account with a fresh one (other accounts are left alone), so run it before each rehearsal. Put `DEMO_EMAIL=` (the address alert emails should reach) in `.env.demo` first; the password is made up and saved there as `DEMO_PASSWORD` if you don't set one.
- bakery.test only works while Sentry runs on this machine (`APP_URL` is localhost); the pretend-website switch refuses to start once Sentry is online.

### Putting Sentry online

Everything runs on free plans: **Render** runs Sentry (website and API together), **Neon** holds the database, **Resend** sends alert emails, and **Cloudflare** manages the domain's records. Only the domain itself costs money. Sign up for Render, Neon and Cloudflare with Sentry's own email account, not a personal one.

1. **Database (Neon):** create a project (region: Europe, e.g. Frankfurt) and copy its connection string (`postgres://…?sslmode=require`).
2. **Domain records (Cloudflare):** add the domain to Cloudflare (free plan) and change the domain's nameservers at the registrar to the two Cloudflare gives you.
3. **Sentry (Render):** New → **Blueprint** → choose this repository. Render reads `render.yaml` and asks for:
   - `APP_URL`: `https://sentry.<your domain>`
   - `DATABASE_URL`: the Neon connection string
   - `SMTP_URL`: `smtps://resend:<Resend API key>@smtp.resend.com:2465` (port 2465: Render's free plan blocks the usual email ports)
   - `MAIL_FROM`: `Sentry <alerts@<your domain>>` once the domain is verified in Resend (until then, `Sentry <onboarding@resend.dev>`, which only reaches the Resend account's own address)
   - `DEMO_SITE_HOST`: `demo.<your domain>`, the deliberately weak website for the demo, served by Sentry itself
   - `DEMO_EMAIL`: the demo account's email. That account gets **Reset demo** on its Account page, which puts the demo websites back to their starting history without the command line
4. **Addresses:** in Render, add both `sentry.<your domain>` and `demo.<your domain>` as custom domains. In Cloudflare, add the two CNAME records Render shows, with the cloud icon set to **DNS only** (grey), so Render can issue the HTTPS certificates.
5. **Email from your domain (Resend):** add the domain in Resend and the records it shows to Cloudflare. Then alerts can go to any address.
6. **Demo account:** create `.env.online` on your computer (never committed) with the Neon `DATABASE_URL`, `DEMO_SITE_HOST` and `DEMO_EMAIL`, then run `npm run db:seed -- --online`. The demo website gets five weeks of A grades, so "Run it now" on demo day shows "A → F". The password is saved in `.env.online`.
7. **Prove the demo website for real:** the first run prints a TXT record to add to the main domain in Cloudflare (Name `@`; on the main domain because `demo.` already has a CNAME record, and proving the main domain covers its subdomains). Add it, wait a few minutes and run the seed again: the demo website is then verified, and stays so on every later run.

Free Render services sleep after 15 minutes without visitors and take about a minute to wake: open Sentry a few minutes before presenting. Each `git push` to `main` deploys again by itself.

### Project layout

```
client/   React 19 + Vite + Tailwind v4 + shadcn/ui (the website)
server/   Node 24 + Express 5 (the API)
```

## Legal & Ethical Guardrails

- Only scans domains the user has verified ownership of (or explicit authorization to test).
- Rate-limited scanning to avoid resembling malicious reconnaissance.
- Clear terms of service establishing the user's responsibility to only scan domains they own.

## License

TBD