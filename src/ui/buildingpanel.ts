import { BUILDINGS, Building, levelCapByFire, levelDef, maxLevel } from '../sim/buildings';
import { WEAPONS } from '../sim/combat';
import { workDays } from '../sim/constants';
import { BARTER, RES_LIST, RES_NAME } from '../sim/resources';
import type { Villager } from '../sim/sim';
import type { BuildingKind } from '../sim/buildings';
import { autoOn, TECHS, unlockText } from '../sim/research';
import { RECIPE_BY_ID, RECIPES, TIER_DURABILITY, TIER_NAME, TOOL_KINDS, TOOL_NAME, ToolKind, recipeName, recipeUse } from '../sim/tools';
import { costText, h, hint, iconCanvas } from './dom';
import type { Ctx } from './ctx';
import { PeoplePane } from './peoplepane';
import { describe } from './describe';
import { ActiveBox, StaffBox } from './housebox';

export class BuildingPanel {
  private readonly title = h('b'); private readonly state = h('span');
  /** Every building shows its parts as pages behind a row of tab buttons at the top. */
  private readonly tabs = {} as Record<BuildingKind, Array<{ label: string; page: HTMLElement }>>;
  private readonly tabBar = h('div', { class: 'btns tabs', role: 'tablist' });
  private readonly tabAt: Partial<Record<BuildingKind, number>> = {};
  private readonly pages: HTMLElement[] = []; private tabKey = '';
  private readonly resRows: Array<{ res: typeof RES_LIST[number]; num: HTMLElement; bar: HTMLElement }> = [];
  private readonly barterBtns: Array<{ res: Exclude<typeof RES_LIST[number], 'coin'>; btn: HTMLButtonElement }> = [];
  private readonly recRows: Array<{ id: string; kind: string; tier: number; have: HTMLElement; row: HTMLElement; lock: HTMLElement; btns: HTMLButtonElement[] }> = [];
  private readonly techRows: Array<{ id: string; row: HTMLElement; btn: HTMLButtonElement; note: HTMLElement }> = [];
  private readonly goodRows: Array<{ id: string; num: HTMLElement; row: HTMLElement }> = [];
  private readonly people: PeoplePane;
  private readonly info = h('div', { class: 'kv' });
  private readonly staffBoxes: Record<'build' | 'craft' | 'research' | 'repair', StaffBox>;
  private readonly activeBoxes: Record<'craft' | 'research' | 'repair', ActiveBox>;
  private readonly queueNote = { craft: h('div', { class: 'kv' }), research: h('div', { class: 'kv' }), repair: h('div', { class: 'kv' }) };
  private readonly goodsNote = h('p', { class: 'sub' }); private readonly goodsHint = hint(this.goodsNote, '');
  private readonly toolList = h('div'); private toolKey = '';
  private readonly repairInfo = h('div', { class: 'kv' });

  constructor(readonly root: HTMLElement, private readonly c: Ctx) {
    const { sim, ctl, sprites } = c;
    root.className = 'modal';
    const recipeNm = (id: string) => (RECIPE_BY_ID[id] ? recipeName(RECIPE_BY_ID[id]) : id);
    this.staffBoxes = { build: new StaffBox(c, 'build'), craft: new StaffBox(c, 'craft'), research: new StaffBox(c, 'research'), repair: new StaffBox(c, 'repair') };
    this.activeBoxes = {
      craft: new ActiveBox(c, recipeNm, (id) => sim.orderDef('craft', id)?.time ?? 1),
      research: new ActiveBox(c, (id) => TECHS.find((t) => t.id === id)?.name ?? id, (id) => sim.orderDef('research', id)?.time ?? 1),
      repair: new ActiveBox(c, (id) => `sửa ${recipeNm(id).toLowerCase()}`, (id) => sim.orderDef('repair', id)?.time ?? 1),
    };

    const page = (...kids: Array<HTMLElement | null>) => { const el = h('div', { class: 'tabpage', hidden: true }, ...kids); this.pages.push(el); return el; };

    // campfire: the village's people, and trading
    const barter = () => {
      const box = h('div', {}, hint('Đổi chác', 'Đổi hàng lấy tiền để trả cho nghiên cứu. Tiền cũng nhặt được khi hái lượm và nhận từ bộ tộc cống nạp.'));
      const btns = h('div', { class: 'btns' }); box.append(btns);
      for (const res of RES_LIST) {
        if (res === 'coin') continue;
        const btn = h('button', { class: 'sm', onclick: () => { const e = sim.barter(res); if (e) c.toast(e); ctl.onChange(); } }) as HTMLButtonElement;
        this.barterBtns.push({ res, btn }); btns.append(btn);
      }
      return box;
    };
    this.people = new PeoplePane(c);
    this.tabs.builder = [{ label: 'Thợ xây', page: page(this.staffBoxes.build.root) }];
    this.tabs.campfire = [
      { label: 'Dân', page: page(this.people.root, h('div', { class: 'btns' }, h('button', { class: 'sm', text: 'Chọn tất cả dân', onclick: () => { ctl.selected.clear(); ctl.selectAll(); ctl.closeBuilding(); } }))) },
      { label: 'Đổi chác', page: page(barter()) },
    ];

    // storage: stock against capacity, and trading goods for money
    const stockRows: HTMLElement[] = [];
    for (const res of RES_LIST) {
      const num = h('b'), bar = h('b');
      this.resRows.push({ res, num, bar });
      stockRows.push(h('div', { class: 'row' }, h('div', { class: 'nm' }, RES_NAME[res], h('small', {}, num)), h('div', { class: 'bars', style: 'width:90px;display:block' }, h('i', {}, bar))));
    }
    this.tabs.storage = [{ label: 'Tài nguyên', page: page(...stockRows) }, { label: 'Đổi chác', page: page(barter()) }];

    // craft house: what is being made, then one tab for each kind of blueprint
    const section = (el: HTMLElement, list: typeof RECIPES) => {
      for (const r of list) {
        const have = h('span', { class: 'have' }), lock = h('small', { class: 'lock' });
        const minus = h('button', { class: 'sm', text: '−', title: 'Bớt một đơn', onclick: () => { sim.unqueueCraft(r.id); ctl.onChange(); } }) as HTMLButtonElement;
        const plus = h('button', { class: 'sm', text: '+', title: 'Thêm một đơn vào hàng đợi', onclick: () => { const e = sim.queueCraft(r.id); if (e) c.toast(e); ctl.onChange(); } }) as HTMLButtonElement;
        const row = h('div', { class: 'rec' }, iconCanvas(sprites.icons[r.id]),
          h('div', { class: 'nm' }, recipeName(r), h('small', {}, `${costText(r.cost, RES_NAME)} · ${workDays(r.time)} · ${recipeUse(r)}`), lock),
          h('div', { class: 'qty' }, have, minus, plus));
        this.recRows.push({ id: r.id, kind: r.kind, tier: r.tier, have, row, lock, btns: [minus, plus] });
        el.append(row);
      }
      return el;
    };
    const shop = (list: typeof RECIPES) => section(page(hint('Chế tạo theo bản vẽ', 'Chỉ chế được món đã có bản vẽ ở Nhà nghiên cứu và đủ cấp Nhà chế tạo. Sản phẩm vào Kho công cụ hoặc Kho vũ khí.')), list);
    this.tabs.workshop = [
      { label: 'Đang làm', page: page(this.staffBoxes.craft.root, h('h3', { text: 'Đang chế tạo' }), this.activeBoxes.craft.root, this.queueNote.craft) },
      { label: 'Công cụ', page: shop(RECIPES.filter((r) => ['axe', 'pick', 'hoe', 'hammer'].includes(r.kind))) },
      { label: 'Vũ khí', page: shop(RECIPES.filter((r) => r.kind in WEAPONS)) },
      { label: 'Áo giáp', page: shop(RECIPES.filter((r) => r.kind === 'hide')) },
    ];

    // research house: who works, then the blueprints and the other steps
    const groups: Array<[string, (id: string) => boolean]> = [
      ['Bản vẽ công cụ', (id) => /^(axe|pick|hoe|hammer)\d$/.test(id)],
      ['Bản vẽ vũ khí, giáp', (id) => /^(club|spear|mace|hide)\d$/.test(id)],
      ['Xây dựng', (id) => ['timber', 'masonry', 'tool_store', 'armory'].includes(id)],
      ['Tự động hóa', (id) => id.startsWith('auto_')],
    ];
    this.tabs.lab = [{ label: 'Đang làm', page: page(this.staffBoxes.research.root, hint('Đang nghiên cứu', 'Mỗi lần chỉ nghiên cứu một thứ. Mỗi công cụ, vũ khí, giáp chỉ có MỘT bản vẽ, nâng dần theo cấp. Bấm nghiên cứu là trả ngay vật liệu và tiền (hủy đơn thì được trả lại). Cần rất nhiều thời gian và người thông minh trong nhà: càng nhiều và càng thông minh càng nhanh.'), this.activeBoxes.research.root, this.queueNote.research) }];
    for (const [title, test] of groups) {
      const el = page();
      for (const t of TECHS.filter((x) => test(x.id))) {
        const note = h('small', { class: 'lock' }), btn = h('button', { class: 'sm' }) as HTMLButtonElement;
        btn.addEventListener('click', () => {
          const st = sim.techState(t).state;
          if (st === 'queued') sim.unqueueResearch(t.id);
          else { const e = sim.queueResearch(t.id); if (e) c.toast(e); }
          ctl.onChange();
        });
        const row = h('div', { class: 'tech' }, h('div', { class: 'nm' }, t.name, h('small', {}, `${t.desc} Mở: ${unlockText(t, recipeNm)}.`), h('small', {}, `${costText(t.cost, RES_NAME)} · ${workDays(t.time)} · Trí tuệ ≥ ${t.minInt}${t.needLevel > 1 ? ` · nhà cấp ${t.needLevel}` : ''}`), note), btn);
        this.techRows.push({ id: t.id, row, btn, note });
        el.append(row);
      }
      this.tabs.lab.push({ label: title, page: el });
    }

    // repair house
    this.tabs.repair = [
      { label: 'Đang làm', page: page(this.staffBoxes.repair.root, h('h3', { text: 'Đang sửa' }), this.activeBoxes.repair.root, this.queueNote.repair, this.repairInfo) },
      { label: 'Công cụ của dân', page: page(hint('Công cụ của dân', '"Đi sửa": dân mang công cụ đã mòn tới Nhà sửa chữa, tốn nửa nguyên liệu và mất 1,5 lần thời gian chế (công cụ đá lâu hơn công cụ gỗ). Sửa xong công cụ được trả lại cho đúng người đó; trong lúc chờ họ làm việc tay không. Cũng có thể vứt bỏ, kể cả khi chưa hỏng.'), this.toolList) },
    ];

    // tool store and armoury: what is kept
    const goods = page(this.goodsHint);
    const goodsRows = (cat: 'tool' | 'gear') => RECIPES.filter((r) => (cat === 'gear') === isGearKind(r.kind));
    for (const r of [...goodsRows('tool'), ...goodsRows('gear')]) {
      const num = h('b'), row = h('div', { class: 'rec' }, iconCanvas(sprites.icons[r.id]), h('div', { class: 'nm' }, recipeName(r), h('small', { text: recipeUse(r) })), h('div', { class: 'qty' }, num));
      this.goodRows.push({ id: r.id, num, row }); goods.append(row);
    }
    this.tabs.toolstore = this.tabs.armory = [{ label: 'Kho', page: goods }];

    root.append(
      h('div', { class: 'cardhead' }, this.title, this.state, h('button', { class: 'x', text: '✕ Đóng', onclick: () => ctl.closePanel() })),
      h('div', { class: 'mbody' }, this.info, this.tabBar, ...this.pages),
    );
  }

  /** Show the tab buttons of the building and the page of the chosen one. */
  private showTabs(kind: BuildingKind, ready: boolean): void {
    const tabs = ready ? this.tabs[kind] ?? [] : [];
    const key = `${kind}:${tabs.length}`;
    if (key !== this.tabKey) {
      this.tabKey = key;
      this.tabBar.replaceChildren(...tabs.map((t, i) => h('button', { class: 'sm', text: t.label, role: 'tab', onclick: () => { this.tabAt[kind] = i; this.showTabs(kind, true); } })));
    }
    const at = Math.min(this.tabAt[kind] ?? 0, Math.max(0, tabs.length - 1));
    this.tabBar.hidden = tabs.length < 2;
    [...this.tabBar.children].forEach((el, i) => el.setAttribute('aria-pressed', String(i === at)));
    for (const p of this.pages) p.hidden = tabs[at]?.page !== p;
  }

  private current(): Building | undefined { const id = this.c.ctl.selectedBuilding; return id === null ? undefined : this.c.sim.getBuilding(id); }

  private infoText(b: Building): string {
    const lv = levelDef(b);
    switch (b.kind) {
      case 'builder': return `Cấp ${b.level}: chứa ${lv.slots} thợ xây · xây nhanh ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'workshop': return `Cấp ${b.level}: chứa ${lv.slots} người chế tạo · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'lab': return `Cấp ${b.level}: chứa ${lv.slots} nhà nghiên cứu · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'repair': return `Cấp ${b.level}: chứa ${lv.slots} thợ sửa · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'storage': return `Sức chứa ${lv.cap} mỗi loại`;
      case 'toolstore': case 'armory': return `Chứa tối đa ${lv.cap} món`;
      default: return `Nơi dân ngủ quanh lửa · chứa ${lv.cap} mỗi loại · tối đa ${this.c.sim.popCap()} dân · các nhà khác lên được cấp ${levelCapByFire(b.level)}`;
    }
  }

  update(): void {
    const { sim, ctl } = this.c, b = this.current();
    this.root.hidden = !b || !ctl.buildingOpen;
    if (!b) { if (ctl.selectedBuilding !== null) ctl.selectedBuilding = null; return; }
    if (!ctl.buildingOpen) return;
    const def = BUILDINGS[b.kind], lv = levelDef(b), top = maxLevel(b.kind, b.era), ready = b.done;
    this.title.textContent = `${def.name}${def.buildable ? ` · cấp ${b.level}/${top} (${lv.name.toLowerCase()})` : ''}`;
    this.state.textContent = !b.done ? `đang xây ${Math.floor(b.progress * 100)}%` : b.upgrading ? `đang nâng cấp ${Math.floor(b.progress * 100)}%` : 'đang dùng';
    this.showTabs(b.kind, ready);
    this.info.textContent = !b.done ? 'Giao dân làm Thợ xây để dựng công trình này.' : this.infoText(b);
    if (b.kind === 'campfire' && ready) this.updateCampfire();
    if (b.kind === 'storage' && ready) for (const r of this.resRows) { r.num.textContent = `${Math.floor(sim.stock[r.res])} / ${sim.capacity()}`; r.bar.style.width = `${Math.min(100, (sim.stock[r.res] / Math.max(1, sim.capacity())) * 100)}%`; }
    if ((b.kind === 'storage' || b.kind === 'campfire') && ready) for (const t of this.barterBtns) { t.btn.textContent = `Đổi ${BARTER[t.res]} ${RES_NAME[t.res].toLowerCase()} → 1 ${RES_NAME.coin.toLowerCase()}`; t.btn.disabled = sim.stock[t.res] < BARTER[t.res]; }
    if (b.kind === 'workshop' && ready) this.updateWorkshop(b);
    if (b.kind === 'lab' && ready) this.updateLab(b);
    if (b.kind === 'repair' && ready) this.updateRepair(b);
    if (b.kind === 'toolstore' || b.kind === 'armory') if (ready) this.updateGoods(b);
  }

  private updateWorkshop(b: Building): void {
    const { sim } = this.c;
    this.staffBoxes.craft.update(b); this.activeBoxes.craft.update(b);
    this.queueNote.craft.textContent = `Hàng đợi ${sim.craftQueue.length}: ${sim.craftQueue.map((id) => recipeName(RECIPE_BY_ID[id]).toLowerCase()).join(', ') || 'trống'} · Kho công cụ ${sim.storeUsed('tool')}/${sim.storeCap('tool')} · Kho vũ khí ${sim.storeUsed('gear')}/${sim.storeCap('gear')}`;
    for (const r of this.recRows) {
      const lock = sim.recipeLock(r.id);
      r.have.textContent = lock ? '' : `kho ${sim.toolCount(r.kind, r.tier)} · đợi ${sim.craftQueue.filter((id) => id === r.id).length}`;
      r.row.classList.toggle('locked', !!lock); r.lock.textContent = lock ?? '';
      for (const btn of r.btns) btn.disabled = !!lock;
    }
  }

  private updateLab(b: Building): void {
    const { sim } = this.c;
    this.staffBoxes.research.update(b); this.activeBoxes.research.update(b);
    const waiting = sim.researchQueue[0];
    this.queueNote.research.textContent = `${waiting ? `Chờ bắt đầu: ${TECHS.find((t) => t.id === waiting)?.name ?? waiting}` : 'Mỗi lần chỉ nghiên cứu một thứ'} · Người giỏi nhất trong nhà: Trí tuệ ${sim.bestIntInside(b)}`;
    for (const r of this.techRows) {
      const t = TECHS.find((x) => x.id === r.id)!, st = sim.techState(t), block = st.state === 'queued' ? sim.researchBlock(t) : null;
      r.row.classList.toggle('locked', st.state === 'locked'); r.row.classList.toggle('done', st.state === 'done');
      const busy = st.state === 'ready' && sim.currentResearch() !== null, short = st.state === 'ready' && !busy ? sim.researchShort(t) : null;
      r.note.textContent = busy ? 'Đợi nghiên cứu hiện tại xong' : short ? short : st.state === 'locked' ? (st.why ?? '') : st.state === 'active' ? 'Đang nghiên cứu…' : st.state === 'queued' ? (block ?? 'Đã trả vật liệu, chờ bắt đầu') : st.state === 'done' ? 'Đã nghiên cứu' : '';
      r.btn.textContent = { done: '✓ Xong', active: 'Đang làm', queued: 'Hủy đơn', ready: 'Nghiên cứu', locked: 'Khóa' }[st.state];
      r.btn.disabled = st.state === 'done' || st.state === 'active' || st.state === 'locked' || busy || !!short;
    }
  }

  private updateRepair(b: Building): void {
    const { sim, ctl } = this.c;
    this.staffBoxes.repair.update(b); this.activeBoxes.repair.update(b);
    this.queueNote.repair.textContent = `Hàng đợi sửa ${sim.repairQueue.length}: ${sim.repairQueue.map((id) => recipeName(RECIPE_BY_ID[id]).toLowerCase()).join(', ') || 'trống'}`;
    this.repairInfo.textContent = '';
    const rows: Array<{ v: Villager; k: ToolKind; t: NonNullable<Villager['tools'][ToolKind]> }> = [];
    for (const v of sim.villagers) for (const k of TOOL_KINDS) { const t = v.tools[k]; if (t) rows.push({ v, k, t }); }
    const key = rows.map((r) => `${r.v.id}${r.k}${r.t.tier}${Math.ceil((r.t.dur / TIER_DURABILITY[r.t.tier]) * 10)}`).join();
    if (key === this.toolKey) return;
    this.toolKey = key;
    this.toolList.replaceChildren(...(rows.length ? rows.map(({ v, k, t }) => {
      const pct = Math.round((t.dur / TIER_DURABILITY[t.tier]) * 100), whole = pct >= 100;
      return h('div', { class: 'row' },
        h('div', { class: 'nm' }, `${v.name}: ${TOOL_NAME[k]} ${TIER_NAME[t.tier].toLowerCase()}`, h('small', { text: t.dur <= 0 ? 'đã hỏng' : `còn ${pct}% độ bền` })),
        h('div', { class: 'btns' },
          h('button', { class: 'sm', text: 'Đi sửa', disabled: whole || v.phase === 'goOrder', onclick: () => { const e = sim.repairTool([v.id], k); if (e) this.c.toast(e); ctl.onChange(); } }),
          h('button', { class: 'sm', text: 'Bỏ', onclick: () => { sim.discardTool([v.id], k); ctl.onChange(); } })));
    }) : [h('p', { class: 'sub', text: 'Chưa có dân nào cầm công cụ.' })]));
  }

  private updateGoods(b: Building): void {
    const { sim } = this.c, cat = b.kind === 'toolstore' ? 'tool' : 'gear';
    this.goodsNote.textContent = `Đang chứa ${sim.storeUsed(cat)}/${sim.storeCap(cat)} món`;
    this.goodsHint.tip.textContent = autoOn(sim.researched, 'fetch') ? 'Dân thiếu đồ hoặc đồ hỏng sẽ tự tới lấy.' : 'Chưa nghiên cứu "Tự lấy đồ trong kho": hãy phát đồ bằng tay ở thẻ dân.';
    for (const r of this.goodRows) {
      const rc = RECIPE_BY_ID[r.id], mine = (cat === 'gear') === isGearKind(rc.kind), n = sim.toolCount(rc.kind, rc.tier);
      r.row.hidden = !mine || (n === 0 && !!sim.recipeLock(r.id)); r.num.textContent = `× ${n}`;
    }
  }

  private updateCampfire(): void { this.people.update(); }
}

const isGearKind = (k: string) => k in WEAPONS || k === 'hide';

