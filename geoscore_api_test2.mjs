const BASE = 'http://localhost:18200';
let passed = 0, failed = 0;
const ok = (n) => { passed++; console.log(`   ✅ ${n}`); };
const fl = (n,d) => { failed++; console.log(`   ❌ ${n}${d?': '+d:''}`); };

async function login() {
  const r = await fetch(BASE+'/api/auth/email-login', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({email:'demo@geoscore.ai', password:'demo123456'})
  });
  const setCookie = r.headers.getSetCookie?.()?.[0] || r.headers.get('set-cookie') || '';
  return setCookie;
}

const COOKIE = await login();
const h = (extra={}) => ({ ...extra, Cookie: COOKIE, 'Content-Type': 'application/json' });

// 获取一个 brandId 用于依赖它的 API
let brandId = null;
{
  const r = await fetch(BASE+'/api/brands', {headers:h()});
  if (r.ok) { const d = await r.json(); if (d.brands?.length) brandId = d.brands[0].id; }
}
// 没有品牌就创建一个
if (!brandId) {
  const r = await fetch(BASE+'/api/brands', {
    method:'POST', headers:h(),
    body: JSON.stringify({name:'data-test-brand', domain:'data-test.com', category:'SaaS'})
  });
  if (r.ok) { const d = await r.json(); brandId = d.brand?.id; }
}

console.log(`   使用 brandId: ${brandId?.slice(0,8) || 'NONE'}`);

// 需要 brandId 的 API
const branded = brandId ? `?brandId=${brandId}` : '';

// ===== 健康 =====
{ const r = await fetch(BASE+'/api/health'); if(r.ok) ok('GET /api/health'); else fl('health',r.status); }

// ===== 品牌 =====
{ const r = await fetch(BASE+'/api/brands', {headers:h()}); if(r.ok) ok('GET /api/brands'); else fl('brands',r.status); }
if (brandId) {
  { const r = await fetch(BASE+'/api/brands/'+brandId, {headers:h()}); if(r.ok) ok('GET /api/brands/:id'); else fl('brands/:id',r.status); }
}

// ===== 用户 =====
{ const r = await fetch(BASE+'/api/user/me', {headers:h()}); if(r.ok) ok('GET /api/user/me'); else fl('user/me',r.status); }
{ const r = await fetch(BASE+'/api/user/usage', {headers:h()}); if(r.ok) ok('GET /api/user/usage'); else fl('user/usage',r.status); }

// ===== 仪表盘 =====
{ const r = await fetch(BASE+'/api/dashboard/summary', {headers:h()}); if(r.ok) ok('GET /api/dashboard/summary'); else fl('dashboard',r.status); }

// ===== 引用分析(需brandId) =====
for (const ep of ['/api/citations/stats','/api/citations/factors','/api/citations/evidences','/api/citations/sources','/api/citations/trend','/api/citations/platforms']) {
  const r = await fetch(BASE+ep+branded, {headers:h()});
  if (r.ok) ok(`GET ${ep}`);
  else fl(ep, r.status);
}

// ===== 缺口 =====
for (const ep of ['/api/gaps','/api/gaps/summary']) {
  const r = await fetch(BASE+ep+branded, {headers:h()});
  if (r.ok) ok(`GET ${ep}`);
  else fl(ep, r.status);
}

// ===== 内容 =====
{ const r = await fetch(BASE+'/api/content'+branded, {headers:h()}); if(r.ok) ok('GET /api/content'); else fl('content',r.status); }
{ const r = await fetch(BASE+'/api/content/stats'+branded, {headers:h()}); if(r.ok) ok('GET /api/content/stats'); else fl('content/stats',r.status); }
{ const r = await fetch(BASE+'/api/content/types', {headers:h()}); if(r.ok) ok('GET /api/content/types'); else fl('content/types',r.status); }

// ===== 扫描 =====
{ const r = await fetch(BASE+'/api/scans', {headers:h()}); if(r.ok) ok('GET /api/scans'); else fl('scans',r.status); }
{ const r = await fetch(BASE+'/api/scans/recent', {headers:h()}); if(r.ok) ok('GET /api/scans/recent'); else fl('scans/recent',r.status); }

// ===== 预测 =====
{ const r = await fetch(BASE+'/api/forecast'+branded, {headers:h()}); if(r.ok) ok('GET /api/forecast'); else fl('forecast',r.status); }

// ===== 警报 =====
{ const r = await fetch(BASE+'/api/alerts', {headers:h()}); if(r.ok) ok('GET /api/alerts'); else fl('alerts',r.status); }
{ const r = await fetch(BASE+'/api/alerts/unread-count', {headers:h()}); if(r.ok) ok('GET /api/alerts/unread-count'); else fl('unread-count',r.status); }

// ===== Prompts =====
{ const r = await fetch(BASE+'/api/prompts'+branded, {headers:h()}); if(r.ok) ok('GET /api/prompts'); else fl('prompts',r.status); }

// ===== 配额与计费 =====
{ const r = await fetch(BASE+'/api/quota', {headers:h()}); if(r.ok) ok('GET /api/quota'); else fl('quota',r.status); }
for (const ep of ['/api/billing/plans','/api/billing/subscription','/api/billing/orders']) {
  const r = await fetch(BASE+ep, {headers:h()});
  if (r.ok) ok(`GET ${ep}`);
  else fl(ep, r.status);
}

// ===== 来源 =====
{ const r = await fetch(BASE+'/api/sources'+branded, {headers:h()}); if(r.ok) ok('GET /api/sources'); else fl('sources',r.status); }

// ===== Admin (预期 403 = 正确拦截) =====
for (const ep of ['/api/admin/stats','/api/admin/logs']) {
  const r = await fetch(BASE+ep, {headers:h()});
  if (r.status===403) ok(`GET ${ep} → 403 (权限拦截正确)`);
  else fl(ep, r.status);
}

// ===== 雷达 =====
{ const r = await fetch(BASE+'/api/radar/signals'+branded, {headers:h()}); if(r.ok) ok('GET /api/radar/signals'); else fl('radar',r.status); }

// ===== 清理测试品牌 =====
if (brandId) {
  const r = await fetch(BASE+'/api/brands/'+brandId, {method:'DELETE', headers:h()});
  if (r.ok) ok('清理测试品牌');
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ✅ ${passed} 通过  ❌ ${failed} 失败`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━`);
process.exit(failed>0?1:0);
