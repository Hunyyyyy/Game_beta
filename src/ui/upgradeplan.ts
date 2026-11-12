import { BUILDINGS, footOf, levelDef } from '../sim/buildings';
import type { Building } from '../sim/buildings';
import { RES_NAME } from '../sim/resources';
import { costText, h } from './dom';
import type { Renderer } from '../render/renderer';
import type { Ctx } from './panels';

/**
 * A house whose next level covers more ground: the Nâng cấp button does not pay or send the builders at once. It shows the ground the house will have (a faint picture and a frame on
 * the map) and paints red whatever stands in the way. The player moves those houses away (Di dời is free); only when the ground is clear can he confirm, and then the bill is paid and
 * the builders start. This bar holds the plan while he does it: what is in the way, the bill, and the two buttons.
 */
export class UpgradePlanBar {
  readonly root = h('div', { class: 'planbar', hidden: true });
  private key = '';

  constructor(parent: HTMLElement, private readonly c: Ctx, private readonly r: Renderer) { parent.append(this.root); }

  /** Called as often as the screen is drawn: the bar and the picture on the map follow the plan. */
  update(): void {
    const { sim, ctl, toast } = this.c;
    const b: Building | undefined = ctl.upgradePlan === null ? undefined : sim.getBuilding(ctl.upgradePlan), g = b ? sim.growCheck(b) : null;
    if (!b || !g || !b.done || b.upgrading) { ctl.upgradePlan = null; this.root.hidden = true; this.r.plan = null; this.key = ''; return; } // it was done with, started or does not need more ground any more
    const cur = footOf(b), nx = levelDef(b, b.level + 1), why = sim.canUpgrade(b), clear = !g.hard && g.blockers.length === 0;
    this.r.plan = { kind: b.kind, era: b.era, level: b.level + 1, rect: g.rect, ok: clear, blockers: g.blockers.map((o) => ({ x: o.x, y: o.y, ...footOf(o) })) };
    const key = `${b.id}|${g.hard}|${g.blockers.map((o) => o.id).join()}|${why}`;
    if (key === this.key) return;
    this.key = key;
    const names = [...new Set(g.blockers.map((o) => BUILDINGS[o.kind].name.toLowerCase()))].join(', ');
    const state = g.hard ?? (g.blockers.length ? `Còn ${g.blockers.length} công trình vướng nền mới (tô đỏ trên bản đồ): ${names}. Dời chúng đi bằng nút Di dời.` : why ?? 'Nền đã trống. Vật liệu chỉ trả khi bạn bấm Nâng cấp.');
    const bill = sim.freeCost() ? {} : sim.buildBill(nx.cost);
    const go = h('button', { class: 'dgo', type: 'button', text: 'Nâng cấp', disabled: !clear || !!why,
      onclick: () => { const e = sim.upgradeBuilding(b.id); toast(e ?? 'Đã trả vật liệu. Giao Thợ xây để nâng cấp'); if (!e) ctl.upgradePlan = null; ctl.onChange(); } });
    const cancel = h('button', { class: 'dgo alt', type: 'button', text: 'Hủy kế hoạch', onclick: () => { ctl.upgradePlan = null; ctl.onChange(); } });
    this.root.replaceChildren(
      h('b', { text: `Nâng ${BUILDINGS[b.kind].name.toLowerCase()} lên cấp ${b.level + 1} (${nx.name.toLowerCase()}): nền ${cur.w}×${cur.h} → ${g.rect.w}×${g.rect.h}` }),
      h('div', { class: `planstate${clear && !why ? ' ok' : ' bad'}`, text: state }),
      h('small', { text: `Vật liệu: ${costText(bill, RES_NAME)}` }),
      h('div', { class: 'btns' }, go, cancel));
    this.root.hidden = false;
  }
}
