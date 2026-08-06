const statusElement = document.querySelector("#status");
const matchesElement = document.querySelector("#matches");
const refreshButton = document.querySelector("#refreshButton");
const settingsButton = document.querySelector("#settingsButton");

settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
refreshButton.addEventListener("click", renderMatches);

function formatMatchDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short"
  }).format(date);
}

function matchCard(match, config) {
  const article = document.createElement("article");
  article.className = "match-card";

  const content = document.createElement("div");
  content.className = "match-content";

  const event = document.createElement("p");
  event.className = "event-name";
  event.textContent = match.event;

  const title = document.createElement("h2");
  title.textContent = `${match.team1} vs ${match.team2}`;

  const time = document.createElement("time");
  time.dateTime = match.start.toISOString();
  time.textContent = formatMatchDate(match.start);

  const addButton = document.createElement("button");
  addButton.className = "add-button";
  addButton.type = "button";
  addButton.textContent = "+ Add";
  addButton.title = "Add to Google Calendar";
  addButton.addEventListener("click", () => {
    chrome.tabs.create({ url: createCalendarUrl(match, Number(config.durationMinutes) || 120) });
  });

  content.append(event, title, time);
  article.append(content, addButton);
  return article;
}

async function renderMatches() {
  statusElement.className = "status";
  statusElement.textContent = "Loading matches…";
  matchesElement.replaceChildren();
  refreshButton.disabled = true;
  try {
    const config = await loadConfig();
    const matches = await fetchMatches(config);
    if (!matches.length) {
      statusElement.textContent = "No upcoming matches were returned by the API.";
      return;
    }
    statusElement.textContent = `${matches.length} upcoming match${matches.length === 1 ? "" : "es"}`;
    matches.forEach(match => matchesElement.append(matchCard(match, config)));
  } catch (error) {
    statusElement.className = "status error";
    statusElement.textContent = error.message;
  } finally {
    refreshButton.disabled = false;
  }
}

renderMatches();
