const CACHE_NAME = 'appearich-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/appearich-logo.png',
  '/images/appearich-logo1.png',
  '/images/appearich-hero.jpg',
  '/images/appearich-perfume1.jpg',
  '/images/appearich-perfume2.jpg',
  '/images/appearich-perfume3.jpg',
  '/images/appearich-perfume4.jpg',
  '/images/heroo-ai.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
