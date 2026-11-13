import animsJson from '../data/anims.json';
import { armorRank } from './ranks';
import { ARMORS, ArmorDef, damageOf, DmgType, RULES, Team, WeaponDef, WEAPONS } from './combat';
import { WEATHER } from './calendar';
import { Arm, armOfWeapon, clampTactical, matchup, UNIT_RULES } from './formations';
import { Animal, animalDef, die as animalDie, provoke } from './fauna';
import chaseJson from '../data/chase.json';
import { chaseSight } from './fightpolicy';
import { isActive } from './tribework';
import type { Sim, Target, Villager } from './sim';
import { armPerk, critChance, critMult, guardCut, swingCycle, weaponDamage } from './statsys';
import { perkPct } from './research';

const ANIM = animsJson as unknown as Record<string, { fps: number; frames: unknown[]; hit?: number }>;
/** When, inside an attack animation, the blow lands and when it ends (seconds). */
const CHASE = chaseJson;
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
export const armOf = (v: Villager): Arm => ((v.team === 'player' && v.job === 'fight' && (v.arm === 'cavalry' || v.mount)) || (v.team !== 'player' && v.mount) ? 'cavalry' : armOfWeapon(effWeapon(v)));
export const weaponOf = (v: Villager): WeaponDef => WEAPONS[effWeapon(v) ?? 'fist'] ?? WEAPONS.fist;
const armorOf = (v: Villager): ArmorDef | null => (v.armor && !(v.team === 'player' && v.gear.ab && v.gear.a === v.armor) ? ARMORS[v.armor] ?? null : null);
/** Can this unit's side see the spot? Our own people shoot only at what they can see; the foe has no fog. */
export function canSee(sim: Sim, v: Villager, x: number, y: number): boolean {
  return v.team !== 'player' || sim.fog.state[Math.floor(y) * sim.world.size + Math.floor(x)] === 2;
}
export const isFighter = (v: Villager) => v.job === 'fight' || v.job === 'hunt' || v.job === 'supply' || v.fight.mode !== 'none';

export function teamsHostile(sim: Sim, a: Team, b: Team): boolean {
  if (a === b || a === 'wild' || b === 'wild') return false;
  if (a === 'player') return sim.tribeWilling(b);
  if (b === 'player') return sim.tribeWilling(a);
  return sim.tribesFeud(a, b); // two villages fight only when they are at feud
}

export interface Threat { t: Target; x: number; y: number; d: number; name: string; /** A soldier of the other side (not a civilian, not a beast): the archers pick these first. */ fighter?: boolean }

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
  // the villages meet each other too, but only where we are looking (the chunks round our people)
  if (v.team !== 'player' && v.team !== 'wild' && isActive(sim, v.x, v.y)) {
    const f = sideGrid(sim, 'foes');
    for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) { const cell = f.get(j * 1024 + i); if (cell) for (const o of cell) if (o.team !== v.team && isActive(sim, o.x, o.y)) out.push(o); }
  }
  return out;
}

export function threatsOf(sim: Sim, v: Villager, radius: number): Threat[] {
  const out: Threat[] = [], N = sim.world.size, player = v.team === 'player';
  const sk = v.fight.skip && sim.time < v.fight.skip.until ? v.fight.skip : null; // a target given up for a while
  const seen = (x: number, y: number) => !player || sim.fog.state[Math.floor(y) * N + Math.floor(x)] === 2;
  for (const o of nearbyOthers(sim, v, radius)) {
    if (o.health <= 0 || o.down > 0 || o.inside !== null || o.inTent || o.ai?.guest !== undefined || !teamsHostile(sim, v.team, o.team) || (sk && sk.kind === 'unit' && sk.id === o.id)) continue;
    const d = Math.hypot(o.x - v.x, o.y - v.y);
    if (d <= radius && seen(o.x, o.y)) out.push({ t: { kind: 'unit', id: o.id }, x: o.x, y: o.y, d, name: o.name, fighter: isFighter(o) || (!!o.ai && o.ai.role !== 'civ') });
  }
  if (player) for (const a of sim.animals) {
    if (a.state === 'dead' || (sk && sk.kind === 'animal' && sk.id === a.id)) continue;
    const def = animalDef(a);
    if (!(a.state === 'attack' || def.aggro > 0)) continue;
    const d = Math.hypot(a.x - v.x, a.y - v.y);
    if (d <= radius && seen(a.x, a.y)) out.push({ t: { kind: 'animal', id: a.id }, x: a.x, y: a.y, d, name: def.name });
  }
  // an archer (of either side) picks a soldier of the enemy before anyone else in sight; the rest, and every other arm, go by distance
  if (armOf(v) === 'archer') return out.sort((p, q) => (q.fighter ? 1 : 0) - (p.fighter ? 1 : 0) || p.d - q.d);
  return out.sort((p, q) => p.d - q.d);
}

/** A hunter who is hit below this share of health runs home; he hunts again only when healed back above HUNT_BACK. */
export const HUNT_FLEE = 0.3, HUNT_BACK = 0.5;

// ---------------------------------------------------------------- damage
/** Two villages are fighting: if it is on ground we can see, it goes on the notices. */
function noteClash(sim: Sim, a: string, b: string, x: number, y: number): void {
  if (sim.fog.state[Math.floor(y) * sim.world.size + Math.floor(x)] !== 2) return;
  const c = sim.clashes.find((o) => (o.a === a && o.b === b) || (o.a === b && o.b === a));
  if (c) { c.at = sim.time; c.x = x; c.y = y; } else sim.clashes.push({ a, b, at: sim.time, x, y });
}

export interface HurtSource { unit?: Villager; animal?: Animal }

/** Apply one hit. `dmg` is before armour; armour reduces it by damage type. */
export function hurt(sim: Sim, target: Target, dmg: number, type: DmgType, from: { x: number; y: number }, src: HurtSource): void {
  if (target.kind === 'animal') {
    const a = sim.animalById.get(target.id);
    if (!a || a.state === 'dead') return;
    if (src.unit?.team === 'player') dmg *= 1 + perkPct(sim.researched, `beast_${a.species}`) / 100; // the hunters who have studied this beast hit it harder
    if (a.raid && src.unit?.team === 'player') sim.noteDamage(true, Math.min(dmg, a.hp));
    a.hp -= dmg;
    if (a.hp <= 0) { if (a.raid) sim.noteBattle('foes'); animalDie(sim, a); sim.onKill?.(); if (src.unit?.team === 'player' && a.species === 'wolf') sim.say('Một con sói đã bị hạ.'); }
    else if (src.unit) provoke(sim, a, src.unit.id);
    return;
  }
  const v = sim.get(target.id);
  if (!v || v.health <= 0) return;
  if (sim.dev.god && v.team === 'player') return;
  const missile = !!src.unit && weaponOf(src.unit).ranged === true;
  const armor = armorOf(v), final = dmg * (1 - guardCut(sim, v, missile, armor ? (missile ? armor.defr : armor.defm) : 0, src.unit ? armPerk(sim, src.unit, 'pierce') : 0)) * (v.team === 'player' ? sim.takenFactor(v, missile) : 1) * sim.mountGuard(v) * sim.skirmishEdge(src.unit, v); // a boss village fought without a war plan is stronger (warskirmish.ts)
  if (v.team === 'player') sim.noteDamage(false, Math.min(final, v.health)); else if (v.ai?.role === 'raider') sim.noteDamage(true, Math.min(final, v.health));
  v.health -= final; v.calm = 0; v.flinch = 0.3;
  if (src.unit && sim.mountOf(src.unit) === 'elephant') sim.addSfx('elephant', false, src.unit.x, src.unit.y); // the beast bellows when its rider strikes
  if (src.unit) { const sw = weaponOf(src.unit); sim.addSfx(sw.id, missile, v.x, v.y, sw.rank ?? 0, armor ? armorRank(v.armor) : 0); } // the sound belongs to the weapon in his hand, whoever holds it
  if (src.unit && src.unit.team !== v.team && src.unit.team !== 'player' && v.team !== 'player' && src.unit.team !== 'wild' && v.team !== 'wild') noteClash(sim, src.unit.team, v.team, v.x, v.y);
  if (armor) sim.wearGear(v, 'armor');
  if (src.unit && src.unit.team === 'player' && v.team !== 'player') sim.tribeAttacked(v.team as Exclude<Team, 'player' | 'wild'>, v);
  // our soldier and a soldier of a village strike each other, ordered or not: the skirmish begins (warskirmish.ts)
  if (src.unit && src.unit.team === 'player' && src.unit.job === 'fight' && v.team !== 'player') { const foe = sim.foeVillage(v); if (foe && !sim.inSkirmish(src.unit)) sim.skirmishOrder([src.unit.id], foe); }
  else if (src.unit && v.team === 'player' && v.job === 'fight') { const foe = sim.foeVillage(src.unit); if (foe && !sim.inSkirmish(v)) sim.skirmishOrder([v.id], foe); }
  if (v.health > 0 && v.team !== 'player' && v.ai && v.ai.role !== 'civ' && src.unit && src.unit.team === 'player' && src.unit.inside !== null) {
    const tw = sim.getBuilding(src.unit.inside);
    if (tw && tw.kind === 'tower') { v.ai.siege = tw.id; v.fight.target = null; } // shot from a tower: it is the tower he goes for
  }
  if (v.health > 0) {
    if (v.team === 'player' && v.job === 'hunt' && v.phase !== 'flee' && v.health < v.maxHealth * HUNT_FLEE && !sim.underOrders(v)) {
      const tribe = src.unit ? sim.tribes.find((t) => t.id === src.unit!.team) : undefined;
      const by = src.animal ? `một con ${animalDef(src.animal).name.toLowerCase()}` : tribe ? tribe.def.name : src.unit ? 'một kẻ địch' : 'kẻ lạ';
      sim.say(`${v.name} (thợ săn) bỏ chạy về làng vì máu còn ${Math.round((v.health / v.maxHealth) * 100)}%, bị ${by} tấn công.`);
      sim.startFlee(v, 8, from);
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
  sim.noteLoss(v);
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
export function armMultiplier(sim: Sim, attacker: Villager, e: Ent): number {
  const m = e.kind === 'unit' ? matchup(armOf(attacker), armOf(e.v), effWeapon(attacker)) : 1;
  return m > 1 ? m * (1 + armPerk(sim, attacker, 'counter') / 100) : m; // the research of an arm makes it hit harder the arm it beats
}

/** Loose an arrow or a stone from a point (the archer, or the tower he stands in): it must be seen and within reach, and it flies. */
export function fireProjectile(sim: Sim, v: Villager, e: Ent, from: { x: number; y: number }, mult: number, rangeBonus: number): boolean {
  const w = weaponOf(v), tx = entX(e), ty = entY(e), d = Math.hypot(tx - from.x, ty - from.y);
  if (d > w.range + rangeBonus + 1 || !canSee(sim, v, tx, ty)) return false;
  // an archer with the enemy in his face shoots badly, rain and storm spoil the aim
  const shot = (weaponDamage(sim, v, w) + RULES.strengthDamage * v.stats.str) * critRoll(sim, v, w) * clampTactical(armMultiplier(sim, v, e) * mult * sim.attackFactor(v, e)) * WEATHER[sim.weather].bow * (d <= UNIT_RULES.archerPressed.within ? UNIT_RULES.archerPressed.damage : 1);
  if (v.inside !== null) sim.noteBattle('shot');
  const target: Target = e.kind === 'unit' ? { kind: 'unit', id: e.v.id } : { kind: 'animal', id: e.a.id };
  sim.projectiles.push({ x: from.x, y: from.y - 0.4, tx, ty, speed: 14, dmg: shot, type: w.type, from, src: v.id, team: v.team, target, chance: d <= (w.range + rangeBonus) / 2 ? RULES.rangedHitNear : RULES.rangedHitFar, kind: w.projectile ?? 'stone' });
  sim.wearGear(v, 'weapon');
  return true;
}

function resolveSwing(sim: Sim, v: Villager, target: Target): void {
  const e = resolve(sim, target);
  if (!e) return;
  const w = weaponOf(v), d = Math.hypot(entX(e) - v.x, entY(e) - v.y), arm = armMultiplier(sim, v, e);
  if (w.ranged) { fireProjectile(sim, v, e, { x: v.x, y: v.y }, 1, 0); return; }
  if (d > w.range + 1.1) return; // the target stepped away: the blow misses
  let behind = false;
  if (e.kind === 'unit') behind = (e.v.facing === 'right' && v.x < e.v.x) || (e.v.facing === 'left' && v.x > e.v.x);
  else behind = (e.a.dir === 1 && v.x < e.a.x) || (e.a.dir === -1 && v.x > e.a.x);
  hurt(sim, target, damageOf({ ...w, damage: weaponDamage(sim, v, w) }, v.stats.str, behind) * critRoll(sim, v, w) * clampTactical(arm * sim.attackFactor(v, e)), w.type, { x: v.x, y: v.y }, { unit: v });
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

/**
 * Keeps the chase honest (src/data/chase.json): whoever cannot see the target for a while, or has been after it for a while without throwing a blow, lets it go.
 * He drops the target, will not pick it again for a time, and goes back to what he was doing (the post, the hunt, the wandering). Returns whether he gave up.
 */
function chaseGivenUp(sim: Sim, v: Villager, e: Ent, d: number, dt: number): boolean {
  const f = v.fight, key = e.kind === 'unit' ? `u${e.v.id}` : `a${e.a.id}`;
  if (f.chaseKey !== key) { f.chaseKey = key; f.chaseT = 0; f.unseenT = 0; }
  // seeing: within sight of him (the foe looks as far as his own look-out, 14), and for our own people on lit ground of the map
  const sees = d <= chaseSight(sim, v) && canSee(sim, v, entX(e), entY(e));
  if (f.mode === 'attack' || f.mode === 'attackMove') {
    // told to go for him: he follows out of sight too, and only gives up when the way is shut (no path, still out of reach)
    const weapon = weaponOf(v), blocked = !v.path.length && d > weapon.range + 1;
    f.chaseT = blocked ? (f.chaseT ?? 0) + dt : 0; f.unseenT = 0;
  } else {
    f.chaseT = (f.chaseT ?? 0) + dt;
    f.unseenT = sees ? 0 : (f.unseenT ?? 0) + dt;
  }
  if (f.unseenT <= CHASE.loseSightSeconds && f.chaseT <= CHASE.noHitSeconds) return false;
  f.skip = { kind: e.kind === 'unit' ? 'unit' : 'animal', id: e.kind === 'unit' ? e.v.id : e.a.id, until: sim.time + CHASE.skipSeconds };
  if (v.ai && e.kind === 'unit') v.ai.skip = { id: e.v.id, until: sim.time + CHASE.skipSeconds };
  f.target = null; f.chaseKey = undefined; f.chaseT = 0; f.unseenT = 0; v.path = []; v.slide = null;
  if (v.phase === 'fight') v.phase = 'idle';
  if (f.mode === 'attack') sim.endOrder(v); // an order that cannot be carried out is over: back to the post or the camp
  return true;
}

/** Walk toward a target, strike when in reach. */
export function engage(sim: Sim, v: Villager, e: Ent, dt: number): void {
  const w = weaponOf(v), x = entX(e), y = entY(e), d = Math.hypot(x - v.x, y - v.y);
  if (dt > 0 && chaseGivenUp(sim, v, e, d, dt)) return;
  const reach = w.ranged ? w.range : w.range + (e.kind === 'animal' ? 0.45 : 0.5);
  v.phase = 'fight';
  if (d <= reach && (!w.ranged || canSee(sim, v, x, y))) {
    v.path = []; v.slide = null;
    v.facing = x >= v.x ? 'right' : 'left';
    if (!v.swing && v.atkCd <= 0) { startSwing(sim, v, e.kind === 'unit' ? { kind: 'unit', id: e.v.id } : { kind: 'animal', id: e.a.id }); v.fight.chaseT = 0; }
    return;
  }
  if (v.swing) return; // finish the blow before moving
  v.fight.repath -= dt;
  if ((v.fight.repath <= 0 || !v.path.length) && sim.pathLeft > 0) { sim.pathLeft--; v.fight.repath = 0.5; v.path = sim.pathTo(v, Math.floor(x), Math.floor(y), 3500); if (v.path.length) v.fight.blockedT = 0; else { v.fight.repath = 1.5; v.fight.blockedT = (v.fight.blockedT ?? 0) + 1.5; if (v.team === 'player' && e.kind === 'unit' && sim.breachFor(v, x, y)) return; } }
}
