/** How strong the villages of the land should be: a pure table of what the player can reach at each campfire level (src/content/difficulty.json) and what each tribe is worth against it. */
import cfg from '../content/difficulty.json';
import stats from '../data/stats.json';
import { BUILDINGS, POP_BY_FIRE } from './buildings';
import { CHAINS, statBonusAtLab } from './research';
import { BASE } from './statsys';

export const DIFF = cfg;
type Tier = Partial<Record<string, number>>;
const TIER_MULT = stats.tierMult as Record<string, Tier>;
const clampLevel = (level: number): number => Math.max(1, Math.min(POP_BY_FIRE.length, Math.round(level)));

/** People the village can hold at a campfire level: the campfire and the beds of the Nhà dân it allows, raised to that level. */
export function popCapAt(level: number): number {
  const L = clampLevel(level), house = BUILDINGS.house, lv = house.levels.stone!;
  return POP_BY_FIRE[L - 1] + (house.perFire?.[L - 1] ?? 0) * lv[Math.min(L, lv.length) - 1].slots;
}

/** The tier of soldiers (and workers) the research can open when the Nhà nghiên cứu is at this level. */
const tierAt = (lab: number, chain: 'military' | 'economy'): number => { const t = CHAINS[chain]?.finalTier; return t && t.needLab <= lab ? t.tier : 1; };
/** What a stat is worth against the plain person (1 = base) once every step of its line open at this level is researched, and the tier is open. */
function statRatio(stat: 'hp' | 'atk' | 'defm' | 'defr' | 'work' | 'int', lab: number, chain: 'military' | 'economy'): number {
  const tier = tierAt(lab, chain);
  return (1 + statBonusAtLab(stat, lab) / 100) * (tier > 1 ? TIER_MULT[String(tier)]?.[stat] ?? 1 : 1);
}

/** The most the player can field at a campfire level: all the people the village holds, `militaryShare` of them soldiers, all fully researched. */
export function playerCap(level: number): { economy: number; military: number; total: number } {
  const L = clampLevel(level), pop = popCapAt(L), soldiers = pop * cfg.militaryShare, workers = pop - soldiers;
  const fighter = statRatio('hp', L, 'military') * statRatio('atk', L, 'military') * (statRatio('defm', L, 'military') + statRatio('defr', L, 'military')) / 2;
  const worker = statRatio('work', L, 'economy') * (1 + stats.intEffect.work * (statRatio('int', L, 'economy') - 1));
  const economy = workers * worker, military = soldiers * fighter;
  return { economy, military, total: cfg.power.economy * economy + cfg.power.military * military };
}

export type TierId = 'weak' | 'normal' | 'medium' | 'boss' | 'rebel' | 'raider';
export const TIERS = cfg.tiers;

/** The camp level of a village of a tier when the player's campfire is at `fire`: his plus the tier's edge, from 1 up to the tier's top level (so that a weak village stays easy and the boss stays a step above). */
export const tierLevel = (fire: number, tier: TierId): number => Math.max(1, Math.min(TIERS[tier].capLevel, Math.round(fire) + TIERS[tier].edge));

/**
 * What a village of a tier is worth when the player's campfire is at `fire`: the tier's strength of the most the player can field at the level of its camp
 * (tierLevel: below his fire for a weak village, level with it for a normal one, a step above for a medium one; a boss is worth boss.power of the most he can field a step above him,
 * and boss.economy of his economy).
 */
export function tierTarget(fire: number, tier: TierId): { economy: number; military: number } {
  const t = TIERS[tier];
  if (tier === 'boss' || tier === 'rebel') { const cap = playerCap(tierLevel(fire, tier)), share = tier === 'rebel' ? cfg.capture.rebel.share : 1; return { military: cap.military * cfg.boss.power * share, economy: cap.economy * cfg.boss.economy * share }; }
  const cap = playerCap(tierLevel(fire, tier)), strength = (t as { strength: number }).strength;
  return { military: cap.military * strength, economy: cap.economy * strength };
}

/** The army power a raid of this ratio brings: the ratio of the player's army now, never under `raid.floor` nor over `raid.ceiling` of the most the player can field at this campfire level. */
export function raidPower(playerMilitary: number, ratio: number, level: number): number {
  const top = playerCap(level).military;
  return Math.max(cfg.raid.floor * top, Math.min(cfg.raid.ceiling * top, playerMilitary * ratio));
}

/**
 * The percent of every combat stat (army) and of the speed of work (economy) the people of a tribe need on top of the plain person to be worth their target,
 * given how many soldiers and workers it has. An army's worth grows with the cube of the percent (health, strength and defence all rise), a worker's with the first power.
 */
export function tribeBonuses(level: number, tier: TierId, soldiers: number, workers: number): { mil: number; eco: number } {
  const t = tierTarget(level, tier), [lo, hi] = cfg.bonusClamp, clamp = (x: number) => Math.max(lo, Math.min(hi, x));
  return { mil: soldiers > 0 ? clamp(Math.cbrt(t.military / soldiers) - 1) : 0, eco: workers > 0 ? clamp(t.economy / workers - 1) : 0 };
}

export const baseWork = BASE.work;
