import { NextRequest, NextResponse } from "next/server";

import {
  readProjectManifest,
  writeProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { enrichManifestFromProjectState } from "@/lib/project-state/manifest-enrichment";
import { AssignmentPatchSchema } from "@/lib/manifest/engineer-schemas";
import { appendAuditEntry } from "@/lib/manifest/audit-log";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const { projectId, sheetSlug } = await params;

  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const assignment = manifest.assignments[sheetSlug];
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = AssignmentPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assignment patch", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const patch = parsed.data;
  const before = {
    stage: assignment.stage,
    status: assignment.status,
    swsType: assignment.swsType,
    unitType: assignment.unitType,
    boxSide: assignment.boxSide,
    linkedOperationCode: assignment.linkedOperationCode,
    defaultOperationCodeByStage: assignment.defaultOperationCodeByStage,
  };

  const updatedAssignment = { ...assignment, ...patch };
  const updatedManifest = await enrichManifestFromProjectState({
    ...manifest,
    assignments: {
      ...manifest.assignments,
      [sheetSlug]: updatedAssignment,
    },
  });
  await writeProjectManifest(updatedManifest);

  const badgeNumber = req.headers.get("x-badge-number") ?? "unknown";
  const reason = req.headers.get("x-patch-reason") ?? undefined;
  await appendAuditEntry({
    projectId,
    badgeNumber,
    role: "engineer",
    endpoint: `PATCH /assignments/${sheetSlug}`,
    changedPaths: Object.keys(patch).map((k) => `assignments.${sheetSlug}.${k}`),
    before,
    after: patch,
    reason,
  });

  return NextResponse.json({
    assignment: updatedManifest.assignments[sheetSlug],
  });
}
