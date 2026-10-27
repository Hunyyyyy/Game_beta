import { DayPart, dayPart, isRestTime, lightAt, rollWeather, Season, seasonOf, SEASON_DEF, WEATHER, WeatherKind } from './calendar';
import { DAY_LENGTH, FIRE_VISION, NIGHT_VISION, START_TIME, TICK, VISION } from './constants';
import { Building, BuildingKind, BUILDINGS, Era, holdsGoods, levelDef, levelsOf, maxLevel, needsWork } from './buildings';
import { Fog } from './fog';
import { isStaffJob, Job, JOBS, JOB_NAME, MAX_LEVEL, NodeKind, STAFF_BUILDING, Stats, WorkJob, WORK_JOBS, XP_LEVELS } from './jobs';
import { findPath, Step } from './path';
import { BARTER, CARRY_CAP, CURRENCY, emptyStock, FOOD_NUTRITION, FOOD_SPOIL_DAYS, Res, RES_NAME, Stock } from './resources';
import { mulberry32 } from './rng';
import { emptyToolSet, isGear, Recipe, RECIPE_BY_ID, recipeName, TIER_DURABILITY, TIER_NAME, TIER_SPEED, TIER_YIELD, Tool, ToolKind, ToolSet, TOOL_NAME, TOOL_OF_JOB } from './tools';
import { ARMORS, CRAFTED_WEAPONS, maxHpOf, MORALE, Team, TribeId, WEAPONS } from './combat';
import { bestWeapon, brainPlayer, hurt, isFighter, resolve, tickCommon, tickDown, tickMorale, tickProjectiles, weaponOf } from './battle';
import { Animal, animalDef, breed, populate, tickAnimals } from './fauna';
import { adoptTribe, EventState, giftTribe, killFoe, spawnTribes, tickFoe, tickTribes, Tribe, tribeAttacked, tribeHostile, tributeTribe } from './tribes';
import { autoOn, buildingOpen, levelCap, recipeNeedLevel, recipeOpen, RESEARCH, Tech, TECH_BY_ID, techForBuilding, techForLevel, techForRecipe } from './research';
import { World } from './world';

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
interface Slide { x: number; y: number; face: 'left' | 'right' }

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
  /** Ordered by the player during rest hours: stays awake until morning. */
  nightOwl: boolean;
  /** Gear was handed out by the player: the stores no longer swap it automatically. */
  manualGear: boolean;
  /** Building the villager is working inside (research, crafting or repair house); null when out on the map. */
  inside: number | null;
  /** Seconds until the villager may go and place another order for a tool. */
  orderCd: number;
}

const NAMES_M = ['Bo', 'Rô', 'Gia', 'Mun', 'Lô', 'Tù', 'Đa'];
const NAMES_F = ['Tia', 'Noa', 'Ma', 'Pa', 'Kê', 'Ly', 'Sa'];
const HAIR = ['#4a2e1a', '#2b1b10', '#6b3f1d', '#c98a3a', '#7a5a3a'];
const SKIN = ['#d9a371', '#e8c4a0', '#c58a5c', '#b87850'];
const NODE_JOB: Record<NodeKind, WorkJob> = { tree: 'wood', rock: 'stone', bush: 'food' };
const STAT_KEYS = ['vit', 'str', 'agi', 'int', 'sta'] as const;
const XP_MULT = [0, 1, 1.5, 2];
/** Khoảng cách ngang (ô) từ tâm vật thể tới chỗ dân đứng khi làm. */
const REACH: Record<NodeKind, number> = { tree: 0.55, rock: 0.62, bush: 0.5 };
const LEFT = 1, RIGHT = 2;

export interface PlaceResult { ok: boolean; reason?: string; building?: Building }

export class Sim {
  readonly world: World;
  readonly fog: Fog;
  readonly villagers: Villager[] = [];
  readonly buildings: Building[] = [];
  readonly stock: Stock = emptyStock();
  /** Công cụ đã chế, đang chờ dân tới Xưởng lấy. Khóa dạng "axe1". */
  readonly toolStock: Record<string, number> = {};
  /** Hàng đợi chế tác (mã công thức). */
  readonly craftQueue: string[] = [];
  /** Research (tech ids) waiting for a free researcher in the Nhà nghiên cứu. */
  readonly researchQueue: string[] = [];
  /** Tools waiting to be mended in the Nhà sửa chữa (recipe ids such as axe1). */
  readonly repairQueue: string[] = [];
  private coinFrac = 0;
  private sawCoin = false;
  /** Finished research (tech ids). Recipes and building levels stay locked until their tech is here. */
  readonly researched = new Set<string>();
  readonly log: LogLine[] = [];
  /** Current era: new buildings are built with this era's art and levels. */
  era: Era = 'stone';
  /** Hệ số tốc độ: 0 = tạm dừng. */
  speed = 1;
  /** Giây game đã trôi qua. */
  time = START_TIME;
  /** Player villagers and tribal people, by id. */
  private readonly byId = new Map<number, Villager>();
  /** Tribal people (enemies, neutrals, tributaries); they share the Villager body but never work. */
  readonly foes: Villager[] = [];
  readonly tribes: Tribe[] = [];
  /** Scheduled wolf packs and tribal raids. */
  readonly events: EventState[] = [];
  nextRaid = 0;
  readonly animals: Animal[] = [];
  readonly animalById = new Map<number, Animal>();
  readonly projectiles: Projectile[] = [];
  nextAid = 1;
  /** Test switches driven by the dev menu; all off in a normal game. */
  readonly dev = { freeBuild: false, instantBuild: false, god: false, noHunger: false, fastWorks: false };
  /** A tribe that has just surrendered and waits for the player to choose: adopt or tribute. */
  pendingTribe: TribeId | null = null;
  /** Called when something dies (UI refresh hook). */
  onKill?: () => void;
  /** Random stream for animals, tribes and events, so adding them never changes villager stats. */
  readonly frnd: () => number;
  private acc = 0;
  private fogDirty = true;
  private nextVid = 1;
  private nextBid = 1;
  private readonly rnd: () => number;
  private moraleClock = 0;
  private lastFullWarn = -999;
  private lastMatWarn = -999;
  /** Today's and tomorrow's weather (tomorrow is rolled ahead so it can be foretold). */
  weather: WeatherKind = 'clear';
  nextWeather: WeatherKind = 'clear';
  private readonly wrnd: () => number;
  private lastDay = 1;
  private signalled = false;
  private resting = false;
  private lastVision = -1;
  /** Stored food split into lots, oldest eaten first; each lot has an expiry time. */
  private readonly foodLots: Array<{ amount: number; exp: number }> = [];

  constructor(readonly seed = 1337) {
    this.world = new World(seed);
    this.fog = new Fog(this.world);
    this.rnd = mulberry32(seed ^ 0x9e3779b9);
    this.frnd = mulberry32(seed ^ 0x7f4a7c15);
    this.wrnd = mulberry32(seed ^ 0x5bd1e995);
    RES_NAME.coin = CURRENCY[this.era];
    this.world.setSeason(this.season);
    this.nextWeather = rollWeather(seasonOf(this.day + 1), this.wrnd());
    this.resting = isRestTime(this.tod, this.season);
    const s = this.world.start;
    this.addBuilding('campfire', s.x - 1, s.y - 2, true);
    this.stock.food = 24;
    const spots: Array<[number, number, Sex]> = [[-1, 1, 'm'], [1, 1, 'f'], [0, 2, 'm']];
    for (const [dx, dy, sex] of spots) this.spawn(s.x + dx, s.y + dy, sex);
    this.say('Ba người đầu tiên đã đến bên đống lửa. Chọn họ, rồi giao việc: chuột phải lên cây, đá hay bụi quả. Về sau: Nhà nghiên cứu vẽ bản vẽ, Nhà chế tạo làm công cụ, Nhà sửa chữa giữ chúng bền.');
    this.refreshFog();
    populate(this);
    spawnTribes(this);
  }

  // ---------------------------------------------------------------- tiện ích
  get day(): number { return Math.floor(this.time / DAY_LENGTH) + 1; }
  /** 0..1 trong ngày: 0 = nửa đêm trước bình minh, 0.5 = giữa trưa. */
  get tod(): number { return (this.time % DAY_LENGTH) / DAY_LENGTH; }
  get season(): Season { return seasonOf(this.day); }
  /** Light 0..1 from time of day and the season's day length. */
  get light(): number { return lightAt(this.tod, this.season); }
  /** Độ tối ban đêm 0..1 (dùng để phủ màu). */
  get darkness(): number { return 1 - this.light; }
  get part(): DayPart { return dayPart(this.tod, this.season); }
  /** Rest hours: mid-dusk to mid-dawn. */
  get restTime(): boolean { return this.resting; }
  /** Villager sight: 7 tiles by day, 3 at night, minus the weather penalty. */
  visionRadius(): number {
    return Math.max(1, Math.round(NIGHT_VISION + (VISION - NIGHT_VISION) * this.light) - WEATHER[this.weather].vision);
  }
  fireRadius(): number { return Math.max(1, FIRE_VISION - WEATHER[this.weather].vision); }
  /** Stored food that will spoil within the next `secs` seconds. */
  foodSpoilingWithin(secs: number): number {
    let n = 0;
    for (const l of this.foodLots) if (l.exp <= this.time + secs) n += l.amount;
    return Math.min(n, this.stock.food);
  }
  get(id: number): Villager | undefined { return this.byId.get(id); }
  say(text: string): void { this.log.push({ t: this.time, text }); if (this.log.length > 40) this.log.shift(); }

  capacity(_res?: Res): number {
    let c = 0;
    for (const b of this.buildings) if (b.done && holdsGoods(b)) c += levelDef(b).cap;
    return c;
  }
  buildingAt(x: number, y: number): Building | undefined {
    return this.buildings.find((b) => {
      const d = BUILDINGS[b.kind];
      return x >= b.x && x < b.x + d.w && y >= b.y && y < b.y + d.h;
    });
  }
  getBuilding(id: number): Building | undefined { return this.buildings.find((b) => b.id === id); }
  /** The finished building of a kind (there is only ever one of each). */
  building(kind: BuildingKind): Building | undefined { return this.buildings.find((b) => b.kind === kind && b.done); }
  hasWorkshop(): boolean { return !!this.building('workshop'); }
  toolCount(kind: string, tier: number): number { return this.toolStock[`${kind}${tier}`] ?? 0; }
  /** Bậc công cụ dân đang dùng cho nghề này (0 = tay không). */
  toolTier(v: Villager, job: Job): number {
    const k = job === 'idle' ? undefined : TOOL_OF_JOB[job];
    const t = k ? v.tools[k] : null;
    return t && t.dur > 0 ? t.tier : 0; // a broken tool works like bare hands
  }

  private freshName(sex: Sex, rnd: () => number): string {
    const pool = (sex === 'm' ? NAMES_M : NAMES_F).filter((n) => !this.villagers.some((v) => v.name === n));
    const list = pool.length ? pool : sex === 'm' ? NAMES_M : NAMES_F;
    return list[Math.floor(rnd() * list.length)];
  }

  private spawn(x: number, y: number, sex: Sex): Villager {
    const v = this.makeVillager(x, y, sex, 'player');
    this.villagers.push(v); this.byId.set(v.id, v);
    return v;
  }

  /** Build a unit without registering it: player villagers and tribal people share the same body. */
  makeVillager(x: number, y: number, sex: Sex, team: Team, rnd: () => number = this.rnd): Villager {
    const r = rnd, pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    const stats = {} as Stats;
    for (const k of STAT_KEYS) stats[k] = 3 + Math.floor(r() * 8);
    const potential = {} as Record<WorkJob, number>, skill = {} as Record<WorkJob, Skill>;
    for (const j of WORK_JOBS) {
      // hunting and fighting come from the body, not from a random draw, so earlier random streams stay the same
      if (j === 'hunt' || j === 'fight' || j === 'research') { const k = j === 'hunt' ? stats.agi : j === 'research' ? stats.int : stats.str; potential[j] = k >= 9 ? 3 : k >= 6 ? 2 : 1; skill[j] = { xp: 0, level: 0 }; continue; }
      const p = r(); potential[j] = p < 0.45 ? 1 : p < 0.85 ? 2 : 3; skill[j] = { xp: 0, level: 0 };
    }
    return {
      id: this.nextVid++, name: this.freshName(sex, rnd),
      look: { sex, skin: pick(SKIN), hair: pick(HAIR), hide: '#8b6a45', pants: '#3f63a8' },
      x: x + 0.5, y: y + 0.5, path: [], slide: null, facing: 'front', speed: 1.6 + 0.1 * stats.agi, animClock: 0, tx: -1, ty: -1,
      stats, potential, skill, tools: emptyToolSet(), job: 'idle', phase: 'idle', slot: 0, target: -1, prefer: -1, progress: 0, frac: 0, timer: 0, order: null,
      carry: null, fullness: 100, health: maxHpOf(stats.vit), starving: false, anim: 'idle', hold: null, bad: new Map(), bed: -1, nightOwl: false, manualGear: false, inside: null, orderCd: 0,
      team, maxHealth: maxHpOf(stats.vit), weapon: null, armor: null, morale: MORALE.start, stance: 'aggressive',
      fight: { mode: 'none', target: null, dest: null, anchor: null, repath: 0, scan: 0 }, queue: [], atkCd: 0, down: 0, rescue: 0, fleeT: 0, calm: 99, loot: -1, leader: false, swing: null, flinch: 0, ai: null,
    };
  }

  // ---------------------------------------------------------------- công trình
  private addBuilding(kind: BuildingKind, x: number, y: number, done: boolean): Building {
    const d = BUILDINGS[kind];
    const b: Building = { id: this.nextBid++, kind, era: this.era, x, y, level: 1, progress: done ? 1 : 0, done, upgrading: false, rebuild: false, staff: [], active: null, workers: 0 };
    this.buildings.push(b);
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) this.world.occ[(y + j) * this.world.size + x + i] = 1;
    return b;
  }

  /** Why the footprint of `kind` at (x, y) is unusable, or null. `ignore` is a building that is being moved and may overlap itself. */
  private footprintError(kind: BuildingKind, x: number, y: number, ignore?: Building): string | null {
    const d = BUILDINGS[kind], w = this.world, N = w.size;
    const own = (tx: number, ty: number) => !!ignore && tx >= ignore.x && tx < ignore.x + d.w && ty >= ignore.y && ty < ignore.y + d.h;
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
      const tx = x + i, ty = y + j;
      if (!w.inBounds(tx, ty)) return 'Ngoài bản đồ';
      const k = ty * N + tx;
      if (this.fog.state[k] === 0) return 'Chưa khám phá';
      const t = w.tiles[k];
      if ((t !== 0 && t !== 4) || (w.occ[k] && !own(tx, ty))) return 'Vướng cây, đá, nước hoặc công trình';
    }
    return null;
  }

  /** Why a kind of building cannot be built at all right now: one per game, and some need research first. */
  buildingLock(kind: BuildingKind): string | null {
    if (this.buildings.some((b) => b.kind === kind)) return 'Mỗi công trình chỉ xây được một cái, hãy nâng cấp nó';
    if (!this.dev.freeBuild && !buildingOpen(this.researched, kind)) return `Cần nghiên cứu: ${techForBuilding(kind)?.name ?? '?'}`;
    return null;
  }

  /** Trả về lý do không đặt được, hoặc null nếu đặt được. */
  canPlace(kind: BuildingKind, x: number, y: number): string | null {
    return this.footprintError(kind, x, y) ?? this.buildingLock(kind) ?? (this.dev.freeBuild ? null : this.missing(levelsOf(kind, this.era)[0].cost));
  }

  /** Reason the stock cannot pay `cost`, or null. */
  private missing(cost: Partial<Stock>): string | null {
    for (const r of Object.keys(cost) as Res[]) if (this.stock[r] < (cost[r] ?? 0)) return `Thiếu ${RES_NAME[r].toLowerCase()} (cần ${cost[r]})`;
    return null;
  }

  /** Reason the building cannot be upgraded now, or null. */
  canUpgrade(b: Building): string | null {
    if (!b.done) return 'Công trình chưa dựng xong';
    if (b.upgrading) return 'Đang nâng cấp';
    if (b.level >= maxLevel(b.kind, b.era)) return 'Đã ở cấp cao nhất';
    if (b.level + 1 > levelCap(this.researched, b.kind)) return `Cần nghiên cứu: ${techForLevel(b.kind, b.level + 1)?.name ?? '?'}`;
    return this.dev.freeBuild ? null : this.missing(levelDef(b, b.level + 1).cost);
  }

  /** Pay for the next level; builders then work on it while the building keeps its current level. */
  upgradeBuilding(id: number): string | null {
    const b = this.getBuilding(id);
    if (!b) return 'Không tìm thấy công trình';
    const why = this.canUpgrade(b);
    if (why) return why;
    const next = levelDef(b, b.level + 1);
    if (!this.dev.freeBuild) for (const r of Object.keys(next.cost) as Res[]) this.stock[r] -= next.cost[r] ?? 0;
    if (this.dev.instantBuild) { b.level++; this.say(`${BUILDINGS[b.kind].name} lên cấp ${b.level} ngay (dev).`); return null; }
    b.upgrading = true; b.progress = 0;
    this.say(`Bắt đầu nâng ${BUILDINGS[b.kind].name} lên cấp ${b.level + 1} (${next.name.toLowerCase()}). Giao việc "Thợ xây" để làm.`);
    return null;
  }

  placeBuilding(kind: BuildingKind, x: number, y: number): PlaceResult {
    const d = BUILDINGS[kind];
    if (!d.buildable) return { ok: false, reason: 'Không xây được công trình này' };
    const why = this.canPlace(kind, x, y);
    if (why) return { ok: false, reason: why };
    const cost = levelsOf(kind, this.era)[0].cost;
    if (!this.dev.freeBuild) for (const r of Object.keys(cost) as Res[]) this.stock[r] -= cost[r] ?? 0;
    const b = this.addBuilding(kind, x, y, false);
    if (this.dev.instantBuild) { b.progress = 1; b.done = true; this.fogDirty = true; this.say(`${d.name} đã dựng xong ngay (dev).`); return { ok: true, building: b }; }
    this.say(`Đã đặt nền ${d.name}. Giao việc "Thợ xây" để dựng.`);
    return { ok: true, building: b };
  }

  // ---------------------------------------------------------------- demolish and move
  /** Materials paid so far for a building: every level reached, plus a running upgrade. */
  invested(b: Building): Partial<Stock> {
    const out: Partial<Stock> = {};
    const add = (c: Partial<Stock>) => { for (const r of Object.keys(c) as Res[]) out[r] = (out[r] ?? 0) + (c[r] ?? 0); };
    for (let l = 1; l <= b.level; l++) add(levelDef(b, l).cost);
    if (b.upgrading) add(levelDef(b, b.level + 1).cost);
    return out;
  }
  /** What tearing a building down gives back: half of what was paid (nothing in free-build mode). */
  salvage(b: Building): Partial<Stock> {
    const out: Partial<Stock> = {}, paid = this.invested(b);
    if (!this.dev.freeBuild) for (const r of Object.keys(paid) as Res[]) { const n = Math.floor((paid[r] ?? 0) * 0.5); if (n > 0) out[r] = n; }
    return out;
  }
  /** What moving a finished building costs: a fifth of what was paid. An unfinished one moves for free. */
  moveFee(b: Building): Partial<Stock> {
    const out: Partial<Stock> = {};
    if (!b.done || this.dev.freeBuild) return out;
    const paid = this.invested(b);
    for (const r of Object.keys(paid) as Res[]) { const n = Math.ceil((paid[r] ?? 0) * 0.2); if (n > 0) out[r] = n; }
    return out;
  }

  /** Send everyone who was heading for or working at this building back to idle; an order in progress is refunded. */
  private evict(b: Building): void {
    for (const id of [...b.staff]) { const v = this.byId.get(id); if (v) { this.exitBuilding(v); v.job = 'idle'; } }
    b.staff = [];
    if (b.active && (b.kind === 'lab' || b.kind === 'workshop')) { const d = this.orderDef(b.kind === 'lab' ? 'research' : 'craft', b.active.id); if (d) this.pay(d.cost, 1); }
    b.active = null;
    for (const v of this.villagers) {
      if (v.target !== b.id) continue;
      if (v.phase === 'goSite' || v.phase === 'build' || v.phase === 'goEquip' || v.phase === 'goStaff' || v.phase === 'goOrder') { if (isStaffJob(v.job)) v.job = 'idle'; this.resetTask(v); }
    }
  }
  private setOcc(b: Building, val: number): void {
    const d = BUILDINGS[b.kind];
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) this.world.occ[(b.y + j) * this.world.size + b.x + i] = val;
  }

  canDemolish(b: Building): string | null { return BUILDINGS[b.kind].buildable ? null : 'Không phá được công trình này'; }
  demolishBuilding(id: number): string | null {
    const b = this.getBuilding(id);
    if (!b) return 'Không tìm thấy công trình';
    const why = this.canDemolish(b);
    if (why) return why;
    const back = this.salvage(b);
    this.evict(b);
    this.setOcc(b, 0);
    this.buildings.splice(this.buildings.indexOf(b), 1);
    for (const r of Object.keys(back) as Res[]) this.stock[r] += back[r] ?? 0;
    this.fogDirty = true;
    this.say(`Đã phá ${BUILDINGS[b.kind].name.toLowerCase()}${Object.keys(back).length ? `, thu lại ${Object.keys(back).map((r) => `${back[r as Res]} ${RES_NAME[r as Res].toLowerCase()}`).join(', ')}` : ''}.`);
    return null;
  }

  /** Why the building cannot go to (x, y), or null. */
  canMove(b: Building, x: number, y: number): string | null {
    if (!BUILDINGS[b.kind].buildable) return 'Không dời được công trình này';
    if (x === b.x && y === b.y) return 'Vẫn ở chỗ cũ';
    return this.footprintError(b.kind, x, y, b) ?? this.missing(this.moveFee(b));
  }
  /** Take a building apart and put it up again elsewhere: it keeps its level, pays the fee and must be rebuilt (half the time). */
  moveBuilding(id: number, x: number, y: number): string | null {
    const b = this.getBuilding(id);
    if (!b) return 'Không tìm thấy công trình';
    const why = this.canMove(b, x, y);
    if (why) return why;
    const fee = this.moveFee(b);
    for (const r of Object.keys(fee) as Res[]) this.stock[r] -= fee[r] ?? 0;
    this.evict(b);
    if (b.upgrading) { for (const r of Object.keys(levelDef(b, b.level + 1).cost) as Res[]) if (!this.dev.freeBuild) this.stock[r] += levelDef(b, b.level + 1).cost[r] ?? 0; b.upgrading = false; }
    const wasDone = b.done;
    this.setOcc(b, 0); b.x = x; b.y = y; this.setOcc(b, 1);
    if (wasDone && !this.dev.instantBuild) { b.done = false; b.progress = 0; b.rebuild = true; }
    this.fogDirty = true;
    this.say(`${BUILDINGS[b.kind].name} được dời sang chỗ mới.${b.rebuild ? ' Giao "Thợ xây" để dựng lại.' : ''}`);
    return null;
  }

  // ---------------------------------------------------------------- chế tác
  // ---------------------------------------------------------------- research, crafting and repair
  /** Cost and time of an order in one of the three queues. A repair costs half the materials and 60% of the time of making the tool. */
  orderDef(kind: 'research' | 'craft' | 'repair', id: string): { cost: Partial<Stock>; time: number } | null {
    if (kind === 'research') { const t = TECH_BY_ID[id]; return t ? { cost: t.cost, time: t.time } : null; }
    const r = RECIPE_BY_ID[id]; if (!r) return null;
    if (kind === 'craft') return { cost: r.cost, time: r.time };
    const half: Partial<Stock> = {};
    for (const k of Object.keys(r.cost) as Res[]) half[k] = Math.ceil((r.cost[k] ?? 0) / 2);
    return { cost: half, time: Math.ceil(r.time * 0.6) };
  }
  /** Level of a finished building of a kind (0 when there is none). */
  levelOfKind(kind: BuildingKind): number { return this.building(kind)?.level ?? 0; }
  workshopLevel(): number { return this.levelOfKind('workshop'); }
  /** The smartest villager working inside a building, 0 when it is empty. */
  bestIntInside(b: Building): number { return b.staff.reduce((m, id) => Math.max(m, this.byId.get(id)?.stats.int ?? 0), 0); }
  /** Why a recipe cannot be made yet (blueprint or crafting-house level), or null. */
  recipeLock(id: string): string | null {
    if (!RESEARCH.enabled) return null;
    if (!recipeOpen(this.researched, id)) return `Chưa có bản vẽ: ${techForRecipe(id)?.name.replace(/^Bản vẽ /, '') ?? '?'}`;
    const need = recipeNeedLevel(id);
    if (this.workshopLevel() < need) return `Cần Nhà chế tạo cấp ${need}`;
    return null;
  }
  recipeOpen(id: string): boolean { return this.recipeLock(id) === null; }
  /** The smartest villager's Trí tuệ. */
  bestInt(): number { return this.villagers.reduce((m, v) => Math.max(m, v.stats.int), 0); }

  /** Where a research stands: done, being worked on, queued, ready to start or locked (with the reason). */
  techState(t: Tech): { state: 'done' | 'active' | 'queued' | 'ready' | 'locked'; why?: string } {
    if (this.researched.has(t.id)) return { state: 'done' };
    if (this.building('lab')?.active?.id === t.id) return { state: 'active' };
    if (this.researchQueue.includes(t.id)) return { state: 'queued' };
    const need = t.requires.find((r) => !this.researched.has(r));
    if (need) return { state: 'locked', why: `Cần nghiên cứu: ${TECH_BY_ID[need].name}` };
    const lab = this.building('lab');
    if (!lab) return { state: 'locked', why: 'Cần dựng Nhà nghiên cứu' };
    if (lab.level < t.needLevel) return { state: 'locked', why: `Cần Nhà nghiên cứu cấp ${t.needLevel}` };
    return { state: 'ready' };
  }
  /** Whether a queued research could start now: someone inside is bright enough. Null when it can, else the reason. */
  researchBlock(t: Tech): string | null {
    const lab = this.building('lab');
    if (!lab || !lab.staff.length) return 'Chưa có người làm việc trong Nhà nghiên cứu';
    const best = this.bestIntInside(lab);
    return best >= t.minInt ? null : `Cần người Trí tuệ ${t.minInt} trở lên trong nhà (giỏi nhất: ${best})`;
  }

  /** Queue a research; materials and coins are paid when it starts. */
  queueResearch(id: string): string | null {
    const t = TECH_BY_ID[id];
    if (!t) return 'Không có nghiên cứu này';
    if (!RESEARCH.enabled) return 'Nghiên cứu đang tắt';
    const st = this.techState(t);
    if (st.state === 'done') return 'Đã nghiên cứu rồi';
    if (st.state === 'active' || st.state === 'queued') return 'Đang nghiên cứu';
    if (st.state === 'locked') return st.why ?? 'Chưa nghiên cứu được';
    this.researchQueue.push(id);
    return null;
  }
  /** Queue a tool, weapon or armour for the Nhà chế tạo. */
  queueCraft(id: string): string | null {
    if (!RECIPE_BY_ID[id]) return 'Công thức không tồn tại';
    if (!this.hasWorkshop()) return 'Cần dựng Nhà chế tạo trước';
    const lock = this.recipeLock(id);
    if (lock) return lock;
    if (this.craftQueue.length >= 12) return 'Hàng đợi đã đầy';
    this.craftQueue.push(id);
    return null;
  }
  queueRepair(id: string): string | null {
    if (!RECIPE_BY_ID[id]) return 'Công thức không tồn tại';
    if (!this.building('repair')) return 'Cần dựng Nhà sửa chữa trước';
    if (this.repairQueue.length >= 12) return 'Hàng đợi sửa đã đầy';
    this.repairQueue.push(id);
    return null;
  }
  unqueue(queue: string[], id: string): void { const i = queue.lastIndexOf(id); if (i >= 0) queue.splice(i, 1); }
  unqueueCraft(id: string): void { this.unqueue(this.craftQueue, id); }
  unqueueResearch(id: string): void { this.unqueue(this.researchQueue, id); }

  private affordable(cost: Partial<Stock>): boolean { return (Object.keys(cost) as Res[]).every((k) => this.stock[k] >= (cost[k] ?? 0)); }
  private pay(cost: Partial<Stock>, sign = -1): void { for (const k of Object.keys(cost) as Res[]) this.stock[k] += sign * (cost[k] ?? 0); }

  /** How many tools or pieces of gear a store holds: the Kho công cụ for tools, the Kho vũ khí for weapons and armour. */
  storeUsed(cat: 'tool' | 'gear'): number { return Object.entries(this.toolStock).reduce((n, [id, c]) => n + ((RECIPE_BY_ID[id] && isGear(RECIPE_BY_ID[id].kind)) === (cat === 'gear') ? c : 0), 0); }
  /** Room for items: the matching store when it stands, otherwise the crafting house keeps a few. */
  storeCap(cat: 'tool' | 'gear'): number { const b = this.building(cat === 'tool' ? 'toolstore' : 'armory'); return b ? levelDef(b).cap : 10; }

  /** Work done inside the houses: each has one active order, advanced by everyone working there. */
  private tickWorks(dt: number): void {
    for (const b of this.buildings) {
      if (!b.done || (b.kind !== 'lab' && b.kind !== 'workshop' && b.kind !== 'repair')) continue;
      const kind = b.kind === 'lab' ? 'research' : b.kind === 'workshop' ? 'craft' : 'repair';
      const queue = kind === 'research' ? this.researchQueue : kind === 'craft' ? this.craftQueue : this.repairQueue;
      const staff = b.staff.map((id) => this.byId.get(id)).filter((v): v is Villager => !!v);
      if (!staff.length) continue;
      if (!b.active) {
        const best = this.bestIntInside(b);
        const i = queue.findIndex((id) => {
          const d = this.orderDef(kind, id);
          if (!d || !this.affordable(d.cost)) return false;
          if (kind === 'research') return best >= (TECH_BY_ID[id]?.minInt ?? 0);
          if (kind === 'craft') return this.recipeOpen(id);
          return true;
        });
        if (i < 0) {
          if (queue.length && this.time - this.lastMatWarn > 30) { this.lastMatWarn = this.time; this.say(kind === 'research' ? 'Nghiên cứu đang chờ: thiếu nguyên liệu, tiền hoặc người đủ thông minh.' : 'Đơn đang chờ: thiếu nguyên liệu.'); }
          continue;
        }
        const id = queue[i], d = this.orderDef(kind, id)!;
        queue.splice(i, 1); this.pay(d.cost);
        b.active = { id, progress: 0 };
      }
      const d = this.orderDef(kind, b.active.id);
      if (!d) { b.active = null; continue; }
      const job = kind as WorkJob;
      let rate = 0;
      for (const v of staff) { rate += this.workFactor(v, job); this.gainXp(v, job, dt); }
      b.active.progress = Math.min(1, b.active.progress + (dt * rate * levelDef(b).craftSpeed * (this.dev.fastWorks ? 25 : 1)) / d.time);
      if (b.active.progress < 1) continue;
      const id = b.active.id;
      if (kind === 'research') {
        this.researched.add(id); b.active = null;
        this.say(`Nhà nghiên cứu đã hoàn thành "${TECH_BY_ID[id].name}".`);
      } else {
        const r = RECIPE_BY_ID[id], cat = isGear(r.kind) ? 'gear' : 'tool';
        if (this.storeUsed(cat) >= this.storeCap(cat)) { // finished but nowhere to put it
          if (this.time - this.lastFullWarn > 30) { this.lastFullWarn = this.time; this.say(cat === 'tool' ? 'Kho công cụ đã đầy, sản phẩm chờ chỗ.' : 'Kho vũ khí đã đầy, sản phẩm chờ chỗ.'); }
          continue;
        }
        this.toolStock[id] = (this.toolStock[id] ?? 0) + 1; b.active = null;
        this.say(kind === 'craft' ? `Đã chế xong ${recipeName(r).toLowerCase()}.` : `Đã sửa xong ${recipeName(r).toLowerCase()}.`);
      }
    }
  }

  // ---------------------------------------------------------------- working inside a house
  /** The villager best suited to work in a house who is not already doing it: free hands first, soldiers never, then the best stat for the job. */
  bestFor(job: 'craft' | 'research' | 'repair'): Villager | null {
    const stat = JOBS[job].stat;
    const pool = this.villagers.filter((v) => v.down <= 0 && v.inside === null && v.job !== job && v.job !== 'fight' && v.job !== 'hunt');
    pool.sort((a, b) => (a.job === 'idle' ? 0 : 1) - (b.job === 'idle' ? 0 : 1) || b.stats[stat] - a.stats[stat]);
    return pool[0] ?? null;
  }
  /** How fast a house gets through its active order: everyone inside, the house level and the dev speed-up. */
  houseRate(b: Building): number {
    const job: WorkJob = b.kind === 'lab' ? 'research' : b.kind === 'workshop' ? 'craft' : 'repair';
    let r = 0;
    for (const id of b.staff) { const v = this.byId.get(id); if (v) r += this.workFactor(v, job); }
    return r * levelDef(b).craftSpeed * (this.dev.fastWorks ? 25 : 1);
  }
  /** Villagers heading for a house or already in it. */
  staffCount(b: Building): number { return b.staff.length + this.villagers.filter((v) => v.phase === 'goStaff' && v.target === b.id).length; }
  /** Put villagers to work inside the matching house (job craft, research or repair). Returns an error or null. */
  assignStaff(ids: readonly number[], job: 'craft' | 'research' | 'repair'): string | null {
    const b = this.building(STAFF_BUILDING[job]);
    if (!b) return `Chưa có ${BUILDINGS[STAFF_BUILDING[job]].name}, hoặc chưa xây xong`;
    let err: string | null = null;
    for (const v of this.mine(ids)) {
      if (v.inside === b.id) { v.job = job; continue; }
      if (this.staffCount(b) >= levelDef(b).slots) { err = `${BUILDINGS[b.kind].name} cấp ${b.level} chỉ chứa ${levelDef(b).slots} người`; continue; }
      this.resetTask(v); this.clearCombat(v); v.job = job; v.prefer = -1;
      this.planStaff(v);
    }
    return err;
  }
  private planStaff(v: Villager): void {
    if (!isStaffJob(v.job)) return;
    const b = this.building(STAFF_BUILDING[v.job]);
    if (!b) { v.job = 'idle'; return; }
    if (this.staffCount(b) >= levelDef(b).slots) { v.job = 'idle'; this.say(`${v.name} không còn chỗ trong ${BUILDINGS[b.kind].name.toLowerCase()}.`); return; }
    const d = BUILDINGS[b.kind];
    if (this.routeTo(v, this.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) { v.target = b.id; v.phase = 'goStaff'; return; }
    this.wait(v, 3);
  }
  private enterBuilding(v: Villager): void {
    const b = this.getBuilding(v.target);
    if (!b || !b.done || !isStaffJob(v.job) || STAFF_BUILDING[v.job] !== b.kind || b.staff.length >= levelDef(b).slots) { v.phase = 'idle'; if (isStaffJob(v.job)) v.job = 'idle'; return; }
    b.staff.push(v.id); v.inside = b.id; v.phase = 'inside'; v.path = []; v.slide = null;
    const d = BUILDINGS[b.kind]; v.x = b.x + d.w / 2; v.y = b.y + d.h / 2; v.facing = 'front';
    this.say(`${v.name} vào ${BUILDINGS[b.kind].name.toLowerCase()} làm việc.`);
  }
  /** Step out of the house the villager works in; the job is the caller's to change. */
  exitBuilding(v: Villager): void {
    if (v.inside === null) return;
    const b = this.getBuilding(v.inside);
    v.inside = null; v.phase = 'idle';
    if (!b) return;
    b.staff = b.staff.filter((id) => id !== v.id);
    const d = BUILDINGS[b.kind], ring = this.ringTiles(v, b.x, b.y, d.w, d.h);
    const spot = ring[0] ?? [b.x - 1, b.y + d.h];
    v.x = spot[0] + 0.5; v.y = spot[1] + 0.5;
  }
  /** "Cho ra": send the staff out to the map, idle. */
  releaseStaff(ids: readonly number[]): void {
    for (const v of this.mine(ids)) if (v.inside !== null) { this.exitBuilding(v); v.job = 'idle'; this.fogDirty = true; }
  }

  // ---------------------------------------------------------------- tools, weapons and armour by hand
  private toolId(k: ToolKind, tier: number): string { return `${k}${tier}`; }
  /** Give chosen villagers a tool from the stock (tier 0 puts theirs back if it is whole, else it is thrown away). */
  assignTool(ids: readonly number[], k: ToolKind, tier: number): string | null {
    let short = false, given = 0;
    for (const v of this.mine(ids)) {
      const cur = v.tools[k];
      if (tier > 0 && (cur?.tier === tier && cur.dur > 0)) continue;
      if (tier > 0) { if (this.toolCount(k, tier) <= 0) { short = true; continue; } this.toolStock[this.toolId(k, tier)]--; }
      if (cur && cur.dur >= TIER_DURABILITY[cur.tier] - 1e-6) this.toolStock[this.toolId(k, cur.tier)] = (this.toolStock[this.toolId(k, cur.tier)] ?? 0) + 1;
      v.tools[k] = tier > 0 ? { tier, dur: TIER_DURABILITY[tier] } : null;
      given++;
      this.say(tier > 0 ? `${v.name} được phát ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}.` : `${v.name} bỏ ${TOOL_NAME[k].toLowerCase()}.`);
    }
    return short && !given ? `Kho hết ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}, hãy chế thêm` : null;
  }
  /** Throw a tool away, worn or not. */
  discardTool(ids: readonly number[], k: ToolKind): void {
    for (const v of this.mine(ids)) if (v.tools[k]) { v.tools[k] = null; this.say(`${v.name} vứt ${TOOL_NAME[k].toLowerCase()}.`); }
  }
  /** Hand a worn tool in to the Nhà sửa chữa: it leaves the villager and comes back to the stock mended. */
  repairTool(ids: readonly number[], k: ToolKind): string | null {
    if (!this.building('repair')) return 'Cần dựng Nhà sửa chữa';
    let err: string | null = null, n = 0;
    for (const v of this.mine(ids)) {
      const t = v.tools[k]; if (!t) continue;
      if (t.dur >= TIER_DURABILITY[t.tier] - 1e-6) { err = 'Công cụ còn mới, chưa cần sửa'; continue; }
      const e = this.queueRepair(this.toolId(k, t.tier));
      if (e) { err = e; continue; }
      v.tools[k] = null; n++;
      this.say(`${v.name} đưa ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t.tier].toLowerCase()} đi sửa.`);
    }
    return n ? null : err;
  }
  /** Swap goods for shells: the village trades a fixed amount of one good for one coin. */
  barter(res: Exclude<Res, 'coin'>): string | null {
    const n = BARTER[res];
    if (this.stock[res] < n) return `Cần ${n} ${RES_NAME[res].toLowerCase()} để đổi lấy 1 ${RES_NAME.coin.toLowerCase()}`;
    if (this.stock.coin >= this.capacity()) return `Kho đã đầy ${RES_NAME.coin.toLowerCase()}`;
    this.stock[res] -= n; this.stock.coin += 1;
    return null;
  }

  // ---------------------------------------------------------------- lệnh
  resetTask(v: Villager): void {
    this.leaveNode(v); this.exitBuilding(v); v.order = null;
    v.path = []; v.slide = null; v.phase = 'idle'; v.progress = 0; v.timer = 0; v.target = -1; v.bed = -1;
    if (this.resting) v.nightOwl = true;
  }

  /** Drop every combat order of a unit (a new plain order replaces them). */
  clearCombat(v: Villager): void {
    v.fight.target = null; v.fight.mode = 'none'; v.fight.dest = null; v.fight.anchor = null; v.queue.length = 0; v.loot = -1; v.fleeT = 0;
  }
  private mine(ids: readonly number[]): Villager[] {
    return ids.map((id) => this.byId.get(id)).filter((v): v is Villager => !!v && v.team === 'player' && v.down <= 0);
  }
  /** A unit that is already doing something takes a Shift-queued order after it. */
  private busy(v: Villager): boolean {
    return v.phase !== 'idle' || v.path.length > 0 || v.fight.mode !== 'none';
  }

  /** A plain order ends a civilian's job, but soldiers and hunters stay what they are. */
  private keepSoldierJob(v: Villager): void { if (v.job !== 'fight' && v.job !== 'hunt') v.job = 'idle'; }

  /** Lệnh đi: mỗi dân nhận một ô đích riêng quanh điểm chọn; dân thôi làm nghề. With `queue`, the move waits its turn. */
  orderMove(ids: readonly number[], tx: number, ty: number, queue = false): void {
    const vs = this.mine(ids);
    vs.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
    const taken = new Set<number>();
    for (const v of vs) {
      if (queue && this.busy(v)) { v.queue.push({ k: 'move', x: tx, y: ty }); continue; }
      const goal = this.nearestFree(tx, ty, taken);
      this.resetTask(v); this.clearCombat(v); v.prefer = -1;
      this.keepSoldierJob(v);
      if (!goal) continue;
      taken.add(goal[1] * this.world.size + goal[0]);
      v.path = this.pathTo(v, goal[0], goal[1], 30000);
      v.phase = v.path.length ? 'move' : 'idle';
      // a soldier who is sent somewhere stands guard there afterwards
      if (v.job === 'fight') { v.fight.mode = 'guard'; v.fight.anchor = { x: goal[0] + 0.5, y: goal[1] + 0.5 }; }
    }
  }

  /** Chuột phải lên cây/đá/bụi quả/công trình: giao nghề tương ứng. Trả về tên việc hoặc null. */
  orderWork(ids: readonly number[], tx: number, ty: number): string | null {
    if (!this.world.inBounds(tx, ty)) return null;
    const idx = ty * this.world.size + tx;
    const node = this.world.nodeAt(tx, ty), site = this.buildingAt(tx, ty);
    let job: WorkJob | null = null, prefer = -1;
    if (node && this.fog.state[idx] > 0) { job = NODE_JOB[node.kind]; prefer = idx; }
    else if (site && needsWork(site)) { job = 'build'; prefer = site.id; }
    else if (site && site.kind === 'workshop') { job = 'craft'; prefer = site.id; }
    if (!job) return null;
    for (const v of this.mine(ids)) {
      this.resetTask(v); this.clearCombat(v); v.job = job; v.prefer = prefer;
    }
    return JOB_NAME[job];
  }

  /** Give villagers a job. Craft, research and repair mean working inside the matching house; the result is an error or null. */
  setJob(ids: readonly number[], job: Job): string | null {
    if (job === 'craft' || job === 'research' || job === 'repair') return this.assignStaff(ids, job);
    for (const v of this.mine(ids)) {
      this.resetTask(v); this.clearCombat(v); v.job = job; v.prefer = -1;
      if (job === 'fight' && v.fight.mode === 'none') v.fight.anchor = null;
    }
    return null;
  }

  // ---------------------------------------------------------------- combat orders
  /** What the point (tile units) shows that can be fought or looted: living foes, animals, or a carcass. */
  targetAt(x: number, y: number): { target: Target; kind: 'foe' | 'animal' | 'carcass' } | null {
    const N = this.world.size, seen = (px: number, py: number) => this.fog.state[Math.floor(py) * N + Math.floor(px)] === 2;
    let best: { target: Target; kind: 'foe' | 'animal' | 'carcass' } | null = null, bd = 0.9;
    for (const f of this.foes) {
      if (f.health <= 0 || !seen(f.x, f.y)) continue;
      const d = Math.hypot(f.x - x, f.y - 0.5 - y);
      if (d < bd) { bd = d; best = { target: { kind: 'unit', id: f.id }, kind: 'foe' }; }
    }
    for (const a of this.animals) {
      if (!seen(a.x, a.y)) continue;
      const d = Math.hypot(a.x - x, a.y - 0.3 - y);
      if (d < bd) { bd = d; best = { target: { kind: 'animal', id: a.id }, kind: a.state === 'dead' ? 'carcass' : 'animal' }; }
    }
    return best;
  }

  /** Right click on an enemy, animal or carcass. Prey goes to hunters; everything else is a fight. */
  orderAttack(ids: readonly number[], target: Target, queue = false): void {
    const e = resolve(this, target);
    const prey = e?.kind === 'animal' && e.a.state !== 'dead' && animalDef(e.a).prey;
    for (const v of this.mine(ids)) {
      if (queue && this.busy(v)) { v.queue.push({ k: 'attack', t: target }); continue; }
      this.resetTask(v); this.clearCombat(v); v.prefer = -1;
      if (!(v.job === 'fight' || (prey && v.job === 'hunt'))) v.job = prey ? 'hunt' : 'fight';
      v.fight.mode = 'attack'; v.fight.target = target;
    }
  }

  /** Walk to a point and fight whatever is met on the way. */
  orderAttackMove(ids: readonly number[], x: number, y: number, queue = false): void {
    for (const v of this.mine(ids)) {
      if (queue && this.busy(v)) { v.queue.push({ k: 'attackMove', x, y }); continue; }
      this.resetTask(v); this.clearCombat(v); v.prefer = -1; v.job = 'fight';
      v.fight.mode = 'attackMove'; v.fight.dest = { x, y }; v.phase = 'move';
    }
  }

  /** Right click on a dead animal: go and skin it. */
  orderLoot(ids: readonly number[], animalId: number): void {
    for (const v of this.mine(ids)) { this.resetTask(v); this.clearCombat(v); v.job = 'hunt'; v.loot = animalId; v.phase = 'goCarcass'; }
  }

  /** H: stand here and only hit what comes close. */
  orderHold(ids: readonly number[]): void {
    for (const v of this.mine(ids)) {
      this.resetTask(v); this.clearCombat(v); if (v.job !== 'hunt') v.job = 'fight';
      v.fight.mode = 'hold'; v.fight.anchor = { x: v.x, y: v.y };
    }
  }

  /** G: stop everything, keep the job. */
  orderStop(ids: readonly number[]): void {
    for (const v of this.mine(ids)) { this.resetTask(v); this.clearCombat(v); if (v.job === 'fight') { v.fight.mode = 'hold'; v.fight.anchor = { x: v.x, y: v.y }; } }
  }

  setStance(ids: readonly number[], stance: 'aggressive' | 'defensive' | 'retreat'): void {
    for (const v of this.mine(ids)) { v.stance = stance; if (stance === 'defensive') v.fight.anchor = v.fight.anchor ?? { x: v.x, y: v.y }; else if (v.fight.mode !== 'hold') v.fight.anchor = null; }
  }

  /** Start the next queued order, if any. Returns true when something started. */
  nextOrder(v: Villager): boolean {
    const o = v.queue.shift();
    if (!o) return false;
    this.resetTask(v);
    if (o.k === 'move') {
      v.fight.mode = 'none'; v.fight.target = null;
      const goal = this.nearestFree(Math.floor(o.x), Math.floor(o.y), new Set());
      if (goal) { v.path = this.pathTo(v, goal[0], goal[1], 30000); v.phase = v.path.length ? 'move' : 'idle'; if (v.job === 'fight') { v.fight.mode = 'guard'; v.fight.anchor = { x: goal[0] + 0.5, y: goal[1] + 0.5 }; } }
    } else if (o.k === 'attackMove') { v.job = 'fight'; v.fight.mode = 'attackMove'; v.fight.dest = { x: o.x, y: o.y }; v.phase = 'move'; }
    else { v.job = v.job === 'hunt' ? 'hunt' : 'fight'; v.fight.mode = 'attack'; v.fight.target = o.t; }
    return true;
  }

  /** Hand a weapon (club, spear, mace) or the hide armour straight to villagers; null takes it away. */
  giveGear(ids: readonly number[], kind: string | null, slot: 'weapon' | 'armor'): void {
    for (const v of this.mine(ids)) {
      if (slot === 'weapon') v.weapon = kind; else v.armor = kind;
      if (kind) this.say(`${v.name} được cấp ${kind === 'hide' ? ARMORS.hide.name.toLowerCase() : WEAPONS[kind].name.toLowerCase()}.`);
    }
  }

  /** Give a villager a weapon or armour from the workshop's stock (the old piece goes back); null hands it back. Returns an error or null. */
  assignGear(ids: readonly number[], kind: string | null, slot: 'weapon' | 'armor'): string | null {
    const key = (k: string) => (k === 'hide' ? 'hide1' : `${k}${WEAPONS[k].tier ?? 1}`);
    const nameOf = (k: string) => (k === 'hide' ? ARMORS.hide.name : WEAPONS[k].name).toLowerCase();
    const people = this.mine(ids);
    if (kind && !this.hasWorkshop() && !this.building('armory')) return 'Cần có Nhà chế tạo hoặc Kho vũ khí để lấy đồ';
    let given = 0, short = false;
    for (const v of people) {
      const cur = slot === 'weapon' ? v.weapon : v.armor;
      if (cur === kind) { v.manualGear = true; continue; }
      if (kind) { if (this.toolCount(kind === 'hide' ? 'hide' : kind, kind === 'hide' ? 1 : WEAPONS[kind].tier ?? 1) <= 0) { short = true; continue; } this.toolStock[key(kind)]--; }
      if (cur) this.toolStock[key(cur)] = (this.toolStock[key(cur)] ?? 0) + 1;
      if (slot === 'weapon') v.weapon = kind; else v.armor = kind;
      v.manualGear = true; given++;
      this.say(kind ? `${v.name} được phát ${nameOf(kind)}.` : `${v.name} trả lại ${cur ? nameOf(cur) : 'đồ'}.`);
    }
    return short && given === 0 ? `Kho hết ${kind ? nameOf(kind) : 'đồ'}, hãy chế thêm` : null;
  }
  /** Let the workshop hand out and swap gear by itself again. */
  autoGear(ids: readonly number[]): void { for (const v of this.mine(ids)) v.manualGear = false; }

  /** Cấp công cụ ngay cho dân đã chọn, không cần Xưởng hay nguyên liệu. tier 0 = thu lại (tay không). */
  giveTool(ids: readonly number[], kind: ToolKind, tier: number): void {
    for (const id of ids) {
      const v = this.byId.get(id); if (!v) continue;
      v.tools[kind] = tier > 0 ? { tier, dur: TIER_DURABILITY[tier] } : null;
      if (tier > 0) this.say(`${v.name} được cấp ${TOOL_NAME[kind].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}.`);
    }
  }

  /** Ô trống gần (tx,ty) nhất, chưa bị ai giữ. */
  nearestFree(tx: number, ty: number, taken: Set<number>): [number, number] | null {
    const N = this.world.size;
    for (let r = 0; r <= 12; r++) {
      let best: [number, number] | null = null, bd = Infinity;
      for (let y = ty - r; y <= ty + r; y++) {
        for (let x = tx - r; x <= tx + r; x++) {
          if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
          if (this.world.isBlocked(x, y) || taken.has(y * N + x)) continue;
          const d = (x - tx) ** 2 + (y - ty) ** 2;
          if (d < bd) { bd = d; best = [x, y]; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // ---------------------------------------------------------------- vòng lặp
  private refreshFog(): void {
    const r = this.visionRadius(), fire = this.fireRadius();
    this.lastVision = r;
    const src = this.villagers.map((v) => ({ x: v.x, y: v.y, r }));
    for (const b of this.buildings) if (b.done) { const d = BUILDINGS[b.kind]; src.push({ x: b.x + d.w / 2, y: b.y + d.h / 2, r: b.kind === 'campfire' ? fire : r }); }
    this.fog.update(src);
    for (const v of this.villagers) { v.tx = Math.floor(v.x); v.ty = Math.floor(v.y); }
  }

  /** Gọi mỗi khung hình với dt thực; chạy theo bước cố định, nhân với hệ số tốc độ. */
  advance(dt: number): void {
    if (this.speed <= 0) return;
    this.acc += Math.min(dt, 0.25) * this.speed;
    let guard = 0;
    while (this.acc >= TICK && guard++ < 400) { this.acc -= TICK; this.tick(TICK); }
  }

  private tick(dt: number): void {
    this.time += dt;
    this.tickCalendar();
    this.world.tick(dt);
    this.syncFood();
    tickAnimals(this, dt); tickProjectiles(this, dt);
    for (const v of [...this.villagers]) this.tickVillager(v, dt);
    this.tickWorks(dt);
    for (const f of [...this.foes]) tickFoe(this, f, dt);
    tickTribes(this, dt);
    this.moraleClock += dt;
    if (this.moraleClock >= 1) { this.moraleClock = 0; for (const v of this.villagers) if (v.down <= 0) tickMorale(this, v); this.pickLeaders(); }
    if (this.visionRadius() !== this.lastVision) this.fogDirty = true;
    if (this.fogDirty) { this.fogDirty = false; this.refreshFog(); }
  }

  /** New day: roll weather, maybe change season; at noon foretell tomorrow; track rest hours. */
  private tickCalendar(): void {
    const day = this.day;
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.weather = this.nextWeather;
      this.nextWeather = rollWeather(seasonOf(day + 1), this.wrnd());
      this.signalled = false;
      const season = seasonOf(day);
      if (season !== this.world.season) { this.world.setSeason(season); this.say(SEASON_DEF[season].enter); }
      if (this.weather !== 'clear') this.say(`Hôm nay: ${WEATHER[this.weather].name.toLowerCase()}.`);
    }
    if (!this.signalled && this.tod >= 0.5) {
      this.signalled = true;
      const sig = WEATHER[this.nextWeather].signal;
      if (sig && this.nextWeather !== this.weather) this.say(sig);
    }
    const rest = isRestTime(this.tod, this.season);
    if (this.resting && !rest) for (const v of this.villagers) v.nightOwl = false;
    this.resting = rest;
  }

  /** Reconcile lots with the stock: gains open a new lot, losses come off the oldest; expired lots spoil. */
  private syncFood(): void {
    const lots = this.foodLots, cur = this.stock.food;
    let sum = 0;
    for (const l of lots) sum += l.amount;
    if (cur > sum) {
      const exp = this.time + FOOD_SPOIL_DAYS * DAY_LENGTH, last = lots[lots.length - 1];
      if (last && exp - last.exp < 30) last.amount += cur - sum; else lots.push({ amount: cur - sum, exp });
    } else if (cur < sum) {
      let take = sum - cur;
      while (take > 0 && lots.length) {
        const l = lots[0], k = Math.min(l.amount, take);
        l.amount -= k; take -= k;
        if (l.amount <= 0) lots.shift();
      }
    }
    let spoiled = 0;
    while (lots.length && lots[0].exp <= this.time) spoiled += lots.shift()!.amount;
    if (spoiled > 0) {
      this.stock.food = Math.max(0, this.stock.food - spoiled);
      this.say(`${Math.round(spoiled)} thức ăn để quá ${FOOD_SPOIL_DAYS} ngày đã hỏng.`);
    }
  }

  private tickVillager(v: Villager, dt: number): void {
    tickCommon(this, v, dt);
    if (v.down > 0) { tickDown(this, v, dt); this.animate(v, dt); return; }
    // ---- nhu cầu ----
    v.fullness -= this.dev.noHunger ? 0 : (dt * 100) / DAY_LENGTH;
    if (v.fullness < 50 && this.stock.food >= 2) {
      this.stock.food -= 2; v.fullness = Math.min(100, v.fullness + 2 * FOOD_NUTRITION);
    }
    if (v.fullness <= 0) {
      if (!v.starving) { v.starving = true; this.say(`${v.name} đói lả, kho hết thức ăn!`); }
      v.fullness = 0; v.health -= (dt * v.maxHealth) / (1.5 * DAY_LENGTH);
    } else {
      v.starving = false;
      if (v.fullness > 40 && v.health < v.maxHealth && v.calm > 10) v.health = Math.min(v.maxHealth, v.health + dt * 0.0015 * v.maxHealth);
    }
    if (v.health <= 0) { this.kill(v); return; }
    v.orderCd = Math.max(0, v.orderCd - dt);
    // working inside a house: no walking, no fighting, nobody sees them
    if (v.inside !== null) { this.animate(v, dt); return; }

    // ---- combat decides first: fighting, fleeing, rescuing, hunting ----
    const brained = brainPlayer(this, v, dt);

    // ---- night rest (sentries and anyone busy with a fight stay up) ----
    const fighting = brained && (v.phase === 'fight' || v.phase === 'flee' || v.phase === 'rescue');
    if (this.resting) { if (!v.nightOwl && v.job !== 'fight' && !fighting && v.phase !== 'goHome' && v.phase !== 'sleep') this.goHome(v); }
    else if (v.phase === 'goHome' || v.phase === 'sleep') { v.path = []; v.slide = null; v.phase = 'idle'; v.bed = -1; }

    this.moveUnit(v, dt);
    if (Math.floor(v.x) !== v.tx || Math.floor(v.y) !== v.ty) this.fogDirty = true;
    if (!v.path.length && !v.slide && !brained) this.think(v, dt);
    this.animate(v, dt);
  }

  /** Follow the path and the final slide step; shared by villagers and tribal people. */
  moveUnit(v: Villager, dt: number): void {
    const walk = v.speed * WEATHER[this.weather].speed * (v.phase === 'flee' ? 1.3 : 1) * (v.armor ? 1 : 1);
    if (v.swing) return; // a blow in progress plants the feet
    let left = walk * dt;
    while (left > 0 && v.path.length) {
      const [px, py] = v.path[0];
      const dx = px + 0.5 - v.x, dy = py + 0.5 - v.y, d = Math.hypot(dx, dy);
      if (d <= left) { v.x = px + 0.5; v.y = py + 0.5; left -= d; v.path.shift(); }
      else { v.x += (dx / d) * left; v.y += (dy / d) * left; left = 0; }
      if (d > 1e-6) v.facing = Math.abs(dx) > Math.abs(dy) * 1.1 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back';
    }
    // ---- bước trượt cuối: nhích sát vật thể trước khi làm ----
    if (!v.path.length && v.slide) {
      const s = v.slide, dx = s.x - v.x, dy = s.y - v.y, d = Math.hypot(dx, dy), step = walk * 0.7 * dt;
      if (d <= step) { v.x = s.x; v.y = s.y; v.slide = null; v.facing = s.face; }
      else { v.x += (dx / d) * step; v.y += (dy / d) * step; if (Math.abs(dx) > 0.02) v.facing = dx > 0 ? 'right' : 'left'; }
    }
  }

  /** Pick the animation and the item in hand from what the unit is doing. */
  animate(v: Villager, dt: number): void {
    let anim = 'idle', hold: Hold | null = null;
    const walking = v.path.length > 0 || !!v.slide;
    // Fighting has its own poses, apart from the work animations: a ready stance, a charge, a panicked run and a slump.
    const armed = (): Hold | null => { if (!v.weapon) return null; const w = weaponOf(v); return { kind: v.weapon, tier: w.tier ?? 1 }; };
    const style = !v.weapon ? 'fist' : ({ thrust: 'pierce', shoot: 'bow', sling: 'sling' } as Record<string, string>)[weaponOf(v).anim] ?? 'melee';
    const ready = v.phase === 'fight' || v.fight.mode !== 'none';
    // soldiers and hunters keep their weapon in hand between tasks, so they can be told apart from civilians
    const carrying = !!v.weapon && (v.job === 'fight' || v.job === 'hunt');
    if (v.down > 0) anim = 'down';
    else if (v.swing) { const w = weaponOf(v); anim = w.anim; if (v.weapon) hold = { kind: v.weapon, tier: w.tier ?? 1 }; }
    else if (v.flinch > 0) anim = 'hit';
    else if (v.phase === 'flee') anim = 'run';
    else if (ready) { anim = `${walking ? 'charge' : 'guard'}_${style}`; hold = armed(); }
    else if (walking) { anim = v.carry && v.carry.amount > 0 ? 'carry_walk' : 'walk'; if (carrying && !(v.carry && v.carry.amount > 0)) { anim = 'walk_armed'; hold = armed(); } }
    else if (carrying && v.phase === 'idle') { anim = 'idle_armed'; hold = armed(); }
    else if (v.phase === 'work' && v.job !== 'idle') {
      const k = TOOL_OF_JOB[v.job as WorkJob], tier = this.toolTier(v, v.job);
      if (k && tier > 0) { anim = JOBS[v.job as WorkJob].anim === 'gather' ? 'dig' : JOBS[v.job as WorkJob].anim; hold = { kind: k, tier }; }
      else anim = 'gather';
    } else if (v.phase === 'build') {
      const t = this.toolTier(v, 'build');
      if (t > 0) { anim = 'build'; hold = { kind: 'hammer', tier: t }; } else anim = 'gather';
    }
    else if (v.phase === 'skin') anim = 'gather';
    if (anim !== v.anim) { v.anim = anim; v.animClock = 0; } else v.animClock += dt;
    v.hold = hold;
  }

  /** Go sleep by the campfire: drop the current task (job kept), one spot per villager. */
  private goHome(v: Villager): void {
    const owl = v.nightOwl;
    this.resetTask(v); v.nightOwl = owl;
    v.phase = 'sleep';
    const fire = this.buildings.find((b) => b.kind === 'campfire');
    if (!fire) return;
    const d = BUILDINGS[fire.kind];
    const taken = new Set(this.villagers.filter((o) => o !== v && o.bed >= 0).map((o) => o.bed));
    const spot = this.nearestFree(fire.x + (d.w >> 1), fire.y + d.h, taken);
    if (!spot || this.routeTo(v, [spot], 1) < 0) return; // unreachable: sleep where standing
    v.bed = spot[1] * this.world.size + spot[0]; v.phase = 'goHome';
  }

  kill(v: Villager, cause = 'vì đói'): void {
    this.leaveNode(v); this.exitBuilding(v);
    this.villagers.splice(this.villagers.indexOf(v), 1); this.byId.delete(v.id);
    this.fogDirty = true;
    this.say(`${v.name} đã chết ${cause}.`);
    this.onKill?.();
  }
  killUnit(v: Villager, cause: string): void { this.kill(v, cause); }

  // ---------------------------------------------------------------- tribal people
  /** Make a unit known by id (used when a villager is created outside the constructor, e.g. by the dev menu). */
  registerUnit(v: Villager): void { this.byId.set(v.id, v); this.fogDirty = true; }
  addFoe(v: Villager): void { this.foes.push(v); this.byId.set(v.id, v); }
  removeFoe(v: Villager): void {
    const i = this.foes.indexOf(v);
    if (i >= 0) this.foes.splice(i, 1);
    this.byId.delete(v.id);
  }
  /** A tribal person joins the village. */
  adoptFoe(v: Villager): void {
    const i = this.foes.indexOf(v);
    if (i >= 0) this.foes.splice(i, 1);
    v.team = 'player'; v.ai = null; v.job = 'idle'; v.phase = 'idle'; v.path = []; v.morale = 50; v.leader = false; v.fleeT = 0;
    this.clearCombat(v); v.health = Math.max(v.health, v.maxHealth * 0.6); v.fullness = 70;
    this.villagers.push(v); this.fogDirty = true;
  }
  /** Diplomacy buttons: 'gift', 'tribute', 'adopt'. Returns an error text or null. */
  diplomacy(id: TribeId, action: 'gift' | 'tribute' | 'adopt'): string | null {
    return action === 'gift' ? giftTribe(this, id) : action === 'tribute' ? tributeTribe(this, id) : adoptTribe(this, id);
  }

  // ---------------------------------------------------------------- combat helpers
  hurt(target: Target, dmg: number, type: 'pierce' | 'slash' | 'crush', from: { x: number; y: number }, src: { unit?: Villager; animal?: Animal }): void {
    hurt(this, target, dmg, type, from, src);
  }
  tribeHostile(id: Team): boolean { return tribeHostile(this, id); }
  tribeAttacked(id: Exclude<Team, 'player' | 'wild'>, victim: Villager): void { tribeAttacked(this, id, victim); }
  killFoe(v: Villager, killer?: Villager): void { killFoe(this, v, killer); }
  /** The player's own campfire (the village centre). */
  campfire(): Building | undefined { return this.buildings.find((b) => b.kind === 'campfire' && b.done); }
  /** Close to the unit's own camp: the village fire, or the tribal camp for tribal people. */
  nearHome(v: Villager): boolean {
    if (v.ai) return Math.hypot(v.x - v.ai.camp.x, v.y - v.ai.camp.y) < 10;
    const f = this.campfire();
    return !!f && Math.hypot(v.x - f.x - 1, v.y - f.y - 1) < 10;
  }
  /** Another fighter within 7 tiles of the animal: a boar is only worth attacking in a group. */
  packNear(v: Villager, a: Animal): boolean {
    return this.villagers.some((o) => o !== v && o.health > 0 && o.down <= 0 && (o.job === 'hunt' || o.job === 'fight') && Math.hypot(o.x - a.x, o.y - a.y) < 7);
  }
  /** Every second: groups of five or more fighters get a leader, the best of them. */
  private pickLeaders(): void {
    const fighters = this.villagers.filter((v) => v.job === 'fight' && v.health > 0 && v.down <= 0);
    for (const v of this.villagers) v.leader = false;
    if (fighters.length >= 5) fighters.sort((a, b) => b.stats.str + b.stats.agi - a.stats.str - a.stats.agi)[0].leader = true;
  }
  // ---------------------------------------------------------------- việc làm
  /** How fast a villager gets through crafting or research (1 = the nominal time). */
  workRate(v: Villager, job: WorkJob): number { return this.workFactor(v, job); }
  private workFactor(v: Villager, job: WorkJob): number {
    const stat = v.stats[JOBS[job].stat];
    const season = job === 'food' ? SEASON_DEF[this.season].gather : 1;
    return (0.5 + 0.1 * stat) * (1 + 0.2 * v.skill[job].level) * (v.fullness < 25 ? 0.7 : 1) * (TOOL_OF_JOB[job] ? TIER_SPEED[this.toolTier(v, job)] : 1) * season;
  }

  private gainXp(v: Villager, job: WorkJob, dt: number): void {
    const s = v.skill[job];
    if (s.level >= MAX_LEVEL) return;
    s.xp += dt * XP_MULT[v.potential[job]];
    if (s.xp >= XP_LEVELS[s.level]) { s.level++; this.say(`${v.name} lên cấp ${s.level} nghề ${JOB_NAME[job].toLowerCase()}.`); }
  }

  /** Tools wear with working time; at zero they are broken and the villager works as if bare-handed until a new tool or a repair. */
  private wear(v: Villager, job: WorkJob, dt: number): void {
    const k = TOOL_OF_JOB[job], t = k ? v.tools[k] : null;
    if (!k || !t || t.dur <= 0) return;
    t.dur -= dt;
    if (t.dur <= 0) { t.dur = 0; this.say(`${TOOL_NAME[k]} ${TIER_NAME[t.tier].toLowerCase()} của ${v.name} đã hỏng.`); }
  }

  leaveNode(v: Villager): void {
    if ((v.phase === 'goNode' || v.phase === 'work') && v.target >= 0) {
      const n = this.world.nodes.get(v.target);
      if (n) { if (n.workers > 0) n.workers--; n.sides &= ~v.slot; }
    }
    v.slot = 0;
  }

  private face(v: Villager, tx: number, ty: number): void {
    const dx = tx + 0.5 - v.x, dy = ty + 0.5 - v.y;
    v.facing = Math.abs(dx) > Math.abs(dy) * 1.1 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back';
  }

  wait(v: Villager, secs: number): void { v.phase = 'wait'; v.timer = secs; }

  /** Dân luôn làm việc ở dạng nhìn ngang: nhìn về phía tâm vật thể. */
  private faceX(v: Villager, cx: number): void { v.facing = cx >= v.x ? 'right' : 'left'; }

  /** Chỗ đứng ngang bên trái hoặc bên phải một vật thể, cùng hàng với gốc của nó. */
  private nodeSlide(v: Villager, nx: number, ny: number, kind: NodeKind): Slide {
    const left = v.slot === LEFT;
    return { x: nx + 0.5 + (left ? -REACH[kind] : REACH[kind]), y: ny + 0.875, face: left ? 'right' : 'left' };
  }

  /** Chỗ đứng ngang bên trái hoặc phải một công trình, sát mép dưới (mặt trước). */
  private edgeSlide(v: Villager, b: Building): Slide {
    const d = BUILDINGS[b.kind], left = v.x < b.x + d.w / 2;
    return { x: left ? b.x - 0.3 : b.x + d.w + 0.3, y: b.y + d.h - 0.3 - (v.id % 2) * 0.5, face: left ? 'right' : 'left' };
  }

  /** Đứng yên nhìn ngang về phía công trình (dùng khi dỡ hàng, lấy công cụ). */
  private faceBuilding(v: Villager, b: Building): void { this.faceX(v, b.x + BUILDINGS[b.kind].w / 2); }

  think(v: Villager, dt: number): void {
    const N = this.world.size;
    switch (v.phase) {
      case 'move': v.phase = 'idle'; this.nextOrder(v); return;
      case 'idle': if (v.queue.length && this.nextOrder(v)) return; if (v.job !== 'idle') this.plan(v); return;
      case 'wait': v.timer -= dt; if (v.timer <= 0) v.phase = 'idle'; return;
      case 'goNode': {
        const n = this.world.nodes.get(v.target);
        if (!n || n.amount <= 0) { this.leaveNode(v); v.phase = 'idle'; return; }
        const nx = v.target % N, ny = (v.target / N) | 0;
        v.phase = 'work'; v.progress = 0;
        const sl = this.nodeSlide(v, nx, ny, n.kind);
        if (Math.hypot(sl.x - v.x, sl.y - v.y) < 0.04) v.facing = sl.face; else v.slide = sl;
        return;
      }
      case 'work': this.doWork(v, dt); return;
      case 'goStore': this.unload(v); return;
      case 'goEquip': this.equip(v); return;
      case 'goSite': {
        const b = this.getBuilding(v.target);
        if (!b || !needsWork(b)) { v.phase = 'idle'; return; }
        v.phase = 'build';
        v.slide = this.edgeSlide(v, b);
        return;
      }
      case 'build': {
        const b = this.getBuilding(v.target);
        if (!b || !needsWork(b)) { v.phase = 'idle'; return; }
        const target = b.upgrading ? b.level + 1 : b.level;
        b.progress += (dt / (levelDef(b, target).buildTime * (b.rebuild ? 0.5 : 1))) * this.workFactor(v, 'build');
        this.gainXp(v, 'build', dt); this.wear(v, 'build', dt);
        if (b.progress >= 1) {
          b.progress = 1;
          if (b.upgrading) { b.level++; b.upgrading = false; this.say(`${BUILDINGS[b.kind].name} đã lên cấp ${b.level} (${levelDef(b).name.toLowerCase()}).`); }
          else { b.done = true; b.rebuild = false; this.fogDirty = true; this.say(`${BUILDINGS[b.kind].name} đã dựng xong.`); if (RESEARCH.enabled && b.kind === 'lab' && this.researched.size === 0) this.say('Mở Nhà nghiên cứu, đưa một dân thông minh vào làm việc, rồi nghiên cứu bản vẽ đầu tiên.'); }
          v.phase = 'idle';
        }
        return;
      }
      case 'goStaff': this.enterBuilding(v); return;
      case 'goOrder': this.errand(v); return;
      case 'inside': return;
      case 'goHome': {
        // at the sleeping spot: stash carried goods in the campfire (it is also a store)
        const c = v.carry;
        if (c) {
          const moved = Math.min(Math.max(0, this.capacity(c.res) - this.stock[c.res]), c.amount);
          this.stock[c.res] += moved; c.amount -= moved;
          if (c.amount <= 0) v.carry = null;
        }
        v.phase = 'sleep'; v.facing = 'front';
        return;
      }
      case 'sleep': return;
    }
  }

  private doWork(v: Villager, dt: number): void {
    const job = v.job as WorkJob, def = JOBS[job], n = this.world.nodes.get(v.target);
    if (!def.res || !n || n.amount <= 0) { this.leaveNode(v); v.phase = 'idle'; return; }
    v.progress += (dt * this.workFactor(v, job)) / def.baseTime;
    this.gainXp(v, job, dt);
    const tierNow = this.toolTier(v, job);
    this.wear(v, job, dt);
    if (v.progress < 1) return;
    v.progress -= 1;
    // sản lượng mỗi lần theo chất lượng công cụ, phần lẻ cộng dồn sang lần sau
    const res = def.res, acc = v.frac + TIER_YIELD[tierNow], whole = Math.floor(acc);
    const have = v.carry && v.carry.res === res ? v.carry.amount : 0;
    const take = Math.max(0, Math.min(whole, n.amount, CARRY_CAP[res] - have));
    v.frac = acc - whole;
    n.amount -= take;
    v.carry = { res, amount: have + take };
    // gatherers now and then turn up a shell (the stone age's money) among the berries
    if (res === 'food' && take > 0) {
      this.coinFrac += 0.06 * take;
      if (this.coinFrac >= 1) { this.coinFrac -= 1; if (this.stock.coin < this.capacity()) { this.stock.coin++; if (!this.sawCoin) { this.sawCoin = true; this.say(`${v.name} nhặt được một ${RES_NAME.coin.toLowerCase()}: dân làng dùng nó để trao đổi.`); } } }
    }
    if (n.amount <= 0) {
      const idx = v.target; this.leaveNode(v); this.world.depleted(idx); v.phase = 'idle';
      if (n.kind === 'tree') this.say('Một cây đã được đốn xong.');
    } else if (v.carry.amount >= CARRY_CAP[res] || this.needTool(v, job)) { this.leaveNode(v); v.phase = 'idle'; }
  }

  private plan(v: Villager): void {
    if (v.job === 'hunt' || v.job === 'fight') { this.wait(v, 1); return; } // combat code drives these jobs
    if (v.job === 'build') { if (!this.planTool(v, 'build')) this.planBuild(v); return; }
    if (isStaffJob(v.job)) { this.planStaff(v); return; }
    const def = JOBS[v.job as WorkJob], res = def.res!;
    if (v.carry && (v.carry.res !== res || v.carry.amount >= CARRY_CAP[v.carry.res])) { this.planDeliver(v); return; }
    if (this.stock[res] >= this.capacity(res)) {
      if (v.carry) { this.planDeliver(v); return; }
      if (this.time - this.lastFullWarn > 30) { this.lastFullWarn = this.time; this.say(`Kho đã đầy ${RES_NAME[res].toLowerCase()}, hãy xây thêm Kho.`); }
      this.wait(v, 3); return;
    }
    if (this.planTool(v, v.job as WorkJob)) return;
    if (this.findNode(v, def.node!)) return;
    if (v.carry) { this.planDeliver(v); return; }
    this.wait(v, 2);
  }

  /** True when the villager's tool for this job is missing or broken. */
  toolLacking(v: Villager, job: WorkJob): boolean {
    const k = TOOL_OF_JOB[job]; if (!k) return false;
    const t = v.tools[k];
    return !t || t.dur <= 0;
  }
  /** Best tier of this tool the stock holds (0 when none). */
  private stockedTier(k: ToolKind): number { for (let t = 2; t >= 1; t--) if (this.toolCount(k, t) > 0) return t; return 0; }
  /** A villager who lacks a tool, with the Kho công cụ built and fetching researched, and a tool in stock. */
  needTool(v: Villager, job: WorkJob): boolean {
    const k = TOOL_OF_JOB[job];
    return !!k && autoOn(this.researched, 'fetch') && !!this.building('toolstore') && this.toolLacking(v, job) && this.stockedTier(k) > 0;
  }

  /** Walk to a building's edge for an errand; false when it cannot be reached. */
  private goTo(v: Villager, b: Building, phase: 'goEquip' | 'goOrder'): boolean {
    const d = BUILDINGS[b.kind];
    if (this.routeTo(v, this.ringTiles(v, b.x, b.y, d.w, d.h)) < 0) return false;
    v.target = b.id; v.phase = phase; return true;
  }

  /** Without a usable tool: fetch one from the Kho công cụ, else (once researched) go and order or repair one. */
  planTool(v: Villager, job: WorkJob): boolean {
    const k = TOOL_OF_JOB[job];
    if (!k || !this.toolLacking(v, job)) return false;
    const store = this.building('toolstore');
    if (store && this.needTool(v, job)) return this.goTo(v, store, 'goEquip');
    if (!autoOn(this.researched, 'order') || v.orderCd > 0) return false;
    v.orderCd = 45;
    const t = v.tools[k], repairHouse = this.building('repair'), craftHouse = this.building('workshop');
    if (t && t.dur <= 0 && repairHouse && this.repairQueue.length < 12) { v.order = `repair:${k}`; return this.goTo(v, repairHouse, 'goOrder'); }
    if (!craftHouse) return false;
    // order the best tool the blueprints allow, unless enough are already made or on their way
    let id = '';
    for (let tier = 2; tier >= 1; tier--) if (this.recipeOpen(`${k}${tier}`)) { id = `${k}${tier}`; break; }
    if (!id) return false;
    const lacking = this.villagers.filter((o) => o.inside === null && o.job !== 'idle' && TOOL_OF_JOB[o.job as WorkJob] === k && this.toolLacking(o, o.job as WorkJob)).length;
    const onWay = this.toolCount(k, 1) + this.toolCount(k, 2) + this.craftQueue.filter((q) => q.startsWith(k)).length + (craftHouse.active?.id.startsWith(k) ? 1 : 0);
    if (onWay >= lacking || this.craftQueue.length >= 12) return false;
    v.order = `craft:${id}`;
    return this.goTo(v, craftHouse, 'goOrder');
  }

  /** Arrived at a house with an errand: hand over the order or the broken tool, then back to work. */
  private errand(v: Villager): void {
    const o = v.order; v.order = null; v.phase = 'idle'; v.orderCd = 90;
    const b = this.getBuilding(v.target);
    if (b) this.faceBuilding(v, b);
    if (!o || !b || !b.done) return;
    const [what, id] = o.split(':');
    if (what === 'craft') { if (this.queueCraft(id) === null) this.say(`${v.name} nhờ chế ${recipeName(RECIPE_BY_ID[id]).toLowerCase()}.`); }
    else if (what === 'repair') {
      const k = id as ToolKind, t = v.tools[k];
      if (t && t.dur <= 0 && this.queueRepair(this.toolId(k, t.tier)) === null) { v.tools[k] = null; this.say(`${v.name} nhờ sửa ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t.tier].toLowerCase()}.`); }
    }
  }

  /** Take a tool, or weapon and armour, from the store the villager stands at. */
  equip(v: Villager): void {
    v.phase = 'idle';
    const store = this.getBuilding(v.target);
    if (store) this.faceBuilding(v, store);
    if (v.job === 'hunt' || v.job === 'fight') { this.equipGear(v); return; }
    const k = TOOL_OF_JOB[v.job as WorkJob];
    if (!k || !this.toolLacking(v, v.job as WorkJob)) return;
    const t = this.stockedTier(k);
    if (!t) return;
    this.toolStock[this.toolId(k, t)]--;
    v.tools[k] = { tier: t, dur: TIER_DURABILITY[t] };
    this.say(`${v.name} nhận ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t].toLowerCase()}.`);
  }

  /** A soldier or hunter with empty hands goes to the Kho vũ khí (once fetching is researched) for a weapon, a soldier also for armour. */
  planEquipGear(v: Villager): boolean {
    if ((v.job !== 'hunt' && v.job !== 'fight') || v.phase === 'fight' || v.manualGear) return false;
    const armory = this.building('armory');
    if (!armory || !autoOn(this.researched, 'fetch')) return false;
    const wantsWeapon = !v.weapon && !!bestWeapon(this, v), wantsArmor = v.job === 'fight' && !v.armor && this.toolCount('hide', 1) > 0;
    if (!wantsWeapon && !wantsArmor) return false;
    return this.goTo(v, armory, 'goEquip');
  }
  private equipGear(v: Villager): void {
    const best = !v.weapon ? bestWeapon(this, v) : null;
    if (best) {
      this.toolStock[`${best}${WEAPONS[best].tier ?? 1}`]--;
      v.weapon = best; this.say(`${v.name} nhận ${WEAPONS[best].name.toLowerCase()}.`);
    }
    if (v.job === 'fight' && !v.armor && this.toolCount('hide', 1) > 0) {
      this.toolStock.hide1--; v.armor = 'hide'; this.say(`${v.name} mặc ${ARMORS.hide.name.toLowerCase()}.`);
    }
  }
  /** With ordering researched, a soldier or hunter who has nothing to fight with asks the Nhà chế tạo for a weapon (a soldier also for armour). */
  planGearErrand(v: Villager): boolean {
    if ((v.job !== 'hunt' && v.job !== 'fight') || v.phase === 'fight' || v.manualGear || v.orderCd > 0) return false;
    const house = this.building('workshop');
    if (!house || !autoOn(this.researched, 'order')) return false;
    const have = (re: RegExp) => Object.entries(this.toolStock).some(([id, n]) => n > 0 && re.test(id)) || this.craftQueue.some((id) => re.test(id)) || !!house.active && re.test(house.active.id);
    let id = '';
    if (!v.weapon && !have(/^(club|spear|mace)/)) {
      let bestScore = -1;
      for (const w of CRAFTED_WEAPONS) {
        const rid = `${w}${WEAPONS[w].tier ?? 1}`;
        if (!this.recipeOpen(rid) || (w === 'mace' && v.job !== 'fight')) continue;
        const sc = WEAPONS[w].damage / WEAPONS[w].cycle;
        if (sc > bestScore) { bestScore = sc; id = rid; }
      }
    } else if (v.job === 'fight' && !v.armor && !have(/^hide/) && this.recipeOpen('hide1')) id = 'hide1';
    v.orderCd = 60;
    if (!id) return false;
    v.order = `craft:${id}`;
    return this.goTo(v, house, 'goOrder');
  }

  /** Các ô trống quanh một hình chữ nhật, gần `v` nhất trước. */
  ringTiles(v: Villager, x: number, y: number, w: number, h: number): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
      if (i >= x && i < x + w && j >= y && j < y + h) continue;
      if (!this.world.isBlocked(i, j)) out.push([i, j]);
    }
    // ưu tiên ô bên trái/phải để dân đứng ngang công trình
    const cost = (t: [number, number]) => Math.hypot(t[0] + 0.5 - v.x, t[1] + 0.5 - v.y) + (t[0] >= x && t[0] < x + w ? 1.5 : 0);
    out.sort((a, b) => cost(a) - cost(b));
    return out;
  }

  /**
   * Start tile for pathfinding. A work spot can overlap a blocked tile (a tree between two trees);
   * then use the nearest free neighbour, since A* cannot leave a blocked tile without cutting corners.
   */
  standTile(v: Villager): [number, number] {
    const fx = Math.floor(v.x), fy = Math.floor(v.y);
    if (!this.world.isBlocked(fx, fy)) return [fx, fy];
    let best: [number, number] = [fx, fy], bd = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = fx + dx, y = fy + dy;
      if (this.world.isBlocked(x, y)) continue;
      const d = Math.hypot(x + 0.5 - v.x, y + 0.5 - v.y);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }

  /** Path from where the villager stands to (gx, gy); may end at the closest tile if unreachable. */
  pathTo(v: Villager, gx: number, gy: number, maxNodes = 14000): Step[] {
    const [sx, sy] = this.standTile(v), off = sx !== Math.floor(v.x) || sy !== Math.floor(v.y);
    const p = gx === sx && gy === sy ? [] : findPath(this.world, sx, sy, gx, gy, maxNodes);
    return off ? [[sx, sy] as Step, ...p] : p;
  }

  /** Thử đi tới một trong các ô; trả về chỉ số ô đã có đường tới (hoặc -1). */
  routeTo(v: Villager, tiles: Array<[number, number]>, tries = 3): number {
    const [sx, sy] = this.standTile(v);
    for (let k = 0; k < Math.min(tries, tiles.length); k++) {
      const [gx, gy] = tiles[k];
      const p = this.pathTo(v, gx, gy), last = p[p.length - 1];
      if ((gx === sx && gy === sy) || (last && last[0] === gx && last[1] === gy)) { v.path = p; return k; }
    }
    return -1;
  }

  private findNode(v: Villager, kind: NodeKind): boolean {
    const N = this.world.size, vx = Math.floor(v.x), vy = Math.floor(v.y);
    const ok = (idx: number) => {
      const n = this.world.nodes.get(idx);
      return !!n && n.kind === kind && n.amount > 0 && n.workers < 2 && n.sides !== 3 && this.fog.state[idx] > 0 && (v.bad.get(idx) ?? 0) <= this.time;
    };
    const cands: Array<[number, number]> = [];
    if (v.prefer >= 0 && ok(v.prefer)) cands.push([-1, v.prefer]);
    for (const [idx, n] of this.world.nodes) {
      if (n.kind !== kind || n.amount <= 0 || n.workers >= 2 || n.sides === 3 || idx === v.prefer || !ok(idx)) continue;
      const d = (idx % N - vx) ** 2 + (((idx / N) | 0) - vy) ** 2;
      if (d <= 70 * 70) cands.push([d, idx]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (let c = 0; c < Math.min(4, cands.length); c++) {
      const idx = cands[c][1], nx = idx % N, ny = (idx / N) | 0, node = this.world.nodes.get(idx)!;
      // Mỗi nguồn có 2 chỗ đứng ngang (trái, phải). Ô tiếp cận ưu tiên: ngay cạnh, chéo dưới, chéo trên, rồi chính giữa dưới/trên.
      // Vì dân trượt từ ô tiếp cận vào chỗ đứng, cây ở giữa hai cây khác vẫn chặt được miễn có ô trống nào quanh nó.
      const opts: Array<{ t: [number, number]; side: number; pen: number }> = [];
      for (const side of [LEFT, RIGHT]) {
        if (node.sides & side) continue;
        const sx = side === LEFT ? -1 : 1;
        const near: Array<[number, number, number]> = [[sx, 0, 0], [sx, 1, 0.6], [sx, -1, 1.6], [0, 1, 1.2], [0, -1, 2.4]];
        for (const [dx, dy, pen] of near) if (!this.world.isBlocked(nx + dx, ny + dy)) opts.push({ t: [nx + dx, ny + dy], side, pen });
      }
      const cost = (o: { t: [number, number]; pen: number }) => Math.hypot(o.t[0] + 0.5 - v.x, o.t[1] + 0.5 - v.y) + o.pen;
      opts.sort((a, b) => cost(a) - cost(b));
      const k = this.routeTo(v, opts.map((o) => o.t), 4);
      if (k >= 0) {
        node.workers++; node.sides |= opts[k].side; v.slot = opts[k].side;
        v.target = idx; v.phase = 'goNode'; v.prefer = -1;
        return true;
      }
      v.bad.set(idx, this.time + 30);
    }
    if (v.prefer >= 0) {
      if (this.world.nodes.has(v.prefer) && (v.bad.get(v.prefer) ?? 0) > this.time) this.say(`${v.name} không tìm được đường tới nguồn đã chọn.`);
      v.prefer = -1;
    }
    return false;
  }

  planDeliver(v: Villager): void {
    const done = this.buildings.filter((b) => b.done && holdsGoods(b));
    done.sort((a, b) => Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
    for (const b of done.slice(0, 2)) {
      const d = BUILDINGS[b.kind];
      if (this.routeTo(v, this.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) { v.target = b.id; v.phase = 'goStore'; return; }
    }
    this.wait(v, 2);
  }

  private unload(v: Villager): void {
    const c = v.carry, st = this.getBuilding(v.target);
    if (st) this.faceBuilding(v, st);
    if (!c) { v.phase = 'idle'; return; }
    const space = Math.max(0, this.capacity(c.res) - this.stock[c.res]), moved = Math.min(space, c.amount);
    this.stock[c.res] += moved; c.amount -= moved;
    if (c.amount <= 0) { v.carry = null; v.phase = 'idle'; return; }
    if (this.time - this.lastFullWarn > 30) { this.lastFullWarn = this.time; this.say(`Kho đã đầy ${RES_NAME[c.res].toLowerCase()}, hãy xây thêm Kho.`); }
    this.wait(v, 3);
  }

  private planBuild(v: Villager): void {
    const crew = (b: Building) => this.villagers.filter((o) => o !== v && o.target === b.id && (o.phase === 'goSite' || o.phase === 'build')).length;
    let sites = this.buildings.filter((b) => needsWork(b) && crew(b) < 3);
    sites.sort((a, b) => (b.id === v.prefer ? 1 : 0) - (a.id === v.prefer ? 1 : 0) ||
      Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
    sites = sites.slice(0, 2);
    for (const b of sites) {
      const d = BUILDINGS[b.kind];
      if (this.routeTo(v, this.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) { v.target = b.id; v.phase = 'goSite'; v.prefer = -1; return; }
    }
    this.wait(v, 2);
  }
}
