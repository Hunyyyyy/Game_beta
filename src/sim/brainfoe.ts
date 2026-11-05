import { engage, resolve, tickCommon, threatsOf } from './battle';
import { endLife, lifeBrain, tribeReach } from './tribework';
import { civilianBrain } from './foecivil';
import { keepPost, raiderBrain, siegeBrain, towerBrain, towerOf } from './foewar';
import { harassBrain } from './warharass';
import { FOE } from './fightpolicy';
import { tribeOf, tribeWilling } from './tribes';
import type { Tribe } from './tribes';
import type { Sim, Villager } from './sim';

/**
 * The brain of a person of a village (a guard, a civilian, a raider, a man of a tower). The blows, the chase and the threats he shares with our own
 * people are in battle.ts; what is his own is here: his post, his leash, the civilian who hides in a house, the raider who marches on the fire.
 */
const { aggro: AGGRO, leash: LEASH } = FOE;

function wander(sim: Sim, f: Villager, radius: number): void {
  const ai = f.ai!;
  for (let i = 0; i < 6; i++) {
    const a = sim.frnd() * Math.PI * 2, r = 1.5 + sim.frnd() * radius;
    const g = sim.nearestFree(Math.floor(ai.camp.x + Math.cos(a) * r), Math.floor(ai.camp.y + Math.sin(a) * r), new Set());
    if (g) { f.path = sim.pathTo(f, g[0], g[1], 2500); f.phase = f.path.length ? 'move' : 'idle'; break; }
  }
  ai.wander = 4 + sim.frnd() * 8;
}

const emptyCache = new WeakMap<Sim, { t: number; on: boolean }>();
/** Nobody of ours (villager or soldier) is out of doors: the raiders have nobody to fight and turn on the houses. */
function nobodyOutside(sim: Sim): boolean {
  const c = emptyCache.get(sim);
  if (c && c.t === sim.time) return c.on;
  const on = !sim.villagers.some((v) => v.team === 'player' && v.health > 0 && v.down <= 0 && v.inside === null);
  emptyCache.set(sim, { t: sim.time, on });
  return on;
}

export function tickFoe(sim: Sim, f: Villager, dt: number): void {
  tickCommon(sim, f, dt);
  const t = tribeOf(sim, f.team), ai = f.ai;
  if (ai && ai.role === 'raider' && !ai.siege && !f.fight.target && f.phase !== 'fight' && Math.floor(sim.time) !== Math.floor(sim.time - dt) && (Math.floor(sim.time) + f.id) % 2 === 0 && nobodyOutside(sim)) {
    const house = sim.nearestWork(f.x, f.y, 70, true);
    if (house) ai.siege = house.id;
  }
  if (ai?.life && ai.life.kind !== 'hunt' && (f.phase === 'flee' || f.fleeT > 0 || f.fight.target)) endLife(sim, f); // danger ends the work
  if (t && ai) foeBrain(sim, f, t, ai, dt);
  sim.moveUnit(f, dt);
  sim.animate(f, dt);
}

function foeBrain(sim: Sim, f: Villager, t: Tribe, ai: NonNullable<Villager['ai']>, dt: number): void {
  const free = t.state === 'free';
  const tower = ai.tower ? towerOf(sim, t, ai) : null;
  if (ai.tower && !tower) { ai.tower = undefined; ai.post = undefined; f.inTent = false; } // his tower fell: he is a guard of the village again
  f.fight.scan -= dt;
  const reach = tribeReach(t), willing = tribeWilling(sim, t.id);
  // the soldiers of a village that will fight go out to anyone who walks onto its land
  const radius = tower ? tower.reach : ai.role === 'raider' ? FOE.raiderSight : ai.role === 'civ' ? FOE.civSight : Math.max(AGGRO[t.def.personality], willing ? Math.min(reach, FOE.willingReach) : 0);
  const scanNow = f.fight.scan <= 0;
  if (scanNow) f.fight.scan = 0.4;
  const looking = scanNow || f.phase === 'flee' || (f.phase === 'fight' && !f.fight.target); // see brainPlayer: a unit busy with a target needs no new look every tick
  // the men of a tower look out from the tower, not from the foot of it where they stand (each one a little further in): all of them see as far as the tower does, on every side
  const cx = tower ? tower.p.x + tower.p.w / 2 : f.x, cy = tower ? tower.p.y + tower.p.h / 2 : f.y, off = Math.hypot(f.x - cx, f.y - cy);
  const found = free && looking ? threatsOf(sim, f, radius + off).filter((x) => !(ai.skip && sim.time < ai.skip.until && x.t.kind === 'unit' && x.t.id === ai.skip.id) && (tower || ai.role !== 'guard' || Math.hypot(x.x - ai.camp.x, x.y - ai.camp.y) <= reach + 3 || x.d < AGGRO[t.def.personality])) : [];
  const threats = tower ? found.map((x) => ({ ...x, d: Math.hypot(x.x - cx, x.y - cy) })).filter((x) => x.d <= radius).sort((a, b) => a.d - b.d) : found;
  if (!free) { f.fight.target = null; if (f.phase === 'fight') { f.phase = 'idle'; f.path = []; } }

  // a civilian hides in a house, or runs for one, when danger comes (foecivil.ts)
  if (civilianBrain(sim, f, t, ai, dt, free, scanNow, threats)) return;
  if (f.phase === 'flee') { f.phase = 'idle'; f.path = []; }
  if (free && ai.harass !== undefined && harassBrain(sim, f, dt, threats)) return; // a band sent at an army on the march
  // one who was shot from a tower (or stuck at a wall) goes for that work before anything else
  if (free && ai.siege && ai.role !== 'civ') {
    const sb = sim.getBuilding(ai.siege);
    if (!sb || Math.hypot(sb.x - f.x, sb.y - f.y) > 45) ai.siege = 0;
    else if (siegeBrain(sim, f, ai, dt, threats)) return;
  }

  if (free && tower && ai.post) { towerBrain(sim, f, ai, tower, willing, threats); return; }

  if (free && ai.role === 'raider' && t.raid) { raiderBrain(sim, f, t, ai, dt, threats); return; }

  // fight: explicit target (from being hit), or a threat inside the guard radius
  if (free && f.fight.target) {
    const e = resolve(sim, f.fight.target);
    if (e && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) < Math.max(LEASH, reach + 2)) { engage(sim, f, e, dt); return; }
    f.fight.target = null; f.phase = 'idle'; f.path = [];
  }
  if (free && ai.role === 'guard' && threats.length && willing) { f.fight.target = threats[0].t; return; }

  // a guard keeps his watch where he was set: he goes back to his post and stands there, looking out
  if (free && ai.role === 'guard' && ai.post && !f.fight.target) { keepPost(sim, f, ai); return; }
  // otherwise: his daily work where we are looking, else stroll around the camp
  if (free && ai.role !== 'raider' && lifeBrain(sim, f, t, ai, dt)) return;
  if (f.phase === 'fight') { f.phase = 'idle'; f.path = []; }
  ai.wander -= dt;
  if (ai.wander <= 0 && !f.path.length) wander(sim, f, ai.role === 'civ' ? FOE.wanderRadius.civ : t.def.personality === 'aggressive' ? FOE.wanderRadius.aggressive : FOE.wanderRadius.other);
  if (f.phase === 'move' && !f.path.length) f.phase = 'idle';
}
