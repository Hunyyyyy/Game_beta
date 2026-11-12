import { workDays } from '../sim/constants';
import { MAX_QUEUE, PROCESS_HOUSES } from '../sim/processdata';
import type { ProcessRecipe } from '../sim/processdata';
import { RES_NAME } from '../sim/resources';
import type { Res } from '../sim/resources';
import type { Building } from '../sim/buildings';
import { h } from './dom';
import { ActiveBox } from './housebox';
import { resIcon } from './resicons';
import type { Ctx } from './ctx';

type Kind = 'smelter' | 'carpentry' | 'tannery';
const firstOf = (o: Partial<Record<Res, number>>): Res => Object.keys(o)[0] as Res;
const amounts = (o: Partial<Record<Res, number>>): Array<[Res, number]> => (Object.entries(o) as Array<[Res, number]>).filter(([, n]) => n > 0);

/**
 * The bench of a processing house (Lò luyện, Xưởng mộc, Xưởng thuộc da và dệt), laid out like a forge: the recipes in a list, and for the one picked the slots that go in
 * (what it needs, red when the store is short), the arrow with the time, and the slot that comes out. Under it the buttons that put 1, 5 or as many as can be paid into the queue,
 * and the queue as little cards with a cross to cancel. The order at work has a bar of its own (`active`), which the panel puts above the tabs.
 */
export class ForgePane {
  readonly root = h('div', { class: 'forge' });
  /** The order at work: a bar with its name and the time left (the panel puts it above the tabs). */
  readonly active: HTMLElement;
  private readonly activeBox: ActiveBox;
  private readonly recipes: ProcessRecipe[];
  private readonly list = h('div', { class: 'frecipes' });
  private readonly bench = h('div', { class: 'fbench' });
  private readonly queue = h('div', { class: 'fqueue' });
  private readonly note = h('div', { class: 'fnote' });
  private readonly buttons: HTMLButtonElement[] = [];
  private sel = '';
  private benchKey = ''; private queueKey = '';

  constructor(private readonly c: Ctx, private readonly kind: Kind) {
    this.recipes = PROCESS_HOUSES[kind];
    const recipe = (id: string) => this.recipes.find((r) => r.id === id);
    this.activeBox = new ActiveBox(c, (id) => recipe(id)?.name ?? id, (id) => recipe(id)?.time ?? 1, (id) => resIcon(firstOf(recipe(id)?.out ?? { wood: 1 })));
    this.active = this.activeBox.root;
    this.sel = this.recipes[0]?.id ?? '';
    for (const r of this.recipes) {
      const lock = h('span', { class: 'flock', text: '🔒', hidden: true });
      const btn = h('button', { class: 'frec', type: 'button', onclick: () => { this.sel = r.id; this.benchKey = ''; this.c.ctl.onChange(); } }, h('span', { class: 'fpic' }, resIcon(firstOf(r.out)), lock), h('b', { text: r.name }));
      (btn as HTMLButtonElement & { _lock?: HTMLElement; _id?: string })._lock = lock; (btn as HTMLButtonElement & { _id?: string })._id = r.id;
      this.buttons.push(btn as HTMLButtonElement); this.list.append(btn);
    }
    this.root.append(this.note, h('div', { class: 'fmain' }, this.list, this.bench), h('h4', { class: 'fhead', text: 'Hàng đợi' }), this.queue);
  }

  update(b: Building): void {
    const { sim } = this.c, recipe = this.recipes.find((r) => r.id === this.sel) ?? this.recipes[0];
    const staffed = b.staff.length > 0, orders = b.orders ?? [];
    this.note.textContent = staffed ? '' : 'Chưa có ai làm việc trong nhà (nút Nhân sự): đơn chưa chạy.';
    this.note.hidden = staffed;
    for (const btn of this.buttons) {
      const id = (btn as HTMLButtonElement & { _id?: string })._id!, r = this.recipes.find((x) => x.id === id)!, lock = sim.processLock(b, id);
      btn.classList.toggle('locked', !!lock); btn.setAttribute('aria-pressed', String(id === this.sel));
      ((btn as HTMLButtonElement & { _lock?: HTMLElement })._lock as HTMLElement).hidden = !lock; btn.title = lock ?? `${r.name}: ${amounts(r.in).map(([k, n]) => `${n} ${RES_NAME[k].toLowerCase()}`).join(' + ')}`;
    }
    this.activeBox.update(b);
    if (recipe) this.updateBench(b, recipe, orders.length);
    this.updateQueue(b, orders);
  }

  /** The recipe picked: what goes in, the arrow, what comes out, and the buttons. */
  private updateBench(b: Building, r: ProcessRecipe, queued: number): void {
    const { sim, ctl, toast } = this.c, lock = sim.processLock(b, r.id), full = queued >= MAX_QUEUE;
    const have = (k: Res) => Math.floor(sim.stock[k] ?? 0);
    const canMake = Math.min(...amounts(r.in).map(([k, n]) => Math.floor(have(k) / n)));
    const key = `${r.id}|${lock}|${queued}|${amounts(r.in).map(([k]) => have(k)).join()}|${amounts(r.out).map(([k]) => have(k)).join()}`;
    if (key === this.benchKey) return;
    this.benchKey = key;
    const slots: Node[] = [];
    amounts(r.in).forEach(([k, n], i) => {
      if (i > 0) slots.push(h('span', { class: 'fplus', text: '+' }));
      const short = have(k) < n;
      slots.push(h('div', { class: `fslot${short ? ' short' : ''}`, title: `${RES_NAME[k]}: cần ${n}, trong kho ${have(k)}` }, resIcon(k), h('b', { text: `${have(k)}/${n}` }), h('small', { text: RES_NAME[k].toLowerCase() })));
    });
    const out = amounts(r.out)[0];
    const add = (n: number) => () => {
      let done = 0, err: string | null = null;
      for (let i = 0; i < n; i++) { err = sim.queueProcess(b.id, r.id); if (err) break; done++; }
      if (err && done === 0) toast(err);
      ctl.onChange();
    };
    const blocked = !!lock || full;
    const btn = (text: string, n: number, title: string, off = blocked || canMake < 1) => h('button', { class: 'dgo sm', type: 'button', text, title, disabled: off, onclick: add(n) });
    this.bench.replaceChildren(
      h('div', { class: 'fforge' }, h('div', { class: 'fins' }, ...slots),
        h('div', { class: 'farrow', title: `Thời gian: ${workDays(r.time)} với một thợ` }, h('span', { text: '➜' }), h('small', { text: workDays(r.time) })),
        h('div', { class: 'fslot out', title: `${RES_NAME[out[0]]}: trong kho ${have(out[0])}` }, resIcon(out[0]), h('b', { text: `×${out[1]}` }), h('small', { text: `kho ${have(out[0])}` }))),
      h('div', { class: 'fwarn', text: lock ?? (full ? 'Hàng đợi đã đầy' : canMake < 1 ? 'Chưa đủ nguyên liệu: nguyên liệu trừ ngay khi thêm vào hàng đợi' : ''), hidden: !lock && !full && canMake >= 1 }),
      h('div', { class: 'fqty' }, btn('+1', 1, 'Thêm 1 đơn'), btn('+5', 5, 'Thêm 5 đơn (nếu đủ nguyên liệu)'), btn('Tối đa', MAX_QUEUE, `Thêm bao nhiêu đơn cũng được theo nguyên liệu đang có (tối đa ${MAX_QUEUE} đơn trong hàng đợi)`),
        h('small', { class: 'fcount', text: `Hàng đợi ${queued}/${MAX_QUEUE}` })));
  }

  /** The waiting orders, one card each, with a cross that cancels it (what it took comes back). */
  private updateQueue(b: Building, orders: readonly string[]): void {
    const key = orders.join();
    if (key === this.queueKey) return;
    this.queueKey = key;
    if (!orders.length) { this.queue.replaceChildren(h('small', { class: 'fempty', text: 'Trống' })); return; }
    this.queue.replaceChildren(...orders.map((id) => {
      const r = this.recipes.find((x) => x.id === id);
      return h('div', { class: 'fcard', title: r?.name ?? id }, h('span', { class: 'fpic' }, resIcon(r ? firstOf(r.out) : 'wood')), h('b', { text: r?.name ?? id }),
        h('button', { class: 'fx', type: 'button', text: '✕', title: 'Hủy đơn này: nguyên liệu được trả lại', onclick: () => { this.c.sim.unqueueProcess(b.id, id); this.c.ctl.onChange(); } }));
    }));
  }
}
