import type { Res } from './resources';

export type Job = 'idle' | 'wood' | 'stone' | 'food' | 'build' | 'craft';
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
  craft: { name: 'Thợ thủ công', stat: 'int', baseTime: 1, anim: 'craft' },
};
export const JOB_NAME: Record<Job, string> = { idle: 'Rảnh', wood: 'Đốn gỗ', stone: 'Thợ đá', food: 'Hái lượm', build: 'Thợ xây', craft: 'Thợ thủ công' };
export const WORK_JOBS: WorkJob[] = ['wood', 'stone', 'food', 'build', 'craft'];

/** Kinh nghiệm cần để lên cấp 1..5 (giây làm việc, chưa nhân tốc độ học). */
export const XP_LEVELS = [60, 150, 300, 500, 800];
export const MAX_LEVEL = 5;
