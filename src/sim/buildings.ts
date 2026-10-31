import { SIEGE } from './combat';
import type { Stock } from './resources';
import { fireBuildingMax } from './progression';
import levelData from '../data/buildings.json';

export type BuildingKind = 'campfire' | 'builder' | 'storage' | 'workshop' | 'lab' | 'toolstore' | 'armory' | 'infantry' | 'cavalry' | 'archery' | 'farmhouse' | 'huntlodge' | 'lumberyard' | 'quarry' | 'house' | 'field' | 'fence' | 'gate' | 'tower' | 'wartent' | 'scouttent' | 'drill' | 'trap' | 'stable';

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
}

export interface BuildingDef {
  kind: BuildingKind;
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

/** Costs and numbers of every level of every house in the stone age: src/data/buildings.json. */
const STONE_LEVELS = levelData as unknown as Record<string, LevelDef[]>;

const lv = (name: string, cost: Partial<Stock>, buildTime: number, cap = 0, craftSpeed = 1, slots = 0, hp = 0): LevelDef => ({ name, cost, buildTime, cap, craftSpeed, slots, hp });

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  // the heart of the village: it starts as a heap of firewood and every other house is held back by its level
  campfire: {
    kind: 'campfire', name: 'Nhà chung (đống lửa trại)', w: 2, h: 2, buildable: false, upgradable: true,
    levels: { stone: STONE_LEVELS.campfire },
  },
  // builders belong to this house: without it nothing but the house itself can be raised
  builder: {
    kind: 'builder', name: 'Nhà thợ xây', w: 2, h: 2, buildable: true,
    levels: { stone: STONE_LEVELS.builder },
  },
  storage: {
    kind: 'storage', name: 'Kho', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.storage },
  },
  workshop: {
    kind: 'workshop', name: 'Nhà chế tạo', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.workshop },
  },
  lab: {
    kind: 'lab', name: 'Nhà nghiên cứu', w: 2, h: 2, buildable: true, requires: ['workshop'],
    levels: { stone: STONE_LEVELS.lab },
  },
  toolstore: {
    kind: 'toolstore', name: 'Kho công cụ', w: 2, h: 2, buildable: true, requires: ['workshop'],
    levels: { stone: STONE_LEVELS.toolstore },
  },
  armory: {
    kind: 'armory', name: 'Kho vũ khí', w: 2, h: 2, buildable: true, requires: ['workshop'],
    levels: { stone: STONE_LEVELS.armory },
  },
  // The role houses. One of each: raising its level makes room for more people (slots). The people of a role are chosen in its house, never
  // at the campfire. A soldier's camp is also where he sleeps, out of sight, as a list (craftSpeed = how well they rest).
  infantry: {
    kind: 'infantry', name: 'Trại chiến binh', names: { ancient: 'Trại bộ binh' }, w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.infantry },
  },
  cavalry: {
    kind: 'cavalry', name: 'Trại kỵ thú', names: { ancient: 'Trại kỵ binh' }, w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.cavalry },
  },
  archery: {
    kind: 'archery', name: 'Trại thợ ném', names: { ancient: 'Trại cung thủ' }, w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.archery },
  },
  farmhouse: {
    kind: 'farmhouse', name: 'Nông trại', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.farmhouse },
  },
  huntlodge: {
    kind: 'huntlodge', name: 'Chòi thợ săn', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.huntlodge },
  },
  lumberyard: {
    kind: 'lumberyard', name: 'Xưởng gỗ', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.lumberyard },
  },
  quarry: {
    kind: 'quarry', name: 'Xưởng đá', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.quarry },
  },
  // where everyone who is not a soldier sleeps, out of sight, as a list; without a bed they sleep by the campfire and rest slower
  house: {
    kind: 'house', name: 'Nhà dân', w: 2, h: 2, buildable: true, requires: ['builder'],
    perFire: [1, 3, 3, 3],
    levels: { stone: STONE_LEVELS.house },
  },
  // defence works (not "one of each": they are laid piece by piece, as many as the campfire allows). hp is what the raiders must break down.
  fence: {
    kind: 'fence', name: 'Hàng rào cọc', w: 1, h: 1, buildable: true, requires: ['builder'], perFire: [14, 30, 50, 70], repeat: true,
    levels: { stone: STONE_LEVELS.fence },
  },
  // slots here are the archers who can keep watch on a tower; a gate has no staff, it opens and shuts
  gate: {
    kind: 'gate', name: 'Cổng', w: 1, h: 1, buildable: true, requires: ['fence'], perFire: [1, 2, 3, 4],
    levels: { stone: STONE_LEVELS.gate },
  },
  tower: {
    kind: 'tower', name: 'Chòi canh', w: 2, h: 2, buildable: true, requires: ['fence'], perFire: [0, 1, 2, 3],
    levels: { stone: STONE_LEVELS.tower },
  },
  // where the squads, formations and plans are made: its level decides how many squads and command cards there are
  wartent: {
    kind: 'wartent', name: 'Lều họp chiến', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.wartent },
  },
  // where scouts are sent from: slots = how many may go out on one trip
  scouttent: {
    kind: 'scouttent', name: 'Trại trinh sát', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.scouttent },
  },
  // the drill ground: squads train their formation here
  drill: {
    kind: 'drill', name: 'Bãi tập', w: 3, h: 3, buildable: true, requires: ['infantry'],
    levels: { stone: STONE_LEVELS.drill },
  },
  // a pit of sharpened stakes, laid one at a time; hp is how many men it can still wound
  trap: {
    kind: 'trap', name: 'Hố chông', w: 1, h: 1, buildable: true, requires: ['fence'], perFire: [4, 10, 18, 28], repeat: true,
    levels: { stone: STONE_LEVELS.trap },
  },
  // where beasts are tamed to be ridden: slots = keepers who work inside, craftSpeed = how fast they get through an order; the level decides which beast (wolf, boar, elephant)
  stable: {
    kind: 'stable', name: 'Chuồng thú cưỡi', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: STONE_LEVELS.stable },
  },
  // slots = farmers at once, craftSpeed = how fast they work the soil; food comes in with the seasons (seasons.json "farm"), bushes are only the start
  field: {
    kind: 'field', name: 'Ruộng', w: 3, h: 3, buildable: true, requires: ['builder'], perFire: [1, 3, 3, 4],
    levels: { stone: STONE_LEVELS.field },
  },
};

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

/**
 * How far a finished house sees, in tiles: it clears the fog round itself, more with its level (small: every house does it). The chòi canh is made to
 * watch from and sees much further, further with its level. Walls, pits, gates and fields see nothing; the campfire has its own (environment.fireRadius).
 */
const HOUSE_SIGHT = [5, 6, 7], TOWER_SIGHT = [10, 13, 16];
const BLIND: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['campfire', 'fence', 'gate', 'trap', 'field']);
export function buildingSight(b: Pick<Building, 'kind' | 'level' | 'done'>): number {
  if (!b.done || BLIND.has(b.kind)) return 0;
  const list = b.kind === 'tower' ? TOWER_SIGHT : HOUSE_SIGHT;
  return list[Math.min(list.length, Math.max(1, b.level)) - 1];
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
export const POP_BY_FIRE = [8, 16, 25, 40];
/** Highest level any other house may have for a campfire level: the Nhà chung is the axis the whole village turns on (data/progression.json). */
export const levelCapByFire = (fireLevel: number): number => fireBuildingMax(fireLevel);
