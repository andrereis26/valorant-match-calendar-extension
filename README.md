# Valorant Match Calendar Chrome extension

A Manifest V3 Chrome extension that reads upcoming professional Valorant matches from a configurable JSON API and opens a pre-filled Google Calendar event for each match.

## Install locally

1. Unzip this project.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the `valorant-match-calendar` folder.
5. Open the extension's **Settings**, configure the API, and select **Save settings**.

Chrome asks for access only to the configured API origin. The extension stores configuration with `chrome.storage.sync`.

## API configuration

The extension supports:

- A base URL and an endpoint, or a full URL in the endpoint field
- Optional request headers as JSON
- Dot-path mappings for the matches array and every displayed field
- ISO-8601 timestamps, Unix timestamps in seconds, or Unix timestamps in milliseconds
- An optional API-provided end time, with a configurable default duration fallback

Example response and matching defaults are shown on the Settings page.

## Google Calendar behavior

Selecting **+ Add** creates a Google Calendar template URL using the match start and end timestamps in UTC. Google Calendar opens in a new tab so the user can review and save the event. No Google OAuth client is required.

## Files

- `manifest.json`: Manifest V3 configuration
- `popup.html`, `popup.js`: upcoming-match list
- `options.html`, `options.js`: API and mapping configuration
- `common.js`: API parsing and Calendar URL helpers
- `styles.css`: shared UI styles
