// Does the food of the village keep up with its mouths? For a campfire level (3 and 4) the farm and the hunting lodge are filled to their places, the workers hold a
// stone hoe and the research of the trades is done, and a whole year goes by: the food that comes in each day is set against what the village at its fullest eats.
// The rules the balance holds to, with the places of the food houses filled and NO research (RESEARCH=1 adds all of it, TOOL=1 for a wooden hoe):
//   1. spring, summer and autumn each bring in at least 2 x what the village eats: never a shortage, and a surplus;
//   2. winter may bring in less, but the surplus of the other three seasons, put by, covers what winter lacks;
//   3. the store for food (its capacity) holds that reserve, so that a full store is the surplus, not a lack of room.
// Run: bundle this file for node with esbuild and run  node foodcheck.cjs <seed> <level>
import { Sim } from '../src/sim/sim';
import { SEASONS, SEASON_DAYS } from '../src/sim/calendar';
import type { BuildingKind } from '../src/sim/buildings';

const seed = +(process.argv[2] ?? 1), L = +(process.argv[3] ?? 3), SOLDIER_SHARE = 0.4, RESEARCH = process.env.RESEARCH === '1', TIER = process.env.TOOL === '1' ? 1 : 2;
const sim = new Sim(seed);
sim.events.length = 0; sim.nextRaid = 1e9;
sim.dev.instantBuild = true; sim.dev.god = true; // nobody dies (no soldiers here to keep the wolves off): only the food is measured
for (const k of Object.keys(sim.stock) as Array<keyof typeof sim.stock>) sim.stock[k] = 5000;
const fire = sim.campfire()!; fire.level = L;
const spots = (k: BuildingKind): [number, number] | null => {
  const cx = Math.floor(fire.x + 1), cy = Math.floor(fire.y + 1);
  for (let r = 4; r <= 24; r++) for (let dx = -r; dx <= r; dx++) for (const dy of Math.abs(dx) === r ? Array.from({ length: 2 * r + 1 }, (_, i) => i - r) : [-r, r]) if (sim.canPlace(k, cx + dx, cy + dy) === null) return [cx + dx, cy + dy];
  return null;
};
const put = (k: BuildingKind): void => { const s = spots(k); if (!s) throw new Error('no room for ' + k); const r = sim.placeBuilding(k, s[0], s[1]); if (!r.ok) throw new Error(k + ': ' + (r as { reason: string }).reason); const b = sim.buildings[sim.buildings.length - 1]; b.level = Math.min(L, 4); b.done = true; };
for (let i = 0; i < sim.buildingLimit('house'); i++) put('house'); // the beds: the village at its fullest
for (let i = 0; i < sim.buildingLimit('storage'); i++) put('storage');
for (let i = 0; i < sim.buildingLimit('farmhouse'); i++) put('farmhouse');
for (let i = 0; i < sim.buildingLimit('huntlodge'); i++) put('huntlodge');
for (const b of sim.buildings) b.level = Math.min(b.kind === 'campfire' ? L : L, 4);
// the research of the trades, all of it
if (RESEARCH) for (const role of ['food', 'hunt', 'hoe']) for (const stat of ['gyield', 'tspd', 'tyield']) for (let n = 1; n <= 5; n++) sim.researched.add(`${role}_${stat}_${n}`);
// the land the village has been over is known (new bushes and trees only grow where it is: world.depleted): a good way round the fire
{ const N = sim.world.size, R = 40, cx = Math.floor(fire.x), cy = Math.floor(fire.y); for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) if (Math.hypot(x - cx, y - cy) <= R && sim.fog.state[y * N + x] === 0) sim.fog.state[y * N + x] = 1; sim.world.ensure(cx, cy, R + 4); }
// workers: every place of the two houses
const places = (kind: BuildingKind): number => sim.buildings.filter((b) => b.kind === kind).reduce((n, b) => n + (b.level >= 1 ? ({ farmhouse: [3, 5, 5, 5], huntlodge: [2, 3, 4, 5] } as Record<string, number[]>)[kind][Math.min(b.level, 4) - 1] : 0), 0);
const want = { food: places('farmhouse'), hunt: places('huntlodge') };
const crew: number[] = [];
for (let i = 0; i < want.food + want.hunt; i++) {
  const v = sim.makeVillager(fire.x + 2 + (i % 5), fire.y + 6 + Math.floor(i / 5), i % 2 ? 'f' : 'm', 'player', sim.frnd);
  v.tools.hoe = { dur: 1e9, tier: TIER } as never;
  sim.villagers.push(v); sim.registerUnit(v); crew.push(v.id);
}
sim.assignRole(crew.slice(0, want.food), 'food'); sim.assignRole(crew.slice(want.food), 'hunt');
// the mouths: the village at its fullest, a share of them soldiers
const pop = sim.popCap(), soldiers = Math.round(pop * SOLDIER_SHARE);
const level = L;
const ration = (s: boolean) => (s ? [2, 3, 3, 4] : [1, 2, 2, 3])[level - 1];
const need = soldiers * ration(true) + (pop - soldiers) * ration(false);

// a year, day by day, counting the food that comes in (nobody eats here: only the gathering is measured)
const bySeason: Record<string, number[]> = {}, gathered: Record<string, number[]> = {}, hunted: Record<string, number[]> = {};
sim.stock.food = 0; sim.foodPot = 0;
let prev = 0, inc = 0, lastDay = sim.day, daySeason = sim.season;
for (let i = 0; sim.day <= 1 + 4 * SEASON_DAYS; i++) {
  sim.tick(0.05);
  const tot = sim.stock.food + sim.foodPot; if (tot > prev) inc += tot - prev; prev = tot;
  if (sim.day !== lastDay) { (bySeason[daySeason] ??= []).push(inc); (gathered[daySeason] ??= []).push(sim.yieldPrev['food'] ?? 0); (hunted[daySeason] ??= []).push(sim.yieldPrev['hunt.food'] ?? 0); inc = 0; lastDay = sim.day; daySeason = sim.season; sim.stock.food = 0; sim.foodPot = 0; prev = 0; /* the village ate it all: the store has room again */ }
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const rows = SEASONS.map((s) => ({ season: s, perDay: Math.round(avg(bySeason[s] ?? [])), gather: Math.round(avg(gathered[s] ?? [])), hunt: Math.round(avg(hunted[s] ?? [])) }));
const SEASON_LEN = SEASON_DAYS, spring = rows[0].perDay, summer = rows[1].perDay, autumn = rows[2].perDay, winter = rows[3].perDay;
const surplus = SEASON_LEN * ((spring - need) + (summer - need) + (autumn - need)), winterLack = Math.max(0, SEASON_LEN * (need - winter));
const capacity = sim.capacity('food');
const rule1 = Math.min(spring, summer, autumn) >= 2 * need, rule2 = surplus >= winterLack, rule3 = capacity >= winterLack;
console.log(JSON.stringify({ seed, level: L, research: RESEARCH, tool: TIER, pop, soldiers, workers: want, need, perSeason: rows.map((r) => r.perDay), minOpenSeasonRatio: +(Math.min(spring, summer, autumn) / need).toFixed(2), winterRatio: +(winter / need).toFixed(2), reserveNeeded: Math.round(winterLack), surplusPutBy: Math.round(surplus), foodCapacity: capacity, rules: [rule1, rule2, rule3], ok: rule1 && rule2 && rule3 }));
