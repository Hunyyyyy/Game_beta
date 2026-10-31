import { DAY_LENGTH } from '../sim/constants';
import type { Villager } from '../sim/model';
import { h, hint } from './dom';
import { dlg } from './gamedialog';
import { detailButton, personTile } from './people';
import { RolePane } from './rolepane';
import { resIcon, statIcon } from './resicons';
import type { Ctx } from './ctx';

const PHASE = { go: 'đang tới', watch: 'đang thám thính', back: 'đang về' } as const;
const LEVEL_NAME = ['chưa có', 'cấp 1: vị trí, số dân, hướng vào làng', 'cấp 2: thêm đường vào, hàng rào, cổng, chòi canh', 'cấp 3: thêm số lính từng loại, kho lương, thủ lĩnh'];

/** "5 phút" for a span of game seconds. */
const minutes = (sec: number): string => `${Math.max(1, Math.round(sec / 60))} phút`;

/**
 * The scouting pages of the Trại trinh sát. Two pages, each its own tab: the scouts themselves (taken on and let go here like the soldiers in their
 * camps) and the villages somebody found. The villages page is a list with the details of the chosen one beside it, like the people of the campfire:
 * the map the village has, the scouts to send (picked the way people are added to any house) and the report of how the trip would go.
 */
export class ScoutPane {
  /** The page of the scouts. */
  readonly roster = h('div', { class: 'page' });
  /** The page of the villages: the list on the left, the chosen village on the right. */
  readonly villages = h('div', { class: 'split' });
  /** The village chosen in the list ('' for none), whether the picker of scouts is open, and the people picked to go. */
  private sel = '';
  private open = false;
  private readonly picked = new Set<number>();
  private readonly people: RolePane;
  private key = '';

  /** `changed` asks whoever shows this pane to draw it again. */
  constructor(private readonly c: Ctx, private readonly changed: () => void = () => this.update()) { this.people = new RolePane(c, 'scout', () => { this.key = ''; this.changed(); }); }

  /** Draw again when anything shown has changed. */
  update(): void {
    const k = this.stateKey();
    if (k === this.key) return;
    this.key = k;
    this.roster.replaceChildren(...this.renderRoster());
    this.villages.replaceChildren(...this.renderVillages());
  }

  /** Everything the pages show, as one string. */
  stateKey(): string {
    const { sim } = this.c;
    return [this.sel, this.open, [...this.picked].join('.'), this.people.stateKey(), JSON.stringify(sim.sightings.map((s) => [s.tribe, s.reported])), JSON.stringify(sim.maps.map((m) => [m.tribe, m.level, m.gaps, Math.floor(m.at)])),
      JSON.stringify(sim.scouts.map((m) => [m.id, m.phase, m.ids.length, Math.floor((m.progress ?? 0) * 50)])), JSON.stringify(sim.drafts), sim.scoutLevel(), sim.scoutLimit(), this.candidates().map((v) => `${v.id}${Math.round(v.energy / 10)}`).join('.'), Math.floor(sim.time / DAY_LENGTH), sim.dev.freeBuild].join('|');
  }

  /** The scouts who can be sent now, the sharpest first. */
  private candidates(): Villager[] {
    const { sim } = this.c;
    return sim.villagers.filter((v) => sim.canScout(v)).sort((a, b) => sim.scoutSkill(b) - sim.scoutSkill(a));
  }

  private again(): void { this.key = ''; this.changed(); }

  private ageWords(at: number): string {
    const days = Math.floor((this.c.sim.time - at) / DAY_LENGTH);
    return days <= 0 ? 'báo cáo trong ngày' : days === 1 ? 'báo cáo từ hôm qua' : days < 4 ? `báo cáo từ ${days} hôm trước` : 'đã cũ';
  }

  // ---------------------------------------------------------------- the scouts
  private renderRoster(): Node[] {
    const { sim } = this.c, level = sim.scoutLevel(), limit = sim.scoutLimit();
    const out: Node[] = [hint('Trinh sát', 'Trinh sát là một vai trò, tuyển từ lính kỵ của Trại kỵ thú và cho nghỉ ở đây: số lượng tối đa theo cấp trại. Mỗi chuyến cần nhiều người, mà người giỏi (Nhanh nhẹn, Thể lực) đáng giá hơn: một mình thì không bao giờ vẽ đủ. Càng đông thì đi càng nhanh. Trinh sát có thể chết.')];
    out.push(dlg.line('Bản đồ vẽ được', LEVEL_NAME[level]));
    if (!sim.dev.freeBuild && !limit) out.push(dlg.why('Hãy dựng Trại trinh sát.'));
    out.push(...this.people.render());
    return out;
  }

  // ---------------------------------------------------------------- the villages
  private renderVillages(): Node[] {
    const { sim } = this.c, found = sim.tribes.filter((t) => t.state !== 'destroyed' && sim.isFound(t.id));
    if (this.sel && !found.some((t) => t.id === this.sel)) this.sel = '';
    const list = h('div', {}, hint('Làng đã phát hiện', 'Dân, lính hay trinh sát đi quanh bản đồ mà gặp một ngôi làng, khi trở về sẽ báo lại: chỉ ghi làng đó cách bao xa. Muốn biết thêm phải cử trinh sát. Bản đồ vẽ ra ở cấp bằng cấp Trại trinh sát (lều cấp 1 vẽ bản đồ cấp 1, và cứ thế). Bản đồ mất 10% độ chính xác mỗi ngày.'),
      found.length ? dlg.list(...found.map((t) => this.villageTile(t.id))) : dlg.empty('Chưa ai phát hiện ngôi làng nào. Cho dân hoặc lính đi quanh bản đồ: gặp làng nào rồi trở về thì sẽ báo ở đây.'));
    const pane = h('div', { class: 'ppane' }, this.sel ? this.detail(this.sel) : dlg.empty('Chọn một ngôi làng ở bên trái để xem bản đồ và cử trinh sát.'));
    return [list, pane];
  }

  /** One village in the list: its name, how far, what the map shows and whether scouts are out there. */
  private villageTile(id: string): HTMLElement {
    const { sim } = this.c, t = sim.tribes.find((x) => x.id === id)!, best = sim.maps.filter((m) => m.tribe === id).sort((a, b) => b.level - a.level)[0], where = sim.whereIs(id), trip = sim.scouts.find((m) => m.tribe === id);
    const known = best ? t.def.name : 'Một ngôi làng';
    const tile = dlg.tile({ pic: '🏕', name: known, chip: trip ? dlg.chip(`${trip.ids.length} trinh sát ${PHASE[trip.phase]}`) : best ? dlg.chip(`Bản đồ cấp ${sim.mapLevel(id) || best.level}`) : dlg.chip('Chưa vẽ'), state: id === this.sel ? 'now' : undefined },
      [dlg.more(where ? `Cách khoảng ${where.dist} ô, hướng ${where.dir}` : ''), best ? dlg.more(`${best.gaps ? 'Còn hở · ' : ''}${this.ageWords(best.at)}`) : null]);
    tile.classList.add('pick');
    tile.addEventListener('click', () => { this.sel = id === this.sel ? '' : id; this.open = false; this.picked.clear(); this.again(); });
    return tile;
  }

  /** The chosen village: the map it has, the scouts going, and how the trip would turn out. */
  private detail(id: string): Node {
    const { sim } = this.c, t = sim.tribes.find((x) => x.id === id)!, maps = sim.maps.filter((m) => m.tribe === id).sort((a, b) => b.level - a.level), best = maps[0], where = sim.whereIs(id), trip = sim.scouts.find((m) => m.tribe === id);
    const body = h('div', { class: 'pside' });
    body.append(h('div', { class: 'dhead' }, h('div', { class: 'dpic glyph', text: '🏕' }), h('div', { class: 'dwho' }, h('b', { class: 'dtitle', text: best ? t.def.name : 'Một ngôi làng' }), h('small', { class: 'dsub', text: where ? `Cách khoảng ${where.dist} ô, hướng ${where.dir}` : '' }))));
    // what is known of it
    if (best) {
      const days = Math.floor((sim.time - best.at) / DAY_LENGTH), accuracy = Math.max(0, 1 - 0.1 * days);
      body.append(h('div', { class: 'dpills' },
        dlg.pill(resIcon('role_scout'), `Bản đồ cấp ${sim.mapLevel(id) || best.level}`, undefined, 'Cấp bản đồ đã vẽ'),
        dlg.pill(resIcon('clock'), this.ageWords(best.at), days >= 3 ? 'warn' : undefined, 'Báo cáo cũ hay mới'),
        best.gaps ? dlg.pill('❔', 'còn hở', 'warn', 'Bản đồ còn chỗ chưa vẽ') : null),
        dlg.bar(Math.round(accuracy * 100), 100, `độ chính xác ${Math.round(accuracy * 100)}%`));
    } else body.append(dlg.note('Chưa vẽ bản đồ: cử trinh sát để biết thêm.', false));
    const plan0 = sim.planScout([], id);
    if (!trip && plan0.error === 'Cần dựng Trại trinh sát') { body.append(dlg.why(plan0.error)); return body; }
    // the drawing of the map: how much is done and every condition of it, from the top down (green done, red not yet)
    const flow = sim.scoutFlow(id), pct = Math.round(flow.progress * 100);
    body.append(dlg.bar(pct, 100, `Bản đồ cấp ${flow.level} vẽ được ${pct}%`));
    if (trip) body.append(dlg.line('Đang đi trinh sát', `${trip.ids.length} người ${PHASE[trip.phase]}`));
    else if (!flow.steps.every((st) => st.done) && flow.progress > 0) body.append(dlg.note(`Đã vẽ dở ${pct}%: cử trinh sát đi vẽ tiếp từ chỗ đó.`, false));
    body.append(h('div', { class: 'flow' }, ...flow.steps.flatMap((st, i) => [i ? h('span', { class: `link ${flow.steps[i - 1].done ? 'done' : 'todo'}` }) : null, h('div', { class: `step ${st.done ? 'done' : 'todo'}` }, h('b', { text: st.done ? '✓' : '✗' }), h('span', { text: st.label }))])));
    if (trip) body.append(trip.phase === 'back' ? dlg.note('Trinh sát đang trên đường về.', false) : dlg.button('Gọi trinh sát về', () => { const e = sim.recallScouts(id); this.c.toast(e ?? 'Đã gọi trinh sát về: họ mang về phần đã vẽ'); this.again(); }, { tone: 'alt', title: 'Gọi về khi chưa vẽ xong: phần đã vẽ được giữ, người khác vẽ tiếp' }));
    if (trip?.phase === 'back') return body;

    // who goes: the same list as the people of a house, with the button to add more
    const people = this.candidates(), limit = sim.scoutLimit();
    for (const pid of [...this.picked]) if (!people.some((v) => v.id === pid)) this.picked.delete(pid);
    const goers = people.filter((v) => this.picked.has(v.id)), others = people.filter((v) => !this.picked.has(v.id)), ids = goers.map((v) => v.id), plan = sim.planScout(ids, id);
    const full = goers.length >= limit - (trip?.ids.length ?? 0);
    const add = h('button', { class: 'sm primary', text: this.open ? 'Xong' : trip ? 'Cử thêm trinh sát tới' : 'Thêm người đi trinh sát', disabled: full && !this.open, onclick: () => { this.open = !this.open; this.again(); } });
    body.append(hint(h('div', { class: 'dhouse' }, h('b', { text: 'Người đi trinh sát' }), dlg.slots(goers.length + (trip?.ids.length ?? 0), limit), h('small', { class: 'dsub', text: 'nâng cấp trại để cử thêm' })),
      'Trinh sát làm cả ngày lẫn đêm và chỉ về khi vẽ xong bản đồ. Càng đông và càng giỏi (Nhanh nhẹn, Thể lực) thì vẽ càng nhanh. Nếu trinh sát chết, cử người khác tới vẽ tiếp: phần đã vẽ vẫn còn. Bản đồ chỉ có khi trinh sát trở về.'));
    body.append(goers.length ? dlg.list(...goers.map((v) => this.scoutTile(v, '−', () => { this.picked.delete(v.id); this.again(); }, false))) : dlg.empty('Chưa chọn ai đi.'), add);
    if (this.open) body.append(h('div', { class: 'picker' }, h('p', { class: 'sub', text: full ? `Trại chỉ cho đi ${limit} người một chuyến.` : 'Chọn ai đi trinh sát:' }),
      others.length ? dlg.list(...others.map((v) => this.scoutTile(v, '＋', () => { this.picked.add(v.id); this.again(); }, full))) : dlg.empty('Không còn trinh sát nào rảnh: tuyển thêm, hoặc đợi họ về.')));

    // the report: how the trip would go, as a gauge, strengths and times
    const chance = plan.count + (trip?.ids.length ?? 0) < 2 ? 0 : plan.chance, tone = chance >= 0.7 ? 'good' : chance >= 0.35 ? 'warn' : 'bad';
    body.append(h('div', { class: 'dtile report' }, dlg.ring(chance, `${Math.round(chance * 100)}%`),
      h('div', { class: 'dmain' }, h('div', { class: 'dname' }, h('b', { text: 'Tỉ lệ vẽ đủ chi tiết' })),
        dlg.bar(Math.round(chance * 100), 100, plan.count < 2 ? 'cần ít nhất 2 người' : `${Math.round(chance * 100)}%`),
        dlg.more(`Đi ${plan.count}/${limit} người · mức cần khoảng ${plan.need} người trung bình`))));
    body.append(h('div', { class: 'dpills' },
      dlg.pill(resIcon('role_scout'), `${plan.count}/${plan.need} người`, plan.count >= plan.need ? 'good' : plan.count >= 2 ? 'warn' : 'bad', 'Số người đã chọn so với mức cần'),
      dlg.pill(resIcon('role_scout'), `Bản đồ cấp ${Math.max(1, plan.level)}`, undefined, 'Cấp bản đồ sẽ vẽ'),
      dlg.pill(statIcon('move'), `đi ${minutes(plan.walk)}`, undefined, 'Đường đi từ trại tới làng'),
      dlg.pill(statIcon('int'), `thám thính ${minutes(plan.survey)}`, undefined, 'Thời gian vẽ; đông người thì nhanh hơn'),
      dlg.pill(resIcon('clock'), `cả chuyến ${minutes(plan.total)}`, undefined, 'Đi, thám thính và về'),
      dlg.pill('🎯', `${Math.round(chance * 100)}%`, tone, 'Tỉ lệ vẽ đủ chi tiết')));
    if (plan.error) body.append(dlg.why(plan.error));
    body.append(dlg.button(trip ? 'Cử thêm người' : 'Lên đường', () => {
      const e = sim.startScout(ids, id);
      if (e) this.c.toast(e); else { this.open = false; this.picked.clear(); }
      this.again();
    }, { disabled: !!plan.error, title: plan.error ?? 'Cử những người đã chọn' }));
    return body;
  }

  /** A scout in a list: the same tile every house uses for its people, with the ⚙ for their details and a plus or minus to send or keep them. */
  private scoutTile(v: Villager, sign: '＋' | '−', act: () => void, disabled: boolean): HTMLElement {
    const sk = (this.c.sim.scoutSkill(v) * 10).toFixed(1);
    return personTile(this.c, v, { note: `điểm trinh sát ${sk}${v.weapon ? ' · vũ khí' : ''}${v.armor ? ' · giáp' : ''}${v.torch ? ' · đuốc' : ''}`, stats: ['move', 'sta'], actions: [
      detailButton(this.c, v),
      dlg.button(sign, act, { icon: true, tone: sign === '−' ? 'bad' : undefined, disabled, title: sign === '−' ? 'Không cử người này' : 'Cử người này đi' }),
    ] });
  }
}
