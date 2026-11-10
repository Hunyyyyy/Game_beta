export interface AnimalShape { [k: string]: number | string }
export interface AnimalDef { name: string; body: 'quadruped' | 'horse' | 'hopper' | 'biped' | 'fish'; size: [number, number]; palette: Record<string, string>; shape: AnimalShape; /** Drawn from the front and from behind too (the horse): the size of each. */ views?: { front: { size: [number, number] }; back: { size: [number, number] } }; /** The harness of a beast that is ridden: hex colours (saddle, blanket, chest, stud, bridle, plate...). */ gear?: Record<string, string> }
export interface AnimalClip { fps: number; loop: boolean; hit?: number; frames: unknown[] }
export type AnimalClips = Record<string, AnimalClip>;
/** `view` 'front' or 'back' draws a species that has `views`; `over` is then the part that goes over the rider. */
export function renderAnimal(def: AnimalDef, clip: AnimalClip, frameIdx: number, view?: 'front' | 'back'): { w: number; h: number; data: Uint8ClampedArray; over?: Uint8ClampedArray };
