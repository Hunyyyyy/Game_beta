/**
 * The film player: a scene of the story (data/stages/*.json) played on a stage of its own, over the whole screen, while time in the village stands still.
 * A scene is a list of shots; a shot has a camera (cut or move), a stage (the hall, an insert, a far view) and events in time (poses, walks, lines, a choice).
 * The paintings are in stageart.ts; the actors are the figures of the game's own rig. The screen only talks to the game through `Sim` (setStoryFlag).
 */
import { ENC } from '../sim/encounterdata';
import { characterOf } from '../sim/characters';
import type { Look } from '../sim/model';
import type { Villager } from '../sim/sim';
import BDD_1_1 from '../data/stages/bdd_1_1.json';
import type { Ctx } from './ctx';
import { h } from './dom';
import { portraitFrom } from './dialogue';
import { SW, TABLE, paintBook, paintChairs, paintCourt, paintFloor, paintPillar, paintRiver, paintTable, paintWall } from './stageart';

type V3 = [number, number, number];
type Face = 'left' | 'right' | 'front' | 'back';
interface Reply { who: string; expr?: string; text: string }
interface Opt { text: string; say?: string; flag?: string; marks?: string; reply: Reply[] }
interface Ev { t: number; do: 'pose' | 'place' | 'move' | 'say' | 'choice' | 'porters' | 'crowd' | 'fade'; who?: string; pose?: string; face?: Face; end?: Face; at?: [number, number]; to?: [number, number] | number; dur?: number; text?: string; expr?: string; from?: number; mode?: string; default?: number; options?: Opt[] }
interface Shot { id: string; stage: 'hall' | 'insert_book' | 'river_far'; dur: number; camDur?: number; cam: V3 | { from: V3; to: V3 }; blur?: boolean; ease?: 'linear'; events: Ev[] }
interface Cast { char?: string; name: string; look?: Look; outfit?: string; x: number; y: number; face: Face; pose: string; hidden?: boolean }
interface SceneDef { id: string; title: string; timeout: number; cast: Record<string, Cast>; shots: Shot[] }
const SCENES: Record<string, SceneDef> = { bdd_1_1: BDD_1_1 as unknown as SceneDef };

/** How a pose is drawn from the rig's own clips. The clips that are not drawn yet (flip_book, lean_in...) are the idle one, tilted or bobbing a little; see doc/ART_BRIEF.md. */
interface PoseDef { anim: string; rate?: number; rot?: number; dy?: number; bob?: [number, number] }
const POSES: Record<string, PoseDef> = {
  idle: { anim: 'idle' }, sit: { anim: 'idle' }, stand: { anim: 'idle' }, walk: { anim: 'walk' }, walk_slow: { anim: 'walk', rate: 0.5 },
  flip_book: { anim: 'idle', rot: 4, bob: [2.5, 0.9] }, lean_in: { anim: 'idle', rot: 8 }, lean_back: { anim: 'idle', rot: -6 }, look_up: { anim: 'idle', rot: -3, dy: -3 }, look_down: { anim: 'idle', rot: 3, dy: 2 }, tap: { anim: 'idle', rot: -4, bob: [2.2, 2.6] },
};
const ACTOR_H = 190, CROWD_H = 70, PORTER_H = 340;

interface Actor { id: string; name: string; fake: Villager; x: number; y: number; face: Face; pose: string; clock: number; rot: number; hidden: boolean; m?: { bottom: number; h: number }; move?: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; pose: string; face: Face; end?: Face } }
interface Line { who: string; expr?: string; text: string }

const ease = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2);
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const fakeOf = (look: Look, outfit: string | undefined): Villager => ({ look, outfit, armor: undefined, team: 'player', anim: 'idle', animClock: 0, facing: 'front', hold: null, carry: null, lit: false, speed: 1.5, id: 0 }) as unknown as Villager;

/** The rows of the figure that has pixels: where its feet are in the picture and how tall it is, so every actor stands on its own feet at the same size. */
function measure(spr: HTMLCanvasElement): { bottom: number; h: number } {
  const px = spr.getContext('2d')!.getImageData(0, 0, spr.width, spr.height).data;
  let y0 = spr.height, y1 = -1;
  for (let y = 0; y < spr.height; y++) for (let x = 0; x < spr.width; x++) if (px[(y * spr.width + x) * 4 + 3] > 0) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return y1 < 0 ? { bottom: spr.height, h: spr.height } : { bottom: y1 + 1, h: y1 - y0 + 1 };
}

export class StagePlayer {
  private scene: SceneDef | null = null;
  private actors = new Map<string, Actor>();
  private crowd: Array<{ a: Actor; x0: number; dir: number }> = [];
  private porters: { t: number; dur: number } | null = null;
  private stopped = false;
  private shotIx = -1;
  private camT = 0;
  private evT = 0;
  private evIx = 0;
  private stT = 0;
  private blurT = 0;
  private blur = 0;
  private fade = { a: 1, from: 1, to: 1, t: 0, dur: 0 };
  private queue: Line[] = [];
  private talk: { line: Line; shown: number; t0: number; full: boolean; fullAt: number } | null = null;
  private choice: { opts: Opt[]; def: number; left: number } | null = null;
  private done = false;
  private defFlag = '';
  private canvas = document.createElement('canvas');
  private bust = h('div', { class: 'st-bust' });
  private plate = h('div', { class: 'st-plate' });
  private text = h('p', { class: 'st-text' });
  private more = h('span', { class: 'st-more', text: '▼ bấm để tiếp', hidden: true });
  private cards = h('div', { class: 'st-cards' });
  private timer = h('div', { class: 'st-timer' });
  private panel = h('div', { class: 'st-panel', hidden: true }, this.plate, h('div', { class: 'st-frame' }, this.text, this.more), this.cards, this.timer);

  constructor(private readonly c: Ctx, private readonly root: HTMLElement) {
    root.append(this.canvas, h('div', { class: 'st-ui' }, h('button', { class: 'sm st-skip', type: 'button', text: 'Bỏ qua ▸▸', onclick: () => this.finish() }), this.bust, this.panel));
    root.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) this.next(); });
    window.addEventListener('keydown', (e) => { // while a scene plays the keys belong to it
      if (!this.active) return;
      if (e.key === ' ' || e.key === 'Enter') this.next();
      else if (/^[1-9]$/.test(e.key)) this.pick(Number(e.key) - 1);
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
  }

  /** A scene is on (the village waits). */
  get active(): boolean { return !this.root.hidden; }

  /** Play a scene of data/stages now. Returns an error text, or null. */
  play(id: string): string | null {
    const sc = SCENES[id];
    if (!sc) return 'Không có cảnh này';
    if (this.active) return 'Đang có một cảnh chạy';
    this.scene = sc; this.done = false; this.queue = []; this.talk = null; this.choice = null; this.porters = null; this.stopped = false; this.fade = { a: 1, from: 1, to: 1, t: 0, dur: 0 }; this.defFlag = '';
    this.actors.clear();
    const era = this.c.sim.era;
    for (const [key, k] of Object.entries(sc.cast)) {
      const ch = characterOf(k.char), look = (ch?.look ?? k.look) as Look, outfit = ch ? ch[era].armor ?? undefined : k.outfit;
      this.actors.set(key, { id: key, name: ch?.name ?? k.name, fake: fakeOf(look, outfit), x: k.x, y: k.y, face: k.face, pose: k.pose, clock: 0, rot: 0, hidden: !!k.hidden });
    }
    const outfits = ['peasant_hood_grey', 'peasant_hood_brown'], skins = ['#e0ac69', '#c68642', '#f0c8a0'];
    this.crowd = [0, 1, 2, 3].map((i) => ({ a: { id: `c${i}`, name: '', fake: fakeOf({ sex: i % 2 ? 'f' : 'm', skin: skins[i % 3], hair: '#3b2a1a', hide: '#8a6a3a', pants: '#4a4032' }, outfits[i % 2]), x: 1100 + i * 130, y: 405 + (i % 2) * 14, face: 'right', pose: 'walk_slow', clock: i, rot: 0, hidden: false }, x0: 1100 + i * 130, dir: i % 2 ? -1 : 1 }));
    this.root.hidden = false; this.root.classList.remove('st-over');
    this.enterShot(0);
    return null;
  }

  private shot(): Shot | undefined { return this.scene?.shots[this.shotIx]; }

  private enterShot(i: number): void {
    const s = this.scene?.shots[i];
    if (!s) { this.finish(); return; }
    this.shotIx = i; this.camT = 0; this.evT = 0; this.evIx = 0; this.stT = 0; this.blurT = s.blur ? 1 : 0; this.blur = this.blurT; this.porters = null;
  }

  // ---------------------------------------------------------------- the clock
  /** Every frame while a scene plays: the shot's time, its events, the actors, then the picture. */
  update(dt: number): void {
    if (!this.active || !this.scene) return;
    dt = Math.min(dt, 0.05);
    const s = this.shot();
    if (!s) return;
    this.camT += dt; this.stT += dt;
    this.blur += (this.blurT - this.blur) * Math.min(1, dt * 5);
    this.talkStep();
    let blocked = !!this.talk || this.queue.length > 0 || !!this.choice;
    if (!blocked) this.evT += dt;
    while (!blocked && this.evIx < s.events.length && s.events[this.evIx].t <= this.evT) { this.run(s.events[this.evIx++]); blocked = !!this.talk || this.queue.length > 0 || !!this.choice; }
    if (this.choice) { this.choice.left -= dt; if (this.choice.left <= 0) this.pick(this.choice.def); else this.timer.textContent = `Tự chọn sau ${Math.ceil(this.choice.left)} giây`; }
    for (const a of this.actors.values()) this.stepActor(a, dt);
    for (const k of this.crowd) this.stepCrowd(k, dt);
    if (this.porters) { this.porters.t += dt; if (this.porters.t > this.porters.dur) this.porters = null; }
    if (this.fade.dur > 0) { this.fade.t += dt; const u = Math.min(1, this.fade.t / this.fade.dur); this.fade.a = lerp(this.fade.from, this.fade.to, u); if (u >= 1) this.fade.dur = 0; }
    if (!blocked && this.evIx >= s.events.length && this.evT >= s.dur && this.fade.dur === 0) { this.enterShot(this.shotIx + 1); if (!this.scene) return; }
    this.draw();
  }

  private run(e: Ev): void {
    const a = e.who ? this.actors.get(e.who) : undefined;
    switch (e.do) {
      case 'pose': if (a) { if (e.face) a.face = e.face; if (e.pose === 'stand') a.move = { x0: a.x, y0: a.y, x1: a.x, y1: 655, t: 0, dur: 1, pose: 'stand', face: a.face }; else a.pose = e.pose ?? 'idle'; } break;
      case 'place': if (a && e.at) { a.x = e.at[0]; a.y = e.at[1]; a.hidden = false; if (e.face) a.face = e.face; } break;
      case 'move': if (a && Array.isArray(e.to)) a.move = { x0: a.x, y0: a.y, x1: e.to[0], y1: e.to[1], t: 0, dur: e.dur ?? 1, pose: e.pose ?? 'walk', face: e.face ?? a.face, end: e.end }; break;
      case 'say': this.queue.push({ who: e.who ?? '', expr: e.expr, text: e.text ?? '' }); break;
      case 'choice': this.openChoice(e); break;
      case 'porters': this.porters = { t: 0, dur: e.dur ?? 2.6 }; break;
      case 'crowd': this.stopped = e.mode === 'stop'; break;
      case 'fade': this.fade = { a: e.from ?? 0, from: e.from ?? 0, to: typeof e.to === 'number' ? e.to : 0, t: 0, dur: e.dur ?? 1 }; break;
    }
  }

  private stepActor(a: Actor, dt: number): void {
    a.clock += dt;
    const m = a.move;
    if (!m) return;
    m.t += dt;
    const u = Math.min(1, m.t / m.dur);
    a.x = lerp(m.x0, m.x1, u); a.y = lerp(m.y0, m.y1, u); a.face = m.face; a.pose = m.pose;
    if (u >= 1) { a.move = undefined; a.pose = 'idle'; if (m.end) a.face = m.end; }
  }

  private stepCrowd(k: { a: Actor; x0: number; dir: number }, dt: number): void {
    const a = k.a; a.clock += dt;
    if (this.stopped) { a.pose = 'idle'; a.face = 'left'; return; }
    a.pose = 'walk_slow'; a.x += k.dir * 26 * dt;
    if (a.x > 1700) k.dir = -1; else if (a.x < 1020) k.dir = 1;
    a.face = k.dir > 0 ? 'right' : 'left';
  }

  // ---------------------------------------------------------------- the words
  private talkStep(): void {
    if (!this.talk && this.queue.length) this.startLine(this.queue.shift()!);
    const t = this.talk;
    if (!t) return;
    const now = performance.now(), n = t.full ? t.line.text.length : Math.min(t.line.text.length, Math.floor(((now - t.t0) / 1000) * ENC.typeCps));
    if (n !== t.shown) { t.shown = n; this.text.textContent = t.line.text.slice(0, n); }
    if (n >= t.line.text.length && !t.full) { t.full = true; t.fullAt = now; }
    this.more.hidden = !(t.full && !this.choice);
  }

  private startLine(l: Line): void {
    const a = this.actors.get(l.who);
    this.talk = { line: l, shown: 0, t0: performance.now(), full: false, fullAt: 0 };
    this.plate.replaceChildren(h('b', { text: (a?.name ?? '').toUpperCase() }), ...(l.expr ? [h('i', { text: `(${l.expr})` })] : []));
    this.text.textContent = ''; this.cards.replaceChildren(); this.timer.textContent = '';
    this.bust.replaceChildren(a ? portraitFrom(this.c, a.fake) : '');
    this.bust.hidden = !a; this.panel.hidden = false;
  }

  /** Click or Space: finish the line being typed, or go on to the next one. */
  private next(): void {
    const t = this.talk;
    if (!t || this.choice) return;
    const now = performance.now();
    if (!t.full) { t.full = true; t.fullAt = now; this.text.textContent = t.line.text; t.shown = t.line.text.length; return; }
    if (now - t.fullAt < ENC.inputGuardMs) return;
    this.talk = null;
    if (!this.queue.length) { this.panel.hidden = true; this.bust.hidden = true; }
  }

  private openChoice(e: Ev): void {
    const opts = e.options ?? [], def = Math.min(e.default ?? 0, Math.max(0, opts.length - 1));
    this.defFlag = opts[def]?.flag ?? '';
    this.choice = { opts, def, left: this.scene?.timeout ?? 60 };
    this.cards.replaceChildren(...opts.map((o, i) => h('button', { class: 'st-card', type: 'button', onclick: () => this.pick(i) }, h('span', { class: 'st-num', text: String(i + 1) }), h('span', { text: o.text }))));
    this.panel.hidden = false; this.more.hidden = true;
  }

  private pick(i: number): void {
    const ch = this.choice, o = ch?.opts[i];
    if (!ch || !o) return;
    this.choice = null; this.cards.replaceChildren(); this.timer.textContent = ''; this.defFlag = '';
    if (o.flag) this.c.sim.setStoryFlag(o.flag); // (the marks of the choice, o.marks, are not wired into the game yet)
    if (o.say) this.queue.push({ who: 'chu', text: o.say });
    this.queue.push(...o.reply);
    this.talk = null;
  }

  /** The end of the scene (or a skip: the choice not made is taken by default). */
  private finish(): void {
    if (this.done) return;
    this.done = true;
    if (this.defFlag) this.c.sim.setStoryFlag(this.defFlag);
    this.root.hidden = true; this.scene = null; this.talk = null; this.choice = null; this.queue = []; this.panel.hidden = true; this.bust.hidden = true;
  }

  // ---------------------------------------------------------------- the picture
  private camNow(s: Shot): V3 {
    const c = s.cam;
    if (!Array.isArray(c)) { const u = Math.min(1, this.camT / (s.camDur ?? s.dur)), e = s.ease === 'linear' ? u : ease(u); return [lerp(c.from[0], c.to[0], e), lerp(c.from[1], c.to[1], e), lerp(c.from[2], c.to[2], e)]; }
    return c;
  }

  private draw(): void {
    const s = this.shot();
    if (!s) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1), W = Math.max(2, Math.round(this.root.clientWidth * dpr)), H = Math.max(2, Math.round(this.root.clientHeight * dpr));
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    const g = this.canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = false;
    const cam = this.camNow(s);
    if (s.stage === 'insert_book') paintBook(g, W, H, this.stT);
    else if (s.stage === 'river_far') paintRiver(g, W, H, cam[0], this.stT);
    else this.drawHall(g, W, H, cam);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (s.stage === 'hall') { const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,6,2,.5)'); g.fillStyle = v; g.fillRect(0, 0, W, H); }
    if (this.fade.a > 0.001) { g.fillStyle = `rgba(0,0,0,${this.fade.a})`; g.fillRect(0, 0, W, H); }
  }

  private drawHall(g: CanvasRenderingContext2D, W: number, H: number, cam: V3): void {
    const [cx, cy, z] = cam, k = H / (700 / z);
    const at = (p: number): void => g.setTransform(k, 0, 0, k, W / 2 - (SW / 2 + (cx - SW / 2) * p) * k, H / 2 - cy * k);
    if (this.blur > 0.5) { // the far layers out of focus: painted small and stretched back (cheap, and soft by itself)
      const w = Math.max(2, W >> 2), hh = Math.max(2, H >> 2);
      if (this.small.width !== w || this.small.height !== hh) { this.small.width = w; this.small.height = hh; }
      const o = this.small.getContext('2d')!; o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, w, hh);
      this.back(o, w, hh, cam);
      g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(this.small, 0, 0, W, H); g.imageSmoothingEnabled = false;
    } else this.back(g, W, H, cam);
    at(1); paintFloor(g); paintChairs(g, 1000);
    const list = [...this.actors.values()].filter((a) => !a.hidden).sort((p, q) => p.y - q.y), table = TABLE.bottom - 20;
    for (const a of list) if (a.y <= table) this.drawActor(g, a, ACTOR_H);
    paintTable(g);
    for (const a of list) if (a.y > table) this.drawActor(g, a, ACTOR_H);
    for (const px of [470, 1560]) { at(1.4); paintPillar(g, px); }
  }

  private small = document.createElement('canvas');

  /** The layers behind the people: the sky, the courtyard (L0), the porters (L4), the wall (L1). Drawn at any size (`W`, `H`) so the out-of-focus shot can paint them small. */
  private back(g: CanvasRenderingContext2D, W: number, H: number, cam: V3): void {
    const [cx, cy, z] = cam, k = H / (700 / z);
    const at = (p: number): void => g.setTransform(k, 0, 0, k, W / 2 - (SW / 2 + (cx - SW / 2) * p) * k, H / 2 - cy * k);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#9dc0d8'); sky.addColorStop(1, '#efe3c0'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    at(0.2); paintCourt(g); this.drawCrowd(g);
    at(1.2); this.drawPorters(g);
    at(0.5); paintWall(g, this.stT);
  }

  private drawCrowd(g: CanvasRenderingContext2D): void { for (const k of this.crowd) this.drawActor(g, k.a, CROWD_H, false); }

  private drawPorters(g: CanvasRenderingContext2D): void {
    const p = this.porters;
    if (!p) return;
    const u = p.t / p.dur;
    for (let i = 0; i < 2; i++) {
      const x = 1900 - 1050 * u + i * 180, a: Actor = { id: 'p', name: '', fake: fakeOf({ sex: 'm', skin: '#000', hair: '#000', hide: '#000', pants: '#000' }, 'peasant_hood_grey'), x, y: 650, face: 'left', pose: 'walk_slow', clock: p.t + i * 0.4, rot: 0, hidden: false };
      this.drawActor(g, a, PORTER_H, false, true);
      const sy = a.y - PORTER_H * 0.78; // the pole on the shoulder, a bucket hanging from each end, all black
      g.strokeStyle = '#000'; g.fillStyle = '#000'; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 95, sy); g.lineTo(x + 95, sy); g.stroke();
      g.lineWidth = 3; for (const bx of [x - 90, x + 90]) { g.beginPath(); g.moveTo(bx, sy); g.lineTo(bx, sy + 55); g.stroke(); g.fillRect(bx - 22, sy + 55, 44, 40); }
    }
  }

  /** One actor with its feet at (x, y), `h` tall; `tint` paints it as a black shape. */
  private drawActor(g: CanvasRenderingContext2D, a: Actor, hgt: number, shadow = true, tint = false): void {
    const def = POSES[a.pose] ?? POSES.idle;
    a.fake.animClock = a.clock; a.fake.speed = 1.5 * (def.rate ?? 1); a.fake.facing = a.face;
    const spr = this.c.sprites.villager(a.fake, def.anim, a.face);
    a.m ??= measure(this.c.sprites.villager(a.fake, 'idle', 'front'));
    const s = hgt / a.m.h, bob = def.bob ? Math.sin(a.clock * def.bob[1] * Math.PI * 2) * def.bob[0] : 0, sign = a.face === 'left' ? -1 : 1;
    if (shadow) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(a.x, a.y + 2, hgt * 0.22, hgt * 0.05, 0, 0, Math.PI * 2); g.fill(); }
    g.save(); g.translate(a.x, a.y + (def.dy ?? 0) + bob); g.rotate(((def.rot ?? 0) * sign * Math.PI) / 180); g.scale(s, s);
    g.drawImage(tint ? this.silhouette(spr) : spr, -spr.width / 2, -a.m.bottom);
    g.restore();
  }

  private silhouettes = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
  private silhouette(spr: HTMLCanvasElement): HTMLCanvasElement {
    let out = this.silhouettes.get(spr);
    if (!out) { out = document.createElement('canvas'); out.width = spr.width; out.height = spr.height; const o = out.getContext('2d')!; o.drawImage(spr, 0, 0); o.globalCompositeOperation = 'source-in'; o.fillStyle = '#000'; o.fillRect(0, 0, out.width, out.height); this.silhouettes.set(spr, out); }
    return out;
  }
}
