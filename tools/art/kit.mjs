// Drawing kit for the medieval building art (blueprint JSON, src/blueprint/engine.js): stone walls, roofs, towers, windows, and the parts that MOVE (banners, torches, smoke, water).
// Used by tools/gen-keep.mjs (the Nhà chung) and tools/art-derive.mjs (the other buildings). The picture has FRAMES frames; a moving part is drawn once per frame (`onFrames`).
// All colour names are those of the palace art (data/blueprints/medieval/palace.json), so a building and the palace look one family.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAMES = 4, FPS = 4;
export const PALETTE = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/data/blueprints/medieval/palace.json'), 'utf8')).palette;
Object.assign(PALETTE, { smoke: '#dcdcdc', smokeD: '#b4b4b4', cloth: '#a8342a', clothD: '#6e1f19', blue: '#2f56a6', blueD: '#1f3a74', hay: '#d8b858', hayD: '#a8883a' });

/** A drawing: layers go in `out`, in order; `top` is the highest point drawn (so the picture can be made tall enough). */
export class Draw {
  constructor() { this.out = [this.root = []]; this.cur = this.root; this.lateLayers = []; /* drawn after the outline: faint things (glow, smoke) that must not be outlined */ this.top = Infinity; this.left = Infinity; this.right = -Infinity; }
  track(x, y) { this.top = Math.min(this.top, y); this.left = Math.min(this.left, x); this.right = Math.max(this.right, x); }
  add(l, pts) { for (const [x, y] of pts) this.track(x, y); this.cur.push(l); return this; }
  /** Layers made inside `fn` go in a group shown from the stage `cond` (and on the frames `frames`). */
  group(cond, fn, frames) {
    const g = { shape: 'group', ...(cond ? { if: cond } : {}), ...(frames ? { onFrames: frames } : {}), layers: [] }, prev = this.cur;
    this.cur = g.layers; fn(); this.cur = prev; if (g.layers.length) prev.push(g);
    return this;
  }
  /** Layers made inside `fn` go after the outline (a glow or a wisp of smoke would get a dark ring round it otherwise). */
  late(fn) { const prev = this.cur; this.cur = this.lateLayers; fn(); this.cur = prev; return this; }
  rect(x, y, w, h, color, alpha) { return this.add({ shape: 'rect', x, y, w, h, color, ...(alpha ? { alpha } : {}) }, [[x, y], [x + w, y + h]]); }
  poly(points, color, alpha) { return this.add({ shape: 'poly', points, color, ...(alpha ? { alpha } : {}) }, points); }
  line(a, b, w, color, alpha) { return this.add({ shape: 'line', from: a, to: b, w, color, ...(alpha ? { alpha } : {}) }, [a, b]); }
  ellipse(cx, cy, rx, ry, color, alpha) { return this.add({ shape: 'ellipse', cx, cy, rx, ry, color, ...(alpha ? { alpha } : {}) }, [[cx - rx, cy - ry], [cx + rx, cy + ry]]); }
  pixels(at, color) { return this.add({ shape: 'pixels', at, color }, at); }
  scatter(count, area, colors, size = [1, 1], onlyOver) { return this.add({ shape: 'scatter', count, area, size, colors, ...(onlyOver ? { onlyOver } : {}) }, [[area[0], area[1]], [area[0] + area[2], area[1] + area[3]]]); }
}

// ---------------------------------------------------------------- still parts
/** A wall of cut stone with a lit left edge, a shaded right edge, a plinth and courses. */
export function wall(d, x, y, w, h, o = {}) {
  d.rect(x, y, w, h, o.color ?? 'stone');
  d.rect(x, y, 2, h, 'stoneL'); d.rect(x + w - 3, y, 3, h, 'stoneD'); d.rect(x, y + h - 3, w, 3, 'stoneDD');
  for (let yy = y + 6; yy < y + h - 4; yy += 6) d.rect(x + 2, yy, w - 5, 1, 'joint', 0.55);
  d.scatter(Math.max(4, Math.round((w * h) / 70)), [x + 2, y + 2, w - 5, h - 6], ['joint', 'stoneL', 'stoneD'], [1, 1], ['stone']);
}
/** A window: dark frame, glass, a highlight, a sill; `lit`: a warm light behind it (alive at dusk). */
export function window_(d, x, y, w, h, lit) {
  d.rect(x - 1, y - 1, w + 2, h + 2, 'stoneDD'); d.rect(x, y, w, h, lit ? 'glowG' : 'glass');
  d.rect(x, y, Math.max(1, w >> 1), 1, lit ? 'glow' : 'glassL'); d.rect(x + (w >> 1), y, 1, h, 'stoneDD', 0.6);
  d.rect(x - 2, y + h + 1, w + 4, 1, 'stoneL');
}
export function windowRow(d, x0, x1, y, w, h, gap, lit) { const n = Math.max(1, Math.floor((x1 - x0 + gap) / (w + gap))), span = n * w + (n - 1) * gap, s = x0 + Math.round((x1 - x0 - span) / 2); for (let i = 0; i < n; i++) window_(d, s + i * (w + gap), y, w, h, lit && i % 2 === 0); }
/** A hipped slate roof with an overhang, tile courses and a lit left slope. */
export function hipRoof(d, x, y, w, h, inset, o = {}) {
  const c = o.color ?? 'slate', l = o.light ?? 'slateL', dk = o.dark ?? 'slateD';
  d.rect(x - 2, y, w + 4, 2, 'slateDD');
  d.poly([[x - 2, y], [x + w + 2, y], [x + w - inset, y - h], [x + inset, y - h]], c);
  d.poly([[x - 2, y], [x + inset, y - h], [x + inset + 6, y - h], [x + 5, y]], l, 0.5);
  d.poly([[x + w + 2, y], [x + w - inset, y - h], [x + w - inset - 6, y - h], [x + w - 5, y]], dk, 0.7);
  for (let k = 4; k < h; k += 4) { const f = k / h, xa = x - 2 + (inset + 2) * f, xb = x + w + 2 - (inset + 2) * f; d.rect(Math.round(xa), y - k, Math.round(xb - xa), 1, 'slateDD', 0.55); }
  d.rect(x + inset, y - h - 1, w - 2 * inset, 2, o.ridge ?? 'slateDD');
  if (o.gold) d.rect(x + inset, y - h - 2, w - 2 * inset, 1, 'gold');
}
/** A cone roof on a round tower, with a gold finial. */
export function coneRoof(d, cx, yBase, r, h, o = {}) {
  d.poly([[cx - r - 2, yBase], [cx + r + 2, yBase], [cx, yBase - h]], o.color ?? 'slate');
  d.poly([[cx - r - 2, yBase], [cx, yBase - h], [cx - 2, yBase]], o.light ?? 'slateL', 0.55);
  d.poly([[cx + r + 2, yBase], [cx, yBase - h], [cx + 3, yBase]], 'slateD', 0.6);
  d.rect(cx - r - 2, yBase - 1, 2 * r + 5, 2, 'slateDD');
  d.rect(cx, yBase - h - 5, 1, 6, 'gold'); d.pixels([[cx - 1, yBase - h - 6], [cx + 1, yBase - h - 6], [cx, yBase - h - 7]], 'goldL');
}
/** A row of crenels along the top of a wall or tower. */
export function crenels(d, x, y, w) { d.rect(x, y - 1, w, 2, 'stoneD'); for (let i = 0; i < w; i += 5) { d.rect(x + i, y - 4, 3, 4, 'stone'); d.rect(x + i, y - 4, 1, 4, 'stoneL'); } }
/** A tower: a stone shaft with a window slit, crenels or a roof. */
export function tower(d, cx, base, w, h, o = {}) {
  const x = Math.round(cx - w / 2);
  wall(d, x, base - h, w, h);
  d.rect(x + (w >> 1) - 1, base - h + 8, 2, 7, 'dark'); d.rect(x + (w >> 1) - 1, base - h + 8, 1, 7, 'darkL');
  if (o.windows) window_(d, x + (w >> 1) - 2, base - h + Math.round(h * 0.45), 4, 6, o.lit);
  d.rect(x - 1, base - h, w + 2, 3, 'stoneD'); d.rect(x - 1, base - h, w + 2, 1, 'stoneL');
  if (o.cone) coneRoof(d, cx, base - h, Math.ceil(w / 2) + 1, o.cone, o); else crenels(d, x - 1, base - h, w + 2);
}
export function door(d, cx, base, w, h) {
  const x = Math.round(cx - w / 2);
  d.rect(x - 2, base - h - 2, w + 4, h + 2, 'stoneDD'); d.rect(x, base - h, w, h, 'dark'); d.ellipse(cx, base - h, w / 2, w / 3, 'dark');
  d.rect(x + 1, base - h + 1, w - 2, h - 1, 'woodD'); d.rect(x + (w >> 1), base - h + 1, 1, h - 1, 'dark');
  for (let k = 3; k < h; k += 4) d.rect(x + 1, base - k, w - 2, 1, 'wood', 0.7);
  d.pixels([[x + 2, base - (h >> 1)], [x + w - 3, base - (h >> 1)]], 'gold');
  for (let i = 0; i < 3; i++) d.rect(x - 4 + i, base - 1 - i, w + 8 - 2 * i, 1, i ? 'stoneL' : 'stone'); // steps
}
export function hedge(d, x, y, w) { d.ellipse(x + w / 2, y - 3, w / 2, 4, 'bush'); d.ellipse(x + w / 2 - 1, y - 4, w / 2 - 2, 2, 'bushL', 0.8); d.scatter(Math.max(2, w >> 2), [x + 2, y - 6, w - 4, 4], ['goldL', 'redL'], [1, 1]); }
export function crate(d, x, y, w, h) { d.rect(x, y - h, w, h, 'wood'); d.rect(x, y - h, w, 1, 'woodL'); d.rect(x, y - 1, w, 1, 'woodD'); d.rect(x + (w >> 1), y - h, 1, h, 'woodD'); }
export function barrel(d, x, y) { d.ellipse(x + 3, y - 4, 3, 4, 'woodD'); d.rect(x, y - 7, 7, 1, 'woodL'); d.rect(x, y - 2, 7, 1, 'darkL'); d.rect(x, y - 5, 7, 1, 'darkL'); }

// ---------------------------------------------------------------- moving parts (one drawing per frame)
const SWAY = [0, 1, 2, 1], LIFT = [0, 1, 0, -1];
/** A banner on a pole: the cloth ripples (frame by frame), its tail is notched. `col`: [cloth, shade]. */
export function banner(d, x, yTop, h, w, col = ['cloth', 'clothD']) {
  d.rect(x, yTop - 2, 1, h + 4, 'woodD'); d.rect(x, yTop - 3, 1, 1, 'gold');
  for (let f = 0; f < FRAMES; f++) d.group(null, () => {
    const s = SWAY[f], t = LIFT[f];
    d.poly([[x + 1, yTop], [x + 1 + w + s, yTop + 1 + t], [x + w - 2 + s, yTop + (h >> 1)], [x + 1 + w + s, yTop + h - 1 - t], [x + 1, yTop + h]], col[0]);
    d.poly([[x + 1, yTop + h], [x + 1 + w + s, yTop + h - 1 - t], [x + w - 2 + s, yTop + (h >> 1)], [x + 1, yTop + (h >> 1)]], col[1], 0.5);
    d.rect(x + 1, yTop + 2, w - 1 + s, 1, 'gold', 0.9);
  }, [f]);
}
/** A torch on a post: the flame flickers (frame by frame) and a faint glow breathes round it. */
export function torch(d, x, y, h = 7) {
  d.rect(x, y - h, 1, h, 'woodD'); d.rect(x - 1, y - h - 1, 3, 2, 'darkL');
  const base = y - h - 1;
  for (let f = 0; f < FRAMES; f++) d.group(null, () => {
    const a = [3, 4, 3, 5][f], b = [2, 3, 3, 2][f], dx = [0, 1, 0, -1][f];
    d.rect(x - 1, base - 2, 3, 2, 'glowG'); d.rect(x - 1 + (dx > 0 ? 1 : 0), base - a, 2, a - 1, 'ember'); d.rect(x, base - b - 2, 1, b, 'glow');
  }, [f]);
  for (let f = 0; f < FRAMES; f++) d.late(() => d.group('st4', () => d.ellipse(x, base - 3, 5 + (f & 1), 5 + (f & 1), 'glow', 0.14), [f]));
}
/** A column of smoke that rises and thins. */
export function smoke(d, x, y) {
  for (let f = 0; f < FRAMES; f++) d.late(() => d.group('st4', () => {
    for (let k = 0; k < 3; k++) {
      const up = (f * 3 + k * 5) % 14, a = Math.max(0.12, 0.6 - up * 0.035), r = 1 + Math.floor(up / 5);
      d.ellipse(x + Math.round(up / 4) + (k & 1), y - up, r, r, k & 1 ? 'smokeD' : 'smoke', a);
    }
  }, [f]));
}
/** A fountain: a round basin and a water jet that falls in rings. */
export function fountain(d, cx, y, r) {
  d.ellipse(cx, y, r, r * 0.45, 'stoneD'); d.ellipse(cx, y - 1, r - 2, r * 0.38, 'water'); d.ellipse(cx - 2, y - 2, r - 6, r * 0.22, 'waterL', 0.7);
  d.rect(cx - 1, y - 8, 3, 7, 'stone'); d.rect(cx - 1, y - 8, 1, 7, 'stoneL');
  for (let f = 0; f < FRAMES; f++) d.group(null, () => {
    const hgt = [10, 12, 11, 13][f];
    d.rect(cx, y - 8 - hgt, 1, hgt, 'waterL', 0.9); d.pixels([[cx - 2, y - 6 - (f & 1)], [cx + 2, y - 6 - ((f + 1) & 1)], [cx - 1, y - 9 - hgt + 2], [cx + 1, y - 9 - hgt + 1]], 'waterL');
    d.ellipse(cx, y - 1, r - 4 + (f & 1), (r - 4 + (f & 1)) * 0.3, 'waterL', 0.35);
  }, [f]);
}

/** The blueprint of a drawing: size, anchor, footprint, the four stages of building, an outline to close it. */
export function blueprint(name, d, o) {
  return {
    name, type: 'prop', size: o.size, anchor: o.anchor, footprint: o.footprint, seed: o.seed ?? 7, params: { st1: 1, st2: 1, st3: 1, st4: 1 }, palette: PALETTE,
    animate: { frames: FRAMES, fps: FPS }, layers: [...d.root, { shape: 'outline', color: 'line' }, ...d.lateLayers],
  };
}
