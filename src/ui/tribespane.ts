import { DIFF } from '../sim/difficulty';
import { relationLabel } from '../sim/combat';
import { RES_NAME } from '../sim/resources';
import { canAdopt, canTribute, giftOf, rewardsOf, spoilsOf, tributeSteps } from '../sim/tribes';
import type { Tribe } from '../sim/tribes';
import { h, hint } from './dom';
import type { Ctx } from './panels';

const PERSONALITY = { peaceful: 'Hòa bình', aggressive: 'Hiếu chiến', ambusher: 'Hay phục kích' } as const;

/** The tribes the village has met: one card for each, with what can be done with them (gifts, tribute, taking them in). A tab of the campfire. */
export class TribesPane {
  readonly root: HTMLElement;
  private updater: () => void = () => undefined;
  constructor(private readonly c: Ctx) { this.root = this.build(); }
  update(): void { this.updater(); }

  private build(): HTMLElement {
    const { sim } = this.c, page = h('div', { class: 'page' });
    const banner = h('div', { class: 'card', hidden: true }); const none = h('p', { class: 'sub', text: 'Chưa gặp bộ tộc nào. Hãy cử người đi khám phá.' });
    const summary = h('p', { class: 'sub' });
    page.append(banner, summary, none);
    // a card for each village that stands: a village taken is gone, and a new era brings new ones, so the cards follow `sim.tribes`
    type Card = { t: Tribe; card: HTMLElement; status: HTMLElement; people: HTMLElement; fill: HTMLElement; note: HTMLElement; rewards: HTMLElement; gift: HTMLButtonElement; tribute: HTMLButtonElement; adopt: HTMLButtonElement; less: HTMLButtonElement; more: HTMLButtonElement };
    const cards = new Map<string, Card>();
    const make = (t: Tribe): Card => {
      const status = h('span'), people = h('div', { class: 'kv' }), fill = h('b'), note = h('p', { class: 'sub' }), rewards = h('p', { class: 'sub' });
      const act = (action: 'gift' | 'tribute' | 'adopt' | 'tributeUp' | 'tributeDown', done?: string) => () => { const e = sim.diplomacy(t.id, action); if (e) this.c.toast(e); else if (done) this.c.toast(done); };
      const gift = h('button', { class: 'sm', text: 'Tặng quà', onclick: act('gift') }) as HTMLButtonElement;
      const tribute = h('button', { class: 'sm', text: 'Cống nạp', onclick: act('tribute', `${t.def.name} chịu cống nạp`) }) as HTMLButtonElement;
      const adopt = h('button', { class: 'sm primary', text: 'Thu nạp', onclick: act('adopt', `${t.def.name} gia nhập làng`) }) as HTMLButtonElement;
      const less = h('button', { class: 'sm', text: '−10%', onclick: act('tributeDown') }) as HTMLButtonElement;
      const more = h('button', { class: 'sm', text: '+10%', onclick: act('tributeUp') }) as HTMLButtonElement;
      const bar = h('div', { class: 'tribe-bar' }, fill, h('u'));
      const card = h('div', { class: 'card', hidden: true }, h('div', { class: 'cardhead' }, h('b', { text: t.def.name }), h('span', { text: PERSONALITY[t.def.personality] }), status), bar, people,
        h('p', { class: 'sub', text: `Phần thưởng: ${t.def.reward}` }), rewards, note, h('div', { class: 'btns' }, gift, tribute, adopt, less, more));
      page.append(card);
      return { t, card, status, people, fill, note, rewards, gift, tribute, adopt, less, more };
    };
    this.updater = () => {
      const N = sim.world.size; let any = false;
      for (const [id, c] of cards) if (!sim.tribes.includes(c.t)) { c.card.remove(); cards.delete(id); }
      for (const t of sim.tribes) if (!cards.has(t.id)) cards.set(t.id, make(t));
      for (const c of cards.values()) {
        const { t } = c, seen = sim.tribeSeen(t);
        c.card.hidden = !seen; if (!seen) continue; any = true;
        const rel = t.state === 'tribute' ? Math.max(60, t.relation) : t.relation;
        c.status.textContent = (t.rebel ? 'Thủ lĩnh phản bội · ' : '') + (t.state === 'free' ? relationLabel(rel) + (sim.tribeHostile(t.id) ? ' · đang thù địch' : '') : { surrendered: 'Đã xin hàng', tribute: 'Đang cống nạp', destroyed: 'Đã bị xóa sổ' }[t.state]);
        c.fill.style.left = rel >= 0 ? '50%' : `${50 + rel / 2}%`; c.fill.style.width = `${Math.abs(rel) / 2}%`;
        const alive = t.unitIds.map((u) => sim.get(u)).filter(Boolean);
        c.people.innerHTML = t.state === 'destroyed' ? '' : `Người <b>${alive.length}</b> · lính <b>${alive.filter((u) => u!.ai?.role !== 'civ').length}</b> · quan hệ <b>${Math.round(rel)}</b>${t.raid ? ' · <b>đang tập kích!</b>' : ''}`;
        if (t.bandit) { // a camp of bandits: nothing to give or ask, only the bag for whoever wipes it out; it changes its strength every few days
          const strength = ({ normal: 'yếu', medium: 'vừa', raider: 'mạnh' } as Record<string, string>)[t.tier] ?? t.tier, bag = (Object.entries(spoilsOf(t, sim.era)) as Array<[keyof typeof RES_NAME, number]>).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${n} ${RES_NAME[k].toLowerCase()}`).join(' · '), left = Math.max(0, Math.ceil((t.rerollAt ?? sim.day) - sim.day));
          c.status.textContent = `Trại cướp · đang ${strength} · đổi mức ${left ? `sau ${left} ngày` : 'hôm nay'}`;
          c.rewards.textContent = `Diệt hết nhận: ${bag}. Mọi thứ về làng này khác: không tặng quà, cống nạp hay thu nạp được.`;
          c.note.hidden = true; c.gift.hidden = c.tribute.hidden = c.adopt.hidden = c.less.hidden = c.more.hidden = true;
          continue;
        }
        const rw = rewardsOf(t, sim.era), bagText = (Object.entries(rw.bag) as Array<[keyof typeof RES_NAME, number]>).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${n} ${RES_NAME[k].toLowerCase()}`).join(' · ');
        c.rewards.textContent = t.state === 'destroyed' ? '' : `Thu nạp hoặc diệt: +${rw.pop} dân tối đa · +${rw.slots} chỗ mỗi trại lính · +${rw.yieldPct}% sản lượng khai thác · túi ${bagText}. Cống nạp: góp ${rw.allies} lính khi ta đi đánh.`;
        const over = t.state === 'destroyed', tr = DIFF.capture.tribute, paying = t.state === 'tribute', share = t.tributeShare ?? tr.baseShare, steps = tributeSteps(t);
        c.note.hidden = !paying;
        if (paying && share <= 0) c.note.textContent = `Không lấy cống nạp: quan hệ +${tr.relationRegen} mỗi ${tr.everyDays} ngày.`;
        else if (paying) {
          const left = Math.max(0, Math.ceil(t.nextTribute - sim.day)), bag = (Object.entries(spoilsOf(t, sim.era)) as Array<[keyof typeof RES_NAME, number]>).map(([k, n]) => [k, Math.round((n ?? 0) * share)] as const).filter(([, n]) => n > 0);
          c.note.replaceChildren(h('div', {}, h('b', { text: `Cống nạp ${Math.round(share * 100)}% túi · ` }), `mỗi ${tr.everyDays} ngày, lần tới ${left ? `sau ${left} ngày` : 'hôm nay'}`), h('div', {}, `Mỗi kỳ nhận: ${bag.length ? bag.map(([k, n]) => `${n} ${RES_NAME[k].toLowerCase()}`).join(' · ') : 'không có gì'}`), h('div', {}, steps ? `Đòi thêm ${steps} bước: quan hệ −${1 + steps} mỗi lần, ${Math.round(steps * tr.greedChancePerStep * 100)}% phản bội mỗi lần` : 'Quan hệ −1 mỗi lần nhận'));
        }
        c.gift.hidden = paying || t.state === 'surrendered'; c.tribute.hidden = paying; c.adopt.hidden = paying; c.less.hidden = c.more.hidden = !paying;
        c.gift.disabled = over || t.state !== 'free' || t.boss === true; c.gift.title = t.boss ? 'Thủ lĩnh không nhận quà' : `Quà: ${Object.entries(giftOf(t, sim.era)).map(([k, n]) => `${n} ${RES_NAME[k as keyof typeof RES_NAME].toLowerCase()}`).join(', ')}`; c.tribute.disabled = over || !canTribute(t) || paying; c.adopt.disabled = over || !canAdopt(t) || sim.villagers.length >= sim.popCap();
        c.less.disabled = share <= 0; c.less.textContent = share <= tr.baseShare + (t.tributeFree ?? 0) && share > 0 ? 'Không lấy' : '−10%'; c.more.disabled = share >= tr.maxShare;
      }
      none.hidden = any;
      const sum = sim.conquests.reduce((a, q) => ({ pop: a.pop + q.pop, slots: a.slots + q.slots, y: a.y + q.yieldPct }), { pop: 0, slots: 0, y: 0 });
      summary.textContent = sim.conquests.length ? `Đã chiếm ${sim.conquests.length} làng: +${sum.pop} dân tối đa · +${sum.slots} chỗ mỗi trại lính · +${sum.y}% sản lượng khai thác. Làng bị lấy lại thì mất phần của nó.` : 'Chiếm một làng cho thêm dân, chỗ trại lính và % sản lượng khai thác, càng mạnh càng nhiều.';
      const p = sim.pendingTribe && sim.tribes.find((x) => x.id === sim.pendingTribe);
      banner.hidden = !p;
      if (p) banner.replaceChildren(hint(h('b', { text: `${p.def.name} xin hàng!` }), 'Thu nạp: làng biến mất, ta nhận dân và chỗ ở trại lính vĩnh viễn. Cống nạp: họ giữ làng và nộp một phần tài nguyên mỗi 3 ngày, không đánh ta nữa và góp lính khi ta đi đánh; đòi càng nhiều họ càng oán và có thể phản bội.'));
    };
    return page;
  }

}
