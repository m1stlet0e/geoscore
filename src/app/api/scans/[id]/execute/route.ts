import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { executeScanForUser } from "@/server/scans/service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const { id } = await params;
  try {
    const scan = await executeScanForUser(session.user.id, id);
    return NextResponse.json({ scan });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "扫描执行失败" }, { status: 400 });
  }
}
