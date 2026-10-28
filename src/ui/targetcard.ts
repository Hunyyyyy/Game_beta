import { RES_NAME, Res } from '../sim/resources';
import { animalDef } from '../sim/fauna';
import { relationLabel, WEAPONS } from '../sim/combat';
import { h } from './dom';
import type { Ctx } from './ctx';

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
    this.attack.addEventListener('click', () => {
      const t = c.ctl.inspect;
      if (!t || !c.ctl.selected.size) { c.toast('Hãy chọn dân trước'); return; }
      if (!c.sim.orderAttack([...c.ctl.selected], { kind: t.kind, id: t.id })) c.toast(t.kind === 'unit' ? 'Chỉ chiến binh mới đánh: tuyển lính ở đống lửa trại' : 'Chỉ Thợ săn hoặc chiến binh mới săn thú');
      c.ctl.onChange();
    });
    this.loot.addEventListener('click', () => {
      const t = c.ctl.inspect;
      if (!t || !c.ctl.selected.size) { c.toast('Hãy chọn dân trước'); return; }
      if (!c.sim.orderLoot([...c.ctl.selected], t.id)) c.toast('Chỉ Thợ săn lột da: giao nghề Thợ săn bằng nút nghề trước');
      c.ctl.onChange();
    });
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
    this.line.innerHTML = dead ? `Còn <b>${a.meat}</b> thịt · <b>${a.hide}</b> ${RES_NAME.hide.toLowerCase()}${Object.entries(a.drops ?? {}).filter(([, n]) => (n ?? 0) > 0).map(([r, n]) => ` · <b>${n}</b> ${RES_NAME[r as Res].toLowerCase()}`).join('')}` : `Máu <b>${Math.ceil(a.hp)}/${a.maxHp}</b> · sát thương <b>${d.damage}</b> · ${d.prey ? 'con mồi' : 'thú dữ'}`;
    this.attack.hidden = dead; this.attack.textContent = d.prey ? 'Săn' : 'Tấn công'; this.loot.hidden = !dead;
  }
}

