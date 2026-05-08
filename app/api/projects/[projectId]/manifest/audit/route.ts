import { NextRequest, NextResponse } from "next/server";

import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import { readAuditLog } from "@/lib/manifest/audit-log";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10))) : 100;

  const entries = await readAuditLog(projectId, limit);
  return NextResponse.json({ entries, total: entries.length });
}
