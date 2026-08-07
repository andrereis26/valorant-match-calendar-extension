import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";

/*
 * Assembles the deployable PWA site into public/, pulling together
 * files that otherwise live at the repo root alongside the Chrome
 * extension (pwa-index.html, styles.css, icons/) plus the esbuild
 * output (dist/pwa/, pwa-sw.js). Hosts like Vercel serve exactly one
 * directory, so this keeps the extension's files out of that output
 * without having to physically relocate them in the source tree.
 */

const root = process.cwd();
const publicDir = join(root, "public");

if (existsSync(publicDir)) {
  rmSync(publicDir, { recursive: true, force: true });
}
mkdirSync(publicDir);

const entries = [
  "pwa-index.html",
  "pwa-settings.html",
  "manifest.webmanifest",
  "pwa-sw.js",
  "styles.css",
  "icons",
  "dist/pwa"
];

for (const entry of entries) {
  cpSync(join(root, entry), join(publicDir, entry), { recursive: true });
}

console.log(`Assembled PWA site in ${publicDir}`);
