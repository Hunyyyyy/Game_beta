/**
 * The rules of the story tree (doc/story_tree.md) that need no Sim (data layer): the hidden marks worked out from the deeds, when a knot is ready, which leaf it draws (by the seed of the game),
 * which fruits ripen, how a tip is scored, and the checker of the data. `stepStory` moves a `StoryState` one step and says what happened; story.ts does that to the game, tools/simStory.mjs to a game of words.
 */
import { COND_NAMES, SCRIPTS, condTerms, evalCond, seedRoll, type CondCtx, type Deed, type Effect, type Script, type StoryCond } from './encounterdata';
import { STORY, STORY_SCENES, type Fruit, type Knot, type Leaf, type Legacy, type StoryMode, type Thread, type TreeDef, type WorldEffect } from './storyscenes';

/** What the tree remembers of a game (saved). The marks are not here: they come from the deeds. */
export interface StoryState {
  mode: StoryMode;
  /** Flags that stay for the whole game (of leaves, fruits and `sflag` effects). */
  flags: string[];
  /** The knots that have fired and the leaf each drew (`pale`: its fallback, `wild`: a wild leaf, `old`: a stone-age knot told as an old tale in the medieval age). */
  knots: Record<string, { day: number; leaf: string; pale?: boolean; wild?: boolean; old?: boolean }>;
  /** Knots and fruits that are ready and wait for their day (`from`: the leaves a fruit grows from). */
  pending: Record<string, { day: number; pale?: boolean; old?: boolean; from?: string[] }>;
  fruits: Record<string, { day: number; from: string[]; variant: number }>;
  /** The tips by slot (`stone`, `mid`, `end`). */
  tips: Record<string, { main: string; second?: string; day: number }>;
  /** The scenes of chapters sent to the gate, and the day. */
  sent: Record<string, number>;
  /** The rumours already told. */
  told: string[];
  /** Marks given by the stone-age tips to begin the medieval age with. */
  bonus: Record<string, number>;
  /** The stone-age knots that never fired: old tales of the medieval age. */
  old: string[];
  /** The day the medieval age began (0 before it). */
  eraDay: number;
  /** How many common villages there were when the game began (the medieval measure of power is taken against it). */
  baseVillages: number;
}
export const initialStory = (): StoryState => ({ mode: 'normal', flags: [], knots: {}, pending: {}, fruits: {}, tips: {}, sent: {}, told: [], bonus: {}, old: [], eraDay: 0, baseVillages: 0 });

/** What the tree sees of the game. `bossContact`: 0 no leader village met, 0.5 one mapped, 1 all fallen. `base`: the rest of what a condition may ask (goods, soldiers...). */
export interface StoryWorld { day: number; seed: number; era: string; fireLevel: number; bossContact: number; /** Share of the common villages that are ours, pay us or fell (0..1). */ power: number; seen: Record<string, { times: number; lastDay: number }>; deeds: readonly Deed[]; base: CondCtx }
/** What a step did: a line to tell, a scene to send to the gate in `days`, something done to the world (`share`: how much of it). */
export type StoryOut =
  | { kind: 'tell'; what: 'knot' | 'fruit' | 'tip' | 'rumor'; id: string; name: string; text: string }
  | { kind: 'scene'; script: string; days: number }
  | { kind: 'effect'; effect: WorldEffect; share: number };

const CFG = STORY.config;
const bare = (id: string): string => id.slice(id.indexOf(':') + 1);
const byId = <T extends { id: string }>(l: T[]): Map<string, T> => new Map(l.map((x) => [x.id, x]));
const LEAF = byId([...STORY.leaves, ...Object.values(STORY.wild).flat()]), KNOT = byId(STORY.knots), FRUIT = byId(STORY.fruits), TIP = byId(STORY.tips), THREAD = byId(STORY.threads);
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
/** A whole number from `lo` to `hi`, the same for the same game and tag. */
const span = (seed: number, tag: string, [lo, hi]: [number, number]): number => lo + Math.floor(seedRoll(seed, tag) * (hi - lo + 1));
export const storyLeaf = (id: string): Leaf | undefined => LEAF.get(id);

const UNLOCK = byId(STORY.unlocks.map((u) => ({ ...u, id: u.key })));
/** The one place that says whether a specialist (a key of unlocks.json) may be used: a fruit or a tip it comes from has fired in the saved story (a middle tip from Nhà chung level 8), or it was bought (blueprint, library). A key the table does not list is core: always open. */
export function isUnlocked(st: StoryState, bought: readonly string[], key: string, fireLevel: number): boolean {
  const u = UNLOCK.get(key);
  if (!u) return true;
  if (bought.includes(key)) return true;
  return u.from.some((f) => (f.startsWith('fruit:') ? !!st.fruits[f] : (['end', 'mid'] as const).some((slot) => st.tips[slot]?.main === f && (slot === 'end' || fireLevel >= 8))));
}
/** Every specialist the table lists. */
export const unlockList = (): typeof STORY.unlocks => STORY.unlocks;

/** The hidden marks now: each deed counts by the table of marks.json while it is inside the window of the mark; the deeds of the stone age count for a share once the medieval age began (rounded towards zero); the tips add theirs. */
export function marksOf(deeds: readonly Deed[], day: number, eraDay: number, bonus: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of STORY.marks) {
    let now = 0, old = 0;
    for (const d of deeds) {
      const w = STORY.deeds[d.key]?.[m.id];
      if (!w || (m.window !== undefined && day - d.day > m.window)) continue;
      if (eraDay > 0 && d.day < eraDay) old += w; else now += w;
    }
    out[m.id] = now + Math.trunc(old * (m.carry ?? CFG.carry)) + (bonus[m.id] ?? 0);
  }
  return out;
}

/** How far the age has gone, 0..1. Stone age: the mean of the Nhà chung level (1 is 0, 4 is 1) and of the stand against the leader villages. Medieval age: the Nhà chung level (4 is 0, 10 is 1). No clock. */
export const progressOf = (w: Pick<StoryWorld, 'era' | 'fireLevel' | 'bossContact'>): number => (w.era === 'stone' ? (clamp01((w.fireLevel - 1) / 3) + w.bossContact) / 2 : clamp01((w.fireLevel - 4) / 6));
/** The stages of a branch that have been played (a stage is played when its script was seen at the gate). */
export const chaptersDone = (t: Thread, seen: StoryWorld['seen']): number => t.chapters.filter((c) => (seen[c.script ?? c.id]?.times ?? 0) > 0).length;

/** What a condition may ask of the tree. */
export function condOf(st: StoryState, w: Pick<StoryWorld, 'day' | 'era' | 'fireLevel' | 'bossContact' | 'seen' | 'deeds' | 'power'>): StoryCond {
  const tips: Record<string, number> = {};
  for (const t of Object.values(st.tips)) { tips[bare(t.main)] = 1; if (t.second) tips[bare(t.second)] ??= CFG.secondShare; }
  return {
    marks: marksOf(w.deeds, w.day, st.eraDay, st.bonus), flags: st.flags, progress: progressOf(w), leaves: Object.values(st.knots).map((k) => bare(k.leaf)), fruits: Object.keys(st.fruits).map(bare),
    chapters: Object.fromEntries(STORY.threads.map((t) => [bare(t.id), chaptersDone(t, w.seen)])), tips, mode: st.mode, power: w.power,
  };
}
const ctxOf = (st: StoryState, w: StoryWorld): CondCtx => ({ ...w.base, day: w.day, fireLevel: w.fireLevel, deeds: w.deeds, story: condOf(st, w) });

/** What the stone-age tips left: the main one in full, the second for a share. */
const legacyOf = (st: StoryState): Array<[Legacy, number]> => {
  const t = st.tips.stone, out: Array<[Legacy, number]> = [];
  if (t && STORY.legacy[t.main]) out.push([STORY.legacy[t.main], 1]);
  if (t?.second && STORY.legacy[t.second]) out.push([STORY.legacy[t.second], CFG.secondShare]);
  return out;
};
const tiltOf = (st: StoryState, leaf: string): number => legacyOf(st).reduce((a, [l, s]) => a * (1 + ((l.tilt?.[leaf] ?? 1) - 1) * s), 1);
/** A multiplier the tips put on the game (`mods` of legacy.json: `marketFee`, `arrivals`...): 1 when no tip speaks of it. */
export function storyMod(st: StoryState, key: string, day = 0): number {
  let a = legacyOf(st).reduce((x, [l, s]) => x * (1 + ((l.mods?.[key] ?? 1) - 1) * s), 1);
  for (const k of Object.values(st.knots)) { // the leaves that stand (an old tale for a share; a passing one for its days)
    const leaf = LEAF.get(k.leaf), m = leaf?.mods?.[key];
    if (m === undefined || (leaf!.modDays !== undefined && day - k.day > leaf!.modDays)) continue;
    a *= 1 + (m - 1) * (k.old ? CFG.oldTaleShare : 1);
  }
  for (const id of Object.keys(st.fruits)) a *= FRUIT.get(id)?.mods?.[key] ?? 1;
  const tip = st.tips.end ?? st.tips.mid; // the medieval tip that stands: the last one, else the middle one
  if (tip) { a *= TIP.get(tip.main)?.mods?.[key] ?? 1; if (tip.second) a *= 1 + ((TIP.get(tip.second)?.mods?.[key] ?? 1) - 1) * CFG.secondShare; }
  return a;
}

/** The weight of each leaf of a knot now: w = max(wmin, base + sum(affinity x mark)), times the tilts that hold, the legacy of the tips and the play mode for a hard leaf. A leaf whose `needs` fails gives way to its `alt` (or weighs nothing). */
export function leafWeights(st: StoryState, k: Knot, c: CondCtx): Array<{ leaf: string; w: number }> {
  const marks = c.story?.marks ?? {};
  return k.leaves.map((kl) => {
    let leaf = LEAF.get(kl.leaf);
    if (leaf?.needs && !evalCond(leaf.needs, c)) leaf = leaf.alt ? LEAF.get(leaf.alt) : undefined;
    if (!leaf || (leaf.needs && !evalCond(leaf.needs, c))) return { leaf: kl.leaf, w: 0 };
    let w = Math.max(CFG.wmin, kl.base + Object.entries(kl.affinity ?? {}).reduce((a, [m, x]) => a + x * (marks[m] ?? 0), 0));
    for (const t of kl.tilt ?? []) if (evalCond(t.if, c)) w *= t.mul;
    w *= tiltOf(st, kl.leaf);
    if (leaf.hard) w *= CFG.hardMul[st.mode];
    return { leaf: leaf.id, w };
  });
}

/** The leaf a knot draws: a wild one by a small chance (each once in a game), else by weight; the dice are the seed of the game and the id of the knot, so a reload draws the same. */
function drawLeaf(st: StoryState, w: StoryWorld, k: Knot, c: CondCtx): { leaf: string; pale?: boolean; wild?: boolean } {
  const wilds = (STORY.wild[k.tree] ?? []).filter((l) => !Object.values(st.knots).some((x) => x.leaf === l.id));
  if (wilds.length && seedRoll(w.seed, `wild|${k.id}`) < CFG.wildChance) return { leaf: wilds[Math.floor(seedRoll(w.seed, `wildpick|${k.id}`) * wilds.length)].id, wild: true };
  const ws = leafWeights(st, k, c), total = ws.reduce((a, x) => a + x.w, 0);
  if (total <= 0) return { leaf: k.fallback, pale: true };
  let r = seedRoll(w.seed, `leaf|${k.id}`) * total;
  for (const x of ws) { r -= x.w; if (r < 0) return { leaf: x.leaf }; }
  return { leaf: ws[ws.length - 1].leaf };
}

function fireKnot(st: StoryState, w: StoryWorld, k: Knot, p: StoryState['pending'][string], out: StoryOut[]): void {
  const drawn = p.pale ? { leaf: k.fallback, pale: true, wild: false } : drawLeaf(st, w, k, ctxOf(st, w)), leaf = LEAF.get(drawn.leaf);
  if (!leaf) return;
  st.knots[k.id] = { day: w.day, leaf: leaf.id, ...(drawn.pale ? { pale: true } : {}), ...(drawn.wild ? { wild: true } : {}), ...(p.old ? { old: true } : {}) };
  for (const f of leaf.flags ?? []) if (!st.flags.includes(f)) st.flags.push(f);
  out.push({ kind: 'tell', what: 'knot', id: leaf.id, name: `${p.old ? 'Chuyện cũ: ' : ''}${k.name}: ${leaf.name}`, text: leaf.text });
  for (const e of leaf.effects ?? []) out.push({ kind: 'effect', effect: e, share: p.old ? CFG.oldTaleShare : 1 });
  if (leaf.scene) out.push({ kind: 'scene', script: leaf.id, days: 1 });
}

function ripen(st: StoryState, w: StoryWorld, f: Fruit, from: string[], out: StoryOut[]): void {
  const variant = f.variants?.length ? Math.floor(seedRoll(w.seed, `variant|${f.id}`) * f.variants.length) : 0, v = f.variants?.[variant];
  st.fruits[f.id] = { day: w.day, from, variant };
  if (!st.flags.includes(f.flag)) st.flags.push(f.flag);
  out.push({ kind: 'tell', what: 'fruit', id: f.id, name: f.name, text: v ? `${f.text} ${v.text}` : f.text });
  for (const e of v?.effects ?? []) out.push({ kind: 'effect', effect: e, share: 1 });
  if (f.scene) out.push({ kind: 'scene', script: f.id, days: 1 });
}

/** The tips of a tree by their points: 3 a ripe fruit, 1 a leaf that fell into no fruit, half a point a dominant mark; a tip asleep gives its points to another. A tip needs a fruit or a leaf to count; with none the default one stands. The second is the next of another family. */
export function scoreTips(st: StoryState, w: Pick<StoryWorld, 'day' | 'seed' | 'deeds'>, tree: TreeDef): { main: string; second?: string; scores: Record<string, number> } | null {
  const marks = marksOf(w.deeds, w.day, st.eraDay, st.bonus), dominant = Object.entries(marks).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, CFG.tip.dominant).map(([m]) => m);
  const inFruit = new Set(Object.values(st.fruits).flatMap((f) => f.from)), leaves = new Set(Object.values(st.knots).map((k) => k.leaf));
  const tips = STORY.tips.filter((t) => t.tree === tree.id), solid: Record<string, number> = {}, scores: Record<string, number> = {};
  for (const t of tips) {
    const to = t.off ? t.flowTo : t.id;
    if (!to) continue;
    const s = CFG.tip.fruit * t.fruits.filter((f) => st.fruits[f]).length + CFG.tip.leaf * (t.leaves ?? []).filter((l) => leaves.has(l) && !inFruit.has(l)).length;
    solid[to] = (solid[to] ?? 0) + s;
    scores[to] = (scores[to] ?? 0) + s + CFG.tip.mark * (t.marks ?? []).filter((m) => dominant.includes(m)).length;
  }
  const ranked = tips.filter((t) => !t.off && !t.default && (solid[t.id] ?? 0) >= (tree.tipMin ?? 1)).sort((a, b) => scores[b.id] - scores[a.id] || seedRoll(w.seed, `tip|${a.id}`) - seedRoll(w.seed, `tip|${b.id}`));
  const main = ranked[0] ?? tips.find((t) => t.default);
  if (!main) return null;
  return { main: main.id, second: ranked.find((t) => t !== main && t.family !== main.family)?.id, scores };
}

function setTip(st: StoryState, w: StoryWorld, tree: TreeDef, slot: string, out: StoryOut[]): void {
  const r = scoreTips(st, w, tree);
  if (!r) return;
  st.tips[slot] = { main: r.main, day: w.day, ...(r.second ? { second: r.second } : {}) };
  for (const id of [r.main, r.second]) { const t = id ? TIP.get(id) : undefined; if (t) out.push({ kind: 'tell', what: 'tip', id: t.id, name: `${id === r.main ? 'Ngọn' : 'Ngọn phụ'}: ${t.name}`, text: t.text }); }
}

/** The stone age is over (Ngày Sương Tan): its tips are scored, they give the medieval age its first marks, and the knots that never fired wait as old tales. */
function closeStone(st: StoryState, w: StoryWorld, out: StoryOut[]): void {
  st.eraDay = w.day;
  for (const tree of STORY.trees) {
    if (tree.era === w.era) continue;
    const mine = (id: string): boolean => KNOT.get(id)?.tree === tree.id || FRUIT.get(id)?.tree === tree.id;
    for (const id of Object.keys(st.pending)) if (mine(id)) delete st.pending[id];
    for (const t of tree.tips) if (t.at === 'eraEnd' && !st.tips[t.slot]) setTip(st, w, tree, t.slot, out);
    st.old = STORY.knots.filter((k) => k.tree === tree.id && !st.knots[k.id] && k.fedBy.some((id) => { const th = THREAD.get(id); return !!th && chaptersDone(th, w.seen) > 0; })).map((k) => k.id);
  }
  for (const [l, share] of legacyOf(st)) for (const [m, n] of Object.entries(l.marks ?? {})) st.bonus[m] = (st.bonus[m] ?? 0) + n * share;
}

/**
 * One step of the tree (about once a game second): what is due today happens (a knot draws its leaf, a fruit ripens), the scenes of the branches are sent, the knots and fruits that have become ready
 * are given their day, the tips are scored at their level, the rumours are told. Mutates `st`; returns what the game must do about it.
 */
export function stepStory(st: StoryState, w: StoryWorld): StoryOut[] {
  const out: StoryOut[] = [];
  if (w.era !== 'stone' && st.eraDay === 0) closeStone(st, w, out);
  const tree = STORY.trees.find((t) => t.era === w.era);
  if (!tree) return out;

  for (const [id, p] of Object.entries(st.pending)) {
    if (w.day < p.day) continue;
    delete st.pending[id];
    const k = KNOT.get(id), f = FRUIT.get(id);
    if (k) fireKnot(st, w, k, p, out); else if (f) ripen(st, w, f, p.from ?? [], out);
  }
  const c = ctxOf(st, w), first = legacyOf(st)[0]?.[0].trunk;

  // the scenes of the branches: each after the stage before it, the favoured trunk of the legacy a few days ahead of the others
  for (const th of STORY.threads) {
    if (th.tree !== tree.id) continue;
    th.chapters.forEach((ch, i) => {
      if (!ch.scene || (w.seen[ch.id]?.times ?? 0) > 0) return;
      if (st.sent[ch.id] !== undefined && w.day - st.sent[ch.id] < CFG.resendDays) return;
      const prev = i > 0 ? th.chapters[i - 1] : undefined, prevSeen = prev ? w.seen[prev.script ?? prev.id] : undefined;
      if ((prev && !(prevSeen && prevSeen.times > 0)) || !evalCond(ch.when, c)) return;
      const gap = (ch.days ? span(w.seed, `chapter|${ch.id}`, ch.days) : 0) + (i === 0 && first && th.trunk !== first ? 4 : 0);
      st.sent[ch.id] = w.day;
      out.push({ kind: 'scene', script: ch.id, days: Math.max(0, (prevSeen ? prevSeen.lastDay : w.day) + gap - w.day) });
    });
  }

  // the knots that have become ready
  for (const k of STORY.knots) {
    if (k.tree !== tree.id || st.knots[k.id] || st.pending[k.id]) continue;
    if (tree.onePerTrunk) {
      const sib = STORY.knots.filter((o) => o !== k && o.tree === k.tree && o.trunk === k.trunk);
      if (sib.some((o) => st.knots[o.id] || st.pending[o.id])) continue;
      // which knot of a trunk comes first is the seed's: the other one waits while the favoured one may still fire (its branch was begun and its window is not over)
      const all = [k, ...sib].sort((a, b) => (a.id < b.id ? -1 : 1)), fav = all[Math.floor(seedRoll(w.seed, `trunk|${k.trunk}`) * all.length)];
      if (fav !== k && fav.fedBy.some((id) => { const th = THREAD.get(id); return !!th && chaptersDone(th, w.seen) > 0; }) && c.story!.progress <= (fav.when.progress ?? [0, Infinity])[1]) continue;
    }
    if (k.fedBy.reduce((a, id) => a + (THREAD.get(id) ? chaptersDone(THREAD.get(id)!, w.seen) : 0), 0) < k.when.chapters) continue;
    const at = k.when.fire ? w.fireLevel : c.story!.progress, [lo, hi] = k.when.fire ?? k.when.progress ?? [0, Infinity];
    if (at < lo) continue;
    const ok = evalCond(k.when.cond, c);
    if (!ok && at <= hi) continue; // not enough marks yet: it waits to the end of its window, then fires pale
    st.pending[k.id] = { day: w.day + span(w.seed, `knot|${k.id}`, CFG.knotDelay), ...(ok ? {} : { pale: true }) };
  }
  // the old tales: one for each Nhà chung level from 5 on, one at a time
  if (w.era !== 'stone' && st.old.length && !st.old.some((id) => st.pending[id])) {
    const next = st.old.find((id) => !st.knots[id]);
    if (next && w.fireLevel >= 5 && st.old.filter((id) => st.knots[id]).length < w.fireLevel - 4) st.pending[next] = { day: w.day + span(w.seed, `knot|${next}`, CFG.knotDelay), old: true };
  }

  // the fruits: leaves of two trunks meet, and a leaf feeds two fruits at most
  const trunkOf = new Map(Object.entries(st.knots).map(([kid, x]) => [x.leaf, KNOT.get(kid)?.trunk ?? '']));
  const fed = (leaf: string): number => Object.values(st.fruits).filter((f) => f.from.includes(leaf)).length + Object.values(st.pending).filter((p) => p.from?.includes(leaf)).length;
  for (const f of STORY.fruits) {
    if (f.tree !== tree.id || st.fruits[f.id] || st.pending[f.id]) continue;
    const from: string[] = [];
    for (const need of f.needs) { const hit = (Array.isArray(need) ? need : [need]).find((l) => trunkOf.has(l) && fed(l) < 2 && !from.includes(l)); if (hit) from.push(hit); }
    if (from.length < (f.min ?? 2) || new Set(from.map((l) => trunkOf.get(l))).size < 2) continue;
    st.pending[f.id] = { day: w.day + span(w.seed, `fruit|${f.id}`, CFG.fruitDelay), from };
  }

  for (const t of tree.tips) if (typeof t.at === 'number' && w.fireLevel >= t.at && !st.tips[t.slot]) setTip(st, w, tree, t.slot, out);

  for (const r of STORY.rumors) {
    const key = `${r.mark}:${r.at}`, v = c.story!.marks[r.mark] ?? 0;
    if (st.told.includes(key) || !(r.below ? v <= r.at : v >= r.at)) continue;
    st.told.push(key);
    out.push({ kind: 'tell', what: 'rumor', id: key, name: 'Lời đồn', text: r.text });
  }
  return out;
}

// ---------------------------------------------------------------- the checker
const effectsOf = (s: Script): Effect[] => Object.values(s.nodes).flatMap((n) => [...(n.effects ?? []), ...(n.choices ?? []).flatMap((c) => c.effects ?? [])]);

/** The data of the tree checked: ids that hang, leaves no knot draws, knots that can never fire, leaves that feed more than two fruits, fruits that grow no tip, flags asked for that nobody sets. */
export function validateStory(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const err = (s: string): void => { errors.push(s); }, warn = (s: string): void => { warnings.push(s); };
  const marks = new Set(STORY.marks.map((m) => m.id)), trees = new Set(STORY.trees.map((t) => t.id)), scripts = byId(SCRIPTS);
  const wild = Object.values(STORY.wild).flat(), chapters = STORY.threads.flatMap((t) => t.chapters);

  const seenIds = new Set<string>();
  for (const x of [...STORY.threads, ...chapters, ...STORY.knots, ...STORY.leaves, ...wild, ...STORY.fruits, ...STORY.tips]) { if (seenIds.has(x.id)) err(`${x.id}: id used twice`); seenIds.add(x.id); }
  for (const k of Object.keys(STORY.wild)) if (!trees.has(k)) err(`wild leaves of unknown tree "${k}"`);

  const deedsKnown = new Set([...Object.keys(STORY.deeds), ...SCRIPTS.flatMap((s) => effectsOf(s).map((e) => e.deed).filter((d): d is string => !!d))]);
  const flagsSet = new Set<string>([...STORY.leaves, ...wild].flatMap((l) => l.flags ?? []).concat(STORY.fruits.map((f) => f.flag), SCRIPTS.flatMap((s) => effectsOf(s).map((e) => e.sflag).filter((f): f is string => !!f))));
  const flagsUsed = new Map<string, string>();
  const cond = (where: string, expr?: string): void => {
    if (!expr) return;
    for (const t of condTerms(expr)) {
      if (!t) { err(`${where}: cannot read the condition "${expr}"`); continue; }
      for (const k of t.keys) {
        if (!COND_NAMES.some((n) => (n.endsWith('.') ? k.startsWith(n) : k === n))) err(`${where}: unknown name "${k}" in "${expr}"`);
        else if (k.startsWith('sflag.')) flagsUsed.set(k.slice(6), where);
        else if (k.startsWith('mark.') && !marks.has(k.slice(5))) err(`${where}: unknown mark "${k}"`);
        else if (k.startsWith('leaf.') && !LEAF.has(`leaf:${k.slice(5)}`)) err(`${where}: unknown leaf "${k}"`);
        else if (k.startsWith('fruit.') && !FRUIT.has(`fruit:${k.slice(6)}`)) err(`${where}: unknown fruit "${k}"`);
        else if (k.startsWith('tip.') && !TIP.has(`tip:${k.slice(4)}`)) err(`${where}: unknown tip "${k}"`);
        else if (k.startsWith('chapters.') && !THREAD.has(`thread:${k.slice(9)}`)) err(`${where}: unknown branch "${k}"`);
        else if (k.startsWith('deed.') && !deedsKnown.has(k.slice(5))) warn(`${where}: no script leaves the deed "${k.slice(5)}"`);
      }
    }
  };
  const world = (where: string, list: WorldEffect[] | undefined): void => { for (const e of list ?? []) if (e.deed && !STORY.deeds[e.deed]) warn(`${where}: the deed "${e.deed}" moves no mark`); };

  for (const [deed, row] of Object.entries(STORY.deeds)) for (const m of Object.keys(row)) if (!marks.has(m)) err(`marks.json deed "${deed}": unknown mark "${m}"`);
  for (const r of STORY.rumors) if (!marks.has(r.mark)) err(`rumour: unknown mark "${r.mark}"`);
  for (const s of STORY_SCENES) {
    if (s.scene.options.length < 2) warn(`${s.id}: a scene with fewer than two answers`);
    s.scene.options.forEach((o) => { cond(s.id, o.cond); if (o.deed && !STORY.deeds[o.deed]) warn(`${s.id}: the deed "${o.deed}" moves no mark`); for (const e of o.effects ?? []) cond(s.id, e.if); });
  }

  for (const t of STORY.threads) {
    if (!trees.has(t.tree)) err(`${t.id}: unknown tree "${t.tree}"`);
    if (!STORY.knots.some((k) => k.fedBy.includes(t.id))) warn(`${t.id}: feeds no knot`);
    for (const c of t.chapters) {
      cond(c.id, c.when);
      if (!!c.script === !!c.scene) { err(`${c.id}: needs either a script or a scene`); continue; }
      if (!c.script) continue;
      const s = scripts.get(c.script);
      if (!s) { err(`${c.id}: unknown script "${c.script}"`); continue; }
      if (!c.options?.length) warn(`${c.id}: no summary of the choices of "${c.script}" for the simulator`);
      const left = new Set(effectsOf(s).map((e) => e.deed));
      for (const o of c.options ?? []) for (const d of o.deeds) if (!left.has(d)) warn(`${c.id}: "${c.script}" never leaves the deed "${d}"`);
    }
  }

  const drawable = new Set<string>(wild.map((l) => l.id)), fallbacks = new Set<string>();
  for (const k of STORY.knots) {
    const tree = STORY.trees.find((t) => t.id === k.tree);
    if (!tree) err(`${k.id}: unknown tree "${k.tree}"`);
    for (const id of k.fedBy) if (!THREAD.has(id)) err(`${k.id}: unknown branch "${id}"`);
    const most = k.fedBy.reduce((a, id) => a + (THREAD.get(id)?.chapters.length ?? 0), 0);
    if (k.when.chapters > most) err(`${k.id}: can never fire (asks ${k.when.chapters} stages, its branches have ${most})`);
    const win = k.when.fire ?? k.when.progress;
    if (!win) warn(`${k.id}: no window (progress or fire)`); else if (win[0] > win[1]) err(`${k.id}: window upside down`);
    if (k.when.fire && tree && ((tree.era === 'stone' && k.when.fire[0] > 3) || (tree.era !== 'stone' && k.when.fire[0] > 10))) err(`${k.id}: can never fire (Nhà chung level ${k.when.fire[0]} is outside its age)`);
    cond(k.id, k.when.cond);
    if (!LEAF.has(k.fallback)) err(`${k.id}: unknown fallback leaf "${k.fallback}"`); else { drawable.add(k.fallback); fallbacks.add(k.fallback); }
    if (!k.leaves.length) err(`${k.id}: no leaves`);
    for (const kl of k.leaves) {
      const leaf = LEAF.get(kl.leaf);
      if (!leaf) { err(`${k.id}: unknown leaf "${kl.leaf}"`); continue; }
      drawable.add(leaf.id);
      if (leaf.alt) { if (LEAF.has(leaf.alt)) drawable.add(leaf.alt); else err(`${leaf.id}: unknown alt leaf "${leaf.alt}"`); }
      for (const m of Object.keys(kl.affinity ?? {})) if (!marks.has(m)) err(`${k.id} / ${kl.leaf}: unknown mark "${m}"`);
      for (const t of kl.tilt ?? []) cond(`${k.id} / ${kl.leaf}`, t.if);
    }
  }
  for (const t of STORY.trees) if (!STORY.knots.some((k) => k.tree === t.id)) warn(`tree "${t.id}": no knots`);

  const feeds = new Map<string, number>();
  for (const f of STORY.fruits) {
    if (!trees.has(f.tree)) err(`${f.id}: unknown tree "${f.tree}"`);
    const all = f.needs.flatMap((n) => (Array.isArray(n) ? n : [n]));
    for (const l of all) { if (!LEAF.has(l)) err(`${f.id}: unknown leaf "${l}"`); feeds.set(l, (feeds.get(l) ?? 0) + 1); }
    const trunks = new Set(all.map((l) => STORY.knots.find((k) => k.leaves.some((kl) => kl.leaf === l) || k.fallback === l)?.trunk));
    if (trunks.size < 2) err(`${f.id}: can never ripen (its leaves are all of one trunk)`);
    if ((f.min ?? 2) > f.needs.length) err(`${f.id}: asks ${f.min} leaves of ${f.needs.length}`);
    if (!STORY.tips.some((t) => t.fruits.includes(f.id))) err(`${f.id}: grows no tip`);
    for (const v of f.variants ?? []) world(f.id, v.effects);
  }
  for (const [l, n] of feeds) if (n > 2) err(`${l}: feeds ${n} fruits (2 at most)`);

  for (const l of [...STORY.leaves, ...wild]) {
    cond(l.id, l.needs); world(l.id, l.effects);
    if (!drawable.has(l.id)) err(`${l.id}: no knot draws it`);
    else if (!feeds.has(l.id) && !fallbacks.has(l.id) && !wild.includes(l) && !STORY.tips.some((t) => t.leaves?.includes(l.id))) warn(`${l.id}: feeds no fruit and no tip`);
  }

  for (const tree of STORY.trees) { const n = STORY.tips.filter((t) => t.tree === tree.id && t.default).length; if (n !== 1) err(`tree "${tree.id}": ${n} default tips (1 wanted)`); }
  for (const t of STORY.tips) {
    if (!trees.has(t.tree)) err(`${t.id}: unknown tree "${t.tree}"`);
    for (const f of t.fruits) if (!FRUIT.has(f)) err(`${t.id}: unknown fruit "${f}"`);
    for (const l of t.leaves ?? []) if (!LEAF.has(l)) err(`${t.id}: unknown leaf "${l}"`);
    for (const m of t.marks ?? []) if (!marks.has(m)) err(`${t.id}: unknown mark "${m}"`);
    if (t.off && (!t.flowTo || !TIP.has(t.flowTo) || TIP.get(t.flowTo)!.off)) err(`${t.id}: asleep, and its points flow nowhere`);
  }
  for (const [id, l] of Object.entries(STORY.legacy)) {
    if (!TIP.has(id)) err(`legacy: unknown tip "${id}"`);
    for (const m of Object.keys(l.marks ?? {})) if (!marks.has(m)) err(`legacy ${id}: unknown mark "${m}"`);
    for (const leaf of Object.keys(l.tilt ?? {})) if (!LEAF.has(leaf)) err(`legacy ${id}: unknown leaf "${leaf}"`);
  }
  for (const [f, where] of flagsUsed) if (!flagsSet.has(f)) err(`${where}: asks for the flag "${f}" that nothing sets`);
  // the unlocks: the core is never locked, each specialist can really be had; with `strict` the table of the doc is demanded whole
  const keys = new Set<string>();
  for (const u of STORY.unlocks) {
    if (keys.has(u.key)) err(`unlock ${u.key}: listed twice`); keys.add(u.key);
    if (u.core) err(`unlock ${u.key}: the core must never be locked (core: true)`);
    if (!/^(unit|building|perk|research):/.test(u.key) || !u.key.startsWith(`${u.kind}:`)) err(`unlock ${u.key}: key and kind do not agree`);
    if (!u.sources.length || (!u.sources.includes('blueprint') && !u.from.length)) err(`unlock ${u.key}: no source that can be reached`);
    if (u.sources.includes('blueprint') && !u.blueprintCost) warn(`unlock ${u.key}: a blueprint source with no price`);
    for (const f of u.from) if (!(f.startsWith('fruit:') ? FRUIT.has(f) : TIP.has(f))) (STORY.unlocksStrict ? err : warn)(`unlock ${u.key}: unknown source "${f}"`);
  }
  if (STORY.unlocksStrict) {
    for (const f of STORY.fruits.filter((x) => x.tree === 'medieval')) if (STORY.unlocks.filter((u) => u.from.includes(f.id)).length !== 1) err(`${f.id}: must open exactly one specialist`);
    for (const t of STORY.tips.filter((x) => x.tree === 'medieval' && !x.default)) { const mine = STORY.unlocks.filter((u) => u.from.includes(t.id)); if (mine.filter((u) => u.kind === 'unit').length !== 1 || mine.filter((u) => u.kind === 'perk').length < 1) err(`${t.id}: must open one unit and one power`); }
  }
  return { errors, warnings };
}
