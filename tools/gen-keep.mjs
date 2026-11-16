// The art of the Nhà chung from level 5 to 10 (src/content/buildings/campfire/A2..A7.json): one script, safe to run again.
//   node tools/gen-keep.mjs
// A4 is the hand-made palace (data/blueprints/medieval/palace.json, level 7, 6x6); the others are built here from the kit (tools/art/kit.mjs) with the same palette, and grow:
//   A2 level 5 (2x2): a hall with a tower   A3 level 6 (4x4): keep, wings, corner towers   A5 level 8 (8x8)   A6 level 9 (8x8, taller, golden ridges)   A7 level 10 (10x10, golden domes, two fountains).
// Everything that can move moves: banners ripple, torches flicker, chimneys smoke, fountains play (4 frames).
import { copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Draw, banner, blueprint, coneRoof, crenels, door, fountain, hedge, hipRoof, smoke, torch, tower, wall, windowRow, window_ } from './art/kit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src/content/buildings/campfire');
const D = 20; // depth of the ground, as in the palace

const SPECS = {
  A2: { level: 5, n: 2, floors: 2, sideTower: true },
  A3: { level: 6, n: 4, floors: 2, wings: true, keep: true, corners: true, hedges: true },
  A5: { level: 8, n: 8, floors: 3, wings: true, keep: true, corners: true, back: true, fountains: 1, hedges: true, hanging: true },
  A6: { level: 9, n: 8, floors: 3, wings: true, keep: true, corners: true, back: true, twins: true, fountains: 1, hedges: true, hanging: true, goldRidge: true, keepExtra: 10 },
  A7: { level: 10, n: 10, floors: 3, wings: true, keep: true, corners: true, back: true, twins: true, fountains: 2, hedges: true, hanging: true, goldRidge: true, domes: true, keepExtra: 16 },
};

function compose(d, s, oy) {
  const n = s.n, small = n <= 2, u = 32 * n, W = u + (small ? 8 : 32), x0 = small ? 4 : 8, cx = x0 + u / 2 + 8, y = (v) => oy + v;
  const yb = -6, floorH = 17, hallH = s.floors * floorH + 6, roofH = Math.round(12 + n * 1.5), hw = small ? 30 : Math.max(26, Math.round(u * 0.46)), hx = Math.round(cx - hw / 2);
  const dw = small ? 9 : 12 + n, doorH = small ? 15 : 20 + Math.min(8, n);
  const goldRoof = s.domes ? { color: 'slate', light: 'slateL' } : {};
  // st1: the paving, its shadow and joints
  d.group('st1', () => {
    d.poly([[x0 - 2, y(1)], [x0 + u, y(1)], [x0 + u + 16, y(-D + 1)], [x0 + 16, y(-D + 1)]], 'shadow', 0.25);
    d.poly([[x0, y(0)], [x0 + u, y(0)], [x0 + u + 16, y(-D)], [x0 + 16, y(-D)]], 'paveA');
    d.rect(x0, y(0), u, 3, 'paveD'); d.poly([[x0 + u, y(0)], [x0 + u + 16, y(-D)], [x0 + u + 16, y(-D + 3)], [x0 + u, y(3)]], 'paveD');
    for (let k = 16; k < u; k += 16) d.line([x0 + k, y(0)], [x0 + k + 16, y(-D)], 1, 'paveD', 0.7);
    d.scatter(Math.round(u / 3), [x0 + 4, y(-D + 2), u + 8, D - 4], ['paveB', 'paveD'], [1, 1], ['paveA']);
  });
  // st2 (bodies), st3 (roofs and crenels), st4 (windows, doors, banners, torches, smoke, water): each part draws into the right stage
  const body = [], roof = [], detail = [];
  const part = (st, fn) => st.push(fn);

  // the towers behind
  if (s.back) for (const bx of [x0 + 26, x0 + u - 8 + 16]) {
    const bw = 12 + n, bh = hallH + 4 + n, by = -D + 5;
    part(body, () => tower(d, bx, y(by), bw, bh, { windows: false }));
    part(roof, () => coneRoof(d, bx, y(by - bh), Math.ceil(bw / 2) + 1, 12 + n, s.domes ? { color: 'goldD', light: 'goldL' } : {}));
    part(detail, () => banner(d, bx + 1, y(by - bh - 12 - n) - 4, 8, 9, ['blue', 'blueD']));
  }
  // the keep tower behind the hall
  if (s.keep) {
    const kw = Math.max(16, Math.round(hw * 0.32)), kh = hallH + 12 + 3 * n + (s.keepExtra ?? 0), kb = yb - 2, kc = cx;
    part(body, () => tower(d, kc, y(kb), kw, kh, { windows: true }));
    part(roof, () => { if (s.domes) { d.ellipse(kc, y(kb - kh), kw / 2 + 3, 9, 'goldD'); d.ellipse(kc - 1, y(kb - kh - 1), kw / 2 + 1, 7, 'gold'); d.ellipse(kc - 3, y(kb - kh - 3), 3, 3, 'goldL', 0.8); d.rect(kc, y(kb - kh - 17), 1, 9, 'gold'); d.pixels([[kc - 1, y(kb - kh - 18)], [kc + 1, y(kb - kh - 18)], [kc, y(kb - kh - 19)]], 'goldL'); } else coneRoof(d, kc, y(kb - kh), Math.ceil(kw / 2) + 1, 14 + n); });
    part(detail, () => { banner(d, kc + 1, y(kb - kh - (s.domes ? 34 : 24 + n)), 10, 12); windowRow(d, kc - kw / 2 + 3, kc + kw / 2 - 3, y(kb - kh * 0.62), 3, 5, 3, true); });
  }
  // twin towers flanking the hall (behind its roof line)
  if (s.twins) for (const tx of [hx + 14, hx + hw - 14]) {
    const tw = 12 + n, th = hallH + 14 + n, tb = yb - 3;
    part(body, () => tower(d, tx, y(tb), tw, th, { windows: true }));
    part(roof, () => coneRoof(d, tx, y(tb - th), Math.ceil(tw / 2) + 1, 13 + n, s.domes ? { color: 'goldD', light: 'goldL' } : {}));
    part(detail, () => banner(d, tx + 1, y(tb - th - 25 - n), 8, 10));
  }
  // a single side tower (the small hall of level 5)
  if (s.sideTower) {
    const tx = hx + hw + 6, tw = 14, th = hallH + 12;
    part(body, () => tower(d, tx, y(yb + 1), tw, th, { windows: true }));
    part(roof, () => coneRoof(d, tx, y(yb + 1 - th), 8, 15));
    part(detail, () => { banner(d, tx + 1, y(yb + 1 - th - 28), 9, 10); torch(d, tx - 9, y(yb + 1), 7); });
  }
  // the wings
  const ww = s.wings ? Math.round(u * 0.16) : 0, wh = Math.round(hallH * 0.72);
  if (s.wings) for (const wx of [hx - ww, hx + hw]) {
    part(body, () => wall(d, wx, y(yb - wh), ww, wh));
    part(roof, () => { hipRoof(d, wx, y(yb - wh), ww, Math.round(roofH * 0.7), Math.max(3, ww >> 3), { ridge: s.goldRidge ? 'gold' : 'slateDD', gold: s.goldRidge }); });
    part(detail, () => { windowRow(d, wx + 3, wx + ww - 3, y(yb - wh + 8), 4, 6, 4, true); windowRow(d, wx + 3, wx + ww - 3, y(yb - Math.round(wh * 0.45)), 4, 6, 4, false); const chx = wx + (wx < hx ? 5 : ww - 9); d.rect(chx, y(yb - wh - Math.round(roofH * 0.7) - 4), 4, 9, 'stoneD'); d.rect(chx, y(yb - wh - Math.round(roofH * 0.7) - 4), 4, 1, 'stoneL'); smoke(d, chx + 2, y(yb - wh - Math.round(roofH * 0.7) - 5)); });
  }
  // the hall
  part(body, () => { wall(d, hx, y(yb - hallH), hw, hallH); d.rect(hx - 1, y(yb - hallH), hw + 2, 3, 'stoneD'); d.rect(hx - 1, y(yb - hallH), hw + 2, 1, 'stoneL'); for (let f = 1; f < s.floors; f++) d.rect(hx, y(yb - f * floorH - 2), hw, 2, 'stoneD'); });
  part(roof, () => { hipRoof(d, hx - 2, y(yb - hallH), hw + 4, roofH, Math.max(5, hw >> 3), { ridge: s.goldRidge ? 'gold' : 'slateDD', gold: s.goldRidge }); crenels(d, hx - 1, y(yb - hallH) + 1, 0); });
  part(detail, () => {
    for (let f = 0; f < s.floors; f++) { const wy = yb - (f + 1) * floorH + 4; if (f === 0) { windowRow(d, hx + 3, cx - dw / 2 - 5, y(wy + 2), 4, 7, 5, true); windowRow(d, cx + dw / 2 + 5, hx + hw - 3, y(wy + 2), 4, 7, 5, true); } else windowRow(d, hx + 3, hx + hw - 3, y(wy), 4, 7, 5, f === s.floors - 1); }
    door(d, cx, y(yb), dw, doorH);
    if (s.hanging) for (const bx of [hx + Math.round(hw * 0.22), hx + Math.round(hw * 0.78) - 5]) { d.poly([[bx, y(yb - hallH + 6)], [bx + 6, y(yb - hallH + 6)], [bx + 6, y(yb - hallH + 26)], [bx + 3, y(yb - hallH + 22)], [bx, y(yb - hallH + 26)]], 'red'); d.rect(bx, y(yb - hallH + 6), 6, 1, 'gold'); d.pixels([[bx + 2, y(yb - hallH + 12)], [bx + 3, y(yb - hallH + 12)], [bx + 3, y(yb - hallH + 13)]], 'goldL'); }
    torch(d, cx - dw / 2 - 7, y(yb + 1), 8); torch(d, cx + dw / 2 + 6, y(yb + 1), 8);
  });
  // the corner towers and the curtain walls to the wings
  if (s.corners) for (const left of [true, false]) {
    const tw = 14 + n, th = hallH + 8 + 2 * n, tc = left ? x0 + tw / 2 + 3 : x0 + u - tw / 2 - 3 + 2, wallEdge = left ? hx - ww : hx + hw + ww, cwh = Math.round(hallH * 0.5), x1 = Math.round(Math.min(tc, wallEdge)), x2 = Math.round(Math.max(tc, wallEdge));
    part(body, () => { wall(d, x1, y(yb - cwh), x2 - x1, cwh); tower(d, tc, y(yb + 1), tw, th, { windows: true }); });
    part(roof, () => { crenels(d, x1, y(yb - cwh), x2 - x1); coneRoof(d, tc, y(yb + 1 - th), Math.ceil(tw / 2) + 1, 14 + n, s.domes ? { color: 'goldD', light: 'goldL' } : {}); });
    part(detail, () => { banner(d, tc + 1, y(yb + 1 - th - 24 - n), 9, 10, left ? ['cloth', 'clothD'] : ['blue', 'blueD']); torch(d, tc + (left ? tw / 2 + 4 : -tw / 2 - 4), y(yb + 1), 7); });
  }
  // the courtyard: hedges, fountains
  part(detail, () => {
    if (s.hedges) { hedge(d, x0 + 6, y(-1), 20 + n); hedge(d, x0 + u - 26 - n + 8, y(-1), 20 + n); }
    for (let i = 0; i < (s.fountains ?? 0); i++) fountain(d, s.fountains === 2 ? cx + (i ? 26 : -26) : cx, y(-3), 9 + (n >> 1));
  });
  d.group('st2', () => body.forEach((f) => f()));
  d.group('st3', () => roof.forEach((f) => f()));
  d.group('st4', () => detail.forEach((f) => f()));
  return { W, x0, u };
}

function build(name, s) {
  let d = new Draw();
  compose(d, s, 0);
  const oy = Math.ceil(8 - d.top);
  d = new Draw();
  const { W, x0, u } = compose(d, s, oy);
  const left = Math.min(0, Math.floor(d.left) - 2), shift = -left; // anything drawn left of the picture moves it right
  const doc = blueprint(name, d, { size: [W + shift + Math.max(0, Math.ceil(d.right) - W + 2), oy + 6], anchor: [Math.round(x0 + u / 2 + 8) + shift, oy], footprint: [x0 + shift, oy - D, u, D], seed: 11 });
  if (shift) doc.layers = [{ shape: 'group', offset: [shift, 0], layers: doc.layers.slice(0, -1) }, doc.layers[doc.layers.length - 1]];
  doc.name = name; doc.name_en = `Nhà chính level ${s.level}`;
  return doc;
}

for (const [art, s] of Object.entries(SPECS)) {
  const doc = build(`Nhà chính (cấp ${s.level})`, s);
  writeFileSync(join(OUT, `${art}.json`), JSON.stringify(doc) + '\n');
  console.log(`campfire ${art}: level ${s.level}, ${doc.size[0]}x${doc.size[1]}, ${doc.layers.length} layers`);
}
copyFileSync(join(root, 'src/data/blueprints/medieval/palace.json'), join(OUT, 'A4.json'));
console.log('campfire A4: the palace (level 7)');
