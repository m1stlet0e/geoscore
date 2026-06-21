import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, CheckCircle2, Clock, Send, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { prisma } from '@/lib/prisma';
import { CONTENT_TYPES } from '@/lib/constants';
import { cn, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  draft: { label: '草稿', cls: 'border-neutral-300 bg-neutral-100 text-neutral-500', icon: <Clock className="h-3 w-3" /> },
  approved: { label: '已审核', cls: 'border-indigo-500/30 bg-indigo-50 text-indigo-600', icon: <CheckCircle2 className="h-3 w-3" /> },
  published: { label: '已发布', cls: 'border-emerald-500/30 bg-emerald-50 text-emerald-600', icon: <Send className="h-3 w-3" /> },
};

export default async function GrowthPage({ searchParams }: { searchParams: Promise<{ brandId?: string; prompt?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;
  const { brandId } = await searchParams;

  const brands = await prisma.brand.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const activeBrand = brandId ? brands.find((b) => b.id === brandId) || brands[0] : brands[0];

  const pieces = await prisma.contentPiece.findMany({
    where: { userId, ...(activeBrand ? { brandId: activeBrand.id } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { brand: { select: { name: true } } },
  });

  const publishedCount = pieces.filter((p) => p.status === 'published').length;
  const draftCount = pieces.filter((p) => p.status === 'draft').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Growth Agent"
        subtitle="基于缺口分析自动生成 8 种内容(博客/FAQ/Schema/对比/PR/知乎/Gitee/Product Hunt),一键发布到 8 个渠道"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-5">
          <div className="text-xs text-neutral-500">已生成内容</div>
          <div className="mt-1 text-2xl font-semibold">{pieces.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-5">
          <div className="text-xs text-neutral-500">已发布</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-600">{publishedCount}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-5">
          <div className="text-xs text-neutral-500">草稿待审</div>
          <div className="mt-1 text-2xl font-semibold text-neutral-500">{draftCount}</div>
        </div>
      </div>

      {/* Content type quick generate */}
      {activeBrand && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
              <h3 className="text-sm font-medium">为「{activeBrand.name}」生成内容</h3>
            </div>
            <Link
              href={`/content?brandId=${activeBrand.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              打开内容中心 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CONTENT_TYPES.map((t) => (
              <Link
                key={t.id}
                href={`/content?brandId=${activeBrand.id}&type=${t.id}`}
                className="rounded-xl border border-neutral-200 bg-white/40 p-3 text-left transition hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5"
              >
                <div className="text-sm font-medium text-neutral-800">{t.label}</div>
                <div className="mt-1 text-xs text-neutral-500">{t.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Brand selector */}
      <div className="flex flex-wrap items-center gap-2">
        {brands.map((b) => (
          <Link
            key={b.id}
            href={`/growth?brandId=${b.id}`}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition',
              b.id === activeBrand?.id
                ? 'border-indigo-500/40 bg-indigo-50 text-indigo-600'
                : 'border-neutral-200 bg-neutral-100 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            )}
          >
            {b.name}
          </Link>
        ))}
      </div>

      {/* Pieces list */}
      <div className="space-y-3">
        {pieces.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-12 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-fuchsia-400" />
            <h3 className="mt-4 text-lg font-medium">还没有内容</h3>
            <p className="mt-2 text-sm text-neutral-500">点击上方的内容类型卡片,让 AI 帮你写第一篇博客/FAQ/知乎 帖子</p>
          </div>
        ) : (
          pieces.map((p) => {
            const meta = CONTENT_TYPES.find((t) => t.id === p.type);
            const st = STATUS_STYLES[p.status] || STATUS_STYLES.draft;
            return (
              <Link
                key={p.id}
                href={`/content?brandId=${p.brandId}`}
                className="block rounded-2xl border border-neutral-200 bg-neutral-100 p-5 transition hover:border-neutral-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', st.cls)}>
                        {st.icon} {st.label}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                        {meta?.label || p.type}
                      </span>
                      <span className="text-xs text-neutral-500">{p.brand.name}</span>
                    </div>
                    <h3 className="text-base font-medium text-neutral-800">{p.title}</h3>
                    <p className="line-clamp-2 text-sm text-neutral-500">{(p.body ?? '').slice(0, 200)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-neutral-500" />
                </div>
                <div className="mt-2 text-xs text-neutral-500">{formatDate(p.createdAt)}</div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
