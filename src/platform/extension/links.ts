export function openLink(url: string): void {
  void chrome.tabs.create({ url });
}

export function openSettings(): void {
  void chrome.runtime.openOptionsPage();
}
