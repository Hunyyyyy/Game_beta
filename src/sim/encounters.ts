/**
 * Visitors and dialogue (doc/encounter_dialogue_design_stone_age.md): now and then a village sends someone to the gate. The visitor is a tribal civilian (`ai.guest`) who walks to a meeting point and waits;
 * the player receives them, talks (the world stands still but for what is in view, see Sim.sceneTick) and chooses; the choice costs, pays and is written to the ledger of deeds.
 * What the visitor really is (honest, a cheat, a thief...) is drawn once from their seed and saved; the player reads clues. A village system: it reaches the rest of the game only through `sim.method(...)`.
 */
import { footOf } from './buildings';
import { relationLabel } from './combat';
import {
  ENC, SCRIPTS, evalCond, fillText, initialEncounters, linesOf, revealClue, scriptOf, seedRoll, shortOf, truthOf,
  type Agent, type Captive, type ShopItem, type CondCtx, type Choice, type Cost, type EncounterState, type Effect, type Escort, type QueueItem, type Script, type Visitor,
} from './encounterdata';
import { BARTER, RES_NAME, type Res } from './resources';
import type { Sim, Villager } from './sim';
import type { Tribe } from './tribes';

export { initialEncounters };
export type { EncounterState, Visitor } from './encounterdata';

type Active = NonNullable<EncounterState['active']>;
const tribeOf = (sim: Sim, id: string): Tribe | undefined => sim.tribes.find((t) => t.id === id);
const visitorOf = (sim: Sim, id: number): Visitor | undefined => sim.encounters.visitors.find((v) => v.id === id);

/** What the village is worth in shells: its stores at the barter rates of the Chợ, and its shells. The richer it is, the likelier it draws thieves. */
const wealthOf = (sim: Sim): number => sim.stock.coin + (Object.keys(BARTER) as Array<keyof typeof BARTER>).reduce((a, r) => a + sim.stock[r] / BARTER[r], 0);

/** Write a deed to the ledger (the newest 300 are kept). */
export function addDeed(sim: Sim, key: string, tribe?: string): void {
  const st = sim.encounters;
  st.deeds.push({ key, tribe, day: sim.day });
  if (st.deeds.length > 300) st.deeds.splice(0, st.deeds.length - 300);
}

/** How many of the refugees taken in are still with us. */
function refugeesAlive(sim: Sim): number {
  const st = sim.encounters;
  st.refugees = st.refugees.filter((id) => { const x = sim.get(id); return !!x && x.team === 'player'; });
  return st.refugees.length;
}

/** What a condition of a script may ask about, for this visitor (or for no one yet). */
function ctxOf(sim: Sim, v?: Visitor): CondCtx {
  return { stock: sim.stock, day: sim.day, fireLevel: sim.fireLevel(), rel: (v && tribeOf(sim, v.tribe)?.relation) || 0, truth: v?.truth ?? 'honest', refugees: refugeesAlive(sim), soldiers: sim.villagers.filter((s) => s.job === 'fight' && s.health > 0).length, captives: sim.encounters.captives.length, room: Math.max(0, sim.popCap() - sim.villagers.length), party: v ? 1 + v.members.length : 0, flags: v?.flags ?? [], mood: v?.mood ?? 0, deeds: sim.encounters.deeds, tribe: v?.tribe };
}

// ---------------------------------------------------------------- the visits
/** Looks about once a second: the visitors on their way or waiting, the scripts that are due, and whether the next visitor is drawn. */
export function tickEncounters(sim: Sim, dt: number): void {
  const st = sim.encounters;
  tickAgents(sim, dt);
  st.clock += dt;
  if (st.clock < 1) return;
  st.clock = 0;
  for (const v of [...st.visitors]) stepVisitor(sim, v);
  tidyQueue(sim);
  if (st.visitors.length >= ENC.maxVisitors || !mayArriveNow(sim)) return;
  const due = nextDue(sim);
  if (due) { spawnVisitor(sim, due); return; }
  if (sim.day >= st.nextAt) spawnVisitor(sim);
}

/** A new day: a party of strangers comes to the gate to ask to stay (the daily arrival that used to settle by the fire); one that is still waiting is not doubled. */
export function dailyArrival(sim: Sim): void {
  const st = sim.encounters;
  if (st.queue.some((q) => q.script === 'newcomers') || st.visitors.some((x) => x.scriptId === 'newcomers')) return;
  st.queue.push({ script: 'newcomers', day: sim.day, priority: 6, maxDelay: 1 });
}

/** Visitors come in daylight, not while a war or a raid is on. */
function mayArriveNow(sim: Sim): boolean {
  if (sim.part !== 'day' || sim.tod < ENC.arrive[0] || sim.tod > ENC.arrive[1] || sim.atWar()) return false;
  return !sim.tribes.some((t) => t.raid) && !sim.events.some((e) => e.live);
}

/** A script that waited too long for a free day is dropped (a deed tells it was missed). */
function tidyQueue(sim: Sim): void {
  const st = sim.encounters;
  st.queue = st.queue.filter((q) => { if (sim.day - q.day <= q.maxDelay) return true; addDeed(sim, `missed:${q.script}`, q.tribe); return false; });
}

/** The scripts due today, most pressing first; one whose `ifStill` no longer holds is dropped. */
function nextDue(sim: Sim): QueueItem | null {
  const st = sim.encounters;
  const due = st.queue.filter((q) => q.day <= sim.day && (q.script !== 'newcomers' || sim.tod <= ENC.dailyUntil)).sort((a, b) => b.priority - a.priority || a.day - b.day);
  for (const q of due) {
    if (!scriptOf(q.script) || !evalCond(q.ifStill, ctxOf(sim)) || (q.event && !sim.events.some((e) => e.id === q.event && !e.fired))) { st.queue = st.queue.filter((x) => x !== q); continue; } // (an ultimatum about a raid that has gone off, or been called off, is no more)
    return q;
  }
  return null;
}

/** The villages that may send a visitor on this script: free, not bandits or bosses, on speaking terms. */
function sendersOf(sim: Sim, s: Script): Tribe[] {
  if (s.anywhere) return sim.tribes.filter((t) => t.state === 'free' && !t.bandit && !t.boss && t.tier !== 'boss' && t.tier !== 'rebel');
  const [lo, hi] = s.relation ?? [-100, 100];
  const ok = sim.tribes.filter((t) => t.state === 'free' && !t.bandit && !t.boss && t.tier !== 'boss' && t.tier !== 'rebel' && t.relation >= Math.max(lo, ENC.relationFloor) && t.relation <= hi);
  const named = ok.filter((t) => s.tribes?.includes(t.id));
  return named.length ? named : ok;
}

function scriptReady(sim: Sim, s: Script): boolean {
  const seen = sim.encounters.seen[s.id], fl = sim.fireLevel();
  if (fl < s.fireLevel[0] || fl > s.fireLevel[1] || sim.day < s.minDay) return false;
  if (s.maxTimes !== undefined && (seen?.times ?? 0) >= s.maxTimes) return false;
  if (s.cooldownDays !== undefined && seen && sim.day - seen.lastDay < s.cooldownDays) return false;
  return sendersOf(sim, s).length > 0;
}

/** Draw the next script: the fixed first one until it has been told, then by weight (each time it has come halves it), never the same twice in a row. Scripts that only follow another (`pursuers`) have no weight and are never drawn. */
function pickScript(sim: Sim): Script | null {
  const st = sim.encounters, first = scriptOf(ENC.first.script);
  if (first && !st.seen[first.id] && scriptReady(sim, first)) return first;
  let pool = SCRIPTS.filter((s) => s.weight > 0 && scriptReady(sim, s));
  if (ENC.repeat.noSameTwice && pool.length > 1) pool = pool.filter((s) => s.id !== st.last);
  if (!pool.length) return null;
  const weight = (s: Script) => s.weight * ENC.repeat.weightDecayPerSeen ** (st.seen[s.id]?.times ?? 0);
  let r = sim.frnd() * pool.reduce((a, s) => a + weight(s), 0), pick = pool[0];
  for (const s of pool) { r -= weight(s); if (r <= 0) { pick = s; break; } }
  return pick;
}

/** Send a visitor: for a due script of the queue, or the one drawn now. */
function spawnVisitor(sim: Sim, due?: QueueItem): void {
  const st = sim.encounters;
  const script = due ? scriptOf(due.script) : pickScript(sim);
  if (due) st.queue = st.queue.filter((x) => x !== due);
  if (!script) { if (!due) st.nextAt = sim.day + 1; return; }
  let t: Tribe | undefined;
  if (due?.tribe) { t = tribeOf(sim, due.tribe); if (!t || t.state !== 'free') return; } // the village is gone: the script goes with it
  else { const senders = sendersOf(sim, script); t = senders[Math.floor(sim.frnd() * senders.length)]; }
  if (!t) { if (!due) st.nextAt = sim.day + 1; return; }
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  const dx = t.camp.x - fx, dy = t.camp.y - fy, len = Math.max(1, Math.hypot(dx, dy)), ux = dx / len, uy = dy / len;
  if (!due) { const gap = ENC.gapDays[String(Math.min(3, sim.fireLevel()))] ?? [3, 5]; st.nextAt = sim.day + gap[0] + Math.floor(sim.frnd() * (gap[1] - gap[0] + 1)); }
  // where they appear, and where the meeting is
  const dist = Math.min(ENC.spawnDist, len), sp = sim.nearestFree(Math.floor(fx + ux * dist), Math.floor(fy + uy * dist), new Set());
  if (!sp) { if (!due) st.nextAt = sim.day + 1; return; }
  const along = (b: { x: number; y: number }) => (b.x - fx) * ux + (b.y - fy) * uy;
  // the gate that looks most toward their village; they wait OUTSIDE it: out through the side of the wall the gate is in (away from the fire), never at the tribe's bearing, which can point into the village
  const faces = (b: (typeof sim.buildings)[number]) => { const d = footOf(b), gx = b.x + d.w / 2 - fx, gy = b.y + d.h / 2 - fy; return (gx * ux + gy * uy) / Math.max(1, Math.hypot(gx, gy)); };
  const gate = sim.buildings.filter((b) => b.kind === 'gate' && b.done).sort((a, b) => faces(b) - faces(a))[0];
  const outside = (b: (typeof sim.buildings)[number]): [number, number] => {
    const d = footOf(b), cx = b.x + d.w / 2, cy = b.y + d.h / 2;
    return d.w >= d.h ? [cx, cy + (cy >= fy ? 1 : -1) * ENC.gateOut] : [cx + (cx >= fx ? 1 : -1) * ENC.gateOut, cy];
  };
  // with no gate they stand just outside the outermost work on their side (a fence counts), always inside what we see
  const edge = sim.buildings.reduce((m, b) => (b.done ? Math.max(m, along(b)) : m), 0);
  const reach = Math.max(ENC.meetMin, Math.min(ENC.meetMax, edge + ENC.meetInset, sim.visionRadius() - 2));
  const [wx, wy] = gate ? outside(gate) : [fx + ux * reach, fy + uy * reach];
  const mp = sim.nearestFree(Math.floor(wx), Math.floor(wy), new Set()) ?? [Math.floor(wx), Math.floor(wy)];
  const id = st.nextId++, seed = Math.floor(sim.frnd() * 2147483647), truth = truthOf(script, seed, wealthOf(sim));
  const f = sim.makeVillager(sp[0], sp[1], sim.frnd() < 0.5 ? 'm' : 'f', t.id, sim.frnd);
  f.look.hide = t.def.look.hide; f.look.pants = t.def.look.pants;
  f.ai = { role: 'civ', camp: t.camp, wander: 0, goal: null, raid: 0, guest: id };
  sim.addFoe(f); // not in the tribe's list of units: the village's own bookkeeping (sleep, rescale) leaves a guest alone
  st.last = script.id;
  // the party: the visitor speaks for them; the others walk behind and stand about the meeting point
  const members: number[] = [], spots: Array<[number, number]> = [], P = script.party, N = sim.world.size;
  if (P) {
    const n = P.size[0] + Math.floor(seedRoll(seed, 'party') * (P.size[1] - P.size[0] + 1)), takenS = new Set([sp[1] * N + sp[0]]), takenM = new Set([mp[1] * N + mp[0]]);
    sim.armFoe(f, P.weapons?.[0] ?? null, !!P.armor, 1);
    for (let i = 1; i < n; i++) {
      const s = sim.nearestFree(sp[0], sp[1], takenS) ?? sp, m = sim.nearestFree(mp[0], mp[1], takenM) ?? mp;
      takenS.add(s[1] * N + s[0]); takenM.add(m[1] * N + m[0]);
      const g = sim.makeVillager(s[0], s[1], sim.frnd() < 0.5 ? 'm' : 'f', t.id, sim.frnd);
      g.look.hide = t.def.look.hide; g.look.pants = t.def.look.pants;
      g.ai = { role: 'civ', camp: t.camp, wander: 0, goal: null, raid: 0, guest: id };
      sim.addFoe(g); sim.armFoe(g, P.weapons?.[i % P.weapons.length] ?? null, !!P.armor, P.hurt ?? 1);
      members.push(g.id); spots.push([m[0] + 0.5, m[1] + 0.5]);
    }
  }
  st.visitors.push({ id, scriptId: script.id, tribe: t.id, unitId: f.id, truth, seed, state: 'walking', mx: mp[0] + 0.5, my: mp[1] + 0.5, hx: sp[0] + 0.5, hy: sp[1] + 0.5, arrivedAt: 0, expiresAt: 0, stuck: 0, notes: [], used: [], members, spots, join: '', agents: [], escort: [], placed: false, provoked: false, event: due?.event, gate: gate?.id, watch: gate ? [gate.x + footOf(gate).w / 2, gate.y + footOf(gate).h / 2] : [fx, fy] });
}

/** One second of a visitor's life: the walk, the wait (it ends), the walk home. */
function stepVisitor(sim: Sim, v: Visitor): void {
  const f = sim.get(v.unitId);
  if (!f || f.health <= 0 || f.team === 'player') { if (v.provoked && promote(sim, v)) return; dropVisitor(sim, v, true); return; } // killed, or gone with the village: the rest of the party goes out of sight (one that is walking away after a blow goes on)
  stepMembers(sim, v);
  if (v.state === 'walking') {
    stepGuards(sim, v, f);
    if (v.state !== 'walking') return; // the guards have stopped them
    if (Math.hypot(f.x - v.mx, f.y - v.my) < 1.6) { arrive(sim, v, f, false); return; }
    if (!f.path.length) {
      f.path = sim.pathTo(f, Math.floor(v.mx), Math.floor(v.my), 3000);
      if (!f.path.length && ++v.stuck > 20) { f.x = v.mx; f.y = v.my; arrive(sim, v, f, false); } // no way through: they stand at the meeting point
    }
  } else if (v.state === 'visiting') {
    stepVisit(sim, v, f);
  } else if (v.state === 'waiting') {
    stepGuards(sim, v, f);
    faceOff(sim, v, f);
    if (sim.time >= v.expiresAt && sim.encounters.active?.visitorId !== v.id) { addDeed(sim, `ignored:${v.scriptId}`, v.tribe); sim.say(`${f.name} đợi mãi không ai tiếp và bỏ đi.`); leave(sim, v, f); }
  } else if (Math.hypot(f.x - v.hx, f.y - v.hy) < 2 || sim.time >= v.expiresAt) retire(sim, v);
  else if (!f.path.length && !isAgent(v, f.id)) f.path = sim.pathTo(f, Math.floor(v.hx), Math.floor(v.hy), 3000);
}

/** The visitors stand and wait to be received: at the meeting point, or (`held`) where the guards stopped them. This is the moment the player is told. */
function arrive(sim: Sim, v: Visitor, f: Villager, held: boolean): void {
  const t = tribeOf(sim, v.tribe), s = scriptOf(v.scriptId), many = v.members.length > 0;
  v.state = 'waiting'; v.arrivedAt = sim.time; v.expiresAt = sim.time + (s?.waitDays ?? ENC.waitDays[v.scriptId] ?? ENC.waitDays.default) * sim.dayLen;
  f.path = []; f.facing = 'front';
  v.members.forEach((id, i) => { const m = sim.get(id); if (m && v.stuck > 20) { m.x = v.spots[i]?.[0] ?? v.mx; m.y = v.spots[i]?.[1] ?? v.my; m.path = []; } });
  const name = t?.def.name ?? 'Một làng', text = held ? `Lính gác chặn ${many ? 'một toán người lạ' : 'một người lạ'} của ${name} trước cổng.` : `${name} có người lạ đến cổng.`;
  sim.say(text); sim.addAlert('notice', text);
  makeAgents(sim, v);
  if (sim.speed > 1) sim.speed = 1; // fast-forward drops to the plain pace so the guest is not missed
}

function leave(sim: Sim, v: Visitor, f: Villager): void {
  releaseGuards(sim, v);
  v.state = 'leaving'; v.expiresAt = sim.time + ENC.leaveGiveUp; f.path = sim.pathTo(f, Math.floor(v.hx), Math.floor(v.hy), 3000);
}

// ---------------------------------------------------------------- the guards
/** The post a soldier keeps: a guard of the Trại lính gác has his own (`guardAt`); any other soldier stands guard where his last order sent him (`fight.anchor`). */
const postOf = (g: Villager): { x: number; y: number } | null => (g.guard && g.guardAt ? g.guardAt : g.fight.anchor);

/** The guards of the gate the strangers come to (at most `guards.send`) who are free to go out: out of camp, awake and on their feet, not fighting, not under an order of the player, not sent already. A village with no gate, or a gate with no guard, sends nobody. */
function freeGuards(sim: Sim, v: Visitor): Villager[] {
  if (v.gate === undefined) return [];
  const sent = new Set(sim.encounters.visitors.flatMap((x) => x.escort.map((e) => e.id)));
  return sim.villagers.filter((g) => g.gate === v.gate && g.guard && g.job === 'fight' && g.health > g.maxHealth * 0.5 && g.inside === null && g.down <= 0 && g.phase !== 'sleep' && g.fight.target === null && !g.fight.obey && !sim.warIds.has(g.id) && !sent.has(g.id)).slice(0, ENC.guards.send);
}

/** Send a soldier to a place: his post becomes that place until the visit is over (the way the player's own order does it). The escort entry remembers where to go back. */
function orderGuard(sim: Sim, g: Villager, x: number, y: number): void {
  if (sim.pathLeft < 1) sim.pathLeft = 1; // the order needs a way found now, not when the tick's budget is whole again
  sim.orderMove([g.id], Math.floor(x), Math.floor(y));
}

function sendGuard(sim: Sim, v: Visitor, g: Villager, x: number, y: number): void {
  const home = postOf(g) ?? { x: g.x, y: g.y };
  orderGuard(sim, g, x, y);
  const at = postOf(g) ?? { x, y };
  const old = v.escort.find((e) => e.id === g.id);
  if (old) { old.ax = at.x; old.ay = at.y; } else v.escort.push({ id: g.id, hx: home.x, hy: home.y, ax: at.x, ay: at.y });
}

/** The guards go out once the strangers are SEEN (they stand on ground the village sees: no one knows of them before that): the two free guards nearest the gate (the campfire when there is none), looking again every second until enough are free. When one is near them the strangers stop where they stand, and the guards close in. */
function stepGuards(sim: Sim, v: Visitor, f: Villager): void {
  const N = sim.world.size;
  // one who died, or whom the player sent elsewhere, is no longer ours to send back
  v.escort = v.escort.filter((e) => { const g = sim.get(e.id), p = g ? postOf(g) : null; return !!g && g.team === 'player' && g.health > 0 && !!p && Math.hypot(p.x - e.ax, p.y - e.ay) <= 1.5; });
  if (v.escort.length < ENC.guards.send && sim.fog.state[Math.floor(f.y) * N + Math.floor(f.x)] === 2) {
    const free = freeGuards(sim, v).slice(0, ENC.guards.send - v.escort.length);
    for (const g of free) sendGuard(sim, v, g, v.mx, v.my);
  }
  if (!v.placed && v.escort.some((e) => { const g = sim.get(e.id); return !!g && Math.hypot(g.x - f.x, g.y - f.y) <= ENC.guards.contact; })) {
    v.placed = true;
    if (v.state === 'walking') halt(sim, v, f); else placeGuards(sim, v, f); // they were on the way: stopped here; they had come already: the guards stand in front of them
  }
}

/** The guards have caught up with the visitors: they stop where they stand and the guards close in beside them. */
function halt(sim: Sim, v: Visitor, f: Villager): void {
  f.path = []; v.mx = f.x; v.my = f.y;
  v.members.forEach((id, i) => { const m = sim.get(id); if (m) { m.path = []; v.spots[i] = [m.x, m.y]; } });
  placeGuards(sim, v, f);
  arrive(sim, v, f, true);
}

/** The guards stand square in the way of the strangers, side by side a couple of tiles ahead of them: along the way they were walking (to the meeting point), or toward the gate when they are there already. Never on top of them. */
function placeGuards(sim: Sim, v: Visitor, f: Villager): void {
  const N = sim.world.size, toMeet = Math.hypot(v.mx - f.x, v.my - f.y) > 2, tx = toMeet ? v.mx : v.watch[0], ty = toMeet ? v.my : v.watch[1];
  const dx = tx - f.x, dy = ty - f.y, len = Math.max(1, Math.hypot(dx, dy)), ux = dx / len, uy = dy / len;
  const taken = new Set<number>([f, ...v.members.map((id) => sim.get(id))].filter((u): u is Villager => !!u).map((u) => Math.floor(u.y) * N + Math.floor(u.x)));
  const guards = v.escort.map((e) => sim.get(e.id)).filter((g): g is Villager => !!g);
  guards.forEach((g, k) => {
    const side = (k - (guards.length - 1) / 2) * 1.8;
    const spot = sim.nearestFree(Math.floor(f.x + ux * 2.4 - uy * side), Math.floor(f.y + uy * 2.4 + ux * side), taken) ?? [Math.floor(f.x), Math.floor(f.y)];
    taken.add(spot[1] * N + spot[0]);
    sendGuard(sim, v, g, spot[0] + 0.5, spot[1] + 0.5);
  });
}

/** Guards and visitors turn to face each other while they stand (so it reads as a stop, not as people who happen to be near). */
function faceOff(sim: Sim, v: Visitor, f: Villager): void {
  const guards = v.escort.map((e) => sim.get(e.id)).filter((g): g is Villager => !!g);
  if (!guards.length) return;
  const toward = (u: Villager, t: { x: number; y: number }) => { const dx = t.x - u.x, dy = t.y - u.y; u.facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back'; };
  for (const g of guards) if (!g.path.length && g.fight.target === null) toward(g, f);
  const near = (u: Villager) => guards.reduce((b, g) => (Math.hypot(g.x - u.x, g.y - u.y) < Math.hypot(b.x - u.x, b.y - u.y) ? g : b), guards[0]);
  for (const u of [f, ...v.members.map((id) => sim.get(id))]) if (u && !u.path.length) toward(u, near(u));
}

/** The visit is over: the soldiers go back to their posts (unless the player gave them another word meanwhile). */
function releaseGuards(sim: Sim, v: Visitor): void {
  for (const e of v.escort) {
    const g = sim.get(e.id);
    const p = g ? postOf(g) : null;
    if (g && g.team === 'player' && g.health > 0 && p && Math.hypot(p.x - e.ax, p.y - e.ay) <= 1.5) { // his post is his own again: he walks back to it when nothing is left to fight (brainplayer), and fights what comes on the way
      g.fight.mode = 'guard'; g.fight.anchor = { x: e.hx, y: e.hy }; if (g.guard) g.guardAt = { x: e.hx, y: e.hy };
    }
  }
  v.escort = [];
}

/** The rest of the party follows: to their places at the meeting point, and home when the visit is over. */
function stepMembers(sim: Sim, v: Visitor): void {
  v.members.forEach((id, i) => {
    const m = sim.get(id);
    if (!m || m.health <= 0 || m.team === 'player' || isAgent(v, id)) return; // (the ones who slip away are walked by stepAgent)
    const [tx, ty] = v.state === 'leaving' ? [v.hx, v.hy] : v.spots[i] ?? [v.mx, v.my];
    if (Math.hypot(m.x - tx, m.y - ty) > 1.2) { if (!m.path.length) m.path = sim.pathTo(m, Math.floor(tx), Math.floor(ty), 3000); } else if (!m.path.length) m.facing = 'front';
  });
}

/** The visitor is gone (or was killed): their units leave the land when `remove`, the record goes, and an open dialogue with them closes. */
function dropVisitor(sim: Sim, v: Visitor, remove: boolean): void {
  const st = sim.encounters;
  releaseGuards(sim, v);
  if (remove) for (const id of [v.unitId, ...v.members]) { const u = sim.get(id); if (u && u.team !== 'player') sim.removeFoe(u); }
  st.visitors = st.visitors.filter((x) => x.id !== v.id);
  if (st.active?.visitorId === v.id) st.active = null;
}

/** A guest was killed by us (tribes.killFoe has already taken the relation the killing costs): the deeds, the scripts that came with them are cancelled, and the next visit is put off. */
export function guestSlain(sim: Sim, unitId: number): void {
  const st = sim.encounters, v = st.visitors.find((x) => x.unitId === unitId || x.members.includes(unitId));
  if (!v || v.provoked) return; // (a blow came first and was dealt with: guestAttacked)
  if (v.truth === 'honest') { addDeed(sim, 'attacked_guest', v.tribe); addDeed(sim, 'broke_guest_right', v.tribe); st.nextAt = Math.max(st.nextAt, sim.day + ENC.slainDelayDays); }
  else sim.tribeRelationAdd(v.tribe, ENC.justifiedRefund);
  st.queue = st.queue.filter((q) => q.linkedTo !== v.id);
  sim.say(`Người lạ của ${tribeOf(sim, v.tribe)?.def.name ?? 'một làng'} đã bị giết ngay trước cổng. Những người còn lại bỏ chạy, tiếng đồn sẽ lan đi.`);
  dropVisitor(sim, v, true);
}

/** The next of the party takes the place of the one who spoke for them (false when there is none left). */
function promote(sim: Sim, v: Visitor): boolean {
  const next = v.members.find((id) => { const m = sim.get(id); return !!m && m.health > 0 && m.team !== 'player'; });
  if (next === undefined) return false;
  v.unitId = next; v.members = v.members.filter((id) => id !== next && !!sim.get(id)); v.spots = v.members.map(() => [v.hx, v.hy] as [number, number]);
  return true;
}

/** One of the strangers was struck by us. The armed ones take up the fight on the spot (a raid of their village); the others walk home. The deeds are written, what was set going with them is cancelled, and the next visit is put off. */
export function guestAttacked(sim: Sim, unitId: number): void {
  const st = sim.encounters, v = st.visitors.find((x) => x.unitId === unitId || x.members.includes(unitId));
  if (!v || v.provoked) return;
  const runner = v.agents.find((a) => a.id === unitId && a.phase === 'run' && (a.loot || a.captive !== undefined));
  if (runner) catchAgent(sim, v, runner); // one who runs with what he took gives up at the first blow; the rest of the party answer the blow as below
  v.provoked = true;
  // what the blow costs depends on what they were: the honest are owed a guest's right; a cheat, a thief, a kidnapper or an envoy who came to threaten were not
  if (v.truth === 'honest') { addDeed(sim, 'attacked_guest', v.tribe); addDeed(sim, 'broke_guest_right', v.tribe); st.nextAt = Math.max(st.nextAt, sim.day + ENC.slainDelayDays); }
  else sim.tribeRelationAdd(v.tribe, ENC.justifiedRefund);
  st.queue = st.queue.filter((q) => q.linkedTo !== v.id);
  if (st.active?.visitorId === v.id) st.active = null;
  const name = tribeOf(sim, v.tribe)?.def.name ?? 'một làng', units = [v.unitId, ...v.members].map((id) => sim.get(id)).filter((u): u is Villager => !!u && u.health > 0 && u.team !== 'player' && u.id !== runner?.id);
  // the armed answer with arms, unless our soldiers about them are many times what they are: then all of them run
  const armedAll = units.filter((u) => !!u.weapon), at = units[0] ?? { x: v.mx, y: v.my };
  const ours = sim.villagers.filter((s) => s.job === 'fight' && s.health > 0 && Math.hypot(s.x - at.x, s.y - at.y) <= ENC.provoke.radius);
  const outmatched = armedAll.length > 0 && sim.fightValue(ours) >= sim.fightValue(armedAll) * ENC.provoke.fleeRatio;
  const armed = outmatched ? [] : armedAll, calm = units.filter((u) => !armed.includes(u));
  for (const a of v.agents) { const u = sim.get(a.id); if (a.phase === 'go' && u) startRun(sim, v, a, u); else if (a.phase === 'wait') a.phase = 'done'; } // the ones who slip away give up what they came for and run
  if (armed.length) { sim.guestsToRaid(v.tribe, armed.map((u) => u.id)); const text = `Người lạ của ${name} bị tấn công! Những người có vũ khí xông vào đánh trả.`; sim.say(text); sim.addAlert('raid', text); }
  else sim.say(outmatched ? `Người lạ của ${name} thấy quân ta đông hơn nhiều, bỏ chạy.` : `Người lạ của ${name} bị tấn công và bỏ chạy.`);
  if (!calm.length) { dropVisitor(sim, v, false); return; } // all of them took up arms: no visit is left
  v.unitId = calm[0].id; v.members = calm.slice(1).map((u) => u.id); v.spots = v.members.map(() => [v.hx, v.hy] as [number, number]);
  leave(sim, v, calm[0]); // the rest walk home (the guards go back to their posts)
}

// ---------------------------------------------------------------- the dialogue
export interface EncounterChoice { index: number; text: string; /** The group it is folded under on the screen, if any. */ group?: string; price: Array<{ res: Res; n: number }>; /** Why it cannot be taken now; empty when it can. */ blocked: string }
export interface EncounterView {
  visitorId: number; unitId: number; name: string; tribe: string; tribeId: string; relation: string; sex: 'm' | 'f';
  /** What the player has just said (shown as a small bubble above the visitor's words, with them: no page of its own). */ you?: string;
  /** What the visitor says now, line by line. */ lines: Array<{ by: 'npc' | 'you'; text: string }>; line: number; choices: EncounterChoice[]; /** The clues seen so far, words filled in; the first says who came along. */ notes: string[]; /** How many are in the party. */ party: number;
  /** The key of the scene (who and which node): a new one rebuilds the screen. `rev` changes when only the notes or the choices do. */ key: string; rev: number;
}
/** A visitor waiting at the meeting point (for the notices and the screen). */
export interface Guest { id: number; unitId: number; unitIds: number[]; /** The guards are holding them. */ held: boolean; /** They were caught running with what they took and wait to be judged. */ caught: boolean; name: string; tribe: string; x: number; y: number; daysLeft: number }

/** The visitors who wait at the meeting point to be received. */
export function guestsWaiting(sim: Sim): Guest[] {
  const out: Guest[] = [];
  for (const v of sim.encounters.visitors) {
    const f = v.state === 'waiting' ? sim.get(v.unitId) : undefined;
    if (f) out.push({ id: v.id, unitId: f.id, unitIds: [f.id, ...v.members], held: v.placed, caught: !!v.caught, name: f.name, tribe: tribeOf(sim, v.tribe)?.def.name ?? '', x: f.x, y: f.y, daysLeft: Math.max(0, (v.expiresAt - sim.time) / sim.dayLen) });
  }
  return out;
}

/** One of the merchant's goods as it is shown (a bargain is the extra one, at a low price). */
type Offer = ShopItem & { bargain?: boolean };

/** The goods a merchant shows: `show` of the era drawn by his seed (gear and lots of goods alike), and sometimes one more, a bargain. What was bought is no longer shown. */
function shopItems(sim: Sim, v: Visitor, s: Script): Offer[] {
  const S = s.shop;
  if (!S) return [];
  const k = 1 - (S.moodPrice ?? 0) * Math.max(-3, Math.min(3, v.mood ?? 0)), cost = (p: number): number => Math.max(1, Math.round(p * k));
  const pool = S.items.filter((i) => i.era === sim.era).sort((a, b) => seedRoll(v.seed, `shop:${a.id}`) - seedRoll(v.seed, `shop:${b.id}`)), out: Offer[] = pool.slice(0, S.show).map((i) => ({ ...i, price: cost(i.price) }));
  if (S.bonus && pool.length > S.show && seedRoll(v.seed, 'bonus') < S.bonus.chance) out.push({ ...pool[S.show], price: cost(pool[S.show].price * S.bonus.price), bargain: true });
  return out.filter((i) => !(v.sold ?? []).includes(i.id));
}

/** The choices of a node: for a shop, a choice for each good, then the node's own. */
function nodeChoices(sim: Sim, v: Visitor, s: Script, node: Script['nodes'][string] | undefined): Choice[] {
  if (!node) return [];
  const own = node.choices ?? [];
  if (!node.shop || !s.shop) return own;
  return [...shopItems(sim, v, s).map((i): Choice => ({ text: `${i.bargain ? 'Món hời: ' : ''}${i.name} — ${i.price} vỏ sò`, cost: { coin: i.price }, effects: [{ buy: i.id }], stay: true, note: `Đã trả ${i.price} vỏ sò cho ${i.name.toLowerCase()}.` })), ...own];
}

/** Receive a visitor: the dialogue opens at the start of their script. Returns an error text or null. */
export function openEncounter(sim: Sim, visitorId: number): string | null {
  const v = visitorOf(sim, visitorId), s = v ? scriptOf(v.scriptId) : undefined;
  if (!v || !s || v.state !== 'waiting') return 'Người này không còn ở cổng';
  const a: Active = { visitorId, node: s.start, line: 0 };
  sim.encounters.active = a;
  enterNode(sim, a, v, s, s.start);
  return null;
}

/** What the screen draws now (null when no dialogue is open). */
export function encounterView(sim: Sim): EncounterView | null {
  const a = sim.encounters.active, v = a ? visitorOf(sim, a.visitorId) : undefined, s = v ? scriptOf(v.scriptId) : undefined, node = a && s ? s.nodes[a.node] : undefined, f = v ? sim.get(v.unitId) : undefined;
  if (!a || !v || !s || !node || !f) return null;
  const t = tribeOf(sim, v.tribe), who = { name: f.name, tribe: t?.def.name ?? '', sex: f.look.sex }, ctx = ctxOf(sim, v), said = linesOf(node, v.seed, a.node, ctx).map((l) => fillText(l, who)), lines: Array<{ by: 'npc' | 'you'; text: string }> = (said.length ? said : ['...']).map((text) => ({ by: 'npc' as const, text }));
  const alive = v.members.map((id) => sim.get(id)).filter((m): m is Villager => !!m && m.health > 0), party = 1 + alive.length, armed = [f, ...alive].filter((m) => !!m.weapon).length;
  const partyNote = party > 1 ? `Đi cùng ${party - 1} người${armed ? `, ${armed === party ? 'ai cũng' : 'có người'} mang vũ khí` : ''}.` : '';
  const choices: EncounterChoice[] = [];
  nodeChoices(sim, v, s, node).forEach((c, index) => {
    if (!evalCond(c.cond, ctx)) return;
    const lack = shortOf(c.cost ?? {}, sim.stock);
    choices.push({ index, group: c.group, text: fillText(c.text, who), price: Object.entries(c.cost ?? {}).map(([res, n]) => ({ res: res as Res, n: n ?? 0 })), blocked: v.used.includes(`${a.node}:${index}`) ? 'Đã hỏi rồi' : lack ? `Thiếu ${RES_NAME[lack.res].toLowerCase()}: còn ${lack.have}/${lack.need}` : '' });
  });
  return {
    visitorId: v.id, unitId: f.id, name: f.name, tribe: who.tribe, tribeId: v.tribe, relation: relationLabel(t?.relation ?? 0), sex: who.sex, lines, line: Math.min(a.line, lines.length - 1), choices,
    you: a.said ? fillText(a.said, who) : undefined, party, notes: [...(v.placed ? ['Lính gác đang chặn người lạ lại trước cổng.'] : []), ...(partyNote ? [partyNote] : []), ...v.notes.map((n) => fillText(n, who))], key: `${v.id}|${a.node}`, rev: v.notes.length * 100 + v.used.length + (v.sold?.length ?? 0) * 10000,
  };
}

/** Next line; at the last line of a node with no choices the talk is over. */
export function advanceEncounter(sim: Sim): void {
  const a = sim.encounters.active, view = encounterView(sim);
  if (!a || !view) return;
  if (a.line < view.lines.length - 1) a.line++;
  else if (!view.choices.length) endTalk(sim, a.visitorId);
}

/** Take a choice: pay, do what it does, go to the next node (or end). Returns a text for the player or null. */
export function chooseEncounter(sim: Sim, index: number): string | null {
  const a = sim.encounters.active, v = a ? visitorOf(sim, a.visitorId) : undefined, s = v ? scriptOf(v.scriptId) : undefined, c = a && s && v ? nodeChoices(sim, v, s, s.nodes[a.node])[index] : undefined;
  if (!a || !v || !s || !c || !evalCond(c.cond, ctxOf(sim, v))) return 'Không có lựa chọn này';
  const key = `${a.node}:${index}`;
  if (v.used.includes(key)) return 'Đã hỏi rồi';
  const paid = c.cost ?? {}, lack = shortOf(paid, sim.stock);
  if (lack) return `Thiếu ${RES_NAME[lack.res].toLowerCase()}`;
  for (const [k, n] of Object.entries(paid)) sim.stock[k as Res] -= n ?? 0;
  for (const e of c.effects ?? []) applyEffect(sim, v, e);
  if (sim.encounters.active !== a) return null; // an effect ended the talk (the visitor joined)
  if (c.reveals) { // ask closely: it costs what it costs (the effects above), brings out a clue if there is one, and the same choices stay
    v.used.push(key); a.line = 9999;
    const clue = revealClue(s, v);
    if (clue) { v.notes.push(clue); return null; }
    return 'Bạn không nhận ra điều gì khác thường.';
  }
  if (c.stay) { a.line = 9999; return c.note ?? null; } // stays here (the shop: another piece), the payment is told
  let next = c.by?.[v.truth] ?? c.branch?.find((b) => evalCond(b.cond, ctxOf(sim, v)))?.then ?? (c.roll ? (seedRoll(v.seed, key) < Math.max(0.05, Math.min(0.95, c.roll.p + (c.roll.mood ?? 0) * (v.mood ?? 0))) ? c.roll.yes : c.roll.no) : c.then);
  const T = s.talk;
  if (T && next === '@round') { // an exchange is over: on to the next, or to the visitor's terms when they are done
    a.round = (a.round ?? 0) + 1;
    v.rounds ??= T.rounds[0] + Math.floor(seedRoll(v.seed, 'rounds') * (T.rounds[1] - T.rounds[0] + 1));
    next = a.round >= v.rounds ? T.final : T.hub;
  }
  if (T?.walkout && T.below !== undefined && (v.mood ?? 0) <= T.below && a.node !== T.final && next !== T.walkout && s.nodes[T.walkout]) next = T.walkout; // too harsh: he ends the talk himself
  if (next && s.nodes[next]) {
    a.said = c.say; // what the player said is a bubble over the visitor's answer
    enterNode(sim, a, v, s, next);
  } else endTalk(sim, v.id);
  return null;
}

/** "Để sau": close the dialogue without choosing. The world runs again and the visitor keeps waiting. */
export function putOffEncounter(sim: Sim): void {
  const a = sim.encounters.active, v = a ? visitorOf(sim, a.visitorId) : undefined, s = v ? scriptOf(v.scriptId) : undefined;
  if (a && s && !s.nodes[a.node]?.choices?.length) endTalk(sim, a.visitorId); // nothing is left to choose: the answer was given, so the talk is over
  else sim.encounters.active = null;
}

/** Go to a node: its effects run as it is entered. */
function enterNode(sim: Sim, a: Active, v: Visitor, s: Script, id: string): void {
  a.node = id; a.line = 0;
  for (const e of s.nodes[id]?.effects ?? []) { applyEffect(sim, v, e); if (sim.encounters.active !== a) return; }
}

/** Relation gained from a village: each kindness in the last days counts for less, and a village gives only so much in a few days. Losses go through whole. */
function gainRelation(sim: Sim, tribe: string, n: number): void {
  if (n <= 0) { sim.tribeRelationAdd(tribe, n); return; }
  const st = sim.encounters, G = ENC.relationGain;
  st.gains = st.gains.filter((g) => sim.day - g.day <= G.windowDays);
  const mine = st.gains.filter((g) => g.tribe === tribe), recentSum = mine.filter((g) => sim.day - g.day <= G.capDays).reduce((a, g) => a + g.n, 0);
  const got = Math.max(0, Math.min(n / (1 + mine.length), G.cap - recentSum));
  if (got <= 0) return;
  st.gains.push({ tribe, day: sim.day, n: got });
  sim.tribeRelationAdd(tribe, got);
}

function applyEffect(sim: Sim, v: Visitor, e: Effect): void {
  if (e.if && !evalCond(e.if, ctxOf(sim, v))) return;
  if (e.mood) v.mood = (v.mood ?? 0) + e.mood;
  const st = sim.encounters, f = sim.get(v.unitId);
  const move = (c: Cost | undefined, sign: 1 | -1) => { for (const [k, n] of Object.entries(c ?? {})) sim.stock[k as Res] = Math.max(0, sim.stock[k as Res] + sign * (n ?? 0)); };
  move(e.give, 1); move(e.take, -1);
  if (e.rel) gainRelation(sim, v.tribe, e.rel);
  if (e.deed) addDeed(sim, e.deed, v.tribe);
  if (e.handOver) {
    for (const id of [...st.refugees]) { const p = sim.get(id); if (p && p.team === 'player') sim.kill(p, 'sau khi bị giao cho kẻ truy đuổi'); }
    st.refugees = [];
  }
  if (e.raid) sim.raidFrom(v.tribe, e.raid);
  if (e.schedule) {
    const q = e.schedule;
    st.queue.push({ script: q.script, day: sim.day + q.days, priority: q.priority ?? 5, tribe: q.sameTribe ? v.tribe : undefined, linkedTo: v.id, ifStill: q.ifStill, maxDelay: q.maxDelay ?? ENC.maxDelay });
  }
  if (e.host) v.host = true; // settled now, done when the talk ends
  if (e.flag && !(v.flags ?? []).includes(e.flag)) v.flags = [...(v.flags ?? []), e.flag];
  if (e.welcome !== undefined) v.welcome = e.welcome;
  if (e.buy) { // the price is paid; what arrives depends on the merchant: a cheat gives nothing, and even an honest one may sell a fake as a bargain
    const sc = scriptOf(v.scriptId), item = sc ? shopItems(sim, v, sc).find((i) => i.id === e.buy) : undefined;
    v.sold = [...(v.sold ?? []), e.buy];
    const fake = v.truth !== 'honest' || (!!item?.bargain && seedRoll(v.seed, 'bargain') < (sc?.shop?.bonus?.fake ?? 0));
    if (item && !fake) { if (item.give) for (const [k, n] of Object.entries(item.give)) sim.stock[k as Res] += n ?? 0; else sim.toolStock[item.id] = (sim.toolStock[item.id] ?? 0) + 1; }
  }
  if (e.ransom) { const c = st.captives.find((x) => x.tribe === v.tribe) ?? st.captives[0]; const p = c && freeCaptive(sim, c.id, f ?? { x: v.mx, y: v.my }); if (p) sim.say(`${p.name} đã được chuộc về làng.`); }
  if (e.eventMod) applyEventMod(sim, v, e.eventMod);
  if (e.join) v.join = 'one'; // settled now, done when the talk ends (the answer is heard first)
  if (e.takeIn) v.join = 'all';
}

/** A raid that is coming is changed by what was said at the gate: the one this visit is about, else the next of the visitor's village. */
function applyEventMod(sim: Sim, v: Visitor, m: NonNullable<Effect['eventMod']>): void {
  const e = (v.event ? sim.events.find((x) => x.id === v.event && !x.fired) : undefined) ?? sim.events.filter((x) => x.kind === 'raid' && !x.fired && x.tribe === v.tribe).sort((a, b) => a.fireDay - b.fireDay)[0];
  if (!e) return;
  const name = tribeOf(sim, v.tribe)?.def.name ?? 'Họ';
  if (m.cancel) { e.fired = true; sim.say(`${name} đã thôi ý định tập kích.`); return; }
  if (m.powerMul) { if (e.power !== undefined) e.power *= m.powerMul; else e.size = Math.max(1, Math.round(e.size * m.powerMul)); if (e.army) for (const k of Object.keys(e.army)) e.army[k] = Math.max(1, Math.round(e.army[k] * m.powerMul)); }
  if (m.shiftDays) { e.fireDay += m.shiftDays; e.warnDay += m.shiftDays; }
}

/** A raid has just been foretold to the player (tribes.tickEvents): sometimes its village sends an envoy first, with a word about it. */
export function raidWarned(sim: Sim, eventId: string, tribe?: string): void {
  const st = sim.encounters, t = tribe ? tribeOf(sim, tribe) : undefined;
  if (!t || t.state !== 'free' || t.bandit || !scriptOf('ultimatum') || st.queue.some((q) => q.event === eventId)) return;
  if (sim.frnd() >= ENC.ultimatum.chance) return;
  st.queue.push({ script: 'ultimatum', day: sim.day, priority: 9, tribe: t.id, event: eventId, maxDelay: 1 });
}

function markSeen(sim: Sim, scriptId: string): void {
  const seen = sim.encounters.seen[scriptId] ?? { times: 0, lastDay: 0 };
  sim.encounters.seen[scriptId] = { times: seen.times + 1, lastDay: sim.day };
}

/** The talk is over: the visitor takes their leave. */
function endTalk(sim: Sim, visitorId: number): void {
  const v = visitorOf(sim, visitorId), f = v ? sim.get(v.unitId) : undefined;
  sim.encounters.active = null;
  if (!v) return;
  markSeen(sim, v.scriptId);
  if (v.join) { stayWithUs(sim, v); return; }
  if (v.welcome !== undefined) { welcomeParty(sim, v); return; }
  if (v.host && f) { startVisit(sim, v, f); return; }
  if (f) leave(sim, v, f); else dropVisitor(sim, v, true);
}

/** The plain data of a villager, to bring him back as he was. */
const captiveData = (p: Villager): Record<string, unknown> => JSON.parse(JSON.stringify({ name: p.name, look: p.look, stats: p.stats, potential: p.potential, skill: p.skill }));

/** A villager held by strangers is brought back (ransomed, or taken from one who was caught): he stands near `near`, as he was. */
function freeCaptive(sim: Sim, id: number, near: { x: number; y: number }): Villager | null {
  const st = sim.encounters, c = st.captives.find((x) => x.id === id);
  if (!c) return null;
  st.captives = st.captives.filter((x) => x !== c);
  const spot = sim.nearestFree(Math.floor(near.x), Math.floor(near.y), new Set()) ?? [Math.floor(near.x), Math.floor(near.y)];
  const p = sim.spawn(spot[0], spot[1], ((c.data.look as { sex?: 'm' | 'f' } | undefined)?.sex) ?? 'm');
  Object.assign(p, c.data);
  return p;
}

// ---------------------------------------------------------------- the ones who slip away
/** Those of the party who came to do harm are picked when the party stops (the speaker stays; only a lone visitor does it himself). Nothing is said. */
function makeAgents(sim: Sim, v: Visitor): void {
  const act = scriptOf(v.scriptId)?.truth?.find((t) => t.kind === v.truth)?.act;
  if (!act || v.agents.length) return;
  const pool = (v.members.length ? [...v.members] : [v.unitId]).sort((a, b) => seedRoll(v.seed, 'agent', a) - seedRoll(v.seed, 'agent', b)), n = Math.min(pool.length, act.who[0] + Math.floor(seedRoll(v.seed, 'who') * (act.who[1] - act.who[0] + 1)));
  v.agents = pool.slice(0, n).map((id) => ({ id, act, phase: 'wait', age: 0, delay: act.after[0] + Math.floor(seedRoll(v.seed, 'after', id) * (act.after[1] - act.after[0] + 1)) }));
}

/** Once a second, by their own clock (so it goes on while a dialogue is open and the game clock stands still): every one who slips away does what he came for. */
export function tickAgents(sim: Sim, dt: number): void {
  const st = sim.encounters;
  st.aclock += dt;
  if (st.aclock < 1) return;
  st.aclock -= 1;
  for (const v of st.visitors) for (const a of v.agents) stepAgent(sim, v, a);
}

const isAgent = (v: Visitor, id: number): boolean => v.agents.some((a) => a.id === id && (a.phase === 'go' || a.phase === 'run'));
const walkTo = (sim: Sim, u: Villager, x: number, y: number): void => { if (Math.hypot(u.x - x, u.y - y) > 1.2 && !u.path.length) u.path = sim.pathTo(u, Math.floor(x), Math.floor(y), 3000); };

/** What he takes from the stores: one or two kinds of goods the village really has, a random amount of each, and some shells; at most what is there when he gets his hands on it. */
function lootOf(sim: Sim, v: Visitor, a: Agent): Cost {
  const T = a.act.take;
  if (!T) return { food: 40 };
  const have = T.pool.filter((r) => sim.stock[r] > 20).sort((x, y) => seedRoll(v.seed, `good:${x}`, a.id) - seedRoll(v.seed, `good:${y}`, a.id));
  const k = Math.min(have.length, T.pick[0] + Math.floor(seedRoll(v.seed, 'kinds', a.id) * (T.pick[1] - T.pick[0] + 1))), out: Cost = {};
  for (const r of have.slice(0, k)) out[r] = T.each[0] + Math.floor(seedRoll(v.seed, `amount:${r}`, a.id) * (T.each[1] - T.each[0] + 1));
  out.coin = T.coin[0] + Math.floor(seedRoll(v.seed, 'coin', a.id) * (T.coin[1] - T.coin[0] + 1));
  return out;
}

/** The most skilled villager out of doors who is not a soldier or the head: the one a kidnapper goes for (one of the best three, by the seed). */
function pickVictim(sim: Sim, v: Visitor, a: Agent): Villager | undefined {
  const skill = (p: Villager) => Object.values(p.skill).reduce((s, k) => s + k.level, 0);
  const pool = sim.villagers.filter((p) => p.team === 'player' && p.health > 0 && !p.leader && p.job !== 'fight' && p.job !== 'scout' && p.job !== 'supply' && p.inside === null && !v.agents.some((o) => o.target === p.id)).sort((x, y) => skill(y) - skill(x));
  return pool[Math.floor(seedRoll(v.seed, 'victim', a.id) * Math.min(3, pool.length))];
}

/** He has done it, or given up: he runs home (a little slower for what he carries). */
function startRun(sim: Sim, v: Visitor, a: Agent, u: Villager): void {
  a.phase = 'run'; a.age = 0; u.speed *= ENC.chase.fleeSpeed; u.fight.target = null;
  u.path = sim.pathTo(u, Math.floor(v.hx), Math.floor(v.hy), 3000);
}

function stepAgent(sim: Sim, v: Visitor, a: Agent): void {
  const u = sim.get(a.id);
  if (!u || u.health <= 0 || u.team === 'player') { a.phase = 'done'; return; }
  if (v.state === 'walking' || a.phase === 'done') return; // (the party has not stopped yet)
  a.age++;
  if (a.phase === 'wait') {
    if (v.state === 'leaving') { a.phase = 'done'; return; } // they were sent away before they began
    if (a.age >= a.delay) { a.phase = 'go'; a.age = 0; }
    return;
  }
  if (a.phase === 'go') {
    const steal = (cost: Cost) => { // the stores lose what he takes (at most what is there) only now
      const got: Cost = {};
      for (const [k, n] of Object.entries(cost)) { const take = Math.min(n ?? 0, Math.floor(sim.stock[k as Res])); if (take > 0) { sim.stock[k as Res] -= take; got[k as Res] = take; } }
      a.loot = got; startRun(sim, v, a, u);
    };
    if (a.age > ENC.visit.actSeconds) { startRun(sim, v, a, u); return; } // he could not manage it
    if (a.act.do === 'steal') {
      const store = sim.buildings.filter((b) => b.kind === 'storage' && b.done).sort((p, q) => Math.hypot(p.x - u.x, p.y - u.y) - Math.hypot(q.x - u.x, q.y - u.y))[0] ?? sim.campfire();
      const tx = store ? store.x + 1 : u.x, ty = store ? store.y + 2.5 : u.y;
      if (Math.hypot(u.x - tx, u.y - ty) <= 2) steal(lootOf(sim, v, a)); else walkTo(sim, u, tx, ty);
    } else {
      let p = a.target !== undefined ? sim.get(a.target) : undefined;
      if (!p || p.team !== 'player' || p.inside !== null) { p = pickVictim(sim, v, a); a.target = p?.id; }
      if (!p) { steal({ food: 40 }); return; } // nobody to take: he takes food
      if (Math.hypot(u.x - p.x, u.y - p.y) <= 1.8) { // he takes hold of him: gone from the village, no word of it
        const st = sim.encounters, c: Captive = { id: st.nextId++, tribe: v.tribe, day: sim.day, data: captiveData(p) };
        sim.takeAway(p); st.captives.push(c); a.captive = c.id;
        if (!st.queue.some((q) => q.script === 'ransom' && q.linkedTo === v.id)) st.queue.push({ script: 'ransom', day: sim.day + 3, priority: 8, tribe: v.tribe, linkedTo: v.id, ifStill: 'captives>=1', maxDelay: 3 });
        startRun(sim, v, a, u);
      } else u.path = sim.pathTo(u, Math.floor(p.x), Math.floor(p.y), 3000); // the villager moves: go for where he is now
    }
  } else if (Math.hypot(u.x - v.hx, u.y - v.hy) < 2) { sim.removeFoe(u); a.phase = 'done'; } // run: home, out of sight
  else if (!u.path.length) u.path = sim.pathTo(u, Math.floor(v.hx), Math.floor(v.hy), 3000);
}

/** A blow on one who runs with what he took: he gives up. What he took is given back (or the captive is free) and he waits to be judged (thief_caught), apart from the rest of the party. */
function catchAgent(sim: Sim, v: Visitor, a: Agent): void {
  const u = sim.get(a.id), st = sim.encounters;
  if (!u) return;
  if (a.captive !== undefined) { const p = freeCaptive(sim, a.captive, u); a.captive = undefined; if (p) { sim.say(`${p.name} đã được cứu về làng!`); addDeed(sim, 'rescued_captive', v.tribe); } }
  if (a.loot) { for (const [k, n] of Object.entries(a.loot)) sim.stock[k as Res] += n ?? 0; a.loot = undefined; }
  u.speed /= ENC.chase.fleeSpeed; // (he ran slower with it; he is no slower for good)
  a.phase = 'done'; v.members = v.members.filter((id) => id !== a.id); v.spots = v.members.map(() => [v.hx, v.hy] as [number, number]);
  u.path = []; u.facing = 'front';
  st.visitors.push({
    id: st.nextId++, scriptId: 'thief_caught', tribe: v.tribe, unitId: u.id, truth: v.truth, seed: v.seed ^ a.id, state: 'waiting', mx: u.x, my: u.y, hx: v.hx, hy: v.hy, arrivedAt: sim.time, expiresAt: sim.time + sim.dayLen, stuck: 0,
    notes: [], used: [], members: [], spots: [], join: '', escort: [], placed: false, provoked: true, watch: v.watch, agents: [], caught: true,
  });
  const text = `${u.name} bị bắt và xin tha! Những gì hắn lấy đã được trả lại.`;
  sim.say(text); sim.addAlert('notice', text);
}

/** The talk let the party in: they walk into the village and sit about the fire for a while. */
function startVisit(sim: Sim, v: Visitor, f: Villager): void {
  releaseGuards(sim, v);
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y, N = sim.world.size, all = [v.unitId, ...v.members];
  const taken = new Set<number>(), seats = all.map((_, i) => {
    const ang = (i / all.length) * Math.PI * 2, s = sim.nearestFree(Math.floor(fx + Math.cos(ang) * 3), Math.floor(fy + Math.sin(ang) * 3), taken) ?? [Math.floor(fx), Math.floor(fy)];
    taken.add(s[1] * N + s[0]);
    return [s[0] + 0.5, s[1] + 0.5] as [number, number];
  });
  v.seat = seats[0]; v.spots = seats.slice(1);
  v.state = 'visiting'; v.visitUntil = sim.time + ENC.visit.restSeconds; v.host = false; f.path = [];
}

/** One second of a party in the village: they sit about the fire and, when the rest is over, leave. */
function stepVisit(sim: Sim, v: Visitor, f: Villager): void {
  if (v.seat && !isAgent(v, f.id)) walkTo(sim, f, v.seat[0], v.seat[1]);
  if (sim.time >= (v.visitUntil ?? 0)) leave(sim, v, f);
}

/** The party is gone home. Those who slipped away and are still at it are not: they stay until they are done (the rest are out of sight at once). */
function retire(sim: Sim, v: Visitor): void {
  const active = v.agents.filter((a) => a.phase === 'go' || a.phase === 'run');
  if (!active.length || sim.time >= v.expiresAt + ENC.visit.actSeconds * 3) { dropVisitor(sim, v, true); return; }
  const keep = new Set(active.map((a) => a.id));
  for (const id of [v.unitId, ...v.members]) if (!keep.has(id)) { const u = sim.get(id); if (u && u.team !== 'player') sim.removeFoe(u); }
  v.unitId = active[0].id; v.members = active.slice(1).map((a) => a.id); v.spots = v.members.map(() => [v.hx, v.hy] as [number, number]);
}

/** The talk took some of the party in: as many as asked and as the village has room for become villagers (the ones who came to do harm never do); the rest sit about the fire if one of them is still to slip away, else they go. */
function welcomeParty(sim: Sim, v: Visitor): void {
  releaseGuards(sim, v);
  const st = sim.encounters, room = Math.max(0, sim.popCap() - sim.villagers.length), want = v.welcome ?? 0;
  v.welcome = undefined;
  const agentIds = new Set(v.agents.filter((a) => a.phase !== 'done').map((a) => a.id));
  const all = [v.unitId, ...v.members].map((id) => sim.get(id)).filter((u): u is Villager => !!u && u.team !== 'player');
  const take = all.filter((u) => !agentIds.has(u.id)).sort((a, b) => seedRoll(v.seed, 'pick', a.id) - seedRoll(v.seed, 'pick', b.id)).slice(0, Math.min(want, room));
  for (const u of take) sim.adoptFoe(u);
  if (take.length) sim.say(`${take.length} người đến làng xin ở lại: ${take.map((u) => u.name).join(', ')}.`);
  const left = all.filter((u) => !take.includes(u));
  if (!left.length) { st.visitors = st.visitors.filter((x) => x.id !== v.id); return; }
  v.unitId = left[0].id; v.members = left.slice(1).map((u) => u.id); v.spots = v.members.map(() => [v.hx, v.hy] as [number, number]);
  if (v.agents.some((a) => a.phase === 'wait' || a.phase === 'go')) startVisit(sim, v, left[0]); else leave(sim, v, left[0]);
}

/** The visitor (or the whole party, remembered as refugees) stays and becomes villagers of ours. */
function stayWithUs(sim: Sim, v: Visitor): void {
  releaseGuards(sim, v);
  const st = sim.encounters, ids = v.join === 'all' ? [v.unitId, ...v.members] : [v.unitId];
  let n = 0;
  for (const id of ids) {
    const u = sim.get(id);
    if (!u || u.team === 'player') continue;
    sim.adoptFoe(u); n++;
    if (v.join === 'all') st.refugees.push(u.id);
  }
  sim.say(v.join === 'all' ? `${n} người tị nạn ở lại làng.` : `${sim.get(v.unitId)?.name ?? 'Người lạ'} ở lại làm dân của làng.`);
  st.visitors = st.visitors.filter((x) => x.id !== v.id);
}
