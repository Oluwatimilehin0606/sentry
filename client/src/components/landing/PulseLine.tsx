import { useEffect, useRef, useState, type RefObject } from 'react';
import { motionEnabled } from '@/lib/motion';

const CONTENT_MAX = 1152; // max-w-6xl

type Point = { x: number; y: number };
type Geometry = { width: number; height: number; d: string; points: Point[]; cum: number[]; total: number };

/**
 * Builds a vertical "heartbeat" trace down the page's side margin, with an ECG-style blip at
 * each section boundary and halfway through each section. It's a polyline, so lengths and
 * positions along it are computed here directly (no costly SVG measuring in the browser).
 */
function buildGeometry(container: HTMLElement): Geometry {
  const width = container.clientWidth;
  const height = container.scrollHeight;
  const padding = width >= 640 ? 24 : 16;
  const gutter = (width - Math.min(width, CONTENT_MAX)) / 2 + padding;
  const x = Math.max(6, gutter / 2);
  const amp = Math.max(4, Math.min(44, gutter / 2 - 6));

  const beats: number[] = [];
  Array.from(container.querySelectorAll<HTMLElement>(':scope > section')).forEach((s, i) => {
    if (i > 0) beats.push(s.offsetTop + 48);
    beats.push(s.offsetTop + s.offsetHeight / 2);
  });

  const top = 24;
  const bottom = height - 24;
  const points: Point[] = [{ x, y: top }];
  let lastY = top;
  for (const y of beats.sort((a, b) => a - b)) {
    if (y - lastY < 90 || y > bottom - 60) continue;
    // Flat run, then a QRS-style blip: small dip, tall spike, deeper dip, back to the baseline.
    points.push(
      { x, y },
      { x: x - amp * 0.25, y: y + 8 },
      { x: x + amp, y: y + 18 },
      { x: x - amp * 0.55, y: y + 30 },
      { x: x + amp * 0.2, y: y + 38 },
      { x, y: y + 46 },
    );
    lastY = y + 46;
  }
  points.push({ x, y: bottom });

  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  }
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return { width, height, d, points, cum, total: cum[cum.length - 1]! };
}

/** Distance along the line at which it first reaches height y (y only ever increases along it). */
function lengthAtY(g: Geometry, y: number): number {
  const { points, cum } = g;
  if (y <= points[0]!.y) return 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (b.y >= y) {
      const t = b.y === a.y ? 1 : (y - a.y) / (b.y - a.y);
      return cum[i - 1]! + t * (cum[i]! - cum[i - 1]!);
    }
  }
  return g.total;
}

function pointAtLength(g: Geometry, len: number): Point {
  const { points, cum } = g;
  for (let i = 1; i < points.length; i++) {
    if (cum[i]! >= len) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const seg = cum[i]! - cum[i - 1]!;
      const t = seg === 0 ? 0 : (len - cum[i - 1]!) / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return points[points.length - 1]!;
}

/** Background heartbeat line for the landing page that draws itself as the visitor scrolls. */
export function PulseLine({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const [geo, setGeo] = useState<Geometry | null>(null);
  const pathRef = useRef<SVGPathElement>(null);
  // The beating tip is an HTML element, not SVG: its CSS animation then runs on the compositor
  // instead of re-rendering on the main thread every frame.
  const tipRef = useRef<HTMLDivElement>(null);
  const [animate] = useState(motionEnabled);

  // Build after first paint (it's decoration, so it never delays the page), and again only
  // when the page's size really changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let size = '';
    let timer = 0;
    const rebuild = () => {
      const next = `${el.clientWidth}x${el.scrollHeight}`;
      if (next === size) return;
      size = next;
      setGeo(buildGeometry(el));
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(rebuild, 150);
    };
    const start = window.setTimeout(rebuild, 300);
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, [containerRef]);

  // Draw the line up to the tip, which follows the scroll.
  useEffect(() => {
    const el = containerRef.current;
    const path = pathRef.current;
    const tip = tipRef.current;
    if (!el || !path || !geo) return;

    path.style.strokeDasharray = `${geo.total}`;
    if (!animate || !tip) {
      path.style.strokeDashoffset = '0';
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      // The tip sits ~62% down the screen, easing to the bottom edge as the page ends,
      // so the line completes exactly when the visitor reaches the bottom.
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 1;
      const targetY = -el.getBoundingClientRect().top + window.innerHeight * (0.62 + 0.5 * progress ** 3);
      const len = Math.max(0, Math.min(geo.total, lengthAtY(geo, targetY)));
      path.style.strokeDashoffset = `${geo.total - len}`;
      const p = pointAtLength(geo, len);
      tip.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      tip.style.opacity = len > 4 ? '1' : '0';
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [geo, animate, containerRef]);

  if (!geo) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] text-primary">
      <svg focusable="false" className="absolute inset-0" width={geo.width} height={geo.height} viewBox={`0 0 ${geo.width} ${geo.height}`}>
        {/* Faint full course, so the line reads as a trace being filled in. */}
        <path d={geo.d} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={1.5} strokeLinejoin="round" />
        <path
          ref={pathRef}
          d={geo.d}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {animate && (
        <div ref={tipRef} className="absolute top-0 left-0 opacity-0 transition-opacity duration-300 will-change-transform">
          <span className="pulse-ring absolute -top-[9px] -left-[9px] size-[18px] rounded-full bg-current" />
          <span className="pulse-dot absolute -top-1 -left-1 size-2 rounded-full bg-current" />
        </div>
      )}
    </div>
  );
}
