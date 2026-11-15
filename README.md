# PWA template

A starting point for small iPhone-first web apps. It installs to the Home Screen, works offline, and follows the system’s light or dark mode. No build step and no dependencies; you only need Node and, for the icons, Google Chrome.

## Start a new app

1. Copy the template without its git history:
   ```bash
   rsync -a --exclude .git ~/Desktop/pwa-template/ ~/Desktop/my-app && cd ~/Desktop/my-app && git init
   ```
2. Edit `app.config.json`, replace `icons/source.svg`, then apply both:
   ```bash
   node dev/configure.mjs
   ```
3. Run the dev server, which reloads on save, and open http://127.0.0.1:5180/:
   ```bash
   node dev/serve.mjs
   ```

## What’s where

| File | What it’s for |
|---|---|
| `app.config.json` | Name, Home Screen name, accent and page colors, icon. The one place to set them. |
| `index.html` | The page and the iPhone `<head>` tags |
| `css/tokens.css` | Design tokens: light by default, dark overrides |
| `css/app.css` | Layout: full-screen, safe areas, touch behavior |
| `js/app.js` | App code. Registers the service worker. |
| `sw.js` | Offline support |
| `icons/source.svg` | The icon every PNG is rendered from |
| `dev/configure.mjs` | Writes the config into the manifest, `<head>`, tokens and `sw.js`, then renders the icons |
| `dev/serve.mjs` | Dev server with live reload; changes to CSS apply without a reload |
| `dev/make-icons.mjs` | Renders the icons (`configure` runs it for you) |

Blocks marked `config` in `index.html`, `css/tokens.css` and `sw.js`, and all of `manifest.webmanifest`, are rewritten by `configure`. Edit `app.config.json` instead.

## Good to know

- **Offline.** `sw.js` goes to the network first and falls back to the last saved copy, so online you never see a stale file. Add any new file to its `SHELL` list so it’s available offline from the first visit; `configure` warns about entries that don’t exist.
- **Testing on a real iPhone.** Service workers only run over HTTPS (localhost is the exception), and the dev server only listens on this Mac. To try Home Screen install and offline on a phone, host the folder somewhere with HTTPS, such as GitHub Pages or Netlify.
- **Status bar.** The installed app draws under the status bar. `#top-bar` in `app.css` gives iOS a solid color to show there; keep it if you add your own header.
- **Text fields** need a font size of at least 16px, or iOS zooms in when they’re focused. `app.css` sets that.
- **Icons.** Keep a full-bleed `<rect id="bg">` as the first shape in `source.svg`. Only the browser-tab favicon gets rounded corners; iOS rounds Home Screen icons itself.
