import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function PasswordInput({ className, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={cn(
        'flex rounded-md border border-input bg-card transition-[box-shadow,border-color]',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/35',
        'has-[[aria-invalid=true]]:border-critical has-[[aria-invalid=true]]:focus-within:ring-critical/25',
      )}
    >
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('border-0 focus-visible:ring-0', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="cursor-pointer rounded-r-md px-3 text-[0.8125rem] font-semibold text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
