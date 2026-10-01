import { Loader2 } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { FormError } from '@/components/FormError';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { checkDomain } from '@/lib/domain';
import { useAddDomain } from '@/lib/domains';
import { cn } from '@/lib/utils';

/** Asks for a domain, adds it to the account, then opens its "Prove it's yours" page. */
export function AddWebsiteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const add = useAddDomain();
  const inputId = useId();
  const messageId = useId();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const result = checkDomain(value);
  const showError = touched && !result.ok;

  useEffect(() => {
    if (!open) {
      setValue('');
      setTouched(false);
      add.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog closes
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!result.ok || add.isPending) return;
    const domain = await add.mutateAsync(result.hostname).catch(() => null);
    if (domain) {
      onOpenChange(false);
      navigate(`/websites/${domain.hostname}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Add a website</DialogTitle>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-sm font-semibold">
              Your website’s domain
            </label>
            <div
              className={cn(
                'flex h-12 overflow-hidden rounded-[9px] border border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
                showError && 'border-critical focus-within:border-critical focus-within:ring-critical/25',
              )}
            >
              <span className="flex items-center border-r bg-muted px-3 font-mono text-sm text-muted-foreground">https://</span>
              <input
                id={inputId}
                autoFocus
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="yourbakery.com"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => value && setTouched(true)}
                aria-invalid={showError}
                aria-describedby={messageId}
                className="min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-subtle-foreground"
              />
            </div>
            <DialogDescription id={messageId} className={cn('text-sm', showError && 'text-critical')}>
              {showError && !result.ok ? result.message : 'Next, we’ll show you one line to add to your domain’s settings.'}
            </DialogDescription>
          </div>
          {add.isError && <FormError message={add.error.message} />}
          <div className="flex justify-end gap-2.5">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={add.isPending} aria-busy={add.isPending} className="h-11 px-5">
              {add.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Continue
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
