import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

type Props = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Shown at the end of the label's line, e.g. a "Forgot password?" link. */
  labelAside?: ReactNode;
  children: ReactNode;
};

/** Label above, control, then either the error (how to fix it) or a hint. */
export function FormField({ id, label, hint, error, labelAside, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-semibold">
          {label}
        </Label>
        {labelAside}
      </div>
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
