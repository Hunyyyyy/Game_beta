import data from '../data/progression.json';
import quests from '../data/quests.json';
import type { BuildingKind } from './buildings';

/** The plan the village grows by (src/data/progression.json): what each campfire level opens, what each research-house level teaches, and the quests that lead to it. */
interface FireLevel { level: number; unlock: string[]; buildingMaxLevel: number; upgradeNeeds: { allUnlockedAtLeastLevel: number } | null }
interface LabLevel { level: number; techs: string[] }

const GROUPS = data.groups as Record<string, string[]>;
const FIRE = data.campfire.levels as FireLevel[];
const LAB = data.research.levels as LabLevel[];
/** Cells of a formation, and squads that can be raised, before any research. */
export const CELLS_DEFAULT: number = data.formationDefaults.cells;
export const SQUADS_DEFAULT: number = data.formationDefaults.squads;

const names = (list: string[]): string[] => list.flatMap((k) => (k.startsWith('@') ? GROUPS[k.slice(1)] ?? [] : [k]));

/** The campfire level at which a kind of house may first be built (the level that lists it, or the one that lists "@rest"). */
export function fireUnlockLevel(kind: BuildingKind): number {
  for (const f of FIRE) if (names(f.unlock).includes(kind)) return f.level;
  return FIRE.find((f) => f.unlock.includes('@rest'))?.level ?? 1;
}
/** Highest level a house may have under a campfire of this level. */
export const fireBuildingMax = (fireLevel: number): number => (FIRE[Math.min(FIRE.length, Math.max(1, fireLevel)) - 1]).buildingMaxLevel;
/** Level every opened house must have reached before the campfire may leave this level, or null when it is the last. */
export const fireUpgradeNeeds = (fireLevel: number): number | null => FIRE[Math.min(FIRE.length, Math.max(1, fireLevel)) - 1].upgradeNeeds?.allUnlockedAtLeastLevel ?? null;

/** The research-house level a step is taught at (the level that lists it, or the last, which lists "@rest"). */
export function labLevelOf(techId: string): number {
  for (const l of LAB) if (l.techs.includes(techId)) return l.level;
  return LAB[LAB.length - 1].level;
}

/** Quests that wait for something done on the screen (selecting, opening, looking): the sim cannot see them, so a save keeps which were seen. */
export const SCREEN_QUESTS: string[] = (quests.quests as Array<{ id: string; done: { type: string } }>).filter((q) => ['selectBuilding', 'openBuilding', 'inspectNode', 'inspectUnit', 'inspectAnimal', 'speed', 'daytime'].includes(q.done.type)).map((q) => q.id);
