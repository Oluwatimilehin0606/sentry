import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

type Props = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

/** Label above, control, then either the error (how to fix it) or a hint. */
export function FormField({ id, label, hint, error, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-[0.8125rem] text-critical">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-[0.8125rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
