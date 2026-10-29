import { ARMORS, CRAFTED_WEAPONS, WEAPONS } from '../sim/combat';
import { fmtStat, MOUNT_KINDS, MOUNTS, MountKind, JOB_NAME, JOBS, STAT_NAME, StatKey, WORK_JOBS, WorkJob } from '../sim/jobs';
import type { Villager } from '../sim/sim';
import { TIER_DURABILITY, TIER_NAME, TOOL_KINDS, TOOL_NAME, TOOL_OF_JOB, ToolKind } from '../sim/tools';
import { h, hint } from './dom';
import type { Ctx } from './ctx';
import { energyText, SHIFT_LABEL, SHIFT_TIP, armorLevel, ARMOR_FULL, armorText, describe, PLAIN_JOBS, stars } from './describe';

const STANCES = [['aggressive', 'Chủ động', 'Đuổi địch trong tầm nhìn'], ['defensive', 'Phòng thủ', 'Chỉ đánh địch lại gần, không rời chỗ'], ['retreat', 'Rút lui', 'Không đánh, chạy về lửa trại']] as const;

// ================================================================== selected villagers
export class UnitCard {
  private readonly name = h('b'); private readonly state = h('span');
  private readonly dname = h('b'); private readonly dstate = h('span');
  private readonly bars: Array<{ full: HTMLElement; health: HTMLElement; morale: HTMLElement; armor: HTMLElement; armorLabel: HTMLElement; energy: HTMLElement; energyLabel: HTMLElement }> = [];
  private readonly shiftBtns: HTMLButtonElement[] = []; private readonly rest = h('div', { class: 'kv' }); private readonly torchBtn = h('button', { class: 'sm', text: 'Phát đuốc' }) as HTMLButtonElement;
  private readonly gear = h('div', { class: 'kv' });
  private readonly stats = h('div', { class: 'kv' }); private readonly skills = h('div', { class: 'kv' });
  private readonly toolRows: Array<{ k: ToolKind; row: HTMLElement; state: HTMLElement; give: Array<{ btn: HTMLButtonElement; tier: number }>; back: HTMLButtonElement; repair: HTMLButtonElement; drop: HTMLButtonElement }> = [];
  private combatSec!: HTMLElement; private gearSec!: HTMLElement; private toolsSec!: HTMLElement; private jobSec!: HTMLElement;
  private readonly jobBtns: HTMLButtonElement[]; private readonly stanceBtns: HTMLButtonElement[];
  private readonly mountBtns: Array<{ btn: HTMLButtonElement; kind: MountKind | null }> = [];
  private mountSec!: HTMLElement;
  private readonly gearBtns: Array<{ btn: HTMLButtonElement; kind: string | null; slot: 'weapon' | 'armor'; label: string }> = [];
  private gearTip!: HTMLElement;
  private statsKey = '';
  private open = false;

  /** `root` is the small card over the map; `modal` is the full-screen page with everything about the chosen villagers. */
  constructor(readonly root: HTMLElement, private readonly c: Ctx, private readonly modal: HTMLElement) {
    const { sim, ctl } = c, ids = () => [...ctl.selected];
    const makeBars = () => {
      const full = h('b'), health = h('b'), morale = h('b', { class: 'mor' }), armor = h('b', { class: 'arm' });
      const armorLabel = h('label', {}, 'Giáp', h('i', {}, armor));
      const energy = h('b', { class: 'en' }), energyLabel = h('label', {}, 'Sức', h('i', {}, energy));
      this.bars.push({ full, health, morale, armor, armorLabel, energy, energyLabel });
      return h('div', { class: 'bars' }, h('label', {}, 'No', h('i', {}, full)), energyLabel, h('label', {}, 'Máu', h('i', {}, health)), h('label', {}, 'Tinh thần', h('i', {}, morale)), armorLabel);
    };
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

    const mountRow = h('div', { class: 'btns', role: 'group', 'aria-label': 'Giao thú cưỡi' });
    for (const kind of [null, ...MOUNT_KINDS] as Array<MountKind | null>) {
      const btn = h('button', { class: 'sm', title: kind ? `Giao một con ${MOUNTS[kind].name.toLowerCase()} từ Chuồng thú cưỡi` : 'Trả thú về chuồng', onclick: () => { const e = sim.assignMount(ids(), kind); if (e) c.toast(e); ctl.onChange(); } });
      this.mountBtns.push({ btn, kind }); mountRow.append(btn);
    }
    const gearHint = hint(h('p', { class: 'sub', text: 'Phát đồ (lấy từ kho Xưởng):' }), '');
    this.gearTip = gearHint.tip;

    // tools: handed out of the stock, mended or thrown away by hand
    const toolsSec = h('section', {}, hint('Công cụ', 'Mỗi nghề dùng một công cụ (đốn gỗ: rìu, thợ đá: cuốc chim, hái lượm: cuốc, thợ xây: búa) và mỗi dân chỉ cầm một công cụ. Đổi nghề thì công cụ trả về kho, giữ nguyên độ bền. "Đi sửa": dân tự mang công cụ tới Nhà sửa chữa, sửa xong được trả lại. Sau khi nghiên cứu "tự lấy đồ" và có Kho công cụ, dân thiếu hoặc hỏng đồ sẽ tự đi lấy.'));
    for (const k of TOOL_KINDS) {
      const state = h('small'), give = [1, 2].map((tier) => ({ tier, btn: h('button', { class: 'sm', onclick: () => { const e = sim.assignTool(ids(), k, tier); if (e) c.toast(e); else ctl.clearSelection(); ctl.onChange(); } }) as HTMLButtonElement }));
      const back = h('button', { class: 'sm', text: 'Trả kho', title: 'Trả công cụ về kho, giữ nguyên độ bền', onclick: () => { sim.assignTool(ids(), k, 0); ctl.clearSelection(); ctl.onChange(); } }) as HTMLButtonElement;
      const repair = h('button', { class: 'sm', text: 'Đi sửa', title: 'Dân mang công cụ tới Nhà sửa chữa', onclick: () => { const e = sim.repairTool(ids(), k); if (e) c.toast(e); else ctl.clearSelection(); ctl.onChange(); } }) as HTMLButtonElement;
      const drop = h('button', { class: 'sm', text: 'Bỏ', title: 'Vứt công cụ, kể cả khi chưa hỏng', onclick: () => { sim.discardTool(ids(), k); ctl.clearSelection(); ctl.onChange(); } }) as HTMLButtonElement;
      const row = h('div', { class: 'row' }, h('div', { class: 'nm' }, TOOL_NAME[k], state), h('div', { class: 'btns' }, ...give.map((g) => g.btn), back, repair, drop));
      this.toolRows.push({ k, row, state, give, back, repair, drop });
      toolsSec.append(row);
    }
    this.torchBtn.addEventListener('click', () => { const e = sim.giveTorch(ids()); if (e) c.toast(e); ctl.onChange(); });
    // the small card: who, how they are, and a way into the details
    root.append(
      h('div', { class: 'cardhead' }, this.name, this.state, h('button', { class: 'sm x', text: '✕', title: 'Bỏ chọn', onclick: () => ctl.clearSelection() })),
      makeBars(),
      h('div', { class: 'btns' }, h('button', { class: 'sm primary', text: 'Giao việc và chi tiết', onclick: () => { this.open = true; this.update(this.chosen()); } })),
    );
    // the full page
    modal.append(
      h('div', { class: 'cardhead' }, this.dname, this.dstate, h('button', { class: 'x', text: '✕ Đóng', onclick: () => this.closeDetail() })),
      h('div', { class: 'mbody cols' },
        h('section', {}, h('h3', { text: 'Tình trạng' }), makeBars(), this.gear),
        h('section', {}, hint('Ca làm và sức', 'Dưới 20% sức dân phải đi ngủ và không gọi dậy được tới khi hồi đủ (50%, hoặc 60% nếu kiệt sức dưới 10%). Ngủ đêm hồi sức nhanh hơn ngủ ngày. Ngủ trong Nhà dân (chiến binh: Lều chiến binh) hồi sức đầy đủ; chưa có nhà hoặc hết giường thì nằm cạnh đống lửa, hồi chậm hơn. Làm việc ban đêm cần đuốc và đạt 70% hiệu suất. Làm ca đêm liên tục làm dân mệt mỏi tích lũy: sức tối đa giảm và hồi sức chậm.'), this.rest,
          h('div', { class: 'btns', role: 'group', 'aria-label': 'Ca làm' }, ...(['day', 'night', 'both'] as const).map((sh) => { const btn = h('button', { class: 'sm', text: SHIFT_LABEL[sh], title: SHIFT_TIP[sh], 'data-shift': sh, pressed: false, onclick: () => { sim.setShift(ids(), sh); ctl.onChange(); } }) as HTMLButtonElement; this.shiftBtns.push(btn); return btn; }), this.torchBtn)),
        this.jobSec = h('section', {}, hint('Nghề', 'Nghề do công trình của nó quản lý: mở Nông trại, Xưởng gỗ, Xưởng đá, Chòi thợ săn, các trại lính hay Trại trinh sát để giao việc hoặc cho nghỉ. Chuột phải lên cây, đá, bụi quả hay thú chỉ làm người đã có nghề đó đi tới đó.')),
        this.combatSec = h('section', {}, h('h3', { text: 'Chiến đấu' }),
          h('div', { class: 'btns', role: 'group', 'aria-label': 'Thế đứng' }, ...this.stanceBtns),
          h('div', { class: 'btns' },
            h('button', { class: 'sm', text: 'Giữ chỗ (H)', title: 'Đứng yên, chỉ đánh kẻ ở sát', onclick: () => { sim.orderHold(ids()); ctl.onChange(); } }),
            h('button', { class: 'sm', text: 'Dừng (G)', title: 'Hủy mọi lệnh', onclick: () => { sim.orderStop(ids()); ctl.onChange(); } }),
            h('button', { class: 'sm', text: 'Tấn công–đi (F)', title: 'Chọn một điểm: đi tới đó và đánh mọi địch gặp trên đường', onclick: () => { ctl.attackMoveArmed = true; this.closeDetail(); c.toast('Chạm vào điểm đến'); ctl.onChange(); } })),
        ),
        this.gearSec = h('section', {}, h('h3', { text: 'Trang bị' }), gearHint, gearRow),
        this.mountSec = h('section', {}, hint('Thú cưỡi', 'Thú do Chuồng thú cưỡi thuần hóa, giao cho từng người như công cụ: người cưỡi đi nhanh hơn và đỡ đòn hơn, lính có thú tính là kỵ binh. Kỵ binh của Trại kỵ thú không cần thú giao riêng: họ cưỡi con của trại.'), mountRow),
        this.toolsSec = toolsSec,
        h('section', {}, h('h3', { text: 'Chỉ số và kỹ năng' }), this.stats, this.skills),
      ),
    );
  }

  private chosen(): Villager[] { const { sim, ctl } = this.c; return sim.villagers.filter((v) => ctl.selected.has(v.id)); }
  closeDetail(): void { this.open = false; this.modal.hidden = true; }

  update(chosen: Villager[]): void {
    const sim0 = this.c.sim;
    if (this.c.ctl.openDetail) { this.c.ctl.openDetail = false; if (chosen.length) this.open = true; }
    this.root.hidden = chosen.length === 0;
    if (!chosen.length) { this.statsKey = ''; this.closeDetail(); return; }
    this.modal.hidden = !this.open;
    const v = chosen[0], w = v.weapon ? WEAPONS[v.weapon].name : 'tay không';
    const title = chosen.length > 1 ? `${v.name} và ${chosen.length - 1} người nữa` : v.name;
    this.name.textContent = this.dname.textContent = title;
    this.state.textContent = this.dstate.textContent = describe(v, sim0);
    for (const b of this.bars) {
      b.full.style.width = `${v.fullness}%`; b.health.style.width = `${(v.health / v.maxHealth) * 100}%`; b.morale.style.width = `${v.morale}%`;
      b.health.className = v.health / v.maxHealth < 0.35 ? 'bad' : '';
      const ad = v.armor ? ARMORS[v.armor] : null;
      b.armor.style.width = `${ad ? Math.min(100, (armorLevel(ad) / ARMOR_FULL) * 100) : 0}%`;
      b.armorLabel.title = ad ? armorText(ad) : 'Không mặc giáp';
      b.energy.style.width = `${v.energy}%`; b.energy.className = v.energy < 20 ? 'en low' : 'en';
      b.energyLabel.title = `Sức ${Math.round(v.energy)}%. Dưới 20% dân phải đi ngủ; dưới 10% họ ngủ say và không ai gọi dậy được.`;
    }
    if (!this.open) return;
    for (const g of this.gearBtns) { const n = g.kind ? sim0.toolCount(g.kind, g.kind === 'hide' ? 1 : WEAPONS[g.kind].tier ?? 1) : -1; g.btn.textContent = n >= 0 ? `${g.label} (${n})` : g.label; g.btn.disabled = g.kind !== null && n <= 0 && !chosen.every((o) => (g.slot === 'weapon' ? o.weapon : o.armor) === g.kind); }
    this.gearTip.textContent = chosen.every((o) => o.job === 'scout') ? 'Vũ khí, giáp và đuốc giúp trinh sát vẽ đủ bản đồ hơn và ít bị bắt hơn.' : chosen.every((o) => o.job === 'fight' || o.job === 'hunt') ? (chosen[0].manualGear ? 'Đồ do bạn phát: Xưởng không tự đổi.' : 'Xưởng tự phát đồ tốt nhất còn trong kho.') : 'Chỉ Chiến binh và Thợ săn cầm vũ khí đi theo; dân thường không chiến đấu mà chạy về lửa trại khi có địch.';
    this.gear.innerHTML = `Máu <b>${Math.ceil(v.health)}/${v.maxHealth}</b> · Vũ khí <b>${w}</b> · Giáp <b>${v.armor ? ARMORS[v.armor].name : '—'}</b>${v.armor ? ` (${armorText(ARMORS[v.armor], false)})` : ''}${v.leader ? ' · <b>Thủ lĩnh</b>' : ''}`;
    const sk = `${v.id}|${WORK_JOBS.map((j) => v.skill[j].level).join('')}|${Object.values(v.stats).join()}`;
    if (sk !== this.statsKey) {
      this.statsKey = sk;
      this.stats.innerHTML = (Object.keys(STAT_NAME) as StatKey[]).map((k) => `${STAT_NAME[k]} <b>${fmtStat(v.stats[k])}</b>`).join(' · ');
      this.skills.innerHTML = WORK_JOBS.map((j) => `${JOBS[j].name} <span class="stars">${stars(v.potential[j])}</span> <b>cấp ${v.skill[j].level}</b>`).join(' · ');
    }
    // the tool follows the job: only the one the chosen villagers use is offered
    const kinds = new Set(chosen.map((o) => TOOL_OF_JOB[o.job as WorkJob] ?? null)), only = kinds.size === 1 ? [...kinds][0] : null;
    this.toolsSec.hidden = only === null;
    this.combatSec.hidden = !chosen.every((o) => o.job === 'fight'); // only soldiers get fighting orders
    this.mountSec.hidden = chosen.every((o) => o.job === 'fight' && o.arm === 'cavalry');
    for (const m of this.mountBtns) { const n = m.kind ? sim0.tamedCount(m.kind) : -1; m.btn.textContent = m.kind ? `${MOUNTS[m.kind].name} (${n})${chosen.every((o) => o.mount === m.kind) ? ' ✓' : ''}` : 'Đi bộ'; m.btn.disabled = m.kind !== null && n <= 0 && !chosen.every((o) => o.mount === m.kind); }
    this.gearSec.hidden = !chosen.every((o) => o.job === 'fight' || o.job === 'hunt' || o.job === 'scout');
    for (const r of this.toolRows) {
      r.row.hidden = r.k !== only;
      const t = v.tools[r.k];
      r.state.textContent = t ? (t.dur <= 0 ? `${TIER_NAME[t.tier].toLowerCase()} · đã hỏng` : `${TIER_NAME[t.tier].toLowerCase()} · còn ${Math.round((t.dur / TIER_DURABILITY[t.tier]) * 100)}%`) : 'tay không';
      for (const g of r.give) { const n = sim0.toolCount(r.k, g.tier); g.btn.textContent = `${TIER_NAME[g.tier]} (${n})`; g.btn.disabled = n <= 0; }
      r.repair.disabled = !t || t.dur >= TIER_DURABILITY[t.tier] - 1e-6; r.back.disabled = r.drop.disabled = !t;
    }
    this.jobBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((o) => o.job === b.dataset.job))));
    this.shiftBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((o) => o.shift === b.dataset.shift))));
    this.rest.innerHTML = energyText(sim0, v) + ` · ${sim0.torchCount()} đuốc trong kho`;
    this.torchBtn.disabled = sim0.torchCount() <= 0 || chosen.every((o) => !!o.torch);
    this.stanceBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((o) => o.stance === b.dataset.stance))));
  }
}

