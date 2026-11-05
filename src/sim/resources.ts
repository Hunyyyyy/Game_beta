import foodJson from '../data/food.json';
import resourcesJson from '../content/resources.json';
import paceJson from '../data/pace.json';
/** Every good of the game is an entry of src/content/resources.json: its name, how much one villager carries, what it barters for, and what unlocks it. */
interface ResourceDef { name: string; carry: number; barter: number | null; hud: 'always' | 'whenOwned'; unlock: { building: string; level: number } | null }
const DEFS = resourcesJson.resources as Record<keyof typeof resourcesJson.resources, ResourceDef>;
export type Res = keyof typeof resourcesJson.resources;
export const RES_LIST = Object.keys(DEFS) as Res[];
/** Materials the top bar shows only once the village has some. */
export const ANIMAL_MATERIALS: Res[] = RES_LIST.filter((r) => DEFS[r].hud === 'whenOwned');
/** Money changes with the era; the stone age has no metal, so it trades in shells. RES_NAME.coin follows the current era. */
export const CURRENCY: Record<string, string> = { stone: 'Vỏ sò', ancient: 'Đồng xu' };
export const RES_NAME = Object.fromEntries(RES_LIST.map((r) => [r, DEFS[r].name])) as Record<Res, string>;
/** What a bartering villager gives for one coin: units of the good. */
export const BARTER = Object.fromEntries(RES_LIST.filter((r) => DEFS[r].barter !== null).map((r) => [r, DEFS[r].barter])) as Record<Exclude<Res, 'coin'>, number>;
export type Stock = Record<Res, number>;
export const emptyStock = (): Stock => Object.fromEntries(RES_LIST.map((r) => [r, 0])) as Stock;

/** How much one villager carries of each good. */
export const CARRY_CAP = Object.fromEntries(RES_LIST.map((r) => [r, DEFS[r].carry])) as Record<Res, number>;

/** What a good needs before the village can take it in: a finished house of a kind at a level (null: it is open from the start). */
export const resourceUnlock = (res: Res): { building: string; level: number } | null => DEFS[res].unlock;
/** Whether the village can take a good in, given its houses. */
export const resourceOpen = (res: Res, buildings: ReadonlyArray<{ kind: string; level: number; done: boolean }>): boolean => {
  const u = DEFS[res].unlock;
  return !u || buildings.some((b) => b.done && b.kind === u.building && b.level >= u.level);
};

/** The food rules (src/data/food.json): what a villager and a soldier eat at the end of each day, by level of the campfire, and the most the village weakens when it goes short. */
export const FOOD = foodJson as { ration: { villager: number[]; soldier: number[] }; maxPenalty: number };
/** The ration one person eats at the end of a day, at this level of the campfire. */
export const rationAt = (fireLevel: number, soldier: boolean): number => {
  const list = soldier ? FOOD.ration.soldier : FOOD.ration.villager;
  return list[Math.max(0, Math.min(list.length, fireLevel) - 1)];
};

/** What a thing costs after the village's wealth is taken into account (data/pace.json "costMult": a multiple for each good): every price of building, upgrading, research and crafting goes through here once, when the tables are made. */
export const scaleBill = <T extends Partial<Record<Res, number>>>(cost: T): T => {
  const m = paceJson.costMult as Partial<Record<Res, number>>, out: Partial<Record<Res, number>> = {};
  for (const [r, n] of Object.entries(cost) as Array<[Res, number]>) out[r] = Math.max(1, Math.ceil(n * (m[r] ?? 1) - 1e-9));
  return out as T;
};
