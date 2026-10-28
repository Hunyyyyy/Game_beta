import type { GameSave } from '../sim/save';
import type { SaveMeta, SaveStore } from './store';

const DB = 'lang-do-da', STORE = 'saves';

/** Saves in the browser's IndexedDB: works on phones and computers, and on a static host such as GitHub Pages. */
export class IndexedDbStore implements SaveStore {
  static available(): boolean { try { return typeof indexedDB !== 'undefined' && !!indexedDB; } catch { return false; } }

  private db: Promise<IDBDatabase> | null = null;
  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  }
  private async run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode), req = f(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async list(): Promise<SaveMeta[]> {
    const all = await this.run('readonly', (s) => s.getAll() as IDBRequest<Array<{ meta: SaveMeta }>>);
    return all.map((r) => r.meta).sort((a, b) => b.savedAt - a.savedAt);
  }
  async load(id: string): Promise<GameSave | null> {
    const row = await this.run('readonly', (s) => s.get(id) as IDBRequest<{ data: GameSave } | undefined>);
    return row?.data ?? null;
  }
  async save(id: string, data: GameSave, meta: Omit<SaveMeta, 'id' | 'version' | 'seed'>): Promise<void> {
    await this.run('readwrite', (s) => s.put({ meta: { ...meta, id, version: data.version, seed: data.seed }, data }, id));
  }
  async remove(id: string): Promise<void> { await this.run('readwrite', (s) => s.delete(id)); }
}
