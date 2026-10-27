export type View = 'front' | 'back' | 'right' | 'left';
export interface Look { sex: 'm' | 'f'; skin: string; hair: string; hide: string; pants: string }
export interface AnimDef { fps: number; loop: boolean; frames: unknown[] }
export type AnimTable = Record<string, AnimDef>;
export const W: number;
export const H: number;
export const CX: number;
export function renderFrame(anims: AnimTable, name: string, idx: number, view: View, look: Look, carryKind?: string, tool?: { kind?: string; tier?: number }): Uint8ClampedArray;
export function defaultAnims(): AnimTable;
export function formatAnims(anims: AnimTable): string;
