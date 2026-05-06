import { NextRequest, NextResponse } from "next/server";

import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import {
  readAssignmentSwsConfig,
  writeAssignmentSwsConfig,
} from "@/lib/project-state/share-assignment-sws-handlers";
import { createUnauthorizedResponse, createUnauthenticatedResponse, getRequestContextFromSession } from "@/lib/permissions/permission-guard";
import { getAssignmentFromManifest, hydrateAssignmentSwsConfig } from "@/lib/sws/assignment-sws-instance";
import { createDefaultAssignmentSwsConfig, type SwsExecutionState } from "@/types/d380-assignment-sws";
import type { UserRole } from "@/types/d380-user-session";

export const dynamic = "force-dynamic";

const EDITOR_ROLES = new Set<UserRole>(["TEAM_LEAD", "MANAGER", "SUPERVISOR", "DEVELOPER"]);

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const session = await getRequestContextFromSession();
  if (!session) return createUnauthenticatedResponse();

  if (!EDITOR_ROLES.has(session.role)) {
    return createUnauthorizedResponse({
      allowed: false,
      reason: "Only Lead+ roles can reset SWS structure",
      missingPermissions: ["lead_plus_required"],
    });
  }

  const { projectId, sheetSlug } = await params;
  const manifest = await readProjectManifest(projectId);
  if (!manifest) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const assignment = getAssignmentFromManifest(manifest, sheetSlug);
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const priorConfig = await readAssignmentSwsConfig(projectId, sheetSlug);
  const currentTemplate = priorConfig?.templateId ?? undefined;
  const base = createDefaultAssignmentSwsConfig((currentTemplate as any) ?? undefined);
  const hydrated = hydrateAssignmentSwsConfig(manifest, assignment, base);

  hydrated.config.executionState = {
    activeMode: hydrated.config.executionState?.activeMode ?? "PRINT_MANUAL",
    sectionStates: hydrated.config.executionState?.sectionStates ?? [],
    ...(hydrated.config.executionState ?? {}),
    lastSavedAt: new Date().toISOString(),
    lastSavedBy: session.badge,
  } satisfies SwsExecutionState;

  const next = await writeAssignmentSwsConfig(projectId, sheetSlug, hydrated.config);
  return NextResponse.json({ sws: next });
}
