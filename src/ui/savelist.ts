import type { SaveMeta } from '../save/store';
import { h } from './dom';
import { dlg } from './gamedialog';

/** A button that must be pressed twice within a few seconds: the first press only asks "sure?". For what cannot be undone. */
export function confirmButton(text: string, sure: string, run: () => void, o: { tone?: 'alt' | 'bad'; small?: boolean; title?: string } = {}): HTMLButtonElement {
  let until = 0, timer = 0;
  const b = dlg.button(text, () => {
    if (performance.now() < until) { window.clearTimeout(timer); until = 0; b.textContent = text; run(); return; }
    until = performance.now() + 3500; b.textContent = sure;
    timer = window.setTimeout(() => { until = 0; b.textContent = text; }, 3500);
  }, o);
  return b;
}

/** What a save is called in a list: the name the player gave it, else the day it was made on. */
export const saveTitle = (m: Pick<SaveMeta, 'name' | 'day'>): string => m.name || `Ván ngày ${m.day}`;

/** The day, the people and the time of a save, in two short lines. */
export const saveLines = (m: SaveMeta): HTMLElement[] => [
  dlg.more(`Ngày ${m.day} · ${m.population} dân`),
  dlg.more(`Lưu lúc ${new Date(m.savedAt).toLocaleString('vi')}`),
];

/** One save as a tile of a list, with its buttons: load it and (twice pressed) delete it. */
export function saveTile(m: SaveMeta, o: { current: boolean; locked: string | null; onLoad: () => void; onDelete: () => void }): HTMLElement {
  const load = dlg.button('Tải', o.onLoad, { small: true, disabled: !!o.locked, title: o.locked ?? 'Chơi tiếp từ bản lưu này' });
  const del = confirmButton('Xóa', 'Chắc chưa?', o.onDelete, { tone: 'bad', small: true, title: 'Xóa bản lưu này (không lấy lại được)' });
  return dlg.tile({ state: o.current ? 'now' : undefined, pic: '💾', name: saveTitle(m), chip: o.current ? dlg.chip('đang chơi') : null }, saveLines(m), h('div', { class: 'dacts' }, load, del));
}
