// Draw a sheet of the soldiers: one row for each action, one picture for each frame, enlarged and saved as a PNG you can open.
// Usage: node tools/art-preview.mjs <spec.json> <out.png>   (see tools/art/README.md for the spec)
import { build } from 'esbuild';
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const [, , specPath, outPath] = process.argv;
if (!specPath || !outPath) { console.error('usage: node tools/art-preview.mjs <spec.json> <out.png>'); process.exit(1); }
const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const bundle = join(tmpdir(), `art-preview-${process.pid}.mjs`);
await build({ entryPoints: [join(root, 'tools/art/preview-entry.js')], outfile: bundle, bundle: true, format: 'esm', platform: 'node', loader: { '.json': 'json' }, logLevel: 'error' });
const art = await import(pathToFileURL(bundle).href);
const spec = JSON.parse(readFileSync(specPath, 'utf8'));

// ---- a tiny PNG writer
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]); };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---- the sheet: rows of actions, each a run of frames. A row may seat the rider on a mount: { "mount": { "species", "clip", "gear" }, "lift": px }
const S = spec.scale ?? 3, BG = spec.background ?? [196, 178, 128];
const look = { sex: 'm', skin: '#e0ac69', hair: '#3b2a1a', hide: '#8b6a45', pants: '#3f63a8', ...(spec.look ?? {}) };
const FEET = { x: 34, y: 58 }; // where the feet are in a drawn villager (render/sprites.ts SPRITE_FEET)
const over = (dst, dw, src, sw, sh, ox, oy) => {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const k = (y * sw + x) * 4, a = src[k + 3], X = ox + x, Y = oy + y; if (!a || X < 0 || Y < 0 || X >= dw) continue;
    const o = (Y * dw + X) * 4; if (o + 3 >= dst.length) continue;
    const al = a / 255; for (let c = 0; c < 3; c++) dst[o + c] = Math.round(src[k + c] * al + dst[o + c] * (1 - al)); dst[o + 3] = 255;
  }
};
const rows = [];
for (const r of spec.rows) {
  const name = r.anim, an = art.anims[name];
  if (!an) { console.error('no animation', name); process.exit(1); }
  const cells = [];
  let cw = art.FW, ch = art.FH;
  const m = r.mount;
  const clip = m ? ((art.clips[art.bodies[m.species].body] ?? art.quad)[m.clip] ?? art.quad.idle) : null;
  const n = r.frames ?? (m ? Math.max(an.frames.length, clip.frames.length) : an.frames.length);
  for (let i = 0; i < n; i++) {
    const person = art.renderFrame(art.anims, name, i % an.frames.length, r.view ?? 'right', look, 'wood', r.tool ?? { tier: 0 }, r.armor, r.extra);
    if (!m) { cells.push({ w: cw, h: ch, px: person }); continue; }
    const def = { ...art.bodies[m.species], gear: m.gear ?? art.bodies[m.species].gear }, beast = art.renderAnimal(def, clip, i % clip.frames.length, m.view);
    cw = 110; ch = 100;
    const px = new Uint8ClampedArray(cw * ch * 4), gx = 56, gy = 92;
    over(px, cw, new Uint8ClampedArray([0, 0, 0, 0]), 1, 1, 0, 0);
    // a soft shadow under the beast
    for (let y = -3; y <= 3; y++) for (let x = -22; x <= 22; x++) if ((x * x) / 484 + (y * y) / 9 <= 1) { const o = ((gy + y) * cw + gx + x) * 4; px[o] = 0; px[o + 1] = 0; px[o + 2] = 0; px[o + 3] = 60; }
    over(px, cw, beast.data, beast.w, beast.h, gx - Math.floor(beast.w / 2) - (m.view ? 0 : (m.dx ?? 0)), gy - (beast.h - 2));
    over(px, cw, person, art.FW, art.FH, gx - FEET.x + (m.view ? 0 : (r.dx ?? 0)), gy - (r.lift ?? 19) - FEET.y + (art.quad && clip.frames[i % clip.frames.length].bob ? -clip.frames[i % clip.frames.length].bob : 0));
    if (beast.over) over(px, cw, beast.over, beast.w, beast.h, gx - Math.floor(beast.w / 2), gy - (beast.h - 2)); // the neck and head (or the rump) in front of the rider
    cells.push({ w: cw, h: ch, px });
  }
  rows.push({ name, cells, cw, ch });
}
const cols = Math.max(...rows.map((r) => r.cells.length));
const cwMax = Math.max(...rows.map((r) => r.cw)), rowH = rows.map((r) => r.ch * S);
const W = cols * cwMax * S, H = rowH.reduce((a, b) => a + b, 0);
const out = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { out[i * 4] = BG[0]; out[i * 4 + 1] = BG[1]; out[i * 4 + 2] = BG[2]; out[i * 4 + 3] = 255; }
let y0 = 0;
rows.forEach((row, ry) => {
  row.cells.forEach((cell, cx) => {
    for (let y = 0; y < cell.h; y++) for (let x = 0; x < cell.w; x++) {
      const k = (y * cell.w + x) * 4, a = cell.px[k + 3]; if (!a) continue;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const o = ((y0 + y * S + j) * W + cx * cwMax * S + x * S + i) * 4, al = a / 255;
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(cell.px[k + c] * al + out[o + c] * (1 - al));
      }
    }
  });
  y0 += rowH[ry];
});
mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(outPath, png(W, H, out));
console.log(`${outPath}: ${W}x${H}, ${rows.length} rows (${rows.map((r) => r.name).join(', ')})`);
