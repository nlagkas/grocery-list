// A unique name for our cache
const CACHE_NAME = 'grocery-list-cache-v2';

// The list of files that make up the "app shell" - everything needed to run offline.
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// --- INSTALLATION EVENT ---
// This event fires when the service worker is first installed.
self.addEventListener('install', event => {
    // We tell the browser to wait until our cache is populated.
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                // Add all the app shell files to the cache.
                return cache.addAll(urlsToCache);
            })
    );
});

// --- FETCH EVENT ---
// This event fires for every single network request the page makes.
self.addEventListener('fetch', event => {
    // This is a "cache-first" strategy.
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // If we find a match in the cache, we return it.
                if (response) {
                    return response;
                }
                // If no match is found, we fetch it from the network.
                return fetch(event.request);
            })
    );
});