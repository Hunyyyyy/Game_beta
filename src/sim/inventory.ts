/** Tools, weapons and armour: handing them out, wearing them down, taking them back, fetching and ordering them. */
import { Building, BUILDINGS } from './buildings';
import { Job, JOB_NAME, WorkJob } from './jobs';
import { RECIPE_BY_ID, recipeName, TIER_DURABILITY, TIER_NAME, Tool, ToolKind, TOOL_KINDS, TOOL_NAME, TOOL_OF_JOB } from './tools';
import { ARMORS, CRAFTED_WEAPONS, cycleOf, RULES, WEAPONS } from './combat';
import { recipeOpen } from './research';
import type { Sim } from './sim';
import { Villager } from './model';

export function toolCount(sim: Sim, kind: string, tier: number): number { const id = `${kind}${tier}`; return (sim.toolStock[id] ?? 0) + sim.wornTools.filter((w) => w.id === id && w.dur > 0).length; }

/** Bậc công cụ dân đang dùng cho nghề này (0 = tay không). */
export function toolTier(sim: Sim, v: Villager, job: Job): number {
  const k = job === 'idle' || job === 'scout' || job === 'supply' ? undefined : TOOL_OF_JOB[job];
  const t = k ? v.tools[k] : null;
  return t && t.dur > 0 ? t.tier : 0; // a broken tool works like bare hands
}

// ---------------------------------------------------------------- tools, weapons and armour by hand
export function toolId(sim: Sim, k: ToolKind, tier: number): string { return `${k}${tier}`; }

/** The tool a villager holds. They carry one at a time (armour and weapons are separate). */
export function heldTool(sim: Sim, v: Villager): { k: ToolKind; t: Tool } | null {
  for (const k of TOOL_KINDS) { const t = v.tools[k]; if (t) return { k, t }; }
  return null;
}

/** Put the tool a villager holds back in the stock, keeping its wear; a broken one is thrown away. */
export function returnTool(sim: Sim, v: Villager): void {
  const h = heldTool(sim, v); if (!h) return;
  const { k, t } = h, id = toolId(sim, k, t.tier), name = `${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t.tier].toLowerCase()}`;
  v.tools[k] = null;
  if (t.dur <= 0) { sim.say(`${v.name} bỏ ${name} đã hỏng.`); return; }
  if (t.dur >= TIER_DURABILITY[t.tier] - 1e-6) sim.toolStock[id] = (sim.toolStock[id] ?? 0) + 1; else sim.wornTools.push({ id, dur: t.dur });
  sim.say(`${v.name} trả ${name} về kho.`);
}

/** Take a tool out of the stock: a new one first, else the least worn. */
export function takeTool(sim: Sim, k: ToolKind, tier: number): Tool | null {
  const id = toolId(sim, k, tier);
  if ((sim.toolStock[id] ?? 0) > 0) { sim.toolStock[id]--; return { tier, dur: TIER_DURABILITY[tier] }; }
  let best = -1;
  sim.wornTools.forEach((w, i) => { if (w.id === id && w.dur > 0 && (best < 0 || w.dur > sim.wornTools[best].dur)) best = i; });
  return best < 0 ? null : { tier, dur: sim.wornTools.splice(best, 1)[0].dur };
}

/** Hand chosen villagers a tool from the stock. It must be the tool of their job. Tier 0 takes the tool back, with its wear. */
export function assignTool(sim: Sim, ids: readonly number[], k: ToolKind, tier: number): string | null {
  let short = false, wrong: string | null = null, given = 0;
  for (const v of sim.mine(ids)) {
    const cur = v.tools[k];
    if (tier === 0) { if (cur) { returnTool(sim, v); given++; } continue; }
    if (TOOL_OF_JOB[v.job as WorkJob] !== k) { wrong = `${v.name} làm ${JOB_NAME[v.job].toLowerCase()}: không dùng ${TOOL_NAME[k].toLowerCase()}`; continue; }
    if (cur?.tier === tier && cur.dur > 0) continue;
    if (toolCount(sim, k, tier) <= 0) { short = true; continue; }
    returnTool(sim, v);
    v.tools[k] = takeTool(sim, k, tier);
    given++;
    sim.say(`${v.name} được phát ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}.`);
  }
  if (given) return null;
  return short ? `Kho hết ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}, hãy chế thêm` : wrong;
}

/** Throw a tool away, worn or not. */
export function discardTool(sim: Sim, ids: readonly number[], k: ToolKind): void {
  for (const v of sim.mine(ids)) if (v.tools[k]) { v.tools[k] = null; sim.say(`${v.name} vứt ${TOOL_NAME[k].toLowerCase()}.`); }
}

// ---------------------------------------------------------------- weapons and armour wear out
const gearName = (slot: 'weapon' | 'armor', id: string) => (slot === 'armor' ? ARMORS[id]?.name : WEAPONS[id]?.name)?.toLowerCase() ?? id;
const gearId = (slot: 'weapon' | 'armor', id: string) => (slot === 'armor' ? `${id}${ARMORS[id]?.tier ?? 1}` : `${id}${WEAPONS[id]?.tier ?? 1}`);
/** The key of a suit of armour in the stores (hide1, bone2). */
const armorKey = (k: string): string => `${k}${ARMORS[k]?.tier ?? 1}`;
/** The best suit the stores hold (the highest tier), or null. */
export function bestArmor(sim: Sim): string | null {
  let best: string | null = null, top = 0;
  for (const k of Object.keys(ARMORS)) { const t = ARMORS[k].tier ?? 1; if (t > top && toolCount(sim, k, t) > 0) { best = k; top = t; } }
  return best;
}

/**
 * One blow struck (weapon) or taken (armour). Worn to nothing, the piece is lost for good. Only our own people's gear wears.
 */
export function wearGear(sim: Sim, v: Villager, slot: 'weapon' | 'armor'): void {
  if (v.team !== 'player') return;
  const id = slot === 'weapon' ? v.weapon : v.armor, g = v.gear;
  if (!id) return;
  const max = (slot === 'weapon' ? WEAPONS[id]?.durability : ARMORS[id]?.durability) ?? 0;
  if (!max) return;
  if (slot === 'weapon') { if (g.w !== id) { g.w = id; g.wd = max; g.wb = false; } if (g.wb || --g.wd > 0) return; }
  else { if (g.a !== id) { g.a = id; g.ad = max; g.ab = false; } if (g.ab || --g.ad > 0) return; }
  if (slot === 'weapon') { v.weapon = null; g.w = null; g.wb = false; } else { v.armor = null; g.a = null; g.ab = false; }
  v.manualGear = false;
  sim.say(`${v.name} làm vỡ ${gearName(slot, id)}, mất hẳn.`);
}

/** Hand a weapon (club, spear, mace) or the hide armour straight to villagers; null takes it away. */
export function giveGear(sim: Sim, ids: readonly number[], kind: string | null, slot: 'weapon' | 'armor'): void {
  for (const v of sim.mine(ids)) {
    if (slot === 'weapon') v.weapon = kind; else v.armor = kind;
    if (kind) sim.say(`${v.name} được cấp ${(kind in ARMORS ? ARMORS[kind].name : WEAPONS[kind].name).toLowerCase()}.`);
  }
}

/** Give a villager a weapon or armour from the workshop's stock (the old piece goes back); null hands it back. Returns an error or null. */
export function assignGear(sim: Sim, ids: readonly number[], kind: string | null, slot: 'weapon' | 'armor'): string | null {
  const key = (k: string) => (k in ARMORS ? armorKey(k) : `${k}${WEAPONS[k].tier ?? 1}`);
  const nameOf = (k: string) => (k in ARMORS ? ARMORS[k].name : WEAPONS[k].name).toLowerCase();
  const people = sim.mine(ids);
  if (kind && !sim.hasWorkshop() && !sim.building('armory')) return 'Cần có Nhà chế tạo hoặc Kho vũ khí để lấy đồ';
  let given = 0, short = false;
  for (const v of people) {
    const cur = slot === 'weapon' ? v.weapon : v.armor;
    if (cur === kind) { v.manualGear = true; continue; }
    if (kind) { if (toolCount(sim, kind, kind in ARMORS ? ARMORS[kind].tier ?? 1 : WEAPONS[kind].tier ?? 1) <= 0) { short = true; continue; } sim.toolStock[key(kind)]--; }
    if (cur) sim.toolStock[key(cur)] = (sim.toolStock[key(cur)] ?? 0) + 1;
    if (slot === 'weapon') v.weapon = kind; else v.armor = kind;
    v.manualGear = true; given++;
    sim.say(kind ? `${v.name} được phát ${nameOf(kind)}.` : `${v.name} trả lại ${cur ? nameOf(cur) : 'đồ'}.`);
  }
  return short && given === 0 ? `Kho hết ${kind ? nameOf(kind) : 'đồ'}, hãy chế thêm` : null;
}

/** Let the workshop hand out and swap gear by itself again. */
/** Let the stores hand out gear on their own again, for gear the player had chosen by hand. Returns an error or null. */
export function autoGear(sim: Sim, ids: readonly number[]): string | null {
  for (const v of sim.mine(ids)) v.manualGear = false;
  return null;
}

/** Cấp công cụ ngay cho dân đã chọn, không cần Xưởng hay nguyên liệu. tier 0 = thu lại (tay không). */
export function giveTool(sim: Sim, ids: readonly number[], kind: ToolKind, tier: number): void {
  for (const id of ids) {
    const v = sim.byId.get(id); if (!v) continue;
    for (const k of TOOL_KINDS) v.tools[k] = null;
    v.tools[kind] = tier > 0 ? { tier, dur: TIER_DURABILITY[tier] } : null;
    if (tier > 0 && TOOL_OF_JOB[v.job as WorkJob] !== kind) { const job = (Object.keys(TOOL_OF_JOB) as WorkJob[]).find((j) => TOOL_OF_JOB[j] === kind); if (job && v.team === 'player') sim.setJob([v.id], job); }
    if (tier > 0) sim.say(`${v.name} được cấp ${TOOL_NAME[kind].toLowerCase()} ${TIER_NAME[tier].toLowerCase()}.`);
  }
}

/** True when the villager's tool for this job is missing or broken. */
export function toolLacking(sim: Sim, v: Villager, job: WorkJob): boolean {
  const k = TOOL_OF_JOB[job]; if (!k) return false;
  const t = v.tools[k];
  return !t || t.dur <= 0;
}

/** Best tier of this tool the stock holds (0 when none). */
export function stockedTier(sim: Sim, k: ToolKind): number { for (let t = 2; t >= 1; t--) if (toolCount(sim, k, t) > 0) return t; return 0; }

/** A villager who lacks a tool, with the Kho công cụ built and a tool in stock: he fetches it himself. */
export function needTool(sim: Sim, v: Villager, job: WorkJob): boolean {
  const k = TOOL_OF_JOB[job];
  return !!k && !!sim.building('toolstore') && toolLacking(sim, v, job) && stockedTier(sim, k) > 0;
}

/** Walk to a building's edge for an errand; false when it cannot be reached. */
export function goTo(sim: Sim, v: Villager, b: Building, phase: 'goEquip' | 'goOrder'): boolean {
  const d = BUILDINGS[b.kind];
  if (sim.routeTo(v, sim.ringTiles(v, b.x, b.y, d.w, d.h)) < 0) return false;
  v.target = b.id; v.phase = phase; return true;
}

/** Villagers ordering tools, weapons and armour from the Nhà chế tạo by themselves: switched off for now (the player orders them). Turn on to bring it back. */
const AUTO_ORDER = false;

/** Without a usable tool: fetch one from the Kho công cụ (and, when AUTO_ORDER is on, once researched go and order one). */
export function planTool(sim: Sim, v: Villager, job: WorkJob): boolean {
  const k = TOOL_OF_JOB[job];
  if (!k || !toolLacking(sim, v, job)) return false;
  const store = sim.building('toolstore');
  if (store && needTool(sim, v, job)) return goTo(sim, v, store, 'goEquip');
  if (!AUTO_ORDER || v.orderCd > 0) return false;
  v.orderCd = 45;
  const craftHouse = sim.building('workshop');
  if (!craftHouse) return false;
  // order the best tool the blueprints allow, unless enough are already made or on their way
  let id = '';
  for (let tier = 2; tier >= 1; tier--) if (sim.recipeOpen(`${k}${tier}`)) { id = `${k}${tier}`; break; }
  if (!id) return false;
  const lacking = sim.villagers.filter((o) => o.inside === null && o.job !== 'idle' && TOOL_OF_JOB[o.job as WorkJob] === k && toolLacking(sim, o, o.job as WorkJob)).length;
  const onWay = toolCount(sim, k, 1) + toolCount(sim, k, 2) + sim.craftQueue.filter((q) => q.startsWith(k)).length + (craftHouse.active?.id.startsWith(k) ? 1 : 0);
  if (onWay >= lacking || sim.craftQueue.length >= 12) return false;
  v.order = `craft:${id}`;
  return goTo(sim, v, craftHouse, 'goOrder');
}

/** Arrived at a house with an errand: hand over the order or the broken tool, then back to work. */
export function errand(sim: Sim, v: Villager): void {
  const o = v.order; v.order = null; v.phase = 'idle'; v.orderCd = 90;
  const b = sim.getBuilding(v.target);
  if (b) sim.faceBuilding(v, b);
  if (!o || !b || !b.done) return;
  const [what, id] = o.split(':');
  if (what === 'craft') { if (sim.queueCraft(id) === null) sim.say(`${v.name} nhờ chế ${recipeName(RECIPE_BY_ID[id]).toLowerCase()}.`); }


}

/**
 * Every second in peace: soldiers and hunters with empty hands who cannot go to the Kho vũ khí by themselves (lying in their camp or their tower, asleep)
 * are handed the weapon and armour the store holds now, so what the workshop makes later still reaches them. Those on their feet fetch it on their own (planEquipGear).
 */
export function restock(sim: Sim): void {
  if (!sim.building('armory')) return;
  for (const v of sim.villagers) {
    if (v.team !== 'player' || (v.job !== 'fight' && v.job !== 'hunt') || v.manualGear || v.health <= 0 || v.phase === 'fight') continue;
    if (v.inside === null && v.phase !== 'sleep') continue;
    if ((!v.weapon && bestWeapon(sim, v)) || (!v.armor && bestArmor(sim))) equipGear(sim, v);
  }
}

/** Take a tool, or weapon and armour, from the store the villager stands at. */
export function equip(sim: Sim, v: Villager): void {
  v.phase = 'idle';
  const store = sim.getBuilding(v.target);
  if (store) sim.faceBuilding(v, store);
  if (v.job === 'hunt' || v.job === 'fight') { equipGear(sim, v); return; }
  const k = TOOL_OF_JOB[v.job as WorkJob];
  if (!k || !toolLacking(sim, v, v.job as WorkJob)) return;
  const t = stockedTier(sim, k);
  if (!t) return;
  v.tools[k] = takeTool(sim, k, t);
  sim.say(`${v.name} nhận ${TOOL_NAME[k].toLowerCase()} ${TIER_NAME[t].toLowerCase()}.`);
}

/** A soldier or hunter with empty hands goes to the Kho vũ khí (once fetching is researched) for a weapon, and for the hide armour when he has none. */
export function planEquipGear(sim: Sim, v: Villager): boolean {
  if ((v.job !== 'hunt' && v.job !== 'fight') || v.phase === 'fight' || v.manualGear) return false;
  const armory = sim.building('armory');
  if (!armory) return false;
  const wantsWeapon = !v.weapon && !!bestWeapon(sim, v), wantsArmor = !v.armor && !!bestArmor(sim); // soldiers and hunters both wear armour
  if (!wantsWeapon && !wantsArmor) return false;
  return goTo(sim, v, armory, 'goEquip');
}

export function equipGear(sim: Sim, v: Villager): void {
  const best = !v.weapon ? bestWeapon(sim, v) : null;
  if (best) {
    sim.toolStock[`${best}${WEAPONS[best].tier ?? 1}`]--;
    v.weapon = best; sim.say(`${v.name} nhận ${WEAPONS[best].name.toLowerCase()}.`);
  }
  const suit = !v.armor ? bestArmor(sim) : null; // the best suit the store has
  if (suit) { sim.toolStock[armorKey(suit)]--; v.armor = suit; sim.say(`${v.name} mặc ${ARMORS[suit].name.toLowerCase()}.`); }
}

/** With ordering researched, a soldier or hunter who has nothing to fight with asks the Nhà chế tạo for a weapon (a soldier also for armour). */
export function planGearErrand(sim: Sim, v: Villager): boolean {
  if (!AUTO_ORDER || (v.job !== 'hunt' && v.job !== 'fight') || v.phase === 'fight' || v.manualGear || v.orderCd > 0) return false;
  const house = sim.building('workshop');
  if (!house) return false;
  const have = (re: RegExp) => Object.entries(sim.toolStock).some(([id, n]) => n > 0 && re.test(id)) || sim.craftQueue.some((id) => re.test(id)) || !!house.active && re.test(house.active.id);
  let id = '';
  // the kind he may carry: throwers the ranged ones, foot the blows, a rider, a guard or a hunter whatever is best (the same rule as bestWeapon)
  const mayCarry = (w: string) => !(w === 'mace' && v.job !== 'fight') && (v.job !== 'fight' || v.guard || v.arm === 'cavalry' || (v.arm === 'archer') === !!WEAPONS[w].ranged);
  if (!v.weapon && !CRAFTED_WEAPONS.some((w) => mayCarry(w) && have(new RegExp(`^${w}\\d`)))) {
    let bestScore = -1;
    for (const w of CRAFTED_WEAPONS) {
      const rid = `${w}${WEAPONS[w].tier ?? 1}`;
      if (!sim.recipeOpen(rid) || !mayCarry(w)) continue;
      const sc = WEAPONS[w].damage / WEAPONS[w].cycle;
      if (sc > bestScore) { bestScore = sc; id = rid; }
    }
  } else if (v.job === 'fight' && !v.armor && !have(/^(hide|bone)/) && sim.recipeOpen('hide1')) id = 'hide1';
  v.orderCd = 60;
  if (!id) return false;
  v.order = `craft:${id}`;
  return goTo(sim, v, house, 'goOrder');
}

/** Best weapon the workshop holds that beats what `v` carries, by damage per second. */
export function bestWeapon(sim: Sim, v: Villager): string | null {
  const score = (id: string) => { const w = WEAPONS[id]; return (w.damage + RULES.strengthDamage * v.stats.str) / cycleOf(w.cycle, v.stats.agi) + (w.range > 1 ? 1 : 0); };
  const cur = v.weapon ? score(v.weapon) : score('fist');
  let best: string | null = null, bs = cur;
  for (const id of CRAFTED_WEAPONS) {
    if (sim.toolCount(id, WEAPONS[id].tier ?? 1) <= 0) continue;
    if (id === 'mace' && v.job !== 'fight') continue; // the heavy mace is a soldier's weapon, not a hunter's
    if (v.job === 'fight' && v.guard && v.post >= 0 && !WEAPONS[id].ranged) continue; // a man of a tower shoots
    if (v.job === 'fight' && !v.guard && v.arm !== 'cavalry' && (v.arm === 'archer') !== !!WEAPONS[id].ranged) continue; // the throwers' camp arms throwers, the foot carry blows; a rider, a guard and a hunter take whatever is best
    if (score(id) > bs) { bs = score(id); best = id; }
  }
  return best;
}
