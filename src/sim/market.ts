/** The Chợ: the one place where goods are traded for shells, or for each other, at what the market takes each day. */
import MARKET from '../data/market.json';
import { BARTER, RES_LIST, RES_NAME, Res, resourceOpen } from './resources';
import { perkPct } from './research';
import type { Sim } from './sim';

export type Good = Exclude<Res, 'coin'>;
export interface MarketQuote {
  /** How many steps (shells' worth) the trade is: as many as asked, or as many as can be had. */
  steps: number;
  /** What is given, and what is had (shells when the trade is a sale). */
  give: number; get: number;
  /** The price of the first and of the last step, in units of the good given. */
  first: number; last: number;
  /** Why it stops short, or null. */
  why: string | null;
}
/** A bargain of the day: the market buys this good dearer (`sell`: the village gets more for it) or sells it cheaper (`buy`), by `pct` percent. */
export interface Bargain { good: string; kind: 'sell' | 'buy'; pct: number }
export interface MarketState { quota: Record<string, number>; used: Record<string, number>; bargain?: Bargain | null }

/** The level of the finished Chợ (0: there is none). */
export function marketLevel(sim: Sim): number {
  let lv = 0;
  for (const b of sim.buildings) if (b.kind === 'market' && b.done) lv = Math.max(lv, b.level);
  return Math.min(MARKET.levels.length, lv);
}
/** The terms of the market now: its level, bettered by the research of the Kinh tế branch (perks market_rate, market_fee, market_quota in percent, market_free steps at the fair price). */
function tier(sim: Sim): { rate: number; fee: number; quotaMin: number; quotaMax: number; free: number } {
  const t = MARKET.levels[Math.max(1, marketLevel(sim)) - 1], r = sim.researched, q = 1 + perkPct(r, 'market_quota') / 100;
  return { rate: t.rate * (1 + perkPct(r, 'market_rate') / 100), fee: Math.max(0, t.fee - perkPct(r, 'market_fee') / 100), quotaMin: Math.round(t.quotaMin * q), quotaMax: Math.round(t.quotaMax * q), free: perkPct(r, 'market_free') };
}

/** A new day: the market draws how much of each good it will take at the fair price today. */
export function marketRoll(sim: Sim): void {
  const t = tier(sim), q: Record<string, number> = {};
  for (const r of RES_LIST) if (r !== 'coin') q[r] = Math.round(t.quotaMin + sim.frnd() * (t.quotaMax - t.quotaMin));
  sim.market.quota = q; sim.market.used = {};
  // a bargain now and then (research raises the chance): one good, for today only; in the medieval age bigger ones, and sometimes a merchant caravan that buys every good dearer
  sim.market.bargain = null;
  const B = MARKET.bargain, med = sim.era === 'ancient', M = B.medieval, lift = perkPct(sim.researched, 'market_bargain') / 100;
  if (marketLevel(sim) < 1) return;
  if (med && sim.frnd() < M.caravanChance + lift) {
    sim.market.bargain = { good: '*', kind: 'sell', pct: M.caravanPct };
    sim.say(`Một đoàn thương nhân ghé chợ hôm nay: thu mua mọi hàng giá cao hơn ${M.caravanPct}%.`);
    return;
  }
  if (sim.frnd() < B.chance + lift) {
    const goods = RES_LIST.filter((r): r is Good => r !== 'coin' && marketTradable(sim, r)), lo = med ? M.pctMin : B.pctMin, hi = med ? M.pctMax : B.pctMax;
    if (goods.length) {
      const good = goods[Math.floor(sim.frnd() * goods.length)], kind = sim.frnd() < 0.5 ? 'sell' : 'buy', pct = Math.round(lo + sim.frnd() * (hi - lo));
      sim.market.bargain = { good, kind, pct };
      sim.say(`Chợ hôm nay có món hời: ${kind === 'sell' ? 'thu mua' : 'bán'} ${RES_NAME[good].toLowerCase()} ${kind === 'sell' ? 'giá cao hơn' : 'rẻ hơn'} ${pct}%.`);
    }
  }
}

/** The bargain of today on a good, as a multiplier of what the village gets for it (`sell`) or of what a shell buys of it (`buy`): 1 when there is none. */
export function bargainMult(sim: Sim, res: string, kind: 'sell' | 'buy'): number {
  const b = sim.market.bargain;
  return b && (b.good === res || b.good === '*') && b.kind === kind ? 1 + b.pct / 100 : 1;
}

/** Shells' worth of a good the market still takes at the fair price today. */
export function marketLeft(sim: Sim, res: Good): number {
  const m = sim.market, t = tier(sim), q = (m.quota[res] ?? t.quotaMin) + t.free;
  return Math.max(0, q - (m.used[res] ?? 0));
}

/** May this good be traded: the village has the means to take it in (its house stands), the age has come for it, and it is one the village has seen (a good from an animal only once there is some). */
export function marketTradable(sim: Sim, res: Res): boolean {
  if (res === 'coin' || BARTER[res] === undefined) return false;
  if (!resourceOpen(res, sim.buildings)) return false;
  if (sim.era !== 'ancient' && (MARKET.medieval as string[]).includes(res)) return false;
  return RES_LIST.includes(res) && (sim.stock[res] > 0 || !ANIMAL_ONLY.has(res));
}
const ANIMAL_ONLY = new Set<string>(['bone', 'fat', 'feather', 'tusk', 'iron_ore', 'coal', 'rare_ore', 'fiber', 'sinew', 'yew', 'iron', 'steel', 'fine_steel', 'leather', 'cloth', 'hardwood']);

/** The swaps the market makes now: the free ones, and those research has opened, of goods that may be traded. */
export function marketRoutes(sim: Sim): Array<{ give: Good; get: Good }> {
  const out: Array<{ give: Good; get: Good }> = [];
  const ids = new Set<string>(MARKET.free);
  for (const id of sim.researched) if (id.startsWith('trade:')) ids.add(id.slice(6));
  for (const id of ids) { // a route works both ways
    const [a, b] = id.split('>') as [Good, Good];
    for (const [give, get] of [[a, b], [b, a]] as Array<[Good, Good]>) if (marketTradable(sim, give) && marketTradable(sim, get) && !out.some((r) => r.give === give && r.get === get)) out.push({ give, get });
  }
  return out;
}

/** The terms of a step now: units of `give` for it (dearer once the day's quota is used), what it yields in `get`, how many steps are left at the fair price. */
export function marketTerms(sim: Sim, give: Good, get: Good | 'coin'): { price: number; per: number; left: number } {
  const t = tier(sim), left = marketLeft(sim, give), extra = Math.max(0, 1 - left);
  return { price: Math.ceil((BARTER[give] / (t.rate * bargainMult(sim, give, 'sell'))) * Math.pow(1 + MARKET.overSlip, extra)), per: get === 'coin' ? 1 : BARTER[get] * (1 - t.fee), left };
}

/** What the village keeps back of a good when it trades its surplus: three days of meals of food, a share of the store of the rest. */
export function marketKeep(sim: Sim, res: Good): number {
  return res === 'food' ? Math.ceil(sim.foodNeed() * MARKET.foodKeepDays) : Math.ceil(sim.capacity(res) * MARKET.keepShare);
}

/**
 * The walk of a trade, a step (a shell's worth) at a time, each at the price of the moment: the fair price while the day's quota lasts, then dearer by `overSlip` for each step past it.
 * `commit` takes the goods and gives what was had. A sale (get === 'coin') gives a shell a step; a swap gives the value of the step in the other good, less the fee.
 */
function walk(sim: Sim, give: Good, get: Good | 'coin', want: number, keep: number, commit: boolean): MarketQuote {
  const q: MarketQuote = { steps: 0, give: 0, get: 0, first: 0, last: 0, why: null };
  const lv = marketLevel(sim), name = RES_NAME[give].toLowerCase();
  if (lv < 1) { q.why = 'Chưa có Chợ'; return q; }
  const t = tier(sim), used0 = sim.market.used[give] ?? 0, quota = (sim.market.quota[give] ?? t.quotaMin) + t.free;
  const perStep = get === 'coin' ? 1 : BARTER[get] * (1 - t.fee);
  const room = get === 'coin' ? sim.capacity() - sim.stock.coin : sim.capacity(get) - sim.stock[get];
  let left = sim.stock[give];
  while (q.steps < want) {
    const extra = Math.max(0, used0 + q.steps + 1 - quota), price = Math.ceil((BARTER[give] / (t.rate * bargainMult(sim, give, 'sell'))) * Math.pow(1 + MARKET.overSlip, extra));
    if (left - price < keep) { q.why = keep > 0 ? `Không còn ${name} dư (đang giữ lại ${keep})` : `Cần ${price} ${name} cho một lượt`; break; }
    const had = Math.floor((q.steps + 1) * perStep);
    if (had > room) { q.why = get === 'coin' ? 'Kho đã đầy vỏ sò' : `Kho đã đầy ${RES_NAME[get].toLowerCase()}`; break; }
    if (get !== 'coin' && had < 1) { if (q.steps + 1 > 2000) break; q.give += price; left -= price; q.steps++; q.last = price; if (!q.first) q.first = price; continue; } // a step that is worth less than a unit: it adds to the next
    if (!q.first) q.first = price;
    q.last = price; q.give += price; left -= price; q.steps++;
  }
  q.get = Math.floor(q.steps * perStep);
  if (get !== 'coin' && q.get < 1) { q.steps = 0; q.give = 0; q.get = 0; q.why ??= `Cần nhiều ${name} hơn để đổi được một ${RES_NAME[get].toLowerCase()}`; }
  if (commit && q.steps > 0) {
    sim.stock[give] -= q.give;
    if (get === 'coin') sim.stock.coin += q.get; else sim.stock[get] += q.get;
    sim.market.used[give] = used0 + q.steps;
  }
  return q;
}

/** What one shell buys of a good now (dearer than selling: the fee and `buyFee`, less the more the day's quota is used up) and how many shells' worth the market still sells at the fair price today. */
export function marketBuyTerms(sim: Sim, get: Good): { per: number; left: number } {
  const t = tier(sim), left = marketLeft(sim, get);
  return { per: BARTER[get] * (1 - Math.min(0.9, t.fee + MARKET.buyFee)) * bargainMult(sim, get, 'buy'), left };
}

/** Buying a good with shells, a shell a step: each step yields what `marketBuyTerms` says, less by `overSlip` for every step past the day's quota (the market sells only so much at the fair price). */
function buyWalk(sim: Sim, get: Good, want: number, commit: boolean): MarketQuote {
  const q: MarketQuote = { steps: 0, give: 0, get: 0, first: 0, last: 0, why: null };
  if (marketLevel(sim) < 1) { q.why = 'Chưa có Chợ'; return q; }
  const t = tier(sim), key = `buy:${get}`, used0 = sim.market.used[key] ?? 0, quota = (sim.market.quota[get] ?? t.quotaMin) + t.free;
  const base = marketBuyTerms(sim, get).per, room = sim.capacity(get) - sim.stock[get];
  let acc = 0;
  while (q.steps < want) {
    const gain = base / Math.pow(1 + MARKET.overSlip, Math.max(0, used0 + q.steps + 1 - quota));
    if (q.give + 1 > sim.stock.coin) { q.why = 'Không đủ vỏ sò'; break; }
    if (Math.floor(acc + gain) > room) { q.why = `Kho đã đầy ${RES_NAME[get].toLowerCase()}`; break; }
    acc += gain; q.give++; q.steps++; q.last = gain; if (!q.first) q.first = gain;
  }
  q.get = Math.floor(acc);
  if (q.get < 1) { q.steps = 0; q.give = 0; q.get = 0; q.why ??= `Cần nhiều vỏ sò hơn để mua được một ${RES_NAME[get].toLowerCase()}`; }
  if (commit && q.steps > 0) { sim.stock.coin -= q.give; sim.stock[get] += q.get; sim.market.used[key] = used0 + q.steps; }
  return q;
}

/** What a trade would be, worked out without doing it. `steps`: how many shells' worth to trade (Infinity: as many as can be). */
export function marketQuote(sim: Sim, give: Good | 'coin', get: Good | 'coin', steps: number, keep = 0): MarketQuote { return give === 'coin' ? (get === 'coin' ? walk(sim, 'food', 'coin', 0, 0, false) : buyWalk(sim, get, steps, false)) : walk(sim, give, get, steps, keep, false); }

/** Trade: returns an error, or null when something was traded. */
export function marketTrade(sim: Sim, give: Good | 'coin', get: Good | 'coin', steps: number, keep = 0): string | null {
  if (give === 'coin') { // buying with shells
    if (get === 'coin' || !marketTradable(sim, get)) return 'Chợ chưa bán hàng này';
    const b = buyWalk(sim, get, steps, true);
    return b.steps > 0 ? null : b.why ?? 'Không mua được';
  }
  if (get !== 'coin' && !marketRoutes(sim).some((r) => r.give === give && r.get === get)) return 'Tuyến đổi này chưa mở: hãy nghiên cứu nhánh Kinh tế';
  if (!marketTradable(sim, give) || (get !== 'coin' && !marketTradable(sim, get))) return 'Chợ chưa nhận hàng này';
  const q = walk(sim, give, get, steps, keep, true);
  return q.steps > 0 ? null : q.why ?? 'Không đổi được';
}
