// Shared by dev/top-edge.html and dev/top-edge-default.html: draws the probes, applies the
// variant from the URL, and shows what’s being tested.
const params = new URLSearchParams(location.search);
const bar = params.get("bar") ?? "strip";     // none | strip (the template’s #top-bar as is) | tall (safe area + 56px)
const color = params.get("color") ?? "page";  // page | accent (a colored header)
const scroll = params.get("scroll") ?? "top"; // top | under (stripes scrolled under the band)
Object.assign(document.documentElement.dataset, { bar, color });

const layout = await (await fetch("top-edge-probes.json", { cache: "no-store" })).json();
const add = (cls, x, y, w, h) => {
  const el = document.createElement("div");
  el.className = cls;
  Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  document.body.append(el);
};
const s = layout.probeSize;
for (const x of layout.columns) for (const y of [...layout.rows, layout.referenceRow]) add("probe", x, y, s, s);
add("swatch", layout.swatch[0], layout.swatch[1], s * 2, s * 2);

// In a Home Screen app iOS fills in the safe area after the first layout, so read it again later.
const statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content ?? "none";
const safari = navigator.userAgent.match(/Version\/([\d.]+)/)?.[1];
const showInfo = () => {
  const inset = document.getElementById("inset").offsetHeight;
  document.getElementById("info").textContent =
    `status bar ${statusBar} · bar=${bar} · color=${color} · scroll=${scroll} · ` +
    `${navigator.standalone ? "Home Screen app" : "Safari tab"} · inset-top ${inset}px · ` +
    `${safari ? `Safari ${safari}` : "Safari version not in app-mode UA"}`;
};
showInfo();
addEventListener("resize", showInfo);
setTimeout(showInfo, 500);

const grid = document.getElementById("variants");
for (const b of ["none", "strip", "tall"]) for (const c of ["page", "accent"]) for (const sc of ["top", "under"]) {
  const a = document.createElement("a");
  a.href = `?bar=${b}&color=${c}&scroll=${sc}`;
  a.textContent = `${b} ${c === "accent" ? "acc" : "pg"} ${sc === "under" ? "↓" : "–"}`;
  if (b === bar && c === color && sc === scroll) a.setAttribute("aria-current", "page");
  grid.append(a);
}

if (scroll === "under") requestAnimationFrame(() => scrollTo(0, 300));
