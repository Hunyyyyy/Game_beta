/** Names of people: put together from the syllables of a "voice" (data/names.json), so a village never runs out and never repeats. Pure data and rules: no Sim, no state. */
import NAMES from '../data/names.json';

type Sex = 'm' | 'f';

/** The voice of a team: our own people have the first, every tribe takes one of the others by its id, so the names of a village sound alike and differ from the next one. */
export function voiceOf(team: string): number {
  if (team === 'player') return 0;
  let h = 0;
  for (const ch of team) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 1 + (h % (NAMES.voices.length - 1));
}

/** One new name that is not in `taken` (after a few tries a syllable is added, so it always ends). `rnd` is the stream of the simulation, never an RNG of our own. */
export function makeName(sex: Sex, voice: number, rnd: () => number, taken: ReadonlySet<string>): string {
  const v = NAMES.voices[voice % NAMES.voices.length];
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
  const build = (syllables: number): string => {
    let s = '';
    for (let i = 0; i < syllables; i++) {
      const last = i === syllables - 1;
      s += pick(v.onset) + (last && sex === 'f' ? pick(NAMES.endF) : pick(v.vowel));
      if (last && sex === 'm' && rnd() < NAMES.codaChance) s += pick(v.coda);
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  for (let tries = 0; tries < 12; tries++) {
    const name = build(rnd() < NAMES.threeChance ? 3 : 2);
    if (name.length <= NAMES.maxLen && !taken.has(name)) return name; // short ones only: they have to fit a row of a list
  }
  for (let n = 2; ; n++) { const name = build(n); if (!taken.has(name)) return name; }
}
