import type { Plan } from '../sim/model';
import { TILE } from '../sim/constants';
import { h } from './dom';
import { dlg, GameDialog } from './gamedialog';
import type { Ctx } from './ctx';

/**
 * War mode. While an attack is deployed the village screen shows only this: where the army is and the buttons to fight or fall back.
 * (The selection and building buttons give way to it; main.ts hides them while `active` is true.)
 */
export class WarBar {
  private key = '';
  /** Folded away: only a button to open it again stays on the screen. */
  private folded = false;
  /** How many soldiers the player picked to break down what halted each squad. */
  private readonly crew = new Map<number, number>();
  /** The report of the squads for the rest in the field (the Nghỉ ngơi dã chiến research), over the whole screen. */
  private readonly restRoot = h('div', { id: 'restdlg' });
  private readonly restDlg = new GameDialog(this.restRoot, {});
  private restKey = '';
  constructor(private readonly root: HTMLElement, private readonly c: Ctx) { document.body.append(this.restRoot); }

  /** The dialog: one row for each squad with its strength, its tent and a button to rest or go on; kept fresh while it is open. */
  private fillRest(plan: Plan): void {
    const { sim, toast } = this.c, squads = plan.missions.map((m) => ({ m, s: sim.squadById(m.squad)! })).filter((x) => x.s && sim.squadUnits(x.s).length);
    const rows = squads.map(({ m, s }) => {
      const us = sim.squadUnits(s), energy = Math.round(us.reduce((a, v) => a + v.energy, 0) / us.length), tent = plan.tents.find((t) => t.squad === s.id);
      return { m, s, n: us.length, energy, tent: !tent ? 'chưa có lều' : tent.built ? 'lều đã dựng' : `đang dựng ${Math.floor(tent.progress * 100)}%` };
    });
    const key = rows.map((r) => `${r.s.id}.${r.n}.${r.energy}.${r.tent}.${!!r.m.resting}`).join('|') + `|${Math.round(sim.warHunger * 20)}|${sim.supplyReadyIn(plan)}`;
    if (key === this.restKey) return;
    this.restKey = key;
    const go = (f: () => string | null) => { const e = f(); if (e) toast(e); this.restKey = ''; this.c.ctl.onChange(); };
    const hungry = sim.warHunger > 0.05, noSupply = !sim.supplyReadyIn(plan);
    this.restDlg.show(dlg.card({ wide: true, label: 'Nghỉ ngơi dã chiến' },
      dlg.head({ pic: '⛺', title: 'Nghỉ ngơi dã chiến', sub: noSupply ? 'Không có lính hậu cần: không dựng được lều để nghỉ' : hungry ? 'Quân đang đói: lương mang theo không đủ' : 'Lương mang theo còn đủ', onClose: () => this.restDlg.hide() }),
      h('div', { class: 'restlist' }, ...rows.map((r) => h('div', { class: `restrow${r.m.resting ? ' on' : ''}` },
        h('i', { style: `background:${r.s.color}` }), h('b', { text: r.s.name }), h('small', { text: `${r.n} lính · ${r.tent}` }),
        h('div', { class: 'restbar', title: `Sức ${r.energy}%` }, h('i', { class: r.energy < 30 ? 'low' : '', style: `width:${r.energy}%` }), h('span', { text: `${r.energy}%` })),
        h('button', { class: `sm${r.m.resting ? '' : ' primary'}`, type: 'button', disabled: noSupply && !r.m.resting, text: r.m.resting ? 'Đi tiếp' : 'Nghỉ', onclick: () => go(() => sim.setRest(plan, r.s.id, !r.m.resting)) })))),
      dlg.buttons(dlg.button('Cả quân nghỉ', noSupply ? () => toast('Không có lính hậu cần') : () => go(() => { let e: string | null = null; for (const r of rows) if (!r.m.resting) e = sim.setRest(plan, r.s.id, true) ?? e; return e; })),
        dlg.button('Cả quân đi tiếp', () => go(() => { let e: string | null = null; for (const r of rows) if (r.m.resting) e = sim.setRest(plan, r.s.id, false) ?? e; return e; }), { tone: 'alt' }))));
  }

  /** The attack that is deployed, if any. */
  plan(): Plan | undefined { return this.c.sim.plans.find((p) => p.kind === 'attack' && p.status === 'running' && !p.skirmish); } // a skirmish (the player's own orders) shows no war bar
  get active(): boolean { return !!this.plan(); }

  /** A squad that cannot go on along its arrow: what is in the way, and the soldiers to send to break it down (they work fast and gather nothing). */
  private blockedRow(plan: Plan, m: Plan['missions'][number], act: (e: string | null) => void): HTMLElement {
    const { sim } = this.c, s = sim.squadById(m.squad)!, b = m.block!, alive = sim.squadUnits(s).length, working = sim.squadUnits(s).filter((v) => v.breaks).length;
    const n = Math.min(alive, this.crew.get(m.squad) ?? Math.min(3, alive)), pick = document.createElement('select');
    for (let i = 1; i <= alive; i++) { const o = document.createElement('option'); o.value = String(i); o.textContent = `${i} lính`; pick.append(o); }
    pick.value = String(Math.max(1, n));
    pick.addEventListener('change', () => { this.crew.set(m.squad, Number(pick.value)); });
    const why = b.kind === 'enemy' ? `đang phá ${b.label.toLowerCase()} chắn đường` : b.clear ? `vướng ${b.label} ở (${b.x}, ${b.y})` : `vướng ${b.label} ở (${b.x}, ${b.y}), không phá được`;
    return h('div', { class: 'wardlg' },
      h('b', { text: `⛔ ${s.name} không thể di chuyển tiếp` }), h('span', { text: working ? `${why} · ${working} lính đang phá…` : why }),
      ...(b.clear && b.kind !== 'enemy' && !working ? [pick, h('button', { class: 'sm primary', text: '🪓 Phá vật thể', title: 'Cử số lính này trong đội đi phá vật cản: họ phá rất nhanh và không nhận tài nguyên', onclick: () => act(sim.breakBlock(plan, m.squad, Number(pick.value))) })]
        : !b.clear ? [h('small', { text: 'Hãy rút lui hoặc chờ.' })] : []));
  }

  /** Whether the camera is far from the army (the key of the bar notices the change). */
  private armyAway = false;
  /** The middle of the army, in tiles. */
  private armyCenter(plan: Plan): { x: number; y: number } | null {
    const us = plan.missions.flatMap((m) => { const s = this.c.sim.squadById(m.squad); return s ? this.c.sim.squadUnits(s) : []; });
    return us.length ? { x: us.reduce((a, v) => a + v.x, 0) / us.length, y: us.reduce((a, v) => a + v.y, 0) / us.length } : null;
  }

  update(): void {
    const { sim, toast } = this.c, plan = this.plan();
    this.root.hidden = !plan;
    if (!plan) { this.key = ''; this.folded = false; this.restDlg.hide(); this.restKey = ''; return; }
    if (this.restDlg.isOpen) this.fillRest(plan);
    const units = plan.missions.flatMap((m) => { const s = sim.squadById(m.squad); return s ? sim.squadUnits(s) : []; });
    const inPlace = units.filter((v) => !v.fight.anchor || Math.hypot(v.x - v.fight.anchor.x, v.y - v.fight.anchor.y) < 2.5).length;
    const camp = sim.tribes.find((t) => t.id === plan.tribe)?.camp, ours = units.length;
    const theirs = camp ? sim.foes.filter((f) => f.health > 0 && f.ai && f.ai.role !== 'civ' && Math.hypot(f.x - camp.x, f.y - camp.y) < 40).length : 0;
    const cam = this.c.ctl.viewTile(), mid = this.armyCenter(plan);
    this.armyAway = !!mid && Math.hypot(cam.x - mid.x, cam.y - mid.y) > 40;
    const blocked = plan.missions.filter((m) => m.state === 'blocked' && m.block);
    const key = [sim.planOpen('rest'), plan.id, plan.stage, this.armyAway, inPlace, ours, Math.floor(theirs / 3), sim.battle.on, this.folded, blocked.map((m) => `${m.squad}:${m.block!.x},${m.block!.y}:${sim.squadUnits(sim.squadById(m.squad)!).length}:${this.crew.get(m.squad) ?? 0}`).join()].join('|');
    if (key === this.key) return;
    this.key = key;
    const act = (e: string | null) => { if (e) toast(e); this.key = ''; this.c.ctl.onChange(); };
    const name = sim.tribes.find((t) => t.id === plan.tribe)?.def.name ?? 'địch';
    const slow = ` · hành quân chậm ${Math.round(sim.march.slow * 100)}%`;
    const state = { assemble: `Quân đang vào vị trí (${inPlace}/${ours})…`, ready: `Quân đã vào vị trí (${ours} lính). Đánh hay rút?`, fight: `Đang giao chiến với ${name}: ta ${ours} · địch quanh đó ${theirs}${slow}`,
      retreat: 'Quân đang rút lui…', recall: 'Toàn quân đang về làng…', over: plan.result === 'won' ? `Chiến thắng ${name}! Quân đang đứng yên tại chỗ.` : `Thua trận trước ${name}. Quân còn lại đứng yên tại chỗ.` }[plan.stage];
    const buttons = plan.stage === 'assemble' ? [h('button', { class: 'sm danger', text: '↩ Hủy, rút về làng', onclick: () => act(sim.withdrawPlan(plan)) })]
      : plan.stage === 'ready' ? [h('button', { class: 'sm primary', text: '⚔ Đánh', title: 'Thực thi kế hoạch tác chiến: các đội tiến theo mũi tên', onclick: () => act(sim.engagePlan(plan)) }),
        h('button', { class: 'sm danger', text: '↩ Rút toàn quân về làng', title: 'Chưa đánh: hủy trận, kế hoạch được giữ lại', onclick: () => act(sim.withdrawPlan(plan)) })]
      : plan.stage === 'fight' ? [h('button', { class: 'sm danger', text: '↩ Rút lui', title: 'Mỗi đội rút theo đường rút đã vẽ', onclick: () => act(sim.withdrawPlan(plan)) })]
      : plan.stage === 'over' ? [h('button', { class: 'sm primary', text: '↩ Rút quân về làng', title: 'Kết thúc chiến tranh khi quân về tới làng', onclick: () => act(sim.withdrawPlan(plan)) })] : [];
    // soldiers off their cell (a hand moved them) while the army forms up: one button puts them back
    if ((plan.stage === 'assemble' || plan.stage === 'ready') && inPlace < ours) buttons.push(h('button', { class: 'sm', text: `⤺ Về vị trí (${ours - inPlace})`, title: 'Cho lính đứng lệch ô quay về đúng ô trong kế hoạch', onclick: () => { const n = sim.regroupPlan(plan); act(n ? null : 'Không có ai để gọi về ô'); } }));
    // the camera went away from the army: a way back to it
    if (this.armyAway) buttons.push(h('button', { class: 'sm', text: '🎯 Về chiến trường', title: 'Đưa camera tới quân', onclick: () => { const c = this.armyCenter(plan); if (c) this.c.ctl.centerOn(c.x * TILE, c.y * TILE); } }));
    if (sim.planOpen('rest') && plan.stage !== 'retreat' && plan.stage !== 'recall' && plan.stage !== 'over') buttons.push(h('button', { class: 'sm', text: '⛺ Nghỉ ngơi', title: 'Cho từng đội dựng lều và nghỉ, cả ban ngày', onclick: () => { this.restKey = ''; this.fillRest(plan); } }));
    const fold = (on: boolean) => () => { this.folded = on; this.key = ''; this.c.ctl.onChange(); };
    this.root.classList.toggle('folded', this.folded);
    if (this.folded) { this.root.replaceChildren(h('button', { class: 'sm danger', text: '⚔ Chiến tranh ▸', title: 'Mở lại bảng chiến đấu', onclick: fold(false) })); return; }
    this.root.replaceChildren(h('b', { text: '⚔ Chế độ chiến tranh' }), h('span', { text: state }), ...buttons, h('button', { class: 'sm', text: '▾ Ẩn', title: 'Ẩn bảng, chỉ để lại một nút mở lại', onclick: fold(true) }),
      ...blocked.map((m) => this.blockedRow(plan, m, act)));
  }
}
