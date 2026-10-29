import type { BuildingKind, Era } from './buildings';
import type { Res } from './resources';
import paceJson from '../data/pace.json';
import trainingJson from '../data/training.json';

export type Job = 'idle' | 'wood' | 'stone' | 'food' | 'build' | 'craft' | 'research' | 'repair' | 'hunt' | 'fight' | 'scout';
/** Jobs with a work skill, a potential and a tool. Soldiers have them for the sake of the tables; scouts are a role like soldiers and have none. */
export type WorkJob = Exclude<Job, 'idle' | 'scout'>;
export type StatKey = 'vit' | 'str' | 'agi' | 'int' | 'sta';
export type Stats = Record<StatKey, number>;
export type NodeKind = 'tree' | 'rock' | 'bush';

/** Training in a role's house (training.json): which stat a house trains, which comes with it, and which pays for it. */
export interface TrainProfile { main: StatKey; partner?: StatKey; cost: StatKey }
export const TRAINING = trainingJson as unknown as { dayBase: number; dayPerStat: number; foodBase: number; coinBase: number; coinPerStat: number; gain: [number, number]; partnerShare: number; floor: number; floorMin: number; caps: number[]; care: Array<{ name: string; coin: number; penalty: number }>; profiles: Record<string, TrainProfile> };
/** A stat as the player reads it: whole, or with one digit after the point. */
export const fmtStat = (x: number): string => String(Math.round(x * 10) / 10);

export const STAT_NAME: Record<StatKey, string> = { vit: 'Sức khỏe', str: 'Sức mạnh', agi: 'Nhanh nhẹn', int: 'Trí tuệ', sta: 'Thể lực' };

export interface JobDef {
  name: string;
  stat: StatKey;       // chỉ số chính
  res?: Res;           // tài nguyên làm ra
  node?: NodeKind;     // loại nguồn khai thác
  baseTime: number;    // giây thật (tốc độ 1×) để thu 1 đơn vị, dân hệ số 1,0 (chưa tính đi lại); xem src/data/pace.json
  anim: string;        // tên hoạt ảnh khi làm
}

export const JOBS: Record<WorkJob, JobDef> = {
  wood: { name: 'Đốn gỗ', stat: 'str', res: 'wood', node: 'tree', baseTime: paceJson.gather.wood, anim: 'chop' },
  stone: { name: 'Thợ đá', stat: 'str', res: 'stone', node: 'rock', baseTime: paceJson.gather.stone, anim: 'mine' },
  food: { name: 'Hái lượm', stat: 'agi', res: 'food', node: 'bush', baseTime: paceJson.gather.food, anim: 'gather' },
  build: { name: 'Thợ xây', stat: 'sta', baseTime: 1, anim: 'build' },
  craft: { name: 'Chế tạo', stat: 'int', baseTime: 1, anim: 'craft' },
  research: { name: 'Nghiên cứu', stat: 'int', baseTime: 1, anim: 'gather' },
  repair: { name: 'Sửa chữa', stat: 'agi', baseTime: 1, anim: 'craft' },
  hunt: { name: 'Thợ săn', stat: 'agi', baseTime: 1, anim: 'thrust_attack' },
  fight: { name: 'Chiến binh', stat: 'str', baseTime: 1, anim: 'swing_attack' },
};
export const JOB_NAME: Record<Job, string> = { idle: 'Rảnh', wood: 'Đốn gỗ', stone: 'Thợ đá', food: 'Hái lượm', build: 'Thợ xây', craft: 'Chế tạo', research: 'Nghiên cứu', repair: 'Sửa chữa', hunt: 'Thợ săn', fight: 'Chiến binh', scout: 'Trinh sát' };
export const WORK_JOBS: WorkJob[] = ['wood', 'stone', 'food', 'build', 'craft', 'research', 'repair', 'hunt', 'fight'];
/** The arm a soldier belongs to, decided by the camp that took him on. Riders count as cavalry whatever they carry. */
export type SoldierArm = 'foot' | 'archer' | 'cavalry';

/**
 * A role is a job a villager is given by the house that belongs to it, never at the campfire. Each role has one house; its level decides
 * how many people the role may have. Names change with the era but not the meaning (a stone-age tribe has no archers, only throwers).
 */
export type RoleId = 'wood' | 'stone' | 'food' | 'hunt' | 'foot' | 'cavalry' | 'archer' | 'scout';
export interface RoleDef { job: Job; arm?: SoldierArm; building: BuildingKind; names: Record<Era, string> }
export const ROLES: Record<RoleId, RoleDef> = {
  wood: { job: 'wood', building: 'lumberyard', names: { stone: 'Đốn gỗ', ancient: 'Tiều phu' } },
  stone: { job: 'stone', building: 'quarry', names: { stone: 'Thợ đá', ancient: 'Thợ mỏ' } },
  food: { job: 'food', building: 'farmhouse', names: { stone: 'Hái lượm', ancient: 'Nông dân' } },
  hunt: { job: 'hunt', building: 'huntlodge', names: { stone: 'Thợ săn', ancient: 'Thợ săn' } },
  foot: { job: 'fight', arm: 'foot', building: 'infantry', names: { stone: 'Chiến binh', ancient: 'Bộ binh' } },
  cavalry: { job: 'fight', arm: 'cavalry', building: 'cavalry', names: { stone: 'Kỵ thú', ancient: 'Kỵ binh' } },
  archer: { job: 'fight', arm: 'archer', building: 'archery', names: { stone: 'Thợ ném', ancient: 'Cung thủ' } },
  scout: { job: 'scout', building: 'scouttent', names: { stone: 'Trinh sát', ancient: 'Trinh sát' } },
};
export const ROLE_IDS = Object.keys(ROLES) as RoleId[];
export const roleName = (role: RoleId, era: Era): string => ROLES[role].names[era];
/** The role a villager has, or null for one with no role (idle, or working inside a house). Farmers of a field belong to the field, not to the Nông trại. */
export function roleOf(v: { job: Job; arm: SoldierArm; post: number }): RoleId | null {
  switch (v.job) {
    case 'fight': return v.arm === 'archer' ? 'archer' : v.arm === 'cavalry' ? 'cavalry' : 'foot';
    case 'food': return v.post < 0 ? 'food' : null;
    case 'wood': case 'stone': case 'hunt': case 'scout': return v.job;
    default: return null;
  }
}

/** Jobs done inside a building: the villager walks in and works from the list there. */
export const STAFF_BUILDING = { craft: 'workshop', research: 'lab', repair: 'repair' } as const;
export const isStaffJob = (j: Job): j is keyof typeof STAFF_BUILDING => j in STAFF_BUILDING;

/** Seconds of a farmer's work for one unit of food from a field of the first level. */
export const FARM_TIME = paceJson.gather.farm;

/** Kinh nghiệm cần để lên cấp 1..5 (giây làm việc, chưa nhân tốc độ học). */
export const XP_LEVELS = [60, 150, 300, 500, 800];
export const MAX_LEVEL = 5;
/** Jobs done out on the map by a crew that belongs to a house: builders are the crew of the Nhà thợ xây. */
export const CREW_BUILDING = { build: 'builder' } as const;

/** How bare hands compare with a good tool for a job (1 = just as good). */
export const BARE_HANDS = paceJson.bare as Partial<Record<WorkJob, number>>;
/** Jobs done in the open, which weather and season slow down. */
export const OUTDOOR_JOBS = paceJson.outdoor as WorkJob[];
