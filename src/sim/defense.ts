/** Defence works: fences and gates that stop people, and towers where archers keep watch. */
import { Building, BUILDINGS, buildingSight, levelDef, maxHp } from './buildings';
import { swingCycle } from './statsys';
import { effWeapon, fireProjectile, hurt, resolve, threatsOf, weaponOf } from './battle';
import { armOfWeapon, UNIT_RULES } from './formations';
import { statBonus } from './research';
import { roleOf } from './jobs';
import type { Sim } from './sim';
import type { Villager } from './model';

export const isWall = (b: Pick<Building, 'kind'>) => b.kind === 'fence' || b.kind === 'gate';
export const isDefense = (b: Pick<Building, 'kind'>) => isWall(b) || b.kind === 'tower';

/** Open or shut a gate. Shut, it stops everyone, our own people too; open, it is a gap that only the men standing in it hold. */
export function toggleGate(sim: Sim, id: number): string | null {
  const b = sim.getBuilding(id);
  if (!b || b.kind !== 'gate') return 'Đây không phải cổng';
  if (!b.done) return 'Cổng chưa dựng xong';
  b.open = !b.open;
  sim.setOcc(b, 1); // shut -> blocked, open -> free (setOcc knows)
  sim.say(b.open ? 'Cổng đã mở.' : 'Cổng đã đóng.');
  return null;
}

/** Every gate to the same state; true = open. */
export function setGates(sim: Sim, open: boolean): void {
  for (const b of sim.buildings) if (b.kind === 'gate' && b.done && b.open !== open) { b.open = open; sim.setOcc(b, 1); }
}

/** The nearest finished defence work to a point, within `radius` tiles (centre to centre). With `any`, any finished house but the fire counts: raiders with no wall in their way turn on what stands there. */
export function nearestWork(sim: Sim, x: number, y: number, radius: number, any = false): Building | undefined {
  let best: Building | undefined, bd = radius;
  for (const b of sim.buildings) {
    if (!b.done || !(any ? b.kind !== 'campfire' && b.kind !== 'trap' : isDefense(b))) continue;
    const d = BUILDINGS[b.kind], dist = Math.hypot(b.x + d.w / 2 - x, b.y + d.h / 2 - y);
    if (dist <= bd) { bd = dist; best = b; }
  }
  return best;
}

/** Wear a work down; at zero it falls and the way is open. */
export function damageWork(sim: Sim, b: Building, dmg: number): void {
  b.hp -= dmg;
  if (b.hp > 0) return;
  sim.say(`${BUILDINGS[b.kind].name} bị phá!`); sim.noteBattle('breach');
  sim.destroyBuilding(b);
}

/** What an archer gains from being up in a tower: harder shots and a longer reach. Everyone else gets nothing. */
export function towerBonus(sim: Sim, v: Villager): { damage: number; range: number } {
  const b = v.inside === null ? undefined : sim.getBuilding(v.inside);
  if (!b || b.kind !== 'tower' || armOfWeapon(effWeapon(v)) !== 'archer') return { damage: 1, range: 0 };
  return { damage: UNIT_RULES.archerOnTower.damage, range: 0 }; // the reach is the tower's own sight (tickTowers)
}

/** The soldiers posted to a tower, inside it or on their way. */
export function garrison(sim: Sim, b: Building): Villager[] { return sim.villagers.filter((v) => v.post === b.id && v.job === 'fight'); }

/**
 * Send free villagers up a tower, as many as it holds. They become its men, a kind of guard taken straight from the villagers (no camp is needed): they
 * go in and are listed there, and take the best of what the Kho vũ khí has that shoots. Returns an error or null.
 */
export function assignTower(sim: Sim, ids: readonly number[], towerId: number): string | null {
  const b = sim.getBuilding(towerId);
  if (!b || b.kind !== 'tower' || !b.done) return 'Chòi canh chưa dựng xong';
  const lock = sim.warLock(); if (lock) return lock;
  let err: string | null = null;
  for (const v of sim.mine(ids)) {
    if (v.post === b.id && v.job === 'fight') continue;
    if (v.job !== 'idle' || roleOf(v)) { err = 'Chỉ dân rảnh mới lên chòi: người có nghề hoặc là lính thì cho nghỉ trước'; continue; }
    if (garrison(sim, b).length >= levelDef(b).slots) { err = `${BUILDINGS.tower.name} cấp ${b.level} chỉ chứa ${levelDef(b).slots} lính`; continue; }
    sim.resetTask(v); sim.clearCombat(v);
    v.job = 'fight'; v.guard = true; v.guardAt = null; v.arm = 'archer'; v.post = b.id; v.shift = 'day'; // the men sleep in the tower by night and wake when an enemy comes in sight; the details can set a night or round-the-clock watch
    v.fight.mode = 'none'; v.fight.anchor = null;
    sim.planStaff(v);
  }
  return err;
}

/** Take the men of a tower down: they are free villagers again and their arms go back to the store. */
export function leaveTower(sim: Sim, ids: readonly number[]): void {
  for (const v of sim.mine(ids)) {
    if (v.post < 0 || v.job !== 'fight') continue;
    sim.exitBuilding(v);
    sim.assignGear([v.id], null, 'weapon'); sim.assignGear([v.id], null, 'armor');
    v.post = -1; v.guard = false; v.guardAt = null; v.job = 'idle'; v.arm = 'foot'; v.manualGear = false; v.shift = 'day'; v.phase = 'idle'; v.path = [];
  }
}

/** Once a second: the works of the defence (fence, gate, trap, tower) take on the strength their research gives (what is left of a damaged one keeps its share). */
export function tickResearch(sim: Sim): void {
  for (const b of sim.buildings) {
    if (b.kind !== 'fence' && b.kind !== 'gate' && b.kind !== 'trap' && b.kind !== 'tower') continue;
    const bonus = statBonus(sim.researched, b.kind, 'hp');
    if ((b.hpBonus ?? 0) === bonus) continue;
    const share = maxHp(b) > 0 ? b.hp / maxHp(b) : 1;
    b.hpBonus = bonus; b.hp = share * maxHp(b);
  }
}

/** A pit catches the first enemy to step on it: he is hurt, and the pit has one charge less. Our own people walk over it unharmed. */
export function tickTraps(sim: Sim, _dt: number): void {
  for (const b of [...sim.buildings]) {
    if (b.kind !== 'trap' || !b.done) continue;
    for (const f of sim.foes) {
      // b.staff remembers who has already fallen in: a man is wounded once by each pit, however long he stands in it
      if (f.health <= 0 || b.staff.includes(f.id) || Math.hypot(f.x - (b.x + 0.5), f.y - (b.y + 0.5)) > 0.8) continue;
      b.staff.push(f.id);
      hurt(sim, { kind: 'unit', id: f.id }, 14 * b.level * (1 + statBonus(sim.researched, 'trap', 'atk') / 100), 'pierce', { x: b.x, y: b.y }, {});
      sim.noteBattle('note', 'Một hố chông đã làm địch bị thương.');
      if (--b.hp <= 0) { b.staff = []; sim.destroyBuilding(b); break; }
    }
  }
}

/**
 * A tower shoots what its side can see within its own sight (10, 13 or 16 tiles by level): one arrow for each archer inside, every time that archer's
 * weapon is ready, and the damage, the hit and the rate of each arrow are those of the archer who looses it. The strength of the tower itself does
 * not depend on them.
 */
export function tickTowers(sim: Sim, _dt: number): void {
  for (const b of sim.buildings) {
    if (b.kind !== 'tower' || !b.done) continue;
    const d = BUILDINGS.tower, from = { x: b.x + d.w / 2, y: b.y + 0.4 }, reach = buildingSight(b), hit = 1 + statBonus(sim.researched, 'tower', 'atk') / 100; // the research of the tower makes every arrow loosed from it hit harder
    for (const v of sim.villagers) {
      if (v.inside !== b.id || v.phase !== 'inside' || v.atkCd > 0 || v.health <= 0) continue;
      const w = weaponOf(v);
      if (!w.ranged) continue;
      const bonus = towerBonus(sim, v), threat = threatsOf(sim, v, reach)[0], e = threat && resolve(sim, threat.t);
      if (e && fireProjectile(sim, v, e, from, bonus.damage * hit, Math.max(0, reach - w.range - 1))) v.atkCd = swingCycle(sim, v, w);
    }
  }
}
