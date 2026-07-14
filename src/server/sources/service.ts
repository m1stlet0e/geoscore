import { db } from "@/lib/db";

type OwnedSourceInput = { url: string; label?: string };

function normalizeSourceUrl(value: string) {
  const candidate = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
  } catch {
    throw new Error("自有内容链接不正确");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("自有内容链接不正确");
  }
  parsed.hash = "";
  parsed.search = "";
  if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/$/, parsed.pathname === "/" ? "/" : "");
}

function normalizeDomain(url: string) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

async function assertBrandOwnership(userId: string, brandId: string) {
  const brand = await db.brand.findFirst({
    where: { id: brandId, ownerId: userId },
    select: { id: true },
  });
  if (!brand) throw new Error("品牌不存在");
}

export async function markOwnedSourceForUser(
  userId: string,
  brandId: string,
  input: OwnedSourceInput,
) {
  await assertBrandOwnership(userId, brandId);
  const url = normalizeSourceUrl(input.url);
  const label = input.label?.trim() || null;
  return db.ownedSource.upsert({
    where: { brandId_url: { brandId, url } },
    create: { brandId, url, domain: normalizeDomain(url), label },
    update: { domain: normalizeDomain(url), label },
  });
}

export async function unmarkOwnedSourceForUser(userId: string, sourceId: string) {
  const source = await db.ownedSource.findFirst({
    where: { id: sourceId, brand: { ownerId: userId } },
    select: { id: true },
  });
  if (!source) throw new Error("自有内容标记不存在");
  return db.ownedSource.delete({ where: { id: source.id }, select: { id: true } });
}
