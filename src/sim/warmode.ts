/**
 * War mode: while an attack plan is on (the army forms up, marches, fights, falls back), the Sim works only on the war.
 * This file answers who is in it; the loop that does only the war's work is `tickWar` in simwar.ts, and the meals are paid for at the end (economy.eatWar).
 */
import type { Sim } from './sim';
import type { Plan, Villager } from './model';

/** The attack plan that is on, if any. Only one may be on at a time. */
export const warPlan = (sim: Sim): Plan | undefined => sim.plans.find((p) => p.kind === 'attack' && p.status === 'running');

/** The tribe being attacked, while a war is on. Its village goes on as usual; every other tribe stands still. */
export const warTribe = (sim: Sim): string | null => warPlan(sim)?.tribe ?? null;

/** The soldiers of the squads in the plan: the army that marches (and is slowed, fed and tired by it). */
export function army(sim: Sim): Set<number> {
  const ids = new Set<number>();
  for (const p of sim.plans) {
    if (p.kind !== 'attack' || p.status !== 'running' || p.skirmish) continue; // the soldiers of a skirmish are not an army on the march: no hunger, tiredness or slow (see `ranks`)
    for (const m of p.missions) { const s = sim.squadById(m.squad); if (s) for (const v of sim.squadUnits(s)) ids.add(v.id); }
    for (const id of p.supplyIds) ids.add(id); // the supply soldiers march with it
  }
  return ids;
}

/** Who still works while the war is on: the army, and the scouts out on a trip. Everyone else goes home and stands still. */
export function ranks(sim: Sim, soldiers: Set<number> = army(sim)): Set<number> {
  const ids = new Set(soldiers);
  for (const p of sim.plans) if (p.skirmish && p.status === 'running') { // a skirmish freezes nobody who soldiers (foot, throwers, riders, in any camp): the player may still send more of them in
    for (const id of p.skirmish.ids) ids.add(id);
    for (const v of sim.villagers) if (v.team === 'player' && v.job === 'fight' && v.health > 0) ids.add(v.id);
  }
  for (const m of sim.scouts) for (const id of m.ids) ids.add(id);
  return ids;
}

/**
 * Someone who is not in the war goes home at once: into the bed of their house (listed there, out of sight), or, with no bed, out of sight where they stand.
 * Nobody walks about, and nobody is drawn or animated, while the war is on. When it is over the ordinary tick wakes them and they take up their work again.
 */
export function standDown(sim: Sim, v: Villager, _dt: number): void {
  if (v.down > 0 || v.health <= 0) return;
  if (v.inside !== null) return;
  if (v.phase === 'sleep') { v.inTent = true; return; } // lying on the ground by the fire: out of sight too
  sim.clearCombat(v); sim.goHome(v);
  const bed = v.phase === 'goHome' && v.target >= 0 ? sim.getBuilding(v.target) : undefined;
  if (bed && bed.done) { sim.sleepIn(v, bed); return; }
  v.path = []; v.slide = null; v.phase = 'sleep'; v.inTent = true; v.anim = 'idle'; v.hold = null;
}
