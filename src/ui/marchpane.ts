import { ARM_NAME } from '../sim/legion';
import type { MilCell } from '../sim/model';
import { h } from './dom';
import { TERRAIN } from './minimap';
import type { Ctx } from './ctx';

/** Tiles of ground kept in the picture, a square round the village. The picture is a still one, taken when the map is opened (and after a zone is made). */
const WIN = 320;
const MIN_K = 2, MAX_K = 40;
const HOLD_MS = 450;
const ARMS = ['foot', 'archer', 'cavalry'] as const;
const ARM_ICON: Record<MilCell['arm'], string> = { foot: '🛡', archer: '🏹', cavalry: '🐎' };
const ARM_COLOR: Record<MilCell['arm'], string> = { foot: '#4aa3ff', archer: '#5ed37a', cavalry: '#ffb347' };
type Pt = { x: number; y: number };

/**
 * The "Hành quân" tab of the Bãi tập (medieval age) and the full-screen map it opens, made like the map of the war plan (pan with a drag, zoom with the wheel or two fingers, a bar along the top,
 * a ring on a held press). On it the military zones are drawn, squares of soldiers put in them (tap a zone to add one, hold a square for its ring: arm, or take it away), and "Tập trận" gathers
 * the army into the squares. The picture of the ground is a still one. See sim/legion.ts.
 */
export class MarchPane {
  /** The page of the tab: a summary and the button that opens the map. */
  readonly root = h('div', { class: 'march' });
  private readonly summary = h('p', { class: 'sub' });
  private readonly full = h('div', { class: 'modal planfull', hidden: true });
  private readonly view = h('div', { class: 'pview' });
  private readonly canvas = h('canvas', { class: 'planmap' }) as HTMLCanvasElement;
  private readonly note = h('div', { class: 'pnote', hidden: true });
  private readonly ring = h('div', { class: 'ringmenu', hidden: true });
  private readonly state = h('span');
  private readonly zoneChip = h('button', { class: 'chip', type: 'button' }) as HTMLButtonElement;
  private readonly okChip = h('button', { class: 'chip', type: 'button', text: '✓ Xác nhận khu' }) as HTMLButtonElement;
  private readonly drillChip = h('button', { class: 'chip', type: 'button', text: '⚑ Tập trận' }) as HTMLButtonElement;
  private readonly stopChip = h('button', { class: 'chip', type: 'button', text: 'Giải tán đội quân' }) as HTMLButtonElement;
  private readonly ground = document.createElement('canvas');
  private origin: Pt = { x: 0, y: 0 };
  private open_ = false; private zoning = false; private pending: Pt | null = null;
  /** Pixels per tile and the tile at the middle of the screen; the size of the canvas. */
  private k = 8; private cx = 0; private cy = 0; private W = 0; private H = 0;
  private readonly pts = new Map<number, Pt>();
  private gesture: 'none' | 'pan' | 'aim' = 'none';
  private downAt: Pt = { x: 0, y: 0 }; private moved = false; private pinch = 0; private hold: ReturnType<typeof setTimeout> | null = null; private queued = false;

  constructor(private readonly c: Ctx) {
    const { sim, ctl, toast } = c;
    this.ground.width = this.ground.height = WIN;
    this.zoneChip.addEventListener('click', () => { this.zoning = !this.zoning; this.pending = null; this.ring.hidden = true; this.sync(); });
    this.okChip.addEventListener('click', () => {
      if (!this.pending) return;
      const e = sim.createZone(this.pending.x, this.pending.y);
      if (e) { toast(e); return; }
      this.zoning = false; this.pending = null; this.snapshot(); this.sync();
    });
    this.drillChip.addEventListener('click', () => { const e = sim.assemble(); if (e) { toast(e); return; } toast('Tập trận: quân đang tập trung. Khi xong, chạm đất để cả đội hành quân (nút ⚑ Đội quân trên thanh trên)'); ctl.legionControl = true; this.close(); ctl.closeBuilding(); });
    this.stopChip.addEventListener('click', () => { sim.disband(); ctl.legionControl = false; ctl.onChange(); this.sync(); });
    const openBtn = h('button', { class: 'dgo', type: 'button', text: '🗺 Mở bản đồ hành quân', onclick: () => this.open() });
    this.root.append(h('p', { class: 'sub', text: 'Bãi tập là nơi lập quân: vẽ khu quân sự trên bản đồ, đặt các ô lính trong khu, bấm "Tập trận" để cả quân tập trung đúng ô, rồi điều khiển cả đội quân hành quân đều và đẹp.' }), this.summary, h('div', { class: 'btns' }, openBtn));

    const top = h('div', { class: 'ptop' }, h('button', { class: 'chip danger', type: 'button', text: '✕ Đóng', title: 'Đóng bản đồ, về màn hình game', onclick: () => this.close() }), h('div', { class: 'ptitle2' }, h('b', { text: 'Lập quân hành quân' }), this.state),
      h('div', { class: 'pdock' }, this.zoneChip, this.okChip, this.drillChip, this.stopChip));
    const zoom = h('div', { class: 'ptools' }, h('button', { class: 'chip zoom', type: 'button', text: '＋', title: 'Phóng to', onclick: () => { this.zoomBy(1.4, this.W / 2, this.H / 2); this.redraw(); } }), h('button', { class: 'chip zoom', type: 'button', text: '－', title: 'Thu nhỏ', onclick: () => { this.zoomBy(1 / 1.4, this.W / 2, this.H / 2); this.redraw(); } }),
      h('button', { class: 'chip zoom', type: 'button', text: '◎', title: 'Về giữa làng', onclick: () => { this.center(); this.redraw(); } }));
    this.view.append(this.canvas, this.ring, this.note);
    this.full.append(h('div', { class: 'pstage' }, this.view, top, zoom));
    (document.body ?? document.documentElement).append(this.full);

    const at = (e: { clientX: number; clientY: number }): Pt => { const b = this.canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture?.(e.pointerId);
      const p = at(e); this.pts.set(e.pointerId, p); this.downAt = p; this.moved = false; this.pinch = 0; this.stopHold(); this.ring.hidden = true;
      if (this.pts.size > 1) { this.gesture = 'pan'; return; }
      if (this.zoning && e.button === 0) { this.gesture = 'aim'; this.pending = this.tileOf(p); this.sync(); return; } // drawing a zone: the square follows the finger
      this.gesture = 'pan';
      if (e.button === 0) this.hold = setTimeout(() => this.openRing(p), HOLD_MS); // a press that stays still opens the ring
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const prev = this.pts.get(e.pointerId); if (!prev) return;
      const cur = at(e); this.pts.set(e.pointerId, cur);
      if (Math.hypot(cur.x - this.downAt.x, cur.y - this.downAt.y) > 6) { this.moved = true; this.stopHold(); }
      if (this.pts.size === 2) {
        const [a, b] = [...this.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch > 0 && d > 0) this.zoomBy(d / this.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinch = d;
      } else if (this.gesture === 'aim') { this.pending = this.tileOf(cur); this.sync(); }
      else if (this.gesture === 'pan') { this.cx -= (cur.x - prev.x) / this.k; this.cy -= (cur.y - prev.y) / this.k; this.limit(); }
      this.redraw();
    });
    const up = (e: PointerEvent) => {
      if (!this.pts.has(e.pointerId)) return;
      const alone = this.pts.size === 1;
      this.stopHold();
      if (alone && e.type === 'pointerup' && this.gesture === 'pan' && !this.moved && this.ring.hidden) this.tap(this.tileOf(at(e)));
      this.pts.delete(e.pointerId); this.pinch = 0;
      if (!this.pts.size) this.gesture = 'none';
      this.redraw();
    };
    this.canvas.addEventListener('pointerup', up); this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); const p = at(e); this.zoomBy(Math.exp(-e.deltaY * 0.0015), p.x, p.y); this.redraw(); }, { passive: false });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { this.resize(); this.draw(); }).observe(this.view);
  }

  get mapOpen(): boolean { return this.open_; }
  open(): void {
    this.open_ = true; this.zoning = false; this.pending = null; this.ring.hidden = true;
    this.full.hidden = false; this.snapshot(); this.center(); this.resize(); this.sync(); this.draw();
  }
  close(): void { this.open_ = false; this.full.hidden = true; this.ring.hidden = true; }

  // ---------------------------------------------------------------- the picture and the view
  /** Take the still picture of the ground round the village: what is known now, and what the zones have cleared. */
  private snapshot(): void {
    const { sim } = this.c, N = sim.world.size, f = sim.campfire();
    const mx = f ? f.x + 1 : sim.world.start.x, my = f ? f.y + 1 : sim.world.start.y;
    this.origin = { x: Math.max(0, Math.min(N - WIN, Math.round(mx - WIN / 2))), y: Math.max(0, Math.min(N - WIN, Math.round(my - WIN / 2))) };
    const bctx = this.ground.getContext('2d')!, img = bctx.createImageData(WIN, WIN), d = img.data;
    for (let j = 0; j < WIN; j++) for (let i = 0; i < WIN; i++) {
      const k = (this.origin.y + j) * N + this.origin.x + i, c = sim.world.occ[k] ? [200, 150, 80] : TERRAIN[sim.world.tiles[k]] ?? [90, 90, 90], s = sim.fog.state[k], m = s === 2 ? 1 : s === 1 ? 0.6 : 0.12, o = (j * WIN + i) * 4;
      d[o] = c[0] * m + 8 * (1 - m); d[o + 1] = c[1] * m + 10 * (1 - m); d[o + 2] = c[2] * m + 20 * (1 - m); d[o + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);
  }

  private center(): void {
    const { sim } = this.c, f = sim.campfire();
    this.cx = f ? f.x + 1 : sim.world.start.x; this.cy = f ? f.y + 1 : sim.world.start.y;
    this.k = Math.max(MIN_K, Math.min(MAX_K, Math.min(this.W || 800, this.H || 500) / 90));
    this.limit();
  }
  private resize(): void {
    const w = this.view.clientWidth || 800, hh = this.view.clientHeight || 500, dpr = window.devicePixelRatio || 1;
    this.W = w; this.H = hh;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hh * dpr)) { this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(hh * dpr); }
    this.limit();
  }
  private limit(): void {
    this.cx = Math.max(this.origin.x, Math.min(this.origin.x + WIN, this.cx)); this.cy = Math.max(this.origin.y, Math.min(this.origin.y + WIN, this.cy));
  }
  private zoomBy(f: number, sx: number, sy: number): void {
    const before = { x: (sx - this.W / 2) / this.k + this.cx, y: (sy - this.H / 2) / this.k + this.cy };
    this.k = Math.max(MIN_K, Math.min(MAX_K, this.k * f));
    this.cx = before.x - (sx - this.W / 2) / this.k; this.cy = before.y - (sy - this.H / 2) / this.k; this.limit();
  }
  private tileOf(p: Pt): Pt { return { x: Math.floor((p.x - this.W / 2) / this.k + this.cx), y: Math.floor((p.y - this.H / 2) / this.k + this.cy) }; }
  private sx(x: number): number { return (x - this.cx) * this.k + this.W / 2; }
  private sy(y: number): number { return (y - this.cy) * this.k + this.H / 2; }
  private stopHold(): void { if (this.hold) clearTimeout(this.hold); this.hold = null; }
  private redraw(): void { if (this.queued) return; this.queued = true; requestAnimationFrame(() => { this.queued = false; this.draw(); }); }

  // ---------------------------------------------------------------- what a press does
  private cellAt(t: Pt): MilCell | undefined { return this.c.sim.cells.find((q) => t.x >= q.x && t.x < q.x + 5 && t.y >= q.y && t.y < q.y + 5); }

  /** A tap on a zone adds a square of soldiers (bộ binh); a tap on a square does nothing: hold it for its ring. */
  private tap(t: Pt): void {
    const { sim, toast } = this.c;
    if (this.cellAt(t) || !sim.inZone(t.x, t.y)) return;
    const e = sim.addCell(t.x, t.y, 'foot'); if (e) toast(e);
    this.sync();
  }

  /** The ring in a circle round a held square (its arm, or take it away), or round a held zone (take it away). */
  private openRing(p: Pt): void {
    this.hold = null;
    const { sim } = this.c, t = this.tileOf(p), cell = this.cellAt(t), zone = sim.zones.find((z) => t.x >= z.x && t.x < z.x + z.w && t.y >= z.y && t.y < z.y + z.h);
    if (!cell && !zone) return;
    const items: Array<{ icon: string; title: string; run: () => void }> = cell
      ? [...ARMS.map((a) => ({ icon: ARM_ICON[a], title: ARM_NAME[a], run: () => sim.setCellArm(cell.id, a) })), { icon: '✕', title: 'Xóa ô', run: () => sim.setCellArm(cell.id, null) }]
      : [{ icon: '✕', title: 'Xóa khu quân sự (và các ô trong khu)', run: () => sim.removeZone(zone!.id) }];
    const r = 62;
    this.ring.replaceChildren(...items.map((it, i) => {
      const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
      return h('button', { class: 'rbtn', type: 'button', text: it.icon, title: it.title, style: `left:${p.x + Math.cos(a) * r}px;top:${p.y + Math.sin(a) * r}px`, onclick: () => { it.run(); this.ring.hidden = true; this.sync(); this.redraw(); } });
    }));
    this.ring.hidden = false;
  }

  // ---------------------------------------------------------------- drawing
  /** Bring the bar, the note and the page of the tab in line with the state. */
  sync(): void {
    const { sim } = this.c, ready = sim.era === 'ancient' || sim.dev.freeBuild;
    const have = (a: MilCell['arm']) => sim.villagers.filter((v) => v.job === 'fight' && !v.guard && v.post < 0 && v.arm === a).length;
    const line = `Khu: ${sim.zones.length} · ${ARMS.map((a) => `${ARM_NAME[a]}: ${sim.cells.filter((q) => q.arm === a).length} ô / ${have(a)} lính`).join(' · ')}${sim.legion.on ? ` · Đội quân ${Object.keys(sim.legion.slots).length} lính${sim.legion.assembling ? ' (đang tập trung)' : ''}` : ''}`;
    this.summary.textContent = ready ? line : 'Khu quân sự và hành quân chỉ có ở thời Trung cổ.';
    this.state.textContent = line;
    this.zoneChip.textContent = this.zoning ? '✕ Hủy vẽ khu' : '＋ Tạo khu quân sự'; this.zoneChip.disabled = !ready;
    this.okChip.hidden = !this.zoning; this.drillChip.disabled = !ready || !sim.cells.length; this.stopChip.hidden = !sim.legion.on;
    const err = this.zoning && this.pending ? sim.zoneError(this.pending.x, this.pending.y) : null;
    this.okChip.disabled = !this.pending || !!err;
    const msg = !ready ? 'Chỉ lập được khu quân sự ở thời Trung cổ.' : this.zoning ? (err ?? (this.pending ? 'Khu hợp lệ: bấm "Xác nhận khu".' : 'Chạm hoặc kéo trên bản đồ để đặt khung 30×30 ô.')) : sim.zones.length ? 'Chạm vào khu để đặt ô lính (5×5). Nhấn giữ ô để chọn loại lính hoặc xóa; nhấn giữ khu để xóa khu.' : 'Bấm "Tạo khu quân sự" để vẽ khu đầu tiên quanh làng.';
    this.note.textContent = msg; this.note.hidden = !msg; this.note.classList.toggle('why', !!err || !ready);
  }

  /** Called while the building panel is open (the tab), so that the page and the open map follow the game. */
  private key = '';
  update(): void {
    const { sim } = this.c, key = `${sim.era}|${sim.zones.length}|${sim.cells.map((q) => q.arm).join('')}|${sim.legion.on}|${sim.legion.assembling}|${Object.keys(sim.legion.slots).length}|${sim.villagers.length}`;
    if (key !== this.key) { this.key = key; this.sync(); } // only when something changed: a button redrawn under the finger would lose the press
    if (this.open_) this.redraw();
  }

  draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || !this.open_) return;
    const { sim } = this.c, k = this.k, dpr = this.W ? this.canvas.width / this.W : 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a1510'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.ground, 0, 0, WIN, WIN, this.sx(this.origin.x), this.sy(this.origin.y), WIN * k, WIN * k);
    for (const z of sim.zones) {
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(this.sx(z.x), this.sy(z.y), z.w * k, z.h * k);
      if (k >= 6) { ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 5; i < z.w; i += 5) { ctx.moveTo(this.sx(z.x + i), this.sy(z.y)); ctx.lineTo(this.sx(z.x + i), this.sy(z.y + z.h)); ctx.moveTo(this.sx(z.x), this.sy(z.y + i)); ctx.lineTo(this.sx(z.x + z.w), this.sy(z.y + i)); } ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(this.sx(z.x), this.sy(z.y), z.w * k, z.h * k);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.max(10, Math.min(36, k * 2.4))}px sans-serif`;
    for (const q of sim.cells) {
      ctx.fillStyle = `${ARM_COLOR[q.arm]}88`; ctx.fillRect(this.sx(q.x), this.sy(q.y), 5 * k, 5 * k);
      ctx.strokeStyle = ARM_COLOR[q.arm]; ctx.lineWidth = 2; ctx.strokeRect(this.sx(q.x), this.sy(q.y), 5 * k, 5 * k);
      ctx.fillStyle = '#fff'; ctx.fillText(ARM_ICON[q.arm], this.sx(q.x + 2.5), this.sy(q.y + 2.5));
    }
    if (this.zoning && this.pending) {
      const x = Math.round(this.pending.x - 15), y = Math.round(this.pending.y - 15), bad = !!sim.zoneError(this.pending.x, this.pending.y);
      ctx.fillStyle = bad ? 'rgba(255,90,74,.22)' : 'rgba(111,224,138,.22)'; ctx.fillRect(this.sx(x), this.sy(y), 30 * k, 30 * k);
      ctx.strokeStyle = bad ? '#ff5a4a' : '#6fe08a'; ctx.lineWidth = 3; ctx.strokeRect(this.sx(x), this.sy(y), 30 * k, 30 * k);
    }
    ctx.fillStyle = '#fff';
    if (sim.legion.on) for (const id of Object.keys(sim.legion.slots)) { const v = sim.get(Number(id)); if (v) ctx.fillRect(this.sx(v.x) - 1.5, this.sy(v.y) - 1.5, 3, 3); }
    const f = sim.campfire();
    if (f) { ctx.fillStyle = '#ffd24a'; ctx.fillText('🔥', this.sx(f.x + 1), this.sy(f.y + 1)); }
  }
}
