import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadScanSnapshotForUser } from "@/server/reports/loader";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const { id } = await params;
  const scan = await loadScanSnapshotForUser(session.user.id, id);
  if (!scan) return NextResponse.json({ message: "扫描快照不存在" }, { status: 404 });
  const exportedAt = new Date().toISOString();
  return new NextResponse(JSON.stringify({
    schemaVersion: "geoscore-evidence-snapshot/v1",
    exportedAt,
    scan,
  }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="geoscore-evidence-${scan.id}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
