export interface AnimalShape { [k: string]: number | string }
export interface AnimalDef { name: string; body: 'quadruped' | 'hopper' | 'biped' | 'fish'; size: [number, number]; palette: Record<string, string>; shape: AnimalShape }
export interface AnimalClip { fps: number; loop: boolean; hit?: number; frames: unknown[] }
export type AnimalClips = Record<string, AnimalClip>;
export function renderAnimal(def: AnimalDef, clip: AnimalClip, frameIdx: number): { w: number; h: number; data: Uint8ClampedArray };
