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

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 })
    }

    const data = await gapEngine.getAnalysisDetail(id, userId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[GAP_DETAIL_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
