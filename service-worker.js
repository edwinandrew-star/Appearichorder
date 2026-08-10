const CACHE_NAME = 'appearich-v4'; // Bump version number

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './images/appearich-logo.png',
  './images/appearich-logo1.png'
];

// Install Event: Safely cache static shell assets individually
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use Promise.allSettled or individual caching loops to prevent complete installation failure
      return Promise.all(
        ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn('Failed to cache asset during install:', asset, err);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate Event: Remove old cache storage
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key.startsWith('appearich-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch Event: Handle network and cache strategies
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Exclude Supabase database/auth network calls from Service Worker cache
  if (url.hostname.includes('supabase.co')) return;

  // Network-First strategy for page navigations (index.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Stale-While-Revalidate strategy for static resources and CDNs
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors' || networkResponse.type === 'opaque')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for update instructions from client app script
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
