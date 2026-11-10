// Bundled by tools/art-preview.mjs for Node: draws sheets of soldiers (and mounts) with the same rig the game uses, no browser.
import { renderFrame } from '../../src/character/rig.js';
import { renderAnimal } from '../../src/character/animal-rig.js';
import anims from '../../src/data/anims.json';
import bodies from '../../src/data/animals/bodies.json';
import quad from '../../src/data/animals/anims/quadruped.json';
import horse from '../../src/data/animals/anims/horse.json';

export const FW = 68, FH = 66;
export const clips = { quadruped: quad, horse };
export { anims, bodies, quad, renderFrame, renderAnimal };
