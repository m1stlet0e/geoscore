import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBrandForUser, getBrandForUser, normalizeWebsite } from "./service";

const userIds: string[] = [];

afterEach(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
});

async function createUser(suffix: string) {
  const user = await db.user.create({
    data: { name: `测试用户${suffix}`, email: `brand-${suffix}-${Date.now()}@test.local` },
  });
  userIds.push(user.id);
  return user;
}

describe("品牌服务", () => {
  it("规范化官网地址", () => {
    expect(normalizeWebsite("geoscore.cn/")).toBe("https://geoscore.cn");
    expect(normalizeWebsite("http://example.com/path/")).toBe("http://example.com/path");
  });

  it("创建品牌时去重别名和竞品并生成问题", async () => {
    const owner = await createUser("owner");
    const brand = await createBrandForUser(owner.id, {
      name: "GeoScore",
      website: "geoscore.cn",
      industry: "软件与互联网",
      product: "AI 品牌可见度监测平台",
      targetAudience: "品牌市场负责人",
      aliases: ["Geo Score", "Geo Score", " geoscore "],
      competitors: ["竞品甲", "竞品甲", "竞品乙"],
    });
    expect(brand.aliases.map((x) => x.value)).toEqual(["Geo Score", "geoscore"]);
    expect(new Set(brand.competitors.map((x) => x.name))).toEqual(new Set(["竞品甲", "竞品乙"]));
    expect(brand.prompts.length).toBeGreaterThanOrEqual(8);
  });

  it("不能读取其他用户的品牌", async () => {
    const owner = await createUser("owner");
    const stranger = await createUser("stranger");
    const brand = await createBrandForUser(owner.id, {
      name: "隔离测试品牌",
      website: "https://example.cn",
      industry: "企业服务",
      product: "测试产品",
      targetAudience: "企业客户",
      aliases: [],
      competitors: [],
    });
    await expect(getBrandForUser(stranger.id, brand.id)).resolves.toBeNull();
  });
});
