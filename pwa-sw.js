"use strict";
(() => {
  // src/pwa-sw.ts
  var sw = self;
  var CACHE_NAME = "vmc-pwa-v1";
  var APP_SHELL = [
    "./pwa-index.html",
    "./pwa-settings.html",
    "./styles.css",
    "./dist/pwa/pwa-app.js",
    "./dist/pwa/pwa-settings.js",
    "./manifest.webmanifest"
  ];
  sw.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    void sw.skipWaiting();
  });
  sw.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then(
        (keys) => Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
    );
    void sw.clients.claim();
  });
  sw.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    if (new URL(request.url).origin !== sw.location.origin) return;
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        });
      })
    );
  });
})();
