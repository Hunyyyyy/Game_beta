/** The clock and the light: days, seasons, weather, and what the villagers can see. */
import { isRestTime, rollWeather, seasonOf, SEASON_DEF, WEATHER } from './calendar';
import { FIRE_VISION, NIGHT_VISION, VISION } from './constants';
import { BUILDINGS } from './buildings';
import { armOf } from './battle';
import type { Sim } from './sim';
import { Villager } from './model';

/** New day: roll weather, maybe change season; at noon foretell tomorrow; track rest hours. */
export function tickCalendar(sim: Sim): void {
  const day = sim.day;
  if (day !== sim.lastDay) {
    sim.lastDay = day;
    sim.weather = sim.nextWeather;
    sim.nextWeather = rollWeather(seasonOf(day + 1), sim.wrnd());
    sim.signalled = false;
    const season = seasonOf(day);
    if (season !== sim.world.season) { sim.world.setSeason(season); sim.say(SEASON_DEF[season].enter); }
    if (sim.weather !== 'clear') sim.say(`Hôm nay: ${WEATHER[sim.weather].name.toLowerCase()}.`);
    sim.eatDay(); // the day that has just ended is paid for before anyone new walks in
    if (day > 1 && !sim.dev.noArrivals) newcomers(sim);
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

/** Each new day 1 to 3 strangers walk in and settle by the fire. */
function newcomers(sim: Sim): void {
  const n = 1 + Math.floor(sim.frnd() * 3), fire = sim.campfire(), s = sim.world.start;
  for (let i = 0; i < n; i++) {
    const a = sim.frnd() * Math.PI * 2, r = 2 + sim.frnd() * 2;
    const gx = Math.floor((fire ? fire.x + 1 : s.x) + Math.cos(a) * r), gy = Math.floor((fire ? fire.y + 3 : s.y) + Math.sin(a) * r), spot = sim.nearestFree(gx, gy, new Set()) ?? [gx, gy];
    const v = sim.makeVillager(spot[0], spot[1], sim.frnd() < 0.5 ? 'm' : 'f', 'player', sim.frnd);
    sim.villagers.push(v); sim.registerUnit(v);
    sim.say(`${v.name} đến làng xin ở lại.`);
  }
}

// ---------------------------------------------------------------- vòng lặp
/** How far a villager with a lit torch sees at night (tiles). */
export const TORCH_VISION = 6;

export function refreshFog(sim: Sim): void {
  const r = visionRadius(sim), fire = fireRadius(sim);
  sim.lastVision = r;
  const src = sim.villagers.map((v) => ({ x: v.x, y: v.y, r: v.lit ? Math.max(r, TORCH_VISION) : r })); // a lit torch sees as far as by day
  for (const b of sim.buildings) if (b.done) { const d = BUILDINGS[b.kind]; src.push({ x: b.x + d.w / 2, y: b.y + d.h / 2, r: b.kind === 'campfire' ? fire : r }); }
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
  return (v.torch || v.lit ? Math.max(r, TORCH_VISION) : r) + (armOf(v) === 'archer' ? ARCHER_SIGHT : 0);
}
/** How many tiles further an archer looks than a man on foot. */
export const ARCHER_SIGHT = 1;
export function fireRadius(sim: Sim): number { return Math.max(1, FIRE_VISION - WEATHER[sim.weather].vision); }
