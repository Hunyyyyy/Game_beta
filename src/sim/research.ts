import { isRankRole, rankDef, rankName, rankPower } from './ranks';
import weaponsJson from '../data/weapons.json';
import statsJson from '../data/stats.json';
import type { RankRole } from './ranks';
import data from '../data/research.json';
import type { BuildingKind } from './buildings';
import { scaleBill } from './resources';
import type { Stock } from './resources';
import { labLevelOf } from './progression';
import tree from '../data/researchtree.json';

const num = (x: number): string => String(Math.round(x * 100) / 100).replace('.', ',');
const weaponName = (id: string): string => ((weaponsJson.weapons as unknown as Record<string, { name: string }>)[id]?.name ?? id).toLowerCase();
/** One research step. */
export interface Tech {
  id: string; name: string; desc: string;
  requires: string[];
  /** Or: so many of these researches done is enough (a leap of the pillars opens with most of the stats of its row, not all of them). */
  needCount?: { ids: string[]; count: number };
  /** A leap that is only planned (it has no effect in the game yet): nothing to research, it counts as done as soon as what it waits for is done, so that the rows over it and the leaps that need it still open. */
  milestone?: boolean;
  /** Level the Nhà nghiên cứu must have. */
  needLevel: number;
  cost: Partial<Stock>;
  /** Seconds with one average researcher at speed 1. */
  time: number;
  unlocks: { tier?: { role: string; tier: number }; weaponTier?: { role: string; tier: number }; perk?: Record<string, number>; bonus?: { role: string; stat: string; pct: number }; formationCells?: number; squads?: number; buildings?: BuildingKind[]; mounts?: string[] };
}

/** Research is on by default; with `enabled` false every recipe, building level and automation is open. */
export const RESEARCH = { enabled: (data as unknown as { enabled: boolean }).enabled };
/** Workshop level each recipe needs. */
const RECIPE_LEVEL = (data as unknown as { recipeLevel: Record<string, number> }).recipeLevel;
/** How much more the materials of a craft cost for each level of the Nhà chế tạo above the first (0.5 = half as much again), from research.json. */
export const CRAFT_COST_PER_LEVEL = (data as unknown as { craftCostPerLevel?: number }).craftCostPerLevel ?? 0.5;
/** What the Nhà chế tạo adds to what it makes, for each level above the first: this many times more damage (weapons) and more wear to break (weapons, armour, tools). data/research.json craftQualityPerLevel. */
const QUALITY_PER_LEVEL = (data as unknown as { craftQualityPerLevel?: number }).craftQualityPerLevel ?? 1;
export const craftQuality = (workshopLevel: number): number => QUALITY_PER_LEVEL ** Math.max(0, workshopLevel - 1);
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
export interface ChainDef { roles: string[]; order: LineStat[]; /** Stats a role of the chain does not have (the output of gathering means nothing to a tamer). */ except?: Partial<Record<LineStat, string[]>>; scale?: number; gates?: Partial<Record<LineStat, string>>; layout?: Array<{ stats?: LineStat[]; techs?: string[] }>; rankTiers?: Record<string, unknown>; finalTier?: { tier: number; roles: string[]; cost: Partial<Stock>; time: number; needLab: number } }
export const CHAINS: Record<string, ChainDef> = Object.fromEntries(Object.entries(tree.chains).filter(([, c]) => typeof c !== 'string')) as unknown as Record<string, ChainDef>;
/** The share of each step a role gets (a formation gives half of what a role does). */
export const ROLE_SCALE: Record<string, number> = {};
for (const c of Object.values(CHAINS)) if (c.scale !== undefined) for (const r of c.roles) ROLE_SCALE[r] = c.scale;
/** The stats of a role in a chain, in the order they open. */
export const statsFor = (def: ChainDef, role: string): LineStat[] => def.order.filter((s) => !def.except?.[s]?.includes(role));
export const statTechId = (role: string, stat: string, n: number): string => `${role}_${stat}_${n}`;
export const tierTechId = (role: string, tier: number): string => `${role}_tier${tier}`;
/**
 * The tree by pillars (data/researchtree.json `pillars`, doc/cơ chế nghiên cứu): a pillar is a big branch (Binh lực, Sinh kế, Kỹ nghệ), a column (strand) a role growing from row 1 upward.
 * A row has three nodes (a real stat, or a node that is only planned) and a leap (the research that opens a soldier rank, a tier of weapon or of trade; or a milestone that is only planned).
 * The rules: a stat level needs the level before it; a row opens when the leap of the row below is reached; a leap needs `leapShare` of the real stat levels of its row and its `cross`
 * leaps in other columns, and the level of the Nhà nghiên cứu of its row (`labByRow`).
 */
export interface PillarNode { stat?: LineStat; planned?: string; about?: string; max?: number }
export interface PillarSide { name: string; short: string; desc: string; /** What each level takes off (percent). */ effect: Record<string, number> }
export interface PillarLeap {
  id: string; planned?: string; about?: string;
  /** A branch that turns down from the leap: a discount, long to research and small. */
  side?: PillarSide;
  /** A leap with an effect of its own: its name, its description and what it does (percent by kind: storage, gatherSpeed, gatherCarry, camp_<arm>...). */
  name?: string; desc?: string; effect?: Record<string, number>;
  /** Its own price and time (else the one of its kind), the share of the stat levels of its row it needs (else `leapShare`), and the level of the Nhà nghiên cứu. */
  cost?: Partial<Stock>; time?: number; share?: number; lab?: number;
}
/**
 * A row: three nodes and (usually) a leap. A medieval row (`era: 'ancient'`) has its own stat lines (`group`, a made-up role of the arm, five levels each, a fraction of a stone level each);
 * a row without a leap hands over to the next one when most of its levels are done (a stretch of stats between two ranks).
 */
export interface PillarRow { nodes: PillarNode[]; leap?: PillarLeap; cross?: string[]; era?: string; group?: string; /** The roles a made-up role of this row counts for (else those of the strand). */ members?: string[] }
export interface PillarStrand { key: string; role: string; name: string; who: string; era?: string; /** The roles its medieval rows count for (else its own role): the five formations, the three arms. */ members?: string[]; rows: PillarRow[] }
export interface PillarDef { id: string; name: string; icon: BuildingKind; about: string; strands: PillarStrand[] }
interface MedCfg { levels: number; stepScale: number; costMult: number; timeMult: number; growth: number; lab: number }
const PILLAR_DATA = (tree as unknown as { pillars: { leapShare: number; labByRow: number[]; sideLevels: number; sideCostMult: number; sideTimeMult: number; med: MedCfg; list: PillarDef[] } }).pillars;
export const PILLARS = PILLAR_DATA.list;
const MED = PILLAR_DATA.med;
/** Where a stat of a role stands in the pillars (nothing for the roles outside them: the formations, the plan and the march of the medieval age). Stone rows only. */
const SLOT = new Map<string, { strand: PillarStrand; row: number }>();
/** The row each leap ends. */
const LEAP_ROW = new Map<string, { strand: PillarStrand; row: number; leap: PillarLeap; data: PillarRow }>();
/** The made-up roles of the medieval rows of the pillars: each has the stats of one row of one arm and counts for the arm (a group the arm belongs to). */
const MED_ROLES = new Set<string>();
for (const p of PILLARS) for (const strand of p.strands) strand.rows.forEach((data, i) => {
  if (data.era === 'ancient' && data.group) MED_ROLES.add(data.group);
  else for (const n of data.nodes) if (n.stat) SLOT.set(`${strand.role}|${n.stat}`, { strand, row: i + 1 });
  if (data.leap) LEAP_ROW.set(data.leap.id, { strand, row: i, leap: data.leap, data });
});
for (const p of PILLARS) for (const strand of p.strands) for (const data of strand.rows) if (data.era === 'ancient' && data.group) TREE_ROLES[data.group] = { ...TREE_ROLES[strand.role], members: data.members ?? strand.members ?? [strand.role] } as typeof TREE_ROLES[string];
/** How many levels a stat line of a role has, and what each gives: the stat's own, or for a medieval row the fraction of it set in researchtree.json. */
export const levelsOfLine = (role: string, stat: string): number => (MED_ROLES.has(role) ? MED.levels : statLevels(stat));
export const stepsOfLine = (role: string, stat: string): number[] => {
  const s = STAT_DEF[stat as LineStat].steps;
  return MED_ROLES.has(role) ? Array.from({ length: MED.levels }, () => Math.round((s.reduce((a, b) => a + b, 0) / s.length) * MED.stepScale * 100) / 100) : s;
};
/** The research ids of every level of the real stats of a row. */
const rowTechs = (role: string, data: PillarRow): string[] => {
  const r = data.group ?? role;
  return data.nodes.flatMap((n) => (n.stat ? Array.from({ length: levelsOfLine(r, n.stat) }, (_, i) => statTechId(r, n.stat!, i + 1)) : []));
};
const enough = (ids: string[], share = PILLAR_DATA.leapShare): { ids: string[]; count: number } => ({ ids, count: Math.ceil(ids.length * share - 1e-9) });
/** What a stat level of a row waits for besides the level before it: the leap of the row below, or (a row with no leap below) most of that row. */
function rowGate(strand: PillarStrand, row: number): { requires: string[]; needCount?: { ids: string[]; count: number } } {
  const below = row > 1 ? strand.rows[row - 2] : null;
  if (!below) return { requires: [] };
  return below.leap ? { requires: [below.leap.id] } : { requires: [], needCount: enough(rowTechs(strand.role, below)) };
}
/** A leap of the pillars waits for most of the real stat levels of its row and for its cross leaps, and for the level of the house of its row. */
function applyLeap(t: Tech): void {
  const at = LEAP_ROW.get(t.id);
  if (!at) return;
  const ids = rowTechs(at.strand.role, at.data), gate = ids.length ? null : rowGate(at.strand, at.row + 1); // a row of a leap alone waits for the row before it
  t.requires = [...(at.data.cross ?? []), ...(gate?.requires ?? [])];
  const count = ids.length ? enough(ids, at.leap.share) : gate?.needCount;
  if (count) t.needCount = count; else delete t.needCount;
  t.needLevel = at.leap.lab ?? PILLAR_DATA.labByRow[at.row] ?? t.needLevel;
}

for (const t of TECHS) applyLeap(t); // the leaps that are single researches of research.json (the formations, the plan): the pillars set what they wait for

/** The steps of every stat line, one research for each level; they live beside TECHS, not in it, because there are over a thousand. */
export const STAT_TECHS: Tech[] = [];
for (const def of Object.values(CHAINS)) for (const role of def.roles) for (const stat of statsFor(def, role)) {
  const s = STAT_DEF[stat], chain = statsFor(def, role), at = chain.indexOf(stat);
  for (let n = 1; n <= statLevels(stat); n++) {
    const cost: Partial<Stock> = {};
    for (const [res, amount] of Object.entries(s.cost)) cost[res as keyof Stock] = Math.max(1, Math.round((amount as number) * tree.growth.cost ** (n - 1)));
    cost.coin = (cost.coin ?? 0) + Math.floor(n / 2);
    Object.assign(cost, scaleBill(cost));
    const slot = SLOT.get(`${role}|${stat}`), gate = slot ? rowGate(slot.strand, slot.row) : null; // in a pillar the rows rule the order; outside them the chain does
    const t: Tech = {
      id: statTechId(role, stat, n), name: `${s.name} · ${TREE_ROLES[role].name} ${n}`, desc: `${s.about} Cộng ${s.steps[n - 1] * (ROLE_SCALE[role] ?? 1)}% cho ${TREE_ROLES[role].formation ? 'lính đứng trong trận ' : ''}${TREE_ROLES[role].name.toLowerCase()}.`,
      requires: gate ? [...(n > 1 ? [statTechId(role, stat, n - 1)] : []), ...(n === 1 ? gate.requires : [])] : [...(n > 1 ? [statTechId(role, stat, n - 1)] : at === 0 && TREE_ROLES[role].needs ? [TREE_ROLES[role].needs!] : []), ...(n === 1 && def.gates?.[stat] ? [def.gates[stat]!] : []), ...(chain && at > 0 ? [statTechId(role, chain[at - 1], Math.min(n, statLevels(chain[at - 1])))] : []), ...(chain && at === 0 && n > 1 ? [statTechId(role, chain[chain.length - 1], Math.min(n - 1, statLevels(chain[chain.length - 1])))] : []), ...(at === 0 && n > 1 && isRankRole(role) && def.rankTiers ? [tierTechId(role, n)] : [])],
      ...(gate?.needCount && n === 1 ? { needCount: gate.needCount } : {}), needLevel: labNeeded(stat, n), cost, time: Math.round(s.time * tree.growth.time ** (n - 1)),
      unlocks: { bonus: { role, stat, pct: s.steps[n - 1] * (ROLE_SCALE[role] ?? 1) } },
    };
    STAT_TECHS.push(t); TECH_BY_ID[t.id] = t;
  }
}
// the stat lines of the medieval rows: a made-up role for each row (see MED_ROLES), five levels each, a fraction of a stone level each, dearer and longer, for the house of the medieval age
for (const p of PILLARS) for (const strand of p.strands) strand.rows.forEach((row, i) => {
  if (row.era !== 'ancient' || !row.group) return;
  const gate = rowGate(strand, i + 1);
  for (const n of row.nodes) {
    if (!n.stat) continue;
    const base = STAT_DEF[n.stat], steps = stepsOfLine(row.group, n.stat);
    for (let lv = 1; lv <= MED.levels; lv++) {
      const grow = MED.growth ** (lv - 1), cost: Partial<Stock> = {};
      for (const [res, amount] of Object.entries(base.cost)) cost[res as keyof Stock] = Math.max(1, Math.round((amount as number) * MED.costMult * grow));
      cost.coin = (cost.coin ?? 0) + lv * 2;
      const t: Tech = {
        id: statTechId(row.group, n.stat, lv), name: `${base.name} · ${strand.name} (Trung cổ) ${lv}`, desc: `${base.about} Cộng ${steps[lv - 1]}%.`,
        requires: lv > 1 ? [statTechId(row.group, n.stat, lv - 1)] : gate.requires, ...(lv === 1 && gate.needCount ? { needCount: gate.needCount } : {}),
        needLevel: MED.lab, cost, time: Math.round(base.time * MED.timeMult * grow), unlocks: { bonus: { role: row.group, stat: n.stat, pct: steps[lv - 1] } },
      };
      STAT_TECHS.push(t); TECH_BY_ID[t.id] = t;
    }
  }
});
/** The research that opens a tier of soldiers for a role: it waits for every stat of the role at its top level. */
export const TIER_TECH_OF: Record<string, Tech> = {};
for (const c of Object.values(CHAINS)) {
  if (!c.finalTier) continue;
  const ft = c.finalTier;
  for (const role of ft.roles) {
    const t: Tech = {
      id: tierTechId(role, ft.tier), name: `${TREE_ROLES[role].name} bậc ${ft.tier}`, desc: `Mở bậc ${ft.tier} của ${TREE_ROLES[role].name.toLowerCase()}: chỉ số làm việc ×${num((statsJson.tierMult as Record<string, Record<string, number>>)[String(ft.tier)]?.work ?? 1)}.`,
      requires: statsFor(c, role).map((stat) => statTechId(role, stat, statLevels(stat))), needLevel: ft.needLab, cost: ft.cost, time: ft.time, unlocks: { tier: { role, tier: ft.tier } },
    };
    applyLeap(t); // a leap of the pillars: most of the row, not all the stats
    STAT_TECHS.push(t); TECH_BY_ID[t.id] = t; TIER_TECH_OF[role] = t;
  }
}
/** The research that opens a RANK of soldiers of an arm (foot, cavalry, archer): rank 2 waits for every stat of the arm at level 1, rank 3 at level 2 and for rank 2. */
export const RANK_TECHS_OF: Record<string, Tech[]> = {};
for (const c of Object.values(CHAINS)) {
  const rt = c.rankTiers as ({ roles: string[] } & Record<string, { needLab: number; cost: Partial<Stock>; time: number }>) | undefined;
  if (!rt) continue;
  for (const role of rt.roles as RankRole[]) for (const n of [2, 3, 4, 5, 6, 7]) {
    const cfg = rt[String(n)], name = rankName(role, n) ?? `bậc ${n}`;
    const t: Tech = {
      id: tierTechId(role, n), name: `Mở ${name.toLowerCase()}`, desc: `Mở khóa ${name.toLowerCase()}: cầm ${weaponName(rankDef(role, n)?.weapon ?? '')}, sức mạnh ×${num(rankPower(n))}.`,
      requires: [...statsFor(c, role).map((stat) => statTechId(role, stat, n - 1)), ...(n > 2 ? [tierTechId(role, n - 1)] : [])], needLevel: cfg.needLab, cost: cfg.cost, time: cfg.time, unlocks: { tier: { role, tier: n } },
    };
    applyLeap(t);
    STAT_TECHS.push(t); TECH_BY_ID[t.id] = t; (RANK_TECHS_OF[role] ??= []).push(t);
  }
}
/** The research that raises the weapons of an arm to tier 2 ("Vũ khí bậc 2": club, spear and mace for the foot, sling and bow for the archers): their damage goes up (weapons.json rules.tierMult). */
export const weaponsTechId = (role: string): string => `${role}_weapons2`;
for (const role of ['foot', 'cavalry', 'archer']) {
  const cfg = (CHAINS.military.rankTiers as unknown as Record<string, { cost: Partial<Stock>; time: number }>)['2'];
  const t: Tech = { id: weaponsTechId(role), name: 'Vũ khí bậc 2', desc: `Mở khóa vũ khí bậc 2: sát thương vũ khí của ${TREE_ROLES[role].name.toLowerCase()} ×${num((weaponsJson.rules.tierMult as Record<string, { damage: number }>)['2'].damage)}.`, requires: [], needLevel: 3, cost: cfg.cost, time: cfg.time, unlocks: { weaponTier: { role, tier: 2 } } };
  applyLeap(t); STAT_TECHS.push(t); TECH_BY_ID[t.id] = t;
}
// the leaps with an effect of their own (a bigger store, faster and stronger gatherers): researched like the tiers of a trade
for (const [id, at] of LEAP_ROW) {
  if (!at.leap.effect) continue;
  const cfg = CHAINS.economy.finalTier!;
  const t: Tech = { id, name: at.leap.name ?? id, desc: at.leap.desc ?? '', requires: [], needLevel: 3, cost: at.leap.cost ?? cfg.cost, time: at.leap.time ?? cfg.time, unlocks: { perk: at.leap.effect } };
  applyLeap(t); STAT_TECHS.push(t); TECH_BY_ID[t.id] = t;
}
// the discounts that hang under a leap: a stat of its own with levels, opened by the leap; each level dearer and much longer than the leap itself, and worth little
export const sideTechId = (leapId: string, level: number): string => `${leapId}_cut_${level}`;
export const sideLevels = PILLAR_DATA.sideLevels;
for (const [id, at] of LEAP_ROW) {
  const side = at.leap.side, base = TECH_BY_ID[id];
  if (!side || !base) continue;
  for (let n = 1; n <= sideLevels; n++) {
    const t: Tech = { id: sideTechId(id, n), name: `${side.name} ${n}`, desc: side.desc, requires: [n === 1 ? id : sideTechId(id, n - 1)], needLevel: base.needLevel, cost: Object.fromEntries(Object.entries(base.cost).map(([r, c]) => [r, Math.ceil((c as number) * PILLAR_DATA.sideCostMult * (1 + 0.5 * (n - 1)))])) as Partial<Stock>, time: Math.round(base.time * PILLAR_DATA.sideTimeMult * n), unlocks: { perk: side.effect } };
    STAT_TECHS.push(t); TECH_BY_ID[t.id] = t;
  }
}
/** A bill with every good cut by a percent (never to less than 1, and a bill of nothing stays nothing). */
export const discountBill = (bill: Partial<Stock>, pct: number): Partial<Stock> => (pct > 0 ? (Object.fromEntries(Object.entries(bill).map(([r, n]) => [r, (n as number) > 0 ? Math.max(1, Math.round((n as number) * (1 - Math.min(pct, 50) / 100))) : n])) as Partial<Stock>) : bill);
/** What the research done adds to a perk, in percent (storage: the Kho holds more; gatherSpeed, gatherCarry: the people of the gathering trades run faster and carry more). */
export const perkPct = (done: ReadonlySet<string>, kind: string): number => {
  let n = 0;
  for (const id of done) n += TECH_BY_ID[id]?.unlocks.perk?.[kind] ?? 0;
  return n;
};
// the leaps that are only planned: a milestone each, reached by itself (see Tech.milestone)
for (const [id, at] of LEAP_ROW) {
  if (!at.leap.planned) continue;
  const t: Tech = { id, name: at.leap.planned, desc: `${at.leap.about ?? ''} Đang thiết kế, chưa có tác dụng.`, requires: [], needLevel: PILLAR_DATA.labByRow[at.row] ?? 3, cost: {}, time: 0, unlocks: {}, milestone: true };
  applyLeap(t); STAT_TECHS.push(t); TECH_BY_ID[t.id] = t;
}
/** Whether a research counts as done: researched, or a milestone whose conditions are met. */
export function reached(done: ReadonlySet<string>, id: string): boolean {
  if (done.has(id)) return true;
  const t = TECH_BY_ID[id];
  if (!t?.milestone) return false;
  return t.requires.every((r) => reached(done, r)) && (!t.needCount || t.needCount.ids.filter((r) => reached(done, r)).length >= t.needCount.count);
}

/** The names of what a research still waits for, looking through the planned milestones (they have nothing to research: what they wait for is what the player must do). */
export function missingOf(done: ReadonlySet<string>, t: Tech): string[] {
  const out: string[] = [];
  for (const r of t.requires) {
    if (reached(done, r)) continue;
    const q = TECH_BY_ID[r];
    const inner = q.milestone && !(q.needCount && q.needCount.ids.filter((x) => reached(done, x)).length < q.needCount.count) ? missingOf(done, q) : [q.name.replace(/^Mở /, '')];
    for (const n of inner) if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** The roles whose research also counts for a role: the groups it belongs to (Khai thác for the woodcutter, the stonecutter and the gatherer). */
const GROUPS_OF: Record<string, string[]> = {};
for (const [id, r] of Object.entries(TREE_ROLES)) for (const m of (r as { members?: string[] }).members ?? []) (GROUPS_OF[m] ??= []).push(id);
export const researchRoles = (role: string): string[] => [role, ...(GROUPS_OF[role] ?? [])];
/** The highest tier of soldiers a role has open (1 until research opens the next). */
export const soldierTier = (done: ReadonlySet<string>, role: string): number => { let n = 1; for (const r of researchRoles(role)) for (let k = 2; k <= 7; k++) if (done.has(tierTechId(r, k))) n = Math.max(n, k); return n; };

/** How many levels of a stat line are researched. */
export function lineLevel(done: ReadonlySet<string>, role: string, stat: string): number {
  let n = 0;
  while (n < levelsOfLine(role, stat) && done.has(statTechId(role, stat, n + 1))) n++;
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
  researchRoles(role).reduce((sum, r) => sum + stepsOfLine(r, stat).slice(0, lineLevel(done, r, stat)).reduce((a, b) => a + b, 0) * (ROLE_SCALE[r] ?? 1), 0);


/** The biggest value of a numeric unlock (cells of a formation, squads) among the steps done, or the default when none is. */
export const unlockedMax = (done: ReadonlySet<string>, key: 'formationCells' | 'squads', base: number): number =>
  TECHS.reduce((m, t) => (done.has(t.id) ? Math.max(m, t.unlocks[key] ?? 0) : m), base);

/** Highest level a building kind may reach with the research done so far (1 when nothing is researched). */

/** The tech that allows a kind of building to be built (undefined when it is open from the start). */
export const techForBuilding = (kind: BuildingKind): Tech | undefined => TECHS.find((t) => t.unlocks.buildings?.includes(kind));
export const buildingOpen = (done: ReadonlySet<string>, kind: BuildingKind): boolean => { const t = techForBuilding(kind); return !RESEARCH.enabled || !t || done.has(t.id); };

