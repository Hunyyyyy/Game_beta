/**
 * The war council's report on a plan, before the player sends the army out. It reads only the plan: our squads in it, and the enemy as the map
 * of his village describes him (the real village may have grown, weakened or changed since, and the report does not care).
 * The better the map, the more the report says and the surer it is.
 */
import { ARMORS, cycleOf, maxHpOf, ringOf, ringPower, RULES, WEAPONS } from './combat';
import type { DmgType } from './combat';
import { Arm, BEATS } from './formations';
import type { Sim } from './sim';
import type { Forecast, Plan, Villager } from './model';

/** How far off the chance may be, by map level. */
const SPREAD = [0.4, 0.35, 0.2, 0.1];
/** A stand-in soldier of the enemy: what a typical man of his tribe is (the stats of a villager are 3 to 10, the average about 6.5). */
const AVERAGE_STAT = 6.5;

/** Damage a second of a fighter with a weapon, against someone wearing `armor`. */
function dps(weapon: string | null, str: number, agi: number, armor: Record<DmgType, number> | null): number {
  const w = WEAPONS[weapon ?? 'fist'] ?? WEAPONS.fist, base = w.damage + (w.ranged ? 0 : RULES.strengthDamage * str);
  return (base * (1 - (armor ? armor[w.type] : 0))) / cycleOf(w.cycle, agi);
}

const armOf = (sim: Sim, v: Villager): Arm => sim.armOf(v);

/** How much of its worth a squad brings to the fight by what it is told to do. */
const STANCE_WEIGHT = { fight: 1, shoot: 0.8, hold: 0.5, evade: 0 };

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function forecastPlan(sim: Sim, plan: Plan): Forecast {
  const t = plan.tribe ? sim.tribes.find((x) => x.id === plan.tribe) : undefined;
  const notes = sim.reviewPlan(plan), blocked = notes.filter((l) => l.startsWith('✗')).map((l) => l.slice(2));
  const intel = plan.tribe ? sim.tribeIntel(plan.tribe) : null, level = intel ? intel.level : 0;
  const out: Forecast = { level, chance: 0, spread: SPREAD[level], verdict: '', blocked: blocked.length ? blocked.join('\n') : null, warnings: notes.filter((l) => !l.startsWith('✗')), win: [], lose: [], lines: [] };
  if (!t || !intel) { out.verdict = 'Chưa có bản đồ để lượng sức.'; return out; }

  // ---- our side: the squads in the plan, each worth what it is ordered to do
  const enemyArmor = t.def.armor ? ARMORS.hide : null;
  const enemyWeapons = t.def.weapons, enemyType = (WEAPONS[enemyWeapons[0]] ?? WEAPONS.fist).type;
  let strength = 0, count = 0, hurt = 0, bare = 0, unarmored = 0, morale = 0;
  const arms: Record<Arm, number> = { foot: 0, archer: 0, cavalry: 0 };
  const perSquad: Array<{ name: string; n: number; worth: number; arms: Record<Arm, number> }> = [];
  for (const m of plan.missions) {
    const s = sim.squadById(m.squad); if (!s) continue;
    const us = sim.squadUnits(s), w = STANCE_WEIGHT[m.stance], sa: Record<Arm, number> = { foot: 0, archer: 0, cavalry: 0 };
    let worth = 0;
    for (const v of us) {
      const armor = v.armor ? ARMORS[v.armor] ?? null : null, hp = v.health / (1 - (armor ? armor[enemyType] : 0));
      const unit = Math.sqrt(dps(v.weapon, v.stats.str, v.stats.agi, enemyArmor) * hp) * Math.min(1.1, Math.max(0.7, v.morale / 70));
      worth += unit * w; count++; sa[armOf(sim, v)]++; arms[armOf(sim, v)]++;
      if (v.health < 0.6 * v.maxHealth) hurt++;
      if (!v.weapon) bare++;
      if (!v.armor) unarmored++;
      morale += v.morale;
    }
    strength += worth; perSquad.push({ name: s.name, n: us.length, worth, arms: sa });
  }

  // ---- the enemy as the map shows him
  const ratio = t.def.warriors / Math.max(1, t.def.warriors + t.def.civilians);
  const soldiers = intel.soldiers, men = soldiers ? soldiers.foot + soldiers.archer + soldiers.cavalry : Math.max(1, Math.round((level >= 2 ? intel.people.length : intel.population) * ratio));
  const fire = sim.campfire(), ring = ringOf(Math.hypot(t.camp.x - (fire?.x ?? 0), t.camp.y - (fire?.y ?? 0))), power = ringPower(ring);
  const wAvg = enemyWeapons.map((id) => dps(id, AVERAGE_STAT, AVERAGE_STAT, null)).reduce((a, b) => a + b, 0) / enemyWeapons.length;
  const hpAvg = maxHpOf(AVERAGE_STAT) * power;
  const ourArmor = (() => { const worn = plan.missions.flatMap((m) => { const s = sim.squadById(m.squad); return s ? sim.squadUnits(s) : []; }).filter((v) => v.armor); return worn.length / Math.max(1, count); })();
  const theirUnit = Math.sqrt(wAvg * power * (1 - 0.35 * ourArmor) * hpAvg);
  const towers = intel.structures.filter((x) => x.kind === 'tower').length, fences = intel.structures.filter((x) => x.kind === 'fence').length, gates = intel.structures.filter((x) => x.kind === 'gate').length;
  const works = level >= 2 ? 1 + 0.15 * Math.min(4, towers) + 0.03 * Math.min(6, fences) + 0.04 * Math.min(2, gates) : 1;
  const chief = level >= 3 && intel.people.some((p) => p.leader) ? 1.08 : 1;
  // who beats whom, once the map says what he fields
  let match = 1;
  if (soldiers && men && count) {
    const mine = (a: Arm, b: Arm) => BEATS[a][b];
    let our = 0, their = 0;
    for (const a of Object.keys(arms) as Arm[]) for (const b of Object.keys(soldiers) as Arm[]) {
      const w = (arms[a] / count) * (soldiers[b] / men);
      our += w * mine(a, b); their += w * mine(b, a);
    }
    match = Math.sqrt(our / Math.max(0.1, their));
  }
  const theirs = men * theirUnit * works * chief, ours = strength * match;
  const R = theirs > 0 ? ours / theirs : 9;
  out.chance = count ? Math.max(0.01, Math.min(0.99, 1 / (1 + Math.exp(-3 * Math.log(Math.max(0.01, R)))))) : 0;
  const lossIfWin = R > 1 ? 1 - Math.sqrt(1 - 1 / (R * R)) : 1;

  // ---- warnings: what to think twice about
  const w = out.warnings;
  if (!count) w.push('Không có lính nào trong kế hoạch.');
  if (out.chance < 0.4 && count) w.push('Thế trận bất lợi: khả năng thua cao hơn thắng.');
  else if (out.chance < 0.6 && count) w.push('Thế trận cân bằng: một chút may rủi cũng đủ đổi kết quả.');
  if (bare) w.push(`${bare} lính chưa có vũ khí, đánh bằng tay không.`);
  if (unarmored && count > 1) w.push(`${unarmored} lính chưa có giáp.`);
  if (hurt) w.push(`${hurt} lính đang bị thương nặng.`);
  if (count && morale / count < 50) w.push('Tinh thần quân thấp, dễ bỏ chạy giữa trận.');
  const home = sim.villagers.filter((v) => v.job === 'fight' && v.health > 0 && !plan.missions.some((m) => sim.squadById(m.squad)?.ids.includes(v.id))).length;
  if (home < 3) w.push(`Chỉ còn ${home} lính giữ làng: nếu địch đánh vào lúc này thì khó chống.`);
  if (sim.resting) w.push('Đang ban đêm: quân đi chậm và nhìn kém.');
  if (sim.weather !== 'clear') w.push('Thời tiết xấu: quân đi chậm hơn.');
  if (level < 3) w.push(`Bản đồ cấp ${level}: ${level === 1 ? 'chưa biết địch có lính hay công trình phòng thủ nào' : 'chưa biết địch có bao nhiêu lính và thuộc binh chủng nào'}, nên dự báo còn thiếu chắc chắn.`);

  // ---- what is at stake
  out.win = [`Thắng khi ${t.def.name} hết lính, lửa của họ tắt và mọi công trình sập; khi đó dân của họ xin hàng.`, 'Ta lấy được những gì còn trong kho lương của họ.', `Dự kiến ta mất khoảng ${pct(lossIfWin)} số lính đã dàn trận.`];
  out.lose = ['Thua khi quân ta hết lính hoặc rút lui.', `Phần lớn lính ra trận có thể gục; lính chết là mất hẳn, cùng vũ khí và giáp mang theo.`, 'Tinh thần dân giảm; kẻ địch bị chọc giận nên có thể kéo đến trả đũa.', 'Rút kịp thì cứu được những người còn lại, nhưng chiến lợi phẩm thì không có.'];

  out.verdict = out.chance >= 0.8 ? 'Rất có lợi' : out.chance >= 0.6 ? 'Có lợi' : out.chance >= 0.4 ? 'Cân bằng' : out.chance >= 0.2 ? 'Bất lợi' : 'Rất bất lợi';

  // ---- the report, more of it with each level of the map
  const L = out.lines;
  L.push(`Quân ta: ${count} lính trong ${perSquad.length} đội${arms.archer || arms.cavalry ? ` (${arms.foot} bộ binh, ${arms.archer} bắn xa, ${arms.cavalry} kỵ)` : ''}.`);
  if (level === 1) {
    L.push(`Làng ${t.def.name} có khoảng ${intel.population} người; ước chừng ${men} có thể cầm vũ khí.`);
    L.push('Chưa rõ vũ khí, công trình phòng thủ hay thủ lĩnh: cần bản đồ cấp 2 và 3 để biết thêm.');
  } else {
    L.push(`Làng ${t.def.name}: khoảng ${intel.population} người${level >= 3 ? `, trong đó ${men} lính` : `, ước chừng ${men} có thể cầm vũ khí`}.`);
    L.push(works > 1 ? `Phòng thủ: ${towers} chòi canh, ${fences} đoạn rào, ${gates} cổng (tăng khoảng ${pct(works - 1)} sức địch).` : 'Chưa thấy công trình phòng thủ nào.');
  }
  if (level >= 3 && soldiers) {
    L.push(`Lính địch: ${soldiers.foot} bộ binh, ${soldiers.archer} cung thủ, ${soldiers.cavalry} kỵ thú${chief > 1 ? '; có thủ lĩnh đi cùng' : ''}.`);
    L.push(match > 1.05 ? 'Binh chủng của ta khắc binh chủng địch.' : match < 0.95 ? 'Binh chủng địch khắc quân ta: nên đổi đội hình.' : 'Binh chủng hai bên ngang nhau.');
    L.push(`Sức mạnh quy đổi: ta ${Math.round(ours)} so với địch ${Math.round(theirs)}.`);
    for (const q of perSquad) L.push(`${q.name}: ${q.n} lính, đóng góp ${ours > 0 ? pct((q.worth * match) / ours) : '0%'} sức mạnh của ta.`);
  }
  if (level >= 2) for (const m of plan.missions) {
    const s = sim.squadById(m.squad), start = s ? sim.missionStart(m) : null;
    if (!s || !start || !m.path.length) continue;
    const r = sim.routeTime(s, start, m.path);
    L.push(`${s.name} đi ${Math.round(r.length)} ô, mất khoảng ${Math.max(1, Math.round(r.total / 60))} phút${r.hits.some((o) => o && o.kind !== 'enemy') ? ', có đoạn vướng vật cản cần phá hoặc uốn tránh' : ''}.`);
  }
  return out;
}
