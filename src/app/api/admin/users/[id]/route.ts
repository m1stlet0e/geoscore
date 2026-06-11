import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adminService } from '@/lib/admin/admin.service'

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin()
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const userDetail = await adminService.getUserDetail(id)
    return NextResponse.json(userDetail)
  } catch (error) {
    console.error('[Admin User Detail] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin()
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const body = await request.json()
    const { plan, role } = body

    if (!plan && !role) {
      return NextResponse.json(
        { error: 'Must provide plan or role to update' },
        { status: 400 }
      )
    }

    if (plan) {
      await adminService.updateUserPlan(id, plan, auth.user!.id)
    }
    if (role) {
      await adminService.updateUserRole(id, role, auth.user!.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Update User] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
