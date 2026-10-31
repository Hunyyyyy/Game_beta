/**
 * The dialog of the game, one look for all of them: the details of a research, the quests, the notices, a question, the start.
 * `GameDialog` is the dark backdrop that holds one scroll (a click on the backdrop or Esc closes it); `dlg` makes the parts of the scroll.
 *
 *   const win = new GameDialog($('thing'), { onClose: () => … });
 *   win.show(dlg.card({}, dlg.head({ pic: '📜', title: 'Nhiệm vụ', onClose: () => win.hide() }), dlg.text('…'), dlg.button('Làm', go)));
 */
import { h } from './dom';

interface Options {
  /** The dialog sits inside its parent (a panel) instead of over the whole screen. */
  inside?: boolean;
  /** Only its own buttons close it: a click on the backdrop and Esc do nothing (the start screen). */
  modal?: boolean;
  /** Called when the player dismisses it (backdrop, Esc); `hide()` called by the program does not call it. */
  onClose?: () => void;
  /** Hiding only hides: what is inside stays (a panel that is kept and refreshed, like the one of a building). */
  keep?: boolean;
  /** Asked before Esc or a click on the backdrop closes it; false leaves it open (something over it handles the key). */
  canClose?: () => boolean;
}

export class GameDialog {
  constructor(readonly root: HTMLElement, private readonly opts: Options = {}) {
    root.classList.add('gdlg-back', opts.inside ? 'inside' : 'fixed');
    root.hidden = true;
    if (!opts.modal) {
      root.addEventListener('click', (e) => { if (e.target === root && (opts.canClose?.() ?? true)) this.dismiss(); });
      // Esc closes the dialog instead of also dropping the selection behind it
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen && (opts.canClose?.() ?? true)) { e.stopImmediatePropagation(); this.dismiss(); } }, true);
    }
  }

  get isOpen(): boolean { return !this.root.hidden; }

  /** Put a scroll in the dialog and show it. */
  show(...kids: Node[]): void { this.root.replaceChildren(...kids); this.root.hidden = false; }

  hide(): void { this.root.hidden = true; if (!this.opts.keep) this.root.replaceChildren(); }

  private dismiss(): void { this.hide(); this.opts.onClose?.(); }
}

interface HeadOptions {
  /** A picture (any element, e.g. a canvas) or a single character. */
  pic?: Node | string;
  title: string;
  sub?: string;
  /** A bar under the title; `label` is written on it. */
  bar?: { value: number; max: number; label?: string };
  onClose?: () => void;
}

/** The parts of a scroll. */
export const dlg = {
  /** The scroll. `wide` for lists. */
  card(o: { wide?: boolean; cls?: string; label?: string }, ...kids: Array<Node | null | false>): HTMLElement {
    return h('div', { class: `gdlg${o.wide ? ' wide' : ''}${o.cls ? ` ${o.cls}` : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': o.label }, ...kids);
  },

  /** The top: a picture, the title with what is under it, and the close button. */
  head(o: HeadOptions): HTMLElement {
    const pic = o.pic === undefined ? null : h('div', { class: `dpic${typeof o.pic === 'string' ? ' glyph' : ''}` }, o.pic);
    const bar = o.bar ? h('i', { class: 'dbar' }, h('b', { style: `width:${Math.round((100 * o.bar.value) / Math.max(1, o.bar.max))}%` }), h('span', { text: o.bar.label ?? '' })) : null;
    const close = o.onClose ? h('button', { class: 'dclose', text: '✕', title: 'Đóng', 'aria-label': 'Đóng', onclick: o.onClose }) : null;
    return h('div', { class: 'dhead' }, pic, h('div', { class: 'dwho' }, h('b', { class: 'dtitle', text: o.title }), o.sub ? h('small', { class: 'dsub', text: o.sub }) : null, bar), close);
  },

  /** A block of words on the parchment. */
  text(text: string): HTMLElement { return h('p', { class: 'dtext', text }); },
  /** A small line, for a reason or a need. `bad` is red. */
  note(text: string, bad = true): HTMLElement { return h('small', { class: bad ? 'lock' : 'dneed', text }); },
  /** A red line that says why something cannot be done. */
  why(text: string): HTMLElement { return h('p', { class: 'dwhy', text }); },
  /** Two sides of a line: what it is now, what it becomes. */
  line(a: string, b: string): HTMLElement { return h('div', { class: 'dline' }, h('span', { text: a }), h('span', { text: b })); },
  /** A row of costs; put `dlg.cost(...)` in it. */
  costs(...kids: Node[]): HTMLElement { return h('div', { class: 'dcosts' }, ...kids); },
  /** One cost: a picture, what is needed and what the village has. `short` turns it red. */
  cost(pic: Node, need: string, have: string | null, short: boolean, title?: string): HTMLElement {
    return h('span', { class: `dcost${short ? ' short' : ''}`, title }, pic, h('b', { text: need }), have === null ? null : h('small', { text: `/${have}` }));
  },

  /** A small round-cornered label with a picture and a number: how a person is, in place of a bar. `tone` colours it. */
  pill(pic: Node | string, text: string, tone?: 'good' | 'warn' | 'bad', title?: string): HTMLElement {
    return h('span', { class: `dpill${tone ? ` ${tone}` : ''}`, title }, h('span', { class: 'dpp' }, pic), h('b', { text }));
  },
  /** The places of a house as dots: `used` filled, the rest empty. More than 24 (no limit) is written as a number. */
  slots(used: number, total: number): HTMLElement {
    if (total > 24) return h('span', { class: 'dslots', text: `${used}/∞` });
    return h('span', { class: 'dslots', title: `${used}/${total}` }, ...Array.from({ length: total }, (_, i) => h('i', { class: i < used ? 'on' : '' })));
  },
  /** A round gauge with the percentage in the middle, for something that fills up (an order, a meal). */
  ring(value: number, label?: string): HTMLElement {
    const p = Math.max(0, Math.min(1, value));
    return h('span', { class: 'dring', style: `--p:${Math.round(p * 100)}` }, h('span', { text: label ?? `${Math.floor(p * 100)}%` }));
  },
  /** The big button. `tone` 'alt' is the quiet one (cancel), 'bad' the dangerous one. */
  button(text: string, onclick: () => void, o: { disabled?: boolean; tone?: 'alt' | 'bad'; small?: boolean; icon?: boolean; title?: string } = {}): HTMLButtonElement {
    return h('button', { class: `dgo${o.tone ? ` ${o.tone}` : ''}${o.small || o.icon ? ' sm' : ''}${o.icon ? ' ic' : ''}`, text, title: o.title, disabled: !!o.disabled, type: 'button', onclick }) as HTMLButtonElement;
  },
  /** Buttons side by side at the foot. */
  buttons(...kids: HTMLElement[]): HTMLElement { return h('div', { class: 'dbtns' }, ...kids); },

  /** A list of tiles. */
  list(...kids: Array<Node | null>): HTMLElement { return h('div', { class: 'dlist' }, ...kids); },
  empty(text: string): HTMLElement { return h('p', { class: 'dempty', text }); },
  /** A tile: a picture, a name with a chip, lines under it, and maybe a button. `state` colours it. */
  tile(o: { state?: 'now' | 'done' | 'lock' | 'next' | 'urgent' | 'warn' | 'info'; pic: Node | string; name: string; chip?: HTMLElement | null; title?: string }, lines: Array<Node | null>, action?: Node | null): HTMLElement {
    const pic = h('div', { class: `dpic${typeof o.pic === 'string' ? ' glyph' : ''}` }, o.pic);
    return h('div', { class: `dtile ${o.state ?? ''}`, title: o.title }, pic, h('div', { class: 'dmain' }, h('div', { class: 'dname' }, h('b', { text: o.name }), o.chip ?? null), ...lines), action ?? null);
  },
  chip(text: string): HTMLElement { return h('span', { class: 'dchip', text }); },
  /** A line of a tile: `more` is the short grey one. */
  more(text: string): HTMLElement { return h('div', { class: 'dmore', text }); },
  /** A bar on its own (progress of a chapter, of a quest). */
  bar(value: number, max: number, label = ''): HTMLElement {
    return h('i', { class: 'dbar' }, h('b', { style: `width:${Math.round((100 * value) / Math.max(1, max))}%` }), h('span', { text: label }));
  },
};
