/**
 * The quick war of the stone age (before the medieval era): in place of the war plan the Lều họp chiến lists the villages somebody has seen,
 * each with a button "Đánh". It sends the whole army (every soldier of the camps of foot, throwers and riders; the guards and the men of the towers stay)
 * straight at the village as one squad of each arm, the war goes on as ever (fighting, falling back, going home) but the army is not slowed and eats little.
 */
import { createSquad, disbandSquad } from './army';
import { addMission, engagePlan, newPlan } from './warplan';
import { warPlan } from './warmode';
import * as warlog from './warlog';
import * as warsupply from './warsupply';
import { tribeOf } from './tribes';
import type { Arm } from './formations';
import type { Sim } from './sim';
import type { Villager } from './model';

const ARM_NAME: Record<Arm, string> = { foot: 'Bộ binh', archer: 'Cung thủ', cavalry: 'Kỵ binh' };

/** The soldiers who would go: every one of the camps, on his feet (the guards and the men of the towers keep their posts). */
export function army(sim: Sim): Villager[] {
  return sim.mine(sim.villagers.filter((v) => v.job === 'fight' && !v.guard && v.post < 0 && v.health > 0).map((v) => v.id)).filter((v) => v.job === 'fight');
}

/** Send the army at a village that has been found. Returns an error or null. */
export function quickAttack(sim: Sim, tribeId: string): string | null {
  if (sim.era === 'ancient') return 'Thời Trung cổ đánh bằng Lều họp chiến, không còn đánh nhanh'; // the quick war is of the stone age only
  if (warPlan(sim)) return 'Đang có chiến tranh';
  const attacked = sim.attackReason();
  if (attacked) return `Làng đang bị tấn công (${attacked.toLowerCase()}): không thể đi đánh`;
  const t = tribeOf(sim, tribeId as never);
  if (!t || t.state !== 'free') return 'Làng này không còn là kẻ địch';
  if (!sim.isFound(tribeId)) return 'Chưa phát hiện làng này';
  if (!army(sim).length) return 'Chưa có lính nào ra trận: tuyển lính ở các trại';
  sim.summonAllies(t); // the villages that stand by us send their soldiers, who go with the army
  const men = army(sim);
  // a clean start: the squads and the plan of the last quick war are gone
  for (const p of sim.plans.filter((x) => x.quick && x.status !== 'running')) sim.plans.splice(sim.plans.indexOf(p), 1);
  for (const v of men) { sim.leaveSquad([v.id]); }
  const plan = newPlan(sim, 'attack', tribeId); plan.quick = true;
  for (const arm of ['foot', 'archer', 'cavalry'] as const) {
    const group = men.filter((v) => sim.armOf(v) === arm);
    if (!group.length) continue;
    const s = createSquad(sim, ARM_NAME[arm], true).squad!;
    for (const v of group) { v.squad = s.id; s.ids.push(v.id); }
    addMission(sim, plan, s.id, 0); // the stone age has no threshold: nobody falls back on his own, the player presses Rút lui
    plan.missions[plan.missions.length - 1].ordered = true; // no arrow: it goes for the village
  }
  for (const m of plan.missions) { const s = sim.squadById(m.squad)!; m.state = 'wait'; m.initial = sim.squadUnits(s).length; m.leg = 0; m.block = null; }
  warsupply.loadPacks(sim, plan); warlog.begin(sim, plan);
  plan.status = 'running'; plan.stage = 'ready'; plan.startedAt = sim.time; plan.signal = false; plan.result = ''; plan.endedAt = 0;
  engagePlan(sim, plan);
  sim.say(`Toàn quân (${men.length} lính) xuất phát đánh ${t.def.name}!`);
  return null;
}

/** The war is over: the squads of a quick war are let go, and the soldiers go back to their camps. */
export function cleanup(sim: Sim): void {
  sim.dismissAllies();
  for (const p of sim.plans) {
    if (!p.quick || p.status === 'running') continue;
    for (const m of [...p.missions]) {
      const s = sim.squadById(m.squad); if (!s) continue;
      const ids = [...s.ids];
      disbandSquad(sim, s.id);
      for (const id of ids) { const v = sim.byId.get(id); if (v && v.job === 'fight' && !v.ally) { sim.clearCombat(v); v.recall = true; } }
    }
  }
}
