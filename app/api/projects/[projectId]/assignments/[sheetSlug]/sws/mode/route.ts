import { NextRequest, NextResponse } from "next/server";

import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import {
  readAssignmentSwsConfig,
  writeAssignmentSwsConfig,
} from "@/lib/project-state/share-assignment-sws-handlers";
import { createUnauthenticatedResponse, getRequestContextFromSession } from "@/lib/permissions/permission-guard";
import { getAssignmentFromManifest, hydrateAssignmentSwsConfig, withExecutionMode } from "@/lib/sws/assignment-sws-instance";
import type { SwsExecutionMode } from "@/types/d380-sws";

export const dynamic = "force-dynamic";

function isMode(value: string): value is SwsExecutionMode {
  return value === "PRINT_MANUAL" || value === "TABLET_INTERACTIVE";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const session = await getRequestContextFromSession();
  if (!session) return createUnauthenticatedResponse();

  const { projectId, sheetSlug } = await params;
  const manifest = await readProjectManifest(projectId);
  if (!manifest) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const assignment = getAssignmentFromManifest(manifest, sheetSlug);
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const body = (await request.json()) as { mode?: string };
  if (!body.mode || !isMode(body.mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const state = await readAssignmentSwsConfig(projectId, sheetSlug);
  const hydrated = hydrateAssignmentSwsConfig(manifest, assignment, state, body.mode);
  const nextConfig = withExecutionMode(hydrated.config, body.mode, session.badge);
  const next = await writeAssignmentSwsConfig(projectId, sheetSlug, nextConfig);

  return NextResponse.json({ sws: next });
}
