import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adminService } from '@/lib/admin/admin.service'

async function checkAdmin() {
  const session = await auth()
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = session.user
  if (!user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }
  // Admin check: demo user or specific admin emails
  const ADMIN_EMAILS = ['demo@geoos.ai', 'admin@geoos.ai']
  if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(request: NextRequest) {
  const auth = await checkAdmin()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const status = searchParams.get('status') || undefined

    const result = await adminService.getOrders(page, limit, status)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Admin Orders] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
