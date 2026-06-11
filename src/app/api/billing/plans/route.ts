import { NextResponse } from 'next/server'
import { billingService } from '@/lib/billing/billing.service'

export async function GET() {
  try {
    const plans = await billingService.getPlanComparison()
    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Error fetching plans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
