import type { Stock } from './resources';

export type BuildingKind = 'campfire' | 'storage' | 'workshop';

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  w: number;
  h: number;
  cost: Partial<Stock>;
  buildTime: number; // giây, thợ xây hệ số 1,0
  cap: number;       // sức chứa mỗi loại tài nguyên
  buildable: boolean;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  campfire: { kind: 'campfire', name: 'Nhà chung (đống lửa trại)', w: 2, h: 2, cost: {}, buildTime: 0, cap: 50, buildable: false },
  workshop: { kind: 'workshop', name: 'Xưởng chế tác', w: 2, h: 2, cost: { wood: 15 }, buildTime: 30, cap: 0, buildable: true },
  storage: { kind: 'storage', name: 'Kho', w: 2, h: 2, cost: { wood: 10 }, buildTime: 20, cap: 100, buildable: true },
};

export interface Building {
  id: number;
  kind: BuildingKind;
  x: number; // ô trên-trái
  y: number;
  progress: number; // 0..1
  done: boolean;
  workers: number;
}
