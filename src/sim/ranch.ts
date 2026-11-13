/** The Trại chăn nuôi of the medieval age: the people inside raise beasts, and each product of the house (hide, fibre, sinew, feathers) comes in by itself (recipes: src/data/ranch.json). */
import { levelDef } from './buildings';
import { perkPct } from './research';
import { productsAt } from './ranchdata';
import type { RanchProduct } from './ranchdata';
import type { Building } from './buildings';
import { RES_NAME } from './resources';
import type { Sim } from './sim';
import type { Villager } from './model';

/** How much of a good a ranch makes in a day with the people inside it now (an estimate for its panel: the night and the rest are left out). */
export function dailyOf(sim: Sim, b: Building, p: RanchProduct): number {
  const rate = sim.houseRate(b) * (1 + perkPct(sim.researched, 'ranchYield') / 100);
  return (rate * sim.dayLen * 0.65 * sim.paceWork * p.per) / p.time;
}

/** Work inside the ranches: whoever is at their post moves every product of the house on; a unit made goes to the store of its good. */
export function tickRanch(sim: Sim, dt: number): void {
  for (const b of sim.buildings) {
    if (!b.done || b.kind !== 'ranch') continue;
    const staff = b.staff.map((id) => sim.byId.get(id)).filter((v): v is Villager => !!v && v.phase === 'inside');
    if (!staff.length && !sim.dev.freeWorks) continue;
    let rate = 0;
    for (const v of staff) { rate += sim.workFactor(v, 'herd'); sim.gainXp(v, 'herd', dt); }
    rate *= levelDef(b).craftSpeed * (1 + perkPct(sim.researched, 'ranchYield') / 100); // the research of the herdsmen: more from every beast
    const grown = (b.grown ??= {});
    for (const p of productsAt(b.level)) {
      const g = sim.dev.fastWorks ? 1 : Math.min(1, (grown[p.res] ?? 0) + (dt * sim.paceWork * rate) / p.time);
      if (g < 1) { grown[p.res] = g; continue; }
      if (sim.stock[p.res] + p.per > sim.capacity(p.res)) { // the store of the good is full: what is made waits for room
        grown[p.res] = 1;
        if (sim.time - sim.lastFullWarn > 30) { sim.lastFullWarn = sim.time; sim.say(`Kho đã đầy ${RES_NAME[p.res].toLowerCase()}, trại chăn nuôi chờ chỗ.`); }
        continue;
      }
      sim.stock[p.res] += p.per; sim.noteYield(`herd.${p.res}`, p.per);
      grown[p.res] = 0;
    }
  }
}
