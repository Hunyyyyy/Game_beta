/** The war half of the Sim facade: squads, formations, scouting and plans (and, as it grew, training). Kept apart so sim.ts stays within its size; sim.ts mixes it in. */
import * as army from './army';
import * as forecast from './forecast';
import * as scouting from './scouting';
import { tickWarAnimals } from './fauna';
import * as siege from './siege';
import { sightOf } from './environment';
import * as training from './training';
import * as mounts from './mounts';
import * as research from './research';
import { tickFoe } from './brainfoe';
import { surrender, tickTribes, tribeOf } from './tribes';
import * as warmode from './warmode';
import * as warmarch from './warmarch';
import * as warsupply from './warsupply';
import * as wartent from './wartent';
import * as warharass from './warharass';
import * as warlog from './warlog';
import type { Res } from './resources';
import { FOE_PATH_SHARE } from './constants';
import * as warplan from './warplan';
import * as warquick from './warquick';
import * as warskirmish from './warskirmish';
import { armOf, tickProjectiles } from './battle';
import type { Ent } from './battle';
import type { Building } from './buildings';
import type { MountKind, StatKey } from './jobs';
import type { Arm, FormationId } from './formations';
import type { ScoutFlow } from './scouting';
import type { CardKind, RouteTime, Forecast, FormationName, Mission, MissionTarget, Objective, Obstacle, Plan, Pt, ScoutMap, ScoutPlan, Squad, TribeIntel, Villager } from './model';
import type { Sim } from './sim';

export const WAR = {
  /** One tick while a war is on (warmode.ts): only the army, the scouts out, the arrows in the air and the village under attack are worked; everyone else goes home and stands still. */
  tickWar(this: Sim, dt: number): void {
    tickProjectiles(this, dt); tickWarAnimals(this, dt);
    const soldiers = warmode.army(this), ranks = warmode.ranks(this, soldiers), plan = warmode.warPlan(this)!;
    this.warIds = soldiers; this.march = warmarch.marchOfPlan(this, plan);
    if (Math.floor(this.time) !== Math.floor(this.time - dt)) { // each second: the village that stayed home eats from the store (paid at the end), the army from the packs
      if (this.era !== 'ancient') this.warMeals += (this.warNeed() + this.armyNeed()) / this.dayLen; // no supply soldiers: the army eats from the village store like the village
      else {
        this.warMeals += this.warNeed() / this.dayLen;
        if (!plan.skirmish) { // a skirmish has no packs, tents or harassment (warskirmish.ts)
          warsupply.eatPacks(this, plan, this.armyNeed() / this.dayLen);
          if (Math.floor(this.time / 2) !== Math.floor((this.time - dt) / 2)) warsupply.follow(this, plan);
          wartent.tickTents(this, plan); warharass.tickHarass(this, plan);
        }
      }
    }
    for (const v of [...this.villagers]) { if (ranks.has(v.id)) this.tickVillager(v, dt); else warmode.standDown(this, v, dt); }
    army.tickBattle(this, dt); scouting.tickScouts(this, dt); warplan.tickPlans(this, dt); warskirmish.tickSkirmish(this, plan);
    const enemy = warmode.warTribe(this);
    this.pathLeft = Math.max(this.pathLeft, FOE_PATH_SHARE);
    for (const f of [...this.foes]) if (f.team === enemy) tickFoe(this, f, dt);
    tickTribes(this, dt);
  },
  /** → warskirmish.skirmishOrder: soldiers took an order against a village (commands.ts), which may begin a skirmish. */
  skirmishOrder(this: Sim, ids: readonly number[], t: Parameters<typeof warskirmish.skirmishOrder>[2]): void { warskirmish.skirmishOrder(this, ids, t); },
  /** → warskirmish.inSkirmish */
  inSkirmish(this: Sim, v: Villager): boolean { return warskirmish.inSkirmish(this, v); },
  /** → warskirmish.foeVillage */
  foeVillage(this: Sim, v: Villager) { return warskirmish.foeVillage(this, v); },
  /** → warskirmish.villageAt */
  villageAt(this: Sim, x: number, y: number) { return warskirmish.villageAt(this, x, y); },
  /** → warskirmish.edge: the boss factor of a blow in a skirmish (1 elsewhere). */
  skirmishEdge(this: Sim, from: Villager | undefined, to: Villager): number { return warskirmish.edge(this, from, to); },
  /** → warskirmish.cleanup */
  skirmishCleanup(this: Sim): void { warskirmish.cleanup(this); },
  /** → warsupply.supplyAdvice */
  supplyAdvice(this: Sim, plan: Plan): warsupply.SupplyAdvice | null { return warsupply.supplyAdvice(this, plan); },
  /** Whether a feature of the war plan is researched (the details tab, the supply sums, the weather, the rest in the field). */
  planOpen(this: Sim, f: research.PlanFeature): boolean { return research.planOpen(this.researched, f, this.era === 'ancient', this.dev.freeBuild); },
  /** → army.squadLimit */
  squadLimit(this: Sim): number { return army.squadLimit(this); },
  /** → army.cellLimit */
  cellLimit(this: Sim): number { return army.cellLimit(this); },
  /** → army.cardLimit */
  cardLimit(this: Sim): number { return army.cardLimit(this); },
  /** → army.createSquad */
  createSquad(this: Sim, name?: string): { squad?: Squad; reason?: string } { return army.createSquad(this, name); },
  /** → army.joinSquad */
  joinSquad(this: Sim, ids: readonly number[], squadId: number): string | null { return army.joinSquad(this, ids, squadId); },
  /** → army.leaveSquad */
  leaveSquad(this: Sim, ids: readonly number[]): void { return army.leaveSquad(this, ids); },
  /** → army.disbandSquad */
  disbandSquad(this: Sim, id: number): void { return army.disbandSquad(this, id); },
  /** → army.setCommander */
  setCommander(this: Sim, squadId: number, vid: number): void { return army.setCommander(this, squadId, vid); },
  /** → army.setFormation */
  setFormation(this: Sim, squadId: number, f: FormationName): string | null { return army.setFormation(this, squadId, f); },
  /** → army.formationOpen */
  formationOpen(this: Sim, f: FormationName): boolean { return army.formationOpen(this, f); },
  /** → army.squadMove */
  squadMove(this: Sim, s: Squad, x: number, y: number, mode: 'attack' | 'move' | 'hold', heading?: number): void { return army.squadMove(this, s, x, y, mode, heading); },
  /** → army.squadUnits */
  squadUnits(this: Sim, s: Squad): Villager[] { return army.squadUnits(this, s); },
  /** → army.squadCenter */
  squadCenter(this: Sim, s: Squad): { x: number; y: number } | null { return army.squadCenter(this, s); },
  /** → army.squadById */
  squadById(this: Sim, id: number): Squad | undefined { return army.squadById(this, id); },
  /** → army.trainSquad */
  trainSquad(this: Sim, squadId: number, on: boolean): string | null { return army.trainSquad(this, squadId, on); },
  /** → army.attackFactor */
  attackFactor(this: Sim, v: Villager, e: Ent): number { return army.attackFactor(this, v, e); },
  /** → army.takenFactor */
  takenFactor(this: Sim, v: Villager, ranged: boolean): number { return army.takenFactor(this, v, ranged); },
  /** → army.clusters */
  clusters(this: Sim): army.Cluster[] { return army.clusters(this); },
  /** → army.drawnFigures */
  drawnFigures(this: Sim): Set<number> | null { return army.drawnFigures(this); },
  /** → army.noteBattle */
  noteBattle(this: Sim, kind: army.BattleEvent, text = ''): void { return army.noteBattle(this, kind, text); },
  /** A line of the story of the war that is on (the log of the Lều họp chiến). → warlog.noteLine */
  warNote(this: Sim, text: string): void { return warlog.noteLine(this, text); },
  /** An enemy of the village we are attacking fell to ours. → warlog.noteFoeDeath */
  warFoeDead(this: Sim, tribe: string): void { return warlog.noteFoeDeath(this, tribe); },
  /** → army.noteLoss */
  noteLoss(this: Sim, v: Villager): void { return army.noteLoss(this, v); },
  /** → army.noteDamage */
  noteDamage(this: Sim, dealt: boolean, n: number): void { return army.noteDamage(this, dealt, n); },
  /** → battle.armOf */
  armOf(this: Sim, v: Villager): Arm { return armOf(v); },
  /** → scouting.mapLevel */
  mapLevel(this: Sim, tribe: string): number { return scouting.mapLevel(this, tribe); },
  /** → scouting.mapAccuracy */
  mapAccuracy(this: Sim, m: ScoutMap): number { return scouting.mapAccuracy(this, m); },
  /** → scouting.tribeIntel */
  tribeIntel(this: Sim, tribe: string): TribeIntel | null { return scouting.tribeIntel(this, tribe); },
  /** → warplan.objectivePos */
  missionTarget(this: Sim, plan: Plan, m: Mission): { x: number; y: number } | null { return warplan.objectivePos(this, plan, m); },
  /** → scouting.recallScouts */
  recallScouts(this: Sim, tribe: string): string | null { return scouting.recallScouts(this, tribe); },
  /** → scouting.scoutFlow */
  scoutFlow(this: Sim, tribe: string): ScoutFlow { return scouting.scoutFlow(this, tribe); },
  /** → scouting.startScout */
  startScout(this: Sim, ids: readonly number[], tribe: string): string | null { return scouting.startScout(this, ids, tribe); },
  /** → scouting.planScout */
  planScout(this: Sim, ids: readonly number[], tribe: string): ScoutPlan { return scouting.planScout(this, ids, tribe); },
  /** → scouting.scoutLevel */
  scoutLevel(this: Sim): number { return scouting.scoutLevel(this); },
  /** → scouting.scoutLimit */
  scoutLimit(this: Sim): number { return scouting.scoutLimit(this); },
  /** → scouting.scoutSkill */
  scoutSkill(this: Sim, v: Villager): number { return scouting.scoutSkill(v); },
  /** → scouting.canScout */
  canScout(this: Sim, v: Villager): boolean { return scouting.canScout(this, v); },
  /** → scouting.enlistScouts */
  enlistScouts(this: Sim, ids: readonly number[]): string | null { return scouting.enlistScouts(this, ids); },
  /** → scouting.dismissScouts */
  dismissScouts(this: Sim, ids: readonly number[]): string | null { return scouting.dismissScouts(this, ids); },
  /** → scouting.scoutRoster */
  scoutRoster(this: Sim): Villager[] { return scouting.scoutRoster(this); },
  /** → scouting.isFound */
  isFound(this: Sim, tribe: string): boolean { return scouting.isFound(this, tribe); },
  /** → scouting.whereIs */
  whereIs(this: Sim, tribe: string): { dist: number; dir: string } | null { return scouting.whereIs(this, tribe); },
  /** → scouting.scoutsNeeded */
  scoutsNeeded(this: Sim, tribe: string, level: number): number { return scouting.scoutsNeeded(this, tribe, level); },
  /** → warplan.newPlan */
  newPlan(this: Sim, kind: 'attack' | 'defense', tribe: string | null): Plan { return warplan.newPlan(this, kind, tribe); },
  /** → warplan.addMission */
  addMission(this: Sim, plan: Plan, squadId: number, withdrawAt?: number): string | null { return warplan.addMission(this, plan, squadId, withdrawAt); },
  /** → warplan.removeMission */
  removeMission(this: Sim, plan: Plan, squadId: number): void { return warplan.removeMission(plan, squadId); },
  /** → warplan.deploySquad */
  deploySquad(this: Sim, plan: Plan, squadId: number, kind: FormationId | undefined, cells: readonly Pt[], heading: number, o: Pt, p: Pt): string | null { return warplan.deploySquad(this, plan, squadId, kind, cells, heading, o, p); },
  /** → warplan.setMissionPath */
  setMissionPath(this: Sim, plan: Plan, squadId: number, pts: readonly Pt[], retreat?: boolean): string | null { return warplan.setMissionPath(this, plan, squadId, pts, retreat); },
  /** → warplan.squadPace */
  squadPace(this: Sim, s: Squad): number { return warplan.squadPace(this, s); },
  /** → warplan.routeTime */
  routeTime(this: Sim, s: Squad, from: Pt, pts: readonly Pt[], target?: Pt): RouteTime { return warplan.routeTime(this, s, from, pts, target); },
  /** → warplan.missionStart */
  missionStart(this: Sim, m: Mission, toward?: Pt): Pt | null { return warplan.missionStart(this, m, toward); },
  /** → warplan.addCard */
  addCard(this: Sim, plan: Plan, kind: CardKind, squadId: number, arg?: string): string | null { return warplan.addCard(this, plan, kind, squadId, arg); },
  /** → warplan.removeCard */
  removeCard(this: Sim, plan: Plan, cardId: number): void { return warplan.removeCard(plan, cardId); },
  /** → warplan.reviewPlan */
  reviewPlan(this: Sim, plan: Plan): string[] { return warplan.reviewPlan(this, plan); },
  /** → warplan.startPlan */
  startPlan(this: Sim, plan: Plan): string | null { return warplan.startPlan(this, plan); },
  /** → warplan.playCard */
  playCard(this: Sim, plan: Plan, cardId: number): string | null { return warplan.playCard(this, plan, cardId); },
  /** → warplan.engagePlan */
  engagePlan(this: Sim, plan: Plan): string | null { return warplan.engagePlan(this, plan); },
  /** Set how many supply soldiers the plan takes and how many days of food they carry. Returns an error or null. */
  setSupply(this: Sim, plan: Plan, n: number, days: number): string | null {
    if (plan.status !== 'draft') return 'Chỉ sửa được khi kế hoạch còn là bản nháp';
    plan.supply = Math.max(0, Math.round(n)); plan.carryDays = Math.max(1, Math.min(warmarch.WAR_DATA.supply.maxDays, Math.round(days)));
    return null;
  },
  /** → wartent.shelter */
  shelter(this: Sim, v: Villager): void { return wartent.shelter(this, v); },
  /** → wartent.sleepsInTent: night, and the tent of his squad stands beside him */
  sleepsInTent(this: Sim, v: Villager): boolean { return wartent.sleepsInTent(this, v); },
  /** → warsupply.supplyAvailable: how many supply soldiers wait in their camp */
  supplyReady(this: Sim): number { return warsupply.supplyAvailable(this).length; },
  /** → scouting.noteScoutLoss */
  noteScoutLoss(this: Sim, v: Villager, cause: string): void { scouting.noteScoutLoss(this, v, cause); },
  /** → warlog.noteLoot */
  noteLoot(this: Sim, tribe: string, res: Res, n: number): void { warlog.noteLoot(this, tribe, res, n); },
  /** → warplan.regather: soldiers off their cell go back to it; returns how many */
  regroupPlan(this: Sim, plan: Plan): number { return warplan.regather(this, plan); },
  /** → warplan.withdrawPlan */
  withdrawPlan(this: Sim, plan: Plan): string | null { return warplan.withdrawPlan(this, plan); },
  /** → forecast.forecastPlan */
  forecastPlan(this: Sim, plan: Plan): Forecast { return forecast.forecastPlan(this, plan); },
  /** → warplan.soundAlarm */
  soundAlarm(this: Sim): string | null { return warplan.soundAlarm(this); },
  /** → siege.obstacleAt */
  obstacleAt(this: Sim, x: number, y: number): Obstacle | null { return siege.obstacleAt(this, x, y); },
  /** → siege.pathHits */
  pathHits(this: Sim, start: Pt, pts: readonly Pt[], target?: Pt): Array<Obstacle | null> { return siege.pathHits(this, start, pts, target); },
  /** → siege.lineSteps */
  lineSteps(this: Sim, from: Pt, x: number, y: number): Array<[number, number]> { return siege.lineSteps(this, from, { x, y }); },
  /** → siege.startBreaking */
  startBreaking(this: Sim, v: Villager, ob: Obstacle, home?: Pt): boolean { return siege.startBreaking(this, v, ob, home); },
  /** → siege.breachFor */
  breachFor(this: Sim, v: Villager, x: number, y: number): boolean { return siege.breachFor(this, v, x, y); },
  /** → siege.breakBrain */
  breakBrain(this: Sim, v: Villager, dt: number): boolean { return siege.breakBrain(this, v, dt); },
  /** → siege.arrowMove */
  arrowMove(this: Sim, s: Squad, m: Mission, p: Pt, mode: 'attack' | 'hold' | 'move'): Obstacle | null { return siege.arrowMove(this, s, m, p, mode); },
  /** → siege.haltSquad */
  haltSquad(this: Sim, m: Mission, s: Squad, ob: Obstacle): void { return siege.haltSquad(this, m, s, ob); },
  /** → siege.watchMarch */
  watchMarch(this: Sim, m: Mission, s: Squad): boolean { return siege.watchMarch(this, m, s); },
  /** → siege.blockCleared */
  blockCleared(this: Sim, m: Mission): boolean { return siege.blockCleared(this, m); },
  /** → siege.breakBlock */
  breakBlock(this: Sim, plan: Plan, squadId: number, n: number): string | null { return siege.breakBlock(this, plan, squadId, n); },
  /** → siege.targetNow */
  targetNow(this: Sim, plan: Plan, m: Mission): siege.TargetState | null { return siege.targetNow(this, plan, m); },
  /** → siege.rampage */
  rampage(this: Sim, plan: Plan, s: Squad): void { siege.rampage(this, plan, s); },
  /** → siege.tickTarget */
  tickTarget(this: Sim, plan: Plan, m: Mission, s: Squad): boolean { return siege.tickTarget(this, plan, m, s); },
  /** → warplan.setMissionTarget */
  setMissionTarget(this: Sim, plan: Plan, squadId: number, target: MissionTarget): string | null { return warplan.setMissionTarget(this, plan, squadId, target); },
  /** The village of `id` has lost the war: its people give up and ask for mercy (take them in, or make them pay tribute). */
  conquer(this: Sim, id: string, why: string): void { const t = tribeOf(this, id as never); if (t && t.state === 'free') surrender(this, t, why); },
  /** → siege.corridorBlocks */
  corridorBlocks(this: Sim, start: Pt, pts: readonly Pt[], target?: Pt): Obstacle[] { return siege.corridorBlocks(this, start, pts, target); },
  /** → warplan.cancelPlan */
  cancelPlan(this: Sim, plan: Plan): string | null { return warplan.cancelPlan(this, plan); },
  /** In a war: whether a soldier of the army is fighting or marching (resting counts as marching); null for everyone else. */
  warMode(this: Sim, v: Villager): 'fight' | 'march' | null { return v.team === 'player' && this.warIds.has(v.id) ? (v.phase === 'fight' || v.swing ? 'fight' : 'march') : null; },
  /** Supply soldiers of the deployed plan who are still alive (without them there is nobody to pitch a tent). */
  supplyReadyIn(this: Sim, plan: Plan): number { return warsupply.supplyOf(this, plan).length; },
  /** → warquick.quickAttack: the simple war of the stone age */
  quickAttack(this: Sim, tribeId: string): string | null { return warquick.quickAttack(this, tribeId); },
  /** → warquick.army */
  quickArmy(this: Sim): Villager[] { return warquick.army(this); },
  /** → warplan.setRest */
  setRest(this: Sim, plan: Plan, squadId: number, on: boolean): string | null { return warplan.setRest(this, plan, squadId, on); },
  /** → warplan.isHolding */
  isHolding(this: Sim, plan: Plan, m: Mission): boolean { return warplan.isHolding(plan, m); },
  /** → training.startTraining */
  startTraining(this: Sim, ids: readonly number[], houseId: number, care: number): string | null { return training.startTraining(this, ids, houseId, care); },
  /** → training.cancelTraining */
  cancelTraining(this: Sim, ids: readonly number[]): void { return training.cancelTraining(this, ids); },
  /** → training.trainStep */
  trainStep(this: Sim, v: Villager, dt: number): boolean { return training.trainStep(this, v, dt); },
  /** → training.profileOf, trainCap */
  trainInfo(this: Sim, b: Building): { main: StatKey; partner?: StatKey; cost: StatKey; cap: number } | null { const p = training.profileOf(b); return p ? { ...p, cap: training.trainCap(b) } : null; },
  /** → training.trainCost */
  trainCost(this: Sim, stat: number, care: number): { food: number; coin: number } { return training.trainCost(stat, care); },
  /** → training.trainTime */
  trainTime(this: Sim, stat: number): number { return training.trainTime(this, stat); },
  /** → training.members */
  trainees(this: Sim, b: Building): Villager[] { return training.members(this, b); },
  /** → mounts.queueTame */
  queueTame(this: Sim, k: MountKind): string | null { return mounts.queueTame(this, k); },
  /** → mounts.unqueueTame */
  unqueueTame(this: Sim, k: MountKind): void { return mounts.unqueueTame(this, k); },
  /** → mounts.tameLock */
  tameLock(this: Sim, k: MountKind): string | null { return mounts.tameLock(this, k); },
  /** → mounts.tamedCount */
  tamedCount(this: Sim, k: MountKind): number { return mounts.tamedCount(this, k); },
  /** → mounts.tickTame */
  tickTame(this: Sim, dt: number): void { return mounts.tickTame(this, dt); },
  /** → warplan.callArmy */
  callArmy(this: Sim): string | null { return warplan.callArmy(this); },
  /** → warplan.standDown */
  standDown(this: Sim): void { return warplan.standDown(this); },
  /** → mounts.fitScoutMount */
  fitScoutMount(this: Sim, v: Villager): void { return mounts.fitScoutMount(this, v); },
  /** → mounts.returnScoutMount */
  returnScoutMount(this: Sim, v: Villager): void { return mounts.returnScoutMount(this, v); },
  /** → mounts.mountOf */
  mountOf(this: Sim, v: Villager): MountKind | null { return mounts.mountOf(this, v); },
  /** → mounts.mountSpeed */
  mountSpeed(this: Sim, v: Villager): number { return mounts.mountSpeed(this, v); },
  /** → mounts.mountGuard */
  mountGuard(this: Sim, v: Villager): number { return mounts.mountGuard(this, v); },
  /** → mounts.assignMount */
  assignMount(this: Sim, ids: readonly number[], kind: MountKind | null): string | null { return mounts.assignMount(this, ids, kind); },
  /** → environment.sightOf */
  sightOf(this: Sim, v: Villager): number { return sightOf(this, v); },
  /** → warplan.canTarget */
  canTarget(this: Sim, objective: Objective, tribe: string | null): boolean { return warplan.canTarget(this, objective, tribe); },
};

/** The methods of WAR as they are called on the Sim (without the `this` parameter). */
export type WarApi = { [K in keyof typeof WAR]: OmitThisParameter<(typeof WAR)[K]> };
