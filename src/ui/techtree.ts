import type { BuildingKind } from '../sim/buildings';
import { workDays } from '../sim/constants';
import { RES_NAME } from '../sim/resources';
import { CHAINS, TIER_TECH_OF, statLevels, lineLevel, statBonus, STAT_DEF, LineStat, STAT_IDS, statTechId, TECH_BY_ID, Tech, TREE_ROLES } from '../sim/research';
import { WEAPONS } from '../sim/combat';
import { h, iconCanvas } from './dom';
import { dlg, GameDialog } from './gamedialog';
import { resIcon, statIcon } from './resicons';
import type { Ctx } from './ctx';

/** One square of the tree: a picture, a name and a bar of levels. `techOf` gives the research it would start next (null when finished). */
interface Node {
  el: HTMLButtonElement; bar: HTMLElement; count: HTMLElement; lock: HTMLElement;
  techOf: () => Tech | null; level: () => number; max: number; role?: string; stat?: LineStat;
}

/** The research house as a tree, like the one of a war game: areas as tabs, rows of squares joined by lines, a lock on what is not open yet. A tap on a square shows what it gives and costs; the button there starts it. */
export class TechTree {
  readonly root = h('div', { class: 'ttree' });
  private readonly dialog = new GameDialog(h('div', {}), { inside: true, onClose: () => { this.picked = null; this.showDetail(); this.update(true); } });
  private readonly body = h('div', { class: 'tbody' });
  private readonly nodes: Node[] = [];
  private picked: Node | null = null;
  private key = '';

  constructor(private readonly c: Ctx) {
    this.root.append(this.body, this.dialog.root);
  }

  /** The picture of a research that stands alone: what it opens, drawn the way the build menu draws houses. */
  private pic(kind: BuildingKind, level = 1): HTMLElement {
    const { sim, sprites } = this.c;
    try { const p = sprites.building(kind, sim.era, level, 4).frames[0]; return h('span', { class: 'tpic' }, iconCanvas(p)); } catch { return h('span', { class: 'tpic', text: '?' }); }
  }
  /** The picture on top of a column: the house of a role, or the weapon itself. */
  private headPic(def: { building?: BuildingKind; weapon?: string; tool?: string }): HTMLElement {
    if (def.tool) { const icon = this.c.sprites.icons[`${def.tool}1`]; if (icon) return h('span', { class: 'tpic' }, iconCanvas(icon)); }
    if (def.weapon) { const icon = this.c.sprites.icons[`${def.weapon}${WEAPONS[def.weapon]?.tier ?? 1}`]; if (icon) return h('span', { class: 'tpic' }, iconCanvas(icon)); }
    return this.pic(def.building ?? 'lab', 1);
  }
  private techPic(t: Tech): HTMLElement {
    const { sprites } = this.c, r = t.unlocks.recipes?.[0];
    if (r && sprites.icons[r]) return h('span', { class: 'tpic' }, iconCanvas(sprites.icons[r]));
    const lv = t.unlocks.levels; if (lv) return this.pic('storage', Math.max(...Object.values(lv) as number[]));
    if (t.unlocks.auto) return this.pic('toolstore', 2);
    if (t.unlocks.mounts) return this.pic('stable', 1);
    if (t.id.startsWith('form_') || t.id === 'signal') return this.pic('drill', 1);
    if (t.id.startsWith('scout')) return this.pic('scouttent', 1);
    return this.pic('lab', 1);
  }

  private make(pic: HTMLElement, name: string, max: number, techOf: () => Tech | null, level: () => number, extra: Partial<Node> = {}): Node {
    const bar = h('b'), count = h('small'), lock = h('span', { class: 'tlock', text: '🔒' });
    const el = h('button', { class: 'tnode', type: 'button' }, pic, h('span', { class: 'tname', text: name }), h('span', { class: 'tbar' }, bar), count, lock) as HTMLButtonElement;
    const node: Node = { el, bar, count, lock, techOf, level, max, ...extra };
    el.addEventListener('click', () => { this.picked = node; this.showDetail(); this.update(true); });
    this.nodes.push(node);
    return node;
  }

  /** Research that stands alone, laid out as pictures in one grid, the ones with fewer steps before them first (what `requires` says). */
  addSingles(title: string, techs: Tech[]): void {
    const ids = new Set(techs.map((t) => t.id)), depth = new Map<string, number>();
    const dep = (t: Tech): number => { const d = depth.get(t.id); if (d !== undefined) return d; const n = Math.max(-1, ...t.requires.filter((r) => ids.has(r)).map((r) => dep(TECH_BY_ID[r]))) + 1; depth.set(t.id, n); return n; };
    const sorted = [...techs].sort((a, b) => dep(a) - dep(b));
    this.body.append(h('section', { class: 'tsec' }, h('h3', { text: title }), h('div', { class: 'trow' }, ...sorted.map((t) => this.make(this.techPic(t), t.name.replace(/^Bản vẽ /, ''), 1, () => (this.c.sim.researched.has(t.id) ? null : t), () => (this.c.sim.researched.has(t.id) ? 1 : 0)).el))));
  }

  /** Research that comes one after another, drawn as a tree from the top down: one row for each step of the chain, joined by a short line (dựng bằng gỗ, then xây bằng đá). */
  addLadder(title: string, techs: Tech[]): void {
    const ids = new Set(techs.map((t) => t.id)), depth = new Map<string, number>();
    const dep = (t: Tech): number => { const d = depth.get(t.id); if (d !== undefined) return d; const n = Math.max(-1, ...t.requires.filter((r) => ids.has(r)).map((r) => dep(TECH_BY_ID[r]))) + 1; depth.set(t.id, n); return n; };
    const rows: Tech[][] = [];
    for (const t of techs) (rows[dep(t)] ??= []).push(t);
    const col = h('div', { class: 'tladder' });
    rows.filter(Boolean).forEach((row, i) => {
      if (i) col.append(h('span', { class: 'tlink' }));
      col.append(h('div', { class: 'tstep' }, ...row.map((t) => this.make(this.techPic(t), t.name, 1, () => (this.c.sim.researched.has(t.id) ? null : t), () => (this.c.sim.researched.has(t.id) ? 1 : 0)).el)));
    });
    this.body.append(h('section', { class: 'tsec' }, h('h3', { text: title }), col));
  }

  /** A row for each role, a square for each of the eight stats: the player picks which to raise. */
  addRoles(title: string, roles: string[]): void {
    const sec = h('section', { class: 'tsec' }, h('h3', { text: title }));
    for (const role of roles) {
      const def = TREE_ROLES[role];
      const row = h('div', { class: 'trow lines' }, ...STAT_IDS.map((stat) => {
        const pic = h('span', { class: 'tpic stat' }, statIcon(stat));
        return this.make(pic, STAT_DEF[stat].short, statLevels(stat), () => { const n = lineLevel(this.c.sim.researched, role, stat); return n >= statLevels(stat) ? null : TECH_BY_ID[statTechId(role, stat, n + 1)]; }, () => lineLevel(this.c.sim.researched, role, stat), { role, stat }).el;
      }));
      sec.append(h('div', { class: 'trole' }, h('div', { class: 'thead' }, this.headPic(def), h('b', { text: def.name })), row));
    }
    this.body.append(sec);
  }

  /** A column for each role, its stats one under the other in the order they open: each opens when the one above has reached the same level, and the first one waits for the last of the level before. */
  addChains(title: string, roles: string[], chain: string): void {
    const cols = roles.map((role) => {
      const def = TREE_ROLES[role];
      const nodes = CHAINS[chain].order.map((stat) => this.make(h('span', { class: 'tpic stat' }, statIcon(stat)), STAT_DEF[stat].short, statLevels(stat),
        () => { const n = lineLevel(this.c.sim.researched, role, stat); return n >= statLevels(stat) ? null : TECH_BY_ID[statTechId(role, stat, n + 1)]; }, () => lineLevel(this.c.sim.researched, role, stat), { role, stat }).el);
      // the last square of a column: the next tier of soldiers, open once every stat above is at the top
      const tier = CHAINS[chain].finalTier ? TIER_TECH_OF[role] : undefined;
      const last = tier ? [h('span', { class: 'tlink' }), this.make(def.weapon || !['foot', 'cavalry', 'archer', 'scout', 'tame'].includes(role) ? this.headPic(def) : h('span', { class: 'tpic stat' }, resIcon(`role_${role}`)), `Bậc ${tier.unlocks.tier!.tier}`, 1, () => (this.c.sim.researched.has(tier.id) ? null : tier), () => (this.c.sim.researched.has(tier.id) ? 1 : 0)).el] : [];
      return h('div', { class: 'tcol' }, h('div', { class: 'thead' }, this.headPic(def), h('b', { text: def.name })), ...nodes.flatMap((el, i) => (i ? [h('span', { class: 'tlink' }), el] : [el])), ...last);
    });
    this.body.append(h('section', { class: 'tsec' }, h('h3', { text: title }), h('div', { class: 'tcols' }, ...cols)));
  }

  /** The tree of the formations: a column for each (its unlock on top, then the first stats), the research shared by all of them joined below (cells), the rest of the stats, and the research shared again (squads). The parts and their order come from the chain's layout. */
  addFormations(title: string, chain: string): void {
    const def = CHAINS[chain], layout = def.layout ?? [{ stats: def.order }], { sim } = this.c;
    const link = () => h('span', { class: 'tlink' });
    const done = (t: Tech) => sim.researched.has(t.id);
    const techNode = (t: Tech) => this.make(this.techPic(t), t.name, 1, () => (done(t) ? null : t), () => (done(t) ? 1 : 0)).el;
    const stat = (role: string, s: LineStat) => this.make(h('span', { class: 'tpic stat' }, statIcon(s)), STAT_DEF[s].short, statLevels(s),
      () => { const n = lineLevel(sim.researched, role, s); return n >= statLevels(s) ? null : TECH_BY_ID[statTechId(role, s, n + 1)]; }, () => lineLevel(sim.researched, role, s), { role, stat: s }).el;
    const parts: HTMLElement[] = [];
    let first = true;
    for (const part of layout) {
      if (part.stats) {
        const head = first; first = false;
        const stats = part.stats;
        parts.push(h('div', { class: 'tcols' }, ...def.roles.map((role) => {
          const r = TREE_ROLES[role], unlock = r.needs ? TECH_BY_ID[r.needs] : null;
          const nodes = [...(head && unlock ? [techNode(unlock)] : []), ...stats.map((s) => stat(role, s))];
          return h('div', { class: 'tcol' }, ...(head ? [h('div', { class: 'thead' }, this.headPic(r), h('b', { text: r.name }))] : []), ...nodes.flatMap((el, i) => (i ? [link(), el] : [el])));
        })));
      } else if (part.techs) {
        parts.push(h('div', { class: 'tladder' }, link(), ...part.techs.flatMap((id, i) => [...(i ? [link()] : []), h('div', { class: 'tstep' }, techNode(TECH_BY_ID[id]))]), link()));
      }
    }
    this.body.append(h('section', { class: 'tsec' }, h('h3', { text: title }), ...parts));
  }

  /** The tapped square as a dialog over the tree, like a scroll: its picture and level bar, what it gives now and next, the cost as pictures, and the button. Tapping outside, or ✕, puts it away. */
  private showDetail(): void {
    const n = this.picked, { sim, toast, ctl } = this.c;
    if (!n) { this.dialog.hide(); return; }
    const t = n.techOf(), lvl = n.level(), line = !!n.role;
    const title = line ? `${STAT_DEF[n.stat!].name} · ${TREE_ROLES[n.role!].name}` : (t?.name ?? n.el.querySelector('.tname')?.textContent ?? '');
    const src = n.el.querySelector('canvas'), icon = src ? iconCanvas(src) : (n.el.querySelector('.tpic')?.cloneNode(true) as HTMLElement | null);
    const now = line ? statBonus(sim.researched, n.role!, n.stat!) : 0, next = line && t ? t.unlocks.bonus!.pct : 0;
    const head = dlg.head({ pic: icon ?? undefined, title, bar: { value: lvl, max: n.max, label: n.max > 1 ? `${lvl}/${n.max}` : lvl ? '✓' : '' }, onClose: () => { this.picked = null; this.showDetail(); this.update(true); } });
    if (!t) { this.dialog.show(dlg.card({ label: title }, head, dlg.text(line ? `Đã đạt cấp tối đa ${n.max}: ${STAT_DEF[n.stat!].name.toLowerCase()} của ${TREE_ROLES[n.role!].name.toLowerCase()} +${now}%.` : 'Nghiên cứu này đã xong.'))); return; }
    const st = sim.techState(t), busy = st.state === 'ready' && sim.currentResearch() !== null, short = st.state === 'ready' && !busy ? sim.researchShort(t) : null, block = st.state === 'queued' ? sim.researchBlock(t) : null;
    const note = busy ? 'Đợi nghiên cứu hiện tại xong' : short ?? (st.state === 'locked' ? st.why ?? '' : st.state === 'active' ? 'Đang nghiên cứu…' : st.state === 'queued' ? block ?? 'Đã trả vật liệu, chờ bắt đầu' : '');
    const btn = dlg.button({ done: '✓ Xong', active: 'Đang làm', queued: 'Hủy đơn', ready: 'Nghiên cứu', locked: 'Khóa' }[st.state],
      () => { if (st.state === 'queued') sim.unqueueResearch(t.id); else { const e = sim.queueResearch(t.id); if (e) toast(e); else this.picked = null; } ctl.onChange(); this.showDetail(); this.update(true); },
      { disabled: st.state === 'done' || st.state === 'active' || st.state === 'locked' || busy || !!short });
    const costs = (Object.keys(t.cost) as Array<keyof typeof t.cost>).filter((r) => (t.cost[r] ?? 0) > 0).map((r) => {
      const need = t.cost[r] ?? 0, have = Math.floor(sim.stock[r]);
      return dlg.cost(resIcon(r), String(need), String(have), have < need, RES_NAME[r]);
    });
    this.dialog.show(dlg.card({ label: title }, head,
      line ? dlg.line(`Hiện tại: +${now}%`, `Cấp tiếp theo: +${next}%`) : null,
      dlg.text(line ? STAT_DEF[n.stat!].about : t.desc),
      dlg.costs(...costs, dlg.cost(resIcon('clock'), workDays(t.time), null, false, 'Thời gian')),
      t.needLevel > 1 ? dlg.note(`Cần Nhà nghiên cứu cấp ${t.needLevel}`, false) : null,
      note ? dlg.note(note) : null, btn));
  }

  /** Refresh the squares (their bars and locks) every frame the panel shows; the detail only when something changed. */
  update(force = false): void {
    const { sim } = this.c, act = sim.building('lab')?.active;
    const key = `${sim.researchQueue.join()}|${act?.id}|${Math.floor((act?.progress ?? 0) * 20)}|${sim.researched.size}|${sim.building('lab')?.level}|${this.picked ? 1 : 0}|${Math.floor(Object.values(sim.stock).reduce((a, b) => a + b, 0))}`;
    if (!force && key === this.key) return;
    this.key = key;
    for (const n of this.nodes) {
      const t = n.techOf(), lvl = n.level(), st = t ? sim.techState(t).state : 'done';
      n.el.classList.toggle('locked', st === 'locked'); n.el.classList.toggle('done', st === 'done'); n.el.classList.toggle('busy', st === 'active' || st === 'queued'); n.el.classList.toggle('picked', n === this.picked);
      n.lock.hidden = st !== 'locked';
      const running = act && t && act.id === t.id ? act.progress : null;
      n.bar.style.width = `${((lvl + (running ?? 0)) / n.max) * 100}%`;
      n.count.textContent = running !== null ? `${Math.floor(running * 100)}%` : n.max > 1 ? `${lvl}/${n.max}` : st === 'done' ? '✓' : '';
    }
    if (this.picked) this.showDetail();
  }
}
