import type { Sim } from '../sim/sim';
import type { SaveMeta, SaveStore } from './store';

/** The one slot older versions of the game kept: it stays in the list like any other. */
export const AUTO_SAVE = 'auto';

/** A fresh slot name: every game the player starts keeps its own, so one machine holds as many games as the player likes. */
export const newSlotId = (): string => `g${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/**
 * Looks after saving for one running game: a save at the start of every game day (unless the player turned that off), saves on request, and picking a game up again.
 * The game runs in one slot of the store; a save made "as new" starts another slot. It knows the Sim and a SaveStore and nothing about the screen.
 */
export class Session {
  private lastDay: number;
  private busy = false;
  /** The slot this game saves into. A new game gets a slot of its own; a game picked up again keeps the slot it came from. */
  slot = newSlotId();
  /** The name the player gave the slot, if any. */
  name: string | undefined;
  /** Save by itself at the start of every day and when the page is left. The player's choice (the settings). */
  auto = true;
  /** Called with a message when a save fails, so the player is told once. */
  onError: (message: string) => void = () => {};

  constructor(private readonly sim: Sim, private readonly store: SaveStore) { this.lastDay = sim.day; }

  /** Call every frame (or often): saves when a new day has begun. */
  tick(): void {
    if (this.sim.day === this.lastDay) return;
    this.lastDay = this.sim.day;
    if (this.auto) void this.save();
  }

  /** Save now into the slot of this game. Two saves never overlap: one asked for while another is running is skipped. */
  async save(): Promise<boolean> {
    if (this.busy || this.sim.atWar()) return false; // no save in the middle of a war: the player saves before and after it
    this.busy = true;
    try {
      const sim = this.sim;
      await this.store.save(this.slot, sim.toSave(), { savedAt: Date.now(), day: sim.day, population: sim.villagers.length, ...(this.name ? { name: this.name } : {}) });
      return true;
    } catch (e) {
      this.onError(`Không lưu được: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally { this.busy = false; }
  }

  /** Save into a slot of its own, which is the game's slot from now on: the old slot keeps what it had. */
  async saveAsNew(name?: string): Promise<boolean> {
    const was = { slot: this.slot, name: this.name };
    this.slot = newSlotId(); this.name = name?.trim() || undefined;
    const ok = await this.save();
    if (!ok) { this.slot = was.slot; this.name = was.name; }
    return ok;
  }

  /** Every save, the newest first. */
  async list(): Promise<SaveMeta[]> {
    try { return await this.store.list(); } catch { return []; }
  }

  /** The newest save, if any. */
  async latest(): Promise<SaveMeta | null> { return (await this.list())[0] ?? null; }

  /** Put a save into this game, which then goes on saving into the same slot. Returns false when there is none; the save must be of this world. */
  async resume(id: string): Promise<boolean> {
    if (this.sim.atWar()) return false;
    const data = await this.store.load(id);
    if (!data) return false;
    const meta = (await this.list()).find((m) => m.id === id);
    this.sim.loadSave(data);
    this.slot = id; this.name = meta?.name;
    this.lastDay = this.sim.day;
    return true;
  }

  /**
   * Go on from a save of the list. A save of this world is put in at once ('loaded'); one of another world needs the page again with that world, which is
   * what happens ('reload': the page continues from the save when it has come up).
   */
  async open(meta: SaveMeta): Promise<'loaded' | 'reload' | 'failed'> {
    if (meta.seed !== this.sim.seed) { location.assign(`${location.pathname}?seed=${meta.seed}&continue=${encodeURIComponent(meta.id)}`); return 'reload'; }
    return (await this.resume(meta.id)) ? 'loaded' : 'failed';
  }

  /** Begin another game: the page again with a world of its own. Every save stays where it is. */
  newGame(): void { location.assign(`${location.pathname}?new=1`); }

  async remove(id: string): Promise<void> { await this.store.remove(id); }
  async forget(id = AUTO_SAVE): Promise<void> { await this.remove(id); }
}
