import { useQuery } from '@tanstack/react-query';
import { Globe, Search } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

type Me = {
  user: { id: string; name: string; email: string; createdAt: string; termsAcceptedAt: string | null };
};

async function fetchMe(): Promise<Me> {
  const res = await fetch('/api/me');
  if (!res.ok) throw new Error('Could not load your account.');
  return res.json();
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

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

      <section aria-labelledby="sites-h" className="flex flex-col gap-4">
        <h2 id="sites-h" className="font-display text-xl font-bold tracking-tight">
          Your websites
        </h2>
        <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed bg-card p-6">
          <span className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary">
            <Globe className="size-5" aria-hidden="true" />
          </span>
          <div className="flex max-w-[60ch] flex-col gap-1">
            <p className="font-semibold">Saving and monitoring websites is coming next</p>
            <p className="text-[0.9375rem] text-muted-foreground">
              Soon you’ll add your websites here, prove you own them, and see their grade over time. For
              now, you can run a one-off check from your home page.
            </p>
          </div>
          <Button asChild>
            <Link to="/home">
              <Search aria-hidden="true" />
              Check a website
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
