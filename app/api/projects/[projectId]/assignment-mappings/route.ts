import { NextResponse } from "next/server";

import { readAssignmentMappings, readProjectManifest, writeAssignmentMappings } from "@/lib/project-state/share-project-state-handlers";
import type { MappedAssignment } from "@/lib/assignment/mapped-assignment";
import {
  readAssignmentSwsConfig,
  writeAssignmentSwsConfig,
} from "@/lib/project-state/share-assignment-sws-handlers";
import { getAssignmentFromManifest, hydrateAssignmentSwsConfig } from "@/lib/sws/assignment-sws-instance";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const mappings = await readAssignmentMappings(projectId);
    return NextResponse.json({ mappings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read assignment mappings" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = (await request.json()) as {
    mappings?: MappedAssignment[];
    pdNumber?: string | null;
  };

  if (!Array.isArray(body.mappings)) {
    return NextResponse.json({ error: "Invalid mappings payload" }, { status: 400 });
  }

  try {
    const mappings = await writeAssignmentMappings(projectId, body.pdNumber ?? null, body.mappings);

    const manifest = await readProjectManifest(projectId);
    if (manifest) {
      await Promise.all(
        mappings.map(async (mapping) => {
          const assignment = getAssignmentFromManifest(manifest, mapping.sheetSlug);
          if (!assignment) return;
          const existing = await readAssignmentSwsConfig(projectId, mapping.sheetSlug);
          const hydrated = hydrateAssignmentSwsConfig(manifest, assignment, existing);
          await writeAssignmentSwsConfig(projectId, mapping.sheetSlug, hydrated.config);
        }),
      );
    }

    return NextResponse.json({ ok: true, mappings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to persist assignment mappings" },
      { status: 500 },
    );
  }
}
