import type { WorkJob } from './jobs';
import type { Stock } from './resources';

export type ToolKind = 'axe' | 'pick' | 'hoe' | 'shovel';
export const TOOL_KINDS: ToolKind[] = ['axe', 'pick', 'hoe', 'shovel'];
export const TOOL_NAME: Record<ToolKind, string> = { axe: 'Rìu', pick: 'Cuốc chim', hoe: 'Cuốc', shovel: 'Xẻng' };
export const TOOL_USE: Record<ToolKind, string> = { axe: 'đốn gỗ', pick: 'đục đá', hoe: 'hái lượm, đào củ', shovel: 'dựng công trình' };
/** Nghề nào dùng công cụ nào (thợ thủ công luôn dùng búa đá, không cần). */
export const TOOL_OF_JOB: Partial<Record<WorkJob, ToolKind>> = { wood: 'axe', stone: 'pick', food: 'hoe', build: 'shovel' };

/** Bậc chất lượng: 0 = tay không, 1 = gỗ, 2 = đá. */
export const TIER_NAME = ['Tay không', 'Gỗ', 'Đá'];
export const TIER_SPEED = [0.6, 1, 1.4];     // nhân tốc độ làm việc
export const TIER_YIELD = [1, 1.25, 1.6];    // đơn vị thu được mỗi lần (1,6 ≈ 15 → 24 gỗ mỗi cây trong tài liệu)
export const TIER_DURABILITY = [0, 240, 600]; // giây làm việc trước khi gãy

export interface Recipe { id: string; kind: ToolKind; tier: 1 | 2; cost: Partial<Stock>; time: number }
const R = (kind: ToolKind, tier: 1 | 2, cost: Partial<Stock>, time: number): Recipe => ({ id: `${kind}${tier}`, kind, tier, cost, time });
export const RECIPES: Recipe[] = [
  R('axe', 1, { wood: 3 }, 12), R('axe', 2, { wood: 2, stone: 3 }, 20),
  R('pick', 1, { wood: 4 }, 14), R('pick', 2, { wood: 2, stone: 4 }, 22),
  R('hoe', 1, { wood: 3 }, 12), R('hoe', 2, { wood: 2, stone: 2 }, 18),
  R('shovel', 1, { wood: 3 }, 12), R('shovel', 2, { wood: 2, stone: 3 }, 18),
];
export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const recipeName = (r: Recipe) => `${TOOL_NAME[r.kind]} ${TIER_NAME[r.tier].toLowerCase()}`;

export interface Tool { tier: number; dur: number }
export type ToolSet = Record<ToolKind, Tool | null>;
export const emptyToolSet = (): ToolSet => ({ axe: null, pick: null, hoe: null, shovel: null });
