import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Globe, Loader2, Radar } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CommandBar } from '@/components/CommandBar';
import { MonitorWave } from '@/components/MonitorWave';
import { ScanReport } from '@/components/ScanReport';
import { useSession } from '@/lib/auth-client';
import { GRADE_COLOR, nextStep } from '@/lib/grading';
import { loadRecentChecks, saveRecentCheck, type RecentCheck } from '@/lib/recent-checks';
import { runScan, type Grade, type ScanReport as Report } from '@/lib/scan';
import { cn } from '@/lib/utils';

const GRADES: { letter: Grade; min: string }[] = [
  { letter: 'A', min: '90+' },
  { letter: 'B', min: '80+' },
  { letter: 'C', min: '70+' },
  { letter: 'D', min: '60+' },
  { letter: 'F', min: '0–59' },
];

function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/* ---------- Sidebar ---------- */

function YourWebsites() {
  return (
    <section aria-labelledby="sites-h" className="flex flex-col gap-3.5 rounded-[14px] border border-dashed border-input bg-card p-5">
      <span className="grid size-[42px] place-items-center rounded-[10px] bg-primary-soft text-primary">
        <Globe className="size-[22px]" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 id="sites-h" className="font-display text-xl font-bold tracking-tight">
          Your websites
        </h2>
        <p className="text-[0.9375rem] text-muted-foreground">
          Add a website, prove you own it, and Sentry will re-check it every week and email you if the grade drops.
        </p>
      </div>
      <button
        type="button"
        disabled
        className="flex h-[42px] items-center justify-center gap-2 rounded-lg border bg-muted font-semibold text-muted-foreground"
      >
        Add website
        <span className="rounded-full bg-card px-1.5 py-px text-[0.6875rem] font-bold">Coming soon</span>
      </button>
    </section>
  );
}

function HowGradesWork({ current }: { current?: Grade }) {
  return (
    <section aria-labelledby="grades-h" className="flex flex-col gap-3 rounded-[14px] border bg-card p-5">
      <h2 id="grades-h" className="font-display text-lg font-bold tracking-tight">
        How grades work
      </h2>
      <div className="grid grid-cols-5 overflow-hidden rounded-[10px] border">
        {GRADES.map(({ letter, min }) => (
          <div
            key={letter}
            aria-current={letter === current ? 'true' : undefined}
            className={cn('border-l px-1.5 py-2 text-center first:border-l-0', letter === current && 'bg-muted')}
            style={{ borderTop: `3px solid ${GRADE_COLOR[letter]}` }}
          >
            <div className="font-display text-xl font-bold" style={{ color: GRADE_COLOR[letter] }}>
              {letter}
            </div>
            <div className="text-[0.6875rem] text-muted-foreground">{min}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Any critical problem caps the grade at D.</p>
    </section>
  );
}

function NextStepCard({ report }: { report: Report }) {
  const step = nextStep(report);
  return (
    <section aria-labelledby="next-h" className="flex flex-col gap-2.5 rounded-[14px] bg-[#0e2342] p-5 text-[#e6ebf3]">
      <h2 id="next-h" className="text-xs font-bold tracking-[0.08em] text-[#6ea2ee] uppercase">
        Your next step
      </h2>
      {step.kind === 'clear' ? (
        <p className="text-[1.0625rem] font-semibold">
          {report.hostname} passed every check. Check again after big changes to your site.
        </p>
      ) : (
        <>
          <p className="text-[1.0625rem] font-semibold">
            {step.newGrade !== report.grade
              ? `Fix “${step.finding.title}” to move ${report.hostname} from ${report.grade === 'A' || report.grade === 'F' ? 'an' : 'a'} ${report.grade} to ${step.newGrade === 'A' || step.newGrade === 'F' ? 'an' : 'a'} ${step.newGrade}.`
              : `Fix “${step.finding.title}” to add ${step.gain} points to ${report.hostname}’s score.`}
          </p>
          <p className="text-sm text-[#a9bbd6]">{step.finding.howToFix}</p>
        </>
      )}
    </section>
  );
}

/* ---------- Main column states ---------- */

function Checking({ hostname }: { hostname: string }) {
  return (
    <div role="status" className="flex flex-col gap-4 rounded-[14px] border bg-card p-6">
      <div className="flex items-center gap-3 font-semibold">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        Checking {hostname}…
      </div>
      <ul className="flex flex-col gap-3 text-[0.9375rem] text-muted-foreground">
        {['Secure connection', 'Security certificate', 'Browser protections', 'Private files'].map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span
              className="size-4 animate-[soft-pulse_1.2s_ease-in-out_infinite] rounded-full border-2 border-border"
              style={{ animationDelay: `${i * 200}ms` }}
              aria-hidden="true"
            />
            {label}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">This takes about 10 seconds.</p>
    </div>
  );
}

function NoReportYet({ hasRecent }: { hasRecent: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[14px] border bg-card p-6">
      <span className="grid size-[42px] place-items-center rounded-[10px] bg-primary-soft text-primary">
        <Radar className="size-[22px]" aria-hidden="true" />
      </span>
      <h3 className="font-display text-lg font-bold tracking-tight">
        {hasRecent ? 'Pick a website to see its report' : 'No checks yet'}
      </h3>
      <p className="max-w-[60ch] text-[0.9375rem] text-muted-foreground">
        {hasRecent
          ? 'Tap one of your recent checks above to check it again, or enter another website you own.'
          : 'Enter a website you own above. In a few seconds you’ll see its grade, what each problem means for your business, and what to fix first.'}
      </p>
    </div>
  );
}

/* ---------- Page ---------- */

/** The signed-in home: check a website, see the latest report, and what to do next. */
export function HomePage() {
  const { data: session } = useSession();
  const userId = session?.user.id ?? '';
  const firstName = session?.user.name.split(' ')[0];
  const [domain, setDomain] = useState('');
  const [recent, setRecent] = useState<RecentCheck[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userId) setRecent(loadRecentChecks(userId));
  }, [userId]);

  const scan = useMutation({
    mutationFn: runScan,
    onSuccess: (report) => {
      if (!userId) return;
      setRecent(
        saveRecentCheck(userId, { hostname: report.hostname, grade: report.grade, score: report.score, at: report.scannedAt }),
      );
    },
  });

  useEffect(() => {
    if (scan.data) reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scan.data]);

  const check = (hostname: string) => {
    setDomain(hostname);
    scan.mutate(hostname);
  };

  return (
    <>
      <section className="relative overflow-hidden border-b bg-card">
        <MonitorWave
          className="absolute inset-0"
          baseline={0.5}
          ampRatio={0.2}
          alpha={{ light: 0.14, dark: 0.22 }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-[0.08em] text-primary uppercase sm:text-[0.8125rem]">
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </span>
            <h1 className="font-display text-[2rem] leading-[1.1] font-bold tracking-tight sm:text-[2.5rem]">Check a website</h1>
          </div>
          <CommandBar value={domain} onChange={setDomain} onSubmit={check} pending={scan.isPending} />
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 text-sm">
              <span className="text-muted-foreground">Recent checks:</span>
              {recent.map((r) => (
                <button
                  key={r.hostname}
                  type="button"
                  onClick={() => check(r.hostname)}
                  disabled={scan.isPending}
                  title={`Check ${r.hostname} again`}
                  className="flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1.5 font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="font-display text-[0.9375rem] font-bold" style={{ color: GRADE_COLOR[r.grade] }}>
                    {r.grade}
                  </span>
                  {r.hostname}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl items-start gap-7 px-4 py-9 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div ref={reportRef} className="flex scroll-mt-6 flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">Latest report</h2>
            {scan.data && (
              <span className="text-sm text-muted-foreground">{scan.data.hostname} · checked just now</span>
            )}
          </div>

          {scan.isError && (
            <div role="alert" className="flex gap-3 rounded-[14px] border border-critical/30 bg-critical-soft p-4 text-[0.9375rem]">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
              <p>{scan.error.message}</p>
            </div>
          )}

          {scan.isPending ? (
            <Checking hostname={scan.variables ?? domain} />
          ) : scan.data ? (
            <ScanReport report={scan.data} />
          ) : (
            !scan.isError && <NoReportYet hasRecent={recent.length > 0} />
          )}
        </div>

        <aside className="flex flex-col gap-5">
          {scan.data && !scan.isPending && <NextStepCard report={scan.data} />}
          <YourWebsites />
          <HowGradesWork current={scan.data?.grade} />
        </aside>
      </div>
    </>
  );
}
