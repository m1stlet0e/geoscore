import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { markOwnedSourceForUser, unmarkOwnedSourceForUser } from "@/server/sources/service";

const createSchema = z.object({
  brandId: z.string().cuid(),
  url: z.string().trim().min(4).max(2_000),
  label: z.string().trim().max(100).optional(),
});

const deleteSchema = z.object({ id: z.string().cuid() });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "自有内容参数不正确" }, { status: 400 });
  try {
    const source = await markOwnedSourceForUser(session.user.id, parsed.data.brandId, parsed.data);
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "标记失败" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "自有内容标记不正确" }, { status: 400 });
  try {
    return NextResponse.json({ source: await unmarkOwnedSourceForUser(session.user.id, parsed.data.id) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "取消标记失败" }, { status: 404 });
  }
}
