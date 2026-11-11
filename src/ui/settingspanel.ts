import type { SaveMeta } from '../save/store';
import { levelOf, QUALITY_LEVELS, QUALITY_SETTINGS, type QualitySetting } from '../render/quality';
import { h } from './dom';
import { dlg } from './gamedialog';
import { confirmButton, saveTile, saveTitle } from './savelist';
import type { Ctx } from './ctx';

type Page = 'saves' | 'sound' | 'view';
const PAGES: Array<[Page, string]> = [['saves', '💾 Bản lưu'], ['sound', '🔊 Âm thanh'], ['view', '🖼 Hình ảnh']];

/**
 * The settings window (the cog at the top left), in three pages: the saved games (save now, save as a new game, the list to load from, the switch of the daily save, a new game),
 * the volume and the switch of each kind of sound, and the weather drawn on the map with the way to the statistics of the research.
 * Off means nothing is played or drawn, and nothing is worked out for it (lighter on a slow machine).
 */
export class SettingsPanel {
  readonly card: HTMLElement;
  private readonly syncs: Array<() => void> = [];
  private readonly pageEls = new Map<Page, HTMLElement>();
  private readonly tabBtns = new Map<Page, HTMLButtonElement>();
  private page: Page = 'saves';

  private saves: SaveMeta[] = [];
  private savesKey = '';
  private asked = -1e9;
  private readonly nowBox = h('div');
  private readonly listBox = h('div');
  private readonly listHead = h('h3', { text: 'Các bản lưu' });
  private saveBtn!: HTMLButtonElement;
  private newSaveBtn!: HTMLButtonElement;

  constructor(private readonly c: Ctx, private readonly o: { close: () => void; openStats: () => void; autosave: { get: () => boolean; set: (on: boolean) => void }; quality: { get: () => QualitySetting; set: (q: QualitySetting) => void } }) {
    const tabs = h('div', { class: 'dtabs' }, ...PAGES.map(([p, label]) => { const b = h('button', { class: 'sm', type: 'button', text: label, pressed: p === this.page, onclick: () => this.show(p) }); this.tabBtns.set(p, b); return b; }));
    this.pageEls.set('saves', this.savesPage());
    this.pageEls.set('sound', this.soundPage());
    this.pageEls.set('view', this.viewPage());
    this.card = dlg.card({ label: 'Cài đặt', wide: true, cls: 'gsettings' },
      dlg.head({ pic: '⚙', title: 'Cài đặt', sub: 'Bản lưu, âm thanh, hình ảnh', onClose: o.close }), tabs, ...this.pageEls.values());
    this.show(this.page);
  }

  private show(p: Page): void {
    this.page = p;
    for (const [k, b] of this.tabBtns) b.setAttribute('aria-pressed', String(k === p));
    for (const [k, el] of this.pageEls) el.hidden = k !== p;
    this.update();
  }

  // ---------------------------------------------------------------- saved games
  private savesPage(): HTMLElement {
    const { session, sim, toast } = this.c;
    const name = h('input', { type: 'text', class: 'dname-in', maxlength: '32', placeholder: 'Tên bản lưu mới (không bắt buộc)', 'aria-label': 'Tên bản lưu mới' }) as HTMLInputElement;
    this.saveBtn = dlg.button('💾 Lưu ngay', () => { void session.save().then((ok) => { if (ok) toast('Đã lưu'); void this.refresh(true); }); }, { title: 'Lưu đè lên bản lưu của ván đang chơi' });
    this.newSaveBtn = dlg.button('➕ Lưu thành bản mới', () => { void session.saveAsNew(name.value).then((ok) => { if (ok) { toast('Đã lưu thành bản mới'); name.value = ''; } void this.refresh(true); }); }, { tone: 'alt', title: 'Giữ bản cũ nguyên, lưu ván này vào một bản lưu mới và chơi tiếp trên bản mới' });

    const auto = h('input', { type: 'checkbox', title: 'Bật hoặc tắt' }) as HTMLInputElement;
    auto.addEventListener('change', () => this.o.autosave.set(auto.checked));
    this.syncs.push(() => { auto.checked = this.o.autosave.get(); });

    const fresh = confirmButton('🌱 Ván mới', 'Bấm lại để bắt đầu ván mới', () => session.newGame(), { tone: 'alt', title: 'Bắt đầu một ván khác trên bản đồ mới. Các bản lưu vẫn còn, tải lại lúc nào cũng được' });
    const titles = [this.saveBtn.title, this.newSaveBtn.title];
    this.syncs.push(() => {
      const war = sim.atWar(), why = war ? 'Đang chiến tranh: không lưu hay tải được cho tới khi trận kết thúc' : '';
      [this.saveBtn, this.newSaveBtn].forEach((b, i) => { b.disabled = war; b.title = war ? why : titles[i]; });
      this.refreshLocks();
    });
    return h('div', { class: 'dbody' },
      h('section', { class: 'dsec' }, h('h3', { text: 'Ván đang chơi' }), this.nowBox, name, dlg.buttons(this.saveBtn, this.newSaveBtn)),
      h('section', { class: 'dsec' }, h('h3', { text: 'Tự động lưu' }),
        h('div', { class: 'row' }, h('div', { class: 'nm' }, 'Lưu vào đầu mỗi ngày', h('small', { text: 'Cả khi bạn rời trang. Tắt đi thì chỉ lưu khi bạn bấm Lưu ngay. Bản lưu nằm trong trình duyệt của máy này.' })), auto)),
      h('section', { class: 'dsec' }, this.listHead, this.listBox),
      h('section', { class: 'dsec' }, fresh));
  }

  /** The tile of the game being played now. */
  private renderNow(): void {
    const { session, sim } = this.c, mine = this.saves.find((m) => m.id === session.slot);
    this.nowBox.replaceChildren(dlg.tile({ state: 'now', pic: '🔥', name: session.name || (mine ? saveTitle(mine) : `Ván ngày ${sim.day}`), chip: dlg.chip(mine ? 'đã lưu' : 'chưa lưu') },
      [dlg.more(`Bây giờ: ngày ${sim.day} · ${sim.villagers.length} dân`), dlg.more(mine ? `Lần lưu cuối: ${new Date(mine.savedAt).toLocaleString('vi')}` : 'Chưa có bản lưu của ván này: bấm Lưu ngay')]));
  }

  /** The list of saves, drawn again only when something in it changed (a redraw would undo a button waiting for its second press). */
  private renderList(): void {
    const { session, toast } = this.c;
    this.listHead.textContent = `Các bản lưu (${this.saves.length})`;
    const war = this.c.sim.atWar() ? 'Đang chiến tranh: chưa tải được' : null;
    this.listBox.replaceChildren(this.saves.length
      ? dlg.list(...this.saves.map((m) => saveTile(m, {
        current: m.id === session.slot, locked: war,
        onLoad: () => { void session.open(m).then((r) => { if (r === 'loaded') { toast('Đã tải ván chơi'); this.o.close(); } else if (r === 'failed') toast('Không đọc được bản lưu'); }); },
        onDelete: () => { void session.remove(m.id).then(() => { toast('Đã xóa bản lưu'); void this.refresh(true); }); },
      })))
      : dlg.empty('Chưa có bản lưu nào.'));
  }

  /** The load buttons follow the war, which can begin while the window is open. */
  private refreshLocks(): void {
    const war = this.c.sim.atWar();
    for (const b of this.listBox.querySelectorAll<HTMLButtonElement>('.dacts button:first-child')) { b.disabled = war; b.title = war ? 'Đang chiến tranh: chưa tải được' : 'Chơi tiếp từ bản lưu này'; }
  }

  private async refresh(force = false): Promise<void> {
    const now = performance.now();
    if (!force && now - this.asked < 2500) return;
    this.asked = now;
    const list = await this.c.session.list(), key = `${this.c.session.slot}|${list.map((m) => `${m.id}.${m.savedAt}.${m.name ?? ''}`).join()}`;
    this.saves = list;
    if (key !== this.savesKey) { this.savesKey = key; this.renderList(); }
    this.renderNow();
  }

  // ---------------------------------------------------------------- sound and view
  private soundPage(): HTMLElement {
    const { sound } = this.c, rows: HTMLElement[] = [];
    for (const [kind, label, tip] of [['sfx', 'Hiệu ứng', 'Làm việc, đánh nhau, đặt công trình, cổng, ra lệnh cho quân (phím O)'], ['amb', 'Môi trường', 'Mưa, bão, sấm, gió, chim, sói (phím I)'], ['mus', 'Nhạc', 'Nhạc bình yên, nhạc chiến tranh và nhạc khi thua (phím U)'], ['voice', 'Giọng người', 'Tiếng hô khi bạn ra lệnh cho quân, tiếng hò reo khi trận đánh nổ ra và khi thắng trận']] as const) {
      const on = h('input', { type: 'checkbox', title: 'Bật hoặc tắt' }) as HTMLInputElement;
      const range = h('input', { type: 'range', min: '0', max: '100', step: '5', title: tip }) as HTMLInputElement;
      const num = h('small', { text: '' });
      const apply = () => { sound.set(kind, on.checked, +range.value / 100); num.textContent = `${range.value}%`; };
      on.addEventListener('change', apply); range.addEventListener('input', apply);
      this.syncs.push(() => { const g = sound.get(kind); if (document.activeElement !== range) range.value = String(Math.round(g.vol * 100)); on.checked = g.on; num.textContent = `${range.value}%`; });
      rows.push(h('div', { class: 'row' }, h('div', { class: 'nm' }, label, h('small', { text: tip })), on, range, num));
    }
    return h('div', { class: 'dbody' }, h('section', { class: 'dsec' }, h('h3', { text: 'Âm thanh' }), ...rows));
  }

  private viewPage(): HTMLElement {
    const { weatherFx } = this.c, o = this.o;
    // how much the screen draws: by the device, or one of the levels
    const labels: Record<QualitySetting, string> = { auto: 'Tự động', high: QUALITY_LEVELS.high.name, balanced: QUALITY_LEVELS.balanced.name, saver: QUALITY_LEVELS.saver.name };
    const note = h('small', { class: 'dsub', text: '' });
    const btns = new Map<QualitySetting, HTMLButtonElement>();
    const showQuality = () => {
      const now = o.quality.get(), lv = QUALITY_LEVELS[levelOf(now)];
      for (const [k, b] of btns) b.setAttribute('aria-pressed', String(k === now));
      note.textContent = `${now === 'auto' ? `Tự động chọn mức ${lv.name} cho máy này. ` : ''}${lv.note}`;
    };
    for (const q of QUALITY_SETTINGS) btns.set(q, h('button', { class: 'sm', type: 'button', text: labels[q], onclick: () => { o.quality.set(q); showQuality(); } }));
    showQuality();
    const fx = h('input', { type: 'checkbox', title: 'Bật hoặc tắt' }) as HTMLInputElement;
    fx.addEventListener('change', () => weatherFx.set(fx.checked));
    this.syncs.push(() => { fx.checked = weatherFx.get(); });
    return h('div', { class: 'dbody' },
      h('section', { class: 'dsec' }, h('h3', { text: 'Đồ họa' }), h('div', { class: 'dtabs' }, ...btns.values()), note,
        h('small', { class: 'dsub', text: 'Chỉnh theo máy: điện thoại nóng hoặc giật khi chơi lâu hay đánh trận lớn thì chọn Cân bằng hoặc Tiết kiệm. Tốc độ game không đổi, chỉ số hình vẽ mỗi giây và độ nét.' })),
      h('section', { class: 'dsec' }, h('h3', { text: 'Hình ảnh' }), h('div', { class: 'row' }, h('div', { class: 'nm' }, 'Hiệu ứng thời tiết', h('small', { text: 'Mưa, bão, tuyết, chớp trên bản đồ. Tắt đi thì game nhẹ hơn.' })), fx)),
      h('section', { class: 'dsec' }, h('h3', { text: 'Thống kê' }),
        h('button', { class: 'sm', type: 'button', text: '📊 Chỉ số đã nghiên cứu', title: 'Chỉ số đã nghiên cứu cho từng loại dân, nghề và lính', onclick: () => { o.close(); o.openStats(); } })));
  }

  /** Read the settings back into the controls (the keys O, I, U change them too) and look at the saves now and then. */
  update(): void {
    for (const s of this.syncs) s();
    if (this.page === 'saves') void this.refresh();
  }

  /** The window was just opened: look at the saves at once. */
  opened(): void { this.show(this.page); void this.refresh(true); }
}
