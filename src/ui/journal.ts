/** The two windows of the left edge: the quests and the notices. Each is a GameDialog over the map. */
import { buildingName } from '../sim/buildings';
import type { BuildingKind } from '../sim/buildings';
import type { Notice } from '../sim/model';
import type { Sim } from '../sim/sim';
import questData from '../data/quests.json';
import type { Ctx } from './ctx';
import { dlg, GameDialog } from './gamedialog';
import { resIcon } from './resicons';

type Which = 'quests' | 'notices';
type QuestView = ReturnType<Sim['quests']>[number];
const CHAPTERS = questData.chapters; // the data of the chapters is read here: the screen does not reach into the quest system
const isCount = (p: string): boolean => p.split('/').length === 2 && p.split('/').every((x) => x !== '' && !isNaN(Number(x)));

export class Journal {
  private open: Which | null = null;
  private questSeen = '';
  private questKey = '';
  private noticeKey = '#'; // '#' matches no real key, so an empty list is still drawn once
  private readonly noticeSeen = new Set<string>();
  private readonly noticeLines = new Map<string, { when: HTMLElement; body: HTMLElement }>();
  private views: QuestView[] = [];
  private notes: Notice[] = [];
  private readonly win: Record<Which, GameDialog>;
  private readonly dot: Record<Which, HTMLElement>;

  constructor(private readonly c: Ctx, roots: Record<Which, HTMLElement>, private readonly button: Record<Which, HTMLElement>) {
    this.win = { quests: new GameDialog(roots.quests, { onClose: () => this.closed() }), notices: new GameDialog(roots.notices, { onClose: () => this.closed() }) };
    this.dot = { quests: button.quests.querySelector('i') as HTMLElement, notices: button.notices.querySelector('i') as HTMLElement };
    for (const w of ['quests', 'notices'] as const) button[w].addEventListener('click', () => this.toggle(w));
  }

  /** Open one window (closing the other), or close it if it is the one open. */
  toggle(w: Which): void {
    const was = this.open;
    if (was) this.win[was].hide();
    this.open = was === w ? null : w;
    this.questKey = ''; this.noticeKey = '#';
    this.sync();
    if (this.open) this.update(this.views, this.notes);
  }
  private closed(): void { this.open = null; this.sync(); }
  private sync(): void { for (const w of ['quests', 'notices'] as const) this.button[w].setAttribute('aria-pressed', String(this.open === w)); }

  /** Once per screen refresh: redraw what is open and set the marks on the two buttons. */
  update(views: QuestView[], notes: Notice[]): void {
    this.views = views; this.notes = notes;
    const cur = views.find((v) => v.open);
    if (this.open === 'quests') {
      const key = views.map((v) => (v.done ? 'd' : v.open ? 'o' : 'l')).join('') + (cur ? `#${cur.progress}` : '#all');
      if (key !== this.questKey) { this.questKey = key; this.drawQuests(views, cur); }
      if (cur) this.questSeen = cur.quest.id;
    }
    this.dot.quests.hidden = this.open === 'quests' || !cur || cur.quest.id === this.questSeen;

    if (this.open === 'notices') {
      const key = notes.map((n) => `${n.id}|${n.level}`).join(',');
      if (key !== this.noticeKey) { this.noticeKey = key; this.drawNotices(notes); }
      for (const n of notes) { const l = this.noticeLines.get(n.id); if (l) { l.when.textContent = n.when; l.body.textContent = n.body; } this.noticeSeen.add(`${n.id}|${n.level}`); }
    }
    this.dot.notices.hidden = this.open === 'notices' || !notes.some((n) => !this.noticeSeen.has(`${n.id}|${n.level}`));
    this.dot.notices.classList.toggle('calm', !notes.some((n) => n.level === 'urgent'));
  }

  private close(): void { if (this.open) this.toggle(this.open); }

  // ---------------------------------------------------------------- quests
  private drawQuests(views: QuestView[], cur: QuestView | undefined): void {
    const chap = cur?.quest.chapter ?? CHAPTERS[CHAPTERS.length - 1].id, mine = views.filter((v) => v.quest.chapter === chap);
    const done = mine.filter((v) => v.done).length;
    const tiles = mine.map((v) => {
      const state = v.done ? 'done' : v === cur ? 'now' : v.open ? 'next' : 'lock', counting = v === cur && isCount(v.progress);
      const [have, need] = counting ? v.progress.split('/').map(Number) : [0, 0];
      return dlg.tile({ state, pic: v.done ? '✓' : v === cur ? '▸' : v.open ? '○' : '🔒', name: v.quest.title, chip: counting ? dlg.chip(v.progress) : null },
        v === cur ? [dlg.text(v.quest.hint), need > 0 ? dlg.bar(have, need) : null, v.progress && !counting ? dlg.note(v.progress) : null] : []);
    });
    this.win.quests.show(dlg.card({ wide: true, label: 'Nhiệm vụ' },
      dlg.head({ pic: '📜', title: 'Nhiệm vụ', sub: CHAPTERS.find((x) => x.id === chap)?.name, bar: cur ? { value: done, max: mine.length, label: `${done}/${mine.length}` } : undefined, onClose: () => this.close() }),
      dlg.list(...(cur ? tiles : [dlg.empty('Đã hoàn thành kế hoạch tới Nhà chung cấp 4.')]))));
    this.win.quests.root.querySelector('.now')?.scrollIntoView({ block: 'nearest' });
  }

  // ---------------------------------------------------------------- notices
  private drawNotices(notes: Notice[]): void {
    this.noticeLines.clear();
    const tiles = notes.map((n) => {
      const when = dlg.chip(''), body = dlg.more('');
      this.noticeLines.set(n.id, { when, body });
      const go = n.action ? dlg.button(`Đến ${n.action.label}`, () => this.go(n.action!), { small: true }) : null;
      return dlg.tile({ state: n.level, pic: n.icon.length > 1 ? resIcon(n.icon) : n.icon, name: n.title, chip: when, title: n.tip }, [body], go);
    });
    this.win.notices.show(dlg.card({ wide: true, label: 'Thông báo' },
      dlg.head({ pic: '🔔', title: 'Thông báo', onClose: () => this.close() }),
      dlg.list(...(tiles.length ? tiles : [dlg.empty('Không có thông báo nào.')]))));
  }

  /** Open the building a notice points to, if the village has one. */
  private go(a: { building: string; label: string }): void {
    const { sim, ctl, toast } = this.c, b = sim.buildings.find((x) => x.kind === a.building && x.done);
    if (!b) { toast(`Chưa có ${buildingName(a.building as BuildingKind, sim.era).toLowerCase()}`); return; }
    this.close(); ctl.selectBuilding(b.id, true);
  }
}
