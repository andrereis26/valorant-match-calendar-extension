import type { ConfigStorage } from "../../core/storage";

export const extensionStorage: ConfigStorage = {
  async getSyncConfig() {
    return chrome.storage.sync.get(null);
  },

  async setSyncConfig(config) {
    await chrome.storage.sync.set(config);
  },

  async getLocalValue<T>(key: string) {
    const stored = await chrome.storage.local.get(key);
    return stored[key] as T | undefined;
  },

  async setLocalValue(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }
};
