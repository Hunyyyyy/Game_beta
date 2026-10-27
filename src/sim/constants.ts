export const TILE = 32;        // px mỗi ô
export const MAP_SIZE = 192;   // ô mỗi cạnh
export const VISION = 7;       // villager sight radius by day (tiles)
export const NIGHT_VISION = 3; // at night, without fire
export const FIRE_VISION = 8;  // campfire, day and night
export const TICK = 1 / 20;    // bước mô phỏng cố định (giây game)
export const DAY_LENGTH = 240; // 1 ngày game = 4 phút
export const START_TIME = DAY_LENGTH * 0.25; // vào game lúc sáng sớm

/** Game seconds as days for the player: "0,13 ngày", "2,5 ngày", "12 ngày". Players never see seconds. */
export const gameDays = (secs: number): string => {
  const d = secs / DAY_LENGTH;
  return `${d.toLocaleString('vi', { maximumFractionDigits: d < 1 ? 2 : d < 10 ? 1 : 0 })} ngày`;
};
