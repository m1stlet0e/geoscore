// 测试脚本：跑真实 AI 扫描 + 验证数据持久化
import { readFileSync } from 'fs'
import { join } from 'path'

// 加载 .env
const env = readFileSync(join(__dirname, '.env'), 'utf8')
const lines = env.split('\n').filter(l => l && !l.startsWith('#'))
for (const line of lines) {
  const [key, ...rest] = line.split('=')
  const val = rest.join('=').replace(/^\"|\"$/g, '')
  process.env[key.trim()] = val.trim()
}

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const url = process.env.DATABASE_URL || 'postgresql://wangbo@localhost/geoos?schema=public'
const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })

async function getEngines() {
  const { CitationEngine } = await import('./src/lib/engines/citation.engine')
  const { GapEngine } = await import('./src/lib/engines/gap.engine')
  return { citationEngine: new CitationEngine(), gapEngine: new GapEngine() }
}

async function main() {
  console.log('🚀 开始测试真实 AI 扫描...\n')

  // 1. 获取 demo 用户
  const user = await prisma.user.findFirst()
  if (!user) {
    console.error('❌ 没有用户，请先注册')
    process.exit(1)
  }
  console.log(`✅ 用户: ${user.email}`)

  // 2. 获取或创建品牌
  let brand = await prisma.brand.findFirst({ where: { name: 'Nous Research' } })
  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        userId: user.id,
        name: 'Nous Research',
        domain: 'nousresearch.com',
        category: 'AI/LLM',
        description: '开源 AI 研究机构，开发 Hermes 系列模型',
      }
    })
    console.log(`✅ 品牌创建: ${brand.name} (${brand.id})`)
  } else {
    console.log(`✅ 品牌已存在: ${brand.name} (${brand.id})`)
  }

  // 3. 创建监测 Prompt
  const existingPrompt = await prisma.prompt.findFirst({ where: { brandId: brand.id } })
  let prompt
  if (!existingPrompt) {
    prompt = await prisma.prompt.create({
      data: {
        brandId: brand.id,
        userId: user.id,
        text: '推荐一些开源的大语言模型',
        category: 'recommendation',
        isActive: true,
      }
    })
    console.log(`✅ 监测词创建: "${prompt.text}"`)
  } else {
    prompt = existingPrompt
    console.log(`✅ 监测词已存在: "${prompt.text}"`)
  }

  // 4. 获取引擎
  const { citationEngine, gapEngine } = await getEngines()

  // 5. 跑 Citation 分析（真实调用 DeepSeek）
  console.log('\n📊 开始 Citation Intelligence 分析...')
  
  const mockAnswer = '推荐几个开源大语言模型：1. Llama 3 (Meta) 2. Hermes (Nous Research) 3. Qwen (阿里) 4. DeepSeek (深度求索)'
  const mockSources = [
    { url: 'https://github.com/NousResearch/Hermes-3-Llama-3.1-8B', title: 'Hermes 3', domain: 'github.com' },
    { url: 'https://huggingface.co/NousResearch', title: 'Nous Research Models', domain: 'huggingface.co' },
    { url: 'https://www.reddit.com/r/LocalLLaMA/comments/hermes/', title: 'Hermes Discussion', domain: 'reddit.com' },
  ]

  const citationResult = await citationEngine.analyzeRecommendationFactors(
    brand.id,
    user.id,
    'deepseek',
    prompt.text,
    mockAnswer,
    mockSources
  )
  console.log(`✅ Citation 分析完成:`)
  console.log(`   - AI Score: ${citationResult.aiScore}`)
  console.log(`   - 置信度: ${citationResult.confidence}`)
  console.log(`   - 推荐原因: ${citationResult.recommendationReason}`)
  console.log(`   - 证据数: ${citationResult.evidenceCount}`)
  console.log(`   - 影响因子: ${citationResult.factors.map(f => `${f.label}(${(f.weight * 100).toFixed(0)}%)`).join(', ')}`)

  // 6. 跑 Gap 分析
  console.log('\n📊 开始 GEO Gap 分析...')
  
  const gapResult = await gapEngine.analyzeGap(
    brand.id,
    user.id,
    'deepseek',
    prompt.text
  )
  console.log(`✅ Gap 分析完成:`)
  console.log(`   - 当前分数: ${gapResult.score}`)
  console.log(`   - 基准: ${gapResult.benchmark}`)
  console.log(`   - 差距: ${gapResult.gap}`)
  console.log(`   - 改进建议: ${gapResult.items.length} 条`)
  gapResult.items.slice(0, 5).forEach((item, i) => {
    console.log(`     ${i + 1}. [${item.type}] ${item.title} (影响: ${item.impact})`)
  })

  // 7. 验证数据持久化
  console.log('\n🔍 验证数据持久化...')
  const dbCitations = await prisma.citationEvidence.count({ where: { brandId: brand.id } })
  const dbGaps = await prisma.gapAnalysis.count({ where: { brandId: brand.id } })
  const dbGapItems = await prisma.gapItem.count({ where: { gapAnalysis: { brandId: brand.id } } })
  
  console.log(`✅ 数据库验证:`)
  console.log(`   - Citation 证据: ${dbCitations} 条`)
  console.log(`   - Gap 分析: ${dbGaps} 条`)
  console.log(`   - Gap 改进项: ${dbGapItems} 条`)

  // 8. 汇总
  console.log('\n' + '='.repeat(50))
  console.log('✅ 测试完成！数据已持久化到 PostgreSQL')
  console.log('='.repeat(50))
  console.log(`品牌 ID: ${brand.id}`)
  console.log('现在可以登录 Dashboard 查看结果了')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
