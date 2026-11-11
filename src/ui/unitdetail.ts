import { CRAFTED_WEAPONS, WEAPONS } from '../sim/combat';
import type { WorkJob } from '../sim/jobs';

import { MOUNT_KINDS, MOUNTS } from '../sim/jobs';
import type { MountKind } from '../sim/jobs';
import { critChance, critMult, guardCut, rawValue, statValue, swingCycle } from '../sim/statsys';
import type { Villager } from '../sim/sim';
import { TIER_DURABILITY, TIER_NAME, TOOL_KINDS, TOOL_NAME, TOOL_OF_JOB, ToolKind } from '../sim/tools';
import { h } from './dom';
import { statIcon } from './resicons';
import type { Ctx } from './ctx';
import { STAT_LABEL, STAT_ORDER, statReading } from './statview';
import type { StatCell } from './statview';
import { energyText, SHIFT_TIP, armorText } from './describe';
import { ARMORS } from '../sim/combat';

const KEY_STATS: readonly string[] = ['hp', 'atk', 'defm', 'defr', 'move', 'sta'];
const SHIFT_SHORT = { day: 'Ngày', night: 'Đêm', both: 'Cả hai' } as const;
const STANCES = [['aggressive', 'Chủ động', 'Đuổi địch trong tầm nhìn'], ['defensive', 'Phòng thủ', 'Chỉ đánh địch lại gần, không rời chỗ'], ['retreat', 'Rút lui', 'Không đánh, chạy về lửa trại']] as const;

/**
 * Everything about the chosen villagers that the player can read or order: the eleven stats, the shift and the torch, fighting orders, gear and tools.
 * One body, shown in the detail dialog of a villager and in the list of the campfire, so both say the same.
 */
export class UnitDetail {
  readonly body: HTMLElement;
  private readonly statCells: Array<{ id: StatCell['id']; value: HTMLElement; cell: HTMLElement }> = [];
  private readonly shiftBtns: HTMLButtonElement[] = []; private readonly rest = h('div', { class: 'kv' }); private readonly torchBtn = h('button', { class: 'sm', text: 'Phát đuốc' }) as HTMLButtonElement;
  private readonly gear = h('div', { class: 'kv' });
  private readonly toolRows: Array<{ k: ToolKind; row: HTMLElement; state: HTMLElement; pick: HTMLSelectElement; drop: HTMLButtonElement }> = [];
  /** The beast he rides: a drop-down of what the stable holds, for soldiers (the riders of the camp have their own), hunters and scouts. */
  private readonly mountSec: HTMLElement; private readonly mountPick: HTMLSelectElement;
  private gearSec: HTMLElement | null = null; private toolsSec!: HTMLElement;
  private readonly stanceBtns: HTMLButtonElement[];
  private readonly gearSel: Array<{ pick: HTMLSelectElement; slot: 'weapon' | 'armor'; label: string; kinds: string[] }> = [];

  /**
   * `ids` are the villagers the orders go to; `leave` is called when an order needs the player back on the map.
   * `after` runs once a gear or tool order is done (by default nothing: the dialog stays as it is).
   */
  constructor(private readonly c: Ctx, o: { ids: () => number[]; leave: () => void; after?: () => void }) {
    const { sim, ctl } = c, ids = o.ids, after = o.after ?? (() => undefined); // the dialog stays open: choosing a tool or a weapon must not close it (nor the house dialog it came from)
    this.stanceBtns = STANCES.map(([s, label, tip]) => h('button', { class: 'sm', 'data-stance': s, pressed: false, text: label, title: tip, onclick: () => { sim.setStance(ids(), s); ctl.onChange(); } }));
    // Handing out gear from the workshop's stock: soldiers carry what they are given
    // two drop-downs, one for the weapon and one for the armour: "Tự động" lets the workshop hand out the best it has, "Không có" gives the piece back
    const gearRow = h('div', { class: 'dgear' });
    const addGear = (slot: 'weapon' | 'armor', label: string, kinds: string[]) => {
      const pick = h('select', { class: 'sm', 'aria-label': label, title: `${label}: lấy từ kho Xưởng, hoặc trả về kho`, onchange: () => {
        if (pick.value === '') return;
        const e = sim.assignGear(ids(), pick.value === 'none' ? null : pick.value, slot); if (e) c.toast(e); else after(); ctl.onChange();
      } }) as HTMLSelectElement;
      pick.append(h('option', { value: '', text: '— chọn —', hidden: true }), h('option', { value: 'none' }), ...kinds.map((k) => h('option', { value: k })));
      this.gearSel.push({ pick, slot, label, kinds }); gearRow.append(h('div', { class: 'row' }, h('div', { class: 'nm', text: label }), pick));
    };
    addGear('weapon', 'Vũ khí', CRAFTED_WEAPONS as unknown as string[]); addGear('armor', 'Giáp', Object.keys(ARMORS));

    this.mountPick = h('select', { class: 'sm', 'aria-label': 'Thú cưỡi', title: 'Thú đã thuần trong chuồng; đổi thú thì thú cũ về chuồng', onchange: () => {
      if (this.mountPick.value === '') return;
      const e = sim.assignMount(ids(), this.mountPick.value === 'none' ? null : (this.mountPick.value as MountKind)); if (e) c.toast(e); else after(); ctl.onChange();
    } }) as HTMLSelectElement;
    this.mountPick.append(h('option', { value: '', text: '— chọn —', hidden: true }), h('option', { value: 'none' }), ...MOUNT_KINDS.map((k) => h('option', { value: k })));
    this.mountSec = h('section', { class: 'dgear' }, h('div', { class: 'row' }, h('div', { class: 'nm', text: 'Thú cưỡi' }), this.mountPick));


    // tools: handed out of the stock, mended or thrown away by hand
    const toolsSec = h('section', { class: 'dgear' });
    for (const k of TOOL_KINDS) {
      const state = h('small'), pick = h('select', { class: 'sm', 'aria-label': TOOL_NAME[k], title: 'Đổi công cụ; "Tay không" trả công cụ về kho, giữ nguyên độ bền', onchange: () => {
        if (pick.value === '') return;
        const e = sim.assignTool(ids(), k, Number(pick.value)); if (e) c.toast(e); else after(); ctl.onChange();
      } }) as HTMLSelectElement;
      pick.append(h('option', { value: '', text: '— chọn —', hidden: true }), ...[0, 1, 2].map((t) => h('option', { value: String(t) })));
      const drop = h('button', { class: 'sm', text: '✕', title: 'Vứt công cụ, kể cả khi chưa hỏng', onclick: () => { sim.discardTool(ids(), k); after(); ctl.onChange(); } }) as HTMLButtonElement;
      const row = h('div', { class: 'row' }, h('div', { class: 'nm' }, TOOL_NAME[k], state), h('div', { class: 'btns' }, pick, drop));
      this.toolRows.push({ k, row, state, pick, drop });
      toolsSec.append(row);
    }
    this.torchBtn.addEventListener('click', () => { const e = sim.giveTorch(ids()); if (e) c.toast(e); ctl.onChange(); });
    const shiftSec = h('section', { class: 'dwork' },
      h('div', { class: 'btns', role: 'group', 'aria-label': 'Ca làm' }, ...(['day', 'night', 'both'] as const).map((sh) => { const btn = h('button', { class: 'sm', text: SHIFT_SHORT[sh], title: SHIFT_TIP[sh], 'data-shift': sh, pressed: false, onclick: () => { sim.setShift(ids(), sh); ctl.onChange(); } }) as HTMLButtonElement; this.shiftBtns.push(btn); return btn; }), this.torchBtn),
      this.rest);
    this.toolsSec = toolsSec;
    const moreBtn = h('button', { class: 'sm', text: 'Xem đủ chỉ số ▾', onclick: () => { this.statsOpen = !this.statsOpen; moreBtn.textContent = this.statsOpen ? 'Thu gọn ▴' : 'Xem đủ chỉ số ▾'; this.showStats(); } }) as HTMLButtonElement;
    this.body = h('div', { class: 'dbody' },
        h('section', { class: 'dsec' }, this.statsGrid(), moreBtn),
        shiftSec,
        this.gearSec = h('section', { class: 'dgear' }, gearRow),
        this.mountSec,
        toolsSec,
      );
  }

  /** Draw the state of the first of `chosen`; the buttons answer for all of them. */
  update(chosen: Villager[]): void {
    if (!chosen.length) return;
    const sim0 = this.c.sim, v = chosen[0], w = v.weapon ? WEAPONS[v.weapon].name : 'tay không';
    for (const g of this.gearSel) {
      const cur = new Set(chosen.map((o) => (g.slot === 'weapon' ? o.weapon : o.armor) ?? 'none')), want = cur.size === 1 ? [...cur][0] : '';
      g.pick.querySelectorAll('option').forEach((op) => {
        if (op.value === '') return;
        if (g.slot === 'weapon' && op.value !== 'none') op.hidden = chosen.some((o) => !sim0.canCarry(o, op.value)); // a foot soldier or a rider is not offered a bow, a thrower not a spear
        const text = op.value === 'none' ? 'Không có' : `${g.slot === 'armor' ? ARMORS[op.value].name : WEAPONS[op.value].name} (${sim0.toolCount(op.value, g.slot === 'armor' ? ARMORS[op.value].tier ?? 1 : WEAPONS[op.value].tier ?? 1)})`;
        if (op.textContent !== text) op.textContent = text;
      });
      if (g.pick.value !== want && document.activeElement !== g.pick) g.pick.value = want;
    }
    this.gear.innerHTML = `Vũ khí <b>${w}</b> · Giáp <b>${v.armor ? ARMORS[v.armor].name : '—'}</b>${v.armor ? ` (${armorText(ARMORS[v.armor], false)})` : ''}${v.leader ? ' · <b>Thủ lĩnh</b>' : ''}`;
    // the beast: soldiers who are not riders of the camp, hunters and scouts
    const canRide = chosen.every((o) => (o.job === 'fight' && o.arm === 'cavalry') || o.job === 'hunt' || o.job === 'scout');
    this.mountSec.hidden = !canRide;
    if (canRide) {
      const kinds = new Set(chosen.map((o) => o.mount ?? 'none')), want = kinds.size === 1 ? [...kinds][0] : '';
      this.mountPick.querySelectorAll('option').forEach((op) => {
        if (op.value === '') return;
        const text = op.value === 'none' ? 'Đi bộ' : `${MOUNTS[op.value as MountKind].name} (${sim0.tamedCount(op.value as MountKind)})`;
        if (op.textContent !== text) op.textContent = text;
      });
      if (this.mountPick.value !== want && document.activeElement !== this.mountPick) this.mountPick.value = want;
    }
    // the tool follows the job: only the one the chosen villagers use is offered
    const kinds = new Set(chosen.map((o) => TOOL_OF_JOB[o.job as WorkJob] ?? null)), only = kinds.size === 1 ? [...kinds][0] : null;
    this.toolsSec.hidden = only === null;
    if (this.gearSec) { // the whole dialog only: the group panel has none
      this.fillStats(v);
      this.gearSec.hidden = !chosen.every((o) => o.job === 'fight' || o.job === 'hunt' || o.job === 'scout');
    }
    for (const r of this.toolRows) {
      r.row.hidden = r.k !== only;
      const t = v.tools[r.k];
      r.state.textContent = t ? (t.dur <= 0 ? `${TIER_NAME[t.tier].toLowerCase()} · đã hỏng` : `${TIER_NAME[t.tier].toLowerCase()} · còn ${Math.round((t.dur / TIER_DURABILITY[t.tier]) * 100)}%`) : 'tay không';
      const tiers = new Set(chosen.map((o) => o.tools[r.k]?.tier ?? 0)), cur = tiers.size === 1 ? String([...tiers][0]) : '';
      r.pick.querySelectorAll('option').forEach((op) => {
        if (op.value === '') return;
        const t = Number(op.value), text = t === 0 ? 'Tay không' : `${TIER_NAME[t]} (${sim0.toolCount(r.k, t)})`;
        if (op.textContent !== text) op.textContent = text;
      });
      if (r.pick.value !== cur && document.activeElement !== r.pick) r.pick.value = cur;
      r.drop.disabled = chosen.every((o) => !o.tools[r.k]);
    }
    this.shiftBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((o) => o.shift === b.dataset.shift))));
    const onlyGuards = chosen.length > 0 && chosen.every((o) => o.job === 'fight' && o.guard); // a guard keeps the day or the night watch, never both
    this.shiftBtns.forEach((b) => { if (b.dataset.shift === 'both') b.hidden = onlyGuards; });
    this.rest.innerHTML = energyText(sim0, v);
    this.torchBtn.disabled = sim0.torchCount() <= 0 || chosen.every((o) => !!o.torch);
    this.stanceBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((o) => o.stance === b.dataset.stance))));
  }
  private statsOpen = false;
  /** The stats that always show; the others open with the button under them. */
  private showStats(): void { for (const { id, cell } of this.statCells) cell.hidden = !this.statsOpen && !KEY_STATS.includes(id); }
  /** The grid of the eleven stats of a person: a picture, the name and the number. */
  private statsGrid(): HTMLElement {
    const grid = h('div', { class: 'dstats' });
    for (const id of STAT_ORDER) {
      const value = h('b'), cell = h('div', { class: 'dstat' }, h('span', { class: 'dsico' }, statIcon(id)), h('span', { class: 'dsname', text: STAT_LABEL[id] }), value);
      this.statCells.push({ id, value, cell }); grid.append(cell);
    }
    this.showStats();
    return grid;
  }

  /** The numbers of the first villager, one decimal each; green where research has raised a stat above what the person was born with, red where hunger has lowered it. */
  private fillStats(v: Villager): void {
    for (const { id, value, cell } of this.statCells) {
      const r = statReading(this.c.sim, v, id);
      value.textContent = r.text; cell.title = r.tip; cell.className = `dstat${r.tone ? ` ${r.tone}` : ''}`;
    }
  }
}
