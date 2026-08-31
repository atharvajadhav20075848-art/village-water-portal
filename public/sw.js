const CACHE_NAME = 'gram-jal-v2';
const ASSETS_TO_CACHE = [
  '/app',
  '/public/manifest.json',
  '/public/js/i18n.js',
  '/public/js/auth-persist.js',
  '/public/js/notifications.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Network-first for dynamic API routes, cache-first for static
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Handle Background Push & Emergency Notifications
self.addEventListener('push', (event) => {
  let payload = {
    title: '🚨 Emergency Water Alert',
    message: 'Urgent notice from Gram Panchayat!',
    isEmergency: true
  };
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch(e) {}

  const options = {
    body: payload.message || payload.body,
    icon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBI2oc_Spp8I6sgWaFMdsSaFj6HCk6B0FcQPjuW5ESxOxg1qEkS2UujcZNWktzJc8s5jwVXxfZcpXC-_nT7qoyZfCico0MZXOysuOfdYGH_BObereTalqbra5mCuW0jZ4k0JiWCqJUizNUxZ0eoHab6alVwGgUk4JVZXPKdivAOY5RPtWQVl8LjrPw0-RknTkFttseIwCfgur0EmzMkWGVWB07KHOChoA5J8VhKNoq1A7a7uu-LpA0X4w',
    badge: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBI2oc_Spp8I6sgWaFMdsSaFj6HCk6B0FcQPjuW5ESxOxg1qEkS2UujcZNWktzJc8s5jwVXxfZcpXC-_nT7qoyZfCico0MZXOysuOfdYGH_BObereTalqbra5mCuW0jZ4k0JiWCqJUizNUxZ0eoHab6alVwGgUk4JVZXPKdivAOY5RPtWQVl8LjrPw0-RknTkFttseIwCfgur0EmzMkWGVWB07KHOChoA5J8VhKNoq1A7a7uu-LpA0X4w',
    vibrate: [1000, 300, 1000, 300, 1000, 300, 2000],
    tag: 'gram-emergency-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: '/app' }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Click notification to open / bring app to foreground
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes('/app') || client.url.includes('/home')) {
          return client.focus();
        }
      }
      return clients.openWindow('/app');
    })
  );
});
