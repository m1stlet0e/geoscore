import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createScanForUser } from "@/server/scans/service";

const schema = z.object({ brandId: z.string().min(1), platforms: z.array(z.string()).min(1).max(5) });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "扫描参数不正确" }, { status: 400 });
  try {
    const scan = await createScanForUser(session.user.id, parsed.data.brandId, parsed.data.platforms);
    return NextResponse.json({ scan }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "扫描创建失败";
    return NextResponse.json({ message }, { status: message.includes("额度不足") ? 402 : 400 });
  }
}
