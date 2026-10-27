import { AnimTable, CX, H, W, renderFrame } from '../character/rig.js';
import { Blueprint, BlueprintDef, toCanvases } from '../blueprint/blueprint';
import animsJson from '../data/anims.json';
import campfireL1 from '../data/blueprints/buildings/campfire/L1.json';
import storageL1 from '../data/blueprints/buildings/storage/L1.json';
import storageL2 from '../data/blueprints/buildings/storage/L2.json';
import storageL3 from '../data/blueprints/buildings/storage/L3.json';
import workshopL1 from '../data/blueprints/buildings/workshop/L1.json';
import workshopL2 from '../data/blueprints/buildings/workshop/L2.json';
import workshopL3 from '../data/blueprints/buildings/workshop/L3.json';
import bushJson from '../data/blueprints/nature/resources/bush.json';
import rockJson from '../data/blueprints/nature/resources/rock.json';
import grassJson from '../data/blueprints/nature/terrain/grass.json';
import mudJson from '../data/blueprints/nature/terrain/mud.json';
import waterJson from '../data/blueprints/nature/terrain/water.json';
import stumpJson from '../data/blueprints/nature/trees/stump.json';
import treePineJson from '../data/blueprints/nature/trees/tree_pine.json';
import treeRoundJson from '../data/blueprints/nature/trees/tree_round.json';
import toolAxeJson from '../data/blueprints/tools/axe.json';
import toolHammerJson from '../data/blueprints/tools/hammer.json';
import toolHoeJson from '../data/blueprints/tools/hoe.json';
import toolPickJson from '../data/blueprints/tools/pick.json';
import type { BuildingKind } from '../sim/buildings';
import type { Season } from '../sim/calendar';
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

/** Nature props for one state (season now; burnt, fallen... later). Each blueprint reads the params it knows. */
export interface NatureSet {
  grass: HTMLCanvasElement[]; mud: HTMLCanvasElement[]; water: Prop[];
  trees: Prop[]; rocks: Prop[]; bush: Prop[]; bushEmpty: Prop[]; stump: Prop[];
}

/** Construction stages 0..4 (4 = finished) as blueprint params. */
const stage = (st: number) => ({ st1: +(st >= 1), st2: +(st >= 2), st3: +(st >= 3), st4: +(st >= 4) });
const BUILDING_LEVELS: Record<BuildingKind, unknown[]> = {
  campfire: [campfireL1],
  storage: [storageL1, storageL2, storageL3],
  workshop: [workshopL1, workshopL2, workshopL3],
};

export class Sprites {
  private readonly vcache = new Map<string, HTMLCanvasElement>();
  private readonly natureCache = new Map<string, NatureSet>();
  /** Building sprites per kind and level (index 0 = level 1), each with construction stages 0..4. */
  readonly buildings = Object.fromEntries((Object.keys(BUILDING_LEVELS) as BuildingKind[]).map((k) =>
    [k, BUILDING_LEVELS[k].map((def) => [0, 1, 2, 3, 4].map((st) => make(def, k === 'workshop' ? 9 : 5, stage(st))))])) as Record<BuildingKind, Prop[][]>;
  /** Biểu tượng công cụ 16×16, khóa dạng "axe1" (gỗ) hoặc "axe2" (đá). */
  readonly icons: Record<string, HTMLCanvasElement> = {};

  constructor() {
    const defs: Record<string, unknown> = { axe: toolAxeJson, pick: toolPickJson, hoe: toolHoeJson, hammer: toolHammerJson };
    for (const k of Object.keys(defs)) for (const tier of [1, 2]) this.icons[`${k}${tier}`] = make(defs[k], 1, { stone: tier === 2 ? 1 : 0 }).frames[0];
    this.nature('spring');
  }

  /** Nature drawn for a season; spring is the base art, other seasons switch the blueprints' palettes. */
  nature(season: Season): NatureSet {
    let n = this.natureCache.get(season);
    if (!n) {
      const p = season === 'spring' ? {} : { [season]: 1 };
      n = {
        grass: seeds(4).map((s) => make(grassJson, s, p).frames[0]),
        mud: seeds(4).map((s) => make(mudJson, s, p).frames[0]),
        water: seeds(3).map((s) => make(waterJson, s, p)),
        trees: [...seeds(4).map((s) => make(treeRoundJson, s, p)), ...seeds(4).map((s) => make(treePineJson, s + 1, p))],
        rocks: seeds(3).map((s) => make(rockJson, s, p)),
        bush: seeds(3).map((s) => make(bushJson, s, p)),
        bushEmpty: seeds(3).map((s) => make(bushJson, s, { ...p, empty: 1 })),
        stump: seeds(3).map((s) => make(stumpJson, s, p)),
      };
      this.natureCache.set(season, n);
    }
    return n;
  }

  /** Sprite of a building at its level and construction stage (0..4). */
  building(kind: BuildingKind, level: number, st: number): Prop {
    const lv = this.buildings[kind];
    return lv[Math.min(lv.length, Math.max(1, level)) - 1][st];
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
