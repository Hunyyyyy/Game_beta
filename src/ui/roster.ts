/**
 * The people of a house, drawn the same way for every house that takes people (the houses of a trade, the camps, the builders, the craft, research and stable houses, the fields):
 * the ones who could go in (left, with a filter and the free hands first) and the ones who are in (right), each with a way out. Change it here, it changes everywhere.
 */
import { JOB_NAME, roleName, roleOf } from '../sim/jobs';
import { isFree } from '../sim/idle';
import type { Villager } from '../sim/model';
import type { Ctx } from './ctx';
import { h } from './dom';
import { dlg } from './gamedialog';
import { icon } from './icons';
import type { IconName } from './icons';
import { personRow } from './people';
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
  emptyIn: string; emptyPool: string;
  /** The titles of the two lists (the default: who could go in, who is in). `plain`: no filter by trade and no chip, for lists that hold people of one kind (the watches of the guards). */
  titles?: { pool: string; in: string }; plain?: boolean;
  /** Draw it again after a change. */
  again: () => void;
}

/** What a villager does now, in a few words: the name of their trade, or "Dân rảnh". */
export const tradeOf = (c: Ctx, v: Villager): string => {
  const role = roleOf(v);
  return role ? roleName(role, c.sim.era) : isFree(v) ? 'Dân rảnh' : JOB_NAME[v.job];
};

/** A small square button with an icon only; the words are in its tooltip. */
export function iconButton(name: IconName, onclick: () => void, title: string, o: { tone?: 'bad' | 'ok'; disabled?: boolean } = {}): HTMLButtonElement {
  const b = h('button', { class: `ibtn${o.tone ? ` ${o.tone}` : ''}`, type: 'button', title, 'aria-label': title, disabled: !!o.disabled, onclick }, icon(name, 15)) as HTMLButtonElement;
  return b;
}

/** People drawn at a time in the list of those who could go in. */
const PAGE = 24;

export class Roster {
  private filter = 'all';
  /** How many of the people who could go in are drawn: a village of hundreds drawn whole made every click on + or − freeze the page. */
  private shown = PAGE;
  constructor(private readonly c: Ctx) {}

  /** Two lists side by side (one under the other on a narrow screen): on the left the people who could go in, on the right the ones who are in. */
  render(s: RosterSpec): Node[] {
    const { sim, toast, ctl } = this.c;
    const title = (text: string, count: string, extra?: Node) => h('div', { class: 'rhead' }, h('b', { text }), extra ?? null, h('small', { class: 'dsub', text: count }));
    // ---- the ones who are in (right)
    const right: Node[] = [title(s.titles?.in ?? 'Đang làm ở đây', s.plain ? `${s.assigned.length}` : `${s.assigned.length}/${s.cap >= 99 ? '∞' : s.cap}`)];
    if (!s.assigned.length) right.push(dlg.empty(s.emptyIn));
    else right.push(dlg.list(...s.assigned.map((v) => {
      const why = s.removeBlock?.(v) ?? null;
      return personRow(this.c, v, { strip: { kind: 'remove', onclick: () => { const e = s.remove(v); if (e) toast(e); ctl.onChange(); s.again(); }, title: why ?? 'Cho nghỉ, về làm dân thường', disabled: !!why }, actions: s.extra?.(v) ?? [] });
    })));
    // ---- the ones who could go in (left): a filter by trade, the free hands first, then the best at the work
    const trades = new Map<string, number>(), trade = new Map<number, string>();
    for (const v of s.pool) { const t = tradeOf(this.c, v); trade.set(v.id, t); trades.set(t, (trades.get(t) ?? 0) + 1); }
    if (this.filter !== 'all' && !trades.has(this.filter)) this.filter = 'all';
    const rank = new Map<number, number>(); // each one's stat worked out once, not at every comparison of the sort
    const matching = s.pool.filter((v) => this.filter === 'all' || trade.get(v.id) === this.filter);
    for (const v of matching) rank.set(v.id, s.stat(v));
    const picked = matching.sort((a, b) => Number(isFree(b)) - Number(isFree(a)) || rank.get(b.id)! - rank.get(a.id)!);
    const free = s.pool.filter((v) => isFree(v)).length;
    const sel = h('select', { class: 'sm', 'aria-label': 'Lọc theo nghề', title: 'Lọc người có thể thêm theo nghề đang làm' }, h('option', { value: 'all', text: `Mọi nghề (${s.pool.length})` }),
      ...[...trades].sort((a, b) => a[0].localeCompare(b[0], 'vi')).map(([name, n]) => h('option', { value: name, text: `${name} (${n})` }))) as HTMLSelectElement;
    sel.value = this.filter;
    sel.addEventListener('change', () => { this.filter = sel.value; this.shown = PAGE; s.again(); });
    const left: Node[] = [title(s.titles?.pool ?? 'Có thể thêm', s.plain ? `${s.pool.length}` : `${free} rảnh`, s.plain ? undefined : sel)];
    if (!picked.length) left.push(dlg.empty(s.emptyPool));
    else left.push(dlg.list(...picked.slice(0, this.shown).map((v) => {
      const locked = sim.sleepLocked(v);
      const why = s.addBlock ?? (locked ? `${v.name} đang ngủ say vì kiệt sức, chưa gọi dậy được` : null);
      return personRow(this.c, v, { chip: s.plain ? undefined : tradeOf(this.c, v), strip: { kind: 'add', onclick: () => { const e = s.add(v); if (e) toast(e); ctl.onChange(); s.again(); }, title: why ?? 'Giao việc này', disabled: !!why } });
    })));
    if (picked.length > this.shown) left.push(h('div', { class: 'btns' }, h('button', { class: 'sm', type: 'button', text: `Hiện thêm (${picked.length - this.shown})`, onclick: () => { this.shown += PAGE; s.again(); } })));
    return [...(s.addBlock ? [h('small', { class: 'dsub rwhy', text: s.addBlock })] : []), h('div', { class: 'rcols' }, h('div', { class: 'rcol' }, ...left), h('div', { class: 'rcol' }, ...right))];
  }
}
