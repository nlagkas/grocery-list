// A unique name for our cache.
// IMPORTANT: Increment this version number to force the update!
const CACHE_NAME = 'grocery-list-cache-v3';

// The list of files that make up the "app shell". Using relative paths for GitHub Pages compatibility.
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
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache and caching app shell');
                return cache.addAll(urlsToCache);
            })
    );
});

// --- FETCH EVENT (THE FIX IS HERE) ---
// This event fires for every single network request the page makes.
self.addEventListener('fetch', event => {
    // We only want to handle GET requests for our own app files.
    // We must ignore all other requests, especially POST requests to Firestore.
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        // If it's not a GET request or it's for a different domain,
        // let the browser handle it as it normally would. Do not intercept.
        return;
    }

    // For our own app files, use the "cache-first" strategy.
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // If we find a match in the cache, return it.
                if (cachedResponse) {
                    return cachedResponse;
                }
                // If no match is found, fetch it from the network.
                return fetch(event.request);
            })
    );
});

// --- ACTIVATION EVENT ---
// This event fires when the new service worker activates. It cleans up old caches.
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        // If this cache name is not in our whitelist, delete it.
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});