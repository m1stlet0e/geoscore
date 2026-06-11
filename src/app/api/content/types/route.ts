// ============================================
// GET /api/content/types — content type config (public)
// ============================================

import { NextResponse } from 'next/server'
import { contentEngine } from '@/lib/engines/content.engine'

export async function GET() {
  try {
    const config = contentEngine.getContentTypeConfig()

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('GET /api/content/types error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
