import type { Shift } from '../sim/model';
import { BUILDINGS, needsWork } from '../sim/buildings';
import { ArmorDef, ARMORS, WEAPONS } from '../sim/combat';
import { TIER_NAME, TOOL_NAME, TOOL_OF_JOB } from '../sim/tools';
import type { WorkJob } from '../sim/jobs';
import { dayLength, gameDays } from '../sim/constants';
import { Job, JOB_NAME, JOBS } from '../sim/jobs';
import { RES_NAME } from '../sim/resources';
import type { Sim, Villager } from '../sim/sim';


export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const armorText = (a: ArmorDef, named = true) => `${named ? `${a.name}: ` : ''}thủ cận +${a.defm} · thủ xa +${a.defr}`;

/** The jobs of the job buttons. Soldiers are not one of them: they are recruited and discharged at the campfire. */
export const PLAIN_JOBS: Job[] = ['idle', 'wood', 'stone', 'food', 'hunt'];
export const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

/** Why a villager who was given a job is standing about, when it can be said. */
export function waitReason(v: Villager, sim: Sim): string | null {
  const j = v.job;
  if (j === 'build') return sim.buildings.some(needsWork) ? null : 'chờ: chưa có công trường nào cần xây';
  if (j === 'wood' || j === 'stone' || j === 'food') {
    const res = JOBS[j].res!;
    if (!v.carry && sim.stock[res] >= sim.capacity(res)) return `chờ: kho đầy ${RES_NAME[res].toLowerCase()}, hãy nâng cấp Kho`;
    return 'chờ: chưa thấy nguồn nào gần đó, hãy khám phá thêm';
  }
  return null;
}

/** What a villager is doing, in words. */
export function describe(v: Villager, sim?: Sim): string {
  const carry = v.carry && v.carry.amount > 0 ? ` · mang ${Math.round(v.carry.amount * 10) / 10} ${RES_NAME[v.carry.res].toLowerCase()}` : '';
  let t: string;
  switch (v.phase) {
    case 'move': t = 'đang đi'; break;
    case 'goNode': t = 'đi tới nguồn'; break;
    case 'work': t = v.job !== 'idle' ? JOB_NAME[v.job].toLowerCase() : 'rảnh'; break;
    case 'goStore': t = 'mang về kho'; break;
    case 'goSite': t = 'đi tới công trường'; break;
    case 'build': t = 'đang xây'; break;
    case 'goStaff': t = 'đi vào nhà làm việc'; break;
    case 'inside': t = v.job === 'food' ? 'đang làm ruộng' : `đang ${JOBS[v.job as 'craft'].name.toLowerCase()} trong nhà`; break;
    case 'goOrder': t = 'đi đặt chế tạo'; break;
    case 'goEquip': t = 'đi lấy đồ ở kho'; break;
    case 'wait': t = (sim && waitReason(v, sim)) || 'chờ việc'; break;
    case 'goHome': { const bed = sim && v.target >= 0 ? sim.getBuilding(v.target) : undefined; t = bed ? `đi vào ${BUILDINGS[bed.kind].name.toLowerCase()} ngủ` : 'về lửa trại ngủ'; break; }
    case 'sleep': {
      const bed = sim && v.inside !== null ? sim.getBuilding(v.inside) : undefined, where = bed ? ` trong ${BUILDINGS[bed.kind].name.toLowerCase()}` : '';
      t = sim && sim.sleepLocked(v) ? `ngủ say${where} (hồi sức ${Math.round(v.energy)}/${v.lockUntil}%)` : `đang ngủ${where}`; break;
    }
    case 'fight': t = 'đang chiến đấu'; break;
    case 'flee': t = 'đang bỏ chạy'; break;
    case 'down': t = `bị thương, còn ${gameDays(v.down, sim ? sim.dayLen : dayLength('stone'))}`; break;
    case 'goCarcass': t = 'đi lột da'; break;
    case 'skin': t = 'đang lột da'; break;
    case 'rescue': t = 'chạy đi cứu bạn'; break;
    default: t = v.job === 'idle' ? 'rảnh' : v.job === 'fight' ? 'canh gác' : v.job === 'scout' ? 'chờ lệnh trinh sát' : 'chờ việc';
  }
  return t + carry;
}


export const SHIFT_LABEL: Record<Shift, string> = { day: 'Ban ngày', night: 'Ban đêm', both: 'Cả ngày lẫn đêm' };
export const SHIFT_TIP: Record<Shift, string> = {
  day: 'Làm ban ngày, ngủ ban đêm.',
  night: 'Làm ban đêm (cần đuốc, hiệu suất 70%), ngủ ban ngày (hồi sức chậm hơn).',
  both: 'Làm cả ngày lẫn đêm, chỉ nghỉ khi sức xuống dưới 20%. Tích lũy mệt mỏi, giảm sức tối đa và hồi sức chậm.',
};

/** One line about a villager's strength: energy, the ceiling strain leaves them, the torch. */
/** Health, energy and the wear of the armour as plain "now/most" text, for the lines of a list of people. */
export function vitalsLine(sim: Sim, v: Villager): string {
  const parts = [`Máu ${Math.max(0, Math.ceil(v.health))}/${Math.round(v.maxHealth)}`, `Sức ${Math.round(v.energy)}/${Math.round(sim.maxEnergy(v))}`];
  if (v.armor && ARMORS[v.armor]?.durability) { const max = ARMORS[v.armor].durability!; parts.push(`Giáp ${Math.max(0, Math.ceil(v.gear.a === v.armor ? v.gear.ad : max))}/${max}`); }
  return parts.join(' · ');
}

export function energyText(sim: Sim, v: Villager): string {
  const top = Math.round(sim.maxEnergy(v));
  // health, energy and the wear of the armour as now / most: they climb while the person sleeps and heals, and the armour goes down with every blow taken
  const parts = [`Máu <b>${Math.max(0, Math.ceil(v.health))}/${Math.round(v.maxHealth)}</b>`, `Sức <b>${Math.round(v.energy)}/${top}</b>`];
  if (v.armor && ARMORS[v.armor]?.durability) { const max = ARMORS[v.armor].durability!; parts.push(`Giáp <b>${Math.max(0, Math.ceil(v.gear.a === v.armor ? v.gear.ad : max))}/${max}</b>`); }
  if (v.strain >= 5) parts.push(`mệt mỏi tích lũy <b>${Math.round(v.strain)}</b>`);
  if (v.torch) parts.push(`đuốc còn ${Math.max(1, Math.round(v.torch.dur / 60))} phút`);
  if (sim.sleepLocked(v)) parts.push(`<b>ngủ say</b>, dậy khi đạt ${v.lockUntil}%`);
  return parts.join(' · ');
}

/** What a person holds, in one line for a list: the weapon and the armour of one who fights, hunts or scouts (with what the armour adds), the tool of one who works. Empty when he holds nothing to tell. */
export function gearLine(v: Villager): string {
  const parts: string[] = [];
  if (v.job === 'fight' || v.job === 'hunt' || v.job === 'scout') {
    parts.push(`Vũ khí: ${v.weapon ? WEAPONS[v.weapon].name : 'tay không'}`);
    parts.push(`Giáp: ${v.armor ? armorText(ARMORS[v.armor]) : 'không'}`);
  }
  const k = TOOL_OF_JOB[v.job as WorkJob], t = k ? v.tools[k] : null;
  if (k) parts.push(`${TOOL_NAME[k]}: ${t ? `${TIER_NAME[t.tier].toLowerCase()}${t.dur <= 0 ? ' (hỏng)' : ''}` : 'tay không'}`);
  return parts.join(' · ');
}
