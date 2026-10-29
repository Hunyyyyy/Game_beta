/** The arms of an army and what beats what (units.json). Pure rules: no game state in here. */
import unitsJson from '../data/units.json';
import { WEAPONS } from './combat';

import type { Objective } from './model';

export type Arm = 'foot' | 'archer' | 'cavalry';
/** What a plan can aim at, in words. */
export const OBJECTIVE_NAME: Record<Objective, string> = { camp: 'Đống lửa của họ', gate: 'Đường vào làng', ambush: 'Chỗ phục kích', stores: 'Kho lương', leader: 'Thủ lĩnh' };
export const ARMS: Arm[] = ['foot', 'archer', 'cavalry'];
export const ARM_NAME = unitsJson.arms as Record<Arm, string>;
export const BEATS = unitsJson.beats as Record<Arm, Record<Arm, number>>;
export const UNIT_RULES = unitsJson;

/** The arm a weapon makes of its bearer: ranged weapons are archers, the rest are foot soldiers. */
export const armOfWeapon = (weapon: string | null): Arm => (WEAPONS[weapon ?? 'fist']?.ranged ? 'archer' : 'foot');

/** Damage multiplier of one arm against another, with the spear's small bonus against riders. */
export function matchup(attacker: Arm, defender: Arm, weapon: string | null = null): number {
  return BEATS[attacker][defender] * (weapon === 'spear' && defender === 'cavalry' ? UNIT_RULES.spearVsCavalry : 1);
}

// ---------------------------------------------------------------- formations (trận pháp)
import formationsJson from '../data/formations.json';

export type FormationId = 'line' | 'circle' | 'wedge' | 'horns' | 'scatter' | 'ambush';
export interface FormationDef { name: string; tech: string; dmg: number; taken: number; speed: number; charge?: number; flank?: number; firstBlow?: number; takenRanged?: number; note: string }
export const FORMATION_IDS = Object.keys(formationsJson.formations) as FormationId[];
export const FORMATIONS = formationsJson.formations as unknown as Record<FormationId, FormationDef>;
export const COMMAND = formationsJson;
/** The fewest and the most soldiers one squad holds, which is also the fewest and the most cells a formation drawn on the map has. */
export const SQUAD_MIN: number = COMMAND.squadMin;
export const SQUAD_MAX: number = COMMAND.squadMax;

/** How well a formation is known, 0..100, as a multiplier on its effect: 0.8 untrained up to 1.15 expert. */
export const masteryFactor = (mastery: number): number => COMMAND.mastery.min + (COMMAND.mastery.max - COMMAND.mastery.min) * Math.max(0, Math.min(100, mastery)) / 100;

/** The most all the tactical factors multiplied together may come to (and the least, its inverse): a weak side can win, but not by magic. */
export const clampTactical = (x: number): number => Math.max(1 / COMMAND.cap, Math.min(COMMAND.cap, x));

/** Where each of n soldiers stands in a formation, relative to the squad's centre; +x is the way it faces, +y to the right. */
export function formationOffsets(kind: FormationId, n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    switch (kind) {
      case 'line': { const cols = Math.ceil(n / 2); out.push([-(i % 2) * 1.2, (Math.floor(i / 2) - (cols - 1) / 2) * 1.3]); break; }
      case 'wedge': { let r = 0, k = i; while (k > r) { k -= r + 1; r++; } out.push([-r * 1.1, (k - r / 2) * 1.4]); break; }
      case 'circle': { const R = Math.max(1.6, (n * 1.3) / (2 * Math.PI)); out.push([Math.cos((i / n) * 2 * Math.PI) * R, Math.sin((i / n) * 2 * Math.PI) * R]); break; }
      case 'horns': { const arm = i % 3, k = Math.floor(i / 3) + 1; out.push(arm === 0 ? [-1, ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.7)] : [k * 0.8, (arm === 1 ? -1 : 1) * (2 + k * 0.9)]); break; }
      case 'scatter': { const cols = Math.max(1, Math.ceil(Math.sqrt(n))); out.push([-Math.floor(i / cols) * 2.6, ((i % cols) - (cols - 1) / 2) * 2.6]); break; }
      default: { const cols = Math.max(1, Math.ceil(Math.sqrt(n))); out.push([-Math.floor(i / cols) * 1.5 + (i % 2) * 0.4, ((i % cols) - (cols - 1) / 2) * 1.6]); }
    }
  }
  return out;
}

/** Rotate a local offset by a heading (radians) and move it to a centre. */
export const placeOffset = (o: [number, number], heading: number, cx: number, cy: number): [number, number] =>
  [cx + o[0] * Math.cos(heading) - o[1] * Math.sin(heading), cy + o[0] * Math.sin(heading) + o[1] * Math.cos(heading)];

/** A formation drawn on the map: the cells (a tile each) where the soldiers stand, and the way they face. */
export interface Drawn { cells: Array<{ x: number; y: number }>; heading: number }

/**
 * The cells a drag from `o` to `p` makes for a formation, at most SQUAD_MAX of them, one `cell` apart. Fewer than SQUAD_MIN is a shape that cannot yet be a squad.
 * Hàng ngang: a row from o towards p. Vòng tròn: o is the middle and the drag is the radius. Mũi nhọn: o is the tip and the two arms run back towards p.
 * Sừng bò: a row from o to p with both ends bent to one fixed side of the drag (so the horns turn with it). Rải quân: a loose grid filling the box between o and p. Phục kích: a staggered double row from o towards p.
 * `toward` is the point the squad faces (the enemy camp), which decides which side of a row is its front.
 */
export function drawFormation(kind: FormationId, o: { x: number; y: number }, p: { x: number; y: number }, toward: { x: number; y: number }, max: number = SQUAD_MAX): Drawn {
  const S = COMMAND.cell, dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), ang = d > 0.01 ? Math.atan2(dy, dx) : 0, ux = Math.cos(ang), uy = Math.sin(ang);
  const clampN = (n: number) => Math.max(1, Math.min(max, n));
  const at = (along: number, side: number) => ({ x: o.x + ux * along - uy * side, y: o.y + uy * along + ux * side });
  // the perpendicular to the drag that points to `toward`: the way a row faces
  const sign = (-uy * (toward.x - o.x) + ux * (toward.y - o.y)) >= 0 ? 1 : -1, face = Math.atan2(ux * sign, -uy * sign);
  const cells: Drawn['cells'] = [];
  switch (kind) {
    case 'circle': {
      const R = d, n = clampN(Math.round((2 * Math.PI * R) / S));
      for (let i = 0; i < n; i++) cells.push({ x: o.x + Math.cos(ang + (2 * Math.PI * i) / n) * R, y: o.y + Math.sin(ang + (2 * Math.PI * i) / n) * R });
      return { cells, heading: Math.atan2(toward.y - o.y, toward.x - o.x) };
    }
    case 'wedge': {
      const half = 0.6, step = S * Math.cos(half), n = clampN(1 + 2 * Math.floor(d / step));
      cells.push({ x: o.x, y: o.y });
      for (let k = 1; cells.length < n; k++) { cells.push(at(k * step, -k * S * Math.sin(half))); if (cells.length < n) cells.push(at(k * step, k * S * Math.sin(half))); }
      return { cells, heading: ang + Math.PI }; // the tip leads: the squad faces away from the tail
    }
    case 'horns': {
      // the horns bend to the same side of the drag however it is turned (a quarter turn anticlockwise on the screen), so turning the drag turns the whole shape
      const n = clampN(Math.floor(d / S) + 1), bend = Math.min(3, d * 0.25), forward = ang - Math.PI / 2;
      for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1), c = at(d * t, 0), off = bend * (2 * t - 1) ** 2; cells.push({ x: c.x + Math.cos(forward) * off, y: c.y + Math.sin(forward) * off }); } // both ends forward
      return { cells, heading: forward };
    }
    case 'scatter': {
      let g = 2.6, w = Math.abs(dx), hh = Math.abs(dy), cols = 1, rows = 1;
      for (let guard = 0; guard < 40; guard++) { cols = Math.floor(w / g) + 1; rows = Math.floor(hh / g) + 1; if (cols * rows <= max) break; g *= 1.1; }
      const x0 = Math.min(o.x, p.x), y0 = Math.min(o.y, p.y), sx = cols > 1 ? w / (cols - 1) : g, sy = rows > 1 ? hh / (rows - 1) : g;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: x0 + c * Math.min(sx, g * 1.4), y: y0 + r * Math.min(sy, g * 1.4) });
      return { cells: cells.slice(0, max), heading: Math.atan2(toward.y - o.y, toward.x - o.x) };
    }
    case 'ambush': {
      const n = clampN(Math.floor(d / (S * 0.7)) + 1);
      for (let i = 0; i < n; i++) cells.push(at(S * 0.7 * i, i % 2 ? 0.6 : -0.6));
      return { cells, heading: face };
    }
    default: { // line
      const n = clampN(Math.floor(d / S) + 1);
      for (let i = 0; i < n; i++) cells.push(at(S * i, 0));
      return { cells, heading: face };
    }
  }
}

// ---------------------------------------------------------------- clusters (cụm)
export interface ClusterUnit { id: number; arm: Arm; key: string }
/** Group units into clusters of up to `size`, of one key (a side or a squad) and one arm, in a stable order (by id). */
export function clusterize(units: ClusterUnit[], size = COMMAND.clusterSize): Array<{ key: string; arm: Arm; ids: number[] }> {
  const groups = new Map<string, ClusterUnit[]>();
  for (const u of units) { const k = `${u.key}|${u.arm}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(u); }
  const out: Array<{ key: string; arm: Arm; ids: number[] }> = [];
  for (const g of [...groups.values()].sort((a, b) => (a[0].key + a[0].arm < b[0].key + b[0].arm ? -1 : 1))) {
    g.sort((a, b) => a.id - b.id);
    for (let i = 0; i < g.length; i += size) out.push({ key: g[0].key, arm: g[0].arm, ids: g.slice(i, i + size).map((u) => u.id) });
  }
  return out;
}

/** How many figures a cluster of n is drawn with in a big battle: one for about every `iconEvery` soldiers, at least one. */
export const iconCount = (n: number): number => Math.max(1, Math.ceil(n / COMMAND.iconEvery));
