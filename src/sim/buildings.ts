import type { Stock } from './resources';

export type BuildingKind = 'campfire' | 'builder' | 'storage' | 'workshop' | 'lab' | 'repair' | 'toolstore' | 'armory' | 'barracks' | 'house' | 'field';

/** Eras of the game. Each era has its own building art and its own level list (L1..L3). */
export type Era = 'stone' | 'ancient';
export const ERAS: Era[] = ['stone', 'ancient'];
export const ERA_NAME: Record<Era, string> = { stone: 'Thời đại Đồ đá', ancient: 'Thời đại Cổ đại' };

/** One level of a building. Level 1 is the cost to place it; higher levels are upgrade costs. */
export interface LevelDef {
  name: string;      // material tier shown to the player: Đơn sơ, Gỗ, Đá
  cost: Partial<Stock>;
  buildTime: number; // seconds for a builder with factor 1.0
  cap: number;       // storage per resource (Kho), items held (Kho công cụ, Kho vũ khí)
  craftSpeed: number;
  /** Villagers that can work inside (research, crafting and repair houses). */
  slots: number;
}

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  w: number;
  h: number;
  buildable: boolean;
  /** Can be raised to a higher level although it cannot be built, moved or torn down (the campfire). */
  upgradable?: boolean;
  /** Kinds that must stand, finished, before this one can be placed: the order the village grows in. */
  requires?: BuildingKind[];
  /** How many may stand for each campfire level 1..4, added up over every campfire. Without it a village gets one: the houses you open from a menu. */
  perFire?: number[];
  /** Levels per era; an era without an entry reuses the closest earlier era's levels. */
  levels: Partial<Record<Era, LevelDef[]>>;
}

const lv = (name: string, cost: Partial<Stock>, buildTime: number, cap = 0, craftSpeed = 1, slots = 0): LevelDef => ({ name, cost, buildTime, cap, craftSpeed, slots });

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  // the heart of the village: it starts as a heap of firewood and every other house is held back by its level
  campfire: {
    kind: 'campfire', name: 'Nhà chung (đống lửa trại)', w: 2, h: 2, buildable: false, upgradable: true,
    levels: { stone: [lv('Củi lửa', {}, 0, 30), lv('Lửa trại', { wood: 20 }, 120, 45), lv('Bếp lửa lớn', { wood: 20, stone: 12 }, 240, 60), lv('Nhà chung', { wood: 50, stone: 30, hide: 10 }, 480, 90)] },
  },
  // builders belong to this house: without it nothing but the house itself can be raised
  builder: {
    kind: 'builder', name: 'Nhà thợ xây', w: 2, h: 2, buildable: true,
    levels: { stone: [lv('Đơn sơ', { wood: 10 }, 60, 0, 1, 2), lv('Gỗ', { wood: 15, stone: 10 }, 110, 0, 1.25, 3), lv('Đá', { wood: 25, stone: 20 }, 160, 0, 1.5, 4)] },
  },
  storage: {
    kind: 'storage', name: 'Kho', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: [lv('Đơn sơ', { wood: 10 }, 50, 100), lv('Gỗ', { wood: 35 }, 90, 250), lv('Đá', { wood: 40, stone: 20 }, 140, 500)] },
  },
  workshop: {
    kind: 'workshop', name: 'Nhà chế tạo', w: 2, h: 2, buildable: true, requires: ['builder'],
    levels: { stone: [lv('Đơn sơ', { wood: 15 }, 70, 0, 1, 1), lv('Gỗ', { wood: 15, stone: 30 }, 120, 0, 1.25, 2), lv('Đá', { wood: 30, stone: 50 }, 180, 0, 1.5, 3)] },
  },
  lab: {
    kind: 'lab', name: 'Nhà nghiên cứu', w: 2, h: 2, buildable: true, requires: ['workshop'],
    levels: { stone: [lv('Đơn sơ', { wood: 20 }, 80, 0, 1, 1), lv('Gỗ', { wood: 20, stone: 30 }, 140, 0, 1.25, 2), lv('Đá', { wood: 30, stone: 50 }, 200, 0, 1.5, 4)] },
  },
  repair: {
    kind: 'repair', name: 'Nhà sửa chữa', w: 2, h: 2, buildable: true, requires: ['workshop'],
    levels: { stone: [lv('Đơn sơ', { wood: 15, stone: 5 }, 70, 0, 1, 1), lv('Gỗ', { wood: 15, stone: 30 }, 120, 0, 1.25, 2), lv('Đá', { wood: 30, stone: 50 }, 180, 0, 1.5, 3)] },
  },
  toolstore: {
    kind: 'toolstore', name: 'Kho công cụ', w: 2, h: 2, buildable: true, requires: ['workshop'],
    levels: { stone: [lv('Đơn sơ', { wood: 25 }, 60, 12), lv('Gỗ', { wood: 30, stone: 15 }, 100, 30), lv('Đá', { wood: 30, stone: 40 }, 150, 60)] },
  },
  armory: {
    kind: 'armory', name: 'Kho vũ khí', w: 2, h: 2, buildable: true, requires: ['workshop'],
    levels: { stone: [lv('Đơn sơ', { wood: 25 }, 60, 12), lv('Gỗ', { wood: 30, stone: 15 }, 100, 30), lv('Đá', { wood: 30, stone: 40 }, 150, 60)] },
  },
  // where soldiers sleep, out of sight, as a list (slots = beds, craftSpeed = how well they rest); without a bed they sleep by the campfire
  barracks: {
    kind: 'barracks', name: 'Lều chiến binh', w: 2, h: 2, buildable: true, requires: ['builder'],
    perFire: [1, 2, 2, 2],
    levels: { stone: [lv('Đơn sơ', { wood: 20 }, 60, 0, 1, 3), lv('Gỗ', { wood: 25, hide: 6 }, 100, 0, 1.1, 5), lv('Đá', { wood: 30, stone: 25, hide: 10 }, 150, 0, 1.2, 8)] },
  },
  // where everyone who is not a soldier sleeps, out of sight, as a list; without a bed they sleep by the campfire and rest slower
  house: {
    kind: 'house', name: 'Nhà dân', w: 2, h: 2, buildable: true, requires: ['builder'],
    perFire: [1, 3, 3, 3],
    levels: { stone: [lv('Đơn sơ', { wood: 20 }, 60, 0, 1, 4), lv('Gỗ', { wood: 30, stone: 10 }, 100, 0, 1.15, 8), lv('Đá', { wood: 40, stone: 30 }, 150, 0, 1.3, 12)] },
  },
  // slots = farmers at once, craftSpeed = how fast they work the soil; food comes in with the seasons (seasons.json "farm"), bushes are only the start
  field: {
    kind: 'field', name: 'Ruộng', w: 3, h: 3, buildable: true, requires: ['builder'], perFire: [1, 3, 3, 4],
    levels: { stone: [lv('Đất vỡ', { wood: 10 }, 70, 0, 1, 1), lv('Luống đắp', { wood: 15, stone: 5 }, 110, 0, 1.4, 1), lv('Bờ đá', { wood: 20, stone: 15 }, 160, 0, 1.8, 1)] },
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
  /** Villagers working inside (research, crafting and repair houses). */
  staff: number[];
  /** The order being worked on right now (research, crafting or repair): its id and progress 0..1. */
  active: { id: string; progress: number } | null;
  workers: number;
}

/** Level list of a building kind in an era, falling back to the closest earlier era that defines one. */
export function levelsOf(kind: BuildingKind, era: Era): LevelDef[] {
  const defs = BUILDINGS[kind].levels;
  for (let i = ERAS.indexOf(era); i >= 0; i--) { const l = defs[ERAS[i]]; if (l) return l; }
  return defs.stone!;
}
export const levelDef = (b: Pick<Building, 'kind' | 'level' | 'era'>, level = b.level): LevelDef => levelsOf(b.kind, b.era)[level - 1];
export const maxLevel = (kind: BuildingKind, era: Era) => levelsOf(kind, era).length;
/** Buildings that keep the village's goods (the Kho and the campfire) as opposed to those that hold tools or staff. */
export const holdsGoods = (b: Pick<Building, 'kind'>) => b.kind === 'storage' || b.kind === 'campfire';
/** Still needs builders: not finished yet, or an upgrade is underway. */
export const needsWork = (b: Building) => !b.done || b.upgrading;

/** A building that can be raised to a higher level. */
export const canGrow = (kind: BuildingKind): boolean => BUILDINGS[kind].buildable || !!BUILDINGS[kind].upgradable;
/** Villagers the campfire can hold at each of its levels. */
export const POP_BY_FIRE = [8, 16, 25, 40];
/** Highest level any other house may have for a campfire level: the Nhà chung is the axis the whole village turns on. */
export const levelCapByFire = (fireLevel: number): number => Math.max(1, fireLevel - 1);
