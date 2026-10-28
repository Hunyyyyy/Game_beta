/** What the houses are working on: the research, crafting and repair queues and the progress they make. */
import { PACE } from './constants';
import { Building, BuildingKind, levelDef } from './buildings';
import { WorkJob } from './jobs';
import { Res, Stock } from './resources';
import { isGear, RECIPE_BY_ID, recipeName, TIER_DURABILITY, ToolKind, TOOL_OF_JOB } from './tools';
import { recipeNeedLevel, recipeOpen as blueprintDone, RESEARCH, Tech, TECH_BY_ID, techForRecipe } from './research';
import type { Sim } from './sim';
import { Villager } from './model';

// ---------------------------------------------------------------- chế tác
// ---------------------------------------------------------------- research, crafting and repair
/** Cost and time of an order in one of the three queues. A repair costs half the materials and 60% of the time of making the tool. */
export function orderDef(sim: Sim, kind: 'research' | 'craft' | 'repair', id: string): { cost: Partial<Stock>; time: number } | null {
  if (kind === 'research') { const t = TECH_BY_ID[id]; return t ? { cost: t.cost, time: t.time } : null; }
  const r = RECIPE_BY_ID[id]; if (!r) return null;
  if (kind === 'craft') return { cost: r.cost, time: r.time };
  const half: Partial<Stock> = {};
  for (const k of Object.keys(r.cost) as Res[]) half[k] = Math.ceil((r.cost[k] ?? 0) / 2);
  return { cost: half, time: Math.ceil(r.time * 1.5) };
}

/** Level of a finished building of a kind (0 when there is none). */
export function levelOfKind(sim: Sim, kind: BuildingKind): number { return sim.building(kind)?.level ?? 0; }

export function workshopLevel(sim: Sim): number { return levelOfKind(sim, 'workshop'); }

/** The smartest villager working inside a building, 0 when it is empty. */
export function bestIntInside(sim: Sim, b: Building): number { return b.staff.reduce((m, id) => Math.max(m, sim.byId.get(id)?.stats.int ?? 0), 0); }

/** Why a recipe cannot be made yet (blueprint or crafting-house level), or null. */
export function recipeLock(sim: Sim, id: string): string | null {
  if (!RESEARCH.enabled) return null;
  if (!blueprintDone(sim.researched, id)) return `Chưa có bản vẽ: ${techForRecipe(id)?.name.replace(/^Bản vẽ /, '') ?? '?'}`;
  const need = recipeNeedLevel(id);
  if (workshopLevel(sim) < need) return `Cần Nhà chế tạo cấp ${need}`;
  return null;
}

export function recipeOpen(sim: Sim, id: string): boolean { return recipeLock(sim, id) === null; }

/** The smartest villager's Trí tuệ. */
export function bestInt(sim: Sim): number { return sim.villagers.reduce((m, v) => Math.max(m, v.stats.int), 0); }

/** Where a research stands: done, being worked on, queued, ready to start or locked (with the reason). */
export function techState(sim: Sim, t: Tech): { state: 'done' | 'active' | 'queued' | 'ready' | 'locked'; why?: string } {
  if (sim.researched.has(t.id)) return { state: 'done' };
  if (sim.building('lab')?.active?.id === t.id) return { state: 'active' };
  if (sim.researchQueue.includes(t.id)) return { state: 'queued' };
  const need = t.requires.find((r) => !sim.researched.has(r));
  if (need) return { state: 'locked', why: `Cần nghiên cứu: ${TECH_BY_ID[need].name}` };
  const lab = sim.building('lab');
  if (!lab) return { state: 'locked', why: 'Cần dựng Nhà nghiên cứu' };
  if (lab.level < t.needLevel) return { state: 'locked', why: `Cần Nhà nghiên cứu cấp ${t.needLevel}` };
  return { state: 'ready' };
}

/** Whether a queued research could start now: someone inside is bright enough. Null when it can, else the reason. */
export function researchBlock(sim: Sim, t: Tech): string | null {
  const lab = sim.building('lab');
  if (!lab || !lab.staff.length) return 'Chưa có người làm việc trong Nhà nghiên cứu';
  const best = bestIntInside(sim, lab);
  return best >= t.minInt ? null : `Cần người Trí tuệ ${t.minInt} trở lên trong nhà (giỏi nhất: ${best})`;
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
  sim.pay(t.cost);
  sim.researchQueue.push(id);
  return null;
}

/** Why the materials and coins for a research are not there, or null. They are paid when the research is queued. */
export function researchShort(sim: Sim, t: Tech): string | null { return sim.missing(t.cost); }

/** Queue a tool, weapon or armour for the Nhà chế tạo. */
export function queueCraft(sim: Sim, id: string): string | null {
  if (!RECIPE_BY_ID[id]) return 'Công thức không tồn tại';
  if (!sim.hasWorkshop()) return 'Cần dựng Nhà chế tạo trước';
  const lock = recipeLock(sim, id);
  if (lock) return lock;
  if (sim.craftQueue.length >= 12) return 'Hàng đợi đã đầy';
  sim.craftQueue.push(id);
  return null;
}

export function queueRepair(sim: Sim, id: string): string | null {
  if (!RECIPE_BY_ID[id]) return 'Công thức không tồn tại';
  if (!sim.building('repair')) return 'Cần dựng Nhà sửa chữa trước';
  if (sim.repairQueue.length >= 12) return 'Hàng đợi sửa đã đầy';
  sim.repairQueue.push(id);
  return null;
}

export function unqueue(sim: Sim, queue: string[], id: string): void { const i = queue.lastIndexOf(id); if (i >= 0) queue.splice(i, 1); }

export function unqueueCraft(sim: Sim, id: string): void { unqueue(sim, sim.craftQueue, id); }

/** Cancel a queued research; what was paid comes back. */
export function unqueueResearch(sim: Sim, id: string): void {
  const t = TECH_BY_ID[id];
  if (t && sim.researchQueue.includes(id)) sim.pay(t.cost, 1);
  unqueue(sim, sim.researchQueue, id);
}

/** How many tools or pieces of gear a store holds: the Kho công cụ for tools, the Kho vũ khí for weapons and armour. */
export function storeUsed(sim: Sim, cat: 'tool' | 'gear'): number { return (cat === 'tool' ? sim.wornTools.length : 0) + Object.entries(sim.toolStock).reduce((n, [id, c]) => n + ((RECIPE_BY_ID[id] && isGear(RECIPE_BY_ID[id].kind)) === (cat === 'gear') ? c : 0), 0); }

/** Room for items: the matching store when it stands, otherwise the crafting house keeps a few. */
export function storeCap(sim: Sim, cat: 'tool' | 'gear'): number { const b = sim.building(cat === 'tool' ? 'toolstore' : 'armory'); return b ? levelDef(b).cap : 10; }

/** Work done inside the houses: each has one active order, advanced by everyone working there. */
export function tickWorks(sim: Sim, dt: number): void {
  for (const b of sim.buildings) {
    if (!b.done || (b.kind !== 'lab' && b.kind !== 'workshop' && b.kind !== 'repair')) continue;
    const kind = b.kind === 'lab' ? 'research' : b.kind === 'workshop' ? 'craft' : 'repair';
    const queue = kind === 'research' ? sim.researchQueue : kind === 'craft' ? sim.craftQueue : sim.repairQueue;
    const staff = b.staff.map((id) => sim.byId.get(id)).filter((v): v is Villager => !!v);
    if (!staff.length) continue;
    if (!b.active) {
      const best = bestIntInside(sim, b);
      const i = queue.findIndex((id) => {
        const d = orderDef(sim, kind, id);
        if (!d || (kind !== 'research' && !sim.affordable(d.cost))) return false; // research was paid when it was queued
        if (kind === 'research') return best >= (TECH_BY_ID[id]?.minInt ?? 0);
        if (kind === 'craft') return recipeOpen(sim, id);
        return true;
      });
      if (i < 0) {
        if (queue.length && sim.time - sim.lastMatWarn > 30) { sim.lastMatWarn = sim.time; sim.say(kind === 'research' ? 'Nghiên cứu đang chờ: chưa có người đủ thông minh trong nhà.' : 'Đơn đang chờ: thiếu nguyên liệu.'); }
        continue;
      }
      const id = queue[i], d = orderDef(sim, kind, id)!;
      queue.splice(i, 1); if (kind !== 'research') sim.pay(d.cost);
      b.active = { id, progress: 0 };
    }
    const d = orderDef(sim, kind, b.active.id);
    if (!d) { b.active = null; continue; }
    const job = kind as WorkJob;
    let rate = 0;
    for (const v of staff) { rate += sim.workFactor(v, job); sim.gainXp(v, job, dt); }
    b.active.progress = Math.min(1, b.active.progress + (dt * PACE.work * rate * levelDef(b).craftSpeed * (sim.dev.fastWorks ? 25 : 1)) / d.time);
    if (b.active.progress < 1) continue;
    const id = b.active.id;
    if (kind === 'research') {
      sim.researched.add(id); b.active = null;
      sim.say(`Nhà nghiên cứu đã hoàn thành "${TECH_BY_ID[id].name}".`);
    } else {
      const r = RECIPE_BY_ID[id], cat = isGear(r.kind) ? 'gear' : 'tool';
      if (kind === 'repair') {
        const owner = sim.villagers.find((o) => o.repairFor === id), k = r.kind as ToolKind;
        if (owner && isGear(r.kind)) { // mended weapon or armour goes back into its owner's hands
          owner.repairFor = null;
          if (r.kind === 'hide') { if (!owner.armor) { owner.armor = 'hide'; owner.gear.a = null; } } else if (!owner.weapon) { owner.weapon = r.kind; owner.gear.w = null; }
          b.active = null; sim.say(`Đã sửa xong ${recipeName(r).toLowerCase()}, trả lại cho ${owner.name}.`);
          continue;
        }
        if (owner) {
          owner.repairFor = null;
          if (TOOL_OF_JOB[owner.job as WorkJob] === k && !sim.heldTool(owner)) {
            owner.tools[k] = { tier: r.tier, dur: TIER_DURABILITY[r.tier] }; b.active = null;
            sim.say(`Đã sửa xong ${recipeName(r).toLowerCase()}, trả lại cho ${owner.name}.`);
            continue;
          }
        }
      }
      if (storeUsed(sim, cat) >= storeCap(sim, cat)) { // finished but nowhere to put it
        if (sim.time - sim.lastFullWarn > 30) { sim.lastFullWarn = sim.time; sim.say(cat === 'tool' ? 'Kho công cụ đã đầy, sản phẩm chờ chỗ.' : 'Kho vũ khí đã đầy, sản phẩm chờ chỗ.'); }
        continue;
      }
      sim.toolStock[id] = (sim.toolStock[id] ?? 0) + 1; b.active = null;
      sim.say(kind === 'craft' ? `Đã chế xong ${recipeName(r).toLowerCase()}.` : `Đã sửa xong ${recipeName(r).toLowerCase()}.`);
    }
  }
}
