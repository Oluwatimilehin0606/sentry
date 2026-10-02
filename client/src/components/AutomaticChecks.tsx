import { Check, Loader2 } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';
import { FormError } from '@/components/FormError';
import { Button } from '@/components/ui/button';
import { runNowSummary, useRunNow, useUpdateDomain, type Domain, type RescanInterval } from '@/lib/domains';
import { GRADE_COLOR } from '@/lib/grading';
import { cn } from '@/lib/utils';

const CHOICES: { value: RescanInterval; label: string }[] = [
  { value: 'none', label: 'Only when I ask' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
];

const nextDay = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
const nextTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** How often Sentry checks a verified website by itself, and whether to email when it gets worse. */
export function AutomaticChecks({ domain, email }: { domain: Domain; email?: string }) {
  const update = useUpdateDomain();
  const runNow = useRunNow();
  const name = useId();
  const verified = !!domain.verifiedAt;

  if (!verified) {
    return (
      <section aria-labelledby={`${name}-h`} className="flex flex-col gap-2 rounded-[14px] border border-dashed border-input bg-card p-5 sm:p-6">
        <h2 id={`${name}-h`} className="font-display text-xl font-bold tracking-tight">
          Automatic checks
        </h2>
        <p className="text-[0.9375rem] text-muted-foreground">
          Prove {domain.hostname} is yours (above) and Sentry can check it every week or month for you, and email you if
          it gets worse.
        </p>
      </section>
    );
  }

  const save = (settings: { rescanInterval?: RescanInterval; alertsEnabled?: boolean }) =>
    update.mutate({ id: domain.id, ...settings });
  const next = domain.nextCheckAt ? new Date(domain.nextCheckAt) : null;

  return (
    <section aria-labelledby={`${name}-h`} className="flex flex-col gap-4.5 rounded-[14px] border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-0.5">
        <h2 id={`${name}-h`} className="font-display text-xl font-bold tracking-tight">
          Automatic checks
        </h2>
        <p className="text-[0.9375rem] text-muted-foreground">
          Sentry runs the full check for you and emails you if things get worse.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-semibold [overflow-wrap:anywhere]">Check {domain.hostname}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHOICES.map((c) => {
            const checked = domain.rescanInterval === c.value;
            return (
              <label
                key={c.value}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3.5 py-3 transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
                  checked ? 'border-2 border-primary bg-primary-soft font-semibold' : 'hover:bg-muted',
                )}
              >
                <input
                  type="radio"
                  name={`${name}-every`}
                  value={c.value}
                  checked={checked}
                  onChange={() => save({ rescanInterval: c.value })}
                  className="size-4 accent-primary"
                />
                {c.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {next && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-[0.9375rem]">
              Next check: <strong className="font-semibold">{nextDay.format(next)}</strong>, around {nextTime.format(next)}.
            </p>
            {/* This period's automatic check, straight away (and the alert email if it got worse). */}
            <Button
              type="button"
              variant="outline"
              disabled={runNow.isPending}
              onClick={() => runNow.mutate(domain.id)}
              className="font-semibold"
            >
              Run it now
            </Button>
          </div>
          <RunNowStatus hostname={domain.hostname} run={runNow} />
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 border-t pt-4">
        <input
          type="checkbox"
          checked={domain.alertsEnabled}
          onChange={(e) => save({ alertsEnabled: e.target.checked })}
          className="mt-1 size-4.5 accent-primary"
        />
        <span className="flex flex-col">
          <span className="font-semibold">Email me if it gets worse</span>
          <span className="text-sm text-muted-foreground">
            When the grade drops, or a new critical or medium problem appears{email ? `. Sent to ${email}` : ''}.
            {domain.rescanInterval === 'none' && ' Turn on automatic checks above for this to apply.'}
          </span>
        </span>
      </label>

      <div aria-live="polite" className="min-h-5 text-sm">
        {update.isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Saving…
          </span>
        ) : update.isError ? (
          <FormError message={update.error.message} />
        ) : update.isSuccess ? (
          <span className="flex items-center gap-1.5 text-pass">
            <Check className="size-4" strokeWidth={3} aria-hidden="true" />
            Saved
          </span>
        ) : null}
      </div>
    </section>
  );
}

/** While "Run it now" runs, then what it found (or why it couldn't run). */
function RunNowStatus({ hostname, run }: { hostname: string; run: ReturnType<typeof useRunNow> }) {
  return (
    <div aria-live="polite">
      {run.isPending ? (
        <p className="flex items-center gap-2.5 rounded-[10px] bg-muted px-3.5 py-3 text-[0.9375rem]">
          <Loader2 className="size-4.5 animate-spin text-primary" aria-hidden="true" />
          Running the automatic check of {hostname}…
        </p>
      ) : run.isError ? (
        <FormError message={run.error.message} />
      ) : run.isSuccess ? (
        <RunNowResult hostname={hostname} data={run.data.result} />
      ) : null}
    </div>
  );
}

function RunNowResult({ hostname, data }: { hostname: string; data: Parameters<typeof runNowSummary>[1] }) {
  const { worse, text, email } = runNowSummary(hostname, data);
  const report = (
    <Link to={`/reports/${data.scanId}`} className="font-semibold text-primary underline-offset-4 hover:underline">
      See the report
    </Link>
  );
  if (!worse) {
    return (
      <p className="flex items-start gap-2.5 rounded-[10px] bg-pass-soft px-3.5 py-3 text-[0.9375rem]">
        <Check className="mt-0.5 size-4.5 shrink-0 text-pass" strokeWidth={3} aria-hidden="true" />
        <span>
          {text} {report}
        </span>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-critical/40 bg-critical-soft px-4 py-3.5 text-[0.9375rem]">
      {data.previous && (
        <span className="flex items-baseline gap-2.5 font-display text-xl font-bold" aria-hidden="true">
          <span style={{ color: GRADE_COLOR[data.previous.grade] }}>{data.previous.grade}</span>
          <span className="text-base font-normal text-muted-foreground">→</span>
          <span style={{ color: GRADE_COLOR[data.current.grade] }}>{data.current.grade}</span>
        </span>
      )}
      <span className="font-semibold">{text}</span>
      <span>
        {email} {report}
      </span>
    </div>
  );
}
