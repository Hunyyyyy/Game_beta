import { Animal, animalDef, carcassEmpty } from './fauna';
import { ANIMALS, BEHAVIOUR } from './combat';
import { BUILDINGS, BuildingKind } from './buildings';
import { engage, HUNT_BACK } from './battle';
import type { Threat } from './battle';
import { CARRY_CAP, Res, RES_NAME, resourceOpen, resourceUnlock } from './resources';
import { hash2 } from './rng';
import type { Sim, Villager } from './sim';

/** The hunters of the village: how far they range, what a beast is worth to them, and what they do from the hunt to the skinning. */
/** How far from the Chòi thợ săn its hunters range (tiles), by the level of the lodge. */
export const HUNT_RANGE = [24, 36, 52];
/** What a beast is worth to a hunter: its meat, its hide and what else the body gives, each at the weight of animals.json "huntValue"; goods the village cannot take yet count for nothing. */
export function preyValue(sim: Sim, species: Animal['species']): number {
  const def = ANIMALS[species], w = BEHAVIOUR.huntValue as Record<string, number>;
  let value = def.meat * (w.meat ?? 0);
  for (const [res, n] of Object.entries({ hide: def.hide, ...(def.drops ?? {}) })) if (n && resourceOpen(res as Res, sim.buildings)) value += n * (w[res] ?? 0);
  return value;
}
/** The biggest beast (by health) the lodge of this level sends hunters after: a lodge of level 1 stays with deer and small game, a higher one takes on the big ones. */
export const huntHpCap = (level: number): number => BEHAVIOUR.huntHpCap[Math.min(BEHAVIOUR.huntHpCap.length, Math.max(1, level)) - 1];
export function huntRange(sim: Sim): number { return HUNT_RANGE[Math.min(HUNT_RANGE.length, sim.building('huntlodge')?.level ?? 1) - 1]; }

// ---------------------------------------------------------------- hunting
export function huntBrain(sim: Sim, v: Villager, dt: number, threats: Threat[]): boolean {
  if (v.health < v.maxHealth * HUNT_BACK && v.phase !== 'skin') { // hurt: take what he carries home, then rest by the fire until healed
    if (v.phase === 'move' && v.path.length) return true;
    if (v.phase === 'fight' || v.phase === 'goCarcass') { v.phase = 'idle'; v.path = []; v.loot = -1; }
    if (v.carry && v.carry.amount > 0) { sim.planDeliver(v); return true; }
    const fire = sim.campfire();
    if (fire && Math.hypot(v.x - fire.x - 1, v.y - fire.y - 1) > 4 && sim.pathLeft > 0) { sim.pathLeft--; v.path = sim.pathTo(v, Math.floor(fire.x + 1), Math.floor(fire.y + 2), 4000); if (v.path.length) { v.phase = 'move'; return true; } }
    sim.wait(v, 2); return true;
  }
  if (v.phase === 'skin') {
    v.timer -= dt; v.anim = 'build'; // crouched over the carcass
    if (v.timer > 0) return true;
    const a = sim.animalById.get(v.loot);
    v.phase = 'idle'; v.loot = -1;
    if (!a) return true;
    const have = v.carry && v.carry.res === 'food' ? v.carry.amount : 0, take = Math.min(a.meat, CARRY_CAP.food - have);
    if (take > 0) { a.meat -= take; v.carry = { res: 'food', amount: have + take }; sim.noteYield('hunt.food', take); }
    // the skin and everything else on the body goes straight to the store
    // a good the village cannot take yet (resources.json "unlock": the level of the Chòi thợ săn) is left on the body
    const got: string[] = [], left: string[] = [], bag: Partial<Record<Res, number>> = { ...a.drops };
    if (a.hide > 0) bag.hide = (bag.hide ?? 0) + a.hide;
    for (const [res, n] of Object.entries(bag) as Array<[Res, number]>) {
      if (!(n > 0)) continue;
      if (!resourceOpen(res, sim.buildings)) { const u = resourceUnlock(res)!; left.push(`${RES_NAME[res].toLowerCase()} (cần ${BUILDINGS[u.building as BuildingKind].name} cấp ${u.level})`); continue; }
      sim.stock[res] = Math.min(sim.capacity(res), sim.stock[res] + n); sim.noteYield(`hunt.${res}`, n); got.push(`${n} ${RES_NAME[res].toLowerCase()}`);
    }
    a.hide = 0; a.drops = {};
    if (got.length) sim.say(`${v.name} xẻ ${animalDef(a).name.toLowerCase()}: ${got.join(', ')}.`);
    if (left.length) sim.say(`${v.name} bỏ lại ${left.join(', ')}: chưa lấy được.`);
    return true;
  }
  if (v.phase === 'goCarcass') {
    const a = sim.animalById.get(v.loot);
    if (!a || a.state !== 'dead' || carcassEmpty(a)) { v.phase = 'idle'; v.loot = -1; v.path = []; return true; }
    if (Math.hypot(a.x - v.x, a.y - v.y) < 1.5) { v.path = []; v.phase = 'skin'; v.timer = BEHAVIOUR.skinSeconds; v.facing = a.x >= v.x ? 'right' : 'left'; return true; }
    if (!v.path.length) { v.path = sim.pathTo(v, Math.floor(a.x), Math.floor(a.y), 3000); if (!v.path.length) { v.phase = 'idle'; v.loot = -1; } }
    return true;
  }
  if (v.phase === 'move' && v.path.length) return true; // told to walk somewhere: arrive first, then hunt on
  if (v.carry && v.carry.amount >= CARRY_CAP[v.carry.res]) { sim.planDeliver(v); return true; }
  // a carcass waiting to be skinned
  const N = sim.world.size;
  const lodge = sim.building('huntlodge') ?? sim.campfire(), range = huntRange(sim);
  let best: Animal | null = null, bd = 45;
  if (v.loot >= 0) { const a = sim.animalById.get(v.loot); if (a && a.state === 'dead') best = a; else v.loot = -1; }
  if (!best) for (const a of sim.animals) {
    if (a.state !== 'dead' || carcassEmpty(a) || sim.fog.state[Math.floor(a.y) * N + Math.floor(a.x)] === 0) continue;
    const d = Math.hypot(a.x - v.x, a.y - v.y);
    if (d < bd) { bd = d; best = a; }
  }
  if (best) { v.loot = best.id; v.phase = 'goCarcass'; v.path = sim.pathTo(v, Math.floor(best.x), Math.floor(best.y), 3000); return true; }
  // living prey
  if (!threats.length) {
    let prey: Animal | null = null, bestScore = 0; // a hunter looks over all the explored ground within the range of his lodge and goes for the beast worth the most, not the nearest
    const cap = huntHpCap(sim.building('huntlodge')?.level ?? 1);
    for (const a of sim.animals) {
      const def = animalDef(a);
      if (a.state === 'dead' || !def.prey || sim.fog.state[Math.floor(a.y) * N + Math.floor(a.x)] === 0) continue;
      if (v.fight.skip && v.fight.skip.kind === 'animal' && v.fight.skip.id === a.id && sim.time < v.fight.skip.until) continue; // given up on: a fish in the water, a beast walled in
      if (lodge && Math.hypot(a.x - lodge.x, a.y - lodge.y) > range) continue;
      if (def.hp > cap) continue; // too big for what the lodge can send
      if (def.defends && !sim.packNear(v, a)) continue; // a boar is only taken on by a group
      const d = Math.hypot(a.x - v.x, a.y - v.y), score = preyValue(sim, a.species) / (1 + d / 12); // the worth of the beast, less the longer the way
      if (score > bestScore) { bestScore = score; prey = a; }
    }
    if (prey) { v.fight.target = { kind: 'animal', id: prey.id }; engage(sim, v, { kind: 'animal', a: prey }, 0); return true; }
  }
  if (v.carry && v.carry.amount > 0) { sim.planDeliver(v); return true; }
  if (v.phase === 'fight') { v.phase = 'idle'; v.path = []; }
  // no game in sight: go out and look for some, in a new direction each time, anywhere within the range of the lodge (unexplored ground too: walking there opens the map)
  if (lodge) {
    const step = Math.floor(sim.time / 8), spots: Array<[number, number, boolean]> = [];
    for (let t = 0; t < 10; t++) {
      const ang = hash2(v.id, step * 16 + t, 71) * Math.PI * 2, rad = 6 + hash2(v.id, step * 16 + t, 72) * (range - 6);
      const gx = Math.floor(lodge.x + Math.cos(ang) * rad), gy = Math.floor(lodge.y + Math.sin(ang) * rad);
      if (sim.world.inBounds(gx, gy) && !sim.world.isBlocked(gx, gy)) spots.push([gx, gy, sim.fog.state[gy * N + gx] === 0]);
    }
    spots.sort((p, q) => Number(q[2]) - Number(p[2])); // the unexplored first
    for (const [gx, gy] of spots) {
      if (sim.pathLeft <= 0) break;
      sim.pathLeft--;
      const path = sim.pathTo(v, gx, gy, 2500);
      if (path.length) { v.path = path; v.phase = 'move'; return true; }
    }
  }
  sim.wait(v, 1);
  return true;
}
