# Sentry

**Self-serve cyber-readiness assessment for small and medium-sized businesses (SMEs).**

Sentry scans a business's public-facing domain for common security gaps — SSL/TLS misconfigurations, missing HTTP security headers, and exposed sensitive paths — and translates the findings into a plain-English report with a single, easy-to-understand risk score.

Built under the AI Foundry (QAF 2.0) program by [@TheCyberSentinel](https://github.com/Oluwatimilehin0606), positioning it as an accessible entry point into security for people who have never had access to a security team.

## The Problem

SMEs are prime targets for opportunistic cyberattacks (phishing, ransomware, credential theft) but almost never run a security review before something goes wrong. Enterprise-grade tools (Nessus, Qualys, OWASP ZAP) are built for security professionals: dense reports, CVE codes, and severity ratings that mean nothing to a business owner.

> There is no low-cost, low-friction tool that tells a non-technical business owner, in plain language: *"Here's your risk level, here's why it matters, and here's what to fix first."*

## Current Status (28 Sep 2026)

**Phase 0 (27 Sep 2026): working local prototype**, plus an early preview of the scanner.

What works today, at http://localhost:5173 after `npm run dev`:

- Enter a domain and get a **real security check** in about a second: HTTPS availability, certificate validity and expiry, HTTP→HTTPS redirect, and six security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, server version leaks).
- A **score out of 100 and an A–F grade**, with every problem explained in plain English: what it is, why it matters, and how to fix it.
- **Safety built in:** Sentry refuses to scan private or internal addresses, checks every connection (not just the first lookup), never downloads page content, and rate-limits scans.
- Light and dark themes.

**Phase 1 (28 Sep 2026): accounts.**

- PostgreSQL 18 + Drizzle ORM with migrations; tables for users, sessions, domains, scans and findings.
- **Sign up, sign in and sign out** with Better Auth: 12+ character passwords stored as scrypt hashes, sessions in httpOnly cookies, login rate limiting, and a required "I will only scan websites I own" agreement recorded with the account.
- Protected pages and API routes (`/account`, `/api/me`), with sign-in redirecting back to where you were going.
- 47 automated tests, run against a separate test database.

**Landing page (28 Sep 2026).**

- Public landing page at `/`: hero with an example report, a "plain English, not jargon" comparison, how it works, what Sentry checks, safety, and a final call to action. Anyone can read it.
- Checking a website needs an account: the scanner lives at `/home` (signed in only), sign-up and sign-in land there, and the API refuses scans from signed-out visitors.
- Lighthouse on the production build: desktop 100 / 100 / 100 / 100; phone 100 for accessibility, best practices and SEO, and 86–98 for performance.
- Self-hosted fonts (no Google Fonts requests), pages load on demand, `robots.txt`, link-preview tags.
- Motion: the example report plays out like a live scan (checks tick off, score counts up to 72, grade and findings appear, "Run again" to replay); sections fade up on scroll; "How it works" draws a line through steps 1 → 2 → 3; a before → after reveal for the plain-English comparison; subtle hover effects; a faint heart-monitor wave behind the content that sweeps across the screen continuously, like a hospital monitor. No animation library, and anyone with "reduce motion" switched on gets the static page.

**Brand, sign-in and home redesign (29 Sep 2026).**

- New logo: a shield with a heartbeat drawn as an "S" (security, monitoring, and the S in Sentry).
- Sign-in and sign-up are a split screen: a deep-blue brand panel with a live heart-monitor trace, and a focused form; sign-up adds a password-strength meter. On phones the panel becomes a compact band.
- The signed-in home is a dashboard: greeting and a large check bar, recent checks (kept in the browser until scans are saved in Phase 5), the latest report, "Your next step" (the fix that raises the grade most), "Your websites" (coming soon) and how grades work. New account menu with theme and sign out.

**Next up (see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)):**

1. **Phase 2:** complete the scanner: exposed-file checks (`.env`, `.git`, backups) and TLS protocol checks.
2. **Phases 3–5:** domain ownership verification, saved reports, then the dashboard, scheduled re-scans and email alerts.

## Features

| Feature | Description |
|---|---|
| Domain input & scan | Scan SSL/TLS config, HTTP security headers, and common exposed paths (`.env`, `.git`, `/admin`, etc.) |
| Plain-English report | Each finding explained as what it is, why it matters, and how to fix it — no jargon, no CVE codes |
| Composite risk score | Single score (A–F grade / 0–100) summarizing overall cyber health |
| User accounts | Sign up / log in with scan history tied to the account |
| Dashboard | List of past scans per domain, score trend over time |
| Scheduled re-scans | Automatic weekly/monthly re-checks with score-drop alerts |

## Tech Stack

All free and open source, and runs locally with no cloud accounts or API keys.

- **Language:** TypeScript (client and server)
- **Frontend:** React 19 + Vite, React Router, TanStack Query, React Hook Form + zod
- **UI:** Tailwind CSS v4 + shadcn/ui, lucide-react icons, Recharts
- **Backend:** Node.js 24 + Express 5, zod, helmet, pino
- **Database:** PostgreSQL 18 with Drizzle ORM — users, domains, scan history, findings
- **Auth:** Better Auth (self-hosted) — email + password, database-backed sessions in httpOnly cookies
- **Background jobs:** pg-boss (Postgres-backed queue) for scans and scheduled re-scans
- **Scanning:** Node's built-in `tls`, `dns` and `fetch` — SSL/TLS checks, HTTP security headers (CSP, HSTS, X-Frame-Options, etc.), and a rate-limited curated wordlist probe for exposed paths
- **Email:** Nodemailer + React Email, caught locally by Mailpit
- **PDF export:** @react-pdf/renderer
- **Testing:** Vitest, Supertest, Playwright

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the full stack rationale and phased build plan.

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

Then open **http://localhost:5173**. The API runs on http://localhost:4000 (health check: `/api/health`), and the web app proxies `/api` to it.

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
| `npm run dev` | Starts the web app and API together |
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
| `npm run db:create` | Creates the dev and test databases (safe to re-run) |
| `npm run db:generate` | Generates a migration from schema changes |
| `npm run db:migrate` | Applies migrations to the dev database |
| `npm run db:studio` | Opens Drizzle Studio to browse the data |

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