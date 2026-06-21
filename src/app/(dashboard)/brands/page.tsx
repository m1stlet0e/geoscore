'use client';

import { useState, useEffect } from 'react';
import { Plus, Globe, Pencil, Trash2, X, Loader2, ExternalLink, Tag } from 'lucide-react';

type Brand = {
  id: string;
  name: string;
  domain: string | null;
  description: string | null;
  category: string | null;
  competitors: string[];
  status: string;
  createdAt: string;
  _count: { prompts: number; scans: number; citations: number; contentPieces: number };
};

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands');
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      setBrands(data.brands || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrands(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除品牌「${name}」？这会同时删除所有关联的扫描、引用和缺口数据。`)) return;
    try {
      const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '删除失败');
      }
      setBrands((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">BRANDS</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">品牌管理</h1>
          <p className="mt-1 text-sm text-neutral-500">管理你监控的品牌，添加后可以在监控、引用分析、缺口分析中使用</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
        >
          <Plus className="h-4 w-4" /> 添加品牌
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      {/* Brand list */}
      {brands.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-100 px-6 py-16 text-center">
          <Globe className="mx-auto h-10 w-10 text-neutral-500" />
          <h3 className="mt-4 text-base font-semibold text-neutral-700">还没有品牌</h3>
          <p className="mt-1 text-sm text-neutral-500">添加你的第一个品牌，开始监控 AI 搜索可见性</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-500 transition hover:bg-indigo-500/25"
          >
            <Plus className="h-4 w-4" /> 添加品牌
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {brands.map((brand) => (
            <div
              key={brand.id}
              className="group relative rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-indigo-500/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-neutral-800">{brand.name}</h3>
                  {brand.domain && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                      <Globe className="h-3 w-3" />
                      {brand.domain}
                    </p>
                  )}
                  {brand.category && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                      <Tag className="h-3 w-3" />
                      {brand.category}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingId(brand.id)}
                    className="rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-500"
                    title="编辑"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(brand.id, brand.name)}
                    className="rounded-md p-1.5 text-neutral-500 transition hover:bg-rose-50 hover:text-rose-400"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {brand.description && (
                <p className="mt-2 text-sm text-neutral-500 line-clamp-2">{brand.description}</p>
              )}

              {brand.competitors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {brand.competitors.map((c) => (
                    <span
                      key={c}
                      className="rounded-md border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-4 text-xs text-neutral-500">
                <span>{brand._count?.prompts ?? 0} prompts</span>
                <span>{brand._count?.scans ?? 0} 扫描</span>
                <span>{brand._count?.citations ?? 0} 引用</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <BrandFormModal
          onClose={() => setShowCreate(false)}
          onCreated={(brand) => {
            setBrands((prev) => [brand, ...prev]);
            setShowCreate(false);
          }}
        />
      )}

      {/* Edit modal */}
      {editingId && (
        <BrandFormModal
          brandId={editingId}
          onClose={() => setEditingId(null)}
          onUpdated={(brand) => {
            setBrands((prev) => prev.map((b) => (b.id === brand.id ? { ...b, ...brand } : b)));
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Create / Edit Modal ─── */

function BrandFormModal({
  brandId,
  onClose,
  onCreated,
  onUpdated,
}: {
  brandId?: string;
  onClose: () => void;
  onCreated?: (brand: Brand) => void;
  onUpdated?: (brand: Brand) => void;
}) {
  const isEdit = !!brandId;
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingBrand, setLoadingBrand] = useState(isEdit);

  useEffect(() => {
    if (!brandId) return;
    (async () => {
      try {
        const res = await fetch(`/api/brands/${brandId}`);
        if (!res.ok) throw new Error('加载品牌失败');
        const data = await res.json();
        const b = data.brand;
        setName(b.name || '');
        setDomain(b.domain || '');
        setDescription(b.description || '');
        setCategory(b.category || '');
        setCompetitors(Array.isArray(b.competitors) ? b.competitors.join(', ') : '');
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoadingBrand(false);
      }
    })();
  }, [brandId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('品牌名称必填'); return; }

    setSubmitting(true);
    setError(null);

    const body = {
      name: name.trim(),
      domain: domain.trim() || null,
      description: description.trim() || null,
      category: category.trim() || null,
      competitors: competitors
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      const url = isEdit ? `/api/brands/${brandId}` : '/api/brands';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `${isEdit ? '更新' : '创建'}失败`);
      }
      const data = await res.json();
      if (isEdit) onUpdated?.(data.brand);
      else onCreated?.(data.brand);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 p-4 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-300 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-neutral-800">
              {isEdit ? '编辑品牌' : '添加品牌'}
            </h3>
            <p className="text-xs text-neutral-500">
              {isEdit ? '修改品牌信息' : '添加你想监控 AI 可见性的品牌'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loadingBrand ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                品牌名称 <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: 极排"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                官网域名
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="例如: geoscore.ai"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                品牌描述
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述你的品牌/产品"
                rows={2}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                行业分类
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="例如: SaaS、电商、教育"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                竞品名称（逗号分隔）
              </label>
              <input
                type="text"
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
                placeholder="例如: 竞品A, 竞品B, 竞品C"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-sm font-medium text-neutral-500 transition hover:border-neutral-400"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isEdit ? '保存' : '创建品牌'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
