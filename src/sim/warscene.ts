import type { Sim } from './sim';
import { sightOf } from './environment';
import soundsJson from '../data/sounds.json';

/** The squads of the running attack plan, for the music: where their soldiers stand (tiles). */
export interface WarState {
  squads: Array<{ id: number; pts: Array<{ x: number; y: number }> }>;
  /** At least `war.engageShare` of our soldiers see an enemy (a man or a work) for the first time: one sting each. Wherever the camera is. */
  stings: number;
}

/**
 * For the sound. Reads the war and keeps `warSeenIds` / `warStings` up to date (they only move with the game clock, so calling it
 * more than once a tick changes nothing). Empty in peace. The UI decides which squads are close enough to the camera to be heard.
 */
export function warScene(sim: Sim): WarState {
  const plan = sim.plans.find((p) => p.kind === 'attack' && p.status === 'running');
  if (!plan || plan.result) return { squads: [], stings: 0 }; // decided (won, the army stands waiting to be pulled out): the war music is over
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
    const works = sim.tribes.filter((t) => !plan.tribe || t.id === plan.tribe).flatMap((t) => t.props.filter((q) => q.hp > 0));
    // a soldier sees the enemy: a soldier or a work of the enemy village within his sight
    // each soldier counts once, the first time he sees the enemy (a man or a work of the enemy village within his sight); every `engageShare` of the army that sees it for the first time is a sting
    for (const id of army) {
      if (sim.warSeenIds.has(id)) continue;
      const v = sim.get(id); if (!v) continue;
      const r = sightOf(sim, v);
      if (foes.some((f) => Math.hypot(f.x - v.x, f.y - v.y) <= r) || works.some((q) => Math.hypot(q.x + q.w / 2 - v.x, q.y + q.h / 2 - v.y) <= r)) { sim.warSeenIds.add(id); sim.warFresh++; }
    }
    const per = Math.max(1, Math.ceil(army.length * k.engageShare));
    while (sim.warFresh >= per) { sim.warFresh -= per; sim.warStings++; }
  }
  return { squads, stings: sim.warStings };
}
