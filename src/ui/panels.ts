import type { Sprites } from '../render/sprites';
import { animalDef } from '../sim/fauna';
import { BUILDINGS, Building, levelDef, maxLevel, needsWork } from '../sim/buildings';
import { ARMORS, CRAFTED_WEAPONS, relationLabel, WEAPONS } from '../sim/combat';
import { DAY_LENGTH } from '../sim/constants';
import { Job, JOB_NAME, JOBS, STAT_NAME, StatKey, WORK_JOBS } from '../sim/jobs';
import { RES_LIST, RES_NAME } from '../sim/resources';
import type { Sim, Villager } from '../sim/sim';
import { RESEARCH, RESEARCH_PREFIX, TECHS, techForRecipe, unlockText } from '../sim/research';
import { RECIPE_BY_ID, RECIPES, TIER_DURABILITY, TIER_NAME, TOOL_KINDS, TOOL_NAME, recipeName, recipeUse } from '../sim/tools';
import type { Controller } from './controller';
import { costText, h, iconCanvas } from './dom';

export interface Ctx { sim: Sim; ctl: Controller; sprites: Sprites; toast: (text: string) => void }

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

/** What a villager is doing, in words. */
export function describe(v: Villager): string {
  const carry = v.carry && v.carry.amount > 0 ? ` · mang ${v.carry.amount} ${RES_NAME[v.carry.res].toLowerCase()}` : '';
  let t: string;
  switch (v.phase) {
    case 'move': t = 'đang đi'; break;
    case 'goNode': t = 'đi tới nguồn'; break;
    case 'work': t = v.job !== 'idle' ? JOB_NAME[v.job].toLowerCase() : 'rảnh'; break;
    case 'goStore': t = 'mang về kho'; break;
    case 'goSite': t = 'đi tới công trường'; break;
    case 'build': t = 'đang xây'; break;
    case 'goShop': t = 'đi tới Xưởng'; break;
    case 'craft': t = v.order?.startsWith('r:') ? 'đang nghiên cứu' : 'đang chế tạo'; break;
    case 'goEquip': t = 'đi lấy đồ ở Xưởng'; break;
    case 'wait': t = 'chờ việc'; break;
    case 'goHome': t = 'về lửa trại ngủ'; break;
    case 'sleep': t = 'đang ngủ'; break;
    case 'fight': t = 'đang chiến đấu'; break;
    case 'flee': t = 'đang bỏ chạy'; break;
    case 'down': t = `bị thương, còn ${Math.ceil(v.down)} giây`; break;
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
  private readonly bFull = h('b'); private readonly bHealth = h('b'); private readonly bMorale = h('b', { class: 'mor' });
  private readonly gear = h('div', { class: 'kv' });
  private readonly stats = h('div', { class: 'kv' }); private readonly skills = h('div', { class: 'kv' }); private readonly tools = h('div', { class: 'kv' });
  private readonly jobBtns: HTMLButtonElement[]; private readonly stanceBtns: HTMLButtonElement[];
  private readonly gearBtns: Array<{ btn: HTMLButtonElement; kind: string | null; slot: 'weapon' | 'armor'; label: string }> = [];
  private readonly gearNote = h('div', { class: 'kv' });
  private statsKey = '';

  constructor(readonly root: HTMLElement, private readonly c: Ctx) {
    const { sim, ctl } = c, ids = () => [...ctl.selected];
    this.jobBtns = (['idle', ...WORK_JOBS] as Job[]).map((j) => h('button', { class: 'sm', 'data-job': j, pressed: false, text: JOB_NAME[j], onclick: () => { sim.setJob(ids(), j); ctl.onChange(); } }));
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
    // The card starts small so the map stays visible on a phone; the sections open on demand.
    const tall = innerHeight >= 560;
    root.append(
      h('div', { class: 'cardhead' }, this.name, this.state, h('button', { class: 'sm x', text: '✕', title: 'Bỏ chọn', onclick: () => ctl.clearSelection() })),
      h('div', { class: 'bars' },
        h('label', {}, 'No', h('i', {}, this.bFull)), h('label', {}, 'Máu', h('i', {}, this.bHealth)), h('label', {}, 'Tinh thần', h('i', {}, this.bMorale))),
      h('details', tall ? { class: 'fold', open: '' } : { class: 'fold' }, h('summary', { text: 'Giao nghề' }), h('div', { class: 'btns', role: 'group', 'aria-label': 'Giao nghề' }, ...this.jobBtns)),
      h('details', { class: 'fold' }, h('summary', { text: 'Chiến đấu' }), this.gear, h('p', { class: 'sub', text: 'Phát đồ (lấy từ kho Xưởng):' }), gearRow, this.gearNote,
        h('div', { class: 'btns', role: 'group', 'aria-label': 'Thế đứng' }, ...this.stanceBtns),
        h('div', { class: 'btns' },
          h('button', { class: 'sm', text: 'Giữ chỗ (H)', title: 'Đứng yên, chỉ đánh kẻ ở sát', onclick: () => { sim.orderHold(ids()); ctl.onChange(); } }),
          h('button', { class: 'sm', text: 'Dừng (G)', title: 'Hủy mọi lệnh', onclick: () => { sim.orderStop(ids()); ctl.onChange(); } }),
          h('button', { class: 'sm', text: 'Tấn công–đi (F)', title: 'Chọn một điểm: đi tới đó và đánh mọi địch gặp trên đường', onclick: () => { ctl.attackMoveArmed = true; c.toast('Chạm vào điểm đến'); ctl.onChange(); } }))),
      h('details', { class: 'fold' }, h('summary', { text: 'Chỉ số, kỹ năng, công cụ' }), this.stats, this.skills, this.tools),
    );
  }

  update(chosen: Villager[]): void {
    this.root.hidden = chosen.length === 0;
    if (!chosen.length) { this.statsKey = ''; return; }
    const sim0 = this.c.sim, v = chosen[0], w = v.weapon ? WEAPONS[v.weapon].name : 'tay không';
    this.name.textContent = chosen.length > 1 ? `${v.name} và ${chosen.length - 1} người nữa` : v.name;
    this.state.textContent = describe(v);
    this.bFull.style.width = `${v.fullness}%`; this.bHealth.style.width = `${(v.health / v.maxHealth) * 100}%`; this.bMorale.style.width = `${v.morale}%`;
    this.bHealth.className = v.health / v.maxHealth < 0.35 ? 'bad' : '';
    for (const g of this.gearBtns) { const n = g.kind ? sim0.toolCount(g.kind, g.kind === 'hide' ? 1 : WEAPONS[g.kind].tier ?? 1) : -1; g.btn.textContent = n >= 0 ? `${g.label} (${n})` : g.label; g.btn.disabled = g.kind !== null && n <= 0 && !chosen.every((o) => (g.slot === 'weapon' ? o.weapon : o.armor) === g.kind); }
    this.gearNote.textContent = chosen.every((o) => o.job === 'fight' || o.job === 'hunt') ? (chosen[0].manualGear ? 'Đồ do bạn phát: Xưởng không tự đổi.' : 'Xưởng tự phát đồ tốt nhất còn trong kho.') : 'Chỉ Chiến binh và Thợ săn cầm vũ khí đi theo; dân thường không chiến đấu mà chạy về lửa trại khi có địch.';
    this.gear.innerHTML = `Máu <b>${Math.ceil(v.health)}/${v.maxHealth}</b> · Vũ khí <b>${w}</b> · Giáp <b>${v.armor ? ARMORS[v.armor].name : '—'}</b>${v.leader ? ' · <b>Thủ lĩnh</b>' : ''}`;
    const sk = `${v.id}|${WORK_JOBS.map((j) => v.skill[j].level).join('')}|${Object.values(v.stats).join()}`;
    if (sk !== this.statsKey) {
      this.statsKey = sk;
      this.stats.innerHTML = (Object.keys(STAT_NAME) as StatKey[]).map((k) => `${STAT_NAME[k]} <b>${v.stats[k]}</b>`).join(' · ');
      this.skills.innerHTML = WORK_JOBS.map((j) => `${JOBS[j].name} <span class="stars">${stars(v.potential[j])}</span> <b>cấp ${v.skill[j].level}</b>`).join(' · ');
    }
    this.tools.innerHTML = 'Công cụ: ' + TOOL_KINDS.map((k) => { const t = v.tools[k]; return `${TOOL_NAME[k]} <b>${t ? TIER_NAME[t.tier].toLowerCase() + ' ' + Math.round((t.dur / TIER_DURABILITY[t.tier]) * 100) + '%' : '—'}</b>`; }).join(' · ');
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
export class BuildingPanel {
  private readonly title = h('b'); private readonly state = h('span');
  private readonly campfire = h('div', { class: 'sec' }); private readonly storage = h('div', { class: 'sec' }); private readonly workshop = h('div', { class: 'sec' });
  private readonly resRows: Array<{ res: typeof RES_LIST[number]; num: HTMLElement; bar: HTMLElement }> = [];
  private readonly recRows: Array<{ id: string; kind: string; tier: number; have: HTMLElement; row: HTMLElement; lock: HTMLElement; btns: HTMLButtonElement[] }> = [];
  private readonly techRows: Array<{ id: string; row: HTMLElement; btn: HTMLButtonElement; note: HTMLElement }> = [];
  private readonly move = h('button', { class: 'sm', text: 'Dời' }); private readonly demolish = h('button', { class: 'sm danger', text: 'Phá bỏ' });
  private readonly researchSec = h('div');
  private shopTab: 'tools' | 'weapons' | 'armor' | 'research' = 'tools';
  private readonly shopPages = {} as Record<'tools' | 'weapons' | 'armor' | 'research', HTMLElement>;
  private readonly shopTabBtns = {} as Record<'tools' | 'weapons' | 'armor' | 'research', HTMLButtonElement>;
  private armed = 0; private armedFor = -1;
  private readonly villagerList = h('div'); private villagerKey = ''; private readonly vRows = new Map<number, { st: HTMLElement; hp: HTMLElement }>();
  private readonly pop = h('div', { class: 'kv' }); private readonly shopInfo = h('div', { class: 'kv' }); private readonly assign = h('button', { class: 'sm', text: 'Giao dân đang chọn làm Chế tạo' }); private readonly assignR = h('button', { class: 'sm', text: 'Giao dân đang chọn làm Nghiên cứu' }); private readonly active = h('div', { class: 'kv' });
  private readonly info = h('div', { class: 'kv' }); private readonly next = h('div', { class: 'kv' }); private readonly upgrade = h('button', { class: 'sm primary' });

  constructor(readonly root: HTMLElement, private readonly c: Ctx) {
    const { sim, ctl, sprites } = c;
    // campfire: the village's people
    this.campfire.append(this.pop, h('div', { class: 'btns' }, h('button', { class: 'sm', text: 'Chọn tất cả dân', onclick: () => { ctl.selected.clear(); ctl.selectAll(); ctl.closeBuilding(); } })), this.villagerList);
    // storage: stock against capacity
    for (const res of RES_LIST) {
      const num = h('b'), bar = h('b');
      this.resRows.push({ res, num, bar });
      this.storage.append(h('div', { class: 'row' }, h('div', { class: 'nm' }, RES_NAME[res], h('small', {}, num)), h('div', { class: 'bars', style: 'width:90px;display:block' }, h('i', {}, bar))));
    }
    // workshop: what can be made
    const section = (page: HTMLElement, list: typeof RECIPES) => {
      for (const r of list) {
        const have = h('span', { class: 'have' }), lock = h('small', { class: 'lock' });
        const minus = h('button', { class: 'sm', text: '−', title: 'Bớt một đơn', onclick: () => { sim.unqueueCraft(r.id); ctl.onChange(); } });
        const plus = h('button', { class: 'sm', text: '+', title: 'Thêm một đơn vào hàng đợi', onclick: () => { const e = sim.queueCraft(r.id); if (e) c.toast(e); ctl.onChange(); } });
        const row = h('div', { class: 'rec' }, iconCanvas(sprites.icons[r.id]),
          h('div', { class: 'nm' }, recipeName(r), h('small', {}, `${costText(r.cost, RES_NAME)} · ${r.time} giây chuẩn · ${recipeUse(r)}`), lock),
          h('div', { class: 'qty' }, have, minus, plus));
        this.recRows.push({ id: r.id, kind: r.kind, tier: r.tier, have, row, lock, btns: [minus, plus] });
        page.append(row);
      }
    };
    // research: each step opens recipes or building levels
    this.shopPages.research = this.researchSec;
    this.researchSec.append(h('div', { class: 'sub', text: 'Nghiên cứu: dân làm nghề Nghiên cứu, cần đủ Trí tuệ, tốn nguyên liệu và thời gian' }));
    for (const t of TECHS) {
      const note = h('small', { class: 'lock' }), btn = h('button', { class: 'sm' });
      btn.addEventListener('click', () => {
        const st = sim.techState(t).state;
        if (st === 'queued') sim.unqueueCraft(RESEARCH_PREFIX + t.id);
        else { const e = sim.queueCraft(RESEARCH_PREFIX + t.id); if (e) c.toast(e); }
        ctl.onChange();
      });
      const row = h('div', { class: 'tech' }, h('div', { class: 'nm' }, t.name, h('small', {}, `${t.desc} Mở: ${unlockText(t, (id) => { const r = RECIPE_BY_ID[id]; return r ? recipeName(r) : id; })}.`), h('small', {}, `${costText(t.cost, RES_NAME)} · ${t.time} giây · Trí tuệ ≥ ${t.minInt}${t.needLevel > 1 ? ` · Xưởng cấp ${t.needLevel}` : ''}`), note), btn);
      this.techRows.push({ id: t.id, row, btn, note });
      this.researchSec.append(row);
    }
    for (const k of ['tools', 'weapons', 'armor'] as const) this.shopPages[k] = h('div');
    const tabBar = h('div', { class: 'btns tabs', role: 'tablist' });
    for (const [k, label] of [['tools', 'Công cụ'], ['weapons', 'Vũ khí'], ['armor', 'Áo giáp'], ['research', 'Nghiên cứu']] as const) {
      const btn = h('button', { class: 'sm', text: label, role: 'tab', onclick: () => { this.shopTab = k; this.update(); } });
      this.shopTabBtns[k] = btn; tabBar.append(btn);
    }
    this.workshop.append(this.shopInfo, h('div', { class: 'btns' }, this.assign, this.assignR), this.active, tabBar, this.shopPages.tools, this.shopPages.weapons, this.shopPages.armor, this.shopPages.research);
    this.assign.addEventListener('click', () => { const b = this.current(); if (b && ctl.selected.size) { sim.orderWork([...ctl.selected], b.x, b.y); c.toast('Chế tạo'); ctl.onChange(); } else c.toast('Hãy chọn dân trước'); });
    this.assignR.addEventListener('click', () => { if (ctl.selected.size) { sim.setJob([...ctl.selected], 'research'); c.toast('Nghiên cứu'); ctl.onChange(); } else c.toast('Hãy chọn dân trước'); });
    section(this.shopPages.tools, RECIPES.filter((r) => ['axe', 'pick', 'hoe', 'hammer'].includes(r.kind)));
    section(this.shopPages.weapons, RECIPES.filter((r) => r.kind in WEAPONS));
    section(this.shopPages.armor, RECIPES.filter((r) => r.kind === 'hide'));
    this.upgrade.addEventListener('click', () => { const b = this.current(); if (!b) return; const err = sim.upgradeBuilding(b.id); c.toast(err ?? 'Đã trả vật liệu. Giao Thợ xây để nâng cấp'); ctl.onChange(); });
    root.append(
      h('div', { class: 'cardhead' }, this.title, this.state, h('button', { class: 'sm x', text: '✕', onclick: () => ctl.closeBuilding() })),
      this.info, this.campfire, this.storage, this.workshop, this.next, this.upgrade,
      h('div', { class: 'btns' }, this.move, this.demolish),
    );
    this.move.addEventListener('click', () => { const b = this.current(); if (b) ctl.startMoving(b.id); });
    this.demolish.addEventListener('click', () => {
      const b = this.current(); if (!b) return;
      if (this.armedFor === b.id && performance.now() < this.armed) { const e = sim.demolishBuilding(b.id); c.toast(e ?? 'Đã phá bỏ công trình'); this.armedFor = -1; ctl.closeBuilding(); return; }
      this.armedFor = b.id; this.armed = performance.now() + 4000; this.update();
    });
  }

  private current(): Building | undefined { const id = this.c.ctl.selectedBuilding; return id === null ? undefined : this.c.sim.getBuilding(id); }

  update(): void {
    const { sim, ctl } = this.c, b = this.current();
    this.root.hidden = !b;
    if (!b) { if (ctl.selectedBuilding !== null) ctl.selectedBuilding = null; return; }
    const def = BUILDINGS[b.kind], lv = levelDef(b), top = maxLevel(b.kind, b.era);
    this.title.textContent = `${def.name}${def.buildable ? ` · cấp ${b.level}/${top} (${lv.name.toLowerCase()})` : ''}`;
    this.state.textContent = !b.done ? `đang xây ${Math.floor(b.progress * 100)}%` : b.upgrading ? `đang nâng cấp ${Math.floor(b.progress * 100)}%` : 'đang dùng';
    const ready = b.done;
    this.campfire.hidden = !(ready && b.kind === 'campfire'); this.storage.hidden = !(ready && b.kind === 'storage'); this.workshop.hidden = !(ready && b.kind === 'workshop');
    this.info.textContent = !b.done ? 'Giao dân làm Thợ xây để dựng công trình này.' : b.kind === 'workshop' ? `Tốc độ chế tác ×${lv.craftSpeed.toLocaleString('vi')}` : b.kind === 'storage' ? `Sức chứa ${lv.cap} mỗi loại` : `Nơi dân ngủ quanh lửa · chứa ${lv.cap} mỗi loại`;
    if (b.kind === 'campfire' && ready) this.updateCampfire();
    if (b.kind === 'storage' && ready) for (const r of this.resRows) { r.num.textContent = `${Math.floor(sim.stock[r.res])} / ${sim.capacity()}`; r.bar.style.width = `${Math.min(100, (sim.stock[r.res] / Math.max(1, sim.capacity())) * 100)}%`; }
    if (b.kind === 'workshop' && ready) {
      for (const r of this.recRows) {
        const open = sim.recipeOpen(r.id);
        r.have.textContent = open ? `kho ${sim.toolCount(r.kind, r.tier)} · đợi ${sim.craftQueue.filter((id) => id === r.id).length}` : '';
        r.row.classList.toggle('locked', !open);
        r.lock.textContent = sim.recipeLock(r.id) ?? '';
        for (const btn of r.btns) btn.disabled = !open;
      }
      if (!RESEARCH.enabled && this.shopTab === 'research') this.shopTab = 'tools';
      this.shopTabBtns.research.hidden = !RESEARCH.enabled;
      for (const k of Object.keys(this.shopPages) as Array<keyof typeof this.shopPages>) { this.shopPages[k].hidden = k !== this.shopTab; this.shopTabBtns[k].setAttribute('aria-pressed', String(k === this.shopTab)); }
      for (const r of this.techRows) {
        const t = TECHS.find((x) => x.id === r.id)!, st = sim.techState(t);
        r.row.classList.toggle('locked', st.state === 'locked'); r.row.classList.toggle('done', st.state === 'done');
        r.note.textContent = st.state === 'locked' ? (st.why ?? '') : st.state === 'active' ? 'Thợ đang nghiên cứu…' : st.state === 'queued' ? 'Đang chờ thợ nhận (tốn nguyên liệu khi bắt đầu)' : st.state === 'done' ? 'Đã nghiên cứu' : '';
        r.btn.textContent = { done: '✓ Xong', active: 'Đang làm', queued: 'Hủy đơn', ready: 'Nghiên cứu', locked: 'Khóa' }[st.state];
        r.btn.disabled = st.state === 'done' || st.state === 'active' || st.state === 'locked';
      }
      const crafters = sim.villagers.filter((v) => v.job === 'craft').length, thinkers = sim.villagers.filter((v) => v.job === 'research').length;
      this.shopInfo.textContent = `Chế tạo: ${crafters} người · Nghiên cứu: ${thinkers} người · hàng đợi ${sim.craftQueue.length} · Xưởng cấp ${b.level} (×${lv.craftSpeed.toLocaleString('vi')} tốc độ). Thiếu người làm nghề nào thì việc đó đứng yên.`;
      const busy = sim.villagers.filter((v) => v.order && (v.phase === 'craft' || v.phase === 'goShop'));
      this.active.innerHTML = busy.length ? 'Đang làm: ' + busy.map((v) => {
        const d = sim.orderDef(v.order!)!, kind = v.order!.startsWith('r:') ? 'research' : 'craft';
        const rate = sim.workRate(v, kind) * lv.craftSpeed, left = Math.max(0, Math.ceil(((1 - v.progress) * d.time) / Math.max(0.05, rate)));
        const nm = v.order!.startsWith('r:') ? TECHS.find((t) => t.id === v.order!.slice(2))?.name ?? '' : recipeName(RECIPE_BY_ID[v.order!]);
        return `${v.name}: ${nm} <b>${Math.floor(v.progress * 100)}%</b>${v.phase === 'craft' ? ` · còn ~${left} giây` : ' · đang tới Xưởng'}`;
      }).join(' · ') : '';
      this.active.hidden = !busy.length;
      this.assign.disabled = this.assignR.disabled = ctl.selected.size === 0;
    }
    this.move.hidden = this.demolish.hidden = !def.buildable;
    const arm = this.armedFor === b.id && performance.now() < this.armed;
    this.demolish.textContent = arm ? `Bấm lại để phá (thu ${costText(sim.salvage(b), RES_NAME)})` : 'Phá bỏ';
    this.demolish.classList.toggle('armed', arm);
    this.move.textContent = b.done && Object.keys(sim.moveFee(b)).length ? `Dời (${costText(sim.moveFee(b), RES_NAME)})` : 'Dời';
    const grow = b.level < top && def.buildable && b.done;
    this.upgrade.hidden = !grow; this.next.hidden = !grow;
    if (grow) {
      const nx = levelDef(b, b.level + 1), why = sim.canUpgrade(b);
      this.next.textContent = `Cấp ${b.level + 1} (${nx.name.toLowerCase()}): ${b.kind === 'workshop' ? `chế tác ×${nx.craftSpeed.toLocaleString('vi')}` : `chứa ${nx.cap} mỗi loại`}`;
      this.upgrade.textContent = b.upgrading ? 'Đang nâng cấp…' : `Nâng cấp · ${costText(nx.cost, RES_NAME)}`;
      this.upgrade.disabled = !!why; this.upgrade.title = why ?? '';
      if (why && why !== 'Đang nâng cấp') this.next.textContent += ` · ${why}`;
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
        return h('div', { class: 'vrow', onclick: () => { ctl.selected.clear(); ctl.selected.add(v.id); ctl.selectedBuilding = null; ctl.focusSelection(); ctl.onChange(); } },
          h('div', {}, h('b', { text: v.name }), ' ', st), hp);
      }));
    }
    for (const v of vs) { const r = this.vRows.get(v.id); if (r) { r.st.textContent = `· ${describe(v)}`; r.hp.textContent = `${Math.ceil(v.health)}/${v.maxHealth}`; } }
  }
}

void DAY_LENGTH; void needsWork;
