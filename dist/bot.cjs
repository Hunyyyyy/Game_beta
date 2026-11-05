"use strict";

// src/data/seasons.json
var seasons_default = {
  spring: { name: "Xu\xE2n", daylight: 0.6, work: 1, gather: 0.8, farm: 0.9, enter: "M\xF9a xu\xE2n \u0111\u1EBFn: b\u1EE5i c\xE2y ra hoa, v\xE0i h\xF4m n\u1EEFa s\u1EBD c\xF3 qu\u1EA3. Hay m\u01B0a." },
  summer: { name: "H\u1EA1", daylight: 0.6, work: 1.05, gather: 1.2, farm: 1.2, enter: "M\xF9a h\u1EA1: ng\xE0y d\xE0i h\u01A1n, qu\u1EA3 ch\xEDn nhi\u1EC1u. Coi ch\u1EEBng gi\xF4ng s\xE9t." },
  autumn: { name: "Thu", daylight: 0.6, work: 1, gather: 1.4, farm: 1.4, enter: "M\xF9a thu: qu\u1EA3 nhi\u1EC1u nh\u1EA5t n\u0103m. M\xF9a \u0111\xF4ng s\u1EAFp t\u1EDBi, h\xE3y chu\u1EA9n b\u1ECB." },
  winter: { name: "\u0110\xF4ng", daylight: 0.6, work: 0.8, gather: 0.5, bushLeft: 1, farm: 0.25, enter: "M\xF9a \u0111\xF4ng: qu\u1EA3 c\xF2n tr\xEAn b\u1EE5i nh\u01B0ng h\xE1i ch\u1EADm m\u1ED9t n\u1EEDa, ng\xE0y ng\u1EAFn l\u1EA1i. H\xE3y t\xEDch tr\u1EEF th\u1EE9c \u0103n." }
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
var dayInSeason = (day) => (day - 1) % SEASON_DAYS + 1;
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

// src/data/time.json
var time_default = {
  _note: "How long a day lasts in each era, in seconds of game (1 second of game = 1 real second at speed 1x). A day is 65% daylight and 35% night, dusk and dawn included. Everything that is 'per day' follows this length: eating and resting (rest.json dayCost, sleepDay...), hunting per day (pace.json huntPerDay), the pay of the day's work, the travel of a march in days, training in days, the days of the calendar (a season is 5 days, events.json) and the labour days of building, crafting and research (a day of labour is always one game day, so those take half the real time in a 10-minute day). What is counted in real seconds does not follow it: walking, fighting, and how long one bush or tree takes (pace.json gather), so balance those for the day length of the era. Stone age 600 (10 real minutes: 6 of day, 4 of night), medieval 1200 (20 real minutes: 12 of day, 8 of night).",
  dayLength: { stone: 600, ancient: 1200 }
};

// src/sim/constants.ts
var MAP_SIZE = 960;
var VISION = 7;
var NIGHT_VISION = 3;
var FIRE_VISION = 8;
var TICK = 1 / 20;
var PATH_BUDGET = 6;
var FOE_PATH_SHARE = 3;
var dayLength = (era) => time_default.dayLength[era];
var START_TIME = dayLength("stone") * 0.25;
var WORK_DAY = 240;
var paceWork = (len) => WORK_DAY / len;

// src/data/animals.json
var animals_default = {
  _note: "huntValue: how much a hunter wants each thing a beast gives (a hunter takes the prey that is worth the most for the way he has to go; what the village cannot take yet counts for nothing). huntHpCap: the health of the biggest beast a lodge of level 1, 2, 3 will send hunters after. zone = map ring 1..4 (each 24 tiles from the campfire). speed in tiles/s. flee: distance that makes it run. aggro: distance at which a predator starts hunting. herd: [min,max] group size. habitat water = lives in water tiles. Art lives in animals/bodies.json. drops: other materials the body gives when skinned (only feather is used now), on top of meat (becomes food) and hide. nearRadius/nearBoost: chunks whose centre is within nearRadius tiles of the campfire get nearBoost times the herds of prey that does not fight back (rabbit, fowl, deer, duck), so a new village has game to hunt. A species is just a key here plus an entry in bodies.json; the list below is in spawn order.",
  rabbit: { name: "Th\u1ECF", hp: 10, damage: 0, type: "pierce", cycle: 1, range: 1, speed: 2.2, flee: 6, aggro: 0, meat: 5, hide: 5, zones: [1, 2], herd: [1, 2], count: 36, prey: true, nocturnal: false },
  fowl: { name: "G\xE0 r\u1EEBng", hp: 10, damage: 0, type: "pierce", cycle: 1, range: 1, speed: 2, flee: 4, aggro: 0, meat: 5, hide: 2, zones: [1, 2], herd: [1, 3], count: 20, prey: true, nocturnal: false, drops: { feather: 10 } },
  deer: { name: "H\u01B0\u01A1u", hp: 60, damage: 4, type: "crush", cycle: 1.6, range: 1, speed: 2.6, flee: 5, aggro: 0, meat: 30, hide: 30, zones: [1, 3], herd: [3, 5], count: 18, prey: true, nocturnal: false, cornered: true, drops: { bone: 2 } },
  boar: { name: "L\u1EE3n r\u1EEBng", hp: 90, damage: 10, type: "pierce", cycle: 1.5, range: 1, speed: 2.1, flee: 0, aggro: 0, meat: 38, hide: 30, zones: [1, 3], herd: [1, 2], count: 8, prey: true, nocturnal: false, defends: true, drops: { bone: 2 } },
  wolf: { name: "S\xF3i", hp: 55, damage: 7, type: "slash", cycle: 1.2, range: 1, speed: 2.9, flee: 0, aggro: 9, meat: 8, hide: 9, zones: [2, 3], herd: [4, 6], count: 12, prey: false, nocturnal: true, drops: { bone: 2 } },
  fish: { name: "C\xE1", hp: 1, damage: 0, type: "pierce", cycle: 1, range: 1, speed: 1.1, flee: 3, aggro: 0, meat: 5, hide: 0, zones: [1, 3], herd: [3, 6], count: 36, prey: true, nocturnal: false, habitat: "water" },
  aurochs: { name: "B\xF2 r\u1EEBng", hp: 130, damage: 12, type: "crush", cycle: 1.8, range: 1, speed: 2, flee: 0, aggro: 0, meat: 68, hide: 60, zones: [1, 3], herd: [2, 4], count: 6, prey: true, nocturnal: false, defends: true, drops: { bone: 3 } },
  duck: { name: "V\u1ECBt tr\u1EDDi", hp: 8, damage: 0, type: "pierce", cycle: 1, range: 1, speed: 1.9, flee: 5, aggro: 0, meat: 5, hide: 0, drops: { feather: 10 }, zones: [1, 2], herd: [2, 4], count: 14, prey: true, nocturnal: false },
  fox: { name: "C\xE1o", hp: 25, damage: 4, type: "pierce", cycle: 1, range: 1, speed: 2.8, flee: 0, aggro: 4, meat: 4, hide: 5, zones: [2, 3], herd: [1, 1], count: 8, prey: false, nocturnal: true, fearsFire: 4 },
  ibex: { name: "D\xEA n\xFAi", hp: 50, damage: 5, type: "crush", cycle: 1.5, range: 1, speed: 3, flee: 9, aggro: 0, meat: 21, hide: 9, zones: [2, 4], herd: [3, 5], count: 10, prey: true, nocturnal: false, cornered: true, drops: { bone: 2 } },
  elk: { name: "Nai s\u1EEBng t\u1EA5m", hp: 160, damage: 10, type: "crush", cycle: 1.8, range: 1, speed: 2.4, flee: 0, aggro: 0, meat: 83, hide: 68, zones: [2, 3], herd: [1, 3], count: 6, prey: true, nocturnal: false, defends: true, drops: { bone: 4 } },
  bear: { name: "G\u1EA5u n\xE2u", hp: 240, damage: 20, type: "slash", cycle: 1.9, range: 1, speed: 2.2, flee: 0, aggro: 6, meat: 45, hide: 90, zones: [3, 4], herd: [1, 1], count: 4, prey: false, nocturnal: false, drops: { bone: 10 } },
  lion: { name: "S\u01B0 t\u1EED hang", hp: 130, damage: 16, type: "slash", cycle: 1.3, range: 1, speed: 3.3, flee: 0, aggro: 11, meat: 28, hide: 6, zones: [3, 4], herd: [1, 3], count: 5, prey: false, nocturnal: true, fearsFire: 6, drops: { bone: 3 } },
  mammoth: { name: "Voi ma m\xFAt", hp: 450, damage: 28, type: "crush", cycle: 2.6, range: 1, speed: 1.5, flee: 0, aggro: 0, meat: 120, hide: 16, zones: [3, 4], herd: [2, 3], count: 6, prey: true, nocturnal: false, defends: true, drops: { bone: 15 } },
  pike: { name: "C\xE1 ch\xF3", hp: 2, damage: 0, type: "pierce", cycle: 1, range: 1, speed: 1.2, flee: 4, aggro: 0, meat: 6, hide: 0, zones: [1, 3], herd: [1, 2], count: 16, prey: true, nocturnal: false, habitat: "water", drops: { bone: 1 } },
  behaviour: {
    fleeBurst: 5,
    tiredSeconds: 10,
    tiredSpeed: 0.5,
    carcassSeconds: 90,
    skinSeconds: 3,
    breedMonth: "spring",
    breedMinFemales: 2,
    breedChance: 0.35,
    restockChance: 0.6,
    regionRadius: 28,
    nearRadius: 48,
    nearBoost: 4,
    huntValue: { meat: 0.4, hide: 3, bone: 2, feather: 1.5, fat: 1, tusk: 3 },
    huntHpCap: [100, 200, 1e5]
  }
};

// src/data/tribes.json
var tribes_default = {
  _note: "distance = tiles from the player's campfire (far camps: the land between is made when the game starts). S\u1EE9c m\u1EA1nh kh\xF4ng c\xF2n theo kho\u1EA3ng c\xE1ch: share = ph\u1EA7n s\u1EE9c m\u1EA1nh NPC c\u1EE7a l\xE0ng n\xE0y, military = t\u1EC9 l\u1EC7 qu\xE2n s\u1EF1 trong ph\u1EA7n \u0111\xF3 (xem content/difficulty.json). reward is shown to the player; techs come in M5.",
  spring: {
    name: "Su\u1ED1i Ngu\u1ED3n",
    personality: "peaceful",
    tier: "weak",
    angle: 200,
    distance: 80,
    civilians: 8,
    warriors: 4,
    weapons: [
      "club",
      "spear"
    ],
    armor: false,
    look: {
      hide: "#7a8a4a",
      pants: "#4a6a8a"
    },
    relation: 0,
    reward: "D\u1EC5 giao th\u01B0\u01A1ng v\xE0 thu n\u1EA1p; h\u1ECDc T4 B\u1EC7n s\u1EE3i"
  },
  axe: {
    name: "R\xECu \u0110\xE1",
    personality: "aggressive",
    tier: "normal",
    angle: 320,
    distance: 110,
    civilians: 15,
    warriors: 10,
    weapons: [
      "hatchet",
      "mace"
    ],
    armor: true,
    look: {
      hide: "#8a3a24",
      pants: "#6a2a1a"
    },
    relation: -20,
    reward: "L\xEDnh ch\xF9y, b\xED quy\u1EBFt ch\u1EBF ch\xF9y \u0111\xE1"
  },
  swamp: {
    name: "\u0110\u1EA7m L\u1EA7y",
    personality: "ambusher",
    tier: "normal",
    angle: 80,
    distance: 140,
    civilians: 12,
    warriors: 8,
    weapons: [
      "sling",
      "club"
    ],
    armor: false,
    look: {
      hide: "#5a6a50",
      pants: "#3a4a3a"
    },
    relation: -10,
    reward: "\u0110\u1EA5t s\xE9t, s\u1EE3i; h\u1ECDc T5 D\xE2y qu\u0103ng \u0111\xE1"
  },
  cave: {
    name: "Hang G\u1EA5u",
    personality: "aggressive",
    tier: "medium",
    angle: 260,
    distance: 160,
    civilians: 14,
    warriors: 9,
    weapons: [
      "spear",
      "mace"
    ],
    armor: true,
    look: {
      hide: "#6a5a48",
      pants: "#3a3028"
    },
    relation: -25,
    reward: "Da g\u1EA5u, gi\xE1p da; th\u1EE3 s\u0103n l\xE3o luy\u1EC7n"
  },
  dune: {
    name: "\u0110\u1ED3i C\xE1t",
    personality: "ambusher",
    tier: "boss",
    angle: 20,
    distance: 150,
    civilians: 11,
    warriors: 7,
    weapons: [
      "bow",
      "spear"
    ],
    armor: false,
    look: {
      hide: "#b8a060",
      pants: "#7a6a3a"
    },
    relation: -5,
    reward: "L\xF4ng v\u0169, cung; h\u1ECDc b\u1EAFn cung"
  },
  meet: {
    _note: "G\u1EB7p nhau trong t\u1EA7m nh\xECn th\xEC \u0111\xE1nh, tr\u1EEB khi quan h\u1EC7 t\u1ED1t (t\u1EEB friendlyFrom tr\u1EDF l\xEAn). L\xE0ng hi\u1EC1n (peaceful) ch\u1EC9 \u0111\xE1nh khi b\u1ECB \u0111\xE1nh. feuds: c\xE1c c\u1EB7p l\xE0ng th\xF9 nhau, t\u1EF1 \u0111\xE1nh nhau khi g\u1EB7p (ch\u1EC9 \u1EDF c\xE1c chunk \u0111ang xem, xem data/npclife.json); l\xE0ng kh\xF4ng c\xF3 trong c\u1EB7p n\xE0o th\xEC kh\xF4ng t\u1EF1 \u0111\xE1nh l\xE0ng kh\xE1c.",
    friendlyFrom: 20,
    feuds: [
      [
        "axe",
        "swamp"
      ],
      [
        "cave",
        "dune"
      ]
    ]
  },
  relation: {
    labels: [
      [
        -100,
        "Th\xF9 \u0111\u1ECBch"
      ],
      [
        -40,
        "Trung l\u1EADp"
      ],
      [
        20,
        "Th\xE2n thi\u1EC7n"
      ],
      [
        60,
        "C\u1ED1ng n\u1EA1p"
      ],
      [
        90,
        "Thu ph\u1EE5c"
      ]
    ],
    killWarrior: -10,
    killCivilian: -25,
    attackedPeaceful: -30,
    tributeAt: 60,
    joinAt: 90
  },
  surrender: {
    leaderDown: true,
    holdCampSeconds: 30
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
    _note: "M\xE1u c\u1EE7a c\xF4ng tr\xECnh l\xE0ng \u0111\u1ECBch \u1EDF c\u1EA5p 1 (nh\xE2n 1 + 0,5 cho m\u1ED7i c\u1EA5p, r\u1ED3i nh\xE2n boss.wallHp v\u1EDBi l\xE0ng boss). M\u1EE5c ti\xEAu v\u1EDBi 10 l\xEDnh th\u01B0\u1EDDng (kho\u1EA3ng 90 s\xE1t th\u01B0\u01A1ng m\u1ED7i gi\xE2y) \u1EDF c\u1EA5p 4: r\xE0o ~4 gi\xE2y, c\u1ED5ng ~13 gi\xE2y, nh\xE0 ~15 gi\xE2y, ch\xF2i ~45 gi\xE2y.",
    fire: 160,
    pile: 70,
    tower: 1600,
    fence: 140,
    gate: 480,
    house: 540
  },
  struct: {
    _note: "V\u0169 kh\xED \u0111\u1EADp c\xF4ng tr\xECnh th\u1EBF n\xE0o: s\xE1t th\u01B0\u01A1ng nh\xE2n h\u1EC7 s\u1ED1 theo ki\u1EC3u v\u0169 kh\xED (ch\xE9m, \u0111\u1EADp, \u0111\xE2m) v\xE0 lo\u1EA1i c\xF4ng tr\xECnh; t\u1EA7m xa (cung, n\xE1) nh\xE2n ranged. breakers: s\u1ED1 l\xEDnh t\u1ED1i \u0111a \u0111\u1EADp m\u1ED9t m\u1EA3nh c\xF9ng l\xFAc. blockedSeconds: l\xEDnh t\u1EA7m xa ch\u1EDD b\u1EA5y l\xE2u m\xE0 v\u1EABn b\u1ECB ch\u1EB7n th\xEC m\u1EDBi t\u1EF1 ph\xE1 khi \u0111\u1ED9i c\xF3 c\u1EADn chi\u1EBFn. repairPerSecond: ph\u1EA7n m\xE1u t\u1ED1i \u0111a l\xE0ng t\u1EF1 s\u1EEDa m\u1ED7i gi\xE2y khi ngo\xE0i tr\u1EADn (repairAfter gi\xE2y sau nh\xE1t \u0111\xE1nh cu\u1ED1i); fullAfter: ng\u1EE7 qu\xE1 b\u1EA5y l\xE2u th\xEC th\u1EE9c d\u1EADy l\xE0nh h\u1EB3n.",
    slash: { fence: 1.5, gate: 1, house: 0.8, tower: 0.6 },
    crush: { fence: 0.8, gate: 1.5, house: 1.2, tower: 1.5 },
    pierce: { fence: 0.5, gate: 0.5, house: 0.4, tower: 0.3 },
    ranged: 0.4,
    breakers: 3,
    blockedSeconds: 20,
    repairPerSecond: 0.01,
    repairAfter: 30,
    fullAfter: 120
  },
  buildingHpPerTile: 45,
  crew: 3,
  driftMax: 14,
  reach: 1.6,
  scout: {
    gearSkill: {
      weapon: 0.05,
      armor: 0.08,
      torch: 0.06,
      mount: 0.2
    },
    gearHide: {
      weapon: 0.03,
      armor: 0.05,
      torch: 0.04,
      mount: 0.06
    },
    weights: {
      agi: 0.5,
      sta: 0.5
    },
    stealthPerPoint: 0.015,
    surveyPerInt: 0.04,
    walkPerSta: 0.02
  }
};

// src/data/weapons.json
var weapons_default = {
  _note: `type: pierce | slash | crush. range in tiles. cycle in seconds before the agility factor (the attack speed of the weapon). Every blow or shot does the weapon damage plus the damage stat of the fighter. crit: base chance of a critical blow or shot, 0 to 1 (none have any; research gives it, never above rules.critMax). A critical one does critDamage times the damage (1.25 = 125% of a normal blow, 4 = four times), or the weapon's own critDamage. The research of each weapon (aspd, crit, critd in researchtree.json) is added to the weapon of whoever holds it: aspd by a percent, crit and critd by real points (0.5 = half a percent of chance; 100 = one more time the damage). cost/time/tier only for what the player can craft; others are used by tribes. style: which set of fighting animations the weapon uses (see "styles"); anims overrides single states for one weapon; projectile: what a ranged weapon fires.`,
  styles: {
    fist: {
      name: "Tay kh\xF4ng",
      idle: "idle",
      walk: "walk",
      guard: "fist_guard",
      charge: "fist_charge",
      attack: "fist_attack"
    },
    swing: {
      name: "Vung, ch\xE9m, \u0111\u1EADp (g\u1EADy, ch\xF9y, r\xECu, ki\u1EBFm)",
      idle: "swing_idle",
      walk: "swing_walk",
      guard: "swing_guard",
      charge: "swing_charge",
      attack: "swing_attack"
    },
    thrust: {
      name: "\u0110\xE2m (gi\xE1o, th\u01B0\u01A1ng)",
      idle: "thrust_idle",
      walk: "thrust_walk",
      guard: "thrust_guard",
      charge: "thrust_charge",
      attack: "thrust_attack"
    },
    shoot: {
      name: "B\u1EAFn (cung, n\u1ECF, s\xFAng)",
      idle: "shoot_idle",
      walk: "shoot_walk",
      guard: "shoot_guard",
      charge: "shoot_charge",
      attack: "shoot_attack"
    },
    sling: {
      name: "Qu\u0103ng \u0111\xE1 (d\xE2y qu\u0103ng, n\xE1)",
      idle: "sling_idle",
      walk: "sling_walk",
      guard: "sling_guard",
      charge: "sling_charge",
      attack: "sling_attack"
    },
    throw: {
      name: "N\xE9m (lao, ph\xF3ng lao)",
      idle: "throw_idle",
      walk: "throw_walk",
      guard: "throw_guard",
      charge: "throw_charge",
      attack: "throw_attack"
    }
  },
  weapons: {
    fist: {
      name: "Tay kh\xF4ng",
      type: "crush",
      range: 1,
      damage: 0.75,
      cycle: 1.75,
      style: "fist"
    },
    club: {
      name: "G\u1EADy g\u1ED7",
      type: "crush",
      range: 1,
      damage: 2,
      cycle: 1.5,
      cost: {
        wood: 2
      },
      durability: 80,
      time: 20,
      tier: 1,
      style: "swing"
    },
    spear: {
      name: "Gi\xE1o g\u1ED7",
      type: "pierce",
      range: 1.5,
      damage: 5,
      cycle: 1.4,
      cost: {
        wood: 5
      },
      durability: 120,
      time: 30,
      tier: 1,
      style: "thrust"
    },
    mace: {
      name: "Ch\xF9y \u0111\xE1",
      type: "crush",
      range: 1,
      damage: 1,
      cycle: 1.2,
      cost: {
        wood: 20,
        stone: 10
      },
      durability: 120,
      time: 100,
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
      anims: {
        attack: "slash"
      },
      tier: 2
    },
    sling: {
      name: "D\xE2y qu\u0103ng \u0111\xE1",
      type: "crush",
      range: 5.5,
      damage: 4,
      cycle: 2,
      ranged: true,
      cost: {
        wood: 5,
        stone: 5
      },
      durability: 90,
      time: 60,
      style: "sling",
      projectile: "stone",
      tier: 1
    },
    bronze_spear: {
      name: "Gi\xE1o \u0111\u1ED3ng",
      type: "pierce",
      range: 1.7,
      damage: 11,
      cycle: 1.3,
      style: "thrust",
      tier: 3
    },
    bronze_sword: {
      name: "Ki\u1EBFm \u0111\u1ED3ng",
      type: "slash",
      range: 1.1,
      damage: 13,
      cycle: 1.1,
      style: "swing",
      anims: {
        attack: "slash"
      },
      tier: 3
    },
    bronze_axe: {
      name: "R\xECu \u0111\u1ED3ng",
      type: "slash",
      range: 1,
      damage: 16,
      cycle: 1.4,
      style: "swing",
      anims: {
        attack: "slash"
      },
      tier: 3
    },
    bow: {
      name: "Cung ng\u1EAFn",
      type: "pierce",
      range: 8,
      damage: 8,
      cycle: 2,
      ranged: true,
      cost: {
        wood: 30,
        feather: 3
      },
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
        hide: 30
      },
      durability: 200,
      time: 100,
      tier: 1
    },
    bone: {
      name: "Gi\xE1p da x\u01B0\u01A1ng",
      pierce: 0.22,
      slash: 0.34,
      crush: 0.22,
      cost: {
        hide: 30,
        bone: 20
      },
      durability: 350,
      time: 160,
      tier: 2
    },
    bronze: {
      name: "Gi\xE1p \u0111\u1ED3ng",
      pierce: 0.38,
      slash: 0.5,
      crush: 0.3,
      tier: 3
    }
  },
  rules: {
    backstab: 1.25,
    tierMult: {
      "2": {
        damage: 1.4
      }
    },
    critMax: 0.1,
    critDamage: 1.25,
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
for (const id of Object.keys(WEAPONS)) {
  WEAPONS[id].id = id;
  WEAPONS[id].anim = poseOf(id, "attack");
}
var ARMORS = weapons_default.armor;
var RULES = weapons_default.rules;
var SIEGE = siege_default;
var CRAFTED_WEAPONS = Object.keys(WEAPONS).filter((k) => WEAPONS[k].cost);
var SPECIES = Object.keys(animals_default).filter((k) => !k.startsWith("_") && k !== "behaviour");
var ANIMALS = Object.fromEntries(SPECIES.map((s) => [s, animals_default[s]]));
var BEHAVIOUR = animals_default.behaviour;
var TRIBE_IDS = ["spring", "axe", "swamp", "cave", "dune"];
var TRIBES = Object.fromEntries(TRIBE_IDS.map((t) => [t, tribes_default[t]]));
var RELATION = tribes_default.relation;
var MEET = tribes_default.meet;
var HOSTILE_BELOW = RELATION.labels[1][0];
var SURRENDER = tribes_default.surrender;
var zoneOf = (distance) => Math.max(1, Math.min(4, Math.ceil(distance / 24)));
var maxHpOf = (vit) => 40 + 8 * vit;
var cycleOf = (weaponCycle, agi) => weaponCycle * (RULES.agilityBase - RULES.agilityStep * agi);
function damageOf(w, strength, armor, backstab) {
  const base = w.damage + RULES.strengthDamage * strength;
  return base * (1 - (armor ? armor[w.type] : 0)) * (backstab ? RULES.backstab : 1);
}

// src/data/pace.json
var pace_default = {
  _note: 'How long things take, in one place. gather: real seconds (at 1x speed) to collect ONE unit for an average villager with a good tool (speed factor 1.0); farm is the same for one unit from a field of the first level (a higher level divides it by its craftSpeed). A day is 20 minutes, 12 of them daylight; walking, carrying and the weather come on top. bare: how well bare hands do compared with a good tool (1 = as good). Building, crafting, research and repair are measured in days of labour instead (see buildings.ts, tools.ts, research.json) because they should take about the same fraction of a day however long a day lasts. huntPerDay: food-equivalent a hunter of factor 1 brings home in a day (an estimate for the card of the Ch\xF2i th\u1EE3 s\u0103n); gatherDuty: share of working time a gatherer spends gathering rather than walking and carrying (estimate for the cards of the houses). Weather and season slow outdoor work: see weather.json and seasons.json (key "work").',
  gather: { wood: 11, stone: 17, food: 9, farm: 70 },
  bare: { wood: 0.6, stone: 0.5, food: 0.9, build: 0.8 },
  huntPerDay: 30,
  gatherDuty: 0.6,
  yield: { wood: 3, stone: 2, food: 1 },
  levelYield: [1, 1, 1.6, 3],
  costMult: { wood: 2, stone: 2, coin: 2 },
  node: { tree: 20, rock: 28, bush: 40 },
  outdoor: ["wood", "stone", "food", "build"]
};

// src/data/war.json
var war_default = {
  advanced: false,
  advancedBuildings: ["tower", "supplycamp", "scouttent", "drill", "field"],
  _note: "advanced: the war-logistics layer of the medieval era (supply soldiers and their camp, field tents and rest, harassment raids on the march, the watchtower, the research of the march and of the war plan). Off: none of it exists in the game (nor in the screens); set true when the era opens it. The army then eats from the village store. The army on the march. The more squads and soldiers, the harder it is to move them: speed drops (slow, from slowMin for one soldier of one squad up to slowMax), and they eat and tire more. Research can cut the slow (research: tech id -> share cut off), but never below slowFloor, so an army can never march faster than (1 - slowFloor) of normal.",
  retreat: { graceSeconds: 0, doneShare: 0.8 },
  march: {
    slowMin: 0.5,
    slowMax: 0.85,
    perSquad: 0.04,
    perSoldier: 4e-3,
    slowFloor: 0.3,
    paceScale: 1,
    maxCut: 0.6,
    foodBase: 1.5,
    energyBase: 1.5
  },
  research: {},
  supply: {
    load: 60,
    trail: 8,
    defaultDays: 3,
    maxDays: 10,
    hungerSmooth: 10
  },
  tent: {
    woodBase: 12,
    hideBase: 8,
    perLevel: 1,
    buildSeconds: 150,
    buildReach: 4,
    refund: 0.5,
    weight: 1.5,
    near: 14
  },
  tired: {
    below: 30,
    maxPenalty: 0.35
  },
  harass: {
    first: 90,
    every: 150,
    base: 3,
    perWarriors: 10,
    max: 8,
    range: 120,
    minFromVillage: 25,
    spawnDist: 32,
    life: 240,
    maxAlive: 12
  }
};

// src/data/food.json
var food_default = {
  _note: "Th\u1EE9c \u0103n c\u1EE7a l\xE0ng. M\u1ED7i cu\u1ED1i ng\xE0y game (h\u1EBFt m\u1ED9t ng\xE0y) l\xE0ng \u0103n m\u1ED9t l\u1EA7n: m\u1ED7i d\xE2n v\xE0 m\u1ED7i l\xEDnh \u0103n m\u1ED9t kh\u1EA9u ph\u1EA7n, t\u0103ng theo c\u1EA5p l\u1EEDa tr\u1EA1i (ph\u1EA7n t\u1EED th\u1EE9 n l\xE0 c\u1EA5p l\u1EEDa n). Th\u1EE9c \u0103n thu v\u1EC1 \u0111\u1ED5 v\xE0o ph\u1EA7n \u0103n c\u1EE7a l\u1EEDa tr\u1EA1i tr\u01B0\u1EDBc, d\u01B0 m\u1EDBi v\xE0o kho; cu\u1ED1i ng\xE0y l\u1EA5y t\u1EEB ph\u1EA7n \u0103n r\u1ED3i t\u1EDBi kho. Thi\u1EBFu th\xEC c\u1EA3 l\xE0ng y\u1EBFu \u0111i trong ng\xE0y k\u1EBF: m\u1EE9c gi\u1EA3m = maxPenalty \xD7 (ph\u1EA7n thi\u1EBFu / ph\u1EA7n c\u1EA7n), \xE1p cho m\u1ECDi ch\u1EC9 s\u1ED1 tr\u1EEB m\xE1u t\u1ED1i \u0111a (m\xE1u ch\u1EC9 h\u1ED3i ch\u1EADm h\u01A1n).",
  ration: {
    villager: [1, 2, 2, 3],
    soldier: [2, 3, 3, 4]
  },
  maxPenalty: 0.2
};

// src/content/resources.json
var resources_default = {
  _note: `M\u1ECDi t\xE0i nguy\xEAn c\u1EE7a game n\u1EB1m \u1EDF \u0111\xE2y; th\xEAm t\xE0i nguy\xEAn m\u1EDBi = th\xEAm m\u1ED9t m\u1EE5c (th\u1EE9 t\u1EF1 m\u1EE5c = th\u1EE9 t\u1EF1 tr\xEAn m\xE0n h\xECnh). name: t\xEAn hi\u1EC3n th\u1ECB. carry: m\u1ED9t d\xE2n mang t\u1ED1i \u0111a bao nhi\xEAu. barter: \u0111\u1ED5i bao nhi\xEAu th\xEC \u0111\u01B0\u1EE3c 1 ti\u1EC1n (null: kh\xF4ng \u0111\u1ED5i). hud: 'always' lu\xF4n hi\u1EC7n tr\xEAn thanh tr\xEAn, 'whenOwned' ch\u1EC9 hi\u1EC7n khi l\xE0ng \u0111\xE3 c\xF3. unlock: null l\xE0 m\u1EDF t\u1EEB \u0111\u1EA7u; ho\u1EB7c {building, level}: ch\u1EC9 l\u1EA5y \u0111\u01B0\u1EE3c khi \u0111\xE3 c\xF3 c\xF4ng tr\xECnh \u0111\xF3 (xong) \u0111\u1EA1t c\u1EA5p \u0111\xF3. V\xED d\u1EE5 {"building":"huntlodge","level":2} m\u1EDF x\u01B0\u01A1ng \u1EDF Ch\xF2i th\u1EE3 s\u0103n c\u1EA5p 2; sau n\xE0y \u0111\u1ED3ng, s\u1EAFt... m\u1EDF b\u1EB1ng c\xF4ng tr\xECnh ri\xEAng (th\xEAm th\u01B0 m\u1EE5c c\xF4ng tr\xECnh \u0111\xF3 \u1EDF src/content/buildings). T\xE0i nguy\xEAn ch\u01B0a m\u1EDF th\xEC th\xFA v\u1EABn c\xF3 th\u1EC3 r\u01A1i ra nh\u01B0ng l\xE0ng kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c.`,
  resources: {
    food: {
      name: "Th\u1EE9c \u0103n",
      carry: 40,
      barter: 10,
      hud: "always",
      unlock: null
    },
    wood: {
      name: "G\u1ED7",
      carry: 12,
      barter: 5,
      hud: "always",
      unlock: null
    },
    stone: {
      name: "\u0110\xE1",
      carry: 8,
      barter: 5,
      hud: "always",
      unlock: null
    },
    hide: {
      name: "Da",
      carry: 10,
      barter: 2,
      hud: "always",
      unlock: {
        building: "huntlodge",
        level: 1
      }
    },
    bone: {
      name: "X\u01B0\u01A1ng",
      carry: 6,
      barter: 4,
      hud: "whenOwned",
      unlock: {
        building: "huntlodge",
        level: 1
      }
    },
    fat: {
      name: "M\u1EE1",
      carry: 6,
      barter: 4,
      hud: "whenOwned",
      unlock: {
        building: "huntlodge",
        level: 3
      }
    },
    feather: {
      name: "L\xF4ng v\u0169",
      carry: 10,
      barter: 10,
      hud: "whenOwned",
      unlock: {
        building: "huntlodge",
        level: 1
      }
    },
    tusk: {
      name: "Ng\xE0",
      carry: 2,
      barter: 1,
      hud: "whenOwned",
      unlock: {
        building: "huntlodge",
        level: 4
      }
    },
    coin: {
      name: "V\u1ECF s\xF2",
      carry: 0,
      barter: null,
      hud: "always",
      unlock: null
    }
  }
};

// src/sim/resources.ts
var DEFS = resources_default.resources;
var RES_LIST = Object.keys(DEFS);
var ANIMAL_MATERIALS = RES_LIST.filter((r) => DEFS[r].hud === "whenOwned");
var CURRENCY = { stone: "V\u1ECF s\xF2", ancient: "\u0110\u1ED3ng xu" };
var RES_NAME = Object.fromEntries(RES_LIST.map((r) => [r, DEFS[r].name]));
var BARTER = Object.fromEntries(RES_LIST.filter((r) => DEFS[r].barter !== null).map((r) => [r, DEFS[r].barter]));
var emptyStock = () => Object.fromEntries(RES_LIST.map((r) => [r, 0]));
var CARRY_CAP = Object.fromEntries(RES_LIST.map((r) => [r, DEFS[r].carry]));
var resourceUnlock = (res) => DEFS[res].unlock;
var resourceOpen = (res, buildings) => {
  const u = DEFS[res].unlock;
  return !u || buildings.some((b) => b.done && b.kind === u.building && b.level >= u.level);
};
var FOOD = food_default;
var rationAt = (fireLevel2, soldier) => {
  const list = soldier ? FOOD.ration.soldier : FOOD.ration.villager;
  return list[Math.max(0, Math.min(list.length, fireLevel2) - 1)];
};
var scaleBill = (cost) => {
  const m = pace_default.costMult, out = {};
  for (const [r, n] of Object.entries(cost)) out[r] = Math.max(1, Math.ceil(n * (m[r] ?? 1) - 1e-9));
  return out;
};

// src/data/progression.json
var progression_default = {
  _note: "K\u1EBF ho\u1EA1ch ph\xE1t tri\u1EC3n theo c\u1EA5p Nh\xE0 chung (l\u1EEDa tr\u1EA1i) v\xE0 c\u1EA5p Nh\xE0 nghi\xEAn c\u1EE9u. C\xF4ng tr\xECnh n\xE0o m\u1EDF \u1EDF c\u1EA5p l\u1EEDa n\xE0o n\u1EB1m trong ch\xEDnh n\xF3: src/content/buildings/<kind>/building.json (unlockFire). \u1EDE \u0111\xE2y ch\u1EC9 c\xF2n c\u1EA5p nh\xE0 t\u1ED1i \u0111a v\xE0 \u0111i\u1EC1u ki\u1EC7n n\xE2ng l\u1EEDa theo t\u1EEBng c\u1EA5p l\u1EEDa, v\xE0 c\xE1c nghi\xEAn c\u1EE9u m\u1EDF \u1EDF t\u1EEBng c\u1EA5p Nh\xE0 nghi\xEAn c\u1EE9u (id trong data/research.json).",
  campfire: {
    _note: "buildingMaxLevel: c\u1EA5p t\u1ED1i \u0111a c\u1EE7a c\xE1c nh\xE0 d\u01B0\u1EDBi l\u1EEDa c\u1EA5p n\xE0y (b\u1EB1ng c\u1EA5p l\u1EEDa). upgradeNeeds: mu\u1ED1n n\xE2ng l\u1EEDa t\u1EEB c\u1EA5p n\xE0y l\xEAn c\u1EA5p k\u1EBF th\xEC m\u1ECDi c\xF4ng tr\xECnh thu\u1ED9c nh\xF3m trong groupAtLeastLevel (hi\u1EC7n ch\u1EC9 nh\xF3m production: n\xF4ng tr\u1EA1i, x\u01B0\u1EDFng g\u1ED7, x\u01B0\u1EDFng \u0111\xE1, ch\xF2i s\u0103n) ph\u1EA3i c\xF3 m\u1EB7t v\xE0 \u0111\u1EA1t c\u1EA5p \u0111\xF3; c\xE1c nh\xE0 kh\xE1c kh\xF4ng b\u1EAFt bu\u1ED9c. Kh\xF4ng ph\u1EE5 thu\u1ED9c nghi\xEAn c\u1EE9u.",
    levels: [
      {
        level: 1,
        buildingMaxLevel: 1,
        upgradeNeeds: {
          groupAtLeastLevel: {
            production: 1
          }
        }
      },
      {
        level: 2,
        buildingMaxLevel: 2,
        upgradeNeeds: {
          groupAtLeastLevel: {
            production: 2
          }
        }
      },
      {
        level: 3,
        buildingMaxLevel: 3,
        upgradeNeeds: {
          groupAtLeastLevel: {
            production: 3
          }
        }
      },
      {
        level: 4,
        buildingMaxLevel: 4,
        upgradeNeeds: {
          groupAtLeastLevel: {
            production: 4
          }
        }
      },
      {
        level: 5,
        buildingMaxLevel: 5,
        upgradeNeeds: null
      }
    ]
  },
  research: {
    _note: "M\u1ED7i c\u1EA5p Nh\xE0 nghi\xEAn c\u1EE9u m\u1EDF nh\u1EEFng nghi\xEAn c\u1EE9u n\xE0o: 'tabs' = tab n\xE0o c\u1EE7a giao di\u1EC7n \u0111\u01B0\u1EE3c m\u1EDF, 'techs' l\xE0 id trong research.json (c\u1EA5p 3 d\xF9ng '@rest' = t\u1EA5t c\u1EA3 c\xF2n l\u1EA1i). Nghi\xEAn c\u1EE9u ch\u1EC9 c\u1ED9ng ch\u1EC9 s\u1ED1 v\xE0 m\u1EDF tr\u1EADn ph\xE1p, kh\xF4ng kh\xF3a c\xF4ng tr\xECnh hay c\u1EA5p nh\xE0 (c\u1EA5p nh\xE0 theo c\u1EA5p Nh\xE0 chung). D\xE2n t\u1EF1 l\u1EA5y c\xF4ng c\u1EE5, v\u0169 kh\xED, \u0111u\u1ED1c \u1EDF kho v\xE0 t\u1EF1 \u0111\u1EB7t ch\u1EBF t\u1EA1o m\xE0 kh\xF4ng c\u1EA7n nghi\xEAn c\u1EE9u. C\u1EA5p 5 l\xE0 Nh\xE0 nghi\xEAn c\u1EE9u trung c\u1ED5 c\u1EA5p 1: c\xE1c nghi\xEAn c\u1EE9u c\u1EE7a l\u1EDBp chi\u1EBFn tranh (t\xEDn hi\u1EC7u, tr\u1EADn ph\xE1p, k\u1EBF ho\u1EA1ch) ch\u1EC9 h\u1ECDc \u0111\u01B0\u1EE3c \u1EDF \u0111\xF3, v\xE0 ch\u1EC9 khi \u0111\xE3 sang th\u1EDDi Trung c\u1ED5 (Nh\xE0 chung th\xE0nh Nh\xE0 ch\xEDnh). C\u1EA5p \u0111\u01B0\u1EE3c x\u1EBFp TR\u01AF\u1EDAC c\u1EA5p c\xF3 '@rest' v\xEC c\u1EA5p cu\u1ED1i l\xE0 c\u1EA5p d\u1EF1 ph\xF2ng.",
    levels: [
      {
        level: 1,
        tabs: [
          "blueprints"
        ],
        techs: [],
        closedTabs: [
          "military"
        ]
      },
      {
        level: 2,
        tabs: [
          "blueprints",
          "military"
        ],
        techs: []
      },
      {
        level: 5,
        tabs: [
          "blueprints",
          "military"
        ],
        techs: [
          "signal",
          "form_basic",
          "form_wedge",
          "form_horns",
          "form_scatter",
          "form_ambush",
          "form_cells_10",
          "form_cells_15",
          "form_squads_5",
          "form_squads_6",
          "plan_report",
          "plan_supply",
          "plan_weather",
          "plan_rest"
        ]
      },
      {
        level: 3,
        tabs: [
          "blueprints",
          "military"
        ],
        techs: [
          "@rest"
        ]
      }
    ]
  },
  formationDefaults: {
    cells: 5,
    squads: 4
  },
  buildMenu: {
    _note: "Menu x\xE2y d\u1EF1ng hi\u1EC7n s\u1ED1 l\u01B0\u1EE3ng \u0111\xE3 x\xE2y / t\u1ED1i \u0111a (vd 0/1), kh\xF4ng d\xF9ng ch\u1EEF. T\u1ED1i \u0111a l\u1EA5y t\u1EEB perFire trong buildings.ts, c\xF4ng tr\xECnh menu ch\u1EC9 c\xF3 1.",
    showCount: true,
    format: "{built}/{max}",
    hideText: true
  },
  panelActions: {
    _note: "Panel khi b\u1EA5m v\xE0o c\xF4ng tr\xECnh d\xF9ng icon thay ch\u1EEF. 'panel' m\u1EDF panel ri\xEAng c\u1EE7a nh\xE0 (nghi\xEAn c\u1EE9u, xem d\xE2n, ...). Ch\u1EEF ch\u1EC9 hi\u1EC7n \u1EDF tooltip (?).",
    open: {
      icon: "panel",
      tooltip: "M\u1EDF b\u1EA3ng"
    },
    upgrade: {
      icon: "arrow_up",
      tooltip: "N\xE2ng c\u1EA5p",
      cost: "levelCost"
    },
    move: {
      icon: "arrow_4way",
      tooltip: "Di d\u1EDDi",
      cost: "free"
    },
    demolish: {
      icon: "x_red",
      tooltip: "Ph\xE1 b\u1ECF",
      cost: "refund"
    }
  },
  undemolishable: {
    _note: "C\xF4ng tr\xECnh ch\u1EC9 \u0111\u01B0\u1EE3c x\xE2y 1 c\xE1i th\xEC kh\xF4ng th\u1EC3 ph\xE1 b\u1ECF (v\u1EABn n\xE2ng c\u1EA5p v\xE0 di d\u1EDDi \u0111\u01B0\u1EE3c). L\u1EA5y t\u1EEB c\u1EA5u h\xECnh: m\u1ECDi c\xF4ng tr\xECnh kh\xF4ng c\xF3 perFire v\xE0 kh\xF4ng ph\u1EA3i \u0111\u01B0\u1EDDng/h\xE0ng r\xE0o.",
    kinds: [
      "campfire",
      "builder",
      "storage",
      "workshop",
      "lab",
      "toolstore",
      "armory"
    ]
  },
  formationDefaults_note: "cells = s\u1ED1 \xF4 t\u1ED1i \u0111a c\u1EE7a m\u1ED9t tr\u1EADn ph\xE1p (s\u1ED1 l\xEDnh m\u1ED9t \u0111\u1ED9i); squads = s\u1ED1 \u0111\u1ED9i l\u1EADp \u0111\u01B0\u1EE3c. Nghi\xEAn c\u1EE9u form_cells_10/15 v\xE0 form_squads_5/6 (trong research.json) n\xE2ng hai s\u1ED1 n\xE0y."
};

// src/data/quests.json
var quests_default = {
  _note: "Nhi\u1EC7m v\u1EE5 h\u01B0\u1EDBng d\u1EABn, l\xE0m theo th\u1EE9 t\u1EF1 t\u1EDBi Nh\xE0 chung c\u1EA5p 4 v\xE0 ch\u01B0\u01A1ng t\xE1c chi\u1EBFn. M\u1ED7i nhi\u1EC7m v\u1EE5: id, chapter (ch\u01B0\u01A1ng), title (ti\xEAu \u0111\u1EC1 ng\u1EAFn), hint (h\u01B0\u1EDBng d\u1EABn chi ti\u1EBFt, ch\u1EC9 hi\u1EC7n \u1EDF nhi\u1EC7m v\u1EE5 \u0111\u1EA7u ti\xEAn \u0111ang m\u1EDF), after (c\xE1c nhi\u1EC7m v\u1EE5 ph\u1EA3i xong tr\u01B0\u1EDBc), done (\u0111i\u1EC1u ki\u1EC7n). Lo\u1EA1i \u0111i\u1EC1u ki\u1EC7n (done.type): inspectUnit inspectAnimal squadSize{count} squadFormation{id} equipped{slot weapon|armor,count} scoutSent hasMap{level} planDefense planArrow planRunning planDone{result?}; c\xE1c lo\u1EA1i c\u0169: buildBuilding{kind,count} upgradeBuilding{kind,level} upgradeFire{level} fireReady{level: m\u1ECDi nh\xE0 \u0111\xE3 m\u1EDF \u0111\u1EA1t c\u1EA5p \u0111\xF3 th\xEC m\u1EDBi \u0111\u01B0\u1EE3c r\u1EDDi c\u1EA5p l\u1EEDa} researchTech{id} population{count} stock{res,count} hasRole{role,count} jobCount{job,count} staffIn{kind,count} haveTool{kind,tier,count} torches{count} createSquad{count} daytime{day: s\xE1ng ng\xE0y \u0111\xF3} speed{atLeast} selectBuilding{kind} openBuilding{kind} inspectNode. Nhi\u1EC7m v\u1EE5 \u0111\xE3 xong th\xEC xong lu\xF4n, v\xE0 nhi\u1EC7m v\u1EE5 n\xE0o \u0111\u1EE9ng tr\u01B0\u1EDBc m\u1ED9t nhi\u1EC7m v\u1EE5 \u0111\xE3 xong c\u0169ng \u0111\u01B0\u1EE3c t\xEDnh l\xE0 xong. Th\xEAm nhi\u1EC7m v\u1EE5 b\u1EB1ng c\xE1ch th\xEAm m\u1ED9t d\xF2ng v\xE0o quests.",
  chapters: [{ id: 1, name: "Ch\u01B0\u01A1ng 1 \xB7 Nh\u1EEFng ng\xE0y \u0111\u1EA7u b\xEAn \u0111\u1ED1ng l\u1EEDa" }, { id: 2, name: "Ch\u01B0\u01A1ng 2 \xB7 Nghi\xEAn c\u1EE9u v\xE0 m\u1EDF r\u1ED9ng" }, { id: 3, name: "Ch\u01B0\u01A1ng 3 \xB7 Ph\xF2ng th\u1EE7 v\xE0 qu\xE2n \u0111\u1ED9i" }, { id: 4, name: "Ch\u01B0\u01A1ng 4 \xB7 T\xE1c chi\u1EBFn v\xE0 th\xFA c\u01B0\u1EE1i" }],
  quests: [
    { id: "c1_select", chapter: 1, title: "L\xE0m quen v\u1EDBi l\xE0ng", hint: "B\u1EA1n c\xF3 hai ng\u01B0\u1EDDi: m\u1ED9t h\xE1i l\u01B0\u1EE3m (nu\xF4i c\u1EA3 l\xE0ng) v\xE0 m\u1ED9t \u0111\u1ED1n g\u1ED7. M\u1ED7i ngh\u1EC1 do m\u1ED9t nh\xE0 qu\u1EA3n l\xFD. B\u1EA5m v\xE0o X\u01B0\u1EDFng g\u1ED7 (nh\xE0 g\u1ED7 nh\u1ECF c\u1EA1nh \u0111\u1ED1ng l\u1EEDa) \u0111\u1EC3 ch\u1ECDn n\xF3.", after: [], done: { type: "selectBuilding", kind: "lumberyard" } },
    { id: "c1_open", chapter: 1, title: "M\u1EDF b\u1EA3ng X\u01B0\u1EDFng g\u1ED7", hint: "M\u1ED9t thanh n\xFAt n\u1ED5i l\xEAn d\u01B0\u1EDBi nh\xE0: \u2630 m\u1EDF b\u1EA3ng, \u2B06 n\xE2ng c\u1EA5p, \u2725 di d\u1EDDi, \u2716 ph\xE1 b\u1ECF. B\u1EA5m \u2630 \u0111\u1EC3 xem ai \u0111ang \u0111\u1ED1n g\u1ED7 v\xE0 nh\xE0 c\xF2n m\u1EA5y ch\u1ED7. \u0110\xF3ng b\u1EA3ng b\u1EB1ng \u2715 khi xem xong.", after: ["c1_select"], done: { type: "openBuilding", kind: "lumberyard" } },
    { id: "c1_node", chapter: 1, title: "Xem m\u1ED9t c\xE1i c\xE2y", hint: 'B\u1EA5m v\xE0o m\u1ED9t c\xE1i c\xE2y g\u1EA7n \u0111\xF3: th\u1EBB hi\u1EC7n t\xEAn, thanh m\xE1u (l\u01B0\u1EE3ng g\u1ED7 c\xF2n l\u1EA1i) v\xE0 n\xFAt "Khai th\xE1c". N\xFAt n\xE0y t\u1EF1 g\u1ECDi m\u1ED9t ng\u01B0\u1EDDi \u0111\u1ED1n g\u1ED7 \u1EDF g\u1EA7n t\u1EDBi ch\u1EB7t \u0111\xFAng c\xE2y \u0111\xF3, kh\xF4ng c\u1EA7n ch\u1ECDn d\xE2n.', after: ["c1_open"], done: { type: "inspectNode" } },
    { id: "c1_unit", chapter: 1, title: "Xem m\u1ED9t ng\u01B0\u1EDDi d\xE2n", hint: 'B\u1EA5m v\xE0o m\u1ED9t ng\u01B0\u1EDDi d\xE2n tr\xEAn b\u1EA3n \u0111\u1ED3: th\u1EBB hi\u1EC7n t\xEAn, vi\u1EC7c \u0111ang l\xE0m v\xE0 c\xE1c thanh No (\u0111\xF3i), S\u1EE9c (m\u1EC7t), M\xE1u, Gi\xE1p. N\xFAt "Giao vi\u1EC7c v\xE0 chi ti\u1EBFt" m\u1EDF b\u1EA3ng \u2699 v\u1EDBi c\xF4ng c\u1EE5, ca l\xE0m (ban ng\xE0y, ban \u0111\xEAm, c\u1EA3 hai) v\xE0 ch\u1EC9 s\u1ED1. B\u1EA5m "B\u1ECF ch\u1ECDn" \u0111\u1EC3 \u0111\xF3ng th\u1EBB.', after: ["c1_node"], done: { type: "inspectUnit" } },
    { id: "c1_animal", chapter: 1, title: "Xem m\u1ED9t con th\xFA", hint: "Th\xFA r\u1EEBng \u0111i lang thang quanh l\xE0ng. B\u1EA5m v\xE0o m\u1ED9t con th\xFA \u0111\u1EC3 xem m\xE1u v\xE0 t\xEDnh t\xECnh (th\xFA hi\u1EC1n b\u1ECF ch\u1EA1y, th\xFA d\u1EEF x\xF4ng v\xE0o c\u1EAFn). Vi\u1EC7c s\u0103n \u0111\u1EC3 th\u1EE3 s\u0103n lo; \u0111\u1EEBng \u0111\u1EC3 d\xE2n y\u1EBFu \u0111i m\u1ED9t m\xECnh v\xE0o n\u01A1i c\xF3 th\xFA d\u1EEF.", after: ["c1_unit"], done: { type: "inspectAnimal" } },
    { id: "c1_wood", chapter: 1, title: "C\xF3 10 g\u1ED7 trong kho", hint: 'B\u1EA5m "Khai th\xE1c" \u1EDF c\xE2y \u0111\u1EC3 ng\u01B0\u1EDDi \u0111\u1ED1n g\u1ED7 l\xE0m vi\u1EC7c. G\u1ED7 \u0111\u01B0\u1EE3c mang v\u1EC1 Nh\xE0 chung (\u0111\u1ED1ng l\u1EEDa). Thanh tr\xEAn c\xF9ng cho bi\u1EBFt \u0111ang c\xF3 bao nhi\xEAu g\u1ED7. C\u1EA7n 10 g\u1ED7 \u0111\u1EC3 d\u1EF1ng nh\xE0 \u0111\u1EA7u ti\xEAn.', after: ["c1_node"], done: { type: "stock", res: "wood", count: 10 } },
    { id: "c1_speed", chapter: 1, title: "Tua nhanh qua \u0111\xEAm", hint: "M\u1ED9t ng\xE0y game c\xF3 12 ph\xFAt ban ng\xE0y v\xE0 8 ph\xFAt ban \u0111\xEAm; ban \u0111\xEAm d\xE2n \u0111i ng\u1EE7 v\xE0 kh\xF4ng l\xE0m vi\u1EC7c. B\u1EA5m 16\xD7 \u1EDF thanh t\u1ED1c \u0111\u1ED9 ph\xEDa tr\xEAn \u0111\u1EC3 tua qua \u0111\xEAm. Nh\u1EDB tr\u1EDF l\u1EA1i 1\xD7 khi c\u1EA7n ra l\u1EC7nh k\u1EF9.", after: ["c1_wood"], done: { type: "speed", atLeast: 16 } },
    { id: "c1_day2", chapter: 1, title: "Ch\u1EDD tr\u1EDDi s\xE1ng ng\xE0y 2", hint: 'M\u1ED7i ng\xE0y m\u1EDBi, m\u1ED9t \u0111\u1EBFn ba ng\u01B0\u1EDDi l\u1EA1 \u0111\u1EBFn xin \u1EDF l\u1EA1i c\u1EA1nh \u0111\u1ED1ng l\u1EEDa. \u0110\u1EE3i t\u1EDBi s\xE1ng ng\xE0y 2 (\u0111\u1ED3ng h\u1ED3 tr\xEAn c\xF9ng ghi "Ng\xE0y 2 \xB7 ban ng\xE0y") r\u1ED3i gi\u1EA3m t\u1ED1c \u0111\u1ED9.', after: ["c1_speed"], done: { type: "daytime", day: 2 } },
    { id: "c1_pop", chapter: 1, title: "\u0110\xF3n ng\u01B0\u1EDDi m\u1EDBi", hint: "Ng\u01B0\u1EDDi m\u1EDBi \u0111\u1EBFn ch\u01B0a c\xF3 ngh\u1EC1: h\u1ECD \u0111\u1EE9ng r\u1EA3nh quanh l\u1EEDa. Nh\xE0 chung c\u1EA5p 1 ch\u1EE9a \u0111\u01B0\u1EE3c 8 ng\u01B0\u1EDDi. Nh\u1EDB gi\u1EEF l\u01B0\u01A1ng th\u1EF1c \u0111\u1EE7 cho m\u1ECDi ng\u01B0\u1EDDi \u0103n.", after: ["c1_day2"], done: { type: "population", count: 3 } },
    { id: "c1_wood2", chapter: 1, title: "Th\xEAm m\u1ED9t ng\u01B0\u1EDDi \u0111\u1ED1n g\u1ED7", hint: 'M\u1EDF X\u01B0\u1EDFng g\u1ED7 (\u2630), trong danh s\xE1ch "D\xE2n r\u1EA3nh" b\u1EA5m \uFF0B c\u1EA1nh m\u1ED9t ng\u01B0\u1EDDi \u0111\u1EC3 giao ngh\u1EC1 \u0111\u1ED1n g\u1ED7. Danh s\xE1ch ch\u1EC9 hi\u1EC7n ng\u01B0\u1EDDi ch\u01B0a c\xF3 ngh\u1EC1; mu\u1ED1n \u0111\u1ED5i ngh\u1EC1 c\u1EE7a ai th\xEC b\u1EA5m \u2212 \u1EDF nh\xE0 c\u0169 tr\u01B0\u1EDBc.', after: ["c1_pop"], done: { type: "hasRole", role: "wood", count: 2 } },
    { id: "c1_builder", chapter: 1, title: "D\u1EF1ng Nh\xE0 th\u1EE3 x\xE2y", hint: 'B\u1EA5m n\xFAt "X\xE2y" (g\xF3c ph\u1EA3i tr\xEAn), tab "Thi\u1EBFt y\u1EBFu", ch\u1ECDn Nh\xE0 th\u1EE3 x\xE2y (10 g\u1ED7). Khung v\xE0ng n\xE9t \u0111\u1EE9t l\xE0 ch\u1ED7 tr\u1ED1ng 2 \xF4 c\u1EA7n c\xF3 quanh m\u1ED7i nh\xE0; ch\u1EA1m v\xE0o v\xF9ng cam c\u1EE7a nh\xE0 kh\xE1c th\xEC kh\xF4ng \u0111\u1EB7t \u0111\u01B0\u1EE3c. Ch\u01B0a c\xF3 th\u1EE3 n\xEAn h\xE3y ch\u1ECDn m\u1ED9t d\xE2n r\u1ED3i ch\u1EA1m v\xE0o n\u1EC1n nh\xE0 \u0111\u1EC3 h\u1ECD d\u1EF1ng.', after: ["c1_wood2"], done: { type: "buildBuilding", kind: "builder", count: 1 } },
    { id: "c1_crew", chapter: 1, title: "Giao vi\u1EC7c th\u1EE3 x\xE2y", hint: 'Ch\u1ECDn Nh\xE0 th\u1EE3 x\xE2y, b\u1EA5m \u2630, tab "Th\u1EE3 x\xE2y", r\u1ED3i b\u1EA5m \uFF0B \u0111\u1EC3 th\xEAm ng\u01B0\u1EDDi l\xE0m th\u1EE3. T\u1EEB gi\u1EDD m\u1ECDi n\u1EC1n nh\xE0 v\xE0 vi\u1EC7c n\xE2ng c\u1EA5p \u0111\u1EC1u do h\u1ECD l\xE0m. Nh\xE0 th\u1EE3 x\xE2y hi\u1EC7n "zzzz" khi h\u1EBFt vi\u1EC7c.', after: ["c1_builder"], done: { type: "jobCount", job: "build", count: 1 } },
    { id: "c1_storage", chapter: 1, title: "D\u1EF1ng Kho", hint: 'Tab "Thi\u1EBFt y\u1EBFu" c\xF3 Kho. Kho ch\u1EE9a g\u1ED7, \u0111\xE1, th\u1EE9c \u0103n... m\u1ED7i lo\u1EA1i c\xF3 gi\u1EDBi h\u1EA1n; kho \u0111\u1EA7y th\xEC d\xE2n \u0111\u1EE9ng ch\u1EDD. N\xE2ng c\u1EA5p Kho \u0111\u1EC3 ch\u1EE9a nhi\u1EC1u h\u01A1n. M\u1ED7i lo\u1EA1i nh\xE0 ch\u1EC9 x\xE2y \u0111\u01B0\u1EE3c m\u1ED9t c\xE1i.', after: ["c1_crew"], done: { type: "buildBuilding", kind: "storage", count: 1 } },
    { id: "c1_farmhouse", chapter: 1, title: "M\u1EDF N\xF4ng tr\u1EA1i", hint: "N\xF4ng tr\u1EA1i (nh\xE0 c\u1EA1nh \u0111\u1ED1ng l\u1EEDa) qu\u1EA3n l\xFD ng\u01B0\u1EDDi h\xE1i l\u01B0\u1EE3m. Ch\u1ECDn n\xF3 r\u1ED3i b\u1EA5m \u2630 \u0111\u1EC3 xem ai \u0111ang h\xE1i qu\u1EA3 v\xE0 nh\xE0 c\xF2n m\u1EA5y ch\u1ED7.", after: ["c1_storage"], done: { type: "openBuilding", kind: "farmhouse" } },
    { id: "c1_stone", chapter: 1, title: "Giao th\u1EE3 \u0111\xE1", hint: "M\u1EDF X\u01B0\u1EDFng \u0111\xE1 (nh\xE0 c\u1EA1nh \u0111\u1ED1ng l\u1EEDa) b\u1EB1ng \u2630 r\u1ED3i b\u1EA5m \uFF0B \u1EDF m\u1ED9t ng\u01B0\u1EDDi r\u1EA3nh. \u0110\xE1 c\u1EA7n \u0111\u1EC3 n\xE2ng c\u1EA5p nh\xE0 l\xEAn c\u1EA5p 2 v\xE0 n\xE2ng Nh\xE0 chung.", after: ["c1_storage"], done: { type: "hasRole", role: "stone", count: 1 } },
    { id: "c1_food", chapter: 1, title: "D\u1EF1 tr\u1EEF 30 th\u1EE9c \u0103n", hint: "Cu\u1ED1i m\u1ED7i ng\xE0y m\u1ED7i d\xE2n \u0103n 2 th\u1EE9c \u0103n, m\u1ED7i l\xEDnh 3 (t\u0103ng theo c\u1EA5p l\u1EEDa tr\u1EA1i); th\u1EE9c \u0103n thu v\u1EC1 \u0111\u1ED5 v\xE0o ph\u1EA7n \u0103n c\u1EE7a l\u1EEDa tr\u1EA1i tr\u01B0\u1EDBc, d\u01B0 m\u1EDBi v\xE0o kho. N\xF4ng tr\u1EA1i qu\u1EA3n l\xFD ng\u01B0\u1EDDi h\xE1i l\u01B0\u1EE3m: th\xEAm ng\u01B0\u1EDDi h\xE1i \u1EDF \u0111\xF3. B\u1EE5i qu\u1EA3 ch\u1EC9 h\xE1i m\u1ED9t l\u1EA7n m\u1ED7i m\xF9a.", after: ["c1_farmhouse"], done: { type: "stock", res: "food", count: 30 } },
    { id: "c1_workshop", chapter: 1, title: "D\u1EF1ng Nh\xE0 ch\u1EBF t\u1EA1o", hint: 'Tab "S\u1EA3n xu\u1EA5t": Nh\xE0 ch\u1EBF t\u1EA1o. D\xE2n l\xE0m vi\u1EC7c b\xEAn trong nh\xE0 \u0111\u1EC3 l\xE0m c\xF4ng c\u1EE5, v\u0169 kh\xED, gi\xE1p.', after: ["c1_storage"], done: { type: "buildBuilding", kind: "workshop", count: 1 } },
    { id: "c1_workshop_staff", chapter: 1, title: "\u0110\u01B0a ng\u01B0\u1EDDi v\xE0o Nh\xE0 ch\u1EBF t\u1EA1o", hint: 'M\u1EDF Nh\xE0 ch\u1EBF t\u1EA1o (\u2630), tab "\u0110ang l\xE0m", b\u1EA5m \uFF0B \u0111\u1EC3 cho m\u1ED9t ng\u01B0\u1EDDi r\u1EA3nh v\xE0o l\xE0m. Ng\u01B0\u1EDDi c\xE0ng kh\xE9o l\xE0m c\xE0ng nhanh. Kh\xF4ng c\xF3 ng\u01B0\u1EDDi th\xEC nh\xE0 hi\u1EC7n "zzzz".', after: ["c1_workshop"], done: { type: "staffIn", kind: "workshop", count: 1 } },
    { id: "c1_torch", chapter: 1, title: "Ch\u1EBF m\u1ED9t c\xE2y \u0111u\u1ED1c", hint: 'Tab "C\xF4ng c\u1EE5" c\u1EE7a Nh\xE0 ch\u1EBF t\u1EA1o c\xF3 \u0110u\u1ED1c (b\u1EA3n v\u1EBD bi\u1EBFt s\u1EB5n): b\u1EA5m + \u0111\u1EC3 \u0111\u1EB7t \u0111\u01A1n, c\u1EA7n g\u1ED7. \u0110u\u1ED1c cho ph\xE9p l\xE0m vi\u1EC7c ban \u0111\xEAm v\u1EDBi 70% hi\u1EC7u su\u1EA5t, nh\u01B0ng l\xE0m \u0111\xEAm li\xEAn t\u1EE5c khi\u1EBFn d\xE2n m\u1EC7t.', after: ["c1_workshop_staff"], done: { type: "torches", count: 1 } },
    { id: "c1_toolstore", chapter: 1, title: "D\u1EF1ng Kho c\xF4ng c\u1EE5", hint: 'C\u1EA5t r\xECu, cu\u1ED1c, b\xFAa l\xE0m ra \u0111\u1EC3 ph\xE1t cho d\xE2n. Mu\u1ED1n d\xE2n t\u1EF1 l\u1EA5y \u0111\u1ED3 \u1EDF kho th\xEC ph\u1EA3i nghi\xEAn c\u1EE9u "T\u1EF1 l\u1EA5y \u0111\u1ED3 trong kho" (ch\u01B0\u01A1ng 2).', after: ["c1_workshop"], done: { type: "buildBuilding", kind: "toolstore", count: 1 } },
    { id: "c1_armory", chapter: 1, title: "D\u1EF1ng Kho v\u0169 kh\xED", hint: "C\u1EA5t v\u0169 kh\xED v\xE0 gi\xE1p cho th\u1EE3 s\u0103n v\xE0 l\xEDnh.", after: ["c1_workshop"], done: { type: "buildBuilding", kind: "armory", count: 1 } },
    { id: "c1_hide", chapter: 1, title: "Ki\u1EBFm 3 da", hint: 'Ch\xF2i th\u1EE3 s\u0103n c\u1EA7n 3 da, m\xE0 da ch\u1EC9 c\xF3 khi s\u0103n th\xFA. H\xE1i l\u01B0\u1EE3m \u0111\xF4i khi nh\u1EB7t \u0111\u01B0\u1EE3c v\u1ECF s\xF2 (ti\u1EC1n); m\u1EDF Kho (\u2630), tab "\u0110\u1ED5i ch\xE1c" \u0111\u1EC3 \u0111\u1ED5i v\u1ECF s\xF2 l\u1EA5y da.', after: ["c1_storage"], done: { type: "stock", res: "hide", count: 3 } },
    { id: "c1_lodge", chapter: 1, title: "D\u1EF1ng Ch\xF2i th\u1EE3 s\u0103n", hint: 'Tab "T\xE0i nguy\xEAn": Ch\xF2i th\u1EE3 s\u0103n. Th\u1EE3 s\u0103n t\u1EF1 \u0111i t\xECm v\xE0 s\u0103n th\xFA, t\u1EF1 l\u1ED9t da mang v\u1EC1, kh\xF4ng c\u1EA7n ch\u1EC9 \u0111\u1EA1o.', after: ["c1_hide"], done: { type: "buildBuilding", kind: "huntlodge", count: 1 } },
    { id: "c1_hunter", chapter: 1, title: "Giao ngh\u1EC1 th\u1EE3 s\u0103n", hint: "M\u1EDF Ch\xF2i th\u1EE3 s\u0103n (\u2630) v\xE0 b\u1EA5m \uFF0B \u1EDF m\u1ED9t ng\u01B0\u1EDDi nhanh nh\u1EB9n. H\u1EBFt m\u1ED3i g\u1EA7n h\u1ECD s\u1EBD t\u1EF1 \u0111i tu\u1EA7n t\xECm th\xFA; v\u1EC1 sau ch\u1EBF d\xE2y qu\u0103ng ho\u1EB7c gi\xE1o cho h\u1ECD \u0111\u1EC3 an to\xE0n h\u01A1n.", after: ["c1_lodge"], done: { type: "hasRole", role: "hunt", count: 1 } },
    { id: "c1_ready", chapter: 1, title: "D\u1EF1ng \u0111\u1EE7 nh\xE0 c\u1EA5p 1", hint: "Nh\xE0 chung ch\u1EC9 n\xE2ng c\u1EA5p khi m\u1ECDi nh\xE0 \u0111\xE3 m\u1EDF \u1EDF c\u1EA5p 1 \u0111\u1EC1u x\xE2y xong: Nh\xE0 th\u1EE3 x\xE2y, Kho, Nh\xE0 ch\u1EBF t\u1EA1o, Kho c\xF4ng c\u1EE5, Kho v\u0169 kh\xED, Ch\xF2i th\u1EE3 s\u0103n v\xE0 ba nh\xE0 s\u1EB5n c\xF3. D\xF2ng d\u01B0\u1EDBi nhi\u1EC7m v\u1EE5 cho bi\u1EBFt c\xF2n thi\u1EBFu nh\xE0 n\xE0o.", after: ["c1_stone", "c1_food", "c1_torch", "c1_toolstore", "c1_armory", "c1_hunter"], done: { type: "fireReady", level: 1 } },
    { id: "c1_fire2", chapter: 1, title: "N\xE2ng Nh\xE0 chung l\xEAn c\u1EA5p 2", hint: "Ch\u1ECDn \u0111\u1ED1ng l\u1EEDa, b\u1EA5m \u2B06 r\u1ED3i x\xE1c nh\u1EADn (c\u1EA7n 20 g\u1ED7), giao th\u1EE3 x\xE2y l\xE0m. C\u1EA5p 2 m\u1EDF Nh\xE0 nghi\xEAn c\u1EE9u, c\xE1c tr\u1EA1i l\xEDnh, nh\xE0 d\xE2n v\xE0 ru\u1ED9ng; l\xE0ng ch\u1EE9a 16 ng\u01B0\u1EDDi, nh\xE0 n\xE2ng \u0111\u01B0\u1EE3c l\xEAn c\u1EA5p 2.", after: ["c1_ready"], done: { type: "upgradeFire", level: 2 } },
    { id: "c2_lab", chapter: 2, title: "D\u1EF1ng Nh\xE0 nghi\xEAn c\u1EE9u", hint: 'Tab "S\u1EA3n xu\u1EA5t": Nh\xE0 nghi\xEAn c\u1EE9u. M\u1ECDi c\xF4ng c\u1EE5 v\xE0 v\u0169 kh\xED ch\u1EC9 l\xE0m \u0111\u01B0\u1EE3c sau khi nghi\xEAn c\u1EE9u b\u1EA3n v\u1EBD \u1EDF \u0111\xE2y.', after: ["c1_fire2"], done: { type: "buildBuilding", kind: "lab", count: 1 } },
    { id: "c2_lab_staff", chapter: 2, title: "\u0110\u01B0a ng\u01B0\u1EDDi v\xE0o nghi\xEAn c\u1EE9u", hint: 'M\u1EDF Nh\xE0 nghi\xEAn c\u1EE9u (\u2630), tab "\u0110ang l\xE0m", b\u1EA5m \uFF0B. Ng\u01B0\u1EDDi l\xE0m trong nh\xE0 c\xE0ng \u0111\xF4ng, nghi\xEAn c\u1EE9u c\xE0ng nhanh. Nh\xE0 hi\u1EC7n % ti\u1EBFn \u0111\u1ED9 khi \u0111ang nghi\xEAn c\u1EE9u.', after: ["c2_lab"], done: { type: "staffIn", kind: "lab", count: 1 } },
    { id: "c2_craft_axe", chapter: 2, title: "Ch\u1EBF m\u1ED9t c\xE1i r\xECu", hint: 'Nh\xE0 ch\u1EBF t\u1EA1o (\u2630), tab "C\xF4ng c\u1EE5": \u0111\u1EB7t R\xECu g\u1ED7. R\xECu xong v\xE0o Kho c\xF4ng c\u1EE5; \u0111\u01B0a cho ng\u01B0\u1EDDi \u0111\u1ED1n g\u1ED7 \u1EDF th\u1EBB c\u1EE7a h\u1ECD (\u2699), ho\u1EB7c \u0111\u1EC3 d\xE2n t\u1EF1 l\u1EA5y sau khi nghi\xEAn c\u1EE9u t\u1EF1 \u0111\u1ED9ng h\xF3a.', after: ["c2_lab_staff", "c1_workshop_staff"], done: { type: "haveTool", kind: "axe", tier: 1, count: 1 } },
    { id: "c2_house", chapter: 2, title: "D\u1EF1ng Nh\xE0 d\xE2n", hint: 'Tab "Thi\u1EBFt y\u1EBFu": Nh\xE0 d\xE2n. D\xE2n th\u01B0\u1EDDng ng\u1EE7 \u1EDF \u0111\xE2y v\xE0 h\u1ED3i s\u1EE9c \u0111\u1EA7y \u0111\u1EE7; kh\xF4ng c\xF3 gi\u01B0\u1EDDng th\xEC h\u1ECD ng\u1EE7 c\u1EA1nh l\u1EEDa, h\u1ED3i s\u1EE9c ch\u1EADm h\u01A1n.', after: ["c1_fire2"], done: { type: "buildBuilding", kind: "house", count: 1 } },
    { id: "c2_upgrade", chapter: 2, title: "N\xE2ng Kho l\xEAn c\u1EA5p 2", hint: "Ch\u1ECDn Kho, b\u1EA5m \u2B06, x\xE1c nh\u1EADn r\u1ED3i giao th\u1EE3 x\xE2y. Nh\xE0 v\u1EABn d\xF9ng \u0111\u01B0\u1EE3c trong l\xFAc n\xE2ng. M\u1ED7i c\u1EA5p t\u1ED1n nhi\u1EC1u v\u1EADt li\u1EC7u h\u01A1n nh\u01B0ng ch\u1EE9a v\xE0 l\xE0m vi\u1EC7c t\u1ED1t h\u01A1n.", after: ["c2_lab_staff"], done: { type: "upgradeBuilding", kind: "storage", level: 2 } },
    { id: "c2_barracks", chapter: 2, title: "D\u1EF1ng Tr\u1EA1i chi\u1EBFn binh", hint: 'Tab "Qu\xE2n s\u1EF1": Tr\u1EA1i chi\u1EBFn binh. L\xEDnh ng\u1EE7 \u1EDF \u0111\xE2y v\xE0 h\u1ED3i s\u1EE9c nhanh h\u01A1n n\u1EB1m c\u1EA1nh l\u1EEDa.', after: ["c1_fire2"], done: { type: "buildBuilding", kind: "infantry", count: 1 } },
    { id: "c2_soldier", chapter: 2, title: "Tuy\u1EC3n m\u1ED9t chi\u1EBFn binh", hint: "M\u1EDF Tr\u1EA1i chi\u1EBFn binh (\u2630) v\xE0 b\u1EA5m \uFF0B. L\xEDnh canh g\xE1c, \u0111\xE1nh \u0111\u1ECBch v\xE0 th\xFA d\u1EEF. V\u1EC1 sau ch\u1EBF g\u1EADy chi\u1EBFn (nghi\xEAn c\u1EE9u B\u1EA3n v\u1EBD G\u1EADy chi\u1EBFn) v\xE0 \xE1o da cho h\u1ECD.", after: ["c2_barracks"], done: { type: "hasRole", role: "foot", count: 1 } },
    { id: "c2_soldiers3", chapter: 2, title: "C\xF3 3 chi\u1EBFn binh", hint: "M\u1EDF Tr\u1EA1i chi\u1EBFn binh (\u2630) v\xE0 b\u1EA5m \uFF0B th\xEAm hai ng\u01B0\u1EDDi n\u1EEFa. L\xEDnh \u0103n nh\u01B0 d\xE2n nh\u01B0ng kh\xF4ng l\xE0m vi\u1EC7c nh\xE0; \u0111\u1EEBng tuy\u1EC3n h\u1EBFt ng\u01B0\u1EDDi \u0111ang l\xE0m ra l\u01B0\u01A1ng th\u1EF1c. L\xEDnh ng\u1EE7 \u1EDF tr\u1EA1i v\xE0 h\u1ED3i s\u1EE9c nhanh h\u01A1n.", after: ["c2_soldier"], done: { type: "hasRole", role: "foot", count: 3 } },
    { id: "c2_club_make", chapter: 2, title: "Ch\u1EBF 3 g\u1EADy chi\u1EBFn", hint: 'Nh\xE0 ch\u1EBF t\u1EA1o (\u2630), tab "V\u0169 kh\xED": \u0111\u1EB7t 3 G\u1EADy chi\u1EBFn. Ch\xFAng v\xE0o Kho v\u0169 kh\xED, n\xEAn c\u1EA7n Kho v\u0169 kh\xED \u0111\xE3 d\u1EF1ng.', after: ["c2_lab_staff", "c2_barracks", "c1_armory"], done: { type: "haveTool", kind: "club", tier: 1, count: 3 } },
    { id: "c2_equip", chapter: 2, title: "Trang b\u1ECB g\u1EADy cho 2 l\xEDnh", hint: 'B\u1EA5m m\u1ED9t l\xEDnh, n\xFAt "Giao vi\u1EC7c v\xE0 chi ti\u1EBFt" (\u2699), m\u1EE5c v\u0169 kh\xED, ch\u1ECDn G\u1EADy chi\u1EBFn. L\xEDnh c\u1EA7m v\u0169 kh\xED \u0111\xE1nh m\u1EA1nh h\u01A1n nhi\u1EC1u; v\u0169 kh\xED c\u0169ng m\xF2n d\u1EA7n v\xE0 c\u1EA7n s\u1EEDa nh\u01B0 c\xF4ng c\u1EE5.', after: ["c2_club_make", "c2_soldiers3"], done: { type: "equipped", slot: "weapon", count: 2 } },
    { id: "c2_armor_make", chapter: 2, title: "Ch\u1EBF m\u1ED9t \xE1o da", hint: 'Nh\xE0 ch\u1EBF t\u1EA1o (\u2630), tab "\xC1o gi\xE1p": \u0111\u1EB7t \xC1o da. \xC1o xong v\xE0o Kho v\u0169 kh\xED.', after: ["c2_lab_staff", "c2_equip"], done: { type: "haveTool", kind: "hide", tier: 1, count: 1 } },
    { id: "c2_armor_wear", chapter: 2, title: "M\u1EB7c \xE1o da cho m\u1ED9t l\xEDnh", hint: "C\u0169ng \u1EDF b\u1EA3ng \u2699 c\u1EE7a l\xEDnh, m\u1EE5c gi\xE1p. Gi\xE1p gi\u1EA3m s\xE1t th\u01B0\u01A1ng nh\u01B0ng n\u1EB7ng n\xEAn t\u1ED1n s\u1EE9c h\u01A1n m\u1ED9t ch\xFAt.", after: ["c2_armor_make"], done: { type: "equipped", slot: "armor", count: 1 } },
    { id: "c2_wartent", chapter: 2, title: "D\u1EF1ng L\u1EC1u h\u1ECDp chi\u1EBFn", hint: "N\u01A1i l\u1EADp \u0111\u1ED9i, ch\u1ECDn tr\u1EADn ph\xE1p v\xE0 k\u1EBF ho\u1EA1ch. M\u1EDF n\xF3 th\xEC game t\u1EA1m d\u1EEBng.", after: ["c2_barracks"], done: { type: "buildBuilding", kind: "wartent", count: 1 } },
    { id: "c2_scouttent", chapter: 2, title: "D\u1EF1ng Tr\u1EA1i trinh s\xE1t", hint: 'N\xFAt \u{1F528} X\xE2y, tab "Qu\xE2n s\u1EF1": Tr\u1EA1i trinh s\xE1t. Trinh s\xE1t \u0111i v\u1EBD b\u1EA3n \u0111\u1ED3 l\xE0ng kh\xE1c \u0111\u1EC3 b\u1EA1n bi\u1EBFt \u0111\u1ECBch c\xF3 bao nhi\xEAu l\xEDnh tr\u01B0\u1EDBc khi \u0111\xE1nh. C\u1EA5p tr\u1EA1i c\xE0ng cao, v\u1EBD \u0111\u01B0\u1EE3c b\u1EA3n \u0111\u1ED3 c\xE0ng chi ti\u1EBFt v\xE0 m\u1ED9t chuy\u1EBFn c\u1EED \u0111\u01B0\u1EE3c c\xE0ng nhi\u1EC1u ng\u01B0\u1EDDi.', after: ["c2_lab_staff"], done: { type: "buildBuilding", kind: "scouttent", count: 1 } },
    { id: "c2_scouts", chapter: 2, title: "Tuy\u1EC3n m\u1ED9t trinh s\xE1t", hint: "M\u1EDF Tr\u1EA1i trinh s\xE1t (\u2630), b\u1EA5m \uFF0B \u1EDF m\u1ED9t ng\u01B0\u1EDDi nhanh nh\u1EB9n. Cho h\u1ECD \u0111u\u1ED1c v\xE0 gi\xE1p (\u2699) th\xEC \u0111i an to\xE0n v\xE0 th\xE0nh c\xF4ng h\u01A1n.", after: ["c2_scouttent"], done: { type: "hasRole", role: "scout", count: 1 } },
    { id: "c2_find", chapter: 2, title: "T\xECm m\u1ED9t ng\xF4i l\xE0ng", hint: 'L\xE0ng kh\xE1c ch\u1EC9 hi\u1EC7n khi ng\u01B0\u1EDDi c\u1EE7a b\u1EA1n \u0111i ngang qua r\u1ED3i v\u1EC1 t\u1EDBi \u0111\u1ED1ng l\u1EEDa. Cho d\xE2n ho\u1EB7c l\xEDnh \u0111i quanh b\u1EA3n \u0111\u1ED3 (b\u1EA5m b\u1EA3n \u0111\u1ED3 nh\u1ECF \u0111\u1EC3 m\u1EDF b\u1EA3n \u0111\u1ED3 l\u1EDBn). L\xE0ng t\xECm th\u1EA5y hi\u1EC7n trong Tr\u1EA1i trinh s\xE1t, m\u1EE5c "L\xE0ng \u0111\xE3 ph\xE1t hi\u1EC7n".', after: ["c2_scouts"], done: { type: "scoutSent" } },
    { id: "c2_map", chapter: 2, title: "C\xF3 b\u1EA3n \u0111\u1ED3 c\u1EA5p 1 c\u1EE7a m\u1ED9t l\xE0ng", hint: 'Tr\u1EA1i trinh s\xE1t: ch\u1ECDn l\xE0ng, ch\u1ECDn ng\u01B0\u1EDDi \u0111i, b\u1EA5m "L\xEAn \u0111\u01B0\u1EDDng". H\u1ECD \u0111i, quan s\xE1t r\u1ED3i v\u1EC1, m\u1EA5t v\xE0i ph\xFAt game; tua nhanh n\u1EBFu mu\u1ED1n ch\u1EDD. B\u1EA3n \u0111\u1ED3 c\u1EA5p 1 cho bi\u1EBFt v\u1ECB tr\xED v\xE0 \u0111\u1ED1ng l\u1EEDa c\u1EE7a l\xE0ng.', after: ["c2_find"], done: { type: "hasMap", level: 1 } },
    { id: "c2_form_tech", chapter: 2, title: "Nghi\xEAn c\u1EE9u Tr\u1EADn ph\xE1p c\u01A1 b\u1EA3n", hint: '\u1EDE Nh\xE0 nghi\xEAn c\u1EE9u c\u1EA5p 2, tab "Qu\xE2n s\u1EF1 b\u1EADc 1", r\u1ED3i tab "Chi\u1EBFn \u0111\u1EA5u b\u1EADc 1". M\u1EDF H\xE0ng ngang v\xE0 V\xF2ng tr\xF2n. Kh\xF4ng c\xF3 tr\u1EADn ph\xE1p th\xEC kh\xF4ng l\u1EADp \u0111\u01B0\u1EE3c \u0111\u1ED9i.', after: ["c2_lab_staff"], done: { type: "researchTech", id: "form_basic" } },
    { id: "c2_squad", chapter: 2, title: "L\u1EADp m\u1ED9t \u0111\u1ED9i", hint: 'M\u1EDF L\u1EC1u h\u1ECDp chi\u1EBFn, tab "K\u1EBF ho\u1EA1ch t\u1EA5n c\xF4ng", b\u1EA5m v\xE0o l\xE0ng \u0111\xE3 c\xF3 b\u1EA3n \u0111\u1ED3: b\u1EA3n \u0111\u1ED3 m\u1EDF to\xE0n m\xE0n h\xECnh. Nh\u1EA5n gi\u1EEF m\u1ED9t ch\u1ED7 tr\u1ED1ng, r\xEA t\u1EDBi m\u1ED9t tr\u1EADn ph\xE1p trong v\xF2ng tr\xF2n r\u1ED3i th\u1EA3, k\xE9o \u0111\u1EC3 v\u1EBD \u0111\u1ED9i h\xECnh (3 \u0111\u1EBFn 15 \xF4, m\u1ED7i \xF4 l\xE0 ch\u1ED7 c\u1EE7a m\u1ED9t l\xEDnh). M\u1EB7c \u0111\u1ECBnh l\u1EADp \u0111\u01B0\u1EE3c 4 \u0111\u1ED9i, m\u1ED7i tr\u1EADn 5 \xF4; nghi\xEAn c\u1EE9u m\u1EDF r\u1ED9ng \u1EDF tab "Qu\xE2n s\u1EF1".', after: ["c2_wartent", "c2_soldier", "c2_map", "c2_form_tech"], done: { type: "createSquad", count: 1 } },
    { id: "c2_squad_fill", chapter: 2, title: "Cho 3 l\xEDnh v\xE0o \u0111\u1ED9i", hint: 'Nh\u1EA5n gi\u1EEF \u0111\u1ED9i v\u1EEBa l\u1EADp, ch\u1ECDn "L\xEDnh", r\u1ED3i b\u1EA5m d\u1EA5u \uFF0B b\xEAn ph\u1EA3i t\xEAn t\u1EEBng l\xEDnh ch\u01B0a c\xF3 \u0111\u1ED9i. \u2605 \u0111\u1EB7t l\xE0m ch\u1EC9 huy. \u0110\u1ED9i c\u1EA7n \u0111\u1EE7 l\xEDnh cho s\u1ED1 \xF4 \u0111\xE3 v\u1EBD; \xF4 th\u1EEBa th\xEC d\xF9ng "S\u1EEDa" ho\u1EB7c "X\xF3a \xF4" \u0111\u1EC3 b\u1EDBt.', after: ["c2_squad", "c2_soldiers3"], done: { type: "squadSize", count: 3 } },
    { id: "c2_ready", chapter: 2, title: "N\xE2ng \u0111\u1EE7 nh\xE0 l\xEAn c\u1EA5p 2", hint: "Mu\u1ED1n n\xE2ng Nh\xE0 chung l\xEAn c\u1EA5p 3, m\u1ECDi nh\xE0 \u0111\xE3 m\u1EDF \u1EDF c\u1EA5p 2 (k\u1EC3 c\u1EA3 c\xE1c tr\u1EA1i, L\u1EC1u h\u1ECDp chi\u1EBFn, B\xE3i t\u1EADp, Chu\u1ED3ng th\xFA c\u01B0\u1EE1i, Tr\u1EA1i trinh s\xE1t) ph\u1EA3i c\xF3 m\u1EB7t v\xE0 \u0111\u1EA1t c\u1EA5p 2. D\xF2ng d\u01B0\u1EDBi nhi\u1EC7m v\u1EE5 cho bi\u1EBFt c\xF2n thi\u1EBFu g\xEC.", after: ["c2_upgrade", "c2_house", "c2_squad_fill", "c2_lab_staff", "c2_armor_wear"], done: { type: "fireReady", level: 2 } },
    { id: "c2_fire3", chapter: 2, title: "N\xE2ng Nh\xE0 chung l\xEAn c\u1EA5p 3", hint: "C\u1EA7n 20 g\u1ED7 v\xE0 12 \u0111\xE1. C\u1EA5p 3 m\u1EDF m\u1ECDi c\xF4ng tr\xECnh c\xF2n l\u1EA1i: h\xE0ng r\xE0o, c\u1ED5ng, ch\xF2i canh, h\u1ED1 ch\xF4ng, n\xF4ng tr\u1EA1i, x\u01B0\u1EDFng g\u1ED7, x\u01B0\u1EDFng \u0111\xE1...", after: ["c2_ready"], done: { type: "upgradeFire", level: 3 } },
    { id: "c3_fence", chapter: 3, title: "D\u1EF1ng h\xE0ng r\xE0o quanh l\xE0ng", hint: 'Tab "Ph\xF2ng th\u1EE7": H\xE0ng r\xE0o. Ch\u1EA1m ti\u1EBFp \u0111\u1EC3 \u0111\u1EB7t t\u1EEBng \u0111o\u1EA1n; r\xE0o \u0111\u1EB7t d\u1ECDc, ngang, g\xF3c \u0111\u1EC1u t\u1EF1 n\u1ED1i. R\xE0o ch\u1EB7n \u0111\u01B0\u1EDDng v\xE0 bu\u1ED9c \u0111\u1ECBch ph\u1EA3i ph\xE1. Nh\u1EDB ch\u1EEBa l\u1ED1i cho d\xE2n \u0111i l\u1EA1i.', after: ["c2_fire3"], done: { type: "buildBuilding", kind: "fence", count: 10 } },
    { id: "c3_gate", chapter: 3, title: "D\u1EF1ng m\u1ED9t c\xE1i C\u1ED5ng", hint: "C\u1ED5ng to v\xE0 cao h\u01A1n r\xE0o. Ch\u1ECDn c\u1ED5ng r\u1ED3i b\u1EA5m n\xFAt M\u1EDF/\u0110\xF3ng c\u1ED5ng: bi\u1EC3n xanh l\xE0 m\u1EDF, bi\u1EC3n \u0111\u1ECF l\xE0 \u0111\xF3ng. C\u1ED5ng \u0111\xF3ng ch\u1EB7n c\u1EA3 d\xE2n m\xECnh.", after: ["c3_fence"], done: { type: "buildBuilding", kind: "gate", count: 1 } },
    { id: "c3_tower", chapter: 3, title: "D\u1EF1ng Ch\xF2i canh", hint: "Cung th\u1EE7 tr\xEAn ch\xF2i b\u1EAFn xa v\xE0 m\u1EA1nh h\u01A1n. Ch\xF2i c\u1EA7n c\xF3 h\xE0ng r\xE0o l\xE0m \u0111i\u1EC1u ki\u1EC7n.", after: ["c3_fence"], done: { type: "buildBuilding", kind: "tower", count: 1 } },
    { id: "c3_archery", chapter: 3, title: "D\u1EF1ng Tr\u1EA1i th\u1EE3 n\xE9m", hint: 'N\xFAt \u{1F528} X\xE2y, tab "Qu\xE2n s\u1EF1": Tr\u1EA1i th\u1EE3 n\xE9m. Ng\u01B0\u1EDDi n\xE9m \u0111\xE1 \u0111\xE1nh t\u1EEB xa v\xE0 l\xEAn \u0111\u01B0\u1EE3c ch\xF2i canh. H\u1ECD c\u1EA7n D\xE2y qu\u0103ng \u0111\xE1, ch\u1EBF \u1EDF Nh\xE0 ch\u1EBF t\u1EA1o.', after: ["c3_tower"], done: { type: "buildBuilding", kind: "archery", count: 1 } },
    { id: "c3_archer", chapter: 3, title: "C\xF3 m\u1ED9t th\u1EE3 n\xE9m \u0111\xE1", hint: "M\u1EDF Tr\u1EA1i th\u1EE3 n\xE9m (\u2630), b\u1EA5m \uFF0B. Trang b\u1ECB D\xE2y qu\u0103ng \u0111\xE1 cho h\u1ECD \u1EDF b\u1EA3ng \u2699.", after: ["c3_archery"], done: { type: "hasRole", role: "archer", count: 1 } },
    { id: "c3_garrison", chapter: 3, title: "Cho th\u1EE3 n\xE9m l\xEAn ch\xF2i canh", hint: "Ch\u1ECDn Ch\xF2i canh, b\u1EA5m \u2630 r\u1ED3i \uFF0B \u0111\u1EC3 th\xEAm ng\u01B0\u1EDDi canh. Ng\u01B0\u1EDDi tr\xEAn ch\xF2i b\u1EAFn xa v\xE0 m\u1EA1nh h\u01A1n, v\xE0 kh\xF3 b\u1ECB \u0111\xE1nh h\u01A1n ng\u01B0\u1EDDi \u0111\u1EE9ng d\u01B0\u1EDBi \u0111\u1EA5t.", after: ["c3_archer"], done: { type: "staffIn", kind: "tower", count: 1 } },
    { id: "c3_defplan", chapter: 3, title: "L\u1EADp m\u1EABu ph\xF2ng th\u1EE7", hint: 'L\u1EC1u h\u1ECDp chi\u1EBFn, tab "Ph\xF2ng th\u1EE7", b\u1EA5m "L\u1EADp m\u1EABu ph\xF2ng th\u1EE7" r\u1ED3i giao v\u1ECB tr\xED cho t\u1EEBng \u0111\u1ED9i. Khi c\xF3 tin \u0111\u1ECBch t\u1EDBi, "\u0110\xE1nh tr\u1ED1ng b\xE1o \u0111\u1ED9ng": d\xE2n v\u1EC1 \u0111\u1ED1ng l\u1EEDa, c\xE1c \u0111\u1ED9i v\u1EC1 \u0111\xFAng ch\u1ED7, \u0111\u1ED9i \u0111\u1EE9ng ch\xF2i cho cung th\u1EE7 l\xEAn ch\xF2i.', after: ["c3_gate", "c2_squad_fill"], done: { type: "planDefense" } },
    { id: "c3_trap", chapter: 3, title: "G\xE0i h\u1ED1 ch\xF4ng", hint: "H\u1ED1 ch\xF4ng g\xE0i tr\xEAn \u0111\u01B0\u1EDDng \u0111\u1ECBch t\u1EDBi, m\u1ED7i h\u1ED1 l\xE0m b\u1ECB th\u01B0\u01A1ng v\xE0i ng\u01B0\u1EDDi. \u0110\u1EB7t t\u1EEBng c\xE1i m\u1ED9t.", after: ["c3_fence"], done: { type: "buildBuilding", kind: "trap", count: 2 } },
    { id: "c3_signal", chapter: 3, title: "Nghi\xEAn c\u1EE9u T\xEDn hi\u1EC7u", hint: "Tr\u1ED1ng b\xE1o \u0111\u1ED9ng: d\xE2n v\u1EC1 l\u1EEDa, qu\xE2n v\u1EC1 v\u1ECB tr\xED. Th\xEAm th\u1EBB l\u1EC7nh cho k\u1EBF ho\u1EA1ch.", after: ["c3_tower"], done: { type: "researchTech", id: "signal" } },
    { id: "c3_wedge", chapter: 3, title: "Nghi\xEAn c\u1EE9u Tr\u1EADn m\u0169i nh\u1ECDn", hint: "Tr\u1EADn xung phong ph\xE1 h\xE0ng. Luy\u1EC7n thu\u1EA7n th\u1EE5c \u1EDF B\xE3i t\u1EADp.", after: ["c2_squad"], done: { type: "researchTech", id: "form_wedge" } },
    { id: "c3_ready", chapter: 3, title: "N\xE2ng \u0111\u1EE7 nh\xE0 l\xEAn c\u1EA5p 3", hint: "M\u1ECDi nh\xE0 \u0111\xE3 m\u1EDF \u1EDF c\u1EA5p 3 ph\u1EA3i c\xF3 m\u1EB7t v\xE0 \u0111\u1EA1t c\u1EA5p 3 (h\xE0ng r\xE0o, c\u1ED5ng, ch\xF2i canh v\xE0 h\u1ED1 ch\xF4ng \u0111\u1EA1t c\u1EA5p t\u1ED1i \u0111a c\u1EE7a ch\xFAng). D\xF2ng d\u01B0\u1EDBi nhi\u1EC7m v\u1EE5 cho bi\u1EBFt c\xF2n thi\u1EBFu g\xEC.", after: ["c3_gate", "c3_tower", "c3_trap", "c3_signal", "c3_garrison", "c3_defplan"], done: { type: "fireReady", level: 3 } },
    { id: "c3_target", chapter: 3, title: "Ch\u1ECDn m\u1EE5c ti\xEAu cho \u0111\u1ED9i", hint: 'M\u1EDF b\u1EA3n \u0111\u1ED3 c\u1EE7a l\xE0ng \u0111\u1ECBch (L\u1EC1u h\u1ECDp chi\u1EBFn, "K\u1EBF ho\u1EA1ch t\u1EA5n c\xF4ng"). B\u1EA5m v\xE0o \u0111\u1ED9i \u0111\u1EC3 ch\u1ECDn, r\u1ED3i b\u1EA5m v\xE0o m\u1ED9t c\xF4ng tr\xECnh ho\u1EB7c ng\u01B0\u1EDDi c\u1EE7a \u0111\u1ECBch: m\u0169i t\xEAn ch\u1EA1y t\u1EEB \u0111\u1ED9i t\u1EDBi \u0111\xF3. Nh\u1EA5n gi\u1EEF m\u0169i t\xEAn \u0111\u1EC3 S\u1EEDa (k\xE9o c\xE1c ch\u1EA5m gi\u1EEFa, t\u1ED1i \u0111a 3 ch\u1ED7 g\u1EA5p kh\xFAc) ho\u1EB7c X\xF3a. Ch\u1ECDn m\u1EE5c ti\xEAu nh\u1ECF tr\u01B0\u1EDBc, nh\u01B0 m\u1ED9t kho hay m\u1ED9t nh\xE0. \u0110o\u1EA1n m\u0169i t\xEAn m\xE0u \u0111\u1ECF l\xE0 ch\u1ED7 c\xF3 v\u1EADt c\u1EA3n: c\xE2y, \u0111\xE1, b\u1EE5i qu\u1EA3 th\xEC l\u1EADp m\u1ED9t \u0111\u1ED9i h\u1EADu c\u1EA7n (c\xF3 l\xEDnh nh\u01B0ng kh\xF4ng v\u1EBD m\u0169i t\xEAn) \u0111i tr\u01B0\u1EDBc ph\xE1 h\u1EBFt; n\u01B0\u1EDBc v\xE0 c\xF4ng tr\xECnh c\u1EE7a l\xE0ng kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c n\xEAn h\xE3y u\u1ED1n m\u0169i t\xEAn \u0111i v\xF2ng.', after: ["c2_fire3", "c2_squad_fill"], done: { type: "planArrow" } },
    { id: "c3_deploy", chapter: 3, title: "Tri\u1EC3n khai qu\xE2n", hint: 'B\u1EA5m "\u2694 Tri\u1EC3n khai tr\u1EADn chi\u1EBFn", \u0111\u1ECDc b\xE1o c\xE1o c\u1EE7a h\u1ED9i \u0111\u1ED3ng chi\u1EBFn: c\xE1c d\xF2ng \u2717 l\xE0 \u0111i\u1EC1u \u0111ang ch\u1EB7n, s\u1EEDa xong m\u1EDBi x\xE1c nh\u1EADn \u0111\u01B0\u1EE3c. X\xE1c nh\u1EADn: c\xE1c \u0111\u1ED9i \u0111i t\u1EDBi \xF4 \u0111\xE3 v\u1EBD r\u1ED3i \u0111\u1EE9ng ch\u1EDD. L\xE0ng c\u1EE7a b\u1EA1n v\u1EABn c\u1EA7n ng\u01B0\u1EDDi canh.', after: ["c3_target"], done: { type: "planRunning" } },
    { id: "c3_trial", chapter: 3, title: "Chi\u1EBFn \u0111\u1EA5u th\u1EED", hint: 'Khi c\u1EA3 \u0111\u1ED9i \u0111\xE3 v\xE0o v\u1ECB tr\xED, b\u1EA5m "\u2694 \u0110\xE1nh" tr\xEAn m\xE0n h\xECnh game. N\u1EBFu th\u1EA5y s\u1EAFp thua, b\u1EA5m "\u21A9 R\xFAt lui": m\u1ED7i \u0111\u1ED9i r\xFAt theo \u0111\u01B0\u1EDDng \u0111\xE3 v\u1EBD. Th\u1EAFng hay thua \u0111\u1EC1u t\xEDnh, v\xEC \u0111\xE2y l\xE0 tr\u1EADn th\u1EED: xem \u0111\u1ED9i \u0111\xE1nh ra sao \u1EDF "Nh\u1EADt k\xFD tr\u1EADn" v\xE0 ch\u1EC9nh k\u1EBF ho\u1EA1ch cho l\u1EA7n sau.', after: ["c3_deploy"], done: { type: "planDone" } },
    { id: "c3_fire4", chapter: 3, title: "N\xE2ng Nh\xE0 chung l\xEAn c\u1EA5p 4", hint: "C\u1EA7n 50 g\u1ED7, 30 \u0111\xE1 v\xE0 10 da. Ho\xE0n th\xE0nh k\u1EBF ho\u1EA1ch: l\xE0ng ch\u1EE9a 40 ng\u01B0\u1EDDi v\xE0 \u0111\xE3 \u0111\u1EE7 m\u1EA1nh \u0111\u1EC3 t\u1EF1 v\u1EC7.", after: ["c3_ready"], done: { type: "upgradeFire", level: 4 } },
    { id: "c4_win", chapter: 4, title: "Th\u1EAFng m\u1ED9t tr\u1EADn", hint: "\u0110\xE1nh l\u1EA1i sau khi s\u1EEDa k\u1EBF ho\u1EA1ch: th\xEAm \u0111\u1ED9i, m\u1EB7c gi\xE1p cho l\xEDnh, \u0111\xE1nh v\xE0o l\xFAc tr\u1EDDi s\xE1ng \u0111\u1EC3 l\xEDnh nh\xECn xa h\u01A1n, hay ch\u1EDD c\xF3 b\u1EA3n \u0111\u1ED3 c\u1EA5p 2 (\u0111\u01B0\u1EDDng v\xE0o, h\xE0ng r\xE0o) v\xE0 c\u1EA5p 3 (s\u1ED1 l\xEDnh t\u1EEBng lo\u1EA1i). Th\u1EAFng l\xE0 h\u1EBFt l\xEDnh \u0111\u1ECBch, l\u1EEDa t\u1EAFt v\xE0 m\u1ECDi c\xF4ng tr\xECnh s\u1EADp.", after: ["c3_trial", "c3_fire4"], done: { type: "planDone", result: "won" } },
    { id: "c4_wedge", chapter: 4, title: "L\u1EADp m\u1ED9t \u0111\u1ED9i M\u0169i nh\u1ECDn", hint: "Sau khi nghi\xEAn c\u1EE9u Tr\u1EADn m\u0169i nh\u1ECDn: xung phong \xD71,4 khi lao v\xE0o \u0111\u1ECBch nh\u01B0ng hai c\xE1nh y\u1EBFu. H\u1EE3p v\u1EDBi k\u1EBB \u0111\u1ECBch \u0111\u1EE9ng th\u01B0a. L\u1EADp \u0111\u1ED9i m\u1EDBi tr\xEAn b\u1EA3n \u0111\u1ED3 l\xE0ng, nh\u1EA5n gi\u1EEF r\u1ED3i ch\u1ECDn M\u0169i nh\u1ECDn.", after: ["c3_wedge", "c2_map"], done: { type: "squadFormation", id: "wedge" } },
    { id: "c4_stable", chapter: 4, title: "D\u1EF1ng Chu\u1ED3ng th\xFA c\u01B0\u1EE1i", hint: 'N\xFAt \u{1F528} X\xE2y, tab "T\xE0i nguy\xEAn": Chu\u1ED3ng th\xFA c\u01B0\u1EE1i. D\xE2n l\xE0m trong chu\u1ED3ng thu\u1EA7n h\xF3a th\xFA r\u1ED3i giao cho ng\u01B0\u1EDDi c\u01B0\u1EE1i nh\u01B0 giao c\xF4ng c\u1EE5. Chu\u1ED3ng c\u1EA5p 1 thu\u1EA7n \u0111\u01B0\u1EE3c s\xF3i, c\u1EA5p 2 l\u1EE3n r\u1EEBng, c\u1EA5p 3 voi.', after: ["c3_fire4"], done: { type: "buildBuilding", kind: "stable", count: 1 } },
    { id: "c4_cavalry", chapter: 4, title: "D\u1EF1ng Tr\u1EA1i k\u1EF5 th\xFA", hint: 'N\xFAt \u{1F528} X\xE2y, tab "Qu\xE2n s\u1EF1": Tr\u1EA1i k\u1EF5 th\xFA. L\xEDnh luy\u1EC7n trong tr\u1EA1i c\u01B0\u1EE1i th\xFA theo c\u1EA5p tr\u1EA1i m\xE0 kh\xF4ng c\u1EA7n ai giao th\xFA.', after: ["c4_stable"], done: { type: "buildBuilding", kind: "cavalry", count: 1 } }
  ]
};

// src/sim/progression.ts
var FIRE = progression_default.campfire.levels;
var LAB = progression_default.research.levels;
var CELLS_DEFAULT = progression_default.formationDefaults.cells;
var SQUADS_DEFAULT = progression_default.formationDefaults.squads;
var fireBuildingMax = (fireLevel2) => FIRE[Math.min(FIRE.length, Math.max(1, fireLevel2)) - 1].buildingMaxLevel;
var fireUpgradeGroups = (fireLevel2) => FIRE[Math.min(FIRE.length, Math.max(1, fireLevel2)) - 1].upgradeNeeds?.groupAtLeastLevel ?? {};
function labLevelOf(techId) {
  for (const l of LAB) if (l.techs.includes(techId)) return l.level;
  return LAB[LAB.length - 1].level;
}
var SCREEN_QUESTS = quests_default.quests.filter((q) => ["selectBuilding", "openBuilding", "inspectNode", "inspectUnit", "inspectAnimal", "speed", "daytime"].includes(q.done.type)).map((q) => q.id);

// src/content/buildings/archery/building.json
var building_default = {
  kind: "archery",
  name: "Tr\u1EA1i cung th\u1EE7",
  names: {
    ancient: "Tr\u1EA1i cung th\u1EE7"
  },
  group: "war",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 20
        },
        buildTime: 60,
        cap: 0,
        craftSpeed: 1,
        slots: 5,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 25
        },
        buildTime: 100,
        cap: 0,
        craftSpeed: 1,
        slots: 10,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 30,
          stone: 25
        },
        buildTime: 150,
        cap: 0,
        craftSpeed: 1,
        slots: 15,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 36,
          stone: 35
        },
        buildTime: 225,
        cap: 0,
        craftSpeed: 1,
        slots: 20,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 65,
          stone: 63,
          hide: 31
        },
        buildTime: 338,
        cap: 0,
        craftSpeed: 1.25,
        slots: 24,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/armory/building.json
var building_default2 = {
  kind: "armory",
  name: "Kho v\u0169 kh\xED",
  group: "storage",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 1,
  requires: [
    "workshop"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 25
        },
        buildTime: 60,
        cap: 12,
        craftSpeed: 1,
        slots: 0,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 30,
          stone: 15
        },
        buildTime: 100,
        cap: 30,
        craftSpeed: 1,
        slots: 0,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 30,
          stone: 40
        },
        buildTime: 150,
        cap: 60,
        craftSpeed: 1,
        slots: 0,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 34,
          stone: 80
        },
        buildTime: 225,
        cap: 120,
        craftSpeed: 1,
        slots: 0,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 62,
          stone: 144
        },
        buildTime: 338,
        cap: 180,
        craftSpeed: 1.25,
        slots: 0,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/builder/building.json
var building_default3 = {
  kind: "builder",
  name: "Nh\xE0 th\u1EE3 x\xE2y",
  group: "development",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 1,
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 10
        },
        buildTime: 60,
        cap: 0,
        craftSpeed: 1,
        slots: 2,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 50,
          stone: 30
        },
        buildTime: 110,
        cap: 0,
        craftSpeed: 1,
        slots: 3,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 60,
          stone: 50
        },
        buildTime: 160,
        cap: 0,
        craftSpeed: 1,
        slots: 3,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 72,
          stone: 83
        },
        buildTime: 233,
        cap: 0,
        craftSpeed: 1,
        slots: 4,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 130,
          stone: 150
        },
        buildTime: 350,
        cap: 0,
        craftSpeed: 1.25,
        slots: 5,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/campfire/building.json
var building_default4 = {
  kind: "campfire",
  name: "Nh\xE0 chung (\u0111\u1ED1ng l\u1EEDa tr\u1EA1i)",
  group: "development",
  size: [
    2,
    2
  ],
  buildable: false,
  upgradable: true,
  unlockFire: 1,
  popByFire: [
    8,
    16,
    25,
    40,
    60
  ],
  levels: {
    stone: [
      {
        name: "C\u1EE7i l\u1EEDa",
        cost: {},
        buildTime: 0,
        cap: 30,
        craftSpeed: 1,
        slots: 0,
        hp: 180,
        sight: 10
      },
      {
        name: "L\u1EEDa tr\u1EA1i",
        cost: {
          wood: 100
        },
        buildTime: 120,
        cap: 45,
        craftSpeed: 1,
        slots: 0,
        hp: 270,
        sight: 14
      },
      {
        name: "B\u1EBFp l\u1EEDa l\u1EDBn",
        cost: {
          food: 50,
          wood: 250,
          stone: 100,
          coin: 30
        },
        buildTime: 240,
        cap: 60,
        craftSpeed: 1,
        slots: 0,
        hp: 360,
        sight: 18
      },
      {
        name: "Nh\xE0 chung",
        cost: {
          food: 200,
          wood: 300,
          stone: 150,
          coin: 50
        },
        buildTime: 480,
        cap: 90,
        craftSpeed: 1,
        slots: 0,
        hp: 450,
        sight: 22
      }
    ],
    ancient: [
      {
        name: "Nh\xE0 ch\xEDnh",
        cost: {
          food: 1200,
          wood: 800,
          stone: 700,
          hide: 300,
          coin: 200
        },
        buildTime: 720,
        cap: 135,
        craftSpeed: 1.25,
        slots: 0,
        hp: 675,
        sight: 24
      }
    ]
  }
};

// src/content/buildings/cavalry/building.json
var building_default5 = {
  kind: "cavalry",
  name: "Tr\u1EA1i k\u1EF5 th\xFA",
  names: {
    ancient: "Tr\u1EA1i k\u1EF5 binh"
  },
  group: "war",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 25
        },
        buildTime: 70,
        cap: 0,
        craftSpeed: 1,
        slots: 5,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 30
        },
        buildTime: 110,
        cap: 0,
        craftSpeed: 1,
        slots: 10,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 35,
          stone: 25
        },
        buildTime: 160,
        cap: 0,
        craftSpeed: 1,
        slots: 15,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 41,
          stone: 35
        },
        buildTime: 233,
        cap: 0,
        craftSpeed: 1,
        slots: 20,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 74,
          stone: 63,
          hide: 36
        },
        buildTime: 350,
        cap: 0,
        craftSpeed: 1.25,
        slots: 24,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/drill/building.json
var building_default6 = {
  kind: "drill",
  name: "B\xE3i t\u1EADp",
  group: "war",
  size: [
    3,
    3
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "infantry"
  ],
  levels: {
    stone: [
      {
        name: "B\xE3i c\u1ECDc",
        cost: {
          wood: 25
        },
        buildTime: 80,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 405,
        sight: 0
      },
      {
        name: "B\xE3i r\xE0o",
        cost: {
          wood: 30,
          stone: 10
        },
        buildTime: 120,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 608,
        sight: 0
      },
      {
        name: "B\xE3i \u0111\xE1",
        cost: {
          wood: 35,
          stone: 30
        },
        buildTime: 170,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 810,
        sight: 0
      },
      {
        name: "B\xE3i \u0111\xE1 gia c\u1ED1",
        cost: {
          wood: 41,
          stone: 60
        },
        buildTime: 241,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 1012,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 74,
          stone: 108
        },
        buildTime: 362,
        cap: 0,
        craftSpeed: 1.25,
        slots: 0,
        hp: 1518,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/farmhouse/building.json
var building_default7 = {
  kind: "farmhouse",
  name: "N\xF4ng tr\u1EA1i",
  group: "production",
  produces: [
    "food"
  ],
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 1,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 15
        },
        buildTime: 50,
        cap: 40,
        craftSpeed: 1,
        slots: 3,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 25,
          stone: 5
        },
        buildTime: 90,
        cap: 100,
        craftSpeed: 1,
        slots: 5,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 30,
          stone: 20
        },
        buildTime: 140,
        cap: 200,
        craftSpeed: 1,
        slots: 5,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 36,
          stone: 40
        },
        buildTime: 218,
        cap: 400,
        craftSpeed: 1,
        slots: 5,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 65,
          stone: 72
        },
        buildTime: 327,
        cap: 300,
        craftSpeed: 1.25,
        slots: 6,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/fence/building.json
var building_default8 = {
  kind: "fence",
  name: "H\xE0ng r\xE0o c\u1ECDc",
  group: "defence",
  size: [
    1,
    1
  ],
  buildable: true,
  unlockFire: 3,
  requires: [
    "builder"
  ],
  limit: [
    40,
    80,
    120,
    150,
    180
  ],
  repeat: true,
  levels: {
    stone: [
      {
        name: "C\u1ECDc nh\u1ECDn",
        cost: {
          wood: 2
        },
        buildTime: 14,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 300,
        sight: 0
      },
      {
        name: "H\xE0ng r\xE0o \u0111\xF4i",
        cost: {
          wood: 4,
          stone: 1
        },
        buildTime: 24,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 600,
        sight: 0
      },
      {
        name: "H\xE0ng r\xE0o \u0111\xF4i gia c\u1ED1",
        cost: {
          wood: 8,
          stone: 2
        },
        buildTime: 41,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 1200,
        sight: 0
      },
      {
        name: "H\xE0ng r\xE0o \u0111\xF4i ki\xEAn c\u1ED1",
        cost: {
          wood: 16,
          stone: 4
        },
        buildTime: 70,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 2e3,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 29,
          stone: 8
        },
        buildTime: 105,
        cap: 0,
        craftSpeed: 1.25,
        slots: 0,
        hp: 3e3,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/field/building.json
var building_default9 = {
  kind: "field",
  name: "Ru\u1ED9ng",
  group: "production",
  size: [
    3,
    3
  ],
  buildable: true,
  unlockFire: 1,
  requires: [
    "builder"
  ],
  limit: [
    1,
    3,
    3,
    4,
    5
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u1EA5t v\u1EE1",
        cost: {
          wood: 10
        },
        buildTime: 70,
        cap: 0,
        craftSpeed: 1,
        slots: 1,
        hp: 405,
        sight: 0
      },
      {
        name: "Lu\u1ED1ng \u0111\u1EAFp",
        cost: {
          wood: 15,
          stone: 5
        },
        buildTime: 110,
        cap: 0,
        craftSpeed: 1,
        slots: 1,
        hp: 608,
        sight: 0
      },
      {
        name: "B\u1EDD \u0111\xE1",
        cost: {
          wood: 20,
          stone: 15
        },
        buildTime: 160,
        cap: 0,
        craftSpeed: 1,
        slots: 1,
        hp: 810,
        sight: 0
      },
      {
        name: "B\u1EDD \u0111\xE1 gia c\u1ED1",
        cost: {
          wood: 27,
          stone: 30
        },
        buildTime: 233,
        cap: 0,
        craftSpeed: 1,
        slots: 2,
        hp: 1012,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 49,
          stone: 54
        },
        buildTime: 350,
        cap: 0,
        craftSpeed: 1.25,
        slots: 3,
        hp: 1518,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/fieldtent/building.json
var building_default10 = {
  kind: "fieldtent",
  name: "L\u1EC1u h\xE0nh qu\xE2n",
  group: "war",
  size: [
    2,
    2
  ],
  buildable: false,
  unlockFire: 99,
  levels: {
    stone: [
      {
        name: "L\u1EC1u h\xE0nh qu\xE2n",
        cost: {},
        buildTime: 1,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 180,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/gate/building.json
var building_default11 = {
  kind: "gate",
  name: "C\u1ED5ng",
  group: "defence",
  size: [
    1,
    1
  ],
  buildable: true,
  unlockFire: 3,
  requires: [
    "fence"
  ],
  limit: [
    1,
    2,
    3,
    4,
    5
  ],
  levels: {
    stone: [
      {
        name: "C\u1ED5ng g\u1ED7",
        cost: {
          wood: 4
        },
        buildTime: 20,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 300,
        sight: 0
      },
      {
        name: "C\u1ED5ng \u0111\xF4i",
        cost: {
          wood: 6,
          stone: 2
        },
        buildTime: 32,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 900,
        sight: 0
      },
      {
        name: "C\u1ED5ng \u0111\xF4i gia c\u1ED1",
        cost: {
          wood: 9,
          stone: 3
        },
        buildTime: 51,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 1800,
        sight: 0
      },
      {
        name: "C\u1ED5ng \u0111\xF4i ki\xEAn c\u1ED1",
        cost: {
          wood: 14,
          stone: 4
        },
        buildTime: 81,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 3600,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 26,
          stone: 8
        },
        buildTime: 122,
        cap: 0,
        craftSpeed: 1.25,
        slots: 0,
        hp: 5400,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/guardpost/building.json
var building_default12 = {
  kind: "guardpost",
  name: "Tr\u1EA1i l\xEDnh g\xE1c",
  group: "defence",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 1,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "Ch\xF2i g\xE1c",
        cost: {
          wood: 10
        },
        buildTime: 70,
        cap: 0,
        craftSpeed: 1,
        slots: 6,
        hp: 180,
        sight: 0
      },
      {
        name: "Tr\u1EA1m g\xE1c",
        cost: {
          wood: 30,
          stone: 10
        },
        buildTime: 110,
        cap: 0,
        craftSpeed: 1.25,
        slots: 12,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\u1ED3n g\xE1c",
        cost: {
          wood: 35,
          stone: 30
        },
        buildTime: 170,
        cap: 0,
        craftSpeed: 1.5,
        slots: 18,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\u1ED3n g\xE1c gia c\u1ED1",
        cost: {
          wood: 41,
          stone: 60
        },
        buildTime: 263,
        cap: 0,
        craftSpeed: 1.5,
        slots: 24,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 74,
          stone: 108,
          hide: 33
        },
        buildTime: 394,
        cap: 0,
        craftSpeed: 1.88,
        slots: 29,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/house/building.json
var building_default13 = {
  kind: "house",
  name: "Nh\xE0 d\xE2n",
  group: "development",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "builder"
  ],
  limit: [
    1,
    3,
    3,
    3,
    3
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 20
        },
        buildTime: 60,
        cap: 0,
        craftSpeed: 1,
        slots: 5,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 30,
          stone: 10
        },
        buildTime: 100,
        cap: 0,
        craftSpeed: 1,
        slots: 10,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 40,
          stone: 30
        },
        buildTime: 150,
        cap: 0,
        craftSpeed: 1,
        slots: 15,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 53,
          stone: 60
        },
        buildTime: 225,
        cap: 0,
        craftSpeed: 1,
        slots: 20,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 96,
          stone: 108
        },
        buildTime: 338,
        cap: 0,
        craftSpeed: 1.25,
        slots: 24,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/huntlodge/building.json
var building_default14 = {
  kind: "huntlodge",
  name: "Ch\xF2i th\u1EE3 s\u0103n",
  group: "production",
  produces: [
    "food"
  ],
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 1,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 15
        },
        buildTime: 50,
        cap: 20,
        craftSpeed: 1,
        slots: 2,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 25
        },
        buildTime: 90,
        cap: 50,
        craftSpeed: 1,
        slots: 3,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 30,
          stone: 15
        },
        buildTime: 140,
        cap: 100,
        craftSpeed: 1,
        slots: 4,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 36,
          stone: 21
        },
        buildTime: 218,
        cap: 200,
        craftSpeed: 1,
        slots: 5,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 65,
          stone: 38,
          hide: 24
        },
        buildTime: 327,
        cap: 150,
        craftSpeed: 1.25,
        slots: 6,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/infantry/building.json
var building_default15 = {
  kind: "infantry",
  name: "Tr\u1EA1i chi\u1EBFn binh",
  names: {
    ancient: "Tr\u1EA1i b\u1ED9 binh"
  },
  group: "war",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 20
        },
        buildTime: 60,
        cap: 0,
        craftSpeed: 1,
        slots: 5,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 25
        },
        buildTime: 100,
        cap: 0,
        craftSpeed: 1,
        slots: 10,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 30,
          stone: 25
        },
        buildTime: 150,
        cap: 0,
        craftSpeed: 1,
        slots: 15,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 36,
          stone: 35
        },
        buildTime: 225,
        cap: 0,
        craftSpeed: 1,
        slots: 20,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 65,
          stone: 63,
          hide: 31
        },
        buildTime: 338,
        cap: 0,
        craftSpeed: 1.25,
        slots: 24,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/lab/building.json
var building_default16 = {
  kind: "lab",
  name: "Nh\xE0 nghi\xEAn c\u1EE9u",
  group: "development",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "workshop"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 20
        },
        buildTime: 80,
        cap: 0,
        craftSpeed: 1,
        slots: 1,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 200,
          stone: 100,
          coin: 10
        },
        buildTime: 140,
        cap: 0,
        craftSpeed: 1,
        slots: 2,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 30,
          stone: 50
        },
        buildTime: 200,
        cap: 0,
        craftSpeed: 1,
        slots: 3,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 34,
          stone: 57
        },
        buildTime: 286,
        cap: 0,
        craftSpeed: 1,
        slots: 4,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 62,
          stone: 103
        },
        buildTime: 429,
        cap: 0,
        craftSpeed: 1.25,
        slots: 5,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/lumberyard/building.json
var building_default17 = {
  kind: "lumberyard",
  name: "X\u01B0\u1EDFng g\u1ED7",
  group: "production",
  produces: [
    "wood"
  ],
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 1,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 15
        },
        buildTime: 50,
        cap: 40,
        craftSpeed: 1,
        slots: 3,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 25,
          stone: 5
        },
        buildTime: 90,
        cap: 100,
        craftSpeed: 1,
        slots: 5,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 30,
          stone: 20
        },
        buildTime: 140,
        cap: 200,
        craftSpeed: 1,
        slots: 5,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 36,
          stone: 40
        },
        buildTime: 218,
        cap: 400,
        craftSpeed: 1,
        slots: 5,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 65,
          stone: 72
        },
        buildTime: 327,
        cap: 300,
        craftSpeed: 1.25,
        slots: 6,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/quarry/building.json
var building_default18 = {
  kind: "quarry",
  name: "X\u01B0\u1EDFng \u0111\xE1",
  group: "production",
  produces: [
    "stone"
  ],
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 1,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 15
        },
        buildTime: 50,
        cap: 40,
        craftSpeed: 1,
        slots: 3,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 25,
          stone: 5
        },
        buildTime: 90,
        cap: 100,
        craftSpeed: 1,
        slots: 5,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 30,
          stone: 20
        },
        buildTime: 140,
        cap: 200,
        craftSpeed: 1,
        slots: 5,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 36,
          stone: 40
        },
        buildTime: 218,
        cap: 400,
        craftSpeed: 1,
        slots: 5,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 65,
          stone: 72
        },
        buildTime: 327,
        cap: 300,
        craftSpeed: 1.25,
        slots: 6,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/scouttent/building.json
var building_default19 = {
  kind: "scouttent",
  name: "Tr\u1EA1i trinh s\xE1t",
  group: "war",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "L\u1EC1u da",
        cost: {
          wood: 20
        },
        buildTime: 70,
        cap: 0,
        craftSpeed: 1,
        slots: 2,
        hp: 180,
        sight: 0
      },
      {
        name: "L\u1EC1u l\u1EDBn",
        cost: {
          wood: 30,
          stone: 10
        },
        buildTime: 110,
        cap: 0,
        craftSpeed: 1,
        slots: 4,
        hp: 270,
        sight: 0
      },
      {
        name: "L\u1EC1u th\xE1m th\xEDnh",
        cost: {
          wood: 40,
          stone: 25
        },
        buildTime: 160,
        cap: 0,
        craftSpeed: 1,
        slots: 6,
        hp: 360,
        sight: 0
      },
      {
        name: "L\u1EC1u th\xE1m th\xEDnh gia c\u1ED1",
        cost: {
          wood: 53,
          stone: 50
        },
        buildTime: 233,
        cap: 0,
        craftSpeed: 1,
        slots: 6,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 96,
          hide: 33,
          stone: 90
        },
        buildTime: 350,
        cap: 0,
        craftSpeed: 1.25,
        slots: 7,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/stable/building.json
var building_default20 = {
  kind: "stable",
  name: "Chu\u1ED3ng th\xFA c\u01B0\u1EE1i",
  group: "war",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "Chu\u1ED3ng c\u1ECDc",
        cost: {
          wood: 30
        },
        buildTime: 90,
        cap: 0,
        craftSpeed: 1,
        slots: 1,
        hp: 180,
        sight: 0
      },
      {
        name: "Chu\u1ED3ng g\u1ED7",
        cost: {
          wood: 40,
          stone: 10
        },
        buildTime: 140,
        cap: 0,
        craftSpeed: 1,
        slots: 2,
        hp: 270,
        sight: 0
      },
      {
        name: "Chu\u1ED3ng \u0111\xE1",
        cost: {
          wood: 45,
          stone: 35
        },
        buildTime: 200,
        cap: 0,
        craftSpeed: 1,
        slots: 3,
        hp: 360,
        sight: 0
      },
      {
        name: "Chu\u1ED3ng \u0111\xE1 gia c\u1ED1",
        cost: {
          wood: 52,
          stone: 70
        },
        buildTime: 286,
        cap: 0,
        craftSpeed: 1,
        slots: 3,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 94,
          stone: 126,
          hide: 33
        },
        buildTime: 429,
        cap: 0,
        craftSpeed: 1.25,
        slots: 4,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/storage/building.json
var building_default21 = {
  kind: "storage",
  name: "Kho",
  group: "storage",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 1,
  requires: [
    "builder"
  ],
  limit: [
    1,
    2,
    3,
    3,
    4
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 10
        },
        buildTime: 50,
        cap: 200,
        craftSpeed: 1,
        slots: 0,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 35
        },
        buildTime: 90,
        cap: 500,
        craftSpeed: 1,
        slots: 0,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 40,
          stone: 20
        },
        buildTime: 140,
        cap: 1e3,
        craftSpeed: 1,
        slots: 0,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 46,
          stone: 28
        },
        buildTime: 218,
        cap: 2e3,
        craftSpeed: 1,
        slots: 0,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 83,
          stone: 51
        },
        buildTime: 327,
        cap: 1500,
        craftSpeed: 1.25,
        slots: 0,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/supplycamp/building.json
var building_default22 = {
  kind: "supplycamp",
  name: "Tr\u1EA1i h\u1EADu c\u1EA7n",
  group: "war",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "L\u1EC1u h\u1EADu c\u1EA7n",
        cost: {
          wood: 26
        },
        buildTime: 70,
        cap: 0,
        craftSpeed: 1,
        slots: 4,
        hp: 180,
        sight: 0
      },
      {
        name: "Tr\u1EA1i h\u1EADu c\u1EA7n",
        cost: {
          wood: 39,
          stone: 10
        },
        buildTime: 110,
        cap: 0,
        craftSpeed: 1,
        slots: 8,
        hp: 270,
        sight: 0
      },
      {
        name: "Kho qu\xE2n nhu",
        cost: {
          wood: 52,
          stone: 25
        },
        buildTime: 160,
        cap: 0,
        craftSpeed: 1,
        slots: 12,
        hp: 360,
        sight: 0
      },
      {
        name: "Kho qu\xE2n nhu gia c\u1ED1",
        cost: {
          wood: 68,
          stone: 50
        },
        buildTime: 233,
        cap: 0,
        craftSpeed: 1,
        slots: 16,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 123,
          hide: 49,
          stone: 90
        },
        buildTime: 350,
        cap: 0,
        craftSpeed: 1.25,
        slots: 19,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/toolstore/building.json
var building_default23 = {
  kind: "toolstore",
  name: "Kho c\xF4ng c\u1EE5",
  group: "storage",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 1,
  requires: [
    "workshop"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 25
        },
        buildTime: 60,
        cap: 12,
        craftSpeed: 1,
        slots: 0,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 30,
          stone: 15
        },
        buildTime: 100,
        cap: 30,
        craftSpeed: 1,
        slots: 0,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 30,
          stone: 40
        },
        buildTime: 150,
        cap: 60,
        craftSpeed: 1,
        slots: 0,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 34,
          stone: 80
        },
        buildTime: 225,
        cap: 120,
        craftSpeed: 1,
        slots: 0,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 62,
          stone: 144
        },
        buildTime: 338,
        cap: 180,
        craftSpeed: 1.25,
        slots: 0,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/tower/building.json
var building_default24 = {
  kind: "tower",
  name: "Ch\xF2i canh",
  group: "defence",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "fence"
  ],
  limit: [
    0,
    1,
    2,
    4,
    6
  ],
  levels: {
    stone: [
      {
        name: "Ch\xF2i g\u1ED7",
        cost: {
          wood: 20
        },
        buildTime: 80,
        cap: 0,
        craftSpeed: 1,
        slots: 2,
        hp: 400,
        sight: 10
      },
      {
        name: "Ch\xF2i cao",
        cost: {
          wood: 30,
          stone: 8
        },
        buildTime: 130,
        cap: 0,
        craftSpeed: 1,
        slots: 3,
        hp: 600,
        sight: 13
      },
      {
        name: "Ch\xF2i cao gia c\u1ED1",
        cost: {
          wood: 45,
          stone: 11
        },
        buildTime: 211,
        cap: 0,
        craftSpeed: 1,
        slots: 4,
        hp: 700,
        sight: 16
      },
      {
        name: "Ch\xF2i cao ki\xEAn c\u1ED1",
        cost: {
          wood: 68,
          stone: 15
        },
        buildTime: 342,
        cap: 0,
        craftSpeed: 1,
        slots: 4,
        hp: 800,
        sight: 19
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 123,
          stone: 27
        },
        buildTime: 513,
        cap: 0,
        craftSpeed: 1.25,
        slots: 5,
        hp: 1200,
        sight: 21
      }
    ]
  }
};

// src/content/buildings/trap/building.json
var building_default25 = {
  kind: "trap",
  name: "H\u1ED1 ch\xF4ng",
  group: "defence",
  size: [
    1,
    1
  ],
  buildable: true,
  unlockFire: 3,
  requires: [
    "fence"
  ],
  limit: [
    4,
    10,
    18,
    28,
    38
  ],
  repeat: true,
  levels: {
    stone: [
      {
        name: "H\u1ED1 ch\xF4ng",
        cost: {
          wood: 3
        },
        buildTime: 12,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 3,
        sight: 0
      },
      {
        name: "H\u1ED1 ch\xF4ng s\xE2u",
        cost: {
          wood: 4,
          stone: 2
        },
        buildTime: 20,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 6,
        sight: 0
      },
      {
        name: "H\u1ED1 ch\xF4ng s\xE2u gia c\u1ED1",
        cost: {
          wood: 5,
          stone: 3
        },
        buildTime: 33,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 12,
        sight: 0
      },
      {
        name: "H\u1ED1 ch\xF4ng s\xE2u ki\xEAn c\u1ED1",
        cost: {
          wood: 6,
          stone: 4
        },
        buildTime: 54,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 24,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 11,
          stone: 8
        },
        buildTime: 81,
        cap: 0,
        craftSpeed: 1.25,
        slots: 0,
        hp: 36,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/wartent/building.json
var building_default26 = {
  kind: "wartent",
  name: "L\u1EC1u h\u1ECDp chi\u1EBFn",
  group: "war",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 2,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "L\u1EC1u da",
        cost: {
          wood: 30
        },
        buildTime: 90,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 180,
        sight: 0
      },
      {
        name: "L\u1EC1u l\u1EDBn",
        cost: {
          wood: 40,
          stone: 15
        },
        buildTime: 140,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 270,
        sight: 0
      },
      {
        name: "L\u1EC1u th\u1EE7 l\u0129nh",
        cost: {
          wood: 50,
          stone: 40
        },
        buildTime: 200,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 360,
        sight: 0
      },
      {
        name: "L\u1EC1u th\u1EE7 l\u0129nh gia c\u1ED1",
        cost: {
          wood: 62,
          stone: 80
        },
        buildTime: 286,
        cap: 0,
        craftSpeed: 1,
        slots: 0,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 112,
          stone: 144,
          hide: 36
        },
        buildTime: 429,
        cap: 0,
        craftSpeed: 1.25,
        slots: 0,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/workshop/building.json
var building_default27 = {
  kind: "workshop",
  name: "Nh\xE0 ch\u1EBF t\u1EA1o",
  group: "development",
  size: [
    2,
    2
  ],
  buildable: true,
  unlockFire: 1,
  requires: [
    "builder"
  ],
  levels: {
    stone: [
      {
        name: "\u0110\u01A1n s\u01A1",
        cost: {
          wood: 15
        },
        buildTime: 70,
        cap: 0,
        craftSpeed: 1,
        slots: 1,
        hp: 180,
        sight: 0
      },
      {
        name: "G\u1ED7",
        cost: {
          wood: 15,
          stone: 30
        },
        buildTime: 120,
        cap: 0,
        craftSpeed: 1,
        slots: 2,
        hp: 270,
        sight: 0
      },
      {
        name: "\u0110\xE1",
        cost: {
          wood: 30,
          stone: 50
        },
        buildTime: 180,
        cap: 0,
        craftSpeed: 1,
        slots: 3,
        hp: 360,
        sight: 0
      },
      {
        name: "\u0110\xE1 gia c\u1ED1",
        cost: {
          wood: 60,
          stone: 83
        },
        buildTime: 270,
        cap: 0,
        craftSpeed: 1,
        slots: 4,
        hp: 450,
        sight: 0
      }
    ],
    ancient: [
      {
        name: "G\u1EA1ch ng\xF3i (trung c\u1ED5)",
        cost: {
          wood: 108,
          stone: 150
        },
        buildTime: 405,
        cap: 0,
        craftSpeed: 1.25,
        slots: 5,
        hp: 675,
        sight: 0
      }
    ]
  }
};

// src/content/buildings/defs.gen.ts
var BUILDING_KINDS = ["archery", "armory", "builder", "campfire", "cavalry", "drill", "farmhouse", "fence", "field", "fieldtent", "gate", "guardpost", "house", "huntlodge", "infantry", "lab", "lumberyard", "quarry", "scouttent", "stable", "storage", "supplycamp", "toolstore", "tower", "trap", "wartent", "workshop"];
var BUILDING_FILES = { archery: building_default, armory: building_default2, builder: building_default3, campfire: building_default4, cavalry: building_default5, drill: building_default6, farmhouse: building_default7, fence: building_default8, field: building_default9, fieldtent: building_default10, gate: building_default11, guardpost: building_default12, house: building_default13, huntlodge: building_default14, infantry: building_default15, lab: building_default16, lumberyard: building_default17, quarry: building_default18, scouttent: building_default19, stable: building_default20, storage: building_default21, supplycamp: building_default22, toolstore: building_default23, tower: building_default24, trap: building_default25, wartent: building_default26, workshop: building_default27 };

// src/sim/buildings.ts
var CLEARANCE = 1;
var WALL_KINDS = /* @__PURE__ */ new Set(["fence", "gate", "trap"]);
var BUILDINGS = Object.fromEntries(BUILDING_KINDS.map((k) => {
  const f = BUILDING_FILES[k];
  const d = { kind: k, name: f.name, names: f.names, group: f.group, produces: f.produces, w: f.size[0], h: f.size[1], buildable: f.buildable, upgradable: f.upgradable, unlockFire: f.unlockFire, requires: f.requires, perFire: f.limit, repeat: f.repeat, levels: Object.fromEntries(Object.entries(f.levels).map(([era, ls]) => [era, ls.map((l) => ({ ...l, cost: scaleBill(l.cost) }))])) };
  return [k, d];
}));
var fireUnlockLevel = (kind) => BUILDINGS[kind].unlockFire;
function buildingSight(b) {
  if (!b.done) return 0;
  const lv = levelsOf(b.kind, b.era ?? "stone");
  return lv[Math.min(lv.length, Math.max(1, b.level)) - 1].sight;
}
var buildingName = (kind, era) => BUILDINGS[kind].names?.[era] ?? BUILDINGS[kind].name;
function levelsOf(kind, era) {
  const defs = BUILDINGS[kind].levels, stone = defs.stone;
  return era === "ancient" && defs.ancient ? levelCache(kind, stone, defs.ancient) : stone;
}
var levelLists = /* @__PURE__ */ new Map();
var levelCache = (kind, stone, ancient) => {
  let l = levelLists.get(kind);
  if (!l) {
    l = [...stone, ...ancient];
    levelLists.set(kind, l);
  }
  return l;
};
var levelDef = (b, level = b.level) => levelsOf(b.kind, b.kind === "campfire" ? "ancient" : b.era)[level - 1];
var maxHp = (b) => Math.round((b.hpBonus ? 1 + b.hpBonus / 100 : 1) * (levelDef(b).hp || Math.round(SIEGE.buildingHpPerTile * BUILDINGS[b.kind].w * BUILDINGS[b.kind].h * (1 + 0.5 * (b.level - 1)))));
var maxLevel = (kind, era) => levelsOf(kind, era).length;
var topLevel = (b) => maxLevel(b.kind, b.kind === "campfire" ? "ancient" : b.era);
var holdsGoods = (b) => b.kind === "storage" || b.kind === "campfire";
var GATHER_HOUSE = { wood: "lumberyard", stone: "quarry", food: "farmhouse" };
var gatherMult = (b) => b ? pace_default.levelYield[Math.min(pace_default.levelYield.length, Math.max(1, b.level)) - 1] : 1;
var eraLocked = (kind, game) => game.era !== "ancient" && war_default.advancedBuildings.includes(kind);
var needsWork = (b) => !b.done || b.upgrading || !!b.repairing;
var POP_BY_FIRE = BUILDING_FILES.campfire.popByFire;
var levelCapByFire = (fireLevel2) => fireBuildingMax(fireLevel2);

// src/sim/fog.ts
var Fog = class {
  constructor(world) {
    this.world = world;
    this.version = 0;
    /** The tiles in sight right now, so that an update lowers only those instead of walking the whole map (a map of nearly a million tiles). */
    this.lit = [];
    /** The tiles whose state changed since the screen last took them (see takeChanged), so that drawing the fog touches only those and not the whole map. */
    this.changed = [];
    /** The whole map has to be drawn again (a game was loaded, the map was revealed). */
    this.all = true;
    this.state = new Uint8Array(world.size * world.size);
  }
  /** The map's fog changed in a way `changed` does not tell: draw it all again. */
  invalidate() {
    this.all = true;
    this.changed = [];
    this.version++;
  }
  /** For the drawing: null = redraw everything, else the tiles that changed since the last call. */
  takeChanged() {
    const c = this.changed;
    this.changed = [];
    if (this.all) {
      this.all = false;
      return null;
    }
    return c;
  }
  /** Each source has its own sight radius `r` (tiles). */
  update(sources) {
    const N = this.world.size, s = this.state, ch = this.changed, old = this.lit;
    for (const i of old) if (s[i] === 2) s[i] = 3;
    const lit = [];
    for (const p of sources) {
      const cx = Math.floor(p.x), cy = Math.floor(p.y), radius = p.r, r2 = radius * radius + 0.5;
      for (let y = Math.max(0, cy - radius); y <= Math.min(N - 1, cy + radius); y++) {
        for (let x = Math.max(0, cx - radius); x <= Math.min(N - 1, cx + radius); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) {
            const i = y * N + x, was = s[i];
            if (was !== 2) {
              s[i] = 2;
              lit.push(i);
              if (was !== 3) ch.push(i);
            }
          }
        }
      }
    }
    for (const i of old) if (s[i] === 3) {
      s[i] = 1;
      ch.push(i);
    }
    this.lit = lit;
    if (ch.length > 3e4) {
      this.all = true;
      this.changed = [];
    }
    this.version++;
  }
  /** After the state was put back from a save: find again which tiles are in sight. */
  relight() {
    this.lit = [];
    for (let i = 0; i < this.state.length; i++) if (this.state[i] === 2) this.lit.push(i);
    this.all = true;
    this.changed = [];
  }
  countExplored() {
    let n = 0;
    for (let i = 0; i < this.state.length; i++) if (this.state[i] > 0) n++;
    return n;
  }
};

// src/sim/rng.ts
function mulberry32(seed2) {
  let a = seed2 >>> 0;
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
function mix32(n) {
  let h = n | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}
function hash2(x, y, seed2) {
  const h = mix32(Math.imul(x | 0, 668265261) ^ mix32(Math.imul(y | 0, 374761393) + mix32(seed2 | 0)));
  return h / 4294967296;
}
var smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, y, seed2) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy, seed2), b = hash2(ix + 1, iy, seed2);
  const c = hash2(ix, iy + 1, seed2), d = hash2(ix + 1, iy + 1, seed2);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, seed2, octaves = 3) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, seed2 + o * 101) * amp;
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
  ] },
  ride: { fps: 3, loop: true, frames: [
    { bob: 3, lean: 0, legR: { a: 38, lift: 0 }, legL: { a: 28, lift: 0 }, armR: { a: 55, b: 35 }, armL: { a: 48, b: 38 } },
    { bob: 3, lean: 0, legR: { a: 38, lift: 0 }, legL: { a: 28, lift: 0 }, armR: { a: 57, b: 35 }, armL: { a: 50, b: 38 } },
    { bob: 4, lean: 0, legR: { a: 38, lift: 0 }, legL: { a: 28, lift: 0 }, armR: { a: 59, b: 33 }, armL: { a: 52, b: 36 } },
    { bob: 3, lean: 0, legR: { a: 38, lift: 0 }, legL: { a: 28, lift: 0 }, armR: { a: 57, b: 35 }, armL: { a: 50, b: 38 } }
  ] },
  ride_walk: { fps: 8, loop: true, frames: [
    { bob: 3, lean: 1, legR: { a: 40, lift: 0 }, legL: { a: 30, lift: 0 }, armR: { a: 62, b: 30 }, armL: { a: 56, b: 34 } },
    { bob: 2, lean: 1, legR: { a: 44, lift: 0 }, legL: { a: 26, lift: 0 }, armR: { a: 62, b: 30 }, armL: { a: 56, b: 34 } },
    { bob: 3, lean: 1, legR: { a: 38, lift: 0 }, legL: { a: 30, lift: 0 }, armR: { a: 62, b: 30 }, armL: { a: 56, b: 34 } },
    { bob: 4, lean: 1, legR: { a: 36, lift: 0 }, legL: { a: 32, lift: 0 }, armR: { a: 62, b: 30 }, armL: { a: 56, b: 34 } },
    { bob: 3, lean: 1, legR: { a: 38, lift: 0 }, legL: { a: 30, lift: 0 }, armR: { a: 62, b: 30 }, armL: { a: 56, b: 34 } },
    { bob: 2, lean: 1, legR: { a: 44, lift: 0 }, legL: { a: 26, lift: 0 }, armR: { a: 62, b: 30 }, armL: { a: 56, b: 34 } }
  ] }
};

// src/data/units.json
var units_default = {
  _note: "Arms of the army and what beats what. A weapon decides its arm: ranged weapons (sling, bow) make an archer, everything else a foot soldier; a rider (cavalry) is a soldier on a tamed beast, which the game does not have yet but the table is ready for. beats[attacker][defender] multiplies the damage an attacker does. Foot beats archers, archers beat riders, riders beat foot. The small bonuses are on top of that.",
  arms: {
    foot: "B\u1ED9 binh",
    archer: "Cung th\u1EE7",
    cavalry: "K\u1EF5 binh"
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

// src/data/chase.json
var chase_default = {
  _note: "\u0110u\u1ED5i b\u1EAFt: ai (ng\u01B0\u1EDDi c\u1EE7a ta, d\xE2n l\xE0ng kh\xE1c, th\xFA) \u0111ang \u0111u\u1ED5i hay \u0111\xE1nh m\u1ED9t m\u1EE5c ti\xEAu s\u1EBD b\u1ECF cu\u1ED9c v\xE0 v\u1EC1 ch\u1ED7 c\u0169 khi: m\u1EA5t t\u1EA7m nh\xECn m\u1EE5c ti\xEAu qu\xE1 loseSightSeconds gi\xE2y, HO\u1EB6C qu\xE1 noHitSeconds gi\xE2y m\xE0 v\u1EABn kh\xF4ng ra \u0111\u01B0\u1EE3c m\u1ED9t \u0111\xF2n (m\u1EE5c ti\xEAu \u1EDF ch\u1ED7 kh\xF4ng t\u1EDBi \u0111\u01B0\u1EE3c: c\xE1 d\u01B0\u1EDBi n\u01B0\u1EDBc, con v\u1EADt b\u1ECB v\u1EADt c\u1EA3n v\xE2y quanh...). M\u1EE5c ti\xEAu \u0111\xF3 b\u1ECB b\u1ECF qua skipSeconds gi\xE2y r\u1ED3i m\u1EDBi \u0111\u01B0\u1EE3c ch\u1ECDn l\u1EA1i.",
  loseSightSeconds: 6,
  noHitSeconds: 10,
  skipSeconds: 30
};

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
    const k = this.key[n];
    while (i > 0) {
      const p = i - 1 >> 1;
      if (this.key[a[p]] <= k) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = n;
  }
  pop() {
    const a = this.items, top = a[0], last = a.pop();
    if (a.length) {
      const k = this.key[last], len = a.length;
      let i = 0;
      for (; ; ) {
        const l = i * 2 + 1;
        if (l >= len) break;
        const r = l + 1, m = r < len && this.key[a[r]] < this.key[a[l]] ? r : l;
        if (this.key[a[m]] >= k) break;
        a[i] = a[m];
        i = m;
      }
      a[i] = last;
    }
    return top;
  }
};
var mem = { total: 0, g: new Float32Array(0), f: new Float32Array(0), parent: new Int32Array(0), seen: new Uint32Array(0), closed: new Uint32Array(0), gen: 0 };
function memory(total) {
  if (mem.total !== total) {
    mem.total = total;
    mem.g = new Float32Array(total);
    mem.f = new Float32Array(total);
    mem.parent = new Int32Array(total);
    mem.seen = new Uint32Array(total);
    mem.closed = new Uint32Array(total);
    mem.gen = 0;
  }
  if (++mem.gen >= 4294967280) {
    mem.seen.fill(0);
    mem.closed.fill(0);
    mem.gen = 1;
  }
  return mem;
}
function findPath(world, sx, sy, gx, gy, maxNodes = 3e4, ours = false) {
  const N = world.size;
  const blocked = (x, y) => ours && (ours === "foe" ? world.foeGates : world.gates).size > 0 ? world.isBlockedFor(x, y, ours) : world.isBlocked(x, y);
  if (!world.inBounds(sx, sy) || !world.inBounds(gx, gy)) return [];
  const { g, f, parent, seen, closed, gen } = memory(N * N);
  const heap = new MinHeap(f), nb = new Uint8Array(9);
  const h = (x, y) => {
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return dx + dy + (SQ2 - 2) * Math.min(dx, dy);
  };
  const start = sy * N + sx, goal = gy * N + gx;
  g[start] = 0;
  f[start] = h(sx, sy);
  seen[start] = gen;
  parent[start] = -1;
  heap.push(start);
  let best = start, bestH = f[start], expanded = 0;
  while (heap.size && expanded < maxNodes) {
    const cur = heap.pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
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
    for (let k = 0; k < 9; k++) nb[k] = k === 4 ? 1 : blocked(cx + k % 3 - 1, cy + (k / 3 | 0) - 1) ? 1 : 0;
    const gc = g[cur];
    for (let k = 0; k < 9; k++) {
      if (nb[k]) continue;
      const dx = k % 3 - 1, dy = (k / 3 | 0) - 1;
      if (dx && dy && (nb[4 + dx] || nb[4 + dy * 3])) continue;
      const ni = (cy + dy) * N + cx + dx;
      if (closed[ni] === gen) continue;
      const ng = gc + (dx && dy ? SQ2 : 1);
      if (seen[ni] !== gen || ng < g[ni]) {
        seen[ni] = gen;
        g[ni] = ng;
        f[ni] = ng + h(cx + dx, cy + dy);
        parent[ni] = cur;
        heap.push(ni);
      }
    }
  }
  const out = [];
  for (let n = best; n !== start && n !== -1; n = parent[n]) out.push([n % N, n / N | 0]);
  return out.reverse();
}

// src/sim/world.ts
var START_MARGIN = 110;
var Tile = { Grass: 0, Water: 1, Tree: 2, Rock: 3, Mud: 4, Bush: 5, Mountain: 6 };
var NODE_INFO = {
  tree: { res: "wood", max: pace_default.node.tree },
  rock: { res: "stone", max: pace_default.node.rock },
  bush: { res: "food", max: pace_default.node.bush }
};
var TILE_OF = { tree: Tile.Tree, rock: Tile.Rock, bush: Tile.Bush };
var CHUNK = 32;
var CHUNKS = MAP_SIZE / CHUNK;
var FIRST_REACH = 100;
var WATER_BELOW = 0.3;
var SPARSE_ABOVE = 0.6;
var DENSE_ABOVE = 0.7;
var TREE_PLAINS = 3e-3;
var TREE_SPARSE = 0.1;
var TREE_DENSE = 0.42;
var MOUNTAIN_ABOVE = 0.72;
var FOOT_ABOVE = 0.64;
var ROCK_PLAINS = 3e-3;
var ROCK_FOOT = 0.03;
var BUSH_PLAINS = 5e-3;
var BUSH_SPARSE = 0.012;
var FOREST_FROM = 14;
var MOUNTAIN_FROM = 34;
var World = class _World {
  // how many used-up nodes have been replaced, so each pick of a new place differs
  constructor(seed2) {
    this.seed = seed2;
    this.size = MAP_SIZE;
    this.tiles = new Uint8Array(MAP_SIZE * MAP_SIZE);
    this.occ = new Uint8Array(MAP_SIZE * MAP_SIZE);
    // ô bị công trình chiếm
    this.decor = new Uint8Array(MAP_SIZE * MAP_SIZE);
    // 1 = gốc cây
    this.nodes = /* @__PURE__ */ new Map();
    /** 1 for each chunk that has been made. What lies in a chunk that has not been made is not known yet: nobody can walk there or build there. */
    this.ready = new Uint8Array(CHUNKS * CHUNKS);
    this.season = "spring";
    this.respawns = 0;
    /** The tiles of the gates that are shut: they stop the enemy and the beasts, but our own people pass through them. */
    this.gates = /* @__PURE__ */ new Set();
    /** Blocked for someone of ours (a villager, a soldier): the same as isBlocked, but a shut gate lets him by. */
    /** The tiles of the shut gates of the villages: the people of a village (not ours, not the beasts) pass them, so its guards come and go as they like. */
    this.foeGates = /* @__PURE__ */ new Set();
    this.grown = 0;
    this.start = _World.pickStart(seed2);
    const lo = (v) => Math.max(0, Math.floor((v - FIRST_REACH) / CHUNK)), hi = (v) => Math.min(CHUNKS - 1, Math.floor((v + FIRST_REACH) / CHUNK));
    const first = [];
    for (let cy = lo(this.start.y); cy <= hi(this.start.y); cy++) for (let cx = lo(this.start.x); cx <= hi(this.start.x); cx++) {
      this.makeTiles(cx, cy);
      first.push([cx, cy]);
    }
    this.ensureNearStart("tree", 12, 6, 17, seed2 + 101);
    this.ensureNearStart("rock", 5, 6, 15, seed2 + 102);
    this.ensureNearStart("bush", 8, 5, 14, seed2 + 103);
    for (const [cx, cy] of first) this.makeNodes(cx, cy);
  }
  /** The chunks made so far. */
  readyChunks() {
    const out = [];
    for (let i = 0; i < this.ready.length; i++) if (this.ready[i]) out.push([i % CHUNKS, i / CHUNKS | 0]);
    return out;
  }
  /** Has the land at this tile been made? */
  isReady(x, y) {
    return this.inBounds(x, y) && this.ready[(y >> 5) * CHUNKS + (x >> 5)] === 1;
  }
  /**
   * Make the land within `reach` tiles of a point if it does not exist yet. This is the whole of "the world grows as the village explores": the
   * game calls it round every villager, a chunk is made once, and the same world comes out whatever order the chunks are made in.
   */
  ensure(x, y, reach) {
    const x0 = Math.max(0, Math.floor((x - reach) / CHUNK)), x1 = Math.min(CHUNKS - 1, Math.floor((x + reach) / CHUNK));
    const y0 = Math.max(0, Math.floor((y - reach) / CHUNK)), y1 = Math.min(CHUNKS - 1, Math.floor((y + reach) / CHUNK));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (this.ready[cy * CHUNKS + cx]) continue;
      this.makeTiles(cx, cy);
      this.makeNodes(cx, cy);
      this.onChunk?.(cx, cy);
    }
  }
  /** Is it water, going by the noise alone? Pure, so that the shore of one chunk can look into the next, which may not exist yet. */
  waterAt(x, y) {
    if (!this.inBounds(x, y)) return false;
    return Math.hypot(x - this.start.x, y - this.start.y) > 14 && fbm(x / 26, y / 26, this.seed) < WATER_BELOW;
  }
  /** The region of the land a tile lies in, by the same noise that shaped it (the name shown at the top of the screen when the camera moves over it). */
  regionAt(x, y) {
    const d = Math.hypot(x - this.start.x, y - this.start.y);
    if (this.waterAt(x, y)) return "water";
    if (d > MOUNTAIN_FROM && fbm(x / 40, y / 40, this.seed + 301) > MOUNTAIN_ABOVE) return "mountain";
    const wood = d > 8 ? fbm(x / 22, y / 22, this.seed + 7) : 0;
    if (d > FOREST_FROM && wood > DENSE_ABOVE) return "dense";
    return d > FOREST_FROM && wood > SPARSE_ABOVE ? "sparse" : "plains";
  }
  /** The ground of one chunk: water, forest, stones, bushes, mud on the shores. */
  makeTiles(cx, cy) {
    const N = this.size, seed2 = this.seed, x0 = cx * CHUNK, y0 = cy * CHUNK;
    for (let y = y0; y < y0 + CHUNK; y++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        const d = Math.hypot(x - this.start.x, y - this.start.y);
        let t = Tile.Grass;
        const relief = d > MOUNTAIN_FROM - 12 ? fbm(x / 40, y / 40, seed2 + 301) : 0;
        const wood = d > 8 ? fbm(x / 22, y / 22, seed2 + 7) : 0;
        if (this.waterAt(x, y)) t = Tile.Water;
        else if (d > MOUNTAIN_FROM && relief > MOUNTAIN_ABOVE) t = Tile.Mountain;
        else if (d > FOREST_FROM && wood > DENSE_ABOVE && hash2(x, y, seed2 + 3) < TREE_DENSE) t = Tile.Tree;
        else if (d > FOREST_FROM && wood > SPARSE_ABOVE && hash2(x, y, seed2 + 3) < TREE_SPARSE) t = Tile.Tree;
        else if (d > 5 && hash2(x, y, seed2 + 9) < (relief > FOOT_ABOVE ? ROCK_FOOT : ROCK_PLAINS)) t = Tile.Rock;
        else if (d > 4 && hash2(x, y, seed2 + 13) < (wood > SPARSE_ABOVE ? BUSH_SPARSE : BUSH_PLAINS)) t = Tile.Bush;
        else if (d > 8 && hash2(x, y, seed2 + 5) < TREE_PLAINS) t = Tile.Tree;
        this.tiles[y * N + x] = t;
      }
    }
    for (let y = y0; y < y0 + CHUNK; y++) for (let x = x0; x < x0 + CHUNK; x++) {
      if (this.tiles[y * N + x] !== Tile.Grass) continue;
      let near2 = false;
      for (let dy = -1; dy <= 1 && !near2; dy++) for (let dx = -1; dx <= 1; dx++) if (this.waterAt(x + dx, y + dy)) {
        near2 = true;
        break;
      }
      if (near2 && hash2(x, y, seed2 + 17) < 0.8) this.tiles[y * N + x] = Tile.Mud;
    }
    this.ready[cy * CHUNKS + cx] = 1;
  }
  /** The trees, rocks and bushes standing on the ground of one chunk. */
  makeNodes(cx, cy) {
    const N = this.size, x0 = cx * CHUNK, y0 = cy * CHUNK;
    for (let y = y0; y < y0 + CHUNK; y++) for (let x = x0; x < x0 + CHUNK; x++) {
      const i = y * N + x, t = this.tiles[i];
      const kind = t === Tile.Tree ? "tree" : t === Tile.Rock ? "rock" : t === Tile.Bush ? "bush" : null;
      if (kind) this.nodes.set(i, { kind, res: NODE_INFO[kind].res, amount: NODE_INFO[kind].max, max: NODE_INFO[kind].max, workers: 0, sides: 0, regrow: 0 });
    }
  }
  /** Put a tree, rock or bush on a bare, open spot; false when the spot will not do. */
  plant(kind, x, y) {
    const N = this.size, j = y * N + x;
    if (!this.inBounds(x, y) || !this.isReady(x, y) || this.tiles[j] !== Tile.Grass || this.occ[j] !== 0 || this.nodes.has(j) || this.wouldTrap(x, y)) return false;
    this.tiles[j] = TILE_OF[kind];
    this.nodes.set(j, { kind, res: NODE_INFO[kind].res, amount: NODE_INFO[kind].max, max: NODE_INFO[kind].max, workers: 0, sides: 0, regrow: 0 });
    return true;
  }
  /** A random dry spot (open ground for 20 tiles round it) at least START_MARGIN from every edge, so the tribes and the herds have room on all sides. */
  static pickStart(seed2) {
    const N = MAP_SIZE, rnd2 = mulberry32(mix32(seed2 ^ 1374496523)), span = N - 2 * START_MARGIN;
    let best = { x: N >> 1, y: N >> 1 }, bestScore = -1;
    for (let t = 0; t < 400; t++) {
      const x = START_MARGIN + Math.floor(rnd2() * span), y = START_MARGIN + Math.floor(rnd2() * span);
      let score = 0;
      for (let k = 0; k < 8; k++) score += fbm((x + Math.cos(k * 0.785) * 20) / 26, (y + Math.sin(k * 0.785) * 20) / 26, seed2) > WATER_BELOW + 0.08 ? 1 : 0;
      if (score === 8 && fbm(x / 26, y / 26, seed2) > WATER_BELOW + 0.08) return { x, y };
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    return best;
  }
  /** Bảo đảm có tối thiểu `count` nguồn loại `kind` quanh điểm khởi đầu. */
  ensureNearStart(kind, count2, rMin, rMax, seed2) {
    const N = this.size, tile = TILE_OF[kind], rnd2 = mulberry32(seed2);
    let have2 = 0;
    for (let y = this.start.y - rMax; y <= this.start.y + rMax; y++) for (let x = this.start.x - rMax; x <= this.start.x + rMax; x++) {
      const d = Math.hypot(x - this.start.x, y - this.start.y);
      if (d >= rMin && d <= rMax && this.tiles[y * N + x] === tile) have2++;
    }
    for (let tries = 0; have2 < count2 && tries < 600; tries++) {
      const a = rnd2() * Math.PI * 2, r = rMin + rnd2() * (rMax - rMin);
      const x = Math.round(this.start.x + Math.cos(a) * r), y = Math.round(this.start.y + Math.sin(a) * r);
      if (this.tiles[y * N + x] === Tile.Grass) {
        this.tiles[y * N + x] = tile;
        have2++;
      }
    }
  }
  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }
  at(x, y) {
    return this.tiles[y * this.size + x];
  }
  isBlockedFor(x, y, ours) {
    if (!ours || !this.inBounds(x, y)) return this.isBlocked(x, y);
    const i = y * this.size + x;
    if (!(ours === "foe" ? this.foeGates : this.gates).has(i)) return this.isBlocked(x, y);
    const t = this.tiles[i];
    return this.ready[(y >> 5) * CHUNKS + (x >> 5)] === 0 || t !== Tile.Grass && t !== Tile.Mud;
  }
  isBlocked(x, y) {
    if (!this.inBounds(x, y)) return true;
    const i = y * this.size + x, t = this.tiles[i];
    return this.ready[(y >> 5) * CHUNKS + (x >> 5)] === 0 || t !== Tile.Grass && t !== Tile.Mud || this.occ[i] !== 0;
  }
  nodeAt(x, y) {
    return this.inBounds(x, y) ? this.nodes.get(y * this.size + x) : void 0;
  }
  /**
   * A tree, rock or bush that is used up is gone and its tile turns back to grass; one of the same kind appears on another free grass tile
   * a few steps away (never in the starting ring, never under somebody's feet, and where `free` allows), so the land is neither emptied nor reset in place.
   */
  depleted(idx, free) {
    const n = this.nodes.get(idx);
    if (!n) return;
    this.nodes.delete(idx);
    this.tiles[idx] = Tile.Grass;
    const N = this.size, fx = idx % N, fy = idx / N | 0, salt = this.respawns++;
    for (let t = 0; t < 40; t++) {
      const ang = hash2(idx, salt * 40 + t, this.seed + 41) * Math.PI * 2, r = 4 + hash2(idx, salt * 40 + t, this.seed + 43) * 7;
      const x = Math.round(fx + Math.cos(ang) * r), y = Math.round(fy + Math.sin(ang) * r), j = y * N + x;
      if (!this.isReady(x, y) || this.tiles[j] !== Tile.Grass || this.occ[j] !== 0 || this.nodes.has(j)) continue;
      if (Math.hypot(x - this.start.x, y - this.start.y) < 7 || free && !free(x, y) || this.wouldTrap(x, y)) continue;
      this.tiles[j] = TILE_OF[n.kind];
      this.nodes.set(j, { kind: n.kind, res: n.res, amount: n.kind === "bush" ? Math.round(n.max * (SEASON_DEF[this.season].bushLeft ?? 1)) : n.max, max: n.max, workers: 0, sides: 0, regrow: 0 });
      return;
    }
  }
  /**
   * Would a tree, rock or bush on this tile shut somebody in? True when it would cut the open ground around it in two (a wall of trees closing
   * on a gap), or leave an open neighbouring tile with fewer than two ways out (a pocket). A respawn then picks another tile.
   */
  wouldTrap(x, y) {
    const ring2 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
    const open2 = ring2.map(([dx, dy]) => !this.isBlocked(x + dx, y + dy));
    let runs = 0;
    for (let i = 0; i < 8; i++) if (open2[i] && !open2[(i + 7) % 8]) runs++;
    if (runs > 1) return true;
    for (let i = 0; i < 8; i++) {
      if (!open2[i]) continue;
      const nx = x + ring2[i][0], ny = y + ring2[i][1];
      let ways = 0;
      for (const [dx, dy] of ring2) if ((nx + dx !== x || ny + dy !== y) && !this.isBlocked(nx + dx, ny + dy)) ways++;
      if (ways < 2) return true;
    }
    return false;
  }
  /** Winter: bushes go bare and stop regrowing. Spring: they flower and fruit again after 1–3 min (staggered per tile). */
  setSeason(season) {
    const prev = this.season;
    this.season = season;
    if (season === prev) return;
    for (const [idx, n] of this.nodes) {
      if (n.kind !== "bush") continue;
      if (season === "winter") {
        const left = SEASON_DEF.winter.bushLeft ?? 1;
        if (left < 1) {
          n.amount = Math.min(n.amount, Math.round(n.max * left));
          n.regrow = 0;
        }
      } else if (prev === "winter" && (SEASON_DEF.winter.bushLeft ?? 1) < 1) {
        n.amount = 0;
        n.regrow = 60 + 120 * hash2(idx % this.size, idx / this.size | 0, this.seed + 29);
      }
    }
  }
  /** Bushes fruit again; the map holds well over a hundred thousand things, so this runs once a second rather than every tick. */
  tick(dt) {
    this.grown += dt;
    if (this.grown < 1) return;
    dt = this.grown;
    this.grown = 0;
    if (this.season === "winter" && (SEASON_DEF.winter.bushLeft ?? 1) < 1) return;
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
var isGround = (sim2, x, y) => {
  if (!sim2.world.inBounds(x, y)) return false;
  const t = sim2.world.at(x, y);
  return (t === Tile.Grass || t === Tile.Mud) && !sim2.world.occ[y * sim2.world.size + x];
};
var isWater = (sim2, x, y) => sim2.world.inBounds(x, y) && sim2.world.at(x, y) === Tile.Water;
var habitable = (sim2, def, x, y) => def.habitat === "water" ? isWater(sim2, x, y) : isGround(sim2, x, y);
var SPARSE = 0.4;
var FIRST_AREA = 192 * 192;
var share = () => CHUNK * CHUNK * SPARSE / FIRST_AREA;
var countOf = (sim2, def) => Math.round(def.count * share() * sim2.world.ready.reduce((n, r) => n + r, 0));
function populateChunk(sim2, cx, cy) {
  const w = sim2.world, s = w.start, x0 = cx * CHUNK, y0 = cy * CHUNK;
  const rnd2 = mulberry32(mix32(sim2.seed ^ Math.imul(cx + 1, 2654435761) ^ Math.imul(cy + 1, 2246822507)));
  let herd = 1e5 + (cy * CHUNKS + cx) * 64;
  const nearStart = Math.hypot(x0 + CHUNK / 2 - s.x, y0 + CHUNK / 2 - s.y) <= BEHAVIOUR.nearRadius;
  for (const sp of SPECIES) {
    const def = ANIMALS[sp], boost = nearStart && def.prey && !def.defends && def.habitat !== "water" && def.zones[0] <= 1 ? BEHAVIOUR.nearBoost : 1;
    const expected = def.count / ((def.herd[0] + def.herd[1]) / 2) * share() * boost;
    const herds = Math.floor(expected) + (rnd2() < expected - Math.floor(expected) ? 1 : 0);
    for (let n = 0; n < herds; n++) {
      for (let tries = 0; tries < 8; tries++) {
        const x = x0 + Math.floor(rnd2() * CHUNK), y = y0 + Math.floor(rnd2() * CHUNK), d = Math.hypot(x - s.x, y - s.y);
        const z = zoneOf(d), far = z === 4 && def.zones[1] === 3 ? 3 : z;
        if (d < 16 && def.habitat !== "water" || far < def.zones[0] || far > def.zones[1] || !habitable(sim2, def, x, y)) continue;
        const size = def.herd[0] + Math.floor(rnd2() * (def.herd[1] - def.herd[0] + 1));
        for (let i = 0; i < size; i++) {
          const ax = x + (rnd2() - 0.5) * 4, ay = y + (rnd2() - 0.5) * 4;
          if (!w.isReady(Math.floor(ax), Math.floor(ay)) || !habitable(sim2, def, Math.floor(ax), Math.floor(ay))) continue;
          spawnAnimal(sim2, sp, ax, ay, herd);
        }
        herd++;
        break;
      }
    }
  }
}
var raidOver = (a, night) => a.raid && (a.raidNight === void 0 ? !night : a.raidNight !== night);
function spawnAnimal(sim2, species, x, y, herd, raid = false, raidNight) {
  const def = ANIMALS[species];
  const a = {
    id: sim2.nextAid++,
    species,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    state: "graze",
    dir: sim2.frnd() < 0.5 ? 1 : -1,
    dest: null,
    timer: 2 + sim2.frnd() * 6,
    cd: 0,
    scan: sim2.frnd() * 0.5,
    target: null,
    herd,
    home: { x, y },
    burst: 0,
    tired: 0,
    female: sim2.frnd() < 0.5,
    raid,
    raidNight,
    bite: 0,
    clock: sim2.frnd() * 10,
    meat: 0,
    hide: 0,
    drops: {},
    carcass: 0
  };
  sim2.animals.push(a);
  sim2.animalById.set(a.id, a);
  return a;
}
var turned = /* @__PURE__ */ new WeakMap();
var TURNS = [0, 0.6, 1.2, 1.9, 2.6];
function unstick(sim2, a) {
  const def = animalDef(a), x = Math.floor(a.x), y = Math.floor(a.y);
  if (habitable(sim2, def, x, y)) return;
  for (let r = 1; r <= 10; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (Math.max(Math.abs(i), Math.abs(j)) !== r || !habitable(sim2, def, x + i, y + j)) continue;
    a.x = x + i + 0.5;
    a.y = y + j + 0.5;
    return;
  }
}
var watch = /* @__PURE__ */ new WeakMap();
var route = /* @__PURE__ */ new WeakMap();
var routeTick = -1;
var routeLeft = 0;
function step(sim2, a, tx, ty, speed, dt) {
  const water = ANIMALS[a.species].habitat === "water", key = `${Math.floor(tx / 2)},${Math.floor(ty / 2)}`;
  let gx = tx, gy = ty;
  const r = route.get(a);
  if (r && r.goal === key) {
    while (r.path.length && Math.hypot(r.path[0][0] + 0.5 - a.x, r.path[0][1] + 0.5 - a.y) < 0.45) r.path.shift();
    if (r.path.length) {
      gx = r.path[0][0] + 0.5;
      gy = r.path[0][1] + 0.5;
    } else route.delete(a);
  } else if (r) route.delete(a);
  const ok = steer(sim2, a, gx, gy, speed, dt);
  if (water) return ok;
  let w = watch.get(a);
  if (!w || sim2.time - w.at > 0.6) {
    w = { x: a.x, y: a.y, t: 0, at: sim2.time };
    watch.set(a, w);
  }
  w.t += dt;
  w.at = sim2.time;
  if (w.t < 1) return ok;
  const gained = Math.hypot(a.x - w.x, a.y - w.y);
  w.x = a.x;
  w.y = a.y;
  w.t = 0;
  if (gained >= speed * 0.3 || route.has(a)) return ok;
  if (routeTick !== sim2.time) {
    routeTick = sim2.time;
    routeLeft = 6;
  }
  if (routeLeft <= 0) return ok;
  routeLeft--;
  const path = findPath(sim2.world, Math.floor(a.x), Math.floor(a.y), Math.floor(tx), Math.floor(ty), 1500);
  if (!path.length) return false;
  route.set(a, { goal: key, path });
  return true;
}
function steer(sim2, a, tx, ty, speed, dt) {
  unstick(sim2, a);
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return true;
  const len = Math.min(d, speed * dt), w = sim2.world, water = ANIMALS[a.species].habitat === "water";
  const sx = dx / d * len, sy = dy / d * len;
  const fear = ANIMALS[a.species].fearsFire;
  if (fear) {
    const nf = fireDistance(sim2, a.x + sx, a.y + sy);
    if (nf < fear && nf < fireDistance(sim2, a.x, a.y)) return false;
  }
  const free = (x, y) => water ? isWater(sim2, Math.floor(x), Math.floor(y)) : w.inBounds(Math.floor(x), Math.floor(y)) && !w.isBlocked(Math.floor(x), Math.floor(y));
  const base = Math.atan2(dy, dx), side = turned.get(a) ?? (a.id % 2 ? 1 : -1);
  for (const t of TURNS) for (const sgn of t === 0 ? [1] : [side, -side]) {
    const ang = base + t * sgn, mx = Math.cos(ang) * len, my = Math.sin(ang) * len;
    if (!free(a.x + mx, a.y + my)) continue;
    a.x += mx;
    a.y += my;
    if (t > 0) turned.set(a, sgn);
    else if (turned.has(a)) turned.delete(a);
    if (Math.abs(mx) > 1e-3) a.dir = mx > 0 ? 1 : -1;
    return true;
  }
  if (Math.abs(sx) > 1e-3) a.dir = sx > 0 ? 1 : -1;
  return false;
}
var near = (sim2, x, y) => {
  let best = null;
  for (const v of sim2.villagers) {
    if (v.down > 0 || v.inside !== null) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (!best || d < best.d) best = { id: v.id, d };
  }
  return best;
};
function fireDistance(sim2, x, y) {
  let best = Infinity;
  for (const b of sim2.buildings) if (b.kind === "campfire" && b.done) best = Math.min(best, Math.hypot(b.x + 1 - x, b.y + 1 - y));
  return best;
}
function wanderTo(sim2, a, radius) {
  const def = animalDef(a);
  if (def.habitat === "water") radius = 4;
  for (let i = 0; i < 6; i++) {
    const ang = sim2.frnd() * Math.PI * 2, r = 2 + sim2.frnd() * radius;
    const x = a.home.x + Math.cos(ang) * r, y = a.home.y + Math.sin(ang) * r;
    if (habitable(sim2, def, Math.floor(x), Math.floor(y))) {
      a.dest = { x, y };
      return;
    }
  }
  a.dest = null;
}
function provoke(sim2, a, byId) {
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
  for (const o of sim2.animals) {
    if (o !== a && o.herd === a.herd && o.state !== "dead" && o.state !== "attack" && Math.hypot(o.x - a.x, o.y - a.y) < 9 && !animalDef(o).defends) {
      o.state = "flee";
      o.target = { kind: "unit", id: byId };
      o.timer = 6;
    }
  }
}
function tickAnimals(sim2, dt) {
  const night = sim2.restTime;
  for (let i = sim2.animals.length - 1; i >= 0; i--) {
    const a = sim2.animals[i];
    a.clock += dt;
    if (a.state === "dead") {
      a.carcass -= dt;
      if (a.carcass <= 0 || carcassEmpty(a)) {
        sim2.animals.splice(i, 1);
        sim2.animalById.delete(a.id);
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
      a.scan = 0.3 + sim2.frnd() * 0.2;
      const p = near(sim2, a.x, a.y);
      if (def.prey && def.flee > 0 && a.state !== "flee" && p && p.d < def.flee && !def.defends) {
        a.state = "flee";
        a.target = { kind: "unit", id: p.id };
        a.timer = 6;
        a.burst = 0;
      }
      if (def.aggro > 0 && a.state !== "attack" && p && (a.raid && !raidOver(a, night) || night && def.nocturnal) && p.d < (a.raid ? 40 : def.aggro)) {
        const v = sim2.get(p.id);
        if (fireDistance(sim2, v.x, v.y) > (def.fearsFire ?? 0)) {
          a.state = "attack";
          a.target = { kind: "unit", id: p.id };
          a.timer = 20;
          a.chaseT = 0;
          a.siege = void 0;
        }
      } else if (def.aggro > 0 && a.state !== "attack" && !p && (a.raid && !raidOver(a, night) || night && def.nocturnal)) {
        const house = sim2.nearestWork(a.x, a.y, a.raid ? 70 : def.aggro * 2, true);
        if (house) {
          a.state = "attack";
          a.target = null;
          a.siege = house.id;
          a.timer = 20;
          a.chaseT = 0;
        }
      }
    }
    switch (a.state) {
      case "flee": {
        const t = a.target && sim2.get(a.target.id);
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
        const ok = step(sim2, a, a.x + ax / d * 5, a.y + ay / d * 5, def.speed * slow, dt);
        if (!ok) {
          step(sim2, a, a.x - ay / d * 5, a.y + ax / d * 5, def.speed * slow, dt);
          if (def.cornered && d < 1.4 && a.cd <= 0) {
            a.cd = def.cycle;
            a.bite = 0.25;
            sim2.hurt({ kind: "unit", id: t.id }, def.damage, def.type, { x: a.x, y: a.y }, { animal: a });
          }
        }
        break;
      }
      case "attack": {
        if (a.siege) {
          const house = sim2.getBuilding(a.siege), out = near(sim2, a.x, a.y);
          if (out && out.d < (a.raid ? 40 : def.aggro)) {
            a.siege = void 0;
            a.state = "attack";
            a.target = { kind: "unit", id: out.id };
            a.timer = 20;
            a.chaseT = 0;
            break;
          }
          if (!house || !house.done || a.timer <= 0 || raidOver(a, night)) {
            a.siege = void 0;
            a.state = "graze";
            a.timer = 3;
            break;
          }
          const hd = BUILDINGS[house.kind], hx = house.x + hd.w / 2, hy = house.y + hd.h / 2;
          if (Math.hypot(hx - a.x, hy - a.y) - Math.max(hd.w, hd.h) / 2 > def.range + 0.4) step(sim2, a, hx, hy, def.speed * slow, dt);
          else if (a.cd <= 0) {
            a.cd = def.cycle;
            a.bite = 0.25;
            a.timer = 20;
            sim2.damageWork(house, def.damage);
          }
          break;
        }
        const t = a.target && sim2.get(a.target.id);
        a.chaseT = (a.chaseT ?? 0) + dt;
        const lost = !t || t.down > 0 || a.timer <= 0 || a.chaseT > chase_default.noHitSeconds || raidOver(a, night) || !a.raid && Math.hypot(t.x - a.x, t.y - a.y) > 16;
        if (lost) {
          a.state = "graze";
          a.target = null;
          a.chaseT = 0;
          a.timer = 3;
          if (a.raid && t === void 0) a.timer = 1;
          break;
        }
        const d = Math.hypot(t.x - a.x, t.y - a.y);
        if (def.fearsFire && fireDistance(sim2, t.x, t.y) <= def.fearsFire && fireDistance(sim2, a.x, a.y) < def.fearsFire + 1.5) {
          step(sim2, a, a.home.x, a.home.y, def.speed, dt);
          break;
        }
        if (d > def.range + 0.4) step(sim2, a, t.x, t.y, def.speed * slow, dt);
        else if (a.cd <= 0) {
          a.cd = def.cycle;
          a.bite = 0.25;
          a.chaseT = 0;
          const behind = t.facing === "right" && a.x < t.x || t.facing === "left" && a.x > t.x;
          sim2.hurt({ kind: "unit", id: t.id }, def.damage * (behind ? 1.25 : 1), def.type, { x: a.x, y: a.y }, { animal: a });
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
        if (!a.dest || !step(sim2, a, a.dest.x, a.dest.y, def.speed * 0.45, dt) || Math.hypot(a.dest.x - a.x, a.dest.y - a.y) < 0.3) {
          a.state = "graze";
          a.timer = 3 + sim2.frnd() * 8;
          a.dest = null;
        }
        break;
      }
      default: {
        if (raidOver(a, night)) {
          step(sim2, a, a.home.x, a.home.y, def.speed, dt);
          if (Math.hypot(a.home.x - a.x, a.home.y - a.y) < 2) {
            sim2.animals.splice(i, 1);
            sim2.animalById.delete(a.id);
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
          wanderTo(sim2, a, BEHAVIOUR.regionRadius);
          if (a.raid && night) {
            const p = near(sim2, a.x, a.y);
            if (p) a.dest = { x: sim2.get(p.id).x, y: sim2.get(p.id).y };
          }
        }
      }
    }
  }
}
function restock(sim2) {
  if (sim2.warSince >= 0) return;
  const chunks = sim2.world.readyChunks();
  if (!chunks.length) return;
  const s = sim2.world.start, N = sim2.world.size;
  for (const sp of SPECIES) {
    const def = ANIMALS[sp], alive2 = sim2.animals.filter((a) => a.species === sp && a.state !== "dead" && !a.raid).length, missing2 = countOf(sim2, def) - alive2;
    if (missing2 < def.herd[0] || sim2.frnd() > BEHAVIOUR.restockChance) continue;
    const size = Math.min(missing2, def.herd[0] + Math.floor(sim2.frnd() * (def.herd[1] - def.herd[0] + 1)));
    for (let tries = 0; tries < 24; tries++) {
      const [cx, cy] = chunks[Math.floor(sim2.frnd() * chunks.length)], x = cx * CHUNK + Math.floor(sim2.frnd() * CHUNK), y = cy * CHUNK + Math.floor(sim2.frnd() * CHUNK), d = Math.hypot(x - s.x, y - s.y);
      const z = zoneOf(d), far = z === 4 && def.zones[1] === 3 ? 3 : z;
      if (d < 16 && def.habitat !== "water" || far < def.zones[0] || far > def.zones[1] || !habitable(sim2, def, x, y)) continue;
      if (sim2.fog.state[y * N + x] === 2 || sim2.inView(x, y)) continue;
      const herd = 2e5 + sim2.nextAid;
      for (let i = 0; i < size; i++) {
        const ax = x + (sim2.frnd() - 0.5) * 4, ay = y + (sim2.frnd() - 0.5) * 4;
        if (sim2.world.isReady(Math.floor(ax), Math.floor(ay)) && habitable(sim2, def, Math.floor(ax), Math.floor(ay))) spawnAnimal(sim2, sp, ax, ay, herd);
      }
      break;
    }
  }
}
function tickWarAnimals(sim2, dt) {
  const w = sim2.view;
  for (let i = sim2.animals.length - 1; i >= 0; i--) {
    const a = sim2.animals[i];
    if (a.state === "dead") continue;
    if (!w || !sim2.inView(a.x, a.y)) {
      sim2.animals.splice(i, 1);
      sim2.animalById.delete(a.id);
      a.target = null;
      a.dest = null;
      a.state = "graze";
      a.timer = 2;
      sim2.hiddenAnimals.push(a);
      continue;
    }
    const def = animalDef(a), mx = (w.x0 + w.x1) / 2, my = (w.y0 + w.y1) / 2, dx = a.x - mx, dy = a.y - my, len = Math.hypot(dx, dy) || 1;
    a.state = "flee";
    a.target = null;
    a.timer = 2;
    a.clock += dt;
    step(sim2, a, a.x + dx / len * 12, a.y + dy / len * 12, def.speed * 1.2, dt);
    a.dir = dx >= 0 ? 1 : -1;
  }
}
function restoreWarAnimals(sim2) {
  for (const a of sim2.hiddenAnimals) {
    sim2.animals.push(a);
    sim2.animalById.set(a.id, a);
  }
  sim2.hiddenAnimals.length = 0;
}
var carcassEmpty = (a) => a.meat <= 0 && a.hide <= 0 && !Object.values(a.drops ?? {}).some((n) => (n ?? 0) > 0);
function die(sim2, a) {
  const def = animalDef(a);
  a.state = "dead";
  a.hp = 0;
  a.target = null;
  a.meat = def.meat;
  a.hide = def.hide;
  a.drops = { ...def.drops ?? {} };
  a.carcass = BEHAVIOUR.carcassSeconds;
}

// src/data/fightpolicy.json
var fightpolicy_default = {
  _note: "Nh\u1EEFng con s\u1ED1 kh\xE1c nhau gi\u1EEFa hai phe trong c\xF9ng m\u1ED9t c\u01A1 ch\u1EBF \u0111\xE1nh nhau (src/sim/battle.ts). player: l\xEDnh v\xE0 d\xE2n c\u1EE7a ta. foe: ng\u01B0\u1EDDi c\u1EE7a c\xE1c l\xE0ng. Mu\u1ED1n hai phe \u0111\xE1nh kh\xE1c nhau ch\xFAt n\xE0o th\xEC ch\u1EC9nh \u1EDF \u0111\xE2y tr\u01B0\u1EDBc, r\u1ED3i m\u1EDBi vi\u1EBFt lu\u1EADt ri\xEAng trong brainplayer.ts / brainfoe.ts.",
  player: {
    _defensive: "L\xEDnh tr\u1EA1i kh\xF4ng c\xF3 b\xE1o \u0111\u1ED9ng, ho\u1EB7c \u0111\u1EE9ng th\u1EBF ph\xF2ng th\u1EE7, ch\u1EC9 \u0111\xE1nh nh\u1EEFng g\xEC v\xE0o trong ng\u1EA7n n\xE0y \xF4.",
    defensive: 4.5,
    _fear: "D\xE2n th\u01B0\u1EDDng ch\u1EA1y kh\u1ECFi nguy hi\u1EC3m trong ng\u1EA7n n\xE0y \xF4.",
    fear: 10,
    _sight: "T\u1EA7m nh\xECn d\xF9ng cho ng\u01B0\u1EDDi ta khi kh\xF4ng ph\u1EA3i l\xEDnh c\u1EE7a ta (\xEDt d\xF9ng).",
    sight: 8,
    _chaseExtra: "\u0110u\u1ED5i theo: l\xEDnh ta th\u1EA5y m\u1EE5c ti\xEAu khi n\xF3 trong t\u1EA7m nh\xECn (sightOf) c\u1ED9ng ng\u1EA7n n\xE0y \xF4.",
    chaseExtra: 1
  },
  foe: {
    aggro: {
      peaceful: 6,
      aggressive: 14,
      ambusher: 9
    },
    _leash: "L\xEDnh l\xE0ng kh\xF4ng \u0111u\u1ED5i qu\xE1 ng\u1EA7n n\xE0y \xF4 kh\u1ECFi l\u1EEDa tr\u1EA1i (ho\u1EB7c t\u1EA7m c\u1EE7a l\xE0ng + 2, l\u1EA5y s\u1ED1 l\u1EDBn h\u01A1n).",
    leash: 24,
    willingReach: 24,
    raiderSight: 12,
    civSight: 9,
    chaseSight: 14,
    civFlee: 8,
    civKeepRunning: 6,
    hideWatch: 14,
    wanderRadius: {
      civ: 5,
      aggressive: 12,
      other: 8
    },
    cavalry: {
      _note: "Qu\xE2n c\u1EE7a l\xE0ng \u1EDF trong tr\u1EA1i nh\u01B0 qu\xE2n ta; khi c\xF3 chi\u1EBFn tranh ho\u1EB7c b\u1ECB t\u1EA5n c\xF4ng h\u1ECD ra \u0111\u1EE9ng \u1EDF c\xE1c v\u1ECB tr\xED ph\xF2ng th\u1EE7, v\xE0 m\u1ED9t ph\u1EA7n trong s\u1ED1 h\u1ECD (c\u1EA7m v\u0169 kh\xED \u0111\xE1nh g\u1EA7n) c\u01B0\u1EE1i th\xFA: k\u1EF5 binh kh\xF4ng \u0111\u1EE9ng g\xE1c, ch\u1EC9 l\xEDnh g\xE1c m\u1EDBi g\xE1c. minCamp: c\u1EA5p l\u1EEDa th\u1EA5p nh\u1EA5t c\u1EE7a l\xE0ng c\xF3 k\u1EF5 binh; share: t\u1EC9 l\u1EC7 l\xEDnh c\u01B0\u1EE1i; bossShare: t\u1EC9 l\u1EC7 \u1EDF l\xE0ng boss; beasts: th\xFA theo t\u1EEBng c\u1EA5p l\u1EEDa k\u1EC3 t\u1EEB minCamp (c\u1EA5p cu\u1ED1i d\xF9ng cho c\xE1c c\u1EA5p cao h\u01A1n); boss: th\xFA c\u1EE7a l\xE0ng boss.",
      minCamp: 3,
      share: 0.25,
      bossShare: 0.5,
      beasts: [
        "wolf",
        "boar"
      ],
      boss: "elephant"
    }
  }
};

// src/sim/fightpolicy.ts
var PLAYER = fightpolicy_default.player;
var FOE = fightpolicy_default.foe;
var chaseSight = (sim2, v) => v.team === "player" ? sim2.sightOf(v) + PLAYER.chaseExtra : FOE.chaseSight;

// src/data/npclife.json
var npclife_default = {
  _note: "\u0110\u1EDDi s\u1ED1ng c\u1EE7a d\xE2n c\xE1c l\xE0ng NPC khi ng\u01B0\u1EDDi ch\u01A1i \u1EDF g\u1EA7n: ch\u1EC9 l\xE0m vi\u1EC7c \u1EDF c\xE1c chunk (32 \xF4) quanh n\u01A1i d\xE2n c\u1EE7a ng\u01B0\u1EDDi ch\u01A1i \u0111ang \u0111\u1EE9ng ho\u1EB7c \u0111ang \u0111i t\u1EDBi (chunkReach chunk m\u1ED7i h\u01B0\u1EDBng); xa h\u01A1n th\xEC d\xE2n ch\u1EC9 \u0111i d\u1EA1o quanh tr\u1EA1i nh\u01B0 c\u0169 \u0111\u1EC3 nh\u1EB9 m\xE1y. M\u1ED7i l\u1EA7n r\u1EA3nh (kho\u1EA3ng 4-12 gi\xE2y) m\u1ED9t ng\u01B0\u1EDDi r\xFAt m\u1ED9t vi\u1EC7c v\u1EDBi x\xE1c su\u1EA5t. Ph\u1EA1m vi l\xE0m vi\u1EC7c l\xE0 \u0111\u1EA5t c\u1EE7a l\xE0ng (t\u1EA7m nh\xECn c\u1EE7a tr\u1EA1i l\u1EEDa theo c\u1EA5p tr\u1EA1i, trong building.json). chances: x\xE1c su\u1EA5t r\xFAt t\u1EEBng vi\u1EC7c (d\xE2n th\u01B0\u1EDDng: ch\u1EB7t g\u1ED7/\u0111\xE0o \u0111\xE1/h\xE1i, theo mix; l\xEDnh: tu\u1EA7n tra, s\u0103n, trinh s\xE1t). toolTierByCamp: b\u1EADc c\xF4ng c\u1EE5 (1 g\u1ED7, 2 \u0111\xE1) m\xE0 d\xE2n l\xE0m vi\u1EC7c b\u1EB1ng theo c\u1EA5p tr\u1EA1i l\u1EEDa 1..4: l\u1EA5y c\xF4ng c\u1EE5 cao nh\u1EA5t l\xE0ng \u0111\xF3 ch\u1EBF \u0111\u01B0\u1EE3c \u1EDF c\u1EA5p tr\u1EA1i c\u1EE7a h\u1ECD; c\xF4ng c\u1EE5 t\u1ED1t th\xEC m\u1ED7i l\u1EA7n thu \u0111\u01B0\u1EE3c nhi\u1EC1u h\u01A1n nh\u01B0 d\xE2n c\u1EE7a ta (TIER_YIELD), v\xE0 h\xECnh tr\xEAn tay \u0111\u1ED5i theo. unitsPerTrip: s\u1ED1 \u0111\u01A1n v\u1ECB l\u1EA5y \u0111\u01B0\u1EE3c m\u1ED7i chuy\u1EBFn. scoutReach: trinh s\xE1t \u0111i xa g\u1EA5p m\u1EA5y l\u1EA7n \u0111\u1EA5t l\xE0ng. tripSeconds: m\u1ED9t vi\u1EC7c qu\xE1 th\u1EDDi gian n\xE0y (d\xE2n th\u01B0\u1EDDng; l\xEDnh g\u1EA5p 3) th\xEC b\u1ECF.",
  chunkReach: 1,
  gatherReach: 1.6,
  lod: {
    minGuards: 2,
    minCivs: 2,
    sleepAfter: 30,
    gateRadius: 18,
    maxGuardShare: 0.6,
    postEvery: 4,
    armyStandDown: 20,
    guardShare: 0.4
  },
  seed: {
    tree: 14,
    rock: 10,
    bush: 8,
    minR: 15,
    maxR: 28
  },
  mix: {
    wood: 40,
    stone: 30,
    food: 30
  },
  chances: {
    work: 0.35,
    patrol: 0.25,
    hunt: 0.15,
    scout: 0.06
  },
  toolTierByCamp: [
    1,
    2,
    2,
    2
  ],
  unitsPerTrip: 3,
  scoutReach: 2,
  tripSeconds: 90
};

// src/sim/tools.ts
var TOOL_KINDS = ["axe", "pick", "hoe", "hammer"];
var TOOL_NAME = { axe: "R\xECu", pick: "Cu\u1ED1c chim", hoe: "Cu\u1ED1c", hammer: "B\xFAa" };
var TOOL_OF_JOB = { wood: "axe", stone: "pick", food: "hoe", build: "hammer" };
var TIER_NAME = ["Tay kh\xF4ng", "G\u1ED7", "\u0110\xE1"];
var TIER_SPEED = [0.6, 1, 1.4];
var TIER_YIELD = [1, 1.25, 1.6];
var TIER_DURABILITY = [0, 240, 600];
var GEAR_KINDS = ["club", "spear", "mace", "sling", "bow", "hide", "bone"];
var isArmorKind = (k) => k in ARMORS;
var isGear = (k) => GEAR_KINDS.includes(k);
var isWeaponKind = (k) => k in WEAPONS;
var R = (kind, tier, cost, time) => ({ id: `${kind}${tier}`, kind, tier, cost: scaleBill(cost), time });
var gearRecipe = (kind) => {
  const d = isArmorKind(kind) ? ARMORS[kind] : WEAPONS[kind];
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
  if (isArmorKind(r.kind)) return ARMORS[r.kind].name;
  if (r.kind === "torch") return "\u0110u\u1ED1c";
  if (isWeaponKind(r.kind)) return WEAPONS[r.kind].name;
  return `${TOOL_NAME[r.kind]} ${TIER_NAME[r.tier].toLowerCase()}`;
};
var emptyToolSet = () => ({ axe: null, pick: null, hoe: null, hammer: null });

// src/sim/tribework.ts
var WORK_OF = { wood: "wood", stone: "stone", food: "food" };
var GATHER = pace_default.gather;
var KIND_OF = { wood: "tree", stone: "rock", food: "bush" };
var chunkKey = (x, y) => Math.floor(y / CHUNK) * 1024 + Math.floor(x / CHUNK);
function refreshActive(sim2) {
  sim2.active.clear();
  const n = npclife_default.chunkReach;
  for (const v of sim2.villagers) {
    if (v.health <= 0) continue;
    const end = v.path.length ? v.path[v.path.length - 1] : null;
    const spots = [[v.x, v.y]];
    if (end) spots.push([end[0], end[1]]);
    for (const [x, y] of spots) {
      const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
      for (let j = cy - n; j <= cy + n; j++) for (let i = cx - n; i <= cx + n; i++) sim2.active.add(j * 1024 + i);
    }
  }
}
var isActive = (sim2, x, y) => sim2.active.has(chunkKey(x, y));
var toolTierOf = (t) => npclife_default.toolTierByCamp[Math.min(npclife_default.toolTierByCamp.length, Math.max(1, t.campLevel ?? 1)) - 1];
function tribeReach(t) {
  const lv = BUILDINGS.campfire.levels.stone;
  return lv[Math.min(lv.length, Math.max(1, t.campLevel ?? 1)) - 1].sight;
}
function endLife(sim2, f) {
  const ai = f.ai, L2 = ai?.life;
  if (!ai || !L2) return;
  if (L2.kind === "gather") {
    const n = L2.idx !== void 0 && L2.idx >= 0 ? sim2.world.nodes.get(L2.idx) : void 0;
    if (n && n.workers > 0) n.workers--;
    if (f.phase === "work") f.phase = "idle";
    const k = TOOL_OF_JOB[f.job];
    if (k) f.tools[k] = null;
    f.job = "idle";
  }
  ai.life = void 0;
  f.progress = 0;
  ai.wander = 3 + sim2.frnd() * 6;
}
function standBeside(sim2, idx) {
  const N = sim2.world.size, nx = idx % N, ny = idx / N | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (!sim2.world.isBlocked(nx + dx, ny + dy)) return [nx + dx, ny + dy];
  return null;
}
function pick(sim2, weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let x = sim2.frnd() * total;
  for (const [k, w] of Object.entries(weights)) {
    x -= w;
    if (x <= 0) return k;
  }
  return Object.keys(weights)[0];
}
function findNode(sim2, t, kind, reach) {
  const W = sim2.world, N = W.size, cx = Math.floor(t.camp.x), cy = Math.floor(t.camp.y), R2 = Math.floor(reach);
  let found = -1, seen = 0;
  for (let y = cy - R2; y <= cy + R2; y++) for (let x = cx - R2; x <= cx + R2; x++) {
    if (!W.inBounds(x, y) || Math.hypot(x - t.camp.x, y - t.camp.y) > reach) continue;
    const n = W.nodeAt(x, y);
    if (n && n.kind === kind && n.amount > 0 && n.workers < 1 && sim2.frnd() * ++seen < 1) found = y * N + x;
  }
  return found;
}
function lifeBrain(sim2, f, t, ai, dt) {
  if (!isActive(sim2, f.x, f.y)) {
    if (ai.life) endLife(sim2, f);
    return false;
  }
  const L2 = ai.life;
  if (L2) return tickLife(sim2, f, t, L2, dt);
  if (ai.wander > 0 || f.path.length || ai.role === "raider" || sim2.pathLeft <= 0) return false;
  const r = sim2.frnd(), reach = tribeReach(t), N = sim2.world.size;
  if (ai.role === "civ") {
    if (r >= npclife_default.chances.work) return false;
    const first = pick(sim2, npclife_default.mix), reachAt = reach * npclife_default.gatherReach;
    for (const job of [first, ...Object.keys(npclife_default.mix).filter((k) => k !== first)]) {
      if (sim2.pathLeft <= 0) return false;
      const idx = findNode(sim2, t, KIND_OF[job], reachAt), stand = idx >= 0 ? standBeside(sim2, idx) : null;
      if (!stand) continue;
      sim2.pathLeft--;
      const path = sim2.pathTo(f, stand[0], stand[1], 2500);
      if (!path.length) continue;
      sim2.world.nodes.get(idx).workers++;
      f.path = path;
      f.phase = "move";
      ai.life = { kind: "gather", idx, job, state: "go", t: 0, units: 0 };
      return true;
    }
    ai.wander = 4 + sim2.frnd() * 6;
    return false;
  }
  const c = npclife_default.chances;
  if (r < c.hunt) {
    let best = null;
    for (const a of sim2.animals) {
      if (a.state === "dead" || !ANIMALS[a.species].prey) continue;
      const d = Math.hypot(a.x - t.camp.x, a.y - t.camp.y);
      if (d <= reach && (!best || d < best.d) && isActive(sim2, a.x, a.y)) best = { id: a.id, d };
    }
    if (best) {
      f.fight.target = { kind: "animal", id: best.id };
      ai.life = { kind: "hunt", id: best.id, t: 0 };
    }
    return false;
  }
  if (r < c.hunt + c.patrol + c.scout) {
    const scout = r >= c.hunt + c.patrol, stops = [];
    for (let k = 0; k < (scout ? 1 : 3); k++) {
      const a = sim2.frnd() * Math.PI * 2, d = scout ? reach * (1.5 + sim2.frnd() * (npclife_default.scoutReach - 1.5)) : reach * (0.5 + sim2.frnd() * 0.45);
      stops.push([Math.floor(t.camp.x + Math.cos(a) * d), Math.floor(t.camp.y + Math.sin(a) * d)]);
    }
    stops.push([Math.floor(t.camp.x), Math.floor(t.camp.y)]);
    ai.life = { kind: scout ? "scout" : "patrol", stops, i: 0, t: 0 };
    return tickLife(sim2, f, t, ai.life, 0);
  }
  return false;
}
function tickLife(sim2, f, t, L2, dt) {
  L2.t = (L2.t ?? 0) + dt;
  if (L2.t > npclife_default.tripSeconds * (L2.kind === "gather" ? 1 : 3)) {
    endLife(sim2, f);
    return false;
  }
  switch (L2.kind) {
    case "gather": {
      const n = sim2.world.nodes.get(L2.idx), N = sim2.world.size;
      if (!n || n.amount <= 0) {
        endLife(sim2, f);
        return false;
      }
      if (L2.state === "go") {
        if (f.path.length) return true;
        if (Math.hypot(L2.idx % N + 0.5 - f.x, (L2.idx / N | 0) + 0.5 - f.y) > 2.2) {
          endLife(sim2, f);
          return false;
        }
        L2.state = "work";
        f.phase = "work";
        f.job = WORK_OF[L2.job];
        f.progress = 0;
        f.facing = L2.idx % N + 0.5 >= f.x ? "right" : "left";
        const k = TOOL_OF_JOB[f.job];
        if (k) f.tools[k] = { tier: toolTierOf(t), dur: 1e9 };
        return true;
      }
      f.path = [];
      f.phase = "work";
      f.job = WORK_OF[L2.job];
      f.progress += dt * Math.max(0.2, 1 + (t.eco ?? 0)) / GATHER[L2.job];
      if (f.progress < 1) return true;
      const gain = Math.min(n.amount, TIER_YIELD[toolTierOf(t)]);
      f.progress -= 1;
      n.amount -= gain;
      L2.units = (L2.units ?? 0) + gain;
      if (n.amount <= 0) {
        const idx = L2.idx;
        n.workers = Math.max(0, n.workers - 1);
        L2.idx = -1;
        sim2.world.depleted(idx, (x, y) => ![...sim2.villagers, ...sim2.foes].some((o) => Math.floor(o.x) === x && Math.floor(o.y) === y));
        endLife(sim2, f);
        return false;
      }
      if ((L2.units ?? 0) >= npclife_default.unitsPerTrip) {
        endLife(sim2, f);
        return false;
      }
      return true;
    }
    case "hunt": {
      const a = sim2.animalById.get(L2.id);
      if (!a) {
        endLife(sim2, f);
        return false;
      }
      if (a.state === "dead") {
        a.meat = 0;
        endLife(sim2, f);
        return false;
      }
      if (f.fight.skip && f.fight.skip.id === a.id && sim2.time < f.fight.skip.until) {
        endLife(sim2, f);
        return false;
      }
      return false;
    }
    default: {
      if (f.path.length) {
        f.phase = "move";
        return true;
      }
      const stops = L2.stops;
      if ((L2.i ?? 0) >= stops.length) {
        endLife(sim2, f);
        return false;
      }
      const [x, y] = stops[L2.i++], free = sim2.nearestFree(x, y, /* @__PURE__ */ new Set());
      if (free && sim2.pathLeft > 0) {
        sim2.pathLeft--;
        f.path = sim2.pathTo(f, free[0], free[1], 3e3);
        if (f.path.length) f.phase = "move";
      }
      return true;
    }
  }
}

// src/data/stats.json
var stats_default = {
  _note: "C\xF4ng th\u1EE9c ch\u1EC9 s\u1ED1 c\u1EE7a m\u1ECDi NPC l\xE0 ng\u01B0\u1EDDi. Gi\xE1 tr\u1ECB = g\u1ED1c \xD7 h\u1EC7 s\u1ED1 c\xE1 nh\xE2n \xD7 h\u1EC7 s\u1ED1 b\u1EADc \xD7 (1 + t\u1ED5ng % nghi\xEAn c\u1EE9u / 100). M\u1ED7i ch\u1EC9 s\u1ED1 t\xEDnh ri\xEAng, kh\xF4ng \u0111\u1ECDc ch\u1EC9 s\u1ED1 kh\xE1c (ngo\u1EA1i tr\u1EEB t\xE1c d\u1EE5ng c\u1EE7a Tr\xED tu\u1EC7, ghi \u1EDF intEffect). base = gi\xE1 tr\u1ECB g\u1ED1c c\u1EE7a ch\u1EC9 s\u1ED1. stars: tr\u1ECDng s\u1ED1 xu\u1EA5t hi\u1EC7n c\u1EE7a 1 \u0111\u1EBFn 5 sao; t\u1ED5ng 8 h\u1EC7 s\u1ED1 c\xE1 nh\xE2n c\u1EE7a m\u1ED9t ng\u01B0\u1EDDi b\u1EB1ng 8 \xD7 (budgetBase + budgetPerStar \xD7 sao), m\u1ED7i h\u1EC7 s\u1ED1 \u0111\u01B0\u1EE3c r\xFAt ng\u1EABu nhi\xEAn quanh 1 v\u1EDBi \u0111\u1ED9 l\u1EC7ch spread r\u1ED3i b\u1ECB gi\u1EDBi h\u1EA1n trong [min, max], n\xEAn kh\xF4ng ai qu\xE1 cao hay qu\xE1 th\u1EA5p. tierMult[b\u1EADc] = h\u1EC7 s\u1ED1 nh\xE2n l\xEAn g\u1ED1c c\u1EE7a c\u1EA3 vai tr\xF2 khi \u0111\xE3 nghi\xEAn c\u1EE9u b\u1EADc \u0111\xF3. defense.k: % gi\u1EA3m s\xE1t th\u01B0\u01A1ng = \u0111i\u1EC3m th\u1EE7 / (\u0111i\u1EC3m th\u1EE7 + k). intEffect: m\u1ED7i 100% Tr\xED tu\u1EC7 tr\xEAn g\u1ED1c th\xEC t\u1ED1c \u0111\u1ED9 l\xE0m vi\u1EC7c t\u0103ng work v\xE0 s\u1EE9c ti\xEAu hao gi\u1EA3m drain (theo t\u1EF7 l\u1EC7). legacy: c\xE1c ch\u1ED7 c\u0169 c\u1EE7a game v\u1EABn \u0111\u1ECDc 4 ch\u1EC9 s\u1ED1 c\u0169 (S\u1EE9c kh\u1ECFe, S\u1EE9c m\u1EA1nh, Nhanh nh\u1EB9n, Th\u1EC3 l\u1EF1c), n\xEAn ch\xFAng \u0111\u01B0\u1EE3c t\xEDnh ng\u01B0\u1EE3c t\u1EEB gi\xE1 tr\u1ECB m\u1EDBi theo c\xE1c h\u1EC7 s\u1ED1 n\xE0y.",
  base: { hp: 100, atk: 10, defm: 20, defr: 20, move: 2, work: 1, int: 10, sta: 100 },
  stars: { weights: [30, 30, 25, 10, 5], budgetBase: 0.92, budgetPerStar: 0.04, spread: 0.3, min: 0.8, max: 1.25 },
  tierMult: {
    "2": { hp: 1.5, atk: 1.4, defm: 1.4, defr: 1.4, move: 1.1, work: 1.2, int: 1.2, sta: 1.3 }
  },
  defense: { k: 100 },
  intEffect: { work: 0.5, drain: 0.5 },
  staDrainRef: 100,
  legacy: { hpBase: 40, hpPerVit: 8, strengthDamage: 0.6, atkToDamage: 0.4, speedBase: 1.6, speedPerAgi: 0.1, staScale: 0.065, vitFromHp: true }
};

// src/content/difficulty.json
var difficulty_default = {
  _note: "\u0110\u1ED9 kh\xF3 v\xE0 s\u1EE9c m\u1EA1nh c\u1EE7a c\xE1c l\xE0ng. power: s\u1EE9c m\u1EA1nh m\u1ED9t l\xE0ng = economy \xD7 (kinh t\u1EBF) + military \xD7 (qu\xE2n s\u1EF1). Kinh t\u1EBF = t\u1ED5ng h\u1EC7 s\u1ED1 t\u1ED1c \u0111\u1ED9 l\xE0m vi\u1EC7c c\u1EE7a m\u1ECDi ng\u01B0\u1EDDi \u0111ang c\xF3 vi\u1EC7c s\u1EA3n xu\u1EA5t (1 l\xE0 ng\u01B0\u1EDDi g\u1ED1c ch\u01B0a nghi\xEAn c\u1EE9u). Qu\xE2n s\u1EF1 = t\u1ED5ng h\u1EC7 s\u1ED1 ch\u1EC9 s\u1ED1 chi\u1EBFn \u0111\u1EA5u (m\xE1u \xD7 s\u1EE9c m\u1EA1nh \xD7 ph\xF2ng th\u1EE7, so v\u1EDBi ng\u01B0\u1EDDi g\u1ED1c) c\u1EE7a m\u1ECDi l\xEDnh v\xE0 trinh s\xE1t. T\xEDnh theo CH\u1EC8 S\u1ED0 (k\u1EC3 c\u1EA3 ph\u1EA7n tr\u0103m nghi\xEAn c\u1EE9u), kh\xF4ng t\xEDnh theo v\u0169 kh\xED. L\xE0ng NPC c\xF3 B\u1EACC (tier trong tribes.json): y\u1EBFu, th\u01B0\u1EDDng, trung b\xECnh, boss. Tr\u1EA7n ng\u01B0\u1EDDi ch\u01A1i = d\xE2n t\u1ED1i \u0111a c\u1EE7a c\u1EA5p l\u1EEDa (k\u1EC3 c\u1EA3 gi\u01B0\u1EDDng nh\xE0 d\xE2n) \xD7 ch\u1EC9 s\u1ED1 t\u1ED1i \u0111a nghi\xEAn c\u1EE9u \u0111\u01B0\u1EE3c \u1EDF c\u1EA5p Nh\xE0 nghi\xEAn c\u1EE9u = c\u1EA5p l\u1EEDa; militaryShare l\xE0 ph\u1EA7n d\xE2n l\xE0m l\xEDnh. tiers: m\u1ED7i b\u1EADc c\xF3 strength (\u0111\xE3 calibrate b\u1EB1ng tr\u1EADn m\xF4 ph\u1ECFng: qu\xE2n tr\u1EA1i t\u1ED1i \u0111a c\u1EE7a c\u1EA5p l\u1EEDa tham chi\u1EBFu, \u0111\u1EE7 \u0111\u1ED3, nghi\xEAn c\u1EE9u theo c\u1EA5p \u0111\xF3: l\xE0ng th\u01B0\u1EDDng \u1EDF l\u1EEDa 2 m\u1EA5t kho\u1EA3ng 33% qu\xE2n, trung b\xECnh \u1EDF l\u1EEDa 3 kho\u1EA3ng 29%, y\u1EBFu \u1EDF l\u1EEDa 2 kho\u1EA3ng 10%; trung b\xECnh c\xF3 v\xE1ch \u0111\xE1, strength 4 l\xE0 thua h\u1EB3n) (s\u1EE9c qu\xE2n v\xE0 kinh t\u1EBF c\u1EE7a l\xE0ng = strength \xD7 tr\u1EA7n ng\u01B0\u1EDDi ch\u01A1i \u1EDF c\u1EA5p tr\u1EA1i c\u1EE7a l\xE0ng; boss: boss.power \xD7 tr\u1EA7n \u1EDF c\u1EA5p l\u1EEDa ng\u01B0\u1EDDi ch\u01A1i + 1), edge (c\u1EA5p tr\u1EA1i c\u1EE7a l\xE0ng = l\u1EEDa ng\u01B0\u1EDDi ch\u01A1i + edge: y\u1EBFu \u22121, th\u01B0\u1EDDng 0, trung b\xECnh +1, boss +1) v\xE0 capLevel (c\u1EA5p tr\u1EA1i cao nh\u1EA5t, qua \u0111\xF3 l\xE0ng y\u1EBFu lu\xF4n d\u1EC5 h\u01A1n). Code t\u1EF1 t\xEDnh ph\u1EA7n tr\u0103m ch\u1EC9 s\u1ED1 (m\xE1u, s\u1EE9c m\u1EA1nh, ph\xF2ng th\u1EE7, l\xE0m vi\u1EC7c) cho ng\u01B0\u1EDDi c\u1EE7a l\xE0ng \u0111\u1EC3 \u0111\u1EA1t m\u1EE5c ti\xEAu, kh\xF4ng ghi tay. bonusClamp: gi\u1EDBi h\u1EA1n ph\u1EA7n tr\u0103m ch\u1EC9 s\u1ED1 c\u1ED9ng th\xEAm. S\u1ED1 ng\u01B0\u1EDDi c\u1EE7a m\u1ED9t l\xE0ng = s\u1ED1 d\xE2n tr\u1EA1i l\u1EEDa c\u1EE7a n\xF3 ch\u1EE9a \u1EDF c\u1EA5p tr\u1EA1i (POP_BY_FIRE), chia l\xEDnh v\xE0 d\xE2n theo warriors v\xE0 civilians trong tribes.json. raid: \u0111\u1EE3t t\u1EA5n c\xF4ng c\u1EE7a b\u1ED9 t\u1ED9c c\xF3 tr\u01B0\u1EDDng power trong events.json (1 = m\u1EA1nh b\u1EB1ng qu\xE2n s\u1EF1 hi\u1EC7n t\u1EA1i c\u1EE7a ng\u01B0\u1EDDi ch\u01A1i, 1.1 = h\u01A1n 10%, 0.8 = y\u1EBFu h\u01A1n 20%). K\u1EBFt qu\u1EA3 b\u1ECB k\u1EB9p gi\u1EEFa floor v\xE0 ceiling nh\xE2n qu\xE2n s\u1EF1 t\u1ED1i \u0111a c\u1EE7a ng\u01B0\u1EDDi ch\u01A1i \u1EDF c\u1EA5p l\u1EEDa \u0111\xF3: ng\u01B0\u1EDDi ch\u01A1i kh\xF4ng c\xF3 qu\xE2n v\u1EABn g\u1EB7p m\u1ED9t \u0111\u1EE3t t\u1ED1i thi\u1EC3u, v\xE0 ng\u01B0\u1EDDi ch\u01A1i qu\xE1 m\u1EA1nh kh\xF4ng l\xE0m \u0111\u1EE3t t\u1EA5n c\xF4ng v\xF4 ngh\u0129a. capture: khi m\u1ED9t l\xE0ng b\u1ECB thu n\u1EA1p ho\u1EB7c b\u1ECB ti\xEAu di\u1EC7t (do ng\u01B0\u1EDDi c\u1EE7a ta \u0111\xE1nh), ta nh\u1EADn c\u1EA3 t\xFAi chi\u1EBFn l\u1EE3i ph\u1EA9m c\u1EE7a l\xE0ng (spoils, tra theo th\u1EDDi \u0111\u1EA1i hi\u1EC7n t\u1EA1i r\u1ED3i c\u1EA5p tr\u1EA1i c\u1EE7a n\xF3, boss nh\xE2n bossMult; m\u1ED7i l\xE0ng ch\u1EC9 tr\u1EA3 m\u1ED9t l\u1EA7n \u1EDE M\u1ED6I TH\u1EDCI \u0110\u1EA0I, \u0111\u1EC3 sang th\u1EDDi sau kh\xF4ng ai khai th\xE1c m\xE3i m\u1ED9t l\xE0ng c\u0169: b\u1EA3ng 'ancient' hi\u1EC7n ch\u1EC9 l\xE0 s\u1ED1 t\u1EA1m, g\u1EA5p ba b\u1EA3ng \u0111\u1ED3 \u0111\xE1); l\xE0ng ch\u1ECBu c\u1ED1ng n\u1EA1p th\xEC c\u1EE9 m\u1ED7i tribute.everyDays ng\xE0y tr\u1EA3 m\u1ED9t ph\u1EA7n c\u1EE7a t\xFAi \u0111\xF3: baseShare l\xFAc \u0111\u1EA7u, ng\u01B0\u1EDDi ch\u01A1i t\u0103ng ho\u1EB7c gi\u1EA3m t\u1EEBng step (t\u1ED1i \u0111a maxShare). M\u1ED7i l\u1EA7n tr\u1EA3 quan h\u1EC7 gi\u1EA3m relationLoss \xD7 (1 + s\u1ED1 b\u01B0\u1EDBc \u0111\xF2i th\xEAm); m\u1ED7i b\u01B0\u1EDBc \u0111\xF2i th\xEAm c\u1ED9ng greedChancePerStep c\u01A1 h\u1ED9i l\xE0ng PH\u1EA2N B\u1ED8I (th\xE0nh th\u1EE7 l\u0129nh ph\u1EE5 'rebel' c\xF3 s\u1EE9c b\u1EB1ng rebel.share c\u1EE7a boss, t\u1ED1i \u0111a maxRebels, t\u1EF1 t\u1EADp k\xEDch nh\u01B0 m\u1ECDi l\xE0ng th\xF9 \u0111\u1ECBch, xem events.json hostile). Ng\u01B0\u1EDDi ch\u01A1i c\xF3 th\u1EC3 h\u1EA1 m\u1EE9c c\u1ED1ng n\u1EA1p xu\u1ED1ng 0 (kh\xF4ng l\u1EA5y): m\u1ED7i k\u1EF3 kh\xF4ng l\u1EA5y, quan h\u1EC7 h\u1ED3i relationRegen (t\u1ED1i \u0111a 100). Quan h\u1EC7 c\u1EE7a l\xE0ng c\u1ED1ng n\u1EA1p xu\u1ED1ng t\u1EDBi betrayBelow th\xEC l\xE0ng ph\u1EA3n b\u1ED9i ngay. Th\u1EE7 l\u0129nh ph\u1EA3n b\u1ED9i m\xE0 b\u1ECB ta \u0111\xE1nh th\u1EAFng th\xEC h\u1EBFt l\xE0 th\u1EE7 l\u0129nh: tr\u1EDF l\u1EA1i c\u1ED1ng n\u1EA1p th\xEAm returnBonus (rebel.returnBonus) so v\u1EDBi m\u1EE9c m\u1EB7c \u0111\u1ECBnh, ph\u1EA7n th\xEAm n\xE0y kh\xF4ng b\u1ECB tr\u1EEB quan h\u1EC7 v\xE0 kh\xF4ng c\xF3 c\u01A1 h\u1ED9i ph\u1EA3n b\u1ED9i. M\u1ED7i ng\xE0y l\xE0ng (\u0111\xE3 h\xE0ng, c\u1ED1ng n\u1EA1p ho\u1EB7c t\u1EF1 do) h\u1ED3i recoverPerDay s\u1ED1 qu\xE2n v\xE0 d\xE2n c\xF2n thi\u1EBFu. T\xFAi l\xE0 s\u1ED1 c\u1ED1 \u0111\u1ECBnh trong d\u1EEF li\u1EC7u, kh\xF4ng ph\u1EE5 thu\u1ED9c vi\u1EC7c ng\u01B0\u1EDDi c\u1EE7a l\xE0ng l\xE0m vi\u1EC7c hay c\xF3 camera lia t\u1EDBi. adopt: thu n\u1EA1p m\u1ED9t l\xE0ng (ho\u1EB7c ti\xEAu di\u1EC7t h\u1EB3n) c\u1ED9ng V\u0128NH VI\u1EC4N cho ta pop ng\u01B0\u1EDDi (ch\u1ED7 \u1EDF v\xE0 ng\u01B0\u1EDDi m\u1EDBi \u0111\u1EBFn \u1EDF l\u1EEDa) v\xE0 slots ch\u1ED7 cho M\u1ED6I tr\u1EA1i l\xEDnh (b\u1ED9 binh, cung, k\u1EF5), theo b\u1EADc c\u1EE7a l\xE0ng, v\xEC s\u1ED1 l\xEDnh b\u1ECB gi\u1EDBi h\u1EA1n b\u1EDFi ch\u1ED7 c\u1EE7a tr\u1EA1i ch\u1EE9 kh\xF4ng ph\u1EA3i b\u1EDFi s\u1ED1 d\xE2n. L\xE0ng thu n\u1EA1p bi\u1EBFn m\u1EA5t h\u1EB3n kh\u1ECFi b\u1EA3n \u0111\u1ED3 v\xE0 kh\xF4ng c\u1ED1ng n\u1EA1p n\u1EEFa. C\u1ED1ng n\u1EA1p th\xEC l\xE0ng v\u1EABn s\u1ED1ng n\xEAn kh\xF4ng c\u1ED9ng g\xEC. gift: t\u1EB7ng qu\xE0 cho l\xE0ng ch\u01B0a chi\u1EBFm (tr\u1EEB boss): m\u1ED7i l\u1EA7n t\u1EB7ng share c\u1EE7a t\xFAi c\u1EE7a l\xE0ng \u0111\xF3; quan h\u1EC7 t\u0103ng 100 \xD7 share / cost (cost l\xE0 s\u1ED1 l\u1EA7n t\xFAi c\u1EE7a l\xE0ng c\u1EA7n t\u1EB7ng \u0111\u1EC3 quan h\u1EC7 t\u1EEB 0 l\xEAn 100: y\u1EBFu 1, th\u01B0\u1EDDng 1,5, trung b\xECnh 2, n\xEAn l\xE0ng m\u1EA1nh \u0111\xF2i nhi\u1EC1u h\u01A1n). Quan h\u1EC7 t\u1EEB friendAt tr\u1EDF l\xEAn l\xE0ng kh\xF4ng g\u1EEDi t\u1EADp k\xEDch qua ph\xE1 ta. allies: s\u1ED1 l\xEDnh m\u1ED7i l\xE0ng g\xF3p khi ta \u0111i \u0111\xE1nh (theo b\u1EADc l\xE0ng, chia \u0111\u1EC1u b\u1ED9 binh, cung, k\u1EF5; gi\u1EA3m theo quan h\u1EC7: quan h\u1EC7 100 l\xE0 \u0111\u1EE7). L\xE0ng \u0111ang c\u1ED1ng n\u1EA1p g\xF3p m\u1ECDi b\u1EADc, quan h\u1EC7 gi\u1EA3m battleLoss m\u1ED7i tr\u1EADn; l\xE0ng ch\u01B0a chi\u1EBFm c\xF3 quan h\u1EC7 100 (qua t\u1EB7ng qu\xE0) g\xF3p tr\u1EEB b\u1EADc trung b\xECnh, r\u1ED3i quan h\u1EC7 gi\u1EA3m giftLoss. L\xEDnh \u0111\u1ED3ng minh l\u1EA5y \u0111\u1ED3 t\u1EEB Kho v\u0169 kh\xED c\u1EE7a ta, d\xF9ng ch\u1EC9 s\u1ED1 nghi\xEAn c\u1EE9u c\u1EE7a ta, v\xE0 sau tr\u1EADn r\u1EDDi \u0111i, khu\u1EA5t kh\u1ECFi camera l\xE0 bi\u1EBFn m\u1EA5t (\u0111\u1ED3 c\u1EE7a ng\u01B0\u1EDDi c\xF2n s\u1ED1ng v\u1EC1 kho). yieldPerVillage: ph\u1EA7n tr\u0103m s\u1EA3n l\u01B0\u1EE3ng khai th\xE1c (g\u1ED7, \u0111\xE1, th\u1EE9c \u0103n, s\u0103n) c\u1ED9ng th\xEAm cho M\u1ED6I l\xE0ng \u0111\xE3 thu n\u1EA1p ho\u1EB7c ti\xEAu di\u1EC7t (sim.conquered).",
  power: {
    economy: 1,
    military: 1
  },
  militaryShare: 0.6,
  bonusClamp: [
    -0.6,
    5
  ],
  raid: {
    floor: 0.25,
    ceiling: 1
  },
  capture: {
    bossMult: 2,
    spoils: {
      stone: {
        food: [
          160,
          500,
          1400,
          3200,
          6e3
        ],
        wood: [
          120,
          400,
          1e3,
          2400,
          4800
        ],
        stone: [
          80,
          300,
          800,
          2e3,
          4e3
        ],
        hide: [
          20,
          60,
          160,
          400,
          800
        ],
        coin: [
          10,
          30,
          80,
          200,
          400
        ]
      },
      ancient: {
        food: [
          480,
          1500,
          4200,
          9600,
          18e3
        ],
        wood: [
          360,
          1200,
          3e3,
          7200,
          14400
        ],
        stone: [
          240,
          900,
          2400,
          6e3,
          12e3
        ],
        hide: [
          60,
          180,
          480,
          1200,
          2400
        ],
        coin: [
          30,
          90,
          240,
          600,
          1200
        ]
      }
    },
    yieldPerVillage: 15,
    adopt: {
      weak: {
        pop: 3,
        slots: 1
      },
      normal: {
        pop: 6,
        slots: 2
      },
      medium: {
        pop: 18,
        slots: 6
      },
      boss: {
        pop: 18,
        slots: 6
      },
      rebel: {
        pop: 18,
        slots: 6
      }
    },
    tribute: {
      everyDays: 3,
      baseShare: 0.25,
      step: 0.1,
      maxShare: 1,
      relationLoss: 1,
      greedChancePerStep: 0.05,
      recoverPerDay: 0.15,
      betrayBelow: -40,
      relationRegen: 2
    },
    rebel: {
      share: 0.6,
      maxRebels: 3,
      returnBonus: 0.3
    },
    allies: {
      weak: 3,
      normal: 6,
      medium: 18,
      battleLoss: 10,
      giftLoss: 30
    },
    gift: {
      share: 0.1,
      cost: {
        weak: 1,
        normal: 1.5,
        medium: 2
      },
      friendAt: 100
    }
  },
  boss: {
    _note: "L\xE0ng \u0111\u1EA7u m\u1EE5c (boss): m\u1ED7i v\xE1n c\xF3 m\u1ED9t l\xE0ng boss (b\u1EADc 'boss' c\u1EE7a tribes.json), lu\xF4n h\u01A1n ng\u01B0\u1EDDi ch\u01A1i m\u1ED9t b\u1EADc (c\u1EA5p tr\u1EA1i +1, t\u1ED1i \u0111a maxCamp; c\xF3 ch\xF2i canh v\xE0 \u0111\u1ED3 \u0111\u1ED3ng d\xF9 ng\u01B0\u1EDDi ch\u01A1i c\xF2n \u1EDF \u0111\u1ED3 \u0111\xE1). power: s\u1EE9c m\u1EA1nh qu\xE2n c\u1EE7a boss so v\u1EDBi qu\xE2n t\u1ED1i \u0111a ng\u01B0\u1EDDi ch\u01A1i c\xF3 th\u1EC3 c\xF3 \u1EDF c\u1EA5p tr\u1EA1i \u0111\xF3 (ch\u1EC9 s\u1ED1 m\u1ED7i l\xEDnh ch\u1EC9 t\u0103ng theo c\u0103n b\u1EADc ba c\u1EE7a s\u1ED1 n\xE0y, n\xEAn c\u1EA7n s\u1ED1 l\u1EDBn: 6 \u0111\u01B0\u1EE3c ch\u1EC9nh b\u1EB1ng ch\u1EA1y th\u1EED tr\u1EADn: 60 l\xEDnh tr\u1EA1i \u0111\u1EE7 gi\xE1p v\xE0 nghi\xEAn c\u1EE9u h\u1EBFt m\u1EE9c c\u1EE7a c\u1EA5p tr\u1EA1i 4 lu\xF4n thua, 93 l\xEDnh (60 c\u1EE7a ta c\u1ED9ng 33 l\xEDnh \u0111\u1ED3ng minh c\u1EE7a c\xE1c l\xE0ng) th\u1EAFng v\xE0 m\u1EA5t kho\u1EA3ng 30 \u0111\u1EBFn 40% qu\xE2n); economy: kinh t\u1EBF so v\u1EDBi kinh t\u1EBF t\u1ED1i \u0111a; popMult: s\u1ED1 d\xE2n so v\u1EDBi c\u1EA5p tr\u1EA1i; bronzeShare: ph\u1EA7n l\xEDnh c\u1EA7m v\u0169 kh\xED \u0111\u1ED3ng v\xE0 m\u1EB7c gi\xE1p \u0111\u1ED3ng; wallHp: \u0111\u1ED9 b\u1EC1n r\xE0o, c\u1ED5ng, ch\xF2i v\xE0 nh\xE0 so v\u1EDBi l\xE0ng th\u01B0\u1EDDng.",
    power: 6,
    economy: 0.6,
    popMult: 1.6,
    bronzeShare: 0.6,
    wallHp: 1.5,
    weapons: [
      "bronze_sword",
      "bronze_axe",
      "bronze_spear"
    ]
  },
  tiers: {
    weak: {
      capLevel: 2,
      edge: -1,
      strength: 10
    },
    normal: {
      capLevel: 3,
      edge: 0,
      strength: 3
    },
    medium: {
      capLevel: 4,
      edge: 1,
      strength: 2.5
    },
    boss: {
      capLevel: 4,
      edge: 1
    },
    rebel: {
      capLevel: 4,
      edge: 1
    }
  }
};

// src/data/mounts.json
var mounts_default = {
  _note: "Mounts. A beast is tamed in the Chu\u1ED3ng th\xFA (the level of the stable decides which) and given to a villager like a tool; the riders of the Tr\u1EA1i k\u1EF5 th\xFA ride the beast of the camp's level without one. speed multiplies the walk, guard multiplies the damage the rider takes, ride is how many pixels the rider sits above the ground, species is the animals/bodies.json art. cost and time are for one beast (time in seconds with one average keeper).",
  kinds: {
    wolf: { name: "S\xF3i", tier: 1, species: "wolf", speed: 1.7, guard: 0.95, ride: 9, cost: { food: 50, hide: 20, coin: 10 }, time: 240 },
    boar: { name: "L\u1EE3n r\u1EEBng", tier: 2, species: "boar", speed: 1.4, guard: 0.85, ride: 8, cost: { food: 100, hide: 40, coin: 20 }, time: 360 },
    elephant: { name: "Voi", tier: 3, species: "mammoth", speed: 1.15, guard: 0.65, ride: 19, cost: { food: 200, hide: 60, coin: 30 }, time: 600 }
  }
};

// src/data/training.json
var training_default = {
  _note: "Training in the house of a role: a day or two away from work, for a few per cent of one stat, paid in food and coin. See src/sim/training.ts.",
  dayBase: 0.6,
  dayPerStat: 0.12,
  foodBase: 4,
  coinBase: 1,
  coinPerStat: 0.3333,
  gain: [0.01, 0.05],
  partnerShare: 0.5,
  floor: 0.6,
  floorMin: 3,
  caps: [8, 12, 16],
  care: [
    { name: "Kh\xF4ng", coin: 0, penalty: 0.8 },
    { name: "C\u1EA9n th\u1EADn", coin: 2, penalty: 0.4 },
    { name: "Chu \u0111\xE1o", coin: 5, penalty: 0.15 }
  ],
  profiles: {
    infantry: { main: "str", partner: "vit", cost: "agi" },
    guardpost: { main: "str", partner: "vit", cost: "agi" },
    archery: { main: "agi", partner: "sta", cost: "str" },
    cavalry: { main: "agi", partner: "sta", cost: "vit" },
    lumberyard: { main: "str", partner: "vit", cost: "agi" },
    quarry: { main: "str", partner: "vit", cost: "agi" },
    farmhouse: { main: "agi", partner: "sta", cost: "str" },
    huntlodge: { main: "agi", partner: "sta", cost: "str" },
    builder: { main: "sta", partner: "str", cost: "vit" },
    workshop: { main: "agi", cost: "sta" },
    lab: { main: "sta", cost: "agi" },
    stable: { main: "agi", partner: "sta", cost: "str" },
    scouttent: { main: "agi", partner: "sta", cost: "str" }
  }
};

// src/sim/jobs.ts
var TRAINING = training_default;
var MOUNT_KINDS = ["wolf", "boar", "elephant"];
var MOUNTS = mounts_default.kinds;
var fmtStat = (x) => String(Math.round(x * 10) / 10);
var STAT_NAME = { vit: "S\u1EE9c kh\u1ECFe", str: "S\u1EE9c m\u1EA1nh", agi: "Nhanh nh\u1EB9n", sta: "Th\u1EC3 l\u1EF1c" };
var JOBS = {
  wood: { name: "\u0110\u1ED1n g\u1ED7", stat: "str", res: "wood", node: "tree", baseTime: pace_default.gather.wood, anim: "chop" },
  stone: { name: "Th\u1EE3 \u0111\xE1", stat: "str", res: "stone", node: "rock", baseTime: pace_default.gather.stone, anim: "mine" },
  food: { name: "H\xE1i l\u01B0\u1EE3m", stat: "agi", res: "food", node: "bush", baseTime: pace_default.gather.food, anim: "gather" },
  build: { name: "Th\u1EE3 x\xE2y", stat: "sta", baseTime: 1, anim: "build" },
  craft: { name: "Ch\u1EBF t\u1EA1o", stat: "agi", baseTime: 1, anim: "craft" },
  research: { name: "Nghi\xEAn c\u1EE9u", stat: "sta", baseTime: 1, anim: "gather" },
  tame: { name: "Thu\u1EA7n th\xFA", stat: "agi", baseTime: 1, anim: "craft" },
  hunt: { name: "Th\u1EE3 s\u0103n", stat: "agi", baseTime: 1, anim: "thrust_attack" },
  fight: { name: "Chi\u1EBFn binh", stat: "str", baseTime: 1, anim: "swing_attack" }
};
var JOB_NAME = { idle: "R\u1EA3nh", wood: "\u0110\u1ED1n g\u1ED7", stone: "Th\u1EE3 \u0111\xE1", food: "H\xE1i l\u01B0\u1EE3m", build: "Th\u1EE3 x\xE2y", craft: "Ch\u1EBF t\u1EA1o", research: "Nghi\xEAn c\u1EE9u", tame: "Thu\u1EA7n th\xFA", hunt: "Th\u1EE3 s\u0103n", fight: "Chi\u1EBFn binh", scout: "Trinh s\xE1t", supply: "H\u1EADu c\u1EA7n" };
var WORK_JOBS = ["wood", "stone", "food", "build", "craft", "research", "tame", "hunt", "fight"];
var ROLES = {
  wood: { job: "wood", building: "lumberyard", names: { stone: "\u0110\u1ED1n g\u1ED7", ancient: "Ti\u1EC1u phu" } },
  stone: { job: "stone", building: "quarry", names: { stone: "Th\u1EE3 \u0111\xE1", ancient: "Th\u1EE3 m\u1ECF" } },
  food: { job: "food", building: "farmhouse", names: { stone: "H\xE1i l\u01B0\u1EE3m", ancient: "N\xF4ng d\xE2n" } },
  hunt: { job: "hunt", building: "huntlodge", names: { stone: "Th\u1EE3 s\u0103n", ancient: "Th\u1EE3 s\u0103n" } },
  foot: { job: "fight", arm: "foot", building: "infantry", names: { stone: "L\xEDnh b\u1ED9", ancient: "B\u1ED9 binh" } },
  cavalry: { job: "fight", arm: "cavalry", building: "cavalry", names: { stone: "K\u1EF5 th\xFA", ancient: "K\u1EF5 binh" } },
  archer: { job: "fight", arm: "archer", building: "archery", names: { stone: "Th\u1EE3 n\xE9m", ancient: "Cung th\u1EE7" } },
  guard: { job: "fight", arm: "foot", building: "guardpost", names: { stone: "L\xEDnh g\xE1c", ancient: "L\xEDnh g\xE1c" } },
  tower: { job: "fight", arm: "archer", building: "tower", names: { stone: "L\xEDnh ch\xF2i canh", ancient: "L\xEDnh ch\xF2i canh" } },
  scout: { job: "scout", building: "scouttent", names: { stone: "Trinh s\xE1t", ancient: "Trinh s\xE1t" } },
  supply: { job: "supply", building: "supplycamp", names: { stone: "L\xEDnh h\u1EADu c\u1EA7n", ancient: "L\xEDnh h\u1EADu c\u1EA7n" } }
};
var ROLE_IDS = Object.keys(ROLES);
var roleName = (role, era) => ROLES[role].names[era];
function roleOf(v) {
  switch (v.job) {
    case "fight":
      return v.guard ? v.post >= 0 ? "tower" : "guard" : v.arm === "archer" ? "archer" : v.arm === "cavalry" ? "cavalry" : "foot";
    case "food":
      return v.post < 0 ? "food" : null;
    case "wood":
    case "stone":
    case "hunt":
    case "scout":
    case "supply":
      return v.job;
    default:
      return null;
  }
}
var STAFF_BUILDING = { craft: "workshop", research: "lab", tame: "stable" };
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
  craftCostPerLevel: 0.5,
  _note: "Research is done inside the Nh\xE0 nghi\xEAn c\u1EE9u by villagers who work there: the more and the smarter, the faster. Tools, weapons, armour and torches have no blueprint (recipe id: axe1 is the wood axe, axe2 the stone one): the level of the Nh\xE0 ch\u1EBF t\u1EA1o alone (recipeLevel) decides which can be made. cost may include coin (shells in the stone age). time is seconds at speed 1 with one average researcher; the best researcher inside must reach minInt. needLevel is the Nh\xE0 nghi\xEAn c\u1EE9u level. unlocks: recipes, buildings (kinds that may be built), Set enabled to false to open everything.",
  recipeLevel: { axe1: 1, hammer1: 1, pick1: 1, hoe1: 1, club1: 1, hide1: 1, bone2: 2, spear1: 2, axe2: 2, pick2: 2, hoe2: 2, hammer2: 2, mace2: 3, torch1: 1, sling1: 1, bow1: 2 },
  techs: [
    { id: "signal", name: "T\xEDn hi\u1EC7u (tr\u1ED1ng, kh\xF3i)", desc: "Tr\u1ED1ng b\xE1o \u0111\u1ED9ng: d\xE2n v\u1EC1 l\u1EEDa, qu\xE2n v\u1EC1 v\u1ECB tr\xED; th\u1EBB l\u1EC7nh Ph\xE1t t\xEDn hi\u1EC7u cho c\xE1c \u0111\u1ED9i.", requires: [], needLevel: 2, minInt: 6, cost: { wood: 15, coin: 4 }, time: 220, unlocks: {} },
    { id: "form_basic", name: "Tr\u1EADn ph\xE1p c\u01A1 b\u1EA3n", desc: "H\xE0ng ngang v\xE0 v\xF2ng tr\xF2n.", requires: [], needLevel: 1, minInt: 6, cost: { wood: 12, coin: 4 }, time: 240, unlocks: {} },
    { id: "form_wedge", name: "Tr\u1EADn m\u0169i nh\u1ECDn", desc: "Xung phong ph\xE1 h\xE0ng.", requires: ["form_basic"], needLevel: 2, minInt: 7, cost: { wood: 12, coin: 5 }, time: 260, unlocks: {} },
    { id: "form_horns", name: "Tr\u1EADn s\u1EEBng b\xF2", desc: "Bao hai c\xE1nh, \u0111\xE1nh s\u01B0\u1EDDn v\xE0 l\u01B0ng.", requires: ["form_basic", "signal"], needLevel: 2, minInt: 7, cost: { wood: 12, coin: 5 }, time: 260, unlocks: {} },
    { id: "form_scatter", name: "Tr\u1EADn r\u1EA3i qu\xE2n", desc: "Gi\u1EA3m thi\u1EC7t h\u1EA1i t\u1EEB cung v\xE0 l\u1EEDa.", requires: ["form_basic"], needLevel: 2, minInt: 7, cost: { wood: 12, coin: 5 }, time: 260, unlocks: {} },
    { id: "form_ambush", name: "Tr\u1EADn ph\u1EE5c k\xEDch", desc: "\u0110\xF2n \u0111\u1EA7u m\u1EA1nh g\u1EA5p \u0111\xF4i v\xE0o \u0111\u1ECBch ch\u01B0a bi\u1EBFt.", requires: ["form_basic", "signal"], needLevel: 2, minInt: 7, cost: { wood: 12, coin: 5 }, time: 260, unlocks: {} },
    { id: "form_cells_10", name: "M\u1EDF r\u1ED9ng \xF4 tr\u1EADn ph\xE1p (10)", desc: "M\u1ED7i tr\u1EADn ph\xE1p c\xF3 10 \xF4 thay v\xEC 5.", requires: ["form_basic"], needLevel: 2, minInt: 7, cost: { wood: 12, coin: 5 }, time: 280, unlocks: { formationCells: 10 } },
    { id: "form_cells_15", name: "M\u1EDF r\u1ED9ng \xF4 tr\u1EADn ph\xE1p (15)", desc: "M\u1ED7i tr\u1EADn ph\xE1p c\xF3 15 \xF4.", requires: ["form_cells_10"], needLevel: 3, minInt: 8, cost: { wood: 15, stone: 10, coin: 8 }, time: 360, unlocks: { formationCells: 15 } },
    { id: "form_squads_5", name: "M\u1EDF r\u1ED9ng \u0111\u1ED9i (5)", desc: "L\u1EADp \u0111\u01B0\u1EE3c 5 \u0111\u1ED9i thay v\xEC 4.", requires: ["form_cells_10"], needLevel: 2, minInt: 7, cost: { wood: 12, coin: 5 }, time: 280, unlocks: { squads: 5 } },
    { id: "form_squads_6", name: "M\u1EDF r\u1ED9ng \u0111\u1ED9i (6)", desc: "L\u1EADp \u0111\u01B0\u1EE3c 6 \u0111\u1ED9i.", requires: ["form_squads_5"], needLevel: 3, minInt: 8, cost: { wood: 15, stone: 10, coin: 8 }, time: 360, unlocks: { squads: 6 } },
    { id: "plan_report", name: "B\xE1o c\xE1o chi ti\u1EBFt", desc: "M\u1EDF tab Chi ti\u1EBFt trong b\xE1o c\xE1o tri\u1EC3n khai: so s\xE1nh qu\xE2n ta v\xE0 \u0111\u1ECBch.", requires: ["plan_foot_hp_3", "plan_foot_defm_3", "plan_foot_defr_3", "plan_cavalry_hp_3", "plan_cavalry_defm_3", "plan_cavalry_defr_3", "plan_archer_hp_3", "plan_archer_defm_3", "plan_archer_defr_3"], needLevel: 2, minInt: 7, cost: { wood: 20, stone: 10, coin: 8 }, time: 360, unlocks: {} },
    { id: "plan_supply", name: "T\xEDnh to\xE1n h\u1EADu c\u1EA7n", desc: "B\xE1o c\xE1o h\u1EADu c\u1EA7n chi ti\u1EBFt: s\u1ED1 ng\xE0y \u0111i, l\u01B0\u01A1ng v\xE0 v\u1EADt li\u1EC7u c\u1EA7n mang, s\u1ED1 l\xEDnh h\u1EADu c\u1EA7n c\u1EA7n thi\u1EBFt, c\xF3 n\xFAt \xE1p d\u1EE5ng \u0111\u1EC1 xu\u1EA5t.", requires: ["plan_foot_hp_5", "plan_foot_defm_5", "plan_foot_defr_5", "plan_cavalry_hp_5", "plan_cavalry_defm_5", "plan_cavalry_defr_5", "plan_archer_hp_5", "plan_archer_defm_5", "plan_archer_defr_5", "plan_report"], needLevel: 3, minInt: 8, cost: { wood: 30, stone: 20, coin: 12 }, time: 480, unlocks: {} },
    { id: "plan_weather", name: "D\u1EF1 b\xE1o th\u1EDDi ti\u1EBFt", desc: "B\xE1o c\xE1o tri\u1EC3n khai cho bi\u1EBFt th\u1EDDi ti\u1EBFt h\xF4m nay v\xE0 ng\xE0y mai.", requires: ["plan_foot_move_3", "plan_foot_atk_3", "plan_foot_sta_3", "plan_cavalry_move_3", "plan_cavalry_atk_3", "plan_cavalry_sta_3", "plan_archer_move_3", "plan_archer_atk_3", "plan_archer_sta_3", "plan_report"], needLevel: 2, minInt: 7, cost: { wood: 20, stone: 10, coin: 8 }, time: 360, unlocks: {} },
    { id: "plan_rest", name: "Ngh\u1EC9 ng\u01A1i d\xE3 chi\u1EBFn", desc: "Trong chi\u1EBFn tranh, cho t\u1EEBng \u0111\u1ED9i d\u1EF1ng l\u1EC1u v\xE0 ngh\u1EC9 ng\u01A1i b\u1EA5t c\u1EE9 l\xFAc n\xE0o, c\u1EA3 ban ng\xE0y; xem b\xE1o c\xE1o s\u1EE9c c\u1EE7a c\xE1c \u0111\u1ED9i.", requires: ["plan_foot_move_5", "plan_foot_atk_5", "plan_foot_sta_5", "plan_cavalry_move_5", "plan_cavalry_atk_5", "plan_cavalry_sta_5", "plan_archer_move_5", "plan_archer_atk_5", "plan_archer_sta_5", "plan_weather"], needLevel: 3, minInt: 8, cost: { wood: 30, stone: 20, coin: 12 }, time: 480, unlocks: {} }
  ]
};

// src/data/researchtree.json
var researchtree_default = {
  _note: "C\xE2y nghi\xEAn c\u1EE9u ch\u1EC9 s\u1ED1 trong Nh\xE0 nghi\xEAn c\u1EE9u. M\u1ED7i \xF4 l\xE0 m\u1ED9t d\xE2y: m\u1ED9t ch\u1EC9 s\u1ED1 c\u1EE7a m\u1ED9t vai tr\xF2. S\u1ED0 C\u1EA4P C\u1EE6A M\u1ED6I CH\u1EC8 S\u1ED0 b\u1EB1ng s\u1ED1 ph\u1EA7n t\u1EED c\u1EE7a m\u1EA3ng steps c\u1EE7a n\xF3 (th\xEAm hay b\u1EDBt s\u1ED1 trong steps l\xE0 th\xEAm hay b\u1EDBt c\u1EA5p, m\u1ED7i ch\u1EC9 s\u1ED1 t\u1EF1 \u0111\u1EB7t ri\xEAng); tiers ri\xEAng c\u1EE7a ch\u1EC9 s\u1ED1 (n\u1EBFu ghi) thay cho tiers chung b\xEAn d\u01B0\u1EDBi, s\u1ED1 cu\u1ED1i \u0111\u01B0\u1EE3c d\xF9ng ti\u1EBFp cho c\xE1c c\u1EA5p cao h\u01A1n. Ng\u01B0\u1EDDi ch\u01A1i t\u1EF1 ch\u1ECDn \xF4 n\xE0o c\u0169ng \u0111\u01B0\u1EE3c (ch\u1ECDn ch\u1EC9 s\u1ED1 v\xF4 d\u1EE5ng cho vai tr\xF2 th\xEC l\xE0 l\u1ED7 c\u1EE7a h\u1ECD). steps[stat] = % c\u1ED9ng th\xEAm \u1EDF t\u1EEBng c\u1EA5p, gi\u1EA3m d\u1EA7n nh\u01B0ng c\xF3 s\xE0n; t\u1ED5ng % c\u1ED9ng d\u1ED3n c\u1EE7a m\u1ED9t \xF4 l\xE0 ph\u1EA7n c\u1ED9ng th\xEAm c\u1EE7a ch\u1EC9 s\u1ED1 \u0111\xF3 cho c\u1EA3 vai tr\xF2 (g\u1ED1c \xD7 (1 + t\u1ED5ng% / 100)). cost = v\u1EADt li\u1EC7u c\u1EE7a c\u1EA5p 1 (c\u1ED9ng th\xEAm ti\u1EC1n t\u0103ng d\u1EA7n), nh\xE2n 'growth.cost' m\u1ED7i c\u1EA5p; time (gi\xE2y c\xF4ng) nh\xE2n 'growth.time' m\u1ED7i c\u1EA5p. tiers[n-1] = c\u1EA5p Nh\xE0 nghi\xEAn c\u1EE9u c\u1EA7n cho c\u1EA5p n. Ch\u01B0a n\u1ED1i v\xE0o c\xF4ng th\u1EE9c chi\u1EBFn \u0111\u1EA5u v\xE0 l\xE0m vi\u1EC7c: xem statBonus trong sim/research.ts.",
  tiers: [
    1,
    1,
    1,
    2,
    2,
    2,
    3,
    3,
    3,
    3
  ],
  growth: {
    cost: 1.35,
    time: 1.15
  },
  stats: {
    hp: {
      name: "M\xE1u",
      short: "M\xE1u",
      steps: [
        12.5,
        6,
        3,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 72,
      about: "M\xE1u t\u1ED1i \u0111a."
    },
    atk: {
      name: "S\u1EE9c m\u1EA1nh",
      short: "S\xE1t th\u01B0\u01A1ng",
      steps: [
        8,
        4,
        2.5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 72,
      about: "S\xE1t th\u01B0\u01A1ng m\u1ED7i \u0111\xF2n \u0111\xE1nh."
    },
    aspd: {
      name: "T\u1ED1c \u0111\u1ED9 \u0111\xE1nh",
      short: "T\u1ED1c \u0111\xE1nh",
      steps: [
        5,
        2.5,
        2.5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 72,
      about: "T\u1ED1c \u0111\u1ED9 \u0111\xE1nh c\u1EE7a v\u0169 kh\xED: ai c\u1EA7m n\xF3 \u0111\xE1nh v\xE0 b\u1EAFn nhanh h\u01A1n, th\u1EDDi gian gi\u1EEFa hai \u0111\xF2n ng\u1EAFn l\u1EA1i."
    },
    crit: {
      name: "T\u1EC9 l\u1EC7 ch\xED m\u1EA1ng",
      short: "Ch\xED m\u1EA1ng",
      steps: [
        0.5,
        1,
        1,
        1,
        1
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 78,
      about: "T\u1EC9 l\u1EC7 ch\xED m\u1EA1ng c\u1EE7a v\u0169 kh\xED, t\xEDnh tr\xEAn 100%: m\u1ED7i c\u1EA5p c\u1ED9ng th\u1EB3ng v\xE0o x\xE1c su\u1EA5t (0,5% l\xE0 n\u1EEDa ph\u1EA7n tr\u0103m). T\u1ED1i \u0111a 10%."
    },
    critd: {
      name: "S\xE1t th\u01B0\u01A1ng ch\xED m\u1EA1ng",
      short: "ST ch\xED m\u1EA1ng",
      steps: [
        20,
        10,
        5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 78,
      about: "S\xE1t th\u01B0\u01A1ng c\u1EE7a \u0111\xF2n ch\xED m\u1EA1ng t\xEDnh tr\xEAn 100% \u0111\xF2n th\u01B0\u1EDDng, g\u1ED1c 125%: m\u1ED7i c\u1EA5p c\u1ED9ng th\u1EB3ng v\xE0o (400% l\xE0 g\u1EA5p 4 l\u1EA7n \u0111\xF2n th\u01B0\u1EDDng)."
    },
    tspd: {
      name: "T\u1ED1c \u0111\u1ED9 l\xE0m vi\u1EC7c v\u1EDBi c\xF4ng c\u1EE5",
      short: "T\u1ED1c \u0111\u1ED9",
      steps: [
        6,
        5,
        4,
        3,
        3
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 66,
      about: "Ai c\u1EA7m c\xF4ng c\u1EE5 n\xE0y l\xE0m vi\u1EC7c nhanh h\u01A1n (c\u1ED9ng v\xE0o h\u1EC7 s\u1ED1 c\u1EE7a c\xF4ng c\u1EE5)."
    },
    tyield: {
      name: "S\u1EA3n l\u01B0\u1EE3ng",
      short: "S\u1EA3n l\u01B0\u1EE3ng",
      steps: [
        4,
        4,
        3,
        3,
        2
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 66,
      about: "M\u1ED7i l\u1EA7n khai th\xE1c thu \u0111\u01B0\u1EE3c nhi\u1EC1u h\u01A1n khi c\u1EA7m c\xF4ng c\u1EE5 n\xE0y."
    },
    tdur: {
      name: "\u0110\u1ED9 b\u1EC1n",
      short: "\u0110\u1ED9 b\u1EC1n",
      steps: [
        10,
        10,
        10,
        5,
        5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 66,
      about: "C\xF4ng c\u1EE5 l\xE2u h\u1ECFng h\u01A1n (th\u1EDDi gian l\xE0m vi\u1EC7c tr\u01B0\u1EDBc khi g\xE3y d\xE0i ra)."
    },
    defm: {
      name: "Ph\xF2ng th\u1EE7 c\u1EADn chi\u1EBFn",
      short: "Th\u1EE7 c\u1EADn",
      steps: [
        10,
        5,
        2.5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 84,
      about: "Gi\u1EA3m s\xE1t th\u01B0\u01A1ng nh\u1EADn t\u1EEB l\xEDnh c\u1EADn chi\u1EBFn."
    },
    defr: {
      name: "Ph\xF2ng th\u1EE7 t\u1EA7m xa",
      short: "Th\u1EE7 xa",
      steps: [
        10,
        5,
        2.5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 84,
      about: "Gi\u1EA3m s\xE1t th\u01B0\u01A1ng nh\u1EADn t\u1EEB l\xEDnh t\u1EA7m xa."
    },
    move: {
      name: "T\u1ED1c \u0111\u1ED9 di chuy\u1EC3n",
      short: "Ch\u1EA1y",
      steps: [
        2.5,
        2.5,
        2.5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 60,
      about: "T\u1ED1c \u0111\u1ED9 \u0111i v\xE0 ch\u1EA1y."
    },
    work: {
      name: "T\u1ED1c \u0111\u1ED9 l\xE0m vi\u1EC7c",
      short: "L\xE0m vi\u1EC7c",
      steps: [
        5,
        2.5,
        2.5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 2
      },
      time: 66,
      about: "T\u1ED1c \u0111\u1ED9 l\xE0m vi\u1EC7c: khai th\xE1c, x\xE2y, ch\u1EBF t\u1EA1o, nghi\xEAn c\u1EE9u."
    },
    int: {
      name: "Tr\xED tu\u1EC7",
      short: "Tr\xED tu\u1EC7",
      steps: [
        5,
        2.5,
        2.5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 4
      },
      time: 78,
      about: "Tr\xED tu\u1EC7: t\u0103ng t\u1ED1c \u0111\u1ED9 l\xE0m vi\u1EC7c v\xE0 gi\u1EA3m s\u1EE9c ti\xEAu hao khi l\xE0m vi\u1EC7c."
    },
    sta: {
      name: "S\u1EE9c",
      short: "S\u1EE9c",
      steps: [
        8,
        4,
        2.5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 5
      },
      time: 66,
      about: "S\u1EE9c b\u1EC1n: l\xE0m vi\u1EC7c v\xE0 chi\u1EBFn \u0111\u1EA5u \u0111\u01B0\u1EE3c l\xE2u."
    },
    hpregen: {
      name: "H\u1ED3i m\xE1u",
      short: "H\u1ED3i m\xE1u",
      steps: [
        10,
        5,
        5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 5
      },
      time: 66,
      about: "T\u1ED1c \u0111\u1ED9 h\u1ED3i m\xE1u khi b\u1ECB th\u01B0\u01A1ng: nhanh h\u01A1n th\xEAm b\u1EA5y nhi\xEAu ph\u1EA7n tr\u0103m."
    },
    restregen: {
      name: "H\u1ED3i s\u1EE9c",
      short: "H\u1ED3i s\u1EE9c",
      steps: [
        10,
        5,
        5,
        2.5,
        2.5
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 5
      },
      time: 66,
      about: "T\u1ED1c \u0111\u1ED9 h\u1ED3i s\u1EE9c khi ng\u1EE7: nhanh h\u01A1n th\xEAm b\u1EA5y nhi\xEAu ph\u1EA7n tr\u0103m."
    },
    mspeed: {
      name: "T\u1ED1c \u0111\u1ED9 h\xE0nh qu\xE2n",
      short: "H\xE0nh qu\xE2n",
      steps: [
        3,
        3,
        3,
        3,
        3
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 60,
      about: "Qu\xE2n \u0111i nhanh h\u01A1n khi h\xE0nh qu\xE2n trong chi\u1EBFn tranh."
    },
    mload: {
      name: "T\u1EA3i h\u1EADu c\u1EA7n",
      short: "T\u1EA3i",
      steps: [
        2,
        2,
        2,
        2,
        2
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 60,
      about: "M\u1ED7i l\xEDnh h\u1EADu c\u1EA7n mang \u0111\u01B0\u1EE3c nhi\u1EC1u h\u01A1n."
    },
    mbuild: {
      name: "T\u1ED1c \u0111\u1ED9 d\u1EF1ng l\u1EC1u",
      short: "D\u1EF1ng l\u1EC1u",
      steps: [
        10,
        10,
        10,
        10,
        10
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 60,
      about: "L\xEDnh h\u1EADu c\u1EA7n d\u1EF1ng l\u1EC1u d\xE3 chi\u1EBFn nhanh h\u01A1n."
    },
    gyield: {
      name: "S\u1EA3n l\u01B0\u1EE3ng ngh\u1EC1",
      short: "S\u1EA3n l\u01B0\u1EE3ng",
      steps: [
        10,
        8,
        6,
        4,
        2
      ],
      cost: {
        food: 10,
        wood: 10,
        stone: 5,
        coin: 1
      },
      time: 70,
      about: "M\u1ED7i l\u1EA7n khai th\xE1c ho\u1EB7c x\u1EBB th\xFA thu \u0111\u01B0\u1EE3c nhi\u1EC1u h\u01A1n (c\u1ED9ng v\u1EDBi % s\u1EA3n l\u01B0\u1EE3ng c\u1EE7a c\xF4ng c\u1EE5, r\u1ED3i l\xE0m tr\xF2n l\xEAn s\u1ED1 nguy\xEAn)."
    }
  },
  roles: {
    foot: {
      name: "B\u1ED9 binh",
      building: "infantry"
    },
    cavalry: {
      name: "K\u1EF5 th\xFA",
      building: "cavalry"
    },
    archer: {
      name: "Th\u1EE3 n\xE9m",
      building: "archery"
    },
    scout: {
      name: "Trinh s\xE1t",
      building: "scouttent"
    },
    wood: {
      name: "\u0110\u1ED1n g\u1ED7",
      building: "lumberyard"
    },
    stone: {
      name: "Th\u1EE3 \u0111\xE1",
      building: "quarry"
    },
    food: {
      name: "H\xE1i l\u01B0\u1EE3m",
      building: "farmhouse"
    },
    hunt: {
      name: "Th\u1EE3 s\u0103n",
      building: "huntlodge"
    },
    build: {
      name: "Th\u1EE3 x\xE2y",
      building: "builder"
    },
    craft: {
      name: "Th\u1EE3 ch\u1EBF t\u1EA1o",
      building: "workshop"
    },
    research: {
      name: "Nh\xE0 nghi\xEAn c\u1EE9u",
      building: "lab"
    },
    tame: {
      name: "Thu\u1EA7n th\xFA",
      building: "stable"
    },
    club: {
      name: "G\u1EADy g\u1ED7",
      weapon: "club"
    },
    spear: {
      name: "Gi\xE1o g\u1ED7",
      weapon: "spear"
    },
    mace: {
      name: "Ch\xF9y \u0111\xE1",
      weapon: "mace"
    },
    sling: {
      name: "D\xE2y qu\u0103ng \u0111\xE1",
      weapon: "sling"
    },
    bow: {
      name: "Cung ng\u1EAFn",
      weapon: "bow"
    },
    basic: {
      name: "Tr\u1EADn ph\xE1p c\u01A1 b\u1EA3n",
      building: "drill",
      formation: true,
      needs: "form_basic"
    },
    wedge: {
      name: "M\u0169i nh\u1ECDn",
      building: "drill",
      formation: true,
      needs: "form_wedge"
    },
    horns: {
      name: "S\u1EEBng b\xF2",
      building: "drill",
      formation: true,
      needs: "form_horns"
    },
    scatter: {
      name: "R\u1EA3i qu\xE2n",
      building: "drill",
      formation: true,
      needs: "form_scatter"
    },
    ambush: {
      name: "Ph\u1EE5c k\xEDch",
      building: "drill",
      formation: true,
      needs: "form_ambush"
    },
    axe: {
      name: "R\xECu",
      tool: "axe"
    },
    pick: {
      name: "Cu\u1ED1c chim",
      tool: "pick"
    },
    hoe: {
      name: "Cu\u1ED1c",
      tool: "hoe"
    },
    hammer: {
      name: "B\xFAa",
      tool: "hammer"
    },
    guard: {
      name: "L\xEDnh g\xE1c",
      building: "guardpost"
    },
    towerman: {
      name: "L\xEDnh ch\xF2i canh",
      building: "tower"
    },
    fence: {
      name: "H\xE0ng r\xE0o",
      building: "fence"
    },
    gate: {
      name: "C\u1ED5ng",
      building: "gate"
    },
    trap: {
      name: "Ch\xF4ng",
      building: "trap"
    },
    tower: {
      name: "Ch\xF2i canh",
      building: "tower"
    },
    march_foot: {
      name: "B\u1ED9 binh",
      building: "infantry"
    },
    march_cavalry: {
      name: "K\u1EF5 th\xFA",
      building: "cavalry"
    },
    march_archer: {
      name: "Th\u1EE3 n\xE9m",
      building: "archery"
    },
    march_army: {
      name: "To\xE0n qu\xE2n",
      building: "supplycamp"
    },
    plan_foot: {
      name: "B\u1ED9 binh",
      building: "infantry"
    },
    plan_cavalry: {
      name: "K\u1EF5 th\xFA",
      building: "cavalry"
    },
    plan_archer: {
      name: "Th\u1EE3 n\xE9m",
      building: "archery"
    }
  },
  tabs: {
    _note: "Qu\xE2n s\u1EF1 m\u1EDF khi Nh\xE0 nghi\xEAn c\u1EE9u \u0111\u1EA1t c\u1EA5p needLab; tab V\u0169 kh\xED ch\u1EC9 m\u1EDF khi Qu\xE2n s\u1EF1 \u0111\xE3 m\u1EDF. Hai tab X\xE2y d\u1EF1ng v\xE0 Kinh t\u1EBF m\u1EDF s\u1EB5n.",
    military: {
      needLab: 2
    }
  },
  chains: {
    _note: "M\u1ED7i nh\xF3m l\xE0 m\u1ED9t chu\u1ED7i ch\u1EC9 s\u1ED1 \u0111i t\u1EEB tr\xEAn xu\u1ED1ng d\u01B0\u1EDBi (order). C\u1EA5p n c\u1EE7a m\u1ED9t ch\u1EC9 s\u1ED1 c\u1EA7n ch\u1EC9 s\u1ED1 ngay ph\xEDa tr\xEAn \u0111\u1EA1t c\u1EA5p n; ch\u1EC9 s\u1ED1 \u0111\u1EA7u chu\u1ED7i c\u1EA5p n c\u1EA7n ch\u1EC9 s\u1ED1 cu\u1ED1i chu\u1ED7i \u0111\u1EA1t c\u1EA5p n-1. Qu\xE2n s\u1EF1: M\xE1u, Th\u1EE7 c\u1EADn, Th\u1EE7 xa, Ch\u1EA1y, S\xE1t th\u01B0\u01A1ng, S\u1EE9c. C\xF4ng c\u1EE5 (tab C\xF4ng c\u1EE5 b\u1EADc 1): m\u1ED7i C\xD4NG C\u1EE4 (r\xECu, cu\u1ED1c chim, cu\u1ED1c, b\xFAa) m\u1ED9t c\u1ED9t T\u1ED1c \u0111\u1ED9, S\u1EA3n l\u01B0\u1EE3ng (kh\xF4ng c\xF3 \u1EDF b\xFAa), \u0110\u1ED9 b\u1EC1n; ai c\u1EA7m c\xF4ng c\u1EE5 \u0111\xF3 \u0111\u01B0\u1EE3c c\u1ED9ng, b\u1EADc c\u1EE7a c\xF4ng c\u1EE5 (g\u1ED7, \u0111\xE1) do c\u1EA5p Nh\xE0 ch\u1EBF t\u1EA1o. Tr\u1EADn ph\xE1p (tab Chi\u1EBFn \u0111\u1EA5u, nh\xE1nh Ch\u1EC9 s\u1ED1 tr\u1EADn ph\xE1p): m\u1ED7i tr\u1EADn (c\u01A1 b\u1EA3n g\u1ED3m H\xE0ng ngang v\xE0 V\xF2ng tr\xF2n) m\u1ED9t c\u1ED9t, c\xF9ng chu\u1ED7i ch\u1EC9 s\u1ED1 qu\xE2n, chia l\xE0m hai \u0111o\u1EA1n (layout) v\u1EDBi \xF4 tr\u1EADn ph\xE1p \u1EDF gi\u1EEFa v\xE0 m\u1EDF r\u1ED9ng \u0111\u1ED9i \u1EDF cu\u1ED1i; gates: ch\u1EC9 s\u1ED1 n\xE0y c\u1EA5p 1 c\u1EA7n nghi\xEAn c\u1EE9u \u0111\xF3; l\xEDnh \u0111\u1EE9ng trong \u0111\u1ED9i \u0111ang d\xF9ng tr\u1EADn \u0111\xF3 \u0111\u01B0\u1EE3c c\u1ED9ng th\xEAm, v\xE0 m\u1ED7i b\u01B0\u1EDBc ch\u1EC9 \u0111\u01B0\u1EE3c scale (0,5) l\u1EA7n ph\u1EA7n c\u1EE7a Qu\xE2n s\u1EF1; m\u1ED7i tr\u1EADn ch\u1EC9 nghi\xEAn c\u1EE9u \u0111\u01B0\u1EE3c khi \u0111\xE3 m\u1EDF tr\u1EADn (needs). V\u0169 kh\xED (tab V\u0169 kh\xED b\u1EADc 1): m\u1ED7i V\u0168 KH\xCD (kh\xF4ng ph\u1EA3i m\u1ED7i vai tr\xF2) m\u1ED9t c\u1ED9t T\u1ED1c \u0111\u1ED9 \u0111\xE1nh, T\u1EC9 l\u1EC7 ch\xED m\u1EA1ng, S\xE1t th\u01B0\u01A1ng ch\xED m\u1EA1ng (hai ch\u1EC9 s\u1ED1 n\xE0y t\xEDnh b\u1EB1ng % th\u1EADt: 0,5% x\xE1c su\u1EA5t; 400% l\xE0 g\u1EA5p 4 l\u1EA7n \u0111\xF2n th\u01B0\u1EDDng); ai c\u1EA7m v\u0169 kh\xED \u0111\xF3 \u0111\u01B0\u1EE3c c\u1ED9ng ch\u1EC9 s\u1ED1 c\u1EE7a n\xF3; khi c\u1EA3 ba ch\u1EC9 s\u1ED1 \u0111\u1EA1t c\u1EA5p t\u1ED1i \u0111a th\xEC m\u1EDF v\u0169 kh\xED b\u1EADc 2 c\u1EE7a v\u0169 kh\xED \u0111\xF3 (finalTier): s\xE1t th\u01B0\u01A1ng g\u1ED1c c\u1EE7a v\u0169 kh\xED nh\xE2n rules.tierMult trong weapons.json, cho m\u1ECDi ng\u01B0\u1EDDi c\u1EA7m v\u0169 kh\xED \u0111\xF3. Kinh t\u1EBF (ngh\u1EC1): Ch\u1EA1y, L\xE0m vi\u1EC7c, S\u1EE9c, Tr\xED tu\u1EC7. Ph\xE1t tri\u1EC3n (th\u1EE3 x\xE2y, th\u1EE3 ch\u1EBF t\u1EA1o, nh\xE0 nghi\xEAn c\u1EE9u): L\xE0m vi\u1EC7c, S\u1EE9c, Tr\xED tu\u1EC7 (Tr\xED tu\u1EC7 \u1EDF cu\u1ED1i v\xEC n\xF3 c\u0169ng t\u0103ng t\u1ED1c \u0111\u1ED9 l\xE0m vi\u1EC7c v\xE0 gi\u1EA3m s\u1EE9c ti\xEAu hao khi l\xE0m vi\u1EC7c). finalTier: \xF4 cu\u1ED1i c\u1ED9t, m\u1EDF b\u1EADc 2 khi m\u1ECDi ch\u1EC9 s\u1ED1 c\u1EE7a vai tr\xF2 \u0111\u1EA1t c\u1EA5p t\u1ED1i \u0111a; c\xF3 \u1EDF Qu\xE2n s\u1EF1, Kinh t\u1EBF, Ph\xE1t tri\u1EC3n v\xE0 V\u0169 kh\xED. B\u1EADc 2 nh\xE2n m\u1ECDi ch\u1EC9 s\u1ED1 c\u1EE7a c\u1EA3 vai tr\xF2 theo tierMult trong stats.json.",
    military: {
      roles: [
        "foot",
        "cavalry",
        "archer",
        "scout"
      ],
      order: [
        "hp",
        "defm",
        "defr",
        "move",
        "atk",
        "sta",
        "hpregen",
        "restregen"
      ],
      finalTier: {
        tier: 2,
        roles: [
          "foot",
          "cavalry",
          "archer",
          "scout"
        ],
        needLab: 3,
        cost: {
          food: 200,
          wood: 120,
          coin: 20
        },
        time: 1200
      }
    },
    weapon: {
      roles: [
        "club",
        "spear",
        "mace",
        "sling",
        "bow"
      ],
      order: [
        "aspd",
        "crit",
        "critd"
      ],
      finalTier: {
        tier: 2,
        roles: [
          "club",
          "spear",
          "mace",
          "sling",
          "bow"
        ],
        needLab: 3,
        cost: {
          wood: 100,
          stone: 60,
          coin: 15
        },
        time: 900
      }
    },
    formation: {
      roles: [
        "basic",
        "wedge",
        "horns",
        "scatter",
        "ambush"
      ],
      order: [
        "hp",
        "defm",
        "defr",
        "move",
        "atk",
        "sta"
      ],
      scale: 0.5,
      gates: {
        move: "form_cells_10"
      },
      layout: [
        {
          stats: [
            "hp",
            "defm",
            "defr"
          ]
        },
        {
          techs: [
            "form_cells_10",
            "form_squads_5"
          ]
        },
        {
          stats: [
            "move",
            "atk",
            "sta"
          ]
        },
        {
          techs: [
            "form_cells_15",
            "form_squads_6"
          ]
        }
      ]
    },
    tool: {
      roles: [
        "axe",
        "pick",
        "hoe"
      ],
      order: [
        "tspd",
        "tyield",
        "tdur"
      ]
    },
    hammer: {
      roles: [
        "hammer"
      ],
      order: [
        "tspd",
        "tdur"
      ]
    },
    economy: {
      roles: [
        "wood",
        "stone",
        "food",
        "hunt",
        "tame"
      ],
      order: [
        "move",
        "work",
        "sta",
        "int",
        "restregen"
      ],
      finalTier: {
        tier: 2,
        roles: [
          "wood",
          "stone",
          "food",
          "hunt",
          "tame"
        ],
        needLab: 3,
        cost: {
          food: 150,
          wood: 100,
          stone: 40,
          coin: 15
        },
        time: 1e3
      }
    },
    gather: {
      roles: [
        "wood",
        "stone",
        "food",
        "hunt"
      ],
      order: [
        "gyield"
      ]
    },
    development: {
      roles: [
        "build",
        "craft",
        "research"
      ],
      order: [
        "work",
        "sta",
        "int"
      ],
      finalTier: {
        tier: 2,
        roles: [
          "build",
          "craft",
          "research"
        ],
        needLab: 3,
        cost: {
          wood: 100,
          stone: 60,
          coin: 20
        },
        time: 1e3
      }
    },
    defense: {
      roles: [
        "guard",
        "towerman"
      ],
      order: [
        "hp",
        "atk"
      ]
    },
    works1: {
      roles: [
        "fence",
        "gate"
      ],
      order: [
        "hp"
      ]
    },
    works2: {
      roles: [
        "trap",
        "tower"
      ],
      order: [
        "hp",
        "atk"
      ]
    },
    march: {
      roles: [
        "march_foot",
        "march_cavalry",
        "march_archer"
      ],
      order: [
        "hp",
        "defm",
        "defr",
        "move",
        "atk",
        "sta"
      ],
      scale: 0.5
    },
    marchlog: {
      roles: [
        "march_army"
      ],
      order: [
        "mspeed",
        "mload",
        "mbuild"
      ]
    },
    tactic: {
      roles: [
        "plan_foot",
        "plan_cavalry",
        "plan_archer"
      ],
      order: [
        "hp",
        "defm",
        "defr",
        "move",
        "atk",
        "sta"
      ],
      scale: 0.5
    }
  },
  plan: {
    _note: "C\xE2y K\u1EBF ho\u1EA1ch chi\u1EBFn \u0111\u1EA5u: ba c\u1ED9t B\u1ED9 binh, K\u1EF5, Cung, ch\u1EC9 s\u1ED1 ri\xEAng (chain tactic) ch\u1EC9 c\u1ED9ng khi \u0111ang chi\u1EBFn tranh v\xE0 \u0111ang giao chi\u1EBFn. Nh\xF3m ch\u1EC9 s\u1ED1 \u0111\u1EA7u \u0111\u1EE7 c\u1EA5p 3 m\u1EDF plan_report, c\u1EA5p 5 m\u1EDF plan_supply; nh\xF3m sau c\u1EA5p 3 m\u1EDF plan_weather, c\u1EA5p 5 m\u1EDF plan_rest (xem research.json). Chu\u1ED7i march (tab H\xE0nh qu\xE2n) ch\u1EC9 c\u1ED9ng khi chi\u1EBFn tranh v\xE0 \u0111ang h\xE0nh qu\xE2n ho\u1EB7c ngh\u1EC9.",
    roles: [
      "plan_foot",
      "plan_cavalry",
      "plan_archer"
    ],
    layout: [
      {
        stats: [
          "hp",
          "defm",
          "defr"
        ]
      },
      {
        techs: [
          "plan_report",
          "plan_supply"
        ]
      },
      {
        stats: [
          "move",
          "atk",
          "sta"
        ]
      },
      {
        techs: [
          "plan_weather",
          "plan_rest"
        ]
      }
    ]
  }
};

// src/sim/research.ts
var RESEARCH = { enabled: research_default.enabled };
var RECIPE_LEVEL = research_default.recipeLevel;
var CRAFT_COST_PER_LEVEL = research_default.craftCostPerLevel ?? 0.5;
var recipeNeedLevel = (id) => RECIPE_LEVEL[id] ?? 1;
var TECHS = research_default.techs;
for (const t of TECHS) {
  t.needLevel = labLevelOf(t.id);
  t.cost = scaleBill(t.cost);
}
var TECH_BY_ID = Object.fromEntries(TECHS.map((t) => [t.id, t]));
var STAT_IDS = Object.keys(researchtree_default.stats);
var STAT_DEF = researchtree_default.stats;
var TREE_ROLES = researchtree_default.roles;
var statLevels = (stat) => STAT_DEF[stat].steps.length;
var labNeeded = (stat, n) => {
  const t = STAT_DEF[stat].tiers ?? researchtree_default.tiers;
  return t[Math.min(n, t.length) - 1];
};
var statBonusAtLab = (stat, lab) => STAT_DEF[stat].steps.reduce((a, s, i) => a + (labNeeded(stat, i + 1) <= lab ? s : 0), 0);
var TREE_TABS = researchtree_default.tabs;
var CHAINS = Object.fromEntries(Object.entries(researchtree_default.chains).filter(([, c]) => typeof c !== "string"));
var ROLE_SCALE = {};
for (const c of Object.values(CHAINS)) if (c.scale !== void 0) for (const r of c.roles) ROLE_SCALE[r] = c.scale;
var statTechId = (role, stat, n) => `${role}_${stat}_${n}`;
var STAT_TECHS = [];
for (const def of Object.values(CHAINS)) for (const role of def.roles) for (const stat of def.order) {
  const s = STAT_DEF[stat], chain = def.order, at = chain.indexOf(stat);
  for (let n = 1; n <= statLevels(stat); n++) {
    const cost = {};
    for (const [res, amount] of Object.entries(s.cost)) cost[res] = Math.max(1, Math.round(amount * researchtree_default.growth.cost ** (n - 1)));
    cost.coin = (cost.coin ?? 0) + Math.floor(n / 2);
    Object.assign(cost, scaleBill(cost));
    const t = {
      id: statTechId(role, stat, n),
      name: `${s.name} \xB7 ${TREE_ROLES[role].name} ${n}`,
      desc: `${s.about} C\u1ED9ng ${s.steps[n - 1] * (ROLE_SCALE[role] ?? 1)}% cho ${TREE_ROLES[role].formation ? "l\xEDnh \u0111\u1EE9ng trong tr\u1EADn " : ""}${TREE_ROLES[role].name.toLowerCase()}.`,
      requires: [...n > 1 ? [statTechId(role, stat, n - 1)] : at === 0 && TREE_ROLES[role].needs ? [TREE_ROLES[role].needs] : [], ...n === 1 && def.gates?.[stat] ? [def.gates[stat]] : [], ...chain && at > 0 ? [statTechId(role, chain[at - 1], Math.min(n, statLevels(chain[at - 1])))] : [], ...chain && at === 0 && n > 1 ? [statTechId(role, chain[chain.length - 1], Math.min(n - 1, statLevels(chain[chain.length - 1])))] : []],
      needLevel: labNeeded(stat, n),
      cost,
      time: Math.round(s.time * researchtree_default.growth.time ** (n - 1)),
      unlocks: { bonus: { role, stat, pct: s.steps[n - 1] * (ROLE_SCALE[role] ?? 1) } }
    };
    STAT_TECHS.push(t);
    TECH_BY_ID[t.id] = t;
  }
}
var tierTechId = (role, tier) => `${role}_tier${tier}`;
var TIER_TECH_OF = {};
for (const c of Object.values(CHAINS)) {
  if (!c.finalTier) continue;
  const ft = c.finalTier;
  for (const role of ft.roles) {
    const t = {
      id: tierTechId(role, ft.tier),
      name: `${TREE_ROLES[role].name} b\u1EADc ${ft.tier}`,
      desc: TREE_ROLES[role].weapon ? `M\u1EDF ${TREE_ROLES[role].name.toLowerCase()} b\u1EADc ${ft.tier}: m\u1ECDi ng\u01B0\u1EDDi c\u1EA7m n\xF3 g\xE2y s\xE1t th\u01B0\u01A1ng nhi\u1EC1u h\u01A1n. C\u1EA7n nghi\xEAn c\u1EE9u \u0111\u1EE7 m\u1ECDi ch\u1EC9 s\u1ED1 c\u1EE7a v\u0169 kh\xED n\xE0y.` : `M\u1EDF b\u1EADc ${ft.tier} c\u1EE7a ${TREE_ROLES[role].name.toLowerCase()}: m\u1ECDi ng\u01B0\u1EDDi l\xE0m vai tr\xF2 n\xE0y m\u1EA1nh h\u01A1n ngay. C\u1EA7n nghi\xEAn c\u1EE9u \u0111\u1EE7 m\u1ECDi ch\u1EC9 s\u1ED1 c\u1EE7a h\u1ECD.`,
      requires: c.order.map((stat) => statTechId(role, stat, statLevels(stat))),
      needLevel: ft.needLab,
      cost: ft.cost,
      time: ft.time,
      unlocks: { tier: { role, tier: ft.tier } }
    };
    STAT_TECHS.push(t);
    TECH_BY_ID[t.id] = t;
    TIER_TECH_OF[role] = t;
  }
}
var soldierTier = (done, role) => {
  let n = 1;
  for (let k = 2; k <= 6; k++) if (done.has(tierTechId(role, k))) n = k;
  return n;
};
function lineLevel(done, role, stat) {
  let n = 0;
  while (n < statLevels(stat) && done.has(statTechId(role, stat, n + 1))) n++;
  return n;
}
var PLAN_TREE = researchtree_default.plan;
var PLAN_TECH = { detail: "plan_report", supply: "plan_supply", weather: "plan_weather", rest: "plan_rest" };
var planOpen = (done, f, advanced, free = false) => advanced && (free || !RESEARCH.enabled || done.has(PLAN_TECH[f]));
var statBonus = (done, role, stat) => STAT_DEF[stat].steps.slice(0, lineLevel(done, role, stat)).reduce((a, b) => a + b, 0) * (ROLE_SCALE[role] ?? 1);
var NO_BLUEPRINT = /^(club|spear|mace|sling|bow|hide|bone|axe|pick|hoe|hammer|torch)\d$/;
var recipeOpen = (done, recipeId) => !RESEARCH.enabled || NO_BLUEPRINT.test(recipeId) || done.has(recipeId);
var techForRecipe = (recipeId) => TECH_BY_ID[recipeId] ?? TECHS.find((t) => t.unlocks.recipes?.includes(recipeId));
var unlockedMax = (done, key, base) => TECHS.reduce((m, t) => done.has(t.id) ? Math.max(m, t.unlocks[key] ?? 0) : m, base);
var techForBuilding = (kind) => TECHS.find((t) => t.unlocks.buildings?.includes(kind));
var buildingOpen = (done, kind) => {
  const t = techForBuilding(kind);
  return !RESEARCH.enabled || !t || done.has(t.id);
};

// src/sim/statsys.ts
var BASE = stats_default.base;
var IDS = Object.keys(stats_default.base);
var TIER_MULT = stats_default.tierMult;
var L = stats_default.legacy;
function rollFactors(r) {
  const w = stats_default.stars.weights, total = w.reduce((a, b) => a + b, 0);
  let x = r() * total, stars = 1;
  for (let i = 0; i < w.length; i++) {
    x -= w[i];
    if (x <= 0) {
      stars = i + 1;
      break;
    }
    stars = i + 1;
  }
  const budget = IDS.length * (stats_default.stars.budgetBase + stats_default.stars.budgetPerStar * stars), { min, max } = stats_default.stars;
  let f = IDS.map(() => 1 - stats_default.stars.spread / 2 + r() * stats_default.stars.spread);
  for (let k = 0; k < 8; k++) {
    const s = f.reduce((a, b) => a + b, 0);
    f = f.map((v) => Math.max(min, Math.min(max, v * budget / s)));
  }
  return { stars, fac: Object.fromEntries(IDS.map((id, i) => [id, f[i]])) };
}
function treeRole(v) {
  const r = roleOf(v);
  if (r) return r === "tower" ? "towerman" : r;
  switch (v.job) {
    case "build":
      return "build";
    case "craft":
      return "craft";
    case "research":
      return "research";
    case "tame":
      return "tame";
    case "food":
      return "farm";
    default:
      return null;
  }
}
function statValue(sim2, v, stat) {
  const role = v.team === "player" ? treeRole(v) : null;
  const tier = role && TREE_ROLES[role] ? soldierTier(sim2.researched, role) : 1;
  const mult = tier > 1 ? TIER_MULT[String(tier)]?.[stat] ?? 1 : 1;
  const squad = v.team === "player" && v.squad >= 0 ? sim2.squads.find((q) => q.id === v.squad) : void 0;
  const bonus = (v.team !== "player" ? sim2.foeBonus?.(v.team, stat) ?? 0 : 0) + (role ? statBonus(sim2.researched, role, stat) : 0) + (squad ? statBonus(sim2.researched, FORMATIONS[squad.formation].tech.replace(/^form_/, ""), stat) : 0);
  const mode = role === "foot" || role === "cavalry" || role === "archer" ? sim2.warMode?.(v) ?? null : null;
  const warBonus = mode ? statBonus(sim2.researched, `${mode === "fight" ? "plan" : "march"}_${role}`, stat) : 0;
  const hunger = v.team === "player" && stat !== "hp" ? (1 - sim2.foodPenalty) * (1 - sim2.tiredPenalty(v)) : 1;
  return BASE[stat] * (v.fac?.[stat] ?? 1) * mult * (1 + (bonus + warBonus) / 100) * hunger;
}
var rawValue = (fac, stat) => BASE[stat] * fac[stat];
function legacyStats(value) {
  return {
    vit: (value("hp") - L.hpBase) / L.hpPerVit,
    str: value("atk") * L.atkToDamage / L.strengthDamage,
    agi: (value("move") - L.speedBase) / L.speedPerAgi,
    sta: value("sta") * L.staScale
  };
}
function applyStats(sim2, v) {
  if (v.team === "wild") return;
  const val = (s) => statValue(sim2, v, s), l = legacyStats(val);
  v.stats.vit = l.vit;
  v.stats.str = l.str;
  v.stats.agi = l.agi;
  v.stats.sta = l.sta;
  const hp = Math.round(val("hp"));
  if (hp !== v.maxHealth) {
    const ratio2 = v.maxHealth > 0 ? v.health / v.maxHealth : 1;
    v.maxHealth = hp;
    v.health = Math.min(hp, hp * ratio2);
  }
  if (v.team === "player" && v.squad < 0 && !v.mount) v.speed = val("move");
}
function guardCut(sim2, v, ranged) {
  const d = statValue(sim2, v, ranged ? "defr" : "defm");
  return d / (d + stats_default.defense.k);
}
function workSpeed(sim2, v) {
  return statValue(sim2, v, "work") * (1 + stats_default.intEffect.work * (statValue(sim2, v, "int") / BASE.int - 1));
}
function drainScale(sim2, v) {
  const reserve = Math.max(0.3, statValue(sim2, v, "sta") / stats_default.staDrainRef), spare = Math.max(0.4, 1 + stats_default.intEffect.drain * (statValue(sim2, v, "int") / BASE.int - 1));
  return 1 / (reserve * spare);
}
function weaponDamage(sim2, v, w) {
  if (v.team !== "player") return w.damage;
  const tier = soldierTier(sim2.researched, w.id);
  return tier > 1 ? w.damage * (RULES.tierMult[String(tier)]?.damage ?? 1) : w.damage;
}
var villageBonus = (sim2) => sim2.conquered * difficulty_default.capture.yieldPerVillage;
function strokeYield(sim2, v, job, base) {
  const trade = v.team === "player" ? statBonus(sim2.researched, job, "gyield") + villageBonus(sim2) : 0;
  return base * (1 + (toolBonus(sim2, v, job, "tyield") + trade) / 100);
}
function toolBonus(sim2, v, job, stat) {
  const kind = TOOL_OF_JOB[job], tool = kind ? v.tools[kind] : null;
  return v.team === "player" && kind && tool && tool.dur > 0 ? statBonus(sim2.researched, kind, stat) : 0;
}
var weaponBonus = (sim2, v, w, stat) => v.team === "player" ? statBonus(sim2.researched, w.id, stat) : 0;
var swingCycle = (sim2, v, w) => {
  const p = v.team === "player" ? sim2.foodPenalty : 0;
  const agi = p > 0 ? ((L.speedBase + L.speedPerAgi * v.stats.agi) / (1 - p) - L.speedBase) / L.speedPerAgi : v.stats.agi;
  return cycleOf(w.cycle, agi) / (1 + weaponBonus(sim2, v, w, "aspd") / 100) / (1 - p);
};
var critChance = (sim2, v, w) => Math.min((w.crit ?? 0) + weaponBonus(sim2, v, w, "crit") / 100, RULES.critMax);
var critMult = (sim2, v, w) => (w.critDamage ?? RULES.critDamage) + weaponBonus(sim2, v, w, "critd") / 100;

// src/sim/battle.ts
var ANIM = anims_default;
var CHASE = chase_default;
function swingTimes(anim) {
  const a = ANIM[anim];
  return { hitAt: (a?.hit ?? 2) / (a?.fps ?? 10), end: (a?.frames.length ?? 6) / (a?.fps ?? 10) };
}
var entX = (e) => e.kind === "unit" ? e.v.x : e.a.x;
var entY = (e) => e.kind === "unit" ? e.v.y : e.a.y;
function resolve(sim2, t) {
  if (!t) return null;
  if (t.kind === "unit") {
    const v = sim2.get(t.id);
    return v && v.health > 0 && v.down <= 0 ? { kind: "unit", v } : null;
  }
  const a = sim2.animalById.get(t.id);
  return a && a.state !== "dead" ? { kind: "animal", a } : null;
}
var effWeapon = (v) => v.team === "player" && v.gear.wb && v.gear.w === v.weapon ? null : v.weapon;
var armOf = (v) => v.team === "player" && v.job === "fight" && (v.arm === "cavalry" || v.mount) || v.team !== "player" && v.mount ? "cavalry" : armOfWeapon(effWeapon(v));
var weaponOf = (v) => WEAPONS[effWeapon(v) ?? "fist"] ?? WEAPONS.fist;
var armorOf = (v) => v.armor && !(v.team === "player" && v.gear.ab && v.gear.a === v.armor) ? ARMORS[v.armor] ?? null : null;
function canSee(sim2, v, x, y) {
  return v.team !== "player" || sim2.fog.state[Math.floor(y) * sim2.world.size + Math.floor(x)] === 2;
}
var isFighter = (v) => v.job === "fight" || v.job === "hunt" || v.job === "supply" || v.fight.mode !== "none";
function teamsHostile(sim2, a, b) {
  if (a === b || a === "wild" || b === "wild") return false;
  if (a === "player") return sim2.tribeWilling(b);
  if (b === "player") return sim2.tribeWilling(a);
  return sim2.tribesFeud(a, b);
}
var CELL = 8;
function sideGrid(sim2, side) {
  let c = sim2.threatCache;
  if (!c || c.time !== sim2.time) c = sim2.threatCache = { time: sim2.time, foes: null, mine: null };
  if (!c[side]) {
    const g = /* @__PURE__ */ new Map();
    for (const o of side === "foes" ? sim2.foes : sim2.villagers) {
      if (o.health <= 0) continue;
      const k = Math.floor(o.y / CELL) * 1024 + Math.floor(o.x / CELL), cell = g.get(k);
      if (cell) cell.push(o);
      else g.set(k, [o]);
    }
    c[side] = g;
  }
  return c[side];
}
function nearbyOthers(sim2, v, radius) {
  const g = sideGrid(sim2, v.team === "player" ? "foes" : "mine"), r = Math.ceil((radius + 1) / CELL), cx = Math.floor(v.x / CELL), cy = Math.floor(v.y / CELL), out = [];
  for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
    const cell = g.get(j * 1024 + i);
    if (cell) for (const o of cell) out.push(o);
  }
  if (v.team !== "player" && v.team !== "wild" && isActive(sim2, v.x, v.y)) {
    const f = sideGrid(sim2, "foes");
    for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
      const cell = f.get(j * 1024 + i);
      if (cell) {
        for (const o of cell) if (o.team !== v.team && isActive(sim2, o.x, o.y)) out.push(o);
      }
    }
  }
  return out;
}
function threatsOf(sim2, v, radius) {
  const out = [], N = sim2.world.size, player = v.team === "player";
  const sk = v.fight.skip && sim2.time < v.fight.skip.until ? v.fight.skip : null;
  const seen = (x, y) => !player || sim2.fog.state[Math.floor(y) * N + Math.floor(x)] === 2;
  for (const o of nearbyOthers(sim2, v, radius)) {
    if (o.health <= 0 || o.down > 0 || o.inside !== null || o.inTent || !teamsHostile(sim2, v.team, o.team) || sk && sk.kind === "unit" && sk.id === o.id) continue;
    const d = Math.hypot(o.x - v.x, o.y - v.y);
    if (d <= radius && seen(o.x, o.y)) out.push({ t: { kind: "unit", id: o.id }, x: o.x, y: o.y, d, name: o.name });
  }
  if (player) for (const a of sim2.animals) {
    if (a.state === "dead" || sk && sk.kind === "animal" && sk.id === a.id) continue;
    const def = animalDef(a);
    if (!(a.state === "attack" || def.aggro > 0)) continue;
    const d = Math.hypot(a.x - v.x, a.y - v.y);
    if (d <= radius && seen(a.x, a.y)) out.push({ t: { kind: "animal", id: a.id }, x: a.x, y: a.y, d, name: def.name });
  }
  return out.sort((p, q) => p.d - q.d);
}
var HUNT_FLEE = 0.3;
var HUNT_BACK = 0.5;
function noteClash(sim2, a, b, x, y) {
  if (sim2.fog.state[Math.floor(y) * sim2.world.size + Math.floor(x)] !== 2) return;
  const c = sim2.clashes.find((o) => o.a === a && o.b === b || o.a === b && o.b === a);
  if (c) {
    c.at = sim2.time;
    c.x = x;
    c.y = y;
  } else sim2.clashes.push({ a, b, at: sim2.time, x, y });
}
function hurt(sim2, target, dmg, type, from, src) {
  if (target.kind === "animal") {
    const a = sim2.animalById.get(target.id);
    if (!a || a.state === "dead") return;
    a.hp -= dmg;
    if (a.hp <= 0) {
      die(sim2, a);
      sim2.onKill?.();
      if (src.unit?.team === "player" && a.species === "wolf") sim2.say("M\u1ED9t con s\xF3i \u0111\xE3 b\u1ECB h\u1EA1.");
    } else if (src.unit) provoke(sim2, a, src.unit.id);
    return;
  }
  const v = sim2.get(target.id);
  if (!v || v.health <= 0) return;
  if (sim2.dev.god && v.team === "player") return;
  const missile = !!src.unit && weaponOf(src.unit).ranged === true;
  const armor = armorOf(v), final = dmg * (1 - (armor ? armor[type] : 0)) * (1 - guardCut(sim2, v, missile)) * (v.team === "player" ? sim2.takenFactor(v, missile) : 1) * sim2.mountGuard(v);
  v.health -= final;
  v.calm = 0;
  v.flinch = 0.3;
  if (src.unit && src.unit.team !== v.team && src.unit.team !== "player" && v.team !== "player" && src.unit.team !== "wild" && v.team !== "wild") noteClash(sim2, src.unit.team, v.team, v.x, v.y);
  if (armor) sim2.wearGear(v, "armor");
  if (src.unit && src.unit.team === "player" && v.team !== "player") sim2.tribeAttacked(v.team, v);
  if (v.health > 0 && v.team !== "player" && v.ai && v.ai.role !== "civ" && src.unit && src.unit.team === "player" && src.unit.inside !== null) {
    const tw = sim2.getBuilding(src.unit.inside);
    if (tw && tw.kind === "tower") {
      v.ai.siege = tw.id;
      v.fight.target = null;
    }
  }
  if (v.health > 0) {
    if (v.team === "player" && v.job === "hunt" && v.phase !== "flee" && v.health < v.maxHealth * HUNT_FLEE && !sim2.underOrders(v)) {
      const tribe = src.unit ? sim2.tribes.find((t) => t.id === src.unit.team) : void 0;
      const by = src.animal ? `m\u1ED9t con ${animalDef(src.animal).name.toLowerCase()}` : tribe ? tribe.def.name : src.unit ? "m\u1ED9t k\u1EBB \u0111\u1ECBch" : "k\u1EBB l\u1EA1";
      sim2.say(`${v.name} (th\u1EE3 s\u0103n) b\u1ECF ch\u1EA1y v\u1EC1 l\xE0ng v\xEC m\xE1u c\xF2n ${Math.round(v.health / v.maxHealth * 100)}%, b\u1ECB ${by} t\u1EA5n c\xF4ng.`);
      sim2.startFlee(v, 8, from);
      return;
    }
    if (!v.fight.target && src.unit && v.team !== "player") v.fight.target = { kind: "unit", id: src.unit.id };
    else if (!v.fight.target && src.animal && v.team !== "player") v.fight.target = { kind: "animal", id: src.animal.id };
    return;
  }
  if (v.team === "player") fallUnit(sim2, v);
  else sim2.killFoe(v, src.unit);
}
function fallUnit(sim2, v) {
  sim2.resetTask(v);
  v.queue.length = 0;
  v.swing = null;
  sim2.noteBattle("ours");
  sim2.killUnit(v, "t\u1EED tr\u1EADn");
}
function startSwing(sim2, v, target) {
  const w = weaponOf(v), { hitAt, end } = swingTimes(w.anim);
  v.swing = { t: 0, hitAt, end, target };
  v.atkCd = swingCycle(sim2, v, w);
  v.anim = w.anim;
  v.animClock = 0;
  const e = resolve(sim2, target);
  if (e) v.facing = entX(e) >= v.x ? "right" : "left";
}
function critRoll(sim2, v, w) {
  const c = critChance(sim2, v, w);
  return c > 0 && sim2.frnd() < c ? critMult(sim2, v, w) : 1;
}
function armMultiplier(attacker, e) {
  return e.kind === "unit" ? matchup(armOf(attacker), armOf(e.v), effWeapon(attacker)) : 1;
}
function fireProjectile(sim2, v, e, from, mult, rangeBonus) {
  const w = weaponOf(v), tx = entX(e), ty = entY(e), d = Math.hypot(tx - from.x, ty - from.y);
  if (d > w.range + rangeBonus + 1 || !canSee(sim2, v, tx, ty)) return false;
  const shot = (weaponDamage(sim2, v, w) + RULES.strengthDamage * v.stats.str) * critRoll(sim2, v, w) * clampTactical(armMultiplier(v, e) * mult * sim2.attackFactor(v, e)) * WEATHER[sim2.weather].bow * (d <= UNIT_RULES.archerPressed.within ? UNIT_RULES.archerPressed.damage : 1);
  if (v.inside !== null) sim2.noteBattle("shot");
  const target = e.kind === "unit" ? { kind: "unit", id: e.v.id } : { kind: "animal", id: e.a.id };
  sim2.projectiles.push({ x: from.x, y: from.y - 0.4, tx, ty, speed: 14, dmg: shot, type: w.type, from, src: v.id, team: v.team, target, chance: d <= (w.range + rangeBonus) / 2 ? RULES.rangedHitNear : RULES.rangedHitFar, kind: w.projectile ?? "stone" });
  sim2.wearGear(v, "weapon");
  return true;
}
function resolveSwing(sim2, v, target) {
  const e = resolve(sim2, target);
  if (!e) return;
  const w = weaponOf(v), d = Math.hypot(entX(e) - v.x, entY(e) - v.y), arm = armMultiplier(v, e);
  if (w.ranged) {
    fireProjectile(sim2, v, e, { x: v.x, y: v.y }, 1, 0);
    return;
  }
  if (d > w.range + 1.1) return;
  let behind = false;
  if (e.kind === "unit") behind = e.v.facing === "right" && v.x < e.v.x || e.v.facing === "left" && v.x > e.v.x;
  else behind = e.a.dir === 1 && v.x < e.a.x || e.a.dir === -1 && v.x > e.a.x;
  hurt(sim2, target, damageOf({ ...w, damage: weaponDamage(sim2, v, w) }, v.stats.str, null, behind) * critRoll(sim2, v, w) * clampTactical(arm * sim2.attackFactor(v, e)), w.type, { x: v.x, y: v.y }, { unit: v });
  if (v.weapon) sim2.wearGear(v, "weapon");
}
function tickProjectiles(sim2, dt) {
  for (let i = sim2.projectiles.length - 1; i >= 0; i--) {
    const p = sim2.projectiles[i], dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step2 = p.speed * dt;
    if (d > step2) {
      p.x += dx / d * step2;
      p.y += dy / d * step2;
      continue;
    }
    sim2.projectiles.splice(i, 1);
    const e = resolve(sim2, p.target);
    if (!e || Math.hypot(entX(e) - p.tx, entY(e) - p.ty) > 1.4 || sim2.frnd() > p.chance) continue;
    const src = sim2.get(p.src);
    hurt(sim2, p.target, p.dmg + (src ? RULES.strengthDamage * 0 : 0), p.type, p.from, { unit: src });
  }
}
function tickCommon(sim2, v, dt) {
  v.atkCd = Math.max(0, v.atkCd - dt);
  v.calm += dt;
  if (v.flinch > 0) v.flinch -= dt;
  if (v.swing) {
    const s = v.swing, before = s.t;
    s.t += dt;
    if (before < s.hitAt && s.t >= s.hitAt) resolveSwing(sim2, v, s.target);
    if (s.t >= s.end) v.swing = null;
  }
}
function tickDown(sim2, v, dt) {
  v.down -= dt;
  v.hold = null;
  v.path = [];
  v.slide = null;
  const helper = sim2.villagers.some((o) => o !== v && o.health > 0 && o.down <= 0 && o.phase !== "flee" && Math.hypot(o.x - v.x, o.y - v.y) < 1.6);
  v.rescue = helper ? v.rescue + dt : Math.max(0, v.rescue - dt);
  if (v.rescue >= RULES.rescueSeconds) {
    v.down = 0;
    v.rescue = 0;
    v.health = v.maxHealth * RULES.rescueHp;
    v.phase = "idle";
    sim2.say(`${v.name} \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u1EE1 d\u1EADy.`);
    return;
  }
  if (v.down <= 0) sim2.killUnit(v, "v\xEC v\u1EBFt th\u01B0\u01A1ng");
}
function chaseGivenUp(sim2, v, e, d, dt) {
  const f = v.fight, key = e.kind === "unit" ? `u${e.v.id}` : `a${e.a.id}`;
  if (f.chaseKey !== key) {
    f.chaseKey = key;
    f.chaseT = 0;
    f.unseenT = 0;
  }
  const sees = d <= chaseSight(sim2, v) && canSee(sim2, v, entX(e), entY(e));
  if (f.mode === "attack" || f.mode === "attackMove") {
    const weapon = weaponOf(v), blocked = !v.path.length && d > weapon.range + 1;
    f.chaseT = blocked ? (f.chaseT ?? 0) + dt : 0;
    f.unseenT = 0;
  } else {
    f.chaseT = (f.chaseT ?? 0) + dt;
    f.unseenT = sees ? 0 : (f.unseenT ?? 0) + dt;
  }
  if (f.unseenT <= CHASE.loseSightSeconds && f.chaseT <= CHASE.noHitSeconds) return false;
  f.skip = { kind: e.kind === "unit" ? "unit" : "animal", id: e.kind === "unit" ? e.v.id : e.a.id, until: sim2.time + CHASE.skipSeconds };
  if (v.ai && e.kind === "unit") v.ai.skip = { id: e.v.id, until: sim2.time + CHASE.skipSeconds };
  f.target = null;
  f.chaseKey = void 0;
  f.chaseT = 0;
  f.unseenT = 0;
  v.path = [];
  v.slide = null;
  if (v.phase === "fight") v.phase = "idle";
  if (f.mode === "attack") sim2.endOrder(v);
  return true;
}
function engage(sim2, v, e, dt) {
  const w = weaponOf(v), x = entX(e), y = entY(e), d = Math.hypot(x - v.x, y - v.y);
  if (dt > 0 && chaseGivenUp(sim2, v, e, d, dt)) return;
  const reach = w.ranged ? w.range : w.range + (e.kind === "animal" ? 0.45 : 0.5);
  v.phase = "fight";
  if (d <= reach && (!w.ranged || canSee(sim2, v, x, y))) {
    v.path = [];
    v.slide = null;
    v.facing = x >= v.x ? "right" : "left";
    if (!v.swing && v.atkCd <= 0) {
      startSwing(sim2, v, e.kind === "unit" ? { kind: "unit", id: e.v.id } : { kind: "animal", id: e.a.id });
      v.fight.chaseT = 0;
    }
    return;
  }
  if (v.swing) return;
  v.fight.repath -= dt;
  if ((v.fight.repath <= 0 || !v.path.length) && sim2.pathLeft > 0) {
    sim2.pathLeft--;
    v.fight.repath = 0.5;
    v.path = sim2.pathTo(v, Math.floor(x), Math.floor(y), 3500);
    if (v.path.length) v.fight.blockedT = 0;
    else {
      v.fight.repath = 1.5;
      v.fight.blockedT = (v.fight.blockedT ?? 0) + 1.5;
      if (v.team === "player" && e.kind === "unit" && sim2.breachFor(v, x, y)) return;
    }
  }
}

// src/sim/difficulty.ts
var DIFF = difficulty_default;
var TIER_MULT2 = stats_default.tierMult;
var clampLevel = (level) => Math.max(1, Math.min(POP_BY_FIRE.length, Math.round(level)));
function popCapAt(level) {
  const L2 = clampLevel(level), house = BUILDINGS.house, lv = house.levels.stone;
  return POP_BY_FIRE[L2 - 1] + (house.perFire?.[L2 - 1] ?? 0) * lv[Math.min(L2, lv.length) - 1].slots;
}
var tierAt = (lab, chain) => {
  const t = CHAINS[chain]?.finalTier;
  return t && t.needLab <= lab ? t.tier : 1;
};
function statRatio(stat, lab, chain) {
  const tier = tierAt(lab, chain);
  return (1 + statBonusAtLab(stat, lab) / 100) * (tier > 1 ? TIER_MULT2[String(tier)]?.[stat] ?? 1 : 1);
}
function playerCap(level) {
  const L2 = clampLevel(level), pop = popCapAt(L2), soldiers = pop * difficulty_default.militaryShare, workers = pop - soldiers;
  const fighter = statRatio("hp", L2, "military") * statRatio("atk", L2, "military") * (statRatio("defm", L2, "military") + statRatio("defr", L2, "military")) / 2;
  const worker = statRatio("work", L2, "economy") * (1 + stats_default.intEffect.work * (statRatio("int", L2, "economy") - 1));
  const economy = workers * worker, military = soldiers * fighter;
  return { economy, military, total: difficulty_default.power.economy * economy + difficulty_default.power.military * military };
}
var TIERS = difficulty_default.tiers;
var tierLevel = (fire2, tier) => Math.max(1, Math.min(TIERS[tier].capLevel, Math.round(fire2) + TIERS[tier].edge));
function tierTarget(fire2, tier) {
  const t = TIERS[tier];
  if (tier === "boss" || tier === "rebel") {
    const cap2 = playerCap(clampLevel(fire2 + 1)), share3 = tier === "rebel" ? difficulty_default.capture.rebel.share : 1;
    return { military: cap2.military * difficulty_default.boss.power * share3, economy: cap2.economy * difficulty_default.boss.economy * share3 };
  }
  const cap = playerCap(tierLevel(fire2, tier)), strength = t.strength;
  return { military: cap.military * strength, economy: cap.economy * strength };
}
function raidPower(playerMilitary, ratio2, level) {
  const top = playerCap(level).military;
  return Math.max(difficulty_default.raid.floor * top, Math.min(difficulty_default.raid.ceiling * top, playerMilitary * ratio2));
}
function tribeBonuses(level, tier, soldiers, workers) {
  const t = tierTarget(level, tier), [lo, hi] = difficulty_default.bonusClamp, clamp2 = (x) => Math.max(lo, Math.min(hi, x));
  return { mil: soldiers > 0 ? clamp2(Math.cbrt(t.military / soldiers) - 1) : 0, eco: workers > 0 ? clamp2(t.economy / workers - 1) : 0 };
}
var baseWork = BASE.work;

// src/sim/power.ts
var ratio = (sim2, v, stat) => statValue(sim2, v, stat) / BASE[stat];
var militaryValue = (sim2, v) => ratio(sim2, v, "hp") * ratio(sim2, v, "atk") * (ratio(sim2, v, "defm") + ratio(sim2, v, "defr")) / 2;
var economyValue = (sim2, v) => workSpeed(sim2, v) / BASE.work;
var kindOf = (v) => {
  if (v.team === "player") return v.job === "fight" || v.job === "scout" || v.job === "supply" ? "army" : v.job === "idle" ? null : "work";
  const role = v.ai?.role;
  return role === "guard" || role === "raider" ? "army" : role === "civ" ? "work" : null;
};
function powerOf(sim2, people) {
  let economy = 0, military = 0, workers = 0, soldiers = 0;
  for (const v of people) {
    const k = kindOf(v);
    if (k === "army") {
      military += militaryValue(sim2, v);
      soldiers++;
    } else if (k === "work") {
      economy += economyValue(sim2, v);
      workers++;
    }
  }
  return { economy, military, total: difficulty_default.power.economy * economy + difficulty_default.power.military * military, workers, soldiers };
}

// src/sim/campplan.ts
var CORE = ["storage", "builder", "workshop", "armory", "infantry", "archery", "cavalry", "guardpost", "lab", "wartent", "stable", "house", "toolstore", "scouttent", "supplycamp"];
var OUTSIDE = ["lumberyard", "quarry", "farmhouse", "huntlodge", "drill"];
function ring(fire2, r) {
  const out = [];
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (Math.max(Math.abs(i), Math.abs(j)) !== r || i === 0 && j > 0) continue;
    out.push({ i, j, a: (Math.atan2(i, -j) + 2 * Math.PI) % (2 * Math.PI) });
  }
  return out.sort((p, q) => p.a - q.a).map((o) => [fire2.x + 3 * o.i, fire2.y + 3 * o.j]);
}
function limitAt(kind, fireLevel2) {
  const per = BUILDINGS[kind].perFire;
  return per ? per[Math.min(per.length, fireLevel2) - 1] ?? 0 : 1;
}
function slotsAt(kinds2, fireLevel2, era, advanced) {
  let n = 0;
  for (const k of kinds2) {
    if (!BUILDINGS[k].buildable || fireUnlockLevel(k) > fireLevel2 || eraLocked(k, { era: advanced ? "ancient" : "stone" })) continue;
    const lv = Math.max(1, Math.min(maxLevel(k, era), levelCapByFire(fireLevel2)));
    n += limitAt(k, fireLevel2) * (levelsOf(k, era)[lv - 1]?.slots ?? 0);
  }
  return n;
}
function fenceHalf(fireLevel2) {
  return fireUnlockLevel("fence") <= fireLevel2 ? Math.max(4, Math.min(10, Math.floor((limitAt("fence", fireLevel2) + 1) / 8))) : 0;
}
var hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function planCamp(fx, fy, fireLevel2, era, advanced, taken, blocked) {
  const fire2 = { x: fx, y: fy }, cx = fx + 1, cy = fy + 1, half = fenceHalf(fireLevel2), fenced = half > 0;
  const out = [], used = [{ x: fx, y: fy, w: 2, h: 2 }, ...taken];
  const open2 = (k) => BUILDINGS[k].buildable && fireUnlockLevel(k) <= fireLevel2 && !eraLocked(k, { era: advanced ? "ancient" : "stone" });
  const cap = levelCapByFire(fireLevel2);
  const put = (kind, x, y) => {
    const d = BUILDINGS[kind], r = { x, y, w: d.w, h: d.h };
    if (used.some((u) => hits(u, r)) || blocked(r)) return false;
    used.push(r);
    out.push({ kind, x, y, w: d.w, h: d.h, level: Math.max(1, Math.min(maxLevel(kind, era), cap)) });
    return true;
  };
  const spot2 = (kind, spots) => {
    for (let k = 0; k < spots.length; k++) if (put(kind, spots[k][0], spots[k][1])) {
      spots.splice(k, 1);
      return true;
    }
    return false;
  };
  if (fenced) {
    for (let d = -half; d <= half; d++) {
      put("fence", cx + d, cy - half);
      put(d === 0 ? "gate" : "fence", cx + d, cy + half);
      if (Math.abs(d) < half) {
        put("fence", cx - half, cy + d);
        put("fence", cx + half, cy + d);
      }
    }
    if (!eraLocked("tower", { era: advanced ? "ancient" : "stone" })) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) put("tower", sx > 0 ? cx + half + 1 : cx - half - 2, sy > 0 ? cy + half + 1 : cy - half - 2);
  } else if (open2("tower")) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]].slice(0, limitAt("tower", fireLevel2))) put("tower", cx + sx * 8 - (sx < 0 ? 2 : 0), cy + sy * 8 - (sy < 0 ? 2 : 0));
  }
  const coreRings = fenced ? Math.floor((half - 2) / 3) : 2, firstOutside = fenced ? Math.ceil((half + 2) / 3) : 3;
  const inside = [], outside = [];
  for (let r = 1; r <= coreRings; r++) inside.push(...ring(fire2, r));
  for (let r = firstOutside; r <= firstOutside + 3; r++) outside.push(...ring(fire2, r).sort((p, q) => Math.abs(p[1] - fy) - Math.abs(q[1] - fy)));
  for (const kind of CORE.filter(open2)) for (let n = limitAt(kind, fireLevel2); n > 0; n--) {
    if (!(spot2(kind, inside) || spot2(kind, outside))) break;
  }
  for (const kind of OUTSIDE.filter(open2)) for (let n = limitAt(kind, fireLevel2); n > 0; n--) {
    if (!spot2(kind, outside)) break;
  }
  return out;
}

// src/sim/tribebuild.ts
var planned = (p) => p.lv !== void 0;
var keyOf = (p) => `${p.b ?? p.kind}@${p.x},${p.y}`;
function hpOf(kind, _w, _h, lv, boss = false) {
  return Math.round((SIEGE.propHp[kind] ?? 60) * (1 + 0.5 * (lv - 1)) * (boss ? DIFF.boss.wallHp : 1));
}
var maxPropHp = (t, p) => hpOf(p.kind, p.w, p.h, p.lv ?? 1, !!t.boss);
function repairProps(t, share3) {
  for (const p of t.props) if (p.lv !== void 0) p.hp = Math.min(maxPropHp(t, p), p.hp + (share3 >= 1 ? Infinity : maxPropHp(t, p) * share3));
}
function clearPatch(sim2, x, y, w, h, margin) {
  const W = sim2.world, N = W.size;
  for (let j = -margin; j < h + margin; j++) for (let i = -margin; i < w + margin; i++) {
    if (x + i < 0 || y + j < 0 || x + i >= N || y + j >= N) continue;
    const k = (y + j) * N + x + i;
    if (W.nodes.delete(k)) {
      W.tiles[k] = Tile.Grass;
      W.decor[k] = 0;
    }
  }
}
function growCamp(sim2, t, level) {
  if (t.state === "destroyed" || level <= (t.built ?? 0)) return 0;
  const fire2 = t.props.find((p) => p.kind === "fire");
  if (!fire2) return 0;
  const W = sim2.world, N = W.size;
  W.ensure(fire2.x, fire2.y, 16);
  const base = t.props.filter((p) => !planned(p)), old = new Map(t.props.filter(planned).map((p) => [keyOf(p), p]));
  const blocked = (r) => {
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
      if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) return true;
      const tile = W.at(i, j);
      if (tile === Tile.Water || tile === Tile.Mountain) return true;
    }
    return false;
  };
  const next = [...base];
  for (const piece of planPieces(sim2, t, fire2, level, base, blocked)) {
    const kind = piece.kind === "fence" || piece.kind === "gate" || piece.kind === "tower" ? piece.kind : "house", b = kind === "house" ? piece.kind : void 0;
    const prop = { x: piece.x, y: piece.y, w: piece.w, h: piece.h, kind, b, lv: piece.level, hp: 0 };
    const was = old.get(keyOf(prop));
    if (was) {
      old.delete(keyOf(prop));
      const lost = hpOf(kind, prop.w, prop.h, was.lv, !!t.boss) - was.hp;
      was.lv = Math.max(was.lv, piece.level);
      was.hp = Math.max(1, hpOf(kind, prop.w, prop.h, was.lv, !!t.boss) - lost);
      next.push(was);
      continue;
    }
    prop.hp = hpOf(kind, prop.w, prop.h, prop.lv, !!t.boss);
    clearPatch(sim2, prop.x, prop.y, prop.w, prop.h, kind === "fence" || kind === "gate" ? 0 : 1);
    next.push(prop);
  }
  for (const p of old.values()) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) W.occ[(p.y + j) * N + p.x + i] = 0;
  for (const p of next) if (p.kind !== "gate" || p.open === false) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
    const k = (p.y + j) * N + p.x + i;
    W.occ[k] = 1;
    if (p.kind === "gate") W.foeGates.add(k);
  }
  t.props = next;
  t.built = level;
  return next.length - base.length;
}
function setGates(sim2, t, shut) {
  const N = sim2.world.size;
  for (const p of t.props) {
    if (p.kind !== "gate" || p.open !== false !== shut) continue;
    p.open = !shut;
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const k = (p.y + j) * N + p.x + i;
      sim2.world.occ[k] = shut ? 1 : 0;
      if (shut) sim2.world.foeGates.add(k);
      else sim2.world.foeGates.delete(k);
    }
  }
}
var planPieces = (sim2, t, fire2, level, base, blocked) => planCamp(fire2.x, fire2.y, level, sim2.era, sim2.era === "ancient" || !!t.boss, base, blocked);

// src/sim/tribelod.ts
var LOD = npclife_default.lod;
var CIVIL_HOUSES = ["lumberyard", "quarry", "farmhouse"];
var GUARD_HOUSES = ["guardpost", "huntlodge", "tower"];
var fireLevelOf = (sim2) => sim2.campfire()?.level ?? 1;
var crowdOf = (t) => t.crowd ??= { guards: 0, civs: 0 };
function headcount(sim2, t) {
  let guards = t.crowd?.guards ?? 0, civs = t.crowd?.civs ?? 0;
  for (const u of t.unitIds) {
    const f = sim2.get(u);
    if (!f || f.health <= 0) continue;
    if (f.ai?.role === "civ") civs++;
    else guards++;
  }
  return { guards, civs };
}
var targetsOf = (sim2, t) => {
  const total = Math.round(POP_BY_FIRE[Math.max(0, Math.min(POP_BY_FIRE.length, t.campLevel) - 1)] * (t.boss ? DIFF.boss.popMult : 1));
  const ratio2 = Math.round(total * t.def.warriors / (t.def.warriors + t.def.civilians)), posts = slotsAt(GUARD_HOUSES, t.campLevel, sim2.era, sim2.era === "ancient" || !!t.boss);
  return { total, fighters: Math.max(2, Math.min(Math.max(ratio2, posts), Math.floor(total * LOD.maxGuardShare))) };
};
function rescaleTribe(sim2, t) {
  const hc = headcount(sim2, t), b = tribeBonuses(fireLevelOf(sim2), t.tier, hc.guards, hc.civs);
  t.mil = b.mil;
  t.eco = b.eco;
  t.seenFire = fireLevelOf(sim2);
  for (const u of t.unitIds) {
    const f = sim2.get(u);
    if (f) applyStats(sim2, f);
  }
}
function tribePower(sim2, t) {
  const p = powerOf(sim2, t.unitIds.map((u) => sim2.get(u)).filter((u) => !!u));
  const g = t.crowd?.guards ?? 0, c = t.crowd?.civs ?? 0;
  if (g > 0 && p.soldiers > 0) {
    p.military += p.military / p.soldiers * g;
    p.soldiers += g;
  }
  if (c > 0 && p.workers > 0) {
    p.economy += p.economy / p.workers * c;
    p.workers += c;
  }
  p.total = difficulty_default.power.economy * p.economy + difficulty_default.power.military * p.military;
  return p;
}
function topUp(sim2, t) {
  const hc = headcount(sim2, t), { total, fighters } = targetsOf(sim2, t), crowd2 = crowdOf(t);
  crowd2.guards += Math.max(0, fighters - hc.guards);
  crowd2.civs += Math.max(0, total - fighters - hc.civs);
  t.popLevel = t.campLevel;
}
function recoverTribe(sim2, t, share3) {
  const hc = headcount(sim2, t), { total, fighters } = targetsOf(sim2, t), crowd2 = crowdOf(t);
  const lackG = Math.max(0, fighters - hc.guards), lackC = Math.max(0, total - fighters - hc.civs);
  crowd2.guards += Math.min(lackG, Math.ceil(fighters * share3));
  crowd2.civs += Math.min(lackC, Math.ceil((total - fighters) * share3));
}
function ensureLayout(sim2, t) {
  growCamp(sim2, t, t.campLevel);
  if (!t.seeded) {
    t.seeded = true;
    stockLand(sim2, t);
  }
}
function stockLand(sim2, t) {
  const { minR, maxR } = npclife_default.seed, W = sim2.world, N = W.size, cx = Math.floor(t.camp.x), cy = Math.floor(t.camp.y);
  W.ensure(cx, cy, maxR + 4);
  const have2 = { tree: 0, rock: 0, bush: 0 };
  for (let y = cy - maxR; y <= cy + maxR; y++) for (let x = cx - maxR; x <= cx + maxR; x++) {
    const n = W.inBounds(x, y) ? W.nodes.get(y * N + x) : void 0;
    if (n && Math.hypot(x - t.camp.x, y - t.camp.y) <= maxR) have2[n.kind]++;
  }
  for (const kind of ["rock", "tree", "bush"]) {
    for (let need = npclife_default.seed[kind] - have2[kind], tries = 0; need > 0 && tries < 200; tries++) {
      const a = sim2.frnd() * Math.PI * 2, r = minR + sim2.frnd() * (maxR - minR);
      if (W.plant(kind, Math.floor(t.camp.x + Math.cos(a) * r), Math.floor(t.camp.y + Math.sin(a) * r))) need--;
    }
  }
}
function visibleCap(sim2, t) {
  let guards = 0, civs = 0;
  for (const p of t.props) {
    if (p.kind === "tower") guards += towerSlots(sim2, p);
    if (!p.b) continue;
    const slots = levelsOf(p.b, sim2.era)[(p.lv ?? 1) - 1]?.slots ?? 0;
    if (CIVIL_HOUSES.includes(p.b)) civs += slots;
    else if (GUARD_HOUSES.includes(p.b)) guards += slots;
  }
  return { guards: Math.max(LOD.minGuards, guards), civs: Math.max(LOD.minCivs, civs) };
}
function freeSpot(sim2, near2, rmin, rspan) {
  for (let tries = 0; tries < 24; tries++) {
    const ang = sim2.frnd() * Math.PI * 2, r = rmin + sim2.frnd() * rspan, px = Math.floor(near2.x + Math.cos(ang) * r), py = Math.floor(near2.y + Math.sin(ang) * r);
    if (!sim2.world.isBlocked(px, py)) return [px, py];
  }
  return sim2.nearestFree(Math.floor(near2.x), Math.floor(near2.y), /* @__PURE__ */ new Set()) ?? [Math.floor(near2.x), Math.floor(near2.y)];
}
var towerSlots = (sim2, tw) => levelsOf("tower", sim2.era)[(tw.lv ?? 1) - 1]?.slots ?? 0;
function spawnTowerMen(sim2, t, tw, n) {
  const crowd2 = crowdOf(t), taken = /* @__PURE__ */ new Set(), cx = tw.x + tw.w / 2, cy = tw.y + tw.h / 2, dx = t.camp.x - cx, dy = t.camp.y - cy, len = Math.max(1, Math.hypot(dx, dy));
  const men = [];
  for (let i = 0; i < n && crowd2.guards > 0; i++) {
    const post = postAt(sim2, t, cx + dx / len * (2 + i * 0.8), cy + dy / len * (2 + i * 0.8), taken);
    if (!post) break;
    crowd2.guards--;
    const f = sim2.makeVillager(post.x, post.y, sim2.frnd() < 0.5 ? "m" : "f", t.id, sim2.frnd);
    f.look.hide = t.def.look.hide;
    f.look.pants = t.def.look.pants;
    f.weapon = "bow";
    f.armor = gearFor(sim2, t, t.unitIds.length + i).armor;
    f.facing = post.face;
    f.ai = { role: "guard", camp: t.camp, wander: 0, goal: null, raid: 0, post, tower: { x: tw.x, y: tw.y } };
    f.inTent = true;
    sim2.addFoe(f);
    t.unitIds.push(f.id);
    men.push(f);
  }
  if (men.length) {
    rescaleTribe(sim2, t);
    for (const f of men) f.health = f.maxHealth;
  }
  return men.length;
}
function postAt(sim2, t, x, y, taken) {
  const spot2 = sim2.nearestFree(Math.floor(x), Math.floor(y), taken);
  if (!spot2) return null;
  taken.add(spot2[1] * sim2.world.size + spot2[0]);
  const dx = spot2[0] + 0.5 - t.camp.x, dy = spot2[1] + 0.5 - t.camp.y;
  return { x: spot2[0], y: spot2[1], face: Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "front" : "back" };
}
function postsOf(sim2, t, n) {
  const out = [], taken = /* @__PURE__ */ new Set(), add = (x, y) => {
    if (out.length < n) {
      const p = postAt(sim2, t, x, y, taken);
      if (p) out.push(p);
    }
  };
  const inward = (p, k) => {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, dx = t.camp.x - cx, dy = t.camp.y - cy, len = Math.max(1, Math.hypot(dx, dy));
    return [cx + dx / len * k, cy + dy / len * k];
  };
  for (const g of t.props.filter((p) => p.kind === "gate")) {
    const [x, y] = inward(g, 1.5);
    add(x - 2, y);
    add(x + 2, y);
  }
  add(t.camp.x - 2.5, t.camp.y + 0.5);
  add(t.camp.x + 2.5, t.camp.y + 0.5);
  const fence = t.props.filter((p) => p.kind === "fence").sort((a, b) => Math.atan2(a.y - t.camp.y, a.x - t.camp.x) - Math.atan2(b.y - t.camp.y, b.x - t.camp.x));
  const stride = Math.max(LOD.postEvery, Math.floor(fence.length / Math.max(1, n - out.length)));
  for (let i = 0; i < fence.length && out.length < n; i += stride) {
    const [x, y] = inward(fence[i], 1.5);
    add(x, y);
  }
  return out;
}
var ARMOR_LADDER = [null, "hide", "bone"];
var playerTier = (sim2) => Math.max(...["foot", "archer", "cavalry"].map((r) => soldierTier(sim2.researched, r)));
function gearFor(sim2, t, index) {
  const own = t.def.weapons, lowest = Math.min(...own.map((w) => WEAPONS[w]?.tier ?? 1));
  const cap = Math.max(lowest, Math.min(2, playerTier(sim2) + (t.campLevel >= 3 ? 1 : 0)));
  const pool = own.filter((w) => (WEAPONS[w]?.tier ?? 1) <= cap), weapons = pool.length ? pool : own;
  const step2 = Math.min(ARMOR_LADDER.length - 1, (t.campLevel >= 4 ? 2 : t.campLevel >= 3 ? 1 : 0) + (t.def.armor ? 1 : 0)), common = ARMOR_LADDER[step2];
  if (t.boss && index * 0.618034 % 1 < DIFF.boss.bronzeShare) return { weapon: DIFF.boss.weapons[index % DIFF.boss.weapons.length], armor: "bronze" };
  return { weapon: weapons[index % weapons.length], armor: t.boss ? "bone" : common };
}
function mountFor(t, index, weapon) {
  const c = FOE.cavalry, share3 = t.boss ? c.bossShare : c.share;
  if (t.campLevel < c.minCamp || share3 <= 0 || WEAPONS[weapon]?.ranged || index * 0.618034 % 1 >= share3) return null;
  return t.boss ? c.boss : c.beasts[Math.min(c.beasts.length, t.campLevel - c.minCamp + 1) - 1];
}
function spawnOut(sim2, t, role, n, near2, rmin, rspan, posts = [], army3 = false) {
  const crowd2 = crowdOf(t), out = [], key = role === "civ" ? "civs" : "guards";
  let armed = t.unitIds.filter((u) => {
    const f = sim2.get(u);
    return !!f && f.ai?.role !== "civ";
  }).length;
  for (; n > 0 && crowd2[key] > 0; n--) {
    crowd2[key]--;
    const post = role === "guard" ? posts.shift() : void 0, [x, y] = post ? [post.x, post.y] : freeSpot(sim2, near2, rmin, rspan), f = sim2.makeVillager(x, y, sim2.frnd() < 0.5 ? "m" : "f", t.id, sim2.frnd);
    f.look.hide = t.def.look.hide;
    f.look.pants = t.def.look.pants;
    if (role === "guard") {
      const g = gearFor(sim2, t, armed);
      f.weapon = g.weapon;
      f.armor = g.armor;
      if (army3) f.mount = mountFor(t, armed, g.weapon);
      armed++;
    }
    f.ai = { role, camp: t.camp, wander: sim2.frnd() * 5, goal: null, raid: 0, post, ...army3 ? { army: true } : {} };
    if (post) f.facing = post.face;
    sim2.addFoe(f);
    t.unitIds.push(f.id);
    out.push(f);
  }
  if (out.length) {
    rescaleTribe(sim2, t);
    for (const f of out) f.health = f.maxHealth;
  }
  return out;
}
function wake(sim2, t) {
  if (t.awake || t.state === "destroyed") return;
  ensureLayout(sim2, t);
  if (t.hitAt !== void 0 && sim2.time - t.hitAt > SIEGE.struct.fullAfter) repairProps(t, 1);
  t.awake = true;
  t.idleT = 0;
  const cap = visibleCap(sim2, t), crowd2 = crowdOf(t);
  let out = Math.min(crowd2.guards, cap.guards, Math.max(LOD.minGuards, Math.ceil(crowd2.guards * LOD.guardShare)));
  for (const tw of t.props.filter((p) => p.kind === "tower")) out -= spawnTowerMen(sim2, t, tw, Math.min(out, towerSlots(sim2, tw)));
  spawnOut(sim2, t, "guard", out, t.camp, 2.5, 3.5, postsOf(sim2, t, out));
  spawnOut(sim2, t, "civ", Math.min(crowd2.civs, cap.civs), t.camp, 2.5, 3.5);
  t.pool0 = standing(t);
  t.hid0 = crowd2.guards + crowd2.civs;
  const live2 = t.unitIds.map((u) => sim2.get(u)).filter((u) => !!u && u.health > 0);
  if (!t.leaderDead && !live2.some((u) => u.id === t.leaderId)) {
    const lead = live2.filter((u) => u.ai?.role === "guard").sort((a, b) => b.stats.str + b.stats.vit - a.stats.str - a.stats.vit)[0];
    if (lead) {
      lead.leader = true;
      t.leaderId = lead.id;
    }
  }
}
function sleep(sim2, t) {
  const crowd2 = crowdOf(t);
  for (const u of [...t.unitIds]) {
    const f = sim2.get(u);
    if (!f) continue;
    if (f.health <= 0 || f.ai?.role === "raider") continue;
    if (f.ai?.role === "civ") crowd2.civs++;
    else crowd2.guards++;
    if (f.ai?.life) f.ai.life = void 0;
    sim2.removeFoe(f);
  }
  t.unitIds = t.unitIds.filter((u) => !!sim2.get(u));
  t.awake = false;
  t.idleT = 0;
  t.armyOut = false;
  if (!sim2.get(t.leaderId)) t.leaderId = -1;
}
function releaseCrowd(sim2, t, n, near2 = t.camp) {
  const crowd2 = crowdOf(t), g = spawnOut(sim2, t, "guard", Math.min(n, crowd2.guards), near2, 1.5, 2.5, [], true).length;
  return g + spawnOut(sim2, t, "civ", Math.min(n - g, crowd2.civs), near2, 1.5, 2.5).length;
}
function deployArmy(sim2, t) {
  const n = crowdOf(t).guards;
  t.armyOut = true;
  t.armyIdle = 0;
  if (n <= 0) return 0;
  const held = t.unitIds.map((u) => sim2.get(u)?.ai?.post).filter((p) => !!p);
  const posts = postsOf(sim2, t, n + held.length).filter((p) => !held.some((h) => Math.hypot(h.x - p.x, h.y - p.y) < 1.5));
  return spawnOut(sim2, t, "guard", n, t.camp, 2.5, 3.5, posts, true).length;
}
function recallArmy(sim2, t) {
  const crowd2 = crowdOf(t);
  for (const u of [...t.unitIds]) {
    const f = sim2.get(u);
    if (!f || f.health <= 0 || !f.ai?.army) continue;
    crowd2.guards++;
    sim2.removeFoe(f);
  }
  t.unitIds = t.unitIds.filter((u) => !!sim2.get(u));
  t.armyOut = false;
  t.armyIdle = 0;
  if (!sim2.get(t.leaderId)) t.leaderId = -1;
}
var standing = (t) => t.props.filter((p) => p.kind === "house" || p.kind === "fire").length;
function followFire(sim2, t) {
  t.campLevel = Math.max(t.campLevel, tierLevel(fireLevelOf(sim2), t.tier));
  if (t.popLevel === t.campLevel) return;
  const was = !!t.awake;
  if (was) sleep(sim2, t);
  topUp(sim2, t);
  if (was) wake(sim2, t);
}
function tickLod(sim2, t, busy2, hostile) {
  if (t.crowd === void 0) {
    t.crowd = { guards: 0, civs: 0 };
    t.awake = true;
    t.popLevel = t.campLevel;
    t.idleT = 0;
    t.hid0 = 0;
    t.pool0 = 1;
  }
  const near2 = isActive(sim2, t.camp.x, t.camp.y);
  if (!t.awake) {
    if (near2 || busy2) wake(sim2, t);
    return;
  }
  if ((t.built ?? 0) < t.campLevel) ensureLayout(sim2, t);
  const fighting = t.unitIds.some((u) => {
    const f = sim2.get(u);
    return !!f && (!!f.fight.target || f.phase === "fight");
  });
  if (near2 || busy2 || fighting || t.raid) t.idleT = 0;
  else if ((t.idleT = (t.idleT ?? 0) + 1) >= LOD.sleepAfter) {
    sleep(sim2, t);
    return;
  }
  if (t.hitAt !== void 0 && sim2.time - t.hitAt > SIEGE.struct.repairAfter) repairProps(t, SIEGE.struct.repairPerSecond);
  const r = LOD.gateRadius, atDoor = sim2.villagers.some((v) => v.health > 0 && Math.abs(v.x - t.camp.x) < r && Math.abs(v.y - t.camp.y) < r);
  const alarm = hostile && atDoor || busy2;
  setGates(sim2, t, alarm);
  if (alarm) {
    t.armyIdle = 0;
    if (!t.armyOut) deployArmy(sim2, t);
  } else if (t.armyOut && !fighting && (t.armyIdle = (t.armyIdle ?? 0) + 1) >= LOD.armyStandDown) recallArmy(sim2, t);
  const crowd2 = crowdOf(t), hidden = crowd2.guards + crowd2.civs;
  if (hidden > 0 && (t.hid0 ?? 0) > 0) {
    const keep = Math.ceil((t.hid0 ?? 0) * Math.min(1, standing(t) / Math.max(1, t.pool0 ?? 1)));
    if (hidden > keep) {
      const homes = t.props.filter((p) => p.kind === "house"), h = homes.length ? homes[Math.floor(sim2.frnd() * homes.length)] : null;
      releaseCrowd(sim2, t, hidden - keep, h ? { x: h.x + h.w / 2, y: h.y + h.h + 1 } : t.camp);
    }
  }
}

// src/sim/foecivil.ts
function houseNear(t, f, within = Infinity) {
  let best = null, bd = Infinity;
  for (const p of t.props) {
    if (p.kind !== "house" || p.hp <= 0) continue;
    const d = Math.hypot(p.x + p.w / 2 - f.x, p.y + p.h / 2 - f.y);
    if (d < bd && d - Math.max(p.w, p.h) / 2 <= within) {
      best = p;
      bd = d;
    }
  }
  return best;
}
function civilianBrain(sim2, f, t, ai, dt, free, scanNow, threats) {
  if (f.inTent) {
    f.phase = "idle";
    f.path = [];
    f.slide = null;
    if (free && houseNear(t, f, 4) && !(scanNow && !threatsOf(sim2, f, FOE.hideWatch).length)) return true;
    f.inTent = false;
  }
  if (free && (f.fleeT > 0 || ai.role === "civ" && threats.length && threats[0].d < FOE.civFlee)) {
    const home = houseNear(t, f), gx = home ? Math.floor(home.x + home.w / 2) : Math.floor(ai.camp.x), gy = home ? home.y + home.h : Math.floor(ai.camp.y);
    if (f.fleeT <= 0) {
      f.fleeT = 6;
      f.fight.target = null;
      f.path = sim2.pathTo(f, gx, gy, 3e3);
    }
    f.fleeT -= dt;
    f.phase = "flee";
    if (home && Math.hypot(home.x + home.w / 2 - f.x, home.y + home.h / 2 - f.y) <= Math.max(home.w, home.h) / 2 + 1.6) {
      f.inTent = true;
      f.path = [];
      f.slide = null;
      f.phase = "idle";
      f.fleeT = 0;
      return true;
    }
    if (threats.length && threats[0].d < FOE.civKeepRunning) f.fleeT = Math.max(f.fleeT, 2);
    if (!f.path.length && Math.hypot(f.x - gx, f.y - gy) > 3) f.path = sim2.pathTo(f, gx, gy, 3e3);
    return true;
  }
  return false;
}

// src/sim/foewar.ts
function noteStuck(sim2, f, ai, dt, blocked) {
  if (!blocked) {
    ai.stuck = 0;
    return;
  }
  ai.stuck = (ai.stuck ?? 0) + dt;
  if (ai.stuck < 3) return;
  const wall = sim2.nearestWork(f.x, f.y, 16) ?? sim2.nearestWork(f.x, f.y, 4, true);
  ai.stuck = 0;
  if (wall) ai.siege = wall.id;
}
function siegeBrain(sim2, f, ai, dt, threats) {
  if (!ai.siege) return false;
  if (threats.length && threats[0].d <= weaponOf(f).range + 1.5) return false;
  const b = sim2.getBuilding(ai.siege);
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
      sim2.damageWork(b, (w.damage + (w.ranged ? 0 : RULES.strengthDamage * f.stats.str)) * (w.type === "slash" ? 1.5 : 1));
    }
    return true;
  }
  f.fight.repath -= dt;
  if (!f.path.length && f.fight.repath <= 0) {
    const ring2 = sim2.ringTiles(f, b.x, b.y, d.w, d.h);
    f.path = ring2.length ? sim2.pathTo(f, ring2[0][0], ring2[0][1], 4e3) : [];
    f.fight.repath = 1;
    if (!f.path.length) {
      ai.siege = 0;
      return false;
    }
  }
  f.phase = "move";
  return true;
}
function keepPost(sim2, f, ai) {
  const post = ai.post, px = post.x + 0.5, py = post.y + 0.5;
  if (Math.hypot(f.x - px, f.y - py) > 0.8) {
    if (!f.path.length && sim2.pathLeft > 0) {
      sim2.pathLeft--;
      f.path = sim2.pathTo(f, post.x, post.y, 3e3);
      if (!f.path.length) ai.post = void 0;
    }
    f.phase = f.path.length ? "move" : "idle";
  } else {
    f.phase = "idle";
    f.path = [];
    f.facing = post.face;
  }
}
function towerOf(sim2, t, ai) {
  const p = ai.tower ? t.props.find((q) => q.kind === "tower" && q.x === ai.tower.x && q.y === ai.tower.y) : void 0;
  return p ? { p, reach: levelsOf("tower", sim2.era)[(p.lv ?? 1) - 1]?.sight ?? 10 } : null;
}
function towerBrain(sim2, f, ai, tower, willing, threats) {
  keepPost(sim2, f, ai);
  if (willing && threats.length && f.atkCd <= 0) {
    const w = weaponOf(f), e = resolve(sim2, threats[0].t), from = { x: tower.p.x + tower.p.w / 2, y: tower.p.y + 0.4 };
    if (e && fireProjectile(sim2, f, e, from, UNIT_RULES.archerOnTower.damage, Math.max(0, tower.reach - w.range - 1))) {
      f.atkCd = swingCycle(sim2, f, w);
      const { hitAt, end } = swingTimes(w.anim);
      f.swing = { t: 0, hitAt, end, target: { kind: "unit", id: -1 } };
      f.anim = w.anim;
      f.animClock = 0;
      f.facing = (e.kind === "unit" ? e.v.x : e.a.x) >= f.x ? "right" : "left";
    }
  }
}
function raiderBrain(sim2, f, t, ai, dt, threats) {
  if (!t.raid) return;
  if (t.raid.phase === "retreat") {
    if (!f.path.length && sim2.pathLeft > 0 && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) > 4) {
      sim2.pathLeft--;
      f.path = sim2.pathTo(f, Math.floor(ai.camp.x), Math.floor(ai.camp.y), 2e4);
    }
    f.phase = "move";
    return;
  }
  if (siegeBrain(sim2, f, ai, dt, threats)) return;
  if (f.fight.target) {
    const e = resolve(sim2, f.fight.target);
    if (e) {
      engage(sim2, f, e, dt);
      const ex = e.kind === "unit" ? e.v.x : e.a.x, ey = e.kind === "unit" ? e.v.y : e.a.y;
      noteStuck(sim2, f, ai, dt, !f.path.length && !f.swing && Math.hypot(ex - f.x, ey - f.y) > weaponOf(f).range + 2);
      return;
    }
    f.fight.target = null;
    f.phase = "idle";
  }
  if (threats.length) {
    f.fight.target = threats[0].t;
    return;
  }
  const fire2 = sim2.campfire(), gx = fire2 ? fire2.x + 1 : sim2.world.start.x, gy = fire2 ? fire2.y + 1 : sim2.world.start.y;
  if (Math.hypot(gx - f.x, gy - f.y) > 6) {
    f.fight.repath -= dt;
    if (!f.path.length && f.fight.repath <= 0 && sim2.pathLeft > 0) {
      sim2.pathLeft--;
      f.path = sim2.pathTo(f, Math.floor(gx), Math.floor(gy), 4e4);
      f.fight.repath = f.path.length ? 0.5 : 1.5;
    }
    f.phase = "move";
    noteStuck(sim2, f, ai, dt, !f.path.length);
  } else {
    const v = sim2.villagers.find((o) => o.health > 0 && o.down <= 0 && o.inside === null);
    if (v) f.fight.target = { kind: "unit", id: v.id };
  }
  return;
}

// src/sim/warmarch.ts
var WAR_DATA = war_default;
var supplyLoad = (sim2) => WAR_DATA.supply.load * (1 + statBonus(sim2.researched, "march_army", "mload") / 100);
var PEACE = { squads: 0, soldiers: 0, slow: 0, speed: 1, food: 1, energy: 1 };
function slowCut(sim2) {
  let cut = 0;
  for (const [tech, share3] of Object.entries(WAR_DATA.research)) if (sim2.researched.has(tech)) cut += share3;
  return Math.min(WAR_DATA.march.maxCut, cut);
}
function marchOf(sim2, squads, soldiers) {
  if (sim2.era !== "ancient") return { squads, soldiers, slow: 0, speed: 1, food: 1, energy: 1 };
  const k = WAR_DATA.march, load = Math.max(0, Math.min(1, k.perSquad * Math.max(0, squads - 1) + k.perSoldier * Math.max(0, soldiers - 1)));
  const raw = k.slowMin + (k.slowMax - k.slowMin) * load;
  const slow = Math.max(k.slowFloor, raw * (1 - slowCut(sim2)));
  const extra = Math.max(0, slow - k.slowMin);
  return { squads, soldiers, slow, speed: (1 - slow) * k.paceScale * (1 + statBonus(sim2.researched, "march_army", "mspeed") / 100), food: k.foodBase + extra, energy: k.energyBase + extra };
}
var soldiersOf = (sim2, plan2) => plan2.missions.reduce((n, m) => {
  const s = sim2.squadById(m.squad);
  return n + (s ? sim2.squadUnits(s).length : 0);
}, 0);
var supplyCount = (sim2, plan2) => plan2.status === "running" ? plan2.supplyIds.filter((id) => (sim2.get(id)?.health ?? 0) > 0).length : Math.min(plan2.supply, sim2.villagers.filter((v) => v.job === "supply" && v.health > 0 && v.down <= 0).length);
function marchOfPlan(sim2, plan2) {
  const sup = supplyCount(sim2, plan2);
  const m = marchOf(sim2, plan2.missions.filter((m2) => {
    const s = sim2.squadById(m2.squad);
    return s && sim2.squadUnits(s).length;
  }).length + (sup ? 1 : 0), soldiersOf(sim2, plan2) + sup);
  return plan2.status === "running" && (plan2.stage === "retreat" || plan2.stage === "recall") ? { ...m, speed: 1 - m.slow } : m;
}

// src/sim/warharass.ts
var HARASS = WAR_DATA.harass;
function focusOf(sim2, plan2) {
  const us = plan2.missions.flatMap((m) => {
    const s = sim2.squadById(m.squad);
    return s ? sim2.squadUnits(s) : [];
  });
  return us.length ? { x: us.reduce((a, v) => a + v.x, 0) / us.length, y: us.reduce((a, v) => a + v.y, 0) / us.length } : null;
}
var alive = (sim2) => sim2.foes.filter((f) => f.ai?.harass !== void 0 && f.health > 0);
function harassBrain(sim2, f, dt, threats) {
  if (f.fight.target) {
    const e = resolve(sim2, f.fight.target);
    if (e) {
      engage(sim2, f, e, dt);
      return true;
    }
    f.fight.target = null;
    f.phase = "idle";
  }
  if (threats.length) {
    f.fight.target = threats[0].t;
    return true;
  }
  const c = sim2.warFocus;
  if (!c) return true;
  if (Math.hypot(c.x - f.x, c.y - f.y) > 6) {
    f.fight.repath -= dt;
    if (!f.path.length && f.fight.repath <= 0 && sim2.pathLeft > 0) {
      sim2.pathLeft--;
      f.path = sim2.pathTo(f, Math.floor(c.x), Math.floor(c.y), 4e4);
      f.fight.repath = f.path.length ? 1 : 2;
    }
    f.phase = f.path.length ? "move" : "idle";
  }
  return true;
}
function send(sim2, t, c) {
  const warriors = t.unitIds.filter((u) => {
    const f = sim2.get(u);
    return !!f && f.health > 0 && f.ai?.role !== "civ" && f.ai?.harass === void 0;
  }).length + (t.crowd?.guards ?? 0);
  const room = HARASS.maxAlive - alive(sim2).length;
  const n = Math.min(room, Math.max(HARASS.base, Math.min(HARASS.max, Math.round(HARASS.base + warriors / HARASS.perWarriors))));
  if (n <= 0) return;
  const dx = t.camp.x - c.x, dy = t.camp.y - c.y, len = Math.max(1, Math.hypot(dx, dy)), d = Math.min(HARASS.spawnDist, len);
  const gx = c.x + dx / len * d, gy = c.y + dy / len * d;
  sim2.world.ensure(gx, gy, 12);
  const melee = t.def.weapons.filter((w) => !WEAPONS[w]?.ranged), taken = /* @__PURE__ */ new Set();
  if (t.crowd) t.crowd.guards = Math.max(0, t.crowd.guards - n);
  for (let i = 0; i < n; i++) {
    const spot2 = sim2.nearestFree(Math.floor(gx) + i % 3 - 1, Math.floor(gy) + Math.floor(i / 3) - 1, taken);
    if (!spot2) continue;
    taken.add(spot2[1] * sim2.world.size + spot2[0]);
    const f = sim2.makeVillager(spot2[0], spot2[1], sim2.frnd() < 0.5 ? "m" : "f", t.id, sim2.frnd);
    f.look.hide = t.def.look.hide;
    f.look.pants = t.def.look.pants;
    f.weapon = i % 3 === 2 ? t.def.weapons[i % t.def.weapons.length] : melee[i % Math.max(1, melee.length)] ?? f.weapon;
    f.armor = null;
    f.ai = { role: "raider", camp: t.camp, wander: 0, goal: null, raid: -1, harass: sim2.time };
    sim2.addFoe(f);
    t.unitIds.push(f.id);
    applyStats(sim2, f);
    f.health = f.maxHealth;
  }
  sim2.say(`${t.def.name} cho ${n} ng\u01B0\u1EDDi ra qu\u1EA5y r\u1ED1i qu\xE2n ta!`);
}
function tickHarass(sim2, plan2) {
  const t = sim2.tribes.find((x) => x.id === plan2.tribe), c = focusOf(sim2, plan2);
  sim2.warFocus = c;
  for (const f of alive(sim2)) if (!t || t.state !== "free" || sim2.time - f.ai.harass > HARASS.life || !c) remove(sim2, f, t);
  if (!t || t.state !== "free" || !c) return;
  const fire2 = sim2.campfire(), home = fire2 ? { x: fire2.x + 1, y: fire2.y + 1 } : sim2.world.start;
  const out = Math.hypot(c.x - home.x, c.y - home.y), near2 = Math.hypot(c.x - t.camp.x, c.y - t.camp.y);
  if (out < HARASS.minFromVillage || near2 > HARASS.range) {
    sim2.warHarassAt = -1;
    return;
  }
  if (sim2.warHarassAt < 0) sim2.warHarassAt = sim2.time + HARASS.first;
  if (sim2.time >= sim2.warHarassAt) {
    send(sim2, t, c);
    sim2.warHarassAt = sim2.time + HARASS.every;
  }
}
function remove(sim2, f, t) {
  if (t?.crowd && f.health > 0) t.crowd.guards++;
  sim2.removeFoe(f);
  if (t) t.unitIds = t.unitIds.filter((u) => u !== f.id);
}
function clearHarass(sim2) {
  for (const f of sim2.foes.filter((x) => x.ai?.harass !== void 0)) remove(sim2, f, sim2.tribes.find((x) => x.id === f.team));
  sim2.warFocus = null;
  sim2.warHarassAt = -1;
}

// src/data/events.json
var events_default = {
  _note: "kind beasts: species = id in animals.json (wolf, bear, lion...). kind raid: tribe = who attacks; power = how strong against the army of the player on the day (1 = as strong, 1.1 = a tenth stronger, 0.8 = a fifth weaker; kept between floor and ceiling of content/difficulty.json), OR size = how many guards the tribe sends, OR army = own make-up { weapon: count } (weapons of weapons.json: club, spear, mace, hatchet = foot; sling, bow = archers), with armor (default true). Enemy cavalry is not supported yet. day = first day of the window in the game year (year 2 adds 20). The event fires at a random day in [day, day + spread]. warnDays: how long before the first hint. size is capped by what the source really has. recurring: s\u1EF1 ki\u1EC7n kh\xF4ng c\u1EA1n: t\u1EEB fromDay, c\u1EE9 everyDays ng\xE0y b\u1ED1c m\u1ED9t s\u1EF1 ki\u1EC7n t\u1EEB table theo weight (th\xFA: s\u1ED1 con = base + perSoldier \xD7 s\u1ED1 l\xEDnh c\u1EE7a ta, t\u1ED1i \u0111a max; t\u1EADp k\xEDch: m\u1ED9t l\xE0ng th\xF9 \u0111\u1ECBch, s\u1EE9c = power \xD7 qu\xE2n c\u1EE7a ta, k\u1EB9p theo tr\u1EA7n c\u1EE7a c\u1EA5p l\u1EEDa nh\u01B0 raidPower), b\xE1o tr\u01B0\u1EDBc leadDays ng\xE0y. hostile: l\xE0ng ch\u01B0a chi\u1EBFm kh\xF4ng ph\u1EA3i lo\u1EA1i hi\u1EC1n (ho\u1EB7c \u0111\xE3 th\xF9 \u0111\u1ECBch, ho\u1EB7c l\xE0 th\u1EE7 l\u0129nh ph\u1EA3n b\u1ED9i) m\xE0 quan h\u1EC7 d\u01B0\u1EDBi raidBelow t\u1EF1 t\u1EADp k\xEDch c\u1EE9 raidEveryDays ng\xE0y v\u1EDBi s\u1EE9c power theo b\u1EADc, t\u1EEB fromDay; l\xE0ng c\xF3 quan h\u1EC7 t\u1EEB gift.friendAt tr\u1EDF l\xEAn th\xEC kh\xF4ng.",
  events: [
    {
      id: "wolves_summer_1",
      kind: "beasts",
      species: "wolf",
      day: 6,
      spread: 1,
      size: 2,
      night: false,
      warnDays: 2,
      warn: "Ti\u1EBFng h\xFA vang l\xEAn t\u1EEB xa trong \u0111\xEAm..."
    },
    {
      id: "wolves_summer_2",
      kind: "beasts",
      species: "wolf",
      day: 9,
      spread: 1,
      size: 4,
      night: false,
      warnDays: 3,
      warn: "Ti\u1EBFng h\xFA vang l\xEAn t\u1EEB xa trong \u0111\xEAm b\u1EA7y s\xF3i tr\u1EA3 th\xF9..."
    },
    {
      id: "wolves_summer_3",
      kind: "beasts",
      species: "wolf",
      day: 15,
      spread: 1,
      size: 6,
      night: true,
      warnDays: 3,
      warn: "Ti\u1EBFng h\xFA vang l\xEAn t\u1EEB xa trong \u0111\xEAm b\u1EA7y s\xF3i t\u1ED5ng t\u1EA5n c\xF4ng..."
    },
    {
      id: "axe_scout",
      kind: "raid",
      tribe: "axe",
      day: 12,
      spread: 2,
      size: 4,
      night: false,
      warnDays: 2,
      warn: "Kh\xF3i b\u1ED1c l\xEAn t\u1EEB ph\xEDa t\u1ED9c R\xECu \u0110\xE1, c\xF3 l\u1EBD h\u1ECD \u0111ang c\u1EED ng\u01B0\u1EDDi d\xF2 x\xE9t."
    },
    {
      id: "wolves_winter",
      kind: "beasts",
      species: "wolf",
      day: 23,
      spread: 4,
      size: 6,
      night: true,
      warn: "D\u1EA5u ch\xE2n s\xF3i \u0111\u1EA7y quanh l\xE0ng."
    },
    {
      id: "bear_autumn",
      kind: "beasts",
      species: "bear",
      day: 19,
      spread: 1,
      size: 1,
      night: true,
      warn: "Nh\u1EEFng v\u1EBFt c\xE0o s\xE2u tr\xEAn th\xE2n c\xE2y quanh l\xE0ng: c\xF3 g\u1EA5u."
    },
    {
      id: "swamp_raid",
      kind: "raid",
      tribe: "swamp",
      day: 27,
      spread: 4,
      size: 6,
      night: true,
      warnDays: 0,
      warn: ""
    },
    {
      id: "axe_war",
      kind: "raid",
      tribe: "axe",
      day: 33,
      spread: 4,
      size: 14,
      night: false,
      warnDays: 1,
      warn: "Ti\u1EBFng tr\u1ED1ng chi\u1EBFn vang l\xEAn: t\u1ED9c R\xECu \u0110\xE1 s\u1EAFp \u0111\xE1nh l\u1EDBn."
    }
  ],
  recurring: {
    fromDay: 18,
    everyDays: 5,
    nightChance: 0.3,
    leadDays: [
      2,
      4
    ],
    table: [
      {
        kind: "beasts",
        species: "wolf",
        weight: 3,
        base: 2,
        perSoldier: 0.15,
        max: 10,
        warn: "Ti\u1EBFng h\xFA vang l\xEAn t\u1EEB xa trong \u0111\xEAm..."
      },
      {
        kind: "beasts",
        species: "bear",
        weight: 1,
        base: 1,
        perSoldier: 0.03,
        max: 3,
        warn: "Nh\u1EEFng v\u1EBFt c\xE0o s\xE2u tr\xEAn th\xE2n c\xE2y quanh l\xE0ng: c\xF3 g\u1EA5u."
      },
      {
        kind: "raid",
        weight: 3,
        power: 0.6,
        warn: "Kh\xF3i b\u1ED1c l\xEAn t\u1EEB ph\xEDa l\xE0ng th\xF9 \u0111\u1ECBch, c\xF3 l\u1EBD h\u1ECD \u0111ang chu\u1EA9n b\u1ECB \u0111\xE1nh ta."
      }
    ]
  },
  hostile: {
    fromDay: 18,
    raidEveryDays: 12,
    raidBelow: 50,
    power: {
      weak: 0.2,
      normal: 0.25,
      medium: 0.35,
      boss: 0.4,
      rebel: 0.4
    }
  }
};

// src/sim/warmode.ts
var warPlan = (sim2) => sim2.plans.find((p) => p.kind === "attack" && p.status === "running");
var warTribe = (sim2) => warPlan(sim2)?.tribe ?? null;
function army(sim2) {
  const ids2 = /* @__PURE__ */ new Set();
  for (const p of sim2.plans) {
    if (p.kind !== "attack" || p.status !== "running") continue;
    for (const m of p.missions) {
      const s = sim2.squadById(m.squad);
      if (s) for (const v of sim2.squadUnits(s)) ids2.add(v.id);
    }
    for (const id of p.supplyIds) ids2.add(id);
  }
  return ids2;
}
function ranks(sim2, soldiers = army(sim2)) {
  const ids2 = new Set(soldiers);
  for (const m of sim2.scouts) for (const id of m.ids) ids2.add(id);
  return ids2;
}
function standDown(sim2, v, _dt) {
  if (v.down > 0 || v.health <= 0) return;
  if (v.inside !== null) return;
  if (v.phase === "sleep") {
    v.inTent = true;
    return;
  }
  sim2.clearCombat(v);
  sim2.goHome(v);
  const bed = v.phase === "goHome" && v.target >= 0 ? sim2.getBuilding(v.target) : void 0;
  if (bed && bed.done) {
    sim2.sleepIn(v, bed);
    return;
  }
  v.path = [];
  v.slide = null;
  v.phase = "sleep";
  v.inTent = true;
  v.anim = "idle";
  v.hold = null;
}

// src/sim/tribes.ts
var tribeOf = (sim2, id) => sim2.tribes.find((t) => t.id === id);
function spawnTribes(sim2) {
  for (const id of TRIBE_IDS) spawnTribe(sim2, id);
  initEvents(sim2, sim2.day - 1);
}
function resetTribes(sim2) {
  const N = sim2.world.size;
  for (const t of sim2.tribes) {
    for (const f of sim2.foes.filter((q) => q.team === t.id)) sim2.removeFoe(f);
    for (const p of t.props) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const k = (p.y + j) * N + p.x + i;
      sim2.world.occ[k] = 0;
      sim2.world.foeGates.delete(k);
    }
  }
  sim2.tribes.length = 0;
  sim2.events.length = 0;
  sim2.maps.length = 0;
  sim2.sightings.length = 0;
  sim2.pendingTribe = null;
  for (const k of Object.keys(sim2.drafts)) delete sim2.drafts[k];
  spawnTribes(sim2);
}
function campFits(sim2, cx, cy, r, spare) {
  const w = sim2.world;
  let bad = 0, all = 0;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (Math.hypot(x - cx, y - cy) > r) continue;
    if (!w.inBounds(x, y)) return false;
    all++;
    if (w.at(x, y) === Tile.Water || w.at(x, y) === Tile.Mountain) bad++;
  }
  return bad <= all * spare;
}
var SITES = [{ r: 14, spare: 0.04, yard: true }, { r: 7, spare: 0, yard: false }];
function spawnTribe(sim2, id) {
  const def = TRIBES[id], w = sim2.world, s = w.start, N = w.size, tier = def.tier, boss = tier === "boss", campLevel = tierLevel(sim2.campfire()?.level ?? 1, tier);
  let cx = -1, cy = -1;
  search: for (const site of SITES) for (let dd = 0; dd <= 24; dd += 3) for (const sign of dd ? [1, -1] : [1]) for (let da = 0; da <= 90; da += 15) for (const as of da ? [1, -1] : [1]) {
    const ang = (def.angle + da * as) * Math.PI / 180, d = def.distance + dd * sign;
    const x = Math.round(s.x + Math.cos(ang) * d), y = Math.round(s.y + Math.sin(ang) * d);
    if (!(x > 16 && y > 16 && x < N - 16 && y < N - 16)) continue;
    w.ensure(x, y, 18);
    if (campFits(sim2, x, y, 7, 0) && (!site.yard || campFits(sim2, x, y, site.r, site.spare))) {
      cx = x;
      cy = y;
      break search;
    }
  }
  if (cx < 0) return;
  const gap = Math.hypot(cx - s.x, cy - s.y);
  for (let k = 0; k <= gap; k += 16) w.ensure(s.x + (cx - s.x) * k / gap, s.y + (cy - s.y) * k / gap, 24);
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
    campLevel,
    tier,
    mil: 0,
    eco: 0,
    seenDay: 0,
    seenFire: 0,
    lastAngry: -999,
    boss
  };
  sim2.tribes.push(tribe);
  topUp(sim2, tribe);
  rescaleTribe(sim2, tribe);
}
function tribeHostile(sim2, id) {
  const t = tribeOf(sim2, id);
  return !!t && t.state === "free" && (t.relation < HOSTILE_BELOW || sim2.time < t.angryUntil || !!t.raid);
}
function tribeWilling(sim2, id) {
  const t = tribeOf(sim2, id);
  if (!t || t.state !== "free") return false;
  if (sim2.plans.some((p) => p.kind === "attack" && p.status === "running" && p.tribe === id)) return true;
  return tribeHostile(sim2, id) || t.def.personality !== "peaceful" && t.relation < MEET.friendlyFrom;
}
function tribesFeud(sim2, a, b) {
  if (a === b || !MEET.feuds.some((p) => p.includes(a) && p.includes(b))) return false;
  const ta = tribeOf(sim2, a), tb = tribeOf(sim2, b);
  return !!ta && !!tb && ta.state === "free" && tb.state === "free";
}
function tribeAttacked(sim2, id, victim) {
  const t = tribeOf(sim2, id);
  if (!t || t.state !== "free") return;
  t.harmed = true;
  const first = sim2.time > t.angryUntil;
  t.angryUntil = sim2.time + 120;
  if (first) {
    t.relation = Math.max(-100, t.relation + (t.def.personality === "peaceful" ? RELATION.attackedPeaceful : -10));
    if (sim2.time - t.lastAngry > 30) {
      t.lastAngry = sim2.time;
      sim2.say(`${t.def.name} b\u1ECB t\u1EA5n c\xF4ng v\xE0 n\u1ED5i gi\u1EADn!`);
    }
  }
  void victim;
}
function killFoe(sim2, v, killer) {
  const t = tribeOf(sim2, v.team);
  sim2.removeFoe(v);
  if (!t) return;
  t.unitIds = t.unitIds.filter((u) => u !== v.id);
  if (v.ai?.role === "raider") sim2.noteBattle("foes");
  if (killer?.team === "player") {
    t.relation = Math.max(-100, t.relation + (v.ai?.role === "civ" ? RELATION.killCivilian : RELATION.killWarrior));
    t.angryUntil = sim2.time + 120;
  }
  if (v.id === t.leaderId) {
    t.leaderDead = true;
    sim2.say(`Th\u1EE7 l\u0129nh ${t.def.name} \u0111\xE3 g\u1EE5c ng\xE3.`);
  }
  sim2.onKill?.();
}
function giftOf(t, era) {
  const out = {};
  for (const [k, n] of Object.entries(spoilsOf(t, era))) {
    const v = Math.round((n ?? 0) * DIFF.capture.gift.share);
    if (v > 0) out[k] = v;
  }
  return out;
}
function giftTribe(sim2, id) {
  const t = tribeOf(sim2, id);
  if (!t || t.state !== "free") return "Ch\u1EC9 t\u1EB7ng \u0111\u01B0\u1EE3c cho l\xE0ng ch\u01B0a chi\u1EBFm";
  if (t.boss || t.tier === "boss" || t.tier === "rebel") return "Th\u1EE7 l\u0129nh kh\xF4ng nh\u1EADn qu\xE0";
  const gift = giftOf(t, sim2.era), lack = Object.keys(gift).find((k) => sim2.stock[k] < (gift[k] ?? 0));
  if (lack) return `Thi\u1EBFu ${RES_NAME[lack].toLowerCase()} \u0111\u1EC3 l\xE0m qu\xE0 (c\u1EA7n ${gift[lack]})`;
  for (const k of Object.keys(gift)) sim2.stock[k] -= gift[k] ?? 0;
  t.relation = Math.min(100, Math.round((t.relation + 100 * DIFF.capture.gift.share / DIFF.capture.gift.cost[t.tier]) * 10) / 10);
  if (t.relation >= HOSTILE_BELOW) t.angryUntil = Math.min(t.angryUntil, sim2.time);
  return null;
}
function canTribute(t) {
  return t.state === "surrendered" || t.state === "free" && t.relation >= RELATION.tributeAt;
}
function canAdopt(t) {
  return t.state === "surrendered" || t.state === "free" && t.def.personality === "peaceful" && t.relation >= RELATION.joinAt;
}
function spoilsOf(t, era) {
  const out = {}, mult = t.boss ? DIFF.capture.bossMult : 1;
  for (const [res, row] of Object.entries(DIFF.capture.spoils[era])) out[res] = Math.round(row[Math.max(0, Math.min(row.length, t.campLevel) - 1)] * mult);
  return out;
}
function claimVillage(sim2, t) {
  const got = [];
  if (t.spoiledIn === sim2.era) return got;
  t.spoiledIn = sim2.era;
  for (const [k, n] of Object.entries(spoilsOf(t, sim2.era))) {
    const take2 = n ?? 0, res = k;
    if (take2 <= 0) continue;
    sim2.stock[res] = Math.min(sim2.capacity(res), sim2.stock[res] + take2);
    sim2.noteLoot(t.id, res, take2);
    got.push(`${take2} ${RES_NAME[res].toLowerCase()}`);
  }
  return got;
}
function takeVillage(sim2, t) {
  const a = DIFF.capture.adopt[t.tier];
  sim2.conquered++;
  sim2.popBonus += a.pop;
  sim2.campBonus += a.slots;
  return a;
}
function removeTribe(sim2, t) {
  const N = sim2.world.size;
  for (const f of sim2.foes.filter((q) => q.team === t.id)) sim2.removeFoe(f);
  for (const p of t.props) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
    const k = (p.y + j) * N + p.x + i;
    sim2.world.occ[k] = 0;
    sim2.world.foeGates.delete(k);
  }
  for (const plan2 of sim2.plans) if (plan2.tribe === t.id && plan2.status === "running") {
    plan2.status = "done";
    plan2.result = "won";
    plan2.endedAt = sim2.time;
  }
  for (let i = sim2.sightings.length - 1; i >= 0; i--) if (sim2.sightings[i].tribe === t.id) sim2.sightings.splice(i, 1);
  for (let i = sim2.maps.length - 1; i >= 0; i--) if (sim2.maps[i].tribe === t.id) sim2.maps.splice(i, 1);
  if (sim2.pendingTribe === t.id) sim2.pendingTribe = null;
  sim2.tribes.splice(sim2.tribes.indexOf(t), 1);
}
function tributeTribe(sim2, id) {
  const t = tribeOf(sim2, id);
  if (!t || !canTribute(t)) return "H\u1ECD ch\u01B0a ch\u1ECBu c\u1ED1ng n\u1EA1p";
  t.state = "tribute";
  t.relation = Math.max(t.relation, RELATION.tributeAt);
  t.raid = null;
  t.tributeShare = DIFF.capture.tribute.baseShare;
  t.nextTribute = sim2.day + DIFF.capture.tribute.everyDays;
  if (sim2.pendingTribe === id) sim2.pendingTribe = null;
  claimVillage(sim2, t);
  releaseRaiders(sim2, t);
  sim2.say(`${t.def.name} ch\u1ECBu c\u1ED1ng n\u1EA1p: c\u1EE9 ${DIFF.capture.tribute.everyDays} ng\xE0y h\u1ECD g\u1EEDi ${Math.round(t.tributeShare * 100)}% t\xE0i nguy\xEAn v\xE0 kh\xF4ng \u0111\xE1nh l\xE0ng n\u1EEFa.`);
  return null;
}
function tributeSteps(t) {
  const c = DIFF.capture.tribute;
  return Math.max(0, Math.round(((t.tributeShare ?? c.baseShare) - c.baseShare - (t.tributeFree ?? 0)) / c.step));
}
function setTribute(sim2, id, dir) {
  const t = tribeOf(sim2, id), c = DIFF.capture.tribute;
  if (!t || t.state !== "tribute") return "L\xE0ng n\xE0y ch\u01B0a c\u1ED1ng n\u1EA1p";
  const low = c.baseShare + (t.tributeFree ?? 0), now = t.tributeShare ?? c.baseShare;
  const next = dir < 0 ? now <= low ? 0 : Math.max(low, Math.round((now - c.step) * 100) / 100) : now <= 0 ? low : Math.min(c.maxShare, Math.round((now + c.step) * 100) / 100);
  if (next === now) return dir > 0 ? "\u0110\xE3 \u0111\xF2i h\u1EBFt m\u1EE9c" : "\u0110\xE3 kh\xF4ng l\u1EA5y c\u1ED1ng n\u1EA1p";
  t.tributeShare = next;
  return null;
}
function payTribute(sim2, t) {
  const c = DIFF.capture.tribute, share3 = t.tributeShare ?? c.baseShare, steps = tributeSteps(t);
  t.nextTribute = sim2.day + c.everyDays;
  if (share3 <= 0) {
    t.relation = Math.min(100, t.relation + c.relationRegen);
    sim2.say(`${t.def.name} \u0111\u01B0\u1EE3c ngh\u1EC9 c\u1ED1ng n\u1EA1p k\u1EF3 n\xE0y, quan h\u1EC7 t\u1ED1t l\xEAn.`);
    return;
  }
  for (const [k, n] of Object.entries(spoilsOf(t, sim2.era))) sim2.stock[k] = Math.min(sim2.capacity(), sim2.stock[k] + Math.round((n ?? 0) * share3));
  t.relation = Math.max(-100, t.relation - c.relationLoss * (1 + steps));
  sim2.say(`${t.def.name} g\u1EEDi c\u1ED1ng n\u1EA1p (${Math.round(share3 * 100)}% t\xFAi).`);
  const room = sim2.tribes.filter((q) => q.rebel).length < DIFF.capture.rebel.maxRebels;
  if (room && (t.relation <= c.betrayBelow || steps > 0 && sim2.frnd() < steps * c.greedChancePerStep)) betray(sim2, t);
  else if (t.relation < c.betrayBelow) t.relation = c.betrayBelow;
}
function betray(sim2, t) {
  t.state = "free";
  t.relation = -100;
  t.raid = null;
  t.tributeShare = void 0;
  t.rebel = true;
  t.boss = true;
  t.bossDown = false;
  t.tier = "rebel";
  t.tributeFree = void 0;
  t.nextRaidDay = sim2.day + events_default.hostile.raidEveryDays;
  followFire(sim2, t);
  rescaleTribe(sim2, t);
  sim2.say(`${t.def.name} ph\u1EA3n b\u1ED9i! H\u1ECD kh\xF4ng ch\u1ECBu n\u1ED5i s\u1EF1 \u0111\xF2i h\u1ECFi v\xE0 th\xE0nh th\u1EE7 l\u0129nh m\u1EDBi c\u1EE7a m\u1ED9t \u0111\u1ED9i qu\xE2n th\xF9 \u0111\u1ECBch. Ph\u1EA3i h\u1EA1 h\u1EBFt c\xE1c th\u1EE7 l\u0129nh m\u1EDBi \u0111\u01B0\u1EE3c sang th\u1EDDi \u0111\u1EA1i.`);
}
function adoptTribe(sim2, id) {
  const t = tribeOf(sim2, id);
  if (!t || !canAdopt(t)) return "H\u1ECD ch\u01B0a ch\u1ECBu theo l\xE0ng";
  const got = claimVillage(sim2, t), a = takeVillage(sim2, t), name = t.def.name;
  removeTribe(sim2, t);
  const joined = sim2.settle(a.pop, true).length;
  sim2.say(`${name} theo l\xE0ng ta v\xE0 bi\u1EBFn m\u1EA5t kh\u1ECFi b\u1EA3n \u0111\u1ED3: ${joined} ng\u01B0\u1EDDi \u1EDF l\u1EA1i, l\xE0ng ch\u1EE9a th\xEAm \u0111\u01B0\u1EE3c ${a.pop} d\xE2n v\xE0 m\u1ED7i tr\u1EA1i l\xEDnh th\xEAm ${a.slots} ch\u1ED7${got.length ? `; ta nh\u1EADn ${got.join(", ")}` : ""}.`);
  return null;
}
function summonAllies(sim2, target) {
  const c = DIFF.capture.allies, fire2 = sim2.campfire(), s = sim2.world.start;
  let total = 0;
  for (const a of sim2.tribes) {
    if (a === target || a.boss || a.rebel || a.tier === "boss" || a.tier === "rebel") continue;
    const gift = a.state === "free" && a.relation >= 100 && a.tier !== "medium";
    if (a.state !== "tribute" && !gift) continue;
    const n = Math.round(c[a.tier] * Math.max(0, Math.min(100, a.relation)) / 100);
    if (n <= 0) continue;
    const arms2 = ["foot", "archer", "cavalry"].map((_, i) => Math.floor(n / 3) + (i < n % 3 ? 1 : 0));
    ["foot", "archer", "cavalry"].forEach((arm, i) => {
      for (let k = 0; k < arms2[i]; k++) {
        const ang = sim2.frnd() * Math.PI * 2, r = 3 + sim2.frnd() * 3;
        const gx = Math.floor((fire2 ? fire2.x + 1 : s.x) + Math.cos(ang) * r), gy = Math.floor((fire2 ? fire2.y + 3 : s.y) + Math.sin(ang) * r), spot2 = sim2.nearestFree(gx, gy, /* @__PURE__ */ new Set()) ?? [gx, gy];
        const v = sim2.makeVillager(spot2[0], spot2[1], sim2.frnd() < 0.5 ? "f" : "m", "player", sim2.frnd);
        v.job = "fight";
        v.arm = arm;
        v.post = -1;
        v.guard = false;
        v.energy = 100;
        v.ally = { tribe: a.id, leaving: false, since: sim2.time };
        sim2.villagers.push(v);
        sim2.registerUnit(v);
        sim2.equipGear(v);
        total++;
      }
    });
    a.relation = Math.max(-100, a.relation - (gift ? c.giftLoss : c.battleLoss));
    sim2.say(`${a.def.name} g\u1EEDi ${n} l\xEDnh gi\xFAp ta \u0111\xE1nh ${target.def.name}.`);
  }
  return total;
}
function dismissAllies(sim2) {
  for (const v of sim2.villagers) if (v.ally && !v.ally.leaving) {
    v.ally.leaving = true;
    v.ally.since = sim2.time;
    sim2.clearCombat(v);
    sim2.leaveSquad([v.id]);
    v.recall = false;
  }
}
function tickAllies(sim2) {
  const fire2 = sim2.campfire(), fx = fire2?.x ?? sim2.world.start.x, fy = fire2?.y ?? sim2.world.start.y;
  for (const v of [...sim2.villagers]) {
    if (!v.ally?.leaving) continue;
    const far = Math.hypot(v.x - fx, v.y - fy) > 30, watched = !!sim2.view && sim2.inView(v.x, v.y);
    if (far && !watched || sim2.time - v.ally.since > 240) {
      sim2.discharge([v.id]);
      sim2.vanish(v);
      continue;
    }
    if (!v.path.length) {
      const t = tribeOf(sim2, v.ally.tribe), toward = t ? Math.atan2(t.camp.y - fy, t.camp.x - fx) : sim2.frnd() * Math.PI * 2;
      sim2.orderMove([v.id], fx + Math.cos(toward) * 40, fy + Math.sin(toward) * 40);
    }
  }
}
function releaseRaiders(sim2, t) {
  for (const u of t.unitIds) {
    const f = sim2.get(u);
    if (f?.ai?.role === "raider") {
      f.ai.role = "guard";
      f.ai.raid = 0;
      f.fight.target = null;
      f.path = [];
    }
  }
}
function tickTribes(sim2, dt) {
  const war = warTribe(sim2);
  if (!war) {
    tickEvents(sim2);
    seasonEvent(sim2);
  }
  sim2.tribeClock += dt;
  if (sim2.tribeClock < 1) return;
  sim2.tribeClock = 0;
  refreshActive(sim2);
  tickAllies(sim2);
  for (const t of sim2.tribes) {
    if (war && t.id !== war) continue;
    t.unitIds = t.unitIds.filter((u) => {
      const f = sim2.get(u);
      return !!f && f.health > 0;
    });
    if (t.boss && !t.bossDown && t.state !== "free") {
      t.bossDown = true;
      t.bossDownAt = sim2.time;
      const left = sim2.tribes.filter((q) => q.boss && !q.bossDown).length;
      sim2.say(left ? `${t.def.name} \u0111\xE3 s\u1EE5p \u0111\u1ED5. C\xF2n ${left} th\u1EE7 l\u0129nh ph\u1EA3i h\u1EA1 tr\u01B0\u1EDBc khi sang th\u1EDDi Trung c\u1ED5.` : `Chuy\u1EC3n th\u1EDDi k\u1EF3! ${t.def.name} \u0111\xE3 s\u1EE5p \u0111\u1ED5, th\u1EE7 l\u0129nh cu\u1ED1i c\xF9ng: ta \u0111\xE3 c\xF3 th\u1EC3 n\xE2ng Nh\xE0 chung l\xEAn Nh\xE0 ch\xEDnh.`);
    }
    const hc = headcount(sim2, t);
    if (t.state !== "destroyed") tickLod(sim2, t, !!t.raid || war === t.id || sim2.plans.some((p) => p.kind === "attack" && p.status === "running" && p.tribe === t.id), tribeHostile(sim2, t.id));
    if (t.state === "free" && hc.guards + hc.civs === 0) {
      t.state = "destroyed";
      t.raid = null;
      sim2.say(`${t.def.name} \u0111\xE3 b\u1ECB x\xF3a s\u1ED5.`);
      if (t.harmed) {
        const got = claimVillage(sim2, t), a = takeVillage(sim2, t);
        sim2.say(`${t.def.name}: ta nh\u1EADn ${got.length ? got.join(", ") : "ch\u01B0a \u0111\u01B0\u1EE3c g\xEC t\u1EEB kho c\u1EE7a h\u1ECD"}; l\xE0ng ch\u1EE9a th\xEAm \u0111\u01B0\u1EE3c ${a.pop} d\xE2n v\xE0 m\u1ED7i tr\u1EA1i l\xEDnh th\xEAm ${a.slots} ch\u1ED7.`);
      }
      continue;
    }
    if (t.state === "tribute" && sim2.day >= t.nextTribute) payTribute(sim2, t);
    if (t.state !== "destroyed" && t.recoveredDay !== sim2.day && war !== t.id) {
      t.recoveredDay = sim2.day;
      recoverTribe(sim2, t, DIFF.capture.tribute.recoverPerDay);
    }
    if (!war) hostileRaid(sim2, t);
    if (t.state === "free") {
      advanceTribe(sim2, t);
      checkSurrender(sim2, t);
      manageRaid(sim2, t);
    }
  }
}
function checkSurrender(sim2, t) {
  if (sim2.plans.some((p) => p.kind === "attack" && p.status === "running" && p.tribe === t.id)) return;
  const units = t.unitIds.map((u) => sim2.get(u)).filter(Boolean), warriors = units.filter((u) => u.ai?.role !== "civ");
  if (SURRENDER.leaderDown && t.leaderDead && units.length + (t.crowd ? t.crowd.guards + t.crowd.civs : 0) > 0) return surrender(sim2, t, "Th\u1EE7 l\u0129nh \u0111\xE3 g\u1EE5c");
  const intruders = sim2.villagers.filter((v) => v.health > 0 && v.down <= 0 && Math.hypot(v.x - t.camp.x, v.y - t.camp.y) < 5).length;
  const defenders = warriors.filter((w) => Math.hypot(w.x - t.camp.x, w.y - t.camp.y) < 9).length;
  t.holdT = intruders > 0 && defenders === 0 && tribeHostile(sim2, t.id) ? t.holdT + 1 : 0;
  if (t.holdT >= SURRENDER.holdCampSeconds) return surrender(sim2, t, "\u0110\u1ED1ng l\u1EEDa c\u1EE7a h\u1ECD \u0111\xE3 b\u1ECB chi\u1EBFm");
}
function returnRebel(sim2, t) {
  const c = DIFF.capture;
  t.rebel = false;
  t.boss = false;
  t.bossDown = true;
  t.bossDownAt = sim2.time;
  t.tier = t.def.tier;
  t.state = "tribute";
  t.raid = null;
  t.relation = Math.max(t.relation, RELATION.tributeAt);
  t.tributeFree = c.rebel.returnBonus;
  t.tributeShare = c.tribute.baseShare + c.rebel.returnBonus;
  t.nextTribute = sim2.day + c.tribute.everyDays;
  rescaleTribe(sim2, t);
  releaseRaiders(sim2, t);
  sim2.say(`${t.def.name} b\u1ECB \u0111\xE1nh b\u1EA1i, kh\xF4ng c\xF2n l\xE0 th\u1EE7 l\u0129nh: h\u1ECD ch\u1ECBu c\u1ED1ng n\u1EA1p ${Math.round(t.tributeShare * 100)}% t\xFAi m\u1ED7i ${c.tribute.everyDays} ng\xE0y, kh\xF4ng b\u1ECB tr\u1EEB quan h\u1EC7.`);
}
function surrender(sim2, t, why) {
  if (t.rebel) {
    returnRebel(sim2, t);
    return;
  }
  t.state = "surrendered";
  t.raid = null;
  t.holdT = 0;
  t.angryUntil = 0;
  releaseRaiders(sim2, t);
  for (const u of t.unitIds) {
    const f = sim2.get(u);
    if (f) {
      f.fight.target = null;
      f.fleeT = 0;
      f.path = [];
      f.phase = "idle";
    }
  }
  sim2.pendingTribe = t.id;
  sim2.say(`${why}: ${t.def.name} xin h\xE0ng! Ch\u1ECDn thu n\u1EA1p ho\u1EB7c c\u1ED1ng n\u1EA1p.`);
}
function manageRaid(sim2, t) {
  const r = t.raid;
  if (!r) return;
  r.t += 1;
  const raiders = t.unitIds.map((u) => sim2.get(u)).filter((u) => u?.ai?.raid === r.id);
  const playerAlive = sim2.villagers.some((v) => v.health > 0);
  const over = r.night !== void 0 && r.night !== sim2.restTime;
  if (r.phase === "march" && (raiders.length === 0 || r.t > r.max || !playerAlive || over)) {
    r.phase = "retreat";
    if (raiders.length) sim2.say(`Qu\xE2n ${t.def.name} r\xFAt lui.`);
  }
  if (r.phase === "retreat") {
    const home = raiders.every((u) => Math.hypot(u.x - t.camp.x, u.y - t.camp.y) < 7);
    if (raiders.length === 0 || home || r.t > r.max + 120) {
      releaseRaiders(sim2, t);
      t.raid = null;
    }
  }
}
function raidAdvised(sim2, t, size) {
  const ours = sim2.villagers.filter((v) => v.job === "fight").length, theirs = Math.min(size, headcount(sim2, t).guards);
  return ours < 6 || theirs >= ours * 0.35;
}
function launchRaid(sim2, t, size, night) {
  wake(sim2, t);
  const inWorld = t.unitIds.filter((u) => sim2.get(u)?.ai?.role === "guard").length;
  if (size > inWorld) releaseCrowd(sim2, t, size - inWorld);
  const guards = t.unitIds.map((u) => sim2.get(u)).filter((u) => u?.ai?.role === "guard").sort((a, b) => b.maxHealth - a.maxHealth);
  const n = Math.min(size, guards.length);
  if (n < 3 || t.raid) return;
  const id = ++sim2.nextRaid;
  t.raid = { id, phase: "march", t: 0, max: night === void 0 ? 200 : 99999, size: n, night };
  const ours = sim2.villagers.filter((v) => v.job === "fight"), oursArch = ours.filter((v) => armOfWeapon(v.weapon) === "archer").length, wantArch = ours.length >= 4 && oursArch * 2 <= ours.length ? Math.floor(n / 3) : 0;
  const melee = t.def.weapons.filter((w) => !WEAPONS[w]?.ranged), picks = guards.slice(0, n);
  picks.forEach((g, i) => {
    g.ai.role = "raider";
    g.ai.raid = id;
    g.fight.target = null;
    g.path = [];
    g.fleeT = 0;
    if (!g.weapon?.startsWith("bronze")) g.weapon = i < wantArch ? i % 2 ? "sling" : "bow" : melee[i % Math.max(1, melee.length)] ?? g.weapon;
  });
  t.angryUntil = sim2.time + 400;
  const arch = picks.filter((g) => armOfWeapon(g.weapon) === "archer").length;
  sim2.say(`Qu\xE2n ${t.def.name} (${n} ng\u01B0\u1EDDi${sim2.mapLevel(t.id) >= 3 ? `: ${arch} cung th\u1EE7, ${n - arch} b\u1ED9 binh` : ""}) \u0111ang ti\u1EBFn v\xE0o l\xE0ng!`);
}
function launchCustomRaid(sim2, t, weapons, armor, angers = true, night) {
  const fire2 = sim2.campfire(), fx = fire2 ? fire2.x + 1 : sim2.world.start.x, fy = fire2 ? fire2.y + 1 : sim2.world.start.y;
  const dx = t.camp.x - fx, dy = t.camp.y - fy, len = Math.max(1, Math.hypot(dx, dy)), dist = Math.min(26, len);
  const id = ++sim2.nextRaid;
  if (angers) t.relation = Math.min(t.relation, -60);
  t.raid = { id, phase: "march", t: 0, max: night === void 0 ? 900 : 99999, size: weapons.length, night };
  weapons.forEach((weapon, i) => {
    const ang = i / weapons.length * Math.PI * 2, gx = Math.floor(fx + dx / len * dist + Math.cos(ang) * 2), gy = Math.floor(fy + dy / len * dist + Math.sin(ang) * 2);
    const spot2 = sim2.nearestFree(gx, gy, /* @__PURE__ */ new Set()) ?? [gx, gy];
    const f = sim2.makeVillager(spot2[0], spot2[1], sim2.frnd() < 0.5 ? "m" : "f", t.id, sim2.frnd);
    f.look.hide = t.def.look.hide;
    f.look.pants = t.def.look.pants;
    f.weapon = weapon;
    f.armor = armor ? "hide" : null;
    f.ai = { role: "raider", camp: t.camp, wander: 0, goal: null, raid: id };
    sim2.addFoe(f);
    t.unitIds.push(f.id);
    applyStats(sim2, f);
    f.health = f.maxHealth;
  });
  t.angryUntil = sim2.time + 400;
  sim2.say(`Qu\xE2n ${t.def.name} (${weapons.length} ng\u01B0\u1EDDi) \u0111ang ti\u1EBFn v\xE0o l\xE0ng!`);
}
function launchBeasts(sim2, size, species = "wolf", night) {
  const fire2 = sim2.campfire(), s = sim2.world.start, cx = fire2 ? fire2.x + 1 : s.x, cy = fire2 ? fire2.y + 1 : s.y;
  let placed = 0;
  const ang0 = sim2.frnd() * Math.PI * 2;
  for (let tries = 0; tries < 80 && placed < size; tries++) {
    const a = ang0 + (sim2.frnd() - 0.5) * 0.8, d = 26 + sim2.frnd() * 6;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, tx = Math.floor(x), ty = Math.floor(y);
    if (!sim2.world.inBounds(tx, ty) || sim2.world.isBlocked(tx, ty)) continue;
    const w = spawnAnimal(sim2, species, x, y, 9e3 + sim2.nextRaid, true, night);
    w.state = "graze";
    w.timer = 0;
    placed++;
  }
  sim2.nextRaid++;
  if (placed) sim2.say(`${species === "wolf" ? "B\u1EA7y s\xF3i \u0111\xF3i" : `${ANIMALS[species].name} (${placed} con)`} k\xE9o t\u1EDBi quanh l\xE0ng! \u0110\u1ED1t l\u1EEDa v\xE0 gi\u1EEF d\xE2n g\u1EA7n \u0111\u1ED1ng l\u1EEDa.`);
}
var armyWeapons = (army3) => Object.entries(army3).flatMap(([w, n]) => Array.from({ length: n }, () => w));
function initEvents(sim2, from = 0) {
  for (const e of events_default.events) {
    const fireDay = from + e.day + Math.floor(sim2.frnd() * (e.spread + 1)), size = e.army ? armyWeapons(e.army).length : e.size ?? 1;
    sim2.events.push({ id: e.id, kind: e.kind, tribe: e.tribe, species: e.species, army: e.army, armor: e.armor, power: e.power, fireDay, warnDay: fireDay - (e.warnDays ?? 1), size, night: e.night, warn: e.warn, warned: !e.warn, fired: false });
  }
}
function raidSizeFor(sim2, t, ratio2) {
  wake(sim2, t);
  const me = sim2.power(), tp = sim2.tribePower(t), want = raidPower(me.military, ratio2, fireLevelOf(sim2)), each = tp.soldiers > 0 ? tp.military / tp.soldiers : 1;
  return Math.max(3, Math.ceil(want / Math.max(0.01, each)));
}
function seasonEvent(sim2) {
  const c = events_default.recurring;
  if (sim2.day < c.fromDay || sim2.day < sim2.nextEventDay) return;
  sim2.nextEventDay = sim2.day + c.everyDays;
  for (let i = sim2.events.length - 1; i >= 0; i--) if (sim2.events[i].fired && sim2.events[i].fireDay < sim2.day - 20) sim2.events.splice(i, 1);
  const foes = sim2.tribes.filter(raidsUs);
  const table = c.table.filter((x) => x.kind !== "raid" || foes.length > 0), total = table.reduce((a, x) => a + x.weight, 0);
  let pick2 = sim2.frnd() * total, row = table[0];
  for (const x of table) {
    pick2 -= x.weight;
    if (pick2 <= 0) {
      row = x;
      break;
    }
  }
  const fireDay = sim2.day + c.leadDays[0] + Math.floor(sim2.frnd() * (c.leadDays[1] - c.leadDays[0] + 1)), night = sim2.frnd() < c.nightChance;
  const soldiers = sim2.villagers.filter((v) => v.job === "fight" && !v.ally).length;
  if (row.kind === "raid") {
    const t = foes[Math.floor(sim2.frnd() * foes.length)];
    sim2.events.push({ id: `season${sim2.day}`, kind: "raid", tribe: t.id, power: row.power, fireDay, warnDay: fireDay - 1, size: 4, night, warn: `${row.warn} (${t.def.name})`, warned: false, fired: false });
  } else {
    const size = Math.max(1, Math.min(row.max ?? 99, Math.round((row.base ?? 1) + (row.perSoldier ?? 0) * soldiers)));
    sim2.events.push({ id: `season${sim2.day}`, kind: "beasts", species: row.species, fireDay, warnDay: fireDay - 1, size, night, warn: row.warn, warned: false, fired: false });
  }
}
function raidsUs(t) {
  return t.state === "free" && !t.raid && t.relation < events_default.hostile.raidBelow && (t.rebel || t.def.personality !== "peaceful" || t.relation < HOSTILE_BELOW);
}
function hostileRaid(sim2, t) {
  const h = events_default.hostile;
  if (sim2.day < h.fromDay || !raidsUs(t)) return;
  t.nextRaidDay ??= sim2.day + 1 + Math.floor(sim2.frnd() * h.raidEveryDays);
  if (sim2.day < t.nextRaidDay) return;
  const size = raidSizeFor(sim2, t, h.power[t.tier] ?? 0.5);
  if (!raidAdvised(sim2, t, size)) {
    t.nextRaidDay = sim2.day + 1;
    return;
  }
  t.nextRaidDay = sim2.day + h.raidEveryDays;
  launchRaid(sim2, t, size);
}
function tickEvents(sim2) {
  for (const e of sim2.events) {
    if (e.fired) continue;
    if (e.kind === "raid" && e.power !== void 0 && e.tribe && e.sizeDay !== sim2.day) {
      const t = tribeOf(sim2, e.tribe);
      if (t && t.state === "free") {
        e.size = raidSizeFor(sim2, t, e.power);
        e.sizeDay = sim2.day;
      }
    }
    if (!e.warned && sim2.day >= e.warnDay && sim2.tod >= 0.3) {
      e.warned = true;
      sim2.say(e.warn);
    }
    if (sim2.day < e.fireDay) continue;
    const ready = e.night ? sim2.restTime : sim2.tod >= 0.28 && !sim2.restTime;
    if (!ready) continue;
    e.fired = true;
    if (e.kind === "beasts") launchBeasts(sim2, e.size, e.species ?? "wolf", e.night);
    else if (e.tribe) {
      const t = tribeOf(sim2, e.tribe);
      if (t && t.state === "free" && t.relation < DIFF.capture.gift.friendAt) {
        if (raidAdvised(sim2, t, e.size) || e.fireDay >= e.warnDay + 4) e.army ? launchCustomRaid(sim2, t, armyWeapons(e.army), e.armor ?? true, false, e.night) : launchRaid(sim2, t, e.size, e.night);
        else {
          e.fired = false;
          e.fireDay = sim2.day + 1;
          e.warned = true;
          sim2.say(`${t.def.name} th\u1EA5y l\xE0ng \u0111\xF4ng qu\xE2n v\xE0 ho\xE3n t\u1EADp k\xEDch.`);
        }
      }
    }
  }
}
function advanceTribe(sim2, t) {
  if (t.seenFire !== fireLevelOf(sim2) || t.popLevel !== t.campLevel) followFire(sim2, t);
  if (t.seenDay !== sim2.day) {
    t.seenDay = sim2.day;
    rescaleTribe(sim2, t);
  } else if (t.seenFire !== fireLevelOf(sim2)) rescaleTribe(sim2, t);
}
function foeBonus(sim2, team, stat) {
  const t = tribeOf(sim2, team);
  if (!t) return 0;
  return stat === "hp" || stat === "atk" || stat === "defm" || stat === "defr" ? (t.mil ?? 0) * 100 : stat === "work" ? (t.eco ?? 0) * 100 : 0;
}

// src/sim/brainfoe.ts
var { aggro: AGGRO, leash: LEASH } = FOE;
function wander(sim2, f, radius) {
  const ai = f.ai;
  for (let i = 0; i < 6; i++) {
    const a = sim2.frnd() * Math.PI * 2, r = 1.5 + sim2.frnd() * radius;
    const g = sim2.nearestFree(Math.floor(ai.camp.x + Math.cos(a) * r), Math.floor(ai.camp.y + Math.sin(a) * r), /* @__PURE__ */ new Set());
    if (g) {
      f.path = sim2.pathTo(f, g[0], g[1], 2500);
      f.phase = f.path.length ? "move" : "idle";
      break;
    }
  }
  ai.wander = 4 + sim2.frnd() * 8;
}
var emptyCache = /* @__PURE__ */ new WeakMap();
function nobodyOutside(sim2) {
  const c = emptyCache.get(sim2);
  if (c && c.t === sim2.time) return c.on;
  const on = !sim2.villagers.some((v) => v.team === "player" && v.health > 0 && v.down <= 0 && v.inside === null);
  emptyCache.set(sim2, { t: sim2.time, on });
  return on;
}
function tickFoe(sim2, f, dt) {
  tickCommon(sim2, f, dt);
  const t = tribeOf(sim2, f.team), ai = f.ai;
  if (ai && ai.role === "raider" && !ai.siege && !f.fight.target && f.phase !== "fight" && Math.floor(sim2.time) !== Math.floor(sim2.time - dt) && (Math.floor(sim2.time) + f.id) % 2 === 0 && nobodyOutside(sim2)) {
    const house = sim2.nearestWork(f.x, f.y, 70, true);
    if (house) ai.siege = house.id;
  }
  if (ai?.life && ai.life.kind !== "hunt" && (f.phase === "flee" || f.fleeT > 0 || f.fight.target)) endLife(sim2, f);
  if (t && ai) foeBrain(sim2, f, t, ai, dt);
  sim2.moveUnit(f, dt);
  sim2.animate(f, dt);
}
function foeBrain(sim2, f, t, ai, dt) {
  const free = t.state === "free";
  const tower = ai.tower ? towerOf(sim2, t, ai) : null;
  if (ai.tower && !tower) {
    ai.tower = void 0;
    ai.post = void 0;
    f.inTent = false;
  }
  f.fight.scan -= dt;
  const reach = tribeReach(t), willing = tribeWilling(sim2, t.id);
  const radius = tower ? tower.reach : ai.role === "raider" ? FOE.raiderSight : ai.role === "civ" ? FOE.civSight : Math.max(AGGRO[t.def.personality], willing ? Math.min(reach, FOE.willingReach) : 0);
  const scanNow = f.fight.scan <= 0;
  if (scanNow) f.fight.scan = 0.4;
  const looking = scanNow || f.phase === "flee" || f.phase === "fight" && !f.fight.target;
  const cx = tower ? tower.p.x + tower.p.w / 2 : f.x, cy = tower ? tower.p.y + tower.p.h / 2 : f.y, off = Math.hypot(f.x - cx, f.y - cy);
  const found = free && looking ? threatsOf(sim2, f, radius + off).filter((x) => !(ai.skip && sim2.time < ai.skip.until && x.t.kind === "unit" && x.t.id === ai.skip.id) && (tower || ai.role !== "guard" || Math.hypot(x.x - ai.camp.x, x.y - ai.camp.y) <= reach + 3 || x.d < AGGRO[t.def.personality])) : [];
  const threats = tower ? found.map((x) => ({ ...x, d: Math.hypot(x.x - cx, x.y - cy) })).filter((x) => x.d <= radius).sort((a, b) => a.d - b.d) : found;
  if (!free) {
    f.fight.target = null;
    if (f.phase === "fight") {
      f.phase = "idle";
      f.path = [];
    }
  }
  if (civilianBrain(sim2, f, t, ai, dt, free, scanNow, threats)) return;
  if (f.phase === "flee") {
    f.phase = "idle";
    f.path = [];
  }
  if (free && ai.harass !== void 0 && harassBrain(sim2, f, dt, threats)) return;
  if (free && ai.siege && ai.role !== "civ") {
    const sb = sim2.getBuilding(ai.siege);
    if (!sb || Math.hypot(sb.x - f.x, sb.y - f.y) > 45) ai.siege = 0;
    else if (siegeBrain(sim2, f, ai, dt, threats)) return;
  }
  if (free && tower && ai.post) {
    towerBrain(sim2, f, ai, tower, willing, threats);
    return;
  }
  if (free && ai.role === "raider" && t.raid) {
    raiderBrain(sim2, f, t, ai, dt, threats);
    return;
  }
  if (free && f.fight.target) {
    const e = resolve(sim2, f.fight.target);
    if (e && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) < Math.max(LEASH, reach + 2)) {
      engage(sim2, f, e, dt);
      return;
    }
    f.fight.target = null;
    f.phase = "idle";
    f.path = [];
  }
  if (free && ai.role === "guard" && threats.length && willing) {
    f.fight.target = threats[0].t;
    return;
  }
  if (free && ai.role === "guard" && ai.post && !f.fight.target) {
    keepPost(sim2, f, ai);
    return;
  }
  if (free && ai.role !== "raider" && lifeBrain(sim2, f, t, ai, dt)) return;
  if (f.phase === "fight") {
    f.phase = "idle";
    f.path = [];
  }
  ai.wander -= dt;
  if (ai.wander <= 0 && !f.path.length) wander(sim2, f, ai.role === "civ" ? FOE.wanderRadius.civ : t.def.personality === "aggressive" ? FOE.wanderRadius.aggressive : FOE.wanderRadius.other);
  if (f.phase === "move" && !f.path.length) f.phase = "idle";
}

// src/sim/quests.ts
var QUESTS = quests_default.quests;
var CHAPTERS = quests_default.chapters;
function measure(sim2, d, ui) {
  const yes = (b) => [b ? 1 : 0, 1];
  switch (d.type) {
    case "buildBuilding":
      return [sim2.buildings.filter((b) => b.kind === d.kind && b.done).length, d.count];
    case "upgradeBuilding":
      return yes(sim2.buildings.some((b) => b.kind === d.kind && b.done && b.level >= d.level));
    case "upgradeFire":
      return yes(sim2.fireLevel() >= d.level);
    case "fireReady":
      return yes(sim2.fireUpgradeBlock(d.level) === null);
    case "researchTech":
      return yes(sim2.researched.has(d.id));
    case "population":
      return [sim2.villagers.length, d.count];
    case "stock":
      return [Math.floor(sim2.stock[d.res] + (d.res === "food" ? sim2.foodPot : 0)), d.count];
    case "hasRole":
      return [sim2.villagers.filter((v) => roleOf(v) === d.role).length, d.count];
    case "jobCount":
      return [sim2.villagers.filter((v) => v.job === d.job).length, d.count];
    case "staffIn":
      return [sim2.buildings.filter((b) => b.kind === d.kind).reduce((n, b) => n + b.staff.length, 0), d.count];
    case "haveTool":
      return [sim2.toolCount(d.kind, d.tier), d.count];
    case "torches":
      return [sim2.torchCount(), d.count];
    case "createSquad":
      return [sim2.squads.length, d.count];
    case "daytime":
      return yes(sim2.day >= d.day && sim2.part === "day");
    case "speed":
      return yes(sim2.speed >= d.atLeast);
    case "selectBuilding":
      return yes(ui.selected === d.kind || ui.panel === d.kind);
    case "openBuilding":
      return yes(ui.panel === d.kind);
    case "inspectNode":
      return yes(ui.inspecting === "node");
    case "inspectUnit":
      return yes(ui.inspecting === "unit");
    case "inspectAnimal":
      return yes(ui.inspecting === "animal");
    case "squadSize":
      return [Math.max(0, ...sim2.squads.map((q) => q.ids.length)), d.count];
    case "squadFormation":
      return yes(sim2.squads.some((q) => q.formation === d.id));
    case "equipped":
      return [sim2.villagers.filter((v) => v.team === "player" && v.job === "fight" && (d.slot === "weapon" ? v.gear.w : v.gear.a) !== null).length, d.count];
    case "scoutSent":
      return yes(sim2.scouts.length > 0 || sim2.maps.length > 0);
    case "hasMap":
      return yes(sim2.maps.some((m) => m.level >= d.level));
    case "planDefense":
      return yes(sim2.plans.some((pl) => pl.kind === "defense"));
    case "planArrow":
      return yes(sim2.plans.some((pl) => pl.kind === "attack" && pl.missions.some((m) => m.path.length > 0)));
    case "planRunning":
      return yes(sim2.plans.some((pl) => pl.kind === "attack" && (pl.status === "running" || pl.status === "done")));
    case "planDone":
      return yes(sim2.plans.some((pl) => pl.status === "done" && (!d.result || pl.result === d.result)));
  }
}
function questViews(sim2, ui) {
  const WAR_ONLY = ["scoutSent", "hasMap", "planDefense", "planArrow", "createSquad", "squadSize", "squadFormation"];
  const shut = (q) => "kind" in q.done && typeof q.done.kind === "string" && eraLocked(q.done.kind, sim2) || sim2.era !== "ancient" && (WAR_ONLY.includes(q.done.type) || q.done.type === "researchTech" && /^(signal|form_)/.test(q.done.id));
  for (const q of QUESTS) if (!sim2.questSeen.has(q.id) && q.after.every((a) => sim2.questSeen.has(a))) {
    const [have2, need] = measure(sim2, q.done, ui);
    if (have2 >= need || shut(q)) sim2.questSeen.add(q.id);
  }
  return QUESTS.map((quest) => {
    const done = sim2.questSeen.has(quest.id), open2 = !done && quest.after.every((a) => sim2.questSeen.has(a));
    let progress2 = "";
    if (open2) {
      const d = quest.done, [have2, need] = measure(sim2, d, ui);
      if (d.type === "fireReady" || d.type === "upgradeFire") progress2 = sim2.fireUpgradeBlock(d.level - 1) ?? "";
      else if (need > 1) progress2 = `${Math.min(have2, need)}/${need}`;
    }
    return { quest, done, open: open2, progress: progress2 };
  });
}

// src/data/start.json
var start_default = {
  _note: "Kh\u1EDFi \u0111\u1EA7u m\u1ED9t v\xE1n. campfire: v\u1ECB tr\xED \u0111\u1ED1ng l\u1EEDa so v\u1EDBi \u0111i\u1EC3m xu\u1EA5t ph\xE1t. stock: t\xE0i nguy\xEAn c\xF3 s\u1EB5n (kh\xF3a nh\u01B0 trong kho). villagers: d\xE2n c\xF3 m\u1EB7t t\u1EEB \u0111\u1EA7u (dx, dy so v\u1EDBi \u0111i\u1EC3m xu\u1EA5t ph\xE1t; sex 'm'/'f'; job l\xE0 ngh\u1EC1). buildings: c\xF4ng tr\xECnh d\u1EF1ng s\u1EB5n quanh \u0111\u1ED1ng l\u1EEDa, theo th\u1EE9 t\u1EF1. arrivals: m\u1ED7i ng\xE0y m\u1EDBi (t\u1EEB ng\xE0y firstDay) c\xF3 min..max ng\u01B0\u1EDDi l\u1EA1 t\u1EDBi xin \u1EDF, femaleChance = x\xE1c su\u1EA5t l\xE0 n\u1EEF.",
  campfire: { dx: -1, dy: -2 },
  stock: { food: 30, wood: 10 },
  villagers: [
    { dx: -1, dy: 1, sex: "m", job: "idle" },
    { dx: 0, dy: 1, sex: "m", job: "idle" },
    { dx: 1, dy: 1, sex: "f", job: "idle" }
  ],
  buildings: ["builder"],
  arrivals: { firstDay: 2, min: 2, max: 4, femaleChance: 0.5 }
};

// src/sim/works.ts
function orderDef(sim2, kind, id) {
  if (kind === "research") {
    const t = TECH_BY_ID[id];
    return t ? { cost: t.cost, time: t.time } : null;
  }
  const r = RECIPE_BY_ID[id];
  if (!r) return null;
  return { cost: r.cost, time: r.time };
}
function levelOfKind(sim2, kind) {
  return sim2.building(kind)?.level ?? 0;
}
function workshopLevel(sim2) {
  return levelOfKind(sim2, "workshop");
}
var craftMult = (sim2) => 1 + CRAFT_COST_PER_LEVEL * Math.max(0, workshopLevel(sim2) - 1);
var scaleCost = (cost, m) => Object.fromEntries(Object.entries(cost).map(([r, n]) => [r, Math.max(1, Math.ceil(n * m - 1e-9))]));
var craftCost = (sim2, id) => scaleCost(RECIPE_BY_ID[id].cost, craftMult(sim2));
function recipeLock(sim2, id) {
  if (!RESEARCH.enabled || sim2.dev.freeWorks) return null;
  if (!recipeOpen(sim2.researched, id)) return `Ch\u01B0a c\xF3 b\u1EA3n v\u1EBD: ${techForRecipe(id)?.name.replace(/^Bản vẽ /, "") ?? "?"}`;
  const need = recipeNeedLevel(id);
  if (workshopLevel(sim2) < need) return `C\u1EA7n Nh\xE0 ch\u1EBF t\u1EA1o c\u1EA5p ${need}`;
  return null;
}
function recipeOpen2(sim2, id) {
  return recipeLock(sim2, id) === null;
}
function techState(sim2, t) {
  if (sim2.researched.has(t.id)) return { state: "done" };
  if (sim2.building("lab")?.active?.id === t.id) return { state: "active" };
  if (sim2.researchQueue.includes(t.id)) return { state: "queued" };
  const free = sim2.dev.freeWorks;
  const lacks = free ? [] : t.requires.filter((r) => !sim2.researched.has(r)).map((r) => `C\u1EA7n nghi\xEAn c\u1EE9u: ${TECH_BY_ID[r].name}`);
  const lab = sim2.building("lab");
  if (!lab) lacks.push("C\u1EA7n d\u1EF1ng Nh\xE0 nghi\xEAn c\u1EE9u");
  else if (!free && lab.level < t.needLevel) lacks.push(`C\u1EA7n Nh\xE0 nghi\xEAn c\u1EE9u c\u1EA5p ${t.needLevel}`);
  if (lacks.length) return { state: "locked", why: lacks.join(" \xB7 "), lacks };
  return { state: "ready" };
}
function researchBlock(sim2, t) {
  const lab = sim2.building("lab");
  if (!lab || !lab.staff.length && !sim2.dev.freeWorks) return "Ch\u01B0a c\xF3 ng\u01B0\u1EDDi l\xE0m vi\u1EC7c trong Nh\xE0 nghi\xEAn c\u1EE9u";
  return null;
}
function currentResearch(sim2) {
  return sim2.building("lab")?.active?.id ?? sim2.researchQueue[0] ?? null;
}
function queueResearch(sim2, id) {
  const t = TECH_BY_ID[id];
  if (!t) return "Kh\xF4ng c\xF3 nghi\xEAn c\u1EE9u n\xE0y";
  if (!RESEARCH.enabled) return "Nghi\xEAn c\u1EE9u \u0111ang t\u1EAFt";
  const st = techState(sim2, t);
  if (st.state === "done") return "\u0110\xE3 nghi\xEAn c\u1EE9u r\u1ED3i";
  if (st.state === "active" || st.state === "queued") return "\u0110ang nghi\xEAn c\u1EE9u";
  const cur = currentResearch(sim2);
  if (cur) return `\u0110ang nghi\xEAn c\u1EE9u ${TECH_BY_ID[cur]?.name ?? cur}: xong r\u1ED3i m\u1EDBi nghi\xEAn c\u1EE9u ti\u1EBFp`;
  if (st.state === "locked") return st.why ?? "Ch\u01B0a nghi\xEAn c\u1EE9u \u0111\u01B0\u1EE3c";
  const short = researchShort(sim2, t);
  if (short) return short;
  if (!sim2.dev.freeWorks) sim2.pay(t.cost);
  sim2.researchQueue.push(id);
  return null;
}
function researchShort(sim2, t) {
  return sim2.dev.freeWorks ? null : sim2.missing(t.cost);
}
function discardGoods(sim2, id, all) {
  const n = sim2.toolStock[id] ?? 0, worn = sim2.wornTools.filter((w) => w.id === id);
  if (n <= 0 && !worn.length) return "Kho kh\xF4ng c\xF3 m\xF3n n\xE0y";
  if (all) {
    sim2.toolStock[id] = 0;
    for (let i = sim2.wornTools.length - 1; i >= 0; i--) if (sim2.wornTools[i].id === id) sim2.wornTools.splice(i, 1);
  } else if (worn.length) {
    worn.sort((a, b) => a.dur - b.dur);
    sim2.wornTools.splice(sim2.wornTools.indexOf(worn[0]), 1);
  } else sim2.toolStock[id] = n - 1;
  return null;
}
var catOf = (id) => isGear(RECIPE_BY_ID[id].kind) ? "gear" : "tool";
function storeRoom(sim2, cat) {
  const bench = sim2.building("workshop")?.active, coming = sim2.craftQueue.filter((id) => RECIPE_BY_ID[id] && catOf(id) === cat).length + (bench && RECIPE_BY_ID[bench.id] && catOf(bench.id) === cat ? 1 : 0);
  return storeCap(sim2, cat) - storeUsed(sim2, cat) - coming;
}
function craftStoreBlock(sim2, id) {
  const r = RECIPE_BY_ID[id];
  if (!r) return null;
  const cat = catOf(id);
  return storeRoom(sim2, cat) > 0 ? null : cat === "tool" ? "Kho c\xF4ng c\u1EE5 \u0111\xE3 \u0111\u1EA7y: n\xE2ng c\u1EA5p kho ho\u1EB7c d\xF9ng b\u1EDBt \u0111\u1ED3" : "Kho v\u0169 kh\xED \u0111\xE3 \u0111\u1EA7y: n\xE2ng c\u1EA5p kho ho\u1EB7c d\xF9ng b\u1EDBt \u0111\u1ED3";
}
function queueCraft(sim2, id) {
  const r = RECIPE_BY_ID[id];
  if (!r) return "C\xF4ng th\u1EE9c kh\xF4ng t\u1ED3n t\u1EA1i";
  if (!sim2.hasWorkshop()) return "C\u1EA7n d\u1EF1ng Nh\xE0 ch\u1EBF t\u1EA1o tr\u01B0\u1EDBc";
  const lock = recipeLock(sim2, id);
  if (lock) return lock;
  const full = craftStoreBlock(sim2, id);
  if (full) return full;
  if (sim2.craftQueue.length >= 12) return "H\xE0ng \u0111\u1EE3i \u0111\xE3 \u0111\u1EA7y";
  const mult = craftMult(sim2);
  if (!sim2.dev.freeWorks) {
    const cost = scaleCost(r.cost, mult), short = sim2.missing(cost);
    if (short) return short;
    sim2.pay(cost);
  }
  sim2.craftQueue.push(id);
  sim2.craftPaid.push(mult);
  return null;
}
function unqueue(sim2, queue, id) {
  const i = queue.lastIndexOf(id);
  if (i >= 0) queue.splice(i, 1);
}
function unqueueCraft(sim2, id) {
  const r = RECIPE_BY_ID[id], i = sim2.craftQueue.lastIndexOf(id);
  if (!r || i < 0) return;
  if (!sim2.dev.freeWorks) sim2.pay(scaleCost(r.cost, sim2.craftPaid[i] ?? 1), 1);
  sim2.craftQueue.splice(i, 1);
  sim2.craftPaid.splice(i, 1);
}
function unqueueResearch(sim2, id) {
  const t = TECH_BY_ID[id];
  if (t && sim2.researchQueue.includes(id) && !sim2.dev.freeWorks) sim2.pay(t.cost, 1);
  unqueue(sim2, sim2.researchQueue, id);
}
function storeUsed(sim2, cat) {
  return (cat === "tool" ? sim2.wornTools.length : 0) + Object.entries(sim2.toolStock).reduce((n, [id, c]) => n + ((RECIPE_BY_ID[id] && isGear(RECIPE_BY_ID[id].kind)) === (cat === "gear") ? c : 0), 0);
}
function storeCap(sim2, cat) {
  const b = sim2.building(cat === "tool" ? "toolstore" : "armory");
  return b ? levelDef(b).cap : 10;
}
function tickWorks(sim2, dt) {
  for (const b of sim2.buildings) {
    if (!b.done || b.kind !== "lab" && b.kind !== "workshop") continue;
    const kind = b.kind === "lab" ? "research" : "craft";
    const queue = kind === "research" ? sim2.researchQueue : sim2.craftQueue;
    const staff2 = b.staff.map((id2) => sim2.byId.get(id2)).filter((v) => !!v && v.phase === "inside");
    if (!staff2.length && !sim2.dev.freeWorks) continue;
    if (!b.active) {
      const i = queue.findIndex((id3) => {
        const d2 = orderDef(sim2, kind, id3);
        if (!d2) return false;
        if (kind === "craft") return recipeOpen2(sim2, id3);
        return true;
      });
      if (i < 0) {
        if (queue.length && sim2.time - sim2.lastMatWarn > 30) {
          sim2.lastMatWarn = sim2.time;
          sim2.say(kind === "research" ? "Nghi\xEAn c\u1EE9u \u0111ang ch\u1EDD." : "\u0110\u01A1n \u0111ang ch\u1EDD: ch\u01B0a ch\u1EBF \u0111\u01B0\u1EE3c (thi\u1EBFu b\u1EA3n v\u1EBD ho\u1EB7c Nh\xE0 ch\u1EBF t\u1EA1o ch\u01B0a \u0111\u1EE7 c\u1EA5p).");
        }
        continue;
      }
      const id2 = queue[i];
      queue.splice(i, 1);
      b.active = { id: id2, progress: 0, paid: kind === "craft" ? sim2.craftPaid.splice(i, 1)[0] ?? 1 : void 0 };
    }
    const d = orderDef(sim2, kind, b.active.id);
    if (!d) {
      b.active = null;
      continue;
    }
    const job = kind;
    let rate = 0;
    for (const v of staff2) {
      rate += sim2.workFactor(v, job);
      sim2.gainXp(v, job, dt);
    }
    b.active.progress = sim2.dev.fastWorks ? 1 : Math.min(1, b.active.progress + dt * sim2.paceWork * rate * levelDef(b).craftSpeed / d.time);
    if (b.active.progress < 1) continue;
    const id = b.active.id;
    if (kind === "research") {
      sim2.researched.add(id);
      b.active = null;
      sim2.say(`Nh\xE0 nghi\xEAn c\u1EE9u \u0111\xE3 ho\xE0n th\xE0nh "${TECH_BY_ID[id].name}".`);
    } else {
      const r = RECIPE_BY_ID[id], cat = isGear(r.kind) ? "gear" : "tool";
      if (storeUsed(sim2, cat) >= storeCap(sim2, cat)) {
        if (sim2.time - sim2.lastFullWarn > 30) {
          sim2.lastFullWarn = sim2.time;
          sim2.say(cat === "tool" ? "Kho c\xF4ng c\u1EE5 \u0111\xE3 \u0111\u1EA7y, s\u1EA3n ph\u1EA9m ch\u1EDD ch\u1ED7." : "Kho v\u0169 kh\xED \u0111\xE3 \u0111\u1EA7y, s\u1EA3n ph\u1EA9m ch\u1EDD ch\u1ED7.");
        }
        continue;
      }
      sim2.toolStock[id] = (sim2.toolStock[id] ?? 0) + 1;
      b.active = null;
      sim2.say(`\u0110\xE3 ch\u1EBF xong ${recipeName(r).toLowerCase()}.`);
    }
  }
}

// src/sim/construction.ts
function addBuilding(sim2, kind, x, y, done, level = 1) {
  const d = BUILDINGS[kind];
  const b = { id: sim2.nextBid++, kind, era: sim2.era, x, y, level, progress: done ? 1 : 0, done, upgrading: false, rebuild: false, hp: 0, open: kind !== "gate", staff: [], active: null, workers: 0 };
  b.hp = maxHp(b);
  sim2.buildings.push(b);
  setOcc(sim2, b, 1);
  return b;
}
function placeStarters(sim2) {
  const s = sim2.world.start;
  for (const kind of start_default.buildings) {
    let done = false;
    for (let r = 4; r < 16 && !done; r++) for (let dx = -r; dx <= r && !done; dx++) for (let dy = -r; dy <= r && !done; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = s.x + dx, y = s.y + dy;
      if (footprintError(sim2, kind, x, y) === null) {
        addBuilding(sim2, kind, x, y, true);
        done = true;
      }
    }
  }
}
function inTerritory(sim2, x, y, ignore) {
  for (const b of sim2.buildings) {
    if (b === ignore || !b.done) continue;
    const r = buildingSight(b);
    if (r > 0 && Math.hypot(b.x + BUILDINGS[b.kind].w / 2 - x, b.y + BUILDINGS[b.kind].h / 2 - y) <= r) return true;
  }
  return false;
}
function footprintError(sim2, kind, x, y, ignore) {
  const d = BUILDINGS[kind], w = sim2.world, N = w.size;
  const own = (tx, ty) => !!ignore && tx >= ignore.x && tx < ignore.x + d.w && ty >= ignore.y && ty < ignore.y + d.h;
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
    const tx = x + i, ty = y + j;
    if (!w.inBounds(tx, ty)) return "Ngo\xE0i b\u1EA3n \u0111\u1ED3";
    const k = ty * N + tx;
    if (sim2.fog.state[k] === 0) return "Ch\u01B0a kh\xE1m ph\xE1";
    const t = w.tiles[k];
    if (t !== 0 && t !== 4 || w.occ[k] && !own(tx, ty)) return "V\u01B0\u1EDBng c\xE2y, \u0111\xE1, n\u01B0\u1EDBc ho\u1EB7c c\xF4ng tr\xECnh";
  }
  if (!inTerritory(sim2, x + d.w / 2, y + d.h / 2, ignore)) return "Ngo\xE0i \u0111\u1EA5t c\u1EE7a l\xE0ng: ch\u1EC9 x\xE2y trong t\u1EA7m nh\xECn c\u1EE7a \u0111\u1ED1ng l\u1EEDa ho\u1EB7c m\u1ED9t c\xF4ng tr\xECnh";
  if (!WALL_KINDS.has(kind)) for (const o of sim2.buildings) {
    if (o === ignore || WALL_KINDS.has(o.kind)) continue;
    const od = BUILDINGS[o.kind], gx = Math.max(x - (o.x + od.w), o.x - (x + d.w)), gy = Math.max(y - (o.y + od.h), o.y - (y + d.h));
    if (Math.max(gx, gy) < CLEARANCE) return `C\u1EA7n ch\u1EEBa \xEDt nh\u1EA5t ${CLEARANCE} \xF4 tr\u1ED1ng gi\u1EEFa c\xE1c c\xF4ng tr\xECnh \u0111\u1EC3 d\xE2n \u0111i l\u1EA1i`;
  }
  return null;
}
function buildWhy(sim2, b) {
  if (!needsWork(b)) return null;
  const crew2 = sim2.crew();
  if (!crew2.length) return "ch\u01B0a c\xF3 th\u1EE3 x\xE2y: giao d\xE2n l\xE0m th\u1EE3 x\xE2y \u1EDF Nh\xE0 th\u1EE3 x\xE2y";
  const mine2 = crew2.filter((v) => (v.phase === "goSite" || v.phase === "build") && v.target === b.id);
  if (mine2.some((v) => v.phase === "build")) return null;
  if (mine2.length) return `${mine2.length} th\u1EE3 \u0111ang \u0111i t\u1EDBi`;
  const busy2 = crew2.filter((v) => v.phase === "build" || v.phase === "goSite").length, waiting = sim2.buildings.filter((o) => needsWork(o)).length;
  if (busy2) return `th\u1EE3 x\xE2y \u0111ang b\u1EADn c\xF4ng tr\xECnh kh\xE1c (\u0111ang ch\u1EDD ${waiting} vi\u1EC7c)`;
  if (crew2.every((v) => v.phase === "sleep" || v.phase === "goHome")) return "th\u1EE3 x\xE2y \u0111ang ngh\u1EC9 ng\u01A1i";
  return `th\u1EE3 x\xE2y ch\u01B0a nh\u1EADn vi\u1EC7c (\u0111i l\u1EA5y b\xFAa, ho\u1EB7c ${waiting} vi\u1EC7c \u0111ang ch\u1EDD)`;
}
var fireLevel = (sim2) => sim2.buildings.reduce((m, b) => b.kind === "campfire" && b.done ? Math.max(m, b.level) : m, 1);
function fireUpgradeBlock(sim2, level) {
  for (const [group, at] of Object.entries(fireUpgradeGroups(level))) for (const k of Object.keys(BUILDINGS)) {
    const d = BUILDINGS[k];
    if (d.group !== group || !d.buildable || eraLocked(k, sim2)) continue;
    const mine2 = sim2.buildings.filter((b) => b.kind === k), want = Math.min(at, maxLevel(k, sim2.era));
    if (!mine2.length) return `C\u1EA7n d\u1EF1ng ${d.name} tr\u01B0\u1EDBc khi n\xE2ng Nh\xE0 chung`;
    if (mine2.some((b) => !b.done || b.upgrading || b.level < want)) return `C\u1EA7n n\xE2ng ${d.name} l\xEAn c\u1EA5p ${want} tr\u01B0\u1EDBc khi n\xE2ng Nh\xE0 chung`;
  }
  return null;
}
function buildingLimit(sim2, kind) {
  const per = BUILDINGS[kind].perFire;
  if (!per) return 1;
  return sim2.buildings.reduce((n, f) => n + (f.kind === "campfire" ? per[Math.min(per.length, f.level) - 1] : 0), 0);
}
function buildingLock(sim2, kind) {
  if (eraLocked(kind, sim2) && !sim2.dev.freeBuild) return "M\u1EDF kh\xF3a \u1EDF th\u1EDDi Trung c\u1ED5";
  const fireNeed = fireUnlockLevel(kind);
  if (!sim2.dev.freeBuild && fireNeed > fireLevel(sim2)) return `C\u1EA7n n\xE2ng ${BUILDINGS.campfire.name} l\xEAn c\u1EA5p ${fireNeed} \u0111\u1EC3 x\xE2y ${BUILDINGS[kind].name.toLowerCase()}`;
  const have2 = sim2.buildings.filter((b) => b.kind === kind).length, limit = buildingLimit(sim2, kind);
  if (limit === 0) return `C\u1EA7n n\xE2ng c\u1EA5p Nh\xE0 chung \u0111\u1EC3 x\xE2y ${BUILDINGS[kind].name.toLowerCase()}`;
  if (have2 >= limit) return limit === 1 ? "M\u1ED7i c\xF4ng tr\xECnh ch\u1EC9 x\xE2y \u0111\u01B0\u1EE3c m\u1ED9t c\xE1i, h\xE3y n\xE2ng c\u1EA5p n\xF3" : `\u0110\xE3 \u0111\u1EE7 ${limit} ${BUILDINGS[kind].name.toLowerCase()}: n\xE2ng c\u1EA5p Nh\xE0 chung \u0111\u1EC3 x\xE2y th\xEAm`;
  const need = sim2.dev.freeBuild ? void 0 : BUILDINGS[kind].requires?.find((r) => !sim2.building(r));
  if (need) return `C\u1EA7n d\u1EF1ng ${BUILDINGS[need].name} tr\u01B0\u1EDBc`;
  if (!sim2.dev.freeBuild && !buildingOpen(sim2.researched, kind)) return `C\u1EA7n nghi\xEAn c\u1EE9u: ${techForBuilding(kind)?.name ?? "?"}`;
  return null;
}
function buildingNeeds(sim2, kind) {
  const d = BUILDINGS[kind], free = sim2.dev.freeBuild, out = [];
  const fireNeed = fireUnlockLevel(kind);
  if (fireNeed > 1) out.push({ text: `${BUILDINGS.campfire.name} c\u1EA5p ${fireNeed}`, ok: free || fireLevel(sim2) >= fireNeed });
  for (const r of d.requires ?? []) out.push({ text: `\u0110\xE3 d\u1EF1ng ${BUILDINGS[r].name}`, ok: free || !!sim2.building(r) });
  const tech = techForBuilding(kind);
  if (tech) out.push({ text: `Nghi\xEAn c\u1EE9u: ${tech.name}`, ok: free || buildingOpen(sim2.researched, kind) });
  const have2 = sim2.buildings.filter((b) => b.kind === kind).length, limit = buildingLimit(sim2, kind);
  out.push({ text: `C\xF2n ch\u1ED7 x\xE2y (${have2}/${limit}${limit <= have2 ? ": n\xE2ng c\u1EA5p Nh\xE0 chung \u0111\u1EC3 x\xE2y th\xEAm" : ""})`, ok: have2 < limit });
  return out;
}
function startLevel(sim2, kind) {
  return Math.min(sim2.ruins[kind] ?? 1, maxLevel(kind, sim2.era));
}
function startCost(sim2, kind) {
  const out = {};
  for (let l = 1; l <= startLevel(sim2, kind); l++) {
    const c = levelsOf(kind, sim2.era)[l - 1].cost;
    for (const r of Object.keys(c)) out[r] = (out[r] ?? 0) + (c[r] ?? 0);
  }
  return out;
}
function canPlace(sim2, kind, x, y) {
  return footprintError(sim2, kind, x, y) ?? buildingLock(sim2, kind) ?? (sim2.freeCost() ? null : sim2.missing(startCost(sim2, kind)));
}
function canUpgrade(sim2, b) {
  if (!b.done) return "C\xF4ng tr\xECnh ch\u01B0a d\u1EF1ng xong";
  if (b.upgrading) return "\u0110ang n\xE2ng c\u1EA5p";
  if (b.repairing) return "\u0110ang s\u1EEDa ch\u1EEFa";
  if (b.level >= topLevel(b)) return "\u0110\xE3 \u1EDF c\u1EA5p cao nh\u1EA5t";
  if (b.kind === "campfire" && !sim2.dev.freeBuild) {
    if (b.level >= BUILDINGS.campfire.levels.stone.length && sim2.tribes.some((t) => t.boss && !t.bossDown)) return "C\u1EA7n h\u1EA1 h\u1EBFt c\xE1c th\u1EE7 l\u0129nh (l\xE0ng \u0111\u1EA7u l\u0129nh, k\u1EC3 c\u1EA3 th\u1EE7 l\u0129nh ph\u1EA3n b\u1ED9i) tr\u01B0\u1EDBc khi n\xE2ng l\xEAn Nh\xE0 ch\xEDnh (th\u1EDDi Trung c\u1ED5)";
    const why = fireUpgradeBlock(sim2, b.level);
    if (why) return why;
  }
  const fire2 = sim2.campfire();
  if (b.kind !== "campfire" && fire2 && !sim2.dev.freeBuild && b.level + 1 > levelCapByFire(fire2.level)) return `C\u1EA7n n\xE2ng ${BUILDINGS.campfire.name} l\xEAn c\u1EA5p ${b.level + 1}`;
  return sim2.freeCost() ? null : sim2.missing(levelDef({ ...b, era: upgradeEra(b) }, b.level + 1).cost);
}
var upgradeEra = (b) => b.kind === "campfire" ? "ancient" : b.era;
function repairCost(sim2, b) {
  const top = maxHp(b), lost = top > 0 ? Math.max(0, Math.min(1, 1 - b.hp / top)) : 0, out = {}, spent = invested(sim2, b);
  for (const r of Object.keys(spent)) {
    const n = Math.ceil((spent[r] ?? 0) * lost - 1e-9);
    if (n > 0) out[r] = n;
  }
  return out;
}
function canRepair(sim2, b) {
  if (!b.done) return "C\xF4ng tr\xECnh ch\u01B0a d\u1EF1ng xong";
  if (b.repairing) return "\u0110ang s\u1EEDa ch\u1EEFa";
  if (b.upgrading) return "\u0110ang n\xE2ng c\u1EA5p: ch\u1EDD xong r\u1ED3i s\u1EEDa";
  if (b.hp >= maxHp(b)) return "C\xF4ng tr\xECnh c\xF2n nguy\xEAn v\u1EB9n";
  return sim2.freeCost() ? null : sim2.missing(repairCost(sim2, b));
}
function repairBuilding(sim2, id) {
  const b = sim2.getBuilding(id);
  if (!b) return "Kh\xF4ng t\xECm th\u1EA5y c\xF4ng tr\xECnh";
  const why = canRepair(sim2, b);
  if (why) return why;
  if (!sim2.freeCost()) {
    const cost = repairCost(sim2, b);
    for (const r of Object.keys(cost)) sim2.stock[r] -= cost[r] ?? 0;
  }
  if (sim2.dev.instantBuild) {
    b.hp = maxHp(b);
    return null;
  }
  b.repairing = true;
  sim2.say(`B\u1EAFt \u0111\u1EA7u s\u1EEDa ${BUILDINGS[b.kind].name}. Giao vi\u1EC7c "Th\u1EE3 x\xE2y" \u0111\u1EC3 l\xE0m.`);
  return null;
}
function upgradeBuilding(sim2, id) {
  const b = sim2.getBuilding(id);
  if (!b) return "Kh\xF4ng t\xECm th\u1EA5y c\xF4ng tr\xECnh";
  const why = canUpgrade(sim2, b);
  if (why) return why;
  b.era = upgradeEra(b);
  const next = levelDef(b, b.level + 1);
  if (!sim2.freeCost()) for (const r of Object.keys(next.cost)) sim2.stock[r] -= next.cost[r] ?? 0;
  if (sim2.dev.instantBuild) {
    b.level++;
    b.hp = maxHp(b);
    sim2.say(`${BUILDINGS[b.kind].name} l\xEAn c\u1EA5p ${b.level} ngay (dev).`);
    afterUpgrade(sim2, b);
    return null;
  }
  b.upgrading = true;
  b.progress = 0;
  sim2.say(`B\u1EAFt \u0111\u1EA7u n\xE2ng ${BUILDINGS[b.kind].name} l\xEAn c\u1EA5p ${b.level + 1} (${next.name.toLowerCase()}). Giao vi\u1EC7c "Th\u1EE3 x\xE2y" \u0111\u1EC3 l\xE0m.`);
  return null;
}
function afterUpgrade(sim2, b) {
  if (b.kind === "campfire" && b.level >= BUILDINGS.campfire.levels.stone.length + 1 && sim2.era !== "ancient") {
    setEra(sim2, "ancient");
    sim2.resetTribes();
    sim2.say("Nh\xE0 chung \u0111\xE3 th\xE0nh Nh\xE0 ch\xEDnh: th\u1EDDi Trung c\u1ED5 b\u1EAFt \u0111\u1EA7u! C\xE1c nh\xE0 c\u1EA5p 4 c\xF3 th\u1EC3 n\xE2ng l\xEAn c\u1EA5p trung c\u1ED5, c\xF3 th\xEAm nghi\xEAn c\u1EE9u m\u1EDBi, v\xE0 kh\xF4ng c\xF2n \u0111\xE1nh nhanh.");
  }
}
function setEra(sim2, era) {
  sim2.setDayLength(era);
  for (const b of sim2.buildings) {
    b.era = era;
    const top = maxLevel(b.kind, era);
    if (b.level > top) {
      b.level = top;
      b.upgrading = false;
    }
  }
  sim2.fogDirty = true;
}
function placeBuilding(sim2, kind, x, y) {
  const d = BUILDINGS[kind];
  if (!d.buildable) return { ok: false, reason: "Kh\xF4ng x\xE2y \u0111\u01B0\u1EE3c c\xF4ng tr\xECnh n\xE0y" };
  const why = canPlace(sim2, kind, x, y);
  if (why) return { ok: false, reason: why };
  const cost = startCost(sim2, kind), lvl = startLevel(sim2, kind);
  if (!sim2.freeCost()) for (const r of Object.keys(cost)) sim2.stock[r] -= cost[r] ?? 0;
  const b = addBuilding(sim2, kind, x, y, false, lvl);
  delete sim2.ruins[kind];
  if (sim2.dev.instantBuild) {
    b.progress = 1;
    b.done = true;
    sim2.fogDirty = true;
    sim2.say(`${d.name} \u0111\xE3 d\u1EF1ng xong ngay (dev).`);
    return { ok: true, building: b };
  }
  sim2.say(`\u0110\xE3 \u0111\u1EB7t n\u1EC1n ${d.name}${lvl > 1 ? ` (d\u1EF1ng l\u1EA1i \u1EDF c\u1EA5p ${lvl}, kh\xF4ng ph\u1EA3i n\xE2ng t\u1EEB c\u1EA5p 1)` : ""}. Giao vi\u1EC7c "Th\u1EE3 x\xE2y" \u0111\u1EC3 d\u1EF1ng.`);
  return { ok: true, building: b };
}
function invested(sim2, b) {
  const out = {};
  const add = (c) => {
    for (const r of Object.keys(c)) out[r] = (out[r] ?? 0) + (c[r] ?? 0);
  };
  for (let l = 1; l <= b.level; l++) add(levelDef(b, l).cost);
  if (b.upgrading) add(levelDef(b, b.level + 1).cost);
  return out;
}
function salvage(sim2, b) {
  const out = {}, paid = invested(sim2, b);
  if (!sim2.dev.freeBuild) for (const r of Object.keys(paid)) {
    const n = Math.floor((paid[r] ?? 0) * 0.5);
    if (n > 0) out[r] = n;
  }
  return out;
}
function moveFee(_sim, _b) {
  return {};
}
function evict(sim2, b) {
  for (const id of [...b.staff]) {
    const v = sim2.byId.get(id);
    if (v) {
      sim2.exitBuilding(v);
      if (v.job !== "fight") v.job = "idle";
      v.post = -1;
    }
  }
  b.staff = [];
  if (b.kind === "builder") for (const v of sim2.crew()) {
    sim2.resetTask(v);
    v.job = "idle";
  }
  if (b.active && (b.kind === "lab" || b.kind === "workshop")) {
    const d = sim2.orderDef(b.kind === "lab" ? "research" : "craft", b.active.id);
    if (d && !sim2.dev.freeWorks) sim2.pay(b.kind === "workshop" ? scaleCost(d.cost, b.active.paid ?? 1) : d.cost, 1);
  }
  b.active = null;
  for (const v of sim2.sleepers(b)) {
    sim2.exitBuilding(v);
    v.phase = "idle";
    v.target = -1;
    v.path = [];
  }
  for (const v of sim2.villagers) {
    if (v.target !== b.id) continue;
    if (v.phase === "goSite" || v.phase === "build" || v.phase === "goEquip" || v.phase === "goStaff" || v.phase === "goOrder") {
      if (isStaffJob(v.job) || v.post === b.id) v.job = "idle";
      sim2.resetTask(v);
    }
  }
  for (const v of sim2.villagers) if (v.post === b.id) {
    v.post = -1;
    if (v.job === "food" && v.phase === "idle") v.job = "idle";
  }
}
function setOcc(sim2, b, val) {
  const d = BUILDINGS[b.kind];
  if (b.kind === "gate" && b.open || b.kind === "trap") val = 0;
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
    const k = (b.y + j) * sim2.world.size + b.x + i;
    sim2.world.occ[k] = val;
    if (b.kind === "gate") {
      if (val) sim2.world.gates.add(k);
      else sim2.world.gates.delete(k);
    }
  }
}
function canDemolish(sim2, b) {
  return BUILDINGS[b.kind].buildable ? null : "Kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c c\xF4ng tr\xECnh n\xE0y";
}
function destroyBuilding(sim2, b) {
  if (BUILDINGS[b.kind].buildable && b.done && !WALL_KINDS.has(b.kind)) sim2.ruins[b.kind] = Math.max(sim2.ruins[b.kind] ?? 1, b.level);
  const archers = b.kind === "tower" ? sim2.garrison(b) : [];
  evict(sim2, b);
  for (const v of archers) {
    v.fight.mode = "guard";
    v.fight.anchor = { x: b.x + 1, y: b.y + 2 };
    v.stance = "aggressive";
    v.nightOwl = true;
    v.phase = "idle";
  }
  if (archers.length) sim2.say(`Ch\xF2i canh \u0111\u1ED5: ${archers.length} cung th\u1EE7 ra \u0111\xE1nh.`);
  setOcc(sim2, b, 0);
  sim2.buildings.splice(sim2.buildings.indexOf(b), 1);
  sim2.fogDirty = true;
  sim2.trimRoles();
}
function demolishBuilding(sim2, id) {
  const b = sim2.getBuilding(id);
  if (!b) return "Kh\xF4ng t\xECm th\u1EA5y c\xF4ng tr\xECnh";
  const why = canDemolish(sim2, b);
  if (why) return why;
  if (Object.values(ROLES).some((r) => r.building === b.kind) && sim2.warLock()) return sim2.warLock();
  const back = salvage(sim2, b);
  evict(sim2, b);
  setOcc(sim2, b, 0);
  sim2.buildings.splice(sim2.buildings.indexOf(b), 1);
  for (const r of Object.keys(back)) sim2.stock[r] += back[r] ?? 0;
  sim2.fogDirty = true;
  sim2.trimRoles();
  sim2.say(`\u0110\xE3 ph\xE1 ${BUILDINGS[b.kind].name.toLowerCase()}${Object.keys(back).length ? `, thu l\u1EA1i ${Object.keys(back).map((r) => `${back[r]} ${RES_NAME[r].toLowerCase()}`).join(", ")}` : ""}.`);
  return null;
}
function canMove(sim2, b, x, y) {
  if (!BUILDINGS[b.kind].buildable) return "Kh\xF4ng d\u1EDDi \u0111\u01B0\u1EE3c c\xF4ng tr\xECnh n\xE0y";
  if (sim2.attackReason()) return "Kh\xF4ng d\u1EDDi \u0111\u01B0\u1EE3c c\xF4ng tr\xECnh khi l\xE0ng \u0111ang b\u1ECB t\u1EA5n c\xF4ng";
  if (x === b.x && y === b.y) return "V\u1EABn \u1EDF ch\u1ED7 c\u0169";
  return footprintError(sim2, b.kind, x, y, b) ?? sim2.missing(moveFee(sim2, b));
}
var GROUP_KINDS = /* @__PURE__ */ new Set(["fence", "gate"]);
function groupPlan(sim2, ids2, to, rot) {
  const pieces = ids2.map((id) => sim2.getBuilding(id)).filter((b) => !!b);
  if (!pieces.length) return [];
  const a = pieces[0], turns = (Math.round(rot) % 4 + 4) % 4;
  return pieces.map((b) => {
    let ox = b.x - a.x, oy = b.y - a.y;
    for (let i = 0; i < turns; i++) [ox, oy] = [-oy, ox];
    return { id: b.id, kind: b.kind, x: to.x + ox, y: to.y + oy, level: b.level };
  });
}
function canMoveGroup(sim2, ids2, to, rot) {
  const plan2 = groupPlan(sim2, ids2, to, rot);
  if (!plan2.length) return "Ch\u01B0a ch\u1ECDn m\u1EA3nh h\xE0ng r\xE0o n\xE0o";
  if (plan2.some((q) => !GROUP_KINDS.has(q.kind))) return "Ch\u1EC9 d\u1EDDi \u0111\u01B0\u1EE3c h\xE0ng r\xE0o v\xE0 c\u1ED5ng theo nh\xF3m";
  if (sim2.attackReason()) return "Kh\xF4ng d\u1EDDi \u0111\u01B0\u1EE3c c\xF4ng tr\xECnh khi l\xE0ng \u0111ang b\u1ECB t\u1EA5n c\xF4ng";
  const pieces = plan2.map((q) => sim2.getBuilding(q.id));
  if (plan2.every((q, i) => q.x === pieces[i].x && q.y === pieces[i].y)) return "V\u1EABn \u1EDF ch\u1ED7 c\u0169";
  for (const b of pieces) setOcc(sim2, b, 0);
  try {
    for (const q of plan2) {
      const why = footprintError(sim2, q.kind, q.x, q.y);
      if (why) return why;
    }
  } finally {
    for (const b of pieces) setOcc(sim2, b, 1);
  }
  return null;
}
function moveGroup(sim2, ids2, to, rot) {
  const why = canMoveGroup(sim2, ids2, to, rot);
  if (why) return why;
  const plan2 = groupPlan(sim2, ids2, to, rot), pieces = plan2.map((q) => sim2.getBuilding(q.id));
  for (const b of pieces) setOcc(sim2, b, 0);
  plan2.forEach((q, i) => {
    pieces[i].x = q.x;
    pieces[i].y = q.y;
  });
  for (const b of pieces) setOcc(sim2, b, 1);
  sim2.fogDirty = true;
  sim2.say(`\u0110\xE3 d\u1EDDi ${pieces.length} m\u1EA3nh h\xE0ng r\xE0o sang ch\u1ED7 m\u1EDBi.`);
  return null;
}
function moveBuilding(sim2, id, x, y) {
  const b = sim2.getBuilding(id);
  if (!b) return "Kh\xF4ng t\xECm th\u1EA5y c\xF4ng tr\xECnh";
  const why = canMove(sim2, b, x, y);
  if (why) return why;
  const fee = moveFee(sim2, b);
  for (const r of Object.keys(fee)) sim2.stock[r] -= fee[r] ?? 0;
  evict(sim2, b);
  if (b.upgrading) {
    for (const r of Object.keys(levelDef(b, b.level + 1).cost)) if (!sim2.freeCost()) sim2.stock[r] += levelDef(b, b.level + 1).cost[r] ?? 0;
    b.upgrading = false;
  }
  setOcc(sim2, b, 0);
  b.x = x;
  b.y = y;
  setOcc(sim2, b, 1);
  sim2.fogDirty = true;
  sim2.say(`${BUILDINGS[b.kind].name} \u0111\u01B0\u1EE3c d\u1EDDi sang ch\u1ED7 m\u1EDBi.`);
  return null;
}
function capacity(sim2, res) {
  let c = 0;
  for (const b of sim2.buildings) if (b.done && (holdsGoods(b) || res && BUILDINGS[b.kind].produces?.includes(res))) c += levelDef(b).cap;
  return c;
}
function popCap(sim2) {
  const f = sim2.campfire();
  return POP_BY_FIRE[Math.min(POP_BY_FIRE.length, f?.level ?? 1) - 1] + sim2.bedsIn("house") + sim2.popBonus;
}
function crewSpeed(sim2) {
  const h = sim2.building("builder");
  return h ? levelDef(h).craftSpeed : 1;
}

// src/sim/model.ts
var NAMES_M = ["Bo", "R\xF4", "Gia", "Mun", "L\xF4", "T\xF9", "\u0110a"];
var NAMES_F = ["Tia", "Noa", "Ma", "Pa", "K\xEA", "Ly", "Sa"];
var HAIR = ["#4a2e1a", "#2b1b10", "#6b3f1d", "#c98a3a", "#7a5a3a"];
var SKIN = ["#d9a371", "#e8c4a0", "#c58a5c", "#b87850"];
var NODE_JOB = { tree: "wood", rock: "stone", bush: "food" };
var XP_MULT = [0, 1, 1.5, 2];
var REACH = { tree: 0.55, rock: 0.62, bush: 0.5 };
var LEFT = 1;
var RIGHT = 2;

// src/sim/labor.ts
function workRate(sim2, v, job) {
  return workFactor(sim2, v, job);
}
function outdoorFactor(sim2, job) {
  return OUTDOOR_JOBS.includes(job) ? WEATHER[sim2.weather].work * SEASON_DEF[sim2.season].work : 1;
}
function workFactor(sim2, v, job, field = false) {
  const season = job === "food" ? SEASON_DEF[sim2.season][field ? "farm" : "gather"] : 1;
  const tier = TOOL_OF_JOB[job] ? sim2.toolTier(v, job) : -1;
  const tool = tier < 0 ? 1 : tier === 0 ? BARE_HANDS[job] ?? TIER_SPEED[0] : TIER_SPEED[tier] * (1 + toolBonus(sim2, v, job, "tspd") / 100);
  return workSpeed(sim2, v) * (1 + 0.2 * v.skill[job].level) * tool * season * outdoorFactor(sim2, job) * sim2.restFactor(v);
}
function gainXp(sim2, v, job, dt) {
  const s = v.skill[job];
  if (s.level >= MAX_LEVEL) return;
  s.xp += dt * sim2.paceWork * XP_MULT[v.potential[job]];
  if (s.xp >= XP_LEVELS[s.level]) {
    s.level++;
    sim2.say(`${v.name} l\xEAn c\u1EA5p ${s.level} ngh\u1EC1 ${JOB_NAME[job].toLowerCase()}.`);
  }
}
function wear(sim2, v, job, dt) {
  const k = TOOL_OF_JOB[job], t = k ? v.tools[k] : null;
  if (!k || !t || t.dur <= 0) return;
  t.dur -= dt * sim2.paceWork / (1 + toolBonus(sim2, v, job, "tdur") / 100);
  if (t.dur <= 0) {
    v.tools[k] = null;
    sim2.say(`${TOOL_NAME[k]} ${TIER_NAME[t.tier].toLowerCase()} c\u1EE7a ${v.name} \u0111\xE3 h\u1ECFng, v\u1EE9t b\u1ECF.`);
  }
}
function leaveNode(sim2, v) {
  if ((v.phase === "goNode" || v.phase === "work") && v.target >= 0) {
    const n = sim2.world.nodes.get(v.target);
    if (n) {
      if (n.workers > 0) n.workers--;
      n.sides &= ~v.slot;
    }
  }
  v.slot = 0;
}
function face(sim2, v, tx, ty) {
  const dx = tx + 0.5 - v.x, dy = ty + 0.5 - v.y;
  v.facing = Math.abs(dx) > Math.abs(dy) * 1.1 ? dx > 0 ? "right" : "left" : dy > 0 ? "front" : "back";
}
function wait(sim2, v, secs) {
  v.phase = "wait";
  v.timer = secs;
}
function faceX(sim2, v, cx) {
  v.facing = cx >= v.x ? "right" : "left";
}
function nodeSlide(sim2, v, nx, ny, kind) {
  const left = v.slot === LEFT;
  return { x: nx + 0.5 + (left ? -REACH[kind] : REACH[kind]), y: ny + 0.875, face: left ? "right" : "left" };
}
function edgeSlide(sim2, v, b) {
  const d = BUILDINGS[b.kind], left = v.x < b.x + d.w / 2;
  return { x: left ? b.x - 0.3 : b.x + d.w + 0.3, y: b.y + d.h - 0.3 - v.id % 2 * 0.5, face: left ? "right" : "left" };
}
function faceBuilding(sim2, v, b) {
  faceX(sim2, v, b.x + BUILDINGS[b.kind].w / 2);
}
function think(sim2, v, dt) {
  const N = sim2.world.size;
  switch (v.phase) {
    case "move":
      v.phase = "idle";
      sim2.nextOrder(v);
      return;
    case "idle":
      if (v.queue.length && sim2.nextOrder(v)) return;
      if (v.job !== "idle") plan(sim2, v);
      else idleHome(sim2, v);
      return;
    case "wait":
      v.timer -= dt;
      if (v.timer <= 0) v.phase = "idle";
      return;
    case "goNode": {
      const n = sim2.world.nodes.get(v.target);
      if (!n || n.amount <= 0) {
        leaveNode(sim2, v);
        v.phase = "idle";
        return;
      }
      const nx = v.target % N, ny = v.target / N | 0;
      v.phase = "work";
      v.progress = 0;
      const sl = nodeSlide(sim2, v, nx, ny, n.kind);
      if (Math.hypot(sl.x - v.x, sl.y - v.y) < 0.04) v.facing = sl.face;
      else v.slide = sl;
      return;
    }
    case "work":
      doWork(sim2, v, dt);
      return;
    case "goStore":
      unload(sim2, v);
      return;
    case "goEquip":
      sim2.equip(v);
      return;
    case "goSite": {
      const b = sim2.getBuilding(v.target);
      if (!b || !needsWork(b)) {
        v.phase = "idle";
        return;
      }
      v.phase = "build";
      v.slide = edgeSlide(sim2, v, b);
      return;
    }
    case "build": {
      const b = sim2.getBuilding(v.target);
      if (!b || !needsWork(b)) {
        v.phase = "idle";
        return;
      }
      if (b.repairing && b.done && !b.upgrading) {
        const top = maxHp(b);
        b.hp = Math.min(top, b.hp + top * (dt * sim2.paceWork / levelDef(b).buildTime) * workFactor(sim2, v, "build") * sim2.crewSpeed());
        gainXp(sim2, v, "build", dt);
        wear(sim2, v, "build", dt);
        if (b.hp >= top) {
          b.hp = top;
          b.repairing = false;
          v.phase = "idle";
          sim2.say(`${BUILDINGS[b.kind].name} \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EEDa xong.`);
        }
        return;
      }
      const target = b.upgrading ? b.level + 1 : b.level;
      b.progress += dt * sim2.paceWork / (levelDef(b, target).buildTime * (b.rebuild ? 0.5 : 1)) * workFactor(sim2, v, "build") * sim2.crewSpeed();
      gainXp(sim2, v, "build", dt);
      wear(sim2, v, "build", dt);
      if (b.progress >= 1) {
        b.progress = 1;
        if (b.upgrading) {
          b.level++;
          b.upgrading = false;
          b.hp = maxHp(b);
          sim2.say(`${BUILDINGS[b.kind].name} \u0111\xE3 l\xEAn c\u1EA5p ${b.level} (${levelDef(b).name.toLowerCase()}).`);
          sim2.afterUpgrade(b);
        } else {
          b.done = true;
          b.rebuild = false;
          sim2.fogDirty = true;
          if (b.kind === "builder") sim2.trimCrew();
          sim2.say(`${BUILDINGS[b.kind].name} \u0111\xE3 d\u1EF1ng xong.`);
          if (RESEARCH.enabled && b.kind === "lab" && sim2.researched.size === 0) sim2.say("M\u1EDF Nh\xE0 nghi\xEAn c\u1EE9u, \u0111\u01B0a m\u1ED9t d\xE2n v\xE0o l\xE0m vi\u1EC7c, r\u1ED3i nghi\xEAn c\u1EE9u b\u1EA3n v\u1EBD \u0111\u1EA7u ti\xEAn.");
        }
        v.phase = "idle";
      }
      return;
    }
    case "goStaff":
      sim2.enterBuilding(v);
      return;
    case "goOrder":
      sim2.errand(v);
      return;
    case "inside":
      return;
    case "goHome": {
      stash(sim2, v);
      const bed = v.target >= 0 ? sim2.getBuilding(v.target) : void 0;
      if (bed && bed.done) sim2.sleepIn(v, bed);
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
function idleHome(sim2, v) {
  if (v.shift === "both" || v.post >= 0 || v.inside !== null || sim2.pathLeft <= 0) return;
  const fire2 = sim2.campfire();
  if (!fire2) return;
  const spot2 = sim2.nearestFree(Math.floor(fire2.x + 1 + v.id * 7 % 7 - 3), Math.floor(fire2.y + 3 + v.id % 2), /* @__PURE__ */ new Set());
  if (!spot2 || Math.hypot(spot2[0] + 0.5 - v.x, spot2[1] + 0.5 - v.y) <= 2) return;
  sim2.pathLeft--;
  v.path = sim2.pathTo(v, spot2[0], spot2[1], 4e3);
  v.phase = v.path.length ? "move" : "idle";
}
function doWork(sim2, v, dt) {
  const job = v.job, def = JOBS[job], n = sim2.world.nodes.get(v.target);
  if (!def.res || !n || n.amount <= 0) {
    leaveNode(sim2, v);
    v.phase = "idle";
    return;
  }
  v.progress += dt * workFactor(sim2, v, job) / def.baseTime;
  gainXp(sim2, v, job, dt);
  const tierNow = sim2.toolTier(v, job);
  wear(sim2, v, job, dt);
  if (v.progress < 1) return;
  v.progress -= 1;
  const kindOf2 = GATHER_HOUSE[job], res = def.res, gain = strokeYield(sim2, v, job, gatherMult(kindOf2 ? sim2.building(kindOf2) : void 0) * TIER_YIELD[tierNow] * pace_default.yield[def.res]);
  const have2 = v.carry && v.carry.res === res ? v.carry.amount : 0;
  const take2 = Math.max(0, Math.min(gain, n.amount, CARRY_CAP[res] - have2));
  n.amount -= take2;
  v.carry = { res, amount: have2 + take2 };
  if (res === "food" && take2 > 0) {
    sim2.coinFrac += 0.06 * take2;
    if (sim2.coinFrac >= 1) {
      sim2.coinFrac -= 1;
      if (sim2.stock.coin < sim2.capacity()) {
        sim2.stock.coin++;
        if (!sim2.sawCoin) {
          sim2.sawCoin = true;
          sim2.say(`${v.name} nh\u1EB7t \u0111\u01B0\u1EE3c m\u1ED9t ${RES_NAME.coin.toLowerCase()}: d\xE2n l\xE0ng d\xF9ng n\xF3 \u0111\u1EC3 trao \u0111\u1ED5i.`);
        }
      }
    }
  }
  if (n.amount <= 0) {
    const idx = v.target, N = sim2.world.size;
    leaveNode(sim2, v);
    sim2.world.depleted(idx, (x, y) => sim2.fog.state[y * N + x] > 0 && ![...sim2.villagers, ...sim2.foes].some((o) => Math.floor(o.x) === x && Math.floor(o.y) === y) && !sim2.animals.some((o) => Math.floor(o.x) === x && Math.floor(o.y) === y));
    v.phase = "idle";
    if (n.kind === "tree") sim2.say("M\u1ED9t c\xE2y \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u1ED1n xong.");
  } else if (v.carry.amount >= CARRY_CAP[res] || sim2.needTool(v, job)) {
    leaveNode(sim2, v);
    v.phase = "idle";
  }
}
function tickFarms(sim2, dt) {
  for (const b of sim2.buildings) {
    if (b.kind !== "field" || !b.done) continue;
    for (const id of b.staff) {
      const v = sim2.byId.get(id);
      if (!v || v.phase !== "inside" || v.job !== "food" || !sim2.hasRoom("food")) continue;
      v.progress += dt * workFactor(sim2, v, "food", true) * levelDef(b).craftSpeed / FARM_TIME;
      gainXp(sim2, v, "food", dt);
      wear(sim2, v, "food", dt);
      if (v.progress < 1) continue;
      v.progress -= 1;
      sim2.noteYield("farm", sim2.deposit("food", strokeYield(sim2, v, "food", TIER_YIELD[sim2.toolTier(v, "food")])));
    }
  }
}
function plan(sim2, v) {
  if (v.job === "hunt" || v.job === "fight" || v.job === "scout" || v.job === "supply") {
    wait(sim2, v, 1);
    return;
  }
  if (v.job === "build") {
    if (!sim2.planTool(v, "build")) planBuild(sim2, v);
    return;
  }
  if (isStaffJob(v.job) || v.job === "food" && v.post >= 0) {
    sim2.planStaff(v);
    return;
  }
  const def = JOBS[v.job], res = def.res;
  if (v.carry && (v.carry.res !== res || v.carry.amount >= CARRY_CAP[v.carry.res])) {
    planDeliver(sim2, v);
    return;
  }
  if (!sim2.hasRoom(res)) {
    if (v.carry) {
      planDeliver(sim2, v);
      return;
    }
    if (sim2.time - sim2.lastFullWarn > 30) {
      sim2.lastFullWarn = sim2.time;
      sim2.say(`Kho \u0111\xE3 \u0111\u1EA7y ${RES_NAME[res].toLowerCase()}, h\xE3y n\xE2ng c\u1EA5p Kho.`);
    }
    wait(sim2, v, 3);
    return;
  }
  if (sim2.planTool(v, v.job)) return;
  if (findNode2(sim2, v, def.node)) {
    trapped.delete(v);
    return;
  }
  if (v.carry) {
    planDeliver(sim2, v);
    return;
  }
  freeTrapped(sim2, v, sim2.buildings.filter((b) => b.done && holdsGoods(b)).sort((a, b) => Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y)));
  wait(sim2, v, 2);
}
function findNode2(sim2, v, kind) {
  const N = sim2.world.size, vx = Math.floor(v.x), vy = Math.floor(v.y);
  const ok = (idx) => {
    const n = sim2.world.nodes.get(idx);
    return !!n && n.kind === kind && n.amount > 0 && n.workers < 2 && n.sides !== 3 && sim2.fog.state[idx] > 0 && (v.bad.get(idx) ?? 0) <= sim2.time;
  };
  const cands = [];
  if (v.prefer >= 0 && ok(v.prefer)) cands.push([-1, v.prefer]);
  for (const [idx, n] of sim2.world.nodes) {
    if (n.kind !== kind || n.amount <= 0 || n.workers >= 2 || n.sides === 3 || idx === v.prefer || !ok(idx)) continue;
    const d = (idx % N - vx) ** 2 + ((idx / N | 0) - vy) ** 2;
    if (d <= 70 * 70) cands.push([d, idx]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  for (let c = 0; c < Math.min(4, cands.length); c++) {
    const idx = cands[c][1], nx = idx % N, ny = idx / N | 0, node = sim2.world.nodes.get(idx);
    const opts = [];
    for (const side of [LEFT, RIGHT]) {
      if (node.sides & side) continue;
      const sx = side === LEFT ? -1 : 1;
      const near2 = [[sx, 0, 0], [sx, 1, 0.6], [sx, -1, 1.6], [0, 1, 1.2], [0, -1, 2.4]];
      for (const [dx, dy, pen] of near2) if (!sim2.world.isBlocked(nx + dx, ny + dy)) opts.push({ t: [nx + dx, ny + dy], side, pen });
    }
    const cost = (o) => Math.hypot(o.t[0] + 0.5 - v.x, o.t[1] + 0.5 - v.y) + o.pen;
    opts.sort((a, b) => cost(a) - cost(b));
    const k = sim2.routeTo(v, opts.map((o) => o.t), 4);
    if (k >= 0) {
      node.workers++;
      node.sides |= opts[k].side;
      v.slot = opts[k].side;
      v.target = idx;
      v.phase = "goNode";
      v.prefer = -1;
      return true;
    }
    v.bad.set(idx, sim2.time + 30);
  }
  if (v.prefer >= 0) {
    if (sim2.world.nodes.has(v.prefer) && (v.bad.get(v.prefer) ?? 0) > sim2.time) sim2.say(`${v.name} kh\xF4ng t\xECm \u0111\u01B0\u1EE3c \u0111\u01B0\u1EDDng t\u1EDBi ngu\u1ED3n \u0111\xE3 ch\u1ECDn.`);
    v.prefer = -1;
  }
  return false;
}
var trapped = /* @__PURE__ */ new WeakMap();
function freeTrapped(sim2, v, stores) {
  const n = (trapped.get(v) ?? 0) + 1;
  trapped.set(v, n);
  if (n < 3 || !stores.length) return;
  const b = stores[0], d = BUILDINGS[b.kind], spot2 = sim2.ringTiles(v, b.x, b.y, d.w, d.h)[0];
  trapped.delete(v);
  if (!spot2) return;
  const way = sim2.pathTo(v, spot2[0], spot2[1], 6e3), last = way[way.length - 1];
  if (last && last[0] === spot2[0] && last[1] === spot2[1] || Math.floor(v.x) === spot2[0] && Math.floor(v.y) === spot2[1]) return;
  v.x = spot2[0] + 0.5;
  v.y = spot2[1] + 0.5;
  v.path = [];
  v.slide = null;
  v.bad.clear();
  sim2.say(`${v.name} b\u1ECB k\u1EB9t gi\u1EEFa c\xE2y c\u1ED1i, \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u01B0a v\u1EC1 ${BUILDINGS[b.kind].name.toLowerCase()}.`);
}
function planDeliver(sim2, v) {
  const held = sim2.buildings.filter((b) => b.done && holdsGoods(b)), done = held.some((b) => b.kind === "storage") ? held.filter((b) => b.kind === "storage") : held;
  done.sort((a, b) => Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
  for (const b of done.slice(0, 2)) {
    const d = BUILDINGS[b.kind];
    if (sim2.routeTo(v, sim2.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) {
      trapped.delete(v);
      v.target = b.id;
      v.phase = "goStore";
      return;
    }
  }
  freeTrapped(sim2, v, done);
  wait(sim2, v, 2);
}
function stash(sim2, v) {
  const c = v.carry;
  if (!c) return;
  const moved = sim2.deposit(c.res, c.amount);
  c.amount -= moved;
  sim2.noteYield(v.job, moved);
  if (c.amount <= 0) v.carry = null;
}
function unload(sim2, v) {
  const c = v.carry, st = sim2.getBuilding(v.target);
  if (st) faceBuilding(sim2, v, st);
  if (!c) {
    v.phase = "idle";
    return;
  }
  const moved = sim2.deposit(c.res, c.amount);
  c.amount -= moved;
  sim2.noteYield(v.job, moved);
  if (c.amount <= 0) {
    v.carry = null;
    v.phase = "idle";
    return;
  }
  if (sim2.time - sim2.lastFullWarn > 30) {
    sim2.lastFullWarn = sim2.time;
    sim2.say(`Kho \u0111\xE3 \u0111\u1EA7y ${RES_NAME[c.res].toLowerCase()}, h\xE3y x\xE2y th\xEAm Kho.`);
  }
  wait(sim2, v, 3);
}
function planBuild(sim2, v) {
  const onSite = (b) => sim2.villagers.filter((o) => o !== v && o.target === b.id && (o.phase === "goSite" || o.phase === "build")).length;
  const house = !!sim2.building("builder");
  let sites = sim2.buildings.filter((b) => needsWork(b) && (house || b.kind === "builder") && onSite(b) < 3);
  sites.sort((a, b) => (b.id === v.prefer ? 1 : 0) - (a.id === v.prefer ? 1 : 0) || Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
  sites = sites.slice(0, 2);
  for (const b of sites) {
    const d = BUILDINGS[b.kind];
    if (sim2.routeTo(v, sim2.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) {
      v.target = b.id;
      v.phase = "goSite";
      v.prefer = -1;
      return;
    }
  }
  wait(sim2, v, 2);
}

// src/data/rest.json
var rest_default = {
  _note: "Energy (s\u1EE9c) of a villager, 0-100. Costs are percentage points. A day's heavy work costs dayCost over the waking hours, a night shift nightCost over the night; jobWeight scales it per job. Sleep gives back sleepNight points over one night of sleep (half that by day) in a Nh\xE0 d\xE2n; sleepAt scales it by where they lie down: by the campfire (no bed free) it is slower, in the Nh\xE0 d\xE2n or the L\u1EC1u chi\u1EBFn binh (soldiers) it is full, and a higher level of the house multiplies it again (its craftSpeed). Below tired a villager must sleep and cannot be woken until wakeAfterTired (wakeAfterCollapse if they fell asleep below collapse). Strain builds up from night work and from collapsing, and wears off with sleep; it lowers the energy ceiling and slows recovery, so nobody can be worked night after night. Night work needs a torch and goes at nightEfficiency. N\u01A1i ng\u1EE7 KH\xD4NG c\xF2n \u1EA3nh h\u01B0\u1EDFng t\u1EDBi t\u1ED1c \u0111\u1ED9 h\u1ED3i s\u1EE9c (sleepAt \u0111\u1EC1u b\u1EB1ng 1, c\u1EA5p nh\xE0 c\u0169ng kh\xF4ng nh\xE2n). soldierRest: l\xEDnh (ngh\u1EC1 chi\u1EBFn \u0111\u1EA5u) h\u1ED3i s\u1EE9c nhanh h\u01A1n d\xE2n b\u1EA5y nhi\xEAu l\u1EA7n (1.4 = nhanh h\u01A1n 40%). soldierHealInCamp: l\xEDnh h\u1ED3i m\xE1u nhanh b\u1EA5y nhi\xEAu l\u1EA7n khi \u0111ang \u1EDF trong tr\u1EA1i c\u1EE7a m\xECnh (kh\xF4ng l\xE0m nhi\u1EC7m v\u1EE5, kh\xF4ng \u1EDF ngo\xE0i). Nghi\xEAn c\u1EE9u H\u1ED3i s\u1EE9c (restregen) v\xE0 H\u1ED3i m\xE1u (hpregen) nh\xE2n th\xEAm.",
  tired: 20,
  collapse: 10,
  wakeAfterTired: 50,
  wakeAfterCollapse: 60,
  dayCost: 42,
  nightCost: 30,
  sleepNight: 60,
  sleepDay: 30,
  sleepAt: {
    campfire: 1,
    house: 1,
    infantry: 1,
    cavalry: 1,
    archery: 1,
    guardpost: 1
  },
  nightEfficiency: 0.7,
  tiredEfficiency: 0.7,
  tiredBelow: 40,
  jobWeight: {
    wood: 1,
    stone: 1,
    build: 0.95,
    fight: 0.8,
    hunt: 0.9,
    food: 0.7,
    craft: 0.6,
    research: 0.5,
    idle: 0.15
  },
  strain: {
    nightWork: 0.1,
    collapse: 15,
    nightSleep: 0.12,
    daySleep: 0.03,
    capLoss: 0.4,
    recoveryLoss: 67e-4
  },
  soldierRest: 1.4,
  soldierHealInCamp: 1.5
};

// src/sim/idle.ts
var isFree = (v) => v.job === "idle" && !roleOf(v);
function farFolk(sim2, reach = 20) {
  const fire2 = sim2.campfire(), fx = fire2 ? fire2.x + 1 : sim2.world.start.x, fy = fire2 ? fire2.y + 1 : sim2.world.start.y;
  return sim2.villagers.filter((v) => isFree(v) && v.down <= 0 && v.inside === null && v.phase !== "sleep" && v.phase !== "goHome" && Math.hypot(v.x - fx, v.y - fy) > reach);
}
function homeKind(v) {
  if (v.job === "build") return "builder";
  const role = roleOf(v);
  return role ? ROLES[role].building : "house";
}

// src/sim/scouting.ts
var STEPS = [
  { level: 1, label: "X\xE1c \u0111\u1ECBnh v\u1ECB tr\xED ng\xF4i l\xE0ng" },
  { level: 1, label: "\u0110\u1EBFm s\u1ED1 d\xE2n" },
  { level: 1, label: "T\xECm h\u01B0\u1EDBng v\xE0o l\xE0ng" },
  { level: 2, label: "V\u1EBD h\xE0ng r\xE0o v\xE0 c\u1ED5ng" },
  { level: 2, label: "V\u1EBD ch\xF2i canh" },
  { level: 2, label: "Ghi l\u1EA1i ng\u01B0\u1EDDi \u0111i l\u1EA1i trong l\xE0ng" },
  { level: 3, label: "Ph\xE2n lo\u1EA1i l\xEDnh: b\u1ED9 binh, cung th\u1EE7, k\u1EF5 binh" },
  { level: 3, label: "T\xECm kho l\u01B0\u01A1ng" },
  { level: 3, label: "Nh\u1EADn ra th\u1EE7 l\u0129nh" }
];
var mapAccuracy = (sim2, m) => Math.max(0, 1 - COMMAND.mapDecayPerDay * (sim2.time - m.at) / sim2.dayLen);
function mapLevel(sim2, tribe) {
  let best = 0;
  for (const m of sim2.maps) if (m.tribe === tribe && mapAccuracy(sim2, m) >= 0.4) best = Math.max(best, m.gaps > 0 ? Math.max(1, m.level - 1) : m.level);
  return best;
}
var warriorsOf = (sim2, tribe) => {
  const t = tribeOf(sim2, tribe);
  return t ? headcount(sim2, t).guards : 0;
};
var SIGHT = 14;
var HOME = 7;
var COMPASS = ["\u0110\xF4ng", "\u0110\xF4ng Nam", "Nam", "T\xE2y Nam", "T\xE2y", "T\xE2y B\u1EAFc", "B\u1EAFc", "\u0110\xF4ng B\u1EAFc"];
var isFound = (sim2, tribe) => sim2.dev.freeBuild || sim2.sightings.some((s) => s.tribe === tribe && s.reported);
function whereIs(sim2, tribe) {
  const t = tribeOf(sim2, tribe);
  if (!t) return null;
  const fire2 = sim2.campfire(), fx = fire2 ? fire2.x + 1 : sim2.world.start.x, fy = fire2 ? fire2.y + 1 : sim2.world.start.y;
  const dx = t.camp.x - fx, dy = t.camp.y - fy;
  return { dist: Math.round(Math.hypot(dx, dy)), dir: COMPASS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8] };
}
function tickSightings(sim2, dt) {
  if (Math.floor(sim2.time) === Math.floor(sim2.time - dt)) return;
  const fire2 = sim2.campfire();
  for (let i = sim2.sightings.length - 1; i >= 0; i--) {
    const s = sim2.sightings[i];
    if (s.reported) continue;
    const v = sim2.byId.get(s.by);
    if (!v || v.team !== "player" || v.health <= 0) {
      sim2.sightings.splice(i, 1);
      continue;
    }
    if (v.inside !== null || !fire2 || Math.hypot(v.x - fire2.x, v.y - fire2.y) < HOME) {
      s.reported = true;
      const w = whereIs(sim2, s.tribe);
      if (w) sim2.say(`${v.name} v\u1EC1 b\xE1o \u0111\xE3 th\u1EA5y m\u1ED9t ng\xF4i l\xE0ng, c\xE1ch \u0111\xE2y kho\u1EA3ng ${w.dist} \xF4 v\u1EC1 ph\xEDa ${w.dir}.`);
    }
  }
  for (const t of sim2.tribes) {
    if (t.state === "destroyed" || sim2.sightings.some((s) => s.tribe === t.id)) continue;
    const finder = sim2.villagers.find((v) => v.health > 0 && v.inside === null && Math.hypot(v.x - t.camp.x, v.y - t.camp.y) < SIGHT);
    if (finder) sim2.sightings.push({ tribe: t.id, by: finder.id, at: sim2.time, reported: false });
  }
}
function scoutLevel(sim2) {
  if (sim2.dev.freeBuild) return 3;
  return sim2.buildings.reduce((n, b) => b.kind === "scouttent" && b.done ? Math.max(n, Math.min(3, b.level)) : n, 0);
}
function scoutLimit(sim2) {
  return sim2.dev.freeBuild ? 8 : sim2.buildings.reduce((n, b) => n + (b.kind === "scouttent" && b.done ? levelDef(b).slots : 0), 0);
}
var onTrip = (sim2, v) => sim2.scouts.some((m) => m.ids.includes(v.id));
var canScout = (sim2, v) => v.job === "scout" && v.health > 0 && !onTrip(sim2, v);
var scoutRoster = (sim2) => sim2.villagers.filter((v) => v.job === "scout");
var canBeScout = (v) => v.job === "fight" && v.arm === "cavalry";
function enlistScouts(sim2, ids2) {
  const lock = sim2.warLock();
  if (lock) return lock;
  const limit = scoutLimit(sim2);
  if (!limit) return "C\u1EA7n d\u1EF1ng Tr\u1EA1i trinh s\xE1t";
  const pick2 = sim2.mine(ids2).filter(canBeScout), room = limit - scoutRoster(sim2).length;
  if (!pick2.length) return "Trinh s\xE1t \u0111\u01B0\u1EE3c tuy\u1EC3n t\u1EEB l\xEDnh k\u1EF5: h\xE3y ch\u1ECDn l\xEDnh k\u1EF5 th\xFA c\u1EE7a Tr\u1EA1i k\u1EF5 th\xFA";
  if (room <= 0) return `Tr\u1EA1i trinh s\xE1t \u0111\xE3 \u0111\u1EE7 ${limit} trinh s\xE1t: n\xE2ng c\u1EA5p l\u1EC1u \u0111\u1EC3 ch\u1EE9a th\xEAm`;
  for (const v of pick2.slice(0, room)) {
    sim2.resetTask(v);
    sim2.clearCombat(v);
    v.job = "scout";
    v.prefer = -1;
    v.post = -1;
    v.guard = false;
    v.guardAt = null;
    sim2.fitScoutMount(v);
  }
  return pick2.length > room ? `L\u1EC1u ch\u1EC9 c\xF2n ch\u1ED7 cho ${room} trinh s\xE1t` : null;
}
function dismissScouts(sim2, ids2) {
  const lock = sim2.warLock();
  if (lock) return lock;
  let n = 0, away = 0;
  for (const v of ids2.map((id) => sim2.byId.get(id)).filter((o) => !!o && o.team === "player" && o.down <= 0)) {
    if (v.job !== "scout") continue;
    if (onTrip(sim2, v)) {
      away++;
      continue;
    }
    sim2.resetTask(v);
    sim2.clearCombat(v);
    v.post = -1;
    n++;
    sim2.returnScoutMount(v);
    if (v.arm === "cavalry" && sim2.roleCount("cavalry") < sim2.roleCapacity("cavalry")) v.job = "fight";
    else v.job = "idle";
  }
  return n ? null : away ? "\u0110ang \u0111i trinh s\xE1t: \u0111\u1EE3i h\u1ECD v\u1EC1" : "Ch\u1ECDn trinh s\xE1t \u0111\u1EC3 cho ngh\u1EC9";
}
var scoutSkill = (v) => {
  const w = SIEGE.scout.weights, sk = (w.agi * v.stats.agi + w.sta * v.stats.sta) / 6;
  return sk * (1 + gearOf(v, SIEGE.scout.gearSkill));
};
function gearOf(v, table) {
  return (v.weapon ? table.weapon : 0) + (v.armor ? table.armor : 0) + (v.torch ? table.torch : 0) + (v.mount || v.arm === "cavalry" ? table.mount : 0);
}
var stealthOf = (v) => 0.6 * v.stats.agi + 0.4 * v.stats.sta;
var scoutsNeeded = (sim2, tribe, level) => Math.min(8, level + 1 + Math.floor(warriorsOf(sim2, tribe) / 8));
function drawChance(skills, need) {
  if (skills.length < 2) return 0;
  return Math.min(0.95, skills.reduce((a, b) => a + b, 0) / need);
}
var surveyTime = (sim2, level, scouts, int = 6) => 0.2 * level * sim2.dayLen / ((1 + 0.35 * (Math.max(1, scouts) - 1)) * Math.max(0.5, 1 + SIEGE.scout.surveyPerInt * (int - 6)));
function planScout(sim2, ids2, tribe) {
  const level = scoutLevel(sim2), limit = scoutLimit(sim2), scouts = sim2.mine(ids2).filter((v) => canScout(sim2, v));
  const need = scoutsNeeded(sim2, tribe, Math.max(1, level)), w = whereIs(sim2, tribe);
  const speed = scouts.length ? scouts.reduce((a, v) => a + v.speed * sim2.mountSpeed(v) * (1 + SIEGE.scout.walkPerSta * (v.stats.sta - 6)), 0) / scouts.length : 2, walk = w ? Math.max(0, w.dist - 15) / speed : 0;
  const survey = surveyTime(sim2, Math.max(1, level), scouts.length, scouts.length ? scouts.reduce((a, v) => a + v.stats.agi, 0) / scouts.length : 6);
  let error = null;
  if (!sim2.dev.freeBuild && !isFound(sim2, tribe)) error = "Ch\u01B0a ai t\xECm th\u1EA5y l\xE0ng n\xE0y";
  else if (!tribeOf(sim2, tribe)) error = "Kh\xF4ng c\xF3 l\xE0ng n\xE0y";
  else if (!limit) error = "C\u1EA7n d\u1EF1ng Tr\u1EA1i trinh s\xE1t";
  else if (sim2.scouts.some((m) => m.tribe === tribe && m.phase === "back")) error = "Trinh s\xE1t \u0111ang tr\xEAn \u0111\u01B0\u1EDDng v\u1EC1: \u0111\u1EE3i h\u1ECD v\u1EC1 r\u1ED3i c\u1EED ti\u1EBFp";
  else if (!scouts.length) error = "Ch\u1ECDn trinh s\xE1t \u0111\u1EC3 c\u1EED \u0111i (tuy\u1EC3n \u1EDF Tr\u1EA1i trinh s\xE1t)";
  else if (scouts.length > limit - (sim2.scouts.find((m) => m.tribe === tribe)?.ids.length ?? 0)) error = `Tr\u1EA1i trinh s\xE1t ch\u1EC9 cho \u0111i ${limit} ng\u01B0\u1EDDi m\u1ED9t chuy\u1EBFn (\u0111ang c\xF3 ${sim2.scouts.find((m) => m.tribe === tribe)?.ids.length ?? 0} ng\u01B0\u1EDDi \u1EDF \u0111\xF3)`;
  return { level, need, count: scouts.length, limit, chance: drawChance(scouts.map(scoutSkill), need), walk, survey, total: 2 * walk + survey, error };
}
function walkScout(sim2, v, x, y) {
  const goal = sim2.nearestFree(x, y, /* @__PURE__ */ new Set()) ?? [x, y];
  sim2.resetTask(v);
  sim2.clearCombat(v);
  v.path = sim2.pathTo(v, goal[0], goal[1], 3e4);
  v.phase = v.path.length ? "move" : "idle";
}
function watchSpot(sim2, t, i) {
  const fire2 = sim2.campfire(), fx = fire2 ? fire2.x + 1 : sim2.world.start.x, fy = fire2 ? fire2.y + 1 : sim2.world.start.y;
  const dx = fx - t.camp.x, dy = fy - t.camp.y, len = Math.max(1, Math.hypot(dx, dy)), reach = Math.min(len, 15);
  const spotX = t.camp.x + dx / len * reach, spotY = t.camp.y + dy / len * reach;
  return sim2.nearestFree(Math.floor(spotX + Math.cos(i * 2.4) * 2), Math.floor(spotY + Math.sin(i * 2.4) * 2), /* @__PURE__ */ new Set()) ?? [Math.floor(spotX), Math.floor(spotY)];
}
function keepGoing(sim2, m, t, alive2) {
  const fire2 = sim2.campfire();
  alive2.forEach((v, i) => {
    if (v.path.length || v.slide || v.phase === "move" || v.phase === "sleep" || v.phase === "goHome" || v.phase === "flee" || v.inside !== null) return;
    if (m.phase === "back") {
      if (fire2 && Math.hypot(v.x - fire2.x, v.y - fire2.y) >= 7) walkScout(sim2, v, Math.floor(fire2.x + 1), Math.floor(fire2.y + 3));
      return;
    }
    if (Math.hypot(v.x - t.camp.x, v.y - t.camp.y) < 22) return;
    const spot2 = watchSpot(sim2, t, i);
    walkScout(sim2, v, spot2[0], spot2[1]);
  });
}
function startScout(sim2, ids2, tribe) {
  const plan2 = planScout(sim2, ids2, tribe), t = tribeOf(sim2, tribe);
  if (plan2.error || !t) return plan2.error ?? "Kh\xF4ng c\xF3 l\xE0ng n\xE0y";
  const scouts = sim2.mine(ids2).filter((v) => canScout(sim2, v));
  const fire2 = sim2.campfire(), fx = fire2 ? fire2.x + 1 : sim2.world.start.x, fy = fire2 ? fire2.y + 1 : sim2.world.start.y;
  void fx;
  void fy;
  scouts.forEach((v, i) => {
    sim2.exitBuilding(v);
    v.out = false;
    v.recall = false;
    sim2.resetTask(v);
    sim2.clearCombat(v);
    const spot2 = watchSpot(sim2, t, i);
    sim2.orderMove([v.id], spot2[0], spot2[1]);
  });
  const going = sim2.scouts.find((m) => m.tribe === tribe);
  if (going) {
    going.ids.push(...scouts.map((v) => v.id));
    going.sent = (going.sent ?? 0) + scouts.length;
    sim2.say(`${scouts.length} trinh s\xE1t n\u1EEFa l\xEAn \u0111\u01B0\u1EDDng t\u1EDBi ${t.def.name} \u0111\u1EC3 v\u1EBD ti\u1EBFp b\u1EA3n \u0111\u1ED3 (\u0111\xE3 v\u1EBD ${Math.round((going.progress ?? 0) * 100)}%).`);
    return null;
  }
  const level = Math.max(1, plan2.level), start = sim2.drafts[`${tribe}:${level}`] ?? 0;
  sim2.scouts.push({ id: sim2.nextMission++, tribe, level, ids: scouts.map((v) => v.id), phase: "go", t: 0, need: plan2.need, survivors: scouts.length, sent: scouts.length, progress: start, rolled: [] });
  sim2.say(`${scouts.length} trinh s\xE1t l\xEAn \u0111\u01B0\u1EDDng t\u1EDBi ${t.def.name} \u0111\u1EC3 v\u1EBD b\u1EA3n \u0111\u1ED3 c\u1EA5p ${Math.max(1, plan2.level)}: kho\u1EA3ng ${Math.round(plan2.chance * 100)}% v\u1EBD \u0111\u1EE7 chi ti\u1EBFt, c\u1EA3 chuy\u1EBFn m\u1EA5t ch\u1EEBng ${Math.max(1, Math.round(plan2.total / 60))} ph\xFAt.`);
  return null;
}
function deathParts(sim2, m, v) {
  const t = tribeOf(sim2, m.tribe), pc = (x) => `${x >= 0 ? "+" : "\u2212"}${Math.round(Math.abs(x) * 1e3) / 10}%`;
  const warriors = warriorsOf(sim2, m.tribe), power = warriors * (1 + (t.mil ?? 0));
  const day = sim2.weather === "clear" && !sim2.resting;
  const strong = power / 5 / 100, light = (day ? 0.1 : 0) - (sim2.resting ? 0.1 : 0);
  const stealth = Math.max(0, (stealthOf(v) - 6) * SIEGE.scout.stealthPerPoint + (v.stats.agi - 6) * 5e-3), gear2 = gearOf(v, SIEGE.scout.gearHide);
  const raw = 0.1 + strong + light - stealth - gear2, chance = Math.max(0.02, Math.min(0.9, raw));
  const lines = [
    `C\u01A1 b\u1EA3n: ${pc(0.1)}`,
    `L\xE0ng c\xF3 ${warriors} l\xEDnh canh: ${pc(strong)}`,
    day ? `Ban ng\xE0y tr\u1EDDi quang, d\u1EC5 b\u1ECB th\u1EA5y: ${pc(0.1)}` : sim2.resting ? `Ban \u0111\xEAm, kh\xF3 b\u1ECB th\u1EA5y: ${pc(-0.1)}` : "Tr\u1EDDi \xE2m u: 0%",
    `S\u1EF1 kh\xE9o l\xE9o c\u1EE7a ${v.name} (Nhanh nh\u1EB9n, Th\u1EC3 l\u1EF1c): ${pc(-stealth)}`,
    gear2 > 0 ? `Trang b\u1ECB che gi\u1EA5u (gi\xE1p, \u0111u\u1ED1c, v\u0169 kh\xED): ${pc(-gear2)}` : "Kh\xF4ng c\xF3 trang b\u1ECB che gi\u1EA5u: 0%"
  ];
  if (raw !== chance) lines.push(raw < chance ? `T\u1ED1i thi\u1EC3u 2%: n\xE2ng l\xEAn ${Math.round(chance * 100)}%` : `T\u1ED1i \u0111a 90%: gi\u1EA3m xu\u1ED1ng ${Math.round(chance * 100)}%`);
  return { chance, lines };
}
function noteScoutLoss(sim2, v, cause, detail = "") {
  const m = sim2.scouts.find((x) => x.ids.includes(v.id)), t = m ? tribeOf(sim2, m.tribe) : void 0;
  if (!m || sim2.scoutLosses.some((l) => l.vid === v.id && l.at === sim2.time)) return;
  sim2.scoutLosses.push({ at: sim2.time, day: sim2.day, vid: v.id, name: v.name, tribe: m.tribe, dist: t ? Math.round(Math.hypot(v.x - t.camp.x, v.y - t.camp.y)) : -1, cause, detail });
}
var awayScout = (sim2, v) => v.job === "scout" && sim2.scouts.some((m) => m.ids.includes(v.id));
function recallScouts(sim2, tribe) {
  const m = sim2.scouts.find((x) => x.tribe === tribe);
  if (!m || m.phase === "back") return "Kh\xF4ng c\xF3 trinh s\xE1t n\xE0o \u0111ang \u1EDF \u0111\xF3 \u0111\u1EC3 g\u1ECDi v\u1EC1";
  m.recall = true;
  if (m.phase === "go") sendHome(sim2, m);
  return null;
}
function sendHome(sim2, m) {
  m.phase = "back";
  m.t = 0;
  const fire2 = sim2.campfire();
  for (const id of m.ids) {
    const v = sim2.byId.get(id);
    if (v && fire2) walkScout(sim2, v, Math.floor(fire2.x + 1), Math.floor(fire2.y + 3));
  }
}
function scoutFlow(sim2, tribe) {
  const m = sim2.scouts.find((x) => x.tribe === tribe), level = Math.max(1, m?.level ?? scoutLevel(sim2));
  const finished = sim2.maps.some((x) => x.tribe === tribe && x.level >= level && !m), progress2 = m ? m.progress ?? 0 : finished ? 1 : sim2.drafts[`${tribe}:${level}`] ?? 0;
  const survey = STEPS.filter((st) => st.level <= level), n = survey.length;
  const arrived = !!m && m.phase !== "go" || progress2 > 0;
  const steps = [
    { label: "Trinh s\xE1t l\xEAn \u0111\u01B0\u1EDDng t\u1EDBi ng\xF4i l\xE0ng", done: !!m || progress2 > 0 || finished },
    { label: "T\u1EDBi g\u1EA7n ng\xF4i l\xE0ng", done: arrived || finished },
    ...survey.map((st, i) => ({ label: st.label, done: finished || progress2 >= (i + 1) / n - 1e-6 })),
    { label: "Tr\u1EDF v\u1EC1 l\xE0ng, b\xE1o b\u1EA3n \u0111\u1ED3", done: finished }
  ];
  return { level, progress: progress2, steps, active: !!m };
}
function tickScouts(sim2, dt) {
  tickSightings(sim2, dt);
  for (let i = sim2.scouts.length - 1; i >= 0; i--) {
    const m = sim2.scouts[i], t = tribeOf(sim2, m.tribe);
    const alive2 = m.ids.map((id) => sim2.byId.get(id)).filter((v) => !!v && v.team === "player" && v.health > 0);
    m.ids = alive2.map((v) => v.id);
    if (!alive2.length || !t) {
      sim2.say(alive2.length ? "Trinh s\xE1t b\u1ECB h\u1EE7y." : "M\u1EA5t h\u1EBFt trinh s\xE1t: b\u1EA3n \u0111\u1ED3 ch\u01B0a v\u1EC1, c\u1EED ng\u01B0\u1EDDi kh\xE1c \u0111i v\u1EBD ti\u1EBFp.");
      sim2.scouts.splice(i, 1);
      continue;
    }
    m.t += dt;
    m.progress ??= 0;
    m.rolled ??= [];
    m.nudge = (m.nudge ?? 0) - dt;
    if (m.nudge <= 0) {
      m.nudge = 5;
      keepGoing(sim2, m, t, alive2);
    }
    if (m.phase === "go" && m.t > 900 && !m.recall) {
      m.recall = true;
      sim2.say(`Trinh s\xE1t kh\xF4ng t\u1EDBi \u0111\u01B0\u1EE3c ${t.def.name} (\u0111\u01B0\u1EDDng b\u1ECB ch\u1EB7n?): g\u1ECDi v\u1EC1.`);
      sendHome(sim2, m);
    }
    const fire2 = sim2.campfire();
    if (m.phase !== "back") {
      const arrived = alive2.filter((v) => Math.hypot(v.x - t.camp.x, v.y - t.camp.y) < 22 && !v.path.length);
      for (const v of arrived) if (!m.rolled.includes(v.id)) {
        m.rolled.push(v.id);
        const risk = deathParts(sim2, m, v);
        if (sim2.frnd() < risk.chance) {
          noteScoutLoss(sim2, v, "b\u1ECB ph\xE1t hi\u1EC7n khi th\xE1m th\xEDnh l\xE0ng", `X\xE1c su\u1EA5t b\u1ECB ph\xE1t hi\u1EC7n ${Math.round(risk.chance * 100)}%:
${risk.lines.join("\n")}`);
          sim2.killUnit(v, "v\xEC b\u1ECB ph\xE1t hi\u1EC7n khi trinh s\xE1t");
        }
      }
      const here = arrived.filter((v) => v.health > 0 && sim2.byId.has(v.id));
      m.survivors = alive2.filter((v) => v.health > 0 && sim2.byId.has(v.id)).length;
      if (m.phase === "go" && here.length) {
        m.phase = "watch";
        m.t = 0;
        if (m.level >= 2 && !m.seen) m.seen = seenNow(sim2, t);
        sim2.say(`Trinh s\xE1t \u0111ang quan s\xE1t ${t.def.name}.`);
      }
      if (m.phase === "watch") {
        if (here.length) m.progress = Math.min(1, m.progress + dt / surveyTime(sim2, m.level, here.length, here.reduce((a, v) => a + v.stats.agi, 0) / here.length));
        if (m.progress >= 1 || m.recall) {
          sim2.say(m.progress >= 1 ? `\u0110\xE3 v\u1EBD xong b\u1EA3n \u0111\u1ED3 ${t.def.name}: trinh s\xE1t quay v\u1EC1.` : `Trinh s\xE1t \u0111\u01B0\u1EE3c g\u1ECDi v\u1EC1 khi m\u1EDBi v\u1EBD ${Math.round(m.progress * 100)}%.`);
          sendHome(sim2, m);
        }
      }
    } else {
      const home = !fire2 || alive2.every((v) => Math.hypot(v.x - fire2.x, v.y - fire2.y) < 7);
      if (home || m.t > 600) {
        const key = `${m.tribe}:${m.level}`;
        if ((m.progress ?? 0) >= 1) {
          const skills = alive2.map(scoutSkill), chance = drawChance(skills, m.need), full = sim2.frnd() < chance;
          const gaps = full ? 0 : Math.max(1, Math.ceil(m.need - skills.reduce((a, b) => a + b, 0)));
          const old = sim2.maps.findIndex((x) => x.tribe === m.tribe && x.level === m.level);
          const map = { tribe: m.tribe, level: m.level, at: sim2.time, gaps, seen: m.seen };
          if (old >= 0) sim2.maps[old] = map;
          else sim2.maps.push(map);
          delete sim2.drafts[key];
          sim2.say(`Trinh s\xE1t v\u1EC1 (${alive2.length}/${m.sent ?? alive2.length} ng\u01B0\u1EDDi): b\u1EA3n \u0111\u1ED3 c\u1EA5p ${m.level} c\u1EE7a ${t.def.name}${full ? " \u0111\u1EA7y \u0111\u1EE7 chi ti\u1EBFt" : `, nh\u01B0ng c\xF2n h\u1EDF (thi\u1EBFu ${gaps} m\u1EA3nh, t\u1EC9 l\u1EC7 v\u1EBD \u0111\u1EE7 ch\u1EC9 ${Math.round(chance * 100)}%)`}.`);
        } else {
          sim2.drafts[key] = Math.max(sim2.drafts[key] ?? 0, m.progress ?? 0);
          sim2.say(`Trinh s\xE1t v\u1EC1 (${alive2.length}/${m.sent ?? alive2.length} ng\u01B0\u1EDDi): m\u1EDBi v\u1EBD ${Math.round((m.progress ?? 0) * 100)}% b\u1EA3n \u0111\u1ED3 ${t.def.name}; c\u1EED ng\u01B0\u1EDDi \u0111i v\u1EBD ti\u1EBFp.`);
        }
        sim2.scouts.splice(i, 1);
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
  pile: { level: 3, label: "Kho l\u01B0\u01A1ng" },
  house: { level: 2, label: "Nh\xE0" }
};
var spread = (id, salt) => {
  const x = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
function seenNow(sim2, t) {
  const out = [];
  for (const id of t.unitIds) {
    const u = sim2.get(id);
    if (!u || u.health <= 0) continue;
    out.push({ x: Math.round(u.x * 10) / 10, y: Math.round(u.y * 10) / 10, arm: armOfWeapon(u.weapon), weapon: u.weapon ?? null, civ: u.ai?.role === "civ", leader: u.id === t.leaderId });
  }
  const crowd2 = t.crowd, inWorld = out.filter((o) => !o.civ).length;
  if (crowd2) for (let i = 0; i < crowd2.guards + crowd2.civs; i++) {
    const civ = i >= crowd2.guards, w = civ ? null : t.def.weapons[(inWorld + i) % t.def.weapons.length], a = spread(i + 7, 3) * Math.PI * 2, r = 1.5 + spread(i + 7, 5) * 4.5;
    out.push({ x: Math.round((t.camp.x + Math.cos(a) * r) * 10) / 10, y: Math.round((t.camp.y + Math.sin(a) * r) * 10) / 10, arm: armOfWeapon(w), weapon: w, civ, leader: false });
  }
  return out;
}
var WORK_INFO = {
  fire: "\u0110\u1ED1ng l\u1EEDa c\u1EE7a h\u1ECD: t\xE2m l\xE0ng, quanh \u0111\xE2y d\xE2n v\xE0 l\xEDnh t\u1EE5 l\u1EA1i.",
  tower: "Ch\xF2i canh: cung th\u1EE7 \u0111\u1EE9ng cao b\u1EAFn xa h\u01A1n, ph\u1EA3i ph\xE1 ch\xF2i m\u1EDBi h\u1EA1 \u0111\u01B0\u1EE3c h\u1ECD.",
  fence: "H\xE0ng r\xE0o: ch\u1EB7n \u0111\u01B0\u1EDDng, ph\u1EA3i ph\xE1 ho\u1EB7c \u0111i v\xF2ng.",
  gate: "C\u1ED5ng: l\u1ED1i v\xE0o l\xE0ng, \u0111\xF3ng th\xEC ch\u1EB7n \u0111\u01B0\u1EDDng.",
  pile: "Kho l\u01B0\u01A1ng: ch\u1ED7 h\u1ECD c\u1EA5t th\u1EE9c \u0103n v\xE0 \u0111\u1ED3 c\u1ED1ng n\u1EA1p.",
  house: "Nh\xE0 c\u1EE7a l\xE0ng: c\xE0ng nhi\u1EC1u nh\xE0 c\u1EA5p cao th\xEC l\xE0ng c\xE0ng \u0111\xF4ng v\xE0 m\u1EA1nh."
};
function freeNear(sim2, x, y) {
  for (let r = 0; r <= 8; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (Math.max(Math.abs(i), Math.abs(j)) === r && !sim2.world.isBlocked(Math.floor(x) + i, Math.floor(y) + j)) return [Math.floor(x) + i, Math.floor(y) + j];
  return null;
}
function entryRoute(sim2, camp, box, toUs) {
  const fire2 = sim2.campfire(), from = freeNear(sim2, (fire2?.x ?? sim2.world.start.x) + 1, (fire2?.y ?? sim2.world.start.y) + 3);
  const to = freeNear(sim2, camp.x + (toUs?.x ?? 0) * (YARD + 1), camp.y + (toUs?.y ?? 0) * (YARD + 1));
  if (!from || !to) return [];
  const path = findPath(sim2.world, from[0], from[1], to[0], to[1], 7e4);
  const last = path[path.length - 1];
  if (!last || last[0] !== to[0] || last[1] !== to[1]) return [];
  const inside = path.filter(([x, y]) => x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1);
  return inside.filter((_, i) => i % 3 === 0 || i === inside.length - 1).map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
}
function tribeIntel(sim2, tribe) {
  const t = tribeOf(sim2, tribe);
  if (!t) return null;
  const level = sim2.dev.freeBuild ? 3 : mapLevel(sim2, tribe);
  if (!level) return null;
  const held = sim2.maps.filter((m) => m.tribe === tribe && (m.gaps > 0 ? m.level - 1 : m.level) >= level).sort((a, b) => b.at - a.at)[0];
  const accuracy = sim2.dev.freeBuild || !held ? 1 : mapAccuracy(sim2, held), gaps = sim2.dev.freeBuild ? 0 : held?.gaps ?? 0;
  const N = sim2.world.size, ry = YARD + MARGIN, rx = Math.round(ry * 1.9);
  const x0 = Math.max(0, Math.min(N - 2 * rx, Math.floor(t.camp.x) - rx)), y0 = Math.max(0, Math.min(N - 2 * ry, Math.floor(t.camp.y) - ry));
  const box = { x0, y0, x1: x0 + 2 * rx, y1: y0 + 2 * ry };
  const fire2 = sim2.campfire(), dx = (fire2?.x ?? sim2.world.start.x) - t.camp.x, dy = (fire2?.y ?? sim2.world.start.y) - t.camp.y, len = Math.hypot(dx, dy);
  ensureLayout(sim2, t);
  const seen = sim2.dev.freeBuild || !held?.seen ? seenNow(sim2, t) : held.seen;
  const soldiers = level >= 3 ? { foot: 0, archer: 0, cavalry: 0 } : null;
  const people = [];
  if (level >= 2) seen.forEach((u, i) => {
    if (spread(i + 1, 1) < Math.min(0.6, gaps * 0.2)) return;
    const mark = level < 3 ? "unknown" : u.civ ? "civ" : u.arm;
    if (soldiers && !u.civ) soldiers[u.arm]++;
    people.push({ x: u.x, y: u.y, mark, leader: level >= 3 && u.leader, weapon: level >= 3 ? u.weapon : null });
  });
  const route2 = entryRoute(sim2, t.camp, box, len > 0 ? { x: dx / len, y: dy / len } : null);
  const others = sim2.tribes.filter((o) => o !== t && o.state !== "destroyed" && isFound(sim2, o.id)).map((o) => ({ name: o.def.name, x: o.camp.x, y: o.camp.y, r: YARD, ours: false }));
  others.push({ name: "L\xE0ng c\u1EE7a ta", x: (fire2?.x ?? sim2.world.start.x) + 1, y: (fire2?.y ?? sim2.world.start.y) + 1, r: 12, ours: true });
  const reach = (o) => o.x > box.x0 - o.r && o.x < box.x1 + o.r && o.y > box.y0 - o.r && o.y < box.y1 + o.r;
  const loot = Object.entries(spoilsOf(t, sim2.era)).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => `${Math.round(v)} ${RES_NAME[k].toLowerCase()}`).join(", ");
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
    route: route2,
    others: others.filter(reach),
    population: Math.max(2, Math.round(seen.length / 2) * 2),
    structures: t.props.filter((p) => (WORKS[p.kind]?.level ?? 9) <= level).map((p) => ({ kind: p.kind, label: p.b ? BUILDINGS[p.b].name : WORKS[p.kind].label, detail: p.kind === "pile" && loot ? `${WORK_INFO.pile} C\xF3 kho\u1EA3ng ${loot}.` : WORK_INFO[p.kind] ?? "", x: p.x, y: p.y, w: p.w, h: p.h })),
    people,
    soldiers
  };
}

// src/sim/rest.ts
var REST = rest_default;
var NIGHT_SHARE = SEASONS.reduce((n, s) => {
  const { rise, set } = sunTimes(s);
  return n + (rise - TWILIGHT / 2) + (1 - set - TWILIGHT / 2);
}, 0) / SEASONS.length;
var torchLife = (sim2) => 2 * NIGHT_SHARE * sim2.dayLen;
var dayHours = (sim2) => sim2.dayLen * 0.65;
var nightHours = (sim2) => sim2.dayLen * 0.35;
var clamp = (x, a, b) => Math.max(a, Math.min(b, x));
var fit = (v) => clamp((v.stats.vit + v.stats.sta) / 20, 0, 1);
var hpFrac = (v) => clamp(v.health / v.maxHealth, 0, 1);
function maxEnergy(_sim, v) {
  return 100 - v.strain * REST.strain.capLoss;
}
function drainRate(sim2, v) {
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
  const cond = (1.25 - 0.25 * fit(v)) * (1.3 - 0.3 * hpFrac(v));
  return REST.dayCost / dayHours(sim2) * k * cond * drainScale(sim2, v);
}
function bedsTaken(sim2, b, except) {
  return sim2.villagers.filter((o) => o !== except && (o.phase === "sleep" && o.inside === b.id || o.phase === "goHome" && o.target === b.id)).length;
}
function freeBed(sim2, v) {
  const kind = homeKind(v);
  let best, bd = Infinity;
  for (const b of sim2.buildings) {
    if (b.kind !== kind || !b.done || bedsTaken(sim2, b, v) >= levelDef(b).slots) continue;
    const d = Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
function bedFactor(sim2, v) {
  const role = treeRole(v);
  return (v.job === "fight" ? REST.soldierRest : 1) * (1 + (role ? statBonus(sim2.researched, role, "restregen") : 0) / 100);
}
function sleepRate(sim2, v) {
  if (civilian(v) && attackReason(sim2) !== null) return 0;
  const base = (sim2.resting ? REST.sleepNight : REST.sleepDay) / nightHours(sim2);
  const q = (0.8 + 0.4 * fit(v)) * (0.7 + 0.3 * hpFrac(v)) * Math.max(0.3, 1 - v.strain * REST.strain.recoveryLoss);
  return base * q * bedFactor(sim2, v);
}
var attackCache = /* @__PURE__ */ new WeakMap();
function attackReason(sim2) {
  const c = attackCache.get(sim2);
  if (c && c.t === sim2.time) return c.why;
  let why = null;
  const raid = sim2.tribes.find((t) => t.raid && t.raid.phase === "march");
  if (raid) why = `${raid.def.name} \u0111ang ti\u1EBFn v\xE0o l\xE0ng`;
  else {
    const fire2 = sim2.campfire(), cx = fire2 ? fire2.x + 1 : sim2.world.start.x, cy = fire2 ? fire2.y + 1 : sim2.world.start.y;
    const beast = sim2.animals.find((a) => a.state === "attack" && (a.target?.kind === "unit" || a.siege !== void 0) && Math.hypot(a.x - cx, a.y - cy) < 30);
    if (beast) why = beast.siege !== void 0 ? "Th\xFA d\u1EEF \u0111ang ph\xE1 nh\xE0" : "Th\xFA d\u1EEF \u0111ang t\u1EA5n c\xF4ng ng\u01B0\u1EDDi g\u1EA7n l\xE0ng";
    else if (sim2.foes.some((f) => f.ai?.role === "raider" && f.health > 0 && Math.hypot(f.x - cx, f.y - cy) < 40)) why = "\u0110\u1ECBch \u0111ang \u1EDF quanh l\xE0ng";
  }
  attackCache.set(sim2, { t: sim2.time, why });
  if (why) sim2.dangerAt = sim2.time;
  return why;
}
function skipNightBlock(sim2) {
  if (!sim2.resting) return "Ch\u1EC9 tua qua \u0111\u01B0\u1EE3c ban \u0111\xEAm";
  const why = attackReason(sim2);
  if (why) return `${why}: ch\u01B0a tua \u0111\u01B0\u1EE3c`;
  if (sim2.tribes.some((t) => t.raid)) return "M\u1ED9t cu\u1ED9c t\u1EA5n c\xF4ng \u0111ang di\u1EC5n ra: ch\u01B0a tua \u0111\u01B0\u1EE3c";
  if (sim2.animals.some((a) => a.raid && a.state !== "dead")) return "Th\xFA d\u1EEF c\xF2n r\xECnh quanh l\xE0ng: ch\u01B0a tua \u0111\u01B0\u1EE3c";
  const awake = sim2.villagers.filter((v) => v.team === "player" && v.down <= 0 && v.phase !== "sleep" && !v.guard).length;
  if (awake) return `C\xF2n ${awake} ng\u01B0\u1EDDi ch\u01B0a ng\u1EE7: ch\u01B0a tua \u0111\u01B0\u1EE3c`;
  return null;
}
var civilian = (v) => v.job !== "fight" && v.job !== "hunt" && v.job !== "scout" && v.job !== "supply";
var SAFE_AFTER = 30;
function hides(sim2, v) {
  return v.inside !== null && v.phase === "sleep" && (civilian(v) && (attackReason(sim2) !== null || sim2.time - sim2.dangerAt < SAFE_AFTER) || quartered(sim2, v));
}
function sleepLocked(sim2, v) {
  if (hides(sim2, v)) return false;
  return v.lockUntil > 0 && v.energy < v.lockUntil && (v.phase === "sleep" || v.phase === "goHome");
}
function restFactor(sim2, v) {
  const night = sim2.resting ? REST.nightEfficiency : 1;
  const tired = v.energy >= REST.tiredBelow ? 1 : REST.tiredEfficiency + (1 - REST.tiredEfficiency) * (v.energy / REST.tiredBelow);
  return night * tired;
}
function torchCount(sim2) {
  return (sim2.toolStock.torch1 ?? 0) + sim2.wornTools.filter((w) => w.id === "torch1" && w.dur > 0).length;
}
function ensureTorch(sim2, v) {
  if (v.torch) return true;
  if ((sim2.toolStock.torch1 ?? 0) > 0) {
    sim2.toolStock.torch1--;
    v.torch = { dur: torchLife(sim2) };
    return true;
  }
  let best = -1;
  sim2.wornTools.forEach((w, i) => {
    if (w.id === "torch1" && w.dur > 0 && (best < 0 || w.dur > sim2.wornTools[best].dur)) best = i;
  });
  if (best >= 0) {
    v.torch = { dur: sim2.wornTools.splice(best, 1)[0].dur };
    return true;
  }
  return false;
}
function returnTorch(sim2, v) {
  const t = v.torch;
  if (!t) return;
  v.torch = null;
  if (t.dur <= 5) return;
  if (t.dur >= torchLife(sim2) - 1) sim2.toolStock.torch1 = (sim2.toolStock.torch1 ?? 0) + 1;
  else sim2.wornTools.push({ id: "torch1", dur: t.dur });
}
function giveTorch(sim2, ids2) {
  let short = false, given = 0;
  for (const v of sim2.mine(ids2)) {
    if (v.torch) continue;
    if (ensureTorch(sim2, v)) {
      given++;
      sim2.say(`${v.name} c\u1EA7m \u0111u\u1ED1c.`);
    } else short = true;
  }
  return short && !given ? "Kho h\u1EBFt \u0111u\u1ED1c, h\xE3y ch\u1EBF th\xEAm \u1EDF Nh\xE0 ch\u1EBF t\u1EA1o" : null;
}
function onShift(sim2, v) {
  if (v.nightOwl) return true;
  if (v.out && (v.job === "fight" || v.job === "scout" || v.job === "supply")) return true;
  if (v.job === "supply") return !sim2.resting;
  if (v.job === "fight" && sim2.warLock()) return true;
  const night = sim2.resting;
  if (v.job === "idle") return v.shift === "both" || !night;
  if (v.job === "fight" && v.guard) return v.shift === "both" || (v.shift === "night" ? night : !night);
  if (v.job === "fight") return !night;
  if (v.shift === "both") return true;
  return v.shift === "night" ? night : !night;
}
var indoors = (v) => isStaffJob(v.job) || v.job === "food" && v.post >= 0;
function onDuty(sim2, v) {
  if (!onShift(sim2, v)) return false;
  if (sim2.resting && v.job !== "fight" && v.job !== "idle" && !indoors(v)) return ensureTorch(sim2, v);
  return true;
}
function callUp(sim2, v) {
  if (sleepLocked(sim2, v) || v.energy < REST.tired) return false;
  if (onShift(sim2, v)) return true;
  if (v.job === "fight") {
    v.nightOwl = true;
    return true;
  }
  if (v.job === "idle") return false;
  if (sim2.resting && !ensureTorch(sim2, v)) return false;
  v.nightOwl = true;
  return true;
}
var drainCache = /* @__PURE__ */ new WeakMap();
function drainNow(sim2, v) {
  const c = drainCache.get(v);
  if (c && sim2.time - c.t < 1 && sim2.time >= c.t) return c.r;
  const r = drainRate(sim2, v);
  drainCache.set(v, { t: sim2.time, r });
  return r;
}
function tickEnergy(sim2, v, dt) {
  const top = maxEnergy(sim2, v);
  if (v.phase === "sleep") {
    v.energy = Math.min(top, v.energy + sleepRate(sim2, v) * dt);
    v.strain = Math.max(0, v.strain - (sim2.resting ? REST.strain.nightSleep : REST.strain.daySleep) * dt);
  } else if (!sim2.dev.noTire && !(v.job === "fight" && sim2.warLock() && !sim2.warIds.has(v.id)) && !awayScout(sim2, v)) {
    const working = v.job !== "idle" && (v.phase === "work" || v.phase === "build" || v.phase === "craft" || v.phase === "inside" || v.phase === "fight");
    v.energy = Math.max(0, v.energy - drainNow(sim2, v) * dt * (sim2.warIds.has(v.id) ? sim2.march.energy : 1));
    if (sim2.resting && working) {
      v.strain = Math.min(100, v.strain + REST.strain.nightWork * dt);
    }
  }
  if (v.energy > top) v.energy = top;
  if (sim2.resting && v.team === "player" && v.job === "fight" && !v.torch && v.inside === null && v.phase !== "sleep" && v.phase !== "goHome" && Math.floor(sim2.time) !== Math.floor(sim2.time - dt) && (Math.floor(sim2.time) + v.id) % 3 === 0) ensureTorch(sim2, v);
  if (v.torch && sim2.resting && v.phase !== "sleep") {
    v.torch.dur -= dt;
    if (v.torch.dur <= 0) {
      v.torch = null;
      sim2.say(`\u0110u\u1ED1c c\u1EE7a ${v.name} \u0111\xE3 ch\xE1y h\u1EBFt.`);
    }
  }
}
function quartered(sim2, v) {
  const soldier = v.job === "fight" && v.post < 0 && !(v.guard && !v.housed), scout = v.job === "scout" && !awayScout(sim2, v), supply = v.job === "supply";
  if (v.team !== "player" || !(soldier || scout || supply)) return false;
  if (sim2.alarmUntil > sim2.time || sim2.warLock() || v.out) return false;
  const camp = v.inside === null ? void 0 : sim2.getBuilding(v.inside);
  return !!camp && camp.kind === homeKind(v) || !!freeBed(sim2, v);
}
function shouldSleep(sim2, v, fighting) {
  if (fighting) return false;
  if (sim2.warIds.has(v.id)) {
    v.lockUntil = 0;
    return !v.nightOwl && !v.path.length && sim2.sleepsInTent(v);
  }
  if (awayScout(sim2, v)) {
    v.lockUntil = 0;
    return false;
  }
  if (v.job === "fight" && sim2.warLock()) {
    v.lockUntil = 0;
    return false;
  }
  if (quartered(sim2, v)) return true;
  if (sim2.warLock() && v.team === "player" && v.job !== "fight" && !awayScout(sim2, v)) return true;
  if (v.lockUntil > 0) {
    if (v.energy >= v.lockUntil) v.lockUntil = 0;
    else return true;
  }
  if (v.energy < REST.tired) {
    const collapse = v.energy < REST.collapse;
    v.lockUntil = collapse ? REST.wakeAfterCollapse : REST.wakeAfterTired;
    if (collapse) v.strain = Math.min(100, v.strain + REST.strain.collapse);
    sim2.say(`${v.name} ${collapse ? "ki\u1EC7t s\u1EE9c, ng\xE3 xu\u1ED1ng ng\u1EE7 say" : "m\u1EC7t, \u0111i ng\u1EE7"}.`);
    return true;
  }
  return !onDuty(sim2, v);
}
function bedsIn(sim2, kind) {
  return sim2.buildings.reduce((n, b) => n + (b.kind === kind && b.done ? levelDef(b).slots : 0), 0);
}

// src/sim/economy.ts
function missing(sim2, cost) {
  for (const r of Object.keys(cost)) if (sim2.stock[r] < (cost[r] ?? 0)) return `Thi\u1EBFu ${RES_NAME[r].toLowerCase()} (c\u1EA7n ${cost[r]})`;
  return null;
}
function affordable(sim2, cost) {
  return Object.keys(cost).every((k) => sim2.stock[k] >= (cost[k] ?? 0));
}
function pay(sim2, cost, sign = -1) {
  for (const k of Object.keys(cost)) sim2.stock[k] += sign * (cost[k] ?? 0);
}
function barter(sim2, res) {
  const n = BARTER[res];
  if (sim2.stock[res] < n) return `C\u1EA7n ${n} ${RES_NAME[res].toLowerCase()} \u0111\u1EC3 \u0111\u1ED5i l\u1EA5y 1 ${RES_NAME.coin.toLowerCase()}`;
  if (sim2.stock.coin >= sim2.capacity()) return `Kho \u0111\xE3 \u0111\u1EA7y ${RES_NAME.coin.toLowerCase()}`;
  sim2.stock[res] -= n;
  sim2.stock.coin += 1;
  return null;
}
function foodNeed(sim2) {
  const level = sim2.campfire()?.level ?? 1;
  let n = 0;
  for (const v of sim2.villagers) n += rationAt(level, v.job === "fight");
  return n;
}
function deposit(sim2, res, amount) {
  let left = Math.ceil(amount - 1e-9), taken = 0;
  if (res === "food") {
    const toPot = Math.max(0, Math.min(left, foodNeed(sim2) - sim2.foodPot));
    sim2.foodPot += toPot;
    left -= toPot;
    taken += toPot;
  }
  const toStore = Math.max(0, Math.min(left, sim2.capacity(res) - sim2.stock[res]));
  sim2.stock[res] += toStore;
  return taken + toStore;
}
function hasRoom(sim2, res) {
  return sim2.stock[res] < sim2.capacity(res) || res === "food" && sim2.foodPot < foodNeed(sim2);
}
function feedPot(sim2) {
  const room = foodNeed(sim2) - sim2.foodPot;
  if (room <= 0 || sim2.stock.food <= 0) return;
  const k = Math.min(room, sim2.stock.food);
  sim2.foodPot += k;
  sim2.stock.food -= k;
}
function eatDay(sim2) {
  if (sim2.atWar()) return;
  rollYield(sim2);
  trackFood(sim2);
  sim2.foodDays.push(sim2.foodIncome);
  if (sim2.foodDays.length > 3) sim2.foodDays.shift();
  sim2.foodIncome = 0;
  eat(sim2, foodNeed(sim2));
}
function warNeed(sim2) {
  const level = sim2.campfire()?.level ?? 1;
  let n = 0;
  for (const v of sim2.villagers) if (!sim2.warIds.has(v.id)) n += rationAt(level, v.job === "fight");
  return n;
}
function armyNeed(sim2) {
  const level = sim2.campfire()?.level ?? 1;
  let n = 0;
  for (const v of sim2.villagers) if (sim2.warIds.has(v.id)) n += rationAt(level, true) * sim2.march.food;
  return n;
}
function eatWar(sim2, days2) {
  const need = Math.round(sim2.warMeals);
  if (need > 0) eat(sim2, need);
  sim2.say(`Chi\u1EBFn tranh k\u1EBFt th\xFAc sau ${Math.max(0.1, Math.round(days2 * 10) / 10)} ng\xE0y: kho l\u01B0\u01A1ng \u0111\xE3 tr\u1EEB ${need} ph\u1EA7n \u0103n c\u1EE7a c\u1EA3 l\xE0ng v\xE0 qu\xE2n.`);
}
function eat(sim2, need) {
  const fromPot = Math.min(sim2.foodPot, need), fromStore = Math.min(sim2.stock.food, need - fromPot), short = need - fromPot - fromStore;
  sim2.foodPot -= fromPot;
  sim2.stock.food -= fromStore;
  const was = sim2.foodPenalty;
  sim2.foodPenalty = need > 0 ? FOOD.maxPenalty * short / need : 0;
  if (short > 0) sim2.say(`Thi\u1EBFu ${Math.ceil(short)}/${need} th\u1EE9c \u0103n: c\u1EA3 l\xE0ng y\u1EBFu \u0111i ${Math.round(sim2.foodPenalty * 1e3) / 10}% trong ng\xE0y t\u1EDBi.`);
  else if (was > 0) sim2.say("\u0110\u1EE7 \u0103n r\u1ED3i: l\xE0ng kh\u1ECFe l\u1EA1i.");
  sim2.foodSeen = sim2.stock.food + sim2.foodPot;
}
function trackFood(sim2) {
  const total = sim2.stock.food + sim2.foodPot;
  if (sim2.foodSeen >= 0 && total > sim2.foodSeen) sim2.foodIncome += total - sim2.foodSeen;
  sim2.foodSeen = total;
}
function noteYield(sim2, key, n) {
  if (n > 0) sim2.yieldNow[key] = (sim2.yieldNow[key] ?? 0) + n;
}
function rollYield(sim2) {
  for (const k of Object.keys(sim2.yieldPrev)) delete sim2.yieldPrev[k];
  Object.assign(sim2.yieldPrev, sim2.yieldNow);
  for (const k of Object.keys(sim2.yieldNow)) delete sim2.yieldNow[k];
}
function workSeconds(sim2, v) {
  const day = sim2.dayLen * 0.65, night = sim2.dayLen * 0.35 * REST.nightEfficiency;
  return v.shift === "night" ? night : v.shift === "both" ? day + night : day;
}
function dailyYield(sim2, b) {
  let workers, job;
  switch (b.kind) {
    case "lumberyard":
      job = "wood";
      workers = sim2.villagers.filter((v) => roleOf(v) === "wood");
      break;
    case "quarry":
      job = "stone";
      workers = sim2.villagers.filter((v) => roleOf(v) === "stone");
      break;
    case "farmhouse":
      job = "food";
      workers = sim2.villagers.filter((v) => roleOf(v) === "food");
      break;
    case "huntlodge":
      job = "hunt";
      workers = sim2.villagers.filter((v) => roleOf(v) === "hunt");
      break;
    case "field":
      job = "food";
      workers = sim2.villagers.filter((v) => v.job === "food" && v.post === b.id);
      break;
    default:
      return null;
  }
  let amount = 0;
  for (const v of workers) {
    const speed = workFactor(sim2, v, job, b.kind === "field") / Math.max(0.01, sim2.restFactor(v)), secs = workSeconds(sim2, v);
    if (job === "hunt") {
      amount += pace_default.huntPerDay * speed * (secs / (sim2.dayLen * 0.65)) * (1 + (statBonus(sim2.researched, "hunt", "gyield") + villageBonus(sim2)) / 100);
      continue;
    }
    const per = TIER_YIELD[sim2.toolTier(v, job)] * (1 + toolBonus(sim2, v, job, "tyield") / 100);
    amount += b.kind === "field" ? speed * levelDef(b).craftSpeed * per * secs / FARM_TIME : speed * per * secs * pace_default.gatherDuty * gatherMult(b) * pace_default.yield[JOBS[job].res] / JOBS[job].baseTime;
  }
  return { amount, people: workers.length };
}

// src/sim/readiness.ts
var eventNeed = (e) => Math.max(3, Math.ceil(e.size * (e.kind === "beasts" ? 0.6 : 0.7)));
var armyRoom = (sim2, level) => Math.floor((POP_BY_FIRE[Math.min(POP_BY_FIRE.length, Math.max(1, level)) - 1] + sim2.bedsIn("house") + sim2.popBonus) * difficulty_default.militaryShare);
function threatsAhead(sim2, days2, name) {
  return sim2.events.filter((e) => !e.fired && e.fireDay - sim2.day <= days2).map((e) => ({ id: e.id, name: name(e), left: Math.max(0, e.fireDay - sim2.day), night: e.night, size: e.size, need: eventNeed(e) })).sort((a, b) => a.left - b.left);
}
function upgradeAdvice(sim2, level, name) {
  const out = [];
  const ahead = threatsAhead(sim2, 12, name);
  if (!ahead.length) return out;
  const soldiers = sim2.villagers.filter((v) => v.job === "fight"), armed = soldiers.filter((v) => !!v.weapon).length;
  const now = armyRoom(sim2, level), next = armyRoom(sim2, level + 1);
  const soon = ahead[0], worst = ahead.reduce((a, b) => b.need > a.need ? b : a);
  const when = (t) => t.left <= 0 ? t.night ? "\u0111\xEAm nay" : "h\xF4m nay" : `c\xF2n ${t.left} ng\xE0y`;
  const unready = soldiers.length < soon.need || armed < Math.ceil(soon.need / 2);
  if (soon.left <= 4 && unready) {
    out.push({ text: `${soon.name} (${when(soon)}) c\u1EA7n \u2265${soon.need} l\xEDnh, \u0111ang c\xF3 ${soldiers.length} l\xEDnh, ${armed} c\xF3 v\u0169 kh\xED. N\xE2ng c\u1EA5p t\u1ED1n g\u1ED7 v\xE0 c\xF4ng th\u1EE3 x\xE2y: n\xEAn tuy\u1EC3n l\xEDnh v\xE0 ch\u1EBF v\u0169 kh\xED, gi\xE1p tr\u01B0\u1EDBc.`, bad: true });
  }
  if (worst.need > now) {
    if (worst.need <= next) out.push({ text: `${worst.name} (${when(worst)}) c\u1EA7n \u2265${worst.need} l\xEDnh nh\u01B0ng c\u1EA5p hi\u1EC7n t\u1EA1i ch\u1EC9 ch\u1EE9a ~${now} l\xEDnh: c\u1EA7n n\xE2ng c\u1EA5p l\xEAn (ch\u1EE9a ~${next}) r\u1ED3i tuy\u1EC3n l\xEDnh.`, bad: false });
    else out.push({ text: `${worst.name} (${when(worst)}) c\u1EA7n \u2265${worst.need} l\xEDnh: c\u1EA5p ${level + 1} ch\u1EC9 ch\u1EE9a ~${next} l\xEDnh, v\u1EABn ch\u01B0a \u0111\u1EE7. C\u1EA7n th\xEAm nh\xE0 d\xE2n (gi\u01B0\u1EDDng) v\xE0 nghi\xEAn c\u1EE9u ch\u1EC9 s\u1ED1 qu\xE2n s\u1EF1 \u0111\u1EC3 m\u1ED7i l\xEDnh m\u1EA1nh h\u01A1n.`, bad: true });
  } else if (!unready) {
    out.push({ text: `\u0110\xE3 \u0111\u1EE7 s\u1EE9c \u0111\xF3n ${soon.name} (${when(soon)}): c\u1EA7n \u2265${soon.need} l\xEDnh, \u0111ang c\xF3 ${soldiers.length}.`, bad: false });
  }
  return out;
}

// src/sim/notices.ts
var ORDER = { urgent: 0, warn: 1, info: 2 };
var pct = (x) => `${Math.round(x * 1e3) / 10}%`;
var days = (n) => n <= 0 ? "h\xF4m nay" : `c\xF2n ${n} ng\xE0y`;
var FARM = { building: "farmhouse", label: "N\xF4ng tr\u1EA1i" };
var CAMP = { building: "infantry", label: BUILDINGS.infantry.name };
function noticesOf(sim2) {
  const out = [];
  const done = sim2.plans.find((p) => p.kind === "attack" && p.result && (p.stage === "over" || sim2.time - p.endedAt < sim2.dayLen));
  if (done) {
    const name = sim2.tribes.find((t) => t.id === done.tribe)?.def.name ?? "\u0111\u1ECBch", over = done.stage === "over" && done.status === "running";
    out.push({
      id: "war-result",
      level: done.result === "won" ? "info" : "urgent",
      icon: done.result === "won" ? "\u{1F3C6}" : "\u2620",
      title: done.result === "won" ? `Th\u1EAFng tr\u1EADn: ${name}` : `Thua tr\u1EADn: ${name}`,
      when: over ? "ch\u1EDD l\u1EC7nh r\xFAt qu\xE2n" : "v\u1EEBa xong",
      body: over ? "Qu\xE2n ta \u0111ang \u0111\u1EE9ng t\u1EA1i ch\u1ED7. L\xE0ng v\u1EABn \u0111\xF3ng b\u0103ng cho t\u1EDBi khi qu\xE2n v\u1EC1." : "Tr\u1EADn \u0111\xE1nh \u0111\xE3 k\u1EBFt th\xFAc.",
      tip: over ? "B\u1EA5m R\xFAt qu\xE2n \u0111\u1EC3 c\u1EA3 \u0111\u1ED9i v\u1EC1 l\xE0ng; chi\u1EBFn tranh ch\u1EC9 k\u1EBFt th\xFAc khi qu\xE2n v\u1EC1 t\u1EDBi n\u01A1i." : "C\xF3 th\u1EC3 s\u1EEDa k\u1EBF ho\u1EA1ch v\xE0 \u0111\xE1nh l\u1EA1i.",
      command: over ? { kind: "withdraw", label: "R\xFAt qu\xE2n" } : void 0
    });
  }
  const fallen = sim2.tribes.find((t) => t.bossDown && t.bossDownAt !== void 0 && sim2.time - t.bossDownAt < 3 * sim2.dayLen);
  if (fallen && !sim2.tribes.some((t) => t.boss && !t.bossDown)) {
    out.push({
      id: "era-bronze",
      level: "info",
      icon: "\u{1F3FA}",
      title: "Chuy\u1EC3n th\u1EDDi k\u1EF3: Th\u1EDDi \u0111\u1EA1i \u0110\u1ED3 \u0111\u1ED3ng",
      when: "v\u1EEBa b\u1EAFt \u0111\u1EA7u",
      body: `${fallen.def.name} \u0111\xE3 s\u1EE5p \u0111\u1ED5. B\xED quy\u1EBFt \u0111\u1ED3ng gi\u1EDD \u0111\xE3 n\u1EB1m trong tay l\xE0ng ta.`,
      tip: "B\u1EA1n \u0111\xE3 h\u1EA1 \u0111\u01B0\u1EE3c m\u1ED9t l\xE0ng \u0111\u1EA7u l\u0129nh: \u0111\xE3 c\xF3 th\u1EC3 n\xE2ng Nh\xE0 chung l\xEAn Nh\xE0 ch\xEDnh \u0111\u1EC3 b\u01B0\u1EDBc sang th\u1EDDi Trung c\u1ED5 (khi m\u1ECDi nh\xE0 \u0111\xE3 \u0111\u1EA1t c\u1EA5p 4). C\xE1c l\xE0ng c\xF2n l\u1EA1i c\u0169ng s\u1EBD m\u1EA1nh d\u1EA7n theo."
    });
  }
  const why = sim2.attackReason();
  if (why) {
    const hiding = sim2.villagers.filter((v) => sim2.hides(v)).length;
    out.push({
      id: "under-attack",
      level: "urgent",
      icon: "stat_atk",
      title: "L\xE0ng \u0111ang b\u1ECB t\u1EA5n c\xF4ng",
      when: "ngay b\xE2y gi\u1EDD",
      body: `${why}${hiding ? ` \xB7 ${hiding} d\xE2n \u0111ang tr\u1ED1n trong nh\xE0` : ""}`,
      tip: "Khi l\xE0ng b\u1ECB t\u1EA5n c\xF4ng, d\xE2n th\u01B0\u1EDDng kh\xF4ng ng\u1EE7 v\xE0 kh\xF4ng h\u1ED3i s\u1EE9c \u0111\u01B0\u1EE3c, v\xE0 ai \u0111ang \u1EDF trong nh\xE0 s\u1EBD kh\xF4ng ra ngo\xE0i k\u1EC3 c\u1EA3 khi tr\u1EDDi s\xE1ng. Ch\u1EC9 l\xEDnh v\xE0 th\u1EE3 s\u0103n ra ngo\xE0i: giao ngh\u1EC1 l\xEDnh \u1EDF tr\u1EA1i chi\u1EBFn binh, ho\u1EB7c th\u1EE3 s\u0103n \u1EDF Ch\xF2i th\u1EE3 s\u0103n, \u0111\u1EC3 h\u1ECD ra chi\u1EBFn \u0111\u1EA5u.",
      action: CAMP
    });
  }
  const fireAt = sim2.campfire(), fx = fireAt ? fireAt.x + 1 : sim2.world.start.x, fy = fireAt ? fireAt.y + 1 : sim2.world.start.y;
  const far = sim2.villagers.filter((v) => v.job === "idle" && v.shift === "both" && v.inside === null && v.energy < 40 && v.phase !== "sleep" && v.phase !== "goHome" && Math.hypot(v.x - fx, v.y - fy) > 20);
  if (far.length) {
    const low = Math.min(...far.map((v) => v.energy));
    out.push({
      id: "explorers-tired",
      level: low < 25 ? "urgent" : "warn",
      icon: "stat_sta",
      title: "D\xE2n \u0111i xa \u0111\xE3 c\u1EA1n s\u1EE9c",
      when: "c\u1EA7n quay v\u1EC1",
      body: `${far.slice(0, 3).map((v) => `${v.name} (${Math.round(v.energy)}%)`).join(", ")}${far.length > 3 ? ` v\xE0 ${far.length - 3} ng\u01B0\u1EDDi n\u1EEFa` : ""} \xB7 c\xE1ch l\xE0ng h\u01A1n 20 \xF4`,
      tip: "D\xE2n \u0111\u01B0\u1EE3c b\u1EA1n sai \u0111i kh\xE1m ph\xE1 l\xE0m c\u1EA3 ng\xE0y l\u1EABn \u0111\xEAm. Khi s\u1EE9c xu\u1ED1ng d\u01B0\u1EDBi 20% h\u1ECD t\u1EF1 quay v\u1EC1 l\xE0ng ngh\u1EC9, nh\u01B0ng \u0111\u01B0\u1EDDng xa th\xEC r\u1EA5t l\xE2u: h\xE3y ra l\u1EC7nh cho h\u1ECD v\u1EC1 s\u1EDBm.",
      action: { building: "campfire", label: "V\u1EC1 l\xE0ng" }
    });
  }
  const overworked = sim2.villagers.filter((v) => v.team === "player" && v.down <= 0 && v.job !== "idle" && v.job !== "fight" && v.job !== "scout" && v.job !== "supply" && (v.shift === "both" || v.strain >= 10));
  if (overworked.length) {
    const worst = Math.max(...overworked.map((v) => v.strain));
    out.push({
      id: "overworked",
      level: worst >= 30 ? "urgent" : "warn",
      icon: "stat_sta",
      title: "C\xF3 ng\u01B0\u1EDDi l\xE0m vi\u1EC7c qu\xE1 s\u1EE9c",
      when: "c\u1EA3 ng\xE0y l\u1EABn \u0111\xEAm",
      body: `${overworked.slice(0, 3).map((v) => `${v.name} (s\u1EE9c ${Math.round(v.energy)}/${Math.round(sim2.maxEnergy(v))})`).join(", ")}${overworked.length > 3 ? ` v\xE0 ${overworked.length - 3} ng\u01B0\u1EDDi n\u1EEFa` : ""}`,
      tip: "L\xE0m c\u1EA3 ng\xE0y l\u1EABn \u0111\xEAm khi\u1EBFn m\u1EC7t m\u1ECFi t\xEDch l\u0169y: s\u1EE9c t\u1ED1i \u0111a gi\u1EA3m v\xE0 h\u1ED3i ch\u1EADm. M\u1EDF chi ti\u1EBFt \u0111\u1EC3 \u0111\u1ED5i ca l\xE0m (ng\xE0y ho\u1EB7c \u0111\xEAm) ho\u1EB7c cho h\u1ECD ngh\u1EC9.",
      people: overworked.map((v) => v.id)
    });
  }
  const full = RES_LIST.filter((r) => r !== "coin" && sim2.capacity(r) > 0 && sim2.stock[r] >= sim2.capacity(r));
  if (full.length) {
    out.push({
      id: "storage-full",
      level: "warn",
      icon: full[0],
      title: "Kho \u0111\xE3 \u0111\u1EA7y",
      when: "ngay b\xE2y gi\u1EDD",
      body: `${full.map((r) => RES_NAME[r].toLowerCase()).join(", ")}: d\xE2n kh\xF4ng thu th\xEAm \u0111\u01B0\u1EE3c n\u1EEFa`,
      tip: "N\xE2ng c\u1EA5p Kho (ho\u1EB7c n\xE2ng Nh\xE0 chung) \u0111\u1EC3 ch\u1EE9a th\xEAm, ho\u1EB7c d\xF9ng b\u1EDBt v\u1EADt li\u1EC7u v\xE0o vi\u1EC7c x\xE2y d\u1EF1ng v\xE0 ch\u1EBF t\u1EA1o.",
      action: { building: "storage", label: "Kho" }
    });
  }
  const need = sim2.foodNeed();
  if (need <= 0) return out;
  const have2 = sim2.stock.food + sim2.foodPot, avg = sim2.foodDays.length ? sim2.foodDays.reduce((a, b) => a + b, 0) / sim2.foodDays.length : null, earn = avg ?? 0;
  const winter = sim2.season === "winter";
  if (sim2.foodPenalty > 0) {
    out.push({
      id: "weak",
      level: "warn",
      icon: "food",
      title: `L\xE0ng y\u1EBFu ${pct(sim2.foodPenalty)}`,
      when: "t\u1EDBi cu\u1ED1i ng\xE0y",
      body: "M\u1ECDi ch\u1EC9 s\u1ED1 gi\u1EA3m v\xEC b\u1EEFa tr\u01B0\u1EDBc thi\u1EBFu \u0103n.",
      tip: "M\xE1u t\u1ED1i \u0111a kh\xF4ng \u0111\u1ED5i nh\u01B0ng h\u1ED3i ch\u1EADm h\u01A1n, \u0111\xE1nh ch\u1EADm h\u01A1n. Ki\u1EBFm \u0111\u1EE7 th\u1EE9c \u0103n tr\u01B0\u1EDBc cu\u1ED1i ng\xE0y \u0111\u1EC3 l\xE0ng kh\u1ECFe l\u1EA1i.",
      action: FARM
    });
  }
  const left = 1 - sim2.tod, projected = have2 + earn * left;
  if (projected < need) {
    const short = need - projected;
    out.push({
      id: "meal",
      level: have2 < need ? "urgent" : "warn",
      icon: "food",
      title: "B\u1EEFa t\u1ED1i thi\u1EBFu \u0103n",
      when: "cu\u1ED1i ng\xE0y",
      body: `C\u1EA7n ${need}, c\xF3 ${Math.floor(have2)} \xB7 l\xE0ng s\u1EBD y\u1EBFu ${pct(FOOD.maxPenalty * short / need)}`,
      tip: "Giao th\xEAm ng\u01B0\u1EDDi h\xE1i l\u01B0\u1EE3m \u1EDF N\xF4ng tr\u1EA1i, l\xE0m ru\u1ED9ng ho\u1EB7c \u0111i s\u0103n tr\u01B0\u1EDBc khi h\u1EBFt ng\xE0y.",
      action: FARM
    });
  } else if (avg !== null && avg < need && have2 < need * 3) {
    out.push({
      id: "income",
      level: "warn",
      icon: "food",
      title: "Ki\u1EBFm \xEDt h\u01A1n \u0103n",
      when: "m\u1ED7i ng\xE0y",
      body: `Ki\u1EBFm ~${Math.floor(avg)}/ng\xE0y, \u0103n ${need}/ng\xE0y \xB7 kho \u0111\u1EE7 ${Math.floor(have2 / need)} ng\xE0y`,
      tip: "Th\xEAm ng\u01B0\u1EDDi h\xE1i l\u01B0\u1EE3m ho\u1EB7c l\xE0m ru\u1ED9ng tr\u01B0\u1EDBc khi kho c\u1EA1n.",
      action: FARM
    });
  }
  const cap = sim2.capacity("food") + need;
  if (winter) {
    const rest = SEASON_DAYS - dayInSeason(sim2.day) + 1, want = need * rest;
    if (have2 < want) {
      out.push({
        id: "winter",
        level: "urgent",
        icon: "\u2744",
        title: "\u0110\xF4ng thi\u1EBFu \u0103n",
        when: `c\xF2n ${rest} ng\xE0y \u0111\xF4ng`,
        body: `C\u1EA7n ${want}, c\xF3 ${Math.floor(have2)}`,
        tip: "B\u1EE5i qu\u1EA3 tr\u1EE5i h\u1EBFt, ru\u1ED9ng ch\u1EC9 c\xF2n m\u1ED9t ph\u1EA7n t\u01B0. S\u0103n b\u1EAFn, l\xE0m ru\u1ED9ng ho\u1EB7c \u0111\u1ED5i ch\xE1c \u0111\u1EC3 c\xF3 th\u1EE9c \u0103n.",
        action: FARM
      });
    }
  } else {
    let to = 0;
    while (seasonOf(sim2.day + to) !== "winter") to++;
    if (to <= SEASON_DAYS) {
      const want = need * SEASON_DAYS, atStart = Math.min(have2 + (earn - need) * to, cap);
      if (atStart < want) {
        const roomy = cap >= want;
        out.push({
          id: "winter",
          level: to <= 2 ? "urgent" : "warn",
          icon: "\u2744",
          title: "S\u1EAFp v\xE0o \u0111\xF4ng",
          when: days(to),
          body: roomy ? `C\u1EA7n ${want}, d\u1EF1 ki\u1EBFn c\xF3 ${Math.max(0, Math.floor(atStart))}` : `C\u1EA7n ${want} nh\u01B0ng kho ch\u1EC9 ch\u1EE9a ${cap}`,
          tip: `M\xF9a \u0111\xF4ng ${SEASON_DAYS} ng\xE0y, b\u1EE5i qu\u1EA3 tr\u1EE5i h\u1EBFt v\xE0 ru\u1ED9ng ch\u1EC9 c\xF2n m\u1ED9t ph\u1EA7n t\u01B0. ${roomy ? "Th\xEAm ng\u01B0\u1EDDi h\xE1i l\u01B0\u1EE3m, l\xE0m ru\u1ED9ng ho\u1EB7c s\u0103n b\u1EAFn \u0111\u1EC3 t\xEDch th\xEAm." : "X\xE2y ho\u1EB7c n\xE2ng c\u1EA5p Kho \u0111\u1EC3 ch\u1EE9a \u0111\u1EE7, r\u1ED3i t\xEDch th\xEAm th\u1EE9c \u0103n."}`,
          action: roomy ? FARM : { building: "storage", label: "Kho" }
        });
      }
    }
  }
  for (const c of sim2.clashes) {
    const left2 = sim2.time - c.at;
    if (left2 > 240) continue;
    const na = sim2.tribes.find((t) => t.id === c.a)?.def.name ?? "M\u1ED9t l\xE0ng", nb = sim2.tribes.find((t) => t.id === c.b)?.def.name ?? "m\u1ED9t l\xE0ng";
    out.push({
      id: `clash:${[c.a, c.b].sort().join("-")}`,
      level: "info",
      icon: "stat_atk",
      title: `${na} \u0111ang \u0111\xE1nh ${nb}`,
      when: left2 < 20 ? "ngay b\xE2y gi\u1EDD" : "v\u1EEBa x\u1EA3y ra",
      body: "Ng\u01B0\u1EDDi c\u1EE7a ta th\u1EA5y hai l\xE0ng giao chi\u1EBFn",
      tip: "Hai l\xE0ng th\xF9 nhau \u0111\xE1nh nhau khi g\u1EB7p. B\xEAn n\xE0o y\u1EBFu \u0111i th\xEC l\xE0ng kia d\u1EC5 \u0111\xE1nh h\u01A1n; \u0111\xE2y l\xE0 l\xFAc c\xE2n nh\u1EAFc \u0111\xE1nh b\xEAn \u0111\xE3 m\u1EC7t.",
      action: CAMP
    });
  }
  out.push(...eventNotices(sim2));
  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}
function eventName(sim2, e) {
  if (e.kind === "beasts") return `${e.species ? ANIMALS[e.species].name : "S\xF3i"} (${e.size} con)`;
  return `${(e.tribe ? sim2.tribes.find((t) => t.id === e.tribe)?.def.name : void 0) ?? "M\u1ED9t b\u1ED9 t\u1ED9c"} (${e.size} ng\u01B0\u1EDDi)`;
}
function eventNotices(sim2) {
  const out = [];
  const soldiers = sim2.villagers.filter((v) => v.job === "fight"), armed = soldiers.filter((v) => !!v.weapon).length;
  const have2 = `${soldiers.length} l\xEDnh, ${armed} c\xF3 v\u0169 kh\xED`;
  for (const e of sim2.events) {
    if (e.fired || !e.warned) continue;
    const wolves = e.kind === "beasts", beast = e.species ? ANIMALS[e.species].name : "S\xF3i", need = eventNeed(e);
    const tribe = e.tribe ? sim2.tribes.find((t) => t.id === e.tribe) : void 0;
    const left = e.fireDay - sim2.day, ready = soldiers.length >= need && armed >= Math.ceil(need / 2);
    const room = armyRoom(sim2, fireLevel(sim2)), cramped = need > room;
    out.push({
      id: `ev:${e.id}`,
      level: ready && !cramped ? "info" : left <= 1 ? "urgent" : "warn",
      icon: "stat_atk",
      title: wolves ? `${beast} s\u1EAFp t\u1EA5n c\xF4ng` : `${tribe?.def.name ?? "M\u1ED9t b\u1ED9 t\u1ED9c"} s\u1EAFp \u0111\xE1nh`,
      when: left <= 0 ? e.night ? "\u0111\xEAm nay" : "h\xF4m nay" : `c\xF2n ${left} ng\xE0y`,
      body: (ready ? `Kho\u1EA3ng ${e.size} ${wolves ? "con" : "ng\u01B0\u1EDDi"} \xB7 \u0111\xE3 \u0111\u1EE7 l\xEDnh (${have2})` : `Kho\u1EA3ng ${e.size} ${wolves ? "con" : "ng\u01B0\u1EDDi"} \xB7 c\u1EA7n \u2265${need} l\xEDnh, \u0111ang c\xF3 ${have2}`) + (cramped ? ` \xB7 Nh\xE0 chung ch\u1EC9 ch\u1EE9a ~${room} l\xEDnh` : ""),
      tip: `${e.warn || "M\u1ED9t cu\u1ED9c t\u1EA5n c\xF4ng \u0111ang t\u1EDBi."} ${cramped ? `C\u1EA5p Nh\xE0 chung hi\u1EC7n t\u1EA1i ch\u1EC9 c\xF3 ch\u1ED7 cho ~${room} l\xEDnh, \xEDt h\u01A1n ${need}: c\u1EA7n n\xE2ng Nh\xE0 chung (v\xE0 d\u1EF1ng th\xEAm nh\xE0 d\xE2n, nghi\xEAn c\u1EE9u ch\u1EC9 s\u1ED1 qu\xE2n s\u1EF1) \u0111\u1EC3 \u0111\u1EE7 s\u1EE9c. ` : ""}Tuy\u1EC3n th\xEAm l\xEDnh \u1EDF tr\u1EA1i chi\u1EBFn binh, ch\u1EBF v\u0169 kh\xED v\xE0 gi\xE1p cho h\u1ECD, v\xE0 d\u1EF1ng h\xE0ng r\xE0o, ch\xF2i canh tr\u01B0\u1EDBc khi ch\xFAng t\u1EDBi.`,
      action: cramped ? { building: "campfire", label: "Nh\xE0 chung" } : CAMP
    });
  }
  const fire2 = sim2.campfire(), cx = fire2 ? fire2.x + 1 : sim2.world.start.x, cy = fire2 ? fire2.y + 1 : sim2.world.start.y;
  const pack = sim2.animals.filter((a) => (a.species === "wolf" || a.raid) && a.state !== "dead" && Math.hypot(a.x - cx, a.y - cy) < 30).length;
  if (pack) {
    out.push({
      id: "wolves-here",
      level: soldiers.length < 3 ? "urgent" : "warn",
      icon: "stat_atk",
      title: "Th\xFA d\u1EEF \u0111ang \u1EDF g\u1EA7n l\xE0ng",
      when: "ngay b\xE2y gi\u1EDD",
      body: `${pack} con \xB7 ${have2}${soldiers.length < 3 ? " \xB7 c\u1EA7n th\xEAm l\xEDnh" : ""}`,
      tip: "Th\xFA d\u1EEF kh\xF4ng s\u1EE3 l\u1EEDa v\xE0 t\u1EA5n c\xF4ng d\xE2n. C\u1EA7n c\xF3 l\xEDnh c\u1EA7m v\u0169 kh\xED \u0111\u1EC3 \u0111\xE1nh \u0111u\u1ED5i; d\xE2n th\u01B0\u1EDDng s\u1EBD ch\u1EA1y v\u1EC1 l\u1EEDa tr\u1EA1i.",
      action: CAMP
    });
  }
  for (const t of sim2.tribes) {
    if (!t.raid || t.raid.phase !== "march") continue;
    out.push({
      id: `raid-here:${t.id}`,
      level: "urgent",
      icon: "stat_atk",
      title: `${t.def.name} \u0111ang ti\u1EBFn v\xE0o l\xE0ng`,
      when: "ngay b\xE2y gi\u1EDD",
      body: `Kho\u1EA3ng ${t.raid.size} ng\u01B0\u1EDDi \xB7 ${have2}`,
      tip: "G\u1ECDi l\xEDnh ra \u0111\xF3n \u0111\xE1nh, \u0111\xF3ng c\u1ED5ng n\u1EBFu c\xF3 h\xE0ng r\xE0o, v\xE0 \u0111\u01B0a d\xE2n th\u01B0\u1EDDng v\u1EC1 l\u1EEDa tr\u1EA1i.",
      action: CAMP
    });
  }
  return out;
}

// src/sim/houses.ts
function bestFor(sim2, job) {
  const stat = JOBS[job].stat;
  const pool = sim2.villagers.filter((v) => v.down <= 0 && v.inside === null && v.job !== job && v.job !== "fight" && v.job !== "hunt" && v.job !== "scout" && v.job !== "supply");
  pool.sort((a, b) => (isFree(a) ? 0 : 1) - (isFree(b) ? 0 : 1) || b.stats[stat] - a.stats[stat]);
  return pool[0] ?? null;
}
function houseRate(sim2, b) {
  const job = b.kind === "lab" ? "research" : b.kind === "workshop" ? "craft" : "tame";
  let r = 0;
  for (const id of b.staff) {
    const v = sim2.byId.get(id);
    if (v && v.phase === "inside") r += sim2.workFactor(v, job);
  }
  return r * levelDef(b).craftSpeed * (sim2.dev.fastWorks ? 1e6 : 1);
}
function staffCount(sim2, b) {
  return b.staff.length + sim2.villagers.filter((v) => v.phase === "goStaff" && v.target === b.id).length;
}
function letGo(sim2, v) {
  return v.job === "fight" || v.job === "scout" ? sim2.releaseRole([v.id]) : null;
}
function crew(sim2) {
  return sim2.villagers.filter((v) => v.job === "build");
}
function bootCrew(sim2) {
  if (crew(sim2).length > 0 || sim2.building(CREW_BUILDING.build) || !sim2.buildings.some((b) => b.kind === CREW_BUILDING.build)) return;
  const free = sim2.villagers.filter((v) => v.team === "player" && v.job === "idle" && !v.inside && v.health > 0 && v.phase !== "sleep").slice(0, 2);
  for (const v of free) {
    sim2.resetTask(v);
    sim2.clearCombat(v);
    v.job = "build";
    v.prefer = -1;
    v.post = -1;
  }
}
function assignCrew(sim2, ids2) {
  const lock = sim2.warLock();
  if (lock) return lock;
  const house = sim2.building(CREW_BUILDING.build);
  if (!house) return `Ch\u01B0a c\xF3 ${BUILDINGS.builder.name}, ho\u1EB7c ch\u01B0a x\xE2y xong`;
  let err = null;
  for (const v of sim2.mine(ids2)) {
    if (v.job === "build") continue;
    const gone = letGo(sim2, v);
    if (gone) {
      err = gone;
      continue;
    }
    if (crew(sim2).length >= levelDef(house).slots) {
      err = `${BUILDINGS.builder.name} c\u1EA5p ${house.level} ch\u1EC9 ch\u1EE9a ${levelDef(house).slots} th\u1EE3`;
      continue;
    }
    sim2.resetTask(v);
    sim2.clearCombat(v);
    v.job = "build";
    v.prefer = -1;
    v.post = -1;
  }
  return err;
}
function trimCrew(sim2) {
  const house = sim2.building("builder"), builders = crew(sim2);
  if (house) for (const v of builders.slice(levelDef(house).slots)) {
    sim2.resetTask(v);
    v.job = "idle";
  }
}
function releaseCrew(sim2, ids2) {
  for (const v of sim2.mine(ids2)) if (v.job === "build") {
    sim2.resetTask(v);
    v.job = "idle";
  }
}
function assignStaff(sim2, ids2, job) {
  const lock = sim2.warLock();
  if (lock) return lock;
  const b = sim2.building(STAFF_BUILDING[job]);
  if (!b) return `Ch\u01B0a c\xF3 ${BUILDINGS[STAFF_BUILDING[job]].name}, ho\u1EB7c ch\u01B0a x\xE2y xong`;
  let err = null;
  for (const v of sim2.mine(ids2)) {
    if (v.inside === b.id) {
      v.job = job;
      continue;
    }
    const gone = letGo(sim2, v);
    if (gone) {
      err = gone;
      continue;
    }
    if (staffCount(sim2, b) >= levelDef(b).slots) {
      err = `${BUILDINGS[b.kind].name} c\u1EA5p ${b.level} ch\u1EC9 ch\u1EE9a ${levelDef(b).slots} ng\u01B0\u1EDDi`;
      continue;
    }
    sim2.resetTask(v);
    sim2.clearCombat(v);
    v.job = job;
    v.prefer = -1;
    v.post = -1;
    planStaff(sim2, v);
  }
  return err;
}
function assignField(sim2, ids2, fieldId) {
  const lock = sim2.warLock();
  if (lock) return lock;
  const b = sim2.getBuilding(fieldId);
  if (!b || b.kind !== "field" || !b.done) return "Ru\u1ED9ng ch\u01B0a d\u1EF1ng xong";
  let err = null;
  for (const v of sim2.mine(ids2)) {
    if (v.post === b.id && v.job === "food") continue;
    const gone = letGo(sim2, v);
    if (gone) {
      err = gone;
      continue;
    }
    if (staffCount(sim2, b) >= levelDef(b).slots) {
      err = `${BUILDINGS.field.name} c\u1EA5p ${b.level} ch\u1EC9 ch\u1EE9a ${levelDef(b).slots} ng\u01B0\u1EDDi`;
      continue;
    }
    sim2.resetTask(v);
    sim2.clearCombat(v);
    v.job = "food";
    v.prefer = -1;
    v.post = b.id;
    planStaff(sim2, v);
  }
  return err;
}
function postOf(sim2, v) {
  if (isStaffJob(v.job)) return sim2.building(STAFF_BUILDING[v.job]);
  const b = (v.job === "food" || v.job === "fight") && v.post >= 0 ? sim2.getBuilding(v.post) : void 0;
  return b && (v.job === "food" ? b.kind === "field" : b.kind === "tower") ? b : void 0;
}
function planStaff(sim2, v) {
  if (!isStaffJob(v.job) && !((v.job === "food" || v.job === "fight") && v.post >= 0)) return;
  const b = postOf(sim2, v);
  if (!b) {
    if (v.job === "food" || v.job === "fight") v.post = -1;
    else v.job = "idle";
    return;
  }
  if (staffCount(sim2, b) >= levelDef(b).slots) {
    if (v.job !== "fight") v.job = "idle";
    v.post = -1;
    sim2.say(`${v.name} kh\xF4ng c\xF2n ch\u1ED7 trong ${BUILDINGS[b.kind].name.toLowerCase()}.`);
    return;
  }
  const d = BUILDINGS[b.kind];
  if (sim2.routeTo(v, sim2.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) {
    v.target = b.id;
    v.phase = "goStaff";
    return;
  }
  sim2.wait(v, 3);
}
function enterBuilding(sim2, v) {
  const b = sim2.getBuilding(v.target);
  if (!b || !b.done || postOf(sim2, v)?.id !== b.id || b.staff.length >= levelDef(b).slots) {
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
  sim2.say(`${v.name} v\xE0o ${BUILDINGS[b.kind].name.toLowerCase()} l\xE0m vi\u1EC7c.`);
}
function sleepIn(sim2, v, b) {
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
  sim2.fogDirty = true;
}
function sleepers(sim2, b) {
  return sim2.villagers.filter((v) => v.phase === "sleep" && v.inside === b.id || v.phase === "goHome" && v.target === b.id);
}
function exitBuilding(sim2, v) {
  if (v.inside === null) return;
  const b = sim2.getBuilding(v.inside);
  v.inside = null;
  v.phase = "idle";
  if (!b) return;
  b.staff = b.staff.filter((id) => id !== v.id);
  const d = BUILDINGS[b.kind], ring2 = sim2.ringTiles(v, b.x, b.y, d.w, d.h);
  const spot2 = ring2[0] ?? [b.x - 1, b.y + d.h];
  v.x = spot2[0] + 0.5;
  v.y = spot2[1] + 0.5;
}
function releaseStaff(sim2, ids2) {
  if (sim2.warLock()) return;
  for (const v of sim2.mine(ids2)) if (v.inside !== null) {
    exitBuilding(sim2, v);
    v.job = "idle";
    v.post = -1;
    sim2.fogDirty = true;
  }
}

// src/sim/inventory.ts
function toolCount(sim2, kind, tier) {
  const id = `${kind}${tier}`;
  return (sim2.toolStock[id] ?? 0) + sim2.wornTools.filter((w) => w.id === id && w.dur > 0).length;
}
function toolTier(sim2, v, job) {
  const k = job === "idle" || job === "scout" || job === "supply" ? void 0 : TOOL_OF_JOB[job];
  const t = k ? v.tools[k] : null;
  return t && t.dur > 0 ? t.tier : 0;
}
function toolId(sim2, k, tier) {
  return `${k}${tier}`;
}
function heldTool(sim2, v) {
  for (const k of TOOL_KINDS) {
    const t = v.tools[k];
    if (t) return { k, t };
  }
  return null;
}
function returnTool(sim2, v) {
  const h = heldTool(sim2, v);
  if (!h) return;
  const { k, t } = h, id = toolId(sim2, k, t.tier), name = `${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t.tier].toLowerCase()}`;
  v.tools[k] = null;
  if (t.dur <= 0) {
    sim2.say(`${v.name} b\u1ECF ${name} \u0111\xE3 h\u1ECFng.`);
    return;
  }
  if (t.dur >= TIER_DURABILITY[t.tier] - 1e-6) sim2.toolStock[id] = (sim2.toolStock[id] ?? 0) + 1;
  else sim2.wornTools.push({ id, dur: t.dur });
  sim2.say(`${v.name} tr\u1EA3 ${name} v\u1EC1 kho.`);
}
function takeTool(sim2, k, tier) {
  const id = toolId(sim2, k, tier);
  if ((sim2.toolStock[id] ?? 0) > 0) {
    sim2.toolStock[id]--;
    return { tier, dur: TIER_DURABILITY[tier] };
  }
  let best = -1;
  sim2.wornTools.forEach((w, i) => {
    if (w.id === id && w.dur > 0 && (best < 0 || w.dur > sim2.wornTools[best].dur)) best = i;
  });
  return best < 0 ? null : { tier, dur: sim2.wornTools.splice(best, 1)[0].dur };
}
function assignTool(sim2, ids2, k, tier) {
  let short = false, wrong = null, given = 0;
  for (const v of sim2.mine(ids2)) {
    const cur = v.tools[k];
    if (tier === 0) {
      if (cur) {
        returnTool(sim2, v);
        given++;
      }
      continue;
    }
    if (TOOL_OF_JOB[v.job] !== k) {
      wrong = `${v.name} l\xE0m ${JOB_NAME[v.job].toLowerCase()}: kh\xF4ng d\xF9ng ${TOOL_NAME[k].toLowerCase()}`;
      continue;
    }
    if (cur?.tier === tier && cur.dur > 0) continue;
    if (toolCount(sim2, k, tier) <= 0) {
      short = true;
      continue;
    }
    returnTool(sim2, v);
    v.tools[k] = takeTool(sim2, k, tier);
    given++;
    sim2.say(`${v.name} \u0111\u01B0\u1EE3c ph\xE1t ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}.`);
  }
  if (given) return null;
  return short ? `Kho h\u1EBFt ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}, h\xE3y ch\u1EBF th\xEAm` : wrong;
}
function discardTool(sim2, ids2, k) {
  for (const v of sim2.mine(ids2)) if (v.tools[k]) {
    v.tools[k] = null;
    sim2.say(`${v.name} v\u1EE9t ${TOOL_NAME[k].toLowerCase()}.`);
  }
}
var gearName = (slot, id) => (slot === "armor" ? ARMORS[id]?.name : WEAPONS[id]?.name)?.toLowerCase() ?? id;
var armorKey = (k) => `${k}${ARMORS[k]?.tier ?? 1}`;
function bestArmor(sim2) {
  let best = null, top = 0;
  for (const k of Object.keys(ARMORS)) {
    const t = ARMORS[k].tier ?? 1;
    if (t > top && toolCount(sim2, k, t) > 0) {
      best = k;
      top = t;
    }
  }
  return best;
}
function wearGear(sim2, v, slot) {
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
  sim2.say(`${v.name} l\xE0m v\u1EE1 ${gearName(slot, id)}, m\u1EA5t h\u1EB3n.`);
}
function giveGear(sim2, ids2, kind, slot) {
  for (const v of sim2.mine(ids2)) {
    if (slot === "weapon") v.weapon = kind;
    else v.armor = kind;
    if (kind) sim2.say(`${v.name} \u0111\u01B0\u1EE3c c\u1EA5p ${(kind in ARMORS ? ARMORS[kind].name : WEAPONS[kind].name).toLowerCase()}.`);
  }
}
function assignGear(sim2, ids2, kind, slot) {
  const key = (k) => k in ARMORS ? armorKey(k) : `${k}${WEAPONS[k].tier ?? 1}`;
  const nameOf = (k) => (k in ARMORS ? ARMORS[k].name : WEAPONS[k].name).toLowerCase();
  const people = sim2.mine(ids2);
  if (kind && !sim2.hasWorkshop() && !sim2.building("armory")) return "C\u1EA7n c\xF3 Nh\xE0 ch\u1EBF t\u1EA1o ho\u1EB7c Kho v\u0169 kh\xED \u0111\u1EC3 l\u1EA5y \u0111\u1ED3";
  let given = 0, short = false;
  for (const v of people) {
    const cur = slot === "weapon" ? v.weapon : v.armor;
    if (cur === kind) {
      v.manualGear = true;
      continue;
    }
    if (kind) {
      if (toolCount(sim2, kind, kind in ARMORS ? ARMORS[kind].tier ?? 1 : WEAPONS[kind].tier ?? 1) <= 0) {
        short = true;
        continue;
      }
      sim2.toolStock[key(kind)]--;
    }
    if (cur) sim2.toolStock[key(cur)] = (sim2.toolStock[key(cur)] ?? 0) + 1;
    if (slot === "weapon") v.weapon = kind;
    else v.armor = kind;
    v.manualGear = true;
    given++;
    sim2.say(kind ? `${v.name} \u0111\u01B0\u1EE3c ph\xE1t ${nameOf(kind)}.` : `${v.name} tr\u1EA3 l\u1EA1i ${cur ? nameOf(cur) : "\u0111\u1ED3"}.`);
  }
  return short && given === 0 ? `Kho h\u1EBFt ${kind ? nameOf(kind) : "\u0111\u1ED3"}, h\xE3y ch\u1EBF th\xEAm` : null;
}
function autoGear(sim2, ids2) {
  for (const v of sim2.mine(ids2)) v.manualGear = false;
  return null;
}
function giveTool(sim2, ids2, kind, tier) {
  for (const id of ids2) {
    const v = sim2.byId.get(id);
    if (!v) continue;
    for (const k of TOOL_KINDS) v.tools[k] = null;
    v.tools[kind] = tier > 0 ? { tier, dur: TIER_DURABILITY[tier] } : null;
    if (tier > 0 && TOOL_OF_JOB[v.job] !== kind) {
      const job = Object.keys(TOOL_OF_JOB).find((j) => TOOL_OF_JOB[j] === kind);
      if (job && v.team === "player") sim2.setJob([v.id], job);
    }
    if (tier > 0) sim2.say(`${v.name} \u0111\u01B0\u1EE3c c\u1EA5p ${TOOL_NAME[kind].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}.`);
  }
}
function toolLacking(sim2, v, job) {
  const k = TOOL_OF_JOB[job];
  if (!k) return false;
  const t = v.tools[k];
  return !t || t.dur <= 0;
}
function stockedTier(sim2, k) {
  for (let t = 2; t >= 1; t--) if (toolCount(sim2, k, t) > 0) return t;
  return 0;
}
function needTool(sim2, v, job) {
  const k = TOOL_OF_JOB[job];
  return !!k && !!sim2.building("toolstore") && toolLacking(sim2, v, job) && stockedTier(sim2, k) > 0;
}
function goTo(sim2, v, b, phase) {
  const d = BUILDINGS[b.kind];
  if (sim2.routeTo(v, sim2.ringTiles(v, b.x, b.y, d.w, d.h)) < 0) return false;
  v.target = b.id;
  v.phase = phase;
  return true;
}
var AUTO_ORDER = false;
function planTool(sim2, v, job) {
  const k = TOOL_OF_JOB[job];
  if (!k || !toolLacking(sim2, v, job)) return false;
  const store = sim2.building("toolstore");
  if (store && needTool(sim2, v, job)) return goTo(sim2, v, store, "goEquip");
  if (!AUTO_ORDER || v.orderCd > 0) return false;
  v.orderCd = 45;
  const craftHouse = sim2.building("workshop");
  if (!craftHouse) return false;
  let id = "";
  for (let tier = 2; tier >= 1; tier--) if (sim2.recipeOpen(`${k}${tier}`)) {
    id = `${k}${tier}`;
    break;
  }
  if (!id) return false;
  const lacking = sim2.villagers.filter((o) => o.inside === null && o.job !== "idle" && TOOL_OF_JOB[o.job] === k && toolLacking(sim2, o, o.job)).length;
  const onWay = toolCount(sim2, k, 1) + toolCount(sim2, k, 2) + sim2.craftQueue.filter((q) => q.startsWith(k)).length + (craftHouse.active?.id.startsWith(k) ? 1 : 0);
  if (onWay >= lacking || sim2.craftQueue.length >= 12) return false;
  v.order = `craft:${id}`;
  return goTo(sim2, v, craftHouse, "goOrder");
}
function errand(sim2, v) {
  const o = v.order;
  v.order = null;
  v.phase = "idle";
  v.orderCd = 90;
  const b = sim2.getBuilding(v.target);
  if (b) sim2.faceBuilding(v, b);
  if (!o || !b || !b.done) return;
  const [what, id] = o.split(":");
  if (what === "craft") {
    if (sim2.queueCraft(id) === null) sim2.say(`${v.name} nh\u1EDD ch\u1EBF ${recipeName(RECIPE_BY_ID[id]).toLowerCase()}.`);
  }
}
function restock2(sim2) {
  if (!sim2.building("armory")) return;
  for (const v of sim2.villagers) {
    if (v.team !== "player" || v.job !== "fight" && v.job !== "hunt" || v.manualGear || v.health <= 0 || v.phase === "fight") continue;
    if (v.inside === null && v.phase !== "sleep") continue;
    if (!v.weapon && bestWeapon(sim2, v) || !v.armor && bestArmor(sim2)) equipGear(sim2, v);
  }
}
function equip(sim2, v) {
  v.phase = "idle";
  const store = sim2.getBuilding(v.target);
  if (store) sim2.faceBuilding(v, store);
  if (v.job === "hunt" || v.job === "fight") {
    equipGear(sim2, v);
    return;
  }
  const k = TOOL_OF_JOB[v.job];
  if (!k || !toolLacking(sim2, v, v.job)) return;
  const t = stockedTier(sim2, k);
  if (!t) return;
  v.tools[k] = takeTool(sim2, k, t);
  sim2.say(`${v.name} nh\u1EADn ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t].toLowerCase()}.`);
}
function planEquipGear(sim2, v) {
  if (v.job !== "hunt" && v.job !== "fight" || v.phase === "fight" || v.manualGear) return false;
  const armory = sim2.building("armory");
  if (!armory) return false;
  const wantsWeapon = !v.weapon && !!bestWeapon(sim2, v), wantsArmor = !v.armor && !!bestArmor(sim2);
  if (!wantsWeapon && !wantsArmor) return false;
  return goTo(sim2, v, armory, "goEquip");
}
function equipGear(sim2, v) {
  const best = !v.weapon ? bestWeapon(sim2, v) : null;
  if (best) {
    sim2.toolStock[`${best}${WEAPONS[best].tier ?? 1}`]--;
    v.weapon = best;
    sim2.say(`${v.name} nh\u1EADn ${WEAPONS[best].name.toLowerCase()}.`);
  }
  const suit = !v.armor ? bestArmor(sim2) : null;
  if (suit) {
    sim2.toolStock[armorKey(suit)]--;
    v.armor = suit;
    sim2.say(`${v.name} m\u1EB7c ${ARMORS[suit].name.toLowerCase()}.`);
  }
}
function planGearErrand(sim2, v) {
  if (!AUTO_ORDER || v.job !== "hunt" && v.job !== "fight" || v.phase === "fight" || v.manualGear || v.orderCd > 0) return false;
  const house = sim2.building("workshop");
  if (!house) return false;
  const have2 = (re) => Object.entries(sim2.toolStock).some(([id2, n]) => n > 0 && re.test(id2)) || sim2.craftQueue.some((id2) => re.test(id2)) || !!house.active && re.test(house.active.id);
  let id = "";
  const mayCarry = (w) => !(w === "mace" && v.job !== "fight") && (v.job !== "fight" || v.guard || v.arm === "cavalry" || v.arm === "archer" === !!WEAPONS[w].ranged);
  if (!v.weapon && !CRAFTED_WEAPONS.some((w) => mayCarry(w) && have2(new RegExp(`^${w}\\d`)))) {
    let bestScore = -1;
    for (const w of CRAFTED_WEAPONS) {
      const rid = `${w}${WEAPONS[w].tier ?? 1}`;
      if (!sim2.recipeOpen(rid) || !mayCarry(w)) continue;
      const sc = WEAPONS[w].damage / WEAPONS[w].cycle;
      if (sc > bestScore) {
        bestScore = sc;
        id = rid;
      }
    }
  } else if (v.job === "fight" && !v.armor && !have2(/^(hide|bone)/) && sim2.recipeOpen("hide1")) id = "hide1";
  v.orderCd = 60;
  if (!id) return false;
  v.order = `craft:${id}`;
  return goTo(sim2, v, house, "goOrder");
}
function bestWeapon(sim2, v) {
  const score = (id) => {
    const w = WEAPONS[id];
    return (w.damage + RULES.strengthDamage * v.stats.str) / cycleOf(w.cycle, v.stats.agi) + (w.range > 1 ? 1 : 0);
  };
  const cur = v.weapon ? score(v.weapon) : score("fist");
  let best = null, bs = cur;
  for (const id of CRAFTED_WEAPONS) {
    if (sim2.toolCount(id, WEAPONS[id].tier ?? 1) <= 0) continue;
    if (id === "mace" && v.job !== "fight") continue;
    if (v.job === "fight" && v.guard && v.post >= 0 && !WEAPONS[id].ranged) continue;
    if (v.job === "fight" && !v.guard && v.arm !== "cavalry" && v.arm === "archer" !== !!WEAPONS[id].ranged) continue;
    if (score(id) > bs) {
      bs = score(id);
      best = id;
    }
  }
  return best;
}

// src/sim/mounts.ts
var stockKey = (k) => `mount_${k}`;
var tamedCount = (sim2, k) => sim2.toolStock[stockKey(k)] ?? 0;
var STOCK_CAP = 12;
function tameLock(sim2, k) {
  const d = MOUNTS[k], stable = sim2.building("stable");
  if (!stable) return "C\u1EA7n d\u1EF1ng Chu\u1ED3ng th\xFA c\u01B0\u1EE1i";
  if (stable.level < d.tier) return `C\u1EA7n Chu\u1ED3ng th\xFA c\u01B0\u1EE1i c\u1EA5p ${d.tier}`;
  return null;
}
function queueTame(sim2, k) {
  if (!MOUNTS[k]) return "Kh\xF4ng c\xF3 lo\xE0i n\xE0y";
  const lock = tameLock(sim2, k);
  if (lock) return lock;
  if (sim2.tameQueue.length >= 12) return "H\xE0ng \u0111\u1EE3i \u0111\xE3 \u0111\u1EA7y";
  sim2.tameQueue.push(k);
  return null;
}
function unqueueTame(sim2, k) {
  const i = sim2.tameQueue.lastIndexOf(k);
  if (i >= 0) sim2.tameQueue.splice(i, 1);
}
function tickTame(sim2, dt) {
  for (const b of sim2.buildings) {
    if (b.kind !== "stable" || !b.done) continue;
    const staff2 = b.staff.map((id) => sim2.byId.get(id)).filter((v) => !!v && v.phase === "inside");
    if (!staff2.length && !sim2.dev.freeWorks) continue;
    if (!b.active) {
      const i = sim2.tameQueue.findIndex((k3) => !tameLock(sim2, k3) && (sim2.dev.freeWorks || sim2.affordable(MOUNTS[k3].cost)));
      if (i < 0) {
        if (sim2.tameQueue.length && sim2.time - sim2.lastMatWarn > 30) {
          sim2.lastMatWarn = sim2.time;
          sim2.say("\u0110\u01A1n thu\u1EA7n th\xFA \u0111ang ch\u1EDD: thi\u1EBFu nguy\xEAn li\u1EC7u.");
        }
        continue;
      }
      const k2 = sim2.tameQueue.splice(i, 1)[0];
      if (!sim2.dev.freeWorks) sim2.pay(MOUNTS[k2].cost);
      b.active = { id: k2, progress: 0 };
    }
    const k = b.active.id, d = MOUNTS[k];
    if (!d) {
      b.active = null;
      continue;
    }
    let rate = 0;
    for (const v of staff2) {
      rate += sim2.workFactor(v, "tame");
      sim2.gainXp(v, "tame", dt);
    }
    b.active.progress = sim2.dev.fastWorks ? 1 : Math.min(1, b.active.progress + dt * sim2.paceWork * rate * levelDef(b).craftSpeed / d.time);
    if (b.active.progress < 1) continue;
    if (MOUNT_KINDS.reduce((n, m) => n + tamedCount(sim2, m), 0) >= STOCK_CAP) {
      if (sim2.time - sim2.lastFullWarn > 30) {
        sim2.lastFullWarn = sim2.time;
        sim2.say("Chu\u1ED3ng \u0111\xE3 \u0111\u1EA7y th\xFA ch\u01B0a c\xF3 ng\u01B0\u1EDDi c\u01B0\u1EE1i: s\u1EA3n ph\u1EA9m ch\u1EDD ch\u1ED7.");
      }
      continue;
    }
    sim2.toolStock[stockKey(k)] = tamedCount(sim2, k) + 1;
    b.active = null;
    sim2.say(`\u0110\xE3 thu\u1EA7n xong m\u1ED9t con ${d.name.toLowerCase()}.`);
  }
}
function campBeast(sim2) {
  const camp = sim2.building("cavalry");
  return MOUNT_KINDS[Math.max(0, Math.min(MOUNT_KINDS.length, camp?.level ?? 1) - 1)];
}
function mountOf(sim2, v) {
  if (v.team !== "player") return v.mount ?? null;
  const own = v.mount ?? ((v.job === "fight" || v.job === "scout") && v.arm === "cavalry" ? campBeast(sim2) : null);
  return v.job === "scout" && own === "elephant" ? null : own;
}
var mountSpeed = (sim2, v) => {
  const k = mountOf(sim2, v);
  return k ? MOUNTS[k].speed : 1;
};
var mountGuard = (sim2, v) => {
  const k = mountOf(sim2, v);
  return k ? MOUNTS[k].guard : 1;
};
function fitScoutMount(sim2, v) {
  const was = v.mount ?? (v.arm === "cavalry" ? campBeast(sim2) : null);
  if (was !== "elephant") return;
  if (v.mount) sim2.toolStock[stockKey(v.mount)] = tamedCount(sim2, v.mount) + 1;
  v.mount = null;
  if (tamedCount(sim2, "wolf") > 0) {
    sim2.toolStock[stockKey("wolf")] = tamedCount(sim2, "wolf") - 1;
    v.mount = "wolf";
    sim2.say(`${v.name} \u0111i trinh s\xE1t b\u1EB1ng s\xF3i, kh\xF4ng c\u01B0\u1EE1i voi.`);
  }
}
function fitScouts(sim2) {
  if (tamedCount(sim2, "wolf") <= 0) return;
  for (const v of sim2.villagers) {
    if (v.team !== "player" || v.job !== "scout" || v.mount || mountOf(sim2, v) || sim2.scouts.some((m) => m.ids.includes(v.id))) continue;
    sim2.toolStock[stockKey("wolf")] = tamedCount(sim2, "wolf") - 1;
    v.mount = "wolf";
    v.speed = 1.6 + 0.1 * v.stats.agi;
    sim2.say(`${v.name} nh\u1EADn m\u1ED9t con s\xF3i t\u1EEB chu\u1ED3ng.`);
    if (tamedCount(sim2, "wolf") <= 0) return;
  }
}
function returnScoutMount(sim2, v) {
  if (v.arm !== "cavalry" || !v.mount) return;
  sim2.toolStock[stockKey(v.mount)] = tamedCount(sim2, v.mount) + 1;
  v.mount = null;
}
function assignMount(sim2, ids2, kind) {
  let given = 0, short = false, riders = false;
  for (const v of sim2.mine(ids2)) {
    if (v.mount === kind) continue;
    if (kind && v.job === "fight" && v.arm === "cavalry") {
      riders = true;
      continue;
    }
    if (kind && tamedCount(sim2, kind) <= 0) {
      short = true;
      continue;
    }
    if (v.mount) sim2.toolStock[stockKey(v.mount)] = tamedCount(sim2, v.mount) + 1;
    if (kind) sim2.toolStock[stockKey(kind)]--;
    v.mount = kind;
    given++;
    if (kind) {
      v.speed = 1.6 + 0.1 * v.stats.agi;
      sim2.say(`${v.name} \u0111\u01B0\u1EE3c giao m\u1ED9t con ${MOUNTS[kind].name.toLowerCase()} \u0111\u1EC3 c\u01B0\u1EE1i.`);
    } else sim2.say(`${v.name} tr\u1EA3 th\xFA v\u1EC1 chu\u1ED3ng.`);
  }
  if (given) return null;
  return riders ? "K\u1EF5 binh c\u1EE7a Tr\u1EA1i k\u1EF5 th\xFA \u0111\xE3 c\xF3 th\xFA c\u1EE7a tr\u1EA1i" : short ? `Chu\u1ED3ng h\u1EBFt ${kind ? MOUNTS[kind].name.toLowerCase() : "th\xFA"} \u0111\xE3 thu\u1EA7n: h\xE3y thu\u1EA7n th\xEAm` : null;
}

// src/sim/commands.ts
function resetTask(sim2, v) {
  sim2.leaveNode(v);
  sim2.exitBuilding(v);
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
function keepWatch(sim2, v) {
  if (v.job !== "idle") sim2.callUp(v);
}
function takeOut(sim2, v) {
  if (!campFolk(sim2, v) || v.post >= 0 || isOut(v)) return;
  v.recall = false;
  if (v.guard) v.housed = false;
  else v.out = true;
}
function recallFar(sim2) {
  const fire2 = sim2.campfire(), far = farFolk(sim2);
  if (!far.length) return 0;
  const sx = fire2 ? fire2.x + 1 : sim2.world.start.x, sy = fire2 ? fire2.y + 3 : sim2.world.start.y + 3;
  orderMove(sim2, far.map((v) => v.id), Math.floor(sx), Math.floor(sy));
  for (const v of far) if (v.job === "idle") v.shift = "day";
  return far.length;
}
function clearCombat(sim2, v) {
  v.fight.target = null;
  v.fight.mode = "none";
  v.fight.dest = null;
  v.fight.anchor = null;
  v.fight.strict = false;
  v.fight.obey = false;
  v.queue.length = 0;
  v.loot = -1;
  v.fleeT = 0;
}
function mine(sim2, ids2) {
  return ids2.map((id) => sim2.byId.get(id)).filter((v) => !!v && v.team === "player" && v.down <= 0 && !sim2.sleepLocked(v) && !sim2.scouts.some((m) => m.ids.includes(v.id)));
}
function busy(sim2, v) {
  return v.phase !== "idle" || v.path.length > 0 || v.fight.mode !== "none";
}
function keepSoldierJob(sim2, v) {
  if (v.job !== "fight" && v.job !== "hunt" && v.job !== "scout" && v.job !== "supply") v.job = "idle";
}
function orderMove(sim2, ids2, tx, ty, queue = false) {
  const vs = mine(sim2, ids2);
  vs.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
  const taken = /* @__PURE__ */ new Set();
  for (const v of vs) {
    if (queue && busy(sim2, v)) {
      v.queue.push({ k: "move", x: tx, y: ty });
      continue;
    }
    const goal = sim2.nearestFree(tx, ty, taken);
    resetTask(sim2, v);
    clearCombat(sim2, v);
    v.prefer = -1;
    keepSoldierJob(sim2, v);
    takeOut(sim2, v);
    keepWatch(sim2, v);
    if (v.job === "idle") v.shift = "both";
    if (!goal) continue;
    taken.add(goal[1] * sim2.world.size + goal[0]);
    if (v.job === "fight") {
      v.fight.mode = "guard";
      v.fight.anchor = { x: goal[0] + 0.5, y: goal[1] + 0.5 };
      if (v.guard) v.guardAt = { x: goal[0] + 0.5, y: goal[1] + 0.5 };
    }
    if (v.job === "fight" && sim2.pathLeft <= 0) {
      v.phase = "idle";
      continue;
    }
    if (v.job === "fight") sim2.pathLeft--;
    v.path = sim2.pathTo(v, goal[0], goal[1], 3e4);
    v.phase = v.path.length ? "move" : "idle";
  }
}
function callWorker(sim2, tx, ty) {
  const node = sim2.world.nodeAt(tx, ty);
  if (!node || sim2.fog.state[ty * sim2.world.size + tx] === 0) return { reason: "Kh\xF4ng c\xF2n g\xEC \u0111\u1EC3 khai th\xE1c \u1EDF \u0111\xE2y" };
  if (node.amount <= 0) return { reason: "B\u1EE5i qu\u1EA3 \u0111\xE3 h\u1EBFt qu\u1EA3, ch\u1EDD m\u1ECDc l\u1EA1i" };
  const job = NODE_JOB[node.kind];
  const pool = mine(sim2, sim2.villagers.map((v2) => v2.id)).filter((v2) => v2.job === job && v2.inside === null && v2.post < 0 && v2.phase !== "sleep" && v2.prefer !== ty * sim2.world.size + tx);
  if (!pool.length) return { reason: job === "wood" ? "Ch\u01B0a c\xF3 ai l\xE0m ngh\u1EC1 \u0111\u1ED1n g\u1ED7: giao ngh\u1EC1 \u1EDF X\u01B0\u1EDFng g\u1ED7" : job === "stone" ? "Ch\u01B0a c\xF3 ai l\xE0m th\u1EE3 \u0111\xE1: giao ngh\u1EC1 \u1EDF X\u01B0\u1EDFng \u0111\xE1" : "Ch\u01B0a c\xF3 ai h\xE1i l\u01B0\u1EE3m: giao ngh\u1EC1 \u1EDF N\xF4ng tr\u1EA1i" };
  pool.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
  const near2 = pool.slice(0, 3), v = near2[Math.floor(hash2(tx, ty, Math.floor(sim2.time)) * near2.length) % near2.length];
  orderWork(sim2, [v.id], tx, ty);
  return { name: v.name };
}
function orderWork(sim2, ids2, tx, ty) {
  if (!sim2.world.inBounds(tx, ty)) return null;
  const idx = ty * sim2.world.size + tx;
  const node = sim2.world.nodeAt(tx, ty), site = sim2.buildingAt(tx, ty);
  let job = null, prefer = -1;
  if (node && sim2.fog.state[idx] > 0) {
    job = NODE_JOB[node.kind];
    prefer = idx;
  } else if (site && needsWork(site)) {
    job = "build";
    prefer = site.id;
  }
  if (!job) return null;
  const first = !!site && site.kind === "builder" && !sim2.building("builder");
  let err = null;
  if (node && (job === "wood" || job === "stone" || job === "food")) {
    const idle2 = mine(sim2, ids2).filter(isFree).map((v) => v.id);
    if (idle2.length) err = sim2.assignRole(idle2, job);
  }
  const workers = mine(sim2, ids2).filter((v) => v.job === job || first && v.job !== "fight");
  for (const v of workers) {
    resetTask(sim2, v);
    clearCombat(sim2, v);
    v.job = job;
    v.prefer = prefer;
  }
  return { job, sent: workers.length, err };
}
function autoHunter(sim2, ids2, target) {
  const e = resolve(sim2, target);
  if (e?.kind !== "animal" || e.a.state !== "dead" && !animalDef(e.a).prey) return null;
  const idle2 = mine(sim2, ids2).filter(isFree).map((v) => v.id);
  return idle2.length ? sim2.assignRole(idle2, "hunt") : null;
}
function setJob(sim2, ids2, job) {
  const lock = sim2.warLock();
  if (lock) return lock;
  if (job === "fight") return enlist(sim2, ids2) > 0 ? null : "Ch\u1ECDn d\xE2n th\u01B0\u1EDDng \u0111\u1EC3 tuy\u1EC3n l\xE0m chi\u1EBFn binh";
  if (job === "scout") return sim2.enlistScouts(ids2);
  const soldiers = mine(sim2, ids2).filter((v) => v.job === "fight"), scouts = mine(sim2, ids2).filter((v) => v.job === "scout");
  const rest = ids2.filter((id) => !soldiers.some((s) => s.id === id) && !scouts.some((s) => s.id === id));
  const err = jobFor(sim2, rest, job);
  return err ?? (soldiers.length ? "Chi\u1EBFn binh do tr\u1EA1i l\xEDnh c\u1EE7a h\u1ECD qu\u1EA3n l\xFD: cho h\u1ECD ngh\u1EC9 \u1EDF \u0111\xF3 tr\u01B0\u1EDBc" : scouts.length ? "Trinh s\xE1t do Tr\u1EA1i trinh s\xE1t qu\u1EA3n l\xFD: cho h\u1ECD ngh\u1EC9 \u1EDF \u0111\xF3 tr\u01B0\u1EDBc" : null);
}
function jobFor(sim2, ids2, job) {
  if (job === "craft" || job === "research" || job === "tame") return sim2.assignStaff(ids2, job);
  if (job === "build") return sim2.assignCrew(ids2);
  for (const v of mine(sim2, ids2)) {
    resetTask(sim2, v);
    clearCombat(sim2, v);
    v.job = job;
    v.prefer = -1;
    v.post = -1;
    keepWatch(sim2, v);
  }
  return null;
}
function enlist(sim2, ids2) {
  let n = 0;
  for (const v of mine(sim2, ids2)) {
    if (v.job === "fight" || v.job === "scout" || v.job === "supply") continue;
    resetTask(sim2, v);
    clearCombat(sim2, v);
    v.job = "fight";
    v.prefer = -1;
    v.post = -1;
    v.fight.anchor = null;
    keepWatch(sim2, v);
    n++;
  }
  return n;
}
var campFolk = (sim2, v) => v.job === "fight" || v.job === "supply" || v.job === "scout" && !sim2.scouts.some((m) => m.ids.includes(v.id));
var isOut = (v) => v.guard ? !v.housed : !!v.out;
function callOut(sim2, ids2) {
  let n = 0;
  for (const v of mine(sim2, ids2)) {
    if (!campFolk(sim2, v) || v.post >= 0 || isOut(v)) continue;
    v.recall = false;
    if (v.guard) v.housed = false;
    else v.out = true;
    sim2.exitBuilding(v);
    if (v.phase === "sleep" || v.phase === "goHome") {
      v.phase = "idle";
      v.path = [];
      v.bed = -1;
    }
    n++;
  }
  if (n) sim2.say(n === 1 ? "M\u1ED9t ng\u01B0\u1EDDi \u0111\u01B0\u1EE3c g\u1ECDi ra kh\u1ECFi tr\u1EA1i." : `${n} ng\u01B0\u1EDDi \u0111\u01B0\u1EE3c g\u1ECDi ra kh\u1ECFi tr\u1EA1i.`);
  return n;
}
function sendBack(sim2, ids2) {
  let n = 0;
  for (const v of mine(sim2, ids2)) {
    if (!campFolk(sim2, v) || v.post >= 0 || !isOut(v)) continue;
    if (v.guard) v.housed = true;
    else v.out = false;
    v.recall = true;
    n++;
  }
  if (n) sim2.say(n === 1 ? "M\u1ED9t ng\u01B0\u1EDDi v\u1EC1 tr\u1EA1i." : `${n} ng\u01B0\u1EDDi v\u1EC1 tr\u1EA1i.`);
  return n;
}
function discharge(sim2, ids2) {
  let n = 0;
  for (const v of mine(sim2, ids2)) {
    if (v.job !== "fight") continue;
    resetTask(sim2, v);
    clearCombat(sim2, v);
    v.job = "idle";
    v.nightOwl = false;
    v.post = -1;
    v.guard = false;
    v.guardAt = null;
    v.out = false;
    v.housed = false;
    v.recall = false;
    sim2.assignGear([v.id], null, "weapon");
    sim2.assignGear([v.id], null, "armor");
    v.manualGear = false;
    n++;
  }
  return n;
}
function targetAt(sim2, x, y) {
  const N = sim2.world.size, seen = (px, py) => sim2.fog.state[Math.floor(py) * N + Math.floor(px)] === 2;
  let best = null, bd = 0.9;
  for (const f of sim2.foes) {
    if (f.health <= 0 || !seen(f.x, f.y)) continue;
    const d = Math.hypot(f.x - x, f.y - 0.5 - y);
    if (d < bd) {
      bd = d;
      best = { target: { kind: "unit", id: f.id }, kind: "foe" };
    }
  }
  for (const a of sim2.animals) {
    if (!seen(a.x, a.y)) continue;
    const d = Math.hypot(a.x - x, a.y - 0.3 - y);
    if (d < bd) {
      bd = d;
      best = { target: { kind: "animal", id: a.id }, kind: a.state === "dead" ? "carcass" : "animal" };
    }
  }
  return best;
}
function orderAttack(sim2, ids2, target, queue = false) {
  const e = resolve(sim2, target);
  const prey = e?.kind === "animal" && e.a.state !== "dead" && animalDef(e.a).prey;
  let n = 0;
  for (const v of mine(sim2, ids2)) {
    if (!(v.job === "fight" || prey && v.job === "hunt")) continue;
    n++;
    if (queue && busy(sim2, v)) {
      v.queue.push({ k: "attack", t: target });
      continue;
    }
    resetTask(sim2, v);
    clearCombat(sim2, v);
    v.prefer = -1;
    v.fight.mode = "attack";
    v.fight.target = target;
    takeOut(sim2, v);
    keepWatch(sim2, v);
  }
  return n;
}
function orderAttackMove(sim2, ids2, x, y, queue = false) {
  for (const v of mine(sim2, ids2)) {
    if (v.job !== "fight") continue;
    if (queue && busy(sim2, v)) {
      v.queue.push({ k: "attackMove", x, y });
      continue;
    }
    resetTask(sim2, v);
    clearCombat(sim2, v);
    v.prefer = -1;
    v.fight.mode = "attackMove";
    v.fight.dest = { x, y };
    v.phase = "move";
    takeOut(sim2, v);
    keepWatch(sim2, v);
  }
}
function orderLoot(sim2, ids2, animalId) {
  let n = 0;
  for (const v of mine(sim2, ids2)) {
    if (v.job !== "hunt") continue;
    resetTask(sim2, v);
    clearCombat(sim2, v);
    v.loot = animalId;
    v.phase = "goCarcass";
    n++;
  }
  return n;
}
function orderHold(sim2, ids2) {
  for (const v of mine(sim2, ids2)) {
    if (v.job !== "fight" && v.job !== "hunt") continue;
    resetTask(sim2, v);
    clearCombat(sim2, v);
    v.fight.mode = "hold";
    v.fight.anchor = { x: v.x, y: v.y };
    takeOut(sim2, v);
    keepWatch(sim2, v);
  }
}
function orderStop(sim2, ids2) {
  for (const v of mine(sim2, ids2)) {
    resetTask(sim2, v);
    clearCombat(sim2, v);
    if (v.job === "fight") {
      v.fight.mode = "hold";
      v.fight.anchor = { x: v.x, y: v.y };
      takeOut(sim2, v);
      keepWatch(sim2, v);
    }
  }
}
function setStance(sim2, ids2, stance) {
  for (const v of mine(sim2, ids2)) {
    v.stance = stance;
    if (stance === "defensive") v.fight.anchor = v.fight.anchor ?? { x: v.x, y: v.y };
    else if (v.fight.mode !== "hold") v.fight.anchor = null;
  }
}
function nextOrder(sim2, v) {
  const o = v.queue.shift();
  if (!o) return false;
  resetTask(sim2, v);
  if (o.k === "move") {
    v.fight.mode = "none";
    v.fight.target = null;
    const goal = sim2.nearestFree(Math.floor(o.x), Math.floor(o.y), /* @__PURE__ */ new Set());
    if (goal) {
      v.path = sim2.pathTo(v, goal[0], goal[1], 3e4);
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

// src/sim/movement.ts
function nearestFree(sim2, tx, ty, taken) {
  const N = sim2.world.size;
  for (let r = 0; r <= 12; r++) {
    let best = null, bd = Infinity;
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
        if (sim2.world.isBlocked(x, y) || taken.has(y * N + x)) continue;
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
function freeSpotNear(sim2, x, y, reach = 8) {
  const fx = Math.floor(x), fy = Math.floor(y);
  for (let r = 0; r <= reach; r++) {
    let best = null, bd = Infinity;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r || sim2.world.isBlocked(fx + i, fy + j)) continue;
      const d = (fx + i + 0.5 - x) ** 2 + (fy + j + 0.5 - y) ** 2;
      if (d < bd) {
        bd = d;
        best = [fx + i, fy + j];
      }
    }
    if (best) return [best[0] + 0.5, best[1] + 0.5];
  }
  return null;
}
var progress = /* @__PURE__ */ new WeakMap();
function unstickWalker(sim2, v, dt) {
  if (v.inside !== null) return;
  const w = sim2.world, ours = passOf(v);
  if ((v.phase === "idle" || v.phase === "wait") && !v.slide && !v.path.length && w.isBlockedFor(Math.floor(v.x), Math.floor(v.y), ours)) {
    const spot2 = freeSpotNear(sim2, v.x, v.y);
    if (spot2) {
      v.x = spot2[0];
      v.y = spot2[1];
      v.slide = null;
    }
  }
  if (!v.path.length) {
    progress.delete(v);
    return;
  }
  const goal = v.path[v.path.length - 1];
  const blocked = v.path.length > 1 && w.isBlockedFor(v.path[0][0], v.path[0][1], ours);
  const p = progress.get(v);
  if (!p) progress.set(v, { x: v.x, y: v.y, t: 0 });
  else {
    p.t += dt;
    if (p.t >= 2.5) {
      const stuckNow = Math.hypot(p.x - v.x, p.y - v.y) < 1.25;
      p.x = v.x;
      p.y = v.y;
      p.t = 0;
      if (stuckNow) p.t = 99;
    }
  }
  const stuck = !!p && p.t === 99;
  if (!blocked && !stuck) return;
  progress.delete(v);
  const [gx, gy] = goal, standing2 = w.isBlockedFor(Math.floor(v.x), Math.floor(v.y), ours) ? freeSpotNear(sim2, v.x, v.y) : null;
  if (standing2) {
    v.x = standing2[0];
    v.y = standing2[1];
  }
  let again = [];
  if (v.team !== "player") again = sim2.pathTo(v, gx, gy, 6e3);
  else if (sim2.pathLeft > 0) {
    sim2.pathLeft--;
    again = sim2.pathTo(v, gx, gy, 6e3);
  }
  v.path = again;
  if (!again.length) {
    v.slide = null;
    if (v.phase === "move") v.phase = "idle";
  }
  if (stuck && v.team !== "player") {
    if (v.ai && v.fight.target?.kind === "unit") v.ai.skip = { id: v.fight.target.id, until: sim2.time + 20 };
    v.fight.target = null;
    v.fight.repath = 3;
    if (v.phase === "fight") v.phase = "idle";
  }
}
function moveUnit(sim2, v, dt) {
  unstickWalker(sim2, v, dt);
  const walk = v.speed * WEATHER[sim2.weather].speed * (v.phase === "flee" ? 1.3 : 1) * sim2.mountSpeed(v) * (sim2.warIds.has(v.id) ? sim2.march.speed * (v.hurry ? 2.5 : v.job === "supply" ? 1.25 : 1) : 1);
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
function animate(sim2, v, dt) {
  const lit = !!v.torch && sim2.resting && v.phase !== "sleep" && v.phase !== "goHome";
  if (lit !== v.lit) {
    v.lit = lit;
    sim2.fogDirty = true;
  }
  if (!sim2.inView(v.x, v.y)) return;
  let anim = "idle", hold = null;
  const walking = v.path.length > 0 || !!v.slide;
  const armed = () => {
    if (!v.weapon) return null;
    const w = weaponOf(v);
    return { kind: v.weapon, tier: w.tier ?? 1 };
  };
  const ready = v.phase === "fight" || v.fight.mode !== "none";
  const carrying = !!v.weapon && (v.job === "fight" || v.job === "hunt" || !!v.ai && v.ai.role !== "civ");
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
    const k = TOOL_OF_JOB[v.job], tier = sim2.toolTier(v, v.job);
    if (k && tier > 0) {
      anim = JOBS[v.job].anim === "gather" ? "dig" : JOBS[v.job].anim;
      hold = { kind: k, tier };
    } else anim = "gather";
  } else if (v.phase === "build") {
    const t = sim2.toolTier(v, "build");
    if (t > 0) {
      anim = "build";
      hold = { kind: "hammer", tier: t };
    } else anim = "gather";
  } else if (v.phase === "skin") anim = "gather";
  if (anim !== v.anim) {
    v.anim = anim;
    v.animClock = 0;
  } else v.animClock += dt;
  v.hold = hold;
}
function ringTiles(sim2, v, x, y, w, h) {
  const out = [];
  for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
    if (i >= x && i < x + w && j >= y && j < y + h) continue;
    if (!sim2.world.isBlocked(i, j)) out.push([i, j]);
  }
  const cost = (t) => Math.hypot(t[0] + 0.5 - v.x, t[1] + 0.5 - v.y) + (t[0] >= x && t[0] < x + w ? 1.5 : 0);
  out.sort((a, b) => cost(a) - cost(b));
  return out;
}
function standTile(sim2, v) {
  const fx = Math.floor(v.x), fy = Math.floor(v.y);
  if (!sim2.world.isBlockedFor(fx, fy, passOf(v))) return [fx, fy];
  let best = [fx, fy], bd = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = fx + dx, y = fy + dy;
    if (sim2.world.isBlockedFor(x, y, passOf(v))) continue;
    const d = Math.hypot(x + 0.5 - v.x, y + 0.5 - v.y);
    if (d < bd) {
      bd = d;
      best = [x, y];
    }
  }
  return best;
}
function pathTo(sim2, v, gx, gy, maxNodes = 14e3) {
  const [sx, sy] = standTile(sim2, v), off = sx !== Math.floor(v.x) || sy !== Math.floor(v.y);
  const p = gx === sx && gy === sy ? [] : findPath(sim2.world, sx, sy, gx, gy, maxNodes, passOf(v));
  return off ? [[sx, sy], ...p] : p;
}
function routeTo(sim2, v, tiles, tries = 3, maxNodes = 14e3) {
  const [sx, sy] = standTile(sim2, v);
  for (let k = 0; k < Math.min(tries, tiles.length); k++) {
    const [gx, gy] = tiles[k];
    const p = pathTo(sim2, v, gx, gy, maxNodes), last = p[p.length - 1];
    if (gx === sx && gy === sy || last && last[0] === gx && last[1] === gy) {
      v.path = p;
      return k;
    }
  }
  return -1;
}
var passOf = (v) => v.team === "player" ? true : v.team === "wild" ? false : "foe";

// src/sim/hunting.ts
var HUNT_RANGE = [24, 36, 52];
function preyValue(sim2, species) {
  const def = ANIMALS[species], w = BEHAVIOUR.huntValue;
  let value = def.meat * (w.meat ?? 0);
  for (const [res, n] of Object.entries({ hide: def.hide, ...def.drops ?? {} })) if (n && resourceOpen(res, sim2.buildings)) value += n * (w[res] ?? 0);
  return value;
}
var huntHpCap = (level) => BEHAVIOUR.huntHpCap[Math.min(BEHAVIOUR.huntHpCap.length, Math.max(1, level)) - 1];
function huntRange(sim2) {
  return HUNT_RANGE[Math.min(HUNT_RANGE.length, sim2.building("huntlodge")?.level ?? 1) - 1];
}
function huntBrain(sim2, v, dt, threats) {
  if (v.health < v.maxHealth * HUNT_BACK && v.phase !== "skin") {
    if (v.phase === "move" && v.path.length) return true;
    if (v.phase === "fight" || v.phase === "goCarcass") {
      v.phase = "idle";
      v.path = [];
      v.loot = -1;
    }
    if (v.carry && v.carry.amount > 0) {
      sim2.planDeliver(v);
      return true;
    }
    const fire2 = sim2.campfire();
    if (fire2 && Math.hypot(v.x - fire2.x - 1, v.y - fire2.y - 1) > 4 && sim2.pathLeft > 0) {
      sim2.pathLeft--;
      v.path = sim2.pathTo(v, Math.floor(fire2.x + 1), Math.floor(fire2.y + 2), 4e3);
      if (v.path.length) {
        v.phase = "move";
        return true;
      }
    }
    sim2.wait(v, 2);
    return true;
  }
  if (v.phase === "skin") {
    v.timer -= dt;
    v.anim = "build";
    if (v.timer > 0) return true;
    const a = sim2.animalById.get(v.loot);
    v.phase = "idle";
    v.loot = -1;
    if (!a) return true;
    const more = 1 + (statBonus(sim2.researched, "hunt", "gyield") + villageBonus(sim2)) / 100;
    const have2 = v.carry && v.carry.res === "food" ? v.carry.amount : 0, take2 = Math.min(a.meat, Math.max(0, Math.floor((CARRY_CAP.food - have2) / more)));
    if (take2 > 0) {
      const got2 = Math.ceil(take2 * more - 1e-9);
      a.meat -= take2;
      v.carry = { res: "food", amount: have2 + got2 };
      sim2.noteYield("hunt.food", got2);
    }
    const got = [], left = [], bag = { ...a.drops };
    if (a.hide > 0) bag.hide = (bag.hide ?? 0) + a.hide;
    for (const [res, n] of Object.entries(bag)) {
      if (!(n > 0)) continue;
      if (!resourceOpen(res, sim2.buildings)) {
        const u = resourceUnlock(res);
        left.push(`${RES_NAME[res].toLowerCase()} (c\u1EA7n ${BUILDINGS[u.building].name} c\u1EA5p ${u.level})`);
        continue;
      }
      const k = Math.ceil(n * more - 1e-9);
      sim2.stock[res] = Math.min(sim2.capacity(res), sim2.stock[res] + k);
      sim2.noteYield(`hunt.${res}`, k);
      got.push(`${k} ${RES_NAME[res].toLowerCase()}`);
    }
    a.hide = 0;
    a.drops = {};
    if (got.length) sim2.say(`${v.name} x\u1EBB ${animalDef(a).name.toLowerCase()}: ${got.join(", ")}.`);
    if (left.length) sim2.say(`${v.name} b\u1ECF l\u1EA1i ${left.join(", ")}: ch\u01B0a l\u1EA5y \u0111\u01B0\u1EE3c.`);
    return true;
  }
  if (v.phase === "goCarcass") {
    const a = sim2.animalById.get(v.loot);
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
      v.path = sim2.pathTo(v, Math.floor(a.x), Math.floor(a.y), 3e3);
      if (!v.path.length) {
        v.phase = "idle";
        v.loot = -1;
      }
    }
    return true;
  }
  if (v.phase === "move" && v.path.length) return true;
  if (v.carry && v.carry.amount >= CARRY_CAP[v.carry.res]) {
    sim2.planDeliver(v);
    return true;
  }
  const N = sim2.world.size;
  const lodge = sim2.building("huntlodge") ?? sim2.campfire(), range = huntRange(sim2);
  let best = null, bd = 45;
  if (v.loot >= 0) {
    const a = sim2.animalById.get(v.loot);
    if (a && a.state === "dead") best = a;
    else v.loot = -1;
  }
  if (!best) for (const a of sim2.animals) {
    if (a.state !== "dead" || carcassEmpty(a) || sim2.fog.state[Math.floor(a.y) * N + Math.floor(a.x)] === 0) continue;
    const d = Math.hypot(a.x - v.x, a.y - v.y);
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  if (best) {
    v.loot = best.id;
    v.phase = "goCarcass";
    v.path = sim2.pathTo(v, Math.floor(best.x), Math.floor(best.y), 3e3);
    return true;
  }
  if (!threats.length) {
    let prey = null, bestScore = 0;
    const cap = huntHpCap(sim2.building("huntlodge")?.level ?? 1);
    for (const a of sim2.animals) {
      const def = animalDef(a);
      if (a.state === "dead" || !def.prey || sim2.fog.state[Math.floor(a.y) * N + Math.floor(a.x)] === 0) continue;
      if (v.fight.skip && v.fight.skip.kind === "animal" && v.fight.skip.id === a.id && sim2.time < v.fight.skip.until) continue;
      if (lodge && Math.hypot(a.x - lodge.x, a.y - lodge.y) > range) continue;
      if (def.hp > cap) continue;
      if (def.defends && !sim2.packNear(v, a)) continue;
      const d = Math.hypot(a.x - v.x, a.y - v.y), score = preyValue(sim2, a.species) / (1 + d / 12);
      if (score > bestScore) {
        bestScore = score;
        prey = a;
      }
    }
    if (prey) {
      v.fight.target = { kind: "animal", id: prey.id };
      engage(sim2, v, { kind: "animal", a: prey }, 0);
      return true;
    }
  }
  if (v.carry && v.carry.amount > 0) {
    sim2.planDeliver(v);
    return true;
  }
  if (v.phase === "fight") {
    v.phase = "idle";
    v.path = [];
  }
  if (lodge) {
    const step2 = Math.floor(sim2.time / 8), spots = [];
    for (let t = 0; t < 10; t++) {
      const ang = hash2(v.id, step2 * 16 + t, 71) * Math.PI * 2, rad = 6 + hash2(v.id, step2 * 16 + t, 72) * (range - 6);
      const gx = Math.floor(lodge.x + Math.cos(ang) * rad), gy = Math.floor(lodge.y + Math.sin(ang) * rad);
      if (sim2.world.inBounds(gx, gy) && !sim2.world.isBlocked(gx, gy)) spots.push([gx, gy, sim2.fog.state[gy * N + gx] === 0]);
    }
    spots.sort((p, q) => Number(q[2]) - Number(p[2]));
    for (const [gx, gy] of spots) {
      if (sim2.pathLeft <= 0) break;
      sim2.pathLeft--;
      const path = sim2.pathTo(v, gx, gy, 2500);
      if (path.length) {
        v.path = path;
        v.phase = "move";
        return true;
      }
    }
  }
  sim2.wait(v, 1);
  return true;
}

// src/sim/brainplayer.ts
var { sight: SIGHT2, defensive: DEFENSIVE } = PLAYER;
function brainPlayer(sim2, v, dt) {
  if (v.phase === "goStore" || v.phase === "goEquip") return false;
  if (v.fight.obey && (v.phase !== "move" || !v.path.length)) v.fight.obey = false;
  if (sim2.underOrders(v)) {
    v.fleeT = 0;
    return false;
  }
  if (v.recall) {
    if (v.inside !== null || !sim2.quartered(v)) v.recall = false;
    else {
      v.fight.target = null;
      v.fight.mode = "none";
      v.fight.anchor = null;
      v.queue.length = 0;
      if (v.phase === "fight") {
        v.phase = "idle";
        v.path = [];
      }
      return false;
    }
  }
  const rest = v.phase === "sleep" || v.phase === "goHome";
  if (rest && sim2.hides(v)) return false;
  v.fight.scan -= dt;
  const scanNow = v.fight.scan <= 0;
  if (scanNow) v.fight.scan = 0.35;
  const looking = scanNow || v.phase === "flee" || v.phase === "fight" && !v.fight.target;
  const sight = v.team === "player" ? sim2.sightOf(v) : SIGHT2;
  const threats = looking ? threatsOf(sim2, v, sight + 1) : [];
  if (rest) {
    if (v.job === "supply" && v.inTent) return false;
    const watch2 = isFighter(v) && (v.guard || v.post >= 0 || sim2.warIds.has(v.id));
    if (scanNow && threats.length && threats[0].d < (watch2 ? sight : 7)) {
      if (isFighter(v)) v.nightOwl = true;
      if (v.post >= 0 && v.inside !== null && v.phase === "sleep") {
        v.phase = "inside";
        return false;
      }
      sim2.resetTask(v);
    } else return false;
  }
  if (v.phase === "flee" || v.fleeT > 0) return fleeBrain(sim2, v, dt, threats);
  if (v.breaks && sim2.breakBrain(v, dt)) return true;
  const fighter = isFighter(v);
  if (!fighter) {
    if (threats.length && threats[0].d < FEAR && v.phase !== "fight") {
      startFlee(sim2, v, 8, threats[0]);
      return true;
    }
    if (scanNow && isFree(v) && v.inside === null && v.phase !== "sleep" && v.phase !== "goHome" && sim2.attackReason() !== null && refugeOf(sim2, v)) {
      startFlee(sim2, v, 8);
      return true;
    }
    return assistBrain(sim2, v);
  }
  return fightBrain(sim2, v, dt, threats);
}
function fleeSpot(sim2, v, from) {
  const fire2 = sim2.campfire();
  let guard, gd = 40;
  for (const o of sim2.villagers) {
    if (o === v || o.job !== "fight" || o.health <= 0 || o.down > 0 || o.inside !== null || o.phase === "flee" || o.phase === "sleep" || o.phase === "goHome") continue;
    const d = Math.hypot(o.x - v.x, o.y - v.y);
    if (d < gd) {
      gd = d;
      guard = o;
    }
  }
  const tx = guard ? guard.x : fire2 ? fire2.x + 1 : v.x, ty = guard ? guard.y : fire2 ? fire2.y + 2 : v.y;
  let gx = tx, gy = ty;
  if (from) {
    const dx = tx - from.x, dy = ty - from.y, len = Math.hypot(dx, dy) || 1;
    gx += dx / len * 1.5;
    gy += dy / len * 1.5;
  }
  const spot2 = sim2.nearestFree(Math.floor(gx), Math.floor(gy), /* @__PURE__ */ new Set());
  return spot2 ? sim2.pathTo(v, spot2[0], spot2[1], 4e3) : [];
}
var FEAR = PLAYER.fear;
function crowd(sim2, b, except) {
  let n = 0;
  for (const o of sim2.villagers) if (o !== except && (o.inside === b.id && o.phase === "sleep" || (o.phase === "goHome" || o.phase === "flee") && o.target === b.id)) n++;
  return n;
}
function refugeOf(sim2, v) {
  for (const kind of /* @__PURE__ */ new Set([homeKind(v), "house"])) {
    let best, bd = Infinity;
    for (const x of sim2.buildings) {
      if (x.kind !== kind || !x.done || crowd(sim2, x, v) >= levelDef(x).slots) continue;
      const d = Math.hypot(x.x + 1 - v.x, x.y + 1 - v.y);
      if (d < bd) {
        bd = d;
        best = x;
      }
    }
    if (best) return best;
  }
  return void 0;
}
function runToRefuge(sim2, v) {
  const b = refugeOf(sim2, v);
  if (!b) return false;
  const d = BUILDINGS[b.kind];
  if (sim2.routeTo(v, sim2.ringTiles(v, b.x, b.y, d.w, d.h), 3, 12e3) < 0) return false;
  v.target = b.id;
  return true;
}
function runAway(sim2, v, from) {
  const ax = from ? v.x - from.x : 0, ay = from ? v.y - from.y : 1, len = Math.hypot(ax, ay) || 1;
  const spot2 = sim2.nearestFree(Math.floor(v.x + ax / len * 12), Math.floor(v.y + ay / len * 12), /* @__PURE__ */ new Set());
  return spot2 ? sim2.pathTo(v, spot2[0], spot2[1], 4e3) : [];
}
function startFlee(sim2, v, secs, from) {
  const keep = v.job, nightOwl = v.nightOwl;
  sim2.resetTask(v);
  v.job = keep;
  v.nightOwl = nightOwl;
  v.fight.target = null;
  if (v.fight.mode === "attack") v.fight.mode = "none";
  v.phase = "flee";
  v.fleeT = secs;
  if (!isFighter(v)) {
    sim2.dangerAt = sim2.time;
    if (runToRefuge(sim2, v)) return;
    v.path = runAway(sim2, v, from);
    return;
  }
  v.path = fleeSpot(sim2, v, from);
}
function fleeBrain(sim2, v, dt, threats) {
  if (v.phase !== "flee") {
    startFlee(sim2, v, 8, threats[0]);
    return true;
  }
  const civilian2 = !isFighter(v), refuge = civilian2 && v.target >= 0 ? sim2.getBuilding(v.target) : void 0;
  if (civilian2) sim2.dangerAt = sim2.time;
  if (refuge && refuge.done) {
    const d = BUILDINGS[refuge.kind];
    if (Math.hypot(v.x - (refuge.x + d.w / 2), v.y - (refuge.y + d.h / 2)) <= Math.max(d.w, d.h) / 2 + 1.8) {
      if (crowd(sim2, refuge, v) < levelDef(refuge).slots) {
        sim2.sleepIn(v, refuge);
        v.fleeT = 0;
        return true;
      }
      v.target = -1;
      v.timer = 0;
    } else {
      v.timer -= dt;
      if (!v.path.length && v.timer <= 0) {
        v.timer = 1.5;
        if (!runToRefuge(sim2, v)) v.target = -1;
      }
      return true;
    }
  }
  v.fleeT -= dt;
  if (threats.length && threats[0].d < FEAR) v.fleeT = Math.max(v.fleeT, 3);
  v.timer -= dt;
  if (v.timer <= 0) {
    v.timer = 1.5;
    if (civilian2) {
      if (runToRefuge(sim2, v)) return true;
      if (!v.path.length) v.path = runAway(sim2, v, threats[0]);
    } else {
      const way = fleeSpot(sim2, v, threats[0]);
      if (way.length > 2) v.path = way;
    }
  }
  if (v.fleeT <= 0) {
    v.phase = "idle";
    v.fleeT = 0;
    v.path = [];
    return false;
  }
  return true;
}
function assistBrain(sim2, v) {
  if (v.phase === "rescue") {
    const t = sim2.get(v.target);
    if (!t || t.down <= 0) {
      v.phase = "idle";
      v.target = -1;
      return false;
    }
    if (Math.hypot(t.x - v.x, t.y - v.y) < 1.4) {
      v.path = [];
      return true;
    }
    if (!v.path.length) v.path = sim2.pathTo(v, Math.floor(t.x), Math.floor(t.y), 3e3);
    return true;
  }
  if (v.phase === "sleep" || v.phase === "goHome") return false;
  const down = sim2.villagers.find((o) => o !== v && o.down > 0 && Math.hypot(o.x - v.x, o.y - v.y) < 14);
  if (down && v.health > 0) {
    const keep = v.job, owl = v.nightOwl;
    sim2.resetTask(v);
    v.job = keep;
    v.nightOwl = owl;
    v.phase = "rescue";
    v.target = down.id;
    v.path = sim2.pathTo(v, Math.floor(down.x), Math.floor(down.y), 3e3);
    return true;
  }
  return false;
}
function endOrder(sim2, v) {
  const f = v.fight;
  if (v.job !== "fight") f.mode = "none";
  else if (v.guard) {
    f.mode = "guard";
    f.anchor = homeSpot(sim2, v) ?? { x: v.x, y: v.y };
  } else if (v.team === "player" && v.squad < 0) {
    f.mode = "none";
    f.anchor = null;
  } else {
    f.mode = "guard";
    f.anchor = { x: v.x, y: v.y };
  }
}
function homeSpot(sim2, v) {
  if (v.guard && v.guardAt) return v.guardAt;
  const camp = sim2.buildings.find((b) => b.kind === sim2.homeKind(v) && b.done);
  if (camp) return { x: camp.x + 1 + v.id % 3 - 1, y: camp.y + 3 };
  const fire2 = sim2.campfire();
  return fire2 ? { x: fire2.x + 1 + v.id % 3 - 1, y: fire2.y + 3 } : null;
}
var aboutCache = /* @__PURE__ */ new WeakMap();
function beastsAbout(sim2) {
  const c = aboutCache.get(sim2);
  if (c && c.t === sim2.time) return c.on;
  const on = sim2.attackReason() !== null || sim2.animals.some((a) => a.raid && a.state !== "dead");
  aboutCache.set(sim2, { t: sim2.time, on });
  return on;
}
function mayEngage(sim2, v) {
  if (v.job !== "fight" || v.guard || v.team !== "player") return true;
  return sim2.alarmUntil > sim2.time || beastsAbout(sim2) || sim2.battle.on || v.fight.mode === "attack" || v.fight.mode === "attackMove" || v.squad >= 0 && sim2.plans.some((p) => p.status === "running");
}
function fightBrain(sim2, v, dt, threats) {
  const f = v.fight;
  if (v.phase === "skin" || v.phase === "goCarcass") return huntBrain(sim2, v, dt, threats);
  if (v.job === "hunt" && v.health < v.maxHealth * HUNT_BACK && f.mode !== "attack") {
    f.target = null;
    if (threats.length && threats[0].d < 7 && v.phase !== "flee") {
      startFlee(sim2, v, 8, threats[0]);
      return true;
    }
    return huntBrain(sim2, v, dt, threats);
  }
  if (f.mode === "hold" && !f.anchor) f.anchor = { x: v.x, y: v.y };
  if (!threats.length && !f.target && v.phase !== "fight" && (sim2.planEquipGear(v) || sim2.planGearErrand(v))) return true;
  if (v.stance === "retreat" && f.mode !== "attack" && f.target) f.target = null;
  if (f.target) {
    const e = resolve(sim2, f.target);
    if (e) {
      if (f.mode === "hold" && f.anchor && Math.hypot(entX(e) - f.anchor.x, entY(e) - f.anchor.y) > weaponOf(v).range + 2) {
        f.target = null;
      } else {
        engage(sim2, v, e, dt);
        return true;
      }
    } else {
      const dead = f.target.kind === "animal" ? sim2.animalById.get(f.target.id) : void 0;
      f.target = null;
      if (f.mode === "attack") endOrder(sim2, v);
      if (dead && dead.state === "dead" && v.job === "hunt") v.loot = dead.id;
      if (v.phase === "fight") {
        v.phase = "idle";
        v.path = [];
      }
      if (sim2.nextOrder(v)) return true;
    }
  }
  if (v.stance === "retreat") {
    if (threats.length && threats[0].d < 8) {
      startFlee(sim2, v, 6, threats[0]);
      return true;
    }
  } else if (threats.length && f.scan >= 0) {
    const range = !mayEngage(sim2, v) ? Math.min(DEFENSIVE, sim2.sightOf(v)) : f.mode === "hold" ? weaponOf(v).range + 1.5 : v.stance === "defensive" ? Math.min(DEFENSIVE, sim2.sightOf(v)) : sim2.sightOf(v);
    const pick2 = threats.find((t) => (!v.guard || t.t.kind === "unit" || sim2.animalById.get(t.t.id)?.state === "attack") && t.d <= range && (!f.anchor || v.stance !== "defensive" || Math.hypot(t.x - f.anchor.x, t.y - f.anchor.y) < DEFENSIVE + 2));
    if (pick2) {
      f.target = pick2.t;
      const e = resolve(sim2, pick2.t);
      if (e) {
        engage(sim2, v, e, dt);
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
      if (sim2.nextOrder(v)) return true;
    } else {
      if (!v.path.length && sim2.pathLeft > 0) {
        sim2.pathLeft--;
        v.path = f.strict ? sim2.lineSteps(v, f.dest.x, f.dest.y) : sim2.pathTo(v, Math.floor(f.dest.x), Math.floor(f.dest.y), 2e4);
      }
      v.phase = "move";
      return true;
    }
  }
  if (v.post >= 0 && v.phase === "idle" && !threats.length && !f.target) {
    sim2.planStaff(v);
    if (v.phase === "goStaff") return true;
  }
  if (f.mode === "hold") {
    v.phase = "idle";
    v.path = [];
    return true;
  }
  if (v.job === "hunt") return huntBrain(sim2, v, dt, threats);
  if (v.phase === "fight") {
    v.phase = "idle";
    v.path = [];
  }
  if (v.job === "fight") {
    const home = homeSpot(sim2, v), post = v.guard && v.guardAt ? { x: v.guardAt.x, y: v.guardAt.y, slack: 2 } : f.mode === "guard" && f.anchor ? { x: f.anchor.x, y: f.anchor.y, slack: 2 } : home ? { x: home.x, y: home.y, slack: 5 } : null;
    if (post && v.phase === "idle" && !v.path.length && Math.hypot(v.x - post.x, v.y - post.y) > post.slack) {
      if (sim2.pathLeft <= 0) return true;
      sim2.pathLeft--;
      v.path = sim2.pathTo(v, Math.floor(post.x), Math.floor(post.y), 3e4);
      v.phase = v.path.length ? "move" : "idle";
      return true;
    }
    return v.phase === "move" || v.phase === "idle";
  }
  return false;
}

// src/sim/villagers.ts
function freshName(sim2, sex, rnd2) {
  const pool = (sex === "m" ? NAMES_M : NAMES_F).filter((n) => !sim2.villagers.some((v) => v.name === n));
  const list = pool.length ? pool : sex === "m" ? NAMES_M : NAMES_F;
  return list[Math.floor(rnd2() * list.length)];
}
function spawn(sim2, x, y, sex) {
  const v = makeVillager(sim2, x, y, sex, "player");
  sim2.villagers.push(v);
  sim2.byId.set(v.id, v);
  return v;
}
function makeVillager(sim2, x, y, sex, team, rnd2 = sim2.rnd) {
  const r = rnd2, pick2 = (a) => a[Math.floor(r() * a.length)];
  const { stars, fac } = rollFactors(r), stats = legacyStats((s) => rawValue(fac, s));
  const potential = {}, skill = {};
  for (const j of WORK_JOBS) {
    if (j === "hunt" || j === "fight" || j === "research" || j === "tame") {
      const k = j === "hunt" || j === "tame" ? stats.agi : j === "research" ? stats.sta : stats.str;
      potential[j] = k >= 9 ? 3 : k >= 6 ? 2 : 1;
      skill[j] = { xp: 0, level: 0 };
      continue;
    }
    const p = r();
    potential[j] = p < 0.45 ? 1 : p < 0.85 ? 2 : 3;
    skill[j] = { xp: 0, level: 0 };
  }
  return {
    id: sim2.nextVid++,
    name: freshName(sim2, sex, rnd2),
    look: { sex, skin: pick2(SKIN), hair: pick2(HAIR), hide: "#8b6a45", pants: "#3f63a8" },
    x: x + 0.5,
    y: y + 0.5,
    path: [],
    slide: null,
    facing: "front",
    speed: rawValue(fac, "move"),
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
    timer: 0,
    order: null,
    carry: null,
    health: Math.round(rawValue(fac, "hp")),
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
    squad: -1,
    stars,
    fac,
    statClock: 0,
    born: { ...stats },
    train: null,
    mount: null,
    guard: false,
    guardAt: null,
    breaks: null,
    gear: { w: null, wd: 0, wb: false, a: null, ad: 0, ab: false },
    team,
    maxHealth: Math.round(rawValue(fac, "hp")),
    weapon: null,
    armor: null,
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
function healFactor(sim2, v) {
  const role = treeRole(v), bonus = role ? statBonus(sim2.researched, role, "hpregen") : 0;
  const camp = v.job === "fight" && v.inside !== null ? sim2.getBuilding(v.inside) : void 0;
  return (1 + bonus / 100) * (camp && (camp.kind === "infantry" || camp.kind === "cavalry" || camp.kind === "archery" || camp.kind === "guardpost") ? rest_default.soldierHealInCamp : 1);
}
function tickVillager(sim2, v, dt) {
  tickCommon(sim2, v, dt);
  if ((v.statClock = (v.statClock ?? 0) - dt) <= 0) {
    v.statClock = 1 + v.id % 10 / 10;
    applyStats(sim2, v);
  }
  if (v.down > 0) {
    tickDown(sim2, v, dt);
    sim2.animate(v, dt);
    return;
  }
  if (v.health < v.maxHealth && v.calm > 10) v.health = Math.min(v.maxHealth, v.health + dt * 15e-4 * v.maxHealth * (1 - sim2.foodPenalty) * healFactor(sim2, v));
  if (v.health <= 0) {
    sim2.kill(v);
    return;
  }
  v.orderCd = Math.max(0, v.orderCd - dt);
  sim2.tickEnergy(v, dt);
  const held = sim2.heldTool(v);
  if (held && TOOL_OF_JOB[v.job] !== held.k) sim2.returnTool(v);
  if (v.inside !== null && v.phase !== "sleep") {
    const onWatch = v.job === "fight" && v.post >= 0 && sim2.tribes.some((t) => t.raid);
    if (sim2.shouldSleep(v, onWatch)) {
      if (atWork(sim2, v)) {
        v.phase = "sleep";
        v.facing = "front";
      } else {
        sim2.exitBuilding(v);
        goHome(sim2, v);
      }
    } else {
      sim2.animate(v, dt);
      return;
    }
  }
  const training = !!v.train && sim2.trainStep(v, dt);
  const brained = training ? false : brainPlayer(sim2, v, dt);
  const fighting = brained && (v.phase === "fight" || v.phase === "flee" || v.phase === "rescue");
  const asleep = v.phase === "goHome" || v.phase === "sleep";
  if (sim2.shouldSleep(v, fighting)) {
    if (!asleep) goHome(sim2, v);
  } else if (asleep && !sim2.hides(v)) {
    if (atWork(sim2, v) && v.phase === "sleep") v.phase = "inside";
    else {
      sim2.exitBuilding(v);
      v.path = [];
      v.slide = null;
      v.phase = "idle";
      v.bed = -1;
    }
  }
  if (sim2.warIds.has(v.id)) sim2.shelter(v);
  else if (v.inTent) v.inTent = false;
  seekBed(sim2, v, dt);
  sim2.moveUnit(v, dt);
  if (Math.floor(v.x) !== v.tx || Math.floor(v.y) !== v.ty) sim2.fogDirty = true;
  if (!v.path.length && !v.slide && !brained && !training) sim2.think(v, dt);
  sim2.animate(v, dt);
}
function atWork(sim2, v) {
  const b = v.inside === null ? void 0 : sim2.getBuilding(v.inside);
  return !!b && b.staff.includes(v.id);
}
function goHome(sim2, v) {
  if (sim2.warIds.has(v.id)) {
    sim2.resetTask(v);
    sim2.clearCombat(v);
    v.path = [];
    v.slide = null;
    v.phase = "sleep";
    v.facing = "front";
    return;
  }
  const owl = v.nightOwl;
  if (v.job === "idle") v.shift = "day";
  sim2.stash(v);
  sim2.resetTask(v);
  v.nightOwl = owl;
  v.phase = "sleep";
  const bed = sim2.freeBed(v);
  if (bed) {
    const bd = BUILDINGS[bed.kind];
    if (sim2.routeTo(v, sim2.ringTiles(v, bed.x, bed.y, bd.w, bd.h), 3, 8e4) >= 0) {
      v.target = bed.id;
      v.phase = "goHome";
      return;
    }
  }
  const fire2 = sim2.buildings.find((b) => b.kind === "campfire");
  if (!fire2) return;
  const d = BUILDINGS[fire2.kind];
  const taken = new Set(sim2.villagers.filter((o) => o !== v && o.bed >= 0).map((o) => o.bed));
  const spot2 = sim2.nearestFree(fire2.x + (d.w >> 1), fire2.y + d.h, taken);
  if (!spot2 || sim2.routeTo(v, [spot2], 1, 8e4) < 0) return;
  v.bed = spot2[1] * sim2.world.size + spot2[0];
  v.phase = "goHome";
}
function seekBed(sim2, v, dt) {
  if (v.phase !== "sleep" || v.inside !== null || v.bed < 0) return;
  const second = Math.floor(sim2.time);
  if (second === Math.floor(sim2.time - dt) || (second + v.id) % 3 !== 0) return;
  const bed = sim2.freeBed(v);
  if (!bed) return;
  const bd = BUILDINGS[bed.kind];
  if (sim2.routeTo(v, sim2.ringTiles(v, bed.x, bed.y, bd.w, bd.h), 3, 8e4) < 0) return;
  v.bed = -1;
  v.target = bed.id;
  v.phase = "goHome";
}
function pickLeaders(sim2) {
  const fighters = sim2.villagers.filter((v) => v.job === "fight" && v.health > 0 && v.down <= 0);
  for (const v of sim2.villagers) v.leader = false;
  if (fighters.length >= 5) fighters.sort((a, b) => b.stats.str + b.stats.agi - a.stats.str - a.stats.agi)[0].leader = true;
}

// src/sim/environment.ts
function tickCalendar(sim2) {
  const day = sim2.day;
  if (day !== sim2.lastDay) {
    sim2.lastDay = day;
    sim2.weather = sim2.nextWeather;
    sim2.nextWeather = rollWeather(seasonOf(day + 1), sim2.wrnd());
    sim2.signalled = false;
    const season = seasonOf(day);
    if (season !== sim2.world.season) {
      sim2.world.setSeason(season);
      sim2.say(SEASON_DEF[season].enter);
    }
    if (sim2.weather !== "clear") sim2.say(`H\xF4m nay: ${WEATHER[sim2.weather].name.toLowerCase()}.`);
    sim2.restockAnimals();
    sim2.eatDay();
    if (day >= start_default.arrivals.firstDay && !sim2.dev.noArrivals) newcomers(sim2);
  }
  if (!sim2.signalled && sim2.tod >= 0.5) {
    sim2.signalled = true;
    const sig = WEATHER[sim2.nextWeather].signal;
    if (sig && sim2.nextWeather !== sim2.weather) sim2.say(sig);
  }
  const rest = isRestTime(sim2.tod, sim2.season);
  if (sim2.resting !== rest) for (const v of sim2.villagers) {
    v.nightOwl = false;
    if (!rest) sim2.returnTorch(v);
  }
  sim2.resting = rest;
}
function toggleNewcomers(sim2) {
  sim2.newcomersOpen = !sim2.newcomersOpen;
  return sim2.newcomersOpen;
}
function newcomers(sim2) {
  if (!sim2.newcomersOpen) return;
  const { min, max } = start_default.arrivals;
  const names = settle(sim2, min + Math.floor(sim2.frnd() * (max - min + 1)));
  if (names.length) sim2.say(`${names.length} ng\u01B0\u1EDDi \u0111\u1EBFn l\xE0ng xin \u1EDF l\u1EA1i: ${names.join(", ")}.`);
}
function settle(sim2, n, room = false) {
  const { femaleChance } = start_default.arrivals, fire2 = sim2.campfire(), s = sim2.world.start, names = [];
  if (room) n = Math.min(n, Math.max(0, sim2.popCap() - sim2.villagers.length));
  for (let i = 0; i < n; i++) {
    const a = sim2.frnd() * Math.PI * 2, r = 2 + sim2.frnd() * 2;
    const gx = Math.floor((fire2 ? fire2.x + 1 : s.x) + Math.cos(a) * r), gy = Math.floor((fire2 ? fire2.y + 3 : s.y) + Math.sin(a) * r), spot2 = sim2.nearestFree(gx, gy, /* @__PURE__ */ new Set()) ?? [gx, gy];
    const v = sim2.makeVillager(spot2[0], spot2[1], sim2.frnd() < femaleChance ? "f" : "m", "player", sim2.frnd);
    sim2.villagers.push(v);
    sim2.registerUnit(v);
    names.push(v.name);
  }
  return names;
}
var TORCH_VISION = 6;
function refreshFog(sim2) {
  const r = visionRadius(sim2), fire2 = fireRadius(sim2);
  sim2.lastVision = r;
  const src = [], litCells = /* @__PURE__ */ new Set();
  for (const v of sim2.villagers) {
    if (v.lit) {
      const k = Math.floor(v.x / 2) * 65536 + Math.floor(v.y / 2);
      if (litCells.has(k)) continue;
      litCells.add(k);
    }
    src.push({ x: v.x, y: v.y, r: v.lit ? Math.max(r, TORCH_VISION) : r });
  }
  for (const b of sim2.buildings) if (b.done) {
    const d = BUILDINGS[b.kind];
    src.push({ x: b.x + d.w / 2, y: b.y + d.h / 2, r: b.kind === "campfire" ? fire2 : Math.max(r, buildingSight(b) - (b.kind === "tower" ? 0 : WEATHER[sim2.weather].vision)) });
  }
  sim2.fog.update(src);
  for (const v of sim2.villagers) {
    v.tx = Math.floor(v.x);
    v.ty = Math.floor(v.y);
  }
}
function visionRadius(sim2) {
  return Math.max(1, Math.round(NIGHT_VISION + (VISION - NIGHT_VISION) * sim2.light) - WEATHER[sim2.weather].vision);
}
function sightOf(sim2, v) {
  const r = visionRadius(sim2);
  return (v.torch || v.lit || inTowerLight(sim2, v.x, v.y) ? Math.max(r, TORCH_VISION) : r) + (armOf(v) === "archer" ? ARCHER_SIGHT : 0) + (v.team === "player" && v.job === "fight" ? v.guard ? GUARD_SIGHT : SOLDIER_SIGHT : 0);
}
function inTowerLight(sim2, x, y) {
  for (const b of sim2.buildings) {
    if (b.kind !== "tower" || !b.done) continue;
    const d = BUILDINGS.tower;
    if (Math.hypot(b.x + d.w / 2 - x, b.y + d.h / 2 - y) <= buildingSight(b)) return true;
  }
  return false;
}
var ARCHER_SIGHT = 1;
var SOLDIER_SIGHT = 2;
var GUARD_SIGHT = 5;
function fireRadius(sim2) {
  const fire2 = sim2.campfire();
  return Math.max(1, (fire2 ? buildingSight(fire2) : FIRE_VISION) - WEATHER[sim2.weather].vision);
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
var SAVE_VERSION = 28;
var SAVED = {
  /** Single values. */
  scalars: ["era", "time", "dayBase", "timeBase", "acc", "coinFrac", "sawCoin", "nextRaid", "nextAid", "nextVid", "nextBid", "nextSquad", "nextMission", "nextPlan", "alarmUntil", "tribeClock", "foodPot", "foodPenalty", "popBonus", "campBonus", "newcomersOpen", "nextEventDay", "conquered", "foodIncome", "foodSeen", "lastFullWarn", "lastMatWarn", "weather", "nextWeather", "lastDay", "signalled", "resting", "lastVision", "pendingTribe", "fogDirty"],
  /** Objects whose keys are filled in place. */
  records: ["stock", "toolStock", "battle", "yieldNow", "yieldPrev", "ruins", "drafts"],
  /** Lists of plain data. */
  lists: ["warLog", "scoutLosses", "wornTools", "craftQueue", "craftPaid", "tameQueue", "researchQueue", "log", "foodDays", "villagers", "buildings", "foes", "events", "animals", "projectiles", "squads", "maps", "scouts", "sightings", "plans", "battleReports"],
  /** Handled by hand below. */
  special: ["researched", "questSeen", "tribes", "world", "fog", "rnd", "frnd", "wrnd"]
};
function toSave(sim2) {
  const w = sim2.world;
  const pick2 = (keys) => Object.fromEntries(keys.map((k) => [k, encode(sim2[k])]));
  return {
    version: SAVE_VERSION,
    seed: sim2.seed,
    scalars: pick2(SAVED.scalars),
    records: pick2(SAVED.records),
    lists: pick2(SAVED.lists),
    researched: [...sim2.researched],
    quests: [...sim2.questSeen],
    tribes: sim2.tribes.map(({ def: _def, ...t }) => encode(t)),
    rng: { rnd: sim2.rnd.getState(), frnd: sim2.frnd.getState(), wrnd: sim2.wrnd.getState() },
    world: {
      season: w.season,
      tiles: packRuns(w.tiles),
      occ: packRuns(w.occ),
      decor: packRuns(w.decor),
      ready: packRuns(w.ready),
      nodes: [...w.nodes].map(([i, n]) => [i, n.kind, n.res, n.amount, n.max, n.workers, n.sides, n.regrow])
    },
    fog: { state: packRuns(sim2.fog.state), version: sim2.fog.version }
  };
}
var MIGRATIONS = {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  // 18 -> 19: the world is made a chunk at a time and cut down in trees, lakes and beasts: a world made all at once cannot be rebuilt
  18: () => {
    throw new Error("this save is of a world made the old way and can no longer be opened");
  },
  // 17 -> 18: the map grew from 192 to 960 tiles a side and every world starts somewhere else: a world of the old size cannot be rebuilt
  17: () => {
    throw new Error("this save is of the old, smaller map and can no longer be opened");
  },
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
      p.endedAt ??= 0;
      p.supply ??= 0;
      p.carryDays ??= 3;
      p.supplyIds ??= [];
      p.tents ??= [];
      p.stats ??= null;
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
MIGRATIONS[12] = (d) => {
  for (const list of [d.lists.villagers, d.lists.foes]) for (const v of list) {
    v.born ??= { ...v.stats };
    v.train ??= null;
  }
  return { ...d, version: 13 };
};
MIGRATIONS[13] = (d) => {
  d.lists.tameQueue ??= [];
  for (const list of [d.lists.villagers, d.lists.foes]) for (const v of list) {
    v.mount ??= null;
    const sk = v.skill, pot = v.potential, st = v.stats;
    sk.tame ??= { xp: 0, level: 0 };
    pot.tame ??= st.agi >= 9 ? 3 : st.agi >= 6 ? 2 : 1;
  }
  return { ...d, version: 14 };
};
MIGRATIONS[14] = (d) => {
  d.scalars.popBonus ??= 0;
  d.scalars.foodPot ??= 0;
  d.scalars.foodPenalty ??= 0;
  return { ...d, version: 15 };
};
MIGRATIONS[15] = (d) => {
  d.scalars.foodIncome ??= 0;
  d.scalars.foodSeen ??= -1;
  d.lists.foodDays ??= [];
  return { ...d, version: 16 };
};
MIGRATIONS[23] = (d) => {
  d.lists.craftPaid = d.lists.craftQueue.map(() => 1);
  return { ...d, version: 24 };
};
MIGRATIONS[22] = (d) => {
  d.lists.craftQueue = [];
  return { ...d, version: 23 };
};
MIGRATIONS[21] = (d) => {
  for (const list of [d.lists.villagers, d.lists.foes]) for (const v of list) {
    v.guard ??= false;
    v.guardAt ??= null;
  }
  return { ...d, version: 22 };
};
MIGRATIONS[20] = (d) => {
  d.records.drafts ??= {};
  return { ...d, version: 21 };
};
MIGRATIONS[19] = (d) => {
  d.records.ruins ??= {};
  return { ...d, version: 20 };
};
MIGRATIONS[16] = (d) => {
  d.records.yieldNow ??= {};
  d.records.yieldPrev ??= {};
  return { ...d, version: 17 };
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
function applySave(sim2, data) {
  if (data.seed !== sim2.seed) throw new Error(`the save is of world ${data.seed}, this game is world ${sim2.seed}`);
  const w = sim2.world, target = sim2;
  unpackRuns(data.world.tiles, w.tiles);
  unpackRuns(data.world.occ, w.occ);
  unpackRuns(data.world.decor, w.decor);
  unpackRuns(data.world.ready, w.ready);
  w.decor.fill(0);
  w.nodes.clear();
  for (const [i, kind, res, amount, max, workers, sides, regrow] of data.world.nodes) {
    w.nodes.set(i, { kind, res, amount, max, workers, sides, regrow });
  }
  w.season = data.world.season;
  unpackRuns(data.fog.state, sim2.fog.state);
  sim2.fog.relight();
  sim2.fog.version = data.fog.version;
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
  sim2.researched.clear();
  for (const id of data.researched) sim2.researched.add(id);
  sim2.questSeen.clear();
  for (const id of data.quests ?? SCREEN_QUESTS) sim2.questSeen.add(id);
  sim2.tribes.length = 0;
  for (const t of data.tribes) {
    const tribe = decode(t);
    sim2.tribes.push({ ...tribe, def: TRIBES[tribe.id] });
  }
  sim2.rnd.setState(data.rng.rnd);
  sim2.frnd.setState(data.rng.frnd);
  sim2.wrnd.setState(data.rng.wrnd);
  sim2.world.foeGates.clear();
  for (const t of sim2.tribes) for (const p of t.props) if (p.kind === "gate" && p.open === false) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) sim2.world.foeGates.add((p.y + j) * sim2.world.size + p.x + i);
  sim2.world.gates.clear();
  for (const b of sim2.buildings) if (b.kind === "gate" && !b.open) {
    const d = BUILDINGS.gate;
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) sim2.world.gates.add((b.y + j) * sim2.world.size + b.x + i);
  }
  sim2.byId.clear();
  for (const v of sim2.villagers) sim2.byId.set(v.id, v);
  for (const f of sim2.foes) sim2.byId.set(f.id, f);
  sim2.animalById.clear();
  for (const a of sim2.animals) sim2.animalById.set(a.id, a);
  RES_NAME.coin = CURRENCY[sim2.era];
}
MIGRATIONS[24] = (d) => {
  d.lists.warLog ??= [];
  for (const p of d.lists.plans) {
    p.endedAt ??= 0;
    p.supply ??= 0;
    p.carryDays ??= 3;
    p.supplyIds ??= [];
    p.tents ??= [];
    p.stats ??= null;
  }
  return { ...d, version: 25 };
};
MIGRATIONS[25] = (d) => {
  d.lists.scoutLosses ??= [];
  return { ...d, version: 26 };
};
MIGRATIONS[26] = (d) => {
  return { ...d, version: 27 };
  MIGRATIONS[27] = (d2) => {
    d2.scalars.conquered ??= 0;
    return { ...d2, version: 28 };
  };
};

// src/sim/roles.ts
var warLock = (sim2) => sim2.plans.some((p) => p.kind === "attack" && p.status === "running") ? "\u0110ang trong ch\u1EBF \u0111\u1ED9 chi\u1EBFn \u0111\u1EA5u: kh\xF4ng \u0111\u1ED5i vai tr\xF2 hay b\u1ECF l\xEDnh \u0111\u01B0\u1EE3c cho t\u1EDBi khi tr\u1EADn k\u1EBFt th\xFAc" : null;
var roleHouses = (sim2, role) => sim2.buildings.filter((b) => b.kind === ROLES[role].building && b.done);
var NO_HOUSE_TRADES = ["wood", "stone", "food", "hunt"];
var NO_HOUSE_CAP = 1;
var CAMP_ROLES = ["foot", "archer", "cavalry"];
var roleCapacity = (sim2, role) => {
  const houses = roleHouses(sim2, role);
  const camp = CAMP_ROLES.includes(role) ? sim2.campBonus : 0;
  return houses.length ? houses.reduce((n, b) => n + levelDef(b).slots + camp, 0) : sim2.dev.freeBuild ? 99 : NO_HOUSE_TRADES.includes(role) ? NO_HOUSE_CAP : 0;
};
var roleCount = (sim2, role) => sim2.villagers.filter((v) => roleOf(v) === role).length;
function assignRole(sim2, ids2, role) {
  const lock = warLock(sim2);
  if (lock) return lock;
  const def = ROLES[role], name = buildingName(def.building, sim2.era);
  if (!sim2.dev.freeBuild && !roleHouses(sim2, role).length && !NO_HOUSE_TRADES.includes(role)) return `C\u1EA7n d\u1EF1ng ${name}`;
  if (role === "scout") return sim2.enlistScouts(ids2);
  const pick2 = sim2.mine(ids2).filter((v) => roleOf(v) !== role);
  if (!pick2.length) return `Ch\u1ECDn ng\u01B0\u1EDDi ch\u01B0a l\xE0m vi\u1EC7c ${roleName(role, sim2.era).toLowerCase()}`;
  const room = roleCapacity(sim2, role) - roleCount(sim2, role);
  if (room <= 0) return roleHouses(sim2, role).length ? `${name} \u0111\xE3 \u0111\u1EE7 ${roleCapacity(sim2, role)} ng\u01B0\u1EDDi: n\xE2ng c\u1EA5p \u0111\u1EC3 ch\u1EE9a th\xEAm` : `Ch\u01B0a c\xF3 ${name.toLowerCase()}: ch\u1EC9 ${NO_HOUSE_CAP} ng\u01B0\u1EDDi l\xE0m ngh\u1EC1 n\xE0y, h\xE3y d\u1EF1ng nh\xE0 \u0111\u1EC3 th\xEAm ng\u01B0\u1EDDi`;
  const chosen = pick2.slice(0, room);
  for (const v of chosen) if (v.job === "fight" || v.job === "scout" || v.job === "supply") {
    const e = releaseRole(sim2, [v.id]);
    if (e) return e;
  }
  const take2 = chosen.map((v) => v.id);
  const err = sim2.setJob(take2, def.job === "fight" ? "fight" : def.job);
  if (def.arm) {
    for (const v of sim2.mine(take2)) if (v.job === "fight") v.arm = def.arm;
  }
  if (role === "guard") {
    for (const v of sim2.mine(take2)) if (v.job === "fight") postGuard(sim2, v);
  }
  return err ?? (pick2.length > room ? `${name} ch\u1EC9 c\xF2n ch\u1ED7 cho ${room} ng\u01B0\u1EDDi` : null);
}
function postFor(sim2, house) {
  const taken = new Set(sim2.villagers.filter((o) => o.guardAt).map((o) => Math.floor(o.guardAt.y) * sim2.world.size + Math.floor(o.guardAt.x)));
  const spot2 = sim2.nearestFree(house.x + 1, house.y + 4, taken) ?? [house.x + 1, house.y + 4];
  return { x: spot2[0] + 0.5, y: spot2[1] + 0.5 };
}
function postGuard(sim2, v) {
  const house = roleHouses(sim2, "guard")[0] ?? sim2.campfire();
  v.guard = true;
  v.post = -1;
  v.guardAt = house ? postFor(sim2, house) : { x: v.x, y: v.y };
  v.fight.mode = "guard";
  v.fight.anchor = v.guardAt;
}
function releaseRole(sim2, ids2) {
  const lock = warLock(sim2);
  if (lock) return lock;
  const mine2 = sim2.mine(ids2);
  let n = 0, err = null;
  for (const v of mine2) {
    const role = roleOf(v);
    if (!role) continue;
    const e = role === "scout" ? sim2.dismissScouts([v.id]) : ROLES[role].job === "fight" ? sim2.discharge([v.id]) ? null : `${v.name} \u0111ang ng\u1EE7 say, ch\u01B0a cho ngh\u1EC9 \u0111\u01B0\u1EE3c` : sim2.setJob([v.id], "idle");
    if (!e && role === "hunt") {
      sim2.assignGear([v.id], null, "weapon");
      sim2.assignGear([v.id], null, "armor");
      v.manualGear = false;
    }
    if (e) err = e;
    else n++;
  }
  return n ? null : err ?? "Ch\u1ECDn ng\u01B0\u1EDDi c\xF3 vi\u1EC7c \u0111\u1EC3 cho ngh\u1EC9";
}
function trimRoles(sim2) {
  for (const role of Object.keys(ROLES)) {
    const over = roleCount(sim2, role) - roleCapacity(sim2, role);
    if (over <= 0) continue;
    const who = sim2.villagers.filter((v) => roleOf(v) === role).sort((a, b) => b.id - a.id).slice(0, over);
    releaseRole(sim2, who.map((v) => v.id));
  }
}

// src/sim/defense.ts
var isWall = (b) => b.kind === "fence" || b.kind === "gate";
var isDefense = (b) => isWall(b) || b.kind === "tower";
function toggleGate(sim2, id) {
  const b = sim2.getBuilding(id);
  if (!b || b.kind !== "gate") return "\u0110\xE2y kh\xF4ng ph\u1EA3i c\u1ED5ng";
  if (!b.done) return "C\u1ED5ng ch\u01B0a d\u1EF1ng xong";
  b.open = !b.open;
  sim2.setOcc(b, 1);
  sim2.say(b.open ? "C\u1ED5ng \u0111\xE3 m\u1EDF." : "C\u1ED5ng \u0111\xE3 \u0111\xF3ng.");
  return null;
}
function setGates2(sim2, open2) {
  for (const b of sim2.buildings) if (b.kind === "gate" && b.done && b.open !== open2) {
    b.open = open2;
    sim2.setOcc(b, 1);
  }
}
function nearestWork(sim2, x, y, radius, any = false) {
  let best, bd = radius;
  for (const b of sim2.buildings) {
    if (!b.done || !(any ? b.kind !== "campfire" && b.kind !== "trap" : isDefense(b))) continue;
    const d = BUILDINGS[b.kind], dist = Math.hypot(b.x + d.w / 2 - x, b.y + d.h / 2 - y);
    if (dist <= bd) {
      bd = dist;
      best = b;
    }
  }
  return best;
}
function damageWork(sim2, b, dmg) {
  b.hp -= dmg;
  if (b.hp > 0) return;
  sim2.say(`${BUILDINGS[b.kind].name} b\u1ECB ph\xE1!`);
  sim2.noteBattle("breach");
  sim2.destroyBuilding(b);
}
function towerBonus(sim2, v) {
  const b = v.inside === null ? void 0 : sim2.getBuilding(v.inside);
  if (!b || b.kind !== "tower" || armOfWeapon(effWeapon(v)) !== "archer") return { damage: 1, range: 0 };
  return { damage: UNIT_RULES.archerOnTower.damage, range: 0 };
}
function garrison(sim2, b) {
  return sim2.villagers.filter((v) => v.post === b.id && v.job === "fight");
}
function assignTower(sim2, ids2, towerId) {
  const b = sim2.getBuilding(towerId);
  if (!b || b.kind !== "tower" || !b.done) return "Ch\xF2i canh ch\u01B0a d\u1EF1ng xong";
  const lock = sim2.warLock();
  if (lock) return lock;
  let err = null;
  for (const v of sim2.mine(ids2)) {
    if (v.post === b.id && v.job === "fight") continue;
    if (v.job !== "idle" || roleOf(v)) {
      err = "Ch\u1EC9 d\xE2n r\u1EA3nh m\u1EDBi l\xEAn ch\xF2i: ng\u01B0\u1EDDi c\xF3 ngh\u1EC1 ho\u1EB7c l\xE0 l\xEDnh th\xEC cho ngh\u1EC9 tr\u01B0\u1EDBc";
      continue;
    }
    if (garrison(sim2, b).length >= levelDef(b).slots) {
      err = `${BUILDINGS.tower.name} c\u1EA5p ${b.level} ch\u1EC9 ch\u1EE9a ${levelDef(b).slots} l\xEDnh`;
      continue;
    }
    sim2.resetTask(v);
    sim2.clearCombat(v);
    v.job = "fight";
    v.guard = true;
    v.guardAt = null;
    v.arm = "archer";
    v.post = b.id;
    v.shift = "day";
    v.fight.mode = "none";
    v.fight.anchor = null;
    sim2.planStaff(v);
  }
  return err;
}
function leaveTower(sim2, ids2) {
  for (const v of sim2.mine(ids2)) {
    if (v.post < 0 || v.job !== "fight") continue;
    sim2.exitBuilding(v);
    sim2.assignGear([v.id], null, "weapon");
    sim2.assignGear([v.id], null, "armor");
    v.post = -1;
    v.guard = false;
    v.guardAt = null;
    v.job = "idle";
    v.arm = "foot";
    v.manualGear = false;
    v.shift = "day";
    v.phase = "idle";
    v.path = [];
  }
}
function tickResearch(sim2) {
  for (const b of sim2.buildings) {
    if (b.kind !== "fence" && b.kind !== "gate" && b.kind !== "trap" && b.kind !== "tower") continue;
    const bonus = statBonus(sim2.researched, b.kind, "hp");
    if ((b.hpBonus ?? 0) === bonus) continue;
    const share3 = maxHp(b) > 0 ? b.hp / maxHp(b) : 1;
    b.hpBonus = bonus;
    b.hp = share3 * maxHp(b);
  }
}
function tickTraps(sim2, _dt) {
  for (const b of [...sim2.buildings]) {
    if (b.kind !== "trap" || !b.done) continue;
    for (const f of sim2.foes) {
      if (f.health <= 0 || b.staff.includes(f.id) || Math.hypot(f.x - (b.x + 0.5), f.y - (b.y + 0.5)) > 0.8) continue;
      b.staff.push(f.id);
      hurt(sim2, { kind: "unit", id: f.id }, 14 * b.level * (1 + statBonus(sim2.researched, "trap", "atk") / 100), "pierce", { x: b.x, y: b.y }, {});
      sim2.noteBattle("note", "M\u1ED9t h\u1ED1 ch\xF4ng \u0111\xE3 l\xE0m \u0111\u1ECBch b\u1ECB th\u01B0\u01A1ng.");
      if (--b.hp <= 0) {
        b.staff = [];
        sim2.destroyBuilding(b);
        break;
      }
    }
  }
}
function tickTowers(sim2, _dt) {
  for (const b of sim2.buildings) {
    if (b.kind !== "tower" || !b.done) continue;
    const d = BUILDINGS.tower, from = { x: b.x + d.w / 2, y: b.y + 0.4 }, reach = buildingSight(b), hit = 1 + statBonus(sim2.researched, "tower", "atk") / 100;
    for (const v of sim2.villagers) {
      if (v.inside !== b.id || v.phase !== "inside" || v.atkCd > 0 || v.health <= 0) continue;
      const w = weaponOf(v);
      if (!w.ranged) continue;
      const bonus = towerBonus(sim2, v), threat = threatsOf(sim2, v, reach)[0], e = threat && resolve(sim2, threat.t);
      if (e && fireProjectile(sim2, v, e, from, bonus.damage * hit, Math.max(0, reach - w.range - 1))) v.atkCd = swingCycle(sim2, v, w);
    }
  }
}

// src/sim/army.ts
var COLORS = ["#e0523c", "#3c8ce0", "#e0b43c", "#5cb85c", "#a85cd8", "#3cd0c8"];
function squadLimit(sim2) {
  if (sim2.building("wartent") || sim2.dev.freeBuild) return sim2.dev.freeBuild ? COMMAND.squadLimit[COMMAND.squadLimit.length - 1] : unlockedMax(sim2.researched, "squads", SQUADS_DEFAULT);
  return 0;
}
var cellLimit = (sim2) => sim2.dev.freeBuild ? SQUAD_MAX : Math.min(SQUAD_MAX, unlockedMax(sim2.researched, "formationCells", CELLS_DEFAULT));
function cardLimit(sim2) {
  const tent = sim2.building("wartent"), level = tent ? tent.level : sim2.dev.freeBuild ? 3 : 0;
  return level ? COMMAND.cardBase + COMMAND.cardPerLevel * level + (!RESEARCH.enabled || sim2.researched.has("signal") ? 2 : 0) : 0;
}
var squadById = (sim2, id) => sim2.squads.find((s) => s.id === id);
var squadOf = (sim2, v) => v.squad >= 0 ? squadById(sim2, v.squad) : void 0;
function squadUnits(sim2, s) {
  const out = [];
  for (const id of s.ids) {
    const v = sim2.byId.get(id);
    if (v && v.team === "player" && v.job === "fight" && v.health > 0 && v.squad === s.id) out.push(v);
  }
  if (out.length !== s.ids.length) s.ids = out.map((v) => v.id);
  if (!out.some((v) => v.id === s.leader)) s.leader = out.length ? out.slice().sort((a, b) => b.stats.str + b.stats.vit - a.stats.str - a.stats.vit)[0].id : -1;
  return out;
}
function squadCenter(sim2, s) {
  const us = squadUnits(sim2, s);
  return us.length ? { x: us.reduce((a, v) => a + v.x, 0) / us.length, y: us.reduce((a, v) => a + v.y, 0) / us.length } : null;
}
function createSquad(sim2, name, force = false) {
  if (!force && sim2.squads.length >= squadLimit(sim2)) return { reason: squadLimit(sim2) ? `L\u1EC1u h\u1ECDp chi\u1EBFn ch\u1EC9 cho ${squadLimit(sim2)} \u0111\u1ED9i: n\xE2ng c\u1EA5p l\u1EC1u` : "C\u1EA7n d\u1EF1ng L\u1EC1u h\u1ECDp chi\u1EBFn \u0111\u1EC3 l\u1EADp \u0111\u1ED9i" };
  const id = sim2.nextSquad++;
  const s = { id, name: name ?? `\u0110\u1ED9i ${String.fromCharCode(64 + id)}`, color: COLORS[(id - 1) % COLORS.length], ids: [], leader: -1, formation: "line", mastery: Object.fromEntries(FORMATION_IDS.map((f) => [f, COMMAND.mastery.start])), switchUntil: 0, anchor: null, heading: 0, training: false };
  sim2.squads.push(s);
  return { squad: s };
}
function joinSquad(sim2, ids2, squadId) {
  const lock = sim2.warLock();
  if (lock) return lock;
  const s = squadById(sim2, squadId);
  if (!s) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  let err = null;
  for (const v of sim2.mine(ids2)) {
    if (v.job !== "fight") {
      err = "Ch\u1EC9 chi\u1EBFn binh m\u1EDBi v\xE0o \u0111\u1ED9i: tuy\u1EC3n \u1EDF tr\u1EA1i l\xEDnh";
      continue;
    }
    if (v.guard) {
      err = "L\xEDnh g\xE1c gi\u1EEF ch\u1ED7 g\xE1c c\u1EE7a m\xECnh, kh\xF4ng v\xE0o \u0111\u1ED9i t\xE1c chi\u1EBFn";
      continue;
    }
    if (v.squad === s.id) continue;
    if (s.ids.length >= cellLimit(sim2)) {
      err = `M\u1ED9t \u0111\u1ED9i ch\u1EC9 c\xF3 t\u1ED1i \u0111a ${cellLimit(sim2)} ng\u01B0\u1EDDi: nghi\xEAn c\u1EE9u m\u1EDF r\u1ED9ng \xF4 tr\u1EADn ph\xE1p`;
      continue;
    }
    leaveSquad(sim2, [v.id]);
    v.squad = s.id;
    s.ids.push(v.id);
  }
  return err;
}
function leaveSquad(sim2, ids2) {
  if (sim2.warLock()) return;
  for (const v of sim2.mine(ids2)) {
    const s = squadOf(sim2, v);
    if (s) {
      s.ids = s.ids.filter((i) => i !== v.id);
      if (s.leader === v.id) s.leader = -1;
    }
    v.squad = -1;
    v.speed = 1.6 + 0.1 * v.stats.agi;
  }
}
function disbandSquad(sim2, id) {
  if (sim2.warLock()) return;
  const s = squadById(sim2, id);
  if (!s) return;
  leaveSquad(sim2, [...s.ids]);
  sim2.squads.splice(sim2.squads.indexOf(s), 1);
  for (const p of sim2.plans) {
    p.missions = p.missions.filter((m) => m.squad !== id);
    p.cards = p.cards.filter((c) => c.squad !== id);
  }
}
function setCommander(sim2, squadId, vid) {
  if (sim2.warLock()) return;
  const s = squadById(sim2, squadId);
  if (s && s.ids.includes(vid)) s.leader = vid;
}
var formationOpen = (sim2, f) => !RESEARCH.enabled || sim2.dev.freeBuild || sim2.researched.has(FORMATIONS[f].tech);
function applySpeed(sim2, s) {
  for (const v of squadUnits(sim2, s)) v.speed = (1.6 + 0.1 * v.stats.agi) * FORMATIONS[s.formation].speed;
}
function setFormation(sim2, squadId, f) {
  const s = squadById(sim2, squadId);
  if (!s) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (!FORMATIONS[f]) return "Kh\xF4ng c\xF3 tr\u1EADn n\xE0y";
  if (!formationOpen(sim2, f)) return `C\u1EA7n nghi\xEAn c\u1EE9u: ${f === "line" || f === "circle" ? "Tr\u1EADn ph\xE1p c\u01A1 b\u1EA3n" : FORMATIONS[f].name}`;
  if (s.formation === f) return null;
  s.formation = f;
  s.switchUntil = sim2.time + COMMAND.mastery.switchSeconds;
  applySpeed(sim2, s);
  if (s.anchor) squadMove(sim2, s, s.anchor.x, s.anchor.y, "hold");
  return null;
}
function squadMove(sim2, s, x, y, mode, heading) {
  const us = squadUnits(sim2, s);
  if (!us.length) return;
  const c = squadCenter(sim2, s);
  s.heading = heading ?? (Math.hypot(x - c.x, y - c.y) > 1 ? Math.atan2(y - c.y, x - c.x) : s.heading);
  s.anchor = { x, y };
  us.sort((a, b) => (armOf(a) === "archer" ? 1 : 0) - (armOf(b) === "archer" ? 1 : 0) || a.id - b.id);
  const offs = formationOffsets(s.formation, us.length), taken = /* @__PURE__ */ new Set();
  applySpeed(sim2, s);
  us.forEach((v, i) => {
    if (sim2.warIds.has(v.id)) v.nightOwl = true;
    const [px, py] = placeOffset(offs[i], s.heading, x, y);
    const spot2 = sim2.nearestFree(Math.floor(px), Math.floor(py), taken) ?? [Math.floor(px), Math.floor(py)];
    taken.add(spot2[1] * sim2.world.size + spot2[0]);
    if (mode === "move") {
      sim2.pathLeft++;
      sim2.orderMove([v.id], spot2[0], spot2[1]);
      v.fight.obey = v.path.length > 0;
    } else if (mode === "attack") sim2.orderAttackMove([v.id], spot2[0] + 0.5, spot2[1] + 0.5);
    else {
      sim2.orderAttackMove([v.id], spot2[0] + 0.5, spot2[1] + 0.5);
      v.fight.anchor = { x: spot2[0] + 0.5, y: spot2[1] + 0.5 };
    }
  });
}
function trainSquad(sim2, squadId, on) {
  const s = squadById(sim2, squadId);
  if (!s) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (!on) {
    s.training = false;
    return null;
  }
  const field = sim2.building("drill");
  if (!field) return "C\u1EA7n d\u1EF1ng B\xE3i t\u1EADp";
  s.training = true;
  squadMove(sim2, s, field.x + 1.5, field.y + 1.5, "hold");
  return null;
}
function tickTraining(sim2, dt) {
  const field = sim2.building("drill");
  for (const s of sim2.squads) {
    const us = squadUnits(sim2, s);
    const near2 = field && us.length ? us.filter((v) => Math.hypot(v.x - (field.x + 1.5), v.y - (field.y + 1.5)) < 7).length >= Math.ceil(us.length / 2) : false;
    for (const f of FORMATION_IDS) {
      if (f === s.formation && s.training && near2) s.mastery[f] = Math.min(100, s.mastery[f] + COMMAND.mastery.perSecond * dt);
      else s.mastery[f] = Math.max(0, s.mastery[f] - COMMAND.mastery.decayPerDay * dt / sim2.dayLen);
    }
    if (s.training && !field) s.training = false;
  }
}
function attackFactor(sim2, v, e) {
  if (v.team !== "player") return 1;
  let f = 1;
  const s = squadOf(sim2, v);
  if (s) {
    const fm = FORMATIONS[s.formation];
    f *= fm.dmg * masteryFactor(s.mastery[s.formation]);
    if (fm.charge && v.path.length > 0) f *= fm.charge;
    if (fm.flank && e.kind === "unit" && (e.v.facing === "right" && v.x < e.v.x || e.v.facing === "left" && v.x > e.v.x)) f *= fm.flank;
    if (fm.firstBlow && e.kind === "unit" && !e.v.fight.target && e.v.phase !== "fight") f *= fm.firstBlow;
  }
  if (e.kind === "unit" && e.v.team !== "player") f *= COMMAND.info[Math.min(3, sim2.mapLevel(e.v.team))];
  return f;
}
function takenFactor(sim2, victim, ranged) {
  const s = squadOf(sim2, victim);
  if (!s) return 1;
  const fm = FORMATIONS[s.formation];
  return fm.taken * (ranged ? fm.takenRanged ?? 1 : 1) * (s.switchUntil > sim2.time ? COMMAND.mastery.switchTaken : 1);
}
function clusters(sim2) {
  const units = [...sim2.villagers.filter((v) => v.job === "fight" && v.health > 0 && v.inside === null), ...sim2.foes.filter((f) => f.health > 0 && f.ai && f.ai.role !== "civ")];
  const key = (v) => v.team === "player" ? `p:${v.squad}` : `f:${v.team}`;
  const out = [];
  const by = new Map(units.map((v) => [v.id, v]));
  for (const c of clusterize(units.map((v) => ({ id: v.id, arm: armOf(v), key: key(v) })))) {
    const vs = c.ids.map((id) => by.get(id));
    const sq = c.key.startsWith("p:") ? Number(c.key.slice(2)) : -1, squad = sq >= 0 ? squadById(sim2, sq) : void 0;
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
function drawnFigures(sim2) {
  const cs = clusters(sim2), ours = cs.filter((c) => c.side === "player").reduce((n, c) => n + c.n, 0), theirs = cs.filter((c) => c.side !== "player").reduce((n, c) => n + c.n, 0);
  if (Math.max(ours, theirs) <= COMMAND.bigBattle) return null;
  const shown = /* @__PURE__ */ new Set();
  for (const c of cs) for (const id of c.ids.slice(0, iconCount(c.n))) shown.add(id);
  return shown;
}
function noteBattle(sim2, kind, text = "") {
  const b = sim2.battle;
  if (!b.on) return;
  if (kind === "ours") b.ourDead++;
  else if (kind === "foes") b.foeDead++;
  else if (kind === "breach") b.breaches++;
  else if (kind === "shot") b.shots++;
  else if (text && b.notes.length < 12) b.notes.push(text);
}
function tickBattle(sim2, dt) {
  const b = sim2.battle, hostile = sim2.foes.some((f) => f.ai?.role === "raider" && f.health > 0);
  if (hostile && !b.on) {
    Object.assign(b, { on: true, since: sim2.time, quiet: 0, ourDead: 0, foeDead: 0, breaches: 0, shots: 0, notes: [] });
    return;
  }
  if (!b.on) return;
  b.quiet = hostile ? 0 : b.quiet + dt;
  if (b.quiet < 10) return;
  b.on = false;
  sim2.alarmUntil = 0;
  const lines = [`Tr\u1EADn k\xE9o d\xE0i ${Math.max(1, Math.round((sim2.time - b.since) / 60))} ph\xFAt: ta m\u1EA5t ${b.ourDead}, \u0111\u1ECBch m\u1EA5t ${b.foeDead}.`];
  if (b.breaches) lines.push(`${b.breaches} \u0111o\u1EA1n h\xE0ng r\xE0o ho\u1EB7c c\u1ED5ng b\u1ECB ph\xE1.`);
  if (b.shots) lines.push(`Cung th\u1EE7 tr\xEAn ch\xF2i b\u1EAFn ${b.shots} ph\xE1t.`);
  lines.push(...b.notes);
  sim2.battleReports.push({ at: sim2.time, lines });
  if (sim2.battleReports.length > 8) sim2.battleReports.shift();
  for (const l of lines) sim2.say(l);
}

// src/sim/wartent.ts
function tentCost(sim2) {
  const k = WAR_DATA.tent, level = sim2.campfire()?.level ?? 1, f = 1 + k.perLevel * (level - 1);
  return { wood: Math.round(k.woodBase * f), hide: Math.round(k.hideBase * f) };
}
var tentSquads = (sim2, plan2) => plan2.missions.map((m) => sim2.squadById(m.squad)).filter((s) => !!s && sim2.squadUnits(s).length > 0);
var SUPPLY_TENT = -1;
var tentCount = (sim2, plan2) => tentSquads(sim2, plan2).length + (plan2.supply > 0 || plan2.supplyIds.length ? 1 : 0);
var supplyCrew = (sim2, plan2) => plan2.supplyIds.map((id) => sim2.get(id)).filter((v) => !!v && v.health > 0);
var packs = (sim2, plan2) => plan2.supplyIds.map((id) => sim2.get(id)).filter((v) => !!v && v.health > 0 && !!v.pack);
var have = (crew2, res) => crew2.reduce((n, v) => n + (v.pack?.[res] ?? 0), 0);
function take(crew2, res, n) {
  for (const v of crew2) {
    if (n <= 0) break;
    const k = Math.min(v.pack?.[res] ?? 0, n);
    if (k > 0) {
      v.pack[res] -= k;
      n -= k;
    }
  }
}
function give(crew2, res, n, load) {
  const room = (v) => load / WAR_DATA.tent.weight - (v.pack ? v.pack.wood + v.pack.hide : 0);
  for (const v of crew2) {
    if (n <= 0) break;
    const k = Math.min(Math.max(0, room(v)), n);
    if (k > 0) {
      v.pack[res] += k;
      n -= k;
    }
  }
}
function stands(sim2, s) {
  const us = sim2.squadUnits(s);
  return us.length > 0 && !us.some((v) => v.phase === "fight" || v.swing) && us.filter((v) => !v.path.length).length >= us.length * 0.8;
}
var tentOf = (plan2, squadId) => plan2.tents.find((t) => t.squad === squadId && t.built);
var restsNow = (sim2, plan2, squadId) => !!plan2.missions.find((m) => m.squad === squadId)?.resting;
function sleepsInTent(sim2, v) {
  const plan2 = sim2.plans.find((p) => p.kind === "attack" && p.status === "running");
  if (!plan2) return false;
  const supply = v.job === "supply";
  if (supply ? !plan2.missions.some((m) => m.resting) : !restsNow(sim2, plan2, v.squad)) return false;
  const t = tentOf(plan2, supply ? SUPPLY_TENT : v.squad);
  return !!t && Math.hypot(t.x - v.x, t.y - v.y) < WAR_DATA.tent.near;
}
function shelter(sim2, v) {
  const plan2 = sim2.plans.find((p) => p.kind === "attack" && p.status === "running");
  const tent = plan2?.tents.filter((t) => t.built && t.squad === (v.job === "supply" ? SUPPLY_TENT : v.squad)).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
  if (v.phase === "sleep" && tent && Math.hypot(tent.x - v.x, tent.y - v.y) < WAR_DATA.tent.near) {
    v.inTent = true;
    v.path = [];
    v.slide = null;
    v.x = tent.x;
    v.y = tent.y;
    return;
  }
  if (v.inTent) {
    v.inTent = false;
    if (tent) {
      v.x = tent.x + 1;
      v.y = tent.y + 1;
    }
  }
}
var CALM = 30;
function calm(sim2, plan2) {
  for (const m of plan2.missions) {
    const s = m.resting ? sim2.squadById(m.squad) : void 0;
    if (!s) continue;
    const us = sim2.squadUnits(s), c = sim2.squadCenter(s);
    if (!c) continue;
    if (sim2.foes.some((f) => f.health > 0 && f.team !== "wild" && Math.hypot(f.x - c.x, f.y - c.y) < 16)) {
      m.alertAt = sim2.time;
      continue;
    }
    if (m.alertAt !== void 0 && sim2.time - m.alertAt >= CALM) {
      for (const v of us) if (v.nightOwl) {
        const tent = tentOf(plan2, m.squad);
        v.fight.target = null;
        v.fight.mode = "hold";
        v.fight.anchor = { x: v.x, y: v.y };
        if (tent && Math.hypot(tent.x - v.x, tent.y - v.y) > 4) sim2.orderMove([v.id], Math.floor(tent.x), Math.floor(tent.y));
        v.nightOwl = false;
      }
    }
  }
}
function tickTents(sim2, plan2) {
  const crew2 = packs(sim2, plan2), cost = tentCost(sim2), k = WAR_DATA.tent;
  const anyRest = plan2.missions.some((m) => m.resting);
  const owners = tentSquads(sim2, plan2).map((s) => ({ id: s.id, name: s.name, at: sim2.squadCenter(s), still: stands(sim2, s), rest: restsNow(sim2, plan2, s.id) }));
  const sup = supplyCrew(sim2, plan2);
  if (sup.length) owners.push({ id: SUPPLY_TENT, name: "h\u1EADu c\u1EA7n", at: { x: sup.reduce((a, v) => a + v.x, 0) / sup.length, y: sup.reduce((a, v) => a + v.y, 0) / sup.length }, still: !sup.some((v) => v.phase === "fight" || v.swing) && (sup.filter((v) => !v.path.length).length >= sup.length * 0.8 || anyRest && owners.every((x) => x.still)), rest: anyRest });
  const housed = owners.filter((x) => x.id !== SUPPLY_TENT && x.rest).every((x) => plan2.tents.some((t) => t.squad === x.id && t.built));
  calm(sim2, plan2);
  for (const o of owners) {
    const c = o.at;
    if (!c) continue;
    const tent = plan2.tents.find((t) => t.squad === o.id), name = o.id === SUPPLY_TENT ? "\u0111\u1ED9i h\u1EADu c\u1EA7n" : o.name;
    if (o.id === SUPPLY_TENT && !tent && !housed) continue;
    if (o.id === SUPPLY_TENT && tent && !tent.built && !housed) continue;
    if (!tent) {
      if (!o.rest || !o.still || !crew2.length || have(crew2, "wood") < cost.wood || have(crew2, "hide") < cost.hide) continue;
      take(crew2, "wood", cost.wood);
      take(crew2, "hide", cost.hide);
      plan2.tents.push({ squad: o.id, x: c.x, y: c.y, progress: 0, built: false });
      sim2.say(`H\u1EADu c\u1EA7n d\u1EF1ng l\u1EC1u cho ${name}.`);
      continue;
    }
    if (!tent.built) {
      if (!o.rest) {
        plan2.tents.splice(plan2.tents.indexOf(tent), 1);
        continue;
      }
      const builders = crew2.filter((v) => Math.hypot(v.x - tent.x, v.y - tent.y) < k.buildReach).length;
      tent.progress += sim2.dev.freeWorks ? 1 : builders * (1 + statBonus(sim2.researched, "march_army", "mbuild") / 100) / k.buildSeconds;
      if (tent.progress >= 1) {
        tent.built = true;
        sim2.say(`L\u1EC1u c\u1EE7a ${name} \u0111\xE3 d\u1EF1ng xong: c\xF3 ch\u1ED7 ng\u1EE7.`);
      }
      continue;
    }
    if (!o.rest) {
      plan2.tents.splice(plan2.tents.indexOf(tent), 1);
      if (Math.hypot(c.x - tent.x, c.y - tent.y) < k.near && crew2.length) {
        give(crew2, "wood", cost.wood * k.refund, supplyLoad(sim2));
        give(crew2, "hide", cost.hide * k.refund, supplyLoad(sim2));
        sim2.say(`H\u1EADu c\u1EA7n th\xE1o l\u1EC1u c\u1EE7a ${name}, thu l\u1EA1i ${Math.floor(cost.wood * k.refund)} g\u1ED7, ${Math.floor(cost.hide * k.refund)} da.`);
      } else sim2.say(`L\u1EC1u c\u1EE7a ${name} b\u1ECB b\u1ECF l\u1EA1i.`);
    }
  }
  plan2.tents = plan2.tents.filter((t) => t.squad === SUPPLY_TENT ? sup.length > 0 : sim2.squadById(t.squad));
}

// src/sim/warlog.ts
var arms = () => ({ foot: 0, archer: 0, cavalry: 0 });
var live = (sim2) => sim2.plans.find((p) => p.kind === "attack" && p.status === "running" && p.stats);
function begin(sim2, plan2) {
  const sent = arms();
  for (const m of plan2.missions) {
    const s = sim2.squadById(m.squad);
    if (s) for (const v of sim2.squadUnits(s)) sent[armOf(v)]++;
  }
  const loaded = { food: 0, wood: 0, hide: 0 };
  for (const id of plan2.supplyIds) {
    const p = sim2.get(id)?.pack;
    if (p) {
      loaded.food += p.food;
      loaded.wood += p.wood;
      loaded.hide += p.hide;
    }
  }
  plan2.stats = { startDay: sim2.day, fought: false, sent, dead: arms(), supplySent: plan2.supplyIds.length, supplyDead: 0, loaded, returned: { food: 0, wood: 0, hide: 0 }, loot: {} };
}
function noteDeath(sim2, id, supply, arm) {
  const plan2 = live(sim2);
  if (!plan2?.stats || !sim2.warIds.has(id)) return;
  if (supply) plan2.stats.supplyDead++;
  else plan2.stats.dead[arm]++;
}
function noteLoot(sim2, tribe, res, n) {
  const plan2 = sim2.plans.find((p) => p.kind === "attack" && p.status === "running" && p.stats && p.tribe === tribe);
  if (plan2?.stats) plan2.stats.loot[res] = (plan2.stats.loot[res] ?? 0) + n;
}
function noteReturned(plan2, food, wood, hide) {
  if (plan2.stats) {
    plan2.stats.returned.food += food;
    plan2.stats.returned.wood += wood;
    plan2.stats.returned.hide += hide;
  }
}
function finish(sim2, meals) {
  for (const plan2 of sim2.plans) {
    const st = plan2.stats;
    if (!st || plan2.kind !== "attack") continue;
    const t = sim2.tribes.find((x) => x.id === plan2.tribe);
    const rec = {
      id: sim2.warLog.length + 1,
      tribe: plan2.tribe ?? "",
      name: t?.def.name ?? "\u0111\u1ECBch",
      mapLevel: t ? sim2.mapLevel(t.id) : 0,
      startDay: st.startDay,
      endDay: sim2.day,
      days: Math.max(0, sim2.time - (sim2.warSince >= 0 ? sim2.warSince : plan2.startedAt)) / 1200,
      result: plan2.result || (st.fought ? "lost" : "off"),
      squads: plan2.missions.length,
      sent: st.sent,
      dead: st.dead,
      supplySent: st.supplySent,
      supplyDead: st.supplyDead,
      spent: { food: Math.max(0, Math.round(st.loaded.food - st.returned.food + meals)), wood: Math.max(0, Math.round(st.loaded.wood - st.returned.wood)), hide: Math.max(0, Math.round(st.loaded.hide - st.returned.hide)) },
      loot: st.loot
    };
    sim2.warLog.push(rec);
    plan2.stats = null;
  }
}

// src/sim/warsupply.ts
var supplyOf = (sim2, plan2) => plan2.supplyIds.map((id) => sim2.get(id)).filter((v) => !!v && v.health > 0);
var supplyAvailable = (sim2) => sim2.villagers.filter((v) => v.job === "supply" && v.health > 0 && v.down <= 0 && v.team === "player");
function dailyNeed(sim2, plan2, sup) {
  const squads = plan2.missions.filter((m2) => {
    const s = sim2.squadById(m2.squad);
    return s && sim2.squadUnits(s).length;
  }).length + (sup ? 1 : 0);
  const soldiers = soldiersOf(sim2, plan2) + sup, m = marchOf(sim2, squads, soldiers);
  return soldiers * rationAt(sim2.campfire()?.level ?? 1, true) * m.food;
}
var stocked = (sim2) => sim2.foodPot + sim2.stock.food;
function packPlan(sim2, plan2) {
  const sup = supplyCount(sim2, plan2), need = dailyNeed(sim2, plan2, sup), capacity2 = sup * supplyLoad(sim2), want = need * plan2.carryDays;
  const cost = tentCost(sim2), n = tentCount(sim2, plan2), wood = Math.min(n * cost.wood, Math.floor(sim2.stock.wood)), hide = Math.min(n * cost.hide, Math.floor(sim2.stock.hide));
  const room = Math.max(0, capacity2 - (wood + hide) * WAR_DATA.tent.weight);
  const give2 = Math.max(0, Math.min(want, room, stocked(sim2)));
  return { sup, capacity: capacity2, want, give: give2, days: need > 0 ? give2 / need : 0, need, wood: sup ? wood : 0, hide: sup ? hide : 0 };
}
function supplyAdvice(sim2, plan2) {
  let longest = 0;
  for (const m of plan2.missions) {
    const s = sim2.squadById(m.squad), start = s ? sim2.missionStart(m) : null;
    if (s && start && m.path.length) longest = Math.max(longest, sim2.routeTime(s, start, m.path).total);
  }
  if (longest <= 0) return null;
  let sup = Math.max(1, plan2.supply), out = { oneWay: 0, days: 0, food: 0, wood: 0, hide: 0, soldiers: 1, have: supplyAvailable(sim2).length };
  const cost = tentCost(sim2), n = tentCount(sim2, plan2);
  for (let i = 0; i < 4; i++) {
    const m = marchOf(sim2, plan2.missions.length + 1, soldiersOf(sim2, plan2) + sup), oneWay = longest / m.speed / sim2.dayLen, d = Math.min(WAR_DATA.supply.maxDays, Math.max(1, Math.ceil(oneWay * 2 + 1)));
    const food = Math.ceil(dailyNeed(sim2, plan2, sup) * d), wood = n * cost.wood, hide = n * cost.hide;
    const soldiers = Math.max(1, Math.ceil((food + (wood + hide) * WAR_DATA.tent.weight) / supplyLoad(sim2)));
    out = { ...out, oneWay, days: d, food, wood, hide, soldiers };
    if (soldiers === sup) break;
    sup = soldiers;
  }
  return out;
}
function loadPacks(sim2, plan2) {
  if (sim2.era !== "ancient") {
    plan2.supplyIds = [];
    sim2.warHunger = 0;
    return;
  }
  const p = packPlan(sim2, plan2), crew2 = supplyAvailable(sim2).sort((a, b) => b.energy - a.energy).slice(0, p.sup);
  plan2.supplyIds = crew2.map((v) => v.id);
  sim2.warHunger = 0;
  if (!crew2.length) return;
  let left = p.give;
  const fromPot = Math.min(sim2.foodPot, left);
  sim2.foodPot -= fromPot;
  left -= fromPot;
  sim2.stock.food = Math.max(0, sim2.stock.food - left);
  sim2.stock.wood = Math.max(0, sim2.stock.wood - p.wood);
  sim2.stock.hide = Math.max(0, sim2.stock.hide - p.hide);
  const each = p.give / crew2.length;
  for (const v of crew2) {
    sim2.exitBuilding(v);
    sim2.resetTask(v);
    sim2.clearCombat(v);
    v.out = true;
    v.recall = false;
    v.pack = { food: each, wood: p.wood / crew2.length, hide: p.hide / crew2.length };
    v.fight.mode = "guard";
    v.fight.anchor = { x: v.x, y: v.y };
  }
  sim2.say(`${crew2.length} l\xEDnh h\u1EADu c\u1EA7n theo qu\xE2n, mang ${Math.floor(p.give)} th\u1EE9c \u0103n (kho\u1EA3ng ${p.days.toFixed(1)} ng\xE0y), ${p.wood} g\u1ED7 v\xE0 ${p.hide} da cho l\u1EC1u.`);
}
function eatPacks(sim2, plan2, need) {
  if (need <= 0) return;
  let left = need;
  for (const v of supplyOf(sim2, plan2)) {
    if (!v.pack || v.pack.food <= 0) continue;
    const k = Math.min(v.pack.food, left);
    v.pack.food -= k;
    left -= k;
    if (left <= 0) break;
  }
  const unmet = left / need;
  sim2.warHunger += (unmet - sim2.warHunger) / WAR_DATA.supply.hungerSmooth;
  sim2.foodPenalty = FOOD.maxPenalty * sim2.warHunger;
}
var packFood = (sim2, plan2) => supplyOf(sim2, plan2).reduce((n, v) => n + (v.pack?.food ?? 0), 0);
function follow(sim2, plan2) {
  const crew2 = supplyOf(sim2, plan2);
  if (!crew2.length) return;
  const us = plan2.missions.flatMap((m) => {
    const s = sim2.squadById(m.squad);
    return s ? sim2.squadUnits(s) : [];
  });
  if (!us.length) return;
  const squads = plan2.missions.map((m) => sim2.squadById(m.squad)).filter((s) => !!s && sim2.squadUnits(s).length > 0);
  if (squads.length && squads.every((s) => stands(sim2, s)) && plan2.missions.some((m) => m.resting)) {
    const open2 = plan2.tents.filter((t2) => !t2.built);
    for (const v of crew2) {
      if (v.inTent || v.phase === "sleep" || v.phase === "fight") continue;
      v.hurry = false;
      const t2 = open2.sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
      const end = v.path[v.path.length - 1], toIt = !!end && !!t2 && Math.hypot(end[0] + 0.5 - t2.x, end[1] + 0.5 - t2.y) < 4;
      if (t2 && Math.hypot(t2.x - v.x, t2.y - v.y) > 3 && !toIt && sim2.pathLeft > 0) {
        sim2.pathLeft--;
        v.path = sim2.pathTo(v, Math.floor(t2.x), Math.floor(t2.y), 3e3);
        v.phase = v.path.length ? "move" : "idle";
      } else if (!t2 && v.path.length) {
        v.path = [];
        v.slide = null;
        v.phase = "idle";
      }
    }
    return;
  }
  const cx = us.reduce((a, v) => a + v.x, 0) / us.length, cy = us.reduce((a, v) => a + v.y, 0) / us.length;
  const dx = plan2.rally.x - cx, dy = plan2.rally.y - cy, len = Math.max(1, Math.hypot(dx, dy)), t = WAR_DATA.supply.trail;
  const bx = cx + dx / len * t, by = cy + dy / len * t, taken = /* @__PURE__ */ new Set();
  for (const v of crew2) {
    if (v.phase === "fight" || v.phase === "sleep" || v.inTent || v.down > 0) continue;
    const spot2 = sim2.nearestFree(Math.floor(bx), Math.floor(by), taken);
    if (!spot2) continue;
    taken.add(spot2[1] * sim2.world.size + spot2[0]);
    const away = Math.hypot(spot2[0] + 0.5 - v.x, spot2[1] + 0.5 - v.y);
    v.hurry = away > 6;
    const end = v.path[v.path.length - 1];
    if (away < 4 || end && Math.hypot(end[0] - spot2[0], end[1] - spot2[1]) < 3 || sim2.pathLeft <= 0) continue;
    sim2.pathLeft--;
    v.path = sim2.pathTo(v, spot2[0], spot2[1], 3e3);
    v.phase = v.path.length ? "move" : "idle";
  }
}
function settle2(sim2) {
  for (const plan2 of sim2.plans) {
    if (!plan2.supplyIds.length) continue;
    const left = packFood(sim2, plan2), crew2 = supplyOf(sim2, plan2);
    if (left >= 1) {
      const put = sim2.deposit("food", Math.floor(left));
      sim2.say(`H\u1EADu c\u1EA7n mang v\u1EC1 ${put} th\u1EE9c \u0103n c\xF2n l\u1EA1i.`);
    }
    const back = { wood: 0, hide: 0 };
    for (const res of ["wood", "hide"]) {
      const n = Math.floor(crew2.reduce((a, v) => a + (v.pack?.[res] ?? 0), 0));
      if (n > 0) back[res] = sim2.deposit(res, n);
    }
    noteReturned(plan2, left >= 1 ? Math.floor(left) : 0, back.wood, back.hide);
    plan2.tents = [];
    for (const id of plan2.supplyIds) {
      const v = sim2.get(id);
      if (v) {
        v.pack = void 0;
        v.hurry = false;
        v.inTent = false;
        v.out = false;
        v.recall = true;
      }
    }
    plan2.supplyIds = [];
  }
  sim2.warHunger = 0;
  sim2.foodPenalty = 0;
}

// src/sim/warplan.ts
var NEED_LEVEL = { camp: 1, gate: 2, ambush: 2, stores: 3, leader: 3 };
function canTarget(sim2, objective, tribe) {
  return sim2.dev.freeBuild || !!tribe && sim2.mapLevel(tribe) >= NEED_LEVEL[objective];
}
function newPlan(sim2, kind, tribe) {
  const old = sim2.plans.findIndex((p) => p.kind === kind && p.status !== "running");
  if (old >= 0) sim2.plans.splice(old, 1);
  const fire2 = sim2.campfire();
  const plan2 = { id: sim2.nextPlan++, kind, tribe, missions: [], cards: [], status: "draft", stage: "assemble", startedAt: 0, signal: false, nextCard: 1, clears: [], result: "", endedAt: 0, supply: 0, carryDays: WAR_DATA.supply.defaultDays, supplyIds: [], stats: null, tents: [], rally: { x: (fire2?.x ?? sim2.world.start.x) + 1.5, y: (fire2?.y ?? sim2.world.start.y) + 6 } };
  sim2.plans.push(plan2);
  return plan2;
}
function addMission(sim2, plan2, squadId, withdrawAt = 0.5) {
  if (!sim2.squadById(squadId)) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (plan2.missions.some((m) => m.squad === squadId)) return "\u0110\u1ED9i n\xE0y \u0111\xE3 c\xF3 nhi\u1EC7m v\u1EE5";
  plan2.missions.push({ squad: squadId, objective: "camp", route: "main", trigger: { kind: "time", at: 0 }, stance: "fight", withdrawAt, state: "idle", initial: 0, post: "gate", deploy: null, path: [], retreat: [], leg: 0, target: null, block: null });
  return null;
}
function removeMission(plan2, squadId) {
  plan2.missions = plan2.missions.filter((m) => m.squad !== squadId);
  plan2.cards = plan2.cards.filter((c) => c.squad !== squadId);
}
function drawable(sim2, plan2, squadId) {
  if (plan2.status === "running") return "K\u1EBF ho\u1EA1ch \u0111ang ch\u1EA1y: kh\xF4ng v\u1EBD l\u1EA1i \u0111\u01B0\u1EE3c";
  const s = sim2.squadById(squadId);
  if (!s) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (!plan2.missions.some((m) => m.squad === squadId)) addMission(sim2, plan2, squadId, 0);
  return plan2.missions.find((m) => m.squad === squadId);
}
function deploySquad(sim2, plan2, squadId, kind, cells, heading, o, p) {
  const s = sim2.squadById(squadId);
  if (!s) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (plan2.status === "running") return "K\u1EBF ho\u1EA1ch \u0111ang ch\u1EA1y: kh\xF4ng v\u1EBD l\u1EA1i \u0111\u01B0\u1EE3c";
  if (cells.length < SQUAD_MIN || cells.length > sim2.cellLimit()) return `\u0110\u1ED9i h\xECnh c\xF3 t\u1EEB ${SQUAD_MIN} \u0111\u1EBFn ${sim2.cellLimit()} \xF4`;
  if (kind && !sim2.formationOpen(kind)) return `C\u1EA7n nghi\xEAn c\u1EE9u: ${FORMATIONS[kind].name}`;
  if (kind && kind !== s.formation) {
    const e = sim2.setFormation(s.id, kind);
    if (e) return e;
  }
  const m = drawable(sim2, plan2, squadId);
  if (typeof m === "string") return m;
  const N = sim2.world.size, keep = (v) => Math.max(1, Math.min(N - 2, v));
  m.deploy = { cells: cells.map((c) => ({ x: keep(c.x), y: keep(c.y) })), heading, o: { x: o.x, y: o.y }, p: { x: p.x, y: p.y }, kind: s.formation };
  return null;
}
function setMissionPath(sim2, plan2, squadId, pts, retreat = false) {
  const m = drawable(sim2, plan2, squadId);
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
function setMissionTarget(sim2, plan2, squadId, target) {
  const m = drawable(sim2, plan2, squadId);
  if (typeof m === "string") return m;
  const t = sim2.tribes.find((x) => x.id === plan2.tribe);
  if (!t) return "Ch\u01B0a ch\u1ECDn l\xE0ng \u0111\u1EC3 \u0111\xE1nh";
  if (!m.deploy) return "\u0110\u1EB7t \u0111\u1ED9i h\xECnh c\u1EE7a \u0111\u1ED9i l\xEAn b\u1EA3n \u0111\u1ED3 tr\u01B0\u1EDBc";
  if (target.kind === "prop" && !t.props.some((p) => p.x === target.x && p.y === target.y)) return "C\xF4ng tr\xECnh n\xE0y kh\xF4ng c\xF2n";
  m.target = { ...target, at: { ...target.at } };
  m.path = [{ ...target.at }];
  m.block = null;
  m.objective = target.kind === "person" ? target.leader ? "leader" : "camp" : target.label === "Kho l\u01B0\u01A1ng" ? "stores" : "camp";
  return null;
}
function squadPace(sim2, s) {
  const us = sim2.squadUnits(s), base = us.length ? Math.min(...us.map((v) => (1.6 + 0.1 * v.stats.agi) * sim2.mountSpeed(v))) : 2.1;
  return base * FORMATIONS[s.formation].speed * WEATHER[sim2.weather].speed;
}
function routeTime(sim2, s, from, pts, target) {
  const pace = squadPace(sim2, s) || 1, legs = [], blocked = [];
  let at = from, length = 0;
  for (const p of pts) {
    const d = Math.hypot(p.x - at.x, p.y - at.y), steps = Math.max(1, Math.ceil(d * 2));
    let bad = 0;
    for (let i = 0; i <= steps; i++) if (sim2.world.isBlocked(Math.floor(at.x + (p.x - at.x) * i / steps), Math.floor(at.y + (p.y - at.y) * i / steps))) bad++;
    const share3 = bad / (steps + 1);
    legs.push(d * (1 + 1.5 * share3) / pace);
    blocked.push(share3 > 0.1);
    length += d;
    at = p;
  }
  return { legs, total: legs.reduce((a, b) => a + b, 0), length, blocked, hits: sim2.pathHits(from, pts, target) };
}
function missionStart(sim2, m, toward) {
  const d = m.deploy;
  if (d) {
    const kind = d.kind ?? sim2.squadById(m.squad)?.formation ?? "line", n = d.cells.length;
    if (kind === "wedge") return { x: d.o.x, y: d.o.y };
    if (kind === "horns") return { x: (d.cells[0].x + d.cells[n - 1].x) / 2, y: (d.cells[0].y + d.cells[n - 1].y) / 2 };
    if (kind === "circle") {
      const t = toward ?? m.path[0], r = Math.hypot(d.p.x - d.o.x, d.p.y - d.o.y), len = t ? Math.hypot(t.x - d.o.x, t.y - d.o.y) : 0;
      return len > 0.01 ? { x: d.o.x + (t.x - d.o.x) / len * r, y: d.o.y + (t.y - d.o.y) / len * r } : { x: d.o.x, y: d.o.y };
    }
    return { x: d.cells.reduce((a, c) => a + c.x, 0) / n, y: d.cells.reduce((a, c) => a + c.y, 0) / n };
  }
  const s = sim2.squadById(m.squad);
  return s ? sim2.squadCenter(s) : null;
}
function addCard(sim2, plan2, kind, squadId, arg = "") {
  if (plan2.cards.length >= sim2.cardLimit()) return `L\u1EC1u h\u1ECDp chi\u1EBFn ch\u1EC9 cho ${sim2.cardLimit()} th\u1EBB l\u1EC7nh: n\xE2ng c\u1EA5p l\u1EC1u ho\u1EB7c b\u1ECF b\u1EDBt`;
  if (kind !== "signal" && !sim2.squadById(squadId)) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (plan2.cards.some((c) => c.kind === kind && c.squad === squadId && c.arg === arg)) return "\u0110\xE3 c\xF3 th\u1EBB n\xE0y";
  plan2.cards.push({ id: plan2.nextCard++, kind, squad: squadId, arg });
  return null;
}
function removeCard(plan2, cardId) {
  plan2.cards = plan2.cards.filter((c) => c.id !== cardId);
}
function reviewPlan(sim2, plan2) {
  const out = [];
  const t = plan2.tribe ? sim2.tribes.find((x) => x.id === plan2.tribe) : void 0;
  if (plan2.kind === "attack") {
    if (!t) out.push("\u2717 Ch\u01B0a ch\u1ECDn l\xE0ng");
    else if (t.state !== "free") out.push(`\u2717 ${t.def.name} kh\xF4ng c\xF2n l\xE0 \u0111\u1ECBch`);
    else {
      const level = sim2.mapLevel(t.id), maps = sim2.maps.filter((m) => m.tribe === t.id);
      if (!level && !sim2.dev.freeBuild) out.push("\u2717 Ch\u01B0a c\xF3 b\u1EA3n \u0111\u1ED3 l\xE0ng n\xE0y");
      else {
        const newest = Math.max(...maps.map((m) => m.at));
        const days2 = Math.floor((sim2.time - newest) / 1200);
        out.push(days2 >= 3 ? "B\u1EA3n \u0111\u1ED3 \u0111\xE3 c\u0169" : days2 >= 1 ? `B\u1EA3n \u0111\u1ED3 t\u1EEB ${days2} ng\xE0y tr\u01B0\u1EDBc` : "B\u1EA3n \u0111\u1ED3 m\u1EDBi");
        if (maps.some((m) => m.gaps > 0)) out.push("B\u1EA3n \u0111\u1ED3 c\xF2n h\u1EDF");
      }
    }
  }
  if (!plan2.missions.length) out.push("\u2717 Ch\u01B0a c\xF3 \u0111\u1ED9i n\xE0o");
  else if (plan2.kind === "attack" && !plan2.missions.some((m) => m.path.length || m.ordered)) out.push("\u2717 Ch\u01B0a \u0111\u1ED9i n\xE0o c\xF3 m\u0169i t\xEAn hay l\u1EC7nh");
  for (const m of plan2.missions) {
    const s = sim2.squadById(m.squad), n = s ? sim2.squadUnits(s).length : 0, name = s?.name ?? "?";
    if (!n) out.push(`\u2717 ${name}: ch\u01B0a c\xF3 l\xEDnh`);
    else if (isHolding(plan2, m)) out.push(`${name}: \u0111\u1EE9ng y\xEAn t\u1EF1 v\u1EC7 (ch\u01B0a c\xF3 m\u0169i t\xEAn hay l\u1EC7nh)`);
    if (n && m.trigger.kind === "signal" && !plan2.cards.some((c) => c.kind === "signal")) out.push(`${name}: ch\u1EDD t\xEDn hi\u1EC7u nh\u01B0ng ch\u01B0a c\xF3 th\u1EBB Ph\xE1t t\xEDn hi\u1EC7u`);
    if (n && m.trigger.kind === "after" && !plan2.missions.some((x) => x.squad === m.trigger.squad)) out.push(`\u2717 ${name}: ch\u1EDD m\u1ED9t \u0111\u1ED9i kh\xF4ng c\xF3 trong k\u1EBF ho\u1EA1ch`);
    if (n && m.deploy && n < m.deploy.cells.length) out.push(`\u2717 ${name}: ${n}/${m.deploy.cells.length} l\xEDnh cho \u0111\u1EE7 \xF4`);
    const unfit = s ? sim2.squadUnits(s).filter((v) => v.down > 0 || v.train || sim2.sleepLocked(v)).length : 0;
    if (unfit) out.push(`\u2717 ${name}: ${unfit} l\xEDnh ch\u01B0a \u0111i \u0111\u01B0\u1EE3c (th\u01B0\u01A1ng, t\u1EADp, ng\u1EE7 say)`);
    if (s && n && !sim2.squadCenter(s)) out.push(`${name}: ch\u01B0a c\xF3 ch\u1ED7 \u0111\u1EE9ng`);
    if (s && plan2.kind === "attack" && m.withdrawAt > 0 && !m.retreat.length && m.path.length) out.push(`${name}: ch\u01B0a v\u1EBD \u0111\u01B0\u1EDDng r\xFAt, s\u1EBD v\u1EC1 ch\u1ED7 h\u1EB9n`);
    if (s && plan2.kind === "attack" && m.route === "night") out.push(`${name}: ch\u1EDD t\u1ED1i m\u1EDBi \u0111i`);
    if (s && plan2.kind === "attack") out.push(...obstacleLines(sim2, plan2, m, name));
  }
  if (plan2.kind === "attack") {
    const starts = plan2.missions.filter((m) => m.trigger.kind === "time" && m.trigger.at <= 0).length;
    if (plan2.missions.length && !starts && !plan2.cards.some((c) => c.kind === "go")) out.push("Ch\u01B0a \u0111\u1ED9i n\xE0o c\xF3 gi\u1EDD xu\u1EA5t ph\xE1t");
  }
  return out;
}
function isHolding(plan2, m) {
  return plan2.kind === "attack" && !m.path.length && !m.ordered;
}
function obstacleLines(sim2, plan2, m, name) {
  const out = [], start = sim2.missionStart(m);
  if (start && m.path.length) {
    const hits2 = sim2.pathHits(start, m.path, m.target?.kind === "prop" ? m.target.at : void 0), seen = /* @__PURE__ */ new Set();
    for (const o of hits2) {
      if (!o || o.kind === "enemy" || seen.has(`${o.x},${o.y}`)) continue;
      seen.add(`${o.x},${o.y}`);
      if (!o.clear) out.push(`\u2717 ${name}: m\u0169i t\xEAn v\u01B0\u1EDBng ${o.label}, kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c`);
      else out.push(`${name}: v\u01B0\u1EDBng ${o.label}, s\u1EBD t\u1EF1 ph\xE1`);
    }
  }
  if (m.deploy) {
    const under = m.deploy.cells.map((c) => sim2.obstacleAt(Math.floor(c.x), Math.floor(c.y))).filter((o) => !!o);
    const cut = under.filter((o) => o.clear && o.kind !== "enemy").length, stuck = under.length - cut;
    if (cut) out.push(`${name}: ${cut} \xF4 d\u01B0\u1EDBi c\xE2y/\u0111\xE1, l\xEDnh t\u1EF1 ph\xE1`);
    if (stuck) out.push(`${name}: ${stuck} \xF4 tr\xEAn n\u01B0\u1EDBc/c\xF4ng tr\xECnh, \u0111\u1ED9i h\xECnh m\xE9o`);
  }
  return out;
}
function cancelPlan(sim2, plan2) {
  if (plan2.status === "running") return "K\u1EBF ho\u1EA1ch \u0111ang ch\u1EA1y: h\xE3y r\xFAt qu\xE2n tr\u01B0\u1EDBc";
  sim2.plans.splice(sim2.plans.indexOf(plan2), 1);
  return null;
}
function objectivePos(sim2, plan2, m) {
  const t = sim2.tribes.find((x) => x.id === plan2.tribe);
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
      const l = sim2.get(t.leaderId);
      return l && l.health > 0 ? { x: l.x, y: l.y, target: l.id } : { ...t.camp };
    }
    default:
      return { ...t.camp };
  }
}
function goLeg(sim2, s, m, pts) {
  const p = pts[Math.min(m.leg, pts.length - 1)], last = m.leg >= pts.length - 1;
  const mode = m.state === "withdraw" || m.stance === "evade" ? "move" : last && m.stance === "hold" ? "hold" : "attack";
  if (m.state === "withdraw" || pts !== m.path) {
    sim2.squadMove(s, p.x, p.y, mode);
    return;
  }
  const ob = sim2.arrowMove(s, m, p, mode);
  if (ob) sim2.haltSquad(m, s, ob);
}
function pathStep(sim2, m, s, c) {
  if (m.state !== "march") return;
  const p = m.path[m.leg];
  if (!p || Math.hypot(p.x - c.x, p.y - c.y) > 3.5) return;
  if (m.leg < m.path.length - 1) {
    m.leg++;
    goLeg(sim2, s, m, m.path);
    return;
  }
  m.state = "engaged";
  sim2.noteBattle("note", `${s.name} t\u1EDBi ch\u1ED7 t\u1EA5n c\xF4ng.`);
  const end = m.path[m.path.length - 1];
  if (m.target || m.stance === "evade" || !end) return;
  const about = sim2.foes.some((f) => f.health > 0 && f.ai && f.ai.role !== "civ" && Math.hypot(f.x - end.x, f.y - end.y) < 12);
  if (!about) {
    sim2.squadMove(s, end.x, end.y, "hold");
    sim2.noteBattle("note", `${s.name} kh\xF4ng th\u1EA5y ai \u1EDF cu\u1ED1i m\u0169i t\xEAn: gi\u1EEF v\u1ECB tr\xED v\xE0 \u0111\xE1nh m\u1ECDi th\u1EE9 xung quanh.`);
  }
}
function dispatch(sim2, plan2, m, s) {
  if (m.path.length) {
    m.state = "march";
    m.leg = 0;
    goLeg(sim2, s, m, m.path);
    if (m.stance === "shoot") {
      for (const v of sim2.squadUnits(s)) if (!v.weapon || !(v.weapon === "bow" || v.weapon === "sling")) sim2.orderHold([v.id]);
    }
    return;
  }
  const pos = objectivePos(sim2, plan2, m);
  if (!pos) return;
  m.state = "march";
  const c = sim2.squadCenter(s) ?? plan2.rally;
  if (m.route === "forest") {
    const dx = pos.x - c.x, dy = pos.y - c.y, len = Math.max(1, Math.hypot(dx, dy));
    sim2.squadMove(s, c.x + dx * 0.5 - dy / len * 10, c.y + dy * 0.5 + dx / len * 10, m.stance === "evade" ? "move" : "attack");
    return;
  }
  sim2.squadMove(s, pos.x, pos.y, m.stance === "evade" ? "move" : "attack");
  if (m.stance === "shoot") {
    for (const v of sim2.squadUnits(s)) if (!v.weapon || !(v.weapon === "bow" || v.weapon === "sling")) sim2.orderHold([v.id]);
  }
}
function triggered(sim2, plan2, m) {
  const t = sim2.tribes.find((x) => x.id === plan2.tribe), tr = m.trigger;
  if (m.route === "night" && !sim2.resting) return false;
  if (tr.kind === "time") return sim2.time - plan2.startedAt >= tr.at;
  if (tr.kind === "signal") return plan2.signal;
  if (tr.kind === "after") {
    const o = plan2.missions.find((x) => x.squad === tr.squad);
    return !!o && (o.state === "engaged" || o.state === "withdraw" || o.state === "done");
  }
  if (!t) return false;
  const raiders = t.unitIds.map((u) => sim2.get(u)).filter((u) => u && u.ai?.role !== "civ");
  return raiders.length > 0 && raiders.some((u) => Math.hypot(u.x - t.camp.x, u.y - t.camp.y) > 9);
}
function assemble(sim2, s, d) {
  const us = sim2.squadUnits(s).sort((a, b) => (sim2.armOf(a) === "archer" ? 1 : 0) - (sim2.armOf(b) === "archer" ? 1 : 0) || a.id - b.id);
  const front = (c) => c.x * Math.cos(d.heading) + c.y * Math.sin(d.heading);
  const cells = d.cells.slice().sort((a, b) => front(b) - front(a)), taken = /* @__PURE__ */ new Set();
  s.heading = d.heading;
  s.anchor = { x: cells.reduce((a, c) => a + c.x, 0) / cells.length, y: cells.reduce((a, c) => a + c.y, 0) / cells.length };
  us.forEach((v, i) => {
    const c = cells[Math.min(i, cells.length - 1)], ob = sim2.obstacleAt(Math.floor(c.x), Math.floor(c.y));
    if (ob?.clear && ob.kind !== "enemy" && sim2.startBreaking(v, ob, { x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + 0.5 })) {
      taken.add(Math.floor(c.y) * sim2.world.size + Math.floor(c.x));
      return;
    }
    const spot2 = sim2.nearestFree(Math.floor(c.x), Math.floor(c.y), taken) ?? [Math.floor(c.x), Math.floor(c.y)];
    taken.add(spot2[1] * sim2.world.size + spot2[0]);
    sim2.orderMove([v.id], spot2[0], spot2[1]);
  });
}
function assembled(sim2, plan2) {
  return plan2.missions.every((m) => {
    const s = sim2.squadById(m.squad);
    return !s || !m.resting && sim2.squadUnits(s).every((v) => !v.breaks && (!v.fight.anchor || Math.hypot(v.x - v.fight.anchor.x, v.y - v.fight.anchor.y) < 2.5));
  });
}
function regather(sim2, plan2) {
  let n = 0;
  for (const m of plan2.missions) {
    const s = sim2.squadById(m.squad);
    if (!s || m.resting) continue;
    for (const v of sim2.squadUnits(s)) {
      const a = v.fight.anchor;
      if (!a || v.breaks || v.phase === "fight" || v.path.length || v.down > 0 || Math.hypot(v.x - a.x, v.y - a.y) < 2.5) continue;
      const ob = sim2.obstacleAt(Math.floor(a.x), Math.floor(a.y));
      n++;
      if (ob?.clear && ob.kind !== "enemy" && sim2.startBreaking(v, ob, a)) continue;
      sim2.orderMove([v.id], Math.floor(a.x), Math.floor(a.y));
    }
  }
  return n;
}
function engagePlan(sim2, plan2) {
  if (plan2.kind !== "attack" || plan2.status !== "running") return "K\u1EBF ho\u1EA1ch ch\u01B0a tri\u1EC3n khai";
  if (plan2.stage === "assemble") return "Qu\xE2n ch\u01B0a v\xE0o v\u1ECB tr\xED h\u1EBFt";
  if (plan2.stage !== "ready") return plan2.stage === "fight" ? "\u0110ang \u0111\xE1nh r\u1ED3i" : "Qu\xE2n \u0111ang r\xFAt";
  plan2.stage = "fight";
  plan2.startedAt = sim2.time;
  plan2.signal = false;
  if (plan2.stats) plan2.stats.fought = true;
  sim2.say("Xung phong! K\u1EBF ho\u1EA1ch t\xE1c chi\u1EBFn \u0111\u01B0\u1EE3c th\u1EF1c thi.");
  sim2.noteBattle("note", "L\u1EC7nh \u0111\xE1nh \u0111\u01B0\u1EE3c ban ra.");
  return null;
}
function withdrawPlan(sim2, plan2) {
  if (plan2.kind !== "attack" || plan2.status !== "running") return "K\u1EBF ho\u1EA1ch ch\u01B0a tri\u1EC3n khai";
  if (plan2.stage === "retreat" || plan2.stage === "recall") return "Qu\xE2n \u0111ang r\xFAt r\u1ED3i";
  for (const m of plan2.missions) m.resting = false;
  plan2.withdrawnAt = sim2.time;
  const recall = plan2.stage === "assemble" || plan2.stage === "ready" || plan2.stage === "over";
  plan2.stage = recall ? "recall" : "retreat";
  if (recall) {
    plan2.startedAt = sim2.time;
    for (const m of plan2.missions) {
      const s = sim2.squadById(m.squad);
      m.state = "withdraw";
      m.leg = 0;
      if (s && sim2.squadUnits(s).length) sim2.squadMove(s, plan2.rally.x, plan2.rally.y, "move");
    }
    if (plan2.result) {
      sim2.say("R\xFAt qu\xE2n: to\xE0n qu\xE2n v\u1EC1 l\xE0ng.");
      sim2.noteBattle("note", "To\xE0n qu\xE2n r\xFAt v\u1EC1 l\xE0ng sau tr\u1EADn.");
    } else {
      sim2.say("H\u1EE7y tr\u1EADn: to\xE0n qu\xE2n r\xFAt v\u1EC1 l\xE0ng.");
      sim2.noteBattle("note", "H\u1EE7y tr\u1EADn tr\u01B0\u1EDBc khi \u0111\xE1nh, to\xE0n qu\xE2n v\u1EC1 l\xE0ng.");
    }
    return null;
  }
  for (const m of plan2.missions) {
    const s = sim2.squadById(m.squad);
    if (!s || m.state === "done" || !sim2.squadUnits(s).length) {
      m.state = "done";
      continue;
    }
    m.state = "withdraw";
    m.leg = 0;
    if (m.retreat.length) goLeg(sim2, s, m, m.retreat);
    else sim2.squadMove(s, plan2.rally.x, plan2.rally.y, "move");
  }
  sim2.say("R\xFAt qu\xE2n!");
  sim2.noteBattle("note", "L\u1EC7nh r\xFAt to\xE0n qu\xE2n.");
  return null;
}
var REST_DONE = 95;
function noteRested(sim2, m, name, us) {
  if (!m.rested && us.reduce((a, v) => a + v.energy, 0) / us.length >= REST_DONE) {
    m.rested = true;
    sim2.say(`${name} \u0111\xE3 ngh\u1EC9 \u0111\u1EE7 s\u1EE9c: b\u1EA5m \u0110i ti\u1EBFp khi mu\u1ED1n \u0111i.`);
  }
}
function setRest(sim2, plan2, squadId, on) {
  if (plan2.kind !== "attack" || plan2.status !== "running") return "Ch\u01B0a c\xF3 tr\u1EADn n\xE0o";
  if (!sim2.planOpen("rest")) return sim2.era === "ancient" ? "C\u1EA7n nghi\xEAn c\u1EE9u: Ngh\u1EC9 ng\u01A1i d\xE3 chi\u1EBFn" : "Ch\u01B0a m\u1EDF kh\xF3a";
  const m = plan2.missions.find((x) => x.squad === squadId), s = sim2.squadById(squadId), c = s ? sim2.squadCenter(s) : null;
  if (!m || !s || !c) return "Kh\xF4ng c\xF3 \u0111\u1ED9i n\xE0y";
  if (!!m.resting === on) return null;
  if (plan2.stage === "retreat" || plan2.stage === "recall") return "Qu\xE2n \u0111ang r\xFAt v\u1EC1 l\xE0ng";
  if (on) {
    if (!sim2.supplyReadyIn(plan2)) return "Kh\xF4ng c\xF3 l\xEDnh h\u1EADu c\u1EA7n \u0111\u1EC3 d\u1EF1ng l\u1EC1u: kh\xF4ng ngh\u1EC9 ng\u01A1i \u0111\u01B0\u1EE3c";
    if (sim2.squadUnits(s).some((v) => v.phase === "fight")) return `${s.name} \u0111ang giao chi\u1EBFn`;
    m.resting = true;
    m.rested = false;
    if (plan2.stage === "assemble" || plan2.stage === "ready") for (const v of sim2.squadUnits(s)) {
      sim2.resetTask(v);
      sim2.clearCombat(v);
      v.fight.mode = "hold";
      v.fight.anchor = { x: v.x, y: v.y };
    }
    else sim2.squadMove(s, c.x, c.y, "hold");
    for (const v of sim2.squadUnits(s)) v.nightOwl = false;
    sim2.say(`${s.name} d\u1EEBng l\u1EA1i ngh\u1EC9 ng\u01A1i.`);
    return null;
  }
  m.resting = false;
  for (const v of sim2.squadUnits(s)) v.nightOwl = true;
  if (plan2.stage === "assemble" || plan2.stage === "ready") {
    if (m.deploy) assemble(sim2, s, m.deploy);
    else for (const v of sim2.squadUnits(s)) {
      v.fight.mode = "guard";
      v.fight.anchor = { x: v.x, y: v.y };
    }
    sim2.say(`${s.name} ti\u1EBFp t\u1EE5c.`);
    return null;
  }
  if (m.state === "march") {
    if (m.path.length) goLeg(sim2, s, m, m.path);
    else dispatch(sim2, plan2, m, s);
  } else if (m.state === "withdraw") {
    if (m.retreat.length) goLeg(sim2, s, m, m.retreat);
    else sim2.squadMove(s, plan2.rally.x, plan2.rally.y, "move");
  } else sim2.squadMove(s, c.x, c.y, "hold");
  sim2.say(`${s.name} ti\u1EBFp t\u1EE5c.`);
  return null;
}
function startPlan(sim2, plan2) {
  const bad = reviewPlan(sim2, plan2).find((l) => l.startsWith("\u2717"));
  if (bad) return bad.slice(2);
  if (plan2.kind === "defense") return "K\u1EBF ho\u1EA1ch ph\xF2ng th\u1EE7 ch\u1EA1y khi b\u1EA1n \u0111\xE1nh tr\u1ED1ng b\xE1o \u0111\u1ED9ng";
  const attacked = sim2.attackReason();
  if (attacked) return `L\xE0ng \u0111ang b\u1ECB t\u1EA5n c\xF4ng (${attacked.toLowerCase()}): kh\xF4ng th\u1EC3 \u0111i \u0111\xE1nh`;
  for (const m of plan2.missions) {
    const s = sim2.squadById(m.squad);
    m.state = "wait";
    m.initial = sim2.squadUnits(s).length;
    m.leg = 0;
    m.block = null;
    if (m.deploy) assemble(sim2, s, m.deploy);
    else if (isHolding(plan2, m)) for (const v of sim2.squadUnits(s)) {
      v.fight.mode = "guard";
      v.fight.anchor = { x: v.x, y: v.y };
    }
  }
  loadPacks(sim2, plan2);
  begin(sim2, plan2);
  plan2.status = "running";
  plan2.stage = "assemble";
  plan2.startedAt = sim2.time;
  plan2.signal = false;
  plan2.result = "";
  plan2.endedAt = 0;
  sim2.say(`Tri\u1EC3n khai qu\xE2n \u0111\xE1nh ${sim2.tribes.find((t) => t.id === plan2.tribe)?.def.name ?? ""} b\u1EAFt \u0111\u1EA7u.`);
  return null;
}
function endCheck(sim2, plan2, t) {
  if (!t) {
    plan2.status = "done";
    plan2.result = "lost";
    plan2.endedAt = sim2.time;
    return;
  }
  const armed = headcount(sim2, t).guards > 0;
  if (t.state !== "free" || !armed && !t.props.some((p) => p.kind === "fire" || p.kind === "tower")) {
    plan2.stage = "over";
    plan2.result = "won";
    plan2.endedAt = sim2.time;
    sim2.say(`Chi\u1EBFn th\u1EAFng! ${t.def.name} kh\xF4ng c\xF2n l\xEDnh, l\u1EEDa tr\u1EA1i v\xE0 th\xE1p canh \u0111\xE3 s\u1EADp. B\u1EA5m R\xFAt qu\xE2n khi mu\u1ED1n v\u1EC1 l\xE0ng.`);
    sim2.noteBattle("note", `${t.def.name} \u0111\xE3 b\u1ECB \u0111\xE1nh b\u1EA1i.`);
    if (t.state === "free") sim2.conquer(t.id, "L\xE0ng b\u1ECB san b\u1EB1ng");
    return;
  }
  if (plan2.missions.filter((m) => !isHolding(plan2, m)).every((m) => m.state === "done" || m.state === "idle")) {
    plan2.result = "lost";
    plan2.endedAt = sim2.time;
    const standing2 = plan2.missions.some((m) => isHolding(plan2, m) && m.state === "hold");
    const left = plan2.missions.some((m) => m.initial > 0 && (sim2.squadById(m.squad) ? sim2.squadUnits(sim2.squadById(m.squad)).length : 0) > 0);
    if (standing2) plan2.stage = "over";
    else plan2.status = "done";
    sim2.say(left ? "Thua tr\u1EADn: c\xE1c \u0111\u1ED9i ti\u1EBFn \u0111\xE1nh \u0111\xE3 r\xFAt ho\u1EB7c g\u1EE5c." : "Thua tr\u1EADn: qu\xE2n ta kh\xF4ng c\xF2n ai.");
  }
}
function homeEnough(sim2, plan2, s) {
  if (plan2.withdrawnAt === void 0 || sim2.time - plan2.withdrawnAt < WAR_DATA.retreat.graceSeconds) return false;
  const us = sim2.squadUnits(s), home = us.filter((v) => Math.hypot(plan2.rally.x - v.x, plan2.rally.y - v.y) < 7).length;
  return us.length > 0 && home >= WAR_DATA.retreat.doneShare * us.length;
}
function pulledOut(sim2, plan2, s) {
  return homeEnough(sim2, plan2, s);
}
function freeStuck(sim2, plan2, dt) {
  if (Math.floor(sim2.time / 4) === Math.floor((sim2.time - dt) / 4)) return;
  let budget = 3;
  for (const m of plan2.missions) {
    const s = sim2.squadById(m.squad);
    if (!s || m.state !== "withdraw" && plan2.stage !== "recall") continue;
    for (const v of sim2.squadUnits(s)) {
      if (budget <= 0) return;
      if (v.phase !== "idle" || v.path.length || Math.hypot(plan2.rally.x - v.x, plan2.rally.y - v.y) < 7 || sim2.view && sim2.inView(v.x, v.y)) continue;
      const rx = Math.floor(plan2.rally.x), ry = Math.floor(plan2.rally.y);
      if (sim2.pathTo(v, rx, ry, 14e3).length) continue;
      budget--;
      const x0 = v.x, y0 = v.y, taken = /* @__PURE__ */ new Set();
      let freed = false;
      search: for (const r of [6, 10, 16, 24, 36]) for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2, spot2 = sim2.nearestFree(Math.floor(x0 + Math.cos(a) * r), Math.floor(y0 + Math.sin(a) * r), taken);
        if (!spot2) continue;
        v.x = spot2[0] + 0.5;
        v.y = spot2[1] + 0.5;
        if (sim2.pathTo(v, rx, ry, 14e3).length) {
          freed = true;
          break search;
        }
      }
      if (freed) {
        v.path = [];
        v.slide = null;
        v.bad.clear();
        sim2.orderMove([v.id], plan2.rally.x, plan2.rally.y);
      } else {
        v.x = x0;
        v.y = y0;
      }
    }
  }
}
function tickPlans(sim2, dt) {
  if (sim2.alarmUntil > 0 && sim2.time > sim2.alarmUntil) sim2.alarmUntil = 0;
  for (const plan2 of sim2.plans) {
    if (plan2.kind !== "attack" || plan2.status !== "running") continue;
    const t = sim2.tribes.find((x) => x.id === plan2.tribe);
    if (plan2.stage === "over") continue;
    if (plan2.stage === "assemble") {
      if (Math.floor(sim2.time) !== Math.floor(sim2.time - dt)) regather(sim2, plan2);
      const late = !plan2.missions.some((m) => m.resting) && sim2.time - plan2.startedAt > Math.max(150, 0.75 * sim2.dayLen);
      if (assembled(sim2, plan2) || late) {
        plan2.stage = "ready";
        const missing2 = plan2.missions.reduce((a, m) => {
          const s = sim2.squadById(m.squad);
          return a + (s ? sim2.squadUnits(s).filter((v) => v.fight.anchor && Math.hypot(v.x - v.fight.anchor.x, v.y - v.fight.anchor.y) >= 2.5).length : 0);
        }, 0);
        sim2.say(missing2 ? `Qu\xE2n \u0111\xE3 v\xE0o v\u1ECB tr\xED, c\xF2n ${missing2} l\xEDnh ch\u01B0a t\u1EDBi k\u1ECBp. \u0110\xE1nh hay r\xFAt?` : "Qu\xE2n \u0111\xE3 v\xE0o v\u1ECB tr\xED. \u0110\xE1nh hay r\xFAt?");
      }
    }
    freeStuck(sim2, plan2, dt);
    if (plan2.stage === "recall") {
      const home = plan2.missions.every((m) => {
        const s = sim2.squadById(m.squad), c = s ? sim2.squadCenter(s) : null;
        return !c || Math.hypot(plan2.rally.x - c.x, plan2.rally.y - c.y) < 7;
      });
      if (home || sim2.time - plan2.startedAt > 240) {
        if (plan2.result) {
          plan2.status = "done";
          sim2.say("Qu\xE2n \u0111\xE3 v\u1EC1 l\xE0ng.");
          continue;
        }
        plan2.status = "draft";
        plan2.stage = "assemble";
        for (const m of plan2.missions) {
          m.state = "idle";
          m.leg = 0;
        }
        sim2.say("Qu\xE2n \u0111\xE3 v\u1EC1 l\xE0ng. K\u1EBF ho\u1EA1ch \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn: s\u1EEDa r\u1ED3i tri\u1EC3n khai l\u1EA1i khi mu\u1ED1n.");
      }
      continue;
    }
    if (plan2.stage === "assemble" || plan2.stage === "ready") {
      if (Math.floor(sim2.time) !== Math.floor(sim2.time - dt)) for (const m of plan2.missions) {
        const s = sim2.squadById(m.squad), us = s ? sim2.squadUnits(s) : [];
        if (m.resting && s && us.length) noteRested(sim2, m, s.name, us);
      }
      continue;
    }
    const second = Math.floor(sim2.time) !== Math.floor(sim2.time - dt), half = Math.floor(sim2.time * 2) !== Math.floor((sim2.time - dt) * 2);
    for (const m of plan2.missions) {
      const s = sim2.squadById(m.squad);
      if (!s || !sim2.squadUnits(s).length) {
        m.state = "done";
        continue;
      }
      if (m.resting) {
        const us = sim2.squadUnits(s);
        if (second) noteRested(sim2, m, s.name, us);
        continue;
      }
      if (isHolding(plan2, m) && m.state !== "withdraw" && m.state !== "done") {
        m.state = "hold";
        continue;
      }
      const alive2 = sim2.squadUnits(s).length, c = sim2.squadCenter(s);
      if (m.state === "wait" && triggered(sim2, plan2, m)) dispatch(sim2, plan2, m, s);
      else if (m.state === "blocked") {
        if (second && sim2.blockCleared(m)) {
          m.block = null;
          m.state = "march";
          goLeg(sim2, s, m, m.path);
          sim2.say(`${s.name} \u0111i ti\u1EBFp.`);
        }
      }
      if (m.state === "march" || m.state === "engaged" || m.state === "blocked") {
        if (m.state === "march" && m.path.length && half && sim2.watchMarch(m, s)) continue;
        if (second && m.state !== "blocked" && !sim2.tickTarget(plan2, m, s) && m.state === "engaged" && m.stance === "fight") sim2.rampage(plan2, s);
        const pos = m.path.length ? null : objectivePos(sim2, plan2, m);
        if (m.path.length && m.state !== "blocked") pathStep(sim2, m, s, c);
        if (pos) {
          const d = Math.hypot(pos.x - c.x, pos.y - c.y);
          if (m.state === "march" && d < 9) {
            m.state = "engaged";
            sim2.noteBattle("note", `${s.name} \xE1p s\xE1t ${OBJECTIVE_NAME[m.objective].toLowerCase()}.`);
            if (pos.target) sim2.orderAttack(sim2.squadUnits(s).map((v) => v.id), { kind: "unit", id: pos.target });
          } else if (m.state === "march" && m.route === "forest" && d > 12 && Math.hypot((s.anchor?.x ?? 0) - c.x, (s.anchor?.y ?? 0) - c.y) < 4) dispatch(sim2, plan2, { ...m, route: "main" }, s);
        }
        const lost = m.initial ? 1 - alive2 / m.initial : 0;
        if (m.withdrawAt > 0 && lost >= m.withdrawAt) {
          m.state = "withdraw";
          m.leg = 0;
          m.block = null;
          if (m.retreat.length) goLeg(sim2, s, m, m.retreat);
          else sim2.squadMove(s, plan2.rally.x, plan2.rally.y, "move");
          sim2.noteBattle("note", `${s.name} r\xFAt lui sau khi m\u1EA5t ${Math.round(lost * 100)}% qu\xE2n.`);
          sim2.say(`${s.name} r\xFAt lui!`);
        }
      } else if (m.state === "withdraw") {
        if (pulledOut(sim2, plan2, s)) m.state = "done";
        else if (m.retreat.length) {
          const p = m.retreat[m.leg];
          if (p && Math.hypot(p.x - c.x, p.y - c.y) < 3.5) {
            if (m.leg < m.retreat.length - 1) {
              m.leg++;
              goLeg(sim2, s, m, m.retreat);
            } else m.state = "done";
          }
        } else if (Math.hypot(plan2.rally.x - c.x, plan2.rally.y - c.y) < 7 || pulledOut(sim2, plan2, s)) m.state = "done";
      }
    }
    endCheck(sim2, plan2, t);
  }
}
function playCard(sim2, plan2, cardId) {
  const card = plan2.cards.find((c2) => c2.id === cardId);
  if (!card) return "Kh\xF4ng c\xF3 th\u1EBB n\xE0y";
  if (card.kind === "signal") {
    plan2.signal = true;
    sim2.say("T\xEDn hi\u1EC7u \u0111\u01B0\u1EE3c ph\xE1t \u0111i!");
    return null;
  }
  const s = sim2.squadById(card.squad), m = plan2.missions.find((x) => x.squad === card.squad);
  if (!s) return "\u0110\u1ED9i n\xE0y kh\xF4ng c\xF2n";
  if (card.kind === "formation") return sim2.setFormation(s.id, card.arg);
  if (plan2.status !== "running" || !m) return "K\u1EBF ho\u1EA1ch ch\u01B0a b\u1EAFt \u0111\u1EA7u";
  if (!sim2.squadUnits(s).length) return `${s.name} kh\xF4ng c\xF2n ai`;
  const c = sim2.squadCenter(s);
  switch (card.kind) {
    case "go":
    case "advance":
      if (m.state === "withdraw" || m.state === "done") return `${s.name} \u0111\xE3 r\xFAt`;
      if (m.state === "blocked") return `${s.name} \u0111ang b\u1ECB ch\u1EB7n: c\u1EED l\xEDnh ph\xE1 v\u1EADt c\u1EA3n tr\u01B0\u1EDBc`;
      if (!m.initial) m.initial = sim2.squadUnits(s).length;
      dispatch(sim2, plan2, m, s);
      break;
    case "hold":
      m.state = "hold";
      sim2.squadMove(s, c.x, c.y, "hold");
      break;
    case "shoot":
      m.stance = "shoot";
      for (const v of sim2.squadUnits(s)) if (v.weapon !== "bow" && v.weapon !== "sling") sim2.orderHold([v.id]);
      break;
    case "attack":
      if (!canTarget(sim2, card.arg, plan2.tribe)) return "B\u1EA3n \u0111\u1ED3 ch\u01B0a \u0111\u1EE7 c\u1EA5p \u0111\u1EC3 nh\u1EAFm m\u1EE5c ti\xEAu n\xE0y";
      m.objective = card.arg;
      if (!m.initial) m.initial = sim2.squadUnits(s).length;
      dispatch(sim2, plan2, m, s);
      break;
    case "retreat":
      m.state = "withdraw";
      m.leg = 0;
      if (m.retreat.length) goLeg(sim2, s, m, m.retreat);
      else sim2.squadMove(s, plan2.rally.x, plan2.rally.y, "move");
      sim2.noteBattle("note", `${s.name} \u0111\u01B0\u1EE3c l\u1EC7nh r\xFAt.`);
      break;
  }
  return null;
}
function callArmy(sim2) {
  if (!sim2.villagers.some((v) => v.job === "fight" && !v.guard)) return "Ch\u01B0a c\xF3 l\xEDnh n\xE0o trong c\xE1c tr\u1EA1i";
  sim2.alarmUntil = sim2.time + 900;
  sim2.say("G\u1ECDi qu\xE2n \u0111\u1ED9i: l\xEDnh ra kh\u1ECFi tr\u1EA1i, s\u1EB5n s\xE0ng chi\u1EBFn \u0111\u1EA5u.");
  return null;
}
function standDown2(sim2) {
  if (sim2.alarmUntil <= sim2.time) return;
  sim2.alarmUntil = 0;
  sim2.say("Qu\xE2n \u0111\u1ED9i v\u1EC1 tr\u1EA1i.");
  for (const v of sim2.villagers) if (v.team === "player" && v.job === "fight" && !v.guard && v.post < 0 && !v.out) v.recall = true;
}
function soundAlarm(sim2) {
  if (RESEARCH.enabled && !sim2.dev.freeBuild && !sim2.researched.has("signal")) return "C\u1EA7n nghi\xEAn c\u1EE9u: T\xEDn hi\u1EC7u (tr\u1ED1ng, kh\xF3i)";
  sim2.alarmUntil = sim2.time + 180;
  sim2.say("Tr\u1ED1ng b\xE1o \u0111\u1ED9ng vang l\xEAn! D\xE2n v\u1EC1 \u0111\u1ED1ng l\u1EEDa, qu\xE2n v\u1EC1 v\u1ECB tr\xED.");
  const fire2 = sim2.campfire(), fx = (fire2?.x ?? sim2.world.start.x) + 1, fy = (fire2?.y ?? sim2.world.start.y) + 3;
  const plan2 = sim2.plans.find((p) => p.kind === "defense");
  const hostile = sim2.foes.filter((f) => f.ai?.role === "raider" && f.health > 0), first = hostile[0] ?? sim2.tribes.find((t) => t.state === "free" && t.raid)?.camp;
  const toward = first ?? { x: fx, y: fy + 10 };
  const inward = (b, w) => {
    const dx = fx - b.x, dy = fy - b.y, len = Math.max(1, Math.hypot(dx, dy));
    return { x: b.x + w / 2 + dx / len * 1.8, y: b.y + w / 2 + dy / len * 1.8 };
  };
  const place = (post) => {
    if (post === "gate") {
      const g = sim2.buildings.filter((b) => b.kind === "gate" && b.done).sort((a, b) => Math.hypot(a.x - toward.x, a.y - toward.y) - Math.hypot(b.x - toward.x, b.y - toward.y))[0];
      if (g) return inward(g, 1);
    }
    if (post === "fence") {
      const f = sim2.buildings.filter((b) => b.kind === "fence" && b.done).sort((a, b) => Math.hypot(a.x - toward.x, a.y - toward.y) - Math.hypot(b.x - toward.x, b.y - toward.y))[0];
      if (f) return inward(f, 1);
    }
    if (post === "tower") {
      const tw = sim2.buildings.filter((b) => b.kind === "tower" && b.done).sort((a, b) => Math.hypot(a.x - toward.x, a.y - toward.y) - Math.hypot(b.x - toward.x, b.y - toward.y))[0];
      if (tw) return inward(tw, 2);
    }
    return { x: fx, y: fy };
  };
  const squads = plan2 ? plan2.missions : sim2.squads.map((s) => ({ squad: s.id, post: "fire" }));
  for (const m of squads) {
    const s = sim2.squadById(m.squad);
    if (!s) continue;
    if (m.post === "tower") for (const tw of sim2.buildings.filter((b) => b.kind === "tower" && b.done)) sim2.assignTower(sim2.squadUnits(s).map((v) => v.id), tw.id);
    const p = place(m.post);
    sim2.squadMove(s, p.x, p.y, "hold");
  }
  return null;
}

// src/sim/warquick.ts
var ARM_NAME2 = { foot: "B\u1ED9 binh", archer: "Cung th\u1EE7", cavalry: "K\u1EF5 binh" };
function army2(sim2) {
  return sim2.mine(sim2.villagers.filter((v) => v.job === "fight" && !v.guard && v.post < 0 && v.health > 0).map((v) => v.id)).filter((v) => v.job === "fight");
}
function quickAttack(sim2, tribeId) {
  if (sim2.era === "ancient") return "Th\u1EDDi Trung c\u1ED5 \u0111\xE1nh b\u1EB1ng L\u1EC1u h\u1ECDp chi\u1EBFn, kh\xF4ng c\xF2n \u0111\xE1nh nhanh";
  if (warPlan(sim2)) return "\u0110ang c\xF3 chi\u1EBFn tranh";
  const attacked = sim2.attackReason();
  if (attacked) return `L\xE0ng \u0111ang b\u1ECB t\u1EA5n c\xF4ng (${attacked.toLowerCase()}): kh\xF4ng th\u1EC3 \u0111i \u0111\xE1nh`;
  const t = tribeOf(sim2, tribeId);
  if (!t || t.state !== "free") return "L\xE0ng n\xE0y kh\xF4ng c\xF2n l\xE0 k\u1EBB \u0111\u1ECBch";
  if (!sim2.isFound(tribeId)) return "Ch\u01B0a ph\xE1t hi\u1EC7n l\xE0ng n\xE0y";
  if (!army2(sim2).length) return "Ch\u01B0a c\xF3 l\xEDnh n\xE0o ra tr\u1EADn: tuy\u1EC3n l\xEDnh \u1EDF c\xE1c tr\u1EA1i";
  sim2.summonAllies(t);
  const men = army2(sim2);
  for (const p of sim2.plans.filter((x) => x.quick && x.status !== "running")) sim2.plans.splice(sim2.plans.indexOf(p), 1);
  for (const v of men) {
    sim2.leaveSquad([v.id]);
  }
  const plan2 = newPlan(sim2, "attack", tribeId);
  plan2.quick = true;
  for (const arm of ["foot", "archer", "cavalry"]) {
    const group = men.filter((v) => sim2.armOf(v) === arm);
    if (!group.length) continue;
    const s = createSquad(sim2, ARM_NAME2[arm], true).squad;
    for (const v of group) {
      v.squad = s.id;
      s.ids.push(v.id);
    }
    addMission(sim2, plan2, s.id, 0);
    plan2.missions[plan2.missions.length - 1].ordered = true;
  }
  for (const m of plan2.missions) {
    const s = sim2.squadById(m.squad);
    m.state = "wait";
    m.initial = sim2.squadUnits(s).length;
    m.leg = 0;
    m.block = null;
  }
  loadPacks(sim2, plan2);
  begin(sim2, plan2);
  plan2.status = "running";
  plan2.stage = "ready";
  plan2.startedAt = sim2.time;
  plan2.signal = false;
  plan2.result = "";
  plan2.endedAt = 0;
  engagePlan(sim2, plan2);
  sim2.say(`To\xE0n qu\xE2n (${men.length} l\xEDnh) xu\u1EA5t ph\xE1t \u0111\xE1nh ${t.def.name}!`);
  return null;
}
function cleanup(sim2) {
  sim2.dismissAllies();
  for (const p of sim2.plans) {
    if (!p.quick || p.status === "running") continue;
    for (const m of [...p.missions]) {
      const s = sim2.squadById(m.squad);
      if (!s) continue;
      const ids2 = [...s.ids];
      disbandSquad(sim2, s.id);
      for (const id of ids2) {
        const v = sim2.byId.get(id);
        if (v && v.job === "fight" && !v.ally) {
          sim2.clearCombat(v);
          v.recall = true;
        }
      }
    }
  }
}

// src/sim/forecast.ts
var SPREAD = [0.4, 0.35, 0.2, 0.1];
var AVERAGE_STAT = 6.5;
function dps(weapon, str, agi, armor) {
  const w = WEAPONS[weapon ?? "fist"] ?? WEAPONS.fist, base = w.damage + RULES.strengthDamage * str;
  return base * (1 - (armor ? armor[w.type] : 0)) / cycleOf(w.cycle, agi);
}
var armOf2 = (sim2, v) => sim2.armOf(v);
var STANCE_WEIGHT = { fight: 1, shoot: 0.8, hold: 0.5, evade: 0 };
var pct2 = (x) => `${Math.round(x * 100)}%`;
function forecastPlan(sim2, plan2) {
  const t = plan2.tribe ? sim2.tribes.find((x) => x.id === plan2.tribe) : void 0;
  const notes = sim2.reviewPlan(plan2), blocked = notes.filter((l) => l.startsWith("\u2717")).map((l) => l.slice(2));
  const intel = plan2.tribe ? sim2.tribeIntel(plan2.tribe) : null, level = intel ? intel.level : 0;
  const out = { level, chance: 0, spread: SPREAD[level], verdict: "", blocked: blocked.length ? blocked.join("\n") : null, warnings: notes.filter((l) => !l.startsWith("\u2717")), win: [], lose: [], lines: [], compare: [], facts: [] };
  if (!t || !intel) {
    out.verdict = "Ch\u01B0a c\xF3 b\u1EA3n \u0111\u1ED3 \u0111\u1EC3 l\u01B0\u1EE3ng s\u1EE9c.";
    return out;
  }
  const enemyArmor = t.def.armor ? ARMORS.hide : null;
  const enemyWeapons = t.def.weapons, enemyType = (WEAPONS[enemyWeapons[0]] ?? WEAPONS.fist).type;
  let strength = 0, count2 = 0, hurt2 = 0, bare = 0, unarmored = 0;
  const arms2 = { foot: 0, archer: 0, cavalry: 0 };
  const perSquad = [];
  for (const m of plan2.missions) {
    const s = sim2.squadById(m.squad);
    if (!s) continue;
    const us = sim2.squadUnits(s), w2 = STANCE_WEIGHT[m.stance], sa = { foot: 0, archer: 0, cavalry: 0 };
    let worth = 0;
    for (const v of us) {
      const armor = v.armor ? ARMORS[v.armor] ?? null : null, hp = v.health / (1 - (armor ? armor[enemyType] : 0));
      const unit = Math.sqrt(dps(v.weapon, v.stats.str, v.stats.agi, enemyArmor) * hp);
      worth += unit * w2;
      count2++;
      sa[armOf2(sim2, v)]++;
      arms2[armOf2(sim2, v)]++;
      if (v.health < 0.6 * v.maxHealth) hurt2++;
      if (!v.weapon) bare++;
      if (!v.armor) unarmored++;
    }
    strength += worth;
    perSquad.push({ name: s.name, n: us.length, worth, arms: sa });
  }
  const ratio2 = t.def.warriors / Math.max(1, t.def.warriors + t.def.civilians);
  const soldiers = intel.soldiers, men = soldiers ? soldiers.foot + soldiers.archer + soldiers.cavalry : Math.max(1, Math.round((level >= 2 ? intel.people.length : intel.population) * ratio2));
  const power = 1 + (t.mil ?? 0);
  const wAvg = enemyWeapons.map((id) => dps(id, AVERAGE_STAT, AVERAGE_STAT, null)).reduce((a, b) => a + b, 0) / enemyWeapons.length;
  const hpAvg = maxHpOf(AVERAGE_STAT) * power;
  const ourArmor = (() => {
    const worn = plan2.missions.flatMap((m) => {
      const s = sim2.squadById(m.squad);
      return s ? sim2.squadUnits(s) : [];
    }).filter((v) => v.armor);
    return worn.length / Math.max(1, count2);
  })();
  const theirUnit = Math.sqrt(wAvg * power * (1 - 0.35 * ourArmor) * hpAvg);
  const towers = intel.structures.filter((x) => x.kind === "tower").length, fences = intel.structures.filter((x) => x.kind === "fence").length, gates = intel.structures.filter((x) => x.kind === "gate").length;
  const works = level >= 2 ? 1 + 0.15 * Math.min(4, towers) + 0.03 * Math.min(6, fences) + 0.04 * Math.min(2, gates) : 1;
  const chief = level >= 3 && intel.people.some((p) => p.leader) ? 1.08 : 1;
  let match = 1;
  if (soldiers && men && count2) {
    const mine2 = (a, b) => BEATS[a][b];
    let our = 0, their = 0;
    for (const a of Object.keys(arms2)) for (const b of Object.keys(soldiers)) {
      const w2 = arms2[a] / count2 * (soldiers[b] / men);
      our += w2 * mine2(a, b);
      their += w2 * mine2(b, a);
    }
    match = Math.sqrt(our / Math.max(0.1, their));
  }
  const theirs = men * theirUnit * works * chief, ours = strength * match;
  const R2 = theirs > 0 ? ours / theirs : 9;
  out.chance = count2 ? Math.max(0.01, Math.min(0.99, 1 / (1 + Math.exp(-3 * Math.log(Math.max(0.01, R2)))))) : 0;
  const lossIfWin = R2 > 1 ? 1 - Math.sqrt(1 - 1 / (R2 * R2)) : 1;
  const w = out.warnings;
  if (!count2) w.push("Kh\xF4ng c\xF3 l\xEDnh n\xE0o trong k\u1EBF ho\u1EA1ch");
  if (bare) w.push(`${bare} l\xEDnh ch\u01B0a c\xF3 v\u0169 kh\xED`);
  if (unarmored && count2 > 1) w.push(`${unarmored} l\xEDnh ch\u01B0a c\xF3 gi\xE1p`);
  if (hurt2) w.push(`${hurt2} l\xEDnh b\u1ECB th\u01B0\u01A1ng n\u1EB7ng`);
  const home = sim2.villagers.filter((v) => v.job === "fight" && v.health > 0 && !plan2.missions.some((m) => sim2.squadById(m.squad)?.ids.includes(v.id))).length;
  if (home < 3) w.push(`Ch\u1EC9 ${home} l\xEDnh \u1EDF l\u1EA1i gi\u1EEF l\xE0ng`);
  const pk = packPlan(sim2, plan2);
  if (sim2.era === "ancient") {
    if (!pk.sup) w.push("Kh\xF4ng c\xF3 l\xEDnh h\u1EADu c\u1EA7n: qu\xE2n s\u1EBD \u0111\xF3i");
    else if (pk.days < plan2.carryDays - 0.05) w.push(`L\u01B0\u01A1ng ch\u1EC9 \u0111\u1EE7 ${pk.days.toFixed(1)} ng\xE0y`);
  }
  out.win = [`\u0110\u1ECBch h\u1EBFt l\xEDnh, l\u1EEDa t\u1EAFt, c\xF4ng tr\xECnh s\u1EADp \u2192 d\xE2n xin h\xE0ng`, "L\u1EA5y kho l\u01B0\u01A1ng c\u1EE7a \u0111\u1ECBch", `M\u1EA5t kho\u1EA3ng ${pct2(lossIfWin)} qu\xE2n`];
  out.lose = ["H\u1EBFt qu\xE2n ho\u1EB7c r\xFAt lui", "L\xEDnh ch\u1EBFt l\xE0 m\u1EA5t c\u1EA3 v\u0169 kh\xED, gi\xE1p", "\u0110\u1ECBch c\xF3 th\u1EC3 k\xE9o \u0111\u1EBFn tr\u1EA3 \u0111\u0169a"];
  out.verdict = out.chance >= 0.8 ? "R\u1EA5t c\xF3 l\u1EE3i" : out.chance >= 0.6 ? "C\xF3 l\u1EE3i" : out.chance >= 0.4 ? "C\xE2n b\u1EB1ng" : out.chance >= 0.2 ? "B\u1EA5t l\u1EE3i" : "R\u1EA5t b\u1EA5t l\u1EE3i";
  const mr = marchOfPlan(sim2, plan2), nTents = tentCount(sim2, plan2), tc = tentCost(sim2);
  out.compare.push({ label: "L\xEDnh", ours: count2, theirs: level >= 3 ? men : null });
  if (level >= 3 && soldiers) {
    out.compare.push({ label: "B\u1ED9 binh", ours: arms2.foot, theirs: soldiers.foot }, { label: "Cung", ours: arms2.archer, theirs: soldiers.archer }, { label: "K\u1EF5", ours: arms2.cavalry, theirs: soldiers.cavalry });
    out.compare.push({ label: "S\u1EE9c m\u1EA1nh", ours: Math.round(ours), theirs: Math.round(theirs) });
  }
  if (level >= 2) out.facts.push(["Ph\xF2ng th\u1EE7 \u0111\u1ECBch", works > 1 ? `${towers} ch\xF2i, ${fences} r\xE0o, ${gates} c\u1ED5ng` : "kh\xF4ng c\xF3"]);
  if (level >= 2) {
    let longest = 0;
    for (const m of plan2.missions) {
      const s = sim2.squadById(m.squad), start = s ? sim2.missionStart(m) : null;
      if (s && start && m.path.length) longest = Math.max(longest, sim2.routeTime(s, start, m.path).total / mr.speed);
    }
    if (longest > 0) out.facts.push(["\u0110\u01B0\u1EDDng \u0111i", `~${Math.max(1, Math.round(longest / 60))} ph\xFAt`]);
  }
  if (mr.soldiers) out.facts.push(["\u0110i ch\u1EADm", pct2(mr.slow)]);
  if (sim2.era === "ancient" && pk.sup) out.facts.push(["L\u01B0\u01A1ng", `${pk.days.toFixed(1)} ng\xE0y`]);
  if (sim2.era === "ancient" && nTents) out.facts.push(["L\u1EC1u", `${nTents} \xD7 ${tc.wood} g\u1ED7, ${tc.hide} da`]);
  return out;
}

// src/sim/siege.ts
var NODE_NAME = { tree: "c\xE2y", rock: "\u0111\xE1", bush: "b\u1EE5i qu\u1EA3" };
var PROP_NAME = { fire: "\u0110\u1ED1ng l\u1EEDa", pile: "Kho l\u01B0\u01A1ng", tower: "Ch\xF2i canh", fence: "H\xE0ng r\xE0o", gate: "C\u1ED5ng", house: "Nh\xE0" };
var propHp = (kind) => SIEGE.propHp[kind] ?? 60;
function propOnTile(sim2, x, y) {
  for (const tribe of sim2.tribes) for (const prop of tribe.props) if (x >= prop.x && x < prop.x + prop.w && y >= prop.y && y < prop.y + prop.h) return { tribe, prop };
  return void 0;
}
function obstacleAt(sim2, x, y) {
  const w = sim2.world, N = w.size;
  if (!w.inBounds(x, y)) return { kind: "wall", x, y, label: "r\xECa b\u1EA3n \u0111\u1ED3", clear: false };
  const node = w.nodeAt(x, y);
  if (node) return { kind: node.kind, x, y, label: NODE_NAME[node.kind], clear: true };
  const t = w.at(x, y);
  if (t === Tile.Water) return { kind: "water", x, y, label: "n\u01B0\u1EDBc", clear: false };
  if (w.occ[y * N + x]) {
    const found = propOnTile(sim2, x, y);
    if (found) return { kind: "enemy", x: found.prop.x, y: found.prop.y, label: PROP_NAME[found.prop.kind] ?? "c\xF4ng tr\xECnh", clear: true, tribe: found.tribe.id };
    const b = sim2.buildingAt(x, y);
    return b ? { kind: "ours", x, y, label: "c\xF4ng tr\xECnh c\u1EE7a l\xE0ng", clear: false } : { kind: "wall", x, y, label: "v\u1EADt c\u1EA3n", clear: false };
  }
  if (t !== Tile.Grass && t !== Tile.Mud) return { kind: "wall", x, y, label: "v\u1EADt c\u1EA3n", clear: false };
  return null;
}
function firstBlock(sim2, from, to, reach = Infinity, skip) {
  const d = Math.hypot(to.x - from.x, to.y - from.y), n = Math.ceil(Math.min(d, reach) * 2), sx = Math.floor(from.x), sy = Math.floor(from.y);
  for (let i = 1; i <= n; i++) {
    const f = Math.min(d, reach) / d * (i / n) || 0, x = Math.floor(from.x + (to.x - from.x) * f), y = Math.floor(from.y + (to.y - from.y) * f);
    if (x === sx && y === sy) continue;
    const o = obstacleAt(sim2, x, y);
    if (o && !(skip && skip(o))) return o;
  }
  return null;
}
function pathHits(sim2, start, pts, target) {
  const skip = (o) => o.kind === "enemy" && !!target && Math.abs(o.x - target.x) < 3 && Math.abs(o.y - target.y) < 3;
  let at = start;
  return pts.map((p) => {
    const o = firstBlock(sim2, at, p, Infinity, skip);
    at = p;
    return o;
  });
}
function corridorBlocks(sim2, start, pts, target) {
  const out = /* @__PURE__ */ new Map(), N = sim2.world.size;
  let at = start;
  for (const p of pts) {
    const d = Math.hypot(p.x - at.x, p.y - at.y), n = Math.max(1, Math.ceil(d * 2));
    for (let i = 0; i <= n; i++) {
      const cx = Math.floor(at.x + (p.x - at.x) * i / n), cy = Math.floor(at.y + (p.y - at.y) * i / n);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const o = obstacleAt(sim2, cx + dx, cy + dy);
        if (o && o.clear && o.kind !== "enemy" && !(target && Math.hypot(o.x - target.x, o.y - target.y) < 2)) out.set(o.y * N + o.x, o);
      }
    }
    at = p;
  }
  return [...out.values()];
}
function lineSteps(sim2, from, to) {
  const out = [], d = Math.hypot(to.x - from.x, to.y - from.y), n = Math.ceil(d * 2);
  let lx = Math.floor(from.x), ly = Math.floor(from.y);
  for (let i = 1; i <= n; i++) {
    const x = Math.floor(from.x + (to.x - from.x) * i / n), y = Math.floor(from.y + (to.y - from.y) * i / n);
    if (x === lx && y === ly) continue;
    if (sim2.world.isBlocked(x, y)) break;
    out.push([x, y]);
    lx = x;
    ly = y;
  }
  return out;
}
function breakBox(sim2, b) {
  if (b.kind === "node") return sim2.world.nodeAt(b.x, b.y) ? { x: b.x, y: b.y, w: 1, h: 1 } : null;
  const p = sim2.tribes.find((t) => t.id === b.tribe)?.props.find((q) => q.x === b.x && q.y === b.y);
  return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
}
function startBreaking(sim2, v, ob, home) {
  if (v.job !== "fight" || v.down > 0 || !ob.clear) return false;
  sim2.resetTask(v);
  sim2.clearCombat(v);
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
function clearNode(sim2, x, y) {
  const w = sim2.world, i = y * w.size + x, n = w.nodes.get(i);
  if (!n) return;
  for (const o of sim2.villagers) {
    if (o.breaks?.kind === "node" && o.breaks.x === x && o.breaks.y === y) stopBreaking(o);
    else if (o.target === i && (o.phase === "goNode" || o.phase === "work")) sim2.resetTask(o);
  }
  w.nodes.delete(i);
  w.tiles[i] = Tile.Grass;
}
function damageProp(sim2, tribeId, x, y, dmg) {
  const t = sim2.tribes.find((q) => q.id === tribeId), i = t ? t.props.findIndex((q) => q.x === x && q.y === y) : -1;
  if (!t || i < 0) return;
  const p = t.props[i];
  p.hp = (p.hp ?? propHp(p.kind)) - dmg;
  t.angryUntil = Math.max(t.angryUntil, sim2.time + 120);
  t.hitAt = sim2.time;
  if (p.hp > 0) return;
  t.props.splice(i, 1);
  const N = sim2.world.size;
  for (let j = 0; j < p.h; j++) for (let k = 0; k < p.w; k++) sim2.world.occ[(p.y + j) * N + p.x + k] = 0;
  sim2.say(`${PROP_NAME[p.kind] ?? "C\xF4ng tr\xECnh"} c\u1EE7a ${t.def.name} \u0111\xE3 b\u1ECB ph\xE1.`);
  sim2.noteBattle("note", `${PROP_NAME[p.kind] ?? "C\xF4ng tr\xECnh"} c\u1EE7a ${t.def.name} b\u1ECB ph\xE1.`);
  sim2.noteBattle("breach");
}
function structMult(w, kind) {
  if (w.ranged) return SIEGE.struct.ranged;
  const row = SIEGE.struct[w.type];
  return kind && row[kind] || 1;
}
var segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy, k = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + k * dx), py - (ay + k * dy));
};
function breachFor(sim2, v, tx, ty) {
  const w = weaponOf(v);
  if (v.job !== "fight" || v.breaks) return false;
  if (w.ranged && (v.fight.blockedT ?? 0) < SIEGE.struct.blockedSeconds && sim2.villagers.some((o) => o !== v && o.health > 0 && o.job === "fight" && !weaponOf(o).ranged && (o.fight.mode === "attack" || o.fight.mode === "attackMove") && Math.hypot(o.x - v.x, o.y - v.y) < 40)) return false;
  const dmg = weaponDamage(sim2, v, w) + RULES.strengthDamage * v.stats.str, cycle = swingCycle(sim2, v, w), N = sim2.world.size;
  let best = null, bestTime = Infinity;
  for (const t of sim2.tribes) {
    if (t.state === "destroyed") continue;
    const towers = t.props.filter((q) => q.kind === "tower");
    for (const p of t.props) {
      if (p.kind === "fire" || p.kind === "pile" || !sim2.world.occ[p.y * N + p.x]) continue;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      if (segDist(cx, cy, v.x, v.y, tx, ty) > 3.5) continue;
      const crew2 = sim2.villagers.filter((o) => o.breaks?.kind === "prop" && o.breaks.x === p.x && o.breaks.y === p.y).length;
      if (crew2 >= SIEGE.struct.breakers) continue;
      const rate = dmg * structMult(w, p.kind) / cycle * (crew2 + 1);
      const time = Math.hypot(cx - v.x, cy - v.y) / 2.2 + (p.hp ?? propHp(p.kind)) / Math.max(0.1, rate) + 3 * towers.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < 14).length;
      if (time < bestTime) {
        bestTime = time;
        best = { t, p };
      }
    }
  }
  if (!best) return false;
  const keep = { mode: v.fight.mode, target: v.fight.target, dest: v.fight.dest, anchor: v.fight.anchor };
  if (!startBreaking(sim2, v, { kind: "enemy", x: best.p.x, y: best.p.y, label: PROP_NAME[best.p.kind] ?? "c\xF4ng tr\xECnh", clear: true, tribe: best.t.id })) return false;
  Object.assign(v.fight, keep);
  v.fight.blockedT = 0;
  return true;
}
function breakBrain(sim2, v, dt) {
  const b = v.breaks;
  if (!b) return false;
  const box = breakBox(sim2, b);
  if (!box) {
    stopBreaking(v);
    return false;
  }
  v.fight.chaseT = 0;
  const w = weaponOf(v);
  v.fight.scan -= dt;
  if (v.fight.scan <= 0) {
    v.fight.scan = 0.4;
    if (b.kind === "prop" ? v.flinch > 0 && threatsOf(sim2, v, w.range + 1).length : threatsOf(sim2, v, 3.5).length) {
      stopBreaking(v);
      return false;
    }
  }
  const dx = Math.max(box.x - v.x, 0, v.x - (box.x + box.w)), dy = Math.max(box.y - v.y, 0, v.y - (box.y + box.h));
  if (Math.hypot(dx, dy) <= SIEGE.reach + (b.kind === "prop" && !w.ranged ? w.range * 0.5 : 0)) {
    v.path = [];
    v.slide = null;
    v.phase = "fight";
    v.facing = box.x + box.w / 2 >= v.x ? "right" : "left";
    if (!v.swing && v.atkCd <= 0) {
      const { hitAt, end } = swingTimes(w.anim);
      v.swing = { t: 0, hitAt, end, target: { kind: "unit", id: -1 } };
      v.atkCd = swingCycle(sim2, v, w);
      if (b.kind === "prop") damageProp(sim2, b.tribe, b.x, b.y, (weaponDamage(sim2, v, w) + RULES.strengthDamage * v.stats.str) * structMult(w, sim2.tribes.find((q) => q.id === b.tribe)?.props.find((q) => q.x === b.x && q.y === b.y)?.kind));
    }
    if (b.kind === "node") {
      const kind = sim2.world.nodeAt(b.x, b.y).kind;
      v.progress += dt / SIEGE.clearSeconds[kind];
      let sum = 0;
      for (const o of sim2.villagers) if (o.breaks?.kind === "node" && o.breaks.x === b.x && o.breaks.y === b.y) sum += o.progress;
      if (sum >= 1) clearNode(sim2, b.x, b.y);
    }
    return true;
  }
  v.fight.repath -= dt;
  if (!v.path.length && v.fight.repath <= 0 && sim2.pathLeft > 0) {
    sim2.pathLeft--;
    v.fight.repath = 1;
    if (sim2.routeTo(v, sim2.ringTiles(v, box.x, box.y, box.w, box.h), 3) < 0) {
      stopBreaking(v);
      if (b.kind === "prop") breachFor(sim2, v, box.x + box.w / 2, box.y + box.h / 2);
      return false;
    }
  }
  v.phase = v.path.length ? "move" : "idle";
  return true;
}
function legSpots(sim2, s, p) {
  const us = sim2.squadUnits(s).sort((a, b) => (armOf(a) === "archer" ? 1 : 0) - (armOf(b) === "archer" ? 1 : 0) || a.id - b.id);
  const offs = formationOffsets(s.formation, us.length), out = /* @__PURE__ */ new Map(), N = sim2.world.size;
  us.forEach((v, i) => {
    const [px, py] = placeOffset(offs[i], s.heading, p.x, p.y);
    out.set(v.id, { x: Math.min(N - 1, Math.max(0, Math.floor(px))) + 0.5, y: Math.min(N - 1, Math.max(0, Math.floor(py))) + 0.5 });
  });
  return out;
}
var aimSkip = (m) => (o) => o.kind === "enemy" && m.target?.kind === "prop" && Math.abs(o.x - m.target.x) < 3 && Math.abs(o.y - m.target.y) < 3;
function arrowMove(sim2, s, m, p, mode) {
  const us = sim2.squadUnits(s), c = sim2.squadCenter(s);
  if (!us.length || !c) return null;
  if (Math.hypot(p.x - c.x, p.y - c.y) > 1) s.heading = Math.atan2(p.y - c.y, p.x - c.x);
  s.anchor = { x: p.x, y: p.y };
  const spots = legSpots(sim2, s, p), skip = aimSkip(m);
  let block = null;
  for (const v of us) {
    const spot2 = spots.get(v.id);
    v.speed = (1.6 + 0.1 * v.stats.agi) * FORMATIONS[s.formation].speed;
    sim2.orderAttackMove([v.id], spot2.x, spot2.y);
    v.fight.strict = true;
    if (mode === "hold") v.fight.anchor = { x: spot2.x, y: spot2.y };
    if (mode === "move") {
      v.fight.mode = "guard";
      v.fight.dest = null;
      v.fight.anchor = { x: spot2.x, y: spot2.y };
    }
    v.path = lineSteps(sim2, v, spot2);
    v.phase = v.path.length ? "move" : "idle";
    block ??= firstBlock(sim2, v, spot2, SIEGE.lookAhead, skip);
  }
  return block;
}
function haltSquad(sim2, m, s, ob) {
  m.state = "blocked";
  m.block = { ...ob, since: sim2.time };
  const us = sim2.squadUnits(s);
  sim2.orderHold(us.map((v) => v.id));
  if (ob.kind === "enemy") for (const v of us) startBreaking(sim2, v, ob);
  else if (ob.clear) {
    const crew2 = us.filter((v) => !v.breaks).sort((a, b) => Math.hypot(a.x - ob.x, a.y - ob.y) - Math.hypot(b.x - ob.x, b.y - ob.y)).slice(0, Math.max(1, Math.ceil(us.length / 4)));
    for (const v of crew2) startBreaking(sim2, v, ob);
  }
  sim2.say(ob.clear ? ob.kind === "enemy" ? `${s.name} b\u1ECB ch\u1EB7n b\u1EDFi ${ob.label}.` : `${s.name} d\u1EEBng l\u1EA1i ph\xE1 ${ob.label} ch\u1EAFn \u0111\u01B0\u1EDDng.` : `${s.name} kh\xF4ng th\u1EC3 \u0111i ti\u1EBFp: v\u01B0\u1EDBng ${ob.label}, kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c.`);
  sim2.noteBattle("note", `${s.name} b\u1ECB ch\u1EB7n b\u1EDFi ${ob.label}.`);
}
function watchMarch(sim2, m, s) {
  const p = m.path[Math.min(m.leg, m.path.length - 1)];
  if (!p) return false;
  const spots = legSpots(sim2, s, p), skip = aimSkip(m);
  for (const v of sim2.squadUnits(s)) {
    const spot2 = spots.get(v.id);
    if (v.breaks || v.phase === "fight" || v.down > 0) continue;
    const ob = firstBlock(sim2, v, spot2, SIEGE.lookAhead, skip);
    if (ob) {
      haltSquad(sim2, m, s, ob);
      return true;
    }
    if (!v.path.length && Math.hypot(spot2.x - v.x, spot2.y - v.y) > 1.5) {
      v.path = lineSteps(sim2, v, spot2);
      v.phase = v.path.length ? "move" : "idle";
    }
  }
  return false;
}
function blockCleared(sim2, m) {
  const b = m.block;
  if (!b) return true;
  if (b.kind === "enemy") return !propOnTile(sim2, b.x, b.y);
  const now = obstacleAt(sim2, b.x, b.y);
  return !now || now.kind !== b.kind;
}
function breakBlock(sim2, plan2, squadId, n) {
  const m = plan2.missions.find((x) => x.squad === squadId), s = sim2.squadById(squadId);
  if (plan2.status !== "running" || !m || !s) return "\u0110\u1ED9i n\xE0y kh\xF4ng \u1EDF trong tr\u1EADn";
  if (m.state !== "blocked" || !m.block) return `${s.name} kh\xF4ng b\u1ECB ch\u1EB7n`;
  if (!m.block.clear) return `Kh\xF4ng ph\xE1 \u0111\u01B0\u1EE3c ${m.block.label}: h\xE3y r\xFAt ho\u1EB7c \u0111i \u0111\u01B0\u1EDDng kh\xE1c`;
  const ob = { ...m.block }, us = sim2.squadUnits(s).filter((v) => !v.breaks).sort((a, b) => Math.hypot(a.x - ob.x, a.y - ob.y) - Math.hypot(b.x - ob.x, b.y - ob.y));
  let sent = 0;
  for (const v of us.slice(0, Math.max(1, Math.min(Math.round(n), us.length)))) if (startBreaking(sim2, v, ob)) sent++;
  if (!sent) return "Kh\xF4ng c\xF2n ai \u0111\u1EC3 c\u1EED \u0111i ph\xE1";
  sim2.say(`${sent} l\xEDnh ${s.name} \u0111i ph\xE1 ${ob.label}.`);
  return null;
}
function targetNow(sim2, plan2, m) {
  const tg = m.target, t = sim2.tribes.find((q) => q.id === plan2.tribe);
  if (!tg || !t) return null;
  if (tg.kind === "prop") {
    const p = t.props.find((q) => q.x === tg.x && q.y === tg.y);
    return p ? { state: "live", prop: { x: p.x, y: p.y, tribe: t.id }, x: p.x + p.w / 2, y: p.y + p.h / 2 } : { state: "gone" };
  }
  const alive2 = t.unitIds.map((id) => sim2.get(id)).filter((u) => !!u && u.health > 0);
  const pool = tg.leader ? alive2.filter((u) => u.id === t.leaderId) : alive2.filter((u) => u.ai?.role !== "civ");
  if (!pool.length) return tg.leader || !alive2.length ? { state: "gone" } : { state: "moved" };
  const best = pool.slice().sort((a, b) => Math.hypot(a.x - tg.x, a.y - tg.y) - Math.hypot(b.x - tg.x, b.y - tg.y))[0];
  return Math.hypot(best.x - tg.x, best.y - tg.y) <= SIEGE.driftMax ? { state: "live", unit: best.id, x: best.x, y: best.y } : { state: "moved" };
}
var idle = (v) => !v.breaks && !v.fight.target && v.phase !== "fight" && v.phase !== "flee" && v.down <= 0;
var isWall2 = (p) => p.kind === "fence" || p.kind === "gate";
function rampage(sim2, plan2, s) {
  const t = sim2.tribes.find((q) => q.id === plan2.tribe);
  if (!t) return;
  const foes = t.unitIds.map((id) => sim2.get(id)).filter((u) => !!u && u.health > 0 && u.inTent !== true && u.ai?.role !== "civ");
  const fire2 = t.props.find((q) => q.kind === "fire");
  const breakProp = (v, p) => startBreaking(sim2, v, { kind: "enemy", x: p.x, y: p.y, label: p.kind, clear: true, tribe: t.id });
  for (const v of sim2.squadUnits(s)) {
    if (!idle(v)) continue;
    const sight = sim2.sightOf(v), dist = (x, y) => Math.hypot(x - v.x, y - v.y);
    const seen = (p) => dist(p.x + p.w / 2, p.y + p.h / 2) <= sight;
    const nearest = (list, at) => list.slice().sort((a, b) => dist(...at(a)) - dist(...at(b)))[0];
    const tower = nearest(t.props.filter((q) => q.kind === "tower" && seen(q)), (q) => [q.x, q.y]);
    if (tower) {
      breakProp(v, tower);
      continue;
    }
    const foe = nearest(foes.filter((u) => dist(u.x, u.y) <= sight), (u) => [u.x, u.y]);
    if (foe) {
      sim2.orderAttack([v.id], { kind: "unit", id: foe.id });
      continue;
    }
    const house = nearest(t.props.filter((q) => q.kind === "house" && seen(q)), (q) => [q.x, q.y]);
    if (house) {
      breakProp(v, house);
      continue;
    }
    const far = fire2 ?? nearest(t.props.filter((q) => q.kind === "tower"), (q) => [q.x, q.y]);
    if (far) breakProp(v, far);
    else {
      const left = nearest(foes, (u) => [u.x, u.y]);
      if (left) sim2.orderAttack([v.id], { kind: "unit", id: left.id });
    }
  }
}
function around(sim2, plan2, s) {
  const t = sim2.tribes.find((q) => q.id === plan2.tribe);
  if (!t) return;
  for (const v of sim2.squadUnits(s)) {
    if (!idle(v)) continue;
    const p = t.props.find((q) => !isWall2(q) && Math.hypot(q.x + q.w / 2 - v.x, q.y + q.h / 2 - v.y) < 5);
    if (p) startBreaking(sim2, v, { kind: "enemy", x: p.x, y: p.y, label: p.kind, clear: true, tribe: t.id }, v.fight.anchor ?? { x: v.x, y: v.y });
  }
}
function tickTarget(sim2, plan2, m, s) {
  if (!m.target || m.stance === "evade" || m.stance === "hold") return false;
  const ts = targetNow(sim2, plan2, m);
  if (!ts) return false;
  if (m.state === "march" && ts.state !== "gone") return true;
  if (m.state === "march") m.state = "engaged";
  if (ts.state === "gone") {
    rampage(sim2, plan2, s);
    return true;
  }
  if (ts.state === "moved") {
    const end = m.path[m.path.length - 1];
    if (end && (!s.anchor || Math.hypot(s.anchor.x - end.x, s.anchor.y - end.y) > 1)) sim2.squadMove(s, end.x, end.y, "hold");
    around(sim2, plan2, s);
    return true;
  }
  for (const v of sim2.squadUnits(s)) {
    if (!idle(v)) continue;
    if (ts.prop) startBreaking(sim2, v, { kind: "enemy", x: ts.prop.x, y: ts.prop.y, label: "c\xF4ng tr\xECnh", clear: true, tribe: ts.prop.tribe });
    else if (ts.unit !== void 0) sim2.orderAttack([v.id], { kind: "unit", id: ts.unit });
  }
  return true;
}

// src/sim/training.ts
var profileOf = (b) => TRAINING.profiles[b.kind];
var trainCap = (b) => TRAINING.caps[Math.max(0, Math.min(TRAINING.caps.length, b.level) - 1)];
function members(sim2, b) {
  const role = ROLE_IDS.find((r) => ROLES[r].building === b.kind);
  const inHouse = role ? sim2.villagers.filter((v) => roleOf(v) === role) : b.kind === "builder" ? sim2.crew() : b.staff.map((id) => sim2.get(id)).filter((v) => !!v);
  const away = sim2.villagers.filter((v) => v.train?.house === b.id && !inHouse.includes(v));
  return [...inHouse, ...away];
}
function trainCost(stat, care) {
  return { food: Math.round(TRAINING.foodBase + stat), coin: Math.round(TRAINING.coinBase + stat * TRAINING.coinPerStat) + TRAINING.care[care].coin };
}
var trainTime = (sim2, stat) => (TRAINING.dayBase + TRAINING.dayPerStat * stat) * sim2.dayLen;
function startTraining(sim2, ids2, houseId, care) {
  const lock = sim2.warLock();
  if (lock) return "\u0110ang c\xF3 chi\u1EBFn tranh: kh\xF4ng hu\u1EA5n luy\u1EC7n \u0111\u01B0\u1EE3c";
  const b = sim2.getBuilding(houseId), p = b ? profileOf(b) : void 0;
  if (!b || !p || !TRAINING.care[care]) return "Nh\xE0 n\xE0y kh\xF4ng hu\u1EA5n luy\u1EC7n \u0111\u01B0\u1EE3c";
  if (!b.done) return "Nh\xE0 ch\u01B0a d\u1EF1ng xong";
  const cap = trainCap(b), mine2 = members(sim2, b);
  let err = null, n = 0;
  for (const v of sim2.mine(ids2)) {
    if (!mine2.includes(v) || v.train) continue;
    if (v.stats[p.main] >= cap) {
      err = `${v.name} \u0111\xE3 t\u1EDBi tr\u1EA7n ${fmtStat(cap)} ${STAT_NAME[p.main].toLowerCase()} c\u1EE7a nh\xE0 c\u1EA5p ${b.level}: n\xE2ng c\u1EA5p nh\xE0`;
      continue;
    }
    const cost = trainCost(v.stats[p.main], care), short = sim2.missing(cost);
    if (short) {
      err = short;
      break;
    }
    sim2.pay(cost);
    sim2.exitBuilding(v);
    sim2.resetTask(v);
    v.train = { house: b.id, stat: p.main, left: trainTime(sim2, v.stats[p.main]), total: trainTime(sim2, v.stats[p.main]), care, cap };
    n++;
  }
  if (n) sim2.say(`${n} ng\u01B0\u1EDDi v\xE0o hu\u1EA5n luy\u1EC7n ${STAT_NAME[p.main].toLowerCase()} \u1EDF ${BUILDINGS[b.kind].name.toLowerCase()}.`);
  return n ? null : err ?? "Ch\u1ECDn ng\u01B0\u1EDDi trong nh\xE0 \u0111\u1EC3 hu\u1EA5n luy\u1EC7n";
}
function cancelTraining(sim2, ids2) {
  for (const v of sim2.mine(ids2)) if (v.train) {
    v.train = null;
    v.phase = "idle";
    v.path = [];
  }
}
function finish2(sim2, v) {
  const t = v.train, b = sim2.getBuilding(t.house), p = b ? profileOf(b) : void 0;
  v.train = null;
  if (!p) return;
  const [lo, hi] = TRAINING.gain, r = lo + sim2.rnd() * (hi - lo), main = v.stats[p.main], next = Math.min(t.cap, main * (1 + r)), got = Math.max(0, next - main);
  const round = (x) => Math.round(x * 100) / 100;
  v.stats[p.main] = round(main + got);
  if (p.partner) v.stats[p.partner] = round(Math.max(v.stats[p.partner], Math.min(t.cap, v.stats[p.partner] + got * TRAINING.partnerShare)));
  const floor = Math.max(TRAINING.floorMin, v.born[p.cost] * TRAINING.floor);
  v.stats[p.cost] = round(Math.max(Math.min(floor, v.stats[p.cost]), v.stats[p.cost] - got * TRAINING.care[t.care].penalty));
  const ratio2 = v.maxHealth > 0 ? v.health / v.maxHealth : 1;
  v.maxHealth = Math.round(maxHpOf(v.stats.vit));
  v.health = v.maxHealth * ratio2;
  if (!v.squad || v.squad < 0) v.speed = 1.6 + 0.1 * v.stats.agi;
  sim2.say(`${v.name} hu\u1EA5n luy\u1EC7n xong: ${STAT_NAME[p.main].toLowerCase()} ${fmtStat(main)} \u2192 ${fmtStat(v.stats[p.main])}, ${STAT_NAME[p.cost].toLowerCase()} ${fmtStat(v.stats[p.cost])}.`);
}
function trainStep(sim2, v, dt) {
  const t = v.train;
  if (!t) return false;
  t.left -= dt;
  if (t.left <= 0) {
    finish2(sim2, v);
    return false;
  }
  if (v.phase === "sleep" || v.phase === "goHome") return true;
  const b = sim2.getBuilding(t.house);
  if (!b) {
    v.train = null;
    return false;
  }
  const d = BUILDINGS[b.kind];
  if (!v.path.length && Math.hypot(b.x + d.w / 2 - v.x, b.y + d.h / 2 - v.y) > d.w + 2) {
    if (sim2.pathLeft > 0) {
      sim2.pathLeft--;
      sim2.routeTo(v, sim2.ringTiles(v, b.x, b.y, d.w, d.h), 3);
    }
    v.phase = v.path.length ? "move" : "idle";
  } else if (!v.path.length) v.phase = "idle";
  return true;
}

// src/sim/simwar.ts
var WAR = {
  /** One tick while a war is on (warmode.ts): only the army, the scouts out, the arrows in the air and the village under attack are worked; everyone else goes home and stands still. */
  tickWar(dt) {
    tickProjectiles(this, dt);
    tickWarAnimals(this, dt);
    const soldiers = army(this), ranks2 = ranks(this, soldiers), plan2 = warPlan(this);
    this.warIds = soldiers;
    this.march = marchOfPlan(this, plan2);
    if (Math.floor(this.time) !== Math.floor(this.time - dt)) {
      if (this.era !== "ancient") this.warMeals += (this.warNeed() + this.armyNeed()) / this.dayLen;
      else {
        this.warMeals += this.warNeed() / this.dayLen;
        eatPacks(this, plan2, this.armyNeed() / this.dayLen);
        if (Math.floor(this.time / 2) !== Math.floor((this.time - dt) / 2)) follow(this, plan2);
        tickTents(this, plan2);
        tickHarass(this, plan2);
      }
    }
    for (const v of [...this.villagers]) {
      if (ranks2.has(v.id)) this.tickVillager(v, dt);
      else standDown(this, v, dt);
    }
    tickBattle(this, dt);
    tickScouts(this, dt);
    tickPlans(this, dt);
    const enemy = warTribe(this);
    this.pathLeft = Math.max(this.pathLeft, FOE_PATH_SHARE);
    for (const f of [...this.foes]) if (f.team === enemy) tickFoe(this, f, dt);
    tickTribes(this, dt);
  },
  /** → warsupply.supplyAdvice */
  supplyAdvice(plan2) {
    return supplyAdvice(this, plan2);
  },
  /** Whether a feature of the war plan is researched (the details tab, the supply sums, the weather, the rest in the field). */
  planOpen(f) {
    return planOpen(this.researched, f, this.era === "ancient", this.dev.freeBuild);
  },
  /** → army.squadLimit */
  squadLimit() {
    return squadLimit(this);
  },
  /** → army.cellLimit */
  cellLimit() {
    return cellLimit(this);
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
  joinSquad(ids2, squadId) {
    return joinSquad(this, ids2, squadId);
  },
  /** → army.leaveSquad */
  leaveSquad(ids2) {
    return leaveSquad(this, ids2);
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
  /** → scouting.recallScouts */
  recallScouts(tribe) {
    return recallScouts(this, tribe);
  },
  /** → scouting.scoutFlow */
  scoutFlow(tribe) {
    return scoutFlow(this, tribe);
  },
  /** → scouting.startScout */
  startScout(ids2, tribe) {
    return startScout(this, ids2, tribe);
  },
  /** → scouting.planScout */
  planScout(ids2, tribe) {
    return planScout(this, ids2, tribe);
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
  enlistScouts(ids2) {
    return enlistScouts(this, ids2);
  },
  /** → scouting.dismissScouts */
  dismissScouts(ids2) {
    return dismissScouts(this, ids2);
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
  /** Set how many supply soldiers the plan takes and how many days of food they carry. Returns an error or null. */
  setSupply(plan2, n, days2) {
    if (plan2.status !== "draft") return "Ch\u1EC9 s\u1EEDa \u0111\u01B0\u1EE3c khi k\u1EBF ho\u1EA1ch c\xF2n l\xE0 b\u1EA3n nh\xE1p";
    plan2.supply = Math.max(0, Math.round(n));
    plan2.carryDays = Math.max(1, Math.min(WAR_DATA.supply.maxDays, Math.round(days2)));
    return null;
  },
  /** → wartent.shelter */
  shelter(v) {
    return shelter(this, v);
  },
  /** → wartent.sleepsInTent: night, and the tent of his squad stands beside him */
  sleepsInTent(v) {
    return sleepsInTent(this, v);
  },
  /** → warsupply.supplyAvailable: how many supply soldiers wait in their camp */
  supplyReady() {
    return supplyAvailable(this).length;
  },
  /** → scouting.noteScoutLoss */
  noteScoutLoss(v, cause) {
    noteScoutLoss(this, v, cause);
  },
  /** → warlog.noteLoot */
  noteLoot(tribe, res, n) {
    noteLoot(this, tribe, res, n);
  },
  /** → warplan.regather: soldiers off their cell go back to it; returns how many */
  regroupPlan(plan2) {
    return regather(this, plan2);
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
  /** → siege.breachFor */
  breachFor(v, x, y) {
    return breachFor(this, v, x, y);
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
  /** → siege.rampage */
  rampage(plan2, s) {
    rampage(this, plan2, s);
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
  /** In a war: whether a soldier of the army is fighting or marching (resting counts as marching); null for everyone else. */
  warMode(v) {
    return v.team === "player" && this.warIds.has(v.id) ? v.phase === "fight" || v.swing ? "fight" : "march" : null;
  },
  /** Supply soldiers of the deployed plan who are still alive (without them there is nobody to pitch a tent). */
  supplyReadyIn(plan2) {
    return supplyOf(this, plan2).length;
  },
  /** → warquick.quickAttack: the simple war of the stone age */
  quickAttack(tribeId) {
    return quickAttack(this, tribeId);
  },
  /** → warquick.army */
  quickArmy() {
    return army2(this);
  },
  /** → warplan.setRest */
  setRest(plan2, squadId, on) {
    return setRest(this, plan2, squadId, on);
  },
  /** → warplan.isHolding */
  isHolding(plan2, m) {
    return isHolding(plan2, m);
  },
  /** → training.startTraining */
  startTraining(ids2, houseId, care) {
    return startTraining(this, ids2, houseId, care);
  },
  /** → training.cancelTraining */
  cancelTraining(ids2) {
    return cancelTraining(this, ids2);
  },
  /** → training.trainStep */
  trainStep(v, dt) {
    return trainStep(this, v, dt);
  },
  /** → training.profileOf, trainCap */
  trainInfo(b) {
    const p = profileOf(b);
    return p ? { ...p, cap: trainCap(b) } : null;
  },
  /** → training.trainCost */
  trainCost(stat, care) {
    return trainCost(stat, care);
  },
  /** → training.trainTime */
  trainTime(stat) {
    return trainTime(this, stat);
  },
  /** → training.members */
  trainees(b) {
    return members(this, b);
  },
  /** → mounts.queueTame */
  queueTame(k) {
    return queueTame(this, k);
  },
  /** → mounts.unqueueTame */
  unqueueTame(k) {
    return unqueueTame(this, k);
  },
  /** → mounts.tameLock */
  tameLock(k) {
    return tameLock(this, k);
  },
  /** → mounts.tamedCount */
  tamedCount(k) {
    return tamedCount(this, k);
  },
  /** → mounts.tickTame */
  tickTame(dt) {
    return tickTame(this, dt);
  },
  /** → warplan.callArmy */
  callArmy() {
    return callArmy(this);
  },
  /** → warplan.standDown */
  standDown() {
    return standDown2(this);
  },
  /** → mounts.fitScoutMount */
  fitScoutMount(v) {
    return fitScoutMount(this, v);
  },
  /** → mounts.returnScoutMount */
  returnScoutMount(v) {
    return returnScoutMount(this, v);
  },
  /** → mounts.mountOf */
  mountOf(v) {
    return mountOf(this, v);
  },
  /** → mounts.mountSpeed */
  mountSpeed(v) {
    return mountSpeed(this, v);
  },
  /** → mounts.mountGuard */
  mountGuard(v) {
    return mountGuard(this, v);
  },
  /** → mounts.assignMount */
  assignMount(ids2, kind) {
    return assignMount(this, ids2, kind);
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
var STREAM_REACH = 40;
var Sim = class _Sim {
  constructor(seed2 = 1337) {
    this.seed = seed2;
    this.villagers = [];
    this.buildings = [];
    this.stock = emptyStock();
    /** Công cụ đã chế, đang chờ dân tới Xưởng lấy. Khóa dạng "axe1". */
    this.toolStock = {};
    /** Tools handed back with wear on them; they keep their durability. `id` as in toolStock. */
    this.wornTools = [];
    /** Hàng đợi chế tác (mã công thức). */
    this.craftQueue = [];
    /** For each order in craftQueue, what it was paid at (a multiple of its base cost), so that cancelling it gives back the same. */
    this.craftPaid = [];
    this.tameQueue = [];
    /** Research (tech ids) waiting for a free researcher in the Nhà nghiên cứu. */
    this.researchQueue = [];
    this.coinFrac = 0;
    this.sawCoin = false;
    /** Finished research (tech ids). Recipes and building levels stay locked until their tech is here. */
    this.researched = /* @__PURE__ */ new Set();
    /** Quests that have been seen done (not saved: a loaded game works them out again from what stands). */
    this.questSeen = /* @__PURE__ */ new Set();
    this.log = [];
    /** Current era: new buildings are built with this era's art and levels. */
    this.era = "stone";
    /** Hệ số tốc độ: 0 = tạm dừng. */
    this.speed = 1;
    /** Giây game đã trôi qua. */
    this.time = START_TIME;
    /** The day count and the time of the day are counted from here: the day `dayBase`+1 began at `timeBase` (moved when the era, and the length of a day, changes). */
    this.dayBase = 0;
    this.timeBase = 0;
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
    /** When there was last danger the civilians ran from (an attack on the village, or something that chased one of them): they stay in their houses for 30 seconds after it. */
    this.dangerAt = -1e9;
    /** The chunks where the other villages live their daily life: those round our people. Redone every second, never saved. */
    this.active = /* @__PURE__ */ new Set();
    /** People the village may hold beyond its campfire and beds: the campfires of the villages we took. */
    this.popBonus = 0;
    /** Places added to every camp of soldiers by the villages taken (difficulty.json capture.adopt): the army is limited by its camps, not by its people. */
    this.campBonus = 0;
    /** Whether strangers may come to settle (the campfire's panel shuts and opens the door; environment.toggleNewcomers). */
    this.newcomersOpen = true;
    /** How many villages we took (adopted or wiped out): each adds to the yield of every stroke of work (difficulty.json capture.yieldPerVillage). */
    this.conquered = 0;
    /** Fights between two villages that we saw (time, place): they become a notice for a while. Never saved. */
    this.clashes = [];
    this.animals = [];
    /** The animals put by while a war is on (fauna.tickWarAnimals); they come back when it is over. */
    this.hiddenAnimals = [];
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
    /** The wars fought, newest last (warlog.ts). */
    this.warLog = [];
    /** The scouts who died on their trips, with the reason (scouting.ts). */
    this.scoutLosses = [];
    this.nextPlan = 1;
    /** Game seconds until which the alarm drum is sounding (0 = quiet). */
    this.alarmUntil = 0;
    this.battle = { on: false, since: 0, quiet: 0, ourDead: 0, foeDead: 0, breaches: 0, shots: 0, notes: [] };
    /** The summaries of past fights, newest last. */
    this.battleReports = [];
    this.nextAid = 1;
    /** Test switches driven by the dev menu; all off in a normal game. */
    this.dev = { freeBuild: false, instantBuild: false, god: false, fastWorks: false, freeWorks: false, noTire: false, noArrivals: false };
    /** A tribe that has just surrendered and waits for the player to choose: adopt or tribute. */
    this.pendingTribe = null;
    this.acc = 0;
    this.fogDirty = true;
    this.nextVid = 1;
    this.nextBid = 1;
    this.leaderClock = 0;
    /** Seconds since the tribes were last looked after (they are tended once a second). */
    this.tribeClock = 0;
    /** The day the next event of the recurring kind is set (tribes.seasonEvent). */
    this.nextEventDay = 0;
    this.lastFullWarn = -999;
    this.lastMatWarn = -999;
    /** Today's and tomorrow's weather (tomorrow is rolled ahead so it can be foretold). */
    this.weather = "clear";
    this.nextWeather = "clear";
    this.lastDay = 1;
    this.signalled = false;
    this.resting = false;
    this.lastVision = -1;
    /** Food in the pot of the campfire: the meal of the coming end of day, filled before the store (see economy.feedPot). */
    this.foodPot = 0;
    /** How much the whole village is weakened today for going short at the last meal (0..FOOD.maxPenalty). */
    this.foodPenalty = 0;
    /** When the war that is on began (seconds of game time); -1 in peace. The meals of those days are paid when it ends (economy.eatWar). */
    this.warSince = -1;
    /** While a war is on: the soldiers of the plan, how their march goes (speed, food and energy factors) and the meals they and the village have eaten (paid when it ends). All reset in peace. */
    this.warIds = /* @__PURE__ */ new Set();
    this.march = PEACE;
    this.warMeals = 0;
    /** 0..1: the share of the army's meals the packs could not give, smoothed (warsupply.eatPacks). */
    this.warHunger = 0;
    /** The middle of the army while a war is on, and when the next band is sent to harass it (-1: none planned). */
    this.warFocus = null;
    this.warHarassAt = -1;
    /** What the camera sees plus a margin (tiles), set by the screen each frame; null: everything counts as seen. Only drawing and animation look at it, never the rules. */
    this.view = null;
    /** Food that came in today, and the total (pot + store) seen last tick (-1: not yet); the incomes of the last three days. Only to tell the player what the village earns. */
    this.foodIncome = 0;
    this.foodSeen = -1;
    this.foodDays = [];
    /** What the gatherers of each trade ('wood', 'stone', 'food', 'hunt', 'farm') brought in today and yesterday, for the card of their house. */
    /** The highest level a house of each kind had when it fell in battle: a new one of that kind is raised at that level (paying for the levels), not from level 1. */
    this.ruins = {};
    /** How much of the map of a village ("tribe:level") scouts brought home unfinished, 0..1: the next scouts go on from there. */
    this.drafts = {};
    /** The villagers the player has selected right now (the controller shares its own set): while one of them walks to a spot the player picked, nothing else decides for him. */
    this.controlled = /* @__PURE__ */ new Set();
    this.yieldNow = {};
    this.yieldPrev = {};
    this.streamClock = 0;
    this.world = new World(seed2);
    this.fog = new Fog(this.world);
    this.rnd = mulberry32(mix32(seed2 ^ 2654435769));
    this.frnd = mulberry32(mix32(seed2 ^ 2135587861));
    this.wrnd = mulberry32(mix32(seed2 ^ 1540483477));
    RES_NAME.coin = CURRENCY[this.era];
    this.researched.add("torch1");
    this.world.setSeason(this.season);
    this.nextWeather = rollWeather(seasonOf(this.day + 1), this.wrnd());
    this.resting = isRestTime(this.tod, this.season);
    const s = this.world.start;
    this.addBuilding("campfire", s.x + start_default.campfire.dx, s.y + start_default.campfire.dy, true);
    for (const [res, n] of Object.entries(start_default.stock)) this.stock[res] = n;
    for (const p of start_default.villagers) this.spawn(s.x + p.dx, s.y + p.dy, p.sex).job = p.job;
    this.say("Hai ng\u01B0\u1EDDi \u0111\u1EA7u ti\xEAn \u0111\xE3 \u0111\u1EBFn b\xEAn \u0111\u1ED1ng l\u1EEDa: m\u1ED9t ng\u01B0\u1EDDi h\xE1i l\u01B0\u1EE3m, m\u1ED9t ng\u01B0\u1EDDi \u0111\u1ED1n g\u1ED7. Vi\u1EC7c c\u1EE7a m\u1ED7i ng\u01B0\u1EDDi do c\xF4ng tr\xECnh c\u1EE7a ngh\u1EC1 \u0111\xF3 qu\u1EA3n l\xFD: m\u1EDF N\xF4ng tr\u1EA1i, X\u01B0\u1EDFng g\u1ED7 hay X\u01B0\u1EDFng \u0111\xE1 c\u1EA1nh \u0111\u1ED1ng l\u1EEDa \u0111\u1EC3 giao vi\u1EC7c. D\u1EF1ng Nh\xE0 th\u1EE3 x\xE2y tr\u01B0\u1EDBc, r\u1ED3i c\xE1c c\xF4ng tr\xECnh kh\xE1c.");
    this.refreshFog();
    placeStarters(this);
    for (const [cx, cy] of this.world.readyChunks()) populateChunk(this, cx, cy);
    this.world.onChunk = (cx, cy) => populateChunk(this, cx, cy);
    spawnTribes(this);
  }
  /** True for a selected villager who is on his way to a spot the player ordered: the fighting and fleeing of the brain wait until he gets there or is let go. */
  underOrders(v) {
    return v.team === "player" && (this.controlled.has(v.id) || !!v.fight.obey) && v.phase === "move" && v.path.length > 0;
  }
  // ---------------------------------------------------------------- tiện ích
  /** Seconds in a day of the era (data/time.json). */
  get dayLen() {
    return dayLength(this.era);
  }
  /** Work seconds that pass per game second (a day of labour is one game day, whatever the day lasts). */
  get paceWork() {
    return paceWork(this.dayLen);
  }
  get day() {
    return this.dayBase + Math.floor((this.time - this.timeBase) / this.dayLen) + 1;
  }
  /** 0..1 trong ngày: 0 = nửa đêm trước bình minh, 0.5 = giữa trưa. */
  get tod() {
    const len = this.dayLen, t = (this.time - this.timeBase) % len;
    return (t < 0 ? t + len : t) / len;
  }
  /** The era changes and with it the length of a day: the day count and the time of day go on from where they were. */
  setDayLength(era) {
    const day = this.day, tod = this.tod;
    this.era = era;
    this.dayBase = day - 1;
    this.timeBase = this.time - tod * this.dayLen;
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
  giveTorch(ids2) {
    return giveTorch(this, ids2);
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
  /** Is the point (tiles) where the camera looks (with its margin)? */
  inView(x, y) {
    const w = this.view;
    return !w || x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1;
  }
  /** How much an exhausted soldier of the army is weakened (0..): energy below `tired.below` takes up to `tired.maxPenalty` off his stats. */
  tiredPenalty(v) {
    if (!this.warIds.has(v.id)) return 0;
    const k = WAR_DATA.tired;
    return v.energy < k.below ? k.maxPenalty * (1 - v.energy / k.below) : 0;
  }
  /** → warmode.warPlan: a war is on */
  atWar() {
    return !!warPlan(this);
  }
  /** → villagers.goHome */
  goHome(v) {
    return goHome(this, v);
  }
  /** → roles.warLock */
  warLock() {
    return warLock(this);
  }
  /** → roles.assignRole */
  assignRole(ids2, role) {
    return assignRole(this, ids2, role);
  }
  /** → roles.releaseRole */
  releaseRole(ids2) {
    return releaseRole(this, ids2);
  }
  /** → roles.roleCapacity */
  roleCapacity(role) {
    return roleCapacity(this, role);
  }
  /** → roles.roleCount */
  roleCount(role) {
    return roleCount(this, role);
  }
  /** → tribes.foeBonus: what the strength of a tribe adds to a stat of its people */
  foeBonus(team, stat) {
    return foeBonus(this, team, stat);
  }
  /** → power.powerOf for our village */
  power() {
    return powerOf(this, this.villagers);
  }
  /** → power.powerOf for the people of a tribe */
  /** -> tribelod.tribePower (the people in the world and the crowd indoors) */
  tribePower(t) {
    return tribePower(this, t);
  }
  /** → roles.trimRoles */
  trimRoles() {
    return trimRoles(this);
  }
  /** → rest.bedsIn */
  bedsIn(kind) {
    return bedsIn(this, kind);
  }
  /** → fauna.restock: the land makes up what was taken, once a day */
  restockAnimals() {
    restock(this);
  }
  /** → rest.attackReason */
  attackReason() {
    return attackReason(this);
  }
  /** → rest.skipNightBlock */
  skipNightBlock() {
    return skipNightBlock(this);
  }
  /** → rest.quartered */
  quartered(v) {
    return quartered(this, v);
  }
  /** → rest.hides */
  hides(v) {
    return hides(this, v);
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
  setShift(ids2, shift) {
    for (const v of this.mine(ids2)) v.shift = shift;
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
    this.fog.invalidate();
  }
  // the drawing of the fog must be redone
  /** A new Sim continuing a saved game. */
  static fromSave(raw) {
    const data = migrate(raw), sim2 = new _Sim(data.seed);
    applySave(sim2, data);
    return sim2;
  }
  /** → environment.visionRadius */
  visionRadius() {
    return visionRadius(this);
  }
  /** → environment.fireRadius */
  fireRadius() {
    return fireRadius(this);
  }
  get(id) {
    return this.byId.get(id);
  }
  say(text) {
    this.log.push({ t: this.time, text });
    if (this.log.length > 40) this.log.shift();
  }
  /** → construction.startLevel */
  startLevel(kind) {
    return startLevel(this, kind);
  }
  /** → construction.startCost */
  startCost(kind) {
    return startCost(this, kind);
  }
  /** → idle.homeKind */
  homeKind(v) {
    return homeKind(v);
  }
  /** → construction.fireLevel */
  fireLevel() {
    return fireLevel(this);
  }
  /** → construction.fireUpgradeBlock */
  fireUpgradeBlock(level) {
    return fireUpgradeBlock(this, level);
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
  /** → inventory.equipGear */
  equipGear(v) {
    return equipGear(this, v);
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
  makeVillager(x, y, sex, team, rnd2 = this.rnd) {
    return makeVillager(this, x, y, sex, team, rnd2);
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
  /** → construction.buildingNeeds */
  buildingNeeds(kind) {
    return buildingNeeds(this, kind);
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
  /** Dev: building, upgrading and repairing cost nothing (the free-builds switch, or the free-works one). */
  freeCost() {
    return this.dev.freeBuild || this.dev.freeWorks;
  }
  /** → construction.canRepair */
  canRepair(b) {
    return canRepair(this, b);
  }
  /** → construction.repairCost */
  repairCost(b) {
    return repairCost(this, b);
  }
  /** → construction.repairBuilding */
  repairBuilding(id) {
    return repairBuilding(this, id);
  }
  /** → construction.afterUpgrade */
  afterUpgrade(b) {
    return afterUpgrade(this, b);
  }
  /** → construction.setEra */
  setEra(era) {
    return setEra(this, era);
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
  /** → construction.groupPlan */
  groupPlan(ids2, to, rot) {
    return groupPlan(this, ids2, to, rot);
  }
  /** → construction.canMoveGroup */
  canMoveGroup(ids2, to, rot) {
    return canMoveGroup(this, ids2, to, rot);
  }
  /** → construction.moveGroup */
  moveGroup(ids2, to, rot) {
    return moveGroup(this, ids2, to, rot);
  }
  /** → construction.moveBuilding */
  moveBuilding(id, x, y) {
    return moveBuilding(this, id, x, y);
  }
  /** → works.orderDef */
  orderDef(kind, id) {
    return orderDef(this, kind, id);
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
  /** → construction.buildWhy */
  buildWhy(b) {
    return buildWhy(this, b);
  }
  /** → works.discardGoods */
  discardGoods(id, all) {
    return discardGoods(this, id, all);
  }
  /** → works.craftStoreBlock */
  craftStoreBlock(id) {
    return craftStoreBlock(this, id);
  }
  /** → works.queueCraft */
  queueCraft(id) {
    return queueCraft(this, id);
  }
  /** → works.craftCost */
  craftCost(id) {
    return craftCost(this, id);
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
  /** → tribes.summonAllies */
  summonAllies(target) {
    return summonAllies(this, target);
  }
  /** → tribes.dismissAllies */
  dismissAllies() {
    return dismissAllies(this);
  }
  /** A person is gone from the village without a trace (an ally who has left): not a death. */
  vanish(v) {
    this.leaveNode(v);
    this.exitBuilding(v);
    this.leaveSquad([v.id]);
    const i = this.villagers.indexOf(v);
    if (i >= 0) this.villagers.splice(i, 1);
    this.byId.delete(v.id);
    this.fogDirty = true;
  }
  /** → environment.settle */
  settle(n, room = false) {
    return settle(this, n, room);
  }
  /** → environment.toggleNewcomers */
  toggleNewcomers() {
    return toggleNewcomers(this);
  }
  /** → defense.toggleGate */
  toggleGate(id) {
    return toggleGate(this, id);
  }
  /** → defense.setGates */
  setGates(open2) {
    return setGates2(this, open2);
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
  assignTower(ids2, towerId) {
    return assignTower(this, ids2, towerId);
  }
  /** → defense.leaveTower */
  leaveTower(ids2) {
    return leaveTower(this, ids2);
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
  assignField(ids2, fieldId) {
    return assignField(this, ids2, fieldId);
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
  assignCrew(ids2) {
    return assignCrew(this, ids2);
  }
  /** → houses.trimCrew */
  trimCrew() {
    return trimCrew(this);
  }
  /** → houses.releaseCrew */
  releaseCrew(ids2) {
    return releaseCrew(this, ids2);
  }
  /** → houses.assignStaff */
  assignStaff(ids2, job) {
    return assignStaff(this, ids2, job);
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
  releaseStaff(ids2) {
    return releaseStaff(this, ids2);
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
  assignTool(ids2, k, tier) {
    return assignTool(this, ids2, k, tier);
  }
  /** → inventory.discardTool */
  discardTool(ids2, k) {
    return discardTool(this, ids2, k);
  }
  /** → economy.foodNeed */
  foodNeed() {
    return foodNeed(this);
  }
  /** → readiness.upgradeAdvice */
  upgradeAdvice(level) {
    return upgradeAdvice(this, level, (e) => eventName(this, e));
  }
  /** → notices.noticesOf */
  notices() {
    return noticesOf(this);
  }
  /** → economy.noteYield */
  noteYield(key, n) {
    return noteYield(this, key, n);
  }
  /** → economy.warNeed */
  warNeed() {
    return warNeed(this);
  }
  /** → economy.armyNeed */
  armyNeed() {
    return armyNeed(this);
  }
  /** → economy.eatDay */
  eatDay() {
    return eatDay(this);
  }
  /** → economy.deposit */
  deposit(res, amount) {
    return deposit(this, res, amount);
  }
  /** → economy.hasRoom */
  hasRoom(res) {
    return hasRoom(this, res);
  }
  /** → economy.dailyYield */
  dailyYield(b) {
    return dailyYield(this, b);
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
  mine(ids2) {
    return mine(this, ids2);
  }
  /** → commands.orderMove */
  orderMove(ids2, tx, ty, queue = false) {
    return orderMove(this, ids2, tx, ty, queue);
  }
  /** → commands.callWorker */
  callWorker(tx, ty) {
    return callWorker(this, tx, ty);
  }
  /** → commands.orderWork */
  orderWork(ids2, tx, ty) {
    return orderWork(this, ids2, tx, ty);
  }
  /** → commands.recallFar */
  recallFar() {
    return recallFar(this);
  }
  /** → commands.autoHunter */
  autoHunter(ids2, target) {
    return autoHunter(this, ids2, target);
  }
  /** → commands.setJob */
  setJob(ids2, job) {
    return setJob(this, ids2, job);
  }
  /** → commands.enlist */
  enlist(ids2) {
    return enlist(this, ids2);
  }
  /** → commands.discharge */
  discharge(ids2) {
    return discharge(this, ids2);
  }
  /** → commands.isOut */
  isOut(v) {
    return isOut(v);
  }
  /** → commands.callOut */
  callOut(ids2) {
    return callOut(this, ids2);
  }
  /** → commands.sendBack */
  sendBack(ids2) {
    return sendBack(this, ids2);
  }
  /** → commands.targetAt */
  targetAt(x, y) {
    return targetAt(this, x, y);
  }
  /** → commands.orderAttack */
  orderAttack(ids2, target, queue = false) {
    return orderAttack(this, ids2, target, queue);
  }
  /** → commands.orderAttackMove */
  orderAttackMove(ids2, x, y, queue = false) {
    return orderAttackMove(this, ids2, x, y, queue);
  }
  /** → commands.orderLoot */
  orderLoot(ids2, animalId) {
    return orderLoot(this, ids2, animalId);
  }
  /** → commands.orderHold */
  orderHold(ids2) {
    return orderHold(this, ids2);
  }
  /** → commands.orderStop */
  orderStop(ids2) {
    return orderStop(this, ids2);
  }
  /** → commands.setStance */
  setStance(ids2, stance) {
    return setStance(this, ids2, stance);
  }
  /** → commands.nextOrder */
  nextOrder(v) {
    return nextOrder(this, v);
  }
  /** → brainplayer.startFlee */
  startFlee(v, secs, from) {
    startFlee(this, v, secs, from);
  }
  /** → brainplayer.endOrder */
  endOrder(v) {
    endOrder(this, v);
  }
  /** → inventory.giveGear */
  giveGear(ids2, kind, slot) {
    return giveGear(this, ids2, kind, slot);
  }
  /** → inventory.assignGear */
  assignGear(ids2, kind, slot) {
    return assignGear(this, ids2, kind, slot);
  }
  /** → inventory.autoGear */
  autoGear(ids2) {
    return autoGear(this, ids2);
  }
  /** → inventory.giveTool */
  giveTool(ids2, kind, tier) {
    return giveTool(this, ids2, kind, tier);
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
  advance(dt, outOfTime) {
    if (this.speed <= 0) return;
    this.acc += Math.min(dt, 0.25) * this.speed;
    let guard = 0;
    while (this.acc >= TICK && guard++ < 400) {
      this.acc -= TICK;
      this.tick(TICK);
      if (outOfTime?.()) {
        this.acc = Math.min(this.acc, TICK);
        break;
      }
    }
  }
  tick(dt) {
    this.time += dt;
    this.pathLeft = this.speed >= 8 ? Math.ceil(PATH_BUDGET / 2) : PATH_BUDGET;
    this.tickCalendar();
    this.world.tick(dt);
    this.streamWorld(dt);
    feedPot(this);
    trackFood(this);
    if (warPlan(this)) {
      if (this.warSince < 0) this.warSince = this.time;
      this.tickWar(dt);
      if (this.visionRadius() !== this.lastVision) this.fogDirty = true;
      if (this.fogDirty) {
        this.fogDirty = false;
        this.refreshFog();
      }
      return;
    }
    if (this.warSince >= 0) {
      settle2(this);
      finish(this, this.warMeals);
      clearHarass(this);
      eatWar(this, (this.time - this.warSince) / this.dayLen);
      this.warSince = -1;
      restoreWarAnimals(this);
      this.sendBack([...this.warIds]);
      this.warIds = /* @__PURE__ */ new Set();
      cleanup(this);
      for (const v of this.villagers) if (v.inTent) {
        v.inTent = false;
        if (v.inside === null) {
          v.phase = "idle";
          v.path = [];
          v.slide = null;
          v.bed = -1;
        }
      }
      this.march = PEACE;
      this.warMeals = 0;
    }
    tickAnimals(this, dt);
    tickProjectiles(this, dt);
    for (const v of [...this.villagers]) this.tickVillager(v, dt);
    this.tickWorks(dt);
    this.tickTame(dt);
    this.tickFarms(dt);
    this.tickTowers(dt);
    this.tickTraps(dt);
    tickTraining(this, dt);
    tickBattle(this, dt);
    tickScouts(this, dt);
    tickPlans(this, dt);
    this.pathLeft = Math.max(this.pathLeft, FOE_PATH_SHARE);
    for (const f of [...this.foes]) tickFoe(this, f, dt);
    tickTribes(this, dt);
    this.leaderClock += dt;
    if (this.leaderClock >= 1) {
      this.leaderClock = 0;
      this.pickLeaders();
      bootCrew(this);
      tickResearch(this);
      restock2(this);
      fitScouts(this);
    }
    if (this.visionRadius() !== this.lastVision) this.fogDirty = true;
    if (this.fogDirty) {
      this.fogDirty = false;
      this.refreshFog();
    }
  }
  /** Make the land round the people as they walk out: twice a second, every villager out on the map has the land within STREAM_REACH made (see World.ensure). */
  streamWorld(dt) {
    this.streamClock -= dt;
    if (this.streamClock > 0) return;
    this.streamClock = 0.5;
    for (const v of this.villagers) if (v.inside === null) this.world.ensure(v.x, v.y, STREAM_REACH);
  }
  /** → environment.tickCalendar */
  tickCalendar() {
    return tickCalendar(this);
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
    noteDeath(this, v.id, v.job === "supply", armOf(v));
    if (v.job === "scout") this.noteScoutLoss(v, cause);
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
    v.leader = false;
    v.fleeT = 0;
    this.clearCombat(v);
    v.health = Math.max(v.health, v.maxHealth * 0.6);
    this.villagers.push(v);
    this.fogDirty = true;
  }
  /** -> tribes.resetTribes */
  resetTribes() {
    return resetTribes(this);
  }
  /** Diplomacy buttons: 'gift', 'tribute', 'adopt'. Returns an error text or null. */
  diplomacy(id, action) {
    return action === "gift" ? giftTribe(this, id) : action === "tribute" ? tributeTribe(this, id) : action === "tributeUp" ? setTribute(this, id, 1) : action === "tributeDown" ? setTribute(this, id, -1) : adoptTribe(this, id);
  }
  // ---------------------------------------------------------------- combat helpers
  hurt(target, dmg, type, from, src) {
    hurt(this, target, dmg, type, from, src);
  }
  tribeHostile(id) {
    return tribeHostile(this, id);
  }
  /** → tribes.tribeWilling */
  tribeWilling(id) {
    return tribeWilling(this, id);
  }
  /** → tribes.tribesFeud */
  tribesFeud(a, b) {
    return tribesFeud(this, a, b);
  }
  tribeAttacked(id, victim) {
    tribeAttacked(this, id, victim);
  }
  killFoe(v, killer) {
    killFoe(this, v, killer);
  }
  /** The player's own campfire (the village centre). */
  /** → quests.questViews */
  quests(ui) {
    return questViews(this, ui);
  }
  campfire() {
    return this.buildings.find((b) => b.kind === "campfire" && b.done);
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
  routeTo(v, tiles, tries = 3, maxNodes = 14e3) {
    return routeTo(this, v, tiles, tries, maxNodes);
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

// src/sim/dev.ts
function discoverTribe(sim2, id) {
  const t = sim2.tribes.find((x) => x.id === id);
  if (!t) return "Kh\xF4ng c\xF3 l\xE0ng n\xE0y";
  sim2.world.ensure(t.camp.x, t.camp.y, 30);
  const s = sim2.sightings.find((x) => x.tribe === id);
  if (s) s.reported = true;
  else sim2.sightings.push({ tribe: id, by: -1, at: sim2.time, reported: true });
  for (let level = 1; level <= 3; level++) {
    const map = { tribe: id, level, at: sim2.time, gaps: 0, seen: level >= 2 ? seenNow(sim2, t) : void 0 }, old = sim2.maps.findIndex((m) => m.tribe === id && m.level === level);
    if (old >= 0) sim2.maps[old] = map;
    else sim2.maps.push(map);
  }
  return `\u0110\xE3 ph\xE1t hi\u1EC7n ${t.def.name}: m\u1EDF L\u1EC1u h\u1ECDp chi\u1EBFn \u0111\u1EC3 \u0111\xE1nh`;
}

// tools/bot.ts
var seed = +(process.argv[2] ?? 1);
var DAYS = +(process.argv[3] ?? 20);
var POLICY = process.env.POLICY ?? "mix";
var EFF = +(process.env.EFF ?? 1);
var ECO = /* @__PURE__ */ new Set(["wood", "stone", "food", "hunt", "builder", "lab", "craft", "workshop", "research", "gather", "farm"]);
var sim = new Sim(seed);
var TICK2 = 0.05;
var STEP = Math.round(5 / EFF / TICK2);
if (!process.env.EVENTS) {
  sim.events.length = 0;
  sim.nextRaid = 1e9;
}
var kinds = Object.keys(BUILDINGS);
var fire = () => sim.campfire();
var open = (k) => BUILDINGS[k].buildable && fireUnlockLevel(k) <= fire().level && !eraLocked(k, sim);
var count = (k) => sim.buildings.filter((b) => b.kind === k).length;
var costOf = (k, level) => levelDef({ kind: k, level: 1, era: "stone" }, level).cost;
var rnd = () => sim.rnd();
function spot(k) {
  const f = fire(), cx = Math.floor(f.x + 1), cy = Math.floor(f.y + 1);
  for (let r = 4; r <= 24; r++) for (let dx = -r; dx <= r; dx++) {
    const ys = Math.abs(dx) === r ? Array.from({ length: 2 * r + 1 }, (_, i) => i - r) : [-r, r];
    for (const dy of ys) if (sim.canPlace(k, cx + dx, cy + dy) === null) return [cx + dx, cy + dy];
  }
  return null;
}
function fireNeeds() {
  const groups = fireUpgradeGroups(fire().level), out = [];
  for (const k of kinds) {
    const d = BUILDINGS[k], at = groups[d.group];
    if (d.buildable && !eraLocked(k, sim) && at !== void 0) out.push({ kind: k, level: Math.min(at, BUILDINGS[k].levels.stone.length) });
  }
  return out;
}
var PRIO = ["builder", "farmhouse", "lumberyard", "guardpost", "huntlodge", "storage", "quarry", "workshop", "toolstore", "lab", "house", "armory", "infantry", "archery", "cavalry"];
var prio = (k) => {
  const i = PRIO.indexOf(k);
  return i < 0 ? 99 : i;
};
var barterLog = 0;
function projects() {
  if (sim.stock.coin < 40) {
    for (const [r, keep] of [["stone", 250], ["hide", 120], ["wood", 400], ["food", 600]]) if (sim.stock[r] > keep && !sim.barter(r)) {
      barterLog++;
      break;
    }
  }
  const f = fire(), needs = fireNeeds().sort((a, b) => prio(a.kind) - prio(b.kind));
  const busy2 = () => sim.buildings.filter((b) => !b.done || b.upgrading).length;
  const slots = () => Math.max(1, sim.crew().length);
  let met = true;
  for (const n of needs) {
    const mine2 = sim.buildings.filter((b) => b.kind === n.kind);
    if (!mine2.length) {
      met = false;
      if (busy2() < slots() + 1 && open(n.kind) && !sim.missing(costOf(n.kind, 1))) {
        const s = spot(n.kind);
        if (s) sim.placeBuilding(n.kind, s[0], s[1]);
      }
      continue;
    }
    for (const b of mine2) if (!b.done || b.upgrading || b.level < n.level) {
      met = false;
      if (b.done && !b.upgrading && b.level < n.level && busy2() < slots() + 1 && sim.canUpgrade(b) === null) sim.upgradeBuilding(b.id);
    }
  }
  if (met) {
    const err = sim.canUpgrade(f);
    if (err === null) {
      sim.upgradeBuilding(f.id);
      console.error("day", sim.day, "fire ->", f.level + 1);
      return;
    }
    const need = costOf("campfire", f.level + 1);
    if ((need.coin ?? 0) > sim.stock.coin) for (const r of ["stone", "hide", "bone", "wood", "food"]) {
      const keep = need[r] ?? 0;
      if (sim.stock[r] - keep > 10) {
        const e = sim.barter(r);
        if (!e) barterLog++;
        break;
      }
    }
  }
  if (!met || sim.stock.wood > 200) for (const b of [...sim.buildings].sort((a, c) => prio(a.kind) - prio(c.kind))) {
    if (busy2() >= slots() + 1) break;
    if (b.kind === "campfire" || !b.done || b.upgrading) continue;
    if (!["lumberyard", "farmhouse", "huntlodge", "quarry", "builder", "storage", "workshop", "lab"].includes(b.kind)) continue;
    if (sim.canUpgrade(b) === null && !sim.upgradeBuilding(b.id)) break;
  }
  const KEEP = ["guardpost", "storage", "armory", "workshop", "toolstore", "lab", "house", "infantry", "archery", "cavalry"];
  for (const k of KEEP) if (open(k) && count(k) < sim.buildingLimit(k) && busy2() < slots() + 1 && !sim.missing(costOf(k, 1))) {
    const sp = spot(k);
    if (sp) sim.placeBuilding(k, sp[0], sp[1]);
  }
  if (sim.stock.wood > 400 && sim.stock.stone > 250) for (const b of sim.buildings) {
    if (busy2() >= slots() + 1) break;
    if (!KEEP.includes(b.kind) || !b.done || b.upgrading || b.level >= fire().level) continue;
    if (sim.canUpgrade(b) === null && !sim.upgradeBuilding(b.id)) break;
  }
  for (const k of ["lumberyard", "farmhouse", "huntlodge", "storage", "quarry"]) if (open(k) && count(k) < sim.buildingLimit(k) && busy2() < slots() + 1 && !sim.missing(costOf(k, 1))) {
    const s = spot(k);
    if (s) sim.placeBuilding(k, s[0], s[1]);
  }
}
function share2() {
  const pop = sim.villagers.length, food = sim.stock.food + sim.foodPot, cap = sim.capacity();
  const hungry = food < pop * 5;
  const woodShort = sim.stock.wood < 150 && sim.stock.wood < cap * 0.6;
  return { food: hungry ? 3 : 1.4, hunt: sim.stock.hide < 80 ? 2.2 : 0.8, wood: woodShort ? 2.2 : 1.2, stone: sim.stock.stone > 120 ? 0 : 0.6 };
}
function staff() {
  const idle2 = sim.villagers.filter((v) => v.job === "idle" && roleOf(v) === null && !v.inside && v.health > 0);
  const want = share2();
  for (const v of idle2) {
    if (EFF < 1 && rnd() > EFF) continue;
    const cnt = (r) => sim.villagers.filter((o) => roleOf(o) === r).length;
    if (sim.building("builder")?.done && sim.crew().length < 3 && !sim.assignCrew([v.id])) continue;
    if (sim.building("lab")?.done && sim.assignStaff([v.id], "research") === null) continue;
    if (sim.building("workshop")?.done && sim.assignStaff([v.id], "craft") === null) continue;
    const order = ["food", "hunt", "wood", "stone"].filter((r) => (want[r] ?? 0) > 0).sort((a, b) => cnt(a) / want[a] - cnt(b) / want[b]);
    let placed = false;
    for (const r of order) if (!sim.assignRole([v.id], r)) {
      placed = true;
      break;
    }
    if (placed) continue;
    for (const r of ["guard", "foot", "archer", "cavalry"]) if (!sim.assignRole([v.id], r)) break;
  }
}
var TOOL_JOBS = { axe1: ["wood"], pick1: ["stone"], hoe1: ["food"], hammer1: [] };
function craft() {
  const w = sim.building("workshop");
  if (!w?.done || sim.craftQueue.length >= 2) return;
  for (const id of ["axe1", "pick1", "hoe1", "hammer1", "torch1"]) {
    const have2 = (sim.toolStock[id] ?? 0) + sim.wornTools.filter((t) => t.id === id).length;
    const need = id === "hammer1" ? Math.min(3, sim.crew().length) : id === "torch1" ? 4 : (TOOL_JOBS[id] ?? []).reduce((n, r) => n + sim.villagers.filter((o) => roleOf(o) === r).length, 0);
    const held = sim.villagers.filter((o) => o.tools && false).length;
    if (have2 + held < need && !sim.queueCraft(id)) return;
  }
}
function gear() {
  if (!process.env.WAR || !sim.building("armory")?.done || !sim.building("workshop")?.done || sim.craftQueue.length >= 3) return;
  const soldiers = sim.villagers.filter((v) => v.job === "fight").length;
  for (const id of ["spear1", "sling1", "club1", "bow1", "hide1"]) {
    if ((sim.toolStock[id] ?? 0) + sim.villagers.filter((v) => v.weapon?.startsWith?.(id.slice(0, -1)) || v.armor === id.slice(0, -1)).length >= Math.ceil(soldiers / 3) + 2) continue;
    if (!sim.queueCraft(id)) return;
  }
}
var rdone = { n: 0, secs: 0 };
function research() {
  const lab = sim.building("lab");
  if (!lab?.done || lab.active?.id || sim.researchQueue[0]) return;
  let best = null, bestScore = Infinity;
  for (const t of Object.values(TECH_BY_ID)) {
    if (techState(sim, t).state !== "ready" || /^(signal|form|plan)/.test(t.id)) continue;
    const eco = ECO.has(t.id.split("_")[0]);
    const want = POLICY === "eco" ? eco : POLICY === "mil" ? !eco : sim.day % 2 === 0 ? eco : !eco;
    const score = t.time + (want ? 0 : 1e5) - (/_gyield_/.test(t.id) ? 1e6 : 0);
    if (score < bestScore && !sim.missing(t.cost)) {
      bestScore = score;
      best = t;
    }
  }
  if (best && !sim.queueResearch(best.id)) {
    rdone.n++;
    rdone.secs += best.time;
  }
}
var warLog = { sent: 0, won: 0, called: 0, adopted: 0, tributes: 0, allies: 0, bossSent: 0, bossResult: "", loot: {} };
var lostAt = {};
var warTarget = null;
var bossId = "";
var counted = /* @__PURE__ */ new Set();
function wars() {
  if (!process.env.WAR) return;
  for (const p of sim.plans) if (p.kind === "attack" && p.status === "running") {
    const t2 = sim.tribes.find((q) => q.id === p.tribe);
    if ((p.stage === "over" || t2 && t2.state !== "free") && p.stage !== "recall" && p.stage !== "retreat") {
      if ((p.result === "won" || t2 && t2.state !== "free") && !counted.has(p.id)) {
        counted.add(p.id);
        warLog.won++;
        for (const [r, n] of Object.entries(p.stats?.loot ?? {})) warLog.loot[r] = (warLog.loot[r] ?? 0) + n;
      }
      sim.withdrawPlan(p);
    }
  }
  for (const p of sim.plans) if (p.kind === "attack" && p.status === "running" && p.stage === "fight" && sim.time - (p.startedAt ?? sim.time) > 900 && !counted.has(-p.id)) {
    counted.add(-p.id);
    warLog.called++;
    sim.withdrawPlan(p);
  }
  if (sim.plans.some((p) => p.kind === "attack" && p.status === "running")) return;
  for (const t2 of sim.tribes) if (t2.state === "surrendered") {
    if (t2.tier === "weak") {
      if (!sim.diplomacy(t2.id, "adopt")) warLog.adopted++;
    } else if (!sim.diplomacy(t2.id, "tribute")) warLog.tributes++;
  }
  if (warTarget === "boss-run") {
    const b = sim.tribes.find((q) => q.id === bossId);
    warLog.bossResult = !b ? "gone" : b.state === "free" ? "lost" : "won";
    warTarget = null;
  }
  if (warTarget && warTarget !== "boss-run") {
    const q = sim.tribes.find((x) => x.id === warTarget);
    if (q && q.state === "free") lostAt[q.id] = sim.day;
  }
  warTarget = null;
  const mine2 = sim.power();
  if (mine2.soldiers < 20 || sim.restTime || sim.attackReason()) return;
  const boss = sim.tribes.find((q) => q.boss && q.state === "free" && !q.rebel);
  const ready = sim.villagers.filter((v) => v.job === "fight" && !v.guard && v.post < 0 && !v.ally).length;
  const need = { weak: 8, normal: 20, medium: 38 };
  const cands = sim.tribes.filter((t2) => t2.state === "free" && !t2.boss && ready >= (need[t2.tier] ?? 99) && sim.day - (lostAt[t2.id] ?? -99) >= 6).sort((a, b) => a.campLevel - b.campLevel);
  const t = !cands.length && boss && fire().level >= 4 && ready >= 85 && !warLog.bossResult.startsWith("lost") ? boss : cands[0];
  if (!t) return;
  discoverTribe(sim, t.id);
  if (!sim.quickAttack(t.id)) {
    warLog.sent++;
    warLog.allies += sim.villagers.filter((v) => v.ally).length;
    warTarget = t.id;
    if (t.boss) {
      warLog.bossSent++;
      bossId = t.id;
      warTarget = "boss-run";
    }
  }
}
var ids = new Set(sim.villagers.map((v) => v.id));
var born = 0;
var died = 0;
var inc = 0;
var prevTot = sim.stock.food + sim.foodPot;
var dayStartFood = prevTot;
var milestones = {};
var t0 = Date.now();
for (let i = 0, last = sim.day; sim.day <= DAYS; i++) {
  sim.tick(TICK2);
  {
    const tot = sim.stock.food + sim.foodPot;
    if (tot > prevTot) inc += tot - prevTot;
    prevTot = tot;
  }
  if (i % STEP === 0) {
    projects();
    staff();
    craft();
    research();
    gear();
    wars();
  }
  for (const v of sim.villagers) if (!ids.has(v.id)) {
    ids.add(v.id);
    born++;
  }
  const fl = fire().level;
  if (!milestones["fire" + fl]) milestones["fire" + fl] = sim.day;
  if (sim.day !== last) {
    const now = new Set(sim.villagers.map((v) => v.id));
    for (const id of [...ids]) if (!now.has(id)) {
      died++;
      ids.delete(id);
    }
    const roles = {};
    for (const v of sim.villagers) {
      const r = roleOf(v) ?? v.job;
      roles[r] = (roles[r] ?? 0) + 1;
    }
    const nowF = sim.stock.food + sim.foodPot, eat2 = inc - (nowF - dayStartFood), rec = { inc: Math.round(inc), eat: Math.round(eat2) };
    inc = 0;
    dayStartFood = nowF;
    console.log(JSON.stringify({ day: last, ...rec, season: sim.season, pop: sim.villagers.length, born, died, fire: fl, food: Math.round(nowF), wood: Math.round(sim.stock.wood), stone: Math.round(sim.stock.stone), hide: Math.round(sim.stock.hide), coin: sim.stock.coin, roles, res: sim.researched.size, rq: rdone.n, war: { ...warLog }, tribute: sim.tribes.filter((t) => t.state === "tribute").length, rel: sim.tribes.map((t) => t.id + ":" + Math.round(t.relation)).join(" "), boss: sim.tribes.map((t) => t.id + ":" + t.state + (t.boss ? "B" : "") + t.campLevel).join(" "), rdays: +(rdone.secs / 240).toFixed(1), why: sim.canUpgrade(fire()), sec: Math.round((Date.now() - t0) / 1e3) }));
    last = sim.day;
  }
}
console.log("MILESTONES " + JSON.stringify(milestones) + " barter " + barterLog + " war " + JSON.stringify(warLog));
