/**
 * The brain of a stage unit (missions.ts): the bandits, the hired killer and the one to be kept safe of a side quest played on the map. They belong to no village (teams `stage` and `ward`), so nothing of the
 * villages' bookkeeping knows them. A creature system like brainfoe.ts: it uses the fighting rules of battle.ts directly.
 */
import { engage, resolve, tickCommon, threatsOf } from './battle';
import type { Sim, Villager } from './sim';

const SIGHT = 9, LEASH = 14;
const far = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

export function tickStage(sim: Sim, f: Villager, dt: number): void {
  tickCommon(sim, f, dt);
  const ai = f.ai, st = ai?.stage;
  if (!ai || !st) return;
  if (st.kind === 'ward') { // the one to be kept safe: walks to his goal while a soldier of ours is near (an escort), or stands where he was put
    if (st.goal) {
      const led = sim.villagers.some((v) => v.job === 'fight' && v.health > 0 && v.inside === null && far(v, f) <= st.lead);
      if (!led) { f.path = []; f.phase = 'idle'; return; }
      if (!f.path.length && far(f, st.goal) > 1.5) { // the way is walked in legs of about ten tiles toward the goal (a long path is not searched whole)
        const d = far(f, st.goal), k = Math.min(1, 10 / d), tx = f.x + (st.goal.x - f.x) * k, ty = f.y + (st.goal.y - f.y) * k;
        const at = d <= 10 ? [Math.floor(st.goal.x), Math.floor(st.goal.y)] : sim.nearestFree(Math.floor(tx), Math.floor(ty), new Set());
        if (at) f.path = sim.pathTo(f, at[0], at[1], 6000, true);
      }
    }
    f.phase = f.path.length ? 'move' : 'idle';
    return;
  }
  // a bandit or a killer: fights soldiers and the one who is kept safe, never the common villagers; a killer goes straight for his mark
  f.fight.scan -= dt;
  if (f.fight.scan <= 0) {
    f.fight.scan = 0.4;
    const mark = st.mark !== undefined ? sim.get(st.mark) : undefined;
    const seen = threatsOf(sim, f, SIGHT).filter((x) => x.fighter || (x.t.kind === 'unit' && sim.get(x.t.id)?.team === 'ward'));
    if (st.kind === 'killer' && mark && mark.health > 0 && !(f.fight.target && seen.some((x) => x.d < 2.5))) f.fight.target = { kind: 'unit', id: mark.id };
    else if (!resolve(sim, f.fight.target) && seen.length) f.fight.target = seen[0].t;
  }
  const e = resolve(sim, f.fight.target);
  if (e && (st.kind === 'killer' || far(f, ai.camp) < LEASH)) { engage(sim, f, e, dt); return; }
  f.fight.target = null;
  if (f.phase === 'fight') { f.phase = 'idle'; f.path = []; }
  if (!f.path.length && far(f, ai.camp) > 3) f.path = sim.pathTo(f, Math.floor(ai.camp.x), Math.floor(ai.camp.y), 3000); // back to the camp
  f.phase = f.path.length ? 'move' : 'idle';
}
