/* TIMARC SPACE — lightweight shell service worker
 * Caches local shell (HTML + local JS). Does NOT cache Three.js CDN
 * (unpkg) so graphics stay network-first and we avoid stale/CORS issues.
 */
const CACHE = 'timarc-space-shell-v2';
const SHELL = [
  '/',
  '/index.html',
  '/game.js',
  '/three-renderer.js',
  '/srx-bridge.js',
  '/mobile-controls.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept cross-origin (Three.js CDN, APIs, Stripe, etc.)
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML so deploys show up; fall back to cache offline
  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isNav) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for local shell assets we listed
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Only cache successful same-origin shell-ish responses
        if (res.ok && url.pathname.match(/\.(js|webmanifest|png|jpg|svg|ico)$/)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
