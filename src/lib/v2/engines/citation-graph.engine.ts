/**
 * Citation Graph Engine.
 *
 * Owns the V2CitationNode + V2CitationEdge tables. Provides:
 *   - persist(input) — upsert nodes (brand, source) + edges from extraction
 *   - getAttribution(brandId, industry) — answer "why does AI cite competitor X but not me"
 *   - getEdges(filter) — paged listing for the citations UI later
 *
 * Phase 2 uses persist() and a minimal getAttribution stub — full attribution
 * narrative ships with the Gap engine in Phase 3.
 */
import { prisma } from '@/lib/prisma'

export type Channel = 'deepseek' | 'chatgpt'

export interface ExtractedCitation {
  /** Brand mentioned (must match a known V2CitationNode.name OR alias). */
  brandName: string
  /** Source domain or URL the answer cites. Optional — not every mention has a source. */
  sourceUrl?: string
  /** Position in the answer (1 = first mention, 2 = second, ...). */
  rank: number
  /** Extractor confidence 0..1. */
  confidence: number
}

export interface PersistInput {
  industry: string
  promptId: string
  channel: Channel
  citations: ExtractedCitation[]
}

export const CitationGraphEngine = {
  /**
   * Idempotently persists extracted citations.
   *
   * Steps:
   *   1. For each citation, find the matching brand node (by name OR alias).
   *      Unknown brands are skipped (logged) — we don't auto-create brands
   *      because that pollutes the graph; new brands are added via industry config.
   *   2. For each cited source URL, upsert a 'source' node keyed on hostname.
   *   3. Upsert the (prompt, channel, brand, source) edge.
   *
   * Returns: { edgesCreated, edgesUpdated, unknownBrands }
   */
  async persist(input: PersistInput): Promise<{
    edgesCreated: number
    edgesUpdated: number
    unknownBrands: string[]
  }> {
    const { industry, promptId, channel, citations } = input

    // Load all brand nodes for this industry once (small set).
    const brandNodes = await prisma.v2CitationNode.findMany({
      where: { kind: 'brand', industry },
    })

    function matchBrand(name: string): { id: string; name: string } | null {
      const lower = name.toLowerCase().trim()
      for (const n of brandNodes) {
        if (n.name.toLowerCase() === lower) return { id: n.id, name: n.name }
        for (const alias of n.aliases) {
          if (alias.toLowerCase() === lower) return { id: n.id, name: n.name }
        }
      }
      // Loose contains-match as fallback (helps with "TextIn 文档识别" variants).
      for (const n of brandNodes) {
        if (lower.includes(n.name.toLowerCase())) return { id: n.id, name: n.name }
        for (const alias of n.aliases) {
          if (lower.includes(alias.toLowerCase())) return { id: n.id, name: n.name }
        }
      }
      return null
    }

    let edgesCreated = 0
    let edgesUpdated = 0
    const unknownBrands: string[] = []

    for (const c of citations) {
      const brand = matchBrand(c.brandName)
      if (!brand) {
        unknownBrands.push(c.brandName)
        continue
      }

      // Upsert source node (if any).
      let sourceNodeId: string | null = null
      if (c.sourceUrl) {
        const sourceName = canonicalizeSource(c.sourceUrl)
        const sourceNode = await prisma.v2CitationNode.upsert({
          where: {
            kind_industry_name: {
              kind: 'source',
              industry,
              name: sourceName,
            },
          },
          update: {},
          create: {
            kind: 'source',
            industry,
            name: sourceName,
            aliases: [],
            meta: { sampleUrl: c.sourceUrl },
          },
        })
        sourceNodeId = sourceNode.id
      }

      // Upsert edge. Detect create vs update by checking existence first.
      const existing = await prisma.v2CitationEdge.findUnique({
        where: {
          promptId_channel_brandNodeId_sourceUrl: {
            promptId,
            channel,
            brandNodeId: brand.id,
            sourceUrl: c.sourceUrl ?? '',
          },
        },
        select: { id: true },
      })
      await prisma.v2CitationEdge.upsert({
        where: {
          promptId_channel_brandNodeId_sourceUrl: {
            promptId,
            channel,
            brandNodeId: brand.id,
            sourceUrl: c.sourceUrl ?? '',
          },
        },
        update: {
          rank: c.rank,
          confidence: c.confidence,
          sourceNodeId,
          observedAt: new Date(),
        },
        create: {
          promptId,
          channel,
          brandNodeId: brand.id,
          sourceNodeId,
          sourceUrl: c.sourceUrl ?? '',
          rank: c.rank,
          confidence: c.confidence,
        },
      })
      if (existing) edgesUpdated++
      else edgesCreated++
    }

    return { edgesCreated, edgesUpdated, unknownBrands }
  },

  /**
   * Get attribution rows for a brand in an industry.
   *
   * Phase 2 minimum: { brandName, mentions, avgRank, topSources[] } per brand —
   * the user's brand vs each competitor side by side.
   */
  async getAttribution(industry: string, opts?: { channel?: Channel }) {
    const where = {
      brandNode: { is: { industry, kind: 'brand' } },
      ...(opts?.channel ? { channel: opts.channel } : {}),
    }

    const edges = await prisma.v2CitationEdge.findMany({
      where,
      include: { brandNode: true, sourceNode: true },
    })

    // Group by brand.
    const byBrand = new Map<
      string,
      { brandName: string; mentions: number; rankSum: number; sources: Map<string, number> }
    >()

    for (const e of edges) {
      const key = e.brandNode.id
      const slot = byBrand.get(key) ?? {
        brandName: e.brandNode.name,
        mentions: 0,
        rankSum: 0,
        sources: new Map<string, number>(),
      }
      slot.mentions += 1
      slot.rankSum += e.rank
      if (e.sourceNode) {
        slot.sources.set(e.sourceNode.name, (slot.sources.get(e.sourceNode.name) ?? 0) + 1)
      }
      byBrand.set(key, slot)
    }

    return Array.from(byBrand.values())
      .map((b) => ({
        brandName: b.brandName,
        mentions: b.mentions,
        avgRank: b.mentions === 0 ? null : b.rankSum / b.mentions,
        topSources: Array.from(b.sources.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
      }))
      .sort((a, b) => b.mentions - a.mentions)
  },
}

function canonicalizeSource(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url.toLowerCase().trim()
  }
}
