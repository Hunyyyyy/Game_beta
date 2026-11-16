/**
 * Side quests as data (data/story/quests/side_quests.json, doc/story_tree.md "Nhiệm vụ phụ"): the types, the saved state, and each step turned into a visitor script (data layer, no Sim).
 * The system that runs them is sidequests.ts. Only types come from encounterdata, so encounterdata may list these scripts among its own.
 */
import DATA from '../data/story/quests/side_quests.json';
import FLAGS from '../data/story/quests/from_flags.json';
import type { Cost, Node, Script } from './encounterdata';

/** One answer of a step. `roll`: it may go wrong (`fail` is then said): the quest is lost (`ends`) or another tag is kept. */
export interface SideOption { text: string; reply: string; tag?: string; cost?: Cost; cond?: string; roll?: { p: number; fail: string; ends?: boolean; tag?: string; /** Added to the chance while a condition holds. */ bonus?: Array<{ cond: string; add: number }> } }
/**
 * A step played on the map when it can be (missions.ts), in place of the dice of its answers: `bandits` a camp to wipe out, `escort` the giver to lead round the village past an ambush, `guard` the giver to keep from a killer.
 * `go`: what the visitor says when the way is chosen; `say`: the line of the Nhật ký; `count` foes [least, most]; `soldiers` we must have; `days` to do it; `skipTo` the step that follows a win (absent: the next);
 * `tagWin`: a tag kept when our soldiers brought a foe down; `win` / `lose`: the lines told at the end. A stage lost ends the quest.
 */
export interface StageField { kind: 'bandits' | 'escort' | 'guard'; go: string; say: string; count: [number, number]; soldiers?: number; days: number; skipTo?: number; tagWin?: string; win: string; lose: string }
/** The stage of a run while it stands: its units, the one to keep, where it is, its last day. */
export interface StageRun { kind: StageField['kind']; step: number; opt: number; until: number; at: [number, number]; units: number[]; spawned: number; ward?: number; goal?: [number, number]; ambush?: [number, number]; sprung?: boolean; killAt?: number }
export interface SideStep { /** The character who comes (data/characters); the giver when absent. */ cast?: string; say: string[]; options: SideOption[]; field?: StageField }
export interface SideQuest {
  id: string; name: string; kind: string; giver: string; fire: [number, number]; days: number; cond?: string; steps: SideStep[];
  reward: { base: Cost; by: Record<string, Cost>; rel?: number; /** A specialist is opened: always (true) or when this tag is held. */ blueprint?: boolean | string };
}
export interface SideConfig {
  enabled: boolean; max: number; offerGap: [number, number]; stepDays: number; cooldownDays: number; offerWait: number; priority: number; maxDelay: number;
  rewardByFire: number[]; costMulMedieval: number; decline: string; declineReply: string; blueprintInstead: Cost;
  /** The quests on the map (missions.ts): `enabled` false = every quest is its talk; `dist` tiles from the fire (never past what is seen), `minDist` at least; `lead` how near a soldier must be for an escorted one to walk; `escortArc` radians round the village; `ambushAt` tiles; `killerDelay` seconds; `moreMedieval` foes more in the medieval age; `weapons` of the foes by age. */
  map: { enabled: boolean; dist: number; minDist: number; lead: number; escortArc: number; ambushAt: number; killerDelay: number; moreMedieval: number; weapons: Record<string, string[]> };
}
/** A quest under way: the step that is awaited, the tags of the answers given, the day it was taken and its last day, the village of the giver. `taken` false: only offered. `fast`: started by the dev menu, its steps come at once. */
export interface SideRun { id: string; step: number; tags: string[]; day: number; due: number; taken: boolean; sentDay: number; tribe?: string; fast?: boolean; /** The step is being played on the map. */ stage?: StageRun }
/** What is saved: the quests offered or under way, the day of the next offer, the last day each quest ended. */
export interface SideState { runs: SideRun[]; nextAt: number; last: Record<string, number>; /** How many stage units were ever made (their ids). */ seq?: number }
export const initialSide = (): SideState => ({ runs: [], nextAt: 0, last: {} });

export const SIDE = { config: DATA.config as unknown as SideConfig, quests: DATA.quests as unknown as SideQuest[] };
/** How much likelier a quest is offered while a flag of the story tree that points to it stands (quests/from_flags.json). */
export const sideWeight = (id: string, flags: readonly string[]): number => (FLAGS.flags.some((f) => f.quest === id && flags.includes(f.flag)) ? FLAGS.weight : 1);
export const sideQuest = (id: string): SideQuest | undefined => SIDE.quests.find((q) => q.id === id);
/** The visitor script of a step: its medieval twin (`:m`) asks dearer prices. */
export const sideScriptId = (id: string, step: number, era: string, field = false): string => `sq:${id}:${step}${era === 'ancient' ? ':m' : ''}${field ? ':f' : ''}`;
/** What an answer tells the tracker (effect `quest`): quest, step, option (-1: refused), and whether it went well. */
export const sideCode = (id: string, step: number, opt: number, ok: boolean, field = false): string => `${id}:${step}:${opt}:${ok ? 'y' : 'n'}${field ? ':f' : ''}`;

function stepScript(q: SideQuest, i: number, medieval: boolean, field = false): Script {
  const st = q.steps[i], mul = medieval ? SIDE.config.costMulMedieval : 1;
  const price = (c: Cost | undefined): Cost | undefined => (c ? Object.fromEntries(Object.entries(c).map(([k, n]) => [k, Math.round((n ?? 0) * mul)])) : undefined);
  // the map variant: no dice in the talk (the stage decides), the visitor only says where to go
  const nodes: Record<string, Node> = { start: { say: st.say, choices: st.options.map((o, k) => ({ text: o.text, cond: o.cond, cost: price(o.cost), ...(o.roll && !field ? { roll: { p: o.roll.p, yes: `o${k}`, no: `o${k}f`, bonus: o.roll.bonus } } : { then: `o${k}` }) })) } };
  st.options.forEach((o, k) => {
    nodes[`o${k}`] = { say: field ? st.field!.go : o.reply, effects: [{ quest: sideCode(q.id, i, k, true, field) }] };
    if (o.roll && !field) nodes[`o${k}f`] = { say: o.roll.fail, effects: [{ quest: sideCode(q.id, i, k, false) }] };
  });
  if (i === 0) { // the offer may be refused
    nodes.start.choices!.push({ text: SIDE.config.decline, then: 'no' });
    nodes.no = { say: SIDE.config.declineReply, effects: [{ quest: sideCode(q.id, 0, -1, false) }] };
  }
  return { id: sideScriptId(q.id, i, medieval ? 'ancient' : 'stone', field), fireLevel: [1, 99], minDay: 0, weight: 0, anywhere: true, start: 'start', nodes, cast: st.cast ?? q.giver };
}
/** Every step of every quest as a visitor script, for both ages. Never drawn by chance (weight 0): the tracker sends them. */
export const SIDE_SCRIPTS: Script[] = SIDE.quests.flatMap((q) => q.steps.flatMap((s, i) => [stepScript(q, i, false), stepScript(q, i, true), ...(s.field ? [stepScript(q, i, false, true), stepScript(q, i, true, true)] : [])]));

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
      const f = s.field;
      if (f) { // a step played on the map
        if (f.skipTo !== undefined && (f.skipTo <= i || f.skipTo >= q.steps.length)) out.push(`quest ${q.id} step ${i}: skipTo ${f.skipTo} is not a later step`);
        if (f.count[0] < 1 || f.count[0] > f.count[1]) out.push(`quest ${q.id} step ${i}: bad foe count`);
        if (f.tagWin && !(f.tagWin in q.reward.by) && !q.steps.some((x) => x.options.some((o) => o.tag === f.tagWin))) out.push(`quest ${q.id} step ${i}: tagWin ${f.tagWin} rewards nothing`);
        if (i !== 0) out.push(`quest ${q.id} step ${i}: only the first step may be played on the map (the offer opens it)`);
      }
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
