// ============================================
// GET /api/citations/definitions
// 获取因素定义 (公开接口, Citation Intelligence 2.0)
// ============================================

import { NextResponse } from 'next/server'
import { citationEngine } from '@/lib/engines/citation.engine'

export async function GET() {
  try {
    const definitions = citationEngine.getFactorDefinitions()

    return NextResponse.json({
      success: true,
      data: definitions
    })
  } catch (error) {
    console.error('GET /api/citations/definitions error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
