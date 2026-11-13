/**
 * Short effects drawn by code (pixelfx, see fx/NOTICE.md) on top of the world: dust where a house is raised or grows a level, flames on a hurt house. Presentation only: it watches what the
 * Sim shows (health, level, done) from frame to frame and never writes to it. Every effect is baked once, on first use.
 */
import * as poof from './fx/spawn/poof.js';
import * as campfire from './fx/fire/campfire.js';
import animsJson from '../data/anims.json';
import workJson from '../data/workfx.json';
import { bakeFx } from './pixelfire';
import type { Prop } from './sprites';

type Kind = 'dust';
interface Live { prop: Prop; x: number; y: number; t0: number; scale: number }
/** One chip of wood or stone thrown by a blow: where it started, how it was thrown, its colour and size (px). */
interface Chip { x: number; y: number; vx: number; vy: number; t0: number; life: number; color: string; size: number }
interface Cam { x: number; y: number; zoom: number }

const DUST = ['#2e2318', '#5a4630', '#8a7152', '#b39a74', '#d8c7a0', '#f0e6c8'];
const MAKE: Record<Kind, () => Prop> = {
  dust: () => bakeFx(poof, { palette: DUST, stars: DUST.slice(2, 5) }),
};
/** Flame heights (px) a hurt house can burn with: the nearest one to what its level and wounds call for. */
const FLAMES = [5, 8, 11, 14];
const MAX_LIVE = 48;

export class FxLayer {
  private readonly baked = new Map<string, Prop>();
  private live: Live[] = [];
  private chips: Chip[] = [];
  private readonly strokes = new WeakMap<object, number>();
  private readonly seen = new WeakMap<object, { level: number; done: boolean }>();

  private prop(kind: Kind): Prop { let p = this.baked.get(kind); if (!p) this.baked.set(kind, p = MAKE[kind]()); return p; }

  /** Looping flames for a hurt house: `lv` is its level, `ratio` what is left of it. */
  flame(lv: number, ratio: number): Prop {
    const want = 4 + 1.5 * lv + (ratio < 0.15 ? 2 : 0), h = FLAMES.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
    const key = `flame${h}`; let p = this.baked.get(key);
    if (!p) this.baked.set(key, p = bakeFx(campfire, { bare: true, height: h, seed: 3 + h }, 24));
    return p;
  }

  burst(kind: Kind, x: number, y: number, time: number, scale: number): void {
    if (this.live.length >= MAX_LIVE) return;
    this.live.push({ prop: this.prop(kind), x, y, t0: time, scale });
  }

  /** A house: dust when it is finished or grows a level (bigger for a bigger house and a higher level). (x, y) is its anchor. */
  watchBuilding(o: { level: number; done: boolean }, x: number, y: number, w: number, h: number, time: number): void {
    const was = this.seen.get(o);
    if (was) {
      const size = Math.max(w, h);
      if ((!was.done && o.done) || (o.done && o.level > was.level)) this.burst('dust', x, y, time, 0.4 + 0.12 * size + 0.05 * o.level);
      was.level = o.level; was.done = o.done;
    } else this.seen.set(o, { level: o.level, done: o.done });
  }

  /**
   * Someone chopping or mining: on the frame of each stroke where the tool lands, a few chips of wood or stone fly off the tree or
   * rock in front of him, more of them (and bigger) with a better tool. (x, y) is his feet, in world px.
   */
  watchWorker(v: { anim: string; animClock: number; facing: string; hold: { tier: number } | null }, x: number, y: number, time: number): void {
    const cfg = (workJson as unknown as Record<string, { hitFrame: number; colors: string[]; count: number; perTier: number; speed: number; up: number; life: number }>)[v.anim], clip = (animsJson as Record<string, { fps: number; frames: unknown[] }>)[v.anim];
    if (!cfg || !clip || v.anim === 'idle') return;
    const step = Math.floor(v.animClock * clip.fps), frame = step % clip.frames.length, last = this.strokes.get(v);
    this.strokes.set(v, step);
    if (last === undefined || step === last || frame !== cfg.hitFrame) return;
    const dir = v.facing === 'left' ? [-1, 0] : v.facing === 'right' ? [1, 0] : v.facing === 'back' ? [0, -0.6] : [0, 0.6], tier = v.hold?.tier ?? 1, n = cfg.count + cfg.perTier * tier;
    const ox = x + dir[0] * workJson.reach, oy = y - workJson.height + dir[1] * workJson.reach;
    for (let i = 0; i < n && this.chips.length < workJson.maxChips; i++) {
      const a = Math.random() * Math.PI - Math.PI / 2, sp = cfg.speed * (0.5 + Math.random() * 0.7), side = dir[0] !== 0 ? -dir[0] : Math.random() < 0.5 ? -1 : 1; // thrown back out of the cut
      this.chips.push({ x: ox, y: oy, vx: side * Math.abs(Math.cos(a)) * sp, vy: -cfg.up * (0.4 + Math.random() * 0.8), t0: time, life: cfg.life * (0.7 + Math.random() * 0.6), color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)], size: tier >= 2 && Math.random() < 0.35 ? 2 : 1 });
    }
  }

  draw(ctx: CanvasRenderingContext2D, cam: Cam, time: number): void {
    const z = cam.zoom;
    this.chips = this.chips.filter((c) => {
      const age = time - c.t0;
      if (age < 0 || age >= c.life) return false;
      ctx.fillStyle = c.color; ctx.globalAlpha = Math.min(1, (c.life - age) / (c.life * 0.35));
      ctx.fillRect(Math.round((c.x + c.vx * age - cam.x) * z), Math.round((c.y + c.vy * age + 0.5 * workJson.gravity * age * age - cam.y) * z), c.size * Math.max(1, Math.round(z)), c.size * Math.max(1, Math.round(z)));
      ctx.globalAlpha = 1;
      return true;
    });
    this.live = this.live.filter((e) => {
      const f = Math.floor((time - e.t0) * e.prop.fps);
      if (f < 0 || f >= e.prop.frames.length) return false;
      const s = e.prop.frames[f], k = e.scale * z;
      ctx.drawImage(s, Math.round((e.x - cam.x) * z - e.prop.ax * e.scale * z), Math.round((e.y - cam.y) * z - e.prop.ay * e.scale * z), s.width * k, s.height * k);
      return true;
    });
  }
}
