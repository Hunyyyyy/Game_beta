/** The village stock: paying costs, trading goods for shells, and food that spoils. */
import { DAY_LENGTH } from './constants';
import { BARTER, FOOD_SPOIL_DAYS, Res, RES_NAME, Stock } from './resources';
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

/** Reconcile lots with the stock: gains open a new lot, losses come off the oldest; expired lots spoil. */
export function syncFood(sim: Sim): void {
  const lots = sim.foodLots, cur = sim.stock.food;
  let sum = 0;
  for (const l of lots) sum += l.amount;
  if (cur > sum) {
    const exp = sim.time + FOOD_SPOIL_DAYS * DAY_LENGTH, last = lots[lots.length - 1];
    if (last && exp - last.exp < 30) last.amount += cur - sum; else lots.push({ amount: cur - sum, exp });
  } else if (cur < sum) {
    let take = sum - cur;
    while (take > 0 && lots.length) {
      const l = lots[0], k = Math.min(l.amount, take);
      l.amount -= k; take -= k;
      if (l.amount <= 0) lots.shift();
    }
  }
  let spoiled = 0;
  while (lots.length && lots[0].exp <= sim.time) spoiled += lots.shift()!.amount;
  if (spoiled > 0) {
    sim.stock.food = Math.max(0, sim.stock.food - spoiled);
    sim.say(`${Math.round(spoiled)} thức ăn để quá ${FOOD_SPOIL_DAYS} ngày đã hỏng.`);
  }
}

/** Stored food that will spoil within the next `secs` seconds. */
export function foodSpoilingWithin(sim: Sim, secs: number): number {
  let n = 0;
  for (const l of sim.foodLots) if (l.exp <= sim.time + secs) n += l.amount;
  return Math.min(n, sim.stock.food);
}
