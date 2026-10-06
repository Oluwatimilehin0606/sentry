import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Globe, Loader2, Minus, Radar } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AddWebsiteDialog } from '@/components/AddWebsiteDialog';
import { CommandBar } from '@/components/CommandBar';
import { MonitorWave } from '@/components/MonitorWave';
import { ScanReport } from '@/components/ScanReport';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { isCoveredBy, useDomains } from '@/lib/domains';
import { GRADE_COLOR, nextStep } from '@/lib/grading';
import { latestPerWebsite, timeAgo, useRecentScans, useSavedReport } from '@/lib/reports';
import { runScan, SCAN_STEPS, type Grade, type ScanProgress, type ScanReport as Report, type ScanStep } from '@/lib/scan';
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
  const sites = useDomains();
  const [adding, setAdding] = useState(false);
  const list = sites.data ?? [];

  return (
    <section aria-labelledby="sites-h" className="flex flex-col gap-3.5 rounded-[14px] border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sites-h" className="font-display text-xl font-bold tracking-tight">
          Your websites
        </h2>
        {list.length > 0 && (
          <Link to="/websites" className="rounded-md text-sm font-semibold text-primary hover:underline">
            Manage
          </Link>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-[0.9375rem] text-muted-foreground">
          {sites.isPending
            ? 'Loading…'
            : 'Add your website and prove it’s yours to get its full check, including private files.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5 text-[0.9375rem]">
          {list.slice(0, 4).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{d.hostname}</span>
              {d.verifiedAt ? (
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-pass">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                  Verified
                </span>
              ) : (
                <Link to={`/websites/${d.hostname}`} className="shrink-0 text-sm font-semibold text-medium hover:underline">
                  Waiting for proof
                </Link>
              )}
            </li>
          ))}
          {list.length > 4 && <li className="text-sm text-muted-foreground">and {list.length - 4} more</li>}
        </ul>
      )}
      <Button variant="outline" className="h-[42px]" onClick={() => setAdding(true)}>
        {list.length === 0 && <Globe aria-hidden="true" />}
        Add website
      </Button>
      <AddWebsiteDialog open={adding} onOpenChange={setAdding} />
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

const STEP_LABEL: Record<ScanStep, string> = {
  connection: 'Secure connection',
  certificate: 'Security certificate',
  protections: 'Browser protections',
  files: 'Private files',
};

/** How long the finished list stays up before the report replaces it, so the last tick is seen. */
const SETTLE_MS = 600;

type Progress = Partial<Record<ScanStep, ScanProgress>>;

function StepIcon({ state }: { state?: ScanProgress }) {
  if (state?.status === 'done') {
    return (
      <span
        className="grid size-5 shrink-0 animate-[check-in_0.3s_cubic-bezier(0.2,0.8,0.3,1.3)_both] place-items-center rounded-full bg-pass-soft text-pass"
        aria-hidden="true"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state?.status === 'skipped') {
    return (
      <span
        className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-border text-muted-foreground"
        aria-hidden="true"
      >
        <Minus className="size-2.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className="size-5 shrink-0 animate-[soft-pulse_1.2s_ease-in-out_infinite] rounded-full border-2 border-primary"
      aria-hidden="true"
    />
  );
}

/** Ticks each part off as the server reports it finished; a tick means checked, not passed. */
function Checking({ hostname, progress, light }: { hostname: string; progress: Progress; light: boolean }) {
  const finished = SCAN_STEPS.every((step) => progress[step]);
  return (
    <div role="status" className="flex flex-col gap-4 rounded-[14px] border bg-card p-6">
      <div className="flex items-center gap-3 font-semibold">
        {finished ? (
          <span className="grid size-5 place-items-center rounded-full bg-pass-soft text-pass" aria-hidden="true">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : (
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        )}
        {finished ? `Checked ${hostname}` : `Checking ${hostname}…`}
      </div>
      <ul className="flex flex-col gap-3 text-[0.9375rem]">
        {SCAN_STEPS.map((step) => {
          // A light check never looks at private files, so show that from the start.
          const state =
            progress[step] ??
            (light && step === 'files'
              ? ({ step, status: 'skipped', note: 'for verified owners only' } satisfies ScanProgress)
              : undefined);
          const label = STEP_LABEL[step];
          return (
            <li key={step} className="flex items-center gap-3">
              <StepIcon state={state} />
              <span className={state?.status === 'done' ? 'text-foreground' : 'text-muted-foreground'}>
                {state?.status === 'done'
                  ? label
                  : state?.status === 'skipped'
                    ? `${label}: ${state.note ?? 'couldn’t check'}`
                    : `Checking ${label.toLowerCase()}…`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground">{finished
          ? 'Preparing your report…'
          : light
            ? 'This takes a few seconds.'
            : 'This takes about 10 seconds.'}</p>
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
  const firstName = session?.user.name.split(' ')[0];
  const [domain, setDomain] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<Progress>({});
  const sites = useDomains();
  const location = useLocation();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const saved = useRecentScans();
  const recent = latestPerWebsite(saved.data).slice(0, 5);
  // Before any check in this visit, show the account's latest saved report.
  const latestSaved = useSavedReport(saved.data?.[0]?.id);

  const scan = useMutation({
    mutationFn: async (hostname: string) => {
      setProgress({});
      const report = await runScan(hostname, (p) => setProgress((prev) => ({ ...prev, [p.step]: p })));
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      return report;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
  });
  const shown = scan.data ?? (scan.isPending || scan.isError ? undefined : latestSaved.data);
  // The latest saved report is still on its way (placeholders keep its place).
  const loadingLatest = !scan.isPending && !scan.isError && !shown && (saved.isPending || latestSaved.isLoading);

  useEffect(() => {
    if (scan.data) reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scan.data]);

  // Arriving from "Full check" or "Run the full check" starts that check straight away (once).
  const requested = (location.state as { check?: string } | null)?.check;
  const handledArrival = useRef<string | null>(null);
  useEffect(() => {
    // Effects can run twice for one arrival (React's development checks), so remember it.
    if (!requested || handledArrival.current === location.key) return;
    handledArrival.current = location.key;
    navigate(location.pathname, { replace: true, state: null });
    check(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per request
  }, [requested]);

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
          {/* Keeps the row's place while past checks load, so the page below doesn't jump down. */}
          {saved.isPending && (
            <div aria-hidden="true" className="flex h-[34px] items-center">
              <span className="h-[34px] w-64 animate-pulse rounded-full bg-muted" />
            </div>
          )}
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
            {shown && (
              <span className="text-sm text-muted-foreground">
                {shown.hostname} · checked {timeAgo(shown.scannedAt)} ·{' '}
                <Link to="/reports" className="font-semibold text-primary hover:underline">
                  All reports
                </Link>
              </span>
            )}
          </div>

          {scan.isError && (
            <div role="alert" className="flex gap-3 rounded-[14px] border border-critical/30 bg-critical-soft p-4 text-[0.9375rem]">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden="true" />
              <p>{scan.error.message}</p>
            </div>
          )}

          {scan.isPending ? (
            <Checking
              hostname={scan.variables ?? domain}
              progress={progress}
              light={!isCoveredBy(sites.data, scan.variables ?? domain)}
            />
          ) : shown ? (
            <ScanReport report={shown} />
          ) : loadingLatest ? (
            // About the size of a report, so the page doesn't jump when it arrives.
            <div aria-hidden="true" className="h-[560px] animate-pulse rounded-[14px] border bg-card" />
          ) : (
            !scan.isError && <NoReportYet hasRecent={recent.length > 0} />
          )}
        </div>

        <aside className="flex flex-col gap-5">
          {shown && !scan.isPending && <NextStepCard report={shown} />}
          {loadingLatest && <div aria-hidden="true" className="h-[145px] animate-pulse rounded-[14px] border bg-card" />}
          <YourWebsites />
          <HowGradesWork current={shown?.grade} />
        </aside>
      </div>
    </>
  );
}
