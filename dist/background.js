"use strict";
(() => {
  // src/common.ts
  var ACTIVE_MATCH_FILTER_KEY = "activeMatchFilter";
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
  async function loadConfig() {
    const storedConfig = await chrome.storage.sync.get(
      null
    );
    return normalizeConfig(
      storedConfig
    );
  }
  function normalizeMatchFilter(filter) {
    return filter === "all" ? "all" : "vct";
  }
  function matchPassesFilter(match, filter) {
    return filter === "all" || /\bvct\b/i.test(match.event);
  }
  async function loadActiveMatchFilter(config) {
    const stored = await chrome.storage.local.get(
      ACTIVE_MATCH_FILTER_KEY
    );
    return normalizeMatchFilter(
      stored[ACTIVE_MATCH_FILTER_KEY] ?? config.defaultMatchFilter
    );
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

  // src/background.ts
  var LIVE_ALARM_NAME = "valorant-live-match-check";
  var CHECK_PERIOD_MINUTES = 5;
  var NOTIFIED_IDS_KEY = "notifiedLiveMatchIds";
  var NOTIFICATION_URLS_KEY = "liveNotificationUrls";
  function notificationId(match) {
    return `live-${String(match.id).replace(/[^a-z0-9_-]/gi, "_")}`;
  }
  function matchKey(match) {
    return match.url || String(match.id);
  }
  async function notifiedIds() {
    const stored = await chrome.storage.local.get(NOTIFIED_IDS_KEY);
    const value = stored[NOTIFIED_IDS_KEY];
    return new Set(
      Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
    );
  }
  async function saveNotifiedIds(ids) {
    await chrome.storage.local.set({
      [NOTIFIED_IDS_KEY]: Array.from(ids).slice(-200)
    });
  }
  async function saveNotificationUrl(id, url) {
    if (!url) return;
    const stored = await chrome.storage.local.get(NOTIFICATION_URLS_KEY);
    const urls = stored[NOTIFICATION_URLS_KEY] && typeof stored[NOTIFICATION_URLS_KEY] === "object" && !Array.isArray(stored[NOTIFICATION_URLS_KEY]) ? stored[NOTIFICATION_URLS_KEY] : {};
    urls[id] = url;
    await chrome.storage.local.set({
      [NOTIFICATION_URLS_KEY]: urls
    });
  }
  async function notifyLiveMatch(match, id = notificationId(match)) {
    const score = match.score1 || match.score2 ? ` (${match.score1 || "0"}-${match.score2 || "0"})` : "";
    await chrome.notifications.create(id, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Valorant match is live",
      message: `${match.team1} vs ${match.team2}${score}`,
      contextMessage: match.event || void 0,
      priority: 1
    });
    await saveNotificationUrl(id, match.url);
  }
  async function testNotification() {
    const config = await loadConfig();
    const filter = await loadActiveMatchFilter(config);
    const liveMatches = await fetchMatches(config, {
      endpointKey: "live",
      status: "live",
      includePast: true,
      sort: "api"
    });
    const match = liveMatches.find(
      (liveMatch) => matchPassesFilter(liveMatch, filter)
    );
    if (match) {
      await notifyLiveMatch(
        match,
        `test-${notificationId(match)}-${Date.now()}`
      );
      return `Test notification sent for ${match.team1} vs ${match.team2}.`;
    }
    await chrome.notifications.create(`test-live-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Valorant notification test",
      message: filter === "vct" ? "Notifications are working. No live VCT match is currently available." : "Notifications are working. No live match is currently available.",
      priority: 1
    });
    return "Test notification sent.";
  }
  async function checkLiveMatches() {
    const config = await loadConfig();
    if (!config.liveNotificationsEnabled) {
      return;
    }
    const liveMatches = await fetchMatches(config, {
      endpointKey: "live",
      status: "live",
      includePast: true,
      sort: "api"
    });
    const filter = await loadActiveMatchFilter(config);
    const notified = await notifiedIds();
    let changed = false;
    for (const match of liveMatches) {
      if (!matchPassesFilter(match, filter)) {
        continue;
      }
      const key = matchKey(match);
      if (notified.has(key)) {
        continue;
      }
      notified.add(key);
      changed = true;
      await notifyLiveMatch(match);
    }
    if (changed) {
      await saveNotifiedIds(notified);
    }
  }
  async function syncLiveAlarm() {
    const config = await loadConfig();
    if (!config.liveNotificationsEnabled) {
      await chrome.alarms.clear(LIVE_ALARM_NAME);
      return;
    }
    await chrome.alarms.create(LIVE_ALARM_NAME, {
      periodInMinutes: CHECK_PERIOD_MINUTES
    });
    await checkLiveMatches();
  }
  function runLiveCheck() {
    void checkLiveMatches().catch((error) => {
      console.warn("Live match notification check failed.", error);
    });
  }
  function runAlarmSync() {
    void syncLiveAlarm().catch((error) => {
      console.warn("Live match notification alarm sync failed.", error);
    });
  }
  chrome.runtime.onInstalled.addListener(() => {
    runAlarmSync();
  });
  chrome.runtime.onStartup.addListener(() => {
    runAlarmSync();
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync") {
      if ("liveNotificationsEnabled" in changes || "endpoints" in changes || "baseUrl" in changes || "headers" in changes) {
        runAlarmSync();
      }
      return;
    }
    if (areaName === "local" && ACTIVE_MATCH_FILTER_KEY in changes) {
      runLiveCheck();
    }
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === LIVE_ALARM_NAME) {
      runLiveCheck();
    }
  });
  chrome.notifications.onClicked.addListener((notificationId2) => {
    void (async () => {
      const stored = await chrome.storage.local.get(NOTIFICATION_URLS_KEY);
      const urls = stored[NOTIFICATION_URLS_KEY] && typeof stored[NOTIFICATION_URLS_KEY] === "object" && !Array.isArray(stored[NOTIFICATION_URLS_KEY]) ? stored[NOTIFICATION_URLS_KEY] : {};
      const url = urls[notificationId2];
      if (url) {
        await chrome.tabs.create({ url });
      }
    })();
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object" || message.type !== "test-live-notification") {
      return false;
    }
    void testNotification().then((result) => {
      sendResponse({
        ok: true,
        message: result
      });
    }).catch((error) => {
      sendResponse({
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected error."
      });
    });
    return true;
  });
})();
