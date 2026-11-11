/** Heads-up for the player: what is coming or going on in the village, worked out afresh from the state of the game (nothing here is saved). */
import { dayInSeason, SEASON_DAYS, seasonOf } from './calendar';
import { BUILDINGS } from './buildings';
import { ANIMALS } from './combat';
import { FOOD, RES_LIST, RES_NAME } from './resources';
import type { Notice } from './model';
import { armyRoom, eventNeed } from './readiness';
import { fireLevel } from './construction';
import type { Sim } from './sim';

const ORDER = { urgent: 0, warn: 1, info: 2 } as const;
const pct = (x: number): string => `${Math.round(x * 1000) / 10}%`;
const days = (n: number): string => (n <= 0 ? 'hôm nay' : `còn ${n} ngày`);
const FARM = { building: 'farmhouse', label: 'Nông trại' };
const CAMP = { building: 'infantry', label: BUILDINGS.infantry.name };

/** The notices of the moment, the most pressing first. */
export function noticesOf(sim: Sim): Notice[] {
  const out: Notice[] = [];
  // a war decided: the result stays until the army is pulled out (won) or for a day (lost)
  const done = sim.plans.find((p) => p.kind === 'attack' && p.result && (p.stage === 'over' || sim.time - p.endedAt < sim.dayLen));
  if (done) {
    const name = sim.tribes.find((t) => t.id === done.tribe)?.def.name ?? 'địch', over = done.stage === 'over' && done.status === 'running';
    out.push({
      id: 'war-result', level: done.result === 'won' ? 'info' : 'urgent', icon: done.result === 'won' ? '🏆' : '☠', title: done.result === 'won' ? `Thắng trận: ${name}` : `Thua trận: ${name}`,
      when: over ? 'chờ lệnh rút quân' : 'vừa xong', body: over ? 'Quân ta đang đứng tại chỗ. Làng vẫn đóng băng cho tới khi quân về.' : 'Trận đánh đã kết thúc.',
      tip: over ? 'Bấm Rút quân để cả đội về làng; chiến tranh chỉ kết thúc khi quân về tới nơi.' : 'Có thể sửa kế hoạch và đánh lại.',
      command: over ? { kind: 'withdraw', label: 'Rút quân' } : undefined,
    });
  }
  // a boss village has fallen: the new age is announced for a few days (the same words as the log line, which fades)
  const fallen = sim.tribes.find((t) => t.bossDown && t.bossDownAt !== undefined && sim.time - t.bossDownAt < 3 * sim.dayLen);
  if (fallen && !sim.tribes.some((t) => t.boss && !t.bossDown)) {
    out.push({
      id: 'era-bronze', level: 'info', icon: '🏺', title: 'Chuyển thời kỳ: Thời đại Đồ đồng', when: 'vừa bắt đầu',
      body: `${fallen.def.name} đã sụp đổ. Bí quyết đồng giờ đã nằm trong tay làng ta.`,
      tip: 'Bạn đã hạ được một làng đầu lĩnh: đã có thể nâng Nhà chung lên Nhà chính để bước sang thời Trung cổ (khi mọi nhà đã đạt cấp 3). Các làng còn lại cũng sẽ mạnh dần theo.',
    });
  }
  // the village is under attack: who hides, who may go out
  const why = sim.attackReason();
  if (why) {
    const hiding = sim.villagers.filter((v) => sim.hides(v)).length;
    out.push({
      id: 'under-attack', level: 'urgent', icon: 'stat_atk', title: 'Làng đang bị tấn công', when: 'ngay bây giờ',
      body: `${why}${hiding ? ` · ${hiding} dân đang trốn trong nhà` : ''}`,
      tip: 'Khi làng bị tấn công, dân thường không ngủ và không hồi sức được, và ai đang ở trong nhà sẽ không ra ngoài kể cả khi trời sáng. Chỉ lính và thợ săn ra ngoài: giao nghề lính ở trại chiến binh, hoặc thợ săn ở Chòi thợ săn, để họ ra chiến đấu.',
      action: CAMP,
    });
  }
  // villagers sent out by hand (free, on the night shift) who are running low: they must come back, and will of themselves when too weak to go on
  const fireAt = sim.campfire(), fx = fireAt ? fireAt.x + 1 : sim.world.start.x, fy = fireAt ? fireAt.y + 1 : sim.world.start.y;
  const far = sim.villagers.filter((v) => v.job === 'idle' && v.shift === 'both' && v.inside === null && v.energy < 40 && v.phase !== 'sleep' && v.phase !== 'goHome' && Math.hypot(v.x - fx, v.y - fy) > 20);
  if (far.length) {
    const low = Math.min(...far.map((v) => v.energy));
    out.push({
      id: 'explorers-tired', level: low < 25 ? 'urgent' : 'warn', icon: 'stat_sta', title: 'Dân đi xa đã cạn sức', when: 'cần quay về',
      body: `${far.slice(0, 3).map((v) => `${v.name} (${Math.round(v.energy)}%)`).join(', ')}${far.length > 3 ? ` và ${far.length - 3} người nữa` : ''} · cách làng hơn 20 ô`,
      tip: 'Dân được bạn sai đi khám phá làm cả ngày lẫn đêm. Khi sức xuống dưới 20% họ tự quay về làng nghỉ, nhưng đường xa thì rất lâu: hãy ra lệnh cho họ về sớm.',
      action: { building: 'campfire', label: 'Về làng' },
    });
  }
  // people who work day and night, or carry a lot of tiredness: they lose strength for good if it goes on
  const overworked = sim.villagers.filter((v) => v.team === 'player' && v.down <= 0 && v.job !== 'idle' && v.job !== 'fight' && v.job !== 'scout' && v.job !== 'supply' && (v.shift === 'both' || v.strain >= 10));
  if (overworked.length) {
    const worst = Math.max(...overworked.map((v) => v.strain));
    out.push({
      id: 'overworked', level: worst >= 30 ? 'urgent' : 'warn', icon: 'stat_sta', title: 'Có người làm việc quá sức', when: 'cả ngày lẫn đêm',
      body: `${overworked.slice(0, 3).map((v) => `${v.name} (sức ${Math.round(v.energy)}/${Math.round(sim.maxEnergy(v))})`).join(', ')}${overworked.length > 3 ? ` và ${overworked.length - 3} người nữa` : ''}`,
      tip: 'Làm cả ngày lẫn đêm khiến mệt mỏi tích lũy: sức tối đa giảm và hồi chậm. Mở chi tiết để đổi ca làm (ngày hoặc đêm) hoặc cho họ nghỉ.',
      people: overworked.map((v) => v.id),
    });
  }
  // a full store stops the gatherers: say so and say what to do
  const full = RES_LIST.filter((r) => r !== 'coin' && sim.capacity(r) > 0 && sim.stock[r] >= sim.capacity(r));
  if (full.length) {
    out.push({
      id: 'storage-full', level: 'warn', icon: full[0], title: 'Kho đã đầy', when: 'ngay bây giờ',
      body: `${full.map((r) => RES_NAME[r].toLowerCase()).join(', ')}: dân không thu thêm được nữa`,
      tip: 'Nâng cấp Kho (hoặc nâng Nhà chung) để chứa thêm, hoặc dùng bớt vật liệu vào việc xây dựng và chế tạo.',
      action: { building: 'storage', label: 'Kho' },
    });
  }
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
        tip: 'Bụi quả trụi hết, ruộng chỉ còn một phần tư. Săn bắn, làm ruộng hoặc đổi hàng ở Chợ để có thức ăn.',
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

  // two villages at war, seen by our people (the scouts or anyone who watched)
  for (const c of sim.clashes) {
    const left = sim.time - c.at;
    if (left > 240) continue;
    const na = sim.tribes.find((t) => t.id === c.a)?.def.name ?? 'Một làng', nb = sim.tribes.find((t) => t.id === c.b)?.def.name ?? 'một làng';
    out.push({
      id: `clash:${[c.a, c.b].sort().join('-')}`, level: 'info', icon: 'stat_atk', title: `${na} đang đánh ${nb}`, when: left < 20 ? 'ngay bây giờ' : 'vừa xảy ra',
      body: 'Người của ta thấy hai làng giao chiến', tip: 'Hai làng thù nhau đánh nhau khi gặp. Bên nào yếu đi thì làng kia dễ đánh hơn; đây là lúc cân nhắc đánh bên đã mệt.', action: CAMP,
    });
  }
  out.push(...eventNotices(sim));
  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}

/** How an event is called to the player: the beast it brings, or the tribe that comes. */
export function eventName(sim: Sim, e: Sim['events'][number]): string {
  if (e.kind === 'beasts') return `${e.species ? ANIMALS[e.species].name : 'Sói'} (${e.size} con)`;
  return `${(e.tribe ? sim.tribes.find((t) => t.id === e.tribe)?.def.name : undefined) ?? 'Một bộ tộc'} (${e.size} người)`;
}

/** The attacks that are coming (the events of events.json whose warning has been given) and the ones that are here: what the village needs to meet them. */
function eventNotices(sim: Sim): Notice[] {
  const out: Notice[] = [];
  const soldiers = sim.villagers.filter((v) => v.job === 'fight'), armed = soldiers.filter((v) => !!v.weapon).length;
  const have = `${soldiers.length} lính, ${armed} có vũ khí`;
  for (const e of sim.events) {
    if (e.fired || !e.warned) continue;
    const wolves = e.kind === 'beasts', beast = e.species ? ANIMALS[e.species].name : 'Sói', need = eventNeed(e);
    const tribe = e.tribe ? sim.tribes.find((t) => t.id === e.tribe) : undefined;
    const left = e.fireDay - sim.day, ready = soldiers.length >= need && armed >= Math.ceil(need / 2);
    const room = armyRoom(sim, fireLevel(sim)), cramped = need > room; // the level of the campfire has no room for so many soldiers: it must go up (and the people be raised)
    out.push({
      id: `ev:${e.id}`, level: ready && !cramped ? 'info' : left <= 1 ? 'urgent' : 'warn', icon: 'stat_atk',
      title: wolves ? `${beast} sắp tấn công` : `${tribe?.def.name ?? 'Một bộ tộc'} sắp đánh`, when: left <= 0 ? (e.night ? 'đêm nay' : 'hôm nay') : `còn ${left} ngày`,
      body: (ready ? `Khoảng ${e.size} ${wolves ? 'con' : 'người'} · đã đủ lính (${have})` : `Khoảng ${e.size} ${wolves ? 'con' : 'người'} · cần ≥${need} lính, đang có ${have}`) + (cramped ? ` · Nhà chung chỉ chứa ~${room} lính` : ''),
      tip: `${e.warn || 'Một cuộc tấn công đang tới.'} ${cramped ? `Cấp Nhà chung hiện tại chỉ có chỗ cho ~${room} lính, ít hơn ${need}: cần nâng Nhà chung (và dựng thêm nhà dân, nghiên cứu chỉ số quân sự) để đủ sức. ` : ''}Tuyển thêm lính ở trại chiến binh, chế vũ khí và giáp cho họ, và dựng hàng rào, chòi canh trước khi chúng tới.`,
      action: cramped ? { building: 'campfire', label: 'Nhà chung' } : CAMP,
    });
  }
  // the attacks that are here now
  const fire = sim.campfire(), cx = fire ? fire.x + 1 : sim.world.start.x, cy = fire ? fire.y + 1 : sim.world.start.y;
  const pack = sim.animals.filter((a) => (a.species === 'wolf' || a.raid) && a.state !== 'dead' && Math.hypot(a.x - cx, a.y - cy) < 30).length;
  if (pack) {
    out.push({
      id: 'wolves-here', level: soldiers.length < 3 ? 'urgent' : 'warn', icon: 'stat_atk', title: 'Thú dữ đang ở gần làng', when: 'ngay bây giờ',
      body: `${pack} con · ${have}${soldiers.length < 3 ? ' · cần thêm lính' : ''}`,
      tip: 'Thú dữ không sợ lửa và tấn công dân. Cần có lính cầm vũ khí để đánh đuổi; dân thường sẽ chạy về lửa trại.', action: CAMP,
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
