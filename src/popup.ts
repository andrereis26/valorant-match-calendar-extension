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

function isSameLocalDate(
  firstDate: Date,
  secondDate: Date
): boolean {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function roundedDisplayDate(date: Date): Date {
  const roundedDate = new Date(date);

  if (
    roundedDate.getSeconds() > 0 ||
    roundedDate.getMilliseconds() > 0
  ) {
    roundedDate.setMinutes(roundedDate.getMinutes() + 1);
  }

  roundedDate.setSeconds(0, 0);
  return roundedDate;
}

function formatClockTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatTimeUntil(date: Date): string {
  const totalMinutes = Math.max(
    0,
    Math.ceil(
      (date.getTime() - Date.now()) / 60_000
    )
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0
    ? `${hours}h${minutes}m`
    : `${minutes}m`;
}

function formatMatchDate(date: Date): string {
  const displayDate = roundedDisplayDate(date);

  if (isSameLocalDate(displayDate, new Date())) {
    return `Today, ${formatClockTime(displayDate)} - in ${formatTimeUntil(displayDate)}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(displayDate);
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

interface RoundScoreValue {
  value: string;
  side: "ct" | "t";
}

function isRoundScoreValue(value: string): boolean {
  const normalizedValue = value.trim();

  return normalizedValue !== "" && normalizedValue.toUpperCase() !== "N/A";
}

function roundScoreValue(
  ctValue: string,
  tValue: string
): RoundScoreValue | null {
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

function liveRoundScore(match: Match): [RoundScoreValue, RoundScoreValue] | null {
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

function roundScoreElement(match: Match): HTMLElement | null {
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

  if (
    match.status === "upcoming" &&
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

  const upcomingMatchesRequest =
    fetchMatches(config, {
      query: "upcoming_extended",
      page: selectedPage,
      status: "upcoming"
    });

  if (selectedPage !== 1) {
    return upcomingMatchesRequest;
  }

  const [liveMatches, upcomingMatches] = await Promise.all([
    fetchMatches(config, {
      query: "live_score",
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
