import { workDays } from '../sim/constants';
import { RES_NAME } from '../sim/resources';
import type { Res } from '../sim/resources';
import { levelsOfLine, lineLevel, missingOf, PILLARS, reached, sideLevels, sideTechId, STAT_DEF, statBonus, statTechId, TECH_BY_ID, TREE_ROLES } from '../sim/research';
import type { LineStat, PillarDef, PillarStrand, Tech } from '../sim/research';
import { h, iconCanvas } from './dom';
import { dlg, GameDialog } from './gamedialog';
import { resIcon, statIcon } from './resicons';
import type { Ctx } from './ctx';

/**
 * The research house (doc/cơ chế nghiên cứu/research-ui.html): the three pillars as tabs; under them the branches of the pillar chosen on the left and, on the right, the path of
 * the branch chosen: its rows side by side (three stats and the leap each ends in), joined by arrows, then a locked square for the medieval age that goes on from it; a bar at the
 * foot shows what the node touched gives, what it still waits for, what it costs, and starts it. Tapping a node only selects it: the materials are paid when Nghiên cứu is pressed.
 */
const ICON: Record<string, string> = {
  mil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/></svg>',
  econ: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-9"/><path d="M12 12c-4 0-6-2.5-6-6 4 0 6 2.5 6 6z"/><path d="M12 15c3.5 0 5.5-2 5.5-5-3.5 0-5.5 2-5.5 5z"/></svg>',
  craft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l9-9"/><path d="M12 5l7 7-3.5 3.5-7-7z"/></svg>',
};
const LOCK = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2" y="5" width="8" height="6" rx="1" fill="currentColor"/><path d="M4 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

type State = 'done' | 'ready' | 'locked' | 'busy';
/** What a selected node is: a stat line of a role, or a leap. */
type Pick = { kind: 'stat'; role: string; stat: LineStat; strand: PillarStrand; row: number } | { kind: 'leap'; tech: Tech; strand: PillarStrand; row: number } | { kind: 'side'; leap: NonNullable<PillarStrand['rows'][number]['leap']>; strand: PillarStrand };

export class ResearchPane {
  readonly root = h('div', { class: 'rsp' });
  private readonly dialog = new GameDialog(h('div', {}), { onClose: () => { this.sel = null; this.showDetail(); this.update(true); } });
  private readonly main = h('div', { class: 'rs-main' });
  private tab = 'mil';
  private readonly branch: Record<string, string> = {};
  private sel: string | null = null;
  private key = '';
  /** The mouse has just dragged the path sideways: the click that ends the drag is not a tap. */
  private dragged = false;
  /** How big the tree is drawn (1 = 100%): the wheel, or two fingers change it (no buttons). */
  private zoom = 1;

  constructor(private readonly c: Ctx) {
    this.root.append(this.main, this.dialog.root);
    this.root.addEventListener('click', (e) => { if (this.dragged) { this.dragged = false; e.stopPropagation(); return; } this.click(e.target as HTMLElement); }, true);
    this.root.addEventListener('pointerdown', (e) => { this.dragged = false; this.grab(e); });
    // the wheel zooms the tree where the pointer is (dragging moves it)
    this.root.addEventListener('wheel', (e) => { const st = (e.target as HTMLElement).closest<HTMLElement>('.rs-stages'); if (!st) return; const r = st.getBoundingClientRect(); this.setZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX - r.left, y: e.clientY - r.top }); e.preventDefault(); }, { passive: false });
  }

  // ---------------------------------------------------------------- what the tree says
  private get done() { return (id: string) => reached(this.c.sim.researched, id); }
  /** A row is shown when it has a real stat or a real leap; the rows of the medieval age only in the medieval age. */
  private rowShown(st: PillarStrand, r: number): boolean {
    const row = st.rows[r];
    if (!row || (row.era === 'ancient' && this.c.sim.era !== 'ancient')) return false;
    return row.nodes.some((n) => n.stat) || (!!row.leap && !TECH_BY_ID[row.leap.id].milestone);
  }
  /** The branches of a pillar in play: those with a row to show (the medieval ones only in the medieval age). */
  private shown(p: PillarDef): PillarStrand[] { const adv = this.c.sim.era === 'ancient'; return p.strands.filter((st) => (st.era !== 'ancient' || adv) && st.rows.some((_, r) => this.rowShown(st, r))); }
  /** The branches of the list on the left: a strand that is drawn inside another (`into`) has none of its own. */
  private branches(p: PillarDef): PillarStrand[] { return this.shown(p).filter((st) => !st.into); }
  /** The chains of a branch, from the top: the ones that hang above it, the branch itself, the ones under it (a market tree is one tree drawn as three chains). */
  private chains(p: PillarDef, st: PillarStrand): PillarStrand[] {
    const kids = this.shown(p).filter((k) => k.into === st.key);
    const by = (a: PillarStrand, b: PillarStrand) => (a.place ?? 1) - (b.place ?? 1);
    return [...kids.filter((k) => (k.place ?? 1) < 0).sort(by), st, ...kids.filter((k) => (k.place ?? 1) >= 0).sort(by)];
  }
  private rows(st: PillarStrand): number[] { return st.rows.map((_, r) => r).filter((r) => this.rowShown(st, r)); }
  /** The role whose stat lines a row holds: the arm, or for a row of the medieval age its own made-up role. */
  private roleOf(st: PillarStrand, r: number): string { return st.rows[r].group ?? st.role; }
  private realNodes(st: PillarStrand, r: number): LineStat[] { return st.rows[r].nodes.filter((n) => n.stat).map((n) => n.stat!); }
  /** The leap a row ends in (null for a stretch of stats between two leaps). */
  private leapOf(st: PillarStrand, r: number): Tech | null { const l = st.rows[r].leap; return l ? TECH_BY_ID[l.id] : null; }
  /** A row is shut while none of its stats can be started (the row before it is not done). */
  private open(st: PillarStrand, r: number): boolean { const role = this.roleOf(st, r); return this.realNodes(st, r).some((s) => this.statState(role, s) !== 'locked'); }
  private techState(t: Tech | undefined): State {
    if (!t) return 'done';
    const s = this.c.sim.techState(t).state;
    return s === 'done' ? 'done' : s === 'ready' ? 'ready' : s === 'locked' ? 'locked' : 'busy';
  }
  private nextTech(role: string, stat: LineStat): Tech | undefined { const lv = lineLevel(this.c.sim.researched, role, stat); return lv >= levelsOfLine(role, stat) ? undefined : TECH_BY_ID[statTechId(role, stat, lv + 1)]; }
  private statState(role: string, stat: LineStat): State { return this.techState(this.nextTech(role, stat)); }
  private leapState(t: Tech): State { return t.milestone ? (this.done(t.id) ? 'done' : 'locked') : this.techState(t); }
  private readyCount(p: PillarDef): number { let n = 0; for (const st of this.shown(p)) for (const r of this.rows(st)) { const l = this.leapOf(st, r); if (l && this.leapState(l) === 'ready') n++; } return n; }

  // ---------------------------------------------------------------- drawing
  private tabsH(): string {
    return `<div class="rs-tabs" role="tablist" aria-label="Các trụ nghiên cứu">${PILLARS.map((p) => {
      const rd = this.readyCount(p);
      return `<button class="rs-tab c-${p.id}${this.tab === p.id ? ' on' : ''}" role="tab" aria-selected="${this.tab === p.id}" data-tab="${p.id}"><span class="rs-ti">${ICON[p.id] ?? ''}</span><span>${esc(p.name)}</span>${rd ? `<span class="rs-bdg" title="${rd} sẵn sàng">${rd}</span>` : ''}</button>`;
    }).join('')}</div>`;
  }
  private statH(st: PillarStrand, r: number, stat: LineStat): string {
    const { sim } = this.c, role = this.roleOf(st, r), lv = lineLevel(sim.researched, role, stat), max = levelsOfLine(role, stat), id = `s|${st.key}|${r}|${stat}`;
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    const state = this.statState(role, stat);
    return `<button class="rs-stat${lv > 0 ? ' has' : ''}${lv >= max ? ' max' : ''}${state === 'busy' ? ' busy' : ''}${this.sel === id ? ' sel' : ''}${max > 3 ? ' many' : ''}" data-node="${id}" title="${esc(STAT_DEF[stat].name)}" aria-label="${esc(STAT_DEF[stat].name)}, cấp ${lv} trên ${max}"><span class="rs-nm">${esc(STAT_DEF[stat].short)}</span><span class="rs-pips" aria-hidden="true">${pips}</span></button>`;
  }
  private leapH(st: PillarStrand, r: number): string {
    const t = this.leapOf(st, r)!, state = this.leapState(t), id = `l|${st.key}|${r}`, sim = this.c.sim;
    const need = t.needCount?.count ?? 0, got = (t.needCount?.ids ?? []).filter(this.done).length;
    const missing = state === 'done' ? [] : missingOf(sim.researched, t), kept = t.requires.filter((q) => this.done(q)).map((q) => TECH_BY_ID[q].name.replace(/^Mở /, ''));
    const xs = state === 'done' ? '' : [...kept.map((n) => `<span class="rs-xc ok">✓ ${esc(cap(n))}</span>`), ...missing.map((n) => `<span class="rs-xc">cần ${esc(cap(n))}</span>`)].join('')
      + (!sim.dev.freeWorks && (sim.building('lab')?.level ?? 0) < t.needLevel ? `<span class="rs-xc">cần Nhà NC cấp ${t.needLevel}</span>` : '');
    const prog = state === 'done' || !need ? '' : `<span class="rs-lpg"><span class="rs-bar"><b style="width:${Math.min(1, got / need) * 100}%"></b></span>${Math.min(got, need)}/${need}</span>`;
    const ic = state === 'locked' ? LOCK : state === 'done' ? '✓' : '';
    const cls = state === 'busy' ? 'ready busy' : state;
    return `<button class="rs-leap ${cls}${this.sel === id ? ' sel' : ''}" data-node="${id}"><span class="rs-ln"><span>${esc(cap(t.name.replace(/^Mở /, '')))}</span>${ic ? `<span class="rs-ic">${ic}</span>` : ''}</span>${prog}${xs ? `<span class="rs-xcs">${xs}</span>` : ''}</button>`;
  }
  /** How many levels of the discount under a leap are done, and the research of the next one. */
  private sideLevel(leapId: string): number { let n = 0; while (n < sideLevels && this.c.sim.researched.has(sideTechId(leapId, n + 1))) n++; return n; }
  /** The discount that hangs under a leap, a chip of its own with a diamond for each of its levels (it is researched level by level, like a stat). */
  private sideH(st: PillarStrand, r: number): string {
    const leap = st.rows[r].leap;
    if (!leap?.side) return '';
    const lv = this.sideLevel(leap.id), id = `c|${st.key}|${r}`, next = lv >= sideLevels ? undefined : TECH_BY_ID[sideTechId(leap.id, lv + 1)];
    const state = this.techState(next), pips = Array.from({ length: sideLevels }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    return `<span class="rs-down${this.done(leap.id) ? ' on' : ''}"></span><button class="rs-stat rs-side${lv > 0 ? ' has' : ''}${lv >= sideLevels ? ' max' : ''}${state === 'locked' ? ' dim' : ''}${state === 'busy' ? ' busy' : ''}${this.sel === id ? ' sel' : ''}" data-node="${id}" title="${esc(leap.side.name)}"><span class="rs-nm">${esc(leap.side.short)}</span><span class="rs-pips" aria-hidden="true">${pips}</span></button>`;
  }
  /** One row of the chain: its stats one under the other, then (after an arrow) the leap it ends in with its discount under it, if it has one. */
  private stageH(st: PillarStrand, r: number): string {
    const open = this.open(st, r), leap = this.leapOf(st, r), ld = leap ? this.done(leap.id) : this.rowDone(st, r);
    const stats = this.realNodes(st, r), grp = stats.length ? `<div class="rs-grp${open ? '' : ' lock'}">${stats.map((n) => this.statH(st, r, n)).join('')}</div><span class="rs-arr${open ? ' on' : ''}"></span>` : '';
    return leap ? `${grp}<div class="rs-col">${this.leapH(st, r)}${this.sideH(st, r)}</div><span class="rs-arr${ld ? ' on' : ''}" data-after="${esc(leap.id)}"></span>` : grp;
  }
  /** How far from the left of a chain the arrow after a leap stands (its right end), in px: a row of stats is 150 wide and an arrow 40, a leap 156 and an arrow 40 (see _research.scss). */
  private widthTo(st: PillarStrand, leapId: string): number | null {
    let x = 0;
    for (const r of this.rows(st)) {
      x += (this.realNodes(st, r).length ? 150 + 40 : 0) + (st.rows[r].leap ? 156 + 40 : 0);
      if (st.rows[r].leap?.id === leapId) return x;
    }
    return null;
  }
  /** The elbow of every branch: down from the arrow after the leap it grows out of, then along to its first row. Measured on the page, so that rows of any height line up. */
  private links(): void {
    const tree = this.main.querySelector<HTMLElement>('.rs-tree'); if (!tree) return;
    const t0 = tree.getBoundingClientRect();
    for (const ch of tree.querySelectorAll<HTMLElement>('.rs-chain[data-from]')) {
      const arr = [...tree.querySelectorAll<HTMLElement>('.rs-arr[data-after]')].find((a) => a.dataset.after === ch.dataset.from), first = ch.querySelector<HTMLElement>('.rs-line > *');
      if (!arr || !first) continue;
      const a = arr.getBoundingClientRect(), f = first.getBoundingClientRect();
      const z = this.zoom, x0 = (a.left + a.width / 2 - t0.left) / z, y0 = (a.top + a.height / 2 - t0.top) / z, x1 = (f.left - t0.left) / z - 2, y1 = (f.top + f.height / 2 - t0.top) / z; // the page measures what is drawn, which the zoom scaled
      const el = document.createElement('div');
      el.className = `rs-link${arr.classList.contains('on') ? ' on' : ''}`;
      el.style.cssText = `left:${x0}px;top:${y0}px;width:${Math.max(0, x1 - x0)}px;height:${Math.max(0, y1 - y0)}px`;
      tree.append(el);
    }
  }
  /** A stretch of stats with no leap counts as done when most of its levels are (what the next row waits for). */
  private rowDone(st: PillarStrand, r: number): boolean {
    const role = this.roleOf(st, r), stats = this.realNodes(st, r), total = stats.reduce((a, x) => a + levelsOfLine(role, x), 0), got = stats.reduce((a, x) => a + lineLevel(this.c.sim.researched, role, x), 0);
    return total > 0 && got >= Math.ceil(total * 0.66 - 1e-9);
  }
  private navH(p: PillarDef, st: PillarStrand): string {
    let cnt = 0, any = false, path = '', total = 0;
    for (const ch of this.chains(p, st)) {
      const rows = this.rows(ch);
      const leaps = rows.map((r) => this.leapOf(ch, r)).filter((l): l is Tech => !!l && !l.id.includes('_camp'));
      const marks: State[] = leaps.length ? leaps.map((l) => this.leapState(l)) : rows.map((r) => (this.rowDone(ch, r) ? 'done' : 'locked')); // a branch with no leap shows its stretches of stats
      marks.forEach((m) => {
        if (m === 'done') cnt++; if (m === 'ready') any = true;
        path += `<i class="d ${m === 'done' ? 'k' : m === 'ready' ? 'r' : ''}"></i>`;
      });
      total += marks.length;
    }
    if (total > 7) path = `<span class="rs-bar"><b style="width:${Math.round((cnt / total) * 100)}%"></b></span>`; // a long branch is one bar, not a dash for each leap
    return `<button class="rs-ni${this.branch[p.id] === st.key ? ' on' : ''}" data-br="${st.key}"><span class="rs-nr"><span class="rs-nn">${esc(st.name)}</span>${any ? '<span class="rs-rb" title="Có mốc sẵn sàng để nghiên cứu"></span>' : ''}</span><span class="rs-nr"><span class="rs-path">${path}</span><span class="rs-cnt">${cnt}/${total}</span></span></button>`;
  }
  private bodyH(p: PillarDef): string {
    const list = this.branches(p), st = list.find((b) => b.key === this.branch[p.id]) ?? list[0], chains = this.chains(p, st);
    const leaps = chains.flatMap((ch) => this.rows(ch).map((r) => this.leapOf(ch, r)).filter((l): l is Tech => !!l)), doneN = leaps.filter((l) => this.done(l.id)).length;
    // in the stone age the medieval rows of an arm are a shut square after its last row; in the medieval age they are there
    const hasMed = st.rows.some((x) => x.era === 'ancient'), next = hasMed && this.c.sim.era !== 'ancient' ? `<div class="rs-next" title="Cây Trung cổ nối tiếp từ đây"><span class="rs-ic">${LOCK}</span><b>Trung cổ</b><small>khóa</small></div>` : '';
    const line = (ch: PillarStrand) => `${this.rows(ch).map((r) => this.stageH(ch, r)).join('')}${ch === st ? next : ''}`;
    // one chain is the old straight path; a tree draws its chains one under the other in one scroll. A branch (`from`) starts to the right of the leap it grows out of, and `links()` draws the elbow from that leap's arrow
    const indent = new Map<string, number>();
    for (const ch of chains) {
      const at = ch.from ? chains.find((o) => o !== ch && o.rows.some((x) => x.leap?.id === ch.from)) : undefined, x = at ? this.widthTo(at, ch.from!) : null;
      indent.set(ch.key, at && x !== null ? (indent.get(at.key) ?? 0) + x - 20 + 28 : 0);
    }
    const hasSide = (ch: PillarStrand) => this.rows(ch).some((r) => ch.rows[r].leap?.side);
    const stages = chains.length > 1
      ? `<div class="rs-stages tree"><div class="rs-zoomer"><div class="rs-zoom" style="transform:scale(${this.zoom})"><div class="rs-tree">${chains.map((ch) => `<div class="rs-chain${hasSide(ch) ? ' side' : ''}"${ch.from ? ` data-from="${esc(ch.from)}"` : ''} style="margin-left:${indent.get(ch.key) ?? 0}px"><div class="rs-tag">${esc(ch.tag ?? ch.name)}</div><div class="rs-line">${line(ch)}</div></div>`).join('')}</div></div></div></div>`
      : `<div class="rs-stages"><div class="rs-zoomer"><div class="rs-zoom rs-solo" style="transform:scale(${this.zoom})">${line(st)}</div></div></div>`;
    return `<div class="rs-pv"><nav class="rs-nav" aria-label="Nhánh của ${esc(p.name)}">${list.map((b) => this.navH(p, b)).join('')}</nav>`
      + `<div class="rs-lane"><div class="rs-lh"><h3>${esc(st.name)}</h3><span class="rs-w">${esc(st.who)}</span><span class="rs-lc">Đã mở ${doneN}/${leaps.length}</span></div>`
      + `${stages}</div></div>`;
  }
  /** The node selected. */
  private pick(): Pick | null {
    if (!this.sel) return null;
    const [k, key, ...rest] = this.sel.split('|'), x = rest.join('|'), strand = PILLARS.flatMap((p) => p.strands).find((s) => s.key === key);
    if (!strand) return null;
    if (k === 's') { const [row, stat] = x.split('|'); return { kind: 'stat', role: strand.rows[+row].group ?? strand.role, stat: stat as LineStat, strand, row: +row }; }
    if (k === 'c') return { kind: 'side', leap: strand.rows[+x].leap!, strand };
    return { kind: 'leap', tech: TECH_BY_ID[strand.rows[+x].leap!.id], strand, row: +x };
  }
  /** The picture on the head of the dialog of a leap: the house of the role. */
  private housePic(role: string): HTMLElement {
    const { sim, sprites } = this.c, kind = TREE_ROLES[role]?.building ?? 'lab';
    try { return h('span', { class: 'tpic' }, iconCanvas(sprites.building(kind, sim.era, 1, 4).frames[0])); } catch { return h('span', { class: 'tpic', text: '?' }); }
  }
  /** The tapped node as a dialog over the pane: what it gives, what it waits for, what it costs, and the button that starts it. */
  private showDetail(): void {
    const pk = this.pick(), { sim, toast, ctl } = this.c;
    if (!pk) { this.dialog.hide(); return; }
    const close = () => { this.sel = null; this.showDetail(); this.update(true); };
    const stat = pk.kind === 'stat' ? pk.stat : null, side = pk.kind === 'side' ? pk.leap.side! : null, sideLv = pk.kind === 'side' ? this.sideLevel(pk.leap.id) : 0, per = side ? Object.values(side.effect)[0] : 0;
    const tech = pk.kind === 'stat' ? this.nextTech(pk.role, pk.stat) : pk.kind === 'side' ? (sideLv >= sideLevels ? undefined : TECH_BY_ID[sideTechId(pk.leap.id, sideLv + 1)]) : pk.tech;
    const lv = pk.kind === 'stat' ? lineLevel(sim.researched, pk.role, pk.stat) : pk.kind === 'side' ? sideLv : this.done(pk.tech.id) ? 1 : 0, max = pk.kind === 'stat' ? levelsOfLine(pk.role, pk.stat) : side ? sideLevels : 1;
    const title = stat ? `${STAT_DEF[stat].name} · ${pk.strand.name}` : side ? side.name : cap(pk.kind === 'leap' ? pk.tech.name.replace(/^Mở /, '') : '');
    const head = dlg.head({ pic: stat ? h('span', { class: 'tpic stat' }, statIcon(stat)) : this.housePic(pk.strand.role), title, bar: { value: lv, max, label: max > 1 ? `${lv}/${max}` : lv ? '✓' : '' }, onClose: close });
    if (!tech || (pk.kind === 'leap' && pk.tech.milestone)) {
      const text = !tech ? (stat ? `Đã đạt cấp tối đa ${max}: ${STAT_DEF[stat].name.toLowerCase()} của ${pk.strand.name.toLowerCase()} +${statBonus(sim.researched, pk.strand.role, stat)}%.` : side ? `Đã đạt cấp tối đa: giảm ${per * sideLv}%.` : 'Nghiên cứu này đã xong.') : pk.kind === 'leap' ? pk.tech.desc : '';
      this.dialog.show(dlg.card({ label: title }, head, dlg.text(text)));
      return;
    }
    const st = sim.techState(tech), busy = st.state === 'ready' && sim.currentResearch() !== null, short = st.state === 'ready' && !busy ? sim.researchShort(tech) : null, block = st.state === 'queued' ? sim.researchBlock(tech) : null;
    const note = busy ? 'Đợi nghiên cứu hiện tại xong' : short ?? (st.state === 'locked' ? st.why ?? '' : st.state === 'active' ? 'Đang nghiên cứu…' : st.state === 'queued' ? block ?? 'Đã trả vật liệu, chờ bắt đầu' : '');
    const btn = dlg.button({ done: '✓ Xong', active: 'Đang làm', queued: 'Hủy đơn', ready: 'Nghiên cứu', locked: 'Khóa' }[st.state],
      () => { if (st.state === 'queued') sim.unqueueResearch(tech.id); else { const e = sim.queueResearch(tech.id); if (e) toast(e); else this.sel = null; } ctl.onChange(); this.showDetail(); this.update(true); },
      { disabled: st.state === 'done' || st.state === 'active' || st.state === 'locked' || busy || !!short });
    const bill = sim.researchCost(tech);
    const costs = (Object.keys(bill) as Res[]).filter((r) => (bill[r] ?? 0) > 0).map((r) => {
      const need = bill[r] ?? 0, have = Math.floor(sim.stock[r]);
      return dlg.cost(resIcon(r), String(need), String(have), have < need, RES_NAME[r]);
    });
    this.dialog.show(dlg.card({ label: title }, head,
      stat ? dlg.line(`Hiện tại: +${statBonus(sim.researched, pk.kind === 'stat' ? pk.role : '', stat)}%`, `Cấp tiếp theo: +${tech.unlocks.bonus?.pct ?? 0}%`) : side ? dlg.line(`Hiện tại: giảm ${per * sideLv}%`, `Cấp tiếp theo: giảm ${per * (sideLv + 1)}%`) : null,
      stat || side ? null : dlg.text(tech.desc),
      dlg.costs(...costs, dlg.cost(resIcon('clock'), workDays(tech.time), null, false, 'Thời gian')),
      ...(st.state === 'locked' && st.lacks ? st.lacks.map((l) => dlg.note(l)) : [tech.needLevel > 1 ? dlg.note(`Cần Nhà nghiên cứu cấp ${tech.needLevel}`, false) : null, note ? dlg.note(note) : null]), btn));
  }

  // ---------------------------------------------------------------- events
  /** Drag the tree in every direction, like the map (mouse, finger or pen); two fingers zoom it. */
  private readonly ptrs = new Map<number, { x: number; y: number }>();
  /** Lets go of the drag that is on (a press whose release never came, outside the window). */
  private endGrab: (() => void) | null = null;
  private grab(e: PointerEvent): void {
    const st = (e.target as HTMLElement).closest<HTMLElement>('.rs-stages');
    if (!st || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.pointerType === 'mouse') this.endGrab?.();
    const first = this.ptrs.size === 0;
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    let moved = false, pan = { x: e.clientX, y: e.clientY, left: st.scrollLeft, top: st.scrollTop }, pinch: { d: number; z: number } | null = null;
    const dist = (): number => { const [a, b] = [...this.ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    if (this.ptrs.size === 2) pinch = { d: dist(), z: this.zoom };
    if (!first) return; // the first finger owns the listeners; a second one only joins it
    const move = (m: PointerEvent): void => {
      const at = this.ptrs.get(m.pointerId); if (!at) return;
      at.x = m.clientX; at.y = m.clientY;
      if (this.ptrs.size >= 2) { // two fingers: the distance between them is the size
        if (!pinch) pinch = { d: dist(), z: this.zoom };
        const [a, b] = [...this.ptrs.values()], r = st.getBoundingClientRect();
        if (pinch.d > 0) this.setZoom(pinch.z * (dist() / pinch.d), { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top });
        moved = true; st.classList.add('drag'); return;
      }
      if (!moved && Math.hypot(m.clientX - pan.x, m.clientY - pan.y) > 5) { moved = true; st.classList.add('drag'); }
      if (moved) { st.scrollLeft = pan.left - (m.clientX - pan.x); st.scrollTop = pan.top - (m.clientY - pan.y); }
    };
    const up = (u: PointerEvent): void => {
      this.ptrs.delete(u.pointerId); pinch = null;
      if (this.ptrs.size > 0) { const [p0] = [...this.ptrs.values()]; pan = { x: p0.x, y: p0.y, left: st.scrollLeft, top: st.scrollTop }; return; } // one finger is left: it goes on dragging from where it is
      end(); if (moved) this.dragged = true;
    };
    const end = (): void => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); st.classList.remove('drag'); this.ptrs.clear(); this.endGrab = null; };
    this.endGrab = end;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  /** Draw the tree at another size, keeping the point under `at` (a point of the frame; the middle by default) where it is. */
  private setZoom(z: number, at?: { x: number; y: number }): void {
    const nz = Math.max(0.4, Math.min(1.6, Math.round(z * 100) / 100)), st = this.main.querySelector<HTMLElement>('.rs-stages');
    if (!st || nz === this.zoom) return;
    const ax = at?.x ?? st.clientWidth / 2, ay = at?.y ?? st.clientHeight / 2, k = nz / this.zoom, cx = st.scrollLeft + ax, cy = st.scrollTop + ay;
    this.zoom = nz;
    this.fit(st);
    st.scrollLeft = cx * k - ax; st.scrollTop = cy * k - ay;
  }
  /** Size the frame of the tree to what it shows now: a tree drawn small leaves no empty room to scroll to. */
  private fit(st: HTMLElement | null = this.main.querySelector<HTMLElement>('.rs-stages')): void {
    const box = st?.querySelector<HTMLElement>('.rs-zoom'), wrap = st?.querySelector<HTMLElement>('.rs-zoomer');
    if (!box || !wrap) return;
    box.style.transform = `scale(${this.zoom})`;
    wrap.style.width = `${box.offsetWidth * this.zoom}px`; wrap.style.height = `${box.offsetHeight * this.zoom}px`;
  }
  private click(el: HTMLElement): void {
    const t = el.closest<HTMLElement>('[data-tab],[data-br],[data-node]');
    if (!t) return;
    if (t.dataset.tab) { this.tab = t.dataset.tab; this.sel = null; }
    else if (t.dataset.br) { this.branch[this.tab] = t.dataset.br; this.sel = null; }
    else if (t.dataset.node) this.sel = t.dataset.node;
    this.showDetail();
    this.update(true);
  }

  /** Draw again when something it shows has changed. */
  update(force = false): void {
    const { sim } = this.c, act = sim.building('lab')?.active;
    const key = `${this.tab}|${this.sel}|${JSON.stringify(this.branch)}|${sim.era}|${sim.researched.size}|${sim.researchQueue.join()}|${act?.id}|${sim.building('lab')?.level}|${Math.floor(Object.values(sim.stock).reduce((a, b) => a + b, 0) / 5)}`;
    const changed = force || key !== this.key;
    this.key = key;
    if (!changed) return;
    if (!PILLARS.some((p) => p.id === this.tab)) this.tab = 'mil';
    const p = PILLARS.find((q) => q.id === this.tab)!;
    if (!this.branch[p.id]) this.branch[p.id] = this.branches(p)[0]?.key ?? '';
    const keep = this.main.querySelector<HTMLElement>('.rs-lane'), nav = this.main.querySelector<HTMLElement>('.rs-nav'), stg = this.main.querySelector<HTMLElement>('.rs-stages');
    const sv = [keep?.scrollTop ?? 0, nav?.scrollTop ?? 0, nav?.scrollLeft ?? 0, stg?.scrollLeft ?? 0, stg?.scrollTop ?? 0];
    this.main.dataset.pil = p.id;
    this.dialog.root.dataset.pil = p.id;
    this.main.innerHTML = `${this.tabsH()}${this.bodyH(p)}`;
    const lane = this.main.querySelector<HTMLElement>('.rs-lane'), nv = this.main.querySelector<HTMLElement>('.rs-nav'), sg = this.main.querySelector<HTMLElement>('.rs-stages');
    if (this.sel) this.showDetail();
    if (lane) lane.scrollTop = sv[0]; if (nv) { nv.scrollTop = sv[1]; nv.scrollLeft = sv[2]; } if (sg) { sg.scrollLeft = sv[3]; sg.scrollTop = sv[4]; }
    this.fit(); this.links();
  }
}
