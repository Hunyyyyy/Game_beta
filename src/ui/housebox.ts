import { Building, levelDef } from '../sim/buildings';
import { workDays } from '../sim/constants';
import { fmtStat, isStaffJob, JOB_NAME, JOBS, STAT_NAME } from '../sim/jobs';
import type { Villager } from '../sim/sim';
import { h, hint } from './dom';
import { dlg } from './gamedialog';
import { detailButton, personTile, roleStats } from './people';
import type { Ctx } from './ctx';

// ================================================================== a building tapped on the map or chosen from the menu
/** The villagers working inside a house: names, a way out, and a list to choose who goes in next. */
export class StaffBox {
  readonly root = h('section', {});
  private readonly head = h('div'); private readonly list = h('div'); private readonly picker = h('div', { class: 'picker' });
  private key = ''; private pickKey = ''; private open = false;
  private readonly add: HTMLButtonElement;
  constructor(private readonly c: Ctx, private readonly job: 'craft' | 'research' | 'tame' | 'build' | 'farm') {
    this.add = h('button', { class: 'sm primary', onclick: () => { this.open = !this.open; this.pickKey = ''; c.ctl.onChange(); } }) as HTMLButtonElement;
    this.root.append(hint(this.head, job === 'build' ? 'Chỉ thợ xây của nhà này mới dựng và nâng cấp được công trình. Bạn chọn ai làm thợ xây: bấm "Thêm người" rồi chọn trong danh sách.' : job === 'farm' ? 'Ruộng cho thức ăn đều quanh năm, ít nhất vào mùa đông, còn bụi quả thì không mọc lại. Dân bạn chọn vào ruộng làm việc bên trong, thức ăn về thẳng kho. Mỗi ruộng một người, ruộng cấp cao hơn làm nhanh hơn.' : 'Dân vào trong nhà làm việc, không hiện trên bản đồ và không bị tấn công. Bạn chọn ai vào: bấm "Thêm người" rồi chọn trong danh sách.'), this.list, h('div', { class: 'btns' }, this.add), this.picker);
  }
  update(b: Building): void {
    const { sim } = this.c, slots = levelDef(b).slots, jobKey = this.job === 'farm' ? 'food' : this.job, stat = JOBS[jobKey].stat, label = this.job === 'farm' ? 'Nông dân' : JOB_NAME[this.job];
    const crew = this.job === 'build', staff = crew ? sim.crew() : b.staff.map((id) => sim.get(id)).filter((v): v is Villager => !!v);
    const count = crew ? staff.length : sim.staffCount(b), full = count >= slots;
    this.head.replaceChildren(h('div', { class: 'dhouse' }, h('b', { text: crew ? 'Thợ xây' : this.job === 'farm' ? 'Nông dân' : 'Người làm việc' }), dlg.slots(count, slots), h('small', { class: 'dsub', text: 'nâng cấp nhà để chứa thêm' })));
    this.add.disabled = full && !this.open;
    this.add.textContent = this.open ? 'Xong' : `Thêm người ${label.toLowerCase()}`;
    const key = `${b.id}|${staff.map((v) => `${v.id}.${v.stats[stat]}`).join()}`;
    if (key !== this.key) {
      this.key = key;
      this.list.replaceChildren(...(staff.length ? [dlg.list(...staff.map((v) => personTile(this.c, v, { note: '', stats: roleStats(this.job), actions: [
        detailButton(this.c, v),
        dlg.button('−', () => { if (crew) sim.releaseCrew([v.id]); else sim.releaseStaff([v.id]); this.c.ctl.onChange(); }, { icon: true, tone: 'bad', title: crew ? 'Cho nghỉ' : 'Cho ra' }),
      ] })))] : [dlg.empty(crew ? 'Chưa có thợ xây nào: chưa dựng được gì.' : 'Chưa có ai làm việc ở đây.')]));
    }
    // the choice is the player's: every villager who could go in, best at the job first
    this.picker.hidden = !this.open;
    if (!this.open) return;
    const pool = sim.villagers.filter((v) => v.inside === null && v.down <= 0 && v.job !== 'fight' && v.job !== 'scout' && !(v.phase === 'goStaff' && v.target === b.id) && !isStaffJob(v.job) && v.job !== 'build' && !(v.job === 'food' && v.post >= 0)).sort((x, y) => y.stats[stat] - x.stats[stat]);
    const pk = `${b.id}|${full}|${pool.map((v) => `${v.id}.${v.job}.${v.stats[stat]}`).join()}`;
    if (pk === this.pickKey) return;
    this.pickKey = pk;
    this.picker.replaceChildren(h('p', { class: 'sub', text: full ? 'Nhà đã đủ người: cho một người ra hoặc nâng cấp nhà.' : `Chọn ai làm ${label.toLowerCase()}:` }),
      dlg.list(...pool.map((v) => personTile(this.c, v, { note: `đang ${JOB_NAME[v.job].toLowerCase()}`, stats: roleStats(this.job), actions: [
        dlg.button('＋', () => { const e = crew ? sim.assignCrew([v.id]) : this.job === 'farm' ? sim.assignField([v.id], b.id) : sim.assignStaff([v.id], this.job as 'craft' | 'research' | 'tame'); this.c.toast(e ?? `${v.name}: ${label}`); this.c.ctl.onChange(); }, { icon: true, disabled: full, title: 'Vào làm' }),
      ] }))));
  }
}

/** What the house is working on right now: a round gauge with the percentage, the name of the order and the time left. */
export class ActiveBox {
  readonly root = h('div', { class: 'kv' }); private readonly slot = h('div', { class: 'dtile' }); private key = '';
  constructor(private readonly c: Ctx, private readonly nameOf: (id: string) => string, private readonly timeOf: (id: string) => number) {
    this.root.append(this.slot);
  }
  update(b: Building): void {
    const a = b.active;
    this.root.hidden = false;
    const rate = a ? this.c.sim.houseRate(b) : 0, left = a && rate > 0 ? ((1 - a.progress) * this.timeOf(a.id)) / rate : 0;
    const key = a ? `${a.id}|${Math.floor(a.progress * 100)}|${rate > 0}|${workDays(left)}` : 'idle';
    if (key === this.key) return;
    this.key = key;
    this.slot.replaceChildren(a ? dlg.ring(a.progress) : h('span', { class: 'dpic glyph', text: '💤' }),
      h('div', { class: 'dmain' }, h('div', { class: 'dname' }, h('b', { text: a ? this.nameOf(a.id) : 'Đang rảnh' })), dlg.more(a ? (rate > 0 ? `còn ~${workDays(left)}` : 'tạm dừng (không có người)') : 'Chưa có đơn nào đang làm')));
  }
}
