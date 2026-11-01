/**
 * The people of a house, drawn the same way for every house that takes people (the houses of a trade, the camps, the builders, the craft, research and stable houses, the fields):
 * the ones who are in, each with a way out, and the ones who could go in, with a filter and the free hands first. Both lists fold away. Change it here, it changes everywhere.
 */
import { JOB_NAME, roleName, roleOf } from '../sim/jobs';
import { isFree } from '../sim/idle';
import type { Villager } from '../sim/model';
import type { Ctx } from './ctx';
import { h } from './dom';
import { dlg } from './gamedialog';
import { detailButton, personTile } from './people';
import type { StatId } from './statview';

export interface RosterSpec {
  /** Who is in the house now, and how many places it has. */
  assigned: Villager[]; cap: number;
  /** The stats shown on a tile, and the one that sorts the candidates (best first). */
  statIds: StatId[]; stat: (v: Villager) => number;
  /** Everyone who could be put in (anyone, whatever their trade): not those who are in already. */
  pool: Villager[];
  /** Why nobody can be added right now (house full, no house, a war on), or null. */
  addBlock: string | null;
  add: (v: Villager) => string | null;
  /** Take one out; returns an error or null. */
  remove: (v: Villager) => string | null;
  /** Why one cannot be taken out right now. */
  removeBlock?: (v: Villager) => string | null;
  /** Buttons of the house's own (to find a soldier on the map...) for somebody who is in. */
  extra?: (v: Villager) => Array<HTMLElement | null>;
  /** The line under the name of somebody who is in. */
  noteIn?: (v: Villager) => string;
  emptyIn: string; emptyPool: string;
  /** Draw it again after a change. */
  again: () => void;
}

/** What a villager does now, in a few words: the name of their trade, or "Dân rảnh". */
export const tradeOf = (c: Ctx, v: Villager): string => {
  const role = roleOf(v);
  return role ? roleName(role, c.sim.era) : isFree(v) ? 'Dân rảnh' : JOB_NAME[v.job];
};

export class Roster {
  private showIn = true; private showPool = true; private filter = 'all';
  constructor(private readonly c: Ctx) {}

  render(s: RosterSpec): Node[] {
    const { sim, toast, ctl } = this.c;
    // ---- the ones who are in
    const head = (open: boolean, title: string, count: string, flip: () => void) => h('button', { class: 'dfold', type: 'button', 'aria-expanded': String(open), onclick: () => { flip(); s.again(); } },
      h('span', { class: 'arrow', text: open ? '▾' : '▸' }), h('b', { text: title }), h('small', { class: 'dsub', text: count }));
    const out: Node[] = [head(this.showIn, 'Đang làm ở đây', `${s.assigned.length}/${s.cap >= 99 ? '∞' : s.cap}`, () => { this.showIn = !this.showIn; })];
    if (this.showIn) {
      if (!s.assigned.length) out.push(dlg.empty(s.emptyIn));
      else out.push(dlg.list(...s.assigned.map((v) => {
        const why = s.removeBlock?.(v) ?? null;
        return personTile(this.c, v, { note: s.noteIn?.(v) ?? '', stats: s.statIds, actions: [
          detailButton(this.c, v),
          ...(s.extra?.(v) ?? []),
          dlg.button('−', () => { const e = s.remove(v); if (e) toast(e); ctl.onChange(); s.again(); }, { icon: true, tone: 'bad', disabled: !!why, title: why ?? 'Cho nghỉ, về làm dân thường' }),
        ] });
      })));
    }
    // ---- the ones who could go in: a filter by trade, the free hands first, then the best at the work
    const trades = new Map<string, number>();
    for (const v of s.pool) trades.set(tradeOf(this.c, v), (trades.get(tradeOf(this.c, v)) ?? 0) + 1);
    if (this.filter !== 'all' && !trades.has(this.filter)) this.filter = 'all';
    const picked = s.pool.filter((v) => this.filter === 'all' || tradeOf(this.c, v) === this.filter)
      .sort((a, b) => Number(isFree(b)) - Number(isFree(a)) || s.stat(b) - s.stat(a));
    const free = s.pool.filter((v) => isFree(v)).length;
    out.push(head(this.showPool, 'Thêm người', `${free} dân rảnh · ${s.pool.length} người`, () => { this.showPool = !this.showPool; }));
    if (this.showPool) {
      const sel = h('select', { class: 'sm', 'aria-label': 'Lọc theo nghề', title: 'Lọc người có thể thêm theo nghề đang làm' }, h('option', { value: 'all', text: `Mọi nghề (${s.pool.length})` }),
        ...[...trades].sort((a, b) => a[0].localeCompare(b[0], 'vi')).map(([name, n]) => h('option', { value: name, text: `${name} (${n})` }))) as HTMLSelectElement;
      sel.value = this.filter;
      sel.addEventListener('change', () => { this.filter = sel.value; s.again(); });
      out.push(h('div', { class: 'btns filters' }, sel, h('small', { class: 'dsub', text: s.addBlock ?? 'Dân rảnh lên đầu; người đang có việc sẽ nghỉ việc cũ khi được giao' })));
      if (!picked.length) out.push(dlg.empty(s.emptyPool));
      else out.push(dlg.list(...picked.map((v) => {
        const locked = sim.sleepLocked(v);
        const why = s.addBlock ?? (locked ? `${v.name} đang ngủ say vì kiệt sức, chưa gọi dậy được` : null);
        return personTile(this.c, v, { note: `đang ${tradeOf(this.c, v).toLowerCase()}`, stats: s.statIds, actions: [
          detailButton(this.c, v),
          dlg.button('＋', () => { const e = s.add(v); if (e) toast(e); ctl.onChange(); s.again(); }, { icon: true, disabled: !!why, title: why ?? 'Giao việc này' }),
        ] });
      })));
    }
    return out;
  }
}
