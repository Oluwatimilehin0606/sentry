import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Sentry's mark, from the user's sketch: a pointed shield split from its top point to its bottom
 * tip by a sharp zig-zag that reads as an "S" (the S in Sentry) and a pulse (monitoring).
 * Drawn two-tone: a solid left half and a softer right half, with the S as a cut-out gap.
 */
const LEFT_HALF = 'M12 2.3 8.7 10.1 14 14.2 12 21.7C7.2 18.4 4.6 12.5 4.8 6.4Z';
const RIGHT_HALF = 'M12 2.3 19.2 6.4C19.4 12.5 16.8 18.4 12 21.7L14 14.2 8.7 10.1Z';
const S_CUT = 'M12 2.3 8.7 10.1 14 14.2 12 21.7';

export function LogoMark({ size = 22, gap = 1.2, className }: { size?: number; gap?: number; className?: string }) {
  // Each instance needs its own mask id.
  const maskId = `sentry-s-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <path d={S_CUT} fill="none" stroke="black" strokeWidth={gap} strokeLinejoin="miter" strokeLinecap="butt" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`} fill="currentColor">
        <path d={LEFT_HALF} />
        <path d={RIGHT_HALF} opacity={0.5} />
      </g>
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
        <LogoMark size={size === 'md' ? 24 : 22} />
      </span>
      <span className={cn('font-display font-bold tracking-tight', size === 'md' ? 'text-[1.375rem]' : 'text-xl')}>
        Sentry
      </span>
    </div>
  );
}
