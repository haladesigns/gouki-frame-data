/*
 * Gouki Frame Data — Service Worker
 *
 * Strategy: Cache First
 * On first load, everything gets cached.
 * On subsequent loads, serve from cache instantly (works offline).
 * When online, check for updates in the background and refresh the cache.
 *
 * To force an update: bump the CACHE_VERSION string.
 */

const CACHE_VERSION = 'gouki-fd-v1';

const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

/*INSTALL*/
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  // Take over immediately without waiting for old SW to finish
  self.skipWaiting();
});

/*ACTIVATE*/
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Claim all open tabs immediately
  self.clients.claim();
});

/*FETCH*/
self.addEventListener('fetch', event => {
  // Only handle GET requests for our own origin
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(cache =>
      cache.match(event.request).then(cachedResponse => {

        // Background network fetch — updates cache silently
        const networkFetch = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed — that's fine, we have cache
          });

        // Return cache immediately if available, else wait for network
        return cachedResponse || networkFetch;
      })
    )
  );
});

/*MESSAGE*/
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
