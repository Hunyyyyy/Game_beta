import { ARMORS, CRAFTED_WEAPONS, maxHpOf, SPECIES, Species, TRIBE_IDS, TribeId, WEAPONS } from './combat';
import { DAY_LENGTH } from './constants';
import { SEASONS, SEASON_DAYS, Season, WeatherKind } from './calendar';
import { spawnAnimal } from './fauna';
import { RES_LIST, Res } from './resources';
import type { FormationName, Plan, Sim, Villager } from './sim';
import type { StatKey } from './jobs';
import { launchCustomRaid, launchRaid, launchWolves, surrender, tribeOf } from './tribes';
import { BUILDINGS, BuildingKind, levelDef, POP_BY_FIRE } from './buildings';
import { TECHS } from './research';
import { STAFF_BUILDING } from './jobs';
import { RECIPES, TIER_DURABILITY } from './tools';
import { Tile } from './world';

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
  eachSelected(sim, ids, (v) => { v.health = v.maxHealth; v.down = 0; v.fullness = 100; v.energy = 100; v.strain = 0; v.lockUntil = 0; if (v.phase === 'down') v.phase = 'idle'; });
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
  for (const b of sim.buildings) { const top = BUILDINGS[b.kind].levels.stone!.length; if (b.done && b.level < top) { b.level = top; b.upgrading = false; b.hp = levelDef(b).hp; } }
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

// ---- battle testing: everything a fight needs, open and full, without playing up to it
/** Campfire at its top level, every technology, a full store, the workshop stocked, every house built and raised. */
export function combatReady(sim: Sim): void {
  const fire = sim.campfire();
  if (fire) { fire.level = POP_BY_FIRE.length; fire.upgrading = false; }
  unlockResearch(sim); fillStock(sim); stockWorkshop(sim, 12); revealMap(sim);
  buildAll(sim); maxBuildings(sim); staffAll(sim);
}

/** Arms a new soldier can be given: the weapon and whether he wears hide armour. */
export const DEV_KITS = {
  club: { name: 'Xung kích (gậy + giáp)', weapon: 'club', armor: true },
  mace: { name: 'Xung kích nặng (chùy + giáp)', weapon: 'mace', armor: true },
  spear: { name: 'Giáo binh (giáo + giáp)', weapon: 'spear', armor: true },
  sling: { name: 'Cung thủ ná đá', weapon: 'sling', armor: false },
  bow: { name: 'Cung thủ (cung)', weapon: 'bow', armor: false },
} as const;
export type DevKit = keyof typeof DEV_KITS;

/** n new villagers, enlisted and armed by hand. Returns them. */
export function raiseArmy(sim: Sim, kit: DevKit, n: number): Villager[] {
  const before = sim.villagers.length;
  addVillagers(sim, n);
  const fresh = sim.villagers.slice(before), ids = fresh.map((v) => v.id), k = DEV_KITS[kit];
  sim.enlist(ids);
  sim.giveGear(ids, k.weapon, 'weapon');
  if (k.armor) sim.giveGear(ids, 'hide', 'armor');
  for (const v of fresh) v.manualGear = true;
  return fresh;
}

/** A square of fence round the village with a gate on the south side and a tower at each northern corner. Returns how many pieces went up. */
export function defenseLine(sim: Sim, half = 8): number {
  const fire = sim.campfire(); if (!fire) return 0;
  const was = { f: sim.dev.freeBuild, i: sim.dev.instantBuild }; sim.dev.freeBuild = sim.dev.instantBuild = true;
  const cx = Math.floor(fire.x + 1), cy = Math.floor(fire.y + 3);
  let n = 0;
  revealMap(sim);
  // trees and rocks in the way are cleared, so the ring is whole
  const clear = (x: number, y: number, w: number, h: number) => {
    const N = sim.world.size;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (y + j) * N + x + i; if (sim.world.nodes.delete(k)) { sim.world.tiles[k] = Tile.Grass; sim.world.decor[k] = 0; } }
  };
  const put = (kind: BuildingKind, x: number, y: number) => { clear(x, y, BUILDINGS[kind].w, BUILDINGS[kind].h); if (!sim.canPlace(kind, x, y) && sim.placeBuilding(kind, x, y).ok) n++; };
  for (let d = -half; d <= half; d++) {
    for (const [x, y] of [[cx + d, cy - half], [cx - half, cy + d], [cx + half, cy + d]] as Array<[number, number]>) put('fence', x, y);
    put(d === 0 ? 'gate' : 'fence', cx + d, cy + half);
  }
  put('tower', cx - half - 1, cy - half - 2); put('tower', cx + half, cy - half - 2);
  for (const b of sim.buildings) if (b.done && (b.kind === 'fence' || b.kind === 'gate' || b.kind === 'tower')) { b.level = BUILDINGS[b.kind].levels.stone!.length; b.hp = levelDef(b).hp; }
  sim.dev.freeBuild = was.f; sim.dev.instantBuild = was.i;
  return n;
}

/** Put archers on the towers, as many as each holds. */
export function garrisonTowers(sim: Sim): number {
  let n = 0;
  for (const t of sim.buildings.filter((b) => b.kind === 'tower' && b.done)) {
    const room = levelDef(t).slots - sim.garrison(t).length;
    if (room <= 0) continue;
    const archers = raiseArmy(sim, 'bow', room);
    for (const a of archers) if (!sim.assignTower([a.id], t.id)) n++;
  }
  return n;
}

/** Raiders of a tribe with the given weapons come at the village at once. */
export function enemyWave(sim: Sim, id: TribeId, weapons: string[], armor = true): string | null {
  const t = tribeOf(sim, id);
  if (!t) return 'Không có bộ tộc này';
  if (t.state !== 'free') return `${t.def.name} không còn là kẻ địch`;
  if (t.raid) return 'Họ đang tập kích rồi';
  launchCustomRaid(sim, t, weapons, armor);
  return null;
}
export const times = (n: number, w: string): string[] => Array.from({ length: n }, () => w);

// ---- war: maps, squads and plans to try the war tent without playing for them
/** Maps of every village up to a level, fresh and without gaps. */
export function giveMaps(sim: Sim, level = 3): void {
  for (const t of sim.tribes) for (let l = 1; l <= level; l++) {
    const i = sim.maps.findIndex((m) => m.tribe === t.id && m.level === l), map = { tribe: t.id, level: l, at: sim.time, gaps: 0 };
    if (i >= 0) sim.maps[i] = map; else sim.maps.push(map);
  }
  for (const t of sim.tribes) {
    const s = sim.sightings.find((x) => x.tribe === t.id);
    if (s) s.reported = true; else sim.sightings.push({ tribe: t.id, by: -1, at: sim.time, reported: true });
  }
}

/** Three squads of new soldiers, each in a different formation: spearmen in a line, archers scattered, maces in a wedge. */
export function formSquads(sim: Sim): void {
  while (sim.squads.length) sim.disbandSquad(sim.squads[0].id);
  const plan: Array<[DevKit, number, string, FormationName]> = [['spear', 10, 'Giáo binh', 'line'], ['bow', 8, 'Cung thủ', 'scatter'], ['mace', 6, 'Xung kích', 'wedge']];
  for (const [kit, n, name, formation] of plan) {
    const made = sim.createSquad(name);
    if (!made.squad) break;
    sim.joinSquad(raiseArmy(sim, kit, n).map((v) => v.id), made.squad.id);
    sim.setFormation(made.squad.id, formation); made.squad.mastery[formation] = 50;
  }
}

/** An attack on a village using the first three squads: the line goes in at the gate, the archers shoot after it, the maces go round by the forest for the leader on a signal. */
export function sampleAttack(sim: Sim, tribe: TribeId = 'axe'): Plan | null {
  const [a, b, c] = sim.squads; if (!a) return null;
  giveMaps(sim, 3);
  const plan = sim.newPlan('attack', tribe);
  sim.addMission(plan, a.id); plan.missions[0].objective = 'gate';
  if (b) { sim.addMission(plan, b.id); Object.assign(plan.missions[1], { objective: 'camp', stance: 'shoot', trigger: { kind: 'after', squad: a.id } }); }
  if (c) { sim.addMission(plan, c.id); Object.assign(plan.missions[2], { objective: 'leader', route: 'forest', trigger: { kind: 'signal' } }); }
  sim.addCard(plan, 'go', a.id); sim.addCard(plan, 'signal', -1); sim.addCard(plan, 'retreat', a.id);
  if (b) sim.addCard(plan, 'formation', b.id, 'line');
  return plan;
}

/** A defence template: the first squad at the gate, the second on the towers, the third in reserve by the fire. */
export function sampleDefense(sim: Sim): Plan | null {
  const [a, b, c] = sim.squads; if (!a) return null;
  const plan = sim.newPlan('defense', null);
  sim.addMission(plan, a.id); plan.missions[0].post = 'gate';
  if (b) { sim.addMission(plan, b.id); plan.missions[1].post = 'tower'; }
  if (c) { sim.addMission(plan, c.id); plan.missions[2].post = 'reserve'; }
  return plan;
}
