/** How strong a village is: its economy plus its army, worked out from the stats of its people (src/content/difficulty.json "power"), not from the weapons in their hands. */
import cfg from '../content/difficulty.json';
import { BASE, statValue, workSpeed } from './statsys';
import type { Sim } from './sim';
import type { Villager } from './model';

export interface Power { economy: number; military: number; total: number; workers: number; soldiers: number }

const ratio = (sim: Sim, v: Villager, stat: 'hp' | 'atk' | 'defm' | 'defr'): number => statValue(sim, v, stat) / BASE[stat];
/** What a fighter is worth: his health, strength and defence against the plain person (2 times stronger in each = 8). Research shows here as its percent. */
export const militaryValue = (sim: Sim, v: Villager): number => ratio(sim, v, 'hp') * ratio(sim, v, 'atk') * (ratio(sim, v, 'defm') + ratio(sim, v, 'defr')) / 2;
/** What a worker is worth: how fast he works against the plain person. */
export const economyValue = (sim: Sim, v: Villager): number => workSpeed(sim, v) / BASE.work;

/** A person who fights counts as army, one who works counts as economy, one with nothing to do counts for neither. */
export type Kind = 'army' | 'work' | null;
export const kindOf = (v: Villager): Kind => {
  if (v.team === 'player') return v.job === 'fight' || v.job === 'scout' ? 'army' : v.job === 'idle' ? null : 'work';
  const role = v.ai?.role;
  return role === 'guard' || role === 'raider' ? 'army' : role === 'civ' ? 'work' : null;
};

/** The power of a set of people (a village: the player's, or the people of a tribe). */
export function powerOf(sim: Sim, people: readonly Villager[]): Power {
  let economy = 0, military = 0, workers = 0, soldiers = 0;
  for (const v of people) {
    const k = kindOf(v);
    if (k === 'army') { military += militaryValue(sim, v); soldiers++; } else if (k === 'work') { economy += economyValue(sim, v); workers++; }
  }
  return { economy, military, total: cfg.power.economy * economy + cfg.power.military * military, workers, soldiers };
}
