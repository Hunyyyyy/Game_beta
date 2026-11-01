import { Building, levelDef } from '../sim/buildings';
import { workDays } from '../sim/constants';
import { fmtStat, isStaffJob, JOB_NAME, JOBS, STAT_NAME } from '../sim/jobs';
import type { Villager } from '../sim/sim';
import { h, hint } from './dom';
import { dlg } from './gamedialog';
import { roleStats } from './people';
import { Roster } from './roster';
import type { Ctx } from './ctx';

// ================================================================== a building tapped on the map or chosen from the menu
/** The villagers working inside a house: names, a way out, and a list to choose who goes in next. */
export class StaffBox {
  readonly root = h('section', {});
  private readonly head = h('div'); private readonly body = h('div');
  private key = ''; private readonly roster: Roster;
  constructor(private readonly c: Ctx, private readonly job: 'craft' | 'research' | 'tame' | 'build' | 'farm') {
    this.roster = new Roster(c);
    this.root.append(hint(this.head, job === 'build' ? 'Chỉ thợ xây của nhà này mới dựng và nâng cấp được công trình. Bạn chọn ai làm thợ xây trong danh sách bên dưới.' : 'Dân làm việc trong nhà: càng đông và càng giỏi thì làm càng nhanh. Bạn chọn ai vào ở danh sách bên dưới; lọc theo nghề, dân rảnh lên đầu.'), this.body);
  }
  update(b: Building): void {
    const { sim } = this.c, slots = levelDef(b).slots, jobKey = this.job === 'farm' ? 'food' : this.job, stat = JOBS[jobKey].stat;
    const crew = this.job === 'build', staff = crew ? sim.crew() : b.staff.map((id) => sim.get(id)).filter((v): v is Villager => !!v);
    const count = crew ? staff.length : sim.staffCount(b), full = count >= slots;
    this.head.replaceChildren(h('div', { class: 'dhouse' }, h('b', { text: crew ? 'Thợ xây' : this.job === 'farm' ? 'Nông dân' : 'Người làm việc' }), dlg.slots(count, slots), h('small', { class: 'dsub', text: `${count}/${slots}` })));
    // anyone may go in, whatever they do now; those on the way to this house are counted in the places but are not listed as inside yet
    const pool = sim.villagers.filter((v) => v.health > 0 && v.down <= 0 && !staff.includes(v) && !(v.phase === 'goStaff' && v.target === b.id));
    const key = `${b.id}|${full}|${staff.map((v) => `${v.id}.${v.stats[stat]}`).join()}|${pool.map((v) => `${v.id}.${v.job}.${v.guard ? 'g' : ''}${v.arm}.${v.stats[stat]}`).join()}`;
    if (key === this.key) return;
    this.key = key;
    const again = () => { this.key = ''; this.c.ctl.onChange(); };
    this.body.replaceChildren(...this.roster.render({
      assigned: staff, cap: slots, statIds: roleStats(this.job), stat: (v) => v.stats[stat], pool,
      addBlock: sim.warLock() ?? (full ? 'Nhà đã đủ người: cho một người ra hoặc nâng cấp nhà' : null),
      add: (v) => (crew ? sim.assignCrew([v.id]) : this.job === 'farm' ? sim.assignField([v.id], b.id) : sim.assignStaff([v.id], this.job as 'craft' | 'research' | 'tame')),
      remove: (v) => { if (crew) sim.releaseCrew([v.id]); else sim.releaseStaff([v.id]); return null; },
      emptyIn: crew ? 'Chưa có thợ xây nào: chưa dựng được gì.' : 'Chưa có ai làm việc ở đây.',
      emptyPool: 'Không có ai để thêm.',
      again,
    }));
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
