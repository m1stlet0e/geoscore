import { db } from "@/lib/db";
import { generateBrandPrompts } from "@/server/prompts/generator";

export type CreateBrandInput = {
  name: string;
  website: string;
  industry: string;
  product: string;
  targetAudience: string;
  aliases: string[];
  competitors: string[];
};

export function normalizeWebsite(value: string) {
  const raw = value.trim();
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("官网只支持 HTTP 或 HTTPS");
  return url.toString().replace(/\/$/, "");
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export async function createBrandForUser(userId: string, input: CreateBrandInput) {
  const brandCount = await db.brand.count({ where: { ownerId: userId } });
  const subscription = await db.subscription.findFirst({
      where: { userId, status: "ACTIVE", endsAt: { gt: new Date() } },
      orderBy: { endsAt: "desc" },
      include: { plan: true },
    });
  const maxBrands = subscription?.plan.maxBrands ?? 1;
  if (brandCount >= maxBrands) throw new Error(`当前套餐最多创建 ${maxBrands} 个品牌`);

  const prompts = generateBrandPrompts(input);
  return db.brand.create({
    data: {
      ownerId: userId,
      name: input.name.trim(),
      website: normalizeWebsite(input.website),
      industry: input.industry.trim(),
      product: input.product.trim(),
      targetAudience: input.targetAudience.trim(),
      aliases: { create: uniqueValues(input.aliases).map((value) => ({ value })) },
      competitors: { create: uniqueValues(input.competitors).map((name) => ({ name })) },
      prompts: {
        create: prompts.map((prompt) => ({
          category: prompt.category,
          versions: { create: { version: 1, text: prompt.text, weight: prompt.weight } },
        })),
      },
    },
    include: {
      aliases: { orderBy: { value: "asc" } },
      competitors: { orderBy: { name: "asc" } },
      prompts: { include: { versions: true } },
    },
  });
}

export function getBrandForUser(userId: string, brandId: string) {
  return db.brand.findFirst({
    where: { id: brandId, ownerId: userId },
    include: {
      aliases: true,
      competitors: true,
      prompts: { where: { active: true }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
    },
  });
}

export function listBrandsForUser(userId: string) {
  return db.brand.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    include: { scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
}

export async function deleteBrandForUser(userId: string, brandId: string) {
  const result = await db.brand.deleteMany({ where: { id: brandId, ownerId: userId } });
  return result.count === 1;
}

export async function updatePromptForUser(
  userId: string,
  promptId: string,
  input: { text?: string; active?: boolean },
) {
  const prompt = await db.prompt.findFirst({
    where: { id: promptId, brand: { ownerId: userId } },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!prompt) throw new Error("问题不存在");
  const current = prompt.versions[0];
  const nextText = input.text?.trim();
  if (nextText && nextText !== current?.text) {
    await db.promptVersion.create({
      data: {
        promptId,
        version: (current?.version ?? 0) + 1,
        text: nextText,
        weight: current?.weight ?? 1,
      },
    });
  }
  if (typeof input.active === "boolean" && input.active !== prompt.active) {
    await db.prompt.update({ where: { id: promptId }, data: { active: input.active } });
  }
  return db.prompt.findUniqueOrThrow({
    where: { id: promptId },
    include: { versions: { orderBy: { version: "desc" } } },
  });
}
