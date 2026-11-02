import { workDays } from '../sim/constants';
import { RES_NAME } from '../sim/resources';
import type { Stock } from '../sim/resources';
import { h } from './dom';
import { dlg, GameDialog } from './gamedialog';
import { resIcon } from './resicons';
import type { Ctx } from './ctx';

/** One thing that can be ordered from a house: a tool, a weapon, a suit of armour, a beast to tame. */
export interface OrderItem {
  id: string;
  /** Which filter chips it answers to (see `OrderGrid`). */
  tags: string[];
  name: string;
  /** What it is for, one line. */
  use: string;
  cost: Partial<Stock>;
  /** Work time (work-seconds). */
  time: number;
  icon: () => HTMLElement;
  /** Why it cannot be ordered at all yet (a blueprint, a house level), or null. */
  lock: () => string | null;
  /** Why no more can be ordered right now (a full store), or null. */
  full: () => string | null;
  /** How many are in store, and how many are waiting in the queue. */
  stored: () => number;
  queued: () => number;
  add: () => string | null;
  cancel: () => void;
  /** A line for the dialog about what it gives (speed of a beast ...). */
  extra?: () => string | null;
}

export interface OrderFilter { key: string; label: string }

/**
 * What is ordered from a house, as a grid of cards like the build menu and the research tree: a lock on what cannot be ordered yet, and a tap on a card
 * opens a scroll with its cost, what it needs and the buttons to put one more in the queue or take one out. Filters sit above the cards.
 */
export class OrderGrid {
  readonly root = h('div', { class: 'ogrid' });
  private readonly bar = h('div', { class: 'btns filters ofilters' });
  private readonly cards = h('div', { class: 'ocards' });
  private readonly dialog = new GameDialog(h('div', { class: 'ontop' }), { onClose: () => { this.picked = null; } });
  private readonly refresh: Array<() => void> = [];
  private picked: OrderItem | null = null;
  private pickedKey = '';
  private filter = '';
  private only = false;

  constructor(private readonly c: Ctx, private readonly items: OrderItem[], filters: OrderFilter[] = []) {
    document.body.append(this.dialog.root);
    if (filters.length) {
      const chips = [{ key: '', label: 'Tất cả' }, ...filters].map((f) => h('button', { class: 'sm chip', text: f.label, pressed: f.key === '', onclick: () => {
        this.filter = f.key; chips.forEach((b, i) => b.setAttribute('aria-pressed', String([{ key: '', label: '' }, ...filters][i].key === f.key))); this.update();
      } }));
      const only = h('button', { class: 'sm', text: 'Chỉ món có thể chế', title: 'Ẩn những món chưa mở khóa', pressed: false, onclick: () => { this.only = !this.only; only.setAttribute('aria-pressed', String(this.only)); this.update(); } });
      this.bar.append(...chips, only);
      this.root.append(this.bar);
    }
    this.root.append(this.cards);
    for (const it of items) this.cards.append(this.card(it));
  }

  private card(it: OrderItem): HTMLElement {
    const lockIcon = h('span', { class: 'clock', text: '🔒', hidden: true }), state = h('small', { class: 'state' }), cost = h('small', { text: costLine(it.cost) });
    const el = h('button', { class: 'ocard', type: 'button', onclick: () => { this.picked = it; this.render(); } }, h('span', { class: 'pic' }, it.icon(), lockIcon), h('b', { text: it.name }), cost, state);
    this.refresh.push(() => {
      const lock = it.lock(), n = it.queued();
      cost.textContent = costLine(it.cost); // the price can change (it grows with the level of the house)
      el.classList.toggle('locked', !!lock); lockIcon.hidden = !lock;
      state.textContent = lock ? '' : `kho ${it.stored()}${n ? ` · đợi ${n}` : ''}`;
      el.hidden = (!!this.filter && !it.tags.includes(this.filter)) || (this.only && !!lock);
    });
    return el;
  }

  /** The scroll of the card that was tapped. */
  private render(): void {
    const it = this.picked; if (!it) return;
    const { sim, ctl, toast } = this.c, lock = it.lock(), full = lock ? null : it.full(), queued = it.queued();
    const costs = (Object.keys(it.cost) as Array<keyof typeof it.cost>).filter((r) => (it.cost[r] ?? 0) > 0).map((r) => {
      const need = it.cost[r] ?? 0, have = Math.floor(sim.stock[r]);
      return dlg.cost(resIcon(r), String(need), String(have), have < need, RES_NAME[r]);
    });
    const poor = costs.some((x) => x.classList.contains('short')), extra = it.extra?.();
    const add = dlg.button('Thêm vào hàng đợi', () => { const e = it.add(); if (e) toast(e); ctl.onChange(); this.render(); }, { disabled: !!lock || !!full });
    const cancel = dlg.button(`Bỏ một đơn${queued ? ` (${queued})` : ''}`, () => { it.cancel(); ctl.onChange(); this.render(); }, { tone: 'alt', disabled: queued === 0 });
    const head = dlg.head({ pic: it.icon(), title: it.name, sub: `Trong kho ${it.stored()} · đang đợi ${queued}`, onClose: () => { this.picked = null; this.dialog.hide(); } });
    this.dialog.show(dlg.card({ label: it.name }, head, dlg.text(it.use), extra ? dlg.note(extra, false) : null,
      dlg.costs(...costs, dlg.cost(resIcon('clock'), workDays(it.time), null, false, 'Thời gian')),
      lock ? dlg.note(lock) : null, full ? dlg.note(full) : null, !lock && !full && poor ? dlg.note('Chưa đủ vật liệu: vật liệu được trừ ngay khi thêm vào hàng đợi') : dlg.note('Vật liệu trừ ngay khi thêm vào hàng đợi, hủy đơn thì được trả lại', false),
      dlg.buttons(add, cancel)));
    this.pickedKey = this.keyOf(it);
  }

  private keyOf(it: OrderItem): string {
    const { sim } = this.c;
    return `${it.lock()}|${it.full()}|${it.queued()}|${it.stored()}|${Object.keys(it.cost).map((r) => Math.floor(sim.stock[r as keyof Stock])).join()}`;
  }

  /** Refresh the cards every frame the panel shows; the scroll only when something in it changed. */
  update(): void {
    for (const f of this.refresh) f();
    if (this.picked && this.dialog.isOpen && this.keyOf(this.picked) !== this.pickedKey) this.render();
  }

  /** Put the scroll away (the panel is closed). */
  close(): void { this.picked = null; this.dialog.hide(); }
}

const costLine = (c: Partial<Stock>): string => (Object.keys(c) as Array<keyof Stock>).filter((k) => (c[k] ?? 0) > 0).map((k) => `${c[k]} ${RES_NAME[k].toLowerCase()}`).join(' + ') || 'miễn phí';
