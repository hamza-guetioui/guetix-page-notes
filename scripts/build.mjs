// Builds the Guetix Page Notes browser extension:
//   1. draws the toolbar icons (PNG, no image tools needed)
//   2. packs extension/ into dist/guetix-page-notes.zip
// Usage: npm run build   (or: node scripts/build.mjs)
// Zero dependencies — only node:fs, node:path and node:zlib.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "extension");
const OUT_DIR = path.join(ROOT, "dist");
const OUT = path.join(OUT_DIR, "guetix-page-notes.zip");

// ---------- CRC32 (PNG + ZIP) ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// ---------- icon ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ORANGE = hex("#ff5b14");
const FOLD = hex("#b9400c");
const INK = hex("#141414");
const TAPE = [255, 206, 178]; // white tape at 60% over orange

/** Colour of one sample point in the unit square (null = transparent).
 *  The Guetix mark — orange square with two dark eyes — drawn as a sticky note:
 *  tape on top, folded bottom-right corner. Same shapes as the CSS `.mark`. */
function sample(u, v) {
  const m = 0.06; // margin
  const x = (u - m) / (1 - 2 * m);
  const y = (v - m) / (1 - 2 * m);
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  const r = 0.2;
  const outside = (cx, cy) => Math.hypot(x - cx, y - cy) > r;
  if (x < r && y < r && outside(r, r)) return null;
  if (x > 1 - r && y < r && outside(1 - r, r)) return null;
  if (x < r && y > 1 - r && outside(r, 1 - r)) return null;
  const d = x + y - 1.7; // fold line from (1, .7) to (.7, 1)
  if (d > 0) return null;
  if (x > 0.7 && y > 0.7) return FOLD; // the folded-over flap
  if (y < 0.13 && Math.abs(x - 0.5) < 0.22) return TAPE;
  const eye = (ex) => x > ex && x < ex + 0.19 && y > 0.34 && y < 0.53;
  if (eye(0.21) || eye(0.6)) return INK;
  return ORANGE;
}

function png(size) {
  const ss = 4; // supersampling for smooth edges
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let rr = 0, gg = 0, bb = 0, aa = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
          if (!c) continue;
          rr += c[0]; gg += c[1]; bb += c[2]; aa++;
        }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      if (aa) {
        raw[o] = Math.round(rr / aa);
        raw[o + 1] = Math.round(gg / aa);
        raw[o + 2] = Math.round(bb / aa);
      }
      raw[o + 3] = Math.round((aa / (ss * ss)) * 255);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(path.join(SRC, "icons"), { recursive: true });
for (const s of [16, 32, 48, 128]) fs.writeFileSync(path.join(SRC, "icons", `${s}.png`), png(s));

// ---------- zip ----------
function walk(dir, base = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.name.startsWith(".")) return [];
    return e.isDirectory() ? walk(path.join(dir, e.name), rel) : [rel];
  });
}

// fixed timestamp → byte-identical zips when nothing changed
const DOS_TIME = 0;
const DOS_DATE = ((2025 - 1980) << 9) | (1 << 5) | 1;

const files = walk(SRC).sort();
const locals = [];
const centrals = [];
let offset = 0;
for (const rel of files) {
  const data = fs.readFileSync(path.join(SRC, rel));
  const comp = zlib.deflateRawSync(data, { level: 9 });
  const name = Buffer.from(rel, "utf8");
  const crc = crc32(data);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0x0800, 6); // UTF-8 names
  lh.writeUInt16LE(8, 8); // deflate
  lh.writeUInt16LE(DOS_TIME, 10);
  lh.writeUInt16LE(DOS_DATE, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(name.length, 26);
  lh.writeUInt16LE(0, 28);
  locals.push(lh, name, comp);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(8, 10);
  ch.writeUInt16LE(DOS_TIME, 12);
  ch.writeUInt16LE(DOS_DATE, 14);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(comp.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(name.length, 28);
  ch.writeUInt32LE(offset, 42);
  centrals.push(ch, name);
  offset += lh.length + name.length + comp.length;
}
const cd = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12);
end.writeUInt32LE(offset, 16);

fs.mkdirSync(OUT_DIR, { recursive: true });
const zip = Buffer.concat([...locals, cd, end]);
fs.writeFileSync(OUT, zip);
const version = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8")).version;
console.log(`Page Notes v${version}: ${files.length} files → ${path.relative(ROOT, OUT)} (${(zip.length / 1024).toFixed(1)} KB)`);
