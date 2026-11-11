import { cycleOf, RULES } from './combat';
import { armOf, engage, fireProjectile, resolve, swingTimes, weaponOf } from './battle';
import { swingCycle } from './statsys';
import { BUILDINGS, footOf, levelsOf } from './buildings';
import { UNIT_RULES } from './formations';
import type { Tribe } from './tribes';
import type { Sim, Villager } from './sim';

type Ai = NonNullable<Villager['ai']>;

/** What the men of a village do with a work or a march: break a fence, man a tower, march on the fire in a raid (brainfoe.ts picks which). */

/** A raider who cannot get where he is going for a few seconds turns on the nearest fence or gate. */
function noteStuck(sim: Sim, f: Villager, ai: Ai, dt: number, blocked: boolean): void {
  if (!blocked) { ai.stuck = 0; return; }
  ai.stuck = (ai.stuck ?? 0) + dt;
  if (ai.stuck < 3) return;
  const wall = sim.nearestWork(f.x, f.y, 16) ?? sim.nearestWork(f.x, f.y, 4, true);
  ai.stuck = 0;
  if (wall) ai.siege = wall.id;
}

/** Breaking a fence down: walk up to it and strike it. True while he is at it. */
export function siegeBrain(sim: Sim, f: Villager, ai: Ai, dt: number, threats: Array<{ d: number }>): boolean {
  if (!ai.siege) return false;
  if (threats.length && threats[0].d <= weaponOf(f).range + 1.5) return false; // someone in reach: fight him first
  const b = sim.getBuilding(ai.siege);
  if (!b) { ai.siege = 0; f.path = []; return false; } // it has fallen: the way is open
  const w = weaponOf(f), d = footOf(b), cx = b.x + d.w / 2, cy = b.y + d.h / 2;
  const dist = Math.hypot(cx - f.x, cy - f.y) - Math.max(d.w, d.h) / 2;
  if (dist <= (w.ranged ? 1.2 : w.range) + 0.6) {
    f.path = []; f.slide = null; f.phase = 'fight'; f.facing = cx >= f.x ? 'right' : 'left';
    if (f.atkCd <= 0 && !f.swing) {
      const { hitAt, end } = swingTimes(w.anim);
      f.swing = { t: 0, hitAt, end, target: { kind: 'unit', id: -1 } }; // the blow has no living target: the work takes it at once
      f.atkCd = cycleOf(w.cycle, f.stats.agi);
      sim.damageWork(b, (w.damage + (w.ranged ? 0 : RULES.strengthDamage * f.stats.str)) * (w.type === 'slash' ? 1.5 : 1));
    }
    return true;
  }
  f.fight.repath -= dt;
  if (!f.path.length && f.fight.repath <= 0) {
    const ring = sim.ringTiles(f, b.x, b.y, d.w, d.h);
    f.path = ring.length ? sim.pathTo(f, ring[0][0], ring[0][1], 4000) : [];
    f.fight.repath = 1;
    if (!f.path.length) { ai.siege = 0; return false; }
  }
  f.phase = 'move';
  return true;
}

/** A guard goes back to his post and stands there, looking out. */
export function keepPost(sim: Sim, f: Villager, ai: NonNullable<Villager['ai']>): void {
  const post = ai.post!, px = post.x + 0.5, py = post.y + 0.5;
  if (Math.hypot(f.x - px, f.y - py) > 0.8) {
    if (!f.path.length && sim.pathLeft > 0) { sim.pathLeft--; f.path = sim.pathTo(f, post.x, post.y, 3000); if (!f.path.length) ai.post = undefined; } // no way to it: he gives it up
    f.phase = f.path.length ? 'move' : 'idle';
  } else { f.phase = 'idle'; f.path = []; f.facing = post.face; }
}

/** The tower a guard mans (his `ai.tower`): its piece in the village and how far it sees (the sight of its level), or null when it has fallen. */
export function towerOf(sim: Sim, t: Tribe, ai: NonNullable<Villager['ai']>): { p: Tribe['props'][number]; reach: number } | null {
  const p = ai.tower ? t.props.find((q) => q.kind === 'tower' && q.x === ai.tower!.x && q.y === ai.tower!.y) : undefined;
  return p ? { p, reach: levelsOf('tower', sim.era)[(p.lv ?? 1) - 1]?.sight ?? 10 } : null;
}

/** The men of a tower stay up in it and loose arrows at whoever comes within its reach, as the archers of ours do (defense.tickTowers). */
export function towerBrain(sim: Sim, f: Villager, ai: Ai, tower: NonNullable<ReturnType<typeof towerOf>>, willing: boolean, threats: Array<{ t: Parameters<typeof resolve>[1]; d: number }>): void {
  keepPost(sim, f, ai);
  if (willing && threats.length && f.atkCd <= 0) {
    const w = weaponOf(f), e = resolve(sim, threats[0].t), from = { x: tower.p.x + tower.p.w / 2, y: tower.p.y + 0.4 };
    if (e && fireProjectile(sim, f, e, from, UNIT_RULES.archerOnTower.damage, Math.max(0, tower.reach - w.range - 1))) {
      f.atkCd = swingCycle(sim, f, w);
      // he is seen to shoot: he turns to the target and draws the bow (the blow has no living target, the arrow is already in the air)
      const { hitAt, end } = swingTimes(w.anim);
      f.swing = { t: 0, hitAt, end, target: { kind: 'unit', id: -1 } }; f.anim = w.anim; f.animClock = 0; f.facing = (e.kind === 'unit' ? e.v.x : e.a.x) >= f.x ? 'right' : 'left';
    }
  }
}

/** A raider marches on the village, fighting what stands in the way. */
export function raiderBrain(sim: Sim, f: Villager, t: Tribe, ai: Ai, dt: number, threats: Array<{ t: Parameters<typeof resolve>[1]; d: number }>): void {
  if (!t.raid) return;
  if (t.raid.phase === 'retreat') { if (!f.path.length && sim.pathLeft > 0 && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) > 4) { sim.pathLeft--; f.path = sim.pathTo(f, Math.floor(ai.camp.x), Math.floor(ai.camp.y), 20000); } f.phase = 'move'; return; }
  // the foot of a raid seek a tower of ours out and break it down (anyone in reach is fought first, see siegeBrain); the riders and the archers keep to their targets
  if (!ai.siege && f.fight.repath <= 0 && !f.path.length && armOf(f) === 'foot') {
    const towers = sim.buildings.filter((b) => b.kind === 'tower' && b.done).sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y));
    if (towers.length) ai.siege = towers[0].id;
  }
  if (siegeBrain(sim, f, ai, dt, threats)) return;
  if (f.fight.target) {
    const e = resolve(sim, f.fight.target);
    if (e) {
      engage(sim, f, e, dt);
      const ex = e.kind === 'unit' ? e.v.x : e.a.x, ey = e.kind === 'unit' ? e.v.y : e.a.y;
      noteStuck(sim, f, ai, dt, !f.path.length && !f.swing && Math.hypot(ex - f.x, ey - f.y) > weaponOf(f).range + 2);
      return;
    }
    f.fight.target = null; f.phase = 'idle';
  }
  if (threats.length) { f.fight.target = threats[0].t; return; }
  const fire = sim.campfire(), gx = fire ? fire.x + 1 : sim.world.start.x, gy = fire ? fire.y + 1 : sim.world.start.y;
  if (Math.hypot(gx - f.x, gy - f.y) > 6) {
    f.fight.repath -= dt;
    if (!f.path.length && f.fight.repath <= 0 && sim.pathLeft > 0) { sim.pathLeft--; f.path = sim.pathTo(f, Math.floor(gx), Math.floor(gy), 40000); f.fight.repath = f.path.length ? 0.5 : 1.5; }
    f.phase = 'move';
    noteStuck(sim, f, ai, dt, !f.path.length);
  }
  else { const v = sim.villagers.find((o) => o.health > 0 && o.down <= 0 && o.inside === null); if (v) f.fight.target = { kind: 'unit', id: v.id }; }
  return;
}
