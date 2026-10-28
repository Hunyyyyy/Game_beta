import type { Sprites } from '../render/sprites';
import type { Session } from '../save/session';
import type { Sim } from '../sim/sim';
import type { Controller } from './controller';

/** What every panel needs: the simulation, the input controller, the sprites and a way to say something short. */
export interface Ctx { sim: Sim; ctl: Controller; sprites: Sprites; session: Session; toast: (text: string) => void }
