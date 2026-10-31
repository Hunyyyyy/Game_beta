import { BUILDINGS, Building, buildingName, levelCapByFire, levelDef, maxLevel, POP_BY_FIRE } from '../sim/buildings';
import { huntRange } from '../sim/battle';
import { WEAPONS } from '../sim/combat';
import { JOBS, ROLES, STAT_NAME } from '../sim/jobs';
import type { RoleId } from '../sim/jobs';
import { workDays } from '../sim/constants';
import REST from '../data/rest.json';
import { BARTER, RES_LIST, RES_NAME, rationAt } from '../sim/resources';
import type { Villager } from '../sim/sim';
import type { BuildingKind } from '../sim/buildings';
import { autoOn, TECH_BY_ID, TECHS, TREE_TABS } from '../sim/research';
import { TechTree } from './techtree';
import { resIcon } from './resicons';
import { RECIPE_BY_ID, RECIPES, TIER_DURABILITY, TIER_NAME, TOOL_KINDS, TOOL_NAME, ToolKind, recipeName, recipeUse } from '../sim/tools';
import { costText, h, helpButton, hint, iconCanvas } from './dom';
import type { Ctx } from './ctx';
import { PeoplePane } from './peoplepane';
import { ActiveBox, StaffBox } from './housebox';
import { ScoutPane } from './scoutpane';
import { RolePane } from './rolepane';
import { dlg, GameDialog } from './gamedialog';
import { personTile } from './people';
import { MOUNT_KINDS, MOUNTS, MountKind } from '../sim/jobs';
import { sleeperRows } from './soldierpane';
import { WarPanel } from './warpanel';

export class BuildingPanel {
  private title!: HTMLElement; private state!: HTMLElement; private picBox!: HTMLElement; private picKey = '';
  private readonly win: GameDialog;
  /** Every building shows its parts as pages behind a row of tab buttons at the top. */
  private readonly tabs = {} as Record<BuildingKind, Array<{ label: string; page: HTMLElement; /** A house whose picture stands for the tab: the tabs then show as a grid of pictures. */ icon?: BuildingKind; /** Why the tab is shut, or null when it is open. */ lock?: () => string | null; /** Drawn under the tab of this index, in its column, and joined to it (and to the one above it) by a line. */ under?: number }>>;
  private readonly tabBar = h('div', { class: 'btns tabs', role: 'tablist' });
  /** The line about the building and its tabs, side by side when the tabs are plain buttons. */
  private readonly topbar = h('div', { class: 'topbar' });
  private readonly tabAt: Partial<Record<BuildingKind, number>> = {};
  private readonly pages: HTMLElement[] = []; private tabKey = '';
  private readonly resRows: Array<{ res: typeof RES_LIST[number]; num: HTMLElement; bar: HTMLElement }> = [];
  private readonly barterBtns: Array<{ res: Exclude<typeof RES_LIST[number], 'coin'>; btn: HTMLButtonElement }> = [];
  private readonly recRows: Array<{ id: string; kind: string; tier: number; list: string; have: HTMLElement; row: HTMLElement; lock: HTMLElement; btns: HTMLButtonElement[] }> = [];
  private readonly trees: TechTree[] = [];
  private readonly goodRows: Array<{ id: string; num: HTMLElement; row: HTMLElement }> = [];
  /** What the filters of the tool and weapon lists say, by list: the kind to show ('' for all) and whether to show only what can be had now. */
  private readonly filters: Record<string, { kind: string; only: boolean }> = { 'craft-tool': { kind: '', only: false }, 'craft-weapon': { kind: '', only: false }, 'store-tool': { kind: '', only: false }, 'store-gear': { kind: '', only: false } };
  private readonly goodsBar = h('div', { class: 'btns filters' }); private goodsBarCat = '';
  private readonly people: PeoplePane;
  /** The campfire's meal under the title: a food icon, the number and a ? that tells how the village eats. */
  private readonly foodNum = h('b'); private readonly foodHint = hint(h('span', { class: 'foodline' }, resIcon('food'), this.foodNum), '');
  /** The people of each role house, kept in the house that gives the role. */
  private readonly rolePanes = {} as Partial<Record<BuildingKind, RolePane>>;
  private readonly labHead = h('div', { class: 'labhead' });
  /** What the house is working on (the order under way and the queue), always at the very top of its panel, above the tabs. */
  private readonly progress = h('div', { class: 'progress' });
  private readonly progSec = {} as Record<string, HTMLElement>;
  /** The research house: the tab that is open, as a panel laid over the whole one (null while the grid of tabs shows). */
  private labSub: number | null = null;
  private readonly mbody = h('div', { class: 'mbody' });
  private readonly subTitle = h('b'); private readonly subBody = h('div', { class: 'subbody' });
  private readonly sub = h('div', { class: 'subpanel', hidden: true }, h('div', { class: 'subhead' }, h('button', { class: 'sm', text: '‹ Quay lại', onclick: () => { this.labSub = null; this.tabKey = ''; this.update(); } }), this.subTitle), this.subBody);
  /** The war council held in the Lều họp chiến. */
  private readonly war: WarPanel;
  /** Where scouts are picked and sent, in the Trại trinh sát. */
  private readonly scoutPane: ScoutPane;
  /** The speed to go back to when the tent is left (it opens the game paused, as a war council does). */
  private resume = 0; private inTent = false;
  /** The people lying in the Nhà dân and the camps of the soldiers. */
  private readonly bedHead = {} as Record<string, HTMLElement>; private readonly bedList = {} as Record<string, HTMLElement>; private readonly bedKey = {} as Record<string, string>;
  /** The archers posted on a tower. */
  private readonly towerHead = h('h3'); private readonly towerList = h('div'); private towerKey = '';
  /** What the building is, behind the ? next to its title. */
  private readonly info = h('p', { class: 'sub hintbody', hidden: true });
  private readonly staffBoxes: Record<'build' | 'craft' | 'research' | 'tame' | 'farm', StaffBox>;
  private readonly activeBoxes: Record<'craft' | 'research' | 'tame', ActiveBox>;
  private readonly mountRows: Array<{ k: MountKind; have: HTMLElement; row: HTMLElement; lock: HTMLElement; btns: HTMLButtonElement[] }> = [];
  private readonly mountNote = h('div', { class: 'kv' });
  private readonly queueNote = { craft: h('div', { class: 'kv' }), research: h('div', { class: 'kv' }) };
  private readonly goodsNote = h('p', { class: 'sub' }); private readonly goodsHint = hint(this.goodsNote, '');

  constructor(readonly root: HTMLElement, private readonly c: Ctx) {
    const { sim, ctl, sprites } = c;
    root.className = 'modal';
    const recipeNm = (id: string) => (RECIPE_BY_ID[id] ? recipeName(RECIPE_BY_ID[id]) : id);
    this.staffBoxes = { build: new StaffBox(c, 'build'), craft: new StaffBox(c, 'craft'), research: new StaffBox(c, 'research'), tame: new StaffBox(c, 'tame'), farm: new StaffBox(c, 'farm') };
    this.activeBoxes = {
      craft: new ActiveBox(c, recipeNm, (id) => sim.orderDef('craft', id)?.time ?? 1),
      research: new ActiveBox(c, (id) => TECH_BY_ID[id]?.name ?? id, (id) => sim.orderDef('research', id)?.time ?? 1),
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
    // everyone sleeps inside a house: the trade in the house of the trade, the free in a Nhà dân; the list of those lying in a house is a tab of the house
    const bedPage = (kind: BuildingKind, who: string) => {
      this.bedHead[kind] = h('h3'); this.bedList[kind] = h('div'); this.bedKey[kind] = '';
      return page(hint(this.bedHead[kind], `${who} vào đây ngủ khi trời tối hoặc kiệt sức: họ biến mất khỏi bản đồ, hiện ở danh sách này, không có hình ngủ. Hồi sức đầy đủ${kind === 'house' || kind === 'infantry' || kind === 'cavalry' || kind === 'archery' || kind === 'guardpost' ? ', cấp cao hơn hồi nhanh hơn' : ''}. Hết giường thì ngủ bên đống lửa, hồi chậm hơn.`), this.bedList[kind]);
    };
    const roleHouse = (role: RoleId, label: string, soldiers = false) => {
      const kind = ROLES[role].building, pane = new RolePane(c, role);
      this.rolePanes[kind] = pane;
      this.tabs[kind] = [{ label, page: page(pane.root) }];
      if (soldiers) this.tabs[kind].push({ label: 'Người trong trại', page: bedPage(kind, 'Lính') }); // the others show "đang ngủ" on their own tile
    };
    roleHouse('foot', 'Lính', true); roleHouse('cavalry', 'Lính', true); roleHouse('archer', 'Lính', true); roleHouse('guard', 'Lính gác', true);
    roleHouse('wood', 'Nhân công'); roleHouse('stone', 'Nhân công'); roleHouse('food', 'Nhân công'); roleHouse('hunt', 'Nhân công');
    this.tabs.house = [{ label: 'Người trong nhà', page: bedPage('house', 'Dân rảnh') }];
    this.tabs.field = [{ label: 'Người làm ruộng', page: page(this.staffBoxes.farm.root) }];
    this.war = new WarPanel(c);
    this.tabs.wartent = [{ label: 'Họp chiến', page: page(this.war.root) }];
    this.scoutPane = new ScoutPane(c);
    this.tabs.scouttent = [{ label: 'Trinh sát', page: page(this.scoutPane.roster) }, { label: 'Làng đã phát hiện', page: page(this.scoutPane.villages) }];
    this.tabs.tower = [{ label: 'Cung thủ canh', page: page(hint(this.towerHead, 'Cung thủ đứng trên chòi bắn xa hơn 2 ô và mạnh hơn một phần tư, và kẻ địch phải phá chòi mới hạ được họ. Chỉ chiến binh cầm cung hoặc dây quăng đá mới lên được. Chế cung và dây quăng ở Nhà chế tạo.'), this.towerList) }];
    this.tabs.fence = []; this.tabs.gate = [];
    this.tabs.builder = [{ label: 'Thợ xây', page: page(this.staffBoxes.build.root) }];
    this.tabs.campfire = [
      { label: 'Dân', page: page(this.people.root) },
      { label: 'Đổi chác', page: page(barter()) },
    ];

    // storage: stock against capacity, and trading goods for money
    const stockRows: HTMLElement[] = [];
    for (const res of RES_LIST) {
      const num = h('b'), bar = h('b');
      this.resRows.push({ res, num, bar });
      stockRows.push(h('div', { class: 'row' }, h('div', { class: 'nm' }, resIcon(res), RES_NAME[res], h('small', {}, num)), h('div', { class: 'bars', style: 'width:90px;display:block' }, h('i', {}, bar))));
    }
    this.tabs.storage = [{ label: 'Tài nguyên', page: page(...stockRows) }, { label: 'Đổi chác', page: page(barter()) }];

    // one row for anything that is ordered from a house (a tool or weapon at the workshop, a beast at the stable): a picture, the name and what it costs,
    // how many are in store and waiting, and the buttons to add an order or take one off. The same component for both, so they look and work alike.
    const orderRow = (o: { icon: HTMLElement; name: string; detail: string; add: () => string | null; cancel: () => void }) => {
      const have = h('span', { class: 'have' }), lock = h('small', { class: 'lock' });
      const minus = h('button', { class: 'sm', text: '−', title: 'Bớt một đơn', onclick: () => { o.cancel(); ctl.onChange(); } }) as HTMLButtonElement;
      const plus = h('button', { class: 'sm', text: '+', title: 'Thêm một đơn vào hàng đợi', onclick: () => { const e = o.add(); if (e) c.toast(e); ctl.onChange(); } }) as HTMLButtonElement;
      const row = h('div', { class: 'rec' }, o.icon, h('div', { class: 'nm' }, o.name, h('small', {}, o.detail), lock), h('div', { class: 'qty' }, have, minus, plus));
      return { row, have, lock, btns: [minus, plus] };
    };

    // craft house: what is being made, then one tab for each kind of blueprint
    const section = (el: HTMLElement, list: typeof RECIPES, key?: string) => {
      if (key) el.append(this.filterBar(key, [...new Set(list.map((r) => r.kind))]));
      for (const r of list) {
        const o = orderRow({ icon: iconCanvas(sprites.icons[r.id]), name: recipeName(r), detail: `${costText(r.cost, RES_NAME)} · ${workDays(r.time)} · ${recipeUse(r)}`, add: () => sim.queueCraft(r.id), cancel: () => sim.unqueueCraft(r.id) });
        this.recRows.push({ id: r.id, kind: r.kind, tier: r.tier, list: key ?? '', ...o });
        el.append(o.row);
      }
      return el;
    };
    const shop = (list: typeof RECIPES, key?: string) => section(page(hint('Chế tạo theo bản vẽ', 'Chỉ chế được món đã có bản vẽ ở Nhà nghiên cứu và đủ cấp Nhà chế tạo. Sản phẩm vào Kho công cụ hoặc Kho vũ khí.')), list);
    this.progSec.workshop = h('div', {}, h('h3', { text: 'Đang chế tạo' }), this.activeBoxes.craft.root, this.queueNote.craft);
    this.tabs.workshop = [
      { label: 'Người làm việc', page: page(this.staffBoxes.craft.root) },
      { label: 'Công cụ', page: shop(RECIPES.filter((r) => ['axe', 'pick', 'hoe', 'hammer', 'torch'].includes(r.kind)), 'craft-tool') },
      { label: 'Vũ khí', page: shop(RECIPES.filter((r) => r.kind in WEAPONS), 'craft-weapon') },
      { label: 'Áo giáp', page: shop(RECIPES.filter((r) => r.kind === 'hide')) },
    ];

    // research house: who works and what is under way stay at the top; the tabs are pictures laid out as a tree (Quân sự, Xây dựng, Kinh tế on one level, Vũ khí under Quân sự)
    const tree = (fill: (t: TechTree) => void): HTMLElement => { const t = new TechTree(c); fill(t); this.trees.push(t); return page(t.root); };
    const only = (test: (id: string) => boolean) => TECHS.filter((x) => test(x.id));
    const labLevel = () => sim.building('lab')?.level ?? 0;
    const militaryLock = () => (sim.dev.freeBuild || labLevel() >= TREE_TABS.military.needLab ? null : `Cần Nhà nghiên cứu cấp ${TREE_TABS.military.needLab} để mở Quân sự`);
    this.progSec.lab = h('div', {}, hint('Đang nghiên cứu', 'Mỗi lần chỉ nghiên cứu một thứ. Mỗi công cụ, vũ khí, giáp chỉ có MỘT bản vẽ, nâng dần theo cấp. Bấm nghiên cứu là trả ngay vật liệu và tiền (hủy đơn thì được trả lại). Cần rất nhiều thời gian: càng nhiều người làm trong nhà càng nhanh.'), this.activeBoxes.research.root, this.queueNote.research);
    this.tabs.lab = [
      { label: 'Quân sự bậc 1', icon: 'infantry', lock: militaryLock, page: tree((t) => { t.addChains('Chỉ số quân', ['foot', 'cavalry', 'archer', 'scout'], 'military'); }) },
      { label: 'Phát triển bậc 1', icon: 'builder', page: tree((t) => t.addChains('Chỉ số nhà làm việc', ['build', 'craft', 'research'], 'development')) },
      { label: 'Kinh tế bậc 1', icon: 'storage', page: tree((t) => { t.addChains('Chỉ số nghề', ['wood', 'stone', 'food', 'hunt', 'farm', 'tame'], 'economy'); }) },
      { label: 'Nâng cấp công trình bậc 1', icon: 'storage', under: 1, page: tree((t) => t.addLadder('Dựng bằng gỗ, rồi xây bằng đá', only((id) => id === 'timber' || id === 'masonry'))) },
      { label: 'Công cụ bậc 1', icon: 'workshop', under: 2, page: tree((t) => { t.addChains('Chỉ số công cụ', ['axe', 'pick', 'hoe'], 'tool'); t.addChains('Búa', ['hammer'], 'hammer'); }) },
      { label: 'Tự động hóa bậc 1', icon: 'toolstore', under: 2, page: tree((t) => t.addSingles('Dân tự làm', only((id) => id.startsWith('auto_')))) },
      { label: 'Chiến đấu bậc 1', icon: 'drill', under: 0, lock: () => militaryLock() && 'Cần mở Quân sự trước', page: tree((t) => { t.addSingles('Tín hiệu', only((id) => id === 'signal')); t.addFormations('Trận pháp', 'formation'); }) },
      { label: 'Vũ khí bậc 1', icon: 'armory', under: 0, lock: () => militaryLock() && 'Cần mở Quân sự trước', page: tree((t) => { t.addChains('Chỉ số từng vũ khí', ['club', 'spear', 'mace', 'sling', 'bow'], 'weapon'); }) },
      { label: 'Người nghiên cứu', icon: 'lab', page: page(this.staffBoxes.research.root) },
    ];

    // tool store and armoury: what is kept
    const goods = page(this.goodsHint, this.goodsBar);
    const goodsRows = (cat: 'tool' | 'gear') => RECIPES.filter((r) => (cat === 'gear') === isGearKind(r.kind));
    for (const r of [...goodsRows('tool'), ...goodsRows('gear')]) {
      const num = h('b'), row = h('div', { class: 'rec' }, iconCanvas(sprites.icons[r.id]), h('div', { class: 'nm' }, recipeName(r), h('small', { text: recipeUse(r) })), h('div', { class: 'qty' }, num));
      this.goodRows.push({ id: r.id, num, row }); goods.append(row);
    }
    this.tabs.toolstore = this.tabs.armory = [{ label: 'Kho', page: goods }];

    // the stable: the order under way is at the top; here the keepers and the beasts that can be tamed, one card each (a beast needs its research and a high enough stable)
    const beasts = page(hint('Thú có thể thuần', 'Dân làm việc trong chuồng thuần hóa từng con thú theo đơn: tốn lương thực, da và tiền, mất nhiều thời gian (càng đông và càng nhanh nhẹn càng nhanh). Con xong vào chuồng; giao cho từng người ở thẻ "Giao việc và chi tiết" của họ (lính, thợ săn, trinh sát), mục Thú cưỡi. Mỗi loài cần chuồng đủ cấp, khôn ngoan hơn và nghiên cứu riêng.'));
    this.progSec.stable = h('div', {}, h('h3', { text: 'Đang thuần' }), this.activeBoxes.tame.root, this.mountNote);
    for (const k of MOUNT_KINDS) {
      const d = MOUNTS[k];
      const o = orderRow({ icon: iconCanvas(sprites.mount(d.species, false, 0, 1)), name: d.name, detail: `${costText(d.cost, RES_NAME)} · ${workDays(d.time)} · đi nhanh ×${d.speed}, đỡ ${Math.round((1 - d.guard) * 100)}% đòn`, add: () => sim.queueTame(k), cancel: () => sim.unqueueTame(k) });
      this.mountRows.push({ k, ...o });
      beasts.append(o.row);
    }
    this.tabs.stable = [{ label: 'Thuần thú', page: beasts }, { label: 'Người làm việc', page: page(this.staffBoxes.tame.root) }];

    this.progress.append(...Object.values(this.progSec));
    this.topbar.append(this.labHead, this.tabBar);
    this.mbody.append(this.progress, this.topbar, ...this.pages, this.sub);
    // the panel of a building is a dialog like the others: the head with the picture of the house, then the body that scrolls
    const head = dlg.head({ pic: '🏠', title: '—', sub: '—', onClose: () => ctl.closePanel() });
    this.title = head.querySelector('.dtitle') as HTMLElement; this.state = head.querySelector('.dsub') as HTMLElement; this.picBox = head.querySelector('.dpic') as HTMLElement;
    // the ? beside the title opens what the building is; the campfire's meal sits under it
    const who = head.querySelector('.dwho') as HTMLElement;
    who.replaceChildren(h('div', { class: 'hint' }, h('div', { class: 'hinthead' }, this.title, helpButton()), this.info), this.state, this.foodHint);
    this.win = new GameDialog(root, { keep: true, onClose: () => ctl.closePanel(), canClose: () => !this.war.mapOpen });
    root.append(dlg.card({ wide: true, cls: 'gbuild', label: 'Công trình' }, head, this.mbody));
  }

  /** Show the tab buttons of the building and the page of the chosen one. */
  private showTabs(kind: BuildingKind, ready: boolean): void {
    const tabs = ready ? this.tabs[kind] ?? [] : [];
    const locks = tabs.map((t) => t.lock?.() ?? null);
    const key = `${kind}:${tabs.length}:${locks.map((l) => (l ? 1 : 0)).join('')}`;
    this.labHead.hidden = !(kind === 'lab' && ready);
    for (const [k, el] of Object.entries(this.progSec)) el.hidden = !(ready && k === kind);
    this.progress.hidden = !ready || !this.progSec[kind];
    if (key !== this.tabKey) {
      this.tabKey = key;
      const pictures = tabs.some((t) => t.icon);
      this.topbar.classList.toggle('inline', !pictures);
      this.tabBar.classList.toggle('icontabs', pictures); this.tabBar.classList.toggle('treetabs', pictures && kind === 'lab');
      this.tabBar.replaceChildren(...tabs.map((t, i) => {
        const go = () => { if (locks[i]) { this.c.toast(locks[i]!); return; } this.tabAt[kind] = i; if (kind === 'lab') this.labSub = i; this.showTabs(kind, true); };
        if (!pictures) return h('button', { class: 'sm', text: t.label, role: 'tab', onclick: go });
        let pic: HTMLElement;
        try { pic = h('span', { class: 'tpic' }, iconCanvas(this.c.sprites.building(t.icon ?? kind, this.c.sim.era, 1, 4).frames[0])); } catch { pic = h('span', { class: 'tpic', text: '?' }); }
        return h('button', { class: `tabcard${locks[i] ? ' locked' : ''}${t.under !== undefined ? ' under' : ''}`, style: t.under !== undefined ? `grid-column:${t.under + 1};grid-row:${2 + tabs.slice(0, i).filter((o) => o.under === t.under).length}` : undefined, role: 'tab', title: locks[i] ?? t.label, onclick: go }, pic, h('span', { text: t.label }), locks[i] ? h('span', { class: 'tlock', text: '🔒' }) : null);
      }));
    }
    if (kind === 'lab' && ready) {
      // a tab of the research house opens a panel over this one, with a way back
      const open = this.labSub !== null && !locks[this.labSub] ? this.labSub : null;
      this.sub.hidden = open === null; this.tabBar.hidden = false;
      // with a tab open the panel under it must not scroll: the tab scrolls by itself
      this.mbody.classList.toggle('subopen', open !== null); if (open !== null) this.mbody.scrollTop = 0;
      for (const p of this.pages) p.hidden = open === null || tabs[open].page !== p;
      if (open !== null) { this.subTitle.textContent = tabs[open].label; if (this.subBody.firstChild !== tabs[open].page) this.subBody.replaceChildren(tabs[open].page); }
      [...this.tabBar.children].forEach((el, i) => el.setAttribute('aria-pressed', String(i === open)));
      return;
    }
    this.sub.hidden = true; this.mbody.classList.remove('subopen');
    let at = Math.min(this.tabAt[kind] ?? 0, Math.max(0, tabs.length - 1));
    if (locks[at]) at = Math.max(0, locks.findIndex((l) => !l));
    this.tabBar.hidden = tabs.length < 2;
    this.mbody.classList.toggle('fit', kind === 'campfire' && at === 0); // the people of the campfire fit the dialog, no scrolling
    [...this.tabBar.children].forEach((el, i) => el.setAttribute('aria-pressed', String(i === at)));
    for (const p of this.pages) p.hidden = tabs[at]?.page !== p;
  }

  private current(): Building | undefined { const id = this.c.ctl.selectedBuilding; return id === null ? undefined : this.c.sim.getBuilding(id); }

  /** What the house says about itself, and which stat of its people makes it work best. */
  private infoText(b: Building): string {
    const stat = PRIORITY_STAT[b.kind];
    return this.infoBase(b) + (stat ? ` · Ưu tiên chỉ số: ${stat}` : '');
  }

  private infoBase(b: Building): string {
    const lv = levelDef(b);
    switch (b.kind) {
      case 'infantry': case 'cavalry': case 'archery': case 'guardpost': return `Cấp ${b.level}: chứa ${lv.slots} người, mỗi người một giường · hồi sức ×${lv.craftSpeed.toLocaleString('vi')} (cạnh đống lửa chỉ ×${REST.sleepAt.campfire.toLocaleString('vi')})`;
      case 'house': return `Cấp ${b.level}: ${lv.slots} giường cho dân rảnh, làng chứa thêm ${lv.slots} dân · hồi sức ×${lv.craftSpeed.toLocaleString('vi')} (cạnh đống lửa chỉ ×${REST.sleepAt.campfire.toLocaleString('vi')})`;
      case 'field': return `Cấp ${b.level}: ${lv.slots} nông dân làm một lúc · năng suất ×${lv.craftSpeed.toLocaleString('vi')} (cuốc đá làm nhanh hơn)`;
      case 'builder': return `Cấp ${b.level}: chứa ${lv.slots} thợ xây · xây nhanh ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'workshop': return `Cấp ${b.level}: chứa ${lv.slots} người chế tạo · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'lab': return `Cấp ${b.level}: chứa ${lv.slots} nhà nghiên cứu · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;

      case 'stable': return `Cấp ${b.level}: chứa ${lv.slots} người thuần thú · tốc độ ×${lv.craftSpeed.toLocaleString('vi')} · thuần được ${MOUNT_KINDS.filter((k) => MOUNTS[k].tier <= b.level).map((k) => MOUNTS[k].name.toLowerCase()).join(', ')}`;
      case 'wartent': return `Cấp ${b.level}: tối đa ${this.c.sim.squadLimit()} đội, ${this.c.sim.cardLimit()} thẻ lệnh cho một kế hoạch · vào lều là game tạm dừng`;
      case 'huntlodge': return `Cấp ${b.level}: giao việc cho tối đa ${lv.slots} thợ săn, săn trong ${huntRange(this.c.sim)} ô quanh chòi · nâng cấp để chứa thêm và săn xa hơn`;
      case 'farmhouse': case 'lumberyard': case 'quarry': return `Cấp ${b.level}: giao việc cho tối đa ${lv.slots} người · nâng cấp để chứa thêm`;
      case 'scouttent': return `Cấp ${b.level}: cử tối đa ${lv.slots} trinh sát một chuyến · tab Làng đã phát hiện để chọn làng và người đi`;
      case 'storage': return `Sức chứa ${lv.cap} mỗi loại`;
      case 'toolstore': case 'armory': return `Chứa tối đa ${lv.cap} món`;
      default: return `Nơi dân rảnh ngủ quanh lửa · chứa ${lv.cap} mỗi loại · làng tối đa ${this.c.sim.popCap()} dân (lửa trại ${POP_BY_FIRE[Math.min(POP_BY_FIRE.length, b.level) - 1]} + Nhà dân ${this.c.sim.bedsIn('house')}) · các nhà khác lên được cấp ${levelCapByFire(b.level)}`;
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
    if (b.kind !== 'lab') this.labSub = null;
    const def = BUILDINGS[b.kind], lv = levelDef(b), top = maxLevel(b.kind, b.era), ready = b.done;
    this.title.textContent = `${buildingName(b.kind, b.era)}${def.buildable ? ` · cấp ${b.level}/${top} (${lv.name.toLowerCase()})` : ''}`;
    const pk = `${b.kind}${b.level}${b.done}`;
    if (pk !== this.picKey) { this.picKey = pk; try { this.picBox.replaceChildren(iconCanvas(this.c.sprites.building(b.kind, b.era, Math.max(1, b.level), 4).frames[0])); } catch { this.picBox.textContent = '🏠'; this.picBox.className = 'dpic glyph'; } }
    const meal = b.kind === 'campfire' && b.done && !b.upgrading;
    this.state.textContent = !b.done ? `đang xây ${Math.floor(b.progress * 100)}%` : b.upgrading ? `đang nâng cấp ${Math.floor(b.progress * 100)}%` : 'đang dùng';
    this.state.hidden = meal; this.foodHint.hidden = !meal;
    this.showTabs(b.kind, ready);
    this.info.textContent = !b.done ? 'Giao dân làm Thợ xây để dựng công trình này.' : this.infoText(b);
    if (b.kind === 'campfire' && ready) this.updateCampfire();
    if (b.kind === 'storage' && ready) for (const r of this.resRows) { r.num.textContent = `${Math.floor(sim.stock[r.res])} / ${sim.capacity()}`; r.bar.style.width = `${Math.min(100, (sim.stock[r.res] / Math.max(1, sim.capacity())) * 100)}%`; }
    if ((b.kind === 'storage' || b.kind === 'campfire') && ready) for (const t of this.barterBtns) { t.btn.textContent = `Đổi ${BARTER[t.res]} ${RES_NAME[t.res].toLowerCase()} → 1 ${RES_NAME.coin.toLowerCase()}`; t.btn.disabled = sim.stock[t.res] < BARTER[t.res]; }
    if (this.bedList[b.kind] && ready) this.updateBeds(b);
    if (this.rolePanes[b.kind] && ready) this.rolePanes[b.kind]!.update();
    if (b.kind === 'field' && ready) this.staffBoxes.farm.update(b);
    if (b.kind === 'builder' && ready) this.staffBoxes.build.update(b);
    if (b.kind === 'tower' && ready) this.updateTower(b);
    if (b.kind === 'wartent' && ready) this.war.update();
    if (b.kind === 'scouttent' && ready) this.scoutPane.update();
    if (b.kind === 'workshop' && ready) this.updateWorkshop(b);
    if (b.kind === 'lab' && ready) this.updateLab(b);
    if (b.kind === 'stable' && ready) this.updateStable(b);
    if (b.kind === 'toolstore' || b.kind === 'armory') if (ready) this.updateGoods(b);
  }

  private updateWorkshop(b: Building): void {
    const { sim } = this.c;
    this.staffBoxes.craft.update(b); this.activeBoxes.craft.update(b);
    this.queueNote.craft.textContent = `Hàng đợi ${sim.craftQueue.length}: ${sim.craftQueue.map((id) => recipeName(RECIPE_BY_ID[id]).toLowerCase()).join(', ') || 'trống'} · Kho công cụ ${sim.storeUsed('tool')}/${sim.storeCap('tool')} · Kho vũ khí ${sim.storeUsed('gear')}/${sim.storeCap('gear')}`;
    for (const r of this.recRows) {
      const lock = sim.recipeLock(r.id), f = this.filters[r.list];
      if (f) r.row.hidden = (!!f.kind && r.kind !== f.kind) || (f.only && !!lock);
      r.have.textContent = lock ? '' : `kho ${sim.toolCount(r.kind, r.tier)} · đợi ${sim.craftQueue.filter((id) => id === r.id).length}`;
      r.row.classList.toggle('locked', !!lock); r.lock.textContent = lock ?? '';
      for (const btn of r.btns) btn.disabled = !!lock;
    }
  }

  private updateLab(b: Building): void {
    const { sim } = this.c;
    this.staffBoxes.research.update(b); this.activeBoxes.research.update(b);
    const waiting = sim.researchQueue[0];
    this.queueNote.research.textContent = `${waiting ? `Chờ bắt đầu: ${TECH_BY_ID[waiting]?.name ?? waiting}` : 'Mỗi lần chỉ nghiên cứu một thứ'}`;
    for (const t of this.trees) t.update();
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

  /** The filter over a list of tools or weapons: by kind, and "only what can be had now" (made, or makeable). */
  private filterBar(key: string, kinds: string[], into: HTMLElement = h('div', { class: 'btns filters' })): HTMLElement {
    const { ctl } = this.c, f = this.filters[key], pick = h('select', { class: 'sm', 'aria-label': 'Lọc theo loại', title: 'Lọc theo loại' }) as HTMLSelectElement;
    pick.append(h('option', { value: '', text: 'Mọi loại' }), ...kinds.map((k) => h('option', { value: k, text: kindLabel(k) })));
    pick.value = f.kind;
    pick.addEventListener('change', () => { f.kind = pick.value; ctl.onChange(); });
    const only = h('button', { class: 'sm', text: 'Chỉ món có thể dùng', title: 'Ẩn những món chưa có bản vẽ, chưa đủ cấp nhà hoặc chưa có trong kho', pressed: f.only, onclick: () => { f.only = !f.only; only.setAttribute('aria-pressed', String(f.only)); ctl.onChange(); } });
    into.append(pick, only);
    return into;
  }

  private updateGoods(b: Building): void {
    const { sim } = this.c, cat = b.kind === 'toolstore' ? 'tool' : 'gear';
    this.goodsNote.textContent = `Đang chứa ${sim.storeUsed(cat)}/${sim.storeCap(cat)} món`;
    this.goodsHint.tip.textContent = autoOn(sim.researched, 'fetch') ? 'Dân thiếu đồ hoặc đồ hỏng sẽ tự tới lấy.' : 'Chưa nghiên cứu "Tự lấy đồ trong kho": hãy phát đồ bằng tay ở thẻ dân.';
    const fkey = `store-${cat}`, f = this.filters[fkey];
    if (this.goodsBarCat !== cat) { // the bar of the store follows what the store keeps
      this.goodsBarCat = cat;
      const kinds = [...new Set(RECIPES.filter((r) => (cat === 'gear') === isGearKind(r.kind)).map((r) => r.kind))];
      this.goodsBar.replaceChildren(); this.filterBar(fkey, kinds, this.goodsBar);
    }
    for (const r of this.goodRows) {
      const rc = RECIPE_BY_ID[r.id], mine = (cat === 'gear') === isGearKind(rc.kind), n = sim.toolCount(rc.kind, rc.tier);
      r.row.hidden = !mine || (n === 0 && !!sim.recipeLock(r.id)) || (!!f.kind && rc.kind !== f.kind) || (f.only && n === 0); r.num.textContent = `× ${n}`;
    }
  }

  /** Who keeps watch on the tower, and the archers who could. */
  private updateTower(b: Building): void {
    const { sim, ctl, toast } = this.c, crew = sim.garrison(b), slots = levelDef(b).slots;
    const archers = sim.villagers.filter((v) => v.job === 'fight' && v.post !== b.id && WEAPONS[v.weapon ?? 'fist'].ranged);
    this.towerHead.replaceChildren(h('div', { class: 'dhouse' }, h('b', { text: 'Cung thủ trên chòi' }), dlg.slots(crew.length, slots)));
    const key = `${b.id}|${crew.map((v) => v.id).join()}|${archers.map((v) => `${v.id}.${v.post}`).join()}|${crew.length >= slots}`;
    if (key === this.towerKey) return;
    this.towerKey = key;
    const row = (v: Villager, label: string, fn: () => void) => personTile(this.c, v, { note: WEAPONS[v.weapon ?? 'fist'].name, actions: [dlg.button(label, () => { fn(); ctl.onChange(); }, { small: true, disabled: label === 'Lên chòi' && crew.length >= slots })] });
    this.towerList.replaceChildren(
      crew.length ? dlg.list(...crew.map((v) => row(v, 'Xuống', () => sim.leaveTower([v.id])))) : dlg.empty('Chưa có cung thủ nào trên chòi.'),
      h('div', { class: 'dhouse' }, h('small', { class: 'dsub', text: archers.length ? 'Cung thủ có thể lên:' : 'Chưa có chiến binh nào cầm cung hoặc dây quăng.' })),
      dlg.list(...archers.map((v) => row(v, 'Lên chòi', () => { const e = sim.assignTower([v.id], b.id); if (e) toast(e); }))));
  }

  private updateCampfire(): void {
    const { sim } = this.c, need = sim.foodNeed(), pen = sim.foodPenalty, level = sim.campfire()?.level ?? 1;
    this.people.update();
    this.foodNum.textContent = `${Math.floor(sim.foodPot)}/${need}`;
    this.foodHint.tip.textContent = `Phần ăn hôm nay. Thức ăn thu về đổ vào phần ăn của lửa trại trước, dư mới vào kho. Cuối ngày làng ăn phần này rồi tới kho; thiếu thì cả làng yếu đi trong ngày kế (tối đa 20% mọi chỉ số, máu chỉ hồi chậm hơn). Mỗi dân ăn ${rationAt(level, false)}, mỗi lính ${rationAt(level, true)} thức ăn mỗi ngày (cấp lửa ${level}) · kho còn ${Math.floor(sim.stock.food)}${pen > 0 ? ` · cả làng đang yếu ${Math.round(pen * 1000) / 10}% vì bữa trước thiếu ăn` : ''}`;
  }

  /** Who lies in the beds of a house (the Nhà dân, a camp, the house of a trade), with their strength. Rebuilt only when the sleepers change. */
  private updateBeds(b: Building): void {
    const kind = b.kind, sleepers = this.c.sim.sleepers(b), inside = sleepers.filter((v) => v.inside === b.id);
    this.bedHead[kind].textContent = `Đang ngủ (${inside.length}/${levelDef(b).slots} giường)${sleepers.length > inside.length ? ` · ${sleepers.length - inside.length} đang tới` : ''}`;
    const key = `${sleepers.map((v) => `${v.id}${v.inside === b.id}${Math.round(v.energy)}`).join()}|${kind}|${b.id}`;
    if (key === this.bedKey[kind]) return;
    this.bedKey[kind] = key;
    this.bedList[kind].replaceChildren(...(sleepers.length ? sleeperRows(this.c, sleepers) : [h('p', { class: 'sub', text: kind === 'house' ? 'Chưa có ai trong nhà. Dân rảnh vào nhà khi trời tối hoặc khi kiệt sức.' : 'Chưa có ai ở đây. Họ vào khi trời tối hoặc khi kiệt sức.' })]));
  }
}

/** The stat that counts most for the people of a house: the one its job leans on (src/sim/jobs.ts). */
const PRIORITY_STAT: Partial<Record<BuildingKind, string>> = {
  lumberyard: STAT_NAME[JOBS.wood.stat], quarry: STAT_NAME[JOBS.stone.stat], farmhouse: STAT_NAME[JOBS.food.stat], field: STAT_NAME[JOBS.food.stat], huntlodge: STAT_NAME[JOBS.hunt.stat],
  builder: STAT_NAME[JOBS.build.stat], workshop: STAT_NAME[JOBS.craft.stat], lab: STAT_NAME[JOBS.research.stat], stable: STAT_NAME[JOBS.tame.stat],
  infantry: STAT_NAME.str, guardpost: STAT_NAME.str, cavalry: STAT_NAME.str, archery: STAT_NAME.agi, scouttent: `${STAT_NAME.agi}, ${STAT_NAME.sta}`, house: `${STAT_NAME.vit}, ${STAT_NAME.sta} (hồi sức nhanh)`,
};

const isGearKind = (k: string) => k in WEAPONS || k === 'hide';
/** What a kind of tool, weapon or armour is called in the filters. */
const kindLabel = (k: string): string => (k === 'hide' ? 'Áo da' : k === 'torch' ? 'Đuốc' : k in WEAPONS ? WEAPONS[k].name : TOOL_NAME[k as ToolKind] ?? k);

