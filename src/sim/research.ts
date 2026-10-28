import data from '../data/research.json';
import type { BuildingKind } from './buildings';
import type { Stock } from './resources';

/** One research step. For blueprints the id is the recipe id it opens (axe1 = wood axe, axe2 = stone axe). */
export interface Tech {
  id: string; name: string; desc: string;
  requires: string[];
  /** Level the Nhà nghiên cứu must have. */
  needLevel: number;
  /** Trí tuệ the best researcher inside must have. */
  minInt: number;
  cost: Partial<Stock>;
  /** Seconds with one average researcher at speed 1. */
  time: number;
  unlocks: { recipes?: string[]; levels?: Partial<Record<BuildingKind, number>>; buildings?: BuildingKind[]; auto?: string[] };
}

/** Research is on by default; with `enabled` false every recipe, building level and automation is open. */
export const RESEARCH = { enabled: (data as unknown as { enabled: boolean }).enabled };
/** Workshop level each recipe needs. */
const RECIPE_LEVEL = (data as unknown as { recipeLevel: Record<string, number> }).recipeLevel;
export const recipeNeedLevel = (id: string): number => RECIPE_LEVEL[id] ?? 1;
export const TECHS = (data as unknown as { techs: Tech[] }).techs;
export const TECH_BY_ID: Record<string, Tech> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

/** A recipe can be made once its blueprint step is researched. */
export const recipeOpen = (done: ReadonlySet<string>, recipeId: string): boolean => !RESEARCH.enabled || done.has(recipeId);
/** The blueprint step that opens a recipe. */
export const techForRecipe = (recipeId: string): Tech | undefined => TECH_BY_ID[recipeId] ?? TECHS.find((t) => t.unlocks.recipes?.includes(recipeId));

/** Highest level a building kind may reach with the research done so far (1 when nothing is researched). */
export const levelCap = (done: ReadonlySet<string>, kind: BuildingKind): number => !RESEARCH.enabled || kind === 'campfire' ? Infinity :
  TECHS.reduce((m, t) => (done.has(t.id) ? Math.max(m, t.unlocks.levels?.[kind] ?? 1) : m), 1);
/** The tech that opens `level` of a kind. */
export const techForLevel = (kind: BuildingKind, level: number): Tech | undefined => TECHS.find((t) => (t.unlocks.levels?.[kind] ?? 0) >= level);

/** The tech that allows a kind of building to be built (undefined when it is open from the start). */
export const techForBuilding = (kind: BuildingKind): Tech | undefined => TECHS.find((t) => t.unlocks.buildings?.includes(kind));
export const buildingOpen = (done: ReadonlySet<string>, kind: BuildingKind): boolean => { const t = techForBuilding(kind); return !RESEARCH.enabled || !t || done.has(t.id); };
/** Whether an automation is switched on: 'fetch' (villagers fetch tools from the stores) or 'order' (they order crafting and repair). */
export const autoOn = (done: ReadonlySet<string>, key: string): boolean => !RESEARCH.enabled || TECHS.some((t) => done.has(t.id) && t.unlocks.auto?.includes(key));

const KIND_NAME: Partial<Record<BuildingKind, string>> = { storage: 'Kho', workshop: 'Nhà chế tạo', lab: 'Nhà nghiên cứu', repair: 'Nhà sửa chữa', toolstore: 'Kho công cụ', armory: 'Kho vũ khí', barracks: 'Lều chiến binh', house: 'Nhà dân', field: 'Ruộng', fence: 'Hàng rào', gate: 'Cổng', tower: 'Chòi canh', wartent: 'Lều họp chiến', drill: 'Bãi tập', trap: 'Hố chông' };
/** What a tech unlocks, as a short Vietnamese phrase for the UI. */
export const unlockText = (t: Tech, recipeName: (id: string) => string): string => {
  const parts = [...(t.unlocks.recipes ?? []).map(recipeName)];
  const lv = Object.values(t.unlocks.levels ?? {})[0];
  if (lv) parts.push(`mọi nhà lên cấp ${lv}`);
  for (const k of t.unlocks.buildings ?? []) parts.push(`xây ${KIND_NAME[k] ?? k}`);
  if (t.unlocks.auto?.includes('fetch')) parts.push('dân tự lấy đồ ở kho');
  if (t.unlocks.auto?.includes('order')) parts.push('dân tự đặt chế tạo và sửa chữa');
  return parts.join(', ');
};
