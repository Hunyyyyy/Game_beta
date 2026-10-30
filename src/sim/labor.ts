/** Everyday work: gathering, carrying, building, and the phase machine that decides what a villager does next. */
import { toolBonus, workSpeed } from './statsys';
import { SEASON_DEF, WEATHER } from './calendar';
import { PACE } from './constants';
import { Building, BUILDINGS, holdsGoods, levelDef, maxHp, needsWork } from './buildings';
import { FARM_TIME, isStaffJob, JOBS, JOB_NAME, MAX_LEVEL, NodeKind, WorkJob, XP_LEVELS, BARE_HANDS, OUTDOOR_JOBS } from './jobs';
import { CARRY_CAP, RES_NAME } from './resources';
import { TIER_NAME, TIER_SPEED, TIER_YIELD, TOOL_NAME, TOOL_OF_JOB } from './tools';
import { RESEARCH } from './research';
import type { Sim } from './sim';
import { LEFT, REACH, RIGHT, Slide, Villager, XP_MULT } from './model';

// ---------------------------------------------------------------- việc làm
/** How fast a villager gets through crafting or research (1 = the nominal time). */
export function workRate(sim: Sim, v: Villager, job: WorkJob): number { return workFactor(sim, v, job); }

/** How the weather and the season treat work done in the open (1 = no effect). */
export function outdoorFactor(sim: Sim, job: WorkJob): number {
  return OUTDOOR_JOBS.includes(job) ? WEATHER[sim.weather].work * SEASON_DEF[sim.season].work : 1;
}

export function workFactor(sim: Sim, v: Villager, job: WorkJob, field = false): number {
  const season = job === 'food' ? SEASON_DEF[sim.season][field ? 'farm' : 'gather'] : 1;
  const tier = TOOL_OF_JOB[job] ? sim.toolTier(v, job) : -1;
  const tool = tier < 0 ? 1 : tier === 0 ? BARE_HANDS[job] ?? TIER_SPEED[0] : TIER_SPEED[tier] * (1 + toolBonus(sim, v, job as WorkJob, 'tspd') / 100);
  return workSpeed(sim, v) * (1 + 0.2 * v.skill[job].level) * tool * season * outdoorFactor(sim, job) * sim.restFactor(v);
}

export function gainXp(sim: Sim, v: Villager, job: WorkJob, dt: number): void {
  const s = v.skill[job];
  if (s.level >= MAX_LEVEL) return;
  s.xp += dt * PACE.work * XP_MULT[v.potential[job]];
  if (s.xp >= XP_LEVELS[s.level]) { s.level++; sim.say(`${v.name} lên cấp ${s.level} nghề ${JOB_NAME[job].toLowerCase()}.`); }
}

/** Tools wear with working time; at zero they are broken and thrown away, and the villager works as if bare-handed until a new tool. */
export function wear(sim: Sim, v: Villager, job: WorkJob, dt: number): void {
  const k = TOOL_OF_JOB[job], t = k ? v.tools[k] : null;
  if (!k || !t || t.dur <= 0) return;
  t.dur -= (dt * PACE.work) / (1 + toolBonus(sim, v, job, 'tdur') / 100);
  if (t.dur <= 0) { v.tools[k] = null; sim.say(`${TOOL_NAME[k]} ${TIER_NAME[t.tier].toLowerCase()} của ${v.name} đã hỏng, vứt bỏ.`); }
}

export function leaveNode(sim: Sim, v: Villager): void {
  if ((v.phase === 'goNode' || v.phase === 'work') && v.target >= 0) {
    const n = sim.world.nodes.get(v.target);
    if (n) { if (n.workers > 0) n.workers--; n.sides &= ~v.slot; }
  }
  v.slot = 0;
}

export function face(sim: Sim, v: Villager, tx: number, ty: number): void {
  const dx = tx + 0.5 - v.x, dy = ty + 0.5 - v.y;
  v.facing = Math.abs(dx) > Math.abs(dy) * 1.1 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back';
}

export function wait(sim: Sim, v: Villager, secs: number): void { v.phase = 'wait'; v.timer = secs; }

/** Dân luôn làm việc ở dạng nhìn ngang: nhìn về phía tâm vật thể. */
export function faceX(sim: Sim, v: Villager, cx: number): void { v.facing = cx >= v.x ? 'right' : 'left'; }

/** Chỗ đứng ngang bên trái hoặc bên phải một vật thể, cùng hàng với gốc của nó. */
export function nodeSlide(sim: Sim, v: Villager, nx: number, ny: number, kind: NodeKind): Slide {
  const left = v.slot === LEFT;
  return { x: nx + 0.5 + (left ? -REACH[kind] : REACH[kind]), y: ny + 0.875, face: left ? 'right' : 'left' };
}

/** Chỗ đứng ngang bên trái hoặc phải một công trình, sát mép dưới (mặt trước). */
export function edgeSlide(sim: Sim, v: Villager, b: Building): Slide {
  const d = BUILDINGS[b.kind], left = v.x < b.x + d.w / 2;
  return { x: left ? b.x - 0.3 : b.x + d.w + 0.3, y: b.y + d.h - 0.3 - (v.id % 2) * 0.5, face: left ? 'right' : 'left' };
}

/** Đứng yên nhìn ngang về phía công trình (dùng khi dỡ hàng, lấy công cụ). */
export function faceBuilding(sim: Sim, v: Villager, b: Building): void { faceX(sim, v, b.x + BUILDINGS[b.kind].w / 2); }

export function think(sim: Sim, v: Villager, dt: number): void {
  const N = sim.world.size;
  switch (v.phase) {
    case 'move': v.phase = 'idle'; sim.nextOrder(v); return;
    case 'idle': if (v.queue.length && sim.nextOrder(v)) return; if (v.job !== 'idle') plan(sim, v); return;
    case 'wait': v.timer -= dt; if (v.timer <= 0) v.phase = 'idle'; return;
    case 'goNode': {
      const n = sim.world.nodes.get(v.target);
      if (!n || n.amount <= 0) { leaveNode(sim, v); v.phase = 'idle'; return; }
      const nx = v.target % N, ny = (v.target / N) | 0;
      v.phase = 'work'; v.progress = 0;
      const sl = nodeSlide(sim, v, nx, ny, n.kind);
      if (Math.hypot(sl.x - v.x, sl.y - v.y) < 0.04) v.facing = sl.face; else v.slide = sl;
      return;
    }
    case 'work': doWork(sim, v, dt); return;
    case 'goStore': unload(sim, v); return;
    case 'goEquip': sim.equip(v); return;
    case 'goSite': {
      const b = sim.getBuilding(v.target);
      if (!b || !needsWork(b)) { v.phase = 'idle'; return; }
      v.phase = 'build';
      v.slide = edgeSlide(sim, v, b);
      return;
    }
    case 'build': {
      const b = sim.getBuilding(v.target);
      if (!b || !needsWork(b)) { v.phase = 'idle'; return; }
      const target = b.upgrading ? b.level + 1 : b.level;
      b.progress += (dt * PACE.work / (levelDef(b, target).buildTime * (b.rebuild ? 0.5 : 1))) * workFactor(sim, v, 'build') * sim.crewSpeed();
      gainXp(sim, v, 'build', dt); wear(sim, v, 'build', dt);
      if (b.progress >= 1) {
        b.progress = 1;
        if (b.upgrading) { b.level++; b.upgrading = false; b.hp = maxHp(b); sim.say(`${BUILDINGS[b.kind].name} đã lên cấp ${b.level} (${levelDef(b).name.toLowerCase()}).`); }
        else { b.done = true; b.rebuild = false; sim.fogDirty = true; if (b.kind === 'builder') sim.trimCrew(); sim.say(`${BUILDINGS[b.kind].name} đã dựng xong.`); if (RESEARCH.enabled && b.kind === 'lab' && sim.researched.size === 0) sim.say('Mở Nhà nghiên cứu, đưa một dân vào làm việc, rồi nghiên cứu bản vẽ đầu tiên.'); }
        v.phase = 'idle';
      }
      return;
    }
    case 'goStaff': sim.enterBuilding(v); return;
    case 'goOrder': sim.errand(v); return;
    case 'inside': return;
    case 'goHome': {
      // at the sleeping spot: stash carried goods in the campfire (it is also a store)
      stash(sim, v);
      const bed = v.target >= 0 ? sim.getBuilding(v.target) : undefined;
      if (bed && bed.done) sim.sleepIn(v, bed); else { v.phase = 'sleep'; v.facing = 'front'; }
      return;
    }
    case 'sleep': return;
  }
}

export function doWork(sim: Sim, v: Villager, dt: number): void {
  const job = v.job as WorkJob, def = JOBS[job], n = sim.world.nodes.get(v.target);
  if (!def.res || !n || n.amount <= 0) { leaveNode(sim, v); v.phase = 'idle'; return; }
  v.progress += (dt * workFactor(sim, v, job)) / def.baseTime; // gathering is timed in real seconds, see pace.json
  gainXp(sim, v, job, dt);
  const tierNow = sim.toolTier(v, job);
  wear(sim, v, job, dt);
  if (v.progress < 1) return;
  v.progress -= 1;
  // sản lượng mỗi lần theo chất lượng công cụ, phần lẻ cộng dồn sang lần sau
  const res = def.res, acc = v.frac + TIER_YIELD[tierNow] * (1 + toolBonus(sim, v, job as WorkJob, 'tyield') / 100), whole = Math.floor(acc);
  const have = v.carry && v.carry.res === res ? v.carry.amount : 0;
  const take = Math.max(0, Math.min(whole, n.amount, CARRY_CAP[res] - have));
  v.frac = acc - whole;
  n.amount -= take;
  v.carry = { res, amount: have + take };
  // gatherers now and then turn up a shell (the stone age's money) among the berries
  if (res === 'food' && take > 0) {
    sim.coinFrac += 0.06 * take;
    if (sim.coinFrac >= 1) { sim.coinFrac -= 1; if (sim.stock.coin < sim.capacity()) { sim.stock.coin++; if (!sim.sawCoin) { sim.sawCoin = true; sim.say(`${v.name} nhặt được một ${RES_NAME.coin.toLowerCase()}: dân làng dùng nó để trao đổi.`); } } }
  }
  if (n.amount <= 0) {
    const idx = v.target; leaveNode(sim, v); sim.world.depleted(idx); v.phase = 'idle';
    if (n.kind === 'tree') sim.say('Một cây đã được đốn xong.');
  } else if (v.carry.amount >= CARRY_CAP[res] || sim.needTool(v, job)) { leaveNode(sim, v); v.phase = 'idle'; }
}

/** The fields work: whoever the player put inside one grows food straight into the store, faster in a field of a higher level, with a hoe, and with the season. */
export function tickFarms(sim: Sim, dt: number): void {
  for (const b of sim.buildings) {
    if (b.kind !== 'field' || !b.done) continue;
    for (const id of b.staff) {
      const v = sim.byId.get(id);
      if (!v || v.phase !== 'inside' || v.job !== 'food' || sim.stock.food >= sim.capacity('food')) continue;
      v.progress += (dt * workFactor(sim, v, 'food', true) * levelDef(b).craftSpeed) / FARM_TIME;
      gainXp(sim, v, 'food', dt); wear(sim, v, 'food', dt);
      if (v.progress < 1) continue;
      v.progress -= 1;
      const acc = v.frac + TIER_YIELD[sim.toolTier(v, 'food')] * (1 + toolBonus(sim, v, 'food', 'tyield') / 100), whole = Math.floor(acc);
      const was = sim.stock.food;
      v.frac = acc - whole; sim.stock.food = Math.min(sim.capacity('food'), sim.stock.food + whole);
      sim.noteYield('farm', sim.stock.food - was);
    }
  }
}

export function plan(sim: Sim, v: Villager): void {
  if (v.job === 'hunt' || v.job === 'fight' || v.job === 'scout') { wait(sim, v, 1); return; } // combat code (and the scouting trip) drives these jobs
  if (v.job === 'build') { if (!sim.planTool(v, 'build')) planBuild(sim, v); return; }
  if (isStaffJob(v.job) || (v.job === 'food' && v.post >= 0)) { sim.planStaff(v); return; }
  const def = JOBS[v.job as WorkJob], res = def.res!;
  if (v.carry && (v.carry.res !== res || v.carry.amount >= CARRY_CAP[v.carry.res])) { planDeliver(sim, v); return; }
  if (sim.stock[res] >= sim.capacity(res)) {
    if (v.carry) { planDeliver(sim, v); return; }
    if (sim.time - sim.lastFullWarn > 30) { sim.lastFullWarn = sim.time; sim.say(`Kho đã đầy ${RES_NAME[res].toLowerCase()}, hãy xây thêm Kho.`); }
    wait(sim, v, 3); return;
  }
  if (sim.planTool(v, v.job as WorkJob)) return;
  if (findNode(sim, v, def.node!)) return;
  if (v.carry) { planDeliver(sim, v); return; }
  wait(sim, v, 2);
}

export function findNode(sim: Sim, v: Villager, kind: NodeKind): boolean {
  const N = sim.world.size, vx = Math.floor(v.x), vy = Math.floor(v.y);
  const ok = (idx: number) => {
    const n = sim.world.nodes.get(idx);
    return !!n && n.kind === kind && n.amount > 0 && n.workers < 2 && n.sides !== 3 && sim.fog.state[idx] > 0 && (v.bad.get(idx) ?? 0) <= sim.time;
  };
  const cands: Array<[number, number]> = [];
  if (v.prefer >= 0 && ok(v.prefer)) cands.push([-1, v.prefer]);
  for (const [idx, n] of sim.world.nodes) {
    if (n.kind !== kind || n.amount <= 0 || n.workers >= 2 || n.sides === 3 || idx === v.prefer || !ok(idx)) continue;
    const d = (idx % N - vx) ** 2 + (((idx / N) | 0) - vy) ** 2;
    if (d <= 70 * 70) cands.push([d, idx]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  for (let c = 0; c < Math.min(4, cands.length); c++) {
    const idx = cands[c][1], nx = idx % N, ny = (idx / N) | 0, node = sim.world.nodes.get(idx)!;
    // Mỗi nguồn có 2 chỗ đứng ngang (trái, phải). Ô tiếp cận ưu tiên: ngay cạnh, chéo dưới, chéo trên, rồi chính giữa dưới/trên.
    // Vì dân trượt từ ô tiếp cận vào chỗ đứng, cây ở giữa hai cây khác vẫn chặt được miễn có ô trống nào quanh nó.
    const opts: Array<{ t: [number, number]; side: number; pen: number }> = [];
    for (const side of [LEFT, RIGHT]) {
      if (node.sides & side) continue;
      const sx = side === LEFT ? -1 : 1;
      const near: Array<[number, number, number]> = [[sx, 0, 0], [sx, 1, 0.6], [sx, -1, 1.6], [0, 1, 1.2], [0, -1, 2.4]];
      for (const [dx, dy, pen] of near) if (!sim.world.isBlocked(nx + dx, ny + dy)) opts.push({ t: [nx + dx, ny + dy], side, pen });
    }
    const cost = (o: { t: [number, number]; pen: number }) => Math.hypot(o.t[0] + 0.5 - v.x, o.t[1] + 0.5 - v.y) + o.pen;
    opts.sort((a, b) => cost(a) - cost(b));
    const k = sim.routeTo(v, opts.map((o) => o.t), 4);
    if (k >= 0) {
      node.workers++; node.sides |= opts[k].side; v.slot = opts[k].side;
      v.target = idx; v.phase = 'goNode'; v.prefer = -1;
      return true;
    }
    v.bad.set(idx, sim.time + 30);
  }
  if (v.prefer >= 0) {
    if (sim.world.nodes.has(v.prefer) && (v.bad.get(v.prefer) ?? 0) > sim.time) sim.say(`${v.name} không tìm được đường tới nguồn đã chọn.`);
    v.prefer = -1;
  }
  return false;
}

export function planDeliver(sim: Sim, v: Villager): void {
  const done = sim.buildings.filter((b) => b.done && holdsGoods(b));
  done.sort((a, b) => Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
  for (const b of done.slice(0, 2)) {
    const d = BUILDINGS[b.kind];
    if (sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) { v.target = b.id; v.phase = 'goStore'; return; }
  }
  wait(sim, v, 2);
}

/** Put what a villager carries into the store on the spot (they pass the fire on their way to bed). */
export function stash(sim: Sim, v: Villager): void {
  const c = v.carry; if (!c) return;
  const moved = Math.min(Math.max(0, sim.capacity(c.res) - sim.stock[c.res]), c.amount);
  sim.stock[c.res] += moved; c.amount -= moved; sim.noteYield(v.job, moved);
  if (c.amount <= 0) v.carry = null;
}

export function unload(sim: Sim, v: Villager): void {
  const c = v.carry, st = sim.getBuilding(v.target);
  if (st) faceBuilding(sim, v, st);
  if (!c) { v.phase = 'idle'; return; }
  const space = Math.max(0, sim.capacity(c.res) - sim.stock[c.res]), moved = Math.min(space, c.amount);
  sim.stock[c.res] += moved; c.amount -= moved; sim.noteYield(v.job, moved);
  if (c.amount <= 0) { v.carry = null; v.phase = 'idle'; return; }
  if (sim.time - sim.lastFullWarn > 30) { sim.lastFullWarn = sim.time; sim.say(`Kho đã đầy ${RES_NAME[c.res].toLowerCase()}, hãy xây thêm Kho.`); }
  wait(sim, v, 3);
}

export function planBuild(sim: Sim, v: Villager): void {
  const onSite = (b: Building) => sim.villagers.filter((o) => o !== v && o.target === b.id && (o.phase === 'goSite' || o.phase === 'build')).length;
  const house = !!sim.building('builder');
  let sites = sim.buildings.filter((b) => needsWork(b) && (house || b.kind === 'builder') && onSite(b) < 3);
  sites.sort((a, b) => (b.id === v.prefer ? 1 : 0) - (a.id === v.prefer ? 1 : 0) ||
    Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
  sites = sites.slice(0, 2);
  for (const b of sites) {
    const d = BUILDINGS[b.kind];
    if (sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) { v.target = b.id; v.phase = 'goSite'; v.prefer = -1; return; }
  }
  wait(sim, v, 2);
}
