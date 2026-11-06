import type { Sim } from './sim';
import { sightOf } from './environment';
import soundsJson from '../data/sounds.json';

/** The squads of the running attack plan, for the music: where their soldiers stand (tiles). */
export interface WarState {
  squads: Array<{ id: number; pts: Array<{ x: number; y: number }> }>;
  /** At least `war.engageShare` of our soldiers see an enemy and are fighting (stays on `war.engageQuiet` seconds after it dies down). Wherever the camera is. */
  seen: boolean;
}

/**
 * For the sound. Reads the war and keeps `warSeen` up to date (they only move with the game clock, so calling it
 * more than once a tick changes nothing). Empty in peace. The UI decides which squads are close enough to the camera to be heard.
 */
export function warScene(sim: Sim): WarState {
  const plan = sim.plans.find((p) => p.kind === 'attack' && p.status === 'running');
  if (!plan) return { squads: [], seen: false };
  const squads: WarState['squads'] = [], army: number[] = [];
  for (const m of plan.missions) {
    const s = sim.squadById(m.squad), us = s ? sim.squadUnits(s) : [];
    if (!s || !us.length) continue;
    squads.push({ id: s.id, pts: us.map((v) => ({ x: v.x, y: v.y })) });
    for (const v of us) army.push(v.id);
  }
  if (army.length && sim.time - sim.warCheckAt >= 0.5) { // twice a second is enough for a sound
    sim.warCheckAt = sim.time;
    const foes = sim.foes.filter((f) => f.health > 0), k = soundsJson.war;
    const engaged = foes.length === 0 ? 0 : army.filter((id) => { const v = sim.get(id); return !!v && v.phase === 'fight' && foes.some((f) => Math.hypot(f.x - v.x, f.y - v.y) <= sightOf(sim, v)); }).length;
    if (engaged >= Math.max(1, Math.ceil(army.length * k.engageShare))) { sim.warSeen = true; sim.warSeenAt = sim.time; }
    else if (sim.warSeen && sim.time - sim.warSeenAt > k.engageQuiet) sim.warSeen = false; // it died down: the next time it flares up gets the sting again
  }
  return { squads, seen: sim.warSeen };
}
