// The save store, the session that autosaves, and the settings: everything around the save format that does not need a browser.
import { Session, AUTO_SAVE } from '../src/save/session';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/save/settings';
import { MemoryStore } from '../src/save/store';
import { DAY_LENGTH, PACE } from '../src/sim/constants';
import { Sim } from '../src/sim/sim';

PACE.work = 1;
let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (sim: Sim, secs: number) => { for (let i = 0; i < secs * 20; i++) (sim as unknown as { tick(d: number): void }).tick(0.05); };
const later = () => new Promise((r) => setTimeout(r, 10));

async function main() {
  const store = new MemoryStore();
  const sim = new Sim(1337);
  const session = new Session(sim, store);
  ok(await session.latest() === null, 'no save at first');

  session.tick(); await later();
  ok((await store.list()).length === 0, 'nothing is saved in the middle of a day');
  sim.time = DAY_LENGTH * 1.01; session.tick(); await later();
  let list = await store.list();
  ok(list.length === 1 && list[0].id === AUTO_SAVE && list[0].day === 2 && list[0].seed === 1337 && list[0].population === 2, 'a new day saves by itself');
  session.tick(); await later();
  ok((await store.list()).length === 1, 'and only once per day, in the same slot');

  run(sim, 120);
  const before = sim.toSave();
  ok(await session.save(), 'a save on request works');
  const other = new Sim(1337);
  const again = new Session(other, store);
  ok(await again.resume(AUTO_SAVE), 'another game picks the save up');
  ok(JSON.stringify(other.toSave().scalars) === JSON.stringify(before.scalars) && other.time === sim.time && other.villagers.length === sim.villagers.length, 'and is where the first one was');

  // a slow store must not get two saves at once
  let running = 0, most = 0;
  const slow = { ...store, list: store.list.bind(store), load: store.load.bind(store), remove: store.remove.bind(store), save: async (...a: Parameters<MemoryStore['save']>) => { running++; most = Math.max(most, running); await later(); await store.save(...a); running--; } };
  const s2 = new Session(sim, slow);
  await Promise.all([s2.save(), s2.save(), s2.save()]);
  ok(most === 1, 'saves never overlap');

  // a store that breaks is reported once and the game goes on
  const broken = { list: async () => { throw new Error('no disk'); }, load: async () => null, save: async () => { throw new Error('disk full'); }, remove: async () => {} };
  const s3 = new Session(sim, broken); const errors: string[] = []; s3.onError = (m) => errors.push(m);
  ok(await s3.save() === false && errors.length === 1 && errors[0].includes('disk full'), 'a failed save is reported, not thrown');
  ok(await s3.latest() === null, 'and a store that cannot list looks empty');
  await session.forget(); ok((await store.list()).length === 0, 'a save can be forgotten');

  // settings are kept apart from the game
  const mem = new Map<string, string>();
  const fake = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  ok(JSON.stringify(loadSettings(fake)) === JSON.stringify(DEFAULT_SETTINGS), 'settings start with their defaults');
  saveSettings({ speed: 4, skipRotatePrompt: true }, fake);
  ok(loadSettings(fake).speed === 4 && loadSettings(fake).skipRotatePrompt === true, 'settings are remembered');
  mem.set('lang-do-da.settings', '{"speed":99,"skipRotatePrompt":"yes"}');
  ok(loadSettings(fake).speed === 1 && loadSettings(fake).skipRotatePrompt === false, 'nonsense in the settings is ignored');
  mem.set('lang-do-da.settings', 'not json');
  ok(loadSettings(fake).speed === 1, 'and so is a broken settings file');
  ok(!('speed' in sim.toSave().scalars) && !JSON.stringify(sim.toSave()).includes('skipRotatePrompt'), 'settings are not in the saved game');

  console.log(fails ? `${fails} failed` : 'all passed');
  process.exit(fails ? 1 : 0);
}
main();
