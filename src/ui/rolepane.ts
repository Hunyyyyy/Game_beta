import { buildingName } from '../sim/buildings';
import { JOBS, ROLES, STAT_NAME, roleName, roleOf } from '../sim/jobs';
import type { RoleId } from '../sim/jobs';
import { freeFolk } from '../sim/idle';
import type { Villager } from '../sim/model';
import { h, hint } from './dom';
import { dlg } from './gamedialog';
import { detailButton, personTile, roleStats } from './people';
import type { Ctx } from './ctx';
import { describe } from './describe';

/** What a role leans on: the stat that says who is good at it (scouts are rated by their own score). */
const STAT_OF: Record<RoleId, keyof typeof STAT_NAME | 'scout'> = {
  wood: JOBS.wood.stat, stone: JOBS.stone.stat, food: JOBS.food.stat, hunt: JOBS.hunt.stat, foot: 'str', cavalry: 'str', archer: 'agi', guard: 'str', scout: 'scout',
};
const HELP: Record<RoleId, string> = {
  wood: 'Người đốn gỗ do Xưởng gỗ quản lý: giao việc ở đây, họ ra cây gần nhất và mang gỗ về kho. Nâng cấp xưởng để thêm người.',
  stone: 'Thợ đá do Xưởng đá quản lý: họ ra đá và mang về kho. Nâng cấp xưởng để thêm người.',
  food: 'Người hái lượm do Nông trại quản lý: họ ra bụi quả và mang thức ăn về kho. Người làm ruộng thì giao ở từng Ruộng. Nâng cấp nông trại để thêm người.',
  hunt: 'Thợ săn do Chòi thợ săn quản lý: họ đi săn thú và mang thịt, da về. Nên chế giáo hoặc dây quăng cho họ. Nâng cấp chòi để thêm người.',
  foot: 'Chiến binh cận chiến do trại này tuyển và cho nghỉ, không phải ở đống lửa. Họ canh gác, đánh địch và thú dữ, ngủ trong trại. Nhớ chế vũ khí và giáp cho họ. Nâng cấp trại để chứa thêm.',
  cavalry: 'Người cưỡi thú do trại này tuyển và cho nghỉ. Họ xung phong nhanh, khắc người ném nhưng sợ giáo. Nâng cấp trại để chứa thêm.',
  archer: 'Người ném đá, bắn ná do trại này tuyển và cho nghỉ. Họ đánh từ xa và có thể lên chòi canh. Chỉ dùng vũ khí bắn. Nâng cấp trại để chứa thêm.',
  guard: 'Lính gác do Trại lính gác quản lý: chọn trong số lính của các trại (bộ, kỵ, ném). Mỗi người có một chỗ gác riêng, đứng đó canh làng, ra tay khi thấy công trình bị phá, dân bị tấn công hoặc kẻ lạ tiến vào, rồi quay về chỗ gác. Muốn đổi chỗ gác: chọn lính rồi chạm lên bản đồ. Họ nhìn xa hơn lính thường 5 ô và không vào đội tác chiến. Nâng cấp trại để chứa 6, 12, 18 người.',
  scout: 'Trinh sát do Trại trinh sát tuyển từ lính kỵ của Trại kỵ thú (họ giữ thú và đồ của mình) và cho nghỉ về lại trại kỵ. Trinh sát tốt cần Nhanh nhẹn và Thể lực. Nâng cấp trại để chứa thêm.',
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
    return [this.role, sim.roleCapacity(this.role), sim.villagers.map((v) => `${v.id}${v.job}${v.arm}${v.post}${v.inside === null ? '' : 'i'}${v.phase === 'sleep' ? 'z' : ''}${Math.round(v.energy / 5)}${v.stats.str}${v.stats.agi}${v.stats.sta}`).join(),
      sim.scouts.map((m) => m.ids.join('.')).join('|'), sim.buildings.filter((b) => b.kind === ROLES[this.role].building).map((b) => `${b.level}${b.done}`).join()].join('|');
  }

  private again(): void { this.key = ''; this.changed(); }

  render(): Node[] {
    const { sim, ctl, toast } = this.c, role = this.role, def = ROLES[role], era = sim.era;
    const lock = sim.warLock(), house = buildingName(def.building, era), cap = sim.roleCapacity(role), have = sim.villagers.filter((v) => roleOf(v) === role).sort((a, b) => b.stats.str + b.stats.agi - a.stats.str - a.stats.agi);
    const out: Node[] = [hint(h('div', { class: 'dhouse' }, h('b', { text: roleName(role, era) }), dlg.slots(have.length, cap >= 99 ? 99 : cap)), HELP[role])];
    if (!cap) out.push(dlg.empty(`Chưa có ${house.toLowerCase()} xong: hãy dựng, rồi giao việc ở đây.`));
    else if (!have.length) out.push(dlg.empty('Chưa có ai giữ việc này.'));
    const rows: HTMLElement[] = [];
    for (const v of have) {
      const away = sim.scouts.some((m) => m.ids.includes(v.id));
      rows.push(personTile(this.c, v, { note: v.phase === 'sleep' ? describe(v, sim) : '', stats: roleStats(role), actions: [
        detailButton(this.c, v),
        def.job === 'fight' ? dlg.button('◎', () => { if (v.inside !== null) { toast(`${v.name} đang ngủ trong trại`); return; } ctl.selected.clear(); ctl.selected.add(v.id); ctl.focusSelection(); ctl.closeBuilding(); }, { icon: true, title: 'Chọn trên bản đồ để ra lệnh' }) : null,
        dlg.button('−', () => { const e = sim.releaseRole([v.id]); if (e) toast(e); ctl.onChange(); this.again(); }, { icon: true, tone: 'bad', disabled: away || !!lock, title: lock ?? (away ? 'Đang đi trinh sát' : 'Cho nghỉ, về làm dân thường') }),
      ] }));
    }
    if (rows.length) out.push(dlg.list(...rows));
    const room = Math.max(0, cap - have.length);
    // only villagers with no trade at all are offered: whoever already holds a role, a house to work in or the crew is let go from there first
    // scouts are taken from the cavalry soldiers; every other role from the villagers with no trade
    const free = role === 'scout' ? sim.villagers.filter((v) => v.job === 'fight' && !v.guard && v.arm === 'cavalry' && v.down <= 0) : role === 'guard' ? sim.guardCandidates() : freeFolk(sim);
    const key = (v: Villager) => (STAT_OF[role] === 'scout' ? sim.scoutSkill(v) : v.stats[STAT_OF[role] as 'str']);
    free.sort((a, b) => key(b) - key(a));
    out.push(h('div', { class: 'dhouse' }, h('b', { text: role === 'scout' ? 'Lính kỵ' : role === 'guard' ? 'Lính của các trại' : 'Dân rảnh' }), h('small', { class: 'dsub', text: !cap ? `cần dựng ${house.toLowerCase()}` : room ? `còn chỗ cho ${room} người` : `${house.toLowerCase()} đã đủ người: nâng cấp để chứa thêm` })));
    if (!free.length) out.push(dlg.empty(role === 'scout' ? 'Không còn lính kỵ nào để tuyển.' : role === 'guard' ? 'Không còn lính nào của các trại để cử đi gác: tuyển lính ở trại bộ, kỵ hoặc ném trước.' : 'Không còn dân rảnh.'));
    // one press on the plus gives the role to that villager
    out.push(dlg.list(...free.map((v) => personTile(this.c, v, { note: '', stats: roleStats(role), actions: [
      detailButton(this.c, v),
      dlg.button('＋', () => { const e = sim.assignRole([v.id], role); if (e) toast(e); ctl.onChange(); this.again(); }, { icon: true, disabled: !!lock || !room, title: lock ?? (!cap ? `Cần dựng ${house}` : !room ? `${house} đã đủ chỗ: nâng cấp để chứa thêm` : 'Giao việc này') }),
    ] }))));
    return [h('div', { class: 'proster', style: 'display:grid;gap:10px' }, ...out)];
  }
}
