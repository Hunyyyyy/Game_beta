/** The village stock: paying costs, trading goods for shells, and the meal the village eats at the end of each day. */
import { BARTER, FOOD, rationAt, Res, RES_NAME, Stock } from './resources';
import type { Sim } from './sim';

/** Reason the stock cannot pay `cost`, or null. */
export function missing(sim: Sim, cost: Partial<Stock>): string | null {
  for (const r of Object.keys(cost) as Res[]) if (sim.stock[r] < (cost[r] ?? 0)) return `Thiếu ${RES_NAME[r].toLowerCase()} (cần ${cost[r]})`;
  return null;
}

export function affordable(sim: Sim, cost: Partial<Stock>): boolean { return (Object.keys(cost) as Res[]).every((k) => sim.stock[k] >= (cost[k] ?? 0)); }

export function pay(sim: Sim, cost: Partial<Stock>, sign = -1): void { for (const k of Object.keys(cost) as Res[]) sim.stock[k] += sign * (cost[k] ?? 0); }

/** Swap goods for shells: the village trades a fixed amount of one good for one coin. */
export function barter(sim: Sim, res: Exclude<Res, 'coin'>): string | null {
  const n = BARTER[res];
  if (sim.stock[res] < n) return `Cần ${n} ${RES_NAME[res].toLowerCase()} để đổi lấy 1 ${RES_NAME.coin.toLowerCase()}`;
  if (sim.stock.coin >= sim.capacity()) return `Kho đã đầy ${RES_NAME.coin.toLowerCase()}`;
  sim.stock[res] -= n; sim.stock.coin += 1;
  return null;
}

// ---------------------------------------------------------------- the daily meal (src/data/food.json)
/** What the village eats at the end of this day: a ration for every villager and a bigger one for every soldier, by the level of the campfire. */
export function foodNeed(sim: Sim): number {
  const level = sim.campfire()?.level ?? 1;
  let n = 0;
  for (const v of sim.villagers) n += rationAt(level, v.job === 'fight');
  return n;
}

/** Food that comes in goes to the pot of the campfire first, until it holds the day's meal; only what is over stays in the store. */
export function feedPot(sim: Sim): void {
  const room = foodNeed(sim) - sim.foodPot;
  if (room <= 0 || sim.stock.food <= 0) return;
  const k = Math.min(room, sim.stock.food);
  sim.foodPot += k; sim.stock.food -= k;
}

/** The end of a day: the village eats from the pot, then from the store. What is short weakens everyone the day after, up to FOOD.maxPenalty when nothing is left. */
export function eatDay(sim: Sim): void {
  rollYield(sim);
  trackFood(sim);
  sim.foodDays.push(sim.foodIncome); if (sim.foodDays.length > 3) sim.foodDays.shift();
  sim.foodIncome = 0;
  const need = foodNeed(sim);
  const fromPot = Math.min(sim.foodPot, need), fromStore = Math.min(sim.stock.food, need - fromPot), short = need - fromPot - fromStore;
  sim.foodPot -= fromPot; sim.stock.food -= fromStore;
  const was = sim.foodPenalty;
  sim.foodPenalty = need > 0 ? (FOOD.maxPenalty * short) / need : 0;
  if (short > 0) sim.say(`Thiếu ${Math.ceil(short)}/${need} thức ăn: cả làng yếu đi ${Math.round(sim.foodPenalty * 1000) / 10}% trong ngày tới.`);
  else if (was > 0) sim.say('Đủ ăn rồi: làng khỏe lại.');
  sim.foodSeen = sim.stock.food + sim.foodPot; // what was eaten is not a loss to count against the next day
}

// ---------------------------------------------------------------- what the village earns in food (for the heads-up notices)
/** Add up the food that comes in (a rise of pot + store); what goes out is not income. Called every tick. */
export function trackFood(sim: Sim): void {
  const total = sim.stock.food + sim.foodPot;
  if (sim.foodSeen >= 0 && total > sim.foodSeen) sim.foodIncome += total - sim.foodSeen;
  sim.foodSeen = total;
}

// ---------------------------------------------------------------- what the gatherers bring in a day (shown on the houses of the gatherers)
/** Count what a villager of a trade brought in: `key` is the trade ('wood', 'stone', 'food', 'hunt') or 'farm' for a field. */
export function noteYield(sim: Sim, key: string, n: number): void {
  if (n > 0) sim.yieldNow[key] = (sim.yieldNow[key] ?? 0) + n;
}

/** A new day: today's count becomes yesterday's. */
export function rollYield(sim: Sim): void {
  for (const k of Object.keys(sim.yieldPrev)) delete sim.yieldPrev[k];
  Object.assign(sim.yieldPrev, sim.yieldNow);
  for (const k of Object.keys(sim.yieldNow)) delete sim.yieldNow[k];
}
