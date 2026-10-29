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
var PATH_BUDGET = 6;
var DAY_LENGTH = 1200;
var START_TIME = DAY_LENGTH * 0.25;
var WORK_DAY = 240;
var PACE = { work: WORK_DAY / DAY_LENGTH };

// src/data/seasons.json
var seasons_default = {
  spring: { name: "Xu\xE2n", daylight: 0.6, work: 1, gather: 0.8, farm: 0.9, enter: "M\xF9a xu\xE2n \u0111\u1EBFn: b\u1EE5i c\xE2y ra hoa, v\xE0i h\xF4m n\u1EEFa s\u1EBD c\xF3 qu\u1EA3. Hay m\u01B0a." },
  summer: { name: "H\u1EA1", daylight: 0.6, work: 1.05, gather: 1.2, farm: 1.2, enter: "M\xF9a h\u1EA1: ng\xE0y d\xE0i h\u01A1n, qu\u1EA3 ch\xEDn nhi\u1EC1u. Coi ch\u1EEBng gi\xF4ng s\xE9t." },
  autumn: { name: "Thu", daylight: 0.6, work: 1, gather: 1.4, farm: 1.4, enter: "M\xF9a thu: qu\u1EA3 nhi\u1EC1u nh\u1EA5t n\u0103m. M\xF9a \u0111\xF4ng s\u1EAFp t\u1EDBi, h\xE3y chu\u1EA9n b\u1ECB." },
  winter: { name: "\u0110\xF4ng", daylight: 0.6, work: 0.8, gather: 0, farm: 0.25, enter: "M\xF9a \u0111\xF4ng: b\u1EE5i qu\u1EA3 tr\u1EE5i h\u1EBFt, ng\xE0y ng\u1EAFn l\u1EA1i. S\u1ED1ng b\u1EB1ng th\u1EE9c \u0103n \u0111\xE3 t\xEDch tr\u1EEF." }
};

// src/data/weather.json
var weather_default = {
  types: {
    clear: { name: "N\u1EAFng", vision: 0, speed: 1, work: 1, bow: 1, signal: "" },
    mist: { name: "S\u01B0\u01A1ng m\u1ECFng", vision: 2, speed: 1, work: 0.95, bow: 1, signal: "H\u01A1i n\u01B0\u1EDBc b\u1ED1c l\xEAn t\u1EEB \u0111\u1EA5t, s\xE1ng mai c\xF3 l\u1EBD s\u1EBD c\xF3 s\u01B0\u01A1ng." },
    drizzle: { name: "M\u01B0a nh\u1EB9", vision: 0, speed: 0.9, work: 0.85, bow: 0.85, signal: "M\xE2y x\xE1m k\xE9o t\u1EDBi, c\xF3 l\u1EBD ng\xE0y mai m\u01B0a." },
    rain: { name: "M\u01B0a to", vision: 1, speed: 0.75, work: 0.7, bow: 0.7, signal: "Tr\u1EDDi t\u1ED1i s\u1EA7m, gi\xF3 \u1EA9m n\u1ED5i l\xEAn: ng\xE0y mai m\u01B0a to." },
    thunder: { name: "Gi\xF4ng s\xE9t", vision: 3, speed: 0.85, work: 0.6, bow: 0.7, signal: "Kh\xF4ng kh\xED oi n\u1ED3ng, m\xE2y d\u1EF1ng th\xE0nh th\xE1p: s\u1EAFp c\xF3 gi\xF4ng." },
    storm: { name: "B\xE3o", vision: 4, speed: 0.7, work: 0.45, bow: 0.5, signal: "Gi\xF3 gi\u1EADt m\u1EA1nh, chim bay t\xE1n lo\u1EA1n: b\xE3o \u0111ang t\u1EDBi." },
    snow: { name: "Tuy\u1EBFt", vision: 1, speed: 0.75, work: 0.6, bow: 0.85, signal: "Gi\xF3 l\u1EA1nh bu\u1ED1t th\u1ED5i v\u1EC1, c\xF3 l\u1EBD s\u1EAFp c\xF3 tuy\u1EBFt." }
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

// src/data/siege.json
var siege_default = {
  _note: "War on the ground: what soldiers can break down, and how fast. Seconds are for one soldier; several soldiers at one object add up.",
  lookAhead: 6,
  clearSeconds: {
    tree: 3,
    rock: 5,
    bush: 1.5
  },
  propHp: {
    fire: 160,
    pile: 70,
    tower: 150,
    fence: 40,
    gate: 40
  },
  buildingHpPerTile: 45,
  crew: 3,
  driftMax: 14,
  reach: 1.6
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
      durability: 120,
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
      durability: 100,
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
      durability: 160,
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
      range: 5.5,
      damage: 5,
      cycle: 1.8,
      ranged: true,
      cost: { hide: 1, stone: 1 },
      durability: 90,
      time: 60,
      style: "sling",
      projectile: "stone",
      tier: 1
    },
    bow: {
      name: "Cung ng\u1EAFn",
      type: "pierce",
      range: 8,
      damage: 8,
      cycle: 2,
      ranged: true,
      cost: { wood: 3, hide: 1 },
      durability: 110,
      time: 100,
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
      durability: 200,
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
var SIEGE = siege_default;
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

// src/sim/buildings.ts
var ERAS = ["stone", "ancient"];
var lv = (name, cost, buildTime, cap = 0, craftSpeed = 1, slots = 0, hp = 0) => ({ name, cost, buildTime, cap, craftSpeed, slots, hp });
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
  // The role houses. One of each: raising its level makes room for more people (slots). The people of a role are chosen in its house, never
  // at the campfire. A soldier's camp is also where he sleeps, out of sight, as a list (craftSpeed = how well they rest).
  infantry: {
    kind: "infantry",
    name: "Tr\u1EA1i chi\u1EBFn binh",
    names: { ancient: "Tr\u1EA1i b\u1ED9 binh" },
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 20 }, 60, 0, 1, 4), lv("G\u1ED7", { wood: 25, hide: 6 }, 100, 0, 1.1, 8), lv("\u0110\xE1", { wood: 30, stone: 25, hide: 10 }, 150, 0, 1.2, 14)] }
  },
  cavalry: {
    kind: "cavalry",
    name: "Tr\u1EA1i k\u1EF5 th\xFA",
    names: { ancient: "Tr\u1EA1i k\u1EF5 binh" },
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 25, hide: 8 }, 70, 0, 1, 2), lv("G\u1ED7", { wood: 30, hide: 10 }, 110, 0, 1.1, 4), lv("\u0110\xE1", { wood: 35, stone: 25, hide: 14 }, 160, 0, 1.2, 6)] }
  },
  archery: {
    kind: "archery",
    name: "Tr\u1EA1i th\u1EE3 n\xE9m",
    names: { ancient: "Tr\u1EA1i cung th\u1EE7" },
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 20 }, 60, 0, 1, 3), lv("G\u1ED7", { wood: 25, hide: 6 }, 100, 0, 1.1, 6), lv("\u0110\xE1", { wood: 30, stone: 25, hide: 10 }, 150, 0, 1.2, 10)] }
  },
  farmhouse: {
    kind: "farmhouse",
    name: "N\xF4ng tr\u1EA1i",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 15 }, 50, 0, 1, 3), lv("G\u1ED7", { wood: 25, stone: 5 }, 90, 0, 1, 5), lv("\u0110\xE1", { wood: 30, stone: 20 }, 140, 0, 1, 8)] }
  },
  huntlodge: {
    kind: "huntlodge",
    name: "Ch\xF2i th\u1EE3 s\u0103n",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 15, hide: 3 }, 50, 0, 1, 2), lv("G\u1ED7", { wood: 25, hide: 5 }, 90, 0, 1, 3), lv("\u0110\xE1", { wood: 30, stone: 15, hide: 8 }, 140, 0, 1, 5)] }
  },
  lumberyard: {
    kind: "lumberyard",
    name: "X\u01B0\u1EDFng g\u1ED7",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 15 }, 50, 0, 1, 3), lv("G\u1ED7", { wood: 25, stone: 5 }, 90, 0, 1, 5), lv("\u0110\xE1", { wood: 30, stone: 20 }, 140, 0, 1, 8)] }
  },
  quarry: {
    kind: "quarry",
    name: "X\u01B0\u1EDFng \u0111\xE1",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 15 }, 50, 0, 1, 3), lv("G\u1ED7", { wood: 25, stone: 5 }, 90, 0, 1, 5), lv("\u0110\xE1", { wood: 30, stone: 20 }, 140, 0, 1, 8)] }
  },
  // where everyone who is not a soldier sleeps, out of sight, as a list; without a bed they sleep by the campfire and rest slower
  house: {
    kind: "house",
    name: "Nh\xE0 d\xE2n",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    perFire: [1, 3, 3, 3],
    levels: { stone: [lv("\u0110\u01A1n s\u01A1", { wood: 20 }, 60, 0, 1, 4), lv("G\u1ED7", { wood: 30, stone: 10 }, 100, 0, 1.15, 8), lv("\u0110\xE1", { wood: 40, stone: 30 }, 150, 0, 1.3, 12)] }
  },
  // defence works (not "one of each": they are laid piece by piece, as many as the campfire allows). hp is what the raiders must break down.
  fence: {
    kind: "fence",
    name: "H\xE0ng r\xE0o c\u1ECDc",
    w: 1,
    h: 1,
    buildable: true,
    requires: ["builder"],
    perFire: [14, 30, 50, 70],
    repeat: true,
    levels: { stone: [lv("C\u1ECDc nh\u1ECDn", { wood: 2 }, 14, 0, 1, 0, 40), lv("H\xE0ng r\xE0o \u0111\xF4i", { wood: 4, stone: 1 }, 24, 0, 1, 0, 120)] }
  },
  // slots here are the archers who can keep watch on a tower; a gate has no staff, it opens and shuts
  gate: {
    kind: "gate",
    name: "C\u1ED5ng",
    w: 1,
    h: 1,
    buildable: true,
    requires: ["fence"],
    perFire: [1, 2, 3, 4],
    levels: { stone: [lv("C\u1ED5ng g\u1ED7", { wood: 4 }, 20, 0, 1, 0, 30), lv("C\u1ED5ng \u0111\xF4i", { wood: 6, stone: 2 }, 32, 0, 1, 0, 90)] }
  },
  tower: {
    kind: "tower",
    name: "Ch\xF2i canh",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["fence"],
    perFire: [0, 1, 2, 3],
    levels: { stone: [lv("Ch\xF2i g\u1ED7", { wood: 20 }, 80, 0, 1, 2, 150), lv("Ch\xF2i cao", { wood: 30, stone: 8 }, 130, 0, 1.2, 4, 300)] }
  },
  // where the squads, formations and plans are made: its level decides how many squads and command cards there are
  wartent: {
    kind: "wartent",
    name: "L\u1EC1u h\u1ECDp chi\u1EBFn",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("L\u1EC1u da", { wood: 30, hide: 8 }, 90), lv("L\u1EC1u l\u1EDBn", { wood: 40, hide: 10, stone: 15 }, 140), lv("L\u1EC1u th\u1EE7 l\u0129nh", { wood: 50, stone: 40, hide: 14 }, 200)] }
  },
  // where scouts are sent from: slots = how many may go out on one trip
  scouttent: {
    kind: "scouttent",
    name: "Tr\u1EA1i trinh s\xE1t",
    w: 2,
    h: 2,
    buildable: true,
    requires: ["builder"],
    levels: { stone: [lv("L\u1EC1u da", { wood: 20, hide: 6 }, 70, 0, 1, 4), lv("L\u1EC1u l\u1EDBn", { wood: 30, hide: 8, stone: 10 }, 110, 0, 1, 6), lv("L\u1EC1u th\xE1m th\xEDnh", { wood: 40, hide: 12, stone: 25 }, 160, 0, 1, 8)] }
  },
  // the drill ground: squads train their formation here
  drill: {
    kind: "drill",
    name: "B\xE3i t\u1EADp",
    w: 3,
    h: 3,
    buildable: true,
    requires: ["infantry"],
    levels: { stone: [lv("B\xE3i c\u1ECDc", { wood: 25 }, 80), lv("B\xE3i r\xE0o", { wood: 30, stone: 10 }, 120), lv("B\xE3i \u0111\xE1", { wood: 35, stone: 30 }, 170)] }
  },
  // a pit of sharpened stakes, laid one at a time; hp is how many men it can still wound
  trap: {
    kind: "trap",
    name: "H\u1ED1 ch\xF4ng",
    w: 1,
    h: 1,
    buildable: true,
    requires: ["fence"],
    perFire: [4, 10, 18, 28],
    repeat: true,
    levels: { stone: [lv("H\u1ED1 ch\xF4ng", { wood: 3 }, 12, 0, 1, 0, 3), lv("H\u1ED1 ch\xF4ng s\xE2u", { wood: 4, stone: 2 }, 20, 0, 1, 0, 6)] }
  },
  // slots = farmers at once, craftSpeed = how fast they work the soil; food comes in with the seasons (seasons.json "farm"), bushes are only the start
  field: {
    kind: "field",
    name: "Ru\u1ED9ng",
    w: 3,
    h: 3,
    buildable: true,
    requires: ["builder"],
    perFire: [1, 3, 3, 4],
    levels: { stone: [lv("\u0110\u1EA5t v\u1EE1", { wood: 10 }, 70, 0, 1, 1), lv("Lu\u1ED1ng \u0111\u1EAFp", { wood: 15, stone: 5 }, 110, 0, 1.4, 1), lv("B\u1EDD \u0111\xE1", { wood: 20, stone: 15 }, 160, 0, 1.8, 1)] }
  }
};
var buildingName = (kind, era) => BUILDINGS[kind].names?.[era] ?? BUILDINGS[kind].name;
function levelsOf(kind, era) {
  const defs = BUILDINGS[kind].levels;
  for (let i = ERAS.indexOf(era); i >= 0; i--) {
    const l = defs[ERAS[i]];
    if (l) return l;
  }
  return defs.stone;
}
var levelDef = (b, level = b.level) => levelsOf(b.kind, b.era)[level - 1];
var maxHp = (b) => levelDef(b).hp || Math.round(SIEGE.buildingHpPerTile * BUILDINGS[b.kind].w * BUILDINGS[b.kind].h * (1 + 0.5 * (b.level - 1)));
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

// src/data/units.json
var units_default = {
  _note: "Arms of the army and what beats what. A weapon decides its arm: ranged weapons (sling, bow) make an archer, everything else a foot soldier; a rider (cavalry) is a soldier on a tamed beast, which the game does not have yet but the table is ready for. beats[attacker][defender] multiplies the damage an attacker does. Foot beats archers, archers beat riders, riders beat foot. The small bonuses are on top of that.",
  arms: {
    foot: "B\u1ED9 binh",
    archer: "Cung th\u1EE7",
    cavalry: "K\u1EF5 th\xFA"
  },
  beats: {
    foot: { foot: 1, archer: 1.5, cavalry: 0.67 },
    archer: { foot: 0.67, archer: 1, cavalry: 1.5 },
    cavalry: { foot: 1.5, archer: 0.67, cavalry: 1 }
  },
  spearVsCavalry: 1.15,
  archerOnTower: { damage: 1.25, range: 2, within: 2.2 },
  archerPressed: { within: 2, damage: 0.5 }
};

// src/data/formations.json
var formations_default = {
  _note: "Battle formations (tr\u1EADn ph\xE1p) and the numbers of command. dmg = damage the squad does, taken = damage it takes, speed = pace of the march; charge applies while a wedge runs at the foe, flank when a blow lands from behind, firstBlow to a foe who has not yet noticed the squad, takenRanged to arrows and stones. mastery 0-100 is trained at the B\xE3i t\u1EADp and scales a formation from min to max. cap is the most all tactical factors (arms, formation, tower, surprise, information) may multiply to. info = the factor for the best map level held of the enemy (0..3), infoCounter when level 3 and the right arm is used. A war tent level gives squadLimit squads and cardBase + cardPerLevel * level command cards.",
  formations: {
    line: { name: "H\xE0ng ngang", tech: "form_basic", dmg: 1, taken: 0.85, speed: 0.9, note: "Gi\u1EEF ch\u1ED7 th\u1EAFt ch\u1EAFc, ch\u1ED1ng k\u1EF5 \xD71,3; ch\u1EADm quay." },
    circle: { name: "V\xF2ng tr\xF2n", tech: "form_basic", dmg: 0.85, taken: 0.8, speed: 0.7, note: "Kh\xF4ng c\xF3 h\u01B0\u1EDBng y\u1EBFu; ch\u1EADm, kh\xF4ng xung phong." },
    wedge: { name: "M\u0169i nh\u1ECDn", tech: "form_wedge", dmg: 0.9, charge: 1.4, taken: 1.1, speed: 1.05, note: "Xung phong \xD71,4 khi \u0111ang lao v\xE0o \u0111\u1ECBch; hai c\xE1nh y\u1EBFu." },
    horns: { name: "S\u1EEBng b\xF2", tech: "form_horns", dmg: 1, flank: 1.25, taken: 1.1, speed: 1, note: "\u0110\xE1nh s\u01B0\u1EDDn v\xE0 l\u01B0ng th\xEAm \xD71,25; gi\u1EEFa m\u1ECFng." },
    scatter: { name: "R\u1EA3i qu\xE2n", tech: "form_scatter", dmg: 0.85, taken: 1, takenRanged: 0.6, speed: 1, note: "Gi\u1EA3m 40% thi\u1EC7t h\u1EA1i t\u1EEB cung; \u0111\xE1nh y\u1EBFu h\u01A1n." },
    ambush: { name: "Ph\u1EE5c k\xEDch", tech: "form_ambush", dmg: 0.7, firstBlow: 2, taken: 1.15, speed: 0.9, note: "\u0110\xF2n \u0111\u1EA7u \xD72 v\xE0o \u0111\u1ECBch ch\u01B0a bi\u1EBFt; l\u1ED9 ra th\xEC y\u1EBFu nh\u1EA5t." }
  },
  mastery: { min: 0.8, max: 1.15, start: 20, perSecond: 0.4, decayPerDay: 2, switchSeconds: 8, switchTaken: 1.3 },
  cap: 3.5,
  info: [0.95, 1, 1.1, 1.2],
  infoCounter: 1.1,
  squadLimit: [3, 4, 6],
  squadMin: 3,
  squadMax: 15,
  cell: 1.3,
  cardBase: 4,
  cardPerLevel: 2,
  mapDecayPerDay: 0.1,
  clusterSize: 10,
  iconEvery: 3,
  bigBattle: 24
};

// src/sim/formations.ts
var OBJECTIVE_NAME = { camp: "\u0110\u1ED1ng l\u1EEDa c\u1EE7a h\u1ECD", gate: "\u0110\u01B0\u1EDDng v\xE0o l\xE0ng", ambush: "Ch\u1ED7 ph\u1EE5c k\xEDch", stores: "Kho l\u01B0\u01A1ng", leader: "Th\u1EE7 l\u0129nh" };
var ARM_NAME = units_default.arms;
var BEATS = units_default.beats;
var UNIT_RULES = units_default;
var armOfWeapon = (weapon) => WEAPONS[weapon ?? "fist"]?.ranged ? "archer" : "foot";
function matchup(attacker, defender, weapon = null) {
  return BEATS[attacker][defender] * (weapon === "spear" && defender === "cavalry" ? UNIT_RULES.spearVsCavalry : 1);
}
var FORMATION_IDS = Object.keys(formations_default.formations);
var FORMATIONS = formations_default.formations;
var COMMAND = formations_default;
var SQUAD_MIN = COMMAND.squadMin;
var SQUAD_MAX = COMMAND.squadMax;
var masteryFactor = (mastery) => COMMAND.mastery.min + (COMMAND.mastery.max - COMMAND.mastery.min) * Math.max(0, Math.min(100, mastery)) / 100;
var clampTactical = (x) => Math.max(1 / COMMAND.cap, Math.min(COMMAND.cap, x));
function formationOffsets(kind, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    switch (kind) {
      case "line": {
        const cols = Math.ceil(n / 2);
        out.push([-(i % 2) * 1.2, (Math.floor(i / 2) - (cols - 1) / 2) * 1.3]);
        break;
      }
      case "wedge": {
        let r = 0, k = i;
        while (k > r) {
          k -= r + 1;
          r++;
        }
        out.push([-r * 1.1, (k - r / 2) * 1.4]);
        break;
      }
      case "circle": {
        const R2 = Math.max(1.6, n * 1.3 / (2 * Math.PI));
        out.push([Math.cos(i / n * 2 * Math.PI) * R2, Math.sin(i / n * 2 * Math.PI) * R2]);
        break;
      }
      case "horns": {
        const arm = i % 3, k = Math.floor(i / 3) + 1;
        out.push(arm === 0 ? [-1, (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.7] : [k * 0.8, (arm === 1 ? -1 : 1) * (2 + k * 0.9)]);
        break;
      }
      case "scatter": {
        const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
        out.push([-Math.floor(i / cols) * 2.6, (i % cols - (cols - 1) / 2) * 2.6]);
        break;
      }
      default: {
        const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
        out.push([-Math.floor(i / cols) * 1.5 + i % 2 * 0.4, (i % cols - (cols - 1) / 2) * 1.6]);
      }
    }
  }
  return out;
}
var placeOffset = (o, heading, cx, cy) => [cx + o[0] * Math.cos(heading) - o[1] * Math.sin(heading), cy + o[0] * Math.sin(heading) + o[1] * Math.cos(heading)];
function clusterize(units, size = COMMAND.clusterSize) {
  const groups = /* @__PURE__ */ new Map();
  for (const u of units) {
    const k = `${u.key}|${u.arm}`;
    (groups.get(k) ?? groups.set(k, []).get(k)).push(u);
  }
  const out = [];
  for (const g of [...groups.values()].sort((a, b) => a[0].key + a[0].arm < b[0].key + b[0].arm ? -1 : 1)) {
    g.sort((a, b) => a.id - b.id);
    for (let i = 0; i < g.length; i += size) out.push({ key: g[0].key, arm: g[0].arm, ids: g.slice(i, i + size).map((u) => u.id) });
  }
  return out;
}
var iconCount = (n) => Math.max(1, Math.ceil(n / COMMAND.iconEvery));

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
var effWeapon = (v) => v.team === "player" && v.gear.wb && v.gear.w === v.weapon ? null : v.weapon;
var armOf = (v) => v.team === "player" && v.job === "fight" && v.arm === "cavalry" ? "cavalry" : armOfWeapon(effWeapon(v));
var weaponOf = (v) => WEAPONS[effWeapon(v) ?? "fist"] ?? WEAPONS.fist;
var armorOf = (v) => v.armor && !(v.team === "player" && v.gear.ab && v.gear.a === v.armor) ? ARMORS[v.armor] ?? null : null;
function canSee(sim, v, x, y) {
  return v.team !== "player" || sim.fog.state[Math.floor(y) * sim.world.size + Math.floor(x)] === 2;
}
var isFighter = (v) => v.job === "fight" || v.job === "hunt" || v.fight.mode !== "none";
function teamsHostile(sim, a, b) {
  if (a === b || a === "wild" || b === "wild") return false;
  if (a === "player") return sim.tribeHostile(b);
  if (b === "player") return sim.tribeHostile(a);
  return false;
}
var CELL = 8;
function sideGrid(sim, side) {
  let c = sim.threatCache;
  if (!c || c.time !== sim.time) c = sim.threatCache = { time: sim.time, foes: null, mine: null };
  if (!c[side]) {
    const g = /* @__PURE__ */ new Map();
    for (const o of side === "foes" ? sim.foes : sim.villagers) {
      if (o.health <= 0) continue;
      const k = Math.floor(o.y / CELL) * 1024 + Math.floor(o.x / CELL), cell = g.get(k);
      if (cell) cell.push(o);
      else g.set(k, [o]);
    }
    c[side] = g;
  }
  return c[side];
}
function nearbyOthers(sim, v, radius) {
  const g = sideGrid(sim, v.team === "player" ? "foes" : "mine"), r = Math.ceil((radius + 1) / CELL), cx = Math.floor(v.x / CELL), cy = Math.floor(v.y / CELL), out = [];
  for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
    const cell = g.get(j * 1024 + i);
    if (cell) for (const o of cell) out.push(o);
  }
  return out;
}
function threatsOf(sim, v, radius) {
  const out = [], N = sim.world.size, player = v.team === "player";
  const seen = (x, y) => !player || sim.fog.state[Math.floor(y) * N + Math.floor(x)] === 2;
  for (const o of nearbyOthers(sim, v, radius)) {
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
  const armor = armorOf(v), final = dmg * (1 - (armor ? armor[type] : 0)) * (v.team === "player" ? sim.takenFactor(v, !!src.unit && weaponOf(src.unit).ranged === true) : 1);
  v.health -= final;
  v.calm = 0;
  v.flinch = 0.3;
  if (armor) sim.wearGear(v, "armor");
  const behind = v.facing === "right" && from.x < v.x || v.facing === "left" && from.x > v.x;
  if (behind) v.morale = Math.max(0, v.morale + MORALE.backstab);
  if (src.unit && src.unit.team === "player" && v.team !== "player") sim.tribeAttacked(v.team, v);
  if (v.health > 0) {
    if (!v.fight.target && src.unit && v.team !== "player") v.fight.target = { kind: "unit", id: src.unit.id };
    else if (!v.fight.target && src.animal && v.team !== "player") v.fight.target = { kind: "animal", id: src.animal.id };
    return;
  }
  if (v.team === "player") fallUnit(sim, v);
  else sim.killFoe(v, src.unit);
}
function fallUnit(sim, v) {
  sim.resetTask(v);
  v.queue.length = 0;
  v.swing = null;
  moraleShock(sim, v, MORALE.allyDeath);
  sim.noteBattle("ours");
  sim.killUnit(v, "t\u1EED tr\u1EADn");
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
function armMultiplier(attacker, e) {
  return e.kind === "unit" ? matchup(armOf(attacker), armOf(e.v), effWeapon(attacker)) : 1;
}
function fireProjectile(sim, v, e, from, mult, rangeBonus) {
  const w = weaponOf(v), tx = entX(e), ty = entY(e), d = Math.hypot(tx - from.x, ty - from.y);
  if (d > w.range + rangeBonus + 1 || !canSee(sim, v, tx, ty)) return false;
  const shot = w.damage * clampTactical(armMultiplier(v, e) * mult * sim.attackFactor(v, e)) * WEATHER[sim.weather].bow * (d <= UNIT_RULES.archerPressed.within ? UNIT_RULES.archerPressed.damage : 1);
  if (v.inside !== null) sim.noteBattle("shot");
  const target = e.kind === "unit" ? { kind: "unit", id: e.v.id } : { kind: "animal", id: e.a.id };
  sim.projectiles.push({ x: from.x, y: from.y - 0.4, tx, ty, speed: 14, dmg: shot, type: w.type, from, src: v.id, team: v.team, target, chance: d <= (w.range + rangeBonus) / 2 ? RULES.rangedHitNear : RULES.rangedHitFar, kind: w.projectile ?? "stone" });
  sim.wearGear(v, "weapon");
  return true;
}
function resolveSwing(sim, v, target) {
  const e = resolve(sim, target);
  if (!e) return;
  const w = weaponOf(v), d = Math.hypot(entX(e) - v.x, entY(e) - v.y), arm = armMultiplier(v, e);
  if (w.ranged) {
    fireProjectile(sim, v, e, { x: v.x, y: v.y }, 1, 0);
    return;
  }
  if (d > w.range + 1.1) return;
  let behind = false;
  if (e.kind === "unit") behind = e.v.facing === "right" && v.x < e.v.x || e.v.facing === "left" && v.x > e.v.x;
  else behind = e.a.dir === 1 && v.x < e.a.x || e.a.dir === -1 && v.x > e.a.x;
  hurt(sim, target, damageOf(w, v.stats.str, null, behind) * clampTactical(arm * sim.attackFactor(v, e)), w.type, { x: v.x, y: v.y }, { unit: v });
  if (v.weapon) sim.wearGear(v, "weapon");
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
  const looking = scanNow || v.phase === "flee" || v.phase === "fight" && (!v.fight.target || v.morale < MORALE.flee);
  const sight = v.team === "player" ? sim.sightOf(v) : SIGHT;
  const threats = looking ? threatsOf(sim, v, sight + 1) : [];
  if (rest) {
    if (scanNow && threats.length && threats[0].d < 7) {
      if (isFighter(v)) v.nightOwl = true;
      sim.resetTask(v);
    } else return false;
  }
  if (v.phase === "flee" || v.fleeT > 0 || v.morale < MORALE.flee && threats.length) return fleeBrain(sim, v, dt, threats);
  if (v.breaks && sim.breakBrain(v, dt)) return true;
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
  if (d <= reach && (!w.ranged || canSee(sim, v, x, y))) {
    v.path = [];
    v.slide = null;
    v.facing = x >= v.x ? "right" : "left";
    if (!v.swing && v.atkCd <= 0) startSwing(sim, v, e.kind === "unit" ? { kind: "unit", id: e.v.id } : { kind: "animal", id: e.a.id });
    return;
  }
  if (v.swing) return;
  v.fight.repath -= dt;
  if ((v.fight.repath <= 0 || !v.path.length) && sim.pathLeft > 0) {
    sim.pathLeft--;
    v.fight.repath = 0.5;
    v.path = sim.pathTo(v, Math.floor(x), Math.floor(y), 3500);
    if (!v.path.length) v.fight.repath = 1.5;
  }
}
function fightBrain(sim, v, dt, threats) {
  const f = v.fight;
  if (v.phase === "skin" || v.phase === "goCarcass") return huntBrain(sim, v, dt, threats);
  if (f.mode === "hold" && !f.anchor) f.anchor = { x: v.x, y: v.y };
  if (!threats.length && !f.target && v.phase !== "fight" && (sim.planGearRepair(v) || sim.planEquipGear(v) || sim.planGearErrand(v))) return true;
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
    const range = f.mode === "hold" ? weaponOf(v).range + 1.5 : v.stance === "defensive" ? Math.min(DEFENSIVE, sim.sightOf(v)) : sim.sightOf(v);
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
      if (!v.path.length && sim.pathLeft > 0) {
        sim.pathLeft--;
        v.path = f.strict ? sim.lineSteps(v, f.dest.x, f.dest.y) : sim.pathTo(v, Math.floor(f.dest.x), Math.floor(f.dest.y), 2e4);
      }
      v.phase = "move";
      return true;
    }
  }
  if (v.post >= 0 && v.phase === "idle" && !threats.length && !f.target) {
    sim.planStaff(v);
    if (v.phase === "goStaff") return true;
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
      if (sim.pathLeft <= 0) return true;
      sim.pathLeft--;
      v.path = sim.pathTo(v, Math.floor(post.x), Math.floor(post.y), 3e4);
      v.phase = v.path.length ? "move" : "idle";
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
    if (v.job === "fight" && v.arm === "archer" !== !!WEAPONS[id].ranged) continue;
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
    { x: cx, y: cy, w: 2, h: 2, kind: "fire", hp: SIEGE.propHp.fire },
    { x: cx - 5, y: cy - 1, w: 2, h: 2, kind: "pile", hp: SIEGE.propHp.pile },
    { x: cx + 4, y: cy + 1, w: 2, h: 2, kind: "pile", hp: SIEGE.propHp.pile }
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
  if (v.ai?.role === "raider") sim.noteBattle("foes");
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
  if (sim.plans.some((p) => p.kind === "attack" && p.status === "running" && p.tribe === t.id)) return;
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
function raidAdvised(sim, t, size) {
  const ours = sim.villagers.filter((v) => v.job === "fight").length, theirs = Math.min(size, t.unitIds.filter((u) => sim.get(u)?.ai?.role === "guard").length);
  return ours < 6 || theirs >= ours * 0.35;
}
function launchRaid(sim, t, size) {
  const guards = t.unitIds.map((u) => sim.get(u)).filter((u) => u?.ai?.role === "guard").sort((a, b) => b.maxHealth - a.maxHealth);
  const n = Math.min(size, guards.length);
  if (n < 3 || t.raid) return;
  const id = ++sim.nextRaid;
  t.raid = { id, phase: "march", t: 0, max: 200, size: n };
  const ours = sim.villagers.filter((v) => v.job === "fight"), oursArch = ours.filter((v) => armOfWeapon(v.weapon) === "archer").length, wantArch = ours.length >= 4 && oursArch * 2 <= ours.length ? Math.floor(n / 3) : 0;
  const melee = t.def.weapons.filter((w) => !WEAPONS[w]?.ranged), picks = guards.slice(0, n);
  picks.forEach((g, i) => {
    g.ai.role = "raider";
    g.ai.raid = id;
    g.fight.target = null;
    g.path = [];
    g.fleeT = 0;
    g.weapon = i < wantArch ? i % 2 ? "sling" : "bow" : melee[i % Math.max(1, melee.length)] ?? g.weapon;
  });
  t.angryUntil = sim.time + 400;
  const arch = picks.filter((g) => armOfWeapon(g.weapon) === "archer").length;
  sim.say(`Qu\xE2n ${t.def.name} (${n} ng\u01B0\u1EDDi${sim.mapLevel(t.id) >= 3 ? `: ${arch} cung th\u1EE7, ${n - arch} b\u1ED9 binh` : ""}) \u0111ang ti\u1EBFn v\xE0o l\xE0ng!`);
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
      if (t && t.state === "free") {
        if (raidAdvised(sim, t, e.size) || e.fireDay >= e.warnDay + 4) launchRaid(sim, t, e.size);
        else {
          e.fired = false;
          e.fireDay = sim.day + 1;
          e.warned = true;
          sim.say(`${t.def.name} th\u1EA5y l\xE0ng \u0111\xF4ng qu\xE2n v\xE0 ho\xE3n t\u1EADp k\xEDch.`);
        }
      }
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
function noteStuck(sim, f, ai, dt, blocked) {
  if (!blocked) {
    ai.stuck = 0;
    return;
  }
  ai.stuck = (ai.stuck ?? 0) + dt;
  if (ai.stuck < 3) return;
  const wall = sim.nearestWork(f.x, f.y, 16) ?? sim.nearestWork(f.x, f.y, 4, true);
  ai.stuck = 0;
  if (wall) ai.siege = wall.id;
}
function siegeBrain(sim, f, ai, dt, threats) {
  if (!ai.siege) return false;
  if (threats.length && threats[0].d <= weaponOf(f).range + 1.5) return false;
  const b = sim.getBuilding(ai.siege);
  if (!b) {
    ai.siege = 0;
    f.path = [];
    return false;
  }
  const w = weaponOf(f), d = BUILDINGS[b.kind], cx = b.x + d.w / 2, cy = b.y + d.h / 2;
  const dist = Math.hypot(cx - f.x, cy - f.y) - Math.max(d.w, d.h) / 2;
  if (dist <= (w.ranged ? 1.2 : w.range) + 0.6) {
    f.path = [];
    f.slide = null;
    f.phase = "fight";
    f.facing = cx >= f.x ? "right" : "left";
    if (f.atkCd <= 0 && !f.swing) {
      const { hitAt, end } = swingTimes(w.anim);
      f.swing = { t: 0, hitAt, end, target: { kind: "unit", id: -1 } };
      f.atkCd = cycleOf(w.cycle, f.stats.agi);
      sim.damageWork(b, (w.damage + (w.ranged ? 0 : RULES.strengthDamage * f.stats.str)) * (w.type === "slash" ? 1.5 : 1));
    }
    return true;
  }
  f.fight.repath -= dt;
  if (!f.path.length && f.fight.repath <= 0) {
    const ring = sim.ringTiles(f, b.x, b.y, d.w, d.h);
    f.path = ring.length ? sim.pathTo(f, ring[0][0], ring[0][1], 4e3) : [];
    f.fight.repath = 1;
    if (!f.path.length) {
      ai.siege = 0;
      return false;
    }
  }
  f.phase = "move";
  return true;
}
function foeBrain(sim, f, t, ai, dt) {
  const free = t.state === "free";
  f.fight.scan -= dt;
  const radius = ai.role === "raider" ? 12 : ai.role === "civ" ? 9 : AGGRO[t.def.personality];
  const scanNow = f.fight.scan <= 0;
  if (scanNow) f.fight.scan = 0.4;
  const looking = scanNow || f.phase === "flee" || f.phase === "fight" && (!f.fight.target || f.morale < MORALE.flee);
  const threats = free && looking ? threatsOf(sim, f, radius) : [];
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
      if (!f.path.length && sim.pathLeft > 0 && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) > 4) {
        sim.pathLeft--;
        f.path = sim.pathTo(f, Math.floor(ai.camp.x), Math.floor(ai.camp.y), 2e4);
      }
      f.phase = "move";
      return;
    }
    if (siegeBrain(sim, f, ai, dt, threats)) return;
    if (f.fight.target) {
      const e = resolve(sim, f.fight.target);
      if (e) {
        engage(sim, f, e, dt);
        const ex = e.kind === "unit" ? e.v.x : e.a.x, ey = e.kind === "unit" ? e.v.y : e.a.y;
        noteStuck(sim, f, ai, dt, !f.path.length && !f.swing && Math.hypot(ex - f.x, ey - f.y) > weaponOf(f).range + 2);
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
      f.fight.repath -= dt;
      if (!f.path.length && f.fight.repath <= 0 && sim.pathLeft > 0) {
        sim.pathLeft--;
        f.path = sim.pathTo(f, Math.floor(gx), Math.floor(gy), 4e4);
        f.fight.repath = f.path.length ? 0.5 : 1.5;
      }
      f.phase = "move";
      noteStuck(sim, f, ai, dt, !f.path.length);
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
  _note: 'How long things take, in one place. gather: real seconds (at 1x speed) to collect ONE unit for an average villager with a good tool (speed factor 1.0); farm is the same for one unit from a field of the first level (a higher level divides it by its craftSpeed). A day is 20 minutes, 12 of them daylight; walking, carrying and the weather come on top. bare: how well bare hands do compared with a good tool (1 = as good). Building, crafting, research and repair are measured in days of labour instead (see buildings.ts, tools.ts, research.json) because they should take about the same fraction of a day however long a day lasts. Weather and season slow outdoor work: see weather.json and seasons.json (key "work").',
  gather: { wood: 11, stone: 17, food: 6, farm: 70 },
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
var JOB_NAME = { idle: "R\u1EA3nh", wood: "\u0110\u1ED1n g\u1ED7", stone: "Th\u1EE3 \u0111\xE1", food: "H\xE1i l\u01B0\u1EE3m", build: "Th\u1EE3 x\xE2y", craft: "Ch\u1EBF t\u1EA1o", research: "Nghi\xEAn c\u1EE9u", repair: "S\u1EEDa ch\u1EEFa", hunt: "Th\u1EE3 s\u0103n", fight: "Chi\u1EBFn binh", scout: "Trinh s\xE1t" };
var WORK_JOBS = ["wood", "stone", "food", "build", "craft", "research", "repair", "hunt", "fight"];
var ROLES = {
  wood: { job: "wood", building: "lumberyard", names: { stone: "\u0110\u1ED1n g\u1ED7", ancient: "Ti\u1EC1u phu" } },
  stone: { job: "stone", building: "quarry", names: { stone: "Th\u1EE3 \u0111\xE1", ancient: "Th\u1EE3 m\u1ECF" } },
  food: { job: "food", building: "farmhouse", names: { stone: "H\xE1i l\u01B0\u1EE3m", ancient: "N\xF4ng d\xE2n" } },
  hunt: { job: "hunt", building: "huntlodge", names: { stone: "Th\u1EE3 s\u0103n", ancient: "Th\u1EE3 s\u0103n" } },
  foot: { job: "fight", arm: "foot", building: "infantry", names: { stone: "Chi\u1EBFn binh", ancient: "B\u1ED9 binh" } },
  cavalry: { job: "fight", arm: "cavalry", building: "cavalry", names: { stone: "K\u1EF5 th\xFA", ancient: "K\u1EF5 binh" } },
  archer: { job: "fight", arm: "archer", building: "archery", names: { stone: "Th\u1EE3 n\xE9m", ancient: "Cung th\u1EE7" } },
  scout: { job: "scout", building: "scouttent", names: { stone: "Trinh s\xE1t", ancient: "Trinh s\xE1t" } }
};
var ROLE_IDS = Object.keys(ROLES);
var roleName = (role, era) => ROLES[role].names[era];
function roleOf(v) {
  switch (v.job) {
    case "fight":
      return v.arm === "archer" ? "archer" : v.arm === "cavalry" ? "cavalry" : "foot";
    case "food":
      return v.post < 0 ? "food" : null;
    case "wood":
    case "stone":
    case "hunt":
    case "scout":
      return v.job;
    default:
      return null;
  }
}
var STAFF_BUILDING = { craft: "workshop", research: "lab", repair: "repair" };
var isStaffJob = (j) => j in STAFF_BUILDING;
var FARM_TIME = pace_default.gather.farm;
var XP_LEVELS = [60, 150, 300, 500, 800];
var MAX_LEVEL = 5;
var CREW_BUILDING = { build: "builder" };
var BARE_HANDS = pace_default.bare;
var OUTDOOR_JOBS = pace_default.outdoor;

// src/data/research.json
var research_default = {
  enabled: true,
  _note: "Research is done inside the Nh\xE0 nghi\xEAn c\u1EE9u by villagers who work there: the more and the smarter, the faster. Every tool, weapon and armour has ONE blueprint that is raised step by step (tech id = recipe id: axe1 is the wood axe, axe2 the stone one); a recipe can only be made once its blueprint step is researched and the Nh\xE0 ch\u1EBF t\u1EA1o is high enough (recipeLevel). cost may include coin (shells in the stone age). time is seconds at speed 1 with one average researcher; the best researcher inside must reach minInt. needLevel is the Nh\xE0 nghi\xEAn c\u1EE9u level. unlocks: recipes, levels (highest level per building kind), buildings (kinds that may be built), auto (fetch: villagers fetch tools from the stores; order: villagers order crafting and repair themselves). Set enabled to false to open everything.",
  recipeLevel: { axe1: 1, hammer1: 1, pick1: 1, hoe1: 1, club1: 1, hide1: 1, spear1: 2, axe2: 2, pick2: 2, hoe2: 2, hammer2: 2, mace2: 3, torch1: 1, sling1: 1, bow1: 2 },
  techs: [
    { id: "hammer1", name: "B\u1EA3n v\u1EBD B\xFAa g\u1ED7", desc: "V\u1EBD c\xE1ch \u0111\u1EBDo b\xFAa g\u1ED7 \u0111\u1EC3 d\u1EF1ng nh\xE0 nhanh h\u01A1n.", requires: [], needLevel: 1, minInt: 4, cost: { wood: 6, coin: 2 }, time: 150, unlocks: { recipes: ["hammer1"] } },
    { id: "axe1", name: "B\u1EA3n v\u1EBD R\xECu g\u1ED7", desc: "V\u1EBD c\xE1ch \u0111\u1EBDo r\xECu g\u1ED7 \u0111\u1EC3 \u0111\u1ED1n c\xE2y.", requires: [], needLevel: 1, minInt: 4, cost: { wood: 6, coin: 2 }, time: 150, unlocks: { recipes: ["axe1"] } },
    { id: "pick1", name: "B\u1EA3n v\u1EBD Cu\u1ED1c chim g\u1ED7", desc: "V\u1EBD c\xE1ch \u0111\u1EBDo cu\u1ED1c chim g\u1ED7 \u0111\u1EC3 \u0111\u1EE5c \u0111\xE1.", requires: [], needLevel: 1, minInt: 4, cost: { wood: 6, coin: 2 }, time: 160, unlocks: { recipes: ["pick1"] } },
    { id: "hoe1", name: "B\u1EA3n v\u1EBD Cu\u1ED1c g\u1ED7", desc: "V\u1EBD c\xE1ch \u0111\u1EBDo cu\u1ED1c g\u1ED7 \u0111\u1EC3 h\xE1i l\u01B0\u1EE3m, \u0111\xE0o c\u1EE7.", requires: [], needLevel: 1, minInt: 4, cost: { wood: 6, coin: 2 }, time: 140, unlocks: { recipes: ["hoe1"] } },
    { id: "torch1", name: "B\u1EA3n v\u1EBD \u0110u\u1ED1c", desc: "Qu\u1EA5n nh\u1EF1a v\xE0 c\xE0nh kh\xF4 th\xE0nh \u0111u\u1ED1c \u0111\u1EC3 l\xE0m vi\u1EC7c \u0111\u01B0\u1EE3c ban \u0111\xEAm.", requires: [], needLevel: 1, minInt: 3, cost: { wood: 4, coin: 1 }, time: 120, unlocks: { recipes: ["torch1"] } },
    { id: "club1", name: "B\u1EA3n v\u1EBD G\u1EADy chi\u1EBFn", desc: "V\u1EBD c\xE1ch \u0111\u1EBDo g\u1EADy chi\u1EBFn \u0111\u1EC3 t\u1EF1 v\u1EC7 v\xE0 \u0111i s\u0103n.", requires: ["hammer1"], needLevel: 1, minInt: 5, cost: { wood: 8, coin: 3 }, time: 180, unlocks: { recipes: ["club1"] } },
    { id: "hide1", name: "B\u1EA3n v\u1EBD \xC1o da", desc: "V\u1EBD c\xE1ch kh\xE2u da th\xFA th\xE0nh \xE1o gi\xE1p.", requires: ["axe1"], needLevel: 1, minInt: 6, cost: { hide: 4, coin: 4 }, time: 240, unlocks: { recipes: ["hide1"] } },
    { id: "spear1", name: "B\u1EA3n v\u1EBD Gi\xE1o v\xF3t nh\u1ECDn", desc: "V\u1EBD c\xE1ch v\xF3t gi\xE1o c\xF3 t\u1EA7m \u0111\xE2m xa h\u01A1n g\u1EADy.", requires: ["club1"], needLevel: 2, minInt: 6, cost: { wood: 12, coin: 5 }, time: 320, unlocks: { recipes: ["spear1"] } },
    { id: "sling1", name: "B\u1EA3n v\u1EBD D\xE2y qu\u0103ng \u0111\xE1", desc: "V\u1EBD c\xE1ch b\u1EC7n d\xE2y qu\u0103ng \u0111\xE1: cung th\u1EE7 t\u1EA7m ng\u1EAFn, b\u1EAFn t\u1EEB xa.", requires: ["club1"], needLevel: 1, minInt: 5, cost: { wood: 8, coin: 3 }, time: 200, unlocks: { recipes: ["sling1"] } },
    { id: "bow1", name: "B\u1EA3n v\u1EBD Cung ng\u1EAFn", desc: "V\u1EBD c\xE1ch u\u1ED1n cung v\xE0 v\xF3t t\xEAn: cung th\u1EE7 t\u1EA7m xa.", requires: ["sling1", "spear1"], needLevel: 2, minInt: 6, cost: { wood: 12, coin: 5 }, time: 320, unlocks: { recipes: ["bow1"] } },
    { id: "axe2", name: "B\u1EA3n v\u1EBD R\xECu \u0111\xE1 (n\xE2ng c\u1EA5p)", desc: "N\xE2ng b\u1EA3n v\u1EBD R\xECu l\xEAn c\u1EA5p 2: l\u01B0\u1EE1i \u0111\xE1 b\u1EC1n v\xE0 nhanh h\u01A1n g\u1ED7.", requires: ["axe1"], needLevel: 2, minInt: 6, cost: { wood: 10, stone: 15, coin: 6 }, time: 380, unlocks: { recipes: ["axe2"] } },
    { id: "pick2", name: "B\u1EA3n v\u1EBD Cu\u1ED1c chim \u0111\xE1 (n\xE2ng c\u1EA5p)", desc: "N\xE2ng b\u1EA3n v\u1EBD Cu\u1ED1c chim l\xEAn c\u1EA5p 2.", requires: ["pick1"], needLevel: 2, minInt: 6, cost: { wood: 10, stone: 15, coin: 6 }, time: 380, unlocks: { recipes: ["pick2"] } },
    { id: "hoe2", name: "B\u1EA3n v\u1EBD Cu\u1ED1c \u0111\xE1 (n\xE2ng c\u1EA5p)", desc: "N\xE2ng b\u1EA3n v\u1EBD Cu\u1ED1c l\xEAn c\u1EA5p 2.", requires: ["hoe1"], needLevel: 2, minInt: 6, cost: { wood: 10, stone: 10, coin: 6 }, time: 340, unlocks: { recipes: ["hoe2"] } },
    { id: "hammer2", name: "B\u1EA3n v\u1EBD B\xFAa \u0111\xE1 (n\xE2ng c\u1EA5p)", desc: "N\xE2ng b\u1EA3n v\u1EBD B\xFAa l\xEAn c\u1EA5p 2.", requires: ["hammer1"], needLevel: 2, minInt: 6, cost: { wood: 10, stone: 15, coin: 6 }, time: 360, unlocks: { recipes: ["hammer2"] } },
    { id: "mace2", name: "B\u1EA3n v\u1EBD Ch\xF9y \u0111\xE1", desc: "V\u1EBD c\xE1ch bu\u1ED9c \u0111\u1EA7u \u0111\xE1 n\u1EB7ng v\xE0o c\xE1n th\xE0nh ch\xF9y.", requires: ["club1", "axe2"], needLevel: 3, minInt: 8, cost: { stone: 30, coin: 10 }, time: 600, unlocks: { recipes: ["mace2"] } },
    { id: "timber", name: "D\u1EF1ng b\u1EB1ng g\u1ED7", desc: "N\xE2ng c\xE1c nh\xE0 l\xEAn c\u1EA5p 2 (g\u1ED7).", requires: ["hammer1"], needLevel: 1, minInt: 5, cost: { wood: 20, coin: 3 }, time: 200, unlocks: { levels: { storage: 2, workshop: 2, lab: 2, repair: 2, toolstore: 2, armory: 2, house: 2, infantry: 2, cavalry: 2, archery: 2, farmhouse: 2, huntlodge: 2, lumberyard: 2, quarry: 2, scouttent: 2, field: 2, fence: 2, gate: 2, tower: 2 } } },
    { id: "masonry", name: "X\xE2y b\u1EB1ng \u0111\xE1", desc: "N\xE2ng c\xE1c nh\xE0 l\xEAn c\u1EA5p 3 (\u0111\xE1).", requires: ["timber", "pick1"], needLevel: 2, minInt: 7, cost: { wood: 10, stone: 40, coin: 8 }, time: 420, unlocks: { levels: { storage: 3, workshop: 3, lab: 3, repair: 3, toolstore: 3, armory: 3, house: 3, infantry: 3, cavalry: 3, archery: 3, farmhouse: 3, huntlodge: 3, lumberyard: 3, quarry: 3, scouttent: 3, field: 3 } } },
    { id: "house", name: "Nh\xE0 d\xE2n", desc: "D\u1EF1ng nh\xE0 cho d\xE2n ng\u1EE7: ng\u1EE7 trong nh\xE0 h\u1ED3i s\u1EE9c nhanh h\u01A1n n\u1EB1m c\u1EA1nh \u0111\u1ED1ng l\u1EEDa.", requires: ["hammer1"], needLevel: 1, minInt: 5, cost: { wood: 15, coin: 3 }, time: 200, unlocks: { buildings: ["house"] } },
    { id: "barracks", name: "Tr\u1EA1i chi\u1EBFn binh", desc: "D\u1EF1ng tr\u1EA1i b\u1ED9 binh: tuy\u1EC3n chi\u1EBFn binh c\u1EADn chi\u1EBFn, h\u1ECD ng\u1EE7 \u1EDF \u0111\xE2y. N\xE2ng c\u1EA5p tr\u1EA1i \u0111\u1EC3 ch\u1EE9a th\xEAm ng\u01B0\u1EDDi.", requires: ["club1"], needLevel: 1, minInt: 5, cost: { wood: 15, coin: 4 }, time: 220, unlocks: { buildings: ["infantry"] } },
    { id: "camp_archery", name: "Tr\u1EA1i th\u1EE3 n\xE9m", desc: "D\u1EF1ng tr\u1EA1i cho ng\u01B0\u1EDDi n\xE9m \u0111\xE1, b\u1EAFn n\xE1: tuy\u1EC3n v\xE0 cho h\u1ECD ng\u1EE7 \u1EDF \u0111\xE2y.", requires: ["barracks", "sling1"], needLevel: 1, minInt: 6, cost: { wood: 15, coin: 4 }, time: 220, unlocks: { buildings: ["archery"] } },
    { id: "camp_cavalry", name: "Tr\u1EA1i k\u1EF5 th\xFA", desc: "D\u1EF1ng tr\u1EA1i cho ng\u01B0\u1EDDi c\u01B0\u1EE1i th\xFA: xung phong nhanh, kh\u1EAFc cung th\u1EE7 nh\u01B0ng s\u1EE3 gi\xE1o.", requires: ["barracks", "spear1"], needLevel: 1, minInt: 7, cost: { wood: 20, hide: 6, coin: 6 }, time: 260, unlocks: { buildings: ["cavalry"] } },
    { id: "farming", name: "L\xE0m ru\u1ED9ng", desc: "V\u1EE1 \u0111\u1EA5t l\xE0m ru\u1ED9ng: th\u1EE9c \u0103n \u0111\u1EC1u quanh n\u0103m, kh\xF4ng nh\u01B0 b\u1EE5i qu\u1EA3 ch\u1EC9 h\xE1i m\u1ED9t l\u1EA7n.", requires: ["hoe1"], needLevel: 1, minInt: 5, cost: { wood: 15, coin: 3 }, time: 220, unlocks: { buildings: ["field"] } },
    { id: "fence", name: "H\xE0ng r\xE0o c\u1ECDc", desc: "\u0110\xF3ng c\u1ECDc nh\u1ECDn ch\u1EB7n \u0111\u01B0\u1EDDng, t\u1EA1o ch\u1ED7 th\u1EAFt; l\xEAn c\u1EA5p hai th\xE0nh h\xE0ng r\xE0o \u0111\xF4i \u0111\u1EAFp \u0111\u1EA5t.", requires: ["hammer1", "timber"], needLevel: 1, minInt: 5, cost: { wood: 15, coin: 3 }, time: 200, unlocks: { buildings: ["fence"] } },
    { id: "gate", name: "C\u1ED5ng h\xE0ng r\xE0o", desc: "C\u1ED5ng \u0111\u1EC3 ng\u01B0\u1EDDi m\xECnh ra v\xE0o, \u0111\xF3ng l\u1EA1i th\xEC ch\u1EB7n m\u1ECDi ng\u01B0\u1EDDi.", requires: ["fence"], needLevel: 1, minInt: 5, cost: { wood: 12, coin: 3 }, time: 160, unlocks: { buildings: ["gate"] } },
    { id: "tower", name: "Ch\xF2i canh", desc: "Ch\xF2i cao cho cung th\u1EE7: b\u1EAFn xa h\u01A1n v\xE0 m\u1EA1nh h\u01A1n.", requires: ["fence"], needLevel: 2, minInt: 6, cost: { wood: 20, coin: 4 }, time: 240, unlocks: { buildings: ["tower"] } },
    { id: "pit", name: "\u0110\xE0o h\xE0o, h\u1ED1 ch\xF4ng", desc: "\u0110\xE0o h\u1ED1 g\xE0i c\u1ECDc nh\u1ECDn tr\xEAn \u0111\u01B0\u1EDDng \u0111\u1ECBch t\u1EDBi.", requires: ["fence", "pick1"], needLevel: 1, minInt: 5, cost: { wood: 15, coin: 3 }, time: 200, unlocks: { buildings: ["trap"] } },
    { id: "signal", name: "T\xEDn hi\u1EC7u (tr\u1ED1ng, kh\xF3i)", desc: "Tr\u1ED1ng b\xE1o \u0111\u1ED9ng: d\xE2n v\u1EC1 l\u1EEDa, qu\xE2n v\u1EC1 v\u1ECB tr\xED; th\u1EBB l\u1EC7nh Ph\xE1t t\xEDn hi\u1EC7u cho c\xE1c \u0111\u1ED9i.", requires: ["tower"], needLevel: 2, minInt: 6, cost: { wood: 15, coin: 4 }, time: 220, unlocks: {} },
    { id: "scout", name: "Trinh s\xE1t", desc: "D\u1EF1ng Tr\u1EA1i trinh s\xE1t v\xE0 c\u1EED ng\u01B0\u1EDDi \u0111i v\u1EBD b\u1EA3n \u0111\u1ED3 c\u1EA5p 1 c\u1EE7a m\u1ED9t l\xE0ng (v\u1ECB tr\xED, s\u1ED1 d\xE2n, h\u01B0\u1EDBng v\xE0o l\xE0ng).", requires: ["club1"], needLevel: 1, minInt: 5, cost: { wood: 8, coin: 3 }, time: 200, unlocks: { buildings: ["scouttent"] } },
    { id: "scout2", name: "V\u1EBD b\u1EA3n \u0111\u1ED3 \u0111\u1ECBa h\xECnh", desc: "Trinh s\xE1t v\u1EBD \u0111\u01B0\u1EE3c b\u1EA3n \u0111\u1ED3 c\u1EA5p 2: \u0111\u01B0\u1EDDng v\xE0o, h\xE0ng r\xE0o, c\u1ED5ng, ch\xF2i canh v\xE0 h\xECnh b\xF3ng ng\u01B0\u1EDDi.", requires: ["scout", "timber"], needLevel: 2, minInt: 6, cost: { wood: 12, coin: 4 }, time: 240, unlocks: {} },
    { id: "scout3", name: "V\u1EBD b\u1EA3n \u0111\u1ED3 chi ti\u1EBFt", desc: "Trinh s\xE1t v\u1EBD \u0111\u01B0\u1EE3c b\u1EA3n \u0111\u1ED3 c\u1EA5p 3: s\u1ED1 l\xEDnh t\u1EEBng lo\u1EA1i, kho l\u01B0\u01A1ng v\xE0 th\u1EE7 l\u0129nh.", requires: ["scout2", "masonry"], needLevel: 2, minInt: 8, cost: { wood: 15, stone: 10, coin: 6 }, time: 280, unlocks: {} },
    { id: "council", name: "H\u1ED9i \u0111\u1ED3ng chi\u1EBFn", desc: "D\u1EF1ng L\u1EC1u h\u1ECDp chi\u1EBFn: l\u1EADp \u0111\u1ED9i, k\u1EBF ho\u1EA1ch v\xE0 th\u1EBB l\u1EC7nh.", requires: ["scout"], needLevel: 1, minInt: 6, cost: { wood: 15, coin: 4 }, time: 240, unlocks: { buildings: ["wartent"] } },
    { id: "drill", name: "B\xE3i t\u1EADp", desc: "D\u1EF1ng b\xE3i luy\u1EC7n tr\u1EADn ph\xE1p cho c\xE1c \u0111\u1ED9i.", requires: ["council", "barracks"], needLevel: 1, minInt: 6, cost: { wood: 15, coin: 4 }, time: 220, unlocks: { buildings: ["drill"] } },
    { id: "form_basic", name: "Tr\u1EADn ph\xE1p c\u01A1 b\u1EA3n", desc: "H\xE0ng ngang v\xE0 v\xF2ng tr\xF2n.", requires: ["drill"], needLevel: 1, minInt: 6, cost: { wood: 12, coin: 4 }, time: 240, unlocks: {} },
    { id: "form_wedge", name: "Tr\u1EADn m\u0169i nh\u1ECDn", desc: "Xung phong ph\xE1 h\xE0ng.", requires: ["form_basic"], needLevel: 2, minInt: 7, cost: { wood: 12, coin: 5 }, time: 260, unlocks: {} },
    { id: "form_horns", name: "Tr\u1EADn s\u1EEBng b\xF2", desc: "Bao hai c\xE1nh, \u0111\xE1nh s\u01B0\u1EDDn v\xE0 l\u01B0ng.", requires: ["form_basic", "signal"], needLevel: 2, minInt: 7, cost: { wood: 12, coin: 5 }, time: 260, unlocks: {} },
    { id: "form_scatter", name: "Tr\u1EADn r\u1EA3i qu\xE2n", desc: "Gi\u1EA3m thi\u1EC7t h\u1EA1i t\u1EEB cung v\xE0 l\u1EEDa.", requires: ["form_basic"], needLevel: 2, minInt: 7, cost: { wood: 12, coin: 5 }, time: 260, unlocks: {} },
    { id: "form_ambush", name: "Tr\u1EADn ph\u1EE5c k\xEDch", desc: "\u0110\xF2n \u0111\u1EA7u m\u1EA1nh g\u1EA5p \u0111\xF4i v\xE0o \u0111\u1ECBch ch\u01B0a bi\u1EBFt.", requires: ["form_basic", "signal"], needLevel: 2, minInt: 7, cost: { wood: 12, coin: 5 }, time: 260, unlocks: {} },
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
  const b = { id: sim.nextBid++, kind, era: sim.era, x, y, level: 1, progress: done ? 1 : 0, done, upgrading: false, rebuild: false, hp: 0, open: true, staff: [], active: null, workers: 0 };
  b.hp = maxHp(b);
  sim.buildings.push(b);
  setOcc(sim, b, 1);
  return b;
}
function placeStarters(sim) {
  const s = sim.world.start;
  for (const kind of ["lumberyard", "farmhouse", "quarry"]) {
    let done = false;
    for (let r = 4; r < 16 && !done; r++) for (let dx = -r; dx <= r && !done; dx++) for (let dy = -r; dy <= r && !done; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = s.x + dx, y = s.y + dy;
      if (footprintError(sim, kind, x, y) === null) {
        addBuilding(sim, kind, x, y, true);
        done = true;
      }
    }
  }
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
function buildingLimit(sim, kind) {
  const per = BUILDINGS[kind].perFire;
  if (!per) return 1;
  return sim.buildings.reduce((n, f) => n + (f.kind === "campfire" ? per[Math.min(per.length, f.level) - 1] : 0), 0);
}
function buildingLock(sim, kind) {
  const have = sim.buildings.filter((b) => b.kind === kind).length, limit = buildingLimit(sim, kind);
  if (limit === 0) return `C\u1EA7n n\xE2ng c\u1EA5p Nh\xE0 chung \u0111\u1EC3 x\xE2y ${BUILDINGS[kind].name.toLowerCase()}`;
  if (have >= limit) return limit === 1 ? "M\u1ED7i c\xF4ng tr\xECnh ch\u1EC9 x\xE2y \u0111\u01B0\u1EE3c m\u1ED9t c\xE1i, h\xE3y n\xE2ng c\u1EA5p n\xF3" : `\u0110\xE3 \u0111\u1EE7 ${limit} ${BUILDINGS[kind].name.toLowerCase()}: n\xE2ng c\u1EA5p Nh\xE0 chung \u0111\u1EC3 x\xE2y th\xEAm`;
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
    b.hp = maxHp(b);
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
      if (v.job !== "fight") v.job = "idle";
      v.post = -1;
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
      if (isStaffJob(v.job) || v.post === b.id) v.job = "idle";
      sim.resetTask(v);
    }
  }
  for (const v of sim.villagers) if (v.post === b.id) {
    v.post = -1;
    if (v.job === "food" && v.phase === "idle") v.job = "idle";
  }
}
function setOcc(sim, b, val) {
  const d = BUILDINGS[b.kind];
  if (b.kind === "gate" && b.open || b.kind === "trap") val = 0;
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) sim.world.occ[(b.y + j) * sim.world.size + b.x + i] = val;
}
function canDemolish(sim, b) {
  return BUILDINGS[b.kind].buildable ? null : "Kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c c\xF4ng tr\xECnh n\xE0y";
}
function destroyBuilding(sim, b) {
  evict(sim, b);
  setOcc(sim, b, 0);
  sim.buildings.splice(sim.buildings.indexOf(b), 1);
  sim.fogDirty = true;
  sim.trimRoles();
}
function demolishBuilding(sim, id) {
  const b = sim.getBuilding(id);
  if (!b) return "Kh\xF4ng t\xECm th\u1EA5y c\xF4ng tr\xECnh";
  const why = canDemolish(sim, b);
  if (why) return why;
  if (Object.values(ROLES).some((r) => r.building === b.kind) && sim.warLock()) return sim.warLock();
  const back = salvage(sim, b);
  evict(sim, b);
  setOcc(sim, b, 0);
  sim.buildings.splice(sim.buildings.indexOf(b), 1);
  for (const r of Object.keys(back)) sim.stock[r] += back[r] ?? 0;
  sim.fogDirty = true;
  sim.trimRoles();
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
var GEAR_KINDS = ["club", "spear", "mace", "sling", "bow", "hide"];
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
        if (owner && isGear(r.kind)) {
          owner.repairFor = null;
          if (r.kind === "hide") {
            if (!owner.armor) {
              owner.armor = "hide";
              owner.gear.a = null;
            }
          } else if (!owner.weapon) {
            owner.weapon = r.kind;
            owner.gear.w = null;
          }
          b.active = null;
          sim.say(`\u0110\xE3 s\u1EEDa xong ${recipeName(r).toLowerCase()}, tr\u1EA3 l\u1EA1i cho ${owner.name}.`);
          continue;
        }
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
  const pool = sim.villagers.filter((v) => v.down <= 0 && v.inside === null && v.job !== job && v.job !== "fight" && v.job !== "hunt" && v.job !== "scout");
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
  const lock = sim.warLock();
  if (lock) return lock;
  const house = sim.building(CREW_BUILDING.build);
  if (!house) return `Ch\u01B0a c\xF3 ${BUILDINGS.builder.name}, ho\u1EB7c ch\u01B0a x\xE2y xong`;
  let err = null;
  for (const v of sim.mine(ids)) {
    if (v.job === "build") continue;
    if (v.job === "fight") {
      err = "Chi\u1EBFn binh do tr\u1EA1i l\xEDnh c\u1EE7a h\u1ECD qu\u1EA3n l\xFD: cho ngh\u1EC9 tr\u01B0\u1EDBc";
      continue;
    }
    if (v.job === "scout") {
      err = "Trinh s\xE1t do Tr\u1EA1i trinh s\xE1t qu\u1EA3n l\xFD: cho ngh\u1EC9 tr\u01B0\u1EDBc";
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
    v.post = -1;
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
  const lock = sim.warLock();
  if (lock) return lock;
  const b = sim.building(STAFF_BUILDING[job]);
  if (!b) return `Ch\u01B0a c\xF3 ${BUILDINGS[STAFF_BUILDING[job]].name}, ho\u1EB7c ch\u01B0a x\xE2y xong`;
  let err = null;
  for (const v of sim.mine(ids)) {
    if (v.inside === b.id) {
      v.job = job;
      continue;
    }
    if (v.job === "fight") {
      err = "Chi\u1EBFn binh do tr\u1EA1i l\xEDnh c\u1EE7a h\u1ECD qu\u1EA3n l\xFD: cho ngh\u1EC9 tr\u01B0\u1EDBc";
      continue;
    }
    if (v.job === "scout") {
      err = "Trinh s\xE1t do Tr\u1EA1i trinh s\xE1t qu\u1EA3n l\xFD: cho ngh\u1EC9 tr\u01B0\u1EDBc";
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
    v.post = -1;
    planStaff(sim, v);
  }
  return err;
}
function assignField(sim, ids, fieldId) {
  const lock = sim.warLock();
  if (lock) return lock;
  const b = sim.getBuilding(fieldId);
  if (!b || b.kind !== "field" || !b.done) return "Ru\u1ED9ng ch\u01B0a d\u1EF1ng xong";
  let err = null;
  for (const v of sim.mine(ids)) {
    if (v.post === b.id && v.job === "food") continue;
    if (v.job === "fight") {
      err = "Chi\u1EBFn binh do tr\u1EA1i l\xEDnh c\u1EE7a h\u1ECD qu\u1EA3n l\xFD: cho ngh\u1EC9 tr\u01B0\u1EDBc";
      continue;
    }
    if (v.job === "scout") {
      err = "Trinh s\xE1t do Tr\u1EA1i trinh s\xE1t qu\u1EA3n l\xFD: cho ngh\u1EC9 tr\u01B0\u1EDBc";
      continue;
    }
    if (staffCount(sim, b) >= levelDef(b).slots) {
      err = `${BUILDINGS.field.name} c\u1EA5p ${b.level} ch\u1EC9 ch\u1EE9a ${levelDef(b).slots} ng\u01B0\u1EDDi`;
      continue;
    }
    sim.resetTask(v);
    sim.clearCombat(v);
    v.job = "food";
    v.prefer = -1;
    v.post = b.id;
    planStaff(sim, v);
  }
  return err;
}
function postOf(sim, v) {
  if (isStaffJob(v.job)) return sim.building(STAFF_BUILDING[v.job]);
  const b = (v.job === "food" || v.job === "fight") && v.post >= 0 ? sim.getBuilding(v.post) : void 0;
  return b && (v.job === "food" ? b.kind === "field" : b.kind === "tower") ? b : void 0;
}
function planStaff(sim, v) {
  if (!isStaffJob(v.job) && !((v.job === "food" || v.job === "fight") && v.post >= 0)) return;
  const b = postOf(sim, v);
  if (!b) {
    if (v.job === "food" || v.job === "fight") v.post = -1;
    else v.job = "idle";
    return;
  }
  if (staffCount(sim, b) >= levelDef(b).slots) {
    if (v.job !== "fight") v.job = "idle";
    v.post = -1;
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
  if (!b || !b.done || postOf(sim, v)?.id !== b.id || b.staff.length >= levelDef(b).slots) {
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
  if (sim.warLock()) return;
  for (const v of sim.mine(ids)) if (v.inside !== null) {
    exitBuilding(sim, v);
    v.job = "idle";
    v.post = -1;
    sim.fogDirty = true;
  }
}

// src/sim/inventory.ts
function toolCount(sim, kind, tier) {
  const id = `${kind}${tier}`;
  return (sim.toolStock[id] ?? 0) + sim.wornTools.filter((w) => w.id === id && w.dur > 0).length;
}
function toolTier(sim, v, job) {
  const k = job === "idle" || job === "scout" ? void 0 : TOOL_OF_JOB[job];
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
var gearName = (slot, id) => (slot === "armor" ? ARMORS[id]?.name : WEAPONS[id]?.name)?.toLowerCase() ?? id;
var gearId = (slot, id) => slot === "armor" ? "hide1" : `${id}${WEAPONS[id]?.tier ?? 1}`;
function wearGear(sim, v, slot) {
  if (v.team !== "player") return;
  const id = slot === "weapon" ? v.weapon : v.armor, g = v.gear;
  if (!id) return;
  const max = (slot === "weapon" ? WEAPONS[id]?.durability : ARMORS[id]?.durability) ?? 0;
  if (!max) return;
  if (slot === "weapon") {
    if (g.w !== id) {
      g.w = id;
      g.wd = max;
      g.wb = false;
    }
    if (g.wb || --g.wd > 0) return;
  } else {
    if (g.a !== id) {
      g.a = id;
      g.ad = max;
      g.ab = false;
    }
    if (g.ab || --g.ad > 0) return;
  }
  if (sim.frnd() < 0.5) {
    if (slot === "weapon") {
      v.weapon = null;
      g.w = null;
      g.wb = false;
    } else {
      v.armor = null;
      g.a = null;
      g.ab = false;
    }
    v.manualGear = false;
    sim.say(`${v.name} l\xE0m v\u1EE1 ${gearName(slot, id)}, m\u1EA5t h\u1EB3n.`);
  } else {
    if (slot === "weapon") g.wb = true;
    else g.ab = true;
    sim.say(`${gearName(slot, id)} c\u1EE7a ${v.name} \u0111\xE3 h\u1ECFng, c\u1EA7n mang \u0111i s\u1EEDa.`);
  }
}
function planGearRepair(sim, v) {
  if (v.job !== "fight" && v.job !== "hunt" || v.phase === "fight" || v.orderCd > 0 || v.team !== "player") return false;
  const house = sim.building("repair");
  if (!house || sim.repairQueue.length >= 12 || !(v.gear.wb && v.gear.w === v.weapon) && !(v.gear.ab && v.gear.a === v.armor)) return false;
  v.orderCd = 30;
  v.order = "repair:gear";
  if (goTo(sim, v, house, "goOrder")) return true;
  v.order = null;
  return false;
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
  } else if (what === "repair" && id === "gear") {
    for (const slot of ["weapon", "armor"]) {
      const piece = slot === "weapon" ? v.weapon : v.armor, broken = slot === "weapon" ? v.gear.wb && v.gear.w === v.weapon : v.gear.ab && v.gear.a === v.armor;
      if (!piece || !broken || v.repairFor) continue;
      if (sim.queueRepair(gearId(slot, piece)) === null) {
        v.repairFor = gearId(slot, piece);
        if (slot === "weapon") {
          v.weapon = null;
          v.gear.w = null;
          v.gear.wb = false;
        } else {
          v.armor = null;
          v.gear.a = null;
          v.gear.ab = false;
        }
        sim.say(`${v.name} nh\u1EDD s\u1EEDa ${gearName(slot, piece)}.`);
      }
    }
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
  v.breaks = null;
}
function keepWatch(sim, v) {
  if (v.job !== "idle") sim.callUp(v);
}
function clearCombat(sim, v) {
  v.fight.target = null;
  v.fight.mode = "none";
  v.fight.dest = null;
  v.fight.anchor = null;
  v.fight.strict = false;
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
  if (v.job !== "fight" && v.job !== "hunt" && v.job !== "scout") v.job = "idle";
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
    if (v.job === "fight") {
      v.fight.mode = "guard";
      v.fight.anchor = { x: goal[0] + 0.5, y: goal[1] + 0.5 };
    }
    if (v.job === "fight" && sim.pathLeft <= 0) {
      v.phase = "idle";
      continue;
    }
    if (v.job === "fight") sim.pathLeft--;
    v.path = sim.pathTo(v, goal[0], goal[1], 3e4);
    v.phase = v.path.length ? "move" : "idle";
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
  const lock = sim.warLock();
  if (lock) return lock;
  if (job === "fight") return enlist(sim, ids) > 0 ? null : "Ch\u1ECDn d\xE2n th\u01B0\u1EDDng \u0111\u1EC3 tuy\u1EC3n l\xE0m chi\u1EBFn binh";
  if (job === "scout") return sim.enlistScouts(ids);
  const soldiers = mine(sim, ids).filter((v) => v.job === "fight"), scouts = mine(sim, ids).filter((v) => v.job === "scout");
  const rest = ids.filter((id) => !soldiers.some((s) => s.id === id) && !scouts.some((s) => s.id === id));
  const err = jobFor(sim, rest, job);
  return err ?? (soldiers.length ? "Chi\u1EBFn binh do tr\u1EA1i l\xEDnh c\u1EE7a h\u1ECD qu\u1EA3n l\xFD: cho h\u1ECD ngh\u1EC9 \u1EDF \u0111\xF3 tr\u01B0\u1EDBc" : scouts.length ? "Trinh s\xE1t do Tr\u1EA1i trinh s\xE1t qu\u1EA3n l\xFD: cho h\u1ECD ngh\u1EC9 \u1EDF \u0111\xF3 tr\u01B0\u1EDBc" : null);
}
function jobFor(sim, ids, job) {
  if (job === "craft" || job === "research" || job === "repair") return sim.assignStaff(ids, job);
  if (job === "build") return sim.assignCrew(ids);
  for (const v of mine(sim, ids)) {
    resetTask(sim, v);
    clearCombat(sim, v);
    v.job = job;
    v.prefer = -1;
    v.post = -1;
    keepWatch(sim, v);
  }
  return null;
}
function enlist(sim, ids) {
  let n = 0;
  for (const v of mine(sim, ids)) {
    if (v.job === "fight" || v.job === "scout") continue;
    resetTask(sim, v);
    clearCombat(sim, v);
    v.job = "fight";
    v.prefer = -1;
    v.post = -1;
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
    v.post = -1;
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
function workFactor(sim, v, job, field = false) {
  const stat = v.stats[JOBS[job].stat];
  const season = job === "food" ? SEASON_DEF[sim.season][field ? "farm" : "gather"] : 1;
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
          b.hp = maxHp(b);
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
function tickFarms(sim, dt) {
  for (const b of sim.buildings) {
    if (b.kind !== "field" || !b.done) continue;
    for (const id of b.staff) {
      const v = sim.byId.get(id);
      if (!v || v.phase !== "inside" || v.job !== "food" || sim.stock.food >= sim.capacity("food")) continue;
      v.progress += dt * workFactor(sim, v, "food", true) * levelDef(b).craftSpeed / FARM_TIME;
      gainXp(sim, v, "food", dt);
      wear(sim, v, "food", dt);
      if (v.progress < 1) continue;
      v.progress -= 1;
      const acc = v.frac + TIER_YIELD[sim.toolTier(v, "food")], whole = Math.floor(acc);
      v.frac = acc - whole;
      sim.stock.food = Math.min(sim.capacity("food"), sim.stock.food + whole);
    }
  }
}
function plan(sim, v) {
  if (v.job === "hunt" || v.job === "fight" || v.job === "scout") {
    wait(sim, v, 1);
    return;
  }
  if (v.job === "build") {
    if (!sim.planTool(v, "build")) planBuild(sim, v);
    return;
  }
  if (isStaffJob(v.job) || v.job === "food" && v.post >= 0) {
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
    arm: "foot",
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
    post: -1,
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
    squad: -1,
    breaks: null,
    gear: { w: null, wd: 0, wb: false, a: null, ad: 0, ab: false },
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
    const onWatch = v.job === "fight" && v.post >= 0 && sim.tribes.some((t) => t.raid);
    if (sim.shouldSleep(v, onWatch)) {
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
function sightOf(sim, v) {
  const r = visionRadius(sim);
  return (v.torch || v.lit ? Math.max(r, TORCH_VISION) : r) + (armOf(v) === "archer" ? ARCHER_SIGHT : 0);
}
var ARCHER_SIGHT = 1;
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
var SAVE_VERSION = 12;
var SAVED = {
  /** Single values. */
  scalars: ["era", "time", "acc", "coinFrac", "sawCoin", "nextRaid", "nextAid", "nextVid", "nextBid", "nextSquad", "nextMission", "nextPlan", "alarmUntil", "moraleClock", "tribeClock", "lastFullWarn", "lastMatWarn", "weather", "nextWeather", "lastDay", "signalled", "resting", "lastVision", "pendingTribe", "fogDirty"],
  /** Objects whose keys are filled in place. */
  records: ["stock", "toolStock", "battle"],
  /** Lists of plain data. */
  lists: ["wornTools", "craftQueue", "researchQueue", "repairQueue", "log", "foodLots", "villagers", "buildings", "foes", "events", "animals", "projectiles", "squads", "maps", "scouts", "sightings", "plans", "battleReports"],
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
  },
  // 2 -> 3: a gatherer can be posted to a Ruộng
  2: (d) => {
    for (const list of [d.lists.villagers, d.lists.foes]) for (const v of list) v.post ??= -1;
    return { ...d, version: 3 };
  },
  // 3 -> 4: buildings gained strength (defence works) and an open/shut state (gates)
  3: (d) => {
    for (const b of d.lists.buildings) {
      b.hp ??= 0;
      b.open ??= true;
    }
    return { ...d, version: 4 };
  },
  // 4 -> 5: weapons and armour wear out
  4: (d) => {
    for (const list of [d.lists.villagers, d.lists.foes]) for (const v of list) {
      v.gear ??= { w: null, wd: 0, wb: false, a: null, ad: 0, ab: false };
      v.squad ??= -1;
    }
    for (const k of ["squads", "maps", "scouts", "plans", "battleReports"]) d.lists[k] ??= [];
    d.scalars.nextSquad ??= 1;
    d.scalars.nextMission ??= 1;
    d.scalars.nextPlan ??= 1;
    d.scalars.alarmUntil ??= 0;
    d.records.battle ??= { on: false, since: 0, quiet: 0, ourDead: 0, foeDead: 0, breaches: 0, shots: 0, notes: [] };
    return { ...d, version: 5 };
  },
  // 5 -> 6: a mission carries the row, the arrow and the way back drawn on the enemy map (older missions go for their objective)
  5: (d) => {
    for (const p of d.lists.plans) for (const m of p.missions) {
      m.line ??= null;
      m.path ??= [];
      m.retreat ??= [];
      m.leg ??= 0;
    }
    return { ...d, version: 6 };
  },
  // 6 -> 7: a squad is placed on the enemy map by a point and a heading, not by a row between two points
  6: (d) => {
    for (const p of d.lists.plans) for (const m of p.missions) {
      const l = m.line;
      m.deploy ??= l ? { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2, heading: Math.atan2(l.b.y - l.a.y, l.b.x - l.a.x) - Math.PI / 2 } : null;
      delete m.line;
    }
    return { ...d, version: 7 };
  },
  // 7 -> 8: a squad is placed as the cells drawn for it, not by a point and a heading (a squad placed the old way is simply not placed)
  7: (d) => {
    for (const p of d.lists.plans) for (const m of p.missions) {
      const dep = m.deploy;
      if (!dep || !Array.isArray(dep.cells)) m.deploy = null;
    }
    return { ...d, version: 8 };
  },
  // 8 -> 9: villages are found before they are scouted; a village we already hold a map of counts as found
  8: (d) => {
    const maps = d.lists.maps;
    d.lists.sightings ??= [...new Set(maps.map((m) => m.tribe))].map((tribe) => ({ tribe, by: -1, at: 0, reported: true }));
    return { ...d, version: 9 };
  },
  // 9 -> 10: roles belong to their houses. The Lều chiến binh becomes the Trại chiến binh; a soldier's arm is kept on him (a thrower if he carried a sling or a bow)
  9: (d) => {
    for (const b of d.lists.buildings) if (b.kind === "barracks") b.kind = "infantry";
    for (const list of [d.lists.villagers, d.lists.foes]) for (const v of list) v.arm ??= v.job === "fight" && (v.weapon === "sling" || v.weapon === "bow") ? "archer" : "foot";
    return { ...d, version: 10 };
  },
  // 10 -> 11: a running attack is in one stage of its deployment (one that was already running is simply fighting)
  10: (d) => {
    for (const p of d.lists.plans) p.stage ??= "fight";
    return { ...d, version: 11 };
  },
  // 11 -> 12: every house has strength and can be attacked; the works of an enemy village have strength too; a plan keeps its clearing crews and how it ended,
  // an arrow may point at a target and a squad may be halted by something in its way; a soldier may be hacking something down
  11: (d) => {
    for (const b of d.lists.buildings) b.hp ||= maxHp(b);
    for (const p of d.lists.plans) {
      p.clears ??= [];
      p.result ??= "";
      for (const m of p.missions) {
        m.target ??= null;
        m.block ??= null;
      }
    }
    for (const list of [d.lists.villagers, d.lists.foes]) for (const v of list) v.breaks ??= null;
    for (const t of d.tribes) for (const p of t.props) p.hp ??= SIEGE.propHp[p.kind] ?? 60;
    return { ...d, version: 12 };
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
  sleepAt: { campfire: 0.6, house: 1, infantry: 1.6, cavalry: 1.6, archery: 1.6 },
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
var BED_KINDS = ["infantry", "cavalry", "archery", "house"];
var bedKind = (v) => v.job !== "fight" ? "house" : v.arm === "archer" ? "archery" : v.arm === "cavalry" ? "cavalry" : "infantry";
function bedsTaken(sim, b, except) {
  return sim.villagers.filter((o) => o !== except && (o.phase === "sleep" && o.inside === b.id || o.phase === "goHome" && o.target === b.id)).length;
}
function freeBed(sim, v) {
  const kind = bedKind(v);
  let best, bd = Infinity;
  for (const b of sim.buildings) {
    if (b.kind !== kind || !b.done || bedsTaken(sim, b, v) >= levelDef(b).slots) continue;
    const d = Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
function bedFactor(sim, v) {
  const b = v.inside === null ? void 0 : sim.getBuilding(v.inside);
  return b && BED_KINDS.includes(b.kind) ? REST.sleepAt[b.kind] * levelDef(b).craftSpeed : REST.sleepAt.campfire;
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
  if (v.job === "fight" && sim.warLock()) return true;
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
  } else if (!sim.dev.noTire && !(v.job === "fight" && sim.warLock())) {
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
  if (v.job === "fight" && sim.warLock()) {
    v.lockUntil = 0;
    return false;
  }
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
  return sim.buildings.reduce((n, b) => n + (b.kind === kind && b.done ? levelDef(b).slots : 0), 0);
}

// src/sim/roles.ts
var warLock = (sim) => sim.plans.some((p) => p.kind === "attack" && p.status === "running") ? "\u0110ang trong ch\u1EBF \u0111\u1ED9 chi\u1EBFn \u0111\u1EA5u: kh\xF4ng \u0111\u1ED5i vai tr\xF2 hay b\u1ECF l\xEDnh \u0111\u01B0\u1EE3c cho t\u1EDBi khi tr\u1EADn k\u1EBFt th\xFAc" : null;
var roleHouses = (sim, role) => sim.buildings.filter((b) => b.kind === ROLES[role].building && b.done);
var roleCapacity = (sim, role) => sim.dev.freeBuild ? 99 : roleHouses(sim, role).reduce((n, b) => n + levelDef(b).slots, 0);
var roleCount = (sim, role) => sim.villagers.filter((v) => roleOf(v) === role).length;
function assignRole(sim, ids, role) {
  const lock = warLock(sim);
  if (lock) return lock;
  const def = ROLES[role], name = buildingName(def.building, sim.era);
  if (!sim.dev.freeBuild && !roleHouses(sim, role).length) return `C\u1EA7n d\u1EF1ng ${name}`;
  const pick = sim.mine(ids).filter((v) => v.job !== "fight" && v.job !== "scout" && roleOf(v) !== role);
  if (!pick.length) return `Ch\u1ECDn d\xE2n th\u01B0\u1EDDng \u0111\u1EC3 giao vi\u1EC7c ${roleName(role, sim.era).toLowerCase()}`;
  const room = roleCapacity(sim, role) - roleCount(sim, role);
  if (room <= 0) return `${name} \u0111\xE3 \u0111\u1EE7 ${roleCapacity(sim, role)} ng\u01B0\u1EDDi: n\xE2ng c\u1EA5p \u0111\u1EC3 ch\u1EE9a th\xEAm`;
  const take = pick.slice(0, room).map((v) => v.id);
  if (role === "scout") return sim.enlistScouts(take);
  const err = sim.setJob(take, def.job === "fight" ? "fight" : def.job);
  if (def.arm) {
    for (const v of sim.mine(take)) if (v.job === "fight") v.arm = def.arm;
  }
  return err ?? (pick.length > room ? `${name} ch\u1EC9 c\xF2n ch\u1ED7 cho ${room} ng\u01B0\u1EDDi` : null);
}
function releaseRole(sim, ids) {
  const lock = warLock(sim);
  if (lock) return lock;
  const mine2 = sim.mine(ids);
  let n = 0, err = null;
  for (const v of mine2) {
    const role = roleOf(v);
    if (!role) continue;
    const e = role === "scout" ? sim.dismissScouts([v.id]) : ROLES[role].job === "fight" ? sim.discharge([v.id]) ? null : `${v.name} \u0111ang ng\u1EE7 say, ch\u01B0a cho ngh\u1EC9 \u0111\u01B0\u1EE3c` : sim.setJob([v.id], "idle");
    if (e) err = e;
    else n++;
  }
  return n ? null : err ?? "Ch\u1ECDn ng\u01B0\u1EDDi c\xF3 vi\u1EC7c \u0111\u1EC3 cho ngh\u1EC9";
}
function trimRoles(sim) {
  for (const role of Object.keys(ROLES)) {
    const over = roleCount(sim, role) - roleCapacity(sim, role);
    if (over <= 0) continue;
    const who = sim.villagers.filter((v) => roleOf(v) === role).sort((a, b) => b.id - a.id).slice(0, over);
    releaseRole(sim, who.map((v) => v.id));
  }
}

// src/sim/defense.ts
var isWall = (b) => b.kind === "fence" || b.kind === "gate";
var isDefense = (b) => isWall(b) || b.kind === "tower";
function toggleGate(sim, id) {
  const b = sim.getBuilding(id);
  if (!b || b.kind !== "gate") return "\u0110\xE2y kh\xF4ng ph\u1EA3i c\u1ED5ng";
  if (!b.done) return "C\u1ED5ng ch\u01B0a d\u1EF1ng xong";
  b.open = !b.open;
  sim.setOcc(b, 1);
  sim.say(b.open ? "C\u1ED5ng \u0111\xE3 m\u1EDF." : "C\u1ED5ng \u0111\xE3 \u0111\xF3ng.");
  return null;
}
function setGates(sim, open) {
  for (const b of sim.buildings) if (b.kind === "gate" && b.done && b.open !== open) {
    b.open = open;
    sim.setOcc(b, 1);
  }
}
function nearestWork(sim, x, y, radius, any = false) {
  let best, bd = radius;
  for (const b of sim.buildings) {
    if (!b.done || !(any ? b.kind !== "campfire" && b.kind !== "trap" : isDefense(b))) continue;
    const d = BUILDINGS[b.kind], dist = Math.hypot(b.x + d.w / 2 - x, b.y + d.h / 2 - y);
    if (dist <= bd) {
      bd = dist;
      best = b;
    }
  }
  return best;
}
function damageWork(sim, b, dmg) {
  b.hp -= dmg;
  if (b.hp > 0) return;
  sim.say(`${BUILDINGS[b.kind].name} b\u1ECB ph\xE1!`);
  sim.noteBattle("breach");
  sim.destroyBuilding(b);
}
function towerBonus(sim, v) {
  const b = v.inside === null ? void 0 : sim.getBuilding(v.inside);
  if (!b || b.kind !== "tower" || armOfWeapon(effWeapon(v)) !== "archer") return { damage: 1, range: 0 };
  return { damage: UNIT_RULES.archerOnTower.damage, range: UNIT_RULES.archerOnTower.range };
}
function garrison(sim, b) {
  return sim.villagers.filter((v) => v.post === b.id && v.job === "fight");
}
function assignTower(sim, ids, towerId) {
  const b = sim.getBuilding(towerId);
  if (!b || b.kind !== "tower" || !b.done) return "Ch\xF2i canh ch\u01B0a d\u1EF1ng xong";
  let err = null;
  for (const v of sim.mine(ids)) {
    if (v.post === b.id && v.job === "fight") continue;
    if (v.job !== "fight") {
      err = "Ch\u1EC9 chi\u1EBFn binh m\u1EDBi l\xEAn ch\xF2i: tuy\u1EC3n \u1EDF tr\u1EA1i l\xEDnh";
      continue;
    }
    if (armOfWeapon(effWeapon(v)) !== "archer") {
      err = "Ch\u1EC9 cung th\u1EE7 (c\u1EA7m cung ho\u1EB7c d\xE2y qu\u0103ng) m\u1EDBi l\xEAn ch\xF2i";
      continue;
    }
    if (garrison(sim, b).length >= levelDef(b).slots) {
      err = `${BUILDINGS.tower.name} c\u1EA5p ${b.level} ch\u1EC9 ch\u1EE9a ${levelDef(b).slots} cung th\u1EE7`;
      continue;
    }
    sim.resetTask(v);
    sim.clearCombat(v);
    v.post = b.id;
    v.fight.mode = "none";
    v.fight.anchor = null;
    sim.planStaff(v);
  }
  return err;
}
function leaveTower(sim, ids) {
  for (const v of sim.mine(ids)) if (v.post >= 0 && v.job === "fight") {
    sim.exitBuilding(v);
    v.post = -1;
    v.phase = "idle";
  }
}
function tickTraps(sim, _dt) {
  for (const b of [...sim.buildings]) {
    if (b.kind !== "trap" || !b.done) continue;
    for (const f of sim.foes) {
      if (f.health <= 0 || b.staff.includes(f.id) || Math.hypot(f.x - (b.x + 0.5), f.y - (b.y + 0.5)) > 0.8) continue;
      b.staff.push(f.id);
      hurt(sim, { kind: "unit", id: f.id }, 14 * b.level, "pierce", { x: b.x, y: b.y }, {});
      sim.noteBattle("note", "M\u1ED9t h\u1ED1 ch\xF4ng \u0111\xE3 l\xE0m \u0111\u1ECBch b\u1ECB th\u01B0\u01A1ng.");
      if (--b.hp <= 0) {
        b.staff = [];
        sim.destroyBuilding(b);
        break;
      }
    }
  }
}
function tickTowers(sim, _dt) {
  for (const b of sim.buildings) {
    if (b.kind !== "tower" || !b.done) continue;
    const d = BUILDINGS.tower, from = { x: b.x + d.w / 2, y: b.y + 0.4 };
    for (const v of sim.villagers) {
      if (v.inside !== b.id || v.phase !== "inside" || v.atkCd > 0 || v.health <= 0) continue;
      const w = weaponOf(v);
      if (!w.ranged) continue;
      const bonus = towerBonus(sim, v), threat = threatsOf(sim, v, w.range + bonus.range + 1)[0], e = threat && resolve(sim, threat.t);
      if (e && fireProjectile(sim, v, e, from, bonus.damage, bonus.range)) v.atkCd = cycleOf(w.cycle, v.stats.agi);
    }
  }
}

// src/sim/army.ts
var COLORS = ["#e0523c", "#3c8ce0", "#e0b43c", "#5cb85c", "#a85cd8", "#3cd0c8"];
function squadLimit(sim) {
  const tent = sim.building("wartent");
  if (tent) return COMMAND.squadLimit[Math.min(COMMAND.squadLimit.length, tent.level) - 1];
  return sim.dev.freeBuild ? COMMAND.squadLimit[COMMAND.squadLimit.length - 1] : 0;
}
function cardLimit(sim) {
  const tent = sim.building("wartent"), level = tent ? tent.level : sim.dev.freeBuild ? 3 : 0;
  return level ? COMMAND.cardBase + COMMAND.cardPerLevel * level + (!RESEARCH.enabled || sim.researched.has("signal") ? 2 : 0) : 0;
}
var squadById = (sim, id) => sim.squads.find((s) => s.id === id);
var squadOf = (sim, v) => v.squad >= 0 ? squadById(sim, v.squad) : void 0;
function squadUnits(sim, s) {
  const out = [];
  for (const id of s.ids) {
    const v = sim.byId.get(id);
    if (v && v.team === "player" && v.job === "fight" && v.health > 0 && v.squad === s.id) out.push(v);
  }
  if (out.length !== s.ids.length) s.ids = out.map((v) => v.id);
  if (!out.some((v) => v.id === s.leader)) s.leader = out.length ? out.slice().sort((a, b) => b.stats.str + b.stats.vit - a.stats.str - a.stats.vit)[0].id : -1;
  return out;
}
function squadCenter(sim, s) {
  const us = squadUnits(sim, s);
  return us.length ? { x: us.reduce((a, v) => a + v.x, 0) / us.length, y: us.reduce((a, v) => a + v.y, 0) / us.length } : null;
}
function createSquad(sim, name) {
  if (sim.squads.length >= squadLimit(sim)) return { reason: squadLimit(sim) ? `L\u1EC1u h\u1ECDp chi\u1EBFn ch\u1EC9 cho ${squadLimit(sim)} \u0111\u1ED9i: n\xE2ng c\u1EA5p l\u1EC1u` : "C\u1EA7n d\u1EF1ng L\u1EC1u h\u1ECDp chi\u1EBFn \u0111\u1EC3 l\u1EADp \u0111\u1ED9i" };
  const id = sim.nextSquad++;
  const s = { id, name: name ?? `\u0110\u1ED9i ${String.fromCharCode(64 + id)}`, color: COLORS[(id - 1) % COLORS.length], ids: [], leader: -1, formation: "line", mastery: Object.fromEntries(FORMATION_IDS.map((f) => [f, COMMAND.mastery.start])), switchUntil: 0, anchor: null, heading: 0, training: false };
  sim.squads.push(s);
  return { squad: s };
}
function joinSquad(sim, ids, squadId) {
  const lock = sim.warLock();
  if (lock) return lock;
  const s = squadById(sim, squadId);
  if (!s) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  let err = null;
  for (const v of sim.mine(ids)) {
    if (v.job !== "fight") {
      err = "Ch\u1EC9 chi\u1EBFn binh m\u1EDBi v\xE0o \u0111\u1ED9i: tuy\u1EC3n \u1EDF tr\u1EA1i l\xEDnh";
      continue;
    }
    if (v.squad === s.id) continue;
    if (s.ids.length >= SQUAD_MAX) {
      err = `M\u1ED9t \u0111\u1ED9i ch\u1EC9 c\xF3 t\u1ED1i \u0111a ${SQUAD_MAX} ng\u01B0\u1EDDi`;
      continue;
    }
    leaveSquad(sim, [v.id]);
    v.squad = s.id;
    s.ids.push(v.id);
  }
  return err;
}
function leaveSquad(sim, ids) {
  if (sim.warLock()) return;
  for (const v of sim.mine(ids)) {
    const s = squadOf(sim, v);
    if (s) {
      s.ids = s.ids.filter((i) => i !== v.id);
      if (s.leader === v.id) s.leader = -1;
    }
    v.squad = -1;
    v.speed = 1.6 + 0.1 * v.stats.agi;
  }
}
function disbandSquad(sim, id) {
  if (sim.warLock()) return;
  const s = squadById(sim, id);
  if (!s) return;
  leaveSquad(sim, [...s.ids]);
  sim.squads.splice(sim.squads.indexOf(s), 1);
  for (const p of sim.plans) {
    p.missions = p.missions.filter((m) => m.squad !== id);
    p.cards = p.cards.filter((c) => c.squad !== id);
  }
}
function setCommander(sim, squadId, vid) {
  if (sim.warLock()) return;
  const s = squadById(sim, squadId);
  if (s && s.ids.includes(vid)) s.leader = vid;
}
var formationOpen = (sim, f) => !RESEARCH.enabled || sim.dev.freeBuild || sim.researched.has(FORMATIONS[f].tech);
function applySpeed(sim, s) {
  for (const v of squadUnits(sim, s)) v.speed = (1.6 + 0.1 * v.stats.agi) * FORMATIONS[s.formation].speed;
}
function setFormation(sim, squadId, f) {
  const s = squadById(sim, squadId);
  if (!s) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (!FORMATIONS[f]) return "Kh\xF4ng c\xF3 tr\u1EADn n\xE0y";
  if (!formationOpen(sim, f)) return `C\u1EA7n nghi\xEAn c\u1EE9u: ${f === "line" || f === "circle" ? "Tr\u1EADn ph\xE1p c\u01A1 b\u1EA3n" : FORMATIONS[f].name}`;
  if (s.formation === f) return null;
  s.formation = f;
  s.switchUntil = sim.time + COMMAND.mastery.switchSeconds;
  applySpeed(sim, s);
  if (s.anchor) squadMove(sim, s, s.anchor.x, s.anchor.y, "hold");
  return null;
}
function squadMove(sim, s, x, y, mode, heading) {
  const us = squadUnits(sim, s);
  if (!us.length) return;
  const c = squadCenter(sim, s);
  s.heading = heading ?? (Math.hypot(x - c.x, y - c.y) > 1 ? Math.atan2(y - c.y, x - c.x) : s.heading);
  s.anchor = { x, y };
  us.sort((a, b) => (armOf(a) === "archer" ? 1 : 0) - (armOf(b) === "archer" ? 1 : 0) || a.id - b.id);
  const offs = formationOffsets(s.formation, us.length), taken = /* @__PURE__ */ new Set();
  applySpeed(sim, s);
  us.forEach((v, i) => {
    const [px, py] = placeOffset(offs[i], s.heading, x, y);
    const spot = sim.nearestFree(Math.floor(px), Math.floor(py), taken) ?? [Math.floor(px), Math.floor(py)];
    taken.add(spot[1] * sim.world.size + spot[0]);
    if (mode === "move") sim.orderMove([v.id], spot[0], spot[1]);
    else if (mode === "attack") sim.orderAttackMove([v.id], spot[0] + 0.5, spot[1] + 0.5);
    else {
      sim.orderAttackMove([v.id], spot[0] + 0.5, spot[1] + 0.5);
      v.fight.anchor = { x: spot[0] + 0.5, y: spot[1] + 0.5 };
    }
  });
}
function trainSquad(sim, squadId, on) {
  const s = squadById(sim, squadId);
  if (!s) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (!on) {
    s.training = false;
    return null;
  }
  const field = sim.building("drill");
  if (!field) return "C\u1EA7n d\u1EF1ng B\xE3i t\u1EADp";
  s.training = true;
  squadMove(sim, s, field.x + 1.5, field.y + 1.5, "hold");
  return null;
}
function tickTraining(sim, dt) {
  const field = sim.building("drill");
  for (const s of sim.squads) {
    const us = squadUnits(sim, s);
    const near2 = field && us.length ? us.filter((v) => Math.hypot(v.x - (field.x + 1.5), v.y - (field.y + 1.5)) < 7).length >= Math.ceil(us.length / 2) : false;
    for (const f of FORMATION_IDS) {
      if (f === s.formation && s.training && near2) s.mastery[f] = Math.min(100, s.mastery[f] + COMMAND.mastery.perSecond * dt);
      else s.mastery[f] = Math.max(0, s.mastery[f] - COMMAND.mastery.decayPerDay * dt / DAY_LENGTH);
    }
    if (s.training && !field) s.training = false;
  }
}
function attackFactor(sim, v, e) {
  if (v.team !== "player") return 1;
  let f = 1;
  const s = squadOf(sim, v);
  if (s) {
    const fm = FORMATIONS[s.formation];
    f *= fm.dmg * masteryFactor(s.mastery[s.formation]);
    if (fm.charge && v.path.length > 0) f *= fm.charge;
    if (fm.flank && e.kind === "unit" && (e.v.facing === "right" && v.x < e.v.x || e.v.facing === "left" && v.x > e.v.x)) f *= fm.flank;
    if (fm.firstBlow && e.kind === "unit" && !e.v.fight.target && e.v.phase !== "fight") f *= fm.firstBlow;
  }
  if (e.kind === "unit" && e.v.team !== "player") f *= COMMAND.info[Math.min(3, sim.mapLevel(e.v.team))];
  return f;
}
function takenFactor(sim, victim, ranged) {
  const s = squadOf(sim, victim);
  if (!s) return 1;
  const fm = FORMATIONS[s.formation];
  return fm.taken * (ranged ? fm.takenRanged ?? 1 : 1) * (s.switchUntil > sim.time ? COMMAND.mastery.switchTaken : 1);
}
function clusters(sim) {
  const units = [...sim.villagers.filter((v) => v.job === "fight" && v.health > 0 && v.inside === null), ...sim.foes.filter((f) => f.health > 0 && f.ai && f.ai.role !== "civ")];
  const key = (v) => v.team === "player" ? `p:${v.squad}` : `f:${v.team}`;
  const out = [];
  const by = new Map(units.map((v) => [v.id, v]));
  for (const c of clusterize(units.map((v) => ({ id: v.id, arm: armOf(v), key: key(v) })))) {
    const vs = c.ids.map((id) => by.get(id));
    const sq = c.key.startsWith("p:") ? Number(c.key.slice(2)) : -1, squad = sq >= 0 ? squadById(sim, sq) : void 0;
    out.push({
      id: `${c.key}|${c.arm}|${c.ids[0]}`,
      side: vs[0].team,
      squad: sq,
      color: squad?.color ?? (vs[0].team === "player" ? "#9aa4b0" : "#c04040"),
      arm: c.arm,
      ids: c.ids,
      x: vs.reduce((a, v) => a + v.x, 0) / vs.length,
      y: vs.reduce((a, v) => a + v.y, 0) / vs.length,
      hp: vs.reduce((a, v) => a + Math.max(0, v.health) / v.maxHealth, 0) / vs.length,
      n: vs.length
    });
  }
  return out;
}
function drawnFigures(sim) {
  const cs = clusters(sim), ours = cs.filter((c) => c.side === "player").reduce((n, c) => n + c.n, 0), theirs = cs.filter((c) => c.side !== "player").reduce((n, c) => n + c.n, 0);
  if (Math.max(ours, theirs) <= COMMAND.bigBattle) return null;
  const shown = /* @__PURE__ */ new Set();
  for (const c of cs) for (const id of c.ids.slice(0, iconCount(c.n))) shown.add(id);
  return shown;
}
function noteBattle(sim, kind, text = "") {
  const b = sim.battle;
  if (!b.on) return;
  if (kind === "ours") b.ourDead++;
  else if (kind === "foes") b.foeDead++;
  else if (kind === "breach") b.breaches++;
  else if (kind === "shot") b.shots++;
  else if (text && b.notes.length < 12) b.notes.push(text);
}
function tickBattle(sim, dt) {
  const b = sim.battle, hostile = sim.foes.some((f) => f.ai?.role === "raider" && f.health > 0);
  if (hostile && !b.on) {
    Object.assign(b, { on: true, since: sim.time, quiet: 0, ourDead: 0, foeDead: 0, breaches: 0, shots: 0, notes: [] });
    return;
  }
  if (!b.on) return;
  b.quiet = hostile ? 0 : b.quiet + dt;
  if (b.quiet < 10) return;
  b.on = false;
  sim.alarmUntil = 0;
  const lines = [`Tr\u1EADn k\xE9o d\xE0i ${Math.max(1, Math.round((sim.time - b.since) / 60))} ph\xFAt: ta m\u1EA5t ${b.ourDead}, \u0111\u1ECBch m\u1EA5t ${b.foeDead}.`];
  if (b.breaches) lines.push(`${b.breaches} \u0111o\u1EA1n h\xE0ng r\xE0o ho\u1EB7c c\u1ED5ng b\u1ECB ph\xE1.`);
  if (b.shots) lines.push(`Cung th\u1EE7 tr\xEAn ch\xF2i b\u1EAFn ${b.shots} ph\xE1t.`);
  lines.push(...b.notes);
  sim.battleReports.push({ at: sim.time, lines });
  if (sim.battleReports.length > 8) sim.battleReports.shift();
  for (const l of lines) sim.say(l);
}

// src/sim/scouting.ts
var mapAccuracy = (sim, m) => Math.max(0, 1 - COMMAND.mapDecayPerDay * (sim.time - m.at) / DAY_LENGTH);
function mapLevel(sim, tribe) {
  let best = 0;
  for (const m of sim.maps) if (m.tribe === tribe && mapAccuracy(sim, m) >= 0.4) best = Math.max(best, m.gaps > 0 ? Math.max(1, m.level - 1) : m.level);
  return best;
}
var warriorsOf = (sim, tribe) => {
  const t = tribeOf(sim, tribe);
  return t ? t.unitIds.filter((u) => sim.get(u)?.ai?.role !== "civ").length : 0;
};
var SIGHT2 = 14;
var HOME = 7;
var COMPASS = ["\u0110\xF4ng", "\u0110\xF4ng Nam", "Nam", "T\xE2y Nam", "T\xE2y", "T\xE2y B\u1EAFc", "B\u1EAFc", "\u0110\xF4ng B\u1EAFc"];
var isFound = (sim, tribe) => sim.dev.freeBuild || sim.sightings.some((s) => s.tribe === tribe && s.reported);
function whereIs(sim, tribe) {
  const t = tribeOf(sim, tribe);
  if (!t) return null;
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  const dx = t.camp.x - fx, dy = t.camp.y - fy;
  return { dist: Math.round(Math.hypot(dx, dy)), dir: COMPASS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8] };
}
function tickSightings(sim, dt) {
  if (Math.floor(sim.time) === Math.floor(sim.time - dt)) return;
  const fire = sim.campfire();
  for (let i = sim.sightings.length - 1; i >= 0; i--) {
    const s = sim.sightings[i];
    if (s.reported) continue;
    const v = sim.byId.get(s.by);
    if (!v || v.team !== "player" || v.health <= 0) {
      sim.sightings.splice(i, 1);
      continue;
    }
    if (v.inside !== null || !fire || Math.hypot(v.x - fire.x, v.y - fire.y) < HOME) {
      s.reported = true;
      const w = whereIs(sim, s.tribe);
      if (w) sim.say(`${v.name} v\u1EC1 b\xE1o \u0111\xE3 th\u1EA5y m\u1ED9t ng\xF4i l\xE0ng, c\xE1ch \u0111\xE2y kho\u1EA3ng ${w.dist} \xF4 v\u1EC1 ph\xEDa ${w.dir}.`);
    }
  }
  for (const t of sim.tribes) {
    if (t.state === "destroyed" || sim.sightings.some((s) => s.tribe === t.id)) continue;
    const finder = sim.villagers.find((v) => v.health > 0 && v.inside === null && Math.hypot(v.x - t.camp.x, v.y - t.camp.y) < SIGHT2);
    if (finder) sim.sightings.push({ tribe: t.id, by: finder.id, at: sim.time, reported: false });
  }
}
var LEVEL_TECH = ["scout", "scout2", "scout3"];
function scoutLevel(sim) {
  if (sim.dev.freeBuild || !RESEARCH.enabled) return 3;
  let n = 0;
  while (n < LEVEL_TECH.length && sim.researched.has(LEVEL_TECH[n])) n++;
  return n;
}
function scoutLimit(sim) {
  return sim.dev.freeBuild ? 8 : sim.buildings.reduce((n, b) => n + (b.kind === "scouttent" && b.done ? levelDef(b).slots : 0), 0);
}
var onTrip = (sim, v) => sim.scouts.some((m) => m.ids.includes(v.id));
var canScout = (sim, v) => v.job === "scout" && v.health > 0 && v.inside === null && !onTrip(sim, v);
var scoutRoster = (sim) => sim.villagers.filter((v) => v.job === "scout");
function enlistScouts(sim, ids) {
  const lock = sim.warLock();
  if (lock) return lock;
  const limit = scoutLimit(sim);
  if (RESEARCH.enabled && !sim.dev.freeBuild && !scoutLevel(sim)) return "C\u1EA7n nghi\xEAn c\u1EE9u: Trinh s\xE1t";
  if (!limit) return "C\u1EA7n d\u1EF1ng Tr\u1EA1i trinh s\xE1t";
  const pick = sim.mine(ids).filter((v) => v.job !== "fight" && v.job !== "scout"), room = limit - scoutRoster(sim).length;
  if (!pick.length) return "Ch\u1ECDn d\xE2n th\u01B0\u1EDDng \u0111\u1EC3 tuy\u1EC3n l\xE0m trinh s\xE1t";
  if (room <= 0) return `Tr\u1EA1i trinh s\xE1t \u0111\xE3 \u0111\u1EE7 ${limit} trinh s\xE1t: n\xE2ng c\u1EA5p l\u1EC1u \u0111\u1EC3 ch\u1EE9a th\xEAm`;
  for (const v of pick.slice(0, room)) {
    sim.resetTask(v);
    sim.clearCombat(v);
    v.job = "scout";
    v.prefer = -1;
    v.post = -1;
  }
  return pick.length > room ? `L\u1EC1u ch\u1EC9 c\xF2n ch\u1ED7 cho ${room} trinh s\xE1t` : null;
}
function dismissScouts(sim, ids) {
  const lock = sim.warLock();
  if (lock) return lock;
  let n = 0, away = 0;
  for (const v of sim.mine(ids)) {
    if (v.job !== "scout") continue;
    if (onTrip(sim, v)) {
      away++;
      continue;
    }
    sim.resetTask(v);
    sim.clearCombat(v);
    v.job = "idle";
    v.post = -1;
    n++;
  }
  return n ? null : away ? "\u0110ang \u0111i trinh s\xE1t: \u0111\u1EE3i h\u1ECD v\u1EC1" : "Ch\u1ECDn trinh s\xE1t \u0111\u1EC3 cho ngh\u1EC9";
}
var scoutSkill = (v) => (v.stats.agi + v.stats.sta + v.stats.int) / 18;
var scoutsNeeded = (sim, tribe, level) => Math.min(8, level + 1 + Math.floor(warriorsOf(sim, tribe) / 8));
function drawChance(skills, need) {
  if (skills.length < 2) return 0;
  return Math.min(0.95, skills.reduce((a, b) => a + b, 0) / need);
}
var surveyTime = (level, scouts) => 0.2 * level * DAY_LENGTH / (1 + 0.35 * (Math.max(1, scouts) - 1));
function planScout(sim, ids, tribe) {
  const level = scoutLevel(sim), limit = scoutLimit(sim), scouts = sim.mine(ids).filter((v) => canScout(sim, v));
  const need = scoutsNeeded(sim, tribe, Math.max(1, level)), w = whereIs(sim, tribe);
  const speed = scouts.length ? scouts.reduce((a, v) => a + v.speed, 0) / scouts.length : 2, walk = w ? Math.max(0, w.dist - 15) / speed : 0;
  const survey = surveyTime(Math.max(1, level), scouts.length);
  let error = null;
  if (!sim.dev.freeBuild && !isFound(sim, tribe)) error = "Ch\u01B0a ai t\xECm th\u1EA5y l\xE0ng n\xE0y";
  else if (!tribeOf(sim, tribe)) error = "Kh\xF4ng c\xF3 l\xE0ng n\xE0y";
  else if (RESEARCH.enabled && !sim.dev.freeBuild && !level) error = "C\u1EA7n nghi\xEAn c\u1EE9u: Trinh s\xE1t";
  else if (!limit) error = "C\u1EA7n d\u1EF1ng Tr\u1EA1i trinh s\xE1t";
  else if (sim.scouts.some((m) => m.tribe === tribe)) error = "\u0110\xE3 c\xF3 trinh s\xE1t \u0111ang \u0111i l\xE0ng n\xE0y";
  else if (!scouts.length) error = "Ch\u1ECDn trinh s\xE1t \u0111\u1EC3 c\u1EED \u0111i (tuy\u1EC3n \u1EDF Tr\u1EA1i trinh s\xE1t)";
  else if (scouts.length > limit) error = `Tr\u1EA1i trinh s\xE1t ch\u1EC9 cho \u0111i ${limit} ng\u01B0\u1EDDi m\u1ED9t chuy\u1EBFn`;
  return { level, need, count: scouts.length, limit, chance: drawChance(scouts.map(scoutSkill), need), walk, survey, total: 2 * walk + survey, error };
}
function startScout(sim, ids, tribe) {
  const plan2 = planScout(sim, ids, tribe), t = tribeOf(sim, tribe);
  if (plan2.error || !t) return plan2.error ?? "Kh\xF4ng c\xF3 l\xE0ng n\xE0y";
  const scouts = sim.mine(ids).filter((v) => canScout(sim, v));
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  const dx = fx - t.camp.x, dy = fy - t.camp.y, len = Math.max(1, Math.hypot(dx, dy)), reach = Math.min(len, 15);
  const spotX = t.camp.x + dx / len * reach, spotY = t.camp.y + dy / len * reach;
  scouts.forEach((v, i) => {
    sim.resetTask(v);
    sim.clearCombat(v);
    const spot = sim.nearestFree(Math.floor(spotX + Math.cos(i * 2.4) * 2), Math.floor(spotY + Math.sin(i * 2.4) * 2), /* @__PURE__ */ new Set()) ?? [Math.floor(spotX), Math.floor(spotY)];
    sim.orderMove([v.id], spot[0], spot[1]);
  });
  sim.scouts.push({ id: sim.nextMission++, tribe, level: Math.max(1, plan2.level), ids: scouts.map((v) => v.id), phase: "go", t: 0, need: plan2.need, survivors: scouts.length, sent: scouts.length });
  sim.say(`${scouts.length} trinh s\xE1t l\xEAn \u0111\u01B0\u1EDDng t\u1EDBi ${t.def.name} \u0111\u1EC3 v\u1EBD b\u1EA3n \u0111\u1ED3 c\u1EA5p ${Math.max(1, plan2.level)}: kho\u1EA3ng ${Math.round(plan2.chance * 100)}% v\u1EBD \u0111\u1EE7 chi ti\u1EBFt, c\u1EA3 chuy\u1EBFn m\u1EA5t ch\u1EEBng ${Math.max(1, Math.round(plan2.total / 60))} ph\xFAt.`);
  return null;
}
function deathChance(sim, m, agi) {
  const t = tribeOf(sim, m.tribe), fire = sim.campfire();
  const power = warriorsOf(sim, m.tribe) * ringPower(ringOf(Math.hypot(t.camp.x - (fire?.x ?? 0), t.camp.y - (fire?.y ?? 0))));
  const day = sim.weather === "clear" && !sim.resting;
  return Math.max(0.02, Math.min(0.9, 0.1 + power / 5 / 100 + (day ? 0.1 : 0) - (sim.resting ? 0.1 : 0) - Math.max(0, agi - 6) * 0.01));
}
function tickScouts(sim, dt) {
  tickSightings(sim, dt);
  for (let i = sim.scouts.length - 1; i >= 0; i--) {
    const m = sim.scouts[i], t = tribeOf(sim, m.tribe);
    const alive = m.ids.map((id) => sim.byId.get(id)).filter((v) => !!v && v.team === "player" && v.health > 0);
    m.ids = alive.map((v) => v.id);
    if (!alive.length || !t) {
      sim.say(alive.length ? "Trinh s\xE1t b\u1ECB h\u1EE7y." : "M\u1EA5t h\u1EBFt trinh s\xE1t: kh\xF4ng c\xF3 b\u1EA3n \u0111\u1ED3 n\xE0o v\u1EC1.");
      sim.scouts.splice(i, 1);
      continue;
    }
    m.t += dt;
    if (m.phase === "go") {
      const near2 = alive.every((v) => Math.hypot(v.x - t.camp.x, v.y - t.camp.y) < 22 && !v.path.length);
      if (near2 || m.t > 300) {
        m.phase = "watch";
        m.t = 0;
        for (const v of alive) if (sim.frnd() < deathChance(sim, m, v.stats.agi)) sim.killUnit(v, "v\xEC b\u1ECB ph\xE1t hi\u1EC7n khi trinh s\xE1t");
        m.survivors = alive.filter((v) => v.health > 0 && sim.byId.has(v.id)).length;
        if (m.survivors && m.level >= 2) m.seen = seenNow(sim, tribeOf(sim, m.tribe));
        sim.say(m.survivors ? `Trinh s\xE1t \u0111ang quan s\xE1t ${t.def.name}.` : "Trinh s\xE1t b\u1ECB b\u1EAFt g\u1EB7p, kh\xF4ng ai tho\xE1t.");
      }
    } else if (m.phase === "watch") {
      if (m.t >= surveyTime(m.level, m.survivors)) {
        m.phase = "back";
        m.t = 0;
        const fire = sim.campfire();
        for (const id of m.ids) if (sim.byId.has(id) && fire) sim.orderMove([id], Math.floor(fire.x + 1), Math.floor(fire.y + 3));
      }
    } else {
      const fire = sim.campfire(), home = !fire || alive.every((v) => Math.hypot(v.x - fire.x, v.y - fire.y) < 7);
      if (home || m.t > 600) {
        const skills = alive.map(scoutSkill), chance = drawChance(skills, m.need), full = sim.frnd() < chance;
        const gaps = full ? 0 : Math.max(1, Math.ceil(m.need - skills.reduce((a, b) => a + b, 0)));
        const old = sim.maps.findIndex((x) => x.tribe === m.tribe && x.level === m.level);
        const map = { tribe: m.tribe, level: m.level, at: sim.time, gaps, seen: m.seen };
        if (old >= 0) sim.maps[old] = map;
        else sim.maps.push(map);
        sim.say(`Trinh s\xE1t v\u1EC1 (${alive.length}/${m.sent ?? alive.length} ng\u01B0\u1EDDi): b\u1EA3n \u0111\u1ED3 c\u1EA5p ${m.level} c\u1EE7a ${t.def.name}${full ? " \u0111\u1EA7y \u0111\u1EE7 chi ti\u1EBFt" : `, nh\u01B0ng c\xF2n h\u1EDF (thi\u1EBFu ${gaps} m\u1EA3nh, t\u1EC9 l\u1EC7 v\u1EBD \u0111\u1EE7 ch\u1EC9 ${Math.round(chance * 100)}%)`}.`);
        sim.scouts.splice(i, 1);
      }
    }
  }
}
var MARGIN = 24;
var YARD = 7;
var WORKS = {
  fire: { level: 1, label: "\u0110\u1ED1ng l\u1EEDa" },
  tower: { level: 2, label: "Ch\xF2i canh" },
  fence: { level: 2, label: "H\xE0ng r\xE0o" },
  gate: { level: 2, label: "C\u1ED5ng" },
  pile: { level: 3, label: "Kho l\u01B0\u01A1ng" }
};
var spread = (id, salt) => {
  const x = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
function seenNow(sim, t) {
  const out = [];
  for (const id of t.unitIds) {
    const u = sim.get(id);
    if (!u || u.health <= 0) continue;
    out.push({ x: Math.round(u.x * 10) / 10, y: Math.round(u.y * 10) / 10, arm: armOfWeapon(u.weapon), weapon: u.weapon ?? null, civ: u.ai?.role === "civ", leader: u.id === t.leaderId });
  }
  return out;
}
var WORK_INFO = {
  fire: "\u0110\u1ED1ng l\u1EEDa c\u1EE7a h\u1ECD: t\xE2m l\xE0ng, quanh \u0111\xE2y d\xE2n v\xE0 l\xEDnh t\u1EE5 l\u1EA1i.",
  tower: "Ch\xF2i canh: cung th\u1EE7 \u0111\u1EE9ng cao b\u1EAFn xa h\u01A1n, ph\u1EA3i ph\xE1 ch\xF2i m\u1EDBi h\u1EA1 \u0111\u01B0\u1EE3c h\u1ECD.",
  fence: "H\xE0ng r\xE0o: ch\u1EB7n \u0111\u01B0\u1EDDng, ph\u1EA3i ph\xE1 ho\u1EB7c \u0111i v\xF2ng.",
  gate: "C\u1ED5ng: l\u1ED1i v\xE0o l\xE0ng, \u0111\xF3ng th\xEC ch\u1EB7n \u0111\u01B0\u1EDDng.",
  pile: "Kho l\u01B0\u01A1ng: ch\u1ED7 h\u1ECD c\u1EA5t th\u1EE9c \u0103n v\xE0 \u0111\u1ED3 c\u1ED1ng n\u1EA1p."
};
function tribeIntel(sim, tribe) {
  const t = tribeOf(sim, tribe);
  if (!t) return null;
  const level = sim.dev.freeBuild ? 3 : mapLevel(sim, tribe);
  if (!level) return null;
  const held = sim.maps.filter((m) => m.tribe === tribe && (m.gaps > 0 ? m.level - 1 : m.level) >= level).sort((a, b) => b.at - a.at)[0];
  const accuracy = sim.dev.freeBuild || !held ? 1 : mapAccuracy(sim, held), gaps = sim.dev.freeBuild ? 0 : held?.gaps ?? 0;
  const N = sim.world.size, ry = YARD + MARGIN, rx = Math.round(ry * 1.9);
  const x0 = Math.max(0, Math.min(N - 2 * rx, Math.floor(t.camp.x) - rx)), y0 = Math.max(0, Math.min(N - 2 * ry, Math.floor(t.camp.y) - ry));
  const box = { x0, y0, x1: x0 + 2 * rx, y1: y0 + 2 * ry };
  const fire = sim.campfire(), dx = (fire?.x ?? sim.world.start.x) - t.camp.x, dy = (fire?.y ?? sim.world.start.y) - t.camp.y, len = Math.hypot(dx, dy);
  const seen = sim.dev.freeBuild || !held?.seen ? seenNow(sim, t) : held.seen;
  const soldiers = level >= 3 ? { foot: 0, archer: 0, cavalry: 0 } : null;
  const people = [];
  if (level >= 2) seen.forEach((u, i) => {
    if (spread(i + 1, 1) < Math.min(0.6, gaps * 0.2)) return;
    const mark = level < 3 ? "unknown" : u.civ ? "civ" : u.arm;
    if (soldiers && !u.civ) soldiers[u.arm]++;
    people.push({ x: u.x, y: u.y, mark, leader: level >= 3 && u.leader, weapon: level >= 3 ? u.weapon : null });
  });
  const loot = Object.entries(t.loot).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => `${Math.round(v)} ${RES_NAME[k].toLowerCase()}`).join(", ");
  return {
    tribe,
    name: t.def.name,
    level,
    accuracy,
    gaps,
    box,
    camp: { ...t.camp },
    yard: YARD,
    toUs: len > 0 ? { x: dx / len, y: dy / len } : null,
    population: Math.max(2, Math.round(seen.length / 2) * 2),
    structures: t.props.filter((p) => (WORKS[p.kind]?.level ?? 9) <= level).map((p) => ({ kind: p.kind, label: WORKS[p.kind].label, detail: p.kind === "pile" && loot ? `${WORK_INFO.pile} C\xF3 kho\u1EA3ng ${loot}.` : WORK_INFO[p.kind] ?? "", x: p.x, y: p.y, w: p.w, h: p.h })),
    people,
    soldiers
  };
}

// src/sim/warplan.ts
var NEED_LEVEL = { camp: 1, gate: 2, ambush: 2, stores: 3, leader: 3 };
function canTarget(sim, objective, tribe) {
  return sim.dev.freeBuild || !!tribe && sim.mapLevel(tribe) >= NEED_LEVEL[objective];
}
function newPlan(sim, kind, tribe) {
  const old = sim.plans.findIndex((p) => p.kind === kind && p.status !== "running");
  if (old >= 0) sim.plans.splice(old, 1);
  const fire = sim.campfire();
  const plan2 = { id: sim.nextPlan++, kind, tribe, missions: [], cards: [], status: "draft", stage: "assemble", startedAt: 0, signal: false, nextCard: 1, clears: [], result: "", rally: { x: (fire?.x ?? sim.world.start.x) + 1.5, y: (fire?.y ?? sim.world.start.y) + 6 } };
  sim.plans.push(plan2);
  return plan2;
}
function addMission(sim, plan2, squadId, withdrawAt = 0.5) {
  if (!sim.squadById(squadId)) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (plan2.missions.some((m) => m.squad === squadId)) return "\u0110\u1ED9i n\xE0y \u0111\xE3 c\xF3 nhi\u1EC7m v\u1EE5";
  plan2.missions.push({ squad: squadId, objective: "camp", route: "main", trigger: { kind: "time", at: 0 }, stance: "fight", withdrawAt, state: "idle", initial: 0, post: "gate", deploy: null, path: [], retreat: [], leg: 0, target: null, block: null });
  return null;
}
function removeMission(plan2, squadId) {
  plan2.missions = plan2.missions.filter((m) => m.squad !== squadId);
  plan2.cards = plan2.cards.filter((c) => c.squad !== squadId);
}
function drawable(sim, plan2, squadId) {
  if (plan2.status === "running") return "K\u1EBF ho\u1EA1ch \u0111ang ch\u1EA1y: kh\xF4ng v\u1EBD l\u1EA1i \u0111\u01B0\u1EE3c";
  const s = sim.squadById(squadId);
  if (!s) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (!plan2.missions.some((m) => m.squad === squadId)) addMission(sim, plan2, squadId, 0);
  return plan2.missions.find((m) => m.squad === squadId);
}
function deploySquad(sim, plan2, squadId, kind, cells, heading, o, p) {
  const s = sim.squadById(squadId);
  if (!s) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (plan2.status === "running") return "K\u1EBF ho\u1EA1ch \u0111ang ch\u1EA1y: kh\xF4ng v\u1EBD l\u1EA1i \u0111\u01B0\u1EE3c";
  if (cells.length < SQUAD_MIN || cells.length > SQUAD_MAX) return `\u0110\u1ED9i h\xECnh c\xF3 t\u1EEB ${SQUAD_MIN} \u0111\u1EBFn ${SQUAD_MAX} \xF4`;
  if (kind && !sim.formationOpen(kind)) return `C\u1EA7n nghi\xEAn c\u1EE9u: ${FORMATIONS[kind].name}`;
  if (kind && kind !== s.formation) {
    const e = sim.setFormation(s.id, kind);
    if (e) return e;
  }
  const m = drawable(sim, plan2, squadId);
  if (typeof m === "string") return m;
  const N = sim.world.size, keep = (v) => Math.max(1, Math.min(N - 2, v));
  m.deploy = { cells: cells.map((c) => ({ x: keep(c.x), y: keep(c.y) })), heading, o: { x: o.x, y: o.y }, p: { x: p.x, y: p.y }, kind: s.formation };
  return null;
}
function setMissionPath(sim, plan2, squadId, pts, retreat = false) {
  const m = drawable(sim, plan2, squadId);
  if (typeof m === "string") return m;
  let list = pts.slice(0, 40).map((p) => ({ x: p.x, y: p.y }));
  if (!retreat && list.length > 4) list = [...list.slice(0, 3), list[list.length - 1]];
  if (retreat) {
    m.retreat = list;
    return null;
  }
  if (m.target && list.length) list[list.length - 1] = { ...m.target.at };
  if (m.target && !list.length) m.target = null;
  m.path = list;
  return null;
}
function setMissionTarget(sim, plan2, squadId, target) {
  const m = drawable(sim, plan2, squadId);
  if (typeof m === "string") return m;
  const t = sim.tribes.find((x) => x.id === plan2.tribe);
  if (!t) return "Ch\u01B0a ch\u1ECDn l\xE0ng \u0111\u1EC3 \u0111\xE1nh";
  if (!m.deploy) return "\u0110\u1EB7t \u0111\u1ED9i h\xECnh c\u1EE7a \u0111\u1ED9i l\xEAn b\u1EA3n \u0111\u1ED3 tr\u01B0\u1EDBc";
  if (target.kind === "prop" && !t.props.some((p) => p.x === target.x && p.y === target.y)) return "C\xF4ng tr\xECnh n\xE0y kh\xF4ng c\xF2n";
  m.target = { ...target, at: { ...target.at } };
  m.path = [{ ...target.at }];
  m.block = null;
  m.objective = target.kind === "person" ? target.leader ? "leader" : "camp" : target.label === "Kho l\u01B0\u01A1ng" ? "stores" : "camp";
  return null;
}
function squadPace(sim, s) {
  const us = sim.squadUnits(s), base = us.length ? Math.min(...us.map((v) => 1.6 + 0.1 * v.stats.agi)) : 2.1;
  return base * FORMATIONS[s.formation].speed * WEATHER[sim.weather].speed;
}
function routeTime(sim, s, from, pts, target) {
  const pace = squadPace(sim, s) || 1, legs = [], blocked = [];
  let at = from, length = 0;
  for (const p of pts) {
    const d = Math.hypot(p.x - at.x, p.y - at.y), steps = Math.max(1, Math.ceil(d * 2));
    let bad = 0;
    for (let i = 0; i <= steps; i++) if (sim.world.isBlocked(Math.floor(at.x + (p.x - at.x) * i / steps), Math.floor(at.y + (p.y - at.y) * i / steps))) bad++;
    const share = bad / (steps + 1);
    legs.push(d * (1 + 1.5 * share) / pace);
    blocked.push(share > 0.1);
    length += d;
    at = p;
  }
  return { legs, total: legs.reduce((a, b) => a + b, 0), length, blocked, hits: sim.pathHits(from, pts, target) };
}
function missionStart(sim, m, toward) {
  const d = m.deploy;
  if (d) {
    const kind = d.kind ?? sim.squadById(m.squad)?.formation ?? "line", n = d.cells.length;
    if (kind === "wedge") return { x: d.o.x, y: d.o.y };
    if (kind === "horns") return { x: (d.cells[0].x + d.cells[n - 1].x) / 2, y: (d.cells[0].y + d.cells[n - 1].y) / 2 };
    if (kind === "circle") {
      const t = toward ?? m.path[0], r = Math.hypot(d.p.x - d.o.x, d.p.y - d.o.y), len = t ? Math.hypot(t.x - d.o.x, t.y - d.o.y) : 0;
      return len > 0.01 ? { x: d.o.x + (t.x - d.o.x) / len * r, y: d.o.y + (t.y - d.o.y) / len * r } : { x: d.o.x, y: d.o.y };
    }
    return { x: d.cells.reduce((a, c) => a + c.x, 0) / n, y: d.cells.reduce((a, c) => a + c.y, 0) / n };
  }
  const s = sim.squadById(m.squad);
  return s ? sim.squadCenter(s) : null;
}
function addCard(sim, plan2, kind, squadId, arg = "") {
  if (plan2.cards.length >= sim.cardLimit()) return `L\u1EC1u h\u1ECDp chi\u1EBFn ch\u1EC9 cho ${sim.cardLimit()} th\u1EBB l\u1EC7nh: n\xE2ng c\u1EA5p l\u1EC1u ho\u1EB7c b\u1ECF b\u1EDBt`;
  if (kind !== "signal" && !sim.squadById(squadId)) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (plan2.cards.some((c) => c.kind === kind && c.squad === squadId && c.arg === arg)) return "\u0110\xE3 c\xF3 th\u1EBB n\xE0y";
  plan2.cards.push({ id: plan2.nextCard++, kind, squad: squadId, arg });
  return null;
}
function removeCard(plan2, cardId) {
  plan2.cards = plan2.cards.filter((c) => c.id !== cardId);
}
function reviewPlan(sim, plan2) {
  const out = [];
  const t = plan2.tribe ? sim.tribes.find((x) => x.id === plan2.tribe) : void 0;
  if (plan2.kind === "attack") {
    if (!t) out.push("\u2717 Ch\u01B0a ch\u1ECDn l\xE0ng \u0111\u1EC3 \u0111\xE1nh.");
    else if (t.state !== "free") out.push(`\u2717 ${t.def.name} kh\xF4ng c\xF2n l\xE0 k\u1EBB \u0111\u1ECBch.`);
    else {
      const level = sim.mapLevel(t.id), maps = sim.maps.filter((m) => m.tribe === t.id);
      if (!level && !sim.dev.freeBuild) out.push("\u2717 Ch\u01B0a c\xF3 b\u1EA3n \u0111\u1ED3 n\xE0o c\u1EE7a l\xE0ng n\xE0y: h\xE3y c\u1EED trinh s\xE1t.");
      else {
        const newest = Math.max(...maps.map((m) => m.at));
        const days = Math.floor((sim.time - newest) / 1200);
        out.push(days >= 3 ? "B\u1EA3n \u0111\u1ED3 \u0111\xE3 c\u0169, \u0111\u1ECBch c\xF3 th\u1EC3 \u0111\xE3 \u0111\u1ED5i b\u1ED1 tr\xED." : days >= 1 ? `B\xE1o c\xE1o trinh s\xE1t t\u1EEB ${days} h\xF4m tr\u01B0\u1EDBc.` : "B\xE1o c\xE1o trinh s\xE1t m\u1EDBi trong ng\xE0y.");
        if (maps.some((m) => m.gaps > 0)) out.push("B\u1EA3n \u0111\u1ED3 c\xF2n h\u1EDF v\xEC \xEDt trinh s\xE1t v\u1EC1: v\xE0i ch\u1ED7 ch\u01B0a ch\u1EAFc ch\u1EAFn.");
      }
    }
  }
  if (!plan2.missions.length) out.push("\u2717 Ch\u01B0a giao nhi\u1EC7m v\u1EE5 cho \u0111\u1ED9i n\xE0o.");
  for (const m of plan2.missions) {
    const s = sim.squadById(m.squad), n = s ? sim.squadUnits(s).length : 0, name = s?.name ?? "?";
    if (!n) out.push(`\u2717 ${name} ch\u01B0a c\xF3 l\xEDnh.`);
    else if (isLogistics(plan2, m)) out.push(`${name} l\xE0 \u0111\u1ED9i h\u1EADu c\u1EA7n (kh\xF4ng c\xF3 m\u0169i t\xEAn): \u0111i tr\u01B0\u1EDBc ph\xE1 v\u1EADt c\u1EA3n tr\xEAn \u0111\u01B0\u1EDDng c\xE1c \u0111\u1ED9i kh\xE1c r\u1ED3i v\u1EC1 ch\u1ED7 c\u0169, kh\xF4ng ra tr\u1EADn.`);
    else if (plan2.kind === "attack" && !m.path.length && !canTarget(sim, m.objective, plan2.tribe)) out.push(`\u2717 ${name} nh\u1EAFm "${OBJECTIVE_NAME[m.objective]}" nh\u01B0ng b\u1EA3n \u0111\u1ED3 ch\u01B0a \u0111\u1EE7 c\u1EA5p.`);
    else if (plan2.kind === "attack" && !m.path.length) out.push(`${name} ch\u01B0a c\xF3 m\u1EE5c ti\xEAu: b\u1EA5m v\xE0o c\xF4ng tr\xECnh ho\u1EB7c ng\u01B0\u1EDDi tr\xEAn b\u1EA3n \u0111\u1ED3, n\u1EBFu kh\xF4ng s\u1EBD ti\u1EBFn th\u1EB3ng v\xE0o \u0111\u1ED1ng l\u1EEDa c\u1EE7a \u0111\u1ECBch.`);
    if (n && m.trigger.kind === "signal" && !plan2.cards.some((c) => c.kind === "signal")) out.push(`${name} ch\u1EDD t\xEDn hi\u1EC7u m\xE0 k\u1EBF ho\u1EA1ch kh\xF4ng c\xF3 th\u1EBB Ph\xE1t t\xEDn hi\u1EC7u: s\u1EBD kh\xF4ng bao gi\u1EDD xu\u1EA5t ph\xE1t.`);
    if (n && m.trigger.kind === "after" && !plan2.missions.some((x) => x.squad === m.trigger.squad)) out.push(`\u2717 ${name} ch\u1EDD m\u1ED9t \u0111\u1ED9i kh\xF4ng c\xF3 trong k\u1EBF ho\u1EA1ch.`);
    if (n && m.deploy && n < m.deploy.cells.length && !isLogistics(plan2, m)) out.push(`\u2717 ${name} m\u1EDBi c\xF3 ${n}/${m.deploy.cells.length} l\xEDnh cho ${m.deploy.cells.length} \xF4 \u0111\u1ED9i h\xECnh: th\xEAm l\xEDnh v\xE0o \u0111\u1ED9i ho\u1EB7c b\u1EDBt \xF4 (\u2702 B\u1EDBt \xF4).`);
    const unfit = s ? sim.squadUnits(s).filter((v) => v.down > 0 || sim.sleepLocked(v)).length : 0;
    if (unfit) out.push(`\u2717 ${name}: ${unfit} l\xEDnh \u0111ang b\u1ECB th\u01B0\u01A1ng ho\u1EB7c ng\u1EE7 say h\u1ED3i s\u1EE9c, ch\u01B0a \u0111i \u0111\u01B0\u1EE3c: \u0111\u1EE3i h\u1ECD kh\u1ECFe ho\u1EB7c \u0111\u01B0a ra kh\u1ECFi \u0111\u1ED9i.`);
    if (s && n && !sim.squadCenter(s)) out.push(`${name} ch\u01B0a c\xF3 ch\u1ED7 \u0111\u1EE9ng.`);
    if (s && plan2.kind === "attack" && m.withdrawAt > 0 && !m.retreat.length && m.path.length) out.push(`${name} s\u1EBD r\xFAt v\u1EC1 ch\u1ED7 h\u1EB9n v\xEC ch\u01B0a v\u1EBD \u0111\u01B0\u1EDDng r\xFAt.`);
    if (s && plan2.kind === "attack" && m.route === "night") out.push(`${name} \u0111i \u0111\u01B0\u1EDDng v\xF2ng ban \u0111\xEAm: s\u1EBD ch\u1EDD \u0111\u1EBFn t\u1ED1i m\u1EDBi xu\u1EA5t ph\xE1t.`);
    if (s && plan2.kind === "attack") out.push(...obstacleLines(sim, plan2, m, name));
  }
  if (plan2.kind === "attack") {
    const starts = plan2.missions.filter((m) => m.trigger.kind === "time" && m.trigger.at <= 0).length;
    if (plan2.missions.length && !starts && !plan2.cards.some((c) => c.kind === "go")) out.push("Kh\xF4ng \u0111\u1ED9i n\xE0o c\xF3 gi\u1EDD xu\u1EA5t ph\xE1t: h\xE3y th\xEAm th\u1EBB Xu\u1EA5t ph\xE1t ho\u1EB7c \u0111\u1EB7t gi\u1EDD.");
  }
  return out;
}
function isLogistics(plan2, m) {
  return plan2.kind === "attack" && !m.path.length && !m.target && plan2.missions.some((x) => x.path.length > 0);
}
function supplyUnits(sim, plan2) {
  return plan2.missions.filter((m) => isLogistics(plan2, m)).flatMap((m) => {
    const s = sim.squadById(m.squad);
    return s ? sim.squadUnits(s) : [];
  });
}
function obstacleLines(sim, plan2, m, name) {
  const out = [], start = sim.missionStart(m);
  if (start && m.path.length) {
    const hits = sim.pathHits(start, m.path, m.target?.kind === "prop" ? m.target.at : void 0), seen = /* @__PURE__ */ new Set(), crew2 = supplyUnits(sim, plan2).length > 0;
    for (const o of hits) {
      if (!o || o.kind === "enemy" || seen.has(`${o.x},${o.y}`)) continue;
      seen.add(`${o.x},${o.y}`);
      if (!o.clear) out.push(`\u2717 ${name}: m\u0169i t\xEAn v\u01B0\u1EDBng ${o.label} \u1EDF (${o.x}, ${o.y}), kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c: h\xE3y u\u1ED1n m\u0169i t\xEAn \u0111i v\xF2ng.`);
      else if (!crew2) out.push(`\u2717 ${name}: m\u0169i t\xEAn v\u01B0\u1EDBng ${o.label} \u1EDF (${o.x}, ${o.y}): c\u1EA7n m\u1ED9t \u0111\u1ED9i h\u1EADu c\u1EA7n (m\u1ED9t \u0111\u1ED9i kh\xF4ng v\u1EBD m\u0169i t\xEAn) c\xF3 l\xEDnh \u0111\u1EC3 ph\xE1 tr\u01B0\u1EDBc khi \u0111\xE1nh.`);
    }
  }
  if (m.deploy) {
    const under = m.deploy.cells.map((c) => sim.obstacleAt(Math.floor(c.x), Math.floor(c.y))).filter((o) => !!o);
    const cut = under.filter((o) => o.clear && o.kind !== "enemy").length, stuck = under.length - cut;
    if (cut) out.push(`${name}: ${cut} \xF4 \u0111\u1ED9i h\xECnh n\u1EB1m d\u01B0\u1EDBi c\xE2y ho\u1EB7c \u0111\xE1, l\xEDnh s\u1EBD t\u1EF1 ph\xE1 khi tri\u1EC3n khai.`);
    if (stuck) out.push(`${name}: ${stuck} \xF4 \u0111\u1ED9i h\xECnh n\u1EB1m tr\xEAn n\u01B0\u1EDBc ho\u1EB7c c\xF4ng tr\xECnh, kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c: l\xEDnh \u0111\u1EE9ng l\u1EC7ch ra, \u0111\u1ED9i h\xECnh b\u1ECB m\xE9o.`);
  }
  return out;
}
function listClears(sim, plan2) {
  const todo = /* @__PURE__ */ new Map(), crew2 = plan2.missions.find((m) => isLogistics(plan2, m))?.squad ?? -1;
  for (const m of plan2.missions) {
    const s = sim.squadById(m.squad), start = sim.missionStart(m);
    if (!s || !start || !m.path.length) continue;
    for (const o of sim.corridorBlocks(start, m.path, m.target?.kind === "prop" ? m.target.at : void 0)) todo.set(o.y * sim.world.size + o.x, { squad: crew2, x: o.x, y: o.y });
  }
  plan2.clears = [...todo.values()].slice(0, 80);
}
function crewClears(sim, plan2) {
  plan2.clears = plan2.clears.filter((c) => {
    const o = sim.obstacleAt(c.x, c.y);
    return !!o && o.clear;
  });
  const crew2 = supplyUnits(sim, plan2), busy2 = new Set(crew2.filter((v) => v.breaks).map((v) => `${v.breaks.x},${v.breaks.y}`));
  if (!crew2.length) return;
  for (const v of crew2) {
    if (v.breaks) continue;
    const c = plan2.clears.filter((q) => !busy2.has(`${q.x},${q.y}`)).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
    if (!c) break;
    busy2.add(`${c.x},${c.y}`);
    sim.startBreaking(v, sim.obstacleAt(c.x, c.y), v.fight.anchor ?? { x: v.x, y: v.y });
  }
}
function cancelPlan(sim, plan2) {
  if (plan2.status === "running") return "K\u1EBF ho\u1EA1ch \u0111ang ch\u1EA1y: h\xE3y r\xFAt qu\xE2n tr\u01B0\u1EDBc";
  sim.plans.splice(sim.plans.indexOf(plan2), 1);
  return null;
}
function objectivePos(sim, plan2, m) {
  const t = sim.tribes.find((x) => x.id === plan2.tribe);
  if (!t) return null;
  const toward = (d, side = 0) => {
    const dx = plan2.rally.x - t.camp.x, dy = plan2.rally.y - t.camp.y, len = Math.max(1, Math.hypot(dx, dy));
    return { x: t.camp.x + dx / len * d - dy / len * side, y: t.camp.y + dy / len * d + dx / len * side };
  };
  switch (m.objective) {
    case "gate":
      return toward(9);
    case "ambush":
      return toward(14, 8);
    case "stores": {
      const p = t.props.find((q) => q.kind === "pile");
      return p ? { x: p.x + 1, y: p.y + 1 } : { ...t.camp };
    }
    case "leader": {
      const l = sim.get(t.leaderId);
      return l && l.health > 0 ? { x: l.x, y: l.y, target: l.id } : { ...t.camp };
    }
    default:
      return { ...t.camp };
  }
}
function goLeg(sim, s, m, pts) {
  const p = pts[Math.min(m.leg, pts.length - 1)], last = m.leg >= pts.length - 1;
  const mode = m.state === "withdraw" || m.stance === "evade" ? "move" : last && m.stance === "hold" ? "hold" : "attack";
  if (m.state === "withdraw" || pts !== m.path) {
    sim.squadMove(s, p.x, p.y, mode);
    return;
  }
  const ob = sim.arrowMove(s, m, p, mode);
  if (ob) sim.haltSquad(m, s, ob);
}
function pathStep(sim, m, s, c) {
  if (m.state !== "march") return;
  const p = m.path[m.leg];
  if (!p || Math.hypot(p.x - c.x, p.y - c.y) > 3.5) return;
  if (m.leg < m.path.length - 1) {
    m.leg++;
    goLeg(sim, s, m, m.path);
    return;
  }
  m.state = "engaged";
  sim.noteBattle("note", `${s.name} t\u1EDBi ch\u1ED7 t\u1EA5n c\xF4ng.`);
  const end = m.path[m.path.length - 1];
  if (m.target || m.stance === "evade" || !end) return;
  const about = sim.foes.some((f) => f.health > 0 && f.ai && f.ai.role !== "civ" && Math.hypot(f.x - end.x, f.y - end.y) < 12);
  if (!about) {
    sim.squadMove(s, end.x, end.y, "hold");
    sim.noteBattle("note", `${s.name} kh\xF4ng th\u1EA5y ai \u1EDF cu\u1ED1i m\u0169i t\xEAn: gi\u1EEF v\u1ECB tr\xED v\xE0 \u0111\xE1nh m\u1ECDi th\u1EE9 xung quanh.`);
  }
}
function dispatch(sim, plan2, m, s) {
  if (m.path.length) {
    m.state = "march";
    m.leg = 0;
    goLeg(sim, s, m, m.path);
    if (m.stance === "shoot") {
      for (const v of sim.squadUnits(s)) if (!v.weapon || !(v.weapon === "bow" || v.weapon === "sling")) sim.orderHold([v.id]);
    }
    return;
  }
  const pos = objectivePos(sim, plan2, m);
  if (!pos) return;
  m.state = "march";
  const c = sim.squadCenter(s) ?? plan2.rally;
  if (m.route === "forest") {
    const dx = pos.x - c.x, dy = pos.y - c.y, len = Math.max(1, Math.hypot(dx, dy));
    sim.squadMove(s, c.x + dx * 0.5 - dy / len * 10, c.y + dy * 0.5 + dx / len * 10, m.stance === "evade" ? "move" : "attack");
    return;
  }
  sim.squadMove(s, pos.x, pos.y, m.stance === "evade" ? "move" : "attack");
  if (m.stance === "shoot") {
    for (const v of sim.squadUnits(s)) if (!v.weapon || !(v.weapon === "bow" || v.weapon === "sling")) sim.orderHold([v.id]);
  }
}
function triggered(sim, plan2, m) {
  const t = sim.tribes.find((x) => x.id === plan2.tribe), tr = m.trigger;
  if (m.route === "night" && !sim.resting) return false;
  if (tr.kind === "time") return sim.time - plan2.startedAt >= tr.at;
  if (tr.kind === "signal") return plan2.signal;
  if (tr.kind === "after") {
    const o = plan2.missions.find((x) => x.squad === tr.squad);
    return !!o && (o.state === "engaged" || o.state === "withdraw" || o.state === "done");
  }
  if (!t) return false;
  const raiders = t.unitIds.map((u) => sim.get(u)).filter((u) => u && u.ai?.role !== "civ");
  return raiders.length > 0 && raiders.some((u) => Math.hypot(u.x - t.camp.x, u.y - t.camp.y) > 9);
}
function assemble(sim, s, d) {
  const us = sim.squadUnits(s).sort((a, b) => (sim.armOf(a) === "archer" ? 1 : 0) - (sim.armOf(b) === "archer" ? 1 : 0) || a.id - b.id);
  const front = (c) => c.x * Math.cos(d.heading) + c.y * Math.sin(d.heading);
  const cells = d.cells.slice().sort((a, b) => front(b) - front(a)), taken = /* @__PURE__ */ new Set();
  s.heading = d.heading;
  s.anchor = { x: cells.reduce((a, c) => a + c.x, 0) / cells.length, y: cells.reduce((a, c) => a + c.y, 0) / cells.length };
  us.forEach((v, i) => {
    const c = cells[Math.min(i, cells.length - 1)], ob = sim.obstacleAt(Math.floor(c.x), Math.floor(c.y));
    if (ob?.clear && ob.kind !== "enemy" && sim.startBreaking(v, ob, { x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + 0.5 })) {
      taken.add(Math.floor(c.y) * sim.world.size + Math.floor(c.x));
      return;
    }
    const spot = sim.nearestFree(Math.floor(c.x), Math.floor(c.y), taken) ?? [Math.floor(c.x), Math.floor(c.y)];
    taken.add(spot[1] * sim.world.size + spot[0]);
    sim.orderMove([v.id], spot[0], spot[1]);
  });
}
function assembled(sim, plan2) {
  return (!plan2.clears.length || !supplyUnits(sim, plan2).length) && plan2.missions.every((m) => {
    const s = sim.squadById(m.squad);
    return !s || sim.squadUnits(s).every((v) => !v.breaks && (!v.fight.anchor || Math.hypot(v.x - v.fight.anchor.x, v.y - v.fight.anchor.y) < 2.5));
  });
}
function regather(sim, plan2) {
  for (const m of plan2.missions) {
    const s = sim.squadById(m.squad);
    if (!s) continue;
    for (const v of sim.squadUnits(s)) {
      const a = v.fight.anchor;
      if (!a || v.breaks || v.phase === "fight" || v.path.length || v.down > 0 || Math.hypot(v.x - a.x, v.y - a.y) < 2.5) continue;
      const ob = sim.obstacleAt(Math.floor(a.x), Math.floor(a.y));
      if (ob?.clear && ob.kind !== "enemy" && sim.startBreaking(v, ob, a)) continue;
      sim.orderMove([v.id], Math.floor(a.x), Math.floor(a.y));
    }
  }
}
function engagePlan(sim, plan2) {
  if (plan2.kind !== "attack" || plan2.status !== "running") return "K\u1EBF ho\u1EA1ch ch\u01B0a tri\u1EC3n khai";
  if (plan2.stage === "assemble") return "Qu\xE2n ch\u01B0a v\xE0o v\u1ECB tr\xED h\u1EBFt";
  if (plan2.stage !== "ready") return plan2.stage === "fight" ? "\u0110ang \u0111\xE1nh r\u1ED3i" : "Qu\xE2n \u0111ang r\xFAt";
  plan2.stage = "fight";
  plan2.startedAt = sim.time;
  plan2.signal = false;
  sim.say("Xung phong! K\u1EBF ho\u1EA1ch t\xE1c chi\u1EBFn \u0111\u01B0\u1EE3c th\u1EF1c thi.");
  sim.noteBattle("note", "L\u1EC7nh \u0111\xE1nh \u0111\u01B0\u1EE3c ban ra.");
  return null;
}
function withdrawPlan(sim, plan2) {
  if (plan2.kind !== "attack" || plan2.status !== "running") return "K\u1EBF ho\u1EA1ch ch\u01B0a tri\u1EC3n khai";
  if (plan2.stage === "retreat" || plan2.stage === "recall") return "Qu\xE2n \u0111ang r\xFAt r\u1ED3i";
  const recall = plan2.stage === "assemble" || plan2.stage === "ready";
  plan2.stage = recall ? "recall" : "retreat";
  if (recall) {
    plan2.startedAt = sim.time;
    for (const m of plan2.missions) {
      const s = sim.squadById(m.squad);
      m.state = "withdraw";
      m.leg = 0;
      if (s && sim.squadUnits(s).length) sim.squadMove(s, plan2.rally.x, plan2.rally.y, "move");
    }
    sim.say("H\u1EE7y tr\u1EADn: to\xE0n qu\xE2n r\xFAt v\u1EC1 l\xE0ng.");
    sim.noteBattle("note", "H\u1EE7y tr\u1EADn tr\u01B0\u1EDBc khi \u0111\xE1nh, to\xE0n qu\xE2n v\u1EC1 l\xE0ng.");
    return null;
  }
  for (const m of plan2.missions) {
    const s = sim.squadById(m.squad);
    if (!s || m.state === "done" || !sim.squadUnits(s).length) {
      m.state = "done";
      continue;
    }
    m.state = "withdraw";
    m.leg = 0;
    if (m.retreat.length) goLeg(sim, s, m, m.retreat);
    else sim.squadMove(s, plan2.rally.x, plan2.rally.y, "move");
  }
  sim.say("R\xFAt qu\xE2n!");
  sim.noteBattle("note", "L\u1EC7nh r\xFAt to\xE0n qu\xE2n.");
  return null;
}
function startPlan(sim, plan2) {
  const bad = reviewPlan(sim, plan2).find((l) => l.startsWith("\u2717"));
  if (bad) return bad.slice(2);
  if (plan2.kind === "defense") return "K\u1EBF ho\u1EA1ch ph\xF2ng th\u1EE7 ch\u1EA1y khi b\u1EA1n \u0111\xE1nh tr\u1ED1ng b\xE1o \u0111\u1ED9ng";
  for (const m of plan2.missions) {
    const s = sim.squadById(m.squad);
    m.state = "wait";
    m.initial = sim.squadUnits(s).length;
    m.leg = 0;
    m.block = null;
    if (m.deploy) assemble(sim, s, m.deploy);
    else if (isLogistics(plan2, m)) for (const v of sim.squadUnits(s)) {
      v.fight.mode = "guard";
      v.fight.anchor = { x: v.x, y: v.y };
    }
  }
  plan2.status = "running";
  plan2.stage = "assemble";
  plan2.startedAt = sim.time;
  plan2.signal = false;
  plan2.result = "";
  listClears(sim, plan2);
  crewClears(sim, plan2);
  sim.say(`Tri\u1EC3n khai qu\xE2n \u0111\xE1nh ${sim.tribes.find((t) => t.id === plan2.tribe)?.def.name ?? ""} b\u1EAFt \u0111\u1EA7u.`);
  return null;
}
function endCheck(sim, plan2, t) {
  if (!t) {
    plan2.status = "done";
    plan2.result = "lost";
    return;
  }
  const armed = t.unitIds.some((id) => {
    const u = sim.get(id);
    return !!u && u.health > 0 && u.ai?.role !== "civ";
  });
  if (t.state !== "free" || !armed && t.props.length === 0) {
    plan2.status = "done";
    plan2.result = "won";
    sim.say(`Chi\u1EBFn th\u1EAFng! ${t.def.name} kh\xF4ng c\xF2n l\xEDnh, l\u1EEDa t\u1EAFt v\xE0 m\u1ECDi c\xF4ng tr\xECnh \u0111\xE3 s\u1EADp.`);
    sim.noteBattle("note", `${t.def.name} b\u1ECB san b\u1EB1ng.`);
    if (t.state === "free") sim.conquer(t.id, "L\xE0ng b\u1ECB san b\u1EB1ng");
    return;
  }
  if (plan2.missions.every((m) => m.state === "done" || m.state === "idle")) {
    plan2.status = "done";
    plan2.result = "lost";
    const left = plan2.missions.some((m) => m.initial > 0 && (sim.squadById(m.squad) ? sim.squadUnits(sim.squadById(m.squad)).length : 0) > 0);
    sim.say(left ? "Thua tr\u1EADn: qu\xE2n ta \u0111\xE3 r\xFAt kh\u1ECFi chi\u1EBFn tr\u01B0\u1EDDng." : "Thua tr\u1EADn: qu\xE2n ta kh\xF4ng c\xF2n ai.");
  }
}
function tickPlans(sim, dt) {
  if (sim.alarmUntil > 0 && sim.time > sim.alarmUntil) sim.alarmUntil = 0;
  for (const plan2 of sim.plans) {
    if (plan2.kind !== "attack" || plan2.status !== "running") continue;
    const t = sim.tribes.find((x) => x.id === plan2.tribe);
    if (plan2.stage === "assemble") {
      if (Math.floor(sim.time) !== Math.floor(sim.time - dt)) {
        regather(sim, plan2);
        crewClears(sim, plan2);
      }
      const late = sim.time - plan2.startedAt > 150 + 60 * plan2.clears.length;
      if (assembled(sim, plan2) || late) {
        plan2.stage = "ready";
        const missing2 = plan2.missions.reduce((a, m) => {
          const s = sim.squadById(m.squad);
          return a + (s ? sim.squadUnits(s).filter((v) => v.fight.anchor && Math.hypot(v.x - v.fight.anchor.x, v.y - v.fight.anchor.y) >= 2.5).length : 0);
        }, 0);
        sim.say(missing2 ? `Qu\xE2n \u0111\xE3 v\xE0o v\u1ECB tr\xED, c\xF2n ${missing2} l\xEDnh ch\u01B0a t\u1EDBi k\u1ECBp. \u0110\xE1nh hay r\xFAt?` : "Qu\xE2n \u0111\xE3 v\xE0o v\u1ECB tr\xED. \u0110\xE1nh hay r\xFAt?");
      }
    }
    if (plan2.stage === "recall") {
      const home = plan2.missions.every((m) => {
        const s = sim.squadById(m.squad), c = s ? sim.squadCenter(s) : null;
        return !c || Math.hypot(plan2.rally.x - c.x, plan2.rally.y - c.y) < 7;
      });
      if (home || sim.time - plan2.startedAt > 240) {
        plan2.status = "draft";
        plan2.stage = "assemble";
        for (const m of plan2.missions) {
          m.state = "idle";
          m.leg = 0;
        }
        sim.say("Qu\xE2n \u0111\xE3 v\u1EC1 l\xE0ng. K\u1EBF ho\u1EA1ch \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn: s\u1EEDa r\u1ED3i tri\u1EC3n khai l\u1EA1i khi mu\u1ED1n.");
      }
      continue;
    }
    if (plan2.stage === "assemble" || plan2.stage === "ready") continue;
    const second = Math.floor(sim.time) !== Math.floor(sim.time - dt), half = Math.floor(sim.time * 2) !== Math.floor((sim.time - dt) * 2);
    for (const m of plan2.missions) {
      const s = sim.squadById(m.squad);
      if (!s || !sim.squadUnits(s).length || isLogistics(plan2, m)) {
        if (m.state !== "done") {
          m.state = "done";
        }
        continue;
      }
      const alive = sim.squadUnits(s).length, c = sim.squadCenter(s);
      if (m.state === "wait" && triggered(sim, plan2, m)) dispatch(sim, plan2, m, s);
      else if (m.state === "blocked") {
        if (second && sim.blockCleared(m)) {
          m.block = null;
          m.state = "march";
          goLeg(sim, s, m, m.path);
          sim.say(`${s.name} \u0111i ti\u1EBFp.`);
        }
      }
      if (m.state === "march" || m.state === "engaged" || m.state === "blocked") {
        if (m.state === "march" && m.path.length && half && sim.watchMarch(m, s)) continue;
        if (second && m.state !== "blocked") sim.tickTarget(plan2, m, s);
        const pos = m.path.length ? null : objectivePos(sim, plan2, m);
        if (m.path.length && m.state !== "blocked") pathStep(sim, m, s, c);
        if (pos) {
          const d = Math.hypot(pos.x - c.x, pos.y - c.y);
          if (m.state === "march" && d < 9) {
            m.state = "engaged";
            sim.noteBattle("note", `${s.name} \xE1p s\xE1t ${OBJECTIVE_NAME[m.objective].toLowerCase()}.`);
            if (pos.target) sim.orderAttack(sim.squadUnits(s).map((v) => v.id), { kind: "unit", id: pos.target });
          } else if (m.state === "march" && m.route === "forest" && d > 12 && Math.hypot((s.anchor?.x ?? 0) - c.x, (s.anchor?.y ?? 0) - c.y) < 4) dispatch(sim, plan2, { ...m, route: "main" }, s);
        }
        const lost = m.initial ? 1 - alive / m.initial : 0, morale = sim.squadUnits(s).reduce((a, v) => a + v.morale, 0) / alive;
        if (m.withdrawAt > 0 && (lost >= m.withdrawAt || morale < 25)) {
          m.state = "withdraw";
          m.leg = 0;
          m.block = null;
          if (m.retreat.length) goLeg(sim, s, m, m.retreat);
          else sim.squadMove(s, plan2.rally.x, plan2.rally.y, "move");
          sim.noteBattle("note", `${s.name} r\xFAt lui sau khi m\u1EA5t ${Math.round(lost * 100)}% qu\xE2n.`);
          sim.say(`${s.name} r\xFAt lui!`);
        }
      } else if (m.state === "withdraw") {
        if (m.retreat.length) {
          const p = m.retreat[m.leg];
          if (p && Math.hypot(p.x - c.x, p.y - c.y) < 3.5) {
            if (m.leg < m.retreat.length - 1) {
              m.leg++;
              goLeg(sim, s, m, m.retreat);
            } else m.state = "done";
          }
        } else if (Math.hypot(plan2.rally.x - c.x, plan2.rally.y - c.y) < 7) m.state = "done";
      }
    }
    endCheck(sim, plan2, t);
  }
}
function playCard(sim, plan2, cardId) {
  const card = plan2.cards.find((c2) => c2.id === cardId);
  if (!card) return "Kh\xF4ng c\xF3 th\u1EBB n\xE0y";
  if (card.kind === "signal") {
    plan2.signal = true;
    sim.say("T\xEDn hi\u1EC7u \u0111\u01B0\u1EE3c ph\xE1t \u0111i!");
    return null;
  }
  const s = sim.squadById(card.squad), m = plan2.missions.find((x) => x.squad === card.squad);
  if (!s) return "\u0110\u1ED9i n\xE0y kh\xF4ng c\xF2n";
  if (card.kind === "formation") return sim.setFormation(s.id, card.arg);
  if (plan2.status !== "running" || !m) return "K\u1EBF ho\u1EA1ch ch\u01B0a b\u1EAFt \u0111\u1EA7u";
  if (!sim.squadUnits(s).length) return `${s.name} kh\xF4ng c\xF2n ai`;
  const c = sim.squadCenter(s);
  switch (card.kind) {
    case "go":
    case "advance":
      if (m.state === "withdraw" || m.state === "done") return `${s.name} \u0111\xE3 r\xFAt`;
      if (m.state === "blocked") return `${s.name} \u0111ang b\u1ECB ch\u1EB7n: c\u1EED l\xEDnh ph\xE1 v\u1EADt c\u1EA3n tr\u01B0\u1EDBc`;
      if (!m.initial) m.initial = sim.squadUnits(s).length;
      dispatch(sim, plan2, m, s);
      break;
    case "hold":
      m.state = "hold";
      sim.squadMove(s, c.x, c.y, "hold");
      break;
    case "shoot":
      m.stance = "shoot";
      for (const v of sim.squadUnits(s)) if (v.weapon !== "bow" && v.weapon !== "sling") sim.orderHold([v.id]);
      break;
    case "attack":
      if (!canTarget(sim, card.arg, plan2.tribe)) return "B\u1EA3n \u0111\u1ED3 ch\u01B0a \u0111\u1EE7 c\u1EA5p \u0111\u1EC3 nh\u1EAFm m\u1EE5c ti\xEAu n\xE0y";
      m.objective = card.arg;
      if (!m.initial) m.initial = sim.squadUnits(s).length;
      dispatch(sim, plan2, m, s);
      break;
    case "retreat":
      m.state = "withdraw";
      m.leg = 0;
      if (m.retreat.length) goLeg(sim, s, m, m.retreat);
      else sim.squadMove(s, plan2.rally.x, plan2.rally.y, "move");
      sim.noteBattle("note", `${s.name} \u0111\u01B0\u1EE3c l\u1EC7nh r\xFAt.`);
      break;
  }
  return null;
}
function soundAlarm(sim) {
  if (RESEARCH.enabled && !sim.dev.freeBuild && !sim.researched.has("signal")) return "C\u1EA7n nghi\xEAn c\u1EE9u: T\xEDn hi\u1EC7u (tr\u1ED1ng, kh\xF3i)";
  sim.alarmUntil = sim.time + 180;
  sim.say("Tr\u1ED1ng b\xE1o \u0111\u1ED9ng vang l\xEAn! D\xE2n v\u1EC1 \u0111\u1ED1ng l\u1EEDa, qu\xE2n v\u1EC1 v\u1ECB tr\xED.");
  const fire = sim.campfire(), fx = (fire?.x ?? sim.world.start.x) + 1, fy = (fire?.y ?? sim.world.start.y) + 3;
  const plan2 = sim.plans.find((p) => p.kind === "defense");
  const hostile = sim.foes.filter((f) => f.ai?.role === "raider" && f.health > 0), first = hostile[0] ?? sim.tribes.find((t) => t.state === "free" && t.raid)?.camp;
  const toward = first ?? { x: fx, y: fy + 10 };
  const inward = (b, w) => {
    const dx = fx - b.x, dy = fy - b.y, len = Math.max(1, Math.hypot(dx, dy));
    return { x: b.x + w / 2 + dx / len * 1.8, y: b.y + w / 2 + dy / len * 1.8 };
  };
  const place = (post) => {
    if (post === "gate") {
      const g = sim.buildings.filter((b) => b.kind === "gate" && b.done).sort((a, b) => Math.hypot(a.x - toward.x, a.y - toward.y) - Math.hypot(b.x - toward.x, b.y - toward.y))[0];
      if (g) return inward(g, 1);
    }
    if (post === "fence") {
      const f = sim.buildings.filter((b) => b.kind === "fence" && b.done).sort((a, b) => Math.hypot(a.x - toward.x, a.y - toward.y) - Math.hypot(b.x - toward.x, b.y - toward.y))[0];
      if (f) return inward(f, 1);
    }
    if (post === "tower") {
      const tw = sim.buildings.filter((b) => b.kind === "tower" && b.done).sort((a, b) => Math.hypot(a.x - toward.x, a.y - toward.y) - Math.hypot(b.x - toward.x, b.y - toward.y))[0];
      if (tw) return inward(tw, 2);
    }
    return { x: fx, y: fy };
  };
  const squads = plan2 ? plan2.missions : sim.squads.map((s) => ({ squad: s.id, post: "fire" }));
  for (const m of squads) {
    const s = sim.squadById(m.squad);
    if (!s) continue;
    if (m.post === "tower") for (const tw of sim.buildings.filter((b) => b.kind === "tower" && b.done)) sim.assignTower(sim.squadUnits(s).map((v) => v.id), tw.id);
    const p = place(m.post);
    sim.squadMove(s, p.x, p.y, "hold");
  }
  return null;
}

// src/sim/forecast.ts
var SPREAD = [0.4, 0.35, 0.2, 0.1];
var AVERAGE_STAT = 6.5;
function dps(weapon, str, agi, armor) {
  const w = WEAPONS[weapon ?? "fist"] ?? WEAPONS.fist, base = w.damage + (w.ranged ? 0 : RULES.strengthDamage * str);
  return base * (1 - (armor ? armor[w.type] : 0)) / cycleOf(w.cycle, agi);
}
var armOf2 = (sim, v) => sim.armOf(v);
var STANCE_WEIGHT = { fight: 1, shoot: 0.8, hold: 0.5, evade: 0 };
var pct = (x) => `${Math.round(x * 100)}%`;
function forecastPlan(sim, plan2) {
  const t = plan2.tribe ? sim.tribes.find((x) => x.id === plan2.tribe) : void 0;
  const notes = sim.reviewPlan(plan2), blocked = notes.filter((l) => l.startsWith("\u2717")).map((l) => l.slice(2));
  const intel = plan2.tribe ? sim.tribeIntel(plan2.tribe) : null, level = intel ? intel.level : 0;
  const out = { level, chance: 0, spread: SPREAD[level], verdict: "", blocked: blocked.length ? blocked.join("\n") : null, warnings: notes.filter((l) => !l.startsWith("\u2717")), win: [], lose: [], lines: [] };
  if (!t || !intel) {
    out.verdict = "Ch\u01B0a c\xF3 b\u1EA3n \u0111\u1ED3 \u0111\u1EC3 l\u01B0\u1EE3ng s\u1EE9c.";
    return out;
  }
  const enemyArmor = t.def.armor ? ARMORS.hide : null;
  const enemyWeapons = t.def.weapons, enemyType = (WEAPONS[enemyWeapons[0]] ?? WEAPONS.fist).type;
  let strength = 0, count = 0, hurt2 = 0, bare = 0, unarmored = 0, morale = 0;
  const arms = { foot: 0, archer: 0, cavalry: 0 };
  const perSquad = [];
  for (const m of plan2.missions) {
    const s = sim.squadById(m.squad);
    if (!s) continue;
    const us = sim.squadUnits(s), w2 = STANCE_WEIGHT[m.stance], sa = { foot: 0, archer: 0, cavalry: 0 };
    let worth = 0;
    for (const v of us) {
      const armor = v.armor ? ARMORS[v.armor] ?? null : null, hp = v.health / (1 - (armor ? armor[enemyType] : 0));
      const unit = Math.sqrt(dps(v.weapon, v.stats.str, v.stats.agi, enemyArmor) * hp) * Math.min(1.1, Math.max(0.7, v.morale / 70));
      worth += unit * w2;
      count++;
      sa[armOf2(sim, v)]++;
      arms[armOf2(sim, v)]++;
      if (v.health < 0.6 * v.maxHealth) hurt2++;
      if (!v.weapon) bare++;
      if (!v.armor) unarmored++;
      morale += v.morale;
    }
    strength += worth;
    perSquad.push({ name: s.name, n: us.length, worth, arms: sa });
  }
  const ratio = t.def.warriors / Math.max(1, t.def.warriors + t.def.civilians);
  const soldiers = intel.soldiers, men = soldiers ? soldiers.foot + soldiers.archer + soldiers.cavalry : Math.max(1, Math.round((level >= 2 ? intel.people.length : intel.population) * ratio));
  const fire = sim.campfire(), ring = ringOf(Math.hypot(t.camp.x - (fire?.x ?? 0), t.camp.y - (fire?.y ?? 0))), power = ringPower(ring);
  const wAvg = enemyWeapons.map((id) => dps(id, AVERAGE_STAT, AVERAGE_STAT, null)).reduce((a, b) => a + b, 0) / enemyWeapons.length;
  const hpAvg = maxHpOf(AVERAGE_STAT) * power;
  const ourArmor = (() => {
    const worn = plan2.missions.flatMap((m) => {
      const s = sim.squadById(m.squad);
      return s ? sim.squadUnits(s) : [];
    }).filter((v) => v.armor);
    return worn.length / Math.max(1, count);
  })();
  const theirUnit = Math.sqrt(wAvg * power * (1 - 0.35 * ourArmor) * hpAvg);
  const towers = intel.structures.filter((x) => x.kind === "tower").length, fences = intel.structures.filter((x) => x.kind === "fence").length, gates = intel.structures.filter((x) => x.kind === "gate").length;
  const works = level >= 2 ? 1 + 0.15 * Math.min(4, towers) + 0.03 * Math.min(6, fences) + 0.04 * Math.min(2, gates) : 1;
  const chief = level >= 3 && intel.people.some((p) => p.leader) ? 1.08 : 1;
  let match = 1;
  if (soldiers && men && count) {
    const mine2 = (a, b) => BEATS[a][b];
    let our = 0, their = 0;
    for (const a of Object.keys(arms)) for (const b of Object.keys(soldiers)) {
      const w2 = arms[a] / count * (soldiers[b] / men);
      our += w2 * mine2(a, b);
      their += w2 * mine2(b, a);
    }
    match = Math.sqrt(our / Math.max(0.1, their));
  }
  const theirs = men * theirUnit * works * chief, ours = strength * match;
  const R2 = theirs > 0 ? ours / theirs : 9;
  out.chance = count ? Math.max(0.01, Math.min(0.99, 1 / (1 + Math.exp(-3 * Math.log(Math.max(0.01, R2)))))) : 0;
  const lossIfWin = R2 > 1 ? 1 - Math.sqrt(1 - 1 / (R2 * R2)) : 1;
  const w = out.warnings;
  if (!count) w.push("Kh\xF4ng c\xF3 l\xEDnh n\xE0o trong k\u1EBF ho\u1EA1ch.");
  if (out.chance < 0.4 && count) w.push("Th\u1EBF tr\u1EADn b\u1EA5t l\u1EE3i: kh\u1EA3 n\u0103ng thua cao h\u01A1n th\u1EAFng.");
  else if (out.chance < 0.6 && count) w.push("Th\u1EBF tr\u1EADn c\xE2n b\u1EB1ng: m\u1ED9t ch\xFAt may r\u1EE7i c\u0169ng \u0111\u1EE7 \u0111\u1ED5i k\u1EBFt qu\u1EA3.");
  if (bare) w.push(`${bare} l\xEDnh ch\u01B0a c\xF3 v\u0169 kh\xED, \u0111\xE1nh b\u1EB1ng tay kh\xF4ng.`);
  if (unarmored && count > 1) w.push(`${unarmored} l\xEDnh ch\u01B0a c\xF3 gi\xE1p.`);
  if (hurt2) w.push(`${hurt2} l\xEDnh \u0111ang b\u1ECB th\u01B0\u01A1ng n\u1EB7ng.`);
  if (count && morale / count < 50) w.push("Tinh th\u1EA7n qu\xE2n th\u1EA5p, d\u1EC5 b\u1ECF ch\u1EA1y gi\u1EEFa tr\u1EADn.");
  const home = sim.villagers.filter((v) => v.job === "fight" && v.health > 0 && !plan2.missions.some((m) => sim.squadById(m.squad)?.ids.includes(v.id))).length;
  if (home < 3) w.push(`Ch\u1EC9 c\xF2n ${home} l\xEDnh gi\u1EEF l\xE0ng: n\u1EBFu \u0111\u1ECBch \u0111\xE1nh v\xE0o l\xFAc n\xE0y th\xEC kh\xF3 ch\u1ED1ng.`);
  if (sim.resting) w.push("\u0110ang ban \u0111\xEAm: qu\xE2n \u0111i ch\u1EADm v\xE0 nh\xECn k\xE9m.");
  if (sim.weather !== "clear") w.push("Th\u1EDDi ti\u1EBFt x\u1EA5u: qu\xE2n \u0111i ch\u1EADm h\u01A1n.");
  if (level < 3) w.push(`B\u1EA3n \u0111\u1ED3 c\u1EA5p ${level}: ${level === 1 ? "ch\u01B0a bi\u1EBFt \u0111\u1ECBch c\xF3 l\xEDnh hay c\xF4ng tr\xECnh ph\xF2ng th\u1EE7 n\xE0o" : "ch\u01B0a bi\u1EBFt \u0111\u1ECBch c\xF3 bao nhi\xEAu l\xEDnh v\xE0 thu\u1ED9c binh ch\u1EE7ng n\xE0o"}, n\xEAn d\u1EF1 b\xE1o c\xF2n thi\u1EBFu ch\u1EAFc ch\u1EAFn.`);
  out.win = [`Th\u1EAFng khi ${t.def.name} h\u1EBFt l\xEDnh, l\u1EEDa c\u1EE7a h\u1ECD t\u1EAFt v\xE0 m\u1ECDi c\xF4ng tr\xECnh s\u1EADp; khi \u0111\xF3 d\xE2n c\u1EE7a h\u1ECD xin h\xE0ng.`, "Ta l\u1EA5y \u0111\u01B0\u1EE3c nh\u1EEFng g\xEC c\xF2n trong kho l\u01B0\u01A1ng c\u1EE7a h\u1ECD.", `D\u1EF1 ki\u1EBFn ta m\u1EA5t kho\u1EA3ng ${pct(lossIfWin)} s\u1ED1 l\xEDnh \u0111\xE3 d\xE0n tr\u1EADn.`];
  out.lose = ["Thua khi qu\xE2n ta h\u1EBFt l\xEDnh ho\u1EB7c r\xFAt lui.", `Ph\u1EA7n l\u1EDBn l\xEDnh ra tr\u1EADn c\xF3 th\u1EC3 g\u1EE5c; l\xEDnh ch\u1EBFt l\xE0 m\u1EA5t h\u1EB3n, c\xF9ng v\u0169 kh\xED v\xE0 gi\xE1p mang theo.`, "Tinh th\u1EA7n d\xE2n gi\u1EA3m; k\u1EBB \u0111\u1ECBch b\u1ECB ch\u1ECDc gi\u1EADn n\xEAn c\xF3 th\u1EC3 k\xE9o \u0111\u1EBFn tr\u1EA3 \u0111\u0169a.", "R\xFAt k\u1ECBp th\xEC c\u1EE9u \u0111\u01B0\u1EE3c nh\u1EEFng ng\u01B0\u1EDDi c\xF2n l\u1EA1i, nh\u01B0ng chi\u1EBFn l\u1EE3i ph\u1EA9m th\xEC kh\xF4ng c\xF3."];
  out.verdict = out.chance >= 0.8 ? "R\u1EA5t c\xF3 l\u1EE3i" : out.chance >= 0.6 ? "C\xF3 l\u1EE3i" : out.chance >= 0.4 ? "C\xE2n b\u1EB1ng" : out.chance >= 0.2 ? "B\u1EA5t l\u1EE3i" : "R\u1EA5t b\u1EA5t l\u1EE3i";
  const L = out.lines;
  L.push(`Qu\xE2n ta: ${count} l\xEDnh trong ${perSquad.length} \u0111\u1ED9i${arms.archer || arms.cavalry ? ` (${arms.foot} b\u1ED9 binh, ${arms.archer} b\u1EAFn xa, ${arms.cavalry} k\u1EF5)` : ""}.`);
  if (level === 1) {
    L.push(`L\xE0ng ${t.def.name} c\xF3 kho\u1EA3ng ${intel.population} ng\u01B0\u1EDDi; \u01B0\u1EDBc ch\u1EEBng ${men} c\xF3 th\u1EC3 c\u1EA7m v\u0169 kh\xED.`);
    L.push("Ch\u01B0a r\xF5 v\u0169 kh\xED, c\xF4ng tr\xECnh ph\xF2ng th\u1EE7 hay th\u1EE7 l\u0129nh: c\u1EA7n b\u1EA3n \u0111\u1ED3 c\u1EA5p 2 v\xE0 3 \u0111\u1EC3 bi\u1EBFt th\xEAm.");
  } else {
    L.push(`L\xE0ng ${t.def.name}: kho\u1EA3ng ${intel.population} ng\u01B0\u1EDDi${level >= 3 ? `, trong \u0111\xF3 ${men} l\xEDnh` : `, \u01B0\u1EDBc ch\u1EEBng ${men} c\xF3 th\u1EC3 c\u1EA7m v\u0169 kh\xED`}.`);
    L.push(works > 1 ? `Ph\xF2ng th\u1EE7: ${towers} ch\xF2i canh, ${fences} \u0111o\u1EA1n r\xE0o, ${gates} c\u1ED5ng (t\u0103ng kho\u1EA3ng ${pct(works - 1)} s\u1EE9c \u0111\u1ECBch).` : "Ch\u01B0a th\u1EA5y c\xF4ng tr\xECnh ph\xF2ng th\u1EE7 n\xE0o.");
  }
  if (level >= 3 && soldiers) {
    L.push(`L\xEDnh \u0111\u1ECBch: ${soldiers.foot} b\u1ED9 binh, ${soldiers.archer} cung th\u1EE7, ${soldiers.cavalry} k\u1EF5 th\xFA${chief > 1 ? "; c\xF3 th\u1EE7 l\u0129nh \u0111i c\xF9ng" : ""}.`);
    L.push(match > 1.05 ? "Binh ch\u1EE7ng c\u1EE7a ta kh\u1EAFc binh ch\u1EE7ng \u0111\u1ECBch." : match < 0.95 ? "Binh ch\u1EE7ng \u0111\u1ECBch kh\u1EAFc qu\xE2n ta: n\xEAn \u0111\u1ED5i \u0111\u1ED9i h\xECnh." : "Binh ch\u1EE7ng hai b\xEAn ngang nhau.");
    L.push(`S\u1EE9c m\u1EA1nh quy \u0111\u1ED5i: ta ${Math.round(ours)} so v\u1EDBi \u0111\u1ECBch ${Math.round(theirs)}.`);
    for (const q of perSquad) L.push(`${q.name}: ${q.n} l\xEDnh, \u0111\xF3ng g\xF3p ${ours > 0 ? pct(q.worth * match / ours) : "0%"} s\u1EE9c m\u1EA1nh c\u1EE7a ta.`);
  }
  if (level >= 2) for (const m of plan2.missions) {
    const s = sim.squadById(m.squad), start = s ? sim.missionStart(m) : null;
    if (!s || !start || !m.path.length) continue;
    const r = sim.routeTime(s, start, m.path);
    L.push(`${s.name} \u0111i ${Math.round(r.length)} \xF4, m\u1EA5t kho\u1EA3ng ${Math.max(1, Math.round(r.total / 60))} ph\xFAt${r.hits.some((o) => o && o.kind !== "enemy") ? ", c\xF3 \u0111o\u1EA1n v\u01B0\u1EDBng v\u1EADt c\u1EA3n c\u1EA7n ph\xE1 ho\u1EB7c u\u1ED1n tr\xE1nh" : ""}.`);
  }
  return out;
}

// src/sim/siege.ts
var NODE_NAME = { tree: "c\xE2y", rock: "\u0111\xE1", bush: "b\u1EE5i qu\u1EA3" };
var PROP_NAME = { fire: "\u0110\u1ED1ng l\u1EEDa", pile: "Kho l\u01B0\u01A1ng", tower: "Ch\xF2i canh", fence: "H\xE0ng r\xE0o", gate: "C\u1ED5ng" };
var propHp = (kind) => SIEGE.propHp[kind] ?? 60;
function propOnTile(sim, x, y) {
  for (const tribe of sim.tribes) for (const prop of tribe.props) if (x >= prop.x && x < prop.x + prop.w && y >= prop.y && y < prop.y + prop.h) return { tribe, prop };
  return void 0;
}
function obstacleAt(sim, x, y) {
  const w = sim.world, N = w.size;
  if (!w.inBounds(x, y)) return { kind: "wall", x, y, label: "r\xECa b\u1EA3n \u0111\u1ED3", clear: false };
  const node = w.nodeAt(x, y);
  if (node) return { kind: node.kind, x, y, label: NODE_NAME[node.kind], clear: true };
  const t = w.at(x, y);
  if (t === Tile.Water) return { kind: "water", x, y, label: "n\u01B0\u1EDBc", clear: false };
  if (w.occ[y * N + x]) {
    const found = propOnTile(sim, x, y);
    if (found) return { kind: "enemy", x: found.prop.x, y: found.prop.y, label: PROP_NAME[found.prop.kind] ?? "c\xF4ng tr\xECnh", clear: true, tribe: found.tribe.id };
    const b = sim.buildingAt(x, y);
    return b ? { kind: "ours", x, y, label: "c\xF4ng tr\xECnh c\u1EE7a l\xE0ng", clear: false } : { kind: "wall", x, y, label: "v\u1EADt c\u1EA3n", clear: false };
  }
  if (t !== Tile.Grass && t !== Tile.Mud) return { kind: "wall", x, y, label: "v\u1EADt c\u1EA3n", clear: false };
  return null;
}
function firstBlock(sim, from, to, reach = Infinity, skip) {
  const d = Math.hypot(to.x - from.x, to.y - from.y), n = Math.ceil(Math.min(d, reach) * 2), sx = Math.floor(from.x), sy = Math.floor(from.y);
  for (let i = 1; i <= n; i++) {
    const f = Math.min(d, reach) / d * (i / n) || 0, x = Math.floor(from.x + (to.x - from.x) * f), y = Math.floor(from.y + (to.y - from.y) * f);
    if (x === sx && y === sy) continue;
    const o = obstacleAt(sim, x, y);
    if (o && !(skip && skip(o))) return o;
  }
  return null;
}
function pathHits(sim, start, pts, target) {
  const skip = (o) => o.kind === "enemy" && !!target && Math.abs(o.x - target.x) < 3 && Math.abs(o.y - target.y) < 3;
  let at = start;
  return pts.map((p) => {
    const o = firstBlock(sim, at, p, Infinity, skip);
    at = p;
    return o;
  });
}
function corridorBlocks(sim, start, pts, target) {
  const out = /* @__PURE__ */ new Map(), N = sim.world.size;
  let at = start;
  for (const p of pts) {
    const d = Math.hypot(p.x - at.x, p.y - at.y), n = Math.max(1, Math.ceil(d * 2));
    for (let i = 0; i <= n; i++) {
      const cx = Math.floor(at.x + (p.x - at.x) * i / n), cy = Math.floor(at.y + (p.y - at.y) * i / n);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const o = obstacleAt(sim, cx + dx, cy + dy);
        if (o && o.clear && o.kind !== "enemy" && !(target && Math.hypot(o.x - target.x, o.y - target.y) < 2)) out.set(o.y * N + o.x, o);
      }
    }
    at = p;
  }
  return [...out.values()];
}
function lineSteps(sim, from, to) {
  const out = [], d = Math.hypot(to.x - from.x, to.y - from.y), n = Math.ceil(d * 2);
  let lx = Math.floor(from.x), ly = Math.floor(from.y);
  for (let i = 1; i <= n; i++) {
    const x = Math.floor(from.x + (to.x - from.x) * i / n), y = Math.floor(from.y + (to.y - from.y) * i / n);
    if (x === lx && y === ly) continue;
    if (sim.world.isBlocked(x, y)) break;
    out.push([x, y]);
    lx = x;
    ly = y;
  }
  return out;
}
function breakBox(sim, b) {
  if (b.kind === "node") return sim.world.nodeAt(b.x, b.y) ? { x: b.x, y: b.y, w: 1, h: 1 } : null;
  const p = sim.tribes.find((t) => t.id === b.tribe)?.props.find((q) => q.x === b.x && q.y === b.y);
  return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
}
function startBreaking(sim, v, ob, home) {
  if (v.job !== "fight" || v.down > 0 || !ob.clear) return false;
  sim.resetTask(v);
  sim.clearCombat(v);
  if (home) {
    v.fight.mode = "guard";
    v.fight.anchor = { x: home.x, y: home.y };
  }
  v.breaks = ob.kind === "enemy" ? { kind: "prop", x: ob.x, y: ob.y, tribe: ob.tribe } : { kind: "node", x: ob.x, y: ob.y };
  v.progress = 0;
  return true;
}
function stopBreaking(v) {
  v.breaks = null;
  v.progress = 0;
  if (v.phase === "fight" || v.phase === "move") {
    v.phase = "idle";
    v.path = [];
  }
}
function clearNode(sim, x, y) {
  const w = sim.world, i = y * w.size + x, n = w.nodes.get(i);
  if (!n) return;
  for (const o of sim.villagers) {
    if (o.breaks?.kind === "node" && o.breaks.x === x && o.breaks.y === y) stopBreaking(o);
    else if (o.target === i && (o.phase === "goNode" || o.phase === "work")) sim.resetTask(o);
  }
  w.nodes.delete(i);
  w.tiles[i] = Tile.Grass;
  if (n.kind === "tree") w.decor[i] = 1;
}
function damageProp(sim, tribeId, x, y, dmg) {
  const t = sim.tribes.find((q) => q.id === tribeId), i = t ? t.props.findIndex((q) => q.x === x && q.y === y) : -1;
  if (!t || i < 0) return;
  const p = t.props[i];
  p.hp = (p.hp ?? propHp(p.kind)) - dmg;
  t.angryUntil = Math.max(t.angryUntil, sim.time + 120);
  if (p.hp > 0) return;
  t.props.splice(i, 1);
  const N = sim.world.size;
  for (let j = 0; j < p.h; j++) for (let k = 0; k < p.w; k++) sim.world.occ[(p.y + j) * N + p.x + k] = 0;
  sim.say(`${PROP_NAME[p.kind] ?? "C\xF4ng tr\xECnh"} c\u1EE7a ${t.def.name} \u0111\xE3 b\u1ECB ph\xE1.`);
  sim.noteBattle("note", `${PROP_NAME[p.kind] ?? "C\xF4ng tr\xECnh"} c\u1EE7a ${t.def.name} b\u1ECB ph\xE1.`);
  sim.noteBattle("breach");
}
function breakBrain(sim, v, dt) {
  const b = v.breaks;
  if (!b) return false;
  const box = breakBox(sim, b);
  if (!box) {
    stopBreaking(v);
    return false;
  }
  v.fight.scan -= dt;
  if (v.fight.scan <= 0) {
    v.fight.scan = 0.4;
    if (threatsOf(sim, v, 3.5).length) {
      stopBreaking(v);
      return false;
    }
  }
  const w = weaponOf(v), dx = Math.max(box.x - v.x, 0, v.x - (box.x + box.w)), dy = Math.max(box.y - v.y, 0, v.y - (box.y + box.h));
  if (Math.hypot(dx, dy) <= SIEGE.reach + (b.kind === "prop" && !w.ranged ? w.range * 0.5 : 0)) {
    v.path = [];
    v.slide = null;
    v.phase = "fight";
    v.facing = box.x + box.w / 2 >= v.x ? "right" : "left";
    if (!v.swing && v.atkCd <= 0) {
      const { hitAt, end } = swingTimes(w.anim);
      v.swing = { t: 0, hitAt, end, target: { kind: "unit", id: -1 } };
      v.atkCd = cycleOf(w.cycle, v.stats.agi);
      if (b.kind === "prop") damageProp(sim, b.tribe, b.x, b.y, (w.damage + (w.ranged ? 0 : RULES.strengthDamage * v.stats.str)) * (w.type === "slash" ? 1.5 : 1));
    }
    if (b.kind === "node") {
      const kind = sim.world.nodeAt(b.x, b.y).kind;
      v.progress += dt / SIEGE.clearSeconds[kind];
      let sum = 0;
      for (const o of sim.villagers) if (o.breaks?.kind === "node" && o.breaks.x === b.x && o.breaks.y === b.y) sum += o.progress;
      if (sum >= 1) clearNode(sim, b.x, b.y);
    }
    return true;
  }
  v.fight.repath -= dt;
  if (!v.path.length && v.fight.repath <= 0 && sim.pathLeft > 0) {
    sim.pathLeft--;
    v.fight.repath = 1;
    if (sim.routeTo(v, sim.ringTiles(v, box.x, box.y, box.w, box.h), 3) < 0) {
      stopBreaking(v);
      return false;
    }
  }
  v.phase = v.path.length ? "move" : "idle";
  return true;
}
function legSpots(sim, s, p) {
  const us = sim.squadUnits(s).sort((a, b) => (armOf(a) === "archer" ? 1 : 0) - (armOf(b) === "archer" ? 1 : 0) || a.id - b.id);
  const offs = formationOffsets(s.formation, us.length), out = /* @__PURE__ */ new Map(), N = sim.world.size;
  us.forEach((v, i) => {
    const [px, py] = placeOffset(offs[i], s.heading, p.x, p.y);
    out.set(v.id, { x: Math.min(N - 1, Math.max(0, Math.floor(px))) + 0.5, y: Math.min(N - 1, Math.max(0, Math.floor(py))) + 0.5 });
  });
  return out;
}
var aimSkip = (m) => (o) => o.kind === "enemy" && m.target?.kind === "prop" && Math.abs(o.x - m.target.x) < 3 && Math.abs(o.y - m.target.y) < 3;
function arrowMove(sim, s, m, p, mode) {
  const us = sim.squadUnits(s), c = sim.squadCenter(s);
  if (!us.length || !c) return null;
  if (Math.hypot(p.x - c.x, p.y - c.y) > 1) s.heading = Math.atan2(p.y - c.y, p.x - c.x);
  s.anchor = { x: p.x, y: p.y };
  const spots = legSpots(sim, s, p), skip = aimSkip(m);
  let block = null;
  for (const v of us) {
    const spot = spots.get(v.id);
    v.speed = (1.6 + 0.1 * v.stats.agi) * FORMATIONS[s.formation].speed;
    sim.orderAttackMove([v.id], spot.x, spot.y);
    v.fight.strict = true;
    if (mode === "hold") v.fight.anchor = { x: spot.x, y: spot.y };
    if (mode === "move") {
      v.fight.mode = "guard";
      v.fight.dest = null;
      v.fight.anchor = { x: spot.x, y: spot.y };
    }
    v.path = lineSteps(sim, v, spot);
    v.phase = v.path.length ? "move" : "idle";
    block ??= firstBlock(sim, v, spot, SIEGE.lookAhead, skip);
  }
  return block;
}
function haltSquad(sim, m, s, ob) {
  m.state = "blocked";
  m.block = { ...ob, since: sim.time };
  const us = sim.squadUnits(s);
  sim.orderHold(us.map((v) => v.id));
  if (ob.kind === "enemy") for (const v of us) startBreaking(sim, v, ob);
  sim.say(ob.clear ? `${s.name} kh\xF4ng th\u1EC3 \u0111i ti\u1EBFp: v\u01B0\u1EDBng ${ob.label}.` : `${s.name} kh\xF4ng th\u1EC3 \u0111i ti\u1EBFp: v\u01B0\u1EDBng ${ob.label}, kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c.`);
  sim.noteBattle("note", `${s.name} b\u1ECB ch\u1EB7n b\u1EDFi ${ob.label}.`);
}
function watchMarch(sim, m, s) {
  const p = m.path[Math.min(m.leg, m.path.length - 1)];
  if (!p) return false;
  const spots = legSpots(sim, s, p), skip = aimSkip(m);
  for (const v of sim.squadUnits(s)) {
    const spot = spots.get(v.id);
    if (v.breaks || v.phase === "fight" || v.down > 0) continue;
    const ob = firstBlock(sim, v, spot, SIEGE.lookAhead, skip);
    if (ob) {
      haltSquad(sim, m, s, ob);
      return true;
    }
    if (!v.path.length && Math.hypot(spot.x - v.x, spot.y - v.y) > 1.5) {
      v.path = lineSteps(sim, v, spot);
      v.phase = v.path.length ? "move" : "idle";
    }
  }
  return false;
}
function blockCleared(sim, m) {
  const b = m.block;
  if (!b) return true;
  if (b.kind === "enemy") return !propOnTile(sim, b.x, b.y);
  const now = obstacleAt(sim, b.x, b.y);
  return !now || now.kind !== b.kind;
}
function breakBlock(sim, plan2, squadId, n) {
  const m = plan2.missions.find((x) => x.squad === squadId), s = sim.squadById(squadId);
  if (plan2.status !== "running" || !m || !s) return "\u0110\u1ED9i n\xE0y kh\xF4ng \u1EDF trong tr\u1EADn";
  if (m.state !== "blocked" || !m.block) return `${s.name} kh\xF4ng b\u1ECB ch\u1EB7n`;
  if (!m.block.clear) return `Kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c ${m.block.label}: h\xE3y r\xFAt ho\u1EB7c \u0111i \u0111\u01B0\u1EDDng kh\xE1c`;
  const ob = { ...m.block }, us = sim.squadUnits(s).filter((v) => !v.breaks).sort((a, b) => Math.hypot(a.x - ob.x, a.y - ob.y) - Math.hypot(b.x - ob.x, b.y - ob.y));
  let sent = 0;
  for (const v of us.slice(0, Math.max(1, Math.min(Math.round(n), us.length)))) if (startBreaking(sim, v, ob)) sent++;
  if (!sent) return "Kh\xF4ng c\xF2n ai \u0111\u1EC3 c\u1EED \u0111i ph\xE1";
  sim.say(`${sent} l\xEDnh ${s.name} \u0111i ph\xE1 ${ob.label}.`);
  return null;
}
function targetNow(sim, plan2, m) {
  const tg = m.target, t = sim.tribes.find((q) => q.id === plan2.tribe);
  if (!tg || !t) return null;
  if (tg.kind === "prop") {
    const p = t.props.find((q) => q.x === tg.x && q.y === tg.y);
    return p ? { state: "live", prop: { x: p.x, y: p.y, tribe: t.id }, x: p.x + p.w / 2, y: p.y + p.h / 2 } : { state: "gone" };
  }
  const alive = t.unitIds.map((id) => sim.get(id)).filter((u) => !!u && u.health > 0);
  const pool = tg.leader ? alive.filter((u) => u.id === t.leaderId) : alive.filter((u) => u.ai?.role !== "civ");
  if (!pool.length) return tg.leader || !alive.length ? { state: "gone" } : { state: "moved" };
  const best = pool.slice().sort((a, b) => Math.hypot(a.x - tg.x, a.y - tg.y) - Math.hypot(b.x - tg.x, b.y - tg.y))[0];
  return Math.hypot(best.x - tg.x, best.y - tg.y) <= SIEGE.driftMax ? { state: "live", unit: best.id, x: best.x, y: best.y } : { state: "moved" };
}
var idle = (v) => !v.breaks && !v.fight.target && v.phase !== "fight" && v.phase !== "flee" && v.down <= 0;
function rampage(sim, plan2, s) {
  const t = sim.tribes.find((q) => q.id === plan2.tribe);
  if (!t) return;
  const foes = t.unitIds.map((id) => sim.get(id)).filter((u) => !!u && u.health > 0 && u.ai?.role !== "civ");
  for (const v of sim.squadUnits(s)) {
    if (!idle(v)) continue;
    const near2 = foes.slice().sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
    if (near2) {
      sim.orderAttack([v.id], { kind: "unit", id: near2.id });
      continue;
    }
    const p = t.props.slice().sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
    if (p) startBreaking(sim, v, { kind: "enemy", x: p.x, y: p.y, label: p.kind, clear: true, tribe: t.id });
  }
}
function around(sim, plan2, s) {
  const t = sim.tribes.find((q) => q.id === plan2.tribe);
  if (!t) return;
  for (const v of sim.squadUnits(s)) {
    if (!idle(v)) continue;
    const p = t.props.find((q) => Math.hypot(q.x + q.w / 2 - v.x, q.y + q.h / 2 - v.y) < 5);
    if (p) startBreaking(sim, v, { kind: "enemy", x: p.x, y: p.y, label: p.kind, clear: true, tribe: t.id }, v.fight.anchor ?? { x: v.x, y: v.y });
  }
}
function tickTarget(sim, plan2, m, s) {
  if (!m.target || m.stance === "evade" || m.stance === "hold") return false;
  const ts = targetNow(sim, plan2, m);
  if (!ts) return false;
  if (m.state === "march" && ts.state !== "gone") return true;
  if (m.state === "march") m.state = "engaged";
  if (ts.state === "gone") {
    rampage(sim, plan2, s);
    return true;
  }
  if (ts.state === "moved") {
    const end = m.path[m.path.length - 1];
    if (end && (!s.anchor || Math.hypot(s.anchor.x - end.x, s.anchor.y - end.y) > 1)) sim.squadMove(s, end.x, end.y, "hold");
    around(sim, plan2, s);
    return true;
  }
  for (const v of sim.squadUnits(s)) {
    if (!idle(v)) continue;
    if (ts.prop) startBreaking(sim, v, { kind: "enemy", x: ts.prop.x, y: ts.prop.y, label: "c\xF4ng tr\xECnh", clear: true, tribe: ts.prop.tribe });
    else if (ts.unit !== void 0) sim.orderAttack([v.id], { kind: "unit", id: ts.unit });
  }
  return true;
}

// src/sim/simwar.ts
var WAR = {
  /** → army.squadLimit */
  squadLimit() {
    return squadLimit(this);
  },
  /** → army.cardLimit */
  cardLimit() {
    return cardLimit(this);
  },
  /** → army.createSquad */
  createSquad(name) {
    return createSquad(this, name);
  },
  /** → army.joinSquad */
  joinSquad(ids, squadId) {
    return joinSquad(this, ids, squadId);
  },
  /** → army.leaveSquad */
  leaveSquad(ids) {
    return leaveSquad(this, ids);
  },
  /** → army.disbandSquad */
  disbandSquad(id) {
    return disbandSquad(this, id);
  },
  /** → army.setCommander */
  setCommander(squadId, vid) {
    return setCommander(this, squadId, vid);
  },
  /** → army.setFormation */
  setFormation(squadId, f) {
    return setFormation(this, squadId, f);
  },
  /** → army.formationOpen */
  formationOpen(f) {
    return formationOpen(this, f);
  },
  /** → army.squadMove */
  squadMove(s, x, y, mode, heading) {
    return squadMove(this, s, x, y, mode, heading);
  },
  /** → army.squadUnits */
  squadUnits(s) {
    return squadUnits(this, s);
  },
  /** → army.squadCenter */
  squadCenter(s) {
    return squadCenter(this, s);
  },
  /** → army.squadById */
  squadById(id) {
    return squadById(this, id);
  },
  /** → army.trainSquad */
  trainSquad(squadId, on) {
    return trainSquad(this, squadId, on);
  },
  /** → army.attackFactor */
  attackFactor(v, e) {
    return attackFactor(this, v, e);
  },
  /** → army.takenFactor */
  takenFactor(v, ranged) {
    return takenFactor(this, v, ranged);
  },
  /** → army.clusters */
  clusters() {
    return clusters(this);
  },
  /** → army.drawnFigures */
  drawnFigures() {
    return drawnFigures(this);
  },
  /** → army.noteBattle */
  noteBattle(kind, text = "") {
    return noteBattle(this, kind, text);
  },
  /** → battle.armOf */
  armOf(v) {
    return armOf(v);
  },
  /** → scouting.mapLevel */
  mapLevel(tribe) {
    return mapLevel(this, tribe);
  },
  /** → scouting.mapAccuracy */
  mapAccuracy(m) {
    return mapAccuracy(this, m);
  },
  /** → scouting.tribeIntel */
  tribeIntel(tribe) {
    return tribeIntel(this, tribe);
  },
  /** → warplan.objectivePos */
  missionTarget(plan2, m) {
    return objectivePos(this, plan2, m);
  },
  /** → scouting.startScout */
  startScout(ids, tribe) {
    return startScout(this, ids, tribe);
  },
  /** → scouting.planScout */
  planScout(ids, tribe) {
    return planScout(this, ids, tribe);
  },
  /** → scouting.scoutLevel */
  scoutLevel() {
    return scoutLevel(this);
  },
  /** → scouting.scoutLimit */
  scoutLimit() {
    return scoutLimit(this);
  },
  /** → scouting.scoutSkill */
  scoutSkill(v) {
    return scoutSkill(v);
  },
  /** → scouting.canScout */
  canScout(v) {
    return canScout(this, v);
  },
  /** → scouting.enlistScouts */
  enlistScouts(ids) {
    return enlistScouts(this, ids);
  },
  /** → scouting.dismissScouts */
  dismissScouts(ids) {
    return dismissScouts(this, ids);
  },
  /** → scouting.scoutRoster */
  scoutRoster() {
    return scoutRoster(this);
  },
  /** → scouting.isFound */
  isFound(tribe) {
    return isFound(this, tribe);
  },
  /** → scouting.whereIs */
  whereIs(tribe) {
    return whereIs(this, tribe);
  },
  /** → scouting.scoutsNeeded */
  scoutsNeeded(tribe, level) {
    return scoutsNeeded(this, tribe, level);
  },
  /** → warplan.newPlan */
  newPlan(kind, tribe) {
    return newPlan(this, kind, tribe);
  },
  /** → warplan.addMission */
  addMission(plan2, squadId, withdrawAt) {
    return addMission(this, plan2, squadId, withdrawAt);
  },
  /** → warplan.removeMission */
  removeMission(plan2, squadId) {
    return removeMission(plan2, squadId);
  },
  /** → warplan.deploySquad */
  deploySquad(plan2, squadId, kind, cells, heading, o, p) {
    return deploySquad(this, plan2, squadId, kind, cells, heading, o, p);
  },
  /** → warplan.setMissionPath */
  setMissionPath(plan2, squadId, pts, retreat) {
    return setMissionPath(this, plan2, squadId, pts, retreat);
  },
  /** → warplan.squadPace */
  squadPace(s) {
    return squadPace(this, s);
  },
  /** → warplan.routeTime */
  routeTime(s, from, pts, target) {
    return routeTime(this, s, from, pts, target);
  },
  /** → warplan.missionStart */
  missionStart(m, toward) {
    return missionStart(this, m, toward);
  },
  /** → warplan.addCard */
  addCard(plan2, kind, squadId, arg) {
    return addCard(this, plan2, kind, squadId, arg);
  },
  /** → warplan.removeCard */
  removeCard(plan2, cardId) {
    return removeCard(plan2, cardId);
  },
  /** → warplan.reviewPlan */
  reviewPlan(plan2) {
    return reviewPlan(this, plan2);
  },
  /** → warplan.startPlan */
  startPlan(plan2) {
    return startPlan(this, plan2);
  },
  /** → warplan.playCard */
  playCard(plan2, cardId) {
    return playCard(this, plan2, cardId);
  },
  /** → warplan.engagePlan */
  engagePlan(plan2) {
    return engagePlan(this, plan2);
  },
  /** → warplan.withdrawPlan */
  withdrawPlan(plan2) {
    return withdrawPlan(this, plan2);
  },
  /** → forecast.forecastPlan */
  forecastPlan(plan2) {
    return forecastPlan(this, plan2);
  },
  /** → warplan.soundAlarm */
  soundAlarm() {
    return soundAlarm(this);
  },
  /** → siege.obstacleAt */
  obstacleAt(x, y) {
    return obstacleAt(this, x, y);
  },
  /** → siege.pathHits */
  pathHits(start, pts, target) {
    return pathHits(this, start, pts, target);
  },
  /** → siege.lineSteps */
  lineSteps(from, x, y) {
    return lineSteps(this, from, { x, y });
  },
  /** → siege.startBreaking */
  startBreaking(v, ob, home) {
    return startBreaking(this, v, ob, home);
  },
  /** → siege.breakBrain */
  breakBrain(v, dt) {
    return breakBrain(this, v, dt);
  },
  /** → siege.arrowMove */
  arrowMove(s, m, p, mode) {
    return arrowMove(this, s, m, p, mode);
  },
  /** → siege.haltSquad */
  haltSquad(m, s, ob) {
    return haltSquad(this, m, s, ob);
  },
  /** → siege.watchMarch */
  watchMarch(m, s) {
    return watchMarch(this, m, s);
  },
  /** → siege.blockCleared */
  blockCleared(m) {
    return blockCleared(this, m);
  },
  /** → siege.breakBlock */
  breakBlock(plan2, squadId, n) {
    return breakBlock(this, plan2, squadId, n);
  },
  /** → siege.targetNow */
  targetNow(plan2, m) {
    return targetNow(this, plan2, m);
  },
  /** → siege.tickTarget */
  tickTarget(plan2, m, s) {
    return tickTarget(this, plan2, m, s);
  },
  /** → warplan.setMissionTarget */
  setMissionTarget(plan2, squadId, target) {
    return setMissionTarget(this, plan2, squadId, target);
  },
  /** The village of `id` has lost the war: its people give up and ask for mercy (take them in, or make them pay tribute). */
  conquer(id, why) {
    const t = tribeOf(this, id);
    if (t && t.state === "free") surrender(this, t, why);
  },
  /** → siege.corridorBlocks */
  corridorBlocks(start, pts, target) {
    return corridorBlocks(this, start, pts, target);
  },
  /** → warplan.cancelPlan */
  cancelPlan(plan2) {
    return cancelPlan(this, plan2);
  },
  /** → warplan.isLogistics */
  isLogistics(plan2, m) {
    return isLogistics(plan2, m);
  },
  /** → environment.sightOf */
  sightOf(v) {
    return sightOf(this, v);
  },
  /** → warplan.canTarget */
  canTarget(objective, tribe) {
    return canTarget(this, objective, tribe);
  }
};

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
    /** Who stands in which cell of the map this tick, for finding enemies near a unit (see battle.ts). Rebuilt every tick, never saved. */
    /** Searches for a way that may still be made this tick: a large army given an order at once would otherwise stall the game for a moment. Refilled every tick, never saved. */
    this.pathLeft = 0;
    this.threatCache = null;
    this.tribes = [];
    /** Scheduled wolf packs and tribal raids. */
    this.events = [];
    this.nextRaid = 0;
    this.animals = [];
    this.animalById = /* @__PURE__ */ new Map();
    this.projectiles = [];
    /** War: squads, what the scouts have learnt, scouting trips, battle plans, the alarm and the fight that is on. */
    this.squads = [];
    this.nextSquad = 1;
    this.maps = [];
    this.scouts = [];
    /** Villages found by anyone who wandered near them (see Sighting). */
    this.sightings = [];
    this.nextMission = 1;
    this.plans = [];
    this.nextPlan = 1;
    /** Game seconds until which the alarm drum is sounding (0 = quiet). */
    this.alarmUntil = 0;
    this.battle = { on: false, since: 0, quiet: 0, ourDead: 0, foeDead: 0, breaches: 0, shots: 0, notes: [] };
    /** The summaries of past fights, newest last. */
    this.battleReports = [];
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
    this.say("Hai ng\u01B0\u1EDDi \u0111\u1EA7u ti\xEAn \u0111\xE3 \u0111\u1EBFn b\xEAn \u0111\u1ED1ng l\u1EEDa: m\u1ED9t ng\u01B0\u1EDDi h\xE1i l\u01B0\u1EE3m, m\u1ED9t ng\u01B0\u1EDDi \u0111\u1ED1n g\u1ED7. Vi\u1EC7c c\u1EE7a m\u1ED7i ng\u01B0\u1EDDi do c\xF4ng tr\xECnh c\u1EE7a ngh\u1EC1 \u0111\xF3 qu\u1EA3n l\xFD: m\u1EDF N\xF4ng tr\u1EA1i, X\u01B0\u1EDFng g\u1ED7 hay X\u01B0\u1EDFng \u0111\xE1 c\u1EA1nh \u0111\u1ED1ng l\u1EEDa \u0111\u1EC3 giao vi\u1EC7c. D\u1EF1ng Nh\xE0 th\u1EE3 x\xE2y tr\u01B0\u1EDBc, r\u1ED3i c\xE1c c\xF4ng tr\xECnh kh\xE1c.");
    this.refreshFog();
    placeStarters(this);
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
  /** → roles.warLock */
  warLock() {
    return warLock(this);
  }
  /** → roles.assignRole */
  assignRole(ids, role) {
    return assignRole(this, ids, role);
  }
  /** → roles.releaseRole */
  releaseRole(ids) {
    return releaseRole(this, ids);
  }
  /** → roles.roleCapacity */
  roleCapacity(role) {
    return roleCapacity(this, role);
  }
  /** → roles.roleCount */
  roleCount(role) {
    return roleCount(this, role);
  }
  /** → roles.trimRoles */
  trimRoles() {
    return trimRoles(this);
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
  /** → construction.buildingLimit */
  buildingLimit(kind) {
    return buildingLimit(this, kind);
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
  /** → labor.tickFarms */
  tickFarms(dt) {
    return tickFarms(this, dt);
  }
  /** → works.tickWorks */
  tickWorks(dt) {
    return tickWorks(this, dt);
  }
  /** → houses.bestFor */
  bestFor(job) {
    return bestFor(this, job);
  }
  /** → defense.tickTraps */
  tickTraps(dt) {
    return tickTraps(this, dt);
  }
  /** → defense.tickTowers */
  tickTowers(dt) {
    return tickTowers(this, dt);
  }
  /** → defense.toggleGate */
  toggleGate(id) {
    return toggleGate(this, id);
  }
  /** → defense.setGates */
  setGates(open) {
    return setGates(this, open);
  }
  /** → defense.nearestWork */
  nearestWork(x, y, radius, any = false) {
    return nearestWork(this, x, y, radius, any);
  }
  /** → defense.damageWork */
  damageWork(b, dmg) {
    return damageWork(this, b, dmg);
  }
  /** → defense.towerBonus */
  towerBonus(v) {
    return towerBonus(this, v);
  }
  /** → defense.garrison */
  garrison(b) {
    return garrison(this, b);
  }
  /** → defense.assignTower */
  assignTower(ids, towerId) {
    return assignTower(this, ids, towerId);
  }
  /** → defense.leaveTower */
  leaveTower(ids) {
    return leaveTower(this, ids);
  }
  /** → construction.destroyBuilding */
  destroyBuilding(b) {
    return destroyBuilding(this, b);
  }
  /** → construction.setOcc */
  setOcc(b, val) {
    return setOcc(this, b, val);
  }
  /** → houses.assignField */
  assignField(ids, fieldId) {
    return assignField(this, ids, fieldId);
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
    this.pathLeft = PATH_BUDGET;
    this.tickCalendar();
    this.world.tick(dt);
    this.syncFood();
    tickAnimals(this, dt);
    tickProjectiles(this, dt);
    for (const v of [...this.villagers]) this.tickVillager(v, dt);
    this.tickWorks(dt);
    this.tickFarms(dt);
    this.tickTowers(dt);
    this.tickTraps(dt);
    tickTraining(this, dt);
    tickBattle(this, dt);
    tickScouts(this, dt);
    tickPlans(this, dt);
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
  /** → inventory.wearGear */
  wearGear(v, slot) {
    return wearGear(this, v, slot);
  }
  /** → inventory.planGearRepair */
  planGearRepair(v) {
    return planGearRepair(this, v);
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
Object.assign(Sim.prototype, WAR);

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
