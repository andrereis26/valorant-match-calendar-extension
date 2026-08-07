/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = "vmc-pwa-v1";

const APP_SHELL = [
  "./pwa-index.html",
  "./pwa-settings.html",
  "./styles.css",
  "./dist/pwa/pwa-app.js",
  "./dist/pwa/pwa-settings.js",
  "./manifest.webmanifest"
];

sw.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  void sw.skipWaiting();
});

sw.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  void sw.clients.claim();
});

/*
 * Cache-first for the app shell, falling back to the network. This is
 * only meant to make the app open instantly and work offline for the
 * static UI — match data itself always comes from the network, since
 * caching API responses would show stale scores.
 */
sw.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== sw.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (response.ok) {
          const responseClone = response.clone();
          void caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }

        return response;
      });
    })
  );
});
