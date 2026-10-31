import { ANIMALS, BEHAVIOUR, Species, SPECIES, zoneOf, type AnimalDef } from './combat';
import type { Res } from './resources';
import { findPath, type Step } from './path';
import { CHUNK, CHUNKS } from './world';
import { hash2, mix32, mulberry32 } from './rng';
import type { Sim, Target } from './sim';
import { Tile } from './world';

export type AnimalState = 'graze' | 'wander' | 'flee' | 'attack' | 'sleep' | 'dead';

export interface Animal {
  id: number;
  species: Species;
  x: number; // tile units, like villagers
  y: number;
  hp: number;
  maxHp: number;
  state: AnimalState;
  dir: 1 | -1;           // facing: 1 = right
  dest: { x: number; y: number } | null;
  timer: number;         // seconds left in the current state
  cd: number;            // seconds until the next bite
  scan: number;          // seconds until the next look around
  target: Target | null; // who it is fighting
  herd: number;
  home: { x: number; y: number };
  burst: number;         // seconds spent running
  tired: number;         // seconds left of exhaustion after a long run
  female: boolean;
  /** Raiders (wolf packs from an event) hunt until dawn, then leave. */
  raid: boolean;
  bite: number;          // seconds left of the bite flash
  clock: number;         // animation clock
  // carcass
  meat: number;
  hide: number;
  /** Bone, fat, feathers and the like still on the body. */
  drops: Partial<Record<Res, number>>;
  carcass: number;       // seconds the body lasts
}

export const animalDef = (a: Animal): AnimalDef => ANIMALS[a.species];

const isGround = (sim: Sim, x: number, y: number) => {
  if (!sim.world.inBounds(x, y)) return false;
  const t = sim.world.at(x, y);
  return (t === Tile.Grass || t === Tile.Mud) && !sim.world.occ[y * sim.world.size + x];
};
const isWater = (sim: Sim, x: number, y: number) => sim.world.inBounds(x, y) && sim.world.at(x, y) === Tile.Water;
/** Can this species stand on the tile: land animals on ground, fish in water. */
const habitable = (sim: Sim, def: AnimalDef, x: number, y: number) => (def.habitat === 'water' ? isWater(sim, x, y) : isGround(sim, x, y));

/**
 * animals.json counts are for the first map, 192 tiles a side. Herds are laid down a chunk at a time as the land is made, in the same share of
 * the land (times SPARSE: fewer than before, so the land is not crowded and the loop over all the animals stays light).
 */
const SPARSE = 0.4;
const FIRST_AREA = 192 * 192;
const share = (): number => (CHUNK * CHUNK * SPARSE) / FIRST_AREA;
/** How many of a species the land made so far should hold: what breeding in spring builds the herds back up to. */
const countOf = (sim: Sim, def: AnimalDef): number => Math.round(def.count * share() * sim.world.ready.reduce((n, r) => n + r, 0));

/** Put the herds on one chunk of new land. The dice are the chunk's own, so a chunk holds the same herds whenever it is made. Counts and zones come from animals.json; the start area stays calm. */
export function populateChunk(sim: Sim, cx: number, cy: number): void {
  const w = sim.world, s = w.start, x0 = cx * CHUNK, y0 = cy * CHUNK;
  const rnd = mulberry32(mix32(sim.seed ^ Math.imul(cx + 1, 0x9e3779b1) ^ Math.imul(cy + 1, 0x85ebca6b)));
  let herd = 100000 + (cy * CHUNKS + cx) * 64;
  for (const sp of SPECIES) {
    const def = ANIMALS[sp], expected = (def.count / ((def.herd[0] + def.herd[1]) / 2)) * share();
    const herds = Math.floor(expected) + (rnd() < expected - Math.floor(expected) ? 1 : 0);
    for (let n = 0; n < herds; n++) {
      for (let tries = 0; tries < 8; tries++) {
        const x = x0 + Math.floor(rnd() * CHUNK), y = y0 + Math.floor(rnd() * CHUNK), d = Math.hypot(x - s.x, y - s.y);
        const z = zoneOf(d), far = z === 4 && def.zones[1] === 3 ? 3 : z; // the far lands beyond the last zone hold the ordinary wildlife too
        if ((d < 16 && def.habitat !== 'water') || far < def.zones[0] || far > def.zones[1] || !habitable(sim, def, x, y)) continue;
        const size = def.herd[0] + Math.floor(rnd() * (def.herd[1] - def.herd[0] + 1));
        for (let i = 0; i < size; i++) {
          const ax = x + (rnd() - 0.5) * 4, ay = y + (rnd() - 0.5) * 4;
          if (!w.isReady(Math.floor(ax), Math.floor(ay)) || !habitable(sim, def, Math.floor(ax), Math.floor(ay))) continue;
          spawnAnimal(sim, sp, ax, ay, herd);
        }
        herd++;
        break;
      }
    }
  }
}

export function spawnAnimal(sim: Sim, species: Species, x: number, y: number, herd: number, raid = false): Animal {
  const def = ANIMALS[species];
  const a: Animal = {
    id: sim.nextAid++, species, x, y, hp: def.hp, maxHp: def.hp, state: 'graze', dir: sim.frnd() < 0.5 ? 1 : -1, dest: null,
    timer: 2 + sim.frnd() * 6, cd: 0, scan: sim.frnd() * 0.5, target: null, herd, home: { x, y }, burst: 0, tired: 0,
    female: sim.frnd() < 0.5, raid, bite: 0, clock: sim.frnd() * 10, meat: 0, hide: 0, drops: {}, carcass: 0,
  };
  sim.animals.push(a); sim.animalById.set(a.id, a);
  return a;
}

/** Which way an animal turned last when something was in its way, so it keeps going round the same side instead of dithering in front of a wall. */
const turned = new WeakMap<Animal, number>();
/** Headings to try, as turns from straight on: ahead first, then ever wider to the side it turned last time. */
const TURNS = [0, 0.6, 1.2, 1.9, 2.6];

/** An animal that finds itself inside something (a tree grew, a house was raised, it was driven into water) is put on the nearest tile it may stand on. */
function unstick(sim: Sim, a: Animal): void {
  const def = animalDef(a), x = Math.floor(a.x), y = Math.floor(a.y);
  if (habitable(sim, def, x, y)) return;
  for (let r = 1; r <= 10; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (Math.max(Math.abs(i), Math.abs(j)) !== r || !habitable(sim, def, x + i, y + j)) continue;
    a.x = x + i + 0.5; a.y = y + j + 0.5; return;
  }
}

/** How an animal is getting on: where it was a moment ago and since when (a window of a second), to tell one that walks from one that only paces before a wall. */
const watch = new WeakMap<Animal, { x: number; y: number; t: number; at: number }>();
/** A way round an obstacle, found by the search when the steering alone does not get an animal anywhere; kept while its goal stays the same. */
const route = new WeakMap<Animal, { goal: string; path: Step[] }>();
let routeTick = -1, routeLeft = 0; // searches allowed in one tick, so that a crowd of stuck animals cannot stall the game

/**
 * Walk toward a point. Steering handles the small obstacles (it turns wider and wider to the side it chose last); an animal that makes no headway
 * for a second (a house, a field, a row of fences in front of it, which steering paces before for ever) gets a real path round it.
 * Returns false when it cannot get there at all: the caller then picks another place.
 */
function step(sim: Sim, a: Animal, tx: number, ty: number, speed: number, dt: number): boolean {
  const water = ANIMALS[a.species].habitat === 'water', key = `${Math.floor(tx / 2)},${Math.floor(ty / 2)}`;
  let gx = tx, gy = ty;
  const r = route.get(a);
  if (r && r.goal === key) {
    while (r.path.length && Math.hypot(r.path[0][0] + 0.5 - a.x, r.path[0][1] + 0.5 - a.y) < 0.45) r.path.shift();
    if (r.path.length) { gx = r.path[0][0] + 0.5; gy = r.path[0][1] + 0.5; } else route.delete(a);
  } else if (r) route.delete(a);
  const ok = steer(sim, a, gx, gy, speed, dt);
  if (water) return ok;
  let w = watch.get(a);
  if (!w || sim.time - w.at > 0.6) { w = { x: a.x, y: a.y, t: 0, at: sim.time }; watch.set(a, w); }
  w.t += dt; w.at = sim.time;
  if (w.t < 1) return ok;
  const gained = Math.hypot(a.x - w.x, a.y - w.y);
  w.x = a.x; w.y = a.y; w.t = 0;
  if (gained >= speed * 0.3 || route.has(a)) return ok;
  if (routeTick !== sim.time) { routeTick = sim.time; routeLeft = 6; }
  if (routeLeft <= 0) return ok;
  routeLeft--;
  const path = findPath(sim.world, Math.floor(a.x), Math.floor(a.y), Math.floor(tx), Math.floor(ty), 1500);
  if (!path.length) return false; // nowhere to go from here: let it choose another place
  route.set(a, { goal: key, path });
  return true;
}

/** One small step toward a point, turning aside from what is in the way. Returns false when completely stuck. */
function steer(sim: Sim, a: Animal, tx: number, ty: number, speed: number, dt: number): boolean {
  unstick(sim, a);
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return true;
  const len = Math.min(d, speed * dt), w = sim.world, water = ANIMALS[a.species].habitat === 'water';
  const sx = (dx / d) * len, sy = (dy / d) * len;
  // animals that fear fire (the fox and the lion; not the wolf) never step into firelight, whatever they are doing
  const fear = ANIMALS[a.species].fearsFire;
  if (fear) { const nf = fireDistance(sim, a.x + sx, a.y + sy); if (nf < fear && nf < fireDistance(sim, a.x, a.y)) return false; }
  const free = (x: number, y: number) => water ? isWater(sim, Math.floor(x), Math.floor(y)) : w.inBounds(Math.floor(x), Math.floor(y)) && !w.isBlocked(Math.floor(x), Math.floor(y));
  const base = Math.atan2(dy, dx), side = turned.get(a) ?? (a.id % 2 ? 1 : -1);
  for (const t of TURNS) for (const sgn of t === 0 ? [1] : [side, -side]) {
    const ang = base + t * sgn, mx = Math.cos(ang) * len, my = Math.sin(ang) * len;
    if (!free(a.x + mx, a.y + my)) continue;
    a.x += mx; a.y += my;
    if (t > 0) turned.set(a, sgn); else if (turned.has(a)) turned.delete(a);
    if (Math.abs(mx) > 0.001) a.dir = mx > 0 ? 1 : -1;
    return true;
  }
  if (Math.abs(sx) > 0.001) a.dir = sx > 0 ? 1 : -1;
  return false;
}

const near = (sim: Sim, x: number, y: number) => {
  // nearest living player unit; foes and wild animals are ignored by animals
  let best: { id: number; d: number } | null = null;
  for (const v of sim.villagers) {
    if (v.down > 0 || v.inside !== null) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (!best || d < best.d) best = { id: v.id, d };
  }
  return best;
};

/** Distance to the closest finished campfire; wolves keep away from fire. */
function fireDistance(sim: Sim, x: number, y: number): number {
  let best = Infinity;
  for (const b of sim.buildings) if (b.kind === 'campfire' && b.done) best = Math.min(best, Math.hypot(b.x + 1 - x, b.y + 1 - y));
  return best;
}

function wanderTo(sim: Sim, a: Animal, radius: number): void {
  const def = animalDef(a);
  if (def.habitat === 'water') radius = 4;
  for (let i = 0; i < 6; i++) {
    const ang = sim.frnd() * Math.PI * 2, r = 2 + sim.frnd() * radius;
    const x = a.home.x + Math.cos(ang) * r, y = a.home.y + Math.sin(ang) * r;
    if (habitable(sim, def, Math.floor(x), Math.floor(y))) { a.dest = { x, y }; return; }
  }
  a.dest = null;
}

/** Called by combat code when something hurts an animal: prey runs, defenders and predators fight back. */
export function provoke(sim: Sim, a: Animal, byId: number): void {
  if (a.state === 'dead') return;
  const def = animalDef(a);
  if (def.defends || def.aggro > 0 || (def.cornered && a.tired > 0)) { a.state = 'attack'; a.target = { kind: 'unit', id: byId }; a.timer = 14; }
  else { a.state = 'flee'; a.target = { kind: 'unit', id: byId }; a.timer = 8; }
  // the herd bolts together
  for (const o of sim.animals) {
    if (o !== a && o.herd === a.herd && o.state !== 'dead' && o.state !== 'attack' && Math.hypot(o.x - a.x, o.y - a.y) < 9 && !animalDef(o).defends) { o.state = 'flee'; o.target = { kind: 'unit', id: byId }; o.timer = 6; }
  }
}

export function tickAnimals(sim: Sim, dt: number): void {
  const night = sim.restTime;
  for (let i = sim.animals.length - 1; i >= 0; i--) {
    const a = sim.animals[i];
    a.clock += dt;
    if (a.state === 'dead') {
      a.carcass -= dt;
      if (a.carcass <= 0 || carcassEmpty(a)) { sim.animals.splice(i, 1); sim.animalById.delete(a.id); }
      continue;
    }
    const def = animalDef(a);
    a.timer -= dt; a.cd = Math.max(0, a.cd - dt); a.scan -= dt; a.bite = Math.max(0, a.bite - dt);
    if (a.tired > 0) a.tired -= dt;
    const slow = a.tired > 0 ? BEHAVIOUR.tiredSpeed : 1;

    // ---- look around a few times a second
    if (a.scan <= 0) {
      a.scan = 0.3 + sim.frnd() * 0.2;
      const p = near(sim, a.x, a.y);
      if (def.prey && def.flee > 0 && a.state !== 'flee' && p && p.d < def.flee && !(def.defends)) { a.state = 'flee'; a.target = { kind: 'unit', id: p.id }; a.timer = 6; a.burst = 0; }
      if (def.aggro > 0 && a.state !== 'attack' && p && (a.raid || (night && def.nocturnal)) && p.d < (a.raid ? 40 : def.aggro)) {
        const v = sim.get(p.id)!;
        if (fireDistance(sim, v.x, v.y) > (def.fearsFire ?? 0)) { a.state = 'attack'; a.target = { kind: 'unit', id: p.id }; a.timer = 20; }
      }
    }

    switch (a.state) {
      case 'flee': {
        const t = a.target && sim.get(a.target.id);
        if (!t || a.timer <= 0 || Math.hypot(t.x - a.x, t.y - a.y) > def.flee * 2) { a.state = 'graze'; a.timer = 3; a.target = null; a.dest = null; break; }
        a.burst += dt;
        if (a.burst > BEHAVIOUR.fleeBurst && a.tired <= 0) { a.tired = BEHAVIOUR.tiredSeconds; a.burst = 0; }
        const ax = a.x - t.x, ay = a.y - t.y, d = Math.hypot(ax, ay) || 1;
        const ok = step(sim, a, a.x + (ax / d) * 5, a.y + (ay / d) * 5, def.speed * slow, dt);
        if (!ok) { // cornered: slide sideways, deer kick back
          step(sim, a, a.x - (ay / d) * 5, a.y + (ax / d) * 5, def.speed * slow, dt);
          if (def.cornered && d < 1.4 && a.cd <= 0) { a.cd = def.cycle; a.bite = 0.25; sim.hurt({ kind: 'unit', id: t.id }, def.damage, def.type, { x: a.x, y: a.y }, { animal: a }); }
        }
        break;
      }
      case 'attack': {
        const t = a.target && sim.get(a.target.id);
        const lost = !t || t.down > 0 || a.timer <= 0 || (!a.raid && Math.hypot(t.x - a.x, t.y - a.y) > 16);
        if (lost) { a.state = 'graze'; a.target = null; a.timer = 3; if (a.raid && t === undefined) a.timer = 1; break; }
        const d = Math.hypot(t.x - a.x, t.y - a.y);
        // a wolf will not walk into firelight: it circles the edge instead
        if (def.fearsFire && fireDistance(sim, t.x, t.y) <= def.fearsFire && fireDistance(sim, a.x, a.y) < def.fearsFire + 1.5) { step(sim, a, a.home.x, a.home.y, def.speed, dt); break; }
        if (d > def.range + 0.4) step(sim, a, t.x, t.y, def.speed * slow, dt);
        else if (a.cd <= 0) {
          a.cd = def.cycle; a.bite = 0.25;
          const behind = (t.facing === 'right' && a.x < t.x) || (t.facing === 'left' && a.x > t.x);
          sim.hurt({ kind: 'unit', id: t.id }, def.damage * (behind ? 1.25 : 1), def.type, { x: a.x, y: a.y }, { animal: a });
        }
        break;
      }
      case 'sleep':
        if (!night || !def.nocturnal) { if (a.timer <= 0) { a.state = 'graze'; a.timer = 2; } }
        break;
      case 'wander': {
        if (!a.dest || !step(sim, a, a.dest.x, a.dest.y, def.speed * 0.45, dt) || Math.hypot(a.dest.x - a.x, a.dest.y - a.y) < 0.3) { a.state = 'graze'; a.timer = 3 + sim.frnd() * 8; a.dest = null; }
        break;
      }
      default: { // graze
        if (a.raid && !night) { // raiders leave at dawn
          step(sim, a, a.home.x, a.home.y, def.speed, dt);
          if (Math.hypot(a.home.x - a.x, a.home.y - a.y) < 2) { sim.animals.splice(i, 1); sim.animalById.delete(a.id); }
          break;
        }
        if (a.timer <= 0) {
          if (def.nocturnal && !night && !a.raid) { a.state = 'sleep'; a.timer = 4; break; }
          a.state = 'wander'; wanderTo(sim, a, BEHAVIOUR.regionRadius);
          if (a.raid && night) { const p = near(sim, a.x, a.y); if (p) a.dest = { x: sim.get(p.id)!.x, y: sim.get(p.id)!.y }; }
        }
      }
    }
  }
}

/** Spring: herds that fell below their usual size breed back, as long as two females remain. */
export function breed(sim: Sim): void {
  for (const sp of SPECIES) {
    const def = ANIMALS[sp];
    const alive = sim.animals.filter((a) => a.species === sp && a.state !== 'dead' && !a.raid);
    if (alive.filter((a) => a.female).length < BEHAVIOUR.breedMinFemales) continue;
    const missing = countOf(sim, def) - alive.length;
    for (let i = 0; i < Math.max(0, missing); i++) {
      if (sim.frnd() > BEHAVIOUR.breedChance) continue;
      const mother = alive[Math.floor(sim.frnd() * alive.length)];
      spawnAnimal(sim, sp, mother.x + (sim.frnd() - 0.5) * 2, mother.y + (sim.frnd() - 0.5) * 2, mother.herd);
    }
  }
}

/** Nothing left on the body worth skinning. */
export const carcassEmpty = (a: Animal): boolean => a.meat <= 0 && a.hide <= 0 && !Object.values(a.drops ?? {}).some((n) => (n ?? 0) > 0);

/** Turn a killed animal into a carcass that hunters can skin. */
export function die(sim: Sim, a: Animal): void {
  const def = animalDef(a);
  a.state = 'dead'; a.hp = 0; a.target = null; a.meat = def.meat; a.hide = def.hide; a.drops = { ...(def.drops ?? {}) }; a.carcass = BEHAVIOUR.carcassSeconds;
}

void hash2;
