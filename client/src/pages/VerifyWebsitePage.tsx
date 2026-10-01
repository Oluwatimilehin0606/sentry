import { ArrowLeft, Check, Clock, Loader2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CopyButton } from '@/components/CopyButton';
import { FormError } from '@/components/FormError';
import { Button } from '@/components/ui/button';
import { recordName, useDomains, useVerifyDomain, type Domain, type VerifyResult } from '@/lib/domains';
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

function Instructions({ domain }: { domain: Domain }) {
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
            onClick={() => verify.mutate(domain.id)}
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

/** "Prove it's yours": the DNS line to add, provider help, and the check. */
export function VerifyWebsitePage() {
  const { hostname = '' } = useParams();
  const sites = useDomains();
  const domain = sites.data?.find((d) => d.hostname === hostname);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10 sm:px-6 sm:py-12">
      <Link
        to="/websites"
        className="flex items-center gap-1.5 self-start rounded-md text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Your websites
      </Link>

      <div className="flex flex-col gap-6 rounded-2xl border bg-card p-5 sm:p-8">
        {sites.isPending ? (
          <div role="status" className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        ) : sites.isError ? (
          <FormError message={sites.error.message} />
        ) : !domain ? (
          <div className="flex flex-col items-start gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight">This website isn’t in your account</h1>
            <p className="text-muted-foreground">Add it from Your websites to get its verification line.</p>
            <Button asChild className="h-11">
              <Link to="/websites">Go to your websites</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-[1.625rem] leading-tight font-bold tracking-tight sm:text-[1.875rem]">
                {domain.verifiedAt ? `${domain.hostname} is verified` : `Prove ${domain.hostname} is yours`}
              </h1>
              {!domain.verifiedAt && (
                <p className="text-muted-foreground">
                  Add one line to your domain’s settings. Only someone who controls the domain can do this, so it
                  proves the website is yours. It doesn’t change anything visitors see.
                </p>
              )}
            </div>
            {domain.verifiedAt ? <Verified domain={domain} /> : <Instructions domain={domain} />}
          </>
        )}
      </div>
    </div>
  );
}
