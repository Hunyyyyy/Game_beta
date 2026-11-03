/**
 * The tents of a war (lều hành quân, data/war.json `tent`). Each squad needs one to sleep: without it the soldiers cannot rest and their energy runs down
 * (and the weaker they get, see Sim.tiredPenalty). The supply soldiers raise a tent when night falls and the squad stands still, and take it down in the
 * morning or when the squad moves on, getting back `refund` of its goods. A tent left behind is lost. The goods come from the packs of the supply soldiers.
 * A tent is not a building: it is a record in `Plan.tents`, drawn by the renderer; the soldiers lie down beside it.
 */
import { supplyLoad, WAR_DATA } from './warmarch';
import { statBonus } from './research';
import type { Plan, Squad, Villager } from './model';
import type { Sim } from './sim';

export interface TentCost { wood: number; hide: number }

/** What one tent costs: more with the level of the main house (the campfire), since a bigger war needs a bigger camp. */
export function tentCost(sim: Sim): TentCost {
  const k = WAR_DATA.tent, level = sim.campfire()?.level ?? 1, f = 1 + k.perLevel * (level - 1);
  return { wood: Math.round(k.woodBase * f), hide: Math.round(k.hideBase * f) };
}

/** The squads of the plan that have soldiers. */
export const tentSquads = (sim: Sim, plan: Plan): Squad[] => plan.missions.map((m) => sim.squadById(m.squad)).filter((s): s is Squad => !!s && sim.squadUnits(s).length > 0);

/** The id the supply soldiers' own tent goes by in `Plan.tents` (the squads have ids from 1). */
export const SUPPLY_TENT = -1;
/** How many tents the plan needs: one for each squad that has soldiers, and one of its own for the supply soldiers. */
export const tentCount = (sim: Sim, plan: Plan): number => tentSquads(sim, plan).length + (plan.supply > 0 || plan.supplyIds.length ? 1 : 0);

/** The goods in the packs of the supply soldiers. */
const supplyCrew = (sim: Sim, plan: Plan): Villager[] => plan.supplyIds.map((id) => sim.get(id)).filter((v): v is Villager => !!v && v.health > 0);
const packs = (sim: Sim, plan: Plan): Villager[] => plan.supplyIds.map((id) => sim.get(id)).filter((v): v is Villager => !!v && v.health > 0 && !!v.pack);
const have = (crew: Villager[], res: 'wood' | 'hide'): number => crew.reduce((n, v) => n + (v.pack?.[res] ?? 0), 0);

/** Take goods out of the packs, from the first that has some. */
function take(crew: Villager[], res: 'wood' | 'hide', n: number): void {
  for (const v of crew) { if (n <= 0) break; const k = Math.min(v.pack?.[res] ?? 0, n); if (k > 0) { v.pack![res] -= k; n -= k; } }
}

/** Put goods back into the packs, up to what each can carry (the rest is lost). */
function give(crew: Villager[], res: 'wood' | 'hide', n: number, load: number): void {
  const room = (v: Villager) => load / WAR_DATA.tent.weight - (v.pack ? (v.pack.wood + v.pack.hide) : 0);
  for (const v of crew) { if (n <= 0) break; const k = Math.min(Math.max(0, room(v)), n); if (k > 0) { v.pack![res] += k; n -= k; } }
}

/** Whether the squad stands still, not in a fight: the time to pitch or strike a tent. */
export function stands(sim: Sim, s: Squad): boolean {
  const us = sim.squadUnits(s);
  return us.length > 0 && !us.some((v) => v.phase === 'fight' || v.swing) && us.filter((v) => !v.path.length).length >= us.length * 0.8;
}

/** The tent a squad sleeps in, if it stands and is built. */
export const tentOf = (plan: Plan, squadId: number) => plan.tents.find((t) => t.squad === squadId && t.built);

/** Whether the squad is to be in its tent now: only when the player told it to rest (night alone puts up no tent). */
export const restsNow = (sim: Sim, plan: Plan, squadId: number): boolean => !!plan.missions.find((m) => m.squad === squadId)?.resting;

/** Whether this soldier lies down to sleep now: his squad is to rest and its tent is up beside him (the supply soldiers sleep by any tent of the army, when any squad rests). */
export function sleepsInTent(sim: Sim, v: Villager): boolean {
  const plan = sim.plans.find((p) => p.kind === 'attack' && p.status === 'running');
  if (!plan) return false;
  const supply = v.job === 'supply';
  if (supply ? !plan.missions.some((m) => m.resting) : !restsNow(sim, plan, v.squad)) return false;
  const t = tentOf(plan, supply ? SUPPLY_TENT : v.squad);
  return !!t && Math.hypot(t.x - v.x, t.y - v.y) < WAR_DATA.tent.near;
}

/** Soldiers lie down inside a tent of the army (out of sight) and come out when they wake: the supply soldiers in any tent, the others in the tent of their squad. Called for each soldier of the war every tick. */
export function shelter(sim: Sim, v: Villager): void {
  const plan = sim.plans.find((p) => p.kind === 'attack' && p.status === 'running');
  const tent = plan?.tents.filter((t) => t.built && t.squad === (v.job === 'supply' ? SUPPLY_TENT : v.squad)).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
  if (v.phase === 'sleep' && tent && Math.hypot(tent.x - v.x, tent.y - v.y) < WAR_DATA.tent.near) { v.inTent = true; v.path = []; v.slide = null; v.x = tent.x; v.y = tent.y; return; }
  if (v.inTent) { v.inTent = false; if (tent) { v.x = tent.x + 1; v.y = tent.y + 1; } } // woken: steps out beside the tent
}

/** How long without an enemy near, in seconds, before a resting squad that was woken by a raid lies down in its tent again. */
const CALM = 30;
/**
 * A raid on a squad at rest: the soldiers it woke are up and fighting; once no enemy has been near for CALM seconds they lie down again in their tent.
 * (The supply soldiers never get up for it.) Run once a second.
 */
function calm(sim: Sim, plan: Plan): void {
  for (const m of plan.missions) {
    const s = m.resting ? sim.squadById(m.squad) : undefined; if (!s) continue;
    const us = sim.squadUnits(s), c = sim.squadCenter(s); if (!c) continue;
    if (sim.foes.some((f) => f.health > 0 && f.team !== 'wild' && Math.hypot(f.x - c.x, f.y - c.y) < 16)) { m.alertAt = sim.time; continue; }
    if (m.alertAt !== undefined && sim.time - m.alertAt >= CALM) for (const v of us) if (v.nightOwl) { // no one near for a while: back to the tent, and to bed
      const tent = tentOf(plan, m.squad);
      v.fight.target = null; v.fight.mode = 'hold'; v.fight.anchor = { x: v.x, y: v.y };
      if (tent && Math.hypot(tent.x - v.x, tent.y - v.y) > 4) sim.orderMove([v.id], Math.floor(tent.x), Math.floor(tent.y));
      v.nightOwl = false;
    }
  }
}

/** Once a second: pitch the tents at night (or when a squad rests), build them, and strike them in the morning or when the squad moves. */
export function tickTents(sim: Sim, plan: Plan): void {
  const crew = packs(sim, plan), cost = tentCost(sim), k = WAR_DATA.tent;
  const anyRest = plan.missions.some((m) => m.resting);
  // who has a tent: each squad with soldiers, and the supply soldiers as one more (they stand still when none of them walks or fights)
  const owners: Array<{ id: number; name: string; at: { x: number; y: number } | null; still: boolean; rest: boolean }> = tentSquads(sim, plan).map((s) => ({ id: s.id, name: s.name, at: sim.squadCenter(s), still: stands(sim, s), rest: restsNow(sim, plan, s.id) }));
  const sup = supplyCrew(sim, plan);
  if (sup.length) owners.push({ id: SUPPLY_TENT, name: 'hậu cần', at: { x: sup.reduce((a, v) => a + v.x, 0) / sup.length, y: sup.reduce((a, v) => a + v.y, 0) / sup.length }, still: !sup.some((v) => v.phase === 'fight' || v.swing) && (sup.filter((v) => !v.path.length).length >= sup.length * 0.8 || (anyRest && owners.every((x) => x.still))), rest: anyRest });
  const housed = owners.filter((x) => x.id !== SUPPLY_TENT && x.rest).every((x) => plan.tents.some((t) => t.squad === x.id && t.built));
  calm(sim, plan);
  for (const o of owners) {
    const c = o.at; if (!c) continue;
    const tent = plan.tents.find((t) => t.squad === o.id), name = o.id === SUPPLY_TENT ? 'đội hậu cần' : o.name;
    // the supply soldiers put up the tents of the squads first and their own last: until the squads have theirs they have no time to lie down
    if (o.id === SUPPLY_TENT && !tent && !housed) continue;
    if (o.id === SUPPLY_TENT && tent && !tent.built && !housed) continue;
    if (!tent) {
      if (!o.rest || !o.still || !crew.length || have(crew, 'wood') < cost.wood || have(crew, 'hide') < cost.hide) continue;
      take(crew, 'wood', cost.wood); take(crew, 'hide', cost.hide);
      plan.tents.push({ squad: o.id, x: c.x, y: c.y, progress: 0, built: false });
      sim.say(`Hậu cần dựng lều cho ${name}.`);
      continue;
    }
    if (!tent.built) {
      if (!o.rest) { plan.tents.splice(plan.tents.indexOf(tent), 1); continue; } // it went on before the tent stood: the goods are lost
      const builders = crew.filter((v) => Math.hypot(v.x - tent.x, v.y - tent.y) < k.buildReach).length; // only those standing at it build it
      tent.progress += sim.dev.freeWorks ? 1 : (builders * (1 + statBonus(sim.researched, 'march_army', 'mbuild') / 100)) / k.buildSeconds; // takes time: the more supply soldiers at it and the better the research, the quicker
      if (tent.progress >= 1) { tent.built = true; sim.say(`Lều của ${name} đã dựng xong: có chỗ ngủ.`); }
      continue;
    }
    // built: struck in the morning or when it is going on; got back if it is near, lost if it left the tent behind
    if (!o.rest) { // struck only when the squad goes on (a fight on the spot does not take its tent down)
      plan.tents.splice(plan.tents.indexOf(tent), 1);
      if (Math.hypot(c.x - tent.x, c.y - tent.y) < k.near && crew.length) { give(crew, 'wood', cost.wood * k.refund, supplyLoad(sim)); give(crew, 'hide', cost.hide * k.refund, supplyLoad(sim)); sim.say(`Hậu cần tháo lều của ${name}, thu lại ${Math.floor(cost.wood * k.refund)} gỗ, ${Math.floor(cost.hide * k.refund)} da.`); }
      else sim.say(`Lều của ${name} bị bỏ lại.`);
    }
  }
  plan.tents = plan.tents.filter((t) => t.squad === SUPPLY_TENT ? sup.length > 0 : sim.squadById(t.squad)); // a squad that is gone leaves its tent
}

/** The lines of the war council about the tents. */
export function tentLines(sim: Sim, plan: Plan, carry: { wood: number; hide: number }): string[] {
  const n = tentCount(sim, plan), cost = tentCost(sim), out: string[] = [];
  if (!n) return out;
  out.push(`Lều: mỗi đội và hậu cần cần một lều để ngủ, tốn ${cost.wood} gỗ + ${cost.hide} da (nhà chính cấp ${sim.campfire()?.level ?? 1}). ${n} đội cần ${n * cost.wood} gỗ + ${n * cost.hide} da; hậu cần dựng lều khi bạn cho đội nghỉ và tháo khi đi tiếp, thu lại ${Math.round(WAR_DATA.tent.refund * 100)}%.`);
  const enough = Math.min(Math.floor(carry.wood / Math.max(1, cost.wood)), Math.floor(carry.hide / Math.max(1, cost.hide)));
  if (enough < n) out.push(`⚠ Chỉ mang đủ vật liệu cho ${enough}/${n} lều: ${n - enough} đội sẽ không ngủ được, sức tụt dần và yếu đi (tới ${Math.round(WAR_DATA.tired.maxPenalty * 100)}%).`);
  return out;
}
