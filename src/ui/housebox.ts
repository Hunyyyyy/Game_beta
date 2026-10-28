import { Building, levelDef } from '../sim/buildings';
import { workDays } from '../sim/constants';
import { JOB_NAME, JOBS, STAT_NAME } from '../sim/jobs';
import type { Villager } from '../sim/sim';
import { h, hint } from './dom';
import type { Ctx } from './ctx';

// ================================================================== a building tapped on the map or chosen from the menu
/** The villagers working inside a house: names, a way out, and a list to choose who goes in next. */
export class StaffBox {
  readonly root = h('section', {});
  private readonly head = h('h3'); private readonly list = h('div'); private readonly picker = h('div', { class: 'picker' });
  private key = ''; private pickKey = ''; private open = false;
  private readonly add: HTMLButtonElement;
  constructor(private readonly c: Ctx, private readonly job: 'craft' | 'research' | 'repair' | 'build') {
    this.add = h('button', { class: 'sm primary', onclick: () => { this.open = !this.open; this.pickKey = ''; c.ctl.onChange(); } }) as HTMLButtonElement;
    this.root.append(hint(this.head, job === 'build' ? 'Chỉ thợ xây của nhà này mới dựng và nâng cấp được công trình. Bạn chọn ai làm thợ xây: bấm "Thêm người" rồi chọn trong danh sách.' : 'Dân vào trong nhà làm việc, không hiện trên bản đồ và không bị tấn công. Bạn chọn ai vào: bấm "Thêm người" rồi chọn trong danh sách.'), this.list, h('div', { class: 'btns' }, this.add), this.picker);
  }
  update(b: Building): void {
    const { sim } = this.c, slots = levelDef(b).slots, stat = JOBS[this.job].stat;
    const crew = this.job === 'build', staff = crew ? sim.crew() : b.staff.map((id) => sim.get(id)).filter((v): v is Villager => !!v);
    const count = crew ? staff.length : sim.staffCount(b), full = count >= slots;
    this.head.textContent = `${crew ? 'Thợ xây' : 'Người làm việc'} (${count}/${slots}) · nâng cấp nhà để chứa thêm`;
    this.add.disabled = full && !this.open;
    this.add.textContent = this.open ? 'Xong' : `Thêm người ${JOB_NAME[this.job].toLowerCase()}`;
    const key = staff.map((v) => `${v.id}.${v.stats[stat]}`).join();
    if (key !== this.key) {
      this.key = key;
      this.list.replaceChildren(...(staff.length ? staff.map((v) => h('div', { class: 'row' },
        h('div', { class: 'nm' }, v.name, h('small', { text: `${STAT_NAME[stat]} ${v.stats[stat]} · ${JOBS[this.job].name} cấp ${v.skill[this.job].level}` })),
        h('button', { class: 'sm', text: crew ? 'Cho nghỉ' : 'Cho ra', onclick: () => { if (crew) sim.releaseCrew([v.id]); else sim.releaseStaff([v.id]); this.c.ctl.onChange(); } }))) : [h('p', { class: 'sub', text: crew ? 'Chưa có thợ xây nào: chưa dựng được gì.' : 'Chưa có ai làm việc ở đây.' })]));
    }
    // the choice is the player's: every villager who could go in, best at the job first
    this.picker.hidden = !this.open;
    if (!this.open) return;
    const pool = sim.villagers.filter((v) => v.inside === null && v.down <= 0 && !(v.phase === 'goStaff' && v.target === b.id) && !(crew && v.job === 'build')).sort((x, y) => y.stats[stat] - x.stats[stat]);
    const pk = `${full}|${pool.map((v) => `${v.id}.${v.job}.${v.stats[stat]}`).join()}`;
    if (pk === this.pickKey) return;
    this.pickKey = pk;
    this.picker.replaceChildren(h('p', { class: 'sub', text: full ? 'Nhà đã đủ người: cho một người ra hoặc nâng cấp nhà.' : `Chọn ai làm ${JOB_NAME[this.job].toLowerCase()}:` }),
      ...pool.map((v) => h('div', { class: 'row' },
        h('div', { class: 'nm' }, v.name, h('small', { text: `${STAT_NAME[stat]} ${v.stats[stat]} · đang ${JOB_NAME[v.job].toLowerCase()}` })),
        h('button', { class: 'sm', text: 'Vào làm', disabled: full, onclick: () => { const e = crew ? sim.assignCrew([v.id]) : sim.assignStaff([v.id], this.job as 'craft' | 'research' | 'repair'); this.c.toast(e ?? `${v.name}: ${JOB_NAME[this.job]}`); this.c.ctl.onChange(); } }))));
  }
}

/** What the house is working on right now, with a bar and the time left. */
export class ActiveBox {
  readonly root = h('div', { class: 'kv' }); private readonly bar = h('b'); private readonly text = h('span');
  constructor(private readonly c: Ctx, private readonly nameOf: (id: string) => string, private readonly timeOf: (id: string) => number) {
    this.root.append(h('div', { class: 'bars', style: 'width:100%;grid-template-columns:1fr' }, h('label', {}, this.text, h('i', {}, this.bar))));
  }
  update(b: Building): void {
    const a = b.active;
    this.root.hidden = false;
    if (!a) { this.text.textContent = 'Đang rảnh'; this.bar.style.width = '0%'; return; }
    const rate = this.c.sim.houseRate(b), left = rate > 0 ? ((1 - a.progress) * this.timeOf(a.id)) / rate : 0;
    this.text.textContent = `Đang làm: ${this.nameOf(a.id)} · ${Math.floor(a.progress * 100)}%${rate > 0 ? ` · còn ~${workDays(left)}` : ' · tạm dừng (không có người)'}`;
    this.bar.style.width = `${a.progress * 100}%`;
  }
}

