// A bot that plays the stone age through the same calls as the UI, to measure the pace of a village (days to each campfire level, people, food, research).
// It is a measuring tool for balancing, not a part of the game. Run it with esbuild: bundle this file for node and run it:  node bot.cjs <seed> <days>
// Env: POLICY=eco|mil|mix (what it researches), EFF=1|0.5 (how efficient the player is: 0.5 acts half as often and leaves half of the free people idle),
//      EVENTS=1 (keep the raids and the beasts on; off by default, so that it measures the economy alone),
//      WAR=1 (it also makes weapons and armour, and sends the army at the villages it can beat, taking those that give in).
import { Sim } from '../src/sim/sim';
import { BUILDINGS, fireUnlockLevel, eraLocked, BuildingKind, levelDef } from '../src/sim/buildings';
import { roleOf, RoleId } from '../src/sim/jobs';
import { TECH_BY_ID } from '../src/sim/research';
import { techState } from '../src/sim/works';
import { fireUpgradeGroups } from '../src/sim/progression';
import { discoverTribe } from '../src/sim/dev';

const seed = +(process.argv[2] ?? 1), DAYS = +(process.argv[3] ?? 20);
const POLICY = process.env.POLICY ?? 'mix', EFF = +(process.env.EFF ?? 1);
const ECO = new Set(['wood', 'stone', 'food', 'hunt', 'builder', 'lab', 'craft', 'workshop', 'research', 'gather', 'farm']);
const sim = new Sim(seed);
const TICK = 0.05, STEP = Math.round(5 / EFF / TICK); // ticks between two decisions
if (!process.env.EVENTS) { sim.events.length = 0; sim.nextRaid = 1e9; }
const kinds = Object.keys(BUILDINGS) as BuildingKind[];
const fire = () => sim.campfire()!;
const open = (k: BuildingKind) => BUILDINGS[k].buildable && fireUnlockLevel(k) <= fire().level && !eraLocked(k, sim);
const count = (k: BuildingKind) => sim.buildings.filter((b) => b.kind === k).length;
const costOf = (k: BuildingKind, level: number) => (levelDef({ kind: k, level: 1, era: 'stone' } as never, level) as { cost: Record<string, number> }).cost;
const rnd = () => sim.rnd();

function spot(k: BuildingKind): [number, number] | null {
  const f = fire(), cx = Math.floor(f.x + 1), cy = Math.floor(f.y + 1);
  for (let r = 4; r <= 24; r++) for (let dx = -r; dx <= r; dx++) {
    const ys = Math.abs(dx) === r ? Array.from({ length: 2 * r + 1 }, (_, i) => i - r) : [-r, r];
    for (const dy of ys) if (sim.canPlace(k, cx + dx, cy + dy) === null) return [cx + dx, cy + dy];
  }
  return null;
}

// ---- what the campfire needs next
function fireNeeds(): Array<{ kind: BuildingKind; level: number }> {
  const groups = fireUpgradeGroups(fire().level), out: Array<{ kind: BuildingKind; level: number }> = [];
  for (const k of kinds) {
    const d = BUILDINGS[k], at = groups[d.group];
    if (d.buildable && !eraLocked(k, sim) && at !== undefined) out.push({ kind: k, level: Math.min(at, BUILDINGS[k].levels.stone!.length) });
  }
  return out;
}
const PRIO: BuildingKind[] = ['builder', 'farmhouse', 'lumberyard', 'guardpost', 'huntlodge', 'storage', 'quarry', 'workshop', 'toolstore', 'lab', 'house', 'armory', 'infantry', 'archery', 'cavalry'];
const prio = (k: BuildingKind) => { const i = PRIO.indexOf(k); return i < 0 ? 99 : i; };

let barterLog = 0;
function projects(): void {
  // shells are what the dearer houses and the research ask for: swap whatever is piling up for them whenever the purse runs low
  if (sim.stock.coin < 40) for (const [r, keep] of [['stone', 250], ['hide', 120], ['wood', 400], ['food', 600]] as const) if (sim.stock[r] > keep && !sim.barter(r)) { barterLog++; break; }
  const f = fire(), needs = fireNeeds().sort((a, b) => prio(a.kind) - prio(b.kind));
  // 1) buildings missing
  const busy = () => sim.buildings.filter((b) => !b.done || b.upgrading).length;
  const slots = () => Math.max(1, sim.crew().length);
  let met = true;
  for (const n of needs) {
    const mine = sim.buildings.filter((b) => b.kind === n.kind);
    if (!mine.length) { met = false; if (busy() < slots() + 1 && open(n.kind) && !sim.missing(costOf(n.kind, 1) as never)) { const s = spot(n.kind); if (s) sim.placeBuilding(n.kind, s[0], s[1]); } continue; }
    for (const b of mine) if (!b.done || b.upgrading || b.level < n.level) {
      met = false;
      if (b.done && !b.upgrading && b.level < n.level && busy() < slots() + 1 && sim.canUpgrade(b) === null) sim.upgradeBuilding(b.id);
    }
  }
  // extra houses of the producers and the capacity of the stores while the rest waits on the fire (more people at work)
  if (met) {
    // everything the fire asks is there: save up and climb
    const err = sim.canUpgrade(f);
    if (err === null) { sim.upgradeBuilding(f.id); console.error('day', sim.day, 'fire ->', f.level + 1); return; }
    // short of coin: barter the surplus
    const need = costOf('campfire' as BuildingKind, f.level + 1);
    if ((need.coin ?? 0) > sim.stock.coin) for (const r of ['stone', 'hide', 'bone', 'wood', 'food'] as const) { const keep = need[r] ?? 0; if (sim.stock[r] - keep > 10) { const e = sim.barter(r); if (!e) barterLog++; break; } }
  }
  // 2) with the fire waiting, extra upgrades that raise output (never below the fire's need) when the wood allows
  if (!met || sim.stock.wood > 200) for (const b of [...sim.buildings].sort((a, c) => prio(a.kind) - prio(c.kind))) {
    if (busy() >= slots() + 1) break;
    if (b.kind === 'campfire' || !b.done || b.upgrading) continue;
    if (!['lumberyard', 'farmhouse', 'huntlodge', 'quarry', 'builder', 'storage', 'workshop', 'lab'].includes(b.kind)) continue;
    if (sim.canUpgrade(b) === null && !sim.upgradeBuilding(b.id)) break;
  }
  // the village a player keeps beyond what the fire asks: defence, stores, camps, workshops. Built when affordable, raised toward the level of the fire when there is wealth to spare.
  const KEEP: BuildingKind[] = ['guardpost', 'storage', 'armory', 'workshop', 'toolstore', 'lab', 'house', 'infantry', 'archery', 'cavalry'];
  for (const k of KEEP) if (open(k) && count(k) < sim.buildingLimit(k) && busy() < slots() + 1 && !sim.missing(costOf(k, 1) as never)) { const sp = spot(k); if (sp) sim.placeBuilding(k, sp[0], sp[1]); }
  if (sim.stock.wood > 400 && sim.stock.stone > 250) for (const b of sim.buildings) {
    if (busy() >= slots() + 1) break;
    if (!KEEP.includes(b.kind) || !b.done || b.upgrading || b.level >= fire().level) continue;
    if (sim.canUpgrade(b) === null && !sim.upgradeBuilding(b.id)) break;
  }
  // more houses of the same kind when the fire allows more than one (wood, food, hunt, stone), for more places to work
  for (const k of ['lumberyard', 'farmhouse', 'huntlodge', 'storage', 'quarry'] as BuildingKind[]) if (open(k) && count(k) < sim.buildingLimit(k) && busy() < slots() + 1 && !sim.missing(costOf(k, 1) as never)) { const s = spot(k); if (s) sim.placeBuilding(k, s[0], s[1]); }
}

// ---- people
function share(): Record<string, number> {
  const pop = sim.villagers.length, food = sim.stock.food + sim.foodPot, cap = sim.capacity();
  const hungry = food < pop * 5;
  const woodShort = sim.stock.wood < 150 && sim.stock.wood < cap * 0.6;
  return { food: hungry ? 3 : 1.4, hunt: sim.stock.hide < 80 ? 2.2 : 0.8, wood: woodShort ? 2.2 : 1.2, stone: sim.stock.stone > 120 ? 0 : 0.6 };
}
function staff(): void {
  const idle = sim.villagers.filter((v) => v.job === 'idle' && roleOf(v) === null && !v.inside && v.health > 0);
  const want = share();
  for (const v of idle) {
    if (EFF < 1 && rnd() > EFF) continue;
    const cnt = (r: RoleId) => sim.villagers.filter((o) => roleOf(o) === r).length;
    if (sim.building('builder')?.done && sim.crew().length < 3 && !sim.assignCrew([v.id])) continue;
    if (sim.building('lab')?.done && sim.assignStaff([v.id], 'research') === null) continue;
    if (sim.building('workshop')?.done && sim.assignStaff([v.id], 'craft') === null) continue;
    const order = (['food', 'hunt', 'wood', 'stone'] as RoleId[]).filter((r) => (want[r] ?? 0) > 0).sort((a, b) => cnt(a) / want[a] - cnt(b) / want[b]);
    let placed = false;
    for (const r of order) if (!sim.assignRole([v.id], r)) { placed = true; break; }
    if (placed) continue;
    // nowhere to work: a soldier (the camps count the bodies)
    for (const r of ['guard', 'foot', 'archer', 'cavalry'] as RoleId[]) if (!sim.assignRole([v.id], r)) break;
  }
}

// ---- tools and research
const TOOL_JOBS: Record<string, RoleId[]> = { axe1: ['wood'], pick1: ['stone'], hoe1: ['food'], hammer1: [] };
function craft(): void {
  const w = sim.building('workshop'); if (!w?.done || sim.craftQueue.length >= 2) return;
  for (const id of ['axe1', 'pick1', 'hoe1', 'hammer1', 'torch1']) {
    const have = (sim.toolStock[id] ?? 0) + sim.wornTools.filter((t) => t.id === id).length;
    const need = id === 'hammer1' ? Math.min(3, sim.crew().length) : id === 'torch1' ? 4 : (TOOL_JOBS[id] ?? []).reduce((n, r) => n + sim.villagers.filter((o) => roleOf(o) === r).length, 0);
    const held = sim.villagers.filter((o) => (o as { tools?: Record<string, unknown> }).tools && false).length;
    if (have + held < need && !sim.queueCraft(id)) return;
  }
}
// weapons and armour for the soldiers, a few of each kind kept in the Kho vũ khí (the soldiers fetch them by themselves, inventory.restock)
function gear(): void {
  if (!process.env.WAR || !sim.building('armory')?.done || !sim.building('workshop')?.done || sim.craftQueue.length >= 3) return;
  const soldiers = sim.villagers.filter((v) => v.job === 'fight').length;
  for (const id of ['spear1', 'sling1', 'club1', 'bow1', 'hide1']) {
    if ((sim.toolStock[id] ?? 0) + sim.villagers.filter((v) => v.weapon?.startsWith?.(id.slice(0, -1)) || v.armor === id.slice(0, -1)).length >= Math.ceil(soldiers / 3) + 2) continue;
    if (!sim.queueCraft(id)) return;
  }
}
const rdone = { n: 0, secs: 0 };
function research(): void {
  const lab = sim.building('lab'); if (!lab?.done || lab.active?.id || sim.researchQueue[0]) return;
  let best: { id: string; time: number; cost: Record<string, number> } | null = null, bestScore = Infinity;
  for (const t of Object.values(TECH_BY_ID) as Array<{ id: string; time: number; cost: Record<string, number> }>) {
    if (techState(sim, t as never).state !== 'ready' || /^(signal|form|plan)/.test(t.id)) continue;
    const eco = ECO.has(t.id.split('_')[0]);
    const want = POLICY === 'eco' ? eco : POLICY === 'mil' ? !eco : (sim.day % 2 === 0 ? eco : !eco);
    const score = t.time + (want ? 0 : 1e5) - (/_gyield_/.test(t.id) ? 1e6 : 0); // the yield of the trades first: what a worker brings in is what the few places to work are made up with
    if (score < bestScore && !sim.missing(t.cost as never)) { bestScore = score; best = t; }
  }
  if (best && !sim.queueResearch(best.id)) { rdone.n++; rdone.secs += best.time; }
}

// ---- the war of the stone age: the army at the village it can beat; the village that gives in is taken
const warLog = { sent: 0, won: 0, called: 0, adopted: 0, tributes: 0, allies: 0, bossSent: 0, bossResult: '' as string, loot: {} as Record<string, number> };
const lostAt: Record<string, number> = {};
let warTarget: string | null = null, bossId = ''; const counted = new Set<number>();
function wars(): void {
  if (!process.env.WAR) return;
  // a war ends when the village is no longer a free enemy (it gave in, or fell) or the fight is decided: the army is pulled out at once, and only then is the village taken
  for (const p of sim.plans) if (p.kind === 'attack' && p.status === 'running') {
    const t = sim.tribes.find((q) => q.id === p.tribe);
    if ((p.stage === 'over' || (t && t.state !== 'free')) && p.stage !== 'recall' && p.stage !== 'retreat') {
      if ((p.result === 'won' || (t && t.state !== 'free')) && !counted.has(p.id)) { counted.add(p.id); warLog.won++; for (const [r, n] of Object.entries(p.stats?.loot ?? {})) warLog.loot[r] = (warLog.loot[r] ?? 0) + (n as number); }
      sim.withdrawPlan(p);
    }
  }
  // a fight that goes on and on is called off, as a player would: the village stands still while the war is on
  for (const p of sim.plans) if (p.kind === 'attack' && p.status === 'running' && p.stage === 'fight' && sim.time - ((p as { startedAt?: number }).startedAt ?? sim.time) > 900 && !counted.has(-p.id)) { counted.add(-p.id); warLog.called++; sim.withdrawPlan(p); }
  if (sim.plans.some((p) => p.kind === 'attack' && p.status === 'running')) return;
  // what the player does with a village that gave in: the weak ones are taken in (people and places), the stronger ones pay tribute and send soldiers to the next war
  for (const t of sim.tribes) if (t.state === 'surrendered') {
    if (t.tier === 'weak') { if (!sim.diplomacy(t.id, 'adopt')) warLog.adopted++; } else if (!sim.diplomacy(t.id, 'tribute')) warLog.tributes++;
  }
  if (warTarget === 'boss-run') { const b = sim.tribes.find((q) => q.id === bossId); warLog.bossResult = !b ? 'gone' : b.state === 'free' ? 'lost' : 'won'; warTarget = null; }
  if (warTarget && warTarget !== 'boss-run') { const q = sim.tribes.find((x) => x.id === warTarget); if (q && q.state === 'free') lostAt[q.id] = sim.day; } // it did not give in: not again at once
  warTarget = null;
  const mine = sim.power();
  if (mine.soldiers < 20 || sim.restTime || sim.attackReason()) return;
  const boss = sim.tribes.find((q) => q.boss && q.state === 'free' && !q.rebel);
  const ready = sim.villagers.filter((v) => v.job === 'fight' && !v.guard && v.post < 0 && !v.ally).length;
  // a player sends the army when it is as big as the camps of its level allow for that kind of village, and waits some days after a defeat
  const need: Record<string, number> = { weak: 8, normal: 20, medium: 38 };
  const cands = sim.tribes.filter((t) => t.state === 'free' && !t.boss && ready >= (need[t.tier] ?? 99) && sim.day - (lostAt[t.id] ?? -99) >= 6).sort((a, b) => a.campLevel - b.campLevel);
  // the boss when nobody else is left to take and the army is big enough (the camps' soldiers)
  const t = !cands.length && boss && fire().level >= 4 && ready >= 85 && !warLog.bossResult.startsWith('lost') ? boss : cands[0]; if (!t) return;
  discoverTribe(sim, t.id);
  if (!sim.quickAttack(t.id)) { warLog.sent++; warLog.allies += sim.villagers.filter((v) => v.ally).length; warTarget = t.id; if (t.boss) { warLog.bossSent++; bossId = t.id; warTarget = 'boss-run'; } }
}

// ---- run
let ids = new Set(sim.villagers.map((v) => v.id)), born = 0, died = 0, inc = 0, prevTot = sim.stock.food + sim.foodPot, dayStartFood = prevTot;
const milestones: Record<string, number> = {};
const t0 = Date.now();
for (let i = 0, last = sim.day; sim.day <= DAYS; i++) {
  sim.tick(TICK);
  { const tot = sim.stock.food + sim.foodPot; if (tot > prevTot) inc += tot - prevTot; prevTot = tot; }
  if (i % STEP === 0) { projects(); staff(); craft(); research(); gear(); wars(); }
  for (const v of sim.villagers) if (!ids.has(v.id)) { ids.add(v.id); born++; }
  const fl = fire().level; if (!milestones['fire' + fl]) milestones['fire' + fl] = sim.day;
  if (sim.day !== last) {
    const now = new Set(sim.villagers.map((v) => v.id)); for (const id of [...ids]) if (!now.has(id)) { died++; ids.delete(id); }
    const roles: Record<string, number> = {}; for (const v of sim.villagers) { const r = roleOf(v) ?? v.job; roles[r] = (roles[r] ?? 0) + 1; }
    const nowF = sim.stock.food + sim.foodPot, eat = inc - (nowF - dayStartFood), rec = { inc: Math.round(inc), eat: Math.round(eat) }; inc = 0; dayStartFood = nowF;
    console.log(JSON.stringify({ day: last, ...rec, season: sim.season, pop: sim.villagers.length, born, died, fire: fl, food: Math.round(nowF), wood: Math.round(sim.stock.wood), stone: Math.round(sim.stock.stone), hide: Math.round(sim.stock.hide), coin: sim.stock.coin, roles, res: sim.researched.size, rq: rdone.n, war: { ...warLog }, tribute: sim.tribes.filter((t) => t.state === 'tribute').length, rel: sim.tribes.map((t) => t.id + ':' + Math.round(t.relation)).join(' '), boss: sim.tribes.map((t) => t.id + ':' + t.state + (t.boss ? 'B' : '') + t.campLevel).join(' '), rdays: +(rdone.secs / 240).toFixed(1), why: sim.canUpgrade(fire()), sec: Math.round((Date.now() - t0) / 1000) }));
    last = sim.day;
  }
}
console.log('MILESTONES ' + JSON.stringify(milestones) + ' barter ' + barterLog + ' war ' + JSON.stringify(warLog));
