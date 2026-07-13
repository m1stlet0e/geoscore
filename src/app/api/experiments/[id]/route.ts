import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { publishExperimentForUser } from "@/server/experiments/service";
import { experimentErrorResponse } from "@/app/api/experiments/error-response";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({
  actionPlan: z.string().min(10).max(10_000),
  targetUrl: z.string().max(2_048).optional(),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "实验参数不正确" }, { status: 400 });
  }
  const [parsedParams, parsedBody] = [
    paramsSchema.safeParse(await params),
    bodySchema.safeParse(body),
  ];
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ message: "实验参数不正确" }, { status: 400 });
  }
  try {
    const experiment = await publishExperimentForUser(
      session.user.id,
      parsedParams.data.id,
      parsedBody.data,
    );
    return NextResponse.json({ experiment });
  } catch (error) {
    return experimentErrorResponse(error, "实验更新失败");
  }
}
