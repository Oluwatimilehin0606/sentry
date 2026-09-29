# Sentry — Implementation Plan

Derived from [Sentry_PRD.md](Sentry_PRD.md). Target: a working, demoable MVP within the one-month AI Foundry window (~4 weeks / 20 working days).

Each phase ends with a **concrete, checkable output**. Phases are ordered by dependency; later phases assume earlier outputs exist. Day ranges are guidance and overlap slightly.

---

## Tech Stack — Local-Only for Now

Every choice is the strongest **free, open-source** option for its job and runs on this machine with **no cloud accounts, API keys or paid tiers**. Already installed: Node v24, npm 11, PostgreSQL 18 (native, no Docker needed), Git.

| Layer | Choice | Why it's the best free option |
|---|---|---|
| Language | **TypeScript** on both sides | Catches bugs before they run and makes refactoring safe. Node 24 runs `.ts` files directly (type stripping), so the server needs no build step; `tsc --noEmit` does type checking. |
| Frontend | **React 19 + Vite**, React Router, **TanStack Query** (API data + scan-status polling), **React Hook Form** + zod (forms) | The standard modern React setup: fastest dev server, best-in-class data fetching and form handling. |
| UI | **Tailwind CSS v4 + shadcn/ui** (Radix-based accessible components), **lucide-react** icons, **Recharts** (via shadcn charts) | Polished, accessible components that are copied into the repo and fully owned — no paid UI kit, no lock-in. |
| Backend | **Node 24 + Express 5**, zod (validation), helmet (security headers), pino (logging) | Express is named in the PRD and has the largest ecosystem and documentation. Its speed gap vs. Fastify doesn't matter at this scale. |
| Database | **PostgreSQL 18** (native install) + **Drizzle ORM** with **drizzle-kit** migrations | Postgres is the best free relational database. Drizzle is TypeScript-native: the schema is code, queries are type-checked, and it stays close to plain SQL. |
| Authentication | **Better Auth** (self-hosted library), email + password, stored in our Postgres via its Drizzle adapter | The leading open-source TypeScript auth library. It gives secure httpOnly session cookies, password hashing (scrypt), built-in login rate limiting, and a path to email verification, password reset and 2FA later — without hand-rolling security code or paying Clerk/Auth0. |
| Background jobs & scheduling | **pg-boss** (job queue stored in Postgres) | Scans and scheduled re-scans survive server restarts, get retries and timeouts, and "one scan per domain at a time" is built in — all in the Postgres we already run, with no Redis. Replaces the in-process jobs + `node-cron` idea. |
| File storage | **Local disk** at `server/storage/` (gitignored), behind a small `storage` module (`save` / `read` / `remove`) | Only PDF export needs it. Running a local object store (MinIO etc.) would add setup for no benefit; the module boundary lets a free cloud bucket (Cloudflare R2) replace it later. |
| Email | **Nodemailer** → **Mailpit** (local mail catcher with a web inbox at `:8025`), templates in **React Email** | Mailpit is free and open source: every alert email lands in a real inbox UI and nothing is actually sent. React Email makes templates that render well in Gmail/Outlook. Falls back to writing `.eml` files if Mailpit isn't running. |
| Scanning | Node built-ins only: `tls`, `dns/promises`, `fetch` | No external scanning APIs, rate limits or keys. |
| PDF | **@react-pdf/renderer** (server-side) | Free and pure JS, reusing React skills; avoids Puppeteer's ~150MB Chromium download. |
| Testing | **Vitest** + Supertest (unit/API), **Playwright** (end-to-end in a real browser), local HTTPS fixture server with certs from `selfsigned` | The best free test runners for each level; Playwright proves the whole sign-up → scan → report flow works. |
| Tooling | npm workspaces, `concurrently`, ESLint (flat config + typescript-eslint), Prettier | `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck` from the repo root. |
| DB viewer | **pgAdmin 4** (bundled with the PostgreSQL installer) or Drizzle Studio (`npx drizzle-kit studio`) | Inspect tables and data without extra installs. |

**To install later (free):** Mailpit (single `.exe` from its GitHub releases, needed in Phase 7) and Playwright's test browsers (`npx playwright install`, needed in Phase 5).

**Deferred until we go online:** GitHub Actions CI, hosting, managed Postgres, a real email provider (e.g. Resend free tier), cloud file storage (Cloudflare R2 free tier). Each one plugs in through env vars or an existing module boundary, so no rewrite is needed.

---

## Decisions Locked In (resolving PRD open questions)

| Question | Decision | Reason |
|---|---|---|
| Report copy: templated vs. AI | **Templated** — one pre-written block per check ID | Deterministic, fast, no API cost, no hallucination risk in a security report. AI rewording can be a post-MVP layer. |
| Domain verification | **DNS TXT record** (`sentry-verify=<token>`) | Proves control of the domain itself; email confirmation only proves access to an inbox. |
| SSL/TLS scanning | **Node's built-in `tls` module** first; `sslyze` optional later | Avoids a Python runtime dependency on the server. `tls` covers cert validity, expiry, hostname, chain trust and protocol versions — enough for MVP. |
| Job execution | **pg-boss** queue in Postgres | Durable, retryable jobs with no Redis. Scan status is still mirrored in the `scans` table for the UI. |
| Auth tokens | **Database-backed sessions** in httpOnly cookies (Better Auth) instead of the PRD's JWT | Same cookie security as the PRD asks for, but sessions can be revoked instantly (logout everywhere, compromised account), which a JWT can't do before it expires. |
| Pricing | Out of scope for MVP | Prepare a one-slide answer for judging only. |

---

## Phase 0 — Project Scaffold (Days 1–2)

**Work**
- Monorepo layout: `client/` (Vite + React + TypeScript), `server/` (Node + Express + TypeScript), root `package.json` with workspaces and a shared `tsconfig.base.json`.
- Tailwind v4 + shadcn/ui initialised in the client, themed from [design.html](design.html): its light/dark colour tokens become the shadcn CSS variables (`--primary`, `--muted-foreground`, severity and grade colours), and its fonts are loaded from Google Fonts — **Bricolage Grotesque** (headings, grades, scores), **Public Sans** (body), **JetBrains Mono** (technical evidence).
- Create `sentry_dev` and `sentry_test` databases on the local PostgreSQL 18 install (`npm run db:create` script).
- Drizzle ORM + drizzle-kit wired up, plus a `db` module in the server.
- Env config via `.env` + `.env.example`, validated with zod at startup (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_URL`, `SMTP_URL`, `STORAGE_DIR`, `DEV_SCAN_ALLOWLIST`).
- Tooling: ESLint + typescript-eslint + Prettier, Vitest (server + client), Supertest for API tests.

**Output**
- `npm run dev` starts client (`:5173`) and server (`:4000`) together.
- `GET /api/health` returns `{ status: "ok", db: "ok" }`.
- `npm run lint`, `npm run typecheck` and `npm test` pass locally. README "Getting Started" section filled in.

---

> **Phase 0 status (2026-09-27): delivered as a "light" Phase 0** for the AI Foundry prototype submission (one working local page, no database required). The following Phase 0 items were **deferred and moved to the start of Phase 1** — they must be done before any Phase 1 work:
>
> - [x] Create a dedicated `sentry` Postgres role (user runs one command and chooses the password) and the `sentry_dev` / `sentry_test` databases (`npm run db:create`).
> - [x] Install and wire up Drizzle ORM + drizzle-kit (`drizzle.config.ts`, `server/src/db/` client module, empty schema, migration scripts).
> - [x] Add `DATABASE_URL` to `.env.example` and the zod env validation (and `BETTER_AUTH_SECRET`, needed by Phase 1 auth).
> - [x] Extend `GET /api/health` to report `db: "ok"` by running a real query, and update its test.
> - [x] Add `db:*` npm scripts (`db:create`, `db:generate`, `db:migrate`, `db:studio`) and document them in the README.
>
> **All deferred items completed on 2026-09-28** (PostgreSQL 18.4, tests run against `sentry_test`).
>
> **Pulled forward for the prototype demo** (from Phases 2, 3 and 5, no database needed): `POST /api/scan` running the SSRF guard (checked at connect time), HTTPS/certificate checks, the HTTP→HTTPS redirect check and the six header checks; the plain-English catalog and scoring for those checks; and the report UI (grade card, findings by severity, "What passed"). Still to do in those phases: the exposed-path probe, the TLS legacy-protocol check, saving scans, and the async job queue.

---

## Phase 1 — Database Schema & Authentication (Days 3–5)

**Work**
- **First, finish the deferred Phase 0 database items listed above.**
- Drizzle schema + migrations. Better Auth generates its own `user`, `session`, `account` and `verification` tables; Sentry's tables reference `user.id`:

  ```
  domains          (id, user_id FK, hostname, verify_token, verified_at,
                    rescan_interval ENUM[none,weekly,monthly], created_at,
                    UNIQUE(user_id, hostname))
  scans            (id, domain_id FK, status ENUM[queued,running,done,failed],
                    score INT, grade CHAR(1), error, started_at, finished_at,
                    trigger ENUM[manual,scheduled])
  findings         (id, scan_id FK, check_id, status ENUM[pass,fail],
                    severity ENUM[critical,medium,low,info], evidence JSONB)
  ```
- Better Auth mounted at `/api/auth/*` (email + password sign-up, sign-in, sign-out, get-session), with its built-in rate limiting on.
- Session cookie: `httpOnly; SameSite=Lax` (`Secure` once served over HTTPS). A `requireAuth` Express middleware reads the session for Sentry's own routes.
- Client: sign-up + sign-in pages (shadcn forms + React Hook Form + zod) using the Better Auth React client, and a protected-route wrapper.

**Output**
- Migrations apply cleanly to an empty database.
- API tests covering sign-up, duplicate email, wrong password, and a protected route with and without a session.

> **Phase 1 status (2026-09-28): done.** Better Auth 1.7.6 with the Drizzle adapter; migration `0000_init` creates the auth tables plus `domains`, `scans`, `findings`. Sign-up requires `acceptTerms: true` (enforced server-side in a Better Auth `before` hook) and records `terms_accepted_at`. `requireAuth` middleware + `GET /api/me`. Vitest global setup migrates `sentry_test` and refuses any database not ending in `_test`. Client: React Router 8, `/sign-up`, `/sign-in` (with safe `?next=` redirect), protected `/account`, header account controls. 47 tests pass; the whole flow was checked in the browser, including refresh, sign-out, wrong password and phone width.
>
> Notes for later: the header wraps to three rows at phone width (fold into the Phase 5 layout work); the health badge now needs two failed checks in a row before showing a problem.
- A user can sign up, log in, refresh the page and stay logged in, and log out — in the browser.

> **Between phases — brand and app redesign (2026-09-28 → 2026-09-29): done.** Public landing page at `/` (scanner moved behind sign-in; `POST /api/scan` now requires a session and is rate-limited per account), scroll motion and a heart-monitor background wave, the new two-tone shield-and-S logo from the owner's sketch (favicon too), split-screen sign-in/sign-up with a password-strength meter, and a signed-in dashboard at `/home` (check bar, recent checks, latest report, "Your next step", how grades work). Every visual change was approved as a mockup on the design canvas first. Client unit tests added with Vitest for domain checks, grading/next-step and password strength; `npm test` at the root runs server and client suites. Decisions are recorded in the PRD note of the same date.
>
> Carried into Phase 2: the landing page's "Exposed files" card still says "Coming next" — remove it when the exposed-path probe ships (mockup first).

---

## Phase 2 — Scanning Engine (Days 5–10)

The core of the product. Built as a **standalone library** in `server/src/scanner/`, testable without HTTP or a database.

**Work**
- **Target safety (do first):** normalize the hostname, resolve DNS and **reject private/loopback/link-local/metadata IPs** (SSRF guard). Don't follow redirects to other hosts. Total scan budget ≤ 60s.
- **`tlsCheck`** (Node `tls`):
  | Check ID | Severity |
  |---|---|
  | `tls.no_https` — port 443 unreachable / no TLS | critical |
  | `tls.cert_expired` | critical |
  | `tls.cert_untrusted` — self-signed / broken chain | critical |
  | `tls.hostname_mismatch` | critical |
  | `tls.cert_expiring_soon` — < 14 days | medium |
  | `tls.legacy_protocol` — TLS 1.0/1.1 accepted | medium |
  | `http.no_https_redirect` — plain HTTP doesn't redirect | medium |
- **`headerCheck`** (one GET to `https://host/`):
  | Check ID | Severity |
  |---|---|
  | `header.hsts_missing` | medium |
  | `header.csp_missing` | medium |
  | `header.xfo_missing` (no X-Frame-Options or `frame-ancestors`) | low |
  | `header.xcto_missing` | low |
  | `header.referrer_policy_missing` | low |
  | `header.server_version_leak` | low |
- **`pathProbe`** — curated wordlist (~20 paths), concurrency 2, ~200ms delay, HEAD/GET with 5s timeout:
  - Critical: `/.env`, `/.git/HEAD`, `/.git/config`, `/backup.zip`, `/db.sql`, `/dump.sql`, `/.htpasswd`, `/wp-config.php.bak`
  - Medium: `/phpinfo.php`, `/server-status`, `/phpmyadmin/`
  - Low/info: `/admin`, `/wp-admin/`, `/.DS_Store`
  - **False-positive guard:** request a random nonexistent path first to detect "soft 404" sites, and validate content (e.g. `.git/HEAD` must start with `ref:`, `.env` must contain `KEY=VALUE` lines).
- `scanDomain(hostname) → Finding[]` combining all three modules; each finding is `{ checkId, status, severity, evidence }`.
- Local **fixture server** for tests (configurable headers/paths/certs) — never test against real third-party sites in CI.

**Output**
- CLI: `npm run scan -- example.com` prints the normalized findings JSON.
- Unit tests for every check ID (pass and fail cases) against the fixture server.
- SSRF tests: `localhost`, `127.0.0.1`, `10.x`, `169.254.169.254` and a DNS name resolving to a private IP are all rejected.

---

## Phase 3 — Plain-English Catalog & Risk Scoring (Days 9–12)

**Work**
- `server/src/catalog/findings.ts` — one typed entry per check ID (TypeScript fails the build if a check ID has no entry):
  ```ts
  'header.hsts_missing': {
    title: 'Your site doesn’t force secure connections',
    whatItIs: '…',
    whyItMatters: '…',   // business impact, no jargon, no CVE codes
    howToFix: '…',       // concrete steps, plus common-platform notes (Nginx, Apache, Cloudflare, cPanel)
    severity: 'medium',
  }
  ```
- Scoring function (pure, fully tested):
  - Start at 100. Deduct **critical −30, medium −10, low −4**, info −0. Floor at 0.
  - Grade: **A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F < 60**.
  - **Any critical finding caps the grade at D**, so an exposed `.env` can never score a B.
- Summary line generator: *"Your site scored a C — 2 issues are putting you at risk. Fix these first: …"*

**Output**
- A test asserting **every check ID emitted by the scanner has a catalog entry** (prevents untranslated findings).
- Scoring tests covering boundaries and the critical cap.
- Copy reviewed once for reading level (aim for a non-technical reader; no acronyms without explanation).

---

## Phase 4 — Domain Management & Ownership Verification (Days 11–13)

**Work**
- `POST /api/domains` (add hostname → generates `verify_token`), `GET /api/domains`, `DELETE /api/domains/:id`.
- `POST /api/domains/:id/verify` — looks up TXT records on the hostname for `sentry-verify=<token>`; sets `verified_at`.
- Scans refused (403) for unverified domains.
- Client: "Add domain" flow with copy-paste TXT instructions (plus notes for common DNS providers) and a "Check verification" button.
- Terms of Service page + required checkbox at signup ("I will only scan domains I own or am authorized to test").

**Output**
- A real domain you control verified end-to-end through the UI.
- API tests: unverified scan blocked, wrong token rejected, another user's domain returns 404.

---

## Phase 5 — Scan API & Report UI (Days 13–17) — **MVP milestone**

**Work**
- `POST /api/domains/:id/scans` → creates a `queued` scan and a pg-boss job (singleton key = domain, so only one scan per domain runs at a time); returns the scan ID immediately. A pg-boss worker runs the engine and stores findings, score and grade.
- `GET /api/scans/:id` → status, score, grade, and findings joined with catalog copy, sorted by severity.
- Per-user scan limit (e.g. 10 manual scans/day).
- pg-boss job timeout (2 min) marks hung scans as `failed`; jobs queued before a restart still run afterwards.
- Client:
  - ~~**Landing page layout (deferred from the 2026-09-27 prototype)**~~ **Done 2026-09-28:** public landing page at `/` (two-column hero with example report card, plain-English comparison, how it works, checks, safety, CTA), built from the approved mockup (https://claude.ai/artifact/7P9Pw3amPMSG6rCrYo9NP6). The scanner moved to `/home` behind sign-in and `POST /api/scan` now requires a session (rate-limited per user). Lighthouse on the production build: desktop 100/100/100/100, phone 100 for A11y/BP/SEO and 86–98 for performance. Still open: the header wraps at phone width on signed-in pages; the phone performance score has room to improve (inline critical CSS, trim the ~56 KiB of unused JS in the main bundle, host with Brotli compression); `og:image` and `og:url` need to be added at deployment.
  - "Run Scan" button → progress state (polls every 2s).
  - **Report page:** large grade/score card with summary line; findings grouped Critical → Medium → Low, each expandable into *What it is / Why it matters / How to fix*; a collapsed "What passed" section.

**Output**
- **PRD success metric met:** sign up → add & verify domain → run scan → read report, working end-to-end in the browser.
- Scan of a real domain completes in under 2 minutes (target < 60s).
- A Playwright test runs the whole flow against a local fixture site.
- Tag `v0.1.0-mvp`.

---

## Phase 6 — Dashboard & History (Days 17–19)

**Work**
- `GET /api/domains/:id/scans` (paginated history).
- Dashboard: card per domain showing latest grade, last scanned time, verification status.
- Domain detail page: score trend line chart (Recharts) + table of past scans linking to each report.
- Scan-to-scan diff: "New since last scan" / "Fixed since last scan" badges on the report.

**Output**
- Dashboard with ≥ 2 domains and a trend chart built from ≥ 3 real scans.
- Diff logic unit-tested (new, fixed, unchanged findings).

---

## Phase 7 — Scheduled Re-scans & Email Alerts (Days 19–22)

**Work**
- Per-domain `rescan_interval` setting (none / weekly / monthly) in the UI.
- pg-boss cron schedule (hourly tick) picks due domains and queues scans with `trigger = scheduled`; staggered to avoid bursts.
- Email via Nodemailer to local Mailpit, with templates built in React Email. Alert when **the score drops** or **a new critical/medium finding appears**; include the grade change, new issues and a link to the report.
- Unsubscribe / alert toggle per user.

**Output**
- A scheduled scan runs automatically (verify with a short interval in dev).
- Alert email visible in the Mailpit inbox (`http://localhost:8025`) showing a simulated score drop.
- Scheduler logic unit-tested with a mocked clock.

---

## Phase 8 — Hardening & Demo Prep, Local (Days 22–26)

**Work**
- Security pass: `npm audit`, error handling without stack-trace leaks, CSRF check on cookie auth (Better Auth's trusted-origins check + SameSite), log redaction, `helmet` on Sentry's own responses.
- Local production build: `npm run build` + `npm start` serves the built client from Express on a single port, running against a separate `sentry_demo` database.
- `npm run db:seed` loads a demo user, domains and a few weeks of historical scans, so the dashboard and trend chart look real.
- Demo prep: a **local "bad site" fixture** (missing headers, dummy `.env`, self-signed cert) to show an F live, next to a real verified public domain scanned from this machine.

**Output**
- Full flow runs from the production build on one port, from a fresh clone, by following the README.
- Rehearsed 5-minute demo script and a backup recording.

**Deferred to going online:** hosting, managed Postgres, HTTPS for Sentry itself, and the "Sentry scans itself to an A" demo moment.

---

## Phase 9 — Stretch: PDF Export (Days 26–28, if time allows)

**Work**
- `GET /api/scans/:id/pdf` rendering the report with `@react-pdf/renderer`, cached through the `storage` module on local disk.
- "Download report" button; branded cover with grade and date — useful for the freelance-consultant persona.

**Output**
- Downloadable PDF matching the on-screen report.

---

## Timeline at a Glance

| Week | Phases | Milestone |
|---|---|---|
| 1 | 0, 1, start 2 | Auth working in the browser |
| 2 | 2, 3, 4 | `npm run scan` produces scored, translated findings; domains verifiable |
| 3 | 5, 6 | **End-to-end MVP** + dashboard |
| 4 | 7, 8, (9) | Alerts, local production build, demo-ready |

**Cut line if behind schedule:** Phases 0–5 + 8 are the minimum demo. Phase 6 shrinks to a plain history list, Phase 7 drops email (scheduled scans only), Phase 9 is skipped.

---

## Key Risks

| Risk | Mitigation |
|---|---|
| Scanner abused against third-party sites | DNS TXT verification before any scan, SSRF guard, rate limits, ToS acceptance. |
| False positives from "soft 404" sites | Baseline random-path request + content validation on sensitive paths. |
| Slow or hanging targets | Per-request timeouts, 60s total scan budget, `failed` status with a friendly message. |
| SSRF guard blocks scanning the local fixture sites | `DEV_SCAN_ALLOWLIST` env var (e.g. `localhost:8443`) that bypasses the private-IP check and verification **only** for listed hosts, and refuses to load when `NODE_ENV=production`. |
| Hosting provider blocks outbound probing (later) | Keep the probe small (~20 paths, low concurrency); confirm provider acceptable-use policy before deploying. |
| Demo domain behaves differently on the day | Pre-recorded backup + seeded historical scans. |
