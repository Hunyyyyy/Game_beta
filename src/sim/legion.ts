/**
 * The march of the medieval age. The Bãi tập draws military zones (ground cleared of resources and animals, where nothing grows back and nothing may be built) and, in them, squares
 * of soldiers by arm. "Tập trận" gathers every soldier of the camps into his square; after that the army is moved as one block: it keeps its shape, turns to face the way it goes, and
 * walks at the median speed of its soldiers. This is only the march: no fighting yet, no squads (army.ts) and no war plan (warplan.ts).
 */
import LEG from '../data/legion.json';
import { Tile } from './world';
import type { MilCell, MilZone, Villager } from './model';
import type { Sim } from './sim';

const ARMS: ReadonlyArray<MilCell['arm']> = ['foot', 'archer', 'cavalry'];
export const ARM_NAME: Record<MilCell['arm'], string> = { foot: 'Bộ binh', archer: 'Cung thủ', cavalry: 'Kỵ binh' };

/** Is this tile in a military zone: nothing is built, grows or is born there. */
export function inZone(sim: Sim, x: number, y: number): boolean {
  const tx = Math.floor(x), ty = Math.floor(y);
  for (const z of sim.zones) if (tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h) return true;
  return false;
}

const rectOf = (cx: number, cy: number): { x: number; y: number; w: number; h: number } => ({ x: Math.round(cx - LEG.zoneSize / 2), y: Math.round(cy - LEG.zoneSize / 2), w: LEG.zoneSize, h: LEG.zoneSize });

/** Why a zone cannot be drawn with its middle here, or null: the medieval age and a Bãi tập; all ground seen and free of works (ours or anybody's); not over another zone. */
export function zoneError(sim: Sim, cx: number, cy: number): string | null {
  if (sim.era !== 'ancient' && !sim.dev.freeBuild) return 'Chỉ lập được khu quân sự ở thời Trung cổ';
  if (!sim.building('drill') && !sim.dev.freeBuild) return 'Cần dựng Bãi tập';
  const r = rectOf(cx, cy), w = sim.world, N = w.size;
  if (!w.inBounds(r.x, r.y) || !w.inBounds(r.x + r.w - 1, r.y + r.h - 1)) return 'Khu quân sự vượt ra ngoài bản đồ';
  if (sim.zones.some((z) => r.x < z.x + z.w && r.x + r.w > z.x && r.y < z.y + z.h && r.y + r.h > z.y)) return 'Chồng lên một khu quân sự khác';
  for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
    const k = j * N + i;
    if (sim.fog.state[k] === 0) return 'Có chỗ chưa khám phá: chỉ lập khu trên vùng đã khám phá';
    if (w.occ[k]) return 'Có công trình trong khu (của làng ta hoặc của làng khác): chọn chỗ trống';
  }
  return null;
}

/** Draw a zone: it is cleared of trees, rocks, bushes and animals at once (the works of the village cannot be in it), and nothing grows or is born in it afterwards. */
export function createZone(sim: Sim, cx: number, cy: number): string | null {
  const why = zoneError(sim, cx, cy);
  if (why) return why;
  const r = rectOf(cx, cy), w = sim.world, N = w.size;
  const id = sim.zones.reduce((m, z) => Math.max(m, z.id), 0) + 1;
  sim.zones.push({ id, ...r });
  let cleared = 0;
  for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
    const idx = j * N + i;
    if (!w.nodes.has(idx)) continue;
    for (const o of sim.villagers) if (o.target === idx && (o.phase === 'goNode' || o.phase === 'work')) sim.resetTask(o); // a gatherer at it looks for another
    w.nodes.delete(idx); w.tiles[idx] = Tile.Grass; cleared++;
  }
  for (let i = sim.animals.length - 1; i >= 0; i--) {
    const a = sim.animals[i];
    if (a.x >= r.x && a.x < r.x + r.w && a.y >= r.y && a.y < r.y + r.h) { sim.animals.splice(i, 1); sim.animalById.delete(a.id); }
  }
  sim.fogDirty = true;
  sim.say(`Đã lập khu quân sự ${r.w}×${r.h} ô (dọn ${cleared} cây, đá, bụi): trong khu không còn gì mọc, không xây được gì.`);
  return null;
}

export function removeZone(sim: Sim, id: number): void {
  const i = sim.zones.findIndex((z) => z.id === id);
  if (i < 0) return;
  sim.zones.splice(i, 1);
  for (let k = sim.cells.length - 1; k >= 0; k--) if (sim.cells[k].zone === id) sim.cells.splice(k, 1);
}

// ---------------------------------------------------------------- the squares of soldiers
const CS = LEG.cellSize;
const cellRect = (cx: number, cy: number): { x: number; y: number } => ({ x: Math.floor(cx) - Math.floor(CS / 2), y: Math.floor(cy) - Math.floor(CS / 2) });

/** A square of soldiers: whole inside one zone, on ground that can be walked, over no other square. */
export function addCell(sim: Sim, cx: number, cy: number, arm: MilCell['arm']): string | null {
  const c = cellRect(cx, cy), w = sim.world;
  const zone = sim.zones.find((z) => c.x >= z.x && c.y >= z.y && c.x + CS <= z.x + z.w && c.y + CS <= z.y + z.h);
  if (!zone) return 'Ô lính phải nằm trọn trong một khu quân sự';
  if (sim.cells.some((o) => c.x < o.x + CS && c.x + CS > o.x && c.y < o.y + CS && c.y + CS > o.y)) return 'Chồng lên một ô lính khác';
  for (let j = c.y; j < c.y + CS; j++) for (let i = c.x; i < c.x + CS; i++) if (w.isBlocked(i, j)) return 'Ô có nước, núi hoặc vật cản';
  sim.cells.push({ id: sim.cells.reduce((m, o) => Math.max(m, o.id), 0) + 1, zone: zone.id, x: c.x, y: c.y, arm });
  return null;
}

/** Change the arm of a square, or take it away (`null`). */
export function setCellArm(sim: Sim, id: number, arm: MilCell['arm'] | null): void {
  const i = sim.cells.findIndex((c) => c.id === id);
  if (i < 0) return;
  if (arm) sim.cells[i].arm = arm; else sim.cells.splice(i, 1);
}

// ---------------------------------------------------------------- gathering and marching
const living = (sim: Sim): Villager[] => {
  const out: Villager[] = [];
  for (const id of Object.keys(sim.legion.slots)) {
    const v = sim.byId.get(Number(id));
    if (v && v.team === 'player' && v.health > 0) out.push(v); else delete sim.legion.slots[id];
  }
  return out;
};

/** "Tập trận": every soldier of the camps goes to his square (by arm, as many as fit; the rest stay as they are), and the army forms there. Orders of the player first: they leave bed, work and camp. */
export function assemble(sim: Sim): string | null {
  const lock = sim.warLock(); if (lock) return lock;
  if (!sim.cells.length) return 'Chưa có ô lính nào: vẽ khu quân sự và đặt các ô lính trước';
  disband(sim);
  const L = sim.legion, pool = sim.villagers.filter((v) => v.team === 'player' && v.job === 'fight' && !v.guard && v.post < 0 && v.health > 0 && v.down <= 0 && !sim.scouts.some((m) => m.ids.includes(v.id)));
  const chosen: Array<{ v: Villager; x: number; y: number }> = [];
  for (const arm of ARMS) {
    const cells = sim.cells.filter((c) => c.arm === arm).sort((a, b) => a.id - b.id), men = pool.filter((v) => v.arm === arm).sort((a, b) => a.id - b.id);
    men.forEach((v, k) => { const c = cells[Math.floor(k / (CS * CS))], n = k % (CS * CS); if (c) chosen.push({ v, x: c.x + (n % CS) + 0.5, y: c.y + Math.floor(n / CS) + 0.5 }); });
  }
  if (!chosen.length) return 'Không có lính nào hợp với các ô đã đặt';
  const cx = chosen.reduce((s, c) => s + c.x, 0) / chosen.length, cy = chosen.reduce((s, c) => s + c.y, 0) / chosen.length;
  for (const { v, x, y } of chosen) {
    sim.exitBuilding(v); sim.resetTask(v); sim.clearCombat(v);
    v.lockUntil = 0; v.out = true; v.housed = false; v.recall = false; v.nightOwl = false; v.inTent = false; v.queue.length = 0;
    L.slots[String(v.id)] = { dx: x - cx, dy: y - cy };
  }
  Object.assign(L, { on: true, assembling: true, since: sim.time, clock: 0, cx, cy, theta: -Math.PI / 2, theta0: -Math.PI / 2, speed: 0, path: [] });
  sim.say(`${chosen.length} lính đang tập trung về các ô lính.`);
  return null;
}

/** The median of the speeds of the soldiers (1, 2, 3, 4 give 3): the speed of the whole army. */
function medianSpeed(sim: Sim, men: Villager[]): number {
  const s = men.map((v) => v.speed * sim.mountSpeed(v)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/** Walk one soldier a step toward a point, round whatever blocks him (a tile at a time, so he slides along a wall). Returns how far he went. */
function step(sim: Sim, v: Villager, tx: number, ty: number, len: number): number {
  const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
  if (d < 1e-6) return 0;
  const k = Math.min(1, len / d), nx = v.x + dx * k, ny = v.y + dy * k, w = sim.world;
  const open = (x: number, y: number) => !w.isBlocked(Math.floor(x), Math.floor(y));
  let ox = v.x, oy = v.y;
  if (open(nx, ny)) { v.x = nx; v.y = ny; } else if (open(nx, v.y)) v.x = nx; else if (open(v.x, ny)) v.y = ny;
  return Math.hypot(v.x - ox, v.y - oy);
}

const faceOf = (a: number): Villager['facing'] => { const c = Math.cos(a), s = Math.sin(a); return Math.abs(c) > Math.abs(s) * 1.1 ? (c > 0 ? 'right' : 'left') : s > 0 ? 'front' : 'back'; };

/** Order the army to march to a point: the centre of the block goes to it by the way a soldier would walk, the block keeping its shape and heading. Returns why not, or null. */
export function legionMove(sim: Sim, x: number, y: number): string | null {
  const L = sim.legion;
  if (!L.on) return 'Chưa có đội quân: bấm "Tập trận" ở Bãi tập';
  if (L.assembling) return 'Quân còn đang tập trung';
  const men = living(sim);
  if (!men.length) return 'Đội quân không còn ai';
  // the point the player taps is where the middle of the FRONT row stands (the row on the side the army goes to): the centre stops that far behind it
  const sx = x - L.cx, sy = y - L.cy, alongX = Math.abs(sx) > Math.abs(sy), sign = (alongX ? sx : sy) >= 0 ? 1 : -1;
  let reach = 0;
  for (const v of men) { const s = L.slots[String(v.id)]; if (s) reach = Math.max(reach, sign * (alongX ? s.dx : s.dy)); }
  const goal = sim.nearestFree(Math.floor(alongX ? x - sign * reach : x), Math.floor(alongX ? y : y - sign * reach), new Set());
  if (!goal) return 'Không có chỗ để tới';
  const agent = men.reduce((b, v) => (Math.hypot(v.x - L.cx, v.y - L.cy) < Math.hypot(b.x - L.cx, b.y - L.cy) ? v : b)); // the way is found as if the centre of the block were a man
  const ox = agent.x, oy = agent.y;
  agent.x = L.cx; agent.y = L.cy;
  const path = sim.pathTo(agent, goal[0], goal[1], 60000);
  agent.x = ox; agent.y = oy;
  if (!path.length) return 'Không có đường tới đó';
  L.path = path.map(([px, py]) => [px, py] as [number, number]);
  L.speed = medianSpeed(sim, men);
  return null;
}

/** Let the army go: its soldiers are their own masters again (they go back to the camps by themselves). */
export function disband(sim: Sim): void {
  const L = sim.legion;
  for (const id of Object.keys(L.slots)) { const v = sim.byId.get(Number(id)); if (v) { v.slide = null; v.path = []; v.phase = 'idle'; } }
  Object.assign(L, { on: false, assembling: false, path: [], slots: {} });
}

/** Every tick: the army gathers into its squares, or marches. */
export function tickLegion(sim: Sim, dt: number): void {
  const L = sim.legion;
  if (!L.on) return;
  const men = living(sim);
  if (!men.length) { disband(sim); return; }
  if (L.assembling) {
    let ready = 0;
    for (const v of men) {
      const s = L.slots[String(v.id)], tx = L.cx + s.dx, ty = L.cy + s.dy, d = Math.hypot(tx - v.x, ty - v.y);
      v.phase = 'idle'; v.facing = v.facing ?? 'front';
      if (d < 0.3) { v.x = tx; v.y = ty; v.path = []; v.slide = null; v.facing = faceOf(L.theta); ready++; continue; }
      if (d > 3) { // far: by the roads, like anybody
        if (!v.path.length && sim.pathLeft > 0) { sim.pathLeft--; v.path = sim.pathTo(v, Math.floor(tx), Math.floor(ty), 30000); }
        sim.moveUnit(v, dt);
      } else { v.path = []; const moved = step(sim, v, tx, ty, v.speed * sim.mountSpeed(v) * dt); v.slide = moved > 0 ? { x: tx, y: ty, face: tx >= v.x ? 'right' : 'left' } : null; if (moved > 0) v.facing = faceOf(Math.atan2(ty - v.y, tx - v.x)); }
    }
    if (ready === men.length || (sim.time - L.since > LEG.assembleSeconds && ready >= men.length * 0.9)) { L.assembling = false; sim.say('Đội quân đã tập hợp, sẵn sàng hành quân.'); }
    return;
  }
  L.clock += dt;
  if (L.clock >= 1) { L.clock = 0; L.speed = medianSpeed(sim, men); }
  // the centre of the block walks its path; the block never turns: every soldier keeps his offset from the centre, so all go the same way in straight, parallel lines
  if (L.path.length) {
    const [px, py] = L.path[0], tx = px + 0.5, ty = py + 0.5, dx = tx - L.cx, dy = ty - L.cy, d = Math.hypot(dx, dy);
    if (d > 1e-6) {
      L.theta = Math.atan2(dy, dx); // only the way they face
      const go = L.speed * dt;
      if (d <= go) { L.cx = tx; L.cy = ty; L.path.shift(); } else { L.cx += (dx / d) * go; L.cy += (dy / d) * go; }
    } else L.path.shift();
  }
  for (const v of men) {
    const s = L.slots[String(v.id)], tx = L.cx + s.dx, ty = L.cy + s.dy, d = Math.hypot(tx - v.x, ty - v.y);
    v.path = []; v.phase = 'idle';
    // in formation every soldier walks (or stands) the way the army does: his look and his walk follow the heading of the army, never his own tiny corrections, so nothing flickers
    const heading = faceOf(L.theta), headSide = Math.cos(L.theta) >= 0 ? 'right' : 'left', marching = L.path.length > 0;
    if (d < 0.04 && !marching) { v.slide = null; v.facing = heading; continue; }
    const k = 1 + Math.min(LEG.catchup - 1, d / 4), moved = step(sim, v, tx, ty, L.speed * k * dt);
    if (marching || moved > 0) {
      const far = d > 1.5; // a straggler running to catch up looks where he runs
      v.facing = far ? faceOf(Math.atan2(ty - v.y, tx - v.x)) : heading;
      v.slide = { x: tx, y: ty, face: far ? (tx >= v.x ? 'right' : 'left') : headSide };
    } else { v.slide = null; v.facing = heading; }
  }
}
