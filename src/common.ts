import type {
  ExtensionConfig,
  Match,
  MatchStatus
} from "./types";

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
  endpoint: "/v2/match?q=upcoming",

  headers: "{}",

  // The API returns matches inside data.segments.
  matchesPath: "data.segments",

  // match_page should be unique for each match.
  idPath: "match_page",

  startPath: "unix_timestamp",

  // The current API response does not provide an end timestamp.
  endPath: "",

  eventPath: "match_event",
  seriesPath: "match_series",

  team1Path: "team1",
  team2Path: "team2",

  flag1Path: "flag1",
  flag2Path: "flag2",

  matchUrlPath: "match_page",

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
  defaultMatchFilter: "vct"
};

/**
 * Reads a value from an object using a dot-separated path.
 *
 * Examples:
 *
 * getByPath(payload, "data.segments")
 * getByPath(match, "team1")
 * getByPath(match, "teams.0.name")
 */
export function getByPath(
  value: unknown,
  path: string
): unknown {
  if (!path) {
    return value;
  }

  return path
    .split(".")
    .reduce<unknown>((current, key) => {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        return undefined;
      }

      return (
        current as Record<string, unknown>
      )[key];
    }, value);
}

/**
 * Combines the configured base URL and endpoint.
 *
 * The endpoint may also be a complete URL. This allows users
 * to configure another API without changing the base URL.
 */
export function buildApiUrl(
  baseUrl: string,
  endpoint: string
): string {
  const route = endpoint.trim();

  if (/^https?:\/\//i.test(route)) {
    return route;
  }

  const base = baseUrl
    .trim()
    .replace(/\/+$/, "");

  return `${base}/${route.replace(/^\/+/, "")}`;
}

type MatchQuery =
  "upcoming" |
  "upcoming_extended" |
  "live_score" |
  "results";

/**
 * Reuses the configured match endpoint while replacing only the
 * query mode and optional API page. This keeps custom base URLs
 * and path prefixes intact.
 */
export function buildMatchEndpoint(
  endpoint: string,
  query: MatchQuery,
  page?: number
): string {
  const route = endpoint.trim();
  const isAbsolute = /^https?:\/\//i.test(route);
  const url = new URL(
    route,
    "https://valorant-match-calendar.local"
  );

  url.searchParams.set("q", query);
  url.searchParams.delete("num_pages");
  url.searchParams.delete("from_page");
  url.searchParams.delete("to_page");

  if (
    page !== undefined &&
    (
      query === "upcoming_extended" ||
      query === "results"
    )
  ) {
    const normalizedPage =
      Math.min(
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
  }

  if (isAbsolute) {
    return url.href;
  }

  return `${url.pathname}${url.search}`;
}

/**
 * Converts a URL into a Chrome host-permission pattern.
 *
 * Example:
 *
 * http://127.0.0.1:3001/v2/match?q=upcoming
 *
 * becomes:
 *
 * http://127.0.0.1:3001/*
 */
export function originPermissionPattern(
  urlString: string
): string {
  const url = new URL(urlString);

  return `${url.protocol}//${url.host}/*`;
}

/**
 * Converts an API timestamp into a Date.
 *
 * Currently supports:
 *
 * 1. Unix timestamps in seconds
 * 2. Unix timestamps in milliseconds
 * 3. ISO 8601 strings
 * 4. The current API format:
 *    "2026-08-06 18:00:00"
 *
 * The current API format does not contain timezone information,
 * so timestampTimeZone determines whether it is interpreted as
 * UTC or as the user's local timezone.
 */
function parseDate(
  value: unknown,
  timestampTimeZone: ExtensionConfig["timestampTimeZone"]
): Date | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  /*
   * Handle numeric Unix timestamps and numeric strings.
   */
  if (
    typeof value === "number" ||
    (
      typeof value === "string" &&
      /^\d+$/.test(value.trim())
    )
  ) {
    let timestamp = Number(value);

    /*
     * Unix timestamps in seconds are normally smaller
     * than 1,000,000,000,000.
     */
    if (timestamp < 1e12) {
      timestamp *= 1000;
    }

    const date = new Date(timestamp);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  if (typeof value !== "string") {
    return null;
  }

  const timestamp = value.trim();

  /*
   * Explicitly parse the current API timestamp format:
   *
   * YYYY-MM-DD HH:mm:ss
   *
   * Example:
   *
   * 2026-08-06 18:00:00
   */
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

    const date =
      timestampTimeZone === "UTC"
        ? new Date(
          Date.UTC(
            year,
            month - 1,
            day,
            hour,
            minute,
            second
          )
        )
        : new Date(
          year,
          month - 1,
          day,
          hour,
          minute,
          second
        );

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  /*
   * Fallback for ISO 8601 timestamps, such as:
   *
   * 2026-08-06T18:00:00Z
   * 2026-08-06T18:00:00+01:00
   */
  const date = new Date(timestamp);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function normalizeMatchTimestamp(
  date: Date | null
): Date | null {
  if (!date) {
    return null;
  }

  const normalizedDate = new Date(date);

  if (
    normalizedDate.getSeconds() > 0 ||
    normalizedDate.getMilliseconds() > 0
  ) {
    normalizedDate.setMinutes(normalizedDate.getMinutes() + 1);
  }

  normalizedDate.setSeconds(0, 0);
  return normalizedDate;
}

/**
 * Builds the complete match-page URL.
 *
 * The current API returns a relative VLR path:
 *
 * 716636/gentle-mates-gc-vs-alternate-attax-ruby...
 *
 * This function converts it to:
 *
 * https://www.vlr.gg/716636/gentle-mates-gc-vs...
 *
 * If a future API already returns a complete URL, it is
 * preserved without modification.
 */
function buildMatchPageUrl(
  matchPage: unknown,
  matchPageBaseUrl: string
): string {
  if (
    typeof matchPage !== "string" ||
    !matchPage.trim()
  ) {
    return "";
  }

  const page = matchPage.trim();

  if (/^https?:\/\//i.test(page)) {
    return page;
  }

  const base = matchPageBaseUrl
    .trim()
    .replace(/\/+$/, "");

  const path = page.replace(/^\/+/, "");

  if (!base) {
    return path;
  }

  return `${base}/${path}`;
}

/**
 * Formats a Date for the Google Calendar URL.
 *
 * Example:
 *
 * 2026-08-06T18:00:00.000Z
 *
 * becomes:
 *
 * 20260806T180000Z
 */
function calendarTimestamp(
  date: Date
): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/**
 * Creates a URL that opens Google Calendar with a
 * pre-filled event.
 *
 * No Google OAuth configuration is required because the user
 * reviews and saves the Calendar event manually.
 */
export function createCalendarUrl(
  match: Match,
  durationMinutes: number
): string {
  const validDuration =
    Number.isFinite(durationMinutes) &&
      durationMinutes > 0
      ? durationMinutes
      : 120;

  /*
   * Use the API end time when available.
   *
   * Otherwise, assume the configured default duration.
   */
  const end =
    match.end ??
    new Date(
      match.start.getTime() +
      validDuration * 60_000
    );

  const description = [
    match.event
      ? `Event: ${match.event}`
      : "",

    match.series
      ? `Series: ${match.series}`
      : "",

    match.url
      ? `Match page: ${match.url}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  const parameters = new URLSearchParams({
    action: "TEMPLATE",

    text:
      `${match.team1} vs ${match.team2}`,

    dates:
      `${calendarTimestamp(match.start)}/` +
      `${calendarTimestamp(end)}`,

    details: description
  });

  return (
    "https://calendar.google.com/calendar/render?" +
    parameters.toString()
  );
}

/**
 * Loads configuration from Chrome sync storage.
 *
 * DEFAULT_CONFIG is used for any value that has not yet been
 * customised by the user.
 */
export async function loadConfig():
  Promise<ExtensionConfig> {
  const storedConfig =
    await chrome.storage.sync.get(
      DEFAULT_CONFIG
    );

  return {
    ...DEFAULT_CONFIG,
    ...storedConfig
  };
}

/**
 * Shape used only to validate the outer API response.
 */
interface ApiResponseEnvelope {
  status?: unknown;

  data?: {
    status?: unknown;
  };

  message?: unknown;
}

interface FetchMatchesOptions {
  query?: MatchQuery;
  page?: number;
  status?: MatchStatus;
  includePast?: boolean;
  sort?: "ascending" | "descending" | "api";
}

function parseHeaders(
  headersJson: string
): Record<string, string> {
  try {
    const parsedHeaders: unknown =
      JSON.parse(headersJson || "{}");

    if (
      parsedHeaders === null ||
      Array.isArray(parsedHeaders) ||
      typeof parsedHeaders !== "object"
    ) {
      throw new Error(
        "Headers must be a JSON object."
      );
    }

    return parsedHeaders as Record<string, string>;
  } catch {
    throw new Error(
      "Request headers must be valid JSON."
    );
  }
}

function validateEnvelope(
  payload: unknown
): void {
  /*
   * Validate the status envelope used by the current API.
   *
   * This validation is deliberately lenient. It only rejects
   * the response when the fields are present and explicitly
   * indicate failure.
   *
   * This keeps the extension compatible with other APIs that
   * may not return these fields.
   */
  if (
    payload === null ||
    typeof payload !== "object"
  ) {
    return;
  }

  const envelope =
    payload as ApiResponseEnvelope;

  if (
    envelope.status !== undefined &&
    envelope.status !== "success"
  ) {
    const message =
      typeof envelope.message === "string"
        ? envelope.message
        : "The match API returned an unsuccessful response.";

    throw new Error(message);
  }

  if (
    envelope.data?.status !== undefined &&
    envelope.data.status !== 200
  ) {
    const message =
      typeof envelope.message === "string"
        ? envelope.message
        : `The match API returned status ` +
        `${String(envelope.data.status)}.`;

    throw new Error(message);
  }
}

function stringValue(
  value: unknown,
  fallback = ""
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return String(value);
}

function firstNonEmptyString(
  fallback: string,
  ...values: unknown[]
): string {
  for (const value of values) {
    const text = stringValue(value).trim();

    if (text) {
      return text;
    }
  }

  return fallback;
}

function mapPayloadMatches(
  payload: unknown,
  config: ExtensionConfig,
  status: MatchStatus
): Match[] {
  const rows = getByPath(
    payload,
    config.matchesPath
  );

  if (!Array.isArray(rows)) {
    throw new Error(
      `The matches path ` +
      `"${config.matchesPath}" ` +
      `did not resolve to an array.`
    );
  }

  return rows
    .map(
      (
        row: unknown,
        index: number
      ): Match | null => {
        const parsedStart =
          normalizeMatchTimestamp(
            parseDate(
              getByPath(
                row,
                config.startPath
              ),
              config.timestampTimeZone
            )
          );

        const parsedEnd =
          config.endPath
            ? normalizeMatchTimestamp(
              parseDate(
                getByPath(
                  row,
                  config.endPath
                ),
                config.timestampTimeZone
              )
            )
            : null;

        /*
         * Schedule rows need a calendar-ready start time. Result
         * rows can still render with their relative completion label.
         */
        if (
          !parsedStart &&
          status !== "result"
        ) {
          return null;
        }

        const start = parsedStart ?? new Date();

        const rawMatchPage =
          getByPath(
            row,
            config.matchUrlPath
          );

        const end = parsedEnd;

        const rawId =
          getByPath(
            row,
            config.idPath
          );

        return {
          id:
            typeof rawId === "string" ||
              typeof rawId === "number"
              ? rawId
              : index,

          status,
          start,
          hasStartTime: parsedStart !== null,
          end,
          timeLabel: firstNonEmptyString(
            "",
            getByPath(row, "time_completed"),
            getByPath(row, "time_until_match")
          ),

          event: firstNonEmptyString(
            "Valorant pro match",
            getByPath(
              row,
              config.eventPath
            ),
            getByPath(row, "tournament_name")
          ),

          series: firstNonEmptyString(
            "",
            getByPath(
              row,
              config.seriesPath
            ),
            getByPath(row, "round_info")
          ),

          team1: firstNonEmptyString(
            "TBD",
            getByPath(
              row,
              config.team1Path
            )
          ),

          team2: firstNonEmptyString(
            "TBD",
            getByPath(
              row,
              config.team2Path
            )
          ),

          flag1: stringValue(
            getByPath(
              row,
              config.flag1Path
            )
          ),

          flag2: stringValue(
            getByPath(
              row,
              config.flag2Path
            )
          ),

          url: buildMatchPageUrl(
            rawMatchPage,
            config.matchPageBaseUrl
          ),

          score1: stringValue(
            getByPath(row, "score1")
          ),

          score2: stringValue(
            getByPath(row, "score2")
          ),

          team1RoundCt: stringValue(
            getByPath(row, "team1_round_ct")
          ),

          team1RoundT: stringValue(
            getByPath(row, "team1_round_t")
          ),

          team2RoundCt: stringValue(
            getByPath(row, "team2_round_ct")
          ),

          team2RoundT: stringValue(
            getByPath(row, "team2_round_t")
          ),

          currentMap: stringValue(
            getByPath(row, "current_map")
          ),

          mapNumber: stringValue(
            getByPath(row, "map_number")
          )
        };
      }
    )
    .filter(
      (match): match is Match =>
        match !== null
    );
}

function sortMatches(
  matches: Match[],
  sort: FetchMatchesOptions["sort"]
): Match[] {
  if (sort === "api") {
    return matches;
  }

  const direction =
    sort === "descending"
      ? -1
      : 1;

  return [...matches].sort(
    (firstMatch, secondMatch) =>
      (
        firstMatch.start.getTime() -
        secondMatch.start.getTime()
      ) * direction
  );
}

/**
 * Fetches, maps, filters and sorts matches from the configured API.
 */
export async function fetchMatches(
  config: ExtensionConfig,
  options: FetchMatchesOptions = {}
): Promise<Match[]> {
  /*
   * A base URL is only optional when endpoint itself is
   * a complete URL.
   */
  if (
    !config.baseUrl &&
    !/^https?:\/\//i.test(config.endpoint)
  ) {
    throw new Error(
      "Configure the API base URL in Settings first."
    );
  }

  const endpoint =
    options.query
      ? buildMatchEndpoint(
        config.endpoint,
        options.query,
        options.page
      )
      : config.endpoint;

  const url = buildApiUrl(
    config.baseUrl,
    endpoint
  );

  const headers =
    parseHeaders(config.headers);

  const response = await fetch(url, {
    method: "GET",
    headers
  });

  if (!response.ok) {
    throw new Error(
      `API request failed ` +
      `(${response.status} ${response.statusText}).`
    );
  }

  const payload: unknown =
    await response.json();

  validateEnvelope(payload);

  const matches =
    mapPayloadMatches(
      payload,
      config,
      options.status ?? "upcoming"
    );

  /*
   * Only keep matches that have not started yet.
   *
   * A small 60-second tolerance avoids dropping a match due
   * to minor timing differences while the API is fetched.
   */
  const now =
    Date.now() - 60_000;

  const filtered =
    options.includePast
      ? matches
      : matches.filter(
        match =>
          match.start.getTime() >= now
      );

  return sortMatches(
    filtered,
    options.sort ?? "ascending"
  );
}
