import { SEASONS, SEASON_DAYS, Season, WeatherKind } from './calendar';
import { DAY_LENGTH } from './constants';
import { ANIMALS, WEAPONS } from './combat';
import { BUILDINGS, BuildingKind, eraLocked, fireUnlockLevel, levelCapByFire, maxHp, maxLevel, WALL_KINDS } from './buildings';
import { armyRoom, eventNeed } from './readiness';
import { RES_LIST, Res } from './resources';
import type { RoleId } from './jobs';
import type { Sim } from './sim';
import { RECIPES } from './tools';
import { seenNow } from './scouting';
import { fireEventNow, tribeOf } from './tribes';
import { Tile } from './world';

/**
 * Helpers for the dev menu: put the game into a state worth testing without playing up to it.
 * None of this is used by the game itself. The menu has only a few things (src/ui/menu.ts): simulate a camp of a level, quick and free research,
 * crafting and taming, +100 of every good, an event for the level of the camp, immortality, and the time and the weather.
 */

// ---- goods
export function addStock(sim: Sim, res: Res, n: number): void { sim.stock[res] = Math.max(0, Math.min(sim.capacity(res) || Infinity, sim.stock[res] + n)); }
/** Every good up by n (within what the stores hold). */
export function addAllStock(sim: Sim, n: number): void { for (const r of RES_LIST) addStock(sim, r, n); }

// ---- time and weather
export function setTimeOfDay(sim: Sim, tod: number): void { sim.time = Math.floor(sim.time / DAY_LENGTH) * DAY_LENGTH + tod * DAY_LENGTH; }
export function skipDays(sim: Sim, n: number): void { sim.time += n * DAY_LENGTH; }
export function setSeason(sim: Sim, season: Season): void {
  const year = Math.floor((sim.day - 1) / (SEASON_DAYS * SEASONS.length));
  const day = year * SEASON_DAYS * SEASONS.length + SEASONS.indexOf(season) * SEASON_DAYS + 1;
  sim.time = (day - 1) * DAY_LENGTH + 0.3 * DAY_LENGTH;
}
export function setWeather(sim: Sim, kind: WeatherKind): void { sim.weather = kind; }

// ---- events
/** Fire the next of the scheduled events now that a camp of this level can meet with the soldiers it has room for (the weakest when none can be). Returns what came, or the reason it did not. */
export function callEvent(sim: Sim): string {
  const level = sim.campfire()?.level ?? 1, room = armyRoom(sim, level);
  const left = sim.events.filter((e) => !e.fired);
  if (!left.length) return 'Hết sự kiện đã hẹn';
  const pick = left.sort((a, b) => a.fireDay - b.fireDay).find((e) => eventNeed(e) <= room) ?? left.sort((a, b) => eventNeed(a) - eventNeed(b))[0];
  const why = fireEventNow(sim, pick);
  const name = pick.kind === 'beasts' ? `${pick.species ? ANIMALS[pick.species].name : 'Sói'} ×${pick.size}` : `${pick.tribe ?? 'Bộ tộc'} ×${pick.size}`;
  return why ?? `Đã gọi: ${name} (cấp lửa ${level}, chứa ~${room} lính)`;
}

// ---- a camp of a level, built and full
/** Trees and rocks on a patch of ground are taken away (their tiles go back to grass), with a tile to spare all round so that nobody is walled in. */
const clear = (sim: Sim, x: number, y: number, w: number, h: number, margin = 1): void => {
  const N = sim.world.size;
  for (let j = -margin; j < h + margin; j++) for (let i = -margin; i < w + margin; i++) {
    if (x + i < 0 || y + j < 0 || x + i >= N || y + j >= N) continue;
    const k = (y + j) * N + x + i;
    if (sim.world.nodes.delete(k)) { sim.world.tiles[k] = Tile.Grass; sim.world.decor[k] = 0; }
  }
};

/** What goes inside the fence first (the heart of the defence: the camps, the stores, the workshops), then what stays outside (the working houses, out by the land they work). */
const CORE: BuildingKind[] = ['storage', 'builder', 'workshop', 'armory', 'infantry', 'archery', 'cavalry', 'guardpost', 'lab', 'wartent', 'stable', 'house', 'toolstore', 'scouttent', 'supplycamp'];
const OUTSIDE: BuildingKind[] = ['lumberyard', 'quarry', 'farmhouse', 'huntlodge', 'drill'];

/** The spots of a camp: a grid three tiles apart round the campfire (a house is two wide and keeps a tile free all round), ring by ring, each ring clockwise from the north. The way from the gate to the fire is kept clear. */
function ring(fire: { x: number; y: number }, r: number): Array<[number, number]> {
  const out: Array<{ i: number; j: number; a: number }> = [];
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (Math.max(Math.abs(i), Math.abs(j)) !== r || (i === 0 && j > 0)) continue;
    out.push({ i, j, a: (Math.atan2(i, -j) + 2 * Math.PI) % (2 * Math.PI) });
  }
  return out.sort((p, q) => p.a - q.a).map((o) => [fire.x + 3 * o.i, fire.y + 3 * o.j] as [number, number]);
}

/** Put a finished house on the first of the spots that takes it (the ground is cleared first); the spot is used up. */
function placeAt(sim: Sim, kind: BuildingKind, spots: Array<[number, number]>): boolean {
  const d = BUILDINGS[kind];
  for (let k = 0; k < spots.length; k++) {
    const [x, y] = spots[k];
    clear(sim, x, y, d.w, d.h);
    if (!sim.canPlace(kind, x, y) && sim.placeBuilding(kind, x, y).ok) { spots.splice(k, 1); return true; }
  }
  return false;
}

/** A square of fence of half-width `half` round the fire, a gate in the middle of the south side, a tower at each corner as far as the level allows. Returns how many pieces went up. */
function fenceRing(sim: Sim, cx: number, cy: number, half: number): number {
  let n = 0;
  const put = (kind: BuildingKind, x: number, y: number) => { clear(sim, x, y, BUILDINGS[kind].w, BUILDINGS[kind].h, 0); if (!sim.canPlace(kind, x, y) && sim.placeBuilding(kind, x, y).ok) n++; };
  for (let d = -half; d <= half; d++) {
    put('fence', cx + d, cy - half);
    put(d === 0 ? 'gate' : 'fence', cx + d, cy + half);
    if (Math.abs(d) < half) { put('fence', cx - half, cy + d); put('fence', cx + half, cy + d); }
  }
  if (!eraLocked('tower', sim)) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) put('tower', sx > 0 ? cx + half + 1 : cx - half - 2, sy > 0 ? cy + half + 1 : cy - half - 2);
  return n;
}

/** Everything of the village is taken away but the campfire: the houses, the fence, the people's trades and arms. */
function wipe(sim: Sim): void {
  for (const b of [...sim.buildings]) if (b.kind !== 'campfire') sim.demolishBuilding(b.id);
  for (const s of [...sim.squads]) sim.disbandSquad(s.id);
  for (const v of sim.villagers) {
    if (v.team !== 'player') continue;
    sim.resetTask(v); v.job = 'idle'; v.post = -1; v.guard = false; v.guardAt = null; v.out = false; v.squad = -1; v.arm = 'foot';
    v.weapon = null; v.armor = null; v.manualGear = false; v.torch = null; v.fight.mode = 'none'; v.fight.anchor = null; v.shift = 'day';
    for (const k of Object.keys(v.tools) as Array<keyof typeof v.tools>) v.tools[k] = null;
  }
}

/**
 * Make a camp of the given campfire level (1 to 4) at once, in place of whatever stands: the campfire at that level, the fence with its gate and towers
 * when the level opens them, the houses of that level ringed round the fire (the camps and stores inside the fence, the working houses outside it),
 * then the people: every bed filled, the trades and camps staffed, the soldiers armed. Costs nothing. Returns a line about what stands now.
 */
export function simulateCamp(sim: Sim, level: number, medieval = sim.advanced): string {
  const fire = sim.campfire();
  if (!fire) return 'Không có Nhà chung';
  sim.advanced = medieval; // the era of the camp: the stone age has no supply camp, scouts, watchtower or war plan
  const was = { f: sim.dev.freeBuild, i: sim.dev.instantBuild };
  sim.dev.freeBuild = sim.dev.instantBuild = true;
  try {
    sim.fog.state.fill(2); sim.fog.invalidate(); sim.fogDirty = true;
    wipe(sim);
    fire.level = Math.max(1, Math.min(maxLevel('campfire', fire.era), level)); fire.upgrading = false; fire.hp = maxHp(fire);
    const cx = Math.floor(fire.x + 1), cy = Math.floor(fire.y + 1);
    // the fence is the biggest square the pieces of the level allow (eight to each tile of half-width); what is inside it is the core, the rest stands outside
    const fenced = fireUnlockLevel('fence') <= fire.level, half = fenced ? Math.max(4, Math.min(10, Math.floor((sim.buildingLimit('fence') + 1) / 8))) : 0;
    const coreRings = fenced ? Math.floor((half - 2) / 3) : 2, firstOutside = fenced ? Math.ceil((half + 2) / 3) : 3;
    const inside: Array<[number, number]> = [], outside: Array<[number, number]> = [];
    for (let r = 1; r <= coreRings; r++) inside.push(...ring(fire, r));
    for (let r = firstOutside; r <= firstOutside + 3; r++) outside.push(...ring(fire, r).sort((p, q) => Math.abs(p[1] - fire.y) - Math.abs(q[1] - fire.y))); // out by the sides, where the land is worked
    const open = (k: BuildingKind) => BUILDINGS[k].buildable && fireUnlockLevel(k) <= fire.level && !eraLocked(k, sim);
    // the fence and the towers first, so that the houses are set round them
    const wall = fenced ? fenceRing(sim, cx, cy, half) : 0;
    // the towers of a camp with no fence stand round it at the corners
    if (!fenced && open('tower')) {
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]].slice(0, sim.buildingLimit('tower'))) {
        const x = cx + sx * 8 - (sx < 0 ? 2 : 0), y = cy + sy * 8 - (sy < 0 ? 2 : 0);
        clear(sim, x, y, 2, 2);
        if (!sim.canPlace('tower', x, y)) sim.placeBuilding('tower', x, y);
      }
    }
    let houses = 0;
    for (const kind of CORE.filter(open)) for (let n = sim.buildingLimit(kind); n > 0; n--) { if (placeAt(sim, kind, inside) || placeAt(sim, kind, outside)) houses++; else break; }
    for (const kind of OUTSIDE.filter(open)) for (let n = sim.buildingLimit(kind); n > 0; n--) { if (placeAt(sim, kind, outside)) houses++; else break; }
    // every house stands as high as the level lets it
    for (const b of sim.buildings) if (b.done && b.kind !== 'campfire') { const top = Math.min(maxLevel(b.kind, b.era), levelCapByFire(fire.level)); b.level = Math.max(b.level, top); b.upgrading = false; b.hp = maxHp(b); }
    const people = peopleFor(sim);
    sim.fogDirty = true;
    return `Trại cấp ${fire.level}: ${houses} nhà${wall ? `, ${wall} đoạn rào/cổng/chòi` : ''}, ${people.total} dân (${people.soldiers} lính)`;
  } finally { sim.dev.freeBuild = was.f; sim.dev.instantBuild = was.i; }
}

/** The village made as big as it may be (too many are sent away, too few made), then the roles given out, the soldiers armed and the stores stocked. */
function peopleFor(sim: Sim): { total: number; soldiers: number } {
  const cap = sim.popCap();
  for (let i = sim.villagers.length; i < cap; i++) addVillager(sim);
  for (const v of sim.villagers.filter((x) => x.team === 'player').slice(cap)) { sim.leaveNode(v); sim.exitBuilding(v); sim.villagers.splice(sim.villagers.indexOf(v), 1); sim.byId.delete(v.id); }
  // 40% of the village is army (the camps first, then the guards), the rest works: the trades round and round, the builders, the craft and research houses
  const free = () => sim.villagers.filter((v) => v.team === 'player' && v.job === 'idle' && v.down <= 0);
  const give = (role: RoleId): boolean => { const v = free()[0]; return !!v && sim.assignRole([v.id], role) === null; };
  const soldiersWanted = Math.floor(sim.villagers.length * 0.4);
  const camps: RoleId[] = sim.advanced ? ['foot', 'archer', 'cavalry', 'guard', 'supply'] : ['foot', 'archer', 'cavalry', 'guard'];
  for (let n = 0, i = 0, stuck = 0; n < soldiersWanted && stuck < camps.length; i++) { if (give(camps[i % camps.length])) { n++; stuck = 0; } else stuck++; }
  const crew = free()[0]; if (crew) sim.assignCrew([crew.id]);
  const trades: RoleId[] = ['wood', 'stone', 'food', 'hunt'];
  for (let i = 0, stuck = 0; stuck < trades.length; i++) { if (give(trades[i % trades.length])) stuck = 0; else stuck++; }
  for (const job of ['research', 'craft'] as const) { const v = free()[0]; if (v) sim.assignStaff([v.id], job); }
  // arms for the soldiers; tools, weapons and torches in the stores
  for (const r of RECIPES) sim.toolStock[r.id] = Math.max(sim.toolStock[r.id] ?? 0, 3);
  for (const v of sim.villagers) if (v.team === 'player' && v.job === 'fight') {
    const weapon = v.arm === 'archer' ? 'bow' : 'spear';
    if (WEAPONS[weapon]) { sim.giveGear([v.id], weapon, 'weapon'); sim.giveGear([v.id], 'hide', 'armor'); }
  }
  for (const r of RES_LIST) sim.stock[r] = Math.max(sim.stock[r], Math.min(sim.capacity(r), 200));
  return { total: sim.villagers.length, soldiers: sim.villagers.filter((v) => v.job === 'fight').length };
}

/** Five more free villagers by the fire, past the campfire's room if need be (to try crowds and the lists of the houses). Returns a line about it. */
export function addPeople(sim: Sim, n: number): string {
  for (let i = 0; i < n; i++) addVillager(sim);
  return `Thêm ${n} dân: làng có ${sim.villagers.filter((v) => v.team === 'player').length} dân`;
}

/** The nearest village is found and mapped in full at every level (1 to 3), so a war plan can be tried at once. Returns a line about it. */
export function giveEnemyMap(sim: Sim): string {
  const f = sim.campfire(), from = f ? { x: f.x, y: f.y } : sim.world.start;
  const t = sim.tribes.filter((x) => x.state !== 'destroyed').sort((a, b) => Math.hypot(a.camp.x - from.x, a.camp.y - from.y) - Math.hypot(b.camp.x - from.x, b.camp.y - from.y))[0];
  if (!t) return 'Không còn làng nào';
  sim.world.ensure(t.camp.x, t.camp.y, 30);
  if (!sim.sightings.some((x) => x.tribe === t.id)) sim.sightings.push({ tribe: t.id, by: -1, at: sim.time, reported: true });
  else for (const x of sim.sightings) if (x.tribe === t.id) x.reported = true;
  for (let level = 1; level <= 3; level++) {
    const map = { tribe: t.id, level, at: sim.time, gaps: 0, seen: level >= 2 ? seenNow(sim, t) : undefined }, old = sim.maps.findIndex((m) => m.tribe === t.id && m.level === level);
    if (old >= 0) sim.maps[old] = map; else sim.maps.push(map);
  }
  return `Đã có bản đồ cấp 3 đầy đủ của ${t.def.name}: mở Lều họp chiến để lập kế hoạch`;
}

function addVillager(sim: Sim): void {
  const fire = sim.campfire(), s = sim.world.start;
  const a = sim.frnd() * Math.PI * 2, r = 2 + sim.frnd() * 3;
  // on open ground: a villager made inside a house could never walk out
  const gx = Math.floor((fire ? fire.x + 1 : s.x) + Math.cos(a) * r), gy = Math.floor((fire ? fire.y + 3 : s.y) + Math.sin(a) * r), spot = sim.nearestFree(gx, gy, new Set()) ?? [gx, gy];
  const v = sim.makeVillager(spot[0], spot[1], sim.frnd() < 0.5 ? 'm' : 'f', 'player', sim.frnd);
  sim.villagers.push(v); sim.registerUnit(v);
}

/**
 * A scouting trip done at once, for the map-drawing data: the nearest village that has no map of this level yet is found and mapped in full (no gaps), as if
 * scouts had gone there and come back. Returns a line about it.
 */
export function autoScout(sim: Sim, level: number): string {
  const f = sim.campfire(), from = f ? { x: f.x, y: f.y } : sim.world.start;
  const ts = sim.tribes.filter((t) => t.state !== 'destroyed' && !sim.maps.some((m) => m.tribe === t.id && m.level >= level))
    .sort((a, b) => Math.hypot(a.camp.x - from.x, a.camp.y - from.y) - Math.hypot(b.camp.x - from.x, b.camp.y - from.y));
  const t = ts[0];
  if (!t) return `Mọi làng đều đã có bản đồ cấp ${level}`;
  sim.world.ensure(t.camp.x, t.camp.y, 30);
  if (!sim.sightings.some((s) => s.tribe === t.id)) sim.sightings.push({ tribe: t.id, by: -1, at: sim.time, reported: true });
  else for (const s of sim.sightings) if (s.tribe === t.id) s.reported = true;
  const old = sim.maps.findIndex((m) => m.tribe === t.id && m.level === level);
  const map = { tribe: t.id, level, at: sim.time, gaps: 0, seen: level >= 2 ? seenNow(sim, tribeOf(sim, t.id)!) : undefined };
  if (old >= 0) sim.maps[old] = map; else sim.maps.push(map);
  return `Trinh sát đã vẽ xong bản đồ cấp ${level} của ${t.def.name}`;
}
