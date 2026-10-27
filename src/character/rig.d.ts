export type View = 'front' | 'back' | 'right' | 'left';
export interface Look { sex: 'm' | 'f'; skin: string; hair: string; hide: string; pants: string }
/** `hit`: frame at which a blow lands or a missile leaves (one-shot attack animations). */
export interface AnimDef { fps: number; loop: boolean; hit?: number; frames: unknown[] }
export type AnimTable = Record<string, AnimDef>;
export const W: number;
export const H: number;
export const CX: number;
export function renderFrame(anims: AnimTable, name: string, idx: number, view: View, look: Look, carryKind?: string, tool?: { kind?: string; tier?: number }): Uint8ClampedArray;
export function defaultAnims(): AnimTable;
export function formatAnims(anims: AnimTable): string;
export const HAND_Y: number;
export const handTools: Record<string, unknown>;
export function renderTool(kind: string, tier: number, angleDeg: number, look?: Look, pose?: string): Uint8ClampedArray;
export function bakeTool(kind: string, angleDeg: number): [number, number, number, number, string][];
export function toolAnchor(): [number, number] | null;
export function unpackShapes(shapes: [number, number, number, number, string][]): [number, number, string][];
export function packPixels(list: [number, number, string][]): [number, number, number, number, string][];
