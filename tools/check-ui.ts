// Builds every panel of the screen against a fake DOM, to catch exceptions that would stop the game from starting.
import { Camera, Renderer } from '../src/render/renderer';
import { Sprites } from '../src/render/sprites';
import { Sim } from '../src/sim/sim';
import * as dev from '../src/sim/dev';
import { Controller } from '../src/ui/controller';
import { Menu } from '../src/ui/menu';
import { MapView } from '../src/ui/minimap';
import { BuildingBar, Confirm } from '../src/ui/buildbar';
import { BuildingPanel, Ctx, TargetCard, UnitCard } from '../src/ui/panels';
import { WarPanel } from '../src/ui/warpanel';
import { WarBar } from '../src/ui/warbar';
import { MemoryStore } from '../src/save/store';
import { Session } from '../src/save/session';
import { BUILDINGS, BuildingKind, maxLevel } from '../src/sim/buildings';
import { RECIPES } from '../src/sim/tools';

const fakeEl = (): unknown => {
  const kids: unknown[] = [], store: Record<string, unknown> = { children: kids, hidden: false, dataset: {}, style: new Proxy({}, { get: () => '', set: () => true }), classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, clientWidth: 800, clientHeight: 400, textContent: '', innerHTML: '', value: '', width: 100, height: 100 };
  return new Proxy(store, {
    get(t, p) {
      if (p in t) return t[p as string];
      if (p === 'append' || p === 'appendChild' || p === 'replaceChildren' || p === 'prepend') return (...a: unknown[]) => { if (p === 'replaceChildren') kids.length = 0; kids.push(...a); return a[0]; };
      if (p === 'getContext') return () => fakeCtx;
      if (p === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 800, height: 400 });
      if (p === 'querySelector') return () => fakeEl();
      if (p === 'querySelectorAll') return () => [];
      if (p === 'closest') return () => null;
      return () => undefined;
    },
    set(t, p, v) { t[p as string] = v; return true; },
  });
};
const fakeCtx = new Proxy({}, { get: (_t, p) => (p === 'getImageData' || p === 'createImageData' ? (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }) : p === 'measureText' ? () => ({ width: 10 }) : p === 'createLinearGradient' || p === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => undefined), set: () => true });
const g = globalThis as Record<string, unknown>;
g.document = { createElement: fakeEl, getElementById: fakeEl, createTextNode: (t: string) => ({ textContent: t }), querySelector: fakeEl, querySelectorAll: () => [], addEventListener() {}, documentElement: fakeEl() };
g.ImageData = class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} };
g.devicePixelRatio = 1; g.window = g; g.innerWidth = 800; g.innerHeight = 400; g.matchMedia = () => ({ matches: false, addEventListener() {} });
g.location = { search: '' }; g.Node = class {}; (g.window as Record<string, unknown>).addEventListener = () => undefined; g.addEventListener = () => undefined; g.ResizeObserver = class { observe() {} }; g.HTMLElement = class {};

const step = (name: string, fn: () => void) => { try { fn(); console.log('ok   ', name); } catch (e) { console.log('THROW', name, (e as Error).stack?.split('\n').slice(0, 5).join('\n')); } };

const sim = new Sim(1337);
const view = fakeEl() as HTMLCanvasElement, cam: Camera = { x: 0, y: 0, zoom: 2 };
const sprites = new Sprites();
let renderer!: Renderer, ctl!: Controller, ctx!: Ctx;
step('renderer and controller', () => { renderer = new Renderer(view, sim, cam, sprites); ctl = new Controller(view, sim, cam, renderer); });
ctx = { sim, ctl, sprites, session: new Session(sim, new MemoryStore()), toast: () => undefined };
const el = () => fakeEl() as HTMLElement;
step('unit card', () => new UnitCard(el(), ctx, el()));
step('target card', () => new TargetCard(el(), ctx));
let panel!: BuildingPanel;
step('building panel', () => { panel = new BuildingPanel(el(), ctx); });
let bar!: BuildingBar;
step('building bar', () => { bar = new BuildingBar(el(), ctx, renderer, new Confirm(el(), ctx)); });
step('map', () => new MapView(sim, cam, renderer, ctl, el() as HTMLCanvasElement, el() as HTMLCanvasElement, el()));
let menu!: Menu;
step('menu', () => { menu = new Menu(el(), el(), el(), ctx, () => ({ x: 0, y: 0 })); });
step('menu open on every tab', () => { for (const t of ['build', 'places', 'dev', 'tribes', 'people']) { try { menu.open(t as never); menu.update(); } catch (e) { throw new Error(`tab ${t}: ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`); } } });
step('panels update for every kind of building', () => {
  dev.combatReady(sim); dev.defenseLine(sim, 8); dev.raiseArmy(sim, 'bow', 2); dev.garrisonTowers(sim);
  for (const b of sim.buildings) { ctl.selectedBuilding = b.id; ctl.buildingOpen = true; try { panel.update(); bar.update(); } catch (e) { throw new Error(`${b.kind}: ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`); } }
});

step('every building has art for each level and stage, and every recipe an icon', () => {
  for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) for (let lv = 1; lv <= maxLevel(kind, 'stone') + (kind === 'gate' ? 2 : 0); lv++) for (let st = 0; st <= 4; st++) sprites.building(kind, 'stone', lv, st);
  const missing = RECIPES.filter((r) => !sprites.icons[r.id]).map((r) => r.id);
  if (missing.length) throw new Error(`no icon for ${missing.join(', ')}`);
});

step('war tent pages and the battle HUD, with squads, maps, plans and a fight on', () => {
  dev.combatReady(sim); dev.giveMaps(sim, 3); dev.formSquads(sim); dev.sampleAttack(sim); dev.sampleDefense(sim);
  const plan = sim.plans.find((p) => p.kind === 'attack')!; sim.startPlan(plan);
  dev.enemyWave(sim, 'axe', ['club', 'bow', 'spear']);
  for (let i = 0; i < 200; i++) (sim as unknown as { tick(d: number): void }).tick(0.05);
  const war = new WarPanel(ctx);
  for (const t of ['plan', 'defense', 'log'] as const) { try { war.open(t); } catch (e) { throw new Error(`war tab ${t}: ${(e as Error).stack?.split(String.fromCharCode(10)).slice(0, 3).join(' | ')}`); } }
  war.openMap('axe'); war.closeMap();
  renderer.draw(0, new Set(), null, [], null, null, null);
});

step('deploying a plan: panels closed, war mode on, the screen goes on updating', () => {
  const sim2 = new Sim(1337);
  dev.combatReady(sim2); dev.giveMaps(sim2, 3); dev.formSquads(sim2); const plan = dev.sampleAttack(sim2)!;
  const c2: Ctx = { ...ctx, sim: sim2 };
  const warPanel = new WarPanel(c2), tent = new BuildingPanel(el(), c2), warBar = new WarBar(el(), c2);
  const fire = sim2.campfire()!, wt = sim2.building('wartent')!;
  void fire; c2.ctl.selectedBuilding = wt.id; c2.ctl.buildingOpen = true;
  warPanel.openMap('axe');
  for (let i = 0; i < 3; i++) { warPanel.update(); tent.update(); }
  const err = sim2.startPlan(plan);
  if (err) throw new Error(`the sample plan would not start: ${err}`);
  warPanel.closeMap(); c2.ctl.closeBuilding();
  if (!(warPanel as unknown as { full: { hidden: boolean } }).full.hidden) throw new Error('the full-screen map stays over the game after the plan is deployed');
  { // the same, when only the building panel is closed and the map is left open
    const t2 = new BuildingPanel(el(), c2), w2 = (t2 as unknown as { war: WarPanel }).war;
    c2.ctl.selectedBuilding = wt.id; c2.ctl.buildingOpen = true; t2.update(); w2.openMap('axe'); t2.update();
    c2.ctl.closeBuilding(); t2.update();
    if (w2.mapOpen) throw new Error('a map is left open without its tent');
  }
  for (let i = 0; i < 400; i++) { (sim2 as unknown as { tick(d: number): void }).tick(0.05); tent.update(); warBar.update(); warPanel.update(); }
  if (!warBar.active) throw new Error('war mode is not on');
});
