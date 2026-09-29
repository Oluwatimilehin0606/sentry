import { useEffect, useRef } from 'react';
import { motionEnabled } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * A subtle heart-monitor trace behind the landing page. A glowing point sweeps left to right,
 * drawing an ECG: flat baseline, then sharp heartbeat spikes of varying height. Like a real
 * monitor, a band just ahead of the point is wiped as it moves, so when the sweep wraps round
 * the new trace never overlaps the old one. Fixed to the viewport, so the page scrolls over it.
 * With reduce-motion it draws one still, faint trace instead.
 */

const SPEED = 170; // px per second
const MAX_DPR = 2;

/** One heartbeat (PQRST) as [x, y] points; y is in beat units, up is negative. Sharp corners. */
const COMPLEX: [number, number][] = [
  [0, 0],
  [8, -0.14], // P: small bump
  [16, 0],
  [30, 0],
  [34, 0.16], // Q: small dip
  [42, -1], // R: tall sharp spike
  [50, 0.55], // S: sharp dip below the line
  [56, 0],
  [80, 0],
  [92, -0.2], // T: small bump
  [104, 0],
];
const COMPLEX_WIDTH = 104;

/**
 * The repeating strip: beats of different heights with flat baseline between them, like the
 * example (small, tall, medium, tall, then a small blip). Starts are ≥ 190 apart and each beat is
 * 104 wide, so beats never run into each other.
 */
const STRIP: { at: number; height: number }[] = [
  { at: 60, height: 0.45 },
  { at: 260, height: 1 },
  { at: 470, height: 0.7 },
  { at: 660, height: 0.95 },
  { at: 860, height: 0.28 },
];
const STRIP_LENGTH = 1060;

function complexAt(u: number): number {
  for (let i = 1; i < COMPLEX.length; i++) {
    const [x1, y1] = COMPLEX[i]!;
    if (u <= x1) {
      const [x0, y0] = COMPLEX[i - 1]!;
      return y0 + ((y1 - y0) * (u - x0)) / (x1 - x0);
    }
  }
  return 0;
}

/** Vertical offset of the trace (in beat units) at strip position u. */
function stripAt(u: number): number {
  for (const beat of STRIP) {
    const local = u - beat.at;
    if (local >= 0 && local <= COMPLEX_WIDTH) return beat.height * complexAt(local);
  }
  return 0;
}

function readColor(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  return value || '#1f5fad';
}

type Props = {
  /** Where the wave sits. Defaults to the whole viewport, behind the page. */
  className?: string;
  /** Vertical position of the baseline, as a fraction of the container's height. */
  baseline?: number;
  /** Trace opacity in light and dark themes. */
  alpha?: { light: number; dark: number };
  /** Fixed colour (e.g. on a dark brand panel); defaults to the theme's primary colour. */
  color?: string;
  /** Spike height as a fraction of the container's height. */
  ampRatio?: number;
};

export function MonitorWave({
  className = 'fixed inset-0 z-0',
  baseline = 0.52,
  alpha = { light: 0.28, dark: 0.4 },
  color: fixedColor,
  ampRatio = 0.09,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const head$ = headRef.current;
    if (!wrapper || !canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let scaleX = 1; // strip units → px
    let amp = 0; // px for a full-height spike
    let baseY = 0;
    let eraseBand = 0; // px wiped ahead of the head
    let color = fixedColor ?? readColor();
    const isDark = () => document.documentElement.classList.contains('dark');

    const yAt = (x: number) => {
      const u = (((x / scaleX) % STRIP_LENGTH) + STRIP_LENGTH) % STRIP_LENGTH;
      return baseY + amp * stripAt(u);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = Math.max(1, wrapper.clientWidth);
      height = Math.max(1, wrapper.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scaleX = Math.max(0.75, Math.min(1.25, width / 1200));
      amp = Math.max(28, Math.min(84, height * ampRatio));
      baseY = height * baseline;
      eraseBand = Math.max(80, width * 0.12);
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 4;
      ctx.lineCap = 'round';
    };

    const strokeAlpha = () => (isDark() ? alpha.dark : alpha.light);

    const setStroke = () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = strokeAlpha();
      // A soft neon glow, kept faint so the trace stays in the background.
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
    };

    // Reduce-motion: one still, faint trace across the screen.
    const drawStill = () => {
      ctx.clearRect(0, 0, width, height);
      setStroke();
      ctx.globalAlpha = strokeAlpha() * 0.8;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 1) {
        if (x === 0) ctx.moveTo(x, yAt(x));
        else ctx.lineTo(x, yAt(x));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    resize();

    if (!motionEnabled()) {
      if (head$) head$.hidden = true;
      drawStill();
      const still = new ResizeObserver(() => {
        resize();
        drawStill();
      });
      still.observe(wrapper);
      return () => still.disconnect();
    }

    let head = 0;
    let last = performance.now();
    let frame = 0;

    /** Wipe the band just ahead of the head (wrapping at the right edge). */
    const eraseAhead = (headX: number) => {
      const start = headX + 3;
      const end = start + eraseBand;
      ctx.clearRect(start, 0, Math.min(end, width) - start, height);
      if (end > width) ctx.clearRect(0, 0, end - width, height);
    };

    const tick = (now: number) => {
      // Cap the step so a background tab doesn't jump the trace when it comes back.
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      // A gentle fade, so the oldest part of the trace (just ahead of the wipe) is the dimmest.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 0.12)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      const from = head;
      const to = head + SPEED * dt;

      setStroke();
      ctx.beginPath();
      let prevSx = Infinity;
      for (let x = from; x <= to; x += 1) {
        const sx = x % width;
        if (sx < prevSx) ctx.moveTo(sx, yAt(x)); // first point, or wrapped round to the left
        else ctx.lineTo(sx, yAt(x));
        prevSx = sx;
      }
      const toX = to % width;
      if (toX >= prevSx) ctx.lineTo(toX, yAt(to));
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      eraseAhead(toX);

      // The glowing point at the head is a separate element (moved on the compositor), so it
      // doesn't smear into the trace.
      if (head$) head$.style.transform = `translate3d(${toX.toFixed(1)}px, ${yAt(to).toFixed(1)}px, 0)`;

      head = to;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame((now) => {
      last = now;
      tick(now);
    });

    // Follow the container's size (the viewport for the page, or a panel).
    const sizeObserver = new ResizeObserver(() => {
      resize();
      ctx.clearRect(0, 0, width, height);
    });
    sizeObserver.observe(wrapper);
    // Pick up theme changes (light/dark) for the stroke colour.
    const themeObserver = new MutationObserver(() => {
      color = fixedColor ?? readColor();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [baseline, ampRatio, fixedColor, alpha.light, alpha.dark]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className={cn('pointer-events-none text-primary', className)}
      style={fixedColor ? { color: fixedColor } : undefined}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <div ref={headRef} className="absolute top-0 left-0 will-change-transform">
        <span className="absolute -top-1 -left-1 size-2 rounded-full bg-current opacity-60 shadow-[0_0_12px_4px_currentColor]" />
      </div>
    </div>
  );
}
