/** The stats of everyone who is a person (src/data/stats.json): base × personal factor × tier × (1 + research / 100). Each stat stands alone. */
import cfg from '../data/stats.json';
import { cycleOf, RULES, WeaponDef } from './combat';
import { FORMATIONS, FormationId } from './formations';
import { roleOf } from './jobs';
import type { WorkJob } from './jobs';
import { TOOL_OF_JOB } from './tools';
import { LineStat, soldierTier, statBonus, StatId, TREE_ROLES } from './research';

/** What the stat rules read of the game: the research done and the squads. A narrow type of its own so that this file, shared by the systems, never has to know the Sim. */
export interface StatSim { readonly researched: ReadonlySet<string>; readonly squads: ReadonlyArray<{ readonly id: number; readonly formation: FormationId }>; readonly foodPenalty: number }
type Sim = StatSim;
import type { Villager } from './model';

export const BASE = cfg.base as Record<StatId, number>;
const IDS = Object.keys(cfg.base) as StatId[];
const TIER_MULT = cfg.tierMult as Record<string, Partial<Record<StatId, number>>>;
const L = cfg.legacy;

/** Personal factors of a new person: a number of stars, and eight factors whose sum the stars limit. */
export function rollFactors(r: () => number): { stars: number; fac: Record<StatId, number> } {
  const w = cfg.stars.weights, total = w.reduce((a, b) => a + b, 0);
  let x = r() * total, stars = 1;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) { stars = i + 1; break; } stars = i + 1; }
  const budget = IDS.length * (cfg.stars.budgetBase + cfg.stars.budgetPerStar * stars), { min, max } = cfg.stars;
  let f = IDS.map(() => 1 - cfg.stars.spread / 2 + r() * cfg.stars.spread);
  for (let k = 0; k < 8; k++) {
    const s = f.reduce((a, b) => a + b, 0);
    f = f.map((v) => Math.max(min, Math.min(max, (v * budget) / s)));
  }
  return { stars, fac: Object.fromEntries(IDS.map((id, i) => [id, f[i]])) as Record<StatId, number> };
}

/** The role of the research tree a person counts as (null for anyone without one: a stranger, an idle villager). */
export function treeRole(v: Pick<Villager, 'job' | 'arm' | 'post'>): string | null {
  const r = roleOf(v);
  if (r) return r;
  switch (v.job) {
    case 'build': return 'build';
    case 'craft': return 'craft';
    case 'research': return 'research';
    case 'tame': return 'tame';
    case 'food': return 'farm';
    default: return null;
  }
}

/** One stat of a person now. A village that went short at the last meal is weaker in every stat but the most health (health only heals slower, see tickVillager). */
export function statValue(sim: Sim, v: Villager, stat: StatId): number {
  const role = v.team === 'player' ? treeRole(v) : null;
  const tier = role && TREE_ROLES[role] ? soldierTier(sim.researched, role) : 1;
  const mult = tier > 1 ? TIER_MULT[String(tier)]?.[stat] ?? 1 : 1;
  const squad = v.team === 'player' && v.squad >= 0 ? sim.squads.find((q) => q.id === v.squad) : undefined;
  const bonus = (role ? statBonus(sim.researched, role, stat) : 0) + (squad ? statBonus(sim.researched, FORMATIONS[squad.formation].tech.replace(/^form_/, ''), stat) : 0);
  const hunger = v.team === 'player' && stat !== 'hp' ? 1 - sim.foodPenalty : 1;
  return BASE[stat] * (v.fac?.[stat] ?? 1) * mult * (1 + bonus / 100) * hunger;
}

/** What a stat is on a person's own (no research, no tier): used when a body is made. */
export const rawValue = (fac: Record<StatId, number>, stat: StatId): number => BASE[stat] * fac[stat];

/** The four older stats, worked out from the new ones, for the rules that still read them. */
export function legacyStats(value: (s: StatId) => number): { vit: number; str: number; agi: number; sta: number } {
  return {
    vit: (value('hp') - L.hpBase) / L.hpPerVit,
    str: (value('atk') * L.atkToDamage) / L.strengthDamage,
    agi: (value('move') - L.speedBase) / L.speedPerAgi,
    sta: value('sta') * L.staScale,
  };
}

/** Bring the body in line with the research and tier of the role: health, speed and the older stats. Called about once a second for everyone of ours. */
export function applyStats(sim: Sim, v: Villager): void {
  if (v.team !== 'player') return;
  const val = (s: StatId) => statValue(sim, v, s), l = legacyStats(val);
  v.stats.vit = l.vit; v.stats.str = l.str; v.stats.agi = l.agi; v.stats.sta = l.sta;
  const hp = Math.round(val('hp'));
  if (hp !== v.maxHealth) { const ratio = v.maxHealth > 0 ? v.health / v.maxHealth : 1; v.maxHealth = hp; v.health = Math.min(hp, hp * ratio); }
  if (v.squad < 0 && !v.mount) v.speed = val('move');
}

/** Share of damage a person turns aside: from melee (Phòng thủ cận chiến) or from missiles (Phòng thủ tầm xa). */
export function guardCut(sim: Sim, v: Villager, ranged: boolean): number {
  const d = statValue(sim, v, ranged ? 'defr' : 'defm');
  return d / (d + cfg.defense.k);
}

/** Speed of work from the stat Tốc độ làm việc, raised by Trí tuệ. */
export function workSpeed(sim: Sim, v: Villager): number {
  return statValue(sim, v, 'work') * (1 + cfg.intEffect.work * (statValue(sim, v, 'int') / BASE.int - 1));
}

/** How much slower a person's energy runs out: Sức is the size of the reserve, Trí tuệ spares it. 1 for the base person. */
export function drainScale(sim: Sim, v: Villager): number {
  const reserve = Math.max(0.3, statValue(sim, v, 'sta') / cfg.staDrainRef), spare = Math.max(0.4, 1 + cfg.intEffect.drain * (statValue(sim, v, 'int') / BASE.int - 1));
  return 1 / (reserve * spare);
}

/** Damage of a weapon in the hands of a person: its own, times the tier its research has opened (weapons.json rules.tierMult; only ours have research). */
export function weaponDamage(sim: Sim, v: Villager, w: Pick<WeaponDef, 'id' | 'damage'>): number {
  if (v.team !== 'player') return w.damage;
  const tier = soldierTier(sim.researched, w.id);
  return tier > 1 ? w.damage * ((RULES.tierMult as Record<string, { damage: number }>)[String(tier)]?.damage ?? 1) : w.damage;
}

/** What the research of the tool in hand adds to a stat of that tool (percent), for the tool a job uses: only ours, and only while the tool is not broken. */
export function toolBonus(sim: Sim, v: Villager, job: WorkJob, stat: LineStat): number {
  const kind = TOOL_OF_JOB[job], tool = kind ? v.tools[kind] : null;
  return v.team === 'player' && kind && tool && tool.dur > 0 ? statBonus(sim.researched, kind, stat) : 0;
}

/** What the research of a weapon adds to a stat of that weapon (its percent, or for crit its points of percent): only ours have any. Whoever holds the weapon gets it. */
export const weaponBonus = (sim: Sim, v: Villager, w: Pick<WeaponDef, 'id'>, stat: LineStat): number => (v.team === 'player' ? statBonus(sim.researched, w.id, stat) : 0);

/**
 * Seconds between two blows of a person: the weapon's cycle and the agility factor, shortened by the research Tốc độ đánh of that weapon.
 * A village that went short is slower to strike by 1 / (1 − the penalty); its lost speed of walking already lowers agility, so agility is read as it was before.
 */
export const swingCycle = (sim: Sim, v: Villager, w: Pick<WeaponDef, 'id' | 'cycle'>): number => {
  const p = v.team === 'player' ? sim.foodPenalty : 0;
  const agi = p > 0 ? ((L.speedBase + L.speedPerAgi * v.stats.agi) / (1 - p) - L.speedBase) / L.speedPerAgi : v.stats.agi;
  return cycleOf(w.cycle, agi) / (1 + weaponBonus(sim, v, w, 'aspd') / 100) / (1 - p);
};

/** Chance that a blow or shot of this weapon is critical: the weapon's own plus the points of research Tỉ lệ chí mạng of that weapon, never above RULES.critMax. */
export const critChance = (sim: Sim, v: Villager, w: Pick<WeaponDef, 'id' | 'crit'>): number => Math.min((w.crit ?? 0) + weaponBonus(sim, v, w, 'crit') / 100, RULES.critMax);

/** What a critical blow adds to a normal one (0.25 = it does 125% of a normal blow), raised by the research Sát thương chí mạng. */
export const critMult = (sim: Sim, v: Villager, w: Pick<WeaponDef, 'id' | 'critDamage'>): number => (w.critDamage ?? RULES.critDamage) + weaponBonus(sim, v, w, 'critd') / 100;
