import type { StatId } from './research';
/** The shapes and constants the simulation shares: villagers, their parts, and a few tables. Nothing here has behaviour. */
import { Building } from './buildings';
import { Job, MountKind, NodeKind, SoldierArm, StatKey, Stats, WorkJob } from './jobs';
import { Step } from './path';
import { Res } from './resources';
import { Recipe, ToolSet } from './tools';
import { Team } from './combat';

export type Sex = 'm' | 'f';
/** A village we took (adopted or wiped out) and what it gave for good: if it is taken back, this is what we lose. */
export interface Conquest { id: string; tier: string; pop: number; slots: number; yieldPct: number; day: number }
export type Facing = 'front' | 'back' | 'right' | 'left';
export type Phase = 'idle' | 'move' | 'goNode' | 'work' | 'goStore' | 'wait' | 'goSite' | 'build' | 'goShop' | 'craft' | 'goEquip' | 'goHome' | 'sleep' | 'goStaff' | 'inside' | 'goOrder' | 'fight' | 'flee' | 'down' | 'goCarcass' | 'skin' | 'rescue';
export interface Look { sex: Sex; skin: string; hair: string; hide: string; pants: string }
export interface Skill { xp: number; level: number }
export interface LogLine { t: number; text: string }
/** Công cụ đang hiện trong tay (để vẽ). */
export interface Hold { kind: string; tier: number; shield?: string }
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
  /** A walk the player ordered (the army falling back): nothing the unit meets stops it until it arrives. */
  obey?: boolean;
  scan: number;   // seconds until the next look for enemies
  /** The chase now (src/data/chase.json): which target, seconds since a blow was last thrown at it, seconds it has been out of sight. */
  chaseKey?: string; chaseT?: number; unseenT?: number;
  /** Seconds he has found no way to his target (a wall of the enemy village in between): a soldier at range breaks it down after a while (siege.breachFor). */
  blockedT?: number;
  /** A target given up: not picked again until the time is up. */
  skip?: { kind: 'unit' | 'animal'; id: number; until: number };
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
  /** A visitor sent to the gate (encounters.ts): the id of the visit. A guest is no enemy: the brain of the tribe leaves him alone and nobody picks him as a target on his own (a direct order of the player still reaches him). */
  guest?: number;
  /** What he is busy with besides strolling (src/sim/tribework.ts): gathering at a node, hunting, patrolling or scouting. */
  life?: { kind: 'gather' | 'hunt' | 'patrol' | 'scout'; idx?: number; job?: string; state?: 'go' | 'work'; units?: number; id?: number; stops?: Array<[number, number]>; i?: number; t?: number };
  /** Seconds a raider has been unable to get at what he is after (a fence in the way). */
  stuck?: number;
  /** A target he could not get to (he only paced before it): left alone until this time. */
  skip?: { id: number; until: number };
  /** The fence or gate he has decided to break down (building id), 0 for none. */
  siege?: number;
  /** A band sent to harass an army on the march (warharass.ts): the game time it was sent. */
  harass?: number;
  /** Where a guard stands his watch (tribelod.ts) and which way he looks (away from the fire). */
  post?: { x: number; y: number; face: Facing };
  /** One of the army of the village: it lives indoors like ours and comes out to the posts of the defence only in a war or when the village is attacked (tribelod.deployArmy). A guard (no `army`) keeps his watch always. */
  army?: boolean;
  /** The tower (its corner in the village) whose archer he is: he stands up in it and looses arrows within its reach (tribes.foeBrain). */
  tower?: { x: number; y: number };
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
  /** A miner of the Mỏ: the ores he may work, chosen by the player (undefined: every one). */
  ores?: Res[];
  job: Job;
  /** The arm of a soldier (job 'fight'): chosen by the camp that took him on. */
  arm: SoldierArm;
  /** The rank of a soldier of a camp (ranks.json, 1 to 6): his strength, his food and the weapon he carries follow it. 1 for everyone else. */
  rank: number;
  phase: Phase;
  slot: number;     // chỗ đứng đã giữ bên cạnh nguồn: 1 = trái, 2 = phải, 0 = chưa giữ
  target: number;   // chỉ số ô nguồn hoặc id công trình đang nhắm
  post: number;     // id Ruộng mà người chơi giao cho làm (nghề Hái lượm); -1 nếu không
  prefer: number;   // mục tiêu người chơi chỉ định (-1 nếu không)
  progress: number;
  timer: number;
  order: string | null; // đơn chế tác đang làm
  carry: { res: Res; amount: number } | null;
  /** A supply soldier on a war: the goods of the army he carries (food, and later the wood and hide for tents). Lost with him if he falls. */
  pack?: { food: number; wood: number; hide: number };
  /** Out of sight without a house: a supply soldier asleep in a field tent of the war, or a villager with no bed while a war is on. */
  inTent?: boolean;
  /** A supply soldier who has fallen behind the army: he hurries to catch up (set by `warsupply.follow`). */
  hurry?: boolean;
  health: number;
  anim: string;
  hold: Hold | null;
  bad: Map<number, number>; // nguồn không tới được -> hết hạn
  team: Team;
  maxHealth: number;
  weapon: string | null;  // crafted weapon id (club, spear, mace); null = fists
  armor: string | null;   // armour id (hide)
  stance: Stance;
  fight: FightState;
  queue: OrderStep[];
  atkCd: number;          // seconds until the next blow
  down: number;           // seconds left lying wounded (0 = on feet)
  rescue: number;         // seconds an ally has been tending this wounded unit
  /** A soldier lent by a village that stands by us for the length of one war (tribes.summonAllies): he goes when it is over (`leaving`), out of the camera's sight, and is no more. */
  ally?: { tribe: string; leaving: boolean; since: number };
  fleeT: number;          // seconds left running away
  calm: number;           // seconds since the last threat was near
  loot: number;           // carcass id being skinned (-1 none)
  leader: boolean;        // best fighter of a group of 5+
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
  /** Building the villager is working inside (research or crafting house); null when out on the map. */
  inside: number | null;
  /** Seconds until the villager may go and place another order for a tool. */
  orderCd: number;
  /** Wear of the weapon and the armour in hand: which piece it was counted for, hits left, and whether it is broken (useless until mended). */
  /** The squad (đội) this soldier belongs to, -1 for none. */
  squad: number;
  /** The beast he rides, given from the stable (null for none). The riders of the Trại lính kỵ ride the beast of their camp without one: see `sim.mountOf`. */
  mount: MountKind | null;
  /** A soldier of the Trại lính gác: he keeps a post of his own (`guardAt`) and comes back to it after each fight. */
  guard: boolean;
  /** A soldier of a camp the player called out by hand: he stays out of his camp (night too) until he is sent back. */
  out?: boolean;
  /** A guard the player has called into the Trại lính gác (he sleeps there instead of standing at his post) until he is called out again. */
  housed?: boolean;
  /** Ordered home by the player ("Cho quân về"): he drops the fight he is in and goes to his camp, and takes up nothing else on the way. */
  recall?: boolean;
  guardAt: { x: number; y: number } | null;
  /** The gate (building id) he is a guard of: he stands just inside it, opens and shuts it, and goes out to stop strangers who come to it (defense.ts, encounters.ts). */
  gate?: number;
  /** Stars (1 to 5) and the personal factor of each of the eight stats (data/stats.json); absent in a save from before, which counts as all 1. */
  stars: number;
  fac: Record<StatId, number>;
  /** Seconds until the stats are brought in line with research again. */
  statClock: number;
  /** The stats this body was born with: training can lower a stat only so far below them. */
  born: Stats;
  /** Away at training in the house of his role: which house, which stat, seconds left and in all, how careful (index of TRAINING.care) and the ceiling. Null when he is not. */
  train: { house: number; stat: StatKey; left: number; total: number; care: number; cap: number } | null;
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
  /** The way in: the road a walker really takes from our fire to the edge of the yard, the part of it inside the box, as points (empty when none is found). */
  route: Array<{ x: number; y: number }>;
  /** Other villages whose ground reaches this map, ours too: only a name and how far their ground goes. */
  others: Array<{ name: string; x: number; y: number; r: number; ours: boolean }>;
  /** About how many people live there (rounded). */
  population: number;
  structures: Array<{ kind: string; label: string; detail: string; x: number; y: number; w: number; h: number }>;
  people: Array<{ x: number; y: number; mark: IntelMark; leader: boolean; weapon: string | null }>;
  /** Soldiers by arm, level 3 only. */
  soldiers: { foot: number; archer: number; cavalry: number } | null;
}
/** `sent` is how many set out (older saves lack it). */
/** A scout who died on a trip: who, where, why, and (when he was caught) the odds that were against him. */
export interface ScoutLoss { at: number; day: number; vid: number; name: string; tribe: string; dist: number; cause: string; detail: string }
export interface ScoutMission {
  id: number; tribe: string; level: number; ids: number[]; phase: 'go' | 'watch' | 'back'; t: number; need: number; survivors: number; sent?: number; seen?: Seen[];
  /** How much of the map is drawn (0..1): it grows while scouts are at the village, and is theirs to carry home. */
  progress?: number;
  /** The scouts who have been through the risk of being caught on arriving. */
  rolled?: number[];
  /** Called back by the player before the map was finished. */
  recall?: boolean;
  /** Seconds until the scouts are looked over for one who has stopped on the way. */
  nudge?: number;
}
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
export interface Breaking { kind: 'node' | 'prop'; x: number; y: number; tribe?: string; /** the player gave this order: an enemy near does not turn him from it */ ordered?: boolean; /** the ordered target he returns to once the wall in his way is down */ then?: Breaking }
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
  /** Set once the player gave this squad an order (action, start, withdrawal): a squad with orders but no arrow goes for `objective` instead of holding. */
  ordered?: boolean;
  /** War only: the squad has stopped to rest (the Nghỉ ngơi dã chiến research): it pitches its tent day or night and sleeps there until the player sends it on. */
  resting?: boolean;
  /** The resting squad has been told it is rested (said once). */
  rested?: boolean;
  /** When an enemy was last near the resting squad (a raid on its camp). */
  alertAt?: number;
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
/** Soldiers counted by arm. */
export interface ArmCount { foot: number; archer: number; cavalry: number }
/** What a war has cost and brought so far (warlog.ts), kept in its plan until the war is over. */
export interface WarStats {
  startDay: number; fought: boolean;
  sent: ArmCount; dead: ArmCount; supplySent: number; supplyDead: number;
  /** Enemies we killed, and the words of the war (what happened, in order). */
  foeDead: number; notes: string[];
  /** The goods the supply soldiers set out with and brought back (food, wood and hide for the tents). */
  loaded: { food: number; wood: number; hide: number }; returned: { food: number; wood: number; hide: number };
  loot: Partial<Record<Res, number>>;
}
/** One war in the log of the war council: the map fought, who went and how many fell, what was taken and what was spent. */
export interface WarRecord {
  id: number; tribe: string; name: string; mapLevel: number; startDay: number; endDay: number; days: number;
  result: 'won' | 'lost' | 'off'; squads: number;
  sent: ArmCount; dead: ArmCount; supplySent: number; supplyDead: number; foeDead: number; notes: string[]; sample?: boolean;
  spent: { food: number; wood: number; hide: number }; loot: Partial<Record<Res, number>>;
}
export interface Plan {
  id: number; kind: 'attack' | 'defense'; tribe: string | null;
  /** Made by the simple "Đánh" of the Lều họp chiến (the stone age): the whole army, one squad of each arm, straight at the village. */
  quick?: boolean;
  /** Made by the player's own orders on soldiers (warskirmish.ts): a war with no squads or arrows. Only these soldiers take part, with no march rules (no hunger, tiredness, slow or tents). `idleSince`: the last time one of them was fighting or under an attack order. */
  skirmish?: { ids: number[]; idleSince: number };
  missions: Mission[]; cards: Card[];
  status: 'draft' | 'running' | 'done';
  /** When the order to pull out was given (a retreat or a recall): from it the grace of data/war.json "retreat" counts. */
  withdrawnAt?: number;
  /**
   * Where a running attack is. `assemble`: the squads walk to the cells drawn for them; `ready`: they stand there and wait for the player to
   * decide to fight or fall back; `fight`: the missions are carried out; `retreat`: a fight is being broken off, each squad falling back by the way drawn for it;
   * `recall`: the army was called home before any blow, straight back to the village, and the plan goes back to a draft when they are there.
   */
  stage: 'assemble' | 'ready' | 'fight' | 'retreat' | 'recall' | 'over';
  startedAt: number; signal: boolean; nextCard: number;
  rally: { x: number; y: number };
  /** Attack only. Things in the way of the arrows that a squad other than the one that walks there is sent to break down while the army forms up. */
  clears: Array<{ squad: number; x: number; y: number }>;
  /** How the attack ended, once it has: the village is laid waste, or the army was beaten or pulled back. */
  result: '' | 'won' | 'lost';
  /** When the war was decided (game seconds), 0 until it is. A won war stays `over` (the army where it stands) until the player gives the word to pull out. */
  endedAt: number;
  /** Attack only. Supply soldiers (lính hậu cần) to take from the Trại hậu cần, and how many days of food they carry for the army. */
  supply: number; carryDays: number;
  /** The supply soldiers on the march (set when the plan is deployed, emptied when the war ends). */
  supplyIds: number[];
  /** Counted while the war is on; null before it. */
  stats: WarStats | null;
  /** The tents of the war, one for each squad that has pitched one (wartent.ts); x, y in tiles. */
  tents: Array<{ squad: number; x: number; y: number; progress: number; built: boolean }>;
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
  /** Our side against the enemy, row by row (`theirs` null: not known from the map), and a few plain facts of the march: label and value. */
  compare: Array<{ label: string; ours: number; theirs: number | null }>;
  facts: Array<[string, string]>;
}
/** What happened in the fight that is on (or was last): the base of the campaign log. */
/** The fight that is on at the village (raiders, or a pack of beasts), in numbers; it becomes a `BattleRecord` when it is over. */
export interface BattleState {
  on: boolean; since: number; quiet: number; ourDead: number; foeDead: number; breaches: number; shots: number; notes: string[];
  /** 'raid': a village attacks; 'beasts': a pack. `name`: who. `peak`: the most enemies on the field at once. */
  kind: 'raid' | 'beasts'; name: string; startDay: number; night: boolean; peak: number;
  ourDeadArm: ArmCount; civDead: number; dmgDealt: number; dmgTaken: number;
}
/** One fight at the village in the log of the Lều họp chiến (the defence: a raid or a pack of beasts). The attacks we make are `WarRecord`s. */
export interface BattleRecord {
  id: number; kind: 'defense' | 'beasts'; name: string; startDay: number; endDay: number; night: boolean; minutes: number; peak: number;
  ourDead: number; foeDead: number; ourDeadArm: ArmCount; civDead: number; breaches: number; shots: number; dmgDealt: number; dmgTaken: number; notes: string[];
  /** Made by the dev menu to look at the log: it can be cleared again. */
  sample?: boolean;
}

export const HAIR = ['#4a2e1a', '#2b1b10', '#6b3f1d', '#c98a3a', '#7a5a3a'];
export const SKIN = ['#d9a371', '#e8c4a0', '#c58a5c', '#b87850'];
export const NODE_JOB: Record<NodeKind, WorkJob> = { tree: 'wood', rock: 'stone', bush: 'food', ore: 'mine' };
export const STAT_KEYS = ['vit', 'str', 'agi', 'sta'] as const;
export const XP_MULT = [0, 1, 1.5, 2];
/** Khoảng cách ngang (ô) từ tâm vật thể tới chỗ dân đứng khi làm. */
export const REACH: Record<NodeKind, number> = { tree: 0.55, rock: 0.62, bush: 0.5, ore: 0.62 };
export const LEFT = 1, RIGHT = 2;

export interface PlaceResult { ok: boolean; reason?: string; building?: Building }

/** A heads-up for the player about something coming (or going on) in the village, worked out afresh from the state of the game: it is not saved. */
export interface Notice {
  /** Stable for the same matter (not for its level), so the screen can tell which ones the player has seen. */
  id: string;
  level: 'info' | 'warn' | 'urgent';
  /** The picture: the key of a resource icon ('food'), or a single character. */
  icon: string;
  /** A few words. */
  title: string;
  /** When: "cuối ngày", "còn 3 ngày"… */
  when: string;
  /** One short line with the numbers. */
  body: string;
  /** The longer reason and what to do about it, shown as a tip. */
  tip: string;
  /** A building to go to for it (the screen opens it), with the word for the button. */
  action?: { building: string; label: string };
  /** A command the notice carries as a button: the screen runs it. */
  command?: { kind: 'withdraw'; label: string } | { kind: 'meet'; label: string; id: number };
  /** Where the camera goes for this notice (tiles), with the command above. */
  focus?: { x: number; y: number };
  /** The people the notice is about: the screen can open their details so the player can change what they do. */
  people?: number[];
}

// ---------------------------------------------------------------- the march of the medieval age (legion.ts)
/** A military zone drawn at the Bãi tập: a square of ground cleared of resources and animals, where nothing grows back and nothing may be built. */
export interface MilZone { id: number; x: number; y: number; w: number; h: number }
/** A square of the zone where one arm of the army stands (x, y: its top-left tile). */
export interface MilCell { id: number; zone: number; x: number; y: number; arm: 'foot' | 'archer' | 'cavalry' }
/**
 * The army gathered from the cells, marching as one block. Each soldier keeps his place (`slots`: offset from the centre) and the block never turns; `theta` is only the way the soldiers face
 * (`theta0` is unused, kept for old saves). The centre walks the `path` at `speed`, the median of the speeds of the soldiers.
 */
export interface Legion {
  on: boolean; assembling: boolean; since: number; clock: number;
  cx: number; cy: number; theta: number; theta0: number; speed: number;
  path: Array<[number, number]>;
  slots: Record<string, { dx: number; dy: number }>;
}
