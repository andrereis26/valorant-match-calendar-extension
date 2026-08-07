import { fetchMatches, loadConfig } from "./common";
import type { Match } from "./types";

const LIVE_ALARM_NAME = "valorant-live-match-check";
const CHECK_PERIOD_MINUTES = 5;
const NOTIFIED_IDS_KEY = "notifiedLiveMatchIds";
const NOTIFICATION_URLS_KEY = "liveNotificationUrls";

function notificationId(match: Match): string {
  return `live-${String(match.id).replace(/[^a-z0-9_-]/gi, "_")}`;
}

function matchKey(match: Match): string {
  return match.url || String(match.id);
}

async function notifiedIds(): Promise<Set<string>> {
  const stored = await chrome.storage.local.get(NOTIFIED_IDS_KEY);
  const value = stored[NOTIFIED_IDS_KEY];

  return new Set(
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []
  );
}

async function saveNotifiedIds(ids: Set<string>): Promise<void> {
  await chrome.storage.local.set({
    [NOTIFIED_IDS_KEY]: Array.from(ids).slice(-200)
  });
}

async function saveNotificationUrl(
  id: string,
  url: string
): Promise<void> {
  if (!url) return;

  const stored = await chrome.storage.local.get(NOTIFICATION_URLS_KEY);
  const urls =
    stored[NOTIFICATION_URLS_KEY] &&
      typeof stored[NOTIFICATION_URLS_KEY] === "object" &&
      !Array.isArray(stored[NOTIFICATION_URLS_KEY])
      ? stored[NOTIFICATION_URLS_KEY] as Record<string, string>
      : {};

  urls[id] = url;
  await chrome.storage.local.set({
    [NOTIFICATION_URLS_KEY]: urls
  });
}

async function notifyLiveMatch(match: Match): Promise<void> {
  const id = notificationId(match);
  const score =
    match.score1 || match.score2
      ? ` (${match.score1 || "0"}-${match.score2 || "0"})`
      : "";

  await chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Valorant match is live",
    message: `${match.team1} vs ${match.team2}${score}`,
    contextMessage: match.event || undefined,
    priority: 1
  });

  await saveNotificationUrl(id, match.url);
}

async function checkLiveMatches(): Promise<void> {
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
  const notified = await notifiedIds();
  let changed = false;

  for (const match of liveMatches) {
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

async function syncLiveAlarm(): Promise<void> {
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

function runLiveCheck(): void {
  void checkLiveMatches().catch(error => {
    console.warn("Live match notification check failed.", error);
  });
}

function runAlarmSync(): void {
  void syncLiveAlarm().catch(error => {
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
  if (areaName !== "sync") return;

  if (
    "liveNotificationsEnabled" in changes ||
    "endpoints" in changes ||
    "baseUrl" in changes ||
    "headers" in changes
  ) {
    runAlarmSync();
  }
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === LIVE_ALARM_NAME) {
    runLiveCheck();
  }
});

chrome.notifications.onClicked.addListener(notificationId => {
  void (async () => {
    const stored = await chrome.storage.local.get(NOTIFICATION_URLS_KEY);
    const urls =
      stored[NOTIFICATION_URLS_KEY] &&
        typeof stored[NOTIFICATION_URLS_KEY] === "object" &&
        !Array.isArray(stored[NOTIFICATION_URLS_KEY])
        ? stored[NOTIFICATION_URLS_KEY] as Record<string, string>
        : {};
    const url = urls[notificationId];

    if (url) {
      await chrome.tabs.create({ url });
    }
  })();
});
