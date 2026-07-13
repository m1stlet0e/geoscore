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
    features: ["1 个品牌", "初步可见度报告", "问题级抢位机会"],
  },
  STARTER: {
    code: "STARTER",
    name: "基础版",
    priceCents: 9900,
    monthlyResponses: 500,
    maxBrands: 1,
    features: ["1 个品牌", "问题级抢位机会", "增长实验与手动同配置复测"],
  },
  PRO: {
    code: "PRO",
    name: "专业版",
    priceCents: 29900,
    monthlyResponses: 2500,
    maxBrands: 3,
    features: ["3 个品牌", "扫描历史与趋势对比", "引用分析与实验归因"],
  },
  BUSINESS: {
    code: "BUSINESS",
    name: "商业版",
    priceCents: 89900,
    monthlyResponses: 10000,
    maxBrands: 10,
    features: ["10 个品牌", "多品牌增长工作台", "跨品牌机会队列与实验归因"],
  },
};

export function getPlanByCode(code: string): PlanDefinition {
  if (!PLAN_CODES.includes(code as PlanCode)) {
    throw new Error(`未知套餐：${code}`);
  }
  return PLAN_CATALOG[code as PlanCode];
}
