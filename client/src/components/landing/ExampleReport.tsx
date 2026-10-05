import { Check, RotateCcw } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { motionEnabled } from '@/lib/motion';
import { cn } from '@/lib/utils';

const SCORE = 72;
const CHECKS = ['Secure connection', 'Security certificate', 'Browser protections'];
const FIRST_TICK_MS = 450;
const TICK_GAP_MS = 400;
const COUNT_MS = 900;

type Phase = 'checking' | 'scoring' | 'done';

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex h-6.5 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-semibold', className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * The landing page's example report. On load it plays out like a real scan: three checks tick
 * off, the score counts up to 72, then the grade, pills and findings appear. With reduce-motion
 * (or no JS motion) it simply shows the finished report.
 */
export function ExampleReport() {
  const [animate] = useState(motionEnabled);
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>(animate ? 'checking' : 'done');
  const [ticked, setTicked] = useState(animate ? 0 : CHECKS.length);
  const [score, setScore] = useState(animate ? 0 : SCORE);

  useEffect(() => {
    if (!animate) return;
    const timers: number[] = [];
    let frame = 0;

    setPhase('checking');
    setTicked(0);
    setScore(0);

    CHECKS.forEach((_, i) => {
      timers.push(window.setTimeout(() => setTicked(i + 1), FIRST_TICK_MS + i * TICK_GAP_MS));
    });

    timers.push(
      window.setTimeout(
        () => {
          setPhase('scoring');
          // One clock throughout (rAF's own timestamp can predate performance.now()), clamped to 0..1.
          let start: number | null = null;
          const step = () => {
            const now = performance.now();
            start ??= now;
            const t = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
            setScore(Math.round(easeOutCubic(t) * SCORE));
            if (t < 1) frame = requestAnimationFrame(step);
            else setPhase('done');
          };
          frame = requestAnimationFrame(step);
        },
        FIRST_TICK_MS + CHECKS.length * TICK_GAP_MS + 250,
      ),
    );

    return () => {
      timers.forEach(window.clearTimeout);
      cancelAnimationFrame(frame);
    };
  }, [animate, run]);

  const done = phase === 'done';
  // Results appear in a short cascade once scoring finishes, and hide instantly on replay.
  const appear = (delayMs: number): { className: string; style: CSSProperties } => ({
    className: cn(
      'transition-[opacity,translate] duration-500 ease-out',
      done ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
    ),
    style: { transitionDelay: done ? `${delayMs}ms` : '0ms' },
  });

  return (
    <figure
      aria-label="Example report"
      className="m-0 flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgb(17_26_43/0.05),0_12px_32px_rgb(17_26_43/0.08)] sm:gap-4.5 sm:p-7"
    >
      <div className="flex h-6 items-center justify-between">
        <span className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Example report</span>
        {!done ? (
          <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 animate-[soft-pulse_1s_ease-in-out_infinite] rounded-full bg-primary" aria-hidden="true" />
            Scanning…
          </span>
        ) : animate ? (
          <button
            type="button"
            onClick={() => setRun((r) => r + 1)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Run again
          </button>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">took 0.9s</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {done ? (
          <div
            key={`grade-${run}`}
            aria-label="Grade C"
            className="grid size-16 shrink-0 animate-[pop-in_0.45s_cubic-bezier(0.2,0.8,0.3,1.25)_both] place-items-center rounded-[14px] border-[3px] border-grade-c font-display text-[2.375rem] leading-none font-bold text-grade-c sm:size-19 sm:text-[2.75rem]"
          >
            C
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-[14px] border-[3px] border-dashed border-border font-display text-[2.375rem] leading-none font-bold text-muted-foreground sm:size-19 sm:text-[2.75rem]"
          >
            –
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <div className="font-display text-[1.875rem] leading-none font-bold tabular-nums sm:text-4xl">
            {/* Room for two digits, so "/ 100" doesn't shift as the count goes from 0 to 72. */}
            <span className="inline-block min-w-[2ch] text-right">{score}</span>
            <span className="text-base font-medium text-muted-foreground"> / 100</span>
          </div>
          <div className="text-sm text-muted-foreground sm:text-[0.9375rem]">yourbakery.example</div>
        </div>
      </div>

      <div role="img" aria-label={`Score ${SCORE} out of 100`} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-grade-c" style={{ width: `${score}%` }} />
      </div>

      <div className="relative flex flex-col gap-4 sm:gap-4.5">
        {animate && (
          <ul
            aria-hidden="true"
            className={cn(
              'absolute inset-x-0 top-0 flex flex-col gap-3 pt-1 transition-opacity duration-300',
              phase === 'checking' ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            {CHECKS.map((label, i) => {
              const isDone = ticked > i;
              return (
                <li key={label} className="flex items-center gap-3 text-[0.9375rem]">
                  {isDone ? (
                    <span
                      key={`tick-${run}`}
                      className="grid size-5 animate-[check-in_0.3s_cubic-bezier(0.2,0.8,0.3,1.3)_both] place-items-center rounded-full bg-pass-soft text-pass"
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="size-5 animate-[soft-pulse_1s_ease-in-out_infinite] rounded-full border-2 border-border" />
                  )}
                  <span className={isDone ? 'text-foreground' : 'text-muted-foreground'}>
                    {isDone ? label : `Checking ${label.toLowerCase()}…`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <p {...appear(0)} className={cn(appear(0).className, 'text-[0.9375rem] sm:text-base')}>
          Your site scored a C. 4 issues are putting you at risk. Start with “Browsers aren’t told to always use a
          secure connection”.
        </p>
        <div {...appear(120)} className={cn(appear(120).className, 'flex flex-wrap gap-2')}>
          <Pill className="bg-medium-soft text-medium">2 medium</Pill>
          <Pill className="bg-low-soft text-low">2 low</Pill>
          <Pill className="bg-pass-soft text-pass">6 passed</Pill>
        </div>
        <div className="flex flex-col gap-2.5 pt-1">
          <div
            {...appear(260)}
            className={cn(appear(260).className, 'flex flex-col gap-1.5 rounded-[10px] border border-l-4 border-l-medium p-3.5 sm:px-4')}
          >
            <span className="text-xs font-semibold text-medium">MEDIUM</span>
            <span className="text-[0.9375rem] leading-snug font-semibold">
              Browsers aren’t told to always use a secure connection
            </span>
            <span className="text-sm text-muted-foreground">
              On public Wi-Fi, an attacker can quietly move a visitor to the insecure version of your site.
            </span>
          </div>
          <div
            {...appear(400)}
            className={cn(appear(400).className, 'hidden flex-col gap-1.5 rounded-[10px] border border-l-4 border-l-medium p-3.5 sm:flex sm:px-4')}
          >
            <span className="text-xs font-semibold text-medium">MEDIUM</span>
            <span className="text-[0.9375rem] leading-snug font-semibold">
              Your site doesn’t limit where its content can come from
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}
