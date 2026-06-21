import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await (await browser.newContext()).newPage();

await page.goto('http://localhost:18200/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(2000);

// 输入手机号
const telInput = page.locator('input[type="tel"]');
await telInput.click();
await page.keyboard.type('13987654321', { delay: 80 });
await page.waitForTimeout(500);

// 点击发送验证码
const sendBtn = page.locator('button:has-text("发送验证码")');
console.log('发送按钮 disabled:', await sendBtn.isDisabled());
await sendBtn.click();
console.log('已点击发送验证码');
await page.waitForTimeout(2500);

// 输入验证码
const codeInput = page.locator('input[placeholder*="验证码"]');
const visible = await codeInput.isVisible({ timeout: 4000 }).catch(() => false);
console.log('验证码输入框可见:', visible);

if (visible) {
  await codeInput.fill('888888');
  await page.waitForTimeout(300);
  
  // 精确选择 "登录 / 注册" 按钮（排除其他含"登录"的按钮）
  const allBtns = page.locator('button');
  const count = await allBtns.count();
  console.log('页面按钮总数:', count);
  
  // 找包含 "登录" 且包含 "/" 的按钮
  const loginBtn = page.locator('button:has-text("登录 / 注册")');
  console.log('"登录/注册" 按钮数:', await loginBtn.count());
  
  if (await loginBtn.count() > 0) {
    await loginBtn.first().click();
    console.log('已点击登录/注册');
    await page.waitForTimeout(5000);
    console.log('当前 URL:', page.url());
    console.log('结果:', page.url().includes('dashboard') ? '✅ 登录成功' : '❌ 仍在登录页');
  }
}

await page.screenshot({ path: '/tmp/geoscore_phone.png' });
await browser.close();
