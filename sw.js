/**
 * M.K. TURBO Progressive Web App - Service Worker v4.0
 * Instant cache update & cloud sync bypass
 */

const CACHE_NAME = 'mkturbo-cache-v4.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css?v=4.0',
  './app.js?v=4.0',
  './manifest.json',
  './html2pdf.bundle.min.js',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
  './logo.png',
  './signature.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never cache Firebase, cloud endpoints, or API calls
  if (url.hostname.includes('firebaseio.com') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network first for all local app files so fresh code is always loaded
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
