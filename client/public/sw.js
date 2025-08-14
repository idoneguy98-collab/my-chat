self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch {}
  const title = data.title || 'New message';
  const options = {
    body: data.body || '',
    data: { url: data.url || '/' },
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window' }).then(clientsArr => {
    const hadWindow = clientsArr.some((w) => (w.url.includes(url) ? (w.focus(), true) : false));
    if (!hadWindow) clients.openWindow(url);
  }));
});
