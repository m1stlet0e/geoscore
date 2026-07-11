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
    { category: "DISCOVERY", text: `${industry}领域有哪些值得关注的产品？`, weight: 1 },
    { category: "DISCOVERY", text: `适合${targetAudience}的${product}有哪些？`, weight: 1.1 },
    { category: "PROBLEM", text: `${targetAudience}如何解决${product}相关问题？`, weight: 1 },
    { category: "PROBLEM", text: `选择${product}时最容易踩哪些坑？`, weight: 1 },
    { category: "COMPARISON", text: `${product}主流方案应该如何比较？`, weight: 1.2 },
    { category: "COMPARISON", text: `${industry}产品应该重点比较哪些能力？`, weight: 1.2 },
    { category: "PURCHASE", text: `高性价比的${product}推荐`, weight: 1.5 },
    { category: "PURCHASE", text: `${targetAudience}购买${product}前应该问什么？`, weight: 1.4 },
    { category: "PURCHASE", text: `国内可靠的${product}服务商有哪些？`, weight: 1.5 },
    { category: "DISCOVERY", text: `${industry}的新趋势和代表品牌有哪些？`, weight: 1 },
  ];
}
