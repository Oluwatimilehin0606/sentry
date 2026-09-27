# Sentry — Product Requirements Document

**Product Name:** Sentry
**Program:** AI Foundry (QAF 2.0) — Qubators
**Owner:** Timilehin Onishola
**Status:** Draft v1.0

---

## 1. Overview

**Sentry** is a self-serve cyber-readiness assessment app built for small and medium-sized businesses (SMEs). It scans a business's public-facing domain for common security gaps — SSL/TLS misconfigurations, missing security headers, and exposed sensitive paths — and translates the findings into a plain-English report with a single, easy-to-understand risk score. It is built under the AI Foundry (QAF 2.0) program, which requires fellows to ship a functional app (not just a website) within one month.

Sentry is tied to the founder's existing cybersecurity education brand, @TheCyberSentinel, positioning it as an accessible entry point into security for people who have never had access to a security team.

---

## 2. Problem Statement

SMEs are prime targets for opportunistic cyberattacks (phishing, ransomware, credential theft) but almost never have a security review before something goes wrong. The tools that could catch these issues early — Nessus, Qualys, OWASP ZAP, etc. — are built for security professionals: dense reports, CVE codes, and technical severity ratings that mean nothing to a business owner. As a result, SMEs either pay for expensive consultants or, far more commonly, do nothing at all until they're breached.

There is no low-cost, low-friction tool that tells a non-technical business owner, in plain language: *"Here's your risk level, here's why it matters, and here's what to fix first."*

---

## 3. Goals

- Ship a working, demoable app within the AI Foundry's one-month window.
- Let any SME owner scan their own domain and receive an actionable, readable report in under two minutes.
- Differentiate from existing scanners through **plain-English translation**, not scan depth.
- Build something reusable as a portfolio piece and potential post-program product.

### Non-Goals (for MVP)
- Deep penetration testing (SQLi, XSS, authenticated scanning) — out of scope and legally risky without explicit authorization.
- Compliance certification (SOC 2, ISO 27001, PCI-DSS) — future roadmap only.
- Scanning internal/private network infrastructure — public-facing domains only.

---

## 4. Target Users

| User | Description | Need |
|---|---|---|
| SME owner/operator | Runs a small business, no in-house IT/security staff | Wants to know "am I at risk?" without needing to understand the answer technically |
| Freelance IT/web consultant | Manages websites for multiple small clients | Wants a fast, shareable report to justify security recommendations to clients |

---

## 5. Core Features (MVP Scope)

| # | Feature | Description | Priority |
|---|---|---|---|
| 1 | Domain input & scan | User enters a domain; app scans SSL/TLS config, HTTP security headers, and common exposed paths (`/.env`, `/.git`, `/admin`, etc.) | Must-have |
| 2 | Plain-English report | Each finding translated into: what it is, why it matters, how to fix it — no jargon, no CVE codes | Must-have |
| 3 | Composite risk score | Single score (e.g. A–F grade or 0–100) summarizing overall cyber health | Must-have |
| 4 | User accounts | Sign up / log in, scan history tied to account | Must-have |
| 5 | Dashboard | List of past scans per domain, score trend over time | Should-have |
| 6 | Scheduled re-scans | Automatic weekly/monthly re-checks | Should-have |
| 7 | Email alerts | Notify user when score drops or a new risk is detected | Should-have |
| 8 | PDF export | Downloadable/shareable version of the report | Nice-to-have |
| 9 | Domain ownership verification | DNS TXT record or email confirmation before scanning | Should-have |

---

## 6. User Flow

1. User lands on Sentry, signs up (email/password).
2. User enters a domain they own.
3. (Should-have) Domain ownership verification step.
4. User clicks "Run Scan."
5. Backend runs SSL check, header check, and path probe against the domain.
6. Raw findings are mapped to plain-English explanations and severity weights.
7. A composite risk score is calculated and displayed with a summary card ("Your site scored a C — here's what's putting you at risk").
8. Findings are listed in order of severity, each with a "why this matters" and "how to fix" section.
9. Scan is saved to the user's dashboard for future reference/comparison.

---

## 7. Technical Approach

**Suggested stack** (consistent with prior build experience — React/Vite + Node/Express + PostgreSQL):

- **Frontend:** React (Vite), dashboard + report UI
- **Backend:** Node.js/Express API
- **Database:** PostgreSQL — users, scan history, findings
- **Scanning logic:**
  - SSL/TLS: `sslyze` or equivalent library/CLI wrapped by the backend
  - HTTP headers: direct `curl`/HTTP client check against CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy (same header set already used in prior assessments)
  - Exposed paths: curated wordlist probe (`.env`, `.git`, `/admin`, `/backup`, etc.), rate-limited and scoped to avoid looking like an attack
- **Report translation:** templated copy per finding type (safer/faster than dynamic LLM generation for a one-month MVP) — each finding type maps to a pre-written plain-English block
- **Auth:** JWT in httpOnly cookies, bcrypt password hashing (matches prior project patterns)
- **Scheduled re-scans:** cron job or scheduled task triggering re-scans and diffing against the last result

> **Note — Tech stack update (2026-09-27): best free resources, local-only for now**
>
> Every tool below is free and open source and runs locally, with no cloud accounts, API keys or paid tiers. Full details are in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
>
> | Layer | Final choice | Changed from the suggestion above |
> |---|---|---|
> | Language | **TypeScript** (client and server; Node 24 runs `.ts` directly) | Not specified before |
> | Frontend | **React 19 + Vite**, React Router, TanStack Query, React Hook Form + zod | Same base, libraries added |
> | UI | **Tailwind CSS v4 + shadcn/ui**, lucide-react icons, Recharts | Not specified before |
> | Backend | **Node 24 + Express 5**, zod, helmet, pino | Unchanged |
> | Database | **PostgreSQL 18** (local install) + **Drizzle ORM** / drizzle-kit migrations | ORM added |
> | Auth | **Better Auth** (self-hosted library), email + password, **database-backed sessions in httpOnly cookies** | Replaces hand-built JWT + bcrypt. Sessions can be revoked instantly; a JWT stays valid until it expires |
> | Background jobs & scheduled re-scans | **pg-boss** (job queue stored in Postgres) | Replaces a plain cron job. Jobs survive restarts and retry on failure, with no Redis |
> | SSL/TLS scanning | Node's built-in **`tls`**, `dns`, `fetch` | Replaces `sslyze`, removing the Python dependency |
> | Report translation | **Templated copy** per finding type | Unchanged; open question on AI generation resolved as templated |
> | File storage | **Local disk** behind a storage module | Not specified before; swappable for Cloudflare R2 later |
> | Email | **Nodemailer → Mailpit** (local inbox), **React Email** templates | Not specified before |
> | PDF export | **@react-pdf/renderer** | Not specified before |
> | Testing | **Vitest**, Supertest, **Playwright** | Not specified before |
>
> **Deferred until the app goes online:** hosting, managed Postgres, CI, a real email provider (e.g. Resend free tier) and cloud file storage.

---

## 8. Risk Scoring Model (proposed)

| Finding Severity | Weight |
|---|---|
| Critical (e.g. exposed `.env`, exposed `.git`) | High deduction |
| Medium (missing HSTS, weak SSL config) | Moderate deduction |
| Low (missing minor header) | Small deduction |
| Pass | No deduction |

Composite score maps to a letter grade or 0–100 scale, displayed prominently as the single headline metric.

---

## 9. Legal/Ethical Guardrails

- Only scan domains the user has verified ownership of (or has explicit authorization to test).
- Rate-limit scanning to avoid resembling malicious reconnaissance.
- Clear terms of service establishing the user's responsibility to only scan domains they own.

---

## 10. Success Metrics (for AI Foundry evaluation)

- End-to-end functional: sign up → enter domain → receive report.
- Live, working demo scan against a real domain during presentation.
- Clear differentiation: plain-English framing for non-technical users, not scan depth.

---

## 11. Open Questions

- Domain verification method — DNS TXT record vs. email confirmation (TXT is more robust but adds friction).
- Whether report explanations are fully templated or partially AI-generated for variability.
- Pricing/monetization model post-program (not required for MVP, but likely to come up in judging).
