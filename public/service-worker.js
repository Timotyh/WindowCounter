 Define a cache name for your app's assets
const CACHE_NAME = 'window-counter-cache-v1';
 List of URLs to cache when the service worker is installed
const urlsToCache = [
  '',
  'index.html',
   Add paths to your React app's compiled JS and CSS files here
   For a basic React app, these might look like
   'staticjsbundle.js',
   'staticcssmain.css',
   Add any other static assets like images, fonts, etc.
];

 Install event Fired when the service worker is first installed
self.addEventListener('install', (event) = {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) = {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);  Cache all specified assets
      })
  );
});

 Activate event Fired when the service worker becomes active
self.addEventListener('activate', (event) = {
  event.waitUntil(
    caches.keys().then((cacheNames) = {
      return Promise.all(
        cacheNames.map((cacheName) = {
           Delete old caches that don't match the current CACHE_NAME
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

 Fetch event Fired for every network request made by the page
self.addEventListener('fetch', (event) = {
  event.respondWith(
    caches.match(event.request)  Try to find the request in the cache
      .then((response) = {
         If found in cache, return the cached response
        if (response) {
          return response;
        }
         If not found in cache, fetch from the network
        return fetch(event.request).then((networkResponse) = {
           Optionally, cache new responses as they come in
           This is a cache-then-network strategy or cache-first
           if you want to update cache in background.
           For simplicity, this example only caches on install.
          return networkResponse;
        });
      })
      .catch(() = {
         This catch block handles network failures.
         You could return an offline page here.
        console.log('Network request failed and no cache match.');
         Example return caches.match('offline.html');
      })
  );
});
