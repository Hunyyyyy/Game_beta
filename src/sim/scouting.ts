/** Scouting: villages found on the map, trips to draw them (three levels of map, ageing) and the scouts who do not come home. */
import { levelDef } from './buildings';
import { ringOf, ringPower, SIEGE } from './combat';
import { DAY_LENGTH } from './constants';
import { armOfWeapon, COMMAND } from './formations';
import { RESEARCH } from './research';
import { findPath } from './path';
import { tribeOf } from './tribes';
import type { Sim } from './sim';
import { RES_NAME } from './resources';
import type { IntelMark, ScoutMap, ScoutMission, ScoutPlan, Seen, TribeIntel, Villager } from './model';

/** How good a map still is: it loses a tenth a day as the enemy changes his ways. */
export const mapAccuracy = (sim: Sim, m: ScoutMap): number => Math.max(0, 1 - (COMMAND.mapDecayPerDay * (sim.time - m.at)) / DAY_LENGTH);

/** The best level of map we hold of a village that is still fresh enough to act on; a map with gaps counts one level less (but never nothing). */
export function mapLevel(sim: Sim, tribe: string): number {
  let best = 0;
  for (const m of sim.maps) if (m.tribe === tribe && mapAccuracy(sim, m) >= 0.4) best = Math.max(best, m.gaps > 0 ? Math.max(1, m.level - 1) : m.level);
  return best;
}

const warriorsOf = (sim: Sim, tribe: string): number => { const t = tribeOf(sim, tribe as never); return t ? t.unitIds.filter((u) => sim.get(u)?.ai?.role !== 'civ').length : 0; };

// ---------------------------------------------------------------- finding villages
/** How far a villager sees a camp, in tiles. */
const SIGHT = 14;
/** Tiles from the campfire at which someone counts as home. */
const HOME = 7;
const COMPASS = ['Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc', 'Bắc', 'Đông Bắc'];

/** Whether a village is on the scouting list: someone came across it and got home with the news. */
export const isFound = (sim: Sim, tribe: string): boolean => sim.dev.freeBuild || sim.sightings.some((s) => s.tribe === tribe && s.reported);

/** How far a village lies from our campfire, in tiles, and in which direction. All the list says of a village nobody has scouted. */
export function whereIs(sim: Sim, tribe: string): { dist: number; dir: string } | null {
  const t = tribeOf(sim, tribe as never);
  if (!t) return null;
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  const dx = t.camp.x - fx, dy = t.camp.y - fy;
  return { dist: Math.round(Math.hypot(dx, dy)), dir: COMPASS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8] };
}

/**
 * Anyone of ours who walks within sight of a camp nobody has found keeps the news until he is home alive; then it joins the list
 * ("a village, so many tiles away"). If he dies on the way, the news dies with him and another may find it again.
 * Looked at once a game second.
 */
export function tickSightings(sim: Sim, dt: number): void {
  if (Math.floor(sim.time) === Math.floor(sim.time - dt)) return;
  const fire = sim.campfire();
  for (let i = sim.sightings.length - 1; i >= 0; i--) {
    const s = sim.sightings[i];
    if (s.reported) continue;
    const v = sim.byId.get(s.by);
    if (!v || v.team !== 'player' || v.health <= 0) { sim.sightings.splice(i, 1); continue; }
    if (v.inside !== null || !fire || Math.hypot(v.x - fire.x, v.y - fire.y) < HOME) {
      s.reported = true;
      const w = whereIs(sim, s.tribe);
      if (w) sim.say(`${v.name} về báo đã thấy một ngôi làng, cách đây khoảng ${w.dist} ô về phía ${w.dir}.`);
    }
  }
  for (const t of sim.tribes) {
    if (t.state === 'destroyed' || sim.sightings.some((s) => s.tribe === t.id)) continue;
    const finder = sim.villagers.find((v) => v.health > 0 && v.inside === null && Math.hypot(v.x - t.camp.x, v.y - t.camp.y) < SIGHT);
    if (finder) sim.sightings.push({ tribe: t.id, by: finder.id, at: sim.time, reported: false });
  }
}

// ---------------------------------------------------------------- sending scouts
/** The research that opens each level of map: a trip always draws the highest one researched. */
const LEVEL_TECH = ['scout', 'scout2', 'scout3'];
export function scoutLevel(sim: Sim): number {
  if (sim.dev.freeBuild || !RESEARCH.enabled) return 3;
  let n = 0;
  while (n < LEVEL_TECH.length && sim.researched.has(LEVEL_TECH[n])) n++;
  return n;
}

/** How many scouts the Trại trinh sát holds: its slots, added up. They are all the scouts the village can have, and so all that can go on one trip. */
export function scoutLimit(sim: Sim): number {
  return sim.dev.freeBuild ? 8 : sim.buildings.reduce((n, b) => n + (b.kind === 'scouttent' && b.done ? levelDef(b).slots : 0), 0);
}

/** Whether a villager is out on a scouting trip right now. */
export const onTrip = (sim: Sim, v: Villager): boolean => sim.scouts.some((m) => m.ids.includes(v.id));

/** Who may be sent: a scout, healthy, out in the open and not already away. */
export const canScout = (sim: Sim, v: Villager): boolean => v.job === 'scout' && v.health > 0 && v.inside === null && !onTrip(sim, v);

/** The scouts of the village, as a role like the soldiers: recruited and let go at the Trại trinh sát. */
export const scoutRoster = (sim: Sim): Villager[] => sim.villagers.filter((v) => v.job === 'scout');

/** Take villagers into the scouts, as many as the Trại trinh sát has room for. Returns an error or null. */
export function enlistScouts(sim: Sim, ids: readonly number[]): string | null {
  const lock = sim.warLock(); if (lock) return lock;
  const limit = scoutLimit(sim);
  if (RESEARCH.enabled && !sim.dev.freeBuild && !scoutLevel(sim)) return 'Cần nghiên cứu: Trinh sát';
  if (!limit) return 'Cần dựng Trại trinh sát';
  const pick = sim.mine(ids).filter((v) => v.job !== 'fight' && v.job !== 'scout'), room = limit - scoutRoster(sim).length;
  if (!pick.length) return 'Chọn dân thường để tuyển làm trinh sát';
  if (room <= 0) return `Trại trinh sát đã đủ ${limit} trinh sát: nâng cấp lều để chứa thêm`;
  for (const v of pick.slice(0, room)) { sim.resetTask(v); sim.clearCombat(v); v.job = 'scout'; v.prefer = -1; v.post = -1; }
  return pick.length > room ? `Lều chỉ còn chỗ cho ${room} trinh sát` : null;
}

/** Let scouts go back to being plain villagers with no job. Those away on a trip must come home first. Returns an error or null. */
export function dismissScouts(sim: Sim, ids: readonly number[]): string | null {
  const lock = sim.warLock(); if (lock) return lock;
  let n = 0, away = 0;
  for (const v of sim.mine(ids)) {
    if (v.job !== 'scout') continue;
    if (onTrip(sim, v)) { away++; continue; }
    sim.resetTask(v); sim.clearCombat(v); v.job = 'idle'; v.post = -1; n++;
  }
  return n ? null : away ? 'Đang đi trinh sát: đợi họ về' : 'Chọn trinh sát để cho nghỉ';
}

/**
 * How good a scout one villager is, about 0.5 to 1.7: legs (Nhanh nhẹn), wind (Thể lực) and a clear head (Trí tuệ).
 * Experience and research will add to this later; every trip reads it through here.
 */
export const scoutSkill = (v: Pick<Villager, 'stats'> & Partial<Pick<Villager, 'weapon' | 'armor' | 'torch' | 'arm'>>): number => {
  const w = SIEGE.scout.weights, sk = (w.agi * v.stats.agi + w.sta * v.stats.sta + w.int * v.stats.int) / 6; // a clear head and wind count most
  return sk * (1 + gearOf(v, SIEGE.scout.gearSkill));
};

/** What a scout carries makes him better at the work: a weapon, armour, a torch, a mount (a rider). `table` says how much each piece is worth. */
function gearOf(v: Partial<Pick<Villager, 'weapon' | 'armor' | 'torch' | 'arm'>>, table: { weapon: number; armor: number; torch: number; mount: number }): number {
  return (v.weapon ? table.weapon : 0) + (v.armor ? table.armor : 0) + (v.torch ? table.torch : 0) + (v.arm === 'cavalry' ? table.mount : 0);
}

/** How cleverly he moves: Trí tuệ to keep out of sight, Thể lực to keep going. Used for the chance of being caught and for the time spent watching. */
const stealthOf = (v: Pick<Villager, 'stats'>): number => 0.6 * v.stats.int + 0.4 * v.stats.sta;

/** Scouts a map of this level needs, in "average scouts": the level plus one, and one more for every eight of their soldiers, at most eight. */
export const scoutsNeeded = (sim: Sim, tribe: string, level: number): number => Math.min(8, level + 1 + Math.floor(warriorsOf(sim, tribe) / 8));

/** The chance the map comes out in full detail. One scout alone can never draw it; the rest depends on how many come home and how good they are. */
export function drawChance(skills: readonly number[], need: number): number {
  if (skills.length < 2) return 0;
  return Math.min(0.95, skills.reduce((a, b) => a + b, 0) / need);
}

/** Game seconds the scouts spend circling and studying the village: each level takes longer, each extra scout shortens it. */
export const surveyTime = (level: number, scouts: number, int = 6): number => (0.2 * level * DAY_LENGTH) / ((1 + 0.35 * (Math.max(1, scouts) - 1)) * Math.max(0.5, 1 + SIEGE.scout.surveyPerInt * (int - 6)));

/** What a trip would be like with these people, for the list that picks them: the chance of a full map, the time it takes and what is wrong with it, if anything. */
export function planScout(sim: Sim, ids: readonly number[], tribe: string): ScoutPlan {
  const level = scoutLevel(sim), limit = scoutLimit(sim), scouts = sim.mine(ids).filter((v) => canScout(sim, v));
  const need = scoutsNeeded(sim, tribe, Math.max(1, level)), w = whereIs(sim, tribe);
  const speed = scouts.length ? scouts.reduce((a, v) => a + v.speed * (1 + SIEGE.scout.walkPerSta * (v.stats.sta - 6)), 0) / scouts.length : 2, walk = w ? Math.max(0, w.dist - 15) / speed : 0;
  const survey = surveyTime(Math.max(1, level), scouts.length, scouts.length ? scouts.reduce((a, v) => a + v.stats.int, 0) / scouts.length : 6);
  let error: string | null = null;
  if (!sim.dev.freeBuild && !isFound(sim, tribe)) error = 'Chưa ai tìm thấy làng này';
  else if (!tribeOf(sim, tribe as never)) error = 'Không có làng này';
  else if (RESEARCH.enabled && !sim.dev.freeBuild && !level) error = 'Cần nghiên cứu: Trinh sát';
  else if (!limit) error = 'Cần dựng Trại trinh sát';
  else if (sim.scouts.some((m) => m.tribe === tribe)) error = 'Đã có trinh sát đang đi làng này';
  else if (!scouts.length) error = 'Chọn trinh sát để cử đi (tuyển ở Trại trinh sát)';
  else if (scouts.length > limit) error = `Trại trinh sát chỉ cho đi ${limit} người một chuyến`;
  return { level, need, count: scouts.length, limit, chance: drawChance(scouts.map(scoutSkill), need), walk, survey, total: 2 * walk + survey, error };
}

/** Send villagers to scout a village for the best map our research can draw. Returns an error or null. */
export function startScout(sim: Sim, ids: readonly number[], tribe: string): string | null {
  const plan = planScout(sim, ids, tribe), t = tribeOf(sim, tribe as never);
  if (plan.error || !t) return plan.error ?? 'Không có làng này';
  const scouts = sim.mine(ids).filter((v) => canScout(sim, v));
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  const dx = fx - t.camp.x, dy = fy - t.camp.y, len = Math.max(1, Math.hypot(dx, dy)), reach = Math.min(len, 15);
  const spotX = t.camp.x + (dx / len) * reach, spotY = t.camp.y + (dy / len) * reach;
  scouts.forEach((v, i) => {
    sim.resetTask(v); sim.clearCombat(v);
    const spot = sim.nearestFree(Math.floor(spotX + Math.cos(i * 2.4) * 2), Math.floor(spotY + Math.sin(i * 2.4) * 2), new Set()) ?? [Math.floor(spotX), Math.floor(spotY)];
    sim.orderMove([v.id], spot[0], spot[1]);
  });
  sim.scouts.push({ id: sim.nextMission++, tribe, level: Math.max(1, plan.level), ids: scouts.map((v) => v.id), phase: 'go', t: 0, need: plan.need, survivors: scouts.length, sent: scouts.length });
  sim.say(`${scouts.length} trinh sát lên đường tới ${t.def.name} để vẽ bản đồ cấp ${Math.max(1, plan.level)}: khoảng ${Math.round(plan.chance * 100)}% vẽ đủ chi tiết, cả chuyến mất chừng ${Math.max(1, Math.round(plan.total / 60))} phút.`);
  return null;
}

/** The chance one scout is caught and killed: his own village's strength, daylight and his speed. */
function deathChance(sim: Sim, m: ScoutMission, v: Villager): number {
  const t = tribeOf(sim, m.tribe as never)!, fire = sim.campfire();
  const power = warriorsOf(sim, m.tribe) * ringPower(ringOf(Math.hypot(t.camp.x - (fire?.x ?? 0), t.camp.y - (fire?.y ?? 0))));
  const day = sim.weather === 'clear' && !sim.resting;
  return Math.max(0.02, Math.min(0.9, 0.1 + power / 5 / 100 + (day ? 0.1 : 0) - (sim.resting ? 0.1 : 0) - Math.max(0, (stealthOf(v) - 6) * SIEGE.scout.stealthPerPoint + (v.stats.agi - 6) * 0.005) - gearOf(v, SIEGE.scout.gearHide)));
}

export function tickScouts(sim: Sim, dt: number): void {
  tickSightings(sim, dt);
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
        for (const v of alive) if (sim.frnd() < deathChance(sim, m, v)) sim.killUnit(v, 'vì bị phát hiện khi trinh sát');
        m.survivors = alive.filter((v) => v.health > 0 && sim.byId.has(v.id)).length;
        if (m.survivors && m.level >= 2) m.seen = seenNow(sim, tribeOf(sim, m.tribe as never)!); // the day the scouts came is the day the map shows
        sim.say(m.survivors ? `Trinh sát đang quan sát ${t.def.name}.` : 'Trinh sát bị bắt gặp, không ai thoát.');
      }
    } else if (m.phase === 'watch') {
      if (m.t >= surveyTime(m.level, m.survivors, alive.reduce((a, v) => a + v.stats.int, 0) / Math.max(1, alive.length))) {
        m.phase = 'back'; m.t = 0;
        const fire = sim.campfire();
        for (const id of m.ids) if (sim.byId.has(id) && fire) sim.orderMove([id], Math.floor(fire.x + 1), Math.floor(fire.y + 3));
      }
    } else {
      const fire = sim.campfire(), home = !fire || alive.every((v) => Math.hypot(v.x - fire.x, v.y - fire.y) < 7);
      if (home || m.t > 600) {
        // only those who come home count: the map is as full as they are many and good
        const skills = alive.map(scoutSkill), chance = drawChance(skills, m.need), full = sim.frnd() < chance;
        const gaps = full ? 0 : Math.max(1, Math.ceil(m.need - skills.reduce((a, b) => a + b, 0)));
        const old = sim.maps.findIndex((x) => x.tribe === m.tribe && x.level === m.level);
        const map: ScoutMap = { tribe: m.tribe, level: m.level, at: sim.time, gaps, seen: m.seen };
        if (old >= 0) sim.maps[old] = map; else sim.maps.push(map);
        sim.say(`Trinh sát về (${alive.length}/${m.sent ?? alive.length} người): bản đồ cấp ${m.level} của ${t.def.name}${full ? ' đầy đủ chi tiết' : `, nhưng còn hở (thiếu ${gaps} mảnh, tỉ lệ vẽ đủ chỉ ${Math.round(chance * 100)}%)`}.`);
        sim.scouts.splice(i, 1);
      }
    }
  }
}

// ---------------------------------------------------------------- what the map shows
/** Tiles drawn round the yard of a camp. */
const MARGIN = 24, YARD = 7;
/** The lowest map level that shows each kind of work, and what to call it. */
const WORKS: Record<string, { level: number; label: string }> = {
  fire: { level: 1, label: 'Đống lửa' }, tower: { level: 2, label: 'Chòi canh' }, fence: { level: 2, label: 'Hàng rào' }, gate: { level: 2, label: 'Cổng' }, pile: { level: 3, label: 'Kho lương' },
};

/** A fixed 0..1 number from an id, so a stale map blurs the same way every time it is drawn (no random draw is spent). */
const spread = (id: number, salt: number): number => { const x = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

/** Everyone alive in the village, where he stands now and what he carries. */
function seenNow(sim: Sim, t: NonNullable<ReturnType<typeof tribeOf>>): Seen[] {
  const out: Seen[] = [];
  for (const id of t.unitIds) {
    const u = sim.get(id); if (!u || u.health <= 0) continue;
    out.push({ x: Math.round(u.x * 10) / 10, y: Math.round(u.y * 10) / 10, arm: armOfWeapon(u.weapon), weapon: u.weapon ?? null, civ: u.ai?.role === 'civ', leader: u.id === t.leaderId });
  }
  return out;
}

const WORK_INFO: Record<string, string> = {
  fire: 'Đống lửa của họ: tâm làng, quanh đây dân và lính tụ lại.', tower: 'Chòi canh: cung thủ đứng cao bắn xa hơn, phải phá chòi mới hạ được họ.',
  fence: 'Hàng rào: chặn đường, phải phá hoặc đi vòng.', gate: 'Cổng: lối vào làng, đóng thì chặn đường.', pile: 'Kho lương: chỗ họ cất thức ăn và đồ cống nạp.',
};

/** A free tile at or near a point, or null. */
function freeNear(sim: Sim, x: number, y: number): [number, number] | null {
  for (let r = 0; r <= 8; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (Math.max(Math.abs(i), Math.abs(j)) === r && !sim.world.isBlocked(Math.floor(x) + i, Math.floor(y) + j)) return [Math.floor(x) + i, Math.floor(y) + j];
  return null;
}

/** The way a walker really goes from our fire to the edge of a camp's yard (round trees, water and works), and the part of it that lies on the map, thinned out to a few points. */
function entryRoute(sim: Sim, camp: { x: number; y: number }, box: { x0: number; y0: number; x1: number; y1: number }, toUs: { x: number; y: number } | null): Array<{ x: number; y: number }> {
  const fire = sim.campfire(), from = freeNear(sim, (fire?.x ?? sim.world.start.x) + 1, (fire?.y ?? sim.world.start.y) + 3);
  const to = freeNear(sim, camp.x + (toUs?.x ?? 0) * (YARD + 1), camp.y + (toUs?.y ?? 0) * (YARD + 1));
  if (!from || !to) return [];
  const path = findPath(sim.world, from[0], from[1], to[0], to[1], 70000);
  const last = path[path.length - 1];
  if (!last || last[0] !== to[0] || last[1] !== to[1]) return []; // no way through: the scouts found none
  const inside = path.filter(([x, y]) => x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1);
  return inside.filter((_, i) => i % 3 === 0 || i === inside.length - 1).map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
}

/**
 * What our scouts know of a village, ready to draw: the camp and 24 tiles round it. Level 1 gives only the position, a rough head count and the way in;
 * level 2 adds the works (fences, towers, gates) and people as shapes; level 3 tells the men by arm, the stores and the chief.
 * People stand where the scouts saw them on the day they came, whatever they do after; a map with gaps leaves some of them out. Null when we hold no map.
 */
export function tribeIntel(sim: Sim, tribe: string): TribeIntel | null {
  const t = tribeOf(sim, tribe as never);
  if (!t) return null;
  const level = sim.dev.freeBuild ? 3 : mapLevel(sim, tribe);
  if (!level) return null;
  const held = sim.maps.filter((m) => m.tribe === tribe && (m.gaps > 0 ? m.level - 1 : m.level) >= level).sort((a, b) => b.at - a.at)[0];
  const accuracy = sim.dev.freeBuild || !held ? 1 : mapAccuracy(sim, held), gaps = sim.dev.freeBuild ? 0 : held?.gaps ?? 0;
  // the map is drawn as wide as a screen, so that no part of it is bare: the camp and the ground round it, wider than tall, moved in when the camp is near the edge of the world
  const N = sim.world.size, ry = YARD + MARGIN, rx = Math.round(ry * 1.9);
  const x0 = Math.max(0, Math.min(N - 2 * rx, Math.floor(t.camp.x) - rx)), y0 = Math.max(0, Math.min(N - 2 * ry, Math.floor(t.camp.y) - ry));
  const box = { x0, y0, x1: x0 + 2 * rx, y1: y0 + 2 * ry };
  const fire = sim.campfire(), dx = (fire?.x ?? sim.world.start.x) - t.camp.x, dy = (fire?.y ?? sim.world.start.y) - t.camp.y, len = Math.hypot(dx, dy);
  const seen = sim.dev.freeBuild || !held?.seen ? seenNow(sim, t) : held.seen; // a map from before scouts kept what they saw shows the village as it is
  const soldiers = level >= 3 ? { foot: 0, archer: 0, cavalry: 0 } : null;
  const people: TribeIntel['people'] = [];
  if (level >= 2) seen.forEach((u, i) => {
    if (spread(i + 1, 1) < Math.min(0.6, gaps * 0.2)) return; // a piece of the map never came home
    const mark: IntelMark = level < 3 ? 'unknown' : u.civ ? 'civ' : u.arm;
    if (soldiers && !u.civ) soldiers[u.arm]++;
    people.push({ x: u.x, y: u.y, mark, leader: level >= 3 && u.leader, weapon: level >= 3 ? u.weapon : null });
  });
  const route = entryRoute(sim, t.camp, box, len > 0 ? { x: dx / len, y: dy / len } : null);
  const others: TribeIntel['others'] = sim.tribes.filter((o) => o !== t && o.state !== 'adopted' && o.state !== 'destroyed' && isFound(sim, o.id)).map((o) => ({ name: o.def.name, x: o.camp.x, y: o.camp.y, r: YARD, ours: false }));
  others.push({ name: 'Làng của ta', x: (fire?.x ?? sim.world.start.x) + 1, y: (fire?.y ?? sim.world.start.y) + 1, r: 12, ours: true });
  const reach = (o: TribeIntel['others'][number]) => o.x > box.x0 - o.r && o.x < box.x1 + o.r && o.y > box.y0 - o.r && o.y < box.y1 + o.r;
  const loot = Object.entries(t.loot).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => `${Math.round(v as number)} ${RES_NAME[k as keyof typeof RES_NAME].toLowerCase()}`).join(', ');
  return {
    tribe, name: t.def.name, level, accuracy, gaps, box, camp: { ...t.camp }, yard: YARD,
    toUs: len > 0 ? { x: dx / len, y: dy / len } : null, route, others: others.filter(reach),
    population: Math.max(2, Math.round(seen.length / 2) * 2),
    structures: t.props.filter((p) => (WORKS[p.kind]?.level ?? 9) <= level).map((p) => ({ kind: p.kind, label: WORKS[p.kind].label, detail: p.kind === 'pile' && loot ? `${WORK_INFO.pile} Có khoảng ${loot}.` : WORK_INFO[p.kind] ?? '', x: p.x, y: p.y, w: p.w, h: p.h })),
    people, soldiers,
  };
}
