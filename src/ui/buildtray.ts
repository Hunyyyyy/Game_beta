import { BUILDINGS, BuildingKind, levelsOf } from '../sim/buildings';
import { RES_NAME } from '../sim/resources';
import { costText, h, iconCanvas } from './dom';
import type { Ctx } from './ctx';

/** What each house is for, shown when the card's ⓘ is tapped. */
const ROLE: Partial<Record<BuildingKind, string>> = {
builder: 'Dân làm thợ xây ở đây (do bạn chọn). Phải có nhà này mới dựng được các công trình khác.', storage: 'Cất tài nguyên.', lab: 'Nghiên cứu bản vẽ, quân sự và tự động hóa. Dân làm việc bên trong.',
workshop: 'Chế tạo công cụ, vũ khí, giáp theo bản vẽ. Dân làm việc bên trong.',
infantry: 'Trại của chiến binh cận chiến: tuyển và cho nghỉ ở đây, họ cũng ngủ ở đây và hồi sức nhanh hơn nằm cạnh đống lửa. Chỉ xây một cái; nâng cấp để chứa thêm người.',
cavalry: 'Trại của người cưỡi thú: xung phong nhanh, khắc người ném nhưng sợ giáo. Chỉ xây một cái; nâng cấp để chứa thêm người.',
guardpost: 'Trại lính gác: chọn lính của các trại cử đi gác. Mỗi lính gác có một chỗ gác riêng, nhìn xa hơn lính thường 5 ô, ra tay khi làng bị phá hoặc dân bị tấn công rồi quay về chỗ gác. Cấp 1, 2, 3 chứa 6, 12, 18 người.',
  archery: 'Trại của người ném đá, bắn ná: đánh từ xa, lên được chòi canh. Chỉ xây một cái; nâng cấp để chứa thêm người.',
farmhouse: 'Giao việc hái lượm ở đây: người được giao ra bụi quả và mang thức ăn về. Chỉ xây một cái; nâng cấp để thêm người.',
huntlodge: 'Giao việc săn bắn ở đây: người được giao đi săn thú. Chỉ xây một cái; nâng cấp để thêm người.',
lumberyard: 'Giao việc đốn gỗ ở đây. Chỉ xây một cái; nâng cấp để thêm người.',
quarry: 'Giao việc đục đá ở đây. Chỉ xây một cái; nâng cấp để thêm người.',
house: 'Dân thường ngủ ở đây (vào nhà, hiện thành danh sách) và hồi sức đầy đủ. Không có nhà hoặc hết giường thì dân ngủ cạnh đống lửa, hồi sức chậm hơn.',
field: 'Dân bạn chọn vào ruộng làm việc bên trong (không hiện trên bản đồ), thức ăn về thẳng kho, đều quanh năm hơn bụi quả (bụi quả không mọc lại). Mỗi ruộng một người, nâng cấp để làm nhanh hơn.',
wartent: 'Nơi lập đội, chọn trận pháp, lập kế hoạch và thẻ lệnh cho trận đánh. Cấp càng cao càng nhiều đội và thẻ lệnh.',
scouttent: 'Nơi cử trinh sát đi vẽ bản đồ làng khác. Cấp càng cao càng cử được nhiều người một chuyến.',
stable: 'Dân làm trong chuồng thuần hóa thú (sói, lợn rừng, voi) để giao cho người cưỡi, như giao công cụ: đi nhanh hơn, đỡ đòn hơn. Chỉ xây một cái; nâng cấp để thuần được thú lớn hơn.',
drill: 'Bãi tập: các đội luyện trận pháp ở đây, độ thuần thục tăng dần.',
trap: 'Hố chông gài sẵn: địch bước vào bị thương, mỗi hố làm bị thương vài người. Đặt từng cái một.',
fence: 'Chặn đường, tạo chỗ thắt: địch phải phá rào mới vào được. Đặt từng đoạn một, cứ chạm tiếp để đặt đoạn kế. Cấp 2 (hàng rào đôi) bền gấp ba. Số đoạn tối đa tăng theo Nhà chung.',
gate: 'Chỗ ra vào của hàng rào. Mở thì ai cũng qua được, đóng thì chặn tất cả kể cả dân mình. Chạm vào cổng để mở hoặc đóng.',
tower: 'Cung thủ đứng trên chòi bắn xa hơn và mạnh hơn. Chạm vào chòi để chọn cung thủ lên canh.',
toolstore: 'Cất công cụ cho dân tự lấy.', armory: 'Cất vũ khí và giáp cho dân tự lấy.',
  };

/** The build categories, in the order of the tabs. */
const GROUPS: Array<[string, BuildingKind[]]> = [
  ['Thiết yếu', ['builder', 'storage', 'house', 'field']],
  ['Sản xuất', ['workshop', 'lab', 'toolstore', 'armory']],
  ['Tài nguyên', ['farmhouse', 'huntlodge', 'lumberyard', 'quarry', 'stable']],
  ['Quân sự', ['infantry', 'cavalry', 'archery', 'guardpost', 'wartent', 'scouttent', 'drill']],
  ['Phòng thủ', ['fence', 'gate', 'tower', 'trap']],
];

/** The bottom tray of what can be built: category tabs and a row of cards with the building's picture; tap one to place it. */
export class BuildTray {
  private group = 0; private key = '';
  private readonly tabs = h('div', { class: 'tabs' }); private readonly cards = h('div', { class: 'cards' });
  private readonly refresh: Array<() => void> = [];
  constructor(private readonly root: HTMLElement, private readonly c: Ctx) {
    GROUPS.forEach(([name], i) => this.tabs.append(h('button', { class: 'sm', text: name, pressed: i === 0, onclick: () => { this.group = i; this.key = ''; this.update(); } })));
    root.append(h('div', { class: 'head' }, this.tabs, h('button', { class: 'sm', text: '✕', title: 'Đóng', onclick: () => this.close() })), this.cards);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  open(): void { this.root.hidden = false; this.key = ''; this.update(); }
  close(): void { this.root.hidden = true; }
  toggle(): void { if (this.isOpen) this.close(); else this.open(); }

  update(): void {
    if (!this.isOpen) return;
    const { sim, ctl, sprites } = this.c;
    [...this.tabs.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === this.group)));
    const key = `${this.group}|${sim.era}`;
    if (key !== this.key) {
      this.key = key; this.refresh.length = 0; this.cards.scrollLeft = 0;
      const kinds = GROUPS[this.group][1].filter((k) => BUILDINGS[k].buildable);
      this.cards.replaceChildren(...kinds.map((kind) => {
        const lv = { cost: sim.startCost(kind) }, d = BUILDINGS[kind]; // a fallen house is raised again at the level it had, and costs that
        let pic: HTMLElement;
        try { pic = iconCanvas(sprites.building(kind, sim.era, sim.startLevel(kind), 4).frames[0]); } catch { pic = h('span', { text: d.name[0] }); }
        const state = h('small', { class: 'state' }), card = h('button', { class: 'card2', onclick: () => { ctl.startPlacing(kind); this.close(); } },
          h('span', { class: 'pic' }, pic), h('b', { text: d.name }), h('small', { text: costText(lv.cost, RES_NAME) }), state) as HTMLButtonElement;
        const role = ROLE[kind];
        const info = h('span', { class: 'info', text: 'ⓘ', title: 'Công dụng', onclick: (e: Event) => { e.stopPropagation(); this.c.toast(`${d.name}: ${role ?? ''}`); } });
        if (role) card.append(info);
        this.refresh.push(() => {
          const lock = sim.buildingLock(kind), poor = !sim.dev.freeBuild && !(Object.keys(lv.cost) as Array<keyof typeof lv.cost>).every((k) => sim.stock[k as keyof typeof sim.stock] >= (lv.cost[k] ?? 0));
          const have = sim.buildings.filter((b) => b.kind === kind).length, limit = sim.buildingLimit(kind);
          card.disabled = !!lock || poor || have >= limit;
          // the count stands alone on the card; the reason it is shut is the tooltip
          state.textContent = `${have}/${limit}`;
          card.title = [role, lock ?? (poor ? 'Chưa đủ vật liệu' : '')].filter(Boolean).join(' — ');
        });
        return card;
      }));
    }
    this.refresh.forEach((f) => f());
  }
}
