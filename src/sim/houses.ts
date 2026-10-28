/** Who works in which house: the builders' crew and the staff inside the craft, research and repair houses. */
import { Building, BUILDINGS, levelDef } from './buildings';
import { CREW_BUILDING, isStaffJob, JOBS, STAFF_BUILDING, WorkJob } from './jobs';
import { Step } from './path';
import type { Sim } from './sim';
import { Villager } from './model';

// ---------------------------------------------------------------- working inside a house
/** The villager best suited to work in a house who is not already doing it: free hands first, soldiers never, then the best stat for the job. */
export function bestFor(sim: Sim, job: 'craft' | 'research' | 'repair'): Villager | null {
  const stat = JOBS[job].stat;
  const pool = sim.villagers.filter((v) => v.down <= 0 && v.inside === null && v.job !== job && v.job !== 'fight' && v.job !== 'hunt');
  pool.sort((a, b) => (a.job === 'idle' ? 0 : 1) - (b.job === 'idle' ? 0 : 1) || b.stats[stat] - a.stats[stat]);
  return pool[0] ?? null;
}

/** How fast a house gets through its active order: everyone inside, the house level and the dev speed-up. */
export function houseRate(sim: Sim, b: Building): number {
  const job: WorkJob = b.kind === 'lab' ? 'research' : b.kind === 'workshop' ? 'craft' : 'repair';
  let r = 0;
  for (const id of b.staff) { const v = sim.byId.get(id); if (v) r += sim.workFactor(v, job); }
  return r * levelDef(b).craftSpeed * (sim.dev.fastWorks ? 25 : 1);
}

/** Villagers heading for a house or already in it. */
export function staffCount(sim: Sim, b: Building): number { return b.staff.length + sim.villagers.filter((v) => v.phase === 'goStaff' && v.target === b.id).length; }

/** The villagers whose job is building: the crew of the Nhà thợ xây. */
export function crew(sim: Sim): Villager[] { return sim.villagers.filter((v) => v.job === 'build'); }

/** Builders in, up to what the Nhà thợ xây holds. Returns an error or null. */
export function assignCrew(sim: Sim, ids: readonly number[]): string | null {
  const house = sim.building(CREW_BUILDING.build);
  if (!house) return `Chưa có ${BUILDINGS.builder.name}, hoặc chưa xây xong`;
  let err: string | null = null;
  for (const v of sim.mine(ids)) {
    if (v.job === 'build') continue;
    if (crew(sim).length >= levelDef(house).slots) { err = `${BUILDINGS.builder.name} cấp ${house.level} chỉ chứa ${levelDef(house).slots} thợ`; continue; }
    sim.resetTask(v); sim.clearCombat(v); v.job = 'build'; v.prefer = -1;
  }
  return err;
}

/** More builders than the house holds: the last ones go back to idle. */
export function trimCrew(sim: Sim): void {
  const house = sim.building('builder'), builders = crew(sim);
  if (house) for (const v of builders.slice(levelDef(house).slots)) { sim.resetTask(v); v.job = 'idle'; }
}

/** Send builders back to idle. */
export function releaseCrew(sim: Sim, ids: readonly number[]): void {
  for (const v of sim.mine(ids)) if (v.job === 'build') { sim.resetTask(v); v.job = 'idle'; }
}

/** Put villagers to work inside the matching house (job craft, research or repair). Returns an error or null. */
export function assignStaff(sim: Sim, ids: readonly number[], job: 'craft' | 'research' | 'repair'): string | null {
  const b = sim.building(STAFF_BUILDING[job]);
  if (!b) return `Chưa có ${BUILDINGS[STAFF_BUILDING[job]].name}, hoặc chưa xây xong`;
  let err: string | null = null;
  for (const v of sim.mine(ids)) {
    if (v.inside === b.id) { v.job = job; continue; }
    if (staffCount(sim, b) >= levelDef(b).slots) { err = `${BUILDINGS[b.kind].name} cấp ${b.level} chỉ chứa ${levelDef(b).slots} người`; continue; }
    sim.resetTask(v); sim.clearCombat(v); v.job = job; v.prefer = -1;
    planStaff(sim, v);
  }
  return err;
}

export function planStaff(sim: Sim, v: Villager): void {
  if (!isStaffJob(v.job)) return;
  const b = sim.building(STAFF_BUILDING[v.job]);
  if (!b) { v.job = 'idle'; return; }
  if (staffCount(sim, b) >= levelDef(b).slots) { v.job = 'idle'; sim.say(`${v.name} không còn chỗ trong ${BUILDINGS[b.kind].name.toLowerCase()}.`); return; }
  const d = BUILDINGS[b.kind];
  if (sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) { v.target = b.id; v.phase = 'goStaff'; return; }
  sim.wait(v, 3);
}

export function enterBuilding(sim: Sim, v: Villager): void {
  const b = sim.getBuilding(v.target);
  if (!b || !b.done || !isStaffJob(v.job) || STAFF_BUILDING[v.job] !== b.kind || b.staff.length >= levelDef(b).slots) { v.phase = 'idle'; if (isStaffJob(v.job)) v.job = 'idle'; return; }
  b.staff.push(v.id); v.inside = b.id; v.phase = 'inside'; v.path = []; v.slide = null;
  const d = BUILDINGS[b.kind]; v.x = b.x + d.w / 2; v.y = b.y + d.h / 2; v.facing = 'front';
  sim.say(`${v.name} vào ${BUILDINGS[b.kind].name.toLowerCase()} làm việc.`);
}

/** Step out of the house the villager works in; the job is the caller's to change. */
export function exitBuilding(sim: Sim, v: Villager): void {
  if (v.inside === null) return;
  const b = sim.getBuilding(v.inside);
  v.inside = null; v.phase = 'idle';
  if (!b) return;
  b.staff = b.staff.filter((id) => id !== v.id);
  const d = BUILDINGS[b.kind], ring = sim.ringTiles(v, b.x, b.y, d.w, d.h);
  const spot = ring[0] ?? [b.x - 1, b.y + d.h];
  v.x = spot[0] + 0.5; v.y = spot[1] + 0.5;
}

/** "Cho ra": send the staff out to the map, idle. */
export function releaseStaff(sim: Sim, ids: readonly number[]): void {
  for (const v of sim.mine(ids)) if (v.inside !== null) { exitBuilding(sim, v); v.job = 'idle'; sim.fogDirty = true; }
}
