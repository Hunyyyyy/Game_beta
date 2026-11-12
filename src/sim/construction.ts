/** Placing, upgrading, moving and demolishing buildings, and what the buildings give the village (room, population, build speed). */
import { Building, BuildingKind, BUILDINGS, footOf, footDim, Era, eraLocked, buildingSight, needsWork, CLEARANCE, WALL_KINDS, holdsGoods, levelDef, levelsOf, maxHp, maxLevel, topLevel, levelCapByFire, POP_BY_FIRE, fireUnlockLevel } from './buildings';
import { isStaffJob, ROLES } from './jobs';
import { Res, RES_NAME, Stock } from './resources';
import { buildingOpen, discountBill, perkPct, techForBuilding } from './research';
import { scaleCost } from './works';
import { START_KIT, isProcessKind, processRecipe } from './processdata';
import { fireUpgradeGroups } from './progression';
import startJson from '../data/start.json';
import type { Sim } from './sim';
import { PlaceResult } from './model';

// ---------------------------------------------------------------- công trình
export function addBuilding(sim: Sim, kind: BuildingKind, x: number, y: number, done: boolean, level = 1, rot = 0): Building {
  const b: Building = { id: sim.nextBid++, kind, era: sim.era, x, y, level, progress: done ? 1 : 0, done, upgrading: false, rebuild: false, hp: 0, open: kind !== 'gate', staff: [], active: null, workers: 0 };
  if (rot === 1 && kind === 'gate') b.rot = 1;
  b.hp = maxHp(b);
  sim.buildings.push(b);
  setOcc(sim, b, 1);
  return b;
}

/** The houses a village starts with, so that its first people have a role: the Nông trại, the Xưởng gỗ and the Xưởng đá, finished, near the campfire. */
export function placeStarters(sim: Sim): void {
  const s = sim.world.start;
  for (const kind of startJson.buildings as BuildingKind[]) {
    let done = false;
    for (let r = 4; r < 16 && !done; r++) for (let dx = -r; dx <= r && !done; dx++) for (let dy = -r; dy <= r && !done; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = s.x + dx, y = s.y + dy;
      if (footprintError(sim, kind, x, y) === null) { addBuilding(sim, kind, x, y, true); done = true; }
    }
  }
}

/** Is the point on the land of the village: within the sight of the campfire or of a finished house (the one being moved does not count: it is leaving). */
export function inTerritory(sim: Sim, x: number, y: number, ignore?: Building): boolean {
  for (const b of sim.buildings) {
    if (b === ignore || !b.done) continue;
    const r = buildingSight(b);
    const f = footOf(b);
    if (r > 0 && Math.hypot(b.x + f.w / 2 - x, b.y + f.h / 2 - y) <= r) return true;
  }
  return false;
}

/** Why the footprint of `kind` at (x, y) is unusable, or null. `ignore` is a building that is being moved and may overlap itself. */
export function footprintError(sim: Sim, kind: BuildingKind, x: number, y: number, ignore?: Building, dim?: { w: number; h: number }): string | null {
  const d = dim ?? BUILDINGS[kind], w = sim.world, N = w.size, was = ignore ? footOf(ignore) : d;
  const own = (tx: number, ty: number) => !!ignore && tx >= ignore.x && tx < ignore.x + was.w && ty >= ignore.y && ty < ignore.y + was.h;
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
    const tx = x + i, ty = y + j;
    if (!w.inBounds(tx, ty)) return 'Ngoài bản đồ';
    const k = ty * N + tx;
    if (sim.fog.state[k] === 0) return 'Chưa khám phá';
    if (sim.inZone(tx, ty)) return 'Khu quân sự: không xây được gì';
    const t = w.tiles[k];
    if ((t !== 0 && t !== 4) || (w.occ[k] && !own(tx, ty))) return 'Vướng cây, đá, nước hoặc công trình';
  }
  if (!inTerritory(sim, x + d.w / 2, y + d.h / 2, ignore)) return 'Ngoài đất của làng: chỉ xây trong tầm nhìn của đống lửa hoặc một công trình';
  // houses keep a free tile between them (CLEARANCE) so that villagers never get boxed in; fences, gates and pits are laid tight on purpose
  if (!WALL_KINDS.has(kind)) for (const o of sim.buildings) {
    if (o === ignore || WALL_KINDS.has(o.kind)) continue;
    const od = footOf(o), gx = Math.max(x - (o.x + od.w), o.x - (x + d.w)), gy = Math.max(y - (o.y + od.h), o.y - (y + d.h));
    if (Math.max(gx, gy) < CLEARANCE) return `Cần chừa ít nhất ${CLEARANCE} ô trống giữa các công trình để dân đi lại`;
  }
  return null;
}

/** Why a building that is being raised or upgraded is not going up yet, in a few words, or null when somebody is at work on it. */
export function buildWhy(sim: Sim, b: Building): string | null {
  if (!needsWork(b)) return null;
  const crew = sim.crew();
  if (!crew.length) return 'chưa có thợ xây: giao dân làm thợ xây ở Nhà thợ xây';
  const mine = crew.filter((v) => (v.phase === 'goSite' || v.phase === 'build') && v.target === b.id);
  if (mine.some((v) => v.phase === 'build')) return null;
  if (mine.length) return `${mine.length} thợ đang đi tới`;
  const busy = crew.filter((v) => v.phase === 'build' || v.phase === 'goSite').length, waiting = sim.buildings.filter((o) => needsWork(o)).length;
  if (busy) return `thợ xây đang bận công trình khác (đang chờ ${waiting} việc)`;
  if (crew.every((v) => v.phase === 'sleep' || v.phase === 'goHome')) return 'thợ xây đang nghỉ ngơi';
  return `thợ xây chưa nhận việc (đi lấy búa, hoặc ${waiting} việc đang chờ)`;
}

/** Level of the highest finished campfire (1 when there is none yet). */
export const fireLevel = (sim: Sim): number => sim.buildings.reduce((m, b) => (b.kind === 'campfire' && b.done ? Math.max(m, b.level) : m), 1);

/** Why the campfire may not leave its level yet: every house opened up to it must stand, finished, at that level (research does not come into it). */
export function fireUpgradeBlock(sim: Sim, level: number): string | null {
  // the houses of the producers (Nông trại, Xưởng gỗ, Xưởng đá, Chòi săn) must stand at the level; nothing else is asked of the village
  for (const [group, at] of Object.entries(fireUpgradeGroups(level))) for (const k of Object.keys(BUILDINGS) as BuildingKind[]) {
    const d = BUILDINGS[k];
    if (d.group !== group || !d.buildable || eraLocked(k, sim)) continue;
    const mine = sim.buildings.filter((b) => b.kind === k), want = Math.min(at, maxLevel(k, sim.era));
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
  if (eraLocked(kind, sim) && !sim.dev.freeBuild) return 'Mở khóa ở thời Trung cổ';
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

/** Every condition for building a kind, met or not, for the dialog of a locked card: the level of the campfire, the houses it needs, research, and how many may stand. */
export function buildingNeeds(sim: Sim, kind: BuildingKind): Array<{ text: string; ok: boolean }> {
  const d = BUILDINGS[kind], free = sim.dev.freeBuild, out: Array<{ text: string; ok: boolean }> = [];
  const fireNeed = fireUnlockLevel(kind);
  if (fireNeed > 1) out.push({ text: `${BUILDINGS.campfire.name} cấp ${fireNeed}`, ok: free || fireLevel(sim) >= fireNeed });
  for (const r of d.requires ?? []) out.push({ text: `Đã dựng ${BUILDINGS[r].name}`, ok: free || !!sim.building(r) });
  const tech = techForBuilding(kind);
  if (tech) out.push({ text: `Nghiên cứu: ${tech.name}`, ok: free || buildingOpen(sim.researched, kind) });
  const have = sim.buildings.filter((b) => b.kind === kind).length, limit = buildingLimit(sim, kind);
  out.push({ text: `Còn chỗ xây (${have}/${limit}${limit <= have ? ': nâng cấp Nhà chung để xây thêm' : ''})`, ok: have < limit });
  return out;
}

/** The level a new house of this kind is raised at: the level of the last one that fell in battle, else 1. */
export function startLevel(sim: Sim, kind: BuildingKind): number { return Math.min(sim.ruins[kind] ?? 1, maxLevel(kind, sim.era)); }
/** A bill for the works of the village, cut by the research of the builders (Xây rẻ hơn). */
export const buildBill = (sim: Sim, bill: Partial<Stock>): Partial<Stock> => discountBill(bill, perkPct(sim.researched, 'buildCost'));
/** What raising it costs: every level up to the one it starts at (a rebuilt house is paid for again, but not raised level by level). */
export function startCost(sim: Sim, kind: BuildingKind): Partial<Stock> {
  const out: Partial<Stock> = {};
  for (let l = 1; l <= startLevel(sim, kind); l++) { const c = levelsOf(kind, sim.era)[l - 1].cost; for (const r of Object.keys(c) as Res[]) out[r] = (out[r] ?? 0) + (c[r] ?? 0); }
  return buildBill(sim, out);
}

/** Trả về lý do không đặt được, hoặc null nếu đặt được. */
export function canPlace(sim: Sim, kind: BuildingKind, x: number, y: number, rot = 0): string | null {
  return footprintError(sim, kind, x, y, undefined, footDim(kind, rot)) ?? buildingLock(sim, kind) ?? (sim.freeCost() ? null : sim.missing(startCost(sim, kind)));
}

/** Reason the building cannot be upgraded now, or null. */
export function canUpgrade(sim: Sim, b: Building): string | null {
  if (!b.done) return 'Công trình chưa dựng xong';
  if (b.upgrading) return 'Đang nâng cấp';
  if (b.repairing) return 'Đang sửa chữa';
  if (b.level >= topLevel(b)) return 'Đã ở cấp cao nhất';
  if (b.kind === 'campfire' && !sim.dev.freeBuild) {
    if (b.level >= BUILDINGS.campfire.levels.stone!.length && sim.tribes.some((t) => t.boss && !t.bossDown)) return 'Cần hạ hết các thủ lĩnh (làng đầu lĩnh, kể cả thủ lĩnh phản bội) trước khi nâng lên Nhà chính (thời Trung cổ)'; // the first medieval level waits for the fall of a boss village
    const why = fireUpgradeBlock(sim, b.level); if (why) return why;
  }
  const fire = sim.campfire();
  if (b.kind !== 'campfire' && fire && !sim.dev.freeBuild && b.level + 1 > levelCapByFire(fire.level)) return `Cần nâng ${BUILDINGS.campfire.name} lên cấp ${b.level + 1}`;
  return sim.freeCost() ? null : sim.missing(buildBill(sim, levelDef({ ...b, era: upgradeEra(b) }, b.level + 1).cost));
}

/** The era whose levels a building climbs: the campfire climbs into the medieval ones from its last stone level (that step opens the era); the rest only in the medieval era (their own era is set by it). */
const upgradeEra = (b: Pick<Building, 'kind' | 'era'>): Building['era'] => (b.kind === 'campfire' ? 'ancient' : b.era);

/** What repairing costs: the materials the building was raised with, in the share of its strength that is lost. */
export function repairCost(sim: Sim, b: Building): Partial<Stock> {
  const top = maxHp(b), lost = top > 0 ? Math.max(0, Math.min(1, 1 - b.hp / top)) : 0, out: Partial<Stock> = {}, spent = invested(sim, b);
  for (const r of Object.keys(spent) as Res[]) { const n = Math.ceil((spent[r] ?? 0) * lost - 1e-9); if (n > 0) out[r] = n; }
  return out;
}

/** Reason the building cannot be repaired now, or null. */
export function canRepair(sim: Sim, b: Building): string | null {
  if (!b.done) return 'Công trình chưa dựng xong';
  if (b.repairing) return 'Đang sửa chữa';
  if (b.upgrading) return 'Đang nâng cấp: chờ xong rồi sửa';
  if (b.hp >= maxHp(b)) return 'Công trình còn nguyên vẹn';
  return sim.freeCost() ? null : sim.missing(repairCost(sim, b));
}

/** Pay for the repair; builders then work on it and the strength comes back. Returns an error or null. */
export function repairBuilding(sim: Sim, id: number): string | null {
  const b = sim.getBuilding(id);
  if (!b) return 'Không tìm thấy công trình';
  const why = canRepair(sim, b);
  if (why) return why;
  if (!sim.freeCost()) { const cost = repairCost(sim, b); for (const r of Object.keys(cost) as Res[]) sim.stock[r] -= cost[r] ?? 0; }
  if (sim.dev.instantBuild) { b.hp = maxHp(b); return null; }
  b.repairing = true;
  sim.say(`Bắt đầu sửa ${BUILDINGS[b.kind].name}. Giao việc "Thợ xây" để làm.`);
  return null;
}

/** Pay for the next level; builders then work on it while the building keeps its current level. */
export function upgradeBuilding(sim: Sim, id: number): string | null {
  const b = sim.getBuilding(id);
  if (!b) return 'Không tìm thấy công trình';
  const why = canUpgrade(sim, b);
  if (why) return why;
  const grow = growCheck(sim, b); // a level with a bigger footprint waits for the ground to be clear: nothing is paid before
  if (grow?.hard) return grow.hard;
  if (grow && grow.blockers.length) return `Còn ${grow.blockers.length} công trình vướng nền mới: hãy dời đi trước`;
  b.era = upgradeEra(b);
  const next = levelDef(b, b.level + 1);
  const bill = buildBill(sim, next.cost);
  if (!sim.freeCost()) for (const r of Object.keys(bill) as Res[]) sim.stock[r] -= bill[r] ?? 0;
  if (grow) startGrow(sim, b, grow.rect);
  if (sim.dev.instantBuild) { b.level++; finishGrow(sim, b); b.hp = maxHp(b); sim.say(`${BUILDINGS[b.kind].name} lên cấp ${b.level} ngay (dev).`); afterUpgrade(sim, b); return null; }
  b.upgrading = true; b.progress = 0;
  sim.say(`Bắt đầu nâng ${BUILDINGS[b.kind].name} lên cấp ${b.level + 1} (${next.name.toLowerCase()}). Giao việc "Thợ xây" để làm.`);
  return null;
}

// ---------------------------------------------------------------- a level with a bigger footprint
export interface GrowRect { x: number; y: number; w: number; h: number }
/** The ground a building covers at its next level when that is more than it covers now (the old footprint's middle stays the middle), or null when it keeps its size. */
export function growRect(b: Building): GrowRect | null {
  if (b.level >= topLevel(b)) return null;
  const next = levelDef({ ...b, era: upgradeEra(b) }, b.level + 1)?.size, cur = footOf(b);
  if (!next || (next[0] <= cur.w && next[1] <= cur.h)) return null;
  return { x: b.x - Math.floor((next[0] - cur.w) / 2), y: b.y - Math.floor((next[1] - cur.h) / 2), w: next[0], h: next[1] };
}

/** What stands in the way of that ground: the houses that overlap it or come closer than the free tile houses keep (the player moves those away), and whether the land itself will not do (water, mountains, the unexplored). */
export interface GrowCheck { rect: GrowRect; blockers: Building[]; hard: string | null }
export function growCheck(sim: Sim, b: Building): GrowCheck | null {
  const rect = growRect(b);
  if (!rect) return null;
  const w = sim.world, N = w.size, cur = footOf(b), blockers: Building[] = [];
  let hard: string | null = null;
  const mine = (tx: number, ty: number) => tx >= b.x && tx < b.x + cur.w && ty >= b.y && ty < b.y + cur.h;
  const owned = (tx: number, ty: number) => sim.buildings.some((o) => { if (o === b) return false; const f = footOf(o); return tx >= o.x && tx < o.x + f.w && ty >= o.y && ty < o.y + f.h; });
  for (let j = 0; j < rect.h; j++) for (let i = 0; i < rect.w; i++) {
    const tx = rect.x + i, ty = rect.y + j;
    if (!w.inBounds(tx, ty)) { hard ??= 'Nền mới vượt ra ngoài bản đồ'; continue; }
    const k = ty * N + tx, t = w.tiles[k];
    if (sim.fog.state[k] === 0) hard ??= 'Nền mới có chỗ chưa khám phá';
    if (sim.inZone(tx, ty)) hard ??= 'Nền mới nằm trong khu quân sự';
    if (t === 1 || t === 6) hard ??= 'Nền mới có nước hoặc núi'; // trees, rocks, bushes and ore are cleared when the work begins
    if (w.occ[k] && !mine(tx, ty) && !owned(tx, ty)) hard ??= 'Nền mới vướng công trình của làng khác';
  }
  for (const o of sim.buildings) {
    if (o === b) continue;
    const od = footOf(o), gx = Math.max(rect.x - (o.x + od.w), o.x - (rect.x + rect.w)), gy = Math.max(rect.y - (o.y + od.h), o.y - (rect.y + rect.h));
    if (Math.max(gx, gy) < (WALL_KINDS.has(o.kind) ? 0 : CLEARANCE)) blockers.push(o);
  }
  return { rect, blockers, hard };
}

/** The upgrade is paid: the new ground is kept for it (trees, rocks, bushes and ore on it are cleared, people on it are put out), so nothing else can be raised there meanwhile. */
export function startGrow(sim: Sim, b: Building, r: GrowRect): void {
  const w = sim.world, N = w.size;
  for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
    const k = (r.y + j) * N + r.x + i;
    if (w.nodes.has(k)) w.nodes.delete(k);
    if (w.tiles[k] !== 0 && w.tiles[k] !== 4) w.tiles[k] = 0;
    w.occ[k] = 1;
  }
  b.grow = r;
  for (const v of [...sim.villagers, ...sim.foes]) {
    if (v.inside !== null) continue;
    const tx = Math.floor(v.x), ty = Math.floor(v.y);
    if (tx < r.x || tx >= r.x + r.w || ty < r.y || ty >= r.y + r.h) continue;
    const spot = sim.nearestFree(tx, ty, new Set<number>());
    if (spot) { v.x = spot[0] + 0.5; v.y = spot[1] + 0.5; v.path = []; v.slide = null; }
  }
  sim.fogDirty = true;
}

/** The level has been reached (called right after it went up): the house now stands on the new ground. */
export function finishGrow(sim: Sim, b: Building): void {
  const g = b.grow;
  if (!g) return;
  const old = footOf({ ...b, level: b.level - 1 }), N = sim.world.size;
  for (let j = 0; j < old.h; j++) for (let i = 0; i < old.w; i++) sim.world.occ[(b.y + j) * N + b.x + i] = 0;
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) sim.world.occ[(g.y + j) * N + g.x + i] = 0;
  b.x = g.x; b.y = g.y; delete b.grow;
  setOcc(sim, b, 1);
  sim.fogDirty = true;
}

/** Give the kept ground back (the upgrade was cancelled, or the house is gone): what is not under the house itself is free again. */
export function releaseGrow(sim: Sim, b: Building): void {
  const g = b.grow;
  if (!g) return;
  const cur = footOf(b), N = sim.world.size;
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
    const tx = g.x + i, ty = g.y + j;
    if (tx >= b.x && tx < b.x + cur.w && ty >= b.y && ty < b.y + cur.h) continue;
    sim.world.occ[ty * N + tx] = 0;
  }
  delete b.grow;
}

/**
 * Stop the work a house is waiting for: a running upgrade is given up, and what was not yet spent comes back; a house that is still going up is taken down, and what was
 * not yet spent comes back. Nothing is lost for what has not been started, and the ground kept for a bigger house is free again.
 */
export function cancelWork(sim: Sim, id: number): string | null {
  const b = sim.getBuilding(id);
  if (!b) return 'Không tìm thấy công trình';
  if (!b.upgrading && b.done) return 'Không có việc xây nào để hủy';
  const level = b.upgrading ? levelDef({ ...b, era: upgradeEra(b) }, b.level + 1) : levelDef(b), bill = buildBill(sim, level.cost), back: Partial<Stock> = {};
  if (!sim.freeCost()) for (const r of Object.keys(bill) as Res[]) { const n = Math.floor((bill[r] ?? 0) * (1 - Math.max(0, Math.min(1, b.progress)))); if (n > 0) { back[r] = n; sim.stock[r] += n; } }
  for (const v of sim.villagers) if (v.target === b.id && (v.phase === 'goSite' || v.phase === 'build')) sim.resetTask(v); // the builders go back to what they were doing
  const text = Object.keys(back).length ? `, thu lại ${Object.keys(back).map((r) => `${back[r as Res]} ${RES_NAME[r as Res].toLowerCase()}`).join(', ')}` : '';
  if (b.upgrading) {
    b.upgrading = false; b.progress = 1; releaseGrow(sim, b);
    sim.say(`Đã hủy nâng cấp ${BUILDINGS[b.kind].name.toLowerCase()}${text}.`);
  } else {
    sim.say(`Đã hủy xây ${BUILDINGS[b.kind].name.toLowerCase()}${text}.`);
    evict(sim, b); setOcc(sim, b, 0); sim.buildings.splice(sim.buildings.indexOf(b), 1); sim.fogDirty = true; sim.trimRoles();
  }
  return null;
}

/** A building has reached a new level. The campfire becoming the Nhà chính (level 4, the first medieval one) opens the medieval era. */
export function afterUpgrade(sim: Sim, b: Building): void {
  if (b.kind === 'campfire' && b.level >= BUILDINGS.campfire.levels.stone!.length + 1 && sim.era !== 'ancient') {
    setEra(sim, 'ancient');
    sim.resetTribes(); // the villages of the stone age vanish and new ones are drawn for the new era
    for (const r of Object.keys(START_KIT) as Res[]) sim.stock[r] += START_KIT[r] ?? 0; // a little iron and coal to begin with, until the mines
    sim.addAlert('era', 'Thời Trung cổ bắt đầu!'); // the screen congratulates the player (ui/eradialog)
    sim.say('Nhà chung đã thành Nhà chính: thời Trung cổ bắt đầu! Các nhà cấp 3 có thể nâng lên cấp trung cổ, có thêm nghiên cứu mới, và không còn đánh nhanh.');
  }
}

/** The era of the whole village: the houses take it (a house of the stone age may then climb into the medieval levels); going back caps every level at the stone ones. */
export function setEra(sim: Sim, era: Era): void {
  sim.setDayLength(era); // sets sim.era too, and keeps the day count and the time of day going on
  for (const b of sim.buildings) { b.era = era; const top = maxLevel(b.kind, era); if (b.level > top) { b.level = top; b.upgrading = false; } }
  sim.fogDirty = true;
}

export function placeBuilding(sim: Sim, kind: BuildingKind, x: number, y: number, rot = 0): PlaceResult {
  const d = BUILDINGS[kind];
  if (!d.buildable) return { ok: false, reason: 'Không xây được công trình này' };
  const why = canPlace(sim, kind, x, y, rot);
  if (why) return { ok: false, reason: why };
  const cost = startCost(sim, kind), lvl = startLevel(sim, kind);
  if (!sim.freeCost()) for (const r of Object.keys(cost) as Res[]) sim.stock[r] -= cost[r] ?? 0;
  const b = addBuilding(sim, kind, x, y, false, lvl, rot);
  delete sim.ruins[kind]; // the ruin is built over
  sim.addSfx('place', false, x, y);
  if (sim.dev.instantBuild) { b.progress = 1; b.done = true; sim.fogDirty = true; sim.say(`${d.name} đã dựng xong ngay (dev).`); return { ok: true, building: b }; }
  sim.say(`Đã đặt nền ${d.name}${lvl > 1 ? ` (dựng lại ở cấp ${lvl}, không phải nâng từ cấp 1)` : ''}. Giao việc "Thợ xây" để dựng.`);
  return { ok: true, building: b };
}

// ---------------------------------------------------------------- demolish and move
/** Materials paid so far for a building: every level reached, plus a running upgrade. */
export function invested(sim: Sim, b: Building): Partial<Stock> {
  const out: Partial<Stock> = {};
  const add = (c: Partial<Stock>) => { for (const r of Object.keys(c) as Res[]) out[r] = (out[r] ?? 0) + (c[r] ?? 0); };
  for (let l = 1; l <= b.level; l++) add(buildBill(sim, levelDef(b, l).cost));
  if (b.upgrading) add(buildBill(sim, levelDef(b, b.level + 1).cost));
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
  if (b.active && (b.kind === 'lab' || b.kind === 'workshop')) { const d = sim.orderDef(b.kind === 'lab' ? 'research' : 'craft', b.active.id); if (d && !sim.dev.freeWorks) sim.pay(b.kind === 'workshop' ? scaleCost(d.cost, b.active.paid ?? 1) : d.cost, 1); }
  if (b.active && isProcessKind(b.kind)) { const r = processRecipe(b.kind, b.active.id); if (r && !sim.dev.freeWorks) sim.pay(r.in, 1); } // the order at work is given back (those waiting stay in a moved house)
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
  const d = footOf(b);
  if ((b.kind === 'gate' && b.open) || b.kind === 'trap') val = 0; // an open gate is a gap in the fence, and a pit does not block the way
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
    const k = (b.y + j) * sim.world.size + b.x + i;
    sim.world.occ[k] = val;
    if (b.kind === 'gate') { if (val) sim.world.gates.add(k); else sim.world.gates.delete(k); } // a shut gate is let through by our own people
  }
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
  releaseGrow(sim, b);
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
  sim.refundProcess(b); // the goods of its orders come back
  const back = salvage(sim, b);
  evict(sim, b);
  releaseGrow(sim, b);
  setOcc(sim, b, 0);
  sim.buildings.splice(sim.buildings.indexOf(b), 1);
  for (const r of Object.keys(back) as Res[]) sim.stock[r] += back[r] ?? 0;
  sim.fogDirty = true;
  sim.trimRoles();
  sim.say(`Đã phá ${BUILDINGS[b.kind].name.toLowerCase()}${Object.keys(back).length ? `, thu lại ${Object.keys(back).map((r) => `${back[r as Res]} ${RES_NAME[r as Res].toLowerCase()}`).join(', ')}` : ''}.`);
  return null;
}

/** The tiles a building will cover when it goes to a new place turned `rot` (a gate of two tiles may be turned as it is moved; every other house keeps its shape). */
export function movedDim(b: Building, rot?: number): { w: number; h: number } {
  const f = footOf(b);
  return b.kind === 'gate' && b.w === undefined && rot !== undefined ? footDim('gate', rot) : f;
}

/** Why the building cannot go to (x, y) (turned `rot`, for a gate), or null. */
export function canMove(sim: Sim, b: Building, x: number, y: number, rot?: number): string | null {
  if (!BUILDINGS[b.kind].buildable) return 'Không dời được công trình này';
  if (sim.attackReason()) return 'Không dời được công trình khi làng đang bị tấn công';
  if (b.grow) return 'Đang nâng cấp sang nền rộng hơn: hủy việc đó trước khi dời';
  const dim = movedDim(b, rot), was = footOf(b);
  if (x === b.x && y === b.y && dim.w === was.w && dim.h === was.h) return 'Vẫn ở chỗ cũ';
  return footprintError(sim, b.kind, x, y, b, dim) ?? sim.missing(moveFee(sim, b));
}

/** Pieces of wall that may be picked up together and put down in another shape: the fence (one tile) and the gate (two, turning with the group). */
export const GROUP_KINDS: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['fence', 'gate']);

/**
 * Where each piece of a group goes when the first piece is put at `to` and the whole group is turned `rot` quarter-turns clockwise about that first piece
 * (as the walls of a village are picked up and put down in Clash of Clans).
 */
export function groupPlan(sim: Sim, ids: readonly number[], to: { x: number; y: number }, rot: number): Array<{ id: number; kind: BuildingKind; x: number; y: number; level: number; w: number; h: number; rot: 0 | 1 }> {
  const pieces = ids.map((id) => sim.getBuilding(id)).filter((b): b is Building => !!b);
  if (!pieces.length) return [];
  const a = pieces[0], turns = ((Math.round(rot) % 4) + 4) % 4;
  return pieces.map((b) => {
    let ox = b.x - a.x, oy = b.y - a.y, { w, h } = footOf(b), r: 0 | 1 = b.rot === 1 ? 1 : 0;
    // a quarter turn clockwise about the first piece: the tiles of a piece go from (x .. x+w-1, y .. y+h-1) to (-(y+h-1) .. -y, x .. x+w-1), so a gate of two tiles turns from lying to standing
    for (let i = 0; i < turns; i++) { [ox, oy] = [-(oy + h - 1), ox]; [w, h] = [h, w]; r = r ? 0 : 1; }
    return { id: b.id, kind: b.kind, x: to.x + ox, y: to.y + oy, level: b.level, w, h, rot: r };
  });
}

/** Why the group cannot be put down there, or null: every piece must find free, explored ground (the places they leave count as free). */
export function canMoveGroup(sim: Sim, ids: readonly number[], to: { x: number; y: number }, rot: number): string | null {
  const plan = groupPlan(sim, ids, to, rot);
  if (!plan.length) return 'Chưa chọn mảnh hàng rào nào';
  if (plan.some((q) => !GROUP_KINDS.has(q.kind))) return 'Chỉ dời được hàng rào và cổng theo nhóm';
  if (sim.attackReason()) return 'Không dời được công trình khi làng đang bị tấn công';
  const pieces = plan.map((q) => sim.getBuilding(q.id)!);
  if (plan.every((q, i) => q.x === pieces[i].x && q.y === pieces[i].y)) return 'Vẫn ở chỗ cũ';
  // lift every piece off the ground, look at where each goes, put them back as they were
  for (const b of pieces) setOcc(sim, b, 0);
  try {
    for (const q of plan) { const why = footprintError(sim, q.kind, q.x, q.y, undefined, { w: q.w, h: q.h }); if (why) return why; }
  } finally { for (const b of pieces) setOcc(sim, b, 1); }
  return null;
}

/** Put the whole group down in its new place (free, like moving one house); each piece keeps its level and stays as it was built. */
export function moveGroup(sim: Sim, ids: readonly number[], to: { x: number; y: number }, rot: number): string | null {
  const why = canMoveGroup(sim, ids, to, rot);
  if (why) return why;
  const plan = groupPlan(sim, ids, to, rot), pieces = plan.map((q) => sim.getBuilding(q.id)!);
  for (const b of pieces) setOcc(sim, b, 0);
  plan.forEach((q, i) => { pieces[i].x = q.x; pieces[i].y = q.y; if (q.kind === 'gate') { pieces[i].rot = q.rot; if (pieces[i].w !== undefined) { pieces[i].w = q.w; pieces[i].h = q.h; } } });
  for (const b of pieces) setOcc(sim, b, 1);
  sim.fogDirty = true;
  sim.say(`Đã dời ${pieces.length} mảnh hàng rào sang chỗ mới.`);
  return null;
}

/** Take a building apart and put it up again elsewhere: it keeps its level, pays the fee and must be rebuilt (half the time). */
export function moveBuilding(sim: Sim, id: number, x: number, y: number, rot?: number): string | null {
  const b = sim.getBuilding(id);
  if (!b) return 'Không tìm thấy công trình';
  const why = canMove(sim, b, x, y, rot);
  if (why) return why;
  const fee = moveFee(sim, b);
  for (const r of Object.keys(fee) as Res[]) sim.stock[r] -= fee[r] ?? 0;
  // the people who work in it keep their trade: they are put out for the move and walk to the house again where it stands now
  const crew = sim.villagers.filter((v) => b.staff.includes(v.id) || v.post === b.id || (b.kind === 'builder' && v.job === 'build')).map((v) => ({ v, job: v.job, post: v.post }));
  evict(sim, b);
  for (const c of crew) { if (c.v.health <= 0) continue; c.v.job = c.job; c.v.post = c.post; }
  if (b.upgrading) { const back = buildBill(sim, levelDef(b, b.level + 1).cost); for (const r of Object.keys(back) as Res[]) if (!sim.freeCost()) sim.stock[r] += back[r] ?? 0; b.upgrading = false; }
  // a finished house is lifted and set down as it is: it keeps its level and needs no builders
  setOcc(sim, b, 0); b.x = x; b.y = y;
  if (b.kind === 'gate' && b.w === undefined && rot !== undefined) b.rot = rot === 1 ? 1 : 0; // a gate may be turned as it is set down
  setOcc(sim, b, 1);
  sim.fogDirty = true;
  for (const c of crew) if (c.v.health > 0 && c.v.phase !== 'sleep') sim.planStaff(c.v);
  sim.say(`${BUILDINGS[b.kind].name} được dời sang chỗ mới.`);
  return null;
}

/** How much of a good the village holds: the Kho and the campfire (the same for every good), and for `res` also the small store of every house that produces it. */
export function capacity(sim: Sim, res?: Res): number {
  let c = 0;
  for (const b of sim.buildings) if (b.done && (holdsGoods(b) || (res && BUILDINGS[b.kind].produces?.includes(res)))) c += levelDef(b).cap;
  return Math.round(c * (1 + perkPct(sim.researched, 'storage') / 100)); // research: Kho vật liệu
}

/** Villagers the village can hold: what the campfire holds at its level, plus the beds of every finished Nhà dân. */
export function popCap(sim: Sim): number { const f = sim.campfire(); return POP_BY_FIRE[Math.min(POP_BY_FIRE.length, f?.level ?? 1) - 1] + sim.bedsIn('house') + sim.popBonus; }

/** How fast builders work: the level of their house. */
export function crewSpeed(sim: Sim): number { const h = sim.building('builder'); return h ? levelDef(h).craftSpeed : 1; }
