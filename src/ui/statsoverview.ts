/**
 * What research has added so far, for everyone of a kind: each trade, each kind of soldier, the houses of work and the weapons, with the percent each stat has gained
 * and the tier opened (not for one villager: the same for all who have that role). The page of the menu "Chỉ số".
 */
import { CHAINS, PLAN_TECH, statsFor, TECH_BY_ID, lineLevel, soldierTier, statBonus, statLevels, STAT_DEF, TREE_ROLES } from '../sim/research';
import type { LineStat } from '../sim/research';
import { h } from './dom';
import { statIcon } from './resicons';
import type { Ctx } from './ctx';

/** The chains of the research tree in the order they are shown, with how each group is called. */
const GROUPS: Array<{ title: string; chains: string[]; note: string }> = [
  { title: 'Lính', chains: ['military'], note: 'Cộng cho mọi lính cùng loại: bộ, kỵ, ném, trinh sát (lính gác tính như lính bộ).' },
  { title: 'Khi hành quân', chains: ['march', 'marchlog'], note: 'Chỉ cộng trong chiến tranh, khi quân đang hành quân hoặc nghỉ ngơi (không cộng lúc đang đánh). Tốc độ hành quân và tải hậu cần cộng cho cả quân.' },
  { title: 'Khi giao chiến', chains: ['tactic'], note: 'Chỉ cộng trong chiến tranh, khi quân đang giao chiến.' },
  { title: 'Dân theo nghề', chains: ['economy'], note: 'Cộng cho mọi người làm cùng nghề: đốn gỗ, thợ đá, hái lượm, thợ săn, làm ruộng, thuần thú.' },
  { title: 'Người làm trong nhà', chains: ['development'], note: 'Thợ xây, người chế tạo và nhà nghiên cứu.' },
  { title: 'Vũ khí', chains: ['weapon'], note: 'Cộng cho vũ khí: ai cầm nó đều được.' },
  { title: 'Công cụ', chains: ['tool', 'hammer'], note: 'Cộng cho công cụ: ai dùng nó đều được.' },
  { title: 'Phòng thủ', chains: ['defense', 'works1', 'works2'], note: 'Lính gác, lính chòi, hàng rào, cổng, chông và chòi canh.' },
];
const pct = (n: number): string => `${n >= 0 ? '+' : ''}${(Math.round(n * 10) / 10).toLocaleString('vi')}%`;

export class StatsOverview {
  readonly root = h('div', { class: 'sover' });
  private key = '';
  constructor(private readonly c: Ctx) {}

  /** Draw again when the research done has changed. */
  update(): void {
    const { sim } = this.c, key = `${sim.researched.size}|${sim.era === 'ancient'}`;
    if (key === this.key) return;
    this.key = key;
    const kids: Node[] = [h('p', { class: 'dsub', text: 'Tổng chỉ số đã nghiên cứu cho từng loại dân, nghề và lính (cộng thêm vào chỉ số gốc của mỗi người). Số bên trái mỗi chỉ số là phần trăm cộng thêm, số bên phải là cấp đã nghiên cứu.' })];
    for (const g of GROUPS) {
      if (sim.era !== 'ancient' && (g.chains.includes('march') || g.chains.includes('tactic'))) continue; // the war research is of the medieval layer
      const rows: HTMLElement[] = [];
      for (const cn of g.chains) {
        const chain = CHAINS[cn];
        if (!chain) continue;
        for (const role of chain.roles) {
          if (!TREE_ROLES[role] || (role === 'scout' && sim.era !== 'ancient')) continue; // the scouts are of the medieval layer
          const tier = soldierTier(sim.researched, role);
          const pills = statsFor(chain, role).map((stat) => {
            const bonus = statBonus(sim.researched, role, stat as LineStat), lv = lineLevel(sim.researched, role, stat), top = statLevels(stat);
            return h('span', { class: `spill${bonus > 0 ? '' : ' zero'}`, title: `${STAT_DEF[stat as LineStat].name}: ${pct(bonus)} (cấp ${lv}/${top})` }, h('span', { class: 'ico-wrap' }, statIcon(stat)), h('b', { text: pct(bonus) }), h('small', { text: `${lv}/${top}` }));
          });
          rows.push(h('div', { class: 'srole' }, h('div', { class: 'sname' }, h('b', { text: TREE_ROLES[role].name }), tier > 1 ? h('span', { class: 'chip', text: `Bậc ${tier}` }) : null), h('div', { class: 'spills' }, ...pills)));
        }
      }
      if (rows.length) kids.push(h('section', {}, h('h3', { text: g.title }), h('p', { class: 'dsub', text: g.note }), ...rows));
    }
    // what the war plan has opened (the Kế hoạch chiến đấu research)
    if (sim.era === 'ancient') {
    const open = (Object.entries(PLAN_TECH) as Array<[keyof typeof PLAN_TECH, string]>).map(([f, id]) => h('span', { class: `spill${sim.planOpen(f) ? '' : ' zero'}`, title: TECH_BY_ID[id].desc }, h('b', { text: TECH_BY_ID[id].name }), h('small', { text: sim.planOpen(f) ? '✓' : '🔒' })));
    kids.push(h('section', {}, h('h3', { text: 'Kế hoạch tác chiến' }), h('p', { class: 'dsub', text: 'Các phần của bảng kế hoạch và báo cáo trận đã mở.' }), h('div', { class: 'spills' }, ...open)));
    }
    this.root.replaceChildren(...kids);
  }
}
