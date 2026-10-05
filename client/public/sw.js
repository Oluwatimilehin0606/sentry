// Sentry's service worker: what makes the installed app open quickly and say "You're offline"
// instead of showing the browser's error page.
//
// Privacy rule: it only ever keeps Sentry's own code, fonts and icons. Nothing about the person
// using it (account, websites, reports, sign-in) is stored: every /api request, and every page,
// goes to the server. So a lost or shared phone holds nothing personal.

const VERSION = 'v1';
const SHELL = `sentry-shell-${VERSION}`;
const ASSETS = `sentry-assets-${VERSION}`;
// Kept from the first visit: the offline page and what it shows.
const PRECACHE = ['/offline.html', '/favicon.svg', '/icons/icon-192.png'];
// Built code and fonts have names that change with their content, so a stored copy never goes stale.
const MAX_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== SHELL && n !== ASSETS).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Only Sentry's own address, only reading; never the API.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Pages always come from the server (so a new version shows at once); the offline page only
    // when the server can't be reached at all.
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(fromCacheOrNetwork(request));
  }
});

async function fromCacheOrNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(ASSETS);
    await cache.put(request, response.clone());
    // Old builds' files pile up otherwise: keep the newest MAX_ASSETS.
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)));
  }
  return response;
}
