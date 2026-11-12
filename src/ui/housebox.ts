import { Building, levelDef } from '../sim/buildings';
import { workDays } from '../sim/constants';
import { isProcessKind } from '../sim/processdata';
import { JOBS } from '../sim/jobs';
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
  constructor(private readonly c: Ctx, private readonly job: 'craft' | 'research' | 'tame' | 'herd' | 'build' | 'farm') {
    this.roster = new Roster(c);
    this.root.append(hint(this.head, job === 'build' ? 'Chỉ thợ xây của nhà này mới dựng và nâng cấp được công trình. Bạn chọn ai làm thợ xây trong danh sách bên dưới.' : 'Dân làm việc trong nhà: càng đông và càng giỏi thì làm càng nhanh. Bạn chọn ai vào ở danh sách bên dưới; lọc theo nghề, dân rảnh lên đầu.'), this.body);
  }
  update(b: Building): void {
    const { sim } = this.c, slots = sim.slotsOf(b), jobKey = this.job === 'farm' ? 'food' : this.job, stat = JOBS[jobKey].stat;
    const crew = this.job === 'build', walking = crew ? [] : sim.villagers.filter((v) => v.phase === 'goStaff' && v.target === b.id && v.health > 0);
    const staff = crew ? sim.crew() : [...b.staff.map((id) => sim.get(id)).filter((v): v is Villager => !!v), ...walking]; // those on the way are listed too, marked as such
    const count = staff.length, full = count >= slots;
    this.head.replaceChildren(h('b', { text: crew ? 'Thợ xây' : this.job === 'farm' ? 'Nông dân' : 'Người làm việc' })); // the count is in the head of the right list
    // anyone may go in, whatever they do now
    const pool = sim.villagers.filter((v) => v.health > 0 && v.down <= 0 && !staff.includes(v));
    const key = `${b.id}|${full}|${staff.map((v) => `${v.id}.${v.stats[stat]}${walking.includes(v) ? 'w' : ''}`).join()}|${pool.map((v) => `${v.id}.${v.job}.${v.guard ? 'g' : ''}${v.arm}.${v.stats[stat]}`).join()}`;
    if (key === this.key) return;
    this.key = key;
    const again = () => { this.key = ''; this.c.ctl.onChange(); };
    this.body.replaceChildren(...this.roster.render({
      assigned: staff, cap: slots, chipIn: (v: Villager) => (walking.includes(v) ? 'đang di chuyển đến' : undefined), statIds: roleStats(this.job), stat: (v) => v.stats[stat], pool,
      addBlock: sim.warLock() ?? (full ? 'Nhà đã đủ người: cho một người ra hoặc nâng cấp nhà' : null),
      add: (v) => (crew ? sim.assignCrew([v.id]) : this.job === 'farm' ? sim.assignField([v.id], b.id) : isProcessKind(b.kind) ? sim.assignProcessing([v.id], b.id) : sim.assignStaff([v.id], this.job as 'craft' | 'research' | 'tame' | 'herd')),
      remove: (v) => { if (crew) sim.releaseCrew([v.id]); else sim.releaseStaff([v.id]); return null; },
      emptyIn: crew ? 'Chưa có thợ xây nào: chưa dựng được gì.' : 'Chưa có ai làm việc ở đây.',
      emptyPool: 'Không có ai để thêm.',
      again,
    }));
  }
}

/** The strip of a thing that fills up: its picture, name, a note on the right and the bar with its label (the percentage unless `label` says otherwise). */
export function progressStrip(pic: Node, name: string, note: string, pct: number, label = `${pct}%`): HTMLElement {
  return h('div', { class: 'abox' }, h('span', { class: 'apic' }, pic),
    h('div', { class: 'awork' }, h('div', { class: 'aline' }, h('b', { text: name }), h('small', { text: note })), h('div', { class: 'abar', title: label }, h('i', { style: `width:${pct}%` }), h('span', { text: label }))));
}

/** What the house is working on right now: its picture, the name of the order, the time left and a bar that fills up (the same strip in every house that makes things). */
export class ActiveBox {
  readonly root = h('div', { class: 'abox' }); private key = '';
  constructor(private readonly c: Ctx, private readonly nameOf: (id: string) => string, private readonly timeOf: (id: string) => number, private readonly iconOf: (id: string) => HTMLElement) {}
  update(b: Building): void {
    const a = b.active;
    const rate = a ? this.c.sim.houseRate(b) : 0, left = a && rate > 0 ? ((1 - a.progress) * this.timeOf(a.id)) / rate : 0;
    const key = a ? `${a.id}|${Math.floor(a.progress * 100)}|${rate > 0}|${workDays(left)}` : 'idle';
    if (key === this.key) return;
    this.key = key;
    const strip = progressStrip(a ? this.iconOf(a.id) : h('span', { class: 'aglyph', text: '💤' }), a ? this.nameOf(a.id) : 'Đang rảnh', a ? (rate > 0 ? `còn ~${workDays(left)}` : 'tạm dừng (không có người)') : 'chưa có đơn nào đang làm', a ? Math.floor(a.progress * 100) : 0);
    this.root.replaceChildren(...strip.childNodes);
  }
}
