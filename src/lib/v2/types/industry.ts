/**
 * v2 industry config types.
 *
 * One config per vertical (ocr, ai-coding, ...). Pinned to a single
 * industry slug — used as the primary partition key across v2 tables.
 */

export type Channel = 'deepseek' | 'chatgpt'

export type DimensionKey = 'doc' | 'website' | 'github' | 'zhihu'

export interface BrandSeed {
  /** Canonical brand name. Stored on V2CitationNode.name with kind='brand'. */
  name: string
  /** Aliases used by the citation extractor for fuzzy matching in LLM answers. */
  aliases: string[]
  /** Optional homepage / canonical doc URL. */
  homepage?: string
  /** Optional github repo (org/repo) used by github collector later. */
  github?: string
}

export interface IndustryConfig {
  /** Primary key — appears verbatim on every v2 row. */
  industry: string
  /** Display label. */
  label: string
  /** Default channel(s) used when no override is supplied. */
  channels: Channel[]
  /** Brands that ship with the industry (seed). User can add more later. */
  brands: BrandSeed[]
  /**
   * Dimension weights. Must sum to 1.0. Used by Gap engine to compute the
   * weighted overall score per brand.
   */
  dimensionWeights: Record<DimensionKey, number>
  /** Seeded prompt library for cold-start. */
  prompts: Array<{
    text: string
    category?: string
    language?: 'zh' | 'en'
  }>
}
