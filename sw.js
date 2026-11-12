const CACHE_NAME = 'quiz-hub-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './src/hub.js',
  './src/storage.js',
  './src/register-sw.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function handleFetch(event) {
  const request = event.request;
  const url = new URL(request.url);
  const acceptHeader = request.headers?.get ? request.headers.get('accept') : request.headers?.accept;
  const isHtml =
    request.mode === 'navigate' ||
    (typeof acceptHeader === 'string' && acceptHeader.includes('text/html')) ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/');

  if (isHtml) {
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone()).catch(() => {});
        return response;
      }
      const cached = await caches.match(request);
      if (cached) return cached;
      if (url.pathname.endsWith('/') || url.pathname === '') {
        const rootFallback = await caches.match('./index.html');
        if (rootFallback) return rootFallback;
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (url.pathname.endsWith('/') || url.pathname === '') {
        const rootFallback = await caches.match('./index.html');
        if (rootFallback) return rootFallback;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  }

  // Static non-HTML same-origin GET assets: Cache-First with Network Fallback
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(handleFetch(event));
  }
});
