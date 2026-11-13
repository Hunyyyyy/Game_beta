/** What the houses are working on: the research and crafting queues and the progress they make. */
import { BuildingKind, levelDef } from './buildings';
import { WorkJob } from './jobs';
import { Stock } from './resources';
import { isGear, RECIPE_BY_ID, recipeName } from './tools';
import { CRAFT_COST_PER_LEVEL, discountBill, perkPct, recipeNeedLevel, missingOf, reached, RESEARCH, Tech, TECH_BY_ID } from './research';
import type { Sim } from './sim';
import { Villager } from './model';

// ---------------------------------------------------------------- chế tác
// ---------------------------------------------------------------- research and crafting
/** Cost and time of an order in one of the two queues. */
export function orderDef(sim: Sim, kind: 'research' | 'craft', id: string): { cost: Partial<Stock>; time: number } | null {
  if (kind === 'research') { const t = TECH_BY_ID[id]; return t ? { cost: researchCost(sim, t), time: t.time } : null; }
  const r = RECIPE_BY_ID[id]; if (!r) return null;
  return { cost: r.cost, time: r.time };
}

/** What a research costs now: its own cost, cut by the research of the Nhà nghiên cứu (Nghiên cứu rẻ hơn). */
export const researchCost = (sim: Sim, t: Tech): Partial<Stock> => discountBill(t.cost, perkPct(sim.researched, 'researchCost'));
/** Level of a finished building of a kind (0 when there is none). */
export function levelOfKind(sim: Sim, kind: BuildingKind): number { return sim.building(kind)?.level ?? 0; }

export function workshopLevel(sim: Sim): number { return levelOfKind(sim, 'workshop'); }

/** What the materials of a craft cost now, as a multiple of the base cost: half as much again for each level of the Nhà chế tạo above the first. */
export const craftMult = (sim: Sim): number => (1 + CRAFT_COST_PER_LEVEL * Math.max(0, workshopLevel(sim) - 1)) * (1 - Math.min(50, perkPct(sim.researched, 'craftCost')) / 100); // and cut by the research of the craftsmen (Chế tạo rẻ hơn)
/** A cost made m times as big (every good at least 1, rounded up). */
export const scaleCost = (cost: Partial<Stock>, m: number): Partial<Stock> => Object.fromEntries(Object.entries(cost).map(([r, n]) => [r, Math.max(1, Math.ceil((n as number) * m - 1e-9))])) as Partial<Stock>;
/** What ordering one of this recipe costs at the Nhà chế tạo as it stands. */
export const craftCost = (sim: Sim, id: string): Partial<Stock> => scaleCost(RECIPE_BY_ID[id].cost, craftMult(sim));

/** Why a recipe cannot be made yet (the level of the crafting house), or null. */
export function recipeLock(sim: Sim, id: string): string | null {
  if (!RESEARCH.enabled || sim.dev.freeWorks) return null; // dev: no house level needed
  const need = recipeNeedLevel(id);
  if (workshopLevel(sim) < need) return `Cần Nhà chế tạo cấp ${need}`;
  return null;
}

export function recipeOpen(sim: Sim, id: string): boolean { return recipeLock(sim, id) === null; }

/** What a research still waits for: the researches before it, and (a leap of the pillars) most of the stat levels of its row. */
function lacksOf(sim: Sim, t: Tech): string[] {
  const lacks = missingOf(sim.researched, t).map((n) => `Cần nghiên cứu: ${n}`);
  if (t.needCount) { const got = t.needCount.ids.filter((r) => reached(sim.researched, r)).length; if (got < t.needCount.count) lacks.push(`Cần ${t.needCount.count} cấp chỉ số của hàng này (đã có ${got})`); }
  return lacks;
}

/** Where a research stands: done, being worked on, queued, ready to start or locked (with the reason). */
export function techState(sim: Sim, t: Tech): { state: 'done' | 'active' | 'queued' | 'ready' | 'locked'; why?: string; lacks?: string[] } {
  if (t.milestone) return reached(sim.researched, t.id) ? { state: 'done' } : { state: 'locked', why: 'Đang thiết kế: chưa có tác dụng', lacks: lacksOf(sim, t) };
  if (sim.researched.has(t.id)) return { state: 'done' };
  if (sim.building('lab')?.active?.id === t.id) return { state: 'active' };
  if (sim.researchQueue.includes(t.id)) return { state: 'queued' };
  // every condition that is not met yet, not only the first
  const free = sim.dev.freeWorks; // dev: no steps before it and no level of the house needed
  const lacks = free ? [] : lacksOf(sim, t);
  const lab = sim.building('lab');
  if (!lab) lacks.push('Cần dựng Nhà nghiên cứu');
  else if (!free && lab.level < t.needLevel) lacks.push(`Cần Nhà nghiên cứu cấp ${t.needLevel}`);
  if (lacks.length) return { state: 'locked', why: lacks.join(' · '), lacks };
  return { state: 'ready' };
}

/** Whether a queued research could start now: someone works inside. Null when it can, else the reason. */
export function researchBlock(sim: Sim, t: Tech): string | null {
  const lab = sim.building('lab');
  if (!lab || (!lab.staff.length && !sim.dev.freeWorks)) return 'Chưa có người làm việc trong Nhà nghiên cứu';
  return null;
}

/** The research under way or waiting to start. Only one at a time: the next waits until it is done. */
export function currentResearch(sim: Sim): string | null { return sim.building('lab')?.active?.id ?? sim.researchQueue[0] ?? null; }

/** Queue a research; materials and coins are paid when it starts. */
export function queueResearch(sim: Sim, id: string): string | null {
  const t = TECH_BY_ID[id];
  if (!t) return 'Không có nghiên cứu này';
  if (!RESEARCH.enabled) return 'Nghiên cứu đang tắt';
  const st = techState(sim, t);
  if (st.state === 'done') return 'Đã nghiên cứu rồi';
  if (st.state === 'active' || st.state === 'queued') return 'Đang nghiên cứu';
  const cur = currentResearch(sim);
  if (cur) return `Đang nghiên cứu ${TECH_BY_ID[cur]?.name ?? cur}: xong rồi mới nghiên cứu tiếp`;
  if (st.state === 'locked') return st.why ?? 'Chưa nghiên cứu được';
  const short = researchShort(sim, t);
  if (short) return short;
  if (!sim.dev.freeWorks) sim.pay(researchCost(sim, t));
  sim.researchQueue.push(id);
  return null;
}

/** Why the materials and coins for a research are not there, or null. They are paid when the research is queued. */
export function researchShort(sim: Sim, t: Tech): string | null { return sim.dev.freeWorks ? null : sim.missing(researchCost(sim, t)); }

/** Throw goods out of a store to make room: one (the most worn first), or every one of that kind. Returns an error or null. */
export function discardGoods(sim: Sim, id: string, all: boolean): string | null {
  const n = sim.toolStock[id] ?? 0, worn = sim.wornTools.filter((w) => w.id === id);
  if (n <= 0 && !worn.length) return 'Kho không có món này';
  if (all) {
    sim.toolStock[id] = 0;
    for (let i = sim.wornTools.length - 1; i >= 0; i--) if (sim.wornTools[i].id === id) sim.wornTools.splice(i, 1);
  } else if (worn.length) {
    worn.sort((a, b) => a.dur - b.dur);
    sim.wornTools.splice(sim.wornTools.indexOf(worn[0]), 1);
  } else sim.toolStock[id] = n - 1;
  return null;
}

/** Which store a recipe's product goes to. */
const catOf = (id: string): 'tool' | 'gear' => (isGear(RECIPE_BY_ID[id].kind) ? 'gear' : 'tool');

/** Room left in a store after what is already waiting to be made for it (the queue and the order under way). */
export function storeRoom(sim: Sim, cat: 'tool' | 'gear'): number {
  const bench = sim.building('workshop')?.active, coming = sim.craftQueue.filter((id) => RECIPE_BY_ID[id] && catOf(id) === cat).length + (bench && RECIPE_BY_ID[bench.id] && catOf(bench.id) === cat ? 1 : 0);
  return storeCap(sim, cat) - storeUsed(sim, cat) - coming;
}

/** Why a recipe cannot be ordered because its store is full, or null. */
export function craftStoreBlock(sim: Sim, id: string): string | null {
  const r = RECIPE_BY_ID[id];
  if (!r) return null;
  const cat = catOf(id);
  return storeRoom(sim, cat) > 0 ? null : cat === 'tool' ? 'Kho công cụ đã đầy: nâng cấp kho hoặc dùng bớt đồ' : 'Kho vũ khí đã đầy: nâng cấp kho hoặc dùng bớt đồ';
}

/** How many orders the Nhà chế tạo takes in its queue: 12, and what the research of the craftsmen adds. */
export const craftQueueMax = (sim: Sim): number => 12 + perkPct(sim.researched, 'craftQueue');

/** Queue a tool, weapon or armour for the Nhà chế tạo. The materials are paid now, as the order is put in the queue; cancelling it gives them back. */
export function queueCraft(sim: Sim, id: string): string | null {
  const r = RECIPE_BY_ID[id];
  if (!r) return 'Công thức không tồn tại';
  if (!sim.hasWorkshop()) return 'Cần dựng Nhà chế tạo trước';
  const lock = recipeLock(sim, id);
  if (lock) return lock;
  const full = craftStoreBlock(sim, id);
  if (full) return full;
  if (sim.craftQueue.length >= craftQueueMax(sim)) return 'Hàng đợi đã đầy';
  const mult = craftMult(sim);
  if (!sim.dev.freeWorks) {
    const cost = scaleCost(r.cost, mult), short = sim.missing(cost);
    if (short) return short;
    sim.pay(cost);
  }
  sim.craftQueue.push(id); sim.craftPaid.push(mult);
  return null;
}

export function unqueue(sim: Sim, queue: string[], id: string): void { const i = queue.lastIndexOf(id); if (i >= 0) queue.splice(i, 1); }

/** Cancel a queued order; what was paid for it comes back. */
export function unqueueCraft(sim: Sim, id: string): void {
  const r = RECIPE_BY_ID[id], i = sim.craftQueue.lastIndexOf(id);
  if (!r || i < 0) return;
  if (!sim.dev.freeWorks) sim.pay(scaleCost(r.cost, sim.craftPaid[i] ?? 1), 1);
  sim.craftQueue.splice(i, 1); sim.craftPaid.splice(i, 1);
}

/** Cancel a queued research; what was paid comes back. */
export function unqueueResearch(sim: Sim, id: string): void {
  const t = TECH_BY_ID[id];
  if (t && sim.researchQueue.includes(id) && !sim.dev.freeWorks) sim.pay(researchCost(sim, t), 1);
  unqueue(sim, sim.researchQueue, id);
}

/** How many tools or pieces of gear a store holds: the Kho công cụ for tools, the Kho vũ khí for weapons and armour. */
export function storeUsed(sim: Sim, cat: 'tool' | 'gear'): number { return (cat === 'tool' ? sim.wornTools.length : 0) + Object.entries(sim.toolStock).reduce((n, [id, c]) => n + ((RECIPE_BY_ID[id] && isGear(RECIPE_BY_ID[id].kind)) === (cat === 'gear') ? c : 0), 0); }

/** Room for items: the matching store when it stands, otherwise the crafting house keeps a few. */
export function storeCap(sim: Sim, cat: 'tool' | 'gear'): number { const b = sim.building(cat === 'tool' ? 'toolstore' : 'armory'); return b ? levelDef(b).cap : 10; }

/** Work done inside the houses: each has one active order, advanced by everyone working there. */
export function tickWorks(sim: Sim, dt: number): void {
  for (const b of sim.buildings) {
    if (!b.done || (b.kind !== 'lab' && b.kind !== 'workshop')) continue;
    const kind = b.kind === 'lab' ? 'research' : 'craft';
    const queue = kind === 'research' ? sim.researchQueue : sim.craftQueue;
    const staff = b.staff.map((id) => sim.byId.get(id)).filter((v): v is Villager => !!v && v.phase === 'inside'); // only those at their bench: whoever is asleep in the house (off shift, night, worn out) does not work
    if (!staff.length && !sim.dev.freeWorks) continue; // dev: the houses work with nobody inside
    if (!b.active) {
      const i = queue.findIndex((id) => {
        const d = orderDef(sim, kind, id);
        if (!d) return false; // research and crafting were both paid when they were queued
        if (kind === 'craft') return recipeOpen(sim, id);
        return true;
      });
      if (i < 0) {
        if (queue.length && sim.time - sim.lastMatWarn > 30) { sim.lastMatWarn = sim.time; sim.say(kind === 'research' ? 'Nghiên cứu đang chờ.' : 'Đơn đang chờ: chưa chế được (Nhà chế tạo chưa đủ cấp).'); }
        continue;
      }
      const id = queue[i];
      queue.splice(i, 1);
      b.active = { id, progress: 0, paid: kind === 'craft' ? sim.craftPaid.splice(i, 1)[0] ?? 1 : undefined };
    }
    const d = orderDef(sim, kind, b.active.id);
    if (!d) { b.active = null; continue; }
    const job = kind as WorkJob;
    let rate = 0;
    for (const v of staff) { rate += sim.workFactor(v, job); sim.gainXp(v, job, dt); }
    b.active.progress = sim.dev.fastWorks ? 1 : Math.min(1, b.active.progress + (dt * sim.paceWork * rate * levelDef(b).craftSpeed * (1 + perkPct(sim.researched, kind === 'craft' ? 'craftSpeed' : 'researchSpeed') / 100)) / d.time); // dev: done at once
    if (b.active.progress < 1) continue;
    const id = b.active.id;
    if (kind === 'research') {
      sim.researched.add(id); b.active = null;
      sim.say(`Nhà nghiên cứu đã hoàn thành "${TECH_BY_ID[id].name}".`);
    } else {
      const r = RECIPE_BY_ID[id], cat = isGear(r.kind) ? 'gear' : 'tool';
      if (storeUsed(sim, cat) >= storeCap(sim, cat)) { // finished but nowhere to put it
        if (sim.time - sim.lastFullWarn > 30) { sim.lastFullWarn = sim.time; sim.say(cat === 'tool' ? 'Kho công cụ đã đầy, sản phẩm chờ chỗ.' : 'Kho vũ khí đã đầy, sản phẩm chờ chỗ.'); }
        continue;
      }
      sim.toolStock[id] = (sim.toolStock[id] ?? 0) + 1; b.active = null;
      sim.say(`Đã chế xong ${recipeName(r).toLowerCase()}.`);
    }
  }
}
