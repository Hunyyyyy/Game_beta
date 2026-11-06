import { BUILDINGS, levelDef } from '../sim/buildings';
import { DIFF, playerCap } from '../sim/difficulty';
import { relationLabel, WEAPONS, TribeId } from '../sim/combat';
import { SEASONS, Season, WEATHER, WeatherKind } from '../sim/calendar';
import { dayLength, gameDays, TILE, workDays } from '../sim/constants';
import * as dev from '../sim/dev';
import { StatKey, STAT_NAME } from '../sim/jobs';
import { RESEARCH } from '../sim/research';
import { RES_LIST, RES_NAME } from '../sim/resources';
import { TOOL_KINDS, TOOL_NAME, TIER_NAME } from '../sim/tools';
import { canAdopt, canTribute, giftOf, tributeSteps } from '../sim/tribes';
import type { Tribe } from '../sim/tribes';
import { costText, h, helpButton, hint } from './dom';
import type { Ctx } from './panels';

type Tab = 'places' | 'tribes' | 'game' | 'settings' | 'dev' | 'help';
const TABS: Array<[Tab, string]> = [['places', 'Công trình'], ['tribes', 'Bộ tộc'], ['game', 'Ván chơi'], ['settings', 'Cài đặt'], ['dev', 'Dev'], ['help', '?']];
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
    this.pages.set('game', this.gamePage()); this.pages.set('settings', this.settingsPage()); this.pages.set('dev', this.devPage()); this.pages.set('help', this.helpPage());
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
    // a card for each village that stands: a village taken is gone, and a new era brings new ones, so the cards follow `sim.tribes`
    type Card = { t: Tribe; card: HTMLElement; status: HTMLElement; people: HTMLElement; fill: HTMLElement; note: HTMLElement; gift: HTMLButtonElement; tribute: HTMLButtonElement; adopt: HTMLButtonElement; less: HTMLButtonElement; more: HTMLButtonElement };
    const cards = new Map<string, Card>();
    const make = (t: Tribe): Card => {
      const status = h('span'), people = h('div', { class: 'kv' }), fill = h('b'), note = h('p', { class: 'sub' });
      const act = (action: 'gift' | 'tribute' | 'adopt' | 'tributeUp' | 'tributeDown', done?: string) => () => { const e = sim.diplomacy(t.id, action); if (e) this.c.toast(e); else if (done) this.c.toast(done); };
      const gift = h('button', { class: 'sm', text: 'Tặng quà', onclick: act('gift') }) as HTMLButtonElement;
      const tribute = h('button', { class: 'sm', text: 'Cống nạp', onclick: act('tribute', `${t.def.name} chịu cống nạp`) }) as HTMLButtonElement;
      const adopt = h('button', { class: 'sm primary', text: 'Thu nạp', onclick: act('adopt', `${t.def.name} gia nhập làng`) }) as HTMLButtonElement;
      const less = h('button', { class: 'sm', text: '−10%', onclick: act('tributeDown') }) as HTMLButtonElement;
      const more = h('button', { class: 'sm', text: '+10%', onclick: act('tributeUp') }) as HTMLButtonElement;
      const bar = h('div', { class: 'tribe-bar' }, fill, h('u'));
      const card = h('div', { class: 'card', hidden: true }, h('div', { class: 'cardhead' }, h('b', { text: t.def.name }), h('span', { text: PERSONALITY[t.def.personality] }), status), bar, people,
        h('p', { class: 'sub', text: `Phần thưởng: ${t.def.reward}` }), note, h('div', { class: 'btns' }, gift, tribute, adopt, less, more));
      page.append(card);
      return { t, card, status, people, fill, note, gift, tribute, adopt, less, more };
    };
    this.updaters.push(() => {
      const N = sim.world.size; let any = false;
      for (const [id, c] of cards) if (!sim.tribes.includes(c.t)) { c.card.remove(); cards.delete(id); }
      for (const t of sim.tribes) if (!cards.has(t.id)) cards.set(t.id, make(t));
      for (const c of cards.values()) {
        const { t } = c, seen = sim.fog.state[Math.floor(t.camp.y) * N + Math.floor(t.camp.x)] > 0;
        c.card.hidden = !seen; if (!seen) continue; any = true;
        const rel = t.state === 'tribute' ? Math.max(60, t.relation) : t.relation;
        c.status.textContent = (t.rebel ? 'Thủ lĩnh phản bội · ' : '') + (t.state === 'free' ? relationLabel(rel) + (sim.tribeHostile(t.id) ? ' · đang thù địch' : '') : { surrendered: 'Đã xin hàng', tribute: 'Đang cống nạp', destroyed: 'Đã bị xóa sổ' }[t.state]);
        c.fill.style.left = rel >= 0 ? '50%' : `${50 + rel / 2}%`; c.fill.style.width = `${Math.abs(rel) / 2}%`;
        const alive = t.unitIds.map((u) => sim.get(u)).filter(Boolean);
        c.people.innerHTML = t.state === 'destroyed' ? '' : `Người <b>${alive.length}</b> · lính <b>${alive.filter((u) => u!.ai?.role !== 'civ').length}</b> · quan hệ <b>${Math.round(rel)}</b>${t.raid ? ' · <b>đang tập kích!</b>' : ''}`;
        const over = t.state === 'destroyed', tr = DIFF.capture.tribute, paying = t.state === 'tribute', share = t.tributeShare ?? tr.baseShare, steps = tributeSteps(t);
        c.note.hidden = !paying;
        if (paying && share <= 0) c.note.textContent = `Không lấy cống nạp: quan hệ +${tr.relationRegen} mỗi ${tr.everyDays} ngày.`;
        else if (paying) c.note.textContent = `Cống nạp ${Math.round(share * 100)}% túi mỗi ${tr.everyDays} ngày${steps ? ` · đòi thêm ${steps} bước: quan hệ −${1 + steps} mỗi lần, ${Math.round(steps * tr.greedChancePerStep * 100)}% phản bội mỗi lần` : ' · quan hệ −1 mỗi lần'}.`;
        c.gift.hidden = paying || t.state === 'surrendered'; c.tribute.hidden = paying; c.adopt.hidden = paying; c.less.hidden = c.more.hidden = !paying;
        c.gift.disabled = over || t.state !== 'free' || t.boss === true; c.gift.title = t.boss ? 'Thủ lĩnh không nhận quà' : `Quà: ${Object.entries(giftOf(t, sim.era)).map(([k, n]) => `${n} ${RES_NAME[k as keyof typeof RES_NAME].toLowerCase()}`).join(', ')}`; c.tribute.disabled = over || !canTribute(t) || paying; c.adopt.disabled = over || !canAdopt(t) || sim.villagers.length >= sim.popCap();
        c.less.disabled = share <= 0; c.less.textContent = share <= tr.baseShare + (t.tributeFree ?? 0) && share > 0 ? 'Không lấy' : '−10%'; c.more.disabled = share >= tr.maxShare;
      }
      none.hidden = any;
      const p = sim.pendingTribe && sim.tribes.find((x) => x.id === sim.pendingTribe);
      banner.hidden = !p;
      if (p) banner.replaceChildren(hint(h('b', { text: `${p.def.name} xin hàng!` }), 'Thu nạp: làng biến mất, ta nhận dân và chỗ ở trại lính vĩnh viễn. Cống nạp: họ giữ làng và nộp một phần tài nguyên mỗi 3 ngày, không đánh ta nữa và góp lính khi ta đi đánh; đòi càng nhiều họ càng oán và có thể phản bội.'));
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

  // ---------------------------------------------------------------- settings
  /** Sound: a volume and an off switch for the effects, the weather and the music. Off means nothing is played and nothing is worked out for it (lighter on a slow machine). */
  private settingsPage(): HTMLElement {
    const { sound } = this.c, page = h('div', { class: 'page' });
    page.append(hint('Âm thanh', 'Kéo thanh để chỉnh to nhỏ. Bỏ chọn ô bên cạnh để tắt hẳn loại âm thanh đó: khi tắt, game không xử lý âm thanh ấy nữa nên máy yếu sẽ nhẹ hơn. Phím tắt: O hiệu ứng, I môi trường, U nhạc.'));
    const rows: Array<() => void> = [];
    for (const [kind, label, tip] of [['sfx', 'Hiệu ứng', 'Làm việc, đánh nhau, đặt công trình, cổng, ra lệnh cho quân'], ['amb', 'Môi trường', 'Mưa, bão, sấm, gió, chim, sói'], ['mus', 'Nhạc', 'Nhạc bình yên, nhạc chiến tranh, thắng và thua']] as const) {
      const on = h('input', { type: 'checkbox', title: 'Bật hoặc tắt' }) as HTMLInputElement;
      const range = h('input', { type: 'range', min: '0', max: '100', step: '5', title: tip }) as HTMLInputElement;
      const num = h('small', { text: '' });
      const apply = () => { sound.set(kind, on.checked, +range.value / 100); num.textContent = `${range.value}%`; };
      on.addEventListener('change', apply); range.addEventListener('input', apply);
      const sync = () => { const g = sound.get(kind); if (document.activeElement !== range) range.value = String(Math.round(g.vol * 100)); on.checked = g.on; num.textContent = `${range.value}%`; };
      rows.push(sync);
      page.append(h('div', { class: 'row' }, h('div', { class: 'nm' }, label, h('small', { text: tip })), on, range, num));
    }
    this.updaters.push(() => { if (!page.hidden) for (const r of rows) r(); });
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
      page.append(h('div', { class: 'devrow' }, h('small', { text: `${label}:` }), ...(medieval ? [5] : [1, 2, 3, 4]).map((n) => btn(`Trại cấp ${n}`, () => toast(dev.simulateCamp(sim, n, medieval)), `Dựng trại cấp ${n} của thời ${label} (${medieval ? 'có hậu cần, trinh sát, chòi canh, lập kế hoạch tác chiến' : 'đánh nhanh, không hậu cần, trinh sát, chòi canh'})`))));
    }
    page.append(h('div', { class: 'devrow' }, toggle('Thời Trung cổ (mở lớp chiến tranh nâng cao)', 'Bật hoặc tắt riêng lớp thời Trung cổ mà không dựng lại trại', () => sim.era === 'ancient', (on) => { sim.setEra(on ? 'ancient' : 'stone'); })));
    page.append(h('div', { class: 'devrow' },
      toggle('Mọi việc miễn phí + xong ngay', 'Nghiên cứu, chế tạo, thuần thú, xây, nâng cấp và sửa: không tốn vật liệu, không mất thời gian (nhà vẫn cần người làm bên trong)', () => sim.dev.freeWorks, (on) => { sim.dev.freeWorks = on; sim.dev.fastWorks = on; sim.dev.instantBuild = on; }),
      toggle('Bất tử', 'Dân không nhận sát thương', () => sim.dev.god, (on) => { sim.dev.god = on; })));
    page.append(h('div', { class: 'devrow' }, h('small', { text: 'Nghiên cứu xong:' }),
      ...dev.RESEARCH_GROUPS.map((g) => btn(g.label, () => toast(dev.researchGroup(sim, g.key)), `Nghiên cứu xong mọi mục của nhóm ${g.label}, không tốn gì`)),
      btn('Tất cả', () => toast(dev.researchGroup(sim, 'all')), 'Nghiên cứu xong cả cây, kể cả các bản vẽ')));
    page.append(h('div', { class: 'devrow' },
      btn('+5 dân', () => toast(dev.addPeople(sim, 5)), 'Thêm 5 dân rảnh quanh lửa trại, kể cả khi vượt sức chứa'),
      btn('+100 mỗi tài nguyên', () => dev.addAllStock(sim, 100), 'Cộng 100 mỗi loại (không quá sức chứa)'),
      btn('Đầy quân + đồ cao nhất + đuốc', () => toast(dev.fullArmy(sim)), 'Mọi trại lính đầy quân, ai cũng có vũ khí và giáp tốt nhất của thời đại và một cây đuốc'),
      btn('Gọi sự kiện (theo cấp lửa)', () => toast(dev.callEvent(sim)), 'Gọi ngay sự kiện đã hẹn mạnh nhất mà trại cấp lửa hiện tại đủ sức đón')));

    page.append(h('div', { class: 'devrow' },
      ...[1, 2, 3, 4].map((n) => btn(`Trại cấp ${n} + nghiên cứu/đồ đủ cấp ${n}`, () => toast(dev.campFullKit(sim, n)), `Trại cấp ${n} thời Đá, nghiên cứu xong mọi mục mà Nhà nghiên cứu cấp ${n} mở, kho đủ đồ mà Nhà chế tạo cấp ${n} làm được, lính tự trang bị đồ tốt nhất mở được + đuốc`)),
      ...([['weak', 'yếu'], ['normal', 'thường'], ['medium', 'trung bình']] as const).map(([tier, name]) => btn(`Làng ${name} làm đồng minh`, () => toast(dev.allyTier(sim, tier)), `Làng ${name} gần nhất còn tự do thành chư hầu ngay: gửi quân giúp khi ta đi đánh`)),
      btn('Đánh boss', () => toast(dev.attackBoss(sim)), 'Phát hiện boss gần nhất (bản đồ đầy đủ) rồi đưa toàn quân đi đánh (đánh nhanh thời Đá)')));

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
        return h('div', { class: 'devrow' }, h('small', { text: line }), h('button', { class: 'sm', text: 'Phát hiện', title: 'Chỉ để thử: làng này hiện trong Lều họp chiến như đã được trinh sát đủ', onclick: () => { toast(dev.discoverTribe(sim, t.id)); ctl.onChange(); } }), h('button', { class: 'sm', text: 'Camera tới', title: 'Chỉ để thử: đưa camera tới trại này (sương mù vẫn che nếu chưa khám phá)', onclick: () => { ctl.centerOn(t.camp.x * TILE, t.camp.y * TILE); this.close(); } }));
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
      h('li', {}, h('b', { text: 'Chiến đấu' }), `: dân thường không đánh nhau, thấy địch là chạy về lửa trại. Muốn có lính thì giao nghề Chiến binh (huy hiệu đỏ trên đầu) hoặc Thợ săn (huy hiệu vàng), phát vũ khí ở thẻ dân → Chiến đấu, rồi chạm vào thú hoặc địch. Thế đứng: Chủ động, Phòng thủ, Rút lui. F: tấn công–đi, H: giữ chỗ, G: dừng. Hết máu là chết, không ai cứu được.`),
      h('li', {}, h('b', { text: 'Bộ tộc' }), `: tặng thức ăn để tăng quan hệ. Hạ thủ lĩnh hoặc chiếm đống lửa của họ ${gameDays(30, dayLength('stone'))} để họ xin hàng, rồi chọn thu nạp hoặc cống nạp.`),
      h('li', {}, h('b', { text: 'Phím' }), ': P tạm dừng, Q E R T: tốc độ 1× 2× 4× 16×, B xây Kho, X xây Xưởng, 1–9 gọi nhóm (Ctrl + số để lưu), Space nhảy tới dân đang chọn, Esc bỏ chọn.'),
    );
  }
}
