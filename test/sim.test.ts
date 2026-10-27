import { readFileSync } from 'fs';
import { renderFrame } from '../src/character/rig.js';
import { Sim } from '../src/sim/sim';
import { DAY_LENGTH } from '../src/sim/constants';
import { Tile } from '../src/sim/world';
import { lightAt, rollWeather, seasonOf, SEASONS } from '../src/sim/calendar';
import { TIER_DURABILITY } from '../src/sim/tools';
import { levelDef, levelsOf, maxLevel } from '../src/sim/buildings';
import { ANIMALS, ARMORS, cycleOf, damageOf, MORALE, RULES, TRIBES, TRIBE_IDS, WEAPONS, zoneOf } from '../src/sim/combat';
import { swingTimes, weaponOf } from '../src/sim/battle';
import { spawnAnimal } from '../src/sim/fauna';
import type { Villager } from '../src/sim/sim';
import * as dev from '../src/sim/dev';
import { RESEARCH, TECHS } from '../src/sim/research';

RESEARCH.enabled = true; // the research tests below need it; a block near the end checks the default (off)

let fails = 0;
const ok = (c: boolean, msg: string) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
const run = (sim: Sim, secs: number) => { for (let i = 0; i < secs * 20; i++) (sim as unknown as { tick(d: number): void }).tick(0.05); };

const sim = new Sim(1337);
const w = sim.world;
ok(sim.villagers.length === 3, '3 dân ban đầu');
ok(sim.buildings.length === 1 && sim.buildings[0].done, 'Nhà chung dựng sẵn');
ok(sim.capacity('wood') === 50, 'sức chứa ban đầu 50');
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

// đặt và xây Kho
const give = sim.stock.wood; sim.stock.wood = Math.max(give, 10);
let placed = null as ReturnType<Sim['placeBuilding']> | null;
for (let dx = -6; dx <= 6 && !placed?.ok; dx++) for (let dy = -6; dy <= 6 && !placed?.ok; dy++) if (!sim.canPlace('storage', s.x + dx, s.y + dy)) placed = sim.placeBuilding('storage', s.x + dx, s.y + dy);
ok(!!placed?.ok, 'đặt được Kho');
ok(sim.stock.wood === Math.max(give, 10) - 10, 'trừ 10 gỗ khi đặt');
sim.setJob([ids[0], ids[1]], 'build');
run(sim, 120);
ok(!!placed?.building?.done, `Kho dựng xong (progress ${placed?.building?.progress.toFixed(2)})`);
ok(sim.capacity('wood') === 150, 'sức chứa tăng lên 150');

// đá
sim.setJob([ids[0], ids[1]], 'stone');
for (let k = 0; k < 4 && sim.stock.stone < 4; k++) { sim.orderMove([ids[0]], s.x + (k % 2 ? 9 : -9), s.y + (k > 1 ? 9 : -9)); run(sim, 15); sim.setJob([ids[0], ids[1]], 'stone'); run(sim, 40); }
ok(sim.stock.stone > 0, `đá về kho (${sim.stock.stone})`);

// đói: bỏ hết thức ăn, nghỉ việc
const sim2 = new Sim(7); sim2.stock.food = 0;
run(sim2, DAY_LENGTH * 3);
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
  const sm = new Sim(1337); reveal(sm);
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
  const sm = new Sim(1337); reveal(sm);
  const [a, b, c] = sm.villagers; sm.villagers.forEach((o) => { o.fullness = 1e9; });
  ok(sm.queueCraft('axe1') !== null, 'chưa có Xưởng thì không xếp đơn chế tác');
  sm.stock.wood = 40; sm.stock.stone = 20;
  const placed = (() => { for (let dx = -8; dx <= 8; dx++) for (let dy = 3; dy <= 9; dy++) if (!sm.canPlace('workshop', sm.world.start.x + dx, sm.world.start.y + dy)) return sm.placeBuilding('workshop', sm.world.start.x + dx, sm.world.start.y + dy); return null; })();
  ok(!!placed?.ok && sm.stock.wood === 25, 'đặt Xưởng tốn 15 gỗ');
  sm.setJob([a.id, b.id], 'build'); run(sm, 80);
  ok(sm.hasWorkshop(), 'Xưởng dựng xong');
  ok(sm.queueCraft('pick2') !== null && sm.queueCraft('club1') !== null, 'đồ chưa nghiên cứu thì chưa chế được');
  dev.unlockResearch(sm);
  ok(sm.queueCraft('axe1') === null && sm.queueCraft('pick2') === null, 'xếp được đơn khi có Xưởng');
  sm.setJob([c.id], 'craft'); run(sm, 60);
  ok(sm.toolCount('axe', 1) === 1 && sm.toolCount('pick', 2) === 1, `chế xong rìu gỗ và cuốc chim đá (${JSON.stringify(sm.toolStock)})`);
  ok(sm.stock.wood === 25 - 3 - 2 && sm.stock.stone === 20 - 4, `trừ nguyên liệu đúng (gỗ ${sm.stock.wood}, đá ${sm.stock.stone})`);
  sm.setJob([a.id], 'wood'); sm.setJob([b.id], 'stone'); run(sm, 40);
  ok(a.tools.axe?.tier === 1, 'dân đốn gỗ tự tới Xưởng nhận rìu gỗ');
  ok(b.tools.pick?.tier === 2, 'thợ đá nhận cuốc chim đá');
  ok(sm.toolCount('axe', 1) === 0, 'công cụ rời khỏi kho khi đã nhận');
  // đơn thiếu nguyên liệu không bị trừ; đổi nghề trả đơn
  sm.setJob([a.id, b.id], 'idle'); sm.stock.wood = 1; sm.queueCraft('axe1'); run(sm, 10);
  ok(sm.craftQueue.length === 1 && sm.stock.wood === 1, 'thiếu nguyên liệu thì đơn nằm chờ, không trừ');
  sm.stock.wood = 10; sm.setJob([c.id], 'craft'); run(sm, 5);
  ok(c.order === 'axe1' && sm.stock.wood === 7, 'thợ nhận đơn và trừ nguyên liệu');
  sm.setJob([c.id], 'idle');
  ok(c.order === null && sm.stock.wood === 10 && sm.craftQueue[0] === 'axe1', 'đổi nghề giữa chừng thì hoàn nguyên liệu và trả đơn');
  // độ bền
  a.tools.axe = { tier: 1, dur: 3 }; sm.setJob([a.id], 'wood'); run(sm, 20);
  ok(a.tools.axe === null, 'rìu hết bền thì gãy');
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
  const sm = new Sim(1337); reveal(sm); const cx = sm.world.start.x + 9, cy = sm.world.start.y + 4;
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
  const sm = new Sim(1337); reveal(sm); const cx = sm.world.start.x + 9, cy = sm.world.start.y + 4;
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
  const sm = new Sim(1337); reveal(sm); const cx = sm.world.start.x + 9, cy = sm.world.start.y + 4;
  clearArea(sm, cx, cy, 4); const mid = plant(sm, cx, cy);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) plant(sm, cx + dx, cy + dy);
  const v = sm.villagers[0]; sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.orderWork([v.id], cx, cy); run(sm, 60);
  ok(sm.world.nodes.get(mid)!.amount === 10 && sm.world.nodes.get(mid)!.workers === 0, 'cây bị vây kín không có ai giữ chỗ');
  ok(v.job === 'wood' && v.phase !== 'idle', 'dân chuyển sang cây khác, không kẹt');
}
{
  // mọi nghề tương tác đều đứng ngang
  const sm = new Sim(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const [a, b, c] = sm.villagers; sm.stock.wood = 60; sm.stock.stone = 20;
  let bad = '';
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

// ======== M3: ngày đêm, bốn mùa, thời tiết ========
const tickN = (sm: Sim, secs: number) => run(sm, secs);
{
  ok(seasonOf(1) === 'spring' && seasonOf(6) === 'summer' && seasonOf(11) === 'autumn' && seasonOf(16) === 'winter' && seasonOf(21) === 'spring', 'mỗi mùa 5 ngày, năm 20 ngày');
  const daylen = (se: typeof SEASONS[number]) => { let n = 0; for (let i = 0; i < 1000; i++) if (lightAt(i / 1000, se) >= 1) n++; return n / 1000; };
  ok(Math.abs(daylen('spring') - 0.5) < 0.01 && daylen('summer') > daylen('spring') * 1.15 && daylen('winter') < daylen('spring') * 0.85, 'mùa hạ ngày dài hơn 20%, mùa đông ngắn hơn 20%');
  ok(lightAt(0.5, 'spring') === 1 && lightAt(0, 'spring') === 0 && lightAt(0.8, 'spring') > 0 && lightAt(0.8, 'spring') < 1, 'trưa sáng, nửa đêm tối, hoàng hôn chuyển dần');
  const kinds = new Set<string>(); for (let i = 0; i < 200; i++) kinds.add(rollWeather('winter', i / 200));
  ok([...kinds].every((k) => ['clear', 'mist', 'snow'].includes(k)) && kinds.has('snow'), 'mùa đông chỉ có nắng, sương, tuyết');
}
{
  // tầm nhìn: 7 ô ban ngày, 3 ô ban đêm, sương trừ 2; lửa trại sáng 8 ô
  const sm = new Sim(1337);
  sm.time = DAY_LENGTH * 0.5; ok(sm.visionRadius() === 7, 'ban ngày nhìn 7 ô');
  sm.time = DAY_LENGTH * 1.0; ok(sm.visionRadius() === 3 && sm.fireRadius() === 8, 'ban đêm nhìn 3 ô, lửa trại vẫn 8 ô');
  sm.weather = 'mist'; ok(sm.visionRadius() === 1 && sm.fireRadius() === 6, 'sương mỏng trừ 2 ô tầm nhìn');
  // đêm: một dân ở xa lửa trại chỉ còn thấy quanh mình 3 ô
  const sm2 = new Sim(1337); reveal(sm2); sm2.villagers.forEach((o) => { o.fullness = 1e9; });
  const v = sm2.villagers[0], N = sm2.world.size;
  sm2.time = DAY_LENGTH * 0.5; sm2.orderMove([v.id], sm2.world.start.x + 20, sm2.world.start.y); tickN(sm2, 20);
  sm2.time = DAY_LENGTH * 1.0 + 1; sm2.orderMove([v.id], Math.floor(v.x), Math.floor(v.y)); tickN(sm2, 0.2);
  const at = (dx: number) => sm2.fog.state[Math.floor(v.y) * N + Math.floor(v.x) + dx];
  ok(at(2) === 2 && at(5) === 1, `ban đêm ô cách 2 còn thấy, ô cách 5 chỉ còn nhớ (${at(2)}, ${at(5)})`);
}
{
  // ngủ đêm: tối thì về lửa trại ngủ, sáng thì đi làm tiếp
  const sm = new Sim(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const ids = sm.villagers.map((o) => o.id); sm.setJob(ids, 'wood');
  const fire = sm.buildings[0];
  tickN(sm, DAY_LENGTH * 0.84 - sm.time + 10); // quá giữa hoàng hôn
  ok(sm.restTime, 'giữa hoàng hôn là giờ ngủ');
  tickN(sm, 30);
  ok(sm.villagers.every((o) => o.phase === 'sleep'), 'tối đến cả làng đi ngủ: ' + sm.villagers.map((o) => o.phase).join(','));
  ok(sm.villagers.every((o) => Math.hypot(o.x - fire.x - 1, o.y - fire.y - 1) < 4), 'ngủ quanh đống lửa');
  ok(new Set(sm.villagers.map((o) => o.bed)).size === 3, 'mỗi người một chỗ nằm');
  ok(sm.villagers.every((o) => o.job === 'wood' && !o.carry), 'vẫn giữ nghề, đồ mang theo đã cất kho');
  // ra lệnh lúc nửa đêm: dân đó thức, không quay về ngủ
  const owl = sm.villagers[0]; tickN(sm, 30);
  sm.orderMove([owl.id], fire.x + 6, fire.y + 6); tickN(sm, 10);
  ok(owl.phase !== 'sleep' && owl.phase !== 'goHome' && owl.nightOwl, 'dân được ra lệnh ban đêm thì thức');
  const wakeAt = DAY_LENGTH * (1 + 0.125 + 0.0625) + 2;
  tickN(sm, wakeAt - sm.time);
  ok(!sm.restTime && sm.villagers.every((o) => o.phase !== 'sleep'), 'sáng ra dân thức dậy');
  tickN(sm, 20);
  ok(sm.villagers.filter((o) => o.job === 'wood').every((o) => ['goNode', 'work', 'goStore', 'wait', 'idle'].includes(o.phase)), 'dân đốn gỗ đi làm lại');
}
{
  // thời tiết làm chậm bước đi
  const walked = (wk: 'clear' | 'snow' | 'drizzle') => {
    const sm = new Sim(1337); reveal(sm); sm.time = DAY_LENGTH * 0.5; sm.weather = wk;
    const v = sm.villagers[0], x0 = v.x, y0 = v.y; sm.orderMove([v.id], sm.world.start.x + 30, sm.world.start.y + 1); tickN(sm, 4);
    return Math.hypot(v.x - x0, v.y - y0);
  };
  const c = walked('clear'), sn = walked('snow'), dr = walked('drizzle');
  ok(Math.abs(sn / c - 0.75) < 0.05 && Math.abs(dr / c - 0.9) < 0.05, `tuyết đi chậm 25%, mưa nhẹ 10% (${(sn / c).toFixed(2)}, ${(dr / c).toFixed(2)})`);
}
{
  // đổi ngày thì đổi thời tiết theo đúng lịch báo trước; sang đông bụi trụi; sang xuân bụi ra quả lại
  const sm = new Sim(1337); sm.villagers.forEach((o) => { o.fullness = 1e9; });
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
  const sm = new Sim(1337); sm.villagers.forEach((o) => { o.fullness = 1e9; });
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
  const sm = new Sim(1337); const v = sm.villagers[0];
  const wf = (sm as unknown as { workFactor(v: unknown, j: string): number });
  sm.time = DAY_LENGTH * 0.5; const spring = wf.workFactor.call(sm, v, 'food');
  sm.time = DAY_LENGTH * 10.5; const autumn = wf.workFactor.call(sm, v, 'food');
  ok(Math.abs(autumn / spring - 1.4 / 0.8) < 1e-6, 'hệ số hái lượm theo mùa (xuân 0,8, thu 1,4)');
}

{
  // cấp công cụ ngay: không cần Xưởng, dân dùng được và tốc độ làm việc tăng theo bậc
  const sm = new Sim(5);
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
    const sm = new Sim(42);
    const a = sm.villagers[0];
    sm.stock.wood = 100;
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
  const sm = new Sim(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.time = DAY_LENGTH * 0.3; sm.stock.wood = 10;
  const sp = sm.world.start;
  const spot = (() => { for (let dx = -8; dx <= 8; dx++) for (let dy = 3; dy <= 9; dy++) if (!sm.canPlace('storage', sp.x + dx, sp.y + dy)) return [sp.x + dx, sp.y + dy]; return null; })()!;
  const b = sm.placeBuilding('storage', spot[0], spot[1]).building!;
  const ids = sm.villagers.map((o) => o.id); sm.setJob(ids, 'build'); run(sm, 40);
  ok(sm.upgradeBuilding(b.id)?.startsWith('Cần nghiên cứu') ?? false, 'chưa nghiên cứu thì chưa nâng cấp được');
  dev.unlockResearch(sm);
  ok(b.done && b.level === 1 && sm.capacity() === 150, `Kho cấp 1 (đơn sơ) chứa 100 (tổng ${sm.capacity()})`);
  ok(sm.upgradeBuilding(b.id) !== null && !b.upgrading, 'thiếu gỗ thì không nâng cấp được');
  sm.stock.wood = 40;
  ok(sm.upgradeBuilding(b.id) === null && b.upgrading && sm.stock.wood === 5, 'nâng cấp trả trước 35 gỗ');
  ok(sm.capacity() === 150, 'đang nâng cấp vẫn dùng sức chứa cấp cũ');
  ok(sm.upgradeBuilding(b.id) === 'Đang nâng cấp', 'không nâng chồng hai lần');
  run(sm, 60);
  ok(!b.upgrading && b.level === 2 && sm.capacity() === 300, `thợ xây nâng xong lên cấp 2 (gỗ), chứa 250 (tổng ${sm.capacity()})`);
  sm.stock.wood = 40; sm.stock.stone = 0;
  ok(sm.upgradeBuilding(b.id)?.startsWith('Thiếu đá') ?? false, 'cấp 3 (đá) cần đá');
  sm.time = DAY_LENGTH * 1.3; sm.stock.stone = 20; sm.upgradeBuilding(b.id); run(sm, 90);
  ok(b.level === 3 && sm.capacity() === 550 && sm.upgradeBuilding(b.id) === 'Đã ở cấp cao nhất', `cấp 3 chứa 500, không nâng thêm (tổng ${sm.capacity()})`);
  ok(levelDef({ kind: 'workshop', level: 3 }).craftSpeed > levelDef({ kind: 'workshop', level: 1 }).craftSpeed, 'Xưởng cấp cao chế nhanh hơn');
}

{
  // eras: buildings remember the era they were built in; an era without its own level list reuses the earlier one
  const sm = new Sim(1337);
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
  const sm = new Sim(1337);
  const by = (sp: string) => sm.animals.filter((a) => a.species === sp);
  ok(['rabbit', 'fowl', 'deer', 'boar', 'wolf', 'fish'].every((sp) => by(sp).length > 0), `all six species live on the map (${sm.animals.length} animals)`);
  ok(sm.animals.every((a) => a.species === 'fish' || dist(a, sm.world.start) >= 15), 'no land animal near the starting fire');
  ok(by('wolf').every((a) => zoneOf(dist(a, sm.world.start)) >= ANIMALS.wolf.zones[0]), 'wolves only in zone 2 and beyond');
  ok(by('fish').every((a) => sm.world.at(Math.floor(a.x), Math.floor(a.y)) === Tile.Water), 'fish live in water');
  ok(sm.villagers.map((v) => v.stats.str).join() === new Sim(1337).villagers.map((v) => v.stats.str).join(), 'same seed gives the same villagers');
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
  const sm = new Sim(1337); reveal(sm); day(sm); const c = openField(sm);
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
  const sm = new Sim(1337); reveal(sm); day(sm, 0.3); sm.villagers.forEach((o) => { o.fullness = 1e9; });
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
  const sm = new Sim(1337); reveal(sm); sm.time = DAY_LENGTH * 0.95; sm.villagers.forEach((o) => { o.fullness = 1e9; o.nightOwl = true; });
  const v = firstVillager(sm), fire = sm.campfire()!, s = sm.world.start;
  const w = spawnAnimal(sm, 'wolf', s.x - 14, s.y + 12, 7, true);
  v.x = s.x + 0.5; v.y = s.y + 14.5; sm.orderMove([v.id], s.x, s.y + 14); run(sm, 2);
  run(sm, 12);
  ok(w.state === 'attack' || v.health < v.maxHealth || v.down > 0, 'the wolf hunts a villager who is away from the fire');
  const sm2 = new Sim(1337); reveal(sm2); sm2.time = DAY_LENGTH * 0.95; sm2.villagers.forEach((o) => { o.fullness = 1e9; });
  const f2 = sm2.campfire()!, s2 = sm2.world.start, w2 = spawnAnimal(sm2, 'wolf', s2.x - 12, s2.y, 8, true);
  sm2.villagers.forEach((o) => { o.x = f2.x + 1; o.y = f2.y + 3; o.phase = 'sleep'; o.nightOwl = false; });
  let nearest = 99; for (let i = 0; i < 20 * 40; i++) { (sm2 as unknown as { tick(d: number): void }).tick(0.05); nearest = Math.min(nearest, dist(w2, { x: f2.x + 1, y: f2.y + 1 })); }
  ok(nearest > 3.5 && sm2.villagers.length === 3 && sm2.villagers.every((o) => o.down === 0), `the wolf keeps out of the firelight (closest ${nearest.toFixed(1)} tiles) and nobody falls; the camp wakes and drives it off`);
  void fire;
}

// ======== M4.3: orders, stances, downed and rescue, morale ========
const tickOnce = (sm: Sim, secs: number) => run(sm, secs);
function stage(seed = 1337) { // a village with its villagers fed, the map revealed, daytime and a clear field with one hostile foe
  const sm = new Sim(seed); reveal(sm); day(sm, 0.3); sm.villagers.forEach((o) => { o.fullness = 1e9; });
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
  // gear: workshop stock goes to fighters; armour only for fighters, from hide
  const sm = new Sim(1337); reveal(sm); day(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const s = sm.world.start; clearArea(sm, s.x + 6, s.y + 5, 3);
  (sm as unknown as { addBuilding(k: string, x: number, y: number, d: boolean): unknown }).addBuilding('workshop', s.x + 5, s.y + 4, true);
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
  const sm = new Sim(1337); reveal(sm); day(sm);
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
  const sm = new Sim(1337); reveal(sm); day(sm); const t = tribeById(sm, 'axe'); t.relation = -60;
  const v = firstVillager(sm), lead = sm.get(t.leaderId)!;
  sm.hurt({ kind: 'unit', id: lead.id }, 9999, 'crush', { x: v.x, y: v.y }, { unit: v });
  run(sm, 2);
  ok(t.state === 'surrendered' && sm.pendingTribe === 'axe', 'killing the leader makes the tribe surrender and waits for a choice');
  ok(!sm.tribeHostile('axe') && alive(sm, 'axe').every((f) => f.fight.target === null), 'a surrendered tribe stops fighting');
  const pop = sm.villagers.length, units = t.unitIds.length;
  ok(sm.diplomacy('axe', 'adopt') === null && t.state === 'adopted', 'the player can take them in');
  ok(sm.villagers.length === pop + units && sm.foes.filter((f) => f.team === 'axe').length === 0, `all ${units} people become villagers`);
  ok(sm.villagers.every((o) => o.team === 'player') && sm.pendingTribe === null, 'they are on the player team now');
}
{
  // adoption respects the population cap of 40
  const sm = new Sim(1337); reveal(sm); const t = tribeById(sm, 'axe'); t.state = 'surrendered';
  const extra = 40 - sm.villagers.length - 5;
  for (let i = 0; i < extra; i++) { const o = sm.makeVillager(sm.world.start.x, sm.world.start.y, 'm', 'player'); (sm.villagers as Villager[]).push(o); }
  sm.diplomacy('axe', 'adopt');
  ok(sm.villagers.length === 40, `the village stops at 40 people (${sm.villagers.length})`);
}
{
  // tribute: a surrendered tribe pays every season and never raids
  const sm = new Sim(1337); reveal(sm); const t = tribeById(sm, 'axe'); t.state = 'surrendered'; sm.pendingTribe = 'axe';
  ok(sm.diplomacy('axe', 'tribute') === null && t.state === 'tribute' && sm.pendingTribe === null, 'tribute can be chosen instead');
  const s0 = sm.stock.stone, f0 = sm.stock.food; sm.villagers.forEach((o) => { o.fullness = 1e9; }); sm.time = DAY_LENGTH * (sm.day + 5); run(sm, 3);
  ok(sm.stock.stone >= s0 + 10 && sm.stock.food >= f0 + 10, 'after a season the tribute arrives');
  sm.events.find((e) => e.tribe === 'axe')!.fireDay = sm.day; run(sm, DAY_LENGTH * 0.3);
  ok(t.raid === null, 'a tributary tribe does not raid');
}
{
  // holding their fire for 30 seconds, with nobody left to defend it, makes them surrender
  const sm = new Sim(1337); reveal(sm); day(sm); const t = tribeById(sm, 'axe'); t.relation = -60;
  for (const f of alive(sm, 'axe')) if (f.ai!.role !== 'civ') { f.x = t.camp.x + 40; f.y = t.camp.y; f.ai!.camp = { x: f.x, y: f.y }; }
  const v = firstVillager(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; }); v.x = t.camp.x + 0.5; v.y = t.camp.y + 3.5; sm.orderHold([v.id]);
  run(sm, 20); ok(t.state === 'free', 'still fighting on after 20 seconds');
  run(sm, 15); ok(t.state === 'surrendered', 'they give in once their fire has been held for 30 seconds');
}
{
  // morale collapse also ends it
  const sm = new Sim(1337); reveal(sm); const t = tribeById(sm, 'axe');
  for (const f of alive(sm, 'axe')) if (f.ai!.role !== 'civ') f.morale = 2;
  (sm as unknown as { moraleClock: number }).moraleClock = 0; run(sm, 3);
  ok(t.state === 'surrendered' || t.state === 'free' && alive(sm, 'axe').some((f) => f.morale > 10), 'a tribe whose warriors have lost all heart gives up');
}
{
  // the Axe tribe sends scouts; the raid is capped by the warriors it has and marches on the village
  const sm = new Sim(1337); reveal(sm); const t = tribeById(sm, 'axe'), ev = sm.events.find((e) => e.id === 'axe_scout')!;
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
  const sm = new Sim(1337); reveal(sm); const t = tribeById(sm, 'axe'), ev = sm.events.find((e) => e.id === 'axe_war')!;
  ev.fireDay = sm.day; ev.warned = true; day(sm, 0.3); run(sm, 1);
  ok(t.raid !== null && t.raid.size === 10 && ev.size === 18, `18 were planned but only ${t.raid?.size} warriors exist`);
  const sm2 = new Sim(1337); reveal(sm2); const t2 = tribeById(sm2, 'axe'); for (const u of t2.unitIds.slice(0, 8)) { sm2.removeFoe(sm2.get(u)!); } t2.unitIds = t2.unitIds.slice(8);
  const e2 = sm2.events.find((e) => e.id === 'axe_scout')!; e2.fireDay = sm2.day; e2.warned = true; day(sm2, 0.3); run(sm2, 1);
  ok(t2.raid === null, 'with fewer than three fighters left the tribe does not attack');
}
{
  // wolves: warned the day before, they arrive at night around the village and leave at dawn
  const sm = new Sim(1337); reveal(sm); const ev = sm.events.find((e) => e.id === 'wolves_summer')!;
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
  // militia: near the village a healthy woodcutter picks up a stick and fights; far from it, or frightened, they run
  const sm = new Sim(1337); reveal(sm); day(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  const t = tribeById(sm, 'axe'); t.relation = -60;
  const foe = sm.get(t.unitIds.find((u) => sm.get(u)!.ai!.role === 'guard')!)!; const fire = sm.campfire()!;
  const w = sm.villagers[0]; sm.setJob([w.id], 'wood'); w.x = fire.x + 3; w.y = fire.y + 5; w.path = [];
  foe.x = w.x + 4; foe.y = w.y; foe.ai!.camp = { x: foe.x, y: foe.y };
  run(sm, 1);
  ok(w.fight.mode === 'attack' && w.weapon === 'club' && w.job === 'wood', 'a healthy villager at home takes a club and defends, keeping their job');
  w.morale = 10; run(sm, 2);
  ok(w.phase === 'flee' || w.fleeT > 0, 'with their nerve gone the same villager runs instead');
  const far = sm.villagers[1]; sm.setJob([far.id], 'stone'); far.x = sm.world.start.x + 30; far.y = sm.world.start.y; far.path = [];
  foe.x = far.x + 4; foe.y = far.y; run(sm, 1.5);
  ok(far.phase === 'flee' && far.fight.mode === 'none', 'a villager far from home flees to the fire');
}

{
  // research opens recipes and building levels one step at a time, and goes through the craft queue
  const sm = new Sim(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.time = DAY_LENGTH * 0.3; sm.stock.wood = 200; sm.stock.stone = 200;
  const sp = sm.world.start;
  const spotFor = (kind: 'workshop' | 'storage', from = 3) => { for (let dx = -8; dx <= 8; dx++) for (let dy = from; dy <= from + 8; dy++) if (!sm.canPlace(kind, sp.x + dx, sp.y + dy)) return [sp.x + dx, sp.y + dy]; return null; };
  const [a, b, c] = sm.villagers;
  ok(sm.queueCraft('r:wood_tools') !== null, 'research needs a workshop first');
  const ws = spotFor('workshop')!; const shop = sm.placeBuilding('workshop', ws[0], ws[1]).building!;
  sm.setJob([a.id, b.id, c.id], 'build'); run(sm, 80);
  ok(shop.done, 'workshop is up');
  ok(sm.recipeOpen('axe1') && sm.recipeOpen('hammer1') && !sm.recipeOpen('pick1') && !sm.recipeOpen('mace2'), 'only the basic wood tools are open from the start');
  ok(sm.queueCraft('r:club') !== null && sm.techState(TECHS.find((t) => t.id === 'club')!).state === 'locked', 'a technology waits for the one before it');
  ok(sm.queueCraft('r:wood_tools') === null && sm.queueCraft('r:wood_tools') !== null, 'a technology can be queued once');
  const before = sm.stock.wood;
  sm.time = DAY_LENGTH * 0.3; sm.setJob([a.id, b.id], 'idle'); sm.setJob([c.id], 'craft'); run(sm, 8);
  ok(c.order === 'r:wood_tools' && sm.stock.wood === before - 8, 'the craftsman takes the research order and pays for it');
  run(sm, 120);
  ok(sm.researched.has('wood_tools') && sm.recipeOpen('pick1') && sm.recipeOpen('hoe1'), 'the research finishes and opens its recipes');
  ok(sm.queueCraft('pick1') === null, 'an opened recipe can be queued');
  ok(sm.queueCraft('r:spear') !== null, 'a spear still waits for the club and a level-2 workshop');
  sm.queueCraft('r:timber'); sm.craftQueue.splice(sm.craftQueue.indexOf('pick1'), 1); sm.time = DAY_LENGTH * 0.3; run(sm, 150);
  ok(sm.researched.has('timber'), 'timber research done');
  ok(sm.techState(TECHS.find((t) => t.id === 'stone_tools')!).why === 'Cần Xưởng cấp 2', 'stone tools need a level-2 workshop');
  ok(sm.upgradeBuilding(shop.id) === null, 'now the workshop may be upgraded to level 2');
  // an interrupted research is refunded and goes back to the queue
  sm.time = DAY_LENGTH * 0.3; sm.setJob([a.id, b.id], 'build'); run(sm, 100);
  ok(shop.level === 2, 'workshop is level 2');
  sm.queueCraft('r:stone_tools'); const w0 = sm.stock.wood; run(sm, 5);
  ok(c.order === 'r:stone_tools' && sm.stock.wood === w0 - 10, 'second step taken');
  sm.setJob([c.id], 'idle');
  ok(c.order === null && sm.stock.wood === w0 && sm.craftQueue.includes('r:stone_tools'), 'giving up mid-research refunds it and requeues');
  dev.resetResearch(sm);
  ok(!sm.recipeOpen('pick1') && sm.upgradeBuilding(shop.id) !== null, 'forgetting research locks things again');
}

{
  // demolishing and moving buildings
  const sm = new Sim(1337); reveal(sm); sm.villagers.forEach((o) => { o.fullness = 1e9; });
  sm.time = DAY_LENGTH * 0.3; sm.stock.wood = 50;
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
  ok(!st.done && st.rebuild && st.level === 1 && sm.capacity() === 50, 'it must be rebuilt and gives no space meanwhile');
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
  const sm = new Sim(1337); reveal(sm); const v = sm.villagers[0]; sm.villagers.forEach((o) => { o.fullness = 1e9; });
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
  const sm = new Sim(1337); reveal(sm);
  ok(sm.recipeOpen('mace2') && sm.recipeOpen('pick2'), 'research off: every recipe is open');
  ok(sm.queueCraft('r:timber') === 'Nghiên cứu đang tắt', 'research off: no research can be queued');
  const st = sm.buildings[0]; void st;
  RESEARCH.enabled = true;
}

console.log(fails ? `${fails} lỗi` : 'tất cả đạt');
process.exit(fails ? 1 : 0);
