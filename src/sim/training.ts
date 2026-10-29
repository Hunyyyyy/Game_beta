/**
 * Training in the house of a role. Some of the people of a house go off for a day or two, leaving the others to work, and come back a few per cent better
 * at the one stat the house trains (and a little at its partner); to pay for it another stat, the "cost" of that house, falls, by more or less depending on
 * how much coin was spent on care. A stat never falls below a share of what the body was born with, and never rises above what the level of the house allows.
 * Food and coin are paid when it starts. Nothing here is rolled but the size of the gain, from `sim.rnd`.
 */
import { Building, BUILDINGS } from './buildings';
import { DAY_LENGTH } from './constants';
import { maxHpOf } from './combat';
import { fmtStat, ROLE_IDS, ROLES, roleOf, STAT_NAME, TRAINING, TrainProfile } from './jobs';
import type { Sim } from './sim';
import type { Villager } from './model';

export const profileOf = (b: Pick<Building, 'kind'>): TrainProfile | undefined => TRAINING.profiles[b.kind];

/** The ceiling of the stat a house trains: it rises with the level of the house. */
export const trainCap = (b: Pick<Building, 'level'>): number => TRAINING.caps[Math.max(0, Math.min(TRAINING.caps.length, b.level) - 1)];

/** Who belongs to a house for training: the holders of its role, or those who work inside it, and anyone of them already away. */
export function members(sim: Sim, b: Building): Villager[] {
  const role = ROLE_IDS.find((r) => ROLES[r].building === b.kind);
  const inHouse = role ? sim.villagers.filter((v) => roleOf(v) === role) : b.kind === 'builder' ? sim.crew() : b.staff.map((id) => sim.get(id)).filter((v): v is Villager => !!v);
  const away = sim.villagers.filter((v) => v.train?.house === b.id && !inHouse.includes(v));
  return [...inHouse, ...away];
}

/** What one man's session costs: food and coin grow with the stat trained, and the coin with the care chosen. */
export function trainCost(stat: number, care: number): { food: number; coin: number } {
  return { food: Math.round(TRAINING.foodBase + stat), coin: Math.round(TRAINING.coinBase + stat * TRAINING.coinPerStat) + TRAINING.care[care].coin };
}
/** How long it takes, in game seconds: the higher the stat, the longer. */
export const trainTime = (stat: number): number => (TRAINING.dayBase + TRAINING.dayPerStat * stat) * DAY_LENGTH;

/** Send people of a house to train. Returns an error or null. */
export function startTraining(sim: Sim, ids: readonly number[], houseId: number, care: number): string | null {
  const lock = sim.warLock(); if (lock) return 'Đang có chiến tranh: không huấn luyện được';
  const b = sim.getBuilding(houseId), p = b ? profileOf(b) : undefined;
  if (!b || !p || !TRAINING.care[care]) return 'Nhà này không huấn luyện được';
  if (!b.done) return 'Nhà chưa dựng xong';
  const cap = trainCap(b), mine = members(sim, b);
  let err: string | null = null, n = 0;
  for (const v of sim.mine(ids)) {
    if (!mine.includes(v) || v.train) continue;
    if (v.stats[p.main] >= cap) { err = `${v.name} đã tới trần ${fmtStat(cap)} ${STAT_NAME[p.main].toLowerCase()} của nhà cấp ${b.level}: nâng cấp nhà`; continue; }
    const cost = trainCost(v.stats[p.main], care), short = sim.missing(cost);
    if (short) { err = short; break; }
    sim.pay(cost);
    sim.exitBuilding(v); sim.resetTask(v);
    v.train = { house: b.id, stat: p.main, left: trainTime(v.stats[p.main]), total: trainTime(v.stats[p.main]), care, cap };
    n++;
  }
  if (n) sim.say(`${n} người vào huấn luyện ${STAT_NAME[p.main].toLowerCase()} ở ${BUILDINGS[b.kind].name.toLowerCase()}.`);
  return n ? null : err ?? 'Chọn người trong nhà để huấn luyện';
}

/** Call people back from training: nothing is refunded and nothing gained. */
export function cancelTraining(sim: Sim, ids: readonly number[]): void {
  for (const v of sim.mine(ids)) if (v.train) { v.train = null; v.phase = 'idle'; v.path = []; }
}

/** What one finished session does to a body. */
function finish(sim: Sim, v: Villager): void {
  const t = v.train!, b = sim.getBuilding(t.house), p = b ? profileOf(b) : undefined;
  v.train = null;
  if (!p) return;
  const [lo, hi] = TRAINING.gain, r = lo + sim.rnd() * (hi - lo), main = v.stats[p.main], next = Math.min(t.cap, main * (1 + r)), got = Math.max(0, next - main);
  const round = (x: number) => Math.round(x * 100) / 100;
  v.stats[p.main] = round(main + got);
  if (p.partner) v.stats[p.partner] = round(Math.max(v.stats[p.partner], Math.min(t.cap, v.stats[p.partner] + got * TRAINING.partnerShare))); // a stat above the ceiling is left as it is
  const floor = Math.max(TRAINING.floorMin, v.born[p.cost] * TRAINING.floor);
  v.stats[p.cost] = round(Math.max(Math.min(floor, v.stats[p.cost]), v.stats[p.cost] - got * TRAINING.care[t.care].penalty));
  const ratio = v.maxHealth > 0 ? v.health / v.maxHealth : 1;
  v.maxHealth = Math.round(maxHpOf(v.stats.vit)); v.health = v.maxHealth * ratio;
  if (!v.squad || v.squad < 0) v.speed = 1.6 + 0.1 * v.stats.agi;
  sim.say(`${v.name} huấn luyện xong: ${STAT_NAME[p.main].toLowerCase()} ${fmtStat(main)} → ${fmtStat(v.stats[p.main])}, ${STAT_NAME[p.cost].toLowerCase()} ${fmtStat(v.stats[p.cost])}.`);
}

/** One tick of a man at training: he stays by the house, and when the time is up the session ends. True while he is at it. */
export function trainStep(sim: Sim, v: Villager, dt: number): boolean {
  const t = v.train;
  if (!t) return false;
  t.left -= dt;
  if (t.left <= 0) { finish(sim, v); return false; }
  if (v.phase === 'sleep' || v.phase === 'goHome') return true;
  const b = sim.getBuilding(t.house);
  if (!b) { v.train = null; return false; }
  const d = BUILDINGS[b.kind];
  if (!v.path.length && Math.hypot(b.x + d.w / 2 - v.x, b.y + d.h / 2 - v.y) > d.w + 2) { if (sim.pathLeft > 0) { sim.pathLeft--; sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h), 3); } v.phase = v.path.length ? 'move' : 'idle'; }
  else if (!v.path.length) v.phase = 'idle';
  return true;
}
