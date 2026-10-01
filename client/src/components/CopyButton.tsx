import { useRef, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';

/**
 * Copies `text`. If the browser blocks the clipboard, it selects the text in `selectRef` instead
 * so it can be copied by hand, and says so.
 */
export function CopyButton({
  text,
  selectRef,
  label = 'Copy',
  className,
}: {
  text: string;
  selectRef: RefObject<HTMLElement | null>;
  /** Accessible name, e.g. "Copy value". */
  label?: string;
  className?: string;
}) {
  const [shown, setShown] = useState('Copy');
  const timer = useRef<number>(undefined);
  const flash = (next: string) => {
    setShown(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown('Copy'), 2500);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash('Copied');
    } catch {
      const range = document.createRange();
      if (selectRef.current) range.selectNodeContents(selectRef.current);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      flash('Selected, press Ctrl+C');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={shown === 'Copy' ? label : undefined}
      className={cn(
        'h-7 shrink-0 rounded-md border bg-card px-2.5 text-[0.8125rem] font-semibold transition-colors hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <span aria-live="polite">{shown}</span>
    </button>
  );
}
