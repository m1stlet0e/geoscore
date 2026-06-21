import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { billingService } from '@/lib/billing/billing.service'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id as string

    const result = await billingService.cancelSubscription(userId)
    return NextResponse.json({ success: result })
  } catch (error) {
    console.error('Error cancelling subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
