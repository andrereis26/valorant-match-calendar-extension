import {
  DEFAULT_CONFIG,
  MATCH_ENDPOINT_KEYS,
  buildEndpointApiUrl,
  fetchMatches,
  loadConfig,
  originPermissionPattern,
  saveActiveMatchFilter,
  saveConfig
} from "../core";
import type {
  ExtensionConfig,
  MatchEndpointKey,
  MatchResponseMapping
} from "../core/types";
import type { ConfigStorage } from "../core/storage";

type ConfigFormElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

interface TestNotificationResponse {
  ok: boolean;
  message: string;
}

/**
 * Everything this view needs from its host platform (extension options
 * page, PWA settings page, ...). No chrome.* or window.* calls happen
 * directly in this file.
 */
export interface SettingsFormPlatform {
  storage: ConfigStorage;

  /**
   * Ensures the host can reach the given origins. Extensions must ask
   * chrome.permissions for optional host permissions; platforms with no
   * such permission model (e.g. a PWA, where fetch either works or fails
   * under CORS) can resolve immediately.
   */
  ensureOrigins(origins: string[]): Promise<void>;

  /**
   * Whether this platform can run the live-match notification feature.
   * When false, the notification checkbox and test-notification button
   * are hidden — there is no PWA equivalent yet (see README).
   */
  supportsLiveNotifications: boolean;

  testLiveNotification?(): Promise<TestNotificationResponse>;

  /**
   * Navigates back to the match list. Only the PWA's settings page has
   * a #backButton element in its markup (it's reached by an in-app page
   * navigation); the extension's options page opens as its own browser
   * tab, where "back" isn't a meaningful action, so it has none.
   */
  onBack?(): void;
}

const mappingFields: Array<keyof MatchResponseMapping> = [
  "matchesPath",
  "idPath",
  "startPath",
  "endPath",
  "eventPath",
  "seriesPath",
  "team1Path",
  "team2Path",
  "flag1Path",
  "flag2Path",
  "matchUrlPath",
  "score1Path",
  "score2Path",
  "team1RoundCtPath",
  "team1RoundTPath",
  "team2RoundCtPath",
  "team2RoundTPath",
  "currentMapPath",
  "mapNumberPath",
  "timeLabelPath"
];

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing settings element: ${selector}`);
  return element;
}

function fieldId(
  endpointKey: MatchEndpointKey,
  field: keyof MatchResponseMapping
): string {
  return `${endpointKey}_${field}`;
}

function endpointInputId(
  endpointKey: MatchEndpointKey
): string {
  return `${endpointKey}_endpoint`;
}

export function mountSettingsFormView(platform: SettingsFormPlatform): void {
  const form = requiredElement<HTMLFormElement>("#settingsForm");
  const saveStatus = requiredElement<HTMLElement>("#saveStatus");
  const testButton = requiredElement<HTMLButtonElement>("#testButton");
  const testNotificationButton = requiredElement<HTMLButtonElement>("#testNotificationButton");
  const restoreDefaultsButton = requiredElement<HTMLButtonElement>("#restoreDefaultsButton");
  const liveNotificationsCheckbox = requiredElement<HTMLInputElement>("#liveNotificationsEnabled");
  const backButton = document.querySelector<HTMLButtonElement>("#backButton");

  if (backButton) {
    if (platform.onBack) {
      backButton.addEventListener("click", () => platform.onBack!());
    } else {
      backButton.hidden = true;
    }
  }

  if (!platform.supportsLiveNotifications) {
    testNotificationButton.hidden = true;

    /*
     * .checkbox-label sets display: flex in styles.css, which beats the
     * UA [hidden] { display: none } rule on specificity — so the hidden
     * attribute alone leaves it visible. An inline style always wins.
     */
    const notificationField = liveNotificationsCheckbox.closest("label") ?? liveNotificationsCheckbox;
    notificationField.hidden = true;
    notificationField.style.display = "none";
  }

  function setValue(
    selector: string,
    value: string | number | boolean
  ): void {
    const element = requiredElement<ConfigFormElement>(selector);

    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      element.checked = Boolean(value);
    } else {
      element.value = String(value);
    }
  }

  async function populate(): Promise<void> {
    const config = await loadConfig(platform.storage);

    setValue("#baseUrl", config.baseUrl);
    setValue("#headers", config.headers);
    setValue("#matchPageBaseUrl", config.matchPageBaseUrl);
    setValue("#durationMinutes", config.durationMinutes);
    setValue("#timestampTimeZone", config.timestampTimeZone);
    setValue("#defaultMatchFilter", config.defaultMatchFilter);
    setValue("#liveNotificationsEnabled", config.liveNotificationsEnabled);

    MATCH_ENDPOINT_KEYS.forEach(endpointKey => {
      setValue(
        `#${endpointInputId(endpointKey)}`,
        config.endpoints[endpointKey].endpoint
      );

      mappingFields.forEach(field => {
        setValue(
          `#${fieldId(endpointKey, field)}`,
          config.endpoints[endpointKey].mapping[field]
        );
      });
    });
  }

  function readValue(selector: string): string {
    return requiredElement<ConfigFormElement>(selector).value.trim();
  }

  function readCheckbox(selector: string): boolean {
    const element = requiredElement<HTMLInputElement>(selector);
    return element.checked;
  }

  function readMapping(endpointKey: MatchEndpointKey): MatchResponseMapping {
    const mapping = { ...DEFAULT_CONFIG.endpoints[endpointKey].mapping };

    mappingFields.forEach(field => {
      mapping[field] = readValue(
        `#${fieldId(endpointKey, field)}`
      );
    });

    return mapping;
  }

  function readForm(): ExtensionConfig {
    return {
      ...DEFAULT_CONFIG,
      baseUrl: readValue("#baseUrl"),
      headers: readValue("#headers"),
      endpoints: {
        upcoming: {
          endpoint: readValue("#upcoming_endpoint"),
          mapping: readMapping("upcoming")
        },
        live: {
          endpoint: readValue("#live_endpoint"),
          mapping: readMapping("live")
        },
        results: {
          endpoint: readValue("#results_endpoint"),
          mapping: readMapping("results")
        }
      },
      matchPageBaseUrl: readValue("#matchPageBaseUrl"),
      durationMinutes: Number(readValue("#durationMinutes")),
      timestampTimeZone: readValue("#timestampTimeZone") === "local"
        ? "local"
        : "UTC",
      defaultMatchFilter: readValue("#defaultMatchFilter") === "all"
        ? "all"
        : "vct",
      liveNotificationsEnabled: platform.supportsLiveNotifications &&
        readCheckbox("#liveNotificationsEnabled")
    };
  }

  async function ensureApiPermission(config: ExtensionConfig): Promise<void> {
    const origins = Array.from(
      new Set(
        MATCH_ENDPOINT_KEYS.map(endpointKey =>
          originPermissionPattern(
            buildEndpointApiUrl(config, endpointKey)
          )
        )
      )
    );

    await platform.ensureOrigins(origins);
  }

  function setStatus(
    message: string,
    isError = false
  ): void {
    saveStatus.className = isError ? "status error" : "status";
    saveStatus.textContent = message;
  }

  function validateConfig(config: ExtensionConfig): void {
    JSON.parse(config.headers || "{}");

    if (
      !Number.isFinite(config.durationMinutes) ||
      config.durationMinutes < 1
    ) {
      throw new Error("Default duration must be at least 1 minute.");
    }
  }

  async function saveConfigForTest(
    config: ExtensionConfig
  ): Promise<void> {
    validateConfig(config);
    await ensureApiPermission(config);
    await saveConfig(platform.storage, config);
    await saveActiveMatchFilter(platform.storage, config.defaultMatchFilter);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    void (async () => {
      setStatus("");

      try {
        const config = readForm();
        await saveConfigForTest(config);
        setStatus("Settings saved.");
      } catch (error: unknown) {
        setStatus(
          error instanceof Error ? error.message : "Unexpected error.",
          true
        );
      }
    })();
  });

  if (platform.supportsLiveNotifications) {
    testNotificationButton.addEventListener("click", () => {
      void (async () => {
        setStatus("Sending test notification...");

        try {
          const config = readForm();
          await saveConfigForTest(config);

          if (!platform.testLiveNotification) {
            throw new Error("Test notifications are not available.");
          }

          const response = await platform.testLiveNotification();

          if (!response?.ok) {
            throw new Error(
              response?.message || "Test notification failed."
            );
          }

          setStatus(response.message);
        } catch (error: unknown) {
          setStatus(
            error instanceof Error ? error.message : "Unexpected error.",
            true
          );
        }
      })();
    });
  }

  testButton.addEventListener("click", () => {
    void (async () => {
      setStatus("Testing...");

      try {
        const config = readForm();
        validateConfig(config);
        await ensureApiPermission(config);

        const [upcomingMatches, liveMatches, results] = await Promise.all([
          fetchMatches(config, {
            endpointKey: "upcoming",
            page: 1,
            status: "upcoming"
          }),
          fetchMatches(config, {
            endpointKey: "live",
            status: "live",
            includePast: true,
            sort: "api"
          }),
          fetchMatches(config, {
            endpointKey: "results",
            page: 1,
            status: "result",
            includePast: true,
            sort: "api"
          })
        ]);

        setStatus(
          `Connection successful. ${upcomingMatches.length} upcoming, ` +
          `${liveMatches.length} live, ${results.length} results found.`
        );
      } catch (error: unknown) {
        setStatus(
          error instanceof Error ? error.message : "Unexpected error.",
          true
        );
      }
    })();
  });

  restoreDefaultsButton.addEventListener("click", () => {
    void (async () => {
      await saveConfig(platform.storage, DEFAULT_CONFIG);
      await populate();
      setStatus("Default API settings restored.");
    })();
  });

  void populate().catch((error: unknown) => {
    setStatus(
      error instanceof Error ? error.message : "Unexpected error.",
      true
    );
  });
}
