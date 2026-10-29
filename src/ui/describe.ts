import type { Shift } from '../sim/model';
import { BUILDINGS, needsWork } from '../sim/buildings';
import { ArmorDef } from '../sim/combat';
import { gameDays } from '../sim/constants';
import { Job, JOB_NAME, JOBS } from '../sim/jobs';
import { RES_NAME } from '../sim/resources';
import type { Sim, Villager } from '../sim/sim';


/** How well armour protects: the average of what it takes off a pierce, slash and crush blow (0..1). */
export const armorLevel = (a: ArmorDef) => (a.pierce + a.slash + a.crush) / 3;
/** A full bar is armour that stops half of every blow. */
export const ARMOR_FULL = 0.5;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const armorText = (a: ArmorDef, named = true) => `${named ? `${a.name}: ` : ''}giảm sát thương đâm ${pct(a.pierce)} · chém ${pct(a.slash)} · đập ${pct(a.crush)}`;

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
  const carry = v.carry && v.carry.amount > 0 ? ` · mang ${v.carry.amount} ${RES_NAME[v.carry.res].toLowerCase()}` : '';
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
    case 'goOrder': t = v.order?.startsWith('repair') ? 'đem đồ hỏng đi sửa' : 'đi đặt chế tạo'; break;
    case 'goEquip': t = 'đi lấy đồ ở kho'; break;
    case 'wait': t = (sim && waitReason(v, sim)) || 'chờ việc'; break;
    case 'goHome': { const bed = sim && v.target >= 0 ? sim.getBuilding(v.target) : undefined; t = bed ? `đi vào ${BUILDINGS[bed.kind].name.toLowerCase()} ngủ` : 'về lửa trại ngủ'; break; }
    case 'sleep': {
      const bed = sim && v.inside !== null ? sim.getBuilding(v.inside) : undefined, where = bed ? ` trong ${BUILDINGS[bed.kind].name.toLowerCase()}` : '';
      t = sim && sim.sleepLocked(v) ? `ngủ say${where} (hồi sức ${Math.round(v.energy)}/${v.lockUntil}%)` : `đang ngủ${where}`; break;
    }
    case 'fight': t = 'đang chiến đấu'; break;
    case 'flee': t = 'đang bỏ chạy'; break;
    case 'down': t = `bị thương, còn ${gameDays(v.down)}`; break;
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
export function energyText(sim: Sim, v: Villager): string {
  const top = Math.round(sim.maxEnergy(v));
  const parts = [`Sức <b>${Math.round(v.energy)}%</b>${top < 100 ? ` / tối đa ${top}%` : ''}`];
  if (v.strain >= 5) parts.push(`mệt mỏi tích lũy <b>${Math.round(v.strain)}</b>`);
  if (v.torch) parts.push(`đuốc còn ${Math.max(1, Math.round(v.torch.dur / 60))} phút`);
  if (sim.sleepLocked(v)) parts.push(`<b>ngủ say</b>, dậy khi đạt ${v.lockUntil}%`);
  return parts.join(' · ');
}
