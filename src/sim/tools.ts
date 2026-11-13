import type { WorkJob } from './jobs';
import { ARMORS, RULES, WEAPONS } from './combat';
import { scaleBill } from './resources';
import type { Stock } from './resources';

export type ToolKind = 'axe' | 'pick' | 'hoe' | 'hammer';
export const TOOL_KINDS: ToolKind[] = ['axe', 'pick', 'hoe', 'hammer'];
export const TOOL_NAME: Record<ToolKind, string> = { axe: 'Rìu', pick: 'Cuốc chim', hoe: 'Cuốc', hammer: 'Búa' };
export const TOOL_USE: Record<ToolKind, string> = { axe: 'đốn gỗ', pick: 'đục đá', hoe: 'hái lượm, đào củ', hammer: 'dựng công trình' };
/** Nghề nào dùng công cụ nào (thợ thủ công luôn dùng búa đá, không cần). */
export const TOOL_OF_JOB: Partial<Record<WorkJob, ToolKind>> = { wood: 'axe', stone: 'pick', mine: 'pick', food: 'hoe', build: 'hammer' };

/** Bậc chất lượng: 0 = tay không, 1 = gỗ, 2 = đá. */
export const TIER_NAME = ['Tay không', 'Gỗ', 'Đá', 'Đồng', 'Sắt', 'Thép'];
/** The best tier a tool can have (the medieval ones: bronze, iron, steel; the head colours of each are in data/handtools/tiers.json). */
export const MAX_TOOL_TIER = 5;
export const TIER_SPEED = [0.6, 1, 1.4, 1.7, 2, 2.4];     // nhân tốc độ làm việc
export const TIER_YIELD = [1, 1.25, 1.6, 1.9, 2.2, 2.6];    // đơn vị thu được mỗi lần (1,6 ≈ 15 → 24 gỗ mỗi cây trong tài liệu)
export const TIER_DURABILITY = [0, 240, 600, 1100, 1900, 3200]; // giây làm việc trước khi gãy

/** Gear a fighter wears: crafted weapons and armour share the recipe, stock and equip flow of tools. */
export type GearKind = 'club' | 'spear' | 'mace' | 'thrown_stone' | 'sling' | 'bow' | 'grass' | 'hide' | 'bone'
  | 'bronze_sword' | 'bronze_spear' | 'bronze_bow' | 'bronze' | 'arming_sword' | 'composite_bow' | 'lance' | 'short_spear' | 'footman' | 'archer' | 'rider' | 'watchman';
export const GEAR_KINDS: GearKind[] = ['club', 'spear', 'mace', 'thrown_stone', 'sling', 'bow', 'grass', 'hide', 'bone',
  'bronze_sword', 'bronze_spear', 'bronze_bow', 'bronze', 'arming_sword', 'composite_bow', 'lance', 'short_spear', 'footman', 'archer', 'rider', 'watchman'];
/** A suit of armour (the hide one, the hide and bone one) rather than a weapon. */
export const isArmorKind = (k: string): boolean => k in ARMORS;
export const isGear = (k: string): k is GearKind => (GEAR_KINDS as string[]).includes(k);
export const isWeaponKind = (k: string) => k in WEAPONS;

export interface Recipe { id: string; kind: ToolKind | GearKind | 'torch'; tier: number; cost: Partial<Stock>; time: number }
const R = (kind: ToolKind | GearKind | 'torch', tier: number, cost: Partial<Stock>, time: number): Recipe => ({ id: `${kind}${tier}`, kind, tier, cost: scaleBill(cost), time });
const gearRecipe = (kind: GearKind): Recipe => {
  const d = isArmorKind(kind) ? ARMORS[kind] : WEAPONS[kind];
  return R(kind, d.tier ?? 1, d.cost ?? {}, d.time ?? 60);
};
export const RECIPES: Recipe[] = [
  R('axe', 1, { wood: 3 }, 24), R('axe', 2, { wood: 2, stone: 3 }, 40),
  R('pick', 1, { wood: 4 }, 28), R('pick', 2, { wood: 2, stone: 4 }, 44),
  R('hoe', 1, { wood: 3 }, 24), R('hoe', 2, { wood: 2, stone: 2 }, 36),
  R('hammer', 1, { wood: 3 }, 24), R('hammer', 2, { wood: 2, stone: 3 }, 36),
  ...TOOL_KINDS.flatMap((k) => [R(k, 3, { bronze: 2, hardwood: 1 }, 40), R(k, 4, { iron: 3, hardwood: 2 }, 50), R(k, 5, { steel: 3, hardwood: 2 }, 60)]), // the medieval tools: bronze, iron, steel
  R('torch', 1, { wood: 2 }, 12),
  ...GEAR_KINDS.map(gearRecipe),
];
export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const recipeName = (r: Recipe) => {
  if (isArmorKind(r.kind)) return ARMORS[r.kind].name;
  if (r.kind === 'torch') return 'Đuốc';
  if (isWeaponKind(r.kind)) return WEAPONS[r.kind].name;
  return `${TOOL_NAME[r.kind as ToolKind]} ${TIER_NAME[r.tier].toLowerCase()}`;
};
/** One-line use shown in the crafting panel (what it is for, no numbers: those are `recipeStats`). */
export const recipeUse = (r: Recipe) => {
  if (isArmorKind(r.kind)) return 'Giáp mặc trên người';
  if (r.kind === 'torch') return 'làm việc ban đêm (hiệu suất 70%), nhìn xa hơn trong tối';
  if (isWeaponKind(r.kind)) return WEAPONS[r.kind].ranged ? 'Vũ khí tầm xa' : 'Vũ khí cận chiến';
  const t = TOOL_USE[r.kind as ToolKind]; return t.charAt(0).toUpperCase() + t.slice(1);
};

/** The numbers of a recipe as picture + value, drawn by the UI with `statIcon(icon)`. */
export interface RecipeStat { icon: string; value: string; title: string }
const trim = (n: number): string => String(Math.round(n * 100) / 100);
export const recipeStats = (r: Recipe): RecipeStat[] => {
  if (isArmorKind(r.kind)) { const a = ARMORS[r.kind]; return [{ icon: 'defm', value: `+${a.defm}`, title: 'Phòng thủ cận chiến' }, { icon: 'defr', value: `+${a.defr}`, title: 'Phòng thủ tầm xa' }, { icon: 'tdur', value: String(a.durability ?? '?'), title: 'Độ bền (số đòn chịu được)' }]; }
  if (r.kind === 'torch') return [];
  if (isWeaponKind(r.kind)) {
    const w = WEAPONS[r.kind];
    return [
      { icon: 'atk', value: trim(w.damage), title: 'Sát thương' }, { icon: 'aspd', value: `${(1 / w.cycle).toFixed(2)}/s`, title: 'Tốc độ đánh (đòn mỗi giây)' },
      { icon: 'crit', value: `${Math.round((w.critDamage ?? RULES.critDamage) * 100)}%`, title: 'Sát thương chí mạng' }, { icon: 'range', value: trim(w.range), title: 'Tầm đánh' },
      { icon: 'tdur', value: String(w.durability ?? '?'), title: 'Độ bền (số đòn)' },
    ];
  }
  return [{ icon: 'work', value: `×${TIER_SPEED[r.tier]}`, title: 'Tốc độ làm việc' }, { icon: 'tyield', value: `×${TIER_YIELD[r.tier]}`, title: 'Thu hoạch mỗi lần' }, { icon: 'tdur', value: `${TIER_DURABILITY[r.tier]}s`, title: 'Độ bền (giây làm việc)' }];
};

export interface Tool { tier: number; dur: number }
export type ToolSet = Record<ToolKind, Tool | null>;
export const emptyToolSet = (): ToolSet => ({ axe: null, pick: null, hoe: null, hammer: null });
