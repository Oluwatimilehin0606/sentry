import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ScanSummary } from '@/lib/reports';

const GRADE_LINES = [
  { score: 90, label: 'A 90' },
  { score: 80, label: 'B 80' },
  { score: 70, label: 'C 70' },
  { score: 60, label: 'D 60' },
];
const PAD = { top: 30, right: 36, bottom: 34, left: 58 };

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function describe(p: ScanSummary): string {
  return `${longDate.format(new Date(p.scannedAt))} · ${p.mode === 'full' ? 'Full check' : 'Light check'}`;
}

/** Up to `max` evenly spread points to label on the time axis, one per day at most. */
function tickIndexes(points: ScanSummary[], max: number): number[] {
  const picked: number[] = [];
  const step = (points.length - 1) / Math.max(1, max - 1);
  for (let i = 0; i < max; i++) {
    const index = Math.round(i * step);
    const day = shortDate.format(new Date(points[index]!.scannedAt));
    if (!picked.some((j) => shortDate.format(new Date(points[j]!.scannedAt)) === day)) picked.push(index);
  }
  return picked;
}

/**
 * One website's score over time: a single line (so no legend), faint lines where each grade
 * starts, the latest score labelled. Each point is a link to its report, so it works with the
 * keyboard; hovering or focusing shows its date, grade and type. Points are oldest first.
 */
export function ScoreChart({ points, label }: { points: ScanSummary[]; label: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // Measure now too: the observer's first report waits for the browser to paint.
    setWidth(Math.round(box.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const height = width < 520 ? 220 : 260;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const times = points.map((p) => new Date(p.scannedAt).getTime());
  const [first, last] = [times[0]!, times.at(-1)!];
  const x = (i: number) => PAD.left + (last === first ? plotW / 2 : ((times[i]! - first) / (last - first)) * plotW);
  const y = (score: number) => PAD.top + plotH - (score / 100) * plotH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ');
  // Keep the latest date, then any others with room around them (checks close in time would collide).
  const ticks: number[] = [];
  for (const i of tickIndexes(points, width < 520 ? 3 : 5).reverse()) {
    if (ticks.every((j) => Math.abs(x(j) - x(i)) >= 72)) ticks.push(i);
  }
  const latest = points.at(-1)!;
  const shown = active !== null ? points[active] : null;

  /** Nearest point to the pointer, along the time axis. */
  function track(event: React.PointerEvent<SVGSVGElement>) {
    const left = event.currentTarget.getBoundingClientRect().left;
    const px = event.clientX - left;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setActive(best);
  }

  return (
    <div ref={boxRef} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="group"
          aria-label={label}
          onPointerMove={track}
          onPointerLeave={() => setActive(null)}
          className="block touch-pan-y"
        >
          <g className="fill-subtle-foreground text-xs" aria-hidden="true">
            {GRADE_LINES.map((g) => (
              <g key={g.score}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={y(g.score)} y2={y(g.score)} className="stroke-border" />
                <text x={PAD.left - 10} y={y(g.score) + 4} textAnchor="end">
                  {g.label}
                </text>
              </g>
            ))}
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(0)} y2={y(0)} className="stroke-input" />
            <text x={PAD.left - 10} y={y(0) + 4} textAnchor="end">
              0
            </text>
            {ticks.map((i) => (
              <text key={i} x={x(i)} y={height - 10} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
                {shortDate.format(new Date(points[i]!.scannedAt))}
              </text>
            ))}
          </g>

          {shown && (
            <line
              x1={x(active!)}
              x2={x(active!)}
              y1={PAD.top}
              y2={y(0)}
              className="stroke-input"
              aria-hidden="true"
            />
          )}
          <path d={path} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {points.map((p, i) => (
            <Link
              key={p.id}
              to={`/reports/${p.id}`}
              aria-label={`${describe(p)}: ${p.score}, grade ${p.grade}. Open report`}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="focus-visible:outline-none [&:focus-visible>circle:last-child]:stroke-ring"
            >
              {/* A bigger invisible target than the dot, for pointers and fingers. */}
              <circle cx={x(i)} cy={y(p.score)} r={14} fill="transparent" />
              <circle
                cx={x(i)}
                cy={y(p.score)}
                r={i === points.length - 1 || i === active ? 6 : 5}
                fill="var(--chart-line)"
                className="stroke-card"
                strokeWidth={2}
              />
            </Link>
          ))}

          <text
            x={Math.min(x(points.length - 1), PAD.left + plotW)}
            y={y(latest.score) - 14}
            textAnchor="middle"
            className="fill-foreground font-display text-[15px] font-bold"
            aria-hidden="true"
          >
            {latest.score} · {latest.grade}
          </text>
        </svg>
      )}

      {shown && (
        <div
          className="pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col gap-0.5 rounded-lg border bg-muted px-3 py-2 text-[0.8125rem] whitespace-nowrap shadow-md"
          style={{
            left: Math.min(Math.max(x(active!), 90), width - 90),
            top: Math.min(y(shown.score) + 14, height - 70),
          }}
          aria-hidden="true"
        >
          <span className="text-muted-foreground">{describe(shown)}</span>
          <span className="font-display text-base font-bold">
            {shown.score} · {shown.grade}
          </span>
        </div>
      )}
    </div>
  );
}
