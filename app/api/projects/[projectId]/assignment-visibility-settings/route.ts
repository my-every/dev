import { NextRequest, NextResponse } from "next/server";

import {
  loadResolvedVisibilityForProject,
  writeProjectAssignmentVisibilitySettings,
  type AssignmentVisibilitySettingsEntry,
} from "@/lib/project-state/assignment-visibility-settings";

export const dynamic = "force-dynamic";

function parseAssignments(value: unknown): AssignmentVisibilitySettingsEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: AssignmentVisibilitySettingsEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const source = entry as Record<string, unknown>;
    parsed.push({
      sheetSlug: String(source.sheetSlug ?? "").trim(),
      sheetName: String(source.sheetName ?? "").trim(),
      unitType: typeof source.unitType === "string" ? source.unitType.trim() : null,
      locations: Array.isArray(source.locations)
        ? source.locations
            .filter((loc): loc is Record<string, unknown> => Boolean(loc) && typeof loc === "object")
            .map((loc) => ({
              location: String(loc.location ?? "").trim(),
              wireListVisible: Boolean(loc.wireListVisible),
              brandingVisible: Boolean(loc.brandingVisible),
              crossWireVisible: Boolean(loc.crossWireVisible),
            }))
        : [],
    });
  }

  return parsed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const payload = await loadResolvedVisibilityForProject(projectId);
    return NextResponse.json({
      settings: payload.settings,
      resolvedBySheet: payload.resolvedBySheet,
      referenceUpdatedAt: payload.reference.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load assignment visibility settings.";
    const status = message.toLowerCase().includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  let body: {
    assignments?: unknown;
    persistToReference?: unknown;
    pdNumber?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const assignments = parseAssignments(body.assignments);
  if (assignments.length === 0) {
    return NextResponse.json({ error: "No assignment visibility settings provided." }, { status: 400 });
  }

  try {
    const saved = await writeProjectAssignmentVisibilitySettings({
      projectId,
      pdNumber: typeof body.pdNumber === "string" ? body.pdNumber : null,
      assignments,
      persistToReference: Boolean(body.persistToReference),
    });

    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save assignment visibility settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
