export type ExperimentMetrics = {
  overallScore: number;
  mentionRate: number;
  recommendationScore: number;
  citationRate: number;
  baselineRisk?: boolean;
  followUpRisk?: boolean;
};

export type CalculateExperimentResultInput = {
  baseline: ExperimentMetrics;
  followUp: ExperimentMetrics;
  baselineRisk?: boolean;
  followUpRisk?: boolean;
};

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateExperimentResult(input: CalculateExperimentResultInput) {
  const { baseline, followUp } = input;
  const metricValues = [
    baseline.overallScore,
    baseline.mentionRate,
    baseline.recommendationScore,
    baseline.citationRate,
    followUp.overallScore,
    followUp.mentionRate,
    followUp.recommendationScore,
    followUp.citationRate,
  ];
  if (metricValues.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new Error("实验指标必须在 0 到 100 之间");
  }
  const rawDeltas = {
    scoreDelta: followUp.overallScore - baseline.overallScore,
    mentionDelta: followUp.mentionRate - baseline.mentionRate,
    recommendationDelta:
      followUp.recommendationScore - baseline.recommendationScore,
    citationDelta: followUp.citationRate - baseline.citationRate,
  };
  const riskResolved = (input.baselineRisk ?? baseline.baselineRisk) === true
    && (input.followUpRisk ?? followUp.followUpRisk) === false;
  const verified = Object.values(rawDeltas).some((delta) => delta > 0)
    || riskResolved;
  const deltas = {
    scoreDelta: roundToTwo(rawDeltas.scoreDelta),
    mentionDelta: roundToTwo(rawDeltas.mentionDelta),
    recommendationDelta: roundToTwo(rawDeltas.recommendationDelta),
    citationDelta: roundToTwo(rawDeltas.citationDelta),
  };
  const summary = verified
    ? `验证有效：总分 ${deltas.scoreDelta >= 0 ? "+" : ""}${deltas.scoreDelta}，提及率 ${deltas.mentionDelta >= 0 ? "+" : ""}${deltas.mentionDelta}，推荐强度 ${deltas.recommendationDelta >= 0 ? "+" : ""}${deltas.recommendationDelta}，官方引用率 ${deltas.citationDelta >= 0 ? "+" : ""}${deltas.citationDelta}${riskResolved ? "，品牌风险已解除" : ""}。`
    : `尚未验证：总分 ${deltas.scoreDelta}，提及率 ${deltas.mentionDelta}，推荐强度 ${deltas.recommendationDelta}，官方引用率 ${deltas.citationDelta}。`;

  return { ...deltas, verified, summary };
}
