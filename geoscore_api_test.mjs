import { chromium } from 'playwright';

const BASE = 'http://localhost:18200';
const RESULTS = [];
function log(r) { RESULTS.push(r); console.log(r); }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();

// 登录获取 cookie
await page.goto(`${BASE}/login`, { waitUntil: 'commit', timeout: 20000 });
await page.waitForTimeout(1000);
const emailTab = page.locator('button:has-text("邮箱登录")');
if (await emailTab.isVisible({ timeout: 3000 }).catch(() => false)) await emailTab.click();
await page.locator('input[type="email"]').first().fill('demo@geoscore.ai');
await page.locator('input[type="password"]').first().fill('demo123456');
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);

const cookies = await context.cookies();
const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
console.log('登录状态:', page.url().includes('dashboard') ? '已登录' : '未登录');

const apis = [
  // 品牌 CRUD
  ['GET', '/api/brands', 200, '品牌列表'],
  ['POST', '/api/brands', 201, '创建品牌'],
  // 引用
  ['GET', '/api/citations', 200, '引用列表'],
  ['GET', '/api/citations/analyze', 200, '引用分析'],
  // 差距分析
  ['GET', '/api/gaps', 200, '差距列表'],
  // 扫描
  ['GET', '/api/scans', 200, '扫描列表'],
  // 告警
  ['GET', '/api/alerts', 200, '告警列表'],
  // 品牌级 API
  ['GET', '/api/brands/citations', 200, '品牌引用'],
  ['GET', '/api/brands/gaps', 200, '品牌差距'],
  ['GET', '/api/brands/content', 200, '品牌内容'],
  ['GET', '/api/brands/sources', 200, '品牌来源'],
  ['GET', '/api/brands/forecast', 200, '品牌预测'],
  ['GET', '/api/brands/prompts', 200, '品牌提示词'],
  ['GET', '/api/brands/radar', 200, '品牌雷达'],
  // 账单
  ['GET', '/api/billing/subscription', 200, '订阅信息'],
  ['GET', '/api/billing/orders', 200, '订单列表'],
  ['GET', '/api/billing/plans', 200, '套餐列表'],
];

let passed = 0, failed = 0;

for (const [method, path, expectedStatus, label] of apis) {
  try {
    const body = method === 'POST' ? JSON.stringify({ name: 'API测试品牌' + Date.now(), website: 'https://api-test.example.com' }) : undefined;
    const headers = { 'Cookie': cookieStr };
    if (body) headers['Content-Type'] = 'application/json';
    
    const resp = await page.request.fetch(`${BASE}${path}`, { method, headers, ...(body ? { body } : {}) });
    const status = resp.status();
    if (status === expectedStatus || (status >= 200 && status < 300)) {
      log(`✅ ${method} ${path} → ${status} (${label})`);
      passed++;
    } else {
      log(`⚠️ ${method} ${path} → ${status} (期望${expectedStatus}) [${label}]`);
      failed++;
    }
  } catch(e) {
    log(`❌ ${method} ${path} → 异常: ${e.message.slice(0,60)}`);
    failed++;
  }
}

// 额外测试：未登录访问应该返回 401/403
const publicPage = await context.newPage();
for (const [method, path] of [['GET', '/api/brands'], ['GET', '/api/citations']]) {
  try {
    const resp = await publicPage.request.fetch(`${BASE}${path}`);
    const st = resp.status();
    if (st === 307 || st === 401 || st === 403) {
      log(`✅ 未登录 ${method} ${path} → ${st} (已保护)`);
      passed++;
    } else {
      log(`⚠️ 未登录 ${method} ${path} → ${st} (可能未保护)`);
      failed++;
    }
  } catch(e) { failed++; }
}
await publicPage.close();

console.log(`\n========== API 测试: ${passed} passed, ${failed} failed ==========`);

await browser.close();
