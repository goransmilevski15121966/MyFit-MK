// Service Worker for MyFit MK - Simple & Functional Version
const CACHE_NAME = 'myfit-mk-simple-v1';
const urlsToCache = [
  './',
  './index.html',
  './public/myfit-logo.jpg',
  './public/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install Event
self.addEventListener('install', function(event) {
  console.log('🔧 MyFit MK Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('📦 Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        console.log('✅ All resources cached');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.log('❌ Cache failed:', error);
      })
  );
});

// Activate Event
self.addEventListener('activate', function(event) {
  console.log('🎯 MyFit MK Service Worker activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      console.log('✅ Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch Event - Simple Strategy
self.addEventListener('fetch', function(event) {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension requests
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        var fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          function(response) {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(function(error) {
          console.log('Fetch failed; returning offline page instead.', error);
          // You could return a custom offline page here
        });
      }
    )
  );
});

// Simple Message Handling
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('✅ MyFit MK Service Worker loaded successfully');