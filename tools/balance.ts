/**
 * Balance report of the stone age: what the plain path from the first day to the fall of the boss costs, from the data tables (no player is simulated).
 * Run only when asked:  npx esbuild tools/balance.ts --bundle --platform=node --outfile=dist/balance.cjs --loader:.json=json && node dist/balance.cjs
 */
import { Sim } from '../src/sim/sim';
import * as dev from '../src/sim/dev';
import { BUILDINGS, eraLocked, fireUnlockLevel, levelsOf, POP_BY_FIRE } from '../src/sim/buildings';
import type { BuildingKind } from '../src/sim/buildings';
import { dayLength, paceWork } from '../src/sim/constants';
const DAY_LENGTH = dayLength('ancient'), PACE = { work: paceWork(DAY_LENGTH) }; // the report is of the 20-minute day
import { SEASON_DEF, SEASON_DAYS } from '../src/sim/calendar';
import { RECIPES } from '../src/sim/tools';
import { STAT_TECHS, TECHS } from '../src/sim/research';
import { headcount } from '../src/sim/tribelod';
import { DIFF, popCapAt, playerCap, tierTarget } from '../src/sim/difficulty';
import { ARMORS, WEAPONS } from '../src/sim/combat';
import { rationAt } from '../src/sim/resources';
import { fireUpgradeGroups } from '../src/sim/progression';
import weather from '../src/data/weather.json';
import events from '../src/data/events.json';
import pace from '../src/data/pace.json';
import type { Res } from '../src/sim/resources';

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const days = (workSecs: number) => workSecs / PACE.work / DAY_LENGTH; // days of labour of ONE worker at factor 1
type Cost = Partial<Record<Res, number>>;
const add = (a: Cost, b: Cost, k = 1) => { for (const r of Object.keys(b) as Res[]) a[r] = (a[r] ?? 0) + (b[r] ?? 0) * k; };
const fmt = (c: Cost) => Object.entries(c).filter(([, v]) => v).map(([k, v]) => `${k} ${Math.round(v!)}`).join(', ');
const out: string[] = [];
const P = (s = '') => out.push(s);

// ---------------------------------------------------------------- time
P('# Số đo cân bằng thời đại Đồ đá\n');
P('## 1. Thời gian, mùa, thời tiết');
P(`- 1 ngày game = ${DAY_LENGTH / 60} phút thật (12 phút sáng, 8 phút đêm). 1 mùa = ${SEASON_DAYS} ngày = ${SEASON_DAYS * DAY_LENGTH / 60} phút thật; 1 năm = ${4 * SEASON_DAYS} ngày = ${4 * SEASON_DAYS * DAY_LENGTH / 3600} giờ thật.`);
P(`- "1 ngày công" = ${DAY_LENGTH * PACE.work} giây công (thời gian xây, chế tạo, nghiên cứu trong JSON tính bằng giây công của một thợ hệ số 1).`);
P('\n| Mùa | Việc ngoài trời | Hái lượm | Ruộng | Thời tiết hay gặp (hệ số làm việc kỳ vọng) |\n|---|---|---|---|---|');
const wt = weather.types as Record<string, { work: number; speed: number }>, chance = weather.chance as Record<string, Record<string, number>>;
for (const s of ['spring', 'summer', 'autumn', 'winter'] as const) {
  const d = SEASON_DEF[s], ch = chance[s];
  const w = Object.entries(ch).reduce((a, [k, p]) => a + p * wt[k].work, 0), sp = Object.entries(ch).reduce((a, [k, p]) => a + p * wt[k].speed, 0);
  P(`| ${d.name} | ×${d.work} | ×${d.gather} | ×${d.farm} | làm việc ×${w.toFixed(2)}, đi lại ×${sp.toFixed(2)} → tổng ngoài trời ≈ ×${(w * d.work).toFixed(2)} |`);
}

// ---------------------------------------------------------------- pop
P('\n## 2. Dân số, lính, thức ăn theo cấp lửa');
P('Dân đầu: 3. Mỗi ngày từ ngày 2 có 1–3 người lạ xin ở (trung bình 2), tới khi đầy sức chứa. Sức chứa = dân lửa + giường nhà dân.');
P('\n| Lửa | Dân tối đa | Ăn/dân | Ăn/lính | Cần/ngày (40% dân là lính) | Ngày tối thiểu để đủ dân (3 + 2/ngày) |\n|---|---|---|---|---|---|');
for (let L = 1; L <= 4; L++) {
  const cap = popCapAt(L), v = rationAt(L, false), s = rationAt(L, true), soldiers = Math.round(cap * 0.4);
  P(`| ${L} | ${cap} | ${v} | ${s} | ${(cap - soldiers) * v + soldiers * s} | ${Math.max(0, Math.ceil((cap - 3) / 2)) + 1} |`);
}
const pw = pace.gather as Record<string, number>;
P(`\nNăng suất danh nghĩa một người (ngày 12 phút = 720 giây sáng, tỉ lệ làm việc thật ${pace.gatherDuty}): gỗ ${f1(720 * pace.gatherDuty / pw.wood)}, đá ${f1(720 * pace.gatherDuty / pw.stone)}, hái quả ${f1(720 * pace.gatherDuty / pw.food)}, ruộng cấp 1 ${f1(720 * pace.gatherDuty / pw.farm)} mỗi ngày (chưa tính mùa/thời tiết/công cụ; số đo thật xem phần economy).`);

// ---------------------------------------------------------------- buildings
P('\n## 3. Công trình và nâng Nhà chung');
const allKinds = Object.keys(BUILDINGS) as BuildingKind[];
const openAt = (k: BuildingKind, L: number) => BUILDINGS[k].buildable && fireUnlockLevel(k) <= L && !eraLocked(k, { era: 'stone' });
const bill = (k: BuildingKind, upTo: number) => { const c: Cost = {}; let t = 0; levelsOf(k, 'stone').slice(0, upTo).forEach((lv) => { add(c, lv.cost as Cost); t += lv.buildTime; }); return { c, t }; };
P('\n| Công trình | mở ở lửa | giới hạn/lửa | Cấp 1..4: tổng chi phí | Xây+nâng đủ 4 cấp (ngày công) | slot cấp 1→4 |\n|---|---|---|---|---|---|');
for (const k of allKinds) {
  if (!BUILDINGS[k].buildable || eraLocked(k, { era: 'stone' }) && false) continue;
  const b = bill(k, 4), lv = levelsOf(k, 'stone');
  P(`| ${BUILDINGS[k].name}${eraLocked(k, { era: 'stone' }) ? ' (trung cổ)' : ''} | ${fireUnlockLevel(k)} | ${BUILDINGS[k].perFire?.join('/') ?? '1'} | ${fmt(b.c)} | ${f1(days(b.t))} | ${lv.map((l) => l.slots).join('/')} |`);
}
P('\nNâng Nhà chung (chi phí riêng) và điều kiện: mọi nhà đã mở khóa phải có ít nhất 1 cái đạt cấp đó, nhóm sản xuất đạt cấp đó.\n');
P('| Lên cấp | Chi phí lửa | Công lửa (ngày công) | Các nhà cần có (mỗi loại ≥1 ở cấp trước) | Tổng nhà+nâng tối thiểu để đủ điều kiện | Công (ngày công) |\n|---|---|---|---|---|---|');
let totalPath: Cost = {}, totalPathT = 0;
for (let L = 1; L <= 4; L++) {
  // to leave level L the village needs only the houses of its producers (fireUpgradeGroups), at level L
  const groups = fireUpgradeGroups(L), kinds = allKinds.filter((k) => groups[BUILDINGS[k].group] !== undefined), need = L;
  const c: Cost = {}; let t = 0;
  for (const k of kinds) { const b = bill(k, need); add(c, b.c); t += b.t; }
  const fireLv = levelsOf('campfire', L === 4 ? 'ancient' : 'stone')[L]; // cost of the next level
  const fc = (fireLv?.cost ?? {}) as Cost;
  P(`| ${L}→${L + 1} | ${fmt(fc)} | ${f1(days(fireLv?.buildTime ?? 0))} | ${kinds.length} loại: ${kinds.map((k) => BUILDINGS[k].name).join(', ')} | ${fmt(c)} | ${f1(days(t))} |`);
  if (L < 4) { add(totalPath, c); add(totalPath, fc); totalPathT += t + (fireLv?.buildTime ?? 0); }
}
P(`\nTổng tối thiểu lên lửa 4 (nhà ở các cấp 1..3 theo lần lượt, tính chồng nhiều lần nhà nâng — thực tế nâng tiếp nên chi phí tích lũy bằng tổng bảng ở dòng L=3 + chi phí lửa): xem dòng 3→4.`);

// ---------------------------------------------------------------- research
P('\n## 4. Nghiên cứu (thời đại Đồ đá; chưa tính nhóm chiến tranh trung cổ)');
const MEDIEVAL_ROLES = ['scout', 'basic', 'wedge', 'horns', 'scatter', 'ambush', 'march_foot', 'march_cavalry', 'march_archer', 'march_army', 'plan_foot', 'plan_cavalry', 'plan_archer']; // the war layer and the scouts: medieval
const stoneTechs = [...TECHS, ...STAT_TECHS].filter((t) => t.needLevel <= 4 && !/^(signal|form_|plan_)/.test(t.id) && !MEDIEVAL_ROLES.includes(t.unlocks.bonus?.role ?? '') && !(t.unlocks.tier && MEDIEVAL_ROLES.includes(t.unlocks.tier.role)));
type Agg = { n: number; cost: Cost; t: number };
const agg = (list: typeof stoneTechs): Agg => list.reduce((a, t) => { a.n++; add(a.cost, t.cost as Cost); a.t += t.time; return a; }, { n: 0, cost: {} as Cost, t: 0 });
const roleOf = (t: (typeof stoneTechs)[number]) => t.unlocks.bonus?.role ?? (t.unlocks.tier ? `tier:${t.unlocks.tier.role}` : t.unlocks.recipes ? 'công thức' : 'khác');
const roles = [...new Set(stoneTechs.map(roleOf))];
P('| Nhóm | số mục | chi phí | công (ngày công) | cấp Nhà nghiên cứu cần |\n|---|---|---|---|---|');
for (const r of roles) {
  const l = stoneTechs.filter((t) => roleOf(t) === r), a = agg(l), lv = [...new Set(l.map((t) => t.needLevel))].sort().join('/');
  P(`| ${r} | ${a.n} | ${fmt(a.cost)} | ${f1(days(a.t))} | ${lv} |`);
}
const mil = agg(stoneTechs.filter((t) => ['foot', 'cavalry', 'archer', 'guard', 'towerman', 'tier:foot', 'tier:cavalry', 'tier:archer'].includes(roleOf(t))));
const eco = agg(stoneTechs.filter((t) => ['wood', 'stone', 'food', 'hunt', 'tame', 'build', 'craft', 'research', 'axe', 'pick', 'hoe', 'hammer'].includes(roleOf(t))));
const all = agg(stoneTechs);
P(`\n- Quân (bộ binh, kỵ, cung, lính gác, lính chòi): ${mil.n} mục, ${fmt(mil.cost)}, ${f1(days(mil.t))} ngày công.`);
P(`- Kinh tế + công cụ: ${eco.n} mục, ${fmt(eco.cost)}, ${f1(days(eco.t))} ngày công.`);
P(`- Tất cả: ${all.n} mục, ${fmt(all.cost)}, ${f1(days(all.t))} ngày công. Nhà nghiên cứu: ${levelsOf('lab', 'stone').map((l) => l.slots).join('/')} người/cấp, craftSpeed ${levelsOf('lab', 'stone').map((l) => l.craftSpeed).join('/')} → thời gian thật = ngày công ÷ (số nhà nghiên cứu × craftSpeed × hiệu suất mùa/đêm).`);

// ---------------------------------------------------------------- crafting
P('\n## 5. Chế tạo (công cụ, vũ khí, giáp, đuốc)');
P('| Id | Loại | Chi phí | Thời gian (ngày công) |\n|---|---|---|---|');
for (const r of RECIPES) P(`| ${r.id} | ${r.kind} | ${fmt(r.cost as Cost)} | ${f1(days(r.time))} |`);
const wk = levelsOf('workshop', 'stone');
P(`\nNhà chế tạo: craftSpeed ${wk.map((l) => l.craftSpeed).join('/')}, ${wk.map((l) => l.slots).join('/')} thợ theo cấp.`);
for (const n of [20, 40, 60, 100]) {
  const w = WEAPONS.spear, a = ARMORS.hide, c: Cost = {}; add(c, (RECIPES.find((r) => r.id === 'spear1')?.cost ?? w.cost ?? {}) as Cost, n); add(c, (RECIPES.find((r) => r.id === 'hide1')?.cost ?? a.cost ?? {}) as Cost, n); add(c, { wood: 2 }, n);
  const t = n * ((RECIPES.find((r) => r.id === 'spear1')?.time ?? 0) + (RECIPES.find((r) => r.id === 'hide1')?.time ?? 0) + 12);
  P(`- ${n} lính (giáo + giáp da + đuốc): ${fmt(c)}; ${f1(days(t))} ngày công thợ (chia cho số thợ × craftSpeed).`);
}

// ---------------------------------------------------------------- enemies and events
P('\n## 6. Kẻ thù: quy mô quân theo cấp lửa của người chơi');
P('Số lính/dân của mỗi làng cố định theo cấp trại của nó (random lúc tạo thế giới); SỨC MẠNH tổng được co giãn theo cấp lửa của ta bằng % chỉ số cho từng lính (làng mạnh lên qua % chỉ số, không thêm lính). Giá trị 1 lính ta = giá trị khi nghiên cứu hết chỉ số mở được ở Nhà nghiên cứu cấp = cấp lửa (không tính vũ khí/giáp).');
P('| Lửa ta | Dân tối đa ta | Trần quân ta | Giá trị 1 lính ta | Làng | cấp trại | lính | dân | mục tiêu quân | %chỉ số/lính | số lính ta cần để ngang |\n|---|---|---|---|---|---|---|---|---|---|---|');
const sim0 = new Sim(1337);
for (let L = 1; L <= 4; L++) {
  const cap = playerCap(L), soldiers = popCapAt(L) * DIFF.militaryShare, one = cap.military / soldiers;
  for (const t of sim0.tribes) {
    const hc = headcount(sim0, t), tgt = tierTarget(L, t.tier), mil = hc.guards > 0 ? Math.cbrt(tgt.military / hc.guards) - 1 : 0;
    P(`| ${L} | ${popCapAt(L)} | ${f1(cap.military)} | ${f1(one)} | ${t.def.name}${t.boss ? ' **BOSS**' : ''} | ${t.campLevel} | ${hc.guards} | ${hc.civs} | ${f1(tgt.military)} | +${Math.round(mil * 100)}% | ${Math.ceil(tgt.military / one)} |`);
  }
}
const camps = [BUILDINGS.infantry, BUILDINGS.archery, BUILDINGS.cavalry, BUILDINGS.guardpost];
P(`\nChỗ lính tối đa của ta ở cấp 4: bộ binh/cung/kỵ/gác = ${camps.map((b) => b.levels.stone![3].slots).join('/')} = ${camps.reduce((a, b) => a + b.levels.stone![3].slots, 0)}; mỗi làng thu nạp/tiêu diệt thêm ${DIFF.capture.campSlots} chỗ cho MỖI trại.`);
P('\n### Sự kiện theo lịch (events.json)');
P('| Id | Loại | Ngày | Mùa/năm | Quân | Ban đêm | Báo trước |\n|---|---|---|---|---|---|---|');
const seasonOf = (d: number) => { const y = Math.floor((d - 1) / 20) + 1, s = Math.floor(((d - 1) % 20) / 5); return `${['Xuân', 'Hạ', 'Thu', 'Đông'][s]} năm ${y}`; };
for (const e of events.events as Array<{ id: string; kind: string; tribe?: string; species?: string; day: number; spread: number; size?: number; army?: Record<string, number>; night: boolean; warnDays?: number }>) {
  P(`| ${e.id} | ${e.kind}${e.tribe ? ` (${e.tribe})` : e.species ? ` (${e.species})` : ''} | ${e.day}–${e.day + e.spread} | ${seasonOf(e.day)} | ${e.army ? Object.values(e.army).reduce((a, b) => a + b, 0) : e.size} | ${e.night ? 'đêm' : 'ngày'} | ${e.warnDays ?? 1} ngày |`);
}

console.log(out.join('\n'));
void POP_BY_FIRE;
