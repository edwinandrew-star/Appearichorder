// APPEARICH Service Worker
// Bump this on every deploy that changes cached files, so old caches get cleared.
const CACHE_VERSION = 'appearich-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Core app shell — cached on install so the app boots offline.
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/css/style.css',
  '/js/supabase-client.js',
  '/js/db.js',
  '/js/auth.js',
  '/js/app.js',
  '/images/appearich-logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Never cache or intercept calls to Supabase — those must always hit the network
// (or fail explicitly) so auth and data stay correct.
function isSupabaseRequest(url) {
  return url.hostname.endsWith('.supabase.co');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('appearich-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Let Supabase (auth + data) requests go straight to the network, untouched.
  if (isSupabaseRequest(url)) return;

  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    // Network-first for HTML so users get fresh app updates when online,
    // falling back to the cached shell (and then the offline page) when not.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/index.html') || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Cache-first for static assets (CSS/JS/images/fonts/icons), with a network
  // fallback that fills the cache for next time.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Best effort — images with no cache and no network just fail to load.
          return cached;
        });
    })
  );
});

// Allows the page to tell a waiting worker to activate immediately after an update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
