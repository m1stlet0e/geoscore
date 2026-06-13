import { NextResponse } from 'next/server'
import { PLAN_CONFIG } from '@/lib/billing/billing.service'

export async function GET() {
  try {
    const plans = Object.entries(PLAN_CONFIG).map(([key, config]) => ({
      id: key,
      name: config.name,
      price: config.price,
      quotas: config.quotas,
      features: config.features,
    }))
    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Error fetching plans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
