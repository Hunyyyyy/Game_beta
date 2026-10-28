/** Getting around: paths, walking, standing places, and the pose a villager is drawn in. */
import { WEATHER } from './calendar';
import { JOBS, WorkJob } from './jobs';
import { findPath, Step } from './path';
import { TOOL_OF_JOB } from './tools';
import { poseOf } from './combat';
import { weaponOf } from './battle';
import type { Sim } from './sim';
import { Hold, Villager } from './model';

/** Ô trống gần (tx,ty) nhất, chưa bị ai giữ. */
export function nearestFree(sim: Sim, tx: number, ty: number, taken: Set<number>): [number, number] | null {
  const N = sim.world.size;
  for (let r = 0; r <= 12; r++) {
    let best: [number, number] | null = null, bd = Infinity;
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
        if (sim.world.isBlocked(x, y) || taken.has(y * N + x)) continue;
        const d = (x - tx) ** 2 + (y - ty) ** 2;
        if (d < bd) { bd = d; best = [x, y]; }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Follow the path and the final slide step; shared by villagers and tribal people. */
export function moveUnit(sim: Sim, v: Villager, dt: number): void {
  const walk = v.speed * WEATHER[sim.weather].speed * (v.phase === 'flee' ? 1.3 : 1) * (v.armor ? 1 : 1);
  if (v.swing) return; // a blow in progress plants the feet
  let left = walk * dt;
  while (left > 0 && v.path.length) {
    const [px, py] = v.path[0];
    const dx = px + 0.5 - v.x, dy = py + 0.5 - v.y, d = Math.hypot(dx, dy);
    if (d <= left) { v.x = px + 0.5; v.y = py + 0.5; left -= d; v.path.shift(); }
    else { v.x += (dx / d) * left; v.y += (dy / d) * left; left = 0; }
    if (d > 1e-6) v.facing = Math.abs(dx) > Math.abs(dy) * 1.1 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back';
  }
  // ---- bước trượt cuối: nhích sát vật thể trước khi làm ----
  if (!v.path.length && v.slide) {
    const s = v.slide, dx = s.x - v.x, dy = s.y - v.y, d = Math.hypot(dx, dy), step = walk * 0.7 * dt;
    if (d <= step) { v.x = s.x; v.y = s.y; v.slide = null; v.facing = s.face; }
    else { v.x += (dx / d) * step; v.y += (dy / d) * step; if (Math.abs(dx) > 0.02) v.facing = dx > 0 ? 'right' : 'left'; }
  }
}

/** Pick the animation and the item in hand from what the unit is doing. */
export function animate(sim: Sim, v: Villager, dt: number): void {
  let anim = 'idle', hold: Hold | null = null;
  const walking = v.path.length > 0 || !!v.slide;
  // Fighting has its own poses, apart from the work animations. Which ones depend on the weapon's style (weapons.json): see poseOf.
  const armed = (): Hold | null => { if (!v.weapon) return null; const w = weaponOf(v); return { kind: v.weapon, tier: w.tier ?? 1 }; };
  const ready = v.phase === 'fight' || v.fight.mode !== 'none';
  // soldiers and hunters keep their weapon in hand between tasks, so they can be told apart from civilians
  const carrying = !!v.weapon && (v.job === 'fight' || v.job === 'hunt');
  if (v.down > 0) anim = 'down';
  else if (v.swing) { anim = poseOf(v.weapon, 'attack'); hold = armed(); }
  else if (v.flinch > 0) anim = 'hit';
  else if (v.phase === 'flee') anim = 'run';
  else if (ready) { anim = poseOf(v.weapon, walking ? 'charge' : 'guard'); hold = armed(); }
  else if (walking) { anim = v.carry && v.carry.amount > 0 ? 'carry_walk' : 'walk'; if (carrying && !(v.carry && v.carry.amount > 0)) { anim = poseOf(v.weapon, 'walk'); hold = armed(); } }
  else if (carrying && v.phase === 'idle') { anim = poseOf(v.weapon, 'idle'); hold = armed(); }
  else if (v.phase === 'work' && v.job !== 'idle') {
    const k = TOOL_OF_JOB[v.job as WorkJob], tier = sim.toolTier(v, v.job);
    if (k && tier > 0) { anim = JOBS[v.job as WorkJob].anim === 'gather' ? 'dig' : JOBS[v.job as WorkJob].anim; hold = { kind: k, tier }; }
    else anim = 'gather';
  } else if (v.phase === 'build') {
    const t = sim.toolTier(v, 'build');
    if (t > 0) { anim = 'build'; hold = { kind: 'hammer', tier: t }; } else anim = 'gather';
  }
  else if (v.phase === 'skin') anim = 'gather';
  if (anim !== v.anim) { v.anim = anim; v.animClock = 0; } else v.animClock += dt;
  v.hold = hold;
}

/** Các ô trống quanh một hình chữ nhật, gần `v` nhất trước. */
export function ringTiles(sim: Sim, v: Villager, x: number, y: number, w: number, h: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
    if (i >= x && i < x + w && j >= y && j < y + h) continue;
    if (!sim.world.isBlocked(i, j)) out.push([i, j]);
  }
  // ưu tiên ô bên trái/phải để dân đứng ngang công trình
  const cost = (t: [number, number]) => Math.hypot(t[0] + 0.5 - v.x, t[1] + 0.5 - v.y) + (t[0] >= x && t[0] < x + w ? 1.5 : 0);
  out.sort((a, b) => cost(a) - cost(b));
  return out;
}

/**
 * Start tile for pathfinding. A work spot can overlap a blocked tile (a tree between two trees);
 * then use the nearest free neighbour, since A* cannot leave a blocked tile without cutting corners.
 */
export function standTile(sim: Sim, v: Villager): [number, number] {
  const fx = Math.floor(v.x), fy = Math.floor(v.y);
  if (!sim.world.isBlocked(fx, fy)) return [fx, fy];
  let best: [number, number] = [fx, fy], bd = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = fx + dx, y = fy + dy;
    if (sim.world.isBlocked(x, y)) continue;
    const d = Math.hypot(x + 0.5 - v.x, y + 0.5 - v.y);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}

/** Path from where the villager stands to (gx, gy); may end at the closest tile if unreachable. */
export function pathTo(sim: Sim, v: Villager, gx: number, gy: number, maxNodes = 14000): Step[] {
  const [sx, sy] = standTile(sim, v), off = sx !== Math.floor(v.x) || sy !== Math.floor(v.y);
  const p = gx === sx && gy === sy ? [] : findPath(sim.world, sx, sy, gx, gy, maxNodes);
  return off ? [[sx, sy] as Step, ...p] : p;
}

/** Thử đi tới một trong các ô; trả về chỉ số ô đã có đường tới (hoặc -1). */
export function routeTo(sim: Sim, v: Villager, tiles: Array<[number, number]>, tries = 3): number {
  const [sx, sy] = standTile(sim, v);
  for (let k = 0; k < Math.min(tries, tiles.length); k++) {
    const [gx, gy] = tiles[k];
    const p = pathTo(sim, v, gx, gy), last = p[p.length - 1];
    if ((gx === sx && gy === sy) || (last && last[0] === gx && last[1] === gy)) { v.path = p; return k; }
  }
  return -1;
}
