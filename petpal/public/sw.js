/* PetPal runtime cache — hashed static files only. Does not cache HTML or APIs. */
const CACHE = 'petpal-static-v1';
const STATIC_RE = /\/static\/(css|js|media)\//;
const IMAGE_RE = /\.(?:webp|png|jpe?g|gif|svg|ico|woff2?)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') return;
  if (url.pathname === '/sw.js' || url.pathname === '/index.html') return;
  if (STATIC_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (IMAGE_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
