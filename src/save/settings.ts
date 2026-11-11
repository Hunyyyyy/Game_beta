/**
 * The player's settings. They belong to the person and the device, not to a game, so they are kept apart from saves and
 * survive a new game. Add a field here (with a default) and it is remembered.
 */
export interface Settings {
  /** Game speed the player last chose (1, 2 or 4). */
  speed: number;
  /** The player chose to play upright on a phone and not be asked to turn it. */
  skipRotatePrompt: boolean;
  /** Sound of work and fighting (effects) on or off. */
  sfxOn: boolean;
  /** Weather sound (rain, storm: the ambience) on or off. */
  ambientOn: boolean;
  /** War music on or off. */
  musicOn: boolean;
  /** The weather drawn on the map (rain, snow, lightning) on or off. */
  weatherFx: boolean;
  /** Volume of each kind of sound, 0 to 1. */
  sfxVol: number; ambientVol: number; musicVol: number;
  /** The voices of people (the shouts that answer an order, the cheering of a victory): on or off, and how loud, 0 to 1. */
  voiceOn: boolean; voiceVol: number;
  /** The game saves by itself at the start of every day and when the page is left. */
  autosave: boolean;
  /** How much the screen draws: a level, or "auto" (by the device). */
  quality: 'auto' | 'high' | 'balanced' | 'saver';
}

export const DEFAULT_SETTINGS: Settings = { speed: 1, skipRotatePrompt: false, sfxOn: true, ambientOn: true, musicOn: true, weatherFx: true, sfxVol: 1, ambientVol: 1, musicVol: 1, voiceOn: true, voiceVol: 1, autosave: true, quality: 'auto' };
const KEY = 'lang-do-da.settings';

const vol = (n: unknown): number => (typeof n === 'number' && n >= 0 && n <= 1 ? n : 1);

export function loadSettings(storage: Pick<Storage, 'getItem'> | null = browserStorage()): Settings {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const o = JSON.parse(raw) as Partial<Settings>;
    return {
      speed: [1, 2, 4].includes(o.speed as number) ? (o.speed as number) : DEFAULT_SETTINGS.speed,
      skipRotatePrompt: o.skipRotatePrompt === true,
      sfxOn: o.sfxOn !== false,
      ambientOn: o.ambientOn !== false,
      musicOn: o.musicOn !== false,
      weatherFx: o.weatherFx !== false,
      sfxVol: vol(o.sfxVol), ambientVol: vol(o.ambientVol), musicVol: vol(o.musicVol),
      voiceOn: o.voiceOn !== false, voiceVol: vol(o.voiceVol),
      autosave: o.autosave !== false,
      quality: (['auto', 'high', 'balanced', 'saver'] as const).includes(o.quality as 'auto') ? (o.quality as Settings['quality']) : 'auto',
    };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'> | null = browserStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify(settings)); } catch { /* private window or storage blocked: the settings just are not remembered */ }
}

function browserStorage(): Storage | null { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }
