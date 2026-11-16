/**
 * Side quests (doc/story_tree.md "Nhiệm vụ phụ"): a small tracker over the visitor talks. A character comes to the gate with an offer; each answer moves the quest a step (the next talk comes a day later), the last one pays.
 * Apart from the story tree: no deed, no flag, only a reward (and the relation with the giver's village). At most `max` at once; one left unfinished past its day is simply gone. Data and scripts: sidequestdata.ts.
 */
import type { Sim } from './sim';
import { RES_NAME, type Res } from './resources';
import { evalCond, seedRoll, type Cost } from './encounterdata';
import { STORY } from './storyscenes';
import { characterOf } from './characters';
import { unlockName } from './specialdata';
import { SIDE, sideQuest, sideScriptId, sideWeight, type SideOption, type SideQuest, type SideRun } from './sidequestdata';

const CFG = SIDE.config;
/** Offers come by themselves when the data has them on, or the dev switch does. */
const on = (sim: Sim): boolean => CFG.enabled || sim.dev.side;
const prefix = (r: SideRun): string => `sq:${r.id}:${r.step}`;
const isStep = (script: string, r: SideRun): boolean => script === prefix(r) || script.startsWith(`${prefix(r)}:`); // (`:m` the medieval twin, `:f` the map variant)
/** The talk of the awaited step is on its way or at the gate. */
const present = (sim: Sim, r: SideRun): boolean => sim.encounters.queue.some((q) => isStep(q.script, r)) || sim.encounters.visitors.some((v) => isStep(v.scriptId, r));
const gap = (sim: Sim): number => CFG.offerGap[0] + Math.floor(seedRoll(sim.seed, 'sq:gap', sim.day) * (CFG.offerGap[1] - CFG.offerGap[0] + 1));
const end = (sim: Sim, r: SideRun): void => { if (r.stage) sim.stageClear(r); sim.side.runs = sim.side.runs.filter((x) => x !== r); sim.side.last[r.id] = sim.day; };

/** Send the talk of the step a quest awaits (from the giver's village while it stands). */
function send(sim: Sim, r: SideRun): void {
  const tribe = r.tribe && sim.tribes.some((t) => t.id === r.tribe && t.state === 'free') ? r.tribe : undefined;
  const field = sideQuest(r.id)?.steps[r.step]?.field, onMap = !!field && !sim.stageBlock(field); // played on the map when it can be: else its talk
  sim.queueEncounter(sideScriptId(r.id, r.step, sim.era, onMap), r.fast || r.step === 0 ? 0 : CFG.stepDays, r.fast ? 9 : CFG.priority, CFG.maxDelay, tribe);
  r.sentDay = sim.day;
}

function eligible(sim: Sim, q: SideQuest): boolean {
  const fl = sim.fireLevel(), last = sim.side.last[q.id];
  if (fl < q.fire[0] || fl > q.fire[1] || sim.side.runs.some((r) => r.id === q.id)) return false;
  if (last !== undefined && sim.day - last < CFG.cooldownDays) return false;
  return evalCond(q.cond, sim.encounterCond());
}

/** Called beside the visitors (the war mode freezes it with them); looks once a game second: an offer when it is time, the step that got lost sent again, the quests past their day dropped. */
export function tickSideQuests(sim: Sim, dt: number): void {
  if (Math.floor(sim.time) === Math.floor(sim.time - dt)) return;
  const st = sim.side;
  sim.stageSweep();
  for (const r of [...st.runs]) {
    if (r.stage) { stageStep(sim, r); continue; } // the step is being played on the map
    if (present(sim, r)) continue;
    if (!r.taken) { end(sim, r); continue; } // an offer nobody answered
    if (sim.day > r.due) { end(sim, r); sim.say(`Việc "${sideQuest(r.id)?.name ?? r.id}" đã quá hạn: người nhờ đã tìm cách khác. Không ai trách làng bạn.`); continue; }
    if (r.fast || sim.day > r.sentDay) send(sim, r);
  }
  if (!on(sim)) return;
  if (!st.nextAt) { st.nextAt = sim.day + gap(sim); return; }
  if (sim.day < st.nextAt || st.runs.length >= CFG.max || st.runs.some((r) => !r.taken)) return;
  st.nextAt = sim.day + gap(sim);
  const pool = SIDE.quests.filter((q) => eligible(sim, q));
  if (!pool.length) return;
  const ws = pool.map((q) => sideWeight(q.id, sim.story.flags)); // a flag of the story tree makes its quest likelier
  let r = seedRoll(sim.seed, 'sq:pick', sim.day) * ws.reduce((a, b) => a + b, 0), pick = pool[0];
  for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r < 0) { pick = pool[i]; break; } }
  offer(sim, pick, false);
}

function offer(sim: Sim, q: SideQuest, fast: boolean): void {
  const r: SideRun = { id: q.id, step: 0, tags: [], day: sim.day, due: 0, taken: false, sentDay: sim.day, fast: fast || undefined };
  sim.side.runs.push(r);
  send(sim, r);
}

/** The specialists a blueprint may still open (not in the stone age: they are of the medieval age). */
function plansLeft(sim: Sim): string[] {
  return sim.era === 'ancient' ? STORY.unlocks.filter((u) => u.sources.includes('blueprint') && !sim.isUnlocked(u.key)).map((u) => u.key) : [];
}

const goodsText = (c: Cost): string => Object.entries(c).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${n} ${RES_NAME[k as Res].toLowerCase()}`).join(', ');

/** The quest is done: the goods of the answers given (by the Nhà chung's level), the relation with the giver's village, and a blueprint when it gives one. */
function pay(sim: Sim, r: SideRun, q: SideQuest): void {
  const mult = CFG.rewardByFire[Math.min(CFG.rewardByFire.length - 1, sim.fireLevel())] ?? 1, sum: Cost = {};
  const add = (c: Cost | undefined, m: number) => { for (const [k, n] of Object.entries(c ?? {})) sum[k as Res] = (sum[k as Res] ?? 0) + (n ?? 0) * m; };
  add(q.reward.base, mult);
  for (const t of r.tags) add(q.reward.by[t], mult);
  let plan = '';
  const bp = q.reward.blueprint;
  if (bp === true || (typeof bp === 'string' && r.tags.includes(bp))) {
    const left = plansLeft(sim);
    if (left.length) { const key = left[Math.floor(seedRoll(sim.seed, `sq:plan:${q.id}`, sim.day) * left.length)]; sim.unlocksBought.push(key); plan = `bản vẽ ${unlockName(key)}`; }
    else add(CFG.blueprintInstead, mult); // nothing left to open (or the stone age): goods in its place
  }
  for (const k of Object.keys(sum)) { sum[k as Res] = Math.max(0, Math.round(sum[k as Res] ?? 0)); sim.stock[k as Res] += sum[k as Res] ?? 0; }
  if (q.reward.rel && r.tribe) sim.tribeRelationAdd(r.tribe, q.reward.rel);
  const got = [goodsText(sum), plan].filter(Boolean).join(', ');
  sim.say(`Việc "${q.name}" đã xong.${got ? ` Thưởng: ${got}.` : ''}`);
  end(sim, r);
}

/** The stage of a run, looked at once a second: won (the quest goes on, with what our soldiers did), lost (the quest is over), or still going. */
function stageStep(sim: Sim, r: SideRun): void {
  const q = sideQuest(r.id), s = r.stage!, field = q?.steps[s.step]?.field, o = q?.steps[s.step]?.options[s.opt];
  if (!q || !field || !o) { sim.stageClear(r); return; }
  const res = sim.stageCheck(r, field);
  if (res === 'run') return;
  const fought = sim.stageKills(r) > 0;
  sim.stageClear(r);
  if (res === 'lost') { end(sim, r); sim.say(`${field.lose} Việc "${q.name}" không thành. Không ai trách làng bạn.`); return; }
  sim.say(field.win);
  settle(sim, r, q, s.step, o, true, fought ? field.tagWin : undefined, field.skipTo);
}

/** After an answer (or a stage): the quest is lost, or its tag is kept and the next step comes (the last one pays). */
function settle(sim: Sim, r: SideRun, q: SideQuest, step: number, o: SideOption, ok: boolean, extraTag?: string, skipTo?: number): void {
  if (!ok && o.roll?.ends) { end(sim, r); sim.say(`Việc "${q.name}" không thành. Không ai trách làng bạn.`); return; }
  const tag = ok ? o.tag : o.roll?.tag;
  if (tag) r.tags.push(tag);
  if (extraTag && !r.tags.includes(extraTag)) r.tags.push(extraTag);
  if (step >= q.steps.length - 1) { pay(sim, r, q); return; }
  r.step = skipTo ?? step + 1;
  send(sim, r);
}

/** An answer of a quest talk (effect `quest` of the visitor scripts): `code` is sidequestdata.sideCode, `tribe` the village of the one who came. */
export function sideChoice(sim: Sim, code: string, tribe?: string): void {
  const [id, stepS, optS, okS, mapS] = code.split(':'), step = Number(stepS), opt = Number(optS), ok = okS === 'y';
  const q = sideQuest(id), r = sim.side.runs.find((x) => x.id === id && x.step === step);
  if (!q || !r) return; // the quest is gone (dropped, or past its day): the talk is only words
  if (opt < 0) { end(sim, r); return; } // refused
  const o = q.steps[step]?.options[opt];
  if (!o) return;
  if (step === 0) { r.taken = true; r.day = sim.day; r.due = sim.day + q.days; r.tribe = tribe; sim.say(`Đã nhận việc: ${q.name} (hạn ${q.days} ngày). Xem ở Nhiệm vụ.`); }
  const field = q.steps[step].field;
  if (mapS === 'f' && field) { // the map variant of the talk: the stage decides; when no place can be found for it, the dice of the answer do
    r.due = Math.max(r.due, sim.day + field.days + 1);
    if (sim.stageStart(r, field, step, opt)) return;
    const won = !o.roll || seedRoll(sim.seed, `sq:dice:${id}:${step}`, sim.day) < o.roll.p;
    sim.say(won ? field.win : o.roll!.fail);
    settle(sim, r, q, step, o, won);
    return;
  }
  settle(sim, r, q, step, o, ok);
}

export interface SideQuestView { /** Where the step is being played on the map (tile), and what is to be done there. */ at?: [number, number]; todo?: string; id: string; name: string; kind: string; giver: string; step: number; steps: number; /** Game days left (0: today is the last); -1 while it is only offered. */ daysLeft: number; /** Someone waits at the gate about it. */ atGate: boolean }
/** The quests offered or under way, for the Nhiệm vụ window. */
export function sideQuestViews(sim: Sim): SideQuestView[] {
  return sim.side.runs.flatMap((r) => {
    const q = sideQuest(r.id);
    return q ? [{ id: q.id, name: q.name, kind: q.kind, giver: characterOf(q.giver)?.name ?? '', step: r.step, steps: q.steps.length, daysLeft: r.taken ? Math.max(0, r.due - sim.day) : -1, atGate: sim.encounters.visitors.some((v) => isStep(v.scriptId, r) && v.state === 'waiting'), ...(r.stage ? { at: (r.stage.ward !== undefined && sim.get(r.stage.ward) ? [Math.floor(sim.get(r.stage.ward)!.x), Math.floor(sim.get(r.stage.ward)!.y)] : r.stage.at) as [number, number], todo: q.steps[r.stage.step]?.field?.say } : {}) }] : [];
  });
}

/** Give a quest up: nothing is lost but the reward. The one already at the gate still talks, to no effect. */
export function dropSideQuest(sim: Sim, id: string): string | null {
  const r = sim.side.runs.find((x) => x.id === id);
  if (!r) return 'Không có việc này';
  sim.encounters.queue = sim.encounters.queue.filter((q) => !isStep(q.script, r));
  end(sim, r);
  return null;
}

/** Dev: start a quest now, its steps coming at once (the one under way of the same id is started again). */
export function startSideQuest(sim: Sim, id: string): string {
  const q = sideQuest(id);
  if (!q) return 'Không có nhiệm vụ này';
  dropSideQuest(sim, id);
  offer(sim, q, true);
  return `${characterOf(q.giver)?.name ?? 'Người giao việc'} đang tới cổng: ${q.name}`;
}
export const sideQuestList = (): Array<{ id: string; name: string; kind: string }> => SIDE.quests.map((q) => ({ id: q.id, name: q.name, kind: q.kind }));
