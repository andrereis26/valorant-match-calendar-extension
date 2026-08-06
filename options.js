const fields = Object.keys(DEFAULT_CONFIG);
const form = document.querySelector("#settingsForm");
const saveStatus = document.querySelector("#saveStatus");
const testButton = document.querySelector("#testButton");

async function populate() {
  const config = await loadConfig();
  fields.forEach(key => {
    const element = document.querySelector(`#${key}`);
    if (element) element.value = config[key];
  });
}

function readForm() {
  return Object.fromEntries(fields.map(key => {
    const element = document.querySelector(`#${key}`);
    return [key, key === "durationMinutes" ? Number(element.value) : element.value.trim()];
  }));
}

async function ensureApiPermission(config) {
  const apiUrl = buildApiUrl(config.baseUrl, config.endpoint);
  const origins = [originPermissionPattern(apiUrl)];
  const granted = await chrome.permissions.request({ origins });
  if (!granted) throw new Error("API host access was not granted.");
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  saveStatus.className = "status";
  try {
    const config = readForm();
    JSON.parse(config.headers || "{}");
    await ensureApiPermission(config);
    await chrome.storage.sync.set(config);
    saveStatus.textContent = "Settings saved.";
  } catch (error) {
    saveStatus.className = "status error";
    saveStatus.textContent = error.message;
  }
});

testButton.addEventListener("click", async () => {
  saveStatus.className = "status";
  saveStatus.textContent = "Testing…";
  try {
    const config = readForm();
    await ensureApiPermission(config);
    const matches = await fetchMatches(config);
    saveStatus.textContent = `Connection successful. ${matches.length} upcoming match${matches.length === 1 ? "" : "es"} found.`;
  } catch (error) {
    saveStatus.className = "status error";
    saveStatus.textContent = error.message;
  }
});

populate();
