import { JOB_NAME, JOBS, STAT_NAME, StatKey, WORK_JOBS } from '../sim/jobs';
import type { Villager } from '../sim/sim';
import { ARMORS } from '../sim/combat';
import type { Ctx } from './ctx';
import { armorLevel, ARMOR_FULL, armorText, describe, PLAIN_JOBS, stars } from './describe';
import { h } from './dom';

/**
 * The village's people, as seen from the campfire: a list on the left and, beside it, the menu of whoever was picked.
 * Picking a name only opens the menu; going to them on the map is a button of its own.
 */
export class PeoplePane {
  readonly root = h('div', { class: 'split' });
  private readonly count = h('div', { class: 'kv' });
  private readonly list = h('div', { class: 'plist' });
  private readonly pane = h('div', { class: 'ppane', hidden: true });
  private readonly rows = new Map<number, { row: HTMLElement; st: HTMLElement; hp: HTMLElement }>();
  private key = '';
  private picked: number | null = null;
  // the menu of the picked villager
  private readonly name = h('b'); private readonly state = h('span'); private readonly facts = h('div', { class: 'kv' }); private readonly skills = h('div', { class: 'kv' });
  private readonly bar = { full: h('b'), health: h('b'), morale: h('b', { class: 'mor' }), armor: h('b', { class: 'arm' }) };
  private readonly armorLabel = h('label', {}, 'Giáp');
  private readonly jobBtns: HTMLButtonElement[];
  private readonly where = h('button', { class: 'sm primary', text: 'Đi tới' });

  constructor(private readonly c: Ctx) {
    const { sim, ctl, toast } = c;
    this.armorLabel.append(h('i', {}, this.bar.armor));
    this.jobBtns = PLAIN_JOBS.map((j) => h('button', { class: 'sm', 'data-job': j, pressed: false, text: JOB_NAME[j], onclick: () => { const v = this.villager(); if (!v) return; const e = sim.setJob([v.id], j); if (e) toast(e); ctl.onChange(); } }) as HTMLButtonElement);
    this.where.addEventListener('click', () => {
      const v = this.villager(); if (!v) return;
      if (v.inside !== null) { ctl.selectBuilding(v.inside, true); return; }
      ctl.selected.clear(); ctl.selected.add(v.id); ctl.focusSelection(); ctl.closeBuilding();
    });
    const more = h('button', { class: 'sm', text: 'Công cụ, trang bị, chỉ số', onclick: () => {
      const v = this.villager(); if (!v || v.inside !== null) { toast('Dân đang ở trong nhà: mở nhà để cho họ ra'); return; }
      ctl.selected.clear(); ctl.selected.add(v.id); ctl.openDetail = true; ctl.closeBuilding();
    } });
    const labels = (...names: string[]) => names.map((n, i) => h('label', {}, n, h('i', {}, [this.bar.full, this.bar.health, this.bar.morale][i])));
    this.pane.append(
      h('div', { class: 'cardhead' }, this.name, this.state),
      h('div', { class: 'bars' }, ...labels('No', 'Máu', 'Tinh thần'), this.armorLabel),
      this.facts, this.skills,
      h('h3', { text: 'Giao việc' }), h('div', { class: 'btns', role: 'group', 'aria-label': 'Giao việc' }, ...this.jobBtns),
      h('p', { class: 'sub', text: 'Thợ xây, chế tạo, nghiên cứu và sửa chữa do bạn chọn ở nhà tương ứng.' }),
      h('div', { class: 'btns' }, this.where, more),
    );
    this.root.append(h('div', {}, this.count, this.list), this.pane);
  }

  private villager(): Villager | undefined { return this.picked === null ? undefined : this.c.sim.get(this.picked); }

  update(): void {
    const { sim } = this.c, vs = sim.villagers;
    this.count.innerHTML = `Dân <b>${vs.length}/${sim.popCap()}</b> · đang làm việc <b>${vs.filter((v) => v.job !== 'idle').length}</b> · lính <b>${vs.filter((v) => v.job === 'fight').length}</b> · thợ săn <b>${vs.filter((v) => v.job === 'hunt').length}</b> · thức ăn <b>${Math.floor(sim.stock.food)}</b> (sống được ~${(sim.stock.food / Math.max(1, vs.length * 5)).toFixed(1)} ngày)`;
    const key = vs.map((v) => v.id).join();
    if (key !== this.key) {
      this.key = key; this.rows.clear();
      this.list.replaceChildren(...vs.map((v) => {
        const st = h('small'), hp = h('small');
        const row = h('button', { class: 'vrow', type: 'button', onclick: () => { this.picked = v.id; this.update(); } }, h('span', {}, h('b', { text: v.name }), ' ', st), hp);
        this.rows.set(v.id, { row, st, hp });
        return row;
      }));
      if (this.picked !== null && !sim.get(this.picked)) this.picked = null;
    }
    for (const v of vs) { const r = this.rows.get(v.id); if (r) { r.st.textContent = `· ${describe(v, sim)}`; r.hp.textContent = `${Math.ceil(v.health)}/${v.maxHealth}`; r.row.classList.toggle('on', v.id === this.picked); } }

    const v = this.villager();
    this.pane.hidden = !v;
    if (!v) return;
    this.name.textContent = v.name; this.state.textContent = describe(v, sim);
    this.bar.full.style.width = `${v.fullness}%`; this.bar.health.style.width = `${(v.health / v.maxHealth) * 100}%`; this.bar.morale.style.width = `${v.morale}%`;
    this.bar.health.className = v.health / v.maxHealth < 0.35 ? 'bad' : '';
    const ad = v.armor ? ARMORS[v.armor] : null;
    this.bar.armor.style.width = `${ad ? Math.min(100, (armorLevel(ad) / ARMOR_FULL) * 100) : 0}%`;
    this.armorLabel.title = ad ? armorText(ad) : 'Không mặc giáp';
    this.facts.innerHTML = (Object.keys(STAT_NAME) as StatKey[]).map((k) => `${STAT_NAME[k]} <b>${v.stats[k]}</b>`).join(' · ');
    this.skills.innerHTML = WORK_JOBS.map((j) => `${JOBS[j].name} <span class="stars">${stars(v.potential[j])}</span> <b>cấp ${v.skill[j].level}</b>`).join(' · ');
    this.jobBtns.forEach((b) => b.setAttribute('aria-pressed', String(v.job === b.dataset.job)));
    this.where.textContent = v.inside !== null ? 'Mở nhà dân đang làm' : 'Đi tới';
  }
}
