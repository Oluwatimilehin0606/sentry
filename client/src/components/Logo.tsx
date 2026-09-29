import { cn } from '@/lib/utils';

/**
 * Sentry's mark, from the user's sketch: a pointed shield (security) split from its top point to
 * its bottom tip by a sharp zig-zag that reads as an "S" (the S in Sentry) and a pulse (monitoring).
 */
const SHIELD_PATH = 'M12 2.3 20 5.9C20 12.4 17.2 18.3 12 21.7 6.8 18.3 4 12.4 4 5.9Z';
const S_PULSE_PATH = 'M12 2.3 8.5 11 15.2 14.9 12 21.7';

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
      <path d={SHIELD_PATH} strokeLinejoin="miter" strokeMiterlimit={3} />
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
