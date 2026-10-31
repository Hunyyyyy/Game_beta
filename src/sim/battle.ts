import animsJson from '../data/anims.json';
import { ANIMALS, ARMORS, ArmorDef, CRAFTED_WEAPONS, cycleOf, damageOf, DmgType, RULES, Team, TRIBES, WeaponDef, WEAPONS } from './combat';
import { WEATHER } from './calendar';
import { gameDays } from './constants';
import { Arm, armOfWeapon, clampTactical, matchup, UNIT_RULES } from './formations';
import { Animal, animalDef, die as animalDie, provoke, carcassEmpty } from './fauna';
import { CARRY_CAP, Res, RES_NAME } from './resources';
import type { Sim, Target, Villager } from './sim';
import { hash2 } from './rng';
import type { Step } from './path';
import { critChance, critMult, guardCut, swingCycle, weaponDamage } from './statsys';
import { BEHAVIOUR } from './combat';

const ANIM = animsJson as unknown as Record<string, { fps: number; frames: unknown[]; hit?: number }>;
/** When, inside an attack animation, the blow lands and when it ends (seconds). */
export function swingTimes(anim: string): { hitAt: number; end: number } {
  const a = ANIM[anim];
  return { hitAt: (a?.hit ?? 2) / (a?.fps ?? 10), end: (a?.frames.length ?? 6) / (a?.fps ?? 10) };
}

// ---------------------------------------------------------------- entities
export type Ent = { kind: 'unit'; v: Villager } | { kind: 'animal'; a: Animal };
export const entX = (e: Ent) => (e.kind === 'unit' ? e.v.x : e.a.x);
export const entY = (e: Ent) => (e.kind === 'unit' ? e.v.y : e.a.y);

/** The living thing a target points at, or null when it is gone, dead or lying wounded. */
export function resolve(sim: Sim, t: Target | null): Ent | null {
  if (!t) return null;
  if (t.kind === 'unit') { const v = sim.get(t.id); return v && v.health > 0 && v.down <= 0 ? { kind: 'unit', v } : null; }
  const a = sim.animalById.get(t.id);
  return a && a.state !== 'dead' ? { kind: 'animal', a } : null;
}

/** The weapon that counts: a broken one is no better than fists until it is mended. */
export const effWeapon = (v: Villager): string | null => (v.team === 'player' && v.gear.wb && v.gear.w === v.weapon ? null : v.weapon);
/** The arm of a unit: a rider of ours counts as cavalry whatever he carries, anyone else by his weapon. */
export const armOf = (v: Villager): Arm => (v.team === 'player' && v.job === 'fight' && (v.arm === 'cavalry' || v.mount) ? 'cavalry' : armOfWeapon(effWeapon(v)));
export const weaponOf = (v: Villager): WeaponDef => WEAPONS[effWeapon(v) ?? 'fist'] ?? WEAPONS.fist;
const armorOf = (v: Villager): ArmorDef | null => (v.armor && !(v.team === 'player' && v.gear.ab && v.gear.a === v.armor) ? ARMORS[v.armor] ?? null : null);
/** Can this unit's side see the spot? Our own people shoot only at what they can see; the foe has no fog. */
export function canSee(sim: Sim, v: Villager, x: number, y: number): boolean {
  return v.team !== 'player' || sim.fog.state[Math.floor(y) * sim.world.size + Math.floor(x)] === 2;
}
export const isFighter = (v: Villager) => v.job === 'fight' || v.job === 'hunt' || v.fight.mode !== 'none';

export function teamsHostile(sim: Sim, a: Team, b: Team): boolean {
  if (a === b || a === 'wild' || b === 'wild') return false;
  if (a === 'player') return sim.tribeHostile(b);
  if (b === 'player') return sim.tribeHostile(a);
  return false; // tribes do not fight each other
}

export interface Threat { t: Target; x: number; y: number; d: number; name: string }

/** Enemies of `v` within `radius`, nearest first. Player units only notice what they can see. */
/** Tiles on a side of a cell of the grid that finds who is near whom. */
const CELL = 8;
/** The units of one side sorted into cells, built once a tick the first time anyone looks (a battle of hundreds would otherwise compare every pair). */
function sideGrid(sim: Sim, side: 'foes' | 'mine'): Map<number, Villager[]> {
  let c = sim.threatCache;
  if (!c || c.time !== sim.time) c = sim.threatCache = { time: sim.time, foes: null, mine: null };
  if (!c[side]) {
    const g = new Map<number, Villager[]>();
    for (const o of side === 'foes' ? sim.foes : sim.villagers) {
      if (o.health <= 0) continue;
      const k = Math.floor(o.y / CELL) * 1024 + Math.floor(o.x / CELL), cell = g.get(k);
      if (cell) cell.push(o); else g.set(k, [o]);
    }
    c[side] = g;
  }
  return c[side]!;
}

/** Everyone of the other side within `radius` of the unit that is hostile and in the open, from the cells round it. */
function nearbyOthers(sim: Sim, v: Villager, radius: number): Villager[] {
  const g = sideGrid(sim, v.team === 'player' ? 'foes' : 'mine'), r = Math.ceil((radius + 1) / CELL), cx = Math.floor(v.x / CELL), cy = Math.floor(v.y / CELL), out: Villager[] = [];
  for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) { const cell = g.get(j * 1024 + i); if (cell) for (const o of cell) out.push(o); }
  return out;
}

export function threatsOf(sim: Sim, v: Villager, radius: number): Threat[] {
  const out: Threat[] = [], N = sim.world.size, player = v.team === 'player';
  const seen = (x: number, y: number) => !player || sim.fog.state[Math.floor(y) * N + Math.floor(x)] === 2;
  for (const o of nearbyOthers(sim, v, radius)) {
    if (o.health <= 0 || o.down > 0 || o.inside !== null || !teamsHostile(sim, v.team, o.team)) continue;
    const d = Math.hypot(o.x - v.x, o.y - v.y);
    if (d <= radius && seen(o.x, o.y)) out.push({ t: { kind: 'unit', id: o.id }, x: o.x, y: o.y, d, name: o.name });
  }
  if (player) for (const a of sim.animals) {
    if (a.state === 'dead') continue;
    const def = animalDef(a);
    if (!(a.state === 'attack' || def.aggro > 0)) continue;
    const d = Math.hypot(a.x - v.x, a.y - v.y);
    if (d <= radius && seen(a.x, a.y)) out.push({ t: { kind: 'animal', id: a.id }, x: a.x, y: a.y, d, name: def.name });
  }
  return out.sort((p, q) => p.d - q.d);
}

// ---------------------------------------------------------------- hunters
/** How far from the Chòi thợ săn its hunters range (tiles), by the level of the lodge. */
export const HUNT_RANGE = [24, 36, 52];
export function huntRange(sim: Sim): number { return HUNT_RANGE[Math.min(HUNT_RANGE.length, sim.building('huntlodge')?.level ?? 1) - 1]; }
/** A hunter who is hit below this share of health runs home; he hunts again only when healed back above HUNT_BACK. */
const HUNT_FLEE = 0.3, HUNT_BACK = 0.5;

// ---------------------------------------------------------------- damage
export interface HurtSource { unit?: Villager; animal?: Animal }

/** Apply one hit. `dmg` is before armour; armour reduces it by damage type. */
export function hurt(sim: Sim, target: Target, dmg: number, type: DmgType, from: { x: number; y: number }, src: HurtSource): void {
  if (target.kind === 'animal') {
    const a = sim.animalById.get(target.id);
    if (!a || a.state === 'dead') return;
    a.hp -= dmg;
    if (a.hp <= 0) { animalDie(sim, a); sim.onKill?.(); if (src.unit?.team === 'player' && a.species === 'wolf') sim.say('Một con sói đã bị hạ.'); }
    else if (src.unit) provoke(sim, a, src.unit.id);
    return;
  }
  const v = sim.get(target.id);
  if (!v || v.health <= 0) return;
  if (sim.dev.god && v.team === 'player') return;
  const missile = !!src.unit && weaponOf(src.unit).ranged === true;
  const armor = armorOf(v), final = dmg * (1 - (armor ? armor[type] : 0)) * (1 - guardCut(sim, v, missile)) * (v.team === 'player' ? sim.takenFactor(v, missile) * sim.mountGuard(v) : 1);
  v.health -= final; v.calm = 0; v.flinch = 0.3;
  if (armor) sim.wearGear(v, 'armor');
  if (src.unit && src.unit.team === 'player' && v.team !== 'player') sim.tribeAttacked(v.team as Exclude<Team, 'player' | 'wild'>, v);
  if (v.health > 0 && v.team !== 'player' && v.ai && v.ai.role !== 'civ' && src.unit && src.unit.team === 'player' && src.unit.inside !== null) {
    const tw = sim.getBuilding(src.unit.inside);
    if (tw && tw.kind === 'tower') { v.ai.siege = tw.id; v.fight.target = null; } // shot from a tower: it is the tower he goes for
  }
  if (v.health > 0) {
    if (v.team === 'player' && v.job === 'hunt' && v.phase !== 'flee' && v.health < v.maxHealth * HUNT_FLEE) {
      const tribe = src.unit ? sim.tribes.find((t) => t.id === src.unit!.team) : undefined;
      const by = src.animal ? `một con ${animalDef(src.animal).name.toLowerCase()}` : tribe ? tribe.def.name : src.unit ? 'một kẻ địch' : 'kẻ lạ';
      sim.say(`${v.name} (thợ săn) bỏ chạy về làng vì máu còn ${Math.round((v.health / v.maxHealth) * 100)}%, bị ${by} tấn công.`);
      startFlee(sim, v, 8, from);
      return;
    }
    // a unit that is hit and cannot fight back looks for cover; fighters answer the blow
    if (!v.fight.target && src.unit && v.team !== 'player') v.fight.target = { kind: 'unit', id: src.unit.id };
    else if (!v.fight.target && src.animal && v.team !== 'player') v.fight.target = { kind: 'animal', id: src.animal.id };
    return;
  }
  if (v.team === 'player') fallUnit(sim, v); else sim.killFoe(v, src.unit);
}

/** A villager with no health left is dead for good: nobody picks them up, nothing brings them back. */
function fallUnit(sim: Sim, v: Villager): void {
  sim.resetTask(v); v.queue.length = 0; v.swing = null;
  sim.noteBattle('ours');
  sim.killUnit(v, 'tử trận');
}

// ---------------------------------------------------------------- swinging and shooting
export function startSwing(sim: Sim, v: Villager, target: Target): void {
  const w = weaponOf(v), { hitAt, end } = swingTimes(w.anim);
  v.swing = { t: 0, hitAt, end, target };
  v.atkCd = swingCycle(sim, v, w);
  v.anim = w.anim; v.animClock = 0;
  const e = resolve(sim, target);
  if (e) v.facing = entX(e) >= v.x ? 'right' : 'left';
}

/** Damage multiplier of one blow or shot: the critical multiplier when the weapon rolls a critical (chance at most RULES.critMax), else 1. */
function critRoll(sim: Sim, v: Villager, w: WeaponDef): number {
  const c = critChance(sim, v, w);
  return c > 0 && sim.frnd() < c ? critMult(sim, v, w) : 1;
}

/** What the arms do to each other: foot beats archers, archers beat riders, riders beat foot (units.json). Animals are no arm. */
export function armMultiplier(attacker: Villager, e: Ent): number {
  return e.kind === 'unit' ? matchup(armOf(attacker), armOf(e.v), effWeapon(attacker)) : 1;
}

/** Loose an arrow or a stone from a point (the archer, or the tower he stands in): it must be seen and within reach, and it flies. */
export function fireProjectile(sim: Sim, v: Villager, e: Ent, from: { x: number; y: number }, mult: number, rangeBonus: number): boolean {
  const w = weaponOf(v), tx = entX(e), ty = entY(e), d = Math.hypot(tx - from.x, ty - from.y);
  if (d > w.range + rangeBonus + 1 || !canSee(sim, v, tx, ty)) return false;
  // an archer with the enemy in his face shoots badly, rain and storm spoil the aim
  const shot = (weaponDamage(sim, v, w) + RULES.strengthDamage * v.stats.str) * critRoll(sim, v, w) * clampTactical(armMultiplier(v, e) * mult * sim.attackFactor(v, e)) * WEATHER[sim.weather].bow * (d <= UNIT_RULES.archerPressed.within ? UNIT_RULES.archerPressed.damage : 1);
  if (v.inside !== null) sim.noteBattle('shot');
  const target: Target = e.kind === 'unit' ? { kind: 'unit', id: e.v.id } : { kind: 'animal', id: e.a.id };
  sim.projectiles.push({ x: from.x, y: from.y - 0.4, tx, ty, speed: 14, dmg: shot, type: w.type, from, src: v.id, team: v.team, target, chance: d <= (w.range + rangeBonus) / 2 ? RULES.rangedHitNear : RULES.rangedHitFar, kind: w.projectile ?? 'stone' });
  sim.wearGear(v, 'weapon');
  return true;
}

function resolveSwing(sim: Sim, v: Villager, target: Target): void {
  const e = resolve(sim, target);
  if (!e) return;
  const w = weaponOf(v), d = Math.hypot(entX(e) - v.x, entY(e) - v.y), arm = armMultiplier(v, e);
  if (w.ranged) { fireProjectile(sim, v, e, { x: v.x, y: v.y }, 1, 0); return; }
  if (d > w.range + 1.1) return; // the target stepped away: the blow misses
  let behind = false;
  if (e.kind === 'unit') behind = (e.v.facing === 'right' && v.x < e.v.x) || (e.v.facing === 'left' && v.x > e.v.x);
  else behind = (e.a.dir === 1 && v.x < e.a.x) || (e.a.dir === -1 && v.x > e.a.x);
  hurt(sim, target, damageOf({ ...w, damage: weaponDamage(sim, v, w) }, v.stats.str, null, behind) * critRoll(sim, v, w) * clampTactical(arm * sim.attackFactor(v, e)), w.type, { x: v.x, y: v.y }, { unit: v });
  if (v.weapon) sim.wearGear(v, 'weapon');
}

export function tickProjectiles(sim: Sim, dt: number): void {
  for (let i = sim.projectiles.length - 1; i >= 0; i--) {
    const p = sim.projectiles[i], dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * dt;
    if (d > step) { p.x += (dx / d) * step; p.y += (dy / d) * step; continue; }
    sim.projectiles.splice(i, 1);
    const e = resolve(sim, p.target);
    if (!e || Math.hypot(entX(e) - p.tx, entY(e) - p.ty) > 1.4 || sim.frnd() > p.chance) continue;
    const src = sim.get(p.src);
    hurt(sim, p.target, p.dmg + (src ? RULES.strengthDamage * 0 : 0), p.type, p.from, { unit: src });
  }
}

// ---------------------------------------------------------------- per-tick upkeep shared by everyone
export function tickCommon(sim: Sim, v: Villager, dt: number): void {
  v.atkCd = Math.max(0, v.atkCd - dt);
  v.calm += dt;
  if (v.flinch > 0) v.flinch -= dt;
  if (v.swing) {
    const s = v.swing, before = s.t;
    s.t += dt;
    if (before < s.hitAt && s.t >= s.hitAt) resolveSwing(sim, v, s.target);
    if (s.t >= s.end) v.swing = null;
  }
}

// ---------------------------------------------------------------- wounded and rescue
/** Count down a fallen unit; a friend standing beside it for a few seconds gets it back on its feet. */
export function tickDown(sim: Sim, v: Villager, dt: number): void {
  v.down -= dt; v.hold = null; v.path = []; v.slide = null;
  const helper = sim.villagers.some((o) => o !== v && o.health > 0 && o.down <= 0 && o.phase !== 'flee' && Math.hypot(o.x - v.x, o.y - v.y) < 1.6);
  v.rescue = helper ? v.rescue + dt : Math.max(0, v.rescue - dt);
  if (v.rescue >= RULES.rescueSeconds) {
    v.down = 0; v.rescue = 0; v.health = v.maxHealth * RULES.rescueHp; v.phase = 'idle';
    sim.say(`${v.name} đã được đỡ dậy.`);
    return;
  }
  if (v.down <= 0) sim.killUnit(v, 'vì vết thương');
}

// ---------------------------------------------------------------- the brain of a player unit
const SIGHT = 8, DEFENSIVE = 4.5;

/** Returns true when combat logic decided what this unit does this tick (so ordinary work is skipped). */
export function brainPlayer(sim: Sim, v: Villager, dt: number): boolean {
  if (v.phase === 'goStore' || v.phase === 'goEquip') return false;
  const rest = v.phase === 'sleep' || v.phase === 'goHome';
  if (rest && sim.hides(v)) return false; // lying low in a house while the village is attacked: nothing wakes them to run out
  v.fight.scan -= dt;
  const scanNow = v.fight.scan <= 0;
  if (scanNow) v.fight.scan = 0.35;
  // a unit that is hitting a chosen target and is not wavering needs no new look round him every tick: that is what makes a battle of hundreds heavy
  const looking = scanNow || v.phase === 'flee' || (v.phase === 'fight' && !v.fight.target);
  const sight = v.team === 'player' ? sim.sightOf(v) : SIGHT; // our soldiers see as far as they see: night and weather cut it, a torch brings it back
  const threats = looking ? threatsOf(sim, v, sight + 1) : [];

  if (rest) { // a threat wakes the sleeper; only a soldier then stays up for the night, everyone else runs and goes back to bed
    if (scanNow && threats.length && threats[0].d < 7) { if (isFighter(v)) v.nightOwl = true; sim.resetTask(v); } else return false;
  }
  if (v.phase === 'flee' || v.fleeT > 0) return fleeBrain(sim, v, dt, threats);

  if (v.breaks && sim.breakBrain(v, dt)) return true; // hacking down a tree or an enemy work in a war
  const fighter = isFighter(v);
  if (!fighter) {
    // Civilians do not fight: anything hostile within sight sends them running to the campfire
    if (threats.length && threats[0].d < 6 && v.phase !== 'fight') { startFlee(sim, v, 8, threats[0]); return true; }
    return assistBrain(sim, v);
  }
  return fightBrain(sim, v, dt, threats);
}

/**
 * Where a frightened villager runs: a free spot on the ground round the village, on the side away from what chases him. Never the fire itself:
 * they run about the village, and pick a new spot whenever they reach one while the danger lasts.
 */
function fleeSpot(sim: Sim, v: Villager, from?: { x: number; y: number }): Step[] {
  const fire = sim.campfire(), cx = fire ? fire.x + 1 : v.x, cy = fire ? fire.y + 1 : v.y;
  let best: [number, number] | null = null, bs = -Infinity;
  for (let k = 0; k < 12; k++) {
    const ang = sim.frnd() * Math.PI * 2, r = 4 + sim.frnd() * 9, x = Math.floor(cx + Math.cos(ang) * r), y = Math.floor(cy + Math.sin(ang) * r);
    if (sim.world.isBlocked(x, y)) continue;
    const away = from ? Math.hypot(x + 0.5 - from.x, y + 0.5 - from.y) : Math.hypot(x + 0.5 - v.x, y + 0.5 - v.y) * 0.5;
    if (away < 3) continue; // not toward the danger, nor on the spot
    const score = away - Math.abs(r - 8) * 0.3;
    if (score > bs) { bs = score; best = [x, y]; }
  }
  return best ? sim.pathTo(v, best[0], best[1], 4000) : fire ? sim.pathTo(v, Math.floor(fire.x + 1), Math.floor(fire.y + 2), 4000) : [];
}

function startFlee(sim: Sim, v: Villager, secs: number, from?: { x: number; y: number }): void {
  const keep = v.job, nightOwl = v.nightOwl;
  sim.resetTask(v); v.job = keep; v.nightOwl = nightOwl;
  v.fight.target = null; if (v.fight.mode === 'attack') v.fight.mode = 'none';
  v.phase = 'flee'; v.fleeT = secs;
  v.path = fleeSpot(sim, v, from);
}

function fleeBrain(sim: Sim, v: Villager, dt: number, threats: Threat[]): boolean {
  if (v.phase !== 'flee') { startFlee(sim, v, 8, threats[0]); return true; }
  v.fleeT -= dt;
  if (threats.length && threats[0].d < 6) v.fleeT = Math.max(v.fleeT, 3); // keep running while they are close
  if (!v.path.length && threats.length && threats[0].d < 9) v.path = fleeSpot(sim, v, threats[0]); // reached a spot with the danger still near: run to another, round the village
  if (v.fleeT <= 0) { v.phase = 'idle'; v.fleeT = 0; v.path = []; return false; }
  return true;
}

/** Everyone helps a fallen friend when nothing threatens them. */
function assistBrain(sim: Sim, v: Villager): boolean {
  if (v.phase === 'rescue') {
    const t = sim.get(v.target);
    if (!t || t.down <= 0) { v.phase = 'idle'; v.target = -1; return false; }
    if (Math.hypot(t.x - v.x, t.y - v.y) < 1.4) { v.path = []; return true; }
    if (!v.path.length) v.path = sim.pathTo(v, Math.floor(t.x), Math.floor(t.y), 3000);
    return true;
  }
  if (v.phase === 'sleep' || v.phase === 'goHome') return false;
  const down = sim.villagers.find((o) => o !== v && o.down > 0 && Math.hypot(o.x - v.x, o.y - v.y) < 14);
  if (down && v.health > 0) { const keep = v.job, owl = v.nightOwl; sim.resetTask(v); v.job = keep; v.nightOwl = owl; v.phase = 'rescue'; v.target = down.id; v.path = sim.pathTo(v, Math.floor(down.x), Math.floor(down.y), 3000); return true; }
  return false;
}

/** Walk toward a target, strike when in reach. */
export function engage(sim: Sim, v: Villager, e: Ent, dt: number): void {
  const w = weaponOf(v), x = entX(e), y = entY(e), d = Math.hypot(x - v.x, y - v.y);
  const reach = w.ranged ? w.range : w.range + (e.kind === 'animal' ? 0.45 : 0.5);
  v.phase = 'fight';
  if (d <= reach && (!w.ranged || canSee(sim, v, x, y))) {
    v.path = []; v.slide = null;
    v.facing = x >= v.x ? 'right' : 'left';
    if (!v.swing && v.atkCd <= 0) startSwing(sim, v, e.kind === 'unit' ? { kind: 'unit', id: e.v.id } : { kind: 'animal', id: e.a.id });
    return;
  }
  if (v.swing) return; // finish the blow before moving
  v.fight.repath -= dt;
  if ((v.fight.repath <= 0 || !v.path.length) && sim.pathLeft > 0) { sim.pathLeft--; v.fight.repath = 0.5; v.path = sim.pathTo(v, Math.floor(x), Math.floor(y), 3500); if (!v.path.length) v.fight.repath = 1.5; }
}

/** Where a soldier stands when he has nothing to do: a guard at his post, the rest at the door of their own camp (the fire when there is no camp). */
function homeSpot(sim: Sim, v: Villager): { x: number; y: number } | null {
  if (v.guard && v.guardAt) return v.guardAt;
  const camp = sim.buildings.find((b) => b.kind === sim.homeKind(v) && b.done);
  if (camp) return { x: camp.x + 1 + (v.id % 3) - 1, y: camp.y + 3 };
  const fire = sim.campfire();
  return fire ? { x: fire.x + 1 + (v.id % 3) - 1, y: fire.y + 3 } : null;
}

/** Whether a soldier of the camps may go for what he sees: only when the alarm drum sounds, a fight is on, or he has been told to attack. Guards watch for themselves, hunters hunt. */
function mayEngage(sim: Sim, v: Villager): boolean {
  if (v.job !== 'fight' || v.guard || v.team !== 'player') return true;
  return sim.alarmUntil > sim.time || sim.battle.on || v.fight.mode === 'attack' || v.fight.mode === 'attackMove' || (v.squad >= 0 && sim.plans.some((p) => p.status === 'running'));
}

function fightBrain(sim: Sim, v: Villager, dt: number, threats: Threat[]): boolean {
  const f = v.fight;
  if (v.phase === 'skin' || v.phase === 'goCarcass') return huntBrain(sim, v, dt, threats);
  // a hurt hunter hunts no more until he has healed: he keeps away from what is near and rests by the fire
  if (v.job === 'hunt' && v.health < v.maxHealth * HUNT_BACK && f.mode !== 'attack') {
    f.target = null;
    if (threats.length && threats[0].d < 7 && v.phase !== 'flee') { startFlee(sim, v, 8, threats[0]); return true; }
    return huntBrain(sim, v, dt, threats);
  }
  if (f.mode === 'hold' && !f.anchor) f.anchor = { x: v.x, y: v.y };
  // equipment first, but never in the middle of a fight
  if (!threats.length && !f.target && v.phase !== 'fight' && (sim.planEquipGear(v) || sim.planGearErrand(v))) return true;

  // retreat stance beats a target the unit picked for itself; only a direct attack order overrides it
  if (v.stance === 'retreat' && f.mode !== 'attack' && f.target) f.target = null;
  // 1. an explicit target
  if (f.target) {
    const e = resolve(sim, f.target);
    if (e) {
      if (f.mode === 'hold' && f.anchor && Math.hypot(entX(e) - f.anchor.x, entY(e) - f.anchor.y) > weaponOf(v).range + 2) { f.target = null; }
      else { engage(sim, v, e, dt); return true; }
    } else {
      const dead = f.target.kind === 'animal' ? sim.animalById.get(f.target.id) : undefined;
      f.target = null;
      if (f.mode === 'attack') { if (v.job === 'fight') { f.mode = 'guard'; f.anchor = v.guard || (v.team === 'player' && v.squad < 0) ? homeSpot(sim, v) ?? { x: v.x, y: v.y } : { x: v.x, y: v.y }; } else f.mode = 'none'; } // done: back to the post, or the camp
      if (dead && dead.state === 'dead' && v.job === 'hunt') v.loot = dead.id; // only a hunter goes to skin it; a soldier keeps his post
      if (v.phase === 'fight') { v.phase = 'idle'; v.path = []; }
      if (sim.nextOrder(v)) return true;
    }
  }
  // 2. auto-engage by stance
  if (v.stance === 'retreat') {
    if (threats.length && threats[0].d < 8) { startFlee(sim, v, 6, threats[0]); return true; }
  } else if (threats.length && f.scan >= 0) {
    // a soldier of a camp, with no alarm and no order, only defends himself against what comes close
    const range = !mayEngage(sim, v) ? Math.min(DEFENSIVE, sim.sightOf(v)) : f.mode === 'hold' ? weaponOf(v).range + 1.5 : v.stance === 'defensive' ? Math.min(DEFENSIVE, sim.sightOf(v)) : sim.sightOf(v);
    // a guard goes for what harms the village: a stranger with a weapon, or a beast that is really attacking
    const pick = threats.find((t) => (!v.guard || t.t.kind === 'unit' || sim.animalById.get(t.t.id)?.state === 'attack') && t.d <= range && (!f.anchor || v.stance !== 'defensive' || Math.hypot(t.x - f.anchor.x, t.y - f.anchor.y) < DEFENSIVE + 2));
    if (pick) { f.target = pick.t; const e = resolve(sim, pick.t); if (e) { engage(sim, v, e, dt); return true; } }
  }
  // 3. attack-move: keep walking to the destination
  if (f.mode === 'attackMove' && f.dest) {
    if (Math.hypot(f.dest.x - v.x, f.dest.y - v.y) < 1.5) { f.mode = 'guard'; f.anchor = { x: f.dest.x, y: f.dest.y }; f.dest = null; v.path = []; v.phase = 'idle'; if (sim.nextOrder(v)) return true; }
    else { if (!v.path.length && sim.pathLeft > 0) { sim.pathLeft--; v.path = f.strict ? sim.lineSteps(v, f.dest.x, f.dest.y) : sim.pathTo(v, Math.floor(f.dest.x), Math.floor(f.dest.y), 20000); } v.phase = 'move'; return true; }
  }
  if (v.post >= 0 && v.phase === 'idle' && !threats.length && !f.target) { sim.planStaff(v); if ((v.phase as string) === 'goStaff') return true; } // back to his tower after the night
  if (f.mode === 'hold') { v.phase = 'idle'; v.path = []; return true; }
  // 4. nothing to fight: hunters hunt, warriors stand guard by the fire
  if (v.job === 'hunt') return huntBrain(sim, v, dt, threats);
  if (v.phase === 'fight') { v.phase = 'idle'; v.path = []; }
  if (v.job === 'fight') {
    // the post: where the unit was told to stand, else beside the village fire
    const home = homeSpot(sim, v), post = v.guard && v.guardAt ? { x: v.guardAt.x, y: v.guardAt.y, slack: 2 } : f.mode === 'guard' && f.anchor ? { x: f.anchor.x, y: f.anchor.y, slack: 2 } : home ? { x: home.x, y: home.y, slack: 5 } : null;
    if (post && v.phase === 'idle' && !v.path.length && Math.hypot(v.x - post.x, v.y - post.y) > post.slack) { if (sim.pathLeft <= 0) return true; sim.pathLeft--; v.path = sim.pathTo(v, Math.floor(post.x), Math.floor(post.y), 30000); v.phase = v.path.length ? 'move' : 'idle'; return true; }
    return v.phase === 'move' || v.phase === 'idle';
  }
  return false;
}

// ---------------------------------------------------------------- hunting
function huntBrain(sim: Sim, v: Villager, dt: number, threats: Threat[]): boolean {
  if (v.health < v.maxHealth * HUNT_BACK && v.phase !== 'skin') { // hurt: take what he carries home, then rest by the fire until healed
    if (v.phase === 'move' && v.path.length) return true;
    if (v.phase === 'fight' || v.phase === 'goCarcass') { v.phase = 'idle'; v.path = []; v.loot = -1; }
    if (v.carry && v.carry.amount > 0) { sim.planDeliver(v); return true; }
    const fire = sim.campfire();
    if (fire && Math.hypot(v.x - fire.x - 1, v.y - fire.y - 1) > 4 && sim.pathLeft > 0) { sim.pathLeft--; v.path = sim.pathTo(v, Math.floor(fire.x + 1), Math.floor(fire.y + 2), 4000); if (v.path.length) { v.phase = 'move'; return true; } }
    sim.wait(v, 2); return true;
  }
  if (v.phase === 'skin') {
    v.timer -= dt; v.anim = 'build'; // crouched over the carcass
    if (v.timer > 0) return true;
    const a = sim.animalById.get(v.loot);
    v.phase = 'idle'; v.loot = -1;
    if (!a) return true;
    const have = v.carry && v.carry.res === 'food' ? v.carry.amount : 0, take = Math.min(a.meat, CARRY_CAP.food - have);
    if (take > 0) { a.meat -= take; v.carry = { res: 'food', amount: have + take }; }
    // the skin and everything else on the body goes straight to the store
    const got: string[] = [];
    if (a.hide > 0) { sim.stock.hide = Math.min(sim.capacity(), sim.stock.hide + a.hide); got.push(`${a.hide} ${RES_NAME.hide.toLowerCase()}`); a.hide = 0; }
    for (const [res, n] of Object.entries(a.drops ?? {}) as Array<[Res, number]>) {
      if (!(n > 0)) continue;
      sim.stock[res] = Math.min(sim.capacity(), sim.stock[res] + n); got.push(`${n} ${RES_NAME[res].toLowerCase()}`);
    }
    a.drops = {};
    if (got.length) sim.say(`${v.name} xẻ ${animalDef(a).name.toLowerCase()}: ${got.join(', ')}.`);
    return true;
  }
  if (v.phase === 'goCarcass') {
    const a = sim.animalById.get(v.loot);
    if (!a || a.state !== 'dead' || carcassEmpty(a)) { v.phase = 'idle'; v.loot = -1; v.path = []; return true; }
    if (Math.hypot(a.x - v.x, a.y - v.y) < 1.5) { v.path = []; v.phase = 'skin'; v.timer = BEHAVIOUR.skinSeconds; v.facing = a.x >= v.x ? 'right' : 'left'; return true; }
    if (!v.path.length) { v.path = sim.pathTo(v, Math.floor(a.x), Math.floor(a.y), 3000); if (!v.path.length) { v.phase = 'idle'; v.loot = -1; } }
    return true;
  }
  if (v.phase === 'move' && v.path.length) return true; // told to walk somewhere: arrive first, then hunt on
  if (v.carry && v.carry.amount >= CARRY_CAP[v.carry.res]) { sim.planDeliver(v); return true; }
  // a carcass waiting to be skinned
  const N = sim.world.size;
  const lodge = sim.building('huntlodge') ?? sim.campfire(), range = huntRange(sim);
  let best: Animal | null = null, bd = 45;
  if (v.loot >= 0) { const a = sim.animalById.get(v.loot); if (a && a.state === 'dead') best = a; else v.loot = -1; }
  if (!best) for (const a of sim.animals) {
    if (a.state !== 'dead' || carcassEmpty(a) || sim.fog.state[Math.floor(a.y) * N + Math.floor(a.x)] === 0) continue;
    const d = Math.hypot(a.x - v.x, a.y - v.y);
    if (d < bd) { bd = d; best = a; }
  }
  if (best) { v.loot = best.id; v.phase = 'goCarcass'; v.path = sim.pathTo(v, Math.floor(best.x), Math.floor(best.y), 3000); return true; }
  // living prey
  if (!threats.length) {
    let prey: Animal | null = null; bd = Infinity; // a hunter looks over all the explored ground within the range of his lodge
    for (const a of sim.animals) {
      const def = animalDef(a);
      if (a.state === 'dead' || !def.prey || sim.fog.state[Math.floor(a.y) * N + Math.floor(a.x)] === 0) continue;
      if (lodge && Math.hypot(a.x - lodge.x, a.y - lodge.y) > range) continue;
      if (def.defends && !sim.packNear(v, a)) continue; // a boar is only taken on by a group
      const d = Math.hypot(a.x - v.x, a.y - v.y);
      if (d < bd) { bd = d; prey = a; }
    }
    if (prey) { v.fight.target = { kind: 'animal', id: prey.id }; engage(sim, v, { kind: 'animal', a: prey }, 0); return true; }
  }
  if (v.carry && v.carry.amount > 0) { sim.planDeliver(v); return true; }
  if (v.phase === 'fight') { v.phase = 'idle'; v.path = []; }
  // no game in sight: go out and look for some, in a new direction each time, anywhere within the range of the lodge (unexplored ground too: walking there opens the map)
  if (lodge) {
    const step = Math.floor(sim.time / 8), spots: Array<[number, number, boolean]> = [];
    for (let t = 0; t < 10; t++) {
      const ang = hash2(v.id, step * 16 + t, 71) * Math.PI * 2, rad = 6 + hash2(v.id, step * 16 + t, 72) * (range - 6);
      const gx = Math.floor(lodge.x + Math.cos(ang) * rad), gy = Math.floor(lodge.y + Math.sin(ang) * rad);
      if (sim.world.inBounds(gx, gy) && !sim.world.isBlocked(gx, gy)) spots.push([gx, gy, sim.fog.state[gy * N + gx] === 0]);
    }
    spots.sort((p, q) => Number(q[2]) - Number(p[2])); // the unexplored first
    for (const [gx, gy] of spots) {
      if (sim.pathLeft <= 0) break;
      sim.pathLeft--;
      const path = sim.pathTo(v, gx, gy, 2500);
      if (path.length) { v.path = path; v.phase = 'move'; return true; }
    }
  }
  sim.wait(v, 1);
  return true;
}

/** Best weapon the workshop holds that beats what `v` carries, by damage per second. */
export function bestWeapon(sim: Sim, v: Villager): string | null {
  const score = (id: string) => { const w = WEAPONS[id]; return (w.damage + RULES.strengthDamage * v.stats.str) / cycleOf(w.cycle, v.stats.agi) + (w.range > 1 ? 1 : 0); };
  const cur = v.weapon ? score(v.weapon) : score('fist');
  let best: string | null = null, bs = cur;
  for (const id of CRAFTED_WEAPONS) {
    if (sim.toolCount(id, WEAPONS[id].tier ?? 1) <= 0) continue;
    if (id === 'mace' && v.job !== 'fight') continue; // the heavy mace is a soldier's weapon, not a hunter's
    if (v.job === 'fight' && (v.arm === 'archer') !== !!WEAPONS[id].ranged) continue; // the throwers' camp arms throwers, the others carry blows
    if (score(id) > bs) { bs = score(id); best = id; }
  }
  return best;
}

void ANIMALS; void TRIBES;
