import { CRAFTED_WEAPONS, WEAPONS } from '../sim/combat';
import type { WorkJob } from '../sim/jobs';
import { STAT_DEF } from '../sim/research';
import { critChance, critMult, guardCut, rawValue, statValue, swingCycle } from '../sim/statsys';
import type { Villager } from '../sim/sim';
import { TIER_DURABILITY, TIER_NAME, TOOL_KINDS, TOOL_NAME, TOOL_OF_JOB, ToolKind } from '../sim/tools';
import { h, hint } from './dom';
import { statIcon } from './resicons';
import type { Ctx } from './ctx';
import { STAT_LABEL, STAT_ORDER, statReading } from './statview';
import type { StatCell } from './statview';
import { energyText, SHIFT_LABEL, SHIFT_TIP, armorText } from './describe';
import { ARMORS } from '../sim/combat';

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
  private readonly toolRows: Array<{ k: ToolKind; row: HTMLElement; state: HTMLElement; give: Array<{ btn: HTMLButtonElement; tier: number }>; back: HTMLButtonElement; drop: HTMLButtonElement }> = [];
  private combatSec!: HTMLElement; private gearSec!: HTMLElement; private toolsSec!: HTMLElement; private jobSec!: HTMLElement;
  private readonly jobBtns: HTMLButtonElement[]; private readonly stanceBtns: HTMLButtonElement[];
  private readonly gearBtns: Array<{ btn: HTMLButtonElement; kind: string | null; slot: 'weapon' | 'armor'; label: string }> = [];
  private gearTip!: HTMLElement;

  /** `ids` are the villagers the orders go to; `leave` is called when an order needs the player back on the map. */
  constructor(private readonly c: Ctx, o: { ids: () => number[]; leave: () => void }) {
    const { sim, ctl } = c, ids = o.ids;
    // builders, crafters, researchers and menders are chosen in their houses; here only the plain jobs
    this.jobBtns = [];
    this.stanceBtns = STANCES.map(([s, label, tip]) => h('button', { class: 'sm', 'data-stance': s, pressed: false, text: label, title: tip, onclick: () => { sim.setStance(ids(), s); ctl.onChange(); } }));
    // Handing out gear from the workshop's stock: soldiers carry what they are given
    const gearRow = h('div', { class: 'btns', role: 'group', 'aria-label': 'Phát đồ' });
    const addGear = (label: string, kind: string | null, slot: 'weapon' | 'armor', title: string) => {
      const btn = h('button', { class: 'sm', title, onclick: () => { const e = sim.assignGear(ids(), kind, slot); if (e) c.toast(e); else ctl.clearSelection(); ctl.onChange(); } });
      this.gearBtns.push({ btn, kind, slot, label }); gearRow.append(btn);
    };
    for (const id of CRAFTED_WEAPONS) addGear(WEAPONS[id].name, id, 'weapon', `Phát ${WEAPONS[id].name.toLowerCase()} từ kho Xưởng cho dân đang chọn`);
    addGear('Áo da', 'hide', 'armor', 'Phát áo da từ kho Xưởng');
    addGear('Trả vũ khí', null, 'weapon', 'Trả vũ khí về kho Xưởng'); addGear('Trả giáp', null, 'armor', 'Trả giáp về kho Xưởng');
    gearRow.append(h('button', { class: 'sm', text: 'Tự nhận đồ', title: 'Để Xưởng tự phát và đổi đồ cho người này (khi làm Chiến binh hoặc Thợ săn)', onclick: () => { sim.autoGear(ids()); ctl.clearSelection(); ctl.onChange(); } }));

    const gearHint = hint(h('p', { class: 'sub', text: 'Phát đồ (lấy từ kho Xưởng):' }), '');
    this.gearTip = gearHint.tip;

    // tools: handed out of the stock, mended or thrown away by hand
    const toolsSec = h('section', {}, hint('Công cụ', 'Mỗi nghề dùng một công cụ (đốn gỗ: rìu, thợ đá: cuốc chim, hái lượm: cuốc, thợ xây: búa) và mỗi dân chỉ cầm một công cụ. Đổi nghề thì công cụ trả về kho, giữ nguyên độ bền. "Đi sửa": công cụ hỏng thì bị vứt, dân tự lấy hoặc đặt cái mới. Sau khi nghiên cứu "tự lấy đồ" và có Kho công cụ, dân thiếu hoặc hỏng đồ sẽ tự đi lấy.'));
    for (const k of TOOL_KINDS) {
      const state = h('small'), give = [1, 2].map((tier) => ({ tier, btn: h('button', { class: 'sm', onclick: () => { const e = sim.assignTool(ids(), k, tier); if (e) c.toast(e); else ctl.clearSelection(); ctl.onChange(); } }) as HTMLButtonElement }));
      const back = h('button', { class: 'sm', text: 'Trả kho', title: 'Trả công cụ về kho, giữ nguyên độ bền', onclick: () => { sim.assignTool(ids(), k, 0); ctl.clearSelection(); ctl.onChange(); } }) as HTMLButtonElement;
      const drop = h('button', { class: 'sm', text: 'Bỏ', title: 'Vứt công cụ, kể cả khi chưa hỏng', onclick: () => { sim.discardTool(ids(), k); ctl.clearSelection(); ctl.onChange(); } }) as HTMLButtonElement;
      const row = h('div', { class: 'row' }, h('div', { class: 'nm' }, TOOL_NAME[k], state), h('div', { class: 'btns' }, ...give.map((g) => g.btn), back, drop));
      this.toolRows.push({ k, row, state, give, back, drop });
      toolsSec.append(row);
    }
    this.torchBtn.addEventListener('click', () => { const e = sim.giveTorch(ids()); if (e) c.toast(e); ctl.onChange(); });
    this.body = h('div', { class: 'dbody' },
        h('section', { class: 'dsec' }, h('h3', { text: 'Chỉ số' }), this.statsGrid()),
        h('section', {}, hint('Ca làm và sức', 'Dưới 20% sức dân phải đi ngủ và không gọi dậy được tới khi hồi đủ (50%, hoặc 60% nếu kiệt sức dưới 10%). Ngủ đêm hồi sức nhanh hơn ngủ ngày. Ngủ trong Nhà dân (chiến binh: Lều chiến binh) hồi sức đầy đủ; chưa có nhà hoặc hết giường thì nằm cạnh đống lửa, hồi chậm hơn. Làm việc ban đêm cần đuốc và đạt 70% hiệu suất. Làm ca đêm liên tục làm dân mệt mỏi tích lũy: sức tối đa giảm và hồi sức chậm.'), this.rest,
          h('div', { class: 'btns', role: 'group', 'aria-label': 'Ca làm' }, ...(['day', 'night', 'both'] as const).map((sh) => { const btn = h('button', { class: 'sm', text: SHIFT_LABEL[sh], title: SHIFT_TIP[sh], 'data-shift': sh, pressed: false, onclick: () => { sim.setShift(ids(), sh); ctl.onChange(); } }) as HTMLButtonElement; this.shiftBtns.push(btn); return btn; }), this.torchBtn)),
        this.jobSec = h('section', {}, hint('Nghề', 'Nghề do công trình của nó quản lý: mở Nông trại, Xưởng gỗ, Xưởng đá, Chòi thợ săn, các trại lính hay Trại trinh sát để giao việc hoặc cho nghỉ. Chuột phải lên cây, đá, bụi quả hay thú chỉ làm người đã có nghề đó đi tới đó.')),
        this.combatSec = h('section', {}, h('h3', { text: 'Chiến đấu' }),
          h('div', { class: 'btns', role: 'group', 'aria-label': 'Thế đứng' }, ...this.stanceBtns),
          h('div', { class: 'btns' },
            h('button', { class: 'sm', text: 'Giữ chỗ (H)', title: 'Đứng yên, chỉ đánh kẻ ở sát', onclick: () => { sim.orderHold(ids()); ctl.onChange(); } }),
            h('button', { class: 'sm', text: 'Dừng (G)', title: 'Hủy mọi lệnh', onclick: () => { sim.orderStop(ids()); ctl.onChange(); } }),
            h('button', { class: 'sm', text: 'Tấn công–đi (F)', title: 'Chọn một điểm: đi tới đó và đánh mọi địch gặp trên đường', onclick: () => { ctl.attackMoveArmed = true; o.leave(); c.toast('Chạm vào điểm đến'); ctl.onChange(); } })),
        ),
        this.gearSec = h('section', {}, h('h3', { text: 'Trang bị' }), this.gear, gearHint, gearRow),
        this.toolsSec = toolsSec,
      );
  }

  /** Draw the state of the first of `chosen`; the buttons answer for all of them. */
  update(chosen: Villager[]): void {
    const sim0 = this.c.sim, v = chosen[0], w = v.weapon ? WEAPONS[v.weapon].name : 'tay không';
    for (const g of this.gearBtns) { const n = g.kind ? sim0.toolCount(g.kind, g.kind === 'hide' ? 1 : WEAPONS[g.kind].tier ?? 1) : -1; g.btn.textContent = n >= 0 ? `${g.label} (${n})` : g.label; g.btn.disabled = g.kind !== null && n <= 0 && !chosen.every((o) => (g.slot === 'weapon' ? o.weapon : o.armor) === g.kind); }
    this.gearTip.textContent = chosen.every((o) => o.job === 'scout') ? 'Vũ khí, giáp và đuốc giúp trinh sát vẽ đủ bản đồ hơn và ít bị bắt hơn.' : chosen.every((o) => o.job === 'fight' || o.job === 'hunt') ? (chosen[0].manualGear ? 'Đồ do bạn phát: Xưởng không tự đổi.' : 'Xưởng tự phát đồ tốt nhất còn trong kho.') : 'Chỉ Chiến binh và Thợ săn cầm vũ khí đi theo; dân thường không chiến đấu mà chạy về lửa trại khi có địch.';
    this.gear.innerHTML = `Vũ khí <b>${w}</b> · Giáp <b>${v.armor ? ARMORS[v.armor].name : '—'}</b>${v.armor ? ` (${armorText(ARMORS[v.armor], false)})` : ''}${v.leader ? ' · <b>Thủ lĩnh</b>' : ''}`;
    this.fillStats(v);
    // the tool follows the job: only the one the chosen villagers use is offered
    const kinds = new Set(chosen.map((o) => TOOL_OF_JOB[o.job as WorkJob] ?? null)), only = kinds.size === 1 ? [...kinds][0] : null;
    this.toolsSec.hidden = only === null;
    this.combatSec.hidden = !chosen.every((o) => o.job === 'fight'); // only soldiers get fighting orders
    this.gearSec.hidden = !chosen.every((o) => o.job === 'fight' || o.job === 'hunt' || o.job === 'scout');
    for (const r of this.toolRows) {
      r.row.hidden = r.k !== only;
      const t = v.tools[r.k];
      r.state.textContent = t ? (t.dur <= 0 ? `${TIER_NAME[t.tier].toLowerCase()} · đã hỏng` : `${TIER_NAME[t.tier].toLowerCase()} · còn ${Math.round((t.dur / TIER_DURABILITY[t.tier]) * 100)}%`) : 'tay không';
      for (const g of r.give) { const n = sim0.toolCount(r.k, g.tier); g.btn.textContent = `${TIER_NAME[g.tier]} (${n})`; g.btn.disabled = n <= 0; }
      r.back.disabled = r.drop.disabled = !t;
    }
    this.jobBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((o) => o.job === b.dataset.job))));
    this.shiftBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((o) => o.shift === b.dataset.shift))));
    this.rest.innerHTML = energyText(sim0, v) + ` · ${sim0.torchCount()} đuốc trong kho`;
    this.torchBtn.disabled = sim0.torchCount() <= 0 || chosen.every((o) => !!o.torch);
    this.stanceBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((o) => o.stance === b.dataset.stance))));
  }
  /** The grid of the eleven stats of a person: a picture, the name and the number. */
  private statsGrid(): HTMLElement {
    const grid = h('div', { class: 'dstats' });
    for (const id of STAT_ORDER) {
      const value = h('b'), cell = h('div', { class: 'dstat' }, h('span', { class: 'dsico' }, statIcon(id)), h('span', { class: 'dsname', text: STAT_LABEL[id] }), value);
      this.statCells.push({ id, value, cell }); grid.append(cell);
    }
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
