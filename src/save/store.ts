import type { GameSave } from '../sim/save';

/** What the list of saves shows without opening each one. */
export interface SaveMeta {
  id: string;
  /** Wall-clock time of the save (ms since 1970). */
  savedAt: number;
  day: number;
  population: number;
  seed: number;
  version: number;
}

/**
 * Where saved games are kept. The game knows only this interface; a browser database, a file, a server or a Unity bridge each plug in
 * as one adapter. Everything is async so a slow place (a network) needs no change in the callers.
 */
export interface SaveStore {
  list(): Promise<SaveMeta[]>;
  load(id: string): Promise<GameSave | null>;
  save(id: string, data: GameSave, meta: Omit<SaveMeta, 'id' | 'version' | 'seed'>): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Keeps saves in memory: for tests, and as the fallback when the browser offers no storage. */
export class MemoryStore implements SaveStore {
  private readonly saves = new Map<string, { meta: SaveMeta; json: string }>();
  async list(): Promise<SaveMeta[]> { return [...this.saves.values()].map((s) => s.meta).sort((a, b) => b.savedAt - a.savedAt); }
  async load(id: string): Promise<GameSave | null> { const s = this.saves.get(id); return s ? (JSON.parse(s.json) as GameSave) : null; }
  async save(id: string, data: GameSave, meta: Omit<SaveMeta, 'id' | 'version' | 'seed'>): Promise<void> {
    this.saves.set(id, { meta: { ...meta, id, version: data.version, seed: data.seed }, json: JSON.stringify(data) });
  }
  async remove(id: string): Promise<void> { this.saves.delete(id); }
}
