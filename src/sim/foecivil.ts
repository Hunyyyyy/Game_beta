import { threatsOf } from './battle';
import { FOE } from './fightpolicy';
import type { Tribe } from './tribes';
import type { Sim, Villager } from './sim';

/** The civilians of a village: when danger comes they run to the nearest house and hide in it (out of sight, nobody can hit them) until nobody hostile is about. */
/** The house of the village nearest to a man (within `within` tiles of its edge, when given): where a civilian runs when danger comes. */
function houseNear(t: Tribe, f: Villager, within = Infinity): Tribe['props'][number] | null {
  let best: Tribe['props'][number] | null = null, bd = Infinity;
  for (const p of t.props) {
    if (p.kind !== 'house' || p.hp <= 0) continue;
    const d = Math.hypot(p.x + p.w / 2 - f.x, p.y + p.h / 2 - f.y);
    if (d < bd && d - Math.max(p.w, p.h) / 2 <= within) { best = p; bd = d; }
  }
  return best;
}

/** Hiding or running for a house takes the civilian's turn: true when it did (a civilian who is neither is left to the common brain). */
export function civilianBrain(sim: Sim, f: Villager, t: Tribe, ai: NonNullable<Villager['ai']>, dt: number, free: boolean, scanNow: boolean, threats: Array<{ d: number }>): boolean {
  if (ai.tower) return false; // a man of a tower is hidden in it (`inTent`) until the tower falls (brainfoe clears `ai.tower` then): he is no civilian who left his house
  // a civilian who ran into a house stays in it (out of sight, nobody can hit him) until nobody hostile is about, or the house is gone
  if (f.inTent) {
    f.phase = 'idle'; f.path = []; f.slide = null;
    if (free && houseNear(t, f, 4) && !(scanNow && !threatsOf(sim, f, FOE.hideWatch).length)) return true;
    f.inTent = false;
  }
  // fleeing: an unarmed civilian meets a threat and runs for the nearest house of his village (the fire when there is none)
  if (free && (f.fleeT > 0 || (ai.role === 'civ' && threats.length && threats[0].d < FOE.civFlee))) {
    const home = houseNear(t, f), gx = home ? Math.floor(home.x + home.w / 2) : Math.floor(ai.camp.x), gy = home ? home.y + home.h : Math.floor(ai.camp.y);
    if (f.fleeT <= 0) { f.fleeT = 6; f.fight.target = null; f.path = sim.pathTo(f, gx, gy, 3000); }
    f.fleeT -= dt; f.phase = 'flee';
    if (home && Math.hypot(home.x + home.w / 2 - f.x, home.y + home.h / 2 - f.y) <= Math.max(home.w, home.h) / 2 + 1.6) { f.inTent = true; f.path = []; f.slide = null; f.phase = 'idle'; f.fleeT = 0; return true; }
    if (threats.length && threats[0].d < FOE.civKeepRunning) f.fleeT = Math.max(f.fleeT, 2);
    if (!f.path.length && Math.hypot(f.x - gx, f.y - gy) > 3) f.path = sim.pathTo(f, gx, gy, 3000);
    return true;
  }
  return false;
}
