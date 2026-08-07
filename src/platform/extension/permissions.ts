export async function ensureOrigins(origins: string[]): Promise<void> {
  if (await chrome.permissions.contains({ origins })) return;

  const granted = await chrome.permissions.request({ origins });
  if (!granted) throw new Error("API host access was not granted.");
}
