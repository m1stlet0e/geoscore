/**
 * Citation Extractor — turns an LLM answer text into structured citations.
 *
 * Two-stage pipeline:
 *   1. Rule-based scan: walks the answer line-by-line, matches known brands
 *      from the industry config (name + aliases), assigns rank by appearance
 *      order, pulls source URLs from the same line / following "参考:" block.
 *   2. JSON-validation pass (optional): asks DeepSeek to re-format the answer
 *      as strict JSON — used when the rule-based pass returns nothing.
 *
 * Phase 2 ships stage 1 only; stage 2 is a fallback hook left as a TODO.
 */
import type { ExtractedCitation } from '../engines/citation-graph.engine'
import type { IndustryConfig } from '../types/industry'

const URL_RE = /(https?:\/\/[^\s,，。、)）\]】>"']+|[a-z0-9-]+\.(?:com|cn|net|org|io|ai|dev|cloud|baidu\.com)[^\s,，。、)）\]】>"']*)/gi

export function extractFromAnswer(input: {
  answerText: string
  industryConfig: IndustryConfig
}): ExtractedCitation[] {
  const { answerText, industryConfig } = input

  // Lowercase index of brand → list of {brand, alias} entries for matching.
  type AliasEntry = { brand: string; alias: string }
  const aliasIndex: AliasEntry[] = []
  for (const b of industryConfig.brands) {
    aliasIndex.push({ brand: b.name, alias: b.name })
    for (const a of b.aliases) aliasIndex.push({ brand: b.name, alias: a })
  }
  // Longest alias first — prevents "OCR" from shadowing "腾讯 OCR".
  aliasIndex.sort((a, b) => b.alias.length - a.alias.length)

  // Walk the text, find first occurrence of each brand → assign rank by order.
  const lower = answerText.toLowerCase()
  type Hit = { brand: string; pos: number }
  const seen = new Map<string, Hit>()
  for (const entry of aliasIndex) {
    if (seen.has(entry.brand)) continue
    const pos = lower.indexOf(entry.alias.toLowerCase())
    if (pos >= 0) seen.set(entry.brand, { brand: entry.brand, pos })
  }
  const orderedBrands = Array.from(seen.values()).sort((a, b) => a.pos - b.pos)

  // Extract source URLs (global). Phase 2 attaches them all to every hit
  // (we don't yet split URLs per brand). This is good enough for the citation
  // graph — refining per-brand attribution comes with stage 2 LLM extractor.
  const urls = Array.from(answerText.matchAll(URL_RE)).map((m) => m[0])

  const citations: ExtractedCitation[] = []
  orderedBrands.forEach((hit, idx) => {
    if (urls.length === 0) {
      citations.push({
        brandName: hit.brand,
        rank: idx + 1,
        confidence: 0.7, // rule-based, no source corroboration
      })
    } else {
      // Find the URL closest after the brand mention.
      const nearest = pickNearestUrlAfter(answerText, hit.pos, urls)
      citations.push({
        brandName: hit.brand,
        sourceUrl: nearest ?? undefined,
        rank: idx + 1,
        confidence: nearest ? 0.85 : 0.7,
      })
    }
  })

  return citations
}

function pickNearestUrlAfter(text: string, fromPos: number, urls: string[]): string | null {
  let bestUrl: string | null = null
  let bestDist = Infinity
  for (const u of urls) {
    const upos = text.indexOf(u, fromPos)
    if (upos < 0) continue
    const dist = upos - fromPos
    if (dist < bestDist) {
      bestDist = dist
      bestUrl = u
    }
  }
  return bestUrl
}
