import { BUILDINGS, BuildingKind, Era, eraLocked, fireUnlockLevel, levelCapByFire, levelsOf, maxLevel } from './buildings';

/**
 * The shape of a camp of a given campfire level, as a list of pieces (no world, no Sim): the dev menu builds it for the player's village and the tribes
 * keep it as data for theirs (tribebuild.ts). The fire is 2x2 with its top-left at (fx, fy).
 */

/** What goes inside the fence first (the heart of the defence: the camps, the stores, the workshops), then what stays outside (the working houses, out by the land they work). */
export const CORE: BuildingKind[] = ['storage', 'builder', 'workshop', 'armory', 'infantry', 'archery', 'cavalry', 'guardpost', 'lab', 'wartent', 'stable', 'house', 'toolstore', 'scouttent', 'supplycamp'];
export const OUTSIDE: BuildingKind[] = ['lumberyard', 'quarry', 'farmhouse', 'huntlodge', 'drill'];

export interface Piece { kind: BuildingKind; x: number; y: number; w: number; h: number; level: number }
interface Rect { x: number; y: number; w: number; h: number }

/** The spots of a camp: a grid three tiles apart round the campfire (a house is two wide and keeps a tile free all round), ring by ring, each ring clockwise from the north. The way from the gate to the fire is kept clear. */
export function ring(fire: { x: number; y: number }, r: number): Array<[number, number]> {
  const out: Array<{ i: number; j: number; a: number }> = [];
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (Math.max(Math.abs(i), Math.abs(j)) !== r || (i === 0 && j > 0)) continue;
    out.push({ i, j, a: (Math.atan2(i, -j) + 2 * Math.PI) % (2 * Math.PI) });
  }
  return out.sort((p, q) => p.a - q.a).map((o) => [fire.x + 3 * o.i, fire.y + 3 * o.j] as [number, number]);
}

/** How many of a kind a campfire of this level allows (as construction.buildingLimit, for one fire). */
export function limitAt(kind: BuildingKind, fireLevel: number): number {
  const per = BUILDINGS[kind].perFire;
  return per ? per[Math.min(per.length, fireLevel) - 1] ?? 0 : 1;
}

/** How many people the houses of these kinds hold at work in a camp of this level: as many houses as it may have, each at the level the camp allows (the slots of the building json). */
export function slotsAt(kinds: BuildingKind[], fireLevel: number, era: Era, advanced: boolean): number {
  let n = 0;
  for (const k of kinds) {
    if (!BUILDINGS[k].buildable || fireUnlockLevel(k) > fireLevel || eraLocked(k, { era: advanced ? 'ancient' : 'stone' })) continue;
    const lv = Math.max(1, Math.min(maxLevel(k, era), levelCapByFire(fireLevel)));
    n += limitAt(k, fireLevel) * (levelsOf(k, era)[lv - 1]?.slots ?? 0);
  }
  return n;
}

/** Half-width of the fence square of a camp of this level; 0 when the level opens no fence (eight pieces to each tile of half-width). */
export function fenceHalf(fireLevel: number): number {
  return fireUnlockLevel('fence') <= fireLevel ? Math.max(4, Math.min(10, Math.floor((limitAt('fence', fireLevel) + 1) / 8))) : 0;
}

const hits = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Plan a camp: the fence with its gate and a tower at each corner (or four towers round it when there is no fence), then the houses ringed round the fire,
 * every one as high as the level lets it. `taken` is what stands already (the fire, the piles) and `blocked` says whether a patch of ground cannot be used (water, mountain, off the map).
 */
export function planCamp(fx: number, fy: number, fireLevel: number, era: Era, advanced: boolean, taken: Rect[], blocked: (r: Rect) => boolean): Piece[] {
  const fire = { x: fx, y: fy }, cx = fx + 1, cy = fy + 1, half = fenceHalf(fireLevel), fenced = half > 0;
  const out: Piece[] = [], used: Rect[] = [{ x: fx, y: fy, w: 2, h: 2 }, ...taken];
  const open = (k: BuildingKind) => BUILDINGS[k].buildable && fireUnlockLevel(k) <= fireLevel && !eraLocked(k, { era: advanced ? 'ancient' : 'stone' });
  const cap = levelCapByFire(fireLevel);
  const put = (kind: BuildingKind, x: number, y: number): boolean => {
    const d = BUILDINGS[kind], r = { x, y, w: d.w, h: d.h };
    if (used.some((u) => hits(u, r)) || blocked(r)) return false;
    used.push(r); out.push({ kind, x, y, w: d.w, h: d.h, level: Math.max(1, Math.min(maxLevel(kind, era), cap)) });
    return true;
  };
  const spot = (kind: BuildingKind, spots: Array<[number, number]>): boolean => {
    for (let k = 0; k < spots.length; k++) if (put(kind, spots[k][0], spots[k][1])) { spots.splice(k, 1); return true; }
    return false;
  };
  if (fenced) {
    for (let d = -half; d <= half; d++) {
      put('fence', cx + d, cy - half);
      put(d === 0 ? 'gate' : 'fence', cx + d, cy + half);
      if (Math.abs(d) < half) { put('fence', cx - half, cy + d); put('fence', cx + half, cy + d); }
    }
    if (!eraLocked('tower', { era: advanced ? 'ancient' : 'stone' })) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) put('tower', sx > 0 ? cx + half + 1 : cx - half - 2, sy > 0 ? cy + half + 1 : cy - half - 2);
  } else if (open('tower')) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]].slice(0, limitAt('tower', fireLevel))) put('tower', cx + sx * 8 - (sx < 0 ? 2 : 0), cy + sy * 8 - (sy < 0 ? 2 : 0));
  }
  const coreRings = fenced ? Math.floor((half - 2) / 3) : 2, firstOutside = fenced ? Math.ceil((half + 2) / 3) : 3;
  const inside: Array<[number, number]> = [], outside: Array<[number, number]> = [];
  for (let r = 1; r <= coreRings; r++) inside.push(...ring(fire, r));
  for (let r = firstOutside; r <= firstOutside + 3; r++) outside.push(...ring(fire, r).sort((p, q) => Math.abs(p[1] - fy) - Math.abs(q[1] - fy))); // out by the sides, where the land is worked
  for (const kind of CORE.filter(open)) for (let n = limitAt(kind, fireLevel); n > 0; n--) { if (!(spot(kind, inside) || spot(kind, outside))) break; }
  for (const kind of OUTSIDE.filter(open)) for (let n = limitAt(kind, fireLevel); n > 0; n--) { if (!spot(kind, outside)) break; }
  return out;
}

/**
 * The camp of bandits: not a village, a few tents (2 by 2) scattered round the fire, at spots a little way out so that the loot piles and the fire stay clear. No fence, no gate,
 * no tower, no houses. `tents` of them are put up, those that fit (water, mountain and what stands already are left alone).
 */
export function planBandits(fx: number, fy: number, tents: number, taken: Rect[], blocked: (r: Rect) => boolean): Piece[] {
  const SPOTS: Array<[number, number]> = [[-6, -5], [5, -5], [-7, 2], [6, 3], [-1, 6], [0, -7]];
  const out: Piece[] = [], used: Rect[] = [{ x: fx, y: fy, w: 2, h: 2 }, ...taken];
  for (const [dx, dy] of SPOTS) {
    if (out.length >= tents) break;
    const r = { x: fx + dx, y: fy + dy, w: 2, h: 2 };
    if (used.some((u) => hits(u, r)) || blocked(r)) continue;
    used.push(r); out.push({ kind: 'fieldtent', x: r.x, y: r.y, w: 2, h: 2, level: 1 });
  }
  return out;
}
