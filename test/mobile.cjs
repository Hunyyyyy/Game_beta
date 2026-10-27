const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForTimeout(500);
  await p.click('#btnAll'); await p.waitForTimeout(300);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log('scrollWidth', sw);
  await p.screenshot({ path: '/tmp/m1.png' }); await b.close();
})();
