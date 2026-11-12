/** Who works in which house: the builders' crew and the staff inside the craft and research houses. */
import { Building, BUILDINGS, levelDef } from './buildings';
import { CREW_BUILDING, isStaffJob, JOBS, STAFF_BUILDING, WorkJob } from './jobs';

import type { Sim } from './sim';
import { Villager } from './model';
import { isFree } from './idle';
import { isProcessKind } from './processdata';
import { perkPct } from './research';

/** How many people a house holds: the places of its level, and the places the research of its trade added (perk `slots_<kind>`). */
export const slotsOf = (sim: Sim, b: Building): number => levelDef(b).slots + perkPct(sim.researched, `slots_${b.kind}`);

// ---------------------------------------------------------------- working inside a house
/** The villager best suited to work in a house who is not already doing it: free hands first, soldiers never, then the best stat for the job. */
export function bestFor(sim: Sim, job: 'craft' | 'research' | 'tame' | 'herd'): Villager | null {
  const stat = JOBS[job].stat;
  const pool = sim.villagers.filter((v) => v.down <= 0 && v.inside === null && v.job !== job && v.job !== 'fight' && v.job !== 'hunt' && v.job !== 'scout' && v.job !== 'supply');
  pool.sort((a, b) => (isFree(a) ? 0 : 1) - (isFree(b) ? 0 : 1) || b.stats[stat] - a.stats[stat]);
  return pool[0] ?? null;
}

/** How fast a house gets through its active order: everyone inside, the house level and the dev speed-up. */
export function houseRate(sim: Sim, b: Building): number {
  const job: WorkJob = b.kind === 'lab' ? 'research' : b.kind === 'workshop' || isProcessKind(b.kind) ? 'craft' : b.kind === 'ranch' ? 'herd' : 'tame';
  let r = 0;
  for (const id of b.staff) { const v = sim.byId.get(id); if (v && v.phase === 'inside') r += sim.workFactor(v, job); }
  const perk = b.kind === 'workshop' ? perkPct(sim.researched, 'craftSpeed') : b.kind === 'lab' ? perkPct(sim.researched, 'researchSpeed') : b.kind === 'stable' ? perkPct(sim.researched, 'tameSpeed') : 0; // the research of the craftsmen and of the researchers
  return r * levelDef(b).craftSpeed * (1 + perk / 100) * (sim.dev.fastWorks ? 1e6 : 1);
}

/** Villagers heading for a house or already in it. */
/** The people of a house: those inside, those on their way, and those waiting for a way in (posted here but with no path yet). `self` is left out, so that a villager asking for his own place does not count himself. */
export function staffCount(sim: Sim, b: Building, self?: Villager): number {
  return b.staff.length + sim.villagers.filter((v) => v !== self && ((v.phase === 'goStaff' && v.target === b.id) || (v.phase === 'wait' && isStaffJob(v.job) && postOf(sim, v)?.id === b.id))).length;
}

/** Anyone may be given a place in a house: a soldier or a scout is let go from his camp first (he hands his gear back). Returns an error or null. */
function letGo(sim: Sim, v: Villager): string | null {
  return v.job === 'fight' || v.job === 'scout' ? sim.releaseRole([v.id]) : null;
}

/** The villagers whose job is building: the crew of the Nhà thợ xây. */
export function crew(sim: Sim): Villager[] { return sim.villagers.filter((v) => v.job === 'build'); }

/**
 * The Nhà thợ xây is the only way to put people to building, so when none stands finished (it fell, and a new foundation was laid) and nobody builds,
 * two free villagers take up the foundation by themselves; once it stands the crew is the player's to choose again. Called once a second.
 */
export function bootCrew(sim: Sim): void {
  if (crew(sim).length > 0 || sim.building(CREW_BUILDING.build) || !sim.buildings.some((b) => b.kind === CREW_BUILDING.build)) return;
  const free = sim.villagers.filter((v) => v.team === 'player' && v.job === 'idle' && !v.inside && v.health > 0 && v.phase !== 'sleep').slice(0, 2);
  for (const v of free) { sim.resetTask(v); sim.clearCombat(v); v.job = 'build'; v.prefer = -1; v.post = -1; }
}

/** Builders in, up to what the Nhà thợ xây holds. Returns an error or null. */
export function assignCrew(sim: Sim, ids: readonly number[]): string | null {
  const lock = sim.warLock(); if (lock) return lock;
  const house = sim.building(CREW_BUILDING.build);
  if (!house) return `Chưa có ${BUILDINGS.builder.name}, hoặc chưa xây xong`;
  let err: string | null = null;
  for (const v of sim.mine(ids)) {
    if (v.job === 'build') continue;
    const gone = letGo(sim, v); if (gone) { err = gone; continue; }
    if (crew(sim).length >= slotsOf(sim, house)) { err = `${BUILDINGS.builder.name} cấp ${house.level} chỉ chứa ${slotsOf(sim, house)} thợ`; continue; }
    sim.resetTask(v); sim.clearCombat(v); v.job = 'build'; v.prefer = -1; v.post = -1;
  }
  return err;
}

/** More builders than the house holds: the last ones go back to idle. */
export function trimCrew(sim: Sim): void {
  const house = sim.building('builder'), builders = crew(sim);
  if (house) for (const v of builders.slice(slotsOf(sim, house))) { sim.resetTask(v); v.job = 'idle'; }
}

/** Send builders back to idle. */
export function releaseCrew(sim: Sim, ids: readonly number[]): void {
  for (const v of sim.mine(ids)) if (v.job === 'build') { sim.resetTask(v); v.job = 'idle'; }
}

/** Put villagers to work inside the matching house (job craft or research). Returns an error or null. */
export function assignStaff(sim: Sim, ids: readonly number[], job: 'craft' | 'research' | 'tame' | 'herd'): string | null {
  const lock = sim.warLock(); if (lock) return lock;
  const b = sim.building(STAFF_BUILDING[job]);
  if (!b) return `Chưa có ${BUILDINGS[STAFF_BUILDING[job]].name}, hoặc chưa xây xong`;
  let err: string | null = null;
  for (const v of sim.mine(ids)) {
    if (v.inside === b.id) { v.job = job; continue; }
    const gone = letGo(sim, v); if (gone) { err = gone; continue; }
    if (staffCount(sim, b, v) >= slotsOf(sim, b)) { err = `${BUILDINGS[b.kind].name} cấp ${b.level} chỉ chứa ${slotsOf(sim, b)} người`; continue; }
    sim.resetTask(v); sim.clearCombat(v); v.job = job; v.prefer = -1; v.post = -1;
    planStaff(sim, v);
  }
  return err;
}

/** Put villagers to work on a Ruộng the player chose: they go inside and grow food for the store. Returns an error or null. */
export function assignField(sim: Sim, ids: readonly number[], fieldId: number): string | null {
  const lock = sim.warLock(); if (lock) return lock;
  const b = sim.getBuilding(fieldId);
  if (!b || b.kind !== 'field' || !b.done) return 'Ruộng chưa dựng xong';
  let err: string | null = null;
  for (const v of sim.mine(ids)) {
    if (v.post === b.id && v.job === 'food') continue;
    const gone = letGo(sim, v); if (gone) { err = gone; continue; }
    if (staffCount(sim, b, v) >= slotsOf(sim, b)) { err = `${BUILDINGS.field.name} cấp ${b.level} chỉ chứa ${slotsOf(sim, b)} người`; continue; }
    sim.resetTask(v); sim.clearCombat(v); v.job = 'food'; v.prefer = -1; v.post = b.id;
    planStaff(sim, v);
  }
  return err;
}

/** Sow a Ruộng with food or with flax (fibre, the medieval age). Returns an error or null. */
export function setCrop(sim: Sim, fieldId: number, crop: 'food' | 'flax'): string | null {
  const b = sim.getBuilding(fieldId);
  if (!b || b.kind !== 'field' || !b.done) return 'Ruộng chưa dựng xong';
  if (crop === 'flax' && sim.era !== 'ancient') return 'Trồng lanh chỉ có từ thời Trung cổ';
  b.crop = crop;
  for (const id of b.staff) { const v = sim.byId.get(id); if (v) v.progress = 0; } // what was half grown of the other crop is lost
  return null;
}

/** Put villagers to work in a processing house the player chose (job craft, posted to it). Returns an error or null. */
export function assignProcessing(sim: Sim, ids: readonly number[], houseId: number): string | null {
  const lock = sim.warLock(); if (lock) return lock;
  const b = sim.getBuilding(houseId);
  if (!b || !b.done || !isProcessKind(b.kind)) return 'Nhà chưa dựng xong';
  let err: string | null = null;
  for (const v of sim.mine(ids)) {
    if (v.post === b.id && v.job === 'craft') continue;
    const gone = letGo(sim, v); if (gone) { err = gone; continue; }
    if (staffCount(sim, b, v) >= slotsOf(sim, b)) { err = `${BUILDINGS[b.kind].name} cấp ${b.level} chỉ chứa ${slotsOf(sim, b)} người`; continue; }
    sim.resetTask(v); sim.clearCombat(v); v.job = 'craft'; v.prefer = -1; v.post = b.id;
    planStaff(sim, v);
  }
  return err;
}

/** The house this villager is posted to: the one of their staff job, or the Ruộng the player gave them. */
function postOf(sim: Sim, v: Villager): Building | undefined {
  if (v.job === 'craft' && v.post >= 0) { const p = sim.getBuilding(v.post); if (p && isProcessKind(p.kind)) return p; } // a craftsman of a processing house is posted to it
  if (isStaffJob(v.job)) return sim.building(STAFF_BUILDING[v.job]);
  const b = (v.job === 'food' || v.job === 'fight') && v.post >= 0 ? sim.getBuilding(v.post) : undefined;
  return b && (v.job === 'food' ? b.kind === 'field' : b.kind === 'tower') ? b : undefined;
}

export function planStaff(sim: Sim, v: Villager): void {
  if (!isStaffJob(v.job) && !((v.job === 'food' || v.job === 'fight') && v.post >= 0)) return;
  const b = postOf(sim, v);
  if (!b) { if (v.job === 'food' || v.job === 'fight') v.post = -1; else v.job = 'idle'; return; }
  if (staffCount(sim, b, v) >= slotsOf(sim, b)) { if (v.job !== 'fight') v.job = 'idle'; v.post = -1; sim.say(`${v.name} không còn chỗ trong ${BUILDINGS[b.kind].name.toLowerCase()}.`); return; }
  const d = BUILDINGS[b.kind];
  if (sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h), 8) >= 0) { v.target = b.id; v.phase = 'goStaff'; return; }
  sim.wait(v, 3);
}

export function enterBuilding(sim: Sim, v: Villager): void {
  const b = sim.getBuilding(v.target);
  if (!b || !b.done || postOf(sim, v)?.id !== b.id || b.staff.length >= slotsOf(sim, b)) {
    if (b) sim.say(`${v.name} không vào làm ở ${BUILDINGS[b.kind].name.toLowerCase()} được: ${!b.done ? 'nhà chưa xong' : postOf(sim, v)?.id !== b.id ? 'việc của họ thuộc một nhà khác cùng loại' : 'nhà đã đủ người'}.`); // said, so that nobody is turned away without a word
    v.phase = 'idle'; if (isStaffJob(v.job)) v.job = 'idle'; return;
  }
  b.staff.push(v.id); v.inside = b.id; v.phase = 'inside'; v.path = []; v.slide = null;
  const d = BUILDINGS[b.kind]; v.x = b.x + d.w / 2; v.y = b.y + d.h / 2; v.facing = 'front';
  sim.say(`${v.name} vào ${BUILDINGS[b.kind].name.toLowerCase()} làm việc.`);
}

/** Lie down in a bed of the house they came to (the Nhà dân or the Lều chiến binh): out of sight, listed in the house, no sleeping drawing. */
export function sleepIn(sim: Sim, v: Villager, b: Building): void {
  v.inside = b.id; v.phase = 'sleep'; v.path = []; v.slide = null; v.target = -1; v.bed = -1;
  const d = BUILDINGS[b.kind]; v.x = b.x + d.w / 2; v.y = b.y + d.h / 2; v.facing = 'front';
  sim.fogDirty = true;
}

/** Villagers asleep inside a house, and those on their way to its beds. */
export function sleepers(sim: Sim, b: Building): Villager[] {
  return sim.villagers.filter((v) => (v.phase === 'sleep' && v.inside === b.id) || (v.phase === 'goHome' && v.target === b.id));
}

/** Step out of the house the villager works or sleeps in; the job is the caller's to change. */
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
  if (sim.warLock()) return;
  for (const v of sim.mine(ids)) if (v.inside !== null) { exitBuilding(sim, v); v.job = 'idle'; v.post = -1; sim.fogDirty = true; }
}
