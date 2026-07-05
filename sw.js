self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Keep the app installable without introducing a cache layer that could change
// asset, range-request, or ZIP loading behavior.
self.addEventListener('fetch', () => {});
