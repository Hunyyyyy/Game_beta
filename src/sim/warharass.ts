/**
 * Harassment (data/war.json `harass`): the village under attack knows an army is coming, so while ours is out on the march it sends small bands to
 * pester it. They are extra men, not taken from the guards of the village, so they do not thin its defence; they die, or give up and vanish after `life`.
 */
import { applyStats } from './statsys';
import { engage, resolve } from './battle';
import { WEAPONS } from './combat';
import { WAR_DATA } from './warmarch';
import type { Plan, Villager } from './model';
import type { Sim } from './sim';
import type { Tribe } from './tribes';

export const HARASS = WAR_DATA.harass;

/** The middle of the army of the plan, in tiles (the soldiers of its squads), or null when there is none. */
export function focusOf(sim: Sim, plan: Plan): { x: number; y: number } | null {
  const us = plan.missions.flatMap((m) => { const s = sim.squadById(m.squad); return s ? sim.squadUnits(s) : []; });
  return us.length ? { x: us.reduce((a, v) => a + v.x, 0) / us.length, y: us.reduce((a, v) => a + v.y, 0) / us.length } : null;
}

const alive = (sim: Sim): Villager[] => sim.foes.filter((f) => f.ai?.harass !== undefined && f.health > 0);

/** One harasser each tick: close with what he meets, else go for the army. Returns true when he has decided (the ordinary foe brain is skipped). */
export function harassBrain(sim: Sim, f: Villager, dt: number, threats: Array<{ t: NonNullable<Villager['fight']['target']> }>): boolean {
  if (f.fight.target) {
    const e = resolve(sim, f.fight.target);
    if (e) { engage(sim, f, e, dt); return true; }
    f.fight.target = null; f.phase = 'idle';
  }
  if (threats.length) { f.fight.target = threats[0].t; return true; }
  const c = sim.warFocus;
  if (!c) return true;
  if (Math.hypot(c.x - f.x, c.y - f.y) > 6) {
    f.fight.repath -= dt;
    if (!f.path.length && f.fight.repath <= 0 && sim.pathLeft > 0) { sim.pathLeft--; f.path = sim.pathTo(f, Math.floor(c.x), Math.floor(c.y), 40000); f.fight.repath = f.path.length ? 1 : 2; }
    f.phase = f.path.length ? 'move' : 'idle';
  }
  return true;
}

/** Send a band at the army: it appears on the way between the army and the village, `spawnDist` tiles from the army (or at the village if that is nearer). */
function send(sim: Sim, t: Tribe, c: { x: number; y: number }): void {
  const warriors = t.unitIds.filter((u) => { const f = sim.get(u); return !!f && f.health > 0 && f.ai?.role !== 'civ' && f.ai?.harass === undefined; }).length;
  const room = HARASS.maxAlive - alive(sim).length;
  const n = Math.min(room, Math.max(HARASS.base, Math.min(HARASS.max, Math.round(HARASS.base + warriors / HARASS.perWarriors))));
  if (n <= 0) return;
  const dx = t.camp.x - c.x, dy = t.camp.y - c.y, len = Math.max(1, Math.hypot(dx, dy)), d = Math.min(HARASS.spawnDist, len);
  const gx = c.x + (dx / len) * d, gy = c.y + (dy / len) * d;
  sim.world.ensure(gx, gy, 12);
  const melee = t.def.weapons.filter((w) => !WEAPONS[w]?.ranged), taken = new Set<number>();
  for (let i = 0; i < n; i++) {
    const spot = sim.nearestFree(Math.floor(gx) + (i % 3) - 1, Math.floor(gy) + Math.floor(i / 3) - 1, taken); if (!spot) continue;
    taken.add(spot[1] * sim.world.size + spot[0]);
    const f = sim.makeVillager(spot[0], spot[1], sim.frnd() < 0.5 ? 'm' : 'f', t.id, sim.frnd);
    f.look.hide = t.def.look.hide; f.look.pants = t.def.look.pants;
    f.weapon = i % 3 === 2 ? t.def.weapons[i % t.def.weapons.length] : melee[i % Math.max(1, melee.length)] ?? f.weapon; f.armor = null;
    f.ai = { role: 'raider', camp: t.camp, wander: 0, goal: null, raid: -1, harass: sim.time };
    sim.addFoe(f); t.unitIds.push(f.id);
    applyStats(sim, f); f.health = f.maxHealth;
  }
  sim.say(`${t.def.name} cho ${n} người ra quấy rối quân ta!`);
}

/** Once a second while a war is on: work out where the army is, send a band now and then, and send home the ones who have been out too long. */
export function tickHarass(sim: Sim, plan: Plan): void {
  const t = sim.tribes.find((x) => x.id === plan.tribe), c = focusOf(sim, plan);
  sim.warFocus = c;
  for (const f of alive(sim)) if (!t || t.state !== 'free' || sim.time - f.ai!.harass! > HARASS.life || !c) remove(sim, f, t);
  if (!t || t.state !== 'free' || !c) return;
  const fire = sim.campfire(), home = fire ? { x: fire.x + 1, y: fire.y + 1 } : sim.world.start;
  const out = Math.hypot(c.x - home.x, c.y - home.y), near = Math.hypot(c.x - t.camp.x, c.y - t.camp.y);
  if (out < HARASS.minFromVillage || near > HARASS.range) { sim.warHarassAt = -1; return; } // not out on the road yet, or still far from them
  if (sim.warHarassAt < 0) sim.warHarassAt = sim.time + HARASS.first; // they notice an army on the road: the first band comes after a while
  if (sim.time >= sim.warHarassAt) { send(sim, t, c); sim.warHarassAt = sim.time + HARASS.every; }
}

function remove(sim: Sim, f: Villager, t: Tribe | undefined): void {
  sim.removeFoe(f);
  if (t) t.unitIds = t.unitIds.filter((u) => u !== f.id);
}

/** The war is over: no harasser stays. */
export function clearHarass(sim: Sim): void {
  for (const f of sim.foes.filter((x) => x.ai?.harass !== undefined)) remove(sim, f, sim.tribes.find((x) => x.id === f.team));
  sim.warFocus = null; sim.warHarassAt = -1;
}
