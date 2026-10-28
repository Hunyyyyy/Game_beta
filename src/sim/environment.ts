/** The clock and the light: days, seasons, weather, and what the villagers can see. */
import { isRestTime, rollWeather, seasonOf, SEASON_DEF, WEATHER } from './calendar';
import { FIRE_VISION, NIGHT_VISION, VISION } from './constants';
import { BUILDINGS } from './buildings';
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
  }
  if (!sim.signalled && sim.tod >= 0.5) {
    sim.signalled = true;
    const sig = WEATHER[sim.nextWeather].signal;
    if (sig && sim.nextWeather !== sim.weather) sim.say(sig);
  }
  const rest = isRestTime(sim.tod, sim.season);
  if (sim.resting && !rest) for (const v of sim.villagers) v.nightOwl = false;
  sim.resting = rest;
}

// ---------------------------------------------------------------- vòng lặp
export function refreshFog(sim: Sim): void {
  const r = visionRadius(sim), fire = fireRadius(sim);
  sim.lastVision = r;
  const src = sim.villagers.map((v) => ({ x: v.x, y: v.y, r }));
  for (const b of sim.buildings) if (b.done) { const d = BUILDINGS[b.kind]; src.push({ x: b.x + d.w / 2, y: b.y + d.h / 2, r: b.kind === 'campfire' ? fire : r }); }
  sim.fog.update(src);
  for (const v of sim.villagers) { v.tx = Math.floor(v.x); v.ty = Math.floor(v.y); }
}

/** Villager sight: 7 tiles by day, 3 at night, minus the weather penalty. */
export function visionRadius(sim: Sim): number {
  return Math.max(1, Math.round(NIGHT_VISION + (VISION - NIGHT_VISION) * sim.light) - WEATHER[sim.weather].vision);
}

export function fireRadius(sim: Sim): number { return Math.max(1, FIRE_VISION - WEATHER[sim.weather].vision); }
