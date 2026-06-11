import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PUBLISH_CHANNELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CHANNEL_IDS = PUBLISH_CHANNELS.map((c) => c.id) as [string, ...string[]];

const Body = z.object({
  contentId: z.string().min(1),
  channel: z.enum(CHANNEL_IDS),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    );
  }

  const content = await prisma.contentPiece.findFirst({
    where: { id: parsed.data.contentId, userId },
    include: { brand: { select: { id: true, name: true } } },
  });
  if (!content) return NextResponse.json({ error: '内容不存在' }, { status: 404 });

  const job = await prisma.publishJob.create({
    data: {
      contentId: content.id,
      userId,
      channel: parsed.data.channel,
      status: 'in_progress',
      startedAt: new Date(),
    },
  });

  // Simulate the publishing — wait 1.5s, then mark as published with a fake URL.
  // We do this in a fire-and-forget pattern so the API returns quickly.
  void (async () => {
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const slug = content.title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60) || 'post';
      const channel = parsed.data.channel;
      const externalUrl =
        channel === 'reddit'
          ? `https://reddit.com/r/${content.brand.name.toLowerCase().replace(/\s+/g, '')}/comments/${Math.random().toString(36).slice(2, 10)}/${slug}`
          : channel === 'medium'
            ? `https://medium.com/@${content.brand.name.toLowerCase()}/${slug}-${Math.random().toString(36).slice(2, 8)}`
            : channel === 'hashnode'
              ? `https://hashnode.com/post/${slug}-${Math.random().toString(36).slice(2, 10)}`
              : `https://${channel}.example.com/${slug}-${Math.random().toString(36).slice(2, 8)}`;

      await prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: 'published',
          externalUrl,
          completedAt: new Date(),
          response: {
            ok: true,
            platform: channel,
            url: externalUrl,
            note: 'Simulated publish. In production, integrate with the channel OAuth API.',
          },
        },
      });

      // Auto-mark the content as published
      await prisma.contentPiece.update({
        where: { id: content.id },
        data: { status: 'published' },
      });
    } catch (err) {
      await prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMsg: err instanceof Error ? err.message.slice(0, 500) : '未知错误',
        },
      });
    }
  })();

  return NextResponse.json({ job, status: 'in_progress' }, { status: 202 });
}
