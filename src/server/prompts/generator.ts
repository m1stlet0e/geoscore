import type { PromptCategory } from "@/generated/prisma/enums";

export type GeneratedPrompt = {
  category: PromptCategory;
  text: string;
  weight: number;
};

export function generateBrandPrompts(input: {
  industry: string;
  product: string;
  targetAudience: string;
}): GeneratedPrompt[] {
  const { industry, product, targetAudience } = input;
  return [
    { category: "DISCOVERY", text: `${industry}领域有哪些成熟的${product}解决方案？`, weight: 1 },
    { category: "DISCOVERY", text: `适合${targetAudience}使用的${product}有哪些？`, weight: 1.1 },
    { category: "DISCOVERY", text: `哪些${product}能帮助${targetAudience}快速看到效果？`, weight: 1.1 },
    { category: "DISCOVERY", text: `有哪些面向${targetAudience}的${product}成功应用案例？`, weight: 1 },
    { category: "DISCOVERY", text: `${industry}团队通常用${product}解决哪些关键业务场景？`, weight: 1 },
    { category: "PROBLEM", text: `缺少${product}会给${targetAudience}带来哪些业务问题？`, weight: 1 },
    { category: "PROBLEM", text: `选择${product}时最容易踩哪些坑？`, weight: 1 },
    { category: "PROBLEM", text: `${product}实施失败通常是哪些原因造成的？`, weight: 1.1 },
    { category: "PROBLEM", text: `${targetAudience}怎样评估${product}带来的实际效果？`, weight: 1.1 },
    { category: "PROBLEM", text: `${industry}团队使用${product}时如何控制成本和风险？`, weight: 1.1 },
    { category: "COMPARISON", text: `${product}的主流方案应该如何比较？`, weight: 1.2 },
    { category: "COMPARISON", text: `自建与采购${product}分别适合什么情况？`, weight: 1.2 },
    { category: "COMPARISON", text: `${targetAudience}评估${product}时应重点比较哪些核心能力？`, weight: 1.2 },
    { category: "COMPARISON", text: `不同价位的${product}在功能和服务上有哪些差异？`, weight: 1.3 },
    { category: "COMPARISON", text: `国内${product}与海外方案相比各有什么优缺点？`, weight: 1.3 },
    { category: "PURCHASE", text: `高性价比的${product}有哪些推荐？`, weight: 1.5 },
    { category: "PURCHASE", text: `${targetAudience}采购${product}前应该向供应商确认什么？`, weight: 1.4 },
    { category: "PURCHASE", text: `购买${product}一般需要多少预算？`, weight: 1.5 },
    { category: "PURCHASE", text: `哪些${product}供应商提供试用或效果验证？`, weight: 1.5 },
    { category: "PURCHASE", text: `${industry}团队采购${product}时如何制定选型清单？`, weight: 1.4 },
  ];
}
