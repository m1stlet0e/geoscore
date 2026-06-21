import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { gapEngine } from '@/lib/engines/gap.engine'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id as string

    const { itemId } = await params
    const body = await request.json()
    const { status } = body

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    if (!status || !['open', 'in_progress', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be one of: open, in_progress, resolved' },
        { status: 400 }
      )
    }

    const updated = await gapEngine.updateGapItemStatus(itemId, userId, status)
    return NextResponse.json({ success: true, data: { updated } })
  } catch (error) {
    console.error('[GAP_ITEM_PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
