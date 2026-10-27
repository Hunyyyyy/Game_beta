import { BuildingKind, BUILDINGS } from '../sim/buildings';
import { TILE } from '../sim/constants';
import type { Sim } from '../sim/sim';
import type { Box, Camera, Ghost, Marker, Renderer } from '../render/renderer';

export type Mode = 'select' | 'move' | 'pan';

export class Controller {
  readonly selected = new Set<number>();
  readonly markers: Marker[] = [];
  box: Box | null = null;
  mode: Mode = 'select';
  onChange: () => void = () => {};
  /** Thông báo ngắn cho người chơi (đặt công trình sai chỗ, nhận việc...). */
  onToast: (text: string) => void = () => {};
  /** Đang chọn vị trí đặt công trình. */
  placing: BuildingKind | null = null;
  /** Building shown in the building card (clicked with no villager under the cursor). */
  selectedBuilding: number | null = null;
  private hover: { x: number; y: number } | null = null;
  private keys = new Set<string>();
  private down: { x: number; y: number } | null = null;
  private dragging = false;
  private panning: { x: number; y: number } | null = null;

  constructor(private readonly el: HTMLCanvasElement, private readonly sim: Sim, private readonly cam: Camera, private readonly r: Renderer) {
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => this.pointerDown(e));
    el.addEventListener('pointermove', (e) => this.pointerMove(e));
    el.addEventListener('pointerup', (e) => this.pointerUp(e));
    el.addEventListener('pointercancel', () => { this.down = null; this.box = null; this.panning = null; });
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(this.pos(e), e.deltaY < 0 ? 1 : -1); }, { passive: false });
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  private pos(e: MouseEvent) {
    const b = this.el.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }

  /** Tâm thân dân trên màn hình (css px). */
  private bodyScreen(v: { x: number; y: number }) {
    return this.r.worldToScreen(v.x * TILE, v.y * TILE - 16);
  }

  private pointerDown(e: PointerEvent): void {
    const p = this.pos(e);
    this.el.setPointerCapture(e.pointerId);
    this.el.focus();
    if (e.button === 2) { if (this.placing) { this.cancelPlacing(); return; } this.command(p); return; }
    if (e.button === 1 || this.mode === 'pan') { this.panning = p; e.preventDefault(); return; }
    if (e.button === 0) { this.down = p; this.dragging = false; }
  }

  private pointerMove(e: PointerEvent): void {
    const p = this.pos(e);
    this.hover = p;
    if (this.panning) {
      this.cam.x -= (p.x - this.panning.x) / this.cam.zoom; this.cam.y -= (p.y - this.panning.y) / this.cam.zoom;
      this.panning = p; this.clamp(); return;
    }
    if (!this.down) return;
    if (!this.dragging && Math.hypot(p.x - this.down.x, p.y - this.down.y) > 5) this.dragging = true;
    if (this.dragging && this.mode === 'select') this.box = { x0: this.down.x, y0: this.down.y, x1: p.x, y1: p.y };
  }

  private pointerUp(e: PointerEvent): void {
    const p = this.pos(e);
    if (this.panning) { this.panning = null; return; }
    if (!this.down) return;
    this.hover = p;
    if (this.placing && !this.dragging) this.place(e.shiftKey);
    else if (this.dragging && this.mode === 'select' && this.box) this.boxSelect(this.box, e.shiftKey);
    else this.click(p, e.shiftKey);
    this.down = null; this.dragging = false; this.box = null;
  }

  private hit(p: { x: number; y: number }): number | null {
    let best: number | null = null, bd = (14 * this.cam.zoom) ** 2;
    for (const v of this.sim.villagers) {
      const s = this.bodyScreen(v), d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
      if (d < bd) { bd = d; best = v.id; }
    }
    return best;
  }

  private click(p: { x: number; y: number }, add: boolean): void {
    const id = this.hit(p);
    if (this.mode === 'move' && id === null && this.selected.size) { this.command(p); return; }
    const b = id === null ? this.buildingUnder(p) : null;
    if (id !== null) { if (!add) this.selected.clear(); this.selected.add(id); this.selectedBuilding = null; }
    else if (b !== null) { if (!add) this.selected.clear(); this.selectedBuilding = b; }
    else if (!add) { this.selected.clear(); this.selectedBuilding = null; }
    this.onChange();
  }

  /** Building whose drawn shape (footprint plus the roof above it) is under the screen point. */
  private buildingUnder(p: { x: number; y: number }): number | null {
    const w = this.r.screenToWorld(p.x, p.y);
    for (const b of this.sim.buildings) {
      const d = BUILDINGS[b.kind];
      if (w.x >= b.x * TILE && w.x <= (b.x + d.w) * TILE && w.y >= b.y * TILE - 24 && w.y <= (b.y + d.h) * TILE) return b.id;
    }
    return null;
  }

  private boxSelect(b: Box, add: boolean): void {
    const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    if (!add) this.selected.clear();
    for (const v of this.sim.villagers) {
      const s = this.bodyScreen(v);
      if (s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1) this.selected.add(v.id);
    }
    this.onChange();
  }

  /** Ô trên-trái của công trình đang đặt, lấy con trỏ làm tâm. */
  private placeOrigin(): { x: number; y: number } | null {
    if (!this.placing || !this.hover) return null;
    const d = BUILDINGS[this.placing], w = this.r.screenToWorld(this.hover.x, this.hover.y);
    return { x: Math.round(w.x / TILE - d.w / 2), y: Math.round(w.y / TILE - d.h / 2) };
  }

  ghost(): Ghost | null {
    const o = this.placeOrigin();
    if (!o || !this.placing) return null;
    return { kind: this.placing, x: o.x, y: o.y, ok: this.sim.canPlace(this.placing, o.x, o.y) === null };
  }

  startPlacing(kind: BuildingKind): void { this.placing = kind; this.onChange(); }
  cancelPlacing(): void { this.placing = null; this.onChange(); }

  private place(keep: boolean): void {
    const o = this.placeOrigin();
    if (!o || !this.placing) return;
    const res = this.sim.placeBuilding(this.placing, o.x, o.y);
    if (!res.ok) { this.onToast(res.reason ?? 'Không đặt được'); return; }
    const d = BUILDINGS[this.placing];
    this.markers.push({ x: (o.x + d.w / 2) * TILE, y: (o.y + d.h / 2) * TILE, age: 0 });
    // Có dân đang chọn thì tự giao việc xây cho họ.
    const ids = [...this.selected];
    if (ids.length) this.sim.orderWork(ids, o.x, o.y);
    if (!keep) this.placing = null;
    this.onChange();
  }

  /** Chọn đúng vật thể người chơi nhìn thấy (tán cây vẽ cao hơn ô của nó): trả về ô gốc. */
  private pickTile(wx: number, wy: number): { x: number; y: number } {
    const world = this.sim.world, i = Math.floor(wx / TILE), j0 = Math.floor(wy / TILE);
    const reach: Record<string, [number, number, number]> = { tree: [14, 56, 4], rock: [14, 20, 4], bush: [13, 18, 4] };
    for (let j = j0 + 2; j >= j0 - 1; j--) {            // vật ở phía trước (j lớn) che vật phía sau
      const n = world.nodeAt(i, j);
      if (!n) continue;
      const [hw, up, down] = reach[n.kind], base = j * TILE + 28, cx = i * TILE + 16;
      if (Math.abs(wx - cx) <= hw && wy >= base - up && wy <= base + down) return { x: i, y: j };
    }
    for (const b of this.sim.buildings) {
      const d = BUILDINGS[b.kind];
      if (wx >= b.x * TILE && wx <= (b.x + d.w) * TILE && wy >= b.y * TILE - 24 && wy <= (b.y + d.h) * TILE) return { x: b.x, y: b.y };
    }
    return { x: Math.floor(wx / TILE), y: j0 };
  }

  command(p: { x: number; y: number }): void {
    if (!this.selected.size) return;
    const w = this.r.screenToWorld(p.x, p.y), { x: tx, y: ty } = this.pickTile(w.x, w.y);
    if (!this.sim.world.inBounds(tx, ty)) return;
    const ids = [...this.selected], job = this.sim.orderWork(ids, tx, ty);
    if (job) this.onToast(`${job}`);
    else this.sim.orderMove(ids, tx, ty);
    this.markers.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, age: 0 });
    this.onChange();
  }

  selectAll(): void { this.sim.villagers.forEach((v) => this.selected.add(v.id)); this.onChange(); }
  clearSelection(): void { this.selected.clear(); this.selectedBuilding = null; this.onChange(); }

  centerOn(wx: number, wy: number): void {
    this.cam.x = wx - this.r.w / this.cam.zoom / 2; this.cam.y = wy - this.r.h / this.cam.zoom / 2; this.clamp();
  }

  focusSelection(): void {
    const vs = this.sim.villagers.filter((v) => !this.selected.size || this.selected.has(v.id));
    if (!vs.length) return;
    this.centerOn(vs.reduce((a, v) => a + v.x, 0) / vs.length * TILE, vs.reduce((a, v) => a + v.y, 0) / vs.length * TILE);
  }

  zoomAt(p: { x: number; y: number }, dir: number): void {
    const nz = Math.max(1, Math.min(4, this.cam.zoom + dir));
    if (nz === this.cam.zoom) return;
    const before = this.r.screenToWorld(p.x, p.y);
    this.cam.zoom = nz;
    this.cam.x = before.x - p.x / nz; this.cam.y = before.y - p.y / nz;
    this.clamp();
  }

  private keyDown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (e.target instanceof HTMLElement && /input|textarea/i.test(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); this.selectAll(); return; }
    if (k === 'escape') { if (this.placing) this.cancelPlacing(); else this.clearSelection(); return; }
    if (k === ' ') { e.preventDefault(); this.focusSelection(); return; }
    if (k === '+' || k === '=') { this.zoomAt({ x: this.r.w / 2, y: this.r.h / 2 }, 1); return; }
    if (k === '-') { this.zoomAt({ x: this.r.w / 2, y: this.r.h / 2 }, -1); return; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { this.keys.add(k); e.preventDefault(); }
  }

  clamp(): void {
    const N = this.sim.world.size * TILE, z = this.cam.zoom, m = 96;
    this.cam.x = Math.max(-m, Math.min(N - this.r.w / z + m, this.cam.x));
    this.cam.y = Math.max(-m, Math.min(N - this.r.h / z + m, this.cam.y));
  }

  update(dt: number): void {
    const sp = (640 / this.cam.zoom) * dt, k = this.keys;
    if (k.has('w') || k.has('arrowup')) this.cam.y -= sp;
    if (k.has('s') || k.has('arrowdown')) this.cam.y += sp;
    if (k.has('a') || k.has('arrowleft')) this.cam.x -= sp;
    if (k.has('d') || k.has('arrowright')) this.cam.x += sp;
    if (k.size) this.clamp();
    for (const id of [...this.selected]) if (!this.sim.get(id)) { this.selected.delete(id); this.onChange(); }
    for (const m of this.markers) m.age += dt;
    for (let i = this.markers.length - 1; i >= 0; i--) if (this.markers[i].age > 0.9) this.markers.splice(i, 1);
  }
}
