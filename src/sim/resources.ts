import foodJson from '../data/food.json';
export type Res = 'wood' | 'stone' | 'food' | 'hide' | 'bone' | 'fat' | 'feather' | 'tusk' | 'coin';
export const RES_LIST: Res[] = ['food', 'wood', 'stone', 'hide', 'bone', 'fat', 'feather', 'tusk', 'coin'];
/** Materials that only animals give; the top bar shows them once the village has some. */
export const ANIMAL_MATERIALS: Res[] = ['bone', 'fat', 'feather', 'tusk'];
/** Money changes with the era; the stone age has no metal, so it trades in shells. RES_NAME.coin follows the current era. */
export const CURRENCY: Record<string, string> = { stone: 'Vỏ sò', ancient: 'Đồng xu' };
export const RES_NAME: Record<Res, string> = { wood: 'Gỗ', stone: 'Đá', food: 'Thức ăn', hide: 'Da', bone: 'Xương', fat: 'Mỡ', feather: 'Lông vũ', tusk: 'Ngà', coin: CURRENCY.stone };
/** What a bartering villager gives for one coin: units of the good. */
export const BARTER: Record<Exclude<Res, 'coin'>, number> = { food: 10, wood: 5, stone: 5, hide: 2, bone: 4, fat: 4, feather: 10, tusk: 1 };
export type Stock = Record<Res, number>;
export const emptyStock = (): Stock => ({ wood: 0, stone: 0, food: 0, hide: 0, bone: 0, fat: 0, feather: 0, tusk: 0, coin: 0 });

/** Mỗi dân mang tối đa 4 đơn vị nặng (gỗ, đá) hoặc 10 đơn vị nhẹ (thức ăn). */
export const CARRY_CAP: Record<Res, number> = { wood: 4, stone: 4, food: 10, hide: 10, bone: 6, fat: 6, feather: 10, tusk: 2, coin: 0 };

/** The food rules (src/data/food.json): what a villager and a soldier eat at the end of each day, by level of the campfire, and the most the village weakens when it goes short. */
export const FOOD = foodJson as { ration: { villager: number[]; soldier: number[] }; maxPenalty: number };
/** The ration one person eats at the end of a day, at this level of the campfire. */
export const rationAt = (fireLevel: number, soldier: boolean): number => {
  const list = soldier ? FOOD.ration.soldier : FOOD.ration.villager;
  return list[Math.max(0, Math.min(list.length, fireLevel) - 1)];
};
