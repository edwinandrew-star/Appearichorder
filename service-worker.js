const CACHE_NAME = 'appearich-v2'; // Bump version number on every deployment

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'images/appearich-logo.png',
  'images/appearich-logo1.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install Event: Cache static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  // Force active status as soon as installation completes
  self.skipWaiting();
});

// Activate Event: Remove old cache storage without touching LocalStorage or IndexedDB
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          // Safeguard: Only delete caches matching our project prefix that are not current
          if (key.startsWith('appearich-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  // Instantly take control of all open browser tabs/clients
  self.clients.claim();
});

// Fetch Event: Handle network and cache strategies
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Exclude Supabase database/auth network calls from Service Worker cache
  if (url.hostname.includes('supabase.co')) return;

  // Network-First strategy for page navigations (index.html)
  // Ensures installed clients receive fresh app updates immediately when online
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

  // Stale-While-Revalidate strategy for static resources (CSS, JS, Images)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
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
