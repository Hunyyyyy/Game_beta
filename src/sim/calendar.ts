import seasonsJson from '../data/seasons.json';
import weatherJson from '../data/weather.json';
import { DAY_LENGTH } from './constants';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_DAYS = 5;
export const YEAR_DAYS = SEASON_DAYS * SEASONS.length;

export interface SeasonDef {
  name: string;
  /** Fraction of the day in full daylight (excluding dawn and dusk): 0.6 = 12 of 20 minutes. */
  daylight: number;
  /** Gathering productivity multiplier. */
  gather: number;
  /** Same for working a field: the soil gives a little even in winter. */
  farm: number;
  /** How fast outdoor work goes in this season (winter cold slows it). */
  work: number;
  enter: string;
}
export const SEASON_DEF = seasonsJson as Record<Season, SeasonDef>;

export type WeatherKind = 'clear' | 'mist' | 'drizzle' | 'rain' | 'thunder' | 'storm' | 'snow';
export interface WeatherDef {
  name: string;
  /** Sight tiles subtracted. */
  vision: number;
  /** Walking speed multiplier. */
  speed: number;
  /** How fast outdoor work goes in this weather. */
  work: number;
  /** Archers shoot with this share of their strength (rain wets the strings, wind spoils the aim). */
  bow: number;
  /** Warning shown half a day ahead (empty for none). */
  signal: string;
}
export const WEATHER = weatherJson.types as Record<WeatherKind, WeatherDef>;
const CHANCE = weatherJson.chance as Record<Season, Partial<Record<WeatherKind, number>>>;

export type DayPart = 'dawn' | 'day' | 'dusk' | 'night';
export const DAY_PART_NAME: Record<DayPart, string> = { dawn: 'bình minh', day: 'ban ngày', dusk: 'hoàng hôn', night: 'đêm' };
/** Dawn and dusk each last 0.05 day (1 min of a 20-minute day). Daylight is 0.6 of the day (12 min), the rest is night (8 min). */
export const TWILIGHT = 0.05;

/** Day number (1, 2, …) at `time` (game seconds). */
export const dayOf = (time: number) => Math.floor(time / DAY_LENGTH) + 1;
export const seasonOf = (day: number): Season => SEASONS[Math.floor((day - 1) / SEASON_DAYS) % SEASONS.length];
/** Day within the season (1–5). */
export const dayInSeason = (day: number) => ((day - 1) % SEASON_DAYS) + 1;
export const yearOf = (day: number) => Math.floor((day - 1) / YEAR_DAYS) + 1;

/** Sunrise and sunset (0..1 of the day, 0.5 = noon). */
export function sunTimes(season: Season): { rise: number; set: number } {
  const d = SEASON_DEF[season].daylight;
  return { rise: 0.5 - d / 2, set: 0.5 + d / 2 };
}

/** Light 0..1: 1 by day, 0 at night, ramping through dawn and dusk. */
export function lightAt(tod: number, season: Season): number {
  const { rise, set } = sunTimes(season);
  if (tod >= rise && tod <= set) return 1;
  if (tod > set) return Math.max(0, 1 - (tod - set) / TWILIGHT);
  return Math.max(0, 1 - (rise - tod) / TWILIGHT);
}

export function dayPart(tod: number, season: Season): DayPart {
  const { rise, set } = sunTimes(season);
  if (tod >= rise && tod <= set) return 'day';
  if (tod > set && tod < set + TWILIGHT) return 'dusk';
  if (tod < rise && tod > rise - TWILIGHT) return 'dawn';
  return 'night';
}

/** Villagers rest from mid-dusk to mid-dawn, so they work the day plus half of each twilight. */
export function isRestTime(tod: number, season: Season): boolean {
  const { rise, set } = sunTimes(season);
  return tod > set + TWILIGHT / 2 || tod < rise - TWILIGHT / 2;
}

/** Pick weather from the season's odds; `r` is a random number in 0..1. */
export function rollWeather(season: Season, r: number): WeatherKind {
  const table = CHANCE[season];
  let acc = 0, last: WeatherKind = 'clear';
  for (const k of Object.keys(table) as WeatherKind[]) {
    acc += table[k] ?? 0; last = k;
    if (r < acc) return k;
  }
  return last;
}
