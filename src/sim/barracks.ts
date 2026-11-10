/**
 * The camps train soldiers (doc/thiet_ke_bac_linh.md). A villager becomes a soldier of a rank of the camp's branch when three things are in order: the research has opened the
 * rank, the stores hold the weapon of that rank, and the village can pay (shells, and for a rider the price of his beast, which ranks.json already counts). There is no promotion:
 * a soldier who is let go goes back to rank 1 and his gear to the store; a new one is trained from the start.
 */
import { WEAPONS } from './combat';
import { discountBill, perkPct, soldierTier } from './research';
import { rankDef, ranksOf } from './ranks';
import type { RankDef, RankRole } from './ranks';
import { RES_NAME } from './resources';
import type { Res, Stock } from './resources';
import type { Sim } from './sim';

/** What stands between the village and a soldier of this rank right now: the lines to show the player (empty when he can be trained) and the first of them as a reason. */
export interface TrainCheck { def: RankDef | null; missing: string[]; ok: boolean }

/** Whether the research (or the age) has opened a rank for a branch. */
export function rankOpen(sim: Sim, role: RankRole, rank: number): boolean {
  if (rank <= 1) return true;
  if (rank >= 4 && sim.era !== 'ancient') return false; // the ranks of the medieval age (4 is the bronze one) are for the medieval age, and the research opens each
  return soldierTier(sim.researched, role) >= rank;
}

const weaponKey = (id: string): string => `${id}${WEAPONS[id]?.tier ?? 1}`;

/** What one soldier of a rank costs now: the price of the rank, cut by the research that hangs under its leap. */
export const trainCost = (sim: Sim, role: RankRole, rank: number): Partial<Stock> => { const d = rankDef(role, rank); return d ? discountBill(d.cost, perkPct(sim.researched, `train_${role}_${rank}`)) : {}; };

export function trainCheck(sim: Sim, role: RankRole, rank: number): TrainCheck {
  const def = rankDef(role, rank) ?? null;
  if (!def) return { def, missing: ['Không có bậc này'], ok: false };
  if (def.soon) return { def, missing: ['Chưa luyện được: thiếu vật liệu của thời đại'], ok: false };
  if (!ranksOf(role, sim.era).some((d) => d.rank === rank)) return { def, missing: ['Chưa tới thời đại của bậc này'], ok: false };
  const missing: string[] = [];
  if (!rankOpen(sim, role, rank)) missing.push(`Chưa nghiên cứu mở ${def.name.toLowerCase()}`);
  if (!sim.hasWorkshop() && !sim.building('armory')) missing.push('Cần có Nhà chế tạo hoặc Kho vũ khí để lấy đồ');
  else if ((sim.toolStock[weaponKey(def.weapon)] ?? 0) <= 0) missing.push(`Kho hết ${WEAPONS[def.weapon].name.toLowerCase()}: hãy chế thêm`);
  for (const [res, amount] of Object.entries(trainCost(sim, role, rank)) as Array<[Res, number]>) {
    if ((sim.stock[res] ?? 0) < amount) missing.push(`Thiếu ${RES_NAME[res].toLowerCase()}: cần ${amount}, có ${Math.floor(sim.stock[res] ?? 0)}`);
  }
  return { def, missing, ok: missing.length === 0 };
}

/**
 * Train the chosen villagers as soldiers of a rank, one after the other while the village can afford each. Those who already soldier in the camp are left as they are
 * (a rank is not raised: let him go and train a new one). Returns why none could be trained, or null when at least one was.
 */
export function trainSoldier(sim: Sim, ids: readonly number[], role: RankRole, rank: number): string | null {
  let done = 0, why: string | null = null;
  for (const v of sim.mine(ids)) {
    const chk = trainCheck(sim, role, rank), def = chk.def;
    if (!def || !chk.ok) { why ??= chk.missing[0] ?? 'Chưa luyện được'; break; }
    const err = sim.assignRole([v.id], role); // the room of the camp, the war, the old job: all as for any role
    if (err) { why ??= err; break; }
    v.rank = rank; // first the rank, so that the weapon of the rank is one he may carry
    const gear = sim.assignGear([v.id], def.weapon, 'weapon');
    if (gear && v.weapon !== def.weapon) { sim.releaseRole([v.id]); why ??= gear; break; }
    sim.pay(trainCost(sim, role, rank));
    v.manualGear = true;
    if (def.mount) v.mount = def.mount as typeof v.mount; // the beast came with the price
    done++;
    sim.say(`${v.name} thành ${def.name.toLowerCase()}.`);
  }
  return done ? null : why ?? 'Chọn người để luyện';
}
