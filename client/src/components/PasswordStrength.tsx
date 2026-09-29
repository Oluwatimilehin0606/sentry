import { passwordStrength } from '@/lib/password-strength';
import { cn } from '@/lib/utils';

const BAR_COLOR = ['', 'bg-critical', 'bg-medium', 'bg-primary', 'bg-pass'] as const;
const TEXT_COLOR = ['text-muted-foreground', 'text-critical', 'text-medium', 'text-primary', 'text-pass'] as const;

/** Four-segment strength meter with a plain-English label and tip. */
export function PasswordStrength({ password, id }: { password: string; id: string }) {
  const { score, label, hint } = passwordStrength(password);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={label || 'Not entered'}
        className="grid grid-cols-4 gap-1.5"
      >
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={cn('h-1 rounded-full transition-colors duration-300', n <= score ? BAR_COLOR[score] : 'bg-muted')}
          />
        ))}
      </div>
      <p id={id} aria-live="polite" className={cn('text-[0.8125rem]', TEXT_COLOR[score])}>
        {label && <span className="font-semibold">{label} · </span>}
        <span className={label ? 'text-muted-foreground' : undefined}>{hint}</span>
      </p>
    </div>
  );
}
