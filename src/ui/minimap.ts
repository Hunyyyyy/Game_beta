import type { Camera, Renderer } from '../render/renderer';
import { TILE } from '../sim/constants';
import type { Sim } from '../sim/sim';
import { Tile } from '../sim/world';
import type { Controller } from './controller';

export const TERRAIN: Record<number, [number, number, number]> = {
  [Tile.Grass]: [134, 163, 85], [Tile.Water]: [63, 111, 154], [Tile.Tree]: [47, 82, 34],
  [Tile.Rock]: [120, 125, 128], [Tile.Mud]: [122, 100, 66], [Tile.Bush]: [150, 70, 60],
};

/** The small corner map, and the big map it opens when pressed. */
export class MapView {
  private readonly base = document.createElement('canvas');
  private readonly bctx: CanvasRenderingContext2D;
  private readonly N: number;
  private ver = -1; private builds = -1;
  private frame = 0;

  constructor(private readonly sim: Sim, private readonly cam: Camera, private readonly r: Renderer, private readonly ctl: Controller,
    private readonly mini: HTMLCanvasElement, private readonly big: HTMLCanvasElement, private readonly overlay: HTMLElement) {
    this.N = sim.world.size;
    this.base.width = this.base.height = mini.width = mini.height = big.width = big.height = this.N;
    this.bctx = this.base.getContext('2d')!;
    mini.addEventListener('click', () => this.open());
    big.addEventListener('click', (e) => {
      const b = big.getBoundingClientRect();
      ctl.centerOn(((e.clientX - b.left) / b.width) * this.N * TILE, ((e.clientY - b.top) / b.height) * this.N * TILE);
      this.close();
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });
  }

  get isOpen(): boolean { return !this.overlay.hidden; }
  open(): void { this.overlay.hidden = false; }
  close(): void { this.overlay.hidden = true; }

  private redrawBase(): void {
    const { sim, N } = this;
    if (sim.fog.version === this.ver && sim.buildings.length === this.builds) return;
    this.ver = sim.fog.version; this.builds = sim.buildings.length;
    const img = this.bctx.createImageData(N, N), s = sim.fog.state;
    for (let i = 0; i < N * N; i++) {
      const c = sim.world.occ[i] ? [200, 150, 80] : TERRAIN[sim.world.tiles[i]], k = s[i] === 2 ? 1 : s[i] === 1 ? 0.55 : 0;
      img.data[i * 4] = c[0] * k + 8 * (1 - k); img.data[i * 4 + 1] = c[1] * k + 10 * (1 - k); img.data[i * 4 + 2] = c[2] * k + 20 * (1 - k); img.data[i * 4 + 3] = 255;
    }
    this.bctx.putImageData(img, 0, 0);
  }

  private paint(ctx: CanvasRenderingContext2D, dot: number): void {
    const { sim, N } = this, seen = (x: number, y: number) => sim.fog.state[Math.floor(y) * N + Math.floor(x)] === 2;
    ctx.drawImage(this.base, 0, 0);
    for (const t of sim.tribes) {
      if (t.state === 'adopted' || sim.fog.state[Math.floor(t.camp.y) * N + Math.floor(t.camp.x)] === 0) continue;
      ctx.fillStyle = t.state === 'destroyed' ? '#555' : t.state === 'free' ? (sim.tribeHostile(t.id) ? '#e0452a' : '#e0a22a') : '#6fc06f';
      ctx.fillRect(t.camp.x - dot, t.camp.y - dot, dot * 2, dot * 2);
    }
    ctx.fillStyle = '#ffffff';
    for (const v of sim.villagers) if (v.inside === null) ctx.fillRect(v.x - dot / 2, v.y - dot / 2, dot, dot);
    ctx.fillStyle = '#ff5a4a';
    for (const f of sim.foes) if (seen(f.x, f.y)) ctx.fillRect(f.x - dot / 2, f.y - dot / 2, dot, dot);
    for (const a of sim.animals) if (a.state !== 'dead' && seen(a.x, a.y)) { ctx.fillStyle = a.species === 'wolf' ? '#ff5a4a' : '#e8d4a8'; ctx.fillRect(a.x - dot / 3, a.y - dot / 3, dot * 0.7, dot * 0.7); }
    const z = this.cam.zoom, x = this.cam.x / TILE, y = this.cam.y / TILE, w = this.r.w / z / TILE, h = this.r.h / z / TILE;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, dot / 2); ctx.strokeRect(x, y, w, h);
  }

  draw(): void {
    this.frame++;
    if (this.isOpen) { this.redrawBase(); this.paint(this.big.getContext('2d')!, 2.2); return; }
    if (this.frame % 3) return; // the small map does not need every frame
    this.redrawBase(); this.paint(this.mini.getContext('2d')!, 3);
  }
}
