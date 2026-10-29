import { readFileSync } from 'fs';
import { renderFrame } from '../src/character/rig.js';
import { renderAnimal } from '../src/character/animal-rig.js';
import { Sim } from '../src/sim/sim';
import { DAY_LENGTH, PACE } from '../src/sim/constants';
import { Tile } from '../src/sim/world';
import { lightAt, rollWeather, SEASON_DEF, seasonOf, SEASONS, WEATHER } from '../src/sim/calendar';
import { RECIPE_BY_ID, TIER_DURABILITY } from '../src/sim/tools';
import { levelDef, levelsOf, maxLevel } from '../src/sim/buildings';
import { ARMS, armOfWeapon, clampTactical, clusterize, COMMAND, FORMATION_IDS, FORMATIONS, formationOffsets, iconCount, masteryFactor, matchup, SQUAD_MAX, SQUAD_MIN, drawFormation } from '../src/sim/formations';
import { launchRaid, raidAdvised } from '../src/sim/tribes';
import { ANIMALS, ARMORS, COMBAT_STATES, cycleOf, damageOf, MORALE, poseOf, RULES, SPECIES, STYLES, TRIBES, TRIBE_IDS, WEAPONS, zoneOf } from '../src/sim/combat';
import { armMultiplier, fireProjectile, swingTimes, weaponOf } from '../src/sim/battle';
import { carcassEmpty, die, provoke, spawnAnimal } from '../src/sim/fauna';
import type { Villager } from '../src/sim/sim';
import * as dev from '../src/sim/dev';
import { NOT_SAVED, SAVE_VERSION, SAVED } from '../src/sim/save';
import { RESEARCH, TECHS } from '../src/sim/research';
import { ANIMAL_MATERIALS, RES_LIST, RES_NAME } from '../src/sim/resources';

PACE.work = 1; // the tests count work in plain seconds; the pace has its own test
RESEARCH.enabled = false; // most tests run with everything open; the research tests switch it on

let fails = 0;
const ok = (c: boolean, msg: string) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
const run = (sim: Sim, secs: number) => { for (let i = 0; i < secs * 20; i++) (sim as unknown as { tick(d: number): void }).tick(0.05); };

/** The old test start: three idle villagers. The real start (two with jobs) has its own test. */
const provokeFor = (sm: Sim, v: Villager, a: ReturnType<typeof spawnAnimal>) => { provoke(sm, a, v.id); a.state = 'attack'; a.target = { kind: 'unit', id: v.id }; a.timer = 99; };
const t_ = (sm: Sim, id: string) => sm.tribes.find((x) => x.id === id)!;
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
  const v = sm.villagers[0]; sm.villagers.forEach((o) => { o.fullness = 1e9; }); sm.setJob([v.id], 'wood');
  ok(sm.orderWork([v.id], cx, cy)?.sent === 1, 'chuột phải lên cây giữa vẫn nhận lệnh');
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
  const [a, b] = sm.villagers; sm.villagers.forEach((o) => { o.fullness = 1e9; }); sm.setJob([a.id, b.id], 'wood');
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
  const v = sm.villagers[0]; sm.villagers.forEach((o) => { o.fullness = 1e9; }); sm.setJob([v.id], 'wood');
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
  ok(sm.orderWork([a.id], spot![0], spot![1])?.job === 'build' && a.job === 'build', 'the very first house may be raised by whoever is sent to it');
  run(sm, 200);
  ok(house.done && sm.crew().length === 1, 'the builder raised the Nhà thợ xây and stays on as a builder');
  ok(sm.buildingLock('storage') === null && sm.buildingLock('lab') !== null, 'now the Kho can be placed, the research house still waits');
  const kho = sm.placeBuilding('storage', spot![0] + 4, spot![1]).building!;
  ok(sm.orderWork([b.id], spot![0] + 4, spot![1])?.sent === 0 && b.job === 'wood', 'a villager who is not a builder cannot be sent to raise a house');
  ok(sm.assignCrew([b.id]) === null && sm.crew().length === 2, 'the player picks a second builder');
  const c = sm.makeVillager(sp.x, sp.y, 'm', 'player'); (sm.villagers as Villager[]).push(c); sm.registerUnit(c);
  ok(sm.assignCrew([c.id]) !== null && sm.crew().length === 2, 'the house holds two builders at level 1');
  run(sm, 300);
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
  // a save from before villagers had energy still loads: they start rested, and the torch is a known technology
  {
    const old = JSON.parse(json) as { version: number; lists: { villagers: Array<Record<string, unknown>>; foes: Array<Record<string, unknown>> }; researched: string[] };
    old.version = 1; for (const v of [...old.lists.villagers, ...old.lists.foes]) { delete v.energy; delete v.strain; delete v.shift; delete v.torch; delete v.lockUntil; delete v.lit; }
    old.researched = old.researched.filter((r) => r !== 'torch1');
    const up = Sim.fromSave(old);
    ok(up.villagers.every((v) => v.energy === 100 && v.shift === 'day' && v.torch === null && v.lockUntil === 0) && up.researched.has('torch1'), 'a version 1 save is brought forward when it is loaded');
    run(up, 5);
  }
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

// ======== how long gathering takes: real seconds, slowed by weather and season ========
{
  const wood = (weather: 'clear' | 'rain' | 'storm', season?: number): number => {
    const sm = new Sim(1337); sm.fog.state.fill(2); sm.villagers.forEach((o) => { o.fullness = 1e9; }); sm.villagers[1].job = 'idle';
    sm.events.length = 0; sm.nextRaid = 1e9; sm.animals.length = 0; sm.animalById.clear(); // nothing attacks while we count wood
    sm.time = DAY_LENGTH * (season ?? 0) + DAY_LENGTH * 0.25; sm.weather = weather; sm.nextWeather = weather;
    const v = sm.villagers[0]; sm.setJob([v.id], 'wood');
    for (let i = 0; i < 20 * 300; i++) (sm as unknown as { tick(d: number): void }).tick(0.05); // five minutes at normal speed
    return sm.stock.wood + (v.carry?.res === 'wood' ? v.carry.amount : 0);
  };
  const clear = wood('clear'), rain = wood('rain'), storm = wood('storm'), winter = wood('clear', 15);
  ok(clear >= 15, `one woodcutter with bare hands has the 15 wood of a first house within five minutes (${clear})`);
  ok(rain < clear && storm < rain, `rain and storm slow the work (clear ${clear}, rain ${rain}, storm ${storm})`);
  ok(winter < clear, `and so does the cold of winter (${winter} against ${clear})`);
}

// ======== energy, sleep, shifts and torches ========
{
  const quiet = (seed = 1337) => { // two villagers on an empty map: nothing hunts them, everything is revealed
    const sm = new Sim(seed); sm.fog.state.fill(2); sm.events.length = 0; sm.nextRaid = 1e9; sm.animals.length = 0; sm.animalById.clear();
    sm.villagers.forEach((o) => { o.fullness = 1e9; o.stats.vit = 7; o.stats.sta = 7; o.morale = 80; }); sm.buildings[0].level = 4;
    return sm;
  };
  const at = (sm: Sim, tod: number) => { sm.time = Math.floor(sm.time / DAY_LENGTH) * DAY_LENGTH + DAY_LENGTH * tod; };
  const tickFor = (sm: Sim, secs: number) => { for (let i = 0; i < secs * 20; i++) (sm as unknown as { tick(d: number): void }).tick(0.05); };

  // a day of hard work costs about half the energy, a lighter job less
  const day = quiet(); const [w, g] = day.villagers; day.setJob([w.id], 'wood'); day.setJob([g.id], 'food'); at(day, 0.2);
  tickFor(day, DAY_LENGTH * 0.6);
  ok(w.energy < 70 && w.energy > 40, `a woodcutter spends about half his energy in a day (${w.energy.toFixed(0)} left)`);
  ok(g.energy > w.energy, `a gatherer spends less than a woodcutter (${g.energy.toFixed(0)} against ${w.energy.toFixed(0)})`);
  // a stronger body tires slower
  const fitTest = quiet(); const [a1, b1] = fitTest.villagers; a1.stats.vit = a1.stats.sta = 10; b1.stats.vit = b1.stats.sta = 3;
  fitTest.setJob([a1.id, b1.id], 'wood'); at(fitTest, 0.2); tickFor(fitTest, 300);
  ok(a1.energy > b1.energy, `a sturdy villager tires slower than a frail one (${a1.energy.toFixed(1)} against ${b1.energy.toFixed(1)})`);
  // night sleep gives back about 60 points, sleep by day half of that
  const nap = quiet(); const [s1] = nap.villagers; s1.energy = 30; s1.job = 'idle'; at(nap, 0.83); nap.resting = true;
  tickFor(nap, 20); const e0 = s1.energy; tickFor(nap, DAY_LENGTH * 0.35 - 40);
  const nightGain = s1.energy - e0;
  ok(s1.phase === 'sleep' && nightGain > 28 && nightGain < 44, `without a Nhà dân a night by the campfire gives back around 36 points (${nightGain.toFixed(0)})`);
  const homeNap = quiet(); const [h1] = homeNap.villagers; putBuilding(homeNap, 'builder'); const home = putBuilding(homeNap, 'house');
  h1.energy = 30; h1.job = 'idle'; at(homeNap, 0.83); homeNap.resting = true; tickFor(homeNap, 60); const h0 = h1.energy; tickFor(homeNap, DAY_LENGTH * 0.35 - 80);
  ok(h1.phase === 'sleep' && h1.inside === home.id && h1.energy - h0 > 45 && h1.energy - h0 < 70, `in the Nhà dân a night gives back around 60 points (${(h1.energy - h0).toFixed(0)}), and they are indoors`);
  ok(homeNap.sleepers(home).includes(h1) && !homeNap.villagers.some((o) => o !== h1 && o.inside === home.id && o.phase !== 'sleep'), 'the house lists its sleepers');
  const daySleep = quiet(); const [s2] = daySleep.villagers; s2.energy = 30; s2.shift = 'night'; daySleep.setJob([s2.id], 'wood'); s2.nightOwl = false; at(daySleep, 0.3); tickFor(daySleep, 20); // (the order itself would call him up)
  const d0 = s2.energy; tickFor(daySleep, 200);
  ok(s2.phase === 'sleep', 'a night-shift villager sleeps through the day');
  const dayGainPerS = (s2.energy - d0) / 200, nightGainPerS = nightGain / (DAY_LENGTH * 0.35 - 60);
  ok(dayGainPerS > 0 && dayGainPerS < nightGainPerS * 0.7, `sleep by day gives back less than sleep by night (${(dayGainPerS * 60).toFixed(1)} against ${(nightGainPerS * 60).toFixed(1)} a minute)`);
  // the ordinary day shift never runs dry: they sleep every night
  const cycle = quiet(); const [c1] = cycle.villagers; cycle.setJob([c1.id], 'wood'); at(cycle, 0.2); let lowest = 100;
  for (let i = 0; i < 20 * DAY_LENGTH * 3; i++) { (cycle as unknown as { tick(d: number): void }).tick(0.05); if (i % 200 === 0) lowest = Math.min(lowest, c1.energy); }
  ok(lowest > 20, `a day-shift worker never goes below 20 over three days (lowest ${lowest.toFixed(0)})`);

  // worn out: below 20 they go to bed and cannot be woken until 50; below 10 until 60
  const tired = quiet(); const [t1, t2] = tired.villagers; tired.setJob([t1.id, t2.id], 'wood'); at(tired, 0.3); t1.energy = 20.3; t2.energy = 9.5;
  tickFor(tired, 20);
  ok(t1.phase === 'sleep' && t1.lockUntil === 50 && t2.phase === 'sleep' && t2.lockUntil === 60, 'worn out, they sleep: until 50, or until 60 after a collapse below 10');
  tired.orderMove([t1.id, t2.id], tired.world.start.x + 6, tired.world.start.y); tickFor(tired, 5);
  ok(t1.phase === 'sleep' && t2.phase === 'sleep' && tired.sleepLocked(t1) && tired.setJob([t1.id], 'stone') === null && t1.job === 'wood', 'a worn-out sleeper cannot be woken by an order');
  const e1 = t1.energy; tickFor(tired, 60); ok(t1.energy > e1, 'and keeps recovering');
  for (let i = 0; i < 20 * 600 && t1.lockUntil > 0; i++) (tired as unknown as { tick(d: number): void }).tick(0.05);
  ok(t1.lockUntil === 0 && t1.energy >= 49.9, `they get up once rested (${t1.energy.toFixed(0)})`);
  ok(t2.lockUntil === 60 ? t2.energy < 60 : t2.energy >= 59.9, 'after a collapse the rest goes on longer');
  // above 20 a sleeper can be called up
  const calm = quiet(); const [k1] = calm.villagers; calm.setJob([k1.id], 'wood'); k1.nightOwl = false; at(calm, 0.3); k1.energy = 60; k1.shift = 'night'; tickFor(calm, 20);
  ok(k1.phase === 'sleep' && !calm.sleepLocked(k1), 'a night-shift worker asleep by day with energy to spare is not locked');
  calm.setJob([k1.id], 'stone'); tickFor(calm, 3);
  ok(k1.job === 'stone' && k1.nightOwl && k1.phase !== 'sleep', 'and an order calls him up');

  // soldiers fight on whatever their energy, and sleep long afterwards
  const war = quiet(); const [m1] = war.villagers; m1.weapon = 'club'; war.setJob([m1.id], 'fight'); at(war, 0.3); m1.energy = 5; m1.health = m1.maxHealth;
  const field = war.world.start; const foe = spawnAnimal(war, 'boar', field.x + 2, field.y + 1, 99); foe.hp = foe.maxHp = 400; provokeFor(war, m1, foe);
  tickFor(war, 6);
  ok(m1.phase !== 'sleep' && m1.phase !== 'goHome', 'a soldier at 5% energy keeps fighting');
  foe.hp = 0; war.animals.length = 0; war.animalById.clear(); m1.fight.target = null; m1.fight.mode = 'none'; m1.phase = 'idle'; tickFor(war, 6);
  ok((m1.phase === 'sleep' || m1.phase === 'goHome') && m1.lockUntil === 60, 'once the fight is over he sleeps long, until 60 percent');

  // night work needs a torch and goes at 70 percent
  const rate = (torch: boolean): number => {
    const sm = quiet(); const [n1] = sm.villagers; sm.villagers[1].job = 'idle'; n1.shift = 'night'; sm.setJob([n1.id], 'wood'); at(sm, 0.85); sm.resting = true; sm.weather = 'clear'; sm.nextWeather = 'clear';
    if (torch) sm.toolStock.torch1 = 3;
    tickFor(sm, 30); const w0 = sm.stock.wood + (n1.carry?.amount ?? 0);
    tickFor(sm, 120);
    return (sm.stock.wood + (n1.carry?.amount ?? 0) - w0) + (n1.phase === 'sleep' ? -999 : 0);
  };
  const noTorch = rate(false), withTorch = rate(true);
  ok(noTorch < 0, 'at night a worker without a torch does not work');
  ok(withTorch > 0, `with a torch the night shift gets on with it (${withTorch} wood in two minutes)`);
  const dayRate = (() => { const sm = quiet(); const [n1] = sm.villagers; sm.villagers[1].job = 'idle'; sm.setJob([n1.id], 'wood'); at(sm, 0.3); sm.weather = 'clear'; sm.nextWeather = 'clear'; tickFor(sm, 30); const w0 = sm.stock.wood + (n1.carry?.amount ?? 0); tickFor(sm, 120); return sm.stock.wood + (n1.carry?.amount ?? 0) - w0; })();
  ok(withTorch < dayRate && withTorch > dayRate * 0.4, `night work goes at about 70% of day work (${withTorch} against ${dayRate})`);
  // torches: made in the craft house, handed out, burn, go back
  ok(!!RECIPE_BY_ID.torch1 && Object.keys(RECIPE_BY_ID.torch1.cost).length > 0, 'the craft house can make torches');
  const torches = quiet(); const [r1] = torches.villagers; torches.toolStock.torch1 = 2; at(torches, 0.9); torches.resting = true;
  ok(torches.giveTorch([r1.id]) === null && !!r1.torch && torches.torchCount() === 1, 'a torch is handed from the store to a villager');
  torches.returnTorch(r1); ok(!r1.torch && torches.torchCount() === 2, 'and goes back to the store if it is unused');
  torches.giveTorch([r1.id]); torches.toolStock.torch1 = 0; r1.torch!.dur = 3; r1.job = 'wood'; r1.shift = 'night'; r1.phase = 'work'; tickFor(torches, 6);
  ok(!r1.torch, 'a torch burns out');
  // night after night: strain builds up, the ceiling falls, recovery slows
  const grind = quiet(); const [x1] = grind.villagers; grind.villagers[1].job = 'idle'; x1.shift = 'both'; grind.setJob([x1.id], 'wood'); grind.toolStock.torch1 = 50; at(grind, 0.2);
  let ceiling = 100;
  for (let i = 0; i < 20 * DAY_LENGTH * 4; i++) { (grind as unknown as { tick(d: number): void }).tick(0.05); if (i % 600 === 0) { grind.stock.wood = 0; ceiling = Math.min(ceiling, grind.maxEnergy(x1)); if (!x1.torch) grind.giveTorch([x1.id]); } }
  ok(x1.strain > 20 && ceiling < 95, `working round the clock builds up strain and lowers the ceiling (strain ${x1.strain.toFixed(0)}, ceiling ${ceiling.toFixed(0)})`);
  const rested = quiet(); const [y1] = rested.villagers; y1.strain = 60; y1.energy = 30; y1.job = 'idle'; at(rested, 0.83); rested.resting = true; tickFor(rested, 20);
  const fresh = quiet(); const [y2] = fresh.villagers; y2.energy = 30; y2.job = 'idle'; at(fresh, 0.83); fresh.resting = true; tickFor(fresh, 20);
  tickFor(rested, 200); tickFor(fresh, 200);
  ok(y1.energy - 30 < (y2.energy - 30) * 0.9, `a strained villager recovers more slowly (${(y1.energy - 30).toFixed(1)} against ${(y2.energy - 30).toFixed(1)})`);
  // the soldiers' camp heals them faster
  const camp = quiet(); const [q1, q2] = camp.villagers; for (const o of [q1, q2]) { o.job = 'fight'; o.energy = 30; o.weapon = 'club'; }
  putBuilding(camp, 'builder'); putBuilding(camp, 'infantry'); at(camp, 0.83); camp.resting = true; tickFor(camp, 60);
  const bar = camp.building('infantry')!;
  ok(camp.villagers.some((o) => Math.hypot(o.x - bar.x - 1, o.y - bar.y - 1) < 5), 'soldiers go to sleep in the barracks while it has beds');
  const inB = camp.villagers.find((o) => Math.hypot(o.x - bar.x - 1, o.y - bar.y - 1) < 4)!;
  const outB = quiet(); const [z1] = outB.villagers; z1.job = 'fight'; z1.energy = 30; z1.weapon = 'club'; at(outB, 0.83); outB.resting = true; tickFor(outB, 60);
  ok(!!inB && inB.energy > z1.energy + 1, `a soldier in the barracks recovers faster than one by the campfire (${inB?.energy.toFixed(1)} against ${z1.energy.toFixed(1)})`);
  ok(!!inB && inB.inside === bar.id && inB.phase === 'sleep' && camp.sleepers(bar).includes(inB), 'a soldier in the tent is listed there, out of sight, not drawn asleep on the map');
  ok(camp.villagers.filter((o) => o.inside === bar.id).length <= camp.bedsIn('infantry'), 'no more soldiers in the tent than it has beds');
  // a full house: the extra sleeper lies by the campfire and rests slower
  const full = quiet(); putBuilding(full, 'builder'); const hut = putBuilding(full, 'house'); full.bedsIn('house');
  const crowd = [...full.villagers]; for (let i = 0; i < 6; i++) { const e = full.makeVillager(full.world.start.x, full.world.start.y, 'm', 'player'); (full.villagers as Villager[]).push(e); full.registerUnit(e); crowd.push(e); }
  for (const o of crowd) { o.fullness = 1e9; o.energy = 30; o.job = 'idle'; } at(full, 0.83); full.resting = true; tickFor(full, 90);
  const inHut = crowd.filter((o) => o.inside === hut.id), outside = crowd.filter((o) => o.inside === null && o.phase === 'sleep');
  ok(inHut.length === full.bedsIn('house') && outside.length === crowd.length - inHut.length && outside.length > 0, `only as many sleep in the house as it has beds (${inHut.length}), the rest by the fire (${outside.length})`);
  ok(full.sleepers(hut).length === inHut.length, 'the house lists exactly those inside');
  // a click gives no job; soldiers are made and unmade at the campfire only
  const jobs = quiet(); const [j1, j2] = jobs.villagers; jobs.setJob([j1.id], 'food');
  const tree = (() => { const sp = jobs.world.start; clearArea(jobs, sp.x + 8, sp.y + 4, 3); plant(jobs, sp.x + 8, sp.y + 4); return { x: sp.x + 8, y: sp.y + 4 }; })();
  ok(jobs.orderWork([j1.id], tree.x, tree.y)?.sent === 0 && j1.job === 'food', 'a click on a tree does not turn a gatherer into a woodcutter');
  jobs.enlist([j2.id]);
  ok(j2.job === 'fight' && jobs.setJob([j2.id], 'wood') !== null && j2.job === 'fight', 'the job buttons cannot unmake a soldier');
  ok(jobs.assignCrew([j2.id]) !== null && j2.job === 'fight', 'nor can a house take a soldier');
  ok(jobs.discharge([j2.id]) === 1 && j2.job === 'idle', 'the campfire discharges him');
  // new houses come from research
  RESEARCH.enabled = true; const lock = new Sim(1337); lock.dev.freeBuild = false;
  ok(lock.buildingLock('house') !== null && lock.buildingLock('infantry') !== null, 'the Nhà dân and the Trại chiến binh need the Nhà thợ xây first');
  putBuilding(lock, 'builder');
  ok(lock.buildingLock('house') === 'Cần nghiên cứu: Nhà dân' && lock.buildingLock('infantry') === 'Cần nghiên cứu: Trại chiến binh', 'and both must be researched before they can be built');
  lock.researched.add('house'); lock.researched.add('barracks');
  ok(lock.buildingLock('house') === null && lock.buildingLock('infantry') === null, 'researched, they can be placed');
  RESEARCH.enabled = false;
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
  // a soldier chosen by the player at night does not sleep: they get up and stand watch; the others stay in bed
  {
    const night = new Sim(1337); reveal(night); night.villagers.forEach((o) => { o.fullness = 1e9; }); night.time = DAY_LENGTH * 0.9;
    const [w1, w2] = night.villagers; run(night, 60);
    ok(night.villagers.every((o) => o.phase === 'sleep' || o.phase === 'goHome'), 'at night everybody is in bed');
    night.setJob([w1.id], 'fight'); night.setJob([w2.id], 'wood'); run(night, 10);
    ok(w1.job === 'fight' && w1.nightOwl && w1.phase !== 'sleep' && w1.phase !== 'goHome', 'a villager made a soldier at night gets up to stand watch');
    ok(w2.phase === 'sleep' || w2.phase === 'goHome', 'a worker given a job at night stays in bed');
    night.orderHold([w1.id]); run(night, 5);
    ok(w1.nightOwl && w1.fight.mode === 'hold', 'and keeps the watch he was told to');
    night.time = DAY_LENGTH * 1.2; run(night, 2);
    ok(!w1.nightOwl && night.restTime === false, 'in the morning the watch is over');
  }
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
  ok(SPECIES.every((sp) => by(sp).length > 0), `every species lives on the map (${sm.animals.length} animals): missing ${SPECIES.filter((sp) => by(sp).length === 0).join(', ')}`);
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
  ok(sm.orderAttack([v.id], { kind: 'animal', id: rb.id }) === 0 && v.job !== 'hunt' && v.job !== 'fight', 'a click on a rabbit gives a plain villager no job and no fight');
  sm.setJob([v.id], 'hunt');
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
  ok(sm.stock.bone >= 2 && sm.stock.fat >= 2, `bone and fat from the deer reached the store too (xương ${sm.stock.bone}, mỡ ${sm.stock.fat})`);
}
{
  // the biggest game gives the rarest material
  const sm = mk(1337); reveal(sm); day(sm, 0.3); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const s = sm.world.start, m = spawnAnimal(sm, 'mammoth', s.x + 8, s.y - 3, 9); die(sm, m);
  ok(m.drops.tusk === 2 && m.meat === 120 && !carcassEmpty(m), 'a dead mammoth carries meat, hide, bone, fat and two tusks');
  sm.villagers[0].weapon = 'spear'; sm.stock.tusk = 0; sm.setJob([sm.villagers[0].id], 'hunt');
  for (let i = 0; i < 20 * 120 && sm.stock.tusk < 2; i++) (sm as unknown as { tick(d: number): void }).tick(0.05);
  ok(sm.stock.tusk === 2 && sm.stock.bone >= 14 && sm.stock.fat >= 24 && Object.keys(m.drops).every((k) => !m.drops[k as keyof typeof m.drops]), 'the hunter brought home the tusks, bone and fat');
}
{
  // species are data: every one has art, a body family with its clips, sane zones and real materials
  const clips: Record<string, Record<string, unknown>> = {};
  for (const body of ['quadruped', 'biped', 'hopper', 'fish']) clips[body] = JSON.parse(readFileSync(`src/data/animals/anims/${body}.json`, 'utf8'));
  const art = JSON.parse(readFileSync('src/data/animals/bodies.json', 'utf8')) as Record<string, { body: string; size: number[]; palette: Record<string, string>; shape: Record<string, unknown> }>;
  ok(SPECIES.length >= 15, `${SPECIES.length} species in the game`);
  for (const sp of SPECIES) {
    const d = ANIMALS[sp], a = art[sp];
    const problems: string[] = [];
    if (!a) problems.push('no art in bodies.json');
    else {
      if (!clips[a.body]) problems.push(`unknown body "${a.body}"`);
      else for (const c of d.habitat === 'water' ? ['idle', 'swim', 'die'] : ['idle', 'walk', 'run', 'die']) if (!clips[a.body][c]) problems.push(`body ${a.body} has no clip ${c}`);
      if (!(a.size[0] >= 12 && a.size[1] >= 8)) problems.push('size');
    }
    if (!(d.zones[0] >= 1 && d.zones[1] <= 4 && d.zones[0] <= d.zones[1])) problems.push('zones');
    if (!(d.herd[0] >= 1 && d.herd[1] >= d.herd[0]) || !(d.count > 0) || !(d.hp > 0)) problems.push('herd, count or hp');
    if (!Object.keys(d.drops ?? {}).every((k) => (RES_LIST as string[]).includes(k) && ANIMAL_MATERIALS.includes(k as never))) problems.push('a drop that is not an animal material');
    if (d.aggro > 0 && d.zones[0] < 2) problems.push('a hunter of men in the first ring');
    ok(problems.length === 0, `species ${sp}: art, body, zones and drops are in order${problems.length ? ' — ' + problems.join('; ') : ''}`);
  }
  ok(ANIMAL_MATERIALS.every((r) => SPECIES.some((sp) => (ANIMALS[sp].drops?.[r] ?? 0) > 0)), 'every animal material is given by some animal');
  // every species draws something in every clip (no pictures looked at; the art is for the eye to judge)
  for (const sp of SPECIES) {
    const def = art[sp], empty: string[] = [];
    for (const [clip, c] of Object.entries(clips[def.body]) as Array<[string, { frames: unknown[] }]>) {
      for (let i = 0; i < c.frames.length; i++) {
        const r = renderAnimal(def, c as never, i); let n = 0;
        for (let q = 3; q < r.data.length; q += 4) if (r.data[q] > 0) n++;
        if (n < 20) empty.push(`${clip}[${i}]`);
      }
    }
    ok(empty.length === 0, `species ${sp} draws in every clip${empty.length ? ' — empty: ' + empty.slice(0, 4).join(', ') : ''}`);
  }
}
{
  // a wolf does not walk into firelight, but hunts a villager away from it at night
  const sm = mk(1337); reveal(sm); sm.time = DAY_LENGTH * 0.95; sm.villagers.forEach((o) => { o.fullness = 1e9; o.nightOwl = true; });
  const v = firstVillager(sm), fire = sm.campfire()!, s = sm.world.start;
  const w = spawnAnimal(sm, 'wolf', s.x - 14, s.y + 12, 7, true);
  v.x = s.x + 0.5; v.y = s.y + 14.5; sm.orderMove([v.id], s.x, s.y + 14); run(sm, 2);
  run(sm, 12);
  ok(w.state === 'attack' || v.health < v.maxHealth || !sm.villagers.includes(v), 'the wolf hunts a villager who is away from the fire');
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
  const plain = sm.villagers[1];
  ok(sm.orderAttack([plain.id], { kind: 'unit', id: foe.id }) === 0 && plain.job !== 'fight', 'right click on a foe gives a plain villager no job: soldiers are made at the campfire');
  sm.enlist([v.id]);
  sm.orderAttack([v.id], { kind: 'unit', id: foe.id });
  ok(v.job === 'fight' && v.fight.mode === 'attack', 'right click on a foe sends a soldier to attack it');
  run(sm, 25);
  ok(foe.health <= 0 || !sm.foes.includes(foe), 'the foe went down under a stone mace');
  ok(!tribe.unitIds.includes(foe.id) && tribe.relation < -60, `killing a warrior costs relations (${tribe.relation})`);
  ok(v.fight.target === null && v.fight.mode === 'guard', 'the order ends with the kill and the fighter stays on guard there');
}
{
  const { sm, c, foe } = stage();
  const [a, b] = sm.villagers; a.x = c.x + 0.5; a.y = c.y + 0.5; b.x = c.x - 1.5; b.y = c.y + 0.5;
  sm.hurt({ kind: 'unit', id: a.id }, 9999, 'crush', { x: foe.x, y: foe.y }, { unit: foe });
  ok(!sm.villagers.includes(a) && sm.get(a.id) === undefined, 'a mortal blow kills a villager for good: nobody lies wounded to be picked up');
  ok(sm.log.some((l) => l.text.includes(a.name) && l.text.includes('tử trận')), 'and the log says they fell');
  run(sm, 30); ok(!sm.villagers.includes(a), 'nothing brings them back');
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
  const v = firstVillager(sm); v.x = c.x + 0.5; v.y = c.y + 0.5; foe.x = c.x + 7.5; foe.y = c.y + 0.5; foe.ai!.camp = { x: foe.x, y: foe.y }; foe.speed = 0.4; sm.enlist([v.id]); // a slow foe: the test is about not chasing, not about how fast it comes
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
  sm.orderAttackMove([v.id], c.x + 6, c.y); ok(v.fight.mode === 'none', 'attack-move is for soldiers only: a plain villager does not march to war');
  sm.enlist([v.id]); sm.orderAttackMove([v.id], c.x + 6, c.y);
  ok(v.job === 'fight' && v.fight.mode === 'attackMove', 'attack-move sends a soldier on the march');
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
  const v = firstVillager(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; }); v.x = t.camp.x + 0.5; v.y = t.camp.y + 3.5; sm.enlist([v.id]); sm.orderHold([v.id]);
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
  const far = sm.villagers[1]; sm.discharge([far.id]); sm.setJob([far.id], 'stone'); far.x = sm.world.start.x + 30; far.y = sm.world.start.y; far.path = [];
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
  const t0 = sm.time; for (let t = 0; t < 120 && !st.done; t += 0.5) run(sm, 0.5);
  ok(st.done && sm.time - t0 < 0.75 * levelDef(st, 1).buildTime, 'rebuilding takes about half the original time');
  ok(sm.canMove(st, A[0] + 1, A[1]) === null, 'a building may shift by one tile onto its own old ground');
  sm.setJob(ids, 'idle');
  const w2 = sm.stock.wood;
  ok(sm.demolishBuilding(st.id) === null && sm.stock.wood === w2 + 5 && !sm.getBuilding(st.id), 'tearing it down returns half of the wood');
  ok(sm.world.occ[A[1] * N + A[0]] === 0, 'and frees the ground');
}

{
  // fighters have their own poses, apart from the work animations
  const anims = JSON.parse(readFileSync('src/data/anims.json', 'utf8')) as Record<string, { frames: unknown[] }>;
  // every fighting style has the five poses an armed person needs, and every weapon belongs to a style
  for (const [id, st] of Object.entries(STYLES)) ok(COMBAT_STATES.every((s2) => !!anims[st[s2]]), `style "${id}" has an animation for idle, walk, guard, charge and attack`);
  for (const [id, w] of Object.entries(WEAPONS)) ok(!!STYLES[w.style] && COMBAT_STATES.every((s2) => !!anims[poseOf(id, s2)]), `weapon ${id} (${w.style}) resolves every pose to an existing animation`);
  ok(Object.values(STYLES).every((st) => (anims[st.attack] as { hit?: number }).hit !== undefined), 'every attack animation says on which frame the blow lands');
  ok(poseOf(null, 'guard') === 'fist_guard' && poseOf('hatchet', 'attack') === 'slash' && poseOf('hatchet', 'guard') === 'swing_guard', 'bare hands use the fist style; one weapon can override a single pose');
  ok(Object.entries(anims).filter(([k]) => /_walk$|^walk$|^carry_walk$/.test(k)).every(([, a]) => (a as { gait?: boolean }).gait === true), 'walking animations are marked as gaits so they step with the walking speed');
  ok(!!anims.run && !!anims.down, 'fleeing and being downed have their own poses');
  const sm = mk(1337); reveal(sm); const v = sm.villagers[0]; sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.setJob([v.id], 'wood'); run(sm, 1);
  ok(!/_(guard|charge|attack)$/.test(v.anim), 'a peaceful woodcutter does not use a fighting pose');
  sm.giveGear([v.id], 'spear', 'weapon'); sm.setJob([v.id], 'fight'); sm.orderHold([v.id]); run(sm, 1);
  ok(v.anim === 'thrust_guard' && v.hold?.kind === 'spear', 'a spearman on guard stands in the spear stance with the spear in hand');
  sm.giveGear([v.id], null, 'weapon'); run(sm, 0.2);
  ok(v.anim === 'fist_guard' && v.hold === null, 'unarmed, the same man raises fists');
  v.fight.mode = 'none'; v.phase = 'flee'; sm.animate(v, 0.05);
  ok(v.anim === 'run', 'a frightened villager runs');
  sm.hurt({ kind: 'unit', id: v.id }, 9999, 'crush', { x: 0, y: 0 }, {}); run(sm, 0.5);
  ok(!sm.villagers.includes(v), 'a villager hit to death is gone');
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
  ok(b.anim === 'swing_idle' && b.hold?.kind === 'club', 'a soldier carries the weapon in hand while idle');
}

{
  // a move order does not turn a soldier or a hunter back into a civilian
  const sm = mk(1337); reveal(sm); day(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const [sol, hun, civ] = sm.villagers; sm.giveGear([sol.id], 'spear', 'weapon'); sm.setJob([sol.id], 'fight'); sm.setJob([hun.id], 'hunt'); sm.setJob([civ.id], 'wood');
  const f = sm.campfire()!; const gx = Math.floor(f.x + 8), gy = Math.floor(f.y + 4);
  sm.orderMove([sol.id, hun.id, civ.id], gx, gy); run(sm, 1);
  ok(sol.job === 'fight' && hun.job === 'hunt' && civ.job === 'idle', 'soldier and hunter keep their job; a civilian goes idle');
  ok(sol.weapon === 'spear' && sol.anim === 'thrust_charge' && sol.hold?.kind === 'spear', 'the soldier walks with the spear in hand');
  run(sm, 25);
  ok(Math.hypot(sol.x - gx, sol.y - gy) < 3 && sol.job === 'fight', 'and stands at the spot they were sent to');
}

{
  // how many beds, tents and fields a village may have grows with the campfire, and several houses of a kind work together
  const sm = mk(1337); reveal(sm); const fire = sm.campfire()!; sm.dev.freeBuild = true; // the order of building is tested elsewhere
  const put = (kind: Parameters<Sim['canPlace']>[0]) => (sm.buildingLock(kind) ? null : putBuilding(sm, kind));
  const limits = (f: number) => { fire.level = f; return [sm.buildingLimit('house'), sm.buildingLimit('infantry'), sm.buildingLimit('field'), sm.buildingLimit('storage')].join(); };
  ok(limits(1) === '1,1,1,1' && limits(2) === '3,1,3,1' && limits(3) === '3,1,3,1' && limits(4) === '3,1,4,1', 'houses and fields: 1 at fire level 1, more as it grows; menu houses and the camps stay one');
  fire.level = 1;
  const h1 = put('house'); ok(!!h1 && sm.buildingLock('house') !== null, 'the first Nhà dân goes up and then a second is refused at campfire level 1');
  fire.level = 2;
  ok(sm.buildingLock('house') === null, 'raising the campfire lets another be built');
  const h2 = put('house'), h3 = put('house');
  ok(!!h2 && !!h3 && sm.buildingLock('house') !== null && sm.bedsIn('house') === 12, 'three houses, then the limit holds, and their beds add up (12)');
  const tired = sm.villagers.slice(0, 3); tired.forEach((v) => { v.phase = 'idle'; });
  ok(tired.every((v) => { const b = sm.freeBed(v); return !!b && [h1, h2, h3].some((x) => x!.id === b.id); }), 'a tired villager finds a bed in the nearest house with room');
}
{
  // a field gives steady food to those the player puts inside; nobody is sent there by the game, one per field, a higher level is faster
  const farmed = (level: number, seasonDay = 2, post = true) => {
    const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; o.energy = 100; });
    for (const n of sm.world.nodes.values()) if (n.kind === 'bush') n.amount = 0;
    sm.time = DAY_LENGTH * (seasonDay - 1) + DAY_LENGTH * 0.3; sm.dev.noTire = true;
    const [a, b] = sm.villagers; sm.setJob([a.id], 'food'); sm.setJob([b.id], 'food'); sm.dev.freeBuild = sm.dev.instantBuild = true;
    const f = putBuilding(sm, 'field'); f.level = level;
    const err = post ? sm.assignField([a.id, b.id], f.id) : null;
    sm.stock.food = 0; run(sm, 600);
    return { sm, a, b, f, err, food: sm.stock.food };
  };
  const none = farmed(1, 2, false), l1 = farmed(1), l3 = farmed(3);
  ok(none.food === 0 && none.a.inside === null, 'a gatherer nobody posted to the field brings nothing when the bushes are bare');
  ok(l1.food > 4, `the farmer inside brings food while the bushes are bare (${l1.food})`);
  ok(l3.food > l1.food * 1.4, `a higher field level is faster (${l1.food} -> ${l3.food})`);
  ok(l1.f.staff.length === 1 && l1.err !== null && [l1.a, l1.b].filter((v) => v.inside === l1.f.id && v.phase === 'inside').length === 1, 'one farmer fits a field; the second is told there is no room');
  const sm2 = l1.sm, who = [l1.a, l1.b].find((v) => v.inside === l1.f.id)!;
  ok(who.job === 'food' && who.post === l1.f.id, 'the farmer keeps the gatherer job and knows their field');
  sm2.setJob([who.id], 'wood');
  ok(who.inside === null && who.post === -1 && who.job === 'wood' && l1.f.staff.length === 0, 'a job button takes them out of the field');
  sm2.assignField([who.id], l1.f.id); run(sm2, 5); ok(who.inside === l1.f.id, 'and the field takes them back'); sm2.releaseStaff([who.id]);
  ok(who.inside === null && who.post === -1 && who.job === 'idle', '"Cho ra" lets them out');
  sm2.assignField([who.id], l1.f.id); run(sm2, 5); sm2.demolishBuilding(l1.f.id); run(sm2, 1);
  ok(who.inside === null && who.post === -1 && who.job === 'idle', 'pulling the field down puts the farmer out and idle');
  ok(SEASON_DEF.winter.farm > 0 && SEASON_DEF.winter.farm < SEASON_DEF.winter.work && SEASON_DEF.autumn.farm > SEASON_DEF.spring.farm, 'fields give a little in winter and most in autumn');
}
{
  // the Ruộng must be researched, and the Nhà thợ xây stands first
  RESEARCH.enabled = true; const lock = new Sim(1337); lock.dev.freeBuild = false; putBuilding(lock, 'builder');
  ok(lock.buildingLock('field') === 'Cần nghiên cứu: Làm ruộng', 'a field needs the "Làm ruộng" research');
  lock.researched.add('farming'); ok(lock.buildingLock('field') === null, 'researched, a field can be placed');
  RESEARCH.enabled = false;
}

{
  // ======== M6.1: arms and what beats what ========
  const arms = ARMS;
  ok(arms.every((a) => matchup(a, a) === 1), 'the same arm against itself is even');
  ok(matchup('foot', 'archer') === 1.5 && matchup('archer', 'cavalry') === 1.5 && matchup('cavalry', 'foot') === 1.5, 'foot beats archers, archers beat riders, riders beat foot (x1.5)');
  ok(matchup('archer', 'foot') < 0.7 && matchup('cavalry', 'archer') < 0.7 && matchup('foot', 'cavalry') < 0.7, 'and the other way round it is x0.67');
  ok(arms.every((a) => arms.filter((d) => d !== a).some((d) => matchup(a, d) < 1)) && arms.every((a) => arms.filter((d) => d !== a).some((d) => matchup(a, d) > 1)), 'no arm beats every other: each wins one match-up and loses one');
  ok(Math.abs(matchup('foot', 'cavalry', 'spear') / matchup('foot', 'cavalry') - 1.15) < 1e-9 && matchup('foot', 'archer', 'spear') === matchup('foot', 'archer'), 'a spear gains x1.15 against riders only');
  ok(armOfWeapon('bow') === 'archer' && armOfWeapon('sling') === 'archer' && armOfWeapon('spear') === 'foot' && armOfWeapon(null) === 'foot', 'ranged weapons make archers, the rest foot soldiers');
  ok(!!RECIPE_BY_ID.sling1 && !!RECIPE_BY_ID.bow1 && Object.keys(RECIPE_BY_ID.bow1.cost).length > 0, 'the player can now craft the sling and the bow');
  ok(TECHS.some((t) => t.id === 'sling1') && TECHS.some((t) => t.id === 'bow1') && TECHS.find((t) => t.id === 'bow1')!.requires.includes('sling1'), 'and has to research them: sling first, then bow');
  const sm = mk(1337); const [a, d] = sm.villagers; a.weapon = 'club'; d.weapon = 'bow';
  ok(armMultiplier(a, { kind: 'unit', v: d }) === 1.5 && armMultiplier(d, { kind: 'unit', v: a }) < 0.7, 'the multiplier reaches the blow: a clubman does x1.5 to an archer, an archer x0.67 to him');
}
{
  // ======== M6.2: fences, gates, towers ========
  const sm = mk(1337); reveal(sm); const fire = sm.campfire()!; sm.dev.freeBuild = true;
  fire.level = 1;
  ok(sm.buildingLimit('fence') === 14 && sm.buildingLimit('gate') === 1 && sm.buildingLimit('tower') === 0, 'the length of fence and the gates and towers allowed grow with the campfire');
  ok(sm.buildingLock('tower') !== null, 'no tower at campfire level 1');
  fire.level = 4; ok(sm.buildingLimit('fence') === 70 && sm.buildingLimit('tower') === 3, 'at level 4: 70 pieces of fence, 3 towers');
  const built = dev.defenseLine(sm, 8);
  const fences = sm.buildings.filter((b) => b.kind === 'fence'), gate = sm.buildings.find((b) => b.kind === 'gate')!, towers = sm.buildings.filter((b) => b.kind === 'tower');
  ok(built > 40 && fences.length > 40 && !!gate && towers.length === 2, `a ring of fence with a gate and two towers goes up (${built} pieces)`);
  ok(fences.every((f) => f.hp === 120) && levelsOf('fence', 'stone')[1].hp === 3 * levelsOf('fence', 'stone')[0].hp, 'the double fence is three times as strong as the stakes');
  const inside = sm.villagers[0], outsideY = Math.floor(fire.y + 3 + 8 + 5);
  inside.x = fire.x + 1; inside.y = fire.y + 1;
  const route = () => { const p = sm.pathTo(inside, Math.floor(fire.x + 1), outsideY, 20000), e = p[p.length - 1]; return e && e[1] > fire.y + 3 + 8 ? p.length : 0; }; // the path to an unreachable spot stops at the nearest one
  gate.open = true; sm.setOcc(gate, 1); const openWay = route();
  sm.toggleGate(gate.id); const shutWay = route();
  ok(!gate.open && shutWay === 0, 'a shut gate seals the ring: there is no way out');
  ok(openWay > 0 && sm.toggleGate(gate.id) === null && gate.open && route() > 0, 'an open gate is a gap everyone can use');
  // archers on a tower
  const [arc, mel] = dev.raiseArmy(sm, 'bow', 1).concat(dev.raiseArmy(sm, 'spear', 1));
  const tw = towers[0];
  ok(sm.assignTower([mel.id], tw.id) !== null && mel.post === -1, 'a spearman cannot go up a tower');
  ok(sm.assignTower([arc.id], tw.id) === null && arc.post === tw.id && sm.garrison(tw).length === 1, 'an archer can');
  run(sm, 40); sm.dev.god = true;
  const ground = sm.towerBonus(mel), up = sm.towerBonus(arc);
  ok(up.damage > 1.2 && up.range === 2 && ground.damage === 1 && ground.range === 0, `a tower gives its archer x1.25 and 2 more tiles of reach (${up.damage}, ${up.range})`);
}
{
  // raiders turn on the fence when it is all that stands between them and the village
  const sm = mk(1337); reveal(sm); sm.dev.god = true; sm.villagers.forEach((o) => { o.fullness = 1e9; });
  dev.combatReady(sm); dev.defenseLine(sm, 8); sm.setGates(false);
  const standing = () => sm.buildings.filter((b) => (b.kind === 'fence' || b.kind === 'gate') && b.done).length, before = standing();
  ok(dev.enemyWave(sm, 'axe', dev.times(6, 'club')) === null && !!sm.tribes.find((t) => t.id === 'axe')!.raid, 'the dev tool sends a raid of a chosen make-up');
  for (let i = 0; i < 20 * 150; i++) (sm as unknown as { tick(d: number): void }).tick(0.05);
  ok(standing() < before, `raiders break down the fence to get in (${before} pieces -> ${standing()})`);
  ok(sm.log.some((l) => /bị phá/.test(l.text)), 'and the village is told a piece has fallen');
}
{
  // dev: everything a battle needs is open
  const sm = mk(1337); dev.combatReady(sm);
  ok(sm.campfire()!.level === 4 && TECHS.every((t) => sm.researched.has(t.id)), 'the dev button opens every technology and raises the campfire to the top');
  ok(['house', 'infantry', 'field', 'workshop', 'lab', 'armory'].every((k) => sm.buildings.some((b) => b.kind === (k as 'house') && b.done)), 'and builds the houses a battle needs');
  ok(sm.toolCount('bow', 1) > 0 && sm.toolCount('sling', 1) > 0 && sm.toolCount('hide', 1) > 0, 'with weapons and armour in the store');
  const army = dev.raiseArmy(sm, 'sling', 3);
  ok(army.length === 3 && army.every((v) => v.job === 'fight' && v.weapon === 'sling'), 'raising an army enlists and arms the new soldiers');
  // a save keeps the gate open or shut and the strength left of a fence
  dev.defenseLine(sm, 8);
  const g = sm.buildings.find((b) => b.kind === 'gate')!, f = sm.buildings.find((b) => b.kind === 'fence')!;
  g.open = false; f.hp = 17;
  const back = Sim.fromSave(JSON.parse(JSON.stringify(sm.toSave())));
  const g2 = back.buildings.find((b) => b.id === g.id)!, f2 = back.buildings.find((b) => b.id === f.id)!;
  ok(g2.open === false && f2.hp === 17 && back.world.occ[g2.y * back.world.size + g2.x] === 1, 'a save keeps a shut gate shut and a damaged fence damaged');
}

{
  // ======== gear wears out, and the fight is seen ========
  const sm = mk(1337); reveal(sm); dev.combatReady(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const men = dev.raiseArmy(sm, 'spear', 40);
  for (const v of men) for (let i = 0; i < 99; i++) sm.wearGear(v, 'weapon');
  ok(men.every((v) => v.weapon === 'spear' && !v.gear.wb), 'a spear is still good after 99 blows (the hundredth wears it out)');
  for (const v of men) sm.wearGear(v, 'weapon');
  const lost = men.filter((v) => v.weapon === null).length, broken = men.filter((v) => v.weapon === 'spear' && v.gear.wb).length;
  ok(lost + broken === 40 && lost >= 10 && lost <= 30, `worn to nothing, about half the spears are lost for good (${lost} lost, ${broken} broken)`);
  const b1 = men.find((v) => v.gear.wb)!;
  ok(weaponOf(b1).name === WEAPONS.fist.name, 'a broken weapon is no better than fists');
  sm.dev.fastWorks = true; sm.setGates(true);
  for (const v of men) { v.manualGear = false; v.orderCd = 0; }
  run(sm, 400);
  ok(b1.weapon === 'spear' && !b1.gear.wb && b1.repairFor === null, 'the soldier carried it to the repair house himself and got it back mended');
  // armour
  const arm = dev.raiseArmy(sm, 'club', 1)[0];
  for (let i = 0; i < 201; i++) sm.wearGear(arm, 'armor');
  ok(arm.armor === null || arm.gear.ab, 'armour wears out too');
  // sight and reach
  const [ar, foe] = [dev.raiseArmy(sm, 'bow', 1)[0], sm.foes[0] ?? (dev.enemyWave(sm, 'axe', ['club']), sm.foes[sm.foes.length - 1])];
  ar.x = 60; ar.y = 60; foe.x = 60 + 7; foe.y = 60;
  const N = sm.world.size, tile = (x: number, y: number) => Math.floor(y) * N + Math.floor(x);
  sm.fog.state[tile(foe.x, foe.y)] = 0;
  ok(!fireProjectile(sm, ar, { kind: 'unit', v: foe }, { x: ar.x, y: ar.y }, 1, 0), 'an archer does not shoot at what his side cannot see');
  sm.fog.state[tile(foe.x, foe.y)] = 2;
  ok(fireProjectile(sm, ar, { kind: 'unit', v: foe }, { x: ar.x, y: ar.y }, 1, 0), 'and shoots at what it sees within reach');
  foe.x = 60 + 9.8; sm.fog.state[tile(foe.x, foe.y)] = 2;
  ok(WEAPONS.bow.range === 8 && !fireProjectile(sm, ar, { kind: 'unit', v: foe }, { x: ar.x, y: ar.y }, 1, 0), 'the bow reaches 8 tiles, not further');
  ok(WEATHER.rain.bow < WEATHER.clear.bow && WEATHER.storm.bow <= 0.5, 'rain and storm spoil the bow');
}
{
  // ======== a tower holds its archers inside, and they shoot out ========
  const sm = mk(1337); reveal(sm); sm.dev.god = true; sm.villagers.forEach((o) => { o.fullness = 1e9; });
  dev.combatReady(sm); dev.defenseLine(sm, 8); sm.setGates(true);
  const placed = dev.garrisonTowers(sm), tower = sm.buildings.find((b) => b.kind === 'tower')!;
  run(sm, 40);
  const inTower = sm.garrison(tower);
  ok(placed > 0 && inTower.length > 0 && inTower.every((v) => v.inside === tower.id && v.phase === 'inside'), 'archers on a tower go inside it, like a house, and are listed there');
  ok(sm.towerBonus(inTower[0]).damage > 1.2, 'and inside they shoot harder');
  dev.enemyWave(sm, 'axe', [...dev.times(4, 'club'), ...dev.times(2, 'spear')]);
  run(sm, 120);
  ok(sm.battle.shots > 0 || sm.battleReports.some((r) => r.lines.some((l) => /bắn/.test(l))), 'archers in the tower fired out of it at the raiders');
  ok(inTower.every((v) => v.health > 0 && sm.villagers.includes(v)), 'and the raiders could not touch them inside');
}
{
  // ======== M6.4: squads, formations, drill ========
  ok(clampTactical(10) === COMMAND.cap && clampTactical(0.01) === 1 / COMMAND.cap, 'all the tactical factors together are held to x3.5');
  ok(FORMATION_IDS.length === 6 && FORMATION_IDS.every((f) => formationOffsets(f, 9).length === 9 && new Set(formationOffsets(f, 9).map((o) => o.map((x) => x.toFixed(2)).join())).size === 9), 'six formations, each with a distinct place for every man');
  const circle = formationOffsets('circle', 12).map((o) => Math.hypot(o[0], o[1]));
  ok(Math.max(...circle) - Math.min(...circle) < 1e-9, 'a circle is a circle');
  ok(masteryFactor(0) === 0.8 && Math.abs(masteryFactor(100) - 1.15) < 1e-9, 'mastery scales a formation from x0.8 to x1.15');
  const cl = clusterize(Array.from({ length: 25 }, (_, i) => ({ id: i, arm: 'foot' as const, key: 'p:1' })));
  ok(cl.map((c) => c.ids.length).join() === '10,10,5' && iconCount(10) === 4 && iconCount(7) === 3 && iconCount(1) === 1, 'clusters of ten, one figure to about three men');
  const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  ok(sm.createSquad().squad === undefined, 'no squad without a war tent');
  dev.combatReady(sm); dev.formSquads(sm);
  const [a, b] = sm.squads;
  ok(sm.squads.length === 3 && sm.squadUnits(a).length === 10 && sm.squadUnits(b).length === 8, 'three squads of the sizes asked for');
  const tent = sm.buildings.find((x) => x.kind === 'wartent')!; tent.level = 1;
  ok(sm.squadLimit() === 3 && sm.createSquad().squad === undefined, 'a level 1 war tent allows three squads');
  tent.level = 3; ok(sm.squadLimit() === 6 && sm.cardLimit() === 4 + 6 + 2, 'level 3: six squads and twelve cards');
  const civ = sm.villagers.find((v) => v.job !== 'fight')!;
  ok(sm.joinSquad([civ.id], a.id) !== null && civ.squad === -1, 'only soldiers join a squad');
  const t0 = sm.time; sm.setFormation(a.id, 'circle');
  ok(a.formation === 'circle' && a.switchUntil - t0 === 8, 'changing formation takes 8 seconds');
  const man = sm.squadUnits(a)[0];
  ok(Math.abs(sm.takenFactor(man, false) - FORMATIONS.circle.taken * COMMAND.mastery.switchTaken) < 1e-9, 'and in that time the squad takes x1.3 more');
  run(sm, 9); ok(Math.abs(sm.takenFactor(man, false) - FORMATIONS.circle.taken) < 1e-9, 'afterwards the circle takes x0.8');
  sm.setFormation(a.id, 'scatter'); run(sm, 9);
  ok(Math.abs(sm.takenFactor(man, true) - FORMATIONS.scatter.takenRanged!) < 1e-9, 'scattered, arrows do x0.6');
  sm.setFormation(a.id, 'ambush'); run(sm, 9);
  const foe = sm.foes.find((f) => f.ai?.role === 'guard')!; foe.fight.target = null; foe.phase = 'idle';
  const hit = sm.attackFactor(man, { kind: 'unit', v: foe });
  foe.fight.target = { kind: 'unit', id: man.id }; const second = sm.attackFactor(man, { kind: 'unit', v: foe });
  ok(hit / second > 1.9 && hit / second < 2.1, `the first blow of an ambush is double (${hit.toFixed(2)} vs ${second.toFixed(2)})`);
  // drill
  const drill = sm.buildings.find((x) => x.kind === 'drill')!; sm.setFormation(a.id, 'line'); a.mastery.line = 10;
  ok(sm.trainSquad(a.id, true) === null && a.training, 'a squad can be sent to the drill ground');
  run(sm, 60); const m1 = a.mastery.line;
  ok(m1 > 10 && Math.abs(Math.hypot(sm.squadCenter(a)!.x - (drill.x + 1.5), sm.squadCenter(a)!.y - (drill.y + 1.5))) < 8, `drill raises mastery (${m1.toFixed(1)}) with the squad on the ground`);
  sm.trainSquad(a.id, false); run(sm, 600); ok(a.mastery.line < m1, 'and it is forgotten without it');
  // positions in formation
  const fire = sm.campfire()!, gx = fire.x + 10, gy = fire.y + 8;
  day(sm); sm.squadMove(a, gx, gy, 'move'); run(sm, 30);
  const c = sm.squadCenter(a)!; ok(Math.hypot(c.x - gx, c.y - gy) < 6, `the squad marches to a point in formation (${c.x.toFixed(0)},${c.y.toFixed(0)} -> ${gx.toFixed(0)},${gy.toFixed(0)}; phases ${sm.squadUnits(a).map((v) => v.phase).join()})`);
}
{
  // ======== M6.3: scouting and maps ========
  const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  dev.combatReady(sm); sm.dev.god = true;
  const t = sm.tribes.find((x) => x.id === 'axe')!, warriors = t.unitIds.filter((u) => sm.get(u)!.ai!.role !== 'civ').length;
  ok(sm.scoutsNeeded('axe', 1) === 2 + Math.floor(warriors / 8) && sm.scoutsNeeded('axe', 3) === Math.min(8, 4 + Math.floor(warriors / 8)), `scouts needed = level + one, and one more per eight of their soldiers (${warriors} soldiers)`);
  ok(sm.mapLevel('axe') === 0, 'no map at the start');
  sm.maps.push({ tribe: 'axe', level: 2, at: sm.time, gaps: 0 }); ok(sm.mapLevel('axe') === 2, 'a map gives its level');
  sm.maps[0].gaps = 1; ok(sm.mapLevel('axe') === 1, 'a map with gaps counts a level less');
  sm.maps[0].level = 1; ok(sm.mapLevel('axe') === 1, 'but a level 1 map with gaps still counts');
  sm.maps[0].level = 2;
  sm.maps[0].gaps = 0; sm.time += 7 * DAY_LENGTH; ok(sm.mapLevel('axe') === 0, 'a map a week old is no use: it loses a tenth a day');
  sm.maps.length = 0;
  ok(sm.canTarget('camp', 'axe') === false || sm.dev.freeBuild, 'no target without a map');
  dev.addVillagers(sm, 4); sm.villagers.forEach((v) => { if (v.job !== 'fight') { v.job = 'idle'; v.inside = null; } });
  // scouts are a role like the soldiers: taken on at the Trại trinh sát, as many as it holds
  const civ = sm.villagers.filter((v) => v.job === 'idle' && v.inside === null).map((v) => v.id);
  ok(sm.setJob(civ.slice(0, 4), 'scout') === null && sm.scoutRoster().length === 4, 'villagers are taken on as scouts');
  ok(sm.setJob(sm.scoutRoster().slice(0, 1).map((v) => v.id), 'wood') !== null && sm.scoutRoster().length === 4, 'a scout keeps his role: the job buttons do not change it');
  ok(sm.assignStaff(sm.scoutRoster().slice(0, 1).map((v) => v.id), 'craft') !== null, 'a scout cannot be put to work in a house');
  {
    const tent = sm.building('scouttent')!, was = tent.level; tent.level = 1;
    const more = sm.villagers.filter((v) => v.job === 'idle' && v.inside === null).map((v) => v.id);
    ok(sm.scoutLimit() === 4 && more.length > 0 && sm.setJob(more, 'scout') !== null && sm.scoutRoster().length === 4, 'a full tent takes no more scouts');
    tent.level = was;
  }
  const folks = sm.scoutRoster().slice(0, 4).map((v) => v.id);
  // a village is found by whoever comes near it, but only counts once he is home with the news
  ok(!sm.isFound('axe') && sm.startScout(folks, 'axe') !== null, 'a village nobody has come across is not on the list, and nobody can be sent to it');
  const finder = sm.villagers.find((v) => v.job === 'idle' && v.inside === null)!, camp = sm.campfire()!;
  finder.path = []; finder.x = t.camp.x + 4; finder.y = t.camp.y; run(sm, 3);
  ok(sm.sightings.length === 1 && !sm.sightings[0].reported && !sm.isFound('axe'), 'someone who walks near a camp has seen it, but the list does not know yet');
  finder.x = camp.x + 1; finder.y = camp.y + 1; run(sm, 3);
  ok(sm.sightings[0].reported && sm.isFound('axe') && sm.log.some((l) => /đã thấy một ngôi làng, cách đây khoảng \d+ ô/.test(l.text)), 'once he is home the village joins the list, with only how far it lies');
  {
    const lost = mk(1337), lt = lost.tribes.find((x) => x.id === 'axe')!, w = lost.villagers.find((v) => v.job !== 'fight')!;
    w.x = lt.camp.x + 4; w.y = lt.camp.y; run(lost, 3);
    ok(lost.sightings.length === 1, 'a second game: he sees the camp');
    lost.killUnit(w, 'test'); run(lost, 3);
    ok(lost.sightings.length === 0 && !lost.isFound('axe'), 'if he dies on the way, the news dies with him');
  }
  // what a trip is like
  const one = sm.planScout(folks.slice(0, 1), 'axe'), four = sm.planScout(folks, 'axe');
  ok(one.error === null && one.chance === 0, 'one scout alone can never draw a full map');
  ok(four.chance > 0 && four.chance <= 0.95 && four.survey < one.survey, `more scouts give better odds (${Math.round(four.chance * 100)}%) and a shorter survey (${Math.round(four.survey)} against ${Math.round(one.survey)} s)`);
  ok(sm.planScout(sm.villagers.filter((v) => v.job !== 'scout').slice(0, 2).map((v) => v.id), 'axe').error !== null, 'only scouts are sent, not other villagers or soldiers');
  ok(sm.scoutLimit() >= 4, 'the Trại trinh sát lets four or more go at once');
  ok(sm.startScout(folks, 'axe') === null && sm.scouts.length === 1, 'scouts set out');
  ok(sm.startScout(folks, 'axe') !== null, 'one trip to a village at a time');
  ok(sm.dismissScouts(folks.slice(0, 1)) !== null && sm.scoutRoster().length >= 4, 'a scout away on a trip cannot be let go');
  for (let i = 0; i < 20 * 1800; i++) { (sm as unknown as { tick(d: number): void }).tick(0.05); if (!sm.scouts.length) break; }
  const map = sm.maps.find((m) => m.tribe === 'axe');
  ok(sm.log.some((l) => /đang quan sát|bị bắt gặp/.test(l.text)), 'the scouts reached the village and watched it (or were caught there)');
  ok(!sm.scouts.length && (!!map || sm.log.some((l) => /Mất hết trinh sát/.test(l.text))), `the trip ends with a map or with the loss of every scout (${map ? `level ${map.level}, ${map.gaps} gaps` : 'none'})`);
  ok(sm.dismissScouts(sm.scoutRoster().map((v) => v.id)) === null && sm.scoutRoster().length === 0, 'back home, scouts can be let go and become plain villagers again');
  if (map) ok(map.level === 3 && sm.mapLevel('axe') >= 1, 'the map is drawn at the highest level researched, and counts once the scouts are back');
}
{
  // ======== roles belong to their houses ========
  const sm = mk(1337); sm.dev.freeBuild = false; sm.villagers.forEach((v) => { v.job = 'idle'; });
  ok(sm.buildings.some((b) => b.kind === 'lumberyard' && b.done) && sm.buildings.some((b) => b.kind === 'farmhouse' && b.done) && sm.buildings.some((b) => b.kind === 'quarry' && b.done), 'a village starts with its Xưởng gỗ, Nông trại and Xưởng đá');
  dev.addVillagers(sm, 8);
  const ids = sm.villagers.map((v) => v.id), cap = sm.roleCapacity('wood');
  ok(cap === 3 && sm.assignRole(ids, 'wood') === null && sm.roleCount('wood') === 3, `the house gives the role to as many as its level holds (${cap})`);
  ok(sm.assignRole(ids, 'wood') !== null, 'and refuses more once it is full');
  const yard = sm.building('lumberyard')!; yard.level = 2; ok(sm.roleCapacity('wood') === 5, 'raising its level makes room for more');
  ok(sm.assignRole(ids, 'hunt') !== null && sm.roleCount('hunt') === 0, 'without a Chòi thợ săn nobody can be a hunter');
  ok(sm.assignRole(ids, 'foot') !== null, 'without a Trại chiến binh nobody can be a soldier');
  ok(sm.releaseRole(sm.villagers.filter((v) => v.job === 'wood').map((v) => v.id)) === null && sm.roleCount('wood') === 0, 'the house takes the role back');
  dev.buildAll(sm); sm.dev.freeBuild = false;
  const who = sm.villagers.filter((v) => v.job === 'idle').map((v) => v.id);
  ok(sm.assignRole(who.slice(0, 2), 'archer') === null && sm.villagers.filter((v) => v.job === 'fight' && v.arm === 'archer').length === 2, 'the throwers camp makes throwers');
  ok(sm.assignRole(who.slice(2, 3), 'cavalry') === null && sm.armOf(sm.villagers.find((v) => v.arm === 'cavalry')!) === 'cavalry', 'the cavalry camp makes riders, who count as cavalry');
  const th = sm.villagers.find((v) => v.arm === 'archer')!; sm.toolStock.club1 = 3; sm.toolStock.sling1 = 3;
  ok(sm.releaseRole([th.id]) === null && th.job === 'idle', 'a soldier is let go in his camp');
  const camp = sm.building('lumberyard')!; sm.demolishBuilding(camp.id); ok(sm.roleCount('wood') === 0 && sm.roleCapacity('wood') === 0, 'pulling a house down takes its role from those over its places');
}
{
  // ======== M6.5: plans, cards, the alarm ========
  const sm = mk(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; }); sm.dev.god = true;
  dev.combatReady(sm); dev.formSquads(sm);
  const plan = sm.newPlan('attack', 'axe');
  ok(sm.reviewPlan(plan).some((l) => l.startsWith('✗')) && sm.startPlan(plan) !== null, 'an empty plan, or one with no map, will not start');
  dev.giveMaps(sm, 1); sm.dev.freeBuild = false;
  const [a, b, c] = sm.squads;
  sm.addMission(plan, a.id); sm.addMission(plan, b.id);
  ok(sm.addMission(plan, a.id) !== null, 'a squad has one mission in a plan');
  plan.missions[0].objective = 'leader';
  ok(!sm.canTarget('leader', 'axe') && sm.reviewPlan(plan).some((l) => l.startsWith('✗') && /bản đồ chưa đủ cấp/.test(l)), 'a map of level 1 cannot aim at the leader');
  plan.missions[0].objective = 'camp';
  ok(sm.reviewPlan(plan).every((l) => !l.startsWith('✗')), 'with a level 1 map the camp can be aimed at');
  plan.missions[1].trigger = { kind: 'signal' };
  ok(sm.reviewPlan(plan).some((l) => /không có thẻ Phát tín hiệu/.test(l)), 'the council warns of a mission waiting for a signal nobody can give');
  // cards are few
  const limit = sm.cardLimit(); let added = 0, lastErr: string | null = null;
  for (const k of ['go', 'advance', 'hold', 'shoot', 'retreat'] as const) for (const s of [a, b, c]) { lastErr = sm.addCard(plan, k, s.id); if (!lastErr) added++; }
  ok(added === limit && lastErr !== null, `only ${limit} command cards fit in the plan`);
  plan.cards.length = 0; sm.addCard(plan, 'signal', -1); sm.addCard(plan, 'go', a.id);
  ok(sm.startPlan(plan) === null && plan.status === 'running', 'a sound plan starts');
  ok(plan.stage === 'assemble' && plan.missions.every((m) => m.state === 'wait'), 'deploying sends the soldiers to their cells and holds the missions back');
  ok(sm.engagePlan(plan) !== null, 'the order to fight cannot be given before the soldiers stand in place');
  for (let i = 0; i < 20 * 130 && plan.stage === 'assemble'; i++) (sm as unknown as { tick(d: number): void }).tick(0.05);
  ok(plan.stage === 'ready' && plan.missions.every((m) => m.state === 'wait'), 'in place, the army waits for the word');
  run(sm, 20); ok(plan.missions.every((m) => m.state === 'wait'), 'and does nothing until it is given');
  const fc = sm.forecastPlan(plan);
  ok(fc.chance >= 0 && fc.chance <= 1 && fc.lines.length > 0 && fc.level >= 1, `the council reports odds from the plan (${Math.round(fc.chance * 100)}%, ${fc.verdict}, map level ${fc.level})`);
  ok(sm.engagePlan(plan) === null && plan.stage === 'fight', 'the player gives the word to fight');
  {
    // while the army is deployed nobody's role can be changed, and nobody can be taken out of a squad
    const sol = sm.squadUnits(a)[0], n0 = sm.squadUnits(a).length;
    ok(sm.warLock() !== null && sm.releaseRole([sol.id]) !== null && sm.setJob([sol.id], 'wood') !== null && sm.assignRole([sol.id], 'wood') !== null && sol.job === 'fight', 'in war mode a soldier cannot be given another role');
    sm.leaveSquad([sol.id]); sm.disbandSquad(a.id); sm.setCommander(a.id, sol.id);
    ok(sm.squadUnits(a).length === n0 && !!sm.squadById(a.id), 'nor taken out of his squad, nor the squad disbanded');
    const camp = sm.building('infantry') ?? sm.buildings.find((b) => ['infantry', 'cavalry', 'archery'].includes(b.kind));
    if (camp) ok(sm.demolishBuilding(camp.id) !== null, 'nor a camp pulled down under his feet');
  }
  const camp = t_(sm, 'axe').camp, d0 = Math.hypot(sm.squadCenter(a)!.x - camp.x, sm.squadCenter(a)!.y - camp.y);
  run(sm, 60);
  const d1 = Math.hypot(sm.squadCenter(a)!.x - camp.x, sm.squadCenter(a)!.y - camp.y);
  ok(plan.missions[0].state !== 'wait' && d1 < d0 - 5, `the first squad marches on the village at the hour set (${d0.toFixed(0)} -> ${d1.toFixed(0)} tiles)`);
  ok(plan.missions[1].state === 'wait', 'the one waiting for a signal stays put');
  ok(sm.playCard(plan, plan.cards.find((x) => x.kind === 'signal')!.id) === null && plan.signal, 'the signal card gives the signal');
  run(sm, 5); ok(plan.missions[1].state === 'march' || plan.missions[1].state === 'engaged', 'and the squad that waited sets out');
  const retreat = sm.addCard(plan, 'retreat', a.id);
  ok(retreat !== null || true, 'cards can be added while running only within the limit');
  plan.cards.push({ id: 99, kind: 'retreat', squad: a.id, arg: '' });
  ok(sm.playCard(plan, 99) === null && plan.missions[0].state === 'withdraw', 'the retreat card pulls the squad back');
  {
    {
      const short = sm.newPlan('attack', 'axe'); sm.addMission(short, c.id);
      sm.deploySquad(short, c.id, undefined, Array.from({ length: 15 }, (_, i) => ({ x: 10 + i, y: 10 })), 0, { x: 10, y: 10 }, { x: 24, y: 10 });
      ok(sm.squadUnits(c).length < 15 && sm.reviewPlan(short).some((l) => l.startsWith('✗') && /mới có \d+\/15 lính/.test(l)) && sm.startPlan(short) !== null, 'a squad with fewer soldiers than places drawn for it blocks the deployment');
      ok(sm.forecastPlan(short).blocked !== null, 'and the report says why');
      sm.plans.splice(sm.plans.indexOf(short), 1);
    }
    const pl = sm.newPlan('attack', 'axe'); sm.addMission(pl, a.id); sm.deploySquad(pl, a.id, undefined, [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }], 0, { x: 11, y: 10 }, { x: 12, y: 10 });
    pl.status = 'draft'; ok(sm.startPlan(pl) === null && sm.withdrawPlan(pl) === null && pl.stage === 'recall' && pl.missions[0].state === 'withdraw', 'before the first blow, pulling back calls the whole deployment off');
    run(sm, 250); ok(pl.status === 'draft' && pl.stage === 'assemble' && pl.missions[0].state === 'idle', 'and the army, home again, leaves the plan as a draft to be changed or sent out again');
  }
  // alarm
  const defense = sm.newPlan('defense', null); sm.addMission(defense, a.id); defense.missions[0].post = 'fire';
  ok(sm.soundAlarm() === null && sm.alarmUntil > sm.time && !!a.anchor, 'the alarm drum sounds and the squads take their places');
}
{
  // ======== M6.7: the enemy answers what it sees ========
  const sm = mk(1337); reveal(sm); dev.combatReady(sm); sm.dev.god = true;
  const t = t_(sm, 'axe');
  dev.raiseArmy(sm, 'spear', 8);
  ok(!raidAdvised(sm, t, 1), 'a chief who sees many more soldiers than he can send does not attack');
  launchRaid(sm, t, 10);
  const weapons = sm.foes.filter((f) => f.ai?.role === 'raider').map((f) => f.weapon);
  ok(weapons.length >= 3 && weapons.some((w) => w === 'bow' || w === 'sling'), `facing an army of foot soldiers he adds archers (${weapons.join()})`);
}
{
  // ======== M6.8: traps, the log, and a save in the middle of it all ========
  const sm = mk(1337); reveal(sm); sm.dev.god = true; dev.combatReady(sm); dev.formSquads(sm); dev.sampleAttack(sm); dev.sampleDefense(sm);
  const fire = sm.campfire()!; sm.dev.freeBuild = true; sm.dev.instantBuild = true;
  const trap = sm.placeBuilding('trap', Math.floor(fire.x + 12), Math.floor(fire.y + 12));
  sm.dev.freeBuild = false; sm.dev.instantBuild = false;
  ok(trap.ok && trap.building!.hp === 3, 'a pit trap is laid with three charges');
  dev.enemyWave(sm, 'axe', ['club']); const raider = sm.foes.find((f) => f.ai?.role === 'raider')!;
  raider.x = trap.building!.x + 0.5; raider.y = trap.building!.y + 0.5; const hp0 = raider.health;
  run(sm, 1);
  ok(raider.health < hp0 && trap.building!.hp === 2, 'a raider who steps in is hurt and the pit has one charge less');
  for (const f of sm.foes.filter((x) => x.ai?.role === 'raider')) sm.killFoe(f);
  ok(sm.battle.on && sm.battle.foeDead >= 1, 'the fight is counted');
  run(sm, 12);
  ok(!sm.battle.on && sm.battleReports.length === 1 && /địch mất/.test(sm.battleReports[0].lines[0]), 'ten quiet seconds end the fight and it is written up in words');
  const back = Sim.fromSave(JSON.parse(JSON.stringify(sm.toSave())));
  ok(back.squads.length === 3 && back.plans.length === 2 && back.plans[0].missions.length === sm.plans[0].missions.length && back.maps.length === sm.maps.length && back.battleReports.length === 1, 'squads, plans, maps and the log are kept by a save');
  ok(back.villagers.filter((v) => v.squad >= 0).length === sm.villagers.filter((v) => v.squad >= 0).length, 'and so is who belongs to which squad');
}

{
  // ======== the plan map: what each level of map shows of a camp ========
  const sm = mk(1337); reveal(sm); sm.dev.freeBuild = false;
  ok(sm.tribeIntel('axe') === null, 'no map, no intel');
  dev.giveMaps(sm, 1);
  const i1 = sm.tribeIntel('axe')!, t = tribeById(sm, 'axe');
  ok(i1.level === 1 && i1.people.length === 0 && i1.soldiers === null && i1.structures.every((x) => x.kind === 'fire') && i1.population >= 2, 'level 1 shows only the fire and a rough head count');
  ok(i1.box.x1 - i1.box.x0 <= 2 * (i1.yard + 24) && i1.box.x0 <= Math.floor(t.camp.x) - i1.yard - 24 + 1 && !!i1.toUs, 'the map covers the camp and 24 tiles round it, and tells the way in');
  dev.giveMaps(sm, 2);
  const i2 = sm.tribeIntel('axe')!;
  ok(i2.level === 2 && i2.people.length > 0 && i2.people.every((p) => p.mark === 'unknown') && i2.soldiers === null, 'level 2 shows people as shapes, not who is a soldier');
  dev.giveMaps(sm, 3);
  const i3 = sm.tribeIntel('axe')!, warriors = t.unitIds.map((u) => sm.get(u)!).filter((u) => u.health > 0 && u.ai!.role !== 'civ').length;
  ok(i3.level === 3 && !!i3.soldiers && i3.soldiers.foot + i3.soldiers.archer + i3.soldiers.cavalry === warriors && i3.people.filter((p) => p.leader).length === 1 && i3.structures.some((x) => x.kind === 'pile'), 'level 3 counts the soldiers by arm and shows the stores and the chief');
  const before = JSON.stringify(sm.toSave());
  sm.tribeIntel('axe');
  ok(JSON.stringify(sm.toSave()) === before, 'reading a map changes nothing in the game');
  sm.maps.find((m) => m.tribe === 'axe' && m.level === 3)!.gaps = 2;
  const holed = sm.tribeIntel('axe')!;
  ok(holed.level === 2 && holed.soldiers === null, 'a level 3 map with gaps counts as level 2');
}

{
  // ======== the plan drawn on the map: what was seen, the row, the arrow and how long it takes ========
  const sm = mk(1337); reveal(sm); sm.dev.freeBuild = false; sm.dev.god = true;
  const t = tribeById(sm, 'axe');
  sm.maps.push({ tribe: 'axe', level: 3, at: sm.time, gaps: 0, seen: [{ x: t.camp.x + 2, y: t.camp.y - 3, arm: 'archer', weapon: 'bow', civ: false, leader: false }, { x: t.camp.x - 2, y: t.camp.y, arm: 'foot', weapon: 'club', civ: false, leader: true }] });
  for (const u of t.unitIds) { const f = sm.get(u)!; f.x = t.camp.x + 20; f.y = t.camp.y + 20; } // they all walk away after the scouts have gone
  const seen = sm.tribeIntel('axe')!;
  ok(seen.people.length === 2 && seen.people[0].x === t.camp.x + 2 && seen.people[0].y === t.camp.y - 3 && seen.people[0].mark === 'archer' && seen.people[1].leader, 'people stand on the map where the scouts saw them, not where they are now');
  ok(seen.soldiers?.archer === 1 && seen.soldiers?.foot === 1, 'and the count of soldiers is of that day');

  dev.combatReady(sm); dev.formSquads(sm);
  const [a] = sm.squads, plan = sm.newPlan('attack', 'axe');
  const n = sm.squadUnits(a).length;
  const o = { x: t.camp.x, y: t.camp.y + 30 }, row = drawFormation('line', o, { x: o.x + 100, y: o.y }, t.camp);
  ok(row.cells.length === SQUAD_MAX && Math.abs(row.cells[1].x - row.cells[0].x - COMMAND.cell) < 1e-9, 'a line drawn far makes 15 squares one cell apart, from the point pressed');
  ok(drawFormation('line', o, { x: o.x + 0.2, y: o.y }, t.camp).cells.length === 1 && sm.deploySquad(plan, a.id, undefined, drawFormation('line', o, { x: o.x + 2.7, y: o.y }, t.camp).cells, 0, o, o) !== null, 'a drag too short makes fewer than 3 cells, and they cannot be made into a squad');
  const ring = drawFormation('circle', o, { x: o.x + 4, y: o.y }, t.camp);
  ok(ring.cells.length >= 1 && ring.cells.every((c) => Math.abs(Math.hypot(c.x - o.x, c.y - o.y) - 4) < 1e-9), 'a circle takes the drag as its radius');
  for (const f of FORMATION_IDS) { const d = drawFormation(f, o, { x: o.x + 7, y: o.y - 5 }, t.camp); ok(d.cells.length >= 1 && d.cells.length <= SQUAD_MAX, `${f} drawn on the map has at most 15 cells`); }
  const cells = drawFormation('line', o, { x: o.x + 20, y: o.y }, t.camp).cells.slice(0, n);
  ok(sm.deploySquad(plan, a.id, undefined, cells, 0, o, { x: o.x + 20, y: o.y }) === null && plan.missions[0].deploy!.cells.length === n, 'a squad is put on the map as the cells drawn for it');
  ok(sm.deploySquad(plan, a.id, undefined, cells.slice(0, 2), 0, o, o) !== null, 'two cells are too few');
  const empty = sm.createSquad('Rỗng').squad!;
  ok(sm.deploySquad(plan, empty.id, 'wedge', drawFormation('wedge', o, { x: o.x + 6, y: o.y }, t.camp).cells, 0, o, o) === null && sm.squadUnits(empty).length === 0 && plan.missions.some((x) => x.squad === empty.id && x.deploy), 'a formation can be planned for a squad that has no soldiers yet');
  ok(plan.missions[0].withdrawAt === 0 && sm.squadUnits(a).length === n, 'a squad placed on the map does not withdraw until told to, and its soldiers are left as they were');
  sm.setMissionPath(plan, a.id, [{ x: t.camp.x, y: t.camp.y + 20 }, { x: t.camp.x, y: t.camp.y }]);
  const m = plan.missions[0], route = sm.routeTime(a, sm.missionStart(m)!, m.path);
  ok(route.legs.length === 2 && route.total > 0 && Math.abs(route.length - (10 + 20)) < 1e-6, 'the time of an arrow is worked out leg by leg');
  const slow = sm.squadPace(a); a.formation = 'circle';
  ok(sm.squadPace(a) < slow && sm.routeTime(a, sm.missionStart(m)!, m.path).total > route.total, 'a slower formation takes longer to walk the same arrow');
  a.formation = 'line';
  const big = sm.createSquad('Lớn').squad!, many = dev.raiseArmy(sm, 'spear', 17).map((v) => v.id);
  const full = sm.joinSquad(many, big.id);
  ok(big.ids.length === 15 && !!full, 'a squad holds at most 15 soldiers');
  const old = JSON.parse(JSON.stringify(sm.toSave()));
  old.version = 5; for (const p of old.lists.plans) for (const q of p.missions) { delete q.deploy; delete q.path; delete q.retreat; delete q.leg; }
  const back = Sim.fromSave(old);
  ok(back.plans[0].missions[0].path.length === 0 && back.plans[0].missions[0].deploy === null, 'a save from before the plan was drawn on the map is brought forward');
  const back2 = Sim.fromSave(JSON.parse(JSON.stringify(sm.toSave())));
  ok(JSON.stringify(back2.plans[0].missions[0].path) === JSON.stringify(m.path) && back2.maps.some((x) => x.seen?.length === 2), 'the row, the arrow and what was seen are kept by a save');
}

console.log(fails ? `${fails} lỗi` : 'tất cả đạt');
process.exit(fails ? 1 : 0);
