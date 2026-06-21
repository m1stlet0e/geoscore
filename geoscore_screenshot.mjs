import { chromium } from 'playwright';

const BASE = 'http://localhost:18200';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pg = await ctx.newPage();

// 登录
await pg.goto(BASE+'/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
await pg.waitForTimeout(1000);
await pg.locator('button:has-text("邮箱登录")').click();
await pg.waitForTimeout(300);
await pg.locator('input[name="email"]').fill('demo@geoscore.ai');
await pg.locator('input[name="password"]').fill('demo123456');
await pg.locator('button[type="submit"]').click();
await pg.waitForTimeout(5000);

const pages = [
  ['/dashboard', '01_dashboard'],
  ['/brands', '02_brands'],
  ['/monitor', '03_monitor'],
  ['/citations', '04_citations'],
  ['/sources', '05_sources'],
  ['/influence', '06_influence'],
  ['/gaps', '07_gaps'],
  ['/growth', '08_growth'],
  ['/content', '09_content'],
  ['/radar', '10_radar'],
  ['/forecast', '11_forecast'],
  ['/alerts', '12_alerts'],
  ['/settings', '13_settings'],
  ['/settings/billing', '14_billing'],
];

for (const [path, name] of pages) {
  try {
    await pg.goto(BASE+path, { waitUntil: 'networkidle', timeout: 15000 });
    await pg.waitForTimeout(2000);
    await pg.screenshot({ path: `/tmp/geoscore_${name}.png`, fullPage: false });
    console.log(`📸 ${name} (${path})`);
  } catch(e) {
    console.log(`❌ ${name}: ${e.message.slice(0,60)}`);
  }
}

await ctx.close();
await browser.close();
console.log('\n✅ All screenshots saved to /tmp/geoscore_*.png');
