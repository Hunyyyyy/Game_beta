import { AnimTable, CX, H, W, renderFrame } from '../character/rig.js';
import { renderAnimal, type AnimalClips, type AnimalDef } from '../character/animal-rig.js';
import bodiesJson from '../data/animals/bodies.json';
import bipedClips from '../data/animals/anims/biped.json';
import fishClips from '../data/animals/anims/fish.json';
import hopperClips from '../data/animals/anims/hopper.json';
import quadrupedClips from '../data/animals/anims/quadruped.json';
import { Blueprint, BlueprintDef, toCanvases } from '../blueprint/blueprint';
import animsJson from '../data/anims.json';
import campfireL1 from '../data/blueprints/stone_age/buildings/campfire/L1.json';
import builderL1 from '../data/blueprints/stone_age/buildings/builder/L1.json';
import builderL2 from '../data/blueprints/stone_age/buildings/builder/L2.json';
import builderL3 from '../data/blueprints/stone_age/buildings/builder/L3.json';
import labL1 from '../data/blueprints/stone_age/buildings/lab/L1.json';
import labL2 from '../data/blueprints/stone_age/buildings/lab/L2.json';
import labL3 from '../data/blueprints/stone_age/buildings/lab/L3.json';
import repairL1 from '../data/blueprints/stone_age/buildings/repair/L1.json';
import repairL2 from '../data/blueprints/stone_age/buildings/repair/L2.json';
import repairL3 from '../data/blueprints/stone_age/buildings/repair/L3.json';
import toolstoreL1 from '../data/blueprints/stone_age/buildings/toolstore/L1.json';
import toolstoreL2 from '../data/blueprints/stone_age/buildings/toolstore/L2.json';
import toolstoreL3 from '../data/blueprints/stone_age/buildings/toolstore/L3.json';
import armoryL1 from '../data/blueprints/stone_age/buildings/armory/L1.json';
import armoryL2 from '../data/blueprints/stone_age/buildings/armory/L2.json';
import armoryL3 from '../data/blueprints/stone_age/buildings/armory/L3.json';
import houseL1 from '../data/blueprints/stone_age/buildings/house/L1.json';
import houseL2 from '../data/blueprints/stone_age/buildings/house/L2.json';
import houseL3 from '../data/blueprints/stone_age/buildings/house/L3.json';
import fieldL1 from '../data/blueprints/stone_age/buildings/field/L1.json';
import fieldL2 from '../data/blueprints/stone_age/buildings/field/L2.json';
import fieldL3 from '../data/blueprints/stone_age/buildings/field/L3.json';
import fenceL1 from '../data/blueprints/stone_age/buildings/fence/L1.json';
import fenceL2 from '../data/blueprints/stone_age/buildings/fence/L2.json';
import gateL1 from '../data/blueprints/stone_age/buildings/gate/L1.json';
import gateL2 from '../data/blueprints/stone_age/buildings/gate/L2.json';
import gateL1o from '../data/blueprints/stone_age/buildings/gate/L1open.json';
import gateL2o from '../data/blueprints/stone_age/buildings/gate/L2open.json';
import towerL1 from '../data/blueprints/stone_age/buildings/tower/L1.json';
import towerL2 from '../data/blueprints/stone_age/buildings/tower/L2.json';
import infantryL1 from '../data/blueprints/stone_age/buildings/infantry/L1.json';
import infantryL2 from '../data/blueprints/stone_age/buildings/infantry/L2.json';
import infantryL3 from '../data/blueprints/stone_age/buildings/infantry/L3.json';
import cavalryL1 from '../data/blueprints/stone_age/buildings/cavalry/L1.json';
import cavalryL2 from '../data/blueprints/stone_age/buildings/cavalry/L2.json';
import cavalryL3 from '../data/blueprints/stone_age/buildings/cavalry/L3.json';
import stableL1 from '../data/blueprints/stone_age/buildings/stable/L1.json';
import stableL2 from '../data/blueprints/stone_age/buildings/stable/L2.json';
import stableL3 from '../data/blueprints/stone_age/buildings/stable/L3.json';
import archeryL1 from '../data/blueprints/stone_age/buildings/archery/L1.json';
import archeryL2 from '../data/blueprints/stone_age/buildings/archery/L2.json';
import archeryL3 from '../data/blueprints/stone_age/buildings/archery/L3.json';
import farmhouseL1 from '../data/blueprints/stone_age/buildings/farmhouse/L1.json';
import farmhouseL2 from '../data/blueprints/stone_age/buildings/farmhouse/L2.json';
import farmhouseL3 from '../data/blueprints/stone_age/buildings/farmhouse/L3.json';
import huntlodgeL1 from '../data/blueprints/stone_age/buildings/huntlodge/L1.json';
import huntlodgeL2 from '../data/blueprints/stone_age/buildings/huntlodge/L2.json';
import huntlodgeL3 from '../data/blueprints/stone_age/buildings/huntlodge/L3.json';
import lumberyardL1 from '../data/blueprints/stone_age/buildings/lumberyard/L1.json';
import lumberyardL2 from '../data/blueprints/stone_age/buildings/lumberyard/L2.json';
import lumberyardL3 from '../data/blueprints/stone_age/buildings/lumberyard/L3.json';
import quarryL1 from '../data/blueprints/stone_age/buildings/quarry/L1.json';
import quarryL2 from '../data/blueprints/stone_age/buildings/quarry/L2.json';
import quarryL3 from '../data/blueprints/stone_age/buildings/quarry/L3.json';
import scouttentL1 from '../data/blueprints/stone_age/buildings/scouttent/L1.json';
import scouttentL2 from '../data/blueprints/stone_age/buildings/scouttent/L2.json';
import scouttentL3 from '../data/blueprints/stone_age/buildings/scouttent/L3.json';
import wartentL1 from '../data/blueprints/stone_age/buildings/wartent/L1.json';
import wartentL2 from '../data/blueprints/stone_age/buildings/wartent/L2.json';
import wartentL3 from '../data/blueprints/stone_age/buildings/wartent/L3.json';
import drillL1 from '../data/blueprints/stone_age/buildings/drill/L1.json';
import drillL2 from '../data/blueprints/stone_age/buildings/drill/L2.json';
import drillL3 from '../data/blueprints/stone_age/buildings/drill/L3.json';
import trapL1 from '../data/blueprints/stone_age/buildings/trap/L1.json';
import trapL2 from '../data/blueprints/stone_age/buildings/trap/L2.json';
import campfireL2 from '../data/blueprints/stone_age/buildings/campfire/L2.json';
import campfireL3 from '../data/blueprints/stone_age/buildings/campfire/L3.json';
import campfireL4 from '../data/blueprints/stone_age/buildings/campfire/L4.json';
import storageL1 from '../data/blueprints/stone_age/buildings/storage/L1.json';
import storageL2 from '../data/blueprints/stone_age/buildings/storage/L2.json';
import storageL3 from '../data/blueprints/stone_age/buildings/storage/L3.json';
import workshopL1 from '../data/blueprints/stone_age/buildings/workshop/L1.json';
import workshopL2 from '../data/blueprints/stone_age/buildings/workshop/L2.json';
import workshopL3 from '../data/blueprints/stone_age/buildings/workshop/L3.json';
import bushJson from '../data/blueprints/nature/resources/bush.json';
import rockJson from '../data/blueprints/nature/resources/rock.json';
import grassJson from '../data/blueprints/nature/terrain/grass.json';
import mudJson from '../data/blueprints/nature/terrain/mud.json';
import waterJson from '../data/blueprints/nature/terrain/water.json';
import stumpJson from '../data/blueprints/nature/trees/stump.json';
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
/** Building blueprints per era and kind, one entry per level. A later era only lists what it redraws. */
const BUILDING_ART: Partial<Record<Era, Partial<Record<BuildingKind, unknown[]>>>> = {
  stone: {
    campfire: [campfireL1, campfireL2, campfireL3, campfireL4],
    builder: [builderL1, builderL2, builderL3],
    storage: [storageL1, storageL2, storageL3],
    workshop: [workshopL1, workshopL2, workshopL3],
    lab: [labL1, labL2, labL3],
    repair: [repairL1, repairL2, repairL3],
    toolstore: [toolstoreL1, toolstoreL2, toolstoreL3],
    armory: [armoryL1, armoryL2, armoryL3],
    infantry: [infantryL1, infantryL2, infantryL3],
    cavalry: [cavalryL1, cavalryL2, cavalryL3],
    stable: [stableL1, stableL2, stableL3],
    archery: [archeryL1, archeryL2, archeryL3],
    farmhouse: [farmhouseL1, farmhouseL2, farmhouseL3],
    huntlodge: [huntlodgeL1, huntlodgeL2, huntlodgeL3],
    lumberyard: [lumberyardL1, lumberyardL2, lumberyardL3],
    quarry: [quarryL1, quarryL2, quarryL3],
    house: [houseL1, houseL2, houseL3],
    field: [fieldL1, fieldL2, fieldL3],
    fence: [fenceL1, fenceL2],
    gate: [gateL1, gateL2, gateL1o, gateL2o], // the last two are the same gates standing open
    tower: [towerL1, towerL2],
    wartent: [wartentL1, wartentL2, wartentL3],
    scouttent: [scouttentL1, scouttentL2, scouttentL3],
    drill: [drillL1, drillL2, drillL3],
    trap: [trapL1, trapL2],
  },
};
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
    this.emblems.builder = this.icons.hammer1; this.emblems.repair = this.icons.hammer2; this.emblems.toolstore = this.icons.axe2; this.emblems.armory = this.icons.club1; this.emblems.infantry = this.icons.spear1; this.emblems.cavalry = this.icons.spear1; this.emblems.archery = this.icons.sling1 ?? this.icons.spear1; this.emblems.lumberyard = this.icons.axe1; this.emblems.quarry = this.icons.pick1; this.emblems.farmhouse = this.icons.hoe1; this.emblems.huntlodge = this.icons.spear1; this.emblems.stable = this.icons.hoe1;
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
        bush: seeds(3).map((s) => make(bushJson, s, p)),
        bushEmpty: seeds(3).map((s) => make(bushJson, s, { ...p, empty: 1 })),
        stump: seeds(3).map((s) => make(stumpJson, s, p)),
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
        set = defs.map((def) => [0, 1, 2, 3, 4].map((st) => make(tint ? { ...(def as object), palettes: { tint } } : def, kind === 'workshop' || kind === 'lab' || kind === 'repair' || kind === 'builder' ? 9 : 5, { ...stage(st), ...(tint ? { tint: 1 } : {}) })));
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
  villager(v: Villager, pose?: string): HTMLCanvasElement {
    const name = pose ?? (v.anim in anims ? v.anim : 'idle');
    const def = anims[name];
    const rate = def.gait ? Math.min(1.6, v.speed / 1.5) : 1; // walking animations step faster when the villager is quick
    const step = Math.floor(v.animClock * def.fps * rate);
    // looping animations wrap; one-shot ones (attacks) stop on their last frame
    const frame = def.loop === false ? Math.min(step, def.frames.length - 1) : step % def.frames.length;
    const kind = v.carry?.res ?? 'wood';
    const flick = v.lit ? Math.floor(v.animClock * 6) % 3 : undefined; // a lit torch flickers through three drawings
    const key = `${name}|${frame}|${v.facing}|${v.look.sex}|${v.look.skin}|${v.look.hair}|${kind}|${v.hold ? v.hold.kind + v.hold.tier : '-'}|${v.armor ?? '-'}|${flick ?? '-'}`;
    let c = this.vcache.get(key);
    if (!c) {
      const [cv, g] = canvas(W, H);
      g.putImageData(new ImageData(new Uint8ClampedArray(renderFrame(anims, name, frame, v.facing, v.look, kind, v.hold ?? { tier: 0 }, v.armor, flick === undefined ? undefined : { torch: flick })), W, H), 0, 0);
      this.vcache.set(key, cv); c = cv;
    }
    return c;
  }
}
