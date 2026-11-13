const C = 'diyet-3';
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'app.js', 'manifest.json', 'icon-180.png']))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
