// Draw some blueprint JSON files side by side in one PNG (frame 0 of each, or the frames asked for, one row each).
// Usage: node tools/art-look.mjs <out.png> <scale> [--frames 0,2] <file.json> ...      (no browser: the blueprint engine of the game)
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
await import(pathToFileURL(join(root, 'src/blueprint/engine.js')).href);
const BP = globalThis.Blueprint;
const args = process.argv.slice(2), out = args.shift(), S = Number(args.shift() ?? 2);
let frames = [0];
const fi = args.indexOf('--frames'); if (fi >= 0) { frames = args[fi + 1].split(',').map(Number); args.splice(fi, 2); }

const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]); };
const png = (w, h, rgba) => { const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); } const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };

const pics = args.map((f) => { const def = JSON.parse(readFileSync(f, 'utf8')); const r = BP.render(def, { seed: def.seed ?? 1, params: { st1: 1, st2: 1, st3: 1, st4: 1 }, fit: true }); if (r.warnings.length) console.log(f, 'warnings:', r.warnings.slice(0, 3)); return r; });
const cw = Math.max(...pics.map((p) => p.w)) + 6, ch = Math.max(...pics.map((p) => p.h)) + 6;
const W = cw * S * pics.length, H = ch * S * frames.length, buf = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { buf[i * 4] = 150; buf[i * 4 + 1] = 140; buf[i * 4 + 2] = 100; buf[i * 4 + 3] = 255; }
frames.forEach((fr, row) => pics.forEach((p, n) => {
  const px = p.frames[Math.min(fr, p.frames.length - 1)], ox = n * cw * S + 3 * S, oy = row * ch * S + (ch - p.h - 3) * S;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const k = (y * p.w + x) * 4, a = px[k + 3]; if (!a) continue;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const o = ((oy + y * S + j) * W + ox + x * S + i) * 4; buf[o] = px[k]; buf[o + 1] = px[k + 1]; buf[o + 2] = px[k + 2]; }
  }
}));
writeFileSync(out, png(W, H, buf));
console.log(`${out}: ${W}x${H}, ${pics.map((p) => `${p.w}x${p.h}`).join(' ')}`);
