import type { Sprites } from '../render/sprites';
import type { Session } from '../save/session';
import type { Sim } from '../sim/sim';
import type { Controller } from './controller';

/** What every panel needs: the simulation, the input controller, the sprites and a way to say something short. */
/** The sound settings the player can change: `on` (off = no sound at all, nothing computed for it) and `vol` (0 to 1) of each kind. */
export interface SoundPrefs { get(kind: 'sfx' | 'amb' | 'mus' | 'voice'): { on: boolean; vol: number }; set(kind: 'sfx' | 'amb' | 'mus' | 'voice', on: boolean, vol: number): void }

export interface Ctx { sim: Sim; ctl: Controller; sprites: Sprites; session: Session; toast: (text: string) => void; sound: SoundPrefs; weatherFx: { get(): boolean; set(on: boolean): void } }
