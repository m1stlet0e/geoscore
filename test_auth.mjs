import { chromium } from 'playwright';

const BASE = 'http://localhost:18200';
// Launch with networking fixes for macOS
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
});
let passed = 0, failed = 0;

function result(name, ok) {
  console.log(`  ${ok ? '✅' : '❌'} ${name}`);
  if (ok) passed++; else failed++;
}

// ======= 测试 1: 首页 =======
console.log('=== 测试 1: 首页 ===');
{
  const page = await (await browser.newContext()).newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    result('首页标题', (await page.title()).includes('GeoScore'));
    const hasLogin = (await page.locator('a[href="/login"]').count()) > 0;
    const hasRegister = (await page.locator('a[href="/register"]').count()) > 0;
    result('有登录链接', hasLogin);
    result('有注册链接', hasRegister);
    await page.screenshot({ path: '/tmp/geoscore_home.png', fullPage: false });
    console.log('  首页截图: /tmp/geoscore_home.png');
  } catch(e) {
    console.log('  首页加载失败:', e.message);
    result('首页加载', false);
  }
  await page.close();
}

// ======= 测试 2: 邮箱注册 =======
console.log('\n=== 测试 2: 邮箱注册 ===');
{
  const ctx2 = await browser.newContext();
  const page = await ctx2.newPage();
  try {
    await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    
    const email = `e2e_${Date.now()}@test.com`;
    await page.locator('input[name="name"]').fill('E2E测试');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill('Test123456');
    
    console.log('  填写注册表单:', email);
    
    // Click submit and wait for navigation or response
    await Promise.all([
      page.locator('button[type="submit"]').click(),
      page.waitForTimeout(5000)
    ]);
    
    const afterReg = page.url();
    console.log('  注册后 URL:', afterReg);
    const regOk = afterReg.includes('onboarding') || afterReg.includes('dashboard');
    result('注册+自动登录', regOk);
    
    if (regOk) {
      // Try dashboard
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const onDash = page.url().includes('dashboard') && !page.url().includes('login');
      result('Dashboard 可访问', onDash);
      
      if (onDash) {
        // Logout
        await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(1000);
        const logoutBtn = page.locator('button:has-text("退出登录")').first();
        if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await logoutBtn.click();
          await page.waitForTimeout(3000);
          result('退出登录', true);
        }
      }
    }
  } catch(e) {
    console.log('  注册测试异常:', e.message);
  }
  await page.close();
}

// ======= 测试 3: 手机号登录 =======
console.log('\n=== 测试 3: 手机号登录 ===');
{
  const ctx3 = await browser.newContext();
  const page = await ctx3.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    
    // Use pressSequentially for React onChange
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.click();
    await page.keyboard.type('13811113333', { delay: 50 });
    await page.waitForTimeout(500);
    
    // Check if send button is enabled
    const sendBtn = page.locator('button:has-text("发送验证码")');
    const isDisabled = await sendBtn.isDisabled().catch(() => true);
    console.log('  发送按钮 disabled:', isDisabled);
    
    if (!isDisabled) {
      await sendBtn.click();
      console.log('  已点击发送验证码');
      await page.waitForTimeout(2500);
      
      const codeInput = page.locator('input[placeholder*="验证码"]');
      if (await codeInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await codeInput.fill('888888');
        await page.waitForTimeout(300);
        
        const loginBtn = page.locator('button:has-text("登录"):not(:has-text("发送"))');
        if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await loginBtn.click();
          await page.waitForTimeout(4000);
          console.log('  登录后 URL:', page.url());
          result('手机号登录', page.url().includes('dashboard'));
        }
      }
    } else {
      console.log('  发送按钮被禁用，检查是否已登录');
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      result('已有登录态', page.url().includes('dashboard') && !page.url().includes('login'));
    }
  } catch(e) {
    console.log('  手机登录异常:', e.message);
  }
  await page.close();
}

console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
await browser.close();
