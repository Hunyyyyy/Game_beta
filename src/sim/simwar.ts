/** The war half of the Sim facade: squads, formations, scouting and plans (and, as it grew, training). Kept apart so sim.ts stays within its size; sim.ts mixes it in. */
import * as army from './army';
import * as forecast from './forecast';
import * as scouting from './scouting';
import * as siege from './siege';
import { sightOf } from './environment';
import * as training from './training';
import * as mounts from './mounts';
import { surrender, tribeOf } from './tribes';
import * as warplan from './warplan';
import { armOf } from './battle';
import type { Ent } from './battle';
import type { Building } from './buildings';
import type { MountKind, StatKey } from './jobs';
import type { Arm, FormationId } from './formations';
import type { ScoutFlow } from './scouting';
import type { CardKind, RouteTime, Forecast, FormationName, Mission, MissionTarget, Objective, Obstacle, Plan, Pt, ScoutMap, ScoutPlan, Squad, TribeIntel, Villager } from './model';
import type { Sim } from './sim';

export const WAR = {
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
  /** → warplan.isLogistics */
  isLogistics(this: Sim, plan: Plan, m: Mission): boolean { return warplan.isLogistics(plan, m); },
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
  trainTime(this: Sim, stat: number): number { return training.trainTime(stat); },
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
