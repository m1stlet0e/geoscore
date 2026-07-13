import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createExperimentForUser } from "@/server/experiments/service";
import { experimentErrorResponse } from "@/app/api/experiments/error-response";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ message: "机会参数不正确" }, { status: 400 });
  }
  try {
    const experiment = await createExperimentForUser(session.user.id, parsed.data.id);
    return NextResponse.json({ experiment }, { status: 201 });
  } catch (error) {
    return experimentErrorResponse(error, "实验创建失败");
  }
}
