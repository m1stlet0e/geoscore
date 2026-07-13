import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createScanForUser } from "@/server/scans/service";

const schema = z.object({
  brandId: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1).max(5),
  repeatCount: z.number().int().min(1).max(3),
}).strict();
const creationKeySchema = z.string().uuid();
const badRequestMessages = new Set([
  "重复采样次数必须是 1 到 3 之间的整数",
  "AI 平台不能重复选择",
  "扫描幂等键不正确",
  "品牌不存在",
  "至少选择一个 AI 平台",
  "一次扫描不能混合真实与模拟 AI 平台",
  "固定问题版本不能为空",
  "品牌没有可扫描的问题",
]);

function scanCreationError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("额度不足")) {
    return { message, status: 402 };
  }
  if (message === "幂等键已用于不同扫描配置") {
    return { message, status: 409 };
  }
  if (
    badRequestMessages.has(message)
    || message.startsWith("未知 AI 平台：")
    || (message.startsWith("AI 平台 ") && message.includes("不可用："))
  ) {
    return { message, status: 400 };
  }
  return {
    message: "扫描创建状态暂不可确认，请使用原配置重试",
    status: 500,
  };
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const parsedCreationKey = creationKeySchema.safeParse(
    request.headers.get("Idempotency-Key"),
  );
  if (!parsedCreationKey.success) {
    return NextResponse.json({ message: "扫描幂等键不正确" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "扫描参数不正确" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "扫描参数不正确" }, { status: 400 });
  try {
    const scan = await createScanForUser(
      session.user.id,
      parsed.data.brandId,
      parsed.data.platforms,
      {
        repeatCount: parsed.data.repeatCount,
        creationKey: parsedCreationKey.data,
      },
    );
    return NextResponse.json({ scan }, { status: 201 });
  } catch (error) {
    const failure = scanCreationError(error);
    return NextResponse.json({ message: failure.message }, { status: failure.status });
  }
}
