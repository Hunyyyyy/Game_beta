/** Plans of war: squads given missions, command cards for the fight, the defence template and the alarm drum. */
import { OBJECTIVE_NAME, FORMATIONS, FormationId, SQUAD_MAX, SQUAD_MIN, armOfWeapon } from './formations';
import { WEATHER } from './calendar';
import { RESEARCH } from './research';
import type { Sim } from './sim';
import { SIEGE } from './combat';
import type { CardKind, Mission, MissionTarget, Objective, Obstacle, Plan, Pt, RouteTime, Squad } from './model';

// ---------------------------------------------------------------- what may be aimed at
const NEED_LEVEL: Record<Objective, number> = { camp: 1, gate: 2, ambush: 2, stores: 3, leader: 3 };

/** A target can be chosen only if the map held of the village is of a high enough level. */
export function canTarget(sim: Sim, objective: Objective, tribe: string | null): boolean {
  return sim.dev.freeBuild || (!!tribe && sim.mapLevel(tribe) >= NEED_LEVEL[objective]);
}

// ---------------------------------------------------------------- building a plan
export function newPlan(sim: Sim, kind: 'attack' | 'defense', tribe: string | null): Plan {
  const old = sim.plans.findIndex((p) => p.kind === kind && p.status !== 'running');
  if (old >= 0) sim.plans.splice(old, 1);
  const fire = sim.campfire();
  const plan: Plan = { id: sim.nextPlan++, kind, tribe, missions: [], cards: [], status: 'draft', stage: 'assemble', startedAt: 0, signal: false, nextCard: 1, clears: [], result: '', rally: { x: (fire?.x ?? sim.world.start.x) + 1.5, y: (fire?.y ?? sim.world.start.y) + 6 } };
  sim.plans.push(plan);
  return plan;
}

/** Give a squad a mission. `withdrawAt` is the share lost at which it pulls back (0: it never does). */
export function addMission(sim: Sim, plan: Plan, squadId: number, withdrawAt = 0.5): string | null {
  if (!sim.squadById(squadId)) return 'Không có đội này';
  if (plan.missions.some((m) => m.squad === squadId)) return 'Đội này đã có nhiệm vụ';
  plan.missions.push({ squad: squadId, objective: 'camp', route: 'main', trigger: { kind: 'time', at: 0 }, stance: 'fight', withdrawAt, state: 'idle', initial: 0, post: 'gate', deploy: null, path: [], retreat: [], leg: 0, target: null, block: null });
  return null;
}

export function removeMission(plan: Plan, squadId: number): void {
  plan.missions = plan.missions.filter((m) => m.squad !== squadId);
  plan.cards = plan.cards.filter((c) => c.squad !== squadId);
}

// ---------------------------------------------------------------- drawing on the map
/** The mission of a squad in a plan that may still be drawn on, made if the squad has none yet. */
function drawable(sim: Sim, plan: Plan, squadId: number): Mission | string {
  if (plan.status === 'running') return 'Kế hoạch đang chạy: không vẽ lại được';
  const s = sim.squadById(squadId);
  if (!s) return 'Không có đội này';
  if (!plan.missions.some((m) => m.squad === squadId)) addMission(sim, plan, squadId, 0);
  return plan.missions.find((m) => m.squad === squadId)!;
}

/**
 * Put a squad on the enemy map as the cells that were drawn (3 to 15), and take the formation if one is given.
 * The cells are a plan: they need no soldiers, who are put into the squad later. Returns an error, with nothing changed, or null.
 */
export function deploySquad(sim: Sim, plan: Plan, squadId: number, kind: FormationId | undefined, cells: readonly Pt[], heading: number, o: Pt, p: Pt): string | null {
  const s = sim.squadById(squadId);
  if (!s) return 'Không có đội này';
  if (plan.status === 'running') return 'Kế hoạch đang chạy: không vẽ lại được';
  if (cells.length < SQUAD_MIN || cells.length > sim.cellLimit()) return `Đội hình có từ ${SQUAD_MIN} đến ${sim.cellLimit()} ô`;
  if (kind && !sim.formationOpen(kind)) return `Cần nghiên cứu: ${FORMATIONS[kind].name}`;
  if (kind && kind !== s.formation) { const e = sim.setFormation(s.id, kind); if (e) return e; }
  const m = drawable(sim, plan, squadId);
  if (typeof m === 'string') return m;
  const N = sim.world.size, keep = (v: number) => Math.max(1, Math.min(N - 2, v));
  m.deploy = { cells: cells.map((c) => ({ x: keep(c.x), y: keep(c.y) })), heading, o: { x: o.x, y: o.y }, p: { x: p.x, y: p.y }, kind: s.formation };
  return null;
}

/** Set the arrow a squad follows (or, with `retreat`, the way it falls back). An empty list clears it. Returns an error or null. */
export function setMissionPath(sim: Sim, plan: Plan, squadId: number, pts: readonly Pt[], retreat = false): string | null {
  const m = drawable(sim, plan, squadId);
  if (typeof m === 'string') return m;
  let list = pts.slice(0, 40).map((p) => ({ x: p.x, y: p.y }));
  if (!retreat && list.length > 4) list = [...list.slice(0, 3), list[list.length - 1]]; // at most three bends, and the head
  if (retreat) { m.retreat = list; return null; }
  // an arrow that points at something keeps its head on it: only the points between can be moved, and clearing the arrow lets go of the target
  if (m.target && list.length) list[list.length - 1] = { ...m.target.at };
  if (m.target && !list.length) m.target = null;
  m.path = list;
  return null;
}

/** Aim a squad at something pressed on the enemy map: its arrow now runs from the squad to it, straight, to be bent by the points between. Returns an error or null. */
export function setMissionTarget(sim: Sim, plan: Plan, squadId: number, target: MissionTarget): string | null {
  const m = drawable(sim, plan, squadId);
  if (typeof m === 'string') return m;
  const t = sim.tribes.find((x) => x.id === plan.tribe);
  if (!t) return 'Chưa chọn làng để đánh';
  if (!m.deploy) return 'Đặt đội hình của đội lên bản đồ trước';
  if (target.kind === 'prop' && !t.props.some((p) => p.x === target.x && p.y === target.y)) return 'Công trình này không còn';
  m.target = { ...target, at: { ...target.at } }; m.path = [{ ...target.at }]; m.block = null;
  m.objective = target.kind === 'person' ? (target.leader ? 'leader' : 'camp') : target.label === 'Kho lương' ? 'stores' : 'camp';
  return null;
}

/** Tiles a second the squad walks at: its slowest soldier (an average one while it has none), in its formation, in today's weather. */
export function squadPace(sim: Sim, s: Squad): number {
  const us = sim.squadUnits(s), base = us.length ? Math.min(...us.map((v) => (1.6 + 0.1 * v.stats.agi) * sim.mountSpeed(v))) : 2.1;
  return base * FORMATIONS[s.formation].speed * WEATHER[sim.weather].speed;
}

/** How long the squad takes to walk from a point along the arrow, leg by leg. A leg that runs through water, trees or works is slower (the squad goes round) and is marked blocked. */
export function routeTime(sim: Sim, s: Squad, from: Pt, pts: readonly Pt[], target?: Pt): RouteTime {
  const pace = squadPace(sim, s) || 1, legs: number[] = [], blocked: boolean[] = [];
  let at = from, length = 0;
  for (const p of pts) {
    const d = Math.hypot(p.x - at.x, p.y - at.y), steps = Math.max(1, Math.ceil(d * 2));
    let bad = 0;
    for (let i = 0; i <= steps; i++) if (sim.world.isBlocked(Math.floor(at.x + ((p.x - at.x) * i) / steps), Math.floor(at.y + ((p.y - at.y) * i) / steps))) bad++;
    const share = bad / (steps + 1);
    legs.push((d * (1 + 1.5 * share)) / pace); blocked.push(share > 0.1); length += d;
    at = p;
  }
  return { legs, total: legs.reduce((a, b) => a + b, 0), length, blocked, hits: sim.pathHits(from, pts, target) };
}

/**
 * Where the arrow of a squad starts. A wedge sends it from its tip; horns, from the middle between the two horns; a circle, from its rim on the side the arrow
 * goes towards (`toward`, or the first point of the arrow), so an arrow that points into the ring marches the soldiers into its middle; any other formation, from the middle of its cells.
 * A squad with no formation drawn starts where it stands.
 */
export function missionStart(sim: Sim, m: Mission, toward?: Pt): Pt | null {
  const d = m.deploy;
  if (d) {
    const kind = d.kind ?? sim.squadById(m.squad)?.formation ?? 'line', n = d.cells.length;
    if (kind === 'wedge') return { x: d.o.x, y: d.o.y };
    if (kind === 'horns') return { x: (d.cells[0].x + d.cells[n - 1].x) / 2, y: (d.cells[0].y + d.cells[n - 1].y) / 2 };
    if (kind === 'circle') {
      const t = toward ?? m.path[0], r = Math.hypot(d.p.x - d.o.x, d.p.y - d.o.y), len = t ? Math.hypot(t.x - d.o.x, t.y - d.o.y) : 0;
      return len > 0.01 ? { x: d.o.x + ((t!.x - d.o.x) / len) * r, y: d.o.y + ((t!.y - d.o.y) / len) * r } : { x: d.o.x, y: d.o.y };
    }
    return { x: d.cells.reduce((a, c) => a + c.x, 0) / n, y: d.cells.reduce((a, c) => a + c.y, 0) / n };
  }
  const s = sim.squadById(m.squad);
  return s ? sim.squadCenter(s) : null;
}

export function addCard(sim: Sim, plan: Plan, kind: CardKind, squadId: number, arg = ''): string | null {
  if (plan.cards.length >= sim.cardLimit()) return `Lều họp chiến chỉ cho ${sim.cardLimit()} thẻ lệnh: nâng cấp lều hoặc bỏ bớt`;
  if (kind !== 'signal' && !sim.squadById(squadId)) return 'Không có đội này';
  if (plan.cards.some((c) => c.kind === kind && c.squad === squadId && c.arg === arg)) return 'Đã có thẻ này';
  plan.cards.push({ id: plan.nextCard++, kind, squad: squadId, arg });
  return null;
}

export function removeCard(plan: Plan, cardId: number): void { plan.cards = plan.cards.filter((c) => c.id !== cardId); }

/** What the war council would say of the plan, in words. Lines that start with ✗ stop it from starting. */
export function reviewPlan(sim: Sim, plan: Plan): string[] {
  const out: string[] = [];
  const t = plan.tribe ? sim.tribes.find((x) => x.id === plan.tribe) : undefined;
  if (plan.kind === 'attack') {
    if (!t) out.push('✗ Chưa chọn làng để đánh.');
    else if (t.state !== 'free') out.push(`✗ ${t.def.name} không còn là kẻ địch.`);
    else {
      const level = sim.mapLevel(t.id), maps = sim.maps.filter((m) => m.tribe === t.id);
      if (!level && !sim.dev.freeBuild) out.push('✗ Chưa có bản đồ nào của làng này: hãy cử trinh sát.');
      else {
        const newest = Math.max(...maps.map((m) => m.at));
        const days = Math.floor((sim.time - newest) / 1200);
        out.push(days >= 3 ? 'Bản đồ đã cũ, địch có thể đã đổi bố trí.' : days >= 1 ? `Báo cáo trinh sát từ ${days} hôm trước.` : 'Báo cáo trinh sát mới trong ngày.');
        if (maps.some((m) => m.gaps > 0)) out.push('Bản đồ còn hở vì ít trinh sát về: vài chỗ chưa chắc chắn.');
      }
    }
  }
  if (!plan.missions.length) out.push('✗ Chưa giao nhiệm vụ cho đội nào.');
  for (const m of plan.missions) {
    const s = sim.squadById(m.squad), n = s ? sim.squadUnits(s).length : 0, name = s?.name ?? '?';
    if (!n) out.push(`✗ ${name} chưa có lính.`);
    else if (isLogistics(plan, m)) out.push(`${name} là đội hậu cần (không có mũi tên): đi trước phá vật cản trên đường các đội khác rồi về chỗ cũ, không ra trận.`);
    else if (plan.kind === 'attack' && !m.path.length && !canTarget(sim, m.objective, plan.tribe)) out.push(`✗ ${name} nhắm "${OBJECTIVE_NAME[m.objective]}" nhưng bản đồ chưa đủ cấp.`);
    else if (plan.kind === 'attack' && !m.path.length) out.push(`${name} chưa có mục tiêu: bấm vào công trình hoặc người trên bản đồ, nếu không sẽ tiến thẳng vào đống lửa của địch.`);
    if (n && m.trigger.kind === 'signal' && !plan.cards.some((c) => c.kind === 'signal')) out.push(`${name} chờ tín hiệu mà kế hoạch không có thẻ Phát tín hiệu: sẽ không bao giờ xuất phát.`);
    if (n && m.trigger.kind === 'after' && !plan.missions.some((x) => x.squad === (m.trigger as { squad: number }).squad)) out.push(`✗ ${name} chờ một đội không có trong kế hoạch.`);
    if (n && m.deploy && n < m.deploy.cells.length && !isLogistics(plan, m)) out.push(`✗ ${name} mới có ${n}/${m.deploy.cells.length} lính cho ${m.deploy.cells.length} ô đội hình: thêm lính vào đội hoặc bớt ô (✂ Bớt ô).`);
    const unfit = s ? sim.squadUnits(s).filter((v) => v.down > 0 || v.train || sim.sleepLocked(v)).length : 0;
    if (unfit) out.push(`✗ ${name}: ${unfit} lính đang bị thương, đang huấn luyện hoặc ngủ say hồi sức, chưa đi được: đợi họ khỏe hoặc đưa ra khỏi đội.`);
    if (s && n && !sim.squadCenter(s)) out.push(`${name} chưa có chỗ đứng.`);
    if (s && plan.kind === 'attack' && m.withdrawAt > 0 && !m.retreat.length && m.path.length) out.push(`${name} sẽ rút về chỗ hẹn vì chưa vẽ đường rút.`);
    if (s && plan.kind === 'attack' && m.route === 'night') out.push(`${name} đi đường vòng ban đêm: sẽ chờ đến tối mới xuất phát.`);
    if (s && plan.kind === 'attack') out.push(...obstacleLines(sim, plan, m, name));
  }
  if (plan.kind === 'attack') {
    const starts = plan.missions.filter((m) => m.trigger.kind === 'time' && m.trigger.at <= 0).length;
    if (plan.missions.length && !starts && !plan.cards.some((c) => c.kind === 'go')) out.push('Không đội nào có giờ xuất phát: hãy thêm thẻ Xuất phát hoặc đặt giờ.');
  }
  return out;
}

/** A squad with no arrow in a plan whose other squads have one is the supply squad (đội hậu cần): it does not fight, it goes ahead and clears the way for the rest. */
export function isLogistics(plan: Plan, m: Mission): boolean {
  return plan.kind === 'attack' && !m.path.length && !m.target && plan.missions.some((x) => x.path.length > 0);
}

/** Supply squads of the plan that still have soldiers. */
function supplyUnits(sim: Sim, plan: Plan): Array<ReturnType<Sim['squadUnits']>[number]> {
  return plan.missions.filter((m) => isLogistics(plan, m)).flatMap((m) => { const s = sim.squadById(m.squad); return s ? sim.squadUnits(s) : []; });
}

/** What stands in the way of a squad of the plan: on its arrow (red: soldiers keep to the arrow and halt there) and in the cells of its formation. Lines that start with ✗ stop the plan from starting. */
function obstacleLines(sim: Sim, plan: Plan, m: Mission, name: string): string[] {
  const out: string[] = [], start = sim.missionStart(m);
  if (start && m.path.length) {
    const hits = sim.pathHits(start, m.path, m.target?.kind === 'prop' ? m.target.at : undefined), seen = new Set<string>(), crew = supplyUnits(sim, plan).length > 0;
    for (const o of hits) {
      if (!o || o.kind === 'enemy' || seen.has(`${o.x},${o.y}`)) continue;
      seen.add(`${o.x},${o.y}`);
      if (!o.clear) out.push(`✗ ${name}: mũi tên vướng ${o.label} ở (${o.x}, ${o.y}), không phá được: hãy uốn mũi tên đi vòng.`);
      else if (!crew) out.push(`✗ ${name}: mũi tên vướng ${o.label} ở (${o.x}, ${o.y}): cần một đội hậu cần (một đội không vẽ mũi tên) có lính để phá trước khi đánh.`);
    }
  }
  if (m.deploy) {
    const under = m.deploy.cells.map((c) => sim.obstacleAt(Math.floor(c.x), Math.floor(c.y))).filter((o): o is Obstacle => !!o);
    const cut = under.filter((o) => o.clear && o.kind !== 'enemy').length, stuck = under.length - cut;
    if (cut) out.push(`${name}: ${cut} ô đội hình nằm dưới cây hoặc đá, lính sẽ tự phá khi triển khai.`);
    if (stuck) out.push(`${name}: ${stuck} ô đội hình nằm trên nước hoặc công trình, không phá được: lính đứng lệch ra, đội hình bị méo.`);
  }
  return out;
}

/** At deployment: every tree, rock or bush on the arrows of the other squads (and a couple of tiles either side, for the width of a formation) goes on the supply squads' list. */
function listClears(sim: Sim, plan: Plan): void {
  const todo = new Map<number, { squad: number; x: number; y: number }>(), crew = plan.missions.find((m) => isLogistics(plan, m))?.squad ?? -1;
  for (const m of plan.missions) {
    const s = sim.squadById(m.squad), start = sim.missionStart(m);
    if (!s || !start || !m.path.length) continue;
    for (const o of sim.corridorBlocks(start, m.path, m.target?.kind === 'prop' ? m.target.at : undefined)) todo.set(o.y * sim.world.size + o.x, { squad: crew, x: o.x, y: o.y });
  }
  plan.clears = [...todo.values()].slice(0, 80);
}

/** The supply soldiers break the listed things one after another, nearest first, and go back where they stood when none is left. Run again now and then. */
function crewClears(sim: Sim, plan: Plan): void {
  plan.clears = plan.clears.filter((c) => { const o = sim.obstacleAt(c.x, c.y); return !!o && o.clear; });
  const crew = supplyUnits(sim, plan), busy = new Set(crew.filter((v) => v.breaks).map((v) => `${v.breaks!.x},${v.breaks!.y}`));
  if (!crew.length) return; // nobody left to do it: whatever stays is dealt with by the squads that are halted by it
  for (const v of crew) {
    if (v.breaks) continue;
    const c = plan.clears.filter((q) => !busy.has(`${q.x},${q.y}`)).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
    if (!c) break;
    busy.add(`${c.x},${c.y}`);
    sim.startBreaking(v, sim.obstacleAt(c.x, c.y)!, v.fight.anchor ?? { x: v.x, y: v.y });
  }
}

/** Call off a plan that is still being drawn. Returns an error or null. */
export function cancelPlan(sim: Sim, plan: Plan): string | null {
  if (plan.status === 'running') return 'Kế hoạch đang chạy: hãy rút quân trước';
  sim.plans.splice(sim.plans.indexOf(plan), 1);
  return null;
}

// ---------------------------------------------------------------- running an attack
/** Where a mission is headed on the enemy's ground. */
export function objectivePos(sim: Sim, plan: Plan, m: Mission): { x: number; y: number; target?: number } | null {
  const t = sim.tribes.find((x) => x.id === plan.tribe);
  if (!t) return null;
  const toward = (d: number, side = 0) => {
    const dx = plan.rally.x - t.camp.x, dy = plan.rally.y - t.camp.y, len = Math.max(1, Math.hypot(dx, dy));
    return { x: t.camp.x + (dx / len) * d - (dy / len) * side, y: t.camp.y + (dy / len) * d + (dx / len) * side };
  };
  switch (m.objective) {
    case 'gate': return toward(9);
    case 'ambush': return toward(14, 8);
    case 'stores': { const p = t.props.find((q) => q.kind === 'pile'); return p ? { x: p.x + 1, y: p.y + 1 } : { ...t.camp }; }
    case 'leader': { const l = sim.get(t.leaderId); return l && l.health > 0 ? { x: l.x, y: l.y, target: l.id } : { ...t.camp }; }
    default: return { ...t.camp };
  }
}

/** How a squad walks the leg of its arrow it is on: what it does on the way, and at the end of the arrow, follows its stance. */
function goLeg(sim: Sim, s: Squad, m: Mission, pts: readonly Pt[]): void {
  const p = pts[Math.min(m.leg, pts.length - 1)], last = m.leg >= pts.length - 1;
  const mode = m.state === 'withdraw' || m.stance === 'evade' ? 'move' : last && m.stance === 'hold' ? 'hold' : 'attack';
  if (m.state === 'withdraw' || pts !== m.path) { sim.squadMove(s, p.x, p.y, mode); return; }
  // going forward the soldiers keep to the arrow: straight lines, no finding of a way; if the tiles ahead are shut the squad stops
  const ob = sim.arrowMove(s, m, p, mode);
  if (ob) sim.haltSquad(m, s, ob);
}

/** Walk the arrow: on reaching each point turn to the next; at the last the squad is at its target. */
function pathStep(sim: Sim, m: Mission, s: Squad, c: Pt): void {
  if (m.state !== 'march') return;
  const p = m.path[m.leg];
  if (!p || Math.hypot(p.x - c.x, p.y - c.y) > 3.5) return;
  if (m.leg < m.path.length - 1) { m.leg++; goLeg(sim, s, m, m.path); return; }
  m.state = 'engaged'; sim.noteBattle('note', `${s.name} tới chỗ tấn công.`);
  // the target may no longer be where the map showed it: with nobody about the end of the arrow the squad does not wander off after strangers,
  // it stands there in its formation and fights whatever comes near; with enemies about it goes on at them
  const end = m.path[m.path.length - 1];
  if (m.target || m.stance === 'evade' || !end) return;
  const about = sim.foes.some((f) => f.health > 0 && f.ai && f.ai.role !== 'civ' && Math.hypot(f.x - end.x, f.y - end.y) < 12);
  if (!about) { sim.squadMove(s, end.x, end.y, 'hold'); sim.noteBattle('note', `${s.name} không thấy ai ở cuối mũi tên: giữ vị trí và đánh mọi thứ xung quanh.`); }
}

function dispatch(sim: Sim, plan: Plan, m: Mission, s: Squad): void {
  if (m.path.length) {
    m.state = 'march'; m.leg = 0; goLeg(sim, s, m, m.path);
    if (m.stance === 'shoot') for (const v of sim.squadUnits(s)) if (!v.weapon || !(v.weapon === 'bow' || v.weapon === 'sling')) sim.orderHold([v.id]);
    return;
  }
  const pos = objectivePos(sim, plan, m);
  if (!pos) return;
  m.state = 'march';
  const c = sim.squadCenter(s) ?? plan.rally;
  // the forest road goes round by the side: first to a point abreast of the village, then in
  if (m.route === 'forest') {
    const dx = pos.x - c.x, dy = pos.y - c.y, len = Math.max(1, Math.hypot(dx, dy));
    sim.squadMove(s, c.x + dx * 0.5 - (dy / len) * 10, c.y + dy * 0.5 + (dx / len) * 10, m.stance === 'evade' ? 'move' : 'attack');
    return;
  }
  sim.squadMove(s, pos.x, pos.y, m.stance === 'evade' ? 'move' : 'attack');
  if (m.stance === 'shoot') for (const v of sim.squadUnits(s)) if (!v.weapon || !(v.weapon === 'bow' || v.weapon === 'sling')) sim.orderHold([v.id]);
}

function triggered(sim: Sim, plan: Plan, m: Mission): boolean {
  const t = sim.tribes.find((x) => x.id === plan.tribe), tr = m.trigger;
  if (m.route === 'night' && !sim.resting) return false;
  if (tr.kind === 'time') return sim.time - plan.startedAt >= tr.at;
  if (tr.kind === 'signal') return plan.signal;
  if (tr.kind === 'after') { const o = plan.missions.find((x) => x.squad === tr.squad); return !!o && (o.state === 'engaged' || o.state === 'withdraw' || o.state === 'done'); }
  if (!t) return false;
  const raiders = t.unitIds.map((u) => sim.get(u)).filter((u) => u && u.ai?.role !== 'civ');
  return raiders.length > 0 && raiders.some((u) => Math.hypot(u!.x - t.camp.x, u!.y - t.camp.y) > 9); // when they come out of the village
}

/** Send each soldier to a cell: the foot soldiers to the cells in front, the archers behind them. */
function assemble(sim: Sim, s: Squad, d: NonNullable<Mission['deploy']>): void {
  const us = sim.squadUnits(s).sort((a, b) => (sim.armOf(a) === 'archer' ? 1 : 0) - (sim.armOf(b) === 'archer' ? 1 : 0) || a.id - b.id);
  const front = (c: Pt) => c.x * Math.cos(d.heading) + c.y * Math.sin(d.heading);
  const cells = d.cells.slice().sort((a, b) => front(b) - front(a)), taken = new Set<number>();
  s.heading = d.heading; s.anchor = { x: cells.reduce((a, c) => a + c.x, 0) / cells.length, y: cells.reduce((a, c) => a + c.y, 0) / cells.length };
  us.forEach((v, i) => {
    const c = cells[Math.min(i, cells.length - 1)], ob = sim.obstacleAt(Math.floor(c.x), Math.floor(c.y));
    // a cell under a tree or a rock: the soldier whose place it is cuts it down and then walks to it, so the formation keeps its shape
    if (ob?.clear && ob.kind !== 'enemy' && sim.startBreaking(v, ob, { x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + 0.5 })) { taken.add(Math.floor(c.y) * sim.world.size + Math.floor(c.x)); return; }
    const spot = sim.nearestFree(Math.floor(c.x), Math.floor(c.y), taken) ?? [Math.floor(c.x), Math.floor(c.y)];
    taken.add(spot[1] * sim.world.size + spot[0]);
    sim.orderMove([v.id], spot[0], spot[1]);
  });
}

/** Whether every soldier of the plan stands at the cell he was sent to. */
function assembled(sim: Sim, plan: Plan): boolean {
  return (!plan.clears.length || !supplyUnits(sim, plan).length) && plan.missions.every((m) => { const s = sim.squadById(m.squad); return !s || sim.squadUnits(s).every((v) => !v.breaks && (!v.fight.anchor || Math.hypot(v.x - v.fight.anchor.x, v.y - v.fight.anchor.y) < 2.5)); });
}

/** Soldiers of the plan who are not at their cell and not on their way (they could not set out at once, or the way was blocked) are sent again. Once a second. */
function regather(sim: Sim, plan: Plan): void {
  for (const m of plan.missions) {
    const s = sim.squadById(m.squad); if (!s) continue;
    for (const v of sim.squadUnits(s)) {
      const a = v.fight.anchor;
      if (!a || v.breaks || v.phase === 'fight' || v.path.length || v.down > 0 || Math.hypot(v.x - a.x, v.y - a.y) < 2.5) continue;
      const ob = sim.obstacleAt(Math.floor(a.x), Math.floor(a.y));
      if (ob?.clear && ob.kind !== 'enemy' && sim.startBreaking(v, ob, a)) continue; // his cell is still under a tree
      sim.orderMove([v.id], Math.floor(a.x), Math.floor(a.y));
    }
  }
}

/** The player decides to fight: the missions of the plan are carried out from now on. */
export function engagePlan(sim: Sim, plan: Plan): string | null {
  if (plan.kind !== 'attack' || plan.status !== 'running') return 'Kế hoạch chưa triển khai';
  if (plan.stage === 'assemble') return 'Quân chưa vào vị trí hết';
  if (plan.stage !== 'ready') return plan.stage === 'fight' ? 'Đang đánh rồi' : 'Quân đang rút';
  plan.stage = 'fight'; plan.startedAt = sim.time; plan.signal = false;
  sim.say('Xung phong! Kế hoạch tác chiến được thực thi.');
  sim.noteBattle('note', 'Lệnh đánh được ban ra.');
  return null;
}

/**
 * The player pulls the army back. Before the first blow this calls the whole deployment off: every squad goes straight home, and the plan is a draft again
 * when they are there. In the middle of a fight it is a retreat: each squad falls back by the way drawn for it (or to the rally point) and the plan ends.
 */
export function withdrawPlan(sim: Sim, plan: Plan): string | null {
  if (plan.kind !== 'attack' || plan.status !== 'running') return 'Kế hoạch chưa triển khai';
  if (plan.stage === 'retreat' || plan.stage === 'recall') return 'Quân đang rút rồi';
  const recall = plan.stage === 'assemble' || plan.stage === 'ready';
  plan.stage = recall ? 'recall' : 'retreat';
  if (recall) {
    plan.startedAt = sim.time;
    for (const m of plan.missions) { const s = sim.squadById(m.squad); m.state = 'withdraw'; m.leg = 0; if (s && sim.squadUnits(s).length) sim.squadMove(s, plan.rally.x, plan.rally.y, 'move'); }
    sim.say('Hủy trận: toàn quân rút về làng.'); sim.noteBattle('note', 'Hủy trận trước khi đánh, toàn quân về làng.');
    return null;
  }
  for (const m of plan.missions) {
    const s = sim.squadById(m.squad);
    if (!s || m.state === 'done' || !sim.squadUnits(s).length) { m.state = 'done'; continue; }
    m.state = 'withdraw'; m.leg = 0;
    if (m.retreat.length) goLeg(sim, s, m, m.retreat); else sim.squadMove(s, plan.rally.x, plan.rally.y, 'move');
  }
  sim.say('Rút quân!'); sim.noteBattle('note', 'Lệnh rút toàn quân.');
  return null;
}

/** Deploy a plan: the soldiers walk to their cells and wait there for the order to fight or fall back. */
export function startPlan(sim: Sim, plan: Plan): string | null {
  const bad = reviewPlan(sim, plan).find((l) => l.startsWith('✗'));
  if (bad) return bad.slice(2);
  if (plan.kind === 'defense') return 'Kế hoạch phòng thủ chạy khi bạn đánh trống báo động';
  for (const m of plan.missions) {
    const s = sim.squadById(m.squad)!; m.state = 'wait'; m.initial = sim.squadUnits(s).length; m.leg = 0;
    m.block = null;
    if (m.deploy) assemble(sim, s, m.deploy); // go to the cells it was given, facing the way it was set, and wait there
    else if (isLogistics(plan, m)) for (const v of sim.squadUnits(s)) { v.fight.mode = 'guard'; v.fight.anchor = { x: v.x, y: v.y }; } // supply soldiers hold where they stand, and come back to it
  }
  plan.status = 'running'; plan.stage = 'assemble'; plan.startedAt = sim.time; plan.signal = false; plan.result = '';
  listClears(sim, plan); crewClears(sim, plan);
  sim.say(`Triển khai quân đánh ${sim.tribes.find((t) => t.id === plan.tribe)?.def.name ?? ''} bắt đầu.`);
  return null;
}

/**
 * How a war ends. It is won when the village has no soldier left, its fire is out and every one of its works is down (then the people ask for mercy).
 * It is lost when there is no soldier of ours left, or the army was pulled back.
 */
function endCheck(sim: Sim, plan: Plan, t: Sim['tribes'][number] | undefined): void {
  if (!t) { plan.status = 'done'; plan.result = 'lost'; return; }
  const armed = t.unitIds.some((id) => { const u = sim.get(id); return !!u && u.health > 0 && u.ai?.role !== 'civ'; });
  if (t.state !== 'free' || (!armed && t.props.length === 0)) {
    plan.status = 'done'; plan.result = 'won';
    sim.say(`Chiến thắng! ${t.def.name} không còn lính, lửa tắt và mọi công trình đã sập.`);
    sim.noteBattle('note', `${t.def.name} bị san bằng.`);
    if (t.state === 'free') sim.conquer(t.id, 'Làng bị san bằng');
    return;
  }
  if (plan.missions.every((m) => m.state === 'done' || m.state === 'idle')) {
    plan.status = 'done'; plan.result = 'lost';
    const left = plan.missions.some((m) => m.initial > 0 && (sim.squadById(m.squad) ? sim.squadUnits(sim.squadById(m.squad)!).length : 0) > 0);
    sim.say(left ? 'Thua trận: quân ta đã rút khỏi chiến trường.' : 'Thua trận: quân ta không còn ai.');
  }
}

export function tickPlans(sim: Sim, dt: number): void {
  if (sim.alarmUntil > 0 && sim.time > sim.alarmUntil) sim.alarmUntil = 0;
  for (const plan of sim.plans) {
    if (plan.kind !== 'attack' || plan.status !== 'running') continue;
    const t = sim.tribes.find((x) => x.id === plan.tribe);
    if (plan.stage === 'assemble') {
      if (Math.floor(sim.time) !== Math.floor(sim.time - dt)) { regather(sim, plan); crewClears(sim, plan); }
      const late = sim.time - plan.startedAt > 150 + 60 * plan.clears.length;
      if (assembled(sim, plan) || late) {
        plan.stage = 'ready';
        const missing = plan.missions.reduce((a, m) => { const s = sim.squadById(m.squad); return a + (s ? sim.squadUnits(s).filter((v) => v.fight.anchor && Math.hypot(v.x - v.fight.anchor.x, v.y - v.fight.anchor.y) >= 2.5).length : 0); }, 0);
        sim.say(missing ? `Quân đã vào vị trí, còn ${missing} lính chưa tới kịp. Đánh hay rút?` : 'Quân đã vào vị trí. Đánh hay rút?');
      }
    }
    if (plan.stage === 'recall') {
      // home again (or long enough on the road): the plan is as it was before it was deployed, to be changed or sent out again
      const home = plan.missions.every((m) => { const s = sim.squadById(m.squad), c = s ? sim.squadCenter(s) : null; return !c || Math.hypot(plan.rally.x - c.x, plan.rally.y - c.y) < 7; });
      if (home || sim.time - plan.startedAt > 240) {
        plan.status = 'draft'; plan.stage = 'assemble';
        for (const m of plan.missions) { m.state = 'idle'; m.leg = 0; }
        sim.say('Quân đã về làng. Kế hoạch được giữ nguyên: sửa rồi triển khai lại khi muốn.');
      }
      continue;
    }
    if (plan.stage === 'assemble' || plan.stage === 'ready') continue; // the soldiers stand where the plan put them until the player gives the word
    const second = Math.floor(sim.time) !== Math.floor(sim.time - dt), half = Math.floor(sim.time * 2) !== Math.floor((sim.time - dt) * 2);
    for (const m of plan.missions) {
      const s = sim.squadById(m.squad);
      if (!s || !sim.squadUnits(s).length || isLogistics(plan, m)) { if (m.state !== 'done') { m.state = 'done'; } continue; } // the supply squad has done its work
      const alive = sim.squadUnits(s).length, c = sim.squadCenter(s)!;
      if (m.state === 'wait' && triggered(sim, plan, m)) dispatch(sim, plan, m, s);
      else if (m.state === 'blocked') {
        if (second && sim.blockCleared(m)) { m.block = null; m.state = 'march'; goLeg(sim, s, m, m.path); sim.say(`${s.name} đi tiếp.`); }
      }
      if (m.state === 'march' || m.state === 'engaged' || m.state === 'blocked') {
        if (m.state === 'march' && m.path.length && half && sim.watchMarch(m, s)) continue; // the way ahead is shut: halted
        if (second && m.state !== 'blocked') sim.tickTarget(plan, m, s);
        const pos = m.path.length ? null : objectivePos(sim, plan, m);
        if (m.path.length && m.state !== 'blocked') pathStep(sim, m, s, c);
        if (pos) {
          const d = Math.hypot(pos.x - c.x, pos.y - c.y);
          if (m.state === 'march' && d < 9) {
            m.state = 'engaged'; sim.noteBattle('note', `${s.name} áp sát ${OBJECTIVE_NAME[m.objective].toLowerCase()}.`);
            if (pos.target) sim.orderAttack(sim.squadUnits(s).map((v) => v.id), { kind: 'unit', id: pos.target });
          } else if (m.state === 'march' && m.route === 'forest' && d > 12 && Math.hypot((s.anchor?.x ?? 0) - c.x, (s.anchor?.y ?? 0) - c.y) < 4) dispatch(sim, plan, { ...m, route: 'main' }, s); // reached the flank: now go in
        }
        const lost = m.initial ? 1 - alive / m.initial : 0;
        if (m.withdrawAt > 0 && lost >= m.withdrawAt) {
          m.state = 'withdraw'; m.leg = 0; m.block = null;
          if (m.retreat.length) goLeg(sim, s, m, m.retreat); else sim.squadMove(s, plan.rally.x, plan.rally.y, 'move'); sim.noteBattle('note', `${s.name} rút lui sau khi mất ${Math.round(lost * 100)}% quân.`); sim.say(`${s.name} rút lui!`); }
      } else if (m.state === 'withdraw') {
        if (m.retreat.length) {
          const p = m.retreat[m.leg];
          if (p && Math.hypot(p.x - c.x, p.y - c.y) < 3.5) { if (m.leg < m.retreat.length - 1) { m.leg++; goLeg(sim, s, m, m.retreat); } else m.state = 'done'; }
        } else if (Math.hypot(plan.rally.x - c.x, plan.rally.y - c.y) < 7) m.state = 'done';
      }
    }
    endCheck(sim, plan, t);
  }
}

// ---------------------------------------------------------------- command cards
export function playCard(sim: Sim, plan: Plan, cardId: number): string | null {
  const card = plan.cards.find((c) => c.id === cardId);
  if (!card) return 'Không có thẻ này';
  if (card.kind === 'signal') { plan.signal = true; sim.say('Tín hiệu được phát đi!'); return null; }
  const s = sim.squadById(card.squad), m = plan.missions.find((x) => x.squad === card.squad);
  if (!s) return 'Đội này không còn';
  if (card.kind === 'formation') return sim.setFormation(s.id, card.arg as never);
  if (plan.status !== 'running' || !m) return 'Kế hoạch chưa bắt đầu';
  if (!sim.squadUnits(s).length) return `${s.name} không còn ai`;
  const c = sim.squadCenter(s)!;
  switch (card.kind) {
    case 'go': case 'advance': if (m.state === 'withdraw' || m.state === 'done') return `${s.name} đã rút`; if (m.state === 'blocked') return `${s.name} đang bị chặn: cử lính phá vật cản trước`; if (!m.initial) m.initial = sim.squadUnits(s).length; dispatch(sim, plan, m, s); break;
    case 'hold': m.state = 'hold'; sim.squadMove(s, c.x, c.y, 'hold'); break;
    case 'shoot': m.stance = 'shoot'; for (const v of sim.squadUnits(s)) if (v.weapon !== 'bow' && v.weapon !== 'sling') sim.orderHold([v.id]); break;
    case 'attack': if (!canTarget(sim, card.arg as Objective, plan.tribe)) return 'Bản đồ chưa đủ cấp để nhắm mục tiêu này'; m.objective = card.arg as Objective; if (!m.initial) m.initial = sim.squadUnits(s).length; dispatch(sim, plan, m, s); break;
    case 'retreat': m.state = 'withdraw'; m.leg = 0; if (m.retreat.length) goLeg(sim, s, m, m.retreat); else sim.squadMove(s, plan.rally.x, plan.rally.y, 'move'); sim.noteBattle('note', `${s.name} được lệnh rút.`); break;
  }
  return null;
}

// ---------------------------------------------------------------- the alarm drum and the defence
/** Sound the drum: the people run for the fire and the squads take the posts of the defence plan (or stand about the fire). Returns an error or null. */
export function soundAlarm(sim: Sim): string | null {
  if (RESEARCH.enabled && !sim.dev.freeBuild && !sim.researched.has('signal')) return 'Cần nghiên cứu: Tín hiệu (trống, khói)';
  sim.alarmUntil = sim.time + 180;
  sim.say('Trống báo động vang lên! Dân về đống lửa, quân về vị trí.');
  const fire = sim.campfire(), fx = (fire?.x ?? sim.world.start.x) + 1, fy = (fire?.y ?? sim.world.start.y) + 3;
  const plan = sim.plans.find((p) => p.kind === 'defense');
  const hostile = sim.foes.filter((f) => f.ai?.role === 'raider' && f.health > 0), first = hostile[0] ?? sim.tribes.find((t) => t.state === 'free' && t.raid)?.camp;
  const toward = first ?? { x: fx, y: fy + 10 };
  const inward = (b: { x: number; y: number }, w: number) => { const dx = fx - b.x, dy = fy - b.y, len = Math.max(1, Math.hypot(dx, dy)); return { x: b.x + w / 2 + (dx / len) * 1.8, y: b.y + w / 2 + (dy / len) * 1.8 }; };
  const place = (post: Mission['post']): { x: number; y: number } => {
    if (post === 'gate') { const g = sim.buildings.filter((b) => b.kind === 'gate' && b.done).sort((a, b) => Math.hypot(a.x - toward.x, a.y - toward.y) - Math.hypot(b.x - toward.x, b.y - toward.y))[0]; if (g) return inward(g, 1); }
    if (post === 'fence') { const f = sim.buildings.filter((b) => b.kind === 'fence' && b.done).sort((a, b) => Math.hypot(a.x - toward.x, a.y - toward.y) - Math.hypot(b.x - toward.x, b.y - toward.y))[0]; if (f) return inward(f, 1); }
    if (post === 'tower') { const tw = sim.buildings.filter((b) => b.kind === 'tower' && b.done).sort((a, b) => Math.hypot(a.x - toward.x, a.y - toward.y) - Math.hypot(b.x - toward.x, b.y - toward.y))[0]; if (tw) return inward(tw, 2); }
    return { x: fx, y: fy };
  };
  const squads = plan ? plan.missions : sim.squads.map((s) => ({ squad: s.id, post: 'fire' as const }));
  for (const m of squads) {
    const s = sim.squadById(m.squad); if (!s) continue;
    if (m.post === 'tower') for (const tw of sim.buildings.filter((b) => b.kind === 'tower' && b.done)) sim.assignTower(sim.squadUnits(s).map((v) => v.id), tw.id);
    const p = place(m.post);
    sim.squadMove(s, p.x, p.y, 'hold');
  }
  return null;
}

