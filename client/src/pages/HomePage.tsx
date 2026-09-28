import { useMutation } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DomainForm } from '@/components/DomainForm';
import { ScanReport } from '@/components/ScanReport';
import { useSession } from '@/lib/auth-client';
import { runScan } from '@/lib/scan';

const GRADES = [
  { letter: 'A', range: '90–100', color: 'var(--grade-a)' },
  { letter: 'B', range: '80–89', color: 'var(--grade-b)' },
  { letter: 'C', range: '70–79', color: 'var(--grade-c)' },
  { letter: 'D', range: '60–69', color: 'var(--grade-d)' },
  { letter: 'F', range: '0–59', color: 'var(--grade-f)' },
];

/** The signed-in home: check a website and read its report. */
export function HomePage() {
  const { data: session } = useSession();
  const scan = useMutation({ mutationFn: runScan });
  const reportRef = useRef<HTMLDivElement>(null);
  const firstName = session?.user.name.split(' ')[0];

  useEffect(() => {
    if (scan.data) reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scan.data]);

  return (
    <div className="flex flex-col gap-14 py-12 sm:py-16">
      <section className="flex max-w-2xl flex-col gap-5">
        <span className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
          {firstName ? `Welcome, ${firstName}` : 'Welcome'}
        </span>
        <h1 className="font-display text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">Check a website</h1>
        <p className="max-w-[60ch] text-lg text-muted-foreground">
          Enter a website you own. In a few seconds you’ll get a grade, what each problem means for your business, and
          what to fix first.
        </p>
        <DomainForm onSubmit={(domain) => scan.mutate(domain)} pending={scan.isPending} />

        {scan.isError && (
          <div role="alert" className="flex gap-3 rounded-lg border border-critical/30 bg-critical-soft p-4 text-[0.9375rem]">
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

      <section aria-labelledby="grades-h" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="grades-h" className="font-display text-2xl font-bold tracking-tight">
            How grades work
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
              <span className="text-xs text-muted-foreground tabular-nums sm:text-[0.8125rem]">{range}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
