// Lõi vẽ nhân vật procedural (giữ JS thuần, kiểu dữ liệu khai báo trong rig.d.ts).
import tiers from '../data/handtools/tiers.json';
import axe from '../data/handtools/axe.json';
import pick from '../data/handtools/pick.json';
import hammer from '../data/handtools/hammer.json';
import hoe from '../data/handtools/hoe.json';
import club from '../data/handtools/club.json';
import spear from '../data/handtools/spear.json';
import mace from '../data/handtools/mace.json';
import hatchet from '../data/handtools/hatchet.json';
import sling from '../data/handtools/sling.json';
import bow from '../data/handtools/bow.json';
import bronzeSpear from '../data/handtools/bronze_spear.json';
import bronzeSword from '../data/handtools/bronze_sword.json';
import bronzeAxe from '../data/handtools/bronze_axe.json';
import armingSword from '../data/handtools/arming_sword.json';
import shortsword from '../data/handtools/shortsword.json';
import lance from '../data/handtools/lance.json';
import thrownStone from '../data/handtools/thrown_stone.json';
import warhammer from '../data/handtools/warhammer.json';
import greatsword from '../data/handtools/greatsword.json';
import knightSword from '../data/handtools/knight_sword.json';
import yewLongbow from '../data/handtools/yew_longbow.json';
import paladinLance from '../data/handtools/paladin_lance.json';
import longbow from '../data/handtools/longbow.json';
import alloyCrossbow from '../data/handtools/alloy_crossbow.json';
import heavyLance from '../data/handtools/heavy_lance.json';
import compositeBow from '../data/handtools/composite_bow.json';
import shortSpear from '../data/handtools/short_spear.json';
import pike from '../data/handtools/pike.json';
import heaterShield from '../data/shields/heater.json';
import towerShield from '../data/shields/tower.json';
import aegisShield from '../data/shields/aegis.json';
import woodShield from '../data/shields/wood.json';
import hideArmor from '../data/armors/hide.json';
import grassArmor from '../data/armors/grass.json';
import footmanArmor from '../data/armors/footman.json';
import archerArmor from '../data/armors/archer.json';
import riderArmor from '../data/armors/rider.json';
import guardArmor from '../data/armors/guard.json';
import marksmanArmor from '../data/armors/marksman.json';
import royalRiderArmor from '../data/armors/royalrider.json';
import templarArmor from '../data/armors/templar.json';
import sniperArmor from '../data/armors/sniper.json';
import paladinArmor from '../data/armors/paladin.json';
import boneArmor from '../data/armors/bone.json';
import bronzeArmor from '../data/armors/bronze.json';
import watchmanArmor from '../data/armors/watchman.json';
import sergeantArmor from '../data/armors/sergeant.json';
import wardenArmor from '../data/armors/warden.json';
import peasantHoodBrownArmor from '../data/armors/peasant_hood_brown.json';
import peasantHoodGreyArmor from '../data/armors/peasant_hood_grey.json';
import peasantStrawBrownArmor from '../data/armors/peasant_straw_brown.json';
import peasantStrawGreyArmor from '../data/armors/peasant_straw_grey.json';

/* Hand-held tools are drawn from JSON (src/data/handtools). handTools may be replaced at runtime (the animation viewer uses this to try out designs). */
const handTools = { axe, pick, hammer, hoe, club, spear, mace, hatchet, sling, bow, bronze_spear: bronzeSpear, bronze_sword: bronzeSword, bronze_axe: bronzeAxe, arming_sword: armingSword, shortsword, lance, composite_bow: compositeBow, thrown_stone: thrownStone, warhammer, greatsword, alloy_crossbow: alloyCrossbow, knight_sword: knightSword, yew_longbow: yewLongbow, paladin_lance: paladinLance, longbow, heavy_lance: heavyLance, short_spear: shortSpear, pike, ward_sword: armingSword, bronze_bow: bow };
/* Worn armour, drawn over the body from JSON (src/data/armors). */
const armors = { grass: grassArmor, hide: hideArmor, bone: boneArmor, bronze: bronzeArmor, footman: footmanArmor, archer: archerArmor, rider: riderArmor, guard: guardArmor, marksman: marksmanArmor, royalrider: royalRiderArmor, templar: templarArmor, sniper: sniperArmor, paladin: paladinArmor, watchman: watchmanArmor, sergeant: sergeantArmor, warden: wardenArmor, peasant_hood_brown: peasantHoodBrownArmor, peasant_hood_grey: peasantHoodGreyArmor, peasant_straw_brown: peasantStrawBrownArmor, peasant_straw_grey: peasantStrawGreyArmor };
/* Shields, held in the off hand: hand-drawn poses written as rows of letters (see src/data/shields). */
const shields = { heater: heaterShield, tower: towerShield, aegis: aegisShield, wood: woodShield };

/* ---- Lõi vẽ dân pixel: không phụ thuộc DOM ---- */
const W = 40, H = 48, CX = 20;
/* The frame the game draws is bigger than the body: a spear held up, a bow drawn wide or a club swung back reach past the 40 x 48 of the body and would be cut off.
   Drawing still uses body coordinates; put() shifts them by (OX, OY) into a buffer BW x BH, and renderFrame sets these for the length of one frame. */
const PADX = 14, PADT = 16, PADB = 2, FW = W + 2 * PADX, FH = H + PADT + PADB;
let BW = W, BH = H, OX = 0, OY = 0;
const rad = d => d * Math.PI / 180;
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mul = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));

function palette(look, kind) {
  const skin = hexRgb(look.skin), hair = hexRgb(look.hair), hide = hexRgb(look.hide), pants = hexRgb(look.pants || '#3f63a8');
  return {
    skin, skinD: mul(skin, 0.8), cheek: [Math.min(255, skin[0] + 18), Math.round(skin[1] * 0.86), Math.round(skin[2] * 0.86)], mouth: mul(skin, 0.6), hair, hairD: mul(hair, 0.72), hairL: mul(hair, 1.45),
    pants, pantsD: mul(pants, 0.72), pantsL: mul(pants, 1.25),
    hide, hideD: mul(hide, 0.7),
    wood: [139, 94, 52], woodD: [104, 70, 38], woodL: [196, 160, 108],
    cb: (kind === 'stone' ? [120, 126, 130] : kind === 'food' ? [150, 60, 60] : [139, 94, 52]),
    cbD: (kind === 'stone' ? [84, 90, 94] : kind === 'food' ? [96, 40, 44] : [104, 70, 38]),
    cbL: (kind === 'stone' ? [182, 188, 192] : kind === 'food' ? [220, 110, 100] : [196, 160, 108]),
    stone: [142, 148, 150], stoneD: [98, 104, 108], stoneL: [192, 198, 198],
    tw: [184, 140, 84], twD: [128, 92, 52], twL: [222, 184, 126],
    eye: [30, 20, 16], line: [30, 20, 16]
  };
}

function put(b, x, y, c, a) {
  x = Math.round(x) + OX; y = Math.round(y) + OY;
  if (x < 0 || y < 0 || x >= BW || y >= BH) return;
  const i = (y * BW + x) * 4;
  b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; b[i + 3] = a === undefined ? 255 : a;
}
function rect(b, x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c);
}
function line(b, x0, y0, x1, y1, w, c) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let k = 0; k <= n; k++) {
    const t = k / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
    rect(b, Math.round(cx - w / 2), Math.round(cy - w / 2), w, w, c);
  }
}

/* Draws rectangles [x, y, w, h, color] defined in a local frame rotated by th (radians) around (ox, oy).
   Each destination pixel is sampled by its center, so rotated shapes leave no holes. th = 0 equals plain rect(). */
function rotShapes(b, shapes, col, ox, oy, th) {
  const c = Math.cos(th), s = Math.sin(th);
  for (const [x, y, w, h, k] of shapes) {
    const C = col[k] || hexRgb(k);
    if (w === 1 || h === 1) {
      // Thin shape (handle, edge highlight): sampling pixel centers would break it into loose dots at slanted angles,
      // so draw it as one connected line between its rotated end points.
      const horiz = w >= h, ax = x + 0.5, ay = y + 0.5, bx = horiz ? x + w - 0.5 : ax, by = horiz ? ay : y + h - 0.5;
      const X0 = Math.floor(ox + ax * c - ay * s), Y0 = Math.floor(oy + ax * s + ay * c);
      const X1 = Math.floor(ox + bx * c - by * s), Y1 = Math.floor(oy + bx * s + by * c);
      const n = Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0));
      for (let i = 0; i <= n; i++) put(b, n ? Math.round(X0 + (X1 - X0) * i / n) : X0, n ? Math.round(Y0 + (Y1 - Y0) * i / n) : Y0, C);
      continue;
    }
    const xs = [], ys = [];
    for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { xs.push(ox + px * c - py * s); ys.push(oy + px * s + py * c); }
    const X1 = Math.ceil(Math.max(...xs)), Y1 = Math.ceil(Math.max(...ys));
    for (let Y = Math.floor(Math.min(...ys)); Y < Y1; Y++) for (let X = Math.floor(Math.min(...xs)); X < X1; X++) {
      const dx = X + 0.5 - ox, dy = Y + 0.5 - oy;
      const lx = dx * c + dy * s, ly = -dx * s + dy * c;
      if (lx >= x && lx < x + w && ly >= y && ly < y + h) put(b, X, Y, C);
    }
  }
}

function rr(b, x, y, w, h, c) { rect(b, x + 1, y, w - 2, h, c); rect(b, x, y + 1, w, h - 2, c); }

const HM = {
  front: [
    '..HHHHHHHH..', '.HLLLHHHHHH.', 'HHLLHHHHHHHH', 'HHHHHHHHHHHH',
    'HHSHHHSHHSHH', 'HSSSSSSSSSSH', 'HSSESSSSESSH', 'sSSESSSSESSs',
    '.ScSSSSSScS.', '.SSSSmmSSSS.', '..ssssssss..'],
  back: [
    '..HHHHHHHH..', '.HLLLHHHHHH.', 'HHLLHHHHHHHH', 'HHHHHHHHHHHH',
    'HHHHHDDHHHHH', 'HHHHHHDHHHHH', 'HHHHHHHHHHHH', 'HDHHHHHHHHDH',
    '.DDDDDDDDDD.', '..SSSSSSSS..', '..ssssssss..'],
  side: [
    '..HHHHHHHH...', '.HLLLHHHHHH..', 'HHLLHHHHHHHH.', 'HHHHHHHHHHHH.',
    'HHHHHHHHHHSS.', 'HHHHHHSSSSSS.', 'HHHHHHsSSESS.', 'HHHHHHsSSESSS',
    'HHHHHHSSScSS.', 'DDDDDDSSSSmS.', '.DDDDsssss...']
};
function femaleOf(view) {
  const m = HM[view], out = [];
  if (view === 'side') {
    m.forEach((r, i) => out.push(i < 3 ? '..' + r : 'HH' + (i === 10 ? r.replace(/^\./, 'H') : r)));
    out.push('.HHHDDD........', '..HDDDD........', '...DDD.........');
    return out;
  }
  m.forEach((r, i) => {
    if (i < 3) { out.push('.' + r + '.'); return; }
    let x = r;
    if (view === 'front' && i >= 5) x = x.replace(/^[.sS]/, 'H').replace(/[.sS]$/, 'H');
    out.push('H' + x + 'H');
  });
  if (view === 'front') out.push('HD..........DH', '.DD........DD.');
  else { out.splice(8, 3, 'HHHHHHHHHHHHHH', 'HHHHHHHHHHHHHH', 'HDHHHHHHHHHHDH'); out.push('.DDHHHHHHHHDD.', '..DDDDDDDDDD..'); }
  return out;
}
const HF = { front: femaleOf('front'), back: femaleOf('back'), side: femaleOf('side') };

function drawHead(b, view, hx, hy, P, sex) {
  const F = sex === 'f', rows = (F ? HF : HM)[view];
  const ox = F ? (view === 'side' ? -2 : -1) : 0;
  const col = { H: P.hair, L: P.hairL, D: P.hairD, S: P.skin, s: P.skinD, E: P.eye, c: P.cheek, m: P.mouth };
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = col[r[i]]; if (c) put(b, hx + ox + i, hy + j, c); } });
}

function drawTorso(b, x, y, view, P, sex) {
  const F = sex === 'f';
  if (view === 'side') {
    rect(b, x, y, 7, 6, P.skin); rect(b, x + 6, y, 1, 6, P.skinD);
    if (F) rect(b, x, y, 7, 3, P.hide);
    else for (let i = 0; i < 6; i++) rect(b, x + i, y + i, 2, 1, P.hide);
    rect(b, x, y + 6, 7, 1, P.hideD); rect(b, x, y + 7, 7, 3, P.pants); rect(b, x, y + 10, 7, 1, P.pantsD);
    rect(b, x, y + 7, 1, 3, P.pantsL);
    return;
  }
  const front = view === 'front';
  rect(b, x, y, 10, 6, P.skin);
  rect(b, x, y + 1, 1, 5, P.skinD); rect(b, x + 9, y + 1, 1, 5, P.skinD);
  if (F) { rect(b, x, y, 10, 3, P.hide); rect(b, x, y + 3, 10, 1, P.hideD); }
  else for (let i = 0; i < 6; i++) rect(b, front ? x + i : x + 8 - i, y + i, 2, 1, P.hide);
  rect(b, x, y + 6, 10, 1, P.hideD);
  rect(b, x, y + 7, 10, 3, P.pants); rect(b, x, y + 10, 10, 1, P.pantsD);
  rect(b, x + 1, y + 7, 2, 2, P.pantsL); rect(b, x + 4, y + 8, 2, 3, P.pantsD);
}

/* Shapes may be written as [x, y, w, h, color] or as { "x", "y", "w", "h", "color" }. */
function rectOf(r) { return Array.isArray(r) ? r : [r.x, r.y, r.w, r.h, r.color]; }
function rects(list) { return list.map(rectOf); }
/* One-piece tool shapes. Readable format: "handle": { length, width, color } rises from the pivot (0,0) and "head" shapes are
   measured from the handle tip, so changing the length moves the head with it. Older format: "side" = ready-made shapes. */
function gripShapes(def) {
  if (!Array.isArray(def.head)) return rects(def.side || []);
  const hd = def.handle || {}, len = hd.length === undefined ? 10 : hd.length, w = hd.width || 1;
  return [[-Math.floor((w - 1) / 2), -len, w, len, hd.color || 'wood'], ...rects(def.head).map(([x, y, rw, rh, c]) => [x, y - len, rw, rh, c])];
}

let lastAnchor = null; // [x, y] pixel of the hand the last time a tool was drawn (null if none)
function toolAnchor() { return lastAnchor; }

function drawTool(b, side, hx, hy, tool, ov, P) {
  // Tools are only held while working, and work is always seen from the side: other views draw nothing.
  // ov = { kind, tier }: công cụ dân đang cầm. tier 0 = tay không, 1 = gỗ, 2 = đá.
  if (!side) return;
  const tier = ov && ov.tier !== undefined ? ov.tier : 2;
  if (tier <= 0) return;
  lastAnchor = [Math.round(hx), Math.round(hy)];
  const kind = (ov && ov.kind) || tool.kind || 'axe';
  const def = handTools[kind] || handTools.axe;
  const T = tiers[tier] || tiers[Math.max(...Object.keys(tiers).map(Number).filter(n => n > 0))];
  const col = { head: hexRgb(T.head), light: hexRgb(T.light), dark: hexRgb(T.dark), wood: P.wood };
  const gx = Math.round(hx), gy = Math.round(hy);
  // Pose: hand-drawn shapes for this exact frame, relative to the hand (0,0), never rotated, so pixel art stays intact.
  const pose = tool.pose && def.poses && def.poses[tool.pose];
  if (pose) {
    for (const [x, y, w, h, c] of rects(pose)) rect(b, gx + x, gy + y, w, h, col[c] || hexRgb(c));
    return;
  }
  const own = (tool.side || tool.shapes) && rects(tool.side || tool.shapes); // per-frame override: hand-placed offsets, never rotated
  // Every tool pivots at the end of its handle (the hand) and turns as one body with the handle angle.
  if (own) for (const [x, y, w, h, c] of own) rect(b, gx + x, gy + y, w, h, col[c] || hexRgb(c));
  else rotShapes(b, gripShapes(def), col, gx, gy, rad(180 - (tool.a || 0)));
}

/* The tool seen from the front or from behind: the side drawing flattened. Its width stays, its length shrinks to the part of it that stands up (or hangs down): a spear held
   up is a full line, one pointed at us only its tip. From behind, what is held out in front of him is hidden by the body. */
function drawToolFacing(b, back, hx, hy, tool, ov, P) {
  const tier = ov && ov.tier !== undefined ? ov.tier : 2;
  if (tier <= 0) return;
  const kind = (ov && ov.kind) || tool.kind || 'axe', def = handTools[kind] || handTools.axe;
  const T = tiers[tier] || tiers[Math.max(...Object.keys(tiers).map(Number).filter(n => n > 0))];
  const col = { head: hexRgb(T.head), light: hexRgb(T.light), dark: hexRgb(T.dark), wood: P.wood };
  const cs = Math.cos(rad(180 - (tool.a || 0))), gx = Math.round(hx), gy = Math.round(hy);
  const pose = tool.pose && def.poses && def.poses[tool.pose];
  if (pose) { for (const [x, y, w, h, c] of rects(pose)) rect(b, gx + x, gy + y, w, h, col[c] || hexRgb(c)); return; } // a hand-drawn pose (a spear stood on the ground, a sword on the hip) is the same drawing from the front and from behind
  if (Math.abs(cs) < 0.2) { if (!back) rect(b, gx - 1, gy - 2, 3, 3, col.head); return; } // pointed at us: the tip end-on
  if (back && Math.abs(cs) < 0.5) return;
  for (const [x, y, w, h, k] of gripShapes(def)) {
    const y0 = y * cs, y1 = (y + h) * cs, top = Math.min(y0, y1), hh = Math.max(1, Math.round(Math.abs(y1 - y0)));
    rect(b, gx + x, gy + Math.round(top), w, hh, col[k] || hexRgb(k));
  }
}

/* Colours of a worn armour: its own palette plus the villager's skin tones. */
function armorColors(def, P) {
  const c = { skin: P.skin, skinD: P.skinD };
  for (const [k, v] of Object.entries(def.palette || {})) c[k] = hexRgb(v);
  return c;
}
/* Shapes of one armour layer ('torso' or 'head') for a view, drawn with their top-left corner at (ox, oy). */
function drawArmorLayer(b, def, C, view, layer, ox, oy) {
  const shapes = def[view] && def[view][layer];
  if (!shapes) return;
  if (!Array.isArray(shapes) && shapes.rows) { drawRows(b, shapes, C, ox, oy); return; }
  for (const [x, y, w, h, k] of rects(shapes)) rect(b, ox + x, oy + y, w, h, C[k] || hexRgb(k));
}
/* Pixels written as rows of letters: { "ox", "oy", "legend": { letter: colour name }, "rows": [ "..AB..", ... ] }. '.' and ' ' are empty; the colour names are looked up in C. */
function drawRows(b, art, C, ox, oy) {
  const legend = art.legend || {}, x0 = ox + (art.ox || 0), y0 = oy + (art.oy || 0);
  art.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const k = legend[ch];
      if (k === undefined) continue;
      put(b, x0 + i, y0 + j, C[k] || hexRgb(k));
    }
  });
}
/* A shield in the off hand, in one of its hand-drawn poses, with the grip at (hx, hy). */
function drawShield(b, def, pose, hx, hy) {
  const behind = pose.endsWith('Back'), art = def.poses[behind ? pose.slice(0, -4) + 'Front' : pose] || def.poses.rest, C = {};
  for (const [k, v] of Object.entries(def.palette || {})) C[k] = hexRgb(v);
  const legend = { ...def.legend };
  if (behind) for (const k of ['F', 'E', 'e', 'B']) legend[k] = legend.f; // the back of a shield: no emblem, no boss
  drawRows(b, { ...art, legend }, C, Math.round(hx), Math.round(hy));
}
/* A band around a limb, centred on (x, y). */
function drawWrap(b, wr, C, x, y) {
  if (!wr) return;
  const w = wr.w || 3, h = wr.h || 2, x0 = Math.round(x - w / 2), y0 = Math.round(y);
  rect(b, x0, y0, w, h, C[wr.color] || hexRgb(wr.color));
  if (wr.edge) rect(b, x0, y0, w, 1, C[wr.edge] || hexRgb(wr.edge));
}

/* A lit torch in the off hand: a stick, a wrapped head and a flame that flickers with `flick` (0, 1, 2). */
function drawTorch(b, hx, hy, flick) {
  const x = Math.round(hx), y = Math.round(hy);
  const wood = [120, 84, 46, 255], bind = [214, 190, 130, 255], coal = [60, 36, 24, 255];
  const flameD = [214, 72, 24, 255], flame = [248, 150, 40, 255], core = [255, 232, 140, 255];
  rect(b, x, y - 6, 1, 7, wood);                    // the stick
  rect(b, x - 1, y - 8, 3, 3, coal); rect(b, x - 1, y - 6, 3, 1, bind);   // the wrapped head
  const sway = [0, 1, -1][flick % 3], tall = [3, 4, 3][flick % 3];
  rect(b, x - 1 + sway, y - 11 - tall + 3, 3, tall, flameD);
  rect(b, x + sway, y - 11 - tall + 4, 1, tall - 1, flame);
  put(b, x + sway, y - 9 - tall + 4, core);
  if (flick % 3 === 1) put(b, x - 2, y - 12, [255, 208, 112, 200]);   // a spark
}

function drawCharacter(b, view, f, P, sex, ov, armorId, extra) {
  const AD = armorId && armors[armorId], AC = AD ? armorColors(AD, P) : null;
  const side = view === 'side', back = view === 'back', front = view === 'front';
  const bob = f.bob || 0, lean = f.lean || 0;
  const tool = f.tool && f.tool.on ? f.tool : null;
  const carry = f.carry && f.carry.on ? f.carry : null;
  const hold = !!(tool || carry);
  const SH = ov && ov.shield && shields[ov.shield], shieldF = SH && f.shield && f.shield.on ? f.shield : null;
  const tDx = side ? Math.trunc(lean / 2) : 0, hDx = side ? lean : 0;
  const hipY = 35 + bob, shY = 27 + bob, TY = 25 + bob, HY = 14 + bob;
  const gl = (o, k, d) => (o && typeof o[k] === 'number') ? o[k] : d;

  const leg = (L, hx, col) => {
    const a = rad(gl(L, 'a', 0));
    const fx = side ? hx + 7 * Math.sin(a) : hx;
    const fy = 42 - gl(L, 'lift', 0) - 7 * (1 - Math.cos(a));
    const lc = AD && AD.legs ? AC[col === P.skinD ? AD.legs.far : AD.legs.near] : col; // armour that covers the whole leg (hose, breeches)
    line(b, hx, hipY, fx, fy, 3, lc);
    rect(b, Math.round(fx) - 1, Math.round(fy) + 1, 3, 1, P.skinD);
    if (AD && col !== P.skinD) drawWrap(b, AD.wraps && AD.wraps.leg, AC, (hx + fx) / 2, fy - gl(AD.wraps && AD.wraps.leg, 'dy', 4));
  };
  const armPts = (A, sx) => {
    const a1 = gl(A, 'a', 0), a2 = a1 + gl(A, 'b', 0), L = 3.5;
    if (side) {
      const ex = sx + L * Math.sin(rad(a1)), ey = shY + L * Math.cos(rad(a1));
      return { sx, ex, ey, hx: ex + L * Math.sin(rad(a2)), hy: ey + L * Math.cos(rad(a2)) };
    }
    const k = (hold && !back) ? 0.55 : 0;
    const ey = shY + L * Math.cos(rad(a1));
    return { sx, ex: sx + (CX - sx) * k * 0.4, ey, hx: sx + (CX - sx) * k, hy: ey + L * Math.cos(rad(a2)) };
  };
  const arm = (p, col) => {
    const wr = AD && AD.wraps && AD.wraps.arm, full = !!(wr && wr.full); // a sleeve over the whole arm, a glove on the hand
    const sc = full ? AC[col === P.skinD ? (wr.far || wr.color) : wr.color] : col;
    line(b, p.sx, shY, p.ex, p.ey, 3, sc);
    line(b, p.ex, p.ey, p.hx, p.hy, 3, sc);
    if (full) { if (wr.hand) rect(b, Math.round(p.hx) - 1, Math.round(p.hy) - 1, 2, 2, AC[wr.hand]); }
    else if (AD) drawWrap(b, wr, AC, (p.ex + p.hx) / 2, (p.ey + p.hy) / 2 - 1);
  };
  const axe = (hx, hy) => drawTool(b, side, hx, hy, tool, ov, P);
  const bundle = () => {
    const dy = gl(carry, 'dy', 0) + bob;
    if (side) {
      const x = CX + 2 + tDx, y = 28 + dy;
      rect(b, x, y, 7, 6, P.cb); rect(b, x, y + 5, 7, 1, P.cbD);
      [[1, 1], [3, 1], [5, 1], [2, 3], [4, 3]].forEach(([i, j]) => put(b, x + i, y + j, P.cbL));
    } else if (!back) {
      const x = CX - 7, y = 28 + dy;
      rect(b, x, y, 14, 2, P.cb); rect(b, x, y + 2, 14, 2, P.cbD); rect(b, x + 1, y + 4, 12, 2, P.cb);
      rect(b, x, y, 1, 2, P.cbL); rect(b, x + 13, y + 2, 1, 2, P.cbL); rect(b, x + 1, y + 4, 1, 2, P.cbL);
    } else {
      rect(b, CX - 8, 29 + bob, 1, 3, P.cbL); rect(b, CX + 7, 29 + bob, 1, 3, P.cbL);
    }
  };

  if (side) {
    const hx0 = CX + 0.5;
    const pL = armPts(f.armL, hx0 + tDx), pR = armPts(f.armR, hx0 + tDx);
    arm(pL, P.skinD);
    leg(f.legL, hx0, P.skinD);
    leg(f.legR, hx0, P.skin);
    if (AD) drawArmorLayer(b, AD, AC, 'side', 'back', CX - 3 + tDx, TY);
    drawTorso(b, CX - 3 + tDx, TY, 'side', P, sex);
    if (AD) drawArmorLayer(b, AD, AC, 'side', 'torso', CX - 3 + tDx, TY);
    drawHead(b, 'side', CX - 6 + hDx, HY, P, sex);
    if (AD) drawArmorLayer(b, AD, AC, 'side', 'head', CX - 6 + hDx, HY);
    if (AD) drawArmorLayer(b, AD, AC, 'side', 'over', CX - 3 + tDx, TY);
    if (carry) bundle();
    if (shieldF) drawShield(b, SH, shieldF.pose || 'rest', pL.hx + (shieldF.dx || 0), pL.hy + (shieldF.dy || 0));
    arm(pR, P.skin);
    if (tool) axe(pR.hx, pR.hy);
    if (extra && extra.torch !== undefined) drawTorch(b, pL.hx, pL.hy, extra.torch);
    return;
  }
  const pR = armPts(f.armR, front ? CX - 5.5 : CX + 5.5);
  const pL = armPts(f.armL, front ? CX + 5.5 : CX - 5.5);
  const spread = gl(f, 'spread', 0); // astride a horse: the legs hang out to the sides
  leg(f.legR, front ? CX - 2.5 - spread : CX + 2.5 + spread, P.skin);
  leg(f.legL, front ? CX + 2.5 + spread : CX - 2.5 - spread, P.skin);
  if (!hold || back) { arm(pR, P.skin); arm(pL, P.skin); }
  if (back && tool) drawToolFacing(b, true, pR.hx, pR.hy, tool, ov, P);
  if (back && shieldF) drawShield(b, SH, (shieldF.pose || 'rest') + 'Back', pL.hx + (shieldF.dx || 0), pL.hy + (shieldF.dy || 0));
  if (AD) drawArmorLayer(b, AD, AC, view, 'back', CX - 5, TY);
  drawTorso(b, CX - 5, TY, view, P, sex);
  if (AD) drawArmorLayer(b, AD, AC, view, 'torso', CX - 5, TY);
  drawHead(b, view, CX - 6, HY, P, sex);
  if (AD) drawArmorLayer(b, AD, AC, view, 'head', CX - 6, HY);
  if (AD) drawArmorLayer(b, AD, AC, view, 'over', CX - 5, TY);
  if (shieldF && front) drawShield(b, SH, (shieldF.pose || 'rest') + 'Front', pL.hx + (shieldF.dx || 0), pL.hy + (shieldF.dy || 0));
  if (hold) {
    if (carry) bundle();
    if (!back) { arm(pR, P.skin); arm(pL, P.skin); }
    if (!back && tool) drawToolFacing(b, false, pR.hx - 3, pR.hy, tool, ov, P); // held at his right side: to the left of the picture
  }
  if (extra && extra.torch !== undefined) drawTorch(b, pL.hx + (front ? 1 : -1), pL.hy, extra.torch);
}

function outline(b, c) {
  const o = new Uint8ClampedArray(b);
  const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const i = (y * BW + x) * 4;
    if (b[i + 3]) continue;
    const touch = N.some(([dx, dy]) => {
      const xx = x + dx, yy = y + dy;
      return xx >= 0 && yy >= 0 && xx < BW && yy < BH && b[(yy * BW + xx) * 4 + 3] > 0;
    });
    if (touch) { o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; o[i + 3] = 255; }
  }
  return o;
}
function shadow(b, dx) {
  [[43, -7, 14], [44, -7, 14], [45, -5, 10]].forEach(([y, x0, n]) => {
    for (let i = 0; i < n; i++) {
      const x = CX + dx + x0 + i + OX, k = ((y + OY) * BW + x) * 4;
      if (x >= 0 && x < BW && !b[k + 3]) { b[k] = 0; b[k + 1] = 0; b[k + 2] = 0; b[k + 3] = 70; }
    }
  });
}
function flipH(b) {
  const o = new Uint8ClampedArray(b.length);
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const s = (y * BW + x) * 4, d = (y * BW + (BW - 1 - x)) * 4;
    o[d] = b[s]; o[d + 1] = b[s + 1]; o[d + 2] = b[s + 2]; o[d + 3] = b[s + 3];
  }
  return o;
}

/* Tool alone (no character), side view, for design previews. The hand (grip point) sits at (CX, HAND_Y); angleDeg is the
   handle angle as in a frame's tool.a (180 = handle pointing straight up). Returns RGBA, W x H. */
const HAND_Y = 30;
function renderTool(kind, tier, angleDeg, look, pose) {
  const b = new Uint8ClampedArray(W * H * 4);
  const P = palette(look || { skin: '#e0ac69', hair: '#3b2a1a', hide: '#8b6a45', pants: '#3f63a8' });
  drawTool(b, true, CX, HAND_Y, { a: angleDeg, pose }, { kind, tier }, P);
  return b;
}

/* Pose shapes <-> single pixels, so a pose can be edited pixel by pixel and stored as few rectangles again. */
function unpackShapes(shapes) {
  const m = new Map();
  for (const [x, y, w, h, c] of rects(shapes)) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) m.set((x + i) + ',' + (y + j), [x + i, y + j, c]);
  return [...m.values()];
}
function packPixels(list) {
  const px = [...list].sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  const runs = [];
  for (const [x, y, n] of px) {
    const last = runs[runs.length - 1];
    if (last && last.y === y && last.x + last.w === x && last.n === n) last.w++;
    else runs.push({ x, y, w: 1, h: 1, n });
  }
  const out = [];
  for (const r of runs) {
    const up = out.find(o => o.n === r.n && o.x === r.x && o.w === r.w && o.y + o.h === r.y);
    if (up) up.h++; else out.push({ ...r });
  }
  return out.map(o => [o.x, o.y, o.w, o.h, o.n]);
}

/* Turns the auto-rotated drawing of a tool at angleDeg into hand-editable pose shapes [x, y, w, h, colorName],
   relative to the hand. Starting point for hand-drawing a pose; never used while rendering. */
function bakeTool(kind, angleDeg) {
  const P = palette({ skin: '#e0ac69', hair: '#3b2a1a', hide: '#8b6a45', pants: '#3f63a8' });
  const T = tiers[1], names = {};
  for (const [n, c] of [['head', hexRgb(T.head)], ['light', hexRgb(T.light)], ['dark', hexRgb(T.dark)], ['wood', P.wood]]) names[c.join(',')] = n;
  const px = renderTool(kind, 1, angleDeg), list = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const n = px[i + 3] && names[px[i] + ',' + px[i + 1] + ',' + px[i + 2]];
    if (n) list.push([x - CX, y - HAND_Y, n]);
  }
  return packPixels(list);
}

/* view: front | back | right | left (left = right lật ngang) */
function renderFrame(anims, name, idx, view, look, kind, toolOv, armorId, extra) {
  lastAnchor = null;
  const an = anims[name];
  const f = an.frames[((idx % an.frames.length) + an.frames.length) % an.frames.length];
  const P = palette(look, kind);
  BW = FW; BH = FH; OX = PADX; OY = PADT; // room round the body for what is held out from it
  try {
    const b = new Uint8ClampedArray(FW * FH * 4);
    const v = (view === 'left' || view === 'right') ? 'side' : view;
    drawCharacter(b, v, f, P, look.sex, toolOv, armorId, extra);
    const o = outline(b, P.line);
    shadow(o, v === 'side' ? 1 : 0);
    return view === 'left' ? flipH(o) : o;
  } finally { BW = W; BH = H; OX = 0; OY = 0; }
}

/* A frame cut back to the 40 x 48 of the body: the animation viewer edits poses on that grid. */
function cropToBody(px) {
  const o = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = ((y + PADT) * FW + (x + PADX)) * 4, d = (y * W + x) * 4;
    o[d] = px[s]; o[d + 1] = px[s + 1]; o[d + 2] = px[s + 2]; o[d + 3] = px[s + 3];
  }
  return o;
}

/* ---- Dữ liệu keyframe mặc định ---- */
function defaultAnims() {
  const r = Math.round;
  const idle = [0, 1, 2, 3].map(i => ({
    bob: [0, 0, 1, 1][i], lean: 0,
    legR: { a: 2, lift: 0 }, legL: { a: -2, lift: 0 },
    armR: { a: [4, 6, 8, 6][i], b: 8 }, armL: { a: [-4, -6, -8, -6][i], b: 8 }
  }));
  const walk = (amp, armAmp, holdArms) => [0, 1, 2, 3, 4, 5].map(i => {
    const p = rad(i * 60), s = Math.sin(p), c = Math.cos(p);
    const fr = {
      bob: Math.abs(s) < 0.5 ? -1 : 0, lean: 1,
      legR: { a: r(amp * s) + 0, lift: Math.max(0, r(c * 2)) },
      legL: { a: r(-amp * s) + 0, lift: Math.max(0, r(-c * 2)) }
    };
    if (holdArms) {
      fr.armR = { a: 48, b: 50 }; fr.armL = { a: 52, b: 46 };
      fr.carry = { on: true, dy: 0 };
    } else {
      fr.armR = { a: r(-armAmp * s) + 0, b: 14 }; fr.armL = { a: r(armAmp * s) + 0, b: 14 };
    }
    return fr;
  });
  const chop = [
    { bob: 0, lean: 0, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 80, b: 40 }, armL: { a: 70, b: 40 }, tool: { on: true, a: 165 } },
    { bob: -1, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 125, b: 25 }, armL: { a: 115, b: 25 }, tool: { on: true, a: 195 } },
    { bob: -1, lean: -2, legR: { a: 10, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 150, b: 15 }, armL: { a: 140, b: 15 }, tool: { on: true, a: 215 } },
    { bob: 0, lean: 1, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 100, b: 20 }, armL: { a: 92, b: 20 }, tool: { on: true, a: 130 } },
    { bob: 1, lean: 2, legR: { a: 18, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 45, b: 30 }, armL: { a: 40, b: 30 }, tool: { on: true, a: 70 } },
    { bob: 0, lean: 1, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 70, b: 35 }, armL: { a: 62, b: 35 }, tool: { on: true, a: 125 } }
  ];
  return {
    idle: { fps: 4, loop: true, frames: idle },
    walk: { fps: 8, loop: true, frames: walk(32, 26, false) },
    carry_walk: { fps: 8, loop: true, frames: walk(24, 0, true) },
    chop: { fps: 8, loop: true, frames: chop }
  };
}
function formatAnims(anims) {
  return '{\n' + Object.entries(anims).map(([k, v]) =>
    '  "' + k + '": { "fps": ' + v.fps + ', "loop": ' + v.loop + (v.hit === undefined ? '' : ', "hit": ' + v.hit) + ', "frames": [\n' +
    v.frames.map(f => '    ' + JSON.stringify(f)).join(',\n') + '\n  ] }').join(',\n') + '\n}';
}
export { W, H, CX, FW, FH, PADX, PADT, cropToBody, armors, renderFrame, defaultAnims, formatAnims, palette, handTools, renderTool, bakeTool, toolAnchor, unpackShapes, packPixels, HAND_Y };
