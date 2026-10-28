import { DAY_LENGTH } from '../sim/constants';
import { armOfWeapon, ARM_NAME, FORMATION_IDS, FORMATIONS, FormationId, OBJECTIVE_NAME } from '../sim/formations';
import type { CardKind, Mission, Objective, Plan, PlanStance, Route, Villager } from '../sim/model';
import { WEAPONS } from '../sim/combat';
import { h, hint } from './dom';
import type { Ctx } from './ctx';

export type WTab = 'squads' | 'maps' | 'plan' | 'defense' | 'log';
const TABS: Array<[WTab, string]> = [['squads', 'Đội và trận pháp'], ['maps', 'Trinh sát, bản đồ'], ['plan', 'Kế hoạch tấn công'], ['defense', 'Phòng thủ'], ['log', 'Nhật ký trận']];
const ROUTE_NAME: Record<Route, string> = { main: 'Đường chính', forest: 'Đường rừng (vòng sườn)', night: 'Đường vòng ban đêm' };
const STANCE_NAME: Record<PlanStance, string> = { fight: 'Đánh', evade: 'Né, chỉ đi', hold: 'Giữ yên', shoot: 'Chỉ bắn' };
const POST_NAME: Record<Mission['post'], string> = { gate: 'Giữ cổng', fence: 'Đứng sau hàng rào', tower: 'Lên chòi canh', reserve: 'Phản kích (về lửa)', fire: 'Quanh đống lửa' };
export const CARD_NAME: Record<CardKind, string> = { go: 'Xuất phát', advance: 'Tiến', hold: 'Giữ', formation: 'Đổi trận', attack: 'Tấn công mục tiêu', shoot: 'Bắn', retreat: 'Rút', signal: 'Phát tín hiệu' };
const CARD_KINDS: CardKind[] = ['go', 'advance', 'hold', 'formation', 'attack', 'shoot', 'retreat', 'signal'];
const TIMES = [0, 30, 60, 120, 240, 480];

interface Opt<T extends string> { v: T; label: string; disabled?: boolean }
/** A drop-down list that tells the game when the player picks another entry. */
function select<T extends string>(opts: Array<Opt<T>>, cur: T, onPick: (v: T) => void): HTMLSelectElement {
  const el = document.createElement('select');
  for (const o of opts) { const op = document.createElement('option'); op.value = o.v; op.textContent = o.label; op.disabled = !!o.disabled; if (o.v === cur) op.selected = true; el.append(op); }
  el.value = cur;
  el.addEventListener('change', () => onPick(el.value as T));
  return el;
}

/** The war tent: squads and formations, scouting and maps, attack and defence plans, and the log of the fights. Opens the game paused. */
export class WarPanel {
  readonly root = h('div', { class: 'page' });
  private tab: WTab = 'squads';
  private readonly body = h('div');
  private readonly tabBtns = new Map<WTab, HTMLButtonElement>();
  private key = '';
  private targetTribe = '';
  private newLevel: Record<string, number> = {};

  constructor(private readonly c: Ctx) {
    const bar = h('div', { class: 'btns tabs' });
    for (const [t, label] of TABS) { const b = h('button', { class: 'sm', text: label, pressed: t === this.tab, onclick: () => { this.tab = t; this.key = ''; this.update(); } }); this.tabBtns.set(t, b); bar.append(b); }
    this.root.append(hint('Lều họp chiến', 'Lập đội (chia lính theo loại), chọn trận pháp, cử trinh sát vẽ bản đồ làng địch, rồi lập kế hoạch: mỗi đội một nhiệm vụ, một hướng tiến, một giờ xuất phát. Thẻ lệnh bạn gắn vào kế hoạch sẽ hiện thành nút khi đánh. Vào lều là game tạm dừng.'), bar, this.body);
  }

  /** Show one of the pages (used by tests). */
  open(t: WTab): void { this.tab = t; this.key = ''; this.update(); }

  private get sim() { return this.c.sim; }
  private refresh(): void { this.key = ''; this.c.ctl.onChange(); }
  private toast(e: string | null | undefined): void { if (e) this.c.toast(e); }

  update(): void {
    const { sim } = this, plan = (k: 'attack' | 'defense') => sim.plans.find((p) => p.kind === k);
    for (const [t, b] of this.tabBtns) b.setAttribute('aria-pressed', String(t === this.tab));
    const soldiers = sim.villagers.filter((v) => v.job === 'fight');
    const key = [this.tab, sim.squads.map((s) => `${s.id}.${s.name}.${s.formation}.${s.ids.join('/')}.${s.leader}.${Math.round(s.mastery[s.formation] / 5)}.${s.training}`).join(), soldiers.map((v) => `${v.id}.${v.squad}.${v.weapon}`).join(),
      JSON.stringify(sim.maps), JSON.stringify(sim.scouts.map((m) => [m.id, m.phase])), JSON.stringify(plan('attack')), JSON.stringify(plan('defense')), sim.battleReports.length, sim.battle.on, this.targetTribe,
      sim.tribes.map((t) => t.state).join(), sim.squadLimit(), sim.cardLimit()].join('|');
    if (key === this.key) return;
    this.key = key;
    this.body.replaceChildren(...({ squads: () => this.squadsPage(), maps: () => this.mapsPage(), plan: () => this.planPage(), defense: () => this.defensePage(), log: () => this.logPage() }[this.tab])());
  }

  // ---------------------------------------------------------------- squads and formations
  private armCounts(vs: Villager[]): string {
    const n = { foot: 0, archer: 0, cavalry: 0 };
    for (const v of vs) n[armOfWeapon(v.weapon)]++;
    return (['foot', 'archer', 'cavalry'] as const).filter((a) => n[a]).map((a) => `${n[a]} ${ARM_NAME[a].toLowerCase()}`).join(' · ') || 'chưa có lính';
  }

  private squadsPage(): Node[] {
    const { sim } = this, c = this.c;
    const free = sim.villagers.filter((v) => v.job === 'fight' && v.squad < 0), out: Node[] = [];
    out.push(h('h3', { text: `Đội (${sim.squads.length}/${sim.squadLimit()})` }));
    if (!sim.squadLimit()) out.push(h('p', { class: 'sub', text: 'Cần dựng Lều họp chiến (nghiên cứu Hội đồng chiến) để lập đội.' }));
    out.push(h('div', { class: 'btns' }, h('button', { class: 'sm primary', text: 'Lập đội mới', onclick: () => { this.toast(sim.createSquad().reason); this.refresh(); } }),
      h('button', { class: 'sm', text: 'Chọn hết lính', onclick: () => { c.ctl.selected.clear(); for (const v of sim.villagers) if (v.job === 'fight') c.ctl.selected.add(v.id); c.ctl.onChange(); } })));
    for (const s of sim.squads) {
      const us = sim.squadUnits(s), hp = us.length ? Math.round((100 * us.reduce((a, v) => a + v.health / v.maxHealth, 0)) / us.length) : 0, leader = sim.get(s.leader);
      const fm = FORMATIONS[s.formation];
      out.push(h('div', { class: 'row', style: `border-left:5px solid ${s.color};padding-left:8px;flex-direction:column;align-items:stretch` },
        h('div', { class: 'nm' }, h('b', { text: s.name }), h('small', { text: `${this.armCounts(us)} · máu ${hp}% · chỉ huy ${leader?.name ?? 'chưa có'}` })),
        h('div', { class: 'btns' },
          select(FORMATION_IDS.map((f) => ({ v: f, label: `${FORMATIONS[f].name}${sim.formationOpen(f) ? '' : ' (cần nghiên cứu)'}`, disabled: !sim.formationOpen(f) })), s.formation, (f: FormationId) => { this.toast(sim.setFormation(s.id, f)); this.refresh(); }),
          h('small', { text: `thuần thục ${Math.round(s.mastery[s.formation])}%${s.switchUntil > sim.time ? ' · đang đổi trận' : ''}` })),
        h('small', { class: 'sub', text: fm.note }),
        h('div', { class: 'btns' },
          h('button', { class: 'sm', text: 'Chọn trên bản đồ', onclick: () => { c.ctl.selected.clear(); for (const v of us) c.ctl.selected.add(v.id); c.ctl.onChange(); } }),
          h('button', { class: 'sm', text: s.training ? 'Thôi luyện' : 'Luyện ở bãi tập', onclick: () => { this.toast(sim.trainSquad(s.id, !s.training)); this.refresh(); } }),
          h('button', { class: 'sm', text: 'Nhận hết lính rảnh', disabled: !free.length, onclick: () => { sim.joinSquad(free.map((v) => v.id), s.id); this.refresh(); } }),
          h('button', { class: 'sm danger', text: 'Giải tán', onclick: () => { sim.disbandSquad(s.id); this.refresh(); } })),
        ...us.map((v) => h('div', { class: 'row' }, h('div', { class: 'nm' }, v.name, h('small', { text: `${ARM_NAME[armOfWeapon(v.weapon)]} · ${WEAPONS[v.weapon ?? 'fist'].name}${v.id === s.leader ? ' · chỉ huy' : ''}` })),
          h('button', { class: 'sm', text: 'Chỉ huy', disabled: v.id === s.leader, onclick: () => { sim.setCommander(s.id, v.id); this.refresh(); } }),
          h('button', { class: 'sm', text: 'Ra', onclick: () => { sim.leaveSquad([v.id]); this.refresh(); } })))));
    }
    out.push(h('h3', { text: `Lính chưa vào đội (${free.length})` }));
    if (!free.length) out.push(h('p', { class: 'sub', text: 'Tuyển lính ở đống lửa trại (tab Lính), rồi xếp vào đội ở đây.' }));
    for (const v of free) out.push(h('div', { class: 'row' }, h('div', { class: 'nm' }, v.name, h('small', { text: `${ARM_NAME[armOfWeapon(v.weapon)]} · ${WEAPONS[v.weapon ?? 'fist'].name}` })),
      select([{ v: '', label: 'Vào đội…' }, ...sim.squads.map((s) => ({ v: String(s.id), label: s.name }))], '', (id) => { if (id) { this.toast(sim.joinSquad([v.id], Number(id))); this.refresh(); } })));
    return out;
  }

  // ---------------------------------------------------------------- scouting and maps
  private ageWords(at: number): string {
    const days = Math.floor((this.sim.time - at) / DAY_LENGTH);
    return days <= 0 ? 'báo cáo trong ngày' : days === 1 ? 'báo cáo từ hôm qua' : days < 4 ? `báo cáo từ ${days} hôm trước` : 'đã cũ';
  }

  private mapsPage(): Node[] {
    const { sim } = this, c = this.c, out: Node[] = [];
    out.push(hint('Trinh sát và bản đồ', 'Muốn đánh một làng phải có bản đồ của nó. Cấp 1 cho vị trí và số dân; cấp 2 cho đường vào, cổng và chỗ phục kích; cấp 3 cho số lính từng loại, kho và thủ lĩnh. Trinh sát có thể chết, bản đồ mất 10% độ chính xác mỗi ngày. Chọn dân trên bản đồ rồi cử đi, hoặc bấm cử để game tự lấy người rảnh.'));
    if (!sim.dev.freeBuild && !sim.researched.has('scout')) out.push(h('p', { class: 'sub', text: 'Cần nghiên cứu "Trinh sát" ở Nhà nghiên cứu.' }));
    for (const t of sim.tribes) {
      const maps = sim.maps.filter((m) => m.tribe === t.id).sort((a, b) => b.level - a.level), best = maps[0], level = sim.mapLevel(t.id);
      const next = this.newLevel[t.id] ?? Math.min(3, level + 1), need = sim.scoutsNeeded(t.id, next);
      out.push(h('div', { class: 'row', style: 'flex-direction:column;align-items:stretch' },
        h('div', { class: 'nm' }, h('b', { text: t.def.name }), h('small', { text: best ? `Bản đồ cấp ${level || best.level}${best.gaps ? ' (còn hở)' : ''}, ${this.ageWords(best.at)}` : 'Chưa có bản đồ' })),
        h('div', { class: 'btns' },
          select([1, 2, 3].map((l) => ({ v: String(l), label: `Cấp ${l}` })), String(next), (l) => { this.newLevel[t.id] = Number(l); this.refresh(); }),
          h('small', { text: `cần ${need} trinh sát cho đủ` }),
          h('button', { class: 'sm primary', text: 'Cử trinh sát', disabled: sim.scouts.some((m) => m.tribe === t.id), onclick: () => {
            const chosen = [...c.ctl.selected].filter((id) => sim.get(id)?.team === 'player');
            const ids = chosen.length ? chosen : sim.villagers.filter((v) => v.job !== 'fight' && v.inside === null).slice(0, need).map((v) => v.id);
            this.toast(sim.startScout(ids, t.id, next)); this.refresh();
          } }))));
    }
    if (sim.scouts.length) out.push(h('h3', { text: 'Đang đi trinh sát' }));
    for (const m of sim.scouts) out.push(h('p', { class: 'sub', text: `${sim.tribes.find((t) => t.id === m.tribe)?.def.name}: ${m.ids.length} người, ${{ go: 'đang tới', watch: 'đang quan sát', back: 'đang về' }[m.phase]} (bản đồ cấp ${m.level})` }));
    return out;
  }

  // ---------------------------------------------------------------- the attack plan
  private missionCard(plan: Plan, m: Mission, defense: boolean): Node {
    const { sim } = this, s = sim.squadById(m.squad), draft = plan.status !== 'running';
    const kids: Array<Node | null> = [h('div', { class: 'nm' }, h('b', { text: s?.name ?? '?' }), h('small', { text: defense ? POST_NAME[m.post] : `${{ idle: 'chưa bắt đầu', wait: 'chờ lệnh', march: 'đang tiến', engaged: 'đang giao chiến', hold: 'giữ vị trí', withdraw: 'đang rút', done: 'xong' }[m.state]}` }))];
    if (defense) kids.push(h('div', { class: 'btns' }, select((Object.keys(POST_NAME) as Array<Mission['post']>).map((p) => ({ v: p, label: POST_NAME[p] })), m.post, (p) => { m.post = p; this.refresh(); })));
    else {
      const trig = m.trigger.kind;
      kids.push(h('div', { class: 'btns' },
        select((Object.keys(OBJECTIVE_NAME) as Objective[]).map((o) => ({ v: o, label: OBJECTIVE_NAME[o], disabled: !sim.canTarget(o, plan.tribe) })), m.objective, (o) => { m.objective = o; this.refresh(); }),
        select((Object.keys(ROUTE_NAME) as Route[]).map((r) => ({ v: r, label: ROUTE_NAME[r] })), m.route, (r) => { m.route = r; this.refresh(); })),
      h('div', { class: 'btns' },
        select([{ v: 'time', label: 'Theo giờ' }, { v: 'after', label: 'Sau khi đội khác giao chiến' }, { v: 'signal', label: 'Khi có tín hiệu' }, { v: 'leaves', label: 'Khi địch rời làng' }], trig, (k) => { m.trigger = k === 'time' ? { kind: 'time', at: 0 } : k === 'after' ? { kind: 'after', squad: plan.missions.find((x) => x.squad !== m.squad)?.squad ?? -1 } : { kind: k } as Mission['trigger']; this.refresh(); }),
        m.trigger.kind === 'time' ? select(TIMES.map((t) => ({ v: String(t), label: t ? `sau ${t} giây` : 'ngay' })), String((m.trigger as { at: number }).at), (t) => { m.trigger = { kind: 'time', at: Number(t) }; this.refresh(); }) : null,
        m.trigger.kind === 'after' ? select(plan.missions.filter((x) => x.squad !== m.squad).map((x) => ({ v: String(x.squad), label: sim.squadById(x.squad)?.name ?? '?' })), String((m.trigger as { squad: number }).squad), (q) => { m.trigger = { kind: 'after', squad: Number(q) }; this.refresh(); }) : null),
      h('div', { class: 'btns' },
        select((Object.keys(STANCE_NAME) as PlanStance[]).map((x) => ({ v: x, label: STANCE_NAME[x] })), m.stance, (x) => { m.stance = x; this.refresh(); }),
        select([0.2, 0.35, 0.5, 0.7].map((x) => ({ v: String(x), label: `Rút khi mất ${Math.round(x * 100)}%` })), String(m.withdrawAt), (x) => { m.withdrawAt = Number(x); this.refresh(); })));
    }
    if (draft) kids.push(h('button', { class: 'sm', text: 'Bỏ nhiệm vụ', onclick: () => { plan.missions.splice(plan.missions.indexOf(m), 1); this.refresh(); } }));
    return h('div', { class: 'row', style: `border-left:5px solid ${s?.color ?? '#888'};padding-left:8px;flex-direction:column;align-items:stretch` }, ...kids);
  }

  private addMissionRow(plan: Plan): Node {
    const { sim } = this, open = sim.squads.filter((s) => !plan.missions.some((m) => m.squad === s.id));
    return h('div', { class: 'btns' }, select([{ v: '', label: 'Giao nhiệm vụ cho đội…' }, ...open.map((s) => ({ v: String(s.id), label: s.name }))], '', (id) => { if (id) { this.toast(sim.addMission(plan, Number(id))); this.refresh(); } }));
  }

  private planPage(): Node[] {
    const { sim } = this, out: Node[] = [], plan = sim.plans.find((p) => p.kind === 'attack');
    const targets = sim.tribes.filter((t) => t.state === 'free');
    if (!this.targetTribe || !targets.some((t) => t.id === this.targetTribe)) this.targetTribe = targets[0]?.id ?? '';
    out.push(h('div', { class: 'btns' }, select(targets.map((t) => ({ v: t.id, label: t.def.name })), this.targetTribe, (t) => { this.targetTribe = t; this.refresh(); }),
      h('button', { class: 'sm primary', text: 'Lập kế hoạch mới', disabled: !this.targetTribe || plan?.status === 'running', onclick: () => { sim.newPlan('attack', this.targetTribe); this.refresh(); } })));
    if (!plan) { out.push(h('p', { class: 'sub', text: 'Chọn làng cần đánh rồi lập kế hoạch. Mỗi đội có thể nhận một nhiệm vụ.' })); return out; }
    out.push(h('h3', { text: `Kế hoạch đánh ${sim.tribes.find((t) => t.id === plan.tribe)?.def.name ?? '?'} · ${{ draft: 'đang soạn', running: 'đang chạy', done: 'đã xong' }[plan.status]}` }));
    for (const l of sim.reviewPlan(plan)) out.push(h('p', { class: l.startsWith('✗') ? 'why' : 'sub', text: l }));
    for (const m of plan.missions) out.push(this.missionCard(plan, m, false));
    if (plan.status !== 'running') out.push(this.addMissionRow(plan));
    // command cards
    out.push(h('h3', { text: `Thẻ lệnh (${plan.cards.length}/${sim.cardLimit()})` }), h('p', { class: 'sub', text: 'Khi đánh, chỉ những thẻ này hiện thành nút. Thêm ít mà chắc: lều cấp cao cho nhiều thẻ hơn.' }));
    for (const cd of plan.cards) out.push(h('div', { class: 'row' }, h('div', { class: 'nm' }, `${CARD_NAME[cd.kind]}${cd.squad >= 0 && cd.kind !== 'signal' ? ` · ${sim.squadById(cd.squad)?.name ?? '?'}` : ''}${cd.arg ? ` · ${FORMATIONS[cd.arg as FormationId]?.name ?? OBJECTIVE_NAME[cd.arg as Objective] ?? cd.arg}` : ''}`),
      plan.status === 'running' ? h('button', { class: 'sm', text: 'Dùng', onclick: () => { this.toast(sim.playCard(plan, cd.id)); this.refresh(); } }) : null, h('button', { class: 'sm', text: 'Bỏ thẻ', onclick: () => { sim.removeCard(plan, cd.id); this.refresh(); } })));
    out.push(this.cardAdder(plan));
    out.push(h('div', { class: 'btns' },
      plan.status === 'draft' ? h('button', { class: 'sm primary', text: 'Bắt đầu tấn công', onclick: () => { this.toast(sim.startPlan(plan)); this.refresh(); } }) : null,
      plan.status === 'running' ? h('button', { class: 'sm danger', text: 'Dừng kế hoạch', onclick: () => { plan.status = 'done'; this.refresh(); } }) : null,
      plan.status === 'done' ? h('button', { class: 'sm', text: 'Soạn lại', onclick: () => { plan.status = 'draft'; for (const m of plan.missions) { m.state = 'idle'; } this.refresh(); } }) : null));
    return out;
  }

  /** Pick a card kind, its squad and what it carries, and add it to the plan. */
  private cardAdder(plan: Plan): Node {
    const { sim } = this;
    let kind: CardKind = 'go', squad = String(sim.squads[0]?.id ?? ''), arg = '';
    const argSel = h('span');
    const fill = () => {
      argSel.replaceChildren();
      if (kind === 'formation') { arg = arg && FORMATIONS[arg as FormationId] ? arg : 'line'; argSel.append(select(FORMATION_IDS.map((f) => ({ v: f, label: FORMATIONS[f].name })), arg, (v) => { arg = v; })); }
      else if (kind === 'attack') { arg = arg && OBJECTIVE_NAME[arg as Objective] ? arg : 'camp'; argSel.append(select((Object.keys(OBJECTIVE_NAME) as Objective[]).map((o) => ({ v: o, label: OBJECTIVE_NAME[o] })), arg, (v) => { arg = v; })); }
      else arg = '';
    };
    fill();
    return h('div', { class: 'btns' },
      select(CARD_KINDS.map((k) => ({ v: k, label: CARD_NAME[k] })), kind, (k) => { kind = k; fill(); }),
      select(sim.squads.map((s) => ({ v: String(s.id), label: s.name })), squad, (s) => { squad = s; }),
      argSel,
      h('button', { class: 'sm primary', text: 'Thêm thẻ', onclick: () => { this.toast(sim.addCard(plan, kind, kind === 'signal' ? -1 : Number(squad), arg)); this.refresh(); } }));
  }

  // ---------------------------------------------------------------- defence
  private defensePage(): Node[] {
    const { sim } = this, out: Node[] = [], plan = sim.plans.find((p) => p.kind === 'defense');
    out.push(hint('Kế hoạch phòng thủ', 'Mẫu phòng thủ: mỗi đội đứng ở đâu khi trống báo động. Khi đánh trống, dân về đống lửa và các đội về đúng vị trí; đội đứng chòi sẽ cho cung thủ lên chòi. Không có mẫu thì mọi đội đứng quanh đống lửa.'));
    out.push(h('div', { class: 'btns' },
      h('button', { class: 'sm primary', text: plan ? 'Soạn mẫu mới' : 'Lập mẫu phòng thủ', onclick: () => { sim.newPlan('defense', null); this.refresh(); } }),
      h('button', { class: 'sm danger', text: sim.alarmUntil > sim.time ? 'Đang báo động' : 'Đánh trống báo động', disabled: sim.alarmUntil > sim.time, onclick: () => { this.toast(sim.soundAlarm()); this.refresh(); } })));
    if (!plan) return out;
    for (const m of plan.missions) out.push(this.missionCard(plan, m, true));
    out.push(this.addMissionRow(plan));
    return out;
  }

  // ---------------------------------------------------------------- the log
  private logPage(): Node[] {
    const { sim } = this, b = sim.battle, out: Node[] = [];
    out.push(h('h3', { text: b.on ? 'Đang có giao tranh' : 'Không có giao tranh' }));
    if (b.on) out.push(h('p', { class: 'sub', text: `Ta mất ${b.ourDead}, địch mất ${b.foeDead}${b.breaches ? `, ${b.breaches} đoạn rào bị phá` : ''}${b.shots ? `, cung trên chòi bắn ${b.shots} phát` : ''}.` }), ...b.notes.map((n) => h('p', { class: 'sub', text: n })));
    if (!sim.battleReports.length) out.push(h('p', { class: 'sub', text: 'Chưa có trận nào kết thúc. Sau mỗi trận, bản tóm tắt hiện ở đây để bạn chỉnh kế hoạch lần sau.' }));
    for (const r of [...sim.battleReports].reverse()) out.push(h('div', { class: 'row', style: 'flex-direction:column;align-items:stretch' }, ...r.lines.map((l) => h('small', { text: l }))));
    return out;
  }
}
