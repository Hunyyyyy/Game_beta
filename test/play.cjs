const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (['error','warning'].includes(m.type())) errs.push(m.text()); });
  await p.goto('file://' + process.cwd() + '/dist/index.html');
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/s1.png' });
  // giao việc: tìm cây/đá/bụi gần nhất trong vùng sáng
  const info = await p.evaluate(() => {
    const g = window.__game, s = g.sim, N = s.world.size, ids = s.villagers.map(v => v.id);
    const near = (kind) => { let best = null, bd = 1e9; for (const [i, n] of s.world.nodes) { if (n.kind !== kind || s.fog.state[i] === 0) continue; const d = Math.hypot(i % N - s.world.start.x, ((i / N) | 0) - s.world.start.y); if (d < bd) { bd = d; best = i; } } return best; };
    const t = near('tree'), r = near('rock'), b = near('bush');
    s.setJob([ids[0]], 'wood'); s.setJob([ids[1]], 'stone'); s.setJob([ids[2]], 'food');
    g.ctl.selected.add(ids[0]);
    return { t, r, b };
  });
  console.log(info);
  await p.evaluate(() => { window.__game.sim.speed = 4; });
  await p.waitForTimeout(9000);
  await p.screenshot({ path: '/tmp/s2.png' });
  console.log(await p.evaluate(() => JSON.stringify({ stock: window.__game.sim.stock, vs: window.__game.sim.villagers.map(v => [v.name, v.job, v.phase, v.carry]) })));
  console.log('errors', errs);
  await b.close();
})();
