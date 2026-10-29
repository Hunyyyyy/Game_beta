import type { Plan } from '../sim/model';
import { h } from './dom';
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
  constructor(private readonly root: HTMLElement, private readonly c: Ctx) {}

  /** The attack that is deployed, if any. */
  plan(): Plan | undefined { return this.c.sim.plans.find((p) => p.kind === 'attack' && p.status === 'running'); }
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
      ...(b.clear && b.kind !== 'enemy' ? [pick, h('button', { class: 'sm primary', text: '🪓 Phá vật thể', title: 'Cử số lính này trong đội đi phá vật cản: họ phá rất nhanh và không nhận tài nguyên', onclick: () => act(sim.breakBlock(plan, m.squad, Number(pick.value))) })]
        : !b.clear ? [h('small', { text: 'Hãy rút lui hoặc chờ.' })] : []));
  }

  update(): void {
    const { sim, toast } = this.c, plan = this.plan();
    this.root.hidden = !plan;
    if (!plan) { this.key = ''; this.folded = false; return; }
    const units = plan.missions.flatMap((m) => { const s = sim.squadById(m.squad); return s ? sim.squadUnits(s) : []; });
    const inPlace = units.filter((v) => !v.fight.anchor || Math.hypot(v.x - v.fight.anchor.x, v.y - v.fight.anchor.y) < 2.5).length;
    const camp = sim.tribes.find((t) => t.id === plan.tribe)?.camp, ours = units.length;
    const theirs = camp ? sim.foes.filter((f) => f.health > 0 && f.ai && f.ai.role !== 'civ' && Math.hypot(f.x - camp.x, f.y - camp.y) < 40).length : 0;
    const blocked = plan.missions.filter((m) => m.state === 'blocked' && m.block);
    const key = [plan.id, plan.stage, inPlace, ours, Math.floor(theirs / 3), sim.battle.on, this.folded, blocked.map((m) => `${m.squad}:${m.block!.x},${m.block!.y}:${sim.squadUnits(sim.squadById(m.squad)!).length}:${this.crew.get(m.squad) ?? 0}`).join()].join('|');
    if (key === this.key) return;
    this.key = key;
    const act = (e: string | null) => { if (e) toast(e); this.key = ''; this.c.ctl.onChange(); };
    const name = sim.tribes.find((t) => t.id === plan.tribe)?.def.name ?? 'địch';
    const state = { assemble: `Quân đang vào vị trí (${inPlace}/${ours})…`, ready: `Quân đã vào vị trí (${ours} lính). Đánh hay rút?`, fight: `Đang giao chiến với ${name}: ta ${ours} · địch quanh đó ${theirs}`,
      retreat: 'Quân đang rút lui…', recall: 'Toàn quân đang về làng…' }[plan.stage];
    const buttons = plan.stage === 'assemble' ? [h('button', { class: 'sm danger', text: '↩ Hủy, rút về làng', onclick: () => act(sim.withdrawPlan(plan)) })]
      : plan.stage === 'ready' ? [h('button', { class: 'sm primary', text: '⚔ Đánh', title: 'Thực thi kế hoạch tác chiến: các đội tiến theo mũi tên', onclick: () => act(sim.engagePlan(plan)) }),
        h('button', { class: 'sm danger', text: '↩ Rút toàn quân về làng', title: 'Chưa đánh: hủy trận, kế hoạch được giữ lại', onclick: () => act(sim.withdrawPlan(plan)) })]
      : plan.stage === 'fight' ? [h('button', { class: 'sm danger', text: '↩ Rút lui', title: 'Mỗi đội rút theo đường rút đã vẽ', onclick: () => act(sim.withdrawPlan(plan)) })] : [];
    const fold = (on: boolean) => () => { this.folded = on; this.key = ''; this.c.ctl.onChange(); };
    this.root.classList.toggle('folded', this.folded);
    if (this.folded) { this.root.replaceChildren(h('button', { class: 'sm danger', text: '⚔ Chiến tranh ▸', title: 'Mở lại bảng chiến đấu', onclick: fold(false) })); return; }
    this.root.replaceChildren(h('b', { text: '⚔ Chế độ chiến tranh' }), h('span', { text: state }), ...buttons, h('button', { class: 'sm', text: '▾ Ẩn', title: 'Ẩn bảng, chỉ để lại một nút mở lại', onclick: fold(true) }),
      ...blocked.map((m) => this.blockedRow(plan, m, act)));
  }
}
