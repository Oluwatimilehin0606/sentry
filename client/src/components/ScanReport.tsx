import { Check, CheckCircle2, ChevronDown, Plus } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { LightCheckBanner } from '@/components/LightCheckBanner';
import { GRADE_COLOR } from '@/lib/grading';
import type { ReportChanges, ReportFinding, ScanReport as Report, Severity } from '@/lib/scan';
import { cn } from '@/lib/utils';

const SEVERITY_STYLE: Record<Severity, { pill: string; stripe: string; label: string }> = {
  critical: { pill: 'bg-critical-soft text-critical', stripe: 'border-l-critical', label: 'Critical' },
  medium: { pill: 'bg-medium-soft text-medium', stripe: 'border-l-medium', label: 'Medium' },
  low: { pill: 'bg-low-soft text-low', stripe: 'border-l-low', label: 'Low' },
};

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap', className)}>
      {children}
    </span>
  );
}

const TERM = 'text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase';

/** The exact technical setting, set apart so an owner can copy it to whoever runs their site. */
function DeveloperNote({ text }: { text: string }) {
  const codeRef = useRef<HTMLElement>(null);
  return (
    <dd className="mt-2.5 flex flex-col gap-1.5 rounded-lg bg-muted px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className={TERM}>For your developer</span>
        <CopyButton text={text} selectRef={codeRef} label="Copy the setting for your developer" />
      </div>
      <code ref={codeRef} className="font-mono text-[0.8125rem] [overflow-wrap:anywhere]">
        {text}
      </code>
    </dd>
  );
}

function FindingRow({ finding, open, isNew }: { finding: ReportFinding; open: boolean; isNew: boolean }) {
  const style = SEVERITY_STYLE[finding.severity];
  return (
    <details open={open} className={cn('group border-t border-l-4 first:border-t-0', style.stripe)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <Pill className={style.pill}>{style.label}</Pill>
        <h3 className="flex-1 font-semibold">{finding.title}</h3>
        {isNew && (
          <span className="rounded-full border border-medium px-2.5 py-0.5 text-xs font-bold text-medium">
            New<span className="sr-only"> since the last check</span>
          </span>
        )}
        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-4 px-5 pb-5">
        <p className="max-w-[70ch] text-[0.9375rem] text-muted-foreground">{finding.whatItIs}</p>
        <dl className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <div>
            <dt className={TERM}>Why it matters</dt>
            <dd className="mt-0.5 text-[0.9375rem]">{finding.whyItMatters}</dd>
          </div>
          <div>
            <dt className={TERM}>How to fix</dt>
            <dd className="mt-0.5 text-[0.9375rem]">{finding.howToFix}</dd>
            {finding.forDeveloper && <DeveloperNote text={finding.forDeveloper} />}
          </div>
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

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** "Since your last check (29 Sept): ✓ 2 fixed · + 1 new · 2 still to fix · D 66 → B 82". */
function ChangesStrip({ changes, report }: { changes: ReportChanges; report: Report }) {
  const { previous } = changes;
  return (
    <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2 rounded-[14px] border bg-card px-5 py-4">
      <span className="font-semibold">Since your last check ({shortDate.format(new Date(previous.scannedAt))}):</span>
      {changes.fixed.length > 0 && (
        <span className="flex items-center gap-1.5 font-semibold text-pass">
          <Check className="size-4" strokeWidth={3} aria-hidden="true" />
          {changes.fixed.length} fixed
        </span>
      )}
      {changes.appeared.length > 0 && (
        <span className="flex items-center gap-1.5 font-semibold text-medium">
          <Plus className="size-4" strokeWidth={2.6} aria-hidden="true" />
          {changes.appeared.length} new
        </span>
      )}
      {changes.stillFailing > 0 && <span className="text-muted-foreground">{changes.stillFailing} still to fix</span>}
      {changes.fixed.length + changes.appeared.length === 0 && (
        <span className="text-muted-foreground">nothing changed</span>
      )}
      <span className="font-semibold sm:ml-auto">
        <span style={{ color: GRADE_COLOR[previous.grade] }}>
          {previous.grade} {previous.score}
        </span>{' '}
        → <span style={{ color: GRADE_COLOR[report.grade] }}>
          {report.grade} {report.score}
        </span>
      </span>
    </div>
  );
}

/** A scan report laid out for the home dashboard: grade summary, then findings most-urgent first. */
export function ScanReport({ report }: { report: Report }) {
  const failed = report.findings.filter((f) => f.status === 'fail');
  const passed = report.findings.filter((f) => f.status === 'pass');
  const color = GRADE_COLOR[report.grade];
  const counts = (['critical', 'medium', 'low'] as const)
    .map((s) => [s, failed.filter((f) => f.severity === s).length] as const)
    .filter(([, n]) => n > 0);

  return (
    <section aria-label={`Scan report for ${report.hostname}`} className="flex flex-col gap-4">
      {/* For screen readers: the problems below are level-3 headings, so they need a level 2 above them. */}
      <h2 className="sr-only">Report for {report.hostname}</h2>
      <div className="flex flex-col gap-5 rounded-[14px] border bg-card p-5 shadow-[0_1px_2px_rgb(17_26_43/0.05),0_10px_28px_rgb(17_26_43/0.07)] sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="flex items-center gap-5 sm:contents">
          <div
            aria-label={`Grade ${report.grade}`}
            className="grid size-[76px] shrink-0 place-items-center rounded-[18px] border-[3px] font-display text-[2.75rem] leading-none font-bold sm:size-[84px] sm:text-5xl"
            style={{ borderColor: color, color }}
          >
            {report.grade}
          </div>
          <div className="flex flex-1 flex-col gap-2.5">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[2.125rem] leading-none font-bold tabular-nums">{report.score}</span>
              <span className="text-muted-foreground">/ 100</span>
              {report.mode === 'light' && (
                <span className="ml-1.5 self-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                  Light check
                </span>
              )}
            </div>
            <div role="img" aria-label={`Score ${report.score} out of 100`} className="h-2 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full" style={{ width: `${report.score}%`, background: color }} />
            </div>
            <p className="hidden sm:block">{report.summary}</p>
          </div>
        </div>
        <p className="sm:hidden">{report.summary}</p>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          {counts.map(([severity, n]) => (
            <Pill key={severity} className={SEVERITY_STYLE[severity].pill}>
              {n} {severity}
            </Pill>
          ))}
          <Pill className="bg-pass-soft text-pass">{passed.length} passed</Pill>
        </div>
      </div>

      {report.mode === 'light' && <LightCheckBanner hostname={report.hostname} />}

      {report.changes && <ChangesStrip changes={report.changes} report={report} />}

      {failed.length === 0 && (
        <div className="flex gap-3 rounded-[14px] border bg-pass-soft p-5">
          <CheckCircle2 className="size-6 shrink-0 text-pass" aria-hidden="true" />
          <p>
            <strong className="font-semibold">Nice work.</strong> {report.hostname} passed every check we ran. Keep your
            software up to date and check again after big changes.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-[14px] border bg-card">
        {failed.map((f, i) => (
          <FindingRow key={f.checkId} finding={f} open={i === 0} isNew={!!report.changes?.appeared.includes(f.checkId)} />
        ))}
        {!!report.changes?.fixed.length && (
          <div className={cn('flex flex-col gap-2 bg-pass-soft px-5 py-4', failed.length > 0 && 'border-t')}>
            <h3 className="flex items-center gap-2.5 font-semibold text-pass">
              <Check className="size-[18px]" strokeWidth={2.6} aria-hidden="true" />
              Fixed since last check
            </h3>
            <ul className="flex list-disc flex-col gap-1 pl-12 text-[0.9375rem] marker:text-pass">
              {report.changes.fixed.map((f) => (
                <li key={f.checkId}>{f.title}</li>
              ))}
            </ul>
          </div>
        )}
        {passed.length > 0 && (
          <details
            className={cn('group bg-pass-soft/60', (failed.length > 0 || !!report.changes?.fixed.length) && 'border-t')}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-pass [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2.5">
                <Check className="size-[18px]" strokeWidth={2.6} aria-hidden="true" />
                {passed.length} {passed.length === 1 ? 'check' : 'checks'} passed
              </span>
              <span className="flex items-center gap-1 text-sm">
                <span className="group-open:hidden">Show</span>
                <span className="hidden group-open:inline">Hide</span>
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>
            <ul className="flex flex-col gap-2.5 px-5 pb-5">
              {passed.map((f) => (
                <li key={f.checkId} className="flex gap-2.5 text-[0.9375rem]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pass" aria-hidden="true" />
                  <span>
                    {f.title}
                    {f.evidence && <span className="block font-mono text-xs break-all text-muted-foreground">{f.evidence}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Checked {new Date(report.scannedAt).toLocaleString()} · took {(report.durationMs / 1000).toFixed(1)}s
      </p>
    </section>
  );
}
