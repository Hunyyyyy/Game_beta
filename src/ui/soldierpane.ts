import type { Villager } from '../sim/sim';
import type { Ctx } from './ctx';
import { describe } from './describe';
import { h, hint } from './dom';

const energyBar = (v: Villager) => h('div', { class: 'bars', style: 'width:90px;display:block' }, h('i', {}, h('b', { class: v.energy < 20 ? 'en low' : 'en', style: `width:${v.energy}%` })));

/**
 * The army, kept at the campfire: who is a soldier (and a way to discharge them) and the villagers who can be recruited.
 * A soldier is made and unmade only here; the job buttons never touch it.
 */
export class SoldierPane {
  readonly root = h('div');
  private readonly head = h('h3'); private readonly list = h('div');
  private readonly poolHead = h('h3'); private readonly pool = h('div');
  private readonly rows = new Map<number, { st: HTMLElement; bar: HTMLElement }>();
  private key = '';

  constructor(private readonly c: Ctx) {
    this.root.append(
      hint(this.head, 'Chiến binh được tuyển và giải ngũ ở đây, không phải bằng nút nghề hay bằng chuột phải. Họ canh gác bên đống lửa, đánh địch và thú dữ. Khi mệt họ vào Lều chiến binh ngủ (hết giường thì nằm cạnh đống lửa, hồi sức chậm hơn). Giải ngũ thì họ thành dân thường và trả vũ khí, giáp về kho.'),
      this.list,
      hint(this.poolHead, 'Chọn người để tuyển làm chiến binh. Người đang làm việc sẽ bỏ việc đó. Nhớ chế vũ khí và giáp ở Nhà chế tạo cho họ.'),
      this.pool);
  }

  update(): void {
    const { sim, ctl, toast } = this.c;
    const soldiers = sim.villagers.filter((v) => v.job === 'fight'), civilians = sim.villagers.filter((v) => v.job !== 'fight');
    const beds = sim.bedsIn('barracks');
    this.head.textContent = `Chiến binh (${soldiers.length}) · ${beds ? `Lều chiến binh ${beds} giường` : 'chưa có Lều chiến binh'}`;
    this.poolHead.textContent = `Dân có thể tuyển (${civilians.length})`;
    const key = `${soldiers.map((v) => v.id).join()}|${civilians.map((v) => v.id).join()}`;
    if (key !== this.key) {
      this.key = key; this.rows.clear();
      const row = (v: Villager, buttons: HTMLElement[]) => {
        const st = h('small'), bar = h('div', { class: 'bars', style: 'width:90px;display:block' }, h('i', {}, h('b', { class: 'en' })));
        this.rows.set(v.id, { st, bar });
        return h('div', { class: 'row' }, h('div', { class: 'nm' }, v.name, st), bar, h('div', { class: 'btns' }, ...buttons));
      };
      this.list.replaceChildren(...(soldiers.length ? soldiers.map((v) => row(v, [
        h('button', { class: 'sm', text: 'Chọn', title: 'Chọn trên bản đồ để ra lệnh', onclick: () => { if (v.inside !== null) { toast(`${v.name} đang ngủ trong lều`); return; } ctl.selected.clear(); ctl.selected.add(v.id); ctl.focusSelection(); ctl.closeBuilding(); } }),
        h('button', { class: 'sm danger', text: 'Giải ngũ', onclick: () => { if (!sim.discharge([v.id])) toast(`${v.name} đang ngủ say, chưa giải ngũ được`); ctl.onChange(); } }),
      ])) : [h('p', { class: 'sub', text: 'Chưa có chiến binh nào. Tuyển ở danh sách bên dưới.' })]));
      this.pool.replaceChildren(...civilians.map((v) => row(v, [
        h('button', { class: 'sm primary', text: 'Tuyển', onclick: () => { const e = sim.setJob([v.id], 'fight'); if (e) toast(e); ctl.onChange(); } }),
      ])));
    }
    for (const v of sim.villagers) {
      const r = this.rows.get(v.id); if (!r) continue;
      r.st.textContent = describe(v, sim);
      const b = r.bar.querySelector('b') as HTMLElement; b.style.width = `${v.energy}%`; b.className = v.energy < 20 ? 'en low' : 'en';
    }
  }
}

/** The villagers lying in a house (the Nhà dân or the Lều chiến binh): a list with their strength, no drawing of them asleep. */
export function sleeperRows(sim: Ctx['sim'], list: Villager[]): HTMLElement[] {
  return list.map((v) => h('div', { class: 'row' }, h('div', { class: 'nm' }, v.name, h('small', { text: describe(v, sim) })), energyBar(v)));
}
