/**
 * The two specialists of the story (data/specialists.json): the bodyguard, a guard of rank 7 or more who keeps one villager and takes the blows meant for him, and the assassin, a hidden foe sent by
 * a village to kill one villager. Both are ordinary units (Villager, with `wardOf` and `ai.assassin`): this file only gives them their rules. It knows the rest of the game through `sim`.
 */
import type { Sim } from './sim';
import type { Villager } from './model';
import { applyStats } from './statsys';
import { specialistDef } from './specialdata';
import { MAX_RANK, rankDef, rankStatMult, branchStatMult } from './ranks';
import { maxLevel } from './buildings';
import SPEC from '../data/specialists.json';

const BG = SPEC.bodyguard, AS = SPEC.assassin;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------- the bodyguard
/** Why `guard` cannot keep `ward` (null when he can). */
export function wardError(sim: Sim, guard: Villager, ward: Villager | undefined): string | null {
  if (guard.team !== 'player' || !guard.guard) return 'Chỉ lính của Trại lính gác mới làm cận vệ được';
  if (guard.rank < BG.minRank) return `Cận vệ phải từ bậc ${BG.minRank} trở lên`;
  if (!ward || ward.team !== 'player' || ward.health <= 0) return 'Không có người để bảo vệ';
  if (ward.id === guard.id) return 'Cận vệ không tự bảo vệ mình';
  return null;
}

/** Give a guard one villager to keep (`wardId` null: let him go back to his post). Returns why not, or null. */
export function setBodyguard(sim: Sim, guardId: number, wardId: number | null): string | null {
  const g = sim.get(guardId);
  if (!g) return 'Không thấy người này';
  if (wardId === null) { g.wardOf = undefined; return null; }
  const err = wardError(sim, g, sim.get(wardId));
  if (err) return err;
  const slots = sim.legacyFx('wardSlots'); // one bodyguard for a villager; the Phòng Hộ Vệ gives one more
  if (sim.villagers.filter((x) => x.id !== g.id && x.wardOf === wardId && x.health > 0).length >= slots) return slots > 1 ? `Người này đã có đủ ${slots} cận vệ` : 'Người này đã có cận vệ (Phòng Hộ Vệ cho thêm một người)';
  g.wardOf = wardId;
  return null;
}

/** The guard who keeps `v` and is near enough to take a blow for him (null when none). */
export function bodyguardOf(sim: Sim, v: Villager): Villager | null {
  if (v.team !== 'player') return null;
  for (const g of sim.villagers) if (g.wardOf === v.id && g.id !== v.id && g.health > 0 && g.down <= 0 && g.inside === null && dist(g, v) <= BG.within) return g;
  return null;
}
/** The share of a blow the guard takes. */
export const bodyguardShare = (): number => BG.share;

/** Once a second: a guard whose villager is gone (or who is no longer fit) is let go; the others keep their post beside the villager. */
export function tickBodyguards(sim: Sim): void {
  for (const g of sim.villagers) {
    if (g.wardOf === undefined) continue;
    const w = sim.get(g.wardOf);
    if (!w || w.health <= 0 || !g.guard || g.rank < BG.minRank) { g.wardOf = undefined; continue; }
    if (w.inside === null && dist(g.guardAt ?? g, w) > BG.stay) g.guardAt = { x: w.x, y: w.y }; // he walks to his post as ever, and the post follows the one he keeps
  }
}

// ---------------------------------------------------------------- the assassin
/** A foe that is hidden from our soldiers (they neither see nor pick him as a target) until he is found or has struck. */
export const assassinHidden = (f: Villager): boolean => !!f.ai?.assassin && f.ai.assassin.hidden;

/** Who he goes for: a villager who has a bodyguard first (the one worth killing), else a villager who is no soldier, else anyone. */
function pickTarget(sim: Sim): Villager | undefined {
  const alive = sim.villagers.filter((v) => v.team === 'player' && v.health > 0 && v.inside === null);
  const pick = (l: Villager[]): Villager | undefined => l[Math.floor(sim.frnd() * l.length)];
  return pick(alive.filter((v) => sim.villagers.some((g) => g.wardOf === v.id))) ?? pick(alive.filter((v) => v.job !== 'fight')) ?? pick(alive);
}

/** A village sends an assassin (to `targetId`, or one he picks). Returns the unit, or null when there is no one to kill or the village is gone. */
export function sendAssassin(sim: Sim, tribeId: string, targetId?: number, opts?: { at?: [number, number]; shown?: boolean }): Villager | null {
  const t = sim.tribes.find((x) => x.id === tribeId);
  const target = targetId !== undefined ? sim.get(targetId) : pickTarget(sim);
  if (!t || !target || target.team !== 'player') return null;
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  const dx = t.camp.x - fx, dy = t.camp.y - fy, len = Math.max(1, Math.hypot(dx, dy)), d = Math.min(AS.spawnDist, len);
  const gx = Math.floor(fx + (dx / len) * d), gy = Math.floor(fy + (dy / len) * d), spot = opts?.at ?? sim.nearestFree(gx, gy, new Set()) ?? [gx, gy];
  const f = sim.makeVillager(spot[0], spot[1], 'm', t.id, sim.frnd);
  f.look.hide = '#2a2a30'; f.look.pants = '#1c1c22';
  f.weapon = AS.weapon; f.armor = 'assassin'; f.spec = 'assassin'; f.speed *= AS.speedMul; // the dark suit and the pair of daggers; spec gives him the dodge (battle.hurt)
  f.ai = { role: 'raider', camp: t.camp, wander: 0, goal: null, raid: 0, assassin: { target: target.id, state: 'stalk', hidden: true, revealedUntil: 0, repath: 0, born: sim.time, ...(opts?.shown ? { shown: true } : {}) } };
  sim.addFoe(f); t.unitIds.push(f.id);
  applyStats(sim, f); f.maxHealth = Math.max(1, Math.round(f.maxHealth * AS.hpMul)); f.health = f.maxHealth; // paper-thin: a blow he cannot slip kills him
  return f;
}

const walkTo = (sim: Sim, u: Villager, x: number, y: number): void => { if (dist(u, { x, y }) > 1.2 && !u.path.length) u.path = sim.pathTo(u, Math.floor(x), Math.floor(y), 3000); };
const DIR: Record<string, [number, number]> = { right: [1, 0], left: [-1, 0], front: [0, 1], back: [0, -1] };
type Kill = NonNullable<NonNullable<Villager['ai']>['assassin']>;

/** How many of our soldiers stand round the target: with AS.crowd or more he does not go in. */
const crowdAround = (sim: Sim, t: Villager): number => sim.villagers.filter((v) => v.id !== t.id && v.team === 'player' && v.health > 0 && v.job === 'fight' && v.inside === null && dist(v, t) <= AS.crowdRadius).length;

/** The target is dead (or lost): the job is done and he runs for home, then vanishes. */
const goHome = (f: Villager, a: Kill, sim: Sim): void => { endPass(f, a); a.state = 'flee'; a.fledAt ??= sim.time; };

/** A pass is over: his own speed again. */
function endPass(f: Villager, a: Kill): void {
  if (a.baseSpeed !== undefined) { f.speed = a.baseSpeed; a.baseSpeed = undefined; }
  a.dash = false;
}

/** A pass: he dashes in a straight line THROUGH the target and out the other side, cutting him as he goes. */
function startPass(sim: Sim, f: Villager, a: Kill, target: Villager, finish = false): void {
  const d = Math.max(0.1, dist(f, target)), ux = (target.x - f.x) / d, uy = (target.y - f.y) / d;
  const bx = target.x + ux * AS.passBeyond, by = target.y + uy * AS.passBeyond, spot = sim.nearestFree(Math.floor(bx), Math.floor(by), new Set()) ?? [Math.floor(bx), Math.floor(by)];
  a.state = 'pass'; a.passStart = sim.time; a.hitDone = false; a.dash = true; a.engaged = true;
  a.passTarget = finish ? target.id : undefined; // a finishing pass goes for a weak soldier of ours, not for the target he was sent to kill
  if (!finish) a.passes = (a.passes ?? 0) + 1;
  if (a.baseSpeed === undefined) { a.baseSpeed = f.speed; f.speed *= AS.passMul; }
  f.path = sim.pathTo(f, spot[0], spot[1], 3000);
}

/**
 * One tick of an assassin (a small state machine). STALK: unseen until a soldier, guard or tower is close; a long way round to the target's back; he keeps off a target with AS.crowd
 * soldiers about. PASS: a dash straight THROUGH the target, cutting him on the way (the first cut is deadly); if he stands, a second pass back. DUEL: still standing after two passes, he
 * stays and fights like any soldier (his combo). Only when the target is dead does he run for home and vanish.
 */
export function tickAssassin(sim: Sim, f: Villager, dt: number): void {
  const a = f.ai?.assassin;
  if (!a || !f.ai) return;
  // found: a soldier or a tower is close, or he has just struck (looked at twice a second)
  a.repath -= dt;
  if (a.repath <= 0) {
    a.repath = 0.5;
    const near = sim.villagers.some((v) => v.team === 'player' && v.health > 0 && v.job === 'fight' && v.inside === null && dist(v, f) <= AS.revealRadius)
      || sim.buildings.some((b) => b.kind === 'tower' && b.done && dist({ x: b.x + 1, y: b.y + 1 }, f) <= AS.towerRadius);
    if (near) a.revealedUntil = Math.max(a.revealedUntil, sim.time + AS.revealSeconds);
    a.hidden = sim.time >= a.revealedUntil;
  }
  if (a.shown || a.engaged) a.hidden = false; // the dev test is drawn so that it can be watched; once he has gone in he is seen
  const target = sim.get(a.target);
  const gone = !target || target.health <= 0;
  if ((a.state === 'stalk' || a.state === 'pass' || a.state === 'duel') && (gone || (a.state === 'stalk' && sim.time - a.born > AS.giveUpSeconds))) goHome(f, a, sim);

  if (a.state === 'stalk' && target) {
    const d = dist(f, target), crowd = crowdAround(sim, target) >= AS.crowd;
    if (crowd) { // too many soldiers about him: wait in the shadows, outside their sight, for them to go
      a.dash = false;
      if (d <= AS.lurkDist) f.path = []; else if (!f.path.length) walkTo(sim, f, target.x, target.y);
      return;
    }
    if (d <= AS.dashRange && sim.time >= (a.nextPass ?? 0)) { startPass(sim, f, a, target); return; }
    // the way round: a long loop to the point behind him first, then in
    const dir = DIR[target.facing] ?? DIR.right, back = d > 6 ? 4 : AS.backDist, bx = target.x - dir[0] * back, by = target.y - dir[1] * back;
    // a new way only when he has none or the point he aims at has moved on (and never by dropping the way he is on first: that made him stop and start again)
    const gx = d <= 2.2 ? target.x : bx, gy = d <= 2.2 ? target.y : by;
    if (!f.path.length || (sim.time - (a.pathAt ?? 0) > 0.5 && (!a.aim || Math.hypot(a.aim[0] - gx, a.aim[1] - gy) > 1.5))) {
      a.pathAt = sim.time; a.aim = [gx, gy];
      if (dist(f, { x: gx, y: gy }) > 0.8) { const p = sim.pathTo(f, Math.floor(gx), Math.floor(gy), 3000); if (p.length) f.path = p; }
    }
    a.dash = false;
  } else if (a.state === 'duel' && target) {
    if (sim.time >= (a.nextPass ?? 0)) { // a soldier of ours fighting him with almost no blood left: the next dash is the finishing blow
      a.nextPass = sim.time + 0.3;
      const weak = sim.villagers.find((v) => v.team === 'player' && v.health > 0 && v.maxHealth > 0 && v.health < v.maxHealth * AS.executeBelow && v.inside === null && dist(f, v) <= AS.executeRange
        && (v.id === a.target || v.fight.target?.id === f.id || dist(f, v) <= 2.5));
      if (weak) startPass(sim, f, a, weak, true);
    }
  } else if (a.state === 'pass' && target) {
    const vic = a.passTarget !== undefined ? sim.get(a.passTarget) ?? target : target, finish = a.passTarget !== undefined;
    if (!a.hitDone && dist(f, vic) <= 1.2) { // in the cut: the first one is deadly, the second a little less; a finishing one kills
      a.hitDone = true; a.revealedUntil = sim.time + AS.revealSeconds;
      const first = !finish && a.passes === 1;
      sim.hurt({ kind: 'unit', id: vic.id }, finish ? vic.maxHealth * 10 : vic.maxHealth * AS.strikeMult * (first ? 1 : AS.followMult), 'pierce', { x: f.x, y: f.y }, { unit: f });
      if (first) sim.say(vic.health > 0 ? `Có kẻ ám sát ${vic.name}! ${vic.name} còn sống.` : `${vic.name} đã bị ám sát.`);
    }
    if (!f.path.length || sim.time - (a.passStart ?? 0) > 2.5) { // through, and out the other side
      endPass(f, a); f.path = [];
      if (finish) { a.passTarget = undefined; a.state = 'duel'; a.nextPass = sim.time + 0.3; f.fight.target = { kind: 'unit', id: target.id }; }
      else if (target.health <= 0) goHome(f, a, sim);
      else if ((a.passes ?? 0) < AS.passes) { a.state = 'stalk'; a.nextPass = sim.time + AS.passPause; }
      else { a.state = 'duel'; f.fight.target = { kind: 'unit', id: target.id }; }
    }
  } else if (a.state === 'flee') {
    a.fledAt ??= sim.time;
    a.dash = false;
    if (a.vanishAt !== undefined) { // he is breaking into smoke: gone when the pose has played
      f.path = [];
      if (sim.time - a.vanishAt >= AS.vanishSeconds) {
        const t = sim.tribes.find((x) => x.id === f.team);
        if (t) t.unitIds = t.unitIds.filter((id) => id !== f.id);
        sim.removeFoe(f);
      }
      return;
    }
    if ((a.strikeUntil ?? 0) > sim.time) { f.path = []; return; } // the cut plays out before he runs
    walkTo(sim, f, f.ai.camp.x, f.ai.camp.y);
    if (dist(f, f.ai.camp) < 4 || sim.time - a.fledAt > AS.fleeSeconds) a.vanishAt = sim.time;
  }
}

/**
 * The assassin of ours, every tick: if an enemy who is fighting him has almost no blood left (below AS.executeBelow), and he is not carrying out an order of the player, he dashes through that
 * enemy and kills him (the same finishing pass as the enemy assassin's). The player's word stays highest: while a move is ordered he does not do it.
 */
export function tickFinisher(sim: Sim, v: Villager, dt: number): void {
  void dt;
  const x = v.exec;
  if (x) { // the dash is on
    const vic = sim.get(x.id);
    if (!x.hit && vic && vic.health > 0 && dist(v, vic) <= 1.2) { x.hit = true; sim.hurt({ kind: 'unit', id: vic.id }, vic.maxHealth * 10, 'pierce', { x: v.x, y: v.y }, { unit: v }); }
    if (!v.path.length || sim.time - x.t > 2 || v.health <= 0) { v.speed = x.base; v.exec = undefined; v.fight.obey = false; v.path = []; if (v.phase === 'move') v.phase = 'idle'; }
    return;
  }
  if (v.health <= 0 || v.down > 0 || v.inside !== null || v.job !== 'fight' || v.fight.obey || sim.time < (v.execAt ?? 0)) return;
  v.execAt = sim.time + 0.3;
  const vic = sim.foes.find((f) => f.health > 0 && f.maxHealth > 0 && f.health < f.maxHealth * AS.executeBelow && dist(v, f) <= AS.executeRange && (f.fight.target?.id === v.id || v.fight.target?.id === f.id));
  if (!vic) return;
  const d = Math.max(0.1, dist(v, vic)), ux = (vic.x - v.x) / d, uy = (vic.y - v.y) / d, bx = vic.x + ux * AS.passBeyond, by = vic.y + uy * AS.passBeyond;
  const spot = sim.nearestFree(Math.floor(bx), Math.floor(by), new Set()) ?? [Math.floor(bx), Math.floor(by)];
  v.swing = null; v.fight.target = null;
  v.exec = { id: vic.id, t: sim.time, hit: false, base: v.speed };
  v.speed *= AS.passMul; v.path = sim.pathTo(v, spot[0], spot[1], 3000); v.phase = 'move'; v.fight.obey = true;
}

/**
 * The dev test for the way an assassin moves: ONE assassin of ours (a soldier, ordered like any other: select him and send him; he jumps low fences and climbs high walls) and ONE enemy soldier of a
 * village that stands 9 tiles from him and fights whoever comes near. Returns the two, or why not.
 */
export function assassinPair(sim: Sim): { mine: Villager; foe: Villager } | string {
  // a village that is already willing to fight us; else one is made hostile for the test (dev only: its people then fight ours)
  const t = sim.tribes.find((x) => x.state === 'free' && sim.tribeWilling(x.id)) ?? sim.tribes.find((x) => x.state === 'free' && !x.boss && !x.bandit);
  const def = specialistDef('assassin');
  if (!t || !def) return 'Không có làng nào để lấy địch';
  if (!sim.tribeWilling(t.id)) t.relation = -100;
  if (sim.era !== 'ancient') sim.setEra('ancient'); // the high wall only exists in the medieval age: the test switches to it
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 5 : sim.world.start.y + 4;
  const a = sim.nearestFree(Math.floor(fx), Math.floor(fy), new Set()) ?? [Math.floor(fx), Math.floor(fy)];
  const mine = sim.makeVillager(a[0], a[1], 'm', 'player', sim.frnd);
  sim.villagers.push(mine); sim.registerUnit(mine);
  sim.setJob([mine.id], 'fight'); mine.arm = 'foot'; mine.spec = def.id; mine.rank = Math.max(4, Math.min(MAX_RANK, sim.fireLevel())); mine.manualGear = true;
  sim.giveGear([mine.id], def.weapon, 'weapon'); sim.giveGear([mine.id], def.armor, 'armor');
  applyStats(sim, mine); mine.health = mine.maxHealth;
  sim.orderHold([mine.id]); // comes out and holds his place: he waits for the player's word and fights only what is within his weapon's reach
  // two lines of fence across his way, 13 tiles long: a low one 2 tiles east (he jumps it) and a high wall (level 6; the test switches the game to the medieval age to build it) 4 tiles east (he climbs it)
  for (const [dx, level] of [[2, 1], [4, 6]] as Array<[number, number]>) {
    const lv = Math.min(level, maxLevel('fence', 'ancient'));
    for (let y = a[1] - 6; y <= a[1] + 6; y++) {
      const x = a[0] + dx;
      if (sim.world.isBlocked(x, y)) continue;
      try { const w = sim.addBuilding('fence', x, y, true); w.level = lv; w.hp = Math.max(w.hp, 1); } catch { /* the tile is not free */ }
    }
  }
  sim.wallCache = null;
  // the enemy: a foot soldier of rank 10 (his gear and his strength), standing still behind the wall; he fights whoever comes within reach
  const b = sim.nearestFree(a[0] + 6, a[1], new Set()) ?? [a[0] + 6, a[1]], r10 = rankDef('foot', MAX_RANK);
  const foe = sim.makeVillager(b[0], b[1], 'm', t.id, sim.frnd);
  foe.weapon = r10?.weapon ?? 'bronze_sword'; foe.armor = r10?.armor ?? 'bronze'; foe.arm = 'foot'; foe.rank = MAX_RANK;
  foe.ai = { role: 'raider', camp: t.camp, wander: 0, goal: null, raid: 0 };
  sim.addFoe(foe); t.unitIds.push(foe.id);
  for (const s of ['hp', 'atk'] as const) foe.fac[s] = rankStatMult(MAX_RANK, s) * branchStatMult('foot', s); // a foe is not graded by rank: give him the strength of the rank
  applyStats(sim, foe); foe.health = foe.maxHealth;
  foe.speed = 0; // stands where he is (and fights whoever comes within reach)
  sim.fogDirty = true;
  return { mine, foe };
}

/** The dev test: a hired killer shown in plain sight, a few tiles from a villager he is sent to kill. Returns the pair, or why not. */
export function assassinTest(sim: Sim): { f: Villager; target: Villager } | string {
  const t = sim.tribes.find((x) => x.state === 'free' && !x.boss && !x.bandit) ?? sim.tribes.find((x) => !x.bandit);
  if (!t) return 'Không có làng nào để gửi sát thủ';
  const target = pickTarget(sim);
  if (!target) return 'Không có dân nào để làm mục tiêu';
  const spot = sim.nearestFree(Math.floor(target.x) + 9, Math.floor(target.y), new Set()) ?? [Math.floor(target.x) + 9, Math.floor(target.y)];
  const f = sendAssassin(sim, t.id, target.id, { at: [spot[0], spot[1]], shown: true });
  return f ? { f, target } : 'Không gửi được sát thủ';
}
