import { Camera, Renderer } from './render/renderer';
import { Sprites } from './render/sprites';
import { BUILDINGS, BuildingKind } from './sim/buildings';
import { DAY_PART_NAME, dayInSeason, SEASON_DAYS, SEASON_DEF, WEATHER, yearOf } from './sim/calendar';
import { DAY_LENGTH, TILE } from './sim/constants';
import { RES_LIST, RES_NAME } from './sim/resources';
import { Sim } from './sim/sim';
import { POP_CAP } from './sim/tribes';
import { Controller } from './ui/controller';
import { $, costText } from './ui/dom';
import { Menu } from './ui/menu';
import { MapView } from './ui/minimap';
import { BuildingPanel, Ctx, TargetCard, UnitCard } from './ui/panels';

const seed = Number(new URLSearchParams(location.search).get('seed')) || 1337;

const sim = new Sim(seed);
const view = $<HTMLCanvasElement>('view');
const cam: Camera = { x: 0, y: 0, zoom: Math.min(view.clientWidth, view.clientHeight) < 700 ? 1 : 2 };
const sprites = new Sprites();
const renderer = new Renderer(view, sim, cam, sprites);
const ctl = new Controller(view, sim, cam, renderer);
ctl.centerOn(sim.world.start.x * TILE + TILE / 2, sim.world.start.y * TILE - 10);

// ---------------------------------------------------------------- short messages and the event log
const toastEl = $('toast');
let toastTimer = 0;
const toast = (text: string) => {
  toastEl.textContent = text; toastEl.classList.add('on');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toastEl.classList.remove('on'), 2200);
};
ctl.onToast = toast;
const ctx: Ctx = { sim, ctl, sprites, toast };

// ---------------------------------------------------------------- panels, menu, maps
const unitCard = new UnitCard($('ucard'), ctx), targetCard = new TargetCard($('tcard'), ctx), buildingPanel = new BuildingPanel($('bpanel'), ctx);
const map = new MapView(sim, cam, renderer, ctl, $('mini'), $('bigmapCanvas'), $('bigmap'));
const menu = new Menu($('drawer'), $('drawerTabs'), $('drawerBody'), ctx, () => { const w = renderer.screenToWorld(renderer.w / 2, renderer.h / 2); return { x: w.x / TILE, y: w.y / TILE }; });
$('btnCloseMap').addEventListener('click', () => map.close());
$('btnMenu').addEventListener('click', () => { menu.toggle(); });

// ---------------------------------------------------------------- buttons and keys
const speedBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-speed]')];
speedBtns.forEach((b) => b.addEventListener('click', () => setSpeed(Number(b.dataset.speed))));
const multiBtn = $<HTMLButtonElement>('btnMulti');
multiBtn.addEventListener('click', () => ctl.setMulti(!ctl.multi));
$('btnAll').addEventListener('click', () => ctl.selectAll());
$('btnNone').addEventListener('click', () => ctl.clearSelection());
const foldBtn = $<HTMLButtonElement>('btnFold');
foldBtn.addEventListener('click', () => { const on = !$('sheet').classList.contains('folded'); $('sheet').classList.toggle('folded', on); foldBtn.setAttribute('aria-pressed', String(on)); foldBtn.textContent = on ? 'Hiện bảng' : 'Ẩn bảng'; });
$('btnPlaceOk').addEventListener('click', () => ctl.confirmPlace());
$('btnPlaceNo').addEventListener('click', () => ctl.cancelPlacing());
function setSpeed(s: number) { sim.speed = s; syncButtons(); }
function togglePlace(kind: BuildingKind) { if (ctl.placing === kind) ctl.cancelPlacing(); else { ctl.startPlacing(kind); menu.close(); } }
function openWorkshop() { const b = sim.buildings.find((x) => x.kind === 'workshop' && x.done); if (b) { ctl.selectBuilding(b.id); ctl.centerOn((b.x + 1) * TILE, (b.y + 1) * TILE); } else toast('Chưa có Xưởng'); }
function syncButtons() {
  speedBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === sim.speed)));
  multiBtn.setAttribute('aria-pressed', String(ctl.multi));
  $('btnNone').hidden = ctl.selected.size === 0 && ctl.selectedBuilding === null && !ctl.inspect;
}
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof HTMLElement && /input|textarea|select/i.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'p') setSpeed(sim.speed === 0 ? 1 : 0);
  else if (k === 'q') setSpeed(1); else if (k === 'e') setSpeed(2); else if (k === 'r') setSpeed(4);
  else if (k === 'b') togglePlace('storage'); else if (k === 'x') togglePlace('workshop'); else if (k === 'c') openWorkshop();
  else if (k === 'm') { if (map.isOpen) map.close(); else map.open(); }
  else if (k === 'tab') { e.preventDefault(); menu.toggle(); }
});

// ---------------------------------------------------------------- the top bar and the log
const log = $('log'), clock = $('clock');
let fps = 60, lastHud = 0, logKey = '', pending: string | null = null, lastTopH = -1;
const topBar = document.querySelector('.top') as HTMLElement;

function setRes(id: string, val: number, cap: number, note = '') {
  const el = $(id);
  el.querySelector('b')!.textContent = String(Math.floor(val));
  el.querySelector('small')!.textContent = `/${cap}${note}`;
  el.classList.toggle('full', val >= cap);
}

function updateHud(now: number) {
  if (now - lastHud < 150) return;
  lastHud = now;
  const spoil = Math.floor(sim.foodSpoilingWithin(DAY_LENGTH)), cap = sim.capacity();
  setRes('rFood', sim.stock.food, cap, spoil > 0 ? ` · ${spoil}⚠` : '');
  $('rFood').classList.toggle('warn', spoil > 0);
  $('rFood').title = `Thức ăn. Quả hỏng sau 3 ngày nếu chưa ăn; dân ăn lứa cũ trước.${spoil > 0 ? ` ${spoil} thức ăn sẽ hỏng trong 1 ngày tới.` : ''}`;
  setRes('rWood', sim.stock.wood, cap); setRes('rStone', sim.stock.stone, cap); setRes('rHide', sim.stock.hide, cap);
  $('rPop').querySelector('b')!.textContent = String(sim.villagers.length); $('rPop').querySelector('small')!.textContent = `/${POP_CAP}`;
  for (const r of RES_LIST) void RES_NAME[r];
  const se = SEASON_DEF[sim.season], we = WEATHER[sim.weather], year = yearOf(sim.day);
  clock.textContent = `${year > 1 ? `Năm ${year} · ` : ''}Ngày ${sim.day} · ${se.name} ${dayInSeason(sim.day)}/${SEASON_DAYS} · ${DAY_PART_NAME[sim.part]} · ${we.name}`;
  const eff = [we.vision ? `tầm nhìn −${we.vision} ô` : '', we.speed < 1 ? `đi chậm ${Math.round((1 - we.speed) * 100)}%` : ''].filter(Boolean).join(', ');
  $('clockLine').title = `${we.name}${eff ? `: ${eff}` : ''}. Hái lượm mùa ${se.name.toLowerCase()} ×${se.gather.toLocaleString('vi')}. ${Math.round(fps)} fps`;

  const lines = sim.log.slice(-4), lk = lines.map((l) => l.text).join('|');
  if (lk !== logKey) {
    // on a narrow screen the log is hidden, so the newest line goes to the pop-up message instead
    if (logKey && innerWidth < 760 && lines.length) toast(lines[lines.length - 1].text);
    logKey = lk; log.replaceChildren(...lines.map((l) => { const d = document.createElement('div'); d.textContent = l.text; return d; }));
  }
  // the context panels keep clear of the top bar, however many rows it wraps into
  const topH = Math.ceil(topBar.getBoundingClientRect().height);
  if (topH !== lastTopH) { lastTopH = topH; document.documentElement.style.setProperty('--top-h', `${topH}px`); }

  // a tribe that has just given in: take the player to the choice
  if (sim.pendingTribe !== pending) { pending = sim.pendingTribe; if (pending) { menu.open('tribes'); toast('Một bộ tộc xin hàng!'); } }

  // which panels show
  const chosen = sim.villagers.filter((v) => ctl.selected.has(v.id));
  const placing = !!ctl.placing, showB = ctl.selectedBuilding !== null && !placing;
  buildingPanel.update(); unitCard.update(chosen); targetCard.update();
  if (placing || !showB) $('bpanel').hidden = true;
  if (placing || showB) $('ucard').hidden = true;
  if (placing || showB) $('tcard').hidden = true;
  const bar = $('placeBar'); bar.hidden = !placing;
  if (placing && ctl.placing) {
    const why = ctl.placeProblem(), moving = ctl.moving !== null ? sim.getBuilding(ctl.moving) : undefined;
    $('placeName').textContent = `${moving ? 'Dời' : 'Đặt'} ${BUILDINGS[ctl.placing].name}`; $('placeInfo').textContent = why ?? (moving ? `Phí dời: ${costText(sim.moveFee(moving), RES_NAME)}` : 'Chỗ này đặt được');
    $<HTMLButtonElement>('btnPlaceOk').disabled = why !== null;
    $('btnPlaceOk').textContent = moving ? '✓ Dời tới đây' : '✓ Đặt ở đây';
  }
  menu.update();
  syncButtons();
}
ctl.onChange = () => { lastHud = 0; syncButtons(); };

// ---------------------------------------------------------------- main loop
let last = 0;
function frame(t: number) {
  const dt = last ? (t - last) / 1000 : 0; last = t;
  if (dt > 0) fps = fps * 0.9 + (1 / dt) * 0.1;
  ctl.update(dt);
  sim.advance(dt);
  renderer.draw(t / 1000, ctl.selected, ctl.box, ctl.markers, ctl.ghost(), ctl.selectedBuilding, ctl.inspect);
  map.draw(); updateHud(t);
  requestAnimationFrame(frame);
}
new ResizeObserver(() => { renderer.resize(); ctl.clamp(); }).observe(view);
requestAnimationFrame(frame);

// Bridge for tests and the console.
(window as unknown as { __game: unknown }).__game = { sim, cam, ctl, renderer, menu, map };
