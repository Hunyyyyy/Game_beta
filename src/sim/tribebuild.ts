import type { BuildingKind } from './buildings';
import { planBandits, planCamp } from './campplan';
import { SIEGE } from './combat';
import { DIFF } from './difficulty';
import type { Sim } from './sim';
import type { Tribe } from './tribes';
import { Tile } from './world';

type Prop = Tribe['props'][number];

/** The plan of a camp is kept as data: the fire and the piles are fixed; every piece the plan makes (houses, fence, gate, towers) has a level `lv`. A house also has its kind `b`. */
const planned = (p: Prop): boolean => p.lv !== undefined;
const keyOf = (p: Prop): string => `${p.b ?? p.kind}@${p.x},${p.y}`;

/** Strength of a piece: its kind's (siege.json propHp), growing with the level (and sturdier in a boss village). */
function hpOf(kind: Prop['kind'], _w: number, _h: number, lv: number, boss = false): number {
  return Math.round((SIEGE.propHp[kind] ?? 60) * (1 + 0.5 * (lv - 1)) * (boss ? DIFF.boss.wallHp : 1));
}

/** The most strength a piece of a village can have. */
export const maxPropHp = (t: Tribe, p: Prop): number => hpOf(p.kind, p.w, p.h, p.lv ?? 1, !!t.boss);

/** The pieces of a village mend: `share` of their strength each, or all of it. */
export function repairProps(t: Tribe, share: number): void {
  for (const p of t.props) if (p.lv !== undefined) p.hp = Math.min(maxPropHp(t, p), p.hp + (share >= 1 ? Infinity : maxPropHp(t, p) * share));
}

/** Clear the trees and rocks off a patch of ground (their tiles go back to grass), with a tile to spare all round so that nobody is walled in. */
function clearPatch(sim: Sim, x: number, y: number, w: number, h: number, margin: number): void {
  const W = sim.world, N = W.size;
  for (let j = -margin; j < h + margin; j++) for (let i = -margin; i < w + margin; i++) {
    if (x + i < 0 || y + j < 0 || x + i >= N || y + j >= N) continue;
    const k = (y + j) * N + x + i;
    if (W.nodes.delete(k)) { W.tiles[k] = Tile.Grass; W.decor[k] = 0; }
  }
}

/**
 * Raise the camp of a tribe to a campfire level, as the dev menu does for the player's village (campplan.ts): the same pieces on the same spots, kept as props of the tribe
 * and marked on the map. A piece that stands already and is still in the plan is kept (hurt as it is) and raised to the new level; the rest of the old plan goes and the new one is put up.
 * Costs nothing and takes no builders. Returns how many pieces the plan has.
 */
/** Is this ground no place for a piece of a camp: the edge of the world, water or mountain. */
const blockedBy = (sim: Sim) => (r: { x: number; y: number; w: number; h: number }): boolean => {
  const W = sim.world, N = W.size;
  for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
    if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) return true;
    const tile = W.at(i, j);
    if (tile === Tile.Water || tile === Tile.Mountain) return true;
  }
  return false;
};

/** The pieces the plan of a village has at its level and the pieces of it that stand (a piece torn down in a war is no longer in `props`). */
export function campPieces(sim: Sim, t: Tribe): { plan: number; standing: number } {
  const fire = t.props.find((p) => p.kind === 'fire'), level = t.built ?? 0;
  if (!fire || !level) return { plan: 0, standing: 0 };
  const base = t.props.filter((p) => !planned(p)), have = new Set(t.props.filter(planned).map(keyOf));
  const pieces = planPieces(sim, t, fire, level, base, blockedBy(sim));
  return { plan: pieces.length, standing: pieces.filter((q) => have.has(`${q.kind === 'fence' || q.kind === 'gate' || q.kind === 'tower' ? q.kind : q.kind}@${q.x},${q.y}`)).length };
}

/**
 * A beaten village puts up again some of what was torn down: the pieces of its plan that are missing, at most `count` a day, new and weak (a third of their strength), mending over the days
 * (repairProps). Its people can only be as many as its houses can hold, see tribelod.recoverTribe. Returns how many went up.
 */
export function rebuildProps(sim: Sim, t: Tribe, count: number): number {
  const fire = t.props.find((p) => p.kind === 'fire'), level = t.built ?? 0;
  if (t.state === 'destroyed' || !fire || !level || count <= 0) return 0;
  const W = sim.world, N = W.size, base = t.props.filter((p) => !planned(p)), have = new Set(t.props.filter(planned).map(keyOf));
  let n = 0;
  for (const piece of planPieces(sim, t, fire, level, base, blockedBy(sim))) {
    if (n >= count) break;
    const kind: Prop['kind'] = piece.kind === 'fence' || piece.kind === 'gate' || piece.kind === 'tower' ? piece.kind : 'house', b: BuildingKind | undefined = kind === 'house' ? piece.kind : undefined;
    const prop: Prop = { x: piece.x, y: piece.y, w: piece.w, h: piece.h, kind, b, lv: piece.level, hp: 0 };
    if (have.has(keyOf(prop))) continue;
    prop.hp = Math.max(1, Math.round(hpOf(kind, prop.w, prop.h, prop.lv!, !!t.boss) / 3));
    clearPatch(sim, prop.x, prop.y, prop.w, prop.h, kind === 'fence' || kind === 'gate' ? 0 : 1);
    if (kind !== 'gate' || prop.open === false) for (let j = 0; j < prop.h; j++) for (let i = 0; i < prop.w; i++) W.occ[(prop.y + j) * N + prop.x + i] = 1;
    t.props.push(prop); n++;
  }
  return n;
}

export function growCamp(sim: Sim, t: Tribe, level: number): number {
  if (t.state === 'destroyed' || level <= (t.built ?? 0)) return 0;
  const fire = t.props.find((p) => p.kind === 'fire');
  if (!fire) return 0;
  const W = sim.world, N = W.size;
  W.ensure(fire.x, fire.y, 16); // the land must exist before it can be judged
  const base = t.props.filter((p) => !planned(p)), old = new Map(t.props.filter(planned).map((p) => [keyOf(p), p] as const));
  const blocked = blockedBy(sim);
  const next: Prop[] = [...base];
  for (const piece of planPieces(sim, t, fire, level, base, blocked)) {
    const kind: Prop['kind'] = piece.kind === 'fence' || piece.kind === 'gate' || piece.kind === 'tower' ? piece.kind : 'house', b: BuildingKind | undefined = kind === 'house' ? piece.kind : undefined;
    const prop: Prop = { x: piece.x, y: piece.y, w: piece.w, h: piece.h, kind, b, lv: piece.level, hp: 0 };
    const was = old.get(keyOf(prop));
    if (was) { old.delete(keyOf(prop)); const lost = hpOf(kind, prop.w, prop.h, was.lv!, !!t.boss) - was.hp; was.lv = Math.max(was.lv!, piece.level); was.hp = Math.max(1, hpOf(kind, prop.w, prop.h, was.lv, !!t.boss) - lost); next.push(was); continue; }
    prop.hp = hpOf(kind, prop.w, prop.h, prop.lv!, !!t.boss);
    clearPatch(sim, prop.x, prop.y, prop.w, prop.h, kind === 'fence' || kind === 'gate' ? 0 : 1);
    next.push(prop);
  }
  for (const p of old.values()) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) W.occ[(p.y + j) * N + p.x + i] = 0;
  for (const p of next) if (p.kind !== 'gate' || p.open === false) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { const k = (p.y + j) * N + p.x + i; W.occ[k] = 1; if (p.kind === 'gate') W.foeGates.add(k); } // a gate is a gap in the fence while it is open
  t.props = next; t.built = level;
  return next.length - base.length;
}

/** The gates of a village shut (a wall) or open (a gap): they shut when we come at them in anger and open again when we are gone. */
export function setGates(sim: Sim, t: Tribe, shut: boolean): void {
  const N = sim.world.size;
  for (const p of t.props) {
    if (p.kind !== 'gate' || (p.open !== false) !== shut) continue;
    p.open = !shut;
    sim.addSfx(shut ? 'gate_shut' : 'gate_open', false, p.x, p.y);
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { const k = (p.y + j) * N + p.x + i; sim.world.occ[k] = shut ? 1 : 0; if (shut) sim.world.foeGates.add(k); else sim.world.foeGates.delete(k); } // the village's own people pass its shut gates
  }
}

const planPieces = (sim: Sim, t: Tribe, fire: Prop, level: number, base: Prop[], blocked: (r: { x: number; y: number; w: number; h: number }) => boolean) => (t.bandit ? planBandits(fire.x, fire.y, DIFF.capture.bandit.tents[t.tier as 'normal' | 'medium' | 'raider'] ?? 2, base, blocked) : planCamp(fire.x, fire.y, level, sim.era, sim.era === 'ancient' || !!t.boss, base, blocked));
