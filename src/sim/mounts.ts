/**
 * Mounts. Keepers working in the Chuồng thú tame beasts (a wolf, a boar, an elephant: the level of the stable decides which, and each needs its own research)
 * and the beast goes to the stock, from where it is given to a villager like a tool. A rider walks faster and takes less of a blow; a soldier with a beast counts as
 * cavalry. The soldiers of the Trại kỵ thú need no beast from the stock: they ride the one that goes with the level of their camp.
 */
import { PACE } from './constants';
import { levelDef } from './buildings';
import { MOUNT_KINDS, MOUNTS, MountKind } from './jobs';
import { RESEARCH } from './research';
import type { Sim } from './sim';
import type { Villager } from './model';

const stockKey = (k: MountKind): string => `mount_${k}`;
/** Tamed beasts waiting in the stable. */
export const tamedCount = (sim: Sim, k: MountKind): number => sim.toolStock[stockKey(k)] ?? 0;
/** Most tamed beasts the stables can hold unridden. */
const STOCK_CAP = 12;

/** Why a kind of beast cannot be tamed yet (research, or the stable is too low), or null. */
export function tameLock(sim: Sim, k: MountKind): string | null {
  const d = MOUNTS[k], stable = sim.building('stable');
  if (!stable) return 'Cần dựng Chuồng thú cưỡi';
  if (RESEARCH.enabled && !sim.dev.freeBuild && !sim.researched.has(d.tech)) return `Cần nghiên cứu: Thuần hóa ${d.name.toLowerCase()}`;
  if (stable.level < d.tier) return `Cần Chuồng thú cưỡi cấp ${d.tier}`;
  return null;
}

/** Put an order to tame a beast in the queue of the stable. */
export function queueTame(sim: Sim, k: MountKind): string | null {
  if (!MOUNTS[k]) return 'Không có loài này';
  const lock = tameLock(sim, k);
  if (lock) return lock;
  if (sim.tameQueue.length >= 12) return 'Hàng đợi đã đầy';
  sim.tameQueue.push(k);
  return null;
}

export function unqueueTame(sim: Sim, k: MountKind): void { const i = sim.tameQueue.lastIndexOf(k); if (i >= 0) sim.tameQueue.splice(i, 1); }

/** The work of the stable: the keepers inside get through one order at a time, paid for when it starts. */
export function tickTame(sim: Sim, dt: number): void {
  for (const b of sim.buildings) {
    if (b.kind !== 'stable' || !b.done) continue;
    const staff = b.staff.map((id) => sim.byId.get(id)).filter((v): v is Villager => !!v);
    if (!staff.length) continue;
    if (!b.active) {
      const i = sim.tameQueue.findIndex((k) => !tameLock(sim, k as MountKind) && sim.affordable(MOUNTS[k as MountKind].cost));
      if (i < 0) { if (sim.tameQueue.length && sim.time - sim.lastMatWarn > 30) { sim.lastMatWarn = sim.time; sim.say('Đơn thuần thú đang chờ: thiếu nguyên liệu.'); } continue; }
      const k = sim.tameQueue.splice(i, 1)[0] as MountKind;
      sim.pay(MOUNTS[k].cost);
      b.active = { id: k, progress: 0 };
    }
    const k = b.active.id as MountKind, d = MOUNTS[k];
    if (!d) { b.active = null; continue; }
    let rate = 0;
    for (const v of staff) { rate += sim.workFactor(v, 'tame'); sim.gainXp(v, 'tame', dt); }
    b.active.progress = Math.min(1, b.active.progress + (dt * PACE.work * rate * levelDef(b).craftSpeed * (sim.dev.fastWorks ? 25 : 1)) / d.time);
    if (b.active.progress < 1) continue;
    if (MOUNT_KINDS.reduce((n, m) => n + tamedCount(sim, m), 0) >= STOCK_CAP) { if (sim.time - sim.lastFullWarn > 30) { sim.lastFullWarn = sim.time; sim.say('Chuồng đã đầy thú chưa có người cưỡi: sản phẩm chờ chỗ.'); } continue; }
    sim.toolStock[stockKey(k)] = tamedCount(sim, k) + 1; b.active = null;
    sim.say(`Đã thuần xong một con ${d.name.toLowerCase()}.`);
  }
}

/** The beast of a camp: the level of the Trại kỵ thú decides it (a wolf, then a boar, then an elephant). */
function campBeast(sim: Sim): MountKind {
  const camp = sim.building('cavalry');
  return MOUNT_KINDS[Math.max(0, Math.min(MOUNT_KINDS.length, camp?.level ?? 1) - 1)];
}

/** The beast a villager is riding now: the one he was given, or, for a rider of the Trại kỵ thú, the beast of the camp. */
export function mountOf(sim: Sim, v: Villager): MountKind | null {
  if (v.team !== 'player') return null;
  return v.mount ?? (v.job === 'fight' && v.arm === 'cavalry' ? campBeast(sim) : null);
}
/** How much faster a rider walks (1 on foot). */
export const mountSpeed = (sim: Sim, v: Villager): number => { const k = mountOf(sim, v); return k ? MOUNTS[k].speed : 1; };
/** What share of a blow a rider takes (1 on foot). */
export const mountGuard = (sim: Sim, v: Villager): number => { const k = mountOf(sim, v); return k ? MOUNTS[k].guard : 1; };

/** Give a beast from the stable to villagers, or take it back (`null`). Returns an error or null. */
export function assignMount(sim: Sim, ids: readonly number[], kind: MountKind | null): string | null {
  let given = 0, short = false, riders = false;
  for (const v of sim.mine(ids)) {
    if (v.mount === kind) continue;
    if (kind && v.job === 'fight' && v.arm === 'cavalry') { riders = true; continue; } // the riders of the camp have their beast already
    if (kind && tamedCount(sim, kind) <= 0) { short = true; continue; }
    if (v.mount) sim.toolStock[stockKey(v.mount)] = tamedCount(sim, v.mount) + 1;
    if (kind) sim.toolStock[stockKey(kind)]--;
    v.mount = kind; given++;
    if (kind) { v.speed = 1.6 + 0.1 * v.stats.agi; sim.say(`${v.name} được giao một con ${MOUNTS[kind].name.toLowerCase()} để cưỡi.`); } else sim.say(`${v.name} trả thú về chuồng.`);
  }
  if (given) return null;
  return riders ? 'Kỵ binh của Trại kỵ thú đã có thú của trại' : short ? `Chuồng hết ${kind ? MOUNTS[kind].name.toLowerCase() : 'thú'} đã thuần: hãy thuần thêm` : null;
}
