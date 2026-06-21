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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin()
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const result = await adminService.toggleUserStatus(id, auth.user!.id)
    return NextResponse.json({ success: result })
  } catch (error) {
    console.error('[Admin Toggle User] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
