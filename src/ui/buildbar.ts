import { CAMP_KINDS, CAMP_PCT, campPicks, TENT_PCT } from '../sim/upgradebonus';
import MARKET from '../data/market.json';
import { BUILDINGS, Building, footOf, BuildingKind, canGrow, gatherMult, levelCapByFire, levelDef, maxHp, topLevel, POP_BY_FIRE } from '../sim/buildings';
import { TILE, workDays } from '../sim/constants';
import { ROLES, roleOf } from '../sim/jobs';
import { RES_NAME, Res, Stock } from '../sim/resources';
import type { Renderer } from '../render/renderer';
import { costText, iconCanvas } from './dom';
import { dlg, GameDialog } from './gamedialog';
import { InfoCard } from './infocard';
import { resIcon } from './resicons';
import type { Ctx } from './panels';

/** What the button that opens a building's panel is called. */
/** The houses that keep a list of people of their own (the button "Nhân sự"). */
const STAFF_HOUSES: string[] = ['workshop', 'lab', 'stable'];

const OPEN_LABEL: Record<BuildingKind, string> = {
  campfire: 'Xem dân', builder: 'Thợ xây', storage: 'Kho', market: 'Giao thương', workshop: 'Chế tạo', smelter: 'Chế biến', carpentry: 'Chế biến', tannery: 'Chế biến', lab: 'Nghiên cứu', toolstore: 'Kho công cụ', armory: 'Kho vũ khí', infantry: 'Quản lý lính', cavalry: 'Quản lý lính', archery: 'Quản lý lính', guardpost: 'Quản lý lính gác', farmhouse: 'Giao việc', huntlodge: 'Giao việc', lumberyard: 'Giao việc', quarry: 'Giao việc', house: 'Người trong nhà', field: 'Người làm ruộng', fence: 'Hàng rào', gate: 'Cổng', tower: 'Cung thủ canh', wartent: 'Mở Lều họp chiến', scouttent: 'Xem trinh sát', drill: 'Xem bãi tập', trap: 'Hố chông', stable: 'Thuần thú', supplycamp: 'Quản lý hậu cần', fieldtent: 'Lều hành quân',
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

  /** What the next level of a building adds, one line each (only what changes): places, stores, speed, strength, sight, yield, and what the campfire opens. */
  private upgradeChanges(b: Building): string[] {
    const cur = levelDef(b, b.level), nx = levelDef(b, b.level + 1), kind = b.kind, out: string[] = [];
    const num = (n: number) => n.toLocaleString('vi', { maximumFractionDigits: 2 });
    const line = (label: string, from: number, to: number, pre = '', post = '') => { if (from !== to) out.push(`▲ ${label}: ${pre}${num(from)}${post} → ${pre}${num(to)}${post}`); };
    const bed = kind === 'house' || kind === 'infantry' || kind === 'cavalry' || kind === 'archery';
    if (kind === 'campfire') {
      line('Dân tối đa', POP_BY_FIRE[b.level - 1], POP_BY_FIRE[b.level]);
      line('Cấp tối đa của các nhà khác', levelCapByFire(b.level), levelCapByFire(b.level + 1));
    }
    if (kind === 'market') { const a = MARKET.levels[Math.min(MARKET.levels.length, b.level) - 1], z = MARKET.levels[Math.min(MARKET.levels.length, b.level + 1) - 1]; line('Tỉ lệ đổi', a.rate, z.rate, '×'); line('Phí đổi hàng', Math.round(a.fee * 100), Math.round(z.fee * 100), '', '%'); line('Hạn mức mỗi ngày (tối đa, vỏ)', a.quotaMax, z.quotaMax); }
    line(bed ? 'Giường' : 'Chỗ làm việc', cur.slots, nx.slots);
    line(kind === 'storage' ? 'Kho chứa mỗi loại' : kind === 'toolstore' || kind === 'armory' ? 'Chứa (món)' : 'Chứa', cur.cap, nx.cap);
    if (!bed) line(kind === 'field' ? 'Năng suất' : 'Tốc độ làm việc', cur.craftSpeed, nx.craftSpeed, '×');
    if (BUILDINGS[kind].produces) line('Sản lượng mỗi người', gatherMult({ level: b.level }), gatherMult({ level: b.level + 1 }), '×');
    const era = kind === 'campfire' && b.level + 1 > (BUILDINGS.campfire.levels.stone?.length ?? 0) ? 'ancient' : b.era; // the HP of the building itself (also for the houses whose level gives none of its own)
    line('Máu công trình (HP)', maxHp(b), maxHp({ kind, level: b.level + 1, era, hpBonus: b.hpBonus }));
    line('Tầm nhìn', cur.sight, nx.sight, '', ' ô');
    if (CAMP_KINDS.includes(kind)) { // the soldiers of the house: the stats this level raises (two different ones, fixed for this house and level)
      const names = { hp: 'Máu', atk: 'Sát thương', aspd: 'Tốc đánh' } as const;
      out.push(`▲ Lính của nhà này: ${campPicks(b.id, b.level + 1).map((st) => `${names[st]} +${CAMP_PCT}%`).join(', ')}`);
    }
    if (kind === 'wartent') out.push(`▲ Mọi lính của làng: Máu +${TENT_PCT.hp}%, Sát thương +${TENT_PCT.atk}%, Phòng thủ cận chiến +${TENT_PCT.defm}%, Phòng thủ tầm xa +${TENT_PCT.defr}%`);
    if (!out.length) out.push('Nâng cấp làm công trình bền và đẹp hơn.');
    return out;
  }

  private askUpgrade(b: Building): void {
    const { sim, ctl, toast } = this.c, def = BUILDINGS[b.kind], nx = levelDef(b, b.level + 1);
    const changes = this.upgradeChanges(b);
    this.confirm.ask({
      title: `Nâng ${def.name} lên cấp ${b.level + 1}?`,
      lines: [`${nx.name}. Vật liệu trả ngay, rồi giao Thợ xây để làm (~${workDays(nx.buildTime)}).${sim.freeCost() ? ' Đang bật xây miễn phí.' : ''}`,
        ...changes,
        ...(b.kind === 'campfire' ? sim.upgradeAdvice(b.level).map((a) => `${a.bad ? '⚠' : '✓'} ${a.text}`) : [])],
      cost: sim.freeCost() ? {} : sim.buildBill(nx.cost), costTitle: 'Vật liệu cần', why: sim.canUpgrade(b), ok: 'Nâng cấp',
      onOk: () => { const e = sim.upgradeBuilding(b.id); toast(e ?? 'Đã trả vật liệu. Giao Thợ xây để nâng cấp'); ctl.onChange(); },
    });
  }

  /** The pieces of the chosen group that can be raised a level now (built, idle, below the top and below what the campfire lets; the materials are asked for together). */
  private groupUpgradable(): Building[] {
    const { sim, ctl } = this.c, fire = sim.campfire();
    return ctl.groupIds.map((id) => sim.getBuilding(id)).filter((b): b is Building => !!b && canGrow(b.kind) && b.done && !b.upgrading && !b.repairing && b.level < topLevel(b) && (sim.dev.freeBuild || !fire || b.level + 1 <= levelCapByFire(fire.level)));
  }

  /** Upgrade the whole chosen group (a row of fence) at once: one question, one bill. */
  private askUpgradeGroup(): void {
    const { sim, ctl, toast } = this.c, list = this.groupUpgradable();
    if (!list.length) return;
    const total: Partial<Stock> = {};
    for (const b of list) for (const [r, n] of Object.entries(sim.buildBill(levelDef(b, b.level + 1).cost)) as Array<[Res, number]>) total[r] = (total[r] ?? 0) + n;
    this.confirm.ask({
      title: `Nâng cấp ${list.length} mảnh?`,
      lines: [`Mỗi mảnh lên một cấp. Vật liệu trả ngay cho cả nhóm, rồi giao Thợ xây để làm.${sim.freeCost() ? ' Đang bật xây miễn phí.' : ''}`],
      cost: sim.freeCost() ? {} : total, costTitle: 'Vật liệu cần', why: sim.freeCost() ? null : sim.missing(total), ok: 'Nâng cấp',
      onOk: () => { let done = 0, why: string | null = null; for (const b of list) { why = sim.upgradeBuilding(b.id); if (why) break; done++; } toast(why && !done ? why : `Đã nâng cấp ${done} mảnh. Giao Thợ xây để làm${why ? ` (còn ${list.length - done} mảnh chưa nâng được: ${why})` : ''}`); ctl.onChange(); },
    });
  }

  private askRepair(b: Building): void {
    const { sim, ctl, toast } = this.c, def = BUILDINGS[b.kind], lost = Math.round((1 - b.hp / maxHp(b)) * 100);
    this.confirm.ask({
      title: `Sửa ${def.name}?`,
      lines: [`Mất ${lost}% độ bền: tốn ${lost}% vật liệu đã xây. Vật liệu trả ngay, rồi giao Thợ xây để sửa.${sim.freeCost() ? ' Đang bật xây miễn phí.' : ''}`],
      cost: sim.freeCost() ? {} : sim.repairCost(b), costTitle: 'Vật liệu cần', why: sim.canRepair(b), ok: 'Sửa chữa',
      onOk: () => { const e = sim.repairBuilding(b.id); toast(e ?? 'Đã trả vật liệu. Giao Thợ xây để sửa'); ctl.onChange(); },
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

  /** What the house makes in a day from the people who work for it, for the houses of the gatherers. */
  private yieldLine(b: Building): string | undefined {
    const key = YIELD_OF[b.kind]; if (!key || !b.done) return undefined;
    const y = this.c.sim.dailyYield(b); if (!y) return undefined;
    const unit = key === 'hunt' ? 'thịt' : key === 'wood' ? 'gỗ' : key === 'stone' ? 'đá' : 'thức ăn';
    const base = y.people ? `Sản xuất ~${Math.round(y.amount)} ${unit}/ngày · ${y.people} người đang làm` : `Chưa có ai làm việc: chưa sản xuất ${unit}`;
    if (key !== 'hunt') return base;
    const { yieldNow, yieldPrev } = this.c.sim, spoils = (r: Record<string, number>) => [['hunt.food', 'thịt'], ['hunt.hide', RES_NAME.hide.toLowerCase()], ['hunt.feather', RES_NAME.feather.toLowerCase()]]
      .filter(([k]) => (r[k] ?? 0) > 0).map(([k, name]) => `${Math.round(r[k])} ${name}`).join(', ') || 'chưa có';
    return `${base} · Hôm nay: ${spoils(yieldNow)} · Hôm qua: ${spoils(yieldPrev)}`;
  }

  /** Refresh what the card says and which buttons show; called as often as the screen is drawn. */
  update(): void {
    const { sim, ctl, toast } = this.c, b = ctl.selectedBuilding === null ? undefined : sim.getBuilding(ctl.selectedBuilding);
    const show = !!b && !ctl.buildingOpen && !ctl.placing;
    this.root.hidden = !show;
    if (!b || !show) { this.id = null; return; }
    this.id = b.id;
    const fire = sim.campfire(), def = BUILDINGS[b.kind], lv = levelDef(b);
    const top = b.kind === 'campfire' || !fire || sim.dev.freeBuild ? topLevel(b) : Math.min(topLevel(b), levelCapByFire(fire.level)); // a house may not rise above what the campfire allows
    const st = sim.staffing(b), crowd = st ? ` 👥 ${st.have}/${st.slots}` : ''; // the people of the house, beside its name
    const state = !b.done ? `đang xây ${Math.floor(b.progress * 100)}%${this.c.sim.buildWhy(b) ? ` · ${this.c.sim.buildWhy(b)}` : ''}` : b.repairing ? `đang sửa chữa ${Math.round((b.hp / maxHp(b)) * 100)}%${this.c.sim.buildWhy(b) ? ` · ${this.c.sim.buildWhy(b)}` : ''}` : b.upgrading ? `đang nâng cấp ${Math.floor(b.progress * 100)}%${this.c.sim.buildWhy(b) ? ` · ${this.c.sim.buildWhy(b)}` : ''}` : canGrow(b.kind) ? `cấp ${b.level}/${top} · ${lv.name.toLowerCase()}` : lv.name.toLowerCase();
    const hp = b.done ? ` · bền ${Math.max(0, Math.round(b.hp))}/${maxHp(b)}${b.hp <= maxHp(b) * 0.3 ? ' · đang cháy' : b.hp <= maxHp(b) * 0.7 ? ' · bốc khói' : ''}` : '';
    const upgradable = canGrow(b.kind) && b.done && !b.upgrading && b.level < topLevel(b);
    // a camp of soldiers: one button calls all of its soldiers out of the camp, or sends them back when they are all out
    const campRole = (['foot', 'cavalry', 'archer', 'guard', 'scout', 'supply'] as const).find((r) => ROLES[r].building === b.kind), camp = campRole ? this.c.sim.villagers.filter((v) => roleOf(v) === campRole) : [];
    const campOut = { ids: camp.map((v) => v.id), all: camp.length > 0 && camp.every((v) => this.c.sim.isOut(v)) };
    this.card.set({
      picKey: `${b.kind}${b.level}${b.done}`,
      pic: () => { try { return iconCanvas(this.c.sprites.building(b.kind, b.era, Math.max(1, b.level), 4).frames[0]); } catch { return '🏠'; } },
      title: def.name + crowd, sub: state + hp, line: this.yieldLine(b),
      onClose: () => ctl.closeBuilding(),
      actions: [
        // choosing several pieces of fence to carry together: the card turns into the card of the group
        { id: 'run', icon: '⇄', label: 'Chọn cả dãy', title: 'Chọn mọi mảnh nối liền với các mảnh đang chọn', hidden: !ctl.groupMode, onClick: () => ctl.selectRun() },
        { id: 'gmove', icon: `✥ ${ctl.groupIds.length}`, label: `Di dời ${ctl.groupIds.length}`, title: 'Nhấc cả nhóm lên để đặt chỗ khác (miễn phí)', hidden: !ctl.groupMode, tone: 'primary', onClick: () => ctl.startGroupMove(0) },
        { id: 'gup', icon: `⬆︎ ${this.groupUpgradable().length}`, label: `Nâng cấp ${this.groupUpgradable().length}`, title: 'Nâng cấp mọi mảnh đã chọn lên cấp tiếp theo (trả vật liệu cho cả nhóm)', hidden: !ctl.groupMode || !this.groupUpgradable().length, onClick: () => this.askUpgradeGroup() },
        { id: 'grot', icon: '↻', label: 'Xoay', title: 'Xoay cả nhóm một phần tư vòng rồi đặt', hidden: !ctl.groupMode, onClick: () => ctl.startGroupMove(1) },
        { id: 'multi', icon: '▣', label: 'Chọn nhiều', title: 'Chọn nhiều mảnh hàng rào để dời hoặc xoay cùng lúc', hidden: ctl.groupMode || !b.done || !(b.kind === 'fence' || b.kind === 'gate'), onClick: () => ctl.startGroup(b.id) },
        { id: 'open', label: OPEN_LABEL[b.kind], tone: 'primary', hidden: ctl.groupMode || !b.done || b.kind === 'fence' || b.kind === 'gate', onClick: () => ctl.selectBuilding(b.id, true) },
        { id: 'gate', icon: '🚪', label: b.open ? 'Đóng cổng' : 'Mở cổng', tone: 'primary', hidden: ctl.groupMode || !(b.kind === 'gate' && b.done), onClick: () => { const e = sim.toggleGate(b.id); if (e) toast(e); ctl.onChange(); } },
        { id: 'staff', icon: '👥', label: `Nhân sự ${STAFF_HOUSES.includes(b.kind) ? `${sim.staffCount(b)}/${lv.slots}` : ''}`, title: 'Thêm hoặc cho nghỉ người làm việc trong nhà này', hidden: ctl.groupMode || !b.done || !STAFF_HOUSES.includes(b.kind), onClick: () => { ctl.openPeople = true; ctl.selectBuilding(b.id, true); } },
        { id: 'repair', icon: '🔧', label: 'Sửa chữa', title: 'Sửa lại độ bền đã mất: tốn vật liệu theo phần độ bền mất, thợ xây làm', hidden: ctl.groupMode || !b.done || b.repairing || b.upgrading || b.hp >= maxHp(b), onClick: () => this.askRepair(b) },
        { id: 'up', icon: '⬆︎', label: 'Nâng cấp', title: 'Nâng lên cấp tiếp theo', hidden: ctl.groupMode || !upgradable, onClick: () => this.askUpgrade(b) },
        { id: 'callall', icon: campOut.all ? '🏠' : '⚔', label: campOut.all ? 'Cho về hết' : 'Gọi tất cả', title: campOut.all ? 'Cho mọi lính của trại này về trại nghỉ' : 'Gọi mọi lính của trại này ra ngoài, sẵn sàng; bấm lại để cho về', hidden: ctl.groupMode || !b.done || !campOut.ids.length, onClick: () => { if (campOut.all) sim.sendBack(campOut.ids); else sim.callOut(campOut.ids); ctl.onChange(); } },
        { id: 'move', icon: '✥', label: 'Di dời', title: 'Di dời (miễn phí)', hidden: ctl.groupMode || !def.buildable, onClick: () => ctl.startMoving(b.id) },
        { id: 'del', icon: '🗑', label: 'Phá bỏ', tone: 'danger', hidden: ctl.groupMode || !def.buildable, onClick: () => this.askDemolish(b) },
      ],
    });
    this.width = this.root.offsetWidth; this.height = this.root.offsetHeight;
  }

  /** Keep the bar under its building as the map moves; called every frame. */
  place(): void {
    const b = this.cur();
    if (this.root.hidden || !b) return;
    const d = footOf(b), p = this.r.worldToScreen((b.x + d.w / 2) * TILE, (b.y + d.h) * TILE);
    const w = this.width || this.root.offsetWidth, hh = this.height || this.root.offsetHeight;
    const gone = p.x < -40 || p.x > this.r.w + 40 || p.y < -hh - 120 || p.y > this.r.h + 40;
    this.root.style.visibility = gone ? 'hidden' : 'visible';
    const tray = document.getElementById('tray'), floor = tray && !tray.hidden ? tray.offsetTop : this.r.h; // the bar stays above the build tray when it is open, never over it
    const x = Math.max(4, Math.min(this.r.w - w - 4, p.x - w / 2)), y = Math.max((parseInt(document.documentElement.style.getPropertyValue('--top-h')) || 40) + 8, Math.min(floor - hh - 4, p.y + 8));
    this.root.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
