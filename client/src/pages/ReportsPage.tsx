import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { FormError } from '@/components/FormError';
import { Button } from '@/components/ui/button';
import { useDomains } from '@/lib/domains';
import { GRADE_COLOR } from '@/lib/grading';
import { latestPerWebsite, useRecentScans, useScanList, whenChecked, type ScanSummary } from '@/lib/reports';
import { cn } from '@/lib/utils';

export function ModeTag({ mode, trigger }: { mode: 'full' | 'light'; trigger?: 'manual' | 'scheduled' }) {
  const tag = (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap',
        mode === 'full' ? 'bg-pass-soft text-pass' : 'bg-muted text-muted-foreground',
      )}
    >
      {mode === 'full' ? 'Full check' : 'Light check'}
    </span>
  );
  if (trigger !== 'scheduled') return tag;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {tag}
      <span className="inline-flex rounded-full border border-input px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-muted-foreground">
        Automatic
      </span>
    </span>
  );
}

const COLS = 'md:grid-cols-[200px_minmax(0,1fr)_200px_100px_110px]';

function Row({ scan }: { scan: ScanSummary }) {
  return (
    <li
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t px-5 py-4 md:gap-5',
        COLS,
      )}
    >
      <span className="col-start-1 row-start-2 text-sm text-muted-foreground md:row-start-auto md:text-base md:text-foreground">
        {whenChecked(scan.scannedAt)}
      </span>
      <span className="col-start-1 row-start-1 font-semibold [overflow-wrap:anywhere] md:col-start-auto md:row-start-auto">
        {scan.hostname}
      </span>
      <span className="col-start-1 row-start-3 md:col-start-auto md:row-start-auto">
        <ModeTag mode={scan.mode} trigger={scan.trigger} />
      </span>
      <span className="col-start-2 row-start-1 flex items-baseline gap-2 md:col-start-auto md:row-start-auto">
        <span className="font-display text-xl font-bold" style={{ color: GRADE_COLOR[scan.grade] }}>
          {scan.grade}
        </span>
        <span className="tabular-nums">{scan.score}</span>
      </span>
      <Link
        to={`/reports/${scan.id}`}
        className="col-start-2 row-span-2 row-start-2 self-center justify-self-end rounded-md font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none md:col-start-auto md:row-span-1 md:row-start-auto"
      >
        View report<span className="sr-only"> for {scan.hostname}, {whenChecked(scan.scannedAt)}</span>
      </Link>
    </li>
  );
}

/** Every check the account has run, newest first, with a filter per website. */
export function ReportsPage() {
  const [hostname, setHostname] = useState<string | undefined>();
  const list = useScanList(hostname);
  const recent = useRecentScans();
  const sites = useDomains();

  // Filter choices: the account's websites plus anything it has checked recently.
  const hostnames = [
    ...new Set([...(sites.data ?? []).map((d) => d.hostname), ...latestPerWebsite(recent.data).map((s) => s.hostname)]),
  ];
  const scans = list.data?.pages.flatMap((p) => p.scans) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[2rem] leading-[1.1] font-bold tracking-tight sm:text-[2.25rem]">Reports</h1>
        <p className="text-muted-foreground">Every check you’ve run, newest first. Open one to see its full report.</p>
      </div>

      {hostnames.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by website">
          {[undefined, ...hostnames].map((h) => (
            <button
              key={h ?? 'all'}
              type="button"
              aria-pressed={hostname === h}
              onClick={() => setHostname(h)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                hostname === h ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
              )}
            >
              {h ?? 'All websites'}
            </button>
          ))}
        </div>
      )}

      {list.isPending ? (
        <div role="status" className="flex items-center gap-3 rounded-[14px] border bg-card p-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Loading your reports…
        </div>
      ) : list.isError ? (
        <FormError message={list.error.message} />
      ) : scans.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[14px] border border-dashed border-input bg-card p-6">
          <span className="grid size-[42px] place-items-center rounded-[10px] bg-primary-soft text-primary">
            <FileText className="size-[22px]" aria-hidden="true" />
          </span>
          <h2 className="font-display text-lg font-bold tracking-tight">No reports yet</h2>
          <p className="text-[0.9375rem] text-muted-foreground">
            {hostname
              ? `You haven’t checked ${hostname} yet.`
              : 'Check a website from Home and its report will be saved here.'}
          </p>
          <Button asChild className="h-11">
            <Link to="/home">Go to Home</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[14px] border bg-card">
          <div
            className={cn(
              'hidden gap-5 bg-muted px-5 py-3 text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase md:grid',
              COLS,
            )}
            aria-hidden="true"
          >
            <span>Checked</span>
            <span>Website</span>
            <span>Type</span>
            <span>Grade</span>
            <span />
          </div>
          <ul className="[&>li:first-child]:border-t-0 md:[&>li:first-child]:border-t">
            {scans.map((s) => (
              <Row key={s.id} scan={s} />
            ))}
          </ul>
          {list.hasNextPage && (
            <div className="border-t p-3.5 text-center">
              <Button
                variant="outline"
                className="h-10"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {list.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden="true" />}
                Show older checks
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
