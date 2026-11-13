import type { Building } from '../sim/buildings';
import { levelDef } from '../sim/buildings';
import { roleOf } from '../sim/jobs';
import type { Villager } from '../sim/model';
import { h, hint } from './dom';
import { icon } from './icons';
import { roleStats } from './people';
import { Roster } from './roster';
import type { Ctx } from './ctx';

const HELP = 'Lính chòi canh lấy thẳng từ dân (ai đang làm việc khác thì được cho nghỉ khỏi việc đó), không cần trại cung thủ: họ lên chòi, ở đó ngày và đêm (đổi ca ở chi tiết của họ) và bắn bằng cung hoặc dây quăng lấy ở Kho vũ khí. Họ bắn xa hơn và mạnh hơn khi đứng trên chòi, và kẻ địch phải phá chòi mới hạ được họ. Máu và sát thương của họ, và của chòi, tăng theo nghiên cứu Phòng thủ.';

/** The men of one Chòi canh, laid out like the people of a camp: a button to hand out gear, the villagers who may go up, and those on the tower. */
export class TowerPane {
  readonly root = h('div', { class: 'page' });
  private readonly roster: Roster; private key = '';
  constructor(private readonly c: Ctx) { this.roster = new Roster(c); }

  update(b: Building): void {
    const { sim } = this.c, crew = sim.garrison(b), free = this.free();
    const key = `${b.id}|${b.level}|${crew.map((v) => `${v.id}.${Math.round(v.health / 5)}.${Math.round(v.energy / 5)}.${v.weapon ?? ''}.${v.armor ?? ''}`).join()}|${free.map((v) => `${v.id}${v.job}`).join()}`;
    if (key === this.key) return;
    this.key = key;
    this.root.replaceChildren(...this.render(b, crew, free));
  }

  /** Who may go up: anyone alive who is not on a tower already, whatever they do now (they are let go from it first). */
  private free(): Villager[] { return this.c.sim.villagers.filter((v) => v.team === 'player' && roleOf(v) !== 'tower' && v.health > 0 && v.down <= 0); }

  private again(): void { this.key = ''; this.c.ctl.onChange(); }

  private render(b: Building, crew: Villager[], free: Villager[]): Node[] {
    const { sim, toast } = this.c, slots = levelDef(b).slots, lock = sim.warLock();
    const tools = crew.length ? [h('button', { class: 'sm tbtn primary', type: 'button', title: 'Phát vũ khí bắn và giáp đang có trong kho cho mọi người trên chòi này: đồ cấp cao trước, ai đang cầm đồ thấp thì đổi lấy đồ cao hơn',
      onclick: () => { toast(sim.equipGroup(crew.map((v) => v.id))); this.again(); } }, icon('equip', 15), 'Trang bị')] : [];
    return [h('div', { class: 'proster', style: 'display:grid;gap:10px' },
      hint(tools.length ? h('div', { class: 'btns toolbar' }, ...tools) : h('b', { text: 'Lính chòi canh' }), HELP),
      ...this.roster.render({
        assigned: [...crew].sort((x, y) => y.stats.agi - x.stats.agi), cap: slots, statIds: roleStats('tower'), stat: (v) => v.stats.agi, pool: free,
        addBlock: lock ?? (crew.length >= slots ? `Chòi canh cấp ${b.level} đã đủ ${slots} lính: nâng cấp để chứa thêm` : null),
        add: (v) => sim.assignTower([v.id], b.id), remove: (v) => { sim.leaveTower([v.id]); return null; }, removeBlock: () => lock,
        emptyIn: 'Chưa có ai trên chòi.', emptyPool: 'Không có ai để thêm.', again: () => this.again(),
      }))];
  }
}
