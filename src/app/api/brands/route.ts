import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBrandSchema } from "@/lib/validation/brand";
import { createBrandForUser, listBrandsForUser } from "@/server/brands/service";

async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  return NextResponse.json({ brands: await listBrandsForUser(userId) });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const parsed = createBrandSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "品牌信息不完整", issues: parsed.error.issues }, { status: 400 });
  try {
    const brand = await createBrandForUser(userId, parsed.data);
    return NextResponse.json({ brand }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "品牌创建失败";
    return NextResponse.json({ message }, { status: message.includes("套餐") ? 403 : 400 });
  }
}
