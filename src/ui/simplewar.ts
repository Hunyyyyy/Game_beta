import { h, hint } from './dom';
import { ARM_NAME } from '../sim/formations';
import type { Ctx } from './ctx';

/**
 * The Lều họp chiến of the stone age: the villages somebody has seen (as the Trại trinh sát lists them in the medieval era), each with a button "Đánh".
 * No map and no plan: the whole army goes straight at the village (see sim/warquick.ts).
 */
export class SimpleWar {
  readonly root = h('div', { class: 'page' });
  private key = '';
  constructor(private readonly c: Ctx) {}

  update(): void {
    const { sim } = this.c, found = sim.tribes.filter((t) => t.state === 'free' && sim.isFound(t.id)), men = sim.quickArmy(), atWar = sim.atWar();
    const key = [atWar, men.length, found.map((t) => `${t.id}${sim.whereIs(t.id)?.dist}`).join()].join('|');
    if (key === this.key) return;
    this.key = key;
    const arms = { foot: 0, archer: 0, cavalry: 0 };
    for (const v of men) arms[sim.armOf(v)]++;
    const out: Node[] = [
      hint('Họp chiến', 'Chọn một làng đã phát hiện rồi bấm Đánh: toàn quân (bộ binh, thợ ném, kỵ binh) chạy một mạch tới làng đó, đánh xong thì về. Lính gác giữ làng.'),
      h('div', { class: 'rfacts' }, ...(['foot', 'archer', 'cavalry'] as const).map((a) => h('span', { class: 'chipfact' }, h('small', { text: ARM_NAME[a] }), h('b', { text: String(arms[a]) })))),
    ];
    if (!found.length) out.push(h('p', { class: 'sub', text: 'Chưa phát hiện làng nào: dân đi xa sẽ thấy làng khác.' }));
    for (const t of found) {
      const w = sim.whereIs(t.id), why = atWar ? 'Đang có chiến tranh' : !men.length ? 'Chưa có lính ra trận' : null;
      out.push(h('div', { class: 'rrow simplevillage' }, h('b', { text: t.def.name }), h('small', { text: w ? `cách ${w.dist} ô, hướng ${w.dir}` : '' }),
        h('button', { class: 'sm primary', type: 'button', text: '⚔ Đánh', disabled: !!why, title: why ?? 'Đưa toàn quân đi đánh làng này', onclick: () => { const e = sim.quickAttack(t.id); if (e) this.c.toast(e); else this.c.ctl.closeBuilding(); this.key = ''; this.c.ctl.onChange(); } })));
    }
    this.root.replaceChildren(...out);
  }
}
