/**
 * The log of the wars (Sim.warLog, shown in the Lều họp chiến): for each war, the map fought, who went and how many fell, what was taken and what was spent.
 * The counts are kept in `Plan.stats` while the war is on and made into a record (`finish`) when it is over.
 */
import { armOf } from './battle';
import type { ArmCount, Plan, WarRecord, WarStats } from './model';
import type { Res } from './resources';
import type { Sim } from './sim';

const arms = (): ArmCount => ({ foot: 0, archer: 0, cavalry: 0 });

/** The plan that is on and has counts, if any. */
const live = (sim: Sim): Plan | undefined => sim.plans.find((p) => p.kind === 'attack' && p.status === 'running' && p.stats);

/** The deployment: who goes, by arm, and the goods the supply soldiers set out with. */
export function begin(sim: Sim, plan: Plan): void {
  const sent = arms();
  for (const m of plan.missions) { const s = sim.squadById(m.squad); if (s) for (const v of sim.squadUnits(s)) sent[armOf(v)]++; }
  const loaded = { food: 0, wood: 0, hide: 0 };
  for (const id of plan.supplyIds) { const p = sim.get(id)?.pack; if (p) { loaded.food += p.food; loaded.wood += p.wood; loaded.hide += p.hide; } }
  plan.stats = { startDay: sim.day, fought: false, sent, dead: arms(), supplySent: plan.supplyIds.length, supplyDead: 0, loaded, returned: { food: 0, wood: 0, hide: 0 }, loot: {} } satisfies WarStats;
}

/** A soldier or supply soldier of the army fell. */
export function noteDeath(sim: Sim, id: number, supply: boolean, arm: keyof ArmCount): void {
  const plan = live(sim);
  if (!plan?.stats || !sim.warIds.has(id)) return;
  if (supply) plan.stats.supplyDead++; else plan.stats.dead[arm]++;
}

/** Goods taken from the village that was beaten. */
export function noteLoot(sim: Sim, tribe: string, res: Res, n: number): void {
  const plan = sim.plans.find((p) => p.kind === 'attack' && p.status === 'running' && p.stats && p.tribe === tribe);
  if (plan?.stats) plan.stats.loot[res] = (plan.stats.loot[res] ?? 0) + n;
}

/** The goods that came home in the packs. */
export function noteReturned(plan: Plan, food: number, wood: number, hide: number): void {
  if (plan.stats) { plan.stats.returned.food += food; plan.stats.returned.wood += wood; plan.stats.returned.hide += hide; }
}

/** The war is over: put the counts of its plan into the log. `meals` is what the village that stayed home ate meanwhile. */
export function finish(sim: Sim, meals: number): void {
  for (const plan of sim.plans) {
    const st = plan.stats;
    if (!st || plan.kind !== 'attack') continue;
    const t = sim.tribes.find((x) => x.id === plan.tribe);
    const rec: WarRecord = {
      id: sim.warLog.length + 1, tribe: plan.tribe ?? '', name: t?.def.name ?? 'địch', mapLevel: t ? sim.mapLevel(t.id) : 0, startDay: st.startDay, endDay: sim.day,
      days: Math.max(0, sim.time - (sim.warSince >= 0 ? sim.warSince : plan.startedAt)) / 1200, result: plan.result || (st.fought ? 'lost' : 'off'), squads: plan.missions.length,
      sent: st.sent, dead: st.dead, supplySent: st.supplySent, supplyDead: st.supplyDead,
      spent: { food: Math.max(0, Math.round(st.loaded.food - st.returned.food + meals)), wood: Math.max(0, Math.round(st.loaded.wood - st.returned.wood)), hide: Math.max(0, Math.round(st.loaded.hide - st.returned.hide)) },
      loot: st.loot,
    };
    sim.warLog.push(rec);
    plan.stats = null;
  }
}
