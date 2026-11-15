self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.some(c => c.visibilityState === 'visible' && c.focused)) return;
    return self.registration.showNotification(d.title || 'Syranx', { body: d.body || 'Pesan baru', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'dm', renotify: true, vibrate: [140, 70, 140] });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});

// cadangan offline sederhana: jaringan dulu, cache kalau offline (hanya halaman utama)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open('syranx-shell').then(ch => ch.put('./', c)).catch(() => {}); return res; })
    .catch(() => caches.match('./').then(r => r || new Response('Offline', { status: 503 }))));
});
