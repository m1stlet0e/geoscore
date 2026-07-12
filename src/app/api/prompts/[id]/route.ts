import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { updatePromptForUser } from "@/server/brands/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const parsed = z.object({ text: z.string().trim().min(5).max(300).optional(), active: z.boolean().optional() }).refine((value) => value.text !== undefined || value.active !== undefined).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "问题内容不正确" }, { status: 400 });
  try {
    const { id } = await params;
    return NextResponse.json({ prompt: await updatePromptForUser(session.user.id, id, parsed.data) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "更新失败" }, { status: 404 });
  }
}
