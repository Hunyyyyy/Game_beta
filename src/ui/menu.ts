import { BUILDINGS, levelDef } from '../sim/buildings';
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
      const go = h('button', { class: 'sm', text: 'Tới trại', onclick: () => { ctl.centerOn(t.camp.x * TILE, t.camp.y * TILE); this.close(); } });
      const bar = h('div', { class: 'tribe-bar' }, fill, h('u'));
      const card = h('div', { class: 'card', hidden: true }, h('div', { class: 'cardhead' }, h('b', { text: t.def.name }), h('span', { text: PERSONALITY[t.def.personality] }), status), bar, people,
        h('p', { class: 'sub', text: `Phần thưởng: ${t.def.reward}` }), h('div', { class: 'btns' }, gift, tribute, adopt, go));
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
    page.append(hint('Lưu và tải', 'Game tự lưu vào đầu mỗi ngày và khi bạn rời trang. Bản lưu nằm trong trình duyệt của máy này. Tốc độ game và lời nhắc xoay ngang là cài đặt của bạn, không nằm trong bản lưu.'), info,
      h('div', { class: 'btns' },
        h('button', { class: 'sm primary', text: 'Lưu ngay', onclick: () => { void session.save().then((ok) => { if (ok) toast('Đã lưu'); void refresh(); }); } }),
        h('button', { class: 'sm', text: 'Tải bản lưu', onclick: () => { void session.resume('auto').then((ok) => { toast(ok ? 'Đã tải lại ván chơi' : 'Chưa có bản lưu'); this.close(); }); } }),
        fresh));
    let last = -1e9;
    this.updaters.push(() => { const now = performance.now(); if (!page.hidden && now - last > 2000) { last = now; void refresh(); } });
    return page;
  }

  // ---------------------------------------------------------------- dev tools
  private devPage(): HTMLElement {
    const { sim, ctl, toast } = { ...this.c, toast: this.c.toast }, page = h('div', { class: 'page' });
    const sel = () => [...ctl.selected];
    const btn = (text: string, fn: () => void, title = '') => h('button', { class: 'sm', text, title, onclick: () => { fn(); ctl.onChange(); this.update(); } });
    const row = (label: string, ...kids: Array<Node | string>) => h('div', { class: 'devrow' }, h('span', { text: label }), ...kids);
    const toggle = (label: string, key: keyof typeof sim.dev, tip: string) => { const b = h('button', { class: 'sm', text: label, title: tip, pressed: sim.dev[key], onclick: () => { sim.dev[key] = !sim.dev[key]; b.setAttribute('aria-pressed', String(sim.dev[key])); } }); return b; };
    // ---- battle testing
    page.append(hint('Thử chiến đấu', 'Bấm "Mở hết để đánh" trước: nhà cấp cao nhất, mọi nghiên cứu, kho đầy, đồ trong kho. Rồi lập quân, dựng phòng tuyến, đưa cung thủ lên chòi và gọi địch tới. Bật "Bất tử" nếu chỉ muốn xem địch phá hàng rào.'));
    page.append(h('div', { class: 'devrow' }, btn('Mở hết để đánh', () => { dev.combatReady(sim); toast('Đã mở hết: nhà, nghiên cứu, kho, đồ'); }, 'Nhà cấp cao nhất, mọi nghiên cứu, kho đầy, vũ khí trong kho, Nhà chung cấp 4'),
      btn('Dựng phòng tuyến', () => { const n = dev.defenseLine(sim); toast(n ? `Đã dựng ${n} đoạn rào, cổng và chòi quanh làng` : 'Không dựng được (chưa mở hết?)'); }, 'Vòng rào có cổng phía nam và hai chòi canh'),
      btn('Cung thủ lên chòi', () => toast(`${dev.garrisonTowers(sim)} cung thủ lên chòi`)),
      btn('Mở mọi cổng', () => sim.setGates(true)), btn('Đóng mọi cổng', () => sim.setGates(false))));
    page.append(h('p', { class: 'sub', text: 'Chiến lược (Lều họp chiến, tab Chiến):' }));
    page.append(h('div', { class: 'devrow' }, btn('Bản đồ cấp 3 mọi làng', () => dev.giveMaps(sim, 3)), btn('Lập 3 đội mẫu', () => { dev.formSquads(sim); toast('Ba đội đã lập: giáo binh, cung thủ, xung kích'); }),
      btn('Kế hoạch tấn công mẫu', () => { const p = dev.sampleAttack(sim); toast(p ? 'Đã soạn kế hoạch mẫu: mở tab Chiến → Kế hoạch tấn công' : 'Lập đội mẫu trước'); }), btn('Kế hoạch phòng thủ mẫu', () => { const p = dev.sampleDefense(sim); toast(p ? 'Đã soạn mẫu phòng thủ' : 'Lập đội mẫu trước'); }),
      btn('Bắt đầu kế hoạch tấn công', () => { const p = sim.plans.find((x) => x.kind === 'attack'); toast(p ? sim.startPlan(p) ?? 'Kế hoạch bắt đầu' : 'Chưa có kế hoạch'); }), btn('Đánh trống báo động', () => { const e = sim.soundAlarm(); if (e) toast(e); })));
    page.append(h('p', { class: 'sub', text: 'Lập quân (tuyển và phát đồ ngay):' }));
    for (const n of [4, 12]) page.append(h('div', { class: 'devrow' }, ...(Object.keys(dev.DEV_KITS) as dev.DevKit[]).map((k) => btn(`+${n} ${dev.DEV_KITS[k].name}`, () => { dev.raiseArmy(sim, k, n); }))));
    page.append(h('p', { class: 'sub', text: 'Địch tới (Rìu Đá):' }));
    const wave = (label: string, weapons: string[]) => btn(label, () => { const e = dev.enemyWave(sim, 'axe', weapons); if (e) toast(e); });
    page.append(h('div', { class: 'devrow' }, wave('6 bộ binh', dev.times(6, 'club')), wave('6 giáo', dev.times(6, 'spear')), wave('6 cung thủ', [...dev.times(3, 'bow'), ...dev.times(3, 'sling')]),
      wave('12 hỗn hợp', [...dev.times(4, 'club'), ...dev.times(4, 'spear'), ...dev.times(4, 'bow')]), wave('24 hỗn hợp', [...dev.times(8, 'club'), ...dev.times(8, 'spear'), ...dev.times(8, 'bow')])));
    page.append(h('div', { class: 'devrow' }, btn('Hồi đầy lính', () => dev.heal(sim, sim.villagers.filter((v) => v.job === 'fight').map((v) => v.id))), btn('Xóa hết địch', () => { for (const f of [...sim.foes].filter((u) => u.ai?.role === 'raider')) sim.killFoe(f); })));

    page.append(hint('Tài nguyên', 'Công cụ dev để thử game nhanh, không dùng khi chơi thật.'));
    for (const res of RES_LIST) page.append(row(RES_NAME[res], btn('−10', () => dev.addStock(sim, res, -10)), btn('+10', () => dev.addStock(sim, res, 10)), btn('+50', () => dev.addStock(sim, res, 50)), btn('+200', () => dev.addStock(sim, res, 200))));
    page.append(row('Kho', btn('Đầy kho', () => dev.fillStock(sim))), h('div', { class: 'devrow' }, toggle('Xây miễn phí', 'freeBuild', 'Không tốn vật liệu khi xây và nâng cấp'), toggle('Xây tức thì', 'instantBuild', 'Công trình xong ngay'),
      toggle('Bất tử', 'god', 'Dân không nhận sát thương'), toggle('Không mệt', 'noTire', 'Sức của dân không tụt khi làm việc'), toggle('Làm việc nhanh ×25', 'fastWorks', 'Nghiên cứu, chế tạo nhanh gấp 25 lần')), h('div', { class: 'devrow' }, btn('Khám phá toàn bản đồ', () => dev.revealMap(sim))));

    const rsec = h('div', {}, h('h3', { text: 'Nghiên cứu' }), h('div', { class: 'devrow' }, btn('Mở hết nghiên cứu', () => dev.unlockResearch(sim), 'Mọi công thức và cấp công trình'), btn('Khóa lại hết', () => dev.resetResearch(sim))));
    page.append(rsec); this.updaters.push(() => { rsec.hidden = !RESEARCH.enabled; });
    page.append(hint('Nhà và luồng chế tạo', 'Thử luồng: mở hết nghiên cứu hoặc dựng sẵn nhà → bật "tự lấy đồ" và "tự đặt hàng" → làm hỏng công cụ dân đang chọn → xem họ tới Kho, Nhà chế tạo.'));
    page.append(h('div', { class: 'devrow' }, btn('Dựng sẵn mọi nhà', () => dev.buildAll(sim), 'Xây xong ngay các nhà còn thiếu, bỏ qua nghiên cứu'), btn('Nâng mọi nhà tối đa', () => dev.maxBuildings(sim)), btn('Xếp người vào các nhà', () => dev.staffAll(sim), 'Mỗi nhà đầy người làm việc phù hợp nhất')));
    page.append(h('div', { class: 'devrow' }, btn('Làm hỏng công cụ của dân chọn', () => dev.wearTools(sim, sel(), 0)), btn('Mòn còn 50%', () => dev.wearTools(sim, sel(), 0.5)), btn('Thu hết công cụ', () => { for (const k of TOOL_KINDS) sim.giveTool(sel(), k, 0); })));
    page.append(h('h3', { text: 'Công cụ, vũ khí, giáp' }));
    page.append(row('Kho đồ', btn('+3 mỗi loại vào kho', () => dev.stockWorkshop(sim, 3), 'Công cụ, vũ khí và giáp có sẵn trong kho')));
    const tools = h('div', { class: 'devrow' });
    for (const k of TOOL_KINDS) for (const tier of [1, 2]) tools.append(btn(`${TOOL_NAME[k]} ${TIER_NAME[tier].toLowerCase()}`, () => sim.giveTool(sel(), k, tier), 'Cấp cho dân đang chọn'));
    tools.append(btn('Thu công cụ', () => { for (const k of TOOL_KINDS) sim.giveTool(sel(), k, 0); }));
    page.append(h('p', { class: 'sub', text: 'Cho dân đang chọn:' }), tools);
    const gear = h('div', { class: 'devrow' });
    for (const id of Object.keys(WEAPONS)) if (id !== 'fist') gear.append(btn(WEAPONS[id].name, () => sim.giveGear(sel(), id, 'weapon')));
    gear.append(btn('Tay không', () => sim.giveGear(sel(), null, 'weapon')), btn('Áo da', () => sim.giveGear(sel(), 'hide', 'armor')), btn('Bỏ giáp', () => sim.giveGear(sel(), null, 'armor')));
    page.append(gear);

    page.append(h('h3', { text: 'Dân đang chọn' }));
    const who = h('p', { class: 'sub' }); page.append(who);
    const statVals = new Map<StatKey, HTMLElement>();
    for (const k of Object.keys(STAT_NAME) as StatKey[]) { const v = h('b', { text: '–' }); statVals.set(k, v); page.append(row(STAT_NAME[k], btn('−', () => dev.bumpStat(sim, sel(), k, -1)), v, btn('+', () => dev.bumpStat(sim, sel(), k, 1)))); }
    page.append(h('div', { class: 'devrow' }, btn('Hồi đầy máu', () => dev.heal(sim, sel())), btn('Ngã xuống', () => { for (const id of sel()) sim.hurt({ kind: 'unit', id }, 9999, 'crush', { x: 0, y: 0 }, {}); }), btn('Xóa dân', () => dev.eachSelected(sim, sel(), (v) => sim.killUnit(v, '(dev)')))));
    page.append(h('div', { class: 'devrow' }, btn('+1 dân', () => dev.addVillagers(sim, 1)), btn('+5 dân', () => dev.addVillagers(sim, 5))));
    this.updaters.push(() => {
      const v = sel().map((id) => sim.get(id)).find((u) => u && u.team === 'player');
      who.textContent = v ? `${v.name}${ctl.selected.size > 1 ? ` (và ${ctl.selected.size - 1} người khác, chỉ số hiện của người đầu tiên)` : ''}` : 'Chưa chọn dân nào.';
      for (const [k, el] of statVals) el.textContent = v ? String(v.stats[k]) : '–';
    });

    page.append(h('h3', { text: 'Thời gian và thời tiết' }));
    page.append(h('div', { class: 'devrow' }, btn('Sáng', () => dev.setTimeOfDay(sim, 0.3)), btn('Trưa', () => dev.setTimeOfDay(sim, 0.5)), btn('Chiều', () => dev.setTimeOfDay(sim, 0.78)), btn('Đêm', () => dev.setTimeOfDay(sim, 0.95)), btn('+1 ngày', () => dev.skipDays(sim, 1)), btn('+5 ngày', () => dev.skipDays(sim, 5))));
    page.append(h('div', { class: 'devrow' }, ...SEASONS.map((s) => btn(SEASON_NAME[s], () => dev.setSeason(sim, s)))));
    page.append(h('div', { class: 'devrow' }, ...(Object.keys(WEATHER) as WeatherKind[]).map((k) => btn(WEATHER[k].name, () => dev.setWeather(sim, k)))));

    page.append(h('h3', { text: 'Sự kiện, thú, bộ tộc' }));
    page.append(h('div', { class: 'devrow' }, btn('Sói ×4 tới', () => dev.wolvesNow(sim, 4)), btn('Sói ×8 tới', () => dev.wolvesNow(sim, 8)), btn('Xóa hết thú', () => dev.clearAnimals(sim))));
    page.append(h('div', { class: 'devrow' }, ...dev.DEV_SPECIES.map((s) => btn(`+3 ${s}`, () => { const c = this.center(); dev.spawnAt(sim, s, c.x, c.y, 3); }, 'Sinh thú ở giữa màn hình'))));
    for (const id of dev.DEV_TRIBES) {
      const t = sim.tribes.find((x) => x.id === id); if (!t) continue;
      page.append(row(t.def.name.slice(0, 9), btn('Tập kích', () => { const e = dev.raidNow(sim, id as TribeId, 10); if (e) toast(e); }), btn('Đầu hàng', () => dev.surrenderNow(sim, id as TribeId)),
        btn('Quan hệ −20', () => dev.bumpRelation(sim, id as TribeId, -20)), btn('+20', () => dev.bumpRelation(sim, id as TribeId, 20)), btn('Tới trại', () => { ctl.centerOn(t.camp.x * TILE, t.camp.y * TILE); this.close(); })));
    }
    return page;
  }

  // ---------------------------------------------------------------- controls
  private helpPage(): HTMLElement {
    return h('ul', { class: 'help' },
      h('li', {}, h('b', { text: 'Chọn dân' }), ': bấm vào dân. Bấm đúp để chọn mọi dân cùng nghề đang hiện trên màn hình. "Chọn nhiều" để bấm từng người hoặc kéo khung; "Chọn hết" chọn cả làng.'),
      h('li', {}, h('b', { text: 'Ra lệnh' }), ': máy tính: chuột phải. Điện thoại: khi đã chọn dân, chạm lên đất, cây, đá, bụi quả, công trường hay kẻ địch. Giữ Shift (máy tính) để xếp lệnh nối nhau.'),
      h('li', {}, h('b', { text: 'Kéo bản đồ' }), ': máy tính: giữ chuột phải rồi kéo (hoặc W A S D). Điện thoại: hai ngón tay; chụm hoặc mở hai ngón để thu phóng.'),
      h('li', {}, h('b', { text: 'Bản đồ nhỏ' }), ': bấm vào để mở bản đồ lớn, chạm một chỗ để nhảy tới đó.'),
      h('li', {}, h('b', { text: 'Công trình' }), `: bấm 🔨 Xây (góc trên) để chọn công trình rồi chạm bản đồ đặt. Mở Menu → Công trình, hoặc bấm vào công trình trên bản đồ: lửa trại cho xem dân, Kho cho xem tài nguyên, Nhà nghiên cứu để vẽ bản vẽ, Nhà chế tạo để làm đồ. Mỗi loại công trình chỉ xây một cái rồi nâng cấp (đơn sơ → gỗ → đá, mỗi bước phải nghiên cứu). Dân vào làm bên trong nhà (hiện thành danh sách tên, không hiện trên bản đồ): nhà cấp cao chứa thêm người, càng đông càng nghiên cứu nhanh. Lúc đầu bạn tự phát công cụ; nghiên cứu Kho công cụ, Kho vũ khí, tự lấy đồ và tự đặt hàng thì dân tự lo. Tiền (vỏ sò) trả cho nghiên cứu, nhặt khi hái lượm hoặc đổi hàng ở Kho. Trong bảng công trình còn có nút Dời (tốn 1/5 vật liệu, phải dựng lại) và Phá bỏ (thu lại một nửa).`),
      h('li', {}, h('b', { text: 'Chiến đấu' }), `: dân thường không đánh nhau, thấy địch là chạy về lửa trại. Muốn có lính thì giao nghề Chiến binh (huy hiệu đỏ trên đầu) hoặc Thợ săn (huy hiệu vàng), phát vũ khí ở thẻ dân → Chiến đấu, rồi chạm vào thú hoặc địch. Thế đứng: Chủ động, Phòng thủ, Rút lui. F: tấn công–đi, H: giữ chỗ, G: dừng. Người bị thương nặng ngã xuống ${gameDays(30)}; một người khác đứng cạnh ${gameDays(3)} sẽ kéo họ dậy.`),
      h('li', {}, h('b', { text: 'Bộ tộc' }), `: tặng thức ăn để tăng quan hệ. Hạ thủ lĩnh hoặc chiếm đống lửa của họ ${gameDays(30)} để họ xin hàng, rồi chọn thu nạp hoặc cống nạp.`),
      h('li', {}, h('b', { text: 'Phím' }), ': P tạm dừng, Q E R T: tốc độ 1× 2× 4× 16×, B xây Kho, X xây Xưởng, 1–9 gọi nhóm (Ctrl + số để lưu), Space nhảy tới dân đang chọn, Esc bỏ chọn.'),
    );
  }
}
