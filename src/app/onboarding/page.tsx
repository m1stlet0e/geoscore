'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, Globe, MessageSquare, Zap } from 'lucide-react';

const STEPS = [
  { id: 1, title: '添加你的品牌', icon: Globe, desc: '输入品牌名和官网，让 AI 开始监控' },
  { id: 2, title: '设置监控问题', icon: MessageSquare, desc: '选择你想监控的 AI 问答场景' },
  { id: 3, title: '首次扫描', icon: Zap, desc: '一键扫描 7 大国内 AI 平台' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [brandName, setBrandName] = useState('');
  const [brandDomain, setBrandDomain] = useState('');
  const [brandCategory, setBrandCategory] = useState('AI');
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [brandId, setBrandId] = useState('');
  const [error, setError] = useState('');

  const presetPrompts = [
    '推荐一些好用的 AI 工具',
    '有哪些值得信赖的大语言模型',
    '最好的开源 AI 框架有哪些',
    '如何选择 AI 编程助手',
    'AI 写作工具哪个好',
  ];

  async function handleCreateBrand() {
    if (!brandName.trim() || !brandDomain.trim()) {
      setError('请填写品牌名和官网');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: brandName.trim(),
          domain: brandDomain.trim(),
          category: brandCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');
      setBrandId(data.brand?.id || data.id);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建品牌失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePrompts() {
    if (selectedPrompts.length === 0) {
      setError('请至少选择一个问题');
      return;
    }
    setLoading(true);
    setError('');
    try {
      for (const text of selectedPrompts) {
        await fetch(`/api/brands/${brandId}/prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        }).catch(() => {
          // Try alternative endpoint
          return fetch('/api/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brandId, text }),
          });
        });
      }
      setStep(3);
    } catch {
      setError('添加问题失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleFirstScan() {
    setLoading(true);
    setError('');
    try {
      // Create a scan
      const scanRes = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      });
      const scanData = await scanRes.json();
      const scanId = scanData.scan?.id || scanData.id;

      if (scanId) {
        // Execute scan
        await fetch(`/api/scans/${scanId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      // Even if scan fails, go to dashboard
      router.push('/dashboard');
    }
  }

  function handleSkip() {
    router.push('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-20" aria-hidden="true" />

      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-3">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                step > s.id ? 'bg-emerald-500 text-white' :
                step === s.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' :
                'bg-neutral-200 text-neutral-500'
              }`}>
                {step > s.id ? <CheckCircle2 className="h-5 w-5" /> : s.id}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-12 ${step > s.id ? 'bg-emerald-400' : 'bg-neutral-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="surface-raised rounded-2xl p-7 shadow-2xl sm:p-8">
          {/* Step 1: Add Brand */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center">
                <Globe className="mx-auto mb-3 h-10 w-10 text-indigo-500" />
                <h2 className="text-xl font-semibold text-neutral-900">添加你的品牌</h2>
                <p className="mt-1 text-sm text-neutral-500">告诉我们要监控哪个品牌</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-600">品牌名称</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="例如：Nous Research"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-600">官网域名</label>
                <input
                  type="text"
                  value={brandDomain}
                  onChange={(e) => setBrandDomain(e.target.value)}
                  placeholder="例如：nousresearch.com"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-600">行业</label>
                <select
                  value={brandCategory}
                  onChange={(e) => setBrandCategory(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="AI">AI / 大模型</option>
                  <option value="SaaS">SaaS / 软件</option>
                  <option value="电商">电商 / 零售</option>
                  <option value="教育">教育 / 培训</option>
                  <option value="金融">金融 / 投资</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3">
                <button onClick={handleSkip} className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50">
                  跳过
                </button>
                <button onClick={handleCreateBrand} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '下一步'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select Prompts */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-indigo-500" />
                <h2 className="text-xl font-semibold text-neutral-900">选择监控问题</h2>
                <p className="mt-1 text-sm text-neutral-500">选择用户可能向 AI 提问的场景</p>
              </div>

              <div className="space-y-2">
                {presetPrompts.map((p) => (
                  <label
                    key={p}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      selectedPrompts.includes(p) ? 'border-indigo-400 bg-indigo-50' : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPrompts.includes(p)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedPrompts([...selectedPrompts, p]);
                        else setSelectedPrompts(selectedPrompts.filter((x) => x !== p));
                      }}
                      className="h-4 w-4 rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700">{p}</span>
                  </label>
                ))}
              </div>

              <p className="text-xs text-neutral-400">已选 {selectedPrompts.length} 个（可多选）</p>
              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50">
                  上一步
                </button>
                <button onClick={handleCreatePrompts} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '下一步'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: First Scan */}
          {step === 3 && (
            <div className="space-y-5 text-center">
              <Zap className="mx-auto mb-3 h-10 w-10 text-indigo-500" />
              <h2 className="text-xl font-semibold text-neutral-900">准备首次扫描</h2>
              <p className="text-sm text-neutral-500">
                即将扫描 7 大国内 AI 平台（DeepSeek、通义千问、文心一言、智谱清言、Kimi、豆包、腾讯元宝），
                看看它们怎么评价 <strong>{brandName}</strong>。
              </p>

              <div className="rounded-lg bg-indigo-50 p-4 text-left text-sm text-indigo-700">
                <p className="font-medium">⏱ 预计耗时 1-2 分钟</p>
                <p className="mt-1 text-indigo-600">扫描完成后会自动生成引用分析、缺口分析、趋势预测等数据。</p>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3">
                <button onClick={handleSkip} className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50">
                  稍后再扫
                </button>
                <button onClick={handleFirstScan} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-60">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> 扫描中...</>
                  ) : (
                    <>🚀 开始扫描</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
