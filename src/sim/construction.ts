/** Placing, upgrading, moving and demolishing buildings, and what the buildings give the village (room, population, build speed). */
import { Building, BuildingKind, BUILDINGS, CLEARANCE, WALL_KINDS, holdsGoods, levelDef, levelsOf, maxHp, maxLevel, levelCapByFire, POP_BY_FIRE } from './buildings';
import { isStaffJob, ROLES } from './jobs';
import { Res, RES_NAME, Stock } from './resources';
import { buildingOpen, levelCap, techForBuilding, techForLevel } from './research';
import { fireUnlockLevel, fireUpgradeNeeds } from './progression';
import type { Sim } from './sim';
import { PlaceResult } from './model';

// ---------------------------------------------------------------- công trình
export function addBuilding(sim: Sim, kind: BuildingKind, x: number, y: number, done: boolean, level = 1): Building {
  const d = BUILDINGS[kind];
  const b: Building = { id: sim.nextBid++, kind, era: sim.era, x, y, level, progress: done ? 1 : 0, done, upgrading: false, rebuild: false, hp: 0, open: true, staff: [], active: null, workers: 0 };
  b.hp = maxHp(b);
  sim.buildings.push(b);
  setOcc(sim, b, 1);
  return b;
}

/** The houses a village starts with, so that its first people have a role: the Nông trại, the Xưởng gỗ and the Xưởng đá, finished, near the campfire. */
export function placeStarters(sim: Sim): void {
  const s = sim.world.start;
  for (const kind of ['lumberyard', 'farmhouse', 'quarry'] as const) {
    let done = false;
    for (let r = 4; r < 16 && !done; r++) for (let dx = -r; dx <= r && !done; dx++) for (let dy = -r; dy <= r && !done; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = s.x + dx, y = s.y + dy;
      if (footprintError(sim, kind, x, y) === null) { addBuilding(sim, kind, x, y, true); done = true; }
    }
  }
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
  // houses keep a free tile between them (CLEARANCE) so that villagers never get boxed in; fences, gates and pits are laid tight on purpose
  if (!WALL_KINDS.has(kind)) for (const o of sim.buildings) {
    if (o === ignore || WALL_KINDS.has(o.kind)) continue;
    const od = BUILDINGS[o.kind], gx = Math.max(x - (o.x + od.w), o.x - (x + d.w)), gy = Math.max(y - (o.y + od.h), o.y - (y + d.h));
    if (Math.max(gx, gy) < CLEARANCE) return `Cần chừa ít nhất ${CLEARANCE} ô trống giữa các công trình để dân đi lại`;
  }
  return null;
}

/** Level of the highest finished campfire (1 when there is none yet). */
export const fireLevel = (sim: Sim): number => sim.buildings.reduce((m, b) => (b.kind === 'campfire' && b.done ? Math.max(m, b.level) : m), 1);

/** Why the campfire may not leave its level yet: every house opened up to it must stand, finished, at that level (research does not come into it). */
export function fireUpgradeBlock(sim: Sim, level: number): string | null {
  const need = fireUpgradeNeeds(level);
  if (need === null) return null;
  for (const k of Object.keys(BUILDINGS) as BuildingKind[]) {
    const d = BUILDINGS[k];
    if (!d.buildable || fireUnlockLevel(k) > level) continue;
    const mine = sim.buildings.filter((b) => b.kind === k), want = Math.min(need, maxLevel(k, sim.era));
    if (!mine.length) return `Cần dựng ${d.name} trước khi nâng Nhà chung`;
    if (mine.some((b) => !b.done || b.upgrading || b.level < want)) return `Cần nâng ${d.name} lên cấp ${want} trước khi nâng Nhà chung`;
  }
  return null;
}

/** How many of a kind may stand now: one for the houses opened from a menu, and for beds and fields a number that grows with every campfire's level. */
export function buildingLimit(sim: Sim, kind: BuildingKind): number {
  const per = BUILDINGS[kind].perFire;
  if (!per) return 1;
  return sim.buildings.reduce((n, f) => n + (f.kind === 'campfire' ? per[Math.min(per.length, f.level) - 1] : 0), 0);
}

/** Why a kind of building cannot be built at all right now: it is at its limit, or it needs research or another house first. */
export function buildingLock(sim: Sim, kind: BuildingKind): string | null {
  const fireNeed = fireUnlockLevel(kind);
  if (!sim.dev.freeBuild && fireNeed > fireLevel(sim)) return `Cần nâng ${BUILDINGS.campfire.name} lên cấp ${fireNeed} để xây ${BUILDINGS[kind].name.toLowerCase()}`;
  const have = sim.buildings.filter((b) => b.kind === kind).length, limit = buildingLimit(sim, kind);
  if (limit === 0) return `Cần nâng cấp Nhà chung để xây ${BUILDINGS[kind].name.toLowerCase()}`;
  if (have >= limit) return limit === 1 ? 'Mỗi công trình chỉ xây được một cái, hãy nâng cấp nó' : `Đã đủ ${limit} ${BUILDINGS[kind].name.toLowerCase()}: nâng cấp Nhà chung để xây thêm`;
  const need = sim.dev.freeBuild ? undefined : BUILDINGS[kind].requires?.find((r) => !sim.building(r));
  if (need) return `Cần dựng ${BUILDINGS[need].name} trước`;
  if (!sim.dev.freeBuild && !buildingOpen(sim.researched, kind)) return `Cần nghiên cứu: ${techForBuilding(kind)?.name ?? '?'}`;
  return null;
}

/** The level a new house of this kind is raised at: the level of the last one that fell in battle, else 1. */
export function startLevel(sim: Sim, kind: BuildingKind): number { return Math.min(sim.ruins[kind] ?? 1, maxLevel(kind, sim.era)); }
/** What raising it costs: every level up to the one it starts at (a rebuilt house is paid for again, but not raised level by level). */
export function startCost(sim: Sim, kind: BuildingKind): Partial<Stock> {
  const out: Partial<Stock> = {};
  for (let l = 1; l <= startLevel(sim, kind); l++) { const c = levelsOf(kind, sim.era)[l - 1].cost; for (const r of Object.keys(c) as Res[]) out[r] = (out[r] ?? 0) + (c[r] ?? 0); }
  return out;
}

/** Trả về lý do không đặt được, hoặc null nếu đặt được. */
export function canPlace(sim: Sim, kind: BuildingKind, x: number, y: number): string | null {
  return footprintError(sim, kind, x, y) ?? buildingLock(sim, kind) ?? (sim.dev.freeBuild ? null : sim.missing(startCost(sim, kind)));
}

/** Reason the building cannot be upgraded now, or null. */
export function canUpgrade(sim: Sim, b: Building): string | null {
  if (!b.done) return 'Công trình chưa dựng xong';
  if (b.upgrading) return 'Đang nâng cấp';
  if (b.level >= maxLevel(b.kind, b.era)) return 'Đã ở cấp cao nhất';
  if (b.level + 1 > levelCap(sim.researched, b.kind)) return `Cần nghiên cứu: ${techForLevel(b.kind, b.level + 1)?.name ?? '?'}`;
  if (b.kind === 'campfire' && !sim.dev.freeBuild) { const why = fireUpgradeBlock(sim, b.level); if (why) return why; }
  const fire = sim.campfire();
  if (b.kind !== 'campfire' && fire && !sim.dev.freeBuild && b.level + 1 > levelCapByFire(fire.level)) return `Cần nâng ${BUILDINGS.campfire.name} lên cấp ${b.level + 1}`;
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
  if (sim.dev.instantBuild) { b.level++; b.hp = maxHp(b); sim.say(`${BUILDINGS[b.kind].name} lên cấp ${b.level} ngay (dev).`); return null; }
  b.upgrading = true; b.progress = 0;
  sim.say(`Bắt đầu nâng ${BUILDINGS[b.kind].name} lên cấp ${b.level + 1} (${next.name.toLowerCase()}). Giao việc "Thợ xây" để làm.`);
  return null;
}

export function placeBuilding(sim: Sim, kind: BuildingKind, x: number, y: number): PlaceResult {
  const d = BUILDINGS[kind];
  if (!d.buildable) return { ok: false, reason: 'Không xây được công trình này' };
  const why = canPlace(sim, kind, x, y);
  if (why) return { ok: false, reason: why };
  const cost = startCost(sim, kind), lvl = startLevel(sim, kind);
  if (!sim.dev.freeBuild) for (const r of Object.keys(cost) as Res[]) sim.stock[r] -= cost[r] ?? 0;
  const b = addBuilding(sim, kind, x, y, false, lvl);
  delete sim.ruins[kind]; // the ruin is built over
  if (sim.dev.instantBuild) { b.progress = 1; b.done = true; sim.fogDirty = true; sim.say(`${d.name} đã dựng xong ngay (dev).`); return { ok: true, building: b }; }
  sim.say(`Đã đặt nền ${d.name}${lvl > 1 ? ` (dựng lại ở cấp ${lvl}, không phải nâng từ cấp 1)` : ''}. Giao việc "Thợ xây" để dựng.`);
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

/** Moving a building costs nothing. */
export function moveFee(_sim: Sim, _b: Building): Partial<Stock> { return {}; }

/** Send everyone who was heading for or working at this building back to idle; an order in progress is refunded. */
export function evict(sim: Sim, b: Building): void {
  for (const id of [...b.staff]) { const v = sim.byId.get(id); if (v) { sim.exitBuilding(v); if (v.job !== 'fight') v.job = 'idle'; v.post = -1; } }
  b.staff = [];
  if (b.kind === 'builder') for (const v of sim.crew()) { sim.resetTask(v); v.job = 'idle'; }
  if (b.active && (b.kind === 'lab' || b.kind === 'workshop')) { const d = sim.orderDef(b.kind === 'lab' ? 'research' : 'craft', b.active.id); if (d) sim.pay(d.cost, 1); }
  b.active = null;
  // sleepers are put out of their beds; being tired still, they look for another bed at once
  for (const v of sim.sleepers(b)) { sim.exitBuilding(v); v.phase = 'idle'; v.target = -1; v.path = []; }
  for (const v of sim.villagers) {
    if (v.target !== b.id) continue;
    if (v.phase === 'goSite' || v.phase === 'build' || v.phase === 'goEquip' || v.phase === 'goStaff' || v.phase === 'goOrder') { if (isStaffJob(v.job) || v.post === b.id) v.job = 'idle'; sim.resetTask(v); }
  }
  for (const v of sim.villagers) if (v.post === b.id) { v.post = -1; if (v.job === 'food' && v.phase === 'idle') v.job = 'idle'; }
}

export function setOcc(sim: Sim, b: Building, val: number): void {
  const d = BUILDINGS[b.kind];
  if ((b.kind === 'gate' && b.open) || b.kind === 'trap') val = 0; // an open gate is a gap in the fence, and a pit does not block the way
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) sim.world.occ[(b.y + j) * sim.world.size + b.x + i] = val;
}

/** A house that may stand only once cannot be torn down (it can still be raised and moved). */
export function canDemolish(sim: Sim, b: Building): string | null {
  return BUILDINGS[b.kind].buildable ? null : 'Không phá được công trình này';
}

/** A work falls in battle: it leaves the village with no salvage and no refund. */
export function destroyBuilding(sim: Sim, b: Building): void {
  if (BUILDINGS[b.kind].buildable && b.done && !WALL_KINDS.has(b.kind)) sim.ruins[b.kind] = Math.max(sim.ruins[b.kind] ?? 1, b.level); // it can be raised again at the level it had
  // the archers of a tower that falls come out and fight on the ground
  const archers = b.kind === 'tower' ? sim.garrison(b) : [];
  evict(sim, b);
  for (const v of archers) { v.fight.mode = 'guard'; v.fight.anchor = { x: b.x + 1, y: b.y + 2 }; v.stance = 'aggressive'; v.nightOwl = true; v.phase = 'idle'; }
  if (archers.length) sim.say(`Chòi canh đổ: ${archers.length} cung thủ ra đánh.`);
  setOcc(sim, b, 0);
  sim.buildings.splice(sim.buildings.indexOf(b), 1);
  sim.fogDirty = true;
  sim.trimRoles(); // a camp that fell takes its role from the soldiers in it
}

export function demolishBuilding(sim: Sim, id: number): string | null {
  const b = sim.getBuilding(id);
  if (!b) return 'Không tìm thấy công trình';
  const why = canDemolish(sim, b);
  if (why) return why;
  if (Object.values(ROLES).some((r) => r.building === b.kind) && sim.warLock()) return sim.warLock(); // taking a camp down would take its role from the soldiers in it
  const back = salvage(sim, b);
  evict(sim, b);
  setOcc(sim, b, 0);
  sim.buildings.splice(sim.buildings.indexOf(b), 1);
  for (const r of Object.keys(back) as Res[]) sim.stock[r] += back[r] ?? 0;
  sim.fogDirty = true;
  sim.trimRoles();
  sim.say(`Đã phá ${BUILDINGS[b.kind].name.toLowerCase()}${Object.keys(back).length ? `, thu lại ${Object.keys(back).map((r) => `${back[r as Res]} ${RES_NAME[r as Res].toLowerCase()}`).join(', ')}` : ''}.`);
  return null;
}

/** Why the building cannot go to (x, y), or null. */
export function canMove(sim: Sim, b: Building, x: number, y: number): string | null {
  if (!BUILDINGS[b.kind].buildable) return 'Không dời được công trình này';
  if (sim.attackReason()) return 'Không dời được công trình khi làng đang bị tấn công';
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
  // a finished house is lifted and set down as it is: it keeps its level and needs no builders
  setOcc(sim, b, 0); b.x = x; b.y = y; setOcc(sim, b, 1);
  sim.fogDirty = true;
  sim.say(`${BUILDINGS[b.kind].name} được dời sang chỗ mới.`);
  return null;
}

export function capacity(sim: Sim, _res?: Res): number {
  let c = 0;
  for (const b of sim.buildings) if (b.done && holdsGoods(b)) c += levelDef(b).cap;
  return c;
}

/** Villagers the village can hold: what the campfire holds at its level, plus the beds of every finished Nhà dân. */
export function popCap(sim: Sim): number { const f = sim.campfire(); return POP_BY_FIRE[Math.min(POP_BY_FIRE.length, f?.level ?? 1) - 1] + sim.bedsIn('house'); }

/** How fast builders work: the level of their house. */
export function crewSpeed(sim: Sim): number { const h = sim.building('builder'); return h ? levelDef(h).craftSpeed : 1; }
