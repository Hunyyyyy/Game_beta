/**
 * Energy, sleep, shifts and torches. A villager has energy (sức) that work uses up and sleep gives back; night work needs a torch and goes
 * slower; soldiers fight on whatever their energy and sleep long afterwards; nobody can be worked night after night (strain).
 * All the numbers are in src/data/rest.json.
 */
import { drainScale } from './statsys';
import restJson from '../data/rest.json';
import { Building, levelDef } from './buildings';
import { DAY_LENGTH } from './constants';
import { SEASONS, sunTimes, TWILIGHT } from './calendar';
import { isStaffJob } from './jobs';
import { homeKind } from './idle';
import { awayScout } from './scouting';
import type { BuildingKind } from './buildings';
import type { Sim } from './sim';
import type { Villager } from './model';

export const REST = restJson;
/** Seconds of rest time (mid-dusk to mid-dawn) in an average night over the seasons. */
const NIGHT_AVG = DAY_LENGTH * SEASONS.reduce((n, s) => { const { rise, set } = sunTimes(s); return n + (rise - TWILIGHT / 2) + (1 - set - TWILIGHT / 2); }, 0) / SEASONS.length;
/** How long a new torch burns: two average nights (it only burns while its bearer is out in the dark). What burns is used up for good; a part-burnt torch goes back to the store and the next night's bearer takes it up. */
export const TORCH_LIFE = 2 * NIGHT_AVG;
/** Seconds of waking hours in a day and of night (the window the villagers sleep in). */
const DAY_HOURS = DAY_LENGTH * 0.65, NIGHT_HOURS = DAY_LENGTH * 0.35;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** 0..1: how sound the body is (Sức khỏe and Thể lực). */
const fit = (v: Villager): number => clamp((v.stats.vit + v.stats.sta) / 20, 0, 1);
const hpFrac = (v: Villager): number => clamp(v.health / v.maxHealth, 0, 1);

/** The most energy a villager can have: strain wears the ceiling down. */
export function maxEnergy(_sim: Sim, v: Villager): number { return 100 - v.strain * REST.strain.capLoss; }

/** Percentage points lost per second at the moment. */
export function drainRate(sim: Sim, v: Villager): number {
  if (v.phase === 'sleep' || v.phase === 'down') return 0;
  const w = (REST.jobWeight as Record<string, number>)[v.job] ?? REST.jobWeight.idle;
  let k: number;
  switch (v.phase) {
    case 'work': case 'build': case 'craft': case 'inside': case 'skin': k = w; break;
    case 'fight': k = w * 1.8; break;
    case 'flee': k = 1.2; break;
    case 'idle': case 'wait': k = REST.jobWeight.idle; break;
    case 'goHome': k = 0.3; break;
    default: k = w * 0.8; // on the way somewhere
  }
  const cond = (1.25 - 0.25 * fit(v)) * (1.3 - 0.3 * hpFrac(v));
  return (REST.dayCost / DAY_HOURS) * k * cond * drainScale(sim, v);
}

// ---------------------------------------------------------------- beds
/** Houses whose level also says how well people rest in them: the camp of each arm for its soldiers and the Nhà dân (any other house with beds is as good as a plain Nhà dân). */
export type BedKind = 'infantry' | 'cavalry' | 'archery' | 'house';
export const BED_KINDS: readonly BedKind[] = ['infantry', 'cavalry', 'archery', 'house'];
/** Every house a villager can sleep in: the house of each trade, the camps, the builders' house and the Nhà dân. Where one sleeps: `homeKind` in idle.ts. */
export const SLEEP_HOUSES: readonly BuildingKind[] = ['house', 'builder', 'lumberyard', 'quarry', 'farmhouse', 'huntlodge', 'scouttent', 'infantry', 'cavalry', 'archery'];

/** Beds of a house in use: those asleep inside and those on their way. */
export function bedsTaken(sim: Sim, b: Building, except?: Villager): number {
  return sim.villagers.filter((o) => o !== except && ((o.phase === 'sleep' && o.inside === b.id) || (o.phase === 'goHome' && o.target === b.id))).length;
}

/** Where the villager sleeps: the nearest finished house of the right kind with a free bed, or nothing (they sleep by the campfire). */
export function freeBed(sim: Sim, v: Villager): Building | undefined {
  const kind = homeKind(v);
  let best: Building | undefined, bd = Infinity;
  for (const b of sim.buildings) {
    if (b.kind !== kind || !b.done || bedsTaken(sim, b, v) >= levelDef(b).slots) continue;
    const d = Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** How well the place they sleep in lets them rest: the house they are inside (and its level), else the campfire's slower rest. */
function bedFactor(sim: Sim, v: Villager): number {
  const b = v.inside === null ? undefined : sim.getBuilding(v.inside);
  if (b && (BED_KINDS as readonly string[]).includes(b.kind)) return REST.sleepAt[b.kind as BedKind] * levelDef(b).craftSpeed;
  return b ? REST.sleepAt.house : REST.sleepAt.campfire; // a bunk in the workplace is as good as a plain house
}

/** Percentage points gained per second while asleep. Night sleep is twice as good as sleep by day. */
export function sleepRate(sim: Sim, v: Villager): number {
  if (civilian(v) && attackReason(sim) !== null) return 0; // no rest while the village is attacked
  const base = (sim.resting ? REST.sleepNight : REST.sleepDay) / NIGHT_HOURS;
  const q = (0.8 + 0.4 * fit(v)) * (0.7 + 0.3 * hpFrac(v)) * Math.max(0.3, 1 - v.strain * REST.strain.recoveryLoss);
  return base * q * bedFactor(sim, v);
}

// ---------------------------------------------------------------- an attack on the village
const attackCache = new WeakMap<Sim, { t: number; why: string | null }>();
/**
 * Why the village counts as under attack right now, or null: a tribe's raid has marched in, or beasts are fighting people near the fire.
 * Worked out once a tick, for everyone who asks.
 */
export function attackReason(sim: Sim): string | null {
  const c = attackCache.get(sim);
  if (c && c.t === sim.time) return c.why;
  let why: string | null = null;
  const raid = sim.tribes.find((t) => t.raid && t.raid.phase === 'march');
  if (raid) why = `${raid.def.name} đang tiến vào làng`;
  else {
    const fire = sim.campfire(), cx = fire ? fire.x + 1 : sim.world.start.x, cy = fire ? fire.y + 1 : sim.world.start.y;
    const beast = sim.animals.find((a) => a.state === 'attack' && a.target?.kind === 'unit' && Math.hypot(a.x - cx, a.y - cy) < 30);
    if (beast) why = 'Thú dữ đang tấn công người gần làng';
  }
  attackCache.set(sim, { t: sim.time, why });
  return why;
}

/** Whoever is not a fighter (soldier, hunter, scout). */
const civilian = (v: Pick<Villager, 'job'>): boolean => v.job !== 'fight' && v.job !== 'hunt' && v.job !== 'scout';

/**
 * Under attack the people lying in a house keep their heads down: they do not rest, they do not come out when morning comes, and nothing wakes them
 * to run. Only a fighter leaves: a villager the player makes a soldier or a hunter goes out at once.
 */
export function hides(sim: Sim, v: Villager): boolean {
  return v.inside !== null && v.phase === 'sleep' && civilian(v) && attackReason(sim) !== null;
}

/** Asleep and not to be woken: they fell asleep worn out and have not rested enough yet. */
export function sleepLocked(sim: Sim, v: Villager): boolean {
  if (hides(sim, v)) return false; // they are not asleep, they are hiding: the player may give them work (a soldier's or a hunter's) at any time
  return v.lockUntil > 0 && v.energy < v.lockUntil && (v.phase === 'sleep' || v.phase === 'goHome');
}

/** How well a villager works right now: the night, and being tired, both slow it. 1 in full daylight with energy to spare. */
export function restFactor(sim: Sim, v: Villager): number {
  const night = sim.resting ? REST.nightEfficiency : 1;
  const tired = v.energy >= REST.tiredBelow ? 1 : REST.tiredEfficiency + (1 - REST.tiredEfficiency) * (v.energy / REST.tiredBelow);
  return night * tired;
}

// ---------------------------------------------------------------- torches
/** Torches in the store (the stock keeps them with the other things the craft house makes). */
export function torchCount(sim: Sim): number { return (sim.toolStock.torch1 ?? 0) + sim.wornTools.filter((w) => w.id === 'torch1' && w.dur > 0).length; }

/** Put a torch in the villager's hand from the store. Returns whether they have one. */
export function ensureTorch(sim: Sim, v: Villager): boolean {
  if (v.torch) return true;
  if ((sim.toolStock.torch1 ?? 0) > 0) { sim.toolStock.torch1--; v.torch = { dur: TORCH_LIFE }; return true; }
  let best = -1;
  sim.wornTools.forEach((w, i) => { if (w.id === 'torch1' && w.dur > 0 && (best < 0 || w.dur > sim.wornTools[best].dur)) best = i; });
  if (best >= 0) { v.torch = { dur: sim.wornTools.splice(best, 1)[0].dur }; return true; }
  return false;
}

/** At dawn or when the shift ends a torch that still has life goes back to the store. */
export function returnTorch(sim: Sim, v: Villager): void {
  const t = v.torch; if (!t) return;
  v.torch = null;
  if (t.dur <= 5) return;
  if (t.dur >= TORCH_LIFE - 1) sim.toolStock.torch1 = (sim.toolStock.torch1 ?? 0) + 1; else sim.wornTools.push({ id: 'torch1', dur: t.dur });
}

/** The player hands torches out. Returns an error or null. */
export function giveTorch(sim: Sim, ids: readonly number[]): string | null {
  let short = false, given = 0;
  for (const v of sim.mine(ids)) { if (v.torch) continue; if (ensureTorch(sim, v)) { given++; sim.say(`${v.name} cầm đuốc.`); } else short = true; }
  return short && !given ? 'Kho hết đuốc, hãy chế thêm ở Nhà chế tạo' : null;
}

// ---------------------------------------------------------------- shifts
/** Whether the villager's shift has them up right now (before torches and tiredness are looked at). */
export function onShift(sim: Sim, v: Villager): boolean {
  if (v.nightOwl) return true; // called up by the player or the alarm until the shift changes
  if (v.job === 'fight' && sim.warLock()) return true; // in a war the army is on its feet, night or day
  const night = sim.resting;
  if (v.job === 'idle') return v.shift === 'both' || !night; // a free villager is on his feet by day only, unless he was sent out by hand
  if (v.job === 'fight') return !night;
  if (v.shift === 'both') return true;
  return v.shift === 'night' ? night : !night;
}

/** Posted to a house to work inside it (craft, research, tame, a Ruộng) or crew of the Nhà thợ xây's own roof. */
const indoors = (v: Villager): boolean => isStaffJob(v.job) || (v.job === 'food' && v.post >= 0);

/** Whether the villager should be up and working: on shift, and at night with a torch (soldiers on watch need none). */
export function onDuty(sim: Sim, v: Villager): boolean {
  if (!onShift(sim, v)) return false;
  if (sim.resting && v.job !== 'fight' && v.job !== 'idle' && !indoors(v)) return ensureTorch(sim, v); // under a roof the night needs no torch
  return true;
}

/**
 * The player's order reaches a villager who is off shift: soldiers get up to stand watch; others get up too if they can work (a night
 * order needs a torch). Returns false when the order has to wait for the shift.
 */
export function callUp(sim: Sim, v: Villager): boolean {
  if (sleepLocked(sim, v) || v.energy < REST.tired) return false;
  if (onShift(sim, v)) return true;
  if (v.job === 'fight') { v.nightOwl = true; return true; }
  if (v.job === 'idle') return false;
  if (sim.resting && !ensureTorch(sim, v)) return false;
  v.nightOwl = true; return true;
}

// ---------------------------------------------------------------- one tick
/** Energy, strain and the torch for one villager. */
export function tickEnergy(sim: Sim, v: Villager, dt: number): void {
  const top = maxEnergy(sim, v);
  if (v.phase === 'sleep') {
    v.energy = Math.min(top, v.energy + sleepRate(sim, v) * dt);
    v.strain = Math.max(0, v.strain - (sim.resting ? REST.strain.nightSleep : REST.strain.daySleep) * dt);
  } else if (!sim.dev.noTire && !(v.job === 'fight' && sim.warLock()) && !awayScout(sim, v)) {
    const working = v.job !== 'idle' && (v.phase === 'work' || v.phase === 'build' || v.phase === 'craft' || v.phase === 'inside' || v.phase === 'fight');
    v.energy = Math.max(0, v.energy - drainRate(sim, v) * dt);
    if (sim.resting && working) { v.strain = Math.min(100, v.strain + REST.strain.nightWork * dt); }
  }
  if (v.energy > top) v.energy = top;
  if (v.torch && sim.resting && v.phase !== 'sleep') {
    v.torch.dur -= dt;
    if (v.torch.dur <= 0) { v.torch = null; sim.say(`Đuốc của ${v.name} đã cháy hết.`); }
  }
}

/**
 * Should the villager be asleep now? Worn out, they sleep and cannot be woken until rested; off shift they sleep (and may be called up);
 * a soldier in a fight fights on whatever his energy.
 */
export function shouldSleep(sim: Sim, v: Villager, fighting: boolean): boolean {
  if (fighting) return false;
  if (awayScout(sim, v)) { v.lockUntil = 0; return false; } // a scout on a trip works day and night until the map is drawn and he is home
  if (v.job === 'fight' && sim.warLock()) { v.lockUntil = 0; return false; } // soldiers do not sleep while a war is on
  if (v.lockUntil > 0) {
    if (v.energy >= v.lockUntil) v.lockUntil = 0; else return true;
  }
  if (v.energy < REST.tired) {
    const collapse = v.energy < REST.collapse;
    v.lockUntil = collapse ? REST.wakeAfterCollapse : REST.wakeAfterTired;
    if (collapse) v.strain = Math.min(100, v.strain + REST.strain.collapse);
    sim.say(`${v.name} ${collapse ? 'kiệt sức, ngã xuống ngủ say' : 'mệt, đi ngủ'}.`);
    return true;
  }
  return !onDuty(sim, v);
}

/** Beds in all the finished houses of a kind (0 when there is none). */
export function bedsIn(sim: Sim, kind: BuildingKind): number { return sim.buildings.reduce((n, b) => n + (b.kind === kind && b.done ? levelDef(b).slots : 0), 0); }
