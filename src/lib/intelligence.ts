export type IntelligencePriority = "P0" | "P1" | "P2";

type RiskInput = {
  id: string;
  level: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description: string;
  scanId: string | null;
  evidence?: string;
};

type OpportunityInput = {
  id: string;
  type: "MENTION_GAP" | "COMPETITOR_ADVANTAGE" | "CITATION_GAP" | "BRAND_RISK";
  priority: number;
  title: string;
  summary: string;
  scanId: string;
};

export type ActionAlert = {
  id: string;
  priority: IntelligencePriority;
  source: "RISK" | "OPPORTUNITY";
  title: string;
  summary: string;
  scanId: string | null;
  score: number;
};

const priorityWeight: Record<IntelligencePriority, number> = { P0: 0, P1: 1, P2: 2 };

function riskPriority(level: RiskInput["level"]): IntelligencePriority {
  if (level === "CRITICAL") return "P0";
  if (level === "WARNING") return "P1";
  return "P2";
}

function opportunityPriority(item: OpportunityInput): IntelligencePriority {
  if (item.type === "MENTION_GAP" && item.priority >= 80) return "P0";
  if (item.type === "BRAND_RISK" && item.priority >= 70) return "P0";
  if (item.type === "CITATION_GAP") return "P2";
  return "P1";
}

export function buildActionAlerts(input: {
  risks: RiskInput[];
  opportunities: OpportunityInput[];
}) {
  const alerts: ActionAlert[] = [
    ...input.risks.map((item) => ({
      id: item.id,
      priority: riskPriority(item.level),
      source: "RISK" as const,
      title: item.title,
      summary: item.description,
      scanId: item.scanId,
      score: item.level === "CRITICAL" ? 100 : item.level === "WARNING" ? 70 : 40,
    })),
    ...input.opportunities.map((item) => ({
      id: item.id,
      priority: opportunityPriority(item),
      source: "OPPORTUNITY" as const,
      title: item.title,
      summary: item.summary,
      scanId: item.scanId,
      score: item.priority,
    })),
  ];
  return alerts.sort((left, right) => (
    priorityWeight[left.priority] - priorityWeight[right.priority]
    || right.score - left.score
    || left.title.localeCompare(right.title, "zh-CN")
  ));
}

type MatrixMention = {
  isTarget: boolean;
  position: number | null;
  brandName: string;
};

type MatrixObservation = {
  prompt: string;
  platformId: string;
  mentions: MatrixMention[];
};

export type RankMatrixCell = {
  state: "RANKED" | "MENTIONED" | "MISSING";
  rank: number | null;
  competitor: string | null;
};

export type RankMatrixRow = {
  prompt: string;
  mentionRate: number;
  primaryCompetitor: string | null;
  platforms: Record<string, RankMatrixCell>;
};

function firstPosition(items: MatrixMention[]) {
  return items.reduce<number | null>((best, item) => {
    if (item.position === null) return best;
    return best === null || item.position < best ? item.position : best;
  }, null);
}

export function buildRankMatrix(observations: MatrixObservation[]) {
  const rows = new Map<string, MatrixObservation[]>();
  for (const observation of observations) {
    const existing = rows.get(observation.prompt) ?? [];
    existing.push(observation);
    rows.set(observation.prompt, existing);
  }

  return [...rows.entries()].map(([prompt, samples]) => {
    const platforms: Record<string, RankMatrixCell> = {};
    const competitorCounts = new Map<string, number>();
    let mentionedCount = 0;
    for (const sample of samples) {
      const targetMentions = sample.mentions.filter((mention) => mention.isTarget);
      const competitorMentions = sample.mentions.filter((mention) => !mention.isTarget);
      const targetRank = firstPosition(targetMentions);
      const leadCompetitor = [...competitorMentions].sort((left, right) => (
        (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER)
      ))[0]?.brandName ?? null;
      if (leadCompetitor) competitorCounts.set(leadCompetitor, (competitorCounts.get(leadCompetitor) ?? 0) + 1);
      if (targetMentions.length) mentionedCount += 1;
      platforms[sample.platformId] = {
        state: targetRank !== null ? "RANKED" : targetMentions.length ? "MENTIONED" : "MISSING",
        rank: targetRank,
        competitor: leadCompetitor,
      };
    }
    const primaryCompetitor = [...competitorCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))[0]?.[0] ?? null;
    return {
      prompt,
      mentionRate: samples.length ? mentionedCount / samples.length : 0,
      primaryCompetitor,
      platforms,
    } satisfies RankMatrixRow;
  });
}

type SentimentMention = {
  sentiment: "POSITIVE" | "NEUTRAL" | "MIXED" | "NEGATIVE";
  evidence: string;
  platformId: string;
  prompt: string;
};

export function buildSentimentSnapshot(input: {
  mentions: SentimentMention[];
  risks: RiskInput[];
}) {
  const distribution = { positive: 0, neutral: 0, mixed: 0, negative: 0 };
  for (const mention of input.mentions) {
    if (mention.sentiment === "POSITIVE") distribution.positive += 1;
    if (mention.sentiment === "NEUTRAL") distribution.neutral += 1;
    if (mention.sentiment === "MIXED") distribution.mixed += 1;
    if (mention.sentiment === "NEGATIVE") distribution.negative += 1;
  }
  return {
    distribution,
    negativeEvidence: input.mentions.filter((item) => item.sentiment === "NEGATIVE"),
    risks: [...input.risks].sort((left, right) => (
      priorityWeight[riskPriority(left.level)] - priorityWeight[riskPriority(right.level)]
    )),
  };
}

type CitationInput = {
  url: string;
  domain: string;
  platformId: string;
  sourceQuality: number;
  title: string | null;
};

type OwnedSourceInput = { url: string; domain: string };

export function groupCitationSources(input: {
  citations: CitationInput[];
  owned: OwnedSourceInput[];
}) {
  const ownedUrls = new Set(input.owned.map((item) => item.url));
  const ownedDomains = new Set(input.owned.map((item) => item.domain));
  const groups = new Map<string, {
    domain: string;
    citationCount: number;
    urls: Set<string>;
    platforms: Set<string>;
    qualityTotal: number;
    isOwned: boolean;
    latestTitle: string | null;
  }>();
  for (const citation of input.citations) {
    const current = groups.get(citation.domain) ?? {
      domain: citation.domain,
      citationCount: 0,
      urls: new Set<string>(),
      platforms: new Set<string>(),
      qualityTotal: 0,
      isOwned: false,
      latestTitle: null,
    };
    current.citationCount += 1;
    current.urls.add(citation.url);
    current.platforms.add(citation.platformId);
    current.qualityTotal += citation.sourceQuality;
    current.isOwned ||= ownedUrls.has(citation.url) || ownedDomains.has(citation.domain);
    current.latestTitle ??= citation.title;
    groups.set(citation.domain, current);
  }
  return [...groups.values()]
    .map((item) => ({
      domain: item.domain,
      citationCount: item.citationCount,
      articleCount: item.urls.size,
      platformCount: item.platforms.size,
      platforms: [...item.platforms].sort(),
      averageQuality: item.citationCount ? item.qualityTotal / item.citationCount : 0,
      isOwned: item.isOwned,
      latestTitle: item.latestTitle,
    }))
    .sort((left, right) => (
      Number(right.isOwned) - Number(left.isOwned)
      || right.citationCount - left.citationCount
      || left.domain.localeCompare(right.domain)
    ));
}
