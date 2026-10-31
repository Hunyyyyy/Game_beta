import { JOB_NAME, roleName, roleOf } from '../sim/jobs';
import type { Villager } from '../sim/sim';
import { statValue } from '../sim/statsys';
import { TIER_NAME, TOOL_NAME, TOOL_OF_JOB } from '../sim/tools';
import type { WorkJob } from '../sim/jobs';
import type { Ctx } from './ctx';
import { SHIFT_LABEL } from './describe';
import { h } from './dom';
import { avatar, personTile } from './people';
import { STAT_LABEL } from './statview';
import type { StatId } from './statview';
import { UnitDetail } from './unitdetail';
import { farFolk } from '../sim/idle';

const PAGE = 6;
/** The stats a list can be sorted by (the ones that are a plain number on a person). */
const SORTS: StatId[] = ['hp', 'sta', 'atk', 'defm', 'defr', 'move', 'work', 'int'];

/**
 * The village's people, as seen from the campfire: a filtered, sorted and paged list on the left and, beside it, the same details the detail dialog gives (stats, shift, gear, tools) for whoever was picked.
 * Above the list sit the orders for the whole filtered group (tool, torch, shift). Picking a name only opens the details; going to them on the map is a button of its own.
 */
export class PeoplePane {
  readonly root = h('div', { class: 'split' });
  private readonly list = h('div', { class: 'dlist' });
  private readonly pane = h('div', { class: 'ppane' });
  // the right side: the details of the one picked (or a line asking to pick one)
  private readonly noOne = h('p', { class: 'dempty', text: 'Chọn một người trong danh sách để xem chi tiết và ra lệnh.' });
  private readonly personView = h('div', { class: 'pside', hidden: true });
  private readonly rows = new Map<number, { row: HTMLElement; note: HTMLElement }>();
  private key = '';
  private picked: number | null = null;
  private page = 0;
  private group = ''; private sort = 'order'; private desc = true;
  // the controls over the list
  private readonly groupSel = h('select', { class: 'sm', 'aria-label': 'Lọc theo nghề', title: 'Lọc theo nhóm: dân thường, lính, hoặc từng nghề (kể cả rảnh)' }) as HTMLSelectElement; private groupKey = '';
  private readonly sortSel = h('select', { class: 'sm', 'aria-label': 'Sắp xếp', title: 'Sắp xếp theo chỉ số' }) as HTMLSelectElement;
  private readonly dirBtn = h('button', { class: 'sm', title: 'Đổi chiều sắp xếp' }) as HTMLButtonElement;
  private readonly recall = h('button', { class: 'sm', title: 'Gọi những dân rảnh đang ở xa làng quay về lửa trại' }) as HTMLButtonElement;
  private readonly prev = h('button', { class: 'sm', text: '‹ Trước' }) as HTMLButtonElement;
  private readonly next = h('button', { class: 'sm', text: 'Sau ›' }) as HTMLButtonElement;
  private readonly pageInfo = h('small', { class: 'dsub' });
  private readonly pager = h('div', { class: 'btns pager' }, this.prev, this.pageInfo, this.next);
  // the details of the picked villager
  private readonly face = h('div', { class: 'dpic' }); private faceKey = '';
  private readonly name = h('b', { class: 'dtitle' }); private readonly state = h('small', { class: 'dsub' });
  private readonly detail: UnitDetail;
  private readonly where = h('button', { class: 'sm primary', text: 'Đi tới' });

  constructor(private readonly c: Ctx) {
    const { ctl } = c, again = () => { this.key = ''; ctl.onChange(); };
    // an order here keeps the dialog open: the selection is not the campfire's to drop
    this.detail = new UnitDetail(c, { ids: () => (this.picked === null ? [] : [this.picked]), leave: () => ctl.closeBuilding(), after: () => undefined });
    this.recall.addEventListener('click', () => { const n = this.c.sim.recallFar(); this.c.toast(n ? `Đã gọi ${n} người về làng` : 'Không có ai ở xa'); ctl.onChange(); });
    this.sortSel.append(h('option', { value: 'order', text: 'Sắp xếp: mặc định' }), h('option', { value: 'name', text: 'Tên' }), ...SORTS.map((id) => h('option', { value: id, text: STAT_LABEL[id] })));
    this.groupSel.addEventListener('change', () => { this.group = this.groupSel.value; this.page = 0; this.picked = null; again(); });
    this.sortSel.addEventListener('change', () => { this.sort = this.sortSel.value; this.page = 0; again(); });
    this.dirBtn.addEventListener('click', () => { this.desc = !this.desc; again(); });
    this.prev.addEventListener('click', () => { this.page--; again(); });
    this.next.addEventListener('click', () => { this.page++; again(); });
    this.where.addEventListener('click', () => {
      const v = this.villager(); if (!v) return;
      if (v.inside !== null) { ctl.selectBuilding(v.inside, true); return; }
      ctl.selected.clear(); ctl.selected.add(v.id); ctl.focusSelection(); ctl.closeBuilding();
    });
    const applyAll = h('button', { class: 'sm primary', text: 'Áp dụng cho cả nhóm', title: 'Cho mọi người cùng nghề dùng ca làm, đuốc và công cụ giống người này', onclick: () => this.applyToGroup() });
    this.personView.append(
      h('div', { class: 'dhead' }, this.face, h('div', { class: 'dwho' }, this.name, this.state), this.where),
      this.detail.body,
      h('div', { class: 'btns' }, applyAll),
    );
    this.pane.append(this.noOne, this.personView);
    this.root.append(h('div', { class: 'pleft' }, h('div', { class: 'btns filters' }, this.groupSel, this.sortSel, this.dirBtn), this.recall, this.list, this.pager), this.pane);
  }

  /** Give everybody of the picked villager's trade the same shift, the same tool and (if they hold one) a torch. */
  private applyToGroup(): void {
    const { sim, ctl, toast } = this.c, v = this.villager(); if (!v) return;
    const g = PeoplePane.groupOf(v), ids = sim.villagers.filter((o) => PeoplePane.groupOf(o) === g && o.id !== v.id).map((o) => o.id);
    if (!ids.length) { toast('Không còn ai cùng nghề'); return; }
    sim.setShift(ids, v.shift);
    const k = TOOL_OF_JOB[v.job as WorkJob], errs: string[] = [];
    if (k) { const e = sim.assignTool(ids, k, v.tools[k]?.tier ?? 0); if (e) errs.push(e); }
    if (v.torch) { const e = sim.giveTorch(ids); if (e) errs.push(e); }
    toast(errs.length ? errs.join(' · ') : `Đã áp dụng cho ${ids.length} người cùng nghề`);
    ctl.onChange();
  }

  private villager(): Villager | undefined { return this.picked === null ? undefined : this.c.sim.get(this.picked); }

  /** The trade a filter or a tile goes by: soldiers by arm, the rest by job (the idle are their own group). */
  private static groupOf(v: Villager): string { return roleOf(v) ?? v.job; }

  /** Does a villager belong to the group picked in the filter: '*civ' is the plain villagers (no soldier, hunter or scout), '*army' the soldiers, any other value one trade. */
  private static matches(v: Villager, group: string): boolean {
    if (group === '*civ') return v.job !== 'fight' && v.job !== 'hunt' && v.job !== 'scout';
    if (group === '*army') return v.job === 'fight';
    return PeoplePane.groupOf(v) === group;
  }

  /** What a villager holds and when they work, in one line: the tool of their job, the torch and the shift. */
  private brief(v: Villager): string {
    const k = TOOL_OF_JOB[v.job as WorkJob], t = k ? v.tools[k] : null;
    const parts: string[] = [];
    if (k) parts.push(`${TOOL_NAME[k]}: ${t ? `${TIER_NAME[t.tier].toLowerCase()}${t.dur <= 0 ? ' (hỏng)' : ''}` : 'tay không'}`);
    parts.push(`Đuốc: ${v.torch ? 'có' : 'không'}`, `Ca làm: ${SHIFT_LABEL[v.shift].toLowerCase()}`);
    return parts.join(' · ');
  }

  private sorted(vs: Villager[]): Villager[] {
    const { sim } = this.c, s = this.sort, dir = this.desc ? -1 : 1;
    if (s === 'order') return vs;
    const val = (v: Villager) => (s === 'hp' ? v.health : s === 'sta' ? v.energy : statValue(sim, v, s as never));
    return [...vs].sort(s === 'name' ? (a, b) => a.name.localeCompare(b.name, 'vi') * -dir : (a, b) => (val(a) - val(b)) * dir || a.id - b.id);
  }

  update(): void {
    const { sim } = this.c, all = sim.villagers;
    // the trades that have somebody in them
    const groups = [...new Set(all.map(PeoplePane.groupOf))];
    const civ = all.filter((o) => PeoplePane.matches(o, '*civ')).length, army = all.filter((o) => PeoplePane.matches(o, '*army')).length;
    const gk = `${groups.join()}|${all.map(PeoplePane.groupOf).join()}`; // the groups and how many are in each
    if (gk !== this.groupKey) {
      this.groupKey = gk;
      const label = (g: string) => { const v = all.find((o) => PeoplePane.groupOf(o) === g)!; const r = roleOf(v); return `${r ? roleName(r, sim.era) : JOB_NAME[v.job]} (${all.filter((o) => PeoplePane.groupOf(o) === g).length})`; };
      this.groupSel.replaceChildren(h('option', { value: '', text: `Mọi nghề (${all.length})` }), h('option', { value: '*civ', text: `Dân thường (${civ})` }), h('option', { value: '*army', text: `Lính (${army})` }), ...groups.map((g) => h('option', { value: g, text: label(g) })));
      if (this.group && !this.group.startsWith('*') && !groups.includes(this.group)) this.group = '';
      this.groupSel.value = this.group;
    }
    const far = farFolk(sim).length; this.recall.hidden = far === 0; this.recall.textContent = `Gọi ${far} dân ở xa về làng`;
    this.dirBtn.textContent = this.desc ? '↓ Cao trước' : '↑ Thấp trước'; this.dirBtn.hidden = this.sort === 'order';

    const filtered = this.sorted(this.group ? all.filter((v) => PeoplePane.matches(v, this.group)) : all);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
    this.page = Math.min(Math.max(0, this.page), pages - 1);
    const slice = filtered.slice(this.page * PAGE, (this.page + 1) * PAGE);
    this.pager.hidden = pages <= 1;
    this.pageInfo.textContent = `Trang ${this.page + 1}/${pages} · ${filtered.length} người`;
    this.prev.disabled = this.page <= 0; this.next.disabled = this.page >= pages - 1;

    const key = slice.map((v) => v.id).join();
    if (key !== this.key) {
      this.key = key; this.rows.clear();
      this.list.replaceChildren(...(slice.length ? slice.map((v) => {
        const row = personTile(this.c, v, { vitals: false, note: this.brief(v), trade: true });
        row.classList.add('pick'); row.addEventListener('click', () => { this.picked = this.picked === v.id ? null : v.id; this.update(); });
        this.rows.set(v.id, { row, note: row.querySelector('.dmore') as HTMLElement });
        return row;
      }) : [h('p', { class: 'dempty', text: 'Không có ai.' })]));
      if (this.picked !== null && !sim.get(this.picked)) this.picked = null;
    }
    for (const v of slice) { const r = this.rows.get(v.id); if (r) { const t = this.brief(v); if (r.note.textContent !== t) r.note.textContent = t; r.row.classList.toggle('now', v.id === this.picked); } }

    const v = this.villager();
    this.noOne.hidden = !!v; this.personView.hidden = !v;
    if (!v) return;
    const fk = `${v.id}|${v.armor}`;
    if (fk !== this.faceKey) { this.faceKey = fk; this.face.replaceChildren(avatar(this.c, v)); }
    const role = roleOf(v);
    this.name.textContent = v.name; this.state.textContent = role ? roleName(role, sim.era) : JOB_NAME[v.job]; // the job, not what they are doing
    this.detail.update([v]);
    this.where.textContent = v.inside !== null ? (v.phase === 'sleep' ? 'Mở nhà đang ngủ' : 'Mở nhà đang làm') : 'Đi tới';
  }
}
