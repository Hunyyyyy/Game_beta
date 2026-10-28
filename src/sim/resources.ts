export type Res = 'wood' | 'stone' | 'food' | 'hide' | 'coin';
export const RES_LIST: Res[] = ['food', 'wood', 'stone', 'hide', 'coin'];
/** Money changes with the era; the stone age has no metal, so it trades in shells. RES_NAME.coin follows the current era. */
export const CURRENCY: Record<string, string> = { stone: 'Vỏ sò', ancient: 'Đồng xu' };
export const RES_NAME: Record<Res, string> = { wood: 'Gỗ', stone: 'Đá', food: 'Thức ăn', hide: 'Da và xương', coin: CURRENCY.stone };
/** What a bartering villager gives for one coin: units of the good. */
export const BARTER: Record<Exclude<Res, 'coin'>, number> = { food: 10, wood: 5, stone: 5, hide: 2 };
export type Stock = Record<Res, number>;
export const emptyStock = (): Stock => ({ wood: 0, stone: 0, food: 0, hide: 0, coin: 0 });

/** Mỗi dân mang tối đa 4 đơn vị nặng (gỗ, đá) hoặc 10 đơn vị nhẹ (thức ăn). */
export const CARRY_CAP: Record<Res, number> = { wood: 4, stone: 4, food: 10, hide: 10, coin: 0 };
/** Mỗi đơn vị thức ăn hồi bao nhiêu điểm no (thang 0–100). */
export const FOOD_NUTRITION = 20; // 2 thức ăn = 40 điểm no: 5 thức ăn mỗi ngày game
/** Game days before stored fruit spoils. */
export const FOOD_SPOIL_DAYS = 3;
