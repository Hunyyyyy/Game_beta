import animsJson from '../data/anims.json';
import { ANIMALS, ARMORS, ArmorDef, CRAFTED_WEAPONS, cycleOf, damageOf, DmgType, MORALE, RULES, Team, TRIBES, WeaponDef, WEAPONS } from './combat';
import { Animal, animalDef, die as animalDie, provoke } from './fauna';
import { CARRY_CAP } from './resources';
import type { Sim, Target, Villager } from './sim';
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

export const weaponOf = (v: Villager): WeaponDef => WEAPONS[v.weapon ?? 'fist'] ?? WEAPONS.fist;
const armorOf = (v: Villager): ArmorDef | null => (v.armor ? ARMORS[v.armor] ?? null : null);
export const isFighter = (v: Villager) => v.job === 'fight' || v.job === 'hunt' || v.fight.mode !== 'none';

export function teamsHostile(sim: Sim, a: Team, b: Team): boolean {
  if (a === b || a === 'wild' || b === 'wild') return false;
  if (a === 'player') return sim.tribeHostile(b);
  if (b === 'player') return sim.tribeHostile(a);
  return false; // tribes do not fight each other
}

export interface Threat { t: Target; x: number; y: number; d: number; name: string }

/** Enemies of `v` within `radius`, nearest first. Player units only notice what they can see. */
export function threatsOf(sim: Sim, v: Villager, radius: number): Threat[] {
  const out: Threat[] = [], N = sim.world.size, player = v.team === 'player';
  const seen = (x: number, y: number) => !player || sim.fog.state[Math.floor(y) * N + Math.floor(x)] === 2;
  const pool = player ? sim.foes : sim.villagers;
  for (const o of pool) {
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
  const armor = armorOf(v), final = dmg * (1 - (armor ? armor[type] : 0));
  v.health -= final; v.calm = 0; v.flinch = 0.3;
  const behind = (v.facing === 'right' && from.x < v.x) || (v.facing === 'left' && from.x > v.x);
  if (behind) v.morale = Math.max(0, v.morale + MORALE.backstab);
  if (src.unit && src.unit.team === 'player' && v.team !== 'player') sim.tribeAttacked(v.team as Exclude<Team, 'player' | 'wild'>, v);
  if (v.health > 0) {
    // a unit that is hit and cannot fight back looks for cover; fighters answer the blow
    if (!v.fight.target && src.unit && v.team !== 'player') v.fight.target = { kind: 'unit', id: src.unit.id };
    else if (!v.fight.target && src.animal && v.team !== 'player') v.fight.target = { kind: 'animal', id: src.animal.id };
    return;
  }
  if (v.team === 'player') downUnit(sim, v); else sim.killFoe(v, src.unit);
}

function downUnit(sim: Sim, v: Villager): void {
  sim.resetTask(v); v.queue.length = 0;
  v.health = 0; v.down = RULES.downedSeconds; v.rescue = 0; v.phase = 'down'; v.swing = null;
  sim.say(`${v.name} bị thương nặng, ngã xuống! Cần có người kéo dậy trong ${RULES.downedSeconds} giây.`);
  moraleShock(sim, v, MORALE.allyDeath * 0.6);
}

/** Allies within 8 tiles lose heart when a comrade falls. */
export function moraleShock(sim: Sim, who: Villager, amount: number): void {
  const pool = who.team === 'player' ? sim.villagers : sim.foes.filter((f) => f.team === who.team);
  for (const o of pool) if (o !== who && o.health > 0 && Math.hypot(o.x - who.x, o.y - who.y) < 8) o.morale = Math.max(0, Math.min(100, o.morale + amount));
}

// ---------------------------------------------------------------- swinging and shooting
export function startSwing(sim: Sim, v: Villager, target: Target): void {
  const w = weaponOf(v), { hitAt, end } = swingTimes(w.anim);
  v.swing = { t: 0, hitAt, end, target };
  v.atkCd = cycleOf(w.cycle, v.stats.agi);
  v.anim = w.anim; v.animClock = 0;
  const e = resolve(sim, target);
  if (e) v.facing = entX(e) >= v.x ? 'right' : 'left';
}

function resolveSwing(sim: Sim, v: Villager, target: Target): void {
  const e = resolve(sim, target);
  if (!e) return;
  const w = weaponOf(v), d = Math.hypot(entX(e) - v.x, entY(e) - v.y);
  if (w.ranged) {
    if (d > w.range + 1) return;
    sim.projectiles.push({ x: v.x, y: v.y - 0.4, tx: entX(e), ty: entY(e), speed: 14, dmg: w.damage, type: w.type, from: { x: v.x, y: v.y }, src: v.id, team: v.team, target, chance: d <= w.range / 2 ? RULES.rangedHitNear : RULES.rangedHitFar, kind: w.anim === 'shoot' ? 'arrow' : 'stone' });
    return;
  }
  if (d > w.range + 1.1) return; // the target stepped away: the blow misses
  let behind = false;
  if (e.kind === 'unit') behind = (e.v.facing === 'right' && v.x < e.v.x) || (e.v.facing === 'left' && v.x > e.v.x);
  else behind = (e.a.dir === 1 && v.x < e.a.x) || (e.a.dir === -1 && v.x > e.a.x);
  hurt(sim, target, damageOf(w, v.stats.str, null, behind), w.type, { x: v.x, y: v.y }, { unit: v });
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

/** Once a second: morale drifts with the situation. */
export function tickMorale(sim: Sim, v: Villager): void {
  const near = threatsOf(sim, v, 9);
  const allies = (v.team === 'player' ? sim.villagers : sim.foes.filter((f) => f.team === v.team)).filter((o) => o !== v && o.health > 0 && o.down <= 0 && Math.hypot(o.x - v.x, o.y - v.y) < 8).length;
  let m = v.morale;
  if (near.length) {
    m += near.length > allies + 1 ? MORALE.outnumbered : near.length < allies ? MORALE.outnumbering : 0;
  } else m += (MORALE.start - m) * 0.04 + MORALE.calm;
  if (sim.nearHome(v)) m += MORALE.nearHome * (near.length ? 1 : 0.2);
  if (v.team === 'player' && sim.restTime && !sim.nearHome(v)) m += MORALE.night;
  if (v.leader) m += 0.2;
  else { const lead = (v.team === 'player' ? sim.villagers : sim.foes.filter((f) => f.team === v.team)).find((o) => o.leader && o.health > 0 && Math.hypot(o.x - v.x, o.y - v.y) < 8); if (lead) m += MORALE.leaderNear; else if (allies >= 4) m += MORALE.leaderFar; }
  v.morale = Math.max(0, Math.min(100, m));
}

// ---------------------------------------------------------------- wounded and rescue
/** Count down a fallen unit; a friend standing beside it for a few seconds gets it back on its feet. */
export function tickDown(sim: Sim, v: Villager, dt: number): void {
  v.down -= dt; v.hold = null; v.path = []; v.slide = null;
  const helper = sim.villagers.some((o) => o !== v && o.health > 0 && o.down <= 0 && o.phase !== 'flee' && Math.hypot(o.x - v.x, o.y - v.y) < 1.6);
  v.rescue = helper ? v.rescue + dt : Math.max(0, v.rescue - dt);
  if (v.rescue >= RULES.rescueSeconds) {
    v.down = 0; v.rescue = 0; v.health = v.maxHealth * RULES.rescueHp; v.phase = 'idle'; v.morale = Math.max(v.morale, 40);
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
  v.fight.scan -= dt;
  const scanNow = v.fight.scan <= 0;
  if (scanNow) v.fight.scan = 0.35;
  const threats = scanNow || v.phase === 'flee' || v.phase === 'fight' ? threatsOf(sim, v, SIGHT + 2) : [];

  if (rest) { // a threat wakes the sleeper
    if (scanNow && threats.length && threats[0].d < 7) { v.nightOwl = true; sim.resetTask(v); } else return false;
  }
  if (v.phase === 'flee' || v.fleeT > 0 || (v.morale < MORALE.flee && threats.length)) return fleeBrain(sim, v, dt, threats);

  const fighter = isFighter(v);
  if (!fighter) {
    // Civilians do not fight: anything hostile within sight sends them running to the campfire
    if (threats.length && threats[0].d < 6 && v.phase !== 'fight') { startFlee(sim, v, 8); return true; }
    return assistBrain(sim, v);
  }
  return fightBrain(sim, v, dt, threats);
}

function startFlee(sim: Sim, v: Villager, secs: number): void {
  const keep = v.job, nightOwl = v.nightOwl;
  sim.resetTask(v); v.job = keep; v.nightOwl = nightOwl;
  v.fight.target = null; if (v.fight.mode === 'attack') v.fight.mode = 'none';
  v.phase = 'flee'; v.fleeT = secs;
  const fire = sim.campfire();
  if (fire) v.path = sim.pathTo(v, Math.floor(fire.x + 1), Math.floor(fire.y + 2), 4000);
}

function fleeBrain(sim: Sim, v: Villager, dt: number, threats: Threat[]): boolean {
  if (v.phase !== 'flee') { startFlee(sim, v, 8); return true; }
  v.fleeT -= dt;
  if (threats.length && threats[0].d < 6) v.fleeT = Math.max(v.fleeT, 3); // keep running while they are close
  if (!v.path.length && sim.campfire() && Math.hypot(v.x - sim.campfire()!.x - 1, v.y - sim.campfire()!.y - 1) > 3) { const f = sim.campfire()!; v.path = sim.pathTo(v, Math.floor(f.x + 1), Math.floor(f.y + 2), 4000); }
  if (v.fleeT <= 0 && v.morale >= MORALE.fleeRecover - 10) { v.phase = 'idle'; v.fleeT = 0; v.path = []; return false; }
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
  if (d <= reach) {
    v.path = []; v.slide = null;
    v.facing = x >= v.x ? 'right' : 'left';
    if (!v.swing && v.atkCd <= 0) startSwing(sim, v, e.kind === 'unit' ? { kind: 'unit', id: e.v.id } : { kind: 'animal', id: e.a.id });
    return;
  }
  if (v.swing) return; // finish the blow before moving
  v.fight.repath -= dt;
  if (v.fight.repath <= 0 || !v.path.length) { v.fight.repath = 0.5; v.path = sim.pathTo(v, Math.floor(x), Math.floor(y), 3500); if (!v.path.length) v.fight.repath = 1.5; }
}

function fightBrain(sim: Sim, v: Villager, dt: number, threats: Threat[]): boolean {
  const f = v.fight;
  if (v.phase === 'skin' || v.phase === 'goCarcass') return huntBrain(sim, v, dt, threats);
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
      if (f.mode === 'attack') { if (v.job === 'fight') { f.mode = 'guard'; f.anchor = { x: v.x, y: v.y }; } else f.mode = 'none'; }
      if (dead && dead.state === 'dead' && (v.job === 'hunt' || dead.meat > 0)) { v.loot = dead.id; v.job = 'hunt'; }
      if (v.phase === 'fight') { v.phase = 'idle'; v.path = []; }
      if (sim.nextOrder(v)) return true;
    }
  }
  // 2. auto-engage by stance
  if (v.stance === 'retreat') {
    if (threats.length && threats[0].d < 8) { startFlee(sim, v, 6); return true; }
  } else if (threats.length && f.scan >= 0) {
    const range = f.mode === 'hold' ? weaponOf(v).range + 1.5 : v.stance === 'defensive' ? DEFENSIVE : SIGHT;
    const pick = threats.find((t) => t.d <= range && (!f.anchor || v.stance !== 'defensive' || Math.hypot(t.x - f.anchor.x, t.y - f.anchor.y) < DEFENSIVE + 2));
    if (pick) { f.target = pick.t; const e = resolve(sim, pick.t); if (e) { engage(sim, v, e, dt); return true; } }
  }
  // 3. attack-move: keep walking to the destination
  if (f.mode === 'attackMove' && f.dest) {
    if (Math.hypot(f.dest.x - v.x, f.dest.y - v.y) < 1.5) { f.mode = 'guard'; f.anchor = { x: f.dest.x, y: f.dest.y }; f.dest = null; v.path = []; v.phase = 'idle'; if (sim.nextOrder(v)) return true; }
    else { if (!v.path.length) v.path = sim.pathTo(v, Math.floor(f.dest.x), Math.floor(f.dest.y), 20000); v.phase = 'move'; return true; }
  }
  if (f.mode === 'hold') { v.phase = 'idle'; v.path = []; return true; }
  // 4. nothing to fight: hunters hunt, warriors stand guard by the fire
  if (v.job === 'hunt') return huntBrain(sim, v, dt, threats);
  if (v.phase === 'fight') { v.phase = 'idle'; v.path = []; }
  if (v.job === 'fight') {
    // the post: where the unit was told to stand, else beside the village fire
    const fire = sim.campfire(), post = f.mode === 'guard' && f.anchor ? { x: f.anchor.x, y: f.anchor.y, slack: 2 } : fire ? { x: fire.x + 1 + (v.id % 3) - 1, y: fire.y + 3, slack: 5 } : null;
    if (post && v.phase === 'idle' && !v.path.length && Math.hypot(v.x - post.x, v.y - post.y) > post.slack) { v.path = sim.pathTo(v, Math.floor(post.x), Math.floor(post.y), 4000); v.phase = 'move'; return true; }
    return v.phase === 'move' || v.phase === 'idle';
  }
  return false;
}

// ---------------------------------------------------------------- hunting
function huntBrain(sim: Sim, v: Villager, dt: number, threats: Threat[]): boolean {
  if (v.phase === 'skin') {
    v.timer -= dt; v.anim = 'build'; // crouched over the carcass
    if (v.timer > 0) return true;
    const a = sim.animalById.get(v.loot);
    v.phase = 'idle'; v.loot = -1;
    if (!a) return true;
    const have = v.carry && v.carry.res === 'food' ? v.carry.amount : 0, take = Math.min(a.meat, CARRY_CAP.food - have);
    if (take > 0) { a.meat -= take; v.carry = { res: 'food', amount: have + take }; }
    if (a.hide > 0) { sim.stock.hide = Math.min(sim.capacity(), sim.stock.hide + a.hide); sim.say(`${v.name} lột da ${animalDef(a).name.toLowerCase()}: ${a.hide} da và xương.`); a.hide = 0; }
    return true;
  }
  if (v.phase === 'goCarcass') {
    const a = sim.animalById.get(v.loot);
    if (!a || a.state !== 'dead' || (a.meat <= 0 && a.hide <= 0)) { v.phase = 'idle'; v.loot = -1; v.path = []; return true; }
    if (Math.hypot(a.x - v.x, a.y - v.y) < 1.5) { v.path = []; v.phase = 'skin'; v.timer = BEHAVIOUR.skinSeconds; v.facing = a.x >= v.x ? 'right' : 'left'; return true; }
    if (!v.path.length) { v.path = sim.pathTo(v, Math.floor(a.x), Math.floor(a.y), 3000); if (!v.path.length) { v.phase = 'idle'; v.loot = -1; } }
    return true;
  }
  if (v.phase === 'move' && v.path.length) return true; // told to walk somewhere: arrive first, then hunt on
  if (v.carry && v.carry.amount >= CARRY_CAP[v.carry.res]) { sim.planDeliver(v); return true; }
  // a carcass waiting to be skinned
  const N = sim.world.size;
  let best: Animal | null = null, bd = 45;
  if (v.loot >= 0) { const a = sim.animalById.get(v.loot); if (a && a.state === 'dead') best = a; else v.loot = -1; }
  if (!best) for (const a of sim.animals) {
    if (a.state !== 'dead' || (a.meat <= 0 && a.hide <= 0) || sim.fog.state[Math.floor(a.y) * N + Math.floor(a.x)] === 0) continue;
    const d = Math.hypot(a.x - v.x, a.y - v.y);
    if (d < bd) { bd = d; best = a; }
  }
  if (best) { v.loot = best.id; v.phase = 'goCarcass'; v.path = sim.pathTo(v, Math.floor(best.x), Math.floor(best.y), 3000); return true; }
  // living prey
  if (!threats.length) {
    let prey: Animal | null = null; bd = 40;
    for (const a of sim.animals) {
      const def = animalDef(a);
      if (a.state === 'dead' || !def.prey || sim.fog.state[Math.floor(a.y) * N + Math.floor(a.x)] === 0) continue;
      if (def.defends && !sim.packNear(v, a)) continue; // a boar is only taken on by a group
      const d = Math.hypot(a.x - v.x, a.y - v.y);
      if (d < bd) { bd = d; prey = a; }
    }
    if (prey) { v.fight.target = { kind: 'animal', id: prey.id }; engage(sim, v, { kind: 'animal', a: prey }, 0); return true; }
  }
  if (v.carry && v.carry.amount > 0) { sim.planDeliver(v); return true; }
  if (v.phase === 'fight') { v.phase = 'idle'; v.path = []; }
  sim.wait(v, 2);
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
    if (score(id) > bs) { bs = score(id); best = id; }
  }
  return best;
}

void ANIMALS; void TRIBES;
