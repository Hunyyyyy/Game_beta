import { BuildingKind, BUILDINGS, needsWork } from '../sim/buildings';
import { TILE } from '../sim/constants';
import type { Sim } from '../sim/sim';
import type { Box, Camera, Ghost, Marker, Renderer } from '../render/renderer';

/**
 * Input. Mouse: left click selects, right click gives an order, holding the right button and dragging moves the map.
 * Touch: tap selects a villager; with villagers selected a tap on the ground, a resource or an enemy gives the order;
 * two fingers move and zoom the map. "Chọn nhiều" turns taps into toggles and drags into a selection box.
 */
export class Controller {
  readonly selected = new Set<number>();
  readonly markers: Marker[] = [];
  box: Box | null = null;
  onChange: () => void = () => {};
  /** Short message for the player. */
  onToast: (text: string) => void = () => {};
  /** Selecting several villagers: taps toggle, drags draw a box. */
  multi = false;
  /** Building being placed, and where the ghost currently sits (top-left tile). */
  placing: BuildingKind | null = null;
  placeAt: { x: number; y: number } | null = null;
  /** Building shown in the building panel. */
  selectedBuilding: number | null = null;
  /** Foe or animal shown in the target card. */
  inspect: { kind: 'unit' | 'animal'; id: number } | null = null;
  /** F pressed: the next click sends the selection to attack-move there. */
  attackMoveArmed = false;
  /** Saved selections, keys 1-9 (Ctrl + number saves, number recalls). */
  readonly groups = new Map<number, number[]>();

  private keys = new Set<string>();
  private lastClick = { t: 0, id: -1 };
  // mouse
  private left: { x: number; y: number; moved: boolean } | null = null;
  private right: { x: number; y: number; moved: boolean } | null = null;
  // touch
  private touches = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private gesture: { dist: number; mid: { x: number; y: number }; acc: number } | null = null;
  private tapDead = false;

  constructor(private readonly el: HTMLCanvasElement, private readonly sim: Sim, private readonly cam: Camera, private readonly r: Renderer) {
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => this.pointerDown(e));
    el.addEventListener('pointermove', (e) => this.pointerMove(e));
    el.addEventListener('pointerup', (e) => this.pointerUp(e));
    el.addEventListener('pointercancel', () => this.cancelPointers());
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

  private cancelPointers(): void {
    this.left = null; this.right = null; this.touches.clear(); this.gesture = null; this.box = null; this.el.style.cursor = '';
  }

  // ---------------------------------------------------------------- pointer events
  private pointerDown(e: PointerEvent): void {
    const p = this.pos(e);
    this.el.focus();
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now() });
      if (this.touches.size === 1) this.tapDead = false;
      if (this.touches.size === 2) this.startGesture();
      return;
    }
    this.el.setPointerCapture(e.pointerId);
    if (e.button === 2) this.right = { x: p.x, y: p.y, moved: false };
    else if (e.button === 0) this.left = { x: p.x, y: p.y, moved: false };
    else if (e.button === 1) { this.right = { x: p.x, y: p.y, moved: true }; e.preventDefault(); }
  }

  private pointerMove(e: PointerEvent): void {
    const p = this.pos(e);
    if (e.pointerType === 'touch') {
      const t = this.touches.get(e.pointerId); if (!t) return;
      t.x = p.x; t.y = p.y;
      if (this.touches.size >= 2) { this.moveGesture(); return; }
      if (Math.hypot(t.x - t.sx, t.y - t.sy) > 10) {
        if (this.multi) this.box = { x0: t.sx, y0: t.sy, x1: t.x, y1: t.y };
        else if (this.placing) this.placeAt = this.originAt(p);
      }
      return;
    }
    if (this.placing) this.placeAt = this.originAt(p);
    if (this.right) {
      if (!this.right.moved && Math.hypot(p.x - this.right.x, p.y - this.right.y) > 5) { this.right.moved = true; this.el.style.cursor = 'grabbing'; }
      if (this.right.moved) { this.cam.x -= (p.x - this.right.x) / this.cam.zoom; this.cam.y -= (p.y - this.right.y) / this.cam.zoom; this.right.x = p.x; this.right.y = p.y; this.clamp(); }
    }
    if (this.left) {
      if (!this.left.moved && Math.hypot(p.x - this.left.x, p.y - this.left.y) > 5) this.left.moved = true;
      if (this.left.moved && this.multi) this.box = { x0: this.left.x, y0: this.left.y, x1: p.x, y1: p.y };
    }
  }

  private pointerUp(e: PointerEvent): void {
    const p = this.pos(e);
    if (e.pointerType === 'touch') {
      const t = this.touches.get(e.pointerId); this.touches.delete(e.pointerId);
      if (this.touches.size < 2) this.gesture = null;
      if (!t) return;
      if (this.touches.size === 0) {
        if (this.box) { this.boxSelect(this.box, true); this.box = null; }
        else if (!this.tapDead && Math.hypot(p.x - t.sx, p.y - t.sy) < 12 && performance.now() - t.t < 600) this.activate(p, true, false);
      }
      return;
    }
    if (e.button === 2 || e.button === 1) {
      const r = this.right; this.right = null; this.el.style.cursor = '';
      if (r && !r.moved) this.rightClick(p, e.shiftKey);
    } else if (e.button === 0) {
      const l = this.left; this.left = null;
      if (this.box) { this.boxSelect(this.box, true); this.box = null; }
      else if (l && !l.moved) this.activate(p, false, e.shiftKey || e.ctrlKey);
    }
  }

  // ---------------------------------------------------------------- two-finger pan and pinch
  private startGesture(): void {
    this.tapDead = true; this.box = null;
    const [a, b] = [...this.touches.values()];
    this.gesture = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, acc: 1 };
  }
  private moveGesture(): void {
    const g = this.gesture; if (!g) return;
    const [a, b] = [...this.touches.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist = Math.hypot(a.x - b.x, a.y - b.y);
    this.cam.x -= (mid.x - g.mid.x) / this.cam.zoom; this.cam.y -= (mid.y - g.mid.y) / this.cam.zoom;
    g.mid = mid;
    if (g.dist > 0) {
      g.acc *= dist / g.dist; g.dist = dist;
      if (g.acc > 1.3) { this.zoomAt(mid, 1); g.acc = 1; } else if (g.acc < 0.77) { this.zoomAt(mid, -1); g.acc = 1; }
    }
    this.clamp();
  }

  // ---------------------------------------------------------------- what a click or tap does
  /** Villager under the point; fingers get a wider target. */
  private hit(p: { x: number; y: number }, touch = false): number | null {
    let best: number | null = null, bd = ((touch ? 22 : 14) * Math.max(1, this.cam.zoom)) ** 2;
    for (const v of this.sim.villagers) {
      const s = this.bodyScreen(v), d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
      if (d < bd) { bd = d; best = v.id; }
    }
    return best;
  }

  /** Building whose drawn shape (footprint plus what stands above it) is under the screen point. */
  private buildingUnder(p: { x: number; y: number }): number | null {
    const w = this.r.screenToWorld(p.x, p.y);
    for (const b of this.sim.buildings) {
      const d = BUILDINGS[b.kind];
      if (w.x >= b.x * TILE && w.x <= (b.x + d.w) * TILE && w.y >= b.y * TILE - 24 && w.y <= (b.y + d.h) * TILE) return b.id;
    }
    return null;
  }

  /** Left click or tap. */
  private activate(p: { x: number; y: number }, touch: boolean, additive: boolean): void {
    if (this.attackMoveArmed) { this.attackMove(p, additive); return; }
    if (this.placing) { if (touch) { this.placeAt = this.originAt(p); this.onChange(); } else this.confirmPlace(additive); return; }
    const id = this.hit(p, touch);
    if (this.multi) { if (id !== null) { this.toggle(id); this.onChange(); } return; }
    const b = this.buildingUnder(p), w = this.r.screenToWorld(p.x, p.y);
    const seen = this.sim.targetAt(w.x / TILE, w.y / TILE);
    if (id !== null) {
      const now = performance.now();
      if (this.lastClick.id === id && now - this.lastClick.t < 400) { this.selectSameJob(id); this.lastClick = { t: 0, id: -1 }; return; }
      this.lastClick = { t: now, id };
      if (additive || (touch && this.selected.has(id) && this.selected.size > 1)) this.toggle(id); else { this.selected.clear(); this.selected.add(id); }
      this.selectedBuilding = null; this.inspect = null; this.onChange(); return;
    }
    // with villagers selected, a tap is the order
    if (touch && this.selected.size) {
      const finished = b !== null && (() => { const bb = this.sim.getBuilding(b); return !!bb && !needsWork(bb); })();
      if (finished) { this.selectBuilding(b!); return; }
      this.command(p, false); return;
    }
    if (seen) { this.inspect = { kind: seen.target.kind, id: seen.target.id }; this.selectedBuilding = null; }
    else if (b !== null) this.selectBuilding(b);
    else if (!additive) { this.selected.clear(); this.selectedBuilding = null; this.inspect = null; }
    this.onChange();
  }

  private toggle(id: number): void { if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id); }

  /** Right click: an order for the selection. */
  private rightClick(p: { x: number; y: number }, queue: boolean): void {
    if (this.attackMoveArmed) { this.attackMoveArmed = false; this.onChange(); return; }
    if (this.placing) { this.cancelPlacing(); return; }
    this.command(p, queue);
  }

  /** Select every villager of the same job as `id` that is visible on screen. */
  private selectSameJob(id: number): void {
    const ref = this.sim.get(id); if (!ref) return;
    this.selected.clear();
    for (const v of this.sim.villagers) {
      const s = this.bodyScreen(v);
      if (v.job === ref.job && s.x >= 0 && s.y >= 0 && s.x <= this.r.w && s.y <= this.r.h) this.selected.add(v.id);
    }
    this.onChange();
  }

  private boxSelect(b: Box, add: boolean): void {
    const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    if (!add) this.selected.clear();
    for (const v of this.sim.villagers) {
      const s = this.bodyScreen(v);
      if (s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1) this.selected.add(v.id);
    }
    this.selectedBuilding = null; this.inspect = null;
    this.onChange();
  }

  selectBuilding(id: number): void { this.selectedBuilding = id; this.inspect = null; this.onChange(); }
  closeBuilding(): void { this.selectedBuilding = null; this.onChange(); }

  // ---------------------------------------------------------------- placing buildings
  /** Top-left tile of a building of the placing kind centred on the point. */
  private originAt(p: { x: number; y: number }): { x: number; y: number } | null {
    if (!this.placing) return null;
    const d = BUILDINGS[this.placing], w = this.r.screenToWorld(p.x, p.y);
    return { x: Math.round(w.x / TILE - d.w / 2), y: Math.round(w.y / TILE - d.h / 2) };
  }

  ghost(): Ghost | null {
    if (!this.placing || !this.placeAt) return null;
    return { kind: this.placing, x: this.placeAt.x, y: this.placeAt.y, ok: this.sim.canPlace(this.placing, this.placeAt.x, this.placeAt.y) === null };
  }

  startPlacing(kind: BuildingKind): void {
    this.placing = kind; this.attackMoveArmed = false;
    // start the ghost in the middle of the screen so a finger can see it at once
    this.placeAt = this.originAt({ x: this.r.w / 2, y: this.r.h / 2 });
    this.onChange();
  }
  cancelPlacing(): void { this.placing = null; this.placeAt = null; this.onChange(); }

  confirmPlace(keep = false): void {
    if (!this.placing || !this.placeAt) return;
    const o = this.placeAt, res = this.sim.placeBuilding(this.placing, o.x, o.y);
    if (!res.ok) { this.onToast(res.reason ?? 'Không đặt được'); return; }
    const d = BUILDINGS[this.placing];
    this.markers.push({ x: (o.x + d.w / 2) * TILE, y: (o.y + d.h / 2) * TILE, age: 0 });
    // Có dân đang chọn thì tự giao việc xây cho họ.
    const ids = [...this.selected];
    if (ids.length && res.building && needsWork(res.building)) this.sim.orderWork(ids, o.x, o.y);
    if (!keep) { this.placing = null; this.placeAt = null; }
    this.onChange();
  }

  // ---------------------------------------------------------------- orders
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

  command(p: { x: number; y: number }, queue = false): void {
    if (!this.selected.size) return;
    const w = this.r.screenToWorld(p.x, p.y), ids = [...this.selected];
    // an enemy, an animal or a carcass under the cursor beats ground orders
    const seen = this.sim.targetAt(w.x / TILE, w.y / TILE);
    if (seen) {
      if (seen.kind === 'carcass') { this.sim.orderLoot(ids, seen.target.id); this.onToast('Lột da, lấy thịt'); }
      else { this.sim.orderAttack(ids, seen.target, queue); this.onToast(seen.kind === 'foe' ? 'Tấn công' : 'Săn'); }
      this.markers.push({ x: w.x, y: w.y, age: 0 }); this.onChange(); return;
    }
    const { x: tx, y: ty } = this.pickTile(w.x, w.y);
    if (!this.sim.world.inBounds(tx, ty)) return;
    const job = this.sim.orderWork(ids, tx, ty);
    if (job) this.onToast(`${job}`);
    else this.sim.orderMove(ids, tx, ty, queue);
    this.markers.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, age: 0 });
    this.onChange();
  }

  /** Send the selection to a point, fighting whatever it meets on the way. */
  attackMove(p: { x: number; y: number }, queue = false): void {
    this.attackMoveArmed = false;
    if (!this.selected.size) { this.onChange(); return; }
    const w = this.r.screenToWorld(p.x, p.y);
    this.sim.orderAttackMove([...this.selected], w.x / TILE, w.y / TILE, queue);
    this.markers.push({ x: w.x, y: w.y, age: 0 });
    this.onToast('Tấn công – di chuyển'); this.onChange();
  }

  /** Save the selection under a number, or recall it (and jump the camera to it). */
  group(n: number, save: boolean): void {
    if (save) { this.groups.set(n, [...this.selected]); this.onToast(`Đã lưu nhóm ${n} (${this.selected.size} người)`); return; }
    const ids = (this.groups.get(n) ?? []).filter((id) => this.sim.get(id));
    if (!ids.length) { this.onToast(`Nhóm ${n} đang trống`); return; }
    this.selected.clear(); ids.forEach((id) => this.selected.add(id)); this.selectedBuilding = null; this.focusSelection(); this.onChange();
  }

  selectAll(): void { this.sim.villagers.forEach((v) => this.selected.add(v.id)); this.selectedBuilding = null; this.onChange(); }
  clearSelection(): void { this.selected.clear(); this.selectedBuilding = null; this.inspect = null; this.onChange(); }
  setMulti(on: boolean): void { this.multi = on; this.box = null; this.onChange(); }

  // ---------------------------------------------------------------- camera
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
    if (e.target instanceof HTMLElement && /input|textarea|select/i.test(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); this.selectAll(); return; }
    if (k === 'escape') { if (this.attackMoveArmed) { this.attackMoveArmed = false; this.onChange(); } else if (this.placing) this.cancelPlacing(); else this.clearSelection(); return; }
    if (/^[1-9]$/.test(k) && !e.shiftKey) { this.group(Number(k), e.ctrlKey || e.metaKey); e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'f' && this.selected.size) { this.attackMoveArmed = true; this.onToast('Chọn điểm đến (chuột trái); Esc để hủy'); this.onChange(); return; }
    if (k === 'h' && this.selected.size) { this.sim.orderHold([...this.selected]); this.onToast('Giữ vị trí'); this.onChange(); return; }
    if (k === 'g' && this.selected.size) { this.sim.orderStop([...this.selected]); this.onToast('Dừng'); this.onChange(); return; }
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
