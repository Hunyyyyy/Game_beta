import type { Building, BuildingKind } from '../sim/buildings';
import { workDays } from '../sim/constants';
import { fmtStat, STAT_NAME, TRAINING } from '../sim/jobs';
import type { Villager } from '../sim/model';
import { h, hint } from './dom';
import type { Ctx } from './ctx';

/**
 * The "Huấn luyện" page of a house with people in it: which stat the house trains, what it costs, how careful to be (coin spent to lose less of the stat that pays),
 * and the people of the house, each with a plus to send him off for a day or two and a minus to call him back.
 */
export class TrainPane {
  readonly root = h('div', { class: 'page' });
  private care = 1;
  private key = '';

  constructor(private readonly c: Ctx, private readonly kind: BuildingKind) {}

  update(b: Building): void {
    const { sim } = this.c, who = sim.trainees(b);
    const k = [b.id, b.level, this.care, Math.floor(sim.stock.food / 4), Math.floor(sim.stock.coin), who.map((v) => `${v.id}.${v.stats.str}.${v.stats.agi}.${v.stats.int}.${v.stats.sta}.${v.stats.vit}.${v.train ? Math.floor(v.train.left / 20) : 'w'}`).join()].join('|');
    if (k === this.key) return;
    this.key = k;
    this.root.replaceChildren(...this.render(b, who));
  }

  private again(): void { this.key = ''; this.c.ctl.onChange(); }

  private render(b: Building, who: Villager[]): Node[] {
    const { sim, toast, ctl } = this.c, info = sim.trainInfo(b);
    if (!info) return [h('p', { class: 'sub', text: 'Nhà này không huấn luyện.' })];
    const lock = sim.warLock(), care = TRAINING.care[this.care];
    const out: Node[] = [hint('Huấn luyện', `Người của nhà đi luyện một ngày hoặc hơn (chỉ số càng cao càng lâu) và không làm việc trong lúc đó. Mỗi đợt tăng ngẫu nhiên 1 đến 5% ${STAT_NAME[info.main].toLowerCase()}${info.partner ? `, ${STAT_NAME[info.partner].toLowerCase()} đi kèm tăng một nửa` : ''}; đổi lại ${STAT_NAME[info.cost].toLowerCase()} giảm, nhưng không tụt dưới 60% lúc sinh và không dưới 3. Trả lương thực và tiền khi bắt đầu; bỏ thêm tiền để giảm mức tụt. Trần của nhà cấp ${b.level} là ${info.cap}.`)];
    out.push(h('p', { class: 'sub', text: `Luyện ${STAT_NAME[info.main].toLowerCase()} · đổi lại giảm ${STAT_NAME[info.cost].toLowerCase()} · trần ${info.cap}` }));
    out.push(h('div', { class: 'btns' }, ...TRAINING.care.map((cr, i) => h('button', { class: `chip${i === this.care ? ' on' : ''}`, text: `${cr.name} (+${cr.coin} tiền, giảm ×${cr.penalty})`, title: `Chỉ số đổi lại mất ${cr.penalty} lần mức tăng`, onclick: () => { this.care = i; this.again(); } }))));
    if (!who.length) out.push(h('p', { class: 'sub', text: 'Chưa có ai trong nhà.' }));
    for (const v of who) {
      const t = v.train, cost = sim.trainCost(v.stats[info.main], this.care), full = v.stats[info.main] >= info.cap;
      const status = t ? `đang luyện, còn ${workDays(t.left)}` : full ? 'đã tới trần' : `${cost.food} lương thực + ${cost.coin + 0} tiền · ${workDays(sim.trainTime(v.stats[info.main]))}`;
      out.push(h('div', { class: 'rrow', style: 'grid-template-columns:1fr auto auto' },
        h('div', { class: 'rwho' }, h('b', { text: v.name }), h('small', { text: `${STAT_NAME[info.main]} ${fmtStat(v.stats[info.main])}/${info.cap} · ${STAT_NAME[info.cost]} ${fmtStat(v.stats[info.cost])} · ${status}` })),
        h('button', { class: 'chip', text: '⚙', title: 'Giao việc và chi tiết: công cụ, trang bị', onclick: () => { ctl.selected.clear(); ctl.selected.add(v.id); ctl.openDetail = true; ctl.closeBuilding(); } }),
        t ? h('button', { class: 'chip danger', text: '−', title: 'Gọi về làm việc (mất công đã trả)', onclick: () => { sim.cancelTraining([v.id]); this.again(); } })
          : h('button', { class: 'chip', text: '＋', title: lock ? 'Đang có chiến tranh' : full ? 'Đã tới trần của nhà này' : `Đi luyện: ${cost.food} lương thực + ${cost.coin} tiền (${care.name})`, disabled: !!lock || full,
            onclick: () => { const e = sim.startTraining([v.id], b.id, this.care); if (e) toast(e); this.again(); } })));
    }
    return [h('div', { class: 'proster', style: 'display:grid;gap:6px' }, ...out)];
  }
}
