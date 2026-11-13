/**
 * The talk with a visitor (doc/encounter_dialogue_design_stone_age.md, section 7): a scene along the bottom of the screen. The visitor stands in the bottom-left corner (a bust cut from the rig of
 * the game), the words come letter by letter in a wide frame, the choices are numbered cards. Click anywhere (or Space) for the next line; 1-9 choose; Esc puts the talk off.
 * The screen only reads and orders through `Sim` (encounterView, encounterAdvance, encounterChoose, encounterLater).
 */
import { ENC } from '../sim/encounterdata';
import type { EncounterView } from '../sim/encounters';
import type { Villager } from '../sim/sim';
import { h } from './dom';
import type { Ctx } from './ctx';
import { resIcon } from './resicons';

const busts = new Map<string, HTMLCanvasElement>();

/** The portrait of a visitor: the rig cut to the upper body. One function so a painted bust can take its place later without touching the rest. */
export function portraitOf(c: Ctx, unitId: number): HTMLCanvasElement {
  const v = c.sim.get(unitId);
  const out = document.createElement('canvas');
  if (!v) { out.width = out.height = 1; return out; }
  const key = `${v.look.sex}|${v.look.skin}|${v.look.hair}|${v.look.hide}|${v.look.pants}|${v.armor ?? c.sprites.outfitOf(v) ?? '-'}`;
  let src = busts.get(key);
  if (!src) {
    const still = { ...v, facing: 'front', anim: 'idle', animClock: 0, hold: null, carry: null, lit: false } as Villager;
    const sheet = c.sprites.villager(still, 'idle'), px = sheet.getContext('2d')!.getImageData(0, 0, sheet.width, sheet.height).data;
    let x0 = sheet.width, x1 = -1, y0 = sheet.height, y1 = -1;
    for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) if (px[(y * sheet.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    src = document.createElement('canvas');
    if (x1 < 0) src.width = src.height = 1;
    else {
      const w = x1 - x0 + 1, hh = Math.ceil((y1 - y0 + 1) * 0.72); // head, shoulders and the chest
      src.width = w; src.height = hh; src.getContext('2d')!.drawImage(sheet, x0, y0, w, hh, 0, 0, w, hh);
    }
    busts.set(key, src);
  }
  out.width = src.width; out.height = src.height; out.getContext('2d')!.drawImage(src, 0, 0);
  return out;
}

const mood = (label: string): string => (label === 'Thù địch' ? 'bad' : label === 'Trung lập' ? 'mid' : 'good');

export class Dialogue {
  private key = '';
  private line = -1;
  private t0 = 0;
  private full = false;
  private fullAt = 0;
  private shown = 0;
  private choicesBuilt = false;
  private textEl: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  private cardsEl: HTMLElement | null = null;
  private notesEl: HTMLElement | null = null;
  private relEl: HTMLElement | null = null;
  private youEl: HTMLElement | null = null;
  /** The group of choices opened now, and which choices (their places) are on screen, in the order of the number keys. */
  private openGroup = '';
  private visible: number[] = [];
  private who = -1;
  private watch: ResizeObserver | null = null;
  private rev = -1;

  constructor(private readonly c: Ctx, private readonly root: HTMLElement) {
    root.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) this.next(); });
    // while a talk is open the keys belong to it (the number keys would otherwise pick groups of soldiers)
    window.addEventListener('keydown', (e) => {
      if (this.root.hidden) return;
      const k = e.key;
      if (k === 'Escape') this.c.sim.encounterLater(); // Esc: put it off
      else if (k === ' ' || k === 'Enter') this.next();
      else if (/^[1-9]$/.test(k)) { const pos = this.visible[Number(k) - 1]; if (pos !== undefined) this.choose(pos); }
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
  }

  /** Called every frame: open, change and close with the state of the talk. */
  update(): void {
    const v = this.c.sim.encounterView();
    if (!v) { if (!this.root.hidden) { this.root.hidden = true; this.root.replaceChildren(); this.key = ''; this.who = -1; this.watch?.disconnect(); this.c.ctl.returnView(); } return; }
    if (v.key !== this.key) { // a new node: the scene is built only for a new visitor (or after it was closed); within one talk the figure and the frame stay, and only the words change
      this.key = v.key; this.line = -1; this.rev = -1; this.openGroup = '';
      if (this.root.hidden || v.visitorId !== this.who) { this.who = v.visitorId; this.build(v); }
      else if (this.relEl) { this.relEl.textContent = v.relation; this.relEl.className = `dlg-rel ${mood(v.relation)}`; }
    }
    if (v.rev !== this.rev) { this.rev = v.rev; this.notesEl?.replaceChildren(...v.notes.map((n) => h('span', { class: 'dlg-note', text: `✎ ${n}` }))); this.choicesBuilt = false; } // a clue came out, or a choice was used: the notes and the cards are drawn again
    if (v.line !== this.line) { this.line = v.line; this.t0 = performance.now(); this.full = false; this.shown = 0; this.choicesBuilt = false; this.cardsEl?.replaceChildren(); if (this.hintEl) this.hintEl.hidden = true; }
    const cur = v.lines[v.line], text = cur?.text ?? '', now = performance.now();
    if (this.youEl) { this.youEl.textContent = v.you ? `“${v.you}”` : ''; this.youEl.hidden = !v.you; }
    const n = this.full ? text.length : Math.min(text.length, Math.floor(((now - this.t0) / 1000) * ENC.typeCps));
    if (n !== this.shown && this.textEl) { this.shown = n; this.textEl.textContent = text.slice(0, n); }
    if (n >= text.length && !this.full) { this.full = true; this.fullAt = now; }
    if (this.full && !this.choicesBuilt) this.finishLine(v);
  }

  private build(v: EncounterView): void {
    const bust = portraitOf(this.c, v.unitId);
    this.textEl = h('p', { class: 'dlg-text' });
    this.hintEl = h('span', { class: 'dlg-more', text: '▼ bấm để tiếp', hidden: true });
    this.cardsEl = h('div', { class: 'dlg-cards' });
    this.notesEl = h('div', { class: 'dlg-notes' });
    let panel: HTMLElement;
    this.root.replaceChildren(
      h('div', { class: 'dlg-paused', text: '💬 Đang trò chuyện · ngoài khung hình tạm dừng' }),
      h('div', { class: 'dlg-bust' }, bust),
      (panel = h('div', { class: 'dlg-panel' },
        h('div', { class: 'dlg-head' },
          h('div', { class: 'dlg-plate' }, h('b', { text: v.name.toUpperCase() }), h('span', { text: v.tribe }), (this.relEl = h('i', { class: `dlg-rel ${mood(v.relation)}`, text: v.relation }))),
          h('div', { class: 'dlg-tools' }, h('button', { class: 'sm', type: 'button', onclick: () => this.c.sim.encounterLater() }, 'Để sau ', h('kbd', { text: 'Esc' })))),
        (this.youEl = h('div', { class: 'dlg-you', hidden: true })),
        h('div', { class: 'dlg-frame' }, this.textEl, this.hintEl),
        this.notesEl,
        this.cardsEl)));
    this.watch?.disconnect(); this.watch = new ResizeObserver(() => this.root.style.setProperty('--panel-h', `${panel.offsetHeight}px`)); this.watch.observe(panel); // (on a phone the figure stands on the top edge of the panel, whatever its height)
    if (this.root.hidden) { const f = this.c.sim.get(v.unitId); if (f) this.c.ctl.flyToTile(f.x, f.y); }
    this.root.hidden = false;
  }

  /** The line is all on screen: show the choices after the last line, or the hint to go on. */
  private finishLine(v: EncounterView): void {
    this.choicesBuilt = true;
    const last = v.line >= v.lines.length - 1;
    if (!last || !v.choices.length) { if (this.hintEl) this.hintEl.hidden = false; return; }
    this.visible = [];
    const els: HTMLElement[] = [], seen = new Set<string>();
    v.choices.forEach((ch, pos) => {
      if (ch.group) { // choices of one group are folded under a button, opened by a click
        if (!seen.has(ch.group)) {
          seen.add(ch.group);
          const n = v.choices.filter((x) => x.group === ch.group).length, open = this.openGroup === ch.group, name = ch.group;
          els.push(h('button', { class: `dlg-card dlg-group${open ? ' open' : ''}`, type: 'button', onclick: () => { this.openGroup = open ? '' : name; this.choicesBuilt = false; } }, h('span', { class: 'dlg-chev', text: open ? '▾' : '▸' }), h('span', { class: 'dlg-ctext', text: `${name} (${n})` })));
        }
        if (this.openGroup !== ch.group) return;
      }
      this.visible.push(pos);
      const chips: HTMLElement[] = ch.price.map((p) => h('span', { class: 'dlg-chip' }, resIcon(p.res), `−${p.n}`));
      if (ch.blocked) chips.push(h('span', { class: 'dlg-chip warn', text: `⚠ ${ch.blocked}` }));
      els.push(h('button', { class: 'dlg-card', type: 'button', disabled: !!ch.blocked, onclick: () => this.choose(pos) }, h('span', { class: 'dlg-num', text: String(this.visible.length) }), h('span', { class: 'dlg-ctext', text: ch.text }), chips.length ? h('span', { class: 'dlg-chips' }, ...chips) : null));
    });
    this.cardsEl?.replaceChildren(...els);
  }

  /** Click or Space: finish the line being typed, or go to the next one (not at once after a line is whole: one click must not do both). */
  private next(): void {
    const v = this.c.sim.encounterView();
    if (!v) return;
    const now = performance.now();
    if (!this.full) { this.full = true; this.fullAt = now; return; }
    if (now - this.fullAt < ENC.inputGuardMs) return;
    if (v.line < v.lines.length - 1 || !v.choices.length) this.c.sim.encounterAdvance();
  }

  /** Take the choice shown at place `pos` (the number on its card and its key); the game wants the choice's own number, which differs when some choices are hidden by their conditions. */
  private choose(pos: number): void {
    const v = this.c.sim.encounterView();
    if (!v || !this.full || v.line < v.lines.length - 1 || !v.choices[pos] || performance.now() - this.fullAt < ENC.inputGuardMs) return;
    const e = v.choices[pos].blocked ? v.choices[pos].blocked : this.c.sim.encounterChoose(v.choices[pos].index);
    if (e) this.c.toast(e);
  }
}
