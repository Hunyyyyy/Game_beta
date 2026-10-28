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
import { TRIBES } from './combat';
import { decode, encode, packRuns, unpackRuns } from './codec';
import type { Season } from './calendar';
import type { ResourceNode } from './world';
import type { Sim } from './sim';

export const SAVE_VERSION = 2;

/** Saved state by kind. Every own property of Sim must be named in exactly one list here (the tests check this). */
export const SAVED = {
  /** Single values. */
  scalars: ['era', 'time', 'acc', 'coinFrac', 'sawCoin', 'nextRaid', 'nextAid', 'nextVid', 'nextBid', 'moraleClock', 'tribeClock', 'lastFullWarn', 'lastMatWarn', 'weather', 'nextWeather', 'lastDay', 'signalled', 'resting', 'lastVision', 'pendingTribe', 'fogDirty'],
  /** Objects whose keys are filled in place. */
  records: ['stock', 'toolStock'],
  /** Lists of plain data. */
  lists: ['wornTools', 'craftQueue', 'researchQueue', 'repairQueue', 'log', 'foodLots', 'villagers', 'buildings', 'foes', 'events', 'animals', 'projectiles'],
  /** Handled by hand below. */
  special: ['researched', 'tribes', 'world', 'fog', 'rnd', 'frnd', 'wrnd'],
} as const satisfies Record<string, readonly (keyof Sim)[]>;

/** Properties of Sim that are not part of a saved game, and why. */
export const NOT_SAVED: readonly (keyof Sim)[] = [
  'seed',        // goes in the header: it decides which Sim is built
  'speed',       // a setting
  'dev',         // test switches
  'byId', 'animalById', // rebuilt after loading
];

type Row = Array<number | string>;
export interface GameSave {
  version: number;
  seed: number;
  scalars: Record<string, unknown>;
  records: Record<string, unknown>;
  lists: Record<string, unknown>;
  researched: string[];
  tribes: unknown[];
  rng: { rnd: number; frnd: number; wrnd: number };
  world: { season: Season; tiles: number[]; occ: number[]; decor: number[]; nodes: Row[] };
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
    tribes: sim.tribes.map(({ def: _def, ...t }) => encode(t)),
    rng: { rnd: sim.rnd.getState(), frnd: sim.frnd.getState(), wrnd: sim.wrnd.getState() },
    world: {
      season: w.season,
      tiles: packRuns(w.tiles), occ: packRuns(w.occ), decor: packRuns(w.decor),
      nodes: [...w.nodes].map(([i, n]) => [i, n.kind, n.res, n.amount, n.max, n.workers, n.sides, n.regrow]),
    },
    fog: { state: packRuns(sim.fog.state), version: sim.fog.version },
  };
}

/** Old saves are brought forward one version at a time. To change the format: bump SAVE_VERSION and add `MIGRATIONS[oldVersion]`. */
export const MIGRATIONS: Record<number, (data: any) => any> = { // eslint-disable-line @typescript-eslint/no-explicit-any
  // 1 -> 2: villagers gained energy, strain, a shift and a torch; the torch blueprint became a known technology
  1: (d) => {
    for (const list of [d.lists.villagers, d.lists.foes] as Array<Array<Record<string, unknown>>>) {
      for (const v of list) { v.energy ??= 100; v.strain ??= 0; v.shift ??= 'day'; v.torch ??= null; v.lockUntil ??= 0; v.lit ??= false; }
    }
    if (!d.researched.includes('torch1')) d.researched.push('torch1');
    return { ...d, version: 2 };
  },
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
  unpackRuns(data.world.tiles, w.tiles); unpackRuns(data.world.occ, w.occ); unpackRuns(data.world.decor, w.decor);
  w.nodes.clear();
  for (const [i, kind, res, amount, max, workers, sides, regrow] of data.world.nodes as Array<[number, ResourceNode['kind'], ResourceNode['res'], number, number, number, number, number]>) {
    w.nodes.set(i, { kind, res, amount, max, workers, sides, regrow });
  }
  w.season = data.world.season; // not setSeason(): the bushes are already as they were
  unpackRuns(data.fog.state, sim.fog.state); sim.fog.version = data.fog.version;

  for (const k of SAVED.scalars) target[k] = decode(data.scalars[k]);
  for (const k of SAVED.records) { const rec = target[k] as Record<string, unknown>; for (const key of Object.keys(rec)) delete rec[key]; Object.assign(rec, k === 'stock' ? emptyStock() : {}, decode(data.records[k])); } // a save from before a material existed has no entry for it: zero
  for (const k of SAVED.lists) { const list = target[k] as unknown[]; list.length = 0; list.push(...decode<unknown[]>(data.lists[k])); }
  sim.researched.clear(); for (const id of data.researched) sim.researched.add(id);
  sim.tribes.length = 0;
  for (const t of data.tribes) { const tribe = decode<Record<string, unknown>>(t); sim.tribes.push({ ...tribe, def: TRIBES[tribe.id as keyof typeof TRIBES] } as unknown as Sim['tribes'][number]); }
  sim.rnd.setState(data.rng.rnd); sim.frnd.setState(data.rng.frnd); sim.wrnd.setState(data.rng.wrnd);

  // what is derived is rebuilt, not saved
  sim.byId.clear(); for (const v of sim.villagers) sim.byId.set(v.id, v); for (const f of sim.foes) sim.byId.set(f.id, f);
  sim.animalById.clear(); for (const a of sim.animals) sim.animalById.set(a.id, a);
  RES_NAME.coin = CURRENCY[sim.era];
}
