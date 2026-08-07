import { normalizeConfig, normalizeMatchFilter } from "./config";
import type { LegacyConfig } from "./config";
import type { ExtensionConfig, MatchFilter } from "./types";

export const ACTIVE_MATCH_FILTER_KEY = "activeMatchFilter";

/**
 * Persistence port implemented once per platform (extension, PWA, ...).
 *
 * Core logic depends only on this interface, never on a concrete
 * storage API, so it stays reusable across platforms.
 */
export interface ConfigStorage {
  getSyncConfig(): Promise<Record<string, unknown>>;
  setSyncConfig(config: Record<string, unknown>): Promise<void>;
  getLocalValue<T>(key: string): Promise<T | undefined>;
  setLocalValue(key: string, value: unknown): Promise<void>;
}

/**
 * Loads configuration from synced storage.
 *
 * DEFAULT_CONFIG is used for any value that has not yet been
 * customised by the user.
 */
export async function loadConfig(
  storage: ConfigStorage
): Promise<ExtensionConfig> {
  const storedConfig = await storage.getSyncConfig();

  return normalizeConfig(
    storedConfig as LegacyConfig
  );
}

export async function saveConfig(
  storage: ConfigStorage,
  config: ExtensionConfig
): Promise<void> {
  await storage.setSyncConfig(config as unknown as Record<string, unknown>);
}

export async function loadActiveMatchFilter(
  storage: ConfigStorage,
  config: ExtensionConfig
): Promise<MatchFilter> {
  const stored = await storage.getLocalValue<MatchFilter>(
    ACTIVE_MATCH_FILTER_KEY
  );

  return normalizeMatchFilter(
    stored ?? config.defaultMatchFilter
  );
}

export async function saveActiveMatchFilter(
  storage: ConfigStorage,
  filter: MatchFilter
): Promise<void> {
  await storage.setLocalValue(ACTIVE_MATCH_FILTER_KEY, filter);
}
