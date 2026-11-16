/**
 * Walkable walls (data/walls.json): the tops of the fences, gates and towers of level 6 and up are a second layer of ground for soldiers, ours and the enemy's. A unit is on a wall when he stands on a tile
 * of a top; nothing is stored on him. The ground search (path.ts) knows nothing of walls: this file plans the way up and down (to a stair, a ground tile next to a gate or a tower) and along the top, and
 * `movement.pathTo` asks it first whenever the start or the goal is on a top. Pure planning: the tops are worked out from `sim.buildings` and kept for a second.
 */
import type { Sim } from './sim';
import type { Step } from './path';
import type { Villager } from './model';
import { footOf } from './buildings';
import WALLS from '../data/walls.json';

/** The tops of the walls as they are now: their tiles, and the stairs (a top tile and the ground tile that leads up to it). */
export interface Tops { at: number; tiles: Set<number>; stairs: Array<{ top: number; ground: number }> }

const MIN = WALLS.minLevel as Record<string, number>;
const KINDS = new Set<string>(WALLS.kinds), STAIR_KINDS = new Set<string>(WALLS.stairKinds);
/** How high a soldier on a wall is drawn, in pixels. */
export const wallLift = (): number => WALLS.lift;
export const wallArcher = (): { damage: number; range: number } => WALLS.archer;

function build(sim: Sim): Tops {
  const N = sim.world.size, tiles = new Set<number>(), edge: Array<{ x: number; y: number }> = [];
  for (const b of sim.buildings) {
    if (!KINDS.has(b.kind) || !b.done || b.hp <= 0 || b.level < (MIN[b.kind] ?? MIN.default)) continue;
    const f = footOf(b);
    for (let y = b.y; y < b.y + f.h; y++) for (let x = b.x; x < b.x + f.w; x++) { tiles.add(y * N + x); if (STAIR_KINDS.has(b.kind)) edge.push({ x, y }); }
  }
  const stairs: Tops['stairs'] = [];
  for (const { x, y } of edge) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const gx = x + dx, gy = y + dy;
    if (!sim.world.inBounds(gx, gy) || tiles.has(gy * N + gx) || sim.world.isBlocked(gx, gy)) continue;
    stairs.push({ top: y * N + x, ground: gy * N + gx });
  }
  return { at: sim.time, tiles, stairs };
}

/** The tops now (made again when they are older than `refreshSeconds`). */
export function tops(sim: Sim): Tops {
  if (!sim.wallCache || sim.time - sim.wallCache.at >= WALLS.refreshSeconds || sim.time < sim.wallCache.at) sim.wallCache = build(sim);
  return sim.wallCache;
}
export const topAt = (sim: Sim, x: number, y: number): boolean => tops(sim).tiles.has(Math.floor(y) * sim.world.size + Math.floor(x));
export const onWall = (sim: Sim, v: Pick<Villager, 'x' | 'y'>): boolean => { const t = tops(sim); return t.tiles.size > 0 && t.tiles.has(Math.floor(v.y) * sim.world.size + Math.floor(v.x)); };

/** Breadth first over the tiles of the tops (four ways) from `from`: the steps to each tile, and the tile before it. */
function bfs(tiles: Set<number>, from: number, N: number): { dist: Map<number, number>; prev: Map<number, number> } {
  const dist = new Map<number, number>([[from, 0]]), prev = new Map<number, number>(), queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i], cx = c % N, cy = (c / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (cy + dy) * N + cx + dx;
      if (cx + dx < 0 || cx + dx >= N || !tiles.has(n) || dist.has(n)) continue;
      dist.set(n, dist.get(c)! + 1); prev.set(n, c); queue.push(n);
    }
  }
  return { dist, prev };
}
const stepsOf = (ids: number[], N: number): Step[] => ids.map((i) => [i % N, (i / N) | 0] as Step);
/** The tiles from `to` back to the root of a search, `to` first. */
function back(prev: Map<number, number>, to: number): number[] { const out = [to]; for (let n = prev.get(to); n !== undefined; n = prev.get(n)) out.push(n); return out; }

/**
 * The way for `v` to (gx, gy) when the start or the goal is on a top; null when neither is (the ground search does it) or there is no way up or down. `ground` finds a way on the ground.
 * Going up: the ground to the stair that makes the whole way shortest, one step up, then along the top. Going down: the way along the top to a stair, one step down, then the ground.
 */
export function wallPath(sim: Sim, v: Pick<Villager, 'x' | 'y'>, gx: number, gy: number, ground: (sx: number, sy: number, tx: number, ty: number) => Step[]): Step[] | null {
  const t = tops(sim), N = sim.world.size;
  if (!t.tiles.size) return null;
  const sx = Math.floor(v.x), sy = Math.floor(v.y), s = sy * N + sx, g = gy * N + gx, startTop = t.tiles.has(s), goalTop = t.tiles.has(g);
  if (!startTop && !goalTop) return null;
  if (startTop && goalTop) {
    const b = bfs(t.tiles, s, N);
    if (b.dist.has(g)) return stepsOf(back(b.prev, g).reverse().slice(1), N); // along the top
  }
  if (goalTop) { // up
    const b = bfs(t.tiles, g, N);
    let best: Tops['stairs'][number] | null = null, bc = Infinity;
    for (const st of t.stairs) { const d = b.dist.get(st.top); if (d === undefined) continue; const c = Math.hypot(sx - (st.ground % N), sy - ((st.ground / N) | 0)) + d; if (c < bc) { bc = c; best = st; } }
    if (!best) return null;
    const ex = best.ground % N, ey = (best.ground / N) | 0, low = ex === sx && ey === sy ? [] : ground(sx, sy, ex, ey), last = low[low.length - 1];
    if (low.length && (!last || last[0] !== ex || last[1] !== ey)) return null; // the foot of the stair cannot be reached
    const up = [best.top]; for (let n = b.prev.get(best.top); n !== undefined; n = b.prev.get(n)) up.push(n); // prev points back to the goal
    return [...low, ...stepsOf(up, N)];
  }
  // down: from a top to the ground
  const b = bfs(t.tiles, s, N);
  let best: Tops['stairs'][number] | null = null, bc = Infinity;
  for (const st of t.stairs) { const d = b.dist.get(st.top); if (d === undefined) continue; const c = d + Math.hypot((st.ground % N) - gx, ((st.ground / N) | 0) - gy); if (c < bc) { bc = c; best = st; } }
  if (!best) return null;
  const ex = best.ground % N, ey = (best.ground / N) | 0, along = stepsOf(back(b.prev, best.top).reverse().slice(1), N);
  return [...along, [ex, ey] as Step, ...(ex === gx && ey === gy ? [] : ground(ex, ey, gx, gy))];
}
