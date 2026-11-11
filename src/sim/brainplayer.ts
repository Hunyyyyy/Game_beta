import type { Step } from './path';
import { Building, BUILDINGS, BuildingKind, levelDef } from './buildings';
import { homeKind, isFree } from './idle';
import { engage, entX, entY, HUNT_BACK, isFighter, resolve, threatsOf, weaponOf } from './battle';
import type { Threat } from './battle';
import { PLAYER } from './fightpolicy';
import { huntBrain } from './hunting';
import type { Sim, Villager } from './sim';

/**
 * The brain of a unit of ours: what it does when the village is in danger (flee, hide, help the fallen) and when it may fight (stance, orders, the post).
 * The blows, the chase and the threats it shares with the people of the villages are in battle.ts; the brain of those is in brainfoe.ts.
 */
// ---------------------------------------------------------------- the brain of a player unit
const { sight: SIGHT, defensive: DEFENSIVE } = PLAYER;

/** Returns true when combat logic decided what this unit does this tick (so ordinary work is skipped). */
export function brainPlayer(sim: Sim, v: Villager, dt: number): boolean {
  if (v.phase === 'goStore' || v.phase === 'goEquip') return false;
  // the player's word is the highest: a selected unit walking where he was sent does not stop to fight or run from what it meets (they let him go when he is deselected or arrives)
  if (v.fight.obey && (v.phase !== 'move' || !v.path.length)) v.fight.obey = false; // the fall-back is over: he fights again
  if (sim.underOrders(v)) { v.fleeT = 0; return false; }
  // ordered home ("Cho quân về"): he drops the fight and goes to his camp; once inside, or if there is no bed for him, the order is over
  if (v.recall) {
    if (v.inside !== null || !sim.quartered(v)) v.recall = false;
    else { v.fight.target = null; v.fight.mode = 'none'; v.fight.anchor = null; v.queue.length = 0; if (v.phase === 'fight') { v.phase = 'idle'; v.path = []; } return false; }
  }
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
    if (v.job === 'supply' && v.inTent) return false; // the supply soldiers sleep through it: they do not fight
    const watch = isFighter(v) && (v.guard || v.post >= 0 || sim.warIds.has(v.id)); // guards, the men of a tower and the army in the field wake at anything that comes within their sight
    if (scanNow && threats.length && threats[0].d < (watch ? sight : 7)) {
      if (isFighter(v)) v.nightOwl = true;
      if (v.post >= 0 && v.inside !== null && v.phase === 'sleep') { v.phase = 'inside'; return false; } // a tower man wakes where he lies and shoots from the tower (tickTowers)
      sim.resetTask(v);
    } else return false;
  }
  if (v.phase === 'flee' || v.fleeT > 0) return fleeBrain(sim, v, dt, threats);

  if (v.breaks && sim.breakBrain(v, dt)) return true; // hacking down a tree or an enemy work in a war
  const fighter = isFighter(v);
  // a hunter is no soldier: with the village under attack he runs home and hides like the villagers (unless the player sent him somewhere: that order was handled above)
  if (v.job === 'hunt' && v.inside === null && v.phase !== 'sleep' && v.phase !== 'goHome' && scanNow && sim.attackReason() !== null && !v.fight.obey) { startFlee(sim, v, 8, threats[0]); return true; }
  if (!fighter) {
    // Civilians do not fight: anything hostile within sight sends them running to the campfire
    if (threats.length && threats[0].d < FEAR && v.phase !== 'fight') { startFlee(sim, v, 8, threats[0]); return true; }
    // the village is under attack: every civilian runs home (a house with a bed free, else the fire or the soldiers), whether he sees the enemy or not
    if (scanNow && isFree(v) && v.inside === null && v.phase !== 'sleep' && v.phase !== 'goHome' && sim.attackReason() !== null) { startFlee(sim, v, 8); return true; }
    return assistBrain(sim, v);
  }
  return fightBrain(sim, v, dt, threats);
}

/**
 * Where a frightened villager runs: to the nearest soldier of ours who is on his feet (he stands behind him, away from the danger), or else to the
 * campfire (the far side of it from the danger). He does not wander: he gets there and stays until the danger is gone.
 */
function fleeSpot(sim: Sim, v: Villager, from?: { x: number; y: number }): Step[] {
  const fire = sim.campfire();
  let guard: Villager | undefined, gd = 40;
  for (const o of sim.villagers) {
    if (o === v || o.job !== 'fight' || o.health <= 0 || o.down > 0 || o.inside !== null || o.phase === 'flee' || o.phase === 'sleep' || o.phase === 'goHome') continue;
    const d = Math.hypot(o.x - v.x, o.y - v.y);
    if (d < gd) { gd = d; guard = o; }
  }
  const tx = guard ? guard.x : fire ? fire.x + 1 : v.x, ty = guard ? guard.y : fire ? fire.y + 2 : v.y;
  let gx = tx, gy = ty;
  if (from) { const dx = tx - from.x, dy = ty - from.y, len = Math.hypot(dx, dy) || 1; gx += (dx / len) * 1.5; gy += (dy / len) * 1.5; } // behind him, not in front
  const spot = sim.nearestFree(Math.floor(gx), Math.floor(gy), new Set());
  return spot ? sim.pathTo(v, spot[0], spot[1], 4000) : [];
}

/** Who runs into a house when it is dangerous: the villagers and the hunters (soldiers retreat to the fire or a comrade). */
const shelters = (v: Villager): boolean => !isFighter(v) || v.job === 'hunt';

/** How near a danger must be for a civilian to run from it, in tiles. */
const FEAR = PLAYER.fear;

/** Who is in a house, or on his way to hide in it: the beds it has are all it takes, in the danger as at night. */
function crowd(sim: Sim, b: Building, except: Villager): number {
  let n = 0;
  for (const o of sim.villagers) if (o !== except && ((o.inside === b.id && o.phase === 'sleep') || ((o.phase === 'goHome' || o.phase === 'flee') && o.target === b.id))) n++;
  return n;
}

/**
 * The house a frightened civilian runs into, as long as it has a bed free: the house of his trade, and failing that the Nhà dân (the free go
 * straight to the Nhà dân). None with room: he runs on.
 */
function refugeOf(sim: Sim, v: Villager): Building | undefined {
  for (const kind of new Set<BuildingKind>([homeKind(v), 'house'])) {
    let best: Building | undefined, bd = Infinity;
    for (const x of sim.buildings) {
      if (x.kind !== kind || !x.done || crowd(sim, x, v) >= levelDef(x).slots) continue;
      const d = Math.hypot(x.x + 1 - v.x, x.y + 1 - v.y);
      if (d < bd) { bd = d; best = x; }
    }
    if (best) return best;
  }
  return undefined;
}

/** Set off for the refuge; false when there is none with room or no way to it. */
function runToRefuge(sim: Sim, v: Villager): boolean {
  const b = refugeOf(sim, v);
  if (!b) return false;
  const d = BUILDINGS[b.kind];
  if (sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h), 3, 12000) < 0) return false;
  v.target = b.id;
  return true;
}

/** No room anywhere: he runs on, away from the danger (or round the village when it has no direction). */
function runAway(sim: Sim, v: Villager, from?: { x: number; y: number }): Step[] {
  const ang = sim.rnd() * Math.PI * 2, ax = from ? v.x - from.x : Math.cos(ang), ay = from ? v.y - from.y : Math.sin(ang), len = Math.hypot(ax, ay) || 1;
  const spot = sim.nearestFree(Math.floor(v.x + (ax / len) * 12), Math.floor(v.y + (ay / len) * 12), new Set());
  return spot ? sim.pathTo(v, spot[0], spot[1], 4000) : [];
}

export function startFlee(sim: Sim, v: Villager, secs: number, from?: { x: number; y: number }): void {
  const keep = v.job, nightOwl = v.nightOwl;
  sim.resetTask(v); v.job = keep; v.nightOwl = nightOwl;
  v.fight.target = null; if (v.fight.mode === 'attack') v.fight.mode = 'none';
  v.phase = 'flee'; v.fleeT = secs;
  // a civilian runs into the house of his trade (the Nhà dân if he has none) and hides there until it is safe again; with no bed free he runs on.
  // Soldiers and hunters who retreat run to the fire or to a comrade
  if (shelters(v)) { sim.dangerAt = sim.time; if (runToRefuge(sim, v)) return; v.path = runAway(sim, v, from); return; }
  v.path = fleeSpot(sim, v, from);
}

function fleeBrain(sim: Sim, v: Villager, dt: number, threats: Threat[]): boolean {
  if (v.phase !== 'flee') { startFlee(sim, v, 8, threats[0]); return true; }
  const civilian = shelters(v), refuge = civilian && v.target >= 0 ? sim.getBuilding(v.target) : undefined;
  if (civilian) sim.dangerAt = sim.time;
  if (refuge && refuge.done) {
    const d = BUILDINGS[refuge.kind];
    if (Math.hypot(v.x - (refuge.x + d.w / 2), v.y - (refuge.y + d.h / 2)) <= Math.max(d.w, d.h) / 2 + 1.8) {
      if (crowd(sim, refuge, v) < levelDef(refuge).slots) { sim.sleepIn(v, refuge); v.fleeT = 0; return true; } // at the door: if a bed is free he goes in and hides
      v.target = -1; v.timer = 0; // taken meanwhile: he looks for another
    } else {
      v.timer -= dt;
      if (!v.path.length && v.timer <= 0) { v.timer = 1.5; if (!runToRefuge(sim, v)) v.target = -1; }
      return true;
    }
  }
  v.fleeT -= dt;
  if (civilian && sim.attackReason() !== null) v.fleeT = Math.max(v.fleeT, 3); // he stays hidden for as long as the attack goes on
  if (threats.length && threats[0].d < FEAR) v.fleeT = Math.max(v.fleeT, 3); // keep running while they are close
  v.timer -= dt;
  if (v.timer <= 0) {
    v.timer = 1.5;
    if (civilian) { if (runToRefuge(sim, v)) return true; if (!v.path.length) v.path = runAway(sim, v, threats[0]); } // a bed may have come free; if not, on he runs
    else { const way = fleeSpot(sim, v, threats[0]); if (way.length > 2) v.path = way; } // his refuge moves (a soldier): follow it; once there he stays
  }
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

/** Where a soldier stands when he has nothing to do: a guard at his post, the rest at the door of their own camp (the fire when there is no camp). */
/** An attack order that is over, or cannot be carried out: the soldier goes back to his post, to the camp, or stands where he is when he is in a squad. */
export function endOrder(sim: Sim, v: Villager): void {
  const f = v.fight;
  if (v.job !== 'fight') f.mode = 'none';
  else if (v.guard) { f.mode = 'guard'; f.anchor = homeSpot(sim, v) ?? { x: v.x, y: v.y }; }
  else if (v.team === 'player' && v.squad < 0) { f.mode = 'none'; f.anchor = null; }
  else { f.mode = 'guard'; f.anchor = { x: v.x, y: v.y }; }
}

function homeSpot(sim: Sim, v: Villager): { x: number; y: number } | null {
  if (v.guard && v.guardAt) return v.guardAt;
  const camp = sim.buildings.find((b) => b.kind === sim.homeKind(v) && b.done);
  if (camp) return { x: camp.x + 1 + (v.id % 3) - 1, y: camp.y + 3 };
  const fire = sim.campfire();
  return fire ? { x: fire.x + 1 + (v.id % 3) - 1, y: fire.y + 3 } : null;
}

/** Whether a soldier of the camps may go for what he sees: only when the alarm drum sounds, a fight is on, or he has been told to attack. Guards watch for themselves, hunters hunt. */
/** A pack that came for the village (an event's wolves, a raid) is still about, or beasts are biting people near the fire: for the soldiers the fight is on until it is over. Looked up once a tick. */
const aboutCache = new WeakMap<Sim, { t: number; on: boolean }>();
function beastsAbout(sim: Sim): boolean {
  const c = aboutCache.get(sim);
  if (c && c.t === sim.time) return c.on;
  const on = sim.attackReason() !== null || sim.animals.some((a) => a.raid && a.state !== 'dead');
  aboutCache.set(sim, { t: sim.time, on });
  return on;
}

function mayEngage(sim: Sim, v: Villager): boolean {
  if (v.job !== 'fight' || v.guard || v.team !== 'player') return true;
  return sim.alarmUntil > sim.time || beastsAbout(sim) || sim.battle.on || v.fight.mode === 'attack' || v.fight.mode === 'attackMove' || (v.squad >= 0 && sim.plans.some((p) => p.status === 'running'));
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
      if (f.mode === 'attack') endOrder(sim, v); // done: back to his post or the camp (see rest.quartered)
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
