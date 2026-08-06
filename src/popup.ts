import { createCalendarUrl, fetchMatches, loadConfig } from "./common";
import type {
  ExtensionConfig,
  Match,
  MatchFilter,
  MatchView
} from "./types";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

const statusElement = requiredElement<HTMLElement>("#status");
const matchesElement = requiredElement<HTMLElement>("#matches");
const refreshButton = requiredElement<HTMLButtonElement>("#refreshButton");
const settingsButton = requiredElement<HTMLButtonElement>("#settingsButton");
const scheduleViewButton = requiredElement<HTMLButtonElement>("#scheduleViewButton");
const resultsViewButton = requiredElement<HTMLButtonElement>("#resultsViewButton");
const vctFilterButton = requiredElement<HTMLButtonElement>("#vctFilterButton");
const allFilterButton = requiredElement<HTMLButtonElement>("#allFilterButton");
const pageButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-page]")
);

const viewButtons: Record<MatchView, HTMLButtonElement> = {
  schedule: scheduleViewButton,
  results: resultsViewButton
};

const filterButtons: Record<MatchFilter, HTMLButtonElement> = {
  vct: vctFilterButton,
  all: allFilterButton
};

let selectedView: MatchView = "schedule";
let selectedFilter: MatchFilter | null = null;
let selectedPage = 1;
let latestRenderId = 0;

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
  void renderMatches();
});

allFilterButton.addEventListener("click", () => {
  selectedFilter = "all";
  void renderMatches();
});

pageButtons.forEach(button => {
  button.addEventListener("click", () => {
    const page = Number(button.dataset.page);
    if (!Number.isInteger(page)) return;

    selectedPage = page;
    void renderMatches();
  });
});

function activeFilter(): MatchFilter {
  return selectedFilter ?? "vct";
}

function normalizeFilter(filter: string): MatchFilter {
  return filter === "all" ? "all" : "vct";
}

function updateControls(): void {
  (Object.keys(viewButtons) as MatchView[]).forEach(view => {
    const active = selectedView === view;
    viewButtons[view].classList.toggle("active", active);
    viewButtons[view].setAttribute("aria-pressed", String(active));
  });

  const filter = activeFilter();
  (Object.keys(filterButtons) as MatchFilter[]).forEach(matchFilter => {
    const active = filter === matchFilter;
    filterButtons[matchFilter].classList.toggle("active", active);
    filterButtons[matchFilter].setAttribute("aria-pressed", String(active));
  });

  pageButtons.forEach(button => {
    const active = Number(button.dataset.page) === selectedPage;
    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

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
  const code = flag.replace(/^(flag_|mod-)/, "").toUpperCase();
  if (code === "UN") return "🌐";
  if (!/^[A-Z]{2}$/.test(code)) return "";

  return [...code]
    .map(character => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join("");
}

function hasScore(match: Match): boolean {
  return match.score1 !== "" || match.score2 !== "";
}

function formatScore(match: Match): string {
  if (!hasScore(match)) return "";

  return `${match.score1 || "0"} - ${match.score2 || "0"}`;
}

function liveDetails(match: Match): string {
  const details = [
    match.mapNumber && match.mapNumber !== "Unknown"
      ? `Map ${match.mapNumber}`
      : "",
    match.currentMap && match.currentMap !== "Unknown"
      ? match.currentMap
      : ""
  ].filter(Boolean);

  return details.join(" | ");
}

function matchTimeLabel(match: Match): string {
  if (match.status === "live") {
    return "Live now";
  }

  if (
    match.status === "result" &&
    match.timeLabel
  ) {
    return `Completed ${match.timeLabel}`;
  }

  if (match.hasStartTime) {
    return formatMatchDate(match.start);
  }

  return match.timeLabel || "";
}

function openMatchPage(match: Match): void {
  if (!match.url) return;

  void chrome.tabs.create({
    url: match.url
  });
}

function matchCard(match: Match, config: ExtensionConfig): HTMLElement {
  const article = document.createElement("article");
  article.className = `match-card match-card--${match.status}`;

  if (match.url) {
    article.classList.add("has-match-link");
    article.tabIndex = 0;
    article.setAttribute("role", "link");
    article.title = "click to see match in VLR.gg";
    article.addEventListener("click", event => {
      const target = event.target;

      if (target instanceof Element && target.closest("button")) {
        return;
      }

      openMatchPage(match);
    });
    article.addEventListener("keydown", event => {
      const target = event.target;

      if (target instanceof Element && target.closest("button")) {
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
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
    const score = document.createElement("span");
    score.className = "match-score";
    score.textContent = scoreText;
    teams.append(score);
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

  if (
    match.status !== "result" &&
    match.hasStartTime
  ) {
    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.type = "button";
    addButton.textContent = "+ Add";
    addButton.title = "Add to Google Calendar";
    addButton.addEventListener("click", event => {
      event.stopPropagation();

      void chrome.tabs.create({
        url: createCalendarUrl(match, config.durationMinutes || 120)
      });
    });

    article.append(addButton);
  }

  return article;
}

function uniqueMatches(matches: Match[]): Match[] {
  const seen = new Set<string>();

  return matches.filter(match => {
    const key = match.url || `${match.status}:${String(match.id)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function fetchMatchesForView(config: ExtensionConfig): Promise<Match[]> {
  if (selectedView === "results") {
    return fetchMatches(config, {
      query: "results",
      page: selectedPage,
      status: "result",
      includePast: true,
      sort: "api"
    });
  }

  const [liveMatches, upcomingMatches] = await Promise.all([
    fetchMatches(config, {
      query: "live_score",
      status: "live",
      includePast: true,
      sort: "api"
    }),
    fetchMatches(config, {
      query: "upcoming_extended",
      page: selectedPage,
      status: "upcoming"
    })
  ]);

  return uniqueMatches([
    ...liveMatches,
    ...upcomingMatches
  ]);
}

function filterMatches(matches: Match[]): Match[] {
  if (activeFilter() === "all") {
    return matches;
  }

  return matches.filter(match => /\bvct\b/i.test(match.event));
}

function statusText(count: number): string {
  const noun =
    selectedView === "results"
      ? "result"
      : "match";

  if (count === 0) {
    return `No ${activeFilter() === "vct" ? "VCT " : ""}${noun}s found.`;
  }

  return `${count} ${noun}${count === 1 ? "" : "es"} found`;
}

function renderEmptyState(): void {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = "Try another page or switch the filter.";
  matchesElement.append(empty);
}

async function renderMatches(): Promise<void> {
  const renderId = ++latestRenderId;

  statusElement.className = "status";
  statusElement.textContent = "Loading matches...";
  matchesElement.replaceChildren();
  refreshButton.disabled = true;
  updateControls();

  try {
    const config = await loadConfig();
    selectedFilter ??= normalizeFilter(config.defaultMatchFilter);
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

    matches.forEach(match => matchesElement.append(matchCard(match, config)));
  } catch (error: unknown) {
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
