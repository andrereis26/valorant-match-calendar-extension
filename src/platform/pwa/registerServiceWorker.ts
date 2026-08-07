/**
 * Registered from the site root (not dist/pwa/) so its default scope
 * covers pwa-index.html and pwa-settings.html. A script under dist/pwa/
 * would default to a dist/pwa/-only scope, and widening it would require
 * a `Service-Worker-Allowed` response header a plain static host can't
 * guarantee.
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("pwa-sw.js");
  });
}
