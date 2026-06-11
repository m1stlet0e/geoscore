import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { gapEngine } from '@/lib/engines/gap.engine'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

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

    const updated = await gapEngine.updateGapItemStatus(itemId, user.id, status)
    return NextResponse.json({ success: true, data: { updated } })
  } catch (error) {
    console.error('[GAP_ITEM_PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
