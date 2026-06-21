import { chromium } from 'playwright';

const BASE = 'http://localhost:18200';
const TEST_EMAIL = `e2e_${Date.now()}@geoscore.test`;
const TEST_PASS = 'Test123456';

let passed = 0, failed = 0, warnings = 0;
const ok = (n) => { passed++; console.log(`   ✅ ${n}`); };
const fl = (n,d) => { failed++; console.log(`   ❌ ${n}${d?': '+d:''}`); };
const wn = (n,d) => { warnings++; console.log(`   ⚠️ ${n}${d?': '+d:''}`); };

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

// ============ PHASE 1: 公开页面 ============
console.log('\n━━━ PHASE 1: 公开页面 ━━━');
for (const [path, expect] of [['/', 'GeoScore'], ['/login', '登录'], ['/register', 'GeoScore']]) {
  const ctx = await browser.newContext(); const pg = await ctx.newPage();
  try {
    const r = await pg.goto(BASE+path, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (r?.status()===200) ok(`${path} → 200`);
    else fl(`${path} HTTP ${r?.status()}`);
  } catch(e) { fl(`${path} 异常`, e.message.slice(0,50)); }
  await ctx.close();
}

// ============ PHASE 2: 注册 ============
console.log('\n━━━ PHASE 2: 注册 ━━━');
const ctx = await browser.newContext(); const pg = await ctx.newPage();
await pg.goto(BASE+'/register', { waitUntil: 'domcontentloaded', timeout: 15000 });
await pg.waitForTimeout(1000);
if (await pg.locator('input[name="name"]').isVisible()) ok('注册表单可见'); else fl('注册表单不可见');
await pg.locator('input[name="name"]').fill('E2E测试');
await pg.locator('input[name="email"]').fill(TEST_EMAIL);
await pg.locator('input[name="password"]').fill(TEST_PASS);
await pg.locator('button[type="submit"]').click();
await pg.waitForTimeout(5000);
if (pg.url().includes('onboarding')||pg.url().includes('dashboard')) ok('注册成功→自动登录');
else fl('注册后未跳转', pg.url());

// ============ PHASE 3: Dashboard 13页加载 ============
console.log('\n━━━ PHASE 3: 仪表盘13页加载 ━━━');
const pages = [
  ['/dashboard','总览看板'],['/brands','品牌管理'],['/monitor','监控中心'],
  ['/citations','引用分析'],['/sources','来源追踪'],['/influence','影响力地图'],
  ['/gaps','缺口分析'],['/growth','增长中心'],['/content','内容中心'],
  ['/radar','趋势雷达'],['/forecast','预测模型'],['/alerts','实时警报'],
  ['/settings','系统设置'],['/settings/billing','计费管理'],
];
for (const [p, n] of pages) {
  try {
    await pg.goto(BASE+p, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!pg.url().includes('login')) ok(`${n} (${p}) → 200`);
    else fl(`${n} (${p}) → 登录拦截`);
  } catch(e) { fl(`${n} (${p}) 异常`, e.message.slice(0,50)); }
}

// ============ PHASE 4: 品牌 CRUD ============
console.log('\n━━━ PHASE 4: 品牌 CRUD ━━━');
await pg.goto(BASE+'/brands', { waitUntil: 'domcontentloaded', timeout: 15000 });
await pg.waitForTimeout(1500);

// Open create modal
const addBtn = pg.locator('button:has-text("添加品牌")').first();
if (await addBtn.isVisible({timeout:2000}).catch(()=>false)) {
  await addBtn.click(); await pg.waitForTimeout(1000);
  ok('添加品牌弹窗打开');
} else { fl('添加品牌按钮不可见'); }

// Fill form - use placeholder-less approach
const inputs = pg.locator('input:not([type="hidden"])');
const inputCount = await inputs.count();
console.log(`   弹窗内 input 数量: ${inputCount}`);
// First visible text input = name, second = domain, third = category
const visibleInputs = [];
for (let i = 0; i < inputCount; i++) {
  if (await inputs.nth(i).isVisible().catch(()=>false)) visibleInputs.push(inputs.nth(i));
}
console.log(`   可见 input: ${visibleInputs.length}`);

if (visibleInputs.length >= 2) {
  await visibleInputs[0].fill('测试品牌A');
  await visibleInputs[1].fill('test-brand-a.com');
  ok('品牌名和域名填写成功');
}

// Textarea for description
const ta = pg.locator('textarea').first();
if (await ta.isVisible({timeout:2000}).catch(()=>false)) {
  await ta.fill('这是测试描述');
  ok('描述填写成功');
}

// Competitors input - last visible input
if (visibleInputs.length >= 3) {
  await visibleInputs[visibleInputs.length-1].fill('竞品1, 竞品2');
  ok('竞品填写成功');
}

// Submit
const submit = pg.locator('button:has-text("创建品牌")');
if (await submit.isVisible({timeout:2000}).catch(()=>false)) {
  await submit.click(); await pg.waitForTimeout(3000);
  ok('提交创建品牌');
} else { fl('创建品牌按钮不可见'); }

// Verify
if (await pg.locator('text=测试品牌A').isVisible({timeout:3000}).catch(()=>false)) ok('品牌卡片显示');
else { fl('品牌卡片未出现'); await pg.screenshot({path:'/tmp/brand_fail.png'}); }

// Edit
const editBtn = pg.locator('button[title="编辑"]').first();
if (await editBtn.isVisible({timeout:2000}).catch(()=>false)) {
  await editBtn.click(); await pg.waitForTimeout(1000);
  const editTitle = pg.locator('text=编辑品牌');
  if (await editTitle.isVisible({timeout:2000}).catch(()=>false)) ok('编辑弹窗打开');
  else fl('编辑弹窗未打开');
  
  // Edit name
  const editInputs = pg.locator('input:not([type="hidden"])');
  const editVisible = [];
  for (let i=0;i<await editInputs.count();i++) if (await editInputs.nth(i).isVisible().catch(()=>false)) editVisible.push(editInputs.nth(i));
  if (editVisible.length>0) { await editVisible[0].fill(''); await editVisible[0].fill('测试品牌A-已编辑'); }
  
  await pg.locator('button:has-text("保存")').click();
  await pg.waitForTimeout(2000);
  if (await pg.locator('text=测试品牌A-已编辑').isVisible({timeout:3000}).catch(()=>false)) ok('品牌编辑成功');
  else fl('编辑后名称未更新');
} else fl('编辑按钮不可见');

// Delete
await pg.goto(BASE+'/brands', { waitUntil: 'domcontentloaded', timeout: 15000 }); await pg.waitForTimeout(1500);
const delBtn = pg.locator('button[title="删除"]').first();
if (await delBtn.isVisible({timeout:2000}).catch(()=>false)) {
  pg.once('dialog', async d=>{await d.accept();});
  await delBtn.click(); await pg.waitForTimeout(2000);
  if (!(await pg.locator('text=测试品牌A').isVisible({timeout:2000}).catch(()=>false))) ok('品牌删除成功');
  else fl('品牌可能未删除');
} else fl('删除按钮不可见');

// ============ PHASE 5: 设置页 ============
console.log('\n━━━ PHASE 5: 设置页检查 ━━━');
await pg.goto(BASE+'/settings', { waitUntil: 'domcontentloaded', timeout: 15000 }); await pg.waitForTimeout(1500);
if (await pg.locator(`text=${TEST_EMAIL}`).isVisible({timeout:3000}).catch(()=>false)) ok('用户邮箱显示');
else wn('用户邮箱未显示');

const planEl = pg.locator('text=FREE').first();
if (await planEl.isVisible({timeout:2000}).catch(()=>false)) ok('FREE 套餐显示');
else wn('套餐未显示');

const usageBar = pg.locator('text=品牌数');
if (await usageBar.isVisible({timeout:2000}).catch(()=>false)) ok('用量条显示');

// Billing page
await pg.goto(BASE+'/settings/billing', { waitUntil: 'domcontentloaded', timeout: 15000 }); await pg.waitForTimeout(1500);
if (!pg.url().includes('login')) ok('计费页面可访问');

// ============ PHASE 6: 退出登录 ============
console.log('\n━━━ PHASE 6: 退出登录 ━━━');
await pg.goto(BASE+'/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 }); await pg.waitForTimeout(1500);
const logoutBtn = pg.locator('button:has-text("退出登录")').first();
if (await logoutBtn.isVisible({timeout:3000}).catch(()=>false)) {
  await logoutBtn.click(); await pg.waitForTimeout(3000);
  if (pg.url()===BASE+'/' || pg.url()===BASE) ok('退出登录→首页');
  else wn('退出后URL', pg.url());
} else fl('退出登录按钮不可见');

// ============ PHASE 7: 重新登录 ============
console.log('\n━━━ PHASE 7: 重新登录 ━━━');
await pg.goto(BASE+'/login', { waitUntil: 'domcontentloaded', timeout: 15000 }); await pg.waitForTimeout(1500);
const emailTab = pg.locator('button:has-text("邮箱登录")');
if (await emailTab.isVisible({timeout:2000}).catch(()=>false)) { await emailTab.click(); await pg.waitForTimeout(500); ok('邮箱登录Tab'); }
await pg.locator('input[name="email"]').fill(TEST_EMAIL);
await pg.locator('input[name="password"]').fill(TEST_PASS);
await pg.locator('button[type="submit"]').click();
await pg.waitForTimeout(5000);
if (pg.url().includes('/dashboard')) ok('重新登录成功');
else fl('重新登录失败', pg.url());

// ============ PHASE 8: 手机号登录 ============
console.log('\n━━━ PHASE 8: 手机号登录 ━━━');
const pctx = await browser.newContext(); const pp = await pctx.newPage();
try {
  await pp.goto(BASE+'/login', { waitUntil: 'domcontentloaded', timeout: 15000 }); await pp.waitForTimeout(1500);
  const telInput = pp.locator('input[type="tel"]');
  if (await telInput.isVisible({timeout:2000}).catch(()=>false)) {
    ok('手机号输入框可见');
    await telInput.click(); await pp.keyboard.type('13811117777', {delay:50}); await pp.waitForTimeout(500);
    const sb = pp.locator('button:has-text("发送验证码")');
    if (!(await sb.isDisabled().catch(()=>true))) { await sb.click(); await pp.waitForTimeout(2500); ok('发送验证码点击成功'); }
    else fl('发送按钮被禁用');
    const ci = pp.locator('input[placeholder*="验证码"]');
    if (await ci.isVisible({timeout:3000}).catch(()=>false)) {
      ok('验证码输入框出现');
      let code='888888';
      const dc = pp.locator('text=开发环境验证码');
      if (await dc.isVisible({timeout:2000}).catch(()=>false)) { const t=await dc.textContent(); const m=t?.match(/(\d{6})/); if(m) code=m[1]; }
      await ci.fill(code); await pp.waitForTimeout(300);
      const lb = pp.locator('button:has-text("登录 / 注册")');
      await lb.first().click(); await pp.waitForTimeout(5000);
      if (pp.url().includes('/dashboard')) ok('手机号登录成功');
      else fl('手机号登录后未跳转', pp.url());
    } else fl('验证码输入框未出现');
  } else fl('手机号输入框不可见');
} catch(e) { fl('手机登录异常', e.message.slice(0,80)); }
await pctx.close();

// ============ SUMMARY ============
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ✅ ${passed} 通过  ❌ ${failed} 失败  ⚠️ ${warnings} 警告`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
await ctx.close(); await browser.close();
process.exit(failed>0?1:0);
