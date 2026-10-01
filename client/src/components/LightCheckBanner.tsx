import { FileWarning, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { FormError } from '@/components/FormError';
import { Button } from '@/components/ui/button';
import { useAddDomain, useDomains } from '@/lib/domains';

/**
 * Shown under a light check's grade: what wasn't checked, and the way to the full check.
 * "Verify ownership" adds the website to the account if needed, then opens its proof page.
 */
export function LightCheckBanner({ hostname }: { hostname: string }) {
  const navigate = useNavigate();
  const sites = useDomains();
  const add = useAddDomain();

  async function verify() {
    const existing = sites.data?.find((d) => d.hostname === hostname);
    const domain = existing ?? (await add.mutateAsync(hostname).catch(() => null));
    if (domain) navigate(`/websites/${domain.hostname}`);
  }

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-primary/25 bg-primary-soft p-5 sm:flex-row sm:items-center">
      <span className="grid size-[42px] shrink-0 place-items-center rounded-[10px] bg-card text-primary">
        <FileWarning className="size-[22px]" aria-hidden="true" />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <h3 className="font-semibold">Private files weren’t checked</h3>
        <p className="text-[0.9375rem] text-muted-foreground">
          This was a light check: it only looked at what any browser sees. Prove {hostname} is yours to also check for
          exposed passwords, backups and code.
        </p>
        {add.isError && <FormError message={add.error.message} />}
      </div>
      <Button className="h-11 shrink-0 self-start px-4.5 sm:self-auto" onClick={verify} disabled={add.isPending}>
        {add.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Verify ownership
      </Button>
    </div>
  );
}
