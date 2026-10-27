import type { Stock } from './resources';

export type BuildingKind = 'campfire' | 'storage' | 'workshop' | 'lab' | 'repair' | 'toolstore' | 'armory';

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
  /** Levels per era; an era without an entry reuses the closest earlier era's levels. */
  levels: Partial<Record<Era, LevelDef[]>>;
}

const lv = (name: string, cost: Partial<Stock>, buildTime: number, cap = 0, craftSpeed = 1, slots = 0): LevelDef => ({ name, cost, buildTime, cap, craftSpeed, slots });

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  campfire: { kind: 'campfire', name: 'Nhà chung (đống lửa trại)', w: 2, h: 2, buildable: false, levels: { stone: [lv('Lửa trại', {}, 0, 50)] } },
  workshop: {
    kind: 'workshop', name: 'Nhà chế tạo', w: 2, h: 2, buildable: true,
    levels: { stone: [lv('Đơn sơ', { wood: 15 }, 30, 0, 1, 1), lv('Gỗ', { wood: 15, stone: 30 }, 60, 0, 1.25, 2), lv('Đá', { wood: 30, stone: 50 }, 90, 0, 1.5, 3)] },
  },
  lab: {
    kind: 'lab', name: 'Nhà nghiên cứu', w: 2, h: 2, buildable: true,
    levels: { stone: [lv('Đơn sơ', { wood: 20 }, 40, 0, 1, 1), lv('Gỗ', { wood: 20, stone: 30 }, 70, 0, 1.25, 2), lv('Đá', { wood: 30, stone: 50 }, 100, 0, 1.5, 4)] },
  },
  repair: {
    kind: 'repair', name: 'Nhà sửa chữa', w: 2, h: 2, buildable: true,
    levels: { stone: [lv('Đơn sơ', { wood: 15, stone: 5 }, 30, 0, 1, 1), lv('Gỗ', { wood: 15, stone: 30 }, 60, 0, 1.25, 2), lv('Đá', { wood: 30, stone: 50 }, 90, 0, 1.5, 3)] },
  },
  toolstore: {
    kind: 'toolstore', name: 'Kho công cụ', w: 2, h: 2, buildable: true,
    levels: { stone: [lv('Đơn sơ', { wood: 25 }, 30, 12), lv('Gỗ', { wood: 30, stone: 15 }, 55, 30), lv('Đá', { wood: 30, stone: 40 }, 80, 60)] },
  },
  armory: {
    kind: 'armory', name: 'Kho vũ khí', w: 2, h: 2, buildable: true,
    levels: { stone: [lv('Đơn sơ', { wood: 25 }, 30, 12), lv('Gỗ', { wood: 30, stone: 15 }, 55, 30), lv('Đá', { wood: 30, stone: 40 }, 80, 60)] },
  },
  storage: {
    kind: 'storage', name: 'Kho', w: 2, h: 2, buildable: true,
    levels: { stone: [lv('Đơn sơ', { wood: 10 }, 20, 100), lv('Gỗ', { wood: 35 }, 40, 250), lv('Đá', { wood: 40, stone: 20 }, 60, 500)] },
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
