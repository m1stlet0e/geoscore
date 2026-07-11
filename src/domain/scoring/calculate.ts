export const SCORING_VERSION = "1.0.0";

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const round = (value: number) => Math.round(value * 100) / 100;

export function positionFactor(position?: number | null) {
  if (!position || position <= 1) return 1;
  if (position === 2) return 0.8;
  if (position === 3) return 0.65;
  if (position <= 5) return 0.5;
  return 0.35;
}

export function calculateConfidence(input: {
  sampleCount: number;
  platformCount: number;
  repeatConsistency: number;
}) {
  const sample = Math.min(1, input.sampleCount / 120) * 50;
  const platforms = Math.min(1, input.platformCount / 3) * 25;
  const consistency = Math.min(1, Math.max(0, input.repeatConsistency)) * 25;
  return {
    score: round(sample + platforms + consistency),
    isProvisional: input.sampleCount < 120 || input.platformCount < 3,
  };
}

export function calculateGeoScore(input: {
  mentionScore: number;
  recommendationScore: number;
  shareOfVoiceScore: number;
  citationScore: number;
  sentimentScore: number;
  confidenceScore: number;
  hasCriticalRisk: boolean;
}) {
  const base =
    clamp(input.mentionScore) * 0.3 +
    clamp(input.recommendationScore) * 0.25 +
    clamp(input.shareOfVoiceScore) * 0.2 +
    clamp(input.citationScore) * 0.15 +
    clamp(input.sentimentScore) * 0.1;
  return {
    score: round(input.hasCriticalRisk ? Math.min(59, base) : base),
    isProvisional: input.confidenceScore < 75,
    riskLevel: input.hasCriticalRisk ? ("CRITICAL" as const) : ("INFO" as const),
  };
}

export type ParsedObservation = {
  weight: number;
  platformId: string;
  targetMentioned: boolean;
  recommendationStrength: number;
  position?: number | null;
  competitorMentions: number;
  trackedCompetitorCount: number;
  targetCitationQuality?: number | null;
  sentiment?: "POSITIVE" | "NEUTRAL" | "MIXED" | "NEGATIVE" | null;
};

export function calculateComponents(observations: ParsedObservation[]) {
  const weightTotal = observations.reduce((sum, item) => sum + item.weight, 0) || 1;
  const mentionedWeight = observations.reduce((sum, item) => sum + (item.targetMentioned ? item.weight : 0), 0);
  const recommendation = observations.reduce(
    (sum, item) => sum + item.weight * clamp(item.recommendationStrength * 100) / 100 * positionFactor(item.position),
    0,
  );
  const targetAttention = observations.reduce(
    (sum, item) => sum + (item.targetMentioned ? item.weight * (1 + item.recommendationStrength) * positionFactor(item.position) : 0),
    0,
  );
  const competitorAttention = observations.reduce((sum, item) => sum + item.weight * item.competitorMentions, 0);
  const rawShare = targetAttention / Math.max(1, targetAttention + competitorAttention);
  const competitorCount = Math.max(0, ...observations.map((item) => item.trackedCompetitorCount));
  const fairShare = 1 / (competitorCount + 1);
  const cited = observations.filter((item) => item.targetCitationQuality != null);
  const citationCoverage = cited.reduce((sum, item) => sum + item.weight, 0) / weightTotal;
  const citationQuality = cited.length
    ? cited.reduce((sum, item) => sum + (item.targetCitationQuality ?? 0), 0) / cited.length
    : 0;
  const sentimentValues = { POSITIVE: 100, NEUTRAL: 65, MIXED: 40, NEGATIVE: 0 } as const;
  const withSentiment = observations.filter((item) => item.targetMentioned && item.sentiment);
  const sentiment = withSentiment.length
    ? withSentiment.reduce((sum, item) => sum + sentimentValues[item.sentiment!], 0) / withSentiment.length
    : 0;

  return {
    mentionScore: round((mentionedWeight / weightTotal) * 100),
    recommendationScore: round((recommendation / weightTotal) * 100),
    shareOfVoiceScore: round(Math.min(100, (rawShare / fairShare) * 50)),
    citationScore: round((citationCoverage * 0.7 + citationQuality * 0.3) * 100),
    sentimentScore: round(sentiment),
  };
}
