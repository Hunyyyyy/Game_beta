import { BUILDINGS, levelDef } from '../sim/buildings';
import { DIFF, playerCap } from '../sim/difficulty';
import { relationLabel, WEAPONS, TribeId } from '../sim/combat';
import { SEASONS, Season, WEATHER, WeatherKind } from '../sim/calendar';
import { dayLength, gameDays, TILE } from '../sim/constants';
import * as dev from '../sim/dev';
import { StatKey, STAT_NAME } from '../sim/jobs';

import { RES_LIST, RES_NAME } from '../sim/resources';
import { TOOL_KINDS, TOOL_NAME, TIER_NAME } from '../sim/tools';
import { canAdopt, canTribute, giftOf, tributeSteps } from '../sim/tribes';

import { h, hint } from './dom';
import type { Ctx } from './panels';

type Tab = 'places' | 'dev' | 'help';
const TABS: Array<[Tab, string]> = [['places', 'Công trình'], ['dev', 'Dev'], ['help', '?']];
const SEASON_NAME: Record<Season, string> = { spring: 'Xuân', summer: 'Hạ', autumn: 'Thu', winter: 'Đông' };
const PERSONALITY = { peaceful: 'Hòa bình', aggressive: 'Hiếu chiến', ambusher: 'Hay phục kích' } as const;

/** The slide-in menu: what is built, the dev tools and the controls. (Saving and loading is in the settings window.) */
export class Menu {
  private tab: Tab = 'places';
  private readonly tabBtns = new Map<Tab, HTMLButtonElement>();
  private readonly pages = new Map<Tab, HTMLElement>();
  private readonly updaters: Array<() => void> = [];
  private placesKey = '';
  private readonly placesList = h('div');

  constructor(private readonly drawer: HTMLElement, tabs: HTMLElement, private readonly body: HTMLElement, private readonly c: Ctx, private readonly center: () => { x: number; y: number }) {
    for (const [t, label] of TABS) {
      const b = h('button', { class: 'sm', text: label, pressed: t === this.tab, onclick: () => this.show(t) });
      this.tabBtns.set(t, b); tabs.append(b);
    }
    tabs.append(h('span', { class: 'spacer' }), h('button', { class: 'sm', text: '✕', title: 'Đóng menu', onclick: () => this.close() }));
    this.pages.set('places', this.placesPage());
    this.pages.set('dev', this.devPage()); this.pages.set('help', this.helpPage());
    for (const p of this.pages.values()) body.append(p);
    this.show(this.tab);
  }

  get isOpen(): boolean { return !this.drawer.hidden; }
  open(tab?: Tab): void { this.drawer.hidden = false; if (tab) this.show(tab); this.update(); }
  close(): void { this.drawer.hidden = true; }
  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
  show(tab: Tab): void {
    this.tab = tab;
    for (const [t, b] of this.tabBtns) b.setAttribute('aria-pressed', String(t === tab));
    for (const [t, p] of this.pages) p.hidden = t !== tab;
    this.body.scrollTop = 0; this.update();
  }
  update(): void { if (this.isOpen) for (const u of this.updaters) u(); }

  // ---------------------------------------------------------------- built buildings
  private placesPage(): HTMLElement {
    const { sim, ctl } = this.c;
    this.updaters.push(() => {
      const key = sim.buildings.map((b) => `${b.id}.${b.level}.${b.done}.${b.upgrading}`).join();
      if (key === this.placesKey) return;
      this.placesKey = key;
      const counts: Record<string, number> = {};
      this.placesList.replaceChildren(...sim.buildings.filter((b) => b.kind !== 'fence' && b.kind !== 'gate').map((b) => { // the rows of fence would be hundreds
        counts[b.kind] = (counts[b.kind] ?? 0) + 1;
        const d = BUILDINGS[b.kind], name = `${d.name}${counts[b.kind] > 1 || b.kind !== 'campfire' ? ` #${counts[b.kind]}` : ''}`;
        const note = !b.done ? ' · đang xây' : b.upgrading ? ' · đang nâng cấp' : d.buildable ? ` · cấp ${b.level} (${levelDef(b).name.toLowerCase()})` : '';
        return h('div', { class: 'row' }, h('div', { class: 'nm' }, name, h('small', { text: note.replace(/^ · /, '') || 'đang dùng' })),
          h('button', { text: 'Mở', onclick: () => { ctl.selected.clear(); ctl.selectBuilding(b.id, true); ctl.centerOn((b.x + 1) * TILE, (b.y + 1) * TILE); this.close(); } }));
      }));
    });
    return h('div', { class: 'page' }, hint('Công trình đã dựng', 'Mọi công trình đã dựng nằm ở đây. Mở Xưởng để chế đồ, mở lửa trại để xem dân, mở Kho để xem tài nguyên.'), this.placesList);
  }

  // ---------------------------------------------------------------- dev tools
  /** Only what is needed to try the game fast: a camp of each level, quick and free works, goods, an event for the level, immortality, time and weather. */
  private devPage(): HTMLElement {
    const { sim, ctl, toast } = this.c, page = h('div', { class: 'page' });
    const btn = (text: string, fn: () => void, title = '') => h('button', { class: 'sm', text, title, onclick: () => { fn(); ctl.onChange(); this.update(); } });
    const toggle = (label: string, tip: string, get: () => boolean, set: (on: boolean) => void) => {
      const b = h('button', { class: 'sm', text: label, title: tip, pressed: get(), onclick: () => { set(!get()); b.setAttribute('aria-pressed', String(get())); ctl.onChange(); } });
      return b;
    };
    page.append(hint('Mô phỏng trại', 'Dựng sẵn trại của cấp lửa đã chọn: mọi nhà mở ở cấp đó (số lượng và cấp tối đa theo cấp lửa), hàng rào, cổng và chòi canh khi đã mở, dân đầy giường, lính và các nghề đã có người, lính được phát vũ khí và giáp. Không tốn gì.'));
    // a camp of each era and level: the stone age (the quick war, no supply, scouts, watchtower or plan) or the medieval layer (all of them)
    for (const [label, medieval] of [['Đồ Đá', false], ['Trung cổ', true]] as const) {
      page.append(h('div', { class: 'devrow' }, h('small', { text: `${label}:` }), ...(medieval ? [4] : [1, 2, 3]).map((n) => btn(`Trại cấp ${n}`, () => toast(dev.simulateCamp(sim, n, medieval)), `Dựng trại cấp ${n} của thời ${label} (${medieval ? 'có hậu cần, trinh sát, chòi canh, lập kế hoạch tác chiến' : 'đánh nhanh, không hậu cần, trinh sát, chòi canh'})`))));
    }
    page.append(h('div', { class: 'devrow' }, toggle('Thời Trung cổ (mở lớp chiến tranh nâng cao)', 'Bật hoặc tắt riêng lớp thời Trung cổ mà không dựng lại trại', () => sim.era === 'ancient', (on) => { sim.setEra(on ? 'ancient' : 'stone'); })));
    page.append(h('div', { class: 'devrow' },
      toggle('Mọi việc miễn phí + xong ngay', 'Nghiên cứu, chế tạo, thuần thú, xây, nâng cấp và sửa: không tốn vật liệu, không mất thời gian (nhà vẫn cần người làm bên trong)', () => sim.dev.freeWorks, (on) => { sim.dev.freeWorks = on; sim.dev.fastWorks = on; sim.dev.instantBuild = on; }),
      toggle('Bất tử', 'Dân không nhận sát thương', () => sim.dev.god, (on) => { sim.dev.god = on; })));
    page.append(h('div', { class: 'devrow' }, toggle('Thử nâng cấp sang nền rộng: Nhà dân cấp 2 thành 4×4', 'Cho Nhà dân cấp 2 chiếm nền 4×4 (hình vẫn nhỏ) để thử luồng nâng cấp: hình bóng nền mới, tô đỏ công trình vướng, dời đi rồi mới xác nhận; có thể hủy', () => dev.growTestOn(), (on) => dev.growTest(on))));
    page.append(h('div', { class: 'devrow' }, toggle('Xem cung điện (Nhà chính cấp 7)', 'Vẽ Nhà chính thành cung điện 6×6 để xem thử; cây, đá và các công trình quanh đó tạm ẩn (chỉ hình vẽ, không đổi gì trong game)', () => sim.dev.palace, (on) => { sim.dev.palace = on; })));
    page.append(h('div', { class: 'devrow' }, h('small', { text: 'Nghiên cứu xong:' }),
      ...dev.RESEARCH_GROUPS.map((g) => btn(g.label, () => toast(dev.researchGroup(sim, g.key)), `Nghiên cứu xong mọi mục của nhóm ${g.label}, không tốn gì`)),
      btn('Tất cả', () => toast(dev.researchGroup(sim, 'all')), 'Nghiên cứu xong cả cây')));
    page.append(h('div', { class: 'devrow' },
      btn('+5 dân', () => toast(dev.addPeople(sim, 5)), 'Thêm 5 dân rảnh quanh lửa trại, kể cả khi vượt sức chứa'),
      btn('+100 mỗi tài nguyên', () => dev.addAllStock(sim, 100), 'Cộng 100 mỗi loại (không quá sức chứa)'),
      btn('Tập hợp quân đầy ô', () => { toast(dev.fillPlan(sim)); ctl.onChange(); }, 'Tạo thêm lính (đồ tốt nhất + đuốc, bỏ qua sức chứa trại) cho đủ mọi ô lính trong kế hoạch của Bãi tập rồi Tập trận ngay'),
      ...[4, 5, 6, 7].map((r) => btn(`+5 lính bậc ${r} (Trung cổ)`, () => { toast(dev.addRankSoldiers(sim, r)); ctl.onChange(); }, `Thêm 5 bộ binh, 5 cung thủ, 5 kỵ binh bậc ${r} thời Trung cổ (đồ và thú đúng bậc), gọi ra quanh đống lửa để xem`)),
      btn('Dọn sạch quanh khu quân sự', () => { toast(dev.clearAroundZones(sim)); ctl.onChange(); }, 'Xóa cây, đá, bụi và thú trong khu quân sự và 40 ô xung quanh để thử hành quân (công trình giữ nguyên)'),
      btn('Mẫu nhật ký chiến đấu', () => toast(dev.sampleBattleLog(sim)), 'Thêm (hoặc xóa) vài trận giả vào nhật ký của Lều họp chiến để xem giao diện'),
      btn('Đầy quân + đồ cao nhất + đuốc', () => toast(dev.fullArmy(sim)), 'Mọi trại lính đầy quân, ai cũng có vũ khí và giáp tốt nhất của thời đại và một cây đuốc'),
      btn('Gọi sự kiện (theo cấp lửa)', () => toast(dev.callEvent(sim)), 'Gọi ngay sự kiện đã hẹn mạnh nhất mà trại cấp lửa hiện tại đủ sức đón')));

    page.append(h('div', { class: 'devrow' },
      ...[1, 2, 3].map((n) => btn(`Trại cấp ${n} + nghiên cứu/đồ đủ cấp ${n}`, () => toast(dev.campFullKit(sim, n)), `Trại cấp ${n} thời Đá, nghiên cứu xong mọi mục mà Nhà nghiên cứu cấp ${n} mở, kho đủ đồ mà Nhà chế tạo cấp ${n} làm được, lính tự trang bị đồ tốt nhất mở được + đuốc`)),
      ...([['weak', 'yếu'], ['normal', 'thường'], ['medium', 'trung bình']] as const).map(([tier, name]) => btn(`Làng ${name} làm đồng minh`, () => toast(dev.allyTier(sim, tier)), `Làng ${name} gần nhất còn tự do thành chư hầu ngay: gửi quân giúp khi ta đi đánh`)),
      btn('Đánh boss', () => toast(dev.attackBoss(sim)), 'Phát hiện boss gần nhất (bản đồ đầy đủ) rồi đưa toàn quân đi đánh (đánh nhanh thời Đá)')));

    // the new tribe rules: conquests, newcomers that take villages back, bandit camps, a village that builds again
    page.append(h('div', { class: 'devrow' },
      btn('Chiếm 3 làng', () => { toast(dev.conquerVillages(sim, 3)); ctl.onChange(); }, 'Thu nạp ngay 3 làng thường (nhận túi, dân, chỗ trại lính, % sản lượng) để thử làng mới đòi lại'),
      btn('Làng mới xuất hiện ngay', () => toast(dev.newcomerNow(sim)), 'Làng thứ 6 (rồi thứ 7) tới ngay và lấy lại 1 đến 2 làng ta đã chiếm hoặc đang cống nạp (cần có làng như vậy)'),
      btn('Trại cướp đổi mức ngay', () => toast(dev.rerollBandits(sim)), 'Mỗi trại cướp bốc lại mức yếu, vừa hoặc mạnh ngay bây giờ (bình thường cứ 2 đến 3 ngày)'),
      btn('Diệt trại cướp gần nhất', () => toast(dev.crushNearestBandit(sim)), 'Nhận túi của trại cướp gần nhất, trại mọc lại sau 2 đến 3 ngày'),
      btn('Phá nửa làng gần nhất', () => toast(dev.wreckVillage(sim)), 'Phá một nửa công trình của làng gần nhất (không phải trại cướp) để xem họ dựng lại'),
      btn('Cho làng hồi một ngày', () => toast(dev.recoverVillagesDay(sim)), 'Mọi làng qua một ngày hồi phục: dựng lại công trình, sửa, thêm người')));

    // the villages of the land: where they are and how they stand, to try the sleeping and waking of a village by sending people to it
    page.append(h('h3', { text: 'Các làng NPC (tọa độ là số ô)' }));
    const here = h('small'), rows = h('div'); let shown = 0;
    page.append(here, rows);
    const FOG = ['chưa biết', 'đã khám phá', 'đang thấy'];
    this.updaters.push(() => {
      const now = performance.now();
      if (page.hidden || now - shown < 500) return;
      shown = now;
      const v = ctl.viewTile(), fire = sim.campfire(), N = sim.world.size;
      here.textContent = `Camera đang nhìn: (${Math.round(v.x)}, ${Math.round(v.y)}) · lửa của ta: (${fire ? Math.round(fire.x + 1) : '?'}, ${fire ? Math.round(fire.y + 1) : '?'})`;
      rows.replaceChildren(...sim.tribes.map((t) => {
        const live = t.unitIds.map((u) => sim.get(u)).filter((u) => !!u && u.health > 0), guards = live.filter((u) => u!.ai?.role !== 'civ').length, crowd = t.crowd ? t.crowd.guards + t.crowd.civs : 0;
        const d = fire ? Math.round(Math.hypot(t.camp.x - fire.x, t.camp.y - fire.y)) : 0;
        const line = `${t.bandit ? 'CƯỚP' : ({ weak: 'Yếu', normal: 'Thường', medium: 'Trung bình', boss: 'BOSS', rebel: 'Phản bội', raider: 'Mạnh' } as Record<string, string>)[t.tier] ?? t.tier}${t.allyOf ? ` (đồng minh ${t.allyOf})` : ''} · ${t.def.name} · (${Math.round(t.camp.x)}, ${Math.round(t.camp.y)}) · cách lửa ${d} ô · cấp ${t.campLevel}${t.state === 'free' ? '' : ` · ${t.state}`} · ${t.awake ? 'ĐANG THỨC' : 'đang ngủ'} · ngoài ${live.length} (lính ${guards}) · trong nhà ${crowd} · ${t.props.length} công trình · sương: ${FOG[sim.fog.state[Math.floor(t.camp.y) * N + Math.floor(t.camp.x)]]}`;
        return h('div', { class: 'devrow' }, h('small', { text: line }), h('button', { class: 'sm', text: 'Phát hiện', title: 'Chỉ để thử: làng này hiện trong Lều họp chiến như đã được trinh sát đủ', onclick: () => { toast(dev.discoverTribe(sim, t.id)); ctl.onChange(); } }), h('button', { class: 'sm', text: 'Camera tới', title: 'Chỉ để thử: đưa camera tới trại này (sương mù vẫn che nếu chưa khám phá)', onclick: () => { ctl.centerOn(t.camp.x * TILE, t.camp.y * TILE); this.close(); } }));
      }));
    });

    page.append(h('h3', { text: 'Trinh sát' }));
    page.append(h('div', { class: 'devrow' }, ...[1, 2, 3].map((n) => btn(`Trinh sát tự tìm làng: bản đồ cấp ${n}`, () => toast(dev.autoScout(sim, n)), 'Làng gần nhất chưa có bản đồ cấp này được tìm và vẽ xong ngay (không cần trinh sát thật), để có dữ liệu cho phần vẽ bản đồ'))));

    page.append(h('div', { class: 'devrow' }, btn('Có sẵn bản đồ địch (đầy đủ)', () => toast(dev.giveEnemyMap(sim)), 'Làng địch gần nhất được tìm thấy và có bản đồ cấp 3 đầy đủ, để thử phần lập kế hoạch chiến tranh')));

    page.append(h('h3', { text: 'Thời gian và thời tiết' }));
    page.append(h('div', { class: 'devrow' }, btn('Sáng', () => dev.setTimeOfDay(sim, 0.3)), btn('Trưa', () => dev.setTimeOfDay(sim, 0.5)), btn('Chiều', () => dev.setTimeOfDay(sim, 0.78)), btn('Đêm', () => dev.setTimeOfDay(sim, 0.95)), btn('+1 ngày', () => dev.skipDays(sim, 1)), btn('+5 ngày', () => dev.skipDays(sim, 5))));
    page.append(h('h3', { text: 'Người lạ ghé làng' }));
    page.append(h('div', { class: 'devrow' }, ...['wanderer', 'peddler', 'refugees', 'pursuers', 'scout_envoy', 'extortion', 'ultimatum', 'travelers', 'ransom', 'thief_caught', 'newcomers'].map((id) => btn(id, () => toast(dev.summonVisitor(sim, id)), `Gọi ngay người lạ của kịch bản ${id} (Sáng, ngay hôm nay)`))));
    page.append(h('div', { class: 'devrow' }, ...SEASONS.map((s) => btn(SEASON_NAME[s], () => dev.setSeason(sim, s)))));
    page.append(h('div', { class: 'devrow' }, ...(Object.keys(WEATHER) as WeatherKind[]).map((k) => btn(WEATHER[k].name, () => dev.setWeather(sim, k)))));
    return page;
  }

  // ---------------------------------------------------------------- controls
  private helpPage(): HTMLElement {
    return h('ul', { class: 'help' },
      h('li', {}, h('b', { text: 'Chọn dân' }), ': bấm vào dân. Bấm đúp để chọn mọi dân cùng nghề đang hiện trên màn hình. Kéo khung để chọn nhiều người: chuột trái kéo trên bản đồ, hoặc trên điện thoại giữ ngón tay đứng yên khoảng một phần tư giây (máy rung nhẹ và hiện vòng tròn) rồi kéo (vuốt nhanh thì kéo bản đồ). Giữ Shift khi kéo để thêm vào nhóm; trên điện thoại giữ một ngón rồi chạm người khác bằng ngón thứ hai. Dấu ✕ ở góc dưới (hoặc Esc) bỏ chọn; nút ⚔ bên cạnh gọi quân ra khỏi trại.'),
      h('li', {}, h('b', { text: 'Ra lệnh' }), ': máy tính: chuột phải. Điện thoại: khi đã chọn dân, chạm lên đất, cây, đá, bụi quả, công trường hay kẻ địch. Giữ Shift (máy tính) để xếp lệnh nối nhau.'),
      h('li', {}, h('b', { text: 'Kéo bản đồ' }), ': máy tính: giữ chuột phải rồi kéo (hoặc W A S D). Điện thoại: một ngón đặt giữ yên, một ngón kéo (bản đồ đi theo ngón kéo); hoặc hai ngón cùng kéo; chụm hoặc mở hai ngón để thu phóng.'),
      h('li', {}, h('b', { text: 'Bản đồ nhỏ' }), ': bấm vào để mở bản đồ lớn, chạm một chỗ để nhảy tới đó.'),
      h('li', {}, h('b', { text: 'Công trình' }), `: bấm 🔨 Xây (góc trên) để chọn công trình rồi chạm bản đồ đặt. Mở Menu → Công trình, hoặc bấm vào công trình trên bản đồ: lửa trại cho xem dân, Kho cho xem tài nguyên, Nhà nghiên cứu để vẽ bản vẽ, Nhà chế tạo để làm đồ. Mỗi loại công trình chỉ xây một cái rồi nâng cấp (đơn sơ → gỗ → đá → gia cố, nâng theo cấp Nhà chung). Dân vào làm bên trong nhà (hiện thành danh sách tên, không hiện trên bản đồ): nhà cấp cao chứa thêm người, càng đông càng nghiên cứu nhanh. Lúc đầu bạn tự phát công cụ; nghiên cứu Kho công cụ, Kho vũ khí, tự lấy đồ và tự đặt hàng thì dân tự lo. Tiền (vỏ sò) trả cho nghiên cứu, nhặt khi hái lượm hoặc đổi hàng ở Kho. Trong bảng công trình còn có nút Dời (tốn 1/5 vật liệu, phải dựng lại) và Phá bỏ (thu lại một nửa).`),
      h('li', {}, h('b', { text: 'Chiến đấu' }), `: dân thường không đánh nhau, thấy địch là chạy về lửa trại. Muốn có lính thì giao nghề Chiến binh (huy hiệu đỏ trên đầu) hoặc Thợ săn (huy hiệu vàng), phát vũ khí ở thẻ dân → Chiến đấu, rồi chạm vào thú hoặc địch. Thế đứng: Chủ động, Phòng thủ, Rút lui. F: tấn công–đi, H: giữ chỗ, G: dừng. Hết máu là chết, không ai cứu được.`),
      h('li', {}, h('b', { text: 'Bộ tộc' }), `: tặng thức ăn để tăng quan hệ. Hạ thủ lĩnh hoặc chiếm đống lửa của họ ${gameDays(30, dayLength('stone'))} để họ xin hàng, rồi chọn thu nạp hoặc cống nạp.`),
      h('li', {}, h('b', { text: 'Phím' }), ': P tạm dừng, Q E R T: tốc độ 1× 2× 4× 16×, B xây Kho, X xây Xưởng, 1–9 gọi nhóm (Ctrl + số để lưu), Space nhảy tới dân đang chọn, Esc bỏ chọn.'),
    );
  }
}
