const DEFAULT_CONFIG = {
  baseUrl: "",
  endpoint: "/matches/upcoming",
  headers: "{}",
  matchesPath: "data.matches",
  idPath: "id",
  startPath: "start_time",
  endPath: "end_time",
  eventPath: "event.name",
  team1Path: "teams.0.name",
  team2Path: "teams.1.name",
  matchUrlPath: "url",
  durationMinutes: 120
};

function getByPath(value, path) {
  if (!path) return value;
  return path.split(".").reduce((current, key) => current == null ? undefined : current[key], value);
}

function buildApiUrl(baseUrl, endpoint) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const route = endpoint.trim();
  if (/^https?:\/\//i.test(route)) return route;
  return `${base}/${route.replace(/^\/+/, "")}`;
}

function originPermissionPattern(urlString) {
  const url = new URL(urlString);
  return `${url.protocol}//${url.host}/*`;
}

function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  let raw = value;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) raw = Number(raw);
  if (typeof raw === "number" && raw < 1e12) raw *= 1000;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function createCalendarUrl(match, durationMinutes) {
  const end = match.end || new Date(match.start.getTime() + durationMinutes * 60_000);
  const title = `${match.team1} vs ${match.team2}`;
  const details = [match.event ? `Event: ${match.event}` : "", match.url ? `Match page: ${match.url}` : ""]
    .filter(Boolean).join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${calendarTimestamp(match.start)}/${calendarTimestamp(end)}`,
    details
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function loadConfig() {
  return { ...DEFAULT_CONFIG, ...(await chrome.storage.sync.get(DEFAULT_CONFIG)) };
}

async function fetchMatches(config) {
  if (!config.baseUrl && !/^https?:\/\//i.test(config.endpoint)) {
    throw new Error("Configure the API base URL in Settings first.");
  }
  const url = buildApiUrl(config.baseUrl, config.endpoint);
  let headers;
  try {
    headers = JSON.parse(config.headers || "{}");
  } catch {
    throw new Error("Request headers must be valid JSON.");
  }
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) throw new Error(`API request failed (${response.status} ${response.statusText}).`);
  const payload = await response.json();
  const rows = getByPath(payload, config.matchesPath);
  if (!Array.isArray(rows)) throw new Error(`The matches path “${config.matchesPath}” did not resolve to an array.`);

  return rows.map((row, index) => {
    const start = parseDate(getByPath(row, config.startPath));
    const end = parseDate(getByPath(row, config.endPath));
    return {
      id: getByPath(row, config.idPath) ?? index,
      start,
      end,
      event: getByPath(row, config.eventPath) || "Valorant pro match",
      team1: getByPath(row, config.team1Path) || "TBD",
      team2: getByPath(row, config.team2Path) || "TBD",
      url: getByPath(row, config.matchUrlPath) || ""
    };
  }).filter(match => match.start && match.start.getTime() >= Date.now())
    .sort((a, b) => a.start - b.start);
}
