"use strict";
(() => {
  // src/core/config.ts
  var MATCH_ENDPOINT_KEYS = [
    "upcoming",
    "live",
    "results"
  ];
  var DEFAULT_MATCH_MAPPING = {
    // The API returns matches inside data.segments.
    matchesPath: "data.segments",
    // match_page should be unique for each match.
    idPath: "match_page",
    startPath: "unix_timestamp",
    endPath: "",
    eventPath: "match_event",
    seriesPath: "match_series",
    team1Path: "team1",
    team2Path: "team2",
    flag1Path: "flag1",
    flag2Path: "flag2",
    matchUrlPath: "match_page",
    score1Path: "score1",
    score2Path: "score2",
    team1RoundCtPath: "team1_round_ct",
    team1RoundTPath: "team1_round_t",
    team2RoundCtPath: "team2_round_ct",
    team2RoundTPath: "team2_round_t",
    currentMapPath: "current_map",
    mapNumberPath: "map_number",
    timeLabelPath: "time_until_match"
  };
  var DEFAULT_RESULTS_MAPPING = {
    ...DEFAULT_MATCH_MAPPING,
    startPath: "",
    eventPath: "tournament_name",
    seriesPath: "round_info",
    timeLabelPath: "time_completed"
  };
  var DEFAULT_CONFIG = {
    baseUrl: "http://127.0.0.1:3001",
    headers: "{}",
    endpoints: {
      upcoming: {
        endpoint: "/v2/match?q=upcoming_extended",
        mapping: { ...DEFAULT_MATCH_MAPPING }
      },
      live: {
        endpoint: "/v2/match?q=live_score",
        mapping: { ...DEFAULT_MATCH_MAPPING }
      },
      results: {
        endpoint: "/v2/match?q=results",
        mapping: { ...DEFAULT_RESULTS_MAPPING }
      }
    },
    // match_page is relative, for example:
    // 716636/gentle-mates-gc-vs-alternate-attax-ruby...
    matchPageBaseUrl: "https://www.vlr.gg",
    // Used when the API does not provide an end time.
    durationMinutes: 120,
    /**
     * Temporary timestamp interpretation.
     *
     * The current API returns:
     * "2026-08-06 18:00:00"
     *
     * Change this later if your endpoint starts returning
     * proper ISO 8601 timestamps.
     */
    timestampTimeZone: "UTC",
    // The popup opens filtered to VCT events unless the user changes this.
    defaultMatchFilter: "vct",
    // Disabled by default; users opt in from the settings page.
    liveNotificationsEnabled: false
  };
  function stringConfigValue(value, fallback) {
    return typeof value === "string" ? value : fallback;
  }
  function numberConfigValue(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  function booleanConfigValue(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }
  function mappingFromLegacy(storedConfig) {
    const mapping = {};
    [
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
      "matchUrlPath"
    ].forEach((key) => {
      if (typeof storedConfig[key] === "string") {
        mapping[key] = storedConfig[key];
      }
    });
    return mapping;
  }
  function configuredEndpoint(storedConfig, endpointKey) {
    const configuredEndpoint2 = storedConfig.endpoints?.[endpointKey]?.endpoint;
    if (typeof configuredEndpoint2 === "string") {
      return configuredEndpoint2;
    }
    if (storedConfig.endpoints === void 0 && endpointKey === "upcoming" && typeof storedConfig.endpoint === "string") {
      return storedConfig.endpoint;
    }
    return DEFAULT_CONFIG.endpoints[endpointKey].endpoint;
  }
  function configuredMapping(storedConfig, endpointKey) {
    const mapping = storedConfig.endpoints?.[endpointKey]?.mapping;
    const legacyMapping = storedConfig.endpoints === void 0 && endpointKey !== "results" ? mappingFromLegacy(storedConfig) : {};
    return {
      ...DEFAULT_CONFIG.endpoints[endpointKey].mapping,
      ...legacyMapping,
      ...mapping && typeof mapping === "object" && !Array.isArray(mapping) ? mapping : {}
    };
  }
  function normalizeConfig(storedConfig) {
    const defaultFilter = storedConfig.defaultMatchFilter === "all" ? "all" : DEFAULT_CONFIG.defaultMatchFilter;
    const timestampTimeZone = storedConfig.timestampTimeZone === "local" ? "local" : DEFAULT_CONFIG.timestampTimeZone;
    return {
      baseUrl: stringConfigValue(
        storedConfig.baseUrl,
        DEFAULT_CONFIG.baseUrl
      ),
      headers: stringConfigValue(
        storedConfig.headers,
        DEFAULT_CONFIG.headers
      ),
      endpoints: {
        upcoming: {
          endpoint: configuredEndpoint(
            storedConfig,
            "upcoming"
          ),
          mapping: configuredMapping(
            storedConfig,
            "upcoming"
          )
        },
        live: {
          endpoint: configuredEndpoint(
            storedConfig,
            "live"
          ),
          mapping: configuredMapping(
            storedConfig,
            "live"
          )
        },
        results: {
          endpoint: configuredEndpoint(
            storedConfig,
            "results"
          ),
          mapping: configuredMapping(
            storedConfig,
            "results"
          )
        }
      },
      matchPageBaseUrl: stringConfigValue(
        storedConfig.matchPageBaseUrl,
        DEFAULT_CONFIG.matchPageBaseUrl
      ),
      durationMinutes: numberConfigValue(
        storedConfig.durationMinutes,
        DEFAULT_CONFIG.durationMinutes
      ),
      timestampTimeZone,
      defaultMatchFilter: defaultFilter,
      liveNotificationsEnabled: booleanConfigValue(
        storedConfig.liveNotificationsEnabled,
        DEFAULT_CONFIG.liveNotificationsEnabled
      )
    };
  }

  // src/core/matches.ts
  function getByPath(value, path) {
    if (!path) {
      return value;
    }
    return path.split(".").reduce((current, key) => {
      if (current === null || current === void 0 || typeof current !== "object") {
        return void 0;
      }
      return current[key];
    }, value);
  }
  function buildApiUrl(baseUrl, endpoint) {
    const route = endpoint.trim();
    if (/^https?:\/\//i.test(route)) {
      return route;
    }
    const base = baseUrl.trim().replace(/\/+$/, "");
    return `${base}/${route.replace(/^\/+/, "")}`;
  }
  function buildPagedEndpoint(endpoint, page) {
    const route = endpoint.trim();
    const isAbsolute = /^https?:\/\//i.test(route);
    const url = new URL(
      route,
      "https://valorant-match-calendar.local"
    );
    url.searchParams.delete("num_pages");
    url.searchParams.delete("from_page");
    url.searchParams.delete("to_page");
    const normalizedPage = Math.min(
      3,
      Math.max(
        1,
        Math.trunc(page)
      )
    );
    url.searchParams.set(
      "from_page",
      String(normalizedPage)
    );
    url.searchParams.set(
      "to_page",
      String(normalizedPage)
    );
    if (isAbsolute) {
      return url.href;
    }
    return `${url.pathname}${url.search}`;
  }
  function buildEndpointApiUrl(config, endpointKey, page) {
    const endpoint = page === void 0 ? config.endpoints[endpointKey].endpoint : buildPagedEndpoint(
      config.endpoints[endpointKey].endpoint,
      page
    );
    return buildApiUrl(
      config.baseUrl,
      endpoint
    );
  }
  function originPermissionPattern(urlString) {
    const url = new URL(urlString);
    return `${url.protocol}//${url.host}/*`;
  }
  function parseDate(value, timestampTimeZone) {
    if (value === void 0 || value === null || value === "") {
      return null;
    }
    if (typeof value === "number" || typeof value === "string" && /^\d+$/.test(value.trim())) {
      let timestamp2 = Number(value);
      if (timestamp2 < 1e12) {
        timestamp2 *= 1e3;
      }
      const date2 = new Date(timestamp2);
      return Number.isNaN(date2.getTime()) ? null : date2;
    }
    if (typeof value !== "string") {
      return null;
    }
    const timestamp = value.trim();
    const apiTimestampMatch = timestamp.match(
      /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/
    );
    if (apiTimestampMatch) {
      const year = Number(apiTimestampMatch[1]);
      const month = Number(apiTimestampMatch[2]);
      const day = Number(apiTimestampMatch[3]);
      const hour = Number(apiTimestampMatch[4]);
      const minute = Number(apiTimestampMatch[5]);
      const second = Number(apiTimestampMatch[6]);
      const date2 = timestampTimeZone === "UTC" ? new Date(
        Date.UTC(
          year,
          month - 1,
          day,
          hour,
          minute,
          second
        )
      ) : new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      );
      return Number.isNaN(date2.getTime()) ? null : date2;
    }
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function normalizeMatchTimestamp(date) {
    if (!date) {
      return null;
    }
    const normalizedDate = new Date(date);
    if (normalizedDate.getSeconds() > 0 || normalizedDate.getMilliseconds() > 0) {
      normalizedDate.setMinutes(normalizedDate.getMinutes() + 1);
    }
    normalizedDate.setSeconds(0, 0);
    return normalizedDate;
  }
  function buildMatchPageUrl(matchPage, matchPageBaseUrl) {
    if (typeof matchPage !== "string" || !matchPage.trim()) {
      return "";
    }
    const page = matchPage.trim();
    if (/^https?:\/\//i.test(page)) {
      return page;
    }
    const base = matchPageBaseUrl.trim().replace(/\/+$/, "");
    const path = page.replace(/^\/+/, "");
    if (!base) {
      return path;
    }
    return `${base}/${path}`;
  }
  function parseHeaders(headersJson) {
    try {
      const parsedHeaders = JSON.parse(headersJson || "{}");
      if (parsedHeaders === null || Array.isArray(parsedHeaders) || typeof parsedHeaders !== "object") {
        throw new Error(
          "Headers must be a JSON object."
        );
      }
      return parsedHeaders;
    } catch {
      throw new Error(
        "Request headers must be valid JSON."
      );
    }
  }
  function validateEnvelope(payload) {
    if (payload === null || typeof payload !== "object") {
      return;
    }
    const envelope = payload;
    if (envelope.status !== void 0 && envelope.status !== "success") {
      const message = typeof envelope.message === "string" ? envelope.message : "The match API returned an unsuccessful response.";
      throw new Error(message);
    }
    if (envelope.data?.status !== void 0 && envelope.data.status !== 200) {
      const message = typeof envelope.message === "string" ? envelope.message : `The match API returned status ${String(envelope.data.status)}.`;
      throw new Error(message);
    }
  }
  function stringValue(value, fallback = "") {
    if (value === void 0 || value === null) {
      return fallback;
    }
    return String(value);
  }
  function firstNonEmptyString(fallback, ...values) {
    for (const value of values) {
      const text = stringValue(value).trim();
      if (text) {
        return text;
      }
    }
    return fallback;
  }
  function getMappedValue(row, path) {
    return path ? getByPath(row, path) : void 0;
  }
  function mapPayloadMatches(payload, config, mapping, status) {
    const rows = getByPath(
      payload,
      mapping.matchesPath
    );
    if (!Array.isArray(rows)) {
      throw new Error(
        `The matches path "${mapping.matchesPath}" did not resolve to an array.`
      );
    }
    return rows.map(
      (row, index) => {
        const parsedStart = normalizeMatchTimestamp(
          parseDate(
            getMappedValue(
              row,
              mapping.startPath
            ),
            config.timestampTimeZone
          )
        );
        const parsedEnd = mapping.endPath ? normalizeMatchTimestamp(
          parseDate(
            getMappedValue(
              row,
              mapping.endPath
            ),
            config.timestampTimeZone
          )
        ) : null;
        if (!parsedStart && status !== "result") {
          return null;
        }
        const start = parsedStart ?? /* @__PURE__ */ new Date();
        const rawMatchPage = getMappedValue(
          row,
          mapping.matchUrlPath
        );
        const end = parsedEnd;
        const rawId = getMappedValue(
          row,
          mapping.idPath
        );
        return {
          id: typeof rawId === "string" || typeof rawId === "number" ? rawId : index,
          status,
          start,
          hasStartTime: parsedStart !== null,
          end,
          timeLabel: firstNonEmptyString(
            "",
            getMappedValue(
              row,
              mapping.timeLabelPath
            )
          ),
          event: firstNonEmptyString(
            "Valorant pro match",
            getMappedValue(
              row,
              mapping.eventPath
            )
          ),
          series: firstNonEmptyString(
            "",
            getMappedValue(
              row,
              mapping.seriesPath
            )
          ),
          team1: firstNonEmptyString(
            "TBD",
            getMappedValue(
              row,
              mapping.team1Path
            )
          ),
          team2: firstNonEmptyString(
            "TBD",
            getMappedValue(
              row,
              mapping.team2Path
            )
          ),
          flag1: stringValue(
            getMappedValue(
              row,
              mapping.flag1Path
            )
          ),
          flag2: stringValue(
            getMappedValue(
              row,
              mapping.flag2Path
            )
          ),
          url: buildMatchPageUrl(
            rawMatchPage,
            config.matchPageBaseUrl
          ),
          score1: stringValue(
            getMappedValue(
              row,
              mapping.score1Path
            )
          ),
          score2: stringValue(
            getMappedValue(
              row,
              mapping.score2Path
            )
          ),
          team1RoundCt: stringValue(
            getMappedValue(
              row,
              mapping.team1RoundCtPath
            )
          ),
          team1RoundT: stringValue(
            getMappedValue(
              row,
              mapping.team1RoundTPath
            )
          ),
          team2RoundCt: stringValue(
            getMappedValue(
              row,
              mapping.team2RoundCtPath
            )
          ),
          team2RoundT: stringValue(
            getMappedValue(
              row,
              mapping.team2RoundTPath
            )
          ),
          currentMap: stringValue(
            getMappedValue(
              row,
              mapping.currentMapPath
            )
          ),
          mapNumber: stringValue(
            getMappedValue(
              row,
              mapping.mapNumberPath
            )
          )
        };
      }
    ).filter(
      (match) => match !== null
    );
  }
  function sortMatches(matches, sort) {
    if (sort === "api") {
      return matches;
    }
    const direction = sort === "descending" ? -1 : 1;
    return [...matches].sort(
      (firstMatch, secondMatch) => (firstMatch.start.getTime() - secondMatch.start.getTime()) * direction
    );
  }
  async function fetchMatches(config, options = {}) {
    const endpointKey = options.endpointKey ?? "upcoming";
    const endpointConfig = config.endpoints[endpointKey];
    if (!config.baseUrl && !/^https?:\/\//i.test(endpointConfig.endpoint)) {
      throw new Error(
        "Configure the API base URL in Settings first."
      );
    }
    const url = buildEndpointApiUrl(
      config,
      endpointKey,
      options.page
    );
    const headers = parseHeaders(config.headers);
    const response = await fetch(url, {
      method: "GET",
      headers
    });
    if (!response.ok) {
      throw new Error(
        `API request failed (${response.status} ${response.statusText}).`
      );
    }
    const payload = await response.json();
    validateEnvelope(payload);
    const matches = mapPayloadMatches(
      payload,
      config,
      endpointConfig.mapping,
      options.status ?? "upcoming"
    );
    const now = Date.now() - 6e4;
    const filtered = options.includePast ? matches : matches.filter(
      (match) => match.start.getTime() >= now
    );
    return sortMatches(
      filtered,
      options.sort ?? "ascending"
    );
  }

  // src/core/storage.ts
  var ACTIVE_MATCH_FILTER_KEY = "activeMatchFilter";
  async function loadConfig(storage) {
    const storedConfig = await storage.getSyncConfig();
    return normalizeConfig(
      storedConfig
    );
  }
  async function saveConfig(storage, config) {
    await storage.setSyncConfig(config);
  }
  async function saveActiveMatchFilter(storage, filter) {
    await storage.setLocalValue(ACTIVE_MATCH_FILTER_KEY, filter);
  }

  // src/ui/settingsFormView.ts
  var mappingFields = [
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
  function requiredElement(selector) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing settings element: ${selector}`);
    return element;
  }
  function fieldId(endpointKey, field) {
    return `${endpointKey}_${field}`;
  }
  function endpointInputId(endpointKey) {
    return `${endpointKey}_endpoint`;
  }
  function mountSettingsFormView(platform) {
    const form = requiredElement("#settingsForm");
    const saveStatus = requiredElement("#saveStatus");
    const testButton = requiredElement("#testButton");
    const testNotificationButton = requiredElement("#testNotificationButton");
    const restoreDefaultsButton = requiredElement("#restoreDefaultsButton");
    const liveNotificationsCheckbox = requiredElement("#liveNotificationsEnabled");
    if (!platform.supportsLiveNotifications) {
      testNotificationButton.hidden = true;
      const notificationField = liveNotificationsCheckbox.closest("label") ?? liveNotificationsCheckbox;
      notificationField.hidden = true;
      notificationField.style.display = "none";
    }
    function setValue(selector, value) {
      const element = requiredElement(selector);
      if (element instanceof HTMLInputElement && element.type === "checkbox") {
        element.checked = Boolean(value);
      } else {
        element.value = String(value);
      }
    }
    async function populate() {
      const config = await loadConfig(platform.storage);
      setValue("#baseUrl", config.baseUrl);
      setValue("#headers", config.headers);
      setValue("#matchPageBaseUrl", config.matchPageBaseUrl);
      setValue("#durationMinutes", config.durationMinutes);
      setValue("#timestampTimeZone", config.timestampTimeZone);
      setValue("#defaultMatchFilter", config.defaultMatchFilter);
      setValue("#liveNotificationsEnabled", config.liveNotificationsEnabled);
      MATCH_ENDPOINT_KEYS.forEach((endpointKey) => {
        setValue(
          `#${endpointInputId(endpointKey)}`,
          config.endpoints[endpointKey].endpoint
        );
        mappingFields.forEach((field) => {
          setValue(
            `#${fieldId(endpointKey, field)}`,
            config.endpoints[endpointKey].mapping[field]
          );
        });
      });
    }
    function readValue(selector) {
      return requiredElement(selector).value.trim();
    }
    function readCheckbox(selector) {
      const element = requiredElement(selector);
      return element.checked;
    }
    function readMapping(endpointKey) {
      const mapping = { ...DEFAULT_CONFIG.endpoints[endpointKey].mapping };
      mappingFields.forEach((field) => {
        mapping[field] = readValue(
          `#${fieldId(endpointKey, field)}`
        );
      });
      return mapping;
    }
    function readForm() {
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
        timestampTimeZone: readValue("#timestampTimeZone") === "local" ? "local" : "UTC",
        defaultMatchFilter: readValue("#defaultMatchFilter") === "all" ? "all" : "vct",
        liveNotificationsEnabled: platform.supportsLiveNotifications && readCheckbox("#liveNotificationsEnabled")
      };
    }
    async function ensureApiPermission(config) {
      const origins = Array.from(
        new Set(
          MATCH_ENDPOINT_KEYS.map(
            (endpointKey) => originPermissionPattern(
              buildEndpointApiUrl(config, endpointKey)
            )
          )
        )
      );
      await platform.ensureOrigins(origins);
    }
    function setStatus(message, isError = false) {
      saveStatus.className = isError ? "status error" : "status";
      saveStatus.textContent = message;
    }
    function validateConfig(config) {
      JSON.parse(config.headers || "{}");
      if (!Number.isFinite(config.durationMinutes) || config.durationMinutes < 1) {
        throw new Error("Default duration must be at least 1 minute.");
      }
    }
    async function saveConfigForTest(config) {
      validateConfig(config);
      await ensureApiPermission(config);
      await saveConfig(platform.storage, config);
      await saveActiveMatchFilter(platform.storage, config.defaultMatchFilter);
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void (async () => {
        setStatus("");
        try {
          const config = readForm();
          await saveConfigForTest(config);
          setStatus("Settings saved.");
        } catch (error) {
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
          } catch (error) {
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
            `Connection successful. ${upcomingMatches.length} upcoming, ${liveMatches.length} live, ${results.length} results found.`
          );
        } catch (error) {
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
    void populate().catch((error) => {
      setStatus(
        error instanceof Error ? error.message : "Unexpected error.",
        true
      );
    });
  }

  // src/platform/extension/storage.ts
  var extensionStorage = {
    async getSyncConfig() {
      return chrome.storage.sync.get(null);
    },
    async setSyncConfig(config) {
      await chrome.storage.sync.set(config);
    },
    async getLocalValue(key) {
      const stored = await chrome.storage.local.get(key);
      return stored[key];
    },
    async setLocalValue(key, value) {
      await chrome.storage.local.set({ [key]: value });
    }
  };

  // src/platform/extension/permissions.ts
  async function ensureOrigins(origins) {
    if (await chrome.permissions.contains({ origins })) return;
    const granted = await chrome.permissions.request({ origins });
    if (!granted) throw new Error("API host access was not granted.");
  }

  // src/options.ts
  mountSettingsFormView({
    storage: extensionStorage,
    ensureOrigins,
    supportsLiveNotifications: true,
    testLiveNotification: () => chrome.runtime.sendMessage({
      type: "test-live-notification"
    })
  });
})();
