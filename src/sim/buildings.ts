import { SIEGE } from './combat';
import paceJson from '../data/pace.json';
import warJson from '../data/war.json';
import { scaleBill } from './resources';
import type { Res, Stock } from './resources';
import { fireBuildingMax } from './progression';
import { BUILDING_FILES, BUILDING_KINDS } from '../content/buildings/defs.gen';

export type BuildingKind = typeof BUILDING_KINDS[number];

/** The six groups of the development tree (doc/Development_tree.drawio). */
export type BuildingGroup = 'production' | 'storage' | 'war' | 'defence' | 'development' | 'future';

/** Eras of the game. Each era has its own building art and its own level list (L1..L3). */
export type Era = 'stone' | 'ancient';
export const ERAS: Era[] = ['stone', 'ancient'];
export const ERA_NAME: Record<Era, string> = { stone: 'Thời đại Đồ đá', ancient: 'Thời đại Cổ đại' };

/** Free tiles that must lie between two houses, so that villagers never get boxed in: one is enough to walk through. */
export const CLEARANCE = 1;
/** Works that are laid piece by piece and may touch anything. */
export const WALL_KINDS: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['fence', 'gate', 'trap']);

/** One level of a building. Level 1 is the cost to place it; higher levels are upgrade costs. */
export interface LevelDef {
  name: string;      // material tier shown to the player: Đơn sơ, Gỗ, Đá
  /** Optional: what the house is called at this level (e.g. "Đồn đá"); without it the house keeps the name of its kind. Set it in building.json. */
  title?: string;
  cost: Partial<Stock>;
  buildTime: number; // seconds for a builder with factor 1.0
  cap: number;       // storage per resource (Kho), items held (Kho công cụ, Kho vũ khí)
  craftSpeed: number;
  /** Villagers that can work inside (research and crafting houses). */
  slots: number;
  /** Strength of a defence work: what the raiders must wear down to get through (0 for the rest). */
  hp: number;
  /** Optional: the footprint of the house at this level, n × n tiles ([6, 6]); without it the house keeps the size of its kind. A level that is bigger than the one before it is raised round the middle of the old one, once the ground is clear (construction.growCheck). */
  size?: [number, number];
  /** How far it sees, in tiles; the same circle is the land of the village: houses may be raised only inside the sight of a finished house or the campfire. 0 for walls, pits, gates and fields. */
  sight: number;
}

export interface BuildingDef {
  kind: BuildingKind;
  group: BuildingGroup;
  /** The goods its people bring in. A house that produces keeps `cap` of each of them in a small store of its own: it takes the place of part of the Kho. */
  produces?: Res[];
  /** The campfire level at which it may first be built. */
  unlockFire: number;
  /** Name in the first era; `names` gives the other eras the same house under another name (a stone-age tribe has no archers). */
  name: string;
  names?: Partial<Record<Era, string>>;
  w: number;
  h: number;
  buildable: boolean;
  /** Can be raised to a higher level although it cannot be built, moved or torn down (the campfire). */
  upgradable?: boolean;
  /** Kinds that must stand, finished, before this one can be placed: the order the village grows in. */
  requires?: BuildingKind[];
  /** How many may stand for each campfire level 1..4 (4 is the first medieval one), added up over every campfire. Without it a village gets one: the houses you open from a menu. */
  perFire?: number[];
  /** Stays in placing mode after each piece, for works laid one tile at a time (the fence). */
  repeat?: boolean;
  /** Levels per era: `stone` is levels 1..3, `ancient` the levels that follow (4...). */
  levels: Partial<Record<Era, LevelDef[]>>;
}

/** Everything a kind of house is: src/content/buildings/<kind>/building.json (gathered into defs.gen.ts by tools/gen-content.mjs). */
interface BuildingFile {
  kind: BuildingKind; name: string; names?: Partial<Record<Era, string>>;
  group: BuildingGroup; produces?: Res[]; size: [number, number]; buildable: boolean; upgradable?: boolean;
  unlockFire: number; requires?: BuildingKind[]; limit?: number[]; repeat?: boolean; popByFire?: number[];
  levels: Partial<Record<Era, LevelDef[]>>;
}

export const BUILDINGS = Object.fromEntries(BUILDING_KINDS.map((k) => {
  const f = BUILDING_FILES[k] as BuildingFile;
  const d: BuildingDef = { kind: k, name: f.name, names: f.names, group: f.group, produces: f.produces, w: f.size[0], h: f.size[1], buildable: f.buildable, upgradable: f.upgradable, unlockFire: f.unlockFire, requires: f.requires, perFire: f.limit, repeat: f.repeat, levels: Object.fromEntries(Object.entries(f.levels).map(([era, ls]) => [era, ls!.map((l) => ({ ...l, cost: scaleBill(l.cost) }))])) as BuildingDef['levels'] };
  return [k, d];
})) as Record<BuildingKind, BuildingDef>;

/** The campfire level at which a kind of house may first be built. */
export const fireUnlockLevel = (kind: BuildingKind): number => BUILDINGS[kind].unlockFire;

export interface Building {
  id: number;
  kind: BuildingKind;
  era: Era;          // era it was built in (decides its art and level list)
  x: number; // top-left tile
  y: number;
  level: number;     // 1..levels.length
  progress: number;  // 0..1, for the first build or the running upgrade
  done: boolean;
  /** An upgrade to level + 1 is paid for and waiting on builders; the building keeps working meanwhile. */
  upgrading: boolean;
  /** Paid for repair and waiting on builders: the strength comes back while they work on it (the building keeps working meanwhile). */
  repairing?: boolean;
  /** Moved and standing again from salvaged parts: builds in half the time. */
  rebuild: boolean;
  /** Strength left of a defence work (fence, gate, tower); 0 for the other houses. */
  hp: number;
  /** A gate lets everyone through while it is open, and stops everyone while it is shut. */
  open: boolean;
  /** A gate laid along a column: 1 turns its footprint a quarter (the gate is 2 × 1 tiles, standing, 1 × 2). Absent: lying along a row. */
  rot?: 0 | 1;
  /** The footprint of a building older than its kind's present size (the gates of old saves are one tile): when set it is the size, whatever the kind says. */
  w?: number; h?: number;
  /** Percent of extra strength the research of defence gives this work (fence, gate, trap, tower); worked out again every second. */
  hpBonus?: number;
  /** Villagers working inside (research and crafting houses). */
  staff: number[];
  /** The order being worked on right now (research or crafting): its id and progress 0..1. */
  active: { id: string; progress: number; /** What the order cost, as a multiple of its base cost (a craft: the price of the Nhà chế tạo when it was ordered). */ paid?: number } | null;
  /** A processing house (Lò luyện, Xưởng mộc, Xưởng thuộc da): the recipes ordered and waiting, paid for already. */
  orders?: string[];
  /** A running upgrade to a bigger footprint: the ground it will cover, kept clear for it from the day it was paid (construction.startGrow). */
  grow?: { x: number; y: number; w: number; h: number };
  /** Ranch only: how far each product of the house has come toward its next unit (0..1), by good (ranch.ts). */
  grown?: Record<string, number>;
  /** Field only: what it is sown with: food (the default) or flax, which gives fibre (the medieval age). */
  crop?: 'food' | 'flax';
  workers: number;
}

/** The tiles a house covers: its kind's size, turned a quarter when it is laid along a column; a size of its own (old gates) beats both. */
export const footOf = (b: Pick<Building, 'kind' | 'rot' | 'w' | 'h'> & Partial<Pick<Building, 'level' | 'era'>>): { w: number; h: number } => {
  if (b.w !== undefined && b.h !== undefined) return { w: b.w, h: b.h };
  const sz = b.level !== undefined && b.era !== undefined ? levelDef({ kind: b.kind, level: b.level, era: b.era })?.size : undefined; // a level of its own size (building.json `size` of the level)
  if (sz) return { w: sz[0], h: sz[1] };
  const d = BUILDINGS[b.kind];
  return b.rot === 1 ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
};
/** The footprint a new house of `kind` would have, turned or not. */
export const footDim = (kind: BuildingKind, rot: number = 0): { w: number; h: number } => { const d = BUILDINGS[kind]; return rot === 1 ? { w: d.h, h: d.w } : { w: d.w, h: d.h }; };

/** How far a finished house sees, in tiles (the `sight` of its level in building.json): it clears the fog round itself and the circle is the land of the village. */
export function buildingSight(b: Pick<Building, 'kind' | 'level' | 'done'> & { era?: Era }): number {
  if (!b.done) return 0;
  const lv = levelsOf(b.kind, b.era ?? 'stone');
  return lv[Math.min(lv.length, Math.max(1, b.level)) - 1].sight;
}

/** What a kind of house is called in an era. */
/** What a house is called: the title of its level when building.json gives one, else the name of its kind in the era. */
export const buildingName = (kind: BuildingKind, era: Era, level?: number): string => (level ? levelsOf(kind, kind === 'campfire' ? 'ancient' : era)[level - 1]?.title : undefined) ?? BUILDINGS[kind].names?.[era] ?? BUILDINGS[kind].name;

/** Level list of a building kind in an era: the stone levels, and in the medieval era the medieval ones after them (a kind with none stays at its stone levels). */
export function levelsOf(kind: BuildingKind, era: Era): LevelDef[] {
  const defs = BUILDINGS[kind].levels, stone = defs.stone!;
  return era === 'ancient' && defs.ancient ? levelCache(kind, stone, defs.ancient) : stone; // the medieval levels go on from the last stone level: level 4 is the first of them
}
const levelLists = new Map<BuildingKind, LevelDef[]>();
const levelCache = (kind: BuildingKind, stone: LevelDef[], ancient: LevelDef[]): LevelDef[] => { let l = levelLists.get(kind); if (!l) { l = [...stone, ...ancient]; levelLists.set(kind, l); } return l; };
export const levelDef = (b: Pick<Building, 'kind' | 'level' | 'era'>, level = b.level): LevelDef => levelsOf(b.kind, b.kind === 'campfire' ? 'ancient' : b.era)[level - 1]; // the campfire's next level may be medieval before the era is
/** Strength of a building at its level: a defence work has its own; any other house has so much for every tile it covers, and more at each level. */
export const maxHp = (b: Pick<Building, 'kind' | 'level' | 'era'> & { hpBonus?: number }): number => Math.round((b.hpBonus ? 1 + b.hpBonus / 100 : 1) * (levelDef(b).hp || Math.round(SIEGE.buildingHpPerTile * BUILDINGS[b.kind].w * BUILDINGS[b.kind].h * (1 + 0.5 * (b.level - 1)))));
export const maxLevel = (kind: BuildingKind, era: Era) => levelsOf(kind, era).length;
/** The highest level a house can be raised to now: the campfire may always climb into the first medieval level (that step opens the era), the rest by their own era. */
export const topLevel = (b: Pick<Building, 'kind' | 'era'>): number => maxLevel(b.kind, b.kind === 'campfire' ? 'ancient' : b.era);
/** Buildings that keep the village's goods (the Kho and the campfire) as opposed to those that hold tools or staff. */
export const holdsGoods = (b: Pick<Building, 'kind'>) => b.kind === 'storage' || b.kind === 'campfire';
/** The house of each gathering trade: at most 5 people work from it; a higher level makes each of them bring in more (pace.json `levelYield`), so the village needs fewer people on the map. */
export const GATHER_HOUSE: Partial<Record<string, BuildingKind>> = { wood: 'lumberyard', stone: 'quarry', mine: 'mine', food: 'farmhouse' };
export const gatherMult = (b: Pick<Building, 'level'> | undefined): number => (b ? paceJson.levelYield[Math.min(paceJson.levelYield.length, Math.max(1, b.level)) - 1] : 1);
/** The war-logistics layer (supply, field tents and rest, harassment, the watchtower, the war research) is a medieval-era feature: off in the stone age (the medieval era, `sim.era === 'ancient'`). */
/** A building of that layer, shut away while it is off (`sim.era`): it is not built, not offered and not asked for. */
export const eraLocked = (kind: BuildingKind, game: { readonly era: Era }): boolean => game.era !== 'ancient' && (warJson.advancedBuildings as string[]).includes(kind);
/** Still needs builders: not finished yet, or an upgrade is underway. */
export const needsWork = (b: Building) => !b.done || b.upgrading || !!b.repairing;

/** A building that can be raised to a higher level. */
export const canGrow = (kind: BuildingKind): boolean => BUILDINGS[kind].buildable || !!BUILDINGS[kind].upgradable;
/** Villagers the campfire can hold at each of its levels. */
export const POP_BY_FIRE: number[] = (BUILDING_FILES.campfire as BuildingFile).popByFire!;
/** Highest level any other house may have for a campfire level: the Nhà chung is the axis the whole village turns on (data/progression.json). */
export const levelCapByFire = (fireLevel: number): number => fireBuildingMax(fireLevel);
