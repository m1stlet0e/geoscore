import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBrandForUser } from "@/server/brands/service";
import { markOwnedSourceForUser, unmarkOwnedSourceForUser } from "./service";

const userIds: string[] = [];

afterEach(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
});

async function createBrand(ownerLabel: string) {
  const user = await db.user.create({
    data: { name: ownerLabel, email: `source-${ownerLabel}-${Date.now()}@test.local` },
  });
  userIds.push(user.id);
  const brand = await createBrandForUser(user.id, {
    name: `引用源${ownerLabel}`,
    website: `https://${ownerLabel}.example.com`,
    industry: "企业服务",
    product: "引用源测试",
    targetAudience: "市场负责人",
    aliases: [],
    competitors: [],
  });
  return { user, brand };
}

describe("自有引用源服务", () => {
  it("按品牌存储规范化链接并允许重复提交", async () => {
    const { user, brand } = await createBrand("owner");

    const first = await markOwnedSourceForUser(user.id, brand.id, {
      url: "https://www.example.com/guide/",
      label: "官网指南",
    });
    const second = await markOwnedSourceForUser(user.id, brand.id, {
      url: "https://www.example.com/guide",
      label: "官网指南更新",
    });

    expect(first.id).toBe(second.id);
    expect(second).toMatchObject({
      domain: "example.com",
      url: "https://www.example.com/guide",
      label: "官网指南更新",
    });
    expect(await db.ownedSource.count({ where: { brandId: brand.id } })).toBe(1);
  });

  it("不能标记或取消其他用户品牌的引用源", async () => {
    const { user: owner, brand } = await createBrand("owner2");
    const { user: stranger } = await createBrand("stranger");
    const marked = await markOwnedSourceForUser(owner.id, brand.id, { url: "https://example.com/a" });

    await expect(markOwnedSourceForUser(stranger.id, brand.id, { url: "https://example.com/b" }))
      .rejects.toThrow("品牌不存在");
    await expect(unmarkOwnedSourceForUser(stranger.id, marked.id)).rejects.toThrow("自有内容标记不存在");
    await expect(unmarkOwnedSourceForUser(owner.id, marked.id)).resolves.toEqual({ id: marked.id });
  });
});
