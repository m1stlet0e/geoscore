import { chromium } from 'playwright';

const BASE = 'http://localhost:18200';
const RESULTS = [];
function log(r) { RESULTS.push(r); console.log(r); }

// Turbopack HMR uses long-lived WebSocket, so 'load' may never fire
// Use 'commit' (fastest) with explicit wait for body content
const WAIT = 'commit';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

async function nav(path, label) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: WAIT, timeout: 30000 });
    // wait for body to have meaningful content
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1500);
    return true;
  } catch(e) { log(`❌ ${label}: ${e.message.slice(0,80)}`); return false; }
}

try {
  // ========== 公开页面 ==========
  console.log('\n===== 公开页面 =====');
  const pub = [['首页','/'],['登录页','/login'],['注册页','/register'],['定价','/pricing']];
  for (const [n,p] of pub) {
    if (await nav(p, n)) log(`✅ ${n}: [${await page.title().catch(()=>'?')}]`);
  }

  // ========== 登录 ==========
  console.log('\n===== 登录 =====');
  await nav('/login', '登录导航');
  // 切换到邮箱登录
  const emailTab = page.locator('button:has-text("邮箱登录")');
  if (await emailTab.isVisible({ timeout: 3000 }).catch(()=>false)) {
    await emailTab.click(); await page.waitForTimeout(500);
  }
  const ei = page.locator('input[type="email"], input#email, input[name="email"]');
  const pi = page.locator('input[type="password"], input#password, input[name="password"]');
  if (await ei.count() > 0) {
    await ei.first().fill('demo@geoscore.ai');
    await pi.first().fill('demo123456');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(4000);
  }
  if (page.url().includes('/dashboard')) log('✅ 登录成功');
  else log(`❌ 登录失败: ${page.url()}`);

  if (!page.url().includes('/dashboard')) throw new Error('NOT_LOGGED_IN');

  // ========== 仪表盘 ==========
  console.log('\n===== 仪表盘页面 =====');
  const pages = [
    ['仪表盘首页','/dashboard'],['品牌管理','/brands'],['监控扫描','/monitor'],
    ['引用分析','/citations'],['来源分析','/sources'],['影响力','/influence'],
    ['差距分析','/gaps'],['内容增长','/growth'],['内容管理','/content'],
    ['雷达信号','/radar'],['趋势预测','/forecast'],['告警管理','/alerts'],
    ['用户设置','/settings'],['账单管理','/settings/billing'],
  ];
  for (const [n,p] of pages) {
    if (!(await nav(p, n))) continue;
    if (page.url().includes('/login')) { log(`❌ ${n}: session失效`); continue; }
    const b = await page.locator('button').count();
    const a = await page.locator('a').count();
    const txt = (await page.locator('body').innerText().catch(()=>'')).slice(0,200);
    const err = txt.includes('Error')||txt.includes('500')||txt.includes('加载失败');
    log(`${err?'⚠️':'✅'} ${n}: ${b}按钮 ${a}链接${err?' [含异常]':''}`);
    // save screenshot for key pages
    if (p === '/dashboard' || p === '/brands' || p === '/citations') {
      await page.screenshot({ path: `/tmp/geoscore_${p.replace(/\//g,'_')}.png`, fullPage: true }).catch(()=>{});
    }
  }

  // ========== 交互测试 ==========
  console.log('\n===== 交互测试 =====');

  // 品牌CRUD
  if (await nav('/brands','品牌CRUD')){
    const addBtn = page.locator('button').filter({hasText:/添加|新增|创建品牌/}).first();
    if (await addBtn.isVisible({timeout:3000}).catch(()=>false)) {
      await addBtn.click(); await page.waitForTimeout(800);
      const nameInp = page.locator('input').filter({hasText:''}).first();
      // try fill name
      const inputs = page.locator('input');
      const ic = await inputs.count();
      log(`  品牌弹窗输入框: ${ic}`);
      // close
      const cancel = page.locator('button:has-text("取消"), button:has-text("关闭")').first();
      if (await cancel.isVisible({timeout:2000}).catch(()=>false)) await cancel.click();
      log('✅ 品牌弹窗: 可打开/关闭');
    } else log('⚠️ 品牌添加按钮不可见');
  }

  // 扫描触发
  if (await nav('/monitor','扫描')){
    const scanBtn = page.locator('button').filter({hasText:/扫描|执行|开始|立即/}).first();
    const vis = await scanBtn.isVisible({timeout:3000}).catch(()=>false);
    log(`${vis?'✅':'⚠️'} 扫描按钮: ${vis?'可见':'未找到'}`);
  }

  // 告警筛选
  if (await nav('/alerts','告警')){
    const items = await page.locator('tr, [class*="card"], [class*="alert"]').count();
    log(`✅ 告警条目: ${items}`);
  }

  // 设置页
  if (await nav('/settings','设置')){
    const formFields = await page.locator('input, select, textarea').count();
    log(`✅ 设置表单字段: ${formFields}`);
  }

  // 内容发布
  if (await nav('/content','内容')){
    const pubBtns = await page.locator('button').filter({hasText:/发布|生成|创建/}).count();
    log(`✅ 内容发布按钮: ${pubBtns}`);
  }

  // ========== 退出 ==========
  console.log('\n===== 退出登录 =====');
  await page.goto(`${BASE}/dashboard`, { waitUntil: WAIT, timeout: 20000 });
  await page.waitForTimeout(1000);
  const logout = page.locator('button, a').filter({hasText:/退出|登出/}).first();
  if (await logout.isVisible({timeout:3000}).catch(()=>false)) {
    await logout.click(); await page.waitForTimeout(2000);
    log(`✅ 退出完成 → ${page.url().replace(BASE,'')}`);
  } else log('⚠️ 退出按钮未找到');

  // ========== 手机号登录快速测试 ==========
  console.log('\n===== 手机号登录测试 =====');
  if (await nav('/login','手机号登录')) {
    // 默认手机号模式
    const phoneInput = page.locator('input[type="tel"], input[type="text"], input[name="phone"]').first();
    if (await phoneInput.isVisible({timeout:2000}).catch(()=>false)) {
      log('✅ 手机号登录表单出现（默认）');
    } else log('⚠️ 手机号输入框未找到');
  }

} catch(e) {
  if (e.message !== 'NOT_LOGGED_IN') console.error('致命错误:', e.message);
}

// ========== 汇总 ==========
console.log('\n========== 测试汇总 ==========');
const c = RESULTS.length;
const p = RESULTS.filter(r=>r.includes('✅')).length;
const w = RESULTS.filter(r=>r.includes('⚠️')).length;
const f = RESULTS.filter(r=>r.includes('❌')).length;
console.log(`总计 ${c} 项 | ✅ ${p} | ⚠️ ${w} | ❌ ${f}`);
RESULTS.forEach(r => console.log('  '+r));

await browser.close();
