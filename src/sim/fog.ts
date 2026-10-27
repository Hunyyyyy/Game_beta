import { World } from './world';

/** 0 = chưa biết, 1 = đã khám phá (nhớ), 2 = đang nhìn thấy */
export class Fog {
  readonly state: Uint8Array;
  version = 0;
  constructor(readonly world: World) {
    this.state = new Uint8Array(world.size * world.size);
  }

  /** Each source has its own sight radius `r` (tiles). */
  update(sources: ReadonlyArray<{ x: number; y: number; r: number }>): void {
    const N = this.world.size, s = this.state;
    for (let i = 0; i < s.length; i++) if (s[i] === 2) s[i] = 1;
    for (const p of sources) {
      const cx = Math.floor(p.x), cy = Math.floor(p.y), radius = p.r, r2 = radius * radius + 0.5;
      for (let y = Math.max(0, cy - radius); y <= Math.min(N - 1, cy + radius); y++) {
        for (let x = Math.max(0, cx - radius); x <= Math.min(N - 1, cx + radius); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) s[y * N + x] = 2;
        }
      }
    }
    this.version++;
  }

  countExplored(): number {
    let n = 0;
    for (let i = 0; i < this.state.length; i++) if (this.state[i] > 0) n++;
    return n;
  }
}
