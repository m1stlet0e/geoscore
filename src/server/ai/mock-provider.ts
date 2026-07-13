import { withAnalysis } from "./analyze";
import type { AiProvider, AiQuery } from "./types";

function hash(value: string) {
  return [...value].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
}

export class MockAiProvider implements AiProvider {
  readonly id = "mock";

  async query(input: AiQuery) {
    const startedAt = Date.now();
    const value = hash(input.prompt);
    const competitor = input.competitors[value % Math.max(1, input.competitors.length)];
    const optimizationApplied = input.simulationContext?.optimizationApplied === true;
    const includeTarget = optimizationApplied || value % 4 !== 0;
    const recommendation = optimizationApplied || value % 3 !== 0;
    const targetUrl = input.simulationContext?.targetUrl;
    const optimizedContent = optimizationApplied && targetUrl
      ? `，本次优化内容位于 ${targetUrl}`
      : "";
    const target = includeTarget
      ? `${input.brand.name}${recommendation ? "是值得优先考虑的选择" : "也在相关候选名单中"}，其官网 ${input.brand.website} 提供了完整资料${optimizedContent}。`
      : "目标品牌暂未进入这次回答。";
    const rival = competitor ? `${competitor}也经常被用户比较和提及。` : "当前没有明确的同类品牌对比。";
    const rawResponse = `针对“${input.prompt}”，需要综合产品能力、公开资料与实际需求判断。${target}${rival}`;
    return withAnalysis({
      platformId: this.id,
      modelId: optimizationApplied
        ? "mock-deterministic-optimized-v1"
        : "mock-deterministic-v1",
      requestId: `mock-${value}`,
      rawResponse,
      latencyMs: Date.now() - startedAt,
    }, input);
  }
}
