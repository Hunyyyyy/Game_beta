import { buildingName } from '../sim/buildings';
import { JOBS, ROLES, STAT_NAME, roleName, roleOf } from '../sim/jobs';
import type { RoleId } from '../sim/jobs';
import type { Villager } from '../sim/model';
import { h, hint } from './dom';
import { dlg } from './gamedialog';
import { roleStats } from './people';
import { Roster, iconButton } from './roster';
import { icon } from './icons';
import type { Ctx } from './ctx';
import { describe, SHIFT_LABEL } from './describe';

import { WEAPONS } from '../sim/combat';
import { isRankRole, rankName, ranksOf, trainBill } from '../sim/ranks';

/** What a role leans on: the stat that says who is good at it (scouts are rated by their own score). */
const STAT_OF: Record<RoleId, keyof typeof STAT_NAME | 'scout'> = {
  wood: JOBS.wood.stat, stone: JOBS.stone.stat, food: JOBS.food.stat, hunt: JOBS.hunt.stat, foot: 'str', cavalry: 'str', archer: 'agi', guard: 'str', tower: 'agi', scout: 'scout', supply: 'str',
};
const HELP: Record<RoleId, string> = {
  wood: 'Người đốn gỗ do Xưởng gỗ quản lý: giao việc ở đây, họ ra cây gần nhất và mang gỗ về kho. Nâng cấp xưởng để thêm người.',
  stone: 'Thợ đá do Xưởng đá quản lý: họ ra đá và mang về kho. Nâng cấp xưởng để thêm người.',
  food: 'Người hái lượm do Nông trại quản lý: họ ra bụi quả và mang thức ăn về kho. Người làm ruộng thì giao ở từng Ruộng. Nâng cấp nông trại để thêm người.',
  hunt: 'Thợ săn do Chòi thợ săn quản lý: họ đi săn thú và mang thịt, da về. Nên chế giáo hoặc dây quăng cho họ. Nâng cấp chòi để thêm người.',
  foot: 'Chiến binh cận chiến do trại này tuyển và cho nghỉ, không phải ở đống lửa. Họ ở trong trại (không hiện trên bản đồ) và chỉ ra ngoài khi bạn bấm "Gọi quân", khi có trận hoặc khi được ra lệnh; việc canh gác giao cho Lính gác. Nhớ chế vũ khí và giáp cho họ. Nâng cấp trại để chứa thêm.',
  cavalry: 'Người cưỡi thú do trại này tuyển và cho nghỉ. Họ xung phong nhanh, khắc người ném nhưng sợ giáo. Nâng cấp trại để chứa thêm.',
  archer: 'Người ném đá, bắn ná do trại này tuyển và cho nghỉ. Họ đánh từ xa và có thể lên chòi canh. Chỉ dùng vũ khí bắn. Nâng cấp trại để chứa thêm.',
  guard: 'Lính gác do Trại lính gác quản lý, luyện theo bậc như các trại khác (Người canh gác, Lính gác, Lính canh): chọn bậc, chọn người nam rảnh, đồ lấy từ kho. Họ phòng thủ tốt hơn đánh: nhiều máu và thủ hơn bộ binh cùng bậc. Mỗi người có một chỗ gác riêng, đứng đó canh làng, ra tay khi thấy công trình bị phá, dân bị tấn công hoặc kẻ lạ tiến vào, rồi quay về chỗ gác. Muốn đổi chỗ gác: chọn lính rồi chạm lên bản đồ. Họ nhìn xa hơn lính thường 5 ô và không vào đội tác chiến. Nâng cấp trại để chứa 6, 12, 18 người.',
  tower: 'Lính chòi canh được giao ở từng Chòi canh, lấy thẳng từ dân rảnh (không cần Trại cung thủ).',
  scout: 'Trinh sát do Trại trinh sát tuyển từ lính kỵ của Trại lính kỵ (họ giữ thú và đồ của mình) và cho nghỉ về lại trại kỵ. Trinh sát tốt cần Nhanh nhẹn và Thể lực. Nâng cấp trại để chứa thêm.',
  supply: 'Lính hậu cần do Trại hậu cần tuyển từ dân thường. Họ ở trong trại và chỉ làm việc khi có chiến tranh: mang lương theo quân, đi theo sau đội hình và tự vệ khi bị đánh, không tham gia tấn công. Nâng cấp trại để thêm người.',
};

/**
 * The people of one role, kept in the house that belongs to it: how many it holds, who they are, a minus to let one go, and a drop-down of
 * ticks to give the role to more villagers. This is the only place roles are given and taken back (the campfire only counts people).
 */
export class RolePane {
  readonly root = h('div', { class: 'page' });
  private key = '';
  private readonly roster: Roster;
  /** The Trại lính gác: the watch whose guards stand in the right list, and whether the list of all the villagers (to hire guards) is open instead. */
  private watch: 'day' | 'night' = 'day'; private recruit = false;
  /** The rank the camps of soldiers train now (ranks.json). */
  private rank = 1;

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
    return [this.role, this.watch, this.recruit, this.rank, isRankRole(this.role) ? sim.trainCheck(this.role, this.rank).missing.join('|') : '', sim.roleCapacity(this.role), sim.villagers.map((v) => `${v.id}${v.job}${v.arm}${v.post}${v.inside === null ? '' : 'i'}${v.shift}${v.out ? 'o' : ''}${v.housed ? 'H' : ''}${v.phase === 'sleep' ? 'z' : ''}${Math.round(v.energy / 20)}${Math.round(v.health / 20)}${v.armor ? Math.round(v.gear.ad / 25) : ''}${v.stats.str}${v.stats.agi}${v.stats.sta}`).join(),
      sim.scouts.map((m) => m.ids.join('.')).join('|'), sim.buildings.filter((b) => b.kind === ROLES[this.role].building).map((b) => `${b.level}${b.done}`).join()].join('|');
  }

  private again(): void { this.key = ''; this.changed(); }

  render(): Node[] {
    const { sim, ctl, toast } = this.c, role = this.role, def = ROLES[role], era = sim.era;
    const lock = sim.warLock(), house = buildingName(def.building, era), cap = sim.roleCapacity(role), have = sim.villagers.filter((v) => roleOf(v) === role).sort((a, b) => b.stats.str + b.stats.agi - a.stats.str - a.stats.agi);
    const room = Math.max(0, cap - have.length);
    // anyone may be given the role, whatever they do now (they leave the old work); scouts are taken from the cavalry soldiers only
    const pool = role === 'scout' ? sim.villagers.filter((v) => v.job === 'fight' && !v.guard && v.arm === 'cavalry' && v.down <= 0) : sim.villagers.filter((v) => v.health > 0 && v.down <= 0 && roleOf(v) !== role && (def.job !== 'fight' || v.look.sex === 'm')); // the soldiers are men
    const key = (v: Villager) => (STAT_OF[role] === 'scout' ? sim.scoutSkill(v) : v.stats[STAT_OF[role] as 'str']);
    const out: Node[] = [];
    // the soldiers of a camp live inside it: one button calls the whole camp out (or sends it back), and each soldier has his own
    const guards = role === 'guard', tools: HTMLElement[] = [];
    const stray = guards ? have.filter((v) => v.shift === 'both') : [];
    if (stray.length) sim.setShift(stray.map((v) => v.id), 'day'); // the watch of a guard is the day or the night, never both
    const watching = guards && have.length > 0 && !this.recruit, other = this.watch === 'day' ? 'night' : 'day', onWatch = (v: Villager) => (v.shift === 'night' ? 'night' : 'day'); // the buttons for the whole house, side by side in one row
    const camp = (role === 'foot' || role === 'cavalry' || role === 'archer' || role === 'guard' || role === 'scout' || role === 'supply') && have.length > 0;
    if (camp) {
      const allOut = have.every((v) => sim.isOut(v)), ids = have.map((v) => v.id);
      const n = have.filter((v) => !sim.isOut(v)).length;
      tools.push(h('button', { class: 'sm tbtn', type: 'button', disabled: !!lock,
        title: allOut ? 'Cho mọi lính của trại này về trại nghỉ' : 'Gọi mọi lính của trại này ra ngoài, sẵn sàng; bấm lại để cho về',
        onclick: () => { if (allOut) sim.sendBack(ids); else sim.callOut(ids); this.again(); } }, icon(allOut ? 'callBack' : 'callAll', 15), allOut ? 'Cho về' : `Gọi ra (${n})`));
    }
    // one press hands out what the stores hold (weapons, armour, beasts), the best first; a lesser piece is swapped for a better one
    if ((role === 'foot' || role === 'cavalry' || role === 'archer' || role === 'guard' || role === 'tower' || role === 'hunt') && have.length > 0) {
      tools.push(h('button', { class: 'sm tbtn primary', type: 'button', title: 'Phát vũ khí, giáp và thú cưỡi đang có trong kho cho mọi người ở đây: đồ cấp cao trước, ai đang cầm đồ thấp thì đổi lấy đồ cao hơn',
        onclick: () => { toast(sim.equipGroup(have.map((v) => v.id))); this.again(); } }, icon('equip', 15), 'Trang bị'));
    }
    if (guards && have.length) { // the two watches, and the list of villagers to hire guards from
      const watchBtn = (w: 'day' | 'night') => h('button', { type: 'button', class: `segb${watching && this.watch === w ? ' on' : ''}`, title: `Xem và chia lính gác ${w === 'day' ? 'ngày' : 'đêm'}`, onclick: () => { this.watch = w; this.recruit = false; this.again(); } }, icon(w === 'day' ? 'day' : 'sleep', 15), w === 'day' ? 'Gác ngày' : 'Gác đêm');
      tools.push(h('div', { class: 'seg' }, watchBtn('day'), watchBtn('night')));
      tools.push(h('button', { type: 'button', class: `ibtn wide${this.recruit ? ' on' : ''}`, title: 'Tuyển thêm lính gác từ dân', 'aria-label': 'Tuyển thêm lính gác từ dân', 'aria-pressed': String(this.recruit), onclick: () => { this.recruit = !this.recruit; this.again(); } }, icon('recruit', 16)));
    }
    out.push(hint(tools.length ? h('div', { class: 'btns toolbar' }, ...tools) : h('b', { text: roleName(role, era) }), HELP[role]));
    if (!cap) out.push(dlg.empty(`Chưa có ${house.toLowerCase()} xong: hãy dựng, rồi giao việc ở đây.`));
    const block = lock ?? (!cap ? `Cần dựng ${house}` : !room ? `${house} đã đủ chỗ: nâng cấp để chứa thêm` : null);
    const callOut = (v: Villager) => (camp ? iconButton(sim.isOut(v) ? 'callBack' : 'callOut', () => { if (sim.isOut(v)) sim.sendBack([v.id]); else sim.callOut([v.id]); this.again(); }, sim.isOut(v) ? 'Cho lính này về trại nghỉ' : 'Gọi lính này ra ngoài, sẵn sàng', { disabled: !!lock }) : null);
    const name = (w: 'day' | 'night') => (w === 'day' ? 'ngày' : 'đêm');
    // the camps of soldiers train by rank: a card for each rank (what it costs, whether it is open) and what is missing for the one chosen
    const train = isRankRole(role) ? role : null, ranks = train ? ranksOf(train, era) : [];
    if (train && ranks.length && !ranks.some((d) => d.rank === this.rank)) this.rank = ranks[0].rank;
    const chk = train ? sim.trainCheck(train, this.rank) : null;
    if (train && ranks.length) {
      out.push(h('div', { class: 'rankbar' }, ...ranks.map((d) => {
        const c1 = sim.trainCheck(train, d.rank);
        return h('button', { type: 'button', class: `rankcard${d.rank === this.rank ? ' on' : ''}${c1.ok ? ' ready' : ''}${d.soon ? ' soon' : ''}`, title: c1.ok ? `Luyện ${d.name.toLowerCase()}: ${trainBill(d, sim.rankCost(train, d.rank))}` : c1.missing.join('\n'),
          onclick: () => { this.rank = d.rank; this.again(); } }, h('b', { text: d.name }), h('small', { text: d.soon ? 'chưa có' : trainBill(d, sim.rankCost(train, d.rank)) }));
      })));
      out.push(h('small', { class: `dsub rwhy${chk && chk.ok ? ' okline' : ''}`, text: chk && chk.ok ? `Mỗi lính tốn ${trainBill(chk.def!, sim.rankCost(train, this.rank))} và một ${WEAPONS[chk.def!.weapon].name.toLowerCase()} lấy từ kho.` : `Thiếu: ${chk?.missing.join(' · ')}` }));
    }
    out.push(...this.roster.render(watching ? {
      // the guards of the house in two lists: the watch chosen (right) and the other one (left); an arrow sends a guard to the other watch
      assigned: have.filter((v) => onWatch(v) === this.watch), cap, statIds: roleStats(role), stat: key, pool: have.filter((v) => onWatch(v) !== this.watch),
      addBlock: lock, add: (v) => { sim.setShift([v.id], this.watch); return null; }, remove: (v) => { sim.setShift([v.id], other); return null; }, removeBlock: (v) => lock,
      extra: (v) => [callOut(v)], titles: { pool: `Gác ${name(other)}`, in: `Gác ${name(this.watch)}` }, plain: true,
      emptyIn: `Chưa có ai gác ${name(this.watch)}.`, emptyPool: `Không có ai gác ${name(other)}.`,
      again: () => this.again(),
    } : {
      assigned: have, cap, statIds: roleStats(role), stat: key, pool,
      addBlock: train && chk && !chk.ok ? block ?? chk.missing[0] : block,
      add: (v) => (train ? sim.trainSoldier([v.id], train, this.rank) : sim.assignRole([v.id], role)),
      ...(train ? { titles: { pool: 'Dân có thể luyện', in: 'Lính trong trại' }, chipIn: (v: Villager) => rankName(train, v.rank ?? 1) ?? undefined } : {}),
      remove: (v) => sim.releaseRole([v.id]),
      removeBlock: (v) => lock ?? (sim.scouts.some((m) => m.ids.includes(v.id)) ? 'Đang đi trinh sát' : null),
      extra: (v) => [callOut(v)],
      emptyIn: 'Chưa có ai giữ việc này.',
      emptyPool: role === 'scout' ? 'Không còn lính kỵ nào để tuyển.' : 'Không có ai để thêm.',
      again: () => this.again(),
    }));
    return [h('div', { class: 'proster', style: 'display:grid;gap:10px' }, ...out)];
  }
}
