/**
 * The war council's report on a plan, before the player sends the army out. It reads only the plan: our squads in it, and the enemy as the map
 * of his village describes him (the real village may have grown, weakened or changed since, and the report does not care).
 * The better the map, the more the report says and the surer it is.
 */
import { ARMORS, cycleOf, maxHpOf, RULES, WEAPONS } from './combat';
import { marchOfPlan } from './warmarch';
import { packPlan } from './warsupply';
import { tentCost, tentCount } from './wartent';
import type { ArmorDef } from './combat';
import { Arm, BEATS } from './formations';
import type { Sim } from './sim';
import type { Forecast, Plan, Villager } from './model';

/** How far off the chance may be, by map level. */
const SPREAD = [0.4, 0.35, 0.2, 0.1];
/** A stand-in soldier of the enemy: what a typical man of his tribe is (the stats of a villager are 3 to 10, the average about 6.5). */
const AVERAGE_STAT = 6.5;

/** The share of a blow an armour turns aside, on top of an unarmoured person's own defence (about what the stat gives: d / (d + k)). */
function armorShare(a: ArmorDef | null, ranged: boolean): number { const d = 20 + (a ? (ranged ? a.defr : a.defm) : 0); return d / (d + 100); }

/** Damage a second of a fighter with a weapon, against someone wearing `armor`. */
function dps(weapon: string | null, str: number, agi: number, armor: ArmorDef | null): number {
  const w = WEAPONS[weapon ?? 'fist'] ?? WEAPONS.fist, base = w.damage + RULES.strengthDamage * str;
  return (base * (1 - armorShare(armor, !!w.ranged))) / cycleOf(w.cycle, agi);
}

const armOf = (sim: Sim, v: Villager): Arm => sim.armOf(v);

/** How much of its worth a squad brings to the fight by what it is told to do. */
const STANCE_WEIGHT = { fight: 1, shoot: 0.8, hold: 0.5, evade: 0 };

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function forecastPlan(sim: Sim, plan: Plan): Forecast {
  const t = plan.tribe ? sim.tribes.find((x) => x.id === plan.tribe) : undefined;
  const notes = sim.reviewPlan(plan), blocked = notes.filter((l) => l.startsWith('✗')).map((l) => l.slice(2));
  const intel = plan.tribe ? sim.tribeIntel(plan.tribe) : null, level = intel ? intel.level : 0;
  const out: Forecast = { level, chance: 0, spread: SPREAD[level], verdict: '', blocked: blocked.length ? blocked.join('\n') : null, warnings: notes.filter((l) => !l.startsWith('✗')), win: [], lose: [], lines: [], compare: [], facts: [] };
  if (!t || !intel) { out.verdict = 'Chưa có bản đồ để lượng sức.'; return out; }

  // ---- our side: the squads in the plan, each worth what it is ordered to do
  const enemyArmor = t.def.armor ? ARMORS.hide : null;
  const enemyWeapons = t.def.weapons, enemyRanged = !!(WEAPONS[enemyWeapons[0]] ?? WEAPONS.fist).ranged;
  let strength = 0, count = 0, hurt = 0, bare = 0, unarmored = 0;
  const arms: Record<Arm, number> = { foot: 0, archer: 0, cavalry: 0 };
  const perSquad: Array<{ name: string; n: number; worth: number; arms: Record<Arm, number> }> = [];
  for (const m of plan.missions) {
    const s = sim.squadById(m.squad); if (!s) continue;
    const us = sim.squadUnits(s), w = STANCE_WEIGHT[m.stance], sa: Record<Arm, number> = { foot: 0, archer: 0, cavalry: 0 };
    let worth = 0;
    for (const v of us) {
      const armor = v.armor ? ARMORS[v.armor] ?? null : null, hp = v.health / (1 - armorShare(armor, enemyRanged));
      const unit = Math.sqrt(dps(v.weapon, v.stats.str, v.stats.agi, enemyArmor) * hp);
      worth += unit * w; count++; sa[armOf(sim, v)]++; arms[armOf(sim, v)]++;
      if (v.health < 0.6 * v.maxHealth) hurt++;
      if (!v.weapon) bare++;
      if (!v.armor) unarmored++;
    }
    strength += worth; perSquad.push({ name: s.name, n: us.length, worth, arms: sa });
  }

  // ---- the enemy as the map shows him
  const ratio = t.def.warriors / Math.max(1, t.def.warriors + t.def.civilians);
  const soldiers = intel.soldiers, men = soldiers ? soldiers.foot + soldiers.archer + soldiers.cavalry : Math.max(1, Math.round((level >= 2 ? intel.people.length : intel.population) * ratio));
  const power = 1 + (t.mil ?? 0); // what the strength of the village adds to the stats of its soldiers
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

  // ---- warnings: what to think twice about (a few words each)
  const w = out.warnings;
  if (!count) w.push('Không có lính nào trong kế hoạch');
  if (bare) w.push(`${bare} lính chưa có vũ khí`);
  if (unarmored && count > 1) w.push(`${unarmored} lính chưa có giáp`);
  if (hurt) w.push(`${hurt} lính bị thương nặng`);
  const home = sim.villagers.filter((v) => v.job === 'fight' && v.health > 0 && !plan.missions.some((m) => sim.squadById(m.squad)?.ids.includes(v.id))).length;
  if (home < 3) w.push(`Chỉ ${home} lính ở lại giữ làng`);
  const pk = packPlan(sim, plan);
  if (sim.era === 'ancient') { if (!pk.sup) w.push('Không có lính hậu cần: quân sẽ đói'); else if (pk.days < plan.carryDays - 0.05) w.push(`Lương chỉ đủ ${pk.days.toFixed(1)} ngày`); }

  // ---- what is at stake
  out.win = [`Địch hết lính, lửa tắt, công trình sập → dân xin hàng`, 'Lấy kho lương của địch', `Mất khoảng ${pct(lossIfWin)} quân`];
  out.lose = ['Hết quân hoặc rút lui', 'Lính chết là mất cả vũ khí, giáp', 'Địch có thể kéo đến trả đũa'];

  out.verdict = out.chance >= 0.8 ? 'Rất có lợi' : out.chance >= 0.6 ? 'Có lợi' : out.chance >= 0.4 ? 'Cân bằng' : out.chance >= 0.2 ? 'Bất lợi' : 'Rất bất lợi';

  // ---- the details: our side against his, row by row, and the plain facts of the march
  const mr = marchOfPlan(sim, plan), nTents = tentCount(sim, plan), tc = tentCost(sim);
  out.compare.push({ label: 'Lính', ours: count, theirs: level >= 3 ? men : null });
  if (level >= 3 && soldiers) {
    out.compare.push({ label: 'Bộ binh', ours: arms.foot, theirs: soldiers.foot }, { label: 'Cung', ours: arms.archer, theirs: soldiers.archer }, { label: 'Kỵ', ours: arms.cavalry, theirs: soldiers.cavalry });
    out.compare.push({ label: 'Sức mạnh', ours: Math.round(ours), theirs: Math.round(theirs) });
  }
  if (level >= 2) out.facts.push(['Phòng thủ địch', works > 1 ? `${towers} chòi, ${fences} rào, ${gates} cổng` : 'không có']);
  if (level >= 2) {
    let longest = 0;
    for (const m of plan.missions) { const s = sim.squadById(m.squad), start = s ? sim.missionStart(m) : null; if (s && start && m.path.length) longest = Math.max(longest, sim.routeTime(s, start, m.path).total / mr.speed); }
    if (longest > 0) out.facts.push(['Đường đi', `~${Math.max(1, Math.round(longest / 60))} phút`]);
  }
  if (mr.soldiers) out.facts.push(['Đi chậm', pct(mr.slow)]);
  if (sim.era === 'ancient' && pk.sup) out.facts.push(['Lương', `${pk.days.toFixed(1)} ngày`]);
  if (sim.era === 'ancient' && nTents) out.facts.push(['Lều', `${nTents} × ${tc.wood} gỗ, ${tc.hide} da`]);
  return out;
}
