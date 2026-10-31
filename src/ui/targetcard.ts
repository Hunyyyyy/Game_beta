import { RES_NAME, Res } from '../sim/resources';
import { animalDef } from '../sim/fauna';
import { relationLabel, WEAPONS } from '../sim/combat';
import { iconCanvas } from './dom';
import { InfoCard } from './infocard';
import { avatar } from './people';
import { resIcon } from './resicons';
import type { Ctx } from './ctx';

// ================================================================== a foe, an animal, a carcass or a tree, rock or bush that was tapped
/** The same card as the one of a villager or a house (InfoCard): what it is, how it fares, and the orders that can be given to it. */
export class TargetCard {
  private readonly card: InfoCard;

  constructor(readonly root: HTMLElement, private readonly c: Ctx) {
    this.card = new InfoCard(root);
  }

  /** A villager of the matching trade, one of the nearest, is called without the player choosing. */
  private harvest(): void {
    const { ctl, sim, toast } = this.c, t = ctl.inspect; if (!t || t.kind !== 'node') return;
    const N = sim.world.size, r = sim.callWorker(t.id % N, Math.floor(t.id / N));
    toast('name' in r ? `${r.name} đi khai thác` : r.reason); ctl.onChange();
  }
  private attack(): void {
    const { ctl, sim, toast } = this.c, t = ctl.inspect;
    if (!t || t.kind === 'node' || !ctl.selected.size) { toast('Hãy chọn dân trước'); return; }
    if (!sim.orderAttack([...ctl.selected], { kind: t.kind, id: t.id })) toast(t.kind === 'unit' ? 'Chỉ chiến binh mới đánh: tuyển lính ở trại lính' : 'Chỉ Thợ săn hoặc chiến binh mới săn thú');
    ctl.onChange();
  }
  private loot(): void {
    const { ctl, sim, toast } = this.c, t = ctl.inspect;
    if (!t || !ctl.selected.size) { toast('Hãy chọn dân trước'); return; }
    if (!sim.orderLoot([...ctl.selected], t.id)) toast('Chỉ Thợ săn lột da: giao nghề Thợ săn bằng nút nghề trước');
    ctl.onChange();
  }

  update(): void {
    const t = this.c.ctl.inspect, { sim, ctl, sprites } = this.c;
    const gone = () => { ctl.inspect = null; this.root.hidden = true; };
    if (!t) { this.root.hidden = true; return; }
    const close = () => { ctl.inspect = null; ctl.onChange(); };
    const acts = (harvest: boolean, attack: boolean, loot: boolean, attackLabel = 'Tấn công', harvestOff = false) => [
      { id: 'harvest', label: 'Khai thác', tone: 'primary' as const, hidden: !harvest, disabled: harvestOff, onClick: () => this.harvest() },
      { id: 'attack', label: attackLabel, tone: 'primary' as const, hidden: !attack, onClick: () => this.attack() },
      { id: 'loot', label: 'Lột da, lấy thịt', hidden: !loot, onClick: () => this.loot() },
    ];

    if (t.kind === 'node') {
      const N = sim.world.size, n = sim.world.nodeAt(t.id % N, Math.floor(t.id / N));
      if (!n) { gone(); return; }
      this.root.hidden = false;
      const empty = n.kind === 'bush' && n.amount <= 0;
      this.card.set({
        picKey: `node|${n.kind}`, pic: () => resIcon(n.res),
        title: { tree: 'Cây', rock: 'Tảng đá', bush: 'Bụi quả' }[n.kind], sub: `cho ${RES_NAME[n.res].toLowerCase()}${n.workers ? ` · ${n.workers} người đang làm` : ''}`,
        line: empty ? 'Hết quả, đang chờ mọc lại' : `Còn ${Math.ceil(n.amount)}/${n.max}`,
        onClose: close, actions: acts(true, false, false, 'Tấn công', empty),
      });
      return;
    }
    if (t.kind === 'unit') {
      const f = sim.get(t.id);
      if (!f || f.health <= 0) { gone(); return; }
      const tribe = sim.tribes.find((x) => x.id === f.team);
      this.root.hidden = false;
      this.card.set({
        picKey: `unit|${f.id}|${f.armor}`, pic: () => avatar(this.c, f),
        title: f.name, sub: `${tribe?.def.name ?? ''} · ${f.ai?.role === 'civ' ? 'dân thường' : f.ai?.role === 'raider' ? 'kẻ tập kích' : 'chiến binh'}`,
        line: `Máu ${Math.ceil(f.health)}/${f.maxHealth} · Vũ khí ${f.weapon ? WEAPONS[f.weapon].name : 'tay không'}${tribe ? ` · quan hệ ${relationLabel(tribe.relation)}` : ''}`,
        onClose: close, actions: acts(false, true, false),
      });
      return;
    }
    const a = sim.animalById.get(t.id);
    if (!a) { gone(); return; }
    const d = animalDef(a), dead = a.state === 'dead';
    this.root.hidden = false;
    const drops = Object.entries(a.drops ?? {}).filter(([, n]) => (n ?? 0) > 0).map(([r, n]) => ` · ${n} ${RES_NAME[r as Res].toLowerCase()}`).join('');
    this.card.set({
      picKey: `animal|${a.species}`, pic: () => { try { return iconCanvas(sprites.mount(a.species, false, 0, 1)); } catch { return '🐾'; } },
      title: d.name, sub: dead ? 'xác' : { graze: 'đang gặm cỏ', wander: 'đang đi', flee: 'đang chạy trốn', attack: 'đang tấn công', sleep: 'đang ngủ', dead: 'xác' }[a.state],
      line: dead ? `Còn ${a.meat} thịt · ${a.hide} ${RES_NAME.hide.toLowerCase()}${drops}` : `Máu ${Math.ceil(a.hp)}/${a.maxHp}`,
      onClose: close, actions: acts(false, !dead, dead, d.prey ? 'Săn' : 'Tấn công'),
    });
  }
}
