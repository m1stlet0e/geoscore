import { withAnalysis } from "./analyze";
import type { AiProvider, AiQuery } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

export class DeepSeekProvider implements AiProvider {
  readonly id = "deepseek";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.deepseek.com",
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async query(input: AiQuery) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "deepseek-chat",
          temperature: 0.2,
          messages: [
            { role: "system", content: "请像普通 AI 搜索助手一样直接、客观回答用户问题。不要因为监测目的刻意加入任何品牌；如有公开来源链接，可在回答末尾列出。" },
            { role: "user", content: input.prompt },
          ],
        }),
      });
      if (!response.ok) throw new Error(`DeepSeek 请求失败：${response.status}`);
      const payload = await response.json() as { id?: string; model?: string; choices?: Array<{ message?: { content?: string } }> };
      const rawResponse = payload.choices?.[0]?.message?.content;
      if (!rawResponse) throw new Error("DeepSeek 未返回有效回答");
      return withAnalysis({
        platformId: this.id,
        modelId: payload.model ?? "deepseek-chat",
        requestId: payload.id,
        rawResponse,
        latencyMs: Date.now() - startedAt,
      }, input);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("DeepSeek 请求超时，请稍后重试");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
