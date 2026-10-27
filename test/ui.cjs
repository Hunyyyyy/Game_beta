const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (['error'].includes(m.type())) errs.push(m.text()); });
  await p.goto('file://' + process.cwd() + '/dist/index.html');
  await p.waitForTimeout(500);
  let ok = true; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) ok = false; };
  // reveal map near trees: move villagers north
  await p.evaluate(() => { const g = window.__game; g.sim.speed = 4; g.sim.orderMove(g.sim.villagers.map(v => v.id), g.sim.world.start.x + 6, g.sim.world.start.y - 9); });
  await p.waitForTimeout(3500);
  // chọn hết bằng nút, chuột phải lên cây gần nhất
  await p.click('#btnAll');
  const pos = await p.evaluate(() => {
    const g = window.__game, s = g.sim, N = s.world.size, v = s.villagers[0]; let best = null, bd = 1e9;
    for (const [i, n] of s.world.nodes) { if (n.kind !== 'tree' || s.fog.state[i] !== 2) continue; const d = Math.hypot(i % N - v.x, ((i / N) | 0) - v.y); if (d < bd) { bd = d; best = i; } }
    const tx = best % N, ty = (best / N) | 0; g.ctl.centerOn(tx * 32 + 16, ty * 32 + 16);
    const r = g.renderer.worldToScreen(tx * 32 + 16, ty * 32 - 16), box = document.getElementById('view').getBoundingClientRect();
    return { x: box.left + r.x, y: box.top + r.y, tx, ty };
  });
  await p.waitForTimeout(100);
  await p.mouse.click(pos.x, pos.y, { button: 'right' });
  const jobs = await p.evaluate(() => window.__game.sim.villagers.map(v => v.job));
  check(jobs.every(j => j === 'wood'), 'chuột phải lên cây giao nghề đốn gỗ: ' + jobs);
  await p.waitForTimeout(34000);
  const st = await p.evaluate(() => ({ s: window.__game.sim.stock, t: Math.round(window.__game.sim.time) }));
  console.log(JSON.stringify(st));
  check(st.s.wood >= 10, 'đủ gỗ để xây Kho');
  // đặt Kho bằng nút
  await p.evaluate(() => { const g = window.__game, s = g.sim; g.ctl.centerOn((s.world.start.x + 4) * 32, (s.world.start.y - 3) * 32); });
  await p.click('#btnBuild');
  const box = await p.evaluate(() => { const b = document.getElementById('view').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await p.mouse.move(box.x, box.y); await p.mouse.move(box.x + 3, box.y + 3);
  await p.screenshot({ path: '/tmp/u_ghost.png' });
  await p.mouse.click(box.x + 3, box.y + 3);
  const nb = await p.evaluate(() => window.__game.sim.buildings.map(b => [b.kind, b.done, b.x, b.y]));
  console.log(JSON.stringify(nb));
  check(nb.length === 2, 'đã đặt Kho');
  await p.waitForTimeout(4000);
  const jobs2 = await p.evaluate(() => window.__game.sim.villagers.map(v => v.job + ':' + v.phase));
  console.log(jobs2.join(' '));
  await p.screenshot({ path: '/tmp/u_site.png' });
  await p.waitForTimeout(6000);
  await p.screenshot({ path: '/tmp/u_done.png' });
  const done = await p.evaluate(() => window.__game.sim.buildings.map(b => [b.kind, b.done, +b.progress.toFixed(2)]));
  console.log(JSON.stringify(done));
  await p.evaluate(() => { window.__game.sim.time = 240 * 0.95; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/u_night.png' });
  console.log('errors', errs); console.log(ok ? 'PASS' : 'FAIL');
  await b.close();
})();
