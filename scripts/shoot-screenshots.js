/**
 * 给 product-intro.html 抓 5 张关键截图:
 *  1. demo 业务页(supply-chain.html)整页
 *  2. 看板「用了什么」(/)
 *  3. 看板「卡在哪了」(/blocked)
 *  4. 看板「怎么走的」(/paths)
 *  5. 看板「谁在用」(/audience)
 *
 * 截图存到 docs/screenshots/ 下,product-intro.html 用相对路径引用。
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, 'docs/screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const SHOTS = [
  { name: 'demo-supply-chain', url: 'http://localhost:3001/demo/supply-chain.html', wait: 2000 },
  { name: 'dashboard-usage',   url: 'http://localhost:5173/?appId=demo&preset=30d',         wait: 3000 },
  { name: 'dashboard-blocked', url: 'http://localhost:5173/blocked?appId=demo&preset=30d', wait: 3000 },
  { name: 'dashboard-paths',   url: 'http://localhost:5173/paths?appId=demo&preset=30d',   wait: 3000 },
  { name: 'dashboard-audience', url: 'http://localhost:5173/audience?appId=demo&preset=30d', wait: 3000 },
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  for (const s of SHOTS) {
    const page = await ctx.newPage();
    console.log(`shooting ${s.name} <- ${s.url}`);
    await page.goto(s.url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(s.wait);
    const out = path.join(OUT_DIR, `${s.name}.png`);
    await page.screenshot({ path: out, fullPage: false });
    console.log(`  -> ${out}`);
    await page.close();
  }
  await browser.close();
})();
