import { bakeCampfire, withoutFlames } from './pixelfire';
import { AnimTable, CX, FH, FW, PADT, PADX, renderFrame } from '../character/rig.js';
import { renderAnimal, type AnimalClips, type AnimalDef } from '../character/animal-rig.js';
import bodiesJson from '../data/animals/bodies.json';
import bipedClips from '../data/animals/anims/biped.json';
import fishClips from '../data/animals/anims/fish.json';
import hopperClips from '../data/animals/anims/hopper.json';
import quadrupedClips from '../data/animals/anims/quadruped.json';
import horseClips from '../data/animals/anims/horse.json';
import { Blueprint, BlueprintDef, toCanvases } from '../blueprint/blueprint';
import { ANCIENT_ART, STONE_ART } from '../content/buildings/art.gen';
import animsJson from '../data/anims.json';
import bushJson from '../data/blueprints/nature/resources/bush.json';
import rockJson from '../data/blueprints/nature/resources/rock.json';
import oreIronJson from '../data/blueprints/nature/resources/ore_iron.json';
import oreCoalJson from '../data/blueprints/nature/resources/ore_coal.json';
import oreCopperJson from '../data/blueprints/nature/resources/ore_copper.json';
import oreRareJson from '../data/blueprints/nature/resources/ore_rare.json';
import oreSilverJson from '../data/blueprints/nature/resources/ore_silver.json';
import oreGoldJson from '../data/blueprints/nature/resources/ore_gold.json';
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
import toolGrassArmorJson from '../data/blueprints/stone_age/tools/grass_armor.json';
import toolSlingJson from '../data/blueprints/stone_age/tools/sling.json';
import med_bronze_sword from '../data/blueprints/medieval/tools/bronze_sword.json';
import med_bronze_spear from '../data/blueprints/medieval/tools/bronze_spear.json';
import med_bronze_bow from '../data/blueprints/medieval/tools/bronze_bow.json';
import med_bronze_armor from '../data/blueprints/medieval/tools/bronze_armor.json';
import med_arming_sword from '../data/blueprints/medieval/tools/arming_sword.json';
import med_composite_bow from '../data/blueprints/medieval/tools/composite_bow.json';
import med_lance from '../data/blueprints/medieval/tools/lance.json';
import med_short_spear from '../data/blueprints/medieval/tools/short_spear.json';
import med_footman_armor from '../data/blueprints/medieval/tools/footman_armor.json';
import med_archer_armor from '../data/blueprints/medieval/tools/archer_armor.json';
import med_rider_armor from '../data/blueprints/medieval/tools/rider_armor.json';
import med_watchman_armor from '../data/blueprints/medieval/tools/watchman_armor.json';
import handTiers from '../data/handtools/tiers.json';
import palaceJson from '../data/blueprints/medieval/palace.json';
import toolBowJson from '../data/blueprints/stone_age/tools/bow.json';
import { BuildingKind, BUILDINGS, Era, ERAS } from '../sim/buildings';
import type { Season } from '../sim/calendar';
import type { Animal } from '../sim/fauna';
import type { Villager } from '../sim/sim';

export const anims = animsJson as unknown as AnimTable;
const BODIES = bodiesJson as unknown as Record<string, AnimalDef>;
/** Each body type has its own set of clips: four legs, hopping, two legs and fish. */
const ANIMAL_CLIPS: Record<string, AnimalClips> = { quadruped: quadrupedClips as AnimalClips, horse: horseClips as AnimalClips, hopper: hopperClips as AnimalClips, biped: bipedClips as AnimalClips, fish: fishClips as AnimalClips };
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
  /** The seams of ore at the foot of the mountains: iron ore, coal and copper ore. Silver and gold are drawn and kept for later (no seam of them is made yet). */
  ironOre: Prop[]; coal: Prop[]; copperOre: Prop[]; rareOre: Prop[]; silverOre: Prop[]; goldOre: Prop[];
}

/** Construction stages 0..4 (4 = finished) as blueprint params. */
const stage = (st: number) => ({ st1: +(st >= 1), st2: +(st >= 2), st3: +(st >= 3), st4: +(st >= 4) });
/** Building blueprints per era and kind, one entry per level. A later era only lists what it redraws. */
const BUILDING_ART: Partial<Record<Era, Partial<Record<BuildingKind, unknown[]>>>> = { stone: STONE_ART, ancient: ANCIENT_ART };
const TINTS: Partial<Record<BuildingKind, Record<string, string>>> = {}; // no reused drawings left: every house has its own art

export class Sprites {
  private readonly vcache = new Map<string, HTMLCanvasElement>();
  /** The age and the season, set by the renderer every frame: the villagers of the medieval age are dressed (a drawing only: it gives no defence). */
  private era: Era = 'stone';
  private summer = false;
  private readonly natureCache = new Map<string, NatureSet>();
  private palaceProp: Prop | null = null;
  /** The Nhà chính of level 7 for the dev look (a 6 × 6 palace). */
  palace(): Prop { return (this.palaceProp ??= make(palaceJson, 1, { st1: 1, st2: 1, st3: 1, st4: 1 })); }
  private readonly buildingCache = new Map<string, Prop[][]>();
  private readonly campfireFx = new Map<string, Prop>();
  private readonly animalCache = new Map<string, HTMLCanvasElement>();
  private readonly viewCache = new Map<string, { rear: HTMLCanvasElement; over: HTMLCanvasElement }>();
  /** Small badges drawn over the houses that share a drawing, so each can be told at a glance. */
  readonly emblems: Partial<Record<BuildingKind, HTMLCanvasElement>> = {};
  /** Biểu tượng công cụ 16×16, khóa dạng "axe1" (gỗ) hoặc "axe2" (đá). */
  readonly icons: Record<string, HTMLCanvasElement> = {};

  constructor() {
    const defs: Record<string, unknown> = { axe: toolAxeJson, pick: toolPickJson, hoe: toolHoeJson, hammer: toolHammerJson };
    // the tool icons are keyed like their recipes (axe1, pick4): wood, stone, then the medieval metals, whose head colours are those of the hand tools (data/handtools/tiers.json)
    const heads = handTiers as unknown as Record<string, { head: string; light: string; dark: string }>;
    for (const k of Object.keys(defs)) for (const tier of [1, 2, 3, 4, 5]) {
      const c = heads[String(tier)], def = tier >= 3 ? { ...(defs[k] as object), palettes: { metal: { st: c.head, stL: c.light, stD: c.dark } } } : defs[k];
      this.icons[`${k}${tier}`] = make(def, 1, { stone: tier >= 2 ? 1 : 0, ...(tier >= 3 ? { metal: 1 } : {}) }).frames[0];
    }
    // gear icons are keyed like their recipes: club1, spear1, mace2, hide1
    this.icons.club1 = make(toolClubJson, 1).frames[0];
    this.icons.spear1 = make(toolSpearJson, 1).frames[0];
    this.icons.mace2 = make(toolMaceJson, 1).frames[0];
    this.icons.sling1 = make(toolSlingJson, 1).frames[0];
    this.icons.bow1 = make(toolBowJson, 1).frames[0];
    this.icons.hide1 = make(toolHideArmorJson, 1).frames[0];
    // the gear of the medieval ranks: the icon is keyed like the recipe (kind + tier)
    this.icons.bronze_sword3 = make(med_bronze_sword, 1).frames[0];
    this.icons.bronze_spear3 = make(med_bronze_spear, 1).frames[0];
    this.icons.bronze_bow3 = make(med_bronze_bow, 1).frames[0];
    this.icons.bronze3 = make(med_bronze_armor, 1).frames[0];
    this.icons.arming_sword4 = make(med_arming_sword, 1).frames[0];
    this.icons.composite_bow4 = make(med_composite_bow, 1).frames[0];
    this.icons.lance4 = make(med_lance, 1).frames[0];
    this.icons.short_spear4 = make(med_short_spear, 1).frames[0];
    this.icons.footman4 = make(med_footman_armor, 1).frames[0];
    this.icons.archer4 = make(med_archer_armor, 1).frames[0];
    this.icons.rider4 = make(med_rider_armor, 1).frames[0];
    this.icons.watchman4 = make(med_watchman_armor, 1).frames[0];
    this.icons.grass1 = make(toolGrassArmorJson, 1).frames[0];
    this.icons.bone2 = this.icons.hide1; // the bone armour has no picture of its own yet: it shows as the hide one
    this.icons.torch1 = this.torchIcon();
    this.icons.thrown_stone2 = this.stoneIcon(); // the stone of the stone thrower, for the craft list
    this.nature('spring');
    this.emblems.lab = this.scrollEmblem();
    this.emblems.builder = this.icons.hammer1; this.emblems.toolstore = this.icons.axe2; this.emblems.armory = this.icons.club1; this.emblems.infantry = this.icons.spear1; this.emblems.guardpost = this.icons.club1; this.emblems.cavalry = this.icons.spear1; this.emblems.archery = this.icons.sling1 ?? this.icons.spear1; this.emblems.lumberyard = this.icons.axe1; this.emblems.quarry = this.icons.pick1; this.emblems.mine = this.icons.pick2; this.emblems.ranch = this.icons.hoe2; this.emblems.farmhouse = this.icons.hoe1; this.emblems.huntlodge = this.icons.spear1; this.emblems.stable = this.icons.hoe1;
  }

  /** A stone to throw 16x16, for the craft list. */
  private stoneIcon(): HTMLCanvasElement {
    const [c, g] = canvas(16, 16);
    g.fillStyle = '#2b1d10'; g.fillRect(4, 5, 9, 8); g.fillRect(5, 4, 7, 1); g.fillRect(3, 7, 1, 4); g.fillRect(13, 7, 1, 4);
    g.fillStyle = '#8e9496'; g.fillRect(5, 6, 7, 6); g.fillRect(6, 5, 5, 1);
    g.fillStyle = '#c0c6c6'; g.fillRect(6, 6, 3, 2); g.fillRect(6, 5, 3, 1);
    g.fillStyle = '#62686c'; g.fillRect(10, 10, 2, 2); g.fillRect(7, 11, 4, 1);
    return c;
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
        ironOre: seeds(3).map((s) => make(oreIronJson, s, p)),
        coal: seeds(3).map((s) => make(oreCoalJson, s, p)),
        copperOre: seeds(3).map((s) => make(oreCopperJson, s, p)),
        rareOre: seeds(3).map((s) => make(oreRareJson, s, p)),
        silverOre: seeds(3).map((s) => make(oreSilverJson, s, p)),
        goldOre: seeds(3).map((s) => make(oreGoldJson, s, p)),
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
        set = defs.map((raw) => { const def = kind === 'campfire' ? withoutFlames(raw as { layers?: Array<{ color?: unknown }> }) : raw; return [0, 1, 2, 3, 4].map((st) => make(tint ? { ...(def as object), palettes: { tint } } : def, kind === 'workshop' || kind === 'lab' || kind === 'builder' ? 9 : 5, { ...stage(st), ...(tint ? { tint: 1 } : {}) })); });
        this.buildingCache.set(key, set);
      }
      return set;
    }
    throw new Error(`No art for ${kind} in era ${era}`);
  }

  /** Sprite of a building at its level and construction stage (0..4). */
  building(kind: BuildingKind, era: Era, level: number, st: number, open = false): Prop {
    if (kind === 'campfire' && st >= 4) { // a finished fire: the art of its level without drawn flames, and a fire made by code over its hearth
      const key = era === 'ancient' && level > BUILDINGS.campfire.levels.stone!.length ? 'ancient' : `stone${Math.min(level, BUILDINGS.campfire.levels.stone!.length)}`;
      let p = this.campfireFx.get(key);
      if (!p) this.campfireFx.set(key, p = bakeCampfire(this.campfireBase(era, level, st), key));
      return p;
    }
    return this.buildingArt(kind, era, level, st, open);
  }

  /** The campfire's own art for a level, flames left out. */
  private campfireBase(era: Era, level: number, st: number): Prop {
    return this.buildingArt('campfire', era, level, st, false);
  }

  private buildingArt(kind: BuildingKind, era: Era, level: number, st: number, open: boolean): Prop {
    const stoneN = BUILDINGS[kind].levels.stone!.length;
    if (era === 'ancient' && level > stoneN && ANCIENT_ART[kind]) { // the medieval levels have their own drawings, after the stone ones
      const set = this.buildingSet(kind, 'ancient'), half = kind === 'gate' ? set.length / 2 : set.length;
      return set[Math.min(half, level - stoneN) - 1 + (open ? half : 0)][st];
    }
    const lv = this.buildingSet(kind, 'stone'), at = open ? level + 2 : level; // a gate lists its open drawings after the shut ones
    return lv[Math.min(lv.length, Math.max(1, at)) - 1][st];
  }

  /** Sprite size of a species and where its feet are (the sprite is drawn with this point on the animal's position). */
  animalBox(species: string, view?: 'front' | 'back'): { w: number; h: number; ax: number; ay: number } {
    const d = BODIES[species], [w, h] = (view && d.views?.[view]?.size) || d.size;
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

  /** Whether a species is drawn from the front and from behind too (the horse): its rider then faces the way he goes up and down the screen. */
  hasViews(species: string): boolean { return !!BODIES[species].views; }

  /** A beast under a rider seen from the front or from behind, in two parts: the one behind the rider and the one over him (the neck and head, or the rump). */
  mountView(species: string, moving: boolean, clock: number, gallop: boolean, view: 'front' | 'back'): { rear: HTMLCanvasElement; over: HTMLCanvasElement } {
    const def = BODIES[species], clips = ANIMAL_CLIPS[def.body], name = moving ? (gallop && clips.run ? 'run' : 'walk') : 'idle', clip = clips[name] ?? clips.idle, n = clip.frames.length, frame = Math.floor(clock * clip.fps) % n;
    const key = `${species}|ride|${view}|${name}|${frame}`;
    let c = this.viewCache.get(key);
    if (!c) {
      const r = renderAnimal(def, clip, frame, view), [rv, rg] = canvas(r.w, r.h), [ov, og] = canvas(r.w, r.h);
      rg.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
      og.putImageData(new ImageData(new Uint8ClampedArray(r.over as Uint8ClampedArray), r.w, r.h), 0, 0);
      c = { rear: rv, over: ov }; this.viewCache.set(key, c);
    }
    return c;
  }

  /** A beast under a rider, walking when the rider moves and standing when he stands, facing the way he faces. */
  mount(species: string, moving: boolean, clock: number, dir: 1 | -1, gallop = false): HTMLCanvasElement {
    const def = BODIES[species], clips = ANIMAL_CLIPS[def.body], name = moving ? (gallop && clips.run ? 'run' : 'walk') : 'idle', clip = clips[name] ?? clips.idle, n = clip.frames.length, frame = Math.floor(clock * clip.fps) % n;
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
  setWorld(era: Era, season: string): void { this.era = era; this.summer = season === 'summer'; }
  /**
   * What a villager of ours wears in the medieval age when he carries no armour: a wool tunic over a linen shirt, brown or grey by who he is, with a straw hat in the summer and a
   * wool hood in the other seasons. Soldiers have their own gear and the villages of the land keep their own look. Only a drawing.
   */
  outfitOf(v: Villager): string | null {
    if (this.era !== 'ancient' || v.team !== 'player' || v.armor || v.job === 'fight' || v.guard) return null;
    return `peasant_${this.summer ? 'straw' : 'hood'}_${(v.id * 2654435761 >>> 0) % 2 ? 'grey' : 'brown'}`;
  }
  /** The villager as drawn; `pose` makes him stand in one animation (a rider sits still on his beast). */
  villager(v: Villager, pose?: string, face?: 'left' | 'right' | 'front' | 'back'): HTMLCanvasElement {
    const name = pose ?? (v.anim in anims ? v.anim : 'idle');
    const def = anims[name];
    const rate = def.gait ? Math.min(1.6, v.speed / 1.5) : 1; // walking animations step faster when the villager is quick
    const step = Math.floor(v.animClock * def.fps * rate);
    // looping animations wrap; one-shot ones (attacks) stop on their last frame
    const frame = def.loop === false ? Math.min(step, def.frames.length - 1) : step % def.frames.length;
    const kind = v.carry?.res ?? 'wood';
    const armor = v.armor ?? this.outfitOf(v);
    const flick = v.lit ? Math.floor(v.animClock * 6) % 3 : undefined; // a lit torch flickers through three drawings
    const facing = face ?? v.facing; // a rider is always drawn from the side, the way his beast faces
    const key = `${name}|${frame}|${facing}|${v.look.sex}|${v.look.skin}|${v.look.hair}|${kind}|${v.hold ? v.hold.kind + v.hold.tier + (v.hold.shield ?? '') : '-'}|${armor ?? '-'}|${flick ?? '-'}`;
    let c = this.vcache.get(key);
    if (!c) {
      const [cv, g] = canvas(FW, FH);
      g.putImageData(new ImageData(new Uint8ClampedArray(renderFrame(anims, name, frame, facing, v.look, kind, v.hold ?? { tier: 0 }, armor, flick === undefined ? undefined : { torch: flick })), FW, FH), 0, 0);
      this.vcache.set(key, cv); c = cv;
    }
    return c;
  }
}
