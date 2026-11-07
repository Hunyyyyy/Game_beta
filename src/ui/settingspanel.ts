import { h } from './dom';
import { dlg } from './gamedialog';
import type { Ctx } from './ctx';

/**
 * The settings window (the cog at the top left): the volume and the switch of each kind of sound, the switch of the weather drawn on the map (rain, snow, storm),
 * and the way to the statistics of the research. Off means nothing is played or drawn, and nothing is worked out for it (lighter on a slow machine).
 */
export class SettingsPanel {
  readonly card: HTMLElement;
  private readonly syncs: Array<() => void> = [];

  constructor(private readonly c: Ctx, o: { close: () => void; openStats: () => void }) {
    const { sound, weatherFx } = c;
    const rows: HTMLElement[] = [];
    for (const [kind, label, tip] of [['sfx', 'Hiệu ứng', 'Làm việc, đánh nhau, đặt công trình, cổng, ra lệnh cho quân (phím O)'], ['amb', 'Môi trường', 'Mưa, bão, sấm, gió, chim, sói (phím I)'], ['mus', 'Nhạc', 'Nhạc bình yên, nhạc chiến tranh, thắng và thua (phím U)']] as const) {
      const on = h('input', { type: 'checkbox', title: 'Bật hoặc tắt' }) as HTMLInputElement;
      const range = h('input', { type: 'range', min: '0', max: '100', step: '5', title: tip }) as HTMLInputElement;
      const num = h('small', { text: '' });
      const apply = () => { sound.set(kind, on.checked, +range.value / 100); num.textContent = `${range.value}%`; };
      on.addEventListener('change', apply); range.addEventListener('input', apply);
      this.syncs.push(() => { const g = sound.get(kind); if (document.activeElement !== range) range.value = String(Math.round(g.vol * 100)); on.checked = g.on; num.textContent = `${range.value}%`; });
      rows.push(h('div', { class: 'row' }, h('div', { class: 'nm' }, label, h('small', { text: tip })), on, range, num));
    }
    const fx = h('input', { type: 'checkbox', title: 'Bật hoặc tắt' }) as HTMLInputElement;
    fx.addEventListener('change', () => weatherFx.set(fx.checked));
    this.syncs.push(() => { fx.checked = weatherFx.get(); });
    rows.push(h('div', { class: 'row' }, h('div', { class: 'nm' }, 'Hiệu ứng thời tiết', h('small', { text: 'Mưa, bão, tuyết, chớp trên bản đồ. Tắt đi thì game nhẹ hơn.' })), fx));
    this.card = dlg.card({ label: 'Cài đặt' },
      dlg.head({ pic: '⚙', title: 'Cài đặt', sub: 'Âm thanh, thời tiết', onClose: o.close }),
      h('section', { class: 'dsec' }, h('h3', { text: 'Âm thanh' }), ...rows.slice(0, 3)),
      h('section', { class: 'dsec' }, h('h3', { text: 'Hình ảnh' }), rows[3]),
      h('section', { class: 'dsec' }, h('button', { class: 'sm', type: 'button', text: '📊 Chỉ số đã nghiên cứu', title: 'Chỉ số đã nghiên cứu cho từng loại dân, nghề và lính', onclick: () => { o.close(); o.openStats(); } })));
  }

  /** Read the settings back into the controls (the keys O, I, U change them too). */
  update(): void { for (const s of this.syncs) s(); }
}
