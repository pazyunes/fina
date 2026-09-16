// Service worker de FINA. Por ahora hace UNA sola cosa: mostrar los avisos que
// manda el servidor y abrir la app al tocarlos.
//
// A propósito no guarda nada en caché ni intercepta pedidos: un service worker
// que cachea puede dejar a la gente con una versión vieja de la app, y eso es
// mucho peor que no tener modo sin conexión.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let aviso = { title: 'FINA', body: '', url: '/', tag: 'fina' };
  try {
    aviso = { ...aviso, ...event.data.json() };
  } catch (e) {
    if (event.data) aviso.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(aviso.title, {
      body: aviso.body,
      tag: aviso.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: aviso.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Si FINA ya está abierta, se usa esa pestaña en vez de abrir otra.
    for (const c of abiertas) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        if ('navigate' in c) return c.navigate(destino);
        return;
      }
    }
    return self.clients.openWindow(destino);
  })());
});
