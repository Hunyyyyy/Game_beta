// Draw every building (one strip per kind, a picture for each level) and the dev palace as PNGs, with a grid of tiles, and write an index.
// Usage: node tools/art-sheet.mjs <out-dir> [scale=3]      (no browser: the same blueprint engine the game uses)
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const outDir = resolve(process.argv[2] ?? 'doc/art_pack'), S = Number(process.argv[3] ?? 3);
await import(pathToFileURL(join(root, 'src/blueprint/engine.js')).href);
const BP = globalThis.Blueprint;

const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]); };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const TILE = 32; // a tile of the map is 32 px wide in a picture; faint lines mark the ground tiles round the anchor
/** Render one blueprint json to { w, h, px, anchor, footprint }. */
function draw(def) {
  const res = BP.render(def, { seed: def.seed ?? 1, params: { st1: 1, st2: 1, st3: 1, st4: 1 }, fit: true });
  return { w: res.w, h: res.h, px: res.frames[0], anchor: res.anchor ?? def.anchor, footprint: res.footprint ?? def.footprint, warnings: res.warnings };
}
/** A strip of pictures side by side on a ground colour with an anchor cross and a faint grid. */
function strip(pics) {
  const cw = Math.max(...pics.map((p) => p.w)) + 8, ch = Math.max(...pics.map((p) => p.h)) + 8;
  const W = cw * S * pics.length, H = ch * S, out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { out[i * 4] = 150; out[i * 4 + 1] = 140; out[i * 4 + 2] = 100; out[i * 4 + 3] = 255; }
  const put = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; };
  pics.forEach((p, n) => {
    const ox = n * cw * S, oy = (ch - p.h - 4) * S, ax = ((p.anchor?.[0] ?? p.w / 2) + 4) * S, ay = ((p.anchor?.[1] ?? p.h) + (ch - p.h - 4)) * S;
    for (let g = -20; g <= 20; g++) { const gx = ox + ((p.anchor?.[0] ?? p.w / 2) + 4 + g * TILE) * S; for (let y = 0; y < H; y++) put(gx, y, 135, 126, 90); } // faint lines every tile, centred on the anchor
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const k = (y * p.w + x) * 4, a = p.px[k + 3]; if (!a) continue;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const X = ox + (x + 4) * S + i, Y = oy + y * S + j, o = (Y * W + X) * 4, al = a / 255;
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(p.px[k + c] * al + out[o + c] * (1 - al));
      }
    }
    for (let d = -6; d <= 6; d++) { put(ox + ax + d, ay, 255, 0, 0); put(ox + ax, ay + d, 255, 0, 0); } // anchor (the foot of the house)
    if (p.footprint) { const [fx, fy, fw, fh] = p.footprint, x0 = ox + (fx + 4) * S, y0 = oy + fy * S; for (let x = 0; x < fw * S; x++) { put(x0 + x, y0, 0, 120, 255); put(x0 + x, y0 + fh * S, 0, 120, 255); } for (let y = 0; y < fh * S; y++) { put(x0, y0 + y, 0, 120, 255); put(x0 + fw * S, y0 + y, 0, 120, 255); } } // footprint box
  });
  return png(W, H, out);
}

mkdirSync(join(outDir, 'buildings'), { recursive: true });
const dir = join(root, 'src/content/buildings'), index = [];
for (const kind of readdirSync(dir).sort()) {
  const d = join(dir, kind); if (kind.startsWith('_') || !existsSync(join(d, 'building.json'))) continue;
  const bj = JSON.parse(readFileSync(join(d, 'building.json'), 'utf8'));
  const files = readdirSync(d).filter((f) => /^[LA]\d+(open)?\.json$/.test(f)).sort((a, b) => (a[0] === b[0] ? parseInt(a.slice(1)) - parseInt(b.slice(1)) : a[0] < b[0] ? 1 : -1));
  const pics = [], names = [];
  for (const f of files) { const p = draw(JSON.parse(readFileSync(join(d, f), 'utf8'))); pics.push(p); names.push(`${f.replace('.json', '')} ${p.w}x${p.h} anchor ${JSON.stringify(p.anchor)} foot ${JSON.stringify(p.footprint)}`); }
  if (!pics.length) continue;
  writeFileSync(join(outDir, 'buildings', `${kind}.png`), strip(pics));
  index.push(`| ${kind} | ${bj.name ?? ''} | buildings/${kind}.png | ${names.join('<br>')} |`);
}
const pal = draw(JSON.parse(readFileSync(join(root, 'src/data/blueprints/medieval/palace.json'), 'utf8')));
writeFileSync(join(outDir, 'palace_dev.png'), strip([pal]));
index.push(`| palace (dev, Nhà chính lv7) | Cung điện 6x6 | palace_dev.png | ${pal.w}x${pal.h} anchor ${JSON.stringify(pal.anchor)} foot ${JSON.stringify(pal.footprint)} |`);
writeFileSync(join(outDir, 'buildings_index.md'), `# Building pictures\n\nRed cross = anchor (foot of the building), blue box = footprint, strips go L1, L2, L3, then A1 (medieval). Scale ${S}x.\n\n| Kind | Name | Image | Levels (size, anchor, footprint) |\n|---|---|---|---|\n${index.join('\n')}\n`);
console.log(`${index.length} strips written to ${outDir}`);
