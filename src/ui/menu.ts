import { BUILDINGS, levelDef } from '../sim/buildings';
import { DIFF, playerCap } from '../sim/difficulty';
import { relationLabel, WEAPONS, RELATION, TribeId } from '../sim/combat';
import { SEASONS, Season, WEATHER, WeatherKind } from '../sim/calendar';
import { gameDays, TILE, workDays } from '../sim/constants';
import * as dev from '../sim/dev';
import { StatKey, STAT_NAME } from '../sim/jobs';
import { RESEARCH } from '../sim/research';
import { RES_LIST, RES_NAME } from '../sim/resources';
import { TOOL_KINDS, TOOL_NAME, TIER_NAME } from '../sim/tools';
import { canAdopt, canTribute } from '../sim/tribes';
import { costText, h, helpButton, hint } from './dom';
import type { Ctx } from './panels';

type Tab = 'places' | 'tribes' | 'game' | 'dev' | 'help';
const TABS: Array<[Tab, string]> = [['places', 'Công trình'], ['tribes', 'Bộ tộc'], ['game', 'Ván chơi'], ['dev', 'Dev'], ['help', '?']];
const SEASON_NAME: Record<Season, string> = { spring: 'Xuân', summer: 'Hạ', autumn: 'Thu', winter: 'Đông' };
const PERSONALITY = { peaceful: 'Hòa bình', aggressive: 'Hiếu chiến', ambusher: 'Hay phục kích' } as const;

/** The slide-in menu: what to build, what is built, the tribes, the dev tools and the controls. */
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
    this.pages.set('places', this.placesPage()); this.pages.set('tribes', this.tribesPage());
    this.pages.set('game', this.gamePage()); this.pages.set('dev', this.devPage()); this.pages.set('help', this.helpPage());
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
      this.placesList.replaceChildren(...sim.buildings.map((b) => {
        counts[b.kind] = (counts[b.kind] ?? 0) + 1;
        const d = BUILDINGS[b.kind], name = `${d.name}${counts[b.kind] > 1 || b.kind !== 'campfire' ? ` #${counts[b.kind]}` : ''}`;
        const note = !b.done ? ' · đang xây' : b.upgrading ? ' · đang nâng cấp' : d.buildable ? ` · cấp ${b.level} (${levelDef(b).name.toLowerCase()})` : '';
        return h('div', { class: 'row' }, h('div', { class: 'nm' }, name, h('small', { text: note.replace(/^ · /, '') || 'đang dùng' })),
          h('button', { text: 'Mở', onclick: () => { ctl.selected.clear(); ctl.selectBuilding(b.id, true); ctl.centerOn((b.x + 1) * TILE, (b.y + 1) * TILE); this.close(); } }));
      }));
    });
    return h('div', { class: 'page' }, hint('Công trình đã dựng', 'Mọi công trình đã dựng nằm ở đây. Mở Xưởng để chế đồ, mở lửa trại để xem dân, mở Kho để xem tài nguyên.'), this.placesList);
  }

  // ---------------------------------------------------------------- tribes
  private tribesPage(): HTMLElement {
    const { sim, ctl } = this.c, page = h('div', { class: 'page' });
    const banner = h('div', { class: 'card', hidden: true }); const none = h('p', { class: 'sub', text: 'Chưa gặp bộ tộc nào. Hãy cử người đi khám phá.' });
    page.append(banner, none);
    const cards = sim.tribes.map((t) => {
      const status = h('span'), people = h('div', { class: 'kv' }), fill = h('b');
      const gift = h('button', { class: 'sm', text: `Tặng ${RELATION.giftFood} thức ăn`, onclick: () => { const e = sim.diplomacy(t.id, 'gift'); if (e) this.c.toast(e); } });
      const tribute = h('button', { class: 'sm', text: 'Cống nạp', onclick: () => { const e = sim.diplomacy(t.id, 'tribute'); this.c.toast(e ?? `${t.def.name} chịu cống nạp`); } });
      const adopt = h('button', { class: 'sm primary', text: 'Thu nạp', onclick: () => { const e = sim.diplomacy(t.id, 'adopt'); this.c.toast(e ?? `${t.def.name} gia nhập làng`); } });
      const bar = h('div', { class: 'tribe-bar' }, fill, h('u'));
      const card = h('div', { class: 'card', hidden: true }, h('div', { class: 'cardhead' }, h('b', { text: t.def.name }), h('span', { text: PERSONALITY[t.def.personality] }), status), bar, people,
        h('p', { class: 'sub', text: `Phần thưởng: ${t.def.reward}` }), h('div', { class: 'btns' }, gift, tribute, adopt));
      page.append(card);
      return { t, card, status, people, fill, gift, tribute, adopt };
    });
    this.updaters.push(() => {
      const N = sim.world.size; let any = false;
      for (const c of cards) {
        const { t } = c, seen = sim.fog.state[Math.floor(t.camp.y) * N + Math.floor(t.camp.x)] > 0;
        c.card.hidden = !seen; if (!seen) continue; any = true;
        const rel = t.state === 'tribute' ? Math.max(60, t.relation) : t.relation;
        c.status.textContent = t.state === 'free' ? relationLabel(rel) + (sim.tribeHostile(t.id) ? ' · đang thù địch' : '') : { surrendered: 'Đã xin hàng', tribute: 'Đang cống nạp', adopted: 'Đã gia nhập làng', destroyed: 'Đã bị xóa sổ' }[t.state];
        c.fill.style.left = rel >= 0 ? '50%' : `${50 + rel / 2}%`; c.fill.style.width = `${Math.abs(rel) / 2}%`;
        const alive = t.unitIds.map((u) => sim.get(u)).filter(Boolean);
        c.people.innerHTML = t.state === 'adopted' || t.state === 'destroyed' ? '' : `Người <b>${alive.length}</b> · lính <b>${alive.filter((u) => u!.ai?.role !== 'civ').length}</b> · quan hệ <b>${Math.round(rel)}</b>${t.raid ? ' · <b>đang tập kích!</b>' : ''}`;
        const over = t.state === 'adopted' || t.state === 'destroyed';
        c.gift.disabled = over || sim.stock.food < RELATION.giftFood; c.tribute.disabled = over || !canTribute(t) || t.state === 'tribute'; c.adopt.disabled = over || !canAdopt(t) || sim.villagers.length >= sim.popCap();
      }
      none.hidden = any;
      const p = sim.pendingTribe && sim.tribes.find((x) => x.id === sim.pendingTribe);
      banner.hidden = !p;
      if (p) banner.replaceChildren(hint(h('b', { text: `${p.def.name} xin hàng!` }), 'Thu nạp: dân và lính gia nhập làng. Cống nạp: họ giữ làng và nộp tài nguyên mỗi mùa, không đánh bạn nữa.'));
    });
    return page;
  }

  // ---------------------------------------------------------------- the game itself
  private gamePage(): HTMLElement {
    const { session, toast } = this.c, page = h('div', { class: 'page' });
    const info = h('p', { class: 'sub', text: 'Chưa có bản lưu.' });
    const refresh = async () => { const m = await session.latest(); info.textContent = m ? `Bản lưu gần nhất: ngày ${m.day}, ${m.population} dân, lúc ${new Date(m.savedAt).toLocaleString('vi')}.` : 'Chưa có bản lưu.'; };
    let armed = 0;
    const fresh = h('button', { class: 'sm danger', text: 'Ván mới' }) as HTMLButtonElement;
    fresh.addEventListener('click', () => {
      if (performance.now() < armed) { void session.forget().then(() => location.assign(location.pathname + location.search.replace(/[?&]continue=1/, ''))); return; }
      armed = performance.now() + 4000; fresh.textContent = 'Bấm lại để xóa bản lưu và chơi lại'; setTimeout(() => { fresh.textContent = 'Ván mới'; }, 4000);
    });
    const saveBtn = h('button', { class: 'sm primary', text: 'Lưu ngay', onclick: () => { void session.save().then((ok) => { if (ok) toast('Đã lưu'); void refresh(); }); } }) as HTMLButtonElement;
    const loadBtn = h('button', { class: 'sm', text: 'Tải bản lưu', onclick: () => { void session.resume('auto').then((ok) => { toast(ok ? 'Đã tải lại ván chơi' : 'Chưa có bản lưu'); this.close(); }); } }) as HTMLButtonElement;
    page.append(hint('Lưu và tải', 'Game tự lưu vào đầu mỗi ngày và khi bạn rời trang. Bản lưu nằm trong trình duyệt của máy này. Tốc độ game và lời nhắc xoay ngang là cài đặt của bạn, không nằm trong bản lưu.'), info,
      h('div', { class: 'btns' },
        saveBtn, loadBtn, fresh));
    let last = -1e9;
    this.updaters.push(() => { const war = this.c.sim.atWar(); for (const b of [saveBtn, loadBtn]) { b.disabled = war; b.title = war ? 'Đang chiến tranh: không lưu hay tải được cho tới khi trận kết thúc' : ''; } });
    this.updaters.push(() => { const now = performance.now(); if (!page.hidden && now - last > 2000) { last = now; void refresh(); } });
    return page;
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
      page.append(h('div', { class: 'devrow' }, h('small', { text: `${label}:` }), ...[1, 2, 3, 4].map((n) => btn(`Trại cấp ${n}`, () => toast(dev.simulateCamp(sim, n, medieval)), `Dựng trại cấp ${n} của thời ${label} (${medieval ? 'có hậu cần, trinh sát, chòi canh, lập kế hoạch tác chiến' : 'đánh nhanh, không hậu cần, trinh sát, chòi canh'})`))));
    }
    page.append(h('div', { class: 'devrow' }, toggle('Thời Trung cổ (mở lớp chiến tranh nâng cao)', 'Bật hoặc tắt riêng lớp thời Trung cổ mà không dựng lại trại', () => sim.advanced, (on) => { sim.advanced = on; })));
    page.append(h('div', { class: 'devrow' },
      toggle('Mọi việc miễn phí + xong ngay', 'Nghiên cứu, chế tạo, thuần thú, xây, nâng cấp và sửa: không tốn vật liệu, không mất thời gian (nhà vẫn cần người làm bên trong)', () => sim.dev.freeWorks, (on) => { sim.dev.freeWorks = on; sim.dev.fastWorks = on; sim.dev.instantBuild = on; }),
      toggle('Bất tử', 'Dân không nhận sát thương', () => sim.dev.god, (on) => { sim.dev.god = on; })));
    page.append(h('div', { class: 'devrow' }, h('small', { text: 'Nghiên cứu xong:' }),
      ...dev.RESEARCH_GROUPS.map((g) => btn(g.label, () => toast(dev.researchGroup(sim, g.key)), `Nghiên cứu xong mọi mục của nhóm ${g.label}, không tốn gì`)),
      btn('Tất cả', () => toast(dev.researchGroup(sim, 'all')), 'Nghiên cứu xong cả cây, kể cả các bản vẽ')));
    page.append(h('div', { class: 'devrow' },
      btn('+5 dân', () => toast(dev.addPeople(sim, 5)), 'Thêm 5 dân rảnh quanh lửa trại, kể cả khi vượt sức chứa'),
      btn('+100 mỗi tài nguyên', () => dev.addAllStock(sim, 100), 'Cộng 100 mỗi loại (không quá sức chứa)'),
      btn('Gọi sự kiện (theo cấp lửa)', () => toast(dev.callEvent(sim)), 'Gọi ngay sự kiện đã hẹn mạnh nhất mà trại cấp lửa hiện tại đủ sức đón')));

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
        const line = `${t.boss ? 'BOSS' : 'Thường'} · ${t.def.name} · (${Math.round(t.camp.x)}, ${Math.round(t.camp.y)}) · cách lửa ${d} ô · cấp ${t.campLevel}${t.state === 'free' ? '' : ` · ${t.state}`} · ${t.awake ? 'ĐANG THỨC' : 'đang ngủ'} · ngoài ${live.length} (lính ${guards}) · trong nhà ${crowd} · ${t.props.length} công trình · sương: ${FOG[sim.fog.state[Math.floor(t.camp.y) * N + Math.floor(t.camp.x)]]}`;
        return h('div', { class: 'devrow' }, h('small', { text: line }), h('button', { class: 'sm', text: 'Camera tới', title: 'Chỉ để thử: đưa camera tới trại này (sương mù vẫn che nếu chưa khám phá)', onclick: () => { ctl.centerOn(t.camp.x * TILE, t.camp.y * TILE); this.close(); } }));
      }));
    });

    page.append(h('h3', { text: 'Trinh sát' }));
    page.append(h('div', { class: 'devrow' }, ...[1, 2, 3].map((n) => btn(`Trinh sát tự tìm làng: bản đồ cấp ${n}`, () => toast(dev.autoScout(sim, n)), 'Làng gần nhất chưa có bản đồ cấp này được tìm và vẽ xong ngay (không cần trinh sát thật), để có dữ liệu cho phần vẽ bản đồ'))));

    page.append(h('div', { class: 'devrow' }, btn('Có sẵn bản đồ địch (đầy đủ)', () => toast(dev.giveEnemyMap(sim)), 'Làng địch gần nhất được tìm thấy và có bản đồ cấp 3 đầy đủ, để thử phần lập kế hoạch chiến tranh')));

    page.append(h('h3', { text: 'Thời gian và thời tiết' }));
    page.append(h('div', { class: 'devrow' }, btn('Sáng', () => dev.setTimeOfDay(sim, 0.3)), btn('Trưa', () => dev.setTimeOfDay(sim, 0.5)), btn('Chiều', () => dev.setTimeOfDay(sim, 0.78)), btn('Đêm', () => dev.setTimeOfDay(sim, 0.95)), btn('+1 ngày', () => dev.skipDays(sim, 1)), btn('+5 ngày', () => dev.skipDays(sim, 5))));
    page.append(h('div', { class: 'devrow' }, ...SEASONS.map((s) => btn(SEASON_NAME[s], () => dev.setSeason(sim, s)))));
    page.append(h('div', { class: 'devrow' }, ...(Object.keys(WEATHER) as WeatherKind[]).map((k) => btn(WEATHER[k].name, () => dev.setWeather(sim, k)))));
    return page;
  }

  // ---------------------------------------------------------------- controls
  private helpPage(): HTMLElement {
    return h('ul', { class: 'help' },
      h('li', {}, h('b', { text: 'Chọn dân' }), ': bấm vào dân. Bấm đúp để chọn mọi dân cùng nghề đang hiện trên màn hình. "Chọn nhiều" để bấm từng người hoặc kéo khung; "Chọn hết" chọn cả làng.'),
      h('li', {}, h('b', { text: 'Ra lệnh' }), ': máy tính: chuột phải. Điện thoại: khi đã chọn dân, chạm lên đất, cây, đá, bụi quả, công trường hay kẻ địch. Giữ Shift (máy tính) để xếp lệnh nối nhau.'),
      h('li', {}, h('b', { text: 'Kéo bản đồ' }), ': máy tính: giữ chuột phải rồi kéo (hoặc W A S D). Điện thoại: một ngón đặt giữ yên, một ngón kéo (bản đồ đi theo ngón kéo); hoặc hai ngón cùng kéo; chụm hoặc mở hai ngón để thu phóng.'),
      h('li', {}, h('b', { text: 'Bản đồ nhỏ' }), ': bấm vào để mở bản đồ lớn, chạm một chỗ để nhảy tới đó.'),
      h('li', {}, h('b', { text: 'Công trình' }), `: bấm 🔨 Xây (góc trên) để chọn công trình rồi chạm bản đồ đặt. Mở Menu → Công trình, hoặc bấm vào công trình trên bản đồ: lửa trại cho xem dân, Kho cho xem tài nguyên, Nhà nghiên cứu để vẽ bản vẽ, Nhà chế tạo để làm đồ. Mỗi loại công trình chỉ xây một cái rồi nâng cấp (đơn sơ → gỗ → đá → gia cố, nâng theo cấp Nhà chung). Dân vào làm bên trong nhà (hiện thành danh sách tên, không hiện trên bản đồ): nhà cấp cao chứa thêm người, càng đông càng nghiên cứu nhanh. Lúc đầu bạn tự phát công cụ; nghiên cứu Kho công cụ, Kho vũ khí, tự lấy đồ và tự đặt hàng thì dân tự lo. Tiền (vỏ sò) trả cho nghiên cứu, nhặt khi hái lượm hoặc đổi hàng ở Kho. Trong bảng công trình còn có nút Dời (tốn 1/5 vật liệu, phải dựng lại) và Phá bỏ (thu lại một nửa).`),
      h('li', {}, h('b', { text: 'Chiến đấu' }), `: dân thường không đánh nhau, thấy địch là chạy về lửa trại. Muốn có lính thì giao nghề Chiến binh (huy hiệu đỏ trên đầu) hoặc Thợ săn (huy hiệu vàng), phát vũ khí ở thẻ dân → Chiến đấu, rồi chạm vào thú hoặc địch. Thế đứng: Chủ động, Phòng thủ, Rút lui. F: tấn công–đi, H: giữ chỗ, G: dừng. Người bị thương nặng ngã xuống ${gameDays(30)}; một người khác đứng cạnh ${gameDays(3)} sẽ kéo họ dậy.`),
      h('li', {}, h('b', { text: 'Bộ tộc' }), `: tặng thức ăn để tăng quan hệ. Hạ thủ lĩnh hoặc chiếm đống lửa của họ ${gameDays(30)} để họ xin hàng, rồi chọn thu nạp hoặc cống nạp.`),
      h('li', {}, h('b', { text: 'Phím' }), ': P tạm dừng, Q E R T: tốc độ 1× 2× 4× 16×, B xây Kho, X xây Xưởng, 1–9 gọi nhóm (Ctrl + số để lưu), Space nhảy tới dân đang chọn, Esc bỏ chọn.'),
    );
  }
}
