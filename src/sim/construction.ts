/** Placing, upgrading, moving and demolishing buildings, and what the buildings give the village (room, population, build speed). */
import { Building, BuildingKind, BUILDINGS, holdsGoods, levelDef, levelsOf, maxLevel, levelCapByFire, POP_BY_FIRE } from './buildings';
import { isStaffJob } from './jobs';
import { Res, RES_NAME, Stock } from './resources';
import { buildingOpen, levelCap, techForBuilding, techForLevel } from './research';
import type { Sim } from './sim';
import { PlaceResult } from './model';

// ---------------------------------------------------------------- công trình
export function addBuilding(sim: Sim, kind: BuildingKind, x: number, y: number, done: boolean): Building {
  const d = BUILDINGS[kind];
  const b: Building = { id: sim.nextBid++, kind, era: sim.era, x, y, level: 1, progress: done ? 1 : 0, done, upgrading: false, rebuild: false, staff: [], active: null, workers: 0 };
  sim.buildings.push(b);
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) sim.world.occ[(y + j) * sim.world.size + x + i] = 1;
  return b;
}

/** Why the footprint of `kind` at (x, y) is unusable, or null. `ignore` is a building that is being moved and may overlap itself. */
export function footprintError(sim: Sim, kind: BuildingKind, x: number, y: number, ignore?: Building): string | null {
  const d = BUILDINGS[kind], w = sim.world, N = w.size;
  const own = (tx: number, ty: number) => !!ignore && tx >= ignore.x && tx < ignore.x + d.w && ty >= ignore.y && ty < ignore.y + d.h;
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
    const tx = x + i, ty = y + j;
    if (!w.inBounds(tx, ty)) return 'Ngoài bản đồ';
    const k = ty * N + tx;
    if (sim.fog.state[k] === 0) return 'Chưa khám phá';
    const t = w.tiles[k];
    if ((t !== 0 && t !== 4) || (w.occ[k] && !own(tx, ty))) return 'Vướng cây, đá, nước hoặc công trình';
  }
  return null;
}

/** Why a kind of building cannot be built at all right now: one per game, and some need research first. */
export function buildingLock(sim: Sim, kind: BuildingKind): string | null {
  if (sim.buildings.some((b) => b.kind === kind)) return 'Mỗi công trình chỉ xây được một cái, hãy nâng cấp nó';
  const need = sim.dev.freeBuild ? undefined : BUILDINGS[kind].requires?.find((r) => !sim.building(r));
  if (need) return `Cần dựng ${BUILDINGS[need].name} trước`;
  if (!sim.dev.freeBuild && !buildingOpen(sim.researched, kind)) return `Cần nghiên cứu: ${techForBuilding(kind)?.name ?? '?'}`;
  return null;
}

/** Trả về lý do không đặt được, hoặc null nếu đặt được. */
export function canPlace(sim: Sim, kind: BuildingKind, x: number, y: number): string | null {
  return footprintError(sim, kind, x, y) ?? buildingLock(sim, kind) ?? (sim.dev.freeBuild ? null : sim.missing(levelsOf(kind, sim.era)[0].cost));
}

/** Reason the building cannot be upgraded now, or null. */
export function canUpgrade(sim: Sim, b: Building): string | null {
  if (!b.done) return 'Công trình chưa dựng xong';
  if (b.upgrading) return 'Đang nâng cấp';
  if (b.level >= maxLevel(b.kind, b.era)) return 'Đã ở cấp cao nhất';
  if (b.level + 1 > levelCap(sim.researched, b.kind)) return `Cần nghiên cứu: ${techForLevel(b.kind, b.level + 1)?.name ?? '?'}`;
  const fire = sim.campfire();
  if (b.kind !== 'campfire' && fire && !sim.dev.freeBuild && b.level + 1 > levelCapByFire(fire.level)) return `Cần nâng ${BUILDINGS.campfire.name} lên cấp ${b.level + 2}`;
  return sim.dev.freeBuild ? null : sim.missing(levelDef(b, b.level + 1).cost);
}

/** Pay for the next level; builders then work on it while the building keeps its current level. */
export function upgradeBuilding(sim: Sim, id: number): string | null {
  const b = sim.getBuilding(id);
  if (!b) return 'Không tìm thấy công trình';
  const why = canUpgrade(sim, b);
  if (why) return why;
  const next = levelDef(b, b.level + 1);
  if (!sim.dev.freeBuild) for (const r of Object.keys(next.cost) as Res[]) sim.stock[r] -= next.cost[r] ?? 0;
  if (sim.dev.instantBuild) { b.level++; sim.say(`${BUILDINGS[b.kind].name} lên cấp ${b.level} ngay (dev).`); return null; }
  b.upgrading = true; b.progress = 0;
  sim.say(`Bắt đầu nâng ${BUILDINGS[b.kind].name} lên cấp ${b.level + 1} (${next.name.toLowerCase()}). Giao việc "Thợ xây" để làm.`);
  return null;
}

export function placeBuilding(sim: Sim, kind: BuildingKind, x: number, y: number): PlaceResult {
  const d = BUILDINGS[kind];
  if (!d.buildable) return { ok: false, reason: 'Không xây được công trình này' };
  const why = canPlace(sim, kind, x, y);
  if (why) return { ok: false, reason: why };
  const cost = levelsOf(kind, sim.era)[0].cost;
  if (!sim.dev.freeBuild) for (const r of Object.keys(cost) as Res[]) sim.stock[r] -= cost[r] ?? 0;
  const b = addBuilding(sim, kind, x, y, false);
  if (sim.dev.instantBuild) { b.progress = 1; b.done = true; sim.fogDirty = true; sim.say(`${d.name} đã dựng xong ngay (dev).`); return { ok: true, building: b }; }
  sim.say(`Đã đặt nền ${d.name}. Giao việc "Thợ xây" để dựng.`);
  return { ok: true, building: b };
}

// ---------------------------------------------------------------- demolish and move
/** Materials paid so far for a building: every level reached, plus a running upgrade. */
export function invested(sim: Sim, b: Building): Partial<Stock> {
  const out: Partial<Stock> = {};
  const add = (c: Partial<Stock>) => { for (const r of Object.keys(c) as Res[]) out[r] = (out[r] ?? 0) + (c[r] ?? 0); };
  for (let l = 1; l <= b.level; l++) add(levelDef(b, l).cost);
  if (b.upgrading) add(levelDef(b, b.level + 1).cost);
  return out;
}

/** What tearing a building down gives back: half of what was paid (nothing in free-build mode). */
export function salvage(sim: Sim, b: Building): Partial<Stock> {
  const out: Partial<Stock> = {}, paid = invested(sim, b);
  if (!sim.dev.freeBuild) for (const r of Object.keys(paid) as Res[]) { const n = Math.floor((paid[r] ?? 0) * 0.5); if (n > 0) out[r] = n; }
  return out;
}

/** What moving a finished building costs: a fifth of what was paid. An unfinished one moves for free. */
export function moveFee(sim: Sim, b: Building): Partial<Stock> {
  const out: Partial<Stock> = {};
  if (!b.done || sim.dev.freeBuild) return out;
  const paid = invested(sim, b);
  for (const r of Object.keys(paid) as Res[]) { const n = Math.ceil((paid[r] ?? 0) * 0.2); if (n > 0) out[r] = n; }
  return out;
}

/** Send everyone who was heading for or working at this building back to idle; an order in progress is refunded. */
export function evict(sim: Sim, b: Building): void {
  for (const id of [...b.staff]) { const v = sim.byId.get(id); if (v) { sim.exitBuilding(v); v.job = 'idle'; } }
  b.staff = [];
  if (b.kind === 'builder') for (const v of sim.crew()) { sim.resetTask(v); v.job = 'idle'; }
  if (b.active && (b.kind === 'lab' || b.kind === 'workshop')) { const d = sim.orderDef(b.kind === 'lab' ? 'research' : 'craft', b.active.id); if (d) sim.pay(d.cost, 1); }
  b.active = null;
  // sleepers are put out of their beds; being tired still, they look for another bed at once
  for (const v of sim.sleepers(b)) { sim.exitBuilding(v); v.phase = 'idle'; v.target = -1; v.path = []; }
  for (const v of sim.villagers) {
    if (v.target !== b.id) continue;
    if (v.phase === 'goSite' || v.phase === 'build' || v.phase === 'goEquip' || v.phase === 'goStaff' || v.phase === 'goOrder') { if (isStaffJob(v.job)) v.job = 'idle'; sim.resetTask(v); }
  }
}

export function setOcc(sim: Sim, b: Building, val: number): void {
  const d = BUILDINGS[b.kind];
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) sim.world.occ[(b.y + j) * sim.world.size + b.x + i] = val;
}

export function canDemolish(sim: Sim, b: Building): string | null { return BUILDINGS[b.kind].buildable ? null : 'Không phá được công trình này'; }

export function demolishBuilding(sim: Sim, id: number): string | null {
  const b = sim.getBuilding(id);
  if (!b) return 'Không tìm thấy công trình';
  const why = canDemolish(sim, b);
  if (why) return why;
  const back = salvage(sim, b);
  evict(sim, b);
  setOcc(sim, b, 0);
  sim.buildings.splice(sim.buildings.indexOf(b), 1);
  for (const r of Object.keys(back) as Res[]) sim.stock[r] += back[r] ?? 0;
  sim.fogDirty = true;
  sim.say(`Đã phá ${BUILDINGS[b.kind].name.toLowerCase()}${Object.keys(back).length ? `, thu lại ${Object.keys(back).map((r) => `${back[r as Res]} ${RES_NAME[r as Res].toLowerCase()}`).join(', ')}` : ''}.`);
  return null;
}

/** Why the building cannot go to (x, y), or null. */
export function canMove(sim: Sim, b: Building, x: number, y: number): string | null {
  if (!BUILDINGS[b.kind].buildable) return 'Không dời được công trình này';
  if (x === b.x && y === b.y) return 'Vẫn ở chỗ cũ';
  return footprintError(sim, b.kind, x, y, b) ?? sim.missing(moveFee(sim, b));
}

/** Take a building apart and put it up again elsewhere: it keeps its level, pays the fee and must be rebuilt (half the time). */
export function moveBuilding(sim: Sim, id: number, x: number, y: number): string | null {
  const b = sim.getBuilding(id);
  if (!b) return 'Không tìm thấy công trình';
  const why = canMove(sim, b, x, y);
  if (why) return why;
  const fee = moveFee(sim, b);
  for (const r of Object.keys(fee) as Res[]) sim.stock[r] -= fee[r] ?? 0;
  evict(sim, b);
  if (b.upgrading) { for (const r of Object.keys(levelDef(b, b.level + 1).cost) as Res[]) if (!sim.dev.freeBuild) sim.stock[r] += levelDef(b, b.level + 1).cost[r] ?? 0; b.upgrading = false; }
  const wasDone = b.done;
  setOcc(sim, b, 0); b.x = x; b.y = y; setOcc(sim, b, 1);
  if (wasDone && !sim.dev.instantBuild) { b.done = false; b.progress = 0; b.rebuild = true; }
  sim.fogDirty = true;
  sim.say(`${BUILDINGS[b.kind].name} được dời sang chỗ mới.${b.rebuild ? ' Giao "Thợ xây" để dựng lại.' : ''}`);
  return null;
}

export function capacity(sim: Sim, _res?: Res): number {
  let c = 0;
  for (const b of sim.buildings) if (b.done && holdsGoods(b)) c += levelDef(b).cap;
  return c;
}

/** Villagers the village can hold: it grows with the campfire. */
export function popCap(sim: Sim): number { const f = sim.campfire(); return POP_BY_FIRE[Math.min(POP_BY_FIRE.length, f?.level ?? 1) - 1]; }

/** How fast builders work: the level of their house. */
export function crewSpeed(sim: Sim): number { const h = sim.building('builder'); return h ? levelDef(h).craftSpeed : 1; }
