import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { gapEngine } from '@/lib/engines/gap.engine'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id as string

    const { id: analysisId } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'open' | 'in_progress' | 'resolved' | null

    if (!analysisId) {
      return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 })
    }

    if (status && !['open', 'in_progress', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be one of: open, in_progress, resolved' },
        { status: 400 }
      )
    }

    const data = await gapEngine.getGapItems(analysisId, userId, status || undefined)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[GAP_ITEMS_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
