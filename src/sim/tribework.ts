/**
 * The daily life of the people of the other villages (src/data/npclife.json): the civilians cut wood, dig stone and gather, the soldiers patrol, hunt and scout,
 * so the land is not empty. It is only played where the player has people (the chunks round them): far away the people just stroll about the camp.
 */
import npc from '../data/npclife.json';
import paceJson from '../data/pace.json';
import { ANIMALS } from './combat';
import { BUILDINGS } from './buildings';
import { CHUNK } from './world';
import { TIER_YIELD, TOOL_OF_JOB } from './tools';
import type { WorkJob } from './jobs';
import type { Res, Stock } from './resources';
import type { Sim, Villager } from './sim';
import type { Tribe } from './tribes';

type Life = NonNullable<NonNullable<Villager['ai']>['life']>;
const WORK_OF: Record<string, 'wood' | 'stone' | 'food'> = { wood: 'wood', stone: 'stone', food: 'food' };
const GATHER = paceJson.gather as Record<string, number>;
const KIND_OF: Record<string, 'tree' | 'rock' | 'bush'> = { wood: 'tree', stone: 'rock', food: 'bush' };
const RES_OF: Record<string, Res> = { wood: 'wood', stone: 'stone', food: 'food' };
const chunkKey = (x: number, y: number): number => Math.floor(y / CHUNK) * 1024 + Math.floor(x / CHUNK);

/** The chunks round everyone of ours (where they stand and where they are heading): redone every second. */
export function refreshActive(sim: Sim): void {
  sim.active.clear();
  const n = npc.chunkReach;
  for (const v of sim.villagers) {
    if (v.health <= 0) continue;
    const end = v.path.length ? v.path[v.path.length - 1] : null;
    const spots: Array<[number, number]> = [[v.x, v.y]];
    if (end) spots.push([end[0], end[1]]);
    for (const [x, y] of spots) {
      const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
      for (let j = cy - n; j <= cy + n; j++) for (let i = cx - n; i <= cx + n; i++) sim.active.add(j * 1024 + i);
    }
  }
}
/** Is this place where we are looking: the chunks round our people? */
export const isActive = (sim: Sim, x: number, y: number): boolean => sim.active.has(chunkKey(x, y));

/** The tier of tool its people work with: the best of its campfire level. */
const toolTierOf = (t: Tribe): number => npc.toolTierByCamp[Math.min(npc.toolTierByCamp.length, Math.max(1, t.campLevel ?? 1)) - 1];

/** How far from the fire the land of a tribe reaches: the sight of its campfire at its level. */
export function tribeReach(t: Tribe): number {
  const lv = BUILDINGS.campfire.levels.stone!;
  return lv[Math.min(lv.length, Math.max(1, t.campLevel ?? 1)) - 1].sight;
}

/** Give up what he was doing: back to nothing, ready for the next stroll. */
export function endLife(sim: Sim, f: Villager): void {
  const ai = f.ai, L = ai?.life;
  if (!ai || !L) return;
  if (L.kind === 'gather') {
    const n = L.idx !== undefined && L.idx >= 0 ? sim.world.nodes.get(L.idx) : undefined;
    if (n && n.workers > 0) n.workers--;
    if (f.phase === 'work') f.phase = 'idle';
    const k = TOOL_OF_JOB[f.job as WorkJob];
    if (k) f.tools[k] = null; // the tool goes back to the camp
    f.job = 'idle';
  }
  ai.life = undefined; f.progress = 0; ai.wander = 3 + sim.frnd() * 6;
}

/** A free tile beside a node, or null. */
function standBeside(sim: Sim, idx: number): [number, number] | null {
  const N = sim.world.size, nx = idx % N, ny = (idx / N) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (!sim.world.isBlocked(nx + dx, ny + dy)) return [nx + dx, ny + dy];
  return null;
}

function pick(sim: Sim, weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let x = sim.frnd() * total;
  for (const [k, w] of Object.entries(weights)) { x -= w; if (x <= 0) return k; }
  return Object.keys(weights)[0];
}

/** The people of a free tribe that has something to do other than stroll. True while he is busy with it. */
export function lifeBrain(sim: Sim, f: Villager, t: Tribe, ai: NonNullable<Villager['ai']>, dt: number): boolean {
  if (!isActive(sim, f.x, f.y)) { if (ai.life) endLife(sim, f); return false; }
  const L = ai.life;
  if (L) return tickLife(sim, f, t, L, dt);
  if (ai.wander > 0 || f.path.length || ai.role === 'raider' || sim.pathLeft <= 0) return false;
  const r = sim.frnd(), reach = tribeReach(t), N = sim.world.size;
  if (ai.role === 'civ') {
    if (r >= npc.chances.work) return false;
    const job = pick(sim, npc.mix), kind = KIND_OF[job];
    for (let i = 0; i < 12; i++) {
      const a = sim.frnd() * Math.PI * 2, d = Math.sqrt(sim.frnd()) * reach, x = Math.floor(t.camp.x + Math.cos(a) * d), y = Math.floor(t.camp.y + Math.sin(a) * d);
      const n = sim.world.nodeAt(x, y);
      if (!n || n.kind !== kind || n.amount <= 0 || n.workers >= 1) continue;
      const stand = standBeside(sim, y * N + x);
      if (!stand) continue;
      sim.pathLeft--;
      const path = sim.pathTo(f, stand[0], stand[1], 2500);
      if (!path.length) continue;
      n.workers++; f.path = path; f.phase = 'move';
      ai.life = { kind: 'gather', idx: y * N + x, job, state: 'go', t: 0, units: 0 };
      return true;
    }
    return false;
  }
  // soldiers: hunt what lives on the land, patrol it, or scout out beyond it
  const c = npc.chances;
  if (r < c.hunt) {
    let best: { id: number; d: number } | null = null;
    for (const a of sim.animals) {
      if (a.state === 'dead' || !ANIMALS[a.species].prey) continue;
      const d = Math.hypot(a.x - t.camp.x, a.y - t.camp.y);
      if (d <= reach && (!best || d < best.d) && isActive(sim, a.x, a.y)) best = { id: a.id, d };
    }
    if (best) { f.fight.target = { kind: 'animal', id: best.id }; ai.life = { kind: 'hunt', id: best.id, t: 0 }; }
    return false;
  }
  if (r < c.hunt + c.patrol + c.scout) {
    const scout = r >= c.hunt + c.patrol, stops: Array<[number, number]> = [];
    for (let k = 0; k < (scout ? 1 : 3); k++) {
      const a = sim.frnd() * Math.PI * 2, d = scout ? reach * (1.5 + sim.frnd() * (npc.scoutReach - 1.5)) : reach * (0.5 + sim.frnd() * 0.45);
      stops.push([Math.floor(t.camp.x + Math.cos(a) * d), Math.floor(t.camp.y + Math.sin(a) * d)]);
    }
    stops.push([Math.floor(t.camp.x), Math.floor(t.camp.y)]);
    ai.life = { kind: scout ? 'scout' : 'patrol', stops, i: 0, t: 0 };
    return tickLife(sim, f, t, ai.life, 0);
  }
  return false;
}

function tickLife(sim: Sim, f: Villager, t: Tribe, L: Life, dt: number): boolean {
  L.t = (L.t ?? 0) + dt;
  if (L.t > npc.tripSeconds * (L.kind === 'gather' ? 1 : 3)) { endLife(sim, f); return false; }
  switch (L.kind) {
    case 'gather': {
      const n = sim.world.nodes.get(L.idx!), N = sim.world.size;
      if (!n || n.amount <= 0) { endLife(sim, f); return false; }
      if (L.state === 'go') {
        if (f.path.length) return true;
        if (Math.hypot((L.idx! % N) + 0.5 - f.x, ((L.idx! / N) | 0) + 0.5 - f.y) > 2.2) { endLife(sim, f); return false; }
        L.state = 'work'; f.phase = 'work'; f.job = WORK_OF[L.job!]; f.progress = 0; f.facing = (L.idx! % N) + 0.5 >= f.x ? 'right' : 'left';
        // he works with the best tool his village can make at its level (src/data/npclife.json "toolTierByCamp"), as we do with ours
        const k = TOOL_OF_JOB[f.job as WorkJob];
        if (k) f.tools[k] = { tier: toolTierOf(t), dur: 1e9 };
        return true;
      }
      f.path = []; f.phase = 'work'; f.job = WORK_OF[L.job!];
      f.progress += (dt * Math.max(0.2, 1 + (t.eco ?? 0))) / GATHER[L.job!];
      if (f.progress < 1) return true;
      const gain = Math.min(n.amount, TIER_YIELD[toolTierOf(t)]); // a better tool brings more from each stroke, as with ours
      f.progress -= 1; n.amount -= gain; L.units = (L.units ?? 0) + gain;
      const res = RES_OF[L.job!];
      t.stock[res as keyof Stock] = (t.stock[res as keyof Stock] ?? 0) + gain;
      if (n.amount <= 0) {
        const idx = L.idx!;
        n.workers = Math.max(0, n.workers - 1); L.idx = -1;
        sim.world.depleted(idx, (x, y) => ![...sim.villagers, ...sim.foes].some((o) => Math.floor(o.x) === x && Math.floor(o.y) === y));
        endLife(sim, f); return false;
      }
      if ((L.units ?? 0) >= npc.unitsPerTrip) { endLife(sim, f); return false; }
      return true;
    }
    case 'hunt': {
      const a = sim.animalById.get(L.id!);
      if (!a) { endLife(sim, f); return false; }
      if (a.state === 'dead') { if (a.meat > 0) { t.stock.food = (t.stock.food ?? 0) + a.meat; a.meat = 0; } endLife(sim, f); return false; }
      if (f.fight.skip && f.fight.skip.id === a.id && sim.time < f.fight.skip.until) { endLife(sim, f); return false; } // given up (src/data/chase.json): the hunt is over
      return false;
    }
    default: { // patrol, scout: walk the stops in turn
      if (f.path.length) { f.phase = 'move'; return true; }
      const stops = L.stops!;
      if ((L.i ?? 0) >= stops.length) { endLife(sim, f); return false; }
      const [x, y] = stops[L.i!++], free = sim.nearestFree(x, y, new Set());
      if (free && sim.pathLeft > 0) { sim.pathLeft--; f.path = sim.pathTo(f, free[0], free[1], 3000); if (f.path.length) f.phase = 'move'; }
      return true;
    }
  }
}
