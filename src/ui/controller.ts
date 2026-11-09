import { BuildingKind, BUILDINGS, needsWork } from '../sim/buildings';
import { TILE } from '../sim/constants';
import { JOB_NAME } from '../sim/jobs';
import type { Sim } from '../sim/sim';
import type { Box, Camera, Ghost, Marker, Renderer } from '../render/renderer';

/**
 * Input. Mouse: left click selects, right click gives an order, holding the right button and dragging moves the map.
 * Touch: tap selects a villager; with villagers selected a tap on the ground, a resource or an enemy gives the order;
 * one finger dragging the ground moves the map; with one finger held down, the other taps to give the order or swipes to move the map; two fingers moving together zoom it. "Chọn nhiều" turns taps into toggles and drags into a selection box.
 */
export class Controller {
  readonly selected = new Set<number>();
  readonly markers: Marker[] = [];
  box: Box | null = null;
  onChange: () => void = () => {};  /** Short message for the player. */
  onToast: (text: string) => void = () => {};
  /** An order was given to a troop (several chosen, soldiers among them): the sound of it. */
  onOrder: () => void = () => {};
  private ordered(ids: number[]): void { if (ids.length > 1 && ids.some((id) => this.sim.get(id)?.job === 'fight')) this.onOrder(); }
  /** Selecting several villagers: taps toggle, drags draw a box. */
  multi = false;
  /** The card of the chosen people is out of the way while the player orders them about; choosing someone brings it back. */
  hushCard = false;
  /** Holding the pointer still on the map opens a ring of buttons round it (the screen draws it): `open` when it opens, `move` while the pointer goes over it, `end` when it is let go. */
  hold = { open: (_p: { x: number; y: number }) => undefined as void, move: (_p: { x: number; y: number }) => undefined as void, end: (_p: { x: number; y: number }) => undefined as void };
  private ringAt: { x: number; y: number } | null = null;
  private holdTimer = 0;
  private holdFrom: { x: number; y: number } | null = null;
  private startHold(p: { x: number; y: number }): void {
    this.stopHold();
    if (this.placing || this.groupMode || this.attackMoveArmed) return;
    this.holdFrom = { x: p.x, y: p.y };
    this.holdTimer = window.setTimeout(() => { this.holdTimer = 0; this.holdFrom = null; this.ringAt = { x: p.x, y: p.y }; this.box = null; this.hold.open(p); }, 450);
  }
  private stopHold(): void { if (this.holdTimer) window.clearTimeout(this.holdTimer); this.holdTimer = 0; this.holdFrom = null; }
  /** Building being placed, and where the ghost currently sits (top-left tile). */
  placing: BuildingKind | null = null;
  placeAt: { x: number; y: number } | null = null;
  /** Choosing several pieces of fence (and gates) to carry together: their ids (the first is the one the group turns about), and how many quarter-turns it has been turned. */
  groupMode = false;
  groupIds: number[] = [];
  groupRot = 0;
  /** Id of the building being carried to a new spot (null when placing a new one). */
  moving: number | null = null;
  /** Building tapped on the map: its buttons show beneath it. */
  selectedBuilding: number | null = null;
  /** The full-screen panel of the selected building is open. */
  buildingOpen = false;
  /** Foe or animal shown in the target card. */
  /** What was tapped: a unit, an animal, or a tree, rock or bush (id = its tile index). */
  /** What is shown on the card of the map: a unit, an animal, a tree/rock/bush (tile index), or the field tent of a squad in a war (squad id). */
  inspect: { kind: 'unit' | 'animal' | 'node' | 'tent'; id: number } | null = null;
  /** The campfire's people menu asked for the full page of the chosen villager. */
  openDetail = false;
  /** The house whose dialog the villager's detail was opened from: closing the detail brings it back. */
  detailFrom: number | null = null;
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
  private touches = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; px: number; py: number; /** Chọn nhiều: decided at the first drag, true when the finger was held a moment first (then it draws the box, else it moves the map) */ boxing?: boolean }>();
  private gesture: { dist: number; mid: { x: number; y: number }; acc: number } | null = null;
  private tapDead = false;
  /** The finger that went down while placing started on the building being placed: it drags the building, not the map. */
  private dragGhost = false;

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
    this.stopHold(); if (this.ringAt) { this.ringAt = null; this.hold.end({ x: -999, y: -999 }); }
    this.left = null; this.right = null; this.touches.clear(); this.gesture = null; this.box = null; this.el.style.cursor = '';
  }

  // ---------------------------------------------------------------- pointer events
  private pointerDown(e: PointerEvent): void {
    const p = this.pos(e);
    this.el.focus();
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), px: p.x, py: p.y });
      if (this.touches.size === 1) { this.tapDead = false; this.dragGhost = this.onGhost(p); this.startHold(p); } else this.stopHold();
      if (this.touches.size === 2) this.startGesture();
      return;
    }
    this.el.setPointerCapture(e.pointerId);
    if (e.button === 2) this.right = { x: p.x, y: p.y, moved: false };
    else if (e.button === 0) { this.left = { x: p.x, y: p.y, moved: false }; this.startHold(p); }
    else if (e.button === 1) { this.right = { x: p.x, y: p.y, moved: true }; e.preventDefault(); }
  }

  private pointerMove(e: PointerEvent): void {
    const p = this.pos(e);
    if (this.ringAt) { this.hold.move(p); return; }
    if (this.holdFrom && Math.hypot(p.x - this.holdFrom.x, p.y - this.holdFrom.y) > 8) this.stopHold();
    if (e.pointerType === 'touch') {
      const t = this.touches.get(e.pointerId); if (!t) return;
      t.x = p.x; t.y = p.y;
      if (this.touches.size >= 2) { this.moveGesture(); return; }
      if (Math.hypot(t.x - t.sx, t.y - t.sy) > 10) {
        if (this.multi && t.boxing === undefined) t.boxing = performance.now() - t.t >= 200; // Chọn nhiều: touch and hold a moment, then drag, to draw the box; a quick swipe still moves the map
        if (this.multi && t.boxing) this.box = { x0: t.sx, y0: t.sy, x1: t.x, y1: t.y };
        else if (this.placing && this.dragGhost) { if (this.isFenceLine()) this.dragFence(p); else this.placeAt = this.originAt(p); } // a finger that started on the building being placed or moved drags it (fence: it lays a row)
        else { // one finger dragging the ground (also while placing, away from the building) moves the map (a tap still gives the order); two fingers still pinch to zoom
          this.cam.x -= (t.x - t.px) / this.cam.zoom; this.cam.y -= (t.y - t.py) / this.cam.zoom; this.clamp(); this.tapDead = true;
        }
      }
      t.px = t.x; t.py = t.y;
      return;
    }
    if (this.placing && !this.left?.moved) this.placeAt = this.originAt(p);
    if (this.right) {
      if (!this.right.moved && Math.hypot(p.x - this.right.x, p.y - this.right.y) > 5) { this.right.moved = true; this.el.style.cursor = 'grabbing'; }
      if (this.right.moved) { this.cam.x -= (p.x - this.right.x) / this.cam.zoom; this.cam.y -= (p.y - this.right.y) / this.cam.zoom; this.right.x = p.x; this.right.y = p.y; this.clamp(); }
    }
    if (this.left) {
      if (!this.left.moved && Math.hypot(p.x - this.left.x, p.y - this.left.y) > 5) this.left.moved = true;
      if (this.left.moved && this.multi) this.box = { x0: this.left.x, y0: this.left.y, x1: p.x, y1: p.y };
      else if (this.left.moved && this.isFenceLine()) this.dragFence(p); // placing fence: the drag lays a row of it (the map is moved with the right button)
      else if (this.left.moved && this.placing) { // dragging with the left button while placing or moving a building pans the map; the building stays where it was
        this.cam.x -= (p.x - this.left.x) / this.cam.zoom; this.cam.y -= (p.y - this.left.y) / this.cam.zoom; this.left.x = p.x; this.left.y = p.y; this.clamp(); this.el.style.cursor = 'grabbing';
      }
    }
  }

  // ---------------------------------------------------------------- a row of fence laid by dragging
  private fenceLast: { x: number; y: number } | null = null;
  private fencePlaced = 0;
  private fenceFailed = false;
  /** A new fence is being placed (not carried): dragging lays a row of it. */
  private isFenceLine(): boolean { return this.placing === 'fence' && this.moving === null && !this.groupMoving; }
  /** The pointer moved over the map: every tile from the last one to this one gets a piece of fence (those that cannot be built are skipped, the first reason is told once). */
  private dragFence(p: { x: number; y: number }): void {
    const to = this.originAt(p);
    if (!to) return;
    let { x, y } = this.fenceLast ?? to;
    const dx = Math.abs(to.x - x), dy = Math.abs(to.y - y), sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
    let err = dx - dy;
    for (let guard = 0; guard < 400; guard++) {
      if (!this.fenceLast || x !== this.fenceLast.x || y !== this.fenceLast.y || this.fencePlaced === 0) {
        this.placeAt = { x, y };
        if (this.confirmPlace(true, true)) this.fencePlaced++;
        else if (!this.fenceFailed) { this.fenceFailed = true; const why = this.sim.canPlace('fence', x, y); if (why) this.onToast(why); }
      }
      this.fenceLast = { x, y };
      if (x === to.x && y === to.y) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    this.placeAt = to;
  }
  private endFenceLine(): void {
    if (this.fencePlaced > 1) this.onToast(`Đã đặt ${this.fencePlaced} đoạn hàng rào`);
    this.fenceLast = null; this.fencePlaced = 0; this.fenceFailed = false;
  }

  /** Is the screen point on (or close to) the building being placed or moved: a finger there drags the building, anywhere else it drags the map. */
  private onGhost(p: { x: number; y: number }): boolean {
    if (!this.placing || !this.placeAt) return false;
    const w = this.r.screenToWorld(p.x, p.y), tx = w.x / TILE, ty = w.y / TILE, d = BUILDINGS[this.placing], slack = this.groupMoving ? 4 : 1;
    return tx >= this.placeAt.x - slack && tx <= this.placeAt.x + d.w + slack && ty >= this.placeAt.y - slack - 1 && ty <= this.placeAt.y + d.h + slack;
  }

  private pointerUp(e: PointerEvent): void {
    const p = this.pos(e);
    this.stopHold();
    if (this.ringAt) { this.ringAt = null; this.hold.end(p); this.left = null; this.right = null; this.touches.clear(); this.gesture = null; this.box = null; this.el.style.cursor = ''; return; } // the ring took this press
    if (e.pointerType === 'touch') {
      const t = this.touches.get(e.pointerId); this.touches.delete(e.pointerId);
      if (this.touches.size < 2) this.gesture = null;
      if (!t) return;
      // one finger held on the screen and the other taps: that is the order, the spot tapped; the other swiping moves the map (see moveGesture)
      if (this.touches.size === 1) {
        const [held] = [...this.touches.values()];
        if (Math.hypot(held.x - held.sx, held.y - held.sy) < 14 && t.t - held.t > 250 && Math.hypot(p.x - t.sx, p.y - t.sy) < 12 && performance.now() - t.t < 600) { this.activate(p, true, false); return; }
      }
      if (this.touches.size === 0) {
        this.endFenceLine();
        if (this.box) { this.boxSelect(this.box); this.box = null; }
        else if (!this.tapDead && Math.hypot(p.x - t.sx, p.y - t.sy) < 12 && performance.now() - t.t < 600) this.activate(p, true, false);
      }
      return;
    }
    if (e.button === 2 || e.button === 1) {
      const r = this.right; this.right = null; this.el.style.cursor = '';
      if (r && !r.moved) this.rightClick(p, e.shiftKey);
    } else if (e.button === 0) {
      const l = this.left; this.left = null; if (this.placing) this.el.style.cursor = '';
      this.endFenceLine();
      if (this.box) { this.boxSelect(this.box); this.box = null; }
      else if (l && !l.moved) this.activate(p, false, e.shiftKey || e.ctrlKey);
    }
  }

  // ---------------------------------------------------------------- two-finger pan and pinch, or one finger held and one dragging
  private startGesture(): void {
    this.tapDead = true; this.box = null;
    const [a, b] = [...this.touches.values()];
    this.gesture = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, acc: 1 };
  }
  private moveGesture(): void {
    const g = this.gesture; if (!g) return;
    const [a, b] = [...this.touches.values()];
    // one finger holds still and the other drags: the camera follows the dragging finger, one to one (no zoom)
    const held = (t: { x: number; y: number; sx: number; sy: number }) => Math.hypot(t.x - t.sx, t.y - t.sy) < 14;
    const holdA = held(a), holdB = held(b);
    if (holdA !== holdB) {
      const m = holdA ? b : a;
      this.cam.x -= (m.x - m.px) / this.cam.zoom; this.cam.y -= (m.y - m.py) / this.cam.zoom;
      a.px = a.x; a.py = a.y; b.px = b.x; b.py = b.y;
      g.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; g.dist = Math.hypot(a.x - b.x, a.y - b.y); g.acc = 1;
      this.clamp(); return;
    }
    a.px = a.x; a.py = a.y; b.px = b.x; b.py = b.y;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist = Math.hypot(a.x - b.x, a.y - b.y);
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
    let best: number | null = null, bd = ((touch ? 28 : 14) * Math.max(1, this.cam.zoom)) ** 2; // a finger is wide: a bigger target
    for (const v of this.sim.villagers) {
      if (v.inside !== null || v.inTent) continue; // working inside a house or asleep in a field tent: not on the map
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
    // choosing pieces of fence: a tap takes one in or puts it back
    if (this.groupMode && !this.placing) { const b = this.buildingUnder(p); if (b !== null && this.isWall(b)) this.toggleGroup(b); else { this.endGroup(); this.selectedBuilding = null; this.onChange(); } return; } // a tap away from the fence lets the group go
    if (this.placing) { if (touch) { this.placeAt = this.originAt(p); this.onChange(); } else this.confirmPlace(additive); return; }
    const id = this.hit(p, touch);
    const b = this.buildingUnder(p), w = this.r.screenToWorld(p.x, p.y);
    const seen = this.sim.targetAt(w.x / TILE, w.y / TILE);
    if (this.multi) { // Chọn nhiều: the group changes only by drawing a new box. With a group chosen every tap is an order (the ground, one of ours, an enemy, a work, a tree: see command); with nobody chosen a tap on a person takes him in.
      if (this.selected.size) { this.command(p, additive); return; }
      if (id !== null) { this.toggle(id); this.hushCard = false; this.onChange(); return; }
    }
    if (id !== null) {
      this.hushCard = false;
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
    const tent = this.sim.plans.find((p) => p.kind === 'attack' && p.status === 'running')?.tents.find((t) => Math.hypot(t.x - w.x / TILE, t.y - 0.5 - w.y / TILE) < 1.6); // a field tent of the war
    if (tent) { this.inspect = { kind: 'tent', id: tent.squad }; this.selectedBuilding = null; this.onChange(); return; }
    if (seen) { this.inspect = { kind: seen.target.kind, id: seen.target.id }; this.selectedBuilding = null; }
    else if ((() => { const t = this.pickTile(w.x, w.y), N = this.sim.world.size; if (!this.sim.world.nodeAt(t.x, t.y) || this.sim.fog.state[t.y * N + t.x] === 0) return false; this.inspect = { kind: 'node', id: t.y * N + t.x }; this.selectedBuilding = null; return true; })()) { /* a tree, rock or bush: its card opens */ }
    else if (b !== null) this.selectBuilding(b);
    else if (!additive) {
      // nobody selected: a tap on the ground does nothing, so say why instead of leaving it silent
      if (touch && !this.selected.size && !this.selectedBuilding && !this.inspect) this.onToast('Chạm vào một dân để chọn trước, rồi chạm đất để ra lệnh');
      this.selected.clear(); this.selectedBuilding = null; this.inspect = null;
    }
    this.onChange();
  }

  /** A finished order lets the villagers go (soldiers stay chosen to be ordered again, and so does a queue being built with Shift). */
  private releaseCivilians(keep: boolean): void {
    if (keep || [...this.selected].some((id) => this.sim.get(id)?.job === 'fight')) return;
    this.selected.clear();
  }

  /** The chosen villagers who are soldiers: only they take fighting orders. */
  private fighters(): number[] { return [...this.selected].filter((id) => this.sim.get(id)?.job === 'fight'); }

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
      if (v.inside !== null || v.inTent) continue; // working inside a house or asleep in a field tent: not on the map
      const s = this.bodyScreen(v);
      if (v.job === ref.job && s.x >= 0 && s.y >= 0 && s.x <= this.r.w && s.y <= this.r.h) this.selected.add(v.id);
    }
    this.onChange();
  }

  /** The people inside the box become the group; the group chosen before is let go. */
  private boxSelect(b: Box): void {
    const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    this.selected.clear();
    for (const v of this.sim.villagers) {
      if (v.inside !== null || v.inTent) continue; // working inside a house or asleep in a field tent: not on the map
      const s = this.bodyScreen(v);
      if (s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1) this.selected.add(v.id);
    }
    this.selectedBuilding = null; this.inspect = null;
    this.onChange();
  }

  selectBuilding(id: number, open = false): void { this.selectedBuilding = id; this.buildingOpen = open; this.inspect = null; this.selected.clear(); this.onChange(); } // a house and a villager are never shown together
  /** Close the panel but keep the building selected. */
  closePanel(): void { this.buildingOpen = false; this.onChange(); }
  closeBuilding(): void { this.selectedBuilding = null; this.buildingOpen = false; this.onChange(); }

  // ---------------------------------------------------------------- placing buildings
  /** Top-left tile of a building of the placing kind centred on the point. */
  private originAt(p: { x: number; y: number }): { x: number; y: number } | null {
    if (!this.placing) return null;
    const d = BUILDINGS[this.placing], w = this.r.screenToWorld(p.x, p.y);
    return { x: Math.round(w.x / TILE - d.w / 2), y: Math.round(w.y / TILE - d.h / 2) };
  }

  /** Fences and gates may be picked up together. */
  isWall(id: number): boolean { const b = this.sim.getBuilding(id); return !!b && b.done && (b.kind === 'fence' || b.kind === 'gate'); }
  /** The group is being carried now. */
  get groupMoving(): boolean { return this.groupMode && this.moving !== null; }

  /** Start choosing pieces: this one is the first. */
  startGroup(id: number): void { this.groupMode = true; this.groupIds = [id]; this.groupRot = 0; this.selectedBuilding = id; this.buildingOpen = false; this.selected.clear(); this.inspect = null; this.onChange(); }
  endGroup(): void { this.groupMode = false; this.groupIds = []; this.groupRot = 0; this.moving = null; this.placing = null; this.placeAt = null; this.onChange(); }
  toggleGroup(id: number): void {
    if (!this.isWall(id)) return;
    this.groupIds = this.groupIds.includes(id) ? this.groupIds.filter((x) => x !== id) : [...this.groupIds, id];
    if (!this.groupIds.length) { this.endGroup(); this.selectedBuilding = null; return; }
    this.selectedBuilding = this.groupIds[0]; this.onChange();
  }
  /** Take in every piece joined to the chosen ones, side by side. */
  selectRun(): void {
    const at = new Map<number, number>(), N = this.sim.world.size;
    for (const b of this.sim.buildings) if (this.isWall(b.id)) at.set(b.y * N + b.x, b.id);
    const chosen = this.groupIds.map((id) => this.sim.getBuilding(id)).filter((b): b is NonNullable<typeof b> => !!b);
    // a run goes straight: along the row when the chosen pieces share one, along the column when they share one, else the longer way from a single piece (never round a corner)
    const along = (b: { x: number; y: number }, dx: number, dy: number): number[] => { const out: number[] = []; for (let x = b.x + dx, y = b.y + dy, id = at.get(y * N + x); id !== undefined; x += dx, y += dy, id = at.get(y * N + x)) out.push(id); return out; };
    const sameRow = chosen.length > 1 && chosen.every((b) => b.y === chosen[0].y), sameCol = chosen.length > 1 && chosen.every((b) => b.x === chosen[0].x);
    const seen = new Set<number>(this.groupIds);
    for (const b of chosen) {
      const row = [...along(b, 1, 0), ...along(b, -1, 0)], col = [...along(b, 0, 1), ...along(b, 0, -1)];
      for (const id of sameRow ? row : sameCol ? col : row.length >= col.length ? row : col) seen.add(id);
    }
    this.groupIds = [...seen]; this.onToast(`Đã chọn ${this.groupIds.length} mảnh`); this.onChange();
  }
  /** Pick the chosen pieces up to put them down somewhere else; `turns` quarter-turns clockwise to begin with. */
  startGroupMove(turns = 0): void {
    const a = this.sim.getBuilding(this.groupIds[0]); if (!a) return;
    this.groupRot = turns; this.moving = a.id; this.selectedBuilding = null; this.startPlacing(a.kind); this.placeAt = { x: a.x, y: a.y }; this.onChange();
  }
  /** Turn the group a quarter-turn clockwise (while carrying it, or to start carrying it turned). */
  rotateGroup(): void { if (this.groupMoving) { this.groupRot = (this.groupRot + 1) % 4; this.onChange(); } else if (this.groupMode) this.startGroupMove(1); }

  ghost(): Ghost | null {
    if (!this.placing || !this.placeAt) return null;
    if (this.groupMoving) {
      const plan = this.sim.groupPlan(this.groupIds, this.placeAt, this.groupRot);
      return { kind: this.placing, x: this.placeAt.x, y: this.placeAt.y, ok: this.placeProblem() === null, group: plan, movingIds: [...this.groupIds] };
    }
    const b = this.moving !== null ? this.sim.getBuilding(this.moving) : undefined;
    return { kind: this.placing, x: this.placeAt.x, y: this.placeAt.y, ok: this.placeProblem() === null, level: b?.level, era: b?.era, moving: this.moving ?? undefined };
  }

  /** Why the ghost cannot be put down where it is, or null. */
  placeProblem(): string | null {
    if (!this.placing || !this.placeAt) return 'Chạm lên bản đồ để chọn chỗ';
    if (this.groupMoving) return this.sim.canMoveGroup(this.groupIds, this.placeAt, this.groupRot);
    if (this.moving === null) return this.sim.canPlace(this.placing, this.placeAt.x, this.placeAt.y);
    const b = this.sim.getBuilding(this.moving);
    return b ? this.sim.canMove(b, this.placeAt.x, this.placeAt.y) : 'Công trình không còn';
  }

  startPlacing(kind: BuildingKind): void {
    this.placing = kind; this.attackMoveArmed = false;
    // start the ghost in the middle of the screen so a finger can see it at once
    this.placeAt = this.originAt({ x: this.r.w / 2, y: this.r.h / 2 });
    this.onChange();
  }
  /** Pick a built building up to put it somewhere else. */
  startMoving(id: number): void {
    const b = this.sim.getBuilding(id); if (!b) return;
    this.moving = id; this.selectedBuilding = null; this.startPlacing(b.kind);
    this.placeAt = { x: b.x, y: b.y }; this.onChange();
  }
  cancelPlacing(): void { this.placing = null; this.placeAt = null; this.moving = null; if (this.groupMode) { this.groupRot = 0; this.selectedBuilding = this.groupIds[0] ?? null; } this.onChange(); }

  confirmPlace(keep = false, quiet = false): boolean {
    if (!this.placing || !this.placeAt) return false;
    if (this.groupMoving) {
      const err = this.sim.moveGroup(this.groupIds, this.placeAt, this.groupRot);
      if (err) { this.onToast(err); return false; }
      this.onToast(`Đã dời ${this.groupIds.length} mảnh`); this.endGroup(); return true;
    }
    if (this.moving !== null) {
      const id = this.moving, err = this.sim.moveBuilding(id, this.placeAt.x, this.placeAt.y);
      if (err) { this.onToast(err); return false; }
      const ids = [...this.selected], b = this.sim.getBuilding(id);
      if (ids.length && b && needsWork(b)) this.sim.orderWork(ids, b.x, b.y);
      this.placing = null; this.placeAt = null; this.moving = null; this.onToast('Đã dời công trình'); this.onChange(); return true;
    }
    const o = this.placeAt, res = this.sim.placeBuilding(this.placing, o.x, o.y);
    if (!res.ok) { if (!quiet) this.onToast(res.reason ?? 'Không đặt được'); return false; }
    const d = BUILDINGS[this.placing];
    this.markers.push({ x: (o.x + d.w / 2) * TILE, y: (o.y + d.h / 2) * TILE, age: 0 });
    // Có dân đang chọn thì tự giao việc xây cho họ.
    const ids = [...this.selected];
    if (ids.length && res.building && needsWork(res.building)) this.sim.orderWork(ids, o.x, o.y);
    if (!keep && !d.repeat) { this.placing = null; this.placeAt = null; }
    this.onChange();
    return true;
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
    this.hushCard = true;
    const w = this.r.screenToWorld(p.x, p.y);
    let ids = [...this.selected];
    if (ids.every((id) => this.sim.scouts.some((m) => m.ids.includes(id)))) { this.onToast(ids.length > 1 ? 'Các trinh sát đang làm nhiệm vụ: đợi họ về' : 'Trinh sát đang làm nhiệm vụ: đợi họ về'); return; }
    // an enemy, an animal or a carcass under the cursor beats ground orders
    const seen = this.sim.targetAt(w.x / TILE, w.y / TILE);
    if (seen) {
      // only soldiers fight and only hunters hunt; a villager with no job becomes a hunter by being sent at game, one who has a job keeps it
      const noHunter = 'Chỉ Thợ săn hoặc chiến binh mới săn thú: dân đã có nghề khác chỉ đổi nghề ở công trình của nghề đó';
      if (seen.kind === 'carcass') {
        const why = this.sim.autoHunter(ids, seen.target), n = this.sim.orderLoot(ids, seen.target.id);
        this.onToast(n ? 'Lột da, lấy thịt' : why ?? noHunter);
      } else {
        const why = seen.kind === 'foe' ? null : this.sim.autoHunter(ids, seen.target), n = this.sim.orderAttack(ids, seen.target, queue);
        this.onToast(n ? (seen.kind === 'foe' ? 'Tấn công' : 'Săn') : seen.kind === 'foe' ? 'Chỉ chiến binh mới đánh: tuyển lính ở trại lính' : why ?? noHunter);
      }
      this.markers.push({ x: w.x, y: w.y, age: 0 }); this.ordered(ids); this.onChange(); return;
    }
    // Chọn nhiều: the soldiers hit whatever is clicked, a work of an enemy village or a tree, rock or bush (which gives nothing); the order is absolute. A work of ours is only walked to.
    if (this.multi) {
      const fighters = this.fighters(), N = this.sim.world.size, raw = { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
      const hit = fighters.length ? [this.pickTile(w.x, w.y), raw].find((c) => this.sim.world.inBounds(c.x, c.y) && this.sim.fog.state[c.y * N + c.x] !== 0 && this.sim.obstacleAt(c.x, c.y)?.clear) : undefined;
      if (hit) {
        const label = this.sim.obstacleAt(hit.x, hit.y)!.label;
        if (this.sim.orderBreak(fighters, hit.x, hit.y)) {
          this.onToast(`Tấn công ${label}`);
          this.markers.push({ x: hit.x * TILE + TILE / 2, y: hit.y * TILE + TILE / 2, age: 0 }); this.ordered(fighters);
          ids = ids.filter((id) => !fighters.includes(id)); // the others (villagers) follow the plain order below
          if (!ids.length) { this.onChange(); return; }
        }
      }
    }
    const { x: tx, y: ty } = this.pickTile(w.x, w.y);
    if (!this.sim.world.inBounds(tx, ty)) return;
    // a tree, rock, bush or building site: those who have that job go to it, and a villager with no job takes it if its house has room
    const work = this.sim.orderWork(ids, tx, ty);
    if (work) this.onToast(work.sent ? (work.err ? `${JOB_NAME[work.job]} (${work.err})` : JOB_NAME[work.job]) : work.job === 'build' ? 'Chỉ thợ xây của Nhà thợ xây mới xây: chọn thợ ở nhà đó' : work.err ?? `Dân đã có nghề khác: chỉ đổi nghề ở công trình của nghề ${JOB_NAME[work.job].toLowerCase()}`);
    else this.sim.orderMove(ids, tx, ty, queue);
    this.markers.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, age: 0 });
    this.ordered(ids);
    if (work?.sent) this.releaseCivilians(queue); // a job lets the villager go; plain moves keep them chosen so they can be sent on again
    this.onChange();
  }

  /** Send the selection to a point, fighting whatever it meets on the way. */
  attackMove(p: { x: number; y: number }, queue = false): void {
    this.attackMoveArmed = false;
    if (!this.selected.size) { this.onChange(); return; }
    this.hushCard = true;
    const w = this.r.screenToWorld(p.x, p.y);
    this.sim.orderAttackMove([...this.selected], w.x / TILE, w.y / TILE, queue);
    this.ordered([...this.selected]);
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

  selectAll(): void { this.sim.villagers.forEach((v) => { if (v.inside === null) this.selected.add(v.id); }); this.selectedBuilding = null; this.onChange(); }
  clearSelection(): void { this.selected.clear(); this.selectedBuilding = null; this.inspect = null; this.onChange(); }
  setMulti(on: boolean): void { this.multi = on; this.box = null; if (on) this.onToast('Chọn nhiều: chạm giữ một chút rồi kéo để chọn vùng; vuốt nhanh để di chuyển bản đồ'); this.onChange(); }

  // ---------------------------------------------------------------- camera
  centerOn(wx: number, wy: number): void {
    this.cam.x = wx - this.r.w / this.cam.zoom / 2; this.cam.y = wy - this.r.h / this.cam.zoom / 2; this.clamp();
  }

  /** The tile the middle of the screen looks at. */
  viewTile(): { x: number; y: number } { const w = this.r.screenToWorld(this.r.w / 2, this.r.h / 2); return { x: w.x / TILE, y: w.y / TILE }; }

  focusSelection(): void {
    const vs = this.sim.villagers.filter((v) => v.inside === null && (!this.selected.size || this.selected.has(v.id)));
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
    if (k === 'escape') { if (this.attackMoveArmed) { this.attackMoveArmed = false; this.onChange(); } else if (this.placing) this.cancelPlacing(); else if (this.groupMode) this.endGroup(); else this.clearSelection(); return; }
    if (k === 'r' && this.groupMode) { this.rotateGroup(); return; }
    if (/^[1-9]$/.test(k) && !e.shiftKey) { this.group(Number(k), e.ctrlKey || e.metaKey); e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'f' && this.fighters().length) { this.attackMoveArmed = true; this.onToast('Chọn điểm đến (chuột trái); Esc để hủy'); this.onChange(); return; }
    if (k === 'h' && this.fighters().length) { this.sim.orderHold(this.fighters()); this.onToast('Giữ vị trí'); this.onChange(); return; }
    if (k === 'g' && this.fighters().length) { this.sim.orderStop(this.fighters()); this.onToast('Dừng'); this.onChange(); return; }
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
