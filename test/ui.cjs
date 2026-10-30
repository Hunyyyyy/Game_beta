// UI regression test in a real browser: mouse on a desktop, touch on a landscape phone.
// Run after `npm run build`:  node test/ui.cjs
const { chromium } = require('playwright');

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const url = 'file://' + process.cwd() + '/dist/index.html';

/** Screen position (page coordinates) of a point in the world, in tiles. */
const screenOf = (p, x, y) => p.evaluate(([x, y]) => { const g = window.__game, q = g.renderer.worldToScreen(x * 32, y * 32), b = document.getElementById('view').getBoundingClientRect(); return { x: b.left + q.x, y: b.top + q.y }; }, [x, y]);
const bodyOf = (p, id) => p.evaluate((id) => { const g = window.__game, v = g.sim.get(id), q = g.renderer.worldToScreen(v.x * 32, v.y * 32 - 16), b = document.getElementById('view').getBoundingClientRect(); return { x: b.left + q.x, y: b.top + q.y }; }, id);
const state = (p, fn, arg) => p.evaluate(fn, arg);
const shown = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getBoundingClientRect().width > 0; }, sel);
/** Open or close the menu the way a player would: ☰ to open, ✕ to close. */
const menuTo = async (p, open, touch = false) => {
  if ((await shown(p, '#drawer')) === open) return;
  if (open) await (touch ? p.tap('#btnMenu') : p.click('#btnMenu')); else await p.click('#drawerTabs button:last-child');
  await p.waitForTimeout(150);
};
const pressText = (p, text) => p.evaluate((t) => { for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === t && b.offsetParent !== null) { b.click(); return true; } return false; }, text);
/** A clear patch of grass near the village, revealed, daytime, villagers fed: the stage for fights. */
const prepare = (p) => p.evaluate(() => {
  const g = window.__game, s = g.sim, c = { x: s.world.start.x + 10, y: s.world.start.y + 8 };
  s.speed = 0; s.fog.state.fill(2); s.fog.version++; s.time = 240 * 0.3; s.villagers.forEach((v) => { });
  for (let y = c.y - 9; y <= c.y + 9; y++) for (let x = c.x - 9; x <= c.x + 9; x++) { const i = y * s.world.size + x; s.world.tiles[i] = 0; s.world.nodes.delete(i); s.world.occ[i] = 0; }
  g.ctl.centerOn(c.x * 32, c.y * 32); return c;
});

(async () => {
  const browser = await chromium.launch(), errs = [];
  const watch = (p) => { p.on('pageerror', (e) => errs.push('PAGE ' + e)); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); }); };

  // ============================================================ desktop
  {
    const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); watch(p);
    await p.goto(url); await p.waitForTimeout(500);
    const c = await prepare(p);
    const ids = await state(p, () => window.__game.sim.villagers.map((v) => v.id));
    await state(p, ([ids, c]) => { const s = window.__game.sim; ids.forEach((id, i) => { const v = s.get(id); v.x = c.x - 2 + i * 1.5; v.y = c.y + 0.5; v.path = []; v.phase = 'idle'; }); }, [ids, c]);
    await p.waitForTimeout(200);

    // select by clicking
    let b = await bodyOf(p, ids[0]);
    await p.mouse.click(b.x, b.y); await p.waitForTimeout(150);
    ok(await state(p, () => window.__game.ctl.selected.size) === 1 && await shown(p, '#ucard'), 'left click on a villager selects them and shows the card');
    // the villager's details are a full-screen page
    ok(await pressText(p, 'Giao việc và chi tiết'), 'the small card has a button for the details');
    await p.waitForTimeout(150);
    ok(await shown(p, '#udetail') && await p.evaluate(() => { const r = document.getElementById('udetail').getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; }), 'the details fill the whole screen');
    await p.evaluate(() => { for (const b of document.querySelectorAll('#udetail [data-job="wood"]')) b.click(); });
    ok(await state(p, (id) => window.__game.sim.get(id).job, ids[0]) === 'wood', 'a job can be given from the details page');
    await p.waitForTimeout(250);
    ok(await state(p, () => window.__game.ctl.selected.size) === 0 && !(await shown(p, '#udetail')), 'giving a job lets the villager go: nobody stays chosen');
    ok(await p.evaluate(() => ![...document.querySelectorAll('#udetail [data-job]')].some((b) => ['craft', 'research', 'repair', 'build'].includes(b.dataset.job))), 'builder, crafter, researcher and mender are not jobs to hand out from the villager page');
    await state(p, (id) => { const g = window.__game; g.ctl.selected.add(id); g.ctl.onChange(); }, ids[0]);
    await p.waitForTimeout(250);
    await pressText(p, 'Giao việc và chi tiết'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => { const vis = (t) => [...document.querySelectorAll('#udetail h3')].some((h) => h.textContent === t && h.offsetParent !== null); return !vis('Chiến đấu') && !vis('Trang bị') && vis('Công cụ'); }), 'a woodcutter sees tools, but no fighting orders or gear');
    ok(await p.evaluate(() => { const g = window.__game, id = [...g.ctl.selected][0]; const sim = g.sim; sim.setJob([id], 'fight'); g.ctl.onChange(); return true; }), 'turn the villager into a soldier');
    await p.waitForTimeout(250);
    ok(await p.evaluate(() => { const vis = (t) => [...document.querySelectorAll('#udetail h3')].some((h) => h.textContent === t && h.offsetParent !== null); return vis('Chiến đấu') && vis('Trang bị') && !vis('Công cụ'); }), 'a soldier sees fighting orders and gear, and no tools');
    await pressText(p, '✕ Đóng'); await p.waitForTimeout(100);
    ok(!(await shown(p, '#udetail')) && await shown(p, '#ucard'), 'closing the details returns to the map');
    await p.mouse.click(60, 300); await p.waitForTimeout(100);
    ok(await state(p, () => window.__game.ctl.selected.size) === 0, 'left click on empty ground deselects');
    // multi-select
    await p.click('#btnMulti');
    b = await bodyOf(p, ids[0]); await p.mouse.click(b.x, b.y);
    b = await bodyOf(p, ids[1]); await p.mouse.click(b.x, b.y);
    ok(await state(p, () => window.__game.ctl.selected.size) === 2, '"Chọn nhiều": clicking adds villagers one by one');
    await p.click('#btnNone');
    const a = await bodyOf(p, ids[0]), z = await bodyOf(p, ids[2]);
    await p.mouse.move(a.x - 30, a.y - 40); await p.mouse.down(); await p.mouse.move(z.x + 30, z.y + 40, { steps: 6 }); await p.mouse.up();
    ok(await state(p, () => window.__game.ctl.selected.size) === 3, '"Chọn nhiều": dragging a box selects everyone inside');
    await p.click('#btnMulti'); await p.click('#btnNone');

    // right button: a drag moves the map, a plain click gives an order
    b = await bodyOf(p, ids[0]); await p.mouse.click(b.x, b.y);
    const cam0 = await state(p, () => ({ x: window.__game.cam.x, y: window.__game.cam.y }));
    await p.mouse.move(700, 300); await p.mouse.down({ button: 'right' }); await p.mouse.move(600, 260, { steps: 6 }); await p.mouse.up({ button: 'right' });
    const cam1 = await state(p, () => ({ x: window.__game.cam.x, y: window.__game.cam.y }));
    ok(cam1.x > cam0.x + 20 && cam1.y > cam0.y + 10, 'holding the right button and dragging moves the map');
    ok(await state(p, () => window.__game.ctl.selected.size) === 1 && await state(p, (id) => window.__game.sim.get(id).phase, ids[0]) === 'idle', 'the drag gave no order and kept the selection');
    const dest = await screenOf(p, c.x + 5, c.y + 3);
    await p.mouse.click(dest.x, dest.y, { button: 'right' }); await p.waitForTimeout(150);
    ok(await state(p, (id) => window.__game.sim.get(id).phase, ids[0]) === 'move', 'a plain right click sends the villager there');

    // double click selects the same job on screen
    await state(p, (ids) => { const s = window.__game.sim; s.setJob([ids[0], ids[1]], 'wood'); window.__game.ctl.clearSelection(); }, ids);
    await p.waitForTimeout(500); // let the last click age, or it counts as the first half of a double click
    b = await bodyOf(p, ids[0]); await p.mouse.dblclick(b.x, b.y); await p.waitForTimeout(150);
    const sel2 = await state(p, () => [...window.__game.ctl.selected].length);
    ok(sel2 === 2, 'double click selects every villager with the same job');

    // keys (fighting orders only reach soldiers)
    await state(p, (ids) => { window.__game.sim.setJob([ids[0], ids[1]], 'fight'); window.__game.ctl.onChange(); }, ids); await p.waitForTimeout(150);
    await p.keyboard.press('e'); ok(await state(p, () => window.__game.sim.speed) === 2, 'E sets speed 2x'); await p.keyboard.press('q');
    await p.keyboard.press('h'); ok(await state(p, (id) => window.__game.sim.get(id).fight.mode, ids[0]) === 'hold', 'H holds position');
    await p.keyboard.press('g');
    await p.keyboard.press('f'); ok(await state(p, () => window.__game.ctl.attackMoveArmed), 'F arms attack-move');
    const am = await screenOf(p, c.x + 4, c.y); await p.mouse.click(am.x, am.y); await p.waitForTimeout(100);
    ok(await state(p, (id) => window.__game.sim.get(id).fight.mode, ids[0]) === 'attackMove', 'the next click sends them attack-moving');
    await p.keyboard.press('Escape');

    // a foe: right click attacks it
    const foe = await state(p, ([ids, c]) => { const s = window.__game.sim, t = s.tribes.find((x) => x.id === 'axe'); t.relation = -60; const f = s.get(t.unitIds.find((u) => s.get(u).ai.role === 'guard')); f.x = c.x + 6; f.y = c.y + 0.5; f.path = []; f.ai.camp = { x: f.x, y: f.y }; s.get(ids[0]).weapon = 'mace'; return f.id; }, [ids, c]);
    await state(p, (ids) => { window.__game.ctl.clearSelection(); window.__game.ctl.selected.add(ids[0]); window.__game.ctl.onChange(); }, ids);
    await p.waitForTimeout(150);
    const fp = await state(p, (id) => { const g = window.__game, f = g.sim.get(id), q = g.renderer.worldToScreen(f.x * 32, f.y * 32 - 16), b = document.getElementById('view').getBoundingClientRect(); return { x: b.left + q.x, y: b.top + q.y }; }, foe);
    await p.mouse.click(fp.x, fp.y, { button: 'right' }); await p.waitForTimeout(150);
    ok(await state(p, ([id, foe]) => { const v = window.__game.sim.get(id); return v.job === 'fight' && v.fight.target && v.fight.target.id === foe; }, [ids[0], foe]), 'right click on an enemy orders an attack on it');
    await p.mouse.click(fp.x, fp.y); await p.waitForTimeout(100);
    ok(await shown(p, '#tcard'), 'left click on an enemy opens the target card');

    // menu
    await menuTo(p, true); ok(await shown(p, '#drawer'), 'the menu opens');
    ok((await p.$$eval('#drawerTabs button', (bs) => bs.map((x) => x.textContent))).slice(0, 5).join('|') === 'Xây|Công trình|Bộ tộc|Dev|?', 'tabs: Xây, Công trình, Bộ tộc, Dev, ?');
    await pressText(p, 'Bộ tộc'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.querySelector('#drawerBody .page:not([hidden])').innerText.includes('Rìu Đá')), 'the Tribes tab shows tribes that have been seen');
    // gifts, surrender banner and the choice
    await state(p, () => { const t = window.__game.sim.tribes.find((x) => x.id === 'spring'); window.__game.sim.stock.food = 100; t.relation = 0; });
    const gifts = await p.$$eval('#drawerBody .page:not([hidden]) .card', (cs) => cs.findIndex((c) => c.innerText.includes('Suối Nguồn')));
    await p.evaluate((i) => { document.querySelectorAll('#drawerBody .page:not([hidden]) .card')[i].querySelector('button').click(); }, gifts);
    ok(await state(p, () => window.__game.sim.tribes.find((x) => x.id === 'spring').relation) === 5, 'a gift of food gives +5 relation');
    await pressText(p, 'Dev'); await p.waitForTimeout(150);
    await pressText(p, 'Đầu hàng'); await p.waitForTimeout(400);
    ok(await state(p, () => window.__game.sim.pendingTribe) !== null, 'a tribe forced to surrender waits for the player');
    await menuTo(p, false);
    ok(await state(p, () => document.querySelector('#drawer').hidden), 'the cross closes the menu');

    // dev: stats and resources
    await menuTo(p, true); await pressText(p, 'Dev'); await p.waitForTimeout(150);
    const str0 = await state(p, (id) => window.__game.sim.get(id).stats.str, ids[0]);
    await p.evaluate(() => { const rows = [...document.querySelectorAll('#drawerBody .devrow')].filter((r) => r.textContent.startsWith('Sức mạnh')); rows[0].querySelectorAll('button')[1].click(); });
    ok(await state(p, (id) => window.__game.sim.get(id).stats.str, ids[0]) === str0 + 1, 'dev menu: +1 on a selected villager\'s strength');
    await state(p, () => { window.__game.sim.stock.wood = 0; });
    await p.evaluate(() => { const rows = [...document.querySelectorAll('#drawerBody .devrow')].filter((r) => r.textContent.startsWith('Gỗ')); rows[0].querySelectorAll('button')[2].click(); });
    ok(await state(p, () => window.__game.sim.stock.wood) === 50, 'dev menu: +50 wood');
    await pressText(p, 'Xây miễn phí'); await pressText(p, 'Xây tức thì');
    await pressText(p, 'Bất tử');
    ok(await state(p, () => { const d = window.__game.sim.dev; return d.freeBuild && d.instantBuild && d.god; }), 'dev menu: free, instant build and invincibility switch on');
    await state(p, () => { window.__game.sim.stock.wood = 0; });
    // place the craft house with the mouse (hover, click) then open it from the "Công trình" tab
    await pressText(p, 'Xây'); await p.waitForTimeout(100);
    await p.evaluate(() => { for (const r of document.querySelectorAll('#drawerBody .page:not([hidden]) .row')) if (r.textContent.includes('Nhà chế tạo')) [...r.querySelectorAll('button')].pop().click(); });
    const spot = await screenOf(p, c.x - 4, c.y - 3);
    await p.mouse.move(spot.x, spot.y, { steps: 3 }); await p.mouse.click(spot.x, spot.y); await p.waitForTimeout(250);
    ok(await state(p, () => window.__game.sim.buildings.some((b) => b.kind === 'workshop' && b.done)), 'placing the craft house with free+instant build completes it at once');
    await menuTo(p, true); await pressText(p, 'Xây'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => [...document.querySelectorAll('#drawerBody .page:not([hidden]) .row')].some((r) => r.textContent.includes('Nhà chế tạo') && [...r.querySelectorAll('button')].pop().disabled)), 'a second craft house cannot be built: one of each kind per game');
    ok(await state(p, () => { const s = window.__game.sim, f = s.dev.freeBuild; s.dev.freeBuild = false; const r = s.buildingLock('toolstore'); s.dev.freeBuild = f; return r === 'Cần nghiên cứu: Kho công cụ'; }), 'the tool store is locked behind research (dev free build skips the lock)');
    await pressText(p, 'Công trình'); await p.waitForTimeout(200);
    await p.evaluate(() => { for (const r of document.querySelectorAll('#drawerBody .page:not([hidden]) .row')) if (r.textContent.includes('Nhà chế tạo')) [...r.querySelectorAll('button')].pop().click(); });
    await p.waitForTimeout(250);
    ok(await shown(p, '#bpanel') && await p.evaluate(() => document.getElementById('bpanel').innerText.includes('Vũ khí')), 'the craft house panel opens from the built list with its crafting items');
    ok(await p.evaluate(() => { const r = document.getElementById('bpanel').getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; }), 'the craft house panel fills the whole screen');
    await pressText(p, '✕ Đóng'); await p.waitForTimeout(100);
    ok(!(await shown(p, '#bpanel')) && await state(p, () => window.__game.ctl.selectedBuilding !== null && !window.__game.ctl.buildingOpen) && await shown(p, '#bbar'), 'the close button closes the panel and leaves the buttons of the building on the map');
    await state(p, () => { const g = window.__game; g.ctl.selectBuilding(g.sim.buildings.find((x) => x.kind === 'workshop').id, true); });
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => { const r = [...document.querySelectorAll('#bpanel .rec')].find((x) => x.textContent.includes('Búa gỗ')); return r.classList.contains('locked') && r.querySelectorAll('button')[1].disabled && r.textContent.includes('Chưa có bản vẽ'); }), 'a tool without a blueprint is locked in the craft house');
    // the craft house list is split into tabs
    const tabShown = (label) => p.evaluate((l) => { const t = [...document.querySelectorAll('#bpanel .tabs button')].find((b) => b.textContent === l); return !!t && t.getAttribute('aria-pressed') === 'true'; }, label);
    const visibleRecs = () => p.evaluate(() => [...document.querySelectorAll('#bpanel .rec')].filter((r) => r.offsetParent !== null).map((r) => r.querySelector('.nm').firstChild.textContent));
    ok(!(await tabShown('Công cụ')) && (await visibleRecs()).length === 0, 'the craft house opens on its first tab, with the items on tabs of their own');
    await pressText(p, 'Công cụ'); await p.waitForTimeout(100);
    ok(await tabShown('Công cụ') && (await visibleRecs()).every((n) => /Rìu|Cuốc|Búa/.test(n)) && (await visibleRecs()).length === 8, 'craft house: the Công cụ tab lists only the 8 tools');
    await pressText(p, 'Vũ khí'); await p.waitForTimeout(150);
    ok(await tabShown('Vũ khí') && (await visibleRecs()).every((n) => /Gậy|Giáo|Chùy/.test(n)) && (await visibleRecs()).length === 3, 'craft house: the Vũ khí tab lists only weapons');
    await pressText(p, 'Áo giáp'); await p.waitForTimeout(150);
    ok(await tabShown('Áo giáp') && (await visibleRecs()).length === 1, 'craft house: the Áo giáp tab lists the armour');
    await pressText(p, 'Công cụ'); await p.waitForTimeout(100);
    // the research house: blueprints, staff inside, money
    await state(p, () => { const g = window.__game, s = g.sim; s.villagers.forEach((v) => { v.stats.int = 9; }); s.stock.wood = 100; s.stock.coin = 20; });
    await pressText(p, '✕ Đóng');
    await menuTo(p, true); await pressText(p, 'Xây'); await p.waitForTimeout(100);
    await p.evaluate(() => { for (const r of document.querySelectorAll('#drawerBody .page:not([hidden]) .row')) if (r.textContent.includes('Nhà nghiên cứu')) [...r.querySelectorAll('button')].pop().click(); });
    const spotL = await screenOf(p, c.x + 2, c.y - 4);
    await p.mouse.move(spotL.x, spotL.y, { steps: 3 }); await p.mouse.click(spotL.x, spotL.y); await p.waitForTimeout(250);
    await state(p, () => { const g = window.__game; g.ctl.selectBuilding(g.sim.buildings.find((x) => x.kind === 'lab').id, true); });
    await p.waitForTimeout(250);
    ok(await p.evaluate(() => document.querySelectorAll('#bpanel .tech').length) === 19, 'the research house lists every blueprint and step');
    await p.evaluate(() => { const r = [...document.querySelectorAll('#bpanel .tech')].find((x) => x.textContent.includes('Bản vẽ Búa gỗ')); [...r.querySelectorAll('button')].pop().click(); });
    ok(await state(p, () => window.__game.sim.researchQueue.includes('hammer1')), 'starting a blueprint queues it');
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => [...document.querySelectorAll('#bpanel .tech')].every((r) => { const b = r.querySelector('button'); return b.disabled || b.textContent === 'Hủy đơn'; })), 'while one research is waiting or running no other can be started');
    ok(await pressText(p, 'Thêm người nghiên cứu'), 'the lab has a button to choose a villager to work inside');
    await p.waitForTimeout(150);
    ok(await pressText(p, 'Vào làm'), 'and the player picks who goes in from the list');
    await state(p, () => { const s = window.__game.sim; s.dev.fastWorks = true; for (let i = 0; i < 20 * 120; i++) s.tick(0.05); s.dev.fastWorks = false; s.speed = 0; });
    await p.waitForTimeout(300);
    ok(await state(p, () => window.__game.sim.researched.has('hammer1')), 'the researcher inside finishes the blueprint');
    ok(await p.evaluate(() => document.getElementById('bpanel').innerText.includes('Trí tuệ 9')), 'the villager inside is listed by name with Trí tuệ');
    ok(await state(p, () => window.__game.sim.villagers.some((v) => v.inside !== null)) && await p.evaluate(() => { const g = window.__game, v = g.sim.villagers.find((x) => x.inside !== null); const b = g.renderer.worldToScreen(v.x * 32, v.y * 32 - 16); g.ctl.selectAll(); return !g.ctl.selected.has(v.id); }), 'a villager inside a house is not drawn or selectable on the map');
    await pressText(p, 'Cho ra'); await p.waitForTimeout(150);
    ok(await state(p, () => window.__game.sim.villagers.every((v) => v.inside === null)), 'Cho ra brings the villager back out');
    await state(p, () => { window.__game.ctl.clearSelection(); const g = window.__game; g.ctl.selectBuilding(g.sim.buildings.find((x) => x.kind === 'workshop').id, true); });
    await p.waitForTimeout(250);
    ok(await p.evaluate(() => { const r = [...document.querySelectorAll('#bpanel .rec')].find((x) => x.textContent.includes('Búa gỗ')); return !r.classList.contains('locked') && !r.querySelectorAll('button')[1].disabled; }), 'the tool opens in the craft house once its blueprint is researched');
    // the repair house lists villagers' tools and lets the player mend or drop them
    await state(p, () => { const g = window.__game, s = g.sim; s.dev.freeBuild = true; s.dev.instantBuild = true; });
    await state(p, () => { const g = window.__game; g.ctl.closeBuilding(); });
    await menuTo(p, true); await pressText(p, 'Xây'); await p.waitForTimeout(100);
    await p.evaluate(() => { for (const r of document.querySelectorAll('#drawerBody .page:not([hidden]) .row')) if (r.textContent.includes('Nhà sửa chữa')) [...r.querySelectorAll('button')].pop().click(); });
    const spotR = await screenOf(p, c.x + 5, c.y - 2);
    await p.mouse.move(spotR.x, spotR.y, { steps: 3 }); await p.mouse.click(spotR.x, spotR.y); await p.waitForTimeout(250);
    await state(p, () => { const g = window.__game, s = g.sim; s.giveTool([s.villagers[0].id], 'axe', 1); s.villagers[0].tools.axe.dur = 10; s.ctlTest = s.villagers[0].id; g.ctl.selectBuilding(s.buildings.find((x) => x.kind === 'repair').id, true); });
    await p.waitForTimeout(250);
    await pressText(p, 'Công cụ của dân'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => document.getElementById('bpanel').innerText.includes('Rìu gỗ')), 'the repair house lists a worn tool');
    await pressText(p, 'Đi sửa'); await p.waitForTimeout(150);
    ok(await state(p, () => { const s = window.__game.sim; return s.villagers[0].phase === 'goOrder' && s.villagers[0].tools.axe !== null; }), 'Đi sửa sends the villager walking with the tool');
    await state(p, () => { const s = window.__game.sim; for (let i = 0; i < 20 * 90; i++) s.tick(0.05); });
    ok(await state(p, () => { const s = window.__game.sim; return (s.repairQueue.includes('axe1') || s.building('repair').active?.id === 'axe1') && s.villagers[0].tools.axe === null; }), 'and hands the tool in at the repair house');
    await state(p, () => { const g = window.__game; g.ctl.closeBuilding(); });
    // villager details: tools by hand
    await state(p, () => { const g = window.__game, s = g.sim; s.toolStock.axe1 = 2; s.setJob([s.villagers[1].id], 'wood'); g.ctl.selected.clear(); g.ctl.selected.add(s.villagers[1].id); g.ctl.onChange(); });
    await p.waitForTimeout(250);
    await pressText(p, 'Giao việc và chi tiết'); await p.waitForTimeout(150);
    await p.evaluate(() => { const row = [...document.querySelectorAll('#udetail .row')].find((r) => r.textContent.startsWith('Rìu')); [...row.querySelectorAll('button')].find((b) => b.textContent.startsWith('Gỗ')).click(); });
    ok(await state(p, () => window.__game.sim.villagers[1].tools.axe?.tier === 1), 'a tool is handed to the chosen villager from the details page');
    await pressText(p, '✕ Đóng'); await state(p, () => { window.__game.ctl.clearSelection(); });
    // buttons under the tapped building: upgrade and demolish ask first, the panel has none of them
    await state(p, () => { const g = window.__game; g.ctl.selectBuilding(g.sim.buildings.find((x) => x.kind === 'workshop').id); });
    await p.waitForTimeout(250);
    ok(await shown(p, '#bbar') && !(await shown(p, '#bpanel')), 'tapping a building shows its buttons on the map, not the big panel');
    ok(await p.evaluate(() => { const r = document.getElementById('bbar').getBoundingClientRect(); const g = window.__game, b = g.sim.buildings.find((x) => x.kind === 'workshop'), s = g.renderer.worldToScreen((b.x + 1) * 32, (b.y + 2) * 32); return r.top >= s.y - 1; }), 'the buttons sit beneath the building');
    await pressText(p, 'Chế tạo'); await p.waitForTimeout(150);
    ok(await shown(p, '#bpanel') && !(await shown(p, '#bbar')) && !(await p.evaluate(() => /Phá bỏ|Nâng cấp|Dời/.test(document.getElementById('bpanel').innerText))), 'the open button shows the big panel, which no longer has upgrade, move or demolish');
    await pressText(p, '✕ Đóng'); await p.waitForTimeout(100);
    await state(p, () => { const s = window.__game.sim; s.dev.freeBuild = false; s.stock.wood = 0; s.stock.stone = 0; });
    ok(await pressText(p, 'Nâng cấp'), 'the bar has an upgrade button'); await p.waitForTimeout(100);
    ok(await shown(p, '#dialog') && await p.evaluate(() => document.getElementById('dialog').innerText.includes('Gỗ') && document.getElementById('dialog').querySelector('.dbtns button:last-child').disabled), 'upgrade shows the materials it needs, and cannot be confirmed without them');
    await pressText(p, 'Hủy'); await p.waitForTimeout(100);
    ok(!(await shown(p, '#dialog')) && await state(p, () => window.__game.sim.buildings.find((x) => x.kind === 'workshop').level === 1), 'Hủy closes the dialog and changes nothing');
    await state(p, () => { const s = window.__game.sim; s.stock.wood = 200; s.stock.stone = 200; s.researched.add('timber'); });
    await pressText(p, 'Nâng cấp'); await p.waitForTimeout(100);
    await p.evaluate(() => document.querySelector('#dialog .dbtns button:last-child').click()); await p.waitForTimeout(150);
    ok(await state(p, () => { const b = window.__game.sim.buildings.find((x) => x.kind === 'workshop'); return b.upgrading || b.level === 2; }) && await state(p, () => window.__game.sim.stock.wood < 200), 'confirming pays the materials and starts the upgrade');
    await state(p, () => { const s = window.__game.sim; s.dev.freeBuild = true; });
    const old = await state(p, () => { const b = window.__game.sim.buildings.find((x) => x.kind === 'workshop'); return { x: b.x, y: b.y }; });
    await p.waitForTimeout(300);
    ok(await pressText(p, 'Dời'), 'the bar has a move button');
    await p.waitForTimeout(150);
    ok(await state(p, () => window.__game.ctl.moving !== null) && await shown(p, '#placeBar'), 'moving shows the placing bar');
    const spot2 = await screenOf(p, old.x - 2, old.y + 3);
    await p.mouse.move(spot2.x, spot2.y, { steps: 3 }); await p.mouse.click(spot2.x, spot2.y); await p.waitForTimeout(250);
    ok(await state(p, (o) => { const b = window.__game.sim.buildings.find((x) => x.kind === 'workshop'); return !!b && (b.x !== o.x || b.y !== o.y) && window.__game.ctl.moving === null; }, old), 'clicking a free spot moves the craft house there');
    await state(p, () => { const g = window.__game; g.ctl.selectBuilding(g.sim.buildings.find((x) => x.kind === 'workshop').id); });
    await p.waitForTimeout(200);
    await pressText(p, 'Phá bỏ'); await p.waitForTimeout(100);
    ok(await shown(p, '#dialog') && await state(p, () => window.__game.sim.buildings.some((b) => b.kind === 'workshop')), 'Phá bỏ only asks to confirm');
    await p.evaluate(() => document.querySelector('#dialog .dbtns button:last-child').click());
    await p.waitForTimeout(150);
    ok(await state(p, () => !window.__game.sim.buildings.some((b) => b.kind === 'workshop')), 'confirming tears the craft house down');
    // storage and big map
    await p.keyboard.press('m'); ok(await shown(p, '#bigmap'), 'M opens the big map'); await p.keyboard.press('m');

    // layout
    ok(await state(p, () => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scrolling');
    await p.context().close();
  }

  // ============================================================ phone held upright
  {
    const p = await (await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage(); watch(p);
    await p.goto(url); await p.waitForTimeout(500);
    ok(await shown(p, '#rotate') && await state(p, () => window.__game.sim.speed) === 0, 'upright phone: asks to turn the phone and pauses the game');
    await p.setViewportSize({ width: 812, height: 375 }); await p.waitForTimeout(300);
    ok(!(await shown(p, '#rotate')) && await state(p, () => window.__game.sim.speed) === 1, 'turned sideways: the prompt goes away and the game resumes');
    await p.setViewportSize({ width: 375, height: 812 }); await p.waitForTimeout(300);
    ok(await shown(p, '#rotate'), 'turned upright again: the prompt returns');
    await p.tap('#btnRotateSkip'); await p.waitForTimeout(200);
    ok(!(await shown(p, '#rotate')) && await state(p, () => window.__game.sim.speed) === 1, 'playing upright on purpose is allowed');
    await p.context().close();
  }

  // ============================================================ phone, landscape, touch
  {
    const ctx = await browser.newContext({ viewport: { width: 812, height: 375 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); watch(p);
    await p.goto(url); await p.waitForTimeout(500);
    const c = await prepare(p);
    const ids = await state(p, () => window.__game.sim.villagers.map((v) => v.id));
    await state(p, ([ids, c]) => { const s = window.__game.sim; ids.forEach((id, i) => { const v = s.get(id); v.x = c.x - 1 + i * 1.5; v.y = c.y + 0.5; v.path = []; }); window.__game.ctl.centerOn(c.x * 32 - 170, c.y * 32); }, [ids, c]);
    await p.waitForTimeout(200);
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i })) });

    let b = await bodyOf(p, ids[0]); await p.touchscreen.tap(b.x, b.y); await p.waitForTimeout(150);
    ok(await state(p, () => window.__game.ctl.selected.size) === 1, 'tap selects a villager');
    // with a villager selected a tap on the ground is a move order
    const ground = await screenOf(p, c.x + 6, c.y + 2);
    await p.touchscreen.tap(ground.x, ground.y); await p.waitForTimeout(150);
    ok(await state(p, (id) => window.__game.sim.get(id).phase, ids[0]) === 'move', 'tap on the ground sends the selected villager there');
    // a tap on a tree is a job
    const tree = await state(p, ([c]) => { const s = window.__game.sim, N = s.world.size, i = (c.y + 2) * N + (c.x + 3); s.world.tiles[i] = 2; s.world.nodes.set(i, { kind: 'tree', res: 'wood', amount: 10, max: 10, workers: 0, sides: 0, regrow: 0 }); return { x: c.x + 3, y: c.y + 2 }; }, [c]);
    const tp = await screenOf(p, tree.x + 0.5, tree.y + 0.4); await p.touchscreen.tap(tp.x, tp.y - 24); await p.waitForTimeout(150);
    ok(await state(p, (id) => window.__game.sim.get(id).job, ids[0]) === 'wood', 'tap on a tree gives the woodcutter job');
    // an animal: tap makes the villager hunt it
    const animal = await state(p, ([c]) => { const s = window.__game.sim; const a = s.animals.find((x) => x.species === 'rabbit'); a.x = c.x + 3.5; a.y = c.y - 1.5; a.state = 'graze'; a.timer = 99; a.dest = null; return a.id; }, [c]);
    const ap = await state(p, (id) => { const g = window.__game, a = g.sim.animalById.get(id), q = g.renderer.worldToScreen(a.x * 32, a.y * 32 - 8), b = document.getElementById('view').getBoundingClientRect(); return { x: b.left + q.x, y: b.top + q.y }; }, animal);
    await p.touchscreen.tap(ap.x, ap.y); await p.waitForTimeout(150);
    ok(await state(p, ([id, a]) => { const v = window.__game.sim.get(id); return v.job === 'hunt' && v.fight.target && v.fight.target.id === a; }, [ids[0], animal]), 'tap on an animal orders a hunt');
    // tap on a villager again with others selected toggles; tap on empty ground with nothing selected does nothing
    await p.tap('#btnNone'); await p.waitForTimeout(100);
    await p.touchscreen.tap(ground.x, ground.y); await p.waitForTimeout(100);
    ok(await state(p, () => window.__game.ctl.selected.size) === 0, 'with nothing selected, tapping the ground does nothing');
    // multi-select button
    await p.tap('#btnMulti'); b = await bodyOf(p, ids[1]); await p.touchscreen.tap(b.x, b.y); b = await bodyOf(p, ids[2]); await p.touchscreen.tap(b.x, b.y);
    ok(await state(p, () => window.__game.ctl.selected.size) === 2, 'multi-select mode: tapping toggles villagers into the selection');
    await p.tap('#btnMulti');

    // two-finger pan and pinch
    const cam0 = await state(p, () => ({ x: window.__game.cam.x, z: window.__game.cam.zoom }));
    await touch('touchStart', [[540, 110], [580, 110]]); for (let i = 1; i <= 8; i++) await touch('touchMove', [[540 + i * 10, 110], [580 + i * 10, 110]]); await touch('touchEnd', []);
    ok(await state(p, () => window.__game.cam.x) < cam0.x - 20, 'two fingers moving right drag the map');
    await touch('touchStart', [[560, 110], [580, 110]]); for (let i = 1; i <= 8; i++) await touch('touchMove', [[560 - i * 12, 110], [580 + i * 12, 110]]); await touch('touchEnd', []);
    ok(await state(p, () => window.__game.cam.zoom) > cam0.z, 'pinching out zooms in');

    // the map
    await p.tap('#mini'); ok(await shown(p, '#bigmap'), 'tapping the small map opens the big map');
    await p.tap('#btnCloseMap'); ok(!(await shown(p, '#bigmap')), 'the big map closes');
    // menu → build → confirm bar
    await state(p, () => { window.__game.sim.stock.wood = 50; });
    await menuTo(p, true, true); await pressText(p, 'Xây'); await p.evaluate(() => { for (const r of document.querySelectorAll('#drawerBody .page:not([hidden]) .row')) if (r.textContent.includes('Kho')) [...r.querySelectorAll('button')].pop().click(); });
    await p.waitForTimeout(250);
    ok(await shown(p, '#placeBar') && !(await shown(p, '#drawer')), 'choosing a building shows the confirm bar and closes the menu');
    const spot = await state(p, () => { const g = window.__game, w = g.renderer.screenToWorld(620, 100); for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const ox = Math.round(w.x / 32) + dx - 1, oy = Math.round(w.y / 32) + dy - 1; if (g.sim.canPlace('storage', ox, oy) === null) { const q = g.renderer.worldToScreen((ox + 1) * 32, (oy + 1) * 32), b = document.getElementById('view').getBoundingClientRect(); return { x: b.left + q.x, y: b.top + q.y }; } } return null; });
    await p.touchscreen.tap(spot.x, spot.y); await p.waitForTimeout(150);
    await p.tap('#btnPlaceOk'); await p.waitForTimeout(250);
    ok(await state(p, () => window.__game.sim.buildings.filter((b) => b.kind === 'storage').length) === 1, 'tap to move the ghost, then the tick button places the building');
    // tap the new building site → panel opens
    ok(await state(p, () => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scrolling on the phone');
    await ctx.close();
  }

  ok(errs.length === 0, 'no page errors: ' + (errs.join(' | ') || 'none'));
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
