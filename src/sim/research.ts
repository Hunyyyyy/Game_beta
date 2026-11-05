import data from '../data/research.json';
import type { BuildingKind } from './buildings';
import { scaleBill } from './resources';
import type { Stock } from './resources';
import { labLevelOf } from './progression';
import tree from '../data/researchtree.json';

/** One research step. For blueprints the id is the recipe id it opens (axe1 = wood axe, axe2 = stone axe). */
export interface Tech {
  id: string; name: string; desc: string;
  requires: string[];
  /** Level the Nhà nghiên cứu must have. */
  needLevel: number;
  cost: Partial<Stock>;
  /** Seconds with one average researcher at speed 1. */
  time: number;
  unlocks: { tier?: { role: string; tier: number }; bonus?: { role: string; stat: string; pct: number }; formationCells?: number; squads?: number; recipes?: string[]; buildings?: BuildingKind[]; mounts?: string[] };
}

/** Research is on by default; with `enabled` false every recipe, building level and automation is open. */
export const RESEARCH = { enabled: (data as unknown as { enabled: boolean }).enabled };
/** Workshop level each recipe needs. */
const RECIPE_LEVEL = (data as unknown as { recipeLevel: Record<string, number> }).recipeLevel;
/** How much more the materials of a craft cost for each level of the Nhà chế tạo above the first (0.5 = half as much again), from research.json. */
export const CRAFT_COST_PER_LEVEL = (data as unknown as { craftCostPerLevel?: number }).craftCostPerLevel ?? 0.5;
export const recipeNeedLevel = (id: string): number => RECIPE_LEVEL[id] ?? 1;
export const TECHS = (data as unknown as { techs: Tech[] }).techs;
// which research-house level teaches a step is the plan's call (data/progression.json), not the step's
for (const t of TECHS) { t.needLevel = labLevelOf(t.id); t.cost = scaleBill(t.cost); }
export const TECH_BY_ID: Record<string, Tech> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

// ---------------------------------------------------------------- stat lines (data/researchtree.json)
export type StatId = 'hp' | 'atk' | 'defm' | 'defr' | 'move' | 'work' | 'int' | 'sta';
export interface StatDef { name: string; short: string; steps: number[]; tiers?: number[]; cost: Partial<Stock>; time: number; about: string }
/** A stat with a line in the tree: the eight of a body, and three of the weapon in hand (attack speed, critical chance, critical damage). */
export type LineStat = StatId | 'aspd' | 'crit' | 'critd' | 'tspd' | 'tyield' | 'gyield' | 'tdur' | 'hpregen' | 'restregen' | 'mspeed' | 'mload' | 'mbuild';
export const STAT_IDS = Object.keys(tree.stats) as LineStat[];
export const STAT_DEF = tree.stats as unknown as Record<LineStat, StatDef>;
export const TREE_ROLES = tree.roles as unknown as Record<string, { name: string; building?: BuildingKind; weapon?: string; tool?: string; formation?: boolean; needs?: string }>;
/** How many levels a stat line has: as many as it has steps in researchtree.json, so each stat sets its own. */
export const statLevels = (stat: string): number => STAT_DEF[stat as LineStat].steps.length;
/** The level of the Nhà nghiên cứu a level of a stat needs: the stat's own list, else the common one (the last number goes on for higher levels). */
const labNeeded = (stat: string, n: number): number => { const t = STAT_DEF[stat as LineStat].tiers ?? tree.tiers; return t[Math.min(n, t.length) - 1]; };
/** The percent a stat line adds at most for a village whose Nhà nghiên cứu is at this level (every step whose level it needs is open). */
export const statBonusAtLab = (stat: LineStat, lab: number): number => STAT_DEF[stat].steps.reduce((a, s, i) => a + (labNeeded(stat, i + 1) <= lab ? s : 0), 0);
/** What opens each tab of the research house: Quân sự needs this level of the house, and Vũ khí opens with Quân sự. */
export const TREE_TABS = tree.tabs as { military: { needLab: number } };
/** Roles whose stats grow down a chain: each level of a stat needs the stat above it at the same level, and the top stat needs the bottom one a level lower. Their other stats do not exist. */
export interface ChainDef { roles: string[]; order: LineStat[]; scale?: number; gates?: Partial<Record<LineStat, string>>; layout?: Array<{ stats?: LineStat[]; techs?: string[] }>; finalTier?: { tier: number; roles: string[]; cost: Partial<Stock>; time: number; needLab: number } }
export const CHAINS: Record<string, ChainDef> = Object.fromEntries(Object.entries(tree.chains).filter(([, c]) => typeof c !== 'string')) as unknown as Record<string, ChainDef>;
/** The share of each step a role gets (a formation gives half of what a role does). */
export const ROLE_SCALE: Record<string, number> = {};
for (const c of Object.values(CHAINS)) if (c.scale !== undefined) for (const r of c.roles) ROLE_SCALE[r] = c.scale;
export const statTechId = (role: string, stat: string, n: number): string => `${role}_${stat}_${n}`;
/** The steps of every stat line, one research for each level; they live beside TECHS, not in it, because there are over a thousand. */
export const STAT_TECHS: Tech[] = [];
for (const def of Object.values(CHAINS)) for (const role of def.roles) for (const stat of def.order) {
  const s = STAT_DEF[stat], chain = def.order, at = chain.indexOf(stat);
  for (let n = 1; n <= statLevels(stat); n++) {
    const cost: Partial<Stock> = {};
    for (const [res, amount] of Object.entries(s.cost)) cost[res as keyof Stock] = Math.max(1, Math.round((amount as number) * tree.growth.cost ** (n - 1)));
    cost.coin = (cost.coin ?? 0) + Math.floor(n / 2);
    Object.assign(cost, scaleBill(cost));
    const t: Tech = {
      id: statTechId(role, stat, n), name: `${s.name} · ${TREE_ROLES[role].name} ${n}`, desc: `${s.about} Cộng ${s.steps[n - 1] * (ROLE_SCALE[role] ?? 1)}% cho ${TREE_ROLES[role].formation ? 'lính đứng trong trận ' : ''}${TREE_ROLES[role].name.toLowerCase()}.`,
      requires: [...(n > 1 ? [statTechId(role, stat, n - 1)] : at === 0 && TREE_ROLES[role].needs ? [TREE_ROLES[role].needs!] : []), ...(n === 1 && def.gates?.[stat] ? [def.gates[stat]!] : []), ...(chain && at > 0 ? [statTechId(role, chain[at - 1], Math.min(n, statLevels(chain[at - 1])))] : []), ...(chain && at === 0 && n > 1 ? [statTechId(role, chain[chain.length - 1], Math.min(n - 1, statLevels(chain[chain.length - 1])))] : [])], needLevel: labNeeded(stat, n), cost, time: Math.round(s.time * tree.growth.time ** (n - 1)),
      unlocks: { bonus: { role, stat, pct: s.steps[n - 1] * (ROLE_SCALE[role] ?? 1) } },
    };
    STAT_TECHS.push(t); TECH_BY_ID[t.id] = t;
  }
}
/** The research that opens a tier of soldiers for a role: it waits for every stat of the role at its top level. */
export const tierTechId = (role: string, tier: number): string => `${role}_tier${tier}`;
export const TIER_TECH_OF: Record<string, Tech> = {};
for (const c of Object.values(CHAINS)) {
  if (!c.finalTier) continue;
  const ft = c.finalTier;
  for (const role of ft.roles) {
    const t: Tech = {
      id: tierTechId(role, ft.tier), name: `${TREE_ROLES[role].name} bậc ${ft.tier}`, desc: TREE_ROLES[role].weapon ? `Mở ${TREE_ROLES[role].name.toLowerCase()} bậc ${ft.tier}: mọi người cầm nó gây sát thương nhiều hơn. Cần nghiên cứu đủ mọi chỉ số của vũ khí này.` : `Mở bậc ${ft.tier} của ${TREE_ROLES[role].name.toLowerCase()}: mọi người làm vai trò này mạnh hơn ngay. Cần nghiên cứu đủ mọi chỉ số của họ.`,
      requires: c.order.map((stat) => statTechId(role, stat, statLevels(stat))), needLevel: ft.needLab, cost: ft.cost, time: ft.time, unlocks: { tier: { role, tier: ft.tier } },
    };
    STAT_TECHS.push(t); TECH_BY_ID[t.id] = t; TIER_TECH_OF[role] = t;
  }
}
/** The highest tier of soldiers a role has open (1 until research opens the next). */
export const soldierTier = (done: ReadonlySet<string>, role: string): number => { let n = 1; for (let k = 2; k <= 6; k++) if (done.has(tierTechId(role, k))) n = k; return n; };

/** How many levels of a stat line are researched. */
export function lineLevel(done: ReadonlySet<string>, role: string, stat: string): number {
  let n = 0;
  while (n < statLevels(stat) && done.has(statTechId(role, stat, n + 1))) n++;
  return n;
}
/** The Kế hoạch chiến đấu tree (three columns of military stats, and the research each pair of levels opens): the squads of its columns, and its layout. */
export const PLAN_TREE = (tree as unknown as { plan: { roles: string[]; layout: Array<{ stats?: LineStat[]; techs?: string[] }> } }).plan;
/** What each piece of research of that tree opens in the war plan: the details tab, the supply sums, the weather and the rest in the field. */
export const PLAN_TECH = { detail: 'plan_report', supply: 'plan_supply', weather: 'plan_weather', rest: 'plan_rest' } as const;
export type PlanFeature = keyof typeof PLAN_TECH;
export const planOpen = (done: ReadonlySet<string>, f: PlanFeature, advanced: boolean, free = false): boolean => advanced && (free || !RESEARCH.enabled || done.has(PLAN_TECH[f]));
/** The percent the research adds to a stat of everyone with a role (their stat is base × (1 + this / 100)). Not yet used by the combat and work rules. */
export const statBonus = (done: ReadonlySet<string>, role: string, stat: LineStat): number =>
  STAT_DEF[stat].steps.slice(0, lineLevel(done, role, stat)).reduce((a, b) => a + b, 0) * (ROLE_SCALE[role] ?? 1);

/** A recipe can be made once its blueprint step is researched. */
/** Tools, weapons, armour and torches need no blueprint: only the level of the Nhà chế tạo (recipeLevel) limits them. */
const NO_BLUEPRINT = /^(club|spear|mace|sling|bow|hide|bone|axe|pick|hoe|hammer|torch)\d$/;
export const recipeOpen = (done: ReadonlySet<string>, recipeId: string): boolean => !RESEARCH.enabled || NO_BLUEPRINT.test(recipeId) || done.has(recipeId);
/** The blueprint step that opens a recipe. */
export const techForRecipe = (recipeId: string): Tech | undefined => TECH_BY_ID[recipeId] ?? TECHS.find((t) => t.unlocks.recipes?.includes(recipeId));

/** The biggest value of a numeric unlock (cells of a formation, squads) among the steps done, or the default when none is. */
export const unlockedMax = (done: ReadonlySet<string>, key: 'formationCells' | 'squads', base: number): number =>
  TECHS.reduce((m, t) => (done.has(t.id) ? Math.max(m, t.unlocks[key] ?? 0) : m), base);

/** Highest level a building kind may reach with the research done so far (1 when nothing is researched). */

/** The tech that allows a kind of building to be built (undefined when it is open from the start). */
export const techForBuilding = (kind: BuildingKind): Tech | undefined => TECHS.find((t) => t.unlocks.buildings?.includes(kind));
export const buildingOpen = (done: ReadonlySet<string>, kind: BuildingKind): boolean => { const t = techForBuilding(kind); return !RESEARCH.enabled || !t || done.has(t.id); };

const KIND_NAME: Partial<Record<BuildingKind, string>> = { storage: 'Kho', workshop: 'Nhà chế tạo', lab: 'Nhà nghiên cứu', toolstore: 'Kho công cụ', armory: 'Kho vũ khí', infantry: 'Trại chiến binh', cavalry: 'Trại kỵ thú', archery: 'Trại thợ ném', farmhouse: 'Nông trại', huntlodge: 'Chòi thợ săn', lumberyard: 'Xưởng gỗ', quarry: 'Xưởng đá', house: 'Nhà dân', field: 'Ruộng', fence: 'Hàng rào', gate: 'Cổng', tower: 'Chòi canh', wartent: 'Lều họp chiến', scouttent: 'Trại trinh sát', drill: 'Bãi tập', trap: 'Hố chông', stable: 'Chuồng thú cưỡi' };
/** What a tech unlocks, as a short Vietnamese phrase for the UI. */
export const unlockText = (t: Tech, recipeName: (id: string) => string): string => {
  const parts = [...(t.unlocks.recipes ?? []).map(recipeName)];
  for (const k of t.unlocks.buildings ?? []) parts.push(`xây ${KIND_NAME[k] ?? k}`);
  for (const m of t.unlocks.mounts ?? []) parts.push(`thuần hóa ${({ wolf: 'sói', boar: 'lợn rừng', elephant: 'voi' } as Record<string, string>)[m] ?? m}`);
  return parts.join(', ');
};
