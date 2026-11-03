/**
 * Saving and loading a game. The save is plain JSON (numbers, strings, ids, no object references) with a version number, so it does not
 * care where it is kept: IndexedDB, a file, a server, or another engine reading the same format.
 *
 * Terrain is stored whole (run-length packed), not as a difference from the generator, so a later change to the map generator cannot
 * change what an old save looks like.
 *
 * Settings (speed, sound, orientation lock) are not part of a game and live in src/save/settings.ts.
 */
import { CURRENCY, emptyStock, RES_NAME } from './resources';
import { SIEGE, TRIBES } from './combat';
import { BUILDINGS, maxHp } from './buildings';
import { SCREEN_QUESTS } from './progression';
import { decode, encode, packRuns, unpackRuns } from './codec';
import type { Season } from './calendar';
import type { ResourceNode } from './world';
import type { Sim } from './sim';

export const SAVE_VERSION = 28;

/** Saved state by kind. Every own property of Sim must be named in exactly one list here (the tests check this). */
export const SAVED = {
  /** Single values. */
  scalars: ['era', 'bronze', 'time', 'acc', 'coinFrac', 'sawCoin', 'nextRaid', 'nextAid', 'nextVid', 'nextBid', 'nextSquad', 'nextMission', 'nextPlan', 'alarmUntil', 'tribeClock', 'foodPot', 'foodPenalty', 'popBonus', 'conquered', 'foodIncome', 'foodSeen', 'lastFullWarn', 'lastMatWarn', 'weather', 'nextWeather', 'lastDay', 'signalled', 'resting', 'lastVision', 'pendingTribe', 'fogDirty'],
  /** Objects whose keys are filled in place. */
  records: ['stock', 'toolStock', 'battle', 'yieldNow', 'yieldPrev', 'ruins', 'drafts'],
  /** Lists of plain data. */
  lists: ['warLog', 'scoutLosses', 'wornTools', 'craftQueue', 'craftPaid', 'tameQueue', 'researchQueue', 'log', 'foodDays', 'villagers', 'buildings', 'foes', 'events', 'animals', 'projectiles', 'squads', 'maps', 'scouts', 'sightings', 'plans', 'battleReports'],
  /** Handled by hand below. */
  special: ['researched', 'questSeen', 'tribes', 'world', 'fog', 'rnd', 'frnd', 'wrnd'],
} as const satisfies Record<string, readonly (keyof Sim)[]>;

/** Properties of Sim that are not part of a saved game, and why. */
export const NOT_SAVED: readonly (keyof Sim)[] = [
  'seed',        // goes in the header: it decides which Sim is built
  'speed',       // a setting
  'dev',         // test switches
  'byId', 'animalById', // rebuilt after loading
  'threatCache', 'pathLeft', // rebuilt every tick
  'view', // where the camera is: the screen's, not the game's
  'warIds', 'march', 'warMeals', 'warHunger', 'warFocus', 'warHarassAt', // the march of a war: the game cannot be saved while one is on
  'warSince', 'hiddenAnimals', // the game cannot be saved while a war is on
  'advanced', // the era of the war layer: the game's setting (data/war.json), changed only from the dev menu
  'leaderClock', // a timer: leaders are picked again within a second of loading
  'controlled', // what the player has selected: the screen's, not the game's
  'dangerAt', // a timer: after loading the villagers come out of hiding at once
];

type Row = Array<number | string>;
export interface GameSave {
  version: number;
  seed: number;
  scalars: Record<string, unknown>;
  records: Record<string, unknown>;
  lists: Record<string, unknown>;
  researched: string[];
  /** Quests done; absent in a save from before quests were kept. */
  quests?: string[];
  tribes: unknown[];
  rng: { rnd: number; frnd: number; wrnd: number };
  world: { season: Season; tiles: number[]; occ: number[]; decor: number[]; ready: number[]; nodes: Row[] };
  fog: { state: number[]; version: number };
}

export function toSave(sim: Sim): GameSave {
  const w = sim.world;
  const pick = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, encode((sim as unknown as Record<string, unknown>)[k])]));
  return {
    version: SAVE_VERSION,
    seed: sim.seed,
    scalars: pick(SAVED.scalars),
    records: pick(SAVED.records),
    lists: pick(SAVED.lists),
    researched: [...sim.researched],
    quests: [...sim.questSeen],
    tribes: sim.tribes.map(({ def: _def, ...t }) => encode(t)),
    rng: { rnd: sim.rnd.getState(), frnd: sim.frnd.getState(), wrnd: sim.wrnd.getState() },
    world: {
      season: w.season,
      tiles: packRuns(w.tiles), occ: packRuns(w.occ), decor: packRuns(w.decor), ready: packRuns(w.ready),
      nodes: [...w.nodes].map(([i, n]) => [i, n.kind, n.res, n.amount, n.max, n.workers, n.sides, n.regrow]),
    },
    fog: { state: packRuns(sim.fog.state), version: sim.fog.version },
  };
}

/** Old saves are brought forward one version at a time. To change the format: bump SAVE_VERSION and add `MIGRATIONS[oldVersion]`. */
export const MIGRATIONS: Record<number, (data: any) => any> = { // eslint-disable-line @typescript-eslint/no-explicit-any
  // 18 -> 19: the world is made a chunk at a time and cut down in trees, lakes and beasts: a world made all at once cannot be rebuilt
  18: () => { throw new Error('this save is of a world made the old way and can no longer be opened'); },
  // 17 -> 18: the map grew from 192 to 960 tiles a side and every world starts somewhere else: a world of the old size cannot be rebuilt
  17: () => { throw new Error('this save is of the old, smaller map and can no longer be opened'); },
  // 1 -> 2: villagers gained energy, strain, a shift and a torch; the torch blueprint became a known technology
  1: (d) => {
    for (const list of [d.lists.villagers, d.lists.foes] as Array<Array<Record<string, unknown>>>) {
      for (const v of list) { v.energy ??= 100; v.strain ??= 0; v.shift ??= 'day'; v.torch ??= null; v.lockUntil ??= 0; v.lit ??= false; }
    }
    if (!d.researched.includes('torch1')) d.researched.push('torch1');
    return { ...d, version: 2 };
  },
  // 2 -> 3: a gatherer can be posted to a Ruộng
  2: (d) => {
    for (const list of [d.lists.villagers, d.lists.foes] as Array<Array<Record<string, unknown>>>) for (const v of list) v.post ??= -1;
    return { ...d, version: 3 };
  },
  // 3 -> 4: buildings gained strength (defence works) and an open/shut state (gates)
  3: (d) => {
    for (const b of d.lists.buildings as Array<Record<string, unknown>>) { b.hp ??= 0; b.open ??= true; }
    return { ...d, version: 4 };
  },
  // 4 -> 5: weapons and armour wear out
  4: (d) => {
    for (const list of [d.lists.villagers, d.lists.foes] as Array<Array<Record<string, unknown>>>) for (const v of list) { v.gear ??= { w: null, wd: 0, wb: false, a: null, ad: 0, ab: false }; v.squad ??= -1; }
    // squads, maps, plans and the fight log start empty
    for (const k of ['squads', 'maps', 'scouts', 'plans', 'battleReports']) d.lists[k] ??= [];
    d.scalars.nextSquad ??= 1; d.scalars.nextMission ??= 1; d.scalars.nextPlan ??= 1; d.scalars.alarmUntil ??= 0;
    d.records.battle ??= { on: false, since: 0, quiet: 0, ourDead: 0, foeDead: 0, breaches: 0, shots: 0, notes: [] };
    return { ...d, version: 5 };
  },
  // 5 -> 6: a mission carries the row, the arrow and the way back drawn on the enemy map (older missions go for their objective)
  5: (d) => {
    for (const p of d.lists.plans as Array<{ missions: Array<Record<string, unknown>> }>) for (const m of p.missions) { m.line ??= null; m.path ??= []; m.retreat ??= []; m.leg ??= 0; }
    return { ...d, version: 6 };
  },
  // 6 -> 7: a squad is placed on the enemy map by a point and a heading, not by a row between two points
  6: (d) => {
    for (const p of d.lists.plans as Array<{ missions: Array<Record<string, unknown>> }>) for (const m of p.missions) {
      const l = m.line as { a: { x: number; y: number }; b: { x: number; y: number } } | null | undefined;
      m.deploy ??= l ? { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2, heading: Math.atan2(l.b.y - l.a.y, l.b.x - l.a.x) - Math.PI / 2 } : null;
      delete m.line;
    }
    return { ...d, version: 7 };
  },
  // 7 -> 8: a squad is placed as the cells drawn for it, not by a point and a heading (a squad placed the old way is simply not placed)
  7: (d) => {
    for (const p of d.lists.plans as Array<{ missions: Array<Record<string, unknown>> }>) for (const m of p.missions) {
      const dep = m.deploy as { cells?: unknown } | null | undefined;
      if (!dep || !Array.isArray(dep.cells)) m.deploy = null;
    }
    return { ...d, version: 8 };
  },
  // 8 -> 9: villages are found before they are scouted; a village we already hold a map of counts as found
  8: (d) => {
    const maps = d.lists.maps as Array<{ tribe: string }>;
    d.lists.sightings ??= [...new Set(maps.map((m) => m.tribe))].map((tribe) => ({ tribe, by: -1, at: 0, reported: true }));
    return { ...d, version: 9 };
  },
  // 9 -> 10: roles belong to their houses. The Lều chiến binh becomes the Trại chiến binh; a soldier's arm is kept on him (a thrower if he carried a sling or a bow)
  9: (d) => {
    for (const b of d.lists.buildings as Array<{ kind: string }>) if (b.kind === 'barracks') b.kind = 'infantry';
    for (const list of [d.lists.villagers, d.lists.foes] as Array<Array<Record<string, unknown>>>) for (const v of list) v.arm ??= v.job === 'fight' && (v.weapon === 'sling' || v.weapon === 'bow') ? 'archer' : 'foot';
    return { ...d, version: 10 };
  },
  // 10 -> 11: a running attack is in one stage of its deployment (one that was already running is simply fighting)
  10: (d) => {
    for (const p of d.lists.plans as Array<Record<string, unknown>>) p.stage ??= 'fight';
    return { ...d, version: 11 };
  },
  // 11 -> 12: every house has strength and can be attacked; the works of an enemy village have strength too; a plan keeps its clearing crews and how it ended,
  // an arrow may point at a target and a squad may be halted by something in its way; a soldier may be hacking something down
  11: (d) => {
    for (const b of d.lists.buildings as Array<{ kind: string; level: number; era: string; hp?: number }>) b.hp ||= maxHp(b as never);
    for (const p of d.lists.plans as Array<{ clears?: unknown; result?: unknown; endedAt?: unknown; supply?: unknown; carryDays?: unknown; supplyIds?: unknown; tents?: unknown; stats?: unknown; missions: Array<Record<string, unknown>> }>) {
      p.clears ??= []; p.result ??= ''; p.endedAt ??= 0; p.supply ??= 0; p.carryDays ??= 3; p.supplyIds ??= []; p.tents ??= []; p.stats ??= null;
      for (const m of p.missions) { m.target ??= null; m.block ??= null; }
    }
    for (const list of [d.lists.villagers, d.lists.foes] as Array<Array<Record<string, unknown>>>) for (const v of list) v.breaks ??= null;
    for (const t of d.tribes as Array<{ props: Array<{ kind: string; hp?: number }> }>) for (const p of t.props) p.hp ??= SIEGE.propHp[p.kind] ?? 60;
    return { ...d, version: 12 };
  },
};

MIGRATIONS[12] = (d) => {
  // 12 -> 13: stats may have a fraction after training; every body remembers the stats it was born with and may be away at training
  for (const list of [d.lists.villagers, d.lists.foes] as Array<Array<Record<string, unknown>>>) for (const v of list) { v.born ??= { ...(v.stats as object) }; v.train ??= null; }
  return { ...d, version: 13 };
};

MIGRATIONS[13] = (d) => {
  // 13 -> 14: beasts to ride: the stable's queue, the beast a villager rides, and the skill and potential for taming
  d.lists.tameQueue ??= [];
  for (const list of [d.lists.villagers, d.lists.foes] as Array<Array<Record<string, unknown>>>) for (const v of list) {
    v.mount ??= null;
    const sk = v.skill as Record<string, unknown>, pot = v.potential as Record<string, number>, st = v.stats as Record<string, number>;
    sk.tame ??= { xp: 0, level: 0 }; pot.tame ??= st.agi >= 9 ? 3 : st.agi >= 6 ? 2 : 1;
  }
  return { ...d, version: 14 };
};

MIGRATIONS[14] = (d) => {
  // 14 -> 15: no hunger in a villager; the village eats at the end of each day (the pot of the campfire, and the weakness of a short meal)
  d.scalars.popBonus ??= 0; d.scalars.foodPot ??= 0; d.scalars.foodPenalty ??= 0;
  return { ...d, version: 15 };
};

MIGRATIONS[15] = (d) => {
  // 15 -> 16: the village keeps what it earns in food a day, to warn the player (none known yet)
  d.scalars.foodIncome ??= 0; d.scalars.foodSeen ??= -1; d.lists.foodDays ??= [];
  return { ...d, version: 16 };
};

MIGRATIONS[23] = (d) => {
  // 23 -> 24: what the Nhà chế tạo asks for grows with its level, and each order remembers what it was paid at (the orders of before were paid at the base cost)
  d.lists.craftPaid = (d.lists.craftQueue as unknown[]).map(() => 1);
  return { ...d, version: 24 };
};

MIGRATIONS[22] = (d) => {
  // 22 -> 23: crafting orders are paid when they are queued; those queued in an older game were never paid for, so they are dropped
  d.lists.craftQueue = [];
  return { ...d, version: 23 };
};

MIGRATIONS[21] = (d) => {
  // 21 -> 22: soldiers of the Trại lính gác have a post (nobody is a guard yet)
  for (const list of [d.lists.villagers, d.lists.foes] as Array<Array<Record<string, unknown>>>) for (const v of list) { v.guard ??= false; v.guardAt ??= null; }
  return { ...d, version: 22 };
};

MIGRATIONS[20] = (d) => {
  // 20 -> 21: a map drawn only in part is kept, so that other scouts go on from there (none yet)
  d.records.drafts ??= {};
  return { ...d, version: 21 };
};

MIGRATIONS[19] = (d) => {
  // 19 -> 20: the village remembers the level of the houses that fell, to rebuild them at that level (none fell yet)
  d.records.ruins ??= {};
  return { ...d, version: 20 };
};

MIGRATIONS[16] = (d) => {
  // 16 -> 17: the houses of the gatherers show what was brought in today and yesterday (none counted yet)
  d.records.yieldNow ??= {}; d.records.yieldPrev ??= {};
  return { ...d, version: 17 };
};

export function migrate(raw: unknown): GameSave {
  let d = raw as { version?: unknown };
  if (!d || typeof d !== 'object' || typeof d.version !== 'number') throw new Error('this is not a saved game');
  if (d.version > SAVE_VERSION) throw new Error(`this game was saved by a newer version (${d.version}); this one reads up to ${SAVE_VERSION}`);
  while ((d.version as number) < SAVE_VERSION) {
    const step = MIGRATIONS[d.version as number];
    if (!step) throw new Error(`no way to read saved games of version ${d.version}`);
    d = step(d);
  }
  return d as GameSave;
}

/** Put a save into a Sim that was built with the same seed. Everything that was in the Sim is replaced. */
export function applySave(sim: Sim, data: GameSave): void {
  if (data.seed !== sim.seed) throw new Error(`the save is of world ${data.seed}, this game is world ${sim.seed}`);
  const w = sim.world, target = sim as unknown as Record<string, unknown>;
  unpackRuns(data.world.tiles, w.tiles); unpackRuns(data.world.occ, w.occ); unpackRuns(data.world.decor, w.decor); unpackRuns(data.world.ready, w.ready); w.decor.fill(0); // stumps of earlier saves are gone too
  w.nodes.clear();
  for (const [i, kind, res, amount, max, workers, sides, regrow] of data.world.nodes as Array<[number, ResourceNode['kind'], ResourceNode['res'], number, number, number, number, number]>) {
    w.nodes.set(i, { kind, res, amount, max, workers, sides, regrow });
  }
  w.season = data.world.season; // not setSeason(): the bushes are already as they were
  unpackRuns(data.fog.state, sim.fog.state); sim.fog.relight(); sim.fog.version = data.fog.version;

  for (const k of SAVED.scalars) target[k] = decode(data.scalars[k]);
  for (const k of SAVED.records) { const rec = target[k] as Record<string, unknown>; for (const key of Object.keys(rec)) delete rec[key]; Object.assign(rec, k === 'stock' ? emptyStock() : {}, decode(data.records[k])); } // a save from before a material existed has no entry for it: zero
  for (const k of SAVED.lists) { const list = target[k] as unknown[]; list.length = 0; list.push(...decode<unknown[]>(data.lists[k])); }
  sim.researched.clear(); for (const id of data.researched) sim.researched.add(id);
  sim.questSeen.clear(); for (const id of data.quests ?? SCREEN_QUESTS) sim.questSeen.add(id);
  sim.tribes.length = 0;
  for (const t of data.tribes) { const tribe = decode<Record<string, unknown>>(t); sim.tribes.push({ ...tribe, def: TRIBES[tribe.id as keyof typeof TRIBES] } as unknown as Sim['tribes'][number]); }
  sim.rnd.setState(data.rng.rnd); sim.frnd.setState(data.rng.frnd); sim.wrnd.setState(data.rng.wrnd);

  // what is derived is rebuilt, not saved
  sim.world.gates.clear(); for (const b of sim.buildings) if (b.kind === 'gate' && !b.open) { const d = BUILDINGS.gate; for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) sim.world.gates.add((b.y + j) * sim.world.size + b.x + i); }
  sim.byId.clear(); for (const v of sim.villagers) sim.byId.set(v.id, v); for (const f of sim.foes) sim.byId.set(f.id, f);
  sim.animalById.clear(); for (const a of sim.animals) sim.animalById.set(a.id, a);
  RES_NAME.coin = CURRENCY[sim.era];
}

MIGRATIONS[24] = (d) => {
  // 24 -> 25: the war: a plan knows when it ended, the supply soldiers and the days of food it takes, its tents and its counts; the village keeps the log of its wars
  d.lists.warLog ??= [];
  for (const p of d.lists.plans as Array<Record<string, unknown>>) { p.endedAt ??= 0; p.supply ??= 0; p.carryDays ??= 3; p.supplyIds ??= []; p.tents ??= []; p.stats ??= null; }
  return { ...d, version: 25 };
};

MIGRATIONS[25] = (d) => {
  // 25 -> 26: the village remembers how its scouts died
  d.lists.scoutLosses ??= [];
  return { ...d, version: 26 };
};

MIGRATIONS[26] = (d) => {
  // 26 -> 27: the age of bronze (opened when a boss village falls) is not yet
  d.scalars.bronze ??= false;
  return { ...d, version: 27 };

MIGRATIONS[27] = (d) => {
  // 27 -> 28: the villages we took add places to the camps of soldiers; saves of before count none
  d.scalars.conquered ??= 0;
  return { ...d, version: 28 };
};
};
