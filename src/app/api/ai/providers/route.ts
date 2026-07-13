import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAiProviders } from "@/server/ai";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 });
  }

  return NextResponse.json({ providers: listAiProviders() });
}
