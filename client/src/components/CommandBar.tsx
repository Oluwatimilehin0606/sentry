import { Loader2, Search } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { checkDomain } from '@/lib/domain';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (hostname: string) => void;
  pending?: boolean;
};

/** The home page's large "check a website" bar, with plain-English validation. */
export function CommandBar({ value, onChange, onSubmit, pending = false }: Props) {
  const inputId = useId();
  const messageId = useId();
  const [touched, setTouched] = useState(false);

  const result = checkDomain(value);
  const showError = touched && !result.ok;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (result.ok && !pending) onSubmit(result.hostname);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-[880px] flex-col gap-2">
      <label htmlFor={inputId} className="sr-only">
        Your website’s domain
      </label>
      <div className="flex flex-col gap-2.5 rounded-[14px] border bg-card p-2.5 shadow-[0_1px_2px_rgb(17_26_43/0.05),0_10px_28px_rgb(17_26_43/0.07)] sm:flex-row">
        <div
          className={cn(
            'flex flex-1 overflow-hidden rounded-[10px] border border-input transition-[box-shadow,border-color]',
            'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
            showError && 'border-critical focus-within:border-critical focus-within:ring-critical/25',
          )}
        >
          <span className="flex items-center border-r bg-muted px-3.5 font-mono text-sm text-muted-foreground">https://</span>
          <input
            id={inputId}
            name="domain"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="yourbakery.com"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => value && setTouched(true)}
            aria-invalid={showError}
            aria-describedby={messageId}
            className="h-14 min-w-0 flex-1 bg-transparent px-3.5 text-lg outline-none placeholder:text-subtle-foreground"
          />
        </div>
        <Button type="submit" disabled={pending} aria-busy={pending} className="h-14 px-6 text-[1.0625rem]">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
          {pending ? 'Checking…' : 'Check website'}
        </Button>
      </div>
      <p id={messageId} aria-live="polite" className={cn('text-[0.8125rem]', showError ? 'text-critical' : 'text-muted-foreground')}>
        {showError && !result.ok ? result.message : 'Just the domain, without https:// or a page path. Only check websites you own.'}
      </p>
    </form>
  );
}
