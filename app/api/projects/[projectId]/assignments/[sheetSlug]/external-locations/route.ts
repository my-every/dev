import { NextRequest, NextResponse } from "next/server";

import {
  readProjectManifest,
  writeProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { ExternalLocationsPatchSchema } from "@/lib/manifest/engineer-schemas";
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
  const parsed = ExternalLocationsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid external locations patch", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const before = assignment.externalLocations ?? [];

  // Merge incoming visibility onto existing locations — the `location` string is locked
  // and comes from the source UBP reference/schema; we only allow changing visibility flags.
  const existingByLocation = new Map(
    (assignment.externalLocations ?? []).map((loc) => [
      loc.location.trim().toUpperCase(),
      loc,
    ]),
  );

  const merged = parsed.data.locations
    .map(({ location, wireListVisible, brandingVisible }) => {
      const key = location.trim().toUpperCase();
      const existing = existingByLocation.get(key);
      if (!existing) {
        // Reject patches for locations not in the manifest
        return null;
      }
      return { location: existing.location, wireListVisible, brandingVisible };
    })
    .filter((loc): loc is NonNullable<typeof loc> => loc !== null);

  const updatedManifest = {
    ...manifest,
    assignments: {
      ...manifest.assignments,
      [sheetSlug]: {
        ...assignment,
        externalLocations: merged,
      },
    },
  };

  await writeProjectManifest(updatedManifest);

  const badgeNumber = req.headers.get("x-badge-number") ?? "unknown";
  await appendAuditEntry({
    projectId,
    badgeNumber,
    role: "engineer",
    endpoint: `PATCH /assignments/${sheetSlug}/external-locations`,
    changedPaths: merged.map((l) => `assignments.${sheetSlug}.externalLocations[${l.location}]`),
    before,
    after: merged,
  });

  return NextResponse.json({
    externalLocations: updatedManifest.assignments[sheetSlug]?.externalLocations,
  });
}
