/**
 * The small card over the map that tells what was tapped and offers a few buttons: a villager (job, what they do, "Giao việc") or a house (state, what it brings in, open, upgrade, move, demolish).
 * One component, so the two look and behave the same; the owner calls `set()` as often as it likes and only what changed is touched.
 */
import { h } from './dom';

export interface InfoAction {
  id: string; label: string; title?: string; tone?: 'primary' | 'danger';
  hidden?: boolean; disabled?: boolean; onClick: () => void;
}
export interface InfoData {
  /** Changes when the picture has to be drawn again. */
  picKey: string;
  /** The picture: a canvas, any element, or a character. */
  pic: () => Node | string;
  title: string;
  /** Under the title: the trade of a villager, the level of a house. */
  sub: string;
  /** One more line: what they do now, what the house brings in. */
  line?: string;
  actions: InfoAction[];
  /** The ✕; none hides it. */
  onClose?: () => void;
}

export class InfoCard {
  private readonly pic = h('div', { class: 'ipic' });
  private readonly title = h('b'); private readonly sub = h('small');
  private readonly line = h('div', { class: 'iline', hidden: true });
  private readonly close = h('button', { class: 'iclose', text: '✕', title: 'Đóng', 'aria-label': 'Đóng', type: 'button' }) as HTMLButtonElement;
  private readonly acts = h('div', { class: 'iacts' });
  private buttons = new Map<string, HTMLButtonElement>();
  private sig = ''; private picKey = '';
  private actions: InfoAction[] = []; private onClose?: () => void;

  constructor(readonly root: HTMLElement) {
    root.classList.add('infocard');
    this.close.addEventListener('click', () => this.onClose?.());
    root.append(h('div', { class: 'ihead' }, this.pic, h('div', { class: 'iwho' }, this.title, this.sub), this.close), this.line, this.acts);
  }

  set(d: InfoData): void {
    if (d.picKey !== this.picKey) {
      this.picKey = d.picKey;
      const p = d.pic();
      this.pic.className = `ipic${typeof p === 'string' ? ' glyph' : ''}`; this.pic.replaceChildren(p);
    }
    this.title.textContent = d.title; this.sub.textContent = d.sub;
    this.line.textContent = d.line ?? ''; this.line.hidden = !d.line;
    this.onClose = d.onClose; this.close.hidden = !d.onClose;
    this.actions = d.actions;
    const sig = d.actions.map((a) => a.id).join();
    if (sig !== this.sig) {
      this.sig = sig; this.buttons = new Map();
      this.acts.replaceChildren(...d.actions.map((a) => {
        const b = h('button', { type: 'button', onclick: () => this.actions.find((x) => x.id === a.id)?.onClick() }) as HTMLButtonElement;
        this.buttons.set(a.id, b); return b;
      }));
    }
    for (const a of d.actions) {
      const b = this.buttons.get(a.id)!;
      b.textContent = a.label; b.title = a.title ?? ''; b.hidden = !!a.hidden; b.disabled = !!a.disabled;
      b.className = a.tone ?? '';
    }
  }
}
