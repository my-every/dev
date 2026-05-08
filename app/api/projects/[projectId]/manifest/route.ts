import { NextRequest, NextResponse } from "next/server";

import {
  readProjectManifest,
  writeProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { enrichManifestFromProjectState } from "@/lib/project-state/manifest-enrichment";
import { ProjectManifestPatchSchema } from "@/lib/manifest/engineer-schemas";
import { appendAuditEntry } from "@/lib/manifest/audit-log";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json({ manifest });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ProjectManifestPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid patch payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const patch = parsed.data;
  const before = {
    name: manifest.name,
    unitNumber: manifest.unitNumber,
    revision: manifest.revision,
    lwcType: manifest.lwcType,
    color: manifest.color,
    status: manifest.status,
    dueDate: manifest.dueDate,
    shipDate: manifest.shipDate,
    planConlayDate: manifest.planConlayDate,
    planConassyDate: manifest.planConassyDate,
    deptTargetDate: manifest.deptTargetDate,
  };

  const updated = await enrichManifestFromProjectState({
    ...manifest,
    ...patch,
  });
  await writeProjectManifest(updated);

  const badgeNumber = req.headers.get("x-badge-number") ?? "unknown";
  const reason = req.headers.get("x-patch-reason") ?? undefined;
  await appendAuditEntry({
    projectId,
    badgeNumber,
    role: "engineer",
    endpoint: "PATCH /manifest",
    changedPaths: Object.keys(patch),
    before,
    after: patch,
    reason,
  });

  return NextResponse.json({ manifest: updated });
}
