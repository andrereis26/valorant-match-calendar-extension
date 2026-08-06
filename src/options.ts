import {
  DEFAULT_CONFIG,
  buildApiUrl,
  fetchMatches,
  loadConfig,
  originPermissionPattern
} from "./common";
import type { ExtensionConfig } from "./types";

type ConfigFormElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const fields = Object.keys(DEFAULT_CONFIG) as Array<keyof ExtensionConfig>;
const form = document.querySelector<HTMLFormElement>("#settingsForm")!;
const saveStatus = document.querySelector<HTMLElement>("#saveStatus")!;
const testButton = document.querySelector<HTMLButtonElement>("#testButton")!;
const restoreDefaultsButton = document.querySelector<HTMLButtonElement>("#restoreDefaultsButton")!;

async function populate(): Promise<void> {
  const config = await loadConfig();
  fields.forEach(key => {
    const element = document.querySelector<ConfigFormElement>(`#${key}`);
    if (element) element.value = String(config[key]);
  });
}

function readForm(): ExtensionConfig {
  const values: ExtensionConfig = { ...DEFAULT_CONFIG };

  fields.forEach(key => {
    const element = document.querySelector<ConfigFormElement>(`#${key}`);
    if (!element) return;

    if (key === "durationMinutes") {
      values.durationMinutes = Number(element.value);
    } else if (key === "timestampTimeZone") {
      values.timestampTimeZone = element.value === "local" ? "local" : "UTC";
    } else {
      (values as unknown as Record<string, string>)[key] = element.value.trim();
    }
  });

  return values;
}

async function ensureApiPermission(config: ExtensionConfig): Promise<void> {
  const apiUrl = buildApiUrl(config.baseUrl, config.endpoint);
  const origins = [originPermissionPattern(apiUrl)];

  if (await chrome.permissions.contains({ origins })) return;

  const granted = await chrome.permissions.request({ origins });
  if (!granted) throw new Error("API host access was not granted.");
}

form.addEventListener("submit", event => {
  event.preventDefault();
  void (async () => {
    saveStatus.className = "status";

    try {
      const config = readForm();
      JSON.parse(config.headers || "{}");
      await ensureApiPermission(config);
      await chrome.storage.sync.set(config);
      saveStatus.textContent = "Settings saved.";
    } catch (error: unknown) {
      saveStatus.className = "status error";
      saveStatus.textContent = error instanceof Error ? error.message : "Unexpected error.";
    }
  })();
});

testButton.addEventListener("click", () => {
  void (async () => {
    saveStatus.className = "status";
    saveStatus.textContent = "Testing…";

    try {
      const config = readForm();
      JSON.parse(config.headers || "{}");
      await ensureApiPermission(config);
      const matches = await fetchMatches(config);
      saveStatus.textContent = `Connection successful. ${matches.length} upcoming match${matches.length === 1 ? "" : "es"} found.`;
    } catch (error: unknown) {
      saveStatus.className = "status error";
      saveStatus.textContent = error instanceof Error ? error.message : "Unexpected error.";
    }
  })();
});

restoreDefaultsButton.addEventListener("click", () => {
  void (async () => {
    await chrome.storage.sync.set(DEFAULT_CONFIG);
    await populate();
    saveStatus.className = "status";
    saveStatus.textContent = "Default API settings restored.";
  })();
});

void populate();
