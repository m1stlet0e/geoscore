export type OpportunityPromptCategory =
  | "DISCOVERY"
  | "PROBLEM"
  | "COMPARISON"
  | "PURCHASE"
  | "BRANDED";

export type OpportunitySample = {
  brandName: string;
  promptVersionId: string;
  promptText: string;
  promptCategory: OpportunityPromptCategory;
  promptWeight: number;
  platformId: string;
  rawResponse: string;
  targetMentioned: boolean;
  targetPosition: number | null;
  targetRecommendationStrength: number;
  competitorNames: string[];
  competitorPositions: Array<number | null>;
  competitorRecommendationStrengths: number[];
  hasOfficialCitation: boolean;
};

export type BuiltOpportunity = {
  promptVersionId: string;
  platformId: string;
  type: "MENTION_GAP" | "COMPETITOR_ADVANTAGE" | "CITATION_GAP" | "BRAND_RISK";
  priority: number;
  title: string;
  summary: string;
  evidence: string;
  recommendedAction: string;
  targetContentType: string;
};

const BRAND_RISK_SOURCE = "已倒闭|停止运营|诈骗|违法|被查处";
const CLAUSE_SEPARATOR = /(?<=[。！？!?；;，,\n])/u;

function mentionIndexes(text: string, name: string) {
  const indexes: number[] = [];
  const normalizedText = text.toLocaleLowerCase();
  const normalizedName = name.trim().toLocaleLowerCase();
  if (!normalizedName) return indexes;
  let index = normalizedText.indexOf(normalizedName);
  while (index >= 0) {
    indexes.push(index);
    index = normalizedText.indexOf(normalizedName, index + normalizedName.length);
  }
  return indexes;
}

function nearestDistance(index: number, indexes: number[]) {
  return indexes.length
    ? Math.min(...indexes.map((mentionIndex) => Math.abs(index - mentionIndex)))
    : Number.POSITIVE_INFINITY;
}

function findTargetBrandRiskEvidence(sample: OpportunitySample) {
  const evidence: string[] = [];
  for (const rawClause of sample.rawResponse.split(CLAUSE_SEPARATOR)) {
    const clause = rawClause.trim();
    const targetIndexes = mentionIndexes(clause, sample.brandName);
    if (!targetIndexes.length) continue;
    const competitorIndexes = sample.competitorNames.flatMap((name) => mentionIndexes(clause, name));
    const matches = [...clause.matchAll(new RegExp(BRAND_RISK_SOURCE, "g"))];
    if (matches.some((match) => {
      const riskIndex = match.index;
      return nearestDistance(riskIndex, targetIndexes) <= nearestDistance(riskIndex, competitorIndexes);
    })) {
      evidence.push(clause);
    }
  }
  return evidence;
}

function groupSamples(samples: OpportunitySample[]) {
  const groups = new Map<string, OpportunitySample[]>();
  for (const sample of samples) {
    const key = `${sample.promptVersionId}\u0000${sample.platformId}`;
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  return groups.values();
}

function contentTypeFor(category: OpportunityPromptCategory) {
  if (category === "PURCHASE") return "选型与采购指南";
  if (category === "COMPARISON") return "竞品对比页";
  if (category === "PROBLEM") return "问题解决方案页";
  if (category === "BRANDED") return "品牌事实页";
  return "品类解决方案页";
}

function categoryBoost(category: OpportunityPromptCategory) {
  if (category === "PURCHASE") return 15;
  if (category === "COMPARISON") return 12;
  if (category === "PROBLEM") return 5;
  return 0;
}

function weightBoost(weight: number) {
  return Math.max(0, Math.min(10, Math.round((weight - 1) * 10)));
}

function clampPriority(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function truncateEvidence(value: string) {
  if (value.length <= 600) return value;
  return `${value.slice(0, 599).trimEnd()}…`;
}

function priorityForMentionGap(sample: OpportunitySample, mentionRate: number) {
  const promptWeightBoost = weightBoost(sample.promptWeight);
  return clampPriority(
    60 + (1 - mentionRate) * 15 + categoryBoost(sample.promptCategory) + promptWeightBoost,
  );
}

export function buildOpportunities(samples: OpportunitySample[]): BuiltOpportunity[] {
  const opportunities: BuiltOpportunity[] = [];
  for (const group of groupSamples(samples)) {
    const first = group[0];
    const mentionedCount = group.filter((sample) => sample.targetMentioned).length;
    const mentionRate = mentionedCount / group.length;
    if (mentionRate < 0.5) {
      const targetContentType = contentTypeFor(first.promptCategory);
      opportunities.push({
        promptVersionId: first.promptVersionId,
        platformId: first.platformId,
        type: "MENTION_GAP",
        priority: priorityForMentionGap(first, mentionRate),
        title: `问题“${first.promptText}”存在品牌提及缺口`,
        summary: `${first.platformId} 的 ${group.length} 次回答中仅 ${mentionedCount} 次提到${first.brandName}，提及率为 ${Math.round(mentionRate * 100)}%。`,
        evidence: truncateEvidence(`问题“${first.promptText}”下，品牌“${first.brandName}”的回答证据：${group.map((sample) => sample.rawResponse).join("；")}`),
        recommendedAction: `围绕问题“${first.promptText}”制作${targetContentType}，直接说明${first.brandName}的适用场景、选择理由与可验证依据。`,
        targetContentType,
      });
    }

    const competitorNames = [...new Set(group.flatMap((sample) => sample.competitorNames))];
    if (competitorNames.length) {
      const targetSamples = group.filter((sample) => sample.targetMentioned);
      const targetPositions = targetSamples
        .map((sample) => sample.targetPosition)
        .filter((position): position is number => position != null);
      const competitorPositions = group
        .flatMap((sample) => sample.competitorPositions)
        .filter((position): position is number => position != null);
      const targetAveragePosition = targetPositions.length
        ? targetPositions.reduce((sum, value) => sum + value, 0) / targetPositions.length
        : null;
      const competitorAveragePosition = competitorPositions.length
        ? competitorPositions.reduce((sum, value) => sum + value, 0) / competitorPositions.length
        : null;
      const targetAverageStrength = targetSamples.length
        ? targetSamples.reduce((sum, sample) => sum + sample.targetRecommendationStrength, 0) / targetSamples.length
        : 0;
      const competitorStrengths = group.flatMap((sample) => sample.competitorRecommendationStrengths);
      const competitorAverageStrength = competitorStrengths.length
        ? competitorStrengths.reduce((sum, value) => sum + value, 0) / competitorStrengths.length
        : 0;
      const targetAbsentBesideCompetitor = group.some(
        (sample) => sample.competitorNames.length > 0 && !sample.targetMentioned,
      );
      const positionClearlyBehind = targetAveragePosition != null
        && competitorAveragePosition != null
        && targetAveragePosition - competitorAveragePosition >= 2;
      const strengthClearlyBehind = competitorAverageStrength - targetAverageStrength >= 0.25;

      if (targetAbsentBesideCompetitor || positionClearlyBehind || strengthClearlyBehind) {
        const targetContentType = contentTypeFor(first.promptCategory);
        const competitorLabel = competitorNames.join("、");
        const targetPositionLabel = targetAveragePosition == null
          ? "未进入推荐名单"
          : `平均第 ${Math.round(targetAveragePosition * 10) / 10} 位`;
        opportunities.push({
          promptVersionId: first.promptVersionId,
          platformId: first.platformId,
          type: "COMPETITOR_ADVANTAGE",
          priority: clampPriority(
            65
              + (targetAbsentBesideCompetitor ? 15 : 8)
              + categoryBoost(first.promptCategory)
              + weightBoost(first.promptWeight),
          ),
          title: `问题“${first.promptText}”中${competitorLabel}占据推荐优势`,
          summary: `${competitorLabel}已被回答提及，${first.brandName}${targetPositionLabel}，平均推荐强度为 ${Math.round(targetAverageStrength * 100)}%。`,
          evidence: truncateEvidence(`问题“${first.promptText}”的竞品证据：${group.map((sample) => sample.rawResponse).join("；")}`),
          recommendedAction: `针对问题“${first.promptText}”制作${targetContentType}，逐项对照${competitorLabel}的能力、适用场景、价格与可验证结果，明确${first.brandName}的差异化选择理由。`,
          targetContentType,
        });
      }
    }

    if (mentionedCount > 0) {
      const officialCitationCount = group.filter(
        (sample) => sample.targetMentioned && sample.hasOfficialCitation,
      ).length;
      const officialCitationCoverage = officialCitationCount / group.length;
      if (officialCitationCoverage < 0.5) {
        const targetContentType = "官网事实与数据页";
        opportunities.push({
          promptVersionId: first.promptVersionId,
          platformId: first.platformId,
          type: "CITATION_GAP",
          priority: clampPriority(
            55
              + (1 - officialCitationCoverage) * 20
              + categoryBoost(first.promptCategory)
              + weightBoost(first.promptWeight),
          ),
          title: `问题“${first.promptText}”缺少${first.brandName}官方引用`,
          summary: `${first.platformId} 的 ${group.length} 次回答中有 ${mentionedCount} 次提到${first.brandName}，${officialCitationCount} 次带官方引用，覆盖率为 ${Math.round(officialCitationCoverage * 100)}%。`,
          evidence: truncateEvidence(`问题“${first.promptText}”的引用证据：${group.filter((sample) => sample.targetMentioned).map((sample) => sample.rawResponse).join("；")}`),
          recommendedAction: `为问题“${first.promptText}”制作${targetContentType}，集中提供${first.brandName}的产品事实、数据口径、更新时间与官网可引用链接。`,
          targetContentType,
        });
      }
    }

    const targetRiskEvidence = [...new Set(
      group.flatMap((sample) => findTargetBrandRiskEvidence(sample)),
    )];
    if (targetRiskEvidence.length) {
      const riskPhrases = [...new Set(
        targetRiskEvidence.flatMap((evidence) => evidence.match(new RegExp(BRAND_RISK_SOURCE, "g")) ?? []),
      )];
      const targetContentType = "品牌事实澄清页";
      opportunities.push({
        promptVersionId: first.promptVersionId,
        platformId: first.platformId,
        type: "BRAND_RISK",
        priority: clampPriority(
          90 + categoryBoost(first.promptCategory) + weightBoost(first.promptWeight),
        ),
        title: `问题“${first.promptText}”出现${first.brandName}高风险描述`,
        summary: `${first.platformId} 的回答出现“${riskPhrases.join("、")}”等高风险表述，需要立即核查并澄清。`,
        evidence: truncateEvidence(`问题“${first.promptText}”的风险证据：${targetRiskEvidence.join("；")}`),
        recommendedAction: `立即核查关于${first.brandName}的高风险表述，并制作${targetContentType}，针对问题“${first.promptText}”发布可验证的运营状态、资质与官方声明。`,
        targetContentType,
      });
    }
  }
  return opportunities;
}
