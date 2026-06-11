import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { gapEngine } from '@/lib/engines/gap.engine'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 })
    }

    const data = await gapEngine.getAnalysisDetail(id, user.id)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[GAP_DETAIL_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
