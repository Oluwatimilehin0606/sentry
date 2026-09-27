# Sentry

**Self-serve cyber-readiness assessment for small and medium-sized businesses (SMEs).**

Sentry scans a business's public-facing domain for common security gaps — SSL/TLS misconfigurations, missing HTTP security headers, and exposed sensitive paths — and translates the findings into a plain-English report with a single, easy-to-understand risk score.

Built under the AI Foundry (QAF 2.0) program by [@TheCyberSentinel](https://github.com/Oluwatimilehin0606), positioning it as an accessible entry point into security for people who have never had access to a security team.

## The Problem

SMEs are prime targets for opportunistic cyberattacks (phishing, ransomware, credential theft) but almost never run a security review before something goes wrong. Enterprise-grade tools (Nessus, Qualys, OWASP ZAP) are built for security professionals: dense reports, CVE codes, and severity ratings that mean nothing to a business owner.

> There is no low-cost, low-friction tool that tells a non-technical business owner, in plain language: *"Here's your risk level, here's why it matters, and here's what to fix first."*

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

Everything is free, open source and runs locally. Full details are in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

- **Language:** TypeScript on client and server
- **Frontend:** React 19 (Vite), Tailwind CSS v4, shadcn/ui
- **Backend:** Node.js / Express 5 API, zod, helmet, pino
- **Database:** PostgreSQL + Drizzle ORM — users, scan history, findings
- **Scanning:** Node built-ins (`tls`, `dns`, `fetch`) for SSL/TLS checks, HTTP header checks (CSP, HSTS, X-Frame-Options, etc.), and a rate-limited curated wordlist probe for exposed paths
- **Auth:** Better Auth — email + password, database-backed sessions in httpOnly cookies (revocable instantly, unlike a JWT)
- **Background jobs:** pg-boss (job queue stored in Postgres) for scans and scheduled re-scans

## Getting Started

_Project scaffold coming soon._

## Legal & Ethical Guardrails

- Only scans domains the user has verified ownership of (or explicit authorization to test).
- Rate-limited scanning to avoid resembling malicious reconnaissance.
- Clear terms of service establishing the user's responsibility to only scan domains they own.

## License

TBD