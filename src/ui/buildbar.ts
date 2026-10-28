import { BUILDINGS, Building, BuildingKind, canGrow, levelCapByFire, levelDef, maxLevel, POP_BY_FIRE } from '../sim/buildings';
import { TILE, workDays } from '../sim/constants';
import { RES_NAME, Res, Stock } from '../sim/resources';
import type { Renderer } from '../render/renderer';
import { costText, h } from './dom';
import type { Ctx } from './panels';

/** What the button that opens a building's panel is called. */
const OPEN_LABEL: Record<BuildingKind, string> = {
  campfire: 'Xem dân', builder: 'Thợ xây', storage: 'Kho', workshop: 'Chế tạo', lab: 'Nghiên cứu', repair: 'Sửa đồ', toolstore: 'Kho công cụ', armory: 'Kho vũ khí', barracks: 'Người trong lều', house: 'Người trong nhà', field: 'Người làm ruộng',
};

interface Ask {
  title: string; lines?: string[]; cost?: Partial<Stock>; costTitle?: string;
  /** Why it cannot be done now; the confirm button stays off. */
  why?: string | null; ok: string; danger?: boolean; onOk: () => void;
}

/** A small confirmation over the whole game: what it does, what it takes, and two buttons. */
export class Confirm {
  constructor(private readonly root: HTMLElement, private readonly c: Ctx) {
    // Esc closes the dialog instead of also dropping the selection behind it
    window.addEventListener('keydown', (e) => { if (!root.hidden && e.key === 'Escape') { e.stopImmediatePropagation(); this.close(); } }, true);
    root.addEventListener('click', (e) => { if (e.target === root) this.close(); });
  }

  close(): void { this.root.hidden = true; this.root.replaceChildren(); }

  ask(a: Ask): void {
    const { sim } = this.c;
    const rows = a.cost ? (Object.keys(a.cost) as Res[]).filter((r) => (a.cost![r] ?? 0) > 0) : [];
    const ok = h('button', { class: `primary${a.danger ? ' danger' : ''}`, text: a.ok, disabled: !!a.why, onclick: () => { this.close(); a.onOk(); } });
    const card = h('div', { class: 'card', role: 'dialog', 'aria-modal': 'true', 'aria-label': a.title },
      h('h3', { text: a.title }),
      ...(a.lines ?? []).map((t) => h('p', { class: 'sub', text: t })),
      rows.length ? h('div', { class: 'costs' }, h('b', { text: a.costTitle ?? 'Cần' }), ...rows.map((r) => {
        const need = a.cost![r] ?? 0, have = Math.floor(sim.stock[r]), short = have < need;
        return h('div', { class: short ? 'short' : '' }, h('span', { text: RES_NAME[r] }), h('span', { text: `${need} (có ${have})` }));
      })) : null,
      a.why ? h('p', { class: 'why', text: a.why }) : null,
      h('div', { class: 'btns' }, h('button', { text: 'Hủy', onclick: () => this.close() }), ok));
    this.root.replaceChildren(card);
    this.root.hidden = false;
    ok.focus();
  }
}

/** The buttons of the building that was tapped, floating beneath it on the map: open it, upgrade, move, demolish. */
export class BuildingBar {
  private readonly who = h('div', { class: 'who' });
  private readonly open = h('button', { class: 'sm primary' }) as HTMLButtonElement;
  private readonly upgrade = h('button', { class: 'sm', text: 'Nâng cấp' }) as HTMLButtonElement;
  private readonly move = h('button', { class: 'sm', text: 'Dời' }) as HTMLButtonElement;
  private readonly demolish = h('button', { class: 'sm danger', text: 'Phá bỏ' }) as HTMLButtonElement;
  private id: number | null = null;
  private width = 0; private height = 0;

  constructor(private readonly root: HTMLElement, private readonly c: Ctx, private readonly r: Renderer, private readonly confirm: Confirm) {
    const { ctl } = c;
    root.append(this.who, h('div', { class: 'btns' }, this.open, this.upgrade, this.move, this.demolish));
    this.open.addEventListener('click', () => { if (this.id !== null) ctl.selectBuilding(this.id, true); });
    this.upgrade.addEventListener('click', () => { const b = this.cur(); if (b) this.askUpgrade(b); });
    this.move.addEventListener('click', () => { const b = this.cur(); if (b) ctl.startMoving(b.id); });
    this.demolish.addEventListener('click', () => { const b = this.cur(); if (b) this.askDemolish(b); });
  }

  private cur(): Building | undefined { return this.id === null ? undefined : this.c.sim.getBuilding(this.id); }

  private askUpgrade(b: Building): void {
    const { sim, ctl, toast } = this.c, def = BUILDINGS[b.kind], nx = levelDef(b, b.level + 1);
    const gain = b.kind === 'campfire' ? `kho chứa ${nx.cap} mỗi loại, ${POP_BY_FIRE[b.level]} dân, các nhà khác lên được cấp ${levelCapByFire(b.level + 1)}` : b.kind === 'storage' ? `chứa ${nx.cap} mỗi loại` : b.kind === 'toolstore' || b.kind === 'armory' ? `chứa ${nx.cap} món` : b.kind === 'house' || b.kind === 'barracks' ? `${nx.slots} giường, hồi sức ×${nx.craftSpeed.toLocaleString('vi')}` : b.kind === 'field' ? `năng suất ×${nx.craftSpeed.toLocaleString('vi')}` : `chứa ${nx.slots} người, tốc độ ×${nx.craftSpeed.toLocaleString('vi')}`;
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

  /** Refresh what the buttons say and which ones show. */
  update(): void {
    const { sim, ctl } = this.c, b = ctl.selectedBuilding === null ? undefined : sim.getBuilding(ctl.selectedBuilding);
    const show = !!b && !ctl.buildingOpen && !ctl.placing;
    this.root.hidden = !show;
    if (!b || !show) { this.id = null; return; }
    this.id = b.id;
    const def = BUILDINGS[b.kind], top = maxLevel(b.kind, b.era), lv = levelDef(b);
    const state = !b.done ? `đang xây ${Math.floor(b.progress * 100)}%` : b.upgrading ? `đang nâng cấp ${Math.floor(b.progress * 100)}%` : canGrow(b.kind) ? `cấp ${b.level}/${top} · ${lv.name.toLowerCase()}` : lv.name.toLowerCase();
    this.who.replaceChildren(h('b', { text: def.name }), ` · ${state}`);
    this.open.textContent = OPEN_LABEL[b.kind]; this.open.hidden = !b.done;
    this.upgrade.hidden = !(canGrow(b.kind) && b.done && !b.upgrading && b.level < top);
    this.move.hidden = this.demolish.hidden = !def.buildable;
    const fee = sim.moveFee(b);
    this.move.textContent = Object.keys(fee).length ? `Dời (${costText(fee, RES_NAME)})` : 'Dời';
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
