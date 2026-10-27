import { AnimTable, CX, H, W, renderFrame } from '../character/rig.js';
import { Blueprint, BlueprintDef, toCanvases } from '../blueprint/blueprint';
import animsJson from '../data/anims.json';
import bushJson from '../data/blueprints/bush.json';
import campfireJson from '../data/blueprints/campfire.json';
import grassJson from '../data/blueprints/grass.json';
import mudJson from '../data/blueprints/mud.json';
import rockJson from '../data/blueprints/rock.json';
import storageJson from '../data/blueprints/storage.json';
import stumpJson from '../data/blueprints/stump.json';
import treePineJson from '../data/blueprints/tree_pine.json';
import treeRoundJson from '../data/blueprints/tree_round.json';
import toolAxeJson from '../data/blueprints/tool_axe.json';
import toolHoeJson from '../data/blueprints/tool_hoe.json';
import toolPickJson from '../data/blueprints/tool_pick.json';
import toolShovelJson from '../data/blueprints/tool_shovel.json';
import waterJson from '../data/blueprints/water.json';
import workshopJson from '../data/blueprints/workshop.json';
import type { Villager } from '../sim/sim';

export const anims = animsJson as unknown as AnimTable;
export const SPRITE_FEET = { x: CX, y: 42 };

/** Một vật thể đã vẽ sẵn từ bản vẽ JSON: các khung hình + điểm neo (chân vật thể). */
export interface Prop { frames: HTMLCanvasElement[]; ax: number; ay: number; fps: number }

function make(def: unknown, seed: number, params?: Record<string, number>): Prop {
  const res = Blueprint.render(def as BlueprintDef, { seed, params });
  if (res.warnings.length) console.warn('[blueprint]', (def as { name?: string }).name, res.warnings);
  return { frames: toCanvases(res), ax: res.anchor?.[0] ?? res.w >> 1, ay: res.anchor?.[1] ?? res.h - 1, fps: res.fps };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

const seeds = (n: number) => Array.from({ length: n }, (_, i) => i * 7 + 3);

export class Sprites {
  private readonly vcache = new Map<string, HTMLCanvasElement>();
  readonly grass = seeds(4).map((s) => make(grassJson, s).frames[0]);
  readonly mud = seeds(4).map((s) => make(mudJson, s).frames[0]);
  readonly water = seeds(3).map((s) => make(waterJson, s));
  readonly trees = [...seeds(4).map((s) => make(treeRoundJson, s)), ...seeds(4).map((s) => make(treePineJson, s + 1))];
  readonly rocks = seeds(3).map((s) => make(rockJson, s));
  readonly bush = seeds(3).map((s) => make(bushJson, s));
  readonly bushEmpty = seeds(3).map((s) => make(bushJson, s, { empty: 1 }));
  readonly stump = seeds(3).map((s) => make(stumpJson, s));
  readonly campfire = make(campfireJson, 5);
  /** Kho theo giai đoạn xây 0..4 (4 = xong). */
  readonly storage = [0, 1, 2, 3, 4].map((st) => make(storageJson, 5, { st1: +(st >= 1), st2: +(st >= 2), st3: +(st >= 3), st4: +(st >= 4) }));
  readonly workshop = [0, 1, 2, 3, 4].map((st) => make(workshopJson, 9, { st1: +(st >= 1), st2: +(st >= 2), st3: +(st >= 3), st4: +(st >= 4) }));
  /** Biểu tượng công cụ 16×16, khóa dạng "axe1" (gỗ) hoặc "axe2" (đá). */
  readonly icons: Record<string, HTMLCanvasElement> = {};

  constructor() {
    const defs: Record<string, unknown> = { axe: toolAxeJson, pick: toolPickJson, hoe: toolHoeJson, shovel: toolShovelJson };
    for (const k of Object.keys(defs)) for (const tier of [1, 2]) this.icons[`${k}${tier}`] = make(defs[k], 1, { stone: tier === 2 ? 1 : 0 }).frames[0];
  }

  villager(v: Villager): HTMLCanvasElement {
    const name = v.anim in anims ? v.anim : 'idle';
    const def = anims[name];
    const rate = name === 'walk' || name === 'carry_walk' ? Math.min(1.6, v.speed / 1.5) : 1;
    const frame = Math.floor(v.animClock * def.fps * rate) % def.frames.length;
    const kind = v.carry?.res ?? 'wood';
    const key = `${name}|${frame}|${v.facing}|${v.look.sex}|${v.look.skin}|${v.look.hair}|${kind}|${v.hold ? v.hold.kind + v.hold.tier : '-'}`;
    let c = this.vcache.get(key);
    if (!c) {
      const [cv, g] = canvas(W, H);
      g.putImageData(new ImageData(new Uint8ClampedArray(renderFrame(anims, name, frame, v.facing, v.look, kind, v.hold ?? { tier: 0 })), W, H), 0, 0);
      this.vcache.set(key, cv); c = cv;
    }
    return c;
  }
}
