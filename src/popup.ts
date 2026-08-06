import { createCalendarUrl, fetchMatches, loadConfig } from "./common";
import type { ExtensionConfig, Match } from "./types";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

const statusElement = requiredElement<HTMLElement>("#status");
const matchesElement = requiredElement<HTMLElement>("#matches");
const refreshButton = requiredElement<HTMLButtonElement>("#refreshButton");
const settingsButton = requiredElement<HTMLButtonElement>("#settingsButton");

settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
refreshButton.addEventListener("click", () => void renderMatches());

function formatMatchDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

function flagCodeToEmoji(flag: string): string {
  const code = flag.replace(/^flag_/, "").toUpperCase();
  if (code === "UN") return "🌐";
  if (!/^[A-Z]{2}$/.test(code)) return "";

  return [...code]
    .map(character => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join("");
}

function matchCard(match: Match, config: ExtensionConfig): HTMLElement {
  const article = document.createElement("article");
  article.className = "match-card";

  const content = document.createElement("div");
  content.className = "match-content";

  const event = document.createElement("p");
  event.className = "event-name";
  event.textContent = match.event;

  const title = document.createElement("h2");
  const team1Flag = flagCodeToEmoji(match.flag1);
  const team2Flag = flagCodeToEmoji(match.flag2);
  title.textContent = `${team1Flag ? `${team1Flag} ` : ""}${match.team1} vs ${team2Flag ? `${team2Flag} ` : ""}${match.team2}`;

  const series = document.createElement("p");
  series.className = "series-name";
  series.textContent = match.series;
  series.hidden = !match.series;

  const time = document.createElement("time");
  time.dateTime = match.start.toISOString();
  time.textContent = formatMatchDate(match.start);

  const addButton = document.createElement("button");
  addButton.className = "add-button";
  addButton.type = "button";
  addButton.textContent = "+ Add";
  addButton.title = "Add to Google Calendar";
  addButton.addEventListener("click", () => {
    void chrome.tabs.create({
      url: createCalendarUrl(match, config.durationMinutes || 120)
    });
  });

  content.append(event, title, series, time);
  article.append(content, addButton);
  return article;
}

async function renderMatches(): Promise<void> {
  statusElement.className = "status";
  statusElement.textContent = "Loading matches…";
  matchesElement.replaceChildren();
  refreshButton.disabled = true;

  try {
    const config = await loadConfig();
    const matches = await fetchMatches(config);

    statusElement.textContent = matches.length
      ? `${matches.length} upcoming match${matches.length === 1 ? "" : "es"}`
      : "No upcoming matches were returned by the API.";

    matches.forEach(match => matchesElement.append(matchCard(match, config)));
  } catch (error: unknown) {
    statusElement.className = "status error";
    statusElement.textContent = error instanceof Error ? error.message : "Unexpected error.";
  } finally {
    refreshButton.disabled = false;
  }
}

void renderMatches();
