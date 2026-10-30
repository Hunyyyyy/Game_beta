import { JOB_NAME, roleName, roleOf } from '../sim/jobs';
import type { Villager } from '../sim/sim';
import { ARMORS } from '../sim/combat';
import type { Ctx } from './ctx';
import { armorText, describe } from './describe';
import { h } from './dom';
import { dlg } from './gamedialog';
import { avatar, personTile } from './people';
import { statIcon } from './resicons';
import { UnitDetail } from './unitdetail';

/**
 * The village's people, as seen from the campfire: a list on the left and, beside it, the same details the detail dialog gives (stats, shift, gear, tools) for whoever was picked.
 * Picking a name only opens the details; going to them on the map is a button of its own.
 */
export class PeoplePane {
  readonly root = h('div', { class: 'split' });
  private readonly count = h('div', { class: 'kv' });
  private readonly list = h('div', { class: 'dlist' });
  private readonly pane = h('div', { class: 'ppane', hidden: true });
  private readonly rows = new Map<number, { row: HTMLElement; note: HTMLElement }>();
  private key = '';
  private picked: number | null = null;
  // the details of the picked villager
  private readonly face = h('div', { class: 'dpic' }); private faceKey = '';
  private readonly name = h('b', { class: 'dtitle' }); private readonly state = h('small', { class: 'dsub' });
  private readonly vitals = h('div', { class: 'dpills' });
  private readonly detail: UnitDetail;
  private readonly where = h('button', { class: 'sm primary', text: 'Đi tới' });

  constructor(private readonly c: Ctx) {
    const { ctl } = c;
    this.detail = new UnitDetail(c, { ids: () => (this.picked === null ? [] : [this.picked]), leave: () => ctl.closeBuilding() });
    this.where.addEventListener('click', () => {
      const v = this.villager(); if (!v) return;
      if (v.inside !== null) { ctl.selectBuilding(v.inside, true); return; }
      ctl.selected.clear(); ctl.selected.add(v.id); ctl.focusSelection(); ctl.closeBuilding();
    });
    this.pane.append(
      h('div', { class: 'dhead' }, this.face, h('div', { class: 'dwho' }, this.name, this.state)),
      this.vitals, this.detail.body,
      h('div', { class: 'btns' }, this.where),
    );
    this.root.append(h('div', {}, this.count, this.list), this.pane);
  }

  private villager(): Villager | undefined { return this.picked === null ? undefined : this.c.sim.get(this.picked); }

  update(): void {
    const { sim } = this.c, vs = sim.villagers;
    this.count.innerHTML = `Dân <b>${vs.length}/${sim.popCap()}</b> · đang làm việc <b>${vs.filter((v) => v.job !== 'idle').length}</b> · lính <b>${vs.filter((v) => v.job === 'fight').length}</b> · trinh sát <b>${vs.filter((v) => v.job === 'scout').length}</b> · thợ săn <b>${vs.filter((v) => v.job === 'hunt').length}</b> · thức ăn <b>${Math.floor(sim.stock.food)}</b> (sống được ~${(sim.stock.food / Math.max(1, vs.length * 5)).toFixed(1)} ngày)`;
    const key = vs.map((v) => v.id).join();
    if (key !== this.key) {
      this.key = key; this.rows.clear();
      this.list.replaceChildren(...vs.map((v) => {
        const row = personTile(this.c, v, { vitals: false, note: describe(v, sim), trade: true });
        row.classList.add('pick'); row.addEventListener('click', () => { this.picked = v.id; this.update(); });
        this.rows.set(v.id, { row, note: row.querySelector('.dmore') as HTMLElement });
        return row;
      }));
      if (this.picked !== null && !sim.get(this.picked)) this.picked = null;
    }
    for (const v of vs) { const r = this.rows.get(v.id); if (r) { r.note.textContent = `${describe(v, sim)} · ${Math.ceil(v.health)}/${v.maxHealth}`; r.row.classList.toggle('now', v.id === this.picked); } }

    const v = this.villager();
    this.pane.hidden = !v;
    if (!v) return;
    const fk = `${v.id}|${v.armor}`;
    if (fk !== this.faceKey) { this.faceKey = fk; this.face.replaceChildren(avatar(this.c, v)); }
    const role = roleOf(v);
    this.name.textContent = v.name; this.state.textContent = role ? roleName(role, sim.era) : JOB_NAME[v.job]; // the job, not what they are doing
    const hp = v.health / v.maxHealth, ad = v.armor ? ARMORS[v.armor] : null;
    this.vitals.replaceChildren(
      dlg.pill(statIcon('hp'), `${Math.ceil(v.health)}/${v.maxHealth}`, hp < 0.35 ? 'bad' : hp < 0.7 ? 'warn' : undefined, 'Máu'),
      dlg.pill(statIcon('sta'), `${Math.round(v.energy)}%`, v.energy < 20 ? 'bad' : v.energy < 50 ? 'warn' : undefined, 'Sức'),
      dlg.pill(statIcon('defm'), ad ? ad.name : 'không giáp', undefined, ad ? armorText(ad) : 'Không mặc giáp'));
    this.detail.update([v]);
    this.where.textContent = v.inside !== null ? (v.phase === 'sleep' ? 'Mở nhà đang ngủ' : 'Mở nhà đang làm') : 'Đi tới';
  }
}
