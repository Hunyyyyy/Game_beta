import eventsJson from '../data/events.json';
import { DAY_LENGTH } from './constants';
import { cycleOf, WEAPONS, HOSTILE_BELOW, RELATION, ringOf, ringPower, RULES, SIEGE, SURRENDER, TRIBE_IDS, TRIBES, TribeDef, TribeId, Team, maxHpOf } from './combat';
import { engage, resolve, swingTimes, tickCommon, threatsOf, weaponOf } from './battle';
import { BUILDINGS } from './buildings';
import { armOfWeapon } from './formations';
import { SEASON_DAYS } from './calendar';
import { spawnAnimal } from './fauna';
import type { Stock } from './resources';
import type { Sim, Villager } from './sim';
import { Tile } from './world';

export type TribeState = 'free' | 'surrendered' | 'tribute' | 'adopted' | 'destroyed';

export interface Raid {
  id: number;
  phase: 'march' | 'retreat';
  t: number;
  max: number;
  size: number;
}

export interface Tribe {
  id: TribeId;
  def: TribeDef;
  camp: { x: number; y: number };   // centre of the fire
  props: Array<{ x: number; y: number; w: number; h: number; kind: 'fire' | 'pile' | 'tower' | 'fence' | 'gate'; hp: number }>;
  relation: number;                  // -100..100
  state: TribeState;
  angryUntil: number;                // sim time: being attacked keeps them hostile for a while
  unitIds: number[];
  leaderId: number;
  holdT: number;                     // seconds the player has held their fire
  nextTribute: number;               // day of the next tribute payment
  raid: Raid | null;
  loot: Partial<Stock>;
  lastAngry: number;                 // throttles the "they are angry" message
}

export interface EventState {
  id: string;
  kind: 'wolves' | 'raid';
  tribe?: TribeId;
  fireDay: number;
  warnDay: number;
  size: number;
  night: boolean;
  warn: string;
  warned: boolean;
  fired: boolean;
}

export const tribeOf = (sim: Sim, id: Team): Tribe | undefined => sim.tribes.find((t) => t.id === id);
export const POP_CAP = 40;

/** Current standing as a label. */
export const standing = (t: Tribe) => (t.state === 'free' ? t.relation : t.state === 'tribute' ? Math.max(60, t.relation) : t.relation);

// ---------------------------------------------------------------- spawning
export function spawnTribes(sim: Sim): void {
  for (const id of TRIBE_IDS) spawnTribe(sim, id);
  initEvents(sim);
}

function campFits(sim: Sim, cx: number, cy: number): boolean {
  const w = sim.world, r = 7;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (!w.inBounds(x, y)) return false;
    if (Math.hypot(x - cx, y - cy) <= r && w.at(x, y) === Tile.Water) return false;
  }
  return true;
}

function spawnTribe(sim: Sim, id: TribeId): void {
  const def = TRIBES[id], w = sim.world, s = w.start, N = w.size;
  let cx = -1, cy = -1;
  search: for (let dd = 0; dd <= 24; dd += 3) for (const sign of dd ? [1, -1] : [1]) for (let da = 0; da <= 90; da += 15) for (const as of da ? [1, -1] : [1]) {
    const ang = ((def.angle + da * as) * Math.PI) / 180, d = def.distance + dd * sign;
    const x = Math.round(s.x + Math.cos(ang) * d), y = Math.round(s.y + Math.sin(ang) * d);
    if (x > 9 && y > 9 && x < N - 9 && y < N - 9 && campFits(sim, x, y)) { cx = x; cy = y; break search; }
  }
  if (cx < 0) return;
  // clear a round yard
  for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) {
    if (Math.hypot(x - cx, y - cy) > 6.5) continue;
    const i = y * N + x; w.nodes.delete(i); w.tiles[i] = Tile.Grass; w.decor[i] = 0;
  }
  const props: Tribe['props'] = [
    { x: cx, y: cy, w: 2, h: 2, kind: 'fire', hp: SIEGE.propHp.fire }, { x: cx - 5, y: cy - 1, w: 2, h: 2, kind: 'pile', hp: SIEGE.propHp.pile }, { x: cx + 4, y: cy + 1, w: 2, h: 2, kind: 'pile', hp: SIEGE.propHp.pile },
  ];
  for (const p of props) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) w.occ[(p.y + j) * N + p.x + i] = 1;
  const power = ringPower(ringOf(Math.hypot(cx - s.x, cy - s.y)));
  const camp = { x: cx + 1, y: cy + 1 };
  const tribe: Tribe = {
    id, def, camp, props, relation: def.relation, state: 'free', angryUntil: 0, unitIds: [], leaderId: -1, holdT: 0, nextTribute: 0, raid: null,
    loot: Object.fromEntries(Object.entries(def.tribute).map(([k, v]) => [k, (v ?? 0) * 2])) as Partial<Stock>, lastAngry: -999,
  };
  sim.tribes.push(tribe);
  const total = def.civilians + def.warriors;
  for (let i = 0; i < total; i++) {
    const warrior = i < def.warriors, ang = sim.frnd() * Math.PI * 2, r = 2.5 + sim.frnd() * 3.5;
    const f = sim.makeVillager(Math.floor(camp.x + Math.cos(ang) * r), Math.floor(camp.y + Math.sin(ang) * r), sim.frnd() < 0.5 ? 'm' : 'f', id, sim.frnd);
    f.look.hide = def.look.hide; f.look.pants = def.look.pants;
    f.stats.str = Math.round(f.stats.str * power + (warrior ? 1 : 0));
    f.maxHealth = Math.round(maxHpOf(f.stats.vit) * power); f.health = f.maxHealth;
    if (warrior) { f.weapon = def.weapons[i % def.weapons.length]; f.armor = def.armor ? 'hide' : null; }
    f.ai = { role: warrior ? 'guard' : 'civ', camp, wander: sim.frnd() * 5, goal: null, raid: 0 };
    sim.addFoe(f); tribe.unitIds.push(f.id);
  }
  const warriors = tribe.unitIds.map((u) => sim.get(u)!).filter((u) => u.ai!.role === 'guard');
  if (warriors.length >= 1) { const lead = warriors.sort((a, b) => b.stats.str + b.stats.vit - a.stats.str - a.stats.vit)[0]; lead.leader = true; tribe.leaderId = lead.id; }
}

// ---------------------------------------------------------------- relations and diplomacy
export function tribeHostile(sim: Sim, id: Team): boolean {
  const t = tribeOf(sim, id);
  return !!t && t.state === 'free' && (t.relation < HOSTILE_BELOW || sim.time < t.angryUntil || !!t.raid);
}

export function tribeAttacked(sim: Sim, id: Team, victim: Villager): void {
  const t = tribeOf(sim, id);
  if (!t || t.state !== 'free') return;
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
  if (killer?.team === 'player') {
    t.relation = Math.max(-100, t.relation + (v.ai?.role === 'civ' ? RELATION.killCivilian : RELATION.killWarrior));
    t.angryUntil = sim.time + 120;
  }
  if (v.id === t.leaderId) sim.say(`Thủ lĩnh ${t.def.name} đã gục ngã.`);
  sim.onKill?.();
}

export function giftTribe(sim: Sim, id: TribeId): string | null {
  const t = tribeOf(sim, id);
  if (!t || t.state === 'destroyed' || t.state === 'adopted') return 'Không còn ai để tặng';
  if (sim.stock.food < RELATION.giftFood) return `Cần ${RELATION.giftFood} thức ăn để làm quà`;
  sim.stock.food -= RELATION.giftFood;
  t.relation = Math.min(100, t.relation + RELATION.giftGain);
  if (t.relation >= HOSTILE_BELOW) t.angryUntil = Math.min(t.angryUntil, sim.time);
  return null;
}

export function canTribute(t: Tribe): boolean {
  return t.state === 'surrendered' || (t.state === 'free' && t.relation >= RELATION.tributeAt);
}
export function canAdopt(t: Tribe): boolean {
  return t.state === 'surrendered' || (t.state === 'free' && t.def.personality === 'peaceful' && t.relation >= RELATION.joinAt);
}

export function tributeTribe(sim: Sim, id: TribeId): string | null {
  const t = tribeOf(sim, id);
  if (!t || !canTribute(t)) return 'Họ chưa chịu cống nạp';
  t.state = 'tribute'; t.relation = Math.max(t.relation, RELATION.tributeAt); t.raid = null;
  t.nextTribute = sim.day + SEASON_DAYS;
  if (sim.pendingTribe === id) sim.pendingTribe = null;
  releaseRaiders(sim, t);
  sim.say(`${t.def.name} chịu cống nạp: mỗi mùa họ gửi tài nguyên và không đánh làng nữa.`);
  return null;
}

export function adoptTribe(sim: Sim, id: TribeId): string | null {
  const t = tribeOf(sim, id);
  if (!t || !canAdopt(t)) return 'Họ chưa chịu theo làng';
  const cap = sim.popCap(), room = cap - sim.villagers.length;
  if (room <= 0) return `Làng đã đủ ${cap} dân: hãy nâng đống lửa trại để chứa thêm`;
  const units = t.unitIds.map((u) => sim.get(u)).filter((u): u is Villager => !!u).sort((a) => (a.ai?.role === 'civ' ? 0 : 1)); // civilians first
  let taken = 0;
  for (const f of units) {
    if (taken >= room) { sim.removeFoe(f); continue; }
    sim.adoptFoe(f); taken++;
  }
  for (const [k, n] of Object.entries(t.loot)) sim.stock[k as keyof Stock] = Math.min(sim.capacity(), sim.stock[k as keyof Stock] + (n ?? 0));
  t.unitIds = []; t.state = 'adopted'; t.relation = 100; t.raid = null;
  if (sim.pendingTribe === id) sim.pendingTribe = null;
  sim.say(`${taken} người của ${t.def.name} gia nhập làng.${units.length > taken ? ' Số còn lại không có chỗ nên tản đi.' : ''}`);
  return null;
}

function releaseRaiders(sim: Sim, t: Tribe): void {
  for (const u of t.unitIds) { const f = sim.get(u); if (f?.ai?.role === 'raider') { f.ai.role = 'guard'; f.ai.raid = 0; f.fight.target = null; f.path = []; } }
}

// ---------------------------------------------------------------- tribe upkeep (once per tick, cheap)
export function tickTribes(sim: Sim, dt: number): void {
  tickEvents(sim);
  sim.tribeClock += dt;
  if (sim.tribeClock < 1) return;
  sim.tribeClock = 0;
  for (const t of sim.tribes) {
    t.unitIds = t.unitIds.filter((u) => { const f = sim.get(u); return !!f && f.health > 0; });
    if (t.state === 'free' && t.unitIds.length === 0) { t.state = 'destroyed'; t.raid = null; sim.say(`${t.def.name} đã bị xóa sổ.`); continue; }
    if (t.state === 'tribute' && sim.day >= t.nextTribute) {
      t.nextTribute = sim.day + SEASON_DAYS;
      for (const [k, n] of Object.entries(t.def.tribute)) sim.stock[k as keyof Stock] = Math.min(sim.capacity(), sim.stock[k as keyof Stock] + (n ?? 0));
      sim.say(`${t.def.name} gửi cống nạp mùa này.`);
    }
    if (t.state === 'free') { checkSurrender(sim, t); manageRaid(sim, t); }
  }
}

function checkSurrender(sim: Sim, t: Tribe): void {
  if (sim.plans.some((p) => p.kind === 'attack' && p.status === 'running' && p.tribe === t.id)) return; // a village under attack fights on: it gives up only when the war is won
  const units = t.unitIds.map((u) => sim.get(u)!).filter(Boolean), warriors = units.filter((u) => u.ai?.role !== 'civ');
  // 1. the leader is down
  if (SURRENDER.leaderDown && t.leaderId >= 0 && !t.unitIds.includes(t.leaderId) && units.length) return surrender(sim, t, 'Thủ lĩnh đã gục');
  // 2. the player holds their fire for 30 seconds with no warrior left near it
  const intruders = sim.villagers.filter((v) => v.health > 0 && v.down <= 0 && Math.hypot(v.x - t.camp.x, v.y - t.camp.y) < 5).length;
  const defenders = warriors.filter((w) => Math.hypot(w.x - t.camp.x, w.y - t.camp.y) < 9).length;
  t.holdT = intruders > 0 && defenders === 0 && tribeHostile(sim, t.id) ? t.holdT + 1 : 0;
  if (t.holdT >= SURRENDER.holdCampSeconds) return surrender(sim, t, 'Đống lửa của họ đã bị chiếm');
}

export function surrender(sim: Sim, t: Tribe, why: string): void {
  t.state = 'surrendered'; t.raid = null; t.holdT = 0; t.angryUntil = 0;
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
  if (r.phase === 'march' && (raiders.length === 0 || r.t > r.max || !playerAlive)) {
    r.phase = 'retreat'; if (raiders.length) sim.say(`Quân ${t.def.name} rút lui.`);
  }
  if (r.phase === 'retreat') {
    const home = raiders.every((u) => Math.hypot(u.x - t.camp.x, u.y - t.camp.y) < 7);
    if (raiders.length === 0 || home || r.t > r.max + 120) { releaseRaiders(sim, t); t.raid = null; }
  }
}

/** The weak do not attack: a chief who sees many more soldiers than he can send waits another day. */
export function raidAdvised(sim: Sim, t: Tribe, size: number): boolean {
  const ours = sim.villagers.filter((v) => v.job === 'fight').length, theirs = Math.min(size, t.unitIds.filter((u) => sim.get(u)?.ai?.role === 'guard').length);
  return ours < 6 || theirs >= ours * 0.35;
}

export function launchRaid(sim: Sim, t: Tribe, size: number): void {
  const guards = t.unitIds.map((u) => sim.get(u)!).filter((u) => u?.ai?.role === 'guard').sort((a, b) => b.maxHealth - a.maxHealth);
  const n = Math.min(size, guards.length);
  if (n < 3 || t.raid) return;
  const id = ++sim.nextRaid;
  t.raid = { id, phase: 'march', t: 0, max: 200, size: n };
  // a clever chief answers what he sees: many archers in the village, he sends foot soldiers to close with them; mostly foot, he adds archers
  const ours = sim.villagers.filter((v) => v.job === 'fight'), oursArch = ours.filter((v) => armOfWeapon(v.weapon) === 'archer').length, wantArch = ours.length >= 4 && oursArch * 2 <= ours.length ? Math.floor(n / 3) : 0;
  const melee = t.def.weapons.filter((w) => !WEAPONS[w]?.ranged), picks = guards.slice(0, n);
  picks.forEach((g, i) => { g.ai!.role = 'raider'; g.ai!.raid = id; g.fight.target = null; g.path = []; g.fleeT = 0; g.weapon = i < wantArch ? (i % 2 ? 'sling' : 'bow') : melee[i % Math.max(1, melee.length)] ?? g.weapon; });
  t.angryUntil = sim.time + 400;
  const arch = picks.filter((g) => armOfWeapon(g.weapon) === 'archer').length;
  sim.say(`Quân ${t.def.name} (${n} người${sim.mapLevel(t.id) >= 3 ? `: ${arch} cung thủ, ${n - arch} bộ binh` : ''}) đang tiến vào làng!`);
}

/** A raid of a chosen make-up, for the dev tools: the weapons of each man are given, they start part-way to the village and march at once. */
export function launchCustomRaid(sim: Sim, t: Tribe, weapons: string[], armor: boolean): void {
  const fire = sim.campfire(), fx = fire ? fire.x + 1 : sim.world.start.x, fy = fire ? fire.y + 1 : sim.world.start.y;
  const dx = t.camp.x - fx, dy = t.camp.y - fy, len = Math.max(1, Math.hypot(dx, dy)), dist = Math.min(26, len);
  const id = ++sim.nextRaid, power = ringPower(ringOf(len));
  t.relation = Math.min(t.relation, -60);
  t.raid = { id, phase: 'march', t: 0, max: 900, size: weapons.length };
  weapons.forEach((weapon, i) => {
    const ang = (i / weapons.length) * Math.PI * 2, gx = Math.floor(fx + (dx / len) * dist + Math.cos(ang) * 2), gy = Math.floor(fy + (dy / len) * dist + Math.sin(ang) * 2);
    const spot = sim.nearestFree(gx, gy, new Set()) ?? [gx, gy];
    const f = sim.makeVillager(spot[0], spot[1], sim.frnd() < 0.5 ? 'm' : 'f', t.id, sim.frnd);
    f.look.hide = t.def.look.hide; f.look.pants = t.def.look.pants;
    f.stats.str = Math.round(f.stats.str * power + 1); f.maxHealth = Math.round(maxHpOf(f.stats.vit) * power); f.health = f.maxHealth;
    f.weapon = weapon; f.armor = armor ? 'hide' : null;
    f.ai = { role: 'raider', camp: t.camp, wander: 0, goal: null, raid: id };
    sim.addFoe(f); t.unitIds.push(f.id);
  });
  t.angryUntil = sim.time + 400;
  sim.say(`Quân ${t.def.name} (${weapons.length} người) đang tiến vào làng!`);
}

export function launchWolves(sim: Sim, size: number): void {
  const fire = sim.campfire(), s = sim.world.start, cx = fire ? fire.x + 1 : s.x, cy = fire ? fire.y + 1 : s.y;
  let placed = 0;
  const ang0 = sim.frnd() * Math.PI * 2;
  for (let tries = 0; tries < 80 && placed < size; tries++) {
    const a = ang0 + (sim.frnd() - 0.5) * 0.8, d = 26 + sim.frnd() * 6;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, tx = Math.floor(x), ty = Math.floor(y);
    if (!sim.world.inBounds(tx, ty) || sim.world.isBlocked(tx, ty)) continue;
    const w = spawnAnimal(sim, 'wolf', x, y, 9000 + sim.nextRaid, true);
    w.state = 'graze'; w.timer = 0; placed++;
  }
  sim.nextRaid++;
  if (placed) sim.say('Bầy sói đói kéo tới quanh làng! Đốt lửa và giữ dân gần đống lửa.');
}

// ---------------------------------------------------------------- scheduled events
function initEvents(sim: Sim): void {
  for (const e of eventsJson.events as Array<{ id: string; kind: 'wolves' | 'raid'; tribe?: TribeId; day: number; spread: number; size: number; night: boolean; warnDays?: number; warn: string }>) {
    const fireDay = e.day + Math.floor(sim.frnd() * (e.spread + 1));
    sim.events.push({ id: e.id, kind: e.kind, tribe: e.tribe, fireDay, warnDay: fireDay - (e.warnDays ?? 1), size: e.size, night: e.night, warn: e.warn, warned: !e.warn, fired: false });
  }
}

function tickEvents(sim: Sim): void {
  for (const e of sim.events) {
    if (e.fired) continue;
    if (!e.warned && sim.day >= e.warnDay && sim.tod >= 0.3) { e.warned = true; sim.say(e.warn); }
    if (sim.day < e.fireDay) continue;
    const ready = e.night ? sim.restTime : sim.tod >= 0.28 && !sim.restTime;
    if (!ready) continue;
    e.fired = true;
    if (e.kind === 'wolves') launchWolves(sim, e.size);
    else if (e.tribe) {
      const t = tribeOf(sim, e.tribe);
      if (t && t.state === 'free') { if (raidAdvised(sim, t, e.size) || e.fireDay >= e.warnDay + 4) launchRaid(sim, t, e.size); else { e.fired = false; e.fireDay = sim.day + 1; e.warned = true; sim.say(`${t.def.name} thấy làng đông quân và hoãn tập kích.`); } }
    }
  }
}

// ---------------------------------------------------------------- the brain of a tribal person
const AGGRO = { peaceful: 6, aggressive: 14, ambusher: 9 } as const;
const LEASH = 24;

function wander(sim: Sim, f: Villager, radius: number): void {
  const ai = f.ai!;
  for (let i = 0; i < 6; i++) {
    const a = sim.frnd() * Math.PI * 2, r = 1.5 + sim.frnd() * radius;
    const g = sim.nearestFree(Math.floor(ai.camp.x + Math.cos(a) * r), Math.floor(ai.camp.y + Math.sin(a) * r), new Set());
    if (g) { f.path = sim.pathTo(f, g[0], g[1], 2500); f.phase = f.path.length ? 'move' : 'idle'; break; }
  }
  ai.wander = 4 + sim.frnd() * 8;
}

export function tickFoe(sim: Sim, f: Villager, dt: number): void {
  tickCommon(sim, f, dt);
  const t = tribeOf(sim, f.team), ai = f.ai;
  if (t && ai) foeBrain(sim, f, t, ai, dt);
  sim.moveUnit(f, dt);
  sim.animate(f, dt);
}

/** A raider who cannot get where he is going for a few seconds turns on the nearest fence or gate. */
function noteStuck(sim: Sim, f: Villager, ai: NonNullable<Villager['ai']>, dt: number, blocked: boolean): void {
  if (!blocked) { ai.stuck = 0; return; }
  ai.stuck = (ai.stuck ?? 0) + dt;
  if (ai.stuck < 3) return;
  const wall = sim.nearestWork(f.x, f.y, 16) ?? sim.nearestWork(f.x, f.y, 4, true);
  ai.stuck = 0;
  if (wall) ai.siege = wall.id;
}

/** Breaking a fence down: walk up to it and strike it. True while he is at it. */
function siegeBrain(sim: Sim, f: Villager, ai: NonNullable<Villager['ai']>, dt: number, threats: Array<{ d: number }>): boolean {
  if (!ai.siege) return false;
  if (threats.length && threats[0].d <= weaponOf(f).range + 1.5) return false; // someone in reach: fight him first
  const b = sim.getBuilding(ai.siege);
  if (!b) { ai.siege = 0; f.path = []; return false; } // it has fallen: the way is open
  const w = weaponOf(f), d = BUILDINGS[b.kind], cx = b.x + d.w / 2, cy = b.y + d.h / 2;
  const dist = Math.hypot(cx - f.x, cy - f.y) - Math.max(d.w, d.h) / 2;
  if (dist <= (w.ranged ? 1.2 : w.range) + 0.6) {
    f.path = []; f.slide = null; f.phase = 'fight'; f.facing = cx >= f.x ? 'right' : 'left';
    if (f.atkCd <= 0 && !f.swing) {
      const { hitAt, end } = swingTimes(w.anim);
      f.swing = { t: 0, hitAt, end, target: { kind: 'unit', id: -1 } }; // the blow has no living target: the work takes it at once
      f.atkCd = cycleOf(w.cycle, f.stats.agi);
      sim.damageWork(b, (w.damage + (w.ranged ? 0 : RULES.strengthDamage * f.stats.str)) * (w.type === 'slash' ? 1.5 : 1));
    }
    return true;
  }
  f.fight.repath -= dt;
  if (!f.path.length && f.fight.repath <= 0) {
    const ring = sim.ringTiles(f, b.x, b.y, d.w, d.h);
    f.path = ring.length ? sim.pathTo(f, ring[0][0], ring[0][1], 4000) : [];
    f.fight.repath = 1;
    if (!f.path.length) { ai.siege = 0; return false; }
  }
  f.phase = 'move';
  return true;
}

function foeBrain(sim: Sim, f: Villager, t: Tribe, ai: NonNullable<Villager['ai']>, dt: number): void {
  const free = t.state === 'free';
  f.fight.scan -= dt;
  const radius = ai.role === 'raider' ? 12 : ai.role === 'civ' ? 9 : AGGRO[t.def.personality];
  const scanNow = f.fight.scan <= 0;
  if (scanNow) f.fight.scan = 0.4;
  const looking = scanNow || f.phase === 'flee' || (f.phase === 'fight' && !f.fight.target); // see brainPlayer: a unit busy with a target needs no new look every tick
  const threats = free && looking ? threatsOf(sim, f, radius) : [];
  if (!free) { f.fight.target = null; if (f.phase === 'fight') { f.phase = 'idle'; f.path = []; } }

  // fleeing: an unarmed civilian meets a threat
  if (free && (f.fleeT > 0 || (ai.role === 'civ' && threats.length && threats[0].d < 8))) {
    if (f.fleeT <= 0) { f.fleeT = 6; f.fight.target = null; f.path = sim.pathTo(f, Math.floor(ai.camp.x), Math.floor(ai.camp.y), 3000); }
    f.fleeT -= dt; f.phase = 'flee';
    if (threats.length && threats[0].d < 6) f.fleeT = Math.max(f.fleeT, 2);
    if (!f.path.length && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) > 3) f.path = sim.pathTo(f, Math.floor(ai.camp.x), Math.floor(ai.camp.y), 3000);
    return;
  }
  if (f.phase === 'flee') { f.phase = 'idle'; f.path = []; }

  // a raider marches on the village, fighting what stands in the way
  if (free && ai.role === 'raider' && t.raid) {
    if (t.raid.phase === 'retreat') { if (!f.path.length && sim.pathLeft > 0 && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) > 4) { sim.pathLeft--; f.path = sim.pathTo(f, Math.floor(ai.camp.x), Math.floor(ai.camp.y), 20000); } f.phase = 'move'; return; }
    if (siegeBrain(sim, f, ai, dt, threats)) return;
    if (f.fight.target) {
      const e = resolve(sim, f.fight.target);
      if (e) {
        engage(sim, f, e, dt);
        const ex = e.kind === 'unit' ? e.v.x : e.a.x, ey = e.kind === 'unit' ? e.v.y : e.a.y;
        noteStuck(sim, f, ai, dt, !f.path.length && !f.swing && Math.hypot(ex - f.x, ey - f.y) > weaponOf(f).range + 2);
        return;
      }
      f.fight.target = null; f.phase = 'idle';
    }
    if (threats.length) { f.fight.target = threats[0].t; return; }
    const fire = sim.campfire(), gx = fire ? fire.x + 1 : sim.world.start.x, gy = fire ? fire.y + 1 : sim.world.start.y;
    if (Math.hypot(gx - f.x, gy - f.y) > 6) {
      f.fight.repath -= dt;
      if (!f.path.length && f.fight.repath <= 0 && sim.pathLeft > 0) { sim.pathLeft--; f.path = sim.pathTo(f, Math.floor(gx), Math.floor(gy), 40000); f.fight.repath = f.path.length ? 0.5 : 1.5; }
      f.phase = 'move';
      noteStuck(sim, f, ai, dt, !f.path.length);
    }
    else { const v = sim.villagers.find((o) => o.health > 0 && o.down <= 0 && o.inside === null); if (v) f.fight.target = { kind: 'unit', id: v.id }; }
    return;
  }

  // fight: explicit target (from being hit), or a threat inside the guard radius
  if (free && f.fight.target) {
    const e = resolve(sim, f.fight.target);
    if (e && Math.hypot(f.x - ai.camp.x, f.y - ai.camp.y) < LEASH) { engage(sim, f, e, dt); return; }
    f.fight.target = null; f.phase = 'idle'; f.path = [];
  }
  if (free && ai.role === 'guard' && threats.length && tribeHostile(sim, t.id)) { f.fight.target = threats[0].t; return; }

  // otherwise stroll around the camp
  if (f.phase === 'fight') { f.phase = 'idle'; f.path = []; }
  ai.wander -= dt;
  if (ai.wander <= 0 && !f.path.length) wander(sim, f, ai.role === 'civ' ? 5 : t.def.personality === 'aggressive' ? 12 : 8);
  if (f.phase === 'move' && !f.path.length) f.phase = 'idle';
  void DAY_LENGTH;
}
