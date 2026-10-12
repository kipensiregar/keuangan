/* Offline app-shell cache. IndexedDB remains the source of business data. */
const CACHE_NAME = 'wmf-offline-v1';
const SCOPE_URL = new URL('./', self.registration.scope);
const SCOPE_PATH = SCOPE_URL.pathname;
const APP_SHELL = [SCOPE_URL.href, new URL('index.html', SCOPE_URL).href, new URL('manifest.webmanifest', SCOPE_URL).href];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('wmf-offline-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(new URL('index.html', SCOPE_URL).href, response.clone()));
      return response;
    }).catch(async () => (await caches.match(new URL('index.html', SCOPE_URL).href)) || (await caches.match(SCOPE_URL.href))));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    });
  }));
});
