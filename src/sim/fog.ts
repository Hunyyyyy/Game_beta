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

  /** The tiles whose state changed since the screen last took them (see takeChanged), so that drawing the fog touches only those and not the whole map. */
  private changed: number[] = [];
  /** The whole map has to be drawn again (a game was loaded, the map was revealed). */
  private all = true;
  /** The map's fog changed in a way `changed` does not tell: draw it all again. */
  invalidate(): void { this.all = true; this.changed = []; this.version++; }
  /** For the drawing: null = redraw everything, else the tiles that changed since the last call. */
  takeChanged(): number[] | null {
    const c = this.changed; this.changed = [];
    if (this.all) { this.all = false; return null; }
    return c;
  }

  /** Each source has its own sight radius `r` (tiles). */
  update(sources: ReadonlyArray<{ x: number; y: number; r: number }>): void {
    const N = this.world.size, s = this.state, ch = this.changed, old = this.lit;
    for (const i of old) if (s[i] === 2) s[i] = 3; // 3: was in sight a moment ago; either put back to 2 below (no change) or lowered to 1
    const lit: number[] = [];
    for (const p of sources) {
      const cx = Math.floor(p.x), cy = Math.floor(p.y), radius = p.r, r2 = radius * radius + 0.5;
      for (let y = Math.max(0, cy - radius); y <= Math.min(N - 1, cy + radius); y++) {
        for (let x = Math.max(0, cx - radius); x <= Math.min(N - 1, cx + radius); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) { const i = y * N + x, was = s[i]; if (was !== 2) { s[i] = 2; lit.push(i); if (was !== 3) ch.push(i); } }
        }
      }
    }
    for (const i of old) if (s[i] === 3) { s[i] = 1; ch.push(i); }
    this.lit = lit;
    if (ch.length > 30000) { this.all = true; this.changed = []; } // a change this big (dusk, a new reach of sight) is cheaper drawn whole
    this.version++;
  }

  /** After the state was put back from a save: find again which tiles are in sight. */
  relight(): void { this.lit = []; for (let i = 0; i < this.state.length; i++) if (this.state[i] === 2) this.lit.push(i); this.all = true; this.changed = []; }

  countExplored(): number {
    let n = 0;
    for (let i = 0; i < this.state.length; i++) if (this.state[i] > 0) n++;
    return n;
  }
}
