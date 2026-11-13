/** Visitors and dialogue: the types, the scripts and the rules that need no Sim (data layer). The system that runs them is encounters.ts. */
import CONFIG from '../data/encounters.json';
import STONE from '../data/encounters/stone.json';
import type { Res, Stock } from './resources';

export type Cost = Partial<Record<Res, number>>;
/** What a choice or a node does. `join`: the visitor stays as a villager, `takeIn`: the whole party stays (and is remembered as refugees) - both when the talk ends, so the answer is heard first; `handOver`: the refugees are given away; `raid`: a raid of that size from the visitor's village; `schedule`: another script comes later. */
export interface Effect {
  rel?: number; give?: Cost; take?: Cost; join?: boolean; takeIn?: boolean; handOver?: boolean; raid?: number; deed?: string;
  schedule?: { script: string; days: number; priority?: number; sameTribe?: boolean; ifStill?: string; maxDelay?: number };
  /** `host`: the whole party is let into the village to rest (done when the talk ends: they walk in and sit about the fire); `ransom`: a villager they hold is brought back. */
  host?: boolean; ransom?: boolean;
  /** Remember something said in this talk (`flag.<name>` in a condition asks for it): a question already asked, a thing the visitor knows. */
  flag?: string;
  /** Move the visitor's mood (hidden from the player): a warm reply adds, a cold one takes away. The words and the final terms of a talk follow it (`mood` in a condition). */
  mood?: number;
  /** Done only if this condition holds now (e.g. `mood>=2`). */
  if?: string;
  /** `welcome`: that many of the party (as the village has room for) stay as villagers, when the talk ends; the ones who came to do harm are never among them. `buy`: a piece of gear is bought from the visitor: it goes to the stores if he is honest, and a cheat only takes the money. */
  welcome?: number; buy?: string;
  /** Change a raid that is coming (the one this visit is about, else the next of the visitor's village): its strength (`powerMul`), its day (`shiftDays`), or call it off (`cancel`). */
  eventMod?: { powerMul?: number; shiftDays?: number; cancel?: boolean };
}
/** `by`: the next node by what the visitor really is; `roll`: by chance, drawn from the visitor's seed; `reveals`: ask closely (adds a clue, once); `cond`: the choice shows only when it holds. */
export interface Choice { text: string; /** Choices with the same group are folded under one button on the screen ("Hỏi họ"), opened by a click. */ group?: string; /** What the player says when he takes it, shown as his own line before the answer ("Các bạn từ đâu tới?"); without it nothing is said aloud. */ say?: string;
  /** Stay at this node after the choice (the shop: buy again), saying `note` to the player. */ stay?: boolean; note?: string; cost?: Cost; effects?: Effect[]; then?: string; /** The first of these whose condition holds decides the node; else `then`. */ branch?: Array<{ cond: string; then: string }>; by?: Record<string, string>; roll?: { p: number; yes: string; no: string; /** The chance goes up by this for each point of the visitor's mood (p + mood x this). */ mood?: number; }; reveals?: boolean; cond?: string }
/** `effects` run when the node is entered. */
/**
 * One beat of what is said (each beat is one or more lines, a page each): a plain line, `{ any: [...] }` (one of the options, drawn for this visitor and this beat), or `{ tone: [...] }` (the option at the visitor's
 * own tone: every `tone` beat of the talk picks at the same place of its list, so the voice stays the same: write the friendly option first in each, the curt one last), or `{ when: cond, say: [...] }` (said only when the
 * condition holds: what was asked or said before changes what is said now; see the flags). An option is a line or a list of lines.
 */
export type Beat = string | { any: Array<string | string[]> } | { tone: Array<string | string[]> } | { when: string; say: string | Beat[] };
export interface Node { say: string | Beat[]; choices?: Choice[]; effects?: Effect[]; /** The choices are the goods of the visitor's shop (the script's `shop`, those of the era), then the node's own choices. */ shop?: boolean }
/** A piece of gear a merchant sells: its id in the stores (`sim.toolStock`), its name, its price in shells, the era it belongs to. */
export interface ShopItem { id: string; name: string; price: number; era: string; /** A lot of goods for the stores (instead of a piece of gear in `toolStock`). */ give?: Cost }
/**
 * What the ones who came to do harm do, whatever is said at the gate (it can happen while the player reads): `who` of the party (a range) slip away `after` so many seconds of the party standing there, and each
 * steals from the stores (`take`: a few kinds of goods, `pick` how many, `each` how much of each, from the `pool` of goods the village really has, and shells) or carries off the most skilled villager out of doors
 * (`kidnap`; if there is none to take, they steal food). What is taken leaves the stores only when the thief has the goods in his hands.
 */
export interface Act { do: 'steal' | 'kidnap'; who: [number, number]; after: [number, number]; take?: { pick: [number, number]; each: [number, number]; pool: Res[]; coin: [number, number] } }
/** The weight of a kind of visitor goes from `lo` times its `w` (a village worth `from` shells or less) to `hi` times (`to` shells or more): the richer the village, the likelier. */
export interface WealthScale { from: number; to: number; lo: number; hi: number }
/** A thing the player may notice, with the chance it shows for each kind of visitor: it only raises the odds, it never proves anything. */
export interface Clue { text: string; p: Record<string, number> }
export interface Script {
  id: string; fireLevel: [number, number]; minDay: number; weight: number; maxTimes?: number; cooldownDays?: number;
  tribes?: string[]; relation?: [number, number]; waitDays?: number; start: string; nodes: Record<string, Node>;
  truth?: Array<{ kind: string; w: number; act?: Act; scale?: WealthScale }>; clues?: Clue[];
  /** A merchant's shop: `show` goods of the era drawn by the seed (gear and lots of goods alike); with `bonus.chance` a fourth, a bargain at `bonus.price` of its price, which is a fake with chance `bonus.fake` even from an honest merchant (a cheat's goods are all fakes). */
  shop?: { show: number; /** The price falls by this share for each point of the visitor's mood above 0 (up to 3) and rises for each below (0.04: a warm talk gives 12% off, a cold one asks 12% more). */ moodPrice?: number; bonus?: { chance: number; price: number; fake: number }; items: ShopItem[] };
  /** Any free village may send them, whatever its relation to us. */
  anywhere?: boolean;
  /**
   * A talk that goes round by round: the visitor speaks, the player picks a reply (each moves the mood), the visitor answers by the mood, and so on for `rounds` [least, most] exchanges (drawn for each visitor),
   * then the visitor puts his terms by the mood (`final`) and the player decides. A choice whose `then` is "@round" ends an exchange (it goes to `hub`, or to `final` when the exchanges are done). If the mood falls to
   * `below` or less the visitor ends the talk himself: `walkout` is said (no choice) and the talk is over, its effects the consequence.
   */
  talk?: { hub: string; final: string; /** The node he says when he ends the talk himself (no choice). Without `walkout` and `below` he never does. */ walkout?: string; below?: number; rounds: [number, number] };
  /** Who comes with the visitor: how many (the visitor is one of them), what they carry (weapons of weapons.json, in turn), whether they wear armour, and what share of health the others have (the wounded). */
  party?: { size: [number, number]; weapons?: string[]; armor?: boolean; hurt?: number };
}

export const ENC = CONFIG as unknown as {
  first: { script: string; day: number }; /** The daily party of strangers comes only until this time of day; the other visitors come after it. */ dailyUntil: number; gapDays: Record<string, [number, number]>; arrive: [number, number]; spawnDist: number;
  meetInset: number; gateOut: number; meetMin: number; meetMax: number; maxVisitors: number; waitDays: Record<string, number>; leaveGiveUp: number; relationFloor: number; typeCps: number; inputGuardMs: number;
  guards: { send: number; contact: number }; provoke: { radius: number; fleeRatio: number };
  maxDelay: number; slainDelayDays: number; revealNoiseChance: number; repeat: { noSameTwice: boolean; weightDecayPerSeen: number };
  relationGain: { windowDays: number; capDays: number; cap: number };
  /** Scripts that come on a fixed day, set up when a game begins. */ fixed: Array<{ script: string; day: number; tribe?: string; priority?: number }>;
  ultimatum: { chance: number };
  /** `fleeSpeed`: how fast those who run with loot or a captive go, against their own pace. `justifiedRefund`: relation given back when the ones struck were not honest. */
  chase: { fleeSpeed: number }; justifiedRefund: number;
  /** `friendlyRel` / `firmRel`: what a gentle or a harsh question is worth to an honest visitor in relation with his village. */
  /** `restSeconds`: how long a party let in sits about the fire; `actSeconds`: how long one who came to do harm tries before he gives up. */
  visit: { restSeconds: number; actSeconds: number };
};
export const SCRIPTS: Script[] = (STONE as unknown as { scripts: Script[] }).scripts;
export const scriptOf = (id: string): Script | undefined => SCRIPTS.find((s) => s.id === id);

/** A visitor met: where they are in the walk, and their place in the dialogue. */
export interface Visitor {
  id: number; scriptId: string; tribe: string; unitId: number;
  /** What the visitor really is (honest, ...): drawn once when they appear and saved. */
  truth: string;
  /** Every random outcome of this visitor comes from this number (`seedRoll`), so loading a save cannot roll again. */
  seed: number;
  state: 'walking' | 'waiting' | 'visiting' | 'leaving';
  /** The meeting point, and where they came from (they walk back there). */
  mx: number; my: number; hx: number; hy: number;
  arrivedAt: number; expiresAt: number;
  /** Seconds the walk has been stuck (no path), to give up and put them at the meeting point. */
  stuck: number;
  /** The clues the player has seen (the words of the script, with the tokens not yet filled), and the choices already used ("node:index"). */
  notes: string[]; used: string[];
  /** The rest of the party (unit ids) and where each stands at the meeting point. */
  members: number[]; spots: Array<[number, number]>;
  /** Set when the talk has settled that they stay: 'one' (the visitor) or 'all' (the party); done when the talk ends. */
  join: '' | 'one' | 'all';
  /** The guards of the village sent out to meet them (their own post, and the one they were sent to), and whether guards were looked for already. */
  escort: Escort[]; placed: boolean;
  /** Someone of the party was struck by us: the armed took up the fight, the rest walk home. Said once (the deeds are written once). */
  provoked: boolean;
  /** The raid this visit is about (an ultimatum). */
  event?: string;
  /** The gate they come to (its guards are the ones who go out to stop them); none when the village has no gate. */
  gate?: number;
  /** Set when the talk let them in; while they are in the village: where the speaker sits and the second they get up to leave. The ones who slip away to do harm (`agents`). */
  host?: boolean; seat?: [number, number]; visitUntil?: number; agents: Agent[];
  /** How many of the party the talk took in, and which of the merchant's goods were bought already. */
  welcome?: number; sold?: string[];
  /** What has been said or asked in the talk (effect `flag`), for the conditions of what comes next. */
  flags?: string[];
  /** The mood the replies have brought him to, and how many exchanges this talk has (from the script's `talk`). */
  mood?: number; rounds?: number;
  /** They were caught with what they took and wait to be judged. */
  caught?: boolean;
  /** What the guards are picked by: the nearest to it go out. The gate of the village they come by, or the campfire when there is no gate. */
  watch: [number, number];
}
/** A guard sent to stop a visitor: his own post (hx, hy) to go back to, and the spot he was sent to (ax, ay): a guard whose post is no longer that one was given another order by the player. */
export interface Escort { id: number; hx: number; hy: number; ax: number; ay: number }
/** One thing the village did, for the scripts to ask about later (`deed.<key>>=N@30d`). */
export interface Deed { key: string; tribe?: string; day: number }
/** A script to come on a day: follow-ups and what a choice set going. */
export interface QueueItem { script: string; day: number; priority: number; tribe?: string; linkedTo?: number; ifStill?: string; maxDelay: number; /** The raid (id of the event) it is about: it is dropped when that raid has gone off. */ event?: string }
/** One of the party who slips away: what he does, where he is in it (wait: still with the party, until `delay` seconds are over; go: on his way; run: running home with what he took), whom he goes for, and what he carries. */
export interface Agent { id: number; act: Act; phase: 'wait' | 'go' | 'run' | 'done'; age: number; delay: number; target?: number; loot?: Cost; captive?: number }
/** A villager carried off by strangers: the plain data to bring him back as he was. */
export interface Captive { id: number; tribe: string; day: number; data: Record<string, unknown> }
export interface EncounterState {
  /** The dialogue that is open (the world stands still but for what is in view while it is): who, which node and which line of it. Null when none, or when put off with "Để sau". */
  active: { visitorId: number; node: string; line: number; /** What the player said to come to this node (shown first, as his line). */ said?: string; /** The exchanges done so far (see `talk`). */ round?: number } | null;
  visitors: Visitor[];
  /** The day the next visitor is drawn. */
  nextAt: number;
  nextId: number;
  /** A clock (seconds) so the system looks about once a second, not every tick. */
  clock: number;
  /** Its own clock (seconds) for the ones who slip away: it also runs while a dialogue is open and the game clock stands still. */
  aclock: number;
  deeds: Deed[];
  queue: QueueItem[];
  /** The script that came last (never the same twice in a row), and how often each came. */
  last: string;
  seen: Record<string, { times: number; lastDay: number }>;
  /** What relation was gained from each village and when (so kindness is no farm). */
  gains: Array<{ tribe: string; day: number; n: number }>;
  /** The villagers who came as refugees (to give them away, or to know they are still here). */
  refugees: number[];
  /** The villagers strangers carried off and still hold (to be ransomed or fetched). */
  captives: Captive[];
}
export const initialEncounters = (): EncounterState => ({
  active: null, visitors: [], nextAt: ENC.first.day, nextId: 1, clock: 0, aclock: 0, deeds: [], last: '', seen: {}, gains: [], refugees: [], captives: [],
  queue: ENC.fixed.map((f) => ({ script: f.script, day: f.day, priority: f.priority ?? 7, tribe: f.tribe, maxDelay: ENC.maxDelay })),
});

/**
 * A number from 0 to under 1 that depends only on the seed of a visitor and a tag: the same visitor and the same question always give the same answer, so a reload cannot roll again.
 * (A hash of saved numbers, not a random stream of its own.)
 */
export function seedRoll(seed: number, tag: string, i = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  const s = `${tag}|${i}`;
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** What the visitor really is: by the weights of the script, from the seed. A script with no `truth` is honest. */
export function truthOf(s: Script, seed: number, wealth = 0): string {
  if (!s.truth?.length) return 'honest';
  const weight = (t: NonNullable<Script['truth']>[number]) => (t.scale ? t.w * (t.scale.lo + (t.scale.hi - t.scale.lo) * Math.max(0, Math.min(1, (wealth - t.scale.from) / Math.max(1, t.scale.to - t.scale.from)))) : t.w);
  let r = seedRoll(seed, 'truth') * s.truth.reduce((a, t) => a + weight(t), 0);
  for (const t of s.truth) { r -= weight(t); if (r < 0) return t.kind; }
  return s.truth[0].kind;
}

/**
 * The clue that "ask closely" brings out, drawn by the seed of the visitor and weighted by each clue's `p` for what he really is: the more telling a clue is of his kind, the likelier it comes, but every clue has its
 * chance, so a clue added to a script gets used. For an honest visitor it comes only half of the time (`revealNoiseChance`) and only if some clue has a `p.honest`: "nothing found" proves nothing. If no clue has a `p` for his
 * kind, one of the clues not seen yet is drawn evenly. Null when there is none.
 */
export function revealClue(s: Script, v: Pick<Visitor, 'truth' | 'seed' | 'notes'>): string | null {
  const left = (s.clues ?? []).filter((c) => !v.notes.includes(c.text));
  if (!left.length) return null;
  const w = (c: Clue) => c.p[v.truth] ?? 0, total = left.reduce((a, c) => a + w(c), 0);
  if (v.truth === 'honest' && (seedRoll(v.seed, 'reveal', v.notes.length) >= ENC.revealNoiseChance || total <= 0)) return null;
  const roll = seedRoll(v.seed, 'pick', v.notes.length);
  if (total <= 0) return left[Math.floor(roll * left.length)].text;
  let r = roll * total;
  for (const c of left) { r -= w(c); if (r < 0) return c.text; }
  return left[left.length - 1].text;
}

/** How many times a deed was done (to one village, when `tribe` is given), within the last `within` days when given. */
export function deedCount(deeds: readonly Deed[], key: string, tribe: string | undefined, within: number | undefined, day: number): number {
  return deeds.filter((d) => d.key === key && (tribe === undefined || d.tribe === tribe) && (within === undefined || day - d.day <= within)).length;
}

/** What a condition may ask about. */
export interface CondCtx { stock: Stock; day: number; fireLevel: number; rel: number; truth: string; refugees: number; soldiers: number; captives: number; room: number; party: number; flags: readonly string[]; mood: number; deeds: readonly Deed[]; tribe?: string }

/** A condition: terms joined by `&&`, each `name op value` with `op` of >= <= == != > <. Names: `stock.<good>`, `deed.<key>` (add `@30d` for the last 30 days), `rel`, `day`, `fireLevel`, `refugees`, `soldiers` (how many soldiers we have), `captives` (villagers held by strangers), `room` (free places to live), `party` (how many came), `flag.<name>` (1 if it was set in this talk, else 0), `mood` (the visitor's, moved by `mood` effects), `truth`. An empty condition holds. */
export function evalCond(expr: string | undefined, c: CondCtx): boolean {
  if (!expr) return true;
  return expr.split('&&').every((term) => {
    const m = /^\s*([\w.:]+?)\s*(>=|<=|==|!=|>|<)\s*(-?[\w.]+?)(?:@(\d+)d)?\s*$/.exec(term);
    if (!m) return false;
    const [, key, op, rhs, win] = m;
    let left: number | string;
    if (key.startsWith('stock.')) left = c.stock[key.slice(6) as Res] ?? 0;
    else if (key.startsWith('deed.')) left = deedCount(c.deeds, key.slice(5), c.tribe, win ? Number(win) : undefined, c.day);
    else if (key === 'rel') left = c.rel;
    else if (key === 'day') left = c.day;
    else if (key === 'fireLevel') left = c.fireLevel;
    else if (key === 'refugees') left = c.refugees;
    else if (key === 'soldiers') left = c.soldiers;
    else if (key === 'captives') left = c.captives;
    else if (key === 'room') left = c.room;
    else if (key === 'party') left = c.party;
    else if (key === 'mood') left = c.mood;
    else if (key.startsWith('flag.')) left = c.flags.includes(key.slice(5)) ? 1 : 0;
    else if (key === 'truth') left = c.truth;
    else return false;
    const r: number | string = typeof left === 'number' ? Number(rhs) : rhs;
    return op === '>=' ? left >= r : op === '<=' ? left <= r : op === '==' ? left === r : op === '!=' ? left !== r : op === '>' ? left > r : left < r;
  });
}

/** The words of a script with the person put in: name, tribe and how to say "he/she". */
export function fillText(text: string, who: { name: string; tribe: string; sex: 'm' | 'f' }): string {
  const he = who.sex === 'f' ? 'cô ấy' : 'anh ta', cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return text.replace(/\{name\}/g, who.name).replace(/\{tribe\}/g, who.tribe).replace(/\{He\}/g, cap(he)).replace(/\{he\}/g, he);
}

/** The first resource short of a price, or null when the stock can pay it. */
export function shortOf(cost: Cost | undefined, stock: Stock): { res: Res; need: number; have: number } | null {
  for (const [k, n] of Object.entries(cost ?? {})) if ((stock[k as Res] ?? 0) < (n ?? 0)) return { res: k as Res, need: n ?? 0, have: Math.floor(stock[k as Res] ?? 0) };
  return null;
}

/** The lines a node says to this visitor (by his seed: the same visitor always hears the same words; a `when` beat is said only if its condition holds now). */
export function linesOf(n: Node, seed: number, nodeId: string, ctx: CondCtx): string[] {
  const walk = (beats: string | Beat[], path: string): string[] => (Array.isArray(beats) ? beats : [beats]).flatMap((b, i) => {
    const at = `${path}${i}`;
    if (typeof b === 'string') return [b];
    if ('when' in b) return evalCond(b.when, ctx) ? walk(b.say, `${at}.`) : [];
    const opts = 'any' in b ? b.any : b.tone;
    if (!opts.length) return [];
    const o = opts[Math.floor(('any' in b ? seedRoll(seed, `say:${nodeId}:${at}`) : seedRoll(seed, 'tone')) * opts.length)];
    return Array.isArray(o) ? o : [o];
  });
  return walk(n.say, '');
}
