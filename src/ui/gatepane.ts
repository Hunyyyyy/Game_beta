import type { Building } from '../sim/buildings';
import type { Villager } from '../sim/model';
import { h, hint } from './dom';
import { roleStats } from './people';
import { Roster } from './roster';
import type { Ctx } from './ctx';

const HELP = 'Lính gác của Trại lính gác đứng ngay trong cổng. Có họ, cổng tự mở khi trời sáng cho dân ra vào, tự đóng khi trời tối lúc dân đã vào hết; khi làng bị đánh thì đóng khi dân đã vào hết, hết địch lại mở. Bạn vẫn mở hoặc đóng tay được: lệnh của bạn được giữ một lúc rồi lính gác lại tự lo. Lính ở cổng cũng là những người ra chặn người lạ tới cổng; làng không có cổng, hoặc cổng không có lính gác, thì không ai ra chặn.';

/** The guards of one gate, laid out like the people of a camp: the guards who may be posted here, and those who are. */
export class GatePane {
  readonly root = h('div', { class: 'page' });
  private readonly roster: Roster; private key = '';
  constructor(private readonly c: Ctx) { this.roster = new Roster(c); }

  update(b: Building): void {
    const crew = this.c.sim.gateGuards(b), free = this.free(b);
    const key = `${b.id}|${crew.map((v) => `${v.id}.${Math.round(v.health / 5)}`).join()}|${free.map((v) => v.id).join()}`;
    if (key === this.key) return;
    this.key = key;
    this.root.replaceChildren(...this.render(b, crew, free));
  }

  /** Who may be posted: the guards of the Trại lính gác who are not at this gate already. */
  private free(b: Building): Villager[] { return this.c.sim.villagers.filter((v) => v.team === 'player' && v.guard && v.job === 'fight' && v.health > 0 && v.down <= 0 && v.gate !== b.id); }

  private again(): void { this.key = ''; this.c.ctl.onChange(); }

  private render(b: Building, crew: Villager[], free: Villager[]): Node[] {
    const { sim } = this.c, slots = sim.gateSlots(), lock = sim.warLock();
    return [h('div', { class: 'proster', style: 'display:grid;gap:10px' },
      hint(h('b', { text: 'Lính gác cổng' }), HELP),
      ...this.roster.render({
        assigned: [...crew], cap: slots, statIds: roleStats('guard'), stat: (v) => v.stats.str, pool: free,
        addBlock: lock ?? (crew.length >= slots ? `Cổng chỉ có ${slots} lính gác` : null),
        add: (v) => sim.assignGate([v.id], b.id), remove: (v) => { sim.leaveGate([v.id]); return null; }, removeBlock: () => lock,
        emptyIn: 'Chưa có lính gác nào ở cổng.', emptyPool: 'Không có lính gác nào để thêm (cần Trại lính gác).', again: () => this.again(),
      }))];
  }
}
