/* PetPal web push. FCM delivers data-only messages as standard Web Push payloads, so no SDK is needed here. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function readPayload(event) {
  if (!event.data) return {};
  let raw;
  try {
    raw = event.data.json();
  } catch (_) {
    return { body: event.data.text() };
  }
  return raw.data || raw.notification || raw;
}

self.addEventListener('push', (event) => {
  const data = readPayload(event);
  const title = data.title || 'PetPal';
  const options = {
    body: data.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: data.petId ? `petpal-${data.type || 'alert'}-${data.petId}` : undefined,
    renotify: Boolean(data.petId),
    requireInteraction: data.type === 'sos',
    data: { link: data.link || '/tracking' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.link || '/tracking', self.location.origin);
  const url = target.origin === self.location.origin ? target.href : `${self.location.origin}/tracking`;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
