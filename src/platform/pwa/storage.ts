import type { ConfigStorage } from "../../core/storage";

const SYNC_CONFIG_KEY = "vmc:config";
const LOCAL_KEY_PREFIX = "vmc:local:";

function readJson<T>(key: string): T | undefined {
  const raw = localStorage.getItem(key);
  if (raw === null) return undefined;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/**
 * ConfigStorage implementation for the PWA, backed by localStorage.
 *
 * There is no sync/local distinction like chrome.storage.sync vs
 * chrome.storage.local — both are namespaced keys in the same store.
 */
export const pwaStorage: ConfigStorage = {
  async getSyncConfig() {
    return readJson<Record<string, unknown>>(SYNC_CONFIG_KEY) ?? {};
  },

  async setSyncConfig(config) {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  },

  async getLocalValue<T>(key: string) {
    return readJson<T>(`${LOCAL_KEY_PREFIX}${key}`);
  },

  async setLocalValue(key, value) {
    localStorage.setItem(`${LOCAL_KEY_PREFIX}${key}`, JSON.stringify(value));
  }
};
