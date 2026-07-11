import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteBrandForUser, getBrandForUser } from "@/server/brands/service";

type Context = { params: Promise<{ id: string }> };

async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function GET(_: Request, context: Context) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const { id } = await context.params;
  const brand = await getBrandForUser(userId, id);
  if (!brand) return NextResponse.json({ message: "品牌不存在" }, { status: 404 });
  return NextResponse.json({ brand });
}

export async function DELETE(_: Request, context: Context) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const { id } = await context.params;
  if (!(await deleteBrandForUser(userId, id))) return NextResponse.json({ message: "品牌不存在" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
