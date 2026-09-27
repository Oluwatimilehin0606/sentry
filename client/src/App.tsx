import { FileWarning, Info, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ApiStatus } from '@/components/ApiStatus';
import { DomainForm } from '@/components/DomainForm';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

const CHECKS = [
  {
    Icon: LockKeyhole,
    title: 'Secure connection',
    body: 'Is your site served over HTTPS with a valid, up-to-date certificate, so visitors’ details can’t be read on the way?',
  },
  {
    Icon: ShieldCheck,
    title: 'Browser protections',
    body: 'Does your site switch on the security settings browsers offer, like blocking fake copies of your pages inside other sites?',
  },
  {
    Icon: FileWarning,
    title: 'Exposed private files',
    body: 'Can anyone download files that should stay private, like password settings or database backups?',
  },
];

const GRADES = [
  { letter: 'A', range: '90–100', color: 'var(--grade-a)' },
  { letter: 'B', range: '80–89', color: 'var(--grade-b)' },
  { letter: 'C', range: '70–79', color: 'var(--grade-c)' },
  { letter: 'D', range: '60–69', color: 'var(--grade-d)' },
  { letter: 'F', range: '0–59', color: 'var(--grade-f)' },
];

export function App() {
  const [requested, setRequested] = useState<string | null>(null);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b py-4">
        <Logo />
        <div className="flex items-center gap-3">
          <ApiStatus />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-16 py-12 sm:py-16">
        <section className="flex max-w-2xl flex-col gap-6">
          <span className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
            Free security check-up for small businesses
          </span>
          <h1 className="font-display text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">
            Is your business website leaving the door open?
          </h1>
          <p className="max-w-[60ch] text-lg text-muted-foreground">
            Sentry checks your website’s security and explains what it finds in plain English: one
            grade, what each problem means for your business, and what to fix first.
          </p>
          <DomainForm onSubmit={setRequested} />

          {requested && (
            <div
              role="status"
              className="flex gap-3 rounded-lg border bg-primary-soft p-4 text-[0.9375rem]"
            >
              <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <p>
                <strong className="font-semibold">{requested}</strong> looks like a valid domain.
                The scanner is being built next. Soon this button will check its secure connection,
                browser protections and exposed files, then show your grade.
              </p>
            </div>
          )}
        </section>

        <section aria-labelledby="checks-h" className="flex flex-col gap-6">
          <h2 id="checks-h" className="font-display text-2xl font-bold tracking-tight">
            What Sentry checks
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {CHECKS.map(({ Icon, title, body }) => (
              <article key={title} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
                <span className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-[0.9375rem] text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="grades-h" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="grades-h" className="font-display text-2xl font-bold tracking-tight">
              One grade, easy to read
            </h2>
            <p className="text-muted-foreground">
              Your site gets a score out of 100. Any critical problem caps the grade at D.
            </p>
          </div>
          <div className="grid grid-cols-5 overflow-hidden rounded-lg border bg-card">
            {GRADES.map(({ letter, range, color }) => (
              <div
                key={letter}
                className="flex flex-col gap-0.5 border-l px-3 py-3.5 first:border-l-0"
                style={{ borderTop: `4px solid ${color}` }}
              >
                <span className="font-display text-3xl leading-none font-bold" style={{ color }}>
                  {letter}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums sm:text-[0.8125rem]">
                  {range}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t py-5 text-[0.8125rem] text-subtle-foreground">
        <span>Sentry prototype · AI Foundry (QAF 2.0)</span>
        <span>Only check websites you own or have permission to test.</span>
      </footer>
    </div>
  );
}
