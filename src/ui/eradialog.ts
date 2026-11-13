import { h } from './dom';
import { dlg, GameDialog } from './gamedialog';

/** A short burst of coloured paper over the whole screen, then it removes itself. */
function confetti(ms = 3600): void {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:200';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.append(cv);
  const c = cv.getContext('2d')!, colors = ['#f6c343', '#e8553d', '#4cb5ae', '#7a6ff0', '#f28ab2', '#8bd450'];
  const bits = Array.from({ length: 140 }, () => ({
    x: cv.width / 2 + (Math.random() - 0.5) * cv.width * 0.3, y: cv.height * 0.35, vx: (Math.random() - 0.5) * 9, vy: -3 - Math.random() * 8,
    s: 4 + Math.random() * 5, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, col: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const step = (now: number): void => {
    const t = now - t0;
    if (t > ms) { cv.remove(); return; }
    c.clearRect(0, 0, cv.width, cv.height);
    c.globalAlpha = Math.min(1, (ms - t) / 800);
    for (const b of bits) {
      b.vy += 0.22; b.vx *= 0.995; b.x += b.vx; b.y += b.vy; b.a += b.va;
      c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.fillStyle = b.col; c.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); c.restore();
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** The congratulation when the village steps into the next age (the campfire becomes the Nhà chính): a dialog and a little confetti. */
export class EraDialog {
  private readonly win: GameDialog;
  constructor(root: HTMLElement) { this.win = new GameDialog(root, {}); }

  show(): void {
    const close = () => this.win.hide();
    this.win.show(dlg.card({ label: 'Chuyển thời kỳ' },
      dlg.head({ pic: '🏰', title: 'Chúc mừng! Thời Trung cổ bắt đầu', sub: 'Nhà chung đã thành Nhà chính', onClose: close }),
      dlg.text('Làng của bạn đã bước sang một thời đại mới. Những điều mới đang chờ:'),
      h('ul', { class: 'dtext' },
        h('li', { text: 'Các nhà cấp 4 có thể nâng lên cấp trung cổ.' }),
        h('li', { text: 'Có thêm nghiên cứu và công trình mới.' }),
        h('li', { text: 'Các làng thời đồ đá biến mất, làng mới xuất hiện trên bản đồ.' }),
        h('li', { text: 'Chiến tranh không còn đánh nhanh: hãy lập kế hoạch kỹ.' })),
      dlg.button('Tiếp tục', close)));
    confetti();
  }
}
