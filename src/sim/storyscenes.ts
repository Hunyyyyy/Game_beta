/**
 * The story tree as data (doc/story_tree.md): the types, the JSON of `src/data/story/`, and the scenes of the tree turned into visitor scripts (data layer, no Sim).
 * The rules that read it are storydata.ts; the system that runs it is story.ts. Only types come from encounterdata, so encounterdata may list the scenes among its scripts.
 */
import INDEX from '../data/story/index.json';
import MARKS from '../data/story/marks.json';
import S_THREADS from '../data/story/stone/threads.json';
import S_KNOTS from '../data/story/stone/knots.json';
import S_LEAVES from '../data/story/stone/leaves.json';
import S_WILD from '../data/story/stone/wild.json';
import S_FRUITS from '../data/story/stone/fruits.json';
import S_TIPS from '../data/story/stone/tips.json';
import S_LEGACY from '../data/story/stone/legacy.json';
import M_THREADS from '../data/story/medieval/threads.json';
import M_KNOTS from '../data/story/medieval/knots.json';
import M_LEAVES from '../data/story/medieval/leaves.json';
import M_WILD from '../data/story/medieval/wild.json';
import M_FRUITS from '../data/story/medieval/fruits.json';
import M_TIPS from '../data/story/medieval/tips.json';
import UNLOCKS from '../data/story/unlocks.json';
import type { Cost, Effect, Node, Script } from './encounterdata';

export type StoryMode = 'easy' | 'normal' | 'harsh';
/** A hidden mark (Dấu): `window` days a deed counts for (absent: for ever), `carry` share of the stone-age deeds kept in the medieval age, `era` when it belongs to one age only. */
export interface MarkDef { id: string; name: string; window?: number; carry?: number; era?: string }
/** A line for the Nhật ký when a mark first reaches `at` (`below`: falls to it). */
export interface Rumor { mark: string; at: number; below?: boolean; text: string }
/** One answer of a scene: what the button says, what the visitor answers, the deed it leaves and what else it does. */
export interface SceneOption { text: string; say?: string; reply: string; deed?: string; effects?: Effect[]; cond?: string }
/** A small talk of the tree: a visitor says `say`, the player picks one option. `tribes`: the villages that may send him (absent: any free one). */
export interface Scene { say: string[]; options: SceneOption[]; tribes?: string[] }
/** A stage of a branch: an old visitor script (`script`, it comes by itself) or a scene the tree sends when `when` holds, `days` after the stage before. `options` is a summary of the choices of an old script for the simulator. */
export interface Chapter { id: string; name: string; script?: string; scene?: Scene; when?: string; days?: [number, number]; options?: Array<{ label: string; deeds: string[] }> }
export interface Thread { id: string; name: string; trunk: string; tree: string; chapters: Chapter[] }
/** A leaf a knot may draw: `base` weight, `affinity` weight per point of a mark, `tilt` multipliers when a condition holds. */
export interface KnotLeaf { leaf: string; base: number; affinity?: Record<string, number>; tilt?: Array<{ if: string; mul: number }> }
/** A knot fires when `chapters` stages of its branches are done, the progress (stone age, 0..1) or the Nhà chung level (`fire`) is in its window and `cond` holds; past the window with `cond` still false it fires its pale `fallback`. */
export interface Knot { id: string; name: string; tree: string; trunk: string; fedBy: string[]; when: { chapters: number; progress?: [number, number]; fire?: [number, number]; cond?: string }; fallback: string; leaves: KnotLeaf[] }
/** What a leaf or a fruit does to the world with no visitor about: goods, a deed, the relation with a village (`@boss`: the strongest leader left), a raid. */
export interface WorldEffect { give?: Cost; take?: Cost; deed?: string; rel?: { tribe: string; n: number }; raid?: { tribe: string; size: number } }
/** A leaf: `text` goes to the Nhật ký, `flags` stay for good, `hard` is a painful one (play mode), `needs` a condition (soldiers...) without which `alt` is drawn in its place. */
export interface Leaf { id: string; name: string; text: string; hard?: boolean; flags?: string[]; effects?: WorldEffect[]; scene?: Scene; needs?: string; alt?: string }
/** A fruit ripens when `min` (2) of its `needs` (a leaf, or one of a list) from different trunks were drawn; it leaves `flag`. */
export interface Fruit { id: string; name: string; tree: string; needs: Array<string | string[]>; min?: number; flag: string; text: string; scene?: Scene; variants?: Array<{ text: string; effects?: WorldEffect[] }> }
/** An ending of a tree: scored from its fruits, its fallen leaves and the dominant marks. `off`: asleep, its points go to `flowTo`. */
export interface Tip { id: string; name: string; tree: string; family: string; fruits: string[]; leaves?: string[]; marks?: string[]; off?: boolean; flowTo?: string; default?: boolean; text: string }
/** What a stone-age tip leaves to the medieval age: marks to begin with, the trunk that comes first, leaf weights, and game multipliers (`mods`). */
export interface Legacy { marks?: Record<string, number>; trunk?: string; tilt?: Record<string, number>; mods?: Record<string, number> }
/** A specialist the legacy may open (data/story/unlocks.json). `from`: the fruits and tips that open it, `sources`: how it can be had (story, blueprint), `blueprintCost`: the price of its blueprint. Never a core thing. */
export interface Unlock { key: string; kind: 'unit' | 'building' | 'perk' | 'research'; from: string[]; sources: Array<'story' | 'blueprint'>; blueprintCost?: Cost; core: boolean }
export interface TreeDef { id: string; era: string; onePerTrunk?: boolean; tips: Array<{ slot: string; at: 'eraEnd' | number }> }
export interface StoryConfig {
  wmin: number; wildChance: number; knotDelay: [number, number]; fruitDelay: [number, number]; tip: { fruit: number; leaf: number; mark: number; dominant: number };
  hardMul: Record<StoryMode, number>; carry: number; oldTaleShare: number; secondShare: number; sceneMaxDelay: number; scenePriority: number; resendDays: number;
}

const list = <T>(...files: unknown[]): T[] => files.flatMap((f) => Object.values(f as Record<string, unknown>).filter(Array.isArray).flat() as T[]);

/** The whole tree, both ages. */
export const STORY = {
  enabled: INDEX.enabled as boolean,
  config: INDEX.config as unknown as StoryConfig,
  trees: INDEX.trees as unknown as TreeDef[],
  marks: MARKS.marks as MarkDef[],
  deeds: MARKS.deeds as unknown as Record<string, Record<string, number>>,
  rumors: MARKS.rumors as Rumor[],
  threads: list<Thread>(S_THREADS, M_THREADS),
  knots: list<Knot>(S_KNOTS, M_KNOTS),
  leaves: list<Leaf>(S_LEAVES, M_LEAVES),
  wild: { stone: list<Leaf>(S_WILD), medieval: list<Leaf>(M_WILD) } as Record<string, Leaf[]>,
  fruits: list<Fruit>(S_FRUITS, M_FRUITS),
  tips: list<Tip>(S_TIPS, M_TIPS),
  legacy: S_LEGACY.legacy as unknown as Record<string, Legacy>,
  unlocks: (UNLOCKS.unlocks as unknown as Unlock[]),
  unlocksStrict: UNLOCKS.strict as boolean,
  blueprintFactor: UNLOCKS.blueprintFactor as number,
};

/** Every scene of the tree with the id of what owns it (a chapter, a leaf, a fruit): that id is also the id of its visitor script. */
export const STORY_SCENES: Array<{ id: string; scene: Scene }> = [
  ...STORY.threads.flatMap((t) => t.chapters.filter((c) => c.scene).map((c) => ({ id: c.id, scene: c.scene! }))),
  ...[...STORY.leaves, ...Object.values(STORY.wild).flat()].filter((l) => l.scene).map((l) => ({ id: l.id, scene: l.scene! })),
  ...STORY.fruits.filter((f) => f.scene).map((f) => ({ id: f.id, scene: f.scene! })),
];

/** A scene as a visitor script: one node that asks, one node per answer (its deed and effects run when it is entered). It is never drawn by chance (weight 0): the tree sends it. */
function sceneScript(id: string, sc: Scene): Script {
  const nodes: Record<string, Node> = { start: { say: sc.say, choices: sc.options.map((o, i) => ({ text: o.text, say: o.say, cond: o.cond, then: `o${i}` })) } };
  sc.options.forEach((o, i) => { nodes[`o${i}`] = { say: o.reply, effects: [...(o.deed ? [{ deed: o.deed }] : []), ...(o.effects ?? [])] }; });
  return { id, fireLevel: [1, 99], minDay: 0, weight: 0, anywhere: !sc.tribes, tribes: sc.tribes, start: 'start', nodes };
}
export const STORY_SCRIPTS: Script[] = STORY_SCENES.map((s) => sceneScript(s.id, s.scene));
