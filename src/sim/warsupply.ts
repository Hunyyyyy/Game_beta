/**
 * The supply soldiers of a war (lính hậu cần, from the Trại hậu cần): they go along with the army, carry its food, follow behind it and defend themselves
 * but do not attack. The army eats from what they carry; when they fall what they carried is lost. What is left when the war ends goes back to the store.
 */
import { FOOD, rationAt } from './resources';
import { marchOf, supplyLoad, WAR_DATA, soldiersOf, supplyCount } from './warmarch';
import { stands, SUPPLY_TENT, tentCost, tentCount, tentLines } from './wartent';
import * as warlog from './warlog';
import { DAY_LENGTH } from './constants';
import type { Plan, Villager } from './model';
import type { Sim } from './sim';

/** The supply soldiers of a plan that are alive. */
export const supplyOf = (sim: Sim, plan: Plan): Villager[] => plan.supplyIds.map((id) => sim.get(id)).filter((v): v is Villager => !!v && v.health > 0);

/** Supply soldiers in their camp, ready to be taken. */
export const supplyAvailable = (sim: Sim): Villager[] => sim.villagers.filter((v) => v.job === 'supply' && v.health > 0 && v.down <= 0 && v.team === 'player');

/** What the army (the soldiers of the plan and `sup` supply soldiers) would eat in a day on the march. */
export function dailyNeed(sim: Sim, plan: Plan, sup: number): number {
  const squads = plan.missions.filter((m) => { const s = sim.squadById(m.squad); return s && sim.squadUnits(s).length; }).length + (sup ? 1 : 0);
  const soldiers = soldiersOf(sim, plan) + sup, m = marchOf(sim, squads, soldiers);
  return soldiers * rationAt(sim.campfire()?.level ?? 1, true) * m.food;
}

/** The food of the village that can be put into the packs: the pot of the campfire and the store. */
const stocked = (sim: Sim): number => sim.foodPot + sim.stock.food;

/** How many days of food the supply soldiers can carry, and what they would be given from the village. */
export function packPlan(sim: Sim, plan: Plan): { sup: number; capacity: number; want: number; give: number; days: number; need: number; wood: number; hide: number } {
  const sup = supplyCount(sim, plan), need = dailyNeed(sim, plan, sup), capacity = sup * supplyLoad(sim), want = need * plan.carryDays;
  // the tents come first (one for each squad): their goods are heavy, and what they take of the load is not left for food
  const cost = tentCost(sim), n = tentCount(sim, plan), wood = Math.min(n * cost.wood, Math.floor(sim.stock.wood)), hide = Math.min(n * cost.hide, Math.floor(sim.stock.hide));
  const room = Math.max(0, capacity - (wood + hide) * WAR_DATA.tent.weight);
  const give = Math.max(0, Math.min(want, room, stocked(sim)));
  return { sup, capacity, want, give, days: need > 0 ? give / need : 0, need, wood: sup ? wood : 0, hide: sup ? hide : 0 };
}

export interface SupplyAdvice { oneWay: number; days: number; food: number; wood: number; hide: number; soldiers: number; have: number }

/**
 * What the army ought to take (the Tính toán hậu cần research): how many days it marches one way (the longest arrow, at the pace of the march), the days of
 * food for there and back and a day of fighting, the wood and hide of a tent for every squad, and the supply soldiers it takes to carry all of that.
 * Null when no squad has an arrow to measure.
 */
export function supplyAdvice(sim: Sim, plan: Plan): SupplyAdvice | null {
  let longest = 0;
  for (const m of plan.missions) { const s = sim.squadById(m.squad), start = s ? sim.missionStart(m) : null; if (s && start && m.path.length) longest = Math.max(longest, sim.routeTime(s, start, m.path).total); }
  if (longest <= 0) return null;
  let sup = Math.max(1, plan.supply), out = { oneWay: 0, days: 0, food: 0, wood: 0, hide: 0, soldiers: 1, have: supplyAvailable(sim).length };
  const cost = tentCost(sim), n = tentCount(sim, plan);
  for (let i = 0; i < 4; i++) {
    const m = marchOf(sim, plan.missions.length + 1, soldiersOf(sim, plan) + sup), oneWay = longest / m.speed / DAY_LENGTH, d = Math.min(WAR_DATA.supply.maxDays, Math.max(1, Math.ceil(oneWay * 2 + 1)));
    const food = Math.ceil(dailyNeed(sim, plan, sup) * d), wood = n * cost.wood, hide = n * cost.hide;
    const soldiers = Math.max(1, Math.ceil((food + (wood + hide) * WAR_DATA.tent.weight) / supplyLoad(sim)));
    out = { ...out, oneWay, days: d, food, wood, hide, soldiers };
    if (soldiers === sup) break;
    sup = soldiers;
  }
  return out;
}

/** The lines of the war council about the supply. */
export function supplyLines(sim: Sim, plan: Plan): string[] {
  const p = packPlan(sim, plan), have = supplyAvailable(sim).length, out: string[] = [];
  if (!p.sup) { out.push(`⚠ Không mang lính hậu cần${have ? ` (trại có ${have})` : ''}: quân không có lương mang theo nên sẽ đói và yếu đi ngay từ đầu.`); return out; }
  out.push(`Hậu cần: ${p.sup} lính, mỗi người mang tối đa ${Math.round(supplyLoad(sim))} tải (tổng ${p.capacity}; lương 1 tải mỗi phần, gỗ và da ${WAR_DATA.tent.weight} tải mỗi phần). Quân cần khoảng ${Math.round(p.need)} thức ăn mỗi ngày; muốn mang ${plan.carryDays} ngày = ${Math.round(p.want)}.`);
  out.push(...tentLines(sim, plan, { wood: p.wood, hide: p.hide }));
  if (p.want > p.give && p.give < stocked(sim)) out.push(`⚠ Tải không đủ (lều và lương chung một tải): chỉ mang được ${Math.floor(p.give)} thức ăn, khoảng ${p.days.toFixed(1)} ngày. Thêm lính hậu cần hoặc bớt số ngày.`);
  if (p.want > stocked(sim)) out.push(`⚠ Kho làng chỉ có ${Math.floor(stocked(sim))} thức ăn: chỉ chất được ${Math.floor(p.give)} (khoảng ${p.days.toFixed(1)} ngày).`);
  out.push(`Sẽ chất ${Math.floor(p.give)} thức ăn, đủ khoảng ${p.days.toFixed(1)} ngày cho quân. Hết lương thì quân đói (yếu tới ${Math.round(FOOD.maxPenalty * 100)}%); hậu cần chết thì phần lương họ mang mất theo.`);
  return out;
}

/** Deploy: take the supply soldiers out of their camp and load their packs from the village. */
export function loadPacks(sim: Sim, plan: Plan): void {
  const p = packPlan(sim, plan), crew = supplyAvailable(sim).sort((a, b) => b.energy - a.energy).slice(0, p.sup);
  plan.supplyIds = crew.map((v) => v.id);
  sim.warHunger = 0;
  if (!crew.length) return;
  let left = p.give;
  const fromPot = Math.min(sim.foodPot, left); sim.foodPot -= fromPot; left -= fromPot;
  sim.stock.food = Math.max(0, sim.stock.food - left);
  sim.stock.wood = Math.max(0, sim.stock.wood - p.wood); sim.stock.hide = Math.max(0, sim.stock.hide - p.hide);
  const each = p.give / crew.length;
  for (const v of crew) {
    sim.exitBuilding(v); sim.resetTask(v); sim.clearCombat(v);
    v.out = true; v.recall = false; v.pack = { food: each, wood: p.wood / crew.length, hide: p.hide / crew.length };
    v.fight.mode = 'guard'; v.fight.anchor = { x: v.x, y: v.y };
  }
  sim.say(`${crew.length} lính hậu cần theo quân, mang ${Math.floor(p.give)} thức ăn (khoảng ${p.days.toFixed(1)} ngày), ${p.wood} gỗ và ${p.hide} da cho lều.`);
}

/** The army eats a second of its meals from the packs. What the packs cannot give weakens the army: the share unmet, smoothed over a few seconds. */
export function eatPacks(sim: Sim, plan: Plan, need: number): void {
  if (need <= 0) return;
  let left = need;
  for (const v of supplyOf(sim, plan)) { if (!v.pack || v.pack.food <= 0) continue; const k = Math.min(v.pack.food, left); v.pack.food -= k; left -= k; if (left <= 0) break; }
  const unmet = left / need;
  sim.warHunger += (unmet - sim.warHunger) / WAR_DATA.supply.hungerSmooth;
  sim.foodPenalty = FOOD.maxPenalty * sim.warHunger;
}

/** Food still in the packs of the plan (what the army has left). */
export const packFood = (sim: Sim, plan: Plan): number => supplyOf(sim, plan).reduce((n, v) => n + (v.pack?.food ?? 0), 0);

/** The supply soldiers keep to the back of the army, a few tiles behind its middle on the side of the village. Run every couple of seconds. */
export function follow(sim: Sim, plan: Plan): void {
  const crew = supplyOf(sim, plan);
  if (!crew.length) return;
  const us = plan.missions.flatMap((m) => { const s = sim.squadById(m.squad); return s ? sim.squadUnits(s) : []; });
  if (!us.length) return;
  // the army stands (a rest, a night camp): the supply soldiers stop where they are, so that their own tent can go up beside them
  const squads = plan.missions.map((m) => sim.squadById(m.squad)).filter((s): s is NonNullable<typeof s> => !!s && sim.squadUnits(s).length > 0);
  if (squads.length && squads.every((s) => stands(sim, s)) && plan.missions.some((m) => m.resting)) {
    // go to the nearest tent that is not up yet and put it up; with none left, stay where they are
    const open = plan.tents.filter((t) => !t.built);
    for (const v of crew) {
      if (v.inTent || v.phase === 'sleep' || v.phase === 'fight') continue;
      v.hurry = false;
      const t = open.sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
      const end = v.path[v.path.length - 1], toIt = !!end && !!t && Math.hypot(end[0] + 0.5 - t.x, end[1] + 0.5 - t.y) < 4;
      if (t && Math.hypot(t.x - v.x, t.y - v.y) > 3 && !toIt && sim.pathLeft > 0) { sim.pathLeft--; v.path = sim.pathTo(v, Math.floor(t.x), Math.floor(t.y), 3000); v.phase = v.path.length ? 'move' : 'idle'; }
      else if (!t && v.path.length) { v.path = []; v.slide = null; v.phase = 'idle'; }
    }
    return;
  }
  const cx = us.reduce((a, v) => a + v.x, 0) / us.length, cy = us.reduce((a, v) => a + v.y, 0) / us.length;
  const dx = plan.rally.x - cx, dy = plan.rally.y - cy, len = Math.max(1, Math.hypot(dx, dy)), t = WAR_DATA.supply.trail;
  const bx = cx + (dx / len) * t, by = cy + (dy / len) * t, taken = new Set<number>();
  for (const v of crew) {
    if (v.phase === 'fight' || v.phase === 'sleep' || v.inTent || v.down > 0) continue;
    const spot = sim.nearestFree(Math.floor(bx), Math.floor(by), taken);
    if (!spot) continue;
    taken.add(spot[1] * sim.world.size + spot[0]);
    const away = Math.hypot(spot[0] + 0.5 - v.x, spot[1] + 0.5 - v.y);
    v.hurry = away > 6; // behind his place at the back of the army: run to catch up
    const end = v.path[v.path.length - 1];
    if (away < 4 || (end && Math.hypot(end[0] - spot[0], end[1] - spot[1]) < 3) || sim.pathLeft <= 0) continue; // close enough, or already on the way to where the army is now
    sim.pathLeft--; v.path = sim.pathTo(v, spot[0], spot[1], 3000); v.phase = v.path.length ? 'move' : 'idle';
  }
}

/** The war is over: what is left in the packs goes back to the store, and the supply soldiers go back to their camp. */
export function settle(sim: Sim): void {
  for (const plan of sim.plans) {
    if (!plan.supplyIds.length) continue;
    const left = packFood(sim, plan), crew = supplyOf(sim, plan);
    if (left >= 1) { const put = sim.deposit('food', Math.floor(left)); sim.say(`Hậu cần mang về ${put} thức ăn còn lại.`); }
    const back = { wood: 0, hide: 0 };
    for (const res of ['wood', 'hide'] as const) { const n = Math.floor(crew.reduce((a, v) => a + (v.pack?.[res] ?? 0), 0)); if (n > 0) back[res] = sim.deposit(res, n); }
    warlog.noteReturned(plan, left >= 1 ? Math.floor(left) : 0, back.wood, back.hide);
    plan.tents = [];
    for (const id of plan.supplyIds) { const v = sim.get(id); if (v) { v.pack = undefined; v.hurry = false; v.inTent = false; v.out = false; v.recall = true; } }
    plan.supplyIds = [];
  }
  sim.warHunger = 0; sim.foodPenalty = 0; // the hunger of the march is over (the meals of the village are settled by eatWar)
}
