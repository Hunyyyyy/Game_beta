/**
 * The tents of a war (lều hành quân, data/war.json `tent`). Each squad needs one to sleep: without it the soldiers cannot rest and their energy runs down
 * (and the weaker they get, see Sim.tiredPenalty). The supply soldiers raise a tent when night falls and the squad stands still, and take it down in the
 * morning or when the squad moves on, getting back `refund` of its goods. A tent left behind is lost. The goods come from the packs of the supply soldiers.
 * A tent is not a building: it is a record in `Plan.tents`, drawn by the renderer; the soldiers lie down beside it.
 */
import { WAR_DATA } from './warmarch';
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

/** The goods in the packs of the supply soldiers. */
const packs = (sim: Sim, plan: Plan): Villager[] => plan.supplyIds.map((id) => sim.get(id)).filter((v): v is Villager => !!v && v.health > 0 && !!v.pack);
const have = (crew: Villager[], res: 'wood' | 'hide'): number => crew.reduce((n, v) => n + (v.pack?.[res] ?? 0), 0);

/** Take goods out of the packs, from the first that has some. */
function take(crew: Villager[], res: 'wood' | 'hide', n: number): void {
  for (const v of crew) { if (n <= 0) break; const k = Math.min(v.pack?.[res] ?? 0, n); if (k > 0) { v.pack![res] -= k; n -= k; } }
}

/** Put goods back into the packs, up to what each can carry (the rest is lost). */
function give(crew: Villager[], res: 'wood' | 'hide', n: number): void {
  const room = (v: Villager) => WAR_DATA.supply.load / WAR_DATA.tent.weight - (v.pack ? (v.pack.wood + v.pack.hide) : 0);
  for (const v of crew) { if (n <= 0) break; const k = Math.min(Math.max(0, room(v)), n); if (k > 0) { v.pack![res] += k; n -= k; } }
}

/** Whether the squad stands still, not in a fight: the time to pitch or strike a tent. */
function stands(sim: Sim, s: Squad): boolean {
  const us = sim.squadUnits(s);
  return us.length > 0 && !us.some((v) => v.phase === 'fight' || v.swing) && us.filter((v) => !v.path.length).length >= us.length * 0.8;
}

/** The tent a squad sleeps in, if it stands and is built. */
export const tentOf = (plan: Plan, squadId: number) => plan.tents.find((t) => t.squad === squadId && t.built);

/** Whether this soldier lies down to sleep now: it is night and his squad's tent is up beside him (the supply soldiers sleep by any tent of the army). */
export function sleepsInTent(sim: Sim, v: Villager): boolean {
  if (!sim.resting) return false;
  const plan = sim.plans.find((p) => p.kind === 'attack' && p.status === 'running');
  if (!plan) return false;
  const near = WAR_DATA.tent.near;
  if (v.job === 'supply') return plan.tents.some((t) => t.built && Math.hypot(t.x - v.x, t.y - v.y) < near);
  const t = tentOf(plan, v.squad);
  return !!t && Math.hypot(t.x - v.x, t.y - v.y) < near;
}

/** Once a second: pitch the tents at night, build them, and strike them in the morning or when the squad moves. */
export function tickTents(sim: Sim, plan: Plan): void {
  const crew = packs(sim, plan), cost = tentCost(sim), k = WAR_DATA.tent;
  for (const s of tentSquads(sim, plan)) {
    const c = sim.squadCenter(s); if (!c) continue;
    const tent = plan.tents.find((t) => t.squad === s.id), still = stands(sim, s);
    if (!tent) {
      if (!sim.resting || !still || !crew.length || have(crew, 'wood') < cost.wood || have(crew, 'hide') < cost.hide) continue;
      take(crew, 'wood', cost.wood); take(crew, 'hide', cost.hide);
      plan.tents.push({ squad: s.id, x: c.x, y: c.y, progress: 0, built: false });
      sim.say(`Hậu cần dựng lều cho ${s.name}.`);
      continue;
    }
    if (!tent.built) {
      if (!still) { plan.tents.splice(plan.tents.indexOf(tent), 1); continue; } // the squad moved off before it stood: the goods are lost
      const builders = crew.filter((v) => Math.hypot(v.x - tent.x, v.y - tent.y) < k.near).length;
      tent.progress += builders / k.buildSeconds;
      if (tent.progress >= 1) { tent.built = true; sim.say(`Lều của ${s.name} đã dựng xong: lính có chỗ ngủ.`); }
      continue;
    }
    // built: struck in the morning or when the squad is going on; got back if the army is near, lost if it left it behind
    if (!sim.resting || !still) {
      plan.tents.splice(plan.tents.indexOf(tent), 1);
      if (Math.hypot(c.x - tent.x, c.y - tent.y) < k.near && crew.length) { give(crew, 'wood', cost.wood * k.refund); give(crew, 'hide', cost.hide * k.refund); sim.say(`Hậu cần tháo lều của ${s.name}, thu lại ${Math.floor(cost.wood * k.refund)} gỗ, ${Math.floor(cost.hide * k.refund)} da.`); }
      else sim.say(`Lều của ${s.name} bị bỏ lại.`);
    }
  }
  plan.tents = plan.tents.filter((t) => sim.squadById(t.squad)); // a squad that is gone leaves its tent
}

/** The lines of the war council about the tents. */
export function tentLines(sim: Sim, plan: Plan, carry: { wood: number; hide: number }): string[] {
  const n = tentSquads(sim, plan).length, cost = tentCost(sim), out: string[] = [];
  if (!n) return out;
  out.push(`Lều: mỗi đội cần một lều để ngủ, tốn ${cost.wood} gỗ + ${cost.hide} da (nhà chính cấp ${sim.campfire()?.level ?? 1}). ${n} đội cần ${n * cost.wood} gỗ + ${n * cost.hide} da; hậu cần dựng lều khi trời tối và tháo khi đi tiếp, thu lại ${Math.round(WAR_DATA.tent.refund * 100)}%.`);
  const enough = Math.min(Math.floor(carry.wood / Math.max(1, cost.wood)), Math.floor(carry.hide / Math.max(1, cost.hide)));
  if (enough < n) out.push(`⚠ Chỉ mang đủ vật liệu cho ${enough}/${n} lều: ${n - enough} đội sẽ không ngủ được, sức tụt dần và yếu đi (tới ${Math.round(WAR_DATA.tired.maxPenalty * 100)}%).`);
  return out;
}
