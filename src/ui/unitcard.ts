import { JOB_NAME, roleName, roleOf } from '../sim/jobs';
import type { Villager } from '../sim/sim';
import { h } from './dom';
import { InfoCard } from './infocard';
import { dlg, GameDialog } from './gamedialog';
import { avatar } from './people';
import { UnitDetail } from './unitdetail';
import type { Ctx } from './ctx';
import { describe } from './describe';

// ================================================================== selected villagers
export class UnitCard {
  private readonly info: InfoCard;
  private readonly win: GameDialog;
  private card!: HTMLElement; private dname!: HTMLElement; private dstate!: HTMLElement;
  private readonly detail: UnitDetail; private picBox!: HTMLElement; private picKey = '';
  private open = false;

  /** `root` is the small card over the map; `modal` is the full-screen page with everything about the chosen villagers. */
  constructor(readonly root: HTMLElement, private readonly c: Ctx, modal: HTMLElement) {
    const { sim, ctl } = c, ids = () => [...ctl.selected];
    this.win = new GameDialog(modal, { onClose: () => { this.open = false; } });
    this.detail = new UnitDetail(c, { ids, leave: () => this.closeDetail() });
    // the small card over the map: the trade and what they do, and the way into the dialog
    this.info = new InfoCard(root);
    // the dialog: who and what job, the stats, then what can be given and ordered
    const head = dlg.head({ pic: h('span'), title: '—', sub: '—', onClose: () => this.closeDetail() });
    this.picBox = head.querySelector('.dpic') as HTMLElement; this.dname = head.querySelector('.dtitle') as HTMLElement; this.dstate = head.querySelector('.dsub') as HTMLElement;
    this.card = dlg.card({ wide: true, label: 'Giao việc và chi tiết' }, head,
      this.detail.body,
    );
  }

  private chosen(): Villager[] { const { sim, ctl } = this.c; return sim.villagers.filter((v) => ctl.selected.has(v.id)); }
  closeDetail(): void { this.open = false; this.win.hide(); }

  update(chosen: Villager[]): void {
    const sim0 = this.c.sim;
    if (this.c.ctl.openDetail) { this.c.ctl.openDetail = false; if (chosen.length) this.open = true; }
    this.root.hidden = chosen.length === 0;
    if (!chosen.length) { this.closeDetail(); return; }
    if (this.open && !this.win.isOpen) this.win.show(this.card);
    if (!this.open && this.win.isOpen) this.win.hide();
    const v = chosen[0];
    const title = chosen.length > 1 ? `${v.name} và ${chosen.length - 1} người nữa` : v.name;
    const role = roleOf(v), job = role ? roleName(role, sim0.era) : JOB_NAME[v.job]; // the trade, not what they are doing this moment
    const doing = describe(v, sim0);
    this.dname.textContent = title; this.dstate.textContent = job;
    this.info.set({
      picKey: `${v.id}|${v.armor}|${v.look.sex}`, pic: () => avatar(this.c, v),
      title, sub: `Nghề: ${job}`, line: `Đang ${doing.replace(/^đang /, '')}`,
      onClose: () => this.c.ctl.clearSelection(),
      actions: [{ id: 'job', label: 'Giao việc', tone: 'primary', onClick: () => { this.open = true; this.update(this.chosen()); } }],
    });
    if (!this.open) return;
    const pk = `${v.id}|${v.armor}|${v.look.sex}`;
    if (pk !== this.picKey) { this.picKey = pk; this.picBox.replaceChildren(avatar(this.c, v)); }
    this.detail.update(chosen);
  }
}
