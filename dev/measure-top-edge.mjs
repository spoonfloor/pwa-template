// Measures a screenshot of dev/top-edge.html: does iOS blur or tint anything near the top?
// Usage: node dev/measure-top-edge.mjs screenshot.png [--width 402]
//   --width is the device’s width in points (402 on iPhone 17 Pro), used to get the pixel scale.
//
// Blur: each probe near the top is compared pixel by pixel with the same probe mid-screen
// (same column, so the same pixel grid). Identical means nothing was drawn over it.
// Overlay: spots in the top band are compared with the swatch mid-screen, which has the
// top bar’s color. (Only meaningful with a bar; with bar=none the band shows the stripes.)
// Scores are the mean difference per color channel, 0–255. Under 2 counts as identical.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, "dev/top-edge-probes.json"), "utf8"));
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--") && !/^\d+$/.test(a));
const widthPt = Number(args[args.indexOf("--width") + 1]) || 402;
if (!file) { console.error("usage: node dev/measure-top-edge.mjs screenshot.png [--width 402]"); process.exit(1); }
const SAME = 2;

const img = decodePng(fs.readFileSync(file));
const scale = img.width / widthPt;
if (!Number.isInteger(scale)) throw new Error(`${img.width}px wide / ${widthPt}pt is not a whole scale; check --width`);
const px = (x, y) => { const i = (y * img.width + x) * img.bpp; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };

// Where the page starts on screen: 0 in a Home Screen app (it draws under the status bar),
// lower in a Safari tab. Found from the mid-screen reference probe, the only pure black
// there; its second CSS pixel column starts black in the top row. The search starts halfway
// between the lowest top probe and the reference, so it skips the top probes for any page
// offset up to that gap (about 120pt; a Safari tab is about 65pt).
const probeX = (layout.columns[0] + 1) * scale + 1;
const lowestTopProbeEnd = Math.max(...layout.rows) + layout.probeSize;
const searchFrom = Math.round((lowestTopProbeEnd + layout.referenceRow) / 2);
let refTop = -1;
for (let y = searchFrom * scale; y < img.height && refTop < 0; y++) {
  if (px(probeX, y).every(v => v < 6)) refTop = y;
}
if (refTop < 0) throw new Error("couldn’t find the reference probe; is this a screenshot of dev/top-edge.html?");
const offset = refTop / scale - layout.referenceRow;
if (!Number.isInteger(offset)) throw new Error(`reference probe is at a fractional offset (${offset}pt)`);

// Mean per-channel difference between two same-size squares (in screen points).
function diff([ax, ay], [bx, by], sizePt) {
  for (const v of [ax, ay, bx, by]) if (v < 0 || (v + sizePt) * scale > Math.max(img.width, img.height)) {
    throw new Error(`square at ${v}pt is off the screenshot`);
  }
  const n = sizePt * scale;
  let total = 0;
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
    const a = px(ax * scale + dx, ay * scale + dy), b = px(bx * scale + dx, by * scale + dy);
    total += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  }
  return total / (n * n * 3);
}
const verdict = d => (d < SAME ? "same" : "DIFFERENT");

console.log(`${path.basename(file)}: ${img.width}×${img.height}px, ${scale}× scale, ` +
  `page starts ${offset}pt from the screen top\n`);
console.log("Probes vs the mid-screen reference (blur or tint over controls); y is from the screen top:");
let probeFails = 0;
for (const row of layout.rows) {
  const y = row + offset;
  const cells = layout.columns.map(x => {
    const d = diff([x, y], [x, layout.referenceRow + offset], layout.probeSize);
    if (!(d < SAME)) probeFails++;
    return `x=${x}: ${d.toFixed(1).padStart(5)} ${verdict(d)}`;
  });
  console.log(`  y=${String(y).padStart(3)}pt  ${cells.join("   ")}`);
}

// Band spots and the swatch are compared as 4pt squares centered on each point.
// The swatch is 2 probes wide, so its center is one probe size in from its corner.
// Band spots are screen positions; the swatch moves with the page.
const swatchCenter = [layout.swatch[0] + layout.probeSize, layout.swatch[1] + layout.probeSize + offset];
const square = ([x, y]) => [x - 2, y - 2];
console.log("\nTop band vs the bar-color swatch (color overlay):");
let bandFails = 0;
for (const [x, y] of layout.barSamples) {
  const d = diff(square([x, y]), square(swatchCenter), 4);
  if (!(d < SAME)) bandFails++;
  const [r, g, b] = px(x * scale, y * scale);
  console.log(`  (${x}, ${y})pt  ${d.toFixed(1).padStart(5)} ${verdict(d)}   rgb(${r}, ${g}, ${b})`);
}
const [sr, sg, sb] = px(swatchCenter[0] * scale, swatchCenter[1] * scale);
console.log(`  swatch rgb(${sr}, ${sg}, ${sb})`);

console.log(`\n${probeFails ? `${probeFails} probe(s) differ` : "All probes identical"}; ` +
  `${bandFails ? `${bandFails} band spot(s) differ` : "top band matches the bar color"}.`);

// Minimal PNG decoder: 8-bit RGB or RGBA, not interlaced (what simulator screenshots are).
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8, width, height, depth, type, interlace;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), name = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") [width, height, depth, type, interlace] =
      [data.readUInt32BE(0), data.readUInt32BE(4), data[8], data[9], data[12]];
    else if (name === "IDAT") idat.push(data);
    else if (name === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (type !== 2 && type !== 6)) {
    throw new Error(`unsupported PNG (bit depth ${depth}, color type ${type}, interlace ${interlace})`);
  }
  const bpp = type === 6 ? 4 : 3, stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = (v + pred) & 0xff;
    }
  }
  return { width, height, bpp, data: out };
}
