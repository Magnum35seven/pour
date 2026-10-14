/* Offline-first service worker. App shell + data are precached; everything else
   falls back to cache-first then network.. */
const VERSION = 'pour-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app.css',
  './app.js',
  './store.js',
  './game.js',
  './boss.js',
  './data.js',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      // Never cache error responses.
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
