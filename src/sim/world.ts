import type { Season } from './calendar';
import { MAP_SIZE } from './constants';
import type { NodeKind } from './jobs';
import type { Res } from './resources';
import { fbm, hash2, mix32, mulberry32 } from './rng';

/** The village never starts nearer than this to the edge of the map (tiles). */
const START_MARGIN = 110;

export const Tile = { Grass: 0, Water: 1, Tree: 2, Rock: 3, Mud: 4, Bush: 5, Mountain: 6 } as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

export interface ResourceNode {
  kind: NodeKind;
  res: Res;
  amount: number;
  max: number;
  workers: number;
  /** Hai chỗ đứng hai bên vật thể: bit 1 = bên trái, bit 2 = bên phải. */
  sides: number;
  regrow: number; // giây còn lại đến khi mọc lại (chỉ bụi quả)
}

const NODE_INFO: Record<NodeKind, { res: Res; max: number }> = {
  tree: { res: 'wood', max: 10 },
  rock: { res: 'stone', max: 14 },
  bush: { res: 'food', max: 6 },
};
const TILE_OF: Record<NodeKind, TileId> = { tree: Tile.Tree, rock: Tile.Rock, bush: Tile.Bush };

/** The world is made a chunk at a time: a chunk is this many tiles on a side. */
export const CHUNK = 32;
/** Chunks on a side of the whole map. */
export const CHUNKS = MAP_SIZE / CHUNK;
/** The land made when the game starts: this many tiles each way round the village (200 across). */
const FIRST_REACH = 100;

/**
 * The land is in regions, from the noise: plains (most of it, a tree here and there), sparse forest, dense forest and mountains, with lakes in the
 * low places. The amounts are low on purpose: a forest that is everywhere, or too many lakes and mountains, wall the villagers in and slow every path.
 */
const WATER_BELOW = 0.3;
/** Wood noise above these makes sparse forest, then dense forest. */
const SPARSE_ABOVE = 0.6, DENSE_ABOVE = 0.7;
/** Chance of a tree on a tile of each region. */
const TREE_PLAINS = 0.003, TREE_SPARSE = 0.1, TREE_DENSE = 0.42;
/** Relief noise above this raises a mountain; rocks gather at its foot (above FOOT). */
const MOUNTAIN_ABOVE = 0.72, FOOT_ABOVE = 0.64;
const ROCK_PLAINS = 0.003, ROCK_FOOT = 0.03, BUSH_PLAINS = 0.005, BUSH_SPARSE = 0.012;
/** Nothing but plains this close to the village: forests start beyond FOREST_FROM, mountains beyond MOUNTAIN_FROM. */
const FOREST_FROM = 14, MOUNTAIN_FROM = 34;

export class World {
  readonly size = MAP_SIZE;
  readonly tiles = new Uint8Array(MAP_SIZE * MAP_SIZE);
  readonly occ = new Uint8Array(MAP_SIZE * MAP_SIZE);   // ô bị công trình chiếm
  readonly decor = new Uint8Array(MAP_SIZE * MAP_SIZE); // 1 = gốc cây
  readonly nodes = new Map<number, ResourceNode>();
  /** 1 for each chunk that has been made. What lies in a chunk that has not been made is not known yet: nobody can walk there or build there. */
  readonly ready = new Uint8Array(CHUNKS * CHUNKS);
  /** Called after a chunk has been made, so that whoever keeps the herds can fill it. */
  onChunk?: (cx: number, cy: number) => void;
  /** Where the village begins: a different spot of dry land in every world, well away from the edges. */
  readonly start: { x: number; y: number };
  season: Season = 'spring';
  private respawns = 0; // how many used-up nodes have been replaced, so each pick of a new place differs

  constructor(readonly seed: number) {
    this.start = World.pickStart(seed);
    // the land round the village first (200 across), tiles only so that the guaranteed resources can still be set among them, then the things that stand on it
    const lo = (v: number) => Math.max(0, Math.floor((v - FIRST_REACH) / CHUNK)), hi = (v: number) => Math.min(CHUNKS - 1, Math.floor((v + FIRST_REACH) / CHUNK));
    const first: Array<[number, number]> = [];
    for (let cy = lo(this.start.y); cy <= hi(this.start.y); cy++) for (let cx = lo(this.start.x); cx <= hi(this.start.x); cx++) { this.makeTiles(cx, cy); first.push([cx, cy]); }
    this.ensureNearStart('tree', 12, 6, 17, seed + 101);
    this.ensureNearStart('rock', 5, 6, 15, seed + 102);
    this.ensureNearStart('bush', 8, 5, 14, seed + 103);
    for (const [cx, cy] of first) this.makeNodes(cx, cy);
  }

  /** The chunks made so far. */
  readyChunks(): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < this.ready.length; i++) if (this.ready[i]) out.push([i % CHUNKS, (i / CHUNKS) | 0]);
    return out;
  }
  /** Has the land at this tile been made? */
  isReady(x: number, y: number): boolean { return this.inBounds(x, y) && this.ready[(y >> 5) * CHUNKS + (x >> 5)] === 1; }

  /**
   * Make the land within `reach` tiles of a point if it does not exist yet. This is the whole of "the world grows as the village explores": the
   * game calls it round every villager, a chunk is made once, and the same world comes out whatever order the chunks are made in.
   */
  ensure(x: number, y: number, reach: number): void {
    const x0 = Math.max(0, Math.floor((x - reach) / CHUNK)), x1 = Math.min(CHUNKS - 1, Math.floor((x + reach) / CHUNK));
    const y0 = Math.max(0, Math.floor((y - reach) / CHUNK)), y1 = Math.min(CHUNKS - 1, Math.floor((y + reach) / CHUNK));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (this.ready[cy * CHUNKS + cx]) continue;
      this.makeTiles(cx, cy); this.makeNodes(cx, cy);
      this.onChunk?.(cx, cy);
    }
  }

  /** Is it water, going by the noise alone? Pure, so that the shore of one chunk can look into the next, which may not exist yet. */
  private waterAt(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return Math.hypot(x - this.start.x, y - this.start.y) > 14 && fbm(x / 26, y / 26, this.seed) < WATER_BELOW;
  }

  /** The region of the land a tile lies in, by the same noise that shaped it (the name shown at the top of the screen when the camera moves over it). */
  regionAt(x: number, y: number): 'water' | 'mountain' | 'dense' | 'sparse' | 'plains' {
    const d = Math.hypot(x - this.start.x, y - this.start.y);
    if (this.waterAt(x, y)) return 'water';
    if (d > MOUNTAIN_FROM && fbm(x / 40, y / 40, this.seed + 301) > MOUNTAIN_ABOVE) return 'mountain';
    const wood = d > 8 ? fbm(x / 22, y / 22, this.seed + 7) : 0;
    if (d > FOREST_FROM && wood > DENSE_ABOVE) return 'dense';
    return d > FOREST_FROM && wood > SPARSE_ABOVE ? 'sparse' : 'plains';
  }

  /** The ground of one chunk: water, forest, stones, bushes, mud on the shores. */
  private makeTiles(cx: number, cy: number): void {
    const N = this.size, seed = this.seed, x0 = cx * CHUNK, y0 = cy * CHUNK;
    for (let y = y0; y < y0 + CHUNK; y++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        const d = Math.hypot(x - this.start.x, y - this.start.y);
        let t: TileId = Tile.Grass;
        const relief = d > MOUNTAIN_FROM - 12 ? fbm(x / 40, y / 40, seed + 301) : 0;
        const wood = d > 8 ? fbm(x / 22, y / 22, seed + 7) : 0;
        if (this.waterAt(x, y)) t = Tile.Water;
        else if (d > MOUNTAIN_FROM && relief > MOUNTAIN_ABOVE) t = Tile.Mountain;
        else if (d > FOREST_FROM && wood > DENSE_ABOVE && hash2(x, y, seed + 3) < TREE_DENSE) t = Tile.Tree;
        else if (d > FOREST_FROM && wood > SPARSE_ABOVE && hash2(x, y, seed + 3) < TREE_SPARSE) t = Tile.Tree;
        else if (d > 5 && hash2(x, y, seed + 9) < (relief > FOOT_ABOVE ? ROCK_FOOT : ROCK_PLAINS)) t = Tile.Rock;
        else if (d > 4 && hash2(x, y, seed + 13) < (wood > SPARSE_ABOVE ? BUSH_SPARSE : BUSH_PLAINS)) t = Tile.Bush;
        else if (d > 8 && hash2(x, y, seed + 5) < TREE_PLAINS) t = Tile.Tree;
        this.tiles[y * N + x] = t;
      }
    }
    // mud along the shores
    for (let y = y0; y < y0 + CHUNK; y++) for (let x = x0; x < x0 + CHUNK; x++) {
      if (this.tiles[y * N + x] !== Tile.Grass) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (this.waterAt(x + dx, y + dy)) { near = true; break; }
      if (near && hash2(x, y, seed + 17) < 0.8) this.tiles[y * N + x] = Tile.Mud;
    }
    this.ready[cy * CHUNKS + cx] = 1;
  }

  /** The trees, rocks and bushes standing on the ground of one chunk. */
  private makeNodes(cx: number, cy: number): void {
    const N = this.size, x0 = cx * CHUNK, y0 = cy * CHUNK;
    for (let y = y0; y < y0 + CHUNK; y++) for (let x = x0; x < x0 + CHUNK; x++) {
      const i = y * N + x, t = this.tiles[i];
      const kind: NodeKind | null = t === Tile.Tree ? 'tree' : t === Tile.Rock ? 'rock' : t === Tile.Bush ? 'bush' : null;
      if (kind) this.nodes.set(i, { kind, res: NODE_INFO[kind].res, amount: NODE_INFO[kind].max, max: NODE_INFO[kind].max, workers: 0, sides: 0, regrow: 0 });
    }
  }

  /** A random dry spot (open ground for 20 tiles round it) at least START_MARGIN from every edge, so the tribes and the herds have room on all sides. */
  private static pickStart(seed: number): { x: number; y: number } {
    const N = MAP_SIZE, rnd = mulberry32(mix32(seed ^ 0x51ed270b)), span = N - 2 * START_MARGIN;
    let best = { x: N >> 1, y: N >> 1 }, bestScore = -1;
    for (let t = 0; t < 400; t++) {
      const x = START_MARGIN + Math.floor(rnd() * span), y = START_MARGIN + Math.floor(rnd() * span);
      let score = 0;
      for (let k = 0; k < 8; k++) score += fbm((x + Math.cos(k * 0.785) * 20) / 26, (y + Math.sin(k * 0.785) * 20) / 26, seed) > WATER_BELOW + 0.08 ? 1 : 0;
      if (score === 8 && fbm(x / 26, y / 26, seed) > WATER_BELOW + 0.08) return { x, y };
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return best;
  }

  /** Bảo đảm có tối thiểu `count` nguồn loại `kind` quanh điểm khởi đầu. */
  private ensureNearStart(kind: NodeKind, count: number, rMin: number, rMax: number, seed: number): void {
    const N = this.size, tile = TILE_OF[kind], rnd = mulberry32(seed);
    let have = 0;
    for (let y = this.start.y - rMax; y <= this.start.y + rMax; y++) for (let x = this.start.x - rMax; x <= this.start.x + rMax; x++) {
      const d = Math.hypot(x - this.start.x, y - this.start.y);
      if (d >= rMin && d <= rMax && this.tiles[y * N + x] === tile) have++;
    }
    for (let tries = 0; have < count && tries < 600; tries++) {
      const a = rnd() * Math.PI * 2, r = rMin + rnd() * (rMax - rMin);
      const x = Math.round(this.start.x + Math.cos(a) * r), y = Math.round(this.start.y + Math.sin(a) * r);
      if (this.tiles[y * N + x] === Tile.Grass) { this.tiles[y * N + x] = tile; have++; }
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }
  at(x: number, y: number): TileId {
    return this.tiles[y * this.size + x] as TileId;
  }
  isBlocked(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    const i = y * this.size + x, t = this.tiles[i];
    return this.ready[(y >> 5) * CHUNKS + (x >> 5)] === 0 || (t !== Tile.Grass && t !== Tile.Mud) || this.occ[i] !== 0; // land that has not been made yet cannot be walked on
  }
  nodeAt(x: number, y: number): ResourceNode | undefined {
    return this.inBounds(x, y) ? this.nodes.get(y * this.size + x) : undefined;
  }

  /**
   * A tree, rock or bush that is used up is gone and its tile turns back to grass; one of the same kind appears on another free grass tile
   * a few steps away (never in the starting ring, never under somebody's feet, and where `free` allows), so the land is neither emptied nor reset in place.
   */
  depleted(idx: number, free?: (x: number, y: number) => boolean): void {
    const n = this.nodes.get(idx);
    if (!n) return;
    this.nodes.delete(idx);
    this.tiles[idx] = Tile.Grass;
    const N = this.size, fx = idx % N, fy = (idx / N) | 0, salt = this.respawns++;
    for (let t = 0; t < 40; t++) {
      const ang = hash2(idx, salt * 40 + t, this.seed + 41) * Math.PI * 2, r = 4 + hash2(idx, salt * 40 + t, this.seed + 43) * 7;
      const x = Math.round(fx + Math.cos(ang) * r), y = Math.round(fy + Math.sin(ang) * r), j = y * N + x;
      if (!this.isReady(x, y) || this.tiles[j] !== Tile.Grass || this.occ[j] !== 0 || this.nodes.has(j)) continue;
      if (Math.hypot(x - this.start.x, y - this.start.y) < 7 || (free && !free(x, y))) continue;
      this.tiles[j] = TILE_OF[n.kind];
      this.nodes.set(j, { kind: n.kind, res: n.res, amount: this.season === 'winter' && n.kind === 'bush' ? 0 : n.max, max: n.max, workers: 0, sides: 0, regrow: 0 });
      return;
    }
  }

  /** Winter: bushes go bare and stop regrowing. Spring: they flower and fruit again after 1–3 min (staggered per tile). */
  setSeason(season: Season): void {
    const prev = this.season;
    this.season = season;
    if (season === prev) return;
    for (const [idx, n] of this.nodes) {
      if (n.kind !== 'bush') continue;
      if (season === 'winter') { n.amount = 0; n.regrow = 0; }
      else if (prev === 'winter') { n.amount = 0; n.regrow = 60 + 120 * hash2(idx % this.size, (idx / this.size) | 0, this.seed + 29); }
    }
  }

  private grown = 0;
  /** Bushes fruit again; the map holds well over a hundred thousand things, so this runs once a second rather than every tick. */
  tick(dt: number): void {
    this.grown += dt;
    if (this.grown < 1) return;
    dt = this.grown; this.grown = 0;
    if (this.season === 'winter') return;
    for (const n of this.nodes.values()) {
      if (n.kind === 'bush' && n.amount === 0 && n.regrow > 0) {
        n.regrow -= dt;
        if (n.regrow <= 0) { n.amount = n.max; n.regrow = 0; }
      }
    }
  }
}
