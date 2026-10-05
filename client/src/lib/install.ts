import { useSyncExternalStore } from 'react';

/**
 * "Install the Sentry app". Chrome, Edge and Android offer installing through an event that can
 * fire before any page has drawn, so it's caught here as soon as the website starts (startInstallWatch
 * in main.tsx) and kept until the account menu asks for it. iPhones have no such event: Safari's
 * own Share → Add to Home Screen is the only way, so the menu shows those steps instead.
 */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export function startInstallWatch() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the browser's own mini-banner away; the account menu offers it instead.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    changed();
  });
}

/** In the service worker's care only on the real website (not while developing). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // No service worker (private window, old browser): Sentry works the same, just not installable.
    });
  });
}

const runningAsApp = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIphone = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  // iPads say "Macintosh" now; a touch screen gives them away.
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

type InstallState = { way: 'prompt' | 'iphone' | null };

let snapshot: InstallState = { way: null };
function read(): InstallState {
  const way =
    installed || runningAsApp() ? null : deferred ? 'prompt' : isIphone() ? 'iphone' : null;
  if (way !== snapshot.way) snapshot = { way };
  return snapshot;
}

/** How this browser can install Sentry: its own prompt, iPhone steps, or not at all (null). */
export function useInstall(): InstallState & { prompt: () => Promise<void> } {
  const state = useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, read);
  return {
    ...state,
    prompt: async () => {
      if (!deferred) return;
      const event = deferred;
      deferred = null;
      await event.prompt();
      if ((await event.userChoice).outcome === 'accepted') installed = true;
      changed();
    },
  };
}
