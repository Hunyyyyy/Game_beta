/** The processing houses of the medieval age: each takes goods, has people work inside, and turns them into other goods (recipes: processdata.ts). */
import type { Building } from './buildings';
import { levelDef } from './buildings';
import { MAX_QUEUE, isProcessKind, processRecipe } from './processdata';
import { RES_NAME } from './resources';
import type { Res } from './resources';
import type { Sim } from './sim';
import type { Villager } from './model';

/** Why a recipe cannot be ordered at this house yet, or null. */
export function processLock(sim: Sim, b: Building, id: string): string | null {
  const r = processRecipe(b.kind, id);
  if (!r) return 'Công thức không tồn tại';
  if (!sim.dev.freeWorks && b.level < r.level) return `Cần nâng cấp nhà lên cấp ${r.level}`;
  return null;
}

/** Order one: the goods it takes are paid now (cancelling gives them back). Returns an error or null. */
export function queueProcess(sim: Sim, houseId: number, id: string): string | null {
  const b = sim.getBuilding(houseId);
  if (!b || !b.done || !isProcessKind(b.kind)) return 'Nhà chưa dựng xong';
  const lock = processLock(sim, b, id); if (lock) return lock;
  const r = processRecipe(b.kind, id)!, queue = (b.orders ??= []);
  if (queue.length >= MAX_QUEUE) return 'Hàng đợi đã đầy';
  if (!sim.dev.freeWorks) { const short = sim.missing(r.in); if (short) return short; sim.pay(r.in); }
  queue.push(id);
  return null;
}

/** Cancel a queued order: what it took comes back. */
export function unqueueProcess(sim: Sim, houseId: number, id: string): void {
  const b = sim.getBuilding(houseId), i = b?.orders?.lastIndexOf(id) ?? -1;
  if (!b || !b.orders || i < 0) return;
  const r = processRecipe(b.kind, id);
  if (r && !sim.dev.freeWorks) sim.pay(r.in, 1);
  b.orders.splice(i, 1);
}

/** Give back what the orders of a house took (it is taken down) and what the one at work took. */
export function refundProcess(sim: Sim, b: Building): void {
  if (!isProcessKind(b.kind) || sim.dev.freeWorks) return;
  for (const id of [...(b.active ? [b.active.id] : []), ...(b.orders ?? [])]) { const r = processRecipe(b.kind, id); if (r) sim.pay(r.in, 1); }
  b.orders = []; b.active = null;
}

/** Work inside the processing houses: whoever is at their bench moves the order on; what is made goes to the store of goods. */
export function tickProcessing(sim: Sim, dt: number): void {
  for (const b of sim.buildings) {
    if (!b.done || !isProcessKind(b.kind)) continue;
    const staff = b.staff.map((id) => sim.byId.get(id)).filter((v): v is Villager => !!v && v.phase === 'inside');
    if (!staff.length && !sim.dev.freeWorks) continue;
    if (!b.active) {
      const id = b.orders?.shift();
      if (!id) continue;
      b.active = { id, progress: 0 };
    }
    const r = processRecipe(b.kind, b.active.id);
    if (!r) { b.active = null; continue; }
    let rate = 0;
    for (const v of staff) { rate += sim.workFactor(v, 'craft'); sim.gainXp(v, 'craft', dt); }
    b.active.progress = sim.dev.fastWorks ? 1 : Math.min(1, b.active.progress + (dt * sim.paceWork * rate * levelDef(b).craftSpeed) / r.time);
    if (b.active.progress < 1) continue;
    const full = (Object.keys(r.out) as Res[]).find((k) => sim.stock[k] + (r.out[k] ?? 0) > sim.capacity(k));
    if (full) { if (sim.time - sim.lastFullWarn > 30) { sim.lastFullWarn = sim.time; sim.say(`Kho đã đầy ${RES_NAME[full].toLowerCase()}, sản phẩm chờ chỗ.`); } continue; }
    for (const k of Object.keys(r.out) as Res[]) sim.stock[k] += r.out[k] ?? 0;
    sim.say(`${b.kind === 'smelter' ? 'Lò luyện' : b.kind === 'carpentry' ? 'Xưởng mộc' : 'Xưởng thuộc da'} đã làm xong ${r.name.toLowerCase()}.`);
    b.active = null;
  }
}
