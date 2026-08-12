// Bump this string on any deploy where you need clients to drop cached assets.
const VERSION = 'v2';
const CACHE_NAME = `wandr-${VERSION}`;

const STATIC_ASSETS = ['/', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Lets the page force an update: navigator.serviceWorker.controller.postMessage('SKIP_WAITING')
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) return;

  // Next.js build output is content-hashed and immutable. Caching it under our
  // own key just grows the cache forever and makes stale bundles possible;
  // the CDN and HTTP cache already handle these correctly.
  if (url.pathname.startsWith('/_next/static/')) return;

  // Never cache the service worker or the manifest.
  if (url.pathname === '/sw.js' || url.pathname.endsWith('.webmanifest')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('/');
          return new Response('Offline', { status: 503 });
        })
      )
  );
});
