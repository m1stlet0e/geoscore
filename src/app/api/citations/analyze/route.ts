// ============================================
// POST /api/citations/analyze
// 触发引用分析
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { citationEngine } from '@/lib/engines/citation.engine'

export async function POST(request: NextRequest) {
  try {
    // 验证登录
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 获取请求体
    const body = await request.json()
    const { citationIds, scanJobId, brandId } = body

    // 验证参数
    if (!citationIds && !scanJobId) {
      return NextResponse.json(
        { error: 'Either citationIds or scanJobId is required' },
        { status: 400 }
      )
    }

    let idsToAnalyze: string[] = []

    // 如果提供了 scanJobId，先提取引用
    if (scanJobId) {
      const scanJob = await prisma.scanRun.findUnique({
        where: { id: scanJobId }
      })

      if (!scanJob || scanJob.userId !== user.id) {
        return NextResponse.json(
          { error: 'Scan job not found or access denied' },
          { status: 404 }
        )
      }

      // 提取引用
      idsToAnalyze = await citationEngine.extractCitations(scanJobId)
    } else {
      // 验证 citationIds 属于当前用户
      const citations = await prisma.citation.findMany({
        where: {
          id: { in: citationIds },
          userId: user.id
        }
      })
      idsToAnalyze = citations.map(c => c.id)
    }

    if (idsToAnalyze.length === 0) {
      return NextResponse.json(
        { error: 'No citations to analyze' },
        { status: 400 }
      )
    }

    // 检查额度（这里简化处理，实际应该检查 Quota 表）
    // TODO: 实现额度检查

    // 批量分析
    const results = await citationEngine.batchAnalyze(idsToAnalyze)

    return NextResponse.json({
      success: true,
      data: {
        analyzed: results.length,
        results
      }
    })
  } catch (error) {
    console.error('POST /api/citations/analyze error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
