/**
 * The player's settings. They belong to the person and the device, not to a game, so they are kept apart from saves and
 * survive a new game. Add a field here (with a default) and it is remembered.
 */
export interface Settings {
  /** Game speed the player last chose (1, 2 or 4). */
  speed: number;
  /** The player chose to play upright on a phone and not be asked to turn it. */
  skipRotatePrompt: boolean;
}

export const DEFAULT_SETTINGS: Settings = { speed: 1, skipRotatePrompt: false };
const KEY = 'lang-do-da.settings';

export function loadSettings(storage: Pick<Storage, 'getItem'> | null = browserStorage()): Settings {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const o = JSON.parse(raw) as Partial<Settings>;
    return {
      speed: [1, 2, 4].includes(o.speed as number) ? (o.speed as number) : DEFAULT_SETTINGS.speed,
      skipRotatePrompt: o.skipRotatePrompt === true,
    };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'> | null = browserStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify(settings)); } catch { /* private window or storage blocked: the settings just are not remembered */ }
}

function browserStorage(): Storage | null { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }
