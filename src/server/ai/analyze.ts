import type { AiAnswer, AiCitation, AiMention, AiQuery } from "./types";

export function analyzeRawAnswer(input: AiQuery, rawResponse: string) {
  const names = [input.brand.name, ...input.brand.aliases];
  const targetName = names.find((name) => rawResponse.toLowerCase().includes(name.toLowerCase()));
  const targetIndex = targetName ? rawResponse.toLowerCase().indexOf(targetName.toLowerCase()) : -1;
  const competitors = input.competitors.filter((name) => rawResponse.toLowerCase().includes(name.toLowerCase()));
  const recommendation = /推荐|首选|优先|值得选择|适合/.test(rawResponse) ? 0.85 : targetName ? 0.25 : 0;
  const mentions: AiMention[] = [];
  if (targetName) {
    mentions.push({
      brandName: input.brand.name,
      isTarget: true,
      position: targetIndex >= 0 ? 1 + [...input.competitors, input.brand.name].filter((name) => rawResponse.indexOf(name) >= 0 && rawResponse.indexOf(name) < targetIndex).length : null,
      recommendationStrength: recommendation,
      sentiment: /不推荐|风险|缺点/.test(rawResponse) ? "MIXED" : recommendation >= 0.6 ? "POSITIVE" : "NEUTRAL",
      evidence: rawResponse.slice(Math.max(0, targetIndex - 40), targetIndex + targetName.length + 100),
    });
  }
  competitors.forEach((brandName, index) => mentions.push({
    brandName, isTarget: false, position: index + 1, recommendationStrength: 0.6,
    sentiment: "NEUTRAL", evidence: rawResponse.slice(Math.max(0, rawResponse.indexOf(brandName) - 30), rawResponse.indexOf(brandName) + brandName.length + 80),
  }));
  const urls = [...rawResponse.matchAll(/https?:\/\/[^\s)\]，。]+/g)].map((match) => match[0]);
  const officialHost = new URL(input.brand.website).hostname.replace(/^www\./, "");
  const citations: AiCitation[] = [...new Set(urls)].map((url) => {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const isOfficial = domain === officialHost || domain.endsWith(`.${officialHost}`);
    return { url, domain, isOfficial, sourceQuality: isOfficial ? 1 : 0.6 };
  });
  return { mentions, citations };
}

export function withAnalysis(answer: Omit<AiAnswer, "mentions" | "citations">, input: AiQuery): AiAnswer {
  return { ...answer, ...analyzeRawAnswer(input, answer.rawResponse) };
}
