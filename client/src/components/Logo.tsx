import { cn } from '@/lib/utils';

/**
 * Sentry's mark: a shield (security) with a heartbeat trace shaped like an "S" (monitoring,
 * and the S in Sentry). The S path is the only thing to change if the mark is revised.
 */
const SHIELD_PATH = 'M12 2.8l7.5 3.2v5.4c0 4.9-3.2 9-7.5 10.8-4.3-1.8-7.5-5.9-7.5-10.8V6z';
const S_PULSE_PATH = 'M15.6 7.2H9.9L8.6 10 15.4 13.4 14.1 16.3H8.7';

export function LogoMark({ size = 22, strokeWidth = 2.1, className }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d={SHIELD_PATH} strokeLinejoin="round" />
      <path d={S_PULSE_PATH} strokeLinejoin="miter" />
    </svg>
  );
}

type Props = {
  /** "light" = blue tile on light backgrounds; "onDark" = light-blue tile for dark panels. */
  tone?: 'light' | 'onDark';
  size?: 'sm' | 'md';
};

export function Logo({ tone = 'light', size = 'md' }: Props) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'grid place-items-center',
          size === 'md' ? 'size-9 rounded-[9px]' : 'size-8 rounded-lg',
          tone === 'light' ? 'bg-primary text-primary-foreground' : 'bg-[#6ea2ee] text-[#0b111c]',
        )}
      >
        <LogoMark size={size === 'md' ? 22 : 20} />
      </span>
      <span className={cn('font-display font-bold tracking-tight', size === 'md' ? 'text-[1.375rem]' : 'text-xl')}>
        Sentry
      </span>
    </div>
  );
}
