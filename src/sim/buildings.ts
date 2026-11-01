import { SIEGE } from './combat';
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
  cost: Partial<Stock>;
  buildTime: number; // seconds for a builder with factor 1.0
  cap: number;       // storage per resource (Kho), items held (Kho công cụ, Kho vũ khí)
  craftSpeed: number;
  /** Villagers that can work inside (research and crafting houses). */
  slots: number;
  /** Strength of a defence work: what the raiders must wear down to get through (0 for the rest). */
  hp: number;
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
  /** How many may stand for each campfire level 1..4, added up over every campfire. Without it a village gets one: the houses you open from a menu. */
  perFire?: number[];
  /** Stays in placing mode after each piece, for works laid one tile at a time (the fence). */
  repeat?: boolean;
  /** Levels per era; an era without an entry reuses the closest earlier era's levels. */
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
  const d: BuildingDef = { kind: k, name: f.name, names: f.names, group: f.group, produces: f.produces, w: f.size[0], h: f.size[1], buildable: f.buildable, upgradable: f.upgradable, unlockFire: f.unlockFire, requires: f.requires, perFire: f.limit, repeat: f.repeat, levels: f.levels };
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
  /** Moved and standing again from salvaged parts: builds in half the time. */
  rebuild: boolean;
  /** Strength left of a defence work (fence, gate, tower); 0 for the other houses. */
  hp: number;
  /** A gate lets everyone through while it is open, and stops everyone while it is shut. */
  open: boolean;
  /** Villagers working inside (research and crafting houses). */
  staff: number[];
  /** The order being worked on right now (research or crafting): its id and progress 0..1. */
  active: { id: string; progress: number } | null;
  workers: number;
}

/** How far a finished house sees, in tiles (the `sight` of its level in building.json): it clears the fog round itself and the circle is the land of the village. */
export function buildingSight(b: Pick<Building, 'kind' | 'level' | 'done'> & { era?: Era }): number {
  if (!b.done) return 0;
  const lv = levelsOf(b.kind, b.era ?? 'stone');
  return lv[Math.min(lv.length, Math.max(1, b.level)) - 1].sight;
}

/** What a kind of house is called in an era. */
export const buildingName = (kind: BuildingKind, era: Era): string => BUILDINGS[kind].names?.[era] ?? BUILDINGS[kind].name;

/** Level list of a building kind in an era, falling back to the closest earlier era that defines one. */
export function levelsOf(kind: BuildingKind, era: Era): LevelDef[] {
  const defs = BUILDINGS[kind].levels;
  for (let i = ERAS.indexOf(era); i >= 0; i--) { const l = defs[ERAS[i]]; if (l) return l; }
  return defs.stone!;
}
export const levelDef = (b: Pick<Building, 'kind' | 'level' | 'era'>, level = b.level): LevelDef => levelsOf(b.kind, b.era)[level - 1];
/** Strength of a building at its level: a defence work has its own; any other house has so much for every tile it covers, and more at each level. */
export const maxHp = (b: Pick<Building, 'kind' | 'level' | 'era'>): number => levelDef(b).hp || Math.round(SIEGE.buildingHpPerTile * BUILDINGS[b.kind].w * BUILDINGS[b.kind].h * (1 + 0.5 * (b.level - 1)));
export const maxLevel = (kind: BuildingKind, era: Era) => levelsOf(kind, era).length;
/** Buildings that keep the village's goods (the Kho and the campfire) as opposed to those that hold tools or staff. */
export const holdsGoods = (b: Pick<Building, 'kind'>) => b.kind === 'storage' || b.kind === 'campfire';
/** Still needs builders: not finished yet, or an upgrade is underway. */
export const needsWork = (b: Building) => !b.done || b.upgrading;

/** A building that can be raised to a higher level. */
export const canGrow = (kind: BuildingKind): boolean => BUILDINGS[kind].buildable || !!BUILDINGS[kind].upgradable;
/** Villagers the campfire can hold at each of its levels. */
export const POP_BY_FIRE: number[] = (BUILDING_FILES.campfire as BuildingFile).popByFire!;
/** Highest level any other house may have for a campfire level: the Nhà chung is the axis the whole village turns on (data/progression.json). */
export const levelCapByFire = (fireLevel: number): number => fireBuildingMax(fireLevel);
