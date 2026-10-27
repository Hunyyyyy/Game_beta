"use strict";

// src/data/seasons.json
var seasons_default = {
  spring: { name: "Xu\xE2n", daylight: 0.5, gather: 0.8, enter: "M\xF9a xu\xE2n \u0111\u1EBFn: b\u1EE5i c\xE2y ra hoa, v\xE0i h\xF4m n\u1EEFa s\u1EBD c\xF3 qu\u1EA3. Hay m\u01B0a." },
  summer: { name: "H\u1EA1", daylight: 0.6, gather: 1.2, enter: "M\xF9a h\u1EA1: ng\xE0y d\xE0i h\u01A1n, qu\u1EA3 ch\xEDn nhi\u1EC1u. Coi ch\u1EEBng gi\xF4ng s\xE9t." },
  autumn: { name: "Thu", daylight: 0.5, gather: 1.4, enter: "M\xF9a thu: qu\u1EA3 nhi\u1EC1u nh\u1EA5t n\u0103m. M\xF9a \u0111\xF4ng s\u1EAFp t\u1EDBi, h\xE3y chu\u1EA9n b\u1ECB." },
  winter: { name: "\u0110\xF4ng", daylight: 0.4, gather: 0, enter: "M\xF9a \u0111\xF4ng: b\u1EE5i qu\u1EA3 tr\u1EE5i h\u1EBFt, ng\xE0y ng\u1EAFn l\u1EA1i. S\u1ED1ng b\u1EB1ng th\u1EE9c \u0103n \u0111\xE3 t\xEDch tr\u1EEF." }
};

// src/data/weather.json
var weather_default = {
  types: {
    clear: { name: "N\u1EAFng", vision: 0, speed: 1, signal: "" },
    mist: { name: "S\u01B0\u01A1ng m\u1ECFng", vision: 2, speed: 1, signal: "H\u01A1i n\u01B0\u1EDBc b\u1ED1c l\xEAn t\u1EEB \u0111\u1EA5t, s\xE1ng mai c\xF3 l\u1EBD s\u1EBD c\xF3 s\u01B0\u01A1ng." },
    drizzle: { name: "M\u01B0a nh\u1EB9", vision: 0, speed: 0.9, signal: "M\xE2y x\xE1m k\xE9o t\u1EDBi, c\xF3 l\u1EBD ng\xE0y mai m\u01B0a." },
    rain: { name: "M\u01B0a to", vision: 1, speed: 0.75, signal: "Tr\u1EDDi t\u1ED1i s\u1EA7m, gi\xF3 \u1EA9m n\u1ED5i l\xEAn: ng\xE0y mai m\u01B0a to." },
    thunder: { name: "Gi\xF4ng s\xE9t", vision: 3, speed: 0.85, signal: "Kh\xF4ng kh\xED oi n\u1ED3ng, m\xE2y d\u1EF1ng th\xE0nh th\xE1p: s\u1EAFp c\xF3 gi\xF4ng." },
    storm: { name: "B\xE3o", vision: 4, speed: 0.7, signal: "Gi\xF3 gi\u1EADt m\u1EA1nh, chim bay t\xE1n lo\u1EA1n: b\xE3o \u0111ang t\u1EDBi." },
    snow: { name: "Tuy\u1EBFt", vision: 1, speed: 0.75, signal: "Gi\xF3 l\u1EA1nh bu\u1ED1t th\u1ED5i v\u1EC1, c\xF3 l\u1EBD s\u1EAFp c\xF3 tuy\u1EBFt." }
  },
  chance: {
    spring: { clear: 0.45, mist: 0.15, drizzle: 0.25, rain: 0.15 },
    summer: { clear: 0.6, rain: 0.15, thunder: 0.15, storm: 0.1 },
    autumn: { clear: 0.45, mist: 0.2, drizzle: 0.2, storm: 0.15 },
    winter: { clear: 0.5, mist: 0.1, snow: 0.4 }
  }
};

// src/sim/constants.ts
var MAP_SIZE = 192;
var VISION = 7;
var NIGHT_VISION = 3;
var FIRE_VISION = 8;
var TICK = 1 / 20;
var DAY_LENGTH = 240;
var START_TIME = DAY_LENGTH * 0.25;

// src/sim/calendar.ts
var SEASONS = ["spring", "summer", "autumn", "winter"];
var SEASON_DAYS = 5;
var YEAR_DAYS = SEASON_DAYS * SEASONS.length;
var SEASON_DEF = seasons_default;
var WEATHER = weather_default.types;
var CHANCE = weather_default.chance;
var TWILIGHT = 0.125;
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
var BUILDINGS = {
  campfire: { kind: "campfire", name: "Nh\xE0 chung (\u0111\u1ED1ng l\u1EEDa tr\u1EA1i)", w: 2, h: 2, cost: {}, buildTime: 0, cap: 50, buildable: false },
  workshop: { kind: "workshop", name: "X\u01B0\u1EDFng ch\u1EBF t\xE1c", w: 2, h: 2, cost: { wood: 15 }, buildTime: 30, cap: 0, buildable: true },
  storage: { kind: "storage", name: "Kho", w: 2, h: 2, cost: { wood: 10 }, buildTime: 20, cap: 100, buildable: true }
};

// src/sim/fog.ts
var Fog = class {
  constructor(world) {
    this.world = world;
    this.version = 0;
    this.state = new Uint8Array(world.size * world.size);
  }
  /** Each source has its own sight radius `r` (tiles). */
  update(sources) {
    const N = this.world.size, s2 = this.state;
    for (let i = 0; i < s2.length; i++) if (s2[i] === 2) s2[i] = 1;
    for (const p of sources) {
      const cx = Math.floor(p.x), cy = Math.floor(p.y), radius = p.r, r2 = radius * radius + 0.5;
      for (let y = Math.max(0, cy - radius); y <= Math.min(N - 1, cy + radius); y++) {
        for (let x = Math.max(0, cx - radius); x <= Math.min(N - 1, cx + radius); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) s2[y * N + x] = 2;
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

// src/sim/jobs.ts
var JOBS = {
  wood: { name: "\u0110\u1ED1n g\u1ED7", stat: "str", res: "wood", node: "tree", baseTime: 12, anim: "chop" },
  stone: { name: "Th\u1EE3 \u0111\xE1", stat: "str", res: "stone", node: "rock", baseTime: 18, anim: "mine" },
  food: { name: "H\xE1i l\u01B0\u1EE3m", stat: "agi", res: "food", node: "bush", baseTime: 20, anim: "gather" },
  build: { name: "Th\u1EE3 x\xE2y", stat: "sta", baseTime: 1, anim: "build" },
  craft: { name: "Th\u1EE3 th\u1EE7 c\xF4ng", stat: "int", baseTime: 1, anim: "craft" }
};
var JOB_NAME = { idle: "R\u1EA3nh", wood: "\u0110\u1ED1n g\u1ED7", stone: "Th\u1EE3 \u0111\xE1", food: "H\xE1i l\u01B0\u1EE3m", build: "Th\u1EE3 x\xE2y", craft: "Th\u1EE3 th\u1EE7 c\xF4ng" };
var WORK_JOBS = ["wood", "stone", "food", "build", "craft"];
var XP_LEVELS = [60, 150, 300, 500, 800];
var MAX_LEVEL = 5;

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

// src/sim/resources.ts
var RES_NAME = { wood: "G\u1ED7", stone: "\u0110\xE1", food: "Th\u1EE9c \u0103n" };
var emptyStock = () => ({ wood: 0, stone: 0, food: 0 });
var CARRY_CAP = { wood: 4, stone: 4, food: 10 };
var FOOD_NUTRITION = 25;
var FOOD_SPOIL_DAYS = 3;

// src/sim/rng.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
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

// src/sim/tools.ts
var TOOL_NAME = { axe: "R\xECu", pick: "Cu\u1ED1c chim", hoe: "Cu\u1ED1c", hammer: "B\xFAa" };
var TOOL_OF_JOB = { wood: "axe", stone: "pick", food: "hoe", build: "hammer" };
var TIER_NAME = ["Tay kh\xF4ng", "G\u1ED7", "\u0110\xE1"];
var TIER_SPEED = [0.6, 1, 1.4];
var TIER_YIELD = [1, 1.25, 1.6];
var TIER_DURABILITY = [0, 240, 600];
var R = (kind, tier, cost, time) => ({ id: `${kind}${tier}`, kind, tier, cost, time });
var RECIPES = [
  R("axe", 1, { wood: 3 }, 12),
  R("axe", 2, { wood: 2, stone: 3 }, 20),
  R("pick", 1, { wood: 4 }, 14),
  R("pick", 2, { wood: 2, stone: 4 }, 22),
  R("hoe", 1, { wood: 3 }, 12),
  R("hoe", 2, { wood: 2, stone: 2 }, 18),
  R("hammer", 1, { wood: 3 }, 12),
  R("hammer", 2, { wood: 2, stone: 3 }, 18)
];
var RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
var recipeName = (r) => `${TOOL_NAME[r.kind]} ${TIER_NAME[r.tier].toLowerCase()}`;
var emptyToolSet = () => ({ axe: null, pick: null, hoe: null, hammer: null });

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

// src/sim/sim.ts
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
var Sim = class {
  constructor(seed = 1337) {
    this.seed = seed;
    this.villagers = [];
    this.buildings = [];
    this.stock = emptyStock();
    /** Công cụ đã chế, đang chờ dân tới Xưởng lấy. Khóa dạng "axe1". */
    this.toolStock = {};
    /** Hàng đợi chế tác (mã công thức). */
    this.craftQueue = [];
    this.log = [];
    /** Hệ số tốc độ: 0 = tạm dừng. */
    this.speed = 1;
    /** Giây game đã trôi qua. */
    this.time = START_TIME;
    this.byId = /* @__PURE__ */ new Map();
    this.acc = 0;
    this.fogDirty = true;
    this.nextVid = 1;
    this.nextBid = 1;
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
    this.wrnd = mulberry32(seed ^ 1540483477);
    this.world.setSeason(this.season);
    this.nextWeather = rollWeather(seasonOf(this.day + 1), this.wrnd());
    this.resting = isRestTime(this.tod, this.season);
    const s2 = this.world.start;
    this.addBuilding("campfire", s2.x - 1, s2.y - 2, true);
    this.stock.food = 24;
    const spots = [[-1, 1, "m"], [1, 1, "f"], [0, 2, "m"]];
    for (const [dx, dy, sex] of spots) this.spawn(s2.x + dx, s2.y + dy, sex);
    this.say("Ba ng\u01B0\u1EDDi \u0111\u1EA7u ti\xEAn \u0111\xE3 \u0111\u1EBFn b\xEAn \u0111\u1ED1ng l\u1EEDa. Ch\u1ECDn h\u1ECD, r\u1ED3i giao vi\u1EC7c: chu\u1ED9t ph\u1EA3i l\xEAn c\xE2y, \u0111\xE1 hay b\u1EE5i qu\u1EA3.");
    this.refreshFog();
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
  /** Villager sight: 7 tiles by day, 3 at night, minus the weather penalty. */
  visionRadius() {
    return Math.max(1, Math.round(NIGHT_VISION + (VISION - NIGHT_VISION) * this.light) - WEATHER[this.weather].vision);
  }
  fireRadius() {
    return Math.max(1, FIRE_VISION - WEATHER[this.weather].vision);
  }
  /** Stored food that will spoil within the next `secs` seconds. */
  foodSpoilingWithin(secs) {
    let n = 0;
    for (const l of this.foodLots) if (l.exp <= this.time + secs) n += l.amount;
    return Math.min(n, this.stock.food);
  }
  get(id) {
    return this.byId.get(id);
  }
  say(text) {
    this.log.push({ t: this.time, text });
    if (this.log.length > 40) this.log.shift();
  }
  capacity(_res) {
    let c = 0;
    for (const b of this.buildings) if (b.done) c += BUILDINGS[b.kind].cap;
    return c;
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
  hasWorkshop() {
    return this.buildings.some((b) => b.kind === "workshop" && b.done);
  }
  toolCount(kind, tier) {
    return this.toolStock[`${kind}${tier}`] ?? 0;
  }
  /** Bậc công cụ dân đang dùng cho nghề này (0 = tay không). */
  toolTier(v, job) {
    const k = job === "idle" ? void 0 : TOOL_OF_JOB[job];
    return k ? v.tools[k]?.tier ?? 0 : 0;
  }
  freshName(sex) {
    const pool = (sex === "m" ? NAMES_M : NAMES_F).filter((n) => !this.villagers.some((v) => v.name === n));
    const list = pool.length ? pool : sex === "m" ? NAMES_M : NAMES_F;
    return list[Math.floor(this.rnd() * list.length)];
  }
  spawn(x, y, sex) {
    const r = this.rnd, pick = (a) => a[Math.floor(r() * a.length)];
    const stats = {};
    for (const k of STAT_KEYS) stats[k] = 3 + Math.floor(r() * 8);
    const potential = {}, skill = {};
    for (const j of WORK_JOBS) {
      const p = r();
      potential[j] = p < 0.45 ? 1 : p < 0.85 ? 2 : 3;
      skill[j] = { xp: 0, level: 0 };
    }
    const v = {
      id: this.nextVid++,
      name: this.freshName(sex),
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
      health: 100,
      starving: false,
      anim: "idle",
      hold: null,
      bad: /* @__PURE__ */ new Map(),
      bed: -1,
      nightOwl: false
    };
    this.villagers.push(v);
    this.byId.set(v.id, v);
    return v;
  }
  // ---------------------------------------------------------------- công trình
  addBuilding(kind, x, y, done) {
    const d = BUILDINGS[kind];
    const b = { id: this.nextBid++, kind, x, y, progress: done ? 1 : 0, done, workers: 0 };
    this.buildings.push(b);
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) this.world.occ[(y + j) * this.world.size + x + i] = 1;
    return b;
  }
  /** Trả về lý do không đặt được, hoặc null nếu đặt được. */
  canPlace(kind, x, y) {
    const d = BUILDINGS[kind], w2 = this.world, N = w2.size;
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
      const tx = x + i, ty = y + j;
      if (!w2.inBounds(tx, ty)) return "Ngo\xE0i b\u1EA3n \u0111\u1ED3";
      const k = ty * N + tx;
      if (this.fog.state[k] === 0) return "Ch\u01B0a kh\xE1m ph\xE1";
      const t = w2.tiles[k];
      if (t !== 0 && t !== 4 || w2.occ[k]) return "V\u01B0\u1EDBng c\xE2y, \u0111\xE1, n\u01B0\u1EDBc ho\u1EB7c c\xF4ng tr\xECnh";
    }
    for (const r of Object.keys(d.cost)) if (this.stock[r] < (d.cost[r] ?? 0)) return `Thi\u1EBFu ${RES_NAME[r].toLowerCase()} (c\u1EA7n ${d.cost[r]})`;
    return null;
  }
  placeBuilding(kind, x, y) {
    const d = BUILDINGS[kind];
    if (!d.buildable) return { ok: false, reason: "Kh\xF4ng x\xE2y \u0111\u01B0\u1EE3c c\xF4ng tr\xECnh n\xE0y" };
    const why = this.canPlace(kind, x, y);
    if (why) return { ok: false, reason: why };
    for (const r of Object.keys(d.cost)) this.stock[r] -= d.cost[r] ?? 0;
    const b = this.addBuilding(kind, x, y, false);
    this.say(`\u0110\xE3 \u0111\u1EB7t n\u1EC1n ${d.name}. Giao vi\u1EC7c "Th\u1EE3 x\xE2y" \u0111\u1EC3 d\u1EF1ng.`);
    return { ok: true, building: b };
  }
  // ---------------------------------------------------------------- chế tác
  /** Thêm một đơn vào hàng đợi (nguyên liệu chỉ bị trừ khi thợ nhận đơn). */
  queueCraft(id) {
    if (!RECIPE_BY_ID[id]) return "C\xF4ng th\u1EE9c kh\xF4ng t\u1ED3n t\u1EA1i";
    if (!this.hasWorkshop()) return "C\u1EA7n d\u1EF1ng X\u01B0\u1EDFng ch\u1EBF t\xE1c tr\u01B0\u1EDBc";
    if (this.craftQueue.length >= 12) return "H\xE0ng \u0111\u1EE3i \u0111\xE3 \u0111\u1EA7y";
    this.craftQueue.push(id);
    return null;
  }
  /** Bỏ đơn cuối cùng cùng loại khỏi hàng đợi. */
  unqueueCraft(id) {
    const i = this.craftQueue.lastIndexOf(id);
    if (i >= 0) this.craftQueue.splice(i, 1);
  }
  affordable(r) {
    return Object.keys(r.cost).every((k) => this.stock[k] >= (r.cost[k] ?? 0));
  }
  releaseOrder(v) {
    if (!v.order) return;
    const r = RECIPE_BY_ID[v.order];
    if (r && (v.phase === "goShop" || v.phase === "craft")) {
      for (const k of Object.keys(r.cost)) this.stock[k] += r.cost[k] ?? 0;
      this.craftQueue.unshift(r.id);
    }
    v.order = null;
  }
  // ---------------------------------------------------------------- lệnh
  resetTask(v) {
    this.leaveNode(v);
    this.releaseOrder(v);
    v.path = [];
    v.slide = null;
    v.phase = "idle";
    v.progress = 0;
    v.timer = 0;
    v.target = -1;
    v.bed = -1;
    if (this.resting) v.nightOwl = true;
  }
  /** Lệnh đi: mỗi dân nhận một ô đích riêng quanh điểm chọn; dân thôi làm nghề. */
  orderMove(ids2, tx, ty) {
    const vs = ids2.map((id) => this.byId.get(id)).filter((v) => !!v);
    vs.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
    const taken = /* @__PURE__ */ new Set();
    for (const v of vs) {
      const goal = this.nearestFree(tx, ty, taken);
      this.resetTask(v);
      v.job = "idle";
      v.prefer = -1;
      if (!goal) continue;
      taken.add(goal[1] * this.world.size + goal[0]);
      v.path = this.pathTo(v, goal[0], goal[1], 3e4);
      v.phase = v.path.length ? "move" : "idle";
    }
  }
  /** Chuột phải lên cây/đá/bụi quả/công trình: giao nghề tương ứng. Trả về tên việc hoặc null. */
  orderWork(ids2, tx, ty) {
    if (!this.world.inBounds(tx, ty)) return null;
    const idx = ty * this.world.size + tx;
    const node = this.world.nodeAt(tx, ty), site = this.buildingAt(tx, ty);
    let job = null, prefer = -1;
    if (node && this.fog.state[idx] > 0) {
      job = NODE_JOB[node.kind];
      prefer = idx;
    } else if (site && !site.done) {
      job = "build";
      prefer = site.id;
    } else if (site && site.kind === "workshop") {
      job = "craft";
      prefer = site.id;
    }
    if (!job) return null;
    for (const id of ids2) {
      const v = this.byId.get(id);
      if (!v) continue;
      this.resetTask(v);
      v.job = job;
      v.prefer = prefer;
    }
    return JOB_NAME[job];
  }
  setJob(ids2, job) {
    for (const id of ids2) {
      const v = this.byId.get(id);
      if (!v) continue;
      this.resetTask(v);
      v.job = job;
      v.prefer = -1;
    }
  }
  /** Cấp công cụ ngay cho dân đã chọn, không cần Xưởng hay nguyên liệu. tier 0 = thu lại (tay không). */
  giveTool(ids2, kind, tier) {
    for (const id of ids2) {
      const v = this.byId.get(id);
      if (!v) continue;
      v.tools[kind] = tier > 0 ? { tier, dur: TIER_DURABILITY[tier] } : null;
      if (tier > 0) this.say(`${v.name} \u0111\u01B0\u1EE3c c\u1EA5p ${TOOL_NAME[kind].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}.`);
    }
  }
  /** Ô trống gần (tx,ty) nhất, chưa bị ai giữ. */
  nearestFree(tx, ty, taken) {
    const N = this.world.size;
    for (let r = 0; r <= 12; r++) {
      let best = null, bd = Infinity;
      for (let y = ty - r; y <= ty + r; y++) {
        for (let x = tx - r; x <= tx + r; x++) {
          if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
          if (this.world.isBlocked(x, y) || taken.has(y * N + x)) continue;
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
  // ---------------------------------------------------------------- vòng lặp
  refreshFog() {
    const r = this.visionRadius(), fire = this.fireRadius();
    this.lastVision = r;
    const src = this.villagers.map((v) => ({ x: v.x, y: v.y, r }));
    for (const b of this.buildings) if (b.done) {
      const d = BUILDINGS[b.kind];
      src.push({ x: b.x + d.w / 2, y: b.y + d.h / 2, r: b.kind === "campfire" ? fire : r });
    }
    this.fog.update(src);
    for (const v of this.villagers) {
      v.tx = Math.floor(v.x);
      v.ty = Math.floor(v.y);
    }
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
    for (const v of [...this.villagers]) this.tickVillager(v, dt);
    if (this.visionRadius() !== this.lastVision) this.fogDirty = true;
    if (this.fogDirty) {
      this.fogDirty = false;
      this.refreshFog();
    }
  }
  /** New day: roll weather, maybe change season; at noon foretell tomorrow; track rest hours. */
  tickCalendar() {
    const day = this.day;
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.weather = this.nextWeather;
      this.nextWeather = rollWeather(seasonOf(day + 1), this.wrnd());
      this.signalled = false;
      const season = seasonOf(day);
      if (season !== this.world.season) {
        this.world.setSeason(season);
        this.say(SEASON_DEF[season].enter);
      }
      if (this.weather !== "clear") this.say(`H\xF4m nay: ${WEATHER[this.weather].name.toLowerCase()}.`);
    }
    if (!this.signalled && this.tod >= 0.5) {
      this.signalled = true;
      const sig = WEATHER[this.nextWeather].signal;
      if (sig && this.nextWeather !== this.weather) this.say(sig);
    }
    const rest = isRestTime(this.tod, this.season);
    if (this.resting && !rest) for (const v of this.villagers) v.nightOwl = false;
    this.resting = rest;
  }
  /** Reconcile lots with the stock: gains open a new lot, losses come off the oldest; expired lots spoil. */
  syncFood() {
    const lots = this.foodLots, cur = this.stock.food;
    let sum = 0;
    for (const l of lots) sum += l.amount;
    if (cur > sum) {
      const exp = this.time + FOOD_SPOIL_DAYS * DAY_LENGTH, last = lots[lots.length - 1];
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
    while (lots.length && lots[0].exp <= this.time) spoiled += lots.shift().amount;
    if (spoiled > 0) {
      this.stock.food = Math.max(0, this.stock.food - spoiled);
      this.say(`${Math.round(spoiled)} th\u1EE9c \u0103n \u0111\u1EC3 qu\xE1 ${FOOD_SPOIL_DAYS} ng\xE0y \u0111\xE3 h\u1ECFng.`);
    }
  }
  tickVillager(v, dt) {
    v.fullness -= dt * 100 / DAY_LENGTH;
    if (v.fullness < 50 && this.stock.food >= 2) {
      this.stock.food -= 2;
      v.fullness = Math.min(100, v.fullness + 2 * FOOD_NUTRITION);
    }
    if (v.fullness <= 0) {
      if (!v.starving) {
        v.starving = true;
        this.say(`${v.name} \u0111\xF3i l\u1EA3, kho h\u1EBFt th\u1EE9c \u0103n!`);
      }
      v.fullness = 0;
      v.health -= dt * 100 / (1.5 * DAY_LENGTH);
    } else {
      v.starving = false;
      if (v.fullness > 40 && v.health < 100) v.health = Math.min(100, v.health + dt * 0.15);
    }
    if (v.health <= 0) {
      this.kill(v);
      return;
    }
    if (this.resting) {
      if (!v.nightOwl && v.phase !== "goHome" && v.phase !== "sleep") this.goHome(v);
    } else if (v.phase === "goHome" || v.phase === "sleep") {
      v.path = [];
      v.slide = null;
      v.phase = "idle";
      v.bed = -1;
    }
    const walk = v.speed * WEATHER[this.weather].speed;
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
      const s2 = v.slide, dx = s2.x - v.x, dy = s2.y - v.y, d = Math.hypot(dx, dy), step = walk * 0.7 * dt;
      if (d <= step) {
        v.x = s2.x;
        v.y = s2.y;
        v.slide = null;
        v.facing = s2.face;
      } else {
        v.x += dx / d * step;
        v.y += dy / d * step;
        if (Math.abs(dx) > 0.02) v.facing = dx > 0 ? "right" : "left";
      }
    }
    if (Math.floor(v.x) !== v.tx || Math.floor(v.y) !== v.ty) this.fogDirty = true;
    if (!v.path.length && !v.slide) this.think(v, dt);
    let anim = "idle", hold = null;
    const walking = v.path.length > 0 || !!v.slide;
    if (walking) anim = v.carry && v.carry.amount > 0 ? "carry_walk" : "walk";
    else if (v.phase === "work" && v.job !== "idle") {
      const k = TOOL_OF_JOB[v.job], tier = this.toolTier(v, v.job);
      if (k && tier > 0) {
        anim = JOBS[v.job].anim === "gather" ? "dig" : JOBS[v.job].anim;
        hold = { kind: k, tier };
      } else anim = "gather";
    } else if (v.phase === "build") {
      const t = this.toolTier(v, "build");
      if (t > 0) {
        anim = "build";
        hold = { kind: "hammer", tier: t };
      } else anim = "gather";
    } else if (v.phase === "craft") {
      anim = "craft";
      hold = { kind: "hammer", tier: 2 };
    }
    if (anim !== v.anim) {
      v.anim = anim;
      v.animClock = 0;
    } else v.animClock += dt;
    v.hold = hold;
  }
  /** Go sleep by the campfire: drop the current task (job kept), one spot per villager. */
  goHome(v) {
    const owl = v.nightOwl;
    this.resetTask(v);
    v.nightOwl = owl;
    v.phase = "sleep";
    const fire = this.buildings.find((b) => b.kind === "campfire");
    if (!fire) return;
    const d = BUILDINGS[fire.kind];
    const taken = new Set(this.villagers.filter((o) => o !== v && o.bed >= 0).map((o) => o.bed));
    const spot2 = this.nearestFree(fire.x + (d.w >> 1), fire.y + d.h, taken);
    if (!spot2 || this.routeTo(v, [spot2], 1) < 0) return;
    v.bed = spot2[1] * this.world.size + spot2[0];
    v.phase = "goHome";
  }
  kill(v) {
    this.leaveNode(v);
    this.releaseOrder(v);
    this.villagers.splice(this.villagers.indexOf(v), 1);
    this.byId.delete(v.id);
    this.fogDirty = true;
    this.say(`${v.name} \u0111\xE3 ch\u1EBFt v\xEC \u0111\xF3i.`);
  }
  // ---------------------------------------------------------------- việc làm
  workFactor(v, job) {
    const stat = v.stats[JOBS[job].stat];
    const season = job === "food" ? SEASON_DEF[this.season].gather : 1;
    return (0.5 + 0.1 * stat) * (1 + 0.2 * v.skill[job].level) * (v.fullness < 25 ? 0.7 : 1) * TIER_SPEED[this.toolTier(v, job)] * season;
  }
  gainXp(v, job, dt) {
    const s2 = v.skill[job];
    if (s2.level >= MAX_LEVEL) return;
    s2.xp += dt * XP_MULT[v.potential[job]];
    if (s2.xp >= XP_LEVELS[s2.level]) {
      s2.level++;
      this.say(`${v.name} l\xEAn c\u1EA5p ${s2.level} ngh\u1EC1 ${JOB_NAME[job].toLowerCase()}.`);
    }
  }
  /** Công cụ hao mòn theo thời gian làm việc; gãy thì dân quay về tay không. */
  wear(v, job, dt) {
    const k = TOOL_OF_JOB[job], t = k ? v.tools[k] : null;
    if (!k || !t) return;
    t.dur -= dt;
    if (t.dur <= 0) {
      v.tools[k] = null;
      this.say(`${TOOL_NAME[k]} ${TIER_NAME[t.tier].toLowerCase()} c\u1EE7a ${v.name} \u0111\xE3 g\xE3y.`);
    }
  }
  leaveNode(v) {
    if ((v.phase === "goNode" || v.phase === "work") && v.target >= 0) {
      const n = this.world.nodes.get(v.target);
      if (n) {
        if (n.workers > 0) n.workers--;
        n.sides &= ~v.slot;
      }
    }
    v.slot = 0;
  }
  face(v, tx, ty) {
    const dx = tx + 0.5 - v.x, dy = ty + 0.5 - v.y;
    v.facing = Math.abs(dx) > Math.abs(dy) * 1.1 ? dx > 0 ? "right" : "left" : dy > 0 ? "front" : "back";
  }
  wait(v, secs) {
    v.phase = "wait";
    v.timer = secs;
  }
  /** Dân luôn làm việc ở dạng nhìn ngang: nhìn về phía tâm vật thể. */
  faceX(v, cx) {
    v.facing = cx >= v.x ? "right" : "left";
  }
  /** Chỗ đứng ngang bên trái hoặc bên phải một vật thể, cùng hàng với gốc của nó. */
  nodeSlide(v, nx, ny, kind) {
    const left = v.slot === LEFT;
    return { x: nx + 0.5 + (left ? -REACH[kind] : REACH[kind]), y: ny + 0.875, face: left ? "right" : "left" };
  }
  /** Chỗ đứng ngang bên trái hoặc phải một công trình, sát mép dưới (mặt trước). */
  edgeSlide(v, b) {
    const d = BUILDINGS[b.kind], left = v.x < b.x + d.w / 2;
    return { x: left ? b.x - 0.3 : b.x + d.w + 0.3, y: b.y + d.h - 0.3 - v.id % 2 * 0.5, face: left ? "right" : "left" };
  }
  /** Đứng yên nhìn ngang về phía công trình (dùng khi dỡ hàng, lấy công cụ). */
  faceBuilding(v, b) {
    this.faceX(v, b.x + BUILDINGS[b.kind].w / 2);
  }
  think(v, dt) {
    const N = this.world.size;
    switch (v.phase) {
      case "move":
        v.phase = "idle";
        return;
      case "idle":
        if (v.job !== "idle") this.plan(v);
        return;
      case "wait":
        v.timer -= dt;
        if (v.timer <= 0) v.phase = "idle";
        return;
      case "goNode": {
        const n = this.world.nodes.get(v.target);
        if (!n || n.amount <= 0) {
          this.leaveNode(v);
          v.phase = "idle";
          return;
        }
        const nx = v.target % N, ny = v.target / N | 0;
        v.phase = "work";
        v.progress = 0;
        const sl = this.nodeSlide(v, nx, ny, n.kind);
        if (Math.hypot(sl.x - v.x, sl.y - v.y) < 0.04) v.facing = sl.face;
        else v.slide = sl;
        return;
      }
      case "work":
        this.doWork(v, dt);
        return;
      case "goStore":
        this.unload(v);
        return;
      case "goEquip":
        this.equip(v);
        return;
      case "goSite": {
        const b = this.getBuilding(v.target);
        if (!b || b.done) {
          v.phase = "idle";
          return;
        }
        v.phase = "build";
        v.slide = this.edgeSlide(v, b);
        return;
      }
      case "build": {
        const b = this.getBuilding(v.target);
        if (!b || b.done) {
          v.phase = "idle";
          return;
        }
        b.progress += dt / BUILDINGS[b.kind].buildTime * this.workFactor(v, "build");
        this.gainXp(v, "build", dt);
        this.wear(v, "build", dt);
        if (b.progress >= 1) {
          b.progress = 1;
          b.done = true;
          this.fogDirty = true;
          this.say(`${BUILDINGS[b.kind].name} \u0111\xE3 d\u1EF1ng xong.`);
          v.phase = "idle";
        }
        return;
      }
      case "goShop": {
        const b = this.getBuilding(v.target);
        if (!b || !b.done || !v.order) {
          this.releaseOrder(v);
          v.phase = "idle";
          return;
        }
        v.phase = "craft";
        v.progress = 0;
        v.slide = this.edgeSlide(v, b);
        return;
      }
      case "craft":
        this.doCraft(v, dt);
        return;
      case "goHome": {
        const c = v.carry;
        if (c) {
          const moved = Math.min(Math.max(0, this.capacity(c.res) - this.stock[c.res]), c.amount);
          this.stock[c.res] += moved;
          c.amount -= moved;
          if (c.amount <= 0) v.carry = null;
        }
        v.phase = "sleep";
        v.facing = "front";
        return;
      }
      case "sleep":
        return;
    }
  }
  doWork(v, dt) {
    const job = v.job, def = JOBS[job], n = this.world.nodes.get(v.target);
    if (!def.res || !n || n.amount <= 0) {
      this.leaveNode(v);
      v.phase = "idle";
      return;
    }
    v.progress += dt * this.workFactor(v, job) / def.baseTime;
    this.gainXp(v, job, dt);
    const tierNow = this.toolTier(v, job);
    this.wear(v, job, dt);
    if (v.progress < 1) return;
    v.progress -= 1;
    const res = def.res, acc = v.frac + TIER_YIELD[tierNow], whole = Math.floor(acc);
    const have = v.carry && v.carry.res === res ? v.carry.amount : 0;
    const take = Math.max(0, Math.min(whole, n.amount, CARRY_CAP[res] - have));
    v.frac = acc - whole;
    n.amount -= take;
    v.carry = { res, amount: have + take };
    if (n.amount <= 0) {
      const idx = v.target;
      this.leaveNode(v);
      this.world.depleted(idx);
      v.phase = "idle";
      if (n.kind === "tree") this.say("M\u1ED9t c\xE2y \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u1ED1n xong.");
    } else if (v.carry.amount >= CARRY_CAP[res] || this.betterTool(v, job)) {
      this.leaveNode(v);
      v.phase = "idle";
    }
  }
  doCraft(v, dt) {
    const r = v.order ? RECIPE_BY_ID[v.order] : null;
    if (!r) {
      v.phase = "idle";
      return;
    }
    v.progress += dt * this.workFactor(v, "craft") / r.time;
    this.gainXp(v, "craft", dt);
    if (v.progress < 1) return;
    this.toolStock[r.id] = (this.toolStock[r.id] ?? 0) + 1;
    this.say(`${v.name} \u0111\xE3 ch\u1EBF xong ${recipeName(r).toLowerCase()}.`);
    v.order = null;
    v.progress = 0;
    v.phase = "idle";
  }
  plan(v) {
    if (v.job === "build") {
      if (!this.planEquip(v, "build")) this.planBuild(v);
      return;
    }
    if (v.job === "craft") {
      this.planCraft(v);
      return;
    }
    const def = JOBS[v.job], res = def.res;
    if (v.carry && (v.carry.res !== res || v.carry.amount >= CARRY_CAP[v.carry.res])) {
      this.planDeliver(v);
      return;
    }
    if (this.stock[res] >= this.capacity(res)) {
      if (v.carry) {
        this.planDeliver(v);
        return;
      }
      if (this.time - this.lastFullWarn > 30) {
        this.lastFullWarn = this.time;
        this.say(`Kho \u0111\xE3 \u0111\u1EA7y ${RES_NAME[res].toLowerCase()}, h\xE3y x\xE2y th\xEAm Kho.`);
      }
      this.wait(v, 3);
      return;
    }
    if (this.planEquip(v, v.job)) return;
    if (this.findNode(v, def.node)) return;
    if (v.carry) {
      this.planDeliver(v);
      return;
    }
    this.wait(v, 2);
  }
  /** Bậc công cụ tốt hơn đang có sẵn ở Xưởng (0 nếu không có). */
  betterTool(v, job) {
    const k = TOOL_OF_JOB[job];
    if (!k || !this.hasWorkshop()) return 0;
    const cur = v.tools[k]?.tier ?? 0;
    for (let t = 2; t > cur; t--) if (this.toolCount(k, t) > 0) return t;
    return 0;
  }
  /** Nếu Xưởng có công cụ tốt hơn thứ dân đang cầm thì đi lấy. */
  planEquip(v, job) {
    const k = TOOL_OF_JOB[job];
    if (!k) return false;
    if (!this.betterTool(v, job)) return false;
    const shops = this.buildings.filter((b) => b.kind === "workshop" && b.done);
    shops.sort((a, b) => Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
    for (const b of shops.slice(0, 2)) {
      const d = BUILDINGS[b.kind];
      if (this.routeTo(v, this.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) {
        v.target = b.id;
        v.phase = "goEquip";
        return true;
      }
    }
    return false;
  }
  equip(v) {
    v.phase = "idle";
    const shop = this.getBuilding(v.target);
    if (shop) this.faceBuilding(v, shop);
    const k = TOOL_OF_JOB[v.job];
    if (!k) return;
    const cur = v.tools[k]?.tier ?? 0;
    for (let t = 2; t > cur; t--) {
      const key = `${k}${t}`;
      if ((this.toolStock[key] ?? 0) > 0) {
        this.toolStock[key]--;
        const tool = { tier: t, dur: TIER_DURABILITY[t] };
        v.tools[k] = tool;
        this.say(`${v.name} nh\u1EADn ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t].toLowerCase()}.`);
        return;
      }
    }
  }
  planCraft(v) {
    const shops = this.buildings.filter((b) => b.kind === "workshop" && b.done);
    if (!shops.length) {
      this.wait(v, 3);
      return;
    }
    if (!v.order) {
      const i = this.craftQueue.findIndex((id) => this.affordable(RECIPE_BY_ID[id]));
      if (i < 0) {
        if (this.craftQueue.length && this.time - this.lastMatWarn > 30) {
          this.lastMatWarn = this.time;
          this.say("Thi\u1EBFu nguy\xEAn li\u1EC7u \u0111\u1EC3 ch\u1EBF c\xF4ng c\u1EE5 trong h\xE0ng \u0111\u1EE3i.");
        }
        this.wait(v, 3);
        return;
      }
      const r2 = RECIPE_BY_ID[this.craftQueue[i]];
      this.craftQueue.splice(i, 1);
      for (const k of Object.keys(r2.cost)) this.stock[k] -= r2.cost[k] ?? 0;
      v.order = r2.id;
    }
    shops.sort((a, b) => (b.id === v.prefer ? 1 : 0) - (a.id === v.prefer ? 1 : 0) || Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
    for (const b of shops.slice(0, 2)) {
      const d = BUILDINGS[b.kind];
      if (this.routeTo(v, this.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) {
        v.target = b.id;
        v.phase = "goShop";
        return;
      }
    }
    const r = RECIPE_BY_ID[v.order];
    for (const k of Object.keys(r.cost)) this.stock[k] += r.cost[k] ?? 0;
    this.craftQueue.unshift(r.id);
    v.order = null;
    this.wait(v, 3);
  }
  /** Các ô trống quanh một hình chữ nhật, gần `v` nhất trước. */
  ringTiles(v, x, y, w2, h) {
    const out = [];
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w2; i++) {
      if (i >= x && i < x + w2 && j >= y && j < y + h) continue;
      if (!this.world.isBlocked(i, j)) out.push([i, j]);
    }
    const cost = (t) => Math.hypot(t[0] + 0.5 - v.x, t[1] + 0.5 - v.y) + (t[0] >= x && t[0] < x + w2 ? 1.5 : 0);
    out.sort((a, b) => cost(a) - cost(b));
    return out;
  }
  /**
   * Start tile for pathfinding. A work spot can overlap a blocked tile (a tree between two trees);
   * then use the nearest free neighbour, since A* cannot leave a blocked tile without cutting corners.
   */
  standTile(v) {
    const fx = Math.floor(v.x), fy = Math.floor(v.y);
    if (!this.world.isBlocked(fx, fy)) return [fx, fy];
    let best = [fx, fy], bd = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = fx + dx, y = fy + dy;
      if (this.world.isBlocked(x, y)) continue;
      const d = Math.hypot(x + 0.5 - v.x, y + 0.5 - v.y);
      if (d < bd) {
        bd = d;
        best = [x, y];
      }
    }
    return best;
  }
  /** Path from where the villager stands to (gx, gy); may end at the closest tile if unreachable. */
  pathTo(v, gx, gy, maxNodes = 14e3) {
    const [sx, sy] = this.standTile(v), off = sx !== Math.floor(v.x) || sy !== Math.floor(v.y);
    const p = gx === sx && gy === sy ? [] : findPath(this.world, sx, sy, gx, gy, maxNodes);
    return off ? [[sx, sy], ...p] : p;
  }
  /** Thử đi tới một trong các ô; trả về chỉ số ô đã có đường tới (hoặc -1). */
  routeTo(v, tiles, tries = 3) {
    const [sx, sy] = this.standTile(v);
    for (let k = 0; k < Math.min(tries, tiles.length); k++) {
      const [gx, gy] = tiles[k];
      const p = this.pathTo(v, gx, gy), last = p[p.length - 1];
      if (gx === sx && gy === sy || last && last[0] === gx && last[1] === gy) {
        v.path = p;
        return k;
      }
    }
    return -1;
  }
  findNode(v, kind) {
    const N = this.world.size, vx = Math.floor(v.x), vy = Math.floor(v.y);
    const ok2 = (idx) => {
      const n = this.world.nodes.get(idx);
      return !!n && n.kind === kind && n.amount > 0 && n.workers < 2 && n.sides !== 3 && this.fog.state[idx] > 0 && (v.bad.get(idx) ?? 0) <= this.time;
    };
    const cands = [];
    if (v.prefer >= 0 && ok2(v.prefer)) cands.push([-1, v.prefer]);
    for (const [idx, n] of this.world.nodes) {
      if (n.kind !== kind || n.amount <= 0 || n.workers >= 2 || n.sides === 3 || idx === v.prefer || !ok2(idx)) continue;
      const d = (idx % N - vx) ** 2 + ((idx / N | 0) - vy) ** 2;
      if (d <= 70 * 70) cands.push([d, idx]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (let c = 0; c < Math.min(4, cands.length); c++) {
      const idx = cands[c][1], nx = idx % N, ny = idx / N | 0, node = this.world.nodes.get(idx);
      const opts = [];
      for (const side of [LEFT, RIGHT]) {
        if (node.sides & side) continue;
        const sx = side === LEFT ? -1 : 1;
        const near2 = [[sx, 0, 0], [sx, 1, 0.6], [sx, -1, 1.6], [0, 1, 1.2], [0, -1, 2.4]];
        for (const [dx, dy, pen] of near2) if (!this.world.isBlocked(nx + dx, ny + dy)) opts.push({ t: [nx + dx, ny + dy], side, pen });
      }
      const cost = (o) => Math.hypot(o.t[0] + 0.5 - v.x, o.t[1] + 0.5 - v.y) + o.pen;
      opts.sort((a, b) => cost(a) - cost(b));
      const k = this.routeTo(v, opts.map((o) => o.t), 4);
      if (k >= 0) {
        node.workers++;
        node.sides |= opts[k].side;
        v.slot = opts[k].side;
        v.target = idx;
        v.phase = "goNode";
        v.prefer = -1;
        return true;
      }
      v.bad.set(idx, this.time + 30);
    }
    if (v.prefer >= 0) {
      if (this.world.nodes.has(v.prefer) && (v.bad.get(v.prefer) ?? 0) > this.time) this.say(`${v.name} kh\xF4ng t\xECm \u0111\u01B0\u1EE3c \u0111\u01B0\u1EDDng t\u1EDBi ngu\u1ED3n \u0111\xE3 ch\u1ECDn.`);
      v.prefer = -1;
    }
    return false;
  }
  planDeliver(v) {
    const done = this.buildings.filter((b) => b.done && BUILDINGS[b.kind].cap > 0);
    done.sort((a, b) => Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
    for (const b of done.slice(0, 2)) {
      const d = BUILDINGS[b.kind];
      if (this.routeTo(v, this.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) {
        v.target = b.id;
        v.phase = "goStore";
        return;
      }
    }
    this.wait(v, 2);
  }
  unload(v) {
    const c = v.carry, st = this.getBuilding(v.target);
    if (st) this.faceBuilding(v, st);
    if (!c) {
      v.phase = "idle";
      return;
    }
    const space = Math.max(0, this.capacity(c.res) - this.stock[c.res]), moved = Math.min(space, c.amount);
    this.stock[c.res] += moved;
    c.amount -= moved;
    if (c.amount <= 0) {
      v.carry = null;
      v.phase = "idle";
      return;
    }
    if (this.time - this.lastFullWarn > 30) {
      this.lastFullWarn = this.time;
      this.say(`Kho \u0111\xE3 \u0111\u1EA7y ${RES_NAME[c.res].toLowerCase()}, h\xE3y x\xE2y th\xEAm Kho.`);
    }
    this.wait(v, 3);
  }
  planBuild(v) {
    const crew = (b) => this.villagers.filter((o) => o !== v && o.target === b.id && (o.phase === "goSite" || o.phase === "build")).length;
    let sites = this.buildings.filter((b) => !b.done && crew(b) < 3);
    sites.sort((a, b) => (b.id === v.prefer ? 1 : 0) - (a.id === v.prefer ? 1 : 0) || Math.hypot(a.x + 1 - v.x, a.y + 1 - v.y) - Math.hypot(b.x + 1 - v.x, b.y + 1 - v.y));
    sites = sites.slice(0, 2);
    for (const b of sites) {
      const d = BUILDINGS[b.kind];
      if (this.routeTo(v, this.ringTiles(v, b.x, b.y, d.w, d.h)) >= 0) {
        v.target = b.id;
        v.phase = "goSite";
        v.prefer = -1;
        return;
      }
    }
    this.wait(v, 2);
  }
};

// test/sim.test.ts
var fails = 0;
var ok = (c, msg) => {
  console.log((c ? "ok   " : "FAIL ") + msg);
  if (!c) fails++;
};
var run = (sim3, secs) => {
  for (let i = 0; i < secs * 20; i++) sim3.tick(0.05);
};
var sim = new Sim(1337);
var w = sim.world;
ok(sim.villagers.length === 3, "3 d\xE2n ban \u0111\u1EA7u");
ok(sim.buildings.length === 1 && sim.buildings[0].done, "Nh\xE0 chung d\u1EF1ng s\u1EB5n");
ok(sim.capacity("wood") === 50, "s\u1EE9c ch\u1EE9a ban \u0111\u1EA7u 50");
var s = w.start;
var near = (k) => [...w.nodes.entries()].filter(([, n]) => n.kind === k);
ok(near("tree").length > 50 && near("rock").length > 5 && near("bush").length > 5, "c\xF3 \u0111\u1EE7 c\xE2y, \u0111\xE1, b\u1EE5i");
var seen = 0;
for (let i = 0; i < sim.fog.state.length; i++) if (sim.fog.state[i] > 0) seen++;
ok(seen > 100, "khu kh\u1EDFi \u0111\u1EA7u \u0111\xE3 s\xE1ng");
sim.setJob(sim.villagers.map((v) => v.id), "idle");
var spot = [s.x + 2, s.y - 2];
ok(sim.canPlace("storage", spot[0], spot[1]) !== null, "Kho b\u1ECB t\u1EEB ch\u1ED1i khi thi\u1EBFu g\u1ED7");
var ids = sim.villagers.map((v) => v.id);
sim.orderMove([ids[0]], s.x - 8, s.y);
sim.orderMove([ids[1]], s.x + 8, s.y);
sim.orderMove([ids[2]], s.x, s.y + 8);
run(sim, 12);
sim.setJob([ids[0], ids[1]], "wood");
sim.setJob([ids[2]], "food");
run(sim, 150);
console.log("stock", JSON.stringify(sim.stock), "carry", sim.villagers.map((v) => `${v.name}:${v.phase}:${v.carry?.amount ?? 0}`).join(" "));
ok(sim.stock.wood >= 10, `c\xF3 g\u1ED7 trong kho (${sim.stock.wood})`);
var f0 = sim.stock.food;
run(sim, 90);
ok(sim.stock.food > 0, `th\u1EE9c \u0103n c\xF2n (${sim.stock.food})`);
var give = sim.stock.wood;
sim.stock.wood = Math.max(give, 10);
var placed = null;
for (let dx = -6; dx <= 6 && !placed?.ok; dx++) for (let dy = -6; dy <= 6 && !placed?.ok; dy++) if (!sim.canPlace("storage", s.x + dx, s.y + dy)) placed = sim.placeBuilding("storage", s.x + dx, s.y + dy);
ok(!!placed?.ok, "\u0111\u1EB7t \u0111\u01B0\u1EE3c Kho");
ok(sim.stock.wood === Math.max(give, 10) - 10, "tr\u1EEB 10 g\u1ED7 khi \u0111\u1EB7t");
sim.setJob([ids[0], ids[1]], "build");
run(sim, 120);
ok(!!placed?.building?.done, `Kho d\u1EF1ng xong (progress ${placed?.building?.progress.toFixed(2)})`);
ok(sim.capacity("wood") === 150, "s\u1EE9c ch\u1EE9a t\u0103ng l\xEAn 150");
sim.setJob([ids[0], ids[1]], "stone");
for (let k = 0; k < 4 && sim.stock.stone < 4; k++) {
  sim.orderMove([ids[0]], s.x + (k % 2 ? 9 : -9), s.y + (k > 1 ? 9 : -9));
  run(sim, 15);
  sim.setJob([ids[0], ids[1]], "stone");
  run(sim, 40);
}
ok(sim.stock.stone > 0, `\u0111\xE1 v\u1EC1 kho (${sim.stock.stone})`);
var sim2 = new Sim(7);
sim2.stock.food = 0;
run(sim2, DAY_LENGTH * 3);
ok(sim2.villagers.length === 0, "d\xE2n ch\u1EBFt \u0111\xF3i khi kh\xF4ng c\xF2n th\u1EE9c \u0103n");
var bush = [...w.nodes.entries()].find(([, n]) => n.kind === "bush");
bush[1].amount = 0;
bush[1].regrow = 240;
w.tick(241);
ok(bush[1].amount === bush[1].max, "b\u1EE5i qu\u1EA3 m\u1ECDc l\u1EA1i sau 240 gi\xE2y");
var tree = [...w.nodes.entries()].find(([, n]) => n.kind === "tree");
w.depleted(tree[0]);
ok(w.tiles[tree[0]] === Tile.Grass && w.decor[tree[0]] === 1 && !w.nodes.has(tree[0]), "c\xE2y c\u1EA1n tr\u1EDF th\xE0nh g\u1ED1c, \xF4 \u0111i \u0111\u01B0\u1EE3c");
function reveal(sm) {
  sm.fog.state.fill(2);
}
function chopTest(tool, secs) {
  const sm = new Sim(1337);
  reveal(sm);
  const v = sm.villagers[0];
  sm.villagers.slice(1).forEach((o) => {
    o.fullness = 1e9;
  });
  v.fullness = 1e9;
  v.tools.axe = tool;
  sm.setJob([v.id], "wood");
  let maxDist = 0;
  const N = sm.world.size;
  for (let i = 0; i < secs * 20; i++) {
    sm.tick(0.05);
    if (v.phase === "work" && !v.slide && v.target >= 0) {
      const bx = v.target % N + 0.5, by = (v.target / N | 0) + 0.875;
      maxDist = Math.max(maxDist, Math.hypot(v.x - bx, v.y - by));
    }
  }
  return { wood: sm.stock.wood + (v.carry?.amount ?? 0), maxDist };
}
var none = chopTest(null, 240);
var wood1 = chopTest({ tier: 1, dur: 240 }, 240);
var stone2 = chopTest({ tier: 2, dur: 600 }, 240);
console.log("g\u1ED7 sau 240 s: tay kh\xF4ng", none.wood, "\xB7 r\xECu g\u1ED7", wood1.wood, "\xB7 r\xECu \u0111\xE1", stone2.wood);
ok(wood1.wood > none.wood * 1.4, "r\xECu g\u1ED7 l\xE0m nhi\u1EC1u h\u01A1n tay kh\xF4ng");
ok(stone2.wood > wood1.wood * 1.2, "r\xECu \u0111\xE1 l\xE0m nhi\u1EC1u h\u01A1n r\xECu g\u1ED7");
ok(none.maxDist < 0.8 && wood1.maxDist < 0.8, `d\xE2n \u0111\u1EE9ng s\xE1t c\xE2y khi \u0111\u1ED1n (xa nh\u1EA5t ${none.maxDist.toFixed(2)} \xF4)`);
{
  const sm = new Sim(1337);
  reveal(sm);
  const [a, b, c] = sm.villagers;
  sm.villagers.forEach((o) => {
    o.fullness = 1e9;
  });
  ok(sm.queueCraft("axe1") !== null, "ch\u01B0a c\xF3 X\u01B0\u1EDFng th\xEC kh\xF4ng x\u1EBFp \u0111\u01A1n ch\u1EBF t\xE1c");
  sm.stock.wood = 40;
  sm.stock.stone = 20;
  const placed2 = (() => {
    for (let dx = -8; dx <= 8; dx++) for (let dy = 3; dy <= 9; dy++) if (!sm.canPlace("workshop", sm.world.start.x + dx, sm.world.start.y + dy)) return sm.placeBuilding("workshop", sm.world.start.x + dx, sm.world.start.y + dy);
    return null;
  })();
  ok(!!placed2?.ok && sm.stock.wood === 25, "\u0111\u1EB7t X\u01B0\u1EDFng t\u1ED1n 15 g\u1ED7");
  sm.setJob([a.id, b.id], "build");
  run(sm, 80);
  ok(sm.hasWorkshop(), "X\u01B0\u1EDFng d\u1EF1ng xong");
  ok(sm.queueCraft("axe1") === null && sm.queueCraft("pick2") === null, "x\u1EBFp \u0111\u01B0\u1EE3c \u0111\u01A1n khi c\xF3 X\u01B0\u1EDFng");
  sm.setJob([c.id], "craft");
  run(sm, 60);
  ok(sm.toolCount("axe", 1) === 1 && sm.toolCount("pick", 2) === 1, `ch\u1EBF xong r\xECu g\u1ED7 v\xE0 cu\u1ED1c chim \u0111\xE1 (${JSON.stringify(sm.toolStock)})`);
  ok(sm.stock.wood === 25 - 3 - 2 && sm.stock.stone === 20 - 4, `tr\u1EEB nguy\xEAn li\u1EC7u \u0111\xFAng (g\u1ED7 ${sm.stock.wood}, \u0111\xE1 ${sm.stock.stone})`);
  sm.setJob([a.id], "wood");
  sm.setJob([b.id], "stone");
  run(sm, 40);
  ok(a.tools.axe?.tier === 1, "d\xE2n \u0111\u1ED1n g\u1ED7 t\u1EF1 t\u1EDBi X\u01B0\u1EDFng nh\u1EADn r\xECu g\u1ED7");
  ok(b.tools.pick?.tier === 2, "th\u1EE3 \u0111\xE1 nh\u1EADn cu\u1ED1c chim \u0111\xE1");
  ok(sm.toolCount("axe", 1) === 0, "c\xF4ng c\u1EE5 r\u1EDDi kh\u1ECFi kho khi \u0111\xE3 nh\u1EADn");
  sm.setJob([a.id, b.id], "idle");
  sm.stock.wood = 1;
  sm.queueCraft("axe1");
  run(sm, 10);
  ok(sm.craftQueue.length === 1 && sm.stock.wood === 1, "thi\u1EBFu nguy\xEAn li\u1EC7u th\xEC \u0111\u01A1n n\u1EB1m ch\u1EDD, kh\xF4ng tr\u1EEB");
  sm.stock.wood = 10;
  sm.setJob([c.id], "craft");
  run(sm, 5);
  ok(c.order === "axe1" && sm.stock.wood === 7, "th\u1EE3 nh\u1EADn \u0111\u01A1n v\xE0 tr\u1EEB nguy\xEAn li\u1EC7u");
  sm.setJob([c.id], "idle");
  ok(c.order === null && sm.stock.wood === 10 && sm.craftQueue[0] === "axe1", "\u0111\u1ED5i ngh\u1EC1 gi\u1EEFa ch\u1EEBng th\xEC ho\xE0n nguy\xEAn li\u1EC7u v\xE0 tr\u1EA3 \u0111\u01A1n");
  a.tools.axe = { tier: 1, dur: 3 };
  sm.setJob([a.id], "wood");
  run(sm, 20);
  ok(a.tools.axe === null, "r\xECu h\u1EBFt b\u1EC1n th\xEC g\xE3y");
}
function plant(sm, x, y) {
  const i = y * sm.world.size + x;
  sm.world.tiles[i] = Tile.Tree;
  sm.world.nodes.set(i, { kind: "tree", res: "wood", amount: 10, max: 10, workers: 0, sides: 0, regrow: 0 });
  return i;
}
function clearArea(sm, cx, cy, r) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const i = y * sm.world.size + x;
    sm.world.tiles[i] = Tile.Grass;
    sm.world.nodes.delete(i);
    sm.world.occ[i] = 0;
  }
}
var sideOnly = (f) => f === "left" || f === "right";
{
  const sm = new Sim(1337);
  reveal(sm);
  const cx = sm.world.start.x + 9, cy = sm.world.start.y + 4;
  clearArea(sm, cx, cy, 4);
  plant(sm, cx - 1, cy);
  const mid = plant(sm, cx, cy);
  plant(sm, cx + 1, cy);
  const v = sm.villagers[0];
  sm.villagers.forEach((o) => {
    o.fullness = 1e9;
  });
  ok(sm.orderWork([v.id], cx, cy) === "\u0110\u1ED1n g\u1ED7", "chu\u1ED9t ph\u1EA3i l\xEAn c\xE2y gi\u1EEFa v\u1EABn nh\u1EADn l\u1EC7nh");
  let reached = false, sideOk = true, maxDx = 0, dyOk = true;
  for (let i = 0; i < 20 * 400; i++) {
    sm.tick(0.05);
    if (v.phase === "work" && v.target === mid && !v.slide) {
      reached = true;
      sideOk = sideOk && sideOnly(v.facing);
      maxDx = Math.max(maxDx, Math.abs(Math.abs(v.x - (cx + 0.5)) - 0.55));
      dyOk = dyOk && Math.abs(v.y - (cy + 0.875)) < 0.05;
    }
    if (reached && (sm.world.nodes.get(mid)?.amount ?? 0) < 8) break;
  }
  ok(reached, "d\xE2n t\u1EDBi ch\u1EB7t \u0111\u01B0\u1EE3c c\xE2y gi\u1EEFa hai c\xE2y kh\xE1c");
  ok(sideOk && dyOk && maxDx < 0.05, "\u0111\u1EE9ng \u1EDF ch\u1ED7 ngang b\xEAn c\u1EA1nh c\xE2y, nh\xECn ngang");
  ok((sm.world.nodes.get(mid)?.amount ?? 0) < 8, "ch\u1EB7t \u0111\u01B0\u1EE3c g\u1ED7 t\u1EEB c\xE2y gi\u1EEFa");
  sm.time = DAY_LENGTH * 0.3;
  run(sm, 120);
  ok(sm.stock.wood > 0 && Math.floor(v.x) !== cx + 1, `d\xE2n ch\u1EB7t c\xE2y gi\u1EEFa v\u1EABn mang \u0111\u01B0\u1EE3c g\u1ED7 v\u1EC1 kho (kho ${sm.stock.wood})`);
}
{
  const sm = new Sim(1337);
  reveal(sm);
  const cx = sm.world.start.x + 9, cy = sm.world.start.y + 4;
  clearArea(sm, cx, cy, 4);
  const t = plant(sm, cx, cy);
  const [a, b] = sm.villagers;
  sm.villagers.forEach((o) => {
    o.fullness = 1e9;
  });
  sm.orderWork([a.id, b.id], cx, cy);
  let both = false;
  for (let i = 0; i < 20 * 40 && !both; i++) {
    sm.tick(0.05);
    both = a.phase === "work" && b.phase === "work" && !a.slide && !b.slide && a.target === t && b.target === t;
  }
  ok(both && Math.abs(a.x - b.x) > 1, "hai d\xE2n c\xF9ng c\xE2y \u0111\u1EE9ng hai b\xEAn kh\xE1c nhau");
}
{
  const sm = new Sim(1337);
  reveal(sm);
  const cx = sm.world.start.x + 9, cy = sm.world.start.y + 4;
  clearArea(sm, cx, cy, 4);
  const mid = plant(sm, cx, cy);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) plant(sm, cx + dx, cy + dy);
  const v = sm.villagers[0];
  sm.villagers.forEach((o) => {
    o.fullness = 1e9;
  });
  sm.orderWork([v.id], cx, cy);
  run(sm, 60);
  ok(sm.world.nodes.get(mid).amount === 10 && sm.world.nodes.get(mid).workers === 0, "c\xE2y b\u1ECB v\xE2y k\xEDn kh\xF4ng c\xF3 ai gi\u1EEF ch\u1ED7");
  ok(v.job === "wood" && v.phase !== "idle", "d\xE2n chuy\u1EC3n sang c\xE2y kh\xE1c, kh\xF4ng k\u1EB9t");
}
{
  const sm = new Sim(1337);
  reveal(sm);
  sm.villagers.forEach((o) => {
    o.fullness = 1e9;
  });
  const [a, b, c] = sm.villagers;
  sm.stock.wood = 60;
  sm.stock.stone = 20;
  let bad = "";
  const sp = sm.world.start;
  const spot2 = (() => {
    for (let dx = -8; dx <= 8; dx++) for (let dy = 3; dy <= 9; dy++) if (!sm.canPlace("workshop", sp.x + dx, sp.y + dy)) return [sp.x + dx, sp.y + dy];
    return null;
  })();
  sm.placeBuilding("workshop", spot2[0], spot2[1]);
  sm.setJob([a.id, b.id, c.id], "build");
  const watch = (n) => {
    for (let i = 0; i < n * 20; i++) {
      sm.tick(0.05);
      for (const v of sm.villagers) if ((v.phase === "work" || v.phase === "build" || v.phase === "craft") && !v.slide && !sideOnly(v.facing)) bad = `${v.name} ${v.phase} nh\xECn ${v.facing}`;
    }
  };
  watch(80);
  sm.queueCraft("axe1");
  sm.queueCraft("pick1");
  sm.setJob([a.id], "craft");
  sm.setJob([b.id], "wood");
  sm.setJob([c.id], "stone");
  watch(100);
  sm.setJob([c.id], "food");
  watch(60);
  ok(bad === "", "x\xE2y, ch\u1EBF t\xE1c, ch\u1EB7t, \u0111\xE0o, h\xE1i \u0111\u1EC1u nh\xECn ngang " + bad);
}
var tickN = (sm, secs) => run(sm, secs);
{
  ok(seasonOf(1) === "spring" && seasonOf(6) === "summer" && seasonOf(11) === "autumn" && seasonOf(16) === "winter" && seasonOf(21) === "spring", "m\u1ED7i m\xF9a 5 ng\xE0y, n\u0103m 20 ng\xE0y");
  const daylen = (se) => {
    let n = 0;
    for (let i = 0; i < 1e3; i++) if (lightAt(i / 1e3, se) >= 1) n++;
    return n / 1e3;
  };
  ok(Math.abs(daylen("spring") - 0.5) < 0.01 && daylen("summer") > daylen("spring") * 1.15 && daylen("winter") < daylen("spring") * 0.85, "m\xF9a h\u1EA1 ng\xE0y d\xE0i h\u01A1n 20%, m\xF9a \u0111\xF4ng ng\u1EAFn h\u01A1n 20%");
  ok(lightAt(0.5, "spring") === 1 && lightAt(0, "spring") === 0 && lightAt(0.8, "spring") > 0 && lightAt(0.8, "spring") < 1, "tr\u01B0a s\xE1ng, n\u1EEDa \u0111\xEAm t\u1ED1i, ho\xE0ng h\xF4n chuy\u1EC3n d\u1EA7n");
  const kinds = /* @__PURE__ */ new Set();
  for (let i = 0; i < 200; i++) kinds.add(rollWeather("winter", i / 200));
  ok([...kinds].every((k) => ["clear", "mist", "snow"].includes(k)) && kinds.has("snow"), "m\xF9a \u0111\xF4ng ch\u1EC9 c\xF3 n\u1EAFng, s\u01B0\u01A1ng, tuy\u1EBFt");
}
{
  const sm = new Sim(1337);
  sm.time = DAY_LENGTH * 0.5;
  ok(sm.visionRadius() === 7, "ban ng\xE0y nh\xECn 7 \xF4");
  sm.time = DAY_LENGTH * 1;
  ok(sm.visionRadius() === 3 && sm.fireRadius() === 8, "ban \u0111\xEAm nh\xECn 3 \xF4, l\u1EEDa tr\u1EA1i v\u1EABn 8 \xF4");
  sm.weather = "mist";
  ok(sm.visionRadius() === 1 && sm.fireRadius() === 6, "s\u01B0\u01A1ng m\u1ECFng tr\u1EEB 2 \xF4 t\u1EA7m nh\xECn");
  const sm2 = new Sim(1337);
  reveal(sm2);
  sm2.villagers.forEach((o) => {
    o.fullness = 1e9;
  });
  const v = sm2.villagers[0], N = sm2.world.size;
  sm2.time = DAY_LENGTH * 0.5;
  sm2.orderMove([v.id], sm2.world.start.x + 20, sm2.world.start.y);
  tickN(sm2, 20);
  sm2.time = DAY_LENGTH * 1 + 1;
  sm2.orderMove([v.id], Math.floor(v.x), Math.floor(v.y));
  tickN(sm2, 0.2);
  const at = (dx) => sm2.fog.state[Math.floor(v.y) * N + Math.floor(v.x) + dx];
  ok(at(2) === 2 && at(5) === 1, `ban \u0111\xEAm \xF4 c\xE1ch 2 c\xF2n th\u1EA5y, \xF4 c\xE1ch 5 ch\u1EC9 c\xF2n nh\u1EDB (${at(2)}, ${at(5)})`);
}
{
  const sm = new Sim(1337);
  reveal(sm);
  sm.villagers.forEach((o) => {
    o.fullness = 1e9;
  });
  const ids2 = sm.villagers.map((o) => o.id);
  sm.setJob(ids2, "wood");
  const fire = sm.buildings[0];
  tickN(sm, DAY_LENGTH * 0.84 - sm.time + 10);
  ok(sm.restTime, "gi\u1EEFa ho\xE0ng h\xF4n l\xE0 gi\u1EDD ng\u1EE7");
  tickN(sm, 30);
  ok(sm.villagers.every((o) => o.phase === "sleep"), "t\u1ED1i \u0111\u1EBFn c\u1EA3 l\xE0ng \u0111i ng\u1EE7: " + sm.villagers.map((o) => o.phase).join(","));
  ok(sm.villagers.every((o) => Math.hypot(o.x - fire.x - 1, o.y - fire.y - 1) < 4), "ng\u1EE7 quanh \u0111\u1ED1ng l\u1EEDa");
  ok(new Set(sm.villagers.map((o) => o.bed)).size === 3, "m\u1ED7i ng\u01B0\u1EDDi m\u1ED9t ch\u1ED7 n\u1EB1m");
  ok(sm.villagers.every((o) => o.job === "wood" && !o.carry), "v\u1EABn gi\u1EEF ngh\u1EC1, \u0111\u1ED3 mang theo \u0111\xE3 c\u1EA5t kho");
  const owl = sm.villagers[0];
  tickN(sm, 30);
  sm.orderMove([owl.id], fire.x + 6, fire.y + 6);
  tickN(sm, 10);
  ok(owl.phase !== "sleep" && owl.phase !== "goHome" && owl.nightOwl, "d\xE2n \u0111\u01B0\u1EE3c ra l\u1EC7nh ban \u0111\xEAm th\xEC th\u1EE9c");
  const wakeAt = DAY_LENGTH * (1 + 0.125 + 0.0625) + 2;
  tickN(sm, wakeAt - sm.time);
  ok(!sm.restTime && sm.villagers.every((o) => o.phase !== "sleep"), "s\xE1ng ra d\xE2n th\u1EE9c d\u1EADy");
  tickN(sm, 20);
  ok(sm.villagers.filter((o) => o.job === "wood").every((o) => ["goNode", "work", "goStore", "wait", "idle"].includes(o.phase)), "d\xE2n \u0111\u1ED1n g\u1ED7 \u0111i l\xE0m l\u1EA1i");
}
{
  const walked = (wk) => {
    const sm = new Sim(1337);
    reveal(sm);
    sm.time = DAY_LENGTH * 0.5;
    sm.weather = wk;
    const v = sm.villagers[0], x0 = v.x, y0 = v.y;
    sm.orderMove([v.id], sm.world.start.x + 30, sm.world.start.y + 1);
    tickN(sm, 4);
    return Math.hypot(v.x - x0, v.y - y0);
  };
  const c = walked("clear"), sn = walked("snow"), dr = walked("drizzle");
  ok(Math.abs(sn / c - 0.75) < 0.05 && Math.abs(dr / c - 0.9) < 0.05, `tuy\u1EBFt \u0111i ch\u1EADm 25%, m\u01B0a nh\u1EB9 10% (${(sn / c).toFixed(2)}, ${(dr / c).toFixed(2)})`);
}
{
  const sm = new Sim(1337);
  sm.villagers.forEach((o) => {
    o.fullness = 1e9;
  });
  const fc = sm.nextWeather;
  sm.time = DAY_LENGTH - 0.01;
  tickN(sm, 0.1);
  ok(sm.day === 2 && sm.weather === fc, "th\u1EDDi ti\u1EBFt ng\xE0y mai \u0111\xFAng nh\u01B0 \u0111\xE3 \u0111\u1ECBnh tr\u01B0\u1EDBc");
  sm.time = DAY_LENGTH * 15 - 0.01;
  tickN(sm, 0.1);
  const bushes = [...sm.world.nodes.values()].filter((n) => n.kind === "bush");
  ok(sm.season === "winter" && bushes.every((n) => n.amount === 0), "v\xE0o \u0111\xF4ng m\u1ECDi b\u1EE5i qu\u1EA3 tr\u1EE5i");
  ok(sm.log.some((l) => l.text.startsWith("M\xF9a \u0111\xF4ng")), "c\xF3 th\xF4ng b\xE1o v\xE0o \u0111\xF4ng");
  sm.world.tick(500);
  ok(bushes.every((n) => n.amount === 0), "m\xF9a \u0111\xF4ng b\u1EE5i kh\xF4ng m\u1ECDc l\u1EA1i");
  sm.time = DAY_LENGTH * 20 - 0.01;
  tickN(sm, 0.1);
  ok(sm.season === "spring" && bushes.every((n) => n.amount === 0 && n.regrow > 0), "sang xu\xE2n b\u1EE5i ra hoa, ch\u01B0a c\xF3 qu\u1EA3");
  sm.world.tick(181);
  ok(bushes.every((n) => n.amount === n.max), "v\xE0i ph\xFAt sau b\u1EE5i c\xF3 qu\u1EA3 l\u1EA1i");
}
{
  const sm = new Sim(1337);
  sm.villagers.forEach((o) => {
    o.fullness = 1e9;
  });
  sm.stock.food = 0;
  tickN(sm, 1);
  sm.stock.food = 10;
  tickN(sm, DAY_LENGTH);
  sm.stock.food += 10;
  tickN(sm, 1);
  ok(sm.foodSpoilingWithin(DAY_LENGTH * 2.1) === 10 && sm.foodSpoilingWithin(DAY_LENGTH * 3.1) === 20, "theo d\xF5i h\u1EA1n t\u1EEBng l\u1EE9a");
  sm.stock.food -= 4;
  tickN(sm, 1);
  ok(sm.foodSpoilingWithin(DAY_LENGTH * 2.1) === 6, "\u0103n l\u1EE9a c\u0169 tr\u01B0\u1EDBc");
  tickN(sm, DAY_LENGTH * 2.05);
  ok(sm.stock.food === 10 && sm.log.some((l) => l.text.includes("\u0111\xE3 h\u1ECFng")), `l\u1EE9a \u0111\u1EA7u h\u1ECFng sau 3 ng\xE0y (c\xF2n ${sm.stock.food})`);
  tickN(sm, DAY_LENGTH);
  ok(sm.stock.food === 0, "l\u1EE9a sau c\u0169ng h\u1ECFng");
}
{
  const sm = new Sim(1337);
  const v = sm.villagers[0];
  const wf = sm;
  sm.time = DAY_LENGTH * 0.5;
  const spring = wf.workFactor.call(sm, v, "food");
  sm.time = DAY_LENGTH * 10.5;
  const autumn = wf.workFactor.call(sm, v, "food");
  ok(Math.abs(autumn / spring - 1.4 / 0.8) < 1e-6, "h\u1EC7 s\u1ED1 h\xE1i l\u01B0\u1EE3m theo m\xF9a (xu\xE2n 0,8, thu 1,4)");
}
{
  const sm = new Sim(5);
  const [a] = sm.villagers;
  ok(a.tools.axe === null, "ban \u0111\u1EA7u tay kh\xF4ng");
  const rate = (t) => {
    sm.giveTool([a.id], "axe", t);
    return sm.toolTier(a, "wood");
  };
  ok(rate(1) === 1 && a.tools.axe?.tier === 1 && a.tools.axe.dur === TIER_DURABILITY[1], "c\u1EA5p r\xECu g\u1ED7 ngay, kh\xF4ng c\u1EA7n X\u01B0\u1EDFng");
  ok(rate(2) === 2 && a.tools.axe?.dur === TIER_DURABILITY[2], "c\u1EA5p r\xECu \u0111\xE1 ghi \u0111\xE8 r\xECu g\u1ED7");
  sm.giveTool([a.id], "axe", 0);
  ok(a.tools.axe === null && sm.toolTier(a, "wood") === 0, "thu l\u1EA1i v\u1EC1 tay kh\xF4ng");
  ok(sm.toolTier(a, "build") === 0, "th\u1EE3 x\xE2y tay kh\xF4ng th\xEC b\u1EADc 0");
  sm.giveTool([a.id], "hammer", 2);
  ok(sm.toolTier(a, "build") === 2 && sm.toolTier(a, "wood") === 0, "c\xF3 b\xFAa \u0111\xE1 th\xEC x\xE2y b\u1EADc 2, kh\xF4ng \u1EA3nh h\u01B0\u1EDFng ngh\u1EC1 kh\xE1c");
  sm.giveTool([999999], "pick", 1);
  ok(true, "id kh\xF4ng t\u1ED3n t\u1EA1i th\xEC b\u1ECF qua, kh\xF4ng l\u1ED7i");
}
{
  const buildTime = (tier) => {
    const sm = new Sim(42);
    const a = sm.villagers[0];
    sm.stock.wood = 100;
    const sp = sm.world.start;
    const spot2 = (() => {
      for (let dx = -8; dx <= 8; dx++) for (let dy = 3; dy <= 9; dy++) if (!sm.canPlace("storage", sp.x + dx, sp.y + dy)) return [sp.x + dx, sp.y + dy];
      return null;
    })();
    sm.placeBuilding("storage", spot2[0], spot2[1]);
    if (tier) sm.giveTool([a.id], "hammer", tier);
    sm.setJob([a.id], "build");
    let t = 0;
    while (t < 900 && !sm.buildings.every((b) => b.done)) {
      sm.tick(0.05);
      t += 0.05;
    }
    return t;
  };
  const bare = buildTime(0), wood = buildTime(1), stone = buildTime(2);
  ok(wood < bare && stone < wood, `b\xFAa c\xE0ng t\u1ED1t x\xE2y c\xE0ng nhanh: tay kh\xF4ng ${bare.toFixed(0)}s \xB7 b\xFAa g\u1ED7 ${wood.toFixed(0)}s \xB7 b\xFAa \u0111\xE1 ${stone.toFixed(0)}s`);
}
console.log(fails ? `${fails} l\u1ED7i` : "t\u1EA5t c\u1EA3 \u0111\u1EA1t");
process.exit(fails ? 1 : 0);
