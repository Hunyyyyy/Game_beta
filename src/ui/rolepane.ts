import { buildingName } from '../sim/buildings';
import { JOBS, ROLES, STAT_NAME, roleName, roleOf } from '../sim/jobs';
import type { RoleId } from '../sim/jobs';
import type { Villager } from '../sim/model';
import { h, hint } from './dom';
import { dlg } from './gamedialog';
import { roleStats } from './people';
import { Roster } from './roster';
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
  foot: 'Chiến binh cận chiến do trại này tuyển và cho nghỉ, không phải ở đống lửa. Họ ở trong trại (không hiện trên bản đồ) và chỉ ra ngoài khi bạn bấm "Gọi quân", khi có trận hoặc khi được ra lệnh; việc canh gác giao cho Lính gác. Nhớ chế vũ khí và giáp cho họ. Nâng cấp trại để chứa thêm.',
  cavalry: 'Người cưỡi thú do trại này tuyển và cho nghỉ. Họ xung phong nhanh, khắc người ném nhưng sợ giáo. Nâng cấp trại để chứa thêm.',
  archer: 'Người ném đá, bắn ná do trại này tuyển và cho nghỉ. Họ đánh từ xa và có thể lên chòi canh. Chỉ dùng vũ khí bắn. Nâng cấp trại để chứa thêm.',
  guard: 'Lính gác do Trại lính gác quản lý: chọn thẳng trong số dân rảnh, không cần qua trại lính khác. Mỗi người có một chỗ gác riêng, đứng đó canh làng, ra tay khi thấy công trình bị phá, dân bị tấn công hoặc kẻ lạ tiến vào, rồi quay về chỗ gác. Muốn đổi chỗ gác: chọn lính rồi chạm lên bản đồ. Họ nhìn xa hơn lính thường 5 ô và không vào đội tác chiến. Nâng cấp trại để chứa 6, 12, 18 người.',
  scout: 'Trinh sát do Trại trinh sát tuyển từ lính kỵ của Trại kỵ thú (họ giữ thú và đồ của mình) và cho nghỉ về lại trại kỵ. Trinh sát tốt cần Nhanh nhẹn và Thể lực. Nâng cấp trại để chứa thêm.',
};

/**
 * The people of one role, kept in the house that belongs to it: how many it holds, who they are, a minus to let one go, and a drop-down of
 * ticks to give the role to more villagers. This is the only place roles are given and taken back (the campfire only counts people).
 */
export class RolePane {
  readonly root = h('div', { class: 'page' });
  private key = '';
  private readonly roster: Roster;

  /** `changed` asks whoever shows this pane to draw it again. */
  constructor(private readonly c: Ctx, readonly role: RoleId, private readonly changed: () => void = () => this.update()) { this.roster = new Roster(c); }

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
    const room = Math.max(0, cap - have.length);
    // anyone may be given the role, whatever they do now (they leave the old work); scouts are taken from the cavalry soldiers only
    const pool = role === 'scout' ? sim.villagers.filter((v) => v.job === 'fight' && !v.guard && v.arm === 'cavalry' && v.down <= 0) : sim.villagers.filter((v) => v.health > 0 && v.down <= 0 && roleOf(v) !== role);
    const key = (v: Villager) => (STAT_OF[role] === 'scout' ? sim.scoutSkill(v) : v.stats[STAT_OF[role] as 'str']);
    const out: Node[] = [hint(h('div', { class: 'dhouse' }, h('b', { text: roleName(role, era) }), dlg.slots(have.length, cap >= 99 ? 99 : cap)), HELP[role])];
    if (!cap) out.push(dlg.empty(`Chưa có ${house.toLowerCase()} xong: hãy dựng, rồi giao việc ở đây.`));
    out.push(...this.roster.render({
      assigned: have, cap, statIds: roleStats(role), stat: key, pool,
      addBlock: lock ?? (!cap ? `Cần dựng ${house}` : !room ? `${house} đã đủ chỗ: nâng cấp để chứa thêm` : null),
      add: (v) => sim.assignRole([v.id], role),
      remove: (v) => sim.releaseRole([v.id]),
      removeBlock: (v) => lock ?? (sim.scouts.some((m) => m.ids.includes(v.id)) ? 'Đang đi trinh sát' : null),
      noteIn: (v) => (v.phase === 'sleep' ? describe(v, sim) : ''),
      extra: (v) => [def.job === 'fight' ? dlg.button('◎', () => { if (v.inside !== null) { toast(`${v.name} đang ngủ trong trại`); return; } ctl.selected.clear(); ctl.selected.add(v.id); ctl.focusSelection(); ctl.closeBuilding(); }, { icon: true, title: 'Chọn trên bản đồ để ra lệnh' }) : null],
      emptyIn: 'Chưa có ai giữ việc này.',
      emptyPool: role === 'scout' ? 'Không còn lính kỵ nào để tuyển.' : 'Không có ai để thêm.',
      again: () => this.again(),
    }));
    return [h('div', { class: 'proster', style: 'display:grid;gap:10px' }, ...out)];
  }
}
