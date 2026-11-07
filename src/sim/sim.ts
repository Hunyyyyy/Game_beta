import { DayPart, dayPart, isRestTime, lightAt, rollWeather, Season, seasonOf, WeatherKind } from './calendar';
import { dayLength, FOE_PATH_SHARE, paceWork, PATH_BUDGET, START_TIME, TICK } from './constants';
import { Building, BuildingKind, BUILDINGS, Era } from './buildings';
import { Fog } from './fog';
import { Job, RoleId, WorkJob } from './jobs';
import { Step } from './path';
import { CURRENCY, emptyStock, Res, RES_NAME, Stock } from './resources';
import { mix32, mulberry32, Rng } from './rng';
import { Tool, ToolKind } from './tools';
import { Team, TribeId } from './combat';
import { armOf, hurt, tickProjectiles } from './battle';
import { Animal, populateChunk, restock, restoreWarAnimals, tickAnimals } from './fauna';
import * as tribeLod from './tribelod';
import { tickFoe } from './brainfoe';
import { adoptTribe, EventState, foeBonus, dismissAllies, giftTribe, killFoe, resetTribes, setTribute, spawnTribes, summonAllies, tickTribes, Tribe, tribeAttacked, tribeHostile, tribesFeud, tribeWilling, tributeTribe } from './tribes';
import { recipeOpen, Tech } from './research';
import { questViews, QuestUi, QuestView } from './quests';
import { World } from './world';
import startJson from '../data/start.json';
import * as construction from './construction';
import * as economy from './economy';
import * as notices from './notices';
import * as readiness from './readiness';
import * as works from './works';
import * as houses from './houses';
import * as inventory from './inventory';
import * as mounts from './mounts';
import * as commands from './commands';
import * as labor from './labor';
import * as movement from './movement';
import * as villagers from './villagers';
import * as environment from './environment';
import * as save from './save';
import * as rest from './rest';
import * as roles from './roles';
import * as idle from './idle';
import * as defense from './defense';
import * as army from './army';
import * as scouting from './scouting';
import * as power from './power';
import * as warplan from './warplan';
import * as warmode from './warmode';
import * as warmarch from './warmarch';
import * as warscene from './warscene';
import * as warsupply from './warsupply';
import * as warharass from './warharass';
import * as warlog from './warlog';
import * as warquick from './warquick';
import * as brainplayer from './brainplayer';
import { WAR, WarApi } from './simwar';
import { BattleRecord, BattleState, CardKind, FormationName, LogLine, Objective, Notice, PlaceResult, Plan, Projectile, ScoutLoss, WarRecord, ScoutMap, ScoutMission, Sex, Sighting, Shift, Squad, Target, Villager } from './model';
import type { Ent } from './battle';
export * from './model';

/** How far round each villager the land is kept made (tiles): more than the longest sight, so there is always ground ahead. */
const STREAM_REACH = 40;

export class Sim {
  readonly world: World;
  readonly fog: Fog;
  readonly villagers: Villager[] = [];
  readonly buildings: Building[] = [];
  readonly stock: Stock = emptyStock();
  /** Công cụ đã chế, đang chờ dân tới Xưởng lấy. Khóa dạng "axe1". */
  readonly toolStock: Record<string, number> = {};
  /** Tools handed back with wear on them; they keep their durability. `id` as in toolStock. */
  readonly wornTools: Array<{ id: string; dur: number }> = [];
  /** Hàng đợi chế tác (mã công thức). */
  readonly craftQueue: string[] = [];
  /** For each order in craftQueue, what it was paid at (a multiple of its base cost), so that cancelling it gives back the same. */
  readonly craftPaid: number[] = [];
  readonly tameQueue: string[] = [];
  /** Research (tech ids) waiting for a free researcher in the Nhà nghiên cứu. */
  readonly researchQueue: string[] = [];
  coinFrac = 0;
  sawCoin = false;
  /** Finished research (tech ids). Recipes and building levels stay locked until their tech is here. */
  readonly researched = new Set<string>();
  /** Quests that have been seen done (not saved: a loaded game works them out again from what stands). */
  readonly questSeen = new Set<string>();
  readonly log: LogLine[] = [];
  /** Current era: new buildings are built with this era's art and levels. */
  era: Era = 'stone';
  /** Hệ số tốc độ: 0 = tạm dừng. */
  speed = 1;
  /** Giây game đã trôi qua. */
  time = START_TIME;
  /** The day count and the time of the day are counted from here: the day `dayBase`+1 began at `timeBase` (moved when the era, and the length of a day, changes). */
  dayBase = 0;
  timeBase = 0;
  /** Player villagers and tribal people, by id. */
  readonly byId = new Map<number, Villager>();
  /** Tribal people (enemies, neutrals, tributaries); they share the Villager body but never work. */
  readonly foes: Villager[] = [];
  /** Who stands in which cell of the map this tick, for finding enemies near a unit (see battle.ts). Rebuilt every tick, never saved. */
  /** Searches for a way that may still be made this tick: a large army given an order at once would otherwise stall the game for a moment. Refilled every tick, never saved. */
  pathLeft = 0;
  threatCache: { time: number; foes: Map<number, Villager[]> | null; mine: Map<number, Villager[]> | null } | null = null;
  readonly tribes: Tribe[] = [];
  /** Scheduled wolf packs and tribal raids. */
  readonly events: EventState[] = [];
  nextRaid = 0;
  /** When there was last danger the civilians ran from (an attack on the village, or something that chased one of them): they stay in their houses for 30 seconds after it. */
  dangerAt = -1e9;
  /** The chunks where the other villages live their daily life: those round our people. Redone every second, never saved. */
  readonly active = new Set<number>();
  /** People the village may hold beyond its campfire and beds: the campfires of the villages we took. */
  popBonus = 0;
  /** Places added to every camp of soldiers by the villages taken (difficulty.json capture.adopt): the army is limited by its camps, not by its people. */
  campBonus = 0;
  /** Whether strangers may come to settle (the campfire's panel shuts and opens the door; environment.toggleNewcomers). */
  newcomersOpen = true;
  /** How many villages we took (adopted or wiped out): each adds to the yield of every stroke of work (difficulty.json capture.yieldPerVillage). */
  conquered = 0;
  /** Fights between two villages that we saw (time, place): they become a notice for a while. Never saved. */
  readonly clashes: Array<{ a: string; b: string; at: number; x: number; y: number }> = [];
  readonly animals: Animal[] = [];
  /** The animals put by while a war is on (fauna.tickWarAnimals); they come back when it is over. */
  readonly hiddenAnimals: Animal[] = [];
  readonly animalById = new Map<number, Animal>();
  readonly projectiles: Projectile[] = [];
  /** War: squads, what the scouts have learnt, scouting trips, battle plans, the alarm and the fight that is on. */
  readonly squads: Squad[] = [];
  nextSquad = 1;
  readonly maps: ScoutMap[] = [];
  readonly scouts: ScoutMission[] = [];
  /** Villages found by anyone who wandered near them (see Sighting). */
  readonly sightings: Sighting[] = [];
  nextMission = 1;
  readonly plans: Plan[] = [];
  /** The wars fought, newest last (warlog.ts). */
  readonly warLog: WarRecord[] = [];
  /** The scouts who died on their trips, with the reason (scouting.ts). */
  readonly scoutLosses: ScoutLoss[] = [];
  nextPlan = 1;
  /** Game seconds until which the alarm drum is sounding (0 = quiet). */
  alarmUntil = 0;
  readonly battle: BattleState = { on: false, since: 0, quiet: 0, ourDead: 0, foeDead: 0, breaches: 0, shots: 0, notes: [], kind: 'raid', name: '', startDay: 0, night: false, peak: 0, ourDeadArm: { foot: 0, archer: 0, cavalry: 0 }, civDead: 0, dmgDealt: 0, dmgTaken: 0 };
  /** The fights at the village, newest last (army.tickBattle): the defence half of the log of the Lều họp chiến. */
  readonly battleLog: BattleRecord[] = [];
  /** The summaries of past fights, newest last. */
  readonly battleReports: Array<{ at: number; lines: string[] }> = [];
  nextAid = 1;
  /** Test switches driven by the dev menu; all off in a normal game. */
  readonly dev = { freeBuild: false, instantBuild: false, god: false, fastWorks: false, freeWorks: false, noTire: false, noArrivals: false };
  /** A tribe that has just surrendered and waits for the player to choose: adopt or tribute. */
  pendingTribe: TribeId | null = null;
  /** Called when something dies (UI refresh hook). */
  onKill?: () => void;
  /** Random stream for animals, tribes and events, so adding them never changes villager stats. */
  readonly frnd: Rng;
  acc = 0;
  fogDirty = true;
  nextVid = 1;
  nextBid = 1;
  readonly rnd: Rng;
  leaderClock = 0;
  /** Seconds since the tribes were last looked after (they are tended once a second). */
  tribeClock = 0;
  /** The day the next event of the recurring kind is set (tribes.seasonEvent). */
  nextEventDay = 0;
  lastFullWarn = -999;
  lastMatWarn = -999;
  /** Today's and tomorrow's weather (tomorrow is rolled ahead so it can be foretold). */
  weather: WeatherKind = 'clear';
  nextWeather: WeatherKind = 'clear';
  /** The weather of the day, and the game times between which it lasts (it does not last the day: see environment.tickCalendar); `weather` is what is on now. */
  dayWeather: WeatherKind = 'clear';
  weatherAt = 0;
  weatherEnd = 0;
  readonly wrnd: Rng;
  lastDay = 1;
  signalled = false;
  resting = false;
  lastVision = -1;
  /** Food in the pot of the campfire: the meal of the coming end of day, filled before the store (see economy.feedPot). */
  foodPot = 0;
  /** How much the whole village is weakened today for going short at the last meal (0..FOOD.maxPenalty). */
  foodPenalty = 0;
  /** When the war that is on began (seconds of game time); -1 in peace. The meals of those days are paid when it ends (economy.eatWar). */
  warSince = -1;
  /** War sound: whether enough of our soldiers have seen the enemy and are attacking (the sting plays each time it turns on), when that was last true, and when it was last worked out. Reset when the war ends. */
  /** Sounds waiting for the UI (a blow landed, an arrow hit): the renderer plays and empties them. Never saved. */
  /** Warnings for the sound (a pack of wolves comes, a village raids us): the UI plays and empties them. Never saved. */
  alerts: Array<'wolf' | 'raid'> = [];
  addAlert(kind: 'wolf' | 'raid'): void { if (this.alerts.length < 8) this.alerts.push(kind); }
  sfx: Array<{ weapon: string; ranged: boolean; x: number; y: number }> = [];
  /** War sound: the soldiers that have seen the enemy so far, how many of them are not yet counted into a sting, and how many stings have been due. */
  warSeenIds = new Set<number>();
  warFresh = 0;
  warStings = 0;
  warCheckAt = 0;
  /** While a war is on: the soldiers of the plan, how their march goes (speed, food and energy factors) and the meals they and the village have eaten (paid when it ends). All reset in peace. */
  warIds = new Set<number>();
  march: warmarch.March = warmarch.PEACE;
  warMeals = 0;
  /** 0..1: the share of the army's meals the packs could not give, smoothed (warsupply.eatPacks). */
  warHunger = 0;
  /** The middle of the army while a war is on, and when the next band is sent to harass it (-1: none planned). */
  warFocus: { x: number; y: number } | null = null;
  warHarassAt = -1;
  /** What the camera sees plus a margin (tiles), set by the screen each frame; null: everything counts as seen. Only drawing and animation look at it, never the rules. */
  view: { x0: number; y0: number; x1: number; y1: number } | null = null;
  /** Food that came in today, and the total (pot + store) seen last tick (-1: not yet); the incomes of the last three days. Only to tell the player what the village earns. */
  foodIncome = 0;
  foodSeen = -1;
  readonly foodDays: number[] = [];
  /** What the gatherers of each trade ('wood', 'stone', 'food', 'hunt', 'farm') brought in today and yesterday, for the card of their house. */
  /** The highest level a house of each kind had when it fell in battle: a new one of that kind is raised at that level (paying for the levels), not from level 1. */
  readonly ruins: Partial<Record<BuildingKind, number>> = {};
  /** How much of the map of a village ("tribe:level") scouts brought home unfinished, 0..1: the next scouts go on from there. */
  readonly drafts: Record<string, number> = {};
  /** The villagers the player has selected right now (the controller shares its own set): while one of them walks to a spot the player picked, nothing else decides for him. */
  controlled: ReadonlySet<number> = new Set<number>();
  /** True for a selected villager who is on his way to a spot the player ordered: the fighting and fleeing of the brain wait until he gets there or is let go. */
  underOrders(v: Villager): boolean { return v.team === 'player' && (this.controlled.has(v.id) || !!v.fight.obey) && v.phase === 'move' && v.path.length > 0; }
  readonly yieldNow: Record<string, number> = {};
  readonly yieldPrev: Record<string, number> = {};

  constructor(readonly seed = 1337) {
    this.world = new World(seed);
    this.fog = new Fog(this.world);
    // every stream starts from its own mixed seed: neighbouring seeds do not give neighbouring dice
    this.rnd = mulberry32(mix32(seed ^ 0x9e3779b9));
    this.frnd = mulberry32(mix32(seed ^ 0x7f4a7c15));
    this.wrnd = mulberry32(mix32(seed ^ 0x5bd1e995));
    RES_NAME.coin = CURRENCY[this.era];
    this.researched.add('torch1'); // fire is known from the first day: torches can be made as soon as there is a craft house
    this.world.setSeason(this.season);
    this.nextWeather = rollWeather(seasonOf(this.day + 1), this.wrnd());
    this.resting = isRestTime(this.tod, this.season);
    const s = this.world.start;
    this.addBuilding('campfire', s.x + startJson.campfire.dx, s.y + startJson.campfire.dy, true);
    for (const [res, n] of Object.entries(startJson.stock)) this.stock[res as Res] = n; // the first meals of those who start
    for (const p of startJson.villagers) this.spawn(s.x + p.dx, s.y + p.dy, p.sex as Sex).job = p.job as Job;
    this.say('Hai người đầu tiên đã đến bên đống lửa: một người hái lượm, một người đốn gỗ. Việc của mỗi người do công trình của nghề đó quản lý: mở Nông trại, Xưởng gỗ hay Xưởng đá cạnh đống lửa để giao việc. Dựng Nhà thợ xây trước, rồi các công trình khác.');
    this.refreshFog();
    construction.placeStarters(this);
    // the herds of the land made so far, and of every chunk made from now on
    for (const [cx, cy] of this.world.readyChunks()) populateChunk(this, cx, cy);
    this.world.onChunk = (cx, cy) => populateChunk(this, cx, cy);
    spawnTribes(this);
  }

  // ---------------------------------------------------------------- tiện ích
  /** Seconds in a day of the era (data/time.json). */
  get dayLen(): number { return dayLength(this.era); }
  /** Work seconds that pass per game second (a day of labour is one game day, whatever the day lasts). */
  get paceWork(): number { return paceWork(this.dayLen); }
  get day(): number { return this.dayBase + Math.floor((this.time - this.timeBase) / this.dayLen) + 1; }
  /** 0..1 trong ngày: 0 = nửa đêm trước bình minh, 0.5 = giữa trưa. */
  get tod(): number { const len = this.dayLen, t = (this.time - this.timeBase) % len; return (t < 0 ? t + len : t) / len; }
  /** The era changes and with it the length of a day: the day count and the time of day go on from where they were. */
  setDayLength(era: Era): void {
    const day = this.day, tod = this.tod;
    this.era = era;
    this.dayBase = day - 1; this.timeBase = this.time - tod * this.dayLen;
  }
  get season(): Season { return seasonOf(this.day); }
  /** Light 0..1 from time of day and the season's day length. */
  get light(): number { return lightAt(this.tod, this.season); }
  /** Độ tối ban đêm 0..1 (dùng để phủ màu). */
  get darkness(): number { return 1 - this.light; }
  get part(): DayPart { return dayPart(this.tod, this.season); }
  /** Rest hours: mid-dusk to mid-dawn. */
  get restTime(): boolean { return this.resting; }
  // ---------------------------------------------------------------- energy, shifts and torches
  /** → rest.sleepLocked */
  sleepLocked(v: Villager): boolean { return rest.sleepLocked(this, v); }
  /** → rest.callUp */
  callUp(v: Villager): boolean { return rest.callUp(this, v); }
  /** → rest.returnTorch */
  returnTorch(v: Villager): void { rest.returnTorch(this, v); }
  /** → rest.giveTorch */
  giveTorch(ids: readonly number[]): string | null { return rest.giveTorch(this, ids); }
  /** → rest.torchCount */
  torchCount(): number { return rest.torchCount(this); }
  /** → rest.restFactor */
  restFactor(v: Villager): number { return rest.restFactor(this, v); }
  /** → rest.shouldSleep */
  shouldSleep(v: Villager, fighting: boolean): boolean { return rest.shouldSleep(this, v, fighting); }
  /** → rest.tickEnergy */
  tickEnergy(v: Villager, dt: number): void { rest.tickEnergy(this, v, dt); }
  /** Is the point (tiles) where the camera looks (with its margin)? */
  inView(x: number, y: number): boolean { const w = this.view; return !w || (x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1); }
  /** How much an exhausted soldier of the army is weakened (0..): energy below `tired.below` takes up to `tired.maxPenalty` off his stats. */
  tiredPenalty(v: Villager): number { if (!this.warIds.has(v.id)) return 0; const k = warmarch.WAR_DATA.tired; return v.energy < k.below ? k.maxPenalty * (1 - v.energy / k.below) : 0; }
  /** → warscene.warScene: the state of the war for the music */
  warScene(): warscene.WarState { return warscene.warScene(this); }
  /** A blow of `weapon` landed at (x, y): the UI plays the sound of that weapon. */
  addSfx(weapon: string, ranged: boolean, x: number, y: number): void { if (this.sfx.length < 48) this.sfx.push({ weapon, ranged, x, y }); }
  /** → warmode.warPlan: a war is on */
  atWar(): boolean { return !!warmode.warPlan(this); }
  /** → villagers.goHome */
  goHome(v: Villager): void { return villagers.goHome(this, v); }
  /** → roles.warLock */
  warLock(): string | null { return roles.warLock(this); }
  /** → roles.assignRole */
  assignRole(ids: readonly number[], role: RoleId): string | null { return roles.assignRole(this, ids, role); }
  /** → roles.releaseRole */
  releaseRole(ids: readonly number[]): string | null { return roles.releaseRole(this, ids); }
  /** → roles.roleCapacity */
  roleCapacity(role: RoleId): number { return roles.roleCapacity(this, role); }
  /** → roles.roleCount */
  roleCount(role: RoleId): number { return roles.roleCount(this, role); }
  /** → tribes.foeBonus: what the strength of a tribe adds to a stat of its people */
  foeBonus(team: string, stat: import('./research').StatId): number { return foeBonus(this, team, stat); }
  /** → power.powerOf for our village */
  power(): power.Power { return power.powerOf(this, this.villagers); }
  /** → power.powerOf for the people of a tribe */
  /** -> tribelod.tribePower (the people in the world and the crowd indoors) */
  tribePower(t: Tribe): power.Power { return tribeLod.tribePower(this, t); }
  /** → roles.trimRoles */
  trimRoles(): void { return roles.trimRoles(this); }
  /** → rest.bedsIn */
  bedsIn(kind: BuildingKind): number { return rest.bedsIn(this, kind); }
  /** → fauna.restock: the land makes up what was taken, once a day */
  restockAnimals(): void { restock(this); }
  /** → rest.attackReason */
  attackReason(): string | null { return rest.attackReason(this); }
  /** → rest.skipNightBlock */
  skipNightBlock(): string | null { return rest.skipNightBlock(this); }
  /** → rest.quartered */
  quartered(v: Villager): boolean { return rest.quartered(this, v); }
  /** → rest.hides */
  hides(v: Villager): boolean { return rest.hides(this, v); }
  /** → rest.freeBed */
  freeBed(v: Villager): Building | undefined { return rest.freeBed(this, v); }
  /** → rest.bedsTaken */
  bedsTaken(b: Building): number { return rest.bedsTaken(this, b); }
  /** Choose when a villager works. */
  setShift(ids: readonly number[], shift: Shift): void { for (const v of this.mine(ids)) v.shift = shift; }
  /** → rest.maxEnergy */
  maxEnergy(v: Villager): number { return rest.maxEnergy(this, v); }

  // ---------------------------------------------------------------- saving
  /** The whole game as plain JSON data (see save.ts). Settings are not in it. */
  toSave(): save.GameSave { return save.toSave(this); }
  /** Replace this game by a saved one; it must be a save of the same world (seed). */
  loadSave(raw: unknown): void { save.applySave(this, save.migrate(raw)); this.fog.invalidate(); } // the drawing of the fog must be redone
  /** A new Sim continuing a saved game. */
  static fromSave(raw: unknown): Sim {
    const data = save.migrate(raw), sim = new Sim(data.seed);
    save.applySave(sim, data);
    return sim;
  }

  /** → environment.visionRadius */
  visionRadius(): number { return environment.visionRadius(this); }
  /** → environment.fireRadius */
  fireRadius(): number { return environment.fireRadius(this); }
  get(id: number): Villager | undefined { return this.byId.get(id); }
  say(text: string): void { this.log.push({ t: this.time, text }); if (this.log.length > 40) this.log.shift(); }

  /** → construction.startLevel */
  startLevel(kind: BuildingKind): number { return construction.startLevel(this, kind); }
  /** → construction.startCost */
  startCost(kind: BuildingKind): Partial<Stock> { return construction.startCost(this, kind); }
  /** → idle.homeKind */
  homeKind(v: Villager): BuildingKind { return idle.homeKind(v); }
  /** → construction.fireLevel */
  fireLevel(): number { return construction.fireLevel(this); }
  /** → construction.fireUpgradeBlock */
  fireUpgradeBlock(level: number): string | null { return construction.fireUpgradeBlock(this, level); }
  /** → construction.capacity */
  capacity(_res?: Res): number { return construction.capacity(this, _res); }
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
  /** → inventory.equipGear */
  equipGear(v: Villager): void { return inventory.equipGear(this, v); }
  /** → inventory.toolCount */
  toolCount(kind: string, tier: number): number { return inventory.toolCount(this, kind, tier); }
  /** → inventory.toolTier */
  toolTier(v: Villager, job: Job): number { return inventory.toolTier(this, v, job); }


  /** → villagers.spawn */
  spawn(x: number, y: number, sex: Sex): Villager { return villagers.spawn(this, x, y, sex); }

  /** → villagers.makeVillager */
  makeVillager(x: number, y: number, sex: Sex, team: Team, rnd: () => number = this.rnd): Villager { return villagers.makeVillager(this, x, y, sex, team, rnd); }

  /** → construction.addBuilding */
  addBuilding(kind: BuildingKind, x: number, y: number, done: boolean): Building { return construction.addBuilding(this, kind, x, y, done); }


  /** → construction.buildingLimit */
  buildingLimit(kind: BuildingKind): number { return construction.buildingLimit(this, kind); }
  /** → construction.buildingLock */
  buildingLock(kind: BuildingKind): string | null { return construction.buildingLock(this, kind); }
  /** → construction.buildingNeeds */
  buildingNeeds(kind: BuildingKind): Array<{ text: string; ok: boolean }> { return construction.buildingNeeds(this, kind); }

  /** → construction.canPlace */
  canPlace(kind: BuildingKind, x: number, y: number): string | null { return construction.canPlace(this, kind, x, y); }

  /** → economy.missing */
  missing(cost: Partial<Stock>): string | null { return economy.missing(this, cost); }

  /** → construction.canUpgrade */
  canUpgrade(b: Building): string | null { return construction.canUpgrade(this, b); }

  /** Dev: building, upgrading and repairing cost nothing (the free-builds switch, or the free-works one). */
  freeCost(): boolean { return this.dev.freeBuild || this.dev.freeWorks; }
  /** → construction.canRepair */
  canRepair(b: Building): string | null { return construction.canRepair(this, b); }
  /** → construction.repairCost */
  repairCost(b: Building): Partial<Stock> { return construction.repairCost(this, b); }
  /** → construction.repairBuilding */
  repairBuilding(id: number): string | null { return construction.repairBuilding(this, id); }

  /** → construction.afterUpgrade */
  afterUpgrade(b: Building): void { return construction.afterUpgrade(this, b); }
  /** → construction.setEra */
  setEra(era: Era): void { return construction.setEra(this, era); }
  /** → construction.upgradeBuilding */
  upgradeBuilding(id: number): string | null { return construction.upgradeBuilding(this, id); }

  /** → construction.placeBuilding */
  placeBuilding(kind: BuildingKind, x: number, y: number): PlaceResult { return construction.placeBuilding(this, kind, x, y); }

  /** → construction.salvage */
  salvage(b: Building): Partial<Stock> { return construction.salvage(this, b); }
  /** → construction.moveFee */
  moveFee(b: Building): Partial<Stock> { return construction.moveFee(this, b); }


  /** → construction.demolishBuilding */
  demolishBuilding(id: number): string | null { return construction.demolishBuilding(this, id); }

  /** → construction.canMove */
  canMove(b: Building, x: number, y: number): string | null { return construction.canMove(this, b, x, y); }
  /** → construction.groupPlan */
  groupPlan(ids: readonly number[], to: { x: number; y: number }, rot: number): ReturnType<typeof construction.groupPlan> { return construction.groupPlan(this, ids, to, rot); }
  /** → construction.canMoveGroup */
  canMoveGroup(ids: readonly number[], to: { x: number; y: number }, rot: number): string | null { return construction.canMoveGroup(this, ids, to, rot); }
  /** → construction.moveGroup */
  moveGroup(ids: readonly number[], to: { x: number; y: number }, rot: number): string | null { return construction.moveGroup(this, ids, to, rot); }
  /** → construction.moveBuilding */
  moveBuilding(id: number, x: number, y: number): string | null { return construction.moveBuilding(this, id, x, y); }

  /** → works.orderDef */
  orderDef(kind: 'research' | 'craft', id: string): { cost: Partial<Stock>; time: number } | null { return works.orderDef(this, kind, id); }
  /** → works.recipeLock */
  recipeLock(id: string): string | null { return works.recipeLock(this, id); }
  /** → works.recipeOpen */
  recipeOpen(id: string): boolean { return works.recipeOpen(this, id); }

  /** → works.techState */
  techState(t: Tech): { state: 'done' | 'active' | 'queued' | 'ready' | 'locked'; why?: string; lacks?: string[] } { return works.techState(this, t); }
  /** → works.researchBlock */
  researchBlock(t: Tech): string | null { return works.researchBlock(this, t); }

  /** → works.currentResearch */
  currentResearch(): string | null { return works.currentResearch(this); }

  /** → works.queueResearch */
  queueResearch(id: string): string | null { return works.queueResearch(this, id); }
  /** → works.researchShort */
  researchShort(t: Tech): string | null { return works.researchShort(this, t); }
  /** → construction.buildWhy */
  buildWhy(b: Building): string | null { return construction.buildWhy(this, b); }
  /** → works.discardGoods */
  discardGoods(id: string, all: boolean): string | null { return works.discardGoods(this, id, all); }
  /** → works.craftStoreBlock */
  craftStoreBlock(id: string): string | null { return works.craftStoreBlock(this, id); }
  /** → works.queueCraft */
  queueCraft(id: string): string | null { return works.queueCraft(this, id); }
  /** → works.craftCost */
  craftCost(id: string): Partial<Stock> { return works.craftCost(this, id); }
  /** → works.unqueueCraft */
  unqueueCraft(id: string): void { return works.unqueueCraft(this, id); }
  /** → works.unqueueResearch */
  unqueueResearch(id: string): void { return works.unqueueResearch(this, id); }

  /** → economy.affordable */
  affordable(cost: Partial<Stock>): boolean { return economy.affordable(this, cost); }
  /** → economy.pay */
  pay(cost: Partial<Stock>, sign = -1): void { return economy.pay(this, cost, sign); }

  /** → works.storeUsed */
  storeUsed(cat: 'tool' | 'gear'): number { return works.storeUsed(this, cat); }
  /** → works.storeCap */
  storeCap(cat: 'tool' | 'gear'): number { return works.storeCap(this, cat); }

  /** → labor.tickFarms */
  tickFarms(dt: number): void { return labor.tickFarms(this, dt); }
  /** → works.tickWorks */
  tickWorks(dt: number): void { return works.tickWorks(this, dt); }

  /** → houses.bestFor */
  bestFor(job: 'craft' | 'research' | 'tame'): Villager | null { return houses.bestFor(this, job); }
  /** → defense.tickTraps */
  tickTraps(dt: number): void { return defense.tickTraps(this, dt); }
  /** → defense.tickTowers */
  tickTowers(dt: number): void { return defense.tickTowers(this, dt); }
  /** → tribes.summonAllies */
  summonAllies(target: Tribe): number { return summonAllies(this, target); }
  /** → tribes.dismissAllies */
  dismissAllies(): void { return dismissAllies(this); }
  /** A person is gone from the village without a trace (an ally who has left): not a death. */
  vanish(v: Villager): void {
    this.leaveNode(v); this.exitBuilding(v); this.leaveSquad([v.id]);
    const i = this.villagers.indexOf(v); if (i >= 0) this.villagers.splice(i, 1);
    this.byId.delete(v.id); this.fogDirty = true;
  }
  /** → environment.settle */
  settle(n: number, room = false): string[] { return environment.settle(this, n, room); }
  /** → environment.toggleNewcomers */
  toggleNewcomers(): boolean { return environment.toggleNewcomers(this); }
  /** → defense.toggleGate */
  toggleGate(id: number): string | null { return defense.toggleGate(this, id); }
  /** → defense.setGates */
  setGates(open: boolean): void { return defense.setGates(this, open); }
  /** → defense.nearestWork */
  nearestWork(x: number, y: number, radius: number, any = false): Building | undefined { return defense.nearestWork(this, x, y, radius, any); }
  /** → defense.damageWork */
  damageWork(b: Building, dmg: number): void { return defense.damageWork(this, b, dmg); }
  /** → defense.towerBonus */
  towerBonus(v: Villager): { damage: number; range: number } { return defense.towerBonus(this, v); }
  /** → defense.garrison */
  garrison(b: Building): Villager[] { return defense.garrison(this, b); }
  /** → defense.assignTower */
  assignTower(ids: readonly number[], towerId: number): string | null { return defense.assignTower(this, ids, towerId); }
  /** → defense.leaveTower */
  leaveTower(ids: readonly number[]): void { return defense.leaveTower(this, ids); }
  /** → construction.destroyBuilding */
  destroyBuilding(b: Building): void { return construction.destroyBuilding(this, b); }
  /** → construction.setOcc */
  setOcc(b: Building, val: number): void { return construction.setOcc(this, b, val); }
  /** → houses.assignField */
  assignField(ids: readonly number[], fieldId: number): string | null { return houses.assignField(this, ids, fieldId); }
  /** → houses.houseRate */
  houseRate(b: Building): number { return houses.houseRate(this, b); }
  /** → houses.staffCount */
  staffCount(b: Building): number { return houses.staffCount(this, b); }
  /** → construction.popCap */
  popCap(): number { return construction.popCap(this); }
  /** → construction.crewSpeed */
  crewSpeed(): number { return construction.crewSpeed(this); }

  /** → houses.crew */
  crew(): Villager[] { return houses.crew(this); }
  /** → houses.assignCrew */
  assignCrew(ids: readonly number[]): string | null { return houses.assignCrew(this, ids); }
  /** → houses.trimCrew */
  trimCrew(): void { return houses.trimCrew(this); }
  /** → houses.releaseCrew */
  releaseCrew(ids: readonly number[]): void { return houses.releaseCrew(this, ids); }

  /** → houses.assignStaff */
  assignStaff(ids: readonly number[], job: 'craft' | 'research' | 'tame'): string | null { return houses.assignStaff(this, ids, job); }
  /** → houses.planStaff */
  planStaff(v: Villager): void { return houses.planStaff(this, v); }
  /** → houses.enterBuilding */
  enterBuilding(v: Villager): void { return houses.enterBuilding(this, v); }
  /** → houses.exitBuilding */
  exitBuilding(v: Villager): void { return houses.exitBuilding(this, v); }
  /** → houses.sleepIn */
  sleepIn(v: Villager, b: Building): void { return houses.sleepIn(this, v, b); }
  /** → houses.sleepers */
  sleepers(b: Building): Villager[] { return houses.sleepers(this, b); }
  /** → houses.releaseStaff */
  releaseStaff(ids: readonly number[]): void { return houses.releaseStaff(this, ids); }

  /** → inventory.heldTool */
  heldTool(v: Villager): { k: ToolKind; t: Tool } | null { return inventory.heldTool(this, v); }
  /** → inventory.returnTool */
  returnTool(v: Villager): void { return inventory.returnTool(this, v); }
  /** → inventory.assignTool */
  assignTool(ids: readonly number[], k: ToolKind, tier: number): string | null { return inventory.assignTool(this, ids, k, tier); }
  /** → inventory.discardTool */
  discardTool(ids: readonly number[], k: ToolKind): void { return inventory.discardTool(this, ids, k); }
  /** → economy.foodNeed */
  foodNeed(): number { return economy.foodNeed(this); }
  /** → readiness.upgradeAdvice */
  upgradeAdvice(level: number): Array<{ text: string; bad: boolean }> { return readiness.upgradeAdvice(this, level, (e) => notices.eventName(this, e)); }
  /** → notices.noticesOf */
  notices(): Notice[] { return notices.noticesOf(this); }
  /** → economy.noteYield */
  noteYield(key: string, n: number): void { return economy.noteYield(this, key, n); }
  /** → economy.warNeed */
  warNeed(): number { return economy.warNeed(this); }
  /** → economy.armyNeed */
  armyNeed(): number { return economy.armyNeed(this); }
  /** → economy.eatDay */
  eatDay(): void { return economy.eatDay(this); }
  /** → economy.deposit */
  deposit(res: Res, amount: number): number { return economy.deposit(this, res, amount); }
  /** → economy.hasRoom */
  hasRoom(res: Res): boolean { return economy.hasRoom(this, res); }
  /** → economy.dailyYield */
  dailyYield(b: Building): { amount: number; people: number } | null { return economy.dailyYield(this, b); }
  /** → economy.barter */
  barter(res: Exclude<Res, 'coin'>): string | null { return economy.barter(this, res); }

  /** → commands.resetTask */
  resetTask(v: Villager): void { return commands.resetTask(this, v); }

  /** → commands.clearCombat */
  clearCombat(v: Villager): void { return commands.clearCombat(this, v); }
  /** → commands.mine */
  mine(ids: readonly number[]): Villager[] { return commands.mine(this, ids); }


  /** → commands.orderMove */
  orderMove(ids: readonly number[], tx: number, ty: number, queue = false): void { return commands.orderMove(this, ids, tx, ty, queue); }

  /** → commands.callWorker */
  callWorker(tx: number, ty: number): { name: string } | { reason: string } { return commands.callWorker(this, tx, ty); }
  /** → commands.orderWork */
  orderWork(ids: readonly number[], tx: number, ty: number): { job: WorkJob; sent: number; err: string | null } | null { return commands.orderWork(this, ids, tx, ty); }
  /** → commands.recallFar */
  recallFar(): number { return commands.recallFar(this); }
  /** → commands.autoHunter */
  autoHunter(ids: readonly number[], target: Target): string | null { return commands.autoHunter(this, ids, target); }

  /** → commands.setJob */
  setJob(ids: readonly number[], job: Job): string | null { return commands.setJob(this, ids, job); }

  /** → commands.enlist */
  enlist(ids: readonly number[]): number { return commands.enlist(this, ids); }

  /** → commands.discharge */
  discharge(ids: readonly number[]): number { return commands.discharge(this, ids); }
  /** → commands.isOut */
  isOut(v: Villager): boolean { return commands.isOut(v); }
  /** → commands.callOut */
  callOut(ids: readonly number[]): number { return commands.callOut(this, ids); }
  /** → commands.sendBack */
  sendBack(ids: readonly number[]): number { return commands.sendBack(this, ids); }

  /** → commands.targetAt */
  targetAt(x: number, y: number): { target: Target; kind: 'foe' | 'animal' | 'carcass' } | null { return commands.targetAt(this, x, y); }

  /** → commands.orderAttack */
  orderAttack(ids: readonly number[], target: Target, queue = false): number { return commands.orderAttack(this, ids, target, queue); }

  /** → commands.orderAttackMove */
  orderAttackMove(ids: readonly number[], x: number, y: number, queue = false): void { return commands.orderAttackMove(this, ids, x, y, queue); }

  /** → commands.orderLoot */
  orderLoot(ids: readonly number[], animalId: number): number { return commands.orderLoot(this, ids, animalId); }

  /** → commands.orderHold */
  orderHold(ids: readonly number[]): void { return commands.orderHold(this, ids); }

  /** → commands.orderStop */
  orderStop(ids: readonly number[]): void { return commands.orderStop(this, ids); }

  /** → commands.setStance */
  setStance(ids: readonly number[], stance: 'aggressive' | 'defensive' | 'retreat'): void { return commands.setStance(this, ids, stance); }

  /** → commands.nextOrder */
  nextOrder(v: Villager): boolean { return commands.nextOrder(this, v); }
  /** → brainplayer.startFlee */
  startFlee(v: Villager, secs: number, from?: { x: number; y: number }): void { brainplayer.startFlee(this, v, secs, from); }
  /** → brainplayer.endOrder */
  endOrder(v: Villager): void { brainplayer.endOrder(this, v); }

  /** → inventory.giveGear */
  giveGear(ids: readonly number[], kind: string | null, slot: 'weapon' | 'armor'): void { return inventory.giveGear(this, ids, kind, slot); }

  /** → inventory.assignGear */
  assignGear(ids: readonly number[], kind: string | null, slot: 'weapon' | 'armor'): string | null { return inventory.assignGear(this, ids, kind, slot); }
  /** → inventory.autoGear */
  autoGear(ids: readonly number[]): string | null { return inventory.autoGear(this, ids); }

  /** → inventory.giveTool */
  giveTool(ids: readonly number[], kind: ToolKind, tier: number): void { return inventory.giveTool(this, ids, kind, tier); }

  /** → movement.nearestFree */
  nearestFree(tx: number, ty: number, taken: Set<number>): [number, number] | null { return movement.nearestFree(this, tx, ty, taken); }

  /** → environment.refreshFog */
  refreshFog(): void { return environment.refreshFog(this); }

  /** Gọi mỗi khung hình với dt thực; chạy theo bước cố định, nhân với hệ số tốc độ. */
  advance(dt: number, outOfTime?: () => boolean): void {
    if (this.speed <= 0) return;
    this.acc += Math.min(dt, 0.25) * this.speed;
    let guard = 0;
    while (this.acc >= TICK && guard++ < 400) {
      this.acc -= TICK; this.tick(TICK);
      if (outOfTime?.()) { this.acc = Math.min(this.acc, TICK); break; } // the machine cannot keep up: the game runs slower for a moment rather than freezing (the screen asks; no clock in the simulation)
    }
  }

  tick(dt: number): void {
    this.time += dt;
    this.pathLeft = this.speed >= 8 ? Math.ceil(PATH_BUDGET / 2) : PATH_BUDGET; // fast-forward: fewer searches for a way each tick (a unit waits a tick longer; the ticks are many)
    this.tickCalendar();
    this.world.tick(dt);
    this.streamWorld(dt);
    economy.feedPot(this); economy.trackFood(this);
    // war mode (warmode.ts): clock, weather and food go on; everything else stands still but the war
    if (warmode.warPlan(this)) {
      if (this.warSince < 0) this.warSince = this.time;
      this.tickWar(dt);
      if (this.visionRadius() !== this.lastVision) this.fogDirty = true;
      if (this.fogDirty) { this.fogDirty = false; this.refreshFog(); }
      return;
    }
    // the war is over: whoever lay out of sight (in a field tent, or with no bed) gets up and goes to bed in the right place
    if (this.warSince >= 0) { warsupply.settle(this); warlog.finish(this, this.warMeals); warharass.clearHarass(this); economy.eatWar(this, (this.time - this.warSince) / this.dayLen); this.warSince = -1; restoreWarAnimals(this); this.sendBack([...this.warIds]); /* orders in the war took the army out of its camps: back in they go */ this.warIds = new Set(); warquick.cleanup(this); for (const v of this.villagers) if (v.inTent) { v.inTent = false; if (v.inside === null) { v.phase = 'idle'; v.path = []; v.slide = null; v.bed = -1; } } this.march = warmarch.PEACE; this.warMeals = 0; this.warSeenIds.clear(); this.warFresh = 0; this.warStings = 0; this.warCheckAt = 0; }
    tickAnimals(this, dt); tickProjectiles(this, dt);
    for (const v of [...this.villagers]) this.tickVillager(v, dt);
    this.tickWorks(dt); this.tickTame(dt); this.tickFarms(dt); this.tickTowers(dt); this.tickTraps(dt); army.tickTraining(this, dt); army.tickBattle(this, dt); scouting.tickScouts(this, dt); warplan.tickPlans(this, dt);
    this.pathLeft = Math.max(this.pathLeft, FOE_PATH_SHARE);
    for (const f of [...this.foes]) tickFoe(this, f, dt);
    tickTribes(this, dt);
    this.leaderClock += dt;
    if (this.leaderClock >= 1) { this.leaderClock = 0; this.pickLeaders(); houses.bootCrew(this); defense.tickResearch(this); inventory.restock(this); mounts.fitScouts(this); }
    if (this.visionRadius() !== this.lastVision) this.fogDirty = true;
    if (this.fogDirty) { this.fogDirty = false; this.refreshFog(); }
  }

  private streamClock = 0;
  /** Make the land round the people as they walk out: twice a second, every villager out on the map has the land within STREAM_REACH made (see World.ensure). */
  private streamWorld(dt: number): void {
    this.streamClock -= dt;
    if (this.streamClock > 0) return;
    this.streamClock = 0.5;
    for (const v of this.villagers) if (v.inside === null) this.world.ensure(v.x, v.y, STREAM_REACH);
  }

  /** → environment.tickCalendar */
  tickCalendar(): void { return environment.tickCalendar(this); }

  /** → villagers.tickVillager */
  tickVillager(v: Villager, dt: number): void { return villagers.tickVillager(this, v, dt); }

  /** → movement.moveUnit */
  moveUnit(v: Villager, dt: number): void { return movement.moveUnit(this, v, dt); }

  /** → movement.animate */
  animate(v: Villager, dt: number): void { return movement.animate(this, v, dt); }


  kill(v: Villager, cause = 'vì đói'): void {
    warlog.noteDeath(this, v.id, v.job === 'supply', armOf(v));
    if (v.job === 'scout') this.noteScoutLoss(v, cause);
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
    v.team = 'player'; v.ai = null; v.job = 'idle'; v.phase = 'idle'; v.path = []; v.leader = false; v.fleeT = 0;
    this.clearCombat(v); v.health = Math.max(v.health, v.maxHealth * 0.6);
    this.villagers.push(v); this.fogDirty = true;
  }
  /** -> tribes.resetTribes */
  resetTribes(): void { return resetTribes(this); }
  /** Diplomacy buttons: 'gift', 'tribute', 'adopt'. Returns an error text or null. */
  diplomacy(id: TribeId, action: 'gift' | 'tribute' | 'adopt' | 'tributeUp' | 'tributeDown'): string | null {
    return action === 'gift' ? giftTribe(this, id) : action === 'tribute' ? tributeTribe(this, id) : action === 'tributeUp' ? setTribute(this, id, 1) : action === 'tributeDown' ? setTribute(this, id, -1) : adoptTribe(this, id);
  }

  // ---------------------------------------------------------------- combat helpers
  hurt(target: Target, dmg: number, type: 'pierce' | 'slash' | 'crush', from: { x: number; y: number }, src: { unit?: Villager; animal?: Animal }): void {
    hurt(this, target, dmg, type, from, src);
  }
  tribeHostile(id: Team): boolean { return tribeHostile(this, id); }
  /** → tribes.tribeWilling */
  tribeWilling(id: Team): boolean { return tribeWilling(this, id); }
  /** → tribes.tribesFeud */
  tribesFeud(a: Team, b: Team): boolean { return tribesFeud(this, a, b); }
  tribeAttacked(id: Exclude<Team, 'player' | 'wild'>, victim: Villager): void { tribeAttacked(this, id, victim); }
  killFoe(v: Villager, killer?: Villager): void { killFoe(this, v, killer); }
  /** The player's own campfire (the village centre). */
  /** → quests.questViews */
  quests(ui: QuestUi): QuestView[] { return questViews(this, ui); }
  campfire(): Building | undefined { return this.buildings.find((b) => b.kind === 'campfire' && b.done); }
  /** Another fighter within 7 tiles of the animal: a boar is only worth attacking in a group. */
  packNear(v: Villager, a: Animal): boolean {
    return this.villagers.some((o) => o !== v && o.health > 0 && o.down <= 0 && (o.job === 'hunt' || o.job === 'fight') && Math.hypot(o.x - a.x, o.y - a.y) < 7);
  }
  /** → villagers.pickLeaders */
  pickLeaders(): void { return villagers.pickLeaders(this); }
  /** → labor.workRate */
  workRate(v: Villager, job: WorkJob): number { return labor.workRate(this, v, job); }
  /** → labor.workFactor */
  workFactor(v: Villager, job: WorkJob): number { return labor.workFactor(this, v, job); }

  /** → labor.gainXp */
  gainXp(v: Villager, job: WorkJob, dt: number): void { return labor.gainXp(this, v, job, dt); }


  /** → labor.leaveNode */
  leaveNode(v: Villager): void { return labor.leaveNode(this, v); }

  /** → labor.face */
  face(v: Villager, tx: number, ty: number): void { return labor.face(this, v, tx, ty); }

  /** → labor.wait */
  wait(v: Villager, secs: number): void { return labor.wait(this, v, secs); }




  /** → labor.faceBuilding */
  faceBuilding(v: Villager, b: Building): void { return labor.faceBuilding(this, v, b); }

  /** → labor.think */
  think(v: Villager, dt: number): void { return labor.think(this, v, dt); }



  /** → inventory.toolLacking */
  toolLacking(v: Villager, job: WorkJob): boolean { return inventory.toolLacking(this, v, job); }
  /** → inventory.needTool */
  needTool(v: Villager, job: WorkJob): boolean { return inventory.needTool(this, v, job); }


  /** → inventory.planTool */
  planTool(v: Villager, job: WorkJob): boolean { return inventory.planTool(this, v, job); }

  /** → inventory.errand */
  errand(v: Villager): void { return inventory.errand(this, v); }

  /** → inventory.equip */
  equip(v: Villager): void { return inventory.equip(this, v); }

  /** → inventory.wearGear */
  wearGear(v: Villager, slot: 'weapon' | 'armor'): void { return inventory.wearGear(this, v, slot); }
  /** → inventory.planEquipGear */
  planEquipGear(v: Villager): boolean { return inventory.planEquipGear(this, v); }
  /** → inventory.planGearErrand */
  planGearErrand(v: Villager): boolean { return inventory.planGearErrand(this, v); }

  /** → movement.ringTiles */
  ringTiles(v: Villager, x: number, y: number, w: number, h: number): Array<[number, number]> { return movement.ringTiles(this, v, x, y, w, h); }


  /** → movement.pathTo */
  pathTo(v: Villager, gx: number, gy: number, maxNodes = 14000): Step[] { return movement.pathTo(this, v, gx, gy, maxNodes); }

  /** → movement.routeTo */
  routeTo(v: Villager, tiles: Array<[number, number]>, tries = 3, maxNodes = 14000): number { return movement.routeTo(this, v, tiles, tries, maxNodes); }


  /** → labor.planDeliver */
  planDeliver(v: Villager): void { return labor.planDeliver(this, v); }

  /** → labor.stash */
  stash(v: Villager): void { return labor.stash(this, v); }


}

/** The war methods (squads, formations, scouting, plans) live in simwar.ts and are added here. */
export interface Sim extends WarApi {}
Object.assign(Sim.prototype, WAR);
