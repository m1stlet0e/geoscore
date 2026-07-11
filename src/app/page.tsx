import Link from "next/link";
import { ArrowRight, CheckCircle2, Radar, ScanSearch, Sparkles } from "lucide-react";

const metrics = [
  ["提及度", "品牌是否进入 AI 回答"],
  ["推荐度", "品牌是否成为优先选择"],
  ["竞品声量", "与竞争对手相比的注意力份额"],
  ["引用度", "官网内容是否成为 AI 信源"],
  ["情感度", "AI 如何理解和评价品牌"],
];

export default function Home() {
  return (
    <main className="site-shell">
      <nav className="site-nav" aria-label="主导航">
        <Link href="/" className="brand-mark" aria-label="GeoScore 首页">
          <span>G</span>eoScore
        </Link>
        <div className="nav-links">
          <a href="#method">评分方法</a>
          <a href="#pricing">价格</a>
          <Link href="/login">登录</Link>
          <Link href="/register" className="nav-cta">免费体检</Link>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><Radar size={16} /> 面向中国品牌的 AI 搜索情报</p>
          <h1>你的品牌，正在被 AI 推荐吗？</h1>
          <p className="hero-lead">
            持续检测品牌在 DeepSeek 等真实 AI 回答中的提及、推荐、引用和竞品表现，
            把看不见的 AI 心智变成可验证、可优化的数据。
          </p>
          <div className="hero-actions">
            <Link href="/register" className="primary-button">
              免费检测品牌 <ArrowRight size={18} />
            </Link>
            <a href="#method" className="text-button">查看评分方法</a>
          </div>
          <p className="hero-note"><CheckCircle2 size={15} /> 无需安装代码 · 免费生成初步报告</p>
        </div>

        <div className="score-preview" aria-label="GeoScore 报告示例">
          <div className="preview-topline">
            <span>AI 可见度快照</span><span className="live-dot">真实证据</span>
          </div>
          <div className="score-main">
            <div className="score-ring"><strong>72</strong><small>/ 100</small></div>
            <div><span className="score-label">GeoScore</span><p>已建立认知，仍有 8 个高价值问题被竞品占据。</p></div>
          </div>
          <div className="mini-bars">
            <div><span>品牌提及度</span><i style={{ width: "78%" }} /><b>78</b></div>
            <div><span>品牌推荐度</span><i style={{ width: "64%" }} /><b>64</b></div>
            <div><span>引用可信度</span><i style={{ width: "55%" }} /><b>55</b></div>
          </div>
          <div className="evidence-card"><ScanSearch size={18} /><span>“适合成长型团队的客户管理工具？”</span><strong>发现 3 个竞品机会</strong></div>
        </div>
      </section>

      <section id="method" className="method-section">
        <div className="section-heading">
          <p className="eyebrow"><Sparkles size={16} /> 不止是一个漂亮分数</p>
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

      <section id="pricing" className="closing-section">
        <div><p className="eyebrow">从一次免费体检开始</p><h2>让每一次内容投入，都能被 AI 看见。</h2></div>
        <Link href="/register" className="primary-button">创建品牌报告 <ArrowRight size={18} /></Link>
      </section>

      <footer><span>© 2026 GeoScore</span><span>评分有证据，增长有方向。</span></footer>
    </main>
  );
}
