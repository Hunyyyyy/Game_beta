import { DayPart, dayPart, isRestTime, lightAt, rollWeather, Season, seasonOf, WeatherKind } from './calendar';
import { DAY_LENGTH, PATH_BUDGET, START_TIME, TICK } from './constants';
import { Building, BuildingKind, BUILDINGS, Era } from './buildings';
import { Fog } from './fog';
import { Job, RoleId, WorkJob } from './jobs';
import { Step } from './path';
import { CURRENCY, emptyStock, Res, RES_NAME, Stock } from './resources';
import { mulberry32, Rng } from './rng';
import { Tool, ToolKind } from './tools';
import { Team, TribeId } from './combat';
import { hurt, tickMorale, tickProjectiles } from './battle';
import { Animal, populate, tickAnimals } from './fauna';
import { adoptTribe, EventState, giftTribe, killFoe, spawnTribes, tickFoe, tickTribes, Tribe, tribeAttacked, tribeHostile, tributeTribe } from './tribes';
import { recipeOpen, Tech } from './research';
import { World } from './world';
import * as construction from './construction';
import * as economy from './economy';
import * as works from './works';
import * as houses from './houses';
import * as inventory from './inventory';
import * as commands from './commands';
import * as labor from './labor';
import * as movement from './movement';
import * as villagers from './villagers';
import * as environment from './environment';
import * as save from './save';
import * as rest from './rest';
import * as roles from './roles';
import * as defense from './defense';
import * as army from './army';
import * as scouting from './scouting';
import * as warplan from './warplan';
import { WAR, WarApi } from './simwar';
import { BattleState, CardKind, FormationName, LogLine, Objective, PlaceResult, Plan, Projectile, ScoutMap, ScoutMission, Sex, Sighting, Shift, Squad, Target, Villager } from './model';
import type { Ent } from './battle';
export * from './model';

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
  /** Research (tech ids) waiting for a free researcher in the Nhà nghiên cứu. */
  readonly researchQueue: string[] = [];
  /** Tools waiting to be mended in the Nhà sửa chữa (recipe ids such as axe1). */
  readonly repairQueue: string[] = [];
  coinFrac = 0;
  sawCoin = false;
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
  readonly animals: Animal[] = [];
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
  nextPlan = 1;
  /** Game seconds until which the alarm drum is sounding (0 = quiet). */
  alarmUntil = 0;
  readonly battle: BattleState = { on: false, since: 0, quiet: 0, ourDead: 0, foeDead: 0, breaches: 0, shots: 0, notes: [] };
  /** The summaries of past fights, newest last. */
  readonly battleReports: Array<{ at: number; lines: string[] }> = [];
  nextAid = 1;
  /** Test switches driven by the dev menu; all off in a normal game. */
  readonly dev = { freeBuild: false, instantBuild: false, god: false, noHunger: false, fastWorks: false, noTire: false };
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
  moraleClock = 0;
  /** Seconds since the tribes were last looked after (they are tended once a second). */
  tribeClock = 0;
  lastFullWarn = -999;
  lastMatWarn = -999;
  /** Today's and tomorrow's weather (tomorrow is rolled ahead so it can be foretold). */
  weather: WeatherKind = 'clear';
  nextWeather: WeatherKind = 'clear';
  readonly wrnd: Rng;
  lastDay = 1;
  signalled = false;
  resting = false;
  lastVision = -1;
  /** Stored food split into lots, oldest eaten first; each lot has an expiry time. */
  readonly foodLots: Array<{ amount: number; exp: number }> = [];

  constructor(readonly seed = 1337) {
    this.world = new World(seed);
    this.fog = new Fog(this.world);
    this.rnd = mulberry32(seed ^ 0x9e3779b9);
    this.frnd = mulberry32(seed ^ 0x7f4a7c15);
    this.wrnd = mulberry32(seed ^ 0x5bd1e995);
    RES_NAME.coin = CURRENCY[this.era];
    this.researched.add('torch1'); // fire is known from the first day: torches can be made as soon as there is a craft house
    this.world.setSeason(this.season);
    this.nextWeather = rollWeather(seasonOf(this.day + 1), this.wrnd());
    this.resting = isRestTime(this.tod, this.season);
    const s = this.world.start;
    this.addBuilding('campfire', s.x - 1, s.y - 2, true);
    this.stock.food = 20; // enough for two people for two days
    // two villagers to start: a gatherer, whose work feeds both of them, and a woodcutter
    const spots: Array<[number, number, Sex, Job]> = [[-1, 1, 'm', 'food'], [1, 1, 'f', 'wood']];
    for (const [dx, dy, sex, job] of spots) this.spawn(s.x + dx, s.y + dy, sex).job = job;
    this.say('Hai người đầu tiên đã đến bên đống lửa: một người hái lượm, một người đốn gỗ. Việc của mỗi người do công trình của nghề đó quản lý: mở Nông trại, Xưởng gỗ hay Xưởng đá cạnh đống lửa để giao việc. Dựng Nhà thợ xây trước, rồi các công trình khác.');
    this.refreshFog();
    construction.placeStarters(this);
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
  /** → roles.trimRoles */
  trimRoles(): void { return roles.trimRoles(this); }
  /** → rest.bedsIn */
  bedsIn(kind: rest.BedKind): number { return rest.bedsIn(this, kind); }
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
  loadSave(raw: unknown): void { save.applySave(this, save.migrate(raw)); this.fog.version++; } // the drawing of the fog must be redone
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
  /** → economy.foodSpoilingWithin */
  foodSpoilingWithin(secs: number): number { return economy.foodSpoilingWithin(this, secs); }
  get(id: number): Villager | undefined { return this.byId.get(id); }
  say(text: string): void { this.log.push({ t: this.time, text }); if (this.log.length > 40) this.log.shift(); }

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

  /** → construction.canPlace */
  canPlace(kind: BuildingKind, x: number, y: number): string | null { return construction.canPlace(this, kind, x, y); }

  /** → economy.missing */
  missing(cost: Partial<Stock>): string | null { return economy.missing(this, cost); }

  /** → construction.canUpgrade */
  canUpgrade(b: Building): string | null { return construction.canUpgrade(this, b); }

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
  /** → construction.moveBuilding */
  moveBuilding(id: number, x: number, y: number): string | null { return construction.moveBuilding(this, id, x, y); }

  /** → works.orderDef */
  orderDef(kind: 'research' | 'craft' | 'repair', id: string): { cost: Partial<Stock>; time: number } | null { return works.orderDef(this, kind, id); }
  /** → works.bestIntInside */
  bestIntInside(b: Building): number { return works.bestIntInside(this, b); }
  /** → works.recipeLock */
  recipeLock(id: string): string | null { return works.recipeLock(this, id); }
  /** → works.recipeOpen */
  recipeOpen(id: string): boolean { return works.recipeOpen(this, id); }

  /** → works.techState */
  techState(t: Tech): { state: 'done' | 'active' | 'queued' | 'ready' | 'locked'; why?: string } { return works.techState(this, t); }
  /** → works.researchBlock */
  researchBlock(t: Tech): string | null { return works.researchBlock(this, t); }

  /** → works.currentResearch */
  currentResearch(): string | null { return works.currentResearch(this); }

  /** → works.queueResearch */
  queueResearch(id: string): string | null { return works.queueResearch(this, id); }
  /** → works.researchShort */
  researchShort(t: Tech): string | null { return works.researchShort(this, t); }
  /** → works.queueCraft */
  queueCraft(id: string): string | null { return works.queueCraft(this, id); }
  /** → works.queueRepair */
  queueRepair(id: string): string | null { return works.queueRepair(this, id); }
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
  bestFor(job: 'craft' | 'research' | 'repair'): Villager | null { return houses.bestFor(this, job); }
  /** → defense.tickTraps */
  tickTraps(dt: number): void { return defense.tickTraps(this, dt); }
  /** → defense.tickTowers */
  tickTowers(dt: number): void { return defense.tickTowers(this, dt); }
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
  assignStaff(ids: readonly number[], job: 'craft' | 'research' | 'repair'): string | null { return houses.assignStaff(this, ids, job); }
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
  /** → inventory.repairTool */
  repairTool(ids: readonly number[], k: ToolKind): string | null { return inventory.repairTool(this, ids, k); }
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

  /** → commands.orderWork */
  orderWork(ids: readonly number[], tx: number, ty: number): { job: WorkJob; sent: number } | null { return commands.orderWork(this, ids, tx, ty); }

  /** → commands.setJob */
  setJob(ids: readonly number[], job: Job): string | null { return commands.setJob(this, ids, job); }

  /** → commands.enlist */
  enlist(ids: readonly number[]): number { return commands.enlist(this, ids); }

  /** → commands.discharge */
  discharge(ids: readonly number[]): number { return commands.discharge(this, ids); }

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

  /** → inventory.giveGear */
  giveGear(ids: readonly number[], kind: string | null, slot: 'weapon' | 'armor'): void { return inventory.giveGear(this, ids, kind, slot); }

  /** → inventory.assignGear */
  assignGear(ids: readonly number[], kind: string | null, slot: 'weapon' | 'armor'): string | null { return inventory.assignGear(this, ids, kind, slot); }
  /** → inventory.autoGear */
  autoGear(ids: readonly number[]): void { return inventory.autoGear(this, ids); }

  /** → inventory.giveTool */
  giveTool(ids: readonly number[], kind: ToolKind, tier: number): void { return inventory.giveTool(this, ids, kind, tier); }

  /** → movement.nearestFree */
  nearestFree(tx: number, ty: number, taken: Set<number>): [number, number] | null { return movement.nearestFree(this, tx, ty, taken); }

  /** → environment.refreshFog */
  refreshFog(): void { return environment.refreshFog(this); }

  /** Gọi mỗi khung hình với dt thực; chạy theo bước cố định, nhân với hệ số tốc độ. */
  advance(dt: number): void {
    if (this.speed <= 0) return;
    this.acc += Math.min(dt, 0.25) * this.speed;
    let guard = 0;
    while (this.acc >= TICK && guard++ < 400) { this.acc -= TICK; this.tick(TICK); }
  }

  tick(dt: number): void {
    this.time += dt;
    this.pathLeft = PATH_BUDGET;
    this.tickCalendar();
    this.world.tick(dt);
    this.syncFood();
    tickAnimals(this, dt); tickProjectiles(this, dt);
    for (const v of [...this.villagers]) this.tickVillager(v, dt);
    this.tickWorks(dt); this.tickFarms(dt); this.tickTowers(dt); this.tickTraps(dt); army.tickTraining(this, dt); army.tickBattle(this, dt); scouting.tickScouts(this, dt); warplan.tickPlans(this, dt);
    for (const f of [...this.foes]) tickFoe(this, f, dt);
    tickTribes(this, dt);
    this.moraleClock += dt;
    if (this.moraleClock >= 1) { this.moraleClock = 0; for (const v of this.villagers) if (v.down <= 0) tickMorale(this, v); this.pickLeaders(); }
    if (this.visionRadius() !== this.lastVision) this.fogDirty = true;
    if (this.fogDirty) { this.fogDirty = false; this.refreshFog(); }
  }

  /** → environment.tickCalendar */
  tickCalendar(): void { return environment.tickCalendar(this); }

  /** → economy.syncFood */
  syncFood(): void { return economy.syncFood(this); }

  /** → villagers.tickVillager */
  tickVillager(v: Villager, dt: number): void { return villagers.tickVillager(this, v, dt); }

  /** → movement.moveUnit */
  moveUnit(v: Villager, dt: number): void { return movement.moveUnit(this, v, dt); }

  /** → movement.animate */
  animate(v: Villager, dt: number): void { return movement.animate(this, v, dt); }


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
  /** → inventory.planGearRepair */
  planGearRepair(v: Villager): boolean { return inventory.planGearRepair(this, v); }
  /** → inventory.planEquipGear */
  planEquipGear(v: Villager): boolean { return inventory.planEquipGear(this, v); }
  /** → inventory.planGearErrand */
  planGearErrand(v: Villager): boolean { return inventory.planGearErrand(this, v); }

  /** → movement.ringTiles */
  ringTiles(v: Villager, x: number, y: number, w: number, h: number): Array<[number, number]> { return movement.ringTiles(this, v, x, y, w, h); }


  /** → movement.pathTo */
  pathTo(v: Villager, gx: number, gy: number, maxNodes = 14000): Step[] { return movement.pathTo(this, v, gx, gy, maxNodes); }

  /** → movement.routeTo */
  routeTo(v: Villager, tiles: Array<[number, number]>, tries = 3): number { return movement.routeTo(this, v, tiles, tries); }


  /** → labor.planDeliver */
  planDeliver(v: Villager): void { return labor.planDeliver(this, v); }

  /** → labor.stash */
  stash(v: Villager): void { return labor.stash(this, v); }


}

/** The war methods (squads, formations, scouting, plans) live in simwar.ts and are added here. */
export interface Sim extends WarApi {}
Object.assign(Sim.prototype, WAR);
