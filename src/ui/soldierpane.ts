import type { Villager } from '../sim/sim';
import type { Ctx } from './ctx';
import { describe } from './describe';
import { h } from './dom';

const energyBar = (v: Villager) => h('div', { class: 'bars', style: 'width:90px;display:block' }, h('i', {}, h('b', { class: v.energy < 20 ? 'en low' : 'en', style: `width:${v.energy}%` })));

/** The villagers lying in a house (the Nhà dân or the Lều chiến binh): a list with their strength, no drawing of them asleep. */
export function sleeperRows(sim: Ctx['sim'], list: Villager[]): HTMLElement[] {
  return list.map((v) => h('div', { class: 'row' }, h('div', { class: 'nm' }, v.name, h('small', { text: describe(v, sim) })), energyBar(v)));
}
