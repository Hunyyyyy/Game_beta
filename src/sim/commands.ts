/** What the player tells villagers to do: move, work, fight, hold, change job. */
import { needsWork } from './buildings';
import { Job, JOB_NAME, WorkJob } from './jobs';
import { resolve } from './battle';
import { animalDef } from './fauna';
import { farFolk, isFree } from './idle';
import type { Sim } from './sim';
import { hash2 } from './rng';
import { NODE_JOB, Target, Villager } from './model';

// ---------------------------------------------------------------- lệnh
export function resetTask(sim: Sim, v: Villager): void {
  sim.leaveNode(v); sim.exitBuilding(v); v.order = null;
  v.path = []; v.slide = null; v.phase = 'idle'; v.progress = 0; v.timer = 0; v.target = -1; v.bed = -1; v.breaks = null;
  // an order given at night does not wake anyone: they are back in bed at once and start the job in the morning
}

/**
 * An order given to someone off shift calls them up when they can work: a soldier stands watch, a worker needs a torch at night.
 * Otherwise the order waits for their shift (and a worn-out sleeper is not woken at all).
 */
export function keepWatch(sim: Sim, v: Villager): void {
  if (v.job !== 'idle') sim.callUp(v);
}

/** The campfire's call: free villagers who are far from the village walk home (and keep the day's hours again). Returns how many were called. */
export function recallFar(sim: Sim): number {
  const fire = sim.campfire(), far = farFolk(sim);
  if (!far.length) return 0;
  const sx = fire ? fire.x + 1 : sim.world.start.x, sy = fire ? fire.y + 3 : sim.world.start.y + 3;
  orderMove(sim, far.map((v) => v.id), Math.floor(sx), Math.floor(sy));
  for (const v of far) if (v.job === 'idle') v.shift = 'day';
  return far.length;
}

/** Drop every combat order of a unit (a new plain order replaces them). */
export function clearCombat(sim: Sim, v: Villager): void {
  v.fight.target = null; v.fight.mode = 'none'; v.fight.dest = null; v.fight.anchor = null; v.fight.strict = false; v.queue.length = 0; v.loot = -1; v.fleeT = 0;
}

export function mine(sim: Sim, ids: readonly number[]): Villager[] {
  // someone worn out asleep cannot be woken, and a scout out on a trip answers to no order until he is home
  return ids.map((id) => sim.byId.get(id)).filter((v): v is Villager => !!v && v.team === 'player' && v.down <= 0 && !sim.sleepLocked(v) && !sim.scouts.some((m) => m.ids.includes(v.id)));
}

/** A unit that is already doing something takes a Shift-queued order after it. */
export function busy(sim: Sim, v: Villager): boolean {
  return v.phase !== 'idle' || v.path.length > 0 || v.fight.mode !== 'none';
}

/** A plain order ends a civilian's job, but soldiers, scouts and hunters stay what they are. */
export function keepSoldierJob(sim: Sim, v: Villager): void { if (v.job !== 'fight' && v.job !== 'hunt' && v.job !== 'scout') v.job = 'idle'; }

/** Lệnh đi: mỗi dân nhận một ô đích riêng quanh điểm chọn; dân thôi làm nghề. With `queue`, the move waits its turn. */
export function orderMove(sim: Sim, ids: readonly number[], tx: number, ty: number, queue = false): void {
  const vs = mine(sim, ids);
  vs.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
  const taken = new Set<number>();
  for (const v of vs) {
    if (queue && busy(sim, v)) { v.queue.push({ k: 'move', x: tx, y: ty }); continue; }
    const goal = sim.nearestFree(tx, ty, taken);
    resetTask(sim, v); clearCombat(sim, v); v.prefer = -1;
    keepSoldierJob(sim, v); keepWatch(sim, v);
    if (v.job === 'idle') v.shift = 'both'; // sent out by hand: they go on by night too, and turn back by themselves when their strength runs low (see rest.onShift, the notices)
    if (!goal) continue;
    taken.add(goal[1] * sim.world.size + goal[0]);
    // a soldier who is sent somewhere stands guard there afterwards
    if (v.job === 'fight') { v.fight.mode = 'guard'; v.fight.anchor = { x: goal[0] + 0.5, y: goal[1] + 0.5 }; }
    // finding a way is the dear part of an order given to hundreds: past the budget of this tick a soldier is left to walk to his post when his turn comes
    if (v.job === 'fight' && sim.pathLeft <= 0) { v.phase = 'idle'; continue; }
    if (v.job === 'fight') sim.pathLeft--;
    v.path = sim.pathTo(v, goal[0], goal[1], 30000);
    v.phase = v.path.length ? 'move' : 'idle';
  }
}

/**
 * The Khai thác button of a tree, rock or bush: one of the three villagers nearest to it who have the matching job (chosen by chance, not by the
 * player) is sent to work that very one. Gives the name of who went, or why nobody could.
 */
export function callWorker(sim: Sim, tx: number, ty: number): { name: string } | { reason: string } {
  const node = sim.world.nodeAt(tx, ty);
  if (!node || sim.fog.state[ty * sim.world.size + tx] === 0) return { reason: 'Không còn gì để khai thác ở đây' };
  if (node.amount <= 0) return { reason: 'Bụi quả đã hết quả, chờ mọc lại' };
  const job = NODE_JOB[node.kind];
  const pool = mine(sim, sim.villagers.map((v) => v.id)).filter((v) => v.job === job && v.inside === null && v.post < 0 && v.phase !== 'sleep' && v.prefer !== ty * sim.world.size + tx);
  if (!pool.length) return { reason: job === 'wood' ? 'Chưa có ai làm nghề đốn gỗ: giao nghề ở Xưởng gỗ' : job === 'stone' ? 'Chưa có ai làm thợ đá: giao nghề ở Xưởng đá' : 'Chưa có ai hái lượm: giao nghề ở Nông trại' };
  pool.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
  const near = pool.slice(0, 3), v = near[Math.floor(hash2(tx, ty, Math.floor(sim.time)) * near.length) % near.length];
  orderWork(sim, [v.id], tx, ty);
  return { name: v.name };
}

/**
 * Click on a tree, rock, bush or building site: those who already have the matching job go to this very one. A villager with no job at all
 * takes that job first, if its house is built and has a place left (`err` says why not); a villager who has another job is left alone (jobs
 * change only in the house of the job). Null when the spot is not a place of work.
 */
export function orderWork(sim: Sim, ids: readonly number[], tx: number, ty: number): { job: WorkJob; sent: number; err: string | null } | null {
  if (!sim.world.inBounds(tx, ty)) return null;
  const idx = ty * sim.world.size + tx;
  const node = sim.world.nodeAt(tx, ty), site = sim.buildingAt(tx, ty);
  let job: WorkJob | null = null, prefer = -1;
  if (node && sim.fog.state[idx] > 0) { job = NODE_JOB[node.kind]; prefer = idx; }
  else if (site && needsWork(site)) { job = 'build'; prefer = site.id; }
  if (!job) return null;
  // the one exception: before any Nhà thợ xây stands nobody can be a builder, so whoever is sent raises the very first one
  const first = !!site && site.kind === 'builder' && !sim.building('builder');
  let err: string | null = null;
  if (node && (job === 'wood' || job === 'stone' || job === 'food')) {
    const idle = mine(sim, ids).filter(isFree).map((v) => v.id);
    if (idle.length) err = sim.assignRole(idle, job);
  }
  const workers = mine(sim, ids).filter((v) => v.job === job || (first && v.job !== 'fight'));
  for (const v of workers) {
    resetTask(sim, v); clearCombat(sim, v); v.job = job; v.prefer = prefer;
  }
  return { job, sent: workers.length, err };
}

/** Click on prey or a carcass: a villager with no job becomes a hunter first, if the Chòi thợ săn has a place left. Returns why not, or null. */
export function autoHunter(sim: Sim, ids: readonly number[], target: Target): string | null {
  const e = resolve(sim, target);
  if (e?.kind !== 'animal' || (e.a.state !== 'dead' && !animalDef(e.a).prey)) return null;
  const idle = mine(sim, ids).filter(isFree).map((v) => v.id);
  return idle.length ? sim.assignRole(idle, 'hunt') : null;
}

/**
 * Give villagers a job with the job buttons. Craft, research and tame mean working inside the matching house; the result is an error
 * or null. Soldiers belong to the campfire's roster (enlist, discharge) and keep their post until discharged there.
 */
export function setJob(sim: Sim, ids: readonly number[], job: Job): string | null {
  const lock = sim.warLock(); if (lock) return lock;
  if (job === 'fight') return enlist(sim, ids) > 0 ? null : 'Chọn dân thường để tuyển làm chiến binh';
  if (job === 'scout') return sim.enlistScouts(ids);
  const soldiers = mine(sim, ids).filter((v) => v.job === 'fight'), scouts = mine(sim, ids).filter((v) => v.job === 'scout');
  const rest = ids.filter((id) => !soldiers.some((s) => s.id === id) && !scouts.some((s) => s.id === id));
  const err = jobFor(sim, rest, job);
  return err ?? (soldiers.length ? 'Chiến binh do trại lính của họ quản lý: cho họ nghỉ ở đó trước' : scouts.length ? 'Trinh sát do Trại trinh sát quản lý: cho họ nghỉ ở đó trước' : null);
}

function jobFor(sim: Sim, ids: readonly number[], job: Job): string | null {
  if (job === 'craft' || job === 'research' || job === 'tame') return sim.assignStaff(ids, job);
  if (job === 'build') return sim.assignCrew(ids);
  for (const v of mine(sim, ids)) {
    resetTask(sim, v); clearCombat(sim, v); v.job = job; v.prefer = -1; v.post = -1;
    keepWatch(sim, v);
  }
  return null;
}

// ---------------------------------------------------------------- the roster of soldiers (kept at the campfire)
/** Take villagers into the army; returns how many were. They stand watch at the fire (at night too). */
export function enlist(sim: Sim, ids: readonly number[]): number {
  let n = 0;
  for (const v of mine(sim, ids)) {
    if (v.job === 'fight' || v.job === 'scout') continue;
    resetTask(sim, v); clearCombat(sim, v); v.job = 'fight'; v.prefer = -1; v.post = -1; v.fight.anchor = null;
    keepWatch(sim, v); n++;
  }
  return n;
}

/** Soldiers go back to being plain villagers with no job; their weapon and armour go back to the store. Returns how many. */
export function discharge(sim: Sim, ids: readonly number[]): number {
  let n = 0;
  for (const v of mine(sim, ids)) {
    if (v.job !== 'fight') continue;
    resetTask(sim, v); clearCombat(sim, v); v.job = 'idle'; v.nightOwl = false; v.post = -1;
    sim.assignGear([v.id], null, 'weapon'); sim.assignGear([v.id], null, 'armor'); v.manualGear = false;
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- combat orders
/** What the point (tile units) shows that can be fought or looted: living foes, animals, or a carcass. */
export function targetAt(sim: Sim, x: number, y: number): { target: Target; kind: 'foe' | 'animal' | 'carcass' } | null {
  const N = sim.world.size, seen = (px: number, py: number) => sim.fog.state[Math.floor(py) * N + Math.floor(px)] === 2;
  let best: { target: Target; kind: 'foe' | 'animal' | 'carcass' } | null = null, bd = 0.9;
  for (const f of sim.foes) {
    if (f.health <= 0 || !seen(f.x, f.y)) continue;
    const d = Math.hypot(f.x - x, f.y - 0.5 - y);
    if (d < bd) { bd = d; best = { target: { kind: 'unit', id: f.id }, kind: 'foe' }; }
  }
  for (const a of sim.animals) {
    if (!seen(a.x, a.y)) continue;
    const d = Math.hypot(a.x - x, a.y - 0.3 - y);
    if (d < bd) { bd = d; best = { target: { kind: 'animal', id: a.id }, kind: a.state === 'dead' ? 'carcass' : 'animal' }; }
  }
  return best;
}

/**
 * Right click on an enemy, animal or carcass. Soldiers fight anything; hunters take prey; nobody else is touched (a click never
 * changes a job). Returns how many took the order.
 */
export function orderAttack(sim: Sim, ids: readonly number[], target: Target, queue = false): number {
  const e = resolve(sim, target);
  const prey = e?.kind === 'animal' && e.a.state !== 'dead' && animalDef(e.a).prey;
  let n = 0;
  for (const v of mine(sim, ids)) {
    if (!(v.job === 'fight' || (prey && v.job === 'hunt'))) continue;
    n++;
    if (queue && busy(sim, v)) { v.queue.push({ k: 'attack', t: target }); continue; }
    resetTask(sim, v); clearCombat(sim, v); v.prefer = -1;
    v.fight.mode = 'attack'; v.fight.target = target;
    keepWatch(sim, v);
  }
  return n;
}

/** Walk to a point and fight whatever is met on the way (soldiers only). */
export function orderAttackMove(sim: Sim, ids: readonly number[], x: number, y: number, queue = false): void {
  for (const v of mine(sim, ids)) {
    if (v.job !== 'fight') continue;
    if (queue && busy(sim, v)) { v.queue.push({ k: 'attackMove', x, y }); continue; }
    resetTask(sim, v); clearCombat(sim, v); v.prefer = -1;
    v.fight.mode = 'attackMove'; v.fight.dest = { x, y }; v.phase = 'move';
    keepWatch(sim, v);
  }
}

/** Right click on a dead animal: hunters go and skin it. Returns how many went. */
export function orderLoot(sim: Sim, ids: readonly number[], animalId: number): number {
  let n = 0;
  for (const v of mine(sim, ids)) {
    if (v.job !== 'hunt') continue;
    resetTask(sim, v); clearCombat(sim, v); v.loot = animalId; v.phase = 'goCarcass'; n++;
  }
  return n;
}

/** H: stand here and only hit what comes close (soldiers and hunters). */
export function orderHold(sim: Sim, ids: readonly number[]): void {
  for (const v of mine(sim, ids)) {
    if (v.job !== 'fight' && v.job !== 'hunt') continue;
    resetTask(sim, v); clearCombat(sim, v);
    v.fight.mode = 'hold'; v.fight.anchor = { x: v.x, y: v.y };
    keepWatch(sim, v);
  }
}

/** G: stop everything, keep the job. */
export function orderStop(sim: Sim, ids: readonly number[]): void {
  for (const v of mine(sim, ids)) { resetTask(sim, v); clearCombat(sim, v); if (v.job === 'fight') { v.fight.mode = 'hold'; v.fight.anchor = { x: v.x, y: v.y }; keepWatch(sim, v); } }
}

export function setStance(sim: Sim, ids: readonly number[], stance: 'aggressive' | 'defensive' | 'retreat'): void {
  for (const v of mine(sim, ids)) { v.stance = stance; if (stance === 'defensive') v.fight.anchor = v.fight.anchor ?? { x: v.x, y: v.y }; else if (v.fight.mode !== 'hold') v.fight.anchor = null; }
}

/** Start the next queued order, if any. Returns true when something started. */
export function nextOrder(sim: Sim, v: Villager): boolean {
  const o = v.queue.shift();
  if (!o) return false;
  resetTask(sim, v);
  if (o.k === 'move') {
    v.fight.mode = 'none'; v.fight.target = null;
    const goal = sim.nearestFree(Math.floor(o.x), Math.floor(o.y), new Set());
    if (goal) { v.path = sim.pathTo(v, goal[0], goal[1], 30000); v.phase = v.path.length ? 'move' : 'idle'; if (v.job === 'fight') { v.fight.mode = 'guard'; v.fight.anchor = { x: goal[0] + 0.5, y: goal[1] + 0.5 }; } }
  } else if (o.k === 'attackMove') { v.fight.mode = 'attackMove'; v.fight.dest = { x: o.x, y: o.y }; v.phase = 'move'; }
  else { v.fight.mode = 'attack'; v.fight.target = o.t; }
  return true;
}
