/** Quests: the guided plan that leads the village to the fourth campfire level (src/data/quests.json). They are worked out from the state of the village and of the screen, so nothing is saved. */
import data from '../data/quests.json';
import type { BuildingKind } from './buildings';
import { fireLevel, fireUpgradeBlock } from './construction';
import { Job, RoleId, roleOf } from './jobs';
import type { Res } from './resources';
import type { Sim } from './sim';

/** What a quest waits for. Types with a count show progress such as 1/2. */
export type QuestDone =
  | { type: 'buildBuilding'; kind: BuildingKind; count: number }
  | { type: 'upgradeBuilding'; kind: BuildingKind; level: number }
  | { type: 'upgradeFire'; level: number }
  | { type: 'fireReady'; level: number }
  | { type: 'researchTech'; id: string }
  | { type: 'population'; count: number }
  | { type: 'stock'; res: Res; count: number }
  | { type: 'hasRole'; role: RoleId; count: number }
  | { type: 'jobCount'; job: Job; count: number }
  | { type: 'staffIn'; kind: BuildingKind; count: number }
  | { type: 'haveTool'; kind: string; tier: number; count: number }
  | { type: 'torches'; count: number }
  | { type: 'createSquad'; count: number }
  | { type: 'daytime'; day: number }
  | { type: 'speed'; atLeast: number }
  | { type: 'selectBuilding'; kind: BuildingKind }
  | { type: 'openBuilding'; kind: BuildingKind }
  | { type: 'inspectNode' }
  | { type: 'inspectUnit' }
  | { type: 'inspectAnimal' }
  /** Some squad has this many soldiers in it. */
  | { type: 'squadSize'; count: number }
  /** Some squad stands in this formation. */
  | { type: 'squadFormation'; id: string }
  /** This many soldiers carry a weapon or a piece of armour. */
  | { type: 'equipped'; slot: 'weapon' | 'armor'; count: number }
  /** A scouting trip has gone out (or a map has come back). */
  | { type: 'scoutSent' }
  /** The scouts hold a map of a village at this level or better. */
  | { type: 'hasMap'; level: number }
  /** A defence plan has been drawn. */
  | { type: 'planDefense' }
  /** An attack plan has a squad with an arrow drawn to its target. */
  | { type: 'planArrow' }
  /** An attack plan has been sent out: the army is on the march or fighting (or it is over). */
  | { type: 'planRunning' }
  /** A plan has been carried to its end, won or lost. */
  | { type: 'planDone'; result?: 'won' | 'lost' };
export interface Quest { id: string; chapter: number; title: string; hint: string; after: string[]; done: QuestDone }
export interface Chapter { id: number; name: string }

export const QUESTS = data.quests as Quest[];
/** Quests that teach a button or wait for the clock: a game saved before quests were kept counts them as done. */
export const SCREEN_QUESTS = QUESTS.filter((q) => ['selectBuilding', 'openBuilding', 'inspectNode', 'inspectUnit', 'inspectAnimal', 'speed', 'daytime'].includes(q.done.type)).map((q) => q.id);
export const CHAPTERS = data.chapters as Chapter[];

/** What the player has on the screen right now (the quests that teach the buttons look at it). */
export interface QuestUi { selected: BuildingKind | null; panel: BuildingKind | null; inspecting: 'unit' | 'animal' | 'node' | null }

export interface QuestView {
  quest: Quest; done: boolean; open: boolean;
  /** "1/2" for a quest that counts, or the reason a campfire upgrade is still held back. */
  progress: string;
}

/** [have, need] of a quest that counts (a quest of one thing has [0 or 1, 1]). */
function measure(sim: Sim, d: QuestDone, ui: QuestUi): [number, number] {
  const yes = (b: boolean): [number, number] => [b ? 1 : 0, 1];
  switch (d.type) {
    case 'buildBuilding': return [sim.buildings.filter((b) => b.kind === d.kind && b.done).length, d.count];
    case 'upgradeBuilding': return yes(sim.buildings.some((b) => b.kind === d.kind && b.done && b.level >= d.level));
    case 'upgradeFire': return yes(fireLevel(sim) >= d.level);
    case 'fireReady': return yes(fireUpgradeBlock(sim, d.level) === null);
    case 'researchTech': return yes(sim.researched.has(d.id));
    case 'population': return [sim.villagers.length, d.count];
    case 'stock': return [Math.floor(sim.stock[d.res]), d.count];
    case 'hasRole': return [sim.villagers.filter((v) => roleOf(v) === d.role).length, d.count];
    case 'jobCount': return [sim.villagers.filter((v) => v.job === d.job).length, d.count];
    case 'staffIn': return [sim.buildings.filter((b) => b.kind === d.kind).reduce((n, b) => n + b.staff.length, 0), d.count];
    case 'haveTool': return [sim.toolCount(d.kind, d.tier), d.count];
    case 'torches': return [sim.torchCount(), d.count];
    case 'createSquad': return [sim.squads.length, d.count];
    case 'daytime': return yes(sim.day >= d.day && sim.part === 'day');
    case 'speed': return yes(sim.speed >= d.atLeast);
    case 'selectBuilding': return yes(ui.selected === d.kind || ui.panel === d.kind);
    case 'openBuilding': return yes(ui.panel === d.kind);
    case 'inspectNode': return yes(ui.inspecting === 'node');
    case 'inspectUnit': return yes(ui.inspecting === 'unit');
    case 'inspectAnimal': return yes(ui.inspecting === 'animal');
    case 'squadSize': return [Math.max(0, ...sim.squads.map((q) => q.ids.length)), d.count];
    case 'squadFormation': return yes(sim.squads.some((q) => q.formation === d.id));
    case 'equipped': return [sim.villagers.filter((v) => v.team === 'player' && v.job === 'fight' && (d.slot === 'weapon' ? v.gear.w : v.gear.a) !== null).length, d.count];
    case 'scoutSent': return yes(sim.scouts.length > 0 || sim.maps.length > 0);
    case 'hasMap': return yes(sim.maps.some((m) => m.level >= d.level));
    case 'planDefense': return yes(sim.plans.some((pl) => pl.kind === 'defense'));
    case 'planArrow': return yes(sim.plans.some((pl) => pl.kind === 'attack' && pl.missions.some((m) => m.path.length > 0)));
    case 'planRunning': return yes(sim.plans.some((pl) => pl.kind === 'attack' && (pl.status === 'running' || pl.status === 'done')));
    case 'planDone': return yes(sim.plans.some((pl) => pl.status === 'done' && (!d.result || pl.result === d.result)));
  }
}

/** Every quest with whether it is done, whether it is open (all it comes after are done) and how far it has got. A quest done once stays done (it is saved with the game). */
export function questViews(sim: Sim, ui: QuestUi): QuestView[] {
  // only a quest that is open can be done: one met early (a trade given before its turn) waits until the ones before it are
  for (const q of QUESTS) if (!sim.questSeen.has(q.id) && q.after.every((a) => sim.questSeen.has(a))) { const [have, need] = measure(sim, q.done, ui); if (have >= need) sim.questSeen.add(q.id); }
  return QUESTS.map((quest) => {
    const done = sim.questSeen.has(quest.id), open = !done && quest.after.every((a) => sim.questSeen.has(a));
    let progress = '';
    if (open) {
      const d = quest.done, [have, need] = measure(sim, d, ui);
      if (d.type === 'fireReady' || d.type === 'upgradeFire') progress = fireUpgradeBlock(sim, d.level - 1) ?? '';
      else if (need > 1) progress = `${Math.min(have, need)}/${need}`;
    }
    return { quest, done, open, progress };
  });
}
