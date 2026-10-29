import { Building, BuildingKind, BUILDINGS, CLEARANCE as CLEAR, Era, needsWork, WALL_KINDS } from '../sim/buildings';
import type { WeatherKind } from '../sim/calendar';
import { gameDays, TILE } from '../sim/constants';
import type { Sim, Villager } from '../sim/sim';
import type { Animal } from '../sim/fauna';
import type { Tribe } from '../sim/tribes';
import { hash2 } from '../sim/rng';
import { Tile } from '../sim/world';
import { MOUNTS } from '../sim/jobs';
import { Prop, Sprites, SPRITE_FEET } from './sprites';

export interface Camera { x: number; y: number; zoom: number }
export interface Box { x0: number; y0: number; x1: number; y1: number }
export interface Marker { x: number; y: number; age: number }

export interface Ghost { kind: BuildingKind; x: number; y: number; ok: boolean; level?: number; era?: Era; /** Id of the building being carried, whose old place keeps no clearance. */ moving?: number }

interface Drawable { y: number; kind: 'tree' | 'rock' | 'bush' | 'villager' | 'building' | 'animal' | 'camp'; i: number; j: number; v?: Villager; b?: Building; a?: Animal; t?: Tribe }

const FOG_RGB = [8, 10, 20];
/** Weather particles: drop/flake count (per 1000×700 px), extra dimming, wind slant, lightning chance. */
const WEATHER_FX: Record<WeatherKind, { rain: number; snow: number; dim: number; wind: number; flash: number }> = {
  clear: { rain: 0, snow: 0, dim: 0, wind: 0, flash: 0 },
  mist: { rain: 0, snow: 0, dim: 0, wind: 0, flash: 0 },
  drizzle: { rain: 90, snow: 0, dim: 0.06, wind: 0.15, flash: 0 },
  rain: { rain: 240, snow: 0, dim: 0.14, wind: 0.2, flash: 0 },
  thunder: { rain: 200, snow: 0, dim: 0.22, wind: 0.25, flash: 0.4 },
  storm: { rain: 320, snow: 0, dim: 0.26, wind: 0.6, flash: 0.15 },
  snow: { rain: 0, snow: 170, dim: 0.04, wind: 0.1, flash: 0 },
};

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  w = 0; h = 0; dpr = 1;
  private readonly fogCanvas: HTMLCanvasElement;
  private readonly fogCtx: CanvasRenderingContext2D;
  private fogVer = -1;

  constructor(readonly canvas: HTMLCanvasElement, readonly sim: Sim, readonly cam: Camera, readonly sprites: Sprites) {
    this.ctx = canvas.getContext('2d')!;
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = this.fogCanvas.height = sim.world.size;
    this.fogCtx = this.fogCanvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    this.w = this.canvas.clientWidth; this.h = this.canvas.clientHeight;
    this.canvas.width = Math.max(1, this.w * this.dpr);
    this.canvas.height = Math.max(1, this.h * this.dpr);
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx / this.cam.zoom + this.cam.x, y: sy / this.cam.zoom + this.cam.y };
  }
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - this.cam.x) * this.cam.zoom, y: (wy - this.cam.y) * this.cam.zoom };
  }

  private updateFog(): void {
    const fog = this.sim.fog;
    if (fog.version === this.fogVer) return;
    this.fogVer = fog.version;
    const N = this.sim.world.size, img = this.fogCtx.createImageData(N, N), s = fog.state;
    for (let i = 0; i < s.length; i++) {
      img.data[i * 4] = FOG_RGB[0]; img.data[i * 4 + 1] = FOG_RGB[1]; img.data[i * 4 + 2] = FOG_RGB[2];
      img.data[i * 4 + 3] = s[i] === 0 ? 255 : s[i] === 1 ? 150 : 0;
    }
    this.fogCtx.putImageData(img, 0, 0);
  }

  /** Vẽ một vật thể: neo (ax, ay) đặt tại điểm thế giới (wx, wy). */
  private prop(p: Prop, wx: number, wy: number, time: number, alpha = 1): void {
    const { ctx, cam } = this, z = cam.zoom;
    const f = p.frames.length > 1 ? Math.floor(time * p.fps) % p.frames.length : 0, s = p.frames[f];
    const prev = ctx.globalAlpha; if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(s, Math.round((wx - p.ax - cam.x) * z), Math.round((wy - p.ay - cam.y) * z), s.width * z, s.height * z);
    ctx.globalAlpha = prev;
  }

  /** Điểm neo của công trình: giữa mép dưới ô chiếm, hơi nhích lên. */
  private buildingAnchor(kind: BuildingKind, x: number, y: number): [number, number] {
    const d = BUILDINGS[kind];
    return [(x + d.w / 2) * TILE, (y + d.h) * TILE - 6];
  }

  /** A fence piece in a column (a neighbour above or below, none beside) is a stake with rails running down the screen to the next one: the tile picture shows a row seen from the front. Returns false when the piece is not part of a column. */
  private drawColumnFence(b: Building, wallAt: Map<number, Building>): boolean {
    const N = this.sim.world.size, at = (dx: number, dy: number) => wallAt.get((b.y + dy) * N + b.x + dx);
    // a fence piece at a corner or a T (a neighbour on both axes) is drawn here too
    if (!(at(0, -1) || at(0, 1))) return false;
    const { ctx } = this, z = this.cam.zoom, [ax, ay] = this.buildingAnchor(b.kind, b.x, b.y), p = this.worldToScreen(ax, ay), two = b.level >= 2;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 8 * z, 3 * z, 0, 0, Math.PI * 2); ctx.fill();
    // rails to the pieces below and beside, drawn first so that this stake and the next one stand over their ends
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0]]) {
      if (!at(dx, dy)) continue;
      const q = this.worldToScreen(ax + dx * TILE, ay + dy * TILE);
      for (const h of two ? [20, 12, 5] : [14, 7]) { ctx.strokeStyle = two ? '#8a6238' : '#d8c690'; ctx.lineWidth = Math.max(1, (two ? 2 : 1) * z); ctx.beginPath(); ctx.moveTo(p.x, p.y - h * z); ctx.lineTo(q.x, q.y - h * z); ctx.stroke(); }
    }
    const w = (two ? 6 : 5) * z, hgt = (two ? 30 : 25) * z;
    ctx.fillStyle = '#5e4026'; ctx.fillRect(Math.round(p.x - w / 2), Math.round(p.y - hgt), Math.round(w), Math.round(hgt));
    ctx.fillStyle = '#8a6238'; ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y - hgt); ctx.lineTo(p.x, p.y - hgt - 3 * z); ctx.lineTo(p.x + w / 2, p.y - hgt); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = Math.max(1, z * 0.7); ctx.strokeRect(Math.round(p.x - w / 2) + 0.5, Math.round(p.y - hgt) + 0.5, Math.round(w), Math.round(hgt));
    return true;
  }

  /** A gate stands taller and much wider than the fence on either side (posts 30 px out from its middle, a lintel across them), and shows plainly whether it is shut: shut, it has a red sign and cloth, planks fill the gap and the ground between the posts is barred; open, it has a green sign and cloth, the leaves stand swung out and a path is laid between the posts. It runs along the column when fence lies above or below it and none beside it. */
  private drawGate(b: Building, wallAt: Map<number, Building>): void {
    const { ctx } = this, z = this.cam.zoom, N = this.sim.world.size, at = (dx: number, dy: number) => wallAt.has((b.y + dy) * N + b.x + dx);
    const col = (at(0, -1) || at(0, 1)) && !(at(-1, 0) || at(1, 0)), two = b.level >= 2, open = b.open;
    const [ax, ay] = this.buildingAnchor(b.kind, b.x, b.y), p = this.worldToScreen(ax, ay - 8);
    const sign = open ? '#4fbf5a' : '#d9473f', signDark = open ? '#2a7a33' : '#8f2620';
    // u runs along the gate, v across it (towards the viewer), h up from the ground
    const X = (u: number, v = 0) => (col ? p.x + v * z : p.x + u * z), Y = (u: number, h: number, v = 0) => (col ? p.y + u * z : p.y + v * z) - h * z;
    const line = (x0: number, y0: number, x1: number, y1: number, th: number, c: string) => {
      ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = th * z + 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = c; ctx.lineWidth = th * z; ctx.stroke();
    };
    const bar = (u0: number, u1: number, h: number, th: number, c: string) => line(X(u0), Y(u0, h), X(u1), Y(u1, h), th, c);
    const top = two ? 64 : 58, leaf = two ? '#9a9a96' : '#8a6238', U = 30;
    // the ground between the posts: a green path when open, barred in red when shut
    ctx.fillStyle = open ? 'rgba(90,200,90,.32)' : 'rgba(217,71,63,.30)';
    if (col) ctx.fillRect(Math.round(p.x - 8 * z), Math.round(p.y - U * z), Math.round(16 * z), Math.round(2 * U * z));
    else ctx.fillRect(Math.round(p.x - U * z), Math.round(p.y - 8 * z), Math.round(2 * U * z), Math.round(16 * z));
    const post = (u: number) => {
      const pw = (two ? 11 : 9) * z, ph = top * z, x = X(u), y = Y(u, 0);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y, 10 * z, 3.5 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b1d10'; ctx.fillRect(Math.round(x - pw / 2) - 1, Math.round(y - ph) - 1, Math.round(pw) + 2, Math.round(ph) + 2);
      ctx.fillStyle = '#5e4026'; ctx.fillRect(Math.round(x - pw / 2), Math.round(y - ph), Math.round(pw), Math.round(ph));
      ctx.fillStyle = '#aa7c48'; ctx.fillRect(Math.round(x - pw / 2), Math.round(y - ph), Math.round(pw * 0.35), Math.round(ph));
      // cloth hung from the top of the post: red when shut, green when open
      ctx.fillStyle = sign; ctx.fillRect(Math.round(x - pw / 2), Math.round(y - ph + 6 * z), Math.round(pw), Math.round(14 * z));
      ctx.fillStyle = signDark; ctx.fillRect(Math.round(x - pw / 2), Math.round(y - ph + 17 * z), Math.round(pw), Math.round(3 * z));
    };
    post(-U);
    if (open) {
      // leaves swung out to the front, one from each post
      for (const s of [-1, 1]) for (const h of [8, 22, 36]) line(X(s * U, 0), Y(s * U, h), X(s * (U - 4), 14), Y(s * (U - 4), h, 14), 4, leaf);
    } else {
      for (const h of [6, 17, 28, 39]) bar(-U + 4, U - 4, h, 5, leaf);
      line(X(-U + 4), Y(-U + 4, 6), X(U - 4), Y(U - 4, 39), 3, '#d8c690');
    }
    post(U);
    bar(-U - 8, U + 8, top, 7, '#5e4026'); bar(-U - 8, U + 8, top + 2, 2, '#aa7c48');
    // the sign on the lintel: a disc with a bar across (shut) or an arrow through (open)
    const cx = X(0), cy = Y(0, top + 12), r = 9 * z;
    ctx.fillStyle = '#2b1d10'; ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sign; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff6e8'; ctx.lineWidth = Math.max(2, 2.4 * z); ctx.lineCap = 'round'; ctx.beginPath();
    if (open) { ctx.moveTo(cx, cy + 5 * z); ctx.lineTo(cx, cy - 5 * z); ctx.moveTo(cx - 3.5 * z, cy - 1.5 * z); ctx.lineTo(cx, cy - 5.5 * z); ctx.lineTo(cx + 3.5 * z, cy - 1.5 * z); }
    else { ctx.moveTo(cx - 5 * z, cy); ctx.lineTo(cx + 5 * z, cy); }
    ctx.stroke(); ctx.lineCap = 'butt';
  }

  /** Ropes and a middle stake from a fence piece to the pieces touching it at its upper corners, drawn over the pieces already standing there. */
  private drawDiagonalRails(b: Building, wallAt: Map<number, Building>): void {
    const { ctx } = this, N = this.sim.world.size, z = this.cam.zoom;
    for (const dx of [-1, 1]) {
      const o = wallAt.get((b.y - 1) * N + b.x + dx);
      if (!o) continue;
      // a piece beside this one in the same row or column already joins them
      if (wallAt.has(b.y * N + b.x + dx) || wallAt.has((b.y - 1) * N + b.x)) continue;
      const [ax, ay] = this.buildingAnchor(b.kind, b.x, b.y), [bx, by] = this.buildingAnchor(o.kind, o.x, o.y);
      const rope = (h: number) => { const p = this.worldToScreen(ax, ay - h), q = this.worldToScreen(bx, by - h); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };
      ctx.strokeStyle = '#d8c690'; ctx.lineWidth = Math.max(1, z); rope(12); rope(6);
      const m = this.worldToScreen((ax + bx) / 2, (ay + by) / 2);
      ctx.fillStyle = '#5e4026'; ctx.fillRect(Math.round(m.x - 2 * z), Math.round(m.y - 24 * z), Math.round(4 * z), Math.round(24 * z));
      ctx.fillStyle = '#aa7c48'; ctx.fillRect(Math.round(m.x - 2 * z), Math.round(m.y - 24 * z), Math.round(4 * z), Math.round(3 * z));
    }
  }

  /** Current level's sprite; while an upgrade runs the finished building stays drawn, with a progress bar. */
  private buildingProp(b: Building): Prop {
    const st = b.done ? 4 : Math.min(3, Math.floor(b.progress * 4));
    return this.sprites.building(b.kind, b.era, b.kind === 'gate' && b.open ? b.level + 2 : b.level, st);
  }

  /** Rain, snow, mist, lightning in screen space; particle positions derive from time, so no state is kept. */
  private drawWeather(time: number): void {
    const { ctx, w, h } = this, kind = this.sim.weather, fx = WEATHER_FX[kind];
    if (kind === 'mist') {
      ctx.fillStyle = 'rgba(214,220,228,.24)'; ctx.fillRect(0, 0, w, h);
      for (let b = 0; b < 3; b++) {
        const y = ((hash2(b, 1, 77) * h + time * (6 + b * 3)) % (h + 200)) - 100, g = ctx.createLinearGradient(0, y - 80, 0, y + 80);
        g.addColorStop(0, 'rgba(225,230,236,0)'); g.addColorStop(0.5, 'rgba(225,230,236,.22)'); g.addColorStop(1, 'rgba(225,230,236,0)');
        ctx.fillStyle = g; ctx.fillRect(0, y - 80, w, 160);
      }
      return;
    }
    if (fx.dim > 0) { ctx.fillStyle = `rgba(16,22,38,${fx.dim})`; ctx.fillRect(0, 0, w, h); }
    const area = (w * h) / 700000;
    if (fx.rain) {
      const n = Math.round(fx.rain * area), len = kind === 'drizzle' ? 8 : 15, sx = fx.wind * len, sy = len;
      ctx.strokeStyle = kind === 'drizzle' ? 'rgba(200,215,235,.35)' : 'rgba(200,215,235,.5)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const sp = 650 + hash2(i, 3, 41) * 300;
        const y = (hash2(i, 1, 41) * (h + 40) + time * sp) % (h + 40) - 20;
        const x = (((hash2(i, 2, 41) * (w + 80) + time * sp * fx.wind) % (w + 80)) + (w + 80)) % (w + 80) - 40;
        ctx.moveTo(x, y); ctx.lineTo(x - sx, y - sy);
      }
      ctx.stroke();
    }
    if (fx.snow) {
      const n = Math.round(fx.snow * area);
      ctx.fillStyle = 'rgba(250,252,255,.85)';
      for (let i = 0; i < n; i++) {
        const sp = 30 + hash2(i, 3, 43) * 40, r = 1 + hash2(i, 4, 43) * 1.6;
        const y = (hash2(i, 1, 43) * (h + 20) + time * sp) % (h + 20) - 10;
        const x = (((hash2(i, 2, 43) * w + Math.sin(time * 0.8 + i) * 12 + time * 20 * fx.wind) % w) + w) % w;
        ctx.fillRect(x, y, r, r);
      }
    }
    if (fx.flash) {
      // lightning: may strike once per 3 s slot, fading over ~0.4 s
      const slot = Math.floor(time / 3), f = time / 3 - slot;
      if (hash2(slot, 7, 91) < fx.flash && f < 0.13) {
        ctx.fillStyle = `rgba(235,240,255,${(0.55 * (1 - f / 0.13)).toFixed(3)})`; ctx.fillRect(0, 0, w, h);
      }
    }
  }

  /** Small health bar over a unit or animal. */
  private bar(wx: number, wy: number, frac: number, color: string): void {
    const { ctx, cam } = this, z = cam.zoom, p = this.worldToScreen(wx, wy), w = 16 * z;
    ctx.fillStyle = 'rgba(20,14,8,.75)'; ctx.fillRect(p.x - w / 2 - z * 0.5, p.y - 0.5 * z, w + z, 3 * z);
    ctx.fillStyle = color; ctx.fillRect(p.x - w / 2, p.y, w * Math.max(0, Math.min(1, frac)), 2 * z);
  }

  /** Draw the soldiers as one figure for about three of them in a big battle (set from the war HUD). */
  /** The cluster flags drawn last frame, for taps. */
  private flags: Array<{ ids: number[]; x: number; y: number; w: number; h: number }> = [];

  /** The cluster whose flag is under the screen point, if any. */
  flagAt(px: number, py: number): number[] | null {
    for (const f of this.flags) if (px >= f.x && px <= f.x + f.w && py >= f.y && py <= f.y + f.h) return f.ids;
    return null;
  }

  /** A small flag over each cluster of soldiers: how many are left, how well they are, and which arm and squad they are. */
  private drawClusters(selected: ReadonlySet<number>): void {
    const { ctx, cam, sim } = this, z = cam.zoom, N = sim.world.size;
    this.flags = [];
    if (!sim.squads.length && !sim.battle.on) return;
    const ARM = { foot: '#d9a441', archer: '#5aa0d9', cavalry: '#c05ad9' };
    const ARM_LETTER = { foot: 'B', archer: 'C', cavalry: 'K' };
    ctx.font = `700 ${Math.max(10, 5 * z)}px system-ui, sans-serif`; ctx.textAlign = 'center';
    for (const c of sim.clusters()) {
      if (c.side !== 'player' && sim.fog.state[Math.floor(c.y) * N + Math.floor(c.x)] !== 2) continue;
      const p = this.worldToScreen(c.x * TILE, c.y * TILE - 38), w = 30 * z * 0.7, h = 11 * z * 0.7, x = Math.round(p.x - w / 2), y = Math.round(p.y - h);
      const chosen = c.ids.some((id) => selected.has(id));
      ctx.fillStyle = c.color; ctx.globalAlpha = 0.92; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
      ctx.strokeStyle = chosen ? '#ffffff' : ARM[c.arm]; ctx.lineWidth = chosen ? 2 : 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      ctx.fillStyle = '#ffffff'; ctx.fillText(`${ARM_LETTER[c.arm]} ${c.n}`, p.x, y + h * 0.78);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x, y + h + 1, w, 3);
      ctx.fillStyle = c.hp > 0.5 ? '#6ac24a' : c.hp > 0.25 ? '#e0b43c' : '#d9503c'; ctx.fillRect(x, y + h + 1, w * Math.max(0, Math.min(1, c.hp)), 3);
      this.flags.push({ ids: c.ids, x, y, w, h: h + 4 });
    }
  }

  draw(time: number, selected: ReadonlySet<number>, box: Box | null, markers: Marker[], ghost: Ghost | null = null, selBuilding: number | null = null, inspect: { kind: 'unit' | 'animal' | 'node'; id: number } | null = null): void {
    const { ctx, cam, sim } = this, z = cam.zoom, world = sim.world, N = world.size, sp = this.sprites;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0d16'; ctx.fillRect(0, 0, this.w, this.h);

    const cx = Math.round(cam.x), cy = Math.round(cam.y), ts = TILE * z, nat = sp.nature(sim.season);
    const i0 = Math.max(0, Math.floor(cx / TILE)), j0 = Math.max(0, Math.floor(cy / TILE));
    const i1 = Math.min(N - 1, Math.floor((cx + this.w / z) / TILE)), j1 = Math.min(N - 1, Math.floor((cy + this.h / z) / TILE));
    const px = (i: number) => (i * TILE - cx) * z, py = (j: number) => (j * TILE - cy) * z;

    // ---- đất: mỗi ô là một mảnh lát liền mạch vẽ từ JSON ----
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const t = world.at(i, j), r = hash2(i, j, 11);
        let img: HTMLCanvasElement;
        if (t === Tile.Water) {
          const w = nat.water[Math.floor(r * nat.water.length)];
          img = w.frames[Math.floor(time * w.fps + hash2(i >> 2, j >> 2, 5) * 4) % w.frames.length];
        } else if (t === Tile.Mud) img = nat.mud[Math.floor(r * nat.mud.length)];
        else img = nat.grass[Math.floor(r * nat.grass.length)];
        ctx.drawImage(img, px(i), py(j), ts, ts);
      }
    }
    // gốc cây là vật trang trí nằm sát đất
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!world.decor[j * N + i]) continue;
      this.prop(nat.stump[Math.floor(hash2(i, j, 31) * nat.stump.length)], i * TILE + 16, j * TILE + 26, time);
    }
    const trees = nat.trees;

    // ---- vật thể + công trình + dân, sắp theo y ----
    const list: Drawable[] = [];
    for (let j = j0; j <= Math.min(N - 1, j1 + 2); j++) {
      for (let i = Math.max(0, i0 - 1); i <= Math.min(N - 1, i1 + 1); i++) {
        const t = world.at(i, j);
        if (t === Tile.Tree) list.push({ y: j * TILE + 28, kind: 'tree', i, j });
        else if (t === Tile.Rock) list.push({ y: j * TILE + 28, kind: 'rock', i, j });
        else if (t === Tile.Bush) list.push({ y: j * TILE + 28, kind: 'bush', i, j });
      }
    }
    const vx0 = cx - 128, vx1 = cx + this.w / z + 128, vy0 = cy - 128, vy1 = cy + this.h / z + 128;
    for (const b of sim.buildings) {
      const [ax, ay] = this.buildingAnchor(b.kind, b.x, b.y);
      if (ax < vx0 || ax > vx1 || ay < vy0 || ay > vy1) continue;
      list.push({ y: ay, kind: 'building', i: 0, j: 0, b });
    }
    for (const v of sim.villagers) if (v.inside === null) list.push({ y: v.y * TILE, kind: 'villager', i: 0, j: 0, v });
    const seen = (x: number, y: number) => sim.fog.state[Math.floor(y) * N + Math.floor(x)] === 2;
    for (const f of sim.foes) if (seen(f.x, f.y)) list.push({ y: f.y * TILE, kind: 'villager', i: 0, j: 0, v: f });
    for (const a of sim.animals) if (seen(a.x, a.y)) list.push({ y: a.state === 'dead' ? a.y * TILE - 1 : a.y * TILE, kind: 'animal', i: 0, j: 0, a });
    for (const t of sim.tribes) if (t.state !== 'adopted' && sim.fog.state[Math.floor(t.camp.y) * N + Math.floor(t.camp.x)] > 0) list.push({ y: (t.camp.y + 1) * TILE, kind: 'camp', i: 0, j: 0, t });
    list.sort((a, b) => a.y - b.y);
    // fences laid corner to corner: their ropes do not meet in the tile sprites, so a rope and a stake are drawn across the diagonal
    const wallAt = new Map<number, Building>();
    for (const b of sim.buildings) if (b.kind === 'fence' || b.kind === 'gate') wallAt.set(b.y * N + b.x, b);
    for (const d of list) {
      if (d.kind === 'tree') {
        const p = trees[Math.floor(hash2(d.i, d.j, 21) * trees.length)];
        this.prop(p, d.i * TILE + 16, d.y, time);
      } else if (d.kind === 'rock') {
        this.prop(nat.rocks[Math.floor(hash2(d.i, d.j, 22) * nat.rocks.length)], d.i * TILE + 16, d.y, time);
      } else if (d.kind === 'bush') {
        const n = world.nodeAt(d.i, d.j), k = Math.floor(hash2(d.i, d.j, 23) * nat.bush.length);
        this.prop((n && n.amount === 0 ? nat.bushEmpty : nat.bush)[k], d.i * TILE + 16, d.y, time);
      } else if (d.kind === 'building' && d.b) {
        const b = d.b, [ax, ay] = this.buildingAnchor(b.kind, b.x, b.y);
        if (b.kind === 'gate' && b.done) this.drawGate(b, wallAt);
        else if (!(b.kind === 'fence' && b.done && this.drawColumnFence(b, wallAt))) this.prop(this.buildingProp(b), ax, ay, time);
        if (b.kind === 'fence' || b.kind === 'gate') this.drawDiagonalRails(b, wallAt);
        const emblem = b.done ? sp.emblems[b.kind] : undefined;
        if (emblem) { const p = this.worldToScreen(ax, ay - 52); ctx.drawImage(emblem, Math.round(p.x - 8 * z), Math.round(p.y), 16 * z, 16 * z); }
        // a house that works to orders shows how far the order has got, or sleeps when it has none
        if (b.done && (b.kind === 'lab' || b.kind === 'workshop' || b.kind === 'repair' || b.kind === 'stable' || b.kind === 'builder')) {
          const p = this.worldToScreen(ax, ay - 74);
          ctx.textAlign = 'center'; ctx.lineJoin = 'round';
          // the builders' house has no orders of its own: it is busy while any house waits to be raised or upgraded
          if (b.kind === 'builder' && sim.buildings.some(needsWork)) { ctx.textAlign = 'start'; }
          else if (b.active) {
            const w = 36 * z, f = Math.max(0, Math.min(1, b.active.progress));
            ctx.fillStyle = 'rgba(20,14,8,.8)'; ctx.fillRect(p.x - w / 2 - z, p.y - z, w + 2 * z, 8 * z);
            ctx.fillStyle = '#6bbf59'; ctx.fillRect(p.x - w / 2, p.y, w * f, 6 * z);
            ctx.font = `700 ${Math.max(10, 7 * z)}px system-ui, sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,14,8,.9)'; ctx.fillStyle = '#fff6e8';
            ctx.strokeText(`${Math.floor(f * 100)}%`, p.x, p.y - 3 * z); ctx.fillText(`${Math.floor(f * 100)}%`, p.x, p.y - 3 * z);
          } else {
            const t = time * 1.2 + b.id * 0.7;
            for (let i = 0; i < 4; i++) {
              const k = (t + i * 0.5) % 2, a = Math.sin(Math.PI * Math.min(1, k / 2)), s = (7 + i * 2) * z;
              ctx.font = `700 ${Math.max(9, s)}px system-ui, sans-serif`; ctx.fillStyle = `rgba(190,215,255,${(0.9 * a).toFixed(2)})`; ctx.strokeStyle = `rgba(20,30,60,${(0.8 * a).toFixed(2)})`; ctx.lineWidth = 2.5;
              const x = p.x + (i * 7 - 8) * z, y = p.y - (k * 7 + i * 3) * z;
              ctx.strokeText('z', x, y); ctx.fillText('z', x, y);
            }
          }
          ctx.textAlign = 'start';
        }
        if (!b.done || b.upgrading) {
          const p = this.worldToScreen(ax, ay), w = 40 * z;
          ctx.fillStyle = 'rgba(20,14,8,.7)'; ctx.fillRect(p.x - w / 2, p.y - 4 * z, w, 5 * z);
          ctx.fillStyle = '#e0a23c'; ctx.fillRect(p.x - w / 2 + z, p.y - 3 * z, (w - 2 * z) * b.progress, 3 * z);
        }
      } else if (d.kind === 'animal' && d.a) {
        const a = d.a, box = sp.animalBox(a.species), s = sp.animal(a), fx = a.x * TILE, fy = a.y * TILE;
        const fade = a.state === 'dead' ? Math.min(1, a.carcass / 10) : 1;
        if (a.state !== 'dead') { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(Math.round((fx - cx) * z), Math.round((fy - cy) * z), box.w * 0.3 * z, box.h * 0.1 * z, 0, 0, Math.PI * 2); ctx.fill(); }
        const prev = ctx.globalAlpha; ctx.globalAlpha = fade;
        ctx.drawImage(s, Math.round((fx - box.ax - cx) * z), Math.round((fy - box.ay - cy) * z), s.width * z, s.height * z);
        ctx.globalAlpha = prev;
        if (a.state !== 'dead' && a.hp < a.maxHp) this.bar(fx, fy - box.ay - 2, a.hp / a.maxHp, '#d9534f');
      } else if (d.kind === 'camp' && d.t) {
        const t = d.t, sp0 = this.sprites;
        for (const p of t.props) {
          if (p.kind === 'fire') { if (t.state === 'destroyed') continue; const [ax, ay] = this.buildingAnchor('campfire', p.x, p.y); this.prop(sp0.building('campfire', 'stone', 1, 4), ax, ay, time); }
          else { const [ax, ay] = this.buildingAnchor('storage', p.x, p.y); this.prop(sp0.building('storage', 'stone', 1, 4), ax, ay, time, t.state === 'destroyed' ? 0.5 : 1); }
        }
      } else if (d.v) {
        const rode = d.v.phase !== 'sleep' && d.v.phase !== 'down' ? sim.mountOf(d.v) : null, fighting = !!d.v.swing || d.v.flinch > 0 || d.v.anim === 'down';
        const s = sp.villager(d.v, rode && !fighting ? 'idle' : undefined), fx = d.v.x * TILE, fy = d.v.y * TILE;
        let lift = 0;
        if (rode) { // a beast under him: it walks when he walks, and he sits on its back
          const m = MOUNTS[rode], moving = d.v.path.length > 0 || !!d.v.slide, beast = sp.mount(m.species, moving, d.v.animClock, d.v.facing === 'left' ? -1 : 1), box = sp.animalBox(m.species);
          ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(Math.round((fx - cx) * z), Math.round((fy - cy) * z), box.w * 0.3 * z, box.h * 0.1 * z, 0, 0, Math.PI * 2); ctx.fill();
          ctx.drawImage(beast, Math.round((fx - box.ax - cx) * z), Math.round((fy - box.ay - cy) * z), beast.width * z, beast.height * z);
          lift = m.ride + (moving ? Math.abs(Math.sin(d.v.animClock * 8)) : 0);
        }
        if (d.v.phase === 'sleep' || d.v.phase === 'down') {
          // lying asleep: sprite rotated 90°, head to the left
          ctx.save(); ctx.translate(Math.round((fx + 16 - cx) * z), Math.round((fy - 2 - cy) * z)); ctx.rotate(-Math.PI / 2);
          ctx.drawImage(s, -SPRITE_FEET.x * z, -SPRITE_FEET.y * z, s.width * z, s.height * z); ctx.restore();
        } else ctx.drawImage(s, Math.round((fx - SPRITE_FEET.x - cx) * z), Math.round((fy - lift - SPRITE_FEET.y - cy) * z), s.width * z, s.height * z);
        const v = d.v;
        // a small badge tells soldiers (red) and hunters (amber) from civilians
        if (v.team === 'player' && (v.job === 'fight' || v.job === 'hunt') && v.phase !== 'flee' && v.phase !== 'sleep' && v.phase !== 'down') {
          const p = this.worldToScreen(fx, fy - lift - (v.health < v.maxHealth ? 54 : 48)), u = Math.max(1, Math.round(z));
          ctx.fillStyle = 'rgba(20,14,8,.85)'; ctx.fillRect(p.x - 3 * u, p.y - 4 * u, 6 * u, 7 * u);
          ctx.fillStyle = v.job === 'fight' ? '#d9534f' : '#e0a23c'; ctx.fillRect(p.x - 2 * u, p.y - 3 * u, 4 * u, 4 * u); ctx.fillRect(p.x - u, p.y + u, 2 * u, u);
        }
        if (v.health < v.maxHealth && (v.health > 0 || v.down > 0)) this.bar(fx, fy - lift - 46, v.health / v.maxHealth, v.team === 'player' ? '#6bbf59' : '#d9534f');
        if (v.down > 0) { ctx.fillStyle = '#ffd27a'; ctx.font = `700 ${Math.max(11, 6 * z)}px system-ui, sans-serif`; ctx.textAlign = 'center'; const p = this.worldToScreen(fx, fy - 30); ctx.fillText(gameDays(v.down), p.x, p.y); }
        if (v.phase === 'flee') { ctx.fillStyle = '#fff6e8'; ctx.font = `700 ${Math.max(12, 7 * z)}px system-ui, sans-serif`; ctx.textAlign = 'center'; const p = this.worldToScreen(fx, fy - 50); ctx.fillText('!', p.x, p.y); }
      }
    }

    // ---- dusk/dawn: orange glow; night: dark blue overlay, campfire light ----
    const dark = sim.darkness;
    if (dark > 0.01 && dark < 0.99) {
      ctx.fillStyle = `rgba(255,128,60,${(0.16 * Math.sin(Math.PI * dark)).toFixed(3)})`; ctx.fillRect(0, 0, this.w, this.h);
    }
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(14,20,56,${(0.46 * dark).toFixed(3)})`; ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of sim.buildings) {
        if (b.kind !== 'campfire') continue;
        const [ax, ay] = this.buildingAnchor(b.kind, b.x, b.y), p = this.worldToScreen(ax, ay - 14), rad = 120 * z;
        const g = ctx.createRadialGradient(p.x, p.y, 4 * z, p.x, p.y, rad);
        g.addColorStop(0, `rgba(255,170,70,${(0.5 * dark).toFixed(3)})`); g.addColorStop(1, 'rgba(255,170,70,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
      }
      for (const v of sim.villagers) {
        if (!v.lit) continue;
        const p = this.worldToScreen(v.x * TILE - 8, v.y * TILE - 22), rad = 52 * z, flick = 0.92 + 0.08 * Math.sin(time * 9 + v.id);
        const g = ctx.createRadialGradient(p.x, p.y, 2 * z, p.x, p.y, rad);
        g.addColorStop(0, `rgba(255,176,80,${(0.42 * dark * flick).toFixed(3)})`); g.addColorStop(1, 'rgba(255,176,80,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // ---- sương mù (làm mờ mép bằng nội suy) ----
    this.updateFog();
    const fi0 = Math.max(0, i0 - 1), fj0 = Math.max(0, j0 - 1), fi1 = Math.min(N, i1 + 2), fj1 = Math.min(N, j1 + 2);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogCanvas, fi0, fj0, fi1 - fi0, fj1 - fj0, px(fi0), py(fj0), (fi1 - fi0) * ts, (fj1 - fj0) * ts);
    ctx.imageSmoothingEnabled = false;

    this.drawWeather(time);

    // ---- sleeping villagers ----
    ctx.font = `700 ${Math.max(10, 5 * z)}px system-ui, sans-serif`; ctx.textAlign = 'center';
    for (const v of sim.villagers) {
      if (v.phase !== 'sleep') continue;
      const p = this.worldToScreen(v.x * TILE - 10, v.y * TILE - 14), k = (time * 0.6 + v.id * 0.37) % 1;
      ctx.fillStyle = `rgba(235,240,255,${(0.9 * (1 - k)).toFixed(2)})`;
      ctx.fillText('z', p.x + k * 6 * z, p.y - k * 10 * z);
    }

    // ---- bóng ma khi đặt công trình ----
    if (ghost) {
      const d = BUILDINGS[ghost.kind], [ax, ay] = this.buildingAnchor(ghost.kind, ghost.x, ghost.y);
      // the clearance of two free tiles that houses keep from each other: round every standing house and round the ghost (walls keep none)
      if (!WALL_KINDS.has(ghost.kind)) {
        const zone = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(px(x - CLEAR), py(y - CLEAR), (w + 2 * CLEAR) * ts, (h + 2 * CLEAR) * ts); };
        for (const o of sim.buildings) if (!WALL_KINDS.has(o.kind) && o.id !== ghost.moving) zone(o.x, o.y, BUILDINGS[o.kind].w, BUILDINGS[o.kind].h, 'rgba(240,170,60,.16)');
        ctx.strokeStyle = 'rgba(255,220,120,.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
        ctx.strokeRect(px(ghost.x - CLEAR), py(ghost.y - CLEAR), (d.w + 2 * CLEAR) * ts, (d.h + 2 * CLEAR) * ts); ctx.setLineDash([]);
      }
      this.prop(sp.building(ghost.kind, ghost.era ?? sim.era, ghost.level ?? 1, 4), ax, ay, time, 0.6);
      ctx.fillStyle = ghost.ok ? 'rgba(90,200,90,.38)' : 'rgba(220,70,60,.42)';
      ctx.fillRect(px(ghost.x), py(ghost.y), d.w * ts, d.h * ts);
      ctx.strokeStyle = ghost.ok ? '#bff0b0' : '#ffb4a8'; ctx.lineWidth = 2;
      ctx.strokeRect(px(ghost.x) + 1, py(ghost.y) + 1, d.w * ts - 2, d.h * ts - 2);
    }

    // ---- missiles in flight ----
    for (const m of sim.projectiles) {
      const p = this.worldToScreen(m.x * TILE, m.y * TILE), dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = m.kind === 'arrow' ? '#e8d6a8' : '#c9ced1'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(1, z);
      if (m.kind === 'arrow') { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (dx / d) * 7 * z, p.y - (dy / d) * 7 * z); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 * z, 0, Math.PI * 2); ctx.fill(); }
    }
    // ---- the unit or animal being inspected ----
    if (inspect) {
      if (inspect.kind === 'node') {
        const N = sim.world.size, p = this.worldToScreen((inspect.id % N) * TILE + 16, Math.floor(inspect.id / N) * TILE + 28);
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, 15 * z, 6 * z, 0, 0, Math.PI * 2); ctx.stroke();
      }
      const e = inspect.kind === 'unit' ? sim.get(inspect.id) : inspect.kind === 'animal' ? sim.animalById.get(inspect.id) : undefined;
      if (e) { const p = this.worldToScreen(e.x * TILE, e.y * TILE); ctx.strokeStyle = '#ff8a7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y + z, 11 * z, 5 * z, 0, 0, Math.PI * 2); ctx.stroke(); }
    }

    // ---- selected building ----
    const sb = selBuilding === null ? undefined : sim.getBuilding(selBuilding);
    if (sb) {
      const d = BUILDINGS[sb.kind];
      ctx.strokeStyle = '#f5e7c4'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(px(sb.x) + 1, py(sb.y) + 1, d.w * ts - 2, d.h * ts - 2); ctx.setLineDash([]);
    }

    // ---- đánh dấu lệnh, vòng chọn ----
    for (const m of markers) {
      const p = this.worldToScreen(m.x, m.y), k = 1 - m.age / 0.9;
      ctx.strokeStyle = `rgba(255,246,232,${Math.max(0, k)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, (6 + m.age * 14) * z / 2, (3 + m.age * 7) * z / 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const v of sim.villagers) {
      if (!selected.has(v.id)) continue;
      const p = this.worldToScreen(v.x * TILE, v.y * TILE);
      ctx.strokeStyle = '#f5e7c4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 1 * z, 11 * z, 5 * z, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f5e7c4'; ctx.font = `600 ${Math.max(11, 6 * z)}px system-ui, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(v.name, p.x, p.y - 44 * z);
    }
    this.drawClusters(selected);
    if (box) {
      const x = Math.min(box.x0, box.x1), y = Math.min(box.y0, box.y1), w = Math.abs(box.x1 - box.x0), h = Math.abs(box.y1 - box.y0);
      ctx.fillStyle = 'rgba(245,231,196,.14)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#f5e7c4'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    }
  }
}
