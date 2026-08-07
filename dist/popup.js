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
  function calendarTimestamp(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }
  function createCalendarUrl(match, durationMinutes) {
    const validDuration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 120;
    const end = match.end ?? new Date(
      match.start.getTime() + validDuration * 6e4
    );
    const description = [
      match.event ? `Event: ${match.event}` : "",
      match.series ? `Series: ${match.series}` : "",
      match.url ? `Match page: ${match.url}` : ""
    ].filter(Boolean).join("\n");
    const parameters = new URLSearchParams({
      action: "TEMPLATE",
      text: `${match.team1} vs ${match.team2}`,
      dates: `${calendarTimestamp(match.start)}/${calendarTimestamp(end)}`,
      details: description
    });
    return "https://calendar.google.com/calendar/render?" + parameters.toString();
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
  async function saveActiveMatchFilter(filter) {
    await chrome.storage.local.set({
      [ACTIVE_MATCH_FILTER_KEY]: filter
    });
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

  // src/popup.ts
  function requiredElement(selector) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }
  var statusElement = requiredElement("#status");
  var matchesElement = requiredElement("#matches");
  var refreshButton = requiredElement("#refreshButton");
  var settingsButton = requiredElement("#settingsButton");
  var scheduleViewButton = requiredElement("#scheduleViewButton");
  var resultsViewButton = requiredElement("#resultsViewButton");
  var vctFilterButton = requiredElement("#vctFilterButton");
  var allFilterButton = requiredElement("#allFilterButton");
  var pageButtons = Array.from(
    document.querySelectorAll("[data-page]")
  );
  var viewButtons = {
    schedule: scheduleViewButton,
    results: resultsViewButton
  };
  var filterButtons = {
    vct: vctFilterButton,
    all: allFilterButton
  };
  var selectedView = "schedule";
  var selectedFilter = null;
  var selectedPage = 1;
  var latestRenderId = 0;
  settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
  refreshButton.addEventListener("click", () => void renderMatches());
  scheduleViewButton.addEventListener("click", () => {
    selectedView = "schedule";
    selectedPage = 1;
    void renderMatches();
  });
  resultsViewButton.addEventListener("click", () => {
    selectedView = "results";
    selectedPage = 1;
    void renderMatches();
  });
  vctFilterButton.addEventListener("click", () => {
    selectedFilter = "vct";
    void saveActiveMatchFilter(selectedFilter);
    void renderMatches();
  });
  allFilterButton.addEventListener("click", () => {
    selectedFilter = "all";
    void saveActiveMatchFilter(selectedFilter);
    void renderMatches();
  });
  pageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const page = Number(button.dataset.page);
      if (!Number.isInteger(page)) return;
      selectedPage = page;
      void renderMatches();
    });
  });
  function activeFilter() {
    return selectedFilter ?? "vct";
  }
  function updateControls() {
    Object.keys(viewButtons).forEach((view) => {
      const active = selectedView === view;
      viewButtons[view].classList.toggle("active", active);
      viewButtons[view].setAttribute("aria-pressed", String(active));
    });
    const filter = activeFilter();
    Object.keys(filterButtons).forEach((matchFilter) => {
      const active = filter === matchFilter;
      filterButtons[matchFilter].classList.toggle("active", active);
      filterButtons[matchFilter].setAttribute("aria-pressed", String(active));
    });
    pageButtons.forEach((button) => {
      const active = Number(button.dataset.page) === selectedPage;
      button.classList.toggle("active", active);
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }
  function isSameLocalDate(firstDate, secondDate) {
    return firstDate.getFullYear() === secondDate.getFullYear() && firstDate.getMonth() === secondDate.getMonth() && firstDate.getDate() === secondDate.getDate();
  }
  function roundedDisplayDate(date) {
    const roundedDate = new Date(date);
    if (roundedDate.getSeconds() > 0 || roundedDate.getMilliseconds() > 0) {
      roundedDate.setMinutes(roundedDate.getMinutes() + 1);
    }
    roundedDate.setSeconds(0, 0);
    return roundedDate;
  }
  function formatClockTime(date) {
    return new Intl.DateTimeFormat(void 0, {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }
  function formatTimeUntil(date) {
    const totalMinutes = Math.max(
      0,
      Math.ceil(
        (date.getTime() - Date.now()) / 6e4
      )
    );
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
  }
  function formatMatchDate(date) {
    const displayDate = roundedDisplayDate(date);
    if (isSameLocalDate(displayDate, /* @__PURE__ */ new Date())) {
      return `Today, ${formatClockTime(displayDate)} - in ${formatTimeUntil(displayDate)}`;
    }
    return new Intl.DateTimeFormat(void 0, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(displayDate);
  }
  function flagCodeToEmoji(flag) {
    const code = flag.replace(/^(flag_|mod-)/, "").toUpperCase();
    if (code === "UN") return "\u{1F310}";
    if (!/^[A-Z]{2}$/.test(code)) return "";
    return [...code].map((character) => String.fromCodePoint(127397 + character.charCodeAt(0))).join("");
  }
  function hasScore(match) {
    return match.score1 !== "" || match.score2 !== "";
  }
  function formatScore(match) {
    if (!hasScore(match)) return "";
    return `${match.score1 || "0"} - ${match.score2 || "0"}`;
  }
  function isRoundScoreValue(value) {
    const normalizedValue = value.trim();
    return normalizedValue !== "" && normalizedValue.toUpperCase() !== "N/A";
  }
  function roundScoreValue(ctValue, tValue) {
    if (isRoundScoreValue(ctValue)) {
      return {
        value: ctValue.trim(),
        side: "ct"
      };
    }
    if (isRoundScoreValue(tValue)) {
      return {
        value: tValue.trim(),
        side: "t"
      };
    }
    return null;
  }
  function liveRoundScore(match) {
    const team1Score = roundScoreValue(
      match.team1RoundCt,
      match.team1RoundT
    );
    const team2Score = roundScoreValue(
      match.team2RoundCt,
      match.team2RoundT
    );
    if (!team1Score || !team2Score) {
      return null;
    }
    return [team1Score, team2Score];
  }
  function roundScoreElement(match) {
    const roundScore = liveRoundScore(match);
    if (!roundScore) {
      return null;
    }
    const [team1Score, team2Score] = roundScore;
    const element = document.createElement("span");
    element.className = "round-score";
    const team1Value = document.createElement("span");
    team1Value.className = `round-score-value round-score-value--${team1Score.side}`;
    team1Value.textContent = team1Score.value;
    const separator = document.createElement("span");
    separator.textContent = "-";
    const team2Value = document.createElement("span");
    team2Value.className = `round-score-value round-score-value--${team2Score.side}`;
    team2Value.textContent = team2Score.value;
    element.append("(", team1Value, separator, team2Value, ")");
    return element;
  }
  function liveDetails(match) {
    const details = [
      match.mapNumber && match.mapNumber !== "Unknown" ? `Map ${match.mapNumber}` : "",
      match.currentMap && match.currentMap !== "Unknown" ? match.currentMap : ""
    ].filter(Boolean);
    return details.join(" | ");
  }
  function matchTimeLabel(match) {
    if (match.status === "live") {
      return "Live now";
    }
    if (match.status === "result" && match.timeLabel) {
      return `Completed ${match.timeLabel}`;
    }
    if (match.hasStartTime) {
      return formatMatchDate(match.start);
    }
    return match.timeLabel || "";
  }
  function openMatchPage(match) {
    if (!match.url) return;
    void chrome.tabs.create({
      url: match.url
    });
  }
  function matchCard(match, config) {
    const article = document.createElement("article");
    article.className = `match-card match-card--${match.status}`;
    if (match.url) {
      article.classList.add("has-match-link");
      article.tabIndex = 0;
      article.setAttribute("role", "link");
      article.title = "click to see match in VLR.gg";
      article.addEventListener("click", (event2) => {
        const target = event2.target;
        if (target instanceof Element && target.closest("button")) {
          return;
        }
        openMatchPage(match);
      });
      article.addEventListener("keydown", (event2) => {
        const target = event2.target;
        if (target instanceof Element && target.closest("button")) {
          return;
        }
        if (event2.key !== "Enter" && event2.key !== " ") {
          return;
        }
        event2.preventDefault();
        openMatchPage(match);
      });
    }
    const content = document.createElement("div");
    content.className = "match-content";
    const cardHeader = document.createElement("div");
    cardHeader.className = "match-card-header";
    const event = document.createElement("p");
    event.className = "event-name";
    event.textContent = match.event;
    cardHeader.append(event);
    if (match.status === "live" || match.status === "result") {
      const tag = document.createElement("span");
      tag.className = `match-tag match-tag--${match.status}`;
      tag.textContent = match.status === "live" ? "LIVE" : "RESULT";
      cardHeader.append(tag);
    }
    const teams = document.createElement("div");
    teams.className = "teams-row";
    const title = document.createElement("h2");
    const team1Flag = flagCodeToEmoji(match.flag1);
    const team2Flag = flagCodeToEmoji(match.flag2);
    title.textContent = `${team1Flag ? `${team1Flag} ` : ""}${match.team1} vs ${team2Flag ? `${team2Flag} ` : ""}${match.team2}`;
    teams.append(title);
    const scoreText = formatScore(match);
    if (scoreText) {
      const scoreGroup = document.createElement("div");
      scoreGroup.className = "score-stack";
      const score = document.createElement("span");
      score.className = "match-score";
      score.textContent = scoreText;
      scoreGroup.append(score);
      if (match.status === "live") {
        const roundScore = roundScoreElement(match);
        if (roundScore) {
          scoreGroup.append(roundScore);
        }
      }
      teams.append(scoreGroup);
    }
    const series = document.createElement("p");
    series.className = "series-name";
    series.textContent = match.series;
    series.hidden = !match.series;
    const meta = document.createElement("div");
    meta.className = "match-meta";
    const timeLabel = matchTimeLabel(match);
    if (timeLabel) {
      if (match.hasStartTime) {
        const time = document.createElement("time");
        time.dateTime = match.start.toISOString();
        time.textContent = timeLabel;
        meta.append(time);
      } else {
        const time = document.createElement("span");
        time.textContent = timeLabel;
        meta.append(time);
      }
    }
    const matchDetails = match.status === "live" ? liveDetails(match) : "";
    if (matchDetails) {
      const details = document.createElement("span");
      details.textContent = matchDetails;
      meta.append(details);
    }
    content.append(cardHeader, teams, series, meta);
    article.append(content);
    if (match.status === "upcoming" && match.hasStartTime) {
      const addButton = document.createElement("button");
      addButton.className = "add-button";
      addButton.type = "button";
      addButton.textContent = "+ Add";
      addButton.title = "Add to Google Calendar";
      addButton.addEventListener("click", (event2) => {
        event2.stopPropagation();
        void chrome.tabs.create({
          url: createCalendarUrl(match, config.durationMinutes || 120)
        });
      });
      article.append(addButton);
    }
    return article;
  }
  function uniqueMatches(matches) {
    const seen = /* @__PURE__ */ new Set();
    return matches.filter((match) => {
      const key = match.url || `${match.status}:${String(match.id)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  async function fetchMatchesForView(config) {
    if (selectedView === "results") {
      return fetchMatches(config, {
        endpointKey: "results",
        page: selectedPage,
        status: "result",
        includePast: true,
        sort: "api"
      });
    }
    const upcomingMatchesRequest = fetchMatches(config, {
      endpointKey: "upcoming",
      page: selectedPage,
      status: "upcoming"
    });
    if (selectedPage !== 1) {
      return upcomingMatchesRequest;
    }
    const [liveMatches, upcomingMatches] = await Promise.all([
      fetchMatches(config, {
        endpointKey: "live",
        status: "live",
        includePast: true,
        sort: "api"
      }),
      upcomingMatchesRequest
    ]);
    return uniqueMatches([
      ...liveMatches,
      ...upcomingMatches
    ]);
  }
  function filterMatches(matches) {
    if (activeFilter() === "all") {
      return matches;
    }
    return matches.filter(
      (match) => matchPassesFilter(match, activeFilter())
    );
  }
  function statusText(count) {
    const noun = selectedView === "results" ? "result" : "match";
    if (count === 0) {
      return `No ${activeFilter() === "vct" ? "VCT " : ""}${noun}s found.`;
    }
    return `${count} ${noun}${count === 1 ? "" : "es"} found`;
  }
  function renderEmptyState() {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Try another page or switch the filter.";
    matchesElement.append(empty);
  }
  async function renderMatches() {
    const renderId = ++latestRenderId;
    statusElement.className = "status";
    statusElement.textContent = "Loading matches...";
    matchesElement.replaceChildren();
    refreshButton.disabled = true;
    updateControls();
    try {
      const config = await loadConfig();
      selectedFilter ??= normalizeMatchFilter(
        await loadActiveMatchFilter(config)
      );
      updateControls();
      const matches = filterMatches(
        await fetchMatchesForView(config)
      );
      if (renderId !== latestRenderId) return;
      statusElement.textContent = statusText(matches.length);
      if (matches.length === 0) {
        renderEmptyState();
        return;
      }
      matches.forEach((match) => matchesElement.append(matchCard(match, config)));
    } catch (error) {
      if (renderId !== latestRenderId) return;
      statusElement.className = "status error";
      statusElement.textContent = error instanceof Error ? error.message : "Unexpected error.";
    } finally {
      if (renderId === latestRenderId) {
        refreshButton.disabled = false;
      }
    }
  }
  void renderMatches();
})();
