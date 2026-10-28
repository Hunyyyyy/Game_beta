import { FORMATIONS } from '../sim/formations';
import type { Renderer } from '../render/renderer';
import { h } from './dom';
import type { Ctx } from './ctx';
import { CARD_NAME } from './warpanel';

/** The strip at the bottom of the screen once soldiers are in squads or a fight is on: the squads, the command cards of the plan, the alarm. */
export class WarHud {
  private key = '';
  constructor(private readonly root: HTMLElement, private readonly c: Ctx, private readonly r: Renderer) {}

  update(): void {
    const { sim, ctl, toast } = this.c, attack = sim.plans.find((p) => p.kind === 'attack' && p.status === 'running');
    const show = sim.squads.length > 0 || sim.battle.on || !!attack;
    this.root.hidden = !show;
    if (!show) return;
    const cs = sim.clusters(), ours = cs.filter((c) => c.side === 'player').reduce((n, c) => n + c.n, 0), theirs = cs.filter((c) => c.side !== 'player').reduce((n, c) => n + c.n, 0);
    const health = (s: { ids: number[] }) => { const us = s.ids.map((id) => sim.get(id)).filter((v) => !!v && v.health > 0) as Array<NonNullable<ReturnType<typeof sim.get>>>; return { n: us.length, hp: us.length ? Math.round((100 * us.reduce((a, v) => a + v.health / v.maxHealth, 0)) / us.length) : 0 }; };
    const key = [sim.squads.map((s) => { const q = health(s); return `${s.id}.${q.n}.${Math.round(q.hp / 5)}.${s.formation}.${s.switchUntil > sim.time}`; }).join(), JSON.stringify(attack?.cards), JSON.stringify(attack?.missions.map((m) => m.state)), sim.battle.on, ours, theirs, sim.alarmUntil > sim.time, this.r.reduceFigures].join('|');
    if (key === this.key) return;
    this.key = key;
    const chips = sim.squads.map((s) => {
      const q = health(s);
      return h('button', { class: 'sm', style: `border-left:6px solid ${s.color}`, text: `${s.name} · ${q.n} · ${q.hp}% · ${FORMATIONS[s.formation].name}${s.switchUntil > sim.time ? ' ⟳' : ''}`, title: 'Chọn cả đội', onclick: () => { ctl.selected.clear(); for (const id of s.ids) ctl.selected.add(id); ctl.focusSelection(); ctl.onChange(); } });
    });
    const cards = attack ? attack.cards.map((cd) => {
      const sq = sim.squadById(cd.squad);
      return h('button', { class: 'sm primary', text: `${CARD_NAME[cd.kind]}${cd.kind !== 'signal' && sq ? ` · ${sq.name}` : ''}${cd.arg ? ` · ${FORMATIONS[cd.arg as keyof typeof FORMATIONS]?.name ?? cd.arg}` : ''}`, onclick: () => { const e = sim.playCard(attack, cd.id); if (e) toast(e); ctl.onChange(); } });
    }) : [];
    this.root.replaceChildren(
      h('div', { class: 'btns' }, h('b', { text: sim.battle.on ? `Giao tranh: ta ${ours} · địch ${theirs}` : `Quân: ${ours}` }), ...chips),
      h('div', { class: 'btns' }, ...cards,
        h('button', { class: 'sm danger', text: sim.alarmUntil > sim.time ? 'Đang báo động' : 'Báo động', disabled: sim.alarmUntil > sim.time, onclick: () => { const e = sim.soundAlarm(); if (e) toast(e); ctl.onChange(); } }),
        h('button', { class: 'sm', text: 'Gọn cụm', pressed: this.r.reduceFigures, title: 'Trận lớn: vẽ một hình cho khoảng ba lính', onclick: () => { this.r.reduceFigures = !this.r.reduceFigures; ctl.onChange(); } })));
  }
}
