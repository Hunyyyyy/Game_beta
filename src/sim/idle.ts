/**
 * Free villagers ("dân rảnh"): everyone who has no trade. This is the one place that says who they are and where they live, so that every
 * house (role houses, the craft and research houses, the crew of the builders, the beds) asks the same questions and gets the same answers.
 *
 *   - who is free:        `isFree`, `freeFolk`
 *   - who may be offered a place in a house: `canTakeOn`
 *   - where somebody sleeps: `homeKind` (the house of the trade, and for the free the Nhà dân, then the campfire)
 */
import { ROLES, roleOf } from './jobs';
import type { BuildingKind } from './buildings';
import type { Sim } from './sim';
import type { Villager } from './model';

type Who = Pick<Villager, 'job' | 'arm' | 'post'>;

/** No trade at all: not a soldier, scout, gatherer, hunter, builder, nor working inside a house or a field. */
export const isFree = (v: Who): boolean => v.job === 'idle' && !roleOf(v);

/** The free villagers who can be given something right now: on their feet and out on the map (or lying in a house, asleep and not worn out, or hiding there while the village is attacked). */
export const freeFolk = (sim: Sim): Villager[] => sim.villagers.filter((v) => isFree(v) && v.down <= 0 && (v.inside === null || sim.hides(v) || (v.phase === 'sleep' && !sim.sleepLocked(v)))); // those lying in a house too (asleep, or hiding in an attack) unless worn out: giving them a trade wakes them

/** The free villagers out beyond `reach` tiles of the campfire and awake: the explorers who can be called back. */
export function farFolk(sim: Sim, reach = 20): Villager[] {
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  return sim.villagers.filter((v) => isFree(v) && v.down <= 0 && v.inside === null && v.phase !== 'sleep' && v.phase !== 'goHome' && Math.hypot(v.x - fx, v.y - fy) > reach);
}

/** A villager a house may take on: free hands first and, for the houses that move people around, anyone but soldiers and scouts. */
export const canTakeOn = (v: Villager): boolean => v.down <= 0 && v.inside === null && v.job !== 'fight' && v.job !== 'scout';

/**
 * The kind of house where a villager sleeps when it has a bed: the camp of a soldier's arm, the house of a trade (Xưởng gỗ, Chòi thợ săn…),
 * the Nhà thợ xây for a builder, and the Nhà dân for the free. Whoever finds no bed lies down by the campfire.
 */
export function homeKind(v: Who): BuildingKind {
  if (v.job === 'build') return 'builder';
  const role = roleOf(v);
  return role ? ROLES[role].building : 'house';
}
