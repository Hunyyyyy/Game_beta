import { BUILDINGS, Building, buildingName, levelCapByFire, levelDef, topLevel, POP_BY_FIRE } from '../sim/buildings';
import { huntRange } from '../sim/hunting';
import { ARMORS, WEAPONS } from '../sim/combat';
import { JOBS, ROLES, STAT_NAME } from '../sim/jobs';
import type { RoleId } from '../sim/jobs';

import REST from '../data/rest.json';
import { ANIMAL_MATERIALS, RES_LIST, RES_NAME, rationAt } from '../sim/resources';
import type { Res } from '../sim/resources';
import MARKET from '../data/market.json';

import type { BuildingKind } from '../sim/buildings';
import { TECH_BY_ID } from '../sim/research';
import { ResearchPane } from './researchpane';
import { resIcon } from './resicons';
import { RECIPE_BY_ID, RECIPES, TOOL_NAME, ToolKind, recipeName, recipeStats, recipeUse } from '../sim/tools';
import { h, helpButton, hint, iconCanvas } from './dom';
import type { Ctx } from './ctx';
import { PeoplePane } from './peoplepane';
import { ActiveBox, StaffBox } from './housebox';
import { isProcessKind } from '../sim/processdata';
import { ForgePane } from './forgepane';
import { productsAt, RANCH_PRODUCTS } from '../sim/ranchdata';
import { ScoutPane } from './scoutpane';
import { MarchPane } from './marchpane';
import { icon } from './icons';
import { SimpleWar } from './simplewar';
import { WarLogPane } from './warlogpane';
import { TribesPane } from './tribespane';
import { RolePane } from './rolepane';
import { TowerPane } from './towerpane';
import { GatePane } from './gatepane';
import { dlg, GameDialog } from './gamedialog';

import { MOUNT_KINDS, MOUNTS, MountKind } from '../sim/jobs';
import { sleeperRows } from './soldierpane';
import { WarPanel } from './warpanel';
import { OrderGrid, OrderItem } from './ordergrid';

/** The houses whose people are kept in a list of their own, opened by the button "Nhân sự" (the house of the research, the craft and the beasts). */
export const STAFF_OF = { workshop: 'craft', lab: 'research', stable: 'tame', ranch: 'herd', smelter: 'craft', carpentry: 'craft', tannery: 'craft' } as const;

interface MarketRow { row: HTMLElement; give: Res; get: Res; n: number; price: HTMLElement; input: HTMLInputElement; slider: HTMLInputElement; quote: HTMLElement; go: HTMLButtonElement }

export class BuildingPanel {
  private title!: HTMLElement; private state!: HTMLElement; private picBox!: HTMLElement; private picKey = '';
  private readonly win: GameDialog;
  /** Every building shows its parts as pages behind a row of tab buttons at the top. */
  private readonly marchPane!: MarchPane;
  private readonly tabs = {} as Record<BuildingKind, Array<{ label: string; page: HTMLElement; /** A house whose picture stands for the tab: the tabs then show as a grid of pictures. */ icon?: BuildingKind; /** Why the tab is shut, or null when it is open. */ lock?: () => string | null; /** Drawn under the tab of this index, in its column, and joined to it (and to the one above it) by a line. */ under?: number; /** Not drawn in the tree (a page that a button opens). Keep these last. */ hidden?: boolean; /** Drawn only while this is true. */ show?: () => boolean }>>;
  private readonly tabBar = h('div', { class: 'btns tabs', role: 'tablist' });
  /** The line about the building and its tabs, side by side when the tabs are plain buttons. */
  private readonly topbar = h('div', { class: 'topbar' });
  private readonly tabAt: Partial<Record<BuildingKind, number>> = {};
  private readonly pages: HTMLElement[] = []; private tabKey = '';
  private readonly resRows: Array<{ res: typeof RES_LIST[number]; num: HTMLElement; bar: HTMLElement; row: HTMLElement }> = [];
  private readonly doorBtn = h('button', { class: 'sm', onclick: () => { this.c.sim.toggleNewcomers(); this.updateCampfire(); } }) as HTMLButtonElement;
  /** The Chợ: the rows of selling goods for shells and of swapping goods for each other. `n` is the number of steps (shells' worth) wanted; the rest are the parts of the row that follow it. */
  private readonly sellRows: MarketRow[] = [];
  private readonly buyRows: MarketRow[] = [];
  private swapRows: MarketRow[] = [];
  private swapKey = '';
  private marketKeepOn = true;
  private readonly marketHead = h('p', { class: 'sub' });
  private marketMake: ((give: Exclude<Res, 'coin'>, get: Exclude<Res, 'coin'> | 'coin') => MarketRow) | null = null;
  private readonly swapBox = h('div', { class: 'barter' });
  /** What can be ordered from the Nhà chế tạo and the stable: cards that open a scroll (src/ui/ordergrid.ts). */
  private craftGrid!: OrderGrid; private tameGrid!: OrderGrid;
  private research!: ResearchPane;
  private readonly goodRows: Array<{ id: string; num: HTMLElement; row: HTMLElement; drop: HTMLButtonElement; dropAll: HTMLButtonElement }> = [];
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
  /** The list of people of the house is open over its page (see STAFF_OF), and which house it was opened for. */
  private peopleOpen = false; private peopleFor: number | null = null;
  private readonly peopleBtn = h('button', { class: 'sm tbtn peoplebtn', type: 'button', hidden: true }) as HTMLButtonElement;
  /** The line on the front page of the research house that says who works there and opens the list to add more. */
  private readonly mbody = h('div', { class: 'mbody' });
  private readonly subTitle = h('b'); private readonly subBody = h('div', { class: 'subbody' });
  private readonly sub = h('div', { class: 'subpanel', hidden: true }, h('div', { class: 'subhead' }, h('button', { class: 'sm', text: '‹ Quay lại', onclick: () => { this.labSub = null; this.peopleOpen = false; this.tabKey = ''; this.update(); } }), this.subTitle), this.subBody);
  /** The war council held in the Lều họp chiến. */
  private readonly war: WarPanel;
  /** Where scouts are picked and sent, in the Trại trinh sát. */
  private readonly scoutPane: ScoutPane;
  private readonly warLog: WarLogPane;
  private readonly tribes: TribesPane;
  private readonly simpleWar!: SimpleWar;
  /** The page of the Lều họp chiến: the plan of the medieval era, or the list of villages of the stone age. */
  private readonly warHost = h('div');
  /** The speed to go back to when the tent is left (it opens the game paused, as a war council does). */
  private resume = 0; private inTent = false;
  /** The people lying in the Nhà dân and the camps of the soldiers. */
  private readonly bedHead = {} as Record<string, HTMLElement>; private readonly bedList = {} as Record<string, HTMLElement>; private readonly bedKey = {} as Record<string, string>;
  /** The archers posted on a tower. */
  private readonly towerPane: TowerPane;
  private readonly gatePane: GatePane;
  /** What the building is, behind the ? next to its title. */
  private readonly info = h('p', { class: 'sub hintbody', hidden: true });
  private readonly staffBoxes: Record<'build' | 'craft' | 'research' | 'tame' | 'herd' | 'farm', StaffBox>;
  private readonly activeBoxes: Record<'craft' | 'research' | 'tame', ActiveBox>;
  /** The processing houses of the medieval age (Lò luyện, Xưởng mộc, Xưởng thuộc da và dệt): the bench of each, laid out like a forge (src/ui/forgepane.ts). */
  private readonly forges = {} as Record<'smelter' | 'carpentry' | 'tannery', ForgePane>;
  private readonly mountNote = h('div', { class: 'kv' });
  /** The field: what it is sown with (food, or flax for fibre in the medieval age). */
  private readonly cropBox = h('div', { class: 'kv' }); private cropKey = '';
  /** The ranch: a row for each good it makes, with what it gives in a day and the level that opens it. */
  private readonly ranchRows: Array<{ p: (typeof RANCH_PRODUCTS)[number]; root: HTMLElement; note: HTMLElement; bar: HTMLElement; label: HTMLElement }> = [];
  private readonly queueNote = { craft: h('div', { class: 'kv' }), research: h('div', { class: 'kv' }) };
  private readonly goodsNote = h('p', { class: 'sub' }); private readonly goodsHint = hint(this.goodsNote, '');

  constructor(readonly root: HTMLElement, private readonly c: Ctx) {
    const { sim, ctl, sprites } = c;
    root.className = 'modal';
    const recipeNm = (id: string) => (RECIPE_BY_ID[id] ? recipeName(RECIPE_BY_ID[id]) : id);
    this.staffBoxes = { build: new StaffBox(c, 'build'), craft: new StaffBox(c, 'craft'), research: new StaffBox(c, 'research'), tame: new StaffBox(c, 'tame'), herd: new StaffBox(c, 'herd'), farm: new StaffBox(c, 'farm') };
    this.activeBoxes = {
      craft: new ActiveBox(c, recipeNm, (id) => sim.orderDef('craft', id)?.time ?? 1, (id) => iconCanvas(sprites.icons[id])),
      research: new ActiveBox(c, (id) => TECH_BY_ID[id]?.name ?? id, (id) => sim.orderDef('research', id)?.time ?? 1, () => h('span', { class: 'aglyph', text: '🔬' })),
      tame: new ActiveBox(c, (id) => `thuần ${MOUNTS[id as MountKind]?.name.toLowerCase() ?? id}`, (id) => MOUNTS[id as MountKind]?.time ?? 1, (id) => iconCanvas(sprites.mount(MOUNTS[id as MountKind].species, false, 0, 1))),
    };

    const page = (...kids: Array<HTMLElement | null>) => { const el = h('div', { class: 'tabpage', hidden: true }, ...kids); this.pages.push(el); return el; };

    // the Chợ: selling goods for shells, and swapping them for each other (market.ts)
    const marketRow = (give: Res, get: Res): MarketRow => {
      const buy = give === 'coin', price = h('span', { class: 'bpill' }), title = buy ? RES_NAME[get] : get === 'coin' ? RES_NAME[give] : `${RES_NAME[give]} → ${RES_NAME[get]}`, name = h('div', { class: 'bname' }, h('b', { text: title }), price);
      const input = h('input', { class: 'bnum', type: 'number', min: '0', step: '1', inputmode: 'numeric', 'aria-label': buy ? `Số vỏ trả để mua ${title.toLowerCase()}` : get === 'coin' ? `Số vỏ muốn có từ ${RES_NAME[give].toLowerCase()}` : `Số lượt đổi ${title.toLowerCase()}` }) as HTMLInputElement;
      const slider = h('input', { class: 'bslide', type: 'range', min: '0', max: '0', step: '1', 'aria-label': 'Số lượt' }) as HTMLInputElement;
      const quote = h('div', { class: 'bquote' });
      const go = h('button', { class: 'sm primary', type: 'button', text: buy ? 'Mua' : 'Đổi' }) as HTMLButtonElement;
      const rowEl = h('div', { class: 'brow' });
      const r: MarketRow = { row: rowEl, give, get, n: 0, price, input, slider, quote, go };
      const keep = () => (this.marketKeepOn && !buy ? sim.marketKeep(give as Exclude<Res, 'coin'>) : 0), most = () => sim.marketQuote(give, get, Infinity, keep()).steps;
      const set = (n: number) => { r.n = Math.max(0, Math.min(most(), Math.floor(Number.isFinite(n) ? n : 0))); this.updateMarket(); };
      input.addEventListener('input', () => set(parseInt(input.value, 10)));
      slider.addEventListener('input', () => set(Number(slider.value)));
      const chip = (text: string, share: number, title2: string) => h('button', { class: 'sm', type: 'button', text, title: title2, onclick: () => set(Math.max(1, Math.floor(most() * share))) });
      go.addEventListener('click', () => { if (r.n < 1) return; const e = sim.marketTrade(give, get, r.n, keep()); if (e) c.toast(e); ctl.onChange(); set(r.n); });
      rowEl.append(name, h('div', { class: 'bctl' }, h('div', { class: 'bline' }, input, slider), h('div', { class: 'bline' }, chip('¼', 0.25, 'Một phần tư số tối đa'), chip('½', 0.5, 'Một nửa số tối đa'), chip('Tối đa', 1, 'Nhiều nhất đổi được'), go), quote));
      return r;
    };
    const market = () => {
      const box = h('div', {}, hint('Chợ', 'Nơi duy nhất đổi hàng. Bán hàng lấy vỏ để trả cho nghiên cứu, mua hàng bằng vỏ (đắt hơn bán), hoặc đổi hàng lấy hàng khác (các tuyến đổi mở dần theo nhánh Trao đổi của nghiên cứu Sinh kế). Mỗi ngày chợ chỉ nhận một lượng nhất định (ngẫu nhiên) mỗi loại hàng ở giá gốc; quá lượng đó thì mỗi lượt đắt hơn. Nâng cấp chợ để được tỉ lệ tốt hơn, phí đổi hàng thấp hơn và nhận được nhiều hơn mỗi ngày.'));
      box.append(this.marketHead);
      const keepBox = h('input', { type: 'checkbox' }) as HTMLInputElement; keepBox.checked = this.marketKeepOn;
      keepBox.addEventListener('change', () => { this.marketKeepOn = keepBox.checked; this.updateMarket(); });
      box.append(h('label', { class: 'bkeep' }, keepBox, ' Giữ lại phần cần cho ăn uống và công trình'));
      const sells = h('div', { class: 'barter' });
      for (const res of RES_LIST) { if (res === 'coin') continue; const r = marketRow(res, 'coin'); this.sellRows.push(r); sells.append(r.row); }
      const buys = h('div', { class: 'barter' });
      for (const res of RES_LIST) { if (res === 'coin') continue; const r = marketRow('coin', res); this.buyRows.push(r); buys.append(r.row); }
      box.append(h('h3', { text: 'Bán lấy vỏ sò' }), sells, h('h3', { text: 'Mua bằng vỏ sò (đắt hơn bán)' }), buys, h('h3', { text: 'Đổi hàng lấy hàng' }), this.swapBox);
      this.marketMake = marketRow;
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
    };
    roleHouse('foot', 'Lính', true); roleHouse('cavalry', 'Lính', true); roleHouse('archer', 'Lính', true); roleHouse('guard', 'Lính gác', true); roleHouse('supply', 'Lính hậu cần', true);
    roleHouse('wood', 'Nhân công'); roleHouse('stone', 'Nhân công'); roleHouse('food', 'Nhân công'); roleHouse('hunt', 'Nhân công'); roleHouse('mine', 'Nhân công');
    this.tabs.house = [{ label: 'Người trong nhà', page: bedPage('house', 'Dân rảnh') }];
    this.tabs.field = [{ label: 'Người làm ruộng', page: page(this.cropBox, this.staffBoxes.farm.root) }];
    // the ranch: the goods it makes by itself (a good opens at a level of the house), then the people of the house are the button Nhân sự
    // each product is a strip like the order of a workshop: its picture, name, what it brings, and a bar that fills until the next unit comes in
    const ranchList = RANCH_PRODUCTS.map((p) => {
      const note = h('small'), bar = h('i'), label = h('span'), root = h('div', { class: 'abox' }, h('span', { class: 'apic' }, resIcon(p.res)),
        h('div', { class: 'awork' }, h('div', { class: 'aline' }, h('b', { text: RES_NAME[p.res] }), note), h('div', { class: 'abar' }, bar, label)));
      this.ranchRows.push({ p, root, note, bar, label }); return root;
    });
    this.tabs.ranch = [{ label: 'Chăn nuôi', page: page(hint('Sản phẩm của trại', 'Người làm việc trong trại nuôi thú, và mỗi sản phẩm tự đến theo thời gian, không cần đặt đơn. Càng đông người, càng giỏi (Nhanh nhẹn) và cấp trại càng cao thì càng nhanh. Cấp cao mở thêm sản phẩm. Sản phẩm vào kho, tối đa theo sức chứa. Cần có người làm việc trong trại (nút Nhân sự).'), ...ranchList) }];
    this.war = new WarPanel(c);
    this.warLog = new WarLogPane(c);
    this.tribes = new TribesPane(c);
    this.simpleWar = new SimpleWar(c);
    this.tabs.wartent = [{ label: 'Họp chiến', page: page(this.warHost) }, { label: 'Nhật ký trận', page: page(this.warLog.root) }]; // the stone age: a list of the villages found and a button Đánh (no plan)
    this.scoutPane = new ScoutPane(c);
    this.marchPane = new MarchPane(c);
    this.tabs.drill = [{ label: 'Hành quân', page: page(this.marchPane.root) }];
    this.tabs.scouttent = [{ label: 'Trinh sát', page: page(this.scoutPane.roster) }, { label: 'Làng đã phát hiện', page: page(this.scoutPane.villages) }];
    this.towerPane = new TowerPane(c);
    this.tabs.tower = [{ label: 'Lính chòi canh', page: page(this.towerPane.root) }];
    this.gatePane = new GatePane(c);
    this.tabs.fence = []; this.tabs.gate = [{ label: 'Lính gác cổng', page: page(this.gatePane.root) }];
    this.tabs.builder = [{ label: 'Thợ xây', page: page(this.staffBoxes.build.root) }];
    this.tabs.campfire = [
      { label: 'Dân', page: page(h('div', { class: 'btns' }, this.doorBtn), this.people.root) },
      { label: 'Bộ tộc', page: page(this.tribes.root) }, // the villages met: gifts, tribute, taking them in
    ];

    // storage: stock against capacity, and trading goods for money
    const stockRows: HTMLElement[] = [];
    for (const res of RES_LIST) {
      const num = h('b'), bar = h('b');
      const row = h('div', { class: 'row' }, h('div', { class: 'nm' }, resIcon(res), RES_NAME[res], h('small', {}, num)), h('div', { class: 'bars', style: 'width:90px;display:block' }, h('i', {}, bar)));
      this.resRows.push({ res, num, bar, row }); stockRows.push(row);
    }
    this.tabs.storage = [{ label: 'Tài nguyên', page: page(...stockRows) }];
    this.tabs.market = [{ label: 'Giao thương', page: page(market()) }];
    // the processing houses: the order at work with its bar above the tabs, and a forge bench (recipes, slots in and out, queue) in the tab
    for (const k of ['smelter', 'carpentry', 'tannery'] as const) {
      this.forges[k] = new ForgePane(c, k);
      this.progSec[k] = h('div', {}, h('h3', { text: k === 'smelter' ? 'Đang luyện' : k === 'carpentry' ? 'Đang làm' : 'Đang thuộc, dệt' }), this.forges[k].active);
      this.tabs[k] = [{ label: 'Chế biến', page: page(hint('Chế biến theo công thức', 'Chọn một công thức ở bên trái, rồi thêm 1, 5 hoặc tối đa đơn vào hàng đợi. Nguyên liệu trừ ngay khi thêm vào hàng đợi (ô đỏ là đang thiếu), hủy đơn thì được trả lại. Cần có người làm việc trong nhà (nút Nhân sự) thì đơn mới chạy; nâng cấp nhà để mở thêm công thức và làm nhanh hơn. Sản phẩm vào kho vật liệu.'), this.forges[k].root) }];
    }

    // craft house: what is being made, then the grid of what can be ordered (tools, weapons, armour) with filters; a card opens a scroll
    const recipeItem = (r: typeof RECIPES[number]): OrderItem => ({
      id: r.id, name: recipeName(r), use: recipeUse(r), stats: recipeStats(r), get cost() { return sim.craftCost(r.id); }, time: r.time, icon: () => iconCanvas(sprites.icons[r.id]),
      tags: [r.kind, ...(r.kind in WEAPONS ? [WEAPONS[r.kind].ranged ? 'ranged' : 'melee'] : r.kind in ARMORS ? ['armor'] : ['tool'])],
      lock: () => sim.recipeLock(r.id), full: () => sim.craftStoreBlock(r.id), stored: () => sim.toolCount(r.kind, r.tier), queued: () => sim.craftQueue.filter((id) => id === r.id).length,
      add: () => sim.queueCraft(r.id), cancel: () => sim.unqueueCraft(r.id),
    });
    this.craftGrid = new OrderGrid(c, RECIPES.map(recipeItem), [
      { key: 'axe', label: 'Rìu' }, { key: 'pick', label: 'Cuốc chim' }, { key: 'hoe', label: 'Cuốc' }, { key: 'hammer', label: 'Búa' }, { key: 'torch', label: 'Đuốc' },
      { key: 'melee', label: 'Cận chiến' }, { key: 'ranged', label: 'Tầm xa' }, { key: 'armor', label: 'Giáp' },
    ]);
    this.progSec.workshop = h('div', {}, h('h3', { text: 'Đang chế tạo' }), this.activeBoxes.craft.root, this.queueNote.craft);
    this.tabs.workshop = [
      { label: 'Chế tạo', page: page(hint('Chế tạo', 'Chạm vào một món để xem giá và thêm vào hàng đợi. Chỉ chế được món đủ cấp Nhà chế tạo. Vật liệu trừ ngay khi thêm vào hàng đợi, hủy đơn thì được trả lại. Sản phẩm vào Kho công cụ hoặc Kho vũ khí.'), this.craftGrid.root) },
    ];

    // research house: who works and what is under way stay at the top; the tabs are pictures laid out as a tree (Quân sự, Xây dựng, Kinh tế on one level, Vũ khí under Quân sự)
    this.progSec.lab = h('div', {}, hint('Đang nghiên cứu', 'Mỗi lần chỉ nghiên cứu một thứ. Bấm nghiên cứu là trả ngay vật liệu và tiền (hủy đơn thì được trả lại). Cần rất nhiều thời gian: càng nhiều người làm trong nhà càng nhanh.'), this.activeBoxes.research.root, this.queueNote.research);
    this.research = new ResearchPane(c);
    // the research house is one pane (doc/cơ chế nghiên cứu/research-ui.html): the three pillars as tabs, their branches, the path of a branch and a bar to confirm
    this.tabs.lab = [{ label: 'Nghiên cứu', page: page(this.research.root) }];

    // tool store and armoury: what is kept
    const goods = page(this.goodsHint, this.goodsBar);
    const goodsRows = (cat: 'tool' | 'gear') => RECIPES.filter((r) => (cat === 'gear') === isGearKind(r.kind));
    for (const r of [...goodsRows('tool'), ...goodsRows('gear')]) {
      // throw some out to make room: one at a time, or all of that kind (the second press confirms)
      const num = h('b'), drop = h('button', { class: 'sm', text: '−', title: 'Bỏ một món (món đã mòn bỏ trước)', onclick: () => { const e = sim.discardGoods(r.id, false); if (e) c.toast(e); ctl.onChange(); } }) as HTMLButtonElement;
      let armed = 0;
      const dropAll = h('button', { class: 'sm danger', text: 'Bỏ hết', title: 'Bỏ tất cả món này khỏi kho', onclick: () => {
        if (!armed) { armed = window.setTimeout(() => { armed = 0; dropAll.textContent = 'Bỏ hết'; dropAll.classList.remove('armed'); }, 3000); dropAll.textContent = 'Chắc chứ?'; dropAll.classList.add('armed'); return; }
        window.clearTimeout(armed); armed = 0; dropAll.textContent = 'Bỏ hết'; dropAll.classList.remove('armed');
        const e = sim.discardGoods(r.id, true); if (e) c.toast(e); ctl.onChange();
      } }) as HTMLButtonElement;
      const row = h('div', { class: 'rec' }, iconCanvas(sprites.icons[r.id]), h('div', { class: 'nm' }, recipeName(r), h('small', { text: recipeUse(r) })), h('div', { class: 'qty' }, num, drop, dropAll));
      this.goodRows.push({ id: r.id, num, row, drop, dropAll }); goods.append(row);
    }
    this.tabs.toolstore = this.tabs.armory = [{ label: 'Kho', page: goods }];

    // the stable: the order under way is at the top; here the keepers and the beasts that can be tamed, one card each (a beast needs its research and a high enough stable)
    const beasts = page(hint('Thú có thể thuần', 'Dân làm việc trong chuồng thuần hóa từng con thú theo đơn: tốn lương thực, da và tiền, mất nhiều thời gian (càng đông và càng nhanh nhẹn càng nhanh). Con xong vào chuồng; giao cho từng người ở thẻ "Giao việc và chi tiết" của họ (lính, thợ săn, trinh sát), mục Thú cưỡi. Mỗi loài cần chuồng đủ cấp, khôn ngoan hơn và nghiên cứu riêng. Chạm vào một con để xem giá và thêm vào hàng đợi.'));
    this.progSec.stable = h('div', {}, h('h3', { text: 'Đang thuần' }), this.activeBoxes.tame.root, this.mountNote);
    this.tameGrid = new OrderGrid(c, MOUNT_KINDS.map((k): OrderItem => {
      const d = MOUNTS[k];
      return {
        id: k, name: d.name, use: `Thú cưỡi: đi nhanh ×${d.speed}, đỡ ${Math.round((1 - d.guard) * 100)}% đòn.`, cost: d.cost, time: d.time, tags: [], icon: () => iconCanvas(sprites.mount(d.species, false, 0, 1)),
        lock: () => sim.tameLock(k), full: () => null, stored: () => sim.tamedCount(k), queued: () => sim.tameQueue.filter((x) => x === k).length,
        add: () => sim.queueTame(k), cancel: () => sim.unqueueTame(k),
      };
    }));
    beasts.append(this.tameGrid.root);
    this.tabs.stable = [{ label: 'Thuần thú', page: beasts }];

    this.progress.append(...Object.values(this.progSec));
    this.topbar.append(this.labHead, this.tabBar);
    this.mbody.append(this.progress, this.topbar, ...this.pages, this.sub);
    // the panel of a building is a dialog like the others: the head with the picture of the house, then the body that scrolls
    const head = dlg.head({ pic: '🏠', title: '—', sub: '—', onClose: () => ctl.closePanel() });
    this.title = head.querySelector('.dtitle') as HTMLElement; this.state = head.querySelector('.dsub') as HTMLElement; this.picBox = head.querySelector('.dpic') as HTMLElement;
    // the ? beside the title opens what the building is; the campfire's meal sits under it
    const who = head.querySelector('.dwho') as HTMLElement;
    who.replaceChildren(h('div', { class: 'hint' }, h('div', { class: 'hinthead' }, this.title, helpButton()), this.info), this.state, this.foodHint, this.peopleBtn);
    this.win = new GameDialog(root, { keep: true, onClose: () => ctl.closePanel(), canClose: () => !this.war.mapOpen && !this.marchPane.mapOpen });
    root.append(dlg.card({ wide: true, cls: 'gbuild', label: 'Công trình' }, head, this.mbody));
  }

  /** Open the campfire on its tribes: a tribe has come to ask for mercy. */
  openTribes(): void {
    const fire = this.c.sim.campfire();
    if (!fire) return;
    this.tabAt.campfire = Math.max(0, this.tabs.campfire.findIndex((t) => t.label === 'Bộ tộc'));
    this.c.ctl.selectBuilding(fire.id, true);
  }

  /** Show the tab buttons of the building and the page of the chosen one. */
  private showTabs(kind: BuildingKind, ready: boolean): void {
    const tabs = ready ? this.tabs[kind] ?? [] : [];
    const locks = tabs.map((t) => t.lock?.() ?? null), shown = tabs.map((t) => !t.hidden && (t.show?.() ?? true)), ids = tabs.map((_, i) => i).filter((i) => shown[i]);
    const key = `${kind}:${tabs.length}:${locks.map((l) => (l ? 1 : 0)).join('')}:${shown.map((x) => (x ? 1 : 0)).join('')}`;
    this.labHead.hidden = !(kind === 'lab' && ready);
    this.mbody.classList.toggle('labbody', kind === 'lab' && ready); // the research pane fills what is left of the window
    for (const [k, el] of Object.entries(this.progSec)) el.hidden = !(ready && k === kind);
    this.progress.hidden = !ready || !this.progSec[kind];
    if (key !== this.tabKey) {
      this.tabKey = key;
      const pictures = tabs.some((t) => t.icon);
      /** The last tab of the top level that is shown: the line that joins the top level stops there. */
      const lastTop = tabs.reduce((at, t, i) => (shown[i] && t.under === undefined ? i : at), -1);
      this.topbar.classList.toggle('inline', !pictures);
      this.tabBar.classList.toggle('icontabs', pictures); this.tabBar.classList.toggle('treetabs', pictures && kind === 'lab');
      this.tabBar.replaceChildren(...tabs.map((t, i) => {
        if (!shown[i]) return null;
        const go = () => { if (locks[i]) { this.c.toast(locks[i]!); return; } this.tabAt[kind] = i; if (kind === 'lab') this.labSub = i; this.showTabs(kind, true); };
        if (!pictures) return h('button', { class: 'sm', text: t.label, role: 'tab', onclick: go });
        let pic: HTMLElement;
        try { pic = h('span', { class: 'tpic' }, iconCanvas(this.c.sprites.building(t.icon ?? kind, this.c.sim.era, 1, 4).frames[0])); } catch { pic = h('span', { class: 'tpic', text: '?' }); }
        // a tab "under" another sits in that column, one row lower for each tab already under it that is shown (hidden tabs take no row)
        const rank = t.under !== undefined ? tabs.slice(0, i).filter((o, j) => o.under === t.under && shown[j]).length : 0;
        return h('button', { class: `tabcard${locks[i] ? ' locked' : ''}${t.under !== undefined ? ' under' : ''}${i === lastTop ? ' tail' : ''}`, style: t.under !== undefined ? `grid-column:${t.under + 1};grid-row:${2 + rank}` : undefined, role: 'tab', title: locks[i] ?? t.label, onclick: go }, pic, h('span', { text: t.label }), locks[i] ? h('span', { class: 'tlock', text: '🔒' }) : null);
      }).filter((el): el is HTMLButtonElement => !!el));
    }
    const staff = STAFF_OF[kind as keyof typeof STAFF_OF];
    if (staff && ready && this.peopleOpen) { // the people of the house over its page, with a way back
      const root = this.staffBoxes[staff].root;
      this.sub.hidden = false; this.tabBar.hidden = true; this.mbody.classList.add('subopen');
      for (const p of this.pages) p.hidden = true;
      this.subTitle.textContent = 'Nhân sự';
      if (this.subBody.firstChild !== root) { this.subBody.replaceChildren(root); this.mbody.scrollTop = 0; }
      return;
    }
    if (kind === 'lab' && ready && tabs.length > 1) {
      // a tab of the research house opens a panel over this one, with a way back
      const open = this.labSub !== null && !locks[this.labSub] && (shown[this.labSub] || tabs[this.labSub]?.hidden) ? this.labSub : null;
      this.sub.hidden = open === null; this.tabBar.hidden = false;
      // with a tab open the panel under it must not scroll: the tab scrolls by itself
      this.mbody.classList.toggle('subopen', open !== null); if (open !== null) this.mbody.scrollTop = 0;
      for (const p of this.pages) p.hidden = open === null || tabs[open].page !== p;
      if (open !== null) {
        this.subTitle.textContent = tabs[open].label;
        if (this.subBody.firstChild !== tabs[open].page) this.subBody.replaceChildren(tabs[open].page);
      }
      [...this.tabBar.children].forEach((el, i) => el.setAttribute('aria-pressed', String(ids[i] === open)));
      return;
    }
    this.sub.hidden = true; this.mbody.classList.remove('subopen');
    let at = Math.min(this.tabAt[kind] ?? 0, Math.max(0, tabs.length - 1));
    if (locks[at]) at = Math.max(0, locks.findIndex((l) => !l));
    this.tabBar.hidden = tabs.length < 2;
    this.mbody.classList.toggle('fit', kind === 'campfire' && at === 0); // the people of the campfire fit the dialog, no scrolling
    [...this.tabBar.children].forEach((el, i) => el.setAttribute('aria-pressed', String(ids[i] === at)));
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
      case 'infantry': case 'cavalry': case 'archery': case 'guardpost': return `Cấp ${b.level}: chứa ${lv.slots} người, mỗi người một giường · lính hồi sức nhanh hơn dân ${Math.round((REST.soldierRest - 1) * 100)}%, hồi máu nhanh hơn ${Math.round((REST.soldierHealInCamp - 1) * 100)}% khi ở trong trại`;
      case 'house': return `Cấp ${b.level}: ${lv.slots} giường cho dân rảnh, làng chứa thêm ${lv.slots} dân · hồi sức như nhau ở mọi nơi ngủ`;
      case 'field': return `Cấp ${b.level}: ${lv.slots} nông dân làm một lúc · năng suất ×${lv.craftSpeed.toLocaleString('vi')} (cuốc đá làm nhanh hơn)`;
      case 'builder': return `Cấp ${b.level}: chứa ${lv.slots} thợ xây · xây nhanh ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'workshop': return `Cấp ${b.level}: chứa ${lv.slots} người chế tạo · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'lab': return `Cấp ${b.level}: chứa ${lv.slots} nhà nghiên cứu · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;

      case 'ranch': return `Cấp ${b.level}: chứa ${lv.slots} người chăn nuôi · tự cho ${productsAt(b.level).map((p) => RES_NAME[p.res].toLowerCase()).join(', ')} · tốc độ ×${lv.craftSpeed.toLocaleString('vi')} · mỗi sản phẩm có kho riêng ${lv.cap} · nâng cấp để thêm người và thêm sản phẩm`;
      case 'stable': return `Cấp ${b.level}: chứa ${lv.slots} người thuần thú · tốc độ ×${lv.craftSpeed.toLocaleString('vi')} · thuần được ${MOUNT_KINDS.filter((k) => MOUNTS[k].tier <= b.level).map((k) => MOUNTS[k].name.toLowerCase()).join(', ')}`;
      case 'wartent': if (this.c.sim.era !== 'ancient') return 'Chọn làng đã phát hiện để đưa toàn quân đi đánh'; return `Cấp ${b.level}: tối đa ${this.c.sim.squadLimit()} đội, ${this.c.sim.cardLimit()} thẻ lệnh cho một kế hoạch · vào lều là game tạm dừng`;
      case 'huntlodge': return `Cấp ${b.level}: giao việc cho tối đa ${lv.slots} thợ săn, săn trong ${huntRange(this.c.sim)} ô quanh chòi · có kho riêng ${lv.cap} thức ăn · nâng cấp để chứa thêm và săn xa hơn`;
      case 'mine': return `Cấp ${b.level}: giao việc cho tối đa ${lv.slots} thợ mỏ · mỗi loại quặng và than có kho riêng ${lv.cap} · nâng cấp để thêm người và chứa thêm · mạch quặng nằm ở chân núi`;
      case 'farmhouse': case 'lumberyard': case 'quarry': return `Cấp ${b.level}: giao việc cho tối đa ${lv.slots} người · có kho riêng ${lv.cap} ${RES_NAME[BUILDINGS[b.kind].produces![0]].toLowerCase()}, cộng vào sức chứa của làng · nâng cấp để chứa thêm`;
      case 'scouttent': return `Cấp ${b.level}: cử tối đa ${lv.slots} trinh sát một chuyến · tab Làng đã phát hiện để chọn làng và người đi`;
      case 'market': { const t = MARKET.levels[Math.min(MARKET.levels.length, b.level) - 1]; return `Cấp ${b.level}: bán và đổi hàng · tỉ lệ ×${t.rate.toLocaleString('vi')} · phí đổi hàng ${Math.round(t.fee * 100)}% · mỗi ngày nhận ${t.quotaMin} đến ${t.quotaMax} vỏ giá trị mỗi loại hàng ở giá gốc`; }
      case 'storage': return `Sức chứa ${lv.cap} mỗi loại`;
      case 'toolstore': case 'armory': return `Chứa tối đa ${lv.cap} món`;
      case 'smelter': case 'carpentry': case 'tannery': return `Cấp ${b.level}: chứa ${lv.slots} người làm việc · tốc độ ×${lv.craftSpeed.toLocaleString('vi')} · cấp cao mở thêm công thức`;
      default: return `Nơi dân rảnh ngủ quanh lửa · chứa ${lv.cap} mỗi loại · làng tối đa ${this.c.sim.popCap()} dân (lửa trại ${POP_BY_FIRE[Math.min(POP_BY_FIRE.length, b.level) - 1]} + Nhà dân ${this.c.sim.bedsIn('house')}) · các nhà khác lên được cấp ${levelCapByFire(b.level)}`;
    }
  }

  update(): void {
    const { sim, ctl } = this.c, b = this.current();
    this.root.hidden = !b || !ctl.buildingOpen;
    if (this.root.hidden) { this.craftGrid.close(); this.tameGrid.close(); }
    const inTent = this.c.sim.era === 'ancient' && !!b && ctl.buildingOpen && b.kind === 'wartent' && b.done; // the plan of the medieval era opens the game paused, as a war council does
    if (inTent && !this.inTent) { this.resume = sim.speed; sim.speed = 0; }
    else if (!inTent && this.inTent) { if (this.resume > 0 && sim.speed === 0) sim.speed = this.resume; this.resume = 0; }
    this.inTent = inTent;
    if (!inTent && this.war.mapOpen) this.war.closeMap(); // the map of a plan hangs on the tent: without the tent it goes too
    if (this.marchPane.mapOpen && b?.kind !== 'drill') this.marchPane.close(); // the map of the march hangs on the Bãi tập: without it the map goes too
    if (!b) { if (ctl.selectedBuilding !== null) ctl.selectedBuilding = null; return; }
    if (!ctl.buildingOpen) { this.peopleOpen = false; this.peopleFor = null; return; }
    if (this.peopleFor !== b.id) { this.peopleFor = b.id; this.peopleOpen = false; } // another house: its page first
    if (ctl.openPeople) { ctl.openPeople = false; this.peopleOpen = !!STAFF_OF[b.kind as keyof typeof STAFF_OF] && b.done; }
    if (b.kind !== 'lab') this.labSub = null;
    const def = BUILDINGS[b.kind], lv = levelDef(b), fire0 = sim.campfire(), top = b.kind === 'campfire' || !fire0 || sim.dev.freeBuild ? topLevel(b) : Math.min(topLevel(b), levelCapByFire(fire0.level)), ready = b.done;
    this.title.textContent = `${buildingName(b.kind, b.era, b.level)}${def.buildable ? ` · cấp ${b.level}/${top} (${lv.name.toLowerCase()})` : ''}`;
    const pk = `${b.kind}${b.level}${b.done}`;
    if (pk !== this.picKey) { this.picKey = pk; try { this.picBox.replaceChildren(iconCanvas(this.c.sprites.building(b.kind, b.era, Math.max(1, b.level), 4).frames[0])); } catch { this.picBox.textContent = '🏠'; this.picBox.className = 'dpic glyph'; } }
    const meal = b.kind === 'campfire' && b.done && !b.upgrading;
    this.state.textContent = !b.done ? `đang xây ${Math.floor(b.progress * 100)}%${sim.buildWhy(b) ? ` · ${sim.buildWhy(b)}` : ''}` : b.upgrading ? `đang nâng cấp ${Math.floor(b.progress * 100)}%${sim.buildWhy(b) ? ` · ${sim.buildWhy(b)}` : ''}` : 'đang dùng';
    this.state.hidden = meal; this.foodHint.hidden = !meal;
    this.showTabs(b.kind, ready);
    this.updatePeopleButton(b, ready);
    this.info.textContent = !b.done ? 'Giao dân làm Thợ xây để dựng công trình này.' : this.infoText(b);
    if (b.kind === 'campfire' && ready) this.updateCampfire();
    if (b.kind === 'storage' && ready) for (const r of this.resRows) { r.row.hidden = ANIMAL_MATERIALS.includes(r.res) && sim.stock[r.res] < 1; r.num.textContent = `${Math.floor(sim.stock[r.res])} / ${sim.capacity(r.res)}`; r.bar.style.width = `${Math.min(100, (sim.stock[r.res] / Math.max(1, sim.capacity(r.res))) * 100)}%`; }
    if (b.kind === 'market' && ready) this.updateMarket();
    if (ready && isProcessKind(b.kind)) this.updateProcess(b, b.kind as 'smelter' | 'carpentry' | 'tannery');
    if (this.bedList[b.kind] && ready) this.updateBeds(b);
    if (this.rolePanes[b.kind] && ready) this.rolePanes[b.kind]!.update();
    if (b.kind === 'field' && ready) { this.staffBoxes.farm.update(b); this.updateCrop(b); }
    if (b.kind === 'ranch' && ready) this.updateRanch(b);
    if (b.kind === 'builder' && ready) this.staffBoxes.build.update(b);
    if (b.kind === 'tower' && ready) this.towerPane.update(b);
    if (b.kind === 'gate' && ready) this.gatePane.update(b);
    if (b.kind === 'wartent' && ready) {
      const plan = this.c.sim.era === 'ancient', want = plan ? this.war.root : this.simpleWar.root;
      if (this.warHost.firstChild !== want) this.warHost.replaceChildren(want);
      if (plan) this.war.update(); else this.simpleWar.update();
      this.warLog.update();
    }
    if (b.kind === 'campfire' && ready) this.tribes.update();
    if (b.kind === 'scouttent' && ready) this.scoutPane.update();
    if (b.kind === 'drill' && ready) this.marchPane.update();
    if (b.kind === 'workshop' && ready) this.updateWorkshop(b);
    if (b.kind === 'lab' && ready) this.updateLab(b);
    if (b.kind === 'stable' && ready) this.updateStable(b);
    if (b.kind === 'toolstore' || b.kind === 'armory') if (ready) this.updateGoods(b);
  }

  /** Draw the Chợ again: the swaps that are open (the rows are made again when research opens one), and for each row the price now, how many steps can be had at most, and what the steps wanted would cost and give. */
  private updateMarket(): void {
    const { sim } = this.c, lv = sim.marketLevel(), coin = RES_NAME.coin.toLowerCase();
    const t = MARKET.levels[Math.max(1, lv) - 1];
    this.marketHead.textContent = lv < 1 ? 'Chưa có Chợ.' : `Chợ cấp ${lv}: tỉ lệ ×${t.rate.toLocaleString('vi')} · phí đổi hàng ${Math.round(t.fee * 100)}% · mỗi ngày nhận ${t.quotaMin} đến ${t.quotaMax} vỏ giá trị mỗi loại ở giá gốc (hôm nay mỗi loại một con số khác nhau).${sim.market.bargain ? (sim.market.bargain.good === '*' ? ` Đoàn thương nhân đang ở chợ: thu mua mọi hàng giá cao hơn ${sim.market.bargain.pct}%.` : ` Món hời hôm nay: ${sim.market.bargain.kind === 'sell' ? 'thu mua' : 'bán'} ${RES_NAME[sim.market.bargain.good as Res].toLowerCase()} ${sim.market.bargain.kind === 'sell' ? 'giá cao hơn' : 'rẻ hơn'} ${sim.market.bargain.pct}%.`) : ''}`;
    const routes = sim.marketRoutes(), key = routes.map((r) => `${r.give}>${r.get}`).join();
    if (key !== this.swapKey) {
      this.swapKey = key;
      this.swapRows = routes.map((r) => this.marketMake!(r.give, r.get));
      this.swapBox.replaceChildren(...(this.swapRows.length ? this.swapRows.map((r) => r.row) : [h('p', { class: 'sub', text: 'Chưa có tuyến đổi hàng nào: nghiên cứu nhánh Kinh tế (Sinh kế) để mở thêm.' })]));
    }
    for (const r of this.buyRows) { // buying: a shell a step, dearer than selling
      const good = RES_NAME[r.get].toLowerCase();
      r.row.hidden = !sim.marketTradable(r.get);
      if (r.row.hidden) continue;
      const tm = sim.marketBuyTerms(r.get as Exclude<Res, 'coin'>), per = Math.floor(tm.per) === tm.per ? String(tm.per) : tm.per.toLocaleString('vi', { maximumFractionDigits: 1 });
      r.price.textContent = `1 ${coin} = ${per} ${good}${tm.left > 0 ? ` · còn ${tm.left} lượt giá gốc hôm nay` : ' · hết lượt giá gốc hôm nay'}${sim.market.bargain?.kind === 'buy' && sim.market.bargain.good === r.get ? ' · MÓN HỜI' : ''}`;
      r.price.className = `bpill${tm.left > 0 ? '' : ' bad'}`;
      const max = sim.marketQuote('coin', r.get, Infinity, 0);
      r.n = Math.max(0, Math.min(r.n, max.steps));
      if (document.activeElement !== r.input) r.input.value = r.n ? String(r.n) : '';
      r.input.max = String(max.steps); r.input.placeholder = max.steps ? `0–${max.steps}` : '0'; r.input.disabled = max.steps < 1;
      r.slider.max = String(max.steps); r.slider.value = String(r.n); r.slider.disabled = max.steps < 1;
      const q = sim.marketQuote('coin', r.get, r.n, 0);
      r.quote.className = `bquote${q.steps > 0 && q.last < q.first * 0.6 ? ' bad' : q.steps > 0 && q.last < q.first ? ' warn' : ''}`;
      r.quote.textContent = max.steps < 1 ? (max.why ?? 'Không mua được') : q.steps < 1 ? `Mua tối đa ${max.steps} ${coin}` : `Trả ${q.give} ${coin} → nhận ${q.get} ${good}${q.last < q.first ? ' · giá tăng dần trong lượt này' : ''}`;
      r.go.disabled = q.steps < 1;
      r.go.textContent = q.steps > 0 ? `Mua ${q.get} ${good}` : 'Mua';
    }
    for (const r of [...this.sellRows, ...this.swapRows]) {
      const sell = r.get === 'coin', give = RES_NAME[r.give].toLowerCase(), got = sell ? coin : RES_NAME[r.get].toLowerCase();
      r.row.hidden = !sim.marketTradable(r.give);
      if (r.row.hidden) continue;
      const g = r.give as Exclude<Res, 'coin'>, keep = this.marketKeepOn ? sim.marketKeep(g) : 0, tm = sim.marketTerms(g, r.get as Exclude<Res, 'coin'> | 'coin');
      const perText = sell ? `1 ${coin}` : `${Math.floor(tm.per) === tm.per ? tm.per : tm.per.toLocaleString('vi', { maximumFractionDigits: 1 })} ${got}`;
      r.price.textContent = `${tm.price} ${give} = ${perText}${tm.left > 0 ? ` · còn ${tm.left} lượt giá gốc hôm nay` : ' · hết lượt giá gốc hôm nay'}${sim.market.bargain?.kind === 'sell' && (sim.market.bargain.good === r.give || sim.market.bargain.good === '*') ? ' · MÓN HỜI' : ''}`;
      r.price.className = `bpill${tm.left > 0 ? '' : ' bad'}`;
      r.price.title = tm.left > 0 ? 'Mỗi lượt là giá trị một vỏ sò. Hết lượt giá gốc thì mỗi lượt đắt hơn.' : 'Chợ hôm nay không còn nhận thêm hàng này ở giá gốc: mỗi lượt đắt hơn lượt trước';
      const max = sim.marketQuote(r.give, r.get, Infinity, keep);
      r.n = Math.max(0, Math.min(r.n, max.steps));
      if (document.activeElement !== r.input) r.input.value = r.n ? String(r.n) : '';
      r.input.max = String(max.steps); r.input.placeholder = max.steps ? `0–${max.steps}` : '0'; r.input.disabled = max.steps < 1;
      r.slider.max = String(max.steps); r.slider.value = String(r.n); r.slider.disabled = max.steps < 1;
      const q = sim.marketQuote(r.give, r.get, r.n, keep), dearer = q.steps > 0 && q.last > q.first;
      r.quote.className = `bquote${dearer && q.last >= q.first * 1.6 ? ' bad' : dearer ? ' warn' : ''}`;
      r.quote.textContent = max.steps < 1 ? (max.why ?? 'Không đổi được') : q.steps < 1 ? `Đổi tối đa ${max.steps} lượt (cần ${max.first} ${give} cho lượt đầu)` : `Đưa ${q.give} ${give} → nhận ${q.get} ${got}${dearer ? ` · giá tăng từ ${q.first} lên ${q.last} ${give} mỗi lượt` : ` · ${q.first} ${give} mỗi lượt`}`;
      r.go.disabled = q.steps < 1;
      r.go.textContent = q.steps > 0 ? `Đổi ${q.get} ${got}` : 'Đổi';
    }
  }

  /** The button "Nhân sự 2/4" in the head of the dialog: it opens the people of the house over its page. */
  private updatePeopleButton(b: Building, ready: boolean): void {
    const staff = STAFF_OF[b.kind as keyof typeof STAFF_OF];
    this.peopleBtn.hidden = !staff || !ready;
    if (!staff || !ready) return;
    const n = this.c.sim.staffCount(b), slots = this.c.sim.slotsOf(b);
    this.peopleBtn.replaceChildren(icon('people', 15), `Nhân sự ${n}/${slots}`);
    this.peopleBtn.classList.toggle('on', this.peopleOpen);
    this.peopleBtn.title = n < slots ? 'Còn chỗ trống: bấm để thêm người' : 'Thêm hoặc cho nghỉ người làm việc';
    this.peopleBtn.onclick = () => { this.peopleOpen = true; this.update(); };
  }

  private updateProcess(b: Building, kind: 'smelter' | 'carpentry' | 'tannery'): void {
    this.staffBoxes.craft.update(b); this.forges[kind].update(b);
  }

  private updateWorkshop(b: Building): void {
    const { sim } = this.c;
    this.staffBoxes.craft.update(b); this.activeBoxes.craft.update(b);
    this.queueNote.craft.textContent = `Hàng đợi ${sim.craftQueue.length}: ${sim.craftQueue.map((id) => recipeName(RECIPE_BY_ID[id]).toLowerCase()).join(', ') || 'trống'} · Kho công cụ ${sim.storeUsed('tool')}/${sim.storeCap('tool')} · Kho vũ khí ${sim.storeUsed('gear')}/${sim.storeCap('gear')}`;
    this.craftGrid.update();
  }

  private updateLab(b: Building): void {
    const { sim } = this.c;
    this.staffBoxes.research.update(b); this.activeBoxes.research.update(b);
    const waiting = sim.researchQueue[0];
    this.queueNote.research.textContent = `${waiting ? `Chờ bắt đầu: ${TECH_BY_ID[waiting]?.name ?? waiting}` : 'Mỗi lần chỉ nghiên cứu một thứ'}`;
    this.research.update();
  }

  /** The two buttons that say what a field is sown with; flax is for the medieval age. */
  private updateCrop(b: Building): void {
    const { sim, ctl, toast } = this.c, crop = b.crop ?? 'food', medieval = sim.era === 'ancient';
    const key = `${b.id}|${crop}|${medieval}`;
    if (key === this.cropKey) return;
    this.cropKey = key;
    const pick = (want: 'food' | 'flax', text: string, title: string) => h('button', { class: 'sm', type: 'button', text, title, pressed: crop === want, disabled: want === 'flax' && !medieval, onclick: () => { const e = sim.setCrop(b.id, want); if (e) toast(e); ctl.onChange(); } });
    this.cropBox.replaceChildren(h('b', { text: 'Gieo trồng' }), h('div', { class: 'btns' }, pick('food', 'Thức ăn', 'Trồng cây lương thực: thức ăn về kho'), pick('flax', 'Lanh (sợi)', medieval ? 'Trồng lanh: cho sợi, chậm hơn thức ăn, dùng để dệt vải' : 'Trồng lanh chỉ có từ thời Trung cổ')));
  }

  private updateRanch(b: Building): void {
    const { sim } = this.c, open = productsAt(b.level), working = sim.houseRate(b) > 0; // only those at their bench work: not the ones on the way, waiting for a way in, or asleep
    this.staffBoxes.herd.update(b);
    for (const r of this.ranchRows) {
      const on = open.includes(r.p), per = sim.ranchDaily(b, r.p), pct = on ? Math.floor(Math.min(1, b.grown?.[r.p.res] ?? 0) * 100) : 0;
      r.root.style.opacity = on ? '' : '.55';
      r.note.textContent = on ? `${working ? `~${per.toLocaleString('vi', { maximumFractionDigits: 1 })} mỗi ngày` : 'tạm dừng (không có người)'} · kho ${Math.floor(sim.stock[r.p.res])}/${sim.capacity(r.p.res)}` : `🔒 mở ở cấp ${r.p.level} của trại`;
      r.bar.style.width = `${pct}%`; r.label.textContent = on ? `${pct}%` : '';
    }
  }

  private updateStable(b: Building): void {
    const { sim } = this.c;
    this.staffBoxes.tame.update(b); this.activeBoxes.tame.update(b);
    this.mountNote.textContent = `Hàng đợi ${sim.tameQueue.length}: ${sim.tameQueue.map((k) => MOUNTS[k as MountKind]?.name.toLowerCase()).join(', ') || 'trống'} · trong chuồng: ${MOUNT_KINDS.map((k) => `${sim.tamedCount(k)} ${MOUNTS[k].name.toLowerCase()}`).join(', ')}`;
    this.tameGrid.update();
  }

  /** The filter over a list of tools or weapons: by kind, and "only what can be had now" (made, or makeable). */
  private filterBar(key: string, kinds: string[], into: HTMLElement = h('div', { class: 'btns filters' })): HTMLElement {
    const { ctl } = this.c, f = this.filters[key], pick = h('select', { class: 'sm', 'aria-label': 'Lọc theo loại', title: 'Lọc theo loại' }) as HTMLSelectElement;
    pick.append(h('option', { value: '', text: 'Mọi loại' }), ...kinds.map((k) => h('option', { value: k, text: kindLabel(k) })));
    pick.value = f.kind;
    pick.addEventListener('change', () => { f.kind = pick.value; ctl.onChange(); });
    const only = h('button', { class: 'sm', text: 'Chỉ món có thể dùng', title: 'Ẩn những món chưa đủ cấp nhà hoặc chưa có trong kho', pressed: f.only, onclick: () => { f.only = !f.only; only.setAttribute('aria-pressed', String(f.only)); ctl.onChange(); } });
    into.append(pick, only);
    return into;
  }

  private updateGoods(b: Building): void {
    const { sim } = this.c, cat = b.kind === 'toolstore' ? 'tool' : 'gear';
    this.goodsNote.textContent = `Đang chứa ${sim.storeUsed(cat)}/${sim.storeCap(cat)} món`;
    this.goodsHint.tip.textContent = 'Dân thiếu đồ hoặc đồ hỏng sẽ tự tới lấy.';
    const fkey = `store-${cat}`, f = this.filters[fkey];
    if (this.goodsBarCat !== cat) { // the bar of the store follows what the store keeps
      this.goodsBarCat = cat;
      const kinds = [...new Set(RECIPES.filter((r) => (cat === 'gear') === isGearKind(r.kind)).map((r) => r.kind))];
      this.goodsBar.replaceChildren(); this.filterBar(fkey, kinds, this.goodsBar);
    }
    for (const r of this.goodRows) {
      const rc = RECIPE_BY_ID[r.id], mine = (cat === 'gear') === isGearKind(rc.kind), n = sim.toolCount(rc.kind, rc.tier);
      r.row.hidden = !mine || (n === 0 && !!sim.recipeLock(r.id)) || (!!f.kind && rc.kind !== f.kind) || (f.only && n === 0); r.num.textContent = `× ${n}`; r.drop.disabled = r.dropAll.disabled = n === 0;
    }
  }

  private updateCampfire(): void {
    const { sim } = this.c, need = sim.foodNeed(), pen = sim.foodPenalty, level = sim.campfire()?.level ?? 1;
    this.people.update();
    this.doorBtn.textContent = sim.newcomersOpen ? 'Đang nhận dân mới: bấm để đóng cửa' : 'Đang đóng cửa: bấm để nhận dân mới';
    this.doorBtn.title = 'Mỗi ngày vài người lạ đến xin ở lại. Đóng cửa khi làng đã đủ việc làm và đủ ăn.';
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
  lumberyard: STAT_NAME[JOBS.wood.stat], ranch: STAT_NAME[JOBS.herd.stat], quarry: STAT_NAME[JOBS.stone.stat], mine: STAT_NAME[JOBS.mine.stat], farmhouse: STAT_NAME[JOBS.food.stat], field: STAT_NAME[JOBS.food.stat], huntlodge: STAT_NAME[JOBS.hunt.stat],
  builder: STAT_NAME[JOBS.build.stat], workshop: STAT_NAME[JOBS.craft.stat], lab: STAT_NAME[JOBS.research.stat], stable: STAT_NAME[JOBS.tame.stat],
  infantry: STAT_NAME.str, guardpost: STAT_NAME.str, cavalry: STAT_NAME.str, archery: STAT_NAME.agi, scouttent: `${STAT_NAME.agi}, ${STAT_NAME.sta}`, house: `${STAT_NAME.vit}, ${STAT_NAME.sta} (hồi sức nhanh)`,
};

const isGearKind = (k: string) => k in WEAPONS || k in ARMORS;
/** What a kind of tool, weapon or armour is called in the filters. */
const kindLabel = (k: string): string => (k in ARMORS ? ARMORS[k].name : k === 'torch' ? 'Đuốc' : k in WEAPONS ? WEAPONS[k].name : TOOL_NAME[k as ToolKind] ?? k);

