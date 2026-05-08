import { NextRequest, NextResponse } from "next/server";

import {
  readProjectManifest,
  writeProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { enrichManifestFromProjectState } from "@/lib/project-state/manifest-enrichment";
import { appendAuditEntry } from "@/lib/manifest/audit-log";

export const dynamic = "force-dynamic";

/**
 * Forces a full server-side re-enrichment pass:
 * layout matching, priority scores, aggregates, label cross-references.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const enriched = await enrichManifestFromProjectState(manifest);
  await writeProjectManifest(enriched);

  const badgeNumber = req.headers.get("x-badge-number") ?? "unknown";
  await appendAuditEntry({
    projectId,
    badgeNumber,
    role: "engineer",
    endpoint: "POST /manifest/recalculate",
    changedPaths: ["*"],
    before: null,
    after: null,
    reason: "Manual recalculation triggered",
  });

  return NextResponse.json({ manifest: enriched });
}
