/**
 * The skirmish: the player sends soldiers at another village with his own orders (attack, attack-move, break), with no war plan and no button of the Lều họp chiến.
 * It is still a war (a `Plan` with `skirmish`): the village stands still (tickWar), the war music plays, it is won when the village has no soldier, fire or tower
 * (warplan.winCheck, the spoils as ever) and lost when no soldier of ours is left. But it has none of the march rules: those soldiers are not in `warIds`, so no hunger,
 * tiredness, slow, tents or supply; only the research of their arm counts. An order given by mistake costs nothing: with no soldier fighting or under an attack order
 * for `WAR_DATA.skirmish.idleSeconds`, the skirmish ends by itself (no result) and the music fades. Against a boss village the boss soldiers are `bossFactor` times
 * stronger (`edge`), unless the war is a real one (a plan of the Lều họp chiến).
 */
import { WAR_DATA } from './warmarch';
import { winCheck } from './warplan';
import { tribeOf } from './tribes';
import type { Tribe } from './tribes';
import type { Plan, Villager } from './model';
import type { Sim } from './sim';

const K = WAR_DATA.skirmish;

/** The village a soldier of the world belongs to, if our orders against it count as a war: a free village or camp of bandits that is not raiding us now. */
export function foeVillage(sim: Sim, v: Villager): Tribe | undefined {
  if (v.team === 'player' || v.team === 'wild' || v.ai?.role === 'raider') return undefined;
  const t = tribeOf(sim, v.team);
  return t && t.state === 'free' && !t.raid ? t : undefined;
}

/** The free village (or camp of bandits) whose land a point is in (within `territory` tiles of its fire), if any. */
export function villageAt(sim: Sim, x: number, y: number): Tribe | undefined {
  return sim.tribes.find((t) => t.state === 'free' && !t.raid && Math.hypot(t.camp.x - x, t.camp.y - y) <= K.territory);
}

const running = (sim: Sim): Plan | undefined => sim.plans.find((p) => p.kind === 'attack' && p.status === 'running');

/** Is he one of the soldiers of the skirmish that is on: he fights what he sees and stays where the fight is, instead of going home when his order is done. */
export function inSkirmish(sim: Sim, v: Villager): boolean {
  const k = running(sim)?.skirmish;
  return !!k && k.ids.includes(v.id);
}

/** Soldiers took an order against a village: a skirmish starts, or they join the one that is on with that village. Nothing happens in a real war, or when the village is raiding us. */
export function skirmishOrder(sim: Sim, ids: readonly number[], t: Tribe): void {
  if (!ids.length || t.state !== 'free' || t.raid || sim.attackReason()) return;
  const cur = running(sim);
  if (cur) { if (cur.skirmish && cur.tribe === t.id) for (const id of ids) if (!cur.skirmish.ids.includes(id)) cur.skirmish.ids.push(id); return; }
  t.harmed = true; // our soldiers went for it: if it falls, the spoils are ours (the same as a blow struck, tribes.tribeAttacked)
  const fire = sim.campfire();
  sim.plans.push({
    id: sim.nextPlan++, kind: 'attack', tribe: t.id, missions: [], cards: [], status: 'running', stage: 'fight', startedAt: sim.time, signal: false, nextCard: 1, clears: [], result: '', endedAt: 0,
    supply: 0, carryDays: 0, supplyIds: [], stats: null, tents: [], rally: { x: (fire?.x ?? sim.world.start.x) + 1.5, y: (fire?.y ?? sim.world.start.y) + 6 }, skirmish: { ids: [...ids], idleSince: sim.time },
  });
  sim.say(`Giao tranh với ${t.def.name}!`);
}

/** Is he in the fight: he strikes or is struck, goes to attack, or breaks something of the village. */
const engaged = (v: Villager): boolean => v.phase === 'fight' || !!v.swing || !!v.breaks || v.fight.mode === 'attack' || v.fight.mode === 'attackMove';

/** Every tick of a war: the skirmish is won, lost, or let go when the player stopped fighting. */
export function tickSkirmish(sim: Sim, plan: Plan): void {
  const k = plan.skirmish;
  if (!k || plan.status !== 'running') return;
  const men = k.ids.map((id) => sim.get(id)).filter((v): v is Villager => !!v && v.team === 'player' && v.health > 0);
  k.ids = men.map((v) => v.id);
  const t = sim.tribes.find((x) => x.id === plan.tribe);
  if (!t) { end(sim, plan, 'lost'); return; }
  if (winCheck(sim, plan, t)) { end(sim, plan, 'won'); return; }
  if (!men.length) { sim.say('Thua trận: quân ta không còn ai.'); sim.addAlert('notice', 'Thua trận: quân ta không còn ai.'); end(sim, plan, 'lost'); return; }
  if (men.some(engaged)) { k.idleSince = sim.time; return; }
  if (sim.time - k.idleSince >= K.idleSeconds) { sim.say('Không còn giao tranh: quân về trại.'); end(sim, plan, ''); }
}

function end(sim: Sim, plan: Plan, result: Plan['result']): void {
  plan.status = 'done'; plan.endedAt = sim.time;
  if (result) plan.result = result; else plan.result = '';
  sim.sendBack(plan.skirmish?.ids ?? []); // the army that went out goes back into its camps
}

/** Once the war is over: the plans of the skirmishes are not kept (they are not plans to edit or send again). */
export function cleanup(sim: Sim): void {
  for (let i = sim.plans.length - 1; i >= 0; i--) if (sim.plans[i].skirmish && sim.plans[i].status !== 'running') sim.plans.splice(i, 1);
}

/** The strength of a blow between the soldiers of a boss village and ours in a skirmish: they hit `bossFactor` times harder and take that much less. 1 for anything else. */
export function edge(sim: Sim, from: Villager | undefined, to: Villager): number {
  const plan = running(sim);
  if (!plan?.skirmish || !plan.tribe) return 1;
  const t = tribeOf(sim, plan.tribe as never);
  if (!t || !(t.boss || t.tier === 'boss')) return 1;
  if (from && from.team === plan.tribe) return K.bossFactor;
  return to.team === plan.tribe ? 1 / K.bossFactor : 1;
}
