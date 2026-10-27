import { DayPart, dayPart, isRestTime, lightAt, rollWeather, Season, seasonOf, SEASON_DEF, WEATHER, WeatherKind } from './calendar';
import { DAY_LENGTH, FIRE_VISION, NIGHT_VISION, START_TIME, TICK, VISION } from './constants';
import { Building, BuildingKind, BUILDINGS } from './buildings';
import { Fog } from './fog';
import { Job, JOBS, JOB_NAME, MAX_LEVEL, NodeKind, Stats, WorkJob, WORK_JOBS, XP_LEVELS } from './jobs';
import { findPath, Step } from './path';
import { CARRY_CAP, emptyStock, FOOD_NUTRITION, FOOD_SPOIL_DAYS, Res, RES_NAME, Stock } from './resources';
import { mulberry32 } from './rng';
import { emptyToolSet, Recipe, RECIPE_BY_ID, recipeName, TIER_DURABILITY, TIER_NAME, TIER_SPEED, TIER_YIELD, Tool, ToolKind, ToolSet, TOOL_NAME, TOOL_OF_JOB } from './tools';
import { World } from './world';

export type Sex = 'm' | 'f';
export type Facing = 'front' | 'back' | 'right' | 'left';
export type Phase = 'idle' | 'move' | 'goNode' | 'work' | 'goStore' | 'wait' | 'goSite' | 'build' | 'goShop' | 'craft' | 'goEquip' | 'goHome' | 'sleep';
export interface Look { sex: Sex; skin: string; hair: string; hide: string; pants: string }
export interface Skill { xp: number; level: number }
export interface LogLine { t: number; text: string }
/** Công cụ đang hiện trong tay (để vẽ). */
export interface Hold { kind: string; tier: number }
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
  bed: number;      // reserved sleeping tile by the campfire (-1 if none)
  /** Ordered by the player during rest hours: stays awake until morning. */
  nightOwl: boolean;
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
  readonly log: LogLine[] = [];
  /** Hệ số tốc độ: 0 = tạm dừng. */
  speed = 1;
  /** Giây game đã trôi qua. */
  time = START_TIME;
  private readonly byId = new Map<number, Villager>();
  private acc = 0;
  private fogDirty = true;
  private nextVid = 1;
  private nextBid = 1;
  private readonly rnd: () => number;
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
    this.wrnd = mulberry32(seed ^ 0x5bd1e995);
    this.world.setSeason(this.season);
    this.nextWeather = rollWeather(seasonOf(this.day + 1), this.wrnd());
    this.resting = isRestTime(this.tod, this.season);
    const s = this.world.start;
    this.addBuilding('campfire', s.x - 1, s.y - 2, true);
    this.stock.food = 24;
    const spots: Array<[number, number, Sex]> = [[-1, 1, 'm'], [1, 1, 'f'], [0, 2, 'm']];
    for (const [dx, dy, sex] of spots) this.spawn(s.x + dx, s.y + dy, sex);
    this.say('Ba người đầu tiên đã đến bên đống lửa. Chọn họ, rồi giao việc: chuột phải lên cây, đá hay bụi quả.');
    this.refreshFog();
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
    for (const b of this.buildings) if (b.done) c += BUILDINGS[b.kind].cap;
    return c;
  }
  buildingAt(x: number, y: number): Building | undefined {
    return this.buildings.find((b) => {
      const d = BUILDINGS[b.kind];
      return x >= b.x && x < b.x + d.w && y >= b.y && y < b.y + d.h;
    });
  }
  getBuilding(id: number): Building | undefined { return this.buildings.find((b) => b.id === id); }
  hasWorkshop(): boolean { return this.buildings.some((b) => b.kind === 'workshop' && b.done); }
  toolCount(kind: ToolKind, tier: number): number { return this.toolStock[`${kind}${tier}`] ?? 0; }
  /** Bậc công cụ dân đang dùng cho nghề này (0 = tay không). */
  toolTier(v: Villager, job: Job): number {
    const k = job === 'idle' ? undefined : TOOL_OF_JOB[job];
    return k ? v.tools[k]?.tier ?? 0 : 0;
  }

  private freshName(sex: Sex): string {
    const pool = (sex === 'm' ? NAMES_M : NAMES_F).filter((n) => !this.villagers.some((v) => v.name === n));
    const list = pool.length ? pool : sex === 'm' ? NAMES_M : NAMES_F;
    return list[Math.floor(this.rnd() * list.length)];
  }

  private spawn(x: number, y: number, sex: Sex): Villager {
    const r = this.rnd, pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    const stats = {} as Stats;
    for (const k of STAT_KEYS) stats[k] = 3 + Math.floor(r() * 8);
    const potential = {} as Record<WorkJob, number>, skill = {} as Record<WorkJob, Skill>;
    for (const j of WORK_JOBS) {
      const p = r(); potential[j] = p < 0.45 ? 1 : p < 0.85 ? 2 : 3; skill[j] = { xp: 0, level: 0 };
    }
    const v: Villager = {
      id: this.nextVid++, name: this.freshName(sex),
      look: { sex, skin: pick(SKIN), hair: pick(HAIR), hide: '#8b6a45', pants: '#3f63a8' },
      x: x + 0.5, y: y + 0.5, path: [], slide: null, facing: 'front', speed: 1.6 + 0.1 * stats.agi, animClock: 0, tx: -1, ty: -1,
      stats, potential, skill, tools: emptyToolSet(), job: 'idle', phase: 'idle', slot: 0, target: -1, prefer: -1, progress: 0, frac: 0, timer: 0, order: null,
      carry: null, fullness: 100, health: 100, starving: false, anim: 'idle', hold: null, bad: new Map(), bed: -1, nightOwl: false,
    };
    this.villagers.push(v); this.byId.set(v.id, v);
    return v;
  }

  // ---------------------------------------------------------------- công trình
  private addBuilding(kind: BuildingKind, x: number, y: number, done: boolean): Building {
    const d = BUILDINGS[kind];
    const b: Building = { id: this.nextBid++, kind, x, y, progress: done ? 1 : 0, done, workers: 0 };
    this.buildings.push(b);
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) this.world.occ[(y + j) * this.world.size + x + i] = 1;
    return b;
  }

  /** Trả về lý do không đặt được, hoặc null nếu đặt được. */
  canPlace(kind: BuildingKind, x: number, y: number): string | null {
    const d = BUILDINGS[kind], w = this.world, N = w.size;
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
      const tx = x + i, ty = y + j;
      if (!w.inBounds(tx, ty)) return 'Ngoài bản đồ';
      const k = ty * N + tx;
      if (this.fog.state[k] === 0) return 'Chưa khám phá';
      const t = w.tiles[k];
      if ((t !== 0 && t !== 4) || w.occ[k]) return 'Vướng cây, đá, nước hoặc công trình';
    }
    for (const r of Object.keys(d.cost) as Res[]) if (this.stock[r] < (d.cost[r] ?? 0)) return `Thiếu ${RES_NAME[r].toLowerCase()} (cần ${d.cost[r]})`;
    return null;
  }

  placeBuilding(kind: BuildingKind, x: number, y: number): PlaceResult {
    const d = BUILDINGS[kind];
    if (!d.buildable) return { ok: false, reason: 'Không xây được công trình này' };
    const why = this.canPlace(kind, x, y);
    if (why) return { ok: false, reason: why };
    for (const r of Object.keys(d.cost) as Res[]) this.stock[r] -= d.cost[r] ?? 0;
    const b = this.addBuilding(kind, x, y, false);
    this.say(`Đã đặt nền ${d.name}. Giao việc "Thợ xây" để dựng.`);
    return { ok: true, building: b };
  }

  // ---------------------------------------------------------------- chế tác
  /** Thêm một đơn vào hàng đợi (nguyên liệu chỉ bị trừ khi thợ nhận đơn). */
  queueCraft(id: string): string | null {
    if (!RECIPE_BY_ID[id]) return 'Công thức không tồn tại';
    if (!this.hasWorkshop()) return 'Cần dựng Xưởng chế tác trước';
    if (this.craftQueue.length >= 12) return 'Hàng đợi đã đầy';
    this.craftQueue.push(id);
    return null;
  }
  /** Bỏ đơn cuối cùng cùng loại khỏi hàng đợi. */
  unqueueCraft(id: string): void {
    const i = this.craftQueue.lastIndexOf(id);
    if (i >= 0) this.craftQueue.splice(i, 1);
  }
  private affordable(r: Recipe): boolean {
    return (Object.keys(r.cost) as Res[]).every((k) => this.stock[k] >= (r.cost[k] ?? 0));
  }
  private releaseOrder(v: Villager): void {
    if (!v.order) return;
    const r = RECIPE_BY_ID[v.order];
    if (r && (v.phase === 'goShop' || v.phase === 'craft')) {
      for (const k of Object.keys(r.cost) as Res[]) this.stock[k] += r.cost[k] ?? 0; // hoàn nguyên liệu
      this.craftQueue.unshift(r.id);
    }
    v.order = null;
  }

  // ---------------------------------------------------------------- lệnh
  private resetTask(v: Villager): void {
    this.leaveNode(v); this.releaseOrder(v);
    v.path = []; v.slide = null; v.phase = 'idle'; v.progress = 0; v.timer = 0; v.target = -1; v.bed = -1;
    if (this.resting) v.nightOwl = true;
  }

  /** Lệnh đi: mỗi dân nhận một ô đích riêng quanh điểm chọn; dân thôi làm nghề. */
  orderMove(ids: readonly number[], tx: number, ty: number): void {
    const vs = ids.map((id) => this.byId.get(id)).filter((v): v is Villager => !!v);
    vs.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
    const taken = new Set<number>();
    for (const v of vs) {
      const goal = this.nearestFree(tx, ty, taken);
      this.resetTask(v); v.job = 'idle'; v.prefer = -1;
      if (!goal) continue;
      taken.add(goal[1] * this.world.size + goal[0]);
      v.path = this.pathTo(v, goal[0], goal[1], 30000);
      v.phase = v.path.length ? 'move' : 'idle';
    }
  }

  /** Chuột phải lên cây/đá/bụi quả/công trình: giao nghề tương ứng. Trả về tên việc hoặc null. */
  orderWork(ids: readonly number[], tx: number, ty: number): string | null {
    if (!this.world.inBounds(tx, ty)) return null;
    const idx = ty * this.world.size + tx;
    const node = this.world.nodeAt(tx, ty), site = this.buildingAt(tx, ty);
    let job: WorkJob | null = null, prefer = -1;
    if (node && this.fog.state[idx] > 0) { job = NODE_JOB[node.kind]; prefer = idx; }
    else if (site && !site.done) { job = 'build'; prefer = site.id; }
    else if (site && site.kind === 'workshop') { job = 'craft'; prefer = site.id; }
    if (!job) return null;
    for (const id of ids) {
      const v = this.byId.get(id); if (!v) continue;
      this.resetTask(v); v.job = job; v.prefer = prefer;
    }
    return JOB_NAME[job];
  }

  setJob(ids: readonly number[], job: Job): void {
    for (const id of ids) {
      const v = this.byId.get(id); if (!v) continue;
      this.resetTask(v); v.job = job; v.prefer = -1;
    }
  }

  /** Ô trống gần (tx,ty) nhất, chưa bị ai giữ. */
  private nearestFree(tx: number, ty: number, taken: Set<number>): [number, number] | null {
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
    for (const v of [...this.villagers]) this.tickVillager(v, dt);
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
    // ---- nhu cầu ----
    v.fullness -= (dt * 100) / DAY_LENGTH;
    if (v.fullness < 50 && this.stock.food >= 2) {
      this.stock.food -= 2; v.fullness = Math.min(100, v.fullness + 2 * FOOD_NUTRITION);
    }
    if (v.fullness <= 0) {
      if (!v.starving) { v.starving = true; this.say(`${v.name} đói lả, kho hết thức ăn!`); }
      v.fullness = 0; v.health -= (dt * 100) / (1.5 * DAY_LENGTH);
    } else {
      v.starving = false;
      if (v.fullness > 40 && v.health < 100) v.health = Math.min(100, v.health + dt * 0.15);
    }
    if (v.health <= 0) { this.kill(v); return; }

    // ---- night rest ----
    if (this.resting) { if (!v.nightOwl && v.phase !== 'goHome' && v.phase !== 'sleep') this.goHome(v); }
    else if (v.phase === 'goHome' || v.phase === 'sleep') { v.path = []; v.slide = null; v.phase = 'idle'; v.bed = -1; }

    // ---- walking (slowed by rain, snow) ----
    const walk = v.speed * WEATHER[this.weather].speed;
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
    if (Math.floor(v.x) !== v.tx || Math.floor(v.y) !== v.ty) this.fogDirty = true;
    if (!v.path.length && !v.slide) this.think(v, dt);

    // ---- hoạt ảnh và công cụ trong tay ----
    let anim = 'idle', hold: Hold | null = null;
    const walking = v.path.length > 0 || !!v.slide;
    if (walking) anim = v.carry && v.carry.amount > 0 ? 'carry_walk' : 'walk';
    else if (v.phase === 'work' && v.job !== 'idle') {
      const k = TOOL_OF_JOB[v.job as WorkJob], tier = this.toolTier(v, v.job);
      if (k && tier > 0) { anim = JOBS[v.job as WorkJob].anim === 'gather' ? 'dig' : JOBS[v.job as WorkJob].anim; hold = { kind: k, tier }; }
      else anim = 'gather';
    } else if (v.phase === 'build') {
      anim = 'build'; const t = v.tools.shovel?.tier ?? 0;
      hold = t > 0 ? { kind: 'shovel', tier: t } : { kind: 'hammer', tier: 2 };
    } else if (v.phase === 'craft') { anim = 'craft'; hold = { kind: 'hammer', tier: 2 }; }
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

  private kill(v: Villager): void {
    this.leaveNode(v); this.releaseOrder(v);
    this.villagers.splice(this.villagers.indexOf(v), 1); this.byId.delete(v.id);
    this.fogDirty = true;
    this.say(`${v.name} đã chết vì đói.`);
  }

  // ---------------------------------------------------------------- việc làm
  private workFactor(v: Villager, job: WorkJob): number {
    const stat = v.stats[JOBS[job].stat];
    const season = job === 'food' ? SEASON_DEF[this.season].gather : 1;
    return (0.5 + 0.1 * stat) * (1 + 0.2 * v.skill[job].level) * (v.fullness < 25 ? 0.7 : 1) * TIER_SPEED[this.toolTier(v, job)] * season;
  }

  private gainXp(v: Villager, job: WorkJob, dt: number): void {
    const s = v.skill[job];
    if (s.level >= MAX_LEVEL) return;
    s.xp += dt * XP_MULT[v.potential[job]];
    if (s.xp >= XP_LEVELS[s.level]) { s.level++; this.say(`${v.name} lên cấp ${s.level} nghề ${JOB_NAME[job].toLowerCase()}.`); }
  }

  /** Công cụ hao mòn theo thời gian làm việc; gãy thì dân quay về tay không. */
  private wear(v: Villager, job: WorkJob, dt: number): void {
    const k = TOOL_OF_JOB[job], t = k ? v.tools[k] : null;
    if (!k || !t) return;
    t.dur -= dt;
    if (t.dur <= 0) { v.tools[k] = null; this.say(`${TOOL_NAME[k]} ${TIER_NAME[t.tier].toLowerCase()} của ${v.name} đã gãy.`); }
  }

  private leaveNode(v: Villager): void {
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

  private wait(v: Villager, secs: number): void { v.phase = 'wait'; v.timer = secs; }

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

  private think(v: Villager, dt: number): void {
    const N = this.world.size;
    switch (v.phase) {
      case 'move': v.phase = 'idle'; return;
      case 'idle': if (v.job !== 'idle') this.plan(v); return;
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
        if (!b || b.done) { v.phase = 'idle'; return; }
        v.phase = 'build';
        v.slide = this.edgeSlide(v, b);
        return;
      }
      case 'build': {
        const b = this.getBuilding(v.target);
        if (!b || b.done) { v.phase = 'idle'; return; }
        b.progress += (dt / BUILDINGS[b.kind].buildTime) * this.workFactor(v, 'build');
        this.gainXp(v, 'build', dt); this.wear(v, 'build', dt);
        if (b.progress >= 1) {
          b.progress = 1; b.done = true; this.fogDirty = true;
          this.say(`${BUILDINGS[b.kind].name} đã dựng xong.`);
          v.phase = 'idle';
        }
        return;
      }
      case 'goShop': {
        const b = this.getBuilding(v.target);
        if (!b || !b.done || !v.order) { this.releaseOrder(v); v.phase = 'idle'; return; }
        v.phase = 'craft'; v.progress = 0;
        v.slide = this.edgeSlide(v, b);
        return;
      }
      case 'craft': this.doCraft(v, dt); return;
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
    if (n.amount <= 0) {
      const idx = v.target; this.leaveNode(v); this.world.depleted(idx); v.phase = 'idle';
      if (n.kind === 'tree') this.say('Một cây đã được đốn xong.');
    } else if (v.carry.amount >= CARRY_CAP[res] || this.betterTool(v, job)) { this.leaveNode(v); v.phase = 'idle'; }
  }

  private doCraft(v: Villager, dt: number): void {
    const r = v.order ? RECIPE_BY_ID[v.order] : null;
    if (!r) { v.phase = 'idle'; return; }
    v.progress += (dt * this.workFactor(v, 'craft')) / r.time;
    this.gainXp(v, 'craft', dt);
    if (v.progress < 1) return;
    this.toolStock[r.id] = (this.toolStock[r.id] ?? 0) + 1;
    this.say(`${v.name} đã chế xong ${recipeName(r).toLowerCase()}.`);
    v.order = null; v.progress = 0; v.phase = 'idle';
  }

  private plan(v: Villager): void {
    if (v.job === 'build') { if (!this.planEquip(v, 'build')) this.planBuild(v); return; }
    if (v.job === 'craft') { this.planCraft(v); return; }
    const def = JOBS[v.job as WorkJob], res = def.res!;
    if (v.carry && (v.carry.res !== res || v.carry.amount >= CARRY_CAP[v.carry.res])) { this.planDeliver(v); return; }
    if (this.stock[res] >= this.capacity(res)) {
      if (v.carry) { this.planDeliver(v); return; }
      if (this.time - this.lastFullWarn > 30) { this.lastFullWarn = this.time; this.say(`Kho đã đầy ${RES_NAME[res].toLowerCase()}, hãy xây thêm Kho.`); }
      this.wait(v, 3); return;
    }
    if (this.planEquip(v, v.job as WorkJob)) return;
    if (this.findNode(v, def.node!)) return;
    if (v.carry) { this.planDeliver(v); return; }
    this.wait(v, 2);
  }

  /** Bậc công cụ tốt hơn đang có sẵn ở Xưởng (0 nếu không có). */
  private betterTool(v: Villager, job: WorkJob): number {
    const k = TOOL_OF_JOB[job];
    if (!k || !this.hasWorkshop()) return 0;
    const cur = v.tools[k]?.tier ?? 0;
    for (let t = 2; t > cur; t--) if (this.toolCount(k, t) > 0) return t;
    return 0;
  }

  /** Nếu Xưởng có công cụ tốt hơn thứ dân đang cầm thì đi lấy. */
  private planEquip(v: Villager, job: WorkJob): boolean {
    const k = TOOL_OF_JOB[job];
    if (!k) return false;
    if (!this.betterTool(v, job)) return false;
    const shops = this.buildings.filter((b) => b.kind === 'workshop' && b.done);
    shops.sort((a, b) => Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
    for (const b of shops.slice(0, 2)) {
      const d = BUILDINGS[b.kind];
      if (this.routeTo(v, this.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) { v.target = b.id; v.phase = 'goEquip'; return true; }
    }
    return false;
  }

  private equip(v: Villager): void {
    v.phase = 'idle';
    const shop = this.getBuilding(v.target);
    if (shop) this.faceBuilding(v, shop);
    const k = TOOL_OF_JOB[v.job as WorkJob];
    if (!k) return;
    const cur = v.tools[k]?.tier ?? 0;
    for (let t = 2; t > cur; t--) {
      const key = `${k}${t}`;
      if ((this.toolStock[key] ?? 0) > 0) {
        this.toolStock[key]--;
        const tool: Tool = { tier: t, dur: TIER_DURABILITY[t] };
        v.tools[k] = tool;
        this.say(`${v.name} nhận ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t].toLowerCase()}.`);
        return;
      }
    }
  }

  private planCraft(v: Villager): void {
    const shops = this.buildings.filter((b) => b.kind === 'workshop' && b.done);
    if (!shops.length) { this.wait(v, 3); return; }
    if (!v.order) {
      const i = this.craftQueue.findIndex((id) => this.affordable(RECIPE_BY_ID[id]));
      if (i < 0) {
        if (this.craftQueue.length && this.time - this.lastMatWarn > 30) { this.lastMatWarn = this.time; this.say('Thiếu nguyên liệu để chế công cụ trong hàng đợi.'); }
        this.wait(v, 3); return;
      }
      const r = RECIPE_BY_ID[this.craftQueue[i]];
      this.craftQueue.splice(i, 1);
      for (const k of Object.keys(r.cost) as Res[]) this.stock[k] -= r.cost[k] ?? 0;
      v.order = r.id;
    }
    shops.sort((a, b) => (b.id === v.prefer ? 1 : 0) - (a.id === v.prefer ? 1 : 0) ||
      Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
    for (const b of shops.slice(0, 2)) {
      const d = BUILDINGS[b.kind];
      if (this.routeTo(v, this.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) { v.target = b.id; v.phase = 'goShop'; return; }
    }
    // không tới được Xưởng: trả đơn về hàng đợi
    const r = RECIPE_BY_ID[v.order];
    for (const k of Object.keys(r.cost) as Res[]) this.stock[k] += r.cost[k] ?? 0;
    this.craftQueue.unshift(r.id); v.order = null;
    this.wait(v, 3);
  }

  /** Các ô trống quanh một hình chữ nhật, gần `v` nhất trước. */
  private ringTiles(v: Villager, x: number, y: number, w: number, h: number): Array<[number, number]> {
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
  private standTile(v: Villager): [number, number] {
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
  private pathTo(v: Villager, gx: number, gy: number, maxNodes = 14000): Step[] {
    const [sx, sy] = this.standTile(v), off = sx !== Math.floor(v.x) || sy !== Math.floor(v.y);
    const p = gx === sx && gy === sy ? [] : findPath(this.world, sx, sy, gx, gy, maxNodes);
    return off ? [[sx, sy] as Step, ...p] : p;
  }

  /** Thử đi tới một trong các ô; trả về chỉ số ô đã có đường tới (hoặc -1). */
  private routeTo(v: Villager, tiles: Array<[number, number]>, tries = 3): number {
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

  private planDeliver(v: Villager): void {
    const done = this.buildings.filter((b) => b.done && BUILDINGS[b.kind].cap > 0);
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
    let sites = this.buildings.filter((b) => !b.done && crew(b) < 3);
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
