/**
 * Measures what a villager really brings in per game day (walking, carrying, sleeping, the season and the weather all included),
 * then checks the village plan against it: do the fields of each campfire level feed the people that level allows?
 *   npm run economy
 */
import { Sim } from '../src/sim/sim';
import { DAY_LENGTH } from '../src/sim/constants';
import { BUILDINGS, levelCapByFire, POP_BY_FIRE } from '../src/sim/buildings';
import { SEASON_DEF } from '../src/sim/calendar';
import { rationAt } from '../src/sim/resources';
import type { BuildingKind } from '../src/sim/buildings';
import type { WorkJob } from '../src/sim/jobs';

const SEEDS = [1337, 7, 2024];
const DAYS = 3;
/** First day of each season (the year is four seasons of 5 days). */
const SEASON_START = { spring: 1, summer: 6, autumn: 11, winter: 16 } as const;
type Season = keyof typeof SEASON_START;

interface Run { job: WorkJob; field?: 1 | 2 | 3; season: Season }

function measure(seed: number, run: Run): number {
  const sm = new Sim(seed);
  sm.fog.state.fill(2); sm.events.length = 0; sm.nextRaid = 1e9; sm.animals.length = 0; sm.animalById.clear();
  sm.villagers.forEach((v) => { v.tools.axe = { tier: 1, dur: 1e6 }; v.tools.pick = { tier: 1, dur: 1e6 }; v.tools.hoe = { tier: 1, dur: 1e6 }; });
  sm.time = DAY_LENGTH * (SEASON_START[run.season] - 1) + DAY_LENGTH * 0.25;
  let fieldId = -1;
  if (run.field) {
    for (const n of sm.world.nodes.values()) if (n.kind === 'bush') n.amount = 0; // the fields alone
    const was = { f: sm.dev.freeBuild, i: sm.dev.instantBuild }; sm.dev.freeBuild = sm.dev.instantBuild = true;
    const sp = sm.world.start;
    for (let r = 3; r < 14; r++) {
      let placed = false;
      for (let dx = -r; dx <= r && !placed; dx++) for (let dy = 3; dy <= r + 3 && !placed; dy++) if (!sm.canPlace('field' as BuildingKind, sp.x + dx * 3, sp.y + dy)) {
        const x = sm.placeBuilding('field', sp.x + dx * 3, sp.y + dy); if (x.ok) { x.building!.level = run.field; fieldId = x.building!.id; placed = true; }
      }
      if (placed) break;
    }
    sm.dev.freeBuild = was.f; sm.dev.instantBuild = was.i;
  }
  const one = sm.villagers[0]; for (const v of sm.villagers.slice(1)) v.job = 'idle';
  sm.setJob([one.id], run.job);
  if (fieldId >= 0) sm.assignField([one.id], fieldId);
  const res = { wood: 'wood', stone: 'stone', food: 'food' }[run.job as 'wood' | 'stone' | 'food'] as 'wood' | 'stone' | 'food';
  // the Kho is emptied each day, so a full store never stops the work
  const tick = (sm as unknown as { tick(d: number): void }).tick.bind(sm);
  let total = 0; sm.stock[res] = 0;
  for (let d = 0; d < DAYS; d++) {
    for (let i = 0; i < DAY_LENGTH * 20; i++) { tick(0.05); if (i % 400 === 0) { total += sm.stock[res]; sm.stock[res] = 0; } }
  }
  total += sm.stock[res] + (one.carry?.res === res ? one.carry.amount : 0);
  return total / DAYS;
}

const avg = (run: Run) => SEEDS.reduce((a, s) => a + measure(s, run), 0) / SEEDS.length;
const f1 = (n: number) => n.toFixed(1);

console.log(`Mỗi dân ăn ${rationAt(1, false)} thức ăn mỗi ngày game ở lửa cấp 1 (tăng theo cấp lửa). Số liệu: trung bình ${SEEDS.length} seed x ${DAYS} ngày, một dân cuốc/rìu gỗ.\n`);
const flat: Array<[string, Run]> = [['Đốn gỗ (mùa xuân)', { job: 'wood', season: 'spring' }], ['Đục đá (mùa xuân)', { job: 'stone', season: 'spring' }], ['Hái bụi quả (mùa hạ)', { job: 'food', season: 'summer' }]];
for (const [name, r] of flat) console.log(`${name.padEnd(24)} ${f1(avg(r)).padStart(6)} / người / ngày`);

const fieldYield: Record<1 | 2 | 3, Record<Season, number>> = { 1: {} as Record<Season, number>, 2: {} as Record<Season, number>, 3: {} as Record<Season, number> };
console.log('\nRuộng, thức ăn / nông dân / ngày:');
console.log('cấp   xuân   hạ   thu   đông   trung bình năm');
for (const lvl of [1, 2, 3] as const) {
  for (const s of Object.keys(SEASON_START) as Season[]) fieldYield[lvl][s] = avg({ job: 'food', field: lvl, season: s });
  const y = fieldYield[lvl], mean = (y.spring + y.summer + y.autumn + y.winter) / 4;
  console.log(`${lvl}     ${f1(y.spring).padStart(5)} ${f1(y.summer).padStart(5)} ${f1(y.autumn).padStart(5)} ${f1(y.winter).padStart(5)}   ${f1(mean).padStart(8)}`);
}

console.log('\nKế hoạch theo cấp Nhà chung (một lửa), ruộng nuôi bao nhiêu phần nhu cầu ăn:');
console.log('lửa  dân  ruộng x cấp   cần/ngày  có/ngày (năm)  có/ngày (đông)  đủ?');
for (let fire = 1; fire <= 4; fire++) {
  const pop = POP_BY_FIRE[fire - 1], count = BUILDINGS.field.perFire![fire - 1], lvl = Math.min(3, levelCapByFire(fire)) as 1 | 2 | 3;
  const y = fieldYield[lvl], year = (count * (y.spring + y.summer + y.autumn + y.winter)) / 4, winter = count * y.winter, need = pop * rationAt(fire, false);
  console.log(`${fire}    ${String(pop).padStart(3)}  ${count} x ${lvl}        ${f1(need).padStart(6)}    ${f1(year).padStart(8)} (${Math.round((100 * year) / need)}%)   ${f1(winter).padStart(8)} (${Math.round((100 * winter) / need)}%)  ${year >= need * 0.6 ? 'ruộng nuôi ≥ 60%' : 'THIẾU'}`);
}
void SEASON_DEF;
