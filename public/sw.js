// The service worker exists for push only (spec, Web delivery): it shows what the
// server sent and opens the screen it is about. It caches nothing.

// Takes over pages already open, so the one that just turned notifications on can be
// navigated by a tap without reloading first.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const message = event.data === null ? {} : event.data.json();
  event.waitUntil(
    self.registration.showNotification(message.title || 'Badminton Ladder', {
      body: message.body,
      icon: 'icon-192.png',
      data: { path: message.path || '' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.path, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((open) => {
      const app = open[0];
      if (app === undefined) return self.clients.openWindow(url);
      return app
        .navigate(url)
        .then((client) => (client || app).focus())
        .catch(() => self.clients.openWindow(url));
    }),
  );
});
