import type { WorkJob } from './jobs';
import { ARMORS, WEAPONS } from './combat';
import type { Stock } from './resources';

export type ToolKind = 'axe' | 'pick' | 'hoe' | 'hammer';
export const TOOL_KINDS: ToolKind[] = ['axe', 'pick', 'hoe', 'hammer'];
export const TOOL_NAME: Record<ToolKind, string> = { axe: 'Rìu', pick: 'Cuốc chim', hoe: 'Cuốc', hammer: 'Búa' };
export const TOOL_USE: Record<ToolKind, string> = { axe: 'đốn gỗ', pick: 'đục đá', hoe: 'hái lượm, đào củ', hammer: 'dựng công trình' };
/** Nghề nào dùng công cụ nào (thợ thủ công luôn dùng búa đá, không cần). */
export const TOOL_OF_JOB: Partial<Record<WorkJob, ToolKind>> = { wood: 'axe', stone: 'pick', food: 'hoe', build: 'hammer' };

/** Bậc chất lượng: 0 = tay không, 1 = gỗ, 2 = đá. */
export const TIER_NAME = ['Tay không', 'Gỗ', 'Đá'];
export const TIER_SPEED = [0.6, 1, 1.4];     // nhân tốc độ làm việc
export const TIER_YIELD = [1, 1.25, 1.6];    // đơn vị thu được mỗi lần (1,6 ≈ 15 → 24 gỗ mỗi cây trong tài liệu)
export const TIER_DURABILITY = [0, 240, 600]; // giây làm việc trước khi gãy

/** Gear a fighter wears: crafted weapons and armour share the recipe, stock and equip flow of tools. */
export type GearKind = 'club' | 'spear' | 'mace' | 'sling' | 'bow' | 'hide';
export const GEAR_KINDS: GearKind[] = ['club', 'spear', 'mace', 'sling', 'bow', 'hide'];
export const isGear = (k: string): k is GearKind => (GEAR_KINDS as string[]).includes(k);
export const isWeaponKind = (k: string) => k in WEAPONS;

export interface Recipe { id: string; kind: ToolKind | GearKind | 'torch'; tier: 1 | 2; cost: Partial<Stock>; time: number }
const R = (kind: ToolKind | GearKind | 'torch', tier: 1 | 2, cost: Partial<Stock>, time: number): Recipe => ({ id: `${kind}${tier}`, kind, tier, cost, time });
const gearRecipe = (kind: GearKind): Recipe => {
  const d = kind === 'hide' ? ARMORS.hide : WEAPONS[kind];
  return R(kind, (d.tier ?? 1) as 1 | 2, d.cost ?? {}, d.time ?? 60);
};
export const RECIPES: Recipe[] = [
  R('axe', 1, { wood: 3 }, 24), R('axe', 2, { wood: 2, stone: 3 }, 40),
  R('pick', 1, { wood: 4 }, 28), R('pick', 2, { wood: 2, stone: 4 }, 44),
  R('hoe', 1, { wood: 3 }, 24), R('hoe', 2, { wood: 2, stone: 2 }, 36),
  R('hammer', 1, { wood: 3 }, 24), R('hammer', 2, { wood: 2, stone: 3 }, 36),
  R('torch', 1, { wood: 2 }, 12),
  ...GEAR_KINDS.map(gearRecipe),
];
export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const recipeName = (r: Recipe) => {
  if (r.kind === 'hide') return ARMORS.hide.name;
  if (r.kind === 'torch') return 'Đuốc';
  if (isWeaponKind(r.kind)) return WEAPONS[r.kind].name;
  return `${TOOL_NAME[r.kind as ToolKind]} ${TIER_NAME[r.tier].toLowerCase()}`;
};
/** One-line use shown in the crafting panel. */
export const recipeUse = (r: Recipe) => {
  if (r.kind === 'hide') return 'giáp, giảm sát thương';
  if (r.kind === 'torch') return 'làm việc ban đêm (hiệu suất 70%), nhìn xa hơn trong tối';
  if (isWeaponKind(r.kind)) { const w = WEAPONS[r.kind]; return `${{ pierce: 'đâm', slash: 'chém', crush: 'đập' }[w.type]} ${w.damage} · tầm ${w.range}`; }
  return TOOL_USE[r.kind as ToolKind];
};

export interface Tool { tier: number; dur: number }
export type ToolSet = Record<ToolKind, Tool | null>;
export const emptyToolSet = (): ToolSet => ({ axe: null, pick: null, hoe: null, hammer: null });
