export type AiMention = {
  brandName: string;
  isTarget: boolean;
  position: number | null;
  recommendationStrength: number;
  sentiment: "POSITIVE" | "NEUTRAL" | "MIXED" | "NEGATIVE";
  evidence: string;
};

export type AiCitation = {
  url: string;
  domain: string;
  title?: string;
  sourceQuality: number;
  isOfficial: boolean;
};

export type AiAnswer = {
  platformId: string;
  modelId: string;
  requestId?: string;
  rawResponse: string;
  latencyMs: number;
  mentions: AiMention[];
  citations: AiCitation[];
};

export type AiQuery = {
  prompt: string;
  brand: { name: string; website: string; aliases: string[] };
  competitors: string[];
  simulationContext?: {
    optimizationApplied: boolean;
    targetUrl?: string;
  };
};

export interface AiProvider {
  readonly id: string;
  query(input: AiQuery): Promise<AiAnswer>;
}

export type AiProviderDescriptor = {
  id: string;
  name: string;
  dataMode: "REAL" | "SIMULATED";
  available: boolean;
  unavailableReason?: string;
};
