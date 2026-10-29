/** The shapes and constants the simulation shares: villagers, their parts, and a few tables. Nothing here has behaviour. */
import { Building } from './buildings';
import { Job, NodeKind, SoldierArm, Stats, WorkJob } from './jobs';
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
  /** Following an arrow in a war: the way to the destination is a straight line, never found round things. */
  strict?: boolean;
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
  /** Seconds a raider has been unable to get at what he is after (a fence in the way). */
  stuck?: number;
  /** The fence or gate he has decided to break down (building id), 0 for none. */
  siege?: number;
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
  /** The arm of a soldier (job 'fight'): chosen by the camp that took him on. */
  arm: SoldierArm;
  phase: Phase;
  slot: number;     // chỗ đứng đã giữ bên cạnh nguồn: 1 = trái, 2 = phải, 0 = chưa giữ
  target: number;   // chỉ số ô nguồn hoặc id công trình đang nhắm
  post: number;     // id Ruộng mà người chơi giao cho làm (nghề Hái lượm); -1 nếu không
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
  /** Wear of the weapon and the armour in hand: which piece it was counted for, hits left, and whether it is broken (useless until mended). */
  /** The squad (đội) this soldier belongs to, -1 for none. */
  squad: number;
  /** What a soldier of ours is hacking down in a war (a tree in the way, an enemy work); null when he is not. */
  breaks: Breaking | null;
  gear: { w: string | null; wd: number; wb: boolean; a: string | null; ad: number; ab: boolean };
}

// ---------------------------------------------------------------- war: squads, maps, plans
export type FormationName = 'line' | 'circle' | 'wedge' | 'horns' | 'scatter' | 'ambush';
/** A squad (đội): soldiers who move, stand and fight in one formation under one commander. */
export interface Squad {
  id: number; name: string; color: string;
  ids: number[]; leader: number;
  formation: FormationName;
  /** How well each formation is known, 0..100 (trained at the Bãi tập). */
  mastery: Record<string, number>;
  /** Until when the squad is changing formation and open to blows. */
  switchUntil: number;
  anchor: { x: number; y: number } | null; heading: number;
  training: boolean;
}
/** What the scouts of one village brought back. */
/** A person as the scouts saw him on the day they came: where he stood and what he carried. Whatever he does afterwards the map keeps. */
export interface Seen { x: number; y: number; arm: 'foot' | 'archer' | 'cavalry'; weapon: string | null; civ: boolean; leader: boolean }
export interface ScoutMap { tribe: string; level: number; at: number; gaps: number; seen?: Seen[] }
/** What a scouting trip would be like with the people picked: the odds of a full map, how long it takes (game seconds) and why it cannot go, if it cannot. */
export interface ScoutPlan { level: number; need: number; count: number; limit: number; chance: number; walk: number; survey: number; total: number; error: string | null }
export interface Pt { x: number; y: number }
/** How long a squad takes along an arrow, leg by leg. A leg that runs through water, trees or works is slower (marked `blocked`); `hits` is the first thing on each leg that shuts the way for soldiers who keep to the arrow (null: open). */
export interface RouteTime { legs: number[]; total: number; length: number; blocked: boolean[]; hits: Array<Obstacle | null> }
/** What a map of a village shows, as the planning screen draws it: the camp and 24 tiles round it. Each field appears only at the level that reveals it. */
export type IntelMark = 'civ' | 'unknown' | 'foot' | 'archer' | 'cavalry';
export interface TribeIntel {
  tribe: string; name: string;
  /** 1 sketch, 2 ground and works, 3 men by arm, stores and chief. */
  level: number;
  /** 0..1: how much of the report still holds. */
  accuracy: number; gaps: number;
  /** The tiles drawn, inclusive of x0,y0 and exclusive of x1,y1. */
  box: { x0: number; y0: number; x1: number; y1: number };
  camp: { x: number; y: number };
  /** The yard of the camp itself; the rest of the box is the 24 tiles round it. */
  yard: number;
  /** Where our village lies from there, as a unit vector. */
  toUs: { x: number; y: number } | null;
  /** About how many people live there (rounded). */
  population: number;
  structures: Array<{ kind: string; label: string; detail: string; x: number; y: number; w: number; h: number }>;
  people: Array<{ x: number; y: number; mark: IntelMark; leader: boolean; weapon: string | null }>;
  /** Soldiers by arm, level 3 only. */
  soldiers: { foot: number; archer: number; cavalry: number } | null;
}
/** `sent` is how many set out (older saves lack it). */
export interface ScoutMission { id: number; tribe: string; level: number; ids: number[]; phase: 'go' | 'watch' | 'back'; t: number; need: number; survivors: number; sent?: number; seen?: Seen[] }
/**
 * A village somebody of ours came across while out on the map. It is `carried` in his head until he gets home alive;
 * then it is `reported` and shows in the scouting list, with only how far it lies, until scouts are sent to draw it.
 */
export interface Sighting { tribe: string; by: number; at: number; reported: boolean }

export type Objective = 'camp' | 'gate' | 'stores' | 'leader' | 'ambush';
export type Route = 'main' | 'forest' | 'night';
export type Trigger = { kind: 'time'; at: number } | { kind: 'after'; squad: number } | { kind: 'signal' } | { kind: 'leaves' };
export type PlanStance = 'fight' | 'evade' | 'hold' | 'shoot';
export type MissionState = 'idle' | 'wait' | 'march' | 'blocked' | 'engaged' | 'hold' | 'withdraw' | 'done';
/** Something in the way on the ground: a tree, rock or bush (soldiers can clear them), the sea, a work of ours (they cannot), a work of the enemy (they break it as a target). x,y is a tile, or the corner of a work. */
export interface Obstacle { kind: 'tree' | 'rock' | 'bush' | 'water' | 'ours' | 'enemy' | 'wall'; x: number; y: number; label: string; clear: boolean; tribe?: string }
/** The thing a soldier is breaking down: a tree, rock or bush (x,y the tile), or a work of an enemy village (x,y its corner). */
export interface Breaking { kind: 'node' | 'prop'; x: number; y: number; tribe?: string }
/** What an arrow points at, chosen by pressing it on the enemy map: one of the village's works (x,y its corner), or a man (the chief when `leader`; x,y where the map showed him). `at` is where the head of the arrow is drawn. */
export interface MissionTarget { kind: 'prop' | 'person'; x: number; y: number; at: Pt; label: string; leader: boolean }
/** A squad that stopped because the way ahead along its arrow is shut. */
export interface Block extends Obstacle { since: number }
/** What one squad is to do in a plan. */
export interface Mission {
  squad: number; objective: Objective; route: Route; trigger: Trigger; stance: PlanStance;
  /** Share of the squad lost (0..1) at which it pulls back to the rally point. */
  withdrawAt: number;
  state: MissionState; initial: number;
  /** Attack only. Where the squad forms up, drawn on the enemy map (tile coordinates): one cell for each soldier, the way they face, and the drag (o to p) that made the shape; null until placed. */
  deploy: { cells: Pt[]; heading: number; o: Pt; p: Pt; kind?: FormationName } | null;
  /** The arrow the squad follows from where it stands, point by point; the last is where it fights. Empty: it goes for `objective`. */
  path: Pt[];
  /** Where it falls back to when `withdrawAt` is crossed; empty: the rally point. */
  retreat: Pt[];
  /** Which point of `path` (or of `retreat`, once withdrawing) it is walking to. */
  leg: number;
  /** Attack only. What the arrow points at; its head stays on it. Null: an arrow drawn free, or none, and the squad goes for `objective`. */
  target: MissionTarget | null;
  /** While `state` is 'blocked': what shuts the way. */
  block: Block | null;
  /** Defence only: where the squad stands when the alarm sounds. */
  post: 'gate' | 'fence' | 'tower' | 'reserve' | 'fire';
}
export type CardKind = 'go' | 'advance' | 'hold' | 'formation' | 'attack' | 'shoot' | 'retreat' | 'signal';
/** A command card: only the cards in the plan show as buttons once the fight is on. */
export interface Card { id: number; kind: CardKind; squad: number; arg: string }
export interface Plan {
  id: number; kind: 'attack' | 'defense'; tribe: string | null;
  missions: Mission[]; cards: Card[];
  status: 'draft' | 'running' | 'done';
  /**
   * Where a running attack is. `assemble`: the squads walk to the cells drawn for them; `ready`: they stand there and wait for the player to
   * decide to fight or fall back; `fight`: the missions are carried out; `retreat`: a fight is being broken off, each squad falling back by the way drawn for it;
   * `recall`: the army was called home before any blow, straight back to the village, and the plan goes back to a draft when they are there.
   */
  stage: 'assemble' | 'ready' | 'fight' | 'retreat' | 'recall';
  startedAt: number; signal: boolean; nextCard: number;
  rally: { x: number; y: number };
  /** Attack only. Things in the way of the arrows that a squad other than the one that walks there is sent to break down while the army forms up. */
  clears: Array<{ squad: number; x: number; y: number }>;
  /** How the attack ended, once it has: the village is laid waste, or the army was beaten or pulled back. */
  result: '' | 'won' | 'lost';
}
/**
 * What the war council tells the player before a fight, worked out from the plan alone: our squads in it against the enemy as the map describes him.
 * What it can say grows with the level of the map (1 a sketch, 2 adds his works, 3 his men by arm); how sure it is shrinks with it (`spread`).
 */
export interface Forecast {
  level: number;
  /** Chance our side wins, 0..1, and how far off it may be (plus or minus). */
  chance: number; spread: number;
  verdict: string;
  /** Why the plan cannot go out at all, or null. */
  blocked: string | null;
  warnings: string[];
  /** What may follow a victory and a defeat. */
  win: string[]; lose: string[];
  /** The report itself, line by line. */
  lines: string[];
}
/** What happened in the fight that is on (or was last): the base of the campaign log. */
export interface BattleState { on: boolean; since: number; quiet: number; ourDead: number; foeDead: number; breaches: number; shots: number; notes: string[] }

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
