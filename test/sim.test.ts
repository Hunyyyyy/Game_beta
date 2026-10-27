import { Sim } from '../src/sim/sim';
import { DAY_LENGTH } from '../src/sim/constants';
import { Tile } from '../src/sim/world';
import { lightAt, rollWeather, seasonOf, SEASONS } from '../src/sim/calendar';
import { TIER_DURABILITY } from '../src/sim/tools';
import { levelDef } from '../src/sim/buildings';

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
  watch(80); sm.queueCraft('axe1'); sm.queueCraft('pick1');
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

console.log(fails ? `${fails} lỗi` : 'tất cả đạt');
process.exit(fails ? 1 : 0);
