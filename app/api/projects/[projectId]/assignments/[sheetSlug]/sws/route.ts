import { NextRequest, NextResponse } from "next/server";

import { readProjectManifest, writeProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import {
  readAssignmentSwsConfig,
  writeAssignmentSwsConfig,
} from "@/lib/project-state/share-assignment-sws-handlers";
import { createUnauthorizedResponse, createUnauthenticatedResponse, getRequestContextFromSession } from "@/lib/permissions/permission-guard";
import type { AssignmentSwsConfig } from "@/types/d380-assignment-sws";
import type { UserRole } from "@/types/d380-user-session";
import { getAssignmentFromManifest, hydrateAssignmentSwsConfig } from "@/lib/sws/assignment-sws-instance";
import { deriveSwsProgressSummary } from "@/lib/sws/progress";

export const dynamic = "force-dynamic";

const EDITOR_ROLES: Set<UserRole> = new Set(["TEAM_LEAD", "DEVELOPER"]);

async function resolveSwsContext(projectId: string, sheetSlug: string) {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  }

  const assignment = getAssignmentFromManifest(manifest, sheetSlug);
  if (!assignment) {
    return { error: NextResponse.json({ error: "Assignment not found" }, { status: 404 }) };
  }

  const existingConfig = await readAssignmentSwsConfig(projectId, sheetSlug);
  const hydrated = hydrateAssignmentSwsConfig(manifest, assignment, existingConfig);

  return {
    manifest,
    assignment,Y
    hydrated,
  };
}

async function updateAssignmentProgressFromSws(
  projectId: string,
  sheetSlug: string,
  config: AssignmentSwsConfig,
) {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return null;
  }

  const assignment = getAssignmentFromManifest(manifest, sheetSlug);
  if (!assignment) {
    return null;
  }

  const progress = deriveSwsProgressSummary(config);
  const nextStatus =
    progress.progressPercent >= 100
      ? "COMPLETED"
      : progress.progressPercent > 0
        ? "IN_PROGRESS"
        : assignment.status;

  manifest.assignments[sheetSlug] = {
    ...assignment,
    progress: progress.progressPercent,
    status: nextStatus,
    linkedOperationCode:
      config.linkedOperationCode
      ?? assignment.linkedOperationCode
      ?? assignment.boardAssignment?.operationCode
      ?? null,
    defaultOperationCodeByStage:
      config.defaultOperationCodeByStage
      ?? assignment.defaultOperationCodeByStage
      ?? {},
  };

  return manifest;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const { projectId, sheetSlug } = await params;
  const context = await resolveSwsContext(projectId, sheetSlug);

  if ("error" in context) {
    return context.error;
  }

  return NextResponse.json({
    assignment: {
      sheetSlug: context.assignment.sheetSlug,
      sheetName: context.assignment.sheetName,
      stage: context.assignment.stage,
      swsType: context.assignment.swsType,
      status: context.assignment.status,
      rowCount: context.assignment.rowCount,
    },
    sws: context.hydrated.config,
    progress: deriveSwsProgressSummary(context.hydrated.config),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const session = await getRequestContextFromSession();
  if (!session) return createUnauthenticatedResponse();

  if (!EDITOR_ROLES.has(session.role)) {
    return createUnauthorizedResponse({
      allowed: false,
      reason: "Only Lead+ roles can edit SWS structure",
      missingPermissions: ["lead_plus_required"],
    });
  }

  const { projectId, sheetSlug } = await params;
  const context = await resolveSwsContext(projectId, sheetSlug);
  if ("error" in context) {
    return context.error;
  }

  const body = (await request.json()) as { sws?: AssignmentSwsConfig };
  if (!body?.sws || typeof body.sws !== "object") {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const nextConfig: AssignmentSwsConfig = {
    ...body.sws,
    templateId: body.sws.templateId || context.hydrated.config.templateId,
    instanceVersion: body.sws.instanceVersion ?? context.hydrated.config.instanceVersion ?? 1,
    executionState: {
      ...(body.sws.executionState ?? context.hydrated.config.executionState ?? { activeMode: "PRINT_MANUAL", sectionStates: [] }),
      lastSavedAt: new Date().toISOString(),
      lastSavedBy: session.badge,
    },
  };

  const state = await writeAssignmentSwsConfig(projectId, sheetSlug, nextConfig);
  const nextManifest = await updateAssignmentProgressFromSws(projectId, sheetSlug, nextConfig);
  if (nextManifest) {
    await writeProjectManifest(nextManifest);
  }
  return NextResponse.json({ sws: state, progress: deriveSwsProgressSummary(nextConfig) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const session = await getRequestContextFromSession();
  if (!session) return createUnauthenticatedResponse();

  const { projectId, sheetSlug } = await params;
  const context = await resolveSwsContext(projectId, sheetSlug);
  if ("error" in context) {
    return context.error;
  }

  const body = (await request.json()) as {
    action?: "start" | "complete" | "toggle-checklist";
    sectionId?: string;
    stepId?: string;
    checked?: boolean;
    badge?: string;
  };

  if (!body.action || !body.sectionId) {
    return NextResponse.json({ error: "Missing action or sectionId" }, { status: 400 });
  }

  const current = context.hydrated.config;
  const sectionStates = [...(current.executionState?.sectionStates ?? [])];
  const existingIndex = sectionStates.findIndex((item) => item.sectionId === body.sectionId);
  const now = new Date().toISOString();
  const sectionState =
    existingIndex >= 0
      ? { ...sectionStates[existingIndex] }
      : {
          sectionId: body.sectionId,
          status: "NOT_STARTED" as const,
          checklistState: {},
          comments: [],
          discrepancyCounts: {},
        };

  if (body.action === "start") {
    sectionState.status = "IN_PROGRESS";
    sectionState.startTime = sectionState.startTime ?? now;
    sectionState.completedBy = body.badge ?? session.badge;
  } else if (body.action === "complete") {
    sectionState.status = "COMPLETE";
    sectionState.endTime = now;
    sectionState.completedBy = body.badge ?? session.badge;
  } else if (body.action === "toggle-checklist" && body.stepId) {
    sectionState.checklistState = {
      ...(sectionState.checklistState ?? {}),
      [body.stepId]: Boolean(body.checked),
    };
  }

  if (existingIndex >= 0) {
    sectionStates[existingIndex] = sectionState;
  } else {
    sectionStates.push(sectionState);
  }

  const nextConfig: AssignmentSwsConfig = {
    ...current,
    linkedOperationCode:
      current.linkedOperationCode
      ?? context.assignment.linkedOperationCode
      ?? context.assignment.boardAssignment?.operationCode
      ?? null,
    executionState: {
      ...(current.executionState ?? { activeMode: "TABLET_INTERACTIVE", sectionStates: [] }),
      sectionStates,
      lastSavedAt: now,
      lastSavedBy: session.badge,
    },
  };

  const state = await writeAssignmentSwsConfig(projectId, sheetSlug, nextConfig);
  const nextManifest = await updateAssignmentProgressFromSws(projectId, sheetSlug, nextConfig);
  if (nextManifest) {
    await writeProjectManifest(nextManifest);
  }
  return NextResponse.json({ sws: state, progress: deriveSwsProgressSummary(nextConfig) });
}
