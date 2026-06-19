import type { IndustryConfig } from '../types/industry'
import { ocrConfig } from './ocr.config'

export const industries: Record<string, IndustryConfig> = {
  ocr: ocrConfig,
}

export function getIndustry(slug: string): IndustryConfig {
  const cfg = industries[slug]
  if (!cfg) {
    throw new Error(`Unknown industry: ${slug}. Known: ${Object.keys(industries).join(', ')}`)
  }
  return cfg
}

export const DEFAULT_INDUSTRY = 'ocr'
