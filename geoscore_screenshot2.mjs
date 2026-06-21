import { chromium } from 'playwright';

const BASE = 'http://localhost:18200';

// API 登录获取 cookie
const loginRes = await fetch(BASE+'/api/auth/email-login', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({email:'demo@geoscore.ai', password:'demo123456'})
});
const setCookie = loginRes.headers.getSetCookie?.()?.[0] || loginRes.headers.get('set-cookie') || '';
console.log('Cookie obtained:', setCookie.slice(0,30)+'...');

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pg = await ctx.newPage();

// 手动设置 cookie
if (setCookie) {
  const [nameVal, ...rest] = setCookie.split(';');
  const [name, value] = nameVal.split('=');
  await ctx.addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
}

const pages = [
  ['/dashboard', '01_dashboard'],
  ['/brands', '02_brands'],
  ['/monitor', '03_monitor'],
  ['/citations', '04_citations'],
  ['/gaps', '07_gaps'],
  ['/growth', '08_growth'],
  ['/alerts', '12_alerts'],
  ['/settings', '13_settings'],
  ['/settings/billing', '14_billing'],
];

for (const [path, name] of pages) {
  try {
    await pg.goto(BASE+path, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pg.waitForTimeout(2000);
    await pg.screenshot({ path: `/tmp/geoscore_${name}.png`, fullPage: false });
    console.log(`📸 ${name}`);
  } catch(e) {
    console.log(`❌ ${name}: ${e.message.slice(0,60)}`);
  }
}

await ctx.close();
await browser.close();
console.log('✅ Done');
