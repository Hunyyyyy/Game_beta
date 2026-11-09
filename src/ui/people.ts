/** How a villager looks in a list of a house: one tile, the same everywhere (the houses of a role, the beds, the staff of a house). Change it here. */
import { roleName, roleOf } from '../sim/jobs';
import { CHAINS } from '../sim/research';
import type { Villager } from '../sim/model';
import type { Ctx } from './ctx';
import { describe, equipParts, gearLine, vitalsLine } from './describe';
import { icon } from './icons';
import { dlg } from './gamedialog';
import { h, iconCanvas } from './dom';
import { statIcon } from './resicons';
import { statPill } from './statview';
import type { StatId } from './statview';

interface PersonOptions {
  /** The line under the name; by default what they are doing. */
  note?: string;
  /** Buttons at the right (use `dlg.button(..., { icon: true })`). */
  actions?: Array<HTMLElement | null>;
  /** Show how healthy and rested they are (on by default). */
  vitals?: boolean;
  /** Show these stats instead (the ones that matter for the house, see `roleStats`). */
  stats?: StatId[];
  /** Show their trade next to the name. */
  trade?: boolean;
  state?: 'now' | 'done' | 'lock';
}

const faces = new Map<string, HTMLCanvasElement>();
/**
 * The face of a villager, cut from the same drawing the map uses (head and shoulders, facing us), so a list shows the person as they look in the game.
 * Drawn once for each look and kept; every call gives a fresh copy to put in the page.
 */
export function avatar(c: Ctx, v: Villager): HTMLElement {
  const key = `${v.look.sex}|${v.look.skin}|${v.look.hair}|${v.armor ?? '-'}`;
  let face = faces.get(key);
  if (!face) {
    const still = { ...v, facing: 'front', anim: 'idle', animClock: 0, hold: null, carry: null, lit: false } as Villager;
    const src = c.sprites.villager(still, 'idle'), px = src.getContext('2d')!.getImageData(0, 0, src.width, src.height).data;
    let x0 = src.width, x1 = -1, y0 = src.height, y1 = -1;
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (px[(y * src.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    face = document.createElement('canvas');
    if (x1 < 0) { face.width = face.height = 1; } else {
      const w = x1 - x0 + 1, hh = Math.ceil((y1 - y0 + 1) * 0.45);
      face.width = w; face.height = hh; face.getContext('2d')!.drawImage(src, x0, y0, w, hh, 0, 0, w, hh);
    }
    faces.set(key, face);
  }
  return iconCanvas(face);
}

/** A tile for one villager: a face, the name and trade, a line of note, the health and energy as numbers, and the buttons. */
export function personTile(c: Ctx, v: Villager, o: PersonOptions = {}): HTMLElement {
  const { sim } = c, role = roleOf(v);
  const hp = v.health / v.maxHealth;
  const pills = o.stats ? h('div', { class: 'dpills' }, ...o.stats.map((id) => statPill(sim, v, id))) : o.vitals === false ? null : h('div', { class: 'dpills' },
    dlg.pill(statIcon('hp'), `${Math.ceil(v.health)}`, hp < 0.35 ? 'bad' : hp < 0.7 ? 'warn' : undefined, 'Máu hiện có'),
    dlg.pill(statIcon('sta'), `${Math.round(v.energy)}%`, v.energy < 20 ? 'bad' : v.energy < 50 ? 'warn' : undefined, 'Sức còn lại'));
  const trade = o.trade && role ? dlg.chip(roleName(role, sim.era)) : null;
  return dlg.tile({ pic: avatar(c, v), name: v.name, chip: trade, state: o.state }, [o.note === '' ? null : dlg.more(o.note ?? describe(v, sim)), gearLine(v) ? dlg.more(gearLine(v)) : null, o.stats ? dlg.more(vitalsLine(sim, v)) : null, pills], o.actions?.some(Boolean) ? h('div', { class: 'dacts' }, ...o.actions) : null);
}

/** The strip along the edge of a row: `add` (an arrow to the right, at the right edge) or `remove` (an arrow to the left, at the left edge); it is as tall as the row. */
export interface RowStrip { kind: 'add' | 'remove'; onclick: () => void; title: string; disabled?: boolean }

/**
 * A short row for a villager in the two lists of a house: the name (and a chip), what they carry (weapon or tool, armour), health and energy on the line of the name, icon buttons at the right and an arrow strip along the edge that moves them to the other list. A tap on the row opens the detail.
 */
export function personRow(c: Ctx, v: Villager, o: { chip?: string; strip?: RowStrip; actions?: Array<HTMLElement | null> } = {}): HTMLElement {
  const { sim } = c, acts = o.actions?.filter(Boolean) ?? [], maxE = sim.maxEnergy(v), eq = equipParts(v);
  const part = (name: 'weapon' | 'tool' | 'equip' | 'hp' | 'energy', text: string, o2: { low?: boolean; title: string }) => h('span', { class: `pstat${o2.low ? ' low' : ''}`, title: o2.title }, icon(name, 13), text);
  const strip = o.strip ? h('button', { class: `pstrip ${o.strip.kind}`, type: 'button', title: o.strip.title, 'aria-label': o.strip.title, disabled: !!o.strip.disabled, onclick: o.strip.onclick }, icon(o.strip.kind === 'add' ? 'next' : 'prev', 18)) : null;
  const body = h('div', { class: 'pbody', title: 'Bấm để xem chi tiết và giao việc' },
    h('div', { class: 'phead' },
      h('div', { class: 'dname' }, h('b', { text: v.name }), o.chip ? dlg.chip(o.chip) : null),
      h('div', { class: 'pvit' },
        part('hp', `${Math.max(0, Math.ceil(v.health))}/${Math.round(v.maxHealth)}`, { low: v.health / v.maxHealth < 0.35, title: 'Máu' }),
        part('energy', `${Math.round(v.energy)}/${Math.round(maxE)}`, { low: v.energy < 20, title: 'Sức' }))),
    h('div', { class: 'pmeta' }, part(eq.kind, eq.main, { title: eq.kind === 'weapon' ? 'Vũ khí' : 'Dụng cụ' }), eq.armor ? part('equip', eq.armor, { title: 'Giáp' }) : null));
  body.addEventListener('click', () => openDetail(c, v));
  return h('div', { class: `dtile prow${o.strip ? ` has-${o.strip.kind}` : ''}` }, o.strip?.kind === 'remove' ? strip : null, body, acts.length ? h('div', { class: 'dacts' }, ...acts) : null, o.strip?.kind === 'add' ? strip : null);
}

/** The button that opens the detail dialog of a villager. */
export function detailButton(c: Ctx, v: Villager, title = 'Giao việc và chi tiết'): HTMLButtonElement {
  return dlg.button('⚙', () => openDetail(c, v), { icon: true, title });
}

/** Open the detail dialog of a villager (it comes back to this house when closed). */
export function openDetail(c: Ctx, v: Villager): void {
  const { ctl } = c;
  ctl.detailFrom = ctl.selectedBuilding; ctl.selected.clear(); ctl.selected.add(v.id); ctl.openDetail = true; ctl.closeBuilding();
}

/** The stats that matter for a role: the line of the research tree it belongs to (the soldiers also have the stats of the weapon in their hand). */
export function roleStats(role: string): StatId[] {
  if (role === 'guard') role = 'foot';
  const chain = Object.values(CHAINS).find((ch) => ch.roles.includes(role));
  const ids = (chain?.order ?? []) as StatId[];
  return role === 'foot' || role === 'cavalry' || role === 'archer' ? [...ids, 'aspd', 'crit', 'critd'] : ids;
}
