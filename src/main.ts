import { Camera, Renderer } from './render/renderer';
import { Sprites } from './render/sprites';
import { BUILDINGS, BuildingKind } from './sim/buildings';
import { DAY_PART_NAME, dayInSeason, SEASON_DAYS, SEASON_DEF, WEATHER, yearOf } from './sim/calendar';
import { DAY_LENGTH, TILE } from './sim/constants';
import { RES_LIST, RES_NAME } from './sim/resources';
import { Sim } from './sim/sim';
import { RESEARCH } from './sim/research';
import questData from './data/quests.json';

const CHAPTERS = questData.chapters;
import { resIcon } from './ui/resicons';
import { Controller } from './ui/controller';
import { $, costText } from './ui/dom';
import { Menu } from './ui/menu';
import { BuildTray } from './ui/buildtray';
import { MapView } from './ui/minimap';
import { BuildingBar, Confirm } from './ui/buildbar';
import { WarBar } from './ui/warbar';
import { BuildingPanel, Ctx, TargetCard, UnitCard } from './ui/panels';
import { IndexedDbStore } from './save/indexeddb';
import { Session, AUTO_SAVE } from './save/session';
import { loadSettings, saveSettings } from './save/settings';
import { MemoryStore } from './save/store';

const seed = Number(new URLSearchParams(location.search).get('seed')) || 1337;

const sim = new Sim(seed);
const settings = loadSettings();
const session = new Session(sim, IndexedDbStore.available() ? new IndexedDbStore() : new MemoryStore());
sim.speed = settings.speed;
let started = false; // true once the player has answered the "continue?" question
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
session.onError = toast;
const ctx: Ctx = { sim, ctl, sprites, session, toast };

// ---------------------------------------------------------------- panels, menu, maps
const unitCard = new UnitCard($('ucard'), ctx, $('udetail')), targetCard = new TargetCard($('tcard'), ctx), buildingPanel = new BuildingPanel($('bpanel'), ctx);
const buildingBar = new BuildingBar($('bbar'), ctx, renderer, new Confirm($('dialog'), ctx));
const warBar = new WarBar($('warbar'), ctx);
const tray = new BuildTray($('tray'), ctx);
const map = new MapView(sim, cam, renderer, ctl, $('mini'), $('bigmapCanvas'), $('bigmap'));
const menu = new Menu($('drawer'), $('drawerTabs'), $('drawerBody'), ctx, () => { const w = renderer.screenToWorld(renderer.w / 2, renderer.h / 2); return { x: w.x / TILE, y: w.y / TILE }; });
$('btnCloseMap').addEventListener('click', () => map.close());
$('btnMenu').addEventListener('click', () => { tray.close(); menu.toggle(); });
$('btnBuild').addEventListener('click', () => { menu.close(); tray.toggle(); });
// ---------------------------------------------------------------- landscape on phones
// A phone held upright gets a prompt (and the game pauses until it is turned); fullscreen plus an orientation lock is tried where the browser allows it.
const rotateEl = $('rotate'), fullBtn = $<HTMLButtonElement>('btnFull');
let rotateSkipped = settings.skipRotatePrompt, pausedByRotate = false;
const upright = () => matchMedia('(orientation: portrait)').matches && matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 700;
function syncRotate() {
  const need = upright() && !rotateSkipped;
  rotateEl.hidden = !need;
  if (need && sim.speed !== 0 && !pausedByRotate) { pausedByRotate = true; setSpeed(0); }
  else if (!need && pausedByRotate) { pausedByRotate = false; if (sim.speed === 0) setSpeed(settings.speed); }
}
async function goLandscape() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try {
    if (!document.fullscreenElement) await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    const o = screen.orientation as ScreenOrientation & { lock?: (t: string) => Promise<void> };
    await o.lock?.('landscape');
    toast('Đã khóa màn hình ngang');
  } catch {
    toast(document.fullscreenElement ? 'Máy không cho khóa hướng: hãy xoay điện thoại ngang' : 'Trình duyệt không cho toàn màn hình: hãy xoay điện thoại ngang');
  }
  syncRotate(); syncFull();
}
function syncFull() { fullBtn.setAttribute('aria-pressed', String(!!document.fullscreenElement)); }
fullBtn.addEventListener('click', () => { if (document.fullscreenElement) { void document.exitFullscreen(); (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.(); } else void goLandscape(); });
$('btnRotateFull').addEventListener('click', () => { void goLandscape(); });
$('btnRotateSkip').addEventListener('click', () => { rotateSkipped = true; settings.skipRotatePrompt = true; saveSettings(settings); syncRotate(); });
window.addEventListener('resize', syncRotate); window.addEventListener('orientationchange', syncRotate); document.addEventListener('fullscreenchange', () => { syncFull(); syncRotate(); });
fullBtn.hidden = !matchMedia('(pointer: coarse)').matches && !document.fullscreenEnabled;

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
function setSpeed(s: number) { sim.speed = s; if (s > 0) { settings.speed = s; saveSettings(settings); } syncButtons(); }
function togglePlace(kind: BuildingKind) { if (ctl.placing === kind) ctl.cancelPlacing(); else { ctl.startPlacing(kind); menu.close(); tray.close(); } }
function openWorkshop() { const b = sim.buildings.find((x) => x.kind === 'workshop' && x.done); if (b) { ctl.selectBuilding(b.id, true); ctl.centerOn((b.x + 1) * TILE, (b.y + 1) * TILE); } else toast('Chưa có Xưởng'); }
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

  else if (k === 'q') setSpeed(1); else if (k === 'e') setSpeed(2); else if (k === 'r') setSpeed(4); else if (k === 't') setSpeed(16);
  else if (k === 'b') togglePlace('storage'); else if (k === 'x') togglePlace('workshop'); else if (k === 'c') openWorkshop();
  else if (k === 'm') { if (map.isOpen) map.close(); else map.open(); }
  else if (k === 'tab') { e.preventDefault(); menu.toggle(); }
});

// ---------------------------------------------------------------- the top bar and the log
const qpanel = $('qpanel'), clock = $('clock');
// the coloured squares of the top bar give way to drawn pictures
for (const [id, key] of [['rFood', 'food'], ['rWood', 'wood'], ['rStone', 'stone'], ['rHide', 'hide'], ['rBone', 'bone'], ['rFat', 'fat'], ['rFeather', 'feather'], ['rTusk', 'tusk'], ['rTorch', 'torch'], ['rCoin', 'coin'], ['rPop', 'pop']]) $(id).querySelector('i')?.replaceWith(resIcon(key));
// the quest button stands at the left edge and opens the quest panel; a red mark on it says a new quest is waiting
let questOpen = false, questSeen = '';
const btnQuest = $('btnQuest'), questDot = btnQuest.querySelector('i') as HTMLElement;
const toggleQuests = () => { questOpen = !questOpen; logKey = ''; btnQuest.setAttribute('aria-pressed', String(questOpen)); };
btnQuest.addEventListener('click', toggleQuests);
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
  setRes('rWood', sim.stock.wood, cap); setRes('rStone', sim.stock.stone, cap); setRes('rHide', sim.stock.hide, cap); setRes('rCoin', sim.stock.coin, cap); $('rCoin').title = `${RES_NAME.coin}: tiền của làng, nhặt khi hái lượm, đổi hàng ở Kho, nhận từ bộ tộc. Dùng để trả cho nghiên cứu.`;
  { const el = $('rTorch'), n = sim.torchCount(); el.hidden = n <= 0; if (n > 0) el.querySelector('b')!.textContent = String(n); }
  for (const [id, res] of [['rBone', 'bone'], ['rFat', 'fat'], ['rFeather', 'feather'], ['rTusk', 'tusk']] as const) {
    const el = $(id), n = Math.floor(sim.stock[res]);
    el.hidden = n <= 0; if (n > 0) el.querySelector('b')!.textContent = String(n);
  }
  $('rPop').querySelector('b')!.textContent = String(sim.villagers.length); $('rPop').querySelector('small')!.textContent = `/${sim.popCap()}`;
  for (const r of RES_LIST) void RES_NAME[r];
  const se = SEASON_DEF[sim.season], we = WEATHER[sim.weather], year = yearOf(sim.day);
  clock.textContent = `${year > 1 ? `Năm ${year} · ` : ''}Ngày ${sim.day} · ${se.name} ${dayInSeason(sim.day)}/${SEASON_DAYS} · ${DAY_PART_NAME[sim.part]} · ${we.name}`;
  const outdoor = we.work * se.work;
  const eff = [we.vision ? `tầm nhìn −${we.vision} ô` : '', we.speed < 1 ? `đi chậm ${Math.round((1 - we.speed) * 100)}%` : '', outdoor < 1 ? `làm việc ngoài trời chậm ${Math.round((1 - outdoor) * 100)}%` : ''].filter(Boolean).join(', ');
  $('clockLine').title = `${we.name}${eff ? `: ${eff}` : ''}. Hái lượm mùa ${se.name.toLowerCase()} ×${se.gather.toLocaleString('vi')}. ${Math.round(fps)} fps`;

  // the quest panel: the chapter's quests, the one in hand opened with its hint
  const selB = ctl.selectedBuilding === null ? undefined : sim.getBuilding(ctl.selectedBuilding);
  const views = sim.quests({ selected: selB?.kind ?? null, panel: selB && ctl.buildingOpen ? selB.kind : null, inspecting: ctl.inspect?.kind ?? null });
  const open = views.filter((v) => v.open), cur = open[0], lk = views.map((v) => (v.done ? 'd' : v.open ? 'o' : 'l')).join('') + (cur ? `#${cur.progress}` : '#all') + (questOpen ? '+' : '');
  if (lk !== logKey) {
    const prev = logKey.split('#')[0].indexOf('o') >= 0 ? views[logKey.split('#')[0].indexOf('o')] : undefined;
    if (prev?.done) toast(`Hoàn thành: ${prev.quest.title}`);
    logKey = lk;
    if (questOpen) {
      const el = (tag: string, cls: string, text: string) => { const d = document.createElement(tag); d.className = cls; d.textContent = text; return d; };
      const isCount = (p: string) => p.split('/').length === 2 && p.split('/').every((x) => x !== '' && !isNaN(Number(x)));
      const chap = cur?.quest.chapter ?? CHAPTERS[CHAPTERS.length - 1].id, mine = views.filter((v) => v.quest.chapter === chap);
      const head = el('div', 'qhead', CHAPTERS.find((x) => x.id === chap)?.name ?? 'Nhiệm vụ');
      const close = el('button', 'qx', '✕'); close.title = 'Đóng'; close.addEventListener('click', toggleQuests); head.append(close);
      const rows = mine.map((v) => {
        const row = document.createElement('div'); row.className = `qrow ${v.done ? 'done' : v === cur ? 'now' : v.open ? 'next' : 'lock'}`;
        row.append(el('div', 'qtitle', `${v.done ? '✓' : v === cur ? '▸' : v.open ? '○' : '·'} ${v.quest.title}${v === cur && isCount(v.progress) ? ` (${v.progress})` : ''}`));
        if (v === cur) { row.append(el('div', 'qhint', v.quest.hint)); if (v.progress && !isCount(v.progress)) row.append(el('div', 'qneed', v.progress)); }
        return row;
      });
      qpanel.replaceChildren(head, ...(cur ? rows : [el('div', 'qrow now', 'Đã hoàn thành kế hoạch tới Nhà chung cấp 4')]));
      qpanel.querySelector('.now')?.scrollIntoView({ block: 'nearest' });
    }
  }
  qpanel.hidden = !questOpen;
  if (questOpen && cur) questSeen = cur.quest.id;
  questDot.hidden = questOpen || !cur || cur.quest.id === questSeen;
  // the context panels keep clear of the top bar, however many rows it wraps into
  const topH = Math.ceil(topBar.getBoundingClientRect().height);
  if (topH !== lastTopH) { lastTopH = topH; document.documentElement.style.setProperty('--top-h', `${topH}px`); }

  // a tribe that has just given in: take the player to the choice
  if (sim.pendingTribe !== pending) { pending = sim.pendingTribe; if (pending) { menu.open('tribes'); toast('Một bộ tộc xin hàng!'); } }

  // which panels show
  const chosen = sim.villagers.filter((v) => ctl.selected.has(v.id));
  const placing = !!ctl.placing, showB = ctl.selectedBuilding !== null && ctl.buildingOpen && !placing;
  buildingPanel.update(); buildingBar.update(); unitCard.update(chosen); targetCard.update();
  warBar.update(); document.body.classList.toggle('war', warBar.active); // war mode: the selection and building buttons give way to the battle buttons
  if (placing || !showB) $('bpanel').hidden = true;
  if (placing || showB) { $('ucard').hidden = true; unitCard.closeDetail(); }
  if (placing || showB) $('tcard').hidden = true;
  const bar = $('placeBar'); bar.hidden = !placing;
  if (placing && ctl.placing) {
    const why = ctl.placeProblem(), moving = ctl.moving !== null ? sim.getBuilding(ctl.moving) : undefined;
    $('placeName').textContent = `${moving ? 'Dời' : 'Đặt'} ${BUILDINGS[ctl.placing].name}`; $('placeInfo').textContent = why ?? (moving ? `Phí dời: ${costText(sim.moveFee(moving), RES_NAME)}` : 'Chỗ này đặt được');
    $<HTMLButtonElement>('btnPlaceOk').disabled = why !== null;
    $('btnPlaceOk').textContent = moving ? '✓ Dời tới đây' : '✓ Đặt ở đây';
  }
  menu.update(); tray.update();
  syncButtons();
}
ctl.onChange = () => { lastHud = 0; syncButtons(); };

// ---------------------------------------------------------------- main loop
let last = 0;
function frame(t: number) {
  const dt = last ? (t - last) / 1000 : 0; last = t;
  if (dt > 0) fps = fps * 0.9 + (1 / dt) * 0.1;
  ctl.update(dt);
  if (started) session.tick();
  sim.advance(dt);
  renderer.draw(t / 1000, ctl.selected, ctl.box, ctl.markers, ctl.ghost(), ctl.selectedBuilding, ctl.inspect);
  buildingBar.place(); map.draw(); updateHud(t);
  requestAnimationFrame(frame);
}
new ResizeObserver(() => { renderer.resize(); ctl.clamp(); }).observe(view);
requestAnimationFrame(frame);
syncRotate();

// Bridge for tests and the console.
(window as unknown as { __game: unknown }).__game = { sim, cam, ctl, renderer, menu, map, session, research: RESEARCH };

// ---------------------------------------------------------------- continue a saved game
// The game starts at once with a new world. If there is a save, a question comes first and the game waits for the answer.
function begin(): void { started = true; $('start').hidden = true; setSpeed(settings.speed); }
document.addEventListener('visibilitychange', () => { if (document.hidden && started) void session.save(); });
void (async () => {
  const latest = await session.latest();
  if (!latest) { started = true; return; }
  const params = new URLSearchParams(location.search);
  // a save of another world: load the page again with that world, then continue
  const resume = async () => {
    if (latest.seed !== seed) { location.search = `?seed=${latest.seed}&continue=1`; return; }
    if (await session.resume(AUTO_SAVE)) toast('Đã tải lại ván chơi'); else toast('Không đọc được bản lưu');
    begin();
  };
  if (params.get('continue') === '1' && latest.seed === seed) { await resume(); return; }
  sim.speed = 0; syncButtons();
  const when = new Date(latest.savedAt).toLocaleString('vi');
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<h3>Làng Đồ Đá</h3><p class="sub">Có ván đang chơi dở: ngày ${latest.day}, ${latest.population} dân (lưu lúc ${when}).</p>`;
  const btns = document.createElement('div'); btns.className = 'btns';
  const go = document.createElement('button'); go.className = 'primary'; go.textContent = 'Tiếp tục'; go.addEventListener('click', () => { void resume(); });
  const fresh = document.createElement('button'); fresh.textContent = 'Ván mới'; fresh.title = 'Bản lưu cũ vẫn còn cho tới khi ván mới tự lưu lần đầu (đầu ngày hôm sau)'; fresh.addEventListener('click', begin);
  btns.append(go, fresh); card.append(btns);
  $('start').replaceChildren(card); $('start').hidden = false;
})();
