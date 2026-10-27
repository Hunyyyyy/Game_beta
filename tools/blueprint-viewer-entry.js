import blueprints from 'virtual:blueprints';
import '../src/blueprint/engine.js';

const Blueprint = globalThis.Blueprint;
const $ = (id) => document.getElementById(id);
const BG = { grass: '#6d8f4e', dark: '#262626', light: '#e8e4d8' };
const names = Object.keys(blueprints).sort();
const edited = {};           // name -> edited JSON text (kept while you switch between blueprints)
let cur = '', frame = 0, playing = true, last = 0, acc = 0, nf = 1, fps = 4, paramKeys = '', params = {};
let result = null;

const tmp = document.createElement('canvas'), cv = $('cv');
const pretty = (def) => JSON.stringify(def, null, 1);

// ---- rendering -------------------------------------------------------------
function draw(canvas, res, f, bg, Z, marks, grid) {
  canvas.width = res.w * Z; canvas.height = res.h * Z;
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
  if (bg === 'checker') {
    for (let j = 0; j < res.h; j++) for (let i = 0; i < res.w; i++) { g.fillStyle = (i + j) % 2 ? '#3a3a3a' : '#333'; g.fillRect(i * Z, j * Z, Z, Z); }
  } else { g.fillStyle = BG[bg] || BG.grass; g.fillRect(0, 0, canvas.width, canvas.height); }
  tmp.width = res.w; tmp.height = res.h;
  tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(res.frames[f % res.frames.length]), res.w, res.h), 0, 0);
  g.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  if (grid) {
    g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i <= res.w; i++) { g.moveTo(i * Z + .5, 0); g.lineTo(i * Z + .5, canvas.height); }
    for (let j = 0; j <= res.h; j++) { g.moveTo(0, j * Z + .5); g.lineTo(canvas.width, j * Z + .5); }
    g.stroke();
  }
  if (marks) {
    if (res.footprint) { const [x, y, w, h] = res.footprint; g.strokeStyle = '#4fd1ff'; g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(x * Z, y * Z, w * Z, h * Z); g.setLineDash([]); }
    if (res.anchor) { const [x, y] = res.anchor; g.strokeStyle = '#ff3b3b'; g.lineWidth = 2; g.beginPath(); g.moveTo(x * Z - 8, y * Z + Z / 2); g.lineTo(x * Z + Z + 8, y * Z + Z / 2); g.moveTo(x * Z + Z / 2, y * Z - 8); g.lineTo(x * Z + Z / 2, y * Z + Z + 8); g.stroke(); }
  }
}
const parseDef = (text) => JSON.parse(text);
const seedOf = (def) => { const n = parseInt($('seed').value, 10); return Number.isNaN(n) ? (def.seed ?? 1) : n; };

function thumb(def, canvas, p) {
  try { const r = Blueprint.render(def, { seed: def.seed ?? 1, params: p }); draw(canvas, r, 0, 'grass', 2, false, false); } catch (_) { canvas.width = canvas.height = 1; }
}

function render() {
  let def;
  try { def = parseDef($('src').value); } catch (e) { $('err').textContent = 'JSON error: ' + e.message; return; }
  $('err').textContent = '';
  syncParams(def);
  try { result = Blueprint.render(def, { seed: seedOf(def), params }); }
  catch (e) { $('err').textContent = 'Render error: ' + e.message; return; }
  $('warn').textContent = result.warnings.length ? 'Warnings: ' + result.warnings.join(' · ') : '';
  nf = result.frames.length; fps = result.fps || 4;
  $('play').style.display = nf > 1 ? '' : 'none';
  const Z = Math.max(3, Math.min(24, Math.floor(700 / Math.max(result.w, result.h))));
  draw(cv, result, frame, $('bg').value, Z, $('marks').checked, $('grid').checked);
  $('info').textContent = `${cur}.json · ${result.w}×${result.h}` + (nf > 1 ? ` · frame ${frame % nf + 1}/${nf} · ${fps} fps` : '') + (result.anchor ? ` · anchor ${result.anchor}` : '') + (result.footprint ? ` · footprint ${result.footprint}` : '');
  drawStages(def);
  const item = $('list').querySelector(`[data-name="${cur}"] canvas`); if (item) thumb(def, item, params);
  $('list').querySelector(`[data-name="${cur}"]`)?.classList.toggle('mod', edited[cur] !== undefined);
}

// ---- parameters ------------------------------------------------------------
function syncParams(def) {
  const defaults = def.params && typeof def.params === 'object' ? def.params : {};
  const keys = Object.keys(defaults).join(',');
  if (keys === paramKeys) return;
  paramKeys = keys;
  const next = {}; for (const k of Object.keys(defaults)) next[k] = k in params ? params[k] : defaults[k];
  params = next;
  const box = $('params'); box.innerHTML = '';
  for (const k of Object.keys(params)) {
    const lab = document.createElement('label'), inp = document.createElement('input');
    const flag = defaults[k] === 0 || defaults[k] === 1;
    inp.type = flag ? 'checkbox' : 'number'; if (flag) inp.checked = !!params[k]; else inp.value = params[k];
    inp.dataset.k = k;
    inp.onchange = () => { params[k] = flag ? (inp.checked ? 1 : 0) : +inp.value; render(); };
    lab.append(inp, ' ' + k); box.appendChild(lab);
  }
  if (!Object.keys(params).length) box.textContent = 'No parameters.';
}
function setParams(p) {
  Object.assign(params, p);
  for (const inp of $('params').querySelectorAll('input')) { const v = params[inp.dataset.k]; if (inp.type === 'checkbox') inp.checked = !!v; else inp.value = v; }
  render();
}
// Construction stages (st1..stN): one picture per stage, click to show it.
function drawStages(def) {
  const box = $('stages'), ks = Object.keys(params).filter((k) => /^st\d+$/.test(k)).sort((a, b) => +a.slice(2) - +b.slice(2));
  box.innerHTML = '';
  if (!ks.length) return;
  const lab = document.createElement('span'); lab.textContent = 'Stages:'; box.appendChild(lab);
  ks.forEach((k, i) => {
    const p = { ...params }; ks.forEach((kk, j) => { p[kk] = j <= i ? 1 : 0; });
    const wrap = document.createElement('div'), c = document.createElement('canvas');
    wrap.className = 'stage'; c.title = 'Show stage ' + (i + 1);
    thumb(def, c, p);
    const t = document.createElement('div'); t.textContent = 'stage ' + (i + 1);
    wrap.append(c, t); wrap.onclick = () => setParams(p);
    box.appendChild(wrap);
  });
}

// ---- blueprint list / switching ---------------------------------------------
function select(name) {
  cur = name; frame = 0; paramKeys = ''; params = {}; $('seed').value = '';
  $('src').value = edited[name] ?? pretty(blueprints[name]);
  for (const el of $('list').children) el.classList.toggle('on', el.dataset.name === name);
  $('title').textContent = name;
  render();
}
for (const n of names) {
  const item = document.createElement('div'), c = document.createElement('canvas'), t = document.createElement('span');
  item.className = 'item'; item.dataset.name = n; t.textContent = n;
  thumb(blueprints[n], c, undefined);
  item.append(c, t); item.onclick = () => select(n); $('list').appendChild(item);
}

// ---- events ----------------------------------------------------------------
let timer;
$('src').oninput = () => {
  edited[cur] = $('src').value;
  if (edited[cur] === pretty(blueprints[cur])) delete edited[cur];
  clearTimeout(timer); timer = setTimeout(render, 250);
};
for (const id of ['seed', 'bg', 'marks', 'grid']) $(id).oninput = render;
$('reset').onclick = () => { delete edited[cur]; $('src').value = pretty(blueprints[cur]); paramKeys = ''; render(); };
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('src').value); $('note').textContent = 'Copied. Paste it over src/data/blueprints/' + cur + '.json'; }
  catch (_) { $('src').select(); document.execCommand('copy'); $('note').textContent = 'Copied.'; }
};
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? '⏸ Pause' : '▶ Play'; };
function tick(t) {
  if (playing && nf > 1) { acc += t - last; const step = 1000 / fps; while (acc >= step) { acc -= step; frame++; render(); } }
  last = t; requestAnimationFrame(tick);
}
select(names.includes('workshop') ? 'workshop' : names[0]);
requestAnimationFrame(tick);
