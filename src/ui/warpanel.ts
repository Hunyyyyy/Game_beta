import { DAY_LENGTH } from '../sim/constants';
import { armOfWeapon, ARM_NAME, FORMATION_IDS, FORMATIONS, FormationId, SQUAD_MAX, SQUAD_MIN } from '../sim/formations';
import type { CardKind, Mission, MissionTarget, Plan, PlanStance, Pt, Squad, Villager } from '../sim/model';
import { WEAPONS } from '../sim/combat';
import { h, hint } from './dom';
import { DrawMode, fmtTime, PlanMapView, planMapInfo } from './planmap';
import type { Ctx } from './ctx';

/** The panels laid over the map of a plan, of which one at most is shown. */
type PlanPanel = 'info' | 'squads' | 'order' | 'roster' | 'report' | null;
export type WTab = 'plan' | 'defense' | 'log';
const TABS: Array<[WTab, string]> = [['plan', 'Kế hoạch tấn công'], ['defense', 'Phòng thủ'], ['log', 'Nhật ký trận']];
const STANCE_NAME: Record<PlanStance, string> = { fight: 'Đánh', evade: 'Né, chỉ đi', hold: 'Giữ yên', shoot: 'Chỉ bắn' };
const POST_NAME: Record<Mission['post'], string> = { gate: 'Giữ cổng', fence: 'Đứng sau hàng rào', tower: 'Lên chòi canh', reserve: 'Phản kích (về lửa)', fire: 'Quanh đống lửa' };
export const CARD_NAME: Record<CardKind, string> = { go: 'Xuất phát', advance: 'Tiến', hold: 'Giữ', formation: 'Đổi trận', attack: 'Tấn công mục tiêu', shoot: 'Bắn', retreat: 'Rút', signal: 'Phát tín hiệu' };
/** The cards a squad that waits for a signal can be given (the signal itself is one card for the whole plan). */
const CARD_KINDS: CardKind[] = ['go', 'advance', 'hold', 'formation', 'shoot', 'retreat'];
const WITHDRAW = [0, 0.2, 0.35, 0.5, 0.7];
const TIMES = [0, 30, 60, 120, 240, 480];
const STANCE_ICON: Record<PlanStance, string> = { fight: '⚔', evade: '👣', hold: '🛡', shoot: '🏹' };
/** The steps of an order, one screen each; which come between depends on the choices made. */
type Step = 'action' | 'start' | 'when' | 'after' | 'cards' | 'retreat' | 'overview';
const STEP_NAME: Record<Step, string> = { action: 'Hành động', start: 'Bắt đầu', when: 'Giờ đánh', after: 'Chờ đội', cards: 'Thẻ lệnh', retreat: 'Rút lui', overview: 'Tổng kết' };
const STANCE_NOTE: Record<PlanStance, string> = { fight: 'Giao chiến với kẻ địch gặp trên đường', evade: 'Đi tới nơi, không đánh trả', hold: 'Tới nơi rồi đứng canh giữ chỗ', shoot: 'Cung thủ bắn, bộ binh đứng yên' };
const timeChip = (t: number) => (t === 0 ? 'Ngay' : t < 60 ? `${t} giây` : `${t / 60} phút`);

interface Opt<T extends string> { v: T; label: string; disabled?: boolean }
/** A drop-down list that tells the game when the player picks another entry. */
function select<T extends string>(opts: Array<Opt<T>>, cur: T, onPick: (v: T) => void): HTMLSelectElement {
  const el = document.createElement('select');
  for (const o of opts) { const op = document.createElement('option'); op.value = o.v; op.textContent = o.label; op.disabled = !!o.disabled; if (o.v === cur) op.selected = true; el.append(op); }
  el.value = cur;
  el.addEventListener('change', () => onPick(el.value as T));
  return el;
}

/** The war tent: squads and formations, attack and defence plans, and the log of the fights. Opens the game paused. */
export class WarPanel {
  readonly root = h('div', { class: 'page' });
  private tab: WTab = 'plan';
  private readonly body = h('div');
  private readonly tabBtns = new Map<WTab, HTMLButtonElement>();
  private key = '';
  /** The village whose map is open full-screen for planning ('' when none). */
  private openTribe = '';
  private readonly full = h('div', { class: 'modal planfull', hidden: true });
  private readonly view: PlanMapView;
  private readonly fullTitle = h('b'); private readonly fullState = h('span');
  private readonly info = h('div', { class: 'pinfo' }); private readonly card = h('div', { class: 'pcard', hidden: true });
  /** The orders of the chosen squad are open on the map, and its "Đổi trận" row with them. */
  private formRow = false;
  /** The step of the order shown on the card, and the squad it is for. */
  private step: Step = 'action'; private cardSquad = -1;
  /** Squads whose orders have already opened by themselves after their first arrow. */
  private readonly ordered = new Set<number>();
  /** The soldiers of the chosen squad are on show (instead of its orders), the list of soldiers to add is open, and the ones ticked in it. */
  private addOpen = false; private rosterSquad = -1;
  private readonly picked = new Set<number>();
  private readonly roster = h('div', { class: 'pcard proster', hidden: true });
  /** The war council's report on the plan, shown before it is sent out, and whether it is open. */
  private readonly report = h('div', { class: 'pcard preport', hidden: true });
  /**
   * Which panel of the plan view is open. Only one at a time, so that none lies over another: opening one closes the one before. Each has a button
   * on the dock at the top left (or on the squad's bar) that opens it again, and closing it leaves nothing but that button.
   */
  private panel: PlanPanel = 'info';
  private readonly dock = h('div', { class: 'pdock' });
  /** The bar along the top of the map: close, which village, and the buttons that open the panels. */
  private readonly top = h('div', { class: 'ptop' });
  private setPanel(p: NonNullable<PlanPanel>, on: boolean): void { if (on) this.panel = p; else if (this.panel === p) this.panel = null; }
  private get orderOpen(): boolean { return this.panel === 'order'; } private set orderOpen(on: boolean) { this.setPanel('order', on); }
  private get rosterOpen(): boolean { return this.panel === 'roster'; } private set rosterOpen(on: boolean) { this.setPanel('roster', on); }
  private get reportOpen(): boolean { return this.panel === 'report'; } private set reportOpen(on: boolean) { this.setPanel('report', on); }
  /** The squad whose "Xóa đội" was pressed once: it asks to be pressed again. */
  private confirmDel = -1;
  /** The squad chosen on the map, and what a drag on the map draws for it. */
  private sel = -1; private mode: DrawMode = 'pan'; private modeSquad = -1;
  private readonly bar = h('div', { class: 'pact', hidden: true });

  constructor(private readonly c: Ctx) {
    const bar = h('div', { class: 'btns tabs' });
    for (const [t, label] of TABS) { const b = h('button', { class: 'sm', text: label, pressed: t === this.tab, onclick: () => { this.tab = t; this.key = ''; this.update(); } }); this.tabBtns.set(t, b); bar.append(b); }
    this.root.append(hint('Lều họp chiến', 'Bản đồ làng địch do Trại trinh sát vẽ. Mở bản đồ đó ở trang Kế hoạch tấn công: nhấn giữ một điểm để lập đội, đưa lính vào đội, vẽ đội hình và mũi tên, rồi ra lệnh cho từng đội. Thẻ lệnh bạn gắn vào kế hoạch sẽ hiện thành nút khi đánh. Vào lều là game tạm dừng.'), bar, this.body);
    this.view = new PlanMapView(c.sim, { onSelect: (id) => { this.sel = id; this.refresh(); }, onNotice: (t) => this.toast(t), onNew: (kind, o, p, cells, heading) => this.newSquad(kind, o, p, cells, heading), onReshape: (id, o, p, cells, heading) => this.reshaped(id, o, p, cells, heading), onTrim: (id, i) => this.trimmed(id, i), onPath: (id, pts, back) => this.drewPath(id, pts, back), onTarget: (id, target) => this.aimed(id, target) });
    const tool = (text: string, title: string, f: () => void) => h('button', { class: 'zoom', text, title, onclick: f });
    this.view.root.append(this.top, this.info, this.bar, this.card, this.roster, this.report, h('div', { class: 'ptools' }, tool('+', 'Phóng to', () => this.view.zoomBy(1.4)), tool('−', 'Thu nhỏ', () => this.view.zoomBy(1 / 1.4)), tool('⤢', 'Vừa khung', () => this.view.fit())));
    this.top.append(h('button', { class: 'chip danger', text: '✕ Đóng', title: 'Đóng bản đồ, về màn hình game', onclick: () => this.closeMap() }), h('div', { class: 'ptitle2' }, this.fullTitle, this.fullState), this.dock);
    this.full.append(h('div', { class: 'pstage' }, this.view.root)); // the map takes the whole screen; the bar and the panels float over it
    (document.body ?? document.documentElement).append(this.full);
  }

  /** Show one of the pages (used by tests). */
  open(t: WTab): void { this.tab = t; this.key = ''; this.update(); }

  /** Open the map held of a village full-screen and start planning on it (used by the list and by tests). */
  openMap(tribe: string): void {
    const { sim } = this;
    if (!sim.dev.freeBuild && !sim.mapLevel(tribe)) { this.toast('Bản đồ này đã quá cũ hoặc chưa có: hãy cử trinh sát'); return; }
    if (!sim.plans.some((p) => p.kind === 'attack')) sim.newPlan('attack', tribe);
    this.tab = 'plan'; this.openTribe = tribe; this.panel = 'info'; this.sel = -1; this.mode = 'pan'; this.modeSquad = -1; this.refresh();
  }
  /** The full-screen map is up. It lies over the whole game, so whoever closes the building panel under it must close it too. */
  get mapOpen(): boolean { return !!this.openTribe; }
  closeMap(): void {
    this.openTribe = ''; this.sel = -1; this.mode = 'pan'; this.modeSquad = -1;
    this.full.hidden = true; // at once: nothing else draws it again once the building panel is gone
    this.refresh();
  }

  /** The button that removes a squad for good: its soldiers go back to those without a squad. It asks to be pressed twice. */
  private deleteButton(id: number): HTMLButtonElement {
    const armed = this.confirmDel === id;
    return h('button', {
      class: armed ? 'chip danger on' : 'chip', text: armed ? '🗑 Bấm lại để xóa đội' : '🗑 Xóa đội', title: 'Xóa hẳn đội này, lính trở về hàng lính chưa có đội',
      onclick: () => {
        if (!armed) { this.confirmDel = id; this.key = ''; this.c.ctl.onChange(); return; }
        const lock = this.sim.warLock(); if (lock) { this.toast(lock); return; }
        this.sim.disbandSquad(id);
        if (this.sel === id) this.sel = -1;
        if (this.modeSquad === id) { this.mode = 'pan'; this.modeSquad = -1; }
        this.refresh();
      },
    });
  }

  private attackPlan(): Plan | undefined { return this.c.sim.plans.find((p) => p.kind === 'attack' && p.tribe === this.openTribe); }

  /** From now a drag on the map draws the row, the arrow or the way back of a squad. */
  private startDraw(mode: DrawMode, squad: number): void {
    const plan = this.attackPlan();
    if (!plan) { this.toast('Lập kế hoạch tấn công trước'); return; }
    if (plan.status === 'running') { this.toast('Kế hoạch đang chạy: không vẽ lại được'); return; }
    this.mode = mode; this.modeSquad = squad; this.sel = squad; this.refresh();
  }
  private stopDraw(): void {
    const id = this.modeSquad, drewArrow = this.mode === 'path' && !!this.attackPlan()?.missions.find((m) => m.squad === id)?.path.length;
    this.mode = 'pan'; this.modeSquad = -1;
    if (drewArrow && !this.ordered.has(id)) { this.ordered.add(id); this.orderOpen = true; this.cardSquad = -1; } // its first arrow is done: the orders open on their first step
    this.refresh();
  }
  /** An existing squad is put down again, or stretched, with the cells of a new drag. */
  private reshaped(squad: number, o: Pt, p: Pt, cells: Pt[], heading: number): void {
    const plan = this.attackPlan();
    if (plan) this.toast(this.sim.deploySquad(plan, squad, undefined, cells, heading, o, p));
    this.mode = 'pan'; this.modeSquad = -1; this.sel = squad; this.refresh();
  }

  /** A cell is taken out of the squad's formation. */
  private trimmed(squad: number, index: number): void {
    const plan = this.attackPlan(), d = plan?.missions.find((m) => m.squad === squad)?.deploy;
    if (!plan || !d) return;
    if (d.cells.length <= SQUAD_MIN) { this.toast(`Đội hình cần ít nhất ${SQUAD_MIN} ô`); return; }
    this.toast(this.sim.deploySquad(plan, squad, undefined, d.cells.filter((_, i) => i !== index), d.heading, d.o, d.p));
    this.refresh();
  }

  /** A squad is made on the map: the formation chosen from the ring, with the cells the drag made (3 to 15). No soldiers are needed yet. */
  private newSquad(kind: FormationId, o: Pt, p: Pt, cells: Pt[], heading: number): void {
    const { sim } = this;
    let plan = this.attackPlan();
    if (!plan && !sim.plans.some((q) => q.kind === 'attack')) plan = sim.newPlan('attack', this.openTribe);
    if (!plan) { this.toast('Đang có một kế hoạch khác: lập kế hoạch mới ở bảng bên phải'); return; }
    if (plan.status === 'running') { this.toast('Kế hoạch đang chạy: không lập thêm đội được'); return; }
    if (!sim.formationOpen(kind)) { this.toast(`Cần nghiên cứu: ${FORMATIONS[kind].name}`); return; }
    const made = sim.createSquad();
    if (!made.squad) { this.toast(made.reason); return; }
    const err = sim.deploySquad(plan, made.squad.id, kind, cells, heading, o, p);
    if (err) { sim.disbandSquad(made.squad.id); this.toast(err); return; }
    this.sel = made.squad.id; this.rosterOpen = true; this.orderOpen = false; this.addOpen = false; this.refresh(); // a new squad has no soldiers: its list opens to be filled
  }

  /** A work or a man was pressed while a squad was chosen: the squad is aimed at it and its arrow runs there. */
  private aimed(squad: number, target: MissionTarget): void {
    const plan = this.attackPlan(), err = plan ? this.sim.setMissionTarget(plan, squad, target) : 'Lập kế hoạch tấn công trước';
    this.toast(err ?? `${this.sim.squadById(squad)?.name ?? 'Đội'} sẽ tấn công ${target.label.toLowerCase()}`);
    if (!err && !this.ordered.has(squad)) { this.ordered.add(squad); this.orderOpen = true; this.cardSquad = -1; } // its first arrow is done: the orders open on their first step
    this.refresh();
  }

  private drewPath(squad: number, pts: Pt[], retreat: boolean): void {
    const plan = this.attackPlan();
    if (plan) this.toast(this.sim.setMissionPath(plan, squad, pts, retreat));
    this.refresh();
  }

  private get sim() { return this.c.sim; }
  private refresh(): void { this.confirmDel = -1; this.key = ''; this.c.ctl.onChange(); }
  private toast(e: string | null | undefined): void { if (e) this.c.toast(e); }

  update(): void {
    const { sim } = this, plan = (k: 'attack' | 'defense') => sim.plans.find((p) => p.kind === k);
    for (const [t, b] of this.tabBtns) b.setAttribute('aria-pressed', String(t === this.tab));
    const soldiers = sim.villagers.filter((v) => v.job === 'fight');
    const key = [this.tab, sim.squads.map((s) => `${s.id}.${s.name}.${s.formation}.${s.ids.join('/')}.${s.leader}.${Math.round(s.mastery[s.formation] / 5)}.${s.training}`).join(), soldiers.map((v) => `${v.id}.${v.squad}.${v.weapon}`).join(),
      JSON.stringify(sim.maps), JSON.stringify(sim.scouts.map((m) => [m.id, m.phase])), JSON.stringify(plan('attack')), JSON.stringify(plan('defense')), sim.battleReports.length, sim.battle.on, this.openTribe, this.orderOpen, this.formRow, this.panel, this.addOpen, [...this.picked].join('.'), this.sel, this.mode, this.modeSquad,
      sim.tribes.map((t) => t.state).join(), sim.squadLimit(), sim.cardLimit()].join('|');
    if (key === this.key) return;
    this.key = key;
    this.full.hidden = !this.openTribe;
    if (this.openTribe) this.fillFull();
    this.body.replaceChildren(...({ plan: () => this.planPage(), defense: () => this.defensePage(), log: () => this.logPage() }[this.tab])());
  }

  // ---------------------------------------------------------------- the maps we hold
  private ageWords(at: number): string {
    const days = Math.floor((this.sim.time - at) / DAY_LENGTH);
    return days <= 0 ? 'báo cáo trong ngày' : days === 1 ? 'báo cáo từ hôm qua' : days < 4 ? `báo cáo từ ${days} hôm trước` : 'đã cũ';
  }

  // ---------------------------------------------------------------- the attack plan
  /** A squad's post in the defence plan. */
  private missionCard(plan: Plan, m: Mission): Node {
    const { sim } = this, s = sim.squadById(m.squad), draft = plan.status !== 'running';
    return h('div', { class: 'row', style: `border-left:5px solid ${s?.color ?? '#888'};padding-left:8px;flex-direction:column;align-items:stretch` },
      h('div', { class: 'nm' }, h('b', { text: s?.name ?? '?' }), h('small', { text: POST_NAME[m.post] })),
      h('div', { class: 'btns' }, select((Object.keys(POST_NAME) as Array<Mission['post']>).map((p) => ({ v: p, label: POST_NAME[p] })), m.post, (p) => { m.post = p; this.refresh(); })),
      draft ? h('button', { class: 'sm', text: 'Bỏ nhiệm vụ', onclick: () => { plan.missions.splice(plan.missions.indexOf(m), 1); this.refresh(); } }) : null);
  }

  private addMissionRow(plan: Plan): Node {
    const { sim } = this, open = sim.squads.filter((s) => !plan.missions.some((m) => m.squad === s.id));
    return h('div', { class: 'btns' }, select([{ v: '', label: 'Giao nhiệm vụ cho đội…' }, ...open.map((s) => ({ v: String(s.id), label: s.name }))], '', (id) => { if (id) { this.toast(sim.addMission(plan, Number(id))); this.refresh(); } }));
  }

  /** The maps we hold, one row each; pressing a row opens that map full-screen to plan on. */
  private planPage(): Node[] {
    const { sim } = this, out: Node[] = [];
    out.push(hint('Bản đồ đã thu thập', 'Bấm vào một bản đồ để mở toàn màn hình và lập kế hoạch tấn công trên đó: thấy khu trại địch và 24 ô quanh nó, rồi giao nhiệm vụ cho từng đội. Bản đồ cấp cao hơn cho thấy nhiều hơn; bản đồ cũ thì kém chính xác. Muốn có bản đồ mới, cử trinh sát từ Trại trinh sát.'));
    const rows = sim.tribes.filter((t) => t.state === 'free' && (sim.dev.freeBuild || sim.maps.some((m) => m.tribe === t.id)));
    if (!rows.length) out.push(h('p', { class: 'sub', text: 'Chưa có bản đồ nào. Cử trinh sát từ Trại trinh sát để vẽ bản đồ một làng.' }));
    for (const t of rows) {
      const best = sim.maps.filter((m) => m.tribe === t.id).sort((a, b) => b.level - a.level)[0], level = sim.dev.freeBuild ? 3 : sim.mapLevel(t.id);
      const plan = sim.plans.find((p) => p.kind === 'attack' && p.tribe === t.id);
      const what = level ? `Bản đồ cấp ${level}${best?.gaps ? ' (còn hở)' : ''}${best ? `, ${this.ageWords(best.at)}` : ''}` : 'Bản đồ đã quá cũ, cần cử trinh sát lại';
      const state = plan ? ` · kế hoạch ${{ draft: 'đang soạn', running: 'đang chạy', done: 'đã xong' }[plan.status]}` : '';
      out.push(h('div', { class: 'row', style: `cursor:${level ? 'pointer' : 'default'};${level ? '' : 'opacity:.6'}`, onclick: () => this.openMap(t.id) },
        h('div', { class: 'nm' }, h('b', { text: t.def.name }), h('small', { text: what + state })),
        h('button', { class: 'sm primary', text: 'Mở bản đồ', disabled: !level })));
    }
    return out;
  }

  /** A button in the look of the map's overlays: a rounded chip that lights when it is the choice made. */
  private chip(text: string, on: boolean, f: () => void, opts: { title?: string; disabled?: boolean; danger?: boolean } = {}): HTMLButtonElement {
    return h('button', { class: `chip${on ? ' on' : ''}${opts.danger ? ' danger' : ''}`, text, title: opts.title, disabled: opts.disabled, onclick: f });
  }

  /** Fill the full-screen planning view: the map keeps its place and zoom; what lies over it (the squads, the strip, the orders) is made again. */
  private fillFull(): void {
    const { sim } = this, t = sim.tribes.find((x) => x.id === this.openTribe), plan = this.attackPlan();
    this.fullTitle.textContent = `Lập kế hoạch đánh ${t?.def.name ?? '?'}`;
    this.fullState.textContent = plan ? { draft: 'đang soạn', running: 'đang chạy', done: 'đã xong' }[plan.status] : 'chưa có kế hoạch';
    this.dock.replaceChildren(...this.dockButtons(plan));
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.view.root.style.setProperty('--ptop', `${this.top.offsetHeight}px`)); // panels sit just under the bar, however many lines it wraps to
    const slot = this.panel === 'info' ? [planMapInfo(sim, this.openTribe)] : this.panel === 'squads' ? [this.tray(plan)] : [];
    this.info.hidden = !slot.length; this.info.replaceChildren(...slot);
    this.view.show(this.openTribe, plan, { selected: this.sel, mode: this.mode, modeSquad: this.modeSquad });
    this.fillBar(plan);
    this.fillCard(plan);
    this.fillRoster(plan);
    this.fillReport(plan);
    this.view.root.classList.toggle('has-panel', !this.info.hidden || !this.card.hidden || !this.roster.hidden || !this.report.hidden);
  }

  /** The buttons at the top left, always there: one to open each panel, and the plan's own controls (deploy, fight, fall back). */
  private dockButtons(plan: Plan | undefined): Node[] {
    const { sim } = this, open = (p: NonNullable<PlanPanel>) => () => { this.setPanel(p, this.panel !== p); this.refresh(); };
    const out: Node[] = [this.chip('ⓘ Làng', this.panel === 'info', open('info'), { title: 'Thông tin về làng này' }), this.chip('⚑ Đội', this.panel === 'squads', open('squads'), { title: 'Các đội của kế hoạch và lưu ý của hội đồng chiến' })];
    if (!plan) {
      const other = sim.plans.find((p) => p.kind === 'attack');
      out.push(this.chip('＋ Lập kế hoạch tấn công', false, () => { sim.newPlan('attack', this.openTribe); this.refresh(); }, { disabled: other?.status === 'running', title: other ? 'Thay kế hoạch đang soạn bằng kế hoạch cho làng này' : 'Chưa có kế hoạch cho làng này' }));
      return out;
    }
    if (plan.status === 'draft') {
      // what stops the plan from going out (a squad short of soldiers for its places, no soldiers, no map…) stops the button too, and says why
      const why = sim.reviewPlan(plan).filter((l) => l.startsWith('✗')).map((l) => l.slice(2));
      const title = !plan.missions.length ? 'Lập đội và vẽ đội hình trước' : why.length ? `Chưa thể triển khai: ${why.join(' · ')}` : 'Xem báo cáo của hội đồng chiến rồi quyết định có triển khai không';
      out.push(this.chip('⚔ Triển khai trận chiến', this.panel === 'report', open('report'), { disabled: !plan.missions.length || why.length > 0, title }));
      if (why.length && this.panel !== 'squads') out.push(h('small', { class: 'why', text: `✗ ${why[0]}${why.length > 1 ? ` (+${why.length - 1} lý do nữa, xem ở ⚑ Đội)` : ''}` }));
    }
    if (plan.status === 'running') {
      const act = (e: string | null) => { this.toast(e); this.refresh(); };
      if (plan.stage === 'assemble') out.push(h('small', { class: 'sub', text: 'Quân đang di chuyển tới vị trí đã bố trí…' }), this.chip('↩ Hủy, rút về làng', false, () => act(sim.withdrawPlan(plan)), { danger: true, title: 'Hủy trận: toàn quân về làng, kế hoạch được giữ lại' }));
      else if (plan.stage === 'ready') out.push(this.chip('⚔ Đánh', true, () => act(sim.engagePlan(plan)), { title: 'Thực thi kế hoạch tác chiến: các đội tiến theo mũi tên' }), this.chip('↩ Rút toàn quân về làng', false, () => act(sim.withdrawPlan(plan)), { danger: true, title: 'Chưa đánh: hủy trận, toàn quân về làng, kế hoạch được giữ lại để sửa hoặc triển khai lại' }));
      else if (plan.stage === 'fight') out.push(this.chip('↩ Rút lui', false, () => act(sim.withdrawPlan(plan)), { danger: true, title: 'Đang đánh: mỗi đội rút theo đường rút đã vẽ (hoặc về chỗ hẹn), kế hoạch kết thúc' }));
      else out.push(h('small', { class: 'sub', text: plan.stage === 'recall' ? 'Quân đang về làng…' : 'Quân đang rút lui…' }));
    }
    if (plan.status === 'done') out.push(h('b', { class: plan.result === 'won' ? 'good' : 'why', text: plan.result === 'won' ? '🏆 Thắng trận' : plan.result === 'lost' ? '✗ Thua trận' : 'Đã xong' }), this.chip('↺ Soạn lại', false, () => { plan.status = 'draft'; plan.stage = 'assemble'; plan.result = ''; for (const m of plan.missions) { m.state = 'idle'; m.block = null; m.leg = 0; } this.refresh(); }));
    return out;
  }

  /** The squads of the plan as chips, to choose one without hunting for it on the map, and the remarks of the war council. */
  private tray(plan: Plan | undefined): HTMLElement {
    const { sim } = this, out: Node[] = [];
    if (!plan) return h('div', { class: 'ptray' }, h('small', { class: 'sub', text: 'Chưa có kế hoạch cho làng này: bấm "＋ Lập kế hoạch tấn công".' }));
    // only squads drawn on the map are listed, with how many soldiers they have against the places drawn for them
    for (const m of plan.missions) {
      const s = m.deploy ? sim.squadById(m.squad) : undefined;
      if (s) out.push(h('button', { class: `chip${this.sel === s.id ? ' on' : ''}`, style: `border-left:7px solid ${s.color}`, title: 'Chọn đội này', text: `${s.name} · ${sim.squadUnits(s).length}/${m.deploy!.cells.length}`, onclick: () => { this.sel = s.id; this.refresh(); } }));
    }
    if (!plan.missions.some((m) => m.deploy && sim.squadById(m.squad))) out.push(h('small', { class: 'sub', text: 'Chưa có đội nào trên bản đồ: nhấn giữ một điểm để lập đội.' }));
    const notes = sim.reviewPlan(plan);
    const tray = h('div', { class: 'ptray' }, ...out);
    if (notes.length) tray.append(h('details', { open: notes.some((l) => l.startsWith('✗')) }, h('summary', { text: `⚠ ${notes.length} lưu ý của hội đồng chiến` }), ...notes.map((l) => h('p', { class: l.startsWith('✗') ? 'why' : 'sub', text: l }))));
    return tray;
  }

  /** The strip over the map: what a press or a drag does now, or what can be done with the squad that was pressed. */
  private fillBar(plan: Plan | undefined): void {
    const { sim } = this, id = this.mode === 'pan' ? this.sel : this.modeSquad;
    const named = plan?.missions.some((m) => m.squad === id && m.deploy) ? sim.squadById(id) : undefined; // a squad not on the map is not there at all
    this.bar.hidden = !plan || !named;
    if (!plan || !named) return;
    const kids: Node[] = [h('b', { text: named.name })];
    if (this.mode !== 'pan') {
      const what = { edit: 'đội hình: rê chuột để đổi độ dài hoặc bán kính, kéo chấm trắng ở gốc để dời cả đội hình, bấm để chốt (ít nhất 3 ô)', trim: 'đội hình: bấm vào ô muốn bỏ, ít nhất còn 3 ô',
        path: 'mũi tên: kéo chấm tròn nhỏ giữa mỗi đoạn để uốn đường, bấm chuột phải vào một chấm để bỏ chấm đó. Đầu mũi tên nằm cố định trên mục tiêu: muốn đổi, bấm vào công trình hoặc người khác', retreat: 'đường rút: bấm nơi đội rút về, rồi kéo các chấm như mũi tên' }[this.mode];
      kids.push(h('span', { text: `Vẽ ${what}. Chuột phải kéo hoặc hai ngón để di chuyển bản đồ.` }));
      if (this.mode === 'edit') kids.push(this.chip('Hủy', false, () => this.stopDraw()));
      else if (this.mode === 'trim') kids.push(this.chip('Xong', true, () => this.stopDraw()));
      else kids.push(this.chip('Xóa', false, () => { this.toast(sim.setMissionPath(plan, named.id, [], this.mode === 'retreat')); this.refresh(); }), this.chip('Xong', true, () => this.stopDraw()));
      this.bar.replaceChildren(...kids);
      return;
    }
    const placed = plan.missions.some((m) => m.squad === named.id && m.deploy), hasArrow = plan.missions.some((m) => m.squad === named.id && m.path.length > 0);
    if (placed) kids.push(this.chip('👥 Lính', this.rosterOpen, () => { this.rosterOpen = !this.rosterOpen; this.orderOpen = false; this.refresh(); }, { title: 'Lính của đội: thêm, bỏ, chọn chỉ huy' }), this.chip('✎ Uốn mũi tên', false, () => this.startDraw('path', named.id), { disabled: !hasArrow, title: hasArrow ? 'Kéo các chấm giữa mũi tên để uốn đường đi; đầu mũi tên nằm cố định trên mục tiêu' : 'Chọn mục tiêu trước: bấm vào công trình hoặc người trên bản đồ' }), this.chip('☰ Lệnh', this.orderOpen && hasArrow, () => { this.orderOpen = !this.orderOpen; this.rosterOpen = false; this.refresh(); }, { disabled: !hasArrow, title: hasArrow ? 'Hành động, giờ đánh, rút lui, thẻ lệnh' : 'Vẽ mũi tên cho đội trước, rồi mới ra lệnh được' }),
      this.chip('✎ Sửa lại', false, () => this.startDraw('edit', named.id), { title: 'Đổi độ dài, bán kính, chỗ đứng' }), this.chip('✂ Bớt ô', false, () => this.startDraw('trim', named.id)));
    kids.push(this.deleteButton(named.id));
    const mine = plan.missions.find((m) => m.squad === named.id);
    if (placed && mine && !mine.target) kids.push(h('small', { class: 'sub', text: 'Bấm vào công trình hoặc người trên bản đồ để đặt mục tiêu cho đội: mũi tên sẽ chạy từ đội tới đó.' }));
    if (mine) kids.push(...this.clearRows(plan, mine));
    this.bar.replaceChildren(...kids);
  }

  /** For each tree, rock or bush on the arrow of the squad: who is sent to break it down while the army forms up. */
  private clearRows(plan: Plan, m: Mission): Node[] {
    const { sim } = this, s = sim.squadById(m.squad), start = sim.missionStart(m);
    if (!s || !start || !m.path.length || plan.status !== 'draft') return [];
    const seen = new Set<string>(), rows: Node[] = [];
    for (const o of sim.routeTime(s, start, m.path, m.target?.kind === 'prop' ? m.target.at : undefined).hits) {
      if (!o || !o.clear || o.kind === 'enemy' || seen.has(`${o.x},${o.y}`)) continue;
      seen.add(`${o.x},${o.y}`);
      const crew = plan.clears.find((c) => c.x === o.x && c.y === o.y), squads = sim.squads.filter((q) => plan.missions.some((x) => x.squad === q.id));
      rows.push(h('span', { class: 'pclear' }, h('b', { class: crew ? 'good' : 'why', text: `🪓 ${o.label} (${o.x}, ${o.y})` }),
        select([{ v: '', label: crew ? 'Đổi đội phá…' : 'Cử đội phá…' }, ...squads.map((q) => ({ v: String(q.id), label: q.name }))], '', (id) => { if (id) { this.toast(sim.addClear(plan, Number(id), o.x, o.y)); this.refresh(); } }),
        crew ? h('small', { class: 'sub', text: `${sim.squadById(crew.squad)?.name ?? '?'} sẽ phá` }) : null));
    }
    return rows;
  }

  /** The report of the war council: the odds, the warnings, what a win and a loss may bring, and the details the map allows. Confirming sends the army out. */
  private fillReport(plan: Plan | undefined): void {
    const { sim } = this;
    this.report.hidden = !(this.reportOpen && plan && plan.status === 'draft');
    if (this.report.hidden || !plan) return;
    const f = sim.forecastPlan(plan), lo = Math.max(0, f.chance - f.spread), hi = Math.min(1, f.chance + f.spread), pc = (x: number) => `${Math.round(x * 100)}%`;
    const odds = f.level >= 3 ? `khoảng ${pc(f.chance)} (có thể từ ${pc(lo)} đến ${pc(hi)})` : `từ ${pc(lo)} đến ${pc(hi)} (bản đồ cấp ${f.level} còn thô)`;
    const list = (title: string, items: string[], cls = 'sub'): Node[] => items.length ? [h('div', { class: 'psec' }, h('b', { text: title }), ...items.map((x) => h('p', { class: cls, text: x })))] : [];
    this.report.replaceChildren(
      h('div', { class: 'phead' }, h('b', { text: 'Báo cáo của hội đồng chiến' }), h('button', { class: 'chip', text: '✕', title: 'Đóng', onclick: () => { this.reportOpen = false; this.refresh(); } })),
      h('div', { class: 'psec' }, h('b', { text: `${f.verdict}: tỉ lệ thắng ${odds}` }),
        h('div', { class: 'oddsbar' }, h('i', { class: 'win', style: `width:${f.chance * 100}%` }), h('i', { class: 'lose', style: `width:${(1 - f.chance) * 100}%` })),
        h('small', { class: 'sub', text: 'Chỉ tính theo kế hoạch và bản đồ đang có; thực tế địch có thể mạnh hay yếu hơn.' })),
      ...(f.blocked ? [h('div', { class: 'psec' }, h('b', { text: '✗ Chưa thể triển khai:' }), ...f.blocked.split('\n').map((x) => h('p', { class: 'why', text: x })))] : []),
      ...list('⚠ Cảnh báo', f.warnings), ...list('Nếu thắng', f.win), ...list('Nếu thua', f.lose),
      h('details', { open: true }, h('summary', { text: 'Báo cáo chi tiết' }), ...f.lines.map((x) => h('p', { class: 'sub', text: x }))),
      h('div', { class: 'chips' },
        this.chip('✓ Xác nhận triển khai', true, () => { const e = sim.startPlan(plan); this.toast(e); if (e) { this.refresh(); return; } this.reportOpen = false; this.closeMap(); this.c.ctl.closeBuilding(); /* back to the game, in war mode */ }, { disabled: !!f.blocked, title: 'Đóng bảng kế hoạch, quân đi ngay tới vị trí đã bố trí rồi chờ lệnh đánh hay rút trên màn hình game' }),
        this.chip('Quay lại sửa kế hoạch', false, () => { this.reportOpen = false; this.refresh(); })));
  }

  /** The soldiers of the chosen squad, kept short: name, role, weapon, who commands and a minus to take one out. Below it a drop-down of ticks to add soldiers who have no squad. */
  private fillRoster(plan: Plan | undefined): void {
    const { sim } = this, sq = sim.squadById(this.sel), m = plan?.missions.find((x) => x.squad === this.sel);
    this.roster.hidden = !(this.rosterOpen && plan && sq && m?.deploy && this.mode === 'pan');
    if (this.roster.hidden || !sq || !m?.deploy) return;
    if (this.rosterSquad !== sq.id) { this.rosterSquad = sq.id; this.picked.clear(); this.addOpen = false; }
    const lock = sim.warLock(), units = sim.squadUnits(sq), cells = m.deploy.cells.length, room = Math.max(0, cells - units.length);
    const free = sim.villagers.filter((v) => v.job === 'fight' && v.squad < 0); // a soldier already in a squad, this one or another, is not offered
    for (const id of [...this.picked]) if (!free.some((v) => v.id === id)) this.picked.delete(id);
    const who = (v: Villager) => `${ARM_NAME[sim.armOf(v)]} · ${WEAPONS[v.weapon ?? 'fist'].name}`;
    const out: Node[] = [h('div', { class: 'phead' }, h('i', { style: `background:${sq.color}` }), h('b', { text: sq.name }), h('small', { text: `${units.length}/${cells} lính` }),
      h('button', { class: 'chip', text: '✕', title: 'Đóng', onclick: () => { this.rosterOpen = false; this.refresh(); } }))];
    if (!units.length) out.push(h('p', { class: 'sub', text: 'Chưa có lính trong đội.' }));
    for (const v of units) out.push(h('div', { class: 'rrow' }, h('div', { class: 'rwho' }, h('b', { text: v.name }), h('small', { text: who(v) })),
      h('button', { class: `chip${v.id === sq.leader ? ' on' : ''}`, text: '★', title: lock ?? (v.id === sq.leader ? 'Chỉ huy của đội' : 'Đặt làm chỉ huy'), disabled: !!lock, onclick: () => { sim.setCommander(sq.id, v.id); this.refresh(); } }),
      h('button', { class: 'chip danger', text: '−', title: lock ?? 'Bỏ khỏi đội', disabled: !!lock, onclick: () => { sim.leaveSquad([v.id]); this.refresh(); } })));
    out.push(this.chip(`＋ Thêm lính ▾${free.length ? ` (${free.length})` : ''}`, this.addOpen, () => { this.addOpen = !this.addOpen; this.refresh(); },
      { disabled: !free.length || !room || !!lock, title: lock ?? (!room ? 'Đội hình đã đủ ô' : !free.length ? 'Không còn lính nào chưa có đội' : 'Chọn lính chưa có đội để thêm vào') }));
    if (!room) out.push(h('small', { class: 'sub', text: `Đội hình có ${cells} ô và đã đủ lính: bấm ✎ Sửa lại để thêm ô.` }));
    else if (!free.length) out.push(h('small', { class: 'sub', text: 'Không còn lính nào chưa có đội: tuyển thêm ở trại lính.' }));
    if (this.addOpen && free.length && room) {
      const list = h('div', { class: 'rdrop' });
      for (const v of free) {
        const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
        box.checked = this.picked.has(v.id); box.disabled = !box.checked && this.picked.size >= room;
        box.addEventListener('change', () => { if (box.checked) this.picked.add(v.id); else this.picked.delete(v.id); this.refresh(); });
        list.append(h('label', { class: 'rpick' }, box, h('span', { class: 'rwho' }, h('b', { text: v.name }), h('small', { text: who(v) }))));
      }
      out.push(list, this.chip(`Thêm ${this.picked.size} lính`, true, () => { this.toast(sim.joinSquad([...this.picked], sq.id)); this.picked.clear(); this.addOpen = false; this.refresh(); }, { disabled: !this.picked.size || !!lock }),
        h('small', { class: 'sub', text: `Còn chỗ cho ${room - this.picked.size} lính.` }));
    }
    this.roster.replaceChildren(...out);
  }

  /** One choice of a step: a big tile with a picture, a name and a line saying what it means. */
  private tile(icon: string, title: string, note: string, on: boolean, f: () => void, opts: { disabled?: boolean; color?: string } = {}): HTMLButtonElement {
    return h('button', { class: `opt${on ? ' on' : ''}`, disabled: opts.disabled, style: opts.color ? `border-left:6px solid ${opts.color}` : undefined, onclick: f },
      h('span', { class: 'oi', text: icon }), h('b', { text: title }), h('small', { text: note }));
  }

  /** The steps this order goes through: action, start, what the start needs, withdrawing (unless it waits for a signal), and the overview. */
  private stepsOf(m: Mission): Step[] {
    const kind = m.trigger.kind, steps: Step[] = ['action', 'start'];
    if (kind === 'signal') steps.push('cards'); else if (m.stance === 'fight' && kind === 'time') steps.push('when'); else if (m.stance === 'fight' && kind === 'after') steps.push('after');
    if (kind !== 'signal') steps.push('retreat');
    steps.push('overview');
    return steps;
  }

  /** What the squad is ordered to do, in plain sentences: when it sets out and what it does, the way it goes, and when it falls back. */
  private describe(plan: Plan, sq: Squad, m: Mission): string {
    const { sim } = this, t = m.trigger, signal = t.kind === 'signal';
    const doing = { fight: 'tiến theo mũi tên và giao chiến với kẻ địch gặp trên đường', evade: 'đi theo mũi tên tới nơi mà không đánh trả', hold: 'đi tới cuối mũi tên rồi đứng giữ chỗ', shoot: 'tiến theo mũi tên, cung thủ bắn còn bộ binh đứng yên' }[m.stance];
    const first = signal ? `${sq.name} đứng chờ tín hiệu, rồi ${doing}.` : `${this.startWords(m)}, ${sq.name} ${doing}.`;
    const start = sim.missionStart(m), go = start && m.path.length ? sim.routeTime(sq, start, m.path) : null;
    const way = !m.deploy ? 'Đội chưa có đội hình trên bản đồ.' : go ? `Đường đi dài ${Math.round(go.length)} ô, mất khoảng ${fmtTime(go.total)}${go.hits.some((o) => o && o.kind !== 'enemy') ? ', có đoạn vướng vật cản (đỏ) cần phá hoặc uốn tránh' : ''}.` : 'Chưa chọn mục tiêu (bấm vào công trình hoặc người trên bản đồ) nên đội sẽ tiến thẳng vào đống lửa của địch.';
    let end = '';
    if (signal) {
      const names = plan.cards.filter((cd) => cd.kind === 'signal' || cd.squad === sq.id).map((cd) => CARD_NAME[cd.kind]);
      end = names.length ? `Thẻ lệnh: ${names.join(', ')}.` : 'Chưa có thẻ lệnh nào nên đội sẽ đứng đợi mãi.';
    } else if (m.withdrawAt > 0) {
      const back = m.retreat.length ? sim.routeTime(sq, m.path.length ? m.path[m.path.length - 1] : start ?? m.retreat[0], m.retreat) : null;
      end = `Rút lui khi mất ${Math.round(m.withdrawAt * 100)}% quân${back ? `, theo đường rút đã vẽ (mất khoảng ${fmtTime(back.total)})` : ', về chỗ hẹn vì chưa vẽ đường rút'}.`;
    } else end = 'Không rút lui, đánh tới cùng.';
    return `${first} ${way} ${end}`;
  }

  /** In words: when the squad sets out. */
  private startWords(m: Mission): string {
    const t = m.trigger;
    return t.kind === 'time' ? (t.at ? `Sau ${timeChip(t.at)}` : 'Ngay khi có lệnh đánh') : t.kind === 'after' ? `Sau khi ${this.sim.squadById(t.squad)?.name ?? 'đội khác'} giao chiến` : t.kind === 'signal' ? 'Khi có tín hiệu' : 'Khi địch rời làng';
  }

  /** The orders of the chosen squad as a card on the map, one step at a time: a step, its choices as big tiles, and the way on. The last step is the overview. */
  private fillCard(plan: Plan | undefined): void {
    const { sim } = this, sq = sim.squadById(this.sel), m = plan?.missions.find((x) => x.squad === this.sel);
    this.card.hidden = !(this.orderOpen && plan && sq && m && m.path.length > 0 && this.mode === 'pan'); // orders are given to a squad that has somewhere to go
    if (this.card.hidden || !plan || !sq || !m) return;
    if (this.cardSquad !== sq.id) { this.cardSquad = sq.id; this.step = 'action'; this.formRow = false; }
    const steps = this.stepsOf(m);
    if (!steps.includes(this.step)) this.step = steps.includes('start') ? 'start' : steps[0];
    const at = steps.indexOf(this.step), draft = plan.status !== 'running', others = plan.missions.filter((x) => x.squad !== sq.id), kind = m.trigger.kind, fight = m.stance === 'fight';
    const go = (to: Step) => { this.step = to; this.refresh(); };
    const next = () => go(steps[Math.min(steps.length - 1, at + 1)]); // after a choice the card moves on by itself; the dots take it back

    const head = h('div', { class: 'phead' }, h('i', { style: `background:${sq.color}` }), h('b', { text: sq.name }),
      h('small', { text: `${m.deploy?.cells.length ?? 0} ô · ${sim.squadUnits(sq).length} lính · ${sim.squadPace(sq).toFixed(1)} ô/giây` }),
      h('button', { class: 'chip', text: '✕', title: 'Đóng', onclick: () => { this.orderOpen = false; this.refresh(); } }));
    const dots = h('div', { class: 'psteps' }, ...steps.map((st, i) => h('button', { class: `pdot${i === at ? ' now' : i < at ? ' done' : ''}`, text: String(i + 1), title: STEP_NAME[st], onclick: () => go(st) })));
    const title = h('div', { class: 'pstep' }, h('b', { text: STEP_NAME[this.step] }), h('small', { text: `Bước ${at + 1}/${steps.length}` }));
    const body: Node[] = [];
    const opts = (cls: string, ...kids: Node[]) => h('div', { class: `opts ${cls}` }, ...kids);
    if (!draft) body.push(h('p', { class: 'why', text: 'Kế hoạch đang chạy: chỉ xem được.' }));

    switch (this.step) {
      case 'action':
        body.push(opts('', ...(Object.keys(STANCE_NAME) as PlanStance[]).map((x) => this.tile(STANCE_ICON[x], STANCE_NAME[x], STANCE_NOTE[x], m.stance === x, () => {
          m.stance = x; if (x !== 'fight' && (kind === 'after' || (m.trigger.kind === 'time' && m.trigger.at > 0))) m.trigger = { kind: 'time', at: 0 };
          next();
        }, { disabled: !draft }))));
        break;
      case 'start': {
        const when: Array<[string, string, string, string]> = fight
          ? [['time', '⏱', 'Theo giờ', 'Xuất phát sau lệnh đánh vào lúc đã hẹn'], ['after', '🔗', 'Sau đội khác', 'Đợi một đội giao chiến rồi mới đánh']]
          : [['time', '▶', 'Ngay', 'Xuất phát khi nhận lệnh đánh']]; // waiting for a signal is not part of the fight for now
        if (kind === 'leaves') when.push(['leaves', '🚪', 'Khi địch rời làng', 'Đợi địch ra khỏi làng']);
        const cur = when.some((w) => w[0] === kind) ? kind : 'time';
        body.push(opts('', ...when.map(([k, icon, name, note]) => this.tile(icon, name, k === 'after' && !others.length ? 'Chưa có đội nào khác' : note, k === cur, () => {
          m.trigger = k === 'time' ? { kind: 'time', at: 0 } : k === 'after' ? { kind: 'after', squad: others[0]?.squad ?? -1 } : { kind: k } as Mission['trigger'];
          this.step = k === 'signal' ? 'cards' : k === 'time' && fight ? 'when' : k === 'after' ? 'after' : 'retreat'; this.refresh();
        }, { disabled: !draft || (k === 'after' && !others.length) }))));
        break;
      }
      case 'when':
        body.push(opts('three', ...TIMES.map((t) => this.tile('⏱', timeChip(t), t ? 'sau khi chạy' : 'khi chạy', m.trigger.kind === 'time' && m.trigger.at === t, () => { m.trigger = { kind: 'time', at: t }; next(); }, { disabled: !draft }))));
        break;
      case 'after':
        body.push(others.length ? opts('', ...others.map((x) => { const q = sim.squadById(x.squad); return this.tile('🔗', q?.name ?? '?', 'giao chiến rồi mới xuất phát', m.trigger.kind === 'after' && m.trigger.squad === x.squad, () => { m.trigger = { kind: 'after', squad: x.squad }; next(); }, { disabled: !draft, color: q?.color }); })) : h('p', { class: 'sub', text: 'Chưa có đội nào khác trong kế hoạch.' }));
        break;
      case 'cards': body.push(...this.cardTiles(plan, sq.id, draft, opts)); break;
      case 'retreat': {
        body.push(opts('three', ...WITHDRAW.map((x) => this.tile(x ? '↩' : '✖', x ? `${Math.round(x * 100)}%` : 'Không rút', x ? 'mất chừng đó quân thì rút' : 'đánh tới cùng', m.withdrawAt === x, () => {
          m.withdrawAt = x; if (x > 0 && !m.retreat.length) this.startDraw('retreat', sq.id); else if (x === 0) next(); else this.refresh();
        }, { disabled: !draft }))));
        if (m.withdrawAt > 0) {
          const back = m.retreat.length ? sim.routeTime(sq, m.path.length ? m.path[m.path.length - 1] : sim.missionStart(m) ?? m.retreat[0], m.retreat) : null;
          body.push(h('p', { class: 'sub', text: back ? `Đường rút ${m.retreat.length} điểm, đi mất ${fmtTime(back.total)}.` : 'Chưa vẽ đường rút: đội sẽ rút về chỗ hẹn.' }),
            opts('', this.tile('➤', back ? 'Nối thêm' : 'Vẽ đường rút', 'trên bản đồ', false, () => this.startDraw('retreat', sq.id), { disabled: !draft }),
              ...(back ? [this.tile('🗑', 'Xóa đường rút', 'rút về chỗ hẹn', false, () => { sim.setMissionPath(plan, sq.id, [], true); this.refresh(); }, { disabled: !draft })] : [])));
        }
        break;
      }
      default: { // the overview
        const row = (icon: string, label: string, value: string, to: Step) => h('button', { class: 'ovrow', onclick: () => go(to) }, h('span', { class: 'oi', text: icon }), h('small', { text: label }), h('b', { text: value }), h('em', { text: 'Sửa' }));
        const rows: Node[] = [row(STANCE_ICON[m.stance], 'Hành động', STANCE_NAME[m.stance], 'action'), row('⏱', 'Bắt đầu', this.startWords(m), 'start')];
        if (kind === 'signal') rows.push(row('📯', 'Thẻ lệnh', `${plan.cards.filter((cd) => cd.kind === 'signal' || cd.squad === sq.id).length} thẻ`, 'cards'));
        else rows.push(row('↩', 'Rút lui', m.withdrawAt > 0 ? `Khi mất ${Math.round(m.withdrawAt * 100)}% · ${m.retreat.length ? `${m.retreat.length} điểm` : 'về chỗ hẹn'}` : 'Không rút', 'retreat'));
        body.push(h('div', { class: 'ov' }, ...rows));
        const notes = sim.reviewPlan(plan).filter((l) => l.includes(sq.name));
        for (const l of notes) body.push(h('p', { class: l.startsWith('✗') ? 'why' : 'sub', text: l }));
      }
    }

    const nav = h('div', { class: 'pnav' },
      this.chip('‹ Quay lại', false, () => go(steps[Math.max(0, at - 1)]), { disabled: at === 0 }),
      at === steps.length - 1 ? this.chip('✓ Xong', true, () => { this.orderOpen = false; this.refresh(); }) : this.chip('Tiếp ›', true, () => next()));
    this.card.replaceChildren(head, h('p', { class: 'pdesc', text: this.describe(plan, sq, m) }), h('div', { class: 'pbar' }, dots, title), h('div', { class: 'pbody2' }, ...body), nav);
  }

  /** The command cards of a squad that waits for a signal, each a tile to press on or off; the signal itself is one card for the whole plan. */
  private cardTiles(plan: Plan, squad: number, draft: boolean, opts: (cls: string, ...kids: Node[]) => HTMLElement): Node[] {
    const { sim } = this, has = (kind: CardKind, arg = '') => plan.cards.find((cd) => cd.kind === kind && (kind === 'signal' || cd.squad === squad) && cd.arg === arg);
    const toggle = (kind: CardKind, arg = '') => () => {
      const cd = has(kind, arg);
      if (cd) sim.removeCard(plan, cd.id); else this.toast(sim.addCard(plan, kind, kind === 'signal' ? -1 : squad, arg));
      this.refresh();
    };
    const icon: Record<string, string> = { go: '▶', advance: '⏩', hold: '🛡', shoot: '🏹', retreat: '↩', formation: '⛶' };
    const out: Node[] = [h('p', { class: 'sub', text: `Đội đứng chờ tín hiệu; khi đánh chỉ những thẻ này hiện thành nút. Đã dùng ${plan.cards.length}/${sim.cardLimit()} thẻ.` }),
      opts('', this.tile('📯', 'Tín hiệu', 'một thẻ cho cả kế hoạch', !!has('signal'), toggle('signal'), { disabled: !draft }),
        ...CARD_KINDS.filter((k) => k !== 'formation').map((k) => this.tile(icon[k] ?? '•', CARD_NAME[k], 'bấm để thêm hoặc bỏ thẻ', !!has(k), toggle(k), { disabled: !draft })),
        this.tile('⛶', 'Đổi trận', 'chọn trận pháp mới', this.formRow || plan.cards.some((cd) => cd.kind === 'formation' && cd.squad === squad), () => { this.formRow = !this.formRow; this.refresh(); }))];
    if (this.formRow) out.push(opts('three', ...FORMATION_IDS.map((f) => this.tile('⛶', FORMATIONS[f].name, '', !!has('formation', f), toggle('formation', f), { disabled: !draft }))));
    return out;
  }

  // ---------------------------------------------------------------- defence
  private defensePage(): Node[] {
    const { sim } = this, out: Node[] = [], plan = sim.plans.find((p) => p.kind === 'defense');
    out.push(hint('Kế hoạch phòng thủ', 'Mẫu phòng thủ: mỗi đội đứng ở đâu khi trống báo động. Khi đánh trống, dân về đống lửa và các đội về đúng vị trí; đội đứng chòi sẽ cho cung thủ lên chòi. Không có mẫu thì mọi đội đứng quanh đống lửa.'));
    out.push(h('div', { class: 'btns' },
      h('button', { class: 'sm primary', text: plan ? 'Soạn mẫu mới' : 'Lập mẫu phòng thủ', onclick: () => { sim.newPlan('defense', null); this.refresh(); } }),
      h('button', { class: 'sm danger', text: sim.alarmUntil > sim.time ? 'Đang báo động' : 'Đánh trống báo động', disabled: sim.alarmUntil > sim.time, onclick: () => { this.toast(sim.soundAlarm()); this.refresh(); } })));
    if (!plan) return out;
    for (const m of plan.missions) out.push(this.missionCard(plan, m));
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
