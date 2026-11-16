/**
 * Side quests as data (data/story/quests/side_quests.json, doc/story_tree.md "Nhiệm vụ phụ"): the types, the saved state, and each step turned into a visitor script (data layer, no Sim).
 * The system that runs them is sidequests.ts. Only types come from encounterdata, so encounterdata may list these scripts among its own.
 */
import DATA from '../data/story/quests/side_quests.json';
import FLAGS from '../data/story/quests/from_flags.json';
import type { Cost, Node, Script } from './encounterdata';

/** One answer of a step. `roll`: it may go wrong (`fail` is then said): the quest is lost (`ends`) or another tag is kept. */
export interface SideOption { text: string; reply: string; tag?: string; cost?: Cost; cond?: string; roll?: { p: number; fail: string; ends?: boolean; tag?: string } }
export interface SideStep { /** The character who comes (data/characters); the giver when absent. */ cast?: string; say: string[]; options: SideOption[] }
export interface SideQuest {
  id: string; name: string; kind: string; giver: string; fire: [number, number]; days: number; cond?: string; steps: SideStep[];
  reward: { base: Cost; by: Record<string, Cost>; rel?: number; /** A specialist is opened: always (true) or when this tag is held. */ blueprint?: boolean | string };
}
export interface SideConfig {
  enabled: boolean; max: number; offerGap: [number, number]; stepDays: number; cooldownDays: number; offerWait: number; priority: number; maxDelay: number;
  rewardByFire: number[]; costMulMedieval: number; decline: string; declineReply: string; blueprintInstead: Cost;
}
/** A quest under way: the step that is awaited, the tags of the answers given, the day it was taken and its last day, the village of the giver. `taken` false: only offered. `fast`: started by the dev menu, its steps come at once. */
export interface SideRun { id: string; step: number; tags: string[]; day: number; due: number; taken: boolean; sentDay: number; tribe?: string; fast?: boolean }
/** What is saved: the quests offered or under way, the day of the next offer, the last day each quest ended. */
export interface SideState { runs: SideRun[]; nextAt: number; last: Record<string, number> }
export const initialSide = (): SideState => ({ runs: [], nextAt: 0, last: {} });

export const SIDE = { config: DATA.config as unknown as SideConfig, quests: DATA.quests as unknown as SideQuest[] };
/** How much likelier a quest is offered while a flag of the story tree that points to it stands (quests/from_flags.json). */
export const sideWeight = (id: string, flags: readonly string[]): number => (FLAGS.flags.some((f) => f.quest === id && flags.includes(f.flag)) ? FLAGS.weight : 1);
export const sideQuest = (id: string): SideQuest | undefined => SIDE.quests.find((q) => q.id === id);
/** The visitor script of a step: its medieval twin (`:m`) asks dearer prices. */
export const sideScriptId = (id: string, step: number, era: string): string => `sq:${id}:${step}${era === 'ancient' ? ':m' : ''}`;
/** What an answer tells the tracker (effect `quest`): quest, step, option (-1: refused), and whether it went well. */
export const sideCode = (id: string, step: number, opt: number, ok: boolean): string => `${id}:${step}:${opt}:${ok ? 'y' : 'n'}`;

function stepScript(q: SideQuest, i: number, medieval: boolean): Script {
  const st = q.steps[i], mul = medieval ? SIDE.config.costMulMedieval : 1;
  const price = (c: Cost | undefined): Cost | undefined => (c ? Object.fromEntries(Object.entries(c).map(([k, n]) => [k, Math.round((n ?? 0) * mul)])) : undefined);
  const nodes: Record<string, Node> = { start: { say: st.say, choices: st.options.map((o, k) => ({ text: o.text, cond: o.cond, cost: price(o.cost), ...(o.roll ? { roll: { p: o.roll.p, yes: `o${k}`, no: `o${k}f` } } : { then: `o${k}` }) })) } };
  st.options.forEach((o, k) => {
    nodes[`o${k}`] = { say: o.reply, effects: [{ quest: sideCode(q.id, i, k, true) }] };
    if (o.roll) nodes[`o${k}f`] = { say: o.roll.fail, effects: [{ quest: sideCode(q.id, i, k, false) }] };
  });
  if (i === 0) { // the offer may be refused
    nodes.start.choices!.push({ text: SIDE.config.decline, then: 'no' });
    nodes.no = { say: SIDE.config.declineReply, effects: [{ quest: sideCode(q.id, 0, -1, false) }] };
  }
  return { id: sideScriptId(q.id, i, medieval ? 'ancient' : 'stone'), fireLevel: [1, 99], minDay: 0, weight: 0, anywhere: true, start: 'start', nodes, cast: st.cast ?? q.giver };
}
/** Every step of every quest as a visitor script, for both ages. Never drawn by chance (weight 0): the tracker sends them. */
export const SIDE_SCRIPTS: Script[] = SIDE.quests.flatMap((q) => q.steps.flatMap((_, i) => [stepScript(q, i, false), stepScript(q, i, true)]));

/** What is wrong in the data (ids, givers and casts that do not exist are checked by the caller who knows the characters): empty when sound. */
export function validateSide(characters: readonly string[]): string[] {
  const out: string[] = [], ids = new Set<string>();
  for (const q of SIDE.quests) {
    if (ids.has(q.id)) out.push(`quest ${q.id}: twice`);
    ids.add(q.id);
    if (q.steps.length < 2 || q.steps.length > 3) out.push(`quest ${q.id}: ${q.steps.length} steps (2 or 3)`);
    for (const who of [q.giver, ...q.steps.map((s) => s.cast)]) if (who && !characters.includes(who)) out.push(`quest ${q.id}: no character ${who}`);
    const tags = new Set<string>();
    q.steps.forEach((s, i) => {
      if (!s.options.length) out.push(`quest ${q.id} step ${i}: no option`);
      if (i === 0 && s.options.length < 2) out.push(`quest ${q.id}: the offer needs two ways`);
      if (i > 0 && s.options.every((o) => o.cond)) out.push(`quest ${q.id} step ${i}: every option has a condition (a player without soldiers is stuck)`);
      for (const o of s.options) { if (o.tag) tags.add(o.tag); if (o.roll?.tag) tags.add(o.roll.tag); if (o.roll && !o.roll.ends && !o.roll.tag) out.push(`quest ${q.id} step ${i}: a roll with neither ends nor tag`); }
    });
    for (const t of Object.keys(q.reward.by)) if (!tags.has(t)) out.push(`quest ${q.id}: reward for a tag nobody gives (${t})`);
    if (typeof q.reward.blueprint === 'string' && !tags.has(q.reward.blueprint)) out.push(`quest ${q.id}: blueprint tag ${q.reward.blueprint} unknown`);
  }
  return out;
}
