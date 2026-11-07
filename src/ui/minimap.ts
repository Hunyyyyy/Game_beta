import type { Camera, Renderer } from '../render/renderer';
import { TILE } from '../sim/constants';
import type { Sim } from '../sim/sim';
import { Tile } from '../sim/world';
import type { Controller } from './controller';

export const TERRAIN: Record<number, [number, number, number]> = {
  [Tile.Grass]: [134, 163, 85], [Tile.Water]: [63, 111, 154], [Tile.Tree]: [47, 82, 34],
  [Tile.Rock]: [120, 125, 128], [Tile.Mountain]: [104, 98, 92], [Tile.Mud]: [122, 100, 66], [Tile.Bush]: [150, 70, 60],
};

const BUILT: [number, number, number] = [200, 150, 80];

/** The small corner map, and the big map it opens when pressed. */
export class MapView {
  private readonly base = document.createElement('canvas');
  private readonly bctx: CanvasRenderingContext2D;
  private readonly N: number;
  private ver = -1; private builds = -1; private drawn = 0;
  private frame = 0;

  constructor(private readonly sim: Sim, private readonly cam: Camera, private readonly r: Renderer, private readonly ctl: Controller,
    private readonly mini: HTMLCanvasElement, private readonly big: HTMLCanvasElement, private readonly overlay: HTMLElement) {
    this.N = sim.world.size;
    this.base.width = this.base.height = mini.width = mini.height = big.width = big.height = this.N;
    this.bctx = this.base.getContext('2d')!;
    mini.addEventListener('click', () => this.open());
    this.bindView(); // wheel, drag and pinch move and zoom the map; a plain touch chooses a point, and what can be done there shows below (the map does not carry the camera anywhere)
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });
    this.info = overlay.querySelector('#mapInfo')!; this.gatherBtn = overlay.querySelector('#btnMapGather')!; this.clearBtn = overlay.querySelector('#btnMapClear')!;
    this.gatherBtn.addEventListener('click', () => { if (!this.point) return; this.sim.setGatherFocus(this.point); this.ctl.onToast('Dân khai thác sẽ ưu tiên quanh điểm này'); this.describe(); });
    this.clearBtn.addEventListener('click', () => { this.sim.setGatherFocus(null); this.ctl.onToast('Dân khai thác lại chọn nơi gần nhất'); this.describe(); });
  }

  // ---- zoom and pan of the big map: the canvas is scaled and moved inside its frame ----
  private zoom = 1; private tx = 0; private ty = 0;
  private applyView(): void {
    const w = this.big.parentElement!.clientWidth, h = this.big.parentElement!.clientHeight;
    this.tx = Math.min(0, Math.max(w - w * this.zoom, this.tx)); this.ty = Math.min(0, Math.max(h - h * this.zoom, this.ty));
    this.big.style.transformOrigin = '0 0'; this.big.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.zoom})`;
  }
  /** Zoom by `f` around the point (cx, cy) of the frame, so that the spot under it stays put. */
  private zoomAt(cx: number, cy: number, f: number): void {
    const z = Math.min(24, Math.max(1, this.zoom * f)), k = z / this.zoom;
    this.tx = cx - (cx - this.tx) * k; this.ty = cy - (cy - this.ty) * k; this.zoom = z; this.applyView();
  }
  private bindView(): void {
    const frame = this.big.parentElement!, ptrs = new Map<number, { x: number; y: number }>();
    let moved = 0, pinch = 0;
    const rel = (x: number, y: number) => { const r = frame.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
    this.big.addEventListener('wheel', (e) => { e.preventDefault(); const p = rel(e.clientX, e.clientY); this.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
    this.big.addEventListener('pointerdown', (e) => { this.big.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 1) moved = 0; pinch = 0; });
    this.big.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size === 1) { moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y); if (moved > 6) { this.tx += e.clientX - p.x; this.ty += e.clientY - p.y; this.applyView(); } }
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = rel((a.x + b.x) / 2, (a.y + b.y) / 2); moved = 99; if (pinch > 0) this.zoomAt(m.x, m.y, d / pinch); pinch = d; }
    });
    const up = (e: PointerEvent) => { const had = ptrs.delete(e.pointerId); pinch = 0; if (had && ptrs.size === 0 && moved <= 6 && e.type === 'pointerup') this.pick(e); };
    this.big.addEventListener('pointerup', up); this.big.addEventListener('pointercancel', up);
    const by = (sel: string, f: number | null) => this.overlay.querySelector(sel)?.addEventListener('click', () => { if (f === null) { this.zoom = 1; this.tx = this.ty = 0; this.applyView(); } else this.zoomAt(frame.clientWidth / 2, frame.clientHeight / 2, f); });
    by('#btnMapZoomIn', 1.5); by('#btnMapZoomOut', 1 / 1.5); by('#btnMapZoomReset', null);
  }

  private readonly info: HTMLElement; private readonly gatherBtn: HTMLButtonElement; private readonly clearBtn: HTMLButtonElement;
  /** The point (tiles) chosen on the big map. */
  private point: { x: number; y: number } | null = null;

  private pick(e: MouseEvent): void {
    const r = this.big.getBoundingClientRect();
    this.point = { x: Math.floor(((e.clientX - r.left) / r.width) * this.N), y: Math.floor(((e.clientY - r.top) / r.height) * this.N) };
    this.describe();
  }

  /** What is known of the chosen point, and the buttons that fit it. */
  private describe(): void {
    const { sim, N } = this, p = this.point, focus = sim.gatherFocus.x !== undefined;
    this.clearBtn.disabled = !focus;
    if (!p || p.x < 0 || p.y < 0 || p.x >= N || p.y >= N) { this.gatherBtn.disabled = true; this.info.textContent = focus ? 'Dân khai thác đang ưu tiên quanh dấu ⛏.' : 'Chạm vào bản đồ để chọn một điểm.'; return; }
    const st = sim.fog.state[p.y * N + p.x], fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
    const dist = Math.round(Math.hypot(p.x - fx, p.y - fy)), left = { tree: 0, rock: 0, bush: 0 } as Record<string, number>;
    if (st > 0) for (const [idx, n] of sim.world.nodes) if (n.amount > 0 && Math.abs((idx % N) - p.x) <= 12 && Math.abs(((idx / N) | 0) - p.y) <= 12 && sim.fog.state[idx] > 0) left[n.kind]++;
    this.gatherBtn.disabled = st === 0;
    this.info.textContent = st === 0
      ? `Cách đống lửa ${dist} ô · vùng chưa biết: chọn dân rồi chạm đất ở rìa vùng sáng để đi khám phá.`
      : `Cách đống lửa ${dist} ô · quanh đây: ${left.tree} cây, ${left.rock} đá, ${left.bush} bụi quả.`;
  }

  get isOpen(): boolean { return !this.overlay.hidden; }
  open(): void { this.overlay.hidden = false; this.applyView(); this.describe(); }
  close(): void { this.overlay.hidden = true; }

  private redrawBase(): void {
    const { sim, N } = this;
    if (sim.fog.version === this.ver && sim.buildings.length === this.builds) return;
    const now = performance.now();
    if (this.ver >= 0 && now - this.drawn < (this.isOpen ? 500 : 2000)) return; // a map of nearly a million tiles is not redrawn for every step somebody takes (slowly while only the small map shows: a phone feels each redraw)
    this.drawn = now; this.ver = sim.fog.version; this.builds = sim.buildings.length;
    const img = this.bctx.createImageData(N, N), d = img.data, s = sim.fog.state, occ = sim.world.occ, tiles = sim.world.tiles;
    for (let i = 0; i < N * N; i++) {
      const c = occ[i] ? BUILT : TERRAIN[tiles[i]], k = s[i] === 2 ? 1 : s[i] === 1 ? 0.55 : 0, j = i * 4;
      d[j] = c[0] * k + 8 * (1 - k); d[j + 1] = c[1] * k + 10 * (1 - k); d[j + 2] = c[2] * k + 20 * (1 - k); d[j + 3] = 255;
    }
    this.bctx.putImageData(img, 0, 0);
  }

  private paint(ctx: CanvasRenderingContext2D, dot: number): void {
    const { sim, N } = this, seen = (x: number, y: number) => sim.fog.state[Math.floor(y) * N + Math.floor(x)] === 2;
    ctx.drawImage(this.base, 0, 0);
    for (const t of sim.tribes) {
      if (!sim.tribeSeen(t)) continue;
      ctx.fillStyle = t.state === 'destroyed' ? '#555' : t.state === 'free' ? (sim.tribeHostile(t.id) ? '#e0452a' : '#e0a22a') : '#6fc06f';
      ctx.fillRect(t.camp.x - dot, t.camp.y - dot, dot * 2, dot * 2);
    }
    // smoke smelled near villages not seen yet: roughly where, with a ring for how unsure it is
    ctx.font = `${Math.round(dot * 5)}px sans-serif`; ctx.textAlign = 'center';
    for (const t of sim.tribes) {
      const s = sim.smoke[t.id]; if (!s || sim.tribeSeen(t)) continue;
      ctx.strokeStyle = 'rgba(220,220,230,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e8e8f0'; ctx.fillText('☁', s.x, s.y + dot * 1.5);
    }
    if (this.isOpen) { // names of the villages that are known, the pick-axe where the gatherers were sent, and the point chosen
      ctx.fillStyle = '#ffffff'; ctx.font = `${Math.round(dot * 4)}px sans-serif`;
      for (const t of sim.tribes) if (sim.tribeSeen(t) && t.state !== 'destroyed') ctx.fillText(t.def.name, t.camp.x, t.camp.y - dot * 2.2);
      const f = sim.campfire(); if (f) { ctx.fillStyle = '#ffd24a'; ctx.fillText('🔥', f.x + 1, f.y); }
      if (sim.gatherFocus.x !== undefined) { ctx.fillStyle = '#ffffff'; ctx.font = `${Math.round(dot * 6)}px sans-serif`; ctx.fillText('⛏', sim.gatherFocus.x, sim.gatherFocus.y!); }
      if (this.point) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(this.point.x, this.point.y, 5, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.fillStyle = '#ffffff';
    for (const v of sim.villagers) if (v.inside === null && !v.inTent) ctx.fillRect(v.x - dot / 2, v.y - dot / 2, dot, dot);
    ctx.fillStyle = '#ff5a4a';
    for (const f of sim.foes) if (seen(f.x, f.y)) ctx.fillRect(f.x - dot / 2, f.y - dot / 2, dot, dot);
    for (const a of sim.animals) if (a.state !== 'dead' && seen(a.x, a.y)) { ctx.fillStyle = a.species === 'wolf' ? '#ff5a4a' : '#e8d4a8'; ctx.fillRect(a.x - dot / 3, a.y - dot / 3, dot * 0.7, dot * 0.7); }
    const z = this.cam.zoom, x = this.cam.x / TILE, y = this.cam.y / TILE, w = this.r.w / z / TILE, h = this.r.h / z / TILE;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, dot / 2); ctx.strokeRect(x, y, w, h);
  }

  draw(): void {
    this.frame++;
    if (this.isOpen) { this.redrawBase(); this.paint(this.big.getContext('2d')!, 2.2 / Math.pow(this.zoom, 0.6)); return; }
    if (this.frame % 3) return; // the small map does not need every frame
    this.redrawBase(); this.paint(this.mini.getContext('2d')!, 3);
  }
}
