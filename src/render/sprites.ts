import { AnimTable, CX, FH, FW, PADT, PADX, renderFrame } from '../character/rig.js';
import { renderAnimal, type AnimalClips, type AnimalDef } from '../character/animal-rig.js';
import bodiesJson from '../data/animals/bodies.json';
import bipedClips from '../data/animals/anims/biped.json';
import fishClips from '../data/animals/anims/fish.json';
import hopperClips from '../data/animals/anims/hopper.json';
import quadrupedClips from '../data/animals/anims/quadruped.json';
import { Blueprint, BlueprintDef, toCanvases } from '../blueprint/blueprint';
import { STONE_ART } from '../content/buildings/art.gen';
import animsJson from '../data/anims.json';
import bushJson from '../data/blueprints/nature/resources/bush.json';
import rockJson from '../data/blueprints/nature/resources/rock.json';
import mountainLowJson from '../data/blueprints/nature/terrain/mountain_low.json';
import mountainMidJson from '../data/blueprints/nature/terrain/mountain_mid.json';
import mountainHighJson from '../data/blueprints/nature/terrain/mountain_high.json';
import mountainFloorJson from '../data/blueprints/nature/terrain/mountain_floor.json';
import grassJson from '../data/blueprints/nature/terrain/grass.json';
import mudJson from '../data/blueprints/nature/terrain/mud.json';
import waterJson from '../data/blueprints/nature/terrain/water.json';
import treePineJson from '../data/blueprints/nature/trees/tree_pine.json';
import treeRoundJson from '../data/blueprints/nature/trees/tree_round.json';
import toolAxeJson from '../data/blueprints/stone_age/tools/axe.json';
import toolHammerJson from '../data/blueprints/stone_age/tools/hammer.json';
import toolHoeJson from '../data/blueprints/stone_age/tools/hoe.json';
import toolPickJson from '../data/blueprints/stone_age/tools/pick.json';
import toolClubJson from '../data/blueprints/stone_age/tools/club.json';
import toolSpearJson from '../data/blueprints/stone_age/tools/spear.json';
import toolMaceJson from '../data/blueprints/stone_age/tools/mace.json';
import toolHideArmorJson from '../data/blueprints/stone_age/tools/hide_armor.json';
import toolSlingJson from '../data/blueprints/stone_age/tools/sling.json';
import toolBowJson from '../data/blueprints/stone_age/tools/bow.json';
import { BuildingKind, Era, ERAS } from '../sim/buildings';
import type { Season } from '../sim/calendar';
import type { Animal } from '../sim/fauna';
import type { Villager } from '../sim/sim';

export const anims = animsJson as unknown as AnimTable;
const BODIES = bodiesJson as unknown as Record<string, AnimalDef>;
/** Each body type has its own set of clips: four legs, hopping, two legs and fish. */
const ANIMAL_CLIPS: Record<string, AnimalClips> = { quadruped: quadrupedClips as AnimalClips, hopper: hopperClips as AnimalClips, biped: bipedClips as AnimalClips, fish: fishClips as AnimalClips };
export const SPRITE_FEET = { x: CX + PADX, y: 42 + PADT };

/** Một vật thể đã vẽ sẵn từ bản vẽ JSON: các khung hình + điểm neo (chân vật thể). */
export interface Prop { frames: HTMLCanvasElement[]; ax: number; ay: number; fps: number }

function make(def: unknown, seed: number, params?: Record<string, number>): Prop {
  const res = Blueprint.render(def as BlueprintDef, { seed, params, fit: true }); // fit: nothing drawn past the edge of the picture is cut off
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
  /** The rocky ground of a mountain, and the peaks standing on it from the edge to the heart (foot, slope, summit). */
  mountainFloor: HTMLCanvasElement[]; peaks: { low: Prop[]; mid: Prop[]; high: Prop[] };
  trees: Prop[]; rocks: Prop[]; bush: Prop[]; bushEmpty: Prop[];
}

/** Construction stages 0..4 (4 = finished) as blueprint params. */
const stage = (st: number) => ({ st1: +(st >= 1), st2: +(st >= 2), st3: +(st >= 3), st4: +(st >= 4) });
/** Building blueprints per era and kind, one entry per level. A later era only lists what it redraws. */
const BUILDING_ART: Partial<Record<Era, Partial<Record<BuildingKind, unknown[]>>>> = { stone: STONE_ART };
const TINTS: Partial<Record<BuildingKind, Record<string, string>>> = {}; // no reused drawings left: every house has its own art

export class Sprites {
  private readonly vcache = new Map<string, HTMLCanvasElement>();
  private readonly natureCache = new Map<string, NatureSet>();
  private readonly buildingCache = new Map<string, Prop[][]>();
  private readonly animalCache = new Map<string, HTMLCanvasElement>();
  /** Small badges drawn over the houses that share a drawing, so each can be told at a glance. */
  readonly emblems: Partial<Record<BuildingKind, HTMLCanvasElement>> = {};
  /** Biểu tượng công cụ 16×16, khóa dạng "axe1" (gỗ) hoặc "axe2" (đá). */
  readonly icons: Record<string, HTMLCanvasElement> = {};

  constructor() {
    const defs: Record<string, unknown> = { axe: toolAxeJson, pick: toolPickJson, hoe: toolHoeJson, hammer: toolHammerJson };
    for (const k of Object.keys(defs)) for (const tier of [1, 2]) this.icons[`${k}${tier}`] = make(defs[k], 1, { stone: tier === 2 ? 1 : 0 }).frames[0];
    // gear icons are keyed like their recipes: club1, spear1, mace2, hide1
    this.icons.club1 = make(toolClubJson, 1).frames[0];
    this.icons.spear1 = make(toolSpearJson, 1).frames[0];
    this.icons.mace2 = make(toolMaceJson, 1).frames[0];
    this.icons.sling1 = make(toolSlingJson, 1).frames[0];
    this.icons.bow1 = make(toolBowJson, 1).frames[0];
    this.icons.hide1 = make(toolHideArmorJson, 1).frames[0];
    this.icons.torch1 = this.torchIcon();
    this.nature('spring');
    this.emblems.lab = this.scrollEmblem();
    this.emblems.builder = this.icons.hammer1; this.emblems.toolstore = this.icons.axe2; this.emblems.armory = this.icons.club1; this.emblems.infantry = this.icons.spear1; this.emblems.guardpost = this.icons.club1; this.emblems.cavalry = this.icons.spear1; this.emblems.archery = this.icons.sling1 ?? this.icons.spear1; this.emblems.lumberyard = this.icons.axe1; this.emblems.quarry = this.icons.pick1; this.emblems.farmhouse = this.icons.hoe1; this.emblems.huntlodge = this.icons.spear1; this.emblems.stable = this.icons.hoe1;
  }

  /** A torch 16x16, for the craft list. */
  private torchIcon(): HTMLCanvasElement {
    const [c, g] = canvas(16, 16);
    g.fillStyle = '#2b1d10'; g.fillRect(7, 5, 3, 10);
    g.fillStyle = '#8a6238'; g.fillRect(8, 6, 1, 9);
    g.fillStyle = '#3c2418'; g.fillRect(6, 4, 5, 3); g.fillStyle = '#d6be82'; g.fillRect(6, 6, 5, 1);
    g.fillStyle = '#d64818'; g.fillRect(6, 1, 5, 4); g.fillStyle = '#f89628'; g.fillRect(7, 1, 3, 3); g.fillStyle = '#ffe88c'; g.fillRect(8, 2, 1, 2);
    return c;
  }

  /** A rolled blueprint on a pole: the sign of the research house. */
  private scrollEmblem(): HTMLCanvasElement {
    const [c, g] = canvas(16, 16);
    g.fillStyle = '#2b1d10'; g.fillRect(2, 2, 12, 12);
    g.fillStyle = '#efe3c2'; g.fillRect(3, 3, 10, 10);
    g.fillStyle = '#c9b98a'; g.fillRect(3, 11, 10, 2);
    g.fillStyle = '#5f7fa8'; g.fillRect(4, 5, 8, 1); g.fillRect(4, 7, 6, 1); g.fillRect(4, 9, 7, 1);
    g.fillStyle = '#8a6238'; g.fillRect(2, 1, 12, 2); g.fillRect(2, 13, 12, 2);
    return c;
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
        mountainFloor: seeds(4).map((s) => make(mountainFloorJson, s, p).frames[0]),
        peaks: { low: seeds(3).map((s) => make(mountainLowJson, s, p)), mid: seeds(3).map((s) => make(mountainMidJson, s, p)), high: seeds(3).map((s) => make(mountainHighJson, s, p)) },
        bush: seeds(3).map((s) => make(bushJson, s, p)),
        bushEmpty: seeds(3).map((s) => make(bushJson, s, { ...p, empty: 1 })),
      };
      this.natureCache.set(season, n);
    }
    return n;
  }

  /** Sprites for a building kind in an era: [level][construction stage 0..4]. Falls back to the closest earlier era. */
  private buildingSet(kind: BuildingKind, era: Era): Prop[][] {
    for (let i = ERAS.indexOf(era); i >= 0; i--) {
      const defs = BUILDING_ART[ERAS[i]]?.[kind];
      if (!defs) continue;
      const key = `${ERAS[i]}|${kind}`;
      let set = this.buildingCache.get(key);
      if (!set) {
        const tint = TINTS[kind];
        set = defs.map((def) => [0, 1, 2, 3, 4].map((st) => make(tint ? { ...(def as object), palettes: { tint } } : def, kind === 'workshop' || kind === 'lab' || kind === 'builder' ? 9 : 5, { ...stage(st), ...(tint ? { tint: 1 } : {}) })));
        this.buildingCache.set(key, set);
      }
      return set;
    }
    throw new Error(`No art for ${kind} in era ${era}`);
  }

  /** Sprite of a building at its level and construction stage (0..4). */
  building(kind: BuildingKind, era: Era, level: number, st: number): Prop {
    const lv = this.buildingSet(kind, era);
    return lv[Math.min(lv.length, Math.max(1, level)) - 1][st];
  }

  /** Sprite size of a species and where its feet are (the sprite is drawn with this point on the animal's position). */
  animalBox(species: string): { w: number; h: number; ax: number; ay: number } {
    const d = BODIES[species], [w, h] = d.size;
    return d.body === 'fish' ? { w, h, ax: w / 2, ay: h / 2 } : { w, h, ax: w / 2, ay: h - 2 };
  }

  /** The clip an animal plays right now, from its state. */
  private animalClip(a: Animal): string {
    const fish = BODIES[a.species].body === 'fish';
    if (a.state === 'dead') return 'die';
    if (a.bite > 0) return 'attack';
    switch (a.state) {
      case 'flee': return a.tired > 0 ? (fish ? 'swim' : 'walk') : 'run';
      case 'attack': return fish ? 'swim' : 'run';
      case 'wander': return fish ? 'swim' : 'walk';
      case 'sleep': return 'sleep';
      default: return fish ? 'idle' : 'graze';
    }
  }

  /** Current frame of an animal, mirrored when it faces left. Rendered once per frame and kept. */
  animal(a: Animal): HTMLCanvasElement {
    const def = BODIES[a.species], clips = ANIMAL_CLIPS[def.body], name = this.animalClip(a), clip = clips[name] ?? clips.idle;
    const n = clip.frames.length;
    // attack plays once per bite from the bite timer; dying holds its last frame; the rest loop on the animal's own clock
    const frame = name === 'attack' ? Math.min(n - 1, Math.floor(((0.25 - a.bite) / 0.25) * n))
      : name === 'die' ? n - 1 : Math.floor(a.clock * clip.fps) % n;
    const key = `${a.species}|${name}|${frame}|${a.dir}`;
    let c = this.animalCache.get(key);
    if (!c) {
      const r = renderAnimal(def, clip, frame), [cv, g] = canvas(r.w, r.h);
      g.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
      if (a.dir === -1) { const [mv, mg] = canvas(r.w, r.h); mg.translate(r.w, 0); mg.scale(-1, 1); mg.drawImage(cv, 0, 0); c = mv; } else c = cv;
      this.animalCache.set(key, c);
    }
    return c;
  }

  /** A beast under a rider, walking when the rider moves and standing when he stands, facing the way he faces. */
  mount(species: string, moving: boolean, clock: number, dir: 1 | -1): HTMLCanvasElement {
    const def = BODIES[species], clips = ANIMAL_CLIPS[def.body], name = moving ? 'walk' : 'idle', clip = clips[name] ?? clips.idle, n = clip.frames.length, frame = Math.floor(clock * clip.fps) % n;
    const key = `${species}|ride|${name}|${frame}|${dir}`;
    let c = this.animalCache.get(key);
    if (!c) {
      const r = renderAnimal(def, clip, frame), [cv, g] = canvas(r.w, r.h);
      g.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
      if (dir === -1) { const [mv, mg] = canvas(r.w, r.h); mg.translate(r.w, 0); mg.scale(-1, 1); mg.drawImage(cv, 0, 0); c = mv; } else c = cv;
      this.animalCache.set(key, c);
    }
    return c;
  }
  /** The villager as drawn; `pose` makes him stand in one animation (a rider sits still on his beast). */
  villager(v: Villager, pose?: string, face?: 'left' | 'right'): HTMLCanvasElement {
    const name = pose ?? (v.anim in anims ? v.anim : 'idle');
    const def = anims[name];
    const rate = def.gait ? Math.min(1.6, v.speed / 1.5) : 1; // walking animations step faster when the villager is quick
    const step = Math.floor(v.animClock * def.fps * rate);
    // looping animations wrap; one-shot ones (attacks) stop on their last frame
    const frame = def.loop === false ? Math.min(step, def.frames.length - 1) : step % def.frames.length;
    const kind = v.carry?.res ?? 'wood';
    const flick = v.lit ? Math.floor(v.animClock * 6) % 3 : undefined; // a lit torch flickers through three drawings
    const facing = face ?? v.facing; // a rider is always drawn from the side, the way his beast faces
    const key = `${name}|${frame}|${facing}|${v.look.sex}|${v.look.skin}|${v.look.hair}|${kind}|${v.hold ? v.hold.kind + v.hold.tier : '-'}|${v.armor ?? '-'}|${flick ?? '-'}`;
    let c = this.vcache.get(key);
    if (!c) {
      const [cv, g] = canvas(FW, FH);
      g.putImageData(new ImageData(new Uint8ClampedArray(renderFrame(anims, name, frame, facing, v.look, kind, v.hold ?? { tier: 0 }, v.armor, flick === undefined ? undefined : { torch: flick })), FW, FH), 0, 0);
      this.vcache.set(key, cv); c = cv;
    }
    return c;
  }
}
