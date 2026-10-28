import animalsJson from '../data/animals.json';
import tribesJson from '../data/tribes.json';
import weaponsJson from '../data/weapons.json';
import type { Stock } from './resources';

export type DmgType = 'pierce' | 'slash' | 'crush';

export interface WeaponDef {
  name: string;
  type: DmgType;
  range: number;
  damage: number;
  cycle: number;
  ranged?: boolean;
  /** Which set of fighting animations it uses: a key of `styles` in weapons.json (swing, thrust, shoot, sling, throw, fist). */
  style: string;
  /** Single animations this weapon plays instead of its style's. */
  anims?: Partial<Record<CombatState, string>>;
  /** What a ranged weapon fires. */
  projectile?: 'arrow' | 'stone';
  /** The attack animation, worked out from `style` and `anims` when the data is read; do not write it in weapons.json. */
  anim: string;
  cost?: Partial<Stock>;
  time?: number;
  tier?: number;
}
export interface ArmorDef extends Record<DmgType, number> {
  name: string;
  cost?: Partial<Stock>;
  time?: number;
  tier?: number;
}

/** What a fighter's body does while armed. Hands for work have their own animations; these are for people who carry a weapon. */
export type CombatState = 'idle' | 'walk' | 'guard' | 'charge' | 'attack';
export const COMBAT_STATES: readonly CombatState[] = ['idle', 'walk', 'guard', 'charge', 'attack'];
/** A family of weapons that move alike (every sword, club and mace swings; every spear thrusts), with one animation per state. */
export type CombatStyle = { name: string } & Record<CombatState, string>;
export const STYLES = weaponsJson.styles as unknown as Record<string, CombatStyle>;
export const WEAPONS = weaponsJson.weapons as unknown as Record<string, WeaponDef>;

/**
 * The animation a weapon uses in a state: its own override, else its style's, else bare fists.
 * `null` is a person with nothing in their hands.
 */
export function poseOf(weapon: string | null, state: CombatState): string {
  const w = weapon ? WEAPONS[weapon] : WEAPONS.fist;
  return w?.anims?.[state] ?? STYLES[w?.style ?? 'fist']?.[state] ?? STYLES.fist[state];
}
for (const id of Object.keys(WEAPONS)) WEAPONS[id].anim = poseOf(id, 'attack');
export const ARMORS = weaponsJson.armor as unknown as Record<string, ArmorDef>;
export const RULES = weaponsJson.rules;
/** Weapons the player can craft, best last (used to pick what a fighter equips). */
export const CRAFTED_WEAPONS = Object.keys(WEAPONS).filter((k) => WEAPONS[k].cost);

export interface AnimalDef {
  name: string;
  hp: number;
  damage: number;
  type: DmgType;
  cycle: number;
  range: number;
  speed: number;
  flee: number;
  aggro: number;
  meat: number;
  hide: number;
  zones: [number, number];
  herd: [number, number];
  count: number;
  prey: boolean;
  nocturnal: boolean;
  cornered?: boolean;
  defends?: boolean;
  fearsFire?: number;
  habitat?: 'water';
}
export type Species = 'rabbit' | 'fowl' | 'deer' | 'boar' | 'wolf' | 'fish';
export const SPECIES: Species[] = ['rabbit', 'fowl', 'deer', 'boar', 'wolf', 'fish'];
export const ANIMALS = Object.fromEntries(SPECIES.map((s) => [s, (animalsJson as unknown as Record<string, AnimalDef>)[s]])) as Record<Species, AnimalDef>;
export const BEHAVIOUR = animalsJson.behaviour;

export type Personality = 'peaceful' | 'aggressive' | 'ambusher';
export interface TribeDef {
  name: string;
  personality: Personality;
  angle: number;
  distance: number;
  civilians: number;
  warriors: number;
  weapons: string[];
  armor: boolean;
  look: { hide: string; pants: string };
  relation: number;
  reward: string;
  tribute: Partial<Stock>;
}
export type TribeId = 'spring' | 'axe' | 'swamp';
export const TRIBE_IDS: TribeId[] = ['spring', 'axe', 'swamp'];
export const TRIBES = Object.fromEntries(TRIBE_IDS.map((t) => [t, (tribesJson as unknown as Record<string, TribeDef>)[t]])) as Record<TribeId, TribeDef>;
export const RELATION = tribesJson.relation;
/** Below this relation a tribe is hostile (the start of the 'Trung lập' band). */
export const HOSTILE_BELOW = RELATION.labels[1][0] as number;
export const SURRENDER = tribesJson.surrender;
export const MORALE = tribesJson.morale;

/** Team of a unit: the player, a tribe, or wild animals. */
export type Team = 'player' | TribeId | 'wild';

/** Name of a relation score: "Thù địch" ... "Thu phục". */
export function relationLabel(score: number): string {
  let name = RELATION.labels[0][1] as string;
  for (const [from, label] of RELATION.labels) if (score >= (from as number)) name = label as string;
  return name;
}

/** Map ring (1..20) of a distance from the campfire; the map is 192 wide so a ring is 4.8 tiles. */
export const ringOf = (distance: number) => Math.max(1, Math.min(20, Math.ceil(distance / 4.8)));
/** Zone (1..4) of a distance from the campfire, 24 tiles each. */
export const zoneOf = (distance: number) => Math.max(1, Math.min(4, Math.ceil(distance / 24)));
/** Hit points and damage multiplier of tribal soldiers by the ring they live in: 0.8 at ring 1 up to ~1.9 at ring 20. */
export const ringPower = (ring: number) => 0.8 + 0.06 * (ring - 1);

/** Health of a villager from the Vitality stat. */
export const maxHpOf = (vit: number) => 40 + 8 * vit;
/** Seconds between two blows: weapon cycle times the agility factor. */
export const cycleOf = (weaponCycle: number, agi: number) => weaponCycle * (RULES.agilityBase - RULES.agilityStep * agi);

/** Damage of one blow after armour; `strength` adds to melee only. */
export function damageOf(w: { damage: number; type: DmgType; ranged?: boolean }, strength: number, armor: ArmorDef | null, backstab: boolean): number {
  const base = w.damage + (w.ranged ? 0 : RULES.strengthDamage * strength);
  return base * (1 - (armor ? armor[w.type] : 0)) * (backstab ? RULES.backstab : 1);
}
