importScripts('/scramjet/scramjet.all.js');

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker({
  prefix: '/scramjet/'
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass Service Worker for app static assets and Wisp WebSocket endpoint
  if (
    url.origin === location.origin &&
    (url.pathname.startsWith('/baremux/') ||
      url.pathname.startsWith('/scramjet/') ||
      url.pathname.startsWith('/epoxy/') ||
      url.pathname.startsWith('/wisp/') ||
      url.pathname === '/sw.js' ||
      url.pathname === '/' ||
      url.pathname === '/index.html' ||
      url.pathname === '/main.js' ||
      url.pathname === '/style.css')
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      await scramjet.loadConfig();
      if (scramjet.route(event)) {
        return await scramjet.fetch(event);
      }
      return await fetch(event.request);
    })()
  );
});
