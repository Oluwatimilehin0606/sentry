import { Check, Globe, Loader2, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AddWebsiteDialog } from '@/components/AddWebsiteDialog';
import { FormError } from '@/components/FormError';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { scheduleLine, useDomains, useRemoveDomain, type Domain } from '@/lib/domains';
import { GRADE_COLOR } from '@/lib/grading';
import { latestPerWebsite, useRecentScans, type ScanSummary } from '@/lib/reports';
import { cn } from '@/lib/utils';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function when(iso: string): string {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString() ? 'today' : dateFormat.format(date);
}

/* ---------- One website ---------- */

function RemoveDialog({ domain, onClose }: { domain: Domain | null; onClose: () => void }) {
  const remove = useRemoveDomain();
  return (
    <Dialog open={!!domain} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>Remove {domain?.hostname}?</DialogTitle>
        <DialogDescription>
          You can add it again later, but you’d need to prove it’s yours again to get its full check.
        </DialogDescription>
        {remove.isError && <FormError message={remove.error.message} />}
        <div className="flex justify-end gap-2.5">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-11">
              Keep it
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            className="h-11 px-5"
            disabled={remove.isPending}
            onClick={() => domain && remove.mutate(domain.id, { onSuccess: onClose })}
          >
            {remove.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Remove website
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WebsiteRow({ domain, last, onRemove }: { domain: Domain; last?: ScanSummary; onRemove: () => void }) {
  const navigate = useNavigate();
  const verified = !!domain.verifiedAt;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-t px-5 py-4 first:border-t-0 md:grid-cols-[minmax(0,1fr)_170px_200px_150px_auto]">
      <div className="flex min-w-0 flex-col">
        <Link
          to={`/websites/${domain.hostname}`}
          className="self-start rounded-md text-[1.0625rem] font-semibold text-primary [overflow-wrap:anywhere] hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {domain.hostname}
        </Link>
        <span className="text-sm text-muted-foreground">{scheduleLine(domain) ?? `Added ${when(domain.createdAt)}`}</span>
      </div>

      <span
        className={cn(
          'col-start-1 flex items-center gap-2 text-[0.9375rem] font-semibold md:col-start-auto',
          verified ? 'text-pass' : 'text-medium',
        )}
      >
        {verified ? (
          <span className="grid size-5 place-items-center rounded-full bg-pass-soft" aria-hidden="true">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : (
          <span className="size-5 rounded-full border-2 border-medium" aria-hidden="true" />
        )}
        {verified ? 'Verified' : 'Waiting for proof'}
      </span>

      <span className="hidden text-[0.9375rem] md:flex md:items-center md:gap-2">
        {verified ? (
          last ? (
            <>
              <span className="font-display text-lg font-bold" style={{ color: GRADE_COLOR[last.grade] }}>
                {last.grade}
              </span>
              {last.score} · {when(last.scannedAt)}
              {last.change && last.change.scoreDelta !== 0 && (
                <span className={cn('font-semibold', last.change.scoreDelta > 0 ? 'text-pass' : 'text-critical')}>
                  {last.change.scoreDelta > 0 ? `▲ ${last.change.scoreDelta}` : `▼ ${-last.change.scoreDelta}`}
                  <span className="sr-only"> points since the check before</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Not checked yet</span>
          )
        ) : (
          <span className="text-muted-foreground">Light check only</span>
        )}
      </span>

      {verified ? (
        <Button
          variant="outline"
          className="col-start-2 row-start-1 h-10 md:col-start-auto md:row-start-auto"
          onClick={() => navigate('/home', { state: { check: domain.hostname } })}
        >
          Full check
        </Button>
      ) : (
        <Button asChild className="col-start-2 row-start-1 h-10 md:col-start-auto md:row-start-auto">
          <Link to={`/websites/${domain.hostname}`}>Finish verifying</Link>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`More options for ${domain.hostname}`}
            className="col-start-2 row-start-2 justify-self-end md:col-start-auto md:row-start-auto"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            Remove website
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/* ---------- Page ---------- */

export function WebsitesPage() {
  const sites = useDomains();
  const recent = latestPerWebsite(useRecentScans().data);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Domain | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[2rem] leading-[1.1] font-bold tracking-tight sm:text-[2.25rem]">Your websites</h1>
          <p className="text-muted-foreground">Prove a website is yours to get its full check, including private files.</p>
        </div>
        <Button className="h-12 self-start px-5 sm:self-auto" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          Add website
        </Button>
      </div>

      {sites.isPending ? (
        <div role="status" className="flex items-center gap-3 rounded-[14px] border bg-card p-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Loading your websites…
        </div>
      ) : sites.isError ? (
        <FormError message={sites.error.message} />
      ) : sites.data.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[14px] border border-dashed border-input bg-card p-6">
          <span className="grid size-[42px] place-items-center rounded-[10px] bg-primary-soft text-primary">
            <Globe className="size-[22px]" aria-hidden="true" />
          </span>
          <h2 className="font-display text-lg font-bold tracking-tight">No websites yet</h2>
          <p className="text-[0.9375rem] text-muted-foreground">Add one to get its full check.</p>
          <Button className="h-11" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add website
          </Button>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[14px] border bg-card">
          {sites.data.map((d) => (
            <WebsiteRow
              key={d.id}
              domain={d}
              last={recent.find((r) => r.hostname === d.hostname)}
              onRemove={() => setRemoving(d)}
            />
          ))}
        </ul>
      )}

      <AddWebsiteDialog open={adding} onOpenChange={setAdding} />
      <RemoveDialog domain={removing} onClose={() => setRemoving(null)} />
    </div>
  );
}
