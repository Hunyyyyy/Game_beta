import cfg from '../data/sounds.json';

/** `work`: a long sound that belongs to the action: only one at a time, and cut as soon as that unit stops. */
type AnimCfg = { file: string; /** Several files: one is picked at random (the gap counts for all of them together). */ files?: string[]; /** The frame it plays on; the frame the blow lands (`hit` in anims.json) when left out. */ frame?: number; hitFrame?: number; volume: number; gap: number; work?: boolean };
interface Active { el: HTMLAudioElement; anim: string; file: string; seen: number }
/** Sound of the blow of a weapon. `burst`: for 2 / 3 or more hits landing together (instead of `files`). */
type HitCfg = { files: string[]; burst?: string[]; burstWindow?: number; volume: number; gap: number };
type WeatherLayer = { file: string; volume: number };
const HITS = cfg.hits as Record<string, HitCfg>;
/** sounds.json `anims`: a key may name several animations joined by `|`, which then share the entry. */
const ANIMS: Record<string, AnimCfg | AnimCfg[]> = {};
for (const [k, v] of Object.entries(cfg.anims as unknown as Record<string, AnimCfg | AnimCfg[]>)) for (const a of k.split('|')) ANIMS[a] = v;
const WEATHER = cfg.weather as Record<string, WeatherLayer[]>;

/**
 * Game sound. Plain HTMLAudioElement (not Web Audio fetch), so the page also works opened from disk (file://).
 * Browsers only allow sound after a click/key, so nothing plays until the first user gesture.
 */
export class GameAudio {
  /** Work and fight sounds. */
  sfxOn = true;
  /** Weather sounds. */
  ambientOn = true;
  /** War music. */
  musicOn = true;
  private warScreen = false;
  private warSeen = false;
  private stingDone = false;
  private warAge = 99;
  private peaceEl: HTMLAudioElement | null = null;
  private peaceVol = 0;
  /** Seconds until the peace music may start (counted down while it is quiet). */
  private peaceWait = cfg.peace.firstDelay;
  private nightOn = false;
  /** Game times (seconds) at which a wolf still howls tonight. */
  private howls: number[] = [];
  private unlocked = false;
  private readonly cache = new Map<string, HTMLAudioElement>();
  private readonly lastPlay = new Map<string, number>();
  /** Hits of a weapon with `burst` sounds, gathered for a moment: (start time, how many) — see `hit` and `sweep`. */
  private readonly pending = new Map<string, { t0: number; n: number }>();
  private readonly steps = new WeakMap<object, number>();
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
    if (!this.hidden) return; // the beds start again in `update`
    for (const b of this.beds.values()) { b.el.pause(); b.vol = 0; }
    for (const k of [...this.active.keys()]) this.stop(k);
    this.pending.clear();
    this.stopPeace();
    this.warScreen = false;
  }

  private el(file: string): HTMLAudioElement {
    let a = this.cache.get(file);
    if (!a) { a = new Audio(cfg.dir + file); a.preload = 'auto'; this.cache.set(file, a); }
    return a;
  }

  private play(file: string, volume: number, gap: number, now: number, single: boolean, on = this.sfxOn, group = file): HTMLAudioElement | null {
    if (!this.unlocked || !on || this.hidden) return null;
    if (now - (this.lastPlay.get(group) ?? -1e9) < gap) return null;
    if (single) for (const a of this.active.values()) if (a.file === group && !a.el.ended) return null; // `file` of an entry is its group
    this.lastPlay.set(group, now);
    const a = this.el(file).cloneNode() as HTMLAudioElement;
    a.volume = Math.min(1, volume * cfg.master);
    a.play().catch(() => { /* not allowed yet / file missing */ });
    return a;
  }

  private stop(key: object): void {
    const a = this.active.get(key);
    if (a) { a.el.pause(); this.active.delete(key); }
  }

  /** Call every frame for each unit near the middle of the screen: plays the sound on the animation's hit frame. */
  watchAnim(key: object, anim: string, clock: number, framesOf: (a: string) => { fps: number; n: number; hit: number } | undefined, now: number): void {
    const cur = this.active.get(key);
    if (cur) { if (cur.anim !== anim) this.stop(key); else cur.seen = now; } // he stopped or changed what he does: his sound stops with it
    const def = ANIMS[anim], clip = def && framesOf(anim);
    if (!def || !clip) return;
    const step = Math.floor(clock * clip.fps), last = this.steps.get(key);
    this.steps.set(key, step);
    if (last === undefined || step === last) return;
    for (const c of Array.isArray(def) ? def : [def]) {
      if (step % clip.n !== (c.frame ?? c.hitFrame ?? clip.hit)) continue;
      const file = c.files ? c.files[Math.floor(Math.random() * c.files.length)] : c.file;
      const el = this.play(file, c.volume, c.gap, now, !!c.work, this.sfxOn, c.files ? c.files[0] : c.file);
      if (el && c.work) this.active.set(key, { el, anim, file: c.files ? c.files[0] : c.file, seen: now });
    }
  }

  /**
   * A blow landed near the middle of the screen. The sound belongs to the weapon (`hits` in sounds.json, by weapon id), whoever holds it:
   * a weapon without its own entry sounds as `melee` if it is hand to hand, and makes no sound if it is thrown or shot (sling...).
   */
  hit(weapon: string, ranged: boolean, now: number): void {
    const key = HITS[weapon] ? weapon : ranged ? '' : 'melee', c = key ? HITS[key] : null;
    if (!c) return;
    if (c.burst) { // arrows that land together are one sound: they are counted for `burstWindow` seconds, then played by `sweep`
      const p = this.pending.get(key);
      if (p) p.n++; else this.pending.set(key, { t0: now, n: 1 });
      return;
    }
    this.playHit(key, c, 1, now);
  }

  private playHit(key: string, c: HitCfg, n: number, now: number): void {
    if (now - (this.lastPlay.get('hit:' + key) ?? -1e9) < c.gap) return;
    const file = c.burst && n >= 2 ? c.burst[Math.min(n, c.burst.length + 1) - 2] : c.files[Math.floor(Math.random() * c.files.length)];
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
  setWar(onScreen: boolean, seen: boolean, now: number): void {
    this.warAge = 0;
    this.warScreen = onScreen; this.warSeen = seen;
    if (seen && !this.stingDone) { this.stingDone = true; this.play(cfg.war.start.file, cfg.war.start.volume, 0, now, false, this.musicOn); }
    else if (!seen) this.stingDone = false; // the war is over: the next one gets its sting
  }

  /**
   * The quiet-times music: once at the start of the game, then now and then (a random wait of `gapMin` to `gapMax` seconds after it has ended),
   * never in a loop. It fades out when peace ends (a war, a raid). `peaceful`: nothing hostile is going on. Call every frame.
   */
  setPeace(peaceful: boolean, dt: number): void {
    if (!this.musicOn || this.hidden || !this.unlocked) { this.stopPeace(); return; }
    const el = this.peaceEl;
    if (el) {
      if (el.ended) { this.peaceEl = null; this.peaceWait = cfg.peace.gapMin + Math.random() * (cfg.peace.gapMax - cfg.peace.gapMin); return; }
      this.peaceVol = Math.max(0, Math.min(cfg.peace.volume * cfg.master, this.peaceVol + (peaceful ? 1 : -1) * dt / cfg.fade * cfg.peace.volume));
      el.volume = this.peaceVol;
      if (!peaceful && this.peaceVol <= 0.001) this.stopPeace();
      return;
    }
    if (!peaceful) return;
    this.peaceWait -= dt;
    if (this.peaceWait > 0) return;
    const a = new Audio(cfg.dir + cfg.peace.file); a.volume = 0; this.peaceVol = 0;
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
      if (!late) this.play(w.files[Math.floor(Math.random() * w.files.length)], w.volume, 0, time, false, this.ambientOn);
    }
  }

  /** Looping layers (weather, war music), each fading in and out. Call every frame. */
  update(kind: string, dt: number): void {
    this.warAge += dt;
    if (this.hidden) return; // another tab: silent (see `onVisibility`)
    if (this.warAge > 0.5) { this.warScreen = false; this.warSeen = false; } // the renderer stopped reporting: no soldiers in view (the sting is re-armed only by the sim saying the fight died down)
    const want = new Map((this.ambientOn ? WEATHER[kind] ?? [] : [])
      .map((l) => [l.file, l.volume * cfg.master] as const));
    if (this.musicOn) {
      // the war music plays all through the war; the sting (enemy seen) plays over it
      const w = this.warScreen ? cfg.war.music : null;
      if (w) want.set(w.file, w.volume * cfg.master);
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
