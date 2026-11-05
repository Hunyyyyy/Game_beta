/**
 * Marching an army (data/war.json): the more squads and soldiers in the plan, the slower it goes and the more it eats and tires.
 * One soldier of one squad already loses `slowMin` of his speed; the load adds to it up to `slowMax`. Research may cut the slow (never below `slowFloor`).
 * Food and energy are multiplied by `base + (slow - slowMin)`: one soldier eats `base` times his ration, the biggest army more.
 */
import warJson from '../data/war.json';
import type { Plan } from './model';
import { rationAt } from './resources';
import { statBonus } from './research';
import type { Sim } from './sim';

export const WAR_DATA = warJson as { advanced: boolean; advancedBuildings: string[]; retreat: { graceSeconds: number; doneShare: number }; march: { slowMin: number; slowMax: number; perSquad: number; perSoldier: number; slowFloor: number; paceScale: number; maxCut: number; foodBase: number; energyBase: number }; research: Record<string, number>; supply: { load: number; trail: number; defaultDays: number; maxDays: number; hungerSmooth: number }; tent: { woodBase: number; hideBase: number; perLevel: number; buildSeconds: number; buildReach: number; refund: number; weight: number; near: number }; tired: { below: number; maxPenalty: number }; harass: { first: number; every: number; base: number; perWarriors: number; max: number; range: number; minFromVillage: number; spawnDist: number; life: number; maxAlive: number } };

export interface March { squads: number; soldiers: number; slow: number; speed: number; food: number; energy: number }
/** How much one supply soldier carries: the base load and what the research Tải hậu cần adds. */
export const supplyLoad = (sim: Pick<Sim, 'researched'>): number => WAR_DATA.supply.load * (1 + statBonus(sim.researched, 'march_army', 'mload') / 100);
export const PEACE: March = { squads: 0, soldiers: 0, slow: 0, speed: 1, food: 1, energy: 1 };

/** The share of the slow research has cut off, 0 to maxCut. */
export function slowCut(sim: Pick<Sim, 'researched'>): number {
  let cut = 0;
  for (const [tech, share] of Object.entries(WAR_DATA.research)) if (sim.researched.has(tech)) cut += share;
  return Math.min(WAR_DATA.march.maxCut, cut);
}

/** How a march of this many squads and soldiers goes. */
export function marchOf(sim: Pick<Sim, 'researched' | 'era'>, squads: number, soldiers: number): March {
  if (sim.era !== 'ancient') return { squads, soldiers, slow: 0, speed: 1, food: 1, energy: 1 }; // the quick war of the stone age: the army is not slowed, and eats what a soldier eats
  const k = WAR_DATA.march, load = Math.max(0, Math.min(1, k.perSquad * Math.max(0, squads - 1) + k.perSoldier * Math.max(0, soldiers - 1)));
  const raw = k.slowMin + (k.slowMax - k.slowMin) * load;
  const slow = Math.max(k.slowFloor, raw * (1 - slowCut(sim))); // however much research cuts, the army never marches faster than this
  const extra = Math.max(0, slow - k.slowMin);
  return { squads, soldiers, slow, speed: (1 - slow) * k.paceScale * (1 + statBonus(sim.researched, 'march_army', 'mspeed') / 100), food: k.foodBase + extra, energy: k.energyBase + extra };
}

/** The soldiers a plan has (alive, in its squads). */
export const soldiersOf = (sim: Sim, plan: Plan): number => plan.missions.reduce((n, m) => { const s = sim.squadById(m.squad); return n + (s ? sim.squadUnits(s).length : 0); }, 0);

/** The supply soldiers of a plan: those on the march, or (before it is deployed) those it would take. */
export const supplyCount = (sim: Sim, plan: Plan): number => plan.status === 'running' ? plan.supplyIds.filter((id) => (sim.get(id)?.health ?? 0) > 0).length : Math.min(plan.supply, sim.villagers.filter((v) => v.job === 'supply' && v.health > 0 && v.down <= 0).length);

/** The march of a plan as it stands now: the supply soldiers go along as a squad of their own. */
export function marchOfPlan(sim: Sim, plan: Plan): March {
  const sup = supplyCount(sim, plan);
  const m = marchOf(sim, plan.missions.filter((m) => { const s = sim.squadById(m.squad); return s && sim.squadUnits(s).length; }).length + (sup ? 1 : 0), soldiersOf(sim, plan) + sup);
  // the march out (to the cells of the plan, then along the arrows) is the long walk (paceScale); falling back or going home goes at the pace of the slow alone
  return plan.status === 'running' && (plan.stage === 'retreat' || plan.stage === 'recall') ? { ...m, speed: 1 - m.slow } : m;
}

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const days1 = (sim: Sim, sec: number): string => `${Math.max(0.1, Math.round((sec / sim.dayLen) * 10) / 10).toLocaleString('vi')} ngày`;

/** What the war council says of the march: the slow, what a soldier eats and how tired he gets, how many days each way and what the army eats in all. */
export function marchLines(sim: Sim, plan: Plan): string[] {
  const m = marchOfPlan(sim, plan);
  if (!m.soldiers) return [];
  const level = sim.campfire()?.level ?? 1, ration = rationAt(level, true), out: string[] = [];
  out.push(`Hành quân: ${m.squads} đội, ${m.soldiers} lính → đi chậm ${pct(m.slow)} (chỉ còn ${pct(m.speed)} tốc độ thường). Càng nhiều đội và lính càng chậm${slowCut(sim) > 0 ? `; nghiên cứu đã giảm ${pct(slowCut(sim))} mức chậm` : ''}.`);
  out.push(`Một lính ăn ${ration} → ${(ration * m.food).toFixed(1)} thức ăn mỗi ngày (×${m.food.toFixed(2)}); sức tiêu hao ×${m.energy.toFixed(2)}. Lúc về tính lại theo số lính còn sống.`);
  let longest = 0;
  for (const mi of plan.missions) {
    const s = sim.squadById(mi.squad), start = s ? sim.missionStart(mi) : null;
    if (!s || !start || !mi.path.length) continue;
    longest = Math.max(longest, sim.routeTime(s, start, mi.path).total / m.speed);
  }
  if (longest > 0) {
    const trip = longest * 2;
    out.push(`Thời gian: đi khoảng ${days1(sim, longest)}, về tương tự (cả chuyến chưa kể đánh nhau: ${days1(sim, trip)}). Quân ăn khoảng ${Math.round((m.soldiers * ration * m.food * trip) / sim.dayLen)} thức ăn trong cả chuyến.`);
  }
  return out;
}
