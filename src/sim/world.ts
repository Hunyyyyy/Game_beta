import type { Season } from './calendar';
import { MAP_SIZE } from './constants';
import type { NodeKind } from './jobs';
import type { Res } from './resources';
import { fbm, hash2, mulberry32 } from './rng';

export const Tile = { Grass: 0, Water: 1, Tree: 2, Rock: 3, Mud: 4, Bush: 5 } as const;
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

export class World {
  readonly size = MAP_SIZE;
  readonly tiles = new Uint8Array(MAP_SIZE * MAP_SIZE);
  readonly occ = new Uint8Array(MAP_SIZE * MAP_SIZE);   // ô bị công trình chiếm
  readonly decor = new Uint8Array(MAP_SIZE * MAP_SIZE); // 1 = gốc cây
  readonly nodes = new Map<number, ResourceNode>();
  readonly start = { x: MAP_SIZE >> 1, y: MAP_SIZE >> 1 };
  season: Season = 'spring';

  constructor(readonly seed: number) {
    const N = this.size;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d = Math.hypot(x - this.start.x, y - this.start.y);
        const elev = fbm(x / 26, y / 26, seed);
        const forest = fbm(x / 10, y / 10, seed + 7);
        let t: TileId = Tile.Grass;
        if (elev < 0.34 && d > 14) t = Tile.Water;
        else if (d > 6 && forest > 0.58 && hash2(x, y, seed + 3) < 0.5) t = Tile.Tree;
        else if (d > 5 && hash2(x, y, seed + 9) < 0.012) t = Tile.Rock;
        else if (d > 4 && hash2(x, y, seed + 13) < 0.012) t = Tile.Bush;
        else if (d > 8 && hash2(x, y, seed + 5) < 0.01) t = Tile.Tree;
        this.tiles[y * N + x] = t;
      }
    }
    // bùn ven nước
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (this.tiles[y * N + x] !== Tile.Grass) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && this.tiles[ny * N + nx] === Tile.Water) { near = true; break; }
      }
      if (near && hash2(x, y, seed + 17) < 0.8) this.tiles[y * N + x] = Tile.Mud;
    }
    this.ensureNearStart('tree', 12, 6, 17, seed + 101);
    this.ensureNearStart('rock', 5, 6, 15, seed + 102);
    this.ensureNearStart('bush', 8, 5, 14, seed + 103);
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      const kind: NodeKind | null = t === Tile.Tree ? 'tree' : t === Tile.Rock ? 'rock' : t === Tile.Bush ? 'bush' : null;
      if (kind) this.nodes.set(i, { kind, res: NODE_INFO[kind].res, amount: NODE_INFO[kind].max, max: NODE_INFO[kind].max, workers: 0, sides: 0, regrow: 0 });
    }
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
    return (t !== Tile.Grass && t !== Tile.Mud) || this.occ[i] !== 0;
  }
  nodeAt(x: number, y: number): ResourceNode | undefined {
    return this.inBounds(x, y) ? this.nodes.get(y * this.size + x) : undefined;
  }

  /** Cây và đá cạn thì ô trở lại thành cỏ (cây để lại gốc); bụi quả giữ nguyên và mọc lại. */
  depleted(idx: number): void {
    const n = this.nodes.get(idx);
    if (!n) return;
    if (n.kind === 'bush') { n.amount = 0; n.regrow = 240; return; }
    this.nodes.delete(idx);
    this.tiles[idx] = Tile.Grass;
    if (n.kind === 'tree') this.decor[idx] = 1;
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

  tick(dt: number): void {
    if (this.season === 'winter') return;
    for (const n of this.nodes.values()) {
      if (n.kind === 'bush' && n.amount === 0 && n.regrow > 0) {
        n.regrow -= dt;
        if (n.regrow <= 0) { n.amount = n.max; n.regrow = 0; }
      }
    }
  }
}
