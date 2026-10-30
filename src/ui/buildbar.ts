import { BUILDINGS, Building, BuildingKind, canGrow, levelCapByFire, levelDef, maxLevel, POP_BY_FIRE } from '../sim/buildings';
import { TILE, workDays } from '../sim/constants';
import { RES_NAME, Res, Stock } from '../sim/resources';
import type { Renderer } from '../render/renderer';
import { costText, h, iconCanvas } from './dom';
import { dlg, GameDialog } from './gamedialog';
import { InfoCard } from './infocard';
import { resIcon } from './resicons';
import type { Ctx } from './panels';

/** What the button that opens a building's panel is called. */
const OPEN_LABEL: Record<BuildingKind, string> = {
  campfire: 'Xem dân', builder: 'Thợ xây', storage: 'Kho', workshop: 'Chế tạo', lab: 'Nghiên cứu', toolstore: 'Kho công cụ', armory: 'Kho vũ khí', infantry: 'Quản lý lính', cavalry: 'Quản lý lính', archery: 'Quản lý lính', farmhouse: 'Giao việc', huntlodge: 'Giao việc', lumberyard: 'Giao việc', quarry: 'Giao việc', house: 'Người trong nhà', field: 'Người làm ruộng', fence: 'Hàng rào', gate: 'Cổng', tower: 'Cung thủ canh', wartent: 'Mở Lều họp chiến', scouttent: 'Xem trinh sát', drill: 'Xem bãi tập', trap: 'Hố chông', stable: 'Thuần thú',
};

/** The gatherers whose work a house shows (see Sim.yieldNow). */
const YIELD_OF: Partial<Record<BuildingKind, string>> = { lumberyard: 'wood', quarry: 'stone', farmhouse: 'food', field: 'farm', huntlodge: 'hunt' };

interface Ask {
  title: string; lines?: string[]; cost?: Partial<Stock>; costTitle?: string;
  /** Why it cannot be done now; the confirm button stays off. */
  why?: string | null; ok: string; danger?: boolean; onOk: () => void;
}

/** A small confirmation over the whole game: what it does, what it takes, and two buttons. */
export class Confirm {
  private readonly win: GameDialog;
  constructor(root: HTMLElement, private readonly c: Ctx) { this.win = new GameDialog(root); }

  close(): void { this.win.hide(); }

  ask(a: Ask): void {
    const { sim } = this.c;
    const rows = a.cost ? (Object.keys(a.cost) as Res[]).filter((r) => (a.cost![r] ?? 0) > 0) : [];
    const ok = dlg.button(a.ok, () => { this.close(); a.onOk(); }, { disabled: !!a.why, tone: a.danger ? 'bad' : undefined });
    this.win.show(dlg.card({ label: a.title },
      dlg.head({ title: a.title, onClose: () => this.close() }),
      ...(a.lines ?? []).map((t) => dlg.text(t)),
      rows.length ? dlg.note(a.costTitle ?? 'Cần', false) : null,
      rows.length ? dlg.costs(...rows.map((r) => { const need = a.cost![r] ?? 0, have = Math.floor(sim.stock[r]); return dlg.cost(resIcon(r), String(need), String(have), have < need, RES_NAME[r]); })) : null,
      a.why ? dlg.why(a.why) : null,
      dlg.buttons(dlg.button('Hủy', () => this.close(), { tone: 'alt' }), ok)));
    ok.focus();
  }
}

/** The card of the building that was tapped, floating beneath it on the map: what it is, what it brings in, and open, upgrade, move, demolish. */
export class BuildingBar {
  private readonly card: InfoCard;
  private id: number | null = null;
  private width = 0; private height = 0;

  constructor(private readonly root: HTMLElement, private readonly c: Ctx, private readonly r: Renderer, private readonly confirm: Confirm) {
    this.card = new InfoCard(root);
  }

  private cur(): Building | undefined { return this.id === null ? undefined : this.c.sim.getBuilding(this.id); }

  private askUpgrade(b: Building): void {
    const { sim, ctl, toast } = this.c, def = BUILDINGS[b.kind], nx = levelDef(b, b.level + 1);
    const gain = b.kind === 'campfire' ? `kho chứa ${nx.cap} mỗi loại, ${POP_BY_FIRE[b.level]} dân, các nhà khác lên được cấp ${levelCapByFire(b.level + 1)}` : b.kind === 'storage' ? `chứa ${nx.cap} mỗi loại` : b.kind === 'toolstore' || b.kind === 'armory' ? `chứa ${nx.cap} món` : b.kind === 'house' || b.kind === 'infantry' || b.kind === 'cavalry' || b.kind === 'archery' ? `${nx.slots} giường, hồi sức ×${nx.craftSpeed.toLocaleString('vi')}` : b.kind === 'field' ? `năng suất ×${nx.craftSpeed.toLocaleString('vi')}` : `chứa ${nx.slots} người, tốc độ ×${nx.craftSpeed.toLocaleString('vi')}`;
    this.confirm.ask({
      title: `Nâng ${def.name} lên cấp ${b.level + 1}?`,
      lines: [`${nx.name}: ${gain}. Vật liệu trả ngay, rồi giao Thợ xây để làm (~${workDays(nx.buildTime)}).${sim.dev.freeBuild ? ' Đang bật xây miễn phí.' : ''}`],
      cost: sim.dev.freeBuild ? {} : nx.cost, costTitle: 'Vật liệu cần', why: sim.canUpgrade(b), ok: 'Nâng cấp',
      onOk: () => { const e = sim.upgradeBuilding(b.id); toast(e ?? 'Đã trả vật liệu. Giao Thợ xây để nâng cấp'); ctl.onChange(); },
    });
  }

  private askDemolish(b: Building): void {
    const { sim, ctl, toast } = this.c, def = BUILDINGS[b.kind], back = sim.salvage(b), has = Object.keys(back).length > 0;
    this.confirm.ask({
      title: `Phá ${def.name}?`,
      lines: [has ? `Thu lại: ${costText(back, RES_NAME)}.` : 'Không thu lại được gì.', ...(b.staff.length || sim.sleepers(b).length ? ['Dân đang ở bên trong sẽ ra ngoài.'] : [])],
      ok: 'Phá bỏ', danger: true,
      onOk: () => { const e = sim.demolishBuilding(b.id); toast(e ?? 'Đã phá bỏ công trình'); if (!e) ctl.closeBuilding(); else ctl.onChange(); },
    });
  }

  /** What the house brought in today and yesterday, for the houses of the gatherers. */
  private yieldLine(b: Building): string | undefined {
    const key = YIELD_OF[b.kind]; if (!key || !b.done) return undefined;
    const { sim } = this.c, unit = key === 'hunt' ? 'sản vật' : key === 'wood' ? 'gỗ' : key === 'stone' ? 'đá' : 'thức ăn';
    return `Thu hôm nay: ${Math.floor(sim.yieldNow[key] ?? 0)} ${unit} · hôm qua: ${Math.floor(sim.yieldPrev[key] ?? 0)}`;
  }

  /** Refresh what the card says and which buttons show; called as often as the screen is drawn. */
  update(): void {
    const { sim, ctl, toast } = this.c, b = ctl.selectedBuilding === null ? undefined : sim.getBuilding(ctl.selectedBuilding);
    const show = !!b && !ctl.buildingOpen && !ctl.placing;
    this.root.hidden = !show;
    if (!b || !show) { this.id = null; return; }
    this.id = b.id;
    const def = BUILDINGS[b.kind], top = maxLevel(b.kind, b.era), lv = levelDef(b);
    const state = !b.done ? `đang xây ${Math.floor(b.progress * 100)}%` : b.upgrading ? `đang nâng cấp ${Math.floor(b.progress * 100)}%` : canGrow(b.kind) ? `cấp ${b.level}/${top} · ${lv.name.toLowerCase()}` : lv.name.toLowerCase();
    const hp = b.done && lv.hp ? ` · bền ${Math.max(0, Math.round(b.hp))}/${lv.hp}` : '';
    const upgradable = canGrow(b.kind) && b.done && !b.upgrading && b.level < top;
    this.card.set({
      picKey: `${b.kind}${b.level}${b.done}`,
      pic: () => { try { return iconCanvas(this.c.sprites.building(b.kind, b.era, Math.max(1, b.level), 4).frames[0]); } catch { return '🏠'; } },
      title: def.name, sub: state + hp, line: this.yieldLine(b),
      onClose: () => ctl.closeBuilding(),
      actions: [
        { id: 'open', label: OPEN_LABEL[b.kind], tone: 'primary', hidden: !b.done || b.kind === 'fence' || b.kind === 'gate', onClick: () => ctl.selectBuilding(b.id, true) },
        { id: 'gate', label: b.open ? 'Đóng cổng' : 'Mở cổng', tone: 'primary', hidden: !(b.kind === 'gate' && b.done), onClick: () => { const e = sim.toggleGate(b.id); if (e) toast(e); ctl.onChange(); } },
        { id: 'up', label: 'Nâng cấp', hidden: !upgradable, onClick: () => this.askUpgrade(b) },
        { id: 'move', label: 'Di dời', title: 'Di dời (miễn phí)', hidden: !def.buildable, onClick: () => ctl.startMoving(b.id) },
        { id: 'del', label: 'Phá bỏ', tone: 'danger', hidden: !def.buildable, onClick: () => this.askDemolish(b) },
      ],
    });
    this.width = this.root.offsetWidth; this.height = this.root.offsetHeight;
  }

  /** Keep the bar under its building as the map moves; called every frame. */
  place(): void {
    const b = this.cur();
    if (this.root.hidden || !b) return;
    const d = BUILDINGS[b.kind], p = this.r.worldToScreen((b.x + d.w / 2) * TILE, (b.y + d.h) * TILE);
    const w = this.width || this.root.offsetWidth, hh = this.height || this.root.offsetHeight;
    const gone = p.x < -40 || p.x > this.r.w + 40 || p.y < -hh - 120 || p.y > this.r.h + 40;
    this.root.style.visibility = gone ? 'hidden' : 'visible';
    const x = Math.max(4, Math.min(this.r.w - w - 4, p.x - w / 2)), y = Math.max((parseInt(document.documentElement.style.getPropertyValue('--top-h')) || 40) + 8, Math.min(this.r.h - hh - 4, p.y + 8));
    this.root.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
