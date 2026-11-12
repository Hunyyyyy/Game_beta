import { Camera, Renderer } from './render/renderer';
import { GameAudio } from './audio/audio';
import { Sprites } from './render/sprites';
import { BUILDINGS, BuildingKind } from './sim/buildings';
import { DAY_PART_NAME, dayInSeason, lightAt, SEASON_DAYS, SEASON_DEF, WEATHER, yearOf } from './sim/calendar';
import { TICK, TILE } from './sim/constants';
import { isHorse } from './sim/jobs';
import { RES_LIST, RES_NAME } from './sim/resources';
import { Sim } from './sim/sim';
import { RESEARCH } from './sim/research';
import { SettingsPanel } from './ui/settingspanel';
import { EraDialog } from './ui/eradialog';
import { Journal } from './ui/journal';
import { dlg, GameDialog } from './ui/gamedialog';
import { StatsOverview } from './ui/statsoverview';
import { resIcon } from './ui/resicons';
import { Controller } from './ui/controller';
import { $, costText, iconCanvas } from './ui/dom';
import { Menu } from './ui/menu';
import { BuildTray } from './ui/buildtray';
import { MapView } from './ui/minimap';
import { BuildingBar, Confirm } from './ui/buildbar';
import { UpgradePlanBar } from './ui/upgradeplan';
import { WarBar } from './ui/warbar';
import { BuildingPanel, Ctx, TargetCard, UnitCard } from './ui/panels';
import { newSeed } from './sim/rng';
import { IndexedDbStore } from './save/indexeddb';
import { Session, AUTO_SAVE } from './save/session';
import type { SaveMeta } from './save/store';
import { saveTile, saveTitle } from './ui/savelist';
import { loadSettings, saveSettings } from './save/settings';
import { levelOf, QUALITY_LEVELS } from './render/quality';
import { MemoryStore } from './save/store';

// a new game is a new world: a random seed (it decides the land, the herds and where the village starts), kept in the address so that reloading the page gives the same world
const seedParam = Number(new URLSearchParams(location.search).get('seed')) || 0;
const seed = seedParam || newSeed();
if (!seedParam) { try { history.replaceState(null, '', `?seed=${seed}`); } catch { /* an address that cannot be changed: the world is just not remembered */ } }

const sim = new Sim(seed);
const settings = loadSettings();
const session = new Session(sim, IndexedDbStore.available() ? new IndexedDbStore() : new MemoryStore());
session.auto = settings.autosave;
sim.speed = settings.speed;
let rateSpeed = 1, realRate = 1, rateShown = 0; // the speed the game really runs at (see showSpeed)
let started = false; // true once the player has answered the "continue?" question
const startDialog = new GameDialog($('start'), { modal: true }); // only its own buttons close it
const view = $<HTMLCanvasElement>('view');
const cam: Camera = { x: 0, y: 0, zoom: Math.min(view.clientWidth, view.clientHeight) < 700 ? 1 : 2 };
const sprites = new Sprites();
const renderer = new Renderer(view, sim, cam, sprites);
/** How much the screen draws (the quality setting, by the device when it says auto). */
let quality = QUALITY_LEVELS[levelOf(settings.quality)];
const applyQuality = (): void => { quality = QUALITY_LEVELS[levelOf(settings.quality)]; renderer.setDprCap(quality.dprCap); };
applyQuality();
const audio = new GameAudio();
renderer.audio = audio;
audio.sfxOn = settings.sfxOn; audio.ambientOn = settings.ambientOn; audio.musicOn = settings.musicOn; audio.voiceOn = settings.voiceOn;
audio.vol = { sfx: settings.sfxVol, amb: settings.ambientVol, mus: settings.musicVol, voice: settings.voiceVol };
let soundChanged: () => void = () => undefined; // the settings window reads the sound settings back when a key changes them
function syncSound() { soundChanged(); }
function toggleSound(kind: 'sfx' | 'amb' | 'mus') {
  if (kind === 'sfx') settings.sfxOn = audio.sfxOn = !audio.sfxOn; else if (kind === 'amb') settings.ambientOn = audio.ambientOn = !audio.ambientOn; else settings.musicOn = audio.musicOn = !audio.musicOn;
  saveSettings(settings); syncSound();
  const on = kind === 'sfx' ? audio.sfxOn : kind === 'amb' ? audio.ambientOn : audio.musicOn;
  toast(`${on ? 'Bật' : 'Tắt'} ${kind === 'sfx' ? 'âm thanh hiệu ứng' : kind === 'amb' ? 'âm thanh môi trường' : 'nhạc nền'}`);
}
const sound: Ctx['sound'] = {
  get: (k) => (k === 'sfx' ? { on: audio.sfxOn, vol: audio.vol.sfx } : k === 'amb' ? { on: audio.ambientOn, vol: audio.vol.amb } : k === 'voice' ? { on: audio.voiceOn, vol: audio.vol.voice } : { on: audio.musicOn, vol: audio.vol.mus }),
  set: (k, on, vol) => {
    if (k === 'sfx') { settings.sfxOn = audio.sfxOn = on; settings.sfxVol = audio.vol.sfx = vol; }
    else if (k === 'amb') { settings.ambientOn = audio.ambientOn = on; settings.ambientVol = audio.vol.amb = vol; }
    else if (k === 'voice') { settings.voiceOn = audio.voiceOn = on; settings.voiceVol = audio.vol.voice = vol; }
    else { settings.musicOn = audio.musicOn = on; settings.musicVol = audio.vol.mus = vol; }
    saveSettings(settings); syncSound();
  },
};
renderer.weatherFx = settings.weatherFx;
const weatherFx: Ctx['weatherFx'] = { get: () => settings.weatherFx, set: (on) => { settings.weatherFx = renderer.weatherFx = on; saveSettings(settings); } };
const ctl = new Controller(view, sim, cam, renderer);
ctl.centerOn(sim.world.start.x * TILE + TILE / 2, sim.world.start.y * TILE - 10);
sim.controlled = ctl.selected; // the units the player holds: the sim lets their orders win over its own fighting and fleeing

// ---------------------------------------------------------------- short messages and the event log
const toastEl = $('toast');
let toastTimer = 0;
const toast = (text: string) => {
  toastEl.textContent = text; toastEl.classList.add('on');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toastEl.classList.remove('on'), 2200);
};
ctl.onToast = toast;
ctl.onArm = () => { try { navigator.vibrate?.(18); } catch { /* a phone that does not buzz: the ring shows it */ } }; // a finger held long enough: the box is ready
ctl.onOrder = (ids) => { audio.order(); if (ids.some((id) => { const v = sim.get(id); return !!v && isHorse(sim.mountOf(v)); })) audio.neigh(); }; // a troop with riders: a horse neighs too
// the buttons that command a troop (deploy, attack, withdraw, call out, send back) sound as an order
const ORDER_BTN = /Triển khai|^\W*Đánh$|Rút|^Gọi (tất cả|cả trại|quân)|^Cho (về hết|cả trại về|quân về)/;
document.addEventListener('click', (e) => { const b = (e.target as Element | null)?.closest('button'); if (b && !b.disabled && (b.id === 'btnArmy' || b.id === 'btnArmyBar' || ORDER_BTN.test((b.textContent ?? '').trim()))) audio.order(); }, true);
session.onError = toast;
const ctx: Ctx = { sim, ctl, sprites, session, toast, sound, weatherFx };

// ---------------------------------------------------------------- panels, menu, maps
const unitCard = new UnitCard($('ucard'), ctx, $('udetail')), targetCard = new TargetCard($('tcard'), ctx), buildingPanel = new BuildingPanel($('bpanel'), ctx);
const buildingBar = new BuildingBar($('bbar'), ctx, renderer, new Confirm($('dialog'), ctx));
const upgradePlanBar = new UpgradePlanBar(document.body, ctx, renderer);
const warBar = new WarBar($('warbar'), ctx);
const tray = new BuildTray($('tray'), ctx);
const map = new MapView(sim, cam, renderer, ctl, $('mini'), $('bigmapCanvas'), $('bigmap'));
const menu = new Menu($('drawer'), $('drawerTabs'), $('drawerBody'), ctx, () => { const w = renderer.screenToWorld(renderer.w / 2, renderer.h / 2); return { x: w.x / TILE, y: w.y / TILE }; });
$('btnCloseMap').addEventListener('click', () => map.close());
$('btnDev').addEventListener('click', () => { tray.close(); menu.open('dev'); });
$('btnMap').addEventListener('click', () => (map.isOpen ? map.close() : map.open()));
{ const pic = iconCanvas(sprites.icons.hammer1); pic.className = 'buildpic'; $('btnBuild').prepend(pic); } // the hammer of the game's own tools, not an emoji
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
// one button for the speed of the game: each press goes to the next speed, and from the last one back to the first
const SPEEDS = [1, 2, 4, 16];
const speedBtn = $<HTMLButtonElement>('btnSpeed');
speedBtn.addEventListener('click', () => setSpeed(SPEEDS[(SPEEDS.indexOf(sim.speed) + 1) % SPEEDS.length]));
// the ring of buttons that opens where the pointer is held still on the map: Gọi quân, Bỏ chọn
const ring = $('radial'), ringBtns = ['btnArmy', 'btnNone'].map((id) => $<HTMLButtonElement>(id));
const RING_R = 64;
let ringHot: HTMLButtonElement | null = null;
const ringSpot = (i: number, n: number) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return { x: Math.cos(a) * RING_R, y: Math.sin(a) * RING_R }; };
const ringShown = () => ringBtns.filter((b) => !b.hidden);
ctl.hold.open = (p) => {
  const b = view.getBoundingClientRect(), shown = ringShown();
  ring.style.left = `${Math.round(b.left + p.x)}px`; ring.style.top = `${Math.round(b.top + p.y)}px`;
  shown.forEach((el, i) => { const s = ringSpot(i, shown.length); el.style.left = `${Math.round(s.x)}px`; el.style.top = `${Math.round(s.y)}px`; });
  ring.hidden = false; ringHot = null; syncButtons();
};
ctl.hold.move = (p) => {
  const b = view.getBoundingClientRect(), cx = b.left + p.x - parseFloat(ring.style.left), cy = b.top + p.y - parseFloat(ring.style.top), shown = ringShown();
  let best: HTMLButtonElement | null = null, bd = 34; // within this many pixels of a button
  shown.forEach((el, i) => { const s = ringSpot(i, shown.length), d = Math.hypot(cx - s.x, cy - s.y); if (d < bd) { bd = d; best = el; } });
  ringHot = best; for (const el of ringBtns) el.classList.toggle('hot', el === best);
};
ctl.hold.end = () => { const hot = ringHot; ring.hidden = true; ringHot = null; for (const el of ringBtns) el.classList.remove('hot'); if (hot) hot.click(); };
$('btnNone').addEventListener('click', () => ctl.clearSelection());
$('btnSelNone').addEventListener('click', () => ctl.clearSelection());
$('btnSelCount').addEventListener('click', () => ctl.focusSelection());
$('btnHome').addEventListener('click', () => { const f = sim.campfire(), s = sim.world.start; ctl.centerOn(((f ? f.x + 1 : s.x) ) * TILE, ((f ? f.y + 1 : s.y)) * TILE); });
$('btnLegion').addEventListener('click', () => { ctl.legionControl = !ctl.legionControl; if (ctl.legionControl) toast('Chạm đất để cả đội quân hành quân tới đó'); syncButtons(); });
const armyClick = () => { if (sim.alarmUntil > sim.time) sim.standDown(); else { const e = sim.callArmy(); if (e) toast(e); } syncButtons(); };
$('btnArmy').addEventListener('click', armyClick); $('btnArmyBar').addEventListener('click', armyClick); // the ring of the mouse, and a button for the phone
$('btnPlaceOk').addEventListener('click', () => ctl.confirmPlace());
$('btnPlaceNo').addEventListener('click', () => ctl.cancelPlacing());
$('btnPlaceRot').addEventListener('click', () => ctl.rotateGroup());
// skip the night: the game is run on at once, as fast as the machine allows (a slice of every frame), until the morning; only while the village is
// asleep and safe, and it stops the moment there is any trouble
const skipBtn = $<HTMLButtonElement>('btnSkip');
let skipping = false;
function stopSkip(why?: string) { if (!skipping) return; skipping = false; syncButtons(); if (why) toast(why); }
skipBtn.addEventListener('click', () => {
  if (skipping) { stopSkip('Đã dừng tua'); return; }
  const why = sim.skipNightBlock();
  if (why) { toast(why); return; }
  skipping = true; syncButtons();
});
/** Runs the skip for this frame: ticks of the game for up to ~30 ms, looking at the safety every game second. */
function runSkip() {
  const t0 = performance.now();
  while (skipping && performance.now() - t0 < 30) {
    for (let i = 0; i < 20; i++) sim.tick(TICK);
    const why = sim.skipNightBlock();
    if (why) stopSkip(why.startsWith('Chỉ tua') || sim.tod < 0.03 ? 'Trời đã sáng' : `Dừng tua: ${why}`); // at the break of day people get up while the clock still says night
  }
}
function syncSkip() {
  skipBtn.hidden = !sim.restTime && !skipping;
  skipBtn.textContent = skipping ? '⏹ Dừng tua' : '⏭ Qua đêm';
  skipBtn.classList.toggle('dim', !skipping && !!sim.skipNightBlock());
}
function setSpeed(s: number) { sim.speed = s; if (s > 0) { settings.speed = s; saveSettings(settings); } syncButtons(); }
function togglePlace(kind: BuildingKind) { if (ctl.placing === kind) ctl.cancelPlacing(); else { ctl.startPlacing(kind); menu.close(); tray.close(); } }
function openWorkshop() { const b = sim.buildings.find((x) => x.kind === 'workshop' && x.done); if (b) { ctl.selectBuilding(b.id, true); ctl.centerOn((b.x + 1) * TILE, (b.y + 1) * TILE); } else toast('Chưa có Xưởng'); }
/** The speed button: the speed asked for, and when the machine cannot keep it up, the speed it really runs at. */
function showSpeed() {
  const slow = sim.speed > 1 && realRate < sim.speed * 0.85;
  speedBtn.textContent = sim.speed === 0 ? '❚❚' : slow ? `${sim.speed}× (≈${realRate < 10 ? realRate.toFixed(1) : Math.round(realRate)}×)` : `${sim.speed}×`;
  speedBtn.title = slow ? 'Máy không theo kịp tốc độ này: game đang chạy nhanh hết mức có thể để màn hình vẫn mượt' : '';
  speedBtn.setAttribute('aria-pressed', String(sim.speed === 0));
}
function syncButtons() {
  showSpeed();
  { const on = sim.alarmUntil > sim.time, army = $('btnArmy'); army.setAttribute('aria-pressed', String(on)); army.textContent = on ? '🏠' : '⚔'; army.title = on ? 'Cho quân về trại nghỉ' : 'Gọi quân đội ra khỏi trại'; army.hidden = !sim.villagers.some((v) => v.job === 'fight' && !v.guard); const bar = $('btnArmyBar'); bar.hidden = army.hidden; bar.setAttribute('aria-pressed', String(on)); bar.textContent = on ? '🏠' : '⚔'; bar.title = army.title; }
  { const lb = $('btnLegion'); if (!sim.legion.on) ctl.legionControl = false; lb.hidden = !sim.legion.on; lb.setAttribute('aria-pressed', String(ctl.legionControl)); }
  { const n = ctl.selected.size; $('selPill').hidden = n === 0; $('btnSelCount').textContent = `▣ ${n}`; } // one small pill, only while somebody is chosen
  $('btnNone').hidden = ctl.selected.size === 0 && ctl.selectedBuilding === null && !ctl.inspect;
}
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof HTMLElement && /input|textarea|select/i.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'p') setSpeed(sim.speed === 0 ? 1 : 0);
  else if (k === 'o') toggleSound('sfx'); else if (k === 'i') toggleSound('amb'); else if (k === 'u') toggleSound('mus');

  else if (k === 'q') setSpeed(1); else if (k === 'e') setSpeed(2); else if (k === 'r') setSpeed(4); else if (k === 't') setSpeed(16);
  else if (k === 'b') togglePlace('storage'); else if (k === 'x') togglePlace('workshop'); else if (k === 'c') openWorkshop();
  else if (k === 'tab') { e.preventDefault(); menu.toggle(); }
  else if (k === 'm') { if (map.isOpen) map.close(); else map.open(); }
});

// ---------------------------------------------------------------- the clock of the day: a bar from midnight to midnight, light by day and dark by night, with the moment marked
const dayCanvas = $<HTMLCanvasElement>('daybarCanvas'), dayText = $('daybarText');
let dayKey = '';
function drawDayBar() {
  const tod = sim.tod, key = `${Math.floor(tod * 150)}|${sim.season}|${sim.day}|${sim.resting}`;
  if (key === dayKey) return;
  dayKey = key;
  const c = dayCanvas.getContext('2d')!, w = dayCanvas.width, h = dayCanvas.height;
  c.clearRect(0, 0, w, h);
  for (let x = 0; x < w; x++) { // the colour of each moment: the light of the sky at that time of the day
    const l = lightAt(x / w, sim.season);
    c.fillStyle = `rgb(${Math.round(24 + 214 * l)}, ${Math.round(30 + 190 * l)}, ${Math.round(70 + 90 * l)})`;
    c.fillRect(x, 0, 1, h);
  }
  const at = Math.round(tod * w);
  c.fillStyle = '#fff'; c.fillRect(Math.max(0, Math.min(w - 2, at - 1)), 0, 2, h);
  c.font = '11px sans-serif'; c.textBaseline = 'middle'; c.textAlign = at > w - 12 ? 'right' : at < 12 ? 'left' : 'center';
  c.fillText(sim.part === 'night' || sim.part === 'dusk' ? '☾' : '☀', at, h / 2);
  dayText.textContent = `Ngày ${sim.day} · ${DAY_PART_NAME[sim.part]}`;
}

// ---------------------------------------------------------------- the top bar and the log
const REGION_NAME = { plains: 'Đồng bằng', sparse: 'Rừng thưa', dense: 'Rừng rậm', mountain: 'Núi', water: 'Vùng nước' } as const;
// the coloured squares of the top bar give way to drawn pictures
for (const [id, key] of [['rFood', 'food'], ['rWood', 'wood'], ['rStone', 'stone'], ['rHide', 'hide'], ['rBone', 'bone'], ['rFat', 'fat'], ['rFeather', 'feather'], ['rTusk', 'tusk'], ['rTorch', 'torch'], ['rCoin', 'coin'], ['rPop', 'pop']]) $(id).querySelector('i')?.replaceWith(resIcon(key));
// the quest and notice buttons stand at the left edge; each opens its window over the map, and a red mark says something new is waiting
const eraDialog = new EraDialog($('epanel'));
const statsOverview = new StatsOverview(ctx), statsDlg = new GameDialog($('spanel'), {});
const statsCard = dlg.card({ wide: true, label: 'Chỉ số đã nghiên cứu' }, dlg.head({ pic: '📊', title: 'Chỉ số đã nghiên cứu', sub: 'Chung cho mỗi loại dân, nghề và lính', onClose: () => statsDlg.hide() }), statsOverview.root);
const openStats = () => { settingsOpen = false; statsOverview.update(); statsDlg.show(statsCard); };
const settingsPanel = new SettingsPanel(ctx, { close: () => { statsDlg.hide(); settingsOpen = false; }, openStats, autosave: { get: () => session.auto, set: (on) => { session.auto = on; settings.autosave = on; saveSettings(settings); } }, quality: { get: () => settings.quality, set: (q) => { settings.quality = q; saveSettings(settings); applyQuality(); } } });
soundChanged = () => settingsPanel.update();
let settingsOpen = false;
$('btnSettings').addEventListener('click', () => { if (statsDlg.isOpen) { statsDlg.hide(); settingsOpen = false; return; } settingsPanel.opened(); statsDlg.show(settingsPanel.card); settingsOpen = true; });
let weatherView: { head: string; rows: Array<[string, string]> } = { head: '', rows: [] };
const journal = new Journal(ctx, { quests: $('qpanel'), notices: $('npanel') }, { quests: $('btnQuest'), notices: $('btnNotice') });
journal.weather = () => weatherView;
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
  const cap = sim.capacity();
  const need = sim.foodNeed(), pen = sim.foodPenalty;
  setRes('rFood', sim.stock.food, sim.capacity('food')); // the pot of the campfire is filled first: only what is over is in the store
  $('rFood').classList.toggle('warn', pen > 0);
  $('rFood').title = `Thức ăn: kho ${Math.floor(sim.stock.food)} + phần ăn của lửa trại ${Math.floor(sim.foodPot)}/${need}. Cuối mỗi ngày làng ăn ${need}; thiếu thì cả làng yếu đi.${pen > 0 ? ` Đang yếu ${Math.round(pen * 1000) / 10}% vì bữa trước thiếu ăn.` : ''}`;
  setRes('rWood', sim.stock.wood, sim.capacity('wood')); setRes('rStone', sim.stock.stone, sim.capacity('stone')); setRes('rHide', sim.stock.hide, sim.capacity('hide')); setRes('rCoin', sim.stock.coin, sim.capacity('coin')); $('rCoin').title = `${RES_NAME.coin}: tiền của làng, nhặt khi hái lượm, đổi hàng ở Kho, nhận từ bộ tộc. Dùng để trả cho nghiên cứu.`;
  { const el = $('rTorch'), n = sim.torchCount(); el.hidden = n <= 0; if (n > 0) el.querySelector('b')!.textContent = String(n); }
  for (const [id, res] of [['rBone', 'bone'], ['rFat', 'fat'], ['rFeather', 'feather'], ['rTusk', 'tusk']] as const) {
    const el = $(id), n = Math.floor(sim.stock[res]);
    el.hidden = n <= 0; if (n > 0) el.querySelector('b')!.textContent = String(n);
  }
  $('rPop').querySelector('b')!.textContent = String(sim.villagers.length); $('rPop').querySelector('small')!.textContent = `/${sim.popCap()}`;
  for (const r of RES_LIST) void RES_NAME[r];
  drawDayBar();
  const se = SEASON_DEF[sim.season], we = WEATHER[sim.weather], year = yearOf(sim.day);
  // the region under the middle of the screen, once somebody has been there (what lies in the dark is not told)
  const mid = renderer.screenToWorld(renderer.w / 2, renderer.h / 2), mx = Math.floor(mid.x / TILE), my = Math.floor(mid.y / TILE);
  const region = sim.world.inBounds(mx, my) ? (sim.fog.state[my * sim.world.size + mx] > 0 ? REGION_NAME[sim.world.regionAt(mx, my)] : 'Vùng chưa khám phá') : 'Ngoài bản đồ';
  { const f = sim.campfire(), s = sim.world.start; $('btnHome').hidden = Math.hypot(mid.x / TILE - (f ? f.x + 1 : s.x), mid.y / TILE - (f ? f.y + 1 : s.y)) < 30; } // the camera is far from the village: a way back
  const outdoor = we.work * se.work;
  const eff = [we.vision ? `tầm nhìn −${we.vision} ô` : '', we.speed < 1 ? `đi chậm ${Math.round((1 - we.speed) * 100)}%` : '', outdoor < 1 ? `làm việc ngoài trời chậm ${Math.round((1 - outdoor) * 100)}%` : ''].filter(Boolean).join(', ');
  weatherView = { // the time and the weather live in the window of the notices (the bell)
    head: `${year > 1 ? `Năm ${year} · ` : ''}Ngày ${sim.day} · ${se.name} ${dayInSeason(sim.day)}/${SEASON_DAYS} · ${DAY_PART_NAME[sim.part]}`,
    rows: [['Thời tiết', we.name], ...(eff ? [['Ảnh hưởng', eff] as [string, string]] : []), ['Vùng', region], ['Hái lượm', `×${se.gather.toLocaleString('vi')} (mùa ${se.name.toLowerCase()})`],
      ...(sim.signalled && sim.nextWeather !== sim.weather ? [['Ngày mai', WEATHER[sim.nextWeather].name] as [string, string]] : []), ['Khung hình', `${Math.round(fps)} fps`]],
  };

  // quests and notices: the windows are drawn by the journal; here only the toast when a quest is done
  const selB = ctl.selectedBuilding === null ? undefined : sim.getBuilding(ctl.selectedBuilding);
  const views = sim.quests({ selected: selB?.kind ?? null, panel: selB && ctl.buildingOpen ? selB.kind : null, inspecting: ctl.inspect?.kind ?? null });
  const lk = views.map((v) => (v.done ? 'd' : v.open ? 'o' : 'l')).join('');
  if (lk !== logKey) {
    const prev = logKey.indexOf('o') >= 0 ? views[logKey.indexOf('o')] : undefined;
    if (prev?.done) toast(`Hoàn thành: ${prev.quest.title}`);
    logKey = lk;
  }
  journal.update(views, sim.notices());
  // the context panels keep clear of the top bar, however many rows it wraps into
  const topH = Math.ceil(topBar.getBoundingClientRect().height);
  if (topH !== lastTopH) { lastTopH = topH; document.documentElement.style.setProperty('--top-h', `${topH}px`); }

  // a tribe that has just given in: take the player to the choice
  if (sim.pendingTribe !== pending) { pending = sim.pendingTribe; if (pending) { buildingPanel.openTribes(); toast('Một bộ tộc xin hàng!'); } }

  // which panels show
  const chosen = sim.villagers.filter((v) => ctl.selected.has(v.id));
  const placing = !!ctl.placing, showB = ctl.selectedBuilding !== null && ctl.buildingOpen && !placing;
  buildingPanel.update(); buildingBar.update(); upgradePlanBar.update(); unitCard.update(chosen); targetCard.update();
  warBar.update(); document.body.classList.toggle('war', warBar.active); // war mode: the selection and building buttons give way to the battle buttons
  if (placing || !showB) $('bpanel').hidden = true;
  if (placing || showB) { $('ucard').hidden = true; unitCard.closeDetail(); }
  if (placing || showB) $('tcard').hidden = true;
  const bar = $('placeBar'); bar.hidden = !placing;
  if (placing && ctl.placing) {
    const why = ctl.placeProblem(), moving = ctl.moving !== null ? sim.getBuilding(ctl.moving) : undefined;
    $('btnPlaceRot').hidden = !ctl.groupMoving && !ctl.canTurnGate;
    $('placeName').textContent = ctl.groupMoving ? `Dời ${ctl.groupIds.length} mảnh hàng rào` : `${moving ? 'Dời' : 'Đặt'} ${BUILDINGS[ctl.placing].name}`; $('placeInfo').textContent = why ?? (ctl.groupMoving ? 'Chỗ này đặt được · bấm Xoay để quay nhóm' : moving ? `Phí dời: ${costText(sim.moveFee(moving), RES_NAME)}` : 'Chỗ này đặt được');
    $<HTMLButtonElement>('btnPlaceOk').disabled = why !== null;
    $('btnPlaceOk').textContent = moving || ctl.groupMoving ? '✓ Dời tới đây' : '✓ Đặt ở đây';
  }
  menu.update(); tray.update(); tray.badge($('btnBuild')); if (statsDlg.isOpen) statsOverview.update();
  syncButtons();
}
ctl.onChange = () => { lastHud = 0; syncButtons(); };

// ---------------------------------------------------------------- main loop
let last = 0, drawn = 0, lastWarEnd = 0, seenLoads = 0, nextDraw = 0, activeUntil = 0, camX = cam.x, camY = cam.y, camZ = cam.zoom;
let celebrating: (typeof sim.plans)[number] | null = null;
/** Frames the game may skip drawing while it runs fast-forward: the simulation needs the time, and nobody follows each step at that speed. */
const drawEvery = (): number => (sim.speed >= 16 ? 4 : sim.speed >= 8 ? 3 : sim.speed >= 4 ? 2 : 1);
let lastError = '';
/** One frame. An error inside it must never stop the loop (the game would freeze for good): it is logged, shown once as a toast, and the next frame still comes. */
function frame(t: number) {
  try { frameBody(t); } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? `${err.message} @ ${(err.stack ?? '').split('\n')[1]?.trim() ?? ''}` : String(err);
    if (msg !== lastError) { lastError = msg; toast(`Lỗi: ${msg}`); }
  }
  requestAnimationFrame(frame);
}
function frameBody(t: number) {
  const t0 = performance.now();
  const dt = last ? (t - last) / 1000 : 0; last = t;
  if (dt > 0) fps = fps * 0.9 + (1 / dt) * 0.1;
  if (sim.loads !== seenLoads) { seenLoads = sim.loads; audio.reset(); celebrating = null; lastWarEnd = Math.max(0, ...sim.plans.map((q) => q.endedAt ?? 0)); } // a saved game was put in: the war sound of the game that was stops, and the wars already over are not announced again
  ctl.update(dt);
  audio.update(started ? sim.weather : 'clear', dt);
  audio.fightOn = started && !sim.atWar() && (sim.tribes.some((t) => t.raid) || sim.events.some((e) => e.live)); // a raid or a pack at the village: the war music, and no peace music, until it is over
  audio.setPeace(started && !sim.atWar() && !sim.battle.on && !audio.fightOn, dt);
  for (const a of sim.alerts) { audio.alert(a.kind); if (a.kind === 'era') eraDialog.show(); else if (a.text) toast(a.text); }
  sim.alerts.length = 0;
  { // a war that has just been decided: the sound of the win or the loss, once
    const p = started ? sim.plans.find((q) => q.kind === 'attack' && q.result && q.endedAt > lastWarEnd) : undefined;
    if (p) { lastWarEnd = p.endedAt; celebrating = p.result === 'won' ? p : null; if (sim.time - p.endedAt < 5 && !(p.skirmish && p.result === 'lost')) audio.warEnded(p.result as 'won' | 'lost', performance.now() / 1000); }
    if (celebrating && (celebrating.stage === 'recall' || (celebrating.skirmish && sim.time - celebrating.endedAt > audio.skirmishCheer))) { audio.stopVictory(); celebrating = null; } // he gave the word to pull out: no more cheering
  }
  audio.setNight(started && sim.part === 'night', sim.time, sim.dayLen);
  audio.setBirds(started && !sim.atWar() && sim.part !== 'night' && sim.season !== 'winter' && (sim.weather === 'clear' || sim.weather === 'mist'), dt, sim.time);
  if (started) session.tick();
  { const m = 10, z = cam.zoom; sim.view = { x0: cam.x / TILE - m, y0: cam.y / TILE - m, x1: (cam.x + renderer.w / z) / TILE + m, y1: (cam.y + renderer.h / z) / TILE + m }; } // seen: the screen and 10 tiles round it
  const simT0 = sim.time, budget = sim.speed >= 4 ? quality.fastBudgetMs : quality.simBudgetMs; // fast-forwarded, the simulation takes less of the frame so the screen and the touches are not starved
  if (skipping) runSkip(); else sim.advance(dt, () => performance.now() - t0 > budget);
  if (sim.speed !== rateSpeed) { rateSpeed = sim.speed; realRate = sim.speed; }
  if (dt > 0 && !skipping && sim.speed > 1) realRate = realRate * 0.95 + ((sim.time - simT0) / dt) * 0.05; // the speed the game really runs at
  if (t - rateShown > 500) { rateShown = t; showSpeed(); }
  syncSkip();
  renderer.cue = ctl.armedAt;
  const busy = !!ctl.ghost() || !!ctl.box || !!ctl.armedAt; // placing or dragging a box: draw every frame so the hand is not behind
  // the frame cap of the quality setting: full rate while the player moves the map, zooms, touches the screen or something flies; the lower one while only the animations (4 to 12 a second) and the ticks (20) change the picture
  if (cam.x !== camX || cam.y !== camY || cam.zoom !== camZ || ctl.interacting || busy || sim.projectiles.length > 0) activeUntil = t + 600;
  camX = cam.x; camY = cam.y; camZ = cam.zoom;
  const cap = t < activeUntil ? quality.fps : quality.idleFps;
  if (cap) nextDraw = Math.min(nextDraw, t + 1000 / cap); // back to the full rate at once when the player moves
  const want = busy || skipping || ++drawn >= drawEvery();
  if (want && (skipping || !cap || t >= nextDraw - 1)) {
    drawn = 0; nextDraw = cap ? Math.max(nextDraw + 1000 / cap, t - 1000 / cap) : 0;
    renderer.draw(t / 1000, ctl.selected, ctl.box, ctl.markers, ctl.ghost(), ctl.selectedBuilding, ctl.inspect, ctl.groupMode && !ctl.groupMoving ? ctl.groupIds : []);
    buildingBar.place();
  }
  if (map.isOpen) map.draw(); // the big map is drawn only while it is open (the small corner map stays hidden)
  $('sheet').classList.toggle('hushed', ctl.hushCard);
  if (settingsOpen && statsDlg.isOpen) settingsPanel.update(); else settingsOpen = false;
  updateHud(t);
}
new ResizeObserver(() => { renderer.resize(); ctl.clamp(); }).observe(view);
requestAnimationFrame(frame);
syncRotate();

// Bridge for tests and the console.
(window as unknown as { __game: unknown }).__game = { sim, cam, ctl, renderer, menu, map, session, research: RESEARCH };

// ---------------------------------------------------------------- continue a saved game
// The game starts at once with a new world. If there is a save, a question comes first and the game waits for the answer.
function begin(): void { started = true; startDialog.hide(); setSpeed(settings.speed); }
document.addEventListener('visibilitychange', () => { if (document.hidden && started && session.auto) void session.save(); });
void (async () => {
  const saves = await session.list(), params = new URLSearchParams(location.search);
  if (params.get('new') === '1' || !saves.length) { started = true; return; } // a game the player asked for, or nothing to go on from
  // a page loaded to continue from one save (what "Tải" does for a save of another world): put it in when it is of this world
  const want = params.get('continue'), wanted = want ? saves.find((m) => m.id === (want === '1' ? AUTO_SAVE : want)) : undefined;
  if (wanted && wanted.seed === seed) { if (await session.resume(wanted.id)) toast('Đã tải lại ván chơi'); else toast('Không đọc được bản lưu'); begin(); return; }
  sim.speed = 0; syncButtons();
  const latest = saves[0], when = new Date(latest.savedAt).toLocaleString('vi');
  const goOn = async (m: SaveMeta) => { const r = await session.open(m); if (r === 'loaded') { toast('Đã tải lại ván chơi'); begin(); } else if (r === 'failed') toast('Không đọc được bản lưu'); };
  const ask = () => {
    const fresh = dlg.button('Ván mới', begin, { tone: 'alt' }); fresh.title = 'Các bản lưu vẫn còn: tải lại lúc nào cũng được trong Cài đặt';
    const more = dlg.button(`Chọn bản lưu khác (${saves.length})`, () => pick(), { tone: 'alt' });
    startDialog.show(dlg.card({ label: 'Làng Đồ Đá' },
      dlg.head({ pic: '🔥', title: 'Làng Đồ Đá', sub: `Có ván đang chơi dở: ${saveTitle(latest)}, ${latest.population} dân (lưu lúc ${when}).` }),
      dlg.buttons(dlg.button('Tiếp tục', () => { void goOn(latest); }), ...(saves.length > 1 ? [more] : []), fresh)));
  };
  const pick = () => {
    const tiles = () => dlg.list(...saves.map((m) => saveTile(m, { current: false, locked: null, onLoad: () => { void goOn(m); }, onDelete: () => { void session.remove(m.id).then(() => { saves.splice(saves.indexOf(m), 1); if (!saves.length) begin(); else pick(); }); } })));
    startDialog.show(dlg.card({ label: 'Chọn bản lưu', wide: true }, dlg.head({ pic: '💾', title: 'Chọn bản lưu', sub: `${saves.length} bản lưu trên máy này` }), tiles(), dlg.buttons(dlg.button('Quay lại', () => ask(), { tone: 'alt' }))));
  };
  ask();
})();
