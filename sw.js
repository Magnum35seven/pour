/* Offline-first service worker with automatic updates.

   Strategy: NETWORK-FIRST for the app itself. Every load asks the server for a
   fresh copy (bypassing the browser's HTTP cache), stores it, and uses it. So any
   commit you push shows up on the next open - no version number to bump.
   If the network is offline, fails, or takes longer than 4 s, the cached copy
   is used instead, so the app still works fully offline. */

const VERSION = 'pour-v4';   // only bump to force-purge old caches
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
  './finder.js',
  './art.js',
  './photos.json',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png',
];
const NETWORK_TIMEOUT_MS = 4000;

/* Licensed recipe photos (listed in photos.json) are cached up front so they work offline.
   Best effort: a missing photo never stops the app installing. */
function precachePhotos(cache) {
  return fetch('./photos.json', { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : {})
    .then(map => Promise.all(Object.values(map).filter(p => p && p.file)
      .map(p => cache.add(new Request('./' + p.file, { cache: 'reload' })).catch(() => {}))))
    .catch(() => {});
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))
        .then(() => precachePhotos(c)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  const net = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) {                       // never cache error responses
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
    }
    return res;
  });
  const timeout = new Promise((_, reject) => setTimeout(reject, NETWORK_TIMEOUT_MS));
  return Promise.race([net, timeout]).catch(() =>
    caches.match(req, { ignoreSearch: true }).then(hit =>
      hit ||
      (req.mode === 'navigate' ? caches.match('./index.html') : null) ||
      net.catch(() => Response.error())
    )
  );
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(networkFirst(req));
});
