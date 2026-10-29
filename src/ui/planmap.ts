import { WEAPONS } from '../sim/combat';
import { ARM_NAME, armOfWeapon, Drawn, drawFormation, FORMATION_IDS, FORMATIONS, FormationId, formationOffsets, SQUAD_MAX, SQUAD_MIN } from '../sim/formations';
import type { IntelMark, Mission, Plan, Pt, TribeIntel } from '../sim/model';
import type { Sim } from '../sim/sim';
import type { RouteTime } from '../sim/warplan';
import { Tile } from '../sim/world';
import { h } from './dom';

/** How far from the camp the arrow of the way in starts, in tiles. */
const ARROW_FROM = 27;
/** Pixels a tile takes in the picture of the ground; it is scaled to the zoom. */
const T = 16;
const MIN_K = 4, MAX_K = 64;
/** Press this long (ms) on the map, without moving, and the ring of formations opens. */
const HOLD_MS = 450;
/** The ring of formations: how far its items lie from the press, and how big each is, in pixels. */
const RING = 100, ITEM = 38;
const MARK_NAME: Record<IntelMark, string> = { civ: 'Dân thường', unknown: 'Có người (chưa rõ loại)', foot: ARM_NAME.foot, archer: ARM_NAME.archer, cavalry: ARM_NAME.cavalry };
const MARK_COLOR: Record<IntelMark, string> = { civ: '#d8d2c0', unknown: '#b9b2a0', foot: '#e0452a', archer: '#e0452a', cavalry: '#e0452a' };
const WORK_COLOR: Record<string, string> = { fire: '#f08a24', tower: '#6b4a2a', pile: '#a9743a', fence: '#8a6a3a', gate: '#e8d18a' };
const LEVEL_NOTE = [
  '',
  'Cấp 1 (lược đồ): chỉ biết vị trí, số dân ước chừng và hướng vào làng. Cử thêm trinh sát để biết địa hình và công trình.',
  'Cấp 2 (địa hình): thấy đất, rừng, nước, công trình phòng thủ và bóng người; chưa biết ai là lính. Cấp 3 cho số lính từng loại, kho và thủ lĩnh.',
  'Cấp 3 (đội hình): thấy cả lính từng loại, kho lương và thủ lĩnh.',
];

/** What a drag or a press does: move the map; edit a formation; take cells out; draw its arrow; draw its way back. */
export type DrawMode = 'pan' | 'edit' | 'trim' | 'path' | 'retreat';
/** What the player is doing on the map: which squad is chosen and what a drag draws for it. */
export interface MapUi { selected: number; mode: DrawMode; modeSquad: number }
export interface MapEvents {
  onSelect(squad: number): void;
  /** Something to tell the player (a formation not yet researched). */
  onNotice(text: string): void;
  /** A new squad: the formation picked from the ring, the drag that shaped it (from o to p), and the cells and facing that drag made. */
  onNew(kind: FormationId, o: Pt, p: Pt, cells: Pt[], heading: number): void;
  /** A squad that exists is put down again or stretched: its new cells, from a new drag. */
  onReshape(squad: number, o: Pt, p: Pt, cells: Pt[], heading: number): void;
  /** A cell is taken out of a squad's formation. */
  onTrim(squad: number, index: number): void;
  /** The whole arrow (or way back) of a squad, after a handle was moved, a point added or one taken out. */
  onPath(squad: number, pts: Pt[], retreat: boolean): void;
}

export function fmtTime(sec: number): string {
  const s = Math.round(sec);
  return s < 60 ? `${s} giây` : `${Math.floor(s / 60)} phút ${s % 60} giây`;
}
const fmtShort = (sec: number): string => { const s = Math.round(sec); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** A fixed 0..1 number for a tile, so the ground looks the same each time it is painted. */
function hash(x: number, y: number, salt = 0): number {
  let n = (x * 374761393 + y * 668265263 + salt * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function drawMark(ctx: CanvasRenderingContext2D, mark: IntelMark, px: number, py: number, u: number, fill = MARK_COLOR[mark]): void {
  ctx.fillStyle = fill; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1.2;
  const r = 3.6 * u;
  ctx.beginPath();
  if (mark === 'foot') ctx.rect(px - r, py - r, 2 * r, 2 * r);
  else if (mark === 'archer') { ctx.moveTo(px, py - r - 1); ctx.lineTo(px + r + 1, py + r); ctx.lineTo(px - r - 1, py + r); ctx.closePath(); }
  else if (mark === 'cavalry') { ctx.moveTo(px, py - r - 1); ctx.lineTo(px + r + 1, py); ctx.lineTo(px, py + r + 1); ctx.lineTo(px - r - 1, py); ctx.closePath(); }
  else ctx.arc(px, py, (mark === 'civ' ? 2.4 : 3) * u, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = '#fff'): void {
  ctx.font = `bold ${Math.round(size)}px sans-serif`; ctx.textAlign = 'center'; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 3; ctx.fillStyle = color;
  ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
}

/** Paint the ground of a box tile by tile: grass with tufts, round trees, rocks, berry bushes, water with ripples, packed earth where there are works. */
function paintGround(g: CanvasRenderingContext2D, sim: Sim, i: TribeIntel): void {
  const { box } = i, N = sim.world.size, w = sim.world;
  for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) {
    const px = (x - box.x0) * T, py = (y - box.y0) * T, t = w.tiles[y * N + x], shade = (hash(x, y) - 0.5) * 14;
    const col = (r: number, gg: number, b: number) => `rgb(${Math.round(r + shade)},${Math.round(gg + shade)},${Math.round(b + shade)})`;
    const base = t === Tile.Water ? col(63, 111, 154) : t === Tile.Mud ? col(122, 100, 66) : t === Tile.Rock ? col(124, 130, 120) : col(134, 163, 85);
    g.fillStyle = base; g.fillRect(px, py, T, T);
    if (w.occ[y * N + x]) { g.fillStyle = col(150, 130, 90); g.fillRect(px, py, T, T); g.fillStyle = 'rgba(70,50,25,0.35)'; for (let k = 0; k < 3; k++) g.fillRect(px + hash(x, y, k + 3) * (T - 2), py + hash(x, y, k + 7) * (T - 2), 2, 2); continue; }
    if (t === Tile.Grass || t === Tile.Bush || t === Tile.Tree) {
      g.strokeStyle = 'rgba(70,100,40,0.55)'; g.lineWidth = 1; g.beginPath();
      for (let k = 0; k < 2; k++) { const tx = px + 2 + hash(x, y, k + 11) * (T - 4), ty = py + 4 + hash(x, y, k + 13) * (T - 6); g.moveTo(tx, ty); g.lineTo(tx - 1, ty - 3); g.moveTo(tx, ty); g.lineTo(tx + 1.5, ty - 3); }
      g.stroke();
    }
    if (t === Tile.Tree) {
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(px + T / 2 + 1, py + T - 3, T * 0.36, T * 0.14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a3d22'; g.fillRect(px + T / 2 - 1.5, py + T * 0.55, 3, T * 0.35);
      g.fillStyle = col(36, 76, 30); g.beginPath(); g.arc(px + T / 2, py + T * 0.4, T * 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = col(62, 110, 44); g.beginPath(); g.arc(px + T / 2 - 2, py + T * 0.34, T * 0.22, 0, Math.PI * 2); g.fill();
    } else if (t === Tile.Rock) {
      g.fillStyle = col(96, 102, 104); g.beginPath(); g.moveTo(px + 2, py + T - 3); g.lineTo(px + 4, py + 5); g.lineTo(px + T * 0.55, py + 2); g.lineTo(px + T - 2, py + 7); g.lineTo(px + T - 3, py + T - 3); g.closePath(); g.fill();
      g.fillStyle = col(150, 156, 156); g.beginPath(); g.moveTo(px + 5, py + 6); g.lineTo(px + T * 0.55, py + 3); g.lineTo(px + T * 0.6, py + 8); g.lineTo(px + 6, py + 9); g.closePath(); g.fill();
    } else if (t === Tile.Bush) {
      g.fillStyle = col(52, 104, 42); g.beginPath(); g.arc(px + T / 2, py + T * 0.58, T * 0.34, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c0392b'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(px + 4 + hash(x, y, k + 21) * (T - 8), py + 6 + hash(x, y, k + 23) * (T - 10), 1.5, 0, Math.PI * 2); g.fill(); }
    } else if (t === Tile.Water) {
      g.strokeStyle = 'rgba(210,235,255,0.55)'; g.lineWidth = 1; g.beginPath();
      for (let k = 0; k < 2; k++) { const wy = py + 4 + k * 7 + hash(x, y, k + 31) * 2, wx = px + 1 + hash(x, y, k + 33) * 4; g.moveTo(wx, wy); g.quadraticCurveTo(wx + 3, wy - 2, wx + 6, wy); g.quadraticCurveTo(wx + 9, wy + 2, wx + 12, wy); }
      g.stroke();
    } else if (t === Tile.Mud) {
      g.fillStyle = 'rgba(60,40,20,0.35)'; for (let k = 0; k < 3; k++) g.fillRect(px + hash(x, y, k + 41) * (T - 3), py + hash(x, y, k + 43) * (T - 3), 3, 2);
    }
  }
}

/** The little picture of a formation on its button in the ring: seven dots as they stand, facing up. */
function glyph(ctx: CanvasRenderingContext2D, kind: FormationId, cx: number, cy: number, color: string): void {
  const offs = formationOffsets(kind, 7), s = 4.2, mx = offs.reduce((a, o) => a + o[0], 0) / offs.length, my = offs.reduce((a, o) => a + o[1], 0) / offs.length;
  ctx.fillStyle = color;
  for (const [fx, fy] of offs) { ctx.beginPath(); ctx.arc(cx + (fy - my) * s, cy - (fx - mx) * s, 2.1, 0, Math.PI * 2); ctx.fill(); }
}

/**
 * The enemy camp and the 24 tiles round it, full-size and movable: drag to move, wheel or two fingers to zoom.
 * It draws what the map held of the village shows, as the scouts saw it. On it the player makes squads (hold a point, pick a formation from the ring,
 * drag out the cells) and draws the plan: where each squad stands, the arrow it follows and the way it falls back. Pressing a work or a man tells what he is.
 */
export class PlanMapView {
  readonly root = h('div', { class: 'pview' });
  private readonly canvas = h('canvas', { class: 'planmap' });
  private readonly pop = h('div', { class: 'ppop', hidden: true });
  private readonly note = h('div', { class: 'pnote', hidden: true });
  private readonly ground = document.createElement('canvas');
  private groundKey = '';
  private intel: TribeIntel | null = null;
  private tribe = ''; private plan: Plan | undefined;
  private ui: MapUi = { selected: -1, mode: 'pan', modeSquad: -1 };
  private routes = new Map<number, { start: Pt | null; go: RouteTime | null; back: RouteTime | null }>();
  /** Pixels per tile, and the tile at the middle of the screen. */
  private k = 12; private cx = 0; private cy = 0; private W = 0; private H = 0;
  private targets: Array<{ x: number; y: number; r: number; title: string; text: string }> = [];
  private readonly pts = new Map<number, Pt>();
  private gesture: 'none' | 'pan' | 'node' | 'arrow' | 'menu' | 'size' = 'none';
  /** The arrow (or way back) while one of its handles is held: a copy of its points with that one moved, drawn faint and dashed until it is let go. */
  private edit: { pts: Pt[]; retreat: boolean; idx: number } | null = null;
  /** An arrow not yet placed: where its head would go, following the pointer. */
  private arrowAim: Pt | null = null;
  /** The ring of formations while it is open: where it was pressed (screen), where it sits, the same place on the ground, and the item under the finger. */
  private ring: { press: Pt; centre: Pt; world: Pt; hover: number } | null = null;
  /** A formation picked from the ring, waiting for the drag that sizes it. */
  private making: { kind: FormationId; at: Pt } | null = null;
  /** While a formation is being shaped: where the finger is on the ground, and where the drag began. */
  private aim: Pt | null = null; private sizeFrom: Pt | null = null;
  /** Editing a formation: the white dot at its origin has been picked up, and the whole shape moves with the pointer. */
  private moving: { o0: Pt; p0: Pt; grab: Pt } | null = null;
  private hold: ReturnType<typeof setTimeout> | null = null;
  private downAt: Pt = { x: 0, y: 0 }; private moved = false; private pinch = 0; private queued = false;

  constructor(private readonly sim: Sim, private readonly ev: MapEvents) {
    this.root.append(this.canvas, this.pop, this.note);
    const at = (e: { clientX: number; clientY: number }): Pt => { const b = this.canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture?.(e.pointerId);
      const p = at(e); this.pts.set(e.pointerId, p); this.downAt = p; this.moved = false; this.pinch = 0; this.stopHold();
      if (this.pts.size > 1) { this.gesture = 'pan'; this.edit = null; this.ring = null; this.aim = null; return; }
      const w = this.world(p), left = e.button === 0, ui = this.ui, arrows = (ui.mode === 'path' || ui.mode === 'retreat') && !!this.plan;
      if (!left) { // a right press on a point of the arrow takes that point out; elsewhere it moves the map
        const hit = arrows ? this.handleAt(p) : null;
        if (hit?.kind === 'vertex') { const list = this.listOf(ui.mode === 'retreat'); this.ev.onPath(ui.modeSquad, list.filter((_, i) => i !== hit.idx), ui.mode === 'retreat'); this.gesture = 'none'; return; }
        this.gesture = 'pan';
      }
      else if (this.making) { this.gesture = 'size'; this.aim = w; this.sizeFrom = this.making.at; }
      else if (ui.mode === 'edit' && this.deployOf(ui.modeSquad)) {
        const dep = this.deployOf(ui.modeSquad)!;
        this.gesture = 'size'; this.aim = w; this.sizeFrom = dep.o;
        if (dist(this.scr(dep.o), p) < 16) this.moving = { o0: dep.o, p0: dep.p, grab: w }; // the dot at the origin is picked up: the shape moves
      }
      else if (arrows) {
        const retreat = ui.mode === 'retreat', list = this.listOf(retreat), hit = this.handleAt(p);
        if (hit) { // a handle of the arrow: a point is picked up, or the middle of a leg, which bends there
          const pts = list.map((q) => ({ ...q }));
          if (hit.kind === 'mid') pts.splice(hit.idx, 0, this.clampInBox(w));
          this.edit = { pts, retreat, idx: hit.idx }; this.gesture = 'node';
        } else if (!list.length) { this.gesture = 'arrow'; this.arrowAim = this.clampInBox(w); } // the first leg goes straight to where the pointer is
        else this.gesture = 'pan';
      }
      else {
        this.gesture = 'pan';
        if (this.intel && ui.mode === 'pan' && this.inBox(w)) this.hold = setTimeout(() => this.openRing(), HOLD_MS); // a press that stays still opens the ring
      }
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const prev = this.pts.get(e.pointerId);
      if (!prev) { this.hover(at(e)); return; } // a mouse moving with no button down
      const cur = at(e); this.pts.set(e.pointerId, cur);
      if (Math.hypot(cur.x - this.downAt.x, cur.y - this.downAt.y) > 6) { this.moved = true; if (this.gesture === 'pan') this.stopHold(); }
      if (this.pts.size === 2) {
        const [a, b] = [...this.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch > 0 && d > 0) this.zoom(d / this.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinch = d;
      } else if (this.gesture === 'pan') {
        this.cx -= (cur.x - prev.x) / this.k; this.cy -= (cur.y - prev.y) / this.k; this.limit();
      } else if (this.gesture === 'menu' && this.ring) {
        this.ring.hover = this.itemAt(cur);
      } else if (this.gesture === 'size') {
        this.aim = this.world(cur);
      } else if (this.gesture === 'node' && this.edit) {
        this.edit.pts[this.edit.idx] = this.clampInBox(this.world(cur));
      } else if (this.gesture === 'arrow') {
        this.arrowAim = this.clampInBox(this.world(cur));
      }
      this.redraw();
    });
    const up = (e: PointerEvent) => {
      if (!this.pts.has(e.pointerId)) return;
      const alone = this.pts.size === 1, ok = e.type === 'pointerup' && alone;
      this.stopHold();
      if (ok) {
        if (this.gesture === 'menu') this.pickFromRing();
        else if (this.gesture === 'size') this.finishSize();
        else if (this.gesture === 'node') this.finishNode();
        else if (this.gesture === 'arrow') this.finishArrow(this.clampInBox(this.world(at(e))));
        else if (this.gesture === 'pan' && !this.moved) this.click(at(e));
      }
      this.pts.delete(e.pointerId); this.pinch = 0;
      if (!this.pts.size) { this.gesture = 'none'; this.edit = null; this.moving = null; this.ring = null; this.syncShape(); this.redraw(); }
    };
    this.canvas.addEventListener('pointerup', up); this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); const p = at(e); this.zoom(Math.exp(-e.deltaY * 0.0015), p.x, p.y); this.redraw(); }, { passive: false });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { this.resize(); this.draw(); }).observe(this.root);
  }

  /** Show the map of a village with the plan on it (call again whenever either, or what the player is doing, changes). */
  show(tribe: string, plan: Plan | undefined, ui: MapUi): void {
    const changed = tribe !== this.tribe;
    this.tribe = tribe; this.plan = plan; this.ui = ui;
    this.intel = this.sim.tribeIntel(tribe);
    this.routes.clear();
    for (const m of plan?.missions ?? []) {
      const s = this.sim.squadById(m.squad), start = this.sim.missionStart(m);
      if (!s || !start) continue;
      const go = m.path.length ? this.sim.routeTime(s, start, m.path) : null, from = m.path.length ? m.path[m.path.length - 1] : start;
      this.routes.set(m.squad, { start, go, back: m.retreat.length ? this.sim.routeTime(s, from, m.retreat) : null });
    }
    this.canvas.style.cursor = ui.mode === 'pan' ? 'grab' : ui.mode === 'trim' ? 'pointer' : 'crosshair';
    if (changed) { this.pop.hidden = true; this.making = null; }
    this.syncShape();
    if (!(ui.mode === 'path' || ui.mode === 'retreat') || this.listOf(ui.mode === 'retreat').length) this.arrowAim = null;
    this.resize();
    if (changed) this.fit();
    this.say();
    this.draw();
  }

  /** Make the whole map fit the screen. */
  fit(): void {
    const i = this.intel; if (!i) return;
    const bw = i.box.x1 - i.box.x0, bh = i.box.y1 - i.box.y0;
    this.k = clamp(Math.min(this.W / bw, this.H / bh) * 0.96, MIN_K, MAX_K);
    this.cx = (i.box.x0 + i.box.x1) / 2; this.cy = (i.box.y0 + i.box.y1) / 2;
    this.redraw();
  }
  zoomBy(f: number): void { this.zoom(f, this.W / 2, this.H / 2); this.redraw(); }

  private resize(): void {
    const w = this.root.clientWidth || 800, hh = this.root.clientHeight || 500, dpr = (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1;
    this.W = w; this.H = hh;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hh * dpr)) { this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(hh * dpr); }
  }

  /** Zoom by a factor, keeping the tile under the screen point where it is. */
  private zoom(f: number, sx: number, sy: number): void {
    const wx = this.cx + (sx - this.W / 2) / this.k, wy = this.cy + (sy - this.H / 2) / this.k;
    this.k = clamp(this.k * f, MIN_K, MAX_K);
    this.cx = wx - (sx - this.W / 2) / this.k; this.cy = wy - (sy - this.H / 2) / this.k;
    this.limit();
  }
  /** Keep the middle of the screen on the map. */
  private limit(): void { const i = this.intel; if (i) { this.cx = clamp(this.cx, i.box.x0, i.box.x1); this.cy = clamp(this.cy, i.box.y0, i.box.y1); } }

  private redraw(): void {
    if (this.queued) return;
    this.queued = true;
    const go = () => { this.queued = false; this.draw(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go); else go();
  }

  private sx(x: number): number { return (x - this.cx) * this.k + this.W / 2; }
  private sy(y: number): number { return (y - this.cy) * this.k + this.H / 2; }
  private world(p: Pt): Pt { return { x: this.cx + (p.x - this.W / 2) / this.k, y: this.cy + (p.y - this.H / 2) / this.k }; }
  private scr(p: Pt): Pt { return { x: this.sx(p.x), y: this.sy(p.y) }; }
  private inBox(w: Pt): boolean { const b = this.intel!.box; return w.x >= b.x0 && w.x < b.x1 && w.y >= b.y0 && w.y < b.y1; }

  // ---------------------------------------------------------------- the ring of formations
  private stopHold(): void { if (this.hold !== null) { clearTimeout(this.hold); this.hold = null; } }

  /** A formation is waiting for its drag (or its editing): the shape follows the pointer as soon as it moves, a mouse needing no button held. */
  private hover(p: Pt): void {
    const ui = this.ui, w = this.world(p);
    if ((ui.mode === 'path' || ui.mode === 'retreat') && this.plan) { // an arrow not placed yet follows the pointer, straight
      if (!this.listOf(ui.mode === 'retreat').length) { this.arrowAim = this.clampInBox(w); this.redraw(); }
      return;
    }
    if (this.making) { this.sizeFrom = this.making.at; this.aim = w; }
    else if (ui.mode === 'edit' && this.deployOf(ui.modeSquad)) {
      const dep = this.deployOf(ui.modeSquad)!;
      if (dist(this.scr(dep.o), p) < 16) { this.sizeFrom = dep.o; this.aim = dep.p; } // over the dot at the origin: the shape stays as it is
      else { this.sizeFrom = dep.o; this.aim = w; }
    } else return;
    this.redraw();
  }

  /** Put the shape on show where nothing has been dragged yet: the origin of a formation just chosen, or the one being edited as it stands. */
  private syncShape(): void {
    if (this.gesture === 'size') return;
    if (this.making) { this.sizeFrom = this.making.at; this.aim ??= this.making.at; return; }
    const dep = this.ui.mode === 'edit' ? this.deployOf(this.ui.modeSquad) : null;
    this.sizeFrom = dep ? dep.o : null; this.aim = dep ? dep.p : null;
  }
  private deployOf(id: number): NonNullable<Plan['missions'][number]['deploy']> | null { return this.plan?.missions.find((x) => x.squad === id)?.deploy ?? null; }

  private openRing(): void {
    this.hold = null;
    if (this.gesture !== 'pan' || this.moved || this.pts.size !== 1) return;
    const press = this.downAt, edge = RING + ITEM + 10;
    // near an edge the ring is moved in so that all of it shows; the press stays where it was
    const centre = { x: clamp(press.x, edge, Math.max(edge, this.W - edge)), y: clamp(press.y, edge, Math.max(edge, this.H - edge)) };
    this.ring = { press, centre, world: this.world(press), hover: -1 };
    this.gesture = 'menu';
    this.pop.hidden = true;
    this.redraw();
  }

  private itemCentre(i: number): Pt {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / FORMATION_IDS.length, c = this.ring!.centre;
    return { x: c.x + Math.cos(a) * RING, y: c.y + Math.sin(a) * RING };
  }
  private itemAt(p: Pt): number {
    for (let i = 0; i < FORMATION_IDS.length; i++) if (dist(p, this.itemCentre(i)) <= ITEM + 4) return i;
    return -1;
  }

  /** The finger is lifted over an item: that formation is the one to size. Anywhere else, the ring closes. */
  private pickFromRing(): void {
    const r = this.ring; this.ring = null;
    if (!r || r.hover < 0) return;
    const kind = FORMATION_IDS[r.hover];
    if (!this.sim.formationOpen(kind)) { this.ev.onNotice(`Cần nghiên cứu để dùng ${FORMATIONS[kind].name}`); return; }
    this.making = { kind, at: r.world };
    this.sizeFrom = r.world; this.aim = r.world; // the shape shows at once, from the point pressed
    this.say();
  }

  /** The cells the drag makes right now, in the formation being shaped: a new one from the ring, or the one of the squad being put down again or stretched. */
  private shape(): { d: Drawn; kind: FormationId; o: Pt; p: Pt } | null {
    if (!this.aim || !this.sizeFrom || !this.intel) return null;
    const mode = this.ui.mode, kind = this.making?.kind ?? (mode === 'edit' ? this.sim.squadById(this.ui.modeSquad)?.formation : undefined);
    if (!kind) return null;
    let o = this.sizeFrom, p = this.aim;
    const mv = this.moving;
    if (mv) { const dx = this.aim.x - mv.grab.x, dy = this.aim.y - mv.grab.y; o = { x: mv.o0.x + dx, y: mv.o0.y + dy }; p = { x: mv.p0.x + dx, y: mv.p0.y + dy }; }
    return { d: drawFormation(kind, o, p, this.intel.camp), kind, o, p };
  }

  /** The drag ends: the cells it made become the squad's, if there are 3 or more. Fewer is not allowed, and the formation stays to be dragged again. A tap on the origin calls it off. */
  private finishSize(): void {
    const sh = this.shape(), fresh = !!this.making;
    if (!sh || (!this.moving && dist(sh.o, sh.p) < 1.5)) { this.making = null; this.say(); return; }
    if (sh.d.cells.length < SQUAD_MIN) { this.ev.onNotice(`Cần ít nhất ${SQUAD_MIN} ô: kéo xa hơn (đang có ${sh.d.cells.length})`); return; }
    this.making = null; this.say();
    if (fresh) this.ev.onNew(sh.kind, sh.o, sh.p, sh.d.cells, sh.d.heading);
    else this.ev.onReshape(this.ui.modeSquad, sh.o, sh.p, sh.d.cells, sh.d.heading);
  }

  private say(): void {
    const m = this.making;
    this.note.hidden = !m;
    if (!m) return;
    const how: Record<FormationId, string> = {
      line: 'các ô xếp thành hàng từ điểm đã chọn tới con trỏ', circle: 'điểm đã chọn là tâm, khoảng kéo là bán kính', wedge: 'điểm đã chọn là mũi nhọn, hai cánh chạy về phía con trỏ',
      horns: 'một hàng từ điểm đã chọn tới con trỏ, hai đầu cong ra trước', scatter: 'các ô rải kín khung từ điểm đã chọn tới con trỏ', ambush: 'hai hàng so le từ điểm đã chọn tới con trỏ',
    };
    this.note.replaceChildren(h('b', { text: FORMATIONS[m.kind].name }),
      h('span', { text: `Kéo ra từ điểm đã chọn: ${how[m.kind]} (${SQUAD_MIN} đến ${SQUAD_MAX} ô; dưới ${SQUAD_MIN} ô là ô đỏ, không tạo được). Bấm để chốt; bấm ngay điểm đã chọn là hủy. Lính đưa vào đội sau.` }),
      h('button', { class: 'sm', text: 'Hủy', onclick: () => { this.making = null; this.say(); this.redraw(); } }));
  }

  // ---------------------------------------------------------------- pressing
  private click(p: Pt): void {
    if (this.ui.mode === 'trim') { // a press on a cell of the squad being trimmed takes that cell out
      const cs = this.cellsOf(this.ui.modeSquad), at = cs.map((c, i) => ({ i, d: dist(p, this.scr(c)) })).filter((x) => x.d < Math.max(14, this.k * 0.7)).sort((a, b) => a.d - b.d)[0];
      if (at) this.ev.onTrim(this.ui.modeSquad, at.i);
      return;
    }
    // a squad first, then a man, then a work
    const near = (this.plan?.missions ?? []).find((m) => m.deploy && this.cellsOf(m.squad).some((c) => dist(p, this.scr(c)) < Math.max(14, this.k * 0.7)));
    if (near) { this.pop.hidden = true; this.ev.onSelect(near.squad); return; }
    const hit = this.targets.map((t) => ({ t, d: Math.hypot(t.x - p.x, t.y - p.y) })).filter((x) => x.d <= x.t.r).sort((a, b) => a.d - b.d)[0];
    if (hit) { this.showPop(p, hit.t.title, hit.t.text); return; }
    this.pop.hidden = true; this.ev.onSelect(-1);
  }

  private showPop(p: Pt, title: string, text: string): void {
    this.pop.replaceChildren(h('b', { text: title }), h('p', { class: 'sub', text }), h('button', { class: 'sm', text: 'Đóng', onclick: () => { this.pop.hidden = true; } }));
    this.pop.style.left = `${clamp(p.x + 14, 8, Math.max(8, this.W - 280))}px`; this.pop.style.top = `${clamp(p.y + 14, 8, Math.max(8, this.H - 150))}px`;
    this.pop.hidden = false;
  }

  // ---------------------------------------------------------------- the arrow
  private clampInBox(w: Pt): Pt { const b = this.intel?.box; return b ? { x: clamp(w.x, b.x0 + 0.5, b.x1 - 0.5), y: clamp(w.y, b.y0 + 0.5, b.y1 - 0.5) } : w; }

  /** The points of the arrow (or of the way back) of the squad being drawn for. */
  private listOf(retreat: boolean): Pt[] {
    const m = this.plan?.missions.find((x) => x.squad === this.ui.modeSquad);
    return (retreat ? m?.retreat : m?.path) ?? [];
  }
  /** Where a squad's arrow starts now, the arrow being drawn or dragged counting: a circle's starts on its rim on the side the arrow points to. */
  private startOf(m: Mission): Pt | null {
    let toward: Pt | undefined;
    if (this.ui.mode === 'path' && m.squad === this.ui.modeSquad) toward = this.edit && !this.edit.retreat ? this.edit.pts[0] : !m.path.length ? this.arrowAim ?? undefined : undefined;
    return this.sim.missionStart(m, toward);
  }

  /** Where the arrow (or the way back) starts: the middle of the squad, and for the way back the end of the arrow. */
  private baseOf(retreat: boolean): Pt | null {
    const mission = this.plan?.missions.find((x) => x.squad === this.ui.modeSquad), start = mission ? this.startOf(mission) : null, path = this.listOf(false);
    return retreat && path.length ? path[path.length - 1] : start;
  }

  /** The handle of the arrow under a screen point: a point of it (the last is the head), or the middle of one of its legs. */
  private handleAt(p: Pt): { kind: 'vertex' | 'mid'; idx: number } | null {
    const retreat = this.ui.mode === 'retreat', pts = this.listOf(retreat), base = this.baseOf(retreat);
    if (!base || !pts.length) return null;
    const nodes = [base, ...pts];
    for (let i = pts.length - 1; i >= 0; i--) if (dist(p, this.scr(nodes[i + 1])) <= 16) return { kind: 'vertex', idx: i };
    for (let k = 0; k < pts.length; k++) {
      const a = this.scr(nodes[k]), b = this.scr(nodes[k + 1]);
      if (dist(p, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) <= 14) return { kind: 'mid', idx: k };
    }
    return null;
  }

  /** A handle is let go: the arrow takes its new shape (it becomes solid). A press that did not move changes nothing. */
  private finishNode(): void {
    const e = this.edit;
    if (!e || !this.moved) return;
    this.ev.onPath(this.ui.modeSquad, e.pts, e.retreat);
  }
  /** The first leg of an arrow is placed where the pointer was let go. */
  private finishArrow(w: Pt): void {
    const base = this.baseOf(this.ui.mode === 'retreat');
    if (base && dist(base, w) < 1) return;
    this.ev.onPath(this.ui.modeSquad, [w], this.ui.mode === 'retreat');
  }

  // ---------------------------------------------------------------- drawing
  private groundFor(i: TribeIntel): HTMLCanvasElement {
    const key = `${i.tribe}:${i.level}`;
    if (key !== this.groundKey) {
      this.groundKey = key; this.ground.width = (i.box.x1 - i.box.x0) * T; this.ground.height = (i.box.y1 - i.box.y0) * T;
      const g = this.ground.getContext('2d');
      if (g && i.level >= 2) paintGround(g, this.sim, i);
    }
    return this.ground;
  }

  draw(): void {
    const ctx = this.canvas.getContext('2d'), i = this.intel, { plan } = this;
    if (!ctx) return;
    const dpr = this.W ? this.canvas.width / this.W : 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a1510'; ctx.fillRect(0, 0, this.W, this.H);
    this.targets = [];
    if (!i) { label(ctx, 'Chưa có bản đồ làng này', this.W / 2, this.H / 2, 16); return; }
    const k = this.k, u = clamp(k / 12, 0.8, 2.4), { box } = i;
    const bx = this.sx(box.x0), by = this.sy(box.y0), bw = (box.x1 - box.x0) * k, bh = (box.y1 - box.y0) * k;
    ctx.fillStyle = '#d9c9a0'; ctx.fillRect(bx, by, bw, bh); // bare parchment: all a level 1 sketch has
    if (i.level >= 2) { ctx.imageSmoothingEnabled = k < T; ctx.drawImage(this.groundFor(i), bx, by, bw, bh); }
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1; ctx.beginPath(); // a grid every 6 tiles
    for (let x = box.x0; x <= box.x1; x += 6) { ctx.moveTo(this.sx(x), by); ctx.lineTo(this.sx(x), by + bh); }
    for (let y = box.y0; y <= box.y1; y += 6) { ctx.moveTo(bx, this.sy(y)); ctx.lineTo(bx + bw, this.sy(y)); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.sx(i.camp.x), this.sy(i.camp.y), i.yard * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    for (const s of i.structures) this.work(ctx, s, u);
    for (const p of i.people) this.person(ctx, p, u);
    if (i.toUs) { // the way in: from the side where our village lies, towards the camp
      const at = (d: number) => ({ x: this.sx(i.camp.x + i.toUs!.x * d), y: this.sy(i.camp.y + i.toUs!.y * d) }), a = at(ARROW_FROM), b = at(i.yard + 3);
      this.arrowhead(ctx, a.x, a.y, b.x, b.y, '#ffffff', 3, u); label(ctx, 'Đường vào', a.x, a.y - 8, 11 * u);
    }
    if (plan?.kind === 'attack') for (const m of plan.missions) this.squad(ctx, m.squad, u);
    this.preview(ctx, u);
    this.drawRing(ctx);
  }

  private work(ctx: CanvasRenderingContext2D, s: TribeIntel['structures'][number], u: number): void {
    const px = this.sx(s.x), py = this.sy(s.y), pw = s.w * this.k, ph = s.h * this.k, cx = px + pw / 2, cy = py + ph / 2;
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#1a1208'; ctx.fillStyle = WORK_COLOR[s.kind] ?? '#8a6a3a';
    if (s.kind === 'fire') {
      const r = Math.max(pw, ph) / 2;
      ctx.fillStyle = '#6a6358'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // ring of stones
      ctx.fillStyle = '#f08a24'; ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.8); ctx.quadraticCurveTo(cx + r * 0.6, cy, cx, cy + r * 0.5); ctx.quadraticCurveTo(cx - r * 0.6, cy, cx, cy - r * 0.8); ctx.fill();
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(cx, cy + r * 0.1, r * 0.25, 0, Math.PI * 2); ctx.fill();
    } else if (s.kind === 'tower') {
      ctx.beginPath(); ctx.moveTo(cx, py - 2); ctx.lineTo(px + pw + 2, py + ph); ctx.lineTo(px - 2, py + ph); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (s.kind === 'pile') {
      ctx.fillRect(px, py, pw, ph); ctx.strokeRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(40,25,10,0.7)'; ctx.beginPath(); ctx.moveTo(px, py + ph / 2); ctx.lineTo(px + pw, py + ph / 2); ctx.moveTo(px + pw / 2, py); ctx.lineTo(px + pw / 2, py + ph); ctx.stroke();
    } else { ctx.fillRect(px, py, pw, ph); ctx.strokeRect(px, py, pw, ph); }
    this.targets.push({ x: cx, y: cy, r: Math.max(pw, ph) / 2 + 6 * u, title: s.label, text: s.detail });
  }

  private person(ctx: CanvasRenderingContext2D, p: TribeIntel['people'][number], u: number): void {
    const x = this.sx(p.x), y = this.sy(p.y), i = this.intel!;
    if (p.leader) { ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 7.5 * u, 0, Math.PI * 2); ctx.stroke(); }
    drawMark(ctx, p.mark, x, y, u);
    const armed = p.weapon ? `Cầm ${WEAPONS[p.weapon]?.name ?? p.weapon}. ` : '', old = 'Đứng đây lúc trinh sát tới; giờ có thể đã đi chỗ khác.';
    const text = p.leader ? `${armed}Thủ lĩnh của ${i.name}: hạ được ông ta thì làng dễ khuất phục. ${old}` : p.mark === 'unknown' ? `Trinh sát thấy bóng người nhưng chưa rõ lính hay dân: cần bản đồ cấp 3. ${old}` : `${armed}${old}`;
    this.targets.push({ x, y, r: 9 * u, title: p.leader ? `${MARK_NAME[p.mark]} · Thủ lĩnh` : MARK_NAME[p.mark], text });
  }

  private arrowhead(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, w: number, u: number): void {
    const a = Math.atan2(y1 - y0, x1 - x0), s = 10 * u;
    ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - s * Math.cos(a - 0.45), y1 - s * Math.sin(a - 0.45)); ctx.lineTo(x1 - s * Math.cos(a + 0.45), y1 - s * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
  }

  /** A polyline in screen space with an arrowhead at its end, outlined so it shows on any ground. Faint and dashed while it is being dragged. */
  private route(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, u: number, style: 'solid' | 'faint' | 'back'): void {
    if (pts.length < 2) return;
    const trace = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y); };
    const faint = style === 'faint', w = (style === 'back' ? 3 : 4.5) * u * 0.7;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.globalAlpha = faint ? 0.45 : 1;
    ctx.setLineDash(faint ? [10, 8] : []);
    ctx.strokeStyle = 'rgba(20,12,4,0.7)'; ctx.lineWidth = w + 3; trace(); ctx.stroke();
    ctx.strokeStyle = style === 'back' ? '#bfe3ff' : color; ctx.lineWidth = w; trace(); ctx.stroke();
    ctx.setLineDash([]);
    const a = pts[pts.length - 2], b = pts[pts.length - 1], head = 13 * u, ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.fillStyle = style === 'back' ? '#bfe3ff' : color; ctx.strokeStyle = 'rgba(20,12,4,0.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(b.x + Math.cos(ang) * head * 0.5, b.y + Math.sin(ang) * head * 0.5); ctx.lineTo(b.x - Math.cos(ang - 0.6) * head, b.y - Math.sin(ang - 0.6) * head); ctx.lineTo(b.x - Math.cos(ang + 0.6) * head, b.y - Math.sin(ang + 0.6) * head); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** The handles of the arrow being drawn: a dot at each point (the head bigger), and a small ring in the middle of every leg that bends it when pulled. */
  private handles(ctx: CanvasRenderingContext2D, nodes: Pt[], color: string, u: number): void {
    for (let k = 0; k < nodes.length - 1; k++) {
      const a = this.scr(nodes[k]), b = this.scr(nodes[k + 1]);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, 5 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    for (let i = 1; i < nodes.length; i++) {
      const q = this.scr(nodes[i]), head = i === nodes.length - 1;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, (head ? 8 : 6.5) * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  /** The cells of a squad as placed. */
  private cellsOf(id: number): Pt[] { return this.plan?.missions.find((x) => x.squad === id)?.deploy?.cells ?? []; }

  /** Cells of a formation as squares one tile wide: the foot soldiers in front, the archers behind (the soldier's mark inside once the square is big enough). */
  private cells(ctx: CanvasRenderingContext2D, slots: Pt[], arms: Array<'foot' | 'archer' | 'cavalry'>, color: string, u: number, selected: boolean, ghost = false): void {
    const side = Math.max(6, this.k * 0.88);
    ctx.globalAlpha = ghost ? 0.4 : 1;
    slots.forEach((c, j) => {
      const q = this.scr(c);
      ctx.fillStyle = color; ctx.fillRect(q.x - side / 2, q.y - side / 2, side, side);
      ctx.strokeStyle = selected ? '#ffffff' : '#1a1208'; ctx.lineWidth = selected ? 2.5 : 1.5; ctx.strokeRect(q.x - side / 2, q.y - side / 2, side, side);
      if (side >= 12) drawMark(ctx, arms[j] ?? 'foot', q.x, q.y, Math.min(u, side / 12), 'rgba(255,255,255,0.9)');
    });
    ctx.globalAlpha = 1;
  }

  /** A circle whose arrow points into the ring: each soldier is shown marching to the middle, and the label says so. */
  private converge(ctx: CanvasRenderingContext2D, m: Mission, first: Pt | null, color: string, u: number): void {
    const d = m.deploy;
    if (!d || !first || (d.kind ?? this.sim.squadById(m.squad)?.formation) !== 'circle') return;
    const r = dist(d.o, d.p);
    if (dist(d.o, first) >= r) return;
    const c = this.scr(d.o);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5 * u * 0.7; ctx.globalAlpha = 0.95;
    for (const q of d.cells) {
      const a = this.scr(q), e = { x: a.x + (c.x - a.x) * 0.6, y: a.y + (c.y - a.y) * 0.6 }, ang = Math.atan2(e.y - a.y, e.x - a.x), s = 6 * u;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.x + Math.cos(ang) * s, e.y + Math.sin(ang) * s); ctx.lineTo(e.x - Math.cos(ang - 0.6) * s, e.y - Math.sin(ang - 0.6) * s); ctx.lineTo(e.x - Math.cos(ang + 0.6) * s, e.y - Math.sin(ang + 0.6) * s); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    label(ctx, 'Tiến vào tâm', c.x, c.y + 4 * u, 12 * u, '#ffe27a');
  }

  /** One squad on the map: its cells, the arrow it follows with the time of each leg, and the way back. */
  private squad(ctx: CanvasRenderingContext2D, id: number, u: number): void {
    const { sim } = this, s = sim.squadById(id), m = this.plan?.missions.find((x) => x.squad === id);
    if (!s || !m) return;
    const sel = this.ui.selected === id, color = s.color, r = this.routes.get(id);
    const drawing = (this.ui.mode === 'path' || this.ui.mode === 'retreat') && this.ui.modeSquad === id, back = this.ui.mode === 'retreat';
    const dragged = (retreat: boolean) => (drawing && this.edit && this.edit.retreat === retreat ? this.edit.pts : null);
    const goPts = dragged(false) ?? m.path, backPts = dragged(true) ?? m.retreat;
    const pending = drawing && this.arrowAim && !this.listOf(back).length ? this.arrowAim : null; // the first leg, not placed yet
    const start = this.startOf(m);
    if (start && (goPts.length || (pending && !back))) {
      const list = goPts.length ? goPts : [pending!], nodes = [start, ...list], pts = nodes.map((q) => this.scr(q));
      const faint = !!dragged(false) || (!goPts.length && !!pending), t = faint ? sim.routeTime(s, start, list) : r?.go;
      this.route(ctx, pts, color, u, faint ? 'faint' : 'solid');
      t?.legs.forEach((tt, j) => {
        const p = pts[j], q = pts[j + 1], bad = t.blocked[j];
        label(ctx, `${fmtShort(tt)}${bad ? ' ⚠' : ''}`, (p.x + q.x) / 2, (p.y + q.y) / 2 - 12 * u, 11 * u, bad ? '#ff9a8a' : '#fff');
      });
      const end = pts[pts.length - 1];
      if (t) label(ctx, `tới sau ${fmtShort(t.total)}`, end.x, end.y - 16 * u, 11 * u, '#ffe27a');
      if (drawing && !back && goPts.length) this.handles(ctx, nodes, color, u);
      this.converge(ctx, m, goPts.length ? goPts[0] : pending, color, u);
    }
    const base = goPts.length ? goPts[goPts.length - 1] : start;
    if (base && (backPts.length || (pending && back))) {
      const list = backPts.length ? backPts : [pending!], nodes = [base, ...list], pts = nodes.map((q) => this.scr(q));
      const faint = !!dragged(true) || (!backPts.length && !!pending), t = faint ? sim.routeTime(s, base, list) : r?.back;
      this.route(ctx, pts, color, u, faint ? 'faint' : 'back');
      const e = pts[pts.length - 1]; label(ctx, `rút${t ? ` ${fmtShort(t.total)}` : ''}`, e.x, e.y - 16 * u, 11 * u, '#bfe3ff');
      if (drawing && back && backPts.length) this.handles(ctx, nodes, color, u);
    }
    if (m.deploy) {
      const units = sim.squadUnits(s).sort((a, b) => (armOfWeapon(a.weapon) === 'archer' ? 1 : 0) - (armOfWeapon(b.weapon) === 'archer' ? 1 : 0) || a.id - b.id);
      this.cells(ctx, m.deploy.cells, units.map((v) => armOfWeapon(v.weapon)), color, u, sel);
      const c = this.scr(r?.start ?? m.deploy.cells[0]), top = Math.min(...m.deploy.cells.map((q) => this.sy(q.y)));
      label(ctx, `${s.name} · ${m.deploy.cells.length} ô${units.length ? ` · ${units.length} lính` : ''}`, c.x, top - 12 * u, 12 * u, sel ? '#ffe27a' : '#fff');
      if (this.ui.mode === 'trim' && this.ui.modeSquad === id) { // each cell shows a cross: press it to take it out
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath();
        for (const q of m.deploy.cells) { const w = this.scr(q), e = Math.max(3, this.k * 0.28); ctx.moveTo(w.x - e, w.y - e); ctx.lineTo(w.x + e, w.y + e); ctx.moveTo(w.x + e, w.y - e); ctx.lineTo(w.x - e, w.y + e); }
        ctx.stroke();
      }
    }
  }

  /** What is being made right now: the squares the drag makes for the formation, from the point pressed to the finger. */
  private preview(ctx: CanvasRenderingContext2D, u: number): void {
    const sh = this.shape();
    if (sh) {
      const o = this.scr(sh.o), e = this.scr(sh.p), shown = sh.d.cells, ok = shown.length >= SQUAD_MIN, s = this.making ? undefined : this.sim.squadById(this.ui.modeSquad);
      ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.beginPath();
      if (sh.kind === 'circle') ctx.arc(o.x, o.y, dist(o, e), 0, Math.PI * 2); else { ctx.moveTo(o.x, o.y); ctx.lineTo(e.x, e.y); }
      ctx.stroke(); ctx.setLineDash([]);
      this.cells(ctx, shown, Array(shown.length).fill('foot'), ok ? (s?.color ?? '#ffd23a') : '#d9534f', u, true, true);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(o.x, o.y, this.ui.mode === 'edit' ? 6 : 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1.5; ctx.stroke();
      label(ctx, ok ? `${shown.length} ô` : `${shown.length} ô: cần ít nhất ${SQUAD_MIN}`, e.x, e.y - 16 * u, 13 * u, ok ? '#ffe27a' : '#ff9a8a');
    }
  }

  /** The ring of formations, drawn over everything while the finger is held; the one under the finger lights up and tells what it is. */
  private drawRing(ctx: CanvasRenderingContext2D): void {
    const r = this.ring;
    if (!r) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.centre.x, r.centre.y, RING, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.press.x, r.press.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 2; ctx.stroke();
    FORMATION_IDS.forEach((f, i) => {
      const c = this.itemCentre(i), open = this.sim.formationOpen(f), hot = i === r.hover;
      ctx.fillStyle = hot ? (open ? '#ffd23a' : '#a05a50') : open ? 'rgba(40,30,20,0.94)' : 'rgba(40,30,20,0.62)';
      ctx.strokeStyle = hot ? '#fff' : 'rgba(255,255,255,0.75)'; ctx.lineWidth = hot ? 3 : 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, ITEM + (hot ? 4 : 0), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      glyph(ctx, f, c.x, c.y - 9, hot ? '#1a1208' : open ? '#fff' : '#9a9080');
      label(ctx, FORMATIONS[f].name, c.x, c.y + 21, 11, hot ? '#1a1208' : open ? '#fff' : '#9a9080');
    });
    const hot = r.hover >= 0 ? FORMATION_IDS[r.hover] : null;
    if (hot) label(ctx, this.sim.formationOpen(hot) ? FORMATIONS[hot].note : `Cần nghiên cứu: ${FORMATIONS[hot].name}`, this.W / 2, this.H - 24, 13);
  }
}

/** The panel over the map: what the scouts know of the village, the key to the signs, and what each level of map shows. */
export function planMapInfo(sim: Sim, tribeId: string): HTMLElement {
  const i = sim.tribeIntel(tribeId);
  if (!i) return h('p', { class: 'sub', text: 'Chưa có bản đồ làng này: cử trinh sát để vẽ.' });
  const age = i.accuracy >= 0.95 ? 'báo cáo mới' : i.accuracy >= 0.7 ? 'báo cáo hơi cũ' : i.accuracy >= 0.4 ? 'báo cáo đã cũ' : 'báo cáo rất cũ';
  const s = i.soldiers, army = s ? `Lính: ${s.foot} ${ARM_NAME.foot.toLowerCase()}, ${s.archer} ${ARM_NAME.archer.toLowerCase()}, ${s.cavalry} ${ARM_NAME.cavalry.toLowerCase()} · ` : '';
  const items: Array<[string, string]> = [];
  for (const w of i.structures) if (!items.some((x) => x[1] === w.label)) items.push([WORK_COLOR[w.kind] ?? '#8a6a3a', w.label]);
  for (const m of new Set(i.people.map((p) => p.mark))) items.push([MARK_COLOR[m], MARK_NAME[m]]);
  if (i.people.some((p) => p.leader)) items.push(['#ffd23a', 'Thủ lĩnh (vòng vàng)']);
  const legend = h('div', { class: 'btns', style: 'gap:8px;flex-wrap:wrap' }, ...items.map(([color, text]) => h('small', {},
    h('span', { style: `display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;background:${color};border:1px solid #1a1208` }), text)));
  return h('div', { style: 'display:grid;gap:4px' },
    h('div', { class: 'nm' }, h('b', { text: `Bản đồ ${i.name}` }), h('small', { text: `${army}khoảng ${i.population} người · ${age}${i.gaps ? ' · còn hở' : ''}` })),
    h('small', { class: 'sub', text: 'Nhấn giữ một điểm trên bản đồ để lập đội. Bấm vào lửa, kho, lính để xem chú thích.' }),
    h('details', {}, h('summary', { text: 'Chú giải và cấp bản đồ' }), legend, h('small', { class: 'sub', text: `Vùng vẽ: khu trại và 24 ô xung quanh. ${LEVEL_NOTE[i.level]}` })));
}
