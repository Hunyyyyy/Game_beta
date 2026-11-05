import data from '../data/progression.json';
import quests from '../data/quests.json';

/** The plan the village grows by (src/data/progression.json): what each campfire level opens, what each research-house level teaches, and the quests that lead to it. */
interface FireLevel { level: number; buildingMaxLevel: number; upgradeNeeds: { allUnlockedAtLeastLevel: number; groupAtLeastLevel?: Record<string, number> } | null }
interface LabLevel { level: number; techs: string[] }

const FIRE = data.campfire.levels as FireLevel[];
const LAB = data.research.levels as LabLevel[];
/** Cells of a formation, and squads that can be raised, before any research. */
export const CELLS_DEFAULT: number = data.formationDefaults.cells;
export const SQUADS_DEFAULT: number = data.formationDefaults.squads;

/** Highest level a house may have under a campfire of this level. */
export const fireBuildingMax = (fireLevel: number): number => (FIRE[Math.min(FIRE.length, Math.max(1, fireLevel)) - 1]).buildingMaxLevel;
/** Level every opened house must have reached before the campfire may leave this level, or null when it is the last. */
export const fireUpgradeNeeds = (fireLevel: number): number | null => FIRE[Math.min(FIRE.length, Math.max(1, fireLevel)) - 1].upgradeNeeds?.allUnlockedAtLeastLevel ?? null;

/** Groups of houses (e.g. "production") that must have reached a level before the campfire may leave this level, in addition to every opened house. */
export const fireUpgradeGroups = (fireLevel: number): Record<string, number> => FIRE[Math.min(FIRE.length, Math.max(1, fireLevel)) - 1].upgradeNeeds?.groupAtLeastLevel ?? {};

/** The research-house level a step is taught at (the level that lists it, or the last, which lists "@rest"). */
export function labLevelOf(techId: string): number {
  for (const l of LAB) if (l.techs.includes(techId)) return l.level;
  return LAB[LAB.length - 1].level;
}

/** Quests that wait for something done on the screen (selecting, opening, looking): the sim cannot see them, so a save keeps which were seen. */
export const SCREEN_QUESTS: string[] = (quests.quests as Array<{ id: string; done: { type: string } }>).filter((q) => ['selectBuilding', 'openBuilding', 'inspectNode', 'inspectUnit', 'inspectAnimal', 'speed', 'daytime'].includes(q.done.type)).map((q) => q.id);
