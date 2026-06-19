/**
 * Job Dispatcher — invoked by /api/cron/run-jobs every minute.
 *
 * Strategy:
 *   1. Inside a transaction, lock up to N pending V2ScanJob rows using
 *      SELECT ... FOR UPDATE SKIP LOCKED so multiple concurrent dispatcher
 *      calls don't pick the same row. Mark them as 'running'.
 *   2. Outside the transaction, run them sequentially via runScanJob().
 *      We don't run in parallel inside one cron tick — each tick is small
 *      (default 5 jobs), the next tick picks up the next batch.
 *
 * Returns: { picked, done, failed }.
 */
import { prisma } from '@/lib/prisma'
import { runScanJob } from './scan.runner'

export interface DispatchResult {
  picked: number
  done: number
  failed: number
  jobIds: string[]
}

const DEFAULT_BATCH = 5

export async function dispatchScanJobs(opts?: { batch?: number }): Promise<DispatchResult> {
  const batch = opts?.batch ?? DEFAULT_BATCH

  // Phase 1: claim pending jobs atomically.
  // Prisma 7 supports $queryRaw for SELECT FOR UPDATE SKIP LOCKED on PG.
  const claimed = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "V2ScanJob"
      WHERE status = 'pending' AND priority >= 0
      ORDER BY priority ASC, "createdAt" ASC
      LIMIT ${batch}
      FOR UPDATE SKIP LOCKED
    `
    if (rows.length === 0) return [] as string[]
    const ids = rows.map((r) => r.id)
    await tx.v2ScanJob.updateMany({
      where: { id: { in: ids } },
      data: { status: 'running', startedAt: new Date() },
    })
    return ids
  })

  if (claimed.length === 0) {
    return { picked: 0, done: 0, failed: 0, jobIds: [] }
  }

  // Phase 2: execute outside the transaction.
  let done = 0
  let failed = 0
  for (const id of claimed) {
    const r = await runScanJob(id)
    if (r.status === 'done') done++
    else failed++
  }

  return { picked: claimed.length, done, failed, jobIds: claimed }
}
