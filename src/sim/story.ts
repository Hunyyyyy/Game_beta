/**
 * The story tree in the game (doc/story_tree.md): about once a game second it lets storydata.stepStory look at the village (deeds, visitors seen, Nhà chung level, the leader villages) and does what the step says:
 * a line in the Nhật ký, a scene sent to the gate, goods, a deed, a relation or a raid. It ticks beside the visitors, so the war mode freezes it with them. The rules and the data are storydata.ts / storyscenes.ts.
 */
import type { Sim } from './sim';
import type { Res } from './resources';
import type { StoryCond } from './encounterdata';
import { STORY, type StoryMode, type WorldEffect } from './storyscenes';
import { unlockName } from './specialdata';
import { condOf, stepStory, storyMod, type StoryOut, type StoryWorld } from './storydata';

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
}

export interface LegacyItem { key: string; kind: 'unit' | 'building' | 'perk' | 'research'; open: boolean; /** Empty while it is not open: how it opens is never told. */ name: string; about: string }
/** The Di sản list (doc/UPDATE_di_san_mo_khoa.md A1.6): every specialist and power; the open ones by name, the others only as shadows. */
export function legacyView(sim: Sim): LegacyItem[] {
  return STORY.unlocks.map((u) => {
    const open = sim.isUnlocked(u.key);
    return { key: u.key, kind: u.kind, open, name: open ? u.name ?? unlockName(u.key) : '', about: open ? u.about ?? '' : '' };
  });
}
