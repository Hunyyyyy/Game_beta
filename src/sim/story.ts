/**
 * The story tree in the game (doc/story_tree.md): about once a game second it lets storydata.stepStory look at the village (deeds, visitors seen, Nhà chung level, the leader villages) and does what the step says:
 * a line in the Nhật ký, a scene sent to the gate, goods, a deed, a relation or a raid. It ticks beside the visitors, so the war mode freezes it with them. The rules and the data are storydata.ts / storyscenes.ts.
 */
import type { Sim } from './sim';
import { RES_NAME, type Res } from './resources';
import type { StoryCond } from './encounterdata';
import { STORY, type StoryMode, type WarEvent, type WorldEffect } from './storyscenes';
import { unlockAbout, unlockName } from './specialdata';
import { condOf, stepStory, storyMod, warChapter, type StoryOut, type StoryWorld } from './storydata';
import { seedRoll } from './encounterdata';
import { openAtOnce } from './encounters';
import { SEASON_DAYS } from './calendar';

/** The tree runs when index.json has it on, or the dev switch wakes it. */
export const storyOn = (sim: Sim): boolean => STORY.enabled || sim.dev.story;

/** Where the village stands against the leader villages: 0 none met, 0.5 one mapped (or one fallen), 1 all fallen (or there is none). */
function bossContact(sim: Sim): number {
  const bosses = sim.tribes.filter((t) => t.boss);
  if (bosses.every((t) => t.bossDown)) return 1;
  return bosses.some((t) => t.bossDown || sim.maps.some((m) => m.tribe === t.id)) ? 0.5 : 0;
}

/** The share of the common villages (counted when the game began) that are ours now: taken, surrendered or paying tribute. */
function power(sim: Sim): number {
  const base = sim.story.baseVillages;
  if (!base) return 0;
  return Math.min(1, (sim.conquests.length + sim.tribes.filter((t) => !t.boss && !t.bandit && !t.rebel && t.tier !== 'boss' && t.tier !== 'rebel' && t.tier !== 'raider' && t.state !== 'free').length) / base);
}

const worldOf = (sim: Sim): Omit<StoryWorld, 'base'> => ({ day: sim.day, seed: sim.seed, era: sim.era, fireLevel: sim.fireLevel(), bossContact: bossContact(sim), power: power(sim), seen: sim.encounters.seen, deeds: sim.encounters.deeds });

/** What a condition of a visitor script may ask of the tree (marks, lasting flags, leaves...). */
export const storyCond = (sim: Sim): StoryCond => condOf(sim.story, worldOf(sim));
/** A multiplier the tips put on the game (legacy.json `mods`); 1 while the tree sleeps. */
export const mod = (sim: Sim, key: string): number => (storyOn(sim) ? storyMod(sim.story, key, sim.day) : 1);

export function setFlag(sim: Sim, name: string): void { if (!sim.story.flags.includes(name)) sim.story.flags.push(name); }
export function setMode(sim: Sim, mode: StoryMode): void { sim.story.mode = mode; }

/** The village a world effect names: an id, or `@boss` for the strongest leader village still standing. */
function tribeOf(sim: Sim, name: string): string | undefined {
  if (name !== '@boss') return sim.tribes.find((t) => t.id === name && t.state === 'free')?.id;
  return sim.tribes.filter((t) => t.boss && !t.bossDown && t.state === 'free').sort((a, b) => sim.tribePower(b).military - sim.tribePower(a).military)[0]?.id;
}

function applyWorld(sim: Sim, e: WorldEffect, share: number): void {
  for (const [k, n] of Object.entries(e.give ?? {})) sim.stock[k as Res] += Math.round((n ?? 0) * share);
  for (const [k, n] of Object.entries(e.take ?? {})) sim.stock[k as Res] = Math.max(0, sim.stock[k as Res] - Math.round((n ?? 0) * share));
  if (e.deed) sim.addDeed(e.deed);
  if (e.rel) { const id = tribeOf(sim, e.rel.tribe); if (id) sim.tribeRelationAdd(id, e.rel.n * share); }
  if (e.raid) { const id = tribeOf(sim, e.raid.tribe); if (id) sim.raidFrom(id, Math.max(1, Math.round(e.raid.size * share))); }
  if (e.warBan) sim.legacy.warBanUntil = Math.max(sim.legacy.warBanUntil, sim.day + Math.round(e.warBan * share));
  if (e.join) settle(sim, Math.round(e.join * share));
  const gentle = sim.story.mode === 'easy'; // the easy mode never takes people
  if (e.leave && !gentle) depart(sim, e.leave, share);
  if (e.assassin && !gentle) { const t = sim.tribes.filter((x) => x.state === 'free' && !x.bandit).sort((a, b) => a.relation - b.relation)[0]; if (t && sim.sendAssassin(t.id)) sim.say('Có tin một kẻ lạ mặt đã lẻn vào làng trong đêm. Hãy để lính gác và cận vệ ở gần người cần giữ.'); }
  if (e.rebel && !gentle) { const name = sim.rebelTributary(); if (name) sim.say(`${name} đã đứng dậy chống lại làng.`); }
}

/** Newcomers of a leaf settle by the fire: as many as the village has beds for. */
function settle(sim: Sim, n: number): void {
  const fire = sim.campfire(), room = Math.max(0, sim.popCap() - sim.villagers.length);
  let done = 0;
  for (let i = 0; i < Math.min(n, room) && fire; i++) { const at = sim.nearestFree(fire.x + 1, fire.y + 3, new Set()); if (!at) break; sim.spawn(at[0], at[1], seedRoll(sim.seed, 'settle', sim.day * 10 + i) < 0.5 ? 'm' : 'f'); done++; }
  if (done) sim.say(`${done} người mới tới xin ở lại và được nhận.`);
}

/** People leave the village because of a leaf: common villagers (those with no trade first), or soldiers. Not while a war is on (the army is away), never the allies, never more than the leaf says. */
function depart(sim: Sim, l: NonNullable<WorldEffect['leave']>, share: number): void {
  if (sim.atWar()) return;
  const pool = sim.villagers.filter((v) => !v.ally && v.health > 0 && (v.job === 'fight') === !!l.soldiers && !v.wardOf).sort((a, b) => Number(b.job === 'idle') - Number(a.job === 'idle') || seedRoll(sim.seed, 'depart', a.id) - seedRoll(sim.seed, 'depart', b.id));
  const n = Math.min(pool.length, Math.max(1, Math.round(l.max * share)), Math.floor(pool.length * l.share));
  for (const v of pool.slice(0, n)) { sim.releaseRole([v.id]); sim.leaveSquad([v.id]); sim.takeAway(v); }
  if (n > 0) sim.say(l.soldiers ? `${n} lính đã bỏ làng, đi theo người khác.` : `${n} người đã gói đồ rời làng.`);
}

function apply(sim: Sim, o: StoryOut): void {
  if (o.kind === 'tell') sim.say(o.what === 'rumor' ? `Lời đồn: ${o.text}` : `${o.name}. ${o.text}`);
  else if (o.kind === 'scene') sim.queueEncounter(o.script, o.days, STORY.config.scenePriority, STORY.config.sceneMaxDelay);
  else applyWorld(sim, o.effect, o.share);
}

/** Called every tick of the peaceful game (not in the war mode, not while a dialogue is open); the tree itself looks once a game second. */
export function tickStory(sim: Sim, dt: number): void {
  if (!storyOn(sim) || Math.floor(sim.time) === Math.floor(sim.time - dt)) return;
  const st = sim.story;
  if (!st.baseVillages) st.baseVillages = sim.tribes.filter((t) => !t.boss && !t.bandit && !t.rebel && t.tier !== 'boss' && t.tier !== 'rebel' && t.tier !== 'raider').length + sim.conquests.length;
  for (const o of stepStory(st, { ...worldOf(sim), base: sim.encounterCond() })) apply(sim, o);
  stoneTipRules(sim);
  if (st.mode === 'easy' && st.tips.mid && !sim.legacy.tokenGiven) { sim.legacy.tokenGiven = true; sim.legacy.planTokens++; sim.say('Một người thợ già để lại cho làng một lời hứa: Chợ sẽ trao một bản vẽ tùy chọn, không lấy gì.'); }
}

export interface LegacyItem { key: string; kind: 'unit' | 'building' | 'perk' | 'research'; open: boolean; /** Empty while it is not open: how it opens is never told. */ name: string; about: string }
/** The Di sản list (doc/UPDATE_di_san_mo_khoa.md A1.6): every specialist and power; the open ones by name, the others only as shadows. */
export function legacyView(sim: Sim): LegacyItem[] {
  return STORY.unlocks.map((u) => {
    const open = sim.isUnlocked(u.key);
    return { key: u.key, kind: u.kind, open, name: open ? u.name ?? unlockName(u.key) : '', about: open ? u.about ?? unlockAbout(u.key) : '' };
  });
}

/** Why a war may not be begun now, or null. Ngai rỗng: nobody may order a war for some days. Hội đồng trưởng lão: a war on a village needs a day of voting (the vote holds for three days after). The one rule that refuses an order of the player (user's decision, 2026-11-16). */
export function warBlock(sim: Sim, tribe: string | null): string | null {
  if (!storyOn(sim) || sim.dev.freeWorks) return null;
  const st = sim.legacy;
  if (sim.day < st.warBanUntil) return `Ngai còn trống: chưa ai có quyền ra lệnh xuất quân (còn ${st.warBanUntil - sim.day} ngày)`;
  if (!sim.story.flags.includes('council')) return null;
  const on = tribe ?? '';
  if (!st.vote || st.vote.tribe !== on || sim.day > st.vote.day + 3) { st.vote = { tribe: on, day: sim.day + 1 }; return 'Hội đồng trưởng lão phải bỏ phiếu về cuộc chiến này: ngày mai mới xuất quân được'; }
  if (sim.day < st.vote.day) return 'Hội đồng trưởng lão đang bỏ phiếu: ngày mai mới xuất quân được';
  return null;
}

// ---------------------------------------------------------------- the war (trunk V: Sắt và máu)
/** The attack plan under way against a village (not a skirmish), if any. */
const runningPlan = (sim: Sim) => sim.plans.find((p) => p.kind === 'attack' && p.status === 'running' && !p.skirmish);
const ourAlive = (sim: Sim, plan: NonNullable<ReturnType<typeof runningPlan>>): number => plan.missions.reduce((n, m) => n + (sim.squadById(m.squad) ? sim.squadUnits(sim.squadById(m.squad)!).filter((v) => v.health > 0).length : 0), 0);
const foesAlive = (sim: Sim, tribe: string): number => sim.foes.filter((f) => f.team === tribe && f.health > 0 && f.ai && f.ai.role !== 'civ' && f.ai.guest === undefined).length;

/** A moment of the war (called from the war: startPlan, killFoe, and once a second by tickWarStory): the story may open a scene of trunk V, in the middle of the battle. One at a time; each moment once a war. */
export function warEvent(sim: Sim, ev: WarEvent): void {
  if (!storyOn(sim) || sim.era !== 'ancient' || sim.encounters.active) return;
  const w = sim.legacy.war;
  if (!w || w.fired.includes(ev)) return;
  const ch = warChapter(sim.encounters.seen, ev, sim.encounterCond());
  if (ch && !openAtOnce(sim, ch.id, w.tribe)) w.fired.push(ev); // a moment counts only when a scene opened: while the stage before it is not played, the moment waits (and comes back each second while it lasts)
}
/** The war begins: the numbers of both sides are taken. */
export function warBegan(sim: Sim, tribe: string): void {
  const plan = runningPlan(sim);
  sim.legacy.war = { tribe, foe0: Math.max(1, foesAlive(sim, tribe)), our0: Math.max(1, plan ? plan.missions.reduce((n, m) => n + m.initial, 0) : 1), fired: [], pending: null };
  sim.legacy.war.pending = 'war_start';
}
/** Called every tick of a war: the opening scene when it is due, and once a second the counts of the two armies. */
export function tickWarStory(sim: Sim, dt: number): void {
  const w = sim.legacy.war, plan = runningPlan(sim);
  if (!w || !plan) return;
  if (w.pending) { const ev = w.pending as WarEvent; w.pending = null; warEvent(sim, ev); return; }
  if (w.leaderDown) warEvent(sim, 'leader_down');
  if (Math.floor(sim.time) === Math.floor(sim.time - dt)) return;
  const foes = foesAlive(sim, w.tribe), our = ourAlive(sim, plan);
  if (foes <= w.foe0 * 0.5) warEvent(sim, 'half_way');
  if (our > 0 && our <= w.our0 * 0.5) warEvent(sim, 'army_low');
  if (foes <= Math.max(1, w.foe0 * 0.2)) warEvent(sim, 'near_fall');
}
/** The leader of the village at war has fallen. */
export function warLeaderDown(sim: Sim, tribe: string): void { if (sim.legacy.war?.tribe === tribe) sim.legacy.war.leaderDown = true; }
/** The war is over: the counts are dropped. */
export function warOver(sim: Sim): void { sim.legacy.war = null; }

// ---------------------------------------------------------------- what the Ngọn of the stone age go on doing in the medieval age
/** Whether a stone-age tip stands (the main one, or the second). */
export const stoneTip = (sim: Sim, id: string): boolean => sim.era === 'ancient' && (sim.story.tips.stone?.main === `tip:${id}` || sim.story.tips.stone?.second === `tip:${id}`);

/** Triều Cống (N3): every ten days a tenth of the coin and food goes to the village that holds us (the strongest leader). Dòng Máu Thù (N6): each season that village sends a killer (not in the easy mode). Once a day, once a season. */
function stoneTipRules(sim: Sim): void {
  const st = sim.legacy, lord = tribeOf(sim, '@boss');
  if (stoneTip(sim, 'N3') && sim.day % 10 === 0 && st.tributeDay !== sim.day) {
    st.tributeDay = sim.day;
    const pay: Record<string, number> = {};
    for (const k of ['coin', 'food'] as const) { const n = Math.floor(sim.stock[k] * 0.1); if (n > 0) { sim.stock[k] -= n; pay[k] = n; } }
    if (Object.keys(pay).length) sim.say(`Làng chủ nợ nhận cống nạp kỳ này: ${Object.entries(pay).map(([k, n]) => `${n} ${RES_NAME[k as Res].toLowerCase()}`).join(', ')}.`);
  }
  const season = Math.floor((sim.day - 1) / SEASON_DAYS);
  if (stoneTip(sim, 'N6') && st.killerSeason !== season && sim.story.mode !== 'easy' && lord) {
    st.killerSeason = season;
    if (sim.sendAssassin(lord)) sim.say('Mối thù truyền kiếp không quên: có kẻ lạ lẻn vào làng trong đêm.');
  }
}
