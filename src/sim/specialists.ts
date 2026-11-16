/**
 * The two specialists of the story (data/specialists.json): the bodyguard, a guard of rank 7 or more who keeps one villager and takes the blows meant for him, and the assassin, a hidden foe sent by
 * a village to kill one villager. Both are ordinary units (Villager, with `wardOf` and `ai.assassin`): this file only gives them their rules. It knows the rest of the game through `sim`.
 */
import type { Sim } from './sim';
import type { Villager } from './model';
import { applyStats } from './statsys';
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
export function sendAssassin(sim: Sim, tribeId: string, targetId?: number): Villager | null {
  const t = sim.tribes.find((x) => x.id === tribeId);
  const target = targetId !== undefined ? sim.get(targetId) : pickTarget(sim);
  if (!t || !target || target.team !== 'player') return null;
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  const dx = t.camp.x - fx, dy = t.camp.y - fy, len = Math.max(1, Math.hypot(dx, dy)), d = Math.min(AS.spawnDist, len);
  const gx = Math.floor(fx + (dx / len) * d), gy = Math.floor(fy + (dy / len) * d), spot = sim.nearestFree(gx, gy, new Set()) ?? [gx, gy];
  const f = sim.makeVillager(spot[0], spot[1], 'm', t.id, sim.frnd);
  f.look.hide = '#2a2a30'; f.look.pants = '#1c1c22';
  f.weapon = AS.weapon; f.armor = null; f.speed *= AS.speedMul;
  f.ai = { role: 'raider', camp: t.camp, wander: 0, goal: null, raid: 0, assassin: { target: target.id, state: 'stalk', hidden: true, revealedUntil: 0, repath: 0, born: sim.time } };
  sim.addFoe(f); t.unitIds.push(f.id);
  applyStats(sim, f); f.health = f.maxHealth;
  return f;
}

const walkTo = (sim: Sim, u: Villager, x: number, y: number): void => { if (dist(u, { x, y }) > 1.2 && !u.path.length) u.path = sim.pathTo(u, Math.floor(x), Math.floor(y), 3000); };

/** One tick of an assassin: he stalks his target unseen, strikes when he is at arm's length, and runs for home. */
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
  const target = sim.get(a.target);
  if (a.state === 'stalk' && (!target || target.health <= 0)) a.state = 'flee';
  if (a.state === 'stalk' && target) {
    if (dist(f, target) <= 1.3) {
      const dmg = target.maxHealth * AS.strikeMult;
      sim.hurt({ kind: 'unit', id: target.id }, dmg, 'pierce', { x: f.x, y: f.y }, { unit: f });
      a.revealedUntil = sim.time + AS.revealSeconds; a.hidden = false; a.state = 'flee'; a.fledAt = sim.time; f.path = [];
      sim.say(target.health > 0 ? `Có kẻ ám sát ${target.name}! ${target.name} còn sống.` : `${target.name} đã bị ám sát.`);
    } else {
      if (f.path.length === 0 || sim.time - (a.pathAt ?? 0) > 2) { a.pathAt = sim.time; f.path = []; }
      walkTo(sim, f, target.x, target.y);
    }
  }
  if (a.state === 'flee') {
    a.fledAt ??= sim.time;
    walkTo(sim, f, f.ai.camp.x, f.ai.camp.y);
    if (dist(f, f.ai.camp) < 4 || sim.time - a.fledAt > AS.fleeSeconds) {
      const t = sim.tribes.find((x) => x.id === f.team);
      if (t) t.unitIds = t.unitIds.filter((id) => id !== f.id);
      sim.removeFoe(f);
    }
  }
}
