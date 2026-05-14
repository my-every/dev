import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  readProjectManifest,
  writeProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { appendAuditEntry } from "@/lib/manifest/audit-log";

export const dynamic = "force-dynamic";

const CrossWireVisibilitySchema = z.object({
  sheetSlug: z.string().min(1),
  visibilitySettings: z.record(z.string(), z.boolean()).optional(),
  swapLocations: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CrossWireVisibilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid cross-wire visibility request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { sheetSlug, visibilitySettings, swapLocations } = parsed.data;

  const assignment = manifest.assignments[sheetSlug];
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const before = assignment.externalLocations ?? [];

  // Update crossWireVisible for each external location based on visibilitySettings
  const updatedLocations = (assignment.externalLocations ?? []).map((loc) => {
    const key = loc.location.trim().toUpperCase();
    const crossWireVisible = visibilitySettings?.[key];
    
    return {
      ...loc,
      // Only update crossWireVisible if it was explicitly provided in visibilitySettings
      ...(crossWireVisible !== undefined && { crossWireVisible }),
    };
  });

  const updatedManifest = {
    ...manifest,
    assignments: {
      ...manifest.assignments,
      [sheetSlug]: {
        ...assignment,
        externalLocations: updatedLocations,
        // Store swap location preference at assignment level if provided
        ...(swapLocations !== undefined && { crossWireSwapLocations: swapLocations }),
      },
    },
  };

  await writeProjectManifest(updatedManifest);

  const badgeNumber = req.headers.get("x-badge-number") ?? "unknown";
  await appendAuditEntry({
    projectId,
    badgeNumber,
    role: "engineer",
    endpoint: `POST /cross-wire-visibility`,
    changedPaths: [`assignments.${sheetSlug}.externalLocations`, `assignments.${sheetSlug}.crossWireSwapLocations`],
    before: { externalLocations: before, swapLocations: assignment.crossWireSwapLocations },
    after: { externalLocations: updatedLocations, swapLocations },
  });

  return NextResponse.json({
    success: true,
    sheetSlug,
    externalLocations: updatedLocations,
  });
}
