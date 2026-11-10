// Service worker: app shell cache-first, catalogo network-first, immagini stale-while-revalidate.
const VERSION = 'sacrilab-v2.0.0';
const SHELL = [
  './', 'manifest.webmanifest', 'css/styles.css',
  'js/app.js', 'js/store.js',
  'icons/logo-white.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.png', 'icons/apple-touch-icon.png',
];
const IMG_CACHE = 'sacrilab-img';
const IMG_LIMIT = 300;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'api.telegram.org') return;

  // API: sempre dal server. Il catalogo resta in cache solo come riserva offline.
  if (url.origin === location.origin && url.pathname.includes('/api/')) {
    if (!url.pathname.endsWith('/api/catalog')) return;
    e.respondWith(
      fetch(req).then((res) => {
        if (res.status === 200) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(url.pathname, copy));
        }
        return res;
      }).catch(() => caches.match(url.pathname)),
    );
    return;
  }

  // File JSON statici: sempre il più fresco, cache come fallback offline.
  if (url.pathname.endsWith('.json') && url.origin === location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req)),
    );
    return;
  }

  // Immagini dei modelli.
  if (req.destination === 'image' && url.origin !== location.origin) {
    e.respondWith(
      caches.open(IMG_CACHE).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(IMG_CACHE, IMG_LIMIT); }
          return res;
        }).catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  // App shell: stale-while-revalidate, così gli aggiornamenti arrivano al riavvio successivo.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req, { ignoreSearch: true });
        const net = fetch(req).then((res) => {
          if (res.ok) c.put(req, res.clone());
          return res;
        }).catch(() => hit || c.match('./'));
        if (hit) { e.waitUntil(net); return hit; }
        return net;
      }),
    );
  }
});
