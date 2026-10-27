export type Res = 'wood' | 'stone' | 'food';
export const RES_LIST: Res[] = ['food', 'wood', 'stone'];
export const RES_NAME: Record<Res, string> = { wood: 'Gỗ', stone: 'Đá', food: 'Thức ăn' };
export type Stock = Record<Res, number>;
export const emptyStock = (): Stock => ({ wood: 0, stone: 0, food: 0 });

/** Mỗi dân mang tối đa 4 đơn vị nặng (gỗ, đá) hoặc 10 đơn vị nhẹ (thức ăn). */
export const CARRY_CAP: Record<Res, number> = { wood: 4, stone: 4, food: 10 };
/** Mỗi đơn vị thức ăn hồi bao nhiêu điểm no (thang 0–100). */
export const FOOD_NUTRITION = 25;
