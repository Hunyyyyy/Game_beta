import data from '../data/research.json';
import type { BuildingKind } from './buildings';
import type { Stock } from './resources';

export interface Tech {
  id: string; name: string; desc: string;
  requires: string[];
  /** Workshop level needed to start it. */
  needLevel: number;
  cost: Partial<Stock>;
  time: number;
  unlocks: { recipes?: string[]; levels?: Partial<Record<BuildingKind, number>> };
}

export const TECHS = (data as unknown as { techs: Tech[] }).techs;
export const TECH_BY_ID: Record<string, Tech> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

/** Research orders share the craft queue; their ids carry this prefix. */
export const RESEARCH_PREFIX = 'r:';
export const isResearchOrder = (id: string) => id.startsWith(RESEARCH_PREFIX);
export const techOfOrder = (id: string): Tech | undefined => TECH_BY_ID[id.slice(RESEARCH_PREFIX.length)];

const LOCKED_RECIPES = new Set(TECHS.flatMap((t) => t.unlocks.recipes ?? []));
/** Recipes open from the start are the ones no technology lists. */
export const recipeOpen = (done: ReadonlySet<string>, recipeId: string): boolean =>
  !LOCKED_RECIPES.has(recipeId) || TECHS.some((t) => done.has(t.id) && t.unlocks.recipes?.includes(recipeId));
/** The tech that opens a recipe (undefined for recipes open from the start). */
export const techForRecipe = (recipeId: string): Tech | undefined => TECHS.find((t) => t.unlocks.recipes?.includes(recipeId));

/** Highest level a building kind may reach with the research done so far (1 when nothing is researched). */
export const levelCap = (done: ReadonlySet<string>, kind: BuildingKind): number =>
  TECHS.reduce((m, t) => (done.has(t.id) ? Math.max(m, t.unlocks.levels?.[kind] ?? 1) : m), 1);
/** The tech that opens `level` of a kind. */
export const techForLevel = (kind: BuildingKind, level: number): Tech | undefined => TECHS.find((t) => (t.unlocks.levels?.[kind] ?? 0) >= level);

/** What a tech unlocks, as a short Vietnamese phrase for the UI. */
export const unlockText = (t: Tech, recipeName: (id: string) => string): string => {
  const parts = [...(t.unlocks.recipes ?? []).map(recipeName)];
  for (const [k, n] of Object.entries(t.unlocks.levels ?? {})) parts.push(`${k === 'storage' ? 'Kho' : k === 'workshop' ? 'Xưởng' : k} cấp ${n}`);
  return parts.join(', ');
};
