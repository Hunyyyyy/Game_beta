/**
 * What the legacy does in the game (doc/UPDATE_di_san_mo_khoa.md, numbers in data/specialists.json `effects`): each specialist building that stands and each power of a tip the village holds
 * changes one number of a system that already exists (tribute, bodyguards, squads, march, research, craft cost, allies, raid warnings, relation). The other systems ask `sim.legacyFx(key)`; nothing here reaches into them.
 * Also the two things a player does with it: calling the allies to keep the village (Trạm Liên Lạc) and the free blueprint of the easy mode.
 */
import SPEC from '../data/specialists.json';
import { SEASON_DAYS } from './calendar';
import type { Sim, Villager } from './sim';

const FX = SPEC.effects;
export type FxKey = 'betrayMul' | 'tributeMul' | 'wardSlots' | 'squadsAdd' | 'marchMul' | 'researchSlots' | 'gearCostMul' | 'allyMul' | 'warnDays' | 'hireCostMul' | 'relationLossMul' | 'relationGainMul';
/** What is saved: the season the allies were last called and the day they go home, the day until which no war may be begun (Ngai rỗng), the vote of the council on a war, the blueprints still to be had for nothing. */
export interface LegacyState { aidStamp: number; aidUntil: number; warBanUntil: number; vote: { tribe: string; day: number } | null; planTokens: number; tokenGiven: boolean; /** The war now: the village, how many soldiers each side began with, the moments told, the one waiting to be told (story.ts). Null in peace and in every save. */ tributeDay?: number; killerSeason?: number; war: { tribe: string; foe0: number; our0: number; fired: string[]; pending: string | null; leaderDown?: boolean } | null }
export const initialLegacy = (): LegacyState => ({ aidStamp: -1, aidUntil: 0, warBanUntil: 0, vote: null, planTokens: 0, tokenGiven: false, war: null });

/** The specialist buildings that stand, looked up once a second (the numbers are asked on every blow of a battle). */
const standing = new WeakMap<Sim, { t: number; n: number; kinds: Set<string> }>();
const stands = (sim: Sim, kind: string): boolean => {
  let c = standing.get(sim);
  if (!c || Math.floor(sim.time) !== c.t || sim.buildings.length !== c.n) { c = { t: Math.floor(sim.time), n: sim.buildings.length, kinds: new Set(sim.buildings.filter((b) => b.done).map((b) => b.kind as string)) }; standing.set(sim, c); }
  return c.kinds.has(kind);
};
const power = (sim: Sim, id: string): boolean => sim.isUnlocked(`perk:${id}`) && !sim.dev.unlockAll; // the dev switch opens what can be built and trained, not the powers

/** One number of the legacy now: a multiplier (1 when nothing changes it) or something added (0). */
export function fx(sim: Sim, key: FxKey): number {
  switch (key) {
    case 'betrayMul': return stands(sim, 'elder_hall') ? FX.elder_hall.betrayMul : 1;
    case 'tributeMul': return stands(sim, 'tribute_post') ? FX.tribute_post.tributeMul : 1;
    case 'wardSlots': return 1 + (stands(sim, 'bodyguard_lodge') ? FX.bodyguard_lodge.wardSlots : 0);
    case 'squadsAdd': return stands(sim, 'twin_camp') ? FX.twin_camp.squadsAdd : 0;
    case 'marchMul': return stands(sim, 'conquest_beacon') ? FX.conquest_beacon.marchMul : 1;
    case 'researchSlots': return 1 + (stands(sim, 'academy') ? FX.academy.researchSlots : 0);
    case 'gearCostMul': return stands(sim, 'hidden_forge') ? FX.hidden_forge.gearCostMul : 1;
    case 'allyMul': return power(sim, 'coalition') ? FX.coalition.allyMul : 1;
    case 'warnDays': return power(sim, 'eyes') ? FX.eyes.warnDays : 0;
    case 'hireCostMul': return power(sim, 'mercenary') ? FX.mercenary.hireCostMul : 1;
    case 'relationLossMul': return power(sim, 'reconcile') ? FX.reconcile.relationLossMul : 1;
    case 'relationGainMul': return power(sim, 'refuge') ? FX.refuge.relationGainMul : 1;
  }
}

/** Đền Tưởng Niệm: our blows on the soldiers of a village that is hostile to us hit harder. 1 for every other blow. */
export function grudgeEdge(sim: Sim, from: Villager | undefined, to: Villager): number {
  if (!from || from.team !== 'player' || to.team === 'player') return 1;
  let m = stands(sim, 'memorial_shrine') && sim.tribeHostile(to.team) ? FX.memorial_shrine.grudgeDamage : 1;
  if (sim.stoneTip('N6') && sim.tribes.some((t) => t.id === to.team && t.boss)) m *= 1.1; // (the Ngọn Dòng Máu Thù: soldiers fight the sworn enemy harder)
  return m;
}

/** Why the allies cannot be called now to keep the village (Trạm Liên Lạc), or null. Once a season. */
export function aidBlock(sim: Sim): string | null {
  if (!stands(sim, 'liaison_post')) return 'Cần dựng Trạm Liên Lạc';
  if (sim.atWar()) return 'Đang chiến tranh: đồng minh đã ở cùng quân rồi';
  if (sim.legacy.aidStamp === Math.floor((sim.day - 1) / SEASON_DAYS)) return 'Mùa này đã gọi viện binh rồi';
  if (sim.legacy.aidUntil > 0) return 'Viện binh đang ở làng';
  return null;
}
/** Call the allies to keep the village for a few days: the villages that stand by us send soldiers as they do for a war (tribes.summonAllies). Returns an error or null. */
export function callAid(sim: Sim): string | null {
  const no = aidBlock(sim);
  if (no) return no;
  const n = sim.summonAllies();
  if (n <= 0) return 'Chưa có làng nào đứng về phía mình (làng cống nạp, hoặc làng thân thiết hết mức)';
  sim.legacy.aidStamp = Math.floor((sim.day - 1) / SEASON_DAYS); sim.legacy.aidUntil = sim.day + FX.liaison_post.aidDays;
  sim.say(`${n} lính đồng minh tới giữ làng trong ${FX.liaison_post.aidDays} ngày.`);
  return null;
}
/** Once a second: the allies called to keep the village go home when their days are over (a war keeps them until it ends, as always). */
export function tickLegacy(sim: Sim): void {
  const st = sim.legacy;
  if (st.aidUntil > 0 && sim.day >= st.aidUntil && !sim.atWar()) { st.aidUntil = 0; sim.dismissAllies(); sim.say('Viện binh của đồng minh đã về làng họ.'); }
}
