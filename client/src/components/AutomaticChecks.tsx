import { Check, Loader2 } from 'lucide-react';
import { useId } from 'react';
import { FormError } from '@/components/FormError';
import { useUpdateDomain, type Domain, type RescanInterval } from '@/lib/domains';
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
        <p className="text-[0.9375rem]">
          Next check: <strong className="font-semibold">{nextDay.format(next)}</strong>, around {nextTime.format(next)}.
        </p>
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
