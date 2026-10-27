import type { Sprites } from '../render/sprites';
import { animalDef } from '../sim/fauna';
import { BUILDINGS, Building, levelDef, maxLevel, needsWork } from '../sim/buildings';
import { ARMORS, ArmorDef, CRAFTED_WEAPONS, relationLabel, WEAPONS } from '../sim/combat';
import { DAY_LENGTH, gameDays } from '../sim/constants';
import { Job, JOB_NAME, JOBS, STAT_NAME, StatKey, WORK_JOBS, WorkJob } from '../sim/jobs';
import { BARTER, RES_LIST, RES_NAME } from '../sim/resources';
import type { Sim, Villager } from '../sim/sim';
import type { BuildingKind } from '../sim/buildings';
import { autoOn, TECHS, unlockText } from '../sim/research';
import { RECIPE_BY_ID, RECIPES, TIER_DURABILITY, TIER_NAME, TOOL_KINDS, TOOL_NAME, TOOL_OF_JOB, ToolKind, recipeName, recipeUse } from '../sim/tools';
import type { Controller } from './controller';
import { costText, h, hint, iconCanvas } from './dom';

export interface Ctx { sim: Sim; ctl: Controller; sprites: Sprites; toast: (text: string) => void }

/** How well armour protects: the average of what it takes off a pierce, slash and crush blow (0..1). */
const armorLevel = (a: ArmorDef) => (a.pierce + a.slash + a.crush) / 3;
/** A full bar is armour that stops half of every blow. */
const ARMOR_FULL = 0.5;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const armorText = (a: ArmorDef, named = true) => `${named ? `${a.name}: ` : ''}giảm sát thương đâm ${pct(a.pierce)} · chém ${pct(a.slash)} · đập ${pct(a.crush)}`;

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

/** Why a villager who was given a job is standing about, when it can be said. */
function waitReason(v: Villager, sim: Sim): string | null {
  const j = v.job;
  if (j === 'build') return sim.buildings.some(needsWork) ? null : 'chờ: chưa có công trường nào cần xây';
  if (j === 'wood' || j === 'stone' || j === 'food') {
    const res = JOBS[j].res!;
    if (!v.carry && sim.stock[res] >= sim.capacity(res)) return `chờ: kho đầy ${RES_NAME[res].toLowerCase()}, hãy nâng cấp Kho`;
    return 'chờ: chưa thấy nguồn nào gần đó, hãy khám phá thêm';
  }
  return null;
}

/** What a villager is doing, in words. */
export function describe(v: Villager, sim?: Sim): string {
  const carry = v.carry && v.carry.amount > 0 ? ` · mang ${v.carry.amount} ${RES_NAME[v.carry.res].toLowerCase()}` : '';
  let t: string;
  switch (v.phase) {
    case 'move': t = 'đang đi'; break;
    case 'goNode': t = 'đi tới nguồn'; break;
    case 'work': t = v.job !== 'idle' ? JOB_NAME[v.job].toLowerCase() : 'rảnh'; break;
    case 'goStore': t = 'mang về kho'; break;
    case 'goSite': t = 'đi tới công trường'; break;
    case 'build': t = 'đang xây'; break;
    case 'goStaff': t = 'đi vào nhà làm việc'; break;
    case 'inside': t = `đang ${JOBS[v.job as 'craft'].name.toLowerCase()} trong nhà`; break;
    case 'goOrder': t = v.order?.startsWith('repair') ? 'đem đồ hỏng đi sửa' : 'đi đặt chế tạo'; break;
    case 'goEquip': t = 'đi lấy đồ ở kho'; break;
    case 'wait': t = (sim && waitReason(v, sim)) || 'chờ việc'; break;
    case 'goHome': t = 'về lửa trại ngủ'; break;
    case 'sleep': t = 'đang ngủ'; break;
    case 'fight': t = 'đang chiến đấu'; break;
    case 'flee': t = 'đang bỏ chạy'; break;
    case 'down': t = `bị thương, còn ${gameDays(v.down)}`; break;
    case 'goCarcass': t = 'đi lột da'; break;
    case 'skin': t = 'đang lột da'; break;
    case 'rescue': t = 'chạy đi cứu bạn'; break;
    default: t = v.job === 'idle' ? 'rảnh' : v.job === 'fight' ? 'canh gác' : 'chờ việc';
  }
  return t + carry;
}

const STANCES = [['aggressive', 'Chủ động', 'Đuổi địch trong tầm nhìn'], ['defensive', 'Phòng thủ', 'Chỉ đánh địch lại gần, không rời chỗ'], ['retreat', 'Rút lui', 'Không đánh, chạy về lửa trại']] as const;

// ================================================================== selected villagers
export class UnitCard {
  private readonly name = h('b'); private readonly state = h('span');
  private readonly dname = h('b'); private readonly dstate = h('span');
  private readonly bars: Array<{ full: HTMLElement; health: HTMLElement; morale: HTMLElement; armor: HTMLElement; armorLabel: HTMLElement }> = [];
  private readonly gear = h('div', { class: 'kv' });
  private readonly stats = h('div', { class: 'kv' }); private readonly skills = h('div', { class: 'kv' });
  private readonly toolRows: Array<{ k: ToolKind; row: HTMLElement; state: HTMLElement; give: Array<{ btn: HTMLButtonElement; tier: number }>; back: HTMLButtonElement; repair: HTMLButtonElement; drop: HTMLButtonElement }> = [];
  private combatSec!: HTMLElement; private gearSec!: HTMLElement; private toolsSec!: HTMLElement;
  private readonly jobBtns: HTMLButtonElement[]; private readonly stanceBtns: HTMLButtonElement[];
  private readonly gearBtns: Array<{ btn: HTMLButtonElement; kind: string | null; slot: 'weapon' | 'armor'; label: string }> = [];
  private gearTip!: HTMLElement;
  private statsKey = '';
  private open = false;

  /** `root` is the small card over the map; `modal` is the full-screen page with everything about the chosen villagers. */
  constructor(readonly root: HTMLElement, private readonly c: Ctx, private readonly modal: HTMLElement) {
    const { sim, ctl } = c, ids = () => [...ctl.selected];
    const makeBars = () => {
      const full = h('b'), health = h('b'), morale = h('b', { class: 'mor' }), armor = h('b', { class: 'arm' });
      const armorLabel = h('label', {}, 'Giáp', h('i', {}, armor));
      this.bars.push({ full, health, morale, armor, armorLabel });
      return h('div', { class: 'bars' }, h('label', {}, 'No', h('i', {}, full)), h('label', {}, 'Máu', h('i', {}, health)), h('label', {}, 'Tinh thần', h('i', {}, morale)), armorLabel);
    };
    this.jobBtns = (['idle', ...WORK_JOBS] as Job[]).map((j) => h('button', { class: 'sm', 'data-job': j, pressed: false, text: JOB_NAME[j], onclick: () => { const e = sim.setJob(ids(), j); if (e) c.toast(e); ctl.onChange(); } }));
    this.stanceBtns = STANCES.map(([s, label, tip]) => h('button', { class: 'sm', 'data-stance': s, pressed: false, text: label, title: tip, onclick: () => { sim.setStance(ids(), s); ctl.onChange(); } }));
    // Handing out gear from the workshop's stock: soldiers carry what they are given
    const gearRow = h('div', { class: 'btns', role: 'group', 'aria-label': 'Phát đồ' });
    const addGear = (label: string, kind: string | null, slot: 'weapon' | 'armor', title: string) => {
      const btn = h('button', { class: 'sm', title, onclick: () => { const e = sim.assignGear(ids(), kind, slot); if (e) c.toast(e); ctl.onChange(); } });
      this.gearBtns.push({ btn, kind, slot, label }); gearRow.append(btn);
    };
    for (const id of CRAFTED_WEAPONS) addGear(WEAPONS[id].name, id, 'weapon', `Phát ${WEAPONS[id].name.toLowerCase()} từ kho Xưởng cho dân đang chọn`);
    addGear('Áo da', 'hide', 'armor', 'Phát áo da từ kho Xưởng');
    addGear('Trả vũ khí', null, 'weapon', 'Trả vũ khí về kho Xưởng'); addGear('Trả giáp', null, 'armor', 'Trả giáp về kho Xưởng');
    gearRow.append(h('button', { class: 'sm', text: 'Tự nhận đồ', title: 'Để Xưởng tự phát và đổi đồ cho người này (khi làm Chiến binh hoặc Thợ săn)', onclick: () => { sim.autoGear(ids()); ctl.onChange(); } }));

    const gearHint = hint(h('p', { class: 'sub', text: 'Phát đồ (lấy từ kho Xưởng):' }), '');
    this.gearTip = gearHint.tip;

    // tools: handed out of the stock, mended or thrown away by hand
    const toolsSec = h('section', {}, hint('Công cụ', 'Mỗi nghề dùng một công cụ (đốn gỗ: rìu, thợ đá: cuốc chim, hái lượm: cuốc, thợ xây: búa) và mỗi dân chỉ cầm một công cụ. Đổi nghề thì công cụ trả về kho, giữ nguyên độ bền. "Đi sửa": dân tự mang công cụ tới Nhà sửa chữa, sửa xong được trả lại. Sau khi nghiên cứu "tự lấy đồ" và có Kho công cụ, dân thiếu hoặc hỏng đồ sẽ tự đi lấy.'));
    for (const k of TOOL_KINDS) {
      const state = h('small'), give = [1, 2].map((tier) => ({ tier, btn: h('button', { class: 'sm', onclick: () => { const e = sim.assignTool(ids(), k, tier); if (e) c.toast(e); ctl.onChange(); } }) as HTMLButtonElement }));
      const back = h('button', { class: 'sm', text: 'Trả kho', title: 'Trả công cụ về kho, giữ nguyên độ bền', onclick: () => { sim.assignTool(ids(), k, 0); ctl.onChange(); } }) as HTMLButtonElement;
      const repair = h('button', { class: 'sm', text: 'Đi sửa', title: 'Dân mang công cụ tới Nhà sửa chữa', onclick: () => { const e = sim.repairTool(ids(), k); if (e) c.toast(e); ctl.onChange(); } }) as HTMLButtonElement;
      const drop = h('button', { class: 'sm', text: 'Bỏ', title: 'Vứt công cụ, kể cả khi chưa hỏng', onclick: () => { sim.discardTool(ids(), k); ctl.onChange(); } }) as HTMLButtonElement;
      const row = h('div', { class: 'row' }, h('div', { class: 'nm' }, TOOL_NAME[k], state), h('div', { class: 'btns' }, ...give.map((g) => g.btn), back, repair, drop));
      this.toolRows.push({ k, row, state, give, back, repair, drop });
      toolsSec.append(row);
    }
    // the small card: who, how they are, and a way into the details
    root.append(
      h('div', { class: 'cardhead' }, this.name, this.state, h('button', { class: 'sm x', text: '✕', title: 'Bỏ chọn', onclick: () => ctl.clearSelection() })),
      makeBars(),
      h('div', { class: 'btns' }, h('button', { class: 'sm primary', text: 'Giao việc và chi tiết', onclick: () => { this.open = true; this.update(this.chosen()); } })),
    );
    // the full page
    modal.append(
      h('div', { class: 'cardhead' }, this.dname, this.dstate, h('button', { class: 'x', text: '✕ Đóng', onclick: () => this.closeDetail() })),
      h('div', { class: 'mbody cols' },
        h('section', {}, h('h3', { text: 'Tình trạng' }), makeBars(), this.gear),
        h('section', {}, h('h3', { text: 'Giao nghề' }), h('div', { class: 'btns', role: 'group', 'aria-label': 'Giao nghề' }, ...this.jobBtns)),
        this.combatSec = h('section', {}, h('h3', { text: 'Chiến đấu' }),
          h('div', { class: 'btns', role: 'group', 'aria-label': 'Thế đứng' }, ...this.stanceBtns),
          h('div', { class: 'btns' },
            h('button', { class: 'sm', text: 'Giữ chỗ (H)', title: 'Đứng yên, chỉ đánh kẻ ở sát', onclick: () => { sim.orderHold(ids()); ctl.onChange(); } }),
            h('button', { class: 'sm', text: 'Dừng (G)', title: 'Hủy mọi lệnh', onclick: () => { sim.orderStop(ids()); ctl.onChange(); } }),
            h('button', { class: 'sm', text: 'Tấn công–đi (F)', title: 'Chọn một điểm: đi tới đó và đánh mọi địch gặp trên đường', onclick: () => { ctl.attackMoveArmed = true; this.closeDetail(); c.toast('Chạm vào điểm đến'); ctl.onChange(); } })),
        ),
        this.gearSec = h('section', {}, h('h3', { text: 'Trang bị' }), gearHint, gearRow),
        this.toolsSec = toolsSec,
        h('section', {}, h('h3', { text: 'Chỉ số và kỹ năng' }), this.stats, this.skills),
      ),
    );
  }

  private chosen(): Villager[] { const { sim, ctl } = this.c; return sim.villagers.filter((v) => ctl.selected.has(v.id)); }
  closeDetail(): void { this.open = false; this.modal.hidden = true; }

  update(chosen: Villager[]): void {
    const sim0 = this.c.sim;
    this.root.hidden = chosen.length === 0;
    if (!chosen.length) { this.statsKey = ''; this.closeDetail(); return; }
    this.modal.hidden = !this.open;
    const v = chosen[0], w = v.weapon ? WEAPONS[v.weapon].name : 'tay không';
    const title = chosen.length > 1 ? `${v.name} và ${chosen.length - 1} người nữa` : v.name;
    this.name.textContent = this.dname.textContent = title;
    this.state.textContent = this.dstate.textContent = describe(v, sim0);
    for (const b of this.bars) {
      b.full.style.width = `${v.fullness}%`; b.health.style.width = `${(v.health / v.maxHealth) * 100}%`; b.morale.style.width = `${v.morale}%`;
      b.health.className = v.health / v.maxHealth < 0.35 ? 'bad' : '';
      const ad = v.armor ? ARMORS[v.armor] : null;
      b.armor.style.width = `${ad ? Math.min(100, (armorLevel(ad) / ARMOR_FULL) * 100) : 0}%`;
      b.armorLabel.title = ad ? armorText(ad) : 'Không mặc giáp';
    }
    if (!this.open) return;
    for (const g of this.gearBtns) { const n = g.kind ? sim0.toolCount(g.kind, g.kind === 'hide' ? 1 : WEAPONS[g.kind].tier ?? 1) : -1; g.btn.textContent = n >= 0 ? `${g.label} (${n})` : g.label; g.btn.disabled = g.kind !== null && n <= 0 && !chosen.every((o) => (g.slot === 'weapon' ? o.weapon : o.armor) === g.kind); }
    this.gearTip.textContent = chosen.every((o) => o.job === 'fight' || o.job === 'hunt') ? (chosen[0].manualGear ? 'Đồ do bạn phát: Xưởng không tự đổi.' : 'Xưởng tự phát đồ tốt nhất còn trong kho.') : 'Chỉ Chiến binh và Thợ săn cầm vũ khí đi theo; dân thường không chiến đấu mà chạy về lửa trại khi có địch.';
    this.gear.innerHTML = `Máu <b>${Math.ceil(v.health)}/${v.maxHealth}</b> · Vũ khí <b>${w}</b> · Giáp <b>${v.armor ? ARMORS[v.armor].name : '—'}</b>${v.armor ? ` (${armorText(ARMORS[v.armor], false)})` : ''}${v.leader ? ' · <b>Thủ lĩnh</b>' : ''}`;
    const sk = `${v.id}|${WORK_JOBS.map((j) => v.skill[j].level).join('')}|${Object.values(v.stats).join()}`;
    if (sk !== this.statsKey) {
      this.statsKey = sk;
      this.stats.innerHTML = (Object.keys(STAT_NAME) as StatKey[]).map((k) => `${STAT_NAME[k]} <b>${v.stats[k]}</b>`).join(' · ');
      this.skills.innerHTML = WORK_JOBS.map((j) => `${JOBS[j].name} <span class="stars">${stars(v.potential[j])}</span> <b>cấp ${v.skill[j].level}</b>`).join(' · ');
    }
    // the tool follows the job: only the one the chosen villagers use is offered
    const kinds = new Set(chosen.map((o) => TOOL_OF_JOB[o.job as WorkJob] ?? null)), only = kinds.size === 1 ? [...kinds][0] : null;
    this.toolsSec.hidden = only === null;
    this.combatSec.hidden = !chosen.every((o) => o.job === 'fight'); // only soldiers get fighting orders
    this.gearSec.hidden = !chosen.every((o) => o.job === 'fight' || o.job === 'hunt');
    for (const r of this.toolRows) {
      r.row.hidden = r.k !== only;
      const t = v.tools[r.k];
      r.state.textContent = t ? (t.dur <= 0 ? `${TIER_NAME[t.tier].toLowerCase()} · đã hỏng` : `${TIER_NAME[t.tier].toLowerCase()} · còn ${Math.round((t.dur / TIER_DURABILITY[t.tier]) * 100)}%`) : 'tay không';
      for (const g of r.give) { const n = sim0.toolCount(r.k, g.tier); g.btn.textContent = `${TIER_NAME[g.tier]} (${n})`; g.btn.disabled = n <= 0; }
      r.repair.disabled = !t || t.dur >= TIER_DURABILITY[t.tier] - 1e-6; r.back.disabled = r.drop.disabled = !t;
    }
    this.jobBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((o) => o.job === b.dataset.job))));
    this.stanceBtns.forEach((b) => b.setAttribute('aria-pressed', String(chosen.every((o) => o.stance === b.dataset.stance))));
  }
}

// ================================================================== a foe, an animal or a carcass that was tapped
export class TargetCard {
  private readonly name = h('b'); private readonly info = h('span'); private readonly hp = h('b', { class: 'bad' }); private readonly line = h('div', { class: 'kv' });
  private readonly attack = h('button', { class: 'sm primary', text: 'Tấn công' }); private readonly loot = h('button', { class: 'sm', text: 'Lột da, lấy thịt' });
  constructor(readonly root: HTMLElement, private readonly c: Ctx) {
    root.append(
      h('div', { class: 'cardhead' }, this.name, this.info, h('button', { class: 'sm x', text: '✕', onclick: () => { c.ctl.inspect = null; c.ctl.onChange(); } })),
      h('div', { class: 'bars' }, h('label', {}, 'Máu', h('i', {}, this.hp))), this.line,
      h('div', { class: 'btns' }, this.attack, this.loot),
    );
    this.attack.addEventListener('click', () => { const t = c.ctl.inspect; if (t && c.ctl.selected.size) { c.sim.orderAttack([...c.ctl.selected], { kind: t.kind, id: t.id }); c.ctl.onChange(); } else c.toast('Hãy chọn dân trước'); });
    this.loot.addEventListener('click', () => { const t = c.ctl.inspect; if (t && c.ctl.selected.size) { c.sim.orderLoot([...c.ctl.selected], t.id); c.ctl.onChange(); } else c.toast('Hãy chọn dân trước'); });
  }

  update(): void {
    const t = this.c.ctl.inspect, { sim } = this.c;
    if (!t) { this.root.hidden = true; return; }
    if (t.kind === 'unit') {
      const f = sim.get(t.id);
      if (!f || f.health <= 0) { this.c.ctl.inspect = null; this.root.hidden = true; return; }
      const tribe = sim.tribes.find((x) => x.id === f.team);
      this.root.hidden = false;
      this.name.textContent = f.name; this.info.textContent = `${tribe?.def.name ?? ''} · ${f.ai?.role === 'civ' ? 'dân thường' : f.ai?.role === 'raider' ? 'kẻ tập kích' : 'chiến binh'}`;
      this.hp.style.width = `${(f.health / f.maxHealth) * 100}%`;
      this.line.innerHTML = `Máu <b>${Math.ceil(f.health)}/${f.maxHealth}</b> · Vũ khí <b>${f.weapon ? WEAPONS[f.weapon].name : 'tay không'}</b> · Tinh thần <b>${Math.round(f.morale)}</b> · ${tribe ? `quan hệ <b>${relationLabel(tribe.relation)}</b>` : ''}`;
      this.attack.hidden = false; this.loot.hidden = true;
      return;
    }
    const a = sim.animalById.get(t.id);
    if (!a) { this.c.ctl.inspect = null; this.root.hidden = true; return; }
    const d = animalDef(a), dead = a.state === 'dead';
    this.root.hidden = false;
    this.name.textContent = d.name; this.info.textContent = dead ? 'xác' : { graze: 'đang gặm cỏ', wander: 'đang đi', flee: 'đang chạy trốn', attack: 'đang tấn công', sleep: 'đang ngủ', dead: 'xác' }[a.state];
    this.hp.style.width = `${(Math.max(0, a.hp) / a.maxHp) * 100}%`;
    this.line.innerHTML = dead ? `Còn <b>${a.meat}</b> thịt · <b>${a.hide}</b> da và xương` : `Máu <b>${Math.ceil(a.hp)}/${a.maxHp}</b> · sát thương <b>${d.damage}</b> · ${d.prey ? 'con mồi' : 'thú dữ'}`;
    this.attack.hidden = dead; this.attack.textContent = d.prey ? 'Săn' : 'Tấn công'; this.loot.hidden = !dead;
  }
}

// ================================================================== a building tapped on the map or chosen from the menu
/** The villagers working inside a house: names, a way out, and a list to choose who goes in next. */
class StaffBox {
  readonly root = h('section', {});
  private readonly head = h('h3'); private readonly list = h('div'); private readonly picker = h('div', { class: 'picker' });
  private key = ''; private pickKey = ''; private open = false;
  private readonly add: HTMLButtonElement;
  constructor(private readonly c: Ctx, private readonly job: 'craft' | 'research' | 'repair') {
    this.add = h('button', { class: 'sm primary', onclick: () => { this.open = !this.open; this.pickKey = ''; c.ctl.onChange(); } }) as HTMLButtonElement;
    this.root.append(hint(this.head, 'Dân vào trong nhà làm việc, không hiện trên bản đồ và không bị tấn công. Bạn chọn ai vào: bấm "Thêm người" rồi chọn trong danh sách.'), this.list, h('div', { class: 'btns' }, this.add), this.picker);
  }
  update(b: Building): void {
    const { sim } = this.c, slots = levelDef(b).slots, stat = JOBS[this.job].stat;
    const staff = b.staff.map((id) => sim.get(id)).filter((v): v is Villager => !!v), full = sim.staffCount(b) >= slots;
    this.head.textContent = `Người làm việc (${sim.staffCount(b)}/${slots}) · nâng cấp nhà để chứa thêm`;
    this.add.disabled = full && !this.open;
    this.add.textContent = this.open ? 'Xong' : `Thêm người ${JOB_NAME[this.job].toLowerCase()}`;
    const key = staff.map((v) => `${v.id}.${v.stats[stat]}`).join();
    if (key !== this.key) {
      this.key = key;
      this.list.replaceChildren(...(staff.length ? staff.map((v) => h('div', { class: 'row' },
        h('div', { class: 'nm' }, v.name, h('small', { text: `${STAT_NAME[stat]} ${v.stats[stat]} · ${JOBS[this.job].name} cấp ${v.skill[this.job].level}` })),
        h('button', { class: 'sm', text: 'Cho ra', onclick: () => { sim.releaseStaff([v.id]); this.c.ctl.onChange(); } }))) : [h('p', { class: 'sub', text: 'Chưa có ai làm việc ở đây.' })]));
    }
    // the choice is the player's: every villager who could go in, best at the job first
    this.picker.hidden = !this.open;
    if (!this.open) return;
    const pool = sim.villagers.filter((v) => v.inside === null && v.down <= 0 && !(v.phase === 'goStaff' && v.target === b.id)).sort((x, y) => y.stats[stat] - x.stats[stat]);
    const pk = `${full}|${pool.map((v) => `${v.id}.${v.job}.${v.stats[stat]}`).join()}`;
    if (pk === this.pickKey) return;
    this.pickKey = pk;
    this.picker.replaceChildren(h('p', { class: 'sub', text: full ? 'Nhà đã đủ người: cho một người ra hoặc nâng cấp nhà.' : `Chọn ai vào làm ${JOB_NAME[this.job].toLowerCase()}:` }),
      ...pool.map((v) => h('div', { class: 'row' },
        h('div', { class: 'nm' }, v.name, h('small', { text: `${STAT_NAME[stat]} ${v.stats[stat]} · đang ${JOB_NAME[v.job].toLowerCase()}` })),
        h('button', { class: 'sm', text: 'Vào làm', disabled: full, onclick: () => { const e = sim.assignStaff([v.id], this.job); this.c.toast(e ?? `${v.name}: ${JOB_NAME[this.job]}`); this.c.ctl.onChange(); } }))));
  }
}

/** What the house is working on right now, with a bar and the time left. */
class ActiveBox {
  readonly root = h('div', { class: 'kv' }); private readonly bar = h('b'); private readonly text = h('span');
  constructor(private readonly c: Ctx, private readonly nameOf: (id: string) => string, private readonly timeOf: (id: string) => number) {
    this.root.append(h('div', { class: 'bars', style: 'width:100%;grid-template-columns:1fr' }, h('label', {}, this.text, h('i', {}, this.bar))));
  }
  update(b: Building): void {
    const a = b.active;
    this.root.hidden = false;
    if (!a) { this.text.textContent = 'Đang rảnh'; this.bar.style.width = '0%'; return; }
    const rate = this.c.sim.houseRate(b), left = rate > 0 ? ((1 - a.progress) * this.timeOf(a.id)) / rate : 0;
    this.text.textContent = `Đang làm: ${this.nameOf(a.id)} · ${Math.floor(a.progress * 100)}%${rate > 0 ? ` · còn ~${gameDays(left)}` : ' · tạm dừng (không có người)'}`;
    this.bar.style.width = `${a.progress * 100}%`;
  }
}

export class BuildingPanel {
  private readonly title = h('b'); private readonly state = h('span');
  /** Every building shows its parts as pages behind a row of tab buttons at the top. */
  private readonly tabs = {} as Record<BuildingKind, Array<{ label: string; page: HTMLElement }>>;
  private readonly tabBar = h('div', { class: 'btns tabs', role: 'tablist' });
  private readonly tabAt: Partial<Record<BuildingKind, number>> = {};
  private readonly pages: HTMLElement[] = []; private tabKey = '';
  private readonly resRows: Array<{ res: typeof RES_LIST[number]; num: HTMLElement; bar: HTMLElement }> = [];
  private readonly barterBtns: Array<{ res: Exclude<typeof RES_LIST[number], 'coin'>; btn: HTMLButtonElement }> = [];
  private readonly recRows: Array<{ id: string; kind: string; tier: number; have: HTMLElement; row: HTMLElement; lock: HTMLElement; btns: HTMLButtonElement[] }> = [];
  private readonly techRows: Array<{ id: string; row: HTMLElement; btn: HTMLButtonElement; note: HTMLElement }> = [];
  private readonly goodRows: Array<{ id: string; num: HTMLElement; row: HTMLElement }> = [];
  private readonly villagerList = h('div'); private villagerKey = ''; private readonly vRows = new Map<number, { st: HTMLElement; hp: HTMLElement }>();
  private readonly pop = h('div', { class: 'kv' });
  private readonly info = h('div', { class: 'kv' });
  private readonly staffBoxes: Record<'craft' | 'research' | 'repair', StaffBox>;
  private readonly activeBoxes: Record<'craft' | 'research' | 'repair', ActiveBox>;
  private readonly queueNote = { craft: h('div', { class: 'kv' }), research: h('div', { class: 'kv' }), repair: h('div', { class: 'kv' }) };
  private readonly goodsNote = h('p', { class: 'sub' }); private readonly goodsHint = hint(this.goodsNote, '');
  private readonly toolList = h('div'); private toolKey = '';
  private readonly repairInfo = h('div', { class: 'kv' });

  constructor(readonly root: HTMLElement, private readonly c: Ctx) {
    const { sim, ctl, sprites } = c;
    root.className = 'modal';
    const recipeNm = (id: string) => (RECIPE_BY_ID[id] ? recipeName(RECIPE_BY_ID[id]) : id);
    this.staffBoxes = { craft: new StaffBox(c, 'craft'), research: new StaffBox(c, 'research'), repair: new StaffBox(c, 'repair') };
    this.activeBoxes = {
      craft: new ActiveBox(c, recipeNm, (id) => sim.orderDef('craft', id)?.time ?? 1),
      research: new ActiveBox(c, (id) => TECHS.find((t) => t.id === id)?.name ?? id, (id) => sim.orderDef('research', id)?.time ?? 1),
      repair: new ActiveBox(c, (id) => `sửa ${recipeNm(id).toLowerCase()}`, (id) => sim.orderDef('repair', id)?.time ?? 1),
    };

    const page = (...kids: Array<HTMLElement | null>) => { const el = h('div', { class: 'tabpage', hidden: true }, ...kids); this.pages.push(el); return el; };

    // campfire: the village's people, and trading
    const barter = () => {
      const box = h('div', {}, hint('Đổi chác', 'Đổi hàng lấy tiền để trả cho nghiên cứu. Tiền cũng nhặt được khi hái lượm và nhận từ bộ tộc cống nạp.'));
      const btns = h('div', { class: 'btns' }); box.append(btns);
      for (const res of RES_LIST) {
        if (res === 'coin') continue;
        const btn = h('button', { class: 'sm', onclick: () => { const e = sim.barter(res); if (e) c.toast(e); ctl.onChange(); } }) as HTMLButtonElement;
        this.barterBtns.push({ res, btn }); btns.append(btn);
      }
      return box;
    };
    this.tabs.campfire = [
      { label: 'Dân', page: page(this.pop, h('div', { class: 'btns' }, h('button', { class: 'sm', text: 'Chọn tất cả dân', onclick: () => { ctl.selected.clear(); ctl.selectAll(); ctl.closeBuilding(); } })), this.villagerList) },
      { label: 'Đổi chác', page: page(barter()) },
    ];

    // storage: stock against capacity, and trading goods for money
    const stockRows: HTMLElement[] = [];
    for (const res of RES_LIST) {
      const num = h('b'), bar = h('b');
      this.resRows.push({ res, num, bar });
      stockRows.push(h('div', { class: 'row' }, h('div', { class: 'nm' }, RES_NAME[res], h('small', {}, num)), h('div', { class: 'bars', style: 'width:90px;display:block' }, h('i', {}, bar))));
    }
    this.tabs.storage = [{ label: 'Tài nguyên', page: page(...stockRows) }, { label: 'Đổi chác', page: page(barter()) }];

    // craft house: what is being made, then one tab for each kind of blueprint
    const section = (el: HTMLElement, list: typeof RECIPES) => {
      for (const r of list) {
        const have = h('span', { class: 'have' }), lock = h('small', { class: 'lock' });
        const minus = h('button', { class: 'sm', text: '−', title: 'Bớt một đơn', onclick: () => { sim.unqueueCraft(r.id); ctl.onChange(); } }) as HTMLButtonElement;
        const plus = h('button', { class: 'sm', text: '+', title: 'Thêm một đơn vào hàng đợi', onclick: () => { const e = sim.queueCraft(r.id); if (e) c.toast(e); ctl.onChange(); } }) as HTMLButtonElement;
        const row = h('div', { class: 'rec' }, iconCanvas(sprites.icons[r.id]),
          h('div', { class: 'nm' }, recipeName(r), h('small', {}, `${costText(r.cost, RES_NAME)} · ${gameDays(r.time)} · ${recipeUse(r)}`), lock),
          h('div', { class: 'qty' }, have, minus, plus));
        this.recRows.push({ id: r.id, kind: r.kind, tier: r.tier, have, row, lock, btns: [minus, plus] });
        el.append(row);
      }
      return el;
    };
    const shop = (list: typeof RECIPES) => section(page(hint('Chế tạo theo bản vẽ', 'Chỉ chế được món đã có bản vẽ ở Nhà nghiên cứu và đủ cấp Nhà chế tạo. Sản phẩm vào Kho công cụ hoặc Kho vũ khí.')), list);
    this.tabs.workshop = [
      { label: 'Đang làm', page: page(this.staffBoxes.craft.root, h('h3', { text: 'Đang chế tạo' }), this.activeBoxes.craft.root, this.queueNote.craft) },
      { label: 'Công cụ', page: shop(RECIPES.filter((r) => ['axe', 'pick', 'hoe', 'hammer'].includes(r.kind))) },
      { label: 'Vũ khí', page: shop(RECIPES.filter((r) => r.kind in WEAPONS)) },
      { label: 'Áo giáp', page: shop(RECIPES.filter((r) => r.kind === 'hide')) },
    ];

    // research house: who works, then the blueprints and the other steps
    const groups: Array<[string, (id: string) => boolean]> = [
      ['Bản vẽ công cụ', (id) => /^(axe|pick|hoe|hammer)\d$/.test(id)],
      ['Bản vẽ vũ khí, giáp', (id) => /^(club|spear|mace|hide)\d$/.test(id)],
      ['Xây dựng', (id) => ['timber', 'masonry', 'tool_store', 'armory'].includes(id)],
      ['Tự động hóa', (id) => id.startsWith('auto_')],
    ];
    this.tabs.lab = [{ label: 'Đang làm', page: page(this.staffBoxes.research.root, hint('Đang nghiên cứu', 'Mỗi lần chỉ nghiên cứu một thứ. Mỗi công cụ, vũ khí, giáp chỉ có MỘT bản vẽ, nâng dần theo cấp. Bấm nghiên cứu là trả ngay vật liệu và tiền (hủy đơn thì được trả lại). Cần rất nhiều thời gian và người thông minh trong nhà: càng nhiều và càng thông minh càng nhanh.'), this.activeBoxes.research.root, this.queueNote.research) }];
    for (const [title, test] of groups) {
      const el = page();
      for (const t of TECHS.filter((x) => test(x.id))) {
        const note = h('small', { class: 'lock' }), btn = h('button', { class: 'sm' }) as HTMLButtonElement;
        btn.addEventListener('click', () => {
          const st = sim.techState(t).state;
          if (st === 'queued') sim.unqueueResearch(t.id);
          else { const e = sim.queueResearch(t.id); if (e) c.toast(e); }
          ctl.onChange();
        });
        const row = h('div', { class: 'tech' }, h('div', { class: 'nm' }, t.name, h('small', {}, `${t.desc} Mở: ${unlockText(t, recipeNm)}.`), h('small', {}, `${costText(t.cost, RES_NAME)} · ${gameDays(t.time)} · Trí tuệ ≥ ${t.minInt}${t.needLevel > 1 ? ` · nhà cấp ${t.needLevel}` : ''}`), note), btn);
        this.techRows.push({ id: t.id, row, btn, note });
        el.append(row);
      }
      this.tabs.lab.push({ label: title, page: el });
    }

    // repair house
    this.tabs.repair = [
      { label: 'Đang làm', page: page(this.staffBoxes.repair.root, h('h3', { text: 'Đang sửa' }), this.activeBoxes.repair.root, this.queueNote.repair, this.repairInfo) },
      { label: 'Công cụ của dân', page: page(hint('Công cụ của dân', '"Đi sửa": dân mang công cụ đã mòn tới Nhà sửa chữa, tốn nửa nguyên liệu và mất 1,5 lần thời gian chế (công cụ đá lâu hơn công cụ gỗ). Sửa xong công cụ được trả lại cho đúng người đó; trong lúc chờ họ làm việc tay không. Cũng có thể vứt bỏ, kể cả khi chưa hỏng.'), this.toolList) },
    ];

    // tool store and armoury: what is kept
    const goods = page(this.goodsHint);
    const goodsRows = (cat: 'tool' | 'gear') => RECIPES.filter((r) => (cat === 'gear') === isGearKind(r.kind));
    for (const r of [...goodsRows('tool'), ...goodsRows('gear')]) {
      const num = h('b'), row = h('div', { class: 'rec' }, iconCanvas(sprites.icons[r.id]), h('div', { class: 'nm' }, recipeName(r), h('small', { text: recipeUse(r) })), h('div', { class: 'qty' }, num));
      this.goodRows.push({ id: r.id, num, row }); goods.append(row);
    }
    this.tabs.toolstore = this.tabs.armory = [{ label: 'Kho', page: goods }];

    root.append(
      h('div', { class: 'cardhead' }, this.title, this.state, h('button', { class: 'x', text: '✕ Đóng', onclick: () => ctl.closePanel() })),
      h('div', { class: 'mbody' }, this.info, this.tabBar, ...this.pages),
    );
  }

  /** Show the tab buttons of the building and the page of the chosen one. */
  private showTabs(kind: BuildingKind, ready: boolean): void {
    const tabs = ready ? this.tabs[kind] ?? [] : [];
    const key = `${kind}:${tabs.length}`;
    if (key !== this.tabKey) {
      this.tabKey = key;
      this.tabBar.replaceChildren(...tabs.map((t, i) => h('button', { class: 'sm', text: t.label, role: 'tab', onclick: () => { this.tabAt[kind] = i; this.showTabs(kind, true); } })));
    }
    const at = Math.min(this.tabAt[kind] ?? 0, Math.max(0, tabs.length - 1));
    this.tabBar.hidden = tabs.length < 2;
    [...this.tabBar.children].forEach((el, i) => el.setAttribute('aria-pressed', String(i === at)));
    for (const p of this.pages) p.hidden = tabs[at]?.page !== p;
  }

  private current(): Building | undefined { const id = this.c.ctl.selectedBuilding; return id === null ? undefined : this.c.sim.getBuilding(id); }

  private infoText(b: Building): string {
    const lv = levelDef(b);
    switch (b.kind) {
      case 'workshop': return `Cấp ${b.level}: chứa ${lv.slots} người chế tạo · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'lab': return `Cấp ${b.level}: chứa ${lv.slots} nhà nghiên cứu · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'repair': return `Cấp ${b.level}: chứa ${lv.slots} thợ sửa · tốc độ ×${lv.craftSpeed.toLocaleString('vi')}`;
      case 'storage': return `Sức chứa ${lv.cap} mỗi loại`;
      case 'toolstore': case 'armory': return `Chứa tối đa ${lv.cap} món`;
      default: return `Nơi dân ngủ quanh lửa · chứa ${lv.cap} mỗi loại`;
    }
  }

  update(): void {
    const { sim, ctl } = this.c, b = this.current();
    this.root.hidden = !b || !ctl.buildingOpen;
    if (!b) { if (ctl.selectedBuilding !== null) ctl.selectedBuilding = null; return; }
    if (!ctl.buildingOpen) return;
    const def = BUILDINGS[b.kind], lv = levelDef(b), top = maxLevel(b.kind, b.era), ready = b.done;
    this.title.textContent = `${def.name}${def.buildable ? ` · cấp ${b.level}/${top} (${lv.name.toLowerCase()})` : ''}`;
    this.state.textContent = !b.done ? `đang xây ${Math.floor(b.progress * 100)}%` : b.upgrading ? `đang nâng cấp ${Math.floor(b.progress * 100)}%` : 'đang dùng';
    this.showTabs(b.kind, ready);
    this.info.textContent = !b.done ? 'Giao dân làm Thợ xây để dựng công trình này.' : this.infoText(b);
    if (b.kind === 'campfire' && ready) this.updateCampfire();
    if (b.kind === 'storage' && ready) for (const r of this.resRows) { r.num.textContent = `${Math.floor(sim.stock[r.res])} / ${sim.capacity()}`; r.bar.style.width = `${Math.min(100, (sim.stock[r.res] / Math.max(1, sim.capacity())) * 100)}%`; }
    if ((b.kind === 'storage' || b.kind === 'campfire') && ready) for (const t of this.barterBtns) { t.btn.textContent = `Đổi ${BARTER[t.res]} ${RES_NAME[t.res].toLowerCase()} → 1 ${RES_NAME.coin.toLowerCase()}`; t.btn.disabled = sim.stock[t.res] < BARTER[t.res]; }
    if (b.kind === 'workshop' && ready) this.updateWorkshop(b);
    if (b.kind === 'lab' && ready) this.updateLab(b);
    if (b.kind === 'repair' && ready) this.updateRepair(b);
    if (b.kind === 'toolstore' || b.kind === 'armory') if (ready) this.updateGoods(b);
  }

  private updateWorkshop(b: Building): void {
    const { sim } = this.c;
    this.staffBoxes.craft.update(b); this.activeBoxes.craft.update(b);
    this.queueNote.craft.textContent = `Hàng đợi ${sim.craftQueue.length}: ${sim.craftQueue.map((id) => recipeName(RECIPE_BY_ID[id]).toLowerCase()).join(', ') || 'trống'} · Kho công cụ ${sim.storeUsed('tool')}/${sim.storeCap('tool')} · Kho vũ khí ${sim.storeUsed('gear')}/${sim.storeCap('gear')}`;
    for (const r of this.recRows) {
      const lock = sim.recipeLock(r.id);
      r.have.textContent = lock ? '' : `kho ${sim.toolCount(r.kind, r.tier)} · đợi ${sim.craftQueue.filter((id) => id === r.id).length}`;
      r.row.classList.toggle('locked', !!lock); r.lock.textContent = lock ?? '';
      for (const btn of r.btns) btn.disabled = !!lock;
    }
  }

  private updateLab(b: Building): void {
    const { sim } = this.c;
    this.staffBoxes.research.update(b); this.activeBoxes.research.update(b);
    const waiting = sim.researchQueue[0];
    this.queueNote.research.textContent = `${waiting ? `Chờ bắt đầu: ${TECHS.find((t) => t.id === waiting)?.name ?? waiting}` : 'Mỗi lần chỉ nghiên cứu một thứ'} · Người giỏi nhất trong nhà: Trí tuệ ${sim.bestIntInside(b)}`;
    for (const r of this.techRows) {
      const t = TECHS.find((x) => x.id === r.id)!, st = sim.techState(t), block = st.state === 'queued' ? sim.researchBlock(t) : null;
      r.row.classList.toggle('locked', st.state === 'locked'); r.row.classList.toggle('done', st.state === 'done');
      const busy = st.state === 'ready' && sim.currentResearch() !== null, short = st.state === 'ready' && !busy ? sim.researchShort(t) : null;
      r.note.textContent = busy ? 'Đợi nghiên cứu hiện tại xong' : short ? short : st.state === 'locked' ? (st.why ?? '') : st.state === 'active' ? 'Đang nghiên cứu…' : st.state === 'queued' ? (block ?? 'Đã trả vật liệu, chờ bắt đầu') : st.state === 'done' ? 'Đã nghiên cứu' : '';
      r.btn.textContent = { done: '✓ Xong', active: 'Đang làm', queued: 'Hủy đơn', ready: 'Nghiên cứu', locked: 'Khóa' }[st.state];
      r.btn.disabled = st.state === 'done' || st.state === 'active' || st.state === 'locked' || busy || !!short;
    }
  }

  private updateRepair(b: Building): void {
    const { sim, ctl } = this.c;
    this.staffBoxes.repair.update(b); this.activeBoxes.repair.update(b);
    this.queueNote.repair.textContent = `Hàng đợi sửa ${sim.repairQueue.length}: ${sim.repairQueue.map((id) => recipeName(RECIPE_BY_ID[id]).toLowerCase()).join(', ') || 'trống'}`;
    this.repairInfo.textContent = '';
    const rows: Array<{ v: Villager; k: ToolKind; t: NonNullable<Villager['tools'][ToolKind]> }> = [];
    for (const v of sim.villagers) for (const k of TOOL_KINDS) { const t = v.tools[k]; if (t) rows.push({ v, k, t }); }
    const key = rows.map((r) => `${r.v.id}${r.k}${r.t.tier}${Math.ceil((r.t.dur / TIER_DURABILITY[r.t.tier]) * 10)}`).join();
    if (key === this.toolKey) return;
    this.toolKey = key;
    this.toolList.replaceChildren(...(rows.length ? rows.map(({ v, k, t }) => {
      const pct = Math.round((t.dur / TIER_DURABILITY[t.tier]) * 100), whole = pct >= 100;
      return h('div', { class: 'row' },
        h('div', { class: 'nm' }, `${v.name}: ${TOOL_NAME[k]} ${TIER_NAME[t.tier].toLowerCase()}`, h('small', { text: t.dur <= 0 ? 'đã hỏng' : `còn ${pct}% độ bền` })),
        h('div', { class: 'btns' },
          h('button', { class: 'sm', text: 'Đi sửa', disabled: whole || v.phase === 'goOrder', onclick: () => { const e = sim.repairTool([v.id], k); if (e) this.c.toast(e); ctl.onChange(); } }),
          h('button', { class: 'sm', text: 'Bỏ', onclick: () => { sim.discardTool([v.id], k); ctl.onChange(); } })));
    }) : [h('p', { class: 'sub', text: 'Chưa có dân nào cầm công cụ.' })]));
  }

  private updateGoods(b: Building): void {
    const { sim } = this.c, cat = b.kind === 'toolstore' ? 'tool' : 'gear';
    this.goodsNote.textContent = `Đang chứa ${sim.storeUsed(cat)}/${sim.storeCap(cat)} món`;
    this.goodsHint.tip.textContent = autoOn(sim.researched, 'fetch') ? 'Dân thiếu đồ hoặc đồ hỏng sẽ tự tới lấy.' : 'Chưa nghiên cứu "Tự lấy đồ trong kho": hãy phát đồ bằng tay ở thẻ dân.';
    for (const r of this.goodRows) {
      const rc = RECIPE_BY_ID[r.id], mine = (cat === 'gear') === isGearKind(rc.kind), n = sim.toolCount(rc.kind, rc.tier);
      r.row.hidden = !mine || (n === 0 && !!sim.recipeLock(r.id)); r.num.textContent = `× ${n}`;
    }
  }

  private updateCampfire(): void {
    const { sim, ctl } = this.c, vs = sim.villagers;
    this.pop.innerHTML = `Dân <b>${vs.length}</b> · đang làm việc <b>${vs.filter((v) => v.job !== 'idle').length}</b> · lính <b>${vs.filter((v) => v.job === 'fight').length}</b> · thợ săn <b>${vs.filter((v) => v.job === 'hunt').length}</b> · thức ăn <b>${Math.floor(sim.stock.food)}</b> (sống được ~${(sim.stock.food / Math.max(1, vs.length * 5)).toFixed(1)} ngày)`;
    const key = vs.map((v) => v.id).join();
    if (key !== this.villagerKey) {
      this.villagerKey = key; this.vRows.clear();
      this.villagerList.replaceChildren(...vs.map((v) => {
        const st = h('small'), hp = h('small');
        this.vRows.set(v.id, { st, hp });
        return h('div', { class: 'vrow', onclick: () => { if (v.inside !== null) { ctl.selectBuilding(v.inside, true); return; } ctl.selected.clear(); ctl.selected.add(v.id); ctl.selectedBuilding = null; ctl.focusSelection(); ctl.onChange(); } },
          h('div', {}, h('b', { text: v.name }), ' ', st), hp);
      }));
    }
    for (const v of vs) { const r = this.vRows.get(v.id); if (r) { r.st.textContent = `· ${describe(v, sim)}`; r.hp.textContent = `${Math.ceil(v.health)}/${v.maxHealth}`; } }
  }
}

const isGearKind = (k: string) => k in WEAPONS || k === 'hide';

void DAY_LENGTH; void needsWork;
