/** Creating villagers and living a day as one: hunger, health, sleep. */
import { DAY_LENGTH } from './constants';
import { BUILDINGS } from './buildings';
import { Stats, WorkJob, WORK_JOBS } from './jobs';
import { FOOD_NUTRITION } from './resources';
import { emptyToolSet, TOOL_OF_JOB } from './tools';
import { maxHpOf, MORALE, Team } from './combat';
import { brainPlayer, tickCommon, tickDown } from './battle';
import type { Sim } from './sim';
import { HAIR, NAMES_F, NAMES_M, SKIN, SLEEP_HUNGER, STAT_KEYS, Sex, Skill, Villager } from './model';

export function freshName(sim: Sim, sex: Sex, rnd: () => number): string {
  const pool = (sex === 'm' ? NAMES_M : NAMES_F).filter((n) => !sim.villagers.some((v) => v.name === n));
  const list = pool.length ? pool : sex === 'm' ? NAMES_M : NAMES_F;
  return list[Math.floor(rnd() * list.length)];
}

export function spawn(sim: Sim, x: number, y: number, sex: Sex): Villager {
  const v = makeVillager(sim, x, y, sex, 'player');
  sim.villagers.push(v); sim.byId.set(v.id, v);
  return v;
}

/** Build a unit without registering it: player villagers and tribal people share the same body. */
export function makeVillager(sim: Sim, x: number, y: number, sex: Sex, team: Team, rnd: () => number = sim.rnd): Villager {
  const r = rnd, pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const stats = {} as Stats;
  for (const k of STAT_KEYS) stats[k] = 3 + Math.floor(r() * 8);
  const potential = {} as Record<WorkJob, number>, skill = {} as Record<WorkJob, Skill>;
  for (const j of WORK_JOBS) {
    // hunting and fighting come from the body, not from a random draw, so earlier random streams stay the same
    if (j === 'hunt' || j === 'fight' || j === 'research' || j === 'tame') { const k = j === 'hunt' || j === 'tame' ? stats.agi : j === 'research' ? stats.int : stats.str; potential[j] = k >= 9 ? 3 : k >= 6 ? 2 : 1; skill[j] = { xp: 0, level: 0 }; continue; }
    const p = r(); potential[j] = p < 0.45 ? 1 : p < 0.85 ? 2 : 3; skill[j] = { xp: 0, level: 0 };
  }
  return {
    id: sim.nextVid++, name: freshName(sim, sex, rnd),
    look: { sex, skin: pick(SKIN), hair: pick(HAIR), hide: '#8b6a45', pants: '#3f63a8' },
    x: x + 0.5, y: y + 0.5, path: [], slide: null, facing: 'front', speed: 1.6 + 0.1 * stats.agi, animClock: 0, tx: -1, ty: -1,
    stats, potential, skill, tools: emptyToolSet(), job: 'idle', arm: 'foot', phase: 'idle', slot: 0, target: -1, prefer: -1, progress: 0, frac: 0, timer: 0, order: null,
    carry: null, fullness: 100, health: maxHpOf(stats.vit), starving: false, anim: 'idle', hold: null, bad: new Map(), bed: -1, post: -1, nightOwl: false, energy: 100, strain: 0, shift: 'day', torch: null, lockUntil: 0, lit: false, manualGear: false, inside: null, orderCd: 0, repairFor: null, squad: -1, born: { ...stats }, train: null, mount: null, breaks: null, gear: { w: null, wd: 0, wb: false, a: null, ad: 0, ab: false },
    team, maxHealth: maxHpOf(stats.vit), weapon: null, armor: null, morale: MORALE.start, stance: 'aggressive',
    fight: { mode: 'none', target: null, dest: null, anchor: null, repath: 0, scan: 0 }, queue: [], atkCd: 0, down: 0, rescue: 0, fleeT: 0, calm: 99, loot: -1, leader: false, swing: null, flinch: 0, ai: null,
  };
}

export function tickVillager(sim: Sim, v: Villager, dt: number): void {
  tickCommon(sim, v, dt);
  if (v.down > 0) { tickDown(sim, v, dt); sim.animate(v, dt); return; }
  // ---- nhu cầu ----
  v.fullness -= sim.dev.noHunger ? 0 : (dt * 100 * (v.phase === 'sleep' ? SLEEP_HUNGER : 1)) / DAY_LENGTH;
  if (v.fullness < 50 && sim.stock.food >= 2) {
    sim.stock.food -= 2; v.fullness = Math.min(100, v.fullness + 2 * FOOD_NUTRITION);
  }
  if (v.fullness <= 0) {
    if (!v.starving) { v.starving = true; sim.say(`${v.name} đói lả, kho hết thức ăn!`); }
    v.fullness = 0; v.health -= (dt * v.maxHealth) / (1.5 * DAY_LENGTH);
  } else {
    v.starving = false;
    if (v.fullness > 40 && v.health < v.maxHealth && v.calm > 10) v.health = Math.min(v.maxHealth, v.health + dt * 0.0015 * v.maxHealth);
  }
  if (v.health <= 0) { sim.kill(v); return; }
  v.orderCd = Math.max(0, v.orderCd - dt);
  sim.tickEnergy(v, dt);
  const held = sim.heldTool(v);
  if (held && TOOL_OF_JOB[v.job as WorkJob] !== held.k) sim.returnTool(v); // the job changed: the tool goes back with its wear
  // working inside a house: no walking, no fighting, nobody sees them; but worn out or off shift they come out and go to bed
  // (asleep in a bed is another thing: they stay in until rested, and a threat or the morning brings them out below)
  if (v.inside !== null && v.phase !== 'sleep') {
    const onWatch = v.job === 'fight' && v.post >= 0 && sim.tribes.some((t) => t.raid); // the garrison of a tower stays up while a raid is on
    if (sim.shouldSleep(v, onWatch)) { if (atWork(sim, v)) { v.phase = 'sleep'; v.facing = 'front'; } else { sim.exitBuilding(v); goHome(sim, v); } } else { sim.animate(v, dt); return; }
  }

  // ---- combat decides first: fighting, fleeing, rescuing, hunting ----
  const training = !!v.train && sim.trainStep(v, dt); // away at training: no work, no guard duty
  const brained = training ? false : brainPlayer(sim, v, dt);

  // ---- energy and sleep: worn out, or off shift, they sleep; a soldier in a fight fights on ----
  const fighting = brained && (v.phase === 'fight' || v.phase === 'flee' || v.phase === 'rescue');
  const asleep = v.phase === 'goHome' || v.phase === 'sleep';
  if (sim.shouldSleep(v, fighting)) { if (!asleep) goHome(sim, v); }
  else if (asleep) { if (atWork(sim, v) && v.phase === 'sleep') v.phase = 'inside'; else { sim.exitBuilding(v); v.path = []; v.slide = null; v.phase = 'idle'; v.bed = -1; } } // staff wake up at their bench

  sim.moveUnit(v, dt);
  if (Math.floor(v.x) !== v.tx || Math.floor(v.y) !== v.ty) sim.fogDirty = true;
  if (!v.path.length && !v.slide && !brained && !training) sim.think(v, dt);
  sim.animate(v, dt);
}

/** Inside the house they work in (on its staff list): they sleep there and keep their place. */
function atWork(sim: Sim, v: Villager): boolean {
  const b = v.inside === null ? undefined : sim.getBuilding(v.inside);
  return !!b && b.staff.includes(v.id);
}

/**
 * Go to bed: drop the current task (job kept) and walk to the Lều chiến binh (soldiers) or the Nhà dân (everyone else) while it has a
 * free bed; they go in and are listed there. Otherwise sleep on the ground by the campfire, one spot per villager, and rest slower.
 */
export function goHome(sim: Sim, v: Villager): void {
  const owl = v.nightOwl;
  sim.stash(v);
  sim.resetTask(v); v.nightOwl = owl;
  v.phase = 'sleep';
  const bed = v.job === 'build' ? sim.building('builder') ?? sim.freeBed(v) : sim.freeBed(v); // builders bunk in the Nhà thợ xây
  if (bed) {
    const bd = BUILDINGS[bed.kind];
    if (sim.routeTo(v, sim.ringTiles(v, bed.x, bed.y, bd.w, bd.h)) >= 0) { v.target = bed.id; v.phase = 'goHome'; return; }
  }
  const fire = sim.buildings.find((b) => b.kind === 'campfire');
  if (!fire) return;
  const d = BUILDINGS[fire.kind];
  const taken = new Set(sim.villagers.filter((o) => o !== v && o.bed >= 0).map((o) => o.bed));
  const spot = sim.nearestFree(fire.x + (d.w >> 1), fire.y + d.h, taken);
  if (!spot || sim.routeTo(v, [spot], 1) < 0) return; // unreachable: sleep where standing
  v.bed = spot[1] * sim.world.size + spot[0]; v.phase = 'goHome';
}

/** Every second: groups of five or more fighters get a leader, the best of them. */
export function pickLeaders(sim: Sim): void {
  const fighters = sim.villagers.filter((v) => v.job === 'fight' && v.health > 0 && v.down <= 0);
  for (const v of sim.villagers) v.leader = false;
  if (fighters.length >= 5) fighters.sort((a, b) => b.stats.str + b.stats.agi - a.stats.str - a.stats.agi)[0].leader = true;
}
