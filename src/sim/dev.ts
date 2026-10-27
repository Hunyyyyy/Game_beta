import { ARMORS, CRAFTED_WEAPONS, maxHpOf, SPECIES, Species, TRIBE_IDS, TribeId, WEAPONS } from './combat';
import { DAY_LENGTH } from './constants';
import { SEASONS, SEASON_DAYS, Season, WeatherKind } from './calendar';
import { spawnAnimal } from './fauna';
import { RES_LIST, Res } from './resources';
import type { Sim, Villager } from './sim';
import type { StatKey } from './jobs';
import { launchRaid, launchWolves, surrender, tribeOf } from './tribes';
import { BUILDINGS, BuildingKind, levelDef } from './buildings';
import { TECHS } from './research';
import { STAFF_BUILDING } from './jobs';
import { RECIPES, TIER_DURABILITY } from './tools';

/**
 * Helpers for the dev menu: put the game into a state worth testing without playing up to it.
 * None of this is used by the game itself.
 */
export function addStock(sim: Sim, res: Res, n: number): void { sim.stock[res] = Math.max(0, sim.stock[res] + n); }
export function fillStock(sim: Sim): void { for (const r of RES_LIST) sim.stock[r] = Math.max(sim.stock[r], sim.capacity()); }

/** Everything the workshop can hand out, n of each. */
export function stockWorkshop(sim: Sim, n: number): void {
  for (const r of RECIPES) sim.toolStock[r.id] = (sim.toolStock[r.id] ?? 0) + n;
}

/** Open every technology at once, or forget them all. */
export function unlockResearch(sim: Sim): void { for (const t of TECHS) sim.researched.add(t.id); }
export function resetResearch(sim: Sim): void { sim.researched.clear(); }

/** Change one stat of the given villagers by `delta`; the numbers that follow from it are recomputed. */
export function bumpStat(sim: Sim, ids: readonly number[], key: StatKey, delta: number): void {
  for (const id of ids) {
    const v = sim.get(id);
    if (!v || v.team !== 'player') continue;
    v.stats[key] = Math.max(1, Math.min(20, v.stats[key] + delta));
    if (key === 'agi') v.speed = 1.6 + 0.1 * v.stats.agi;
    if (key === 'vit') { const ratio = v.health / v.maxHealth; v.maxHealth = maxHpOf(v.stats.vit); v.health = v.maxHealth * ratio; }
  }
}

export function eachSelected(sim: Sim, ids: readonly number[], fn: (v: Villager) => void): void {
  for (const id of ids) { const v = sim.get(id); if (v && v.team === 'player') fn(v); }
}
export function heal(sim: Sim, ids: readonly number[]): void {
  eachSelected(sim, ids, (v) => { v.health = v.maxHealth; v.down = 0; v.fullness = 100; if (v.phase === 'down') v.phase = 'idle'; });
}

export function addVillagers(sim: Sim, n: number): void {
  const fire = sim.campfire(), s = sim.world.start;
  for (let i = 0; i < n; i++) {
    const a = sim.frnd() * Math.PI * 2, r = 2 + sim.frnd() * 2;
    const v = sim.makeVillager(Math.floor((fire ? fire.x + 1 : s.x) + Math.cos(a) * r), Math.floor((fire ? fire.y + 3 : s.y) + Math.sin(a) * r), sim.frnd() < 0.5 ? 'm' : 'f', 'player', sim.frnd);
    sim.villagers.push(v); sim.registerUnit(v);
  }
}

// ---- time and weather
export function setTimeOfDay(sim: Sim, tod: number): void { sim.time = Math.floor(sim.time / DAY_LENGTH) * DAY_LENGTH + tod * DAY_LENGTH; }
export function skipDays(sim: Sim, n: number): void { sim.time += n * DAY_LENGTH; }
export function setSeason(sim: Sim, season: Season): void {
  const year = Math.floor((sim.day - 1) / (SEASON_DAYS * SEASONS.length));
  const day = year * SEASON_DAYS * SEASONS.length + SEASONS.indexOf(season) * SEASON_DAYS + 1;
  sim.time = (day - 1) * DAY_LENGTH + 0.3 * DAY_LENGTH;
}
export function setWeather(sim: Sim, kind: WeatherKind): void { sim.weather = kind; }

// ---- events and creatures
export function wolvesNow(sim: Sim, n: number): void { launchWolves(sim, n); }
export function raidNow(sim: Sim, id: TribeId, size: number): string | null {
  const t = tribeOf(sim, id);
  if (!t) return 'Không có bộ tộc này';
  if (t.state !== 'free') return `${t.def.name} không còn là kẻ địch`;
  if (t.raid) return 'Họ đang tập kích rồi';
  launchRaid(sim, t, size);
  return t.raid ? null : `${t.def.name} không đủ lính để tập kích`;
}
export function surrenderNow(sim: Sim, id: TribeId): void { const t = tribeOf(sim, id); if (t && t.state === 'free') surrender(sim, t, 'Dev: ép đầu hàng'); }
export function bumpRelation(sim: Sim, id: TribeId, n: number): void { const t = tribeOf(sim, id); if (t) t.relation = Math.max(-100, Math.min(100, t.relation + n)); }
export function spawnAt(sim: Sim, species: Species, x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) spawnAnimal(sim, species, x + (sim.frnd() - 0.5) * 3, y + (sim.frnd() - 0.5) * 3, 9500 + i);
}
export function clearAnimals(sim: Sim): void { sim.animals.length = 0; sim.animalById.clear(); }
export function revealMap(sim: Sim): void { sim.fog.state.fill(2); sim.fog.version++; }

export const DEV_SPECIES = SPECIES;
export const DEV_TRIBES = TRIBE_IDS;
export const DEV_WEAPONS = CRAFTED_WEAPONS.map((id) => ({ id, name: WEAPONS[id].name }));
export const DEV_ARMOR = { id: 'hide', name: ARMORS.hide.name };

// ---- buildings, tools and the workshop chain
/** Put up every building that is missing, finished and free, near the campfire. */
export function buildAll(sim: Sim): void {
  const was = { f: sim.dev.freeBuild, i: sim.dev.instantBuild };
  sim.dev.freeBuild = true; sim.dev.instantBuild = true;
  const fire = sim.campfire(), cx = Math.floor(fire ? fire.x + 1 : sim.world.start.x), cy = Math.floor(fire ? fire.y + 4 : sim.world.start.y + 4);
  for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) {
    if (!BUILDINGS[kind].buildable || sim.buildings.some((b) => b.kind === kind)) continue;
    let done = false;
    for (let r = 2; r < 18 && !done; r++) for (let dx = -r; dx <= r && !done; dx++) for (let dy = -r; dy <= r && !done; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (!sim.canPlace(kind, cx + dx * 2, cy + dy * 2) && sim.placeBuilding(kind, cx + dx * 2, cy + dy * 2).ok) done = true;
    }
  }
  sim.dev.freeBuild = was.f; sim.dev.instantBuild = was.i;
}
/** Raise every building to its top level at once. */
export function maxBuildings(sim: Sim): void {
  for (const b of sim.buildings) { const top = BUILDINGS[b.kind].levels.stone!.length; if (b.done && b.level < top) { b.level = top; b.upgrading = false; } }
}
/** Wear the tools of the given villagers down to a fraction of their life (0 = broken). */
export function wearTools(sim: Sim, ids: readonly number[], frac: number): void {
  eachSelected(sim, ids, (v) => { for (const t of Object.values(v.tools)) if (t) t.dur = Math.min(t.dur, Math.max(0, TIER_DURABILITY[t.tier] * frac)); });
}
/** Fill the research, crafting and repair houses with the best villagers for each. */
export function staffAll(sim: Sim): void {
  for (const job of ['research', 'craft', 'repair'] as const) {
    const b = sim.building(STAFF_BUILDING[job]); if (!b) continue;
    while (sim.staffCount(b) < levelDef(b).slots) { const v = sim.bestFor(job); if (!v) break; sim.assignStaff([v.id], job); }
  }
}
