export const PLAN_CODES = ["FREE", "STARTER", "PRO", "BUSINESS"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export type PlanDefinition = {
  code: PlanCode;
  name: string;
  priceCents: number;
  monthlyResponses: number;
  maxBrands: number;
  features: readonly string[];
};

export const PLAN_CATALOG: Record<PlanCode, PlanDefinition> = {
  FREE: {
    code: "FREE",
    name: "免费体检",
    priceCents: 0,
    monthlyResponses: 30,
    maxBrands: 1,
    features: ["1 个品牌", "30 次 AI 回答", "初步可见度报告"],
  },
  STARTER: {
    code: "STARTER",
    name: "基础版",
    priceCents: 9900,
    monthlyResponses: 500,
    maxBrands: 1,
    features: ["每周监测", "竞品对比", "完整原始证据"],
  },
  PRO: {
    code: "PRO",
    name: "专业版",
    priceCents: 29900,
    monthlyResponses: 2500,
    maxBrands: 3,
    features: ["3 个品牌", "引用分析", "优化建议与趋势"],
  },
  BUSINESS: {
    code: "BUSINESS",
    name: "商业版",
    priceCents: 89900,
    monthlyResponses: 10000,
    maxBrands: 10,
    features: ["10 个品牌", "高频监测", "团队与报告导出"],
  },
};

export function getPlanByCode(code: string): PlanDefinition {
  if (!PLAN_CODES.includes(code as PlanCode)) {
    throw new Error(`未知套餐：${code}`);
  }
  return PLAN_CATALOG[code as PlanCode];
}
