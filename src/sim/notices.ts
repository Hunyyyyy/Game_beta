/** Heads-up for the player: what is coming or going on in the village, worked out afresh from the state of the game (nothing here is saved). */
import { dayInSeason, SEASON_DAYS, seasonOf } from './calendar';
import { BUILDINGS } from './buildings';
import { FOOD } from './resources';
import type { Notice } from './model';
import type { Sim } from './sim';

const ORDER = { urgent: 0, warn: 1, info: 2 } as const;
const pct = (x: number): string => `${Math.round(x * 1000) / 10}%`;
const days = (n: number): string => (n <= 0 ? 'hôm nay' : `còn ${n} ngày`);
const FARM = { building: 'farmhouse', label: 'Nông trại' };
const CAMP = { building: 'infantry', label: BUILDINGS.infantry.name };

/** The notices of the moment, the most pressing first. */
export function noticesOf(sim: Sim): Notice[] {
  const out: Notice[] = [];
  const need = sim.foodNeed();
  if (need <= 0) return out;
  const have = sim.stock.food + sim.foodPot, avg = sim.foodDays.length ? sim.foodDays.reduce((a, b) => a + b, 0) / sim.foodDays.length : null, earn = avg ?? 0;
  const winter = sim.season === 'winter';

  // the weakness a short meal has left
  if (sim.foodPenalty > 0) {
    out.push({
      id: 'weak', level: 'warn', icon: 'food', title: `Làng yếu ${pct(sim.foodPenalty)}`, when: 'tới cuối ngày',
      body: 'Mọi chỉ số giảm vì bữa trước thiếu ăn.',
      tip: 'Máu tối đa không đổi nhưng hồi chậm hơn, đánh chậm hơn. Kiếm đủ thức ăn trước cuối ngày để làng khỏe lại.',
      action: FARM,
    });
  }

  // the meal at the end of today
  const left = 1 - sim.tod, projected = have + earn * left;
  if (projected < need) {
    const short = need - projected;
    out.push({
      id: 'meal', level: have < need ? 'urgent' : 'warn', icon: 'food', title: 'Bữa tối thiếu ăn', when: 'cuối ngày',
      body: `Cần ${need}, có ${Math.floor(have)} · làng sẽ yếu ${pct((FOOD.maxPenalty * short) / need)}`,
      tip: 'Giao thêm người hái lượm ở Nông trại, làm ruộng hoặc đi săn trước khi hết ngày.',
      action: FARM,
    });
  } else if (avg !== null && avg < need && have < need * 3) {
    out.push({
      id: 'income', level: 'warn', icon: 'food', title: 'Kiếm ít hơn ăn', when: 'mỗi ngày',
      body: `Kiếm ~${Math.floor(avg)}/ngày, ăn ${need}/ngày · kho đủ ${Math.floor(have / need)} ngày`,
      tip: 'Thêm người hái lượm hoặc làm ruộng trước khi kho cạn.',
      action: FARM,
    });
  }

  // the winter: the bushes are bare and the fields give a quarter
  const cap = sim.capacity('food') + need; // the store and the pot
  if (winter) {
    const rest = SEASON_DAYS - dayInSeason(sim.day) + 1, want = need * rest;
    if (have < want) {
      out.push({
        id: 'winter', level: 'urgent', icon: '❄', title: 'Đông thiếu ăn', when: `còn ${rest} ngày đông`,
        body: `Cần ${want}, có ${Math.floor(have)}`,
        tip: 'Bụi quả trụi hết, ruộng chỉ còn một phần tư. Săn bắn, làm ruộng hoặc đổi chác để có thức ăn.',
        action: FARM,
      });
    }
  } else {
    let to = 0;
    while (seasonOf(sim.day + to) !== 'winter') to++;
    if (to <= SEASON_DAYS) {
      const want = need * SEASON_DAYS, atStart = Math.min(have + (earn - need) * to, cap);
      if (atStart < want) {
        const roomy = cap >= want;
        out.push({
          id: 'winter', level: to <= 2 ? 'urgent' : 'warn', icon: '❄', title: 'Sắp vào đông', when: days(to),
          body: roomy ? `Cần ${want}, dự kiến có ${Math.max(0, Math.floor(atStart))}` : `Cần ${want} nhưng kho chỉ chứa ${cap}`,
          tip: `Mùa đông ${SEASON_DAYS} ngày, bụi quả trụi hết và ruộng chỉ còn một phần tư. ${roomy ? 'Thêm người hái lượm, làm ruộng hoặc săn bắn để tích thêm.' : 'Xây hoặc nâng cấp Kho để chứa đủ, rồi tích thêm thức ăn.'}`,
          action: roomy ? FARM : { building: 'storage', label: 'Kho' },
        });
      }
    }
  }

  out.push(...eventNotices(sim));
  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}

/** The attacks that are coming (the events of events.json whose warning has been given) and the ones that are here: what the village needs to meet them. */
function eventNotices(sim: Sim): Notice[] {
  const out: Notice[] = [];
  const soldiers = sim.villagers.filter((v) => v.job === 'fight'), armed = soldiers.filter((v) => !!v.weapon).length;
  const have = `${soldiers.length} lính, ${armed} có vũ khí`;
  for (const e of sim.events) {
    if (e.fired || !e.warned) continue;
    const wolves = e.kind === 'wolves', need = Math.max(3, Math.ceil(e.size * (wolves ? 0.6 : 0.7)));
    const tribe = e.tribe ? sim.tribes.find((t) => t.id === e.tribe) : undefined;
    const left = e.fireDay - sim.day, ready = soldiers.length >= need && armed >= Math.ceil(need / 2);
    out.push({
      id: `ev:${e.id}`, level: ready ? 'info' : left <= 1 ? 'urgent' : 'warn', icon: 'stat_atk',
      title: wolves ? 'Sói sắp tấn công' : `${tribe?.def.name ?? 'Một bộ tộc'} sắp đánh`, when: left <= 0 ? (e.night ? 'đêm nay' : 'hôm nay') : `còn ${left} ngày`,
      body: ready ? `Khoảng ${e.size} ${wolves ? 'con' : 'người'} · đã đủ lính (${have})` : `Khoảng ${e.size} ${wolves ? 'con' : 'người'} · cần ≥${need} lính, đang có ${have}`,
      tip: `${e.warn || 'Một cuộc tấn công đang tới.'} Tuyển thêm lính ở trại chiến binh, chế vũ khí và giáp cho họ, và dựng hàng rào, chòi canh trước khi chúng tới.`,
      action: CAMP,
    });
  }
  // the attacks that are here now
  const fire = sim.campfire(), cx = fire ? fire.x + 1 : sim.world.start.x, cy = fire ? fire.y + 1 : sim.world.start.y;
  const pack = sim.animals.filter((a) => a.species === 'wolf' && a.state !== 'dead' && Math.hypot(a.x - cx, a.y - cy) < 30).length;
  if (pack) {
    out.push({
      id: 'wolves-here', level: soldiers.length < 3 ? 'urgent' : 'warn', icon: 'stat_atk', title: 'Sói đang ở gần làng', when: 'ngay bây giờ',
      body: `${pack} con · ${have}${soldiers.length < 3 ? ' · cần thêm lính' : ''}`,
      tip: 'Sói không sợ lửa và tấn công dân. Cần có lính cầm vũ khí để đánh đuổi; dân thường sẽ chạy về lửa trại.', action: CAMP,
    });
  }
  for (const t of sim.tribes) {
    if (!t.raid || t.raid.phase !== 'march') continue;
    out.push({
      id: `raid-here:${t.id}`, level: 'urgent', icon: 'stat_atk', title: `${t.def.name} đang tiến vào làng`, when: 'ngay bây giờ',
      body: `Khoảng ${t.raid.size} người · ${have}`,
      tip: 'Gọi lính ra đón đánh, đóng cổng nếu có hàng rào, và đưa dân thường về lửa trại.', action: CAMP,
    });
  }
  return out;
}
