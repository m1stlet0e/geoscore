import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { chat } from '@/lib/deepseek';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUB_NICHE_TEMPLATES: Record<string, string[]> = {
  ocr: ['数学公式 OCR', '手写体识别', '发票识别', '证件 OCR', '表格识别', '多语言 OCR', 'AI PDF 解析', '古籍 OCR', '票据识别', '车牌识别'],
  ai: ['LLM 应用', 'RAG 引擎', 'AI Agent', '向量数据库', '多模态模型', 'AI 工作流', '智能客服', '代码助手'],
  default: ['市场分析', '产品对比', '客户案例', '技术博客', '社区生态', '行业报告', '最佳实践', '替代方案'],
};

function pickSubNiches(category: string | null | undefined): string[] {
  const c = (category ?? '').toLowerCase();
  if (/ocr|识别|扫描|文字/.test(c)) return SUB_NICHE_TEMPLATES.ocr;
  if (/ai|gpt|llm|模型/.test(c)) return SUB_NICHE_TEMPLATES.ai;
  return SUB_NICHE_TEMPLATES.default;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  if (!brandId) return NextResponse.json({ error: '缺少 brandId' }, { status: 400 });

  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  const existingNodes = await prisma.brandGraphNode.findMany({ where: { userId } });
  const existingEdges = await prisma.brandGraphEdge.findMany({ where: { userId } });

  // If we already have data with at least 3 nodes, return it
  if (existingNodes.length >= 3) {
    return NextResponse.json({
      nodes: existingNodes.map((n) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        weight: n.weight,
        x: n.x,
        y: n.y,
      })),
      edges: existingEdges.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        weight: e.weight,
        type: e.type,
      })),
      seeded: false,
    });
  }

  // Seed graph for this user/brand
  const competitors = (brand.competitors ?? []).slice(0, 8);
  const subNiches = pickSubNiches(brand.category);
  const allLabels: { label: string; type: string }[] = [
    { label: brand.name, type: 'brand' },
    ...(brand.category ? [{ label: brand.category, type: 'category' }] : []),
    ...competitors.map((c) => ({ label: c, type: 'brand' })),
    ...subNiches.map((s) => ({ label: s, type: 'subniche' })),
  ];

  // Wipe any partial graph for this user
  await prisma.brandGraphNode.deleteMany({ where: { userId } });
  await prisma.brandGraphEdge.deleteMany({ where: { userId } });

  // Place nodes on a circle
  const center = 500;
  const radius = 320;
  const n = allLabels.length;
  const nodeCreates = allLabels.map((l, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1);
    return prisma.brandGraphNode.create({
      data: {
        userId,
        label: l.label,
        type: l.type,
        weight: l.type === 'brand' && l.label === brand.name ? 3 : 1,
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius,
      },
    });
  });
  const createdNodes = await Promise.all(nodeCreates);
  const byLabel = new Map(createdNodes.map((nd) => [nd.label, nd.id] as const));

  // Edges: brand <-> competitors (competes_with), brand <-> category (parent_of),
  //        category <-> subniches (parent_of)
  const edges: { from: string; to: string; type: string; weight: number }[] = [];
  for (const c of competitors) {
    const cid = byLabel.get(c);
    const bid = byLabel.get(brand.name);
    if (cid && bid) edges.push({ from: bid, to: cid, type: 'competes_with', weight: 2 });
  }
  if (brand.category) {
    const catId = byLabel.get(brand.category);
    const bid = byLabel.get(brand.name);
    if (catId && bid) edges.push({ from: bid, to: catId, type: 'parent_of', weight: 1 });
    for (const s of subNiches) {
      const sid = byLabel.get(s);
      if (sid && catId) edges.push({ from: catId, to: sid, type: 'parent_of', weight: 0.6 });
      if (sid && bid) edges.push({ from: bid, to: sid, type: 'related_to', weight: 0.8 });
    }
  }
  await prisma.brandGraphEdge.createMany({
    data: edges.map((e) => ({ ...e, userId })),
    skipDuplicates: true,
  });

  // Re-read for response
  const finalNodes = await prisma.brandGraphNode.findMany({ where: { userId } });
  const finalEdges = await prisma.brandGraphEdge.findMany({ where: { userId } });

  // Optional: a small LLM-driven touch to enrich (non-blocking on failure)
  try {
    const txt = await chat(
      [
        {
          role: 'system',
          content:
            '你是品牌生态分析专家。给出一段 60-100 字的简短洞察，描述该品牌在其品类中的定位与潜在突破口。中文回答。',
        },
        { role: 'user', content: `品牌：${brand.name}，领域：${brand.category ?? 'AI'}，竞品：${competitors.join('、')}` },
      ],
      { maxTokens: 240, temperature: 0.6 }
    );
    return NextResponse.json({
      nodes: finalNodes.map((n) => ({ id: n.id, label: n.label, type: n.type, weight: n.weight, x: n.x, y: n.y })),
      edges: finalEdges.map((e) => ({ id: e.id, from: e.from, to: e.to, weight: e.weight, type: e.type })),
      seeded: true,
      insight: txt,
    });
  } catch {
    return NextResponse.json({
      nodes: finalNodes.map((n) => ({ id: n.id, label: n.label, type: n.type, weight: n.weight, x: n.x, y: n.y })),
      edges: finalEdges.map((e) => ({ id: e.id, from: e.from, to: e.to, weight: e.weight, type: e.type })),
      seeded: true,
    });
  }
}
