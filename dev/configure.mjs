// Applies app.config.json to the project. Run it after editing that file or the icon:
// node dev/configure.mjs
//
// Writes manifest.webmanifest (the whole file) and the marked config blocks in
// index.html, css/tokens.css and sw.js, then renders the icons (dev/make-icons.mjs).
// Safe to run any number of times.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const write = (file, text) => { fs.writeFileSync(path.join(ROOT, file), text); console.log(`wrote ${file}`); };

const config = JSON.parse(read("app.config.json"));
for (const key of ["name", "shortName", "accent", "pageLight", "pageDark", "icon"]) {
  if (typeof config[key] !== "string" || !config[key]) throw new Error(`app.config.json needs "${key}"`);
}
for (const key of ["accent", "pageLight", "pageDark"]) {
  if (!/^#[0-9a-f]{6}$/i.test(config[key])) throw new Error(`"${key}" must be a #rrggbb color, got ${config[key]}`);
}
if (!fs.existsSync(path.join(ROOT, config.icon))) throw new Error(`icon not found: ${config.icon}`);

const attr = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const slug = config.shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";

// Replaces everything between a file's start and end markers.
function fillBlock(file, start, end, body) {
  const text = read(file);
  const from = text.indexOf(start), to = text.indexOf(end);
  if (from < 0 || to < from) throw new Error(`${file} is missing its ${start} … ${end} markers`);
  write(file, text.slice(0, from + start.length) + "\n" + body + "\n" + text.slice(to));
}

write("manifest.webmanifest", JSON.stringify({
  name: config.name,
  short_name: config.shortName,
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: config.pageLight,
  theme_color: config.pageLight,
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
}, null, 2) + "\n");

fillBlock("index.html", "<!-- config -->", "<!-- /config -->", [
  `<title>${attr(config.name)}</title>`,
  `<meta name="apple-mobile-web-app-title" content="${attr(config.shortName)}">`,
  `<meta name="theme-color" content="${config.pageLight}" media="(prefers-color-scheme: light)">`,
  `<meta name="theme-color" content="${config.pageDark}" media="(prefers-color-scheme: dark)">`,
].join("\n"));

fillBlock("css/tokens.css", "/* config */", "/* /config */", [
  ":root {",
  `  --config-accent: ${config.accent};`,
  `  --config-page-light: ${config.pageLight};`,
  `  --config-page-dark: ${config.pageDark};`,
  "}",
].join("\n"));

// Named per app, so two apps hosted on one domain don’t share an offline cache.
fillBlock("sw.js", "// config", "// /config", `const CACHE = "${slug}-shell";`);

const icons = spawnSync(process.execPath, [path.join(ROOT, "dev/make-icons.mjs")], { stdio: "inherit" });
if (icons.status !== 0) process.exit(icons.status ?? 1);

// Checked last, once the icons exist: the service worker fails to install if any SHELL file is missing.
const shell = read("sw.js").match(/const SHELL = (\[[\s\S]*?\]);/);
for (const file of shell ? JSON.parse(shell[1]) : []) {
  if (!fs.existsSync(path.join(ROOT, file === "./" ? "index.html" : file))) {
    console.warn(`warning: sw.js SHELL lists ${file}, which doesn’t exist; offline install will fail`);
  }
}
