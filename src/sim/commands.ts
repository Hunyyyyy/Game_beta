/** What the player tells villagers to do: move, work, fight, hold, change job. */
import { needsWork } from './buildings';
import { Job, JOB_NAME, WorkJob } from './jobs';
import { resolve } from './battle';
import { animalDef } from './fauna';
import type { Sim } from './sim';
import { NODE_JOB, Target, Villager } from './model';

// ---------------------------------------------------------------- lệnh
export function resetTask(sim: Sim, v: Villager): void {
  sim.leaveNode(v); sim.exitBuilding(v); v.order = null;
  v.path = []; v.slide = null; v.phase = 'idle'; v.progress = 0; v.timer = 0; v.target = -1; v.bed = -1;
  // an order given at night does not wake anyone: they are back in bed at once and start the job in the morning
}

/** Drop every combat order of a unit (a new plain order replaces them). */
export function clearCombat(sim: Sim, v: Villager): void {
  v.fight.target = null; v.fight.mode = 'none'; v.fight.dest = null; v.fight.anchor = null; v.queue.length = 0; v.loot = -1; v.fleeT = 0;
}

export function mine(sim: Sim, ids: readonly number[]): Villager[] {
  return ids.map((id) => sim.byId.get(id)).filter((v): v is Villager => !!v && v.team === 'player' && v.down <= 0);
}

/** A unit that is already doing something takes a Shift-queued order after it. */
export function busy(sim: Sim, v: Villager): boolean {
  return v.phase !== 'idle' || v.path.length > 0 || v.fight.mode !== 'none';
}

/** A plain order ends a civilian's job, but soldiers and hunters stay what they are. */
export function keepSoldierJob(sim: Sim, v: Villager): void { if (v.job !== 'fight' && v.job !== 'hunt') v.job = 'idle'; }

/** Lệnh đi: mỗi dân nhận một ô đích riêng quanh điểm chọn; dân thôi làm nghề. With `queue`, the move waits its turn. */
export function orderMove(sim: Sim, ids: readonly number[], tx: number, ty: number, queue = false): void {
  const vs = mine(sim, ids);
  vs.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
  const taken = new Set<number>();
  for (const v of vs) {
    if (queue && busy(sim, v)) { v.queue.push({ k: 'move', x: tx, y: ty }); continue; }
    const goal = sim.nearestFree(tx, ty, taken);
    resetTask(sim, v); clearCombat(sim, v); v.prefer = -1;
    keepSoldierJob(sim, v);
    if (!goal) continue;
    taken.add(goal[1] * sim.world.size + goal[0]);
    v.path = sim.pathTo(v, goal[0], goal[1], 30000);
    v.phase = v.path.length ? 'move' : 'idle';
    // a soldier who is sent somewhere stands guard there afterwards
    if (v.job === 'fight') { v.fight.mode = 'guard'; v.fight.anchor = { x: goal[0] + 0.5, y: goal[1] + 0.5 }; }
  }
}

/** Chuột phải lên cây/đá/bụi quả/công trình: giao nghề tương ứng. Trả về tên việc hoặc null. */
export function orderWork(sim: Sim, ids: readonly number[], tx: number, ty: number): string | null {
  if (!sim.world.inBounds(tx, ty)) return null;
  const idx = ty * sim.world.size + tx;
  const node = sim.world.nodeAt(tx, ty), site = sim.buildingAt(tx, ty);
  let job: WorkJob | null = null, prefer = -1;
  if (node && sim.fog.state[idx] > 0) { job = NODE_JOB[node.kind]; prefer = idx; }
  else if (site && needsWork(site)) { job = 'build'; prefer = site.id; }
  if (!job) return null;
  // only the crew of the Nhà thợ xây raises buildings; the very first house may be raised by whoever is sent
  const first = !!site && site.kind === 'builder' && !sim.building('builder');
  const workers = mine(sim, ids).filter((v) => job !== 'build' || v.job === 'build' || first);
  if (!workers.length) return null;
  for (const v of workers) {
    resetTask(sim, v); clearCombat(sim, v); v.job = job; v.prefer = prefer;
  }
  return JOB_NAME[job];
}

/** Give villagers a job. Craft, research and repair mean working inside the matching house; the result is an error or null. */
export function setJob(sim: Sim, ids: readonly number[], job: Job): string | null {
  if (job === 'craft' || job === 'research' || job === 'repair') return sim.assignStaff(ids, job);
  if (job === 'build') return sim.assignCrew(ids);
  for (const v of mine(sim, ids)) {
    resetTask(sim, v); clearCombat(sim, v); v.job = job; v.prefer = -1;
    if (job === 'fight' && v.fight.mode === 'none') v.fight.anchor = null;
  }
  return null;
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

/** Right click on an enemy, animal or carcass. Prey goes to hunters; everything else is a fight. */
export function orderAttack(sim: Sim, ids: readonly number[], target: Target, queue = false): void {
  const e = resolve(sim, target);
  const prey = e?.kind === 'animal' && e.a.state !== 'dead' && animalDef(e.a).prey;
  for (const v of mine(sim, ids)) {
    if (queue && busy(sim, v)) { v.queue.push({ k: 'attack', t: target }); continue; }
    resetTask(sim, v); clearCombat(sim, v); v.prefer = -1;
    if (!(v.job === 'fight' || (prey && v.job === 'hunt'))) v.job = prey ? 'hunt' : 'fight';
    v.fight.mode = 'attack'; v.fight.target = target;
  }
}

/** Walk to a point and fight whatever is met on the way. */
export function orderAttackMove(sim: Sim, ids: readonly number[], x: number, y: number, queue = false): void {
  for (const v of mine(sim, ids)) {
    if (queue && busy(sim, v)) { v.queue.push({ k: 'attackMove', x, y }); continue; }
    resetTask(sim, v); clearCombat(sim, v); v.prefer = -1; v.job = 'fight';
    v.fight.mode = 'attackMove'; v.fight.dest = { x, y }; v.phase = 'move';
  }
}

/** Right click on a dead animal: go and skin it. */
export function orderLoot(sim: Sim, ids: readonly number[], animalId: number): void {
  for (const v of mine(sim, ids)) { resetTask(sim, v); clearCombat(sim, v); v.job = 'hunt'; v.loot = animalId; v.phase = 'goCarcass'; }
}

/** H: stand here and only hit what comes close. */
export function orderHold(sim: Sim, ids: readonly number[]): void {
  for (const v of mine(sim, ids)) {
    resetTask(sim, v); clearCombat(sim, v); if (v.job !== 'hunt') v.job = 'fight';
    v.fight.mode = 'hold'; v.fight.anchor = { x: v.x, y: v.y };
  }
}

/** G: stop everything, keep the job. */
export function orderStop(sim: Sim, ids: readonly number[]): void {
  for (const v of mine(sim, ids)) { resetTask(sim, v); clearCombat(sim, v); if (v.job === 'fight') { v.fight.mode = 'hold'; v.fight.anchor = { x: v.x, y: v.y }; } }
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
  } else if (o.k === 'attackMove') { v.job = 'fight'; v.fight.mode = 'attackMove'; v.fight.dest = { x: o.x, y: o.y }; v.phase = 'move'; }
  else { v.job = v.job === 'hunt' ? 'hunt' : 'fight'; v.fight.mode = 'attack'; v.fight.target = o.t; }
  return true;
}
