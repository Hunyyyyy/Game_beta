/**
 * Can the village meet what is coming? The events of events.json (wolves, bears, raids) are weighed against the soldiers it has now and the soldiers
 * its campfire level has room for, so the player is told to raise the campfire (and research) when the level cannot field enough, and warned when
 * raising it now would eat the wood and the builders' time that an attack on the way needs.
 */
import cfg from '../content/difficulty.json';
import { POP_BY_FIRE } from './buildings';
import type { Sim } from './sim';

export interface Threat { id: string; name: string; left: number; night: boolean; size: number; need: number }

/** How many armed soldiers it takes to meet an event: three at least, else a share of what comes. */
export const eventNeed = (e: { kind: 'beasts' | 'raid'; size: number }): number => Math.max(3, Math.ceil(e.size * (e.kind === 'beasts' ? 0.6 : 0.7)));

/** How many soldiers a village of this campfire level has room for: the people it holds, the army's share of them (difficulty.json "militaryShare"). */
export const armyRoom = (sim: Sim, level: number): number => Math.floor((POP_BY_FIRE[Math.min(POP_BY_FIRE.length, Math.max(1, level)) - 1] + sim.bedsIn('house') + sim.popBonus) * cfg.militaryShare);

/** The events still to come within `days` days, the nearest first. `name` says how an event is called to the player. */
export function threatsAhead(sim: Sim, days: number, name: (e: Sim['events'][number]) => string): Threat[] {
  return sim.events.filter((e) => !e.fired && e.fireDay - sim.day <= days)
    .map((e) => ({ id: e.id, name: name(e), left: Math.max(0, e.fireDay - sim.day), night: e.night, size: e.size, need: eventNeed(e) }))
    .sort((a, b) => a.left - b.left);
}

/** What to tell the player before the campfire goes up a level: `bad` lines are warnings, the others are good news. */
export function upgradeAdvice(sim: Sim, level: number, name: (e: Sim['events'][number]) => string): Array<{ text: string; bad: boolean }> {
  const out: Array<{ text: string; bad: boolean }> = [];
  const ahead = threatsAhead(sim, 12, name);
  if (!ahead.length) return out;
  const soldiers = sim.villagers.filter((v) => v.job === 'fight'), armed = soldiers.filter((v) => !!v.weapon).length;
  const now = armyRoom(sim, level), next = armyRoom(sim, level + 1);
  const soon = ahead[0], worst = ahead.reduce((a, b) => (b.need > a.need ? b : a));
  const when = (t: Threat) => (t.left <= 0 ? (t.night ? 'đêm nay' : 'hôm nay') : `còn ${t.left} ngày`);
  const unready = soldiers.length < soon.need || armed < Math.ceil(soon.need / 2);
  // an attack is close and the army is not there: the upgrade takes wood and builder time that arms are needed for
  if (soon.left <= 4 && unready) {
    out.push({ text: `${soon.name} (${when(soon)}) cần ≥${soon.need} lính, đang có ${soldiers.length} lính, ${armed} có vũ khí. Nâng cấp tốn gỗ và công thợ xây: nên tuyển lính và chế vũ khí, giáp trước.`, bad: true });
  }
  // the level cannot field what the biggest event needs
  if (worst.need > now) {
    if (worst.need <= next) out.push({ text: `${worst.name} (${when(worst)}) cần ≥${worst.need} lính nhưng cấp hiện tại chỉ chứa ~${now} lính: cần nâng cấp lên (chứa ~${next}) rồi tuyển lính.`, bad: false });
    else out.push({ text: `${worst.name} (${when(worst)}) cần ≥${worst.need} lính: cấp ${level + 1} chỉ chứa ~${next} lính, vẫn chưa đủ. Cần thêm nhà dân (giường) và nghiên cứu chỉ số quân sự để mỗi lính mạnh hơn.`, bad: true });
  } else if (!unready) {
    out.push({ text: `Đã đủ sức đón ${soon.name} (${when(soon)}): cần ≥${soon.need} lính, đang có ${soldiers.length}.`, bad: false });
  }
  return out;
}
