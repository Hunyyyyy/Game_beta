export const TILE = 32;        // px mỗi ô
export const MAP_SIZE = 960;   // ô mỗi cạnh
export const VISION = 7;       // villager sight radius by day (tiles)
export const NIGHT_VISION = 3; // at night, without fire
export const FIRE_VISION = 8;  // campfire, day and night
export const TICK = 1 / 20;    // bước mô phỏng cố định (giây game)
/** How many searches for a way the soldiers may start in one tick (see Sim.pathLeft). */
export const PATH_BUDGET = 6;
export const DAY_LENGTH = 1200; // 1 ngày game = 20 phút thật: 12 phút ban ngày, 8 phút ban đêm (kể cả hoàng hôn, bình minh)
export const START_TIME = DAY_LENGTH * 0.25; // vào game lúc sáng sớm

/** Game seconds as days for the player: "0,13 ngày", "2,5 ngày", "12 ngày". Players never see seconds. */
export const gameDays = (secs: number): string => {
  const d = secs / DAY_LENGTH;
  return `${d.toLocaleString('vi', { maximumFractionDigits: d < 1 ? 2 : d < 10 ? 1 : 0 })} ngày`;
};

/**
 * Work takes "work seconds". A day of labour is WORK_DAY of them, so a task that took one old 4-minute day still takes one day now,
 * however many real minutes a day lasts. `work` is how many work seconds pass per game second; tests may set it to 1.
 */
export const WORK_DAY = 240;
export const PACE = { work: WORK_DAY / DAY_LENGTH };
/** Work seconds (build, craft and research times) as days: "1 ngày", "0,25 ngày". */
export const workDays = (workSecs: number): string => gameDays(workSecs / PACE.work);
