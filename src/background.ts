import {
  ACTIVE_MATCH_FILTER_KEY,
  fetchMatches,
  loadActiveMatchFilter,
  loadConfig,
  matchPassesFilter
} from "./core";
import type { Match } from "./core/types";
import { extensionStorage } from "./platform/extension/storage";

const LIVE_ALARM_NAME = "valorant-live-match-check";
const CHECK_PERIOD_MINUTES = 5;
const NOTIFIED_IDS_KEY = "notifiedLiveMatchIds";
const NOTIFICATION_URLS_KEY = "liveNotificationUrls";
const NOTIFICATION_ICON_URL = chrome.runtime.getURL("icons/icon128.png");

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

async function notifyLiveMatch(
  match: Match,
  id = notificationId(match)
): Promise<void> {
  const score =
    match.score1 || match.score2
      ? ` (${match.score1 || "0"}-${match.score2 || "0"})`
      : "";

  await chrome.notifications.create(id, {
    type: "basic",
    iconUrl: NOTIFICATION_ICON_URL,
    title: "Valorant match is live",
    message: `${match.team1} vs ${match.team2}${score}`,
    contextMessage: match.event || undefined,
    priority: 1
  });

  await saveNotificationUrl(id, match.url);
}

async function testNotification(): Promise<string> {
  const config = await loadConfig(extensionStorage);
  const filter = await loadActiveMatchFilter(extensionStorage, config);
  const liveMatches = await fetchMatches(config, {
    endpointKey: "live",
    status: "live",
    includePast: true,
    sort: "api"
  });
  const match = liveMatches.find(liveMatch =>
    matchPassesFilter(liveMatch, filter)
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
    iconUrl: NOTIFICATION_ICON_URL,
    title: "Valorant notification test",
    message: filter === "vct"
      ? "Notifications are working. No live VCT match is currently available."
      : "Notifications are working. No live match is currently available.",
    priority: 1
  });

  return "Test notification sent.";
}

async function checkLiveMatches(): Promise<void> {
  const config = await loadConfig(extensionStorage);

  if (!config.liveNotificationsEnabled) {
    return;
  }

  const liveMatches = await fetchMatches(config, {
    endpointKey: "live",
    status: "live",
    includePast: true,
    sort: "api"
  });
  const filter = await loadActiveMatchFilter(extensionStorage, config);
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

async function syncLiveAlarm(): Promise<void> {
  const config = await loadConfig(extensionStorage);

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
  if (areaName === "sync") {
    if (
      "liveNotificationsEnabled" in changes ||
      "endpoints" in changes ||
      "baseUrl" in changes ||
      "headers" in changes
    ) {
      runAlarmSync();
    }

    return;
  }

  if (
    areaName === "local" &&
    ACTIVE_MATCH_FILTER_KEY in changes
  ) {
    runLiveCheck();
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    !message ||
    typeof message !== "object" ||
    (message as { type?: unknown }).type !== "test-live-notification"
  ) {
    return false;
  }

  void testNotification()
    .then(result => {
      sendResponse({
        ok: true,
        message: result
      });
    })
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected error."
      });
    });

  return true;
});
