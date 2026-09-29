import { useEffect, useRef } from 'react';
import { motionEnabled } from '@/lib/motion';

/**
 * A subtle heart-monitor trace behind the landing page. A bright point sweeps left to right,
 * drawing a smooth heartbeat; the trace behind it fades, and at the right edge it wraps round,
 * like a hospital monitor. Fixed to the viewport, so the page scrolls over it.
 * With reduce-motion it draws one still, faint trace instead.
 */

const SPEED = 170; // px per second
const MAX_DPR = 2;

/** Smooth heartbeat shape for one beat, phase 0..1 → vertical offset (-1..1, up is negative). */
function beat(phase: number): number {
  const g = (center: number, width: number, height: number) =>
    height * Math.exp(-((phase - center) ** 2) / (2 * width * width));
  return (
    g(0.2, 0.035, -0.12) + // P wave: small soft bump
    g(0.42, 0.018, 0.14) + // dip before the beat
    g(0.47, 0.022, -1) + // main beat, rounded rather than spiky
    g(0.53, 0.024, 0.32) + // rebound
    g(0.74, 0.06, -0.24) // T wave: wide gentle bump
  );
}

function readColor(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  return value || '#1f5fad';
}

export function MonitorWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const head$ = headRef.current;
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let period = 0; // px per heartbeat
    let amp = 0; // px
    let baseY = 0;
    let color = readColor();
    const isDark = () => document.documentElement.classList.contains('dark');

    const yAt = (x: number) => baseY + amp * beat(((x % period) + period) % period / period);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      period = Math.max(260, Math.min(420, width / 3.2));
      amp = Math.max(28, Math.min(64, height * 0.07));
      baseY = height * 0.52;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
    };

    const strokeAlpha = () => (isDark() ? 0.32 : 0.22);

    // Reduce-motion: one still, faint trace across the screen.
    const drawStill = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = strokeAlpha() * 0.7;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        if (x === 0) ctx.moveTo(x, yAt(x));
        else ctx.lineTo(x, yAt(x));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    resize();

    if (!motionEnabled()) {
      if (head$) head$.hidden = true;
      drawStill();
      const onResize = () => {
        resize();
        drawStill();
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    let head = 0;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      // Cap the step so a background tab doesn't jump the trace when it comes back.
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      // Fade everything drawn so far a little: the monitor's trailing glow.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 0.5)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      const from = head;
      const to = head + SPEED * dt;

      // Clear a narrow band just ahead of the head, like the gap on a real monitor.
      ctx.clearRect(to % width, 0, 22, height);

      ctx.strokeStyle = color;
      ctx.globalAlpha = strokeAlpha();
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      for (let x = from; x <= to; x += 1.5) {
        const sx = x % width;
        if (x === from || sx < (x - 1.5) % width) ctx.moveTo(sx, yAt(x));
        else ctx.lineTo(sx, yAt(x));
      }
      ctx.lineTo(to % width, yAt(to));
      ctx.stroke();

      ctx.globalAlpha = 1;

      // The glowing point at the head is a separate element (moved on the compositor), so it
      // doesn't smear into the fading trace.
      if (head$) head$.style.transform = `translate3d(${(to % width).toFixed(1)}px, ${yAt(to).toFixed(1)}px, 0)`;

      head = to;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame((now) => {
      last = now;
      tick(now);
    });

    const onResize = () => {
      resize();
      ctx.clearRect(0, 0, width, height);
    };
    // Pick up theme changes (light/dark) for the stroke colour.
    const themeObserver = new MutationObserver(() => {
      color = readColor();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 text-primary">
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <div ref={headRef} className="absolute top-0 left-0 will-change-transform">
        <span className="absolute -top-1 -left-1 size-2 rounded-full bg-current opacity-45 shadow-[0_0_10px_3px_currentColor]" />
      </div>
    </div>
  );
}
