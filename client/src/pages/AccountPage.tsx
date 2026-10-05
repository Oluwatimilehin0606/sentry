import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { FormError } from '@/components/FormError';
import { Button } from '@/components/ui/button';
import { useDomains } from '@/lib/domains';

type Me = {
  user: { id: string; name: string; email: string; createdAt: string; termsAcceptedAt: string | null };
  /** The account set up for presenting Sentry: it gets "Reset demo". */
  isDemo: boolean;
};

async function fetchMe(): Promise<Me> {
  const res = await fetch('/api/me');
  if (!res.ok) throw new Error('Could not load your account.');
  return res.json();
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function AccountPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">Your account</span>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {data ? `Welcome, ${data.user.name.split(' ')[0]}` : 'Welcome'}
        </h1>
      </div>

      <section aria-labelledby="details-h" className="flex flex-col gap-4">
        <h2 id="details-h" className="font-display text-xl font-bold tracking-tight">
          Account details
        </h2>
        {isError && <p className="text-critical">We couldn’t load your account. Refresh the page to try again.</p>}
        <dl className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2">
          {(
            [
              ['Name', data?.user.name],
              ['Email', data?.user.email],
              ['Member since', data && formatDate(data.user.createdAt)],
              [
                'Scanning agreement',
                data?.user.termsAcceptedAt
                  ? `Agreed ${formatDate(data.user.termsAcceptedAt)}`
                  : data && 'Not recorded',
              ],
            ] as const
          ).map(([term, value]) => (
            <div key={term} className="flex flex-col gap-0.5 border-b p-4 sm:px-5 sm:[&:nth-last-child(-n+2)]:border-b-0 last:border-b-0 sm:odd:border-r">
              <dt className="text-xs font-semibold tracking-[0.06em] text-subtle-foreground uppercase">{term}</dt>
              <dd className="truncate">
                {isPending ? <span className="inline-block h-5 w-40 animate-pulse rounded bg-muted" /> : value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <WebsitesSummary />

      {data?.isDemo && <ResetDemo />}
    </div>
  );
}

/** How many websites, how many proven, how many checked automatically, and the way to them. */
function WebsitesSummary() {
  const sites = useDomains();
  const list = sites.data ?? [];
  const proven = list.filter((d) => d.verifiedAt).length;
  const automatic = list.filter((d) => d.verifiedAt && d.rescanInterval !== 'none').length;

  return (
    <section aria-labelledby="sites-h" className="flex flex-col gap-4">
      <h2 id="sites-h" className="font-display text-xl font-bold tracking-tight">
        Your websites
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-lg border bg-card px-5 py-4">
        <p>
          {sites.isPending ? (
            <span className="inline-block h-5 w-64 animate-pulse rounded bg-muted" />
          ) : list.length === 0 ? (
            'No websites yet. Add one to prove it’s yours and get its full check.'
          ) : (
            <>
              <strong className="font-semibold">{plural(list.length, 'website', 'websites')}</strong> ·{' '}
              {proven} proven yours · automatic checks on for {automatic}
            </>
          )}
        </p>
        <Link to="/websites" className="font-semibold text-primary underline-offset-4 hover:underline">
          {list.length === 0 && !sites.isPending ? 'Add a website →' : 'Manage websites →'}
        </Link>
      </div>
    </section>
  );
}

type ResetResult = { demoSite: string; grade: string | null; score: number | null; verified: boolean };

/** "Reset demo": only on the demo account. Puts its demo websites back to where the demo starts. */
function ResetDemo() {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const reset = useMutation({
    mutationFn: async (): Promise<ResetResult> => {
      const res = await fetch('/api/demo/reset', { method: 'POST' }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (!res) throw new Error('We couldn’t reach the Sentry server. Check it’s running and try again.');
      if (!res.ok) throw new Error(body?.error ?? 'We couldn’t reset the demo. Please try again.');
      return body as ResetResult;
    },
    onSuccess: () => {
      setConfirming(false);
      void client.invalidateQueries({ queryKey: ['domains'] });
      void client.invalidateQueries({ queryKey: ['scans'] });
    },
  });

  return (
    <section aria-labelledby="demo-h" className="flex flex-col gap-4">
      <h2 id="demo-h" className="font-display text-xl font-bold tracking-tight">
        Presentation demo
      </h2>
      <div className="flex flex-col gap-3.5 rounded-lg border border-dashed border-primary/40 bg-card p-5 sm:p-6">
        <p className="max-w-[64ch]">
          Puts this account’s demo websites back to where the demo starts: the demo website with five weeks of A
          grades, so <strong className="font-semibold">Run it now</strong> shows the drop to an F and sends the alert
          email again.
        </p>
        <p className="text-sm text-muted-foreground">
          Only the demo account has this. Websites you added yourself aren’t touched.
        </p>

        <div aria-live="polite" className="flex flex-col gap-3">
          {reset.isPending ? (
            <p className="flex items-center gap-2.5 rounded-[10px] bg-muted px-3.5 py-3">
              <Loader2 className="size-4.5 animate-spin text-primary" aria-hidden="true" />
              Resetting the demo…
            </p>
          ) : confirming ? (
            <div className="flex flex-col gap-3 rounded-[10px] bg-muted px-4 py-3.5">
              <p>Reset the demo? Checks run since the last reset will be replaced.</p>
              <div className="flex flex-wrap gap-2.5">
                <Button onClick={() => reset.mutate()}>Yes, reset</Button>
                <Button variant="outline" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="h-11 self-start px-4.5" onClick={() => { reset.reset(); setConfirming(true); }}>
              Reset demo
            </Button>
          )}

          {reset.isError && <FormError message={reset.error.message} />}
          {reset.isSuccess && !confirming && (
            <div className="flex flex-col gap-1 rounded-[10px] bg-pass-soft px-4 py-3.5">
              <span className="flex items-center gap-1.5 font-semibold text-pass">
                <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                Demo reset
              </span>
              <span>
                {reset.data.demoSite} is back to {reset.data.grade === 'A' ? 'an A' : `a ${reset.data.grade}`}
                {reset.data.score !== null ? ` (${reset.data.score})` : ''}. Next:{' '}
                <Link to={`/websites/${reset.data.demoSite}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                  Websites → {reset.data.demoSite} → Run it now
                </Link>
                .
              </span>
              {!reset.data.verified && (
                <span className="text-sm text-muted-foreground">
                  Its ownership proof wasn’t found, so Run it now won’t show until it’s proven again.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
