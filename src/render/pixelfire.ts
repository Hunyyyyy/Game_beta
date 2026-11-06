/**
 * Fire drawn by code (pixelfx, see fx/NOTICE.md) laid over the JSON art of the campfire: the art keeps its stones, logs,
 * racks and pots of each level and loses only its drawn flames; the flames are baked here, bigger at each level.
 * Presentation only. Frames are baked once per level, on first use, into canvases like any other sprite.
 */
import { createFrame, clearFrame, createFx, composite } from './fx/core/index.js';
import * as campfireFx from './fx/fire/campfire.js';
import type { Prop } from './sprites';

const SIZE = 128, ORIGIN_X = 64, ORIGIN_Y = 112;
/** The hearth stands this many px above the art's anchor, and the loop's fps and length (s). */
const HEARTH_UP = 2, FPS = 24, LOOP = 3;
/** Flame height (px) per campfire level, by the key `${era}${level}`: the medieval hall keeps a small hearth fire. */
const HEIGHT: Record<string, number> = { stone1: 8, stone2: 11, stone3: 14, stone4: 16, ancient: 7 };

/** The art without its drawn flames and sparks (they are replaced). */
export function withoutFlames<T extends { layers?: Array<{ color?: unknown }> }>(def: T): T {
  return { ...def, layers: def.layers?.filter((l) => typeof l.color !== 'string' || !(l.color.startsWith('flame') || l.color === 'spark')) };
}

/** The built campfire: `base` (art with no flames) with a pixelfx fire on the hearth, looping. */
export function bakeCampfire(base: Prop, key: string): Prop {
  const n = FPS * LOOP, frame = createFrame(SIZE, SIZE), img = new ImageData(SIZE, SIZE), frames: HTMLCanvasElement[] = [];
  const dx = ORIGIN_X - base.ax, dy = ORIGIN_Y + HEARTH_UP - base.ay, still = base.frames[0];
  const fx = (createFx as any)(campfireFx, { x: ORIGIN_X, y: ORIGIN_Y, bare: true, height: HEIGHT[key] ?? 20 });
  for (let i = 0; i < n; i++) {
    clearFrame(frame);
    fx.draw(frame);
    composite(frame, img.data, null);
    const fire = document.createElement('canvas'); fire.width = fire.height = SIZE;
    fire.getContext('2d')!.putImageData(img, 0, 0);
    const c = document.createElement('canvas'); c.width = c.height = SIZE;
    const g = c.getContext('2d')!;
    g.drawImage(still, dx, dy); // the hearth's art underneath, the fire (and its light) over it
    g.drawImage(fire, 0, 0);
    frames.push(c);
    fx.update(1 / FPS);
  }
  return { frames, ax: ORIGIN_X, ay: ORIGIN_Y + HEARTH_UP, fps: FPS };
}

/** Any pixelfx effect baked into frames, at its own size and origin (the origin becomes the Prop's anchor). */
export function bakeFx(mod: any, opts: Record<string, unknown> = {}, fps = 30): Prop {
  const [w, h] = mod.meta.size as [number, number], [ox, oy] = mod.meta.origin as [number, number];
  const n = Math.max(1, Math.ceil(mod.meta.duration * fps)), frame = createFrame(w, h), img = new ImageData(w, h), frames: HTMLCanvasElement[] = [];
  const fx = (createFx as any)(mod, { x: ox, y: oy, ...opts });
  for (let i = 0; i < n; i++) {
    clearFrame(frame);
    fx.draw(frame);
    composite(frame, img.data, null);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d')!.putImageData(img, 0, 0);
    frames.push(c);
    fx.update(1 / fps);
  }
  return { frames, ax: ox, ay: oy, fps };
}
