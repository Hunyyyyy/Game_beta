/**
 * The camps train soldiers (doc/thiet_ke_bac_linh.md). A villager becomes a soldier of a rank of the camp's branch when three things are in order: the research has opened the
 * rank, the stores hold the weapon of that rank, and the village can pay (shells, and for a rider the price of his beast, which ranks.json already counts). There is no promotion:
 * a soldier who is let go goes back to rank 1 and his gear to the store; a new one is trained from the start.
 */
import { ARMORS, WEAPONS } from './combat';
import { discountBill, perkPct, soldierTier } from './research';
import { maxLevel } from './buildings';
import { MAX_RANK, rankDef, ranksOf } from './ranks';
import type { SpecialistDef } from './specialdata';
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
const armorKey = (id: string): string => `${id}${ARMORS[id]?.tier ?? 1}`;

/** What one soldier of a rank costs now: the price of the rank, cut by the research that hangs under its leap. */
export const trainCost = (sim: Sim, role: RankRole, rank: number): Partial<Stock> => { const d = rankDef(role, rank); return d ? discountBill(d.cost, perkPct(sim.researched, `train_${role}_${rank}`)) : {}; };

export function trainCheck(sim: Sim, role: RankRole, rank: number): TrainCheck {
  const def = rankDef(role, rank) ?? null;
  if (!def) return { def, missing: ['Không có bậc này'], ok: false };
  if (def.soon) return { def, missing: ['Chưa luyện được: thiếu vật liệu của thời đại'], ok: false };
  if (!ranksOf(role, sim.era).some((d) => d.rank === rank)) return { def, missing: ['Chưa tới thời đại của bậc này'], ok: false };
  const missing: string[] = [];
  const fireNeed = Math.min(rank, maxLevel('campfire', 'ancient')); // a rank of the medieval age needs a Nhà chung of its own level (or the highest there is)
  if (rank >= 4 && sim.fireLevel() < fireNeed) missing.push(`Cần Nhà chung cấp ${fireNeed} để luyện ${def.name.toLowerCase()}`);
  if (!rankOpen(sim, role, rank)) missing.push(`Chưa nghiên cứu mở ${def.name.toLowerCase()}`);
  if (!sim.hasWorkshop() && !sim.building('armory')) missing.push('Cần có Nhà chế tạo hoặc Kho vũ khí để lấy đồ');
  else if ((sim.toolStock[weaponKey(def.weapon)] ?? 0) <= 0) missing.push(`Kho hết ${WEAPONS[def.weapon].name.toLowerCase()}: hãy chế thêm`);
  if (def.armor && ARMORS[def.armor] && (sim.toolStock[armorKey(def.armor)] ?? 0) <= 0 && (sim.hasWorkshop() || sim.building('armory'))) missing.push(`Kho hết ${ARMORS[def.armor].name.toLowerCase()}: hãy chế thêm`);
  for (const [res, amount] of Object.entries(trainCost(sim, role, rank)) as Array<[Res, number]>) {
    if ((sim.stock[res] ?? 0) < amount) missing.push(`Thiếu ${RES_NAME[res].toLowerCase()}: cần ${amount}, có ${Math.floor(sim.stock[res] ?? 0)}`);
  }
  return { def, missing, ok: missing.length === 0 };
}

// ---------------------------------------------------------------- the specialists (data/specialists.json)
/** A specialist is worth the Nhà chung's level (4..10) when he is trained: his rank. */
export const specialistRank = (sim: Sim): number => Math.max(4, Math.min(MAX_RANK, sim.fireLevel()));
/** What one costs: the price of the core soldier of the same rank in his camp, times his factor. */
export function specialistCost(sim: Sim, def: SpecialistDef): Partial<Stock> {
  const out: Partial<Stock> = {};
  for (const [res, n] of Object.entries(rankDef(def.camp, specialistRank(sim))?.cost ?? {}) as Array<[Res, number]>) out[res] = Math.max(1, Math.round(n * def.costMult * (def.hire ? sim.legacyFx('hireCostMul') : 1))); // (the power Hợp đồng lính thuê: hired ones are cheaper)
  return out;
}
/** What stands between the village and one of them (empty when he can be trained or hired). */
export function specialistCheck(sim: Sim, def: SpecialistDef): { missing: string[]; ok: boolean } {
  const missing: string[] = [];
  if (!sim.isUnlocked(def.key)) missing.push('Chưa mở');
  if (sim.era !== 'ancient') missing.push('Chưa tới thời Trung cổ');
  if (!def.hire) {
    if (!sim.hasWorkshop() && !sim.building('armory')) missing.push('Cần có Nhà chế tạo hoặc Kho vũ khí để lấy đồ');
    else {
      if ((sim.toolStock[weaponKey(def.weapon)] ?? 0) <= 0) missing.push(`Kho hết ${(WEAPONS[def.weapon]?.name ?? def.weapon).toLowerCase()}: hãy chế thêm`);
      if (ARMORS[def.armor] && (sim.toolStock[armorKey(def.armor)] ?? 0) <= 0) missing.push(`Kho hết ${ARMORS[def.armor].name.toLowerCase()}: hãy chế thêm`);
    }
  }
  for (const [res, amount] of Object.entries(specialistCost(sim, def)) as Array<[Res, number]>) if ((sim.stock[res] ?? 0) < amount) missing.push(`Thiếu ${RES_NAME[res].toLowerCase()}: cần ${amount}, có ${Math.floor(sim.stock[res] ?? 0)}`);
  return { missing, ok: missing.length === 0 };
}
/** Train (or hire) the chosen villagers as specialists in their camp; the rank is the Nhà chung's level now. Returns why none could be, or null. */
export function trainSpecialist(sim: Sim, ids: readonly number[], def: SpecialistDef): string | null {
  let done = 0, why: string | null = null;
  for (const v of sim.mine(ids)) {
    const chk = specialistCheck(sim, def);
    if (!chk.ok) { why ??= chk.missing[0]; break; }
    const err = sim.assignRole([v.id], def.camp);
    if (err) { why ??= err; break; }
    v.rank = specialistRank(sim); v.spec = def.id;
    let gear: string | null = null;
    if (def.hire) { sim.giveGear([v.id], def.weapon, 'weapon'); sim.giveGear([v.id], def.armor, 'armor'); } // a hired one comes with his own gear
    else gear = sim.assignGear([v.id], def.weapon, 'weapon') ?? sim.assignGear([v.id], def.armor, 'armor');
    if (gear) { sim.releaseRole([v.id]); why ??= gear; break; }
    sim.pay(specialistCost(sim, def));
    v.manualGear = true;
    if (def.mount) v.mount = def.mount as typeof v.mount;
    done++;
    sim.say(`${v.name} thành ${def.name.toLowerCase()}.`);
  }
  return done ? null : why ?? 'Chọn người để luyện';
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
    if (def.armor && ARMORS[def.armor]) { const suit = sim.assignGear([v.id], def.armor, 'armor'); if (suit && v.armor !== def.armor) { sim.releaseRole([v.id]); why ??= suit; break; } } // the armour of the rank too, taken from the store
    sim.pay(trainCost(sim, role, rank));
    v.manualGear = true;
    if (def.mount) v.mount = def.mount as typeof v.mount; // the beast came with the price
    done++;
    sim.say(`${v.name} thành ${def.name.toLowerCase()}.`);
  }
  return done ? null : why ?? 'Chọn người để luyện';
}
