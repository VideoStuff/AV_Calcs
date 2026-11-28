// Offline cache: always try the network first (so updates and new icons show up straight away),
// fall back to the cache when offline or the connection is slow.
const CACHE = 'avcalcs-3.0'; // keep in step with the version in index.html
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'favicon-32.png', 'favicon.ico', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => r.ok && c.put(u, r)))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fromCache = () => cache.match(req, { ignoreSearch: sameOrigin });
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), sameOrigin ? 3500 : 6000);
      const res = await fetch(req, { signal: ctl.signal, cache: sameOrigin ? 'no-cache' : 'default' });
      clearTimeout(t);
      if (res.ok && (res.type === 'basic' || res.type === 'cors')) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return (await fromCache()) || Response.error();
    }
  })());
});
