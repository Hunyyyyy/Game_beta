/** Scouting: trips to learn a village, the maps they bring back (three levels, ageing) and the scouts who do not come home. */
import { ringOf, ringPower } from './combat';
import { DAY_LENGTH } from './constants';
import { COMMAND } from './formations';
import { RESEARCH } from './research';
import { tribeOf } from './tribes';
import type { Sim } from './sim';
import type { ScoutMap, ScoutMission } from './model';

/** How good a map still is: it loses a tenth a day as the enemy changes his ways. */
export const mapAccuracy = (sim: Sim, m: ScoutMap): number => Math.max(0, 1 - (COMMAND.mapDecayPerDay * (sim.time - m.at)) / DAY_LENGTH);

/** The best level of map we hold of a village that is still fresh enough to act on; a map with gaps counts one level less. */
export function mapLevel(sim: Sim, tribe: string): number {
  let best = 0;
  for (const m of sim.maps) if (m.tribe === tribe && mapAccuracy(sim, m) >= 0.4) best = Math.max(best, m.gaps > 0 ? m.level - 1 : m.level);
  return best;
}

const warriorsOf = (sim: Sim, tribe: string): number => { const t = tribeOf(sim, tribe as never); return t ? t.unitIds.filter((u) => sim.get(u)?.ai?.role !== 'civ').length : 0; };

/** Scouts a map of this level needs: its level plus one for every eight of their soldiers, at most eight. Fewer bring back a map with gaps. */
export const scoutsNeeded = (sim: Sim, tribe: string, level: number): number => Math.min(8, level + Math.floor(warriorsOf(sim, tribe) / 8));

/** Send villagers to scout a village for a map of the given level. Returns an error or null. */
export function startScout(sim: Sim, ids: readonly number[], tribe: string, level: number): string | null {
  if (RESEARCH.enabled && !sim.dev.freeBuild && !sim.researched.has('scout')) return 'Cần nghiên cứu: Trinh sát';
  const t = tribeOf(sim, tribe as never);
  if (!t) return 'Không có làng này';
  if (level < 1 || level > 3) return 'Bản đồ có ba cấp';
  if (level > 1 && mapLevel(sim, tribe) < level - 1 && !sim.dev.freeBuild) return `Cần bản đồ cấp ${level - 1} trước`;
  if (sim.scouts.some((m) => m.tribe === tribe)) return 'Đã có trinh sát đang đi làng này';
  const scouts = sim.mine(ids).filter((v) => v.health > 0 && v.inside === null).slice(0, 8);
  if (!scouts.length) return 'Chọn dân để cử đi trinh sát';
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  const dx = fx - t.camp.x, dy = fy - t.camp.y, len = Math.max(1, Math.hypot(dx, dy)), reach = Math.min(len, 15);
  const spotX = t.camp.x + (dx / len) * reach, spotY = t.camp.y + (dy / len) * reach;
  scouts.forEach((v, i) => {
    sim.resetTask(v); sim.clearCombat(v);
    const spot = sim.nearestFree(Math.floor(spotX + Math.cos(i * 2.4) * 2), Math.floor(spotY + Math.sin(i * 2.4) * 2), new Set()) ?? [Math.floor(spotX), Math.floor(spotY)];
    sim.orderMove([v.id], spot[0], spot[1]);
  });
  const need = scoutsNeeded(sim, tribe, level);
  sim.scouts.push({ id: sim.nextMission++, tribe, level, ids: scouts.map((v) => v.id), phase: 'go', t: 0, need, survivors: scouts.length });
  sim.say(`${scouts.length} trinh sát lên đường tới ${t.def.name} (bản đồ cấp ${level}, cần ${need} người cho đủ).${scouts.length < need ? ' Ít người hơn thế thì bản đồ sẽ bị hở.' : ''}`);
  return null;
}

/** The chance one scout is caught and killed: his own village's strength, daylight and his speed. */
function deathChance(sim: Sim, m: ScoutMission, agi: number): number {
  const t = tribeOf(sim, m.tribe as never)!, fire = sim.campfire();
  const power = warriorsOf(sim, m.tribe) * ringPower(ringOf(Math.hypot(t.camp.x - (fire?.x ?? 0), t.camp.y - (fire?.y ?? 0))));
  const day = sim.weather === 'clear' && !sim.resting;
  return Math.max(0.02, Math.min(0.9, 0.1 + power / 5 / 100 + (day ? 0.1 : 0) - (sim.resting ? 0.1 : 0) - Math.max(0, agi - 6) * 0.01));
}

export function tickScouts(sim: Sim, dt: number): void {
  for (let i = sim.scouts.length - 1; i >= 0; i--) {
    const m = sim.scouts[i], t = tribeOf(sim, m.tribe as never);
    const alive = m.ids.map((id) => sim.byId.get(id)).filter((v) => !!v && v.team === 'player' && v.health > 0) as NonNullable<ReturnType<Sim['get']>>[];
    m.ids = alive.map((v) => v.id);
    if (!alive.length || !t) { sim.say(alive.length ? 'Trinh sát bị hủy.' : 'Mất hết trinh sát: không có bản đồ nào về.'); sim.scouts.splice(i, 1); continue; }
    m.t += dt;
    if (m.phase === 'go') {
      const near = alive.every((v) => Math.hypot(v.x - t.camp.x, v.y - t.camp.y) < 22 && !v.path.length);
      if (near || m.t > 300) {
        m.phase = 'watch'; m.t = 0;
        for (const v of alive) if (sim.frnd() < deathChance(sim, m, v.stats.agi)) sim.killUnit(v, 'vì bị phát hiện khi trinh sát');
        m.survivors = alive.filter((v) => v.health > 0 && sim.byId.has(v.id)).length;
        sim.say(m.survivors ? `Trinh sát đang quan sát ${t.def.name}.` : 'Trinh sát bị bắt gặp, không ai thoát.');
      }
    } else if (m.phase === 'watch') {
      if (m.t >= 0.08 * m.level * DAY_LENGTH) {
        m.phase = 'back'; m.t = 0;
        const fire = sim.campfire();
        for (const id of m.ids) if (sim.byId.has(id) && fire) sim.orderMove([id], Math.floor(fire.x + 1), Math.floor(fire.y + 3));
      }
    } else {
      const fire = sim.campfire(), home = !fire || alive.every((v) => Math.hypot(v.x - fire.x, v.y - fire.y) < 7);
      if (home || m.t > 600) {
        const pieces = alive.length, gaps = Math.max(0, m.need - pieces);
        const old = sim.maps.findIndex((x) => x.tribe === m.tribe && x.level === m.level);
        const map: ScoutMap = { tribe: m.tribe, level: m.level, at: sim.time, gaps };
        if (old >= 0) sim.maps[old] = map; else sim.maps.push(map);
        sim.say(`Trinh sát về: bản đồ cấp ${m.level} của ${t.def.name}${gaps ? `, nhưng còn hở (thiếu ${gaps} mảnh)` : ' đầy đủ'}.`);
        sim.scouts.splice(i, 1);
      }
    }
  }
}
