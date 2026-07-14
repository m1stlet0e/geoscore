import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Radar,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { PLAN_CATALOG, PLAN_CODES } from "@/lib/plans";

const journey = [
  {
    title: "扫描定位",
    description: "逐条检查品牌提及、推荐、引用与竞品表现，定位具体由哪个用户问题产生差距。",
  },
  {
    title: "抢位行动",
    description: "把问题级缺口整理成增长实验，保存行动计划、目标网址和发布状态。",
  },
  {
    title: "同配置手动复测",
    description: "发布后由你发起复测，复用相同问题、AI 数据源和采样次数，对比前后变化。",
  },
] as const;

const metrics = [
  ["提及度", "品牌是否进入 AI 回答"],
  ["推荐度", "品牌是否成为优先选择"],
  ["竞品声量", "与竞争对手相比的注意力份额"],
  ["引用度", "官网内容是否成为 AI 信源"],
  ["情感度", "AI 如何理解和评价品牌"],
] as const;

function formatPrice(priceCents: number) {
  return `¥${priceCents / 100}`;
}

export default function Home() {
  return (
    <main className="site-shell">
      <nav className="site-nav" aria-label="主导航">
        <Link href="/" className="brand-mark" aria-label="GeoScore 首页">
          <span>G</span>eoScore
        </Link>
        <div className="nav-links">
          <a href="#method">如何运作</a>
          <a href="#pricing">套餐价格</a>
          <Link href="/login">登录</Link>
          <Link href="/register" className="nav-cta">免费体检</Link>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><Radar size={16} /> 从问题级证据到增长验证</p>
          <h1>把 AI 没有推荐你的原因，变成可以执行和验证的增长任务</h1>
          <p className="hero-lead">
            GeoScore 定位品牌未被提及、竞品领先和引用缺口，把原始回答变成行动实验；
            发布后由你手动发起同配置复测，留下可以回查的前后变化。
          </p>
          <div className="hero-actions">
            <Link href="/register" className="primary-button">
              开始免费体检 <ArrowRight size={18} />
            </Link>
            <a href="#method" className="text-button">查看增长闭环</a>
          </div>
          <p className="hero-note">
            <CheckCircle2 size={15} /> 免费额度可完成一次 20 问题模拟扫描
          </p>
        </div>

        <div className="score-preview" aria-label="GeoScore 报告示例">
          <div className="preview-topline">
            <span>AI 可见度快照</span><span className="live-dot">报告示例</span>
          </div>
          <div className="score-main">
            <div className="score-ring"><strong>72</strong><small>/ 100</small></div>
            <div>
              <span className="score-label">GeoScore</span>
              <p>已建立认知，仍有 8 个高价值问题被竞品占据。</p>
            </div>
          </div>
          <div className="mini-bars">
            <div><span>品牌提及度</span><i style={{ width: "78%" }} /><b>78</b></div>
            <div><span>品牌推荐度</span><i style={{ width: "64%" }} /><b>64</b></div>
            <div><span>引用可信度</span><i style={{ width: "55%" }} /><b>55</b></div>
          </div>
          <div className="evidence-card">
            <ScanSearch size={18} />
            <span>“适合成长型企业的客户管理工具？”</span>
            <strong>发现 3 个问题级抢位机会</strong>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="产品能力概览">
        <span>从发现到验证的 GEO 操作系统</span>
        <div><b>问题级</b><small>不只看总分</small></div>
        <div><b>多模型</b><small>明确输给谁</small></div>
        <div><b>可回溯</b><small>保留原始证据</small></div>
        <div><b>可验证</b><small>复扫确认变化</small></div>
      </section>

      <section id="method" className="journey-section">
        <div className="section-heading journey-heading">
          <p className="eyebrow"><Sparkles size={16} /> 一条完整的增长证据链</p>
          <h2>不是交付一个分数，而是完成一次可验证的增长循环</h2>
        </div>
        <div className="journey-grid">
          {journey.map((step, index) => (
            <article key={step.title}>
              <span>STEP 0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              {index < journey.length - 1 && <ArrowRight aria-hidden="true" size={24} />}
            </article>
          ))}
        </div>
        <aside className="data-boundary" aria-label="数据边界说明">
          <strong>数据边界</strong>
          <p><b>模拟扫描仅用于体验闭环，不代表真实 AI 表现</b>；真实证据来自真实 AI 数据源及其原始回答。</p>
        </aside>
      </section>

      <section className="signal-workbench">
        <div className="signal-workbench-copy">
          <p className="eyebrow"><Radar size={16} /> 不是另一个漂亮仪表盘</p>
          <h2>把“看不见”的 AI 认知，变成今天可以处理的品牌信号。</h2>
          <p>情报总览会把未提及、竞品领先、负面口碑和引用缺口按 P0/P1/P2 排队；每一个信号都能一路回到提问、模型和原始回答。</p>
          <Link href="/register" className="text-button">用自己的品牌建立基线 <ArrowRight size={15} /></Link>
        </div>
        <div className="signal-workbench-board" aria-label="情报队列示例">
          <div className="workbench-top"><span>ACTION QUEUE</span><b>今日 04 个信号</b></div>
          <article><i>P0</i><div><strong>核心采购问题未提及</strong><p>DeepSeek · “适合成长团队的 CRM？”</p></div><span>竞品甲 #1</span></article>
          <article><i>P1</i><div><strong>负面评价需要回应</strong><p>通义千问 · 价格透明度证据不足</p></div><span>查看证据</span></article>
          <article><i>P2</i><div><strong>官网内容被 AI 引用</strong><p>可标记为自有资产并持续建设</p></div><span>引用溯源</span></article>
        </div>
      </section>

      <section className="method-section">
        <div className="section-heading">
          <p className="eyebrow"><Sparkles size={16} /> 每个结论都能回到原始回答</p>
          <h2>五个维度，还原品牌在 AI 世界里的真实位置</h2>
        </div>
        <div className="metric-grid">
          {metrics.map(([title, description], index) => (
            <article key={title}>
              <span>0{index + 1}</span><h3>{title}</h3><p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="site-pricing-section">
        <div className="site-pricing-heading">
          <div>
            <p className="eyebrow">按增长阶段选择</p>
            <h2>从一次免费体检，到持续积累实验和历史证据</h2>
          </div>
          <p>套餐价值由可管理品牌数、增长实验和历史归因构成；回答额度用于每次扫描与复测。</p>
        </div>
        <div className="site-pricing-grid">
          {PLAN_CODES.map((code) => {
            const plan = PLAN_CATALOG[code];
            return (
              <article
                key={code}
                className={`site-plan-card${code === "PRO" ? " site-plan-featured" : ""}`}
                aria-label={`${plan.name}套餐`}
              >
                <div className="site-plan-topline">
                  <span>{plan.name}</span>
                  {code === "PRO" && <b>增长主力</b>}
                </div>
                <strong className="site-plan-price">{formatPrice(plan.priceCents)}</strong>
                <p className="site-plan-cycle">{code === "FREE" ? "长期免费" : "每月"}</p>
                <ul>
                  {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <p className="site-plan-quota">
                  {code === "FREE" ? "注册后发放" : "每次购买发放"} {plan.monthlyResponses.toLocaleString()} 次回答额度
                </p>
                <Link href="/register" className={code === "PRO" ? "primary-button" : "site-plan-link"}>
                  {code === "FREE" ? "免费开始" : "注册后选择"}<ArrowRight size={16} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="closing-section">
        <div>
          <p className="eyebrow">从一次免费体检开始</p>
          <h2>先找到没被推荐的问题，再验证一次行动有没有改变结果。</h2>
        </div>
        <Link href="/register" className="primary-button">
          创建品牌报告 <ArrowRight size={18} />
        </Link>
      </section>

      <footer>
        <span>© 2026 GeoScore</span>
        <span className="footer-links"><Link href="/privacy">隐私政策</Link><Link href="/terms">服务协议</Link></span>
        <span>评分有证据，增长有方向。</span>
      </footer>
    </main>
  );
}
