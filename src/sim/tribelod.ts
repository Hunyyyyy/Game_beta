/**
 * How much of a village is really there. A village that nobody is near is only data: its level, and a head count in `tribe.crowd` (people not in the world).
 * When our people come near (the chunks of `sim.active`), or a raid or a war needs it, it wakes: the houses are laid (tribebuild.growCamp) and as many people
 * come out as its houses hold at work (the slots of the wood, stone, field, guard and hunting houses, in the building json); the rest stay "indoors" as the crowd.
 * They come out when the houses fall, or for a raid. With nobody near for a while it goes back to sleep.
 */
import npc from '../data/npclife.json';
import cfg from '../content/difficulty.json';
import { BuildingKind, levelsOf, POP_BY_FIRE } from './buildings';
import { WEAPONS } from './combat';
import { soldierTier } from './research';
import { DIFF, tribeBonuses } from './difficulty';
import { powerOf, Power } from './power';
import { applyStats } from './statsys';
import { slotsAt } from './campplan';
import { growCamp, setGates } from './tribebuild';
import { isActive } from './tribework';
import type { FoeAI } from './model';
import type { Sim, Villager } from './sim';
import type { Tribe } from './tribes';

const LOD = npc.lod;
const CIVIL_HOUSES: BuildingKind[] = ['lumberyard', 'quarry', 'farmhouse'], GUARD_HOUSES: BuildingKind[] = ['guardpost', 'huntlodge', 'tower'];

export const fireLevelOf = (sim: Sim): number => sim.campfire()?.level ?? 1;
const crowdOf = (t: Tribe): NonNullable<Tribe['crowd']> => (t.crowd ??= { guards: 0, civs: 0 });

/** Everyone of a tribe who is alive: those in the world and the crowd. */
export function headcount(sim: Sim, t: Tribe): { guards: number; civs: number } {
  let guards = t.crowd?.guards ?? 0, civs = t.crowd?.civs ?? 0;
  for (const u of t.unitIds) { const f = sim.get(u); if (!f || f.health <= 0) continue; if (f.ai?.role === 'civ') civs++; else guards++; }
  return { guards, civs };
}

/**
 * The people its campfire holds at its level, and how many of them fight: the proportion of tribes.json, or as many as its guard houses hold (to stand a watch and show
 * the strength of the village), whichever is more, but never more than `lod.maxGuardShare` of the people.
 */
const targetsOf = (sim: Sim, t: Tribe): { total: number; fighters: number } => {
  const total = Math.round(POP_BY_FIRE[Math.max(0, Math.min(POP_BY_FIRE.length, t.campLevel) - 1)] * (t.boss ? DIFF.boss.popMult : 1));
  const ratio = Math.round((total * t.def.warriors) / (t.def.warriors + t.def.civilians)), posts = slotsAt(GUARD_HOUSES, t.campLevel, sim.era, sim.advanced || !!t.boss);
  return { total, fighters: Math.max(2, Math.min(Math.max(ratio, posts), Math.floor(total * LOD.maxGuardShare))) };
};

/** Work out the percent its people need (difficulty.tribeBonuses) and put it on the bodies of those in the world. */
export function rescaleTribe(sim: Sim, t: Tribe): void {
  const hc = headcount(sim, t), b = tribeBonuses(fireLevelOf(sim), t.def, t.k, hc.guards, hc.civs, !!t.boss);
  t.mil = b.mil; t.eco = b.eco; t.seenFire = fireLevelOf(sim);
  for (const u of t.unitIds) { const f = sim.get(u); if (f) applyStats(sim, f); }
}

/** The power of a village: those in the world, and the crowd counted at the worth of the average of its kind. */
export function tribePower(sim: Sim, t: Tribe): Power {
  const p = powerOf(sim, t.unitIds.map((u) => sim.get(u)).filter((u): u is Villager => !!u));
  const g = t.crowd?.guards ?? 0, c = t.crowd?.civs ?? 0;
  if (g > 0 && p.soldiers > 0) { p.military += (p.military / p.soldiers) * g; p.soldiers += g; }
  if (c > 0 && p.workers > 0) { p.economy += (p.economy / p.workers) * c; p.workers += c; }
  p.total = cfg.power.economy * p.economy + cfg.power.military * p.military;
  return p;
}

/** The people the campfire holds at the level, short of those alive, are added to the crowd (a village grown, or new). */
export function topUp(sim: Sim, t: Tribe): void {
  const hc = headcount(sim, t), { total, fighters } = targetsOf(sim, t), crowd = crowdOf(t);
  crowd.guards += Math.max(0, fighters - hc.guards);
  crowd.civs += Math.max(0, total - fighters - hc.civs);
  t.popLevel = t.campLevel;
}

/** The houses of the camp are laid (data only: no people), if they are not yet; the land round it is stocked once. */
export function ensureLayout(sim: Sim, t: Tribe): void {
  growCamp(sim, t, t.campLevel);
  if (!t.seeded) { t.seeded = true; stockLand(sim, t); }
}

/** A few trees, rocks and bushes are set on the open ground round a village (npclife.json "seed") so that its people have something to work at: up to the number given, counting those already there. */
function stockLand(sim: Sim, t: Tribe): void {
  const { minR, maxR } = npc.seed, W = sim.world, N = W.size, cx = Math.floor(t.camp.x), cy = Math.floor(t.camp.y);
  W.ensure(cx, cy, maxR + 4);
  const have: Record<string, number> = { tree: 0, rock: 0, bush: 0 };
  for (let y = cy - maxR; y <= cy + maxR; y++) for (let x = cx - maxR; x <= cx + maxR; x++) {
    const n = W.inBounds(x, y) ? W.nodes.get(y * N + x) : undefined;
    if (n && Math.hypot(x - t.camp.x, y - t.camp.y) <= maxR) have[n.kind]++;
  }
  for (const kind of ['rock', 'tree', 'bush'] as const) {
    for (let need = npc.seed[kind] - have[kind], tries = 0; need > 0 && tries < 200; tries++) {
      const a = sim.frnd() * Math.PI * 2, r = minR + sim.frnd() * (maxR - minR);
      if (W.plant(kind, Math.floor(t.camp.x + Math.cos(a) * r), Math.floor(t.camp.y + Math.sin(a) * r))) need--;
    }
  }
}

// ---------------------------------------------------------------- people in the world
/** How many may work in the open: the slots of its working houses (building json), but a few always. */
function visibleCap(sim: Sim, t: Tribe): { guards: number; civs: number } {
  let guards = 0, civs = 0;
  for (const p of t.props) {
    if (p.kind === 'tower') guards += towerSlots(sim, p);
    if (!p.b) continue;
    const slots = levelsOf(p.b, sim.era)[(p.lv ?? 1) - 1]?.slots ?? 0;
    if (CIVIL_HOUSES.includes(p.b)) civs += slots; else if (GUARD_HOUSES.includes(p.b)) guards += slots;
  }
  return { guards: Math.max(LOD.minGuards, guards), civs: Math.max(LOD.minCivs, civs) };
}

/** A free tile in the yard, or the one nearest to `near`. */
function freeSpot(sim: Sim, near: { x: number; y: number }, rmin: number, rspan: number): [number, number] {
  for (let tries = 0; tries < 24; tries++) {
    const ang = sim.frnd() * Math.PI * 2, r = rmin + sim.frnd() * rspan, px = Math.floor(near.x + Math.cos(ang) * r), py = Math.floor(near.y + Math.sin(ang) * r);
    if (!sim.world.isBlocked(px, py)) return [px, py];
  }
  return sim.nearestFree(Math.floor(near.x), Math.floor(near.y), new Set()) ?? [Math.floor(near.x), Math.floor(near.y)];
}

// ---------------------------------------------------------------- the watch
type Post = NonNullable<FoeAI['post']>;
/** How many archers a tower holds (the slots of its level in the building json). */
const towerSlots = (sim: Sim, tw: { lv?: number }): number => levelsOf('tower', sim.era)[(tw.lv ?? 1) - 1]?.slots ?? 0;

/** The archers of a tower: they stand in it (at its inner foot) with bows, and loose arrows from it (tribes.foeBrain). Returns how many came out. */
function spawnTowerMen(sim: Sim, t: Tribe, tw: Tribe['props'][number], n: number): number {
  const crowd = crowdOf(t), taken = new Set<number>(), cx = tw.x + tw.w / 2, cy = tw.y + tw.h / 2, dx = t.camp.x - cx, dy = t.camp.y - cy, len = Math.max(1, Math.hypot(dx, dy));
  const men: Villager[] = [];
  for (let i = 0; i < n && crowd.guards > 0; i++) {
    const post = postAt(sim, t, cx + (dx / len) * (2 + i * 0.8), cy + (dy / len) * (2 + i * 0.8), taken);
    if (!post) break;
    crowd.guards--;
    const f = sim.makeVillager(post.x, post.y, sim.frnd() < 0.5 ? 'm' : 'f', t.id, sim.frnd);
    f.look.hide = t.def.look.hide; f.look.pants = t.def.look.pants;
    f.weapon = 'bow'; f.armor = gearFor(sim, t, t.unitIds.length + i).armor; f.facing = post.face;
    f.ai = { role: 'guard', camp: t.camp, wander: 0, goal: null, raid: 0, post, tower: { x: tw.x, y: tw.y } };
    sim.addFoe(f); t.unitIds.push(f.id); men.push(f);
  }
  if (men.length) { rescaleTribe(sim, t); for (const f of men) f.health = f.maxHealth; }
  return men.length;
}
/** A free tile at or near a point, looking away from the fire. */
function postAt(sim: Sim, t: Tribe, x: number, y: number, taken: Set<number>): Post | null {
  const spot = sim.nearestFree(Math.floor(x), Math.floor(y), taken);
  if (!spot) return null;
  taken.add(spot[1] * sim.world.size + spot[0]);
  const dx = spot[0] + 0.5 - t.camp.x, dy = spot[1] + 0.5 - t.camp.y;
  return { x: spot[0], y: spot[1], face: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back' };
}

/**
 * Where `n` guards stand: a pair inside each gate, two by the fire, and the rest spread along the fence (npclife.json lod.postEvery at the nearest),
 * each a little inside the wall and looking out.
 */
function postsOf(sim: Sim, t: Tribe, n: number): Post[] {
  const out: Post[] = [], taken = new Set<number>(), add = (x: number, y: number) => { if (out.length < n) { const p = postAt(sim, t, x, y, taken); if (p) out.push(p); } };
  const inward = (p: { x: number; y: number; w: number; h: number }, k: number): [number, number] => {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, dx = t.camp.x - cx, dy = t.camp.y - cy, len = Math.max(1, Math.hypot(dx, dy));
    return [cx + (dx / len) * k, cy + (dy / len) * k];
  };
  for (const g of t.props.filter((p) => p.kind === 'gate')) { const [x, y] = inward(g, 1.5); add(x - 2, y); add(x + 2, y); }
  add(t.camp.x - 2.5, t.camp.y + 0.5); add(t.camp.x + 2.5, t.camp.y + 0.5);
  const fence = t.props.filter((p) => p.kind === 'fence').sort((a, b) => Math.atan2(a.y - t.camp.y, a.x - t.camp.x) - Math.atan2(b.y - t.camp.y, b.x - t.camp.x));
  const stride = Math.max(LOD.postEvery, Math.floor(fence.length / Math.max(1, n - out.length)));
  for (let i = 0; i < fence.length && out.length < n; i += stride) { const [x, y] = inward(fence[i], 1.5); add(x, y); }
  return out;
}

// ---------------------------------------------------------------- arms
const ARMOR_LADDER = [null, 'hide', 'bone'] as const;
/** The best tier of soldiers the player has researched: the arms of the villages keep pace with it. */
const playerTier = (sim: Sim): number => Math.max(...['foot', 'archer', 'cavalry'].map((r) => soldierTier(sim.researched, r)));

/**
 * The arms of the `index`-th soldier of a village. A common village arms from its own weapons up to the tier the player has reached, plus one step once its camp is high
 * (a village keeps what makes it itself even when that is above the cap), and wears the better armour as the camp grows. A boss gives bronze to `boss.bronzeShare` of its
 * soldiers (and bronze armour to the same ones), and the best of the common arms to the rest.
 */
export function gearFor(sim: Sim, t: Tribe, index: number): { weapon: string; armor: string | null } {
  const own = t.def.weapons, lowest = Math.min(...own.map((w) => WEAPONS[w]?.tier ?? 1));
  const cap = Math.max(lowest, Math.min(2, playerTier(sim) + (t.campLevel >= 3 ? 1 : 0)));
  const pool = own.filter((w) => (WEAPONS[w]?.tier ?? 1) <= cap), weapons = pool.length ? pool : own;
  const step = Math.min(ARMOR_LADDER.length - 1, (t.campLevel >= 4 ? 2 : t.campLevel >= 3 ? 1 : 0) + (t.def.armor ? 1 : 0)), common = ARMOR_LADDER[step];
  if (t.boss && (index * 0.618034) % 1 < DIFF.boss.bronzeShare) return { weapon: DIFF.boss.weapons[index % DIFF.boss.weapons.length], armor: 'bronze' };
  return { weapon: weapons[index % weapons.length], armor: t.boss ? 'bone' : common };
}

/** Bring `n` of the crowd out into the world, soldiers or civilians, at `near`. Returns those who came. */
function spawnOut(sim: Sim, t: Tribe, role: 'guard' | 'civ', n: number, near: { x: number; y: number }, rmin: number, rspan: number, posts: Array<NonNullable<FoeAI['post']>> = []): Villager[] {
  const crowd = crowdOf(t), out: Villager[] = [], key = role === 'civ' ? 'civs' : 'guards';
  let armed = t.unitIds.filter((u) => { const f = sim.get(u); return !!f && f.ai?.role !== 'civ'; }).length;
  for (; n > 0 && crowd[key] > 0; n--) {
    crowd[key]--;
    const post = role === 'guard' ? posts.shift() : undefined, [x, y] = post ? [post.x, post.y] : freeSpot(sim, near, rmin, rspan), f = sim.makeVillager(x, y, sim.frnd() < 0.5 ? 'm' : 'f', t.id, sim.frnd);
    f.look.hide = t.def.look.hide; f.look.pants = t.def.look.pants;
    if (role === 'guard') { const g = gearFor(sim, t, armed); f.weapon = g.weapon; f.armor = g.armor; armed++; }
    f.ai = { role, camp: t.camp, wander: sim.frnd() * 5, goal: null, raid: 0, post };
    if (post) f.facing = post.face;
    sim.addFoe(f); t.unitIds.push(f.id); out.push(f);
  }
  if (out.length) { rescaleTribe(sim, t); for (const f of out) f.health = f.maxHealth; }
  return out;
}

/** The village stirs: its houses are laid, and as many come out as work in the open. */
export function wake(sim: Sim, t: Tribe): void {
  if (t.awake || t.state === 'destroyed' || t.state === 'adopted') return;
  ensureLayout(sim, t);
  t.awake = true; t.idleT = 0;
  const cap = visibleCap(sim, t), crowd = crowdOf(t);
  let out = Math.min(crowd.guards, cap.guards);
  for (const tw of t.props.filter((p) => p.kind === 'tower')) out -= spawnTowerMen(sim, t, tw, Math.min(out, towerSlots(sim, tw))); // the towers are manned first
  spawnOut(sim, t, 'guard', out, t.camp, 2.5, 3.5, postsOf(sim, t, out));
  spawnOut(sim, t, 'civ', Math.min(crowd.civs, cap.civs), t.camp, 2.5, 3.5);
  t.pool0 = standing(t); t.hid0 = crowd.guards + crowd.civs;
  const live = t.unitIds.map((u) => sim.get(u)).filter((u): u is Villager => !!u && u.health > 0);
  if (!t.leaderDead && !live.some((u) => u.id === t.leaderId)) {
    const lead = live.filter((u) => u.ai?.role === 'guard').sort((a, b) => b.stats.str + b.stats.vit - a.stats.str - a.stats.vit)[0];
    if (lead) { lead.leader = true; t.leaderId = lead.id; }
  }
}

/** Everyone in the world goes back indoors as the crowd (raiders out on a raid stay out). */
export function sleep(sim: Sim, t: Tribe): void {
  const crowd = crowdOf(t);
  for (const u of [...t.unitIds]) {
    const f = sim.get(u);
    if (!f) continue;
    if (f.health <= 0 || f.ai?.role === 'raider') continue;
    if (f.ai?.role === 'civ') crowd.civs++; else crowd.guards++;
    if (f.ai?.life) f.ai.life = undefined;
    sim.removeFoe(f);
  }
  t.unitIds = t.unitIds.filter((u) => !!sim.get(u));
  t.awake = false; t.idleT = 0;
  if (!sim.get(t.leaderId)) t.leaderId = -1;
}

/** Soldiers (then civilians) come out of the houses at the spot `near`; returns how many came. */
export function releaseCrowd(sim: Sim, t: Tribe, n: number, near: { x: number; y: number } = t.camp): number {
  const crowd = crowdOf(t), g = spawnOut(sim, t, 'guard', Math.min(n, crowd.guards), near, 1.5, 2.5).length;
  return g + spawnOut(sim, t, 'civ', Math.min(n - g, crowd.civs), near, 1.5, 2.5).length;
}

/** Houses and fire that stand: the shelter the crowd has. */
const standing = (t: Tribe): number => t.props.filter((p) => p.kind === 'house' || p.kind === 'fire').length;

// ---------------------------------------------------------------- the camp follows the player's
/** The camp grows with the player's: its level is the player's fire plus its `edge` (never lower than it was, never past the top). A village asleep is only told its new level; one awake is sent back indoors, laid again and let out. */
export function followFire(sim: Sim, t: Tribe): void {
  t.campLevel = Math.max(t.campLevel, Math.min(DIFF.campLevel.max, fireLevelOf(sim) + (t.edge ?? 0)));
  if (t.popLevel === t.campLevel) return;
  const was = !!t.awake;
  if (was) sleep(sim, t);
  topUp(sim, t);
  if (was) wake(sim, t);
}

// ---------------------------------------------------------------- once a second
/** Wake, sleep and let out. `hostile`: it is at odds with us. `busy`: a raid, a war or an attack plan needs it awake. */
export function tickLod(sim: Sim, t: Tribe, busy: boolean, hostile: boolean): void {
  if (t.crowd === undefined) { t.crowd = { guards: 0, civs: 0 }; t.awake = true; t.popLevel = t.campLevel; t.idleT = 0; t.hid0 = 0; t.pool0 = 1; } // an old save: everyone is in the world
  const near = isActive(sim, t.camp.x, t.camp.y);
  if (!t.awake) { if (near || busy) wake(sim, t); return; }
  if ((t.built ?? 0) < t.campLevel) ensureLayout(sim, t);
  const fighting = t.unitIds.some((u) => { const f = sim.get(u); return !!f && (!!f.fight.target || f.phase === 'fight'); });
  if (near || busy || fighting || t.raid) t.idleT = 0;
  else if ((t.idleT = (t.idleT ?? 0) + 1) >= LOD.sleepAfter) { sleep(sim, t); return; }
  // the gates shut when we are at their door in anger, and open again when we are gone
  const r = LOD.gateRadius, atDoor = sim.villagers.some((v) => v.health > 0 && Math.abs(v.x - t.camp.x) < r && Math.abs(v.y - t.camp.y) < r);
  setGates(sim, t, hostile && atDoor || busy);
  // the crowd keeps only as much as its houses can shelter: as they fall, people come out to fight
  const crowd = crowdOf(t), hidden = crowd.guards + crowd.civs;
  if (hidden > 0 && (t.hid0 ?? 0) > 0) {
    const keep = Math.ceil((t.hid0 ?? 0) * Math.min(1, standing(t) / Math.max(1, t.pool0 ?? 1)));
    if (hidden > keep) {
      const homes = t.props.filter((p) => p.kind === 'house'), h = homes.length ? homes[Math.floor(sim.frnd() * homes.length)] : null;
      releaseCrowd(sim, t, hidden - keep, h ? { x: h.x + h.w / 2, y: h.y + h.h + 1 } : t.camp);
    }
  }
}
