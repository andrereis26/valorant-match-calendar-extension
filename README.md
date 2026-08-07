# Valorant Match Calendar, TypeScript edition

Tired of having to perform multiple clicks and types to check the next Valorant games? This chrome extension, with the integration of an API like the [vlrggapi](https://github.com/axsddlr/vlrggapi) you can have all the upcoming/live and previous results at one click away!

Tired of forgetting your favourite matches, add them to your Google Calendar or enable the notifications setting so you never miss a match!

## Develop and build

```bash
npm install
npm run typecheck
npm run build
```

TypeScript source is under `src/`. Compiled browser bundles are placed in `dist/`. 

## Install locally

1. Run the build commands above, or use the already included `dist/` output.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose this project folder.
5. Open **Settings**, configure the API and save it.

## API support

- Configure the API endpoints and fields to match your API response structure
- Optional request headers represented as JSON
- Configurable dot paths for the matches array and match fields
- ISO-8601, Unix-second and Unix-millisecond timestamps

## Preview

<p align="center">
  <img src="./imgs/image1.png" width="400" alt="screenshot1">
  <img src="./imgs/image2.png" width="400" alt="screenshot2">
</p>

<p align="center">
  <img src="./imgs/image3.png" width="400" alt="screenshot1">
  <img src="./imgs/image4.png" width="400" alt="screenshot2">
</p>