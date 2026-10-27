import { Building, BuildingKind, BUILDINGS } from '../sim/buildings';
import type { WeatherKind } from '../sim/calendar';
import { TILE } from '../sim/constants';
import type { Sim, Villager } from '../sim/sim';
import { hash2 } from '../sim/rng';
import { Tile } from '../sim/world';
import { Prop, Sprites, SPRITE_FEET } from './sprites';

export interface Camera { x: number; y: number; zoom: number }
export interface Box { x0: number; y0: number; x1: number; y1: number }
export interface Marker { x: number; y: number; age: number }

export interface Ghost { kind: BuildingKind; x: number; y: number; ok: boolean }

interface Drawable { y: number; kind: 'tree' | 'rock' | 'bush' | 'villager' | 'building'; i: number; j: number; v?: Villager; b?: Building }

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

  /** Current level's sprite; while an upgrade runs the finished building stays drawn, with a progress bar. */
  private buildingProp(b: Building): Prop {
    const st = b.done ? 4 : Math.min(3, Math.floor(b.progress * 4));
    return this.sprites.building(b.kind, b.era, b.level, st);
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

  draw(time: number, selected: ReadonlySet<number>, box: Box | null, markers: Marker[], ghost: Ghost | null = null, selBuilding: number | null = null): void {
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
    for (const v of sim.villagers) list.push({ y: v.y * TILE, kind: 'villager', i: 0, j: 0, v });
    list.sort((a, b) => a.y - b.y);
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
        this.prop(this.buildingProp(b), ax, ay, time);
        if (!b.done || b.upgrading) {
          const p = this.worldToScreen(ax, ay), w = 40 * z;
          ctx.fillStyle = 'rgba(20,14,8,.7)'; ctx.fillRect(p.x - w / 2, p.y - 4 * z, w, 5 * z);
          ctx.fillStyle = '#e0a23c'; ctx.fillRect(p.x - w / 2 + z, p.y - 3 * z, (w - 2 * z) * b.progress, 3 * z);
        }
      } else if (d.v) {
        const s = sp.villager(d.v), fx = d.v.x * TILE, fy = d.v.y * TILE;
        if (d.v.phase === 'sleep') {
          // lying asleep: sprite rotated 90°, head to the left
          ctx.save(); ctx.translate(Math.round((fx + 16 - cx) * z), Math.round((fy - 2 - cy) * z)); ctx.rotate(-Math.PI / 2);
          ctx.drawImage(s, -SPRITE_FEET.x * z, -SPRITE_FEET.y * z, s.width * z, s.height * z); ctx.restore();
        } else ctx.drawImage(s, Math.round((fx - SPRITE_FEET.x - cx) * z), Math.round((fy - SPRITE_FEET.y - cy) * z), s.width * z, s.height * z);
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
      this.prop(sp.building(ghost.kind, sim.era, 1, 4), ax, ay, time, 0.6);
      ctx.fillStyle = ghost.ok ? 'rgba(90,200,90,.38)' : 'rgba(220,70,60,.42)';
      ctx.fillRect(px(ghost.x), py(ghost.y), d.w * ts, d.h * ts);
      ctx.strokeStyle = ghost.ok ? '#bff0b0' : '#ffb4a8'; ctx.lineWidth = 2;
      ctx.strokeRect(px(ghost.x) + 1, py(ghost.y) + 1, d.w * ts - 2, d.h * ts - 2);
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
    if (box) {
      const x = Math.min(box.x0, box.x1), y = Math.min(box.y0, box.y1), w = Math.abs(box.x1 - box.x0), h = Math.abs(box.y1 - box.y0);
      ctx.fillStyle = 'rgba(245,231,196,.14)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#f5e7c4'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    }
  }
}
