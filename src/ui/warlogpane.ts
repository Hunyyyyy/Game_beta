import type { ArmCount, WarRecord } from '../sim/model';
import { RES_NAME } from '../sim/resources';
import type { Res } from '../sim/resources';
import { h, hint } from './dom';
import type { Ctx } from './ctx';

const ARM: Array<[keyof ArmCount, string]> = [['foot', 'bộ'], ['archer', 'cung'], ['cavalry', 'kỵ']];
const RESULT = { won: '🏆 Thắng', lost: '☠ Thua', off: '↩ Hủy trận' } as const;

const arms = (c: ArmCount): string => ARM.map(([k, name]) => `${c[k]} ${name}`).join(', ');
const goods = (o: Partial<Record<Res, number>>): string => {
  const parts = Object.entries(o).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${Math.round(n ?? 0)} ${RES_NAME[k as Res].toLowerCase()}`);
  return parts.length ? parts.join(', ') : 'không có';
};

/** The log of the wars in the Lều họp chiến: one entry for each war, newest first. */
export class WarLogPane {
  readonly root = h('div', { class: 'page' });
  private key = '';
  constructor(private readonly c: Ctx) {}

  update(): void {
    const log = this.c.sim.warLog, k = String(log.length);
    if (k === this.key) return;
    this.key = k;
    const out: Node[] = [hint('Nhật ký trận', 'Mỗi cuộc chiến ghi lại khi kết thúc: bản đồ làng đã đánh, quân ta đưa đi và số chết theo từng loại, tài nguyên cướp được và tài nguyên tiêu hao.')];
    if (!log.length) out.push(h('p', { class: 'sub', text: 'Chưa có cuộc chiến nào.' }));
    for (const r of [...log].reverse()) out.push(this.entry(r));
    this.root.replaceChildren(...out);
  }

  private entry(r: WarRecord): HTMLElement {
    const dead = ARM.reduce((n, [k]) => n + r.dead[k], 0), sent = ARM.reduce((n, [k]) => n + r.sent[k], 0);
    return h('div', { class: 'psec' },
      h('b', { text: `${RESULT[r.result]} · ${r.name}` }),
      h('p', { class: 'sub', text: `Ngày ${r.startDay} → ${r.endDay} (${r.days.toLocaleString('vi', { maximumFractionDigits: 1 })} ngày) · bản đồ cấp ${r.mapLevel || '?'} · ${r.squads} đội` }),
      h('p', { class: 'sub', text: `Quân đã đánh: ${sent} (${arms(r.sent)})` }),
      h('p', { class: 'sub', text: `Chết: ${dead} (${arms(r.dead)})${r.supplySent ? ` · hậu cần ${r.supplyDead}/${r.supplySent}` : ''}` }),
      h('p', { class: 'sub', text: `Cướp được: ${goods(r.loot)}` }),
      h('p', { class: 'sub', text: `Tiêu hao: ${goods({ food: r.spent.food, wood: r.spent.wood, hide: r.spent.hide })}` }));
  }
}
