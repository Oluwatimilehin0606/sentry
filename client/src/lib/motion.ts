import { useEffect } from 'react';

/** True when entrance animations are allowed (set on <html> by index.html before first paint). */
export function motionEnabled(): boolean {
  return document.documentElement.classList.contains('js-motion');
}

/**
 * Adds `.is-visible` to every `[data-reveal]` element once it scrolls into view.
 * Elements already on screen reveal immediately; each element reveals only once.
 */
export function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)'));
    if (!motionEnabled() || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
