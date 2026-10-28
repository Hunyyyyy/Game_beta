/** The war half of the Sim facade: squads, formations, scouting and plans. Kept apart so sim.ts stays within its size; sim.ts mixes it in. */
import * as army from './army';
import * as scouting from './scouting';
import * as warplan from './warplan';
import type { Ent } from './battle';
import type { CardKind, FormationName, Objective, Plan, ScoutMap, Squad, Villager } from './model';
import type { Sim } from './sim';

export const WAR = {
  /** → army.squadLimit */
  squadLimit(this: Sim): number { return army.squadLimit(this); },
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
  squadMove(this: Sim, s: Squad, x: number, y: number, mode: 'attack' | 'move' | 'hold'): void { return army.squadMove(this, s, x, y, mode); },
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
  /** → scouting.mapLevel */
  mapLevel(this: Sim, tribe: string): number { return scouting.mapLevel(this, tribe); },
  /** → scouting.mapAccuracy */
  mapAccuracy(this: Sim, m: ScoutMap): number { return scouting.mapAccuracy(this, m); },
  /** → scouting.startScout */
  startScout(this: Sim, ids: readonly number[], tribe: string, level: number): string | null { return scouting.startScout(this, ids, tribe, level); },
  /** → scouting.scoutsNeeded */
  scoutsNeeded(this: Sim, tribe: string, level: number): number { return scouting.scoutsNeeded(this, tribe, level); },
  /** → warplan.newPlan */
  newPlan(this: Sim, kind: 'attack' | 'defense', tribe: string | null): Plan { return warplan.newPlan(this, kind, tribe); },
  /** → warplan.addMission */
  addMission(this: Sim, plan: Plan, squadId: number): string | null { return warplan.addMission(this, plan, squadId); },
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
  /** → warplan.soundAlarm */
  soundAlarm(this: Sim): string | null { return warplan.soundAlarm(this); },
  /** → warplan.canTarget */
  canTarget(this: Sim, objective: Objective, tribe: string | null): boolean { return warplan.canTarget(this, objective, tribe); },
};

/** The methods of WAR as they are called on the Sim (without the `this` parameter). */
export type WarApi = { [K in keyof typeof WAR]: OmitThisParameter<(typeof WAR)[K]> };
