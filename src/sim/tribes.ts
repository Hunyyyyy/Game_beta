import eventsJson from '../data/events.json';
import { ANIMALS, MEET, Species, WEAPONS, HOSTILE_BELOW, RELATION, SIEGE, TRIBE_IDS, TRIBES, TribeDef, TribeId, Team } from './combat';
import { BuildingKind } from './buildings';
import { tickFrontier } from './tribefrontier';
import { fireLevelOf, followFire, headcount, recoverTribe, releaseCrowd, rescaleTribe, retierTribe, tickLod, topUp, wake } from './tribelod';
import { armOfWeapon } from './formations';
import { DIFF, raidPower, tierLevel } from './difficulty';
import type { TierId } from './difficulty';
import type { Era } from './buildings';
import { RES_NAME } from './resources';
import { applyStats } from './statsys';
import { refreshActive } from './tribework';
import type { StatId } from './research';
import { spawnAnimal } from './fauna';
import type { Stock } from './resources';
import type { Sim, Villager } from './sim';
import { Tile } from './world';
import { warTribe } from './warmode';


export type TribeState = 'free' | 'surrendered' | 'tribute' | 'destroyed';

export interface Raid {
  id: number;
  phase: 'march' | 'retreat';
  t: number;
  max: number;
  size: number;
  /** The part of the day it comes for (an event's `night`): when it is over the raiders go home, so the village can heal. */
  night?: boolean;
}

export interface Tribe {
  id: TribeId;
  def: TribeDef;
  camp: { x: number; y: number };   // centre of the fire
  /** Its works: the fire and the piles, and (from tribebuild.growCamp) the pieces of its camp plan: `lv` is the level of such a piece, `b` the kind of house when `kind` is 'house'. */
  props: Array<{ x: number; y: number; w: number; h: number; kind: 'fire' | 'pile' | 'tower' | 'fence' | 'gate' | 'house'; hp: number; b?: BuildingKind; lv?: number; open?: boolean }>;
  /** People who are not in the world (indoors, or the village is asleep): see tribelod.ts. `unitIds` are those in the world. Undefined: an old save, everyone is in the world. */
  crowd?: { guards: number; civs: number };
  /** The army of the village (the soldiers of the crowd) is out at its posts; `armyIdle` counts the quiet seconds since, after which it goes back indoors. */
  armyOut?: boolean; armyIdle?: number;
  /** The village is awake (its houses laid and its workers out). `idleT`: seconds with nobody of ours near. */
  awake?: boolean; idleT?: number;
  /** The campfire level the head count was last made up for; when awake, the people indoors at waking and the houses and fire standing then (the crowd keeps what those can shelter). */
  popLevel?: number; hid0?: number; pool0?: number;
  /** The chief fell (he is a body in the world only while it is awake). */
  leaderDead?: boolean;
  /** A boss village (difficulty.json "boss"): one step above the player in camp, defences and gear. `bossDown`: it has fallen, the age of bronze was announced. */
  boss?: boolean; bossDown?: boolean;
  /** The game time at which it fell (for the notice of the new age). */
  bossDownAt?: number;
  /** The land round it has been stocked with trees, rocks and bushes (tribelod.stockLand). */
  seeded?: boolean;
  /** The game time a work of the village was last struck (siege.damageProp): it mends itself when left alone (tribelod). */
  hitAt?: number;
  /** The campfire level its camp plan stands at (undefined: not raised yet, an old save). */
  built?: number;
  relation: number;                  // -100..100
  state: TribeState;
  angryUntil: number;                // sim time: being attacked keeps them hostile for a while
  unitIds: number[];
  leaderId: number;
  nextTribute: number;               // day of the next tribute payment
  raid: Raid | null;
  lastAngry: number;                 // throttles the "they are angry" message
  /** Level of its campfire (random, at least one village is low enough to be taken on early): how many people it holds, and what taking it is worth. */
  campLevel: number;
  /** How strong it is against the player (tribes.json, difficulty.json "tiers"): its camp level and its army follow his fire within the limits of the tier. */
  tier: TierId;
  /** The tier it was dealt at the start (a rebel that is beaten goes back to it). */
  baseTier?: TierId;
  /** A camp of bandits (tribes.json bandit), not a village. */
  bandit?: boolean;
  /** The day a camp of bandits changes its strength again. */
  rerollAt?: number;
  /** The newcomer this village stands by after it was taken back (tribefrontier.ts). */
  allyOf?: TribeId;
  /** Percent added to the combat stats of its soldiers and to the work stat of its people, worked out from the target (see difficulty.tribeBonuses). */
  mil: number; eco: number;
  /** Our people have hurt it: if it falls, the spoils are ours. */
  harmed?: boolean;
  /** What it pays when it is a tributary, as a share of its bag every difficulty.json capture.tribute.everyDays days (the player raises it step by step; the more he asks, the likelier it is to betray). */
  tributeShare?: number;
  /** The part of `tributeShare` above the base that costs no relation and risks no betrayal (a rebel beaten and back as a tributary pays more for good). */
  tributeFree?: number;
  /** It betrayed us and became a chief of its own (a boss weaker than the first): every boss must fall before the age can change. `nextRaidDay`: when it sends its next raid. */
  rebel?: boolean; nextRaidDay?: number;
  /** The day a beaten village last got back part of its people (recoverTribe). */
  recoveredDay?: number;
  /** The era in which its bag of spoils (spoilsOf) was taken: a village pays out once in each era, never again within one (a new era brings a new bag). */
  spoiledIn?: Era;
  /** The day and the campfire level of the player the strength was last worked out for. */
  seenDay: number; seenFire: number;
}

export interface EventState {
  id: string;
  kind: 'beasts' | 'raid';
  tribe?: TribeId;
  /** beasts: the animal of animals.json that comes. */
  species?: Species;
  /** raid: a make-up chosen in events.json (weapon -> how many); without it the tribe sends its own guards. */
  army?: Record<string, number>;
  armor?: boolean;
  /** raid: how strong the raid is against the army of the player now (1 = as strong, 1.1 = a tenth stronger): sets `size` each day. */
  power?: number;
  sizeDay?: number;
  fireDay: number;
  warnDay: number;
  size: number;
  night: boolean;
  warn: string;
  warned: boolean;
  fired: boolean;
  /** It has begun and is not over yet: when it is, the player is told and a sound plays (tickEvents). */
  live?: boolean;
  /** beasts: the herd number of the pack, to know when the last of them is gone. */
  herd?: number;
  /** raid: the number of the raid of the village, to count its men; and how many of them were seen alive last. */
  raidId?: number;
  left?: number;
}

export const tribeOf = (sim: Sim, id: Team): Tribe | undefined => sim.tribes.find((t) => t.id === id);
export const POP_CAP = 40;

/** Current standing as a label. */
export const standing = (t: Tribe) => (t.state === 'free' ? t.relation : t.state === 'tribute' ? Math.max(60, t.relation) : t.relation);

// ---------------------------------------------------------------- spawning
export function spawnTribes(sim: Sim): void {
  // the tiers of tribes.json (weak, normal, normal, medium, boss) are dealt out again among the villages at the start of every game: each village keeps its name, its people and its place, but not its tier;
  // its camp starts at the level of the tier for a player at the first fire and follows his fire (tribelod.followFire)
  const tiers = TRIBE_IDS.map((id) => TRIBES[id].tier);
  for (let n = 0; n < 20; n++) { // a peaceful village is never the chief: it would not fight (a chief is what the age is won against)
    for (let i = tiers.length - 1; i > 0; i--) { const j = Math.floor(sim.wrnd() * (i + 1)); [tiers[i], tiers[j]] = [tiers[j], tiers[i]]; }
    if (TRIBES[TRIBE_IDS[tiers.indexOf('boss')]].personality !== 'peaceful') break;
  }
  TRIBE_IDS.forEach((id, i) => spawnTribe(sim, id, tiers[i]));
  initEvents(sim, sim.day - 1);
}

/**
 * A new era: the villages of the land vanish with everything of theirs (their people, their works, what scouts learnt of them, the events that were set) and
 * new ones are drawn from scratch, as at the start of the game: relations back to what each tribe begins with, new camps, new levels, new bosses.
 * What the player took stays his (room for people, places in the camps).
 */
export function resetTribes(sim: Sim): void {
  const N = sim.world.size;
  for (const t of sim.tribes) {
    for (const f of sim.foes.filter((q) => q.team === t.id)) sim.removeFoe(f);
    for (const p of t.props) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { const k = (p.y + j) * N + p.x + i; sim.world.occ[k] = 0; sim.world.foeGates.delete(k); }
  }
  sim.tribes.length = 0; sim.events.length = 0; sim.maps.length = 0; sim.sightings.length = 0; sim.pendingTribe = null;
  for (const k of Object.keys(sim.drafts)) delete sim.drafts[k];
  spawnTribes(sim);
}

/** Is the ground round (cx, cy) fit for a camp? Nothing of water or mountain within `r` tiles, except `spare` (a share of the circle) of bad ground. */
function campFits(sim: Sim, cx: number, cy: number, r: number, spare: number): boolean {
  const w = sim.world;
  let bad = 0, all = 0;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (Math.hypot(x - cx, y - cy) > r) continue;
    if (!w.inBounds(x, y)) return false;
    all++;
    if (w.at(x, y) === Tile.Water || w.at(x, y) === Tile.Mountain) bad++;
  }
  return bad <= all * spare;
}

/** The camp is looked for first where its whole plan fits (the fence, the towers and the working houses reach about 14 tiles from the fire: the yard of 7 must be clean and the rest almost so), then, failing that, where the yard alone is clean. */
const SITES = [{ r: 14, spare: 0.04, yard: true, wide: false }, { r: 7, spare: 0, yard: false, wide: false }, { r: 7, spare: 0, yard: false, wide: true }];
/** The least distance (tiles) between the fires of two camps: each camp's plan reaches about 14 tiles from its fire, so nearer than this and two villages would be laid over each other. */
const CAMP_GAP = 34;

function spawnTribe(sim: Sim, id: TribeId, tier: TierId = TRIBES[id].tier): void {
  const def = TRIBES[id], w = sim.world, s = w.start, N = w.size, boss = tier === 'boss', campLevel = tierLevel(sim.campfire()?.level ?? 1, tier);
  let cx = -1, cy = -1;
  // the place the village likes first (its angle and distance from ours), then ever wider round it, and last, as a way out, anywhere round the whole circle: never within CAMP_GAP of another village
  search: for (const site of SITES) for (let dd = 0; dd <= (site.wide ? 60 : 24); dd += 3) for (const sign of dd ? [1, -1] : [1]) for (let da = 0; da <= (site.wide ? 180 : 90); da += 15) for (const as of da ? [1, -1] : [1]) {
    const ang = ((def.angle + da * as) * Math.PI) / 180, d = def.distance + dd * sign;
    const x = Math.round(s.x + Math.cos(ang) * d), y = Math.round(s.y + Math.sin(ang) * d);
    if (!(x > 16 && y > 16 && x < N - 16 && y < N - 16)) continue;
    if (sim.tribes.some((o) => Math.hypot(o.camp.x - (x + 1), o.camp.y - (y + 1)) < CAMP_GAP)) continue; // another village is there
    w.ensure(x, y, 18); // the land must exist before it can be judged
    if (campFits(sim, x, y, 7, 0) && (!site.yard || campFits(sim, x, y, site.r, site.spare))) { cx = x; cy = y; break search; }
  }
  if (cx < 0) return;
  // the land between the village and the camp is made too, so that raiders and scouts can walk it (a chunk that does not exist yet is a wall)
  const gap = Math.hypot(cx - s.x, cy - s.y);
  for (let k = 0; k <= gap; k += 16) w.ensure(s.x + ((cx - s.x) * k) / gap, s.y + ((cy - s.y) * k) / gap, 24);
  // clear a round yard
  for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) {
    if (Math.hypot(x - cx, y - cy) > 6.5) continue;
    const i = y * N + x; w.nodes.delete(i); w.tiles[i] = Tile.Grass; w.decor[i] = 0;
  }
  const props: Tribe['props'] = [
    { x: cx, y: cy, w: 2, h: 2, kind: 'fire', hp: SIEGE.propHp.fire }, { x: cx - 5, y: cy - 1, w: 2, h: 2, kind: 'pile', hp: SIEGE.propHp.pile }, { x: cx + 4, y: cy + 1, w: 2, h: 2, kind: 'pile', hp: SIEGE.propHp.pile },
  ];
  for (const p of props) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) w.occ[(p.y + j) * N + p.x + i] = 1;
  const camp = { x: cx + 1, y: cy + 1 };
  const tribe: Tribe = {
    id, def, camp, props, relation: def.relation, state: 'free', angryUntil: 0, unitIds: [], leaderId: -1, nextTribute: 0, raid: null,
    campLevel, tier, baseTier: tier, mil: 0, eco: 0, seenDay: 0, seenFire: 0,
    lastAngry: -999, boss, bandit: !!def.bandit,
  };
  sim.tribes.push(tribe);
  topUp(sim, tribe); // its people are only a head count until we come near (tribelod.ts); the houses are laid then too
  rescaleTribe(sim, tribe);
}

/** The village has been seen: its camp, or any one of its works (a fence seen from afar is enough), stands on ground that is no longer black. */
export function tribeSeen(sim: Sim, t: Tribe): boolean {
  const N = sim.world.size, st = sim.fog.state;
  if (st[Math.floor(t.camp.y) * N + Math.floor(t.camp.x)] > 0) return true;
  return t.props.some((p) => st[Math.floor(p.y) * N + Math.floor(p.x)] > 0);
}

// ---------------------------------------------------------------- relations and diplomacy
export function tribeHostile(sim: Sim, id: Team): boolean {
  const t = tribeOf(sim, id);
  return !!t && t.state === 'free' && (t.relation < HOSTILE_BELOW || sim.time < t.angryUntil || !!t.raid);
}

/** Will this tribe fight whoever it meets? Yes, unless the relation is good; a peaceful tribe fights only when it is already hostile (struck, or at odds). */
export function tribeWilling(sim: Sim, id: Team): boolean {
  const t = tribeOf(sim, id);
  if (!t || t.state !== 'free') return false;
  if (sim.plans.some((p) => p.kind === 'attack' && p.status === 'running' && p.tribe === id)) return true; // the village our army is marching on fights whoever of ours it meets
  return tribeHostile(sim, id) || (t.def.personality !== 'peaceful' && t.relation < MEET.friendlyFrom);
}

/** Do these two tribes fight each other whenever they meet? Only the pairs of tribes.json "meet" do. */
export function tribesFeud(sim: Sim, a: Team, b: Team): boolean {
  if (a === b || !MEET.feuds.some((p) => p.includes(a) && p.includes(b))) return false;
  const ta = tribeOf(sim, a), tb = tribeOf(sim, b);
  return !!ta && !!tb && ta.state === 'free' && tb.state === 'free';
}

export function tribeAttacked(sim: Sim, id: Team, victim: Villager): void {
  const t = tribeOf(sim, id);
  if (!t || t.state !== 'free') return;
  t.harmed = true;
  const first = sim.time > t.angryUntil;
  t.angryUntil = sim.time + 120;
  if (first) {
    t.relation = Math.max(-100, t.relation + (t.def.personality === 'peaceful' ? RELATION.attackedPeaceful : -10));
    if (sim.time - t.lastAngry > 30) { t.lastAngry = sim.time; sim.say(`${t.def.name} bị tấn công và nổi giận!`); }
  }
  void victim;
}

export function killFoe(sim: Sim, v: Villager, killer?: Villager): void {
  const t = tribeOf(sim, v.team);
  sim.removeFoe(v);
  if (!t) return;
  t.unitIds = t.unitIds.filter((u) => u !== v.id);
  if (v.ai?.role === 'raider') sim.noteBattle('foes');
  if (killer?.team === 'player') sim.warFoeDead(v.team);
  if (killer?.team === 'player') {
    t.relation = Math.max(-100, t.relation + (v.ai?.role === 'civ' ? RELATION.killCivilian : RELATION.killWarrior));
    t.angryUntil = sim.time + 120;
  }
  if (v.id === t.leaderId) { t.leaderDead = true; sim.say(`Thủ lĩnh ${t.def.name} đã gục ngã.`); }
  sim.onKill?.();
}

/** The goods a gift to a village is: `gift.share` of its bag (difficulty.json capture.gift). */
export function giftOf(t: Pick<Tribe, 'campLevel' | 'boss'>, era: Era): Partial<Stock> {
  const out: Partial<Stock> = {};
  for (const [k, n] of Object.entries(spoilsOf(t, era))) { const v = Math.round((n ?? 0) * DIFF.capture.gift.share); if (v > 0) out[k as keyof Stock] = v; }
  return out;
}

/** A gift to a village we have not taken (not a boss): its relation grows by what the gift is of the bag, set against what its tier takes to win over (capture.gift.cost). Returns an error or null. */
export function giftTribe(sim: Sim, id: TribeId): string | null {
  const t = tribeOf(sim, id);
  if (!t || t.state !== 'free') return 'Chỉ tặng được cho làng chưa chiếm';
  if (t.bandit) return 'Cướp không nhận quà';
  if (t.boss || t.tier === 'boss' || t.tier === 'rebel') return 'Thủ lĩnh không nhận quà';
  const gift = giftOf(t, sim.era), lack = (Object.keys(gift) as Array<keyof Stock>).find((k) => sim.stock[k] < (gift[k] ?? 0));
  if (lack) return `Thiếu ${RES_NAME[lack].toLowerCase()} để làm quà (cần ${gift[lack]})`;
  for (const k of Object.keys(gift) as Array<keyof Stock>) sim.stock[k] -= gift[k] ?? 0;
  t.relation = Math.min(100, Math.round((t.relation + (100 * DIFF.capture.gift.share) / DIFF.capture.gift.cost[t.tier as 'weak' | 'normal' | 'medium']) * 10) / 10);
  if (t.relation >= HOSTILE_BELOW) t.angryUntil = Math.min(t.angryUntil, sim.time);
  return null;
}

export function canTribute(t: Tribe): boolean {
  if (t.bandit) return false;
  return t.state === 'surrendered' || (t.state === 'free' && t.relation >= RELATION.tributeAt);
}
export function canAdopt(t: Tribe): boolean {
  if (t.bandit) return false;
  return t.state === 'surrendered' || (t.state === 'free' && t.def.personality === 'peaceful' && t.relation >= RELATION.joinAt);
}

/** The bag of goods a village is worth in an era at its camp level (src/content/difficulty.json "capture.spoils"; the boss' is bigger): a fixed table, so what a village yields never depends on what its people did or on where the camera has been. */
export function spoilsOf(t: Pick<Tribe, 'campLevel' | 'boss'> & { bandit?: boolean }, era: Era): Partial<Stock> {
  const out: Partial<Stock> = {}, mult = (t.boss ? DIFF.capture.bossMult : 1) * (t.bandit ? DIFF.capture.bandit.bag : 1);
  for (const [res, row] of Object.entries(DIFF.capture.spoils[era])) out[res as keyof Stock] = Math.round(row[Math.max(0, Math.min(row.length, t.campLevel) - 1)] * mult);
  return out;
}

/** The goods of a village: its whole bag of spoils (src/content/difficulty.json "capture"), once in each era. */
function claimVillage(sim: Sim, t: Tribe): string[] {
  const got: string[] = [];
  if (t.spoiledIn === sim.era) return got;
  t.spoiledIn = sim.era;
  for (const [k, n] of Object.entries(spoilsOf(t, sim.era))) {
    const take = n ?? 0, res = k as keyof Stock;
    if (take <= 0) continue;
    sim.stock[res] = Math.min(sim.capacity(res), sim.stock[res] + take); sim.noteLoot(t.id, res, take); got.push(`${take} ${RES_NAME[res].toLowerCase()}`);
  }
  return got;
}

/** What taking a village adds for good, by its tier (difficulty.json "capture.adopt"): room for people, and places in every camp of soldiers. */
function takeVillage(sim: Sim, t: Tribe): { pop: number; slots: number; yieldPct: number } {
  const a = DIFF.capture.adopt[t.tier], yieldPct = DIFF.capture.yieldPerVillage[t.tier];
  sim.conquered++; sim.popBonus += a.pop; sim.campBonus += a.slots; sim.yieldBonus += yieldPct;
  sim.conquests.push({ id: t.id, tier: t.tier, pop: a.pop, slots: a.slots, yieldPct, day: sim.day });
  return { ...a, yieldPct };
}
/** What taking a village gives for good, for the player to read before he does it: room for people, places in every camp, yield, the bag, and the soldiers it sends when it pays tribute. */
export function rewardsOf(t: Pick<Tribe, 'tier' | 'campLevel' | 'boss'>, era: Era): { pop: number; slots: number; yieldPct: number; bag: Partial<Stock>; allies: number } {
  const a = DIFF.capture.adopt[t.tier], al = DIFF.capture.allies as Record<string, number>;
  return { pop: a.pop, slots: a.slots, yieldPct: DIFF.capture.yieldPerVillage[t.tier], bag: spoilsOf(t, era), allies: al[t.tier] ?? 0 };
}

/** A village taken is gone: its people, its works on the map, the war on it, what was learnt of it. */
function removeTribe(sim: Sim, t: Tribe): void {
  const N = sim.world.size;
  for (const f of sim.foes.filter((q) => q.team === t.id)) sim.removeFoe(f);
  for (const p of t.props) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { const k = (p.y + j) * N + p.x + i; sim.world.occ[k] = 0; sim.world.foeGates.delete(k); }
  for (const plan of sim.plans) if (plan.tribe === t.id && plan.status === 'running') { plan.status = 'done'; plan.result = 'won'; plan.endedAt = sim.time; }
  for (let i = sim.sightings.length - 1; i >= 0; i--) if (sim.sightings[i].tribe === t.id) sim.sightings.splice(i, 1);
  for (let i = sim.maps.length - 1; i >= 0; i--) if (sim.maps[i].tribe === t.id) sim.maps.splice(i, 1);
  if (sim.pendingTribe === t.id) sim.pendingTribe = null;
  sim.tribes.splice(sim.tribes.indexOf(t), 1);
}

export function tributeTribe(sim: Sim, id: TribeId): string | null {
  const t = tribeOf(sim, id);
  if (!t || !canTribute(t)) return 'Họ chưa chịu cống nạp';
  t.state = 'tribute'; t.relation = Math.max(t.relation, RELATION.tributeAt); t.raid = null;
  t.tributeShare = DIFF.capture.tribute.baseShare; t.nextTribute = sim.day + DIFF.capture.tribute.everyDays;
  if (sim.pendingTribe === id) sim.pendingTribe = null;
  claimVillage(sim, t);
  releaseRaiders(sim, t);
  sim.say(`${t.def.name} chịu cống nạp: cứ ${DIFF.capture.tribute.everyDays} ngày họ gửi ${Math.round(t.tributeShare * 100)}% tài nguyên và không đánh làng nữa.`);
  return null;
}

/** How many steps above what is free the share asked of a tributary is: each costs relation and risks a betrayal. */
export function tributeSteps(t: Pick<Tribe, 'tributeShare' | 'tributeFree'>): number {
  const c = DIFF.capture.tribute;
  return Math.max(0, Math.round(((t.tributeShare ?? c.baseShare) - c.baseShare - (t.tributeFree ?? 0)) / c.step));
}

/** The player asks a tributary for more (dir = 1) or less (-1), a step at a time, between the base share and the most (difficulty.json capture.tribute). Returns an error or null. */
export function setTribute(sim: Sim, id: TribeId, dir: 1 | -1): string | null {
  const t = tribeOf(sim, id), c = DIFF.capture.tribute;
  if (!t || t.state !== 'tribute') return 'Làng này chưa cống nạp';
  const low = c.baseShare + (t.tributeFree ?? 0), now = t.tributeShare ?? c.baseShare;
  // down from the lowest share is "take nothing" (0); up from nothing is the lowest share again
  const next = dir < 0 ? (now <= low ? 0 : Math.max(low, Math.round((now - c.step) * 100) / 100)) : (now <= 0 ? low : Math.min(c.maxShare, Math.round((now + c.step) * 100) / 100));
  if (next === now) return dir > 0 ? 'Đã đòi hết mức' : 'Đã không lấy cống nạp';
  t.tributeShare = next;
  return null;
}

/** A tributary pays: its share of the bag; the relation falls by a step for the payment and one more for every step above the base; each step above also gives it a chance to turn on us. */
function payTribute(sim: Sim, t: Tribe): void {
  const c = DIFF.capture.tribute, share = t.tributeShare ?? c.baseShare, steps = tributeSteps(t);
  t.nextTribute = sim.day + c.everyDays;
  if (share <= 0) { // the player took nothing this time: the village gets over it a little
    t.relation = Math.min(100, t.relation + c.relationRegen);
    sim.say(`${t.def.name} được nghỉ cống nạp kỳ này, quan hệ tốt lên.`);
    return;
  }
  for (const [k, n] of Object.entries(spoilsOf(t, sim.era))) sim.stock[k as keyof Stock] = Math.min(sim.capacity(), sim.stock[k as keyof Stock] + Math.round((n ?? 0) * share));
  t.relation = Math.max(-100, t.relation - c.relationLoss * (1 + steps));
  sim.say(`${t.def.name} gửi cống nạp (${Math.round(share * 100)}% túi).`);
  const room = sim.tribes.filter((q) => q.rebel).length < DIFF.capture.rebel.maxRebels;
  if (room && (t.relation <= c.betrayBelow || (steps > 0 && sim.frnd() < steps * c.greedChancePerStep))) betray(sim, t);
  else if (t.relation < c.betrayBelow) t.relation = c.betrayBelow; // no more rebels may rise: it sulks at the bottom
}

/** The tributary turns on us: a free village again, hostile, a chief of its own (weaker than the first boss). */
function betray(sim: Sim, t: Tribe): void {
  t.state = 'free'; t.relation = -100; t.raid = null; t.tributeShare = undefined;
  t.rebel = true; t.boss = true; t.bossDown = false; t.tier = 'rebel'; t.tributeFree = undefined; t.nextRaidDay = sim.day + eventsJson.hostile.raidEveryDays;
  followFire(sim, t); rescaleTribe(sim, t);
  sim.say(`${t.def.name} phản bội! Họ không chịu nổi sự đòi hỏi và thành thủ lĩnh mới của một đội quân thù địch. Phải hạ hết các thủ lĩnh mới được sang thời đại.`);
}

export function adoptTribe(sim: Sim, id: TribeId): string | null {
  const t = tribeOf(sim, id);
  if (!t || !canAdopt(t)) return 'Họ chưa chịu theo làng';
  const got = claimVillage(sim, t), a = takeVillage(sim, t), name = t.def.name;
  removeTribe(sim, t);
  const joined = sim.settle(a.pop, true).length;
  sim.say(`${name} theo làng ta và biến mất khỏi bản đồ: ${joined} người ở lại, làng chứa thêm được ${a.pop} dân và mỗi trại lính thêm ${a.slots} chỗ${got.length ? `; ta nhận ${got.join(', ')}` : ''}.`);
  return null;
}

/**
 * We go to war on `target`: the villages that stand by us send soldiers (difficulty.json capture.allies): a tributary of any tier, and a village we have won over with
 * gifts (relation 100) but not the middle tier; as many as the relation allows of the number of their tier, shared out among foot, throwers and riders. They come to our fire,
 * take what they wear from our Kho vũ khí like our own soldiers, fight with the research of ours, and go when the war is over (dismissAllies). Each pays for it in relation.
 * Returns how many came.
 */
export function summonAllies(sim: Sim, target: Tribe): number {
  const c = DIFF.capture.allies, fire = sim.campfire(), s = sim.world.start;
  let total = 0;
  for (const a of sim.tribes) {
    if (a === target || a.boss || a.rebel || a.tier === 'boss' || a.tier === 'rebel') continue;
    const gift = a.state === 'free' && a.relation >= 100 && a.tier !== 'medium';
    if (a.state !== 'tribute' && !gift) continue;
    const n = Math.min(Math.round(((c as unknown as Record<string, number>)[a.tier] ?? 0) * Math.max(0, Math.min(100, a.relation)) / 100), c.max - total); // the allies of all the villages together are at most `max` (33)
    if (n <= 0) continue;
    const arms = (['foot', 'archer', 'cavalry'] as const).map((_, i) => Math.floor(n / 3) + (i < n % 3 ? 1 : 0));
    (['foot', 'archer', 'cavalry'] as const).forEach((arm, i) => {
      for (let k = 0; k < arms[i]; k++) {
        const ang = sim.frnd() * Math.PI * 2, r = 3 + sim.frnd() * 3;
        const gx = Math.floor((fire ? fire.x + 1 : s.x) + Math.cos(ang) * r), gy = Math.floor((fire ? fire.y + 3 : s.y) + Math.sin(ang) * r), spot = sim.nearestFree(gx, gy, new Set()) ?? [gx, gy];
        const v = sim.makeVillager(spot[0], spot[1], 'm', 'player', sim.frnd); // an allied soldier is a man
        v.job = 'fight'; v.arm = arm; v.post = -1; v.guard = false; v.energy = 100; v.ally = { tribe: a.id, leaving: false, since: sim.time };
        sim.villagers.push(v); sim.registerUnit(v); sim.equipGear(v);
        total++;
      }
    });
    a.relation = Math.max(-100, a.relation - (gift ? c.giftLoss : c.battleLoss));
    sim.say(`${a.def.name} gửi ${n} lính giúp ta đánh ${target.def.name}.`);
  }
  return total;
}

/** The war is over: the allies go, away from our fire, and when the camera is not on them they are no more (tickAllies). */
export function dismissAllies(sim: Sim): void {
  for (const v of sim.villagers) if (v.ally && !v.ally.leaving) { v.ally.leaving = true; v.ally.since = sim.time; sim.clearCombat(v); sim.leaveSquad([v.id]); v.recall = false; }
}

/** Once a second: an ally who is leaving walks away from our fire; out of the camera's sight (or far, or long enough) he is gone, and what he wore goes back to the store. */
function tickAllies(sim: Sim): void {
  const fire = sim.campfire(), fx = fire?.x ?? sim.world.start.x, fy = fire?.y ?? sim.world.start.y;
  for (const v of [...sim.villagers]) {
    if (!v.ally?.leaving) continue;
    const far = Math.hypot(v.x - fx, v.y - fy) > 30, watched = !!sim.view && sim.inView(v.x, v.y);
    if ((far && !watched) || sim.time - v.ally.since > 240) { sim.discharge([v.id]); sim.vanish(v); continue; }
    if (!v.path.length) {
      const t = tribeOf(sim, v.ally.tribe as TribeId), toward = t ? Math.atan2(t.camp.y - fy, t.camp.x - fx) : sim.frnd() * Math.PI * 2;
      sim.orderMove([v.id], fx + Math.cos(toward) * 40, fy + Math.sin(toward) * 40);
    }
  }
}

function releaseRaiders(sim: Sim, t: Tribe): void {
  for (const u of t.unitIds) { const f = sim.get(u); if (f?.ai?.role === 'raider') { f.ai.role = 'guard'; f.ai.raid = 0; f.fight.target = null; f.path = []; } }
}

// ---------------------------------------------------------------- tribe upkeep (once per tick, cheap)
export function tickTribes(sim: Sim, dt: number): void {
  const war = warTribe(sim); // at war only the tribe under attack lives on: no events, no other tribe
  if (!war) { tickEvents(sim); seasonEvent(sim); }
  sim.tribeClock += dt;
  if (sim.tribeClock < 1) return;
  sim.tribeClock = 0;
  refreshActive(sim);
  tickAllies(sim);
  if (!war && sim.frontier.day !== sim.day) { sim.frontier.day = sim.day; tickFrontier(sim, { spawn: spawnTribe, remove: removeTribe, retier: retierTribe }); } // once a day
  for (const t of sim.tribes) {
    if (war && t.id !== war) continue;
    t.unitIds = t.unitIds.filter((u) => { const f = sim.get(u); return !!f && f.health > 0; });
    if (t.boss && !t.bossDown && t.state !== 'free') {
      t.bossDown = true; t.bossDownAt = sim.time;
      const left = sim.tribes.filter((q) => q.boss && !q.bossDown).length;
      sim.say(left ? `${t.def.name} đã sụp đổ. Còn ${left} thủ lĩnh phải hạ trước khi sang thời Trung cổ.` : `Chuyển thời kỳ! ${t.def.name} đã sụp đổ, thủ lĩnh cuối cùng: ta đã có thể nâng Nhà chung lên Nhà chính.`);
    }
    const hc = headcount(sim, t);
    if (t.state !== 'destroyed') tickLod(sim, t, !!t.raid || war === t.id || sim.plans.some((p) => p.kind === 'attack' && p.status === 'running' && p.tribe === t.id), tribeHostile(sim, t.id));
    if (t.bandit && t.state === 'free' && hc.guards + hc.civs === 0) { if (t.harmed) crushBandit(sim, t); else { sim.frontier.bandit[t.id] = sim.day + 1; removeTribe(sim, t); } continue; }
    if (t.state === 'free' && hc.guards + hc.civs === 0) { t.state = 'destroyed'; t.raid = null; sim.say(`${t.def.name} đã bị xóa sổ.`); if (t.harmed) { const got = claimVillage(sim, t), a = takeVillage(sim, t); sim.say(`${t.def.name}: ta nhận ${got.length ? got.join(', ') : 'chưa được gì từ kho của họ'}; làng chứa thêm được ${a.pop} dân và mỗi trại lính thêm ${a.slots} chỗ.`); } continue; }
    if (t.state === 'tribute' && sim.day >= t.nextTribute) payTribute(sim, t);
    if (t.state !== 'destroyed' && t.recoveredDay !== sim.day && war !== t.id) { t.recoveredDay = sim.day; recoverTribe(sim, t, DIFF.capture.tribute.recoverPerDay); }
    if (!war) hostileRaid(sim, t);
    if (t.state === 'free') { advanceTribe(sim, t); manageRaid(sim, t); }
  }
}

/** A rebel beaten is a rebel no more: it goes back to what it was (its tier, a tributary), and pays the base share and more for good (capture.rebel.returnBonus), with no relation lost for that part. */
function returnRebel(sim: Sim, t: Tribe): void {
  const c = DIFF.capture;
  t.rebel = false; t.boss = false; t.bossDown = true; t.bossDownAt = sim.time; t.tier = t.baseTier ?? t.def.tier;
  t.state = 'tribute'; t.raid = null; t.relation = Math.max(t.relation, RELATION.tributeAt);
  t.tributeFree = c.rebel.returnBonus; t.tributeShare = c.tribute.baseShare + c.rebel.returnBonus; t.nextTribute = sim.day + c.tribute.everyDays;
  rescaleTribe(sim, t); releaseRaiders(sim, t);
  sim.say(`${t.def.name} bị đánh bại, không còn là thủ lĩnh: họ chịu cống nạp ${Math.round(t.tributeShare * 100)}% túi mỗi ${c.tribute.everyDays} ngày, không bị trừ quan hệ.`);
}

/** A camp of bandits is wiped out or beaten: we take its bag, it is gone from the map, and (tribefrontier.ts) another camp is put up in its place after a few days. */
export function crushBandit(sim: Sim, t: Tribe): void {
  const got = claimVillage(sim, t);
  sim.say(`${t.def.name} bị diệt: ta nhận ${got.length ? got.join(', ') : 'chưa được gì'}.`);
  sim.frontier.bandit[t.id] = sim.day + DIFF.capture.bandit.respawnMin + Math.floor(sim.frnd() * (DIFF.capture.bandit.respawnMax - DIFF.capture.bandit.respawnMin + 1));
  removeTribe(sim, t);
}

export function surrender(sim: Sim, t: Tribe, why: string): void {
  if (t.bandit) { crushBandit(sim, t); return; }
  if (t.rebel) { returnRebel(sim, t); return; }
  t.state = 'surrendered'; t.raid = null; t.angryUntil = 0;
  releaseRaiders(sim, t);
  for (const u of t.unitIds) { const f = sim.get(u); if (f) { f.fight.target = null; f.fleeT = 0; f.path = []; f.phase = 'idle'; } }
  sim.pendingTribe = t.id;
  sim.say(`${why}: ${t.def.name} xin hàng! Chọn thu nạp hoặc cống nạp.`);
}

// ---------------------------------------------------------------- raids
function manageRaid(sim: Sim, t: Tribe): void {
  const r = t.raid;
  if (!r) return;
  r.t += 1;
  const raiders = t.unitIds.map((u) => sim.get(u)!).filter((u) => u?.ai?.raid === r.id);
  const playerAlive = sim.villagers.some((v) => v.health > 0);
  const over = r.night !== undefined && r.night !== sim.restTime;
  if (r.phase === 'march' && (raiders.length === 0 || r.t > r.max || !playerAlive || over)) {
    r.phase = 'retreat'; if (raiders.length) sim.say(`Quân ${t.def.name} rút lui.`);
  }
  if (r.phase === 'retreat') {
    const home = raiders.every((u) => Math.hypot(u.x - t.camp.x, u.y - t.camp.y) < 7);
    if (raiders.length === 0 || home || r.t > r.max + 120) { releaseRaiders(sim, t); t.raid = null; }
  }
}

/** The weak do not attack: a chief who sees many more soldiers than he can send waits another day. */
export function raidAdvised(sim: Sim, t: Tribe, size: number): boolean {
  const ours = sim.villagers.filter((v) => v.job === 'fight').length, theirs = Math.min(size, headcount(sim, t).guards);
  return ours < 6 || theirs >= ours * 0.35;
}

export function launchRaid(sim: Sim, t: Tribe, size: number, night?: boolean): void {
  wake(sim, t);
  const inWorld = t.unitIds.filter((u) => sim.get(u)?.ai?.role === 'guard').length;
  if (size > inWorld) releaseCrowd(sim, t, size - inWorld); // the soldiers who were indoors are called out for it
  const guards = t.unitIds.map((u) => sim.get(u)!).filter((u) => u?.ai?.role === 'guard').sort((a, b) => b.maxHealth - a.maxHealth);
  const n = Math.min(size, guards.length);
  if (n < 3 || t.raid) return;
  const id = ++sim.nextRaid;
  t.raid = { id, phase: 'march', t: 0, max: night === undefined ? 200 : 99999, size: n, night };
  // a clever chief answers what he sees: many archers in the village, he sends foot soldiers to close with them; mostly foot, he adds archers
  const ours = sim.villagers.filter((v) => v.job === 'fight'), oursArch = ours.filter((v) => armOfWeapon(v.weapon) === 'archer').length, wantArch = ours.length >= 4 && oursArch * 2 <= ours.length ? Math.floor(n / 3) : 0;
  const melee = t.def.weapons.filter((w) => !WEAPONS[w]?.ranged), picks = guards.slice(0, n);
  picks.forEach((g, i) => { g.ai!.role = 'raider'; g.ai!.raid = id; g.fight.target = null; g.path = []; g.fleeT = 0; if (!g.weapon?.startsWith('bronze')) g.weapon = i < wantArch ? (i % 2 ? 'sling' : 'bow') : melee[i % Math.max(1, melee.length)] ?? g.weapon; });
  t.angryUntil = sim.time + 400;
  const arch = picks.filter((g) => armOfWeapon(g.weapon) === 'archer').length;
  sim.addAlert('raid', `Quân ${t.def.name} (${n} người) đang kéo tới làng!`);
  sim.say(`Quân ${t.def.name} (${n} người${sim.mapLevel(t.id) >= 3 ? `: ${arch} cung thủ, ${n - arch} bộ binh` : ''}) đang tiến vào làng!`);
}

/** A raid of a chosen make-up, for the dev tools: the weapons of each man are given, they start part-way to the village and march at once. */
export function launchCustomRaid(sim: Sim, t: Tribe, weapons: string[], armor: boolean, angers = true, night?: boolean): void {
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  const dx = t.camp.x - fx, dy = t.camp.y - fy, len = Math.max(1, Math.hypot(dx, dy)), dist = Math.min(26, len);
  const id = ++sim.nextRaid;
  if (angers) t.relation = Math.min(t.relation, -60);
  t.raid = { id, phase: 'march', t: 0, max: night === undefined ? 900 : 99999, size: weapons.length, night };
  weapons.forEach((weapon, i) => {
    const ang = (i / weapons.length) * Math.PI * 2, gx = Math.floor(fx + (dx / len) * dist + Math.cos(ang) * 2), gy = Math.floor(fy + (dy / len) * dist + Math.sin(ang) * 2);
    const spot = sim.nearestFree(gx, gy, new Set()) ?? [gx, gy];
    const f = sim.makeVillager(spot[0], spot[1], 'm', t.id, sim.frnd); // the raiders are men
    f.look.hide = t.def.look.hide; f.look.pants = t.def.look.pants;
    f.weapon = weapon; f.armor = armor ? 'hide' : null;
    f.ai = { role: 'raider', camp: t.camp, wander: 0, goal: null, raid: id };
    sim.addFoe(f); t.unitIds.push(f.id);
    applyStats(sim, f); f.health = f.maxHealth;
  });
  t.angryUntil = sim.time + 400;
  sim.addAlert('raid', `Quân ${t.def.name} (${weapons.length} người) đang kéo tới làng!`);
  sim.say(`Quân ${t.def.name} (${weapons.length} người) đang tiến vào làng!`);
}

/** A pack of `species` (an animal of animals.json) comes at the village from about 28 tiles away. */
export function launchBeasts(sim: Sim, size: number, species: Species = 'wolf', night?: boolean): number | null {
  const fire = sim.campfire(), s = sim.world.start, cx = fire ? fire.x + 1 : s.x, cy = fire ? fire.y + 1 : s.y, herd = 9000 + sim.nextRaid;
  let placed = 0;
  const ang0 = sim.frnd() * Math.PI * 2;
  for (let tries = 0; tries < 80 && placed < size; tries++) {
    const a = ang0 + (sim.frnd() - 0.5) * 0.8, d = 26 + sim.frnd() * 6;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, tx = Math.floor(x), ty = Math.floor(y);
    if (!sim.world.inBounds(tx, ty) || sim.world.isBlocked(tx, ty)) continue;
    const w = spawnAnimal(sim, species, x, y, 9000 + sim.nextRaid, true, night);
    w.state = 'graze'; w.timer = 0; placed++;
  }
  sim.nextRaid++;
  if (placed) sim.addAlert(species === 'wolf' ? 'wolf' : 'beast', `${species === 'wolf' ? 'Bầy sói' : ANIMALS[species].name} (${placed} con) đang kéo tới quanh làng!`);
  if (placed) sim.say(`${species === 'wolf' ? 'Bầy sói đói' : `${ANIMALS[species].name} (${placed} con)`} kéo tới quanh làng! Đốt lửa và giữ dân gần đống lửa.`);
  return placed ? herd : null;
}

/** events.json "army": { "spear": 3, "bow": 2 } -> ['spear', 'spear', 'spear', 'bow', 'bow'] */
export const armyWeapons = (army: Record<string, number>): string[] => Object.entries(army).flatMap(([w, n]) => Array.from({ length: n }, () => w));

// ---------------------------------------------------------------- scheduled events
function initEvents(sim: Sim, from = 0): void {
  for (const e of eventsJson.events as Array<{ id: string; kind: 'beasts' | 'raid'; species?: Species; tribe?: TribeId; army?: Record<string, number>; armor?: boolean; power?: number; day: number; spread: number; size?: number; night: boolean; warnDays?: number; warn: string }>) {
    const fireDay = from + e.day + Math.floor(sim.frnd() * (e.spread + 1)), size = e.army ? armyWeapons(e.army).length : e.size ?? 1;
    sim.events.push({ id: e.id, kind: e.kind, tribe: e.tribe, species: e.species, army: e.army, armor: e.armor, power: e.power, fireDay, warnDay: fireDay - (e.warnDays ?? 1), size, night: e.night, warn: e.warn, warned: false, fired: false });
  }
}

/** How many of its soldiers a tribe sends to make a raid of `ratio` times the army of the player now. */
function raidSizeFor(sim: Sim, t: Tribe, ratio: number): number {
  wake(sim, t); // its soldiers are worked out from the men themselves
  const me = sim.power(), tp = sim.tribePower(t), want = raidPower(me.military, ratio, fireLevelOf(sim)), each = tp.soldiers > 0 ? tp.military / tp.soldiers : 1;
  return Math.max(3, Math.ceil(want / Math.max(0.01, each)));
}

/**
 * The pressure that never runs out (events.json "recurring"): from a day on, every few days a new event is set for the next days, drawn from a table: beasts as many as
 * our army calls for, or a raid of a hostile village as strong as a share of our army. Waiting does not get past it.
 */
function seasonEvent(sim: Sim): void {
  const c = eventsJson.recurring;
  if (sim.day < c.fromDay || sim.day < sim.nextEventDay) return;
  sim.nextEventDay = sim.day + c.everyDays;
  for (let i = sim.events.length - 1; i >= 0; i--) if (sim.events[i].fired && sim.events[i].fireDay < sim.day - 20) sim.events.splice(i, 1);
  const foes = sim.tribes.filter(raidsUs);
  const table = c.table.filter((x) => x.kind !== 'raid' || foes.length > 0), total = table.reduce((a, x) => a + x.weight, 0);
  let pick = sim.frnd() * total, row = table[0];
  for (const x of table) { pick -= x.weight; if (pick <= 0) { row = x; break; } }
  const fireDay = sim.day + c.leadDays[0] + Math.floor(sim.frnd() * (c.leadDays[1] - c.leadDays[0] + 1)), night = sim.frnd() < c.nightChance;
  const soldiers = sim.villagers.filter((v) => v.job === 'fight' && !v.ally).length;
  if (row.kind === 'raid') {
    const t = foes[Math.floor(sim.frnd() * foes.length)];
    sim.events.push({ id: `season${sim.day}`, kind: 'raid', tribe: t.id, power: row.power, fireDay, warnDay: fireDay - 1, size: 4, night, warn: `${row.warn} (${t.def.name})`, warned: false, fired: false });
  } else {
    const size = Math.max(1, Math.min(row.max ?? 99, Math.round((row.base ?? 1) + (row.perSoldier ?? 0) * soldiers)));
    sim.events.push({ id: `season${sim.day}`, kind: 'beasts', species: row.species as Species, fireDay, warnDay: fireDay - 1, size, night, warn: row.warn, warned: false, fired: false });
  }
}

/** Does this village raid us now: it is free and not at peace with us (relation under events.json hostile.raidBelow), and not of the peaceful kind unless it is already at odds with us or turned on us. */
function raidsUs(t: Tribe): boolean {
  return t.state === 'free' && !t.raid && t.relation < eventsJson.hostile.raidBelow && (t.rebel || t.def.personality !== 'peaceful' || t.relation < HOSTILE_BELOW);
}

/** A village at odds with us (and a rebel chief) raids by itself now and then (events.json "hostile"), as strong as a share of our army by its tier; a village that is our friend, or one that is held back, does not. */
function hostileRaid(sim: Sim, t: Tribe): void {
  const h = eventsJson.hostile;
  if (sim.day < h.fromDay || !raidsUs(t)) return;
  if (t.allyOf && sim.tribes.some((q) => q.id === t.allyOf && q.state === 'free')) return; // a village taken back by a newcomer comes only with it (below), unless the newcomer is gone
  t.nextRaidDay ??= sim.day + 1 + Math.floor(sim.frnd() * h.raidEveryDays); // each village has its own rhythm: they do not all come on the same day
  if (sim.day < t.nextRaidDay) return;
  const size = raidSizeFor(sim, t, (h.power as Record<string, number>)[t.tier] ?? 0.5);
  if (!raidAdvised(sim, t, size)) { t.nextRaidDay = sim.day + 1; return; }
  t.nextRaidDay = sim.day + h.raidEveryDays; launchRaid(sim, t, size);
  // its allies (the villages it took back from us) strike with it, on the same day, each with its own men
  for (const a of sim.tribes) {
    if (a.allyOf !== t.id || a.state !== 'free' || a.raid || !raidsUs(a)) continue;
    a.nextRaidDay = sim.day + h.raidEveryDays;
    launchRaid(sim, a, raidSizeFor(sim, a, (h.power as Record<string, number>)[a.tier] ?? 0.5));
    sim.say(`${a.def.name} cùng ${t.def.name} tập kích ta!`);
  }
}

/** A little of the spoils for beating an event (events.json "reward": a share of the goods per head, more for a raid than for beasts). Returns what was had, in words. */
function rewardEvent(sim: Sim, e: EventState): string[] {
  const c = eventsJson.reward, mult = e.kind === 'raid' ? c.raidMult : c.beastMult, got: string[] = [];
  for (const [k, per] of Object.entries(c.perHead)) {
    const res = k as keyof Stock, n = Math.max(1, Math.round(per * mult * e.size)), take = Math.max(0, Math.min(n, sim.capacity(res) - sim.stock[res]));
    if (take <= 0) continue;
    sim.stock[res] += take; got.push(`${take} ${RES_NAME[res].toLowerCase()}`);
  }
  return got;
}

function tickEvents(sim: Sim): void {
  for (const e of sim.events) {
    if (e.live) { // an event that has begun: tell the player when the last of it is gone, and reward the village when it was beaten
      const tribe = e.tribe ? tribeOf(sim, e.tribe) : undefined;
      const alive = e.kind === 'beasts' ? sim.animals.filter((a) => a.herd === e.herd && a.raid && a.hp > 0 && a.state !== 'dead').length : sim.foes.filter((f) => f.ai?.raid === e.raidId && f.health > 0).length;
      const over = e.kind === 'beasts' ? alive === 0 : !tribe?.raid;
      if (!over) e.left = alive;
      else {
        e.live = false;
        const beaten = e.kind === 'beasts' ? sim.animals.some((a) => a.herd === e.herd && a.state === 'dead') : (e.left ?? 1) === 0;
        const got = beaten ? rewardEvent(sim, e) : [];
        const text = beaten ? `Đã đẩy lùi ${e.kind === 'beasts' ? 'bầy thú' : 'quân tập kích'}!${got.length ? ` Thu được ${got.join(', ')}.` : ''}` : e.kind === 'beasts' ? 'Bầy thú đã bỏ đi: làng yên trở lại.' : 'Quân tập kích đã rút lui.';
        sim.say(text); sim.addAlert('clear', text);
      }
    }
    if (e.fired) continue;
    if (e.kind === 'raid' && e.power !== undefined && e.tribe && e.sizeDay !== sim.day) { const t = tribeOf(sim, e.tribe); if (t && t.state === 'free') { e.size = raidSizeFor(sim, t, e.power); e.sizeDay = sim.day; } }
    if (!e.warned && sim.day >= e.warnDay && sim.tod >= 0.3) { e.warned = true; sim.say(e.warn); sim.addAlert('notice', `Sắp có biến cố: ${e.warn}`); }
    if (sim.day < e.fireDay) continue;
    const ready = e.night ? sim.restTime : sim.tod >= 0.28 && !sim.restTime;
    if (!ready) continue;
    e.fired = true;
    if (e.kind === 'beasts') { const herd = launchBeasts(sim, e.size, e.species ?? 'wolf', e.night); if (herd !== null) { e.live = true; e.herd = herd; } }
    else if (e.tribe) {
      const t = tribeOf(sim, e.tribe);
      if (t && t.state === 'free' && t.relation < DIFF.capture.gift.friendAt) { if (raidAdvised(sim, t, e.size) || e.fireDay >= e.warnDay + 4) { (e.army ? launchCustomRaid(sim, t, armyWeapons(e.army), e.armor ?? true, false, e.night) : launchRaid(sim, t, e.size, e.night)); e.live = !!t.raid; e.raidId = t.raid?.id; e.left = e.size; } else { e.fired = false; e.fireDay = sim.day + 1; e.warned = true; sim.say(`${t.def.name} thấy làng đông quân và hoãn tập kích.`); } }
    }
  }
}

/** Dev: fire one scheduled event now, for the part of the day it is (a pack stays for one part of the day only). Returns why it could not, or null. */
export function fireEventNow(sim: Sim, e: Sim['events'][number]): string | null {
  const night = sim.restTime;
  if (e.kind === 'beasts') { e.fired = true; launchBeasts(sim, e.size, e.species ?? 'wolf', night); return null; }
  const t = e.tribe ? tribeOf(sim, e.tribe) : undefined;
  if (!t || t.state !== 'free') return `${t?.def.name ?? 'Bộ tộc'} không còn là kẻ địch`;
  if (t.raid) return 'Họ đang tập kích rồi';
  e.fired = true;
  if (e.army) launchCustomRaid(sim, t, armyWeapons(e.army), e.armor ?? true, false, night); else launchRaid(sim, t, e.size, night);
  return null;
}


// ---------------------------------------------------------------- how strong a village is
/** Whenever the player's campfire is raised the target of a tribe moves (its tier follows his fire) and the tribe is worked out again; once a day too. */
function advanceTribe(sim: Sim, t: Tribe): void {
  // an old save has none of this: start the tribe off now
  if (t.seenFire !== fireLevelOf(sim) || t.popLevel !== t.campLevel) followFire(sim, t);
  if (t.seenDay !== sim.day) {
    t.seenDay = sim.day;
    rescaleTribe(sim, t);
  } else if (t.seenFire !== fireLevelOf(sim)) rescaleTribe(sim, t);
}

/** The percent the research-like bonus of a tribe adds to a stat of its people. */
export function foeBonus(sim: Sim, team: string, stat: StatId): number {
  const t = tribeOf(sim, team as Team);
  if (!t) return 0;
  return stat === 'hp' || stat === 'atk' || stat === 'defm' || stat === 'defr' ? (t.mil ?? 0) * 100 : stat === 'work' ? (t.eco ?? 0) * 100 : 0;
}
