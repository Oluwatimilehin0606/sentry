import { CheckCircle2, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Grade, ReportFinding, ScanReport as Report, Severity } from '@/lib/scan';
import { cn } from '@/lib/utils';

const GRADE_COLOR: Record<Grade, string> = {
  A: 'var(--grade-a)',
  B: 'var(--grade-b)',
  C: 'var(--grade-c)',
  D: 'var(--grade-d)',
  F: 'var(--grade-f)',
};

const SEVERITY_STYLE: Record<Severity, { pill: string; stripe: string; label: string }> = {
  critical: { pill: 'bg-critical-soft text-critical', stripe: 'border-l-critical', label: 'Critical' },
  medium: { pill: 'bg-medium-soft text-medium', stripe: 'border-l-medium', label: 'Medium' },
  low: { pill: 'bg-low-soft text-low', stripe: 'border-l-low', label: 'Low' },
};

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

function FindingCard({ finding, open }: { finding: ReportFinding; open: boolean }) {
  const style = SEVERITY_STYLE[finding.severity];
  return (
    <details
      open={open}
      className={cn('group rounded-lg border border-l-4 bg-card', style.stripe)}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 p-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <Pill className={style.pill}>{style.label}</Pill>
        <h3 className="flex-[1_1_220px] font-semibold">{finding.title}</h3>
        <ChevronDown
          className="size-5 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
        <dl className="grid gap-3">
          {(
            [
              ['What it is', finding.whatItIs],
              ['Why it matters', finding.whyItMatters],
              ['How to fix', finding.howToFix],
            ] as const
          ).map(([term, text]) => (
            <div key={term}>
              <dt className="text-xs font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
                {term}
              </dt>
              <dd className="mt-0.5 max-w-[65ch] text-[0.9375rem]">{text}</dd>
            </div>
          ))}
        </dl>
        {finding.evidence && (
          <p className="overflow-x-auto border-t border-dashed pt-3 font-mono text-[0.8125rem] whitespace-nowrap text-muted-foreground">
            {finding.evidence}
          </p>
        )}
      </div>
    </details>
  );
}

export function ScanReport({ report }: { report: Report }) {
  const failed = report.findings.filter((f) => f.status === 'fail');
  const passed = report.findings.filter((f) => f.status === 'pass');
  const color = GRADE_COLOR[report.grade];
  const counts = (['critical', 'medium', 'low'] as const)
    .map((s) => [s, failed.filter((f) => f.severity === s).length] as const)
    .filter(([, n]) => n > 0);

  return (
    <section aria-label={`Scan report for ${report.hostname}`} className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-[0_1px_2px_rgb(17_26_43/0.05),0_6px_16px_rgb(17_26_43/0.06)] lg:sticky lg:top-6">
        <div className="flex items-center gap-4">
          <div
            className="grid size-[72px] shrink-0 place-items-center rounded-[14px] border-[3px] font-display text-[2.5rem] leading-none font-bold"
            style={{ borderColor: color, color }}
            aria-label={`Grade ${report.grade}`}
          >
            {report.grade}
          </div>
          <div className="min-w-0">
            <div className="font-display text-[2rem] leading-none font-bold tabular-nums">
              {report.score}
              <span className="text-base font-medium text-subtle-foreground"> / 100</span>
            </div>
            <div className="truncate text-sm text-muted-foreground">{report.hostname}</div>
          </div>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`Score ${report.score} out of 100`}
        >
          <span className="block h-full rounded-full" style={{ width: `${report.score}%`, background: color }} />
        </div>
        <p>{report.summary}</p>
        <div className="flex flex-wrap gap-2">
          {counts.map(([severity, n]) => (
            <Pill key={severity} className={SEVERITY_STYLE[severity].pill}>
              {n} {severity}
            </Pill>
          ))}
          <Pill className="bg-pass-soft text-pass">{passed.length} passed</Pill>
        </div>
        <p className="text-xs text-subtle-foreground">
          Checked {new Date(report.scannedAt).toLocaleString()} · took{' '}
          {(report.durationMs / 1000).toFixed(1)}s
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {failed.length > 0 ? (
          <>
            <h2 className="font-display text-xl font-bold tracking-tight">What to fix, most urgent first</h2>
            {failed.map((f, i) => (
              <FindingCard key={f.checkId} finding={f} open={i === 0} />
            ))}
          </>
        ) : (
          <div className="flex gap-3 rounded-lg border bg-pass-soft p-5">
            <CheckCircle2 className="size-6 shrink-0 text-pass" aria-hidden="true" />
            <p>
              <strong className="font-semibold">Nice work.</strong> {report.hostname} passed every
              check we ran. Keep your software up to date and check again after big changes.
            </p>
          </div>
        )}

        {passed.length > 0 && (
          <details className="group rounded-lg border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold sm:px-5 [&::-webkit-details-marker]:hidden">
              What passed ({passed.length})
              <ChevronDown
                className="size-5 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <ul className="flex flex-col gap-2.5 px-4 pb-4 sm:px-5">
              {passed.map((f) => (
                <li key={f.checkId} className="flex gap-2.5 text-[0.9375rem]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pass" aria-hidden="true" />
                  <span>
                    {f.title}
                    {f.evidence && (
                      <span className="block font-mono text-xs break-all text-subtle-foreground">
                        {f.evidence}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
