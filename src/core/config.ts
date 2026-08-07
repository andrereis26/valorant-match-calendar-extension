import type {
  ExtensionConfig,
  MatchEndpointKey,
  MatchFilter,
  MatchResponseMapping
} from "./types";

export const MATCH_ENDPOINT_KEYS: MatchEndpointKey[] = [
  "upcoming",
  "live",
  "results"
];

const DEFAULT_MATCH_MAPPING: MatchResponseMapping = {
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

const DEFAULT_RESULTS_MAPPING: MatchResponseMapping = {
  ...DEFAULT_MATCH_MAPPING,
  startPath: "",
  eventPath: "tournament_name",
  seriesPath: "round_info",
  timeLabelPath: "time_completed"
};

/**
 * Default configuration used on first installation.
 *
 * Replace the local URL with the public URL of your
 * self-hosted API before publishing the extension.
 *
 * Users can still override every setting through the options page.
 */
export const DEFAULT_CONFIG: ExtensionConfig = {
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

export type LegacyConfig = Partial<ExtensionConfig> & {
  endpoint?: unknown;
  matchesPath?: unknown;
  idPath?: unknown;
  startPath?: unknown;
  endPath?: unknown;
  eventPath?: unknown;
  seriesPath?: unknown;
  team1Path?: unknown;
  team2Path?: unknown;
  flag1Path?: unknown;
  flag2Path?: unknown;
  matchUrlPath?: unknown;
};

function stringConfigValue(
  value: unknown,
  fallback: string
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function numberConfigValue(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function booleanConfigValue(
  value: unknown,
  fallback: boolean
): boolean {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function mappingFromLegacy(
  storedConfig: LegacyConfig
): Partial<MatchResponseMapping> {
  const mapping: Partial<MatchResponseMapping> = {};

  (
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
    ] as Array<keyof LegacyConfig & keyof MatchResponseMapping>
  ).forEach(key => {
    if (typeof storedConfig[key] === "string") {
      mapping[key] = storedConfig[key];
    }
  });

  return mapping;
}

function configuredEndpoint(
  storedConfig: LegacyConfig,
  endpointKey: MatchEndpointKey
): string {
  const configuredEndpoint =
    storedConfig.endpoints?.[endpointKey]?.endpoint;

  if (typeof configuredEndpoint === "string") {
    return configuredEndpoint;
  }

  if (
    storedConfig.endpoints === undefined &&
    endpointKey === "upcoming" &&
    typeof storedConfig.endpoint === "string"
  ) {
    return storedConfig.endpoint;
  }

  return DEFAULT_CONFIG.endpoints[endpointKey].endpoint;
}

function configuredMapping(
  storedConfig: LegacyConfig,
  endpointKey: MatchEndpointKey
): MatchResponseMapping {
  const mapping =
    storedConfig.endpoints?.[endpointKey]?.mapping;

  const legacyMapping =
    storedConfig.endpoints === undefined &&
      endpointKey !== "results"
      ? mappingFromLegacy(storedConfig)
      : {};

  return {
    ...DEFAULT_CONFIG.endpoints[endpointKey].mapping,
    ...legacyMapping,
    ...(
      mapping &&
        typeof mapping === "object" &&
        !Array.isArray(mapping)
        ? mapping
        : {}
    )
  };
}

export function normalizeConfig(
  storedConfig: LegacyConfig
): ExtensionConfig {
  const defaultFilter =
    storedConfig.defaultMatchFilter === "all"
      ? "all"
      : DEFAULT_CONFIG.defaultMatchFilter;

  const timestampTimeZone =
    storedConfig.timestampTimeZone === "local"
      ? "local"
      : DEFAULT_CONFIG.timestampTimeZone;

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

export function normalizeMatchFilter(
  filter: unknown
): MatchFilter {
  return filter === "all" ? "all" : "vct";
}
