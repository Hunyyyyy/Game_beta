import type { Res } from './resources';

export type Job = 'idle' | 'wood' | 'stone' | 'food' | 'build' | 'craft' | 'research' | 'repair' | 'hunt' | 'fight';
export type WorkJob = Exclude<Job, 'idle'>;
export type StatKey = 'vit' | 'str' | 'agi' | 'int' | 'sta';
export type Stats = Record<StatKey, number>;
export type NodeKind = 'tree' | 'rock' | 'bush';

export const STAT_NAME: Record<StatKey, string> = { vit: 'Sức khỏe', str: 'Sức mạnh', agi: 'Nhanh nhẹn', int: 'Trí tuệ', sta: 'Thể lực' };

export interface JobDef {
  name: string;
  stat: StatKey;       // chỉ số chính
  res?: Res;           // tài nguyên làm ra
  node?: NodeKind;     // loại nguồn khai thác
  baseTime: number;    // giây cho 1 đơn vị, dân cấp 0 hệ số 1,0 (chưa tính đi lại)
  anim: string;        // tên hoạt ảnh khi làm
}

export const JOBS: Record<WorkJob, JobDef> = {
  wood: { name: 'Đốn gỗ', stat: 'str', res: 'wood', node: 'tree', baseTime: 12, anim: 'chop' },
  stone: { name: 'Thợ đá', stat: 'str', res: 'stone', node: 'rock', baseTime: 18, anim: 'mine' },
  food: { name: 'Hái lượm', stat: 'agi', res: 'food', node: 'bush', baseTime: 20, anim: 'gather' },
  build: { name: 'Thợ xây', stat: 'sta', baseTime: 1, anim: 'build' },
  craft: { name: 'Chế tạo', stat: 'int', baseTime: 1, anim: 'craft' },
  research: { name: 'Nghiên cứu', stat: 'int', baseTime: 1, anim: 'gather' },
  repair: { name: 'Sửa chữa', stat: 'agi', baseTime: 1, anim: 'craft' },
  hunt: { name: 'Thợ săn', stat: 'agi', baseTime: 1, anim: 'thrust' },
  fight: { name: 'Chiến binh', stat: 'str', baseTime: 1, anim: 'smash' },
};
export const JOB_NAME: Record<Job, string> = { idle: 'Rảnh', wood: 'Đốn gỗ', stone: 'Thợ đá', food: 'Hái lượm', build: 'Thợ xây', craft: 'Chế tạo', research: 'Nghiên cứu', repair: 'Sửa chữa', hunt: 'Thợ săn', fight: 'Chiến binh' };
export const WORK_JOBS: WorkJob[] = ['wood', 'stone', 'food', 'build', 'craft', 'research', 'repair', 'hunt', 'fight'];
/** Jobs done inside a building: the villager walks in and works from the list there. */
export const STAFF_BUILDING = { craft: 'workshop', research: 'lab', repair: 'repair' } as const;
export const isStaffJob = (j: Job): j is keyof typeof STAFF_BUILDING => j in STAFF_BUILDING;

/** Kinh nghiệm cần để lên cấp 1..5 (giây làm việc, chưa nhân tốc độ học). */
export const XP_LEVELS = [60, 150, 300, 500, 800];
export const MAX_LEVEL = 5;
