import { Renderer, Camera } from './render/renderer';
import { Sprites } from './render/sprites';
import { BUILDINGS, BuildingKind } from './sim/buildings';
import { DAY_PART_NAME, dayInSeason, SEASON_DAYS, SEASON_DEF, WEATHER, yearOf } from './sim/calendar';
import { DAY_LENGTH, TILE } from './sim/constants';
import { Job, JOB_NAME, JOBS, STAT_NAME, StatKey, WORK_JOBS } from './sim/jobs';
import { RES_LIST, RES_NAME } from './sim/resources';
import { RECIPES, TIER_DURABILITY, TIER_NAME, TOOL_KINDS, TOOL_NAME, TOOL_USE, recipeName } from './sim/tools';
import { Sim, Villager } from './sim/sim';
import { Tile } from './sim/world';
import { Controller, Mode } from './ui/controller';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const seed = Number(new URLSearchParams(location.search).get('seed')) || 1337;

const sim = new Sim(seed);
const view = $<HTMLCanvasElement>('view');
const cam: Camera = { x: 0, y: 0, zoom: view.clientWidth < 600 ? 1 : 2 };
const sprites = new Sprites();
const renderer = new Renderer(view, sim, cam, sprites);
const ctl = new Controller(view, sim, cam, renderer);
ctl.centerOn(sim.world.start.x * TILE + TILE / 2, sim.world.start.y * TILE - 10);

// ---------------------------------------------------------------- bản đồ nhỏ
const mini = $<HTMLCanvasElement>('mini');
const N = sim.world.size;
mini.width = mini.height = N;
const mctx = mini.getContext('2d')!;
const base = document.createElement('canvas'); base.width = base.height = N;
const bctx = base.getContext('2d')!;
let miniVer = -1;
const TERRAIN: Record<number, [number, number, number]> = {
  [Tile.Grass]: [134, 163, 85], [Tile.Water]: [63, 111, 154], [Tile.Tree]: [47, 82, 34],
  [Tile.Rock]: [120, 125, 128], [Tile.Mud]: [122, 100, 66], [Tile.Bush]: [150, 70, 60],
};
function redrawMini() {
  if (sim.fog.version === miniVer && sim.buildings.length === miniBuildings) return;
  miniVer = sim.fog.version; miniBuildings = sim.buildings.length;
  const img = bctx.createImageData(N, N), s = sim.fog.state;
  for (let i = 0; i < N * N; i++) {
    const c = sim.world.occ[i] ? [200, 150, 80] : TERRAIN[sim.world.tiles[i]], k = s[i] === 2 ? 1 : s[i] === 1 ? 0.55 : 0;
    img.data[i * 4] = c[0] * k + 8 * (1 - k); img.data[i * 4 + 1] = c[1] * k + 10 * (1 - k); img.data[i * 4 + 2] = c[2] * k + 20 * (1 - k); img.data[i * 4 + 3] = 255;
  }
  bctx.putImageData(img, 0, 0);
}
let miniBuildings = -1;
function drawMini() {
  redrawMini();
  mctx.drawImage(base, 0, 0);
  mctx.fillStyle = '#fff6e8';
  for (const v of sim.villagers) mctx.fillRect(v.x - 1.5, v.y - 1.5, 3, 3);
  const z = cam.zoom, x = cam.x / TILE, y = cam.y / TILE, w = renderer.w / z / TILE, h = renderer.h / z / TILE;
  mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 1; mctx.strokeRect(x, y, w, h);
}
mini.addEventListener('pointerdown', (e) => {
  const b = mini.getBoundingClientRect();
  ctl.centerOn(((e.clientX - b.left) / b.width) * N * TILE, ((e.clientY - b.top) / b.height) * N * TILE);
});

// ---------------------------------------------------------------- nút bấm
const modeBtns = (['select', 'move', 'pan'] as Mode[]).map((m) => {
  const b = document.querySelector<HTMLButtonElement>(`[data-mode="${m}"]`)!;
  b.addEventListener('click', () => { ctl.mode = m; syncButtons(); });
  return b;
});
const speedBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-speed]')];
speedBtns.forEach((b) => b.addEventListener('click', () => setSpeed(Number(b.dataset.speed))));
const buildBtn = $<HTMLButtonElement>('btnBuild'), shopBtn = $<HTMLButtonElement>('btnShop'), craftBtn = $<HTMLButtonElement>('btnCraft');
buildBtn.addEventListener('click', () => toggleBuild('storage'));
shopBtn.addEventListener('click', () => toggleBuild('workshop'));
craftBtn.addEventListener('click', () => toggleCraft());
let craftOpen = false;
function toggleCraft(force?: boolean) { craftOpen = force ?? !craftOpen; lastHud = 0; syncButtons(); }
$('btnAll').addEventListener('click', () => ctl.selectAll());
function setSpeed(s: number) { sim.speed = s; syncButtons(); }
function toggleBuild(kind: BuildingKind) { if (ctl.placing === kind) ctl.cancelPlacing(); else ctl.startPlacing(kind); syncButtons(); }
function syncButtons() {
  modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === ctl.mode)));
  speedBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === sim.speed)));
  buildBtn.setAttribute('aria-pressed', String(ctl.placing === 'storage'));
  shopBtn.setAttribute('aria-pressed', String(ctl.placing === 'workshop'));
  craftBtn.setAttribute('aria-pressed', String(craftOpen)); craftBtn.disabled = !sim.hasWorkshop();
}
syncButtons();
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'p') setSpeed(sim.speed === 0 ? 1 : 0);
  else if (k === '1') setSpeed(1); else if (k === '2') setSpeed(2); else if (k === '3') setSpeed(4);
  else if (k === 'b') toggleBuild('storage'); else if (k === 'x') toggleBuild('workshop'); else if (k === 'c' && sim.hasWorkshop()) toggleCraft();
});

// ---------------------------------------------------------------- thông báo ngắn
const toast = $('toast');
let toastTimer = 0;
ctl.onToast = (text) => {
  toast.textContent = text; toast.classList.add('on');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove('on'), 2200);
};

// ---------------------------------------------------------------- nút giao nghề
const jobsBox = $('cJobs');
const jobBtns = (['idle', ...WORK_JOBS] as Job[]).map((j) => {
  const b = document.createElement('button');
  b.textContent = JOB_NAME[j]; b.dataset.job = j; b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => { sim.setJob([...ctl.selected], j); lastHud = 0; });
  jobsBox.appendChild(b);
  return b;
});

// ---------------------------------------------------------------- cấp công cụ ngay (bỏ qua Xưởng, để thử nhanh)
const giveBox = $('cGive');
for (const k of TOOL_KINDS) for (const tier of [1, 2]) {
  const b = document.createElement('button');
  b.textContent = `${TOOL_NAME[k]} ${TIER_NAME[tier].toLowerCase()}`; b.title = `Cấp ${b.textContent.toLowerCase()} cho dân đang chọn · ${TOOL_USE[k]}`;
  b.addEventListener('click', () => { sim.giveTool([...ctl.selected], k, tier); lastHud = 0; });
  giveBox.appendChild(b);
}
const dropBtn = document.createElement('button');
dropBtn.textContent = 'Thu hết'; dropBtn.title = 'Thu lại mọi công cụ của dân đang chọn (tay không)';
dropBtn.addEventListener('click', () => { for (const k of TOOL_KINDS) sim.giveTool([...ctl.selected], k, 0); lastHud = 0; });
giveBox.appendChild(dropBtn);

// ---------------------------------------------------------------- bảng chế tác
const recipesBox = $('recipes'), craftCard = $('craft');
const recRows = RECIPES.map((r) => {
  const row = document.createElement('div'); row.className = 'rec';
  const ic = sprites.icons[r.id], cv = document.createElement('canvas'); cv.width = ic.width; cv.height = ic.height;
  cv.getContext('2d')!.drawImage(ic, 0, 0);
  const nm = document.createElement('div'); nm.className = 'nm';
  const cost = (Object.keys(r.cost) as Array<keyof typeof r.cost>).map((k) => `${r.cost[k]} ${RES_NAME[k as 'wood' | 'stone' | 'food'].toLowerCase()}`).join(' + ');
  nm.innerHTML = `${recipeName(r)}<small>${cost} · ${r.time} giây · ${TOOL_USE[r.kind]}</small>`;
  const q = document.createElement('div'); q.className = 'qty';
  const have = document.createElement('span'); have.className = 'have';
  const minus = document.createElement('button'), plus = document.createElement('button');
  minus.textContent = '−'; plus.textContent = '+'; minus.title = 'Bớt một đơn'; plus.title = 'Thêm một đơn vào hàng đợi';
  minus.addEventListener('click', () => { sim.unqueueCraft(r.id); lastHud = 0; });
  plus.addEventListener('click', () => { const e = sim.queueCraft(r.id); if (e) ctl.onToast(e); lastHud = 0; });
  q.append(have, minus, plus);
  row.append(cv, nm, q); recipesBox.appendChild(row);
  return { r, have };
});
function updateCraft() {
  craftCard.hidden = !(craftOpen && sim.hasWorkshop());
  if (craftCard.hidden) return;
  for (const { r, have } of recRows) {
    const queued = sim.craftQueue.filter((id) => id === r.id).length;
    have.textContent = `kho ${sim.toolCount(r.kind, r.tier)} · đợi ${queued}`;
  }
  const working = sim.villagers.filter((v) => v.job === 'craft').length;
  $('toolStock').textContent = working ? `${working} thợ thủ công` : 'chưa có thợ thủ công';
}

// ---------------------------------------------------------------- HUD
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const PHASE_TEXT = (v: Villager): string => {
  const carry = v.carry && v.carry.amount > 0 ? ` · mang ${v.carry.amount} ${RES_NAME[v.carry.res].toLowerCase()}` : '';
  let t: string;
  switch (v.phase) {
    case 'move': t = 'đang đi'; break;
    case 'goNode': t = 'đi tới nguồn'; break;
    case 'work': t = v.job !== 'idle' ? JOB_NAME[v.job].toLowerCase() : 'rảnh'; break;
    case 'goStore': t = 'mang về kho'; break;
    case 'goSite': t = 'đi tới công trường'; break;
    case 'build': t = 'đang xây'; break;
    case 'goShop': t = 'đi tới Xưởng'; break;
    case 'craft': t = 'đang chế tác'; break;
    case 'goEquip': t = 'đi lấy công cụ'; break;
    case 'wait': t = 'chờ việc'; break;
    case 'goHome': t = 'về lửa trại ngủ'; break;
    case 'sleep': t = 'đang ngủ'; break;
    default: t = v.job === 'idle' ? 'rảnh' : 'chờ việc';
  }
  return t + carry;
};
const info = $('info'), sel = $('sel'), card = $('card'), logBox = $('log');
const clock = $('clock');
let fps = 60, lastHud = 0, chipsKey = '', statsKey = '', logKey = '';

function setRes(id: string, val: number, cap: number, note = '') {
  const el = $(id);
  el.querySelector('b')!.textContent = String(Math.floor(val));
  el.querySelector('small')!.textContent = `/${cap}${note}`;
  el.classList.toggle('full', val >= cap);
}

function updateHud(now: number) {
  if (now - lastHud < 150) return;
  lastHud = now;
  const spoil = Math.floor(sim.foodSpoilingWithin(DAY_LENGTH));
  setRes('rFood', sim.stock.food, sim.capacity(), spoil > 0 ? ` · ${spoil} sắp hỏng` : '');
  $('rFood').classList.toggle('warn', spoil > 0);
  $('rFood').title = `Quả hỏng sau 3 ngày nếu chưa ăn; dân ăn lứa cũ trước.${spoil > 0 ? ` ${spoil} thức ăn sẽ hỏng trong 1 ngày tới.` : ''}`;
  setRes('rWood', sim.stock.wood, sim.capacity()); setRes('rStone', sim.stock.stone, sim.capacity());
  const se = SEASON_DEF[sim.season], we = WEATHER[sim.weather], year = yearOf(sim.day);
  clock.textContent = `${year > 1 ? `Năm ${year} · ` : ''}Ngày ${sim.day} · ${se.name} ${dayInSeason(sim.day)}/${SEASON_DAYS} · ${DAY_PART_NAME[sim.part]} · ${we.name}`;
  const eff = [we.vision ? `tầm nhìn −${we.vision} ô` : '', we.speed < 1 ? `đi chậm ${Math.round((1 - we.speed) * 100)}%` : ''].filter(Boolean).join(', ');
  clock.title = `${we.name}${eff ? `: ${eff}` : ''}. Hái lượm mùa ${se.name.toLowerCase()} ×${se.gather.toLocaleString('vi')}. Dân ngủ từ giữa hoàng hôn tới giữa bình minh.`;
  const explored = sim.fog.countExplored(), pct = ((explored / (N * N)) * 100).toFixed(1);
  info.textContent = `Dân ${sim.villagers.length} · đã chọn ${ctl.selected.size} · khám phá ${pct}% · 1 ngày = ${DAY_LENGTH / 60} phút · ${Math.round(fps)} fps`;

  // nhật ký
  const lines = sim.log.slice(-4), lk = lines.map((l) => l.text).join('|');
  if (lk !== logKey) { logKey = lk; logBox.replaceChildren(...lines.map((l) => { const d = document.createElement('div'); d.textContent = l.text; return d; })); }

  // danh sách dân
  const key = sim.villagers.map((v) => `${v.id}|${v.job}|${ctl.selected.has(v.id)}`).join() + sim.villagers.length;
  if (key !== chipsKey) {
    chipsKey = key;
    sel.replaceChildren(...sim.villagers.map((v) => {
      const b = document.createElement('button');
      b.setAttribute('aria-pressed', String(ctl.selected.has(v.id)));
      b.textContent = `${v.name} · ${JOB_NAME[v.job].toLowerCase()}`;
      b.addEventListener('click', (e) => { if (!e.shiftKey) ctl.selected.clear(); ctl.selected.add(v.id); ctl.focusSelection(); chipsKey = ''; lastHud = 0; });
      return b;
    }));
  }

  updateCraft();

  // thẻ chi tiết
  const chosen = sim.villagers.filter((v) => ctl.selected.has(v.id));
  card.hidden = chosen.length === 0;
  if (chosen.length) {
    const v = chosen[0];
    $('cName').textContent = chosen.length > 1 ? `${v.name} và ${chosen.length - 1} người nữa` : v.name;
    $('cState').textContent = PHASE_TEXT(v);
    $('bFull').style.width = `${v.fullness}%`; $('bHealth').style.width = `${v.health}%`;
    const sk = `${v.id}|${v.skill.wood.level}${v.skill.stone.level}${v.skill.food.level}${v.skill.build.level}`;
    if (sk !== statsKey) {
      statsKey = sk;
      $('cStats').innerHTML = (Object.keys(STAT_NAME) as StatKey[]).map((k) => `${STAT_NAME[k]} <b>${v.stats[k]}</b>`).join(' · ');
      $('cSkills').innerHTML = WORK_JOBS.map((j) => `${JOBS[j].name} <span class="stars">${stars(v.potential[j])}</span> <b>cấp ${v.skill[j].level}</b>`).join(' · ');
    }
    $('cTools').innerHTML = 'Công cụ: ' + TOOL_KINDS.map((k) => {
      const t = v.tools[k];
      return `${TOOL_NAME[k]} <b>${t ? TIER_NAME[t.tier].toLowerCase() + ' ' + Math.round((t.dur / TIER_DURABILITY[t.tier]) * 100) + '%' : '—'}</b>`;
    }).join(' · ');
    jobBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((c) => c.job === b.dataset.job))));
  } else statsKey = '';
  syncButtons();
}
ctl.onChange = () => { chipsKey = ''; lastHud = 0; syncButtons(); };

// ---------------------------------------------------------------- vòng lặp
let last = 0;
function frame(t: number) {
  const dt = last ? (t - last) / 1000 : 0; last = t;
  if (dt > 0) fps = fps * 0.9 + (1 / dt) * 0.1;
  ctl.update(dt);
  sim.advance(dt);
  renderer.draw(t / 1000, ctl.selected, ctl.box, ctl.markers, ctl.ghost());
  drawMini(); updateHud(t);
  requestAnimationFrame(frame);
}
new ResizeObserver(() => { renderer.resize(); ctl.clamp(); }).observe(view);
requestAnimationFrame(frame);

void BUILDINGS; void RES_LIST;
// Cầu nối cho kiểm thử và gỡ lỗi trong console.
(window as unknown as { __game: unknown }).__game = { sim, cam, ctl, renderer };
