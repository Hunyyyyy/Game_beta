import { BUILDINGS, Building, buildingName, levelCapByFire, levelDef, maxLevel } from '../sim/buildings';
import { WEAPONS } from '../sim/combat';
import { ROLES } from '../sim/jobs';
import type { RoleId } from '../sim/jobs';
import { workDays } from '../sim/constants';
import REST from '../data/rest.json';
import { BARTER, RES_LIST, RES_NAME } from '../sim/resources';
import type { Villager } from '../sim/sim';
import type { BuildingKind } from '../sim/buildings';
import { autoOn, TECHS, unlockText } from '../sim/research';
import { RECIPE_BY_ID, RECIPES, TIER_DURABILITY, TIER_NAME, TOOL_KINDS, TOOL_NAME, ToolKind, recipeName, recipeUse } from '../sim/tools';
import { costText, h, hint, iconCanvas } from './dom';
import type { Ctx } from './ctx';
import { PeoplePane } from './peoplepane';
import { ActiveBox, StaffBox } from './housebox';
import { ScoutPane } from './scoutpane';
import { RolePane } from './rolepane';
import { TrainPane } from './trainpane';
import { MOUNT_KINDS, MOUNTS, MountKind, TRAINING } from '../sim/jobs';
import { sleeperRows } from './soldierpane';
import { WarPanel } from './warpanel';

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
  /** The people of each role house, kept in the house that gives the role. */
  private readonly rolePanes = {} as Partial<Record<BuildingKind, RolePane>>;
  private readonly trainPanes = {} as Partial<Record<BuildingKind, TrainPane>>;
  /** The war council held in the Lều họp chiến. */
  private readonly war: WarPanel;
  /** Where scouts are picked and sent, in the Trại trinh sát. */
  private readonly scoutPane: ScoutPane;
  /** The speed to go back to when the tent is left (it opens the game paused, as a war council does). */
  private resume = 0; private inTent = false;
  /** The people lying in the Nhà dân and the camps of the soldiers. */
  private readonly bedHead = { house: h('h3'), infantry: h('h3'), cavalry: h('h3'), archery: h('h3') }; private readonly bedList = { house: h('div'), infantry: h('div'), cavalry: h('div'), archery: h('div') };
  private readonly bedKey = { house: '', infantry: '', cavalry: '', archery: '' };
  /** The archers posted on a tower. */
  private readonly towerHead = h('h3'); private readonly towerList = h('div'); private towerKey = '';
  private readonly info = h('div', { class: 'kv' });
  private readonly staffBoxes: Record<'build' | 'craft' | 'research' | 'repair' | 'tame' | 'farm', StaffBox>;
  private readonly activeBoxes: Record<'craft' | 'research' | 'repair' | 'tame', ActiveBox>;
  private readonly mountRows: Array<{ k: MountKind; have: HTMLElement; row: HTMLElement; lock: HTMLElement; btns: HTMLButtonElement[] }> = [];
  private readonly mountNote = h('div', { class: 'kv' });
  private readonly queueNote = { craft: h('div', { class: 'kv' }), research: h('div', { class: 'kv' }), repair: h('div', { class: 'kv' }) };
  private readonly goodsNote = h('p', { class: 'sub' }); private readonly goodsHint = hint(this.goodsNote, '');
  private readonly toolList = h('div'); private toolKey = '';
  private readonly repairInfo = h('div', { class: 'kv' });

  constructor(readonly root: HTMLElement, private readonly c: Ctx) {
    const { sim, ctl, sprites } = c;
    root.className = 'modal';
    const recipeNm = (id: string) => (RECIPE_BY_ID[id] ? recipeName(RECIPE_BY_ID[id]) : id);
    this.staffBoxes = { build: new StaffBox(c, 'build'), craft: new StaffBox(c, 'craft'), research: new StaffBox(c, 'research'), repair: new StaffBox(c, 'repair'), tame: new StaffBox(c, 'tame'), farm: new StaffBox(c, 'farm') };
    this.activeBoxes = {
      craft: new ActiveBox(c, recipeNm, (id) => sim.orderDef('craft', id)?.time ?? 1),
      research: new ActiveBox(c, (id) => TECHS.find((t) => t.id === id)?.name ?? id, (id) => sim.orderDef('research', id)?.time ?? 1),
      repair: new ActiveBox(c, (id) => `sửa ${recipeNm(id).toLowerCase()}`, (id) => sim.orderDef('repair', id)?.time ?? 1),
      tame: new ActiveBox(c, (id) => `thuần ${MOUNTS[id as MountKind]?.name.toLowerCase() ?? id}`, (id) => MOUNTS[id as MountKind]?.time ?? 1),
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
    // the role houses: one pane each, where the role is given and taken back
    const roleHouse = (role: RoleId, label: string, beds = false) => {
      const kind = ROLES[role].building, pane = new RolePane(c, role);
      this.rolePanes[kind] = pane;
      this.tabs[kind] = [{ label, page: page(pane.root) }];
      if (beds) this.tabs[kind].push({ label: 'Người trong trại', page: page(hint(this.bedHead[kind as 'infantry'], 'Lính vào trại ngủ khi trời tối hoặc kiệt sức: họ biến mất khỏi bản đồ, hiện ở danh sách này, không có hình ngủ. Hồi sức đầy đủ, cấp cao hơn hồi nhanh hơn. Hết giường thì lính ngủ bên đống lửa, hồi chậm hơn.'), this.bedList[kind as 'infantry']) });
    };
    roleHouse('foot', 'Lính', true); roleHouse('cavalry', 'Lính', true); roleHouse('archer', 'Lính', true);
    roleHouse('wood', 'Nhân công'); roleHouse('stone', 'Nhân công'); roleHouse('food', 'Nhân công'); roleHouse('hunt', 'Nhân công');
    this.tabs.house = [{ label: 'Người trong nhà', page: page(hint(this.bedHead.house, 'Dân thường vào nhà ngủ khi trời tối hoặc kiệt sức: họ biến mất khỏi bản đồ, hiện ở danh sách này, không có hình ngủ. Hồi sức đầy đủ, cấp cao hơn hồi nhanh hơn. Hết giường thì dân ngủ bên đống lửa, hồi chậm hơn.'), this.bedList.house) }];
    this.tabs.field = [{ label: 'Người làm ruộng', page: page(this.staffBoxes.farm.root) }];
    this.war = new WarPanel(c);
    this.tabs.wartent = [{ label: 'Họp chiến', page: page(this.war.root) }];
    this.scoutPane = new ScoutPane(c);
    this.tabs.scouttent = [{ label: 'Trinh sát', page: page(this.scoutPane.root) }];
    this.tabs.tower = [{ label: 'Cung thủ canh', page: page(hint(this.towerHead, 'Cung thủ đứng trên chòi bắn xa hơn 2 ô và mạnh hơn một phần tư, và kẻ địch phải phá chòi mới hạ được họ. Chỉ chiến binh cầm cung hoặc dây quăng đá mới lên được. Chế cung và dây quăng ở Nhà chế tạo.'), this.towerList) }];
    this.tabs.fence = []; this.tabs.gate = [];
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
      { label: 'Công cụ', page: shop(RECIPES.filter((r) => ['axe', 'pick', 'hoe', 'hammer', 'torch'].includes(r.kind))) },
      { label: 'Vũ khí', page: shop(RECIPES.filter((r) => r.kind in WEAPONS)) },
      { label: 'Áo giáp', page: shop(RECIPES.filter((r) => r.kind === 'hide')) },
    ];

    // research house: who works, then the blueprints and the other steps
    const groups: Array<[string, (id: string) => boolean]> = [
      ['Bản vẽ công cụ', (id) => /^(axe|pick|hoe|hammer|torch)\d$/.test(id)],
      ['Bản vẽ vũ khí, giáp', (id) => /^(club|spear|mace|sling|bow|hide)\d$/.test(id)],
      ['Xây dựng', (id) => ['timber', 'masonry', 'tool_store', 'armory', 'house', 'barracks', 'camp_archery', 'camp_cavalry', 'farming', 'fence', 'gate', 'tower', 'pit'].includes(id)],
      ['Quân sự', (id) => ['scout', 'scout2', 'scout3', 'council', 'drill', 'signal'].includes(id) || id.startsWith('form_')],
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

    // the stable: keepers inside, and the beasts that can be tamed (each needs its research and a high enough stable)
    const beasts = page(hint('Thuần thú', 'Dân làm việc trong chuồng thuần hóa từng con thú theo đơn: tốn lương thực, da và tiền, mất nhiều thời gian (càng đông và càng nhanh nhẹn càng nhanh). Con xong vào chuồng; giao cho từng người ở trang "Giao việc và chi tiết" của họ, như giao công cụ. Mỗi loài cần nghiên cứu riêng và chuồng đủ cấp: sói (cấp 1), lợn rừng (cấp 2), voi (cấp 3). Kỵ binh của Trại kỵ thú không cần thú của chuồng: họ cưỡi con của trại.'));
    for (const k of MOUNT_KINDS) {
      const d = MOUNTS[k], have = h('span', { class: 'have' }), lock = h('small', { class: 'lock' });
      const minus = h('button', { class: 'sm', text: '−', title: 'Bớt một đơn', onclick: () => { sim.unqueueTame(k); ctl.onChange(); } }) as HTMLButtonElement;
      const plus = h('button', { class: 'sm', text: '+', title: 'Thêm một đơn vào hàng đợi', onclick: () => { const e = sim.queueTame(k); if (e) c.toast(e); ctl.onChange(); } }) as HTMLButtonElement;
      const row = h('div', { class: 'rec' }, h('div', { class: 'nm' }, d.name, h('small', {}, `${costText(d.cost, RES_NAME)} · ${workDays(d.time)} · đi nhanh ×${d.speed}, đỡ ${Math.round((1 - d.guard) * 100)}% đòn`), lock), h('div', { class: 'qty' }, have, minus, plus));
      this.mountRows.push({ k, have, row, lock, btns: [minus, plus] });
      beasts.append(row);
    }
    this.tabs.stable = [
      { label: 'Đang làm', page: page(this.staffBoxes.tame.root, h('h3', { text: 'Đang thuần' }), this.activeBoxes.tame.root, this.mountNote) },
      { label: 'Thuần thú', page: beasts },
    ];

    // every house with people in it can send them off to train
    for (const kind of Object.keys(TRAINING.profiles) as BuildingKind[]) {
      const pane = new TrainPane(c, kind);
      this.trainPanes[kind] = pane;
      (this.tabs[kind] ??= []).push({ label: 'Huấn luyện', page: page(pane.root) });
    }

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
      case 'infantry': case 'cavalry': case 'archery': return `Cấp ${b.level}: chứa ${lv.slots} người, mỗi người một giường · hồi sức ×${lv.craftSpeed.toLocaleString('vi')} (cạnh đống lửa chỉ ×${REST.sleepAt.campfire.toLocaleString('vi')})`;
      case 'house': return `Cấp ${b.level}: ${lv.slots} giường cho dân · hồi sức ×${lv.craftSpeed.toLocaleString('vi')} (cạnh đống lửa chỉ ×${REST.sleepAt.campfire.toLocaleString('vi')})`;
      case 'field': return `Cấp ${b.level}: ${lv.slots} nông dân làm một lúc · năng suất ×${lv.craftSpeed.toLocaleString('vi')} (cuốc đá làm nhanh hơn)`;
      case 'builder': return `Cấp ${b.level}: chứa ${lv.slots} thợ xây · xây nhanh ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'workshop': return `Cấp ${b.level}: chứa ${lv.slots} người chế tạo · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'lab': return `Cấp ${b.level}: chứa ${lv.slots} nhà nghiên cứu · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'repair': return `Cấp ${b.level}: chứa ${lv.slots} thợ sửa · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'stable': return `Cấp ${b.level}: chứa ${lv.slots} người thuần thú · tốc độ ×${lv.craftSpeed.toLocaleString('vi')} · thuần được ${MOUNT_KINDS.filter((k) => MOUNTS[k].tier <= b.level).map((k) => MOUNTS[k].name.toLowerCase()).join(', ')}`;
      case 'wartent': return `Cấp ${b.level}: tối đa ${this.c.sim.squadLimit()} đội, ${this.c.sim.cardLimit()} thẻ lệnh cho một kế hoạch · vào lều là game tạm dừng`;
      case 'farmhouse': case 'huntlodge': case 'lumberyard': case 'quarry': return `Cấp ${b.level}: giao việc cho tối đa ${lv.slots} người · nâng cấp để chứa thêm`;
      case 'scouttent': return `Cấp ${b.level}: cử tối đa ${lv.slots} trinh sát một chuyến · tab Trinh sát để chọn người và làng cần dò`;
      case 'storage': return `Sức chứa ${lv.cap} mỗi loại`;
      case 'toolstore': case 'armory': return `Chứa tối đa ${lv.cap} món`;
      default: return `Nơi dân ngủ quanh lửa · chứa ${lv.cap} mỗi loại · tối đa ${this.c.sim.popCap()} dân · các nhà khác lên được cấp ${levelCapByFire(b.level)}`;
    }
  }

  update(): void {
    const { sim, ctl } = this.c, b = this.current();
    this.root.hidden = !b || !ctl.buildingOpen;
    const inTent = !!b && ctl.buildingOpen && b.kind === 'wartent' && b.done;
    if (inTent && !this.inTent) { this.resume = sim.speed; sim.speed = 0; }
    else if (!inTent && this.inTent) { if (this.resume > 0 && sim.speed === 0) sim.speed = this.resume; this.resume = 0; }
    this.inTent = inTent;
    if (!inTent && this.war.mapOpen) this.war.closeMap(); // the map of a plan hangs on the tent: without the tent it goes too
    if (!b) { if (ctl.selectedBuilding !== null) ctl.selectedBuilding = null; return; }
    if (!ctl.buildingOpen) return;
    const def = BUILDINGS[b.kind], lv = levelDef(b), top = maxLevel(b.kind, b.era), ready = b.done;
    this.title.textContent = `${buildingName(b.kind, b.era)}${def.buildable ? ` · cấp ${b.level}/${top} (${lv.name.toLowerCase()})` : ''}`;
    this.state.textContent = !b.done ? `đang xây ${Math.floor(b.progress * 100)}%` : b.upgrading ? `đang nâng cấp ${Math.floor(b.progress * 100)}%` : 'đang dùng';
    this.showTabs(b.kind, ready);
    this.info.textContent = !b.done ? 'Giao dân làm Thợ xây để dựng công trình này.' : this.infoText(b);
    if (b.kind === 'campfire' && ready) this.updateCampfire();
    if (b.kind === 'storage' && ready) for (const r of this.resRows) { r.num.textContent = `${Math.floor(sim.stock[r.res])} / ${sim.capacity()}`; r.bar.style.width = `${Math.min(100, (sim.stock[r.res] / Math.max(1, sim.capacity())) * 100)}%`; }
    if ((b.kind === 'storage' || b.kind === 'campfire') && ready) for (const t of this.barterBtns) { t.btn.textContent = `Đổi ${BARTER[t.res]} ${RES_NAME[t.res].toLowerCase()} → 1 ${RES_NAME.coin.toLowerCase()}`; t.btn.disabled = sim.stock[t.res] < BARTER[t.res]; }
    if ((b.kind === 'infantry' || b.kind === 'cavalry' || b.kind === 'archery' || b.kind === 'house') && ready) this.updateBeds(b);
    if (this.rolePanes[b.kind] && ready) this.rolePanes[b.kind]!.update();
    if (this.trainPanes[b.kind] && ready) this.trainPanes[b.kind]!.update(b);
    if (b.kind === 'field' && ready) this.staffBoxes.farm.update(b);
    if (b.kind === 'tower' && ready) this.updateTower(b);
    if (b.kind === 'wartent' && ready) this.war.update();
    if (b.kind === 'scouttent' && ready) this.scoutPane.update();
    if (b.kind === 'workshop' && ready) this.updateWorkshop(b);
    if (b.kind === 'lab' && ready) this.updateLab(b);
    if (b.kind === 'repair' && ready) this.updateRepair(b);
    if (b.kind === 'stable' && ready) this.updateStable(b);
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

  private updateStable(b: Building): void {
    const { sim } = this.c;
    this.staffBoxes.tame.update(b); this.activeBoxes.tame.update(b);
    this.mountNote.textContent = `Hàng đợi ${sim.tameQueue.length}: ${sim.tameQueue.map((k) => MOUNTS[k as MountKind]?.name.toLowerCase()).join(', ') || 'trống'} · trong chuồng: ${MOUNT_KINDS.map((k) => `${sim.tamedCount(k)} ${MOUNTS[k].name.toLowerCase()}`).join(', ')}`;
    for (const r of this.mountRows) {
      const lock = sim.tameLock(r.k);
      r.have.textContent = lock ? '' : `chuồng ${sim.tamedCount(r.k)} · đợi ${sim.tameQueue.filter((x) => x === r.k).length}`;
      r.row.classList.toggle('locked', !!lock); r.lock.textContent = lock ?? '';
      for (const btn of r.btns) btn.disabled = !!lock;
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

  /** Who keeps watch on the tower, and the archers who could. */
  private updateTower(b: Building): void {
    const { sim, ctl, toast } = this.c, crew = sim.garrison(b), slots = levelDef(b).slots;
    const archers = sim.villagers.filter((v) => v.job === 'fight' && v.post !== b.id && WEAPONS[v.weapon ?? 'fist'].ranged);
    this.towerHead.textContent = `Cung thủ trên chòi (${crew.length}/${slots})`;
    const key = `${b.id}|${crew.map((v) => v.id).join()}|${archers.map((v) => `${v.id}.${v.post}`).join()}|${crew.length >= slots}`;
    if (key === this.towerKey) return;
    this.towerKey = key;
    const row = (v: Villager, label: string, fn: () => void) => h('div', { class: 'row' }, h('div', { class: 'nm' }, v.name, h('small', { text: WEAPONS[v.weapon ?? 'fist'].name })), h('button', { class: 'sm', text: label, disabled: label === 'Lên chòi' && crew.length >= slots, onclick: () => { fn(); ctl.onChange(); } }));
    this.towerList.replaceChildren(
      ...(crew.length ? crew.map((v) => row(v, 'Xuống', () => sim.leaveTower([v.id]))) : [h('p', { class: 'sub', text: 'Chưa có cung thủ nào trên chòi.' })]),
      h('p', { class: 'sub', text: archers.length ? 'Cung thủ có thể lên:' : 'Chưa có chiến binh nào cầm cung hoặc dây quăng.' }),
      ...archers.map((v) => row(v, 'Lên chòi', () => { const e = sim.assignTower([v.id], b.id); if (e) toast(e); })));
  }

  private updateCampfire(): void { this.people.update(); }

  /** Who lies in the beds of a Nhà dân or a soldiers' camp, with their strength. Rebuilt only when the sleepers change. */
  private updateBeds(b: Building): void {
    const kind = b.kind as 'house' | 'infantry' | 'cavalry' | 'archery', sleepers = this.c.sim.sleepers(b), inside = sleepers.filter((v) => v.inside === b.id);
    this.bedHead[kind].textContent = `Đang ngủ (${inside.length}/${levelDef(b).slots} giường)${sleepers.length > inside.length ? ` · ${sleepers.length - inside.length} đang tới` : ''}`;
    const key = `${sleepers.map((v) => `${v.id}${v.inside === b.id}${Math.round(v.energy)}`).join()}|${kind}|${b.id}`;
    if (key === this.bedKey[kind]) return;
    this.bedKey[kind] = key;
    this.bedList[kind].replaceChildren(...(sleepers.length ? sleeperRows(this.c.sim, sleepers) : [h('p', { class: 'sub', text: kind !== 'house' ? 'Chưa có ai trong trại. Lính vào trại khi trời tối hoặc khi kiệt sức.' : 'Chưa có ai trong nhà. Dân vào nhà khi trời tối hoặc khi kiệt sức.' })]));
  }
}

const isGearKind = (k: string) => k in WEAPONS || k === 'hide';

