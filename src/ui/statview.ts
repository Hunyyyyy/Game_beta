/** How a stat of a person is read on the screen: the same in the detail dialog and in the lists of the houses. */
import { WEAPONS } from '../sim/combat';
import { critChance, critMult, guardCut, rawValue, statValue, swingCycle } from '../sim/statsys';
import type { Villager } from '../sim/sim';
import type { Ctx } from './ctx';
import { dlg } from './gamedialog';
import { statIcon } from './resicons';

/** The eleven stats shown on a person, in the order they are listed. */
export const STAT_ORDER = ['hp', 'atk', 'defm', 'defr', 'move', 'work', 'int', 'sta', 'aspd', 'crit', 'critd'] as const;
export type StatCell = { id: (typeof STAT_ORDER)[number] };
export const STAT_LABEL: Record<StatCell['id'], string> = { hp: 'Máu', atk: 'Sức mạnh', defm: 'Phòng thủ cận chiến', defr: 'Phòng thủ tầm xa', move: 'Tốc độ di chuyển', work: 'Tốc độ làm việc', int: 'Trí tuệ', sta: 'Sức', aspd: 'Tốc đánh', crit: 'Chí mạng', critd: 'Sát thương chí mạng' };
/** A number with the digits after the point fixed (one by default), in Vietnamese form: 10,4. */
export const num = (n: number, digits = 1): string => n.toLocaleString('vi', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export type StatId = StatCell['id'];

/** What a stat is on this person: the text (one decimal), whether it is above (up) or below (down) what they were born with, and the tip. */
export function statReading(sim: Ctx['sim'], v: Villager, id: StatId): { text: string; tone: '' | 'up' | 'down'; tip: string } {
  const wid = v.gear.wb && v.gear.w === v.weapon ? 'fist' : v.weapon ?? 'fist', w = WEAPONS[wid] ?? WEAPONS.fist;
  const pen = sim.foodPenalty > 0 ? ` · cả làng yếu ${num(sim.foodPenalty * 100)}% vì thiếu ăn` : '';
  if (id === 'aspd') {
    const cycle = swingCycle(sim, v, w);
    return { text: num(1 / cycle), tone: sim.foodPenalty > 0 ? 'down' : '', tip: `${num(cycle, 2)} giây mỗi đòn với ${w.name.toLowerCase()} (đòn mỗi giây)${pen}` };
  }
  if (id === 'crit') return { text: `${num(critChance(sim, v, w) * 100)}%`, tone: '', tip: `Xác suất đòn đánh của ${w.name.toLowerCase()} thành chí mạng` };
  if (id === 'critd') return { text: `${num(critMult(sim, v, w) * 100)}%`, tone: '', tip: 'Sát thương của một đòn chí mạng so với đòn thường' };
  const val = statValue(sim, v, id), own = v.fac ? rawValue(v.fac, id) : val, tone = val > own + 0.05 ? 'up' : val < own - 0.05 ? 'down' : '';
  const reduce = id === 'defm' || id === 'defr' ? ` · giảm ${num(guardCut(sim, v, id === 'defr') * 100)}% sát thương ${id === 'defr' ? 'tầm xa' : 'cận chiến'}` : '';
  return { text: num(val), tone, tip: `${STAT_LABEL[id]}: gốc ${num(own)}${reduce}${val < own - 0.05 ? pen : ''}` };
}

/** The picture, the name and the number of a stat, as a small label. */
export function statPill(sim: Ctx['sim'], v: Villager, id: StatId): HTMLElement {
  const r = statReading(sim, v, id);
  return dlg.pill(statIcon(id), r.text, r.tone === 'up' ? 'good' : r.tone === 'down' ? 'bad' : undefined, `${STAT_LABEL[id]}: ${r.tip}`);
}
