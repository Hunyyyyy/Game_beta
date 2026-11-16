// The art of the medieval levels of every building (A2, A3, ... in src/content/buildings/<kind>/): each is the level before it plus a layer of what a higher level adds: one script, safe to run again.
//   node tools/art-derive.mjs [kind ...]
// Tiers: T1 banner and torches; T2 + a signature of the house; T3 + a stone turret (posts on a flat ground); T4 + a second turret, gold and braziers.
// What moves (banners, flames, smoke) moves in 4 frames (tools/art/kit.mjs). The hand-made arts (A1, and A1..A3 of the medieval-only houses) are never touched.
// Which art draws which level is src/data/artlevels.json (upTo); the Nhà chung has its own script (tools/gen-keep.mjs); walls, gates and traps are drawn by the renderer.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Draw, FRAMES, FPS, PALETTE, banner, barrel, coneRoof, crate, crenels, smoke, torch, wall } from './art/kit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = join(root, 'src/content/buildings');
const cfg = JSON.parse(readFileSync(join(root, 'src/data/artlevels.json'), 'utf8'));
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const FLAT = new Set(['field', 'drill', 'ranch', 'infantry', 'wartent', 'scouttent']); // flat or a tent: posts and banners, no stone turret beside it
const SKIP = new Set(['campfire', 'fence', 'gate', 'trap', 'fieldtent']);
/** The colour of the banner of a house by what it is: war red, trade blue, work green-brown. */
const CLOTH = { war: ['cloth', 'clothD'], defence: ['cloth', 'clothD'], development: ['blue', 'blueD'], storage: ['blue', 'blueD'], production: ['bushL', 'bush'] };

// ---------------------------------------------------------------- what one house adds
/** The signature of each camp: one small thing at its right-hand corner that tells what it is. */
const SIGNATURE = {
  infantry: (d, x, y) => { for (let i = 0; i < 3; i++) { d.line([x + i * 3, y], [x + i * 3 + 2, y - 17], 1, 'woodD'); d.pixels([[x + i * 3 + 2, y - 18], [x + i * 3 + 2, y - 19]], 'stoneL'); } d.ellipse(x + 11, y - 5, 4, 4, 'red'); d.ellipse(x + 11, y - 5, 2, 2, 'gold'); },
  archery: (d, x, y) => { d.rect(x + 2, y - 9, 1, 9, 'woodD'); d.rect(x + 9, y - 9, 1, 9, 'woodD'); d.ellipse(x + 6, y - 14, 6, 6, 'stoneL'); d.ellipse(x + 6, y - 14, 4, 4, 'red'); d.ellipse(x + 6, y - 14, 2, 2, 'stoneL'); d.pixels([[x + 6, y - 14]], 'red'); d.rect(x + 13, y - 6, 3, 6, 'woodD'); d.pixels([[x + 13, y - 7], [x + 15, y - 8]], 'stoneL'); },
  cavalry: (d, x, y) => { d.rect(x, y - 9, 1, 9, 'woodD'); d.rect(x + 11, y - 9, 1, 9, 'woodD'); d.rect(x, y - 8, 12, 1, 'woodL'); d.rect(x, y - 5, 12, 1, 'woodL'); d.ellipse(x + 15, y - 3, 4, 3, 'hay'); d.ellipse(x + 15, y - 4, 3, 2, 'hayD', 0.6); },
  guardpost: (d, x, y) => { d.rect(x + 3, y - 12, 4, 12, 'stoneD'); d.rect(x + 2, y - 14, 6, 3, 'stone'); torch(d, x + 5, y - 13, 3); },
  stable: (d, x, y) => { d.ellipse(x + 6, y - 4, 6, 4, 'hay'); d.ellipse(x + 5, y - 5, 4, 2, 'hayD', 0.6); d.rect(x + 13, y - 5, 8, 3, 'woodD'); d.rect(x + 13, y - 5, 8, 1, 'water'); d.rect(x + 14, y - 2, 1, 2, 'woodD'); d.rect(x + 19, y - 2, 1, 2, 'woodD'); },
  drill: (d, x, y) => { for (const dx of [0, 9]) { d.rect(x + dx + 2, y - 14, 2, 14, 'woodD'); d.ellipse(x + dx + 3, y - 14, 4, 3, 'sackD'); d.rect(x + dx - 1, y - 11, 8, 1, 'woodL'); } },
  scouttent: (d, x, y) => { d.rect(x, y - 6, 12, 2, 'woodD'); d.rect(x + 1, y - 4, 1, 4, 'woodD'); d.rect(x + 10, y - 4, 1, 4, 'woodD'); d.rect(x + 2, y - 7, 8, 1, 'cloth'); d.pixels([[x + 4, y - 8], [x + 7, y - 8]], 'red'); },
  wartent: (d, x, y) => { banner(d, x + 4, y - 32, 14, 13, ['red', 'redD']); },
  supplycamp: (d, x, y) => { crate(d, x, y, 7, 6); crate(d, x + 8, y, 7, 6); crate(d, x + 4, y - 6, 7, 6); barrel(d, x + 16, y); },
  lab: (d, x, y) => { d.rect(x + 2, y - 10, 8, 10, 'wood'); d.rect(x + 3, y - 9, 6, 1, 'stoneL'); d.rect(x + 3, y - 7, 6, 1, 'stoneL'); d.pixels([[x + 4, y - 9], [x + 7, y - 7]], 'glassL'); },
  workshop: (d, x, y) => { d.rect(x + 1, y - 7, 8, 3, 'stoneDD'); d.rect(x, y - 4, 10, 4, 'stoneD'); d.rect(x + 2, y - 7, 5, 1, 'ember'); d.rect(x + 3, y - 8, 1, 1, 'glow'); },
  storage: (d, x, y) => { barrel(d, x, y); barrel(d, x + 8, y); crate(d, x + 4, y - 7, 7, 6); },
  market: (d, x, y) => { d.rect(x, y - 8, 12, 2, 'cloth'); d.rect(x, y - 6, 12, 1, 'clothD'); d.rect(x + 1, y - 6, 1, 6, 'woodD'); d.rect(x + 10, y - 6, 1, 6, 'woodD'); d.pixels([[x + 3, y - 3], [x + 6, y - 3], [x + 8, y - 4]], 'goldL'); },
};

/** Everything a tier adds, drawn onto `d` from the footprint and anchor of the art it grows from. */
function decorate(d, kind, group, def, tier) {
  const [fx, , fw] = def.footprint, ax = def.anchor[0], ay = def.anchor[1], flat = FLAT.has(kind) || def.size[0] > 90, cloth = CLOTH[group] ?? CLOTH.war, left = fx, right = fx + fw;
  const y = ay + 1;
  d.group('st4', () => {
    // T1: a banner at the right-hand corner and a torch at each front corner
    banner(d, right - 2, y - (flat ? 26 : 38), 10, 11, cloth);
    torch(d, left + 3, y - 1, 7); torch(d, right - 5, y - 1, 7);
    if (tier >= 2 && SIGNATURE[kind]) SIGNATURE[kind](d, right + 3, y);
    if (tier >= 2 && !SIGNATURE[kind] && !flat) smoke(d, ax + 10, ay - 46);
  });
  if (tier >= 3) {
    // T3: a turret on the left (a pair of posts on a flat ground)
    const th = tier >= 4 ? 36 : 30, tw = 12;
    if (flat) {
      d.group('st3', () => { for (const px of [left + 1, right - 3]) { d.rect(px - 2, y - 18, 6, 18, 'stone'); d.rect(px - 2, y - 18, 1, 18, 'stoneL'); d.rect(px + 3, y - 18, 1, 18, 'stoneD'); d.rect(px - 3, y - 19, 8, 2, 'stoneD'); d.rect(px - 3, y - 20, 8, 1, 'stoneL'); } });
      d.group('st4', () => { for (const px of [left + 1, right - 3]) { d.rect(px, y - 24, 1, 5, 'goldD'); d.pixels([[px, y - 25]], 'goldL'); } });
    } else {
      d.group('st2', () => wall(d, left - 8, y - th, tw, th));
      d.group('st3', () => { crenels(d, left - 9, y - th, tw + 2); d.rect(left - 3, y - th + 7, 2, 6, 'dark'); });
      d.group('st4', () => banner(d, left - 2, y - th - 20, 9, 9, ['blue', 'blueD']));
    }
  }
  if (tier >= 4) {
    if (!flat) {
      d.group('st2', () => wall(d, right - 4, y - 34, tw0(), 34));
      d.group('st3', () => { crenels(d, right - 5, y - 34, tw0() + 2); d.rect(right + 1, y - 27, 2, 6, 'dark'); });
      d.group('st4', () => { d.rect(right - 4, y - 36, tw0(), 1, 'gold'); d.rect(left - 8, y - 38, tw0(), 1, 'gold'); });
    }
    d.group('st4', () => { d.rect(left, y - 1, fw, 1, 'gold', 0.8); });
  }
}
const tw0 = () => 12;

// ---------------------------------------------------------------- which art grows from which
function plan(kind, b) {
  const total = (cfg.upTo.kinds[kind] ?? (cfg.medievalOnly.includes(kind) ? cfg.upTo.medieval : b.group === 'defence' ? cfg.upTo.defence : cfg.upTo.default)).length;
  const hand = cfg.handMade[kind], st = (b.levels.stone ?? []).length, medOnly = cfg.medievalOnly.includes(kind);
  const jobs = []; // { art: 'A4', from: 'A1.json', tier: 2 }
  if (medOnly) { for (let a = hand + 1; a <= total; a++) jobs.push({ art: `A${a}`, from: `A${hand}.json`, tier: a - hand + 1 }); }
  else if (st && !hand) { for (let a = 1; a <= total; a++) jobs.push({ art: `A${a}`, from: 'L3.json', tier: a }); } // the market: no medieval art yet, it grows from its last stone one
  else { for (let a = hand + 1; a <= total; a++) jobs.push({ art: `A${a}`, from: 'A1.json', tier: a - hand + 1 }); }
  return jobs;
}

const only = process.argv.slice(2);
let n = 0;
for (const kind of readdirSync(dirs)) {
  if (SKIP.has(kind) || !existsSync(join(dirs, kind, 'building.json')) || (only.length && !only.includes(kind))) continue;
  const b = J(join(dirs, kind, 'building.json'));
  for (const job of plan(kind, b)) {
    const src = J(join(dirs, kind, job.from)), base = structuredClone(src);
    const d = new Draw();
    const layers = base.layers.filter((l, i) => !(i === base.layers.length - 1 && l.shape === 'outline'));
    decorate(d, kind, b.group, base, Math.min(4, job.tier));
    const out = { ...base, name: `${base.name}`, animate: { frames: FRAMES, fps: FPS }, palette: { ...PALETTE, ...base.palette }, layers: [...layers, ...d.root, { shape: 'outline', color: 'line' }, ...d.lateLayers] };
    writeFileSync(join(dirs, kind, `${job.art}.json`), JSON.stringify(out) + '\n');
    n++;
  }
}
console.log(`art-derive: ${n} drawings`);
