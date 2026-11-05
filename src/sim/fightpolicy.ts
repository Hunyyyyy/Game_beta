import policyJson from '../data/fightpolicy.json';
import type { Sim, Villager } from './sim';

/**
 * Where the two sides of a fight differ by a number: how far each looks, how far each chases, how near a danger must be before a civilian runs.
 * The mechanism is the same for both (battle.ts); the numbers are in data/fightpolicy.json, so a difference starts as a number here
 * and becomes a rule in brainplayer.ts or brainfoe.ts only when a number is not enough.
 */
export const POLICY = policyJson;
export const PLAYER = policyJson.player, FOE = policyJson.foe;

/** How far a unit sees the one it chases: our soldiers by their own sight (night, weather, a torch), the people of a village by a fixed look-out. */
export const chaseSight = (sim: Sim, v: Villager): number => (v.team === 'player' ? sim.sightOf(v) + PLAYER.chaseExtra : FOE.chaseSight);
