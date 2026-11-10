/**
 * The land answers our conquests. When we have taken three villages (adopted or wiped out) a new village arrives some days later (the sixth, then the seventh: `LATE_TRIBES`) and takes back one
 * or two of the villages we hold: a village we took returns to its place, hostile and an ally of the newcomer; a tributary stops paying and turns on us. What a village taken gave for good (people,
 * places in the camps, yield) goes with it, but what it already paid (the bag, the tribute) stays ours. Pure rules over the Sim, called by tribes.ts, which hands over what it alone can do (`Deps`).
 */
import { DIFF } from './difficulty';
import type { TierId } from './difficulty';
import { BANDIT_TRIBES, LATE_TRIBES, TRIBES } from './combat';
import type { TribeId } from './combat';
import type { Sim } from './sim';
import type { Tribe } from './tribes';

/** What tribes.ts hands over: putting a village on the map, and taking one off it. */
export interface Deps { spawn: (sim: Sim, id: TribeId, tier: TierId) => void; remove: (sim: Sim, t: Tribe) => void; retier: (sim: Sim, t: Tribe, tier: TierId) => void }

/** Once a day: schedule the arrival when three villages are ours, and bring the newcomer when its day comes. */
export function tickFrontier(sim: Sim, deps: Deps): void {
  tickBandits(sim, deps);
  const f = sim.frontier, c = DIFF.capture.retake;
  if (f.late >= c.maxLate) return;
  if (f.next === 0) { // nothing is on its way: three villages taken make a newcomer set out, after a while (not on the very day)
    if (sim.conquests.length >= c.after) f.next = sim.day + c.delayMin + Math.floor(sim.frnd() * (c.delayMax - c.delayMin + 1));
    return;
  }
  if (sim.day < f.next) return;
  f.next = 0;
  arrive(sim, deps);
}

/**
 * The camps of bandits: two of them stand in the land. Every 2 or 3 days each changes its strength (weak, middling or strong, drawn at random) whether or not we have wiped it out, so that there is
 * always something to fight and the fight is never the same; a camp wiped out is put up again after a few days (tribes.crushBandit sets the day).
 */
function tickBandits(sim: Sim, deps: Deps): void {
  const c = DIFF.capture.bandit, f = sim.frontier, roll = (a: number, b: number) => a + Math.floor(sim.frnd() * (b - a + 1)), strength = (): TierId => c.strengths[Math.floor(sim.frnd() * c.strengths.length)] as TierId;
  for (const id of BANDIT_TRIBES) {
    const t = sim.tribes.find((q) => q.id === id);
    if (!t) {
      if ((f.bandit[id] ?? 0) > sim.day) continue;
      deps.spawn(sim, id, strength());
      const made = sim.tribes.find((q) => q.id === id);
      if (made) { made.rerollAt = sim.day + roll(c.rerollMin, c.rerollMax); delete f.bandit[id]; }
      continue;
    }
    if (sim.day >= (t.rerollAt ?? 0)) { deps.retier(sim, t, strength()); t.rerollAt = sim.day + roll(c.rerollMin, c.rerollMax); }
  }
}

/** A village we took, or a tributary, that the newcomer may take back (never a chief: they stand for the age). */
interface Prey { name: string; take: () => void }

function arrive(sim: Sim, deps: Deps): void {
  const f = sim.frontier, id = LATE_TRIBES[f.late];
  if (!id || sim.tribes.some((t) => t.id === id)) { f.late++; return; }
  const prey: Prey[] = [];
  for (const q of sim.conquests) {
    if (q.tier === 'boss' || q.tier === 'rebel') continue;
    prey.push({ name: TRIBES[q.id as TribeId].name, take: () => retakeConquest(sim, deps, q.id as TribeId, id) });
  }
  for (const t of sim.tribes) if (t.state === 'tribute' && !t.boss && !t.rebel) prey.push({ name: t.def.name, take: () => { t.state = 'free'; t.relation = -100; t.tributeShare = undefined; t.tributeFree = undefined; t.raid = null; t.allyOf = id; } });
  if (!prey.length) { f.next = sim.day + 1; return; } // nothing of ours to take back yet: it waits a day
  deps.spawn(sim, id, 'medium');
  const L = sim.tribes.find((t) => t.id === id);
  if (!L) { f.late++; return; }
  f.late++;
  L.relation = -80; L.state = 'free';
  const k = Math.min(prey.length, 1 + (sim.frnd() < 0.5 ? 1 : 0));
  for (let i = prey.length - 1; i > 0; i--) { const j = Math.floor(sim.frnd() * (i + 1)); [prey[i], prey[j]] = [prey[j], prey[i]]; }
  const taken = prey.slice(0, k);
  for (const p of taken) p.take();
  sim.say(`${L.def.name} xuất hiện và lấy lại ${taken.map((p) => p.name).join(', ')} làm đồng minh! Họ trở thành kẻ thù của ta.`);
}

/** A village we took comes back to its place as an enemy, and what it gave for good is taken from us. */
function retakeConquest(sim: Sim, deps: Deps, id: TribeId, by: TribeId): void {
  const at = sim.conquests.findIndex((q) => q.id === id);
  if (at < 0) return;
  const q = sim.conquests[at];
  sim.conquests.splice(at, 1);
  sim.conquered = Math.max(0, sim.conquered - 1); sim.popBonus = Math.max(0, sim.popBonus - q.pop); sim.campBonus = Math.max(0, sim.campBonus - q.slots); sim.yieldBonus = Math.max(0, sim.yieldBonus - q.yieldPct);
  const old = sim.tribes.find((t) => t.id === id);
  if (old) deps.remove(sim, old); // a wiped-out village may still be on the list
  deps.spawn(sim, id, q.tier as TierId);
  const back = sim.tribes.find((t) => t.id === id);
  if (back) { back.state = 'free'; back.relation = -100; back.allyOf = by; back.spoiledIn = sim.era; } // its bag was paid once in this age: it pays no second one
}
