import cfg from '../data/upgrades.json';

/** A stat the houses of soldiers raise: health, damage, or the speed of the blows. */
export type CampStat = 'hp' | 'atk' | 'aspd';
export const CAMP_KINDS: readonly string[] = cfg.camp.kinds;
export const CAMP_STATS = cfg.camp.stats as CampStat[];
export const CAMP_PCT = cfg.camp.pct;

/**
 * The stats a house of soldiers gives its people for reaching `level` (2 and up): `pick` different ones out of `stats`.
 * The pick belongs to the house and the level (a hash, not a die), so it is the same every time it is asked, and the upgrade dialog can tell it beforehand.
 */
export function campPicks(buildingId: number, level: number): CampStat[] {
  const pool = [...CAMP_STATS], out: CampStat[] = [];
  let x = Math.imul(buildingId + 1, 0x9e3779b1) ^ Math.imul(level, 0x85ebca6b);
  for (let i = 0; i < cfg.camp.pick && pool.length; i++) {
    x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d); x = Math.imul(x ^ (x >>> 12), 0x297a2d39); x ^= x >>> 15;
    out.push(pool.splice((x >>> 0) % pool.length, 1)[0]);
  }
  return out;
}

/** Percent a house of soldiers of this level adds to one stat of its people: `pct` for every level from 2 that picked it. */
export function campPercent(buildingId: number, level: number, stat: CampStat): number {
  let n = 0;
  for (let l = 2; l <= level; l++) if (campPicks(buildingId, l).includes(stat)) n++;
  return n * CAMP_PCT;
}

/** The stats the Lều họp chiến raises for every soldier of ours, and the percent each level from 2 adds (upgrades.json warTent). */
export const TENT_PCT = cfg.warTent.pct as Partial<Record<'hp' | 'atk' | 'defm' | 'defr', number>>;
