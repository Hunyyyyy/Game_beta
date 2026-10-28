/** The shapes and constants the simulation shares: villagers, their parts, and a few tables. Nothing here has behaviour. */
import { Building } from './buildings';
import { Job, NodeKind, Stats, WorkJob } from './jobs';
import { Step } from './path';
import { Res } from './resources';
import { Recipe, ToolSet } from './tools';
import { Team } from './combat';

export type Sex = 'm' | 'f';
export type Facing = 'front' | 'back' | 'right' | 'left';
export type Phase = 'idle' | 'move' | 'goNode' | 'work' | 'goStore' | 'wait' | 'goSite' | 'build' | 'goShop' | 'craft' | 'goEquip' | 'goHome' | 'sleep' | 'goStaff' | 'inside' | 'goOrder' | 'fight' | 'flee' | 'down' | 'goCarcass' | 'skin' | 'rescue';
export interface Look { sex: Sex; skin: string; hair: string; hide: string; pants: string }
export interface Skill { xp: number; level: number }
export interface LogLine { t: number; text: string }
/** Công cụ đang hiện trong tay (để vẽ). */
export interface Hold { kind: string; tier: number }
/** What a unit is attacking: another unit (player or tribe) or an animal. */
export interface Target { kind: 'unit' | 'animal'; id: number }
export type Shift = 'day' | 'night' | 'both';
export type Stance = 'aggressive' | 'defensive' | 'retreat';
/** One queued order (Shift + right click). */
export type OrderStep = { k: 'move'; x: number; y: number } | { k: 'attackMove'; x: number; y: number } | { k: 'attack'; t: Target };
export interface FightState {
  /** guard: stay at the anchor and fight what comes by the stance rules; hold: only hit what is in reach. */
  mode: 'none' | 'attack' | 'attackMove' | 'hold' | 'guard';
  target: Target | null;
  /** Attack-move destination. */
  dest: { x: number; y: number } | null;
  /** Where a defensive or holding unit stays. */
  anchor: { x: number; y: number } | null;
  repath: number; // seconds until the path to the target is recomputed
  scan: number;   // seconds until the next look for enemies
}
/** A missile in flight: arrows, sling stones. */
export interface Projectile {
  x: number; y: number; tx: number; ty: number; speed: number;
  dmg: number; type: 'pierce' | 'slash' | 'crush'; from: { x: number; y: number };
  src: number; team: Team; target: Target; chance: number; kind: 'arrow' | 'stone';
}
export interface FoeAI {
  role: 'civ' | 'guard' | 'raider';
  camp: { x: number; y: number };
  wander: number;          // seconds until the next stroll
  goal: { x: number; y: number } | null;
  raid: number;            // id of the raid party (0 = none)
}
/** Điểm đứng cuối cùng và hướng nhìn (luôn ngang) khi làm việc. */
export interface Slide { x: number; y: number; face: 'left' | 'right' }

export interface Villager {
  id: number;
  name: string;
  look: Look;
  /** Vị trí theo đơn vị ô (tâm ô (i,j) là (i+0.5, j+0.5)). */
  x: number;
  y: number;
  path: Step[];
  /** Bước trượt cuối cùng tới điểm làm việc sát vật thể. */
  slide: Slide | null;
  facing: Facing;
  speed: number;
  animClock: number;
  tx: number; // ô đã dùng để cập nhật sương mù
  ty: number;
  stats: Stats;
  /** Tiềm năng học nghề: 1–3 sao, càng cao càng lên cấp nhanh. */
  potential: Record<WorkJob, number>;
  skill: Record<WorkJob, Skill>;
  tools: ToolSet;
  job: Job;
  phase: Phase;
  slot: number;     // chỗ đứng đã giữ bên cạnh nguồn: 1 = trái, 2 = phải, 0 = chưa giữ
  target: number;   // chỉ số ô nguồn hoặc id công trình đang nhắm
  prefer: number;   // mục tiêu người chơi chỉ định (-1 nếu không)
  progress: number;
  frac: number;     // phần lẻ của sản lượng chưa nhận
  timer: number;
  order: string | null; // đơn chế tác đang làm
  carry: { res: Res; amount: number } | null;
  fullness: number; // 100 = no, 0 = đói lả
  health: number;
  starving: boolean;
  anim: string;
  hold: Hold | null;
  bad: Map<number, number>; // nguồn không tới được -> hết hạn
  team: Team;
  maxHealth: number;
  weapon: string | null;  // crafted weapon id (club, spear, mace); null = fists
  armor: string | null;   // armour id (hide)
  morale: number;         // 0..100
  stance: Stance;
  fight: FightState;
  queue: OrderStep[];
  atkCd: number;          // seconds until the next blow
  down: number;           // seconds left lying wounded (0 = on feet)
  rescue: number;         // seconds an ally has been tending this wounded unit
  fleeT: number;          // seconds left running away
  calm: number;           // seconds since the last threat was near
  loot: number;           // carcass id being skinned (-1 none)
  leader: boolean;        // best fighter of a group of 5+: boosts morale
  /** A blow in progress: damage lands when the animation reaches its hit frame. */
  swing: { t: number; hitAt: number; end: number; target: Target } | null;
  flinch: number;         // seconds left of the 'hit' animation
  /** Only tribal people: their role and where their camp is. */
  ai: FoeAI | null;
  bed: number;      // reserved sleeping tile by the campfire (-1 if none)
  /** Called up by the player (or the alarm) off shift: stays awake until the shift changes. */
  nightOwl: boolean;
  /** Energy (sức), 0-100: work uses it, sleep gives it back (see rest.ts). */
  energy: number;
  /** Tiredness that piles up from night work and collapsing; it lowers the energy ceiling and slows recovery. */
  strain: number;
  /** When this villager works: by day, by night, or round the clock (the player chooses). */
  shift: Shift;
  /** A torch in the off hand, with how long it will still burn; needed for night work. */
  torch: { dur: number } | null;
  /** While asleep from exhaustion: the energy they must reach before anyone can wake them. 0 = free to wake. */
  lockUntil: number;
  /** The torch is lit and in sight (drawn and lighting the ground); worked out each tick. */
  lit: boolean;
  /** Gear was handed out by the player: the stores no longer swap it automatically. */
  manualGear: boolean;
  /** Building the villager is working inside (research, crafting or repair house); null when out on the map. */
  inside: number | null;
  /** Seconds until the villager may go and place another order for a tool. */
  orderCd: number;
  /** Recipe id of the tool this villager handed in for repair; the mended tool comes back to them if they still need it. */
  repairFor: string | null;
}

/** Hunger while asleep, as a share of the waking rate. */
export const SLEEP_HUNGER = 0.4;

export const NAMES_M = ['Bo', 'Rô', 'Gia', 'Mun', 'Lô', 'Tù', 'Đa'];
export const NAMES_F = ['Tia', 'Noa', 'Ma', 'Pa', 'Kê', 'Ly', 'Sa'];
export const HAIR = ['#4a2e1a', '#2b1b10', '#6b3f1d', '#c98a3a', '#7a5a3a'];
export const SKIN = ['#d9a371', '#e8c4a0', '#c58a5c', '#b87850'];
export const NODE_JOB: Record<NodeKind, WorkJob> = { tree: 'wood', rock: 'stone', bush: 'food' };
export const STAT_KEYS = ['vit', 'str', 'agi', 'int', 'sta'] as const;
export const XP_MULT = [0, 1, 1.5, 2];
/** Khoảng cách ngang (ô) từ tâm vật thể tới chỗ dân đứng khi làm. */
export const REACH: Record<NodeKind, number> = { tree: 0.55, rock: 0.62, bush: 0.5 };
export const LEFT = 1, RIGHT = 2;

export interface PlaceResult { ok: boolean; reason?: string; building?: Building }
