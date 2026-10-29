/** The army: squads (đội), their formations (trận pháp) and mastery, how formations change a blow, clusters (cụm) and the log of a fight. */
import { COMMAND, SQUAD_MAX, clusterize, FORMATIONS, FormationId, FORMATION_IDS, formationOffsets, masteryFactor, placeOffset, armOfWeapon, iconCount } from './formations';
import { DAY_LENGTH } from './constants';
import { effWeapon, Ent } from './battle';
import { RESEARCH } from './research';
import type { Sim } from './sim';
import type { Squad, Villager } from './model';

const COLORS = ['#e0523c', '#3c8ce0', '#e0b43c', '#5cb85c', '#a85cd8', '#3cd0c8'];

// ---------------------------------------------------------------- squads
/** How many squads the war tent allows (its level 1..3), or the most when testing with free building. */
export function squadLimit(sim: Sim): number {
  const tent = sim.building('wartent');
  if (tent) return COMMAND.squadLimit[Math.min(COMMAND.squadLimit.length, tent.level) - 1];
  return sim.dev.freeBuild ? COMMAND.squadLimit[COMMAND.squadLimit.length - 1] : 0;
}
/** How many command cards a plan may hold: more for a higher tent, and two more once signals are researched. */
export function cardLimit(sim: Sim): number {
  const tent = sim.building('wartent'), level = tent ? tent.level : sim.dev.freeBuild ? 3 : 0;
  return level ? COMMAND.cardBase + COMMAND.cardPerLevel * level + (!RESEARCH.enabled || sim.researched.has('signal') ? 2 : 0) : 0;
}

export const squadById = (sim: Sim, id: number): Squad | undefined => sim.squads.find((s) => s.id === id);
export const squadOf = (sim: Sim, v: Villager): Squad | undefined => (v.squad >= 0 ? squadById(sim, v.squad) : undefined);

/** The living soldiers of a squad; the dead and the discharged drop out of the list. */
export function squadUnits(sim: Sim, s: Squad): Villager[] {
  const out: Villager[] = [];
  for (const id of s.ids) { const v = sim.byId.get(id); if (v && v.team === 'player' && v.job === 'fight' && v.health > 0 && v.squad === s.id) out.push(v); }
  if (out.length !== s.ids.length) s.ids = out.map((v) => v.id);
  if (!out.some((v) => v.id === s.leader)) s.leader = out.length ? out.slice().sort((a, b) => b.stats.str + b.stats.vit - a.stats.str - a.stats.vit)[0].id : -1;
  return out;
}

export function squadCenter(sim: Sim, s: Squad): { x: number; y: number } | null {
  const us = squadUnits(sim, s);
  return us.length ? { x: us.reduce((a, v) => a + v.x, 0) / us.length, y: us.reduce((a, v) => a + v.y, 0) / us.length } : null;
}

export function createSquad(sim: Sim, name?: string): { squad?: Squad; reason?: string } {
  if (sim.squads.length >= squadLimit(sim)) return { reason: squadLimit(sim) ? `Lều họp chiến chỉ cho ${squadLimit(sim)} đội: nâng cấp lều` : 'Cần dựng Lều họp chiến để lập đội' };
  const id = sim.nextSquad++;
  const s: Squad = { id, name: name ?? `Đội ${String.fromCharCode(64 + id)}`, color: COLORS[(id - 1) % COLORS.length], ids: [], leader: -1, formation: 'line', mastery: Object.fromEntries(FORMATION_IDS.map((f) => [f, COMMAND.mastery.start])), switchUntil: 0, anchor: null, heading: 0, training: false };
  sim.squads.push(s);
  return { squad: s };
}

/** Put soldiers into a squad (out of any other). Returns an error or null. */
export function joinSquad(sim: Sim, ids: readonly number[], squadId: number): string | null {
  const s = squadById(sim, squadId);
  if (!s) return 'Không có đội này';
  let err: string | null = null;
  for (const v of sim.mine(ids)) {
    if (v.job !== 'fight') { err = 'Chỉ chiến binh mới vào đội: tuyển ở đống lửa trại'; continue; }
    if (v.squad === s.id) continue;
    if (s.ids.length >= SQUAD_MAX) { err = `Một đội chỉ có tối đa ${SQUAD_MAX} người`; continue; }
    leaveSquad(sim, [v.id]);
    v.squad = s.id; s.ids.push(v.id);
  }
  return err;
}

export function leaveSquad(sim: Sim, ids: readonly number[]): void {
  for (const v of sim.mine(ids)) {
    const s = squadOf(sim, v);
    if (s) { s.ids = s.ids.filter((i) => i !== v.id); if (s.leader === v.id) s.leader = -1; }
    v.squad = -1; v.speed = 1.6 + 0.1 * v.stats.agi;
  }
}

export function disbandSquad(sim: Sim, id: number): void {
  const s = squadById(sim, id); if (!s) return;
  leaveSquad(sim, [...s.ids]);
  sim.squads.splice(sim.squads.indexOf(s), 1);
  for (const p of sim.plans) { p.missions = p.missions.filter((m) => m.squad !== id); p.cards = p.cards.filter((c) => c.squad !== id); }
}

export function setCommander(sim: Sim, squadId: number, vid: number): void {
  const s = squadById(sim, squadId);
  if (s && s.ids.includes(vid)) s.leader = vid;
}

export const formationOpen = (sim: Sim, f: FormationId): boolean => !RESEARCH.enabled || sim.dev.freeBuild || sim.researched.has(FORMATIONS[f].tech);

/** Pace of a squad's march: the formation's, so a ring crawls and a wedge hurries. */
function applySpeed(sim: Sim, s: Squad): void {
  for (const v of squadUnits(sim, s)) v.speed = (1.6 + 0.1 * v.stats.agi) * FORMATIONS[s.formation].speed;
}

/** Change formation. It takes a few seconds, during which the squad is easy to hit. Returns an error or null. */
export function setFormation(sim: Sim, squadId: number, f: FormationId): string | null {
  const s = squadById(sim, squadId);
  if (!s) return 'Không có đội này';
  if (!FORMATIONS[f]) return 'Không có trận này';
  if (!formationOpen(sim, f)) return `Cần nghiên cứu: ${f === 'line' || f === 'circle' ? 'Trận pháp cơ bản' : FORMATIONS[f].name}`;
  if (s.formation === f) return null;
  s.formation = f; s.switchUntil = sim.time + COMMAND.mastery.switchSeconds;
  applySpeed(sim, s);
  if (s.anchor) squadMove(sim, s, s.anchor.x, s.anchor.y, 'hold');
  return null;
}

/**
 * Send the squad to a point in its formation: each soldier is given his own place (foot soldiers in front, archers behind).
 * 'attack' fights what it meets on the way, 'move' does not, 'hold' stands there on guard.
 */
export function squadMove(sim: Sim, s: Squad, x: number, y: number, mode: 'attack' | 'move' | 'hold', heading?: number): void {
  const us = squadUnits(sim, s);
  if (!us.length) return;
  const c = squadCenter(sim, s)!;
  s.heading = heading ?? (Math.hypot(x - c.x, y - c.y) > 1 ? Math.atan2(y - c.y, x - c.x) : s.heading);
  s.anchor = { x, y };
  // the front rank first: foot soldiers, then archers, each side keeping to its own offset
  us.sort((a, b) => (armOfWeapon(effWeapon(a)) === 'archer' ? 1 : 0) - (armOfWeapon(effWeapon(b)) === 'archer' ? 1 : 0) || a.id - b.id);
  const offs = formationOffsets(s.formation, us.length), taken = new Set<number>();
  applySpeed(sim, s);
  us.forEach((v, i) => {
    const [px, py] = placeOffset(offs[i], s.heading, x, y);
    const spot = sim.nearestFree(Math.floor(px), Math.floor(py), taken) ?? [Math.floor(px), Math.floor(py)];
    taken.add(spot[1] * sim.world.size + spot[0]);
    if (mode === 'move') sim.orderMove([v.id], spot[0], spot[1]); // orderMove takes whole tiles
    else if (mode === 'attack') sim.orderAttackMove([v.id], spot[0] + 0.5, spot[1] + 0.5);
    else { sim.orderAttackMove([v.id], spot[0] + 0.5, spot[1] + 0.5); v.fight.anchor = { x: spot[0] + 0.5, y: spot[1] + 0.5 }; }
  });
}

/** Send the squad to drill, or call it off. It must have a Bãi tập. */
export function trainSquad(sim: Sim, squadId: number, on: boolean): string | null {
  const s = squadById(sim, squadId);
  if (!s) return 'Không có đội này';
  if (!on) { s.training = false; return null; }
  const field = sim.building('drill');
  if (!field) return 'Cần dựng Bãi tập';
  s.training = true;
  squadMove(sim, s, field.x + 1.5, field.y + 1.5, 'hold');
  return null;
}

/** Drill raises the mastery of the formation in use; what is not used is slowly forgotten. */
export function tickTraining(sim: Sim, dt: number): void {
  const field = sim.building('drill');
  for (const s of sim.squads) {
    const us = squadUnits(sim, s);
    const near = field && us.length ? us.filter((v) => Math.hypot(v.x - (field.x + 1.5), v.y - (field.y + 1.5)) < 7).length >= Math.ceil(us.length / 2) : false;
    for (const f of FORMATION_IDS) {
      if (f === s.formation && s.training && near) s.mastery[f] = Math.min(100, s.mastery[f] + COMMAND.mastery.perSecond * dt);
      else s.mastery[f] = Math.max(0, s.mastery[f] - (COMMAND.mastery.decayPerDay * dt) / DAY_LENGTH);
    }
    if (s.training && !field) s.training = false;
  }
}

// ---------------------------------------------------------------- what a squad does to a blow
/** Factor on the damage one of our soldiers does: his formation (and how well it is known), a flank or a surprise, and what we know of the enemy. */
export function attackFactor(sim: Sim, v: Villager, e: Ent): number {
  if (v.team !== 'player') return 1;
  let f = 1;
  const s = squadOf(sim, v);
  if (s) {
    const fm = FORMATIONS[s.formation];
    f *= fm.dmg * masteryFactor(s.mastery[s.formation]);
    if (fm.charge && v.path.length > 0) f *= fm.charge;
    if (fm.flank && e.kind === 'unit' && ((e.v.facing === 'right' && v.x < e.v.x) || (e.v.facing === 'left' && v.x > e.v.x))) f *= fm.flank;
    if (fm.firstBlow && e.kind === 'unit' && !e.v.fight.target && e.v.phase !== 'fight') f *= fm.firstBlow;
  }
  if (e.kind === 'unit' && e.v.team !== 'player') f *= COMMAND.info[Math.min(3, sim.mapLevel(e.v.team))];
  return f;
}

/** Factor on the damage one of our soldiers takes: his squad's formation, worse while it is being changed, better against arrows when scattered. */
export function takenFactor(sim: Sim, victim: Villager, ranged: boolean): number {
  const s = squadOf(sim, victim);
  if (!s) return 1;
  const fm = FORMATIONS[s.formation];
  return fm.taken * (ranged ? fm.takenRanged ?? 1 : 1) * (s.switchUntil > sim.time ? COMMAND.mastery.switchTaken : 1);
}

// ---------------------------------------------------------------- clusters (cụm)
export interface Cluster { id: string; side: string; squad: number; color: string; arm: 'foot' | 'archer' | 'cavalry'; ids: number[]; x: number; y: number; hp: number; n: number }

/** The soldiers of each side in clusters of up to 10 of one arm and one squad, with where they stand and how well they are. */
export function clusters(sim: Sim): Cluster[] {
  const units = [...sim.villagers.filter((v) => v.job === 'fight' && v.health > 0 && v.inside === null), ...sim.foes.filter((f) => f.health > 0 && f.ai && f.ai.role !== 'civ')];
  const key = (v: Villager) => (v.team === 'player' ? `p:${v.squad}` : `f:${v.team}`);
  const out: Cluster[] = [];
  const by = new Map(units.map((v) => [v.id, v]));
  for (const c of clusterize(units.map((v) => ({ id: v.id, arm: armOfWeapon(effWeapon(v)), key: key(v) })))) {
    const vs = c.ids.map((id) => by.get(id)!);
    const sq = c.key.startsWith('p:') ? Number(c.key.slice(2)) : -1, squad = sq >= 0 ? squadById(sim, sq) : undefined;
    out.push({
      id: `${c.key}|${c.arm}|${c.ids[0]}`, side: vs[0].team, squad: sq, color: squad?.color ?? (vs[0].team === 'player' ? '#9aa4b0' : '#c04040'), arm: c.arm, ids: c.ids,
      x: vs.reduce((a, v) => a + v.x, 0) / vs.length, y: vs.reduce((a, v) => a + v.y, 0) / vs.length,
      hp: vs.reduce((a, v) => a + Math.max(0, v.health) / v.maxHealth, 0) / vs.length, n: vs.length,
    });
  }
  return out;
}

/** In a big battle (over the threshold on either side) the figures drawn are cut to one for about three soldiers; null when every soldier is drawn. */
export function drawnFigures(sim: Sim): Set<number> | null {
  const cs = clusters(sim), ours = cs.filter((c) => c.side === 'player').reduce((n, c) => n + c.n, 0), theirs = cs.filter((c) => c.side !== 'player').reduce((n, c) => n + c.n, 0);
  if (Math.max(ours, theirs) <= COMMAND.bigBattle) return null;
  const shown = new Set<number>();
  for (const c of cs) for (const id of c.ids.slice(0, iconCount(c.n))) shown.add(id);
  return shown;
}

// ---------------------------------------------------------------- the log of a fight
export type BattleEvent = 'ours' | 'foes' | 'breach' | 'shot' | 'note';
/** Count a happening in the fight that is on. */
export function noteBattle(sim: Sim, kind: BattleEvent, text = ''): void {
  const b = sim.battle;
  if (!b.on) return;
  if (kind === 'ours') b.ourDead++; else if (kind === 'foes') b.foeDead++; else if (kind === 'breach') b.breaches++; else if (kind === 'shot') b.shots++;
  else if (text && b.notes.length < 12) b.notes.push(text);
}

/** A fight starts when raiders are on the field and ends ten seconds after the last is gone: it is written up in words. */
export function tickBattle(sim: Sim, dt: number): void {
  const b = sim.battle, hostile = sim.foes.some((f) => f.ai?.role === 'raider' && f.health > 0);
  if (hostile && !b.on) { Object.assign(b, { on: true, since: sim.time, quiet: 0, ourDead: 0, foeDead: 0, breaches: 0, shots: 0, notes: [] }); return; }
  if (!b.on) return;
  b.quiet = hostile ? 0 : b.quiet + dt;
  if (b.quiet < 10) return;
  b.on = false; sim.alarmUntil = 0;
  const lines = [`Trận kéo dài ${Math.max(1, Math.round((sim.time - b.since) / 60))} phút: ta mất ${b.ourDead}, địch mất ${b.foeDead}.`];
  if (b.breaches) lines.push(`${b.breaches} đoạn hàng rào hoặc cổng bị phá.`);
  if (b.shots) lines.push(`Cung thủ trên chòi bắn ${b.shots} phát.`);
  lines.push(...b.notes);
  sim.battleReports.push({ at: sim.time, lines }); if (sim.battleReports.length > 8) sim.battleReports.shift();
  for (const l of lines) sim.say(l);
}
