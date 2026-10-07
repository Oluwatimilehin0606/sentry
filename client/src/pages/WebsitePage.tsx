import { ArrowLeft, Check, Clock, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AutomaticChecks } from '@/components/AutomaticChecks';
import { YourDeveloper } from '@/components/YourDeveloper';
import { useSession } from '@/lib/auth-client';
import { CopyButton } from '@/components/CopyButton';
import { FormError } from '@/components/FormError';
import { Button } from '@/components/ui/button';
import { ScoreChart } from '@/components/ScoreChart';
import { recordName, useDomains, useUpdateDomain, useVerifyDomain, type Domain, type VerifyResult } from '@/lib/domains';
import { GRADE_COLOR } from '@/lib/grading';
import { describeChange, useScanList, useScoreHistory, whenChecked, type ScanSummary } from '@/lib/reports';
import { ModeTag } from '@/pages/ReportsPage';
import { cn } from '@/lib/utils';

const PROVIDERS: { id: string; label: string; steps: string }[] = [
  {
    id: 'cloudflare',
    label: 'Cloudflare',
    steps: 'Open your domain → DNS → Records → Add record. Choose TXT, paste the Name and Value above, then Save.',
  },
  {
    id: 'cpanel',
    label: 'cPanel / Whogohost',
    steps:
      'In your Whogohost client area open Domains → My Domains → Manage → DNS Management, or open cPanel → Zone Editor. Add a TXT record with the Name and Value above, then save.',
  },
  {
    id: 'namecheap',
    label: 'Namecheap',
    steps:
      'Domain List → Manage next to your domain → Advanced DNS → Add new record → TXT Record. Put the Name in “Host” and the Value in “Value”, then click the tick to save.',
  },
  {
    id: 'godaddy',
    label: 'GoDaddy',
    steps: 'My Products → your domain → DNS → Add New Record. Choose TXT, paste the Name and Value above, then Save.',
  },
  {
    id: 'other',
    label: 'Something else',
    steps:
      'Look for “DNS”, “DNS records”, “Zone editor” or “Advanced DNS”. Add a TXT record with the Name and Value above. If you’re stuck, send this page to whoever set up your domain.',
  },
];

const NOT_YET: Record<NonNullable<VerifyResult['reason']>, ReactNode> = {
  not_found: (
    <>
      <strong>We can’t see the line yet.</strong> Changes can take from a few minutes to a few hours to appear. You can
      leave this page and come back; your line stays the same.
    </>
  ),
  no_domain: (
    <>
      <strong>We couldn’t find this domain online.</strong> Check the spelling, or that the domain is registered and
      active.
    </>
  ),
  dns_error: (
    <>
      <strong>We couldn’t look up your domain just now.</strong> This is usually temporary. Please try again in a
      minute.
    </>
  ),
};

function RecordRow({ label, value, copyLabel }: { label: string; value: string; copyLabel?: string }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center border-t first:border-t-0 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
      <span className="self-stretch bg-muted px-3.5 py-3 font-semibold">{label}</span>
      <code ref={ref} className="px-3.5 py-3 font-mono text-sm [overflow-wrap:anywhere]">
        {value}
      </code>
      <span className="px-2.5">{copyLabel && <CopyButton text={value} selectRef={ref} label={copyLabel} />}</span>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)] gap-3.5">
      <span
        className="grid size-8 place-items-center rounded-full bg-primary-soft font-display font-bold text-primary"
        aria-hidden="true"
      >
        {n}
      </span>
      <div className="flex flex-col gap-2.5">
        <h2 className="font-semibold">{title}</h2>
        {children}
      </div>
    </li>
  );
}

function Verified({ domain }: { domain: Domain }) {
  const navigate = useNavigate();
  return (
    <div className="flex gap-3 rounded-xl bg-pass-soft p-4 text-pass" role="status">
      <Check className="mt-0.5 size-5 shrink-0" strokeWidth={2.6} aria-hidden="true" />
      <div className="flex flex-col gap-3 text-[0.9375rem] text-foreground">
        <span>
          <strong>{domain.hostname} gets the full check.</strong> You can remove the line from your domain’s settings
          now or leave it; Sentry won’t need it again.
        </span>
        <Button
          className="h-10 self-start bg-pass px-4 text-white hover:bg-pass/90 dark:text-[#0b111c]"
          onClick={() => navigate('/home', { state: { check: domain.hostname } })}
        >
          Run the full check
        </Button>
      </div>
    </div>
  );
}

function Instructions({ domain, onVerified }: { domain: Domain; onVerified: () => void }) {
  const verify = useVerifyDomain();
  const [provider, setProvider] = useState('cloudflare');
  const name = recordName(domain.hostname);
  const result = verify.data;

  if (result?.verified) return <Verified domain={result.domain} />;

  return (
    <>
      <ol className="flex flex-col gap-6">
        <Step n={1} title="Sign in where you manage your domain">
          <p className="text-[0.9375rem] text-muted-foreground">
            Usually the company you bought it from (for example Whogohost, Namecheap or GoDaddy) or Cloudflare. Look for
            “DNS”, “DNS records” or “Zone editor”.
          </p>
        </Step>
        <Step n={2} title="Add a new record with these three values">
          <div className="overflow-hidden rounded-[10px] border text-[0.9375rem]">
            <RecordRow label="Type" value="TXT" />
            <RecordRow label="Name / Host" value={name} copyLabel="Copy name" />
            <RecordRow label="Value" value={domain.record.value} copyLabel="Copy value" />
          </div>
          <p className="text-sm text-muted-foreground">
            {name === '@'
              ? 'The Name “@” means the domain itself; some providers want it left empty.'
              : `If your provider asks for the full name, use ${domain.hostname}.`}{' '}
            Leave any “TTL” setting as it is.
          </p>
        </Step>
        <Step n={3} title="Save it, then come back and check">
          <Button
            className="h-12 self-start px-5"
            disabled={verify.isPending}
            aria-busy={verify.isPending}
            onClick={() => verify.mutate(domain.id, { onSuccess: (r) => r.verified && onVerified() })}
          >
            {verify.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {verify.isPending ? 'Checking…' : 'Check now'}
          </Button>
          <div aria-live="polite">
            {result && !result.verified && result.reason && (
              <div className="flex gap-3 rounded-xl bg-medium-soft p-4 text-[0.9375rem] text-foreground">
                <Clock className="mt-0.5 size-5 shrink-0 text-medium" aria-hidden="true" />
                <span>{NOT_YET[result.reason]}</span>
              </div>
            )}
            {verify.isError && <FormError message={verify.error.message} />}
          </div>
        </Step>
      </ol>

      <section aria-labelledby="provider-h" className="flex flex-col gap-3 border-t pt-5">
        <h2 id="provider-h" className="font-semibold">
          Help for your provider
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choose your provider">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={provider === p.id}
              onClick={() => setProvider(p.id)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                provider === p.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[0.9375rem] text-muted-foreground">{PROVIDERS.find((p) => p.id === provider)?.steps}</p>
      </section>
    </>
  );
}

const firstDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const article = (grade: string) => (grade === 'A' || grade === 'F' ? 'an' : 'a');

/** "Up 40 points since your first check on 22 Sept: from an F to a B." */
function progressSentence(points: ScanSummary[]): string {
  const [first, last] = [points[0]!, points.at(-1)!];
  const delta = last.score - first.score;
  const on = `your first check on ${firstDate.format(new Date(first.scannedAt))}`;
  const grades =
    first.grade === last.grade ? '' : `: from ${article(first.grade)} ${first.grade} to ${article(last.grade)} ${last.grade}`;
  if (delta > 0) return `Up ${delta} point${delta === 1 ? '' : 's'} since ${on}${grades}.`;
  if (delta < 0) return `Down ${-delta} point${delta === -1 ? '' : 's'} since ${on}${grades}.`;
  return `The same score as ${on}.`;
}

/** Score over time, with a table view of the same numbers. Shown once there are two checks. */
function History({ hostname }: { hostname: string }) {
  const history = useScoreHistory(hostname);
  const [asTable, setAsTable] = useState(false);
  const points = history.data ?? [];
  if (points.length < 2) return null;
  return (
    <section aria-labelledby="trend-h" className="flex flex-col gap-3.5 rounded-[14px] border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="trend-h" className="font-display text-xl font-bold tracking-tight">
            Score over time
          </h2>
          <p className="text-sm text-muted-foreground">{progressSentence(points)}</p>
        </div>
        <Button variant="outline" size="sm" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </Button>
      </div>
      {asTable ? (
        <table className="w-full text-left text-[0.9375rem]">
          <thead className="text-xs tracking-[0.06em] text-muted-foreground uppercase">
            <tr>
              <th className="py-2 font-semibold">Checked</th>
              <th className="py-2 font-semibold">Score</th>
              <th className="py-2 font-semibold">Grade</th>
              <th className="py-2 font-semibold">Type</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-2">{whenChecked(p.scannedAt)}</td>
                <td className="py-2 tabular-nums">{p.score}</td>
                <td className="py-2 font-display font-bold" style={{ color: GRADE_COLOR[p.grade] }}>
                  {p.grade}
                </td>
                <td className="py-2">{p.mode === 'full' ? 'Full check' : 'Light check'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ScoreChart points={points} label={`Score over time for ${hostname}`} />
      )}
    </section>
  );
}

/** Every check of this website, newest first, with what changed each time. */
function Checks({ hostname, onCheck }: { hostname: string; onCheck: () => void }) {
  const list = useScanList(hostname);
  const scans = list.data?.pages.flatMap((p) => p.scans) ?? [];
  return (
    <section aria-labelledby="checks-h" className="overflow-hidden rounded-[14px] border bg-card">
      <h2 id="checks-h" className="border-b px-5 py-4 font-display text-xl font-bold tracking-tight [overflow-wrap:anywhere]">
        All checks of {hostname}
      </h2>
      {list.isPending ? (
        <p className="p-5 text-muted-foreground">Loading…</p>
      ) : list.isError ? (
        <div className="p-5">
          <FormError message={list.error.message} />
        </div>
      ) : scans.length === 0 ? (
        <div className="flex flex-col items-start gap-3 p-5">
          <p className="text-muted-foreground">No checks of this website yet.</p>
          <Button className="h-11" onClick={onCheck}>
            Check it now
          </Button>
        </div>
      ) : (
        <ul>
          {scans.map((s) => (
            <li
              key={s.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t px-5 py-3.5 first:border-t-0 md:grid-cols-[200px_110px_minmax(0,1fr)_200px_110px] md:gap-5"
            >
              <span className="col-start-1 row-start-2 text-sm text-muted-foreground md:row-start-auto md:text-base md:text-foreground">
                {whenChecked(s.scannedAt)}
              </span>
              <span className="col-start-1 row-start-1 flex items-baseline gap-2 md:col-start-auto md:row-start-auto">
                <span className="font-display text-xl font-bold" style={{ color: GRADE_COLOR[s.grade] }}>
                  {s.grade}
                </span>
                <span className="tabular-nums">{s.score}</span>
              </span>
              <span
                className={cn(
                  'col-start-1 row-start-3 text-sm md:col-start-auto md:row-start-auto',
                  s.change && s.change.scoreDelta > 0
                    ? 'text-pass'
                    : s.change && s.change.scoreDelta < 0
                      ? 'text-critical'
                      : 'text-muted-foreground',
                )}
              >
                {describeChange(s.change)}
              </span>
              <span className="hidden md:block">
                <ModeTag mode={s.mode} trigger={s.trigger} />
              </span>
              <Link
                to={`/reports/${s.id}`}
                className="col-start-2 row-span-3 row-start-1 self-center justify-self-end rounded-md font-semibold text-primary hover:underline md:col-start-auto md:row-span-1 md:row-start-auto"
              >
                View report<span className="sr-only">, {whenChecked(s.scannedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <div className="border-t p-3.5 text-center">
          <Button
            variant="outline"
            className="h-10"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            Show older checks
          </Button>
        </div>
      )}
    </section>
  );
}

/** One website: proving it's yours (until it's verified), its score over time and every check. */
export function WebsitePage() {
  const { hostname = '' } = useParams();
  const navigate = useNavigate();
  const sites = useDomains();
  const domain = sites.data?.find((d) => d.hostname === hostname);
  // Keep the proof card up after verifying, for its "Run the full check" button.
  const [justVerified, setJustVerified] = useState(false);
  const { data: session } = useSession();

  // "Turn off these emails" in an alert links here with ?alerts=off.
  const [params, setParams] = useSearchParams();
  const update = useUpdateDomain();
  const [alertsTurnedOff, setAlertsTurnedOff] = useState(false);
  useEffect(() => {
    if (params.get('alerts') !== 'off' || !domain) return;
    setParams({}, { replace: true });
    if (domain.alertsEnabled) update.mutate({ id: domain.id, alertsEnabled: false }, { onSuccess: () => setAlertsTurnedOff(true) });
    else setAlertsTurnedOff(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the website has loaded
  }, [domain?.id]);
  const check = () => navigate('/home', { state: { check: hostname } });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-10 sm:px-6 sm:py-12">
      <Link
        to="/websites"
        className="flex items-center gap-1.5 self-start rounded-md text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Your websites
      </Link>

      {sites.isPending ? (
        <div role="status" className="flex items-center gap-3 rounded-[14px] border bg-card p-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : sites.isError ? (
        <FormError message={sites.error.message} />
      ) : !domain ? (
        <div className="flex flex-col items-start gap-3 rounded-[14px] border bg-card p-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">This website isn’t in your account</h1>
          <p className="text-muted-foreground">Add it from Your websites to get its verification line.</p>
          <Button asChild className="h-11">
            <Link to="/websites">Go to your websites</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="font-display text-[1.875rem] leading-tight font-bold tracking-tight [overflow-wrap:anywhere] sm:text-[2.125rem]">
                {domain.hostname}
              </h1>
              {domain.verifiedAt ? (
                <span className="flex items-center gap-2 text-[0.9375rem] font-semibold text-pass">
                  <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                  Verified · gets the full check
                </span>
              ) : (
                <span className="text-[0.9375rem] font-semibold text-medium">Waiting for proof · light check only</span>
              )}
            </div>
            <Button
              className="h-12 shrink-0 self-start px-5 sm:self-auto"
              variant={domain.verifiedAt ? 'default' : 'outline'}
              onClick={check}
            >
              {domain.verifiedAt ? 'Full check' : 'Light check'}
            </Button>
          </div>

          {(!domain.verifiedAt || justVerified) && (
            <section aria-labelledby="proof-h" className="flex flex-col gap-6 rounded-2xl border bg-card p-5 sm:p-8">
              <div className="flex flex-col gap-1.5">
                <h2
                  id="proof-h"
                  className="font-display text-[1.5rem] leading-tight font-bold tracking-tight sm:text-[1.75rem]"
                >
                  {domain.verifiedAt ? `${domain.hostname} is verified` : `Prove ${domain.hostname} is yours`}
                </h2>
                {!domain.verifiedAt && (
                  <p className="text-muted-foreground">
                    Add one line to your domain’s settings. Only someone who controls the domain can do this, so it
                    proves the website is yours. It doesn’t change anything visitors see.
                  </p>
                )}
              </div>
              <Instructions domain={domain} onVerified={() => setJustVerified(true)} />
            </section>
          )}

          {alertsTurnedOff && (
            <div role="status" className="flex items-center gap-3 rounded-[14px] border bg-card p-4 text-[0.9375rem]">
              <Check className="size-5 shrink-0 text-pass" strokeWidth={2.6} aria-hidden="true" />
              Email alerts for {domain.hostname} are off. You can turn them back on below.
            </div>
          )}
          <AutomaticChecks domain={domain} email={session?.user.email} />
          <YourDeveloper domain={domain} />
          <History hostname={domain.hostname} />
          <Checks hostname={domain.hostname} onCheck={check} />
        </>
      )}
    </div>
  );
}
