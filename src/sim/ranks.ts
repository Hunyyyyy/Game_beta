/**
 * The ranks of soldiers (data/ranks.json, doc/thiet_ke_bac_linh.md): what each branch trains at each rank, what a rank is worth in strength and in food. Pure data and rules:
 * nothing here reads the Sim or the state of a game.
 */
import ranksJson from '../data/ranks.json';
import type { Era } from './buildings';
import type { StatId } from './research';
import { RES_NAME } from './resources';
import type { Res, Stock } from './resources';

/** The branches of the camps that train soldiers: the three arms and the guards of the Trại lính gác. */
export type RankRole = 'foot' | 'archer' | 'cavalry' | 'guard';
export const RANK_ROLES: readonly RankRole[] = ['foot', 'archer', 'cavalry', 'guard'];
export interface RankDef { rank: number; name: string; weapon: string; armor?: string; mount?: string; cost: Partial<Stock>; soon?: boolean }

const BRANCHES = ranksJson.branches as unknown as Record<RankRole, RankDef[]>;
export const isRankRole = (r: string | null | undefined): r is RankRole => !!r && (RANK_ROLES as readonly string[]).includes(r);

/** The ranks a branch trains in an era, lowest first: the stone age ones, then (in the medieval age) all of them. */
export function ranksOf(role: RankRole, era: Era): RankDef[] {
  const open = (ranksJson.eraRanks as Record<string, number[]>)[era] ?? [1];
  return BRANCHES[role].filter((d) => open.includes(d.rank));
}
export const rankDef = (role: RankRole, rank: number): RankDef | undefined => BRANCHES[role].find((d) => d.rank === rank);
/** The name of a soldier of a rank, or null when the branch has no such rank. */
export const rankName = (role: RankRole, rank: number): string | null => rankDef(role, rank)?.name ?? null;

/** The strength of a rank (1 for the first): the number the soldiers of that rank are worth against a rank 1 one. */
export const rankPower = (rank: number): number => ranksJson.power[Math.max(0, Math.min(ranksJson.power.length, rank) - 1)];
/** What a rank does to a stat: the power of the rank to the exponent of that stat (1 when the stat does not follow the rank). */
export function rankStatMult(rank: number, stat: StatId): number {
  const e = (ranksJson.statExp as Record<string, number>)[stat];
  return e ? rankPower(rank) ** e : 1;
}
/** What a branch does to a stat on top of its rank (ranks.json `profile`): the guards have more health and defence and hit less hard. 1 when the branch has no profile for the stat. */
export const branchStatMult = (role: string, stat: StatId): number => (ranksJson.profile as Record<string, Record<string, number> | string>)[role] instanceof Object ? ((ranksJson.profile as unknown as Record<string, Record<string, number>>)[role][stat] ?? 1) : 1;
/** How much more a soldier of a rank eats. */
export const rankRation = (rank: number): number => ranksJson.ration[Math.max(0, Math.min(ranksJson.ration.length, rank) - 1)];
/** The bill of one soldier of a rank, for the player to read: "2 vỏ" or "11 vỏ, 50 lương, 20 da". */
export const trainBill = (def: RankDef, cost: Partial<Stock> = def.cost): string => (Object.entries(cost) as Array<[Res, number]>).map(([res, n]) => `${n} ${RES_NAME[res].toLowerCase()}`).join(', ');
