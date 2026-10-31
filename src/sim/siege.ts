/**
 * War on the ground. Things in the way (trees, rocks and bushes in a formation's cells or on an arrow, the works of an enemy village) and soldiers breaking them down;
 * a squad on its arrow, which walks it in straight lines and does not find its own way: when the tiles ahead are shut it halts and tells the player, who can send
 * some soldiers to break the thing down; and at the end of the arrow, the squad going for what the arrow points at, and once that is gone, for everything about.
 */
import { RULES, SIEGE } from './combat';
import { swingCycle, weaponDamage } from './statsys';
import { armOf, swingTimes, threatsOf, weaponOf } from './battle';
import { FORMATIONS, formationOffsets, placeOffset } from './formations';
import { Tile } from './world';
import type { Sim } from './sim';
import type { Breaking, Mission, Obstacle, Plan, Pt, Squad, Villager } from './model';

export const NODE_NAME = { tree: 'cây', rock: 'đá', bush: 'bụi quả' } as const;
export const PROP_NAME: Record<string, string> = { fire: 'Đống lửa', pile: 'Kho lương', tower: 'Chòi canh', fence: 'Hàng rào', gate: 'Cổng' };

type Tribe = Sim['tribes'][number];
type Prop = Tribe['props'][number];

/** Strength of a work of a village when it is raised. */
export const propHp = (kind: string): number => SIEGE.propHp[kind] ?? 60;

/** The work of an enemy village that stands on the tile. */
export function propOnTile(sim: Sim, x: number, y: number): { tribe: Tribe; prop: Prop } | undefined {
  for (const tribe of sim.tribes) for (const prop of tribe.props) if (x >= prop.x && x < prop.x + prop.w && y >= prop.y && y < prop.y + prop.h) return { tribe, prop };
  return undefined;
}

/** What shuts the tile to walkers, or null when it is open. */
export function obstacleAt(sim: Sim, x: number, y: number): Obstacle | null {
  const w = sim.world, N = w.size;
  if (!w.inBounds(x, y)) return { kind: 'wall', x, y, label: 'rìa bản đồ', clear: false };
  const node = w.nodeAt(x, y);
  if (node) return { kind: node.kind, x, y, label: NODE_NAME[node.kind], clear: true };
  const t = w.at(x, y);
  if (t === Tile.Water) return { kind: 'water', x, y, label: 'nước', clear: false };
  if (w.occ[y * N + x]) {
    const found = propOnTile(sim, x, y);
    if (found) return { kind: 'enemy', x: found.prop.x, y: found.prop.y, label: PROP_NAME[found.prop.kind] ?? 'công trình', clear: true, tribe: found.tribe.id };
    const b = sim.buildingAt(x, y);
    return b ? { kind: 'ours', x, y, label: 'công trình của làng', clear: false } : { kind: 'wall', x, y, label: 'vật cản', clear: false };
  }
  if (t !== Tile.Grass && t !== Tile.Mud) return { kind: 'wall', x, y, label: 'vật cản', clear: false };
  return null;
}

/** The first thing that shuts the straight way from a point to another, looking at most `reach` tiles; the tile the walker stands on is not counted. */
export function firstBlock(sim: Sim, from: Pt, to: Pt, reach = Infinity, skip?: (o: Obstacle) => boolean): Obstacle | null {
  const d = Math.hypot(to.x - from.x, to.y - from.y), n = Math.ceil(Math.min(d, reach) * 2), sx = Math.floor(from.x), sy = Math.floor(from.y);
  for (let i = 1; i <= n; i++) {
    const f = Math.min(d, reach) / d * (i / n) || 0, x = Math.floor(from.x + (to.x - from.x) * f), y = Math.floor(from.y + (to.y - from.y) * f);
    if (x === sx && y === sy) continue;
    const o = obstacleAt(sim, x, y);
    if (o && !(skip && skip(o))) return o;
  }
  return null;
}

/** For each leg of an arrow, the first thing on it that shuts the way (null: open). `target` is a work the arrow points at, which is the aim and not an obstacle. */
export function pathHits(sim: Sim, start: Pt, pts: readonly Pt[], target?: Pt): Array<Obstacle | null> {
  const skip = (o: Obstacle) => o.kind === 'enemy' && !!target && Math.abs(o.x - target.x) < 3 && Math.abs(o.y - target.y) < 3;
  let at = start;
  return pts.map((p) => { const o = firstBlock(sim, at, p, Infinity, skip); at = p; return o; });
}

/** Every tree, rock or bush within two tiles of an arrow (the width of a formation), nearest to the start first: what the supply squad clears. */
export function corridorBlocks(sim: Sim, start: Pt, pts: readonly Pt[], target?: Pt): Obstacle[] {
  const out = new Map<number, Obstacle>(), N = sim.world.size;
  let at = start;
  for (const p of pts) {
    const d = Math.hypot(p.x - at.x, p.y - at.y), n = Math.max(1, Math.ceil(d * 2));
    for (let i = 0; i <= n; i++) {
      const cx = Math.floor(at.x + ((p.x - at.x) * i) / n), cy = Math.floor(at.y + ((p.y - at.y) * i) / n);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const o = obstacleAt(sim, cx + dx, cy + dy);
        if (o && o.clear && o.kind !== 'enemy' && !(target && Math.hypot(o.x - target.x, o.y - target.y) < 2)) out.set(o.y * N + o.x, o);
      }
    }
    at = p;
  }
  return [...out.values()];
}

/** The straight run of tiles from a walker to a point, up to the first shut tile (not included). */
export function lineSteps(sim: Sim, from: Pt, to: Pt): Array<[number, number]> {
  const out: Array<[number, number]> = [], d = Math.hypot(to.x - from.x, to.y - from.y), n = Math.ceil(d * 2);
  let lx = Math.floor(from.x), ly = Math.floor(from.y);
  for (let i = 1; i <= n; i++) {
    const x = Math.floor(from.x + ((to.x - from.x) * i) / n), y = Math.floor(from.y + ((to.y - from.y) * i) / n);
    if (x === lx && y === ly) continue;
    if (sim.world.isBlocked(x, y)) break;
    out.push([x, y]); lx = x; ly = y;
  }
  return out;
}

// ---------------------------------------------------------------- what is being broken
/** The thing a soldier is breaking, as a box on the map; null once it is gone. */
export function breakBox(sim: Sim, b: Breaking): { x: number; y: number; w: number; h: number } | null {
  if (b.kind === 'node') return sim.world.nodeAt(b.x, b.y) ? { x: b.x, y: b.y, w: 1, h: 1 } : null;
  const p = sim.tribes.find((t) => t.id === b.tribe)?.props.find((q) => q.x === b.x && q.y === b.y);
  return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
}

/** A soldier sets about breaking something down. With `home` he goes back to that place afterwards. */
export function startBreaking(sim: Sim, v: Villager, ob: Obstacle, home?: Pt): boolean {
  if (v.job !== 'fight' || v.down > 0 || !ob.clear) return false;
  sim.resetTask(v); sim.clearCombat(v);
  if (home) { v.fight.mode = 'guard'; v.fight.anchor = { x: home.x, y: home.y }; }
  v.breaks = ob.kind === 'enemy' ? { kind: 'prop', x: ob.x, y: ob.y, tribe: ob.tribe } : { kind: 'node', x: ob.x, y: ob.y };
  v.progress = 0;
  return true;
}

function stopBreaking(v: Villager): void { v.breaks = null; v.progress = 0; if (v.phase === 'fight' || v.phase === 'move') { v.phase = 'idle'; v.path = []; } }

/** A tree, rock or bush is gone: the ground is bare (a felled tree leaves nothing) and everyone who was at it is done. */
export function clearNode(sim: Sim, x: number, y: number): void {
  const w = sim.world, i = y * w.size + x, n = w.nodes.get(i);
  if (!n) return;
  for (const o of sim.villagers) {
    if (o.breaks?.kind === 'node' && o.breaks.x === x && o.breaks.y === y) stopBreaking(o);
    else if (o.target === i && (o.phase === 'goNode' || o.phase === 'work')) sim.resetTask(o); // a gatherer who was at it looks for another
  }
  w.nodes.delete(i); w.tiles[i] = Tile.Grass;
}

/** A blow on a work of an enemy village; at zero it falls and the ground it stood on is open. */
export function damageProp(sim: Sim, tribeId: string, x: number, y: number, dmg: number): void {
  const t = sim.tribes.find((q) => q.id === tribeId), i = t ? t.props.findIndex((q) => q.x === x && q.y === y) : -1;
  if (!t || i < 0) return;
  const p = t.props[i];
  p.hp = (p.hp ?? propHp(p.kind)) - dmg;
  t.angryUntil = Math.max(t.angryUntil, sim.time + 120);
  if (p.hp > 0) return;
  t.props.splice(i, 1);
  const N = sim.world.size;
  for (let j = 0; j < p.h; j++) for (let k = 0; k < p.w; k++) sim.world.occ[(p.y + j) * N + p.x + k] = 0;
  sim.say(`${PROP_NAME[p.kind] ?? 'Công trình'} của ${t.def.name} đã bị phá.`);
  sim.noteBattle('note', `${PROP_NAME[p.kind] ?? 'Công trình'} của ${t.def.name} bị phá.`);
  sim.noteBattle('breach');
}

/**
 * One tick of a soldier who is breaking something: walk up to it, strike. A tree, rock or bush gives way to the sum of the soldiers at it (fast, and yielding nothing);
 * a work of the enemy takes blows from his weapon. Anybody in reach of an enemy stops and fights him. True while he is at it.
 */
export function breakBrain(sim: Sim, v: Villager, dt: number): boolean {
  const b = v.breaks;
  if (!b) return false;
  const box = breakBox(sim, b);
  if (!box) { stopBreaking(v); return false; }
  v.fight.scan -= dt;
  if (v.fight.scan <= 0) { v.fight.scan = 0.4; if (threatsOf(sim, v, 3.5).length) { stopBreaking(v); return false; } }
  const w = weaponOf(v), dx = Math.max(box.x - v.x, 0, v.x - (box.x + box.w)), dy = Math.max(box.y - v.y, 0, v.y - (box.y + box.h));
  if (Math.hypot(dx, dy) <= SIEGE.reach + (b.kind === 'prop' && !w.ranged ? w.range * 0.5 : 0)) {
    v.path = []; v.slide = null; v.phase = 'fight'; v.facing = box.x + box.w / 2 >= v.x ? 'right' : 'left';
    if (!v.swing && v.atkCd <= 0) {
      const { hitAt, end } = swingTimes(w.anim);
      v.swing = { t: 0, hitAt, end, target: { kind: 'unit', id: -1 } }; // the blow has no living target: the work takes it
      v.atkCd = swingCycle(sim, v, w);
      if (b.kind === 'prop') damageProp(sim, b.tribe!, b.x, b.y, (weaponDamage(sim, v, w) + RULES.strengthDamage * v.stats.str) * (w.type === 'slash' ? 1.5 : 1));
    }
    if (b.kind === 'node') {
      const kind = sim.world.nodeAt(b.x, b.y)!.kind;
      v.progress += dt / SIEGE.clearSeconds[kind];
      let sum = 0;
      for (const o of sim.villagers) if (o.breaks?.kind === 'node' && o.breaks.x === b.x && o.breaks.y === b.y) sum += o.progress;
      if (sum >= 1) clearNode(sim, b.x, b.y);
    }
    return true;
  }
  v.fight.repath -= dt;
  if (!v.path.length && v.fight.repath <= 0 && sim.pathLeft > 0) {
    sim.pathLeft--; v.fight.repath = 1;
    if (sim.routeTo(v, sim.ringTiles(v, box.x, box.y, box.w, box.h), 3) < 0) { stopBreaking(v); return false; } // no way up to it
  }
  v.phase = v.path.length ? 'move' : 'idle';
  return true;
}

// ---------------------------------------------------------------- walking the arrow
/** The tile each soldier of the squad is to stand on when the squad is at a point, in its formation. */
function legSpots(sim: Sim, s: Squad, p: Pt): Map<number, Pt> {
  const us = sim.squadUnits(s).sort((a, b) => (armOf(a) === 'archer' ? 1 : 0) - (armOf(b) === 'archer' ? 1 : 0) || a.id - b.id);
  const offs = formationOffsets(s.formation, us.length), out = new Map<number, Pt>(), N = sim.world.size;
  us.forEach((v, i) => {
    const [px, py] = placeOffset(offs[i], s.heading, p.x, p.y);
    out.set(v.id, { x: Math.min(N - 1, Math.max(0, Math.floor(px))) + 0.5, y: Math.min(N - 1, Math.max(0, Math.floor(py))) + 0.5 });
  });
  return out;
}

/** A work the arrow points at is the aim, not something in the way. */
const aimSkip = (m: Mission) => (o: Obstacle): boolean => o.kind === 'enemy' && m.target?.kind === 'prop' && Math.abs(o.x - m.target.x) < 3 && Math.abs(o.y - m.target.y) < 3;

/**
 * Send the squad along a straight line to a point of its arrow: each soldier to his place there, with no finding of a way round things.
 * Returns what shuts the way within sight of the soldiers (null: open).
 */
export function arrowMove(sim: Sim, s: Squad, m: Mission, p: Pt, mode: 'attack' | 'hold' | 'move'): Obstacle | null {
  const us = sim.squadUnits(s), c = sim.squadCenter(s);
  if (!us.length || !c) return null;
  if (Math.hypot(p.x - c.x, p.y - c.y) > 1) s.heading = Math.atan2(p.y - c.y, p.x - c.x);
  s.anchor = { x: p.x, y: p.y };
  const spots = legSpots(sim, s, p), skip = aimSkip(m);
  let block: Obstacle | null = null;
  for (const v of us) {
    const spot = spots.get(v.id)!;
    v.speed = (1.6 + 0.1 * v.stats.agi) * FORMATIONS[s.formation].speed;
    sim.orderAttackMove([v.id], spot.x, spot.y);
    v.fight.strict = true;
    if (mode === 'hold') v.fight.anchor = { x: spot.x, y: spot.y };
    if (mode === 'move') { v.fight.mode = 'guard'; v.fight.dest = null; v.fight.anchor = { x: spot.x, y: spot.y }; }
    v.path = lineSteps(sim, v, spot); v.phase = v.path.length ? 'move' : 'idle';
    block ??= firstBlock(sim, v, spot, SIEGE.lookAhead, skip);
  }
  return block;
}

/** The squad stops: the way ahead is shut. An enemy work in the way is attacked by everyone at once; the rest waits for the player. */
export function haltSquad(sim: Sim, m: Mission, s: Squad, ob: Obstacle): void {
  m.state = 'blocked'; m.block = { ...ob, since: sim.time };
  const us = sim.squadUnits(s);
  sim.orderHold(us.map((v) => v.id));
  if (ob.kind === 'enemy') for (const v of us) startBreaking(sim, v, ob);
  sim.say(ob.clear ? `${s.name} không thể đi tiếp: vướng ${ob.label}.` : `${s.name} không thể đi tiếp: vướng ${ob.label}, không phá được.`);
  sim.noteBattle('note', `${s.name} bị chặn bởi ${ob.label}.`);
}

/** Twice a second while a squad marches: halt it if a soldier has the way shut within six tiles, and put back on his line anyone knocked off it by a fight. True when it halted. */
export function watchMarch(sim: Sim, m: Mission, s: Squad): boolean {
  const p = m.path[Math.min(m.leg, m.path.length - 1)];
  if (!p) return false;
  const spots = legSpots(sim, s, p), skip = aimSkip(m);
  for (const v of sim.squadUnits(s)) {
    const spot = spots.get(v.id)!;
    if (v.breaks || v.phase === 'fight' || v.down > 0) continue;
    const ob = firstBlock(sim, v, spot, SIEGE.lookAhead, skip);
    if (ob) { haltSquad(sim, m, s, ob); return true; }
    if (!v.path.length && Math.hypot(spot.x - v.x, spot.y - v.y) > 1.5) { v.path = lineSteps(sim, v, spot); v.phase = v.path.length ? 'move' : 'idle'; }
  }
  return false;
}

/** Whether what halted the squad is gone (cleared by its soldiers, or the enemy work fell). */
export function blockCleared(sim: Sim, m: Mission): boolean {
  const b = m.block;
  if (!b) return true;
  if (b.kind === 'enemy') return !propOnTile(sim, b.x, b.y);
  const now = obstacleAt(sim, b.x, b.y);
  return !now || now.kind !== b.kind;
}

/** The player sends `n` soldiers of a halted squad to break down what is in the way. Returns an error or null. */
export function breakBlock(sim: Sim, plan: Plan, squadId: number, n: number): string | null {
  const m = plan.missions.find((x) => x.squad === squadId), s = sim.squadById(squadId);
  if (plan.status !== 'running' || !m || !s) return 'Đội này không ở trong trận';
  if (m.state !== 'blocked' || !m.block) return `${s.name} không bị chặn`;
  if (!m.block.clear) return `Không phá được ${m.block.label}: hãy rút hoặc đi đường khác`;
  const ob: Obstacle = { ...m.block }, us = sim.squadUnits(s).filter((v) => !v.breaks).sort((a, b) => Math.hypot(a.x - ob.x, a.y - ob.y) - Math.hypot(b.x - ob.x, b.y - ob.y));
  let sent = 0;
  for (const v of us.slice(0, Math.max(1, Math.min(Math.round(n), us.length)))) if (startBreaking(sim, v, ob)) sent++;
  if (!sent) return 'Không còn ai để cử đi phá';
  sim.say(`${sent} lính ${s.name} đi phá ${ob.label}.`);
  return null;
}

// ---------------------------------------------------------------- what the arrow points at
export type TargetState = { state: 'live'; prop?: { x: number; y: number; tribe: string }; unit?: number; x: number; y: number } | { state: 'moved' } | { state: 'gone' };

/** Where the thing the arrow points at is now. `moved`: it is still there but far from where the plan had it. `gone`: destroyed, killed, or nobody is left to be it. */
export function targetNow(sim: Sim, plan: Plan, m: Mission): TargetState | null {
  const tg = m.target, t = sim.tribes.find((q) => q.id === plan.tribe);
  if (!tg || !t) return null;
  if (tg.kind === 'prop') {
    const p = t.props.find((q) => q.x === tg.x && q.y === tg.y);
    return p ? { state: 'live', prop: { x: p.x, y: p.y, tribe: t.id }, x: p.x + p.w / 2, y: p.y + p.h / 2 } : { state: 'gone' };
  }
  const alive = t.unitIds.map((id) => sim.get(id)).filter((u): u is Villager => !!u && u.health > 0);
  const pool = tg.leader ? alive.filter((u) => u.id === t.leaderId) : alive.filter((u) => u.ai?.role !== 'civ');
  if (!pool.length) return tg.leader || !alive.length ? { state: 'gone' } : { state: 'moved' };
  const best = pool.slice().sort((a, b) => Math.hypot(a.x - tg.x, a.y - tg.y) - Math.hypot(b.x - tg.x, b.y - tg.y))[0];
  return Math.hypot(best.x - tg.x, best.y - tg.y) <= SIEGE.driftMax ? { state: 'live', unit: best.id, x: best.x, y: best.y } : { state: 'moved' };
}

const idle = (v: Villager): boolean => !v.breaks && !v.fight.target && v.phase !== 'fight' && v.phase !== 'flee' && v.down <= 0;

/** Soldiers with nothing to do go for the nearest enemy of the village, or failing that its nearest work. Once a second. */
function rampage(sim: Sim, plan: Plan, s: Squad): void {
  const t = sim.tribes.find((q) => q.id === plan.tribe);
  if (!t) return;
  const foes = t.unitIds.map((id) => sim.get(id)).filter((u): u is Villager => !!u && u.health > 0 && u.ai?.role !== 'civ');
  for (const v of sim.squadUnits(s)) {
    if (!idle(v)) continue;
    const near = foes.slice().sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
    if (near) { sim.orderAttack([v.id], { kind: 'unit', id: near.id }); continue; }
    const p = t.props.slice().sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
    if (p) startBreaking(sim, v, { kind: 'enemy', x: p.x, y: p.y, label: p.kind, clear: true, tribe: t.id });
  }
}

/** A squad that holds its ground still hits the works within a few tiles of it, and keeps its formation. */
function around(sim: Sim, plan: Plan, s: Squad): void {
  const t = sim.tribes.find((q) => q.id === plan.tribe);
  if (!t) return;
  for (const v of sim.squadUnits(s)) {
    if (!idle(v)) continue;
    const p = t.props.find((q) => Math.hypot(q.x + q.w / 2 - v.x, q.y + q.h / 2 - v.y) < 5);
    if (p) startBreaking(sim, v, { kind: 'enemy', x: p.x, y: p.y, label: p.kind, clear: true, tribe: t.id }, v.fight.anchor ?? { x: v.x, y: v.y });
  }
}

/**
 * A mission with a target, once a second. Its soldiers go for what the arrow points at when it is there to be found; when it is gone they take on everything about;
 * when it has gone too far from where the plan had it they know nothing better to do than stand at the end of the arrow, in formation, and hit what is near.
 * Returns false for a mission with no target, which keeps to the old ways.
 */
export function tickTarget(sim: Sim, plan: Plan, m: Mission, s: Squad): boolean {
  if (!m.target || m.stance === 'evade' || m.stance === 'hold') return false;
  const ts = targetNow(sim, plan, m);
  if (!ts) return false;
  if (m.state === 'march' && ts.state !== 'gone') return true; // still on its way
  if (m.state === 'march') m.state = 'engaged';
  if (ts.state === 'gone') { rampage(sim, plan, s); return true; }
  if (ts.state === 'moved') {
    const end = m.path[m.path.length - 1];
    if (end && (!s.anchor || Math.hypot(s.anchor.x - end.x, s.anchor.y - end.y) > 1)) sim.squadMove(s, end.x, end.y, 'hold');
    around(sim, plan, s);
    return true;
  }
  for (const v of sim.squadUnits(s)) {
    if (!idle(v)) continue;
    if (ts.prop) startBreaking(sim, v, { kind: 'enemy', x: ts.prop.x, y: ts.prop.y, label: 'công trình', clear: true, tribe: ts.prop.tribe });
    else if (ts.unit !== undefined) sim.orderAttack([v.id], { kind: 'unit', id: ts.unit });
  }
  return true;
}
