import { Sim } from '../src/sim/sim';
import { DAY_LENGTH } from '../src/sim/constants';
import { Tile } from '../src/sim/world';

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

console.log(fails ? `${fails} lỗi` : 'tất cả đạt');
process.exit(fails ? 1 : 0);
