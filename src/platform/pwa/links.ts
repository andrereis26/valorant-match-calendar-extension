export function openLink(url: string): void {
  window.open(url, "_blank", "noopener");
}

export function openSettings(): void {
  window.location.href = "pwa-settings.html";
}
