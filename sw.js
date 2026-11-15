// Offline support, network first: online, every request gets the latest file (so there are
// no stale versions to bust, and live reload keeps working); offline, it gets the last copy.
// SHELL is cached on install so the app opens offline even before you’ve used every file.
// Add new files to it; dev/configure.mjs warns about entries that don’t exist.

// Between these markers is written by dev/configure.mjs from app.config.json. Edit there.
// config
const CACHE = "hello-shell";
// /config

const SHELL = [
  "./",
  "index.html",
  "css/tokens.css",
  "css/app.css",
  "js/app.js",
  "manifest.webmanifest",
  "fonts/InterVariable.woff2",
  "icons/favicon.svg",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  // Leave other sites, non-GET requests and the dev server’s /__livereload alone.
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/__")) return;

  // cache: "no-cache" makes the browser check with the server instead of reusing its own
  // HTTP cache (GitHub Pages allows 10 minutes). Without it, right after a deploy, an old
  // index.html could load alongside a new app.js. A fresh Request because a navigation
  // request can’t be copied with new options.
  event.respondWith(
    fetch(new Request(request.url, { cache: "no-cache" }))
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () =>
        (await caches.match(request, { ignoreSearch: true })) ??
        (request.mode === "navigate" ? caches.match("./") : Response.error()))
  );
});
