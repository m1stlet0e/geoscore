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

export async function GET() {
  const auth = await checkAdmin()
  if (auth.error) return auth.error

  try {
    const configs = await adminService.getConfigs()
    return NextResponse.json(configs)
  } catch (error) {
    console.error('[Admin Config GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await checkAdmin()
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { key, value, desc } = body

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Must provide key and value' },
        { status: 400 }
      )
    }

    const result = await adminService.updateConfig(key, value, desc, auth.user!.id)
    return NextResponse.json({ success: result })
  } catch (error) {
    console.error('[Admin Config PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
