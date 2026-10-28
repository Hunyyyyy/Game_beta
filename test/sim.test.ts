import { readFileSync } from 'fs';
import { renderFrame } from '../src/character/rig.js';
import { Sim } from '../src/sim/sim';
import { DAY_LENGTH, PACE } from '../src/sim/constants';
import { Tile } from '../src/sim/world';
import { lightAt, rollWeather, seasonOf, SEASONS } from '../src/sim/calendar';
import { TIER_DURABILITY } from '../src/sim/tools';
import { levelDef, levelsOf, maxLevel } from '../src/sim/buildings';
import { ANIMALS, ARMORS, cycleOf, damageOf, MORALE, RULES, TRIBES, TRIBE_IDS, WEAPONS, zoneOf } from '../src/sim/combat';
import { swingTimes, weaponOf } from '../src/sim/battle';
import { spawnAnimal } from '../src/sim/fauna';
import type { Villager } from '../src/sim/sim';
import * as dev from '../src/sim/dev';
import { NOT_SAVED, SAVE_VERSION, SAVED } from '../src/sim/save';
import { RESEARCH, TECHS } from '../src/sim/research';
import { RES_NAME } from '../src/sim/resources';

PACE.work = 1; // the tests count work in plain seconds; the pace has its own test
RESEARCH.enabled = false; // most tests run with everything open; the research tests switch it on

let fails = 0;
const ok = (c: boolean, msg: string) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
const run = (sim: Sim, secs: number) => { for (let i = 0; i < secs * 20; i++) (sim as unknown as { tick(d: number): void }).tick(0.05); };

/** The old test start: three idle villagers. The real start (two with jobs) has its own test. */
const mk = (seed = 1337): Sim => { const sm = new Sim(seed); sm.villagers.forEach((o) => { o.job = 'idle'; }); dev.addVillagers(sm, 1); return sm; };
/** Put a finished house of this kind on the map (the real game needs builders and the right order; most tests only need the house). */
const putBuilding = (sm: Sim, kind: Parameters<Sim['canPlace']>[0]) => {
  const was = { f: sm.dev.freeBuild, i: sm.dev.instantBuild }; sm.dev.freeBuild = sm.dev.instantBuild = true;
  const sp = sm.world.start;
  try { for (let r = 3; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (let dy = 3; dy <= r + 3; dy++) if (!sm.canPlace(kind, sp.x + dx * 2, sp.y + dy)) { const x = sm.placeBuilding(kind, sp.x + dx * 2, sp.y + dy); if (x.ok) return x.building!; } }
  finally { sm.dev.freeBuild = was.f; sm.dev.instantBuild = was.i; }
  throw new Error('no spot for ' + kind);
};
const sim = mk(1337);
const w = sim.world;
ok(sim.villagers.length === 3, '3 dân trong bài thử cũ (2 dân gốc + 1)');
ok(sim.buildings.length === 1 && sim.buildings[0].done, 'Nhà chung dựng sẵn');
ok(sim.capacity('wood') === 30, 'sức chứa ban đầu 30 (củi lửa)');
const s = w.start;
const near = (k: number) => [...w.nodes.entries()].filter(([, n]) => n.kind === k as never);
ok(near('tree' as never).length > 50 && near('rock' as never).length > 5 && near('bush' as never).length > 5, 'có đủ cây, đá, bụi');
let seen = 0; for (let i = 0; i < sim.fog.state.length; i++) if (sim.fog.state[i] > 0) seen++;
ok(seen > 100, 'khu khởi đầu đã sáng');

// cây gần nhất trong vùng đã thấy hoặc ngay sau khi đi khám phá
sim.setJob(sim.villagers.map((v) => v.id), 'idle');
// đặt thử Kho khi chưa đủ gỗ
const spot = [s.x + 2, s.y - 2] as const;
ok(sim.canPlace('storage', spot[0], spot[1]) !== null, 'Kho bị từ chối khi thiếu gỗ');

// giao nghề đốn gỗ cho cả 3, chạy 2 ngày game
const ids = sim.villagers.map((v) => v.id);
// đi khám phá để lộ cây: gửi dân ra các hướng
sim.orderMove([ids[0]], s.x - 8, s.y); sim.orderMove([ids[1]], s.x + 8, s.y); sim.orderMove([ids[2]], s.x, s.y + 8);
run(sim, 12);
sim.setJob([ids[0], ids[1]], 'wood'); sim.setJob([ids[2]], 'food');
run(sim, 150);
console.log('stock', JSON.stringify(sim.stock), 'carry', sim.villagers.map((v) => `${v.name}:${v.phase}:${v.carry?.amount ?? 0}`).join(' '));
ok(sim.stock.wood >= 10, `có gỗ trong kho (${sim.stock.wood})`);
const f0 = sim.stock.food;
run(sim, 90);
ok(sim.stock.food > 0, `thức ăn còn (${sim.stock.food})`);

// đặt và xây Kho (cần Nhà thợ xây trước)
ok(sim.canPlace('storage', s.x + 2, s.y - 2) === 'Cần dựng Nhà thợ xây trước' || sim.canPlace('storage', s.x + 2, s.y - 2) !== null, 'chưa có Nhà thợ xây thì chưa đặt được Kho');
putBuilding(sim, 'builder');
const give = sim.stock.wood; sim.stock.wood = Math.max(give, 10);
let placed = null as ReturnType<Sim['placeBuilding']> | null;
for (let dx = -6; dx <= 6 && !placed?.ok; dx++) for (let dy = -6; dy <= 6 && !placed?.ok; dy++) if (!sim.canPlace('storage', s.x + dx, s.y + dy)) placed = sim.placeBuilding('storage', s.x + dx, s.y + dy);
ok(!!placed?.ok, 'đặt được Kho');
ok(sim.stock.wood === Math.max(give, 10) - 10, 'trừ 10 gỗ khi đặt');
sim.setJob([ids[0], ids[1]], 'build');
run(sim, 120);
ok(!!placed?.building?.done, `Kho dựng xong (progress ${placed?.building?.progress.toFixed(2)})`);
ok(sim.capacity('wood') === 130, 'sức chứa tăng lên 130');

// đá
sim.setJob([ids[0], ids[1]], 'stone');
for (let k = 0; k < 4 && sim.stock.stone < 4; k++) { sim.orderMove([ids[0]], s.x + (k % 2 ? 9 : -9), s.y + (k > 1 ? 9 : -9)); run(sim, 15); sim.setJob([ids[0], ids[1]], 'stone'); run(sim, 40); }
ok(sim.stock.stone > 0, `đá về kho (${sim.stock.stone})`);

// đói: bỏ hết thức ăn, nghỉ việc
const sim2 = mk(7); sim2.stock.food = 0;
run(sim2, DAY_LENGTH * 4);
ok(sim2.villagers.length === 0, 'dân chết đói khi không còn thức ăn');

// bụi mọc lại
const bush = [...w.nodes.entries()].find(([, n]) => n.kind === 'bush')!;
bush[1].amount = 0; bush[1].regrow = 240; w.tick(241);
ok(bush[1].amount === bush[1].max, 'bụi quả mọc lại sau 240 giây');

// cây cạn thành gốc
const tree = [...w.nodes.entries()].find(([, n]) => n.kind === 'tree')!;
w.depleted(tree[0]);
ok(w.tiles[tree[0]] === Tile.Grass && w.decor[tree[0]] === 1 && !w.nodes.has(tree[0]), 'cây cạn trở thành gốc, ô đi được');

// ======== M2.1: công cụ, Xưởng, chỗ đứng ========
function reveal(sm: Sim) { sm.fog.state.fill(2); }
function chopTest(tool: { tier: number; dur: number } | null, secs: number): { wood: number; maxDist: number } {
  const sm = mk(1337); reveal(sm); sm.buildings[0].level = 4; // a roomy store, so the count is not cut off
  const v = sm.villagers[0]; sm.villagers.slice(1).forEach((o) => { o.fullness = 1e9; });
  v.fullness = 1e9; v.tools.axe = tool; sm.setJob([v.id], 'wood');
  let maxDist = 0; const N = sm.world.size;
  for (let i = 0; i < secs * 20; i++) {
    (sm as unknown as { tick(d: number): void }).tick(0.05);
    if (v.phase === 'work' && !v.slide && v.target >= 0) {
      const bx = (v.target % N) + 0.5, by = ((v.target / N) | 0) + 0.875;
      maxDist = Math.max(maxDist, Math.hypot(v.x - bx, v.y - by));
    }
  }
  return { wood: sm.stock.wood + (v.carry?.amount ?? 0), maxDist };
}
const none = chopTest(null, 240), wood1 = chopTest({ tier: 1, dur: 240 }, 240), stone2 = chopTest({ tier: 2, dur: 600 }, 240);
console.log('gỗ sau 240 s: tay không', none.wood, '· rìu gỗ', wood1.wood, '· rìu đá', stone2.wood);
ok(wood1.wood > none.wood * 1.4, 'rìu gỗ làm nhiều hơn tay không');
ok(stone2.wood > wood1.wood * 1.2, 'rìu đá làm nhiều hơn rìu gỗ');
ok(none.maxDist < 0.8 && wood1.maxDist < 0.8, `dân đứng sát cây khi đốn (xa nhất ${none.maxDist.toFixed(2)} ô)`);

{
  // the crafting chain with research off (everything open): craft house, stores, repair house, staff inside
  const sm = mk(1337); reveal(sm);
  const [a, b, c] = sm.villagers; sm.villagers.forEach((o) => { o.fullness = 1e9; });
  ok(sm.queueCraft('axe1') !== null, 'no craft house: nothing can be queued');
  sm.stock.wood = 200; sm.stock.stone = 100; sm.time = DAY_LENGTH * 0.3;
  dev.buildAll(sm);
  const kinds = ['workshop', 'lab', 'repair', 'toolstore', 'armory', 'storage'];
  ok(kinds.every((k) => sm.buildings.some((x) => x.kind === k && x.done)), 'all six houses stand');
  ok(sm.buildingLock('workshop')?.startsWith('Mỗi công trình') && sm.placeBuilding('storage', sm.world.start.x, sm.world.start.y + 6).ok === false, 'only one building of each kind may exist');
  ok(sm.stock.wood === 200, 'dev building cost nothing');
  ok(sm.assignStaff([a.id], 'craft') === null, 'a villager is sent to work in the craft house');
  run(sm, 30);
  const shop = sm.building('workshop')!;
  ok(a.inside === shop.id && shop.staff.includes(a.id) && a.phase === 'inside', 'he walks in and is listed inside the house');
  ok(sm.assignStaff([b.id, c.id], 'craft') === 'Nhà chế tạo cấp 1 chỉ chứa 1 người' && !b.job.startsWith('craft'), 'a level-1 house holds one worker');
  ok(sm.queueCraft('axe1') === null && sm.queueCraft('pick2') === null, 'with research off every recipe can be queued');
  const w0 = sm.stock.wood, s0 = sm.stock.stone; run(sm, 100);
  ok(sm.toolCount('axe', 1) === 1 && sm.toolCount('pick', 2) === 1, `the worker inside turns out an axe and a pick (${JSON.stringify(sm.toolStock)})`);
  ok(sm.stock.wood === w0 - 5 && sm.stock.stone === s0 - 4, `materials are paid (wood ${sm.stock.wood}, stone ${sm.stock.stone})`);
  // fetching: a woodcutter without an axe walks to the tool store
  sm.stock.wood = 30; sm.stock.stone = 30;
  sm.setJob([b.id], 'wood'); run(sm, 40);
  ok(b.tools.axe?.tier === 1 && sm.toolCount('axe', 1) === 0, 'a woodcutter with empty hands fetches the axe from the tool store');
  sm.setJob([c.id], 'stone'); run(sm, 40);
  ok(c.tools.pick?.tier === 2, 'a stonecutter fetches the pick');
  // wear and repair: the tool breaks, is handed in, mended and fetched again
  b.tools.axe = { tier: 1, dur: 3 }; run(sm, 8);
  ok(b.tools.axe === null || b.tools.axe.dur <= 0 || sm.repairQueue.length + (sm.building('repair')!.active ? 1 : 0) > 0, 'a worn-out axe breaks and goes to repair');
  ok(sm.toolTier(b, 'wood') === 0, 'a broken tool works like bare hands');
  sm.assignStaff([a.id], 'repair'); sm.assignStaff([a.id], 'craft');
  const t = sm.building('repair')!;
  sm.setJob([a.id], 'idle'); sm.assignStaff([a.id], 'repair'); run(sm, 3600 / 20);
  ok(sm.repairQueue.length === 0 && !t.active, 'the repair house finished its work');
  ok(sm.toolCount('axe', 1) >= 0 && (b.tools.axe?.dur ?? 0) > 3, 'the mended axe is fetched back and is whole again');
  // staff leave when the job changes; a demolished house empties
  sm.setJob([a.id], 'idle');
  ok(a.inside === null && !t.staff.includes(a.id) && a.phase !== 'inside', 'changing the job brings the worker out');
}

// ======== M2.2: luôn đứng ngang khi tương tác, cây chụm ba ========
function plant(sm: Sim, x: number, y: number) {
  const i = y * sm.world.size + x; sm.world.tiles[i] = Tile.Tree;
  sm.world.nodes.set(i, { kind: 'tree', res: 'wood', amount: 10, max: 10, workers: 0, sides: 0, regrow: 0 });
  return i;
}
function clearArea(sm: Sim, cx: number, cy: number, r: number) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const i = y * sm.world.size + x; sm.world.tiles[i] = Tile.Grass; sm.world.nodes.delete(i); sm.world.occ[i] = 0;
  }
}
const sideOnly = (f: string) => f === 'left' || f === 'right';
{
  // ba cây chụm: giữa bị hai cây hai bên chặn, vẫn phải chặt được và đứng ngang
  const sm = mk(1337); reveal(sm); const cx = sm.world.start.x + 9, cy = sm.world.start.y + 4;
  clearArea(sm, cx, cy, 4);
  plant(sm, cx - 1, cy); const mid = plant(sm, cx, cy); plant(sm, cx + 1, cy);
  const v = sm.villagers[0]; sm.villagers.forEach((o) => { o.fullness = 1e9; });
  ok(sm.orderWork([v.id], cx, cy) === 'Đốn gỗ', 'chuột phải lên cây giữa vẫn nhận lệnh');
  let reached = false, sideOk = true, maxDx = 0, dyOk = true;
  for (let i = 0; i < 20 * 400; i++) {
    (sm as unknown as { tick(d: number): void }).tick(0.05);
    if (v.phase === 'work' && v.target === mid && !v.slide) {
      reached = true; sideOk = sideOk && sideOnly(v.facing);
      maxDx = Math.max(maxDx, Math.abs(Math.abs(v.x - (cx + 0.5)) - 0.55)); dyOk = dyOk && Math.abs(v.y - (cy + 0.875)) < 0.05;
    }
    if (reached && (sm.world.nodes.get(mid)?.amount ?? 0) < 8) break;
  }
  ok(reached, 'dân tới chặt được cây giữa hai cây khác');
  ok(sideOk && dyOk && maxDx < 0.05, 'đứng ở chỗ ngang bên cạnh cây, nhìn ngang');
  ok((sm.world.nodes.get(mid)?.amount ?? 0) < 8, 'chặt được gỗ từ cây giữa');
  // chỗ đứng lấn sang ô cây bên cạnh: mang đủ gỗ vẫn phải ra được để về kho
  sm.time = DAY_LENGTH * 0.3; run(sm, 120);
  ok(sm.stock.wood > 0 && Math.floor(v.x) !== cx + 1, `dân chặt cây giữa vẫn mang được gỗ về kho (kho ${sm.stock.wood})`);
}
{
  // hai dân cùng chặt một cây: mỗi người một bên
  const sm = mk(1337); reveal(sm); const cx = sm.world.start.x + 9, cy = sm.world.start.y + 4;
  clearArea(sm, cx, cy, 4); const t = plant(sm, cx, cy);
  const [a, b] = sm.villagers; sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.orderWork([a.id, b.id], cx, cy);
  let both = false;
  for (let i = 0; i < 20 * 40 && !both; i++) {
    (sm as unknown as { tick(d: number): void }).tick(0.05);
    both = a.phase === 'work' && b.phase === 'work' && !a.slide && !b.slide && a.target === t && b.target === t;
  }
  ok(both && Math.abs(a.x - b.x) > 1, 'hai dân cùng cây đứng hai bên khác nhau');
}
{
  // cây bị vây kín bởi 8 cây: không ai tới được, dân chuyển sang cây khác thay vì kẹt
  const sm = mk(1337); reveal(sm); const cx = sm.world.start.x + 9, cy = sm.world.start.y + 4;
  clearArea(sm, cx, cy, 4); const mid = plant(sm, cx, cy);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) plant(sm, cx + dx, cy + dy);
  const v = sm.villagers[0]; sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.orderWork([v.id], cx, cy); run(sm, 60);
  ok(sm.world.nodes.get(mid)!.amount === 10 && sm.world.nodes.get(mid)!.workers === 0, 'cây bị vây kín không có ai giữ chỗ');
  ok(v.job === 'wood' && v.phase !== 'idle', 'dân chuyển sang cây khác, không kẹt');
}
{
  // mọi nghề tương tác đều đứng ngang
  const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const [a, b, c] = sm.villagers; sm.stock.wood = 60; sm.stock.stone = 20;
  let bad = ''; putBuilding(sm, 'builder');
  const sp = sm.world.start;
  const spot = (() => { for (let dx = -8; dx <= 8; dx++) for (let dy = 3; dy <= 9; dy++) if (!sm.canPlace('workshop', sp.x + dx, sp.y + dy)) return [sp.x + dx, sp.y + dy]; return null; })()!;
  sm.placeBuilding('workshop', spot[0], spot[1]);
  sm.setJob([a.id, b.id, c.id], 'build');
  const watch = (n: number) => { for (let i = 0; i < n * 20; i++) { (sm as unknown as { tick(d: number): void }).tick(0.05);
    for (const v of sm.villagers) if ((v.phase === 'work' || v.phase === 'build' || v.phase === 'craft') && !v.slide && !sideOnly(v.facing)) bad = `${v.name} ${v.phase} nhìn ${v.facing}`; } };
  watch(80); sm.queueCraft('axe1'); sm.queueCraft('hammer1');
  sm.setJob([a.id], 'craft'); sm.setJob([b.id], 'wood'); sm.setJob([c.id], 'stone'); watch(100);
  sm.setJob([c.id], 'food'); watch(60);
  ok(bad === '', 'xây, chế tác, chặt, đào, hái đều nhìn ngang ' + bad);
}

// ======== the start of the game: two villagers, a gatherer who feeds both ========
{
  const sm = new Sim(1337); sm.fog.state.fill(2);
  const [g, w] = sm.villagers;
  ok(sm.villagers.length === 2 && g.job === 'food' && w.job === 'wood', 'start with two villagers: a gatherer and a woodcutter');
  ok(sm.stock.food === 20, 'food for two people for two days (5 a day each)');
  PACE.work = 0.2; // the real pace of work for this check
  g.fullness = 1e9; w.fullness = 1e9;
  const before = sm.stock.food + (g.carry?.amount ?? 0);
  run(sm, DAY_LENGTH * 0.75);
  PACE.work = 1;
  const gained = sm.stock.food - before + (g.carry?.amount ?? 0);
  ok(gained >= 10, `one gatherer brings in enough food for two people in a day (${gained})`);
  // sleeping slows hunger
  const sm2 = new Sim(1337); sm2.fog.state.fill(2); sm2.time = DAY_LENGTH * 0.9; const [p, q] = sm2.villagers;
  run(sm2, 60);
  ok(p.phase === 'sleep', 'asleep at night');
  p.fullness = 80; q.fullness = 80; run(sm2, 60);
  sm2.time = DAY_LENGTH * 0.4; q.phase = 'idle'; q.job = 'idle'; q.fullness = 80; run(sm2, 0.05);
  const slept = 80 - p.fullness; q.fullness = 80; run(sm2, 60);
  ok(slept > 0 && slept < (80 - q.fullness) * 0.6, `a sleeper gets hungry more slowly (${slept.toFixed(2)} vs ${(80 - q.fullness).toFixed(2)})`);
}

// ======== builders belong to the Nhà thợ xây; houses go up in a fixed order ========
{
  const sm = new Sim(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const [a, b] = sm.villagers;
  ok(sm.setJob([a.id], 'build') === 'Chưa có Nhà thợ xây, hoặc chưa xây xong' && a.job === 'food', 'without the builder house nobody can be made a builder');
  ok(sm.buildingLock('storage') === 'Cần dựng Nhà thợ xây trước' && sm.buildingLock('workshop') === 'Cần dựng Nhà thợ xây trước', 'the Kho and the craft house wait for the Nhà thợ xây');
  ok(sm.buildingLock('lab') === 'Cần dựng Nhà chế tạo trước' && sm.buildingLock('repair') === 'Cần dựng Nhà chế tạo trước', 'research and repair houses wait for the craft house');
  sm.stock.wood = 100;
  const sp = sm.world.start; let spot: [number, number] | null = null;
  for (let dx = -8; dx <= 8 && !spot; dx++) for (let dy = 3; dy <= 9 && !spot; dy++) if (!sm.canPlace('builder', sp.x + dx, sp.y + dy)) spot = [sp.x + dx, sp.y + dy];
  const house = sm.placeBuilding('builder', spot![0], spot![1]).building!;
  ok(sm.orderWork([a.id], spot![0], spot![1]) === 'Thợ xây' && a.job === 'build', 'the very first house may be raised by whoever is sent to it');
  run(sm, 60);
  ok(house.done && sm.crew().length === 1, 'the builder raised the Nhà thợ xây and stays on as a builder');
  ok(sm.buildingLock('storage') === null && sm.buildingLock('lab') !== null, 'now the Kho can be placed, the research house still waits');
  const kho = sm.placeBuilding('storage', spot![0] + 4, spot![1]).building!;
  ok(sm.orderWork([b.id], spot![0] + 4, spot![1]) === null && b.job === 'wood', 'a villager who is not a builder cannot be sent to raise a house');
  ok(sm.assignCrew([b.id]) === null && sm.crew().length === 2, 'the player picks a second builder');
  const c = sm.makeVillager(sp.x, sp.y, 'm', 'player'); (sm.villagers as Villager[]).push(c); sm.registerUnit(c);
  ok(sm.assignCrew([c.id]) !== null && sm.crew().length === 2, 'the house holds two builders at level 1');
  run(sm, 120);
  ok(kho.done, 'builders raise the Kho');
  sm.releaseCrew([b.id]); ok(b.job === 'idle' && sm.crew().length === 1, 'a builder can be let go');
  sm.demolishBuilding(house.id); ok(sm.crew().length === 0 && a.job === 'idle', 'without the house its builders go idle');
  ok(sm.popCap() === 8 && sm.buildings[0].level === 1, 'the campfire starts as firewood: eight people, thirty of each good');
  sm.stock.wood = 100; sm.stock.stone = 100; sm.stock.hide = 20;
  ok(sm.upgradeBuilding(sm.buildings[0].id) === null && sm.buildings[0].upgrading, 'the campfire can be raised a level');
}

// ======== saving: a saved game goes on exactly like the one that was never stopped ========
{
  const same = (x: unknown, y: unknown): boolean => {
    if (x === y) return true;
    if (typeof x === 'number' && typeof y === 'number') return Number.isNaN(x) && Number.isNaN(y);
    if (!x || !y || typeof x !== 'object' || typeof y !== 'object') return (x ?? null) === (y ?? null);
    const ax = x as Record<string, unknown>, ay = y as Record<string, unknown>;
    const keys = new Set([...Object.keys(ax), ...Object.keys(ay)]);
    for (const k of keys) if (!same(ax[k], ay[k])) return false;
    return true;
  };
  const diff = (x: unknown, y: unknown, at = ''): string => {
    if (same(x, y)) return '';
    if (!x || !y || typeof x !== 'object' || typeof y !== 'object') return `${at}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`;
    for (const k of new Set([...Object.keys(x as object), ...Object.keys(y as object)])) { const d = diff((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k], `${at}.${k}`); if (d) return d; }
    return at;
  };
  // a busy game: jobs, a builder house, a tool, night falling, a wolf pack, some research
  const a = new Sim(1337); a.fog.state.fill(2); a.villagers.forEach((o) => { o.fullness = 1e9; });
  dev.addVillagers(a, 2);
  putBuilding(a, 'builder'); putBuilding(a, 'workshop'); putBuilding(a, 'lab');
  a.setJob([a.villagers[2].id], 'stone'); a.assignCrew([a.villagers[3].id]);
  a.stock.wood = 80; a.stock.stone = 40; a.stock.coin = 10; a.toolStock.axe1 = 2;
  RESEARCH.enabled = true; a.queueResearch('hammer1'); RESEARCH.enabled = false;
  run(a, 400); dev.wolvesNow(a, 3); run(a, 200);
  const t0 = performance.now();
  const snap = a.toSave();
  const json = JSON.stringify(snap);
  const ms = performance.now() - t0;
  console.log(`save: ${(json.length / 1024).toFixed(0)} KB of JSON, ${ms.toFixed(0)} ms`);
  const b = Sim.fromSave(JSON.parse(json));
  ok(same(b.toSave(), snap), 'a save loaded and saved again is the same save: ' + diff(b.toSave(), snap));
  ok(b.villagers.length === a.villagers.length && b.buildings.length === a.buildings.length && b.animals.length === a.animals.length && b.time === a.time, 'the people, houses, animals and clock come back');
  run(a, 600); run(b, 600);
  const da = diff(a.toSave(), b.toSave());
  ok(da === '', 'ten more minutes after loading go exactly as they do without stopping' + (da ? ': ' + da : ''));
  // and across the night, with research and the wolves
  run(a, 900); run(b, 900);
  const db = diff(a.toSave(), b.toSave());
  ok(db === '', 'and after another fifteen minutes still the same' + (db ? ': ' + db : ''));
  // loading into a running Sim replaces what it has
  const c = new Sim(1337); c.loadSave(JSON.parse(json));
  const cs = c.toSave(); ok(cs.fog.version === snap.fog.version + 1 && same({ ...cs, fog: { ...cs.fog, version: snap.fog.version } }, snap), 'loadSave puts a save into an existing game (and tells the screen to redraw the fog)');
  // the format is a contract
  ok(snap.version === SAVE_VERSION && JSON.stringify(JSON.parse(json)) === json, 'the save is plain JSON with a version');
  let err = ''; try { Sim.fromSave({ ...JSON.parse(json), version: SAVE_VERSION + 1 }); } catch (e) { err = String(e); }
  ok(err.includes('newer'), 'a save from a newer version is refused with a clear message');
  err = ''; try { Sim.fromSave({ hello: 1 }); } catch (e) { err = String(e); }
  ok(err.includes('not a saved game'), 'something that is not a save is refused');
  err = ''; try { new Sim(5).loadSave(JSON.parse(json)); } catch (e) { err = String(e); }
  ok(err.includes('world'), 'a save of another world is refused');
  // every piece of state is either saved or deliberately left out
  const known = new Set<string>([...Object.values(SAVED).flat(), ...NOT_SAVED]);
  const unknown = Object.keys(a).filter((k) => !known.has(k));
  ok(unknown.length === 0, 'every field of Sim is saved or deliberately not saved (add new ones to src/sim/save.ts): ' + unknown.join(', '));
  // a second game in the same process starts as new, nothing leaks between games
  ok(same(new Sim(1337).toSave(), new Sim(1337).toSave()), 'two new games of one seed are identical');
}

// ======== M3: ngày đêm, bốn mùa, thời tiết ========
const tickN = (sm: Sim, secs: number) => run(sm, secs);
{
  ok(seasonOf(1) === 'spring' && seasonOf(6) === 'summer' && seasonOf(11) === 'autumn' && seasonOf(16) === 'winter' && seasonOf(21) === 'spring', 'mỗi mùa 5 ngày, năm 20 ngày');
  const daylen = (se: typeof SEASONS[number]) => { let n = 0; for (let i = 0; i < 1000; i++) if (lightAt(i / 1000, se) >= 1) n++; return n / 1000; };
  ok(SEASONS.every((se) => Math.abs(daylen(se) - 0.6) < 0.01), 'mọi mùa ban ngày 12 phút trên 20 phút (0,6 ngày), còn lại là đêm 8 phút');
  ok(DAY_LENGTH === 1200, 'một ngày game dài 20 phút');
  ok(lightAt(0.5, 'spring') === 1 && lightAt(0, 'spring') === 0 && lightAt(0.82, 'spring') > 0 && lightAt(0.82, 'spring') < 1, 'trưa sáng, nửa đêm tối, hoàng hôn chuyển dần');
  const kinds = new Set<string>(); for (let i = 0; i < 200; i++) kinds.add(rollWeather('winter', i / 200));
  ok([...kinds].every((k) => ['clear', 'mist', 'snow'].includes(k)) && kinds.has('snow'), 'mùa đông chỉ có nắng, sương, tuyết');
}
{
  // tầm nhìn: 7 ô ban ngày, 3 ô ban đêm, sương trừ 2; lửa trại sáng 8 ô
  const sm = mk(1337);
  sm.time = DAY_LENGTH * 0.5; ok(sm.visionRadius() === 7, 'ban ngày nhìn 7 ô');
  sm.time = DAY_LENGTH * 1.0; ok(sm.visionRadius() === 3 && sm.fireRadius() === 8, 'ban đêm nhìn 3 ô, lửa trại vẫn 8 ô');
  sm.weather = 'mist'; ok(sm.visionRadius() === 1 && sm.fireRadius() === 6, 'sương mỏng trừ 2 ô tầm nhìn');
  // đêm: một dân ở xa lửa trại chỉ còn thấy quanh mình 3 ô
  const sm2 = mk(1337); reveal(sm2); sm2.villagers.forEach((o) => { o.fullness = 1e9; });
  const v = sm2.villagers[0], N = sm2.world.size;
  sm2.time = DAY_LENGTH * 0.5; sm2.orderMove([v.id], sm2.world.start.x + 20, sm2.world.start.y); tickN(sm2, 20);
  sm2.time = DAY_LENGTH * 1.0 + 1; sm2.orderMove([v.id], Math.floor(v.x), Math.floor(v.y)); tickN(sm2, 0.2);
  const at = (dx: number) => sm2.fog.state[Math.floor(v.y) * N + Math.floor(v.x) + dx];
  ok(at(2) === 2 && at(5) === 1, `ban đêm ô cách 2 còn thấy, ô cách 5 chỉ còn nhớ (${at(2)}, ${at(5)})`);
}
{
  // ngủ đêm: tối thì về lửa trại ngủ, sáng thì đi làm tiếp
  const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const ids = sm.villagers.map((o) => o.id); sm.setJob(ids, 'wood');
  const fire = sm.buildings[0];
  tickN(sm, DAY_LENGTH * 0.8 - sm.time); sm.stock.wood = 0; // the store has room for what they carry home
  tickN(sm, DAY_LENGTH * 0.04 + 10); // quá giữa hoàng hôn
  ok(sm.restTime, 'giữa hoàng hôn là giờ ngủ');
  tickN(sm, 30);
  ok(sm.villagers.every((o) => o.phase === 'sleep'), 'tối đến cả làng đi ngủ: ' + sm.villagers.map((o) => o.phase).join(','));
  ok(sm.villagers.every((o) => Math.hypot(o.x - fire.x - 1, o.y - fire.y - 1) < 4), 'ngủ quanh đống lửa');
  ok(new Set(sm.villagers.map((o) => o.bed)).size === 3, 'mỗi người một chỗ nằm');
  ok(sm.villagers.every((o) => o.job === 'wood' && !o.carry), 'vẫn giữ nghề, đồ mang theo đã cất kho');
  // an order in the middle of the night does not wake anyone: they stay in bed and start the new job in the morning
  const owl = sm.villagers[0]; tickN(sm, 30);
  sm.orderMove([owl.id], fire.x + 6, fire.y + 6); sm.setJob([owl.id], 'stone'); tickN(sm, 10);
  ok((owl.phase === 'sleep' || owl.phase === 'goHome') && !owl.nightOwl && owl.job === 'stone', 'ra lệnh ban đêm không đánh thức dân: giữ lệnh, sáng mới làm');
  const wakeAt = DAY_LENGTH * (1 + 0.2 - 0.025) + 2;
  tickN(sm, wakeAt - sm.time);
  ok(!sm.restTime && sm.villagers.every((o) => o.phase !== 'sleep'), 'sáng ra dân thức dậy');
  tickN(sm, 20);
  ok(sm.villagers.every((o) => ['goNode', 'work', 'goStore', 'wait', 'idle'].includes(o.phase)), 'sáng ra mọi người đi làm, kể cả người nhận việc mới lúc nửa đêm');
}
{
  // thời tiết làm chậm bước đi
  const walked = (wk: 'clear' | 'snow' | 'drizzle') => {
    const sm = mk(1337); reveal(sm); sm.time = DAY_LENGTH * 0.5; sm.weather = wk;
    const v = sm.villagers[0], x0 = v.x, y0 = v.y; sm.orderMove([v.id], sm.world.start.x + 30, sm.world.start.y + 1); tickN(sm, 4);
    return Math.hypot(v.x - x0, v.y - y0);
  };
  const c = walked('clear'), sn = walked('snow'), dr = walked('drizzle');
  ok(Math.abs(sn / c - 0.75) < 0.05 && Math.abs(dr / c - 0.9) < 0.05, `tuyết đi chậm 25%, mưa nhẹ 10% (${(sn / c).toFixed(2)}, ${(dr / c).toFixed(2)})`);
}
{
  // đổi ngày thì đổi thời tiết theo đúng lịch báo trước; sang đông bụi trụi; sang xuân bụi ra quả lại
  const sm = mk(1337); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const fc = sm.nextWeather; sm.time = DAY_LENGTH - 0.01; tickN(sm, 0.1);
  ok(sm.day === 2 && sm.weather === fc, 'thời tiết ngày mai đúng như đã định trước');
  sm.time = DAY_LENGTH * 15 - 0.01; tickN(sm, 0.1);
  const bushes = [...sm.world.nodes.values()].filter((n) => n.kind === 'bush');
  ok(sm.season === 'winter' && bushes.every((n) => n.amount === 0), 'vào đông mọi bụi quả trụi');
  ok(sm.log.some((l) => l.text.startsWith('Mùa đông')), 'có thông báo vào đông');
  sm.world.tick(500); ok(bushes.every((n) => n.amount === 0), 'mùa đông bụi không mọc lại');
  sm.time = DAY_LENGTH * 20 - 0.01; tickN(sm, 0.1);
  ok(sm.season === 'spring' && bushes.every((n) => n.amount === 0 && n.regrow > 0), 'sang xuân bụi ra hoa, chưa có quả');
  sm.world.tick(181); ok(bushes.every((n) => n.amount === n.max), 'vài phút sau bụi có quả lại');
}
{
  // quả hỏng sau 3 ngày; ăn lứa cũ trước
  const sm = mk(1337); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.stock.food = 0; tickN(sm, 1);
  sm.stock.food = 10; tickN(sm, DAY_LENGTH);
  sm.stock.food += 10; tickN(sm, 1);
  ok(sm.foodSpoilingWithin(DAY_LENGTH * 2.1) === 10 && sm.foodSpoilingWithin(DAY_LENGTH * 3.1) === 20, 'theo dõi hạn từng lứa');
  sm.stock.food -= 4; tickN(sm, 1);
  ok(sm.foodSpoilingWithin(DAY_LENGTH * 2.1) === 6, 'ăn lứa cũ trước');
  tickN(sm, DAY_LENGTH * 2.05);
  ok(sm.stock.food === 10 && sm.log.some((l) => l.text.includes('đã hỏng')), `lứa đầu hỏng sau 3 ngày (còn ${sm.stock.food})`);
  tickN(sm, DAY_LENGTH);
  ok(sm.stock.food === 0, 'lứa sau cũng hỏng');
}
{
  // hái lượm theo mùa: thu nhanh hơn xuân
  const sm = mk(1337); const v = sm.villagers[0];
  const wf = (sm as unknown as { workFactor(v: unknown, j: string): number });
  sm.time = DAY_LENGTH * 0.5; const spring = wf.workFactor.call(sm, v, 'food');
  sm.time = DAY_LENGTH * 10.5; const autumn = wf.workFactor.call(sm, v, 'food');
  ok(Math.abs(autumn / spring - 1.4 / 0.8) < 1e-6, 'hệ số hái lượm theo mùa (xuân 0,8, thu 1,4)');
}

{
  // cấp công cụ ngay: không cần Xưởng, dân dùng được và tốc độ làm việc tăng theo bậc
  const sm = mk(5);
  const [a] = sm.villagers;
  ok(a.tools.axe === null, 'ban đầu tay không');
  const rate = (t: number) => { sm.giveTool([a.id], 'axe', t); return sm.toolTier(a, 'wood'); };
  ok(rate(1) === 1 && a.tools.axe?.tier === 1 && a.tools.axe.dur === TIER_DURABILITY[1], 'cấp rìu gỗ ngay, không cần Xưởng');
  ok(rate(2) === 2 && a.tools.axe?.dur === TIER_DURABILITY[2], 'cấp rìu đá ghi đè rìu gỗ');
  sm.giveTool([a.id], 'axe', 0);
  ok(a.tools.axe === null && sm.toolTier(a, 'wood') === 0, 'thu lại về tay không');
  ok(sm.toolTier(a, 'build') === 0, 'thợ xây tay không thì bậc 0');
  sm.giveTool([a.id], 'hammer', 2);
  ok(sm.toolTier(a, 'build') === 2 && sm.toolTier(a, 'wood') === 0, 'có búa đá thì xây bậc 2, không ảnh hưởng nghề khác');
  sm.giveTool([999999], 'pick', 1);
  ok(true, 'id không tồn tại thì bỏ qua, không lỗi');
}

{
  // có búa thì xây nhanh hơn: cùng một thợ, cùng một Kho, đo thời gian xây xong
  const buildTime = (tier: number): number => {
    const sm = mk(42);
    const a = sm.villagers[0];
    sm.stock.wood = 100; putBuilding(sm, 'builder');
    const sp = sm.world.start;
    const spot = (() => { for (let dx = -8; dx <= 8; dx++) for (let dy = 3; dy <= 9; dy++) if (!sm.canPlace('storage', sp.x + dx, sp.y + dy)) return [sp.x + dx, sp.y + dy]; return null; })()!;
    sm.placeBuilding('storage', spot[0], spot[1]);
    if (tier) sm.giveTool([a.id], 'hammer', tier);
    sm.setJob([a.id], 'build');
    let t = 0;
    while (t < 900 && !sm.buildings.every((b) => b.done)) { (sm as unknown as { tick(d: number): void }).tick(0.05); t += 0.05; }
    return t;
  };
  const bare = buildTime(0), wood = buildTime(1), stone = buildTime(2);
  ok(wood < bare && stone < wood, `búa càng tốt xây càng nhanh: tay không ${bare.toFixed(0)}s · búa gỗ ${wood.toFixed(0)}s · búa đá ${stone.toFixed(0)}s`);
}

{
  // building levels: rough -> wood -> stone; upgrade is paid up front, builders finish it, capacity follows the level
  const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.time = DAY_LENGTH * 0.3; sm.stock.wood = 10; putBuilding(sm, 'builder');
  const sp = sm.world.start;
  const spot = (() => { for (let dx = -8; dx <= 8; dx++) for (let dy = 3; dy <= 9; dy++) if (!sm.canPlace('storage', sp.x + dx, sp.y + dy)) return [sp.x + dx, sp.y + dy]; return null; })()!;
  const b = sm.placeBuilding('storage', spot[0], spot[1]).building!;
  const ids = sm.villagers.map((o) => o.id); sm.setJob(ids, 'build'); run(sm, 40);
  RESEARCH.enabled = true;
  ok(sm.upgradeBuilding(b.id)?.startsWith('Cần nghiên cứu') ?? false, 'chưa nghiên cứu thì chưa nâng cấp được');
  RESEARCH.enabled = false;
  const fire = sm.buildings[0];
  ok(b.done && b.level === 1 && sm.capacity() === 130, `Kho cấp 1 (đơn sơ) chứa 100 (tổng ${sm.capacity()})`);
  ok(sm.upgradeBuilding(b.id) === 'Cần nâng Nhà chung (đống lửa trại) lên cấp 3', 'nhà không lên cao hơn cấp của Nhà chung cho phép');
  fire.level = 3; // the Bếp lửa lớn lets the other houses reach level 2
  ok(sm.upgradeBuilding(b.id) !== null && !b.upgrading, 'thiếu gỗ thì không nâng cấp được');
  sm.stock.wood = 40;
  ok(sm.upgradeBuilding(b.id) === null && b.upgrading && sm.stock.wood === 5, 'nâng cấp trả trước 35 gỗ');
  ok(sm.capacity() === 160, 'đang nâng cấp vẫn dùng sức chứa cấp cũ');
  ok(sm.upgradeBuilding(b.id) === 'Đang nâng cấp', 'không nâng chồng hai lần');
  run(sm, 60);
  ok(!b.upgrading && b.level === 2 && sm.capacity() === 310, `thợ xây nâng xong lên cấp 2 (gỗ), chứa 250 (tổng ${sm.capacity()})`);
  fire.level = 4;
  sm.stock.wood = 40; sm.stock.stone = 0;
  ok(sm.upgradeBuilding(b.id)?.startsWith('Thiếu đá') ?? false, 'cấp 3 (đá) cần đá');
  sm.time = DAY_LENGTH * 1.3; sm.stock.stone = 20; sm.upgradeBuilding(b.id); run(sm, 90);
  ok(b.level === 3 && sm.capacity() === 590 && sm.upgradeBuilding(b.id) === 'Đã ở cấp cao nhất', `cấp 3 chứa 500, không nâng thêm (tổng ${sm.capacity()})`);
  ok(levelDef({ kind: 'workshop', level: 3 }).craftSpeed > levelDef({ kind: 'workshop', level: 1 }).craftSpeed, 'Xưởng cấp cao chế nhanh hơn');
}

{
  // eras: buildings remember the era they were built in; an era without its own level list reuses the earlier one
  const sm = mk(1337);
  ok(sm.era === 'stone' && sm.buildings[0].era === 'stone', 'game starts in the Stone Age, the campfire belongs to it');
  ok(maxLevel('storage', 'stone') === 3 && maxLevel('workshop', 'stone') === 3, 'Stone Age buildings have 3 levels');
  ok(levelsOf('storage', 'ancient') === levelsOf('storage', 'stone'), 'a later era without its own levels falls back to the earlier era');
}

// ======== M4.1/M4.2: wildlife, damage rules, hunting ========
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const day = (sm: Sim, d = 0.3) => { sm.time = DAY_LENGTH * (Math.floor(sm.time / DAY_LENGTH) + d); };
const firstVillager = (sm: Sim) => sm.villagers[0];
function openField(sm: Sim): { x: number; y: number } { // a clear patch of grass near the village for staged fights
  const c = { x: sm.world.start.x + 10, y: sm.world.start.y + 8 };
  clearArea(sm, c.x, c.y, 8);
  return c;
}
{
  const sm = mk(1337);
  const by = (sp: string) => sm.animals.filter((a) => a.species === sp);
  ok(['rabbit', 'fowl', 'deer', 'boar', 'wolf', 'fish'].every((sp) => by(sp).length > 0), `all six species live on the map (${sm.animals.length} animals)`);
  ok(sm.animals.every((a) => a.species === 'fish' || dist(a, sm.world.start) >= 15), 'no land animal near the starting fire');
  ok(by('wolf').every((a) => zoneOf(dist(a, sm.world.start)) >= ANIMALS.wolf.zones[0]), 'wolves only in zone 2 and beyond');
  ok(by('fish').every((a) => sm.world.at(Math.floor(a.x), Math.floor(a.y)) === Tile.Water), 'fish live in water');
  ok(sm.villagers.map((v) => v.stats.str).join() === mk(1337).villagers.map((v) => v.stats.str).join(), 'same seed gives the same villagers');
  ok(sm.tribes.length === 3 && sm.tribes.every((t) => t.unitIds.length === t.def.civilians + t.def.warriors), 'three tribes with the people the data asks for');
  ok(sm.tribes.every((t) => { const d = dist(t.camp, sm.world.start); return Math.abs(d - t.def.distance) < 32 && d > 15; }), 'tribal camps lie around their intended distance');
  ok(sm.tribes.every((t) => sm.get(t.leaderId)?.leader === true), 'every tribe has a leader');
  ok(sm.foes.every((f) => f.health === f.maxHealth && f.team !== 'player'), 'tribal people are foes, not villagers');
}
{
  // damage: weapon + 0.6 x strength, armour by type, backstab x1.25, agility speeds the cycle
  const spear = WEAPONS.spear, hide = ARMORS.hide;
  const raw = damageOf(spear, 10, null, false);
  ok(Math.abs(raw - (7 + RULES.strengthDamage * 10)) < 1e-9, `spear hits for 7 + 0.6 x str (${raw})`);
  ok(Math.abs(damageOf(spear, 10, hide, false) - raw * 0.9) < 1e-9, 'hide armour takes 10% off a stab');
  ok(Math.abs(damageOf(WEAPONS.hatchet, 10, hide, false) - damageOf(WEAPONS.hatchet, 10, null, false) * 0.8) < 1e-9, 'hide armour takes 20% off a slash');
  ok(Math.abs(damageOf(spear, 10, null, true) / raw - 1.25) < 1e-9, 'a blow from behind does 25% more');
  ok(damageOf(WEAPONS.sling, 12, null, false) === 5, 'missiles ignore strength');
  ok(cycleOf(1.4, 9) < cycleOf(1.4, 3), 'quicker people swing faster');
  for (const [id, w] of Object.entries(WEAPONS)) { const t = swingTimes(w.anim); ok(t.hitAt > 0 && t.hitAt < t.end, `weapon ${id}: animation "${w.anim}" lands its blow before it ends (${t.hitAt.toFixed(2)}s of ${t.end.toFixed(2)}s)`); }
  ok(new Set(Object.values(WEAPONS).map((w) => w.anim)).size >= 5, 'melee, thrust, shoot and sling have their own animations');
}
{
  // a villager kills a rabbit with a club; the blow lands on the animation's hit frame, not at the start
  const sm = mk(1337); reveal(sm); day(sm); const c = openField(sm);
  const v = firstVillager(sm); sm.villagers.slice(1).forEach((o) => { o.fullness = 1e9; }); v.fullness = 1e9;
  v.x = c.x + 0.5; v.y = c.y + 0.5; v.weapon = 'club';
  const rb = spawnAnimal(sm, 'rabbit', c.x + 1.2, c.y + 0.5, 1); rb.state = 'graze'; rb.timer = 99;
  sm.orderAttack([v.id], { kind: 'animal', id: rb.id });
  run(sm, 0.1);
  ok(v.swing !== null, 'the attack starts a swing');
  ok(rb.hp === rb.maxHp, 'no damage yet at the start of the swing');
  const hitAt = v.swing!.hitAt; run(sm, hitAt + 0.15);
  ok(rb.hp < rb.maxHp || rb.state === 'dead', 'the blow lands once the hit frame is reached');
  run(sm, 6);
  ok(rb.state === 'dead' && (rb.meat === 3 || v.carry?.res === 'food'), 'the rabbit is dead and its meat is taken');
}
{
  // a hunter fetches meat and hide to the store; a deer tires and can be caught
  const sm = mk(1337); reveal(sm); day(sm, 0.3); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const hunters = sm.villagers.slice(0, 2); const s = sm.world.start;
  const d = spawnAnimal(sm, 'deer', s.x + 12, s.y - 4, 5); d.state = 'graze'; d.timer = 99;
  for (const h of hunters) { h.weapon = 'spear'; }
  sm.setJob(hunters.map((h) => h.id), 'hunt');
  const food0 = sm.stock.food, hide0 = sm.stock.hide; let killed = false;
  for (let i = 0; i < 20 * 150 && !(sm.stock.hide > hide0 && sm.stock.food > food0 + 2); i++) { (sm as unknown as { tick(d: number): void }).tick(0.05); if (d.state === 'dead') killed = true; }
  ok(killed, 'two hunters with spears brought down a deer');
  ok(sm.stock.hide >= hide0 + 3, `the hide reached the store (da ${sm.stock.hide})`);
  ok(sm.stock.food > food0 + 2 || hunters.some((h) => h.carry?.res === 'food'), 'meat was carried back');
}
{
  // a wolf does not walk into firelight, but hunts a villager away from it at night
  const sm = mk(1337); reveal(sm); sm.time = DAY_LENGTH * 0.95; sm.villagers.forEach((o) => { o.fullness = 1e9; o.nightOwl = true; });
  const v = firstVillager(sm), fire = sm.campfire()!, s = sm.world.start;
  const w = spawnAnimal(sm, 'wolf', s.x - 14, s.y + 12, 7, true);
  v.x = s.x + 0.5; v.y = s.y + 14.5; sm.orderMove([v.id], s.x, s.y + 14); run(sm, 2);
  run(sm, 12);
  ok(w.state === 'attack' || v.health < v.maxHealth || v.down > 0, 'the wolf hunts a villager who is away from the fire');
  const sm2 = mk(1337); reveal(sm2); sm2.time = DAY_LENGTH * 0.95; sm2.villagers.forEach((o) => { o.fullness = 1e9; });
  const f2 = sm2.campfire()!, s2 = sm2.world.start, w2 = spawnAnimal(sm2, 'wolf', s2.x - 12, s2.y, 8, true);
  sm2.villagers.forEach((o) => { o.x = f2.x + 1; o.y = f2.y + 3; o.phase = 'sleep'; o.nightOwl = false; });
  let nearest = 99; for (let i = 0; i < 20 * 40; i++) { (sm2 as unknown as { tick(d: number): void }).tick(0.05); nearest = Math.min(nearest, dist(w2, { x: f2.x + 1, y: f2.y + 1 })); }
  ok(nearest > 3.5 && sm2.villagers.length === 3 && sm2.villagers.every((o) => o.down === 0), `the wolf keeps out of the firelight (closest ${nearest.toFixed(1)} tiles) and nobody falls; the camp wakes and drives it off`);
  void fire;
}

// ======== M4.3: orders, stances, downed and rescue, morale ========
const tickOnce = (sm: Sim, secs: number) => run(sm, secs);
function stage(seed = 1337) { // a village with its villagers fed, the map revealed, daytime and a clear field with one hostile foe
  const sm = mk(seed); reveal(sm); day(sm, 0.3); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const c = openField(sm), tribe = sm.tribes.find((t) => t.id === 'axe')!;
  tribe.relation = -60; // hostile
  const foe = sm.get(tribe.unitIds.find((u) => sm.get(u)!.ai!.role === 'guard')!)!;
  foe.x = c.x + 5.5; foe.y = c.y + 0.5; foe.path = []; foe.ai!.camp = { x: c.x + 5, y: c.y }; foe.weapon = 'club'; foe.armor = null;
  tribe.unitIds.filter((u) => u !== foe.id).forEach((u) => { const o = sm.get(u)!; o.x = sm.world.start.x + 60; o.y = sm.world.start.y; o.ai!.camp = { x: o.x, y: o.y }; });
  return { sm, c, tribe, foe };
}
{
  const { sm, c, tribe, foe } = stage();
  const v = firstVillager(sm); v.x = c.x + 0.5; v.y = c.y + 0.5; v.weapon = 'mace'; v.stats.str = 12; foe.health = foe.maxHealth = 40;
  sm.orderAttack([v.id], { kind: 'unit', id: foe.id });
  ok(v.job === 'fight' && v.fight.mode === 'attack', 'right click on a foe makes the villager a fighter attacking it');
  run(sm, 25);
  ok(foe.health <= 0 || !sm.foes.includes(foe), 'the foe went down under a stone mace');
  ok(!tribe.unitIds.includes(foe.id) && tribe.relation < -60, `killing a warrior costs relations (${tribe.relation})`);
  ok(v.fight.target === null && v.fight.mode === 'guard', 'the order ends with the kill and the fighter stays on guard there');
}
{
  const { sm, c, foe } = stage();
  const [a, b] = sm.villagers; a.x = c.x + 0.5; a.y = c.y + 0.5; b.x = c.x - 1.5; b.y = c.y + 0.5;
  sm.hurt({ kind: 'unit', id: a.id }, 9999, 'crush', { x: foe.x, y: foe.y }, { unit: foe });
  ok(a.down > 0 && a.phase === 'down' && a.health === 0, 'a mortal blow knocks a villager down instead of killing');
  run(sm, 2); ok(a.down > 0 && sm.villagers.includes(a), 'still lying there after two seconds');
  foe.x += 40; foe.ai!.camp = { x: foe.x, y: foe.y };
  run(sm, 22);
  ok(a.down === 0 && a.health > 0 && a.phase !== 'down', 'once the foe is gone the other villager calms down, comes back and gets them on their feet');
  ok(a.rescue === 0 && sm.log.some((l) => l.text.includes('đã được đỡ dậy')), 'and the log says so');
  const lone = sm.villagers[2]; lone.x = sm.world.start.x - 30; lone.y = sm.world.start.y + 6;
  sm.hurt({ kind: 'unit', id: lone.id }, 9999, 'crush', { x: lone.x - 3, y: lone.y }, {});
  run(sm, RULES.downedSeconds + 1);
  ok(!sm.villagers.includes(lone), 'nobody came, so the wounded villager died after 30 seconds');
}
{
  // morale: a frightened villager runs for the fire even with a hostile foe next to them
  const { sm, c, foe } = stage();
  const v = firstVillager(sm); v.x = c.x + 2.5; v.y = c.y + 0.5; const fire = sm.campfire()!; sm.setJob([v.id], 'wood');
  foe.x = c.x + 4.5; foe.y = c.y + 0.5; v.morale = 5;
  run(sm, 1.6);
  ok(v.phase === 'flee' || v.fleeT > 0, 'a villager with broken morale flees');
  const d0 = dist(v, { x: fire.x + 1, y: fire.y + 1 }); run(sm, 4);
  ok(dist(v, { x: fire.x + 1, y: fire.y + 1 }) < d0, 'and runs toward the campfire');
}
{
  // an ordinary worker runs from a threat; a fighter on guard defends
  const { sm, c, foe } = stage();
  const [w, g] = sm.villagers; w.x = c.x + 1.5; w.y = c.y + 0.5; g.x = c.x - 1.5; g.y = c.y + 0.5;
  sm.setJob([w.id], 'wood'); sm.setJob([g.id], 'fight'); g.weapon = 'mace'; foe.x = c.x + 3.5; foe.y = c.y + 0.5;
  run(sm, 2);
  ok(w.phase === 'flee', 'a woodcutter runs from an armed foe');
  ok(g.phase === 'fight' || g.fight.target !== null, 'a guard goes for the foe');
}
{
  // hold keeps position, stop cancels, retreat avoids, defensive does not chase
  const { sm, c, foe } = stage();
  const v = firstVillager(sm); v.x = c.x + 0.5; v.y = c.y + 0.5; foe.x = c.x + 7.5; foe.y = c.y + 0.5; foe.ai!.camp = { x: foe.x, y: foe.y };
  sm.orderHold([v.id]); const home = { x: v.x, y: v.y }; run(sm, 3);
  ok(v.fight.mode === 'hold' && dist(v, home) < 0.3, 'a unit told to hold does not chase a foe 7 tiles away');
  sm.setStance([v.id], 'retreat'); foe.x = c.x + 2.5; run(sm, 4);
  ok(v.phase === 'flee' || dist(v, foe) > 2.4, 'a unit in retreat stance does not stand and fight');
  sm.orderStop([v.id]); ok(v.fight.target === null && v.queue.length === 0, 'stop clears orders');
}
{
  // attack-move walks and fights on the way; shift queues orders
  const { sm, c, foe } = stage();
  const v = firstVillager(sm); v.x = c.x - 6.5; v.y = c.y + 0.5; v.weapon = 'mace'; v.stats.str = 12; foe.health = foe.maxHealth = 30; foe.x = c.x; foe.y = c.y + 0.5; foe.ai!.camp = { x: foe.x, y: foe.y };
  sm.orderAttackMove([v.id], c.x + 6, c.y);
  ok(v.job === 'fight' && v.fight.mode === 'attackMove', 'attack-move turns the unit into a fighter on the march');
  run(sm, 30);
  ok(foe.health <= 0 || !sm.foes.includes(foe), 'the unit fought the foe it met on the way');
  ok(dist(v, { x: c.x + 6, y: c.y }) < 3, 'then carried on to the destination');
  const q = sm.villagers[1]; q.x = c.x + 0.5; q.y = c.y + 4.5; sm.orderMove([q.id], c.x + 4, c.y + 4); sm.orderMove([q.id], c.x - 4, c.y + 4, true); sm.orderMove([q.id], c.x, c.y - 4, true);
  ok(q.queue.length === 2, 'Shift + move queues orders behind the current one');
  run(sm, 25); ok(dist(q, { x: c.x, y: c.y - 4 }) < 2.5 && q.queue.length === 0, 'the queued moves are carried out in order');
}
{
  // gear: the armoury's stock goes to fighters; armour only for fighters, from hide
  const sm = mk(1337); reveal(sm); day(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const s = sm.world.start; clearArea(sm, s.x + 6, s.y + 5, 3);
  (sm as unknown as { addBuilding(k: string, x: number, y: number, d: boolean): unknown }).addBuilding('armory', s.x + 5, s.y + 4, true);
  sm.toolStock.club1 = 1; sm.toolStock.mace2 = 1; sm.toolStock.hide1 = 1;
  const [f, h] = sm.villagers; sm.setJob([f.id], 'fight'); sm.setJob([h.id], 'hunt');
  run(sm, 40);
  ok(f.weapon === 'mace', `the fighter picks the best weapon (${f.weapon})`);
  ok(f.armor === 'hide' && sm.toolStock.hide1 === 0, 'the fighter puts on hide armour');
  ok(h.weapon !== null && h.armor === null, `the hunter takes a weapon but no armour (${h.weapon})`);
  ok(weaponOf(f).name === 'Chùy đá', 'the weapon in hand shows its name');
}

// ======== M4.4: tribes, relations, surrender, adopt and tribute, raids ========
const tribeById = (sm: Sim, id: string) => sm.tribes.find((t) => t.id === id)!;
const alive = (sm: Sim, id: string) => tribeById(sm, id).unitIds.map((u) => sm.get(u)!).filter(Boolean);
{
  // being attacked turns a peaceful tribe hostile; gifts calm it down
  const sm = mk(1337); reveal(sm); day(sm);
  const t = tribeById(sm, 'spring'), civ = sm.get(t.unitIds.find((u) => sm.get(u)!.ai!.role === 'civ')!)!, v = firstVillager(sm);
  ok(!sm.tribeHostile('spring') && t.relation === 0, 'the peaceful tribe starts neutral');
  sm.hurt({ kind: 'unit', id: civ.id }, 1, 'crush', { x: v.x, y: v.y }, { unit: v });
  ok(t.relation === -30 && sm.tribeHostile('spring'), `attacking them drops relations to ${t.relation} and makes them hostile`);
  t.relation = -60; sm.stock.food = 100; for (let i = 0; i < 5; i++) sm.diplomacy('spring', 'gift');
  ok(t.relation === -35 && sm.stock.food === 50, `five gifts of 10 food buy back 25 points of goodwill (${t.relation}, food ${sm.stock.food})`);
  ok(!sm.tribeHostile('spring'), 'and they stop being hostile once above -40');
  sm.stock.food = 3; ok(sm.diplomacy('spring', 'gift') !== null, 'a gift needs 10 food');
  t.relation = 59; ok(sm.diplomacy('spring', 'tribute') !== null && sm.diplomacy('spring', 'adopt') !== null, 'below 60 they will not pay tribute, below 90 not join');
}
{
  // surrender: the leader falls, the tribe gives in and asks for a decision
  const sm = mk(1337); reveal(sm); day(sm); const t = tribeById(sm, 'axe'); t.relation = -60;
  const v = firstVillager(sm), lead = sm.get(t.leaderId)!;
  sm.hurt({ kind: 'unit', id: lead.id }, 9999, 'crush', { x: v.x, y: v.y }, { unit: v });
  run(sm, 2);
  ok(t.state === 'surrendered' && sm.pendingTribe === 'axe', 'killing the leader makes the tribe surrender and waits for a choice');
  ok(!sm.tribeHostile('axe') && alive(sm, 'axe').every((f) => f.fight.target === null), 'a surrendered tribe stops fighting');
  sm.buildings[0].level = 4; // room for everyone
  const pop = sm.villagers.length, units = t.unitIds.length;
  ok(sm.diplomacy('axe', 'adopt') === null && t.state === 'adopted', 'the player can take them in');
  ok(sm.villagers.length === pop + units && sm.foes.filter((f) => f.team === 'axe').length === 0, `all ${units} people become villagers`);
  ok(sm.villagers.every((o) => o.team === 'player') && sm.pendingTribe === null, 'they are on the player team now');
}
{
  // adoption respects the population cap of 40
  const sm = mk(1337); reveal(sm); const t = tribeById(sm, 'axe'); t.state = 'surrendered';
  ok(sm.popCap() === 8, 'a heap of firewood holds eight people'); sm.buildings[0].level = 4; ok(sm.popCap() === 40, 'the Nhà chung holds forty');
  const extra = 40 - sm.villagers.length - 5;
  for (let i = 0; i < extra; i++) { const o = sm.makeVillager(sm.world.start.x, sm.world.start.y, 'm', 'player'); (sm.villagers as Villager[]).push(o); }
  sm.diplomacy('axe', 'adopt');
  ok(sm.villagers.length === 40, `the village stops at 40 people (${sm.villagers.length})`);
}
{
  // tribute: a surrendered tribe pays every season and never raids
  const sm = mk(1337); reveal(sm); const t = tribeById(sm, 'axe'); t.state = 'surrendered'; sm.pendingTribe = 'axe';
  ok(sm.diplomacy('axe', 'tribute') === null && t.state === 'tribute' && sm.pendingTribe === null, 'tribute can be chosen instead');
  const s0 = sm.stock.stone, f0 = sm.stock.food; sm.villagers.forEach((o) => { o.fullness = 1e9; }); sm.time = DAY_LENGTH * (sm.day + 5); run(sm, 3);
  ok(sm.stock.stone >= s0 + 10 && sm.stock.food >= f0 + 10, 'after a season the tribute arrives');
  sm.events.find((e) => e.tribe === 'axe')!.fireDay = sm.day; run(sm, DAY_LENGTH * 0.3);
  ok(t.raid === null, 'a tributary tribe does not raid');
}
{
  // holding their fire for 30 seconds, with nobody left to defend it, makes them surrender
  const sm = mk(1337); reveal(sm); day(sm); const t = tribeById(sm, 'axe'); t.relation = -60;
  for (const f of alive(sm, 'axe')) if (f.ai!.role !== 'civ') { f.x = t.camp.x + 40; f.y = t.camp.y; f.ai!.camp = { x: f.x, y: f.y }; }
  const v = firstVillager(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; }); v.x = t.camp.x + 0.5; v.y = t.camp.y + 3.5; sm.orderHold([v.id]);
  run(sm, 20); ok(t.state === 'free', 'still fighting on after 20 seconds');
  run(sm, 15); ok(t.state === 'surrendered', 'they give in once their fire has been held for 30 seconds');
}
{
  // morale collapse also ends it
  const sm = mk(1337); reveal(sm); const t = tribeById(sm, 'axe');
  for (const f of alive(sm, 'axe')) if (f.ai!.role !== 'civ') f.morale = 2;
  (sm as unknown as { moraleClock: number }).moraleClock = 0; run(sm, 3);
  ok(t.state === 'surrendered' || t.state === 'free' && alive(sm, 'axe').some((f) => f.morale > 10), 'a tribe whose warriors have lost all heart gives up');
}
{
  // the Axe tribe sends scouts; the raid is capped by the warriors it has and marches on the village
  const sm = mk(1337); reveal(sm); const t = tribeById(sm, 'axe'), ev = sm.events.find((e) => e.id === 'axe_scout')!;
  sm.villagers.forEach((o) => { o.fullness = 1e9; }); ev.fireDay = sm.day; ev.warned = true; day(sm, 0.3);
  run(sm, 1);
  ok(t.raid !== null && alive(sm, 'axe').filter((f) => f.ai!.role === 'raider').length === 5, 'the scouting party of 5 sets out');
  ok(sm.log.some((l) => l.text.includes('đang tiến vào làng')) && sm.tribeHostile('axe'), 'the village is told, and they count as hostile');
  const fire = sm.campfire()!; let close = 999;
  for (let i = 0; i < 20 * 120; i++) { (sm as unknown as { tick(d: number): void }).tick(0.05); for (const f of alive(sm, 'axe')) if (f.ai!.role === 'raider') close = Math.min(close, dist(f, { x: fire.x + 1, y: fire.y + 1 })); }
  ok(close < 14, `the raiders reached the village (closest ${close.toFixed(1)} tiles)`);
}
{
  // a raid cannot be bigger than the army: the big attack of year 2 is capped at the ten warriors
  const sm = mk(1337); reveal(sm); const t = tribeById(sm, 'axe'), ev = sm.events.find((e) => e.id === 'axe_war')!;
  ev.fireDay = sm.day; ev.warned = true; day(sm, 0.3); run(sm, 1);
  ok(t.raid !== null && t.raid.size === 10 && ev.size === 18, `18 were planned but only ${t.raid?.size} warriors exist`);
  const sm2 = mk(1337); reveal(sm2); const t2 = tribeById(sm2, 'axe'); for (const u of t2.unitIds.slice(0, 8)) { sm2.removeFoe(sm2.get(u)!); } t2.unitIds = t2.unitIds.slice(8);
  const e2 = sm2.events.find((e) => e.id === 'axe_scout')!; e2.fireDay = sm2.day; e2.warned = true; day(sm2, 0.3); run(sm2, 1);
  ok(t2.raid === null, 'with fewer than three fighters left the tribe does not attack');
}
{
  // wolves: warned the day before, they arrive at night around the village and leave at dawn
  const sm = mk(1337); reveal(sm); const ev = sm.events.find((e) => e.id === 'wolves_summer')!;
  sm.villagers.forEach((o) => { o.fullness = 1e9; });
  ev.fireDay = 3; ev.warnDay = 2; ev.warned = false; sm.time = DAY_LENGTH * 0.4; run(sm, 1);
  ok(!ev.warned, 'no warning two days early'); sm.time = DAY_LENGTH * 1.55; run(sm, 1);
  ok(ev.warned && sm.log.some((l) => l.text.includes('Tiếng hú')), 'the howling is heard the day before');
  sm.time = DAY_LENGTH * 2 + DAY_LENGTH * 0.85; const before = sm.animals.length; run(sm, 1);
  ok(ev.fired && sm.animals.filter((a) => a.raid).length === ev.size && sm.animals.length === before + ev.size, `${ev.size} hungry wolves arrive at night`);
  sm.time = DAY_LENGTH * 3 + DAY_LENGTH * 0.4; run(sm, 60);
  ok(sm.animals.filter((a) => a.raid && a.state !== 'dead').length === 0 || sm.animals.filter((a) => a.raid).every((a) => dist(a, a.home) < 40), 'by day the pack heads home');
}
{
  // missiles: a sling stone flies, takes time, and can miss; strength does not add to it
  const { sm, c, foe } = stage(); const v = firstVillager(sm), tribe = tribeById(sm, 'axe');
  foe.weapon = 'sling'; foe.x = c.x + 6.5; foe.y = c.y + 0.5; foe.ai!.camp = { x: foe.x, y: foe.y }; v.x = c.x + 0.5; v.y = c.y + 0.5;
  sm.setJob([v.id], 'fight'); v.weapon = null; sm.setStance([v.id], 'defensive'); v.fight.anchor = { x: v.x, y: v.y };
  let launched = 0, hits = 0; const hp0 = v.health;
  for (let i = 0; i < 20 * 30; i++) { (sm as unknown as { tick(d: number): void }).tick(0.05); launched = Math.max(launched, sm.projectiles.length); if (v.health < hp0 - 0.5 && !hits) hits = 1; }
  ok(launched > 0, 'the slinger throws stones that fly through the air');
  ok(hits === 1 || v.down > 0, 'and some of them hit');
  void tribe;
}

{
  // civilians never fight: they run for the fire; soldiers (job Chiến binh) stand and fight
  const sm = mk(1337); reveal(sm); day(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const t = tribeById(sm, 'axe'); t.relation = -60;
  const foe = sm.get(t.unitIds.find((u) => sm.get(u)!.ai!.role === 'guard')!)!; const fire = sm.campfire()!;
  const w = sm.villagers[0]; sm.setJob([w.id], 'wood'); w.x = fire.x + 3; w.y = fire.y + 5; w.path = [];
  foe.x = w.x + 4; foe.y = w.y; foe.ai!.camp = { x: foe.x, y: foe.y };
  w.x = fire.x + 14; foe.x = w.x + 4; foe.y = w.y = fire.y + 5; foe.ai!.camp = { x: foe.x, y: foe.y };
  run(sm, 1);
  ok(w.phase === 'flee' && w.fight.mode === 'none' && w.weapon === null && w.job === 'wood', 'a healthy civilian at home runs for the fire instead of fighting, keeping their job');
  
  { const x0 = w.x, y0 = w.y; run(sm, 1); const d = Math.hypot(w.x - x0, w.y - y0); ok(d > w.speed * 1.15, `fleeing is faster than walking (${d.toFixed(2)} tiles in 1 s, walking ${w.speed.toFixed(2)})`); }
  const sol = sm.villagers[1]; sm.giveGear([sol.id], 'spear', 'weapon'); sm.setJob([sol.id], 'fight'); sol.x = w.x + 1; sol.y = w.y; sol.path = []; sol.morale = 100;
  foe.x = sol.x + 4; foe.y = sol.y; foe.ai!.camp = { x: foe.x, y: foe.y }; run(sm, 1.5);
  ok(sol.fight.mode === 'attack' || sol.phase === 'fight', 'a soldier meets the same enemy');
  // an enemy still hits a civilian who is caught
  const cat = sm.villagers[2]; cat.x = foe.x + 0.6; cat.y = foe.y; cat.path = []; const hp = cat.health; sm.hurt({ kind: 'unit', id: cat.id }, 5, 'crush', { x: foe.x, y: foe.y }, { unit: foe });
  ok(cat.health < hp, 'and enemies can still hurt civilians');
  const far = sm.villagers[1]; sm.setJob([far.id], 'stone'); far.x = sm.world.start.x + 30; far.y = sm.world.start.y; far.path = [];
  foe.x = far.x + 4; foe.y = far.y; run(sm, 1.5);
  ok(far.phase === 'flee' && far.fight.mode === 'none', 'a villager far from home flees to the fire');
}

{
  // research inside the Nhà nghiên cứu: blueprints, minimum Trí tuệ, coins, house levels, locks and automations
  RESEARCH.enabled = true;
  const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.time = DAY_LENGTH * 0.3; sm.stock.wood = 300; sm.stock.stone = 100; sm.stock.coin = 40; sm.stock.hide = 20;
  const [a, b, c] = sm.villagers;
  const place = (kind: 'lab' | 'workshop' | 'toolstore') => { sm.dev.freeBuild = true; sm.dev.instantBuild = true; const sp = sm.world.start; for (let r = 3; r < 12; r++) for (let dx = -r; dx <= r; dx++) for (let dy = 3; dy <= r + 3; dy++) if (!sm.canPlace(kind, sp.x + dx * 2, sp.y + dy)) { const x = sm.placeBuilding(kind, sp.x + dx * 2, sp.y + dy); sm.dev.freeBuild = false; sm.dev.instantBuild = false; return x.building!; } sm.dev.freeBuild = false; sm.dev.instantBuild = false; throw new Error('no spot'); };
  ok(sm.queueResearch('hammer1') === 'Cần dựng Nhà nghiên cứu', 'research needs the Nhà nghiên cứu');
  const lab = place('lab'), shop = place('workshop');
  ok(sm.buildingLock('toolstore') === 'Cần nghiên cứu: Kho công cụ', 'the Kho công cụ must be researched before it can be built');
  ok(sm.recipeLock('axe1') === 'Chưa có bản vẽ: Rìu gỗ' && sm.queueCraft('axe1') !== null, 'nothing can be made without its blueprint');
  ok(sm.queueResearch('hammer1') === null && sm.queueResearch('hammer1') !== null, 'a blueprint step can be queued once');
  ok(sm.queueResearch('club1') !== null, 'a later step waits for the earlier one');
  run(sm, 10);
  ok(lab.active === null && sm.researchBlock(TECHS.find((t) => t.id === 'hammer1')!) === 'Chưa có người làm việc trong Nhà nghiên cứu', 'with nobody inside, nothing is researched');
  a.stats.int = 9; c.stats.int = 3; b.stats.int = 6;
  ok(sm.assignStaff([a.id], 'research') === null, 'a bright villager is sent to the lab');
  ok(sm.assignStaff([c.id], 'research') !== null && c.inside === null, 'a level-1 lab holds one researcher');
  run(sm, 20);
  ok(a.inside === lab.id && lab.active?.id === 'hammer1', 'the researcher is inside and the research has started');
  ok(sm.stock.wood === 300 - 6 && sm.stock.coin === 40 - 2, 'materials and coins are paid as soon as the research is queued');
  ok(sm.techState(TECHS.find((t) => t.id === 'hammer1')!).state === 'active' && lab.active!.progress > 0 && lab.active!.progress < 1, 'it is under way, and takes a long time');
  ok((sm.queueResearch('timber') ?? '').startsWith('Đang nghiên cứu') && sm.researchQueue.length === 0, 'only one research at a time: another cannot be queued while one is under way');
  const rate = (int: number) => sm.workRate({ ...a, stats: { ...a.stats, int } } as typeof a, 'research');
  ok(rate(10) > rate(5) * 1.3, 'the smarter the researcher, the faster the work');
  sm.dev.fastWorks = true; run(sm, 20); sm.dev.fastWorks = false;
  ok(sm.researched.has('hammer1') && lab.active === null, 'the blueprint is finished');
  ok(sm.recipeLock('hammer1') === null && sm.recipeLock('hammer2') !== null, 'with the blueprint the tool can be made (the stone one still needs its step)');
  // a researcher who is not bright enough cannot start a step
  a.stats.int = 3; sm.queueResearch('club1'); run(sm, 15);
  ok(lab.active === null && sm.researchQueue.includes('club1') && (sm.researchBlock(TECHS.find((t) => t.id === 'club1')!) ?? '').startsWith('Cần người Trí tuệ 5'), 'a step waits when nobody inside has enough Trí tuệ');
  a.stats.int = 9; run(sm, 10);
  ok(lab.active?.id === 'club1', 'it starts once a bright enough researcher is inside');
  // coins are needed too
  sm.dev.fastWorks = true; run(sm, 30); sm.dev.fastWorks = false;
  sm.stock.coin = 0; const noCoin = sm.queueResearch('axe1');
  ok(noCoin !== null && sm.researchQueue.length === 0 && sm.researchShort(TECHS.find((t) => t.id === 'axe1')!) !== null, 'without the coins a research cannot be started');
  sm.stock.coin = 5; ok(sm.queueResearch('axe1') === null && sm.stock.coin === 3, 'with them it is paid at once');
  sm.unqueueResearch('axe1'); ok(sm.stock.coin === 5 && sm.researchQueue.length === 0, 'cancelling a queued research gives the payment back');
  sm.queueResearch('axe1'); run(sm, 10);
  ok(lab.active?.id === 'axe1' && sm.stock.coin === 3, 'and the researchers get on with it');
  sm.dev.fastWorks = true; run(sm, 30); sm.dev.fastWorks = false;
  // house level gates the next blueprint step and the researcher count
  ok(sm.techState(TECHS.find((t) => t.id === 'axe2')!).why === 'Cần Nhà nghiên cứu cấp 2', 'the stone axe needs a level-2 lab');
  ok(sm.upgradeBuilding(lab.id)?.startsWith('Cần nghiên cứu: Dựng bằng gỗ') ?? false, 'the house cannot be upgraded before its research');
  sm.queueResearch('timber'); sm.dev.fastWorks = true; run(sm, 40); sm.dev.fastWorks = false;
  ok(sm.researched.has('timber'), 'timber research done');
  ok(sm.upgradeBuilding(lab.id) === 'Cần nâng Nhà chung (đống lửa trại) lên cấp 3', 'and the Nhà chung must be big enough first'); sm.buildings[0].level = 3;
  sm.dev.instantBuild = true; ok(sm.upgradeBuilding(lab.id) === null && lab.level === 2, 'now the lab goes to level 2'); sm.dev.instantBuild = false;
  ok(sm.assignStaff([b.id], 'research') === null, 'and holds a second researcher');
  run(sm, 25);
  ok(b.inside === lab.id && lab.staff.length === 2, 'both are inside, listed by name');
  ok(sm.techState(TECHS.find((t) => t.id === 'axe2')!).state === 'ready', 'the stone axe step is open now');
  // the stores need research, and fetching and ordering are researched automations
  sm.stock.wood = 300; sm.stock.stone = 100; sm.stock.coin = 40;
  ok(sm.researched.has('hammer1') && sm.queueResearch('tool_store') === null, 'the Kho công cụ can be researched');
  sm.researched.add('tool_store'); const store = place('toolstore');
  ok(store.kind === 'toolstore' && sm.buildingLock('toolstore') !== null, 'once built it is unique too');
  const w = sm.villagers.find((o) => o !== a && o !== b && o !== c) ?? c; w.inside = null;
  sm.exitBuilding(c); sm.setJob([c.id], 'wood'); c.tools.axe = null; sm.toolStock.axe1 = 1; sm.stock.wood = 20; run(sm, 40);
  ok(c.tools.axe === null && sm.toolCount('axe', 1) === 1, 'fetching from the store is not on until it is researched');
  sm.researched.add('auto_fetch'); run(sm, 40);
  ok(c.tools.axe?.tier === 1 && sm.toolCount('axe', 1) === 0, 'once researched the villager fetches the axe from the store');
  c.tools.axe = null; sm.stock.wood = 20; run(sm, 40);
  ok(!sm.craftQueue.includes('axe1') && sm.building('workshop')!.active?.id !== 'axe1', 'without the ordering research a villager does not order a tool');
  sm.researched.add('auto_order'); sm.researched.add('axe1'); run(sm, 60);
  ok(sm.craftQueue.includes('axe1') || sm.building('workshop')!.active?.id === 'axe1', 'with it, the villager walks to the craft house and orders an axe');
  void shop;
  dev.resetResearch(sm);
  ok(!sm.recipeOpen('axe1') && sm.upgradeBuilding(lab.id) !== null, 'forgetting research locks things again');
  RESEARCH.enabled = false;
}

{
  // by hand: hand out, take back, throw away and send tools in for repair
  const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const [a, b] = sm.villagers;
  ok(sm.repairTool([a.id], 'axe') === 'Cần dựng Nhà sửa chữa', 'no repair house, no repairs');
  dev.buildAll(sm); sm.toolStock.axe1 = 2;
  ok(sm.assignTool([a.id], 'axe', 1) !== null && a.tools.axe === null, 'a villager with no job (or another) cannot be handed an axe');
  sm.setJob([a.id], 'wood'); sm.setJob([b.id], 'build');
  ok(sm.assignTool([b.id], 'axe', 1) !== null && b.tools.axe === null, 'a builder is not given an axe either');
  ok(sm.assignTool([a.id], 'axe', 1) === null && a.tools.axe?.tier === 1 && sm.toolCount('axe', 1) === 1, 'a woodcutter is handed the axe from the stock');
  ok(sm.assignTool([a.id], 'axe', 2) !== null && a.tools.axe?.tier === 1, 'a tool that is not in stock cannot be handed out');
  ok(sm.repairTool([a.id], 'axe') === 'Công cụ còn mới, chưa cần sửa', 'a whole tool needs no repair');
  a.tools.axe!.dur = 50; sm.toolStock.axe1 = 0; // nothing in the store to fetch meanwhile
  // the villager has to carry it to the repair house
  ok(sm.repairTool([a.id], 'axe') === null && a.tools.axe !== null && a.phase === 'goOrder' && sm.repairQueue.length === 0, 'repair sends the villager walking, tool in hand');
  run(sm, 60);
  ok(a.tools.axe === null && (sm.repairQueue.includes('axe1') || sm.building('repair')!.active?.id === 'axe1') && a.repairFor === 'axe1', 'the tool is handed in at the repair house');
  sm.assignStaff([b.id], 'repair'); sm.dev.fastWorks = true; run(sm, 200); sm.dev.fastWorks = false;
  ok(a.tools.axe?.tier === 1 && a.tools.axe.dur > 50 && a.repairFor === null, 'the mended tool goes back to the villager who brought it');
  ok(sm.orderDef('repair', 'axe2')!.time > sm.orderDef('repair', 'axe1')!.time, 'a stone tool takes longer to mend than a wooden one');
  // changing the job gives the tool back, wear and all
  const c = sm.villagers[2]; c.job = 'wood'; c.tools.axe = { tier: 1, dur: 100 }; c.repairFor = null;
  sm.setJob([c.id], 'stone'); run(sm, 1);
  ok(c.tools.axe === null && sm.wornTools.some((w) => w.id === 'axe1' && Math.abs(w.dur - 100) < 1), 'a worn tool goes back to the stock when the job changes, keeping its durability');
  sm.setJob([c.id], 'wood'); sm.setJob([b.id], 'wood'); sm.wornTools.length = 0; sm.toolStock.axe1 = 0; sm.wornTools.push({ id: 'axe1', dur: 77 });
  sm.assignTool([c.id], 'axe', 1);
  ok(c.tools.axe?.dur === 77, 'a tool taken back out of the stock still carries its wear');
  sm.setJob([c.id], 'idle'); run(sm, 1);
  ok(c.tools.axe === null && sm.wornTools.length === 1 && Math.abs(sm.wornTools[0].dur - 77) < 1, 'and back again when the villager is idle');
  sm.setJob([c.id], 'wood'); sm.toolStock.axe1 = 1; sm.wornTools.length = 0; sm.assignTool([c.id], 'axe', 1);
  sm.giveTool([c.id], 'pick', 1);
  ok(sm.heldTool(c)?.k === 'pick' && c.tools.axe === null, 'a villager carries only one tool at a time');
  sm.setJob([c.id], 'wood'); c.tools.axe = { tier: 1, dur: 5 }; c.tools.pick = null;
  sm.discardTool([c.id], 'axe');
  ok(c.tools.axe === null, 'a tool can be thrown away even when it still works');
  sm.toolStock.axe1 = 1; sm.wornTools.length = 0; sm.assignTool([c.id], 'axe', 1); sm.assignTool([c.id], 'axe', 0);
  ok(c.tools.axe === null && sm.toolCount('axe', 1) === 1, 'a whole tool handed back returns to the stock');
  dev.wearTools(sm, [c.id], 0); sm.toolStock.axe1 = 1; sm.assignTool([c.id], 'axe', 1);
  ok(c.tools.axe!.dur > 0, 'a new tool replaces a broken one');
  sm.giveTool([c.id], 'pick', 1); dev.wearTools(sm, [c.id], 0);
  ok(sm.toolTier(c, 'stone') === 0 && sm.toolLacking(c, 'stone'), 'dev can break tools to test the repair flow');
  // storage limits: the craft house holds only a few items without stores
  const sm2 = mk(1337); reveal(sm2);
  ok(sm2.storeCap('tool') === 10 && sm2.storeCap('gear') === 10, 'without stores a few items are kept at the craft house');
  dev.buildAll(sm2);
  ok(sm2.storeCap('tool') === 12 && sm2.storeCap('gear') === 12, 'the stores hold more as they grow');
}

{
  // coins: shells are found while gathering and traded for goods
  const sm = mk(1337); reveal(sm); sm.stock.food = 30;
  ok(RES_NAME.coin === 'Vỏ sò', 'the stone age pays in shells');
  ok(sm.barter('food') === null && sm.stock.food === 20 && sm.stock.coin === 1, 'ten food buy one shell');
  sm.stock.wood = 2; ok(sm.barter('wood') !== null, 'too little to trade is refused');
}

{
  // demolishing and moving buildings
  const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.time = DAY_LENGTH * 0.3; sm.stock.wood = 50; putBuilding(sm, 'builder');
  const sp = sm.world.start, N = sm.world.size;
  const spots: Array<[number, number]> = [];
  for (let dx = -10; dx <= 10; dx++) for (let dy = 3; dy <= 12; dy++) if (!sm.canPlace('storage', sp.x + dx, sp.y + dy)) spots.push([sp.x + dx, sp.y + dy]);
  const A = spots[0], far = spots.find(([x, y]) => Math.abs(x - A[0]) > 4 || Math.abs(y - A[1]) > 4)!;
  const st = sm.placeBuilding('storage', A[0], A[1]).building!;
  ok(sm.stock.wood === 40, 'storage costs 10 wood');
  ok(sm.demolishBuilding(sm.buildings[0].id) !== null, 'the campfire cannot be torn down');
  const ids = sm.villagers.map((o) => o.id); sm.setJob(ids, 'build'); run(sm, 5);
  ok(sm.moveBuilding(st.id, far[0], far[1]) === null && st.x === far[0] && !st.done, 'an unfinished building moves for free');
  ok(sm.world.occ[A[1] * N + A[0]] === 0 && sm.world.occ[far[1] * N + far[0]] === 1, 'its old tiles are free and the new ones taken');
  run(sm, 60);
  ok(st.done && !st.rebuild, 'the builders finish it at the new place');
  const wood = sm.stock.wood;
  ok(sm.moveBuilding(st.id, st.x, st.y) !== null, 'moving to the same place is refused');
  ok(sm.moveBuilding(st.id, sm.buildings[0].x, sm.buildings[0].y) !== null, 'moving onto the campfire is refused');
  ok(sm.moveBuilding(st.id, A[0], A[1]) === null && sm.stock.wood === wood - 2, 'a finished building pays a fifth of its price to move');
  ok(!st.done && st.rebuild && st.level === 1 && sm.capacity() === 30, 'it must be rebuilt and gives no space meanwhile');
  const t0 = sm.time; run(sm, 15);
  ok(st.done && sm.time - t0 < 25, 'rebuilding takes about half the original time');
  ok(sm.canMove(st, A[0] + 1, A[1]) === null, 'a building may shift by one tile onto its own old ground');
  sm.setJob(ids, 'idle');
  const w2 = sm.stock.wood;
  ok(sm.demolishBuilding(st.id) === null && sm.stock.wood === w2 + 5 && !sm.getBuilding(st.id), 'tearing it down returns half of the wood');
  ok(sm.world.occ[A[1] * N + A[0]] === 0, 'and frees the ground');
}

{
  // fighters have their own poses, apart from the work animations
  const anims = JSON.parse(readFileSync('src/data/anims.json', 'utf8')) as Record<string, { frames: unknown[] }>;
  for (const style of ['melee', 'pierce', 'bow', 'sling', 'fist']) ok(!!anims[`guard_${style}`] && !!anims[`charge_${style}`], `a ready stance and a charge exist for ${style} fighters`);
  ok(!!anims.run && !!anims.down, 'fleeing and being downed have their own poses');
  const sm = mk(1337); reveal(sm); const v = sm.villagers[0]; sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.setJob([v.id], 'wood'); run(sm, 1);
  ok(v.anim !== 'guard_melee' && !v.anim.startsWith('charge'), 'a peaceful woodcutter does not use a fighting pose');
  sm.giveGear([v.id], 'spear', 'weapon'); sm.setJob([v.id], 'fight'); sm.orderHold([v.id]); run(sm, 1);
  ok(v.anim === 'guard_pierce' && v.hold?.kind === 'spear', 'a spearman on guard stands in the spear stance with the spear in hand');
  sm.giveGear([v.id], null, 'weapon'); run(sm, 0.2);
  ok(v.anim === 'guard_fist' && v.hold === null, 'unarmed, the same man raises fists');
  v.fight.mode = 'none'; v.phase = 'flee'; sm.animate(v, 0.05);
  ok(v.anim === 'run', 'a frightened villager runs');
  sm.hurt({ kind: 'unit', id: v.id }, 9999, 'crush', { x: 0, y: 0 }, {}); run(sm, 0.5);
  ok(v.down > 0 && v.anim === 'down', 'a downed villager lies down');
}

{
  // worn armour is drawn: the same pose with and without hide armour differs
  const anims = JSON.parse(readFileSync('src/data/anims.json', 'utf8'));
  const look = { sex: 'm' as const, skin: '#d9a371', hair: '#3b2a1a', hide: '#8b6a45', pants: '#3f63a8' };
  const diff = (view: 'front' | 'back' | 'right') => { const a = renderFrame(anims, 'idle', 0, view, look, 'wood', { tier: 0 }, null), b = renderFrame(anims, 'idle', 0, view, look, 'wood', { tier: 0 }, 'hide'); let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
  ok(diff('front') > 80 && diff('back') > 80 && diff('right') > 60, `hide armour changes the look from every side (${diff('front')}/${diff('back')}/${diff('right')} bytes)`);
}

{
  // with research switched off (the default of the game) everything is open
  RESEARCH.enabled = false;
  const sm = mk(1337); reveal(sm);
  ok(sm.recipeOpen('mace2') && sm.recipeOpen('pick2'), 'research off: every recipe is open');
  ok(sm.queueResearch('timber') === 'Nghiên cứu đang tắt', 'research off: no research can be queued');
  const st = sm.buildings[0]; void st;
  RESEARCH.enabled = true;
}

{
  // handing out gear from the workshop stock
  const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const [a, b] = sm.villagers;
  ok(sm.assignGear([a.id], 'spear', 'weapon') !== null, 'no workshop, no gear to hand out');
  dev.unlockResearch(sm); sm.dev.freeBuild = true; sm.dev.instantBuild = true;
  putBuilding(sm, 'builder'); const sp = sm.world.start; for (let dx = -8; dx <= 8 && !sm.hasWorkshop(); dx++) for (let dy = 3; dy <= 11; dy++) if (!sm.canPlace('workshop', sp.x + dx, sp.y + dy)) { sm.placeBuilding('workshop', sp.x + dx, sp.y + dy); break; }
  sm.dev.freeBuild = false; dev.buildAll(sm);
  ok(sm.assignGear([a.id], 'spear', 'weapon') !== null && a.weapon === null, 'an empty stock hands out nothing');
  sm.toolStock.spear1 = 1; sm.toolStock.club1 = 1; sm.toolStock.hide1 = 1;
  ok(sm.assignGear([a.id], 'spear', 'weapon') === null && a.weapon === 'spear' && sm.toolStock.spear1 === 0 && a.manualGear, 'a spear is taken from the stock and given');
  ok(sm.assignGear([a.id], 'club', 'weapon') === null && a.weapon === 'club' && sm.toolStock.spear1 === 1 && sm.toolStock.club1 === 0, 'swapping returns the old weapon');
  sm.assignGear([a.id], 'hide', 'armor'); ok(a.armor === 'hide' && sm.toolStock.hide1 === 0, 'armour is handed out too');
  sm.assignGear([a.id], null, 'weapon'); sm.assignGear([a.id], null, 'armor');
  ok(a.weapon === null && a.armor === null && sm.toolStock.club1 === 1 && sm.toolStock.hide1 === 1, 'giving it back restores the stock');
  sm.assignGear([a.id], 'spear', 'weapon'); sm.toolStock.mace2 = 1; sm.setJob([a.id], 'fight'); run(sm, 20);
  ok(a.weapon === 'spear' && sm.toolStock.mace2 === 1, 'gear handed out by hand is not swapped by the workshop');
  sm.assignGear([a.id], null, 'weapon'); sm.autoGear([a.id]); run(sm, 40);
  ok(!a.manualGear && a.weapon !== null, 'after "Tự nhận đồ" the workshop equips them again');
  sm.setJob([b.id], 'fight'); sm.giveGear([b.id], 'club', 'weapon'); b.manualGear = true; run(sm, 1);
  ok(b.anim === 'idle_armed' && b.hold?.kind === 'club', 'a soldier carries the weapon in hand while idle');
}

{
  // a move order does not turn a soldier or a hunter back into a civilian
  const sm = mk(1337); reveal(sm); day(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const [sol, hun, civ] = sm.villagers; sm.giveGear([sol.id], 'spear', 'weapon'); sm.setJob([sol.id], 'fight'); sm.setJob([hun.id], 'hunt'); sm.setJob([civ.id], 'wood');
  const f = sm.campfire()!; const gx = Math.floor(f.x + 8), gy = Math.floor(f.y + 4);
  sm.orderMove([sol.id, hun.id, civ.id], gx, gy); run(sm, 1);
  ok(sol.job === 'fight' && hun.job === 'hunt' && civ.job === 'idle', 'soldier and hunter keep their job; a civilian goes idle');
  ok(sol.weapon === 'spear' && sol.anim.startsWith('charge') && sol.hold?.kind === 'spear', 'the soldier walks with the spear in hand');
  run(sm, 25);
  ok(Math.hypot(sol.x - gx, sol.y - gy) < 3 && sol.job === 'fight', 'and stands at the spot they were sent to');
}

console.log(fails ? `${fails} lỗi` : 'tất cả đạt');
process.exit(fails ? 1 : 0);
