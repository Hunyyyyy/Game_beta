/**
 * Side quests played on the map (PLAN.md, decisions of 2026-11-16): a small stage apart from the books of the world. The bandits, the hired killer and the one to be kept safe are stage units
 * (teams `stage` and `ward`, `ai.stage`, brainstage.ts): they belong to no village, so they count for no population, ration, power, relation, raid, alarm or war; they stand only on free tiles of land in sight,
 * change nothing of the ground and are gone when the stage ends. Our soldiers are real: what they lose is lost. The quest tracker (sidequests.ts) asks through `sim.stage*`; when a stage cannot be set
 * (a war, no soldier, no free place, the switch off) the quest falls back to its talk. Every dice here is `seedRoll` of the game's seed: the random streams of the world are not touched.
 */
import type { Sim, Villager } from './sim';
import type { Team } from './combat';
import { seedRoll } from './encounterdata';
import { characterOf, suitOf } from './characters';
import { SIDE, sideQuest, type SideRun, type StageField } from './sidequestdata';

const MAP = SIDE.config.map;
/** Stage units take their ids far above the villagers', so the ids of the people born later are what they would have been without the quest. */
const STAGE_ID = 900_000_000;
const far = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
const fireOf = (sim: Sim): { x: number; y: number } => { const f = sim.campfire(); return f ? { x: f.x + 1, y: f.y + 1 } : sim.world.start; };
const alive = (sim: Sim, ids: readonly number[]): Villager[] => ids.map((id) => sim.get(id)).filter((u): u is Villager => !!u && u.health > 0);

/** Why this step cannot be played on the map now (then its talk is used), or null. */
export function stageBlock(sim: Sim, field: StageField): string | null {
  if (!MAP.enabled) return 'off';
  if (sim.atWar()) return 'war';
  if (sim.villagers.filter((v) => v.job === 'fight' && v.health > 0 && !v.ally).length < (field.soldiers ?? 1)) return 'no soldiers';
  return null;
}

/** A free tile of land in sight about `r` tiles from the fire at angle `a` (tried a little nearer too). */
function spot(sim: Sim, a: number, r: number): [number, number] | null {
  const c = fireOf(sim), N = sim.world.size;
  for (const k of [1, 0.85, 0.7, 0.55]) { // (only tiles in sight now: fog state 2)
    const at = sim.nearestFree(Math.floor(c.x + Math.cos(a) * r * k), Math.floor(c.y + Math.sin(a) * r * k), new Set());
    if (at && at[0] >= 0 && at[1] >= 0 && at[0] < N && at[1] < N && sim.fog.state[at[1] * N + at[0]] === 2 && far({ x: at[0], y: at[1] }, c) > MAP.minDist) return at;
  }
  return null;
}
/** Where a stage is from the fire, in words. */
function where(sim: Sim, at: [number, number]): string {
  const c = fireOf(sim), dx = at[0] - c.x, dy = at[1] - c.y;
  return Math.abs(dx) > Math.abs(dy) * 2 ? (dx > 0 ? 'phía đông' : 'phía tây') : Math.abs(dy) > Math.abs(dx) * 2 ? (dy > 0 ? 'phía nam' : 'phía bắc') : `phía ${dx > 0 ? 'đông' : 'tây'} ${dy > 0 ? 'nam' : 'bắc'}`;
}

/** A stage unit: made with dice of its own, an id outside the villagers', in no village's list. */
function make(sim: Sim, run: SideRun, at: [number, number], kind: 'bandit' | 'killer' | 'ward', cast?: string): Villager {
  const st = sim.side, n = (st.seq = (st.seq ?? 0) + 1);
  let i = 0;
  const rnd = (): number => seedRoll(sim.seed, `stage:${run.id}:${n}`, i++);
  const free = sim.nearestFree(at[0], at[1], new Set()) ?? at;
  const f = sim.makeVillager(free[0], free[1], rnd() < 0.5 ? 'm' : 'f', (kind === 'ward' ? 'ward' : 'stage') as Team, rnd);
  sim.nextVid--; f.id = STAGE_ID + n;
  const era = sim.era === 'ancient' ? 'ancient' : 'stone', who = characterOf(cast);
  if (who) { const suit = suitOf(who, sim.era); f.look = { ...who.look }; f.name = `${who.name} ${f.name}`; f.outfit = suit.armor ?? undefined; }
  else { f.look.hide = '#3a2f2a'; f.look.pants = '#2a2622'; f.name = kind === 'killer' ? `Kẻ lạ mặt ${f.name}` : `Cướp ${f.name}`; }
  f.ai = { role: kind === 'ward' ? 'civ' : 'raider', camp: { x: free[0] + 0.5, y: free[1] + 0.5 }, wander: 0, goal: null, raid: 0, stage: { run: run.id, kind, lead: MAP.lead } };
  sim.addFoe(f);
  const arms = MAP.weapons[era];
  sim.armFoe(f, kind === 'ward' ? null : arms[Math.floor(rnd() * arms.length)], kind !== 'ward' && era === 'ancient', 1);
  return f;
}
const band = (sim: Sim, run: SideRun, at: [number, number], field: StageField, part = 1): number[] => {
  const [lo, hi] = field.count, n = Math.max(1, Math.round((lo + Math.floor(seedRoll(sim.seed, `stage:n:${run.id}`, sim.day) * (hi - lo + 1)) + (sim.era === 'ancient' ? MAP.moreMedieval : 0)) * part));
  return Array.from({ length: n }, () => make(sim, run, at, 'bandit').id);
};

/** Set the stage of a step: true when it stands (the quest then waits for its end), false when no place could be found (the talk decides instead). */
export function stageStart(sim: Sim, run: SideRun, field: StageField, step: number, opt: number): boolean {
  if (stageBlock(sim, field)) return false;
  const q = sideQuest(run.id), R = MAP.dist, a0 = seedRoll(sim.seed, `stage:a:${run.id}`, sim.day) * Math.PI * 2;
  for (let t = 0; t < 12; t++) {
    const a = a0 + (t * Math.PI) / 6, at = spot(sim, a, R);
    if (!at) continue;
    const base = { kind: field.kind, step, opt, until: sim.day + field.days, at, units: [] as number[], spawned: 0 };
    if (field.kind === 'bandits') {
      run.stage = { ...base, units: band(sim, run, at, field) };
    } else if (field.kind === 'escort') { // the one to be led starts here, goes round the village to a place a third of the circle on; the bandits wait half way
      const goal = spot(sim, a + MAP.escortArc, R), mid = spot(sim, a + MAP.escortArc / 2, R);
      if (!goal || !mid) continue;
      const ward = make(sim, run, at, 'ward', q?.giver);
      ward.ai!.stage!.goal = { x: goal[0] + 0.5, y: goal[1] + 0.5 };
      run.stage = { ...base, ward: ward.id, goal, ambush: mid };
    } else { // someone to be kept safe camps outside the village; a killer comes for him after a while
      const near = spot(sim, a, Math.max(MAP.minDist + 2, R * 0.6)) ?? at;
      const ward = make(sim, run, near, 'ward', q?.giver);
      run.stage = { ...base, at: near, ward: ward.id, ambush: at, killAt: sim.time + MAP.killerDelay };
    }
    run.stage!.spawned = run.stage!.units.length;
    sim.say(`${q?.name ?? 'Việc nhận thêm'}: ${field.say} (${where(sim, run.stage!.at)} làng, hạn ${field.days} ngày).`);
    return true;
  }
  return false;
}

/** Where the stage of a quest stands now: still going, won, or lost. Brings on the ambush and the killer when their time comes. */
export function stageCheck(sim: Sim, run: SideRun, field: StageField): 'run' | 'won' | 'lost' {
  const s = run.stage;
  if (!s) return 'lost';
  const left = alive(sim, s.units), ward = s.ward !== undefined ? sim.get(s.ward) : undefined;
  if (s.kind === 'bandits') return left.length === 0 ? 'won' : sim.day > s.until ? 'lost' : 'run';
  if (!ward || ward.health <= 0) return 'lost';
  if (s.kind === 'escort') {
    if (!s.sprung && s.ambush && far(ward, { x: s.ambush[0], y: s.ambush[1] }) < MAP.ambushAt) { s.sprung = true; s.units = band(sim, run, s.ambush, field); s.spawned = s.units.length; sim.say('Có kẻ chặn đường đoàn hộ tống!'); }
    if (s.goal && far(ward, { x: s.goal[0] + 0.5, y: s.goal[1] + 0.5 }) < 2.2) return 'won';
    return sim.day > s.until ? 'lost' : 'run';
  }
  // guard
  if (!s.sprung && s.killAt !== undefined && sim.time >= s.killAt && s.ambush) {
    s.sprung = true;
    const k = make(sim, run, s.ambush, 'killer'); k.ai!.stage!.mark = ward.id;
    s.units = [k.id, ...band(sim, run, s.ambush, field, 0.5)]; s.spawned = s.units.length;
    sim.say('Có kẻ lạ đang tiến về phía người làng đang giữ!');
  }
  if (s.sprung && left.length === 0) return 'won';
  return sim.day > s.until ? 'won' : 'run'; // nobody came for him in time (or they gave up): he is safe
}
/** How many of the stage's foes our soldiers brought down. */
export const stageKills = (sim: Sim, run: SideRun): number => (run.stage ? run.stage.spawned - alive(sim, run.stage.units).length : 0);

/** The stage is over: its units are gone, nothing of it is left on the map. */
export function stageClear(sim: Sim, run: SideRun): void {
  for (const f of [...sim.foes]) if (f.ai?.stage?.run === run.id) sim.removeFoe(f);
  run.stage = undefined;
}
/** Stage units whose quest is no more (a save from a quest that was dropped, a data change): gone quietly. */
export function stageSweep(sim: Sim): void {
  for (const f of [...sim.foes]) if (f.ai?.stage && !sim.side.runs.some((r) => r.id === f.ai!.stage!.run && r.stage)) sim.removeFoe(f);
}
