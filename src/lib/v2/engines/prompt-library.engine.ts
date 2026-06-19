/**
 * Prompt Library Engine.
 *
 * Owns the V2PromptLibrary table. Provides:
 *   - list(industry) — get active prompts for scanning
 *   - addCustom(industry, text) — user-added prompt (source='user')
 *   - rotate(industry, n) — pick n prompts to scan (round-robin by least recently used)
 *
 * The dispatcher consumes list/rotate; the API layer consumes addCustom.
 */
import { prisma } from '@/lib/prisma'

export interface PromptRow {
  id: string
  industry: string
  text: string
  category: string | null
  language: string
  source: string
}

export const PromptLibraryEngine = {
  async list(industry: string): Promise<PromptRow[]> {
    const rows = await prisma.v2PromptLibrary.findMany({
      where: { industry },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        industry: true,
        text: true,
        category: true,
        language: true,
        source: true,
      },
    })
    return rows
  },

  async findById(id: string): Promise<PromptRow | null> {
    return prisma.v2PromptLibrary.findUnique({
      where: { id },
      select: {
        id: true,
        industry: true,
        text: true,
        category: true,
        language: true,
        source: true,
      },
    })
  },

  async addCustom(input: {
    industry: string
    text: string
    category?: string
    language?: string
  }): Promise<PromptRow> {
    return prisma.v2PromptLibrary.upsert({
      where: {
        industry_text: { industry: input.industry, text: input.text },
      },
      update: {},
      create: {
        industry: input.industry,
        text: input.text,
        category: input.category ?? null,
        language: input.language ?? 'zh',
        source: 'user',
      },
      select: {
        id: true,
        industry: true,
        text: true,
        category: true,
        language: true,
        source: true,
      },
    })
  },

  /**
   * Pick n prompts for the next scan batch. Strategy: prompts that have the
   * fewest scan jobs (least recently scanned) win — keeps coverage even.
   *
   * For Phase 2 we keep this simple: cap by createdAt asc, take first n.
   * Real LRU comes in Phase 4 (uses V2ScanJob.createdAt MAX per prompt).
   */
  async rotate(industry: string, n: number): Promise<PromptRow[]> {
    const all = await this.list(industry)
    return all.slice(0, n)
  },
}
