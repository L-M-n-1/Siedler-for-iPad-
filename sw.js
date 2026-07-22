'use strict';

/* Service Worker: Spiel offline verfügbar machen (Cache-first). */
const CACHE = 'neue-siedler-v5';
const FILES = [
  '.', 'index.html', 'manifest.webmanifest', 'icon.png',
  'css/style.css',
  'js/config.js', 'js/map.js', 'js/save.js', 'js/game.js', 'js/ai.js',
  'js/render.js', 'js/ui.js', 'js/main.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
