import timeJson from '../data/time.json';
export const TILE = 32;        // px mỗi ô
export const MAP_SIZE = 960;   // ô mỗi cạnh
export const VISION = 7;       // villager sight radius by day (tiles)
export const NIGHT_VISION = 3; // at night, without fire
export const FIRE_VISION = 8;  // campfire, day and night
export const TICK = 1 / 20;    // bước mô phỏng cố định (giây game)
/** How many searches for a way the soldiers may start in one tick (see Sim.pathLeft). */
export const PATH_BUDGET = 6;
/** The least game time between two workings out of the fog of war (seconds). */
export const FOG_PAUSE = 0.25;
/** Searches for a way each tick while fast-forwarded: the ticks come 8 times as often at 8x and 16 times as often at 16x, and so would the searches (the dearest thing a tick does). */
export const PATH_BUDGET_FAST = 2, PATH_BUDGET_FASTEST = 1;
/** What is kept for the people of the villages in a tick, whatever our own soldiers have used: they are worked after ours, and in a big fight they would stand still for want of a way. */
export const FOE_PATH_SHARE = 3;
/** The length of a day of each era in seconds of game (= real seconds at 1x): data/time.json. A day is 65% daylight and 35% night (dusk and dawn included). */
export type EraKey = 'stone' | 'ancient';
export const dayLength = (era: EraKey): number => timeJson.dayLength[era];
export const START_TIME = dayLength('stone') * 0.25; // vào game lúc sáng sớm

/** Game seconds as days for the player: "0,13 ngày", "2,5 ngày", "12 ngày". Players never see seconds. */
export const gameDays = (secs: number, len: number): string => {
  const d = secs / len;
  return `${d.toLocaleString('vi', { maximumFractionDigits: d < 1 ? 2 : d < 10 ? 1 : 0 })} ngày`;
};

/**
 * Work takes "work seconds". A day of labour is WORK_DAY of them, so a task that took one old 4-minute day still takes one day now,
 * however many real minutes a day lasts. `paceWork` is how many work seconds pass per game second in a day of `len` seconds.
 */
export const WORK_DAY = 240;
export const paceWork = (len: number): number => WORK_DAY / len;
/** Work seconds (build, craft and research times) as days: "1 ngày", "0,25 ngày" (the same whatever a day lasts). */
export const workDays = (workSecs: number): string => gameDays(workSecs, WORK_DAY);
