import { Building, BuildingKind, BUILDINGS, canGrow, CLEARANCE as CLEAR, Era, buildingSight, maxHp, needsWork, WALL_KINDS, footOf } from '../sim/buildings';
import type { WeatherKind } from '../sim/calendar';
import { gameDays, TILE } from '../sim/constants';
import type { Sim, Villager } from '../sim/sim';
import type { Animal } from '../sim/fauna';
import type { Tribe } from '../sim/tribes';
import { maxPropHp } from '../sim/tribebuild';
import { hash2 } from '../sim/rng';
import { Tile } from '../sim/world';
import { isHorse, MOUNTS } from '../sim/jobs';
import { Prop, Sprites, SPRITE_FEET } from './sprites';
import { FxLayer } from './fxlayer';
import type { GameAudio } from '../audio/audio';
import { footSound } from '../audio/audio';
import animsJson from '../data/anims.json';
import soundsJson from '../data/sounds.json';
import { Mountains, stripOrigin } from './mountains';

export interface Camera { x: number; y: number; zoom: number }
export interface Box { x0: number; y0: number; x1: number; y1: number }
export interface Marker { x: number; y: number; age: number }

export interface Ghost { kind: BuildingKind; x: number; y: number; ok: boolean; level?: number; era?: Era; /** Id of the building being carried, whose old place keeps no clearance. */ moving?: number; /** A group of fence pieces carried together: where each goes, and the ids they leave. */ group?: Array<{ id: number; kind: BuildingKind; x: number; y: number; level: number; w?: number; h?: number; rot?: number }>; movingIds?: number[]; /** The tiles a gate being put down covers, and whether it stands along a column. */ w?: number; h?: number; rot?: number }

interface Drawable { y: number; kind: 'tree' | 'rock' | 'ore' | 'mountain' | 'bush' | 'villager' | 'building' | 'animal' | 'camp' | 'ftent'; ft?: { x: number; y: number; built: boolean }; i: number; j: number; peak?: 'low' | 'mid' | 'high'; v?: Villager; b?: Building; a?: Animal; t?: Tribe; p?: Tribe['props'][number] }

/** Frame count and speed of an animation, for the sound hit frames. */
const animClip = (a: string): { fps: number; n: number; hit: number } | undefined => { const c = (animsJson as unknown as Record<string, { fps: number; frames: unknown[]; hit?: number }>)[a]; return c ? { fps: c.fps, n: c.frames.length, hit: c.hit ?? 2 } : undefined; };

const FOG_RGB = [8, 10, 20];
/** Side of a tile of rain (px). */
const RAIN_TILE = 512;
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
  /** The most canvas pixels per CSS pixel (the quality setting): a screen sharper than this is drawn smaller and stretched, which is much less to draw. */
  dprCap = 3;
  /** Where a finger held still has made the selection box ready (screen px): a ring is drawn there. */
  cue: { x: number; y: number } | null = null;
  private readonly fogCanvas: HTMLCanvasElement;
  private torchLight: HTMLCanvasElement | null = null;
  /** Sparks, dust and flames made by code (pixelfx); it only watches the Sim. */
  private readonly fxl = new FxLayer();
  /** Optional sound: plays work and fight sounds for the units on screen. */
  audio: GameAudio | null = null;
  /** Draw the rain, snow and lightning (the player can switch it off). */
  weatherFx = true;
  /** The lightning slot whose thunder has been sounded (presentation only). */
  private thunderSlot = -1;
  /** The mountains of a world, drawn as one heightfield (see mountains.ts). */
  private readonly mountains = new WeakMap<object, Mountains>();
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
    const own = window.devicePixelRatio || 1;
    this.dpr = Math.max(1, Math.min(this.dprCap, own));
    this.w = this.canvas.clientWidth; this.h = this.canvas.clientHeight;
    this.canvas.width = Math.max(1, Math.round(this.w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.h * this.dpr));
    this.canvas.style.imageRendering = this.dpr < own - 0.01 ? 'auto' : 'pixelated'; // stretched: smooth, so that the pixels do not come out uneven; at the screen's own size: crisp
  }
  /** Draw with at most `cap` canvas pixels per CSS pixel from now on. */
  setDprCap(cap: number): void { if (cap !== this.dprCap) { this.dprCap = cap; this.resize(); } }

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
    const N = this.sim.world.size, s = fog.state, ch = fog.takeChanged(), g = this.fogCtx;
    if (ch === null) { // all of it: a game was loaded, or the whole map was shown
      const img = g.createImageData(N, N);
      for (let i = 0; i < s.length; i++) {
        img.data[i * 4] = FOG_RGB[0]; img.data[i * 4 + 1] = FOG_RGB[1]; img.data[i * 4 + 2] = FOG_RGB[2];
        img.data[i * 4 + 3] = s[i] === 0 ? 255 : s[i] === 1 ? 150 : 0;
      }
      g.putImageData(img, 0, 0);
      return;
    }
    // only the tiles that changed (a villager walking changes a ring of them): clear them, then lay the fog of the ones that are not in sight
    if (!ch.length) return;
    for (const i of ch) g.clearRect(i % N, (i / N) | 0, 1, 1);
    for (const lvl of [1, 0]) {
      g.fillStyle = `rgba(${FOG_RGB[0]},${FOG_RGB[1]},${FOG_RGB[2]},${lvl === 0 ? 1 : 150 / 255})`;
      g.beginPath();
      for (const i of ch) if (s[i] === lvl) g.rect(i % N, (i / N) | 0, 1, 1);
      g.fill();
    }
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
  /**
   * A house that has been hurt shows it: a bar of what is left, smoke once it has lost 30%, flames once it has lost 70% (at nothing it falls).
   * Every house does it, the tower no more than the others.
   */
  private drawDamage(b: Building, ax: number, ay: number, time: number): void {
    if (b.done && b.kind === 'campfire' && this.audio?.sfxOn) { const p = this.worldToScreen(ax, ay); if (this.nearCenter(p.x, p.y)) this.audio.near('homefire'); } // the fire of the village crackles
    if (b.done) this.drawWear(b.kind, b.hp / Math.max(1, maxHp(b)), b.id, ax, ay, time, b.level, this.buildingProp(b).ay);
    if (b.done && canGrow(b.kind) && !WALL_KINDS.has(b.kind) && this.canUpgradeNow(b, time)) this.drawUpgradeMark(ax, ay - this.buildingProp(b).ay - 12, b.id, time);
  }

  /**
   * The men of a tower seen up on it: a bust with a cap and a bow behind the rail or the battlements (up to three, one for each man), bobbing a little; in the
   * wooden tower they stand on the deck, in the stone one their heads and shoulders show over the merlons, in the medieval one the walkway is open too, a small tiled turret behind them.
   * (ax, ay) is the anchor of the tower's picture; `art` 1 is the timber tower, 2 the stone one, 3 the medieval one. A man who is shooting draws his bow.
   */
  private drawTowerMen(ax: number, ay: number, art: 1 | 2 | 3, n: number, time: number, shooting: boolean): void {
    if (n <= 0) return;
    const { ctx } = this, z = this.cam.zoom, count = Math.min(3, n);
    const at = (sx: number, sy: number) => this.worldToScreen(ax + sx - 36, ay + sy - 94); // a point of the picture (36, 94 is its anchor)
    const xs = art === 1 ? [20, 32, 44] : [22, 33, 44];
    for (let i = 0; i < count; i++) {
      const bob = Math.round(Math.sin(time * 2.2 + i * 1.7) * 0.6), cap = art === 3 ? '#8a8e96' : '#a8733f', capD = art === 3 ? '#5b5e66' : '#774c28';
      const feet = art === 1 ? 33 : 29, x = xs[i], h = art === 1 ? 14 : 11; // the picture's pixels: a man this tall shows
      const o = at(x, feet + bob), px = (dx: number, dy: number, w: number, hh: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(o.x + dx * z), Math.round(o.y - (dy + hh) * z), Math.max(1, Math.round(w * z)), Math.max(1, Math.round(hh * z))); };
      ctx.fillStyle = '#2b1d10'; ctx.fillRect(Math.round(o.x - 5 * z), Math.round(o.y - (h + 1) * z), Math.round(10 * z), Math.round((h + 1) * z)); // an outline behind the whole man
      px(-4, 0, 8, 6, art === 3 ? '#5b6573' : '#8a4a2a');   // the body: a tunic, or a mail shirt
      px(-4, 0, 1, 6, art === 3 ? '#8893a0' : '#b06a3e');
      px(-5, 2, 1, 3, '#d8a878'); px(4, 2, 1, 3, '#d8a878');   // hands
      const hy = 6;
      px(-2, hy, 5, 4, '#d8a878'); px(-1, hy + 2, 1, 1, '#2b1d10'); px(1, hy + 2, 1, 1, '#2b1d10'); // the face and its eyes
      px(-3, hy + 3, 7, 2, cap); px(-3, hy + 3, 7, 1, art === 3 ? '#b6bcc6' : '#cf9a62'); px(-3, hy + 2, 1, 2, capD); px(3, hy + 2, 1, 2, capD); // a cap or a helmet
      // the bow: held up on the side he faces, drawn when he is shooting
      const bx = o.x + 6 * z, by = o.y - (hy + 1) * z;
      ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = Math.max(2, 2.6 * z); ctx.beginPath(); ctx.arc(bx, by, 5 * z, -Math.PI * 0.45, Math.PI * 0.45); ctx.stroke();
      ctx.strokeStyle = '#8a6238'; ctx.lineWidth = Math.max(1, 1.4 * z); ctx.beginPath(); ctx.arc(bx, by, 5 * z, -Math.PI * 0.45, Math.PI * 0.45); ctx.stroke();
      ctx.strokeStyle = '#d8c690'; ctx.lineWidth = Math.max(1, 0.8 * z); ctx.beginPath(); ctx.moveTo(bx + 5 * z * Math.cos(-Math.PI * 0.45), by + 5 * z * Math.sin(-Math.PI * 0.45)); ctx.lineTo(shooting ? bx - 3 * z : bx + 5 * z * Math.cos(Math.PI * 0.45) - 0.5 * z, shooting ? by : by + 5 * z * Math.sin(Math.PI * 0.45)); ctx.lineTo(bx + 5 * z * Math.cos(Math.PI * 0.45), by + 5 * z * Math.sin(Math.PI * 0.45)); ctx.stroke();
      if (shooting) { ctx.strokeStyle = '#e8d6a8'; ctx.lineWidth = Math.max(1, z); ctx.beginPath(); ctx.moveTo(bx - 3 * z, by); ctx.lineTo(bx + 6 * z, by); ctx.stroke(); }
    }
  }

  private readonly upgradeOk = new Map<number, { at: number; ok: boolean }>();
  /** Whether the building can be upgraded right now (asked twice a second: it looks at the stores and the campfire). */
  private canUpgradeNow(b: Building, time: number): boolean {
    const c = this.upgradeOk.get(b.id);
    if (c && time - c.at < 0.5) return c.ok;
    const ok = this.sim.canUpgrade(b) === null;
    this.upgradeOk.set(b.id, { at: time, ok });
    return ok;
  }

  /** A green arrow over a building that can be upgraded now, bobbing a little. */
  private drawUpgradeMark(ax: number, top: number, id: number, time: number): void {
    const { ctx, cam: { zoom: z } } = this, p = this.worldToScreen(ax, top - Math.sin(time * 3 + id) * 2), r = 9 * z;
    ctx.fillStyle = 'rgba(20,14,8,.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6bd35a'; ctx.beginPath();
    ctx.moveTo(p.x, p.y - r * 0.6); ctx.lineTo(p.x + r * 0.6, p.y + r * 0.05); ctx.lineTo(p.x + r * 0.22, p.y + r * 0.05); ctx.lineTo(p.x + r * 0.22, p.y + r * 0.6);
    ctx.lineTo(p.x - r * 0.22, p.y + r * 0.6); ctx.lineTo(p.x - r * 0.22, p.y + r * 0.05); ctx.lineTo(p.x - r * 0.6, p.y + r * 0.05); ctx.closePath(); ctx.fill();
  }

  /** The same for any work, ours or a village's: `ratio` is what is left of it, `id` only sets where the smoke and flames are in their dance. */
  private drawWear(kind: BuildingKind, ratio: number, id: number, ax: number, ay: number, time: number, lv = 1, height = 0): void {
    const { ctx, cam: { zoom: z } } = this;
    ratio = Math.max(0, Math.min(1, ratio));
    if (ratio >= 1) return;
    const top = kind === 'tower' ? 86 : kind === 'fence' || kind === 'gate' ? 30 : kind === 'campfire' ? 34 : 62;
    this.bar(ax, ay - top, ratio, ratio > 0.7 ? '#6bbf59' : ratio > 0.3 ? '#e0b43c' : '#d9503c');
    if (kind === 'fence' || kind === 'gate') return;
    const wide = BUILDINGS[kind].w * TILE * 0.35, roof = height > 0 ? height * 0.72 : kind === 'tower' ? 70 : 44; // the roof is where the drawing is: a low house burns low
    if (ratio <= 0.7) { // smoke rising from the roof
      for (let k = 0; k < 4; k++) {
        const t = (time * 0.45 + k * 0.25 + id * 0.13) % 1, p = this.worldToScreen(ax - wide * 0.5 + k * wide * 0.33 + Math.sin(time * 1.3 + k) * 3 * t, ay - roof - t * 34);
        ctx.fillStyle = `rgba(${ratio <= 0.3 ? '55,52,52' : '120,120,126'},${(0.5 * (1 - t)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, (3 + t * 7) * z, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (ratio <= 0.3) { // flames at the foot of it (they burn from the ground up; only the smoke climbs to the roof), made by code: taller on a house of a higher level and as it burns down
      if (this.audio?.sfxOn) { const p = this.worldToScreen(ax, ay); if (this.nearCenter(p.x, p.y)) this.audio.near('burn'); } // a work on fire roars while it is near the middle of the screen
      const fire = this.fxl.flame(lv, ratio);
      for (let k = 0; k < 3; k++) {
        const t = time + k * 0.37 + id * 0.11, f = fire.frames[Math.floor(t * fire.fps) % fire.frames.length], at = this.worldToScreen(ax - wide * 0.6 + k * wide * 0.6, ay - (k === 1 ? 9 : 3));
        ctx.drawImage(f, Math.round(at.x - fire.ax * z), Math.round(at.y - fire.ay * z), f.width * z, f.height * z);
      }
    }
  }

  /** The land of the village while a house is being placed or carried: the circles of every finished house together, faint. */
  private drawTerritory(buildings: readonly Building[]): void {
    const { ctx } = this, z = this.cam.zoom;
    ctx.fillStyle = 'rgba(255,226,140,.07)'; ctx.beginPath();
    for (const b of buildings) {
      const r = buildingSight(b);
      if (r <= 0) continue;
      const d = BUILDINGS[b.kind], p = this.worldToScreen((b.x + d.w / 2) * TILE, (b.y + d.h / 2) * TILE), rr = r * TILE * z;
      ctx.moveTo(p.x + rr, p.y); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  /** The circle a house sees, and holds as land of the village (a tower shoots as far as it too): drawn round the tower when it is chosen, and round the one being placed or carried. */
  private drawSight(cxTile: number, cyTile: number, tiles: number): void {
    const { ctx } = this, z = this.cam.zoom, p = this.worldToScreen(cxTile * TILE, cyTile * TILE), r = tiles * TILE * z;
    ctx.fillStyle = 'rgba(255,226,140,.08)'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,226,140,.7)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }

  /** The side (left or right) each villager last faced, for riders. */
  private readonly sideOf = new WeakMap<Villager, 'left' | 'right'>();

  /** The kind of house a work of a village is drawn as. */
  private propKind(p: Tribe['props'][number]): BuildingKind {
    return p.kind === 'fire' ? 'campfire' : p.b ?? (p.kind === 'tower' || p.kind === 'fence' || p.kind === 'gate' ? p.kind : 'storage');
  }

  /** The fence and gate of a village drawn as ours are: each work stands for a house of the same kind, so that the ropes, the posts and the gate join up. */
  private readonly wallStubs = new WeakMap<Tribe['props'][number], Building>();
  private readonly wallMaps = new WeakMap<Tribe, { props: Tribe['props']; n: number; map: Map<number, Building> }>();
  private wallStub(p: Tribe['props'][number]): Building {
    let b = this.wallStubs.get(p);
    if (!b) {
      b = { id: -1, kind: p.kind as BuildingKind, era: 'stone', x: p.x, y: p.y, w: p.w, h: p.h, level: p.lv ?? 1, progress: 1, done: true, upgrading: false, rebuild: false, hp: 0, open: true, staff: [], active: null, workers: 0 } as Building;
      Object.defineProperty(b, 'open', { get: () => p.open !== false }); // the gate shuts and opens by itself
      this.wallStubs.set(p, b);
    }
    return b;
  }
  private wallsOf(t: Tribe): Map<number, Building> {
    const have = this.wallMaps.get(t);
    if (have && have.props === t.props && have.n === t.props.length) return have.map;
    const N = this.sim.world.size, map = new Map<number, Building>();
    for (const p of t.props) if (p.kind === 'fence' || p.kind === 'gate') { const b = this.wallStub(p); for (let j = 0; j < Math.max(1, p.h); j++) for (let i = 0; i < Math.max(1, p.w); i++) map.set((p.y + j) * N + p.x + i, b); }
    this.wallMaps.set(t, { props: t.props, n: t.props.length, map });
    return map;
  }

  /** An upgrade being planned on bigger ground (ui/upgradeplan.ts): the ground it will cover, what stands in the way, and whether the way is clear. */
  plan: { kind: BuildingKind; era: Era; level: number; rect: { x: number; y: number; w: number; h: number }; ok: boolean; blockers: Array<{ x: number; y: number; w: number; h: number }> } | null = null;

  private anchorOf(b: Building): [number, number] {
    if (this.sim.dev.palace && b.kind === 'campfire') return [(b.x + 1) * TILE, (b.y + 4) * TILE - 6]; // the palace is 6 × 6 tiles round the middle of the fire: its front edge is three tiles below it
    return this.buildingAnchor(b.kind, b.x, b.y, footOf(b));
  }
  private buildingAnchor(kind: BuildingKind, x: number, y: number, fp?: { w: number; h: number }): [number, number] {
    const d = fp ?? BUILDINGS[kind];
    return [(x + d.w / 2) * TILE, (y + d.h) * TILE - 6];
  }

  /** A box with a dark outline and a lit left edge, the way the tile pictures are drawn. */
  private block(x: number, y: number, w: number, h: number, fill: string, lit?: string, dark?: string): void {
    const { ctx } = this;
    x = Math.round(x); y = Math.round(y); w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    ctx.fillStyle = '#2b1d10'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
    if (lit) { ctx.fillStyle = lit; ctx.fillRect(x, y, Math.max(1, Math.round(w * 0.28)), h); }
    if (dark) { ctx.fillStyle = dark; ctx.fillRect(x + w - Math.max(1, Math.round(w * 0.2)), y, Math.max(1, Math.round(w * 0.2)), h); }
  }

  /** A solid shape with a dark outline. */
  private shape(pts: Array<[number, number]>, fill: string): void {
    const { ctx } = this, z = this.cam.zoom;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = Math.max(1, z * 0.8); ctx.stroke();
  }

  /** Is a gate laid along a column? A gate of two tiles says so by its shape; one of a single tile (an old save, a village's) by the fence beside it: above or below it and none beside. */
  private gateCol(b: Building, wallAt: Map<number, Building>): boolean {
    const f = footOf(b);
    if (f.w !== f.h) return f.h > f.w;
    const N = this.sim.world.size, at = (dx: number, dy: number) => wallAt.has((b.y + dy) * N + b.x + dx);
    return (at(0, -1) || at(0, 1)) && !(at(-1, 0) || at(1, 0));
  }

  /** How far (px, at zoom 1) from the middle of a wall piece a rail coming along the screen direction (ux, uy) stops: at the post of a fence piece, at the outer post of a gate. */
  private wallReach(o: Building, ux: number, uy: number, wallAt: Map<number, Building>): number {
    if (o.kind !== 'gate') return 4;
    const f = footOf(o), along = this.gateCol(o, wallAt) ? Math.abs(uy) : Math.abs(ux);
    return along > 0.7 ? Math.max(f.w, f.h) * 16 : 4;
  }

  /** The point on the ground at the middle of a wall piece, as the rails see it. */
  private groundOf(b: Building): [number, number] { const f = footOf(b); return [(b.x + f.w / 2) * TILE, (b.y + f.h / 2) * TILE + 10]; }

  /** One picket: outlined, lit on the left, shaded on the right, with a pointed head. Its foot stands at (x, y). */
  private picket(x: number, y: number, w: number, hgt: number, two: boolean): void {
    const z = this.cam.zoom, px = Math.round(x - w / 2), top = Math.round(y - hgt);
    this.block(px, top, w, hgt, two ? '#7a5430' : '#8a6238', two ? '#9a6c3c' : '#aa7c48', two ? '#4f3620' : '#5e4026');
    this.shape([[px - 0.5, top], [x, top - 4 * z], [px + w + 0.5, top]], two ? '#9a6c3c' : '#aa7c48');
  }

  /** The wall pieces touching a piece: beside it, above it and below it, and (a single fence piece only) at its corners. */
  private wallNeighbours(b: Building, wallAt: Map<number, Building>): Building[] {
    const N = this.sim.world.size, f = footOf(b), out = new Set<Building>(), single = b.kind !== 'gate' && f.w * f.h === 1;
    for (let j = -1; j <= f.h; j++) for (let i = -1; i <= f.w; i++) {
      if (i >= 0 && i < f.w && j >= 0 && j < f.h) continue;
      const corner = (i < 0 || i >= f.w) && (j < 0 || j >= f.h);
      if (corner && !single) continue;
      const o = wallAt.get((b.y + j) * N + b.x + i);
      if (o && o !== b && !(corner && o.kind === 'gate')) out.add(o); // a gate is joined square on, never across a corner
    }
    return [...out];
  }

  /** The rails (and a middle picket) from a wall piece to the pieces touching it: each link is drawn once, by the piece below or to the right of the other. A piece with no neighbour gets a short stub of rail either side. */
  private drawWallLinks(b: Building, wallAt: Map<number, Building>, two: boolean, prog = 1): void {
    const { ctx } = this, z = this.cam.zoom, [gx, gy] = this.groundOf(b), p = this.worldToScreen(gx, gy);
    const rails = two ? [19, 9] : [16, 8], th = (two ? 2.4 : 1.8) * z, tie = two ? '#8a6238' : '#d8c690', tieL = two ? '#aa7c48' : '#f0e2b0';
    const rail = (x0: number, y0: number, x1: number, y1: number, h: number) => {
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = th + 2; ctx.beginPath(); ctx.moveTo(x0, y0 - h * z); ctx.lineTo(x1, y1 - h * z); ctx.stroke();
      ctx.strokeStyle = tie; ctx.lineWidth = th; ctx.beginPath(); ctx.moveTo(x0, y0 - h * z); ctx.lineTo(x1, y1 - h * z); ctx.stroke();
      ctx.strokeStyle = tieL; ctx.lineWidth = Math.max(1, th * 0.35); ctx.beginPath(); ctx.moveTo(x0, y0 - h * z - th * 0.25); ctx.lineTo(x1, y1 - h * z - th * 0.25); ctx.stroke();
    };
    const near = this.wallNeighbours(b, wallAt);
    for (const o of near) {
      if (!(o.y < b.y || (o.y === b.y && o.x < b.x))) continue; // the other piece draws this link
      const [ox, oy] = this.groundOf(o), q = this.worldToScreen(ox, oy), len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len < 1) continue;
      const ux = (q.x - p.x) / len, uy = (q.y - p.y) / len;
      const r0 = this.wallReach(b, ux, uy, wallAt) * z, r1 = this.wallReach(o, -ux, -uy, wallAt) * z;
      if (len - r0 - r1 <= 1) continue;
      const x0 = p.x + ux * r0, y0 = p.y + uy * r0, x1 = q.x - ux * r1, y1 = q.y - uy * r1;
      const lp = Math.min(prog, o.done ? 1 : o.progress); // a span under construction: the low rail first, then the high one and the middle picket
      for (const h of lp >= 0.75 ? rails : lp >= 0.5 ? [rails[1]] : []) rail(x0, y0, x1, y1, h);
      const lowerTwo = o.level >= 2 && b.level >= 2;
      if (lp >= 0.75 && len - r0 - r1 > 14 * z) this.picket((x0 + x1) / 2, (y0 + y1) / 2, 5 * z, (lowerTwo ? 22 : 19) * z, lowerTwo); // the middle picket of the span
    }
    if (!near.length && b.kind !== 'gate' && prog >= 0.75) for (const s of [-1, 1]) for (const h of rails) rail(p.x, p.y, p.x + s * 10 * z, p.y, h); // a lone piece
  }

  /** A fence piece: rails to its neighbours (straight or across a corner, so a diagonal row is joined too), and its post. */
  /** `prog` below 1 is a piece being built: a stake that grows into the post, then the low rail, then the high rail and the pickets. */
  private drawFence(b: Building, wallAt: Map<number, Building>, prog = 1): void {
    const { ctx } = this, z = this.cam.zoom, [ax, ay] = this.anchorOf(b), p = this.worldToScreen(ax, ay), two = b.level >= 2;
    const full = two ? 30 : 27, hgt = full * Math.min(1, 0.2 + prog * 1.6);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 8 * z, 3.5 * z, 0, 0, Math.PI * 2); ctx.fill();
    this.drawWallLinks(b, wallAt, two, prog);
    this.picket(p.x, p.y, (two ? 8 : 7) * z, hgt * z, two); // the post, taller than the pickets between
    ctx.fillStyle = two ? '#9a6c3c' : '#c79a5e'; ctx.fillRect(Math.round(p.x - (two ? 4 : 3.5) * z), Math.round(p.y - hgt * z), Math.max(1, Math.round(z)), Math.round(hgt * z)); // lit edge
    if (prog < 1) { ctx.fillStyle = 'rgba(120,90,50,.55)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 1 * z, 10 * z, 4 * z, 0, 0, Math.PI * 2); ctx.fill(); } // trodden earth round a piece being built
  }

  /** A gate fills its one tile (posts 13 px out from its middle, a beam across them) and stands taller than the fence on either side, and shows plainly whether it is shut: shut, it has a red pennant and the leaves are closed and barred, the ground between the posts barred in red; open, a green pennant, the leaves stand swung out and a path is laid between the posts. It runs along the column when fence lies above or below it and none beside it. */
  private drawGate(b: Building, wallAt: Map<number, Building>, prog = 1): void {
    const { ctx } = this, z = this.cam.zoom, N = this.sim.world.size, at = (dx: number, dy: number) => wallAt.has((b.y + dy) * N + b.x + dx);
    const col = this.gateCol(b, wallAt), two = b.level >= 2, open = b.open;
    this.drawWallLinks(b, wallAt, two, prog); // the rails of the fence on either side run up to its posts
    const f = footOf(b), L = Math.max(f.w, f.h), p = this.worldToScreen((b.x + f.w / 2) * TILE, (b.y + f.h / 2) * TILE + 4);
    const sign = open ? '#4fbf5a' : '#d9473f', signDark = open ? '#2a7a33' : '#8f2620';
    // u runs along the gate, v across it (towards the viewer), h up from the ground
    const X = (u: number, v = 0) => (col ? p.x + v * z : p.x + u * z), Y = (u: number, h: number, v = 0) => (col ? p.y + u * z : p.y + v * z) - h * z;
    const U = L * 16 - 3, top = (two ? 46 : 40) * Math.min(1, 0.2 + prog * 1.6), pw = two ? 8 : 6; // being built: the posts rise first, then the leaves, then the beam and the banner
    const leaves = prog >= 0.6;
    const wood = '#8a6238', woodL = '#aa7c48', woodD = '#5e4026', stone = '#8e9498', stoneL = '#b9bfc2', stoneD = '#60676b', iron = '#454a52';
    // the ground between the posts: a green path when open, barred in red when shut
    ctx.fillStyle = open ? 'rgba(90,200,90,.30)' : 'rgba(217,71,63,.26)';
    if (col) ctx.fillRect(Math.round(p.x - 7 * z), Math.round(p.y - U * z), Math.round(14 * z), Math.round(2 * U * z));
    else ctx.fillRect(Math.round(p.x - U * z), Math.round(p.y - 7 * z), Math.round(2 * U * z), Math.round(14 * z));
    const shadow = (u: number) => { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(X(u), Y(u, 0), 6 * z, 3 * z, 0, 0, Math.PI * 2); ctx.fill(); };
    const post = (u: number) => {
      shadow(u);
      const x = X(u) - pw * z / 2, y = Y(u, top);
      if (two) { // stone posts, laid in courses, with a cap
        this.block(x, y, pw * z, top * z, stone, stoneL, stoneD);
        ctx.fillStyle = stoneD; for (const h of [8, 16, 24, 32]) ctx.fillRect(Math.round(x), Math.round(Y(u, h)), Math.round(pw * z), Math.max(1, Math.round(z * 0.8)));
        this.block(x - 1.5 * z, y - 3 * z, (pw + 3) * z, 3 * z, stoneL, '#d3d8da', stone);
      } else {
        this.block(x, y, pw * z, top * z, woodD, wood, '#3e2916');
        ctx.fillStyle = woodL; ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(z * 1.5)), Math.round(top * z));
        this.shape([[x - 0.5, y], [X(u), y - 4 * z], [x + pw * z + 0.5, y]], woodL);
      }
      // iron bands where the leaves hang
      ctx.fillStyle = iron; for (const h of [10, top - 14]) ctx.fillRect(Math.round(x), Math.round(Y(u, h)), Math.round(pw * z), Math.max(2, Math.round(2 * z)));
    };
    const planks = (u0: number, u1: number, h0: number, h1: number, t = 0) => {
      // a leaf: boards side by side, two iron bands across and a diagonal brace
      const x0 = X(u0), x1 = X(u1), yA = Y(u0, h1), yB = Y(u1, h1), yC = Y(u1, h0), yD = Y(u0, h0);
      this.shape([[x0 - t, yA], [x1 - t, yB], [x1 + t, yC], [x0 + t, yD]], wood);
      ctx.strokeStyle = woodD; ctx.lineWidth = Math.max(1, z * 0.8);
      const n = 5; for (let i = 1; i < n; i++) { const f = i / n; ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * f - t, yA + (yB - yA) * f); ctx.lineTo(x0 + (x1 - x0) * f + t, yD + (yC - yD) * f); ctx.stroke(); }
      ctx.strokeStyle = iron; ctx.lineWidth = Math.max(2, 2 * z);
      for (const f of [0.2, 0.8]) { const ya = yA + (yD - yA) * f, yb = yB + (yC - yB) * f; ctx.beginPath(); ctx.moveTo(x0 - t, ya); ctx.lineTo(x1 + t, yb); ctx.stroke(); }
      ctx.strokeStyle = woodD; ctx.lineWidth = Math.max(2, 2.4 * z); ctx.beginPath(); ctx.moveTo(x0, yD); ctx.lineTo(x1, yB); ctx.stroke();
    };
    post(-U);
    if (!leaves) { /* only the posts stand yet */ } else if (open) {
      // each leaf swung out to the front from its post
      for (const s of [-1, 1]) {
        const h0 = 4, h1 = top - 10, leaf = U - 3, hinge = s * (U - 3), freeU = s * (U - 3 - leaf * 0.5), v = leaf * 0.86;
        const x0 = X(hinge), x1 = X(freeU, v);
        this.shape([[x0, Y(hinge, h1)], [x1, Y(freeU, h1, v)], [x1, Y(freeU, h0, v)], [x0, Y(hinge, h0)]], wood);
        ctx.strokeStyle = iron; ctx.lineWidth = Math.max(2, 2 * z);
        for (const f of [0.2, 0.8]) { const ya = Y(hinge, h1) + (Y(hinge, h0) - Y(hinge, h1)) * f, yb = Y(freeU, h1, v) + (Y(freeU, h0, v) - Y(freeU, h1, v)) * f; ctx.beginPath(); ctx.moveTo(x0, ya); ctx.lineTo(x1, yb); ctx.stroke(); }
        ctx.strokeStyle = woodD; ctx.lineWidth = Math.max(1, z * 0.8); for (let i = 1; i < 4; i++) { const f = i / 4; ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * f, Y(hinge, h1) + (Y(freeU, h1, v) - Y(hinge, h1)) * f); ctx.lineTo(x0 + (x1 - x0) * f, Y(hinge, h0) + (Y(freeU, h0, v) - Y(hinge, h0)) * f); ctx.stroke(); }
      }
    } else {
      const t = col ? 3 * z : 0;
      planks(-U + 3, -1, 4, top - 10, t); planks(1, U - 3, 4, top - 10, t);
      ctx.fillStyle = iron; ctx.beginPath(); ctx.arc(X(-3), Y(-3, top / 2 - 3), 1.6 * z, 0, Math.PI * 2); ctx.arc(X(3), Y(3, top / 2 - 3), 1.6 * z, 0, Math.PI * 2); ctx.fill();
    }
    post(U);
    if (prog < 0.85) return;
    // the beam across the posts, carved at its ends, with a banner hung from the middle and a pennant on a pole above it
    const bx0 = X(-U - 4), bx1 = X(U + 4), by0 = Y(-U - 4, top), by1 = Y(U + 4, top);
    this.shape([[bx0, by0 - 4 * z], [bx1, by1 - 4 * z], [bx1, by1 + 3 * z], [bx0, by0 + 3 * z]], two ? stoneD : woodD);
    ctx.strokeStyle = two ? stoneL : woodL; ctx.lineWidth = Math.max(1, 1.4 * z); ctx.beginPath(); ctx.moveTo(bx0, by0 - 3.2 * z); ctx.lineTo(bx1, by1 - 3.2 * z); ctx.stroke();
    const cx = X(0), cy = Y(0, top);
    ctx.fillStyle = '#2b1d10'; ctx.fillRect(Math.round(cx - 1 * z), Math.round(cy - 18 * z), Math.max(2, Math.round(2 * z)), Math.round(15 * z));
    this.shape([[cx + 1 * z, cy - 18 * z], [cx + 8 * z, cy - 15.5 * z], [cx + 1 * z, cy - 12 * z]], sign);
    // a hanging banner below the beam: the colour of the state, with a white mark
    this.shape([[cx - 4 * z, cy + 3 * z], [cx + 4 * z, cy + 3 * z], [cx + 4 * z, cy + 12 * z], [cx, cy + 15 * z], [cx - 4 * z, cy + 12 * z]], sign);
    ctx.fillStyle = signDark; ctx.fillRect(Math.round(cx - 4 * z), Math.round(cy + 10 * z), Math.round(8 * z), Math.round(2 * z));
    ctx.strokeStyle = '#fff6e8'; ctx.lineWidth = Math.max(1.5, 1.8 * z); ctx.lineCap = 'round'; ctx.beginPath();
    if (open) { ctx.moveTo(cx, cy + 10 * z); ctx.lineTo(cx, cy + 5 * z); ctx.moveTo(cx - 2 * z, cy + 7 * z); ctx.lineTo(cx, cy + 4.5 * z); ctx.lineTo(cx + 2 * z, cy + 7 * z); }
    else { ctx.moveTo(cx - 2.5 * z, cy + 7 * z); ctx.lineTo(cx + 2.5 * z, cy + 7 * z); }
    ctx.stroke(); ctx.lineCap = 'butt';
  }

  /** Current level's sprite; while an upgrade runs the finished building stays drawn, with a progress bar. */
  private buildingProp(b: Building): Prop {
    if (this.sim.dev.palace && b.kind === 'campfire' && b.done) return this.sprites.palace();
    const st = b.done ? 4 : Math.min(3, Math.floor(b.progress * 4));
    return this.sprites.building(b.kind, b.era, b.level, st, b.kind === 'gate' && b.open);
  }

  /** Sound only for what happens near the middle of the screen: inside an ellipse of `range` × half the screen (sounds.json). */
  private nearCenter(sx: number, sy: number): boolean {
    const dx = (sx - this.w / 2) / (this.w / 2), dy = (sy - this.h / 2) / (this.h / 2);
    return dx * dx + dy * dy <= soundsJson.range * soundsJson.range;
  }

  private rainCache: { key: string; tiles: HTMLCanvasElement[] } | null = null;
  /** Two tiles of rain streaks (made once for a kind of weather); a streak slants with the wind. */
  private rainTiles(kind: WeatherKind, density: number, wind: number): HTMLCanvasElement[] {
    const key = `${kind}|${density}|${wind}`;
    if (this.rainCache?.key === key) return this.rainCache.tiles;
    const len = kind === 'drizzle' ? 8 : 15, sx = wind * len, n = Math.max(1, Math.round(density * (RAIN_TILE * RAIN_TILE) / 700000 / 2));
    const tiles = [0, 1].map((layer) => {
      const c = document.createElement('canvas'); c.width = c.height = RAIN_TILE;
      const g = c.getContext('2d')!;
      g.strokeStyle = kind === 'drizzle' ? 'rgba(200,215,235,.35)' : 'rgba(200,215,235,.5)'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = hash2(i, 2 + layer * 5, 41) * RAIN_TILE, y = hash2(i, 1 + layer * 5, 41) * RAIN_TILE;
        for (const dx of x - sx < 0 ? [0, RAIN_TILE] : [0]) for (const dy of y - len < 0 ? [0, RAIN_TILE] : [0]) { g.moveTo(x + dx, y + dy); g.lineTo(x + dx - sx, y + dy - len); } // a streak that leaves the tile comes in again on the other side
      }
      g.stroke();
      return c;
    });
    this.rainCache = { key, tiles };
    return tiles;
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
      // the rain is two tiles of streaks drawn once, then scrolled: a few drawImage calls a frame instead of hundreds of lines
      const tiles = this.rainTiles(kind, fx.rain, fx.wind);
      for (const [i, sp] of [650, 900].entries()) {
        const ox = (time * sp * fx.wind) % RAIN_TILE, oy = (time * sp) % RAIN_TILE;
        for (let x = ox - RAIN_TILE; x < w; x += RAIN_TILE) for (let y = oy - RAIN_TILE; y < h; y += RAIN_TILE) ctx.drawImage(tiles[i], Math.round(x), Math.round(y));
      }
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
        if (slot !== this.thunderSlot) { this.thunderSlot = slot; this.audio?.thunder(); }
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


  draw(time: number, selected: ReadonlySet<number>, box: Box | null, markers: Marker[], ghost: Ghost | null = null, selBuilding: number | null = null, inspect: { kind: 'unit' | 'animal' | 'node' | 'tent'; id: number } | null = null, group: readonly number[] = []): void {
    const { ctx, cam, sim } = this, z = cam.zoom, world = sim.world, N = world.size, sp = this.sprites;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0d16'; ctx.fillRect(0, 0, this.w, this.h);

    const cx = Math.round(cam.x), cy = Math.round(cam.y), ts = TILE * z, nat = sp.nature(sim.season); sp.setWorld(sim.era, sim.season);
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
        else if (t === Tile.Mountain) img = nat.mountainFloor[Math.floor(r * nat.mountainFloor.length)];
        else img = nat.grass[Math.floor(r * nat.grass.length)];
        ctx.drawImage(img, px(i), py(j), ts, ts);
      }
    }
    const trees = nat.trees, strips = new Set<number>();

    // ---- vật thể + công trình + dân, sắp theo y ----
    const list: Drawable[] = [];
    const fireB = sim.dev.palace ? sim.campfire() : undefined, bare = (x: number, y: number) => !!fireB && fireB.done && Math.hypot(x - (fireB.x + 1), y - (fireB.y + 1)) <= 15; // the dev look at the palace: what stands round it is not drawn
    for (let j = j0; j <= Math.min(N - 1, j1 + 2); j++) {
      for (let i = Math.max(0, i0 - 1); i <= Math.min(N - 1, i1 + 1); i++) {
        if (fireB && bare(i + 0.5, j + 0.5)) continue;
        const t = world.at(i, j);
        if (t === Tile.Tree) list.push({ y: j * TILE + 28, kind: 'tree', i, j });
        else if (t === Tile.Rock) list.push({ y: j * TILE + 28, kind: 'rock', i, j });
        else if (t === Tile.Ore) list.push({ y: j * TILE + 28, kind: 'ore', i, j });
        else if (t === Tile.Mountain && !strips.has(j * 65536 + (i >> 3))) { strips.add(j * 65536 + (i >> 3)); list.push({ y: (j + 1) * TILE - 1, kind: 'mountain', i: i >> 3, j }); } // a strip of the range, 8 tiles wide, in front of what is behind it
        else if (t === Tile.Bush) list.push({ y: j * TILE + 28, kind: 'bush', i, j });
      }
    }
    const vx0 = cx - 128, vx1 = cx + this.w / z + 128, vy0 = cy - 128, vy1 = cy + this.h / z + 128;
    const onScr = (x: number, y: number) => x * TILE >= vx0 && x * TILE <= vx1 && y * TILE >= vy0 && y * TILE <= vy1; // tiles; whoever is off the screen is not drawn at all
    for (const b of sim.buildings) {
      const [ax, ay] = this.anchorOf(b);
      if (ax < vx0 || ax > vx1 || ay < vy0 || ay > vy1) continue;
      if (fireB && b.kind !== 'campfire' && bare(b.x + footOf(b).w / 2, b.y + footOf(b).h / 2)) continue;
      list.push({ y: ay, kind: 'building', i: 0, j: 0, b });
    }
    for (const v of sim.villagers) if (v.inside === null && !v.inTent && onScr(v.x, v.y)) list.push({ y: v.y * TILE, kind: 'villager', i: 0, j: 0, v });
    const seen = (x: number, y: number) => sim.fog.state[Math.floor(y) * N + Math.floor(x)] === 2;
    for (const f of sim.foes) if (!f.inTent && onScr(f.x, f.y) && seen(f.x, f.y)) list.push({ y: f.y * TILE, kind: 'villager', i: 0, j: 0, v: f });
    for (const a of sim.animals) if (onScr(a.x, a.y) && seen(a.x, a.y)) list.push({ y: a.state === 'dead' ? a.y * TILE - 1 : a.y * TILE, kind: 'animal', i: 0, j: 0, a });
    // the works of a village are drawn one by one, each where its own feet stand: a village is a dozen tiles wide, and it must not vanish as its fire leaves the screen
    for (const t of sim.tribes) {
      for (const p of t.props) {
        if (p.kind === 'fire' && t.state === 'destroyed') continue;
        const [ax, ay] = this.buildingAnchor(this.propKind(p), p.x, p.y);
        if (ax < vx0 || ax > vx1 || ay < vy0 || ay > vy1 || sim.fog.state[Math.floor(p.y) * N + Math.floor(p.x)] === 0) continue;
        list.push({ y: ay, kind: 'camp', i: 0, j: 0, t, p });
      }
    }
    for (const pl of sim.plans) if (pl.status === 'running') for (const t of pl.tents) if (onScr(t.x, t.y)) list.push({ y: (t.y + 1) * TILE, kind: 'ftent', i: 0, j: 0, ft: t }); // the tents of a war
    list.sort((a, b) => a.y - b.y);
    // every wall piece joins the pieces beside it (and across a corner) with rails of its own: drawn from this map, not from tile sprites
    const wallAt = new Map<number, Building>();
    for (const b of sim.buildings) if (b.kind === 'fence' || b.kind === 'gate') { const f = footOf(b); for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) wallAt.set((b.y + j) * N + b.x + i, b); }
    for (const d of list) {
      if (d.kind === 'tree') {
        const p = trees[Math.floor(hash2(d.i, d.j, 21) * trees.length)];
        this.prop(p, d.i * TILE + 16, d.y, time);
      } else if (d.kind === 'mountain') {
        let m = this.mountains.get(world); if (!m) this.mountains.set(world, m = new Mountains(world));
        const pic = m.strip(d.i, d.j, sim.season === 'winter' ? 40 : sim.season === 'summer' ? 58 : 52);
        if (pic) { const [ox, oy] = stripOrigin(d.i, d.j); ctx.drawImage(pic, Math.round((ox - cam.x) * z), Math.round((oy - cam.y) * z), pic.width * z, pic.height * z); }
      } else if (d.kind === 'rock') {
        this.prop(nat.rocks[Math.floor(hash2(d.i, d.j, 22) * nat.rocks.length)], d.i * TILE + 16, d.y, time);
      } else if (d.kind === 'ore') {
        const res = world.nodeAt(d.i, d.j)?.res, set = res === 'coal' ? nat.coal : res === 'copper_ore' ? nat.copperOre : res === 'rare_ore' ? nat.rareOre : nat.ironOre; // the seam is iron ore, coal or copper ore (the node says which)
        this.prop(set[Math.floor(hash2(d.i, d.j, 24) * set.length)], d.i * TILE + 16, d.y, time);
      } else if (d.kind === 'bush') {
        const n = world.nodeAt(d.i, d.j), k = Math.floor(hash2(d.i, d.j, 23) * nat.bush.length);
        this.prop((n && n.amount === 0 ? nat.bushEmpty : nat.bush)[k], d.i * TILE + 16, d.y, time);
      } else if (d.kind === 'building' && d.b) {
        const b = d.b, [ax, ay] = this.anchorOf(b);
        if (b.kind === 'gate') this.drawGate(b, wallAt, b.done ? 1 : b.progress);
        else if (b.kind === 'fence') this.drawFence(b, wallAt, b.done ? 1 : b.progress);
        else this.prop(this.buildingProp(b), ax, ay, time, ghost?.moving === b.id || ghost?.movingIds?.includes(b.id) ? 0.5 : 1); // the house being carried stays dim where it stands
        this.drawDamage(b, ax, ay, time);
        if (b.kind === 'tower' && b.done) { // whoever has been sent up the tower is seen on it
          let n = 0, shooting = false; for (const v of sim.villagers) if (v.post === b.id && v.job === 'fight') { n++; if (v.swing) shooting = true; }
          this.drawTowerMen(ax, ay, b.era === 'ancient' && b.level > BUILDINGS.tower.levels.stone!.length ? 3 : b.level >= 2 ? 2 : 1, n, time, shooting);
        }
        this.fxl.watchBuilding(b, ax, ay, BUILDINGS[b.kind].w, BUILDINGS[b.kind].h, time);
        const emblem = b.done ? sp.emblems[b.kind] : undefined;
        if (emblem) { const p = this.worldToScreen(ax, ay - 52); ctx.drawImage(emblem, Math.round(p.x - 8 * z), Math.round(p.y), 16 * z, 16 * z); }
        // a house that works to orders shows how far the order has got, or sleeps when it has none
        if (b.done && (b.kind === 'lab' || b.kind === 'workshop' || b.kind === 'stable' || b.kind === 'builder')) {
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
      } else if (d.kind === 'ftent' && d.ft) {
        const [ax, ay] = this.buildingAnchor('fieldtent', Math.floor(d.ft.x) - 1, Math.floor(d.ft.y) - 1);
        this.prop(sp.building('fieldtent', 'stone', 1, 4), ax, ay, time, d.ft.built ? 1 : 0.5); // half-seen while it is being pitched
      } else if (d.kind === 'camp' && d.t && d.p) {
        const t = d.t, p = d.p, kind = this.propKind(p), [ax, ay] = this.buildingAnchor(kind, p.x, p.y), alpha = t.state === 'destroyed' && p.kind !== 'fire' ? 0.5 : 1;
        if (p.kind === 'gate' || p.kind === 'fence') {
          const b = this.wallStub(p), walls = this.wallsOf(t);
          if (p.kind === 'gate') this.drawGate(b, walls);
          else this.drawFence(b, walls);
        } else this.prop(sp.building(kind, 'stone', p.kind === 'fire' ? 1 : p.lv ?? 1, 4), ax, ay, time, alpha);
        // a work of a village that has been hurt shows it as ours do: a bar, smoke, flames
        if (p.hp > 0) this.drawWear(kind, p.hp / Math.max(1, maxPropHp(t, p)), p.x * 31 + p.y, ax, ay, time, p.lv ?? 1, sp.building(kind, 'stone', p.kind === 'fire' ? 1 : p.lv ?? 1, 4).ay);
        if (kind === 'tower' && p.hp > 0) { // the guards of a village's tower stand up on it
          let n = 0, shooting = false; for (const f of sim.foes) if (f.ai?.tower && f.ai.tower.x === p.x && f.ai.tower.y === p.y) { n++; if (f.swing) shooting = true; }
          this.drawTowerMen(ax, ay, (p.lv ?? 1) >= 2 ? 2 : 1, n, time, shooting);
        }
      } else if (d.v) {
        const rode = d.v.phase !== 'sleep' && d.v.phase !== 'down' ? sim.mountOf(d.v) : null, fighting = !!d.v.swing || d.v.flinch > 0 || d.v.anim === 'down';
        // a rider is seen from the side, the way his beast faces: up and down the screen he keeps the side he last had
        if (d.v.facing === 'left' || d.v.facing === 'right') this.sideOf.set(d.v, d.v.facing);
        const side = this.sideOf.get(d.v) ?? 'right', moving0 = d.v.path.length > 0 || !!d.v.slide;
        // a rider of the medieval age has seated animations of his own for every state (rider_*: guard, charge, thrust): they are the ones the sim chose, not the standing ones
        const seated = !!rode && d.v.anim.startsWith('rider_'), gallop = d.v.anim === 'rider_charge';
        // up and down the screen a rider of a species drawn from the front and behind (the horse) faces the way he goes, beast and all
        const vdir = rode && sp.hasViews(MOUNTS[rode].species) && (d.v.facing === 'front' || d.v.facing === 'back') ? d.v.facing : null;
        const s = seated ? sp.villager(d.v, undefined, vdir ?? side) : rode && !fighting ? sp.villager(d.v, moving0 ? 'ride_walk' : 'ride', vdir ?? side) : sp.villager(d.v), fx = d.v.x * TILE, fy = d.v.y * TILE;
        let lift = 0, afterRider: (() => void) | null = null;
        if (rode) { // a beast under him: it walks when he walks, and he sits on its back in the seated animations (ride, ride_walk in anims.json: the same two for every beast)
          const m = MOUNTS[rode], moving = moving0, box = sp.animalBox(m.species, vdir ?? undefined);
          ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(Math.round((fx - cx) * z), Math.round((fy - cy) * z), box.w * (vdir ? 0.45 : 0.3) * z, box.h * (vdir ? 0.07 : 0.1) * z, 0, 0, Math.PI * 2); ctx.fill();
          if (vdir) { // the part of the beast behind him now, the part in front of him after him
            const parts = sp.mountView(m.species, moving, d.v.animClock, gallop, vdir), bx = Math.round((fx - box.ax - cx) * z), by = Math.round((fy - box.ay - cy) * z);
            ctx.drawImage(parts.rear, bx, by, parts.rear.width * z, parts.rear.height * z);
            afterRider = () => ctx.drawImage(parts.over, bx, by, parts.over.width * z, parts.over.height * z);
          } else {
            const beast = sp.mount(m.species, moving, d.v.animClock, side === 'left' ? -1 : 1, gallop);
            ctx.drawImage(beast, Math.round((fx - box.ax - cx) * z), Math.round((fy - box.ay - cy) * z), beast.width * z, beast.height * z);
          }
          lift = m.ride + 1; // the seated animations bob by themselves
        }
        if (d.v.phase === 'sleep' || d.v.phase === 'down') {
          // lying asleep: sprite rotated 90°, head to the left
          ctx.save(); ctx.translate(Math.round((fx + 16 - cx) * z), Math.round((fy - 2 - cy) * z)); ctx.rotate(-Math.PI / 2);
          ctx.drawImage(s, -SPRITE_FEET.x * z, -SPRITE_FEET.y * z, s.width * z, s.height * z); ctx.restore();
        } else ctx.drawImage(s, Math.round((fx - SPRITE_FEET.x - cx + (rode && !vdir ? (MOUNTS[rode].dx ?? 0) * (side === 'left' ? -1 : 1) : 0)) * z), Math.round((fy - lift - SPRITE_FEET.y - cy) * z), s.width * z, s.height * z);
        afterRider?.();
        const v = d.v;
        if (v.phase === 'work') this.fxl.watchWorker(v, fx, fy - lift, time);
        if (this.audio?.sfxOn && this.nearCenter((fx - cx) * z, (fy - cy) * z)) this.audio.watchAnim(v, v.anim, v.animClock, animClip, time, isHorse(rode) && /walk|run|charge/.test(v.anim) ? (v.anim.includes('charge') ? 'horse_charge' : v.anim.includes('walk') ? 'horse_walk' : 'horse_gallop') : isHorse(rode) && /idle|guard/.test(v.anim) ? 'horse_idle' : footSound(v.anim, v.armor)); // on a horse: hooves, not boots; standing, now and then a neigh
        // a small badge tells soldiers (red) and hunters (amber) from civilians
        if (v.team === 'player' && (v.job === 'fight' || v.job === 'hunt') && v.phase !== 'flee' && v.phase !== 'sleep' && v.phase !== 'down') {
          const p = this.worldToScreen(fx, fy - lift - (v.health < v.maxHealth ? 54 : 48)), u = Math.max(1, Math.round(z));
          ctx.fillStyle = 'rgba(20,14,8,.85)'; ctx.fillRect(p.x - 3 * u, p.y - 4 * u, 6 * u, 7 * u);
          ctx.fillStyle = v.job === 'fight' ? '#d9534f' : '#e0a23c'; ctx.fillRect(p.x - 2 * u, p.y - 3 * u, 4 * u, 4 * u); ctx.fillRect(p.x - u, p.y + u, 2 * u, u);
        }
        if (v.health < v.maxHealth && (v.health > 0 || v.down > 0)) this.bar(fx, fy - lift - 46, v.health / v.maxHealth, v.team === 'player' ? '#6bbf59' : '#d9534f');
        if (v.down > 0) { ctx.fillStyle = '#ffd27a'; ctx.font = `700 ${Math.max(11, 6 * z)}px system-ui, sans-serif`; ctx.textAlign = 'center'; const p = this.worldToScreen(fx, fy - 30); ctx.fillText(gameDays(v.down, this.sim.dayLen), p.x, p.y); }
        if (v.team === 'player' && this.sim.encounters.visitors.some((g) => g.escort.some((e) => e.id === v.id))) { // a guard sent to stop strangers (on his way, or holding them): a shield over his head
          const p = this.worldToScreen(fx, fy - lift - 66), r = 8 * z;
          ctx.fillStyle = 'rgba(20,14,8,.85)'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e0b43c'; ctx.beginPath();
          ctx.moveTo(p.x - r * 0.5, p.y - r * 0.5); ctx.lineTo(p.x + r * 0.5, p.y - r * 0.5); ctx.lineTo(p.x + r * 0.5, p.y + r * 0.05); ctx.lineTo(p.x, p.y + r * 0.6); ctx.lineTo(p.x - r * 0.5, p.y + r * 0.05); ctx.closePath(); ctx.fill();
        }
        if (v.ai?.guest !== undefined && this.sim.encounters.visitors.some((g) => g.unitId === v.id && g.state === 'waiting')) { // a guest waits to be received: a bobbing mark over the head
          const p = this.worldToScreen(fx, fy - lift - 58 + Math.sin(time * 3) * 2), r = 8 * z;
          ctx.fillStyle = 'rgba(20,14,8,.85)'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e0b43c'; ctx.font = `700 ${Math.max(11, 11 * z)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', p.x, p.y + 1); ctx.textBaseline = 'alphabetic';
        }
        if (v.phase === 'flee') { ctx.fillStyle = '#fff6e8'; ctx.font = `700 ${Math.max(12, 7 * z)}px system-ui, sans-serif`; ctx.textAlign = 'center'; const p = this.worldToScreen(fx, fy - 50); ctx.fillText('!', p.x, p.y); }
      }
    }

    this.fxl.draw(ctx, cam, time); // sparks, dust and landings over the world, under the night

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
        const [ax, ay] = this.anchorOf(b), p = this.worldToScreen(ax, ay - 14), rad = 120 * z;
        const g = ctx.createRadialGradient(p.x, p.y, 4 * z, p.x, p.y, rad);
        g.addColorStop(0, `rgba(255,170,70,${(0.5 * dark).toFixed(3)})`); g.addColorStop(1, 'rgba(255,170,70,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
      }
      // Torch light: a marching column would be a gradient per bearer, so bearers within the same 2x2 tiles share one pre-drawn light (a little brighter for each extra one, capped).
      this.torchLight ??= (() => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
        gr.addColorStop(0, 'rgba(255,176,80,1)'); gr.addColorStop(1, 'rgba(255,176,80,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
      })();
      const cells = new Map<number, { x: number; y: number; n: number }>();
      for (const v of sim.villagers) {
        if (!v.lit || !onScr(v.x, v.y)) continue;
        const k = Math.floor(v.x / 2) * 4096 + Math.floor(v.y / 2), c = cells.get(k);
        if (c) { c.x += v.x; c.y += v.y; c.n++; } else cells.set(k, { x: v.x, y: v.y, n: 1 });
      }
      const rad = 52 * z, flick = 0.92 + 0.08 * Math.sin(time * 9);
      for (const c of cells.values()) {
        const p = this.worldToScreen((c.x / c.n) * TILE - 8, (c.y / c.n) * TILE - 22);
        ctx.globalAlpha = Math.min(0.75, 0.42 * dark * flick * (1 + 0.25 * (c.n - 1)));
        ctx.drawImage(this.torchLight, p.x - rad, p.y - rad, rad * 2, rad * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // ---- sương mù (làm mờ mép bằng nội suy) ----
    this.updateFog();
    const fi0 = Math.max(0, i0 - 1), fj0 = Math.max(0, j0 - 1), fi1 = Math.min(N, i1 + 2), fj1 = Math.min(N, j1 + 2);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogCanvas, fi0, fj0, fi1 - fi0, fj1 - fj0, px(fi0), py(fj0), (fi1 - fi0) * ts, (fj1 - fj0) * ts);
    ctx.imageSmoothingEnabled = false;

    if (!this.audio) sim.sfx.length = 0;
    if (this.audio) {
      this.audio.sweep(time);
      if (this.audio.sfxOn) for (const e of sim.sfx) if (this.nearCenter((e.x * TILE - cx) * z, (e.y * TILE - cy) * z)) this.audio.hit(e.weapon, e.ranged, time, e.rank, e.armor);
      const war = sim.warScene(); // the war music plays all through the war, wherever the camera is
      const onScreen = war.squads.length > 0;
      this.audio.setWar(onScreen, war.stings, time);
      sim.sfx.length = 0;
    }
    if (this.weatherFx) this.drawWeather(time);

    // ---- sleeping villagers ----
    ctx.font = `700 ${Math.max(10, 5 * z)}px system-ui, sans-serif`; ctx.textAlign = 'center';
    // one z for each little cluster of sleepers (a camp asleep would otherwise be a cloud of them, one for every villager), and never more than a few on the screen
    const zzz = new Set<number>();
    for (const v of sim.villagers) {
      if (v.phase !== 'sleep' || !onScr(v.x, v.y) || zzz.size >= 6) continue;
      const cell = Math.floor(v.x / 4) * 4096 + Math.floor(v.y / 4);
      if (zzz.has(cell)) continue;
      zzz.add(cell);
      const p = this.worldToScreen(v.x * TILE - 10, v.y * TILE - 14), k = (time * 0.6 + v.id * 0.37) % 1;
      ctx.fillStyle = `rgba(235,240,255,${(0.9 * (1 - k)).toFixed(2)})`;
      ctx.fillText('z', p.x + k * 6 * z, p.y - k * 10 * z);
    }

    // ---- an upgrade onto bigger ground: the picture of the house to come, the ground it takes, and in red what is in the way ----
    if (this.plan) {
      const pl = this.plan, rw = pl.rect.w, rh = pl.rect.h;
      try { this.prop(sp.building(pl.kind, pl.era, pl.level, 4), ...this.buildingAnchor(pl.kind, pl.rect.x, pl.rect.y, { w: rw, h: rh }), time, 0.55); } catch { /* a level that has no picture of its own yet is only framed */ }
      ctx.fillStyle = pl.ok ? 'rgba(90,200,90,.30)' : 'rgba(220,70,60,.30)'; ctx.fillRect(px(pl.rect.x), py(pl.rect.y), rw * ts, rh * ts);
      ctx.strokeStyle = pl.ok ? '#bff0b0' : '#ffb4a8'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]); ctx.strokeRect(px(pl.rect.x) + 1, py(pl.rect.y) + 1, rw * ts - 2, rh * ts - 2); ctx.setLineDash([]);
      for (const q of pl.blockers) { ctx.fillStyle = 'rgba(230,50,40,.5)'; ctx.fillRect(px(q.x), py(q.y), q.w * ts, q.h * ts); ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 3; ctx.strokeRect(px(q.x) + 1, py(q.y) + 1, q.w * ts - 2, q.h * ts - 2); }
    }

    // ---- bóng ma khi đặt công trình ----
    if (ghost?.group) {
      // pieces of fence carried together: each shows where it will stand, green when all fit, red when they do not
      this.drawTerritory(sim.buildings.filter((o) => !ghost.movingIds?.includes(o.id)));
      const Ng = sim.world.size, planned = new Map<number, Building>(), stubs = new Map<number, Building>();
      for (const o of sim.buildings) if ((o.kind === 'fence' || o.kind === 'gate') && !ghost.movingIds?.includes(o.id)) { const f = footOf(o); for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) planned.set((o.y + j) * Ng + o.x + i, o); }
      for (const q of ghost.group) { // the walls as they will stand, joined to each other and to the walls left where they are
        const stub = { id: -2 - q.id, kind: q.kind, era: sim.era, x: q.x, y: q.y, w: q.w ?? 1, h: q.h ?? 1, rot: q.rot === 1 ? 1 : 0, level: q.level, progress: 1, done: true, upgrading: false, rebuild: false, hp: 0, open: true, staff: [], active: null, workers: 0 } as Building;
        stubs.set(q.id, stub); for (let j = 0; j < stub.h!; j++) for (let i = 0; i < stub.w!; i++) planned.set((q.y + j) * Ng + q.x + i, stub);
      }
      for (const q of ghost.group) {
        const stub = stubs.get(q.id)!, was = ctx.globalAlpha; ctx.globalAlpha = 0.65;
        if (q.kind === 'gate') this.drawGate(stub, planned); else this.drawFence(stub, planned);
        ctx.globalAlpha = was;
        const qw = q.w ?? 1, qh = q.h ?? 1;
        ctx.fillStyle = ghost.ok ? 'rgba(90,200,90,.38)' : 'rgba(220,70,60,.42)'; ctx.fillRect(px(q.x), py(q.y), qw * ts, qh * ts);
        ctx.strokeStyle = ghost.ok ? '#bff0b0' : '#ffb4a8'; ctx.lineWidth = 2; ctx.strokeRect(px(q.x) + 1, py(q.y) + 1, qw * ts - 2, qh * ts - 2);
      }
    } else if (ghost) {
      const d = { w: ghost.w ?? BUILDINGS[ghost.kind].w, h: ghost.h ?? BUILDINGS[ghost.kind].h }, [ax, ay] = this.buildingAnchor(ghost.kind, ghost.x, ghost.y, d);
      // the free tile that houses keep from each other: round every standing house and round the ghost (walls keep none)
      if (!WALL_KINDS.has(ghost.kind)) {
        const zone = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(px(x - CLEAR), py(y - CLEAR), (w + 2 * CLEAR) * ts, (h + 2 * CLEAR) * ts); };
        for (const o of sim.buildings) if (!WALL_KINDS.has(o.kind) && o.id !== ghost.moving) zone(o.x, o.y, BUILDINGS[o.kind].w, BUILDINGS[o.kind].h, 'rgba(240,170,60,.16)');
        ctx.strokeStyle = 'rgba(255,220,120,.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
        ctx.strokeRect(px(ghost.x - CLEAR), py(ghost.y - CLEAR), (d.w + 2 * CLEAR) * ts, (d.h + 2 * CLEAR) * ts); ctx.setLineDash([]);
      }
      if (ghost.kind === 'fence' || ghost.kind === 'gate') { // a wall shows as it will stand, joined to the walls round it
        const N = sim.world.size, walls = new Map<number, Building>();
        for (const o of sim.buildings) if ((o.kind === 'fence' || o.kind === 'gate') && o.id !== ghost.moving) { const f = footOf(o); for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) walls.set((o.y + j) * N + o.x + i, o); }
        const stub = { id: -2, kind: ghost.kind, era: ghost.era ?? sim.era, x: ghost.x, y: ghost.y, w: d.w, h: d.h, rot: ghost.rot === 1 ? 1 : 0, level: ghost.level ?? 1, progress: 1, done: true, upgrading: false, rebuild: false, hp: 0, open: true, staff: [], active: null, workers: 0 } as Building;
        for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) walls.set((stub.y + j) * N + stub.x + i, stub);
        const was = ctx.globalAlpha; ctx.globalAlpha = 0.65;
        if (ghost.kind === 'gate') this.drawGate(stub, walls); else this.drawFence(stub, walls);
        ctx.globalAlpha = was;
      } else this.prop(sp.building(ghost.kind, ghost.era ?? sim.era, ghost.level ?? 1, 4), ax, ay, time, 0.6);
      this.drawTerritory(sim.buildings.filter((o) => o.id !== ghost.moving));
      const gs = buildingSight({ kind: ghost.kind, level: ghost.level ?? 1, done: true, era: ghost.era ?? sim.era });
      if (gs > 0) this.drawSight(ghost.x + d.w / 2, ghost.y + d.h / 2, gs); // what it will see, and hold as land of the village
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

    // ---- the pieces of fence chosen to be carried together ----
    for (const id of group) {
      const q = sim.getBuilding(id); if (!q) continue;
      ctx.fillStyle = 'rgba(255,214,90,.35)'; ctx.fillRect(px(q.x), py(q.y), ts, ts);
      ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 2; ctx.strokeRect(px(q.x) + 1, py(q.y) + 1, ts - 2, ts - 2);
    }

    // ---- selected building ----
    const sb = selBuilding === null ? undefined : sim.getBuilding(selBuilding);
    if (sb) {
      const d = footOf(sb);
      ctx.strokeStyle = '#f5e7c4'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(px(sb.x) + 1, py(sb.y) + 1, d.w * ts - 2, d.h * ts - 2); ctx.setLineDash([]);
      if (sb.done && buildingSight(sb) > 0) this.drawSight(sb.x + d.w / 2, sb.y + d.h / 2, buildingSight(sb)); // the land it holds
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
    if (this.cue) { // the box is ready: drag to draw it
      ctx.strokeStyle = '#f5e7c4'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(this.cue.x, this.cue.y, 26, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(245,231,196,.22)'; ctx.fill();
    }
  }
}
