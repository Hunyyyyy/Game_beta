import { ANIMALS, BEHAVIOUR, Species, SPECIES, zoneOf, type AnimalDef } from './combat';
import { hash2 } from './rng';
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

/** Fill the map with herds. Counts and zones come from animals.json; the start area stays calm. */
export function populate(sim: Sim): void {
  const N = sim.world.size, s = sim.world.start, rnd = sim.frnd;
  let herd = 1;
  for (const sp of SPECIES) {
    const def = ANIMALS[sp];
    let made = 0, guard = 0;
    while (made < def.count && guard++ < def.count * 60) {
      const x = Math.floor(rnd() * N), y = Math.floor(rnd() * N), d = Math.hypot(x - s.x, y - s.y);
      const z = zoneOf(d);
      if ((d < 16 && def.habitat !== 'water') || z < def.zones[0] || z > def.zones[1] || !habitable(sim, def, x, y)) continue;
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

export function spawnAnimal(sim: Sim, species: Species, x: number, y: number, herd: number, raid = false): Animal {
  const def = ANIMALS[species];
  const a: Animal = {
    id: sim.nextAid++, species, x, y, hp: def.hp, maxHp: def.hp, state: 'graze', dir: sim.frnd() < 0.5 ? 1 : -1, dest: null,
    timer: 2 + sim.frnd() * 6, cd: 0, scan: sim.frnd() * 0.5, target: null, herd, home: { x, y }, burst: 0, tired: 0,
    female: sim.frnd() < 0.5, raid, bite: 0, clock: sim.frnd() * 10, meat: 0, hide: 0, carcass: 0,
  };
  sim.animals.push(a); sim.animalById.set(a.id, a);
  return a;
}

/** Walk toward a point, sliding along obstacles. Returns false when completely stuck. */
function step(sim: Sim, a: Animal, tx: number, ty: number, speed: number, dt: number): boolean {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return true;
  const k = Math.min(d, speed * dt) / d, sx = dx * k, sy = dy * k, w = sim.world, water = ANIMALS[a.species].habitat === 'water';
  // wolves never step into firelight, whatever they are doing
  const fear = ANIMALS[a.species].fearsFire;
  if (fear) { const nf = fireDistance(sim, a.x + sx, a.y + sy); if (nf < fear && nf < fireDistance(sim, a.x, a.y)) return false; }
  const free = (x: number, y: number) => water ? isWater(sim, Math.floor(x), Math.floor(y)) : w.inBounds(Math.floor(x), Math.floor(y)) && !w.isBlocked(Math.floor(x), Math.floor(y));
  let moved = true;
  if (free(a.x + sx, a.y + sy)) { a.x += sx; a.y += sy; }
  else if (free(a.x + sx, a.y)) a.x += sx;
  else if (free(a.x, a.y + sy)) a.y += sy;
  else moved = false;
  if (Math.abs(sx) > 0.001) a.dir = sx > 0 ? 1 : -1;
  return moved;
}

const near = (sim: Sim, x: number, y: number) => {
  // nearest living player unit; foes and wild animals are ignored by animals
  let best: { id: number; d: number } | null = null;
  for (const v of sim.villagers) {
    if (v.down > 0) continue;
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
      if (a.carcass <= 0 || (a.meat <= 0 && a.hide <= 0)) { sim.animals.splice(i, 1); sim.animalById.delete(a.id); }
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
    const missing = def.count - alive.length;
    for (let i = 0; i < Math.max(0, missing); i++) {
      if (sim.frnd() > BEHAVIOUR.breedChance) continue;
      const mother = alive[Math.floor(sim.frnd() * alive.length)];
      spawnAnimal(sim, sp, mother.x + (sim.frnd() - 0.5) * 2, mother.y + (sim.frnd() - 0.5) * 2, mother.herd);
    }
  }
}

/** Turn a killed animal into a carcass that hunters can skin. */
export function die(sim: Sim, a: Animal): void {
  const def = animalDef(a);
  a.state = 'dead'; a.hp = 0; a.target = null; a.meat = def.meat; a.hide = def.hide; a.carcass = BEHAVIOUR.carcassSeconds;
}

void hash2;
