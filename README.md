# Valorant Match Calendar, TypeScript edition

A Manifest V3 Chrome extension written in TypeScript. It reads upcoming professional Valorant matches from a configurable JSON API and opens a pre-filled Google Calendar event for each match.

## Develop and build

```bash
npm install
npm run typecheck
npm run build
```

TypeScript source is under `src/`. Compiled browser bundles are placed in `dist/`. Chrome loads the compiled JavaScript because browsers do not execute TypeScript source directly.

## Install locally

1. Run the build commands above, or use the already included `dist/` output.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose this project folder.
5. Open **Settings**, configure the API and save it.

## API support

- Base URL plus endpoint, or a full endpoint URL
- Optional request headers represented as JSON
- Configurable dot paths for the matches array and match fields
- ISO-8601, Unix-second and Unix-millisecond timestamps
- API end time or configurable default duration

Selecting **+ Add** opens a Google Calendar template in a new tab. No OAuth client is needed for this flow.
