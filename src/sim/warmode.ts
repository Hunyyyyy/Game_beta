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
    if (p.kind !== 'attack' || p.status !== 'running') continue;
    for (const m of p.missions) { const s = sim.squadById(m.squad); if (s) for (const v of sim.squadUnits(s)) ids.add(v.id); }
    for (const id of p.supplyIds) ids.add(id); // the supply soldiers march with it
  }
  return ids;
}

/** Who still works while the war is on: the army, and the scouts out on a trip. Everyone else goes home and stands still. */
export function ranks(sim: Sim, soldiers: Set<number> = army(sim)): Set<number> {
  const ids = new Set(soldiers);
  for (const m of sim.scouts) for (const id of m.ids) ids.add(id);
  return ids;
}

/**
 * One tick of someone who is not in the war: drop whatever they were doing and walk home to bed (goHome); once indoors, or asleep where they stood
 * (nowhere to go), they do nothing at all. When the war is over the ordinary tick wakes them and they take up their work again.
 */
export function standDown(sim: Sim, v: Villager, dt: number): void {
  if (v.inside !== null || v.phase === 'sleep' || v.down > 0 || v.health <= 0) return;
  if (v.phase !== 'goHome') { sim.clearCombat(v); sim.goHome(v); }
  sim.moveUnit(v, dt);
  sim.animate(v, dt);
}
