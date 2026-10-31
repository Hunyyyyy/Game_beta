import { World } from './world';

/** 0 = chưa biết, 1 = đã khám phá (nhớ), 2 = đang nhìn thấy */
export class Fog {
  readonly state: Uint8Array;
  version = 0;
  /** The tiles in sight right now, so that an update lowers only those instead of walking the whole map (a map of nearly a million tiles). */
  private lit: number[] = [];
  constructor(readonly world: World) {
    this.state = new Uint8Array(world.size * world.size);
  }

  /** Each source has its own sight radius `r` (tiles). */
  update(sources: ReadonlyArray<{ x: number; y: number; r: number }>): void {
    const N = this.world.size, s = this.state;
    for (const i of this.lit) if (s[i] === 2) s[i] = 1;
    const lit: number[] = [];
    for (const p of sources) {
      const cx = Math.floor(p.x), cy = Math.floor(p.y), radius = p.r, r2 = radius * radius + 0.5;
      for (let y = Math.max(0, cy - radius); y <= Math.min(N - 1, cy + radius); y++) {
        for (let x = Math.max(0, cx - radius); x <= Math.min(N - 1, cx + radius); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) { const i = y * N + x; if (s[i] !== 2) { s[i] = 2; lit.push(i); } }
        }
      }
    }
    this.lit = lit;
    this.version++;
  }

  /** After the state was put back from a save: find again which tiles are in sight. */
  relight(): void { this.lit = []; for (let i = 0; i < this.state.length; i++) if (this.state[i] === 2) this.lit.push(i); }

  countExplored(): number {
    let n = 0;
    for (let i = 0; i < this.state.length; i++) if (this.state[i] > 0) n++;
    return n;
  }
}
