import type { ArmCount, BattleRecord, WarRecord } from '../sim/model';
import { RES_NAME } from '../sim/resources';
import type { Res } from '../sim/resources';
import { h } from './dom';
import type { Ctx } from './ctx';

const ARM: Array<[keyof ArmCount, string]> = [['foot', 'Bộ binh'], ['archer', 'Thợ ném / cung'], ['cavalry', 'Kỵ']];
type Tone = 'good' | 'bad' | 'neutral';
type Kind = 'attack' | 'defense' | 'beasts';
const FILTERS: Array<[Kind | 'all', string]> = [['all', 'Tất cả'], ['attack', '⚔ Tấn công'], ['defense', '🛡 Phòng thủ'], ['beasts', '🐺 Thú dữ']];
const ICON: Record<Kind, string> = { attack: '⚔', defense: '🛡', beasts: '🐺' };

const num = (n: number): string => Math.round(n).toLocaleString('vi');
const sumArms = (c: ArmCount): number => c.foot + c.archer + c.cavalry;
const goods = (o: Partial<Record<Res, number>>): string => {
  const parts = Object.entries(o).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${num(n ?? 0)} ${RES_NAME[k as Res].toLowerCase()}`);
  return parts.length ? parts.join(' · ') : 'không có';
};

/** One fight of the log in the shape the cards draw: attacks we made, raids on the village, packs of beasts. */
interface Entry {
  kind: Kind; day: number; id: number; title: string; sub: string; badge: string; tone: Tone;
  tiles: Array<{ label: string; value: string; tone?: Tone }>;
  ours: number; theirs: number;
  /** Rows of the table by arm: sent (attacks only) and dead. */
  arms?: Array<{ name: string; sent?: number; dead: number }>;
  lines: Array<[string, string]>; notes: string[];
  sample: boolean;
}

function attackEntry(r: WarRecord): Entry {
  const sent = sumArms(r.sent), dead = sumArms(r.dead);
  const tone: Tone = r.result === 'won' ? 'good' : r.result === 'lost' ? 'bad' : 'neutral';
  return {
    kind: 'attack', day: r.endDay, id: r.id, title: `Tấn công ${r.name}`,
    sub: `Ngày ${r.startDay}${r.endDay !== r.startDay ? ` → ${r.endDay}` : ''} · ${r.days.toLocaleString('vi', { maximumFractionDigits: 1 })} ngày · bản đồ cấp ${r.mapLevel || '?'} · ${r.squads} đội`,
    badge: r.result === 'won' ? '🏆 Thắng' : r.result === 'lost' ? '☠ Thua' : '↩ Hủy trận', tone,
    tiles: [
      { label: 'Quân đưa đi', value: num(sent) },
      { label: 'Ta mất', value: `${num(dead)}${sent ? ` (${Math.round((dead / sent) * 100)}%)` : ''}`, tone: dead > 0 ? 'bad' : undefined },
      { label: 'Địch bị hạ', value: num(r.foeDead), tone: r.foeDead > 0 ? 'good' : undefined },
      ...(r.supplySent ? [{ label: 'Hậu cần mất', value: `${r.supplyDead}/${r.supplySent}`, tone: r.supplyDead ? 'bad' as Tone : undefined }] : []),
    ],
    ours: dead, theirs: r.foeDead,
    arms: ARM.map(([k, name]) => ({ name, sent: r.sent[k], dead: r.dead[k] })),
    lines: [['Cướp được', goods(r.loot)], ['Tiêu hao', goods(r.spent)]],
    notes: r.notes ?? [], sample: !!r.sample,
  };
}

function defenseEntry(r: BattleRecord): Entry {
  const beasts = r.kind === 'beasts', bad = r.civDead > 0 || r.breaches >= 3, good = r.civDead === 0 && r.breaches === 0 && r.ourDead <= 1;
  const tone: Tone = bad ? 'bad' : good ? 'good' : 'neutral';
  return {
    kind: r.kind === 'beasts' ? 'beasts' : 'defense', day: r.endDay, id: r.id, title: beasts ? `${r.name} tấn công làng` : `${r.name} tập kích`,
    sub: `Ngày ${r.startDay} · ${r.night ? '🌙 ban đêm' : '☀ ban ngày'} · ${r.minutes} phút · tối đa ${r.peak} ${beasts ? 'con' : 'địch'} cùng lúc`,
    badge: bad ? '⚠ Thiệt hại nặng' : good ? '🛡 Giữ vững' : 'Thiệt hại nhẹ', tone,
    tiles: [
      { label: 'Ta mất', value: num(r.ourDead), tone: r.ourDead > 0 ? 'bad' : undefined },
      { label: beasts ? 'Thú bị hạ' : 'Địch bị hạ', value: num(r.foeDead), tone: r.foeDead > 0 ? 'good' : undefined },
      { label: 'Sát thương gây ra', value: num(r.dmgDealt) },
      { label: 'Sát thương phải chịu', value: num(r.dmgTaken) },
      ...(r.civDead ? [{ label: 'Dân chết', value: num(r.civDead), tone: 'bad' as Tone }] : []),
      ...(r.breaches ? [{ label: 'Rào / cổng bị phá', value: num(r.breaches), tone: 'bad' as Tone }] : []),
      ...(r.shots ? [{ label: 'Chòi canh bắn', value: `${num(r.shots)} phát` }] : []),
    ],
    ours: r.ourDead, theirs: r.foeDead,
    arms: sumArms(r.ourDeadArm) > 0 ? ARM.map(([k, name]) => ({ name, dead: r.ourDeadArm[k] })) : undefined,
    lines: [], notes: r.notes, sample: !!r.sample,
  };
}

/**
 * The log of the fights in the Lều họp chiến, drawn as a battle report: a summary of all of them at the top, a filter, then one card for each fight (newest first)
 * with the result, the numbers (who fell, the damage, the works lost), a bar that sets our dead against theirs, the dead by arm, what was taken and spent, and the story.
 * It holds the attacks we made, the raids on the village and the packs of beasts.
 */
export class WarLogPane {
  readonly root = h('div', { class: 'page blog' });
  private key = '';
  private filter: Kind | 'all' = 'all';
  constructor(private readonly c: Ctx) {}

  update(): void {
    const { sim } = this.c, k = `${sim.warLog.length}.${sim.battleLog.length}.${sim.warLog.filter((r) => r.sample).length}.${sim.battleLog.filter((r) => r.sample).length}.${this.filter}`;
    if (k === this.key) return;
    this.key = k;
    const all = [...sim.warLog.map(attackEntry), ...sim.battleLog.map(defenseEntry)].sort((a, b) => b.day - a.day || b.id - a.id);
    const shown = this.filter === 'all' ? all : all.filter((e) => e.kind === this.filter);
    const out: Node[] = [h('h3', { class: 'btitle', text: 'Nhật ký chiến đấu' }), this.summary(all), this.filters(all)];
    if (!shown.length) out.push(h('p', { class: 'sub', text: all.length ? 'Không có trận nào thuộc loại này.' : 'Chưa có trận nào. Mỗi cuộc tấn công của ta, mỗi lần địch hoặc thú dữ đánh vào làng sẽ được ghi lại ở đây.' }));
    for (const e of shown) out.push(this.card(e));
    this.root.replaceChildren(...out);
  }

  private summary(all: Entry[]): HTMLElement {
    const won = all.filter((e) => e.tone === 'good').length, ours = all.reduce((n, e) => n + e.ours, 0), theirs = all.reduce((n, e) => n + e.theirs, 0);
    const tile = (label: string, value: string, tone?: Tone) => h('div', { class: `bsum${tone ? ` ${tone}` : ''}` }, h('b', { text: value }), h('small', { text: label }));
    return h('div', { class: 'bsummary' }, tile('Trận đã ghi', num(all.length)), tile('Thắng / giữ vững', `${won}/${all.length}`, 'good'), tile('Quân ta đã mất', num(ours), ours ? 'bad' : undefined), tile('Kẻ địch đã bị hạ', num(theirs), theirs ? 'good' : undefined));
  }

  private filters(all: Entry[]): HTMLElement {
    return h('div', { class: 'btns bfilters' }, ...FILTERS.map(([f, label]) => {
      const n = f === 'all' ? all.length : all.filter((e) => e.kind === f).length;
      return h('button', { class: 'sm', type: 'button', text: `${label} (${n})`, pressed: this.filter === f, onclick: () => { this.filter = f; this.update(); } });
    }));
  }

  private card(e: Entry): HTMLElement {
    const total = e.ours + e.theirs, mine = total ? Math.round((e.ours / total) * 100) : 0;
    const bar = total > 0
      ? h('div', { class: 'bvs', title: `Ta mất ${e.ours}, địch mất ${e.theirs}` },
        h('span', { class: 'ours', style: `width:${mine}%` }, h('small', { text: e.ours ? `Ta mất ${num(e.ours)}` : '' })),
        h('span', { class: 'theirs', style: `width:${100 - mine}%` }, h('small', { text: e.theirs ? `Địch mất ${num(e.theirs)}` : '' })))
      : null;
    const table = e.arms ? h('table', { class: 'btable' },
      h('thead', {}, h('tr', {}, h('th', { text: 'Binh chủng' }), ...(e.arms[0]?.sent !== undefined ? [h('th', { text: 'Đưa đi' })] : []), h('th', { text: 'Tử trận' }))),
      h('tbody', {}, ...e.arms.map((a) => h('tr', {}, h('td', { text: a.name }), ...(a.sent !== undefined ? [h('td', { text: num(a.sent) })] : []), h('td', { class: a.dead ? 'bad' : '', text: num(a.dead) }))))) : null;
    return h('article', { class: `bcard ${e.tone}${e.sample ? ' sample' : ''}` },
      h('header', { class: 'bhead' }, h('span', { class: 'bico', text: ICON[e.kind] }), h('div', { class: 'bwho' }, h('b', { text: e.title }), h('small', { text: e.sub })), h('span', { class: `bbadge ${e.tone}`, text: e.badge })),
      h('div', { class: 'bstats' }, ...e.tiles.map((t) => h('div', { class: `bstat${t.tone ? ` ${t.tone}` : ''}` }, h('b', { text: t.value }), h('small', { text: t.label })))),
      bar, table,
      ...e.lines.map(([k, v]) => h('p', { class: 'bline' }, h('span', { text: k }), h('b', { text: v }))),
      e.notes.length ? h('details', { class: 'bnotes' }, h('summary', { text: `Diễn biến (${e.notes.length})` }), h('ol', {}, ...e.notes.map((n) => h('li', { text: n })))) : null,
      e.sample ? h('small', { class: 'bsample', text: 'Dữ liệu mẫu (dev)' }) : null);
  }
}
