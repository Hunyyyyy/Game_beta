"use strict";

// src/save/session.ts
var AUTO_SAVE = "auto";
var Session = class {
  constructor(sim, store) {
    this.sim = sim;
    this.store = store;
    this.busy = false;
    /** Called with a message when a save fails, so the player is told once. */
    this.onError = () => {
    };
    this.lastDay = sim.day;
  }
  /** Call every frame (or often): saves when a new day has begun. */
  tick() {
    if (this.sim.day === this.lastDay) return;
    this.lastDay = this.sim.day;
    void this.save();
  }
  /** Save now. Two saves never overlap: one asked for while another is running is skipped. */
  async save(id = AUTO_SAVE) {
    if (this.busy) return false;
    this.busy = true;
    try {
      const sim = this.sim;
      await this.store.save(id, sim.toSave(), { savedAt: Date.now(), day: sim.day, population: sim.villagers.length });
      return true;
    } catch (e) {
      this.onError(`Kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      this.busy = false;
    }
  }
  /** The newest save, if any. */
  async latest() {
    try {
      return (await this.store.list())[0] ?? null;
    } catch {
      return null;
    }
  }
  /** Put a save into this game. Returns false when there is none; the save must be of this world. */
  async resume(id) {
    const data = await this.store.load(id);
    if (!data) return false;
    this.sim.loadSave(data);
    this.lastDay = this.sim.day;
    return true;
  }
  async forget(id = AUTO_SAVE) {
    await this.store.remove(id);
  }
};

// src/save/settings.ts
var DEFAULT_SETTINGS = { speed: 1, skipRotatePrompt: false };
var KEY = "lang-do-da.settings";
function loadSettings(storage = browserStorage()) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const o = JSON.parse(raw);
    return {
      speed: [1, 2, 4].includes(o.speed) ? o.speed : DEFAULT_SETTINGS.speed,
      skipRotatePrompt: o.skipRotatePrompt === true
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
function saveSettings(settings, storage = browserStorage()) {
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
  }
}
function browserStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

// src/save/store.ts
var MemoryStore = class {
  constructor() {
    this.saves = /* @__PURE__ */ new Map();
  }
  async list() {
    return [...this.saves.values()].map((s) => s.meta).sort((a, b) => b.savedAt - a.savedAt);
  }
  async load(id) {
    const s = this.saves.get(id);
    return s ? JSON.parse(s.json) : null;
  }
  async save(id, data, meta) {
    this.saves.set(id, { meta: { ...meta, id, version: data.version, seed: data.seed }, json: JSON.stringify(data) });
  }
  async remove(id) {
    this.saves.delete(id);
  }
};

// src/sim/constants.ts
var MAP_SIZE = 192;
var VISION = 7;
var NIGHT_VISION = 3;
var FIRE_VISION = 8;
var TICK = 1 / 20;
var DAY_LENGTH = 1200;
var START_TIME = DAY_LENGTH * 0.25;
var gameDays = (secs) => {
  const d = secs / DAY_LENGTH;
  return `${d.toLocaleString("vi", { maximumFractionDigits: d < 1 ? 2 : d < 10 ? 1 : 0 })} ng\xE0y`;
};
var WORK_DAY = 240;
var PACE = { work: WORK_DAY / DAY_LENGTH };

// src/data/seasons.json
var seasons_default = {
  spring: { name: "Xu\xE2n", daylight: 0.6, work: 1, gather: 0.8, enter: "M\xF9a xu\xE2n \u0111\u1EBFn: b\u1EE5i c\xE2y ra hoa, v\xE0i h\xF4m n\u1EEFa s\u1EBD c\xF3 qu\u1EA3. Hay m\u01B0a." },
  summer: { name: "H\u1EA1", daylight: 0.6, work: 1.05, gather: 1.2, enter: "M\xF9a h\u1EA1: ng\xE0y d\xE0i h\u01A1n, qu\u1EA3 ch\xEDn nhi\u1EC1u. Coi ch\u1EEBng gi\xF4ng s\xE9t." },
  autumn: { name: "Thu", daylight: 0.6, work: 1, gather: 1.4, enter: "M\xF9a thu: qu\u1EA3 nhi\u1EC1u nh\u1EA5t n\u0103m. M\xF9a \u0111\xF4ng s\u1EAFp t\u1EDBi, h\xE3y chu\u1EA9n b\u1ECB." },
  winter: { name: "\u0110\xF4ng", daylight: 0.6, work: 0.8, gather: 0, enter: "M\xF9a \u0111\xF4ng: b\u1EE5i qu\u1EA3 tr\u1EE5i h\u1EBFt, ng\xE0y ng\u1EAFn l\u1EA1i. S\u1ED1ng b\u1EB1ng th\u1EE9c \u0103n \u0111\xE3 t\xEDch tr\u1EEF." }
};

// src/data/weather.json
var weather_default = {
  types: {
    clear: { name: "N\u1EAFng", vision: 0, speed: 1, work: 1, signal: "" },
    mist: { name: "S\u01B0\u01A1ng m\u1ECFng", vision: 2, speed: 1, work: 0.95, signal: "H\u01A1i n\u01B0\u1EDBc b\u1ED1c l\xEAn t\u1EEB \u0111\u1EA5t, s\xE1ng mai c\xF3 l\u1EBD s\u1EBD c\xF3 s\u01B0\u01A1ng." },
    drizzle: { name: "M\u01B0a nh\u1EB9", vision: 0, speed: 0.9, work: 0.85, signal: "M\xE2y x\xE1m k\xE9o t\u1EDBi, c\xF3 l\u1EBD ng\xE0y mai m\u01B0a." },
    rain: { name: "M\u01B0a to", vision: 1, speed: 0.75, work: 0.7, signal: "Tr\u1EDDi t\u1ED1i s\u1EA7m, gi\xF3 \u1EA9m n\u1ED5i l\xEAn: ng\xE0y mai m\u01B0a to." },
    thunder: { name: "Gi\xF4ng s\xE9t", vision: 3, speed: 0.85, work: 0.6, signal: "Kh\xF4ng kh\xED oi n\u1ED3ng, m\xE2y d\u1EF1ng th\xE0nh th\xE1p: s\u1EAFp c\xF3 gi\xF4ng." },
    storm: { name: "B\xE3o", vision: 4, speed: 0.7, work: 0.45, signal: "Gi\xF3 gi\u1EADt m\u1EA1nh, chim bay t\xE1n lo\u1EA1n: b\xE3o \u0111ang t\u1EDBi." },
    snow: { name: "Tuy\u1EBFt", vision: 1, speed: 0.75, work: 0.6, signal: "Gi\xF3 l\u1EA1nh bu\u1ED1t th\u1ED5i v\u1EC1, c\xF3 l\u1EBD s\u1EAFp c\xF3 tuy\u1EBFt." }
  },
  chance: {
    spring: { clear: 0.45, mist: 0.15, drizzle: 0.25, rain: 0.15 },
    summer: { clear: 0.6, rain: 0.15, thunder: 0.15, storm: 0.1 },
    autumn: { clear: 0.45, mist: 0.2, drizzle: 0.2, storm: 0.15 },
    winter: { clear: 0.5, mist: 0.1, snow: 0.4 }
  }
};

// src/sim/calendar.ts
var SEASONS = ["spring", "summer", "autumn", "winter"];
var SEASON_DAYS = 5;
var YEAR_DAYS = SEASON_DAYS * SEASONS.length;
var SEASON_DEF = seasons_default;
var WEATHER = weather_default.types;
var CHANCE = weather_default.chance;
var TWILIGHT = 0.05;
var seasonOf = (day) => SEASONS[Math.floor((day - 1) / SEASON_DAYS) % SEASONS.length];
function sunTimes(season) {
  const d = SEASON_DEF[season].daylight;
  return { rise: 0.5 - d / 2, set: 0.5 + d / 2 };
}
function lightAt(tod, season) {
  const { rise, set } = sunTimes(season);
  if (tod >= rise && tod <= set) return 1;
  if (tod > set) return Math.max(0, 1 - (tod - set) / TWILIGHT);
  return Math.max(0, 1 - (rise - tod) / TWILIGHT);
}
function dayPart(tod, season) {
  const { rise, set } = sunTimes(season);
  if (tod >= rise && tod <= set) return "day";
  if (tod > set && tod < set + TWILIGHT) return "dusk";
  if (tod < rise && tod > rise - TWILIGHT) return "dawn";
  return "night";
}
function isRestTime(tod, season) {
  const { rise, set } = sunTimes(season);
  return tod > set + TWILIGHT / 2 || tod < rise - TWILIGHT / 2;
}
function rollWeather(season, r) {
  const table = CHANCE[season];
  let acc = 0, last = "clear";
  for (const k of Object.keys(table)) {
    acc += table[k] ?? 0;
    last = k;
    if (r < acc) return k;
  }
  return last;
}

// src/sim/buildings.ts
var ERAS = ["stone", "ancient"];
var lv = (name, cost, buildTime, cap = 0, craftSpeed = 1, slots = 0) => ({ name, cost, buildTime, cap, craftSpeed, slots });
var BUILDINGS = {
  // the heart of the village: it starts as a heap of firewood and every other house is held back by its level
  campfire: {
    kind: "campfire",
    name: "Nh\xE0 chung (\u0111\u1ED1ng l\u1EEDa tr\u1EA1i)",
    w: 2,
    h: 2,
    buildable: false,
    upgradable: true,
    levels: { stone: [lv("C\u1EE7i l\u1EEDa", {}, 0, 30), lv("L\u1EEDa tr\u1EA1i", { wood: 20 }, 120, 45), lv("B\u1EBFp l\u1EEDa l\u1EDBn", { wood: 20, stone: 12 }, 240, 60), lv("Nh\xE0 chung", { wood: 50, stone: 30, hide: 10 }, 480, 90)] }
  },
  // builders belong to this house: without it nothing but the house itself can be raised
  builder: {
    kind: "builder",
    name: "Nh\xE0 th\u1EE3 x\xE2y",
    w: 2,
    h: 2,
    buildable: true,
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 10 }, 60, 0, 1, 2), lv("G\u1ED7", { wood: 15, stone: 10 }, 110, 0, 1.25, 3), lv("\u0110\xE1", { wood: 25, stone: 20 }, 160, 0, 1.5, 4)] }
  },
  storage: {
    kind: "storage",
    name: "Kho",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 10 }, 50, 100), lv("G\u1ED7", { wood: 35 }, 90, 250), lv("\u0110\xE1", { wood: 40, stone: 20 }, 140, 500)] }
  },
  workshop: {
    kind: "workshop",
    name: "Nh\xE0 ch\u1EBF t\u1EA1o",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 15 }, 70, 0, 1, 1), lv("G\u1ED7", { wood: 15, stone: 30 }, 120, 0, 1.25, 2), lv("\u0110\xE1", { wood: 30, stone: 50 }, 180, 0, 1.5, 3)] }
  },
  lab: {
    kind: "lab",
    name: "Nh\xE0 nghi\xEAn c\u1EE9u",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["workshop"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 20 }, 80, 0, 1, 1), lv("G\u1ED7", { wood: 20, stone: 30 }, 140, 0, 1.25, 2), lv("\u0110\xE1", { wood: 30, stone: 50 }, 200, 0, 1.5, 4)] }
  },
  repair: {
    kind: "repair",
    name: "Nh\xE0 s\u1EEDa ch\u1EEFa",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["workshop"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 15, stone: 5 }, 70, 0, 1, 1), lv("G\u1ED7", { wood: 15, stone: 30 }, 120, 0, 1.25, 2), lv("\u0110\xE1", { wood: 30, stone: 50 }, 180, 0, 1.5, 3)] }
  },
  toolstore: {
    kind: "toolstore",
    name: "Kho c\xF4ng c\u1EE5",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["workshop"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 25 }, 60, 12), lv("G\u1ED7", { wood: 30, stone: 15 }, 100, 30), lv("\u0110\xE1", { wood: 30, stone: 40 }, 150, 60)] }
  },
  armory: {
    kind: "armory",
    name: "Kho v\u0169 kh\xED",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["workshop"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 25 }, 60, 12), lv("G\u1ED7", { wood: 30, stone: 15 }, 100, 30), lv("\u0110\xE1", { wood: 30, stone: 40 }, 150, 60)] }
  },
  // where soldiers sleep, out of sight, as a list (slots = beds, craftSpeed = how well they rest); without a bed they sleep by the campfire
  barracks: {
    kind: "barracks",
    name: "L\u1EC1u chi\u1EBFn binh",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 20 }, 60, 0, 1, 3), lv("G\u1ED7", { wood: 25, hide: 6 }, 100, 0, 1.1, 5), lv("\u0110\xE1", { wood: 30, stone: 25, hide: 10 }, 150, 0, 1.2, 8)] }
  },
  // where everyone who is not a soldier sleeps, out of sight, as a list; without a bed they sleep by the campfire and rest slower
  house: {
    kind: "house",
    name: "Nh\xE0 d\xE2n",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 20 }, 60, 0, 1, 4), lv("G\u1ED7", { wood: 30, stone: 10 }, 100, 0, 1.15, 8), lv("\u0110\xE1", { wood: 40, stone: 30 }, 150, 0, 1.3, 12)] }
  }
};
function levelsOf(kind, era) {
  const defs = BUILDINGS[kind].levels;
  for (let i = ERAS.indexOf(era); i >= 0; i--) {
    const l = defs[ERAS[i]];
    if (l) return l;
  }
  return defs.stone;
}
var levelDef = (b, level = b.level) => levelsOf(b.kind, b.era)[level - 1];
var maxLevel = (kind, era) => levelsOf(kind, era).length;
var holdsGoods = (b) => b.kind === "storage" || b.kind === "campfire";
var needsWork = (b) => !b.done || b.upgrading;
var POP_BY_FIRE = [8, 16, 25, 40];
var levelCapByFire = (fireLevel) => Math.max(1, fireLevel - 1);

// src/sim/fog.ts
var Fog = class {
  constructor(world) {
    this.world = world;
    this.version = 0;
    this.state = new Uint8Array(world.size * world.size);
  }
  /** Each source has its own sight radius `r` (tiles). */
  update(sources) {
    const N = this.world.size, s = this.state;
    for (let i = 0; i < s.length; i++) if (s[i] === 2) s[i] = 1;
    for (const p of sources) {
      const cx = Math.floor(p.x), cy = Math.floor(p.y), radius = p.r, r2 = radius * radius + 0.5;
      for (let y = Math.max(0, cy - radius); y <= Math.min(N - 1, cy + radius); y++) {
        for (let x = Math.max(0, cx - radius); x <= Math.min(N - 1, cx + radius); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) s[y * N + x] = 2;
        }
      }
    }
    this.version++;
  }
  countExplored() {
    let n = 0;
    for (let i = 0; i < this.state.length; i++) if (this.state[i] > 0) n++;
    return n;
  }
};

// src/sim/resources.ts
var CURRENCY = { stone: "V\u1ECF s\xF2", ancient: "\u0110\u1ED3ng xu" };
var RES_NAME = { wood: "G\u1ED7", stone: "\u0110\xE1", food: "Th\u1EE9c \u0103n", hide: "Da", bone: "X\u01B0\u01A1ng", fat: "M\u1EE1", feather: "L\xF4ng v\u0169", tusk: "Ng\xE0", coin: CURRENCY.stone };
var BARTER = { food: 10, wood: 5, stone: 5, hide: 2, bone: 4, fat: 4, feather: 10, tusk: 1 };
var emptyStock = () => ({ wood: 0, stone: 0, food: 0, hide: 0, bone: 0, fat: 0, feather: 0, tusk: 0, coin: 0 });
var CARRY_CAP = { wood: 4, stone: 4, food: 10, hide: 10, bone: 6, fat: 6, feather: 10, tusk: 2, coin: 0 };
var FOOD_NUTRITION = 20;
var FOOD_SPOIL_DAYS = 3;

// src/sim/rng.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  const next = (() => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  });
  next.getState = () => a;
  next.setState = (state) => {
    a = state >>> 0;
  };
  return next;
}
function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
var smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, seed, octaves = 3) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

// src/data/anims.json
var anims_default = {
  idle: { fps: 4, loop: true, frames: [
    { bob: 0, lean: 0, legR: { a: 2, lift: 0 }, legL: { a: -2, lift: 0 }, armR: { a: 4, b: 8 }, armL: { a: -4, b: 8 } },
    { bob: 0, lean: 0, legR: { a: 2, lift: 0 }, legL: { a: -2, lift: 0 }, armR: { a: 6, b: 8 }, armL: { a: -6, b: 8 } },
    { bob: 1, lean: 0, legR: { a: 2, lift: 0 }, legL: { a: -2, lift: 0 }, armR: { a: 8, b: 8 }, armL: { a: -8, b: 8 } },
    { bob: 1, lean: 0, legR: { a: 2, lift: 0 }, legL: { a: -2, lift: 0 }, armR: { a: 6, b: 8 }, armL: { a: -6, b: 8 } }
  ] },
  walk: { fps: 8, loop: true, gait: true, frames: [
    { bob: -1, lean: 1, legR: { a: 0, lift: 2 }, legL: { a: 0, lift: 0 }, armR: { a: 0, b: 14 }, armL: { a: 0, b: 14 } },
    { bob: 0, lean: 1, legR: { a: 28, lift: 1 }, legL: { a: -28, lift: 0 }, armR: { a: -23, b: 14 }, armL: { a: 23, b: 14 } },
    { bob: 0, lean: 1, legR: { a: 28, lift: 0 }, legL: { a: -28, lift: 1 }, armR: { a: -23, b: 14 }, armL: { a: 23, b: 14 } },
    { bob: -1, lean: 1, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 2 }, armR: { a: 0, b: 14 }, armL: { a: 0, b: 14 } },
    { bob: 0, lean: 1, legR: { a: -28, lift: 0 }, legL: { a: 28, lift: 1 }, armR: { a: 23, b: 14 }, armL: { a: -23, b: 14 } },
    { bob: 0, lean: 1, legR: { a: -28, lift: 1 }, legL: { a: 28, lift: 0 }, armR: { a: 23, b: 14 }, armL: { a: -23, b: 14 } }
  ] },
  carry_walk: { fps: 8, loop: true, gait: true, frames: [
    { bob: -1, lean: 1, legR: { a: 0, lift: 2 }, legL: { a: 0, lift: 0 }, armR: { a: 48, b: 50 }, armL: { a: 52, b: 46 }, carry: { on: true, dy: 0 } },
    { bob: 0, lean: 1, legR: { a: 21, lift: 1 }, legL: { a: -21, lift: 0 }, armR: { a: 48, b: 50 }, armL: { a: 52, b: 46 }, carry: { on: true, dy: 0 } },
    { bob: 0, lean: 1, legR: { a: 21, lift: 0 }, legL: { a: -21, lift: 1 }, armR: { a: 48, b: 50 }, armL: { a: 52, b: 46 }, carry: { on: true, dy: 0 } },
    { bob: -1, lean: 1, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 2 }, armR: { a: 48, b: 50 }, armL: { a: 52, b: 46 }, carry: { on: true, dy: 0 } },
    { bob: 0, lean: 1, legR: { a: -21, lift: 0 }, legL: { a: 21, lift: 1 }, armR: { a: 48, b: 50 }, armL: { a: 52, b: 46 }, carry: { on: true, dy: 0 } },
    { bob: 0, lean: 1, legR: { a: -21, lift: 1 }, legL: { a: 21, lift: 0 }, armR: { a: 48, b: 50 }, armL: { a: 52, b: 46 }, carry: { on: true, dy: 0 } }
  ] },
  chop: { fps: 8, loop: true, frames: [
    { bob: 0, lean: 0, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 80, b: 40 }, armL: { a: 70, b: 40 }, tool: { on: true, a: 151, kind: "axe" } },
    { bob: -1, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 125, b: 25 }, armL: { a: 115, b: 25 }, tool: { on: true, a: 186, kind: "axe" } },
    { bob: -1, lean: -2, legR: { a: 10, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 150, b: 15 }, armL: { a: 140, b: 15 }, tool: { on: true, a: 151, kind: "axe" } },
    { bob: 0, lean: 1, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 100, b: 20 }, armL: { a: 92, b: 20 }, tool: { on: true, a: 130, kind: "axe" } },
    { bob: 1, lean: 2, legR: { a: 18, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 45, b: 30 }, armL: { a: 40, b: 30 }, tool: { on: true, a: 116, kind: "axe" } },
    { bob: 0, lean: 1, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 70, b: 35 }, armL: { a: 62, b: 35 }, tool: { on: true, a: 89, kind: "axe" } }
  ] },
  mine: { fps: 7, loop: true, frames: [
    { bob: 0, lean: 0, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 80, b: 40 }, armL: { a: 70, b: 40 }, tool: { on: true, a: 165, kind: "pick" } },
    { bob: -1, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 125, b: 25 }, armL: { a: 115, b: 25 }, tool: { on: true, a: 195, kind: "pick" } },
    { bob: -1, lean: -2, legR: { a: 10, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 150, b: 15 }, armL: { a: 140, b: 15 }, tool: { on: true, a: 215, kind: "pick" } },
    { bob: 0, lean: 1, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 100, b: 20 }, armL: { a: 92, b: 20 }, tool: { on: true, a: 130, kind: "pick" } },
    { bob: 1, lean: 2, legR: { a: 18, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 45, b: 30 }, armL: { a: 40, b: 30 }, tool: { on: true, a: 70, kind: "pick" } },
    { bob: 0, lean: 1, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 70, b: 35 }, armL: { a: 62, b: 35 }, tool: { on: true, a: 125, kind: "pick" } }
  ] },
  dig: { fps: 6, loop: true, frames: [
    { bob: 1, lean: 1, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 80, b: 40 }, armL: { a: 70, b: 40 }, tool: { on: true, a: 155, kind: "hoe" } },
    { bob: 0, lean: 0, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 125, b: 25 }, armL: { a: 115, b: 25 }, tool: { on: true, a: 185, kind: "hoe" } },
    { bob: 0, lean: -1, legR: { a: 10, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 150, b: 15 }, armL: { a: 140, b: 15 }, tool: { on: true, a: 205, kind: "hoe" } },
    { bob: 1, lean: 2, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 100, b: 20 }, armL: { a: 92, b: 20 }, tool: { on: true, a: 120, kind: "hoe" } },
    { bob: 2, lean: 3, legR: { a: 18, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 45, b: 30 }, armL: { a: 40, b: 30 }, tool: { on: true, a: 60, kind: "hoe" } },
    { bob: 1, lean: 2, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 70, b: 35 }, armL: { a: 62, b: 35 }, tool: { on: true, a: 115, kind: "hoe" } }
  ] },
  gather: { fps: 5, loop: true, frames: [
    { bob: 1, lean: 2, legR: { a: 10, lift: 0 }, legL: { a: -10, lift: 0 }, armR: { a: 30, b: 20 }, armL: { a: 25, b: 20 } },
    { bob: 2, lean: 3, legR: { a: 14, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 14, b: 10 }, armL: { a: 10, b: 10 } },
    { bob: 1, lean: 2, legR: { a: 10, lift: 0 }, legL: { a: -10, lift: 0 }, armR: { a: 55, b: 60 }, armL: { a: 50, b: 60 } },
    { bob: 0, lean: 1, legR: { a: 8, lift: 0 }, legL: { a: -8, lift: 0 }, armR: { a: 45, b: 70 }, armL: { a: 40, b: 70 } }
  ] },
  build: { fps: 6, loop: true, frames: [
    { bob: 0, lean: 0, legR: { a: 10, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 70, b: 45 }, armL: { a: 60, b: 45 }, tool: { on: true, a: 150, kind: "hammer" } },
    { bob: -1, lean: -1, legR: { a: 10, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 110, b: 30 }, armL: { a: 100, b: 30 }, tool: { on: true, a: 190, kind: "hammer" } },
    { bob: 0, lean: 1, legR: { a: 12, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 60, b: 35 }, armL: { a: 55, b: 35 }, tool: { on: true, a: 95, kind: "hammer" } },
    { bob: 1, lean: 2, legR: { a: 14, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 50, b: 40 }, armL: { a: 45, b: 40 }, tool: { on: true, a: 60, kind: "hammer" } }
  ] },
  craft: { fps: 5, loop: true, frames: [
    { bob: 1, lean: 1, legR: { a: 10, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 70, b: 45 }, armL: { a: 60, b: 45 }, tool: { on: true, a: 150, kind: "hammer" } },
    { bob: 0, lean: 0, legR: { a: 10, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 110, b: 30 }, armL: { a: 100, b: 30 }, tool: { on: true, a: 190, kind: "hammer" } },
    { bob: 1, lean: 2, legR: { a: 12, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 60, b: 35 }, armL: { a: 55, b: 35 }, tool: { on: true, a: 95, kind: "hammer" } },
    { bob: 2, lean: 3, legR: { a: 14, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 50, b: 40 }, armL: { a: 45, b: 40 }, tool: { on: true, a: 60, kind: "hammer" } }
  ] },
  hit: { fps: 10, loop: false, hit: 0, frames: [
    { bob: 0, lean: -3, legR: { a: 8, lift: 0 }, legL: { a: -8, lift: 0 }, armR: { a: 30, b: 10 }, armL: { a: 28, b: 10 } },
    { bob: 0, lean: -1, legR: { a: 10, lift: 0 }, legL: { a: -10, lift: 0 }, armR: { a: 20, b: 10 }, armL: { a: 18, b: 10 } }
  ] },
  run: { fps: 12, loop: true, frames: [
    { bob: -1, lean: 3, legR: { a: 0, lift: 3 }, legL: { a: 0, lift: 0 }, armR: { a: 0, b: 70 }, armL: { a: 0, b: 70 } },
    { bob: 0, lean: 3, legR: { a: 36, lift: 2 }, legL: { a: -36, lift: 0 }, armR: { a: -52, b: 70 }, armL: { a: 52, b: 70 } },
    { bob: 0, lean: 3, legR: { a: 36, lift: 0 }, legL: { a: -36, lift: 1 }, armR: { a: -52, b: 70 }, armL: { a: 52, b: 70 } },
    { bob: -1, lean: 3, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 3 }, armR: { a: 0, b: 70 }, armL: { a: 0, b: 70 } },
    { bob: 0, lean: 3, legR: { a: -36, lift: 0 }, legL: { a: 36, lift: 2 }, armR: { a: 52, b: 70 }, armL: { a: -52, b: 70 } },
    { bob: 0, lean: 3, legR: { a: -36, lift: 2 }, legL: { a: 36, lift: 0 }, armR: { a: 52, b: 70 }, armL: { a: -52, b: 70 } }
  ] },
  down: { fps: 2, loop: true, frames: [
    { bob: 7, lean: -2, legR: { a: 55, lift: 0 }, legL: { a: 48, lift: 0 }, armR: { a: 25, b: 25 }, armL: { a: 15, b: 20 } },
    { bob: 6, lean: -3, legR: { a: 55, lift: 0 }, legL: { a: 48, lift: 0 }, armR: { a: 28, b: 25 }, armL: { a: 18, b: 20 } }
  ] },
  fist_guard: { fps: 4, loop: true, frames: [
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 55, b: 75 }, armL: { a: 45, b: 80 } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 56, b: 75 }, armL: { a: 46, b: 80 } },
    { bob: 2, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 55, b: 75 }, armL: { a: 45, b: 80 } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 54, b: 75 }, armL: { a: 44, b: 80 } }
  ] },
  fist_charge: { fps: 12, loop: true, frames: [
    { bob: -1, lean: 5, legR: { a: 0, lift: 3 }, legL: { a: 0, lift: 0 }, armR: { a: 40, b: 80 }, armL: { a: 40, b: 80 } },
    { bob: 0, lean: 5, legR: { a: 33, lift: 2 }, legL: { a: -33, lift: 0 }, armR: { a: -3, b: 80 }, armL: { a: 83, b: 80 } },
    { bob: 0, lean: 5, legR: { a: 33, lift: 0 }, legL: { a: -33, lift: 1 }, armR: { a: -3, b: 80 }, armL: { a: 83, b: 80 } },
    { bob: -1, lean: 5, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 3 }, armR: { a: 40, b: 80 }, armL: { a: 40, b: 80 } },
    { bob: 0, lean: 5, legR: { a: -33, lift: 0 }, legL: { a: 33, lift: 2 }, armR: { a: 83, b: 80 }, armL: { a: -3, b: 80 } },
    { bob: 0, lean: 5, legR: { a: -33, lift: 2 }, legL: { a: 33, lift: 0 }, armR: { a: 83, b: 80 }, armL: { a: -3, b: 80 } }
  ] },
  fist_attack: { fps: 10, loop: false, hit: 3, frames: [
    { bob: 0, lean: 0, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 110, b: 30 }, armL: { a: 104, b: 30 }, tool: { on: true, a: 140, kind: "club" } },
    { bob: -1, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 160, b: 20 }, armL: { a: 155, b: 20 }, tool: { on: true, a: 185, kind: "club" } },
    { bob: -1, lean: -3, legR: { a: 10, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 175, b: 10 }, armL: { a: 170, b: 10 }, tool: { on: true, a: 205, kind: "club" } },
    { bob: 1, lean: 4, legR: { a: 24, lift: 0 }, legL: { a: -20, lift: 0 }, armR: { a: 70, b: 30 }, armL: { a: 66, b: 30 }, tool: { on: true, a: 60, kind: "club" } },
    { bob: 1, lean: 4, legR: { a: 24, lift: 0 }, legL: { a: -20, lift: 0 }, armR: { a: 60, b: 30 }, armL: { a: 56, b: 30 }, tool: { on: true, a: 55, kind: "club" } },
    { bob: 0, lean: 1, legR: { a: 16, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 90, b: 25 }, armL: { a: 84, b: 25 }, tool: { on: true, a: 120, kind: "club" } }
  ] },
  swing_idle: { fps: 4, loop: true, frames: [
    { bob: 0, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -5, b: 8 }, tool: { on: true, a: 172, kind: "club" } },
    { bob: 0, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -7, b: 8 }, tool: { on: true, a: 172, kind: "club" } },
    { bob: 1, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -9, b: 8 }, tool: { on: true, a: 172, kind: "club" } },
    { bob: 1, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -7, b: 8 }, tool: { on: true, a: 172, kind: "club" } }
  ] },
  swing_walk: { fps: 8, loop: true, gait: true, frames: [
    { bob: -1, lean: 1, legR: { a: 0, lift: 2 }, legL: { a: 0, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: 0, b: 14 }, tool: { on: true, a: 172, kind: "club" } },
    { bob: 0, lean: 1, legR: { a: 24, lift: 1 }, legL: { a: -24, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: 19, b: 14 }, tool: { on: true, a: 172, kind: "club" } },
    { bob: 0, lean: 1, legR: { a: 24, lift: 0 }, legL: { a: -24, lift: 1 }, armR: { a: 30, b: 30 }, armL: { a: 19, b: 14 }, tool: { on: true, a: 172, kind: "club" } },
    { bob: -1, lean: 1, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 2 }, armR: { a: 30, b: 30 }, armL: { a: 0, b: 14 }, tool: { on: true, a: 172, kind: "club" } },
    { bob: 0, lean: 1, legR: { a: -24, lift: 0 }, legL: { a: 24, lift: 1 }, armR: { a: 30, b: 30 }, armL: { a: -19, b: 14 }, tool: { on: true, a: 172, kind: "club" } },
    { bob: 0, lean: 1, legR: { a: -24, lift: 1 }, legL: { a: 24, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: -19, b: 14 }, tool: { on: true, a: 172, kind: "club" } }
  ] },
  swing_guard: { fps: 4, loop: true, frames: [
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 105, b: 30 }, armL: { a: 98, b: 30 }, tool: { on: true, a: 150, kind: "club" } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 106, b: 30 }, armL: { a: 99, b: 30 }, tool: { on: true, a: 152, kind: "club" } },
    { bob: 2, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 105, b: 30 }, armL: { a: 98, b: 30 }, tool: { on: true, a: 150, kind: "club" } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 104, b: 30 }, armL: { a: 97, b: 30 }, tool: { on: true, a: 148, kind: "club" } }
  ] },
  swing_charge: { fps: 12, loop: true, frames: [
    { bob: -1, lean: 4, legR: { a: 0, lift: 3 }, legL: { a: 0, lift: 0 }, armR: { a: 150, b: 20 }, armL: { a: 144, b: 20 }, tool: { on: true, a: 205, kind: "club" } },
    { bob: 0, lean: 4, legR: { a: 33, lift: 2 }, legL: { a: -33, lift: 0 }, armR: { a: 147, b: 20 }, armL: { a: 141, b: 20 }, tool: { on: true, a: 201, kind: "club" } },
    { bob: 0, lean: 4, legR: { a: 33, lift: 0 }, legL: { a: -33, lift: 1 }, armR: { a: 147, b: 20 }, armL: { a: 141, b: 20 }, tool: { on: true, a: 201, kind: "club" } },
    { bob: -1, lean: 4, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 3 }, armR: { a: 150, b: 20 }, armL: { a: 144, b: 20 }, tool: { on: true, a: 205, kind: "club" } },
    { bob: 0, lean: 4, legR: { a: -33, lift: 0 }, legL: { a: 33, lift: 2 }, armR: { a: 153, b: 20 }, armL: { a: 147, b: 20 }, tool: { on: true, a: 209, kind: "club" } },
    { bob: 0, lean: 4, legR: { a: -33, lift: 2 }, legL: { a: 33, lift: 0 }, armR: { a: 153, b: 20 }, armL: { a: 147, b: 20 }, tool: { on: true, a: 209, kind: "club" } }
  ] },
  swing_attack: { fps: 10, loop: false, hit: 3, frames: [
    { bob: 0, lean: 0, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 110, b: 30 }, armL: { a: 104, b: 30 }, tool: { on: true, a: 140, kind: "club" } },
    { bob: -1, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 160, b: 20 }, armL: { a: 155, b: 20 }, tool: { on: true, a: 185, kind: "club" } },
    { bob: -1, lean: -3, legR: { a: 10, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 175, b: 10 }, armL: { a: 170, b: 10 }, tool: { on: true, a: 205, kind: "club" } },
    { bob: 1, lean: 4, legR: { a: 24, lift: 0 }, legL: { a: -20, lift: 0 }, armR: { a: 70, b: 30 }, armL: { a: 66, b: 30 }, tool: { on: true, a: 60, kind: "club" } },
    { bob: 1, lean: 4, legR: { a: 24, lift: 0 }, legL: { a: -20, lift: 0 }, armR: { a: 60, b: 30 }, armL: { a: 56, b: 30 }, tool: { on: true, a: 55, kind: "club" } },
    { bob: 0, lean: 1, legR: { a: 16, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 90, b: 25 }, armL: { a: 84, b: 25 }, tool: { on: true, a: 120, kind: "club" } }
  ] },
  thrust_idle: { fps: 4, loop: true, frames: [
    { bob: 0, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -5, b: 8 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 0, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -7, b: 8 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 1, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -9, b: 8 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 1, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -7, b: 8 }, tool: { on: true, a: 172, kind: "spear" } }
  ] },
  thrust_walk: { fps: 8, loop: true, gait: true, frames: [
    { bob: -1, lean: 1, legR: { a: 0, lift: 2 }, legL: { a: 0, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: 0, b: 14 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 0, lean: 1, legR: { a: 24, lift: 1 }, legL: { a: -24, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: 19, b: 14 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 0, lean: 1, legR: { a: 24, lift: 0 }, legL: { a: -24, lift: 1 }, armR: { a: 30, b: 30 }, armL: { a: 19, b: 14 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: -1, lean: 1, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 2 }, armR: { a: 30, b: 30 }, armL: { a: 0, b: 14 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 0, lean: 1, legR: { a: -24, lift: 0 }, legL: { a: 24, lift: 1 }, armR: { a: 30, b: 30 }, armL: { a: -19, b: 14 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 0, lean: 1, legR: { a: -24, lift: 1 }, legL: { a: 24, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: -19, b: 14 }, tool: { on: true, a: 172, kind: "spear" } }
  ] },
  thrust_guard: { fps: 4, loop: true, frames: [
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 52, b: 30 }, armL: { a: 46, b: 30 }, tool: { on: true, a: 110, kind: "spear" } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 53, b: 30 }, armL: { a: 47, b: 30 }, tool: { on: true, a: 111, kind: "spear" } },
    { bob: 2, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 52, b: 30 }, armL: { a: 46, b: 30 }, tool: { on: true, a: 110, kind: "spear" } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 51, b: 30 }, armL: { a: 45, b: 30 }, tool: { on: true, a: 109, kind: "spear" } }
  ] },
  thrust_charge: { fps: 12, loop: true, frames: [
    { bob: -1, lean: 5, legR: { a: 0, lift: 3 }, legL: { a: 0, lift: 0 }, armR: { a: 50, b: 30 }, armL: { a: 44, b: 30 }, tool: { on: true, a: 110, kind: "spear" } },
    { bob: 0, lean: 5, legR: { a: 33, lift: 2 }, legL: { a: -33, lift: 0 }, armR: { a: 53, b: 30 }, armL: { a: 47, b: 30 }, tool: { on: true, a: 113, kind: "spear" } },
    { bob: 0, lean: 5, legR: { a: 33, lift: 0 }, legL: { a: -33, lift: 1 }, armR: { a: 53, b: 30 }, armL: { a: 47, b: 30 }, tool: { on: true, a: 113, kind: "spear" } },
    { bob: -1, lean: 5, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 3 }, armR: { a: 50, b: 30 }, armL: { a: 44, b: 30 }, tool: { on: true, a: 110, kind: "spear" } },
    { bob: 0, lean: 5, legR: { a: -33, lift: 0 }, legL: { a: 33, lift: 2 }, armR: { a: 47, b: 30 }, armL: { a: 41, b: 30 }, tool: { on: true, a: 107, kind: "spear" } },
    { bob: 0, lean: 5, legR: { a: -33, lift: 2 }, legL: { a: 33, lift: 0 }, armR: { a: 47, b: 30 }, armL: { a: 41, b: 30 }, tool: { on: true, a: 107, kind: "spear" } }
  ] },
  thrust_attack: { fps: 10, loop: false, hit: 3, frames: [
    { bob: 0, lean: 0, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 50, b: 30 }, armL: { a: 44, b: 30 }, tool: { on: true, a: 110, kind: "spear" } },
    { bob: 0, lean: -2, legR: { a: 12, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 20, b: 40 }, armL: { a: 15, b: 40 }, tool: { on: true, a: 105, kind: "spear" } },
    { bob: 0, lean: -3, legR: { a: 10, lift: 0 }, legL: { a: -18, lift: 0 }, armR: { a: 10, b: 40 }, armL: { a: 5, b: 40 }, tool: { on: true, a: 102, kind: "spear" } },
    { bob: -1, lean: 3, legR: { a: 24, lift: 0 }, legL: { a: -20, lift: 0 }, armR: { a: 95, b: 0 }, armL: { a: 90, b: 0 }, tool: { on: true, a: 90, kind: "spear" } },
    { bob: -1, lean: 3, legR: { a: 24, lift: 0 }, legL: { a: -20, lift: 0 }, armR: { a: 98, b: 0 }, armL: { a: 92, b: 0 }, tool: { on: true, a: 88, kind: "spear" } },
    { bob: 0, lean: 1, legR: { a: 16, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 70, b: 20 }, armL: { a: 64, b: 20 }, tool: { on: true, a: 98, kind: "spear" } }
  ] },
  shoot_idle: { fps: 4, loop: true, frames: [
    { bob: 0, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -5, b: 8 }, tool: { on: true, a: 172, kind: "bow" } },
    { bob: 0, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -7, b: 8 }, tool: { on: true, a: 172, kind: "bow" } },
    { bob: 1, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -9, b: 8 }, tool: { on: true, a: 172, kind: "bow" } },
    { bob: 1, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -7, b: 8 }, tool: { on: true, a: 172, kind: "bow" } }
  ] },
  shoot_walk: { fps: 8, loop: true, gait: true, frames: [
    { bob: -1, lean: 1, legR: { a: 0, lift: 2 }, legL: { a: 0, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: 0, b: 14 }, tool: { on: true, a: 172, kind: "bow" } },
    { bob: 0, lean: 1, legR: { a: 24, lift: 1 }, legL: { a: -24, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: 19, b: 14 }, tool: { on: true, a: 172, kind: "bow" } },
    { bob: 0, lean: 1, legR: { a: 24, lift: 0 }, legL: { a: -24, lift: 1 }, armR: { a: 30, b: 30 }, armL: { a: 19, b: 14 }, tool: { on: true, a: 172, kind: "bow" } },
    { bob: -1, lean: 1, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 2 }, armR: { a: 30, b: 30 }, armL: { a: 0, b: 14 }, tool: { on: true, a: 172, kind: "bow" } },
    { bob: 0, lean: 1, legR: { a: -24, lift: 0 }, legL: { a: 24, lift: 1 }, armR: { a: 30, b: 30 }, armL: { a: -19, b: 14 }, tool: { on: true, a: 172, kind: "bow" } },
    { bob: 0, lean: 1, legR: { a: -24, lift: 1 }, legL: { a: 24, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: -19, b: 14 }, tool: { on: true, a: 172, kind: "bow" } }
  ] },
  shoot_guard: { fps: 4, loop: true, frames: [
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 80, b: 10 }, armL: { a: 70, b: 20 }, tool: { on: true, a: 180, kind: "bow" } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 81, b: 10 }, armL: { a: 71, b: 20 }, tool: { on: true, a: 180, kind: "bow" } },
    { bob: 2, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 80, b: 10 }, armL: { a: 70, b: 20 }, tool: { on: true, a: 180, kind: "bow" } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 79, b: 10 }, armL: { a: 69, b: 20 }, tool: { on: true, a: 180, kind: "bow" } }
  ] },
  shoot_charge: { fps: 12, loop: true, frames: [
    { bob: -1, lean: 3, legR: { a: 0, lift: 3 }, legL: { a: 0, lift: 0 }, armR: { a: 60, b: 25 }, armL: { a: 55, b: 25 }, tool: { on: true, a: 110, kind: "bow" } },
    { bob: 0, lean: 3, legR: { a: 31, lift: 2 }, legL: { a: -31, lift: 0 }, armR: { a: 64, b: 25 }, armL: { a: 51, b: 25 }, tool: { on: true, a: 110, kind: "bow" } },
    { bob: 0, lean: 3, legR: { a: 31, lift: 0 }, legL: { a: -31, lift: 1 }, armR: { a: 64, b: 25 }, armL: { a: 51, b: 25 }, tool: { on: true, a: 110, kind: "bow" } },
    { bob: -1, lean: 3, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 3 }, armR: { a: 60, b: 25 }, armL: { a: 55, b: 25 }, tool: { on: true, a: 110, kind: "bow" } },
    { bob: 0, lean: 3, legR: { a: -31, lift: 0 }, legL: { a: 31, lift: 2 }, armR: { a: 56, b: 25 }, armL: { a: 59, b: 25 }, tool: { on: true, a: 110, kind: "bow" } },
    { bob: 0, lean: 3, legR: { a: -31, lift: 2 }, legL: { a: 31, lift: 0 }, armR: { a: 56, b: 25 }, armL: { a: 59, b: 25 }, tool: { on: true, a: 110, kind: "bow" } }
  ] },
  shoot_attack: { fps: 10, loop: false, hit: 4, frames: [
    { bob: 0, lean: 0, legR: { a: 12, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 80, b: 10 }, armL: { a: 70, b: 20 }, tool: { on: true, a: 180, kind: "bow" } },
    { bob: 0, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 85, b: 5 }, armL: { a: 60, b: 40 }, tool: { on: true, a: 180, kind: "bow" } },
    { bob: 0, lean: -2, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 88, b: 0 }, armL: { a: 40, b: -70 }, tool: { on: true, a: 180, kind: "bow" } },
    { bob: 0, lean: -3, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 90, b: 0 }, armL: { a: 30, b: -80 }, tool: { on: true, a: 180, kind: "bow" } },
    { bob: 0, lean: 0, legR: { a: 12, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 90, b: 0 }, armL: { a: 60, b: -20 }, tool: { on: true, a: 180, kind: "bow" } },
    { bob: 0, lean: 0, legR: { a: 12, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 80, b: 10 }, armL: { a: 70, b: 20 }, tool: { on: true, a: 180, kind: "bow" } }
  ] },
  sling_idle: { fps: 4, loop: true, frames: [
    { bob: 0, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -5, b: 8 }, tool: { on: true, a: 172, kind: "sling" } },
    { bob: 0, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -7, b: 8 }, tool: { on: true, a: 172, kind: "sling" } },
    { bob: 1, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -9, b: 8 }, tool: { on: true, a: 172, kind: "sling" } },
    { bob: 1, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -7, b: 8 }, tool: { on: true, a: 172, kind: "sling" } }
  ] },
  sling_walk: { fps: 8, loop: true, gait: true, frames: [
    { bob: -1, lean: 1, legR: { a: 0, lift: 2 }, legL: { a: 0, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: 0, b: 14 }, tool: { on: true, a: 172, kind: "sling" } },
    { bob: 0, lean: 1, legR: { a: 24, lift: 1 }, legL: { a: -24, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: 19, b: 14 }, tool: { on: true, a: 172, kind: "sling" } },
    { bob: 0, lean: 1, legR: { a: 24, lift: 0 }, legL: { a: -24, lift: 1 }, armR: { a: 30, b: 30 }, armL: { a: 19, b: 14 }, tool: { on: true, a: 172, kind: "sling" } },
    { bob: -1, lean: 1, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 2 }, armR: { a: 30, b: 30 }, armL: { a: 0, b: 14 }, tool: { on: true, a: 172, kind: "sling" } },
    { bob: 0, lean: 1, legR: { a: -24, lift: 0 }, legL: { a: 24, lift: 1 }, armR: { a: 30, b: 30 }, armL: { a: -19, b: 14 }, tool: { on: true, a: 172, kind: "sling" } },
    { bob: 0, lean: 1, legR: { a: -24, lift: 1 }, legL: { a: 24, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: -19, b: 14 }, tool: { on: true, a: 172, kind: "sling" } }
  ] },
  sling_guard: { fps: 4, loop: true, frames: [
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 60, b: 25 }, armL: { a: 55, b: 25 }, tool: { on: true, a: 110, kind: "sling" } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 61, b: 25 }, armL: { a: 56, b: 25 }, tool: { on: true, a: 113, kind: "sling" } },
    { bob: 2, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 60, b: 25 }, armL: { a: 55, b: 25 }, tool: { on: true, a: 110, kind: "sling" } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 59, b: 25 }, armL: { a: 54, b: 25 }, tool: { on: true, a: 107, kind: "sling" } }
  ] },
  sling_charge: { fps: 12, loop: true, frames: [
    { bob: -1, lean: 3, legR: { a: 0, lift: 3 }, legL: { a: 0, lift: 0 }, armR: { a: 60, b: 25 }, armL: { a: 55, b: 25 }, tool: { on: true, a: 110, kind: "sling" } },
    { bob: 0, lean: 3, legR: { a: 31, lift: 2 }, legL: { a: -31, lift: 0 }, armR: { a: 64, b: 25 }, armL: { a: 51, b: 25 }, tool: { on: true, a: 110, kind: "sling" } },
    { bob: 0, lean: 3, legR: { a: 31, lift: 0 }, legL: { a: -31, lift: 1 }, armR: { a: 64, b: 25 }, armL: { a: 51, b: 25 }, tool: { on: true, a: 110, kind: "sling" } },
    { bob: -1, lean: 3, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 3 }, armR: { a: 60, b: 25 }, armL: { a: 55, b: 25 }, tool: { on: true, a: 110, kind: "sling" } },
    { bob: 0, lean: 3, legR: { a: -31, lift: 0 }, legL: { a: 31, lift: 2 }, armR: { a: 56, b: 25 }, armL: { a: 59, b: 25 }, tool: { on: true, a: 110, kind: "sling" } },
    { bob: 0, lean: 3, legR: { a: -31, lift: 2 }, legL: { a: 31, lift: 0 }, armR: { a: 56, b: 25 }, armL: { a: 59, b: 25 }, tool: { on: true, a: 110, kind: "sling" } }
  ] },
  sling_attack: { fps: 10, loop: false, hit: 4, frames: [
    { bob: 0, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 165, b: 10 }, armL: { a: 150, b: 15 }, tool: { on: true, a: 175, kind: "sling" } },
    { bob: 0, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 170, b: 5 }, armL: { a: 150, b: 15 }, tool: { on: true, a: 270, kind: "sling" } },
    { bob: 0, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 170, b: 5 }, armL: { a: 150, b: 15 }, tool: { on: true, a: 360, kind: "sling" } },
    { bob: 0, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -12, lift: 0 }, armR: { a: 170, b: 5 }, armL: { a: 150, b: 15 }, tool: { on: true, a: 90, kind: "sling" } },
    { bob: 0, lean: 2, legR: { a: 20, lift: 0 }, legL: { a: -18, lift: 0 }, armR: { a: 100, b: 10 }, armL: { a: 95, b: 10 }, tool: { on: true, a: 100, kind: "sling" } },
    { bob: 0, lean: 0, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 60, b: 25 }, armL: { a: 55, b: 25 }, tool: { on: true, a: 110, kind: "sling" } }
  ] },
  throw_idle: { fps: 4, loop: true, frames: [
    { bob: 0, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -5, b: 8 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 0, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -7, b: 8 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 1, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -9, b: 8 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 1, lean: 0, legR: { a: 3, lift: 0 }, legL: { a: -3, lift: 0 }, armR: { a: 28, b: 30 }, armL: { a: -7, b: 8 }, tool: { on: true, a: 172, kind: "spear" } }
  ] },
  throw_walk: { fps: 8, loop: true, gait: true, frames: [
    { bob: -1, lean: 1, legR: { a: 0, lift: 2 }, legL: { a: 0, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: 0, b: 14 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 0, lean: 1, legR: { a: 24, lift: 1 }, legL: { a: -24, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: 19, b: 14 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 0, lean: 1, legR: { a: 24, lift: 0 }, legL: { a: -24, lift: 1 }, armR: { a: 30, b: 30 }, armL: { a: 19, b: 14 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: -1, lean: 1, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 2 }, armR: { a: 30, b: 30 }, armL: { a: 0, b: 14 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 0, lean: 1, legR: { a: -24, lift: 0 }, legL: { a: 24, lift: 1 }, armR: { a: 30, b: 30 }, armL: { a: -19, b: 14 }, tool: { on: true, a: 172, kind: "spear" } },
    { bob: 0, lean: 1, legR: { a: -24, lift: 1 }, legL: { a: 24, lift: 0 }, armR: { a: 30, b: 30 }, armL: { a: -19, b: 14 }, tool: { on: true, a: 172, kind: "spear" } }
  ] },
  throw_guard: { fps: 4, loop: true, frames: [
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 52, b: 30 }, armL: { a: 46, b: 30 }, tool: { on: true, a: 110, kind: "spear" } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 53, b: 30 }, armL: { a: 47, b: 30 }, tool: { on: true, a: 111, kind: "spear" } },
    { bob: 2, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 52, b: 30 }, armL: { a: 46, b: 30 }, tool: { on: true, a: 110, kind: "spear" } },
    { bob: 1, lean: -1, legR: { a: 16, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 51, b: 30 }, armL: { a: 45, b: 30 }, tool: { on: true, a: 109, kind: "spear" } }
  ] },
  throw_charge: { fps: 12, loop: true, frames: [
    { bob: -1, lean: 5, legR: { a: 0, lift: 3 }, legL: { a: 0, lift: 0 }, armR: { a: 50, b: 30 }, armL: { a: 44, b: 30 }, tool: { on: true, a: 110, kind: "spear" } },
    { bob: 0, lean: 5, legR: { a: 33, lift: 2 }, legL: { a: -33, lift: 0 }, armR: { a: 53, b: 30 }, armL: { a: 47, b: 30 }, tool: { on: true, a: 113, kind: "spear" } },
    { bob: 0, lean: 5, legR: { a: 33, lift: 0 }, legL: { a: -33, lift: 1 }, armR: { a: 53, b: 30 }, armL: { a: 47, b: 30 }, tool: { on: true, a: 113, kind: "spear" } },
    { bob: -1, lean: 5, legR: { a: 0, lift: 0 }, legL: { a: 0, lift: 3 }, armR: { a: 50, b: 30 }, armL: { a: 44, b: 30 }, tool: { on: true, a: 110, kind: "spear" } },
    { bob: 0, lean: 5, legR: { a: -33, lift: 0 }, legL: { a: 33, lift: 2 }, armR: { a: 47, b: 30 }, armL: { a: 41, b: 30 }, tool: { on: true, a: 107, kind: "spear" } },
    { bob: 0, lean: 5, legR: { a: -33, lift: 2 }, legL: { a: 33, lift: 0 }, armR: { a: 47, b: 30 }, armL: { a: 41, b: 30 }, tool: { on: true, a: 107, kind: "spear" } }
  ] },
  throw_attack: { fps: 10, loop: false, hit: 3, frames: [
    { bob: 0, lean: 0, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 50, b: 30 }, armL: { a: 44, b: 30 }, tool: { on: true, a: 110, kind: "spear" } },
    { bob: 0, lean: -2, legR: { a: 12, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 20, b: 40 }, armL: { a: 15, b: 40 }, tool: { on: true, a: 105, kind: "spear" } },
    { bob: 0, lean: -3, legR: { a: 10, lift: 0 }, legL: { a: -18, lift: 0 }, armR: { a: 10, b: 40 }, armL: { a: 5, b: 40 }, tool: { on: true, a: 102, kind: "spear" } },
    { bob: -1, lean: 3, legR: { a: 24, lift: 0 }, legL: { a: -20, lift: 0 }, armR: { a: 95, b: 0 }, armL: { a: 90, b: 0 }, tool: { on: true, a: 90, kind: "spear" } },
    { bob: -1, lean: 3, legR: { a: 24, lift: 0 }, legL: { a: -20, lift: 0 }, armR: { a: 98, b: 0 }, armL: { a: 92, b: 0 }, tool: { on: true, a: 88, kind: "spear" } },
    { bob: 0, lean: 1, legR: { a: 16, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 70, b: 20 }, armL: { a: 64, b: 20 }, tool: { on: true, a: 98, kind: "spear" } }
  ] },
  slash: { fps: 12, loop: false, hit: 3, frames: [
    { bob: 0, lean: 0, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 100, b: 30 }, armL: { a: 92, b: 30 }, tool: { on: true, a: 150, kind: "hatchet" } },
    { bob: 0, lean: -2, legR: { a: 12, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 150, b: 20 }, armL: { a: 140, b: 20 }, tool: { on: true, a: 215, kind: "hatchet" } },
    { bob: -1, lean: -3, legR: { a: 10, lift: 0 }, legL: { a: -18, lift: 0 }, armR: { a: 165, b: 10 }, armL: { a: 155, b: 10 }, tool: { on: true, a: 235, kind: "hatchet" } },
    { bob: 1, lean: 3, legR: { a: 24, lift: 0 }, legL: { a: -20, lift: 0 }, armR: { a: 95, b: 10 }, armL: { a: 88, b: 10 }, tool: { on: true, a: 80, kind: "hatchet" } },
    { bob: 1, lean: 4, legR: { a: 26, lift: 0 }, legL: { a: -20, lift: 0 }, armR: { a: 60, b: 15 }, armL: { a: 55, b: 15 }, tool: { on: true, a: 40, kind: "hatchet" } },
    { bob: 0, lean: 1, legR: { a: 16, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 85, b: 25 }, armL: { a: 78, b: 25 }, tool: { on: true, a: 110, kind: "hatchet" } }
  ] }
};

// src/data/animals.json
var animals_default = {
  _note: "zone = map ring 1..4 (each 24 tiles from the campfire). speed in tiles/s. flee: distance that makes it run. aggro: distance at which a predator starts hunting. herd: [min,max] group size. habitat water = lives in water tiles. Art lives in animals/bodies.json. drops: other materials the body gives when skinned (bone, fat, feather, tusk), on top of meat (becomes food) and hide. A species is just a key here plus an entry in bodies.json; the list below is in spawn order.",
  rabbit: { name: "Th\u1ECF", hp: 10, damage: 0, type: "pierce", cycle: 1, range: 1, speed: 2.2, flee: 6, aggro: 0, meat: 3, hide: 0, zones: [1, 2], herd: [1, 2], count: 36, prey: true, nocturnal: false },
  fowl: { name: "G\xE0 r\u1EEBng", hp: 10, damage: 0, type: "pierce", cycle: 1, range: 1, speed: 2, flee: 5, aggro: 0, meat: 3, hide: 0, zones: [1, 2], herd: [1, 3], count: 20, prey: true, nocturnal: false, drops: { feather: 2 } },
  deer: { name: "H\u01B0\u01A1u", hp: 60, damage: 4, type: "crush", cycle: 1.6, range: 1, speed: 2.6, flee: 7, aggro: 0, meat: 20, hide: 3, zones: [1, 3], herd: [3, 5], count: 18, prey: true, nocturnal: false, cornered: true, drops: { bone: 2, fat: 2 } },
  boar: { name: "L\u1EE3n r\u1EEBng", hp: 90, damage: 10, type: "pierce", cycle: 1.5, range: 1, speed: 2.1, flee: 0, aggro: 0, meat: 25, hide: 3, zones: [1, 3], herd: [1, 2], count: 8, prey: true, nocturnal: false, defends: true, drops: { bone: 2, fat: 4 } },
  wolf: { name: "S\xF3i", hp: 55, damage: 7, type: "slash", cycle: 1.2, range: 1, speed: 2.9, flee: 0, aggro: 9, meat: 8, hide: 2, zones: [2, 3], herd: [4, 6], count: 12, prey: false, nocturnal: true, fearsFire: 5, drops: { bone: 2 } },
  fish: { name: "C\xE1", hp: 1, damage: 0, type: "pierce", cycle: 1, range: 1, speed: 1.4, flee: 3, aggro: 0, meat: 3, hide: 0, zones: [1, 3], herd: [3, 6], count: 36, prey: true, nocturnal: false, habitat: "water" },
  aurochs: { name: "B\xF2 r\u1EEBng", hp: 130, damage: 12, type: "crush", cycle: 1.8, range: 1, speed: 2, flee: 0, aggro: 0, meat: 45, hide: 6, drops: { bone: 3, fat: 4 }, zones: [1, 3], herd: [2, 4], count: 6, prey: true, nocturnal: false, defends: true },
  duck: { name: "V\u1ECBt tr\u1EDDi", hp: 8, damage: 0, type: "pierce", cycle: 1, range: 1, speed: 1.9, flee: 5, aggro: 0, meat: 3, hide: 0, drops: { feather: 2 }, zones: [1, 2], herd: [2, 4], count: 14, prey: true, nocturnal: false },
  fox: { name: "C\xE1o", hp: 25, damage: 4, type: "pierce", cycle: 1, range: 1, speed: 2.8, flee: 0, aggro: 4, meat: 4, hide: 1, zones: [2, 3], herd: [1, 1], count: 8, prey: false, nocturnal: true, fearsFire: 4 },
  ibex: { name: "D\xEA n\xFAi", hp: 50, damage: 5, type: "crush", cycle: 1.5, range: 1, speed: 3, flee: 9, aggro: 0, meat: 14, hide: 2, drops: { bone: 2 }, zones: [2, 4], herd: [3, 5], count: 10, prey: true, nocturnal: false, cornered: true },
  elk: { name: "Nai s\u1EEBng t\u1EA5m", hp: 160, damage: 10, type: "crush", cycle: 1.8, range: 1, speed: 2.4, flee: 0, aggro: 0, meat: 55, hide: 7, drops: { bone: 4, fat: 5 }, zones: [2, 3], herd: [1, 3], count: 6, prey: true, nocturnal: false, defends: true },
  bear: { name: "G\u1EA5u n\xE2u", hp: 240, damage: 20, type: "slash", cycle: 1.9, range: 1, speed: 2.2, flee: 0, aggro: 6, meat: 45, hide: 9, drops: { bone: 5, fat: 10 }, zones: [3, 4], herd: [1, 1], count: 4, prey: false, nocturnal: false },
  lion: { name: "S\u01B0 t\u1EED hang", hp: 130, damage: 16, type: "slash", cycle: 1.3, range: 1, speed: 3.3, flee: 0, aggro: 11, meat: 28, hide: 6, drops: { bone: 3, fat: 3 }, zones: [3, 4], herd: [1, 3], count: 5, prey: false, nocturnal: true, fearsFire: 6 },
  mammoth: { name: "Voi ma m\xFAt", hp: 450, damage: 28, type: "crush", cycle: 2.6, range: 1, speed: 1.5, flee: 0, aggro: 0, meat: 120, hide: 16, drops: { bone: 14, fat: 24, tusk: 2 }, zones: [3, 4], herd: [2, 3], count: 6, prey: true, nocturnal: false, defends: true },
  pike: { name: "C\xE1 ch\xF3", hp: 2, damage: 0, type: "pierce", cycle: 1, range: 1, speed: 1.8, flee: 4, aggro: 0, meat: 6, hide: 0, drops: { bone: 1 }, zones: [1, 3], herd: [1, 2], count: 16, prey: true, nocturnal: false, habitat: "water" },
  behaviour: {
    fleeBurst: 8,
    tiredSeconds: 6,
    tiredSpeed: 0.5,
    carcassSeconds: 90,
    skinSeconds: 3,
    breedMonth: "spring",
    breedMinFemales: 2,
    breedChance: 0.35,
    regionRadius: 28
  }
};

// src/data/tribes.json
var tribes_default = {
  _note: "distance = tiles from the player's campfire (map is 192 wide, so zone ring = 24 tiles). Strength multiplier = 0.8 + 0.06 * (ring - 1), ring = ceil(distance / 4.8). reward is shown to the player; techs come in M5.",
  spring: {
    name: "Su\u1ED1i Ngu\u1ED3n",
    personality: "peaceful",
    angle: 200,
    distance: 30,
    civilians: 8,
    warriors: 4,
    weapons: ["club", "spear"],
    armor: false,
    look: { hide: "#7a8a4a", pants: "#4a6a8a" },
    relation: 0,
    reward: "D\u1EC5 giao th\u01B0\u01A1ng v\xE0 thu n\u1EA1p; h\u1ECDc T4 B\u1EC7n s\u1EE3i",
    tribute: { food: 12, wood: 6, coin: 3 }
  },
  axe: {
    name: "R\xECu \u0110\xE1",
    personality: "aggressive",
    angle: 320,
    distance: 45,
    civilians: 15,
    warriors: 10,
    weapons: ["hatchet", "mace"],
    armor: true,
    look: { hide: "#8a3a24", pants: "#6a2a1a" },
    relation: -20,
    reward: "L\xEDnh ch\xF9y, b\xED quy\u1EBFt ch\u1EBF ch\xF9y \u0111\xE1",
    tribute: { stone: 10, food: 10, coin: 4 }
  },
  swamp: {
    name: "\u0110\u1EA7m L\u1EA7y",
    personality: "ambusher",
    angle: 80,
    distance: 55,
    civilians: 12,
    warriors: 8,
    weapons: ["sling", "club"],
    armor: false,
    look: { hide: "#5a6a50", pants: "#3a4a3a" },
    relation: -10,
    reward: "\u0110\u1EA5t s\xE9t, s\u1EE3i; h\u1ECDc T5 D\xE2y qu\u0103ng \u0111\xE1",
    tribute: { food: 10, wood: 10, coin: 3 }
  },
  relation: {
    labels: [[-100, "Th\xF9 \u0111\u1ECBch"], [-40, "Trung l\u1EADp"], [20, "Th\xE2n thi\u1EC7n"], [60, "C\u1ED1ng n\u1EA1p"], [90, "Thu ph\u1EE5c"]],
    giftFood: 10,
    giftGain: 5,
    killWarrior: -10,
    killCivilian: -25,
    attackedPeaceful: -30,
    tributeAt: 60,
    joinAt: 90
  },
  surrender: { leaderDown: true, holdCampSeconds: 30, moraleBelow: 10 },
  morale: {
    start: 70,
    flee: 25,
    fleeRecover: 45,
    surrender: 10,
    allyDeath: -15,
    outnumbered: -0.8,
    outnumbering: 0.5,
    nearHome: 0.5,
    night: -0.3,
    leaderNear: 0.3,
    leaderFar: -0.2,
    winBonus: 20,
    backstab: -5,
    calm: 0.1
  }
};

// src/data/weapons.json
var weapons_default = {
  _note: 'type: pierce | slash | crush. range in tiles. cycle in seconds before the agility factor. cost/time/tier only for what the player can craft; others are used by tribes. style: which set of fighting animations the weapon uses (see "styles"); anims overrides single states for one weapon; projectile: what a ranged weapon fires.',
  styles: {
    fist: { name: "Tay kh\xF4ng", idle: "idle", walk: "walk", guard: "fist_guard", charge: "fist_charge", attack: "fist_attack" },
    swing: { name: "Vung, ch\xE9m, \u0111\u1EADp (g\u1EADy, ch\xF9y, r\xECu, ki\u1EBFm)", idle: "swing_idle", walk: "swing_walk", guard: "swing_guard", charge: "swing_charge", attack: "swing_attack" },
    thrust: { name: "\u0110\xE2m (gi\xE1o, th\u01B0\u01A1ng)", idle: "thrust_idle", walk: "thrust_walk", guard: "thrust_guard", charge: "thrust_charge", attack: "thrust_attack" },
    shoot: { name: "B\u1EAFn (cung, n\u1ECF, s\xFAng)", idle: "shoot_idle", walk: "shoot_walk", guard: "shoot_guard", charge: "shoot_charge", attack: "shoot_attack" },
    sling: { name: "Qu\u0103ng \u0111\xE1 (d\xE2y qu\u0103ng, n\xE1)", idle: "sling_idle", walk: "sling_walk", guard: "sling_guard", charge: "sling_charge", attack: "sling_attack" },
    throw: { name: "N\xE9m (lao, ph\xF3ng lao)", idle: "throw_idle", walk: "throw_walk", guard: "throw_guard", charge: "throw_charge", attack: "throw_attack" }
  },
  weapons: {
    fist: {
      name: "Tay kh\xF4ng",
      type: "crush",
      range: 1,
      damage: 2,
      cycle: 1,
      style: "fist"
    },
    club: {
      name: "G\u1EADy g\u1ED7",
      type: "crush",
      range: 1,
      damage: 4,
      cycle: 1.2,
      cost: {
        wood: 1
      },
      time: 40,
      tier: 1,
      style: "swing"
    },
    spear: {
      name: "Gi\xE1o g\u1ED7",
      type: "pierce",
      range: 1.5,
      damage: 7,
      cycle: 1.4,
      cost: {
        wood: 2
      },
      time: 60,
      tier: 1,
      style: "thrust"
    },
    mace: {
      name: "Ch\xF9y \u0111\xE1",
      type: "crush",
      range: 1,
      damage: 10,
      cycle: 1.8,
      cost: {
        wood: 2,
        stone: 2
      },
      time: 120,
      tier: 2,
      style: "swing"
    },
    hatchet: {
      name: "R\xECu \u0111\xE1",
      type: "slash",
      range: 1,
      damage: 8,
      cycle: 1.3,
      style: "swing",
      anims: { attack: "slash" },
      tier: 2
    },
    sling: {
      name: "D\xE2y qu\u0103ng \u0111\xE1",
      type: "crush",
      range: 7,
      damage: 5,
      cycle: 1.8,
      ranged: true,
      style: "sling",
      projectile: "stone",
      tier: 1
    },
    bow: {
      name: "Cung ng\u1EAFn",
      type: "pierce",
      range: 11,
      damage: 8,
      cycle: 2,
      ranged: true,
      style: "shoot",
      projectile: "arrow",
      tier: 1
    }
  },
  armor: {
    hide: {
      name: "\xC1o da th\xFA",
      pierce: 0.1,
      slash: 0.2,
      crush: 0.1,
      cost: {
        hide: 3
      },
      time: 100,
      tier: 1
    }
  },
  rules: {
    backstab: 1.25,
    strengthDamage: 0.6,
    agilityBase: 1.3,
    agilityStep: 0.04,
    rangedHitNear: 0.9,
    rangedHitFar: 0.7,
    downedSeconds: 30,
    rescueSeconds: 3,
    rescueHp: 0.3
  }
};

// src/sim/combat.ts
var STYLES = weapons_default.styles;
var WEAPONS = weapons_default.weapons;
function poseOf(weapon, state) {
  const w = weapon ? WEAPONS[weapon] : WEAPONS.fist;
  return w?.anims?.[state] ?? STYLES[w?.style ?? "fist"]?.[state] ?? STYLES.fist[state];
}
for (const id of Object.keys(WEAPONS)) WEAPONS[id].anim = poseOf(id, "attack");
var ARMORS = weapons_default.armor;
var RULES = weapons_default.rules;
var CRAFTED_WEAPONS = Object.keys(WEAPONS).filter((k) => WEAPONS[k].cost);
var SPECIES = Object.keys(animals_default).filter((k) => !k.startsWith("_") && k !== "behaviour");
var ANIMALS = Object.fromEntries(SPECIES.map((s) => [s, animals_default[s]]));
var BEHAVIOUR = animals_default.behaviour;
var TRIBE_IDS = ["spring", "axe", "swamp"];
var TRIBES = Object.fromEntries(TRIBE_IDS.map((t) => [t, tribes_default[t]]));
var RELATION = tribes_default.relation;
var HOSTILE_BELOW = RELATION.labels[1][0];
var SURRENDER = tribes_default.surrender;
var MORALE = tribes_default.morale;
var ringOf = (distance) => Math.max(1, Math.min(20, Math.ceil(distance / 4.8)));
var zoneOf = (distance) => Math.max(1, Math.min(4, Math.ceil(distance / 24)));
var ringPower = (ring) => 0.8 + 0.06 * (ring - 1);
var maxHpOf = (vit) => 40 + 8 * vit;
var cycleOf = (weaponCycle, agi) => weaponCycle * (RULES.agilityBase - RULES.agilityStep * agi);
function damageOf(w, strength, armor, backstab) {
  const base = w.damage + (w.ranged ? 0 : RULES.strengthDamage * strength);
  return base * (1 - (armor ? armor[w.type] : 0)) * (backstab ? RULES.backstab : 1);
}

// src/sim/world.ts
var Tile = { Grass: 0, Water: 1, Tree: 2, Rock: 3, Mud: 4, Bush: 5 };
var NODE_INFO = {
  tree: { res: "wood", max: 10 },
  rock: { res: "stone", max: 14 },
  bush: { res: "food", max: 6 }
};
var TILE_OF = { tree: Tile.Tree, rock: Tile.Rock, bush: Tile.Bush };
var World = class {
  constructor(seed) {
    this.seed = seed;
    this.size = MAP_SIZE;
    this.tiles = new Uint8Array(MAP_SIZE * MAP_SIZE);
    this.occ = new Uint8Array(MAP_SIZE * MAP_SIZE);
    // ô bị công trình chiếm
    this.decor = new Uint8Array(MAP_SIZE * MAP_SIZE);
    // 1 = gốc cây
    this.nodes = /* @__PURE__ */ new Map();
    this.start = { x: MAP_SIZE >> 1, y: MAP_SIZE >> 1 };
    this.season = "spring";
    const N = this.size;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d = Math.hypot(x - this.start.x, y - this.start.y);
        const elev = fbm(x / 26, y / 26, seed);
        const forest = fbm(x / 10, y / 10, seed + 7);
        let t = Tile.Grass;
        if (elev < 0.34 && d > 14) t = Tile.Water;
        else if (d > 6 && forest > 0.58 && hash2(x, y, seed + 3) < 0.5) t = Tile.Tree;
        else if (d > 5 && hash2(x, y, seed + 9) < 0.012) t = Tile.Rock;
        else if (d > 4 && hash2(x, y, seed + 13) < 0.012) t = Tile.Bush;
        else if (d > 8 && hash2(x, y, seed + 5) < 0.01) t = Tile.Tree;
        this.tiles[y * N + x] = t;
      }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (this.tiles[y * N + x] !== Tile.Grass) continue;
      let near2 = false;
      for (let dy = -1; dy <= 1 && !near2; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && this.tiles[ny * N + nx] === Tile.Water) {
          near2 = true;
          break;
        }
      }
      if (near2 && hash2(x, y, seed + 17) < 0.8) this.tiles[y * N + x] = Tile.Mud;
    }
    this.ensureNearStart("tree", 12, 6, 17, seed + 101);
    this.ensureNearStart("rock", 5, 6, 15, seed + 102);
    this.ensureNearStart("bush", 8, 5, 14, seed + 103);
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      const kind = t === Tile.Tree ? "tree" : t === Tile.Rock ? "rock" : t === Tile.Bush ? "bush" : null;
      if (kind) this.nodes.set(i, { kind, res: NODE_INFO[kind].res, amount: NODE_INFO[kind].max, max: NODE_INFO[kind].max, workers: 0, sides: 0, regrow: 0 });
    }
  }
  /** Bảo đảm có tối thiểu `count` nguồn loại `kind` quanh điểm khởi đầu. */
  ensureNearStart(kind, count, rMin, rMax, seed) {
    const N = this.size, tile = TILE_OF[kind], rnd = mulberry32(seed);
    let have = 0;
    for (let y = this.start.y - rMax; y <= this.start.y + rMax; y++) for (let x = this.start.x - rMax; x <= this.start.x + rMax; x++) {
      const d = Math.hypot(x - this.start.x, y - this.start.y);
      if (d >= rMin && d <= rMax && this.tiles[y * N + x] === tile) have++;
    }
    for (let tries = 0; have < count && tries < 600; tries++) {
      const a = rnd() * Math.PI * 2, r = rMin + rnd() * (rMax - rMin);
      const x = Math.round(this.start.x + Math.cos(a) * r), y = Math.round(this.start.y + Math.sin(a) * r);
      if (this.tiles[y * N + x] === Tile.Grass) {
        this.tiles[y * N + x] = tile;
        have++;
      }
    }
  }
  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }
  at(x, y) {
    return this.tiles[y * this.size + x];
  }
  isBlocked(x, y) {
    if (!this.inBounds(x, y)) return true;
    const i = y * this.size + x, t = this.tiles[i];
    return t !== Tile.Grass && t !== Tile.Mud || this.occ[i] !== 0;
  }
  nodeAt(x, y) {
    return this.inBounds(x, y) ? this.nodes.get(y * this.size + x) : void 0;
  }
  /** Cây và đá cạn thì ô trở lại thành cỏ (cây để lại gốc); bụi quả giữ nguyên và mọc lại. */
  depleted(idx) {
    const n = this.nodes.get(idx);
    if (!n) return;
    if (n.kind === "bush") {
      n.amount = 0;
      n.regrow = 240;
      return;
    }
    this.nodes.delete(idx);
    this.tiles[idx] = Tile.Grass;
    if (n.kind === "tree") this.decor[idx] = 1;
  }
  /** Winter: bushes go bare and stop regrowing. Spring: they flower and fruit again after 1–3 min (staggered per tile). */
  setSeason(season) {
    const prev = this.season;
    this.season = season;
    if (season === prev) return;
    for (const [idx, n] of this.nodes) {
      if (n.kind !== "bush") continue;
      if (season === "winter") {
        n.amount = 0;
        n.regrow = 0;
      } else if (prev === "winter") {
        n.amount = 0;
        n.regrow = 60 + 120 * hash2(idx % this.size, idx / this.size | 0, this.seed + 29);
      }
    }
  }
  tick(dt) {
    if (this.season === "winter") return;
    for (const n of this.nodes.values()) {
      if (n.kind === "bush" && n.amount === 0 && n.regrow > 0) {
        n.regrow -= dt;
        if (n.regrow <= 0) {
          n.amount = n.max;
          n.regrow = 0;
        }
      }
    }
  }
};

// src/sim/fauna.ts
var animalDef = (a) => ANIMALS[a.species];
var isGround = (sim, x, y) => {
  if (!sim.world.inBounds(x, y)) return false;
  const t = sim.world.at(x, y);
  return (t === Tile.Grass || t === Tile.Mud) && !sim.world.occ[y * sim.world.size + x];
};
var isWater = (sim, x, y) => sim.world.inBounds(x, y) && sim.world.at(x, y) === Tile.Water;
var habitable = (sim, def, x, y) => def.habitat === "water" ? isWater(sim, x, y) : isGround(sim, x, y);
function populate(sim) {
  const N = sim.world.size, s = sim.world.start, rnd = sim.frnd;
  let herd = 1;
  for (const sp of SPECIES) {
    const def = ANIMALS[sp];
    let made = 0, guard = 0;
    while (made < def.count && guard++ < def.count * 60) {
      const x = Math.floor(rnd() * N), y = Math.floor(rnd() * N), d = Math.hypot(x - s.x, y - s.y);
      const z = zoneOf(d);
      if (d < 16 && def.habitat !== "water" || z < def.zones[0] || z > def.zones[1] || !habitable(sim, def, x, y)) continue;
      const size = Math.min(def.count - made, def.herd[0] + Math.floor(rnd() * (def.herd[1] - def.herd[0] + 1)));
      for (let i = 0; i < size; i++) {
        const ax = x + (rnd() - 0.5) * 4, ay = y + (rnd() - 0.5) * 4;
        if (!habitable(sim, def, Math.floor(ax), Math.floor(ay))) continue;
        spawnAnimal(sim, sp, ax, ay, herd);
        made++;
      }
      herd++;
    }
  }
}
function spawnAnimal(sim, species, x, y, herd, raid = false) {
  const def = ANIMALS[species];
  const a = {
    id: sim.nextAid++,
    species,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    state: "graze",
    dir: sim.frnd() < 0.5 ? 1 : -1,
    dest: null,
    timer: 2 + sim.frnd() * 6,
    cd: 0,
    scan: sim.frnd() * 0.5,
    target: null,
    herd,
    home: { x, y },
    burst: 0,
    tired: 0,
    female: sim.frnd() < 0.5,
    raid,
    bite: 0,
    clock: sim.frnd() * 10,
    meat: 0,
    hide: 0,
    drops: {},
    carcass: 0
  };
  sim.animals.push(a);
  sim.animalById.set(a.id, a);
  return a;
}
function step(sim, a, tx, ty, speed, dt) {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return true;
  const k = Math.min(d, speed * dt) / d, sx = dx * k, sy = dy * k, w = sim.world, water = ANIMALS[a.species].habitat === "water";
  const fear = ANIMALS[a.species].fearsFire;
  if (fear) {
    const nf = fireDistance(sim, a.x + sx, a.y + sy);
    if (nf < fear && nf < fireDistance(sim, a.x, a.y)) return false;
  }
  const free = (x, y) => water ? isWater(sim, Math.floor(x), Math.floor(y)) : w.inBounds(Math.floor(x), Math.floor(y)) && !w.isBlocked(Math.floor(x), Math.floor(y));
  let moved = true;
  if (free(a.x + sx, a.y + sy)) {
    a.x += sx;
    a.y += sy;
  } else if (free(a.x + sx, a.y)) a.x += sx;
  else if (free(a.x, a.y + sy)) a.y += sy;
  else moved = false;
  if (Math.abs(sx) > 1e-3) a.dir = sx > 0 ? 1 : -1;
  return moved;
}
var near = (sim, x, y) => {
  let best = null;
  for (const v of sim.villagers) {
    if (v.down > 0 || v.inside !== null) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (!best || d < best.d) best = { id: v.id, d };
  }
  return best;
};
function fireDistance(sim, x, y) {
  let best = Infinity;
  for (const b of sim.buildings) if (b.kind === "campfire" && b.done) best = Math.min(best, Math.hypot(b.x + 1 - x, b.y + 1 - y));
  return best;
}
function wanderTo(sim, a, radius) {
  const def = animalDef(a);
  if (def.habitat === "water") radius = 4;
  for (let i = 0; i < 6; i++) {
    const ang = sim.frnd() * Math.PI * 2, r = 2 + sim.frnd() * radius;
    const x = a.home.x + Math.cos(ang) * r, y = a.home.y + Math.sin(ang) * r;
    if (habitable(sim, def, Math.floor(x), Math.floor(y))) {
      a.dest = { x, y };
      return;
    }
  }
  a.dest = null;
}
function provoke(sim, a, byId) {
  if (a.state === "dead") return;
  const def = animalDef(a);
  if (def.defends || def.aggro > 0 || def.cornered && a.tired > 0) {
    a.state = "attack";
    a.target = { kind: "unit", id: byId };
    a.timer = 14;
  } else {
    a.state = "flee";
    a.target = { kind: "unit", id: byId };
    a.timer = 8;
  }
  for (const o of sim.animals) {
    if (o !== a && o.herd === a.herd && o.state !== "dead" && o.state !== "attack" && Math.hypot(o.x - a.x, o.y - a.y) < 9 && !animalDef(o).defends) {
      o.state = "flee";
      o.target = { kind: "unit", id: byId };
      o.timer = 6;
    }
  }
}
function tickAnimals(sim, dt) {
  const night = sim.restTime;
  for (let i = sim.animals.length - 1; i >= 0; i--) {
    const a = sim.animals[i];
    a.clock += dt;
    if (a.state === "dead") {
      a.carcass -= dt;
      if (a.carcass <= 0 || carcassEmpty(a)) {
        sim.animals.splice(i, 1);
        sim.animalById.delete(a.id);
      }
      continue;
    }
    const def = animalDef(a);
    a.timer -= dt;
    a.cd = Math.max(0, a.cd - dt);
    a.scan -= dt;
    a.bite = Math.max(0, a.bite - dt);
    if (a.tired > 0) a.tired -= dt;
    const slow = a.tired > 0 ? BEHAVIOUR.tiredSpeed : 1;
    if (a.scan <= 0) {
      a.scan = 0.3 + sim.frnd() * 0.2;
      const p = near(sim, a.x, a.y);
      if (def.prey && def.flee > 0 && a.state !== "flee" && p && p.d < def.flee && !def.defends) {
        a.state = "flee";
        a.target = { kind: "unit", id: p.id };
        a.timer = 6;
        a.burst = 0;
      }
      if (def.aggro > 0 && a.state !== "attack" && p && (a.raid || night && def.nocturnal) && p.d < (a.raid ? 40 : def.aggro)) {
        const v = sim.get(p.id);
        if (fireDistance(sim, v.x, v.y) > (def.fearsFire ?? 0)) {
          a.state = "attack";
          a.target = { kind: "unit", id: p.id };
          a.timer = 20;
        }
      }
    }
    switch (a.state) {
      case "flee": {
        const t = a.target && sim.get(a.target.id);
        if (!t || a.timer <= 0 || Math.hypot(t.x - a.x, t.y - a.y) > def.flee * 2) {
          a.state = "graze";
          a.timer = 3;
          a.target = null;
          a.dest = null;
          break;
        }
        a.burst += dt;
        if (a.burst > BEHAVIOUR.fleeBurst && a.tired <= 0) {
          a.tired = BEHAVIOUR.tiredSeconds;
          a.burst = 0;
        }
        const ax = a.x - t.x, ay = a.y - t.y, d = Math.hypot(ax, ay) || 1;
        const ok2 = step(sim, a, a.x + ax / d * 5, a.y + ay / d * 5, def.speed * slow, dt);
        if (!ok2) {
          step(sim, a, a.x - ay / d * 5, a.y + ax / d * 5, def.speed * slow, dt);
          if (def.cornered && d < 1.4 && a.cd <= 0) {
            a.cd = def.cycle;
            a.bite = 0.25;
            sim.hurt({ kind: "unit", id: t.id }, def.damage, def.type, { x: a.x, y: a.y }, { animal: a });
          }
        }
        break;
      }
      case "attack": {
        const t = a.target && sim.get(a.target.id);
        const lost = !t || t.down > 0 || a.timer <= 0 || !a.raid && Math.hypot(t.x - a.x, t.y - a.y) > 16;
        if (lost) {
          a.state = "graze";
          a.target = null;
          a.timer = 3;
          if (a.raid && t === void 0) a.timer = 1;
          break;
        }
        const d = Math.hypot(t.x - a.x, t.y - a.y);
        if (def.fearsFire && fireDistance(sim, t.x, t.y) <= def.fearsFire && fireDistance(sim, a.x, a.y) < def.fearsFire + 1.5) {
          step(sim, a, a.home.x, a.home.y, def.speed, dt);
          break;
        }
        if (d > def.range + 0.4) step(sim, a, t.x, t.y, def.speed * slow, dt);
        else if (a.cd <= 0) {
          a.cd = def.cycle;
          a.bite = 0.25;
          const behind = t.facing === "right" && a.x < t.x || t.facing === "left" && a.x > t.x;
          sim.hurt({ kind: "unit", id: t.id }, def.damage * (behind ? 1.25 : 1), def.type, { x: a.x, y: a.y }, { animal: a });
        }
        break;
      }
      case "sleep":
        if (!night || !def.nocturnal) {
          if (a.timer <= 0) {
            a.state = "graze";
            a.timer = 2;
          }
        }
        break;
      case "wander": {
        if (!a.dest || !step(sim, a, a.dest.x, a.dest.y, def.speed * 0.45, dt) || Math.hypot(a.dest.x - a.x, a.dest.y - a.y) < 0.3) {
          a.state = "graze";
          a.timer = 3 + sim.frnd() * 8;
          a.dest = null;
        }
        break;
      }
      default: {
        if (a.raid && !night) {
          step(sim, a, a.home.x, a.home.y, def.speed, dt);
          if (Math.hypot(a.home.x - a.x, a.home.y - a.y) < 2) {
            sim.animals.splice(i, 1);
            sim.animalById.delete(a.id);
          }
          break;
        }
        if (a.timer <= 0) {
          if (def.nocturnal && !night && !a.raid) {
            a.state = "sleep";
            a.timer = 4;
            break;
          }
          a.state = "wander";
          wanderTo(sim, a, BEHAVIOUR.regionRadius);
          if (a.raid && night) {
            const p = near(sim, a.x, a.y);
            if (p) a.dest = { x: sim.get(p.id).x, y: sim.get(p.id).y };
          }
        }
      }
    }
  }
}
var carcassEmpty = (a) => a.meat <= 0 && a.hide <= 0 && !Object.values(a.drops ?? {}).some((n) => (n ?? 0) > 0);
function die(sim, a) {
  const def = animalDef(a);
  a.state = "dead";
  a.hp = 0;
  a.target = null;
  a.meat = def.meat;
  a.hide = def.hide;
  a.drops = { ...def.drops ?? {} };
  a.carcass = BEHAVIOUR.carcassSeconds;
}

// src/sim/battle.ts
var ANIM = anims_default;
function swingTimes(anim) {
  const a = ANIM[anim];
  return { hitAt: (a?.hit ?? 2) / (a?.fps ?? 10), end: (a?.frames.length ?? 6) / (a?.fps ?? 10) };
}
var entX = (e) => e.kind === "unit" ? e.v.x : e.a.x;
var entY = (e) => e.kind === "unit" ? e.v.y : e.a.y;
function resolve(sim, t) {
  if (!t) return null;
  if (t.kind === "unit") {
    const v = sim.get(t.id);
    return v && v.health > 0 && v.down <= 0 ? { kind: "unit", v } : null;
  }
  const a = sim.animalById.get(t.id);
  return a && a.state !== "dead" ? { kind: "animal", a } : null;
}
var weaponOf = (v) => WEAPONS[v.weapon ?? "fist"] ?? WEAPONS.fist;
var armorOf = (v) => v.armor ? ARMORS[v.armor] ?? null : null;
var isFighter = (v) => v.job === "fight" || v.job === "hunt" || v.fight.mode !== "none";
function teamsHostile(sim, a, b) {
  if (a === b || a === "wild" || b === "wild") return false;
  if (a === "player") return sim.tribeHostile(b);
  if (b === "player") return sim.tribeHostile(a);
  return false;
}
function threatsOf(sim, v, radius) {
  const out = [], N = sim.world.size, player = v.team === "player";
  const seen = (x, y) => !player || sim.fog.state[Math.floor(y) * N + Math.floor(x)] === 2;
  const pool = player ? sim.foes : sim.villagers;
  for (const o of pool) {
    if (o.health <= 0 || o.down > 0 || o.inside !== null || !teamsHostile(sim, v.team, o.team)) continue;
    const d = Math.hypot(o.x - v.x, o.y - v.y);
    if (d <= radius && seen(o.x, o.y)) out.push({ t: { kind: "unit", id: o.id }, x: o.x, y: o.y, d, name: o.name });
  }
  if (player) for (const a of sim.animals) {
    if (a.state === "dead") continue;
    const def = animalDef(a);
    if (!(a.state === "attack" || def.aggro > 0)) continue;
    const d = Math.hypot(a.x - v.x, a.y - v.y);
    if (d <= radius && seen(a.x, a.y)) out.push({ t: { kind: "animal", id: a.id }, x: a.x, y: a.y, d, name: def.name });
  }
  return out.sort((p, q) => p.d - q.d);
}
function hurt(sim, target, dmg, type, from, src) {
  if (target.kind === "animal") {
    const a = sim.animalById.get(target.id);
    if (!a || a.state === "dead") return;
    a.hp -= dmg;
    if (a.hp <= 0) {
      die(sim, a);
      sim.onKill?.();
      if (src.unit?.team === "player" && a.species === "wolf") sim.say("M\u1ED9t con s\xF3i \u0111\xE3 b\u1ECB h\u1EA1.");
    } else if (src.unit) provoke(sim, a, src.unit.id);
    return;
  }
  const v = sim.get(target.id);
  if (!v || v.health <= 0) return;
  if (sim.dev.god && v.team === "player") return;
  const armor = armorOf(v), final = dmg * (1 - (armor ? armor[type] : 0));
  v.health -= final;
  v.calm = 0;
  v.flinch = 0.3;
  const behind = v.facing === "right" && from.x < v.x || v.facing === "left" && from.x > v.x;
  if (behind) v.morale = Math.max(0, v.morale + MORALE.backstab);
  if (src.unit && src.unit.team === "player" && v.team !== "player") sim.tribeAttacked(v.team, v);
  if (v.health > 0) {
    if (!v.fight.target && src.unit && v.team !== "player") v.fight.target = { kind: "unit", id: src.unit.id };
    else if (!v.fight.target && src.animal && v.team !== "player") v.fight.target = { kind: "animal", id: src.animal.id };
    return;
  }
  if (v.team === "player") downUnit(sim, v);
  else sim.killFoe(v, src.unit);
}
function downUnit(sim, v) {
  sim.resetTask(v);
  v.queue.length = 0;
  v.health = 0;
  v.down = RULES.downedSeconds;
  v.rescue = 0;
  v.phase = "down";
  v.swing = null;
  sim.say(`${v.name} b\u1ECB th\u01B0\u01A1ng n\u1EB7ng, ng\xE3 xu\u1ED1ng! C\u1EA7n c\xF3 ng\u01B0\u1EDDi k\xE9o d\u1EADy trong ${gameDays(RULES.downedSeconds)}.`);
  moraleShock(sim, v, MORALE.allyDeath * 0.6);
}
function moraleShock(sim, who, amount) {
  const pool = who.team === "player" ? sim.villagers : sim.foes.filter((f) => f.team === who.team);
  for (const o of pool) if (o !== who && o.health > 0 && Math.hypot(o.x - who.x, o.y - who.y) < 8) o.morale = Math.max(0, Math.min(100, o.morale + amount));
}
function startSwing(sim, v, target) {
  const w = weaponOf(v), { hitAt, end } = swingTimes(w.anim);
  v.swing = { t: 0, hitAt, end, target };
  v.atkCd = cycleOf(w.cycle, v.stats.agi);
  v.anim = w.anim;
  v.animClock = 0;
  const e = resolve(sim, target);
  if (e) v.facing = entX(e) >= v.x ? "right" : "left";
}
function resolveSwing(sim, v, target) {
  const e = resolve(sim, target);
  if (!e) return;
  const w = weaponOf(v), d = Math.hypot(entX(e) - v.x, entY(e) - v.y);
  if (w.ranged) {
    if (d > w.range + 1) return;
    sim.projectiles.push({ x: v.x, y: v.y - 0.4, tx: entX(e), ty: entY(e), speed: 14, dmg: w.damage, type: w.type, from: { x: v.x, y: v.y }, src: v.id, team: v.team, target, chance: d <= w.range / 2 ? RULES.rangedHitNear : RULES.rangedHitFar, kind: w.projectile ?? "stone" });
    return;
  }
  if (d > w.range + 1.1) return;
  let behind = false;
  if (e.kind === "unit") behind = e.v.facing === "right" && v.x < e.v.x || e.v.facing === "left" && v.x > e.v.x;
  else behind = e.a.dir === 1 && v.x < e.a.x || e.a.dir === -1 && v.x > e.a.x;
  hurt(sim, target, damageOf(w, v.stats.str, null, behind), w.type, { x: v.x, y: v.y }, { unit: v });
}
function tickProjectiles(sim, dt) {
  for (let i = sim.projectiles.length - 1; i >= 0; i--) {
    const p = sim.projectiles[i], dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step2 = p.speed * dt;
    if (d > step2) {
      p.x += dx / d * step2;
      p.y += dy / d * step2;
      continue;
    }
    sim.projectiles.splice(i, 1);
    const e = resolve(sim, p.target);
    if (!e || Math.hypot(entX(e) - p.tx, entY(e) - p.ty) > 1.4 || sim.frnd() > p.chance) continue;
    const src = sim.get(p.src);
    hurt(sim, p.target, p.dmg + (src ? RULES.strengthDamage * 0 : 0), p.type, p.from, { unit: src });
  }
}
function tickCommon(sim, v, dt) {
  v.atkCd = Math.max(0, v.atkCd - dt);
  v.calm += dt;
  if (v.flinch > 0) v.flinch -= dt;
  if (v.swing) {
    const s = v.swing, before = s.t;
    s.t += dt;
    if (before < s.hitAt && s.t >= s.hitAt) resolveSwing(sim, v, s.target);
    if (s.t >= s.end) v.swing = null;
  }
}
function tickMorale(sim, v) {
  const near2 = threatsOf(sim, v, 9);
  const allies = (v.team === "player" ? sim.villagers : sim.foes.filter((f) => f.team === v.team)).filter((o) => o !== v && o.health > 0 && o.down <= 0 && Math.hypot(o.x - v.x, o.y - v.y) < 8).length;
  let m = v.morale;
  if (near2.length) {
    m += near2.length > allies + 1 ? MORALE.outnumbered : near2.length < allies ? MORALE.outnumbering : 0;
  } else m += (MORALE.start - m) * 0.04 + MORALE.calm;
  if (sim.nearHome(v)) m += MORALE.nearHome * (near2.length ? 1 : 0.2);
  if (v.team === "player" && sim.restTime && !sim.nearHome(v)) m += MORALE.night;
  if (v.leader) m += 0.2;
  else {
    const lead = (v.team === "player" ? sim.villagers : sim.foes.filter((f) => f.team === v.team)).find((o) => o.leader && o.health > 0 && Math.hypot(o.x - v.x, o.y - v.y) < 8);
    if (lead) m += MORALE.leaderNear;
    else if (allies >= 4) m += MORALE.leaderFar;
  }
  v.morale = Math.max(0, Math.min(100, m));
}
function tickDown(sim, v, dt) {
  v.down -= dt;
  v.hold = null;
  v.path = [];
  v.slide = null;
  const helper = sim.villagers.some((o) => o !== v && o.health > 0 && o.down <= 0 && o.phase !== "flee" && Math.hypot(o.x - v.x, o.y - v.y) < 1.6);
  v.rescue = helper ? v.rescue + dt : Math.max(0, v.rescue - dt);
  if (v.rescue >= RULES.rescueSeconds) {
    v.down = 0;
    v.rescue = 0;
    v.health = v.maxHealth * RULES.rescueHp;
    v.phase = "idle";
    v.morale = Math.max(v.morale, 40);
    sim.say(`${v.name} \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u1EE1 d\u1EADy.`);
    return;
  }
  if (v.down <= 0) sim.killUnit(v, "v\xEC v\u1EBFt th\u01B0\u01A1ng");
}
var SIGHT = 8;
var DEFENSIVE = 4.5;
function brainPlayer(sim, v, dt) {
  if (v.phase === "goStore" || v.phase === "goEquip") return false;
  const rest = v.phase === "sleep" || v.phase === "goHome";
  v.fight.scan -= dt;
  const scanNow = v.fight.scan <= 0;
  if (scanNow) v.fight.scan = 0.35;
  const threats = scanNow || v.phase === "flee" || v.phase === "fight" ? threatsOf(sim, v, SIGHT + 2) : [];
  if (rest) {
    if (scanNow && threats.length && threats[0].d < 7) {
      if (isFighter(v)) v.nightOwl = true;
      sim.resetTask(v);
    } else return false;
  }
  if (v.phase === "flee" || v.fleeT > 0 || v.morale < MORALE.flee && threats.length) return fleeBrain(sim, v, dt, threats);
  const fighter = isFighter(v);
  if (!fighter) {
    if (threats.length && threats[0].d < 6 && v.phase !== "fight") {
      startFlee(sim, v, 8);
      return true;
    }
    return assistBrain(sim, v);
  }
  return fightBrain(sim, v, dt, threats);
}
function startFlee(sim, v, secs) {
  const keep = v.job, nightOwl = v.nightOwl;
  sim.resetTask(v);
  v.job = keep;
  v.nightOwl = nightOwl;
  v.fight.target = null;
  if (v.fight.mode === "attack") v.fight.mode = "none";
  v.phase = "flee";
  v.fleeT = secs;
  const fire = sim.campfire();
  if (fire) v.path = sim.pathTo(v, Math.floor(fire.x + 1), Math.floor(fire.y + 2), 4e3);
}
function fleeBrain(sim, v, dt, threats) {
  if (v.phase !== "flee") {
    startFlee(sim, v, 8);
    return true;
  }
  v.fleeT -= dt;
  if (threats.length && threats[0].d < 6) v.fleeT = Math.max(v.fleeT, 3);
  if (!v.path.length && sim.campfire() && Math.hypot(v.x - sim.campfire().x - 1, v.y - sim.campfire().y - 1) > 3) {
    const f = sim.campfire();
    v.path = sim.pathTo(v, Math.floor(f.x + 1), Math.floor(f.y + 2), 4e3);
  }
  if (v.fleeT <= 0 && v.morale >= MORALE.fleeRecover - 10) {
    v.phase = "idle";
    v.fleeT = 0;
    v.path = [];
    return false;
  }
  return true;
}
function assistBrain(sim, v) {
  if (v.phase === "rescue") {
    const t = sim.get(v.target);
    if (!t || t.down <= 0) {
      v.phase = "idle";
      v.target = -1;
      return false;
    }
    if (Math.hypot(t.x - v.x, t.y - v.y) < 1.4) {
      v.path = [];
      return true;
    }
    if (!v.path.length) v.path = sim.pathTo(v, Math.floor(t.x), Math.floor(t.y), 3e3);
    return true;
  }
  if (v.phase === "sleep" || v.phase === "goHome") return false;
  const down = sim.villagers.find((o) => o !== v && o.down > 0 && Math.hypot(o.x - v.x, o.y - v.y) < 14);
  if (down && v.health > 0) {
    const keep = v.job, owl = v.nightOwl;
    sim.resetTask(v);
    v.job = keep;
    v.nightOwl = owl;
    v.phase = "rescue";
    v.target = down.id;
    v.path = sim.pathTo(v, Math.floor(down.x), Math.floor(down.y), 3e3);
    return true;
  }
  return false;
}
function engage(sim, v, e, dt) {
  const w = weaponOf(v), x = entX(e), y = entY(e), d = Math.hypot(x - v.x, y - v.y);
  const reach = w.ranged ? w.range : w.range + (e.kind === "animal" ? 0.45 : 0.5);
  v.phase = "fight";
  if (d <= reach) {
    v.path = [];
    v.slide = null;
    v.facing = x >= v.x ? "right" : "left";
    if (!v.swing && v.atkCd <= 0) startSwing(sim, v, e.kind === "unit" ? { kind: "unit", id: e.v.id } : { kind: "animal", id: e.a.id });
    return;
  }
  if (v.swing) return;
  v.fight.repath -= dt;
  if (v.fight.repath <= 0 || !v.path.length) {
    v.fight.repath = 0.5;
    v.path = sim.pathTo(v, Math.floor(x), Math.floor(y), 3500);
    if (!v.path.length) v.fight.repath = 1.5;
  }
}
function fightBrain(sim, v, dt, threats) {
  const f = v.fight;
  if (v.phase === "skin" || v.phase === "goCarcass") return huntBrain(sim, v, dt, threats);
  if (f.mode === "hold" && !f.anchor) f.anchor = { x: v.x, y: v.y };
  if (!threats.length && !f.target && v.phase !== "fight" && (sim.planEquipGear(v) || sim.planGearErrand(v))) return true;
  if (v.stance === "retreat" && f.mode !== "attack" && f.target) f.target = null;
  if (f.target) {
    const e = resolve(sim, f.target);
    if (e) {
      if (f.mode === "hold" && f.anchor && Math.hypot(entX(e) - f.anchor.x, entY(e) - f.anchor.y) > weaponOf(v).range + 2) {
        f.target = null;
      } else {
        engage(sim, v, e, dt);
        return true;
      }
    } else {
      const dead = f.target.kind === "animal" ? sim.animalById.get(f.target.id) : void 0;
      f.target = null;
      if (f.mode === "attack") {
        if (v.job === "fight") {
          f.mode = "guard";
          f.anchor = { x: v.x, y: v.y };
        } else f.mode = "none";
      }
      if (dead && dead.state === "dead" && v.job === "hunt") v.loot = dead.id;
      if (v.phase === "fight") {
        v.phase = "idle";
        v.path = [];
      }
      if (sim.nextOrder(v)) return true;
    }
  }
  if (v.stance === "retreat") {
    if (threats.length && threats[0].d < 8) {
      startFlee(sim, v, 6);
      return true;
    }
  } else if (threats.length && f.scan >= 0) {
    const range = f.mode === "hold" ? weaponOf(v).range + 1.5 : v.stance === "defensive" ? DEFENSIVE : SIGHT;
    const pick = threats.find((t) => t.d <= range && (!f.anchor || v.stance !== "defensive" || Math.hypot(t.x - f.anchor.x, t.y - f.anchor.y) < DEFENSIVE + 2));
    if (pick) {
      f.target = pick.t;
      const e = resolve(sim, pick.t);
      if (e) {
        engage(sim, v, e, dt);
        return true;
      }
    }
  }
  if (f.mode === "attackMove" && f.dest) {
    if (Math.hypot(f.dest.x - v.x, f.dest.y - v.y) < 1.5) {
      f.mode = "guard";
      f.anchor = { x: f.dest.x, y: f.dest.y };
      f.dest = null;
      v.path = [];
      v.phase = "idle";
      if (sim.nextOrder(v)) return true;
    } else {
      if (!v.path.length) v.path = sim.pathTo(v, Math.floor(f.dest.x), Math.floor(f.dest.y), 2e4);
      v.phase = "move";
      return true;
    }
  }
  if (f.mode === "hold") {
    v.phase = "idle";
    v.path = [];
    return true;
  }
  if (v.job === "hunt") return huntBrain(sim, v, dt, threats);
  if (v.phase === "fight") {
    v.phase = "idle";
    v.path = [];
  }
  if (v.job === "fight") {
    const fire = sim.campfire(), post = f.mode === "guard" && f.anchor ? { x: f.anchor.x, y: f.anchor.y, slack: 2 } : fire ? { x: fire.x + 1 + v.id % 3 - 1, y: fire.y + 3, slack: 5 } : null;
    if (post && v.phase === "idle" && !v.path.length && Math.hypot(v.x - post.x, v.y - post.y) > post.slack) {
      v.path = sim.pathTo(v, Math.floor(post.x), Math.floor(post.y), 4e3);
      v.phase = "move";
      return true;
    }
    return v.phase === "move" || v.phase === "idle";
  }
  return false;
}
function huntBrain(sim, v, dt, threats) {
  if (v.phase === "skin") {
    v.timer -= dt;
    v.anim = "build";
    if (v.timer > 0) return true;
    const a = sim.animalById.get(v.loot);
    v.phase = "idle";
    v.loot = -1;
    if (!a) return true;
    const have = v.carry && v.carry.res === "food" ? v.carry.amount : 0, take = Math.min(a.meat, CARRY_CAP.food - have);
    if (take > 0) {
      a.meat -= take;
      v.carry = { res: "food", amount: have + take };
    }
    const got = [];
    if (a.hide > 0) {
      sim.stock.hide = Math.min(sim.capacity(), sim.stock.hide + a.hide);
      got.push(`${a.hide} ${RES_NAME.hide.toLowerCase()}`);
      a.hide = 0;
    }
    for (const [res, n] of Object.entries(a.drops ?? {})) {
      if (!(n > 0)) continue;
      sim.stock[res] = Math.min(sim.capacity(), sim.stock[res] + n);
      got.push(`${n} ${RES_NAME[res].toLowerCase()}`);
    }
    a.drops = {};
    if (got.length) sim.say(`${v.name} x\u1EBB ${animalDef(a).name.toLowerCase()}: ${got.join(", ")}.`);
    return true;
  }
  if (v.phase === "goCarcass") {
    const a = sim.animalById.get(v.loot);
    if (!a || a.state !== "dead" || carcassEmpty(a)) {
      v.phase = "idle";
      v.loot = -1;
      v.path = [];
      return true;
    }
    if (Math.hypot(a.x - v.x, a.y - v.y) < 1.5) {
      v.path = [];
      v.phase = "skin";
      v.timer = BEHAVIOUR.skinSeconds;
      v.facing = a.x >= v.x ? "right" : "left";
      return true;
    }
    if (!v.path.length) {
      v.path = sim.pathTo(v, Math.floor(a.x), Math.floor(a.y), 3e3);
      if (!v.path.length) {
        v.phase = "idle";
        v.loot = -1;
      }
    }
    return true;
  }
  if (v.phase === "move" && v.path.length) return true;
  if (v.carry && v.carry.amount >= CARRY_CAP[v.carry.res]) {
    sim.planDeliver(v);
    return true;
  }
  const N = sim.world.size;
  let best = null, bd = 45;
  if (v.loot >= 0) {
    const a = sim.animalById.get(v.loot);
    if (a && a.state === "dead") best = a;
    else v.loot = -1;
  }
  if (!best) for (const a of sim.animals) {
    if (a.state !== "dead" || carcassEmpty(a) || sim.fog.state[Math.floor(a.y) * N + Math.floor(a.x)] === 0) continue;
    const d = Math.hypot(a.x - v.x, a.y - v.y);
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  if (best) {
    v.loot = best.id;
    v.phase = "goCarcass";
    v.path = sim.pathTo(v, Math.floor(best.x), Math.floor(best.y), 3e3);
    return true;
  }
  if (!threats.length) {
    let prey = null;
    bd = 40;
    for (const a of sim.animals) {
      const def = animalDef(a);
      if (a.state === "dead" || !def.prey || sim.fog.state[Math.floor(a.y) * N + Math.floor(a.x)] === 0) continue;
      if (def.defends && !sim.packNear(v, a)) continue;
      const d = Math.hypot(a.x - v.x, a.y - v.y);
      if (d < bd) {
        bd = d;
        prey = a;
      }
    }
    if (prey) {
      v.fight.target = { kind: "animal", id: prey.id };
      engage(sim, v, { kind: "animal", a: prey }, 0);
      return true;
    }
  }
  if (v.carry && v.carry.amount > 0) {
    sim.planDeliver(v);
    return true;
  }
  if (v.phase === "fight") {
    v.phase = "idle";
    v.path = [];
  }
  sim.wait(v, 2);
  return true;
}
function bestWeapon(sim, v) {
  const score = (id) => {
    const w = WEAPONS[id];
    return (w.damage + RULES.strengthDamage * v.stats.str) / cycleOf(w.cycle, v.stats.agi) + (w.range > 1 ? 1 : 0);
  };
  const cur = v.weapon ? score(v.weapon) : score("fist");
  let best = null, bs = cur;
  for (const id of CRAFTED_WEAPONS) {
    if (sim.toolCount(id, WEAPONS[id].tier ?? 1) <= 0) continue;
    if (id === "mace" && v.job !== "fight") continue;
    if (score(id) > bs) {
      bs = score(id);
      best = id;
    }
  }
  return best;
}

// src/data/events.json
var events_default = {
  _note: "day = first day of the window in the game year (year 2 adds 20). The event fires at a random day in [day, day + spread]. warnDays: how long before the first hint. size is capped by what the source really has.",
  events: [
    { id: "wolves_summer", kind: "wolves", day: 6, spread: 2, size: 4, night: true, warn: "Ti\u1EBFng h\xFA vang l\xEAn t\u1EEB xa trong \u0111\xEAm..." },
    { id: "axe_scout", kind: "raid", tribe: "axe", day: 10, spread: 2, size: 5, night: false, warnDays: 1, warn: "Kh\xF3i b\u1ED1c l\xEAn t\u1EEB ph\xEDa t\u1ED9c R\xECu \u0110\xE1, c\xF3 l\u1EBD h\u1ECD \u0111ang c\u1EED ng\u01B0\u1EDDi d\xF2 x\xE9t." },
    { id: "wolves_winter", kind: "wolves", day: 16, spread: 4, size: 8, night: true, warn: "D\u1EA5u ch\xE2n s\xF3i \u0111\u1EA7y quanh l\xE0ng." },
    { id: "swamp_raid", kind: "raid", tribe: "swamp", day: 21, spread: 4, size: 8, night: true, warnDays: 0, warn: "" },
    { id: "axe_war", kind: "raid", tribe: "axe", day: 26, spread: 4, size: 18, night: false, warnDays: 1, warn: "Ti\u1EBFng tr\u1ED1ng chi\u1EBFn vang l\xEAn: t\u1ED9c R\xECu \u0110\xE1 s\u1EAFp \u0111\xE1nh l\u1EDBn." }
  ]
};

// src/sim/tribes.ts
var tribeOf = (sim, id) => sim.tribes.find((t) => t.id === id);
function spawnTribes(sim) {
  for (const id of TRIBE_IDS) spawnTribe(sim, id);
  initEvents(sim);
}
function campFits(sim, cx, cy) {
  const w = sim.world, r = 7;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (!w.inBounds(x, y)) return false;
    if (Math.hypot(x - cx, y - cy) <= r && w.at(x, y) === Tile.Water) return false;
  }
  return true;
}
function spawnTribe(sim, id) {
  const def = TRIBES[id], w = sim.world, s = w.start, N = w.size;
  let cx = -1, cy = -1;
  search: for (let dd = 0; dd <= 24; dd += 3) for (const sign of dd ? [1, -1] : [1]) for (let da = 0; da <= 90; da += 15) for (const as of da ? [1, -1] : [1]) {
    const ang = (def.angle + da * as) * Math.PI / 180, d = def.distance + dd * sign;
    const x = Math.round(s.x + Math.cos(ang) * d), y = Math.round(s.y + Math.sin(ang) * d);
    if (x > 9 && y > 9 && x < N - 9 && y < N - 9 && campFits(sim, x, y)) {
      cx = x;
      cy = y;
      break search;
    }
  }
  if (cx < 0) return;
  for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) {
    if (Math.hypot(x - cx, y - cy) > 6.5) continue;
    const i = y * N + x;
    w.nodes.delete(i);
    w.tiles[i] = Tile.Grass;
    w.decor[i] = 0;
  }
  const props = [
    { x: cx, y: cy, w: 2, h: 2, kind: "fire" },
    { x: cx - 5, y: cy - 1, w: 2, h: 2, kind: "pile" },
    { x: cx + 4, y: cy + 1, w: 2, h: 2, kind: "pile" }
  ];
  for (const p of props) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) w.occ[(p.y + j) * N + p.x + i] = 1;
  const power = ringPower(ringOf(Math.hypot(cx - s.x, cy - s.y)));
  const camp = { x: cx + 1, y: cy + 1 };
  const tribe = {
    id,
    def,
    camp,
    props,
    relation: def.relation,
    state: "free",
    angryUntil: 0,
    unitIds: [],
    leaderId: -1,
    holdT: 0,
    nextTribute: 0,
    raid: null,
    loot: Object.fromEntries(Object.entries(def.tribute).map(([k, v]) => [k, (v ?? 0) * 2])),
    lastAngry: -999
  };
  sim.tribes.push(tribe);
  const total = def.civilians + def.warriors;
  for (let i = 0; i < total; i++) {
    const warrior = i < def.warriors, ang = sim.frnd() * Math.PI * 2, r = 2.5 + sim.frnd() * 3.5;
    const f = sim.makeVillager(Math.floor(camp.x + Math.cos(ang) * r), Math.floor(camp.y + Math.sin(ang) * r), sim.frnd() < 0.5 ? "m" : "f", id, sim.frnd);
    f.look.hide = def.look.hide;
    f.look.pants = def.look.pants;
    f.stats.str = Math.round(f.stats.str * power + (warrior ? 1 : 0));
    f.maxHealth = Math.round(maxHpOf(f.stats.vit) * power);
    f.health = f.maxHealth;
    if (warrior) {
      f.weapon = def.weapons[i % def.weapons.length];
      f.armor = def.armor ? "hide" : null;
    }
    f.ai = { role: warrior ? "guard" : "civ", camp, wander: sim.frnd() * 5, goal: null, raid: 0 };
    sim.addFoe(f);
    tribe.unitIds.push(f.id);
  }
  const warriors = tribe.unitIds.map((u) => sim.get(u)).filter((u) => u.ai.role === "guard");
  if (warriors.length >= 1) {
    const lead = warriors.sort((a, b) => b.stats.str + b.stats.vit - a.stats.str - a.stats.vit)[0];
    lead.leader = true;
    tribe.leaderId = lead.id;
  }
}
function tribeHostile(sim, id) {
  const t = tribeOf(sim, id);
  return !!t && t.state === "free" && (t.relation < HOSTILE_BELOW || sim.time < t.angryUntil || !!t.raid);
}
function tribeAttacked(sim, id, victim) {
  const t = tribeOf(sim, id);
  if (!t || t.state !== "free") return;
  const first = sim.time > t.angryUntil;
  t.angryUntil = sim.time + 120;
  if (first) {
    t.relation = Math.max(-100, t.relation + (t.def.personality === "peaceful" ? RELATION.attackedPeaceful : -10));
    if (sim.time - t.lastAngry > 30) {
      t.lastAngry = sim.time;
      sim.say(`${t.def.name} b\u1ECB t\u1EA5n c\xF4ng v\xE0 n\u1ED5i gi\u1EADn!`);
    }
  }
  void victim;
}
function killFoe(sim, v, killer) {
  const t = tribeOf(sim, v.team);
  sim.removeFoe(v);
  if (!t) return;
  t.unitIds = t.unitIds.filter((u) => u !== v.id);
  moraleShock(sim, v, MORALE.allyDeath);
  if (killer?.team === "player") {
    t.relation = Math.max(-100, t.relation + (v.ai?.role === "civ" ? RELATION.killCivilian : RELATION.killWarrior));
    t.angryUntil = sim.time + 120;
  }
  if (v.id === t.leaderId) sim.say(`Th\u1EE7 l\u0129nh ${t.def.name} \u0111\xE3 g\u1EE5c ng\xE3.`);
  sim.onKill?.();
}
function giftTribe(sim, id) {
  const t = tribeOf(sim, id);
  if (!t || t.state === "destroyed" || t.state === "adopted") return "Kh\xF4ng c\xF2n ai \u0111\u1EC3 t\u1EB7ng";
  if (sim.stock.food < RELATION.giftFood) return `C\u1EA7n ${RELATION.giftFood} th\u1EE9c \u0103n \u0111\u1EC3 l\xE0m qu\xE0`;
  sim.stock.food -= RELATION.giftFood;
  t.relation = Math.min(100, t.relation + RELATION.giftGain);
  if (t.relation >= HOSTILE_BELOW) t.angryUntil = Math.min(t.angryUntil, sim.time);
  return null;
}
function canTribute(t) {
  return t.state === "surrendered" || t.state === "free" && t.relation >= RELATION.tributeAt;
}
function canAdopt(t) {
  return t.state === "surrendered" || t.state === "free" && t.def.personality === "peaceful" && t.relation >= RELATION.joinAt;
}
function tributeTribe(sim, id) {
  const t = tribeOf(sim, id);
  if (!t || !canTribute(t)) return "H\u1ECD ch\u01B0a ch\u1ECBu c\u1ED1ng n\u1EA1p";
  t.state = "tribute";
  t.relation = Math.max(t.relation, RELATION.tributeAt);
  t.raid = null;
  t.nextTribute = sim.day + SEASON_DAYS;
  if (sim.pendingTribe === id) sim.pendingTribe = null;
  releaseRaiders(sim, t);
  sim.say(`${t.def.name} ch\u1ECBu c\u1ED1ng n\u1EA1p: m\u1ED7i m\xF9a h\u1ECD g\u1EEDi t\xE0i nguy\xEAn v\xE0 kh\xF4ng \u0111\xE1nh l\xE0ng n\u1EEFa.`);
  return null;
}
function adoptTribe(sim, id) {
  const t = tribeOf(sim, id);
  if (!t || !canAdopt(t)) return "H\u1ECD ch\u01B0a ch\u1ECBu theo l\xE0ng";
  const cap = sim.popCap(), room = cap - sim.villagers.length;
  if (room <= 0) return `L\xE0ng \u0111\xE3 \u0111\u1EE7 ${cap} d\xE2n: h\xE3y n\xE2ng \u0111\u1ED1ng l\u1EEDa tr\u1EA1i \u0111\u1EC3 ch\u1EE9a th\xEAm`;
  const units = t.unitIds.map((u) => sim.get(u)).filter((u) => !!u).sort((a) => a.ai?.role === "civ" ? 0 : 1);
  let taken = 0;
  for (const f of units) {
    if (taken >= room) {
      sim.removeFoe(f);
      continue;
    }
    sim.adoptFoe(f);
    taken++;
  }
  for (const [k, n] of Object.entries(t.loot)) sim.stock[k] = Math.min(sim.capacity(), sim.stock[k] + (n ?? 0));
  t.unitIds = [];
  t.state = "adopted";
  t.relation = 100;
  t.raid = null;
  if (sim.pendingTribe === id) sim.pendingTribe = null;
  sim.say(`${taken} ng\u01B0\u1EDDi c\u1EE7a ${t.def.name} gia nh\u1EADp l\xE0ng.${units.length > taken ? " S\u1ED1 c\xF2n l\u1EA1i kh\xF4ng c\xF3 ch\u1ED7 n\xEAn t\u1EA3n \u0111i." : ""}`);
  return null;
}
function releaseRaiders(sim, t) {
  for (const u of t.unitIds) {
    const f = sim.get(u);
    if (f?.ai?.role === "raider") {
      f.ai.role = "guard";
      f.ai.raid = 0;
      f.fight.target = null;
      f.path = [];
    }
  }
}
function tickTribes(sim, dt) {
  tickEvents(sim);
  sim.tribeClock += dt;
  if (sim.tribeClock < 1) return;
  sim.tribeClock = 0;
  for (const t of sim.tribes) {
    t.unitIds = t.unitIds.filter((u) => {
      const f = sim.get(u);
      return !!f && f.health > 0;
    });
    for (const u of t.unitIds) tickMorale(sim, sim.get(u));
    if (t.state === "free" && t.unitIds.length === 0) {
      t.state = "destroyed";
      t.raid = null;
      sim.say(`${t.def.name} \u0111\xE3 b\u1ECB x\xF3a s\u1ED5.`);
      continue;
    }
    if (t.state === "tribute" && sim.day >= t.nextTribute) {
      t.nextTribute = sim.day + SEASON_DAYS;
      for (const [k, n] of Object.entries(t.def.tribute)) sim.stock[k] = Math.min(sim.capacity(), sim.stock[k] + (n ?? 0));
      sim.say(`${t.def.name} g\u1EEDi c\u1ED1ng n\u1EA1p m\xF9a n\xE0y.`);
    }
    if (t.state === "free") {
      checkSurrender(sim, t);
      manageRaid(sim, t);
    }
  }
}
function checkSurrender(sim, t) {
  const units = t.unitIds.map((u) => sim.get(u)).filter(Boolean), warriors = units.filter((u) => u.ai?.role !== "civ");
  if (SURRENDER.leaderDown && t.leaderId >= 0 && !t.unitIds.includes(t.leaderId) && units.length) return surrender(sim, t, "Th\u1EE7 l\u0129nh \u0111\xE3 g\u1EE5c");
  const intruders = sim.villagers.filter((v) => v.health > 0 && v.down <= 0 && Math.hypot(v.x - t.camp.x, v.y - t.camp.y) < 5).length;
  const defenders = warriors.filter((w) => Math.hypot(w.x - t.camp.x, w.y - t.camp.y) < 9 && w.morale >= MORALE.flee).length;
  t.holdT = intruders > 0 && defenders === 0 && tribeHostile(sim, t.id) ? t.holdT + 1 : 0;
  if (t.holdT >= SURRENDER.holdCampSeconds) return surrender(sim, t, "\u0110\u1ED1ng l\u1EEDa c\u1EE7a h\u1ECD \u0111\xE3 b\u1ECB chi\u1EBFm");
  if (warriors.length && warriors.reduce((a, w) => a + w.morale, 0) / warriors.length < SURRENDER.moraleBelow) surrender(sim, t, "Tinh th\u1EA7n s\u1EE5p \u0111\u1ED5");
}
function surrender(sim, t, why) {
  t.state = "surrendered";
  t.raid = null;
  t.holdT = 0;
  t.angryUntil = 0;
  releaseRaiders(sim, t);
  for (const u of t.unitIds) {
    const f = sim.get(u);
    if (f) {
      f.fight.target = null;
      f.fleeT = 0;
      f.path = [];
      f.phase = "idle";
    }
  }
  sim.pendingTribe = t.id;
  sim.say(`${why}: ${t.def.name} xin h\xE0ng! Ch\u1ECDn thu n\u1EA1p ho\u1EB7c c\u1ED1ng n\u1EA1p.`);
}
function manageRaid(sim, t) {
  const r = t.raid;
  if (!r) return;
  r.t += 1;
  const raiders = t.unitIds.map((u) => sim.get(u)).filter((u) => u?.ai?.raid === r.id);
  const heart = raiders.length ? raiders.reduce((a, u) => a + u.morale, 0) / raiders.length : 0;
  const playerAlive = sim.villagers.some((v) => v.health > 0);
  if (r.phase === "march" && (raiders.length === 0 || r.t > r.max || heart < MORALE.flee || !playerAlive)) {
    r.phase = "retreat";
    if (raiders.length) sim.say(`Qu\xE2n ${t.def.name} r\xFAt lui.`);
  }
  if (r.phase === "retreat") {
    const home = raiders.every((u) => Math.hypot(u.x - t.camp.x, u.y - t.camp.y) < 7);
    if (raiders.length === 0 || home || r.t > r.max + 120) {
      releaseRaiders(sim, t);
      t.raid = null;
    }
  }
}
function launchRaid(sim, t, size) {
  const guards = t.unitIds.map((u) => sim.get(u)).filter((u) => u?.ai?.role === "guard").sort((a, b) => b.maxHealth - a.maxHealth);
  const n = Math.min(size, guards.length);
  if (n < 3 || t.raid) return;
  const id = ++sim.nextRaid;
  t.raid = { id, phase: "march", t: 0, max: 200, size: n };
  for (const g of guards.slice(0, n)) {
    g.ai.role = "raider";
    g.ai.raid = id;
    g.fight.target = null;
    g.path = [];
    g.fleeT = 0;
  }
  t.angryUntil = sim.time + 400;
  sim.say(`Qu\xE2n ${t.def.name} (${n} ng\u01B0\u1EDDi) \u0111ang ti\u1EBFn v\xE0o l\xE0ng!`);
}
function launchWolves(sim, size) {
  const fire = sim.campfire(), s = sim.world.start, cx = fire ? fire.x + 1 : s.x, cy = fire ? fire.y + 1 : s.y;
  let placed = 0;
  const ang0 = sim.frnd() * Math.PI * 2;
  for (let tries = 0; tries < 80 && placed < size; tries++) {
    const a = ang0 + (sim.frnd() - 0.5) * 0.8, d = 26 + sim.frnd() * 6;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, tx = Math.floor(x), ty = Math.floor(y);
    if (!sim.world.inBounds(tx, ty) || sim.world.isBlocked(tx, ty)) continue;
    const w = spawnAnimal(sim, "wolf", x, y, 9e3 + sim.nextRaid, true);
    w.state = "graze";
    w.timer = 0;
    placed++;
  }
  sim.nextRaid++;
  if (placed) sim.say("B\u1EA7y s\xF3i \u0111\xF3i k\xE9o t\u1EDBi quanh l\xE0ng! \u0110\u1ED1t l\u1EEDa v\xE0 gi\u1EEF d\xE2n g\u1EA7n \u0111\u1ED1ng l\u1EEDa.");
}
function initEvents(sim) {
  for (const e of events_default.events) {
    const fireDay = e.day + Math.floor(sim.frnd() * (e.spread + 1));
    sim.events.push({ id: e.id, kind: e.kind, tribe: e.tribe, fireDay, warnDay: fireDay - (e.warnDays ?? 1), size: e.size, night: e.night, warn: e.warn, warned: !e.warn, fired: false });
  }
}
function tickEvents(sim) {
  for (const e of sim.events) {
    if (e.fired) continue;
    if (!e.warned && sim.day >= e.warnDay && sim.tod >= 0.3) {
      e.warned = true;
      sim.say(e.warn);
    }
    if (sim.day < e.fireDay) continue;
    const ready = e.night ? sim.restTime : sim.tod >= 0.28 && !sim.restTime;
    if (!ready) continue;
    e.fired = true;
    if (e.kind === "wolves") launchWolves(sim, e.size);
    else if (e.tribe) {
      const t = tribeOf(sim, e.tribe);
      if (t && t.state === "free") launchRaid(sim, t, e.size);
    }
  }
}
var AGGRO = { peaceful: 6, aggressive: 14, ambusher: 9 };
var LEASH = 24;
function wander(sim, f, radius) {
  const ai = f.ai;
  for (let i = 0; i < 6; i++) {
    const a = sim.frnd() * Math.PI * 2, r = 1.5 + sim.frnd() * radius;
    const g = sim.nearestFree(Math.floor(ai.camp.x + Math.cos(a) * r), Math.floor(ai.camp.y + Math.sin(a) * r), /* @__PURE__ */ new Set());
    if (g) {
      f.path = sim.pathTo(f, g[0], g[1], 2500);
      f.phase = f.path.length ? "move" : "idle";
      break;
    }
  }
  ai.wander = 4 + sim.frnd() * 8;
}
function tickFoe(sim, f, dt) {
  tickCommon(sim, f, dt);
  const t = tribeOf(sim, f.team), ai = f.ai;
  if (t && ai) foeBrain(sim, f, t, ai, dt);
  sim.moveUnit(f, dt);
  sim.animate(f, dt);
}
function foeBrain(sim, f, t, ai, dt) {
  const free = t.state === "free";
  f.fight.scan -= dt;
  const radius = ai.role === "raider" ? 12 : ai.role === "civ" ? 9 : AGGRO[t.def.personality];
  const scanNow = f.fight.scan <= 0;
  if (scanNow) f.fight.scan = 0.4;
  const threats = free && (scanNow || f.phase === "fight" || f.phase === "flee") ? threatsOf(sim, f, radius) : [];
  if (!free) {
    f.fight.target = null;
    if (f.phase === "fight") {
      f.phase = "idle";
      f.path = [];
    }
  }
  if (free && (f.fleeT > 0 || f.morale < MORALE.flee && threats.length || ai.role === "civ" && threats.length && threats[0].d < 8)) {
    if (f.fleeT <= 0) {
      f.fleeT = 6;
      f.fight.target = null;
      f.path = sim.pathTo(f, Math.floor(ai.camp.x), Math.floor(ai.camp.y), 3e3);
    }
    f.fleeT -= dt;
    f.phase = "flee";
    if (threats.length && threats[0].d < 6) f.fleeT = Math.max(f.fleeT, 2);
    if (f.fleeT <= 0 && f.morale < MORALE.fleeRecover) f.fleeT = 1;
    if (!f.path.length && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) > 3) f.path = sim.pathTo(f, Math.floor(ai.camp.x), Math.floor(ai.camp.y), 3e3);
    return;
  }
  if (f.phase === "flee") {
    f.phase = "idle";
    f.path = [];
  }
  if (free && ai.role === "raider" && t.raid) {
    if (t.raid.phase === "retreat") {
      if (!f.path.length && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) > 4) f.path = sim.pathTo(f, Math.floor(ai.camp.x), Math.floor(ai.camp.y), 2e4);
      f.phase = "move";
      return;
    }
    if (f.fight.target) {
      const e = resolve(sim, f.fight.target);
      if (e) {
        engage(sim, f, e, dt);
        return;
      }
      f.fight.target = null;
      f.phase = "idle";
    }
    if (threats.length) {
      f.fight.target = threats[0].t;
      return;
    }
    const fire = sim.campfire(), gx = fire ? fire.x + 1 : sim.world.start.x, gy = fire ? fire.y + 1 : sim.world.start.y;
    if (Math.hypot(gx - f.x, gy - f.y) > 6) {
      if (!f.path.length) f.path = sim.pathTo(f, Math.floor(gx), Math.floor(gy), 4e4);
      f.phase = "move";
    } else {
      const v = sim.villagers.find((o) => o.health > 0 && o.down <= 0 && o.inside === null);
      if (v) f.fight.target = { kind: "unit", id: v.id };
    }
    return;
  }
  if (free && f.fight.target) {
    const e = resolve(sim, f.fight.target);
    if (e && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) < LEASH) {
      engage(sim, f, e, dt);
      return;
    }
    f.fight.target = null;
    f.phase = "idle";
    f.path = [];
  }
  if (free && ai.role === "guard" && threats.length && tribeHostile(sim, t.id)) {
    f.fight.target = threats[0].t;
    return;
  }
  if (f.phase === "fight") {
    f.phase = "idle";
    f.path = [];
  }
  ai.wander -= dt;
  if (ai.wander <= 0 && !f.path.length) wander(sim, f, ai.role === "civ" ? 5 : t.def.personality === "aggressive" ? 12 : 8);
  if (f.phase === "move" && !f.path.length) f.phase = "idle";
  void DAY_LENGTH;
}

// src/data/pace.json
var pace_default = {
  _note: 'How long things take, in one place. gather: real seconds (at 1x speed) to collect ONE unit for an average villager with a good tool (speed factor 1.0). A day is 20 minutes, 12 of them daylight; walking, carrying and the weather come on top. bare: how well bare hands do compared with a good tool (1 = as good). Building, crafting, research and repair are measured in days of labour instead (see buildings.ts, tools.ts, research.json) because they should take about the same fraction of a day however long a day lasts. Weather and season slow outdoor work: see weather.json and seasons.json (key "work").',
  gather: { wood: 11, stone: 17, food: 6 },
  bare: { wood: 0.6, stone: 0.5, food: 0.9, build: 0.8 },
  outdoor: ["wood", "stone", "food", "build"]
};

// src/sim/jobs.ts
var JOBS = {
  wood: { name: "\u0110\u1ED1n g\u1ED7", stat: "str", res: "wood", node: "tree", baseTime: pace_default.gather.wood, anim: "chop" },
  stone: { name: "Th\u1EE3 \u0111\xE1", stat: "str", res: "stone", node: "rock", baseTime: pace_default.gather.stone, anim: "mine" },
  food: { name: "H\xE1i l\u01B0\u1EE3m", stat: "agi", res: "food", node: "bush", baseTime: pace_default.gather.food, anim: "gather" },
  build: { name: "Th\u1EE3 x\xE2y", stat: "sta", baseTime: 1, anim: "build" },
  craft: { name: "Ch\u1EBF t\u1EA1o", stat: "int", baseTime: 1, anim: "craft" },
  research: { name: "Nghi\xEAn c\u1EE9u", stat: "int", baseTime: 1, anim: "gather" },
  repair: { name: "S\u1EEDa ch\u1EEFa", stat: "agi", baseTime: 1, anim: "craft" },
  hunt: { name: "Th\u1EE3 s\u0103n", stat: "agi", baseTime: 1, anim: "thrust_attack" },
  fight: { name: "Chi\u1EBFn binh", stat: "str", baseTime: 1, anim: "swing_attack" }
};
var JOB_NAME = { idle: "R\u1EA3nh", wood: "\u0110\u1ED1n g\u1ED7", stone: "Th\u1EE3 \u0111\xE1", food: "H\xE1i l\u01B0\u1EE3m", build: "Th\u1EE3 x\xE2y", craft: "Ch\u1EBF t\u1EA1o", research: "Nghi\xEAn c\u1EE9u", repair: "S\u1EEDa ch\u1EEFa", hunt: "Th\u1EE3 s\u0103n", fight: "Chi\u1EBFn binh" };
var WORK_JOBS = ["wood", "stone", "food", "build", "craft", "research", "repair", "hunt", "fight"];
var STAFF_BUILDING = { craft: "workshop", research: "lab", repair: "repair" };
var isStaffJob = (j) => j in STAFF_BUILDING;
var XP_LEVELS = [60, 150, 300, 500, 800];
var MAX_LEVEL = 5;
var CREW_BUILDING = { build: "builder" };
var BARE_HANDS = pace_default.bare;
var OUTDOOR_JOBS = pace_default.outdoor;

// src/data/research.json
var research_default = {
  enabled: true,
  _note: "Research is done inside the Nh\xE0 nghi\xEAn c\u1EE9u by villagers who work there: the more and the smarter, the faster. Every tool, weapon and armour has ONE blueprint that is raised step by step (tech id = recipe id: axe1 is the wood axe, axe2 the stone one); a recipe can only be made once its blueprint step is researched and the Nh\xE0 ch\u1EBF t\u1EA1o is high enough (recipeLevel). cost may include coin (shells in the stone age). time is seconds at speed 1 with one average researcher; the best researcher inside must reach minInt. needLevel is the Nh\xE0 nghi\xEAn c\u1EE9u level. unlocks: recipes, levels (highest level per building kind), buildings (kinds that may be built), auto (fetch: villagers fetch tools from the stores; order: villagers order crafting and repair themselves). Set enabled to false to open everything.",
  recipeLevel: { axe1: 1, hammer1: 1, pick1: 1, hoe1: 1, club1: 1, hide1: 1, spear1: 2, axe2: 2, pick2: 2, hoe2: 2, hammer2: 2, mace2: 3, torch1: 1 },
  techs: [
    { id: "hammer1", name: "B\u1EA3n v\u1EBD B\xFAa g\u1ED7", desc: "V\u1EBD c\xE1ch \u0111\u1EBDo b\xFAa g\u1ED7 \u0111\u1EC3 d\u1EF1ng nh\xE0 nhanh h\u01A1n.", requires: [], needLevel: 1, minInt: 4, cost: { wood: 6, coin: 2 }, time: 150, unlocks: { recipes: ["hammer1"] } },
    { id: "axe1", name: "B\u1EA3n v\u1EBD R\xECu g\u1ED7", desc: "V\u1EBD c\xE1ch \u0111\u1EBDo r\xECu g\u1ED7 \u0111\u1EC3 \u0111\u1ED1n c\xE2y.", requires: [], needLevel: 1, minInt: 4, cost: { wood: 6, coin: 2 }, time: 150, unlocks: { recipes: ["axe1"] } },
    { id: "pick1", name: "B\u1EA3n v\u1EBD Cu\u1ED1c chim g\u1ED7", desc: "V\u1EBD c\xE1ch \u0111\u1EBDo cu\u1ED1c chim g\u1ED7 \u0111\u1EC3 \u0111\u1EE5c \u0111\xE1.", requires: [], needLevel: 1, minInt: 4, cost: { wood: 6, coin: 2 }, time: 160, unlocks: { recipes: ["pick1"] } },
    { id: "hoe1", name: "B\u1EA3n v\u1EBD Cu\u1ED1c g\u1ED7", desc: "V\u1EBD c\xE1ch \u0111\u1EBDo cu\u1ED1c g\u1ED7 \u0111\u1EC3 h\xE1i l\u01B0\u1EE3m, \u0111\xE0o c\u1EE7.", requires: [], needLevel: 1, minInt: 4, cost: { wood: 6, coin: 2 }, time: 140, unlocks: { recipes: ["hoe1"] } },
    { id: "torch1", name: "B\u1EA3n v\u1EBD \u0110u\u1ED1c", desc: "Qu\u1EA5n nh\u1EF1a v\xE0 c\xE0nh kh\xF4 th\xE0nh \u0111u\u1ED1c \u0111\u1EC3 l\xE0m vi\u1EC7c \u0111\u01B0\u1EE3c ban \u0111\xEAm.", requires: [], needLevel: 1, minInt: 3, cost: { wood: 4, coin: 1 }, time: 120, unlocks: { recipes: ["torch1"] } },
    { id: "club1", name: "B\u1EA3n v\u1EBD G\u1EADy chi\u1EBFn", desc: "V\u1EBD c\xE1ch \u0111\u1EBDo g\u1EADy chi\u1EBFn \u0111\u1EC3 t\u1EF1 v\u1EC7 v\xE0 \u0111i s\u0103n.", requires: ["hammer1"], needLevel: 1, minInt: 5, cost: { wood: 8, coin: 3 }, time: 180, unlocks: { recipes: ["club1"] } },
    { id: "hide1", name: "B\u1EA3n v\u1EBD \xC1o da", desc: "V\u1EBD c\xE1ch kh\xE2u da th\xFA th\xE0nh \xE1o gi\xE1p.", requires: ["axe1"], needLevel: 1, minInt: 6, cost: { hide: 4, coin: 4 }, time: 240, unlocks: { recipes: ["hide1"] } },
    { id: "spear1", name: "B\u1EA3n v\u1EBD Gi\xE1o v\xF3t nh\u1ECDn", desc: "V\u1EBD c\xE1ch v\xF3t gi\xE1o c\xF3 t\u1EA7m \u0111\xE2m xa h\u01A1n g\u1EADy.", requires: ["club1"], needLevel: 2, minInt: 6, cost: { wood: 12, coin: 5 }, time: 320, unlocks: { recipes: ["spear1"] } },
    { id: "axe2", name: "B\u1EA3n v\u1EBD R\xECu \u0111\xE1 (n\xE2ng c\u1EA5p)", desc: "N\xE2ng b\u1EA3n v\u1EBD R\xECu l\xEAn c\u1EA5p 2: l\u01B0\u1EE1i \u0111\xE1 b\u1EC1n v\xE0 nhanh h\u01A1n g\u1ED7.", requires: ["axe1"], needLevel: 2, minInt: 6, cost: { wood: 10, stone: 15, coin: 6 }, time: 380, unlocks: { recipes: ["axe2"] } },
    { id: "pick2", name: "B\u1EA3n v\u1EBD Cu\u1ED1c chim \u0111\xE1 (n\xE2ng c\u1EA5p)", desc: "N\xE2ng b\u1EA3n v\u1EBD Cu\u1ED1c chim l\xEAn c\u1EA5p 2.", requires: ["pick1"], needLevel: 2, minInt: 6, cost: { wood: 10, stone: 15, coin: 6 }, time: 380, unlocks: { recipes: ["pick2"] } },
    { id: "hoe2", name: "B\u1EA3n v\u1EBD Cu\u1ED1c \u0111\xE1 (n\xE2ng c\u1EA5p)", desc: "N\xE2ng b\u1EA3n v\u1EBD Cu\u1ED1c l\xEAn c\u1EA5p 2.", requires: ["hoe1"], needLevel: 2, minInt: 6, cost: { wood: 10, stone: 10, coin: 6 }, time: 340, unlocks: { recipes: ["hoe2"] } },
    { id: "hammer2", name: "B\u1EA3n v\u1EBD B\xFAa \u0111\xE1 (n\xE2ng c\u1EA5p)", desc: "N\xE2ng b\u1EA3n v\u1EBD B\xFAa l\xEAn c\u1EA5p 2.", requires: ["hammer1"], needLevel: 2, minInt: 6, cost: { wood: 10, stone: 15, coin: 6 }, time: 360, unlocks: { recipes: ["hammer2"] } },
    { id: "mace2", name: "B\u1EA3n v\u1EBD Ch\xF9y \u0111\xE1", desc: "V\u1EBD c\xE1ch bu\u1ED9c \u0111\u1EA7u \u0111\xE1 n\u1EB7ng v\xE0o c\xE1n th\xE0nh ch\xF9y.", requires: ["club1", "axe2"], needLevel: 3, minInt: 8, cost: { stone: 30, coin: 10 }, time: 600, unlocks: { recipes: ["mace2"] } },
    { id: "timber", name: "D\u1EF1ng b\u1EB1ng g\u1ED7", desc: "N\xE2ng c\xE1c nh\xE0 l\xEAn c\u1EA5p 2 (g\u1ED7).", requires: ["hammer1"], needLevel: 1, minInt: 5, cost: { wood: 20, coin: 3 }, time: 200, unlocks: { levels: { storage: 2, workshop: 2, lab: 2, repair: 2, toolstore: 2, armory: 2, house: 2, barracks: 2 } } },
    { id: "masonry", name: "X\xE2y b\u1EB1ng \u0111\xE1", desc: "N\xE2ng c\xE1c nh\xE0 l\xEAn c\u1EA5p 3 (\u0111\xE1).", requires: ["timber", "pick1"], needLevel: 2, minInt: 7, cost: { wood: 10, stone: 40, coin: 8 }, time: 420, unlocks: { levels: { storage: 3, workshop: 3, lab: 3, repair: 3, toolstore: 3, armory: 3, house: 3, barracks: 3 } } },
    { id: "house", name: "Nh\xE0 d\xE2n", desc: "D\u1EF1ng nh\xE0 cho d\xE2n ng\u1EE7: ng\u1EE7 trong nh\xE0 h\u1ED3i s\u1EE9c nhanh h\u01A1n n\u1EB1m c\u1EA1nh \u0111\u1ED1ng l\u1EEDa.", requires: ["hammer1"], needLevel: 1, minInt: 5, cost: { wood: 15, coin: 3 }, time: 200, unlocks: { buildings: ["house"] } },
    { id: "barracks", name: "L\u1EC1u chi\u1EBFn binh", desc: "D\u1EF1ng l\u1EC1u cho chi\u1EBFn binh ng\u1EE7 v\xE0 ngh\u1EC9 ng\u01A1i; l\xEDnh \u0111\u01B0\u1EE3c tuy\u1EC3n \u1EDF \u0111\u1ED1ng l\u1EEDa tr\u1EA1i.", requires: ["club1"], needLevel: 1, minInt: 5, cost: { wood: 15, coin: 4 }, time: 220, unlocks: { buildings: ["barracks"] } },
    { id: "tool_store", name: "Kho c\xF4ng c\u1EE5", desc: "Cho ph\xE9p d\u1EF1ng Kho c\xF4ng c\u1EE5 \u0111\u1EC3 c\u1EA5t r\xECu, cu\u1ED1c, b\xFAa.", requires: ["hammer1", "axe1"], needLevel: 1, minInt: 5, cost: { wood: 15, coin: 4 }, time: 200, unlocks: { buildings: ["toolstore"] } },
    { id: "armory", name: "Kho v\u0169 kh\xED", desc: "Cho ph\xE9p d\u1EF1ng Kho v\u0169 kh\xED \u0111\u1EC3 c\u1EA5t v\u0169 kh\xED v\xE0 gi\xE1p.", requires: ["club1"], needLevel: 1, minInt: 5, cost: { wood: 15, coin: 4 }, time: 220, unlocks: { buildings: ["armory"] } },
    { id: "auto_fetch", name: "T\u1EF1 l\u1EA5y \u0111\u1ED3 trong kho", desc: "D\xE2n c\xF3 c\xF4ng c\u1EE5 ho\u1EB7c v\u0169 kh\xED tr\u1ED1ng hay h\u1ECFng s\u1EBD t\u1EF1 t\u1EDBi kho l\u1EA5y.", requires: ["tool_store"], needLevel: 2, minInt: 6, cost: { wood: 10, coin: 6 }, time: 300, unlocks: { auto: ["fetch"] } },
    { id: "auto_order", name: "T\u1EF1 nh\u1EDD ch\u1EBF t\u1EA1o v\xE0 s\u1EEDa ch\u1EEFa", desc: "D\xE2n thi\u1EBFu \u0111\u1ED3 t\u1EF1 t\u1EDBi nh\xE0 ch\u1EBF t\u1EA1o \u0111\u1EB7t h\xE0ng, t\u1EDBi nh\xE0 s\u1EEDa ch\u1EEFa nh\u1EDD s\u1EEDa \u0111\u1ED3 h\u1ECFng.", requires: ["auto_fetch"], needLevel: 2, minInt: 7, cost: { wood: 10, coin: 8 }, time: 360, unlocks: { auto: ["order"] } }
  ]
};

// src/sim/research.ts
var RESEARCH = { enabled: research_default.enabled };
var RECIPE_LEVEL = research_default.recipeLevel;
var recipeNeedLevel = (id) => RECIPE_LEVEL[id] ?? 1;
var TECHS = research_default.techs;
var TECH_BY_ID = Object.fromEntries(TECHS.map((t) => [t.id, t]));
var recipeOpen = (done, recipeId) => !RESEARCH.enabled || done.has(recipeId);
var techForRecipe = (recipeId) => TECH_BY_ID[recipeId] ?? TECHS.find((t) => t.unlocks.recipes?.includes(recipeId));
var levelCap = (done, kind) => !RESEARCH.enabled || kind === "campfire" ? Infinity : TECHS.reduce((m, t) => done.has(t.id) ? Math.max(m, t.unlocks.levels?.[kind] ?? 1) : m, 1);
var techForLevel = (kind, level) => TECHS.find((t) => (t.unlocks.levels?.[kind] ?? 0) >= level);
var techForBuilding = (kind) => TECHS.find((t) => t.unlocks.buildings?.includes(kind));
var buildingOpen = (done, kind) => {
  const t = techForBuilding(kind);
  return !RESEARCH.enabled || !t || done.has(t.id);
};
var autoOn = (done, key) => !RESEARCH.enabled || TECHS.some((t) => done.has(t.id) && t.unlocks.auto?.includes(key));

// src/sim/construction.ts
function addBuilding(sim, kind, x, y, done) {
  const d = BUILDINGS[kind];
  const b = { id: sim.nextBid++, kind, era: sim.era, x, y, level: 1, progress: done ? 1 : 0, done, upgrading: false, rebuild: false, staff: [], active: null, workers: 0 };
  sim.buildings.push(b);
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) sim.world.occ[(y + j) * sim.world.size + x + i] = 1;
  return b;
}
function footprintError(sim, kind, x, y, ignore) {
  const d = BUILDINGS[kind], w = sim.world, N = w.size;
  const own = (tx, ty) => !!ignore && tx >= ignore.x && tx < ignore.x + d.w && ty >= ignore.y && ty < ignore.y + d.h;
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
    const tx = x + i, ty = y + j;
    if (!w.inBounds(tx, ty)) return "Ngo\xE0i b\u1EA3n \u0111\u1ED3";
    const k = ty * N + tx;
    if (sim.fog.state[k] === 0) return "Ch\u01B0a kh\xE1m ph\xE1";
    const t = w.tiles[k];
    if (t !== 0 && t !== 4 || w.occ[k] && !own(tx, ty)) return "V\u01B0\u1EDBng c\xE2y, \u0111\xE1, n\u01B0\u1EDBc ho\u1EB7c c\xF4ng tr\xECnh";
  }
  return null;
}
function buildingLock(sim, kind) {
  if (sim.buildings.some((b) => b.kind === kind)) return "M\u1ED7i c\xF4ng tr\xECnh ch\u1EC9 x\xE2y \u0111\u01B0\u1EE3c m\u1ED9t c\xE1i, h\xE3y n\xE2ng c\u1EA5p n\xF3";
  const need = sim.dev.freeBuild ? void 0 : BUILDINGS[kind].requires?.find((r) => !sim.building(r));
  if (need) return `C\u1EA7n d\u1EF1ng ${BUILDINGS[need].name} tr\u01B0\u1EDBc`;
  if (!sim.dev.freeBuild && !buildingOpen(sim.researched, kind)) return `C\u1EA7n nghi\xEAn c\u1EE9u: ${techForBuilding(kind)?.name ?? "?"}`;
  return null;
}
function canPlace(sim, kind, x, y) {
  return footprintError(sim, kind, x, y) ?? buildingLock(sim, kind) ?? (sim.dev.freeBuild ? null : sim.missing(levelsOf(kind, sim.era)[0].cost));
}
function canUpgrade(sim, b) {
  if (!b.done) return "C\xF4ng tr\xECnh ch\u01B0a d\u1EF1ng xong";
  if (b.upgrading) return "\u0110ang n\xE2ng c\u1EA5p";
  if (b.level >= maxLevel(b.kind, b.era)) return "\u0110\xE3 \u1EDF c\u1EA5p cao nh\u1EA5t";
  if (b.level + 1 > levelCap(sim.researched, b.kind)) return `C\u1EA7n nghi\xEAn c\u1EE9u: ${techForLevel(b.kind, b.level + 1)?.name ?? "?"}`;
  const fire = sim.campfire();
  if (b.kind !== "campfire" && fire && !sim.dev.freeBuild && b.level + 1 > levelCapByFire(fire.level)) return `C\u1EA7n n\xE2ng ${BUILDINGS.campfire.name} l\xEAn c\u1EA5p ${b.level + 2}`;
  return sim.dev.freeBuild ? null : sim.missing(levelDef(b, b.level + 1).cost);
}
function upgradeBuilding(sim, id) {
  const b = sim.getBuilding(id);
  if (!b) return "Kh\xF4ng t\xECm th\u1EA5y c\xF4ng tr\xECnh";
  const why = canUpgrade(sim, b);
  if (why) return why;
  const next = levelDef(b, b.level + 1);
  if (!sim.dev.freeBuild) for (const r of Object.keys(next.cost)) sim.stock[r] -= next.cost[r] ?? 0;
  if (sim.dev.instantBuild) {
    b.level++;
    sim.say(`${BUILDINGS[b.kind].name} l\xEAn c\u1EA5p ${b.level} ngay (dev).`);
    return null;
  }
  b.upgrading = true;
  b.progress = 0;
  sim.say(`B\u1EAFt \u0111\u1EA7u n\xE2ng ${BUILDINGS[b.kind].name} l\xEAn c\u1EA5p ${b.level + 1} (${next.name.toLowerCase()}). Giao vi\u1EC7c "Th\u1EE3 x\xE2y" \u0111\u1EC3 l\xE0m.`);
  return null;
}
function placeBuilding(sim, kind, x, y) {
  const d = BUILDINGS[kind];
  if (!d.buildable) return { ok: false, reason: "Kh\xF4ng x\xE2y \u0111\u01B0\u1EE3c c\xF4ng tr\xECnh n\xE0y" };
  const why = canPlace(sim, kind, x, y);
  if (why) return { ok: false, reason: why };
  const cost = levelsOf(kind, sim.era)[0].cost;
  if (!sim.dev.freeBuild) for (const r of Object.keys(cost)) sim.stock[r] -= cost[r] ?? 0;
  const b = addBuilding(sim, kind, x, y, false);
  if (sim.dev.instantBuild) {
    b.progress = 1;
    b.done = true;
    sim.fogDirty = true;
    sim.say(`${d.name} \u0111\xE3 d\u1EF1ng xong ngay (dev).`);
    return { ok: true, building: b };
  }
  sim.say(`\u0110\xE3 \u0111\u1EB7t n\u1EC1n ${d.name}. Giao vi\u1EC7c "Th\u1EE3 x\xE2y" \u0111\u1EC3 d\u1EF1ng.`);
  return { ok: true, building: b };
}
function invested(sim, b) {
  const out = {};
  const add = (c) => {
    for (const r of Object.keys(c)) out[r] = (out[r] ?? 0) + (c[r] ?? 0);
  };
  for (let l = 1; l <= b.level; l++) add(levelDef(b, l).cost);
  if (b.upgrading) add(levelDef(b, b.level + 1).cost);
  return out;
}
function salvage(sim, b) {
  const out = {}, paid = invested(sim, b);
  if (!sim.dev.freeBuild) for (const r of Object.keys(paid)) {
    const n = Math.floor((paid[r] ?? 0) * 0.5);
    if (n > 0) out[r] = n;
  }
  return out;
}
function moveFee(sim, b) {
  const out = {};
  if (!b.done || sim.dev.freeBuild) return out;
  const paid = invested(sim, b);
  for (const r of Object.keys(paid)) {
    const n = Math.ceil((paid[r] ?? 0) * 0.2);
    if (n > 0) out[r] = n;
  }
  return out;
}
function evict(sim, b) {
  for (const id of [...b.staff]) {
    const v = sim.byId.get(id);
    if (v) {
      sim.exitBuilding(v);
      v.job = "idle";
    }
  }
  b.staff = [];
  if (b.kind === "builder") for (const v of sim.crew()) {
    sim.resetTask(v);
    v.job = "idle";
  }
  if (b.active && (b.kind === "lab" || b.kind === "workshop")) {
    const d = sim.orderDef(b.kind === "lab" ? "research" : "craft", b.active.id);
    if (d) sim.pay(d.cost, 1);
  }
  b.active = null;
  for (const v of sim.sleepers(b)) {
    sim.exitBuilding(v);
    v.phase = "idle";
    v.target = -1;
    v.path = [];
  }
  for (const v of sim.villagers) {
    if (v.target !== b.id) continue;
    if (v.phase === "goSite" || v.phase === "build" || v.phase === "goEquip" || v.phase === "goStaff" || v.phase === "goOrder") {
      if (isStaffJob(v.job)) v.job = "idle";
      sim.resetTask(v);
    }
  }
}
function setOcc(sim, b, val) {
  const d = BUILDINGS[b.kind];
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) sim.world.occ[(b.y + j) * sim.world.size + b.x + i] = val;
}
function canDemolish(sim, b) {
  return BUILDINGS[b.kind].buildable ? null : "Kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c c\xF4ng tr\xECnh n\xE0y";
}
function demolishBuilding(sim, id) {
  const b = sim.getBuilding(id);
  if (!b) return "Kh\xF4ng t\xECm th\u1EA5y c\xF4ng tr\xECnh";
  const why = canDemolish(sim, b);
  if (why) return why;
  const back = salvage(sim, b);
  evict(sim, b);
  setOcc(sim, b, 0);
  sim.buildings.splice(sim.buildings.indexOf(b), 1);
  for (const r of Object.keys(back)) sim.stock[r] += back[r] ?? 0;
  sim.fogDirty = true;
  sim.say(`\u0110\xE3 ph\xE1 ${BUILDINGS[b.kind].name.toLowerCase()}${Object.keys(back).length ? `, thu l\u1EA1i ${Object.keys(back).map((r) => `${back[r]} ${RES_NAME[r].toLowerCase()}`).join(", ")}` : ""}.`);
  return null;
}
function canMove(sim, b, x, y) {
  if (!BUILDINGS[b.kind].buildable) return "Kh\xF4ng d\u1EDDi \u0111\u01B0\u1EE3c c\xF4ng tr\xECnh n\xE0y";
  if (x === b.x && y === b.y) return "V\u1EABn \u1EDF ch\u1ED7 c\u0169";
  return footprintError(sim, b.kind, x, y, b) ?? sim.missing(moveFee(sim, b));
}
function moveBuilding(sim, id, x, y) {
  const b = sim.getBuilding(id);
  if (!b) return "Kh\xF4ng t\xECm th\u1EA5y c\xF4ng tr\xECnh";
  const why = canMove(sim, b, x, y);
  if (why) return why;
  const fee = moveFee(sim, b);
  for (const r of Object.keys(fee)) sim.stock[r] -= fee[r] ?? 0;
  evict(sim, b);
  if (b.upgrading) {
    for (const r of Object.keys(levelDef(b, b.level + 1).cost)) if (!sim.dev.freeBuild) sim.stock[r] += levelDef(b, b.level + 1).cost[r] ?? 0;
    b.upgrading = false;
  }
  const wasDone = b.done;
  setOcc(sim, b, 0);
  b.x = x;
  b.y = y;
  setOcc(sim, b, 1);
  if (wasDone && !sim.dev.instantBuild) {
    b.done = false;
    b.progress = 0;
    b.rebuild = true;
  }
  sim.fogDirty = true;
  sim.say(`${BUILDINGS[b.kind].name} \u0111\u01B0\u1EE3c d\u1EDDi sang ch\u1ED7 m\u1EDBi.${b.rebuild ? ' Giao "Th\u1EE3 x\xE2y" \u0111\u1EC3 d\u1EF1ng l\u1EA1i.' : ""}`);
  return null;
}
function capacity(sim, _res) {
  let c = 0;
  for (const b of sim.buildings) if (b.done && holdsGoods(b)) c += levelDef(b).cap;
  return c;
}
function popCap(sim) {
  const f = sim.campfire();
  return POP_BY_FIRE[Math.min(POP_BY_FIRE.length, f?.level ?? 1) - 1];
}
function crewSpeed(sim) {
  const h = sim.building("builder");
  return h ? levelDef(h).craftSpeed : 1;
}

// src/sim/economy.ts
function missing(sim, cost) {
  for (const r of Object.keys(cost)) if (sim.stock[r] < (cost[r] ?? 0)) return `Thi\u1EBFu ${RES_NAME[r].toLowerCase()} (c\u1EA7n ${cost[r]})`;
  return null;
}
function affordable(sim, cost) {
  return Object.keys(cost).every((k) => sim.stock[k] >= (cost[k] ?? 0));
}
function pay(sim, cost, sign = -1) {
  for (const k of Object.keys(cost)) sim.stock[k] += sign * (cost[k] ?? 0);
}
function barter(sim, res) {
  const n = BARTER[res];
  if (sim.stock[res] < n) return `C\u1EA7n ${n} ${RES_NAME[res].toLowerCase()} \u0111\u1EC3 \u0111\u1ED5i l\u1EA5y 1 ${RES_NAME.coin.toLowerCase()}`;
  if (sim.stock.coin >= sim.capacity()) return `Kho \u0111\xE3 \u0111\u1EA7y ${RES_NAME.coin.toLowerCase()}`;
  sim.stock[res] -= n;
  sim.stock.coin += 1;
  return null;
}
function syncFood(sim) {
  const lots = sim.foodLots, cur = sim.stock.food;
  let sum = 0;
  for (const l of lots) sum += l.amount;
  if (cur > sum) {
    const exp = sim.time + FOOD_SPOIL_DAYS * DAY_LENGTH, last = lots[lots.length - 1];
    if (last && exp - last.exp < 30) last.amount += cur - sum;
    else lots.push({ amount: cur - sum, exp });
  } else if (cur < sum) {
    let take = sum - cur;
    while (take > 0 && lots.length) {
      const l = lots[0], k = Math.min(l.amount, take);
      l.amount -= k;
      take -= k;
      if (l.amount <= 0) lots.shift();
    }
  }
  let spoiled = 0;
  while (lots.length && lots[0].exp <= sim.time) spoiled += lots.shift().amount;
  if (spoiled > 0) {
    sim.stock.food = Math.max(0, sim.stock.food - spoiled);
    sim.say(`${Math.round(spoiled)} th\u1EE9c \u0103n \u0111\u1EC3 qu\xE1 ${FOOD_SPOIL_DAYS} ng\xE0y \u0111\xE3 h\u1ECFng.`);
  }
}
function foodSpoilingWithin(sim, secs) {
  let n = 0;
  for (const l of sim.foodLots) if (l.exp <= sim.time + secs) n += l.amount;
  return Math.min(n, sim.stock.food);
}

// src/sim/tools.ts
var TOOL_KINDS = ["axe", "pick", "hoe", "hammer"];
var TOOL_NAME = { axe: "R\xECu", pick: "Cu\u1ED1c chim", hoe: "Cu\u1ED1c", hammer: "B\xFAa" };
var TOOL_OF_JOB = { wood: "axe", stone: "pick", food: "hoe", build: "hammer" };
var TIER_NAME = ["Tay kh\xF4ng", "G\u1ED7", "\u0110\xE1"];
var TIER_SPEED = [0.6, 1, 1.4];
var TIER_YIELD = [1, 1.25, 1.6];
var TIER_DURABILITY = [0, 240, 600];
var GEAR_KINDS = ["club", "spear", "mace", "hide"];
var isGear = (k) => GEAR_KINDS.includes(k);
var isWeaponKind = (k) => k in WEAPONS;
var R = (kind, tier, cost, time) => ({ id: `${kind}${tier}`, kind, tier, cost, time });
var gearRecipe = (kind) => {
  const d = kind === "hide" ? ARMORS.hide : WEAPONS[kind];
  return R(kind, d.tier ?? 1, d.cost ?? {}, d.time ?? 60);
};
var RECIPES = [
  R("axe", 1, { wood: 3 }, 24),
  R("axe", 2, { wood: 2, stone: 3 }, 40),
  R("pick", 1, { wood: 4 }, 28),
  R("pick", 2, { wood: 2, stone: 4 }, 44),
  R("hoe", 1, { wood: 3 }, 24),
  R("hoe", 2, { wood: 2, stone: 2 }, 36),
  R("hammer", 1, { wood: 3 }, 24),
  R("hammer", 2, { wood: 2, stone: 3 }, 36),
  R("torch", 1, { wood: 2 }, 12),
  ...GEAR_KINDS.map(gearRecipe)
];
var RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
var recipeName = (r) => {
  if (r.kind === "hide") return ARMORS.hide.name;
  if (r.kind === "torch") return "\u0110u\u1ED1c";
  if (isWeaponKind(r.kind)) return WEAPONS[r.kind].name;
  return `${TOOL_NAME[r.kind]} ${TIER_NAME[r.tier].toLowerCase()}`;
};
var emptyToolSet = () => ({ axe: null, pick: null, hoe: null, hammer: null });

// src/sim/works.ts
function orderDef(sim, kind, id) {
  if (kind === "research") {
    const t = TECH_BY_ID[id];
    return t ? { cost: t.cost, time: t.time } : null;
  }
  const r = RECIPE_BY_ID[id];
  if (!r) return null;
  if (kind === "craft") return { cost: r.cost, time: r.time };
  const half = {};
  for (const k of Object.keys(r.cost)) half[k] = Math.ceil((r.cost[k] ?? 0) / 2);
  return { cost: half, time: Math.ceil(r.time * 1.5) };
}
function levelOfKind(sim, kind) {
  return sim.building(kind)?.level ?? 0;
}
function workshopLevel(sim) {
  return levelOfKind(sim, "workshop");
}
function bestIntInside(sim, b) {
  return b.staff.reduce((m, id) => Math.max(m, sim.byId.get(id)?.stats.int ?? 0), 0);
}
function recipeLock(sim, id) {
  if (!RESEARCH.enabled) return null;
  if (!recipeOpen(sim.researched, id)) return `Ch\u01B0a c\xF3 b\u1EA3n v\u1EBD: ${techForRecipe(id)?.name.replace(/^Bản vẽ /, "") ?? "?"}`;
  const need = recipeNeedLevel(id);
  if (workshopLevel(sim) < need) return `C\u1EA7n Nh\xE0 ch\u1EBF t\u1EA1o c\u1EA5p ${need}`;
  return null;
}
function recipeOpen2(sim, id) {
  return recipeLock(sim, id) === null;
}
function techState(sim, t) {
  if (sim.researched.has(t.id)) return { state: "done" };
  if (sim.building("lab")?.active?.id === t.id) return { state: "active" };
  if (sim.researchQueue.includes(t.id)) return { state: "queued" };
  const need = t.requires.find((r) => !sim.researched.has(r));
  if (need) return { state: "locked", why: `C\u1EA7n nghi\xEAn c\u1EE9u: ${TECH_BY_ID[need].name}` };
  const lab = sim.building("lab");
  if (!lab) return { state: "locked", why: "C\u1EA7n d\u1EF1ng Nh\xE0 nghi\xEAn c\u1EE9u" };
  if (lab.level < t.needLevel) return { state: "locked", why: `C\u1EA7n Nh\xE0 nghi\xEAn c\u1EE9u c\u1EA5p ${t.needLevel}` };
  return { state: "ready" };
}
function researchBlock(sim, t) {
  const lab = sim.building("lab");
  if (!lab || !lab.staff.length) return "Ch\u01B0a c\xF3 ng\u01B0\u1EDDi l\xE0m vi\u1EC7c trong Nh\xE0 nghi\xEAn c\u1EE9u";
  const best = bestIntInside(sim, lab);
  return best >= t.minInt ? null : `C\u1EA7n ng\u01B0\u1EDDi Tr\xED tu\u1EC7 ${t.minInt} tr\u1EDF l\xEAn trong nh\xE0 (gi\u1ECFi nh\u1EA5t: ${best})`;
}
function currentResearch(sim) {
  return sim.building("lab")?.active?.id ?? sim.researchQueue[0] ?? null;
}
function queueResearch(sim, id) {
  const t = TECH_BY_ID[id];
  if (!t) return "Kh\xF4ng c\xF3 nghi\xEAn c\u1EE9u n\xE0y";
  if (!RESEARCH.enabled) return "Nghi\xEAn c\u1EE9u \u0111ang t\u1EAFt";
  const st = techState(sim, t);
  if (st.state === "done") return "\u0110\xE3 nghi\xEAn c\u1EE9u r\u1ED3i";
  if (st.state === "active" || st.state === "queued") return "\u0110ang nghi\xEAn c\u1EE9u";
  const cur = currentResearch(sim);
  if (cur) return `\u0110ang nghi\xEAn c\u1EE9u ${TECH_BY_ID[cur]?.name ?? cur}: xong r\u1ED3i m\u1EDBi nghi\xEAn c\u1EE9u ti\u1EBFp`;
  if (st.state === "locked") return st.why ?? "Ch\u01B0a nghi\xEAn c\u1EE9u \u0111\u01B0\u1EE3c";
  const short = researchShort(sim, t);
  if (short) return short;
  sim.pay(t.cost);
  sim.researchQueue.push(id);
  return null;
}
function researchShort(sim, t) {
  return sim.missing(t.cost);
}
function queueCraft(sim, id) {
  if (!RECIPE_BY_ID[id]) return "C\xF4ng th\u1EE9c kh\xF4ng t\u1ED3n t\u1EA1i";
  if (!sim.hasWorkshop()) return "C\u1EA7n d\u1EF1ng Nh\xE0 ch\u1EBF t\u1EA1o tr\u01B0\u1EDBc";
  const lock = recipeLock(sim, id);
  if (lock) return lock;
  if (sim.craftQueue.length >= 12) return "H\xE0ng \u0111\u1EE3i \u0111\xE3 \u0111\u1EA7y";
  sim.craftQueue.push(id);
  return null;
}
function queueRepair(sim, id) {
  if (!RECIPE_BY_ID[id]) return "C\xF4ng th\u1EE9c kh\xF4ng t\u1ED3n t\u1EA1i";
  if (!sim.building("repair")) return "C\u1EA7n d\u1EF1ng Nh\xE0 s\u1EEDa ch\u1EEFa tr\u01B0\u1EDBc";
  if (sim.repairQueue.length >= 12) return "H\xE0ng \u0111\u1EE3i s\u1EEDa \u0111\xE3 \u0111\u1EA7y";
  sim.repairQueue.push(id);
  return null;
}
function unqueue(sim, queue, id) {
  const i = queue.lastIndexOf(id);
  if (i >= 0) queue.splice(i, 1);
}
function unqueueCraft(sim, id) {
  unqueue(sim, sim.craftQueue, id);
}
function unqueueResearch(sim, id) {
  const t = TECH_BY_ID[id];
  if (t && sim.researchQueue.includes(id)) sim.pay(t.cost, 1);
  unqueue(sim, sim.researchQueue, id);
}
function storeUsed(sim, cat) {
  return (cat === "tool" ? sim.wornTools.length : 0) + Object.entries(sim.toolStock).reduce((n, [id, c]) => n + ((RECIPE_BY_ID[id] && isGear(RECIPE_BY_ID[id].kind)) === (cat === "gear") ? c : 0), 0);
}
function storeCap(sim, cat) {
  const b = sim.building(cat === "tool" ? "toolstore" : "armory");
  return b ? levelDef(b).cap : 10;
}
function tickWorks(sim, dt) {
  for (const b of sim.buildings) {
    if (!b.done || b.kind !== "lab" && b.kind !== "workshop" && b.kind !== "repair") continue;
    const kind = b.kind === "lab" ? "research" : b.kind === "workshop" ? "craft" : "repair";
    const queue = kind === "research" ? sim.researchQueue : kind === "craft" ? sim.craftQueue : sim.repairQueue;
    const staff = b.staff.map((id2) => sim.byId.get(id2)).filter((v) => !!v);
    if (!staff.length) continue;
    if (!b.active) {
      const best = bestIntInside(sim, b);
      const i = queue.findIndex((id3) => {
        const d3 = orderDef(sim, kind, id3);
        if (!d3 || kind !== "research" && !sim.affordable(d3.cost)) return false;
        if (kind === "research") return best >= (TECH_BY_ID[id3]?.minInt ?? 0);
        if (kind === "craft") return recipeOpen2(sim, id3);
        return true;
      });
      if (i < 0) {
        if (queue.length && sim.time - sim.lastMatWarn > 30) {
          sim.lastMatWarn = sim.time;
          sim.say(kind === "research" ? "Nghi\xEAn c\u1EE9u \u0111ang ch\u1EDD: ch\u01B0a c\xF3 ng\u01B0\u1EDDi \u0111\u1EE7 th\xF4ng minh trong nh\xE0." : "\u0110\u01A1n \u0111ang ch\u1EDD: thi\u1EBFu nguy\xEAn li\u1EC7u.");
        }
        continue;
      }
      const id2 = queue[i], d2 = orderDef(sim, kind, id2);
      queue.splice(i, 1);
      if (kind !== "research") sim.pay(d2.cost);
      b.active = { id: id2, progress: 0 };
    }
    const d = orderDef(sim, kind, b.active.id);
    if (!d) {
      b.active = null;
      continue;
    }
    const job = kind;
    let rate = 0;
    for (const v of staff) {
      rate += sim.workFactor(v, job);
      sim.gainXp(v, job, dt);
    }
    b.active.progress = Math.min(1, b.active.progress + dt * PACE.work * rate * levelDef(b).craftSpeed * (sim.dev.fastWorks ? 25 : 1) / d.time);
    if (b.active.progress < 1) continue;
    const id = b.active.id;
    if (kind === "research") {
      sim.researched.add(id);
      b.active = null;
      sim.say(`Nh\xE0 nghi\xEAn c\u1EE9u \u0111\xE3 ho\xE0n th\xE0nh "${TECH_BY_ID[id].name}".`);
    } else {
      const r = RECIPE_BY_ID[id], cat = isGear(r.kind) ? "gear" : "tool";
      if (kind === "repair") {
        const owner = sim.villagers.find((o) => o.repairFor === id), k = r.kind;
        if (owner) {
          owner.repairFor = null;
          if (TOOL_OF_JOB[owner.job] === k && !sim.heldTool(owner)) {
            owner.tools[k] = { tier: r.tier, dur: TIER_DURABILITY[r.tier] };
            b.active = null;
            sim.say(`\u0110\xE3 s\u1EEDa xong ${recipeName(r).toLowerCase()}, tr\u1EA3 l\u1EA1i cho ${owner.name}.`);
            continue;
          }
        }
      }
      if (storeUsed(sim, cat) >= storeCap(sim, cat)) {
        if (sim.time - sim.lastFullWarn > 30) {
          sim.lastFullWarn = sim.time;
          sim.say(cat === "tool" ? "Kho c\xF4ng c\u1EE5 \u0111\xE3 \u0111\u1EA7y, s\u1EA3n ph\u1EA9m ch\u1EDD ch\u1ED7." : "Kho v\u0169 kh\xED \u0111\xE3 \u0111\u1EA7y, s\u1EA3n ph\u1EA9m ch\u1EDD ch\u1ED7.");
        }
        continue;
      }
      sim.toolStock[id] = (sim.toolStock[id] ?? 0) + 1;
      b.active = null;
      sim.say(kind === "craft" ? `\u0110\xE3 ch\u1EBF xong ${recipeName(r).toLowerCase()}.` : `\u0110\xE3 s\u1EEDa xong ${recipeName(r).toLowerCase()}.`);
    }
  }
}

// src/sim/houses.ts
function bestFor(sim, job) {
  const stat = JOBS[job].stat;
  const pool = sim.villagers.filter((v) => v.down <= 0 && v.inside === null && v.job !== job && v.job !== "fight" && v.job !== "hunt");
  pool.sort((a, b) => (a.job === "idle" ? 0 : 1) - (b.job === "idle" ? 0 : 1) || b.stats[stat] - a.stats[stat]);
  return pool[0] ?? null;
}
function houseRate(sim, b) {
  const job = b.kind === "lab" ? "research" : b.kind === "workshop" ? "craft" : "repair";
  let r = 0;
  for (const id of b.staff) {
    const v = sim.byId.get(id);
    if (v) r += sim.workFactor(v, job);
  }
  return r * levelDef(b).craftSpeed * (sim.dev.fastWorks ? 25 : 1);
}
function staffCount(sim, b) {
  return b.staff.length + sim.villagers.filter((v) => v.phase === "goStaff" && v.target === b.id).length;
}
function crew(sim) {
  return sim.villagers.filter((v) => v.job === "build");
}
function assignCrew(sim, ids) {
  const house = sim.building(CREW_BUILDING.build);
  if (!house) return `Ch\u01B0a c\xF3 ${BUILDINGS.builder.name}, ho\u1EB7c ch\u01B0a x\xE2y xong`;
  let err = null;
  for (const v of sim.mine(ids)) {
    if (v.job === "build") continue;
    if (v.job === "fight") {
      err = "Chi\u1EBFn binh do \u0111\u1ED1ng l\u1EEDa tr\u1EA1i qu\u1EA3n l\xFD: gi\u1EA3i ng\u0169 tr\u01B0\u1EDBc";
      continue;
    }
    if (crew(sim).length >= levelDef(house).slots) {
      err = `${BUILDINGS.builder.name} c\u1EA5p ${house.level} ch\u1EC9 ch\u1EE9a ${levelDef(house).slots} th\u1EE3`;
      continue;
    }
    sim.resetTask(v);
    sim.clearCombat(v);
    v.job = "build";
    v.prefer = -1;
  }
  return err;
}
function trimCrew(sim) {
  const house = sim.building("builder"), builders = crew(sim);
  if (house) for (const v of builders.slice(levelDef(house).slots)) {
    sim.resetTask(v);
    v.job = "idle";
  }
}
function releaseCrew(sim, ids) {
  for (const v of sim.mine(ids)) if (v.job === "build") {
    sim.resetTask(v);
    v.job = "idle";
  }
}
function assignStaff(sim, ids, job) {
  const b = sim.building(STAFF_BUILDING[job]);
  if (!b) return `Ch\u01B0a c\xF3 ${BUILDINGS[STAFF_BUILDING[job]].name}, ho\u1EB7c ch\u01B0a x\xE2y xong`;
  let err = null;
  for (const v of sim.mine(ids)) {
    if (v.inside === b.id) {
      v.job = job;
      continue;
    }
    if (v.job === "fight") {
      err = "Chi\u1EBFn binh do \u0111\u1ED1ng l\u1EEDa tr\u1EA1i qu\u1EA3n l\xFD: gi\u1EA3i ng\u0169 tr\u01B0\u1EDBc";
      continue;
    }
    if (staffCount(sim, b) >= levelDef(b).slots) {
      err = `${BUILDINGS[b.kind].name} c\u1EA5p ${b.level} ch\u1EC9 ch\u1EE9a ${levelDef(b).slots} ng\u01B0\u1EDDi`;
      continue;
    }
    sim.resetTask(v);
    sim.clearCombat(v);
    v.job = job;
    v.prefer = -1;
    planStaff(sim, v);
  }
  return err;
}
function planStaff(sim, v) {
  if (!isStaffJob(v.job)) return;
  const b = sim.building(STAFF_BUILDING[v.job]);
  if (!b) {
    v.job = "idle";
    return;
  }
  if (staffCount(sim, b) >= levelDef(b).slots) {
    v.job = "idle";
    sim.say(`${v.name} kh\xF4ng c\xF2n ch\u1ED7 trong ${BUILDINGS[b.kind].name.toLowerCase()}.`);
    return;
  }
  const d = BUILDINGS[b.kind];
  if (sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) {
    v.target = b.id;
    v.phase = "goStaff";
    return;
  }
  sim.wait(v, 3);
}
function enterBuilding(sim, v) {
  const b = sim.getBuilding(v.target);
  if (!b || !b.done || !isStaffJob(v.job) || STAFF_BUILDING[v.job] !== b.kind || b.staff.length >= levelDef(b).slots) {
    v.phase = "idle";
    if (isStaffJob(v.job)) v.job = "idle";
    return;
  }
  b.staff.push(v.id);
  v.inside = b.id;
  v.phase = "inside";
  v.path = [];
  v.slide = null;
  const d = BUILDINGS[b.kind];
  v.x = b.x + d.w / 2;
  v.y = b.y + d.h / 2;
  v.facing = "front";
  sim.say(`${v.name} v\xE0o ${BUILDINGS[b.kind].name.toLowerCase()} l\xE0m vi\u1EC7c.`);
}
function sleepIn(sim, v, b) {
  v.inside = b.id;
  v.phase = "sleep";
  v.path = [];
  v.slide = null;
  v.target = -1;
  v.bed = -1;
  const d = BUILDINGS[b.kind];
  v.x = b.x + d.w / 2;
  v.y = b.y + d.h / 2;
  v.facing = "front";
  sim.fogDirty = true;
}
function sleepers(sim, b) {
  return sim.villagers.filter((v) => v.phase === "sleep" && v.inside === b.id || v.phase === "goHome" && v.target === b.id);
}
function exitBuilding(sim, v) {
  if (v.inside === null) return;
  const b = sim.getBuilding(v.inside);
  v.inside = null;
  v.phase = "idle";
  if (!b) return;
  b.staff = b.staff.filter((id) => id !== v.id);
  const d = BUILDINGS[b.kind], ring = sim.ringTiles(v, b.x, b.y, d.w, d.h);
  const spot = ring[0] ?? [b.x - 1, b.y + d.h];
  v.x = spot[0] + 0.5;
  v.y = spot[1] + 0.5;
}
function releaseStaff(sim, ids) {
  for (const v of sim.mine(ids)) if (v.inside !== null) {
    exitBuilding(sim, v);
    v.job = "idle";
    sim.fogDirty = true;
  }
}

// src/sim/inventory.ts
function toolCount(sim, kind, tier) {
  const id = `${kind}${tier}`;
  return (sim.toolStock[id] ?? 0) + sim.wornTools.filter((w) => w.id === id && w.dur > 0).length;
}
function toolTier(sim, v, job) {
  const k = job === "idle" ? void 0 : TOOL_OF_JOB[job];
  const t = k ? v.tools[k] : null;
  return t && t.dur > 0 ? t.tier : 0;
}
function toolId(sim, k, tier) {
  return `${k}${tier}`;
}
function heldTool(sim, v) {
  for (const k of TOOL_KINDS) {
    const t = v.tools[k];
    if (t) return { k, t };
  }
  return null;
}
function returnTool(sim, v) {
  const h = heldTool(sim, v);
  if (!h) return;
  const { k, t } = h, id = toolId(sim, k, t.tier), name = `${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t.tier].toLowerCase()}`;
  v.tools[k] = null;
  if (t.dur <= 0) {
    sim.say(`${v.name} b\u1ECF ${name} \u0111\xE3 h\u1ECFng.`);
    return;
  }
  if (t.dur >= TIER_DURABILITY[t.tier] - 1e-6) sim.toolStock[id] = (sim.toolStock[id] ?? 0) + 1;
  else sim.wornTools.push({ id, dur: t.dur });
  sim.say(`${v.name} tr\u1EA3 ${name} v\u1EC1 kho.`);
}
function takeTool(sim, k, tier) {
  const id = toolId(sim, k, tier);
  if ((sim.toolStock[id] ?? 0) > 0) {
    sim.toolStock[id]--;
    return { tier, dur: TIER_DURABILITY[tier] };
  }
  let best = -1;
  sim.wornTools.forEach((w, i) => {
    if (w.id === id && w.dur > 0 && (best < 0 || w.dur > sim.wornTools[best].dur)) best = i;
  });
  return best < 0 ? null : { tier, dur: sim.wornTools.splice(best, 1)[0].dur };
}
function assignTool(sim, ids, k, tier) {
  let short = false, wrong = null, given = 0;
  for (const v of sim.mine(ids)) {
    const cur = v.tools[k];
    if (tier === 0) {
      if (cur) {
        returnTool(sim, v);
        given++;
      }
      continue;
    }
    if (TOOL_OF_JOB[v.job] !== k) {
      wrong = `${v.name} l\xE0m ${JOB_NAME[v.job].toLowerCase()}: kh\xF4ng d\xF9ng ${TOOL_NAME[k].toLowerCase()}`;
      continue;
    }
    if (cur?.tier === tier && cur.dur > 0) continue;
    if (toolCount(sim, k, tier) <= 0) {
      short = true;
      continue;
    }
    returnTool(sim, v);
    v.tools[k] = takeTool(sim, k, tier);
    given++;
    sim.say(`${v.name} \u0111\u01B0\u1EE3c ph\xE1t ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}.`);
  }
  if (given) return null;
  return short ? `Kho h\u1EBFt ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}, h\xE3y ch\u1EBF th\xEAm` : wrong;
}
function discardTool(sim, ids, k) {
  for (const v of sim.mine(ids)) if (v.tools[k]) {
    v.tools[k] = null;
    sim.say(`${v.name} v\u1EE9t ${TOOL_NAME[k].toLowerCase()}.`);
  }
}
function repairTool(sim, ids, k) {
  const house = sim.building("repair");
  if (!house) return "C\u1EA7n d\u1EF1ng Nh\xE0 s\u1EEDa ch\u1EEFa";
  let err = null, n = 0;
  for (const v of sim.mine(ids)) {
    const t = v.tools[k];
    if (!t) continue;
    if (t.dur >= TIER_DURABILITY[t.tier] - 1e-6) {
      err = "C\xF4ng c\u1EE5 c\xF2n m\u1EDBi, ch\u01B0a c\u1EA7n s\u1EEDa";
      continue;
    }
    if (sim.repairQueue.length >= 12) {
      err = "H\xE0ng \u0111\u1EE3i s\u1EEDa \u0111\xE3 \u0111\u1EA7y";
      continue;
    }
    sim.leaveNode(v);
    v.path = [];
    v.slide = null;
    v.order = `repair:${k}`;
    if (!goTo(sim, v, house, "goOrder")) {
      v.order = null;
      err = `${v.name} kh\xF4ng t\u1EDBi \u0111\u01B0\u1EE3c Nh\xE0 s\u1EEDa ch\u1EEFa`;
      continue;
    }
    n++;
    sim.say(`${v.name} mang ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t.tier].toLowerCase()} t\u1EDBi Nh\xE0 s\u1EEDa ch\u1EEFa.`);
  }
  return n ? null : err;
}
function giveGear(sim, ids, kind, slot) {
  for (const v of sim.mine(ids)) {
    if (slot === "weapon") v.weapon = kind;
    else v.armor = kind;
    if (kind) sim.say(`${v.name} \u0111\u01B0\u1EE3c c\u1EA5p ${kind === "hide" ? ARMORS.hide.name.toLowerCase() : WEAPONS[kind].name.toLowerCase()}.`);
  }
}
function assignGear(sim, ids, kind, slot) {
  const key = (k) => k === "hide" ? "hide1" : `${k}${WEAPONS[k].tier ?? 1}`;
  const nameOf = (k) => (k === "hide" ? ARMORS.hide.name : WEAPONS[k].name).toLowerCase();
  const people = sim.mine(ids);
  if (kind && !sim.hasWorkshop() && !sim.building("armory")) return "C\u1EA7n c\xF3 Nh\xE0 ch\u1EBF t\u1EA1o ho\u1EB7c Kho v\u0169 kh\xED \u0111\u1EC3 l\u1EA5y \u0111\u1ED3";
  let given = 0, short = false;
  for (const v of people) {
    const cur = slot === "weapon" ? v.weapon : v.armor;
    if (cur === kind) {
      v.manualGear = true;
      continue;
    }
    if (kind) {
      if (toolCount(sim, kind === "hide" ? "hide" : kind, kind === "hide" ? 1 : WEAPONS[kind].tier ?? 1) <= 0) {
        short = true;
        continue;
      }
      sim.toolStock[key(kind)]--;
    }
    if (cur) sim.toolStock[key(cur)] = (sim.toolStock[key(cur)] ?? 0) + 1;
    if (slot === "weapon") v.weapon = kind;
    else v.armor = kind;
    v.manualGear = true;
    given++;
    sim.say(kind ? `${v.name} \u0111\u01B0\u1EE3c ph\xE1t ${nameOf(kind)}.` : `${v.name} tr\u1EA3 l\u1EA1i ${cur ? nameOf(cur) : "\u0111\u1ED3"}.`);
  }
  return short && given === 0 ? `Kho h\u1EBFt ${kind ? nameOf(kind) : "\u0111\u1ED3"}, h\xE3y ch\u1EBF th\xEAm` : null;
}
function autoGear(sim, ids) {
  for (const v of sim.mine(ids)) v.manualGear = false;
}
function giveTool(sim, ids, kind, tier) {
  for (const id of ids) {
    const v = sim.byId.get(id);
    if (!v) continue;
    for (const k of TOOL_KINDS) v.tools[k] = null;
    v.tools[kind] = tier > 0 ? { tier, dur: TIER_DURABILITY[tier] } : null;
    if (tier > 0 && TOOL_OF_JOB[v.job] !== kind) {
      const job = Object.keys(TOOL_OF_JOB).find((j) => TOOL_OF_JOB[j] === kind);
      if (job && v.team === "player") sim.setJob([v.id], job);
    }
    if (tier > 0) sim.say(`${v.name} \u0111\u01B0\u1EE3c c\u1EA5p ${TOOL_NAME[kind].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}.`);
  }
}
function toolLacking(sim, v, job) {
  const k = TOOL_OF_JOB[job];
  if (!k) return false;
  const t = v.tools[k];
  return !t || t.dur <= 0;
}
function stockedTier(sim, k) {
  for (let t = 2; t >= 1; t--) if (toolCount(sim, k, t) > 0) return t;
  return 0;
}
function needTool(sim, v, job) {
  const k = TOOL_OF_JOB[job];
  return !!k && autoOn(sim.researched, "fetch") && !!sim.building("toolstore") && toolLacking(sim, v, job) && stockedTier(sim, k) > 0;
}
function goTo(sim, v, b, phase) {
  const d = BUILDINGS[b.kind];
  if (sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h)) < 0) return false;
  v.target = b.id;
  v.phase = phase;
  return true;
}
function planTool(sim, v, job) {
  const k = TOOL_OF_JOB[job];
  if (!k || !toolLacking(sim, v, job)) return false;
  const store = sim.building("toolstore");
  if (store && needTool(sim, v, job)) return goTo(sim, v, store, "goEquip");
  if (!autoOn(sim.researched, "order") || v.orderCd > 0) return false;
  v.orderCd = 45;
  const t = v.tools[k], repairHouse = sim.building("repair"), craftHouse = sim.building("workshop");
  if (t && t.dur <= 0 && repairHouse && sim.repairQueue.length < 12) {
    v.order = `repair:${k}`;
    return goTo(sim, v, repairHouse, "goOrder");
  }
  if (!craftHouse) return false;
  let id = "";
  for (let tier = 2; tier >= 1; tier--) if (sim.recipeOpen(`${k}${tier}`)) {
    id = `${k}${tier}`;
    break;
  }
  if (!id) return false;
  const lacking = sim.villagers.filter((o) => o.inside === null && o.job !== "idle" && TOOL_OF_JOB[o.job] === k && toolLacking(sim, o, o.job)).length;
  const onWay = toolCount(sim, k, 1) + toolCount(sim, k, 2) + sim.craftQueue.filter((q) => q.startsWith(k)).length + (craftHouse.active?.id.startsWith(k) ? 1 : 0);
  if (onWay >= lacking || sim.craftQueue.length >= 12) return false;
  v.order = `craft:${id}`;
  return goTo(sim, v, craftHouse, "goOrder");
}
function errand(sim, v) {
  const o = v.order;
  v.order = null;
  v.phase = "idle";
  v.orderCd = 90;
  const b = sim.getBuilding(v.target);
  if (b) sim.faceBuilding(v, b);
  if (!o || !b || !b.done) return;
  const [what, id] = o.split(":");
  if (what === "craft") {
    if (sim.queueCraft(id) === null) sim.say(`${v.name} nh\u1EDD ch\u1EBF ${recipeName(RECIPE_BY_ID[id]).toLowerCase()}.`);
  } else if (what === "repair") {
    const k = id, t = v.tools[k];
    if (t && t.dur < TIER_DURABILITY[t.tier] - 1e-6 && sim.queueRepair(toolId(sim, k, t.tier)) === null) {
      v.tools[k] = null;
      v.repairFor = toolId(sim, k, t.tier);
      sim.say(`${v.name} nh\u1EDD s\u1EEDa ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t.tier].toLowerCase()}.`);
    }
  }
}
function equip(sim, v) {
  v.phase = "idle";
  const store = sim.getBuilding(v.target);
  if (store) sim.faceBuilding(v, store);
  if (v.job === "hunt" || v.job === "fight") {
    equipGear(sim, v);
    return;
  }
  const k = TOOL_OF_JOB[v.job];
  if (!k || !toolLacking(sim, v, v.job)) return;
  const t = stockedTier(sim, k);
  if (!t) return;
  v.tools[k] = takeTool(sim, k, t);
  sim.say(`${v.name} nh\u1EADn ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t].toLowerCase()}.`);
}
function planEquipGear(sim, v) {
  if (v.job !== "hunt" && v.job !== "fight" || v.phase === "fight" || v.manualGear) return false;
  const armory = sim.building("armory");
  if (!armory || !autoOn(sim.researched, "fetch")) return false;
  const wantsWeapon = !v.weapon && !!bestWeapon(sim, v), wantsArmor = v.job === "fight" && !v.armor && toolCount(sim, "hide", 1) > 0;
  if (!wantsWeapon && !wantsArmor) return false;
  return goTo(sim, v, armory, "goEquip");
}
function equipGear(sim, v) {
  const best = !v.weapon ? bestWeapon(sim, v) : null;
  if (best) {
    sim.toolStock[`${best}${WEAPONS[best].tier ?? 1}`]--;
    v.weapon = best;
    sim.say(`${v.name} nh\u1EADn ${WEAPONS[best].name.toLowerCase()}.`);
  }
  if (v.job === "fight" && !v.armor && toolCount(sim, "hide", 1) > 0) {
    sim.toolStock.hide1--;
    v.armor = "hide";
    sim.say(`${v.name} m\u1EB7c ${ARMORS.hide.name.toLowerCase()}.`);
  }
}
function planGearErrand(sim, v) {
  if (v.job !== "hunt" && v.job !== "fight" || v.phase === "fight" || v.manualGear || v.orderCd > 0) return false;
  const house = sim.building("workshop");
  if (!house || !autoOn(sim.researched, "order")) return false;
  const have = (re) => Object.entries(sim.toolStock).some(([id2, n]) => n > 0 && re.test(id2)) || sim.craftQueue.some((id2) => re.test(id2)) || !!house.active && re.test(house.active.id);
  let id = "";
  if (!v.weapon && !have(/^(club|spear|mace)/)) {
    let bestScore = -1;
    for (const w of CRAFTED_WEAPONS) {
      const rid = `${w}${WEAPONS[w].tier ?? 1}`;
      if (!sim.recipeOpen(rid) || w === "mace" && v.job !== "fight") continue;
      const sc = WEAPONS[w].damage / WEAPONS[w].cycle;
      if (sc > bestScore) {
        bestScore = sc;
        id = rid;
      }
    }
  } else if (v.job === "fight" && !v.armor && !have(/^hide/) && sim.recipeOpen("hide1")) id = "hide1";
  v.orderCd = 60;
  if (!id) return false;
  v.order = `craft:${id}`;
  return goTo(sim, v, house, "goOrder");
}

// src/sim/model.ts
var SLEEP_HUNGER = 0.4;
var NAMES_M = ["Bo", "R\xF4", "Gia", "Mun", "L\xF4", "T\xF9", "\u0110a"];
var NAMES_F = ["Tia", "Noa", "Ma", "Pa", "K\xEA", "Ly", "Sa"];
var HAIR = ["#4a2e1a", "#2b1b10", "#6b3f1d", "#c98a3a", "#7a5a3a"];
var SKIN = ["#d9a371", "#e8c4a0", "#c58a5c", "#b87850"];
var NODE_JOB = { tree: "wood", rock: "stone", bush: "food" };
var STAT_KEYS = ["vit", "str", "agi", "int", "sta"];
var XP_MULT = [0, 1, 1.5, 2];
var REACH = { tree: 0.55, rock: 0.62, bush: 0.5 };
var LEFT = 1;
var RIGHT = 2;

// src/sim/commands.ts
function resetTask(sim, v) {
  sim.leaveNode(v);
  sim.exitBuilding(v);
  v.order = null;
  v.path = [];
  v.slide = null;
  v.phase = "idle";
  v.progress = 0;
  v.timer = 0;
  v.target = -1;
  v.bed = -1;
}
function keepWatch(sim, v) {
  if (v.job !== "idle") sim.callUp(v);
}
function clearCombat(sim, v) {
  v.fight.target = null;
  v.fight.mode = "none";
  v.fight.dest = null;
  v.fight.anchor = null;
  v.queue.length = 0;
  v.loot = -1;
  v.fleeT = 0;
}
function mine(sim, ids) {
  return ids.map((id) => sim.byId.get(id)).filter((v) => !!v && v.team === "player" && v.down <= 0 && !sim.sleepLocked(v));
}
function busy(sim, v) {
  return v.phase !== "idle" || v.path.length > 0 || v.fight.mode !== "none";
}
function keepSoldierJob(sim, v) {
  if (v.job !== "fight" && v.job !== "hunt") v.job = "idle";
}
function orderMove(sim, ids, tx, ty, queue = false) {
  const vs = mine(sim, ids);
  vs.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
  const taken = /* @__PURE__ */ new Set();
  for (const v of vs) {
    if (queue && busy(sim, v)) {
      v.queue.push({ k: "move", x: tx, y: ty });
      continue;
    }
    const goal = sim.nearestFree(tx, ty, taken);
    resetTask(sim, v);
    clearCombat(sim, v);
    v.prefer = -1;
    keepSoldierJob(sim, v);
    keepWatch(sim, v);
    if (!goal) continue;
    taken.add(goal[1] * sim.world.size + goal[0]);
    v.path = sim.pathTo(v, goal[0], goal[1], 3e4);
    v.phase = v.path.length ? "move" : "idle";
    if (v.job === "fight") {
      v.fight.mode = "guard";
      v.fight.anchor = { x: goal[0] + 0.5, y: goal[1] + 0.5 };
    }
  }
}
function orderWork(sim, ids, tx, ty) {
  if (!sim.world.inBounds(tx, ty)) return null;
  const idx = ty * sim.world.size + tx;
  const node = sim.world.nodeAt(tx, ty), site = sim.buildingAt(tx, ty);
  let job = null, prefer = -1;
  if (node && sim.fog.state[idx] > 0) {
    job = NODE_JOB[node.kind];
    prefer = idx;
  } else if (site && needsWork(site)) {
    job = "build";
    prefer = site.id;
  }
  if (!job) return null;
  const first = !!site && site.kind === "builder" && !sim.building("builder");
  const workers = mine(sim, ids).filter((v) => v.job === job || first && v.job !== "fight");
  for (const v of workers) {
    resetTask(sim, v);
    clearCombat(sim, v);
    v.job = job;
    v.prefer = prefer;
  }
  return { job, sent: workers.length };
}
function setJob(sim, ids, job) {
  if (job === "fight") return enlist(sim, ids) > 0 ? null : "Ch\u1ECDn d\xE2n th\u01B0\u1EDDng \u0111\u1EC3 tuy\u1EC3n l\xE0m chi\u1EBFn binh";
  const soldiers = mine(sim, ids).filter((v) => v.job === "fight");
  const rest = ids.filter((id) => !soldiers.some((s) => s.id === id));
  const err = jobFor(sim, rest, job);
  return err ?? (soldiers.length ? "Chi\u1EBFn binh do \u0111\u1ED1ng l\u1EEDa tr\u1EA1i qu\u1EA3n l\xFD: gi\u1EA3i ng\u0169 h\u1ECD \u1EDF \u0111\xF3 tr\u01B0\u1EDBc" : null);
}
function jobFor(sim, ids, job) {
  if (job === "craft" || job === "research" || job === "repair") return sim.assignStaff(ids, job);
  if (job === "build") return sim.assignCrew(ids);
  for (const v of mine(sim, ids)) {
    resetTask(sim, v);
    clearCombat(sim, v);
    v.job = job;
    v.prefer = -1;
    keepWatch(sim, v);
  }
  return null;
}
function enlist(sim, ids) {
  let n = 0;
  for (const v of mine(sim, ids)) {
    if (v.job === "fight") continue;
    resetTask(sim, v);
    clearCombat(sim, v);
    v.job = "fight";
    v.prefer = -1;
    v.fight.anchor = null;
    keepWatch(sim, v);
    n++;
  }
  return n;
}
function discharge(sim, ids) {
  let n = 0;
  for (const v of mine(sim, ids)) {
    if (v.job !== "fight") continue;
    resetTask(sim, v);
    clearCombat(sim, v);
    v.job = "idle";
    v.nightOwl = false;
    sim.assignGear([v.id], null, "weapon");
    sim.assignGear([v.id], null, "armor");
    v.manualGear = false;
    n++;
  }
  return n;
}
function targetAt(sim, x, y) {
  const N = sim.world.size, seen = (px, py) => sim.fog.state[Math.floor(py) * N + Math.floor(px)] === 2;
  let best = null, bd = 0.9;
  for (const f of sim.foes) {
    if (f.health <= 0 || !seen(f.x, f.y)) continue;
    const d = Math.hypot(f.x - x, f.y - 0.5 - y);
    if (d < bd) {
      bd = d;
      best = { target: { kind: "unit", id: f.id }, kind: "foe" };
    }
  }
  for (const a of sim.animals) {
    if (!seen(a.x, a.y)) continue;
    const d = Math.hypot(a.x - x, a.y - 0.3 - y);
    if (d < bd) {
      bd = d;
      best = { target: { kind: "animal", id: a.id }, kind: a.state === "dead" ? "carcass" : "animal" };
    }
  }
  return best;
}
function orderAttack(sim, ids, target, queue = false) {
  const e = resolve(sim, target);
  const prey = e?.kind === "animal" && e.a.state !== "dead" && animalDef(e.a).prey;
  let n = 0;
  for (const v of mine(sim, ids)) {
    if (!(v.job === "fight" || prey && v.job === "hunt")) continue;
    n++;
    if (queue && busy(sim, v)) {
      v.queue.push({ k: "attack", t: target });
      continue;
    }
    resetTask(sim, v);
    clearCombat(sim, v);
    v.prefer = -1;
    v.fight.mode = "attack";
    v.fight.target = target;
    keepWatch(sim, v);
  }
  return n;
}
function orderAttackMove(sim, ids, x, y, queue = false) {
  for (const v of mine(sim, ids)) {
    if (v.job !== "fight") continue;
    if (queue && busy(sim, v)) {
      v.queue.push({ k: "attackMove", x, y });
      continue;
    }
    resetTask(sim, v);
    clearCombat(sim, v);
    v.prefer = -1;
    v.fight.mode = "attackMove";
    v.fight.dest = { x, y };
    v.phase = "move";
    keepWatch(sim, v);
  }
}
function orderLoot(sim, ids, animalId) {
  let n = 0;
  for (const v of mine(sim, ids)) {
    if (v.job !== "hunt") continue;
    resetTask(sim, v);
    clearCombat(sim, v);
    v.loot = animalId;
    v.phase = "goCarcass";
    n++;
  }
  return n;
}
function orderHold(sim, ids) {
  for (const v of mine(sim, ids)) {
    if (v.job !== "fight" && v.job !== "hunt") continue;
    resetTask(sim, v);
    clearCombat(sim, v);
    v.fight.mode = "hold";
    v.fight.anchor = { x: v.x, y: v.y };
    keepWatch(sim, v);
  }
}
function orderStop(sim, ids) {
  for (const v of mine(sim, ids)) {
    resetTask(sim, v);
    clearCombat(sim, v);
    if (v.job === "fight") {
      v.fight.mode = "hold";
      v.fight.anchor = { x: v.x, y: v.y };
      keepWatch(sim, v);
    }
  }
}
function setStance(sim, ids, stance) {
  for (const v of mine(sim, ids)) {
    v.stance = stance;
    if (stance === "defensive") v.fight.anchor = v.fight.anchor ?? { x: v.x, y: v.y };
    else if (v.fight.mode !== "hold") v.fight.anchor = null;
  }
}
function nextOrder(sim, v) {
  const o = v.queue.shift();
  if (!o) return false;
  resetTask(sim, v);
  if (o.k === "move") {
    v.fight.mode = "none";
    v.fight.target = null;
    const goal = sim.nearestFree(Math.floor(o.x), Math.floor(o.y), /* @__PURE__ */ new Set());
    if (goal) {
      v.path = sim.pathTo(v, goal[0], goal[1], 3e4);
      v.phase = v.path.length ? "move" : "idle";
      if (v.job === "fight") {
        v.fight.mode = "guard";
        v.fight.anchor = { x: goal[0] + 0.5, y: goal[1] + 0.5 };
      }
    }
  } else if (o.k === "attackMove") {
    v.fight.mode = "attackMove";
    v.fight.dest = { x: o.x, y: o.y };
    v.phase = "move";
  } else {
    v.fight.mode = "attack";
    v.fight.target = o.t;
  }
  return true;
}

// src/sim/labor.ts
function workRate(sim, v, job) {
  return workFactor(sim, v, job);
}
function outdoorFactor(sim, job) {
  return OUTDOOR_JOBS.includes(job) ? WEATHER[sim.weather].work * SEASON_DEF[sim.season].work : 1;
}
function workFactor(sim, v, job) {
  const stat = v.stats[JOBS[job].stat];
  const season = job === "food" ? SEASON_DEF[sim.season].gather : 1;
  const tier = TOOL_OF_JOB[job] ? sim.toolTier(v, job) : -1;
  const tool = tier < 0 ? 1 : tier === 0 ? BARE_HANDS[job] ?? TIER_SPEED[0] : TIER_SPEED[tier];
  return (0.5 + 0.1 * stat) * (1 + 0.2 * v.skill[job].level) * (v.fullness < 25 ? 0.7 : 1) * tool * season * outdoorFactor(sim, job) * sim.restFactor(v);
}
function gainXp(sim, v, job, dt) {
  const s = v.skill[job];
  if (s.level >= MAX_LEVEL) return;
  s.xp += dt * PACE.work * XP_MULT[v.potential[job]];
  if (s.xp >= XP_LEVELS[s.level]) {
    s.level++;
    sim.say(`${v.name} l\xEAn c\u1EA5p ${s.level} ngh\u1EC1 ${JOB_NAME[job].toLowerCase()}.`);
  }
}
function wear(sim, v, job, dt) {
  const k = TOOL_OF_JOB[job], t = k ? v.tools[k] : null;
  if (!k || !t || t.dur <= 0) return;
  t.dur -= dt * PACE.work;
  if (t.dur <= 0) {
    t.dur = 0;
    sim.say(`${TOOL_NAME[k]} ${TIER_NAME[t.tier].toLowerCase()} c\u1EE7a ${v.name} \u0111\xE3 h\u1ECFng.`);
  }
}
function leaveNode(sim, v) {
  if ((v.phase === "goNode" || v.phase === "work") && v.target >= 0) {
    const n = sim.world.nodes.get(v.target);
    if (n) {
      if (n.workers > 0) n.workers--;
      n.sides &= ~v.slot;
    }
  }
  v.slot = 0;
}
function face(sim, v, tx, ty) {
  const dx = tx + 0.5 - v.x, dy = ty + 0.5 - v.y;
  v.facing = Math.abs(dx) > Math.abs(dy) * 1.1 ? dx > 0 ? "right" : "left" : dy > 0 ? "front" : "back";
}
function wait(sim, v, secs) {
  v.phase = "wait";
  v.timer = secs;
}
function faceX(sim, v, cx) {
  v.facing = cx >= v.x ? "right" : "left";
}
function nodeSlide(sim, v, nx, ny, kind) {
  const left = v.slot === LEFT;
  return { x: nx + 0.5 + (left ? -REACH[kind] : REACH[kind]), y: ny + 0.875, face: left ? "right" : "left" };
}
function edgeSlide(sim, v, b) {
  const d = BUILDINGS[b.kind], left = v.x < b.x + d.w / 2;
  return { x: left ? b.x - 0.3 : b.x + d.w + 0.3, y: b.y + d.h - 0.3 - v.id % 2 * 0.5, face: left ? "right" : "left" };
}
function faceBuilding(sim, v, b) {
  faceX(sim, v, b.x + BUILDINGS[b.kind].w / 2);
}
function think(sim, v, dt) {
  const N = sim.world.size;
  switch (v.phase) {
    case "move":
      v.phase = "idle";
      sim.nextOrder(v);
      return;
    case "idle":
      if (v.queue.length && sim.nextOrder(v)) return;
      if (v.job !== "idle") plan(sim, v);
      return;
    case "wait":
      v.timer -= dt;
      if (v.timer <= 0) v.phase = "idle";
      return;
    case "goNode": {
      const n = sim.world.nodes.get(v.target);
      if (!n || n.amount <= 0) {
        leaveNode(sim, v);
        v.phase = "idle";
        return;
      }
      const nx = v.target % N, ny = v.target / N | 0;
      v.phase = "work";
      v.progress = 0;
      const sl = nodeSlide(sim, v, nx, ny, n.kind);
      if (Math.hypot(sl.x - v.x, sl.y - v.y) < 0.04) v.facing = sl.face;
      else v.slide = sl;
      return;
    }
    case "work":
      doWork(sim, v, dt);
      return;
    case "goStore":
      unload(sim, v);
      return;
    case "goEquip":
      sim.equip(v);
      return;
    case "goSite": {
      const b = sim.getBuilding(v.target);
      if (!b || !needsWork(b)) {
        v.phase = "idle";
        return;
      }
      v.phase = "build";
      v.slide = edgeSlide(sim, v, b);
      return;
    }
    case "build": {
      const b = sim.getBuilding(v.target);
      if (!b || !needsWork(b)) {
        v.phase = "idle";
        return;
      }
      const target = b.upgrading ? b.level + 1 : b.level;
      b.progress += dt * PACE.work / (levelDef(b, target).buildTime * (b.rebuild ? 0.5 : 1)) * workFactor(sim, v, "build") * sim.crewSpeed();
      gainXp(sim, v, "build", dt);
      wear(sim, v, "build", dt);
      if (b.progress >= 1) {
        b.progress = 1;
        if (b.upgrading) {
          b.level++;
          b.upgrading = false;
          sim.say(`${BUILDINGS[b.kind].name} \u0111\xE3 l\xEAn c\u1EA5p ${b.level} (${levelDef(b).name.toLowerCase()}).`);
        } else {
          b.done = true;
          b.rebuild = false;
          sim.fogDirty = true;
          if (b.kind === "builder") sim.trimCrew();
          sim.say(`${BUILDINGS[b.kind].name} \u0111\xE3 d\u1EF1ng xong.`);
          if (RESEARCH.enabled && b.kind === "lab" && sim.researched.size === 0) sim.say("M\u1EDF Nh\xE0 nghi\xEAn c\u1EE9u, \u0111\u01B0a m\u1ED9t d\xE2n th\xF4ng minh v\xE0o l\xE0m vi\u1EC7c, r\u1ED3i nghi\xEAn c\u1EE9u b\u1EA3n v\u1EBD \u0111\u1EA7u ti\xEAn.");
        }
        v.phase = "idle";
      }
      return;
    }
    case "goStaff":
      sim.enterBuilding(v);
      return;
    case "goOrder":
      sim.errand(v);
      return;
    case "inside":
      return;
    case "goHome": {
      stash(sim, v);
      const bed = v.target >= 0 ? sim.getBuilding(v.target) : void 0;
      if (bed && bed.done) sim.sleepIn(v, bed);
      else {
        v.phase = "sleep";
        v.facing = "front";
      }
      return;
    }
    case "sleep":
      return;
  }
}
function doWork(sim, v, dt) {
  const job = v.job, def = JOBS[job], n = sim.world.nodes.get(v.target);
  if (!def.res || !n || n.amount <= 0) {
    leaveNode(sim, v);
    v.phase = "idle";
    return;
  }
  v.progress += dt * workFactor(sim, v, job) / def.baseTime;
  gainXp(sim, v, job, dt);
  const tierNow = sim.toolTier(v, job);
  wear(sim, v, job, dt);
  if (v.progress < 1) return;
  v.progress -= 1;
  const res = def.res, acc = v.frac + TIER_YIELD[tierNow], whole = Math.floor(acc);
  const have = v.carry && v.carry.res === res ? v.carry.amount : 0;
  const take = Math.max(0, Math.min(whole, n.amount, CARRY_CAP[res] - have));
  v.frac = acc - whole;
  n.amount -= take;
  v.carry = { res, amount: have + take };
  if (res === "food" && take > 0) {
    sim.coinFrac += 0.06 * take;
    if (sim.coinFrac >= 1) {
      sim.coinFrac -= 1;
      if (sim.stock.coin < sim.capacity()) {
        sim.stock.coin++;
        if (!sim.sawCoin) {
          sim.sawCoin = true;
          sim.say(`${v.name} nh\u1EB7t \u0111\u01B0\u1EE3c m\u1ED9t ${RES_NAME.coin.toLowerCase()}: d\xE2n l\xE0ng d\xF9ng n\xF3 \u0111\u1EC3 trao \u0111\u1ED5i.`);
        }
      }
    }
  }
  if (n.amount <= 0) {
    const idx = v.target;
    leaveNode(sim, v);
    sim.world.depleted(idx);
    v.phase = "idle";
    if (n.kind === "tree") sim.say("M\u1ED9t c\xE2y \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u1ED1n xong.");
  } else if (v.carry.amount >= CARRY_CAP[res] || sim.needTool(v, job)) {
    leaveNode(sim, v);
    v.phase = "idle";
  }
}
function plan(sim, v) {
  if (v.job === "hunt" || v.job === "fight") {
    wait(sim, v, 1);
    return;
  }
  if (v.job === "build") {
    if (!sim.planTool(v, "build")) planBuild(sim, v);
    return;
  }
  if (isStaffJob(v.job)) {
    sim.planStaff(v);
    return;
  }
  const def = JOBS[v.job], res = def.res;
  if (v.carry && (v.carry.res !== res || v.carry.amount >= CARRY_CAP[v.carry.res])) {
    planDeliver(sim, v);
    return;
  }
  if (sim.stock[res] >= sim.capacity(res)) {
    if (v.carry) {
      planDeliver(sim, v);
      return;
    }
    if (sim.time - sim.lastFullWarn > 30) {
      sim.lastFullWarn = sim.time;
      sim.say(`Kho \u0111\xE3 \u0111\u1EA7y ${RES_NAME[res].toLowerCase()}, h\xE3y x\xE2y th\xEAm Kho.`);
    }
    wait(sim, v, 3);
    return;
  }
  if (sim.planTool(v, v.job)) return;
  if (findNode(sim, v, def.node)) return;
  if (v.carry) {
    planDeliver(sim, v);
    return;
  }
  wait(sim, v, 2);
}
function findNode(sim, v, kind) {
  const N = sim.world.size, vx = Math.floor(v.x), vy = Math.floor(v.y);
  const ok2 = (idx) => {
    const n = sim.world.nodes.get(idx);
    return !!n && n.kind === kind && n.amount > 0 && n.workers < 2 && n.sides !== 3 && sim.fog.state[idx] > 0 && (v.bad.get(idx) ?? 0) <= sim.time;
  };
  const cands = [];
  if (v.prefer >= 0 && ok2(v.prefer)) cands.push([-1, v.prefer]);
  for (const [idx, n] of sim.world.nodes) {
    if (n.kind !== kind || n.amount <= 0 || n.workers >= 2 || n.sides === 3 || idx === v.prefer || !ok2(idx)) continue;
    const d = (idx % N - vx) ** 2 + ((idx / N | 0) - vy) ** 2;
    if (d <= 70 * 70) cands.push([d, idx]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  for (let c = 0; c < Math.min(4, cands.length); c++) {
    const idx = cands[c][1], nx = idx % N, ny = idx / N | 0, node = sim.world.nodes.get(idx);
    const opts = [];
    for (const side of [LEFT, RIGHT]) {
      if (node.sides & side) continue;
      const sx = side === LEFT ? -1 : 1;
      const near2 = [[sx, 0, 0], [sx, 1, 0.6], [sx, -1, 1.6], [0, 1, 1.2], [0, -1, 2.4]];
      for (const [dx, dy, pen] of near2) if (!sim.world.isBlocked(nx + dx, ny + dy)) opts.push({ t: [nx + dx, ny + dy], side, pen });
    }
    const cost = (o) => Math.hypot(o.t[0] + 0.5 - v.x, o.t[1] + 0.5 - v.y) + o.pen;
    opts.sort((a, b) => cost(a) - cost(b));
    const k = sim.routeTo(v, opts.map((o) => o.t), 4);
    if (k >= 0) {
      node.workers++;
      node.sides |= opts[k].side;
      v.slot = opts[k].side;
      v.target = idx;
      v.phase = "goNode";
      v.prefer = -1;
      return true;
    }
    v.bad.set(idx, sim.time + 30);
  }
  if (v.prefer >= 0) {
    if (sim.world.nodes.has(v.prefer) && (v.bad.get(v.prefer) ?? 0) > sim.time) sim.say(`${v.name} kh\xF4ng t\xECm \u0111\u01B0\u1EE3c \u0111\u01B0\u1EDDng t\u1EDBi ngu\u1ED3n \u0111\xE3 ch\u1ECDn.`);
    v.prefer = -1;
  }
  return false;
}
function planDeliver(sim, v) {
  const done = sim.buildings.filter((b) => b.done && holdsGoods(b));
  done.sort((a, b) => Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
  for (const b of done.slice(0, 2)) {
    const d = BUILDINGS[b.kind];
    if (sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) {
      v.target = b.id;
      v.phase = "goStore";
      return;
    }
  }
  wait(sim, v, 2);
}
function stash(sim, v) {
  const c = v.carry;
  if (!c) return;
  const moved = Math.min(Math.max(0, sim.capacity(c.res) - sim.stock[c.res]), c.amount);
  sim.stock[c.res] += moved;
  c.amount -= moved;
  if (c.amount <= 0) v.carry = null;
}
function unload(sim, v) {
  const c = v.carry, st = sim.getBuilding(v.target);
  if (st) faceBuilding(sim, v, st);
  if (!c) {
    v.phase = "idle";
    return;
  }
  const space = Math.max(0, sim.capacity(c.res) - sim.stock[c.res]), moved = Math.min(space, c.amount);
  sim.stock[c.res] += moved;
  c.amount -= moved;
  if (c.amount <= 0) {
    v.carry = null;
    v.phase = "idle";
    return;
  }
  if (sim.time - sim.lastFullWarn > 30) {
    sim.lastFullWarn = sim.time;
    sim.say(`Kho \u0111\xE3 \u0111\u1EA7y ${RES_NAME[c.res].toLowerCase()}, h\xE3y x\xE2y th\xEAm Kho.`);
  }
  wait(sim, v, 3);
}
function planBuild(sim, v) {
  const onSite = (b) => sim.villagers.filter((o) => o !== v && o.target === b.id && (o.phase === "goSite" || o.phase === "build")).length;
  const house = !!sim.building("builder");
  let sites = sim.buildings.filter((b) => needsWork(b) && (house || b.kind === "builder") && onSite(b) < 3);
  sites.sort((a, b) => (b.id === v.prefer ? 1 : 0) - (a.id === v.prefer ? 1 : 0) || Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
  sites = sites.slice(0, 2);
  for (const b of sites) {
    const d = BUILDINGS[b.kind];
    if (sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) {
      v.target = b.id;
      v.phase = "goSite";
      v.prefer = -1;
      return;
    }
  }
  wait(sim, v, 2);
}

// src/sim/path.ts
var SQ2 = Math.SQRT2;
var MinHeap = class {
  constructor(key) {
    this.key = key;
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  push(n) {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = i - 1 >> 1;
      if (this.key[a[p]] <= this.key[a[i]]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (; ; ) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.key[a[l]] < this.key[a[m]]) m = l;
        if (r < a.length && this.key[a[r]] < this.key[a[m]]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
};
function findPath(world, sx, sy, gx, gy, maxNodes = 3e4) {
  const N = world.size, total = N * N;
  if (!world.inBounds(sx, sy) || !world.inBounds(gx, gy)) return [];
  const g = new Float32Array(total).fill(Infinity);
  const f = new Float32Array(total);
  const parent = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const heap = new MinHeap(f);
  const h = (x, y) => {
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return dx + dy + (SQ2 - 2) * Math.min(dx, dy);
  };
  const start = sy * N + sx, goal = gy * N + gx;
  g[start] = 0;
  f[start] = h(sx, sy);
  heap.push(start);
  let best = start, bestH = f[start], expanded = 0;
  while (heap.size && expanded < maxNodes) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded++;
    if (cur === goal) {
      best = cur;
      break;
    }
    const cx = cur % N, cy = cur / N | 0;
    const hh = h(cx, cy);
    if (hh < bestH) {
      bestH = hh;
      best = cur;
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (world.isBlocked(nx, ny)) continue;
        if (dx && dy && (world.isBlocked(cx + dx, cy) || world.isBlocked(cx, cy + dy))) continue;
        const ni = ny * N + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + (dx && dy ? SQ2 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          f[ni] = ng + h(nx, ny);
          parent[ni] = cur;
          heap.push(ni);
        }
      }
    }
  }
  const out = [];
  for (let n = best; n !== start && n !== -1; n = parent[n]) out.push([n % N, n / N | 0]);
  return out.reverse();
}

// src/sim/movement.ts
function nearestFree(sim, tx, ty, taken) {
  const N = sim.world.size;
  for (let r = 0; r <= 12; r++) {
    let best = null, bd = Infinity;
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
        if (sim.world.isBlocked(x, y) || taken.has(y * N + x)) continue;
        const d = (x - tx) ** 2 + (y - ty) ** 2;
        if (d < bd) {
          bd = d;
          best = [x, y];
        }
      }
    }
    if (best) return best;
  }
  return null;
}
function moveUnit(sim, v, dt) {
  const walk = v.speed * WEATHER[sim.weather].speed * (v.phase === "flee" ? 1.3 : 1) * (v.armor ? 1 : 1);
  if (v.swing) return;
  let left = walk * dt;
  while (left > 0 && v.path.length) {
    const [px, py] = v.path[0];
    const dx = px + 0.5 - v.x, dy = py + 0.5 - v.y, d = Math.hypot(dx, dy);
    if (d <= left) {
      v.x = px + 0.5;
      v.y = py + 0.5;
      left -= d;
      v.path.shift();
    } else {
      v.x += dx / d * left;
      v.y += dy / d * left;
      left = 0;
    }
    if (d > 1e-6) v.facing = Math.abs(dx) > Math.abs(dy) * 1.1 ? dx > 0 ? "right" : "left" : dy > 0 ? "front" : "back";
  }
  if (!v.path.length && v.slide) {
    const s = v.slide, dx = s.x - v.x, dy = s.y - v.y, d = Math.hypot(dx, dy), step2 = walk * 0.7 * dt;
    if (d <= step2) {
      v.x = s.x;
      v.y = s.y;
      v.slide = null;
      v.facing = s.face;
    } else {
      v.x += dx / d * step2;
      v.y += dy / d * step2;
      if (Math.abs(dx) > 0.02) v.facing = dx > 0 ? "right" : "left";
    }
  }
}
function animate(sim, v, dt) {
  let anim = "idle", hold = null;
  const walking = v.path.length > 0 || !!v.slide;
  const armed = () => {
    if (!v.weapon) return null;
    const w = weaponOf(v);
    return { kind: v.weapon, tier: w.tier ?? 1 };
  };
  const ready = v.phase === "fight" || v.fight.mode !== "none";
  const carrying = !!v.weapon && (v.job === "fight" || v.job === "hunt");
  if (v.down > 0) anim = "down";
  else if (v.swing) {
    anim = poseOf(v.weapon, "attack");
    hold = armed();
  } else if (v.flinch > 0) anim = "hit";
  else if (v.phase === "flee") anim = "run";
  else if (ready) {
    anim = poseOf(v.weapon, walking ? "charge" : "guard");
    hold = armed();
  } else if (walking) {
    anim = v.carry && v.carry.amount > 0 ? "carry_walk" : "walk";
    if (carrying && !(v.carry && v.carry.amount > 0)) {
      anim = poseOf(v.weapon, "walk");
      hold = armed();
    }
  } else if (carrying && v.phase === "idle") {
    anim = poseOf(v.weapon, "idle");
    hold = armed();
  } else if (v.phase === "work" && v.job !== "idle") {
    const k = TOOL_OF_JOB[v.job], tier = sim.toolTier(v, v.job);
    if (k && tier > 0) {
      anim = JOBS[v.job].anim === "gather" ? "dig" : JOBS[v.job].anim;
      hold = { kind: k, tier };
    } else anim = "gather";
  } else if (v.phase === "build") {
    const t = sim.toolTier(v, "build");
    if (t > 0) {
      anim = "build";
      hold = { kind: "hammer", tier: t };
    } else anim = "gather";
  } else if (v.phase === "skin") anim = "gather";
  const lit = !!v.torch && sim.resting && v.phase !== "sleep" && v.phase !== "goHome";
  if (lit !== v.lit) {
    v.lit = lit;
    sim.fogDirty = true;
  }
  if (anim !== v.anim) {
    v.anim = anim;
    v.animClock = 0;
  } else v.animClock += dt;
  v.hold = hold;
}
function ringTiles(sim, v, x, y, w, h) {
  const out = [];
  for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
    if (i >= x && i < x + w && j >= y && j < y + h) continue;
    if (!sim.world.isBlocked(i, j)) out.push([i, j]);
  }
  const cost = (t) => Math.hypot(t[0] + 0.5 - v.x, t[1] + 0.5 - v.y) + (t[0] >= x && t[0] < x + w ? 1.5 : 0);
  out.sort((a, b) => cost(a) - cost(b));
  return out;
}
function standTile(sim, v) {
  const fx = Math.floor(v.x), fy = Math.floor(v.y);
  if (!sim.world.isBlocked(fx, fy)) return [fx, fy];
  let best = [fx, fy], bd = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = fx + dx, y = fy + dy;
    if (sim.world.isBlocked(x, y)) continue;
    const d = Math.hypot(x + 0.5 - v.x, y + 0.5 - v.y);
    if (d < bd) {
      bd = d;
      best = [x, y];
    }
  }
  return best;
}
function pathTo(sim, v, gx, gy, maxNodes = 14e3) {
  const [sx, sy] = standTile(sim, v), off = sx !== Math.floor(v.x) || sy !== Math.floor(v.y);
  const p = gx === sx && gy === sy ? [] : findPath(sim.world, sx, sy, gx, gy, maxNodes);
  return off ? [[sx, sy], ...p] : p;
}
function routeTo(sim, v, tiles, tries = 3) {
  const [sx, sy] = standTile(sim, v);
  for (let k = 0; k < Math.min(tries, tiles.length); k++) {
    const [gx, gy] = tiles[k];
    const p = pathTo(sim, v, gx, gy), last = p[p.length - 1];
    if (gx === sx && gy === sy || last && last[0] === gx && last[1] === gy) {
      v.path = p;
      return k;
    }
  }
  return -1;
}

// src/sim/villagers.ts
function freshName(sim, sex, rnd) {
  const pool = (sex === "m" ? NAMES_M : NAMES_F).filter((n) => !sim.villagers.some((v) => v.name === n));
  const list = pool.length ? pool : sex === "m" ? NAMES_M : NAMES_F;
  return list[Math.floor(rnd() * list.length)];
}
function spawn(sim, x, y, sex) {
  const v = makeVillager(sim, x, y, sex, "player");
  sim.villagers.push(v);
  sim.byId.set(v.id, v);
  return v;
}
function makeVillager(sim, x, y, sex, team, rnd = sim.rnd) {
  const r = rnd, pick = (a) => a[Math.floor(r() * a.length)];
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = 3 + Math.floor(r() * 8);
  const potential = {}, skill = {};
  for (const j of WORK_JOBS) {
    if (j === "hunt" || j === "fight" || j === "research") {
      const k = j === "hunt" ? stats.agi : j === "research" ? stats.int : stats.str;
      potential[j] = k >= 9 ? 3 : k >= 6 ? 2 : 1;
      skill[j] = { xp: 0, level: 0 };
      continue;
    }
    const p = r();
    potential[j] = p < 0.45 ? 1 : p < 0.85 ? 2 : 3;
    skill[j] = { xp: 0, level: 0 };
  }
  return {
    id: sim.nextVid++,
    name: freshName(sim, sex, rnd),
    look: { sex, skin: pick(SKIN), hair: pick(HAIR), hide: "#8b6a45", pants: "#3f63a8" },
    x: x + 0.5,
    y: y + 0.5,
    path: [],
    slide: null,
    facing: "front",
    speed: 1.6 + 0.1 * stats.agi,
    animClock: 0,
    tx: -1,
    ty: -1,
    stats,
    potential,
    skill,
    tools: emptyToolSet(),
    job: "idle",
    phase: "idle",
    slot: 0,
    target: -1,
    prefer: -1,
    progress: 0,
    frac: 0,
    timer: 0,
    order: null,
    carry: null,
    fullness: 100,
    health: maxHpOf(stats.vit),
    starving: false,
    anim: "idle",
    hold: null,
    bad: /* @__PURE__ */ new Map(),
    bed: -1,
    nightOwl: false,
    energy: 100,
    strain: 0,
    shift: "day",
    torch: null,
    lockUntil: 0,
    lit: false,
    manualGear: false,
    inside: null,
    orderCd: 0,
    repairFor: null,
    team,
    maxHealth: maxHpOf(stats.vit),
    weapon: null,
    armor: null,
    morale: MORALE.start,
    stance: "aggressive",
    fight: { mode: "none", target: null, dest: null, anchor: null, repath: 0, scan: 0 },
    queue: [],
    atkCd: 0,
    down: 0,
    rescue: 0,
    fleeT: 0,
    calm: 99,
    loot: -1,
    leader: false,
    swing: null,
    flinch: 0,
    ai: null
  };
}
function tickVillager(sim, v, dt) {
  tickCommon(sim, v, dt);
  if (v.down > 0) {
    tickDown(sim, v, dt);
    sim.animate(v, dt);
    return;
  }
  v.fullness -= sim.dev.noHunger ? 0 : dt * 100 * (v.phase === "sleep" ? SLEEP_HUNGER : 1) / DAY_LENGTH;
  if (v.fullness < 50 && sim.stock.food >= 2) {
    sim.stock.food -= 2;
    v.fullness = Math.min(100, v.fullness + 2 * FOOD_NUTRITION);
  }
  if (v.fullness <= 0) {
    if (!v.starving) {
      v.starving = true;
      sim.say(`${v.name} \u0111\xF3i l\u1EA3, kho h\u1EBFt th\u1EE9c \u0103n!`);
    }
    v.fullness = 0;
    v.health -= dt * v.maxHealth / (1.5 * DAY_LENGTH);
  } else {
    v.starving = false;
    if (v.fullness > 40 && v.health < v.maxHealth && v.calm > 10) v.health = Math.min(v.maxHealth, v.health + dt * 15e-4 * v.maxHealth);
  }
  if (v.health <= 0) {
    sim.kill(v);
    return;
  }
  v.orderCd = Math.max(0, v.orderCd - dt);
  sim.tickEnergy(v, dt);
  const held = sim.heldTool(v);
  if (held && TOOL_OF_JOB[v.job] !== held.k) sim.returnTool(v);
  if (v.inside !== null && v.phase !== "sleep") {
    if (sim.shouldSleep(v, false)) {
      sim.exitBuilding(v);
      goHome(sim, v);
    } else {
      sim.animate(v, dt);
      return;
    }
  }
  const brained = brainPlayer(sim, v, dt);
  const fighting = brained && (v.phase === "fight" || v.phase === "flee" || v.phase === "rescue");
  const asleep = v.phase === "goHome" || v.phase === "sleep";
  if (sim.shouldSleep(v, fighting)) {
    if (!asleep) goHome(sim, v);
  } else if (asleep) {
    sim.exitBuilding(v);
    v.path = [];
    v.slide = null;
    v.phase = "idle";
    v.bed = -1;
  }
  sim.moveUnit(v, dt);
  if (Math.floor(v.x) !== v.tx || Math.floor(v.y) !== v.ty) sim.fogDirty = true;
  if (!v.path.length && !v.slide && !brained) sim.think(v, dt);
  sim.animate(v, dt);
}
function goHome(sim, v) {
  const owl = v.nightOwl;
  sim.stash(v);
  sim.resetTask(v);
  v.nightOwl = owl;
  v.phase = "sleep";
  const bed = sim.freeBed(v);
  if (bed) {
    const bd = BUILDINGS[bed.kind];
    if (sim.routeTo(v, sim.ringTiles(v, bed.x, bed.y, bd.w, bd.h)) >= 0) {
      v.target = bed.id;
      v.phase = "goHome";
      return;
    }
  }
  const fire = sim.buildings.find((b) => b.kind === "campfire");
  if (!fire) return;
  const d = BUILDINGS[fire.kind];
  const taken = new Set(sim.villagers.filter((o) => o !== v && o.bed >= 0).map((o) => o.bed));
  const spot = sim.nearestFree(fire.x + (d.w >> 1), fire.y + d.h, taken);
  if (!spot || sim.routeTo(v, [spot], 1) < 0) return;
  v.bed = spot[1] * sim.world.size + spot[0];
  v.phase = "goHome";
}
function pickLeaders(sim) {
  const fighters = sim.villagers.filter((v) => v.job === "fight" && v.health > 0 && v.down <= 0);
  for (const v of sim.villagers) v.leader = false;
  if (fighters.length >= 5) fighters.sort((a, b) => b.stats.str + b.stats.agi - a.stats.str - a.stats.agi)[0].leader = true;
}

// src/sim/environment.ts
function tickCalendar(sim) {
  const day = sim.day;
  if (day !== sim.lastDay) {
    sim.lastDay = day;
    sim.weather = sim.nextWeather;
    sim.nextWeather = rollWeather(seasonOf(day + 1), sim.wrnd());
    sim.signalled = false;
    const season = seasonOf(day);
    if (season !== sim.world.season) {
      sim.world.setSeason(season);
      sim.say(SEASON_DEF[season].enter);
    }
    if (sim.weather !== "clear") sim.say(`H\xF4m nay: ${WEATHER[sim.weather].name.toLowerCase()}.`);
  }
  if (!sim.signalled && sim.tod >= 0.5) {
    sim.signalled = true;
    const sig = WEATHER[sim.nextWeather].signal;
    if (sig && sim.nextWeather !== sim.weather) sim.say(sig);
  }
  const rest = isRestTime(sim.tod, sim.season);
  if (sim.resting !== rest) for (const v of sim.villagers) {
    v.nightOwl = false;
    if (!rest) sim.returnTorch(v);
  }
  sim.resting = rest;
}
var TORCH_VISION = 6;
function refreshFog(sim) {
  const r = visionRadius(sim), fire = fireRadius(sim);
  sim.lastVision = r;
  const src = sim.villagers.map((v) => ({ x: v.x, y: v.y, r: v.lit ? Math.max(r, TORCH_VISION) : r }));
  for (const b of sim.buildings) if (b.done) {
    const d = BUILDINGS[b.kind];
    src.push({ x: b.x + d.w / 2, y: b.y + d.h / 2, r: b.kind === "campfire" ? fire : r });
  }
  sim.fog.update(src);
  for (const v of sim.villagers) {
    v.tx = Math.floor(v.x);
    v.ty = Math.floor(v.y);
  }
}
function visionRadius(sim) {
  return Math.max(1, Math.round(NIGHT_VISION + (VISION - NIGHT_VISION) * sim.light) - WEATHER[sim.weather].vision);
}
function fireRadius(sim) {
  return Math.max(1, FIRE_VISION - WEATHER[sim.weather].vision);
}

// src/sim/codec.ts
function encode(value) {
  if (value === void 0 || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : { $: "num", v: String(value) };
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(encode);
  if (value instanceof Map) return { $: "map", v: [...value].map(([k, x]) => [encode(k), encode(x)]) };
  if (value instanceof Set) return { $: "set", v: [...value].map(encode) };
  if (typeof value === "object") {
    const out = {};
    for (const [k, x] of Object.entries(value)) if (x !== void 0 && typeof x !== "function") out[k] = encode(x);
    return out;
  }
  throw new Error(`cannot save a ${typeof value}`);
}
function decode(json) {
  if (Array.isArray(json)) return json.map(decode);
  if (json && typeof json === "object") {
    const o = json;
    if (o.$ === "num") return Number(o.v);
    if (o.$ === "map") return new Map(o.v.map(([k, x]) => [decode(k), decode(x)]));
    if (o.$ === "set") return new Set(o.v.map(decode));
    const out = {};
    for (const [k, x] of Object.entries(json)) out[k] = decode(x);
    return out;
  }
  return json;
}
function packRuns(data) {
  const out = [];
  for (let i = 0; i < data.length; ) {
    let j = i + 1;
    while (j < data.length && data[j] === data[i]) j++;
    out.push(data[i], j - i);
    i = j;
  }
  return out;
}
function unpackRuns(runs, target) {
  let at = 0;
  for (let i = 0; i < runs.length; i += 2) {
    target.fill(runs[i], at, at + runs[i + 1]);
    at += runs[i + 1];
  }
  if (at !== target.length) throw new Error(`saved array has ${at} cells, expected ${target.length}`);
}

// src/sim/save.ts
var SAVE_VERSION = 2;
var SAVED = {
  /** Single values. */
  scalars: ["era", "time", "acc", "coinFrac", "sawCoin", "nextRaid", "nextAid", "nextVid", "nextBid", "moraleClock", "tribeClock", "lastFullWarn", "lastMatWarn", "weather", "nextWeather", "lastDay", "signalled", "resting", "lastVision", "pendingTribe", "fogDirty"],
  /** Objects whose keys are filled in place. */
  records: ["stock", "toolStock"],
  /** Lists of plain data. */
  lists: ["wornTools", "craftQueue", "researchQueue", "repairQueue", "log", "foodLots", "villagers", "buildings", "foes", "events", "animals", "projectiles"],
  /** Handled by hand below. */
  special: ["researched", "tribes", "world", "fog", "rnd", "frnd", "wrnd"]
};
function toSave(sim) {
  const w = sim.world;
  const pick = (keys) => Object.fromEntries(keys.map((k) => [k, encode(sim[k])]));
  return {
    version: SAVE_VERSION,
    seed: sim.seed,
    scalars: pick(SAVED.scalars),
    records: pick(SAVED.records),
    lists: pick(SAVED.lists),
    researched: [...sim.researched],
    tribes: sim.tribes.map(({ def: _def, ...t }) => encode(t)),
    rng: { rnd: sim.rnd.getState(), frnd: sim.frnd.getState(), wrnd: sim.wrnd.getState() },
    world: {
      season: w.season,
      tiles: packRuns(w.tiles),
      occ: packRuns(w.occ),
      decor: packRuns(w.decor),
      nodes: [...w.nodes].map(([i, n]) => [i, n.kind, n.res, n.amount, n.max, n.workers, n.sides, n.regrow])
    },
    fog: { state: packRuns(sim.fog.state), version: sim.fog.version }
  };
}
var MIGRATIONS = {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  // 1 -> 2: villagers gained energy, strain, a shift and a torch; the torch blueprint became a known technology
  1: (d) => {
    for (const list of [d.lists.villagers, d.lists.foes]) {
      for (const v of list) {
        v.energy ??= 100;
        v.strain ??= 0;
        v.shift ??= "day";
        v.torch ??= null;
        v.lockUntil ??= 0;
        v.lit ??= false;
      }
    }
    if (!d.researched.includes("torch1")) d.researched.push("torch1");
    return { ...d, version: 2 };
  }
};
function migrate(raw) {
  let d = raw;
  if (!d || typeof d !== "object" || typeof d.version !== "number") throw new Error("this is not a saved game");
  if (d.version > SAVE_VERSION) throw new Error(`this game was saved by a newer version (${d.version}); this one reads up to ${SAVE_VERSION}`);
  while (d.version < SAVE_VERSION) {
    const step2 = MIGRATIONS[d.version];
    if (!step2) throw new Error(`no way to read saved games of version ${d.version}`);
    d = step2(d);
  }
  return d;
}
function applySave(sim, data) {
  if (data.seed !== sim.seed) throw new Error(`the save is of world ${data.seed}, this game is world ${sim.seed}`);
  const w = sim.world, target = sim;
  unpackRuns(data.world.tiles, w.tiles);
  unpackRuns(data.world.occ, w.occ);
  unpackRuns(data.world.decor, w.decor);
  w.nodes.clear();
  for (const [i, kind, res, amount, max, workers, sides, regrow] of data.world.nodes) {
    w.nodes.set(i, { kind, res, amount, max, workers, sides, regrow });
  }
  w.season = data.world.season;
  unpackRuns(data.fog.state, sim.fog.state);
  sim.fog.version = data.fog.version;
  for (const k of SAVED.scalars) target[k] = decode(data.scalars[k]);
  for (const k of SAVED.records) {
    const rec = target[k];
    for (const key of Object.keys(rec)) delete rec[key];
    Object.assign(rec, k === "stock" ? emptyStock() : {}, decode(data.records[k]));
  }
  for (const k of SAVED.lists) {
    const list = target[k];
    list.length = 0;
    list.push(...decode(data.lists[k]));
  }
  sim.researched.clear();
  for (const id of data.researched) sim.researched.add(id);
  sim.tribes.length = 0;
  for (const t of data.tribes) {
    const tribe = decode(t);
    sim.tribes.push({ ...tribe, def: TRIBES[tribe.id] });
  }
  sim.rnd.setState(data.rng.rnd);
  sim.frnd.setState(data.rng.frnd);
  sim.wrnd.setState(data.rng.wrnd);
  sim.byId.clear();
  for (const v of sim.villagers) sim.byId.set(v.id, v);
  for (const f of sim.foes) sim.byId.set(f.id, f);
  sim.animalById.clear();
  for (const a of sim.animals) sim.animalById.set(a.id, a);
  RES_NAME.coin = CURRENCY[sim.era];
}

// src/data/rest.json
var rest_default = {
  _note: "Energy (s\u1EE9c) of a villager, 0-100. Costs are percentage points. A day's heavy work costs dayCost over the waking hours, a night shift nightCost over the night; jobWeight scales it per job. Sleep gives back sleepNight points over one night of sleep (half that by day) in a Nh\xE0 d\xE2n; sleepAt scales it by where they lie down: by the campfire (no bed free) it is slower, in the Nh\xE0 d\xE2n or the L\u1EC1u chi\u1EBFn binh (soldiers) it is full, and a higher level of the house multiplies it again (its craftSpeed). Below tired a villager must sleep and cannot be woken until wakeAfterTired (wakeAfterCollapse if they fell asleep below collapse). Strain builds up from night work and from collapsing, and wears off with sleep; it lowers the energy ceiling and slows recovery, so nobody can be worked night after night. Night work needs a torch and goes at nightEfficiency.",
  tired: 20,
  collapse: 10,
  wakeAfterTired: 50,
  wakeAfterCollapse: 60,
  dayCost: 42,
  nightCost: 30,
  sleepNight: 60,
  sleepDay: 30,
  sleepAt: { campfire: 0.6, house: 1, barracks: 1 },
  nightEfficiency: 0.7,
  tiredEfficiency: 0.7,
  tiredBelow: 40,
  torchBurn: 600,
  jobWeight: { wood: 1, stone: 1, build: 0.95, fight: 0.8, hunt: 0.9, food: 0.7, craft: 0.6, repair: 0.6, research: 0.5, idle: 0.15 },
  strain: { nightWork: 0.1, collapse: 15, nightSleep: 0.12, daySleep: 0.03, capLoss: 0.4, recoveryLoss: 67e-4, moraleLoss: 4e-3 }
};

// src/sim/rest.ts
var REST = rest_default;
var DAY_HOURS = DAY_LENGTH * 0.65;
var NIGHT_HOURS = DAY_LENGTH * 0.35;
var clamp = (x, a, b) => Math.max(a, Math.min(b, x));
var fit = (v) => clamp((v.stats.vit + v.stats.sta) / 20, 0, 1);
var hpFrac = (v) => clamp(v.health / v.maxHealth, 0, 1);
function maxEnergy(_sim, v) {
  return 100 - v.strain * REST.strain.capLoss;
}
function drainRate(sim, v) {
  if (v.phase === "sleep" || v.phase === "down") return 0;
  const w = REST.jobWeight[v.job] ?? REST.jobWeight.idle;
  let k;
  switch (v.phase) {
    case "work":
    case "build":
    case "craft":
    case "inside":
    case "skin":
      k = w;
      break;
    case "fight":
      k = w * 1.8;
      break;
    case "flee":
      k = 1.2;
      break;
    case "idle":
    case "wait":
      k = REST.jobWeight.idle;
      break;
    case "goHome":
      k = 0.3;
      break;
    default:
      k = w * 0.8;
  }
  const cond = (1.25 - 0.25 * fit(v)) * (1.2 - 0.2 * (v.morale / 100)) * (1.3 - 0.3 * hpFrac(v));
  return REST.dayCost / DAY_HOURS * k * cond;
}
var bedKind = (v) => v.job === "fight" ? "barracks" : "house";
function bedsTaken(sim, b, except) {
  return sim.villagers.filter((o) => o !== except && (o.phase === "sleep" && o.inside === b.id || o.phase === "goHome" && o.target === b.id)).length;
}
function freeBed(sim, v) {
  const b = sim.building(bedKind(v));
  return b && bedsTaken(sim, b, v) < levelDef(b).slots ? b : void 0;
}
function bedFactor(sim, v) {
  const b = v.inside === null ? void 0 : sim.getBuilding(v.inside);
  return b && (b.kind === "house" || b.kind === "barracks") ? REST.sleepAt[b.kind] * levelDef(b).craftSpeed : REST.sleepAt.campfire;
}
function sleepRate(sim, v) {
  const base = (sim.resting ? REST.sleepNight : REST.sleepDay) / NIGHT_HOURS;
  const q = (0.8 + 0.4 * fit(v)) * (0.85 + 0.15 * (v.morale / 100)) * (0.7 + 0.3 * hpFrac(v)) * Math.max(0.3, 1 - v.strain * REST.strain.recoveryLoss);
  return base * q * bedFactor(sim, v);
}
function sleepLocked(_sim, v) {
  return v.lockUntil > 0 && v.energy < v.lockUntil && (v.phase === "sleep" || v.phase === "goHome");
}
function restFactor(sim, v) {
  const night = sim.resting ? REST.nightEfficiency : 1;
  const tired = v.energy >= REST.tiredBelow ? 1 : REST.tiredEfficiency + (1 - REST.tiredEfficiency) * (v.energy / REST.tiredBelow);
  return night * tired;
}
function torchCount(sim) {
  return (sim.toolStock.torch1 ?? 0) + sim.wornTools.filter((w) => w.id === "torch1" && w.dur > 0).length;
}
function ensureTorch(sim, v) {
  if (v.torch) return true;
  if ((sim.toolStock.torch1 ?? 0) > 0) {
    sim.toolStock.torch1--;
    v.torch = { dur: REST.torchBurn };
    return true;
  }
  let best = -1;
  sim.wornTools.forEach((w, i) => {
    if (w.id === "torch1" && w.dur > 0 && (best < 0 || w.dur > sim.wornTools[best].dur)) best = i;
  });
  if (best >= 0) {
    v.torch = { dur: sim.wornTools.splice(best, 1)[0].dur };
    return true;
  }
  return false;
}
function returnTorch(sim, v) {
  const t = v.torch;
  if (!t) return;
  v.torch = null;
  if (t.dur <= 5) return;
  if (t.dur >= REST.torchBurn - 1) sim.toolStock.torch1 = (sim.toolStock.torch1 ?? 0) + 1;
  else sim.wornTools.push({ id: "torch1", dur: t.dur });
}
function giveTorch(sim, ids) {
  let short = false, given = 0;
  for (const v of sim.mine(ids)) {
    if (v.torch) continue;
    if (ensureTorch(sim, v)) {
      given++;
      sim.say(`${v.name} c\u1EA7m \u0111u\u1ED1c.`);
    } else short = true;
  }
  return short && !given ? "Kho h\u1EBFt \u0111u\u1ED1c, h\xE3y ch\u1EBF th\xEAm \u1EDF Nh\xE0 ch\u1EBF t\u1EA1o" : null;
}
function onShift(sim, v) {
  if (v.nightOwl) return true;
  const night = sim.resting;
  if (v.job === "fight" || v.job === "idle") return !night;
  if (v.shift === "both") return true;
  return v.shift === "night" ? night : !night;
}
function onDuty(sim, v) {
  if (!onShift(sim, v)) return false;
  if (sim.resting && v.job !== "fight" && v.job !== "idle") return ensureTorch(sim, v);
  return true;
}
function callUp(sim, v) {
  if (sleepLocked(sim, v) || v.energy < REST.tired) return false;
  if (onShift(sim, v)) return true;
  if (v.job === "fight") {
    v.nightOwl = true;
    return true;
  }
  if (v.job === "idle") return false;
  if (sim.resting && !ensureTorch(sim, v)) return false;
  v.nightOwl = true;
  return true;
}
function tickEnergy(sim, v, dt) {
  const top = maxEnergy(sim, v);
  if (v.phase === "sleep") {
    v.energy = Math.min(top, v.energy + sleepRate(sim, v) * dt);
    v.strain = Math.max(0, v.strain - (sim.resting ? REST.strain.nightSleep : REST.strain.daySleep) * dt);
  } else if (!sim.dev.noTire) {
    const working = v.job !== "idle" && (v.phase === "work" || v.phase === "build" || v.phase === "craft" || v.phase === "inside" || v.phase === "fight");
    v.energy = Math.max(0, v.energy - drainRate(sim, v) * dt);
    if (sim.resting && working) {
      v.strain = Math.min(100, v.strain + REST.strain.nightWork * dt);
      if (v.job !== "fight") v.morale = Math.max(0, v.morale - REST.strain.moraleLoss * dt);
    }
  }
  if (v.energy > top) v.energy = top;
  if (v.torch && sim.resting && v.phase !== "sleep") {
    v.torch.dur -= dt;
    if (v.torch.dur <= 0) {
      v.torch = null;
      sim.say(`\u0110u\u1ED1c c\u1EE7a ${v.name} \u0111\xE3 ch\xE1y h\u1EBFt.`);
    }
  }
}
function shouldSleep(sim, v, fighting) {
  if (fighting) return false;
  if (v.lockUntil > 0) {
    if (v.energy >= v.lockUntil) v.lockUntil = 0;
    else return true;
  }
  if (v.energy < REST.tired) {
    const collapse = v.energy < REST.collapse;
    v.lockUntil = collapse ? REST.wakeAfterCollapse : REST.wakeAfterTired;
    if (collapse) v.strain = Math.min(100, v.strain + REST.strain.collapse);
    sim.say(`${v.name} ${collapse ? "ki\u1EC7t s\u1EE9c, ng\xE3 xu\u1ED1ng ng\u1EE7 say" : "m\u1EC7t, \u0111i ng\u1EE7"}.`);
    return true;
  }
  return !onDuty(sim, v);
}
function bedsIn(sim, kind) {
  const b = sim.building(kind);
  return b ? levelDef(b).slots : 0;
}

// src/sim/sim.ts
var Sim = class _Sim {
  constructor(seed = 1337) {
    this.seed = seed;
    this.villagers = [];
    this.buildings = [];
    this.stock = emptyStock();
    /** Công cụ đã chế, đang chờ dân tới Xưởng lấy. Khóa dạng "axe1". */
    this.toolStock = {};
    /** Tools handed back with wear on them; they keep their durability. `id` as in toolStock. */
    this.wornTools = [];
    /** Hàng đợi chế tác (mã công thức). */
    this.craftQueue = [];
    /** Research (tech ids) waiting for a free researcher in the Nhà nghiên cứu. */
    this.researchQueue = [];
    /** Tools waiting to be mended in the Nhà sửa chữa (recipe ids such as axe1). */
    this.repairQueue = [];
    this.coinFrac = 0;
    this.sawCoin = false;
    /** Finished research (tech ids). Recipes and building levels stay locked until their tech is here. */
    this.researched = /* @__PURE__ */ new Set();
    this.log = [];
    /** Current era: new buildings are built with this era's art and levels. */
    this.era = "stone";
    /** Hệ số tốc độ: 0 = tạm dừng. */
    this.speed = 1;
    /** Giây game đã trôi qua. */
    this.time = START_TIME;
    /** Player villagers and tribal people, by id. */
    this.byId = /* @__PURE__ */ new Map();
    /** Tribal people (enemies, neutrals, tributaries); they share the Villager body but never work. */
    this.foes = [];
    this.tribes = [];
    /** Scheduled wolf packs and tribal raids. */
    this.events = [];
    this.nextRaid = 0;
    this.animals = [];
    this.animalById = /* @__PURE__ */ new Map();
    this.projectiles = [];
    this.nextAid = 1;
    /** Test switches driven by the dev menu; all off in a normal game. */
    this.dev = { freeBuild: false, instantBuild: false, god: false, noHunger: false, fastWorks: false, noTire: false };
    /** A tribe that has just surrendered and waits for the player to choose: adopt or tribute. */
    this.pendingTribe = null;
    this.acc = 0;
    this.fogDirty = true;
    this.nextVid = 1;
    this.nextBid = 1;
    this.moraleClock = 0;
    /** Seconds since the tribes were last looked after (they are tended once a second). */
    this.tribeClock = 0;
    this.lastFullWarn = -999;
    this.lastMatWarn = -999;
    /** Today's and tomorrow's weather (tomorrow is rolled ahead so it can be foretold). */
    this.weather = "clear";
    this.nextWeather = "clear";
    this.lastDay = 1;
    this.signalled = false;
    this.resting = false;
    this.lastVision = -1;
    /** Stored food split into lots, oldest eaten first; each lot has an expiry time. */
    this.foodLots = [];
    this.world = new World(seed);
    this.fog = new Fog(this.world);
    this.rnd = mulberry32(seed ^ 2654435769);
    this.frnd = mulberry32(seed ^ 2135587861);
    this.wrnd = mulberry32(seed ^ 1540483477);
    RES_NAME.coin = CURRENCY[this.era];
    this.researched.add("torch1");
    this.world.setSeason(this.season);
    this.nextWeather = rollWeather(seasonOf(this.day + 1), this.wrnd());
    this.resting = isRestTime(this.tod, this.season);
    const s = this.world.start;
    this.addBuilding("campfire", s.x - 1, s.y - 2, true);
    this.stock.food = 20;
    const spots = [[-1, 1, "m", "food"], [1, 1, "f", "wood"]];
    for (const [dx, dy, sex, job] of spots) this.spawn(s.x + dx, s.y + dy, sex).job = job;
    this.say("Hai ng\u01B0\u1EDDi \u0111\u1EA7u ti\xEAn \u0111\xE3 \u0111\u1EBFn b\xEAn \u0111\u1ED1ng l\u1EEDa: m\u1ED9t ng\u01B0\u1EDDi h\xE1i l\u01B0\u1EE3m, m\u1ED9t ng\u01B0\u1EDDi \u0111\u1ED1n g\u1ED7. Ch\u1ECDn m\u1ED9t d\xE2n r\u1ED3i chu\u1ED9t ph\u1EA3i l\xEAn c\xE2y, \u0111\xE1 hay b\u1EE5i qu\u1EA3 \u0111\u1EC3 giao vi\u1EC7c. D\u1EF1ng Nh\xE0 th\u1EE3 x\xE2y tr\u01B0\u1EDBc, r\u1ED3i c\xE1c c\xF4ng tr\xECnh kh\xE1c.");
    this.refreshFog();
    populate(this);
    spawnTribes(this);
  }
  // ---------------------------------------------------------------- tiện ích
  get day() {
    return Math.floor(this.time / DAY_LENGTH) + 1;
  }
  /** 0..1 trong ngày: 0 = nửa đêm trước bình minh, 0.5 = giữa trưa. */
  get tod() {
    return this.time % DAY_LENGTH / DAY_LENGTH;
  }
  get season() {
    return seasonOf(this.day);
  }
  /** Light 0..1 from time of day and the season's day length. */
  get light() {
    return lightAt(this.tod, this.season);
  }
  /** Độ tối ban đêm 0..1 (dùng để phủ màu). */
  get darkness() {
    return 1 - this.light;
  }
  get part() {
    return dayPart(this.tod, this.season);
  }
  /** Rest hours: mid-dusk to mid-dawn. */
  get restTime() {
    return this.resting;
  }
  // ---------------------------------------------------------------- energy, shifts and torches
  /** → rest.sleepLocked */
  sleepLocked(v) {
    return sleepLocked(this, v);
  }
  /** → rest.callUp */
  callUp(v) {
    return callUp(this, v);
  }
  /** → rest.returnTorch */
  returnTorch(v) {
    returnTorch(this, v);
  }
  /** → rest.giveTorch */
  giveTorch(ids) {
    return giveTorch(this, ids);
  }
  /** → rest.torchCount */
  torchCount() {
    return torchCount(this);
  }
  /** → rest.restFactor */
  restFactor(v) {
    return restFactor(this, v);
  }
  /** → rest.shouldSleep */
  shouldSleep(v, fighting) {
    return shouldSleep(this, v, fighting);
  }
  /** → rest.tickEnergy */
  tickEnergy(v, dt) {
    tickEnergy(this, v, dt);
  }
  /** → rest.bedsIn */
  bedsIn(kind) {
    return bedsIn(this, kind);
  }
  /** → rest.freeBed */
  freeBed(v) {
    return freeBed(this, v);
  }
  /** → rest.bedsTaken */
  bedsTaken(b) {
    return bedsTaken(this, b);
  }
  /** Choose when a villager works. */
  setShift(ids, shift) {
    for (const v of this.mine(ids)) v.shift = shift;
  }
  /** → rest.maxEnergy */
  maxEnergy(v) {
    return maxEnergy(this, v);
  }
  // ---------------------------------------------------------------- saving
  /** The whole game as plain JSON data (see save.ts). Settings are not in it. */
  toSave() {
    return toSave(this);
  }
  /** Replace this game by a saved one; it must be a save of the same world (seed). */
  loadSave(raw) {
    applySave(this, migrate(raw));
    this.fog.version++;
  }
  // the drawing of the fog must be redone
  /** A new Sim continuing a saved game. */
  static fromSave(raw) {
    const data = migrate(raw), sim = new _Sim(data.seed);
    applySave(sim, data);
    return sim;
  }
  /** → environment.visionRadius */
  visionRadius() {
    return visionRadius(this);
  }
  /** → environment.fireRadius */
  fireRadius() {
    return fireRadius(this);
  }
  /** → economy.foodSpoilingWithin */
  foodSpoilingWithin(secs) {
    return foodSpoilingWithin(this, secs);
  }
  get(id) {
    return this.byId.get(id);
  }
  say(text) {
    this.log.push({ t: this.time, text });
    if (this.log.length > 40) this.log.shift();
  }
  /** → construction.capacity */
  capacity(_res) {
    return capacity(this, _res);
  }
  buildingAt(x, y) {
    return this.buildings.find((b) => {
      const d = BUILDINGS[b.kind];
      return x >= b.x && x < b.x + d.w && y >= b.y && y < b.y + d.h;
    });
  }
  getBuilding(id) {
    return this.buildings.find((b) => b.id === id);
  }
  /** The finished building of a kind (there is only ever one of each). */
  building(kind) {
    return this.buildings.find((b) => b.kind === kind && b.done);
  }
  hasWorkshop() {
    return !!this.building("workshop");
  }
  /** → inventory.toolCount */
  toolCount(kind, tier) {
    return toolCount(this, kind, tier);
  }
  /** → inventory.toolTier */
  toolTier(v, job) {
    return toolTier(this, v, job);
  }
  /** → villagers.spawn */
  spawn(x, y, sex) {
    return spawn(this, x, y, sex);
  }
  /** → villagers.makeVillager */
  makeVillager(x, y, sex, team, rnd = this.rnd) {
    return makeVillager(this, x, y, sex, team, rnd);
  }
  /** → construction.addBuilding */
  addBuilding(kind, x, y, done) {
    return addBuilding(this, kind, x, y, done);
  }
  /** → construction.buildingLock */
  buildingLock(kind) {
    return buildingLock(this, kind);
  }
  /** → construction.canPlace */
  canPlace(kind, x, y) {
    return canPlace(this, kind, x, y);
  }
  /** → economy.missing */
  missing(cost) {
    return missing(this, cost);
  }
  /** → construction.canUpgrade */
  canUpgrade(b) {
    return canUpgrade(this, b);
  }
  /** → construction.upgradeBuilding */
  upgradeBuilding(id) {
    return upgradeBuilding(this, id);
  }
  /** → construction.placeBuilding */
  placeBuilding(kind, x, y) {
    return placeBuilding(this, kind, x, y);
  }
  /** → construction.salvage */
  salvage(b) {
    return salvage(this, b);
  }
  /** → construction.moveFee */
  moveFee(b) {
    return moveFee(this, b);
  }
  /** → construction.demolishBuilding */
  demolishBuilding(id) {
    return demolishBuilding(this, id);
  }
  /** → construction.canMove */
  canMove(b, x, y) {
    return canMove(this, b, x, y);
  }
  /** → construction.moveBuilding */
  moveBuilding(id, x, y) {
    return moveBuilding(this, id, x, y);
  }
  /** → works.orderDef */
  orderDef(kind, id) {
    return orderDef(this, kind, id);
  }
  /** → works.bestIntInside */
  bestIntInside(b) {
    return bestIntInside(this, b);
  }
  /** → works.recipeLock */
  recipeLock(id) {
    return recipeLock(this, id);
  }
  /** → works.recipeOpen */
  recipeOpen(id) {
    return recipeOpen2(this, id);
  }
  /** → works.techState */
  techState(t) {
    return techState(this, t);
  }
  /** → works.researchBlock */
  researchBlock(t) {
    return researchBlock(this, t);
  }
  /** → works.currentResearch */
  currentResearch() {
    return currentResearch(this);
  }
  /** → works.queueResearch */
  queueResearch(id) {
    return queueResearch(this, id);
  }
  /** → works.researchShort */
  researchShort(t) {
    return researchShort(this, t);
  }
  /** → works.queueCraft */
  queueCraft(id) {
    return queueCraft(this, id);
  }
  /** → works.queueRepair */
  queueRepair(id) {
    return queueRepair(this, id);
  }
  /** → works.unqueueCraft */
  unqueueCraft(id) {
    return unqueueCraft(this, id);
  }
  /** → works.unqueueResearch */
  unqueueResearch(id) {
    return unqueueResearch(this, id);
  }
  /** → economy.affordable */
  affordable(cost) {
    return affordable(this, cost);
  }
  /** → economy.pay */
  pay(cost, sign = -1) {
    return pay(this, cost, sign);
  }
  /** → works.storeUsed */
  storeUsed(cat) {
    return storeUsed(this, cat);
  }
  /** → works.storeCap */
  storeCap(cat) {
    return storeCap(this, cat);
  }
  /** → works.tickWorks */
  tickWorks(dt) {
    return tickWorks(this, dt);
  }
  /** → houses.bestFor */
  bestFor(job) {
    return bestFor(this, job);
  }
  /** → houses.houseRate */
  houseRate(b) {
    return houseRate(this, b);
  }
  /** → houses.staffCount */
  staffCount(b) {
    return staffCount(this, b);
  }
  /** → construction.popCap */
  popCap() {
    return popCap(this);
  }
  /** → construction.crewSpeed */
  crewSpeed() {
    return crewSpeed(this);
  }
  /** → houses.crew */
  crew() {
    return crew(this);
  }
  /** → houses.assignCrew */
  assignCrew(ids) {
    return assignCrew(this, ids);
  }
  /** → houses.trimCrew */
  trimCrew() {
    return trimCrew(this);
  }
  /** → houses.releaseCrew */
  releaseCrew(ids) {
    return releaseCrew(this, ids);
  }
  /** → houses.assignStaff */
  assignStaff(ids, job) {
    return assignStaff(this, ids, job);
  }
  /** → houses.planStaff */
  planStaff(v) {
    return planStaff(this, v);
  }
  /** → houses.enterBuilding */
  enterBuilding(v) {
    return enterBuilding(this, v);
  }
  /** → houses.exitBuilding */
  exitBuilding(v) {
    return exitBuilding(this, v);
  }
  /** → houses.sleepIn */
  sleepIn(v, b) {
    return sleepIn(this, v, b);
  }
  /** → houses.sleepers */
  sleepers(b) {
    return sleepers(this, b);
  }
  /** → houses.releaseStaff */
  releaseStaff(ids) {
    return releaseStaff(this, ids);
  }
  /** → inventory.heldTool */
  heldTool(v) {
    return heldTool(this, v);
  }
  /** → inventory.returnTool */
  returnTool(v) {
    return returnTool(this, v);
  }
  /** → inventory.assignTool */
  assignTool(ids, k, tier) {
    return assignTool(this, ids, k, tier);
  }
  /** → inventory.discardTool */
  discardTool(ids, k) {
    return discardTool(this, ids, k);
  }
  /** → inventory.repairTool */
  repairTool(ids, k) {
    return repairTool(this, ids, k);
  }
  /** → economy.barter */
  barter(res) {
    return barter(this, res);
  }
  /** → commands.resetTask */
  resetTask(v) {
    return resetTask(this, v);
  }
  /** → commands.clearCombat */
  clearCombat(v) {
    return clearCombat(this, v);
  }
  /** → commands.mine */
  mine(ids) {
    return mine(this, ids);
  }
  /** → commands.orderMove */
  orderMove(ids, tx, ty, queue = false) {
    return orderMove(this, ids, tx, ty, queue);
  }
  /** → commands.orderWork */
  orderWork(ids, tx, ty) {
    return orderWork(this, ids, tx, ty);
  }
  /** → commands.setJob */
  setJob(ids, job) {
    return setJob(this, ids, job);
  }
  /** → commands.enlist */
  enlist(ids) {
    return enlist(this, ids);
  }
  /** → commands.discharge */
  discharge(ids) {
    return discharge(this, ids);
  }
  /** → commands.targetAt */
  targetAt(x, y) {
    return targetAt(this, x, y);
  }
  /** → commands.orderAttack */
  orderAttack(ids, target, queue = false) {
    return orderAttack(this, ids, target, queue);
  }
  /** → commands.orderAttackMove */
  orderAttackMove(ids, x, y, queue = false) {
    return orderAttackMove(this, ids, x, y, queue);
  }
  /** → commands.orderLoot */
  orderLoot(ids, animalId) {
    return orderLoot(this, ids, animalId);
  }
  /** → commands.orderHold */
  orderHold(ids) {
    return orderHold(this, ids);
  }
  /** → commands.orderStop */
  orderStop(ids) {
    return orderStop(this, ids);
  }
  /** → commands.setStance */
  setStance(ids, stance) {
    return setStance(this, ids, stance);
  }
  /** → commands.nextOrder */
  nextOrder(v) {
    return nextOrder(this, v);
  }
  /** → inventory.giveGear */
  giveGear(ids, kind, slot) {
    return giveGear(this, ids, kind, slot);
  }
  /** → inventory.assignGear */
  assignGear(ids, kind, slot) {
    return assignGear(this, ids, kind, slot);
  }
  /** → inventory.autoGear */
  autoGear(ids) {
    return autoGear(this, ids);
  }
  /** → inventory.giveTool */
  giveTool(ids, kind, tier) {
    return giveTool(this, ids, kind, tier);
  }
  /** → movement.nearestFree */
  nearestFree(tx, ty, taken) {
    return nearestFree(this, tx, ty, taken);
  }
  /** → environment.refreshFog */
  refreshFog() {
    return refreshFog(this);
  }
  /** Gọi mỗi khung hình với dt thực; chạy theo bước cố định, nhân với hệ số tốc độ. */
  advance(dt) {
    if (this.speed <= 0) return;
    this.acc += Math.min(dt, 0.25) * this.speed;
    let guard = 0;
    while (this.acc >= TICK && guard++ < 400) {
      this.acc -= TICK;
      this.tick(TICK);
    }
  }
  tick(dt) {
    this.time += dt;
    this.tickCalendar();
    this.world.tick(dt);
    this.syncFood();
    tickAnimals(this, dt);
    tickProjectiles(this, dt);
    for (const v of [...this.villagers]) this.tickVillager(v, dt);
    this.tickWorks(dt);
    for (const f of [...this.foes]) tickFoe(this, f, dt);
    tickTribes(this, dt);
    this.moraleClock += dt;
    if (this.moraleClock >= 1) {
      this.moraleClock = 0;
      for (const v of this.villagers) if (v.down <= 0) tickMorale(this, v);
      this.pickLeaders();
    }
    if (this.visionRadius() !== this.lastVision) this.fogDirty = true;
    if (this.fogDirty) {
      this.fogDirty = false;
      this.refreshFog();
    }
  }
  /** → environment.tickCalendar */
  tickCalendar() {
    return tickCalendar(this);
  }
  /** → economy.syncFood */
  syncFood() {
    return syncFood(this);
  }
  /** → villagers.tickVillager */
  tickVillager(v, dt) {
    return tickVillager(this, v, dt);
  }
  /** → movement.moveUnit */
  moveUnit(v, dt) {
    return moveUnit(this, v, dt);
  }
  /** → movement.animate */
  animate(v, dt) {
    return animate(this, v, dt);
  }
  kill(v, cause = "v\xEC \u0111\xF3i") {
    this.leaveNode(v);
    this.exitBuilding(v);
    this.villagers.splice(this.villagers.indexOf(v), 1);
    this.byId.delete(v.id);
    this.fogDirty = true;
    this.say(`${v.name} \u0111\xE3 ch\u1EBFt ${cause}.`);
    this.onKill?.();
  }
  killUnit(v, cause) {
    this.kill(v, cause);
  }
  // ---------------------------------------------------------------- tribal people
  /** Make a unit known by id (used when a villager is created outside the constructor, e.g. by the dev menu). */
  registerUnit(v) {
    this.byId.set(v.id, v);
    this.fogDirty = true;
  }
  addFoe(v) {
    this.foes.push(v);
    this.byId.set(v.id, v);
  }
  removeFoe(v) {
    const i = this.foes.indexOf(v);
    if (i >= 0) this.foes.splice(i, 1);
    this.byId.delete(v.id);
  }
  /** A tribal person joins the village. */
  adoptFoe(v) {
    const i = this.foes.indexOf(v);
    if (i >= 0) this.foes.splice(i, 1);
    v.team = "player";
    v.ai = null;
    v.job = "idle";
    v.phase = "idle";
    v.path = [];
    v.morale = 50;
    v.leader = false;
    v.fleeT = 0;
    this.clearCombat(v);
    v.health = Math.max(v.health, v.maxHealth * 0.6);
    v.fullness = 70;
    this.villagers.push(v);
    this.fogDirty = true;
  }
  /** Diplomacy buttons: 'gift', 'tribute', 'adopt'. Returns an error text or null. */
  diplomacy(id, action) {
    return action === "gift" ? giftTribe(this, id) : action === "tribute" ? tributeTribe(this, id) : adoptTribe(this, id);
  }
  // ---------------------------------------------------------------- combat helpers
  hurt(target, dmg, type, from, src) {
    hurt(this, target, dmg, type, from, src);
  }
  tribeHostile(id) {
    return tribeHostile(this, id);
  }
  tribeAttacked(id, victim) {
    tribeAttacked(this, id, victim);
  }
  killFoe(v, killer) {
    killFoe(this, v, killer);
  }
  /** The player's own campfire (the village centre). */
  campfire() {
    return this.buildings.find((b) => b.kind === "campfire" && b.done);
  }
  /** Close to the unit's own camp: the village fire, or the tribal camp for tribal people. */
  nearHome(v) {
    if (v.ai) return Math.hypot(v.x - v.ai.camp.x, v.y - v.ai.camp.y) < 10;
    const f = this.campfire();
    return !!f && Math.hypot(v.x - f.x - 1, v.y - f.y - 1) < 10;
  }
  /** Another fighter within 7 tiles of the animal: a boar is only worth attacking in a group. */
  packNear(v, a) {
    return this.villagers.some((o) => o !== v && o.health > 0 && o.down <= 0 && (o.job === "hunt" || o.job === "fight") && Math.hypot(o.x - a.x, o.y - a.y) < 7);
  }
  /** → villagers.pickLeaders */
  pickLeaders() {
    return pickLeaders(this);
  }
  /** → labor.workRate */
  workRate(v, job) {
    return workRate(this, v, job);
  }
  /** → labor.workFactor */
  workFactor(v, job) {
    return workFactor(this, v, job);
  }
  /** → labor.gainXp */
  gainXp(v, job, dt) {
    return gainXp(this, v, job, dt);
  }
  /** → labor.leaveNode */
  leaveNode(v) {
    return leaveNode(this, v);
  }
  /** → labor.face */
  face(v, tx, ty) {
    return face(this, v, tx, ty);
  }
  /** → labor.wait */
  wait(v, secs) {
    return wait(this, v, secs);
  }
  /** → labor.faceBuilding */
  faceBuilding(v, b) {
    return faceBuilding(this, v, b);
  }
  /** → labor.think */
  think(v, dt) {
    return think(this, v, dt);
  }
  /** → inventory.toolLacking */
  toolLacking(v, job) {
    return toolLacking(this, v, job);
  }
  /** → inventory.needTool */
  needTool(v, job) {
    return needTool(this, v, job);
  }
  /** → inventory.planTool */
  planTool(v, job) {
    return planTool(this, v, job);
  }
  /** → inventory.errand */
  errand(v) {
    return errand(this, v);
  }
  /** → inventory.equip */
  equip(v) {
    return equip(this, v);
  }
  /** → inventory.planEquipGear */
  planEquipGear(v) {
    return planEquipGear(this, v);
  }
  /** → inventory.planGearErrand */
  planGearErrand(v) {
    return planGearErrand(this, v);
  }
  /** → movement.ringTiles */
  ringTiles(v, x, y, w, h) {
    return ringTiles(this, v, x, y, w, h);
  }
  /** → movement.pathTo */
  pathTo(v, gx, gy, maxNodes = 14e3) {
    return pathTo(this, v, gx, gy, maxNodes);
  }
  /** → movement.routeTo */
  routeTo(v, tiles, tries = 3) {
    return routeTo(this, v, tiles, tries);
  }
  /** → labor.planDeliver */
  planDeliver(v) {
    return planDeliver(this, v);
  }
  /** → labor.stash */
  stash(v) {
    return stash(this, v);
  }
};

// test/save.test.ts
PACE.work = 1;
var fails = 0;
var ok = (c, m) => {
  console.log((c ? "ok   " : "FAIL ") + m);
  if (!c) fails++;
};
var run = (sim, secs) => {
  for (let i = 0; i < secs * 20; i++) sim.tick(0.05);
};
var later = () => new Promise((r) => setTimeout(r, 10));
async function main() {
  const store = new MemoryStore();
  const sim = new Sim(1337);
  const session = new Session(sim, store);
  ok(await session.latest() === null, "no save at first");
  session.tick();
  await later();
  ok((await store.list()).length === 0, "nothing is saved in the middle of a day");
  sim.time = DAY_LENGTH * 1.01;
  session.tick();
  await later();
  let list = await store.list();
  ok(list.length === 1 && list[0].id === AUTO_SAVE && list[0].day === 2 && list[0].seed === 1337 && list[0].population === 2, "a new day saves by itself");
  session.tick();
  await later();
  ok((await store.list()).length === 1, "and only once per day, in the same slot");
  run(sim, 120);
  const before = sim.toSave();
  ok(await session.save(), "a save on request works");
  const other = new Sim(1337);
  const again = new Session(other, store);
  ok(await again.resume(AUTO_SAVE), "another game picks the save up");
  ok(JSON.stringify(other.toSave().scalars) === JSON.stringify(before.scalars) && other.time === sim.time && other.villagers.length === sim.villagers.length, "and is where the first one was");
  let running = 0, most = 0;
  const slow = { ...store, list: store.list.bind(store), load: store.load.bind(store), remove: store.remove.bind(store), save: async (...a) => {
    running++;
    most = Math.max(most, running);
    await later();
    await store.save(...a);
    running--;
  } };
  const s2 = new Session(sim, slow);
  await Promise.all([s2.save(), s2.save(), s2.save()]);
  ok(most === 1, "saves never overlap");
  const broken = { list: async () => {
    throw new Error("no disk");
  }, load: async () => null, save: async () => {
    throw new Error("disk full");
  }, remove: async () => {
  } };
  const s3 = new Session(sim, broken);
  const errors = [];
  s3.onError = (m) => errors.push(m);
  ok(await s3.save() === false && errors.length === 1 && errors[0].includes("disk full"), "a failed save is reported, not thrown");
  ok(await s3.latest() === null, "and a store that cannot list looks empty");
  await session.forget();
  ok((await store.list()).length === 0, "a save can be forgotten");
  const mem = /* @__PURE__ */ new Map();
  const fake = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => {
    mem.set(k, v);
  } };
  ok(JSON.stringify(loadSettings(fake)) === JSON.stringify(DEFAULT_SETTINGS), "settings start with their defaults");
  saveSettings({ speed: 4, skipRotatePrompt: true }, fake);
  ok(loadSettings(fake).speed === 4 && loadSettings(fake).skipRotatePrompt === true, "settings are remembered");
  mem.set("lang-do-da.settings", '{"speed":99,"skipRotatePrompt":"yes"}');
  ok(loadSettings(fake).speed === 1 && loadSettings(fake).skipRotatePrompt === false, "nonsense in the settings is ignored");
  mem.set("lang-do-da.settings", "not json");
  ok(loadSettings(fake).speed === 1, "and so is a broken settings file");
  ok(!("speed" in sim.toSave().scalars) && !JSON.stringify(sim.toSave()).includes("skipRotatePrompt"), "settings are not in the saved game");
  console.log(fails ? `${fails} failed` : "all passed");
  process.exit(fails ? 1 : 0);
}
main();
