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

**Requirements:** Node.js 24+ and npm 11+. (PostgreSQL 18 is needed from Phase 1 onwards.)

```bash
git clone https://github.com/Oluwatimilehin0606/sentry.git
cd sentry
npm install
npm run dev
```

Then open **http://localhost:5173**. The API runs on http://localhost:4000 (health check: `/api/health`), and the web app proxies `/api` to it. Copying `.env.example` to `.env` is optional for now; the defaults work.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the web app and API together |
| `npm test` | Runs the API tests |
| `npm run lint` | Checks code style |
| `npm run typecheck` | Type-checks client and server |
| `npm run build` | Builds the web app for production |

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