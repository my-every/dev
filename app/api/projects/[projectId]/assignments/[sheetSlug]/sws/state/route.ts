import { NextRequest, NextResponse } from "next/server";

import {
  createDefaultAssignmentWorkspaceState,
  type AssignmentSwsConfig,
  type AssignmentWorkspaceBrandingEdits,
  type AssignmentWorkspaceColumnOrder,
  type AssignmentWorkspaceColumnVisibility,
  type AssignmentWorkspaceRevisionSelection,
  type AssignmentWorkspaceWorkflowState,
} from "@/types/d380-assignment-sws";
import type { PatchHistory, PatchOperation, RowPatch } from "@/lib/row-patches";
import { getAssignmentFromManifest, hydrateAssignmentSwsConfig } from "@/lib/sws/assignment-sws-instance";
import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import {
  readAssignmentSwsConfig,
  writeAssignmentSwsConfig,
} from "@/lib/project-state/share-assignment-sws-handlers";
import {
  createUnauthenticatedResponse,
  getRequestContextFromSession,
} from "@/lib/permissions/permission-guard";

export const dynamic = "force-dynamic";

type WorkspaceState = ReturnType<typeof createDefaultAssignmentWorkspaceState>;
type WorkspaceStateSection = Extract<keyof WorkspaceState, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRowPatch(value: unknown): value is RowPatch {
  if (!isRecord(value) || typeof value.rowId !== "string") {
    return false;
  }

  return (
    (value.lengthOverride === undefined || value.lengthOverride === null || typeof value.lengthOverride === "number") &&
    (value.lengthAdjustment === undefined || typeof value.lengthAdjustment === "number") &&
    (value.comment === undefined || typeof value.comment === "string") &&
    (value.ipvChecked === undefined || typeof value.ipvChecked === "boolean") &&
    (value.fromChecked === undefined || typeof value.fromChecked === "boolean") &&
    (value.toChecked === undefined || typeof value.toChecked === "boolean") &&
    (value.gaugeOverride === undefined || typeof value.gaugeOverride === "string") &&
    (value.wireIdOverride === undefined || typeof value.wireIdOverride === "string") &&
    (value.updatedAt === undefined || typeof value.updatedAt === "number") &&
    (value.source === undefined || value.source === "manual" || value.source === "bulk" || value.source === "import")
  );
}

function isWorkflowState(value: unknown): value is AssignmentWorkspaceWorkflowState {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) =>
      isRecord(entry) &&
      (entry.fromChecked === undefined || typeof entry.fromChecked === "boolean") &&
      (entry.toChecked === undefined || typeof entry.toChecked === "boolean") &&
      (entry.ipvChecked === undefined || typeof entry.ipvChecked === "boolean") &&
      (entry.comment === undefined || typeof entry.comment === "string"),
  );
}

function isBooleanRecord(value: unknown): value is AssignmentWorkspaceColumnVisibility {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean");
}

function isNumberRecord(value: unknown): value is AssignmentWorkspaceColumnOrder {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "number");
}

function isBrandingRowEdit(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.wireNo === "string" &&
    (value.length === undefined || typeof value.length === "number") &&
    (value.lengthAdjustment === undefined || typeof value.lengthAdjustment === "number") &&
    (value.excluded === undefined || typeof value.excluded === "boolean") &&
    (value.notes === undefined || typeof value.notes === "string")
  );
}

function isBrandingEdits(value: unknown): value is AssignmentWorkspaceBrandingEdits {
  return isRecord(value) && Object.values(value).every(isBrandingRowEdit);
}

function isRevisionSelection(value: unknown): value is AssignmentWorkspaceRevisionSelection {
  return (
    isRecord(value) &&
    (value.wireListFilename === null || value.wireListFilename === undefined || typeof value.wireListFilename === "string") &&
    (value.layoutFilename === null || value.layoutFilename === undefined || typeof value.layoutFilename === "string")
  );
}

function isPatchOperation(value: unknown): value is PatchOperation {
  return (
    isRecord(value) &&
    (value.type === "set" || value.type === "update" || value.type === "delete" || value.type === "bulk") &&
    Array.isArray(value.rowIds) && value.rowIds.every((entry) => typeof entry === "string") &&
    typeof value.sheetSlug === "string" &&
    Array.isArray(value.previousPatches) && value.previousPatches.every(isRowPatch) &&
    Array.isArray(value.newPatches) && value.newPatches.every(isRowPatch) &&
    typeof value.timestamp === "number" &&
    typeof value.description === "string"
  );
}

function isPatchHistory(value: unknown): value is PatchHistory {
  return (
    isRecord(value) &&
    Array.isArray(value.past) && value.past.every(isPatchOperation) &&
    Array.isArray(value.future) && value.future.every(isPatchOperation) &&
    typeof value.maxSize === "number"
  );
}

function parseScope(scope: string | null): WorkspaceStateSection | null {
  switch (scope) {
    case "rowPatches":
    case "workflow":
    case "columnVisibility":
    case "columnOrder":
    case "brandingEdits":
    case "revisionSelection":
    case "patchHistory":
      return scope;
    default:
      return null;
  }
}

function parseWorkspaceStateUpdate(body: unknown): Partial<WorkspaceState> | null {
  if (!isRecord(body)) {
    return null;
  }

  const update: Partial<WorkspaceState> = {};

  if (body.rowPatches !== undefined) {
    if (!Array.isArray(body.rowPatches) || !body.rowPatches.every(isRowPatch)) {
      return null;
    }
    update.rowPatches = body.rowPatches;
  }

  if (body.workflow !== undefined) {
    if (!isWorkflowState(body.workflow)) {
      return null;
    }
    update.workflow = body.workflow;
  }

  if (body.columnVisibility !== undefined) {
    if (!isBooleanRecord(body.columnVisibility)) {
      return null;
    }
    update.columnVisibility = body.columnVisibility;
  }

  if (body.columnOrder !== undefined) {
    if (!isNumberRecord(body.columnOrder)) {
      return null;
    }
    update.columnOrder = body.columnOrder;
  }

  if (body.brandingEdits !== undefined) {
    if (!isBrandingEdits(body.brandingEdits)) {
      return null;
    }
    update.brandingEdits = body.brandingEdits;
  }

  if (body.revisionSelection !== undefined) {
    if (!isRevisionSelection(body.revisionSelection)) {
      return null;
    }
    update.revisionSelection = {
      wireListFilename: body.revisionSelection.wireListFilename ?? null,
      layoutFilename: body.revisionSelection.layoutFilename ?? null,
    };
  }

  if (body.patchHistory !== undefined) {
    if (!isPatchHistory(body.patchHistory)) {
      return null;
    }
    update.patchHistory = body.patchHistory;
  }

  return update;
}

async function resolveContext(projectId: string, sheetSlug: string): Promise<
  | { error: NextResponse }
  | {
      config: AssignmentSwsConfig;
    }
> {
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
  return { config: hydrated.config };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const { projectId, sheetSlug } = await params;
  const context = await resolveContext(projectId, sheetSlug);
  if ("error" in context) {
    return context.error;
  }

  return NextResponse.json({ workspaceState: context.config.workspaceState ?? createDefaultAssignmentWorkspaceState() });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const session = await getRequestContextFromSession();
  if (!session) return createUnauthenticatedResponse();

  const { projectId, sheetSlug } = await params;
  const context = await resolveContext(projectId, sheetSlug);
  if ("error" in context) {
    return context.error;
  }

  const update = parseWorkspaceStateUpdate(await request.json());
  if (!update) {
    return NextResponse.json({ error: "Malformed assignment workspace payload" }, { status: 400 });
  }

  const nextConfig: AssignmentSwsConfig = {
    ...context.config,
    workspaceState: {
      ...(context.config.workspaceState ?? createDefaultAssignmentWorkspaceState()),
      ...update,
    },
  };

  await writeAssignmentSwsConfig(projectId, sheetSlug, nextConfig);
  return NextResponse.json({ workspaceState: nextConfig.workspaceState });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const session = await getRequestContextFromSession();
  if (!session) return createUnauthenticatedResponse();

  const { projectId, sheetSlug } = await params;
  const context = await resolveContext(projectId, sheetSlug);
  if ("error" in context) {
    return context.error;
  }

  const defaults = createDefaultAssignmentWorkspaceState();
  const scope = parseScope(request.nextUrl.searchParams.get("scope"));
  const nextWorkspaceState = scope
    ? {
        ...(context.config.workspaceState ?? defaults),
        [scope]: defaults[scope],
      }
    : defaults;

  const nextConfig: AssignmentSwsConfig = {
    ...context.config,
    workspaceState: nextWorkspaceState,
  };

  await writeAssignmentSwsConfig(projectId, sheetSlug, nextConfig);
  return NextResponse.json({ workspaceState: nextWorkspaceState });
}
