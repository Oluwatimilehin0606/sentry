import { Loader2, Search } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { checkDomain } from '@/lib/domain';
import { cn } from '@/lib/utils';

type Props = {
  onSubmit: (hostname: string) => void;
  pending?: boolean;
};

export function DomainForm({ onSubmit, pending = false }: Props) {
  const inputId = useId();
  const messageId = useId();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const result = checkDomain(value);
  const showError = touched && !result.ok;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (result.ok && !pending) onSubmit(result.hostname);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-2">
      <Label htmlFor={inputId} className="text-sm font-semibold">
        Your website’s domain
      </Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div
          className={cn(
            'flex flex-1 rounded-md border border-input bg-card transition-[box-shadow,border-color]',
            'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/35',
            showError && 'border-critical focus-within:border-critical focus-within:ring-critical/25',
          )}
        >
          <span className="flex items-center rounded-l-md border-r bg-muted px-3 font-mono text-[0.8125rem] text-subtle-foreground">
            https://
          </span>
          <Input
            id={inputId}
            name="domain"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="yourbakery.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => value && setTouched(true)}
            aria-invalid={showError}
            aria-describedby={messageId}
            className="border-0 focus-visible:ring-0"
          />
        </div>
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
          {pending ? 'Checking…' : 'Check my website'}
        </Button>
      </div>
      <p
        id={messageId}
        aria-live="polite"
        className={cn('text-[0.8125rem]', showError ? 'text-critical' : 'text-muted-foreground')}
      >
        {showError && !result.ok
          ? result.message
          : 'Just the domain, without https:// or a page path. Only check websites you own.'}
      </p>
    </form>
  );
}
