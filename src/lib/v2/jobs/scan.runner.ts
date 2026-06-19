/**
 * Scan Runner — executes one V2ScanJob: collect → extract → persist.
 *
 * Pure: takes a job id, runs the pipeline, updates the job row. The dispatcher
 * decides which jobs run; the runner just runs.
 */
import { prisma } from '@/lib/prisma'
import { collectAnswer, NotConfiguredError } from '../collectors/llm.collector'
import { extractFromAnswer } from '../collectors/extractor'
import { CitationGraphEngine } from '../engines/citation-graph.engine'
import { getIndustry } from '../industries'

export interface RunResult {
  jobId: string
  status: 'done' | 'failed'
  edgesCreated?: number
  edgesUpdated?: number
  unknownBrands?: string[]
  error?: string
}

export async function runScanJob(jobId: string): Promise<RunResult> {
  const job = await prisma.v2ScanJob.findUnique({
    where: { id: jobId },
    include: { prompt: true },
  })
  if (!job) throw new Error(`scan job not found: ${jobId}`)

  await prisma.v2ScanJob.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  })

  try {
    const industryConfig = getIndustry(job.prompt.industry)

    // 1. Collect answer
    const answer = await collectAnswer({
      promptText: job.prompt.text,
      channel: job.channel as 'deepseek' | 'chatgpt',
    })

    // 2. Extract citations
    const citations = extractFromAnswer({
      answerText: answer.text,
      industryConfig,
    })

    // 3. Persist into citation graph
    const persistResult = await CitationGraphEngine.persist({
      industry: job.prompt.industry,
      promptId: job.promptId,
      channel: job.channel as 'deepseek' | 'chatgpt',
      citations,
    })

    await prisma.v2ScanJob.update({
      where: { id: jobId },
      data: {
        status: 'done',
        finishedAt: new Date(),
        result: {
          answer: { text: answer.text, model: answer.model, latencyMs: answer.latencyMs },
          citations: citations as unknown as object[],
          persistResult,
        } as object,
      },
    })

    return { jobId, status: 'done', ...persistResult }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isNotConfigured = e instanceof NotConfiguredError

    await prisma.v2ScanJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        error: msg,
        // NotConfigured is permanent; mark with priority -1 so dispatcher skips
        ...(isNotConfigured ? { priority: -1 } : {}),
      },
    })
    return { jobId, status: 'failed', error: msg }
  }
}
