/** Roles: the jobs that belong to a house. A role is given and taken back in its house (the Trại chiến binh, the Xưởng gỗ…), never at the campfire. */
import { buildingName, levelDef } from './buildings';
import { ROLES, roleName, roleOf } from './jobs';
import type { RoleId } from './jobs';
import type { Sim } from './sim';
import type { Villager } from './model';

/** While an attack is deployed (until it ends or is called off) roles stay as they are, so that nobody is taken out of the army or put into it. Returns why, or null. */
export const warLock = (sim: Sim): string | null => (sim.plans.some((p) => p.kind === 'attack' && p.status === 'running') ? 'Đang trong chế độ chiến đấu: không đổi vai trò hay bỏ lính được cho tới khi trận kết thúc' : null);

/** The finished houses of a role. There is one of each; raising its level makes room for more people. */
export const roleHouses = (sim: Sim, role: RoleId) => sim.buildings.filter((b) => b.kind === ROLES[role].building && b.done);

/** How many people the role may have: the places of its house at its level (with no house at all, anyone in the dev menu). */
export const roleCapacity = (sim: Sim, role: RoleId): number => { const houses = roleHouses(sim, role); return houses.length ? houses.reduce((n, b) => n + levelDef(b).slots, 0) : sim.dev.freeBuild ? 99 : 0; };

export const roleCount = (sim: Sim, role: RoleId): number => sim.villagers.filter((v) => roleOf(v) === role).length;

/** Give a role to villagers, as many as its house has room for. Soldiers and scouts must be released first. Returns an error or null. */
export function assignRole(sim: Sim, ids: readonly number[], role: RoleId): string | null {
  const lock = warLock(sim); if (lock) return lock;
  const def = ROLES[role], name = buildingName(def.building, sim.era);
  if (!sim.dev.freeBuild && !roleHouses(sim, role).length) return `Cần dựng ${name}`;
  if (role === 'scout') return sim.enlistScouts(ids); // scouts come from the cavalry, not from the villagers
  if (role === 'guard') return enlistGuards(sim, ids); // guards come from the soldiers of the camps
  const pick = sim.mine(ids).filter((v) => v.job !== 'fight' && v.job !== 'scout' && roleOf(v) !== role);
  if (!pick.length) return `Chọn dân thường để giao việc ${roleName(role, sim.era).toLowerCase()}`;
  const room = roleCapacity(sim, role) - roleCount(sim, role);
  if (room <= 0) return `${name} đã đủ ${roleCapacity(sim, role)} người: nâng cấp để chứa thêm`;
  const take = pick.slice(0, room).map((v) => v.id);
  const err = sim.setJob(take, def.job === 'fight' ? 'fight' : def.job);
  if (def.arm) for (const v of sim.mine(take)) if (v.job === 'fight') v.arm = def.arm;
  return err ?? (pick.length > room ? `${name} chỉ còn chỗ cho ${room} người` : null);
}

/** Soldiers of the camps who may be sent to stand guard: they have a role of the army and are not guards yet. */
export const guardCandidates = (sim: Sim): Villager[] => sim.villagers.filter((v) => v.team === 'player' && v.job === 'fight' && !v.guard && v.down <= 0);

/** Where the next guard of the Trại lính gác stands at first: a free tile in front of the house. The player moves him by giving him an order. */
function postFor(sim: Sim, house: { x: number; y: number }): { x: number; y: number } {
  const taken = new Set(sim.villagers.filter((o) => o.guardAt).map((o) => Math.floor(o.guardAt!.y) * sim.world.size + Math.floor(o.guardAt!.x)));
  const spot = sim.nearestFree(house.x + 1, house.y + 4, taken) ?? [house.x + 1, house.y + 4];
  return { x: spot[0] + 0.5, y: spot[1] + 0.5 };
}

/** Send soldiers of the camps to the Trại lính gác: they leave their squad, keep their arm and gear, and stand at a post of their own. Returns an error or null. */
function enlistGuards(sim: Sim, ids: readonly number[]): string | null {
  const pick = sim.mine(ids).filter((v) => v.job === 'fight' && !v.guard);
  if (!pick.length) return 'Chọn lính của các trại để cử đi gác';
  const room = roleCapacity(sim, 'guard') - roleCount(sim, 'guard');
  if (room <= 0) return `${buildingName('guardpost', sim.era)} đã đủ ${roleCapacity(sim, 'guard')} người: nâng cấp để chứa thêm`;
  const house = roleHouses(sim, 'guard')[0] ?? sim.campfire();
  for (const v of pick.slice(0, room)) {
    sim.leaveSquad([v.id]);
    sim.resetTask(v); sim.clearCombat(v);
    v.job = 'fight'; v.guard = true; v.post = -1;
    v.guardAt = house ? postFor(sim, house) : { x: v.x, y: v.y };
    v.fight.mode = 'guard'; v.fight.anchor = v.guardAt;
  }
  return pick.length > room ? `${buildingName('guardpost', sim.era)} chỉ còn chỗ cho ${room} người` : null;
}

/** Take the role away: scouts and soldiers are let go (soldiers hand their gear back), gatherers become plain villagers. Returns an error or null. */
export function releaseRole(sim: Sim, ids: readonly number[]): string | null {
  const lock = warLock(sim); if (lock) return lock;
  const mine = sim.mine(ids);
  let n = 0, err: string | null = null;
  for (const v of mine) {
    const role = roleOf(v);
    if (!role) continue;
    const e = role === 'scout' ? sim.dismissScouts([v.id]) : ROLES[role].job === 'fight' ? (sim.discharge([v.id]) ? null : `${v.name} đang ngủ say, chưa cho nghỉ được`) : sim.setJob([v.id], 'idle');
    if (e) err = e; else n++;
  }
  return n ? null : err ?? 'Chọn người có việc để cho nghỉ';
}

/** After a house is gone: those over its places lose the role, the newest first. */
export function trimRoles(sim: Sim): void {
  for (const role of Object.keys(ROLES) as RoleId[]) {
    const over = roleCount(sim, role) - roleCapacity(sim, role);
    if (over <= 0) continue;
    const who = sim.villagers.filter((v): v is Villager => roleOf(v) === role).sort((a, b) => b.id - a.id).slice(0, over);
    releaseRole(sim, who.map((v) => v.id));
  }
}
