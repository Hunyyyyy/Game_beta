// The page that shows the medieval soldiers moving: every unit, every action, looping. Built by tools/build-viewer.mjs into dist/medieval-viewer.html.
import { renderFrame, FW, FH } from '../../src/character/rig.js';
import { renderAnimal } from '../../src/character/animal-rig.js';
import anims from '../../src/data/anims.json';
import bodies from '../../src/data/animals/bodies.json';
import quad from '../../src/data/animals/anims/quadruped.json';
import horse from '../../src/data/animals/anims/horse.json';
import units from '../../src/data/medieval_units.json';

const CLIPS = { quadruped: quad, horse };
const ACTIONS = [['idle', 'Đứng yên'], ['walk', 'Đi bộ'], ['run', 'Chạy bộ'], ['attack', 'Tấn công'], ['guard', 'Phòng thủ']];
const FEET = { x: 34, y: 58 }, CW = 110, CH = 100, LOOK = { sex: 'm', skin: '#e0ac69', hair: '#3b2a1a', hide: '#8b6a45', pants: '#3f63a8' };
const $ = (id) => document.getElementById(id);
const state = { scale: 4, speed: 1, left: false, alt: false, pause: false };

function over(dst, dw, src, sw, sh, ox, oy) {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const k = (y * sw + x) * 4, a = src[k + 3], X = ox + x, Y = oy + y;
    if (!a || X < 0 || Y < 0 || X >= dw) continue;
    const o = (Y * dw + X) * 4; if (o + 3 >= dst.length) continue;
    const al = a / 255; for (let c = 0; c < 3; c++) dst[o + c] = Math.round(src[k + c] * al + dst[o + c] * (1 - al)); dst[o + 3] = Math.max(dst[o + 3], a);
  }
}
function flip(px, w, h) { const o = new Uint8ClampedArray(px.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (y * w + x) * 4, d = (y * w + (w - 1 - x)) * 4; o[d] = px[s]; o[d + 1] = px[s + 1]; o[d + 2] = px[s + 2]; o[d + 3] = px[s + 3]; } return o; }

/** One picture of a unit doing an action at time t (seconds). */
function pic(u, action, t) {
  const name = (state.alt && u.alt && u.alt[action]) || u.anims[action], an = anims[name], loops = an.loop !== false;
  const n = an.frames.length, step = Math.floor(t * an.fps * state.speed);
  const i = loops ? step % n : Math.min(step, n - 1);
  const person = renderFrame(anims, name, i, 'right', LOOK, 'wood', u.tool, u.armor);
  if (!u.mount) return { w: FW, h: FH, px: state.left ? flip(person, FW, FH) : person };
  const m = u.mount, def = { ...bodies[m.species], gear: m.gear ?? bodies[m.species].gear }, clips = CLIPS[def.body] ?? quad, clip = clips[m.clips[action]] ?? clips.idle;
  const bi = Math.floor(t * clip.fps * state.speed) % clip.frames.length, beast = renderAnimal(def, clip, bi), px = new Uint8ClampedArray(CW * CH * 4), gx = 56, gy = 92;
  for (let y = -3; y <= 3; y++) for (let x = -22; x <= 22; x++) if ((x * x) / 484 + (y * y) / 9 <= 1) { const o = ((gy + y) * CW + gx + x) * 4; px[o + 3] = 60; }
  over(px, CW, beast.data, beast.w, beast.h, gx - Math.floor(beast.w / 2), gy - (beast.h - 2));
  over(px, CW, person, FW, FH, gx - FEET.x + (m.dx ?? 0), gy - m.lift - FEET.y - (clip.frames[bi].bob || 0));
  return { w: CW, h: CH, px: state.left ? flip(px, CW, CH) : px };
}

const cards = [];
function build() {
  const root = $('units'); root.replaceChildren();
  cards.length = 0;
  for (const [id, u] of Object.entries(units)) {
    if (id.startsWith('_')) continue;
    const card = document.createElement('section'); card.className = 'unit';
    card.innerHTML = `<h2>${u.name}</h2><div class="acts"></div>`;
    const acts = card.querySelector('.acts');
    for (const [a, label] of ACTIONS) {
      const cell = document.createElement('figure'), cv = document.createElement('canvas');
      cv.width = u.mount ? CW : FW; cv.height = u.mount ? CH : FH;
      cv.style.width = cv.width * state.scale + 'px'; cv.style.height = cv.height * state.scale + 'px';
      cell.append(cv); const cap = document.createElement('figcaption'); cap.textContent = label; cell.append(cap); acts.append(cell);
      cards.push({ u, a, cv, ctx: cv.getContext('2d') });
    }
    root.append(card);
  }
}
const t0 = performance.now();
let last = 0;
function tick(now) {
  if (!state.pause) last = (now - t0) / 1000;
  for (const c of cards) {
    // an attack plays once and rests a moment before it starts again; the loops just go on
    const an = anims[(state.alt && c.u.alt && c.u.alt[c.a]) || c.u.anims[c.a]];
    const len = an.frames.length / (an.fps * state.speed), t = an.loop === false ? last % (len + 0.6 / state.speed) : last;
    const p = pic(c.u, c.a, t);
    c.ctx.clearRect(0, 0, c.cv.width, c.cv.height);
    c.ctx.putImageData(new ImageData(new Uint8ClampedArray(p.px), p.w, p.h), 0, 0);
  }
  requestAnimationFrame(tick);
}
$('scale').onchange = () => { state.scale = Number($('scale').value); build(); };
$('speed').onchange = () => { state.speed = Number($('speed').value); };
$('left').onchange = () => { state.left = $('left').checked; };
$('alt').onchange = () => { state.alt = $('alt').checked; };
$('pause').onchange = () => { state.pause = $('pause').checked; };
$('bg').onchange = () => { document.body.style.background = $('bg').value; };
build();
requestAnimationFrame(tick);
