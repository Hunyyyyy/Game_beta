/** The named characters of the story and the side quests (data/characters, written by tools/gen-characters.mjs): a preset of the villager rig each (data layer, no Sim). */
import firekeeper from '../data/characters/firekeeper.json';
import oldMaster from '../data/characters/old_master.json';
import merchant from '../data/characters/merchant.json';
import envoy from '../data/characters/envoy.json';
import sleuth from '../data/characters/sleuth.json';
import assassin from '../data/characters/assassin.json';
import mole from '../data/characters/mole.json';
import bossChief from '../data/characters/boss_chief.json';
import general from '../data/characters/general.json';
import bodyguard from '../data/characters/bodyguard.json';
import elder from '../data/characters/elder.json';
import monk from '../data/characters/monk.json';
import apprentice from '../data/characters/apprentice.json';
import smith from '../data/characters/smith.json';
import type { Look } from './model';

/** What a character wears in one age: the armour of the rig (null: his own clothes), the weapon he fights with if struck (null: none), the tool in his hand in a picture. */
export interface CharacterSuit { armor: string | null; weapon: string | null; handtool: { kind: string; tier: number } | null }
export interface CharacterDef { id: string; /** His title, said before his own name ("Thương lái Mun"). */ name: string; role: string; look: Look; stone: CharacterSuit; ancient: CharacterSuit; shape: string }

export const CHARACTERS = [firekeeper, oldMaster, merchant, envoy, sleuth, assassin, mole, bossChief, general, bodyguard, elder, monk, apprentice, smith] as unknown as CharacterDef[];
export const characterOf = (id: string | undefined): CharacterDef | undefined => (id ? CHARACTERS.find((c) => c.id === id) : undefined);
/** The suit of a character in an age (`ancient` is the medieval age). */
export const suitOf = (c: CharacterDef, era: string): CharacterSuit => (era === 'ancient' ? c.ancient : c.stone);
