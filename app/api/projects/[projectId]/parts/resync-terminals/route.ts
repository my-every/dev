import { NextResponse } from "next/server";

import {
  readAllSheetSchemas,
  readProjectManifest,
  readStoredProjectFromState,
  resolveProjectRootDirectory,
} from "@/lib/project-state/share-project-state-handlers";
import {
  generateDevicePartNumbersMap,
  saveDevicePartNumbersMap,
} from "@/lib/project-state/device-part-numbers-generator";
import { syncExtractedPartTerminalSchemas } from "@/lib/project-state/part-terminal-schema";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const manifest = await readProjectManifest(projectId);
    if (!manifest) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectRoot = await resolveProjectRootDirectory(projectId, {
      pdNumber: manifest.pdNumber,
      projectName: manifest.name,
    });
    if (!projectRoot) {
      return NextResponse.json({ error: "Project root not found" }, { status: 404 });
    }

    const storedProjectResult = await readStoredProjectFromState(projectId);
    if (storedProjectResult?.project) {
      const devicePartNumbersMap = await generateDevicePartNumbersMap(storedProjectResult.project);
      await saveDevicePartNumbersMap(projectRoot, devicePartNumbersMap);
    }

    const sheetSchemas = await readAllSheetSchemas(projectId);
    const result = await syncExtractedPartTerminalSchemas({
      projectRoot,
      sheetSchemas,
    });

    return NextResponse.json({
      success: true,
      projectId,
      updatedPartCount: result.updatedParts.length,
      updatedParts: result.updatedParts,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to resync part terminals",
      },
      { status: 500 },
    );
  }
}
