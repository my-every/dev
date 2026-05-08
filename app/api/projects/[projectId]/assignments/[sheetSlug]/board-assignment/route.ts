import { NextRequest, NextResponse } from "next/server";

import {
  readProjectManifest,
  writeProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { BoardAssignmentPatchSchema } from "@/lib/manifest/engineer-schemas";
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
  const parsed = BoardAssignmentPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid board assignment patch", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const patch = parsed.data;
  const existing = assignment.boardAssignment ?? {};
  const before = { ...existing };

  // Locked fields: assignmentId and activeOperationEntryId are never overwritten
  const updatedBoardAssignment = {
    ...existing,
    ...patch,
    assignmentId: existing.assignmentId ?? `${projectId}:${sheetSlug}`,
    activeOperationEntryId: existing.activeOperationEntryId ?? null,
  };

  const updatedManifest = {
    ...manifest,
    assignments: {
      ...manifest.assignments,
      [sheetSlug]: {
        ...assignment,
        boardAssignment: updatedBoardAssignment,
        // Promote shortcuts
        assignedBadge: updatedBoardAssignment.assignedBadge ?? null,
        workflowStatus: updatedBoardAssignment.workflowStatus ?? "pending",
      },
    },
  };

  await writeProjectManifest(updatedManifest);

  const badgeNumber = req.headers.get("x-badge-number") ?? "unknown";
  const reason = req.headers.get("x-patch-reason") ?? undefined;
  await appendAuditEntry({
    projectId,
    badgeNumber,
    role: "engineer",
    endpoint: `PATCH /assignments/${sheetSlug}/board-assignment`,
    changedPaths: Object.keys(patch).map((k) => `assignments.${sheetSlug}.boardAssignment.${k}`),
    before,
    after: patch,
    reason,
  });

  return NextResponse.json({
    boardAssignment: updatedManifest.assignments[sheetSlug]?.boardAssignment,
  });
}
