import { buildingName } from '../sim/buildings';
import { fmtStat, JOBS, ROLES, STAT_NAME, roleName, roleOf } from '../sim/jobs';
import type { RoleId } from '../sim/jobs';
import type { Villager } from '../sim/model';
import { describe } from './describe';
import { h, hint } from './dom';
import type { Ctx } from './ctx';

/** What a role leans on: the stat that says who is good at it (scouts are rated by their own score). */
const STAT_OF: Record<RoleId, keyof typeof STAT_NAME | 'scout'> = {
  wood: JOBS.wood.stat, stone: JOBS.stone.stat, food: JOBS.food.stat, hunt: JOBS.hunt.stat, foot: 'str', cavalry: 'str', archer: 'agi', scout: 'scout',
};
const HELP: Record<RoleId, string> = {
  wood: 'Người đốn gỗ do Xưởng gỗ quản lý: giao việc ở đây, họ ra cây gần nhất và mang gỗ về kho. Nâng cấp xưởng để thêm người.',
  stone: 'Thợ đá do Xưởng đá quản lý: họ ra đá và mang về kho. Nâng cấp xưởng để thêm người.',
  food: 'Người hái lượm do Nông trại quản lý: họ ra bụi quả và mang thức ăn về kho. Người làm ruộng thì giao ở từng Ruộng. Nâng cấp nông trại để thêm người.',
  hunt: 'Thợ săn do Chòi thợ săn quản lý: họ đi săn thú và mang thịt, da về. Nên chế giáo hoặc dây quăng cho họ. Nâng cấp chòi để thêm người.',
  foot: 'Chiến binh cận chiến do trại này tuyển và cho nghỉ, không phải ở đống lửa. Họ canh gác, đánh địch và thú dữ, ngủ trong trại. Nhớ chế vũ khí và giáp cho họ. Nâng cấp trại để chứa thêm.',
  cavalry: 'Người cưỡi thú do trại này tuyển và cho nghỉ. Họ xung phong nhanh, khắc người ném nhưng sợ giáo. Nâng cấp trại để chứa thêm.',
  archer: 'Người ném đá, bắn ná do trại này tuyển và cho nghỉ. Họ đánh từ xa và có thể lên chòi canh. Chỉ dùng vũ khí bắn. Nâng cấp trại để chứa thêm.',
  scout: 'Trinh sát do Trại trinh sát tuyển và cho nghỉ. Trinh sát tốt cần Nhanh nhẹn, Thể lực và Trí tuệ. Nâng cấp trại để chứa thêm.',
};

/**
 * The people of one role, kept in the house that belongs to it: how many it holds, who they are, a minus to let one go, and a drop-down of
 * ticks to give the role to more villagers. This is the only place roles are given and taken back (the campfire only counts people).
 */
export class RolePane {
  readonly root = h('div', { class: 'page' });
  private key = '';

  /** `changed` asks whoever shows this pane to draw it again. */
  constructor(private readonly c: Ctx, readonly role: RoleId, private readonly changed: () => void = () => this.update()) {}

  update(): void {
    const k = this.stateKey();
    if (k === this.key) return;
    this.key = k;
    this.root.replaceChildren(...this.render());
  }

  stateKey(): string {
    const { sim } = this.c;
    return [this.role, sim.roleCapacity(this.role), sim.villagers.map((v) => `${v.id}${v.job}${v.arm}${v.post}${v.inside === null ? '' : 'i'}${Math.round(v.energy / 5)}${v.stats.str}${v.stats.agi}${v.stats.int}${v.stats.sta}`).join(),
      sim.scouts.map((m) => m.ids.join('.')).join('|'), sim.buildings.filter((b) => b.kind === ROLES[this.role].building).map((b) => `${b.level}${b.done}`).join()].join('|');
  }

  private again(): void { this.key = ''; this.changed(); }

  private statLine(v: Villager): string {
    const { sim } = this.c, s = STAT_OF[this.role];
    if (s === 'scout') return `Nhanh ${fmtStat(v.stats.agi)} · Thể lực ${fmtStat(v.stats.sta)} · Trí tuệ ${fmtStat(v.stats.int)} · điểm ${(sim.scoutSkill(v) * 10).toFixed(1)}`;
    return `${STAT_NAME[s]} ${fmtStat(v.stats[s])}`;
  }

  render(): Node[] {
    const { sim, ctl, toast } = this.c, role = this.role, def = ROLES[role], era = sim.era;
    const lock = sim.warLock(), house = buildingName(def.building, era), cap = sim.roleCapacity(role), have = sim.villagers.filter((v) => roleOf(v) === role).sort((a, b) => b.stats.str + b.stats.agi - a.stats.str - a.stats.agi);
    const out: Node[] = [hint(h('h3', { text: `${roleName(role, era)} (${have.length}/${cap >= 99 ? '∞' : cap})` }), HELP[role])];
    if (!cap) out.push(h('p', { class: 'sub', text: `Chưa có ${house.toLowerCase()} xong: hãy dựng, rồi giao việc ở đây.` }));
    if (!have.length) out.push(h('p', { class: 'sub', text: 'Chưa có ai giữ việc này.' }));
    for (const v of have) {
      const away = sim.scouts.some((m) => m.ids.includes(v.id));
      out.push(h('div', { class: 'rrow', style: `grid-template-columns:1fr ${def.job === 'fight' ? 'auto auto auto' : 'auto auto'}` }, h('div', { class: 'rwho' }, h('b', { text: v.name }), h('small', { text: `${describe(v, sim)} · ${this.statLine(v)}` })),
        h('button', { class: 'chip', text: '⚙', title: 'Giao việc và chi tiết: công cụ, trang bị', onclick: () => { ctl.selected.clear(); ctl.selected.add(v.id); ctl.openDetail = true; ctl.closeBuilding(); } }),
        def.job === 'fight' ? h('button', { class: 'chip', text: '◎', title: 'Chọn trên bản đồ để ra lệnh', onclick: () => { if (v.inside !== null) { toast(`${v.name} đang ngủ trong trại`); return; } ctl.selected.clear(); ctl.selected.add(v.id); ctl.focusSelection(); ctl.closeBuilding(); } }) : null,
        h('button', { class: 'chip danger', text: '−', title: lock ?? (away ? 'Đang đi trinh sát' : 'Cho nghỉ, về làm dân thường'), disabled: away || !!lock, onclick: () => { const e = sim.releaseRole([v.id]); if (e) toast(e); ctl.onChange(); this.again(); } })));
    }
    const room = Math.max(0, cap - have.length);
    const free = sim.villagers.filter((v) => v.job !== 'fight' && v.job !== 'scout' && roleOf(v) !== role && v.down <= 0 && v.inside === null);
    const key = (v: Villager) => (STAT_OF[role] === 'scout' ? sim.scoutSkill(v) : v.stats[STAT_OF[role] as 'str']);
    free.sort((a, b) => key(b) - key(a));
    out.push(h('div', { class: 'phead' }, h('b', { text: 'Dân rảnh' }), h('small', { text: !cap ? `cần dựng ${house.toLowerCase()}` : room ? `còn chỗ cho ${room} người` : `${house.toLowerCase()} đã đủ người: nâng cấp để chứa thêm` })));
    if (!free.length) out.push(h('p', { class: 'sub', text: 'Không còn dân rảnh.' }));
    // one press on the plus gives the role to that villager
    for (const v of free) {
      const now = roleOf(v);
      out.push(h('div', { class: 'rrow rfree', style: 'grid-template-columns:1fr auto auto' }, h('div', { class: 'rwho' }, h('b', { text: v.name }), h('small', { text: `${now ? roleName(now, era) : 'rảnh'} · ${this.statLine(v)}` })),
        h('button', { class: 'chip', text: '⚙', title: 'Giao việc và chi tiết: công cụ, trang bị', onclick: () => { ctl.selected.clear(); ctl.selected.add(v.id); ctl.openDetail = true; ctl.closeBuilding(); } }),
        h('button', { class: 'chip', text: '＋', title: lock ?? (!cap ? `Cần dựng ${house}` : !room ? `${house} đã đủ chỗ: nâng cấp để chứa thêm` : 'Giao việc này'), disabled: !!lock || !room,
          onclick: () => { const e = sim.assignRole([v.id], role); if (e) toast(e); ctl.onChange(); this.again(); } })));
    }
    return [h('div', { class: 'proster', style: 'display:grid;gap:6px' }, ...out)];
  }
}
