/* global localStorage, matchMedia, document, window */
// Runs before first paint (a plain, blocking script in <head>), so dark mode doesn't flash light.
// It's a file rather than inline so Sentry's Content-Security-Policy can forbid inline scripts.
// "js-motion" switches on entrance animations; without it (no JS, or reduce-motion) everything shows as-is.
try {
  var t = localStorage.getItem('sentry-theme');
  if (t === 'dark' || ((t === null || t === 'system') && matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.add('dark');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window)
    document.documentElement.classList.add('js-motion');
} catch {
  // Storage blocked (e.g. private mode): keep the default look.
}
