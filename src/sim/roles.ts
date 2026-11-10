/** Roles: the jobs that belong to a house. A role is given and taken back in its house (the Trại lính bộ, the Xưởng gỗ…), never at the campfire. */
import { buildingName, levelDef } from './buildings';
import { DIFF } from './difficulty';
import { ROLES, roleName, roleOf } from './jobs';
import type { RoleId } from './jobs';
import type { Sim } from './sim';
import type { Villager } from './model';
import { perkPct } from './research';

/** While an attack is deployed (until it ends or is called off) roles stay as they are, so that nobody is taken out of the army or put into it. Returns why, or null. */
export const warLock = (sim: Sim): string | null => (sim.plans.some((p) => p.kind === 'attack' && p.status === 'running') ? 'Đang trong chế độ chiến đấu: không đổi vai trò hay bỏ lính được cho tới khi trận kết thúc' : null);

/** The finished houses of a role. There is one of each; raising its level makes room for more people. */
export const roleHouses = (sim: Sim, role: RoleId) => sim.buildings.filter((b) => b.kind === ROLES[role].building && b.done);

/** The trades of the first days that one villager may do before their house stands: gathering and hunting. Everything else needs its house. */
const NO_HOUSE_TRADES: readonly RoleId[] = ['wood', 'stone', 'food', 'hunt'];
/** How many do such a trade with no house yet. Once the house is built they simply count in its list (the places are its own). */
export const NO_HOUSE_CAP = 1;

/** How many people the role may have: the places of its house at its level; with no house one villager for a gathering trade (anyone in the dev menu). */
/** The camps of soldiers: their places grow with the villages we take. */
const CAMP_ROLES: readonly RoleId[] = ['foot', 'archer', 'cavalry'];
const ARMS: readonly RoleId[] = ['foot', 'archer', 'cavalry', 'guard'];
export const roleCapacity = (sim: Sim, role: RoleId): number => {
  const houses = roleHouses(sim, role);
  const camp = CAMP_ROLES.includes(role) ? sim.campBonus : 0; // a village we took adds places to every camp of soldiers
  const wider = ARMS.includes(role) ? Math.round(perkPct(sim.researched, `camp_${role}`)) : 0; // the research of the medieval age that widens the camp of an arm
  return houses.length ? houses.reduce((n, b) => n + levelDef(b).slots + camp, 0) + wider : sim.dev.freeBuild ? 99 : NO_HOUSE_TRADES.includes(role) ? NO_HOUSE_CAP : 0;
};

export const roleCount = (sim: Sim, role: RoleId): number => sim.villagers.filter((v) => roleOf(v) === role).length;

/** Soldiers (the camps, the guards, the towers) are men: a woman of the village works but does not fight. */
export const canSoldier = (v: Pick<Villager, 'look'>): boolean => v.look.sex === 'm';

/** Give a role to villagers, as many as its house has room for. Soldiers and scouts must be released first. Returns an error or null. */
export function assignRole(sim: Sim, ids: readonly number[], role: RoleId): string | null {
  const lock = warLock(sim); if (lock) return lock;
  const def = ROLES[role], name = buildingName(def.building, sim.era);
  if (!sim.dev.freeBuild && !roleHouses(sim, role).length && !NO_HOUSE_TRADES.includes(role)) return `Cần dựng ${name}`;
  if (role === 'scout') return sim.enlistScouts(ids); // scouts come from the cavalry, not from the villagers
  const others = sim.mine(ids).filter((v) => roleOf(v) !== role);
  const pick = def.job === 'fight' ? others.filter(canSoldier) : others; // the soldiers are men
  if (!pick.length) return others.length ? 'Chỉ người nam mới làm lính' : `Chọn người chưa làm việc ${roleName(role, sim.era).toLowerCase()}`;
  const room = roleCapacity(sim, role) - roleCount(sim, role);
  if (room <= 0) return roleHouses(sim, role).length ? `${name} đã đủ ${roleCapacity(sim, role)} người: nâng cấp để chứa thêm` : `Chưa có ${name.toLowerCase()}: chỉ ${NO_HOUSE_CAP} người làm nghề này, hãy dựng nhà để thêm người`;
  const chosen = pick.slice(0, room);
  for (const v of chosen) if (v.job === 'fight' || v.job === 'scout' || v.job === 'supply') { const e = releaseRole(sim, [v.id]); if (e) return e; } // from another camp or the scouts: let go first, his gear goes back to the store
  const take = chosen.map((v) => v.id);
  const err = sim.setJob(take, def.job === 'fight' ? 'fight' : def.job);
  if (def.arm) for (const v of sim.mine(take)) if (v.job === 'fight') v.arm = def.arm;
  if (role === 'guard') for (const v of sim.mine(take)) if (v.job === 'fight') postGuard(sim, v); // a guard is taken from the free villagers like any other trade, never from the soldiers of the camps
  return err ?? (pick.length > room ? `${name} chỉ còn chỗ cho ${room} người` : null);
}

/** Where the next guard of the Trại lính gác stands at first: a free tile in front of the house. The player moves him by giving him an order. */
function postFor(sim: Sim, house: { x: number; y: number }): { x: number; y: number } {
  const taken = new Set(sim.villagers.filter((o) => o.guardAt).map((o) => Math.floor(o.guardAt!.y) * sim.world.size + Math.floor(o.guardAt!.x)));
  const spot = sim.nearestFree(house.x + 1, house.y + 4, taken) ?? [house.x + 1, house.y + 4];
  return { x: spot[0] + 0.5, y: spot[1] + 0.5 };
}

/** Make a soldier a guard: he stands at a post of his own and never goes with a squad. */
function postGuard(sim: Sim, v: Villager): void {
  const house = roleHouses(sim, 'guard')[0] ?? sim.campfire();
  v.guard = true; v.post = -1;
  v.guardAt = house ? postFor(sim, house) : { x: v.x, y: v.y };
  v.fight.mode = 'guard'; v.fight.anchor = v.guardAt;
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
    if (!e && ROLES[role].job === 'fight' && !v.guard) { v.rank = 1; if (role === 'cavalry') v.mount = null; } // a soldier let go starts again from the first rank; his beast goes with him (the price was paid at the camp)
    if (!e && role === 'hunt') { sim.assignGear([v.id], null, 'weapon'); sim.assignGear([v.id], null, 'armor'); v.manualGear = false; } // a hunter let go hands his weapon and armour back
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
