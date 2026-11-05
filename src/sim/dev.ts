import { SEASONS, SEASON_DAYS, Season, WeatherKind } from './calendar';
import { ANIMALS, WEAPONS } from './combat';
import { BUILDINGS, BuildingKind, eraLocked, fireUnlockLevel, levelCapByFire, maxHp, maxLevel, WALL_KINDS } from './buildings';
import { CORE, OUTSIDE, ring } from './campplan';
import { armyRoom, eventNeed } from './readiness';
import { RES_LIST, Res } from './resources';
import type { RoleId } from './jobs';
import type { Sim } from './sim';
import { RECIPES } from './tools';
import { CHAINS, STAT_TECHS, TECHS, recipeNeedLevel } from './research';
import { seenNow } from './scouting';
import { fireEventNow, tribeOf, tributeTribe } from './tribes';
import { torchLife } from './rest';
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

// ---- research
/** The parts of the research house, one for each tab of its tree: the chains it draws (data/researchtree.json) and the single steps beside them (data/research.json). */
export const RESEARCH_GROUPS: Array<{ key: string; label: string; chains: string[]; techs?: (id: string) => boolean }> = [
  { key: 'military', label: 'Quân sự', chains: ['military'] },
  { key: 'economy', label: 'Kinh tế', chains: ['economy'] },
  { key: 'development', label: 'Phát triển', chains: ['development'] },
  { key: 'defense', label: 'Phòng thủ', chains: ['defense', 'works1', 'works2'] },
  { key: 'weapon', label: 'Vũ khí', chains: ['weapon'] },
  { key: 'tool', label: 'Công cụ', chains: ['tool', 'hammer'] },
  { key: 'formation', label: 'Lập kế hoạch', chains: ['formation'], techs: (id) => id === 'signal' || id.startsWith('form_') },
  { key: 'plan', label: 'Kế hoạch chiến đấu', chains: ['tactic'], techs: (id) => id.startsWith('plan_') },
  { key: 'march', label: 'Hành quân', chains: ['march', 'marchlog'] },
];
/** Research every step of one part of the tree at once ('all' for the whole tree, the blueprints included). Returns what was done. */
export function researchGroup(sim: Sim, key: string): string {
  const groups = key === 'all' ? RESEARCH_GROUPS : RESEARCH_GROUPS.filter((g) => g.key === key);
  if (!groups.length) return 'Không có nhóm nghiên cứu này.';
  const roles = new Set(groups.flatMap((g) => g.chains.flatMap((c) => CHAINS[c]?.roles ?? [])));
  const single = (id: string) => groups.some((g) => g.techs?.(id));
  const ids = [...STAT_TECHS.filter((t) => { const r = t.unlocks.bonus?.role ?? t.unlocks.tier?.role; return !!r && roles.has(r); }), ...TECHS.filter((t) => single(t.id) || key === 'all')].map((t) => t.id);
  let n = 0;
  for (const id of ids) if (!sim.researched.has(id)) { sim.researched.add(id); n++; }
  return n ? `Đã nghiên cứu xong ${n} mục${key === 'all' ? '' : ` của ${groups[0].label}`}.` : 'Nhóm này đã nghiên cứu xong hết.';
}

// ---- time and weather
export function setTimeOfDay(sim: Sim, tod: number): void { sim.time = sim.timeBase + Math.floor((sim.time - sim.timeBase) / sim.dayLen) * sim.dayLen + tod * sim.dayLen; }
export function skipDays(sim: Sim, n: number): void { sim.time += n * sim.dayLen; }
export function setSeason(sim: Sim, season: Season): void {
  const year = Math.floor((sim.day - 1) / (SEASON_DAYS * SEASONS.length));
  const day = year * SEASON_DAYS * SEASONS.length + SEASONS.indexOf(season) * SEASON_DAYS + 1;
  sim.time = sim.timeBase + (day - 1 - sim.dayBase) * sim.dayLen + 0.3 * sim.dayLen;
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

// the plan of a camp (CORE, OUTSIDE, ring) is shared with the tribes: campplan.ts
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

/** The land round the fire counts as explored (as far as the houses of the biggest camp reach), so that houses can be put outside the fence: a house cannot stand on unknown land. */
function exploreAround(sim: Sim, fire: { x: number; y: number }, radius = 32): void {
  const N = sim.world.size, s = sim.fog.state, cx = Math.floor(fire.x), cy = Math.floor(fire.y);
  for (let y = Math.max(0, cy - radius); y <= Math.min(N - 1, cy + radius); y++) for (let x = Math.max(0, cx - radius); x <= Math.min(N - 1, cx + radius); x++) if (s[y * N + x] === 0) s[y * N + x] = 1;
  sim.fog.invalidate();
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
export function simulateCamp(sim: Sim, level: number, medieval = sim.era === 'ancient'): string {
  const fire = sim.campfire();
  if (!fire) return 'Không có Nhà chung';
  sim.setEra(medieval ? 'ancient' : 'stone'); // the era of the camp: the stone age has no supply camp, scouts, watchtower or war plan
  const was = { f: sim.dev.freeBuild, i: sim.dev.instantBuild };
  sim.dev.freeBuild = sim.dev.instantBuild = true;
  try {
    sim.fogDirty = true; // the houses and the people light the land round them by themselves: the rest of the map stays unknown
    exploreAround(sim, fire);
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
  // the people are given out by what the houses hold (the places of each house at its level, from the building files), never past it, and what is left stays idle:
  // the camps of soldiers first, then the builders, the research and craft houses, the trades, the guards last
  const free = () => sim.villagers.filter((v) => v.team === 'player' && v.job === 'idle' && v.down <= 0);
  const give = (role: RoleId): boolean => { const v = free()[0]; return !!v && sim.roleCount(role) < sim.roleCapacity(role) && sim.assignRole([v.id], role) === null; };
  const roundRobin = (roles: RoleId[]) => { for (let i = 0, stuck = 0; stuck < roles.length; i++) { if (give(roles[i % roles.length])) stuck = 0; else stuck++; } };
  const was = sim.dev.freeBuild; sim.dev.freeBuild = false; // with it on a role with no house would hold 99: the real places are the ones that count
  try {
    roundRobin(sim.era === 'ancient' ? ['foot', 'archer', 'cavalry', 'supply'] : ['foot', 'archer', 'cavalry']);
    for (let v = free()[0]; v && sim.assignCrew([v.id]) === null; v = free()[0]);
    for (const job of ['research', 'craft'] as const) for (let v = free()[0]; v && sim.assignStaff([v.id], job) === null; v = free()[0]);
    roundRobin(['wood', 'stone', 'food', 'hunt']);
    roundRobin(['guard']);
  } finally { sim.dev.freeBuild = was; }
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

/** Every soldier camp filled to its capacity (people are added past the village limit), each soldier with the best gear of the era and a lit-ready torch. Returns a line about it. */
export function fullArmy(sim: Sim): string {
  const camps: RoleId[] = ['foot', 'archer', 'cavalry', 'guard', 'tower'];
  const free = () => sim.villagers.find((v) => v.team === 'player' && v.job === 'idle' && v.down <= 0 && v.inside === null);
  let added = 0;
  for (const role of camps) {
    for (let guard = 0; sim.roleCount(role) < sim.roleCapacity(role) && guard < 200; guard++) {
      let v = free();
      if (!v) { addVillager(sim); v = free(); }
      if (!v || sim.assignRole([v.id], role) !== null) break;
      added++;
    }
  }
  const top = sim.era === 'ancient' ? { foot: 'bronze_sword', cav: 'bronze_spear', armor: 'bronze' } : { foot: 'mace', cav: 'spear', armor: 'bone' };
  let n = 0;
  for (const v of sim.villagers) {
    if (v.team !== 'player' || v.job !== 'fight') continue;
    const weapon = v.arm === 'archer' ? 'bow' : v.arm === 'cavalry' ? top.cav : top.foot;
    sim.giveGear([v.id], weapon, 'weapon'); sim.giveGear([v.id], top.armor, 'armor');
    v.manualGear = true; v.torch = { dur: torchLife(sim) }; n++;
  }
  sim.fogDirty = true;
  return `Quân đầy các trại: thêm ${added} lính, ${n} lính có đồ cao nhất + đuốc`;
}

/** The nearest free village of a tier (weak, normal, medium) becomes a tributary at once, so it sends its soldiers when we go to war. Returns a line about it. */
export function allyTier(sim: Sim, tier: 'weak' | 'normal' | 'medium'): string {
  const f = sim.campfire(), from = f ? { x: f.x, y: f.y } : sim.world.start;
  const t = sim.tribes.filter((x) => x.tier === tier && !x.boss && x.state === 'free')
    .sort((a, b) => Math.hypot(a.camp.x - from.x, a.camp.y - from.y) - Math.hypot(b.camp.x - from.x, b.camp.y - from.y))[0];
  if (!t) return `Không còn làng ${tier} nào tự do để làm đồng minh`;
  t.state = 'surrendered'; // the one state a tribute can be taken from at any relation
  const err = tributeTribe(sim, t.id);
  if (err) return err;
  t.relation = 100; // the soldiers it sends are its tier's number times relation / 100 (difficulty.json capture.allies): at 100 the full number
  return `${t.def.name} (${tier}) đã làm đồng minh (chư hầu, quan hệ 100)`;
}

/**
 * A camp of the stone age at a level (1 to 4) with exactly what that level opens: every research whose house level is at most `level`, a store of every tool, weapon
 * and armour whose crafting-house level is at most `level`, and the soldiers armed with the best of those. Returns a line about it.
 */
export function campFullKit(sim: Sim, level: number): string {
  const camp = simulateCamp(sim, level, false);
  // what stands decides what opens: a camp with no research house (it opens at the second fire) has no research, one with no crafting house makes nothing
  const lab = sim.building('lab')?.level ?? 0, shop = sim.building('workshop')?.level ?? 0;
  let techs = 0;
  for (const t of [...TECHS, ...STAT_TECHS]) if (lab > 0 && t.needLevel <= lab && !sim.researched.has(t.id)) { sim.researched.add(t.id); techs++; }
  const open = RECIPES.filter((r) => shop > 0 && recipeNeedLevel(r.id) <= shop);
  for (const r of open) sim.toolStock[r.id] = Math.max(sim.toolStock[r.id] ?? 0, 99);
  const best = (kinds: string[]) => kinds.find((k) => open.some((r) => r.kind === k));
  const foot = best(['mace', 'spear', 'club']), cav = best(['spear', 'club']), armor = best(['bone', 'hide']);
  let n = 0;
  for (const v of sim.villagers) {
    if (v.team !== 'player' || v.job !== 'fight') continue;
    const weapon = v.arm === 'archer' ? 'bow' : v.arm === 'cavalry' ? cav : foot;
    if (weapon) sim.giveGear([v.id], weapon, 'weapon');
    if (armor) sim.giveGear([v.id], armor, 'armor');
    v.manualGear = true; v.torch = { dur: torchLife(sim) }; n++;
  }
  return `${camp}; nghiên cứu ${techs} mục mở ở cấp ${level}; kho đủ đồ cấp ${level}; ${n} lính trang bị đồ tốt nhất mở được + đuốc`;
}

/** The nearest boss still standing is found and mapped, and the army is sent at it (the quick war of the stone age). Returns a line about it. */
export function attackBoss(sim: Sim): string {
  const f = sim.campfire(), from = f ? { x: f.x, y: f.y } : sim.world.start;
  const t = sim.tribes.filter((x) => x.boss && !x.bossDown && x.state === 'free')
    .sort((a, b) => Math.hypot(a.camp.x - from.x, a.camp.y - from.y) - Math.hypot(b.camp.x - from.x, b.camp.y - from.y))[0];
  if (!t) return 'Không còn boss nào để đánh';
  discoverTribe(sim, t.id);
  return sim.quickAttack(t.id) ?? `Đã đưa quân đi đánh ${t.def.name} (boss)`;
}

/** A village is found and mapped in full (levels 1 to 3), so that it shows in the war tent. Returns a line about it. */
export function discoverTribe(sim: Sim, id: string): string {
  const t = sim.tribes.find((x) => x.id === id);
  if (!t) return 'Không có làng này';
  sim.world.ensure(t.camp.x, t.camp.y, 30);
  const s = sim.sightings.find((x) => x.tribe === id);
  if (s) s.reported = true; else sim.sightings.push({ tribe: id, by: -1, at: sim.time, reported: true });
  for (let level = 1; level <= 3; level++) {
    const map = { tribe: id, level, at: sim.time, gaps: 0, seen: level >= 2 ? seenNow(sim, t) : undefined }, old = sim.maps.findIndex((m) => m.tribe === id && m.level === level);
    if (old >= 0) sim.maps[old] = map; else sim.maps.push(map);
  }
  return `Đã phát hiện ${t.def.name}: mở Lều họp chiến để đánh`;
}
