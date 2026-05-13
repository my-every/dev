import { NextRequest, NextResponse } from "next/server";

import {
  readProjectManifest,
  writeProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { enrichManifestFromProjectState } from "@/lib/project-state/manifest-enrichment";
import { syncAssignmentSettingsToLegal } from "@/lib/legal-drawings/library";
import { AssignmentPatchSchema } from "@/lib/manifest/engineer-schemas";
import { appendAuditEntry } from "@/lib/manifest/audit-log";
import { addActivityToShare } from "@/lib/activity/share-activity-store";
import { ASSIGNMENT_STAGES } from "@/types/d380-assignment-stages";
import type { ActivityAction } from "@/types/activity";

export const dynamic = "force-dynamic";

function getStageLabel(stageId: string | undefined): string {
  if (!stageId) return "Unknown";
  const def = ASSIGNMENT_STAGES.find((s) => s.id === stageId);
  if (def) return def.label;
  return stageId.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveActivityAction(
  patch: { stage?: string; status?: string },
  before: { stage?: string; status?: string },
): ActivityAction | null {
  if (patch.stage && patch.stage !== before.stage) return "STAGE_CHANGED";
  if (patch.status) {
    const s = patch.status.toUpperCase();
    if (s === "IN_PROGRESS") return "STARTED";
    if (s === "COMPLETE" || s === "COMPLETED") return "COMPLETED";
    if (s === "BLOCKED") return "BLOCKED";
    if (s === "NOT_STARTED" || s === "INCOMPLETE") return "REOPENED";
    if (s === "GREEN_CHANGE") return "STAGE_CHANGED";
  }
  return null;
}

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

  const updatedAssignment = { ...assignment, ...patch } as typeof assignment;
  const updatedManifest = await enrichManifestFromProjectState({
    ...manifest,
    assignments: {
      ...manifest.assignments,
      [sheetSlug]: updatedAssignment,
    },
  });
  await writeProjectManifest(updatedManifest);

  // Sync assignment settings (unitType, boxSide, etc.) back to legal drawings
  // so future project instances inherit these values
  if (patch.unitType !== undefined || patch.boxSide !== undefined || 
      patch.normalizedTitle !== undefined || patch.boxNumber !== undefined) {
    await syncAssignmentSettingsToLegal({ projectManifest: updatedManifest });
  }

  const badgeNumber = req.headers.get("x-badge-number") ?? "unknown";
  const shift = req.headers.get("x-shift") ?? "1st";
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

  // Log to activity timeline with fully resolved metadata
  const action = resolveActivityAction(patch, before);
  if (action && badgeNumber !== "unknown") {
    const newStageLabel = getStageLabel(patch.stage ?? updatedAssignment.stage);
    const oldStageLabel = getStageLabel(before.stage);

    const metadata: Record<string, unknown> = {
      projectName: manifest.name || manifest.pdNumber,
      pdNumber: manifest.pdNumber,
      sheetName: assignment.sheetName,
      workflow: patch.stage ? newStageLabel : newStageLabel,
      before: { stage: before.stage, status: before.status },
      after: { stage: patch.stage, status: patch.status },
    };

    if (action === "STAGE_CHANGED") {
      metadata.toStage = newStageLabel;
      metadata.fromStage = oldStageLabel;
    }

    await addActivityToShare(badgeNumber, shift, {
      action,
      performedBy: badgeNumber,
      projectId,
      assignmentId: sheetSlug,
      stage: patch.stage ?? updatedAssignment.stage,
      result: "success",
      metadata,
    });
  }

  return NextResponse.json({
    assignment: updatedManifest.assignments[sheetSlug],
  });
}
