import type { Villager } from '../sim/sim';
import type { Ctx } from './ctx';
import { personTile } from './people';

/** The villagers lying in a house (the Nhà dân or the Lều chiến binh): a tile for each, with their strength as a number. */
export function sleeperRows(c: Ctx, list: Villager[]): HTMLElement[] {
  return list.map((v) => personTile(c, v));
}
