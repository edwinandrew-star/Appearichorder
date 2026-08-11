const CACHE_NAME = 'appearich-cache-v2';

const BASE_PATH = '/Appearichorder/';

const URLS_TO_CACHE = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.json',

  BASE_PATH + 'images/appearich-logo.png',
  BASE_PATH + 'images/appearich-logo1.png',
  BASE_PATH + 'images/appearich-hero.jpg',
  BASE_PATH + 'images/appearich-perfume1.jpg',
  BASE_PATH + 'images/appearich-perfume2.jpg',
  BASE_PATH + 'images/appearich-perfume3.jpg',
  BASE_PATH + 'images/appearich-perfume4.jpg',
  BASE_PATH + 'images/heroo-ai.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});
