import { DAY_LENGTH } from '../sim/constants';
import type { Villager } from '../sim/model';
import { h, hint } from './dom';
import { RolePane } from './rolepane';
import type { Ctx } from './ctx';

const PHASE = { go: 'đang tới', watch: 'đang thám thính', back: 'đang về' } as const;
const LEVEL_NAME = ['chưa có', 'cấp 1: vị trí, số dân, hướng vào làng', 'cấp 2: thêm đường vào, hàng rào, cổng, chòi canh', 'cấp 3: thêm số lính từng loại, kho lương, thủ lĩnh'];

/** "5 phút" for a span of game seconds. */
const minutes = (sec: number): string => `${Math.max(1, Math.round(sec / 60))} phút`;

/**
 * The scouting list: the villages somebody found (with only how far they lie), a button to send scouts to each, and the picker that
 * chooses the scouts and says how likely a full map is. Used in the Trại trinh sát and in the war tent.
 */
export class ScoutPane {
  readonly root = h('div', { class: 'page' });
  /** The village whose scout picker is open ('' when none) and the people ticked in it. */
  private open = '';
  private readonly picked = new Set<number>();
  /** The scouts themselves: taken on and let go here, like the soldiers in their camps. */
  private readonly people: RolePane;
  private key = '';

  /** `changed` asks whoever shows this pane to draw it again. */
  constructor(private readonly c: Ctx, private readonly changed: () => void = () => this.update()) { this.people = new RolePane(c, 'scout', () => { this.key = ''; this.changed(); }); }

  /** Draw again when anything shown has changed. */
  update(): void {
    const k = this.stateKey();
    if (k === this.key) return;
    this.key = k;
    this.root.replaceChildren(...this.render());
  }

  /** Everything the page shows, as one string: a panel that embeds this one adds it to its own. */
  stateKey(): string {
    const { sim } = this.c;
    return [this.open, [...this.picked].join('.'), this.people.stateKey(), JSON.stringify(sim.sightings.map((s) => [s.tribe, s.reported])), JSON.stringify(sim.maps.map((m) => [m.tribe, m.level, m.gaps, Math.floor(m.at)])),
      JSON.stringify(sim.scouts.map((m) => [m.id, m.phase, m.ids.length])), sim.scoutLevel(), sim.scoutLimit(), this.candidates().map((v) => v.id).join('.'), Math.floor(sim.time / DAY_LENGTH), sim.dev.freeBuild].join('|');
  }

  /** The scouts who can be sent now, the sharpest first. */
  private candidates(): Villager[] {
    const { sim } = this.c;
    return sim.villagers.filter((v) => sim.canScout(v)).sort((a, b) => sim.scoutSkill(b) - sim.scoutSkill(a));
  }

  private statsOf(v: Villager): string {
    return `Nhanh ${v.stats.agi} · Thể lực ${v.stats.sta} · Trí tuệ ${v.stats.int} · điểm ${(this.c.sim.scoutSkill(v) * 10).toFixed(1)}`;
  }

  private again(): void { this.key = ''; this.changed(); }

  private ageWords(at: number): string {
    const days = Math.floor((this.c.sim.time - at) / DAY_LENGTH);
    return days <= 0 ? 'báo cáo trong ngày' : days === 1 ? 'báo cáo từ hôm qua' : days < 4 ? `báo cáo từ ${days} hôm trước` : 'đã cũ';
  }

  render(): Node[] {
    const { sim } = this.c, out: Node[] = [];
    const level = sim.scoutLevel(), limit = sim.scoutLimit();
    out.push(hint('Trinh sát và bản đồ', 'Dân, lính hay trinh sát đi quanh bản đồ mà gặp một ngôi làng, khi trở về sẽ báo lại: ở đây chỉ ghi làng đó cách bao xa. Muốn biết thêm phải cử trinh sát. Bản đồ vẽ ra ở cấp cao nhất bạn đã nghiên cứu. Trinh sát là một vai trò như lính: tuyển ở trên, số lượng tối đa theo cấp trại. Mỗi chuyến cần nhiều người, mà người giỏi (Nhanh nhẹn, Thể lực, Trí tuệ) đáng giá hơn: một mình thì không bao giờ vẽ đủ. Càng đông thì đi càng nhanh. Trinh sát có thể chết, bản đồ mất 10% độ chính xác mỗi ngày.'));
    out.push(h('p', { class: 'sub', text: `Bản đồ vẽ được: ${LEVEL_NAME[level]}. ${limit ? `Trại trinh sát cho cử tối đa ${limit} người một chuyến.` : 'Chưa có Trại trinh sát.'}` }));
    if (!sim.dev.freeBuild && !level) out.push(h('p', { class: 'sub', text: 'Cần nghiên cứu "Trinh sát" ở Nhà nghiên cứu, rồi dựng Trại trinh sát.' }));
    else if (!sim.dev.freeBuild && !limit) out.push(h('p', { class: 'sub', text: 'Hãy dựng Trại trinh sát.' }));

    out.push(...this.people.render());
    out.push(h('h3', { text: 'Làng đã phát hiện' }));
    const found = sim.tribes.filter((t) => t.state !== 'destroyed' && sim.isFound(t.id));
    if (!found.length) out.push(h('p', { class: 'sub', text: 'Chưa ai phát hiện ngôi làng nào. Cho dân hoặc lính đi quanh bản đồ: gặp làng nào rồi trở về thì sẽ báo ở đây.' }));
    for (const t of found) {
      const maps = sim.maps.filter((m) => m.tribe === t.id).sort((a, b) => b.level - a.level), best = maps[0], where = sim.whereIs(t.id);
      const trip = sim.scouts.find((m) => m.tribe === t.id), plan = sim.planScout([], t.id);
      const far = where ? `cách đây khoảng ${where.dist} ô về phía ${where.dir}` : '';
      const known = best ? `Bản đồ cấp ${sim.mapLevel(t.id) || best.level}${best.gaps ? ' (còn hở)' : ''}, ${this.ageWords(best.at)}` : 'Chưa vẽ bản đồ';
      const blocked = plan.error === 'Cần nghiên cứu: Trinh sát' || plan.error === 'Cần dựng Trại trinh sát';
      out.push(h('div', { class: 'row', style: 'flex-direction:column;align-items:stretch' },
        h('div', { class: 'nm' }, h('b', { text: best ? t.def.name : 'Một ngôi làng' }), h('small', { text: best ? `${far} · ${known}` : `Phát hiện ${far}. ${known}.` })),
        trip
          ? h('small', { class: 'sub', text: `${trip.ids.length} trinh sát ${PHASE[trip.phase]} (bản đồ cấp ${trip.level})` })
          : h('div', { class: 'btns' }, h('button', { class: 'sm primary', text: this.open === t.id ? 'Đóng' : 'Cử trinh sát', disabled: blocked, title: blocked ? plan.error ?? '' : 'Chọn những người đi trinh sát',
            onclick: () => { this.open = this.open === t.id ? '' : t.id; this.picked.clear(); this.again(); } })),
        this.open === t.id && !trip ? this.picker(t.id) : null));
    }
    return out;
  }

  /** The list of people to pick from, with what the trip would be like for the ones ticked so far. */
  private picker(tribe: string): HTMLElement {
    const { sim } = this.c, people = this.candidates(), limit = sim.scoutLimit();
    for (const id of [...this.picked]) if (!people.some((v) => v.id === id)) this.picked.delete(id);
    const ids = [...this.picked], plan = sim.planScout(ids, tribe);
    const list = h('div', { class: 'rdrop' });
    if (!people.length) list.append(h('p', { class: 'sub', text: 'Không có trinh sát nào rảnh để đi: tuyển thêm, hoặc đợi họ về.' }));
    for (const v of people) {
      const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
      box.checked = this.picked.has(v.id); box.disabled = !box.checked && this.picked.size >= limit;
      box.addEventListener('change', () => { if (box.checked) this.picked.add(v.id); else this.picked.delete(v.id); this.again(); });
      list.append(h('label', { class: 'rpick' }, box, h('span', { class: 'rwho' }, h('b', { text: v.name }),
        h('small', { text: this.statsOf(v) }))));
    }
    const odds = plan.count < 2 ? 'Cần ít nhất 2 người mới có cơ hội vẽ đủ chi tiết' : `Tỉ lệ vẽ đủ chi tiết: ${Math.round(plan.chance * 100)}%`;
    return h('div', { class: 'proster', style: 'display:grid;gap:4px' }, list,
      h('small', { class: 'sub', text: `Đã chọn ${plan.count}/${limit} · bản đồ cấp ${Math.max(1, plan.level)}` }),
      h('small', { class: 'sub', text: `${odds} (mức cần khoảng ${plan.need} người trung bình, chỉ tính người trở về)` }),
      plan.count ? h('small', { class: 'sub', text: `Cả chuyến đi về mất chừng ${minutes(plan.total)} (đi ${minutes(plan.walk)}, thám thính ${minutes(plan.survey)}; đông người thì thám thính nhanh hơn)` }) : null,
      h('button', { class: 'sm primary', text: 'Lên đường', disabled: !!plan.error, title: plan.error ?? 'Cử những người đã chọn',
        onclick: () => {
          const e = sim.startScout(ids, tribe);
          if (e) this.c.toast(e); else { this.open = ''; this.picked.clear(); }
          this.again();
        } }));
  }
}
