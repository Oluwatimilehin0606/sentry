import { useMutation } from '@tanstack/react-query';
import { AlertCircle, FileWarning, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DomainForm } from '@/components/DomainForm';
import { ScanReport } from '@/components/ScanReport';
import { runScan } from '@/lib/scan';

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
    comingNext: true,
  },
];

const GRADES = [
  { letter: 'A', range: '90–100', color: 'var(--grade-a)' },
  { letter: 'B', range: '80–89', color: 'var(--grade-b)' },
  { letter: 'C', range: '70–79', color: 'var(--grade-c)' },
  { letter: 'D', range: '60–69', color: 'var(--grade-d)' },
  { letter: 'F', range: '0–59', color: 'var(--grade-f)' },
];

export function HomePage() {
  const scan = useMutation({ mutationFn: runScan });
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scan.data) reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scan.data]);

  return (
    <div className="flex flex-col gap-16 py-12 sm:py-16">
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
          <DomainForm onSubmit={(domain) => scan.mutate(domain)} pending={scan.isPending} />

          {scan.isError && (
            <div
              role="alert"
              className="flex gap-3 rounded-lg border border-critical/30 bg-critical-soft p-4 text-[0.9375rem]"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
              <p>{scan.error.message}</p>
            </div>
          )}
        </section>

        {scan.data && (
          <div ref={reportRef} className="scroll-mt-6">
            <ScanReport report={scan.data} />
          </div>
        )}

        <section aria-labelledby="checks-h" className="flex flex-col gap-6">
          <h2 id="checks-h" className="font-display text-2xl font-bold tracking-tight">
            What Sentry checks
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {CHECKS.map(({ Icon, title, body, comingNext }) => (
              <article key={title} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {comingNext && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      Coming next
                    </span>
                  )}
                </div>
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
    </div>
  );
}
