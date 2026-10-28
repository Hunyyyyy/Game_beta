import type { Sim } from '../sim/sim';
import type { SaveMeta, SaveStore } from './store';

/** The one save the game keeps by itself. */
export const AUTO_SAVE = 'auto';

/**
 * Looks after saving for one running game: a save at the start of every game day, saves on request, and picking a game up again.
 * It knows the Sim and a SaveStore and nothing about the screen.
 */
export class Session {
  private lastDay: number;
  private busy = false;
  /** Called with a message when a save fails, so the player is told once. */
  onError: (message: string) => void = () => {};

  constructor(private readonly sim: Sim, private readonly store: SaveStore) { this.lastDay = sim.day; }

  /** Call every frame (or often): saves when a new day has begun. */
  tick(): void {
    if (this.sim.day === this.lastDay) return;
    this.lastDay = this.sim.day;
    void this.save();
  }

  /** Save now. Two saves never overlap: one asked for while another is running is skipped. */
  async save(id = AUTO_SAVE): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      const sim = this.sim;
      await this.store.save(id, sim.toSave(), { savedAt: Date.now(), day: sim.day, population: sim.villagers.length });
      return true;
    } catch (e) {
      this.onError(`Không lưu được: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally { this.busy = false; }
  }

  /** The newest save, if any. */
  async latest(): Promise<SaveMeta | null> {
    try { return (await this.store.list())[0] ?? null; } catch { return null; }
  }

  /** Put a save into this game. Returns false when there is none; the save must be of this world. */
  async resume(id: string): Promise<boolean> {
    const data = await this.store.load(id);
    if (!data) return false;
    this.sim.loadSave(data);
    this.lastDay = this.sim.day;
    return true;
  }

  async forget(id = AUTO_SAVE): Promise<void> { await this.store.remove(id); }
}
