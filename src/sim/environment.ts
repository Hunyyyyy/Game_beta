/** The clock and the light: days, seasons, weather, and what the villagers can see. */
import { isRestTime, rollWeather, seasonOf, SEASON_DEF, WEATHER } from './calendar';
import { FIRE_VISION, NIGHT_VISION, VISION } from './constants';
import { BUILDINGS, buildingSight } from './buildings';
import { armOf } from './battle';
import startJson from '../data/start.json';
import weatherJson from '../data/weather.json';
import type { Sim } from './sim';
import { Villager } from './model';

/** New day: roll weather, maybe change season; at noon foretell tomorrow; track rest hours. */
export function tickCalendar(sim: Sim): void {
  const day = sim.day;
  if (day !== sim.lastDay) {
    sim.lastDay = day;
    sim.dayWeather = sim.nextWeather; sim.weather = 'clear'; // the weather of the day comes for a minute or two, at some moment of it
    sim.nextWeather = rollWeather(seasonOf(day + 1), sim.wrnd());
    const dur = weatherJson.duration, dayStart = sim.time - sim.tod * sim.dayLen;
    sim.weatherAt = dayStart + (dur.startFrom + sim.wrnd() * (dur.startTo - dur.startFrom)) * sim.dayLen;
    sim.weatherEnd = sim.weatherAt + dur.min + sim.wrnd() * (dur.max - dur.min);
    sim.signalled = false;
    const season = seasonOf(day);
    if (season !== sim.world.season) { sim.world.setSeason(season); sim.say(SEASON_DEF[season].enter); }
    if (sim.dayWeather !== 'clear') sim.say(`Hôm nay sẽ có ${WEATHER[sim.dayWeather].name.toLowerCase()}.`);
    sim.restockAnimals(); // what hunting took comes back, a herd at a time
    sim.eatDay(); // the day that has just ended is paid for before anyone new walks in
    sim.marketRoll(); // the market draws what it takes today
    if (day >= startJson.arrivals.firstDay && !sim.dev.noArrivals) newcomers(sim);
  }
  if (sim.dayWeather !== 'clear') { // it comes and goes
    if (sim.weather === 'clear' && sim.time >= sim.weatherAt && sim.time < sim.weatherEnd) { sim.weather = sim.dayWeather; sim.say(`Trời bắt đầu ${WEATHER[sim.weather].name.toLowerCase()}.`); }
    else if (sim.weather !== 'clear' && sim.time >= sim.weatherEnd) { sim.say(`${WEATHER[sim.weather].name} đã qua.`); sim.weather = 'clear'; sim.dayWeather = 'clear'; }
  }
  if (!sim.signalled && sim.tod >= 0.5) {
    sim.signalled = true;
    const sig = WEATHER[sim.nextWeather].signal;
    if (sig && sim.nextWeather !== sim.weather) sim.say(sig);
  }
  const rest = isRestTime(sim.tod, sim.season);
  if (sim.resting !== rest) for (const v of sim.villagers) { v.nightOwl = false; if (!rest) sim.returnTorch(v); } // dusk and dawn end every call-up; torches go back at dawn
  sim.resting = rest;
}

/** The player opens or shuts the village to strangers (the campfire's panel): while shut nobody comes. Returns whether it is open now. */
export function toggleNewcomers(sim: Sim): boolean { sim.newcomersOpen = !sim.newcomersOpen; return sim.newcomersOpen; }

/** Each new day a party of strangers comes to the gate to ask to stay (encounters.ts: the player decides there), unless the village is shut to them. The first day is start.json "arrivals" `firstDay`. */
function newcomers(sim: Sim): void {
  if (!sim.newcomersOpen) return;
  sim.dailyArrival();
}

/** `n` people come to live by the fire (as many as the village has room for when `room` is asked); returns their names. */
export function settle(sim: Sim, n: number, room = false): string[] {
  const { femaleChance } = startJson.arrivals, fire = sim.campfire(), s = sim.world.start, names: string[] = [];
  if (room) n = Math.min(n, Math.max(0, sim.popCap() - sim.villagers.length));
  for (let i = 0; i < n; i++) {
    const a = sim.frnd() * Math.PI * 2, r = 2 + sim.frnd() * 2;
    const gx = Math.floor((fire ? fire.x + 1 : s.x) + Math.cos(a) * r), gy = Math.floor((fire ? fire.y + 3 : s.y) + Math.sin(a) * r), spot = sim.nearestFree(gx, gy, new Set()) ?? [gx, gy];
    const v = sim.makeVillager(spot[0], spot[1], sim.frnd() < femaleChance ? 'f' : 'm', 'player', sim.frnd);
    sim.villagers.push(v); sim.registerUnit(v); names.push(v.name);
  }
  return names;
}

// ---------------------------------------------------------------- vòng lặp
/** How far a villager with a lit torch sees at night (tiles). */
export const TORCH_VISION = 6;

export function refreshFog(sim: Sim): void {
  const r = visionRadius(sim), fire = fireRadius(sim);
  sim.lastVision = r;
  const src: { x: number; y: number; r: number }[] = [], litCells = new Set<number>();
  for (const v of sim.villagers) {
    if (v.lit) { const k = Math.floor(v.x / 2) * 65536 + Math.floor(v.y / 2); if (litCells.has(k)) continue; litCells.add(k); } // bearers in the same 2x2 tiles light the fog once
    src.push({ x: v.x, y: v.y, r: v.lit ? Math.max(r, TORCH_VISION) : r }); // a lit torch sees as far as by day
  }
  for (const b of sim.buildings) if (b.done) { const d = BUILDINGS[b.kind]; src.push({ x: b.x + d.w / 2, y: b.y + d.h / 2, r: b.kind === 'campfire' ? fire : Math.max(r, buildingSight(b) - (b.kind === 'tower' ? 0 : WEATHER[sim.weather].vision)) }); } // every house keeps watch round itself, a tower far round
  sim.fog.update(src);
  for (const v of sim.villagers) { v.tx = Math.floor(v.x); v.ty = Math.floor(v.y); }
}

/** Villager sight: 7 tiles by day, 3 at night, minus the weather penalty. */
export function visionRadius(sim: Sim): number {
  return Math.max(1, Math.round(NIGHT_VISION + (VISION - NIGHT_VISION) * sim.light) - WEATHER[sim.weather].vision);
}

/** How far a soldier of ours sees an enemy to go for him: as far as he sees (weather and night cut it, a torch brings it back), an archer a little further. */
export function sightOf(sim: Sim, v: Villager): number {
  const r = visionRadius(sim);
  return (v.torch || v.lit || inTowerLight(sim, v.x, v.y) ? Math.max(r, TORCH_VISION) : r) + (armOf(v) === 'archer' ? ARCHER_SIGHT : 0) + (v.team === 'player' && v.job === 'fight' ? (v.guard ? GUARD_SIGHT : SOLDIER_SIGHT) : 0);
}
/** Is the point within the watch of a chòi canh (its sight grows with its level)? Our soldiers there see an enemy as far as with a torch, whatever the dark. */
export function inTowerLight(sim: Sim, x: number, y: number): boolean {
  for (const b of sim.buildings) {
    if (b.kind !== 'tower' || !b.done) continue;
    const d = BUILDINGS.tower;
    if (Math.hypot(b.x + d.w / 2 - x, b.y + d.h / 2 - y) <= buildingSight(b)) return true;
  }
  return false;
}
/** How many tiles further an archer looks than a man on foot. */
export const ARCHER_SIGHT = 1;
/** Soldiers of the camps see a little further than a villager; the guards of the Trại lính gác five tiles further. */
export const SOLDIER_SIGHT = 2;
export const GUARD_SIGHT = 5;
export function fireRadius(sim: Sim): number { const fire = sim.campfire(); return Math.max(1, (fire ? buildingSight(fire) : FIRE_VISION) - WEATHER[sim.weather].vision); }
