/**
 * POST /api/v2/scan
 *
 * Body: { brandId: string, industry?: string, channel?: 'deepseek' | 'wenxin',
 *         promptIds?: string[], limit?: number }
 *
 * Enqueues V2ScanJob rows for (brandId, prompt, channel) tuples.
 * Returns: { batchId, enqueued }
 *
 * Auth: session OR Bearer CRON_SECRET (cron path skips brand ownership check).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PromptLibraryEngine } from '@/lib/v2/engines/prompt-library.engine'
import { DEFAULT_INDUSTRY } from '@/lib/v2/industries'

export const dynamic = 'force-dynamic'

function isCron(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`
}

async function ensureAuth(req: NextRequest) {
  if (isCron(req)) return { userId: null, isCron: true }
  const { auth } = await import('@/auth')
  const session = await auth()
  if (!session?.user) return { userId: null, isCron: false }
  return { userId: (session.user as { id: string }).id, isCron: false }
}

export async function POST(req: NextRequest) {
  const authz = await ensureAuth(req)
  if (!authz.isCron && !authz.userId) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const brandId: string | undefined = body.brandId
  const industry: string = body.industry || DEFAULT_INDUSTRY
  const channel: 'deepseek' | 'wenxin' = body.channel || 'deepseek'
  const limit: number = Math.min(Math.max(body.limit ?? 10, 1), 50)
  const explicitPromptIds: string[] | undefined = body.promptIds

  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }

  // Verify brand exists and (if not cron) belongs to the caller.
  const brand = await prisma.brand.findUnique({ where: { id: brandId } })
  if (!brand) return NextResponse.json({ error: 'brand not found' }, { status: 404 })
  if (!authz.isCron && brand.userId !== authz.userId) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  // Pick prompts.
  let prompts
  if (explicitPromptIds && explicitPromptIds.length > 0) {
    prompts = await prisma.v2PromptLibrary.findMany({
      where: { id: { in: explicitPromptIds }, industry },
    })
  } else {
    prompts = await PromptLibraryEngine.rotate(industry, limit)
  }

  if (prompts.length === 0) {
    return NextResponse.json({ error: 'no prompts available for industry', industry }, { status: 400 })
  }

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // Enqueue. Use upsert on the (brandId, promptId, channel) unique key — if a
  // row already exists in non-pending state, reset it to pending for re-scan.
  let enqueued = 0
  for (const p of prompts) {
    await prisma.v2ScanJob.upsert({
      where: {
        brandId_promptId_channel: { brandId, promptId: p.id, channel },
      },
      update: {
        status: 'pending',
        attempts: 0,
        priority: 100,
        error: null,
        startedAt: null,
        finishedAt: null,
        batchId,
      },
      create: {
        brandId,
        promptId: p.id,
        channel,
        status: 'pending',
        priority: 100,
        batchId,
      },
    })
    enqueued++
  }

  return NextResponse.json({
    ok: true,
    batchId,
    enqueued,
    industry,
    channel,
    note: '调用 POST /api/cron/run-jobs（Bearer CRON_SECRET）执行队列',
  })
}
