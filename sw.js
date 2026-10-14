/* Offline-first service worker with automatic updates.

   Strategy: NETWORK-FIRST for the app itself. Every load asks the server for a
   fresh copy (bypassing the browser's HTTP cache), stores it, and uses it. So any
   commit you push shows up on the next open - no version number to bump.
   If the network is offline, fails, or takes longer than 4 s, the cached copy
   is used instead, so the app still works fully offline. */

const VERSION = 'pour-v3';   // only bump to force-purge old caches
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
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
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
