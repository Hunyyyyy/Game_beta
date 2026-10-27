const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForTimeout(400);
  const info = await p.evaluate(() => {
    const g = window.__game, s = g.sim, w = s.world, N = w.size; s.fog.state.fill(2); s.fog.version++;
    const cx = w.start.x + 5, cy = w.start.y + 3;
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 4; x <= cx + 6; x++) { const i = y * N + x; w.tiles[i] = 0; w.nodes.delete(i); }
    const plant = (x, y, kind, tile) => { const i = y * N + x; w.tiles[i] = tile; w.nodes.set(i, { kind, res: kind === 'tree' ? 'wood' : 'stone', amount: 10, max: 10, workers: 0, sides: 0, regrow: 0 }); };
    plant(cx - 1, cy, 'tree', 2); plant(cx, cy, 'tree', 2); plant(cx + 1, cy, 'tree', 2); plant(cx + 4, cy, 'rock', 3);
    s.villagers.forEach(v => { v.fullness = 1e9; v.tools.axe = { tier: 2, dur: 600 }; v.tools.pick = { tier: 2, dur: 600 }; });
    s.orderWork([s.villagers[0].id, s.villagers[1].id], cx, cy);
    s.orderWork([s.villagers[2].id], cx + 4, cy);
    g.cam.zoom = 4; g.ctl.centerOn((cx + 2) * 32, cy * 32); s.speed = 4;
    return { cx, cy };
  });
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(500);
    const st = await p.evaluate(() => window.__game.sim.villagers.map(v => v.phase + (v.slide ? '*' : '')).join());
    if (st === 'work,work,work') break;
  }
  await p.evaluate(() => { window.__game.sim.speed = 0; });
  await p.waitForTimeout(200);
  console.log(await p.evaluate(() => JSON.stringify(window.__game.sim.villagers.map(v => [v.name, v.phase, v.facing, +v.x.toFixed(2), +v.y.toFixed(2), v.anim]))));
  await p.evaluate(() => { window.__game.sim.speed = 0.25; });
  for (const k of [1, 2]) { await p.waitForTimeout(700); await p.screenshot({ path: `/tmp/side${k}.png`, clip: { x: 150, y: 150, width: 900, height: 500 } }); }
  console.log('errors', errs); await b.close();
})();
