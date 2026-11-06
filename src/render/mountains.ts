/**
 * Mountains drawn as one continuous heightfield instead of loose peak pictures: every corner of the tile grid gets a height that grows with how deep it lies in
 * the mountain, the ground between corners is blended smoothly, and each strip of terrain is drawn from front to back so that nearer ridges hide farther ones.
 * The slope is shaded from the north-west, the colour changes with height (soil, rock, bare rock, snow), and the crest of every ridge gets a dark line.
 * Presentation only: it reads the tiles of the world and keeps pictures of strips, a row of tiles by 8 tiles wide, made when they first come into view.
 */
import { hash2 } from '../sim/rng';
import { TILE } from '../sim/constants';
import { Tile } from '../sim/world';
import type { Sim } from '../sim/sim';

type World = Sim['world'];
const STRIP = 8;                        // tiles along a strip
const MARGIN = 74;                      // pixels above a strip's row that a high summit can reach
/** How high (px) a corner stands, by its distance in corners from the edge of the mountain. */
const HEIGHT = [0, 13, 29, 44, 56, 64, 70];
const SOIL = [[78, 64, 40], [104, 88, 54], [130, 112, 70]], ROCK = [[84, 72, 62], [120, 104, 88], [160, 142, 120]], HIGH = [[92, 92, 100], [132, 132, 140], [176, 176, 184]], SNOW = [[156, 172, 198], [214, 225, 240], [250, 252, 255]];
const CREST = [48, 38, 30], CREST_SNOW = [92, 108, 138];
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Smooth value noise in 0..1, one lattice point every `cell` pixels. */
const vnoise = (x: number, y: number, cell: number, seed: number) => {
  const u = x / cell, v = y / cell, i = Math.floor(u), j = Math.floor(v), fu = smooth(u - i), fv = smooth(v - j);
  const a = hash2(i, j, seed), b = hash2(i + 1, j, seed), c = hash2(i, j + 1, seed), d = hash2(i + 1, j + 1, seed);
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
};

export class Mountains {
  private readonly V: number;
  private readonly dist: Uint8Array;
  private readonly cache = new Map<string, HTMLCanvasElement | null>();

  constructor(private readonly world: World) {
    const N = world.size, V = this.V = N + 1, d = this.dist = new Uint8Array(V * V);
    const mtn = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && world.at(x, y) === Tile.Mountain;
    // a corner is inside the mountain when the four tiles round it are mountain; its distance from the rim is found in two sweeps
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) d[j * V + i] = mtn(i - 1, j - 1) && mtn(i, j - 1) && mtn(i - 1, j) && mtn(i, j) ? 250 : 0;
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) { const k = j * V + i; if (d[k]) d[k] = Math.min(d[k], (i ? d[k - 1] : 0) + 1, (j ? d[k - V] : 0) + 1); }
    for (let j = V - 1; j >= 0; j--) for (let i = V - 1; i >= 0; i--) { const k = j * V + i; if (d[k]) d[k] = Math.min(d[k], (i < V - 1 ? d[k + 1] : 0) + 1, (j < V - 1 ? d[k + V] : 0) + 1); }
  }

  private corner(i: number, j: number): number {
    const V = this.V; if (i < 0 || j < 0 || i >= V || j >= V) return 0;
    const d = this.dist[j * V + i]; if (!d) return 0;
    const base = HEIGHT[Math.min(d, HEIGHT.length - 1)], n1 = hash2(i, j, 51), n3 = hash2(i, j, 53);
    // slow noise over about three corners makes peaks and saddles; a little fast noise roughens the ridge
    const gi = i / 2.2, gj = j / 2.2, i0 = Math.floor(gi), j0 = Math.floor(gj), fi = smooth(gi - i0), fj = smooth(gj - j0);
    const l = hash2(i0, j0, 57) * (1 - fi) * (1 - fj) + hash2(i0 + 1, j0, 57) * fi * (1 - fj) + hash2(i0, j0 + 1, 57) * (1 - fi) * fj + hash2(i0 + 1, j0 + 1, 57) * fi * fj;
    let h = base * (0.28 + 1.3 * l * l) * (0.92 + 0.16 * n1);
    if (d >= 3 && n3 > 0.85) h += 10; // a summit stands out from the ridge
    return Math.min(74, Math.max(0, h));
  }

  /** The height (px) of the ground at a pixel of the world. */
  private z(x: number, y: number): number {
    const u = x / TILE, v = y / TILE, i = Math.floor(u), j = Math.floor(v), fu = smooth(u - i), fv = smooth(v - j);
    const a = this.corner(i, j), b = this.corner(i + 1, j), c = this.corner(i, j + 1), d = this.corner(i + 1, j + 1);
    let h = a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
    if (h > 0.5) h += (vnoise(x, y, 7, 54) - 0.5) * 4 * Math.min(1, h / 20); // small roughness, smooth so that no seams show in the shading
    return h;
  }

  /** The picture of one strip (a row of tiles, STRIP wide, starting at tile column `ci * STRIP`), or null when it holds no mountain. */
  strip(ci: number, j: number, snowLine: number): HTMLCanvasElement | null {
    const key = `${ci}|${j}|${snowLine}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const N = this.world.size, x0 = ci * STRIP * TILE, y0 = j * TILE, w = Math.min(STRIP * TILE, N * TILE - x0), h = TILE + MARGIN;
    const data = new Uint8ClampedArray(w * h * 4);
    let any = false;
    const put = (x: number, y: number, c: number[]) => { if (y < 0 || y >= h) return; const k = (y * w + x) * 4; data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255; any = true; };
    const color = (x: number, y: number, z: number, cliff: boolean): number[] => {
      const gx = (this.z(x + 1, y) - this.z(x - 1, y)) / 2, gy = (this.z(x, y + 1) - this.z(x, y - 1)) / 2, steep = Math.hypot(gx, gy);
      const len = Math.hypot(gx, gy, 1), s = (gx * 0.55 + gy * 0.6 + 0.58) / len;
      const zz = z + (vnoise(x, y, 5, 55) - 0.5) * 6;
      const pal = zz < 9 ? SOIL : zz < 32 ? ROCK : zz < snowLine || steep > 1.15 ? HIGH : SNOW;
      let lvl = s > 0.74 ? 2 : s > 0.52 ? 1 : 0;
      if (cliff && lvl > 0) lvl--;                                     // a steep face is a shade darker
      return pal[lvl];
    };
    for (let xx = 0; xx < w; xx++) {
      const x = x0 + xx; let top = Infinity;
      for (let y = y0 + TILE - 1; y >= y0; y--) {
        const z = this.z(x, y);
        if (z < 2 && top === Infinity) continue;                       // flat ground: the tile's own picture shows
        const cy = Math.round(y - z) - y0 + MARGIN, ground = y - y0 + MARGIN;
        if (cy >= top) continue;                                          // hidden behind a nearer ridge
        const from = top === Infinity ? ground : top - 1;
        for (let r = cy; r <= from; r++) put(xx, r, color(x, y, z, from - cy > 3));
        top = cy;
        // the crest: when the ground behind this point cannot be seen, this is the edge of the ridge
        const zn = this.z(x, y - 1), cn = Math.round(y - 1 - zn) - y0 + MARGIN;
        if (cn >= cy) put(xx, cy, z >= snowLine ? CREST_SNOW : CREST);
      }
    }
    let out: HTMLCanvasElement | null = null;
    if (any) { out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0); }
    this.cache.set(key, out);
    return out;
  }
}

/** Where a strip's picture goes: the world pixel of its top-left corner. */
export const stripOrigin = (ci: number, j: number): [number, number] => [ci * STRIP * TILE, j * TILE - MARGIN];
export const STRIP_TILES = STRIP;
