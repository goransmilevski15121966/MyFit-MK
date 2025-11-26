const CACHE_NAME = 'myfit-mk-v2.1.0';
const API_CACHE_NAME = 'myfit-mk-api-v1';

// Ресурси за кеширање - офлајн функционалност
const urlsToCache = [
    '/MyFit-MK/',
    '/MyFit-MK/index.html',
    '/MyFit-MK/manifest.json',
    '/MyFit-MK/sw.js',
    '/MyFit-MK/myfit-logo.jpg',
    '/MyFit-MK/icons/icon-192x192.png',
    '/MyFit-MK/icons/icon-512x512.png',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap
];

// Стратегии за кеширање
const STATIC_CACHE_STRATEGY = 'cache-first';
const API_CACHE_STRATEGY = 'network-first';

// Инсталирање на Service Worker
self.addEventListener('install', (event) => {
    console.log('🛠 MyFit MK Service Worker инсталиран');
    
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME)
                .then((cache) => {
                    console.log('📦 Кеширање основни ресурси за MyFit MK');
                    return cache.addAll(urlsToCache);
                })
                .catch((error) => {
                    console.error('❌ Грешка при кеширање:', error);
                }),
            
            // Синхронизација на вежби во позадина
            syncExercisesData()
        ]).then(() => {
            console.log('✅ Сите ресурси се кеширани');
            return self.skipWaiting();
        })
    );
});

// Активирање на Service Worker
self.addEventListener('activate', (event) => {
    console.log('🚀 MyFit MK Service Worker активиран');
    
    event.waitUntil(
        Promise.all([
            // Чистење на стар кеш
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                            console.log('🗑️ Бришење стар кеш:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            
            // Активирање на клиенти
            self.clients.claim(),
            
            // Синхронизација на податоци
            syncUserData()
        ]).then(() => {
            console.log('✅ Service Worker активиран и подготвен');
            
            // Испрати порака до сите клиенти
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SW_ACTIVATED',
                        version: '2.1.0',
                        timestamp: new Date().toISOString()
                    });
                });
            });
        })
    );
});

// Fetch events - паметно кеширање за MyFit MK
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignore non-GET requests
    if (request.method !== 'GET') return;
    
    // Стратегија за различни типови на ресурси
    if (url.origin === location.origin) {
        // Локални ресурси - Cache First
        event.respondWith(cacheFirstStrategy(request));
    } else if (url.href.includes('cdn.tailwindcss.com') || 
               url.href.includes('fonts.googleapis.com')) {
        // CDN ресурси - Stale While Revalidate
        event.respondWith(staleWhileRevalidateStrategy(request));
    } else {
        // Други ресурси - Network First
        event.respondWith(networkFirstStrategy(request));
    }
});

// Стратегија: Cache First (за статички ресурси)
async function cacheFirstStrategy(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        console.log('📂 Сервирано од кеш:', request.url);
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            console.log('🌐 Сервирано од мрежа и кеширано:', request.url);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('❌ Мрежа неуспешна, враќање fallback:', request.url);
        
        // Fallback за различни типови на ресурси
        if (request.destination === 'document') {
            return caches.match('/MyFit-MK/index.html');
        }
        
        return new Response('Офлајн мод - ресурсот не е достапен', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Стратегија: Stale While Revalidate (за CDN)
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    // Врати кеширана верзија веднаш
    if (cachedResponse) {
        // Во позадина, ажурирај го кешот
        fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse);
            }
        }).catch(() => {
            // Не прави ништо ако мрежата не успее
        });
        
        return cachedResponse;
    }
    
    // Ако нема кеш, земи од мрежата
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        return new Response('CDN ресурс не е достапен офлајн', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Стратегија: Network First (за динамички податоци)
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(API_CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error('Network response not ok');
    } catch (error) {
        const cache = await caches.open(API_CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('📂 API податоци сервирани од кеш:', request.url);
            return cachedResponse;
        }
        
        return new Response('Офлајн - податоците не се достапни', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Синхронизација на податоци за вежби
async function syncExercisesData() {
    try {
        // Овде може да се додаде синхронизација со сервер
        // за нови вежби или ажурирања
        console.log('🔄 Синхронизација на податоци за вежби');
        
        // Кеширање на позадински слики или дополнителни ресурси
        const exerciseImages = [
            // Може да се додадат URLs на слики за вежби
        ];
        
        if (exerciseImages.length > 0) {
            const cache = await caches.open(CACHE_NAME);
            return cache.addAll(exerciseImages);
        }
        
        return Promise.resolve();
    } catch (error) {
        console.error('❌ Грешка при синхронизација:', error);
        return Promise.resolve();
    }
}

// Синхронизација на кориснички податоци
async function syncUserData() {
    // Овде може да се синхронизираат кориснички податоци
    // со сервер при повторно поврзување
    console.log('👤 Синхронизација на кориснички податоци');
    return Promise.resolve();
}

// Background Sync за податоци
self.addEventListener('sync', (event) => {
    console.log('🔄 Background Sync:', event.tag);
    
    if (event.tag === 'sync-exercises') {
        event.waitUntil(syncExercisesData());
    } else if (event.tag === 'sync-user-data') {
        event.waitUntil(syncUserData());
    }
});

// Push нотификации за MyFit MK
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    let data;
    try {
        data = event.data.json();
    } catch (error) {
        data = {
            title: 'MyFit MK',
            body: event.data.text() || 'Време за тренинг! 💪'
        };
    }
    
    const options = {
        body: data.body || 'Не заборавај на денешниот тренинг!',
        icon: './myfit-logo.jpg',
        badge: './myfit-logo.jpg',
        image: data.image,
        vibrate: [100, 50, 100, 50, 100],
        data: {
            url: data.url || './',
            timestamp: Date.now(),
            type: data.type || 'workout-reminder'
        },
        actions: [
            {
                action: 'start-workout',
                title: 'Започни тренинг',
                icon: './icons/workout-icon.png'
            },
            {
                action: 'view-exercises', 
                title: 'Види вежби',
                icon: './icons/exercise-icon.png'
            },
            {
                action: 'close',
                title: 'Затвори',
                icon: './icons/close-icon.png'
            }
        ],
        tag: 'myfit-reminder',
        renotify: true,
        requireInteraction: true
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'MyFit MK 🏋️', options)
    );
});

// Клик на нотификации
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const notificationData = event.notification.data || {};
    
    if (event.action === 'start-workout') {
        event.waitUntil(
            openMyFitPage('/?source=push&action=start_workout')
        );
    } else if (event.action === 'view-exercises') {
        event.waitUntil(
            openMyFitPage('/?source=push&action=view_exercises')
        );
    } else {
        // Default click action
        event.waitUntil(
            openMyFitPage(notificationData.url || '/')
        );
    }
});

// Отворање на MyFit MK страница
async function openMyFitPage(url) {
    const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    });
    
    // Најди отворен прозорец на MyFit MK
    for (const client of clients) {
        if (client.url.includes(location.origin) && 'focus' in client) {
            await client.focus();
            client.postMessage({
                type: 'NAVIGATE_TO',
                path: url,
                source: 'push_notification'
            });
            return;
        }
    }
    
    // Ако нема отворен прозорец, отвори нов
    if (self.clients.openWindow) {
        return self.clients.openWindow(url);
    }
});

// Message handling од главната апликација
self.addEventListener('message', (event) => {
    const data = event.data;
    
    switch (data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_RESOURCES':
            cacheAdditionalResources(data.urls);
            break;
            
        case 'GET_CACHE_INFO':
            sendCacheInfo(event);
            break;
            
        case 'CLEAR_CACHE':
            clearSpecificCache(data.cacheName);
            break;
    }
});

// Додатни функции за кеширање
async function cacheAdditionalResources(urls) {
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(urls);
        console.log('✅ Дополнителни ресурси кеширани:', urls);
    } catch (error) {
        console.error('❌ Грешка при кеширање дополнителни ресурси:', error);
    }
}

async function sendCacheInfo(event) {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    event.ports[0].postMessage({
        type: 'CACHE_INFO',
        cacheName: CACHE_NAME,
        cachedItems: keys.length,
        urls: keys.map(req => req.url)
    });
}

async function clearSpecificCache(cacheName) {
    const deleted = await caches.delete(cacheName);
    console.log(`🗑️ Кешот ${cacheName} е избришан:`, deleted);
    return deleted;
}

// Period Sync за редовна синхронизација
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'daily-exercise-sync') {
        event.waitUntil(syncExercisesData());
    }
});

console.log('✅ MyFit MK Service Worker е вчитан и подготвен!');