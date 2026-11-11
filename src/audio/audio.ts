import cfg from '../data/sounds.json';
import MUSIC from '../data/musics.gen.json'; // the music lists come from the folders (tools/gen-music.mjs, run by the build)

/** `work`: a long sound that belongs to the action: only one at a time, and cut as soon as that unit stops. */
type AnimCfg = { file: string; /** Several files: one is picked at random (the gap counts for all of them together). */ files?: string[]; /** The frame it plays on; the frame the blow lands (`hit` in anims.json) when left out. */ frame?: number; /** Plays once, when the animation begins, instead of on a frame. */ onStart?: boolean; hitFrame?: number; volume: number; gap: number; work?: boolean };
interface Active { el: HTMLAudioElement; anim: string; file: string; seen: number }
/** Sound of the blow of a weapon. `burst`: for 2 / 3 or more hits landing together (instead of `files`). */
type HitCfg = { files: string[]; burst?: string[]; burstWindow?: number; volume: number; gap: number };
type WeatherLayer = { file: string; volume: number };
/** Weather: `loops` play all the while; each `bursts` entry plays one of its files now and then (every `gapMin` to `gapMax` seconds). */
type WeatherCfg = { loops?: WeatherLayer[]; bursts?: Array<{ files: string[]; volume: number; gapMin: number; gapMax: number }> };
/** Most one-shot sounds at once (each is an audio element: hundreds of them at a battle would choke the page). */
const MAX_LIVE = 14;
type Kind = 'sfx' | 'amb' | 'mus' | 'voice';
/** The tracks of a kind not yet played in this round: a track is taken out when it plays, and the round starts over with the whole list when none is left (a new round does not open with the track that closed the last). */
const BAGS = new Map<string, string[]>(), LAST = new Map<string, string>();
function bagPick(name: string, all: readonly string[]): string {
  let left = BAGS.get(name), fresh = false;
  if (!left || !left.length) { left = [...all]; BAGS.set(name, left); fresh = true; }
  const last = LAST.get(name), from = fresh && left.length > 1 ? left.filter((f) => f !== last) : left; // a new round does not open with the track that closed the last one
  const f = from[Math.floor(Math.random() * from.length)];
  left.splice(left.indexOf(f), 1);
  LAST.set(name, f);
  return f;
}
/** One of the files, by rounds like the music: a file that has played is out until all of the list have played (see `bagPick`). */
const pick = (a: readonly string[]): string => bagPick(a.join('|'), a);
const HITS = cfg.hits as Record<string, HitCfg>;
/** sounds.json `anims`: a key may name several animations joined by `|`, which then share the entry. */
const ANIMS: Record<string, AnimCfg | AnimCfg[]> = {};
for (const [k, v] of Object.entries(cfg.anims as unknown as Record<string, AnimCfg | AnimCfg[]>)) for (const a of k.split('|')) ANIMS[a] = v;
const WEATHER = cfg.weather as Record<string, WeatherCfg>;
const NEAR = cfg.near as Record<string, WeatherLayer>;

/**
 * Game sound. Plain HTMLAudioElement (not Web Audio fetch), so the page also works opened from disk (file://).
 * Browsers only allow sound after a click/key, so nothing plays until the first user gesture.
 */
export class GameAudio {
  /** Volume of each kind, 0 to 1 (the player's slider). */
  vol: Record<Kind, number> = { sfx: 1, amb: 1, mus: 1, voice: 1 };
  /** The volume of a kind of sound now: 0 when it is switched off. */
  private gain(k: Kind): number { return (k === 'sfx' ? this.sfxOn : k === 'amb' ? this.ambientOn : k === 'voice' ? this.voiceOn : this.musicOn) ? this.vol[k] : 0; }
  /** Work and fight sounds. */
  sfxOn = true;
  /** Weather sounds. */
  ambientOn = true;
  /** War music. */
  musicOn = true;
  /** The voices of people: the shouts that answer an order, the cheering of a victory. */
  voiceOn = true;
  private warScreen = false;
  private stingsDone = 0;
  private warAge = 99;
  /** The war track of this war (one of `war.music.files`, picked when it starts). */
  private warTrack: string | null = null;
  /** What stands near the middle of the screen this frame (`near` in sounds.json): the renderer says it, `update` plays it. */
  private victory: { left: string[]; cur: HTMLAudioElement | null; started: HTMLAudioElement[] } | null = null;
  private nearNow = new Set<string>();
  /** Real time (ms) before which nothing plays: just after the player is back from another tab, what happened meanwhile is not heard. */
  private quietUntil = 0;
  private birdWait = 20;
  private readonly burstAt = new Map<string, number>();
  private peaceEl: HTMLAudioElement | null = null;
  /** The music of a lost war while it plays: the peace music keeps quiet until it is over (setPeace). */
  private lostEl: HTMLAudioElement | null = null;
  /** An event (a raid, a pack of beasts) is on at the village: the war music plays, whether or not the fight is on screen, and the peace music keeps quiet. Set every frame by main. */
  fightOn = false;
  private peaceVol = 0;
  /** Seconds until the peace music may start (counted down while it is quiet). */
  private peaceWait = cfg.peace.firstDelay;
  private nightOn = false;
  /** Game times (seconds) at which a wolf still howls tonight. */
  private howls: number[] = [];
  private unlocked = false;
  private readonly cache = new Map<string, HTMLAudioElement>();
  private readonly lastPlay = new Map<string, number>();
  /** One-shot sounds playing now. */
  private readonly live = new Set<HTMLAudioElement>();
  /** Hits of a weapon with `burst` sounds, gathered for a moment: (start time, how many) — see `hit` and `sweep`. */
  private readonly pending = new Map<string, { t0: number; n: number }>();
  private readonly steps = new WeakMap<object, number>();
  /** The sound key each unit was last watched with, to tell when one begins. */
  private readonly started = new WeakMap<object, string>();
  private readonly active = new Map<object, Active>();
  private readonly beds = new Map<string, { el: HTMLAudioElement; vol: number }>();

  constructor() {
    const unlock = (): void => { this.unlocked = true; removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    for (const [t, ev] of [[document, 'visibilitychange'], [window, 'blur'], [window, 'focus'], [window, 'pagehide']] as const) t.addEventListener(ev, () => this.onVisibility());
  }

  /** The game tab is hidden or its window lost focus (another tab or window: nothing would stop the sounds): everything is paused and nothing starts until the player is back. */
  private hidden = false;
  private onVisibility(): void {
    this.hidden = document.hidden || !document.hasFocus();
    if (!this.hidden) { this.quietUntil = performance.now() + 800; this.warAge = 0; return; } // the beds start again in `update`
    for (const b of this.beds.values()) { b.el.pause(); b.vol = 0; }
    for (const k of [...this.active.keys()]) this.stop(k);
    this.pending.clear();
    this.victory = null; this.lostEl = null;
    this.stopPeace();
    this.warScreen = false;
  }

  private el(file: string): HTMLAudioElement {
    let a = this.cache.get(file);
    if (!a) { a = new Audio(cfg.dir + file); a.preload = 'auto'; this.cache.set(file, a); }
    return a;
  }

  private play(file: string, volume: number, gap: number, now: number, single: boolean, kind: Kind = 'sfx', group = file): HTMLAudioElement | null {
    if (!this.unlocked || !this.gain(kind) || this.hidden || performance.now() < this.quietUntil) return null;
    if (now - (this.lastPlay.get(group) ?? -1e9) < gap) return null;
    if (single) for (const a of this.active.values()) if (a.file === group && !a.el.ended) return null; // `file` of an entry is its group
    if (this.live.size >= MAX_LIVE) return null; // a battle of hundreds asks for far more sounds than anyone hears: the extra ones are dropped
    this.lastPlay.set(group, now);
    const a = this.el(file).cloneNode() as HTMLAudioElement;
    a.volume = Math.min(1, volume * cfg.master * this.gain(kind));
    this.live.add(a);
    const done = (): void => { this.live.delete(a); a.removeEventListener('ended', done); a.removeEventListener('error', done); };
    a.addEventListener('ended', done); a.addEventListener('error', done);
    a.play().catch(() => { this.live.delete(a); /* not allowed yet / file missing */ });
    return a;
  }

  private stop(key: object): void {
    const a = this.active.get(key);
    if (a) { a.el.pause(); this.live.delete(a.el); this.active.delete(key); }
  }

  /** Call every frame for each unit near the middle of the screen: plays the sound on the animation's hit frame. */
  watchAnim(key: object, anim: string, clock: number, framesOf: (a: string) => { fps: number; n: number; hit: number } | undefined, now: number, sound = anim): void {
    const cur = this.active.get(key);
    if (cur) { if (cur.anim !== sound) this.stop(key); else cur.seen = now; } // he stopped or changed what he does: his sound stops with it
    const begun = this.started.get(key) !== sound;
    this.started.set(key, sound);
    const def = ANIMS[sound], clip = def && framesOf(anim);
    if (!def || !clip) return;
    if (begun) for (const c of Array.isArray(def) ? def : [def]) if (c.onStart) this.play(c.files ? pick(c.files) : c.file, c.volume, c.gap, now, false, 'sfx', c.files ? c.files[0] : c.file); // it has just begun (a charge: the horse neighs)
    const step = Math.floor(clock * clip.fps), last = this.steps.get(key);
    this.steps.set(key, step);
    if (last === undefined || step === last) return;
    for (const c of Array.isArray(def) ? def : [def]) {
      if (c.onStart || step % clip.n !== (c.frame ?? c.hitFrame ?? clip.hit)) continue;
      const file = c.files ? pick(c.files) : c.file;
      const el = this.play(file, c.volume, c.gap, now, !!c.work, 'sfx', c.files ? c.files[0] : c.file);
      if (el && c.work) this.active.set(key, { el, anim: sound, file: c.files ? c.files[0] : c.file, seen: now });
    }
  }

  /**
   * A blow landed near the middle of the screen. The sound belongs to the weapon (`hits` in sounds.json, by weapon id), whoever holds it:
   * a weapon without its own entry sounds as `melee` if it is hand to hand, and makes no sound if it is thrown or shot (sling...).
   */
  hit(weapon: string, ranged: boolean, now: number): void {
    const key = HITS[weapon] ? weapon : ranged ? '' : 'melee', c = key ? HITS[key] : null;
    if (!c || this.hidden || performance.now() < this.quietUntil) return;
    if (c.burst) { // arrows that land together are one sound: they are counted for `burstWindow` seconds, then played by `sweep`
      const p = this.pending.get(key);
      if (p) p.n++; else this.pending.set(key, { t0: now, n: 1 });
      return;
    }
    this.playHit(key, c, 1, now);
  }

  private playHit(key: string, c: HitCfg, n: number, now: number): void {
    if (now - (this.lastPlay.get('hit:' + key) ?? -1e9) < c.gap) return;
    const file = c.burst && n >= 2 ? c.burst[Math.min(n, c.burst.length + 1) - 2] : pick(c.files);
    if (this.play(file, c.volume, 0, now, false)) this.lastPlay.set('hit:' + key, now);
  }

  /** Once per drawn frame: sounds of units that were not watched lately (off the middle of the screen, gone, dead) are cut. */
  sweep(now: number): void {
    for (const [key, p] of this.pending) if (now - p.t0 >= (HITS[key].burstWindow ?? 0.12)) { this.pending.delete(key); this.playHit(key, HITS[key], p.n, now); }
    for (const [key, a] of this.active) if (now - a.seen > 0.3 || !this.sfxOn) this.stop(key);
  }

  /**
   * The war music. `onScreen`: a war is on (the music does not depend on the camera).
   * `seen`: our soldiers have seen the enemy: the "battle breaks out" sting plays each time it turns on, wherever the camera is, over the music.
   */
  setWar(onScreen: boolean, stings: number, now: number): void {
    this.warAge = 0;
    this.warScreen = onScreen;
    if (stings < this.stingsDone) this.stingsDone = 0; // a new war
    for (let i = 0; i < Math.min(4, stings - this.stingsDone); i++) this.play(cfg.war.start.file, cfg.war.start.volume, 0, now, false, 'voice', `sting${i}`); // they may sound over each other
    this.stingsDone = stings;
  }

  /** A warning from the game: wolves come (a howl, always heard, wherever the camera is) or a village raids us (the battle sting, once). */
  alert(kind: 'wolf' | 'raid' | 'beast' | 'clear' | 'notice' | 'era' | 'mount'): void {
    const now = performance.now() / 1000;
    if (kind === 'notice') return; // only a toast
    if (kind === 'raid' || kind === 'beast') this.play(cfg.war.start.file, cfg.war.start.volume, 0, now, false, 'voice', 'raidalert'); // an event begins (a raid, a pack of beasts): the battle sting
    else if (kind === 'mount') this.neigh(); // a horse is tamed: it neighs
    else if (kind === 'era') this.play(cfg.end.won.files[1] ?? cfg.end.won.files[0], cfg.end.won.volume, 0, now, false, 'voice', 'eraup'); // a new age: a victory sound
    else if (kind === 'clear') this.play(cfg.end.won.files[0], cfg.end.won.volume, 0, now, false, 'voice', 'eventover'); // it is over: one victory sound
    else { const w = cfg.wolves; this.play(pick(w.files), w.volume, 0, now, false, 'amb', 'wolfalert'); }
  }

  /** A horse neighs (`neigh` in sounds.json): when a troop with riders is ordered, when a charge begins (see `onStart`), when a horse is tamed. */
  neigh(): void {
    const n = cfg.neigh;
    this.play(pick(n.files), n.volume, n.gap, performance.now() / 1000, false, 'sfx', 'neigh');
  }

  /** The player gave an order to a troop (a button, or a click with several chosen): one of the order sounds. */
  order(): void {
    const o = cfg.order;
    this.play(pick(o.files), o.volume, o.gap, performance.now() / 1000, false, 'voice', 'order');
  }

  /**
   * The war is decided. Lost: its own music, once. Won: the four victory sounds, in a random order, in two rounds of two: the second of a pair starts when the first is
   * `next` (30%) played, so they sound over each other, and the next pair when both are over.
   */
  warEnded(result: 'won' | 'lost', now: number): void {
    if (result === 'lost') { this.lostEl = this.play(cfg.end.lost.file, cfg.end.lost.volume, 0, now, false, 'mus', 'lost'); return; }
    const files = [...cfg.end.won.files];
    for (let i = files.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [files[i], files[j]] = [files[j], files[i]]; }
    this.victory = { left: files, cur: null, started: [] };
  }

  /** The player pulled the army out: the cheering stops (what plays now is cut, what is still to come does not start). */
  stopVictory(): void {
    const v = this.victory;
    if (!v) return;
    for (const e of v.started) { e.pause(); this.live.delete(e); }
    this.victory = null;
  }

  private tickVictory(): void {
    const v = this.victory;
    if (!v) return;
    const c = v.cur, begun = 4 - v.left.length;
    if (begun % 2 === 1) { if (c && !c.ended && !(c.duration > 0 && c.currentTime / c.duration >= cfg.end.won.next)) return; } // the second of a pair: when the first is 30% played
    else if (begun > 0 && v.started.some((e) => !e.ended)) return; // the next pair: when both of the one before are over
    if (!v.left.length) { this.victory = null; return; }
    const file = v.left.shift()!;
    const el = this.play(file, cfg.end.won.volume, 0, performance.now() / 1000, false, 'voice', file);
    if (!el) { this.victory = null; return; } // refused (muted, another tab): that is the end of it
    v.cur = el; v.started.push(el);
  }

  /** A flash of lightning: the thunder follows a moment later (the farther, the later), a random one of the clips. */
  thunder(): void {
    const t = cfg.thunder;
    setTimeout(() => this.play(pick(t.files), t.volume, 0, performance.now() / 1000, false, 'amb'), (t.delayMin + Math.random() * (t.delayMax - t.delayMin)) * 1000);
  }

  /** Something that sounds as long as it is near the middle of the screen (a key of `near`): call every frame it is there. */
  near(name: string): void { this.nearNow.add(name); }

  /** Birds now and then, by day, in fair weather and not in winter (`ok`): one of the clips, never a loop. Call every frame. */
  setBirds(ok: boolean, dt: number, now: number): void {
    if (!ok) { this.birdWait = Math.max(this.birdWait, 10); return; }
    this.birdWait -= dt;
    if (this.birdWait > 0) return;
    const b = cfg.birds;
    this.birdWait = b.gapMin + Math.random() * (b.gapMax - b.gapMin);
    this.play(pick(b.files), b.volume, 0, now, false, 'amb');
  }

  /**
   * The quiet-times music: once at the start of the game, then now and then (a random wait of `gapMin` to `gapMax` seconds after it has ended),
   * never in a loop. It fades out when peace ends (a war, a raid). `peaceful`: nothing hostile is going on. Call every frame.
   */
  setPeace(peaceful: boolean, dt: number): void {
    const lost = this.lostEl; // the music of a lost war is playing: the peace music fades out and does not start until it has ended, and then not at once
    if (lost) { if (lost.ended || lost.error || lost.paused) { this.lostEl = null; this.peaceWait = Math.max(this.peaceWait, 20); } else peaceful = false; }
    if (!this.musicOn || this.hidden || !this.unlocked) { this.stopPeace(); return; }
    const el = this.peaceEl;
    if (el) {
      if (el.ended) { this.peaceEl = null; this.peaceWait = cfg.peace.gapMin + Math.random() * (cfg.peace.gapMax - cfg.peace.gapMin); return; }
      this.peaceVol = Math.max(0, Math.min(cfg.peace.volume * cfg.master * this.vol.mus, this.peaceVol + (peaceful ? 1 : -1) * dt / cfg.fade * cfg.peace.volume));
      el.volume = this.peaceVol;
      if (!peaceful && this.peaceVol <= 0.001) this.stopPeace();
      return;
    }
    if (!peaceful) return;
    this.peaceWait -= dt;
    if (this.peaceWait > 0) return;
    const a = new Audio(cfg.dir + bagPick('peace', MUSIC.peace)); a.volume = 0; this.peaceVol = 0;
    this.peaceEl = a;
    a.play().catch(() => { if (this.peaceEl === a) this.peaceEl = null; this.peaceWait = 5; }); // not allowed yet: try again soon
  }

  private stopPeace(): void {
    if (!this.peaceEl) return;
    this.peaceEl.pause(); this.peaceEl = null;
    this.peaceWait = cfg.peace.gapMin * 0.5 + Math.random() * cfg.peace.gapMin * 0.5; // it was cut short: not again right away
  }

  /**
   * Wolves at night: when the night begins, 1 to `maxHowls` howls are set for random moments of its first part, at least `spacing` of a day apart
   * (game time, so the speed of the game does not matter), each one a random clip. Never more, never in a row.
   */
  setNight(night: boolean, time: number, dayLen: number): void {
    const w = cfg.wolves;
    if (night && !this.nightOn) {
      const n = 1 + Math.floor(Math.random() * w.maxHowls), at: number[] = [];
      for (let tries = 0; at.length < n && tries < 40; tries++) {
        const t = time + (w.from + Math.random() * (w.to - w.from)) * dayLen;
        if (at.every((x) => Math.abs(x - t) >= w.spacing * dayLen)) at.push(t);
      }
      this.howls = at.sort((a, b) => a - b);
    } else if (!night) this.howls = [];
    this.nightOn = night;
    while (this.howls.length && time >= this.howls[0]) {
      const late = time - this.howls.shift()! > 5; // the game was away (a tab, a skip): that howl is lost, not played all at once
      if (!late) this.play(pick(w.files), w.volume, 0, time, false, 'amb');
    }
  }

  /** Looping layers (weather, war music), each fading in and out. Call every frame. */
  update(kind: string, dt: number): void {
    this.warAge += dt;
    this.tickVictory();
    if (this.hidden) return; // another tab: silent (see `onVisibility`)
    if (this.warAge > 0.5) { this.warScreen = false; if (!this.fightOn) this.warTrack = null; this.stingsDone = 0; } // the renderer stopped reporting: no soldiers in view (the sting is re-armed only by the sim saying the fight died down)
    const w = WEATHER[kind], want = new Map<string, number>();
    if (this.ambientOn && w) {
      for (const l of w.loops ?? []) want.set(l.file, l.volume * cfg.master * this.vol.amb);
      (w.bursts ?? []).forEach((bu, i) => { // thunder, wind: now and then
        const key = kind + i, at = this.burstAt.get(key);
        if (at === undefined) this.burstAt.set(key, bu.gapMin + Math.random() * (bu.gapMax - bu.gapMin));
        else if (at <= 0) { this.burstAt.set(key, bu.gapMin + Math.random() * (bu.gapMax - bu.gapMin)); this.play(pick(bu.files), bu.volume, 0, performance.now() / 1000, false, 'amb'); }
        else this.burstAt.set(key, at - dt);
      });
    }
    if (this.sfxOn) for (const n of this.nearNow) { const l = NEAR[n]; if (l && this.vol.sfx > 0) want.set(l.file, l.volume * cfg.master * this.vol.sfx); }
    this.nearNow.clear();
    if (this.musicOn && (this.warScreen || this.fightOn)) { // the war music plays all through the war; the sting (enemy seen) plays over it
      this.warTrack ??= bagPick('war', MUSIC.war);
      want.set(this.warTrack, cfg.war.music.volume * cfg.master * this.vol.mus);
    }
    for (const file of want.keys()) if (!this.beds.has(file)) {
      const el = new Audio(cfg.dir + file); el.loop = true; el.volume = 0;
      this.beds.set(file, { el, vol: 0 });
    }
    for (const [file, b] of this.beds) {
      const target = want.get(file) ?? 0, step = dt / cfg.fade * 0.6;
      b.vol += Math.sign(target - b.vol) * Math.min(Math.abs(target - b.vol), step);
      b.el.volume = !this.unlocked ? 0 : Math.max(0, Math.min(1, b.vol));
      if (b.vol > 0.005) { if (this.unlocked && b.el.paused) b.el.play().catch(() => { /* wait for gesture */ }); }
      else if (!want.has(file) && !b.el.paused) b.el.pause();
    }
  }
}
